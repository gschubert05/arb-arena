import os
import re
import json
import time
import datetime as dt
from typing import List, Dict, Any, Tuple

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'server', 'data', 'opportunities.json')
TARGET_URL = "http://odds.aussportsbetting.com/multibet"
BETTING_BASE = "http://odds.aussportsbetting.com/betting?competitionid={}"
SKIP_IDS = {72, 73, 108, 114}


def parse_comp_ids(env_val: str | None) -> List[int]:
    """Parse COMP_IDS like "1-150" or "11,12,13" into a list of ints."""
    if not env_val:
        return [i for i in range(10, 12) if i not in SKIP_IDS]
    parts = [p.strip() for p in env_val.split(',') if p.strip()]
    out: List[int] = []
    for p in parts:
        if '-' in p:
            a, b = p.split('-', 1)
            a, b = int(a), int(b)
            out.extend(range(min(a, b), max(a, b) + 1))
        else:
            out.append(int(p))
    return [i for i in out if i not in SKIP_IDS]


def make_driver() -> webdriver.Chrome:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1600,1200")
    # A realistic UA helps avoid “lite” templates
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                         "AppleWebKit/537.36 (KHTML, like Gecko) "
                         "Chrome/124.0.0.0 Safari/537.36")
    driver = webdriver.Chrome(options=options)
    return driver


def extract_search_phrase(match_text: str) -> str:
    """
    From "Home - 1.90 | Under 200.5 - 1.95" returns the right side label before odds, with + removed for Under lines.
    """
    try:
        right = match_text.split('|')[1].strip()
        phrase = right.split(' - ')[0].strip()
        if 'Under' in phrase:
            phrase = phrase.replace('+', '')
        return phrase
    except Exception:
        return match_text


def canonical_key(it: Dict[str, Any]) -> str:
    """Key used to de-dupe across sources; mirrors your notifier semantics."""
    def norm(x): return (x or "").strip().lower()
    return "|".join([
        str(it.get("competitionid") or it.get("competitionId") or ""),
        norm(it.get("sport")),
        norm(it.get("game")),
        norm(it.get("market")),
        norm(it.get("match")),
        it.get("dateISO") or it.get("date") or ""
    ])


# ------------------------------
# Pass 1: MULTIBET (your current)
# ------------------------------
def scrape_multibet_for_comp(driver: webdriver.Chrome, compid: int) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    driver.get(TARGET_URL)

    # Wait for compid input & update button
    input_el = WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.NAME, "compid")))
    driver.execute_script("arguments[0].value = arguments[1];", input_el, compid)
    driver.execute_script("arguments[0].dispatchEvent(new Event('change'));", input_el)
    update_btn = WebDriverWait(driver, 15).until(EC.element_to_be_clickable((By.ID, "update")))
    update_btn.click()

    # Give time for render
    WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.ID, "more-market-odds")))
    time.sleep(1.0)

    soup = BeautifulSoup(driver.page_source, "html.parser")

    # Get sport name
    sport_value = "Unknown Sport"
    try:
        sport_select = soup.find("select", class_="dd-select", attrs={"name": "sport"})
        sport_value = sport_select.find("option", selected=True).text.strip() if sport_select else sport_value
    except Exception:
        pass

    # Iterate the odds cells
    for td in soup.find_all("td", id="more-market-odds"):
        a_tags = td.find_all("a")
        if len(a_tags) in (1, 3):
            continue

        # Market and game extraction via parent traversal
        market_name = "Unknown Market"
        game_name = "Unknown Game"
        match_date = "Unknown Date"

        try:
            second_parent_tr = td.find_parent("tr").find_parent("tr")
            market_tr = second_parent_tr.find_previous_sibling("tr")
            market_a = market_tr.find("a") if market_tr else None
            market_name = market_a.text.strip() if market_a else market_name
        except Exception:
            pass

        try:
            third_parent_tr = td.find_parent("tr").find_parent("tr").find_parent("tr")
            game_tr = third_parent_tr.find_previous_sibling("tr") if third_parent_tr else None
            if game_tr:
                tds = game_tr.find_all("td")
                if len(tds) >= 3:
                    match_date = tds[1].text.strip()
                    game_name = tds[2].text.strip()
        except Exception:
            pass

        if not a_tags:
            continue

        link_text_1 = a_tags[0].text.strip()
        link_text_2 = a_tags[1].text.strip()

        onclick_1 = a_tags[0].get("onclick")
        full_url = None
        if onclick_1:
            m = re.search(r"addSelection\((.*)\);", onclick_1)
            if m:
                args = [arg.strip().strip("'") for arg in m.group(1).split(",")]
                marketid = args[2]
                competitionid = args[3]
                matchnumber = args[4]
                period = args[5]
                function = args[6]
                full_url = (
                    f"http://odds.aussportsbetting.com/betting?function={function}"
                    f"&competitionid={competitionid}&period={period}&marketid={marketid}"
                    f"&matchnumber={matchnumber}&websiteid=1856&oddsType=&swif=&whitelabel="
                )

        # Parse odds and compute ROI
        try:
            a = float(link_text_1.split(" - ")[1])
            b = float(link_text_2.split(" - ")[1])
            market_pct = ((1/a) + (1/b)) * 100 if a > 0 and b > 0 else 100.0
        except Exception:
            continue

        if market_pct >= 100.0:
            continue

        roi = (1.0 / (market_pct / 100.0)) - 1.0

        match_pair = f"{link_text_1} | {link_text_2}"
        row = {
            "url": full_url or f"http://odds.aussportsbetting.com/betting?competitionid={compid}",
            "market_percentage": round(market_pct, 2),
            "roi": round(roi, 6),
            "match": match_pair,
            "market": market_name,
            "game": game_name,
            "date": match_date,
            "competitionid": compid,
            "sport": sport_value,
            "source": "multibet",
        }

        # ISO date (best-effort; keep original too). If parsing fails, omit.
        date_iso = None
        for fmt in ("%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%a %d %b %Y %H:%M"):
            try:
                date_iso = dt.datetime.strptime(match_date, fmt)
                break
            except Exception:
                continue
        if date_iso:
            row["dateISO"] = date_iso.strftime("%Y-%m-%d")

        # Precompute search phrase to avoid doing it client-side
        row["search_phrase"] = extract_search_phrase(match_pair)

        rows.append(row)

    return rows


# -----------------------------------
# Pass 2: BETTING?competitionid= page
# (lean version of your new.py tables)
# -----------------------------------
def scrape_betting_for_comp(driver: webdriver.Chrome, compid: int) -> List[Dict[str, Any]]:
    """
    Walk the betting tables, locate sections with a 'Market %' header and
    collect rows where Market % < 100. Produces rows in the same shape as multibet
    as best as possible (some fields may be Unknown if not present in that view).
    """
    out: List[Dict[str, Any]] = []
    url = BETTING_BASE.format(compid)
    driver.get(url)

    try:
        WebDriverWait(driver, 12).until(EC.presence_of_all_elements_located((By.TAG_NAME, "table")))
    except Exception:
        return out

    soup = BeautifulSoup(driver.page_source, "html.parser")
    sport_value = "Unknown Sport"  # betting page often lacks a clear sport dropdown

    # This matches your new.py pattern
    for tbody in soup.find_all("tbody"):
        first_tr = tbody.find("tr")
        if not first_tr:
            continue
        headers = [td.get_text(strip=True) for td in first_tr.find_all("td")]
        if not any(h.lower() in ("market %", "market%") for h in headers):
            continue

        # rows directly under this tbody
        rows = tbody.find_all("tr", recursive=False)
        if len(rows) <= 1:
            continue

        current_date = None
        for row in rows:
            # Skip nested tables or “moremarkets” rows
            if row.has_attr("id") and "moremarkets" in row["id"]:
                continue
            if row.find("table"):
                continue

            tds = row.find_all("td", recursive=False)
            if not tds:
                continue

            # Heuristic: update current_date if 2nd cell looks like a date
            if len(tds) >= 2:
                txt = tds[1].get_text(strip=True)
                if any(d in txt for d in ("Mon ", "Tue ", "Wed ", "Thu ", "Fri ", "Sat ", "Sun ")):
                    current_date = txt

            # Need at least 5 cells to safely access Market % (second last)
            if len(tds) < 5:
                continue

            # Screen out rows where the odds cell has a plain '-' (no odds)
            odds_cell = tds[-3]
            a_tags = odds_cell.find_all('a')
            if any("-" == a.get_text(strip=True) for a in a_tags):
                continue

            # Parse Market %
            try:
                market_value = float(tds[-2].get_text(strip=True))
            except Exception:
                continue

            if not (0 < market_value < 100):
                continue

            roi = (1.0 / (market_value / 100.0)) - 1.0

            # Try to construct a reasonable match label if present
            # Betting page structure varies; we fall back gracefully
            game_name = "Unknown Game"
            market_name = "Unknown Market"
            match_label = None

            # Try nearby text for teams/market (conservative)
            # Often the third cell after date contains matchup/market text
            if len(tds) >= 3:
                possible_game = tds[2].get_text(" ", strip=True)
                if possible_game:
                    game_name = possible_game

            # Odds anchors often carry selection text; stitch first two if they look like "Team - 1.90"
            sel_texts = [a.get_text(strip=True) for a in a_tags][:2]
            if len(sel_texts) == 2 and " - " in sel_texts[0] and " - " in sel_texts[1]:
                match_label = f"{sel_texts[0]} | {sel_texts[1]}"

            row_obj = {
                "url": url,
                "market_percentage": round(market_value, 2),
                "roi": round(roi, 6),
                "match": match_label or (game_name if game_name != "Unknown Game" else ""),
                "market": market_name,
                "game": game_name,
                "date": current_date or "",
                "competitionid": compid,
                "sport": sport_value,
                "source": "betting",
            }

            # Best-effort date ISO (optional)
            date_iso = None
            for fmt in ("%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%a %d %b %Y %H:%M"):
                try:
                    if row_obj["date"]:
                        date_iso = dt.datetime.strptime(row_obj["date"], fmt)
                        break
                except Exception:
                    continue
            if date_iso:
                row_obj["dateISO"] = date_iso.strftime("%Y-%m-%d")

            if row_obj.get("match"):
                row_obj["search_phrase"] = extract_search_phrase(row_obj["match"])

            out.append(row_obj)

    return out


def scrape_competition(driver: webdriver.Chrome, compid: int) -> List[Dict[str, Any]]:
    """Combined scrape for a single competition: multibet + betting, then de-dupe."""
    combined: Dict[str, Dict[str, Any]] = {}

    # Pass 1: multibet (authoritative shape)
    for r in scrape_multibet_for_comp(driver, compid):
        combined[canonical_key(r)] = r

    # Pass 2: betting?competitionid= (fills gaps)
    for r in scrape_betting_for_comp(driver, compid):
        k = canonical_key(r)
        if k in combined:
            # Already have this arb from multibet; keep the multibet row (usually richer)
            continue
        combined[k] = r

    return list(combined.values())


def run_once(comp_ids: List[int]) -> Dict[str, Any]:
    driver = make_driver()
    all_rows: List[Dict[str, Any]] = []
    try:
        for compid in comp_ids:
            try:
                print(f"Processing competition ID: {compid}")
                rows = scrape_competition(driver, compid)
                all_rows.extend(rows)
                print(f"  + {len(rows)} rows (combined)")
            except Exception as e:
                print(f"  ! Error on compid {compid}: {e}")
    finally:
        driver.quit()

    # Sort ROI desc
    all_rows.sort(key=lambda r: r.get('roi', 0), reverse=True)

    payload = {"lastUpdated": dt.datetime.utcnow().isoformat() + 'Z', "items": all_rows}
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f"Wrote {len(all_rows)} rows to {DATA_PATH}")
    return payload


if __name__ == "__main__":
    comp_ids = parse_comp_ids(os.getenv('COMP_IDS'))
    run_once(comp_ids)
