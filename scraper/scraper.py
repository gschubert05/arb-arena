import os
import re
import json
import time
import datetime as dt
from typing import List, Dict, Any, Optional, Tuple

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'server', 'data', 'opportunities.json')
TARGET_URL = "http://odds.aussportsbetting.com/multibet"
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
    # UA helps avoid slimmed templates
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


def _parse_time_tail(text: str) -> Optional[str]:
    # Find a time like 18:03 anywhere in the cell; prefer the last occurrence
    m = re.findall(r"\b(\d{1,2}:\d{2})\b", text or "")
    return m[-1] if m else None


def _parse_float(text: str) -> Optional[float]:
    try:
        return float(text.strip())
    except Exception:
        # fallback: last decimal number in text
        nums = re.findall(r"(\d+(?:\.\d+)?)", text or "")
        return float(nums[-1]) if nums else None


def _norm(s: str) -> str:
    return (s or "").strip()


def _contains_ci(hay: str, needle: str) -> bool:
    return (needle or "").lower() in (hay or "").lower()


def scrape_competition(driver: webdriver.Chrome, compid: int) -> List[Dict[str, Any]]:
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

        # require at least two selections
        if len(a_tags) < 2:
            continue

        # Special handling for 3 anchors:
        # Keep only if the middle one is a dummy "Draw - 1.00" (odds == 1.00).
        use_outer_two = False
        if len(a_tags) == 3:
            try:
                mid_text = a_tags[1].get_text(strip=True)
                mid_odds = float(mid_text.split('-')[-1].strip())
            except Exception:
                mid_odds = None
            if mid_odds is not None and abs(mid_odds - 1.0) < 1e-6:
                use_outer_two = True
            else:
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

        # Skip markets that start with "Win"
        if market_name.startswith("Win"):
            continue

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

        # Choose which two anchors to use for odds parsing
        if use_outer_two:
            left_anchor = a_tags[0]
            right_anchor = a_tags[2]
        else:
            left_anchor = a_tags[0]
            right_anchor = a_tags[1]

        link_text_1 = left_anchor.text.strip()
        link_text_2 = right_anchor.text.strip()

        onclick_1 = left_anchor.get("onclick")
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
            "url": full_url or BETTING_FALLBACK_URL.format(compid=compid),
            "market_percentage": round(market_pct, 2),
            "roi": round(roi, 6),
            "match": match_pair,
            "market": market_name,
            "game": game_name,
            "date": match_date,
            "competitionid": compid,
            "sport": sport_value,
        }

        # ISO date (best-effort; keep original too). If parsing fails, omit.
        try:
            # Attempt common formats (DD/MM/YYYY HH:MM or similar); adjust as needed
            date_iso = dt.datetime.fromisoformat(match_date)
        except Exception:
            # fallback: try day-first formats
            try:
                date_iso = dt.datetime.strptime(match_date, "%d/%m/%Y %H:%M")
            except Exception:
                date_iso = None
        if date_iso:
            row["dateISO"] = date_iso.strftime("%Y-%m-%d")

        # Precompute search phrase to avoid doing it client-side
        row["search_phrase"] = extract_search_phrase(match_pair)

        rows.append(row)

    return rows


def _scrape_betting_table_for_search(driver: webdriver.Chrome, url: str, search_phrase: str) -> Optional[Dict[str, Any]]:
    """
    Open the /betting?... page at `url`, find the <td.subheading> containing `search_phrase`,
    then read the table of agencies beneath it following the structure you described.
    Returns:
      {
        "headers": ["Agency", left_head, right_head, "Updated"],
        "rows": [{"agency": "...", "left": "1.91", "right": "1.95", "updated": "18:03"}, ...],
        "best": {"left": {"agency":"...", "odds": 1.95}, "right": {...}}
      }
    or None if not found.
    """
    try:
        driver.get(url)
        # ensure tables are present
        try:
            WebDriverWait(driver, 12).until(EC.presence_of_all_elements_located((By.TAG_NAME, "table")))
        except Exception:
            pass  # continue anyway; some pages render immediately

        soup = BeautifulSoup(driver.page_source, "html.parser")

        # Find the subheading cell that contains the search phrase
        subcells = soup.find_all("td", class_="subheading")
        anchor_cell = None
        for td_sub in subcells:
            if _contains_ci(td_sub.get_text(" ", strip=True), search_phrase):
                anchor_cell = td_sub
                break
        if not anchor_cell:
            return None

        anchor_tr = anchor_cell.find_parent("tr")
        if not anchor_tr:
            return None

        # The anchor row has 5 tds; 3rd and 4th are headings for the market
        anchor_tds = anchor_tr.find_all("td", recursive=False)
        if len(anchor_tds) < 4:
            return None

        left_head = _norm(anchor_tds[2].get_text(" ", strip=True))
        right_head = _norm(anchor_tds[3].get_text(" ", strip=True))
        headers = ["Agency", left_head, right_head, "Updated"]

        # Now iterate subsequent rows:
        # after anchor_tr there's an empty tr, then an agency row of 4 tds; repeat.
        rows = []
        # Walk siblings until we hit the next subheading row
        tr = anchor_tr.find_next_sibling("tr")
        while tr:
            tds = tr.find_all("td", recursive=False)

            # Stop when we reach the next subheading (new market line)
            if tds and any("subheading" in (td.get("class") or []) for td in tds):
                break

            # Skip empty spacer rows (no real cells or just whitespace)
            if not tds or all(_norm(td.get_text()) == "" for td in tds):
                tr = tr.find_next_sibling("tr")
                continue

            # Expect agency row with 4 tds
            if len(tds) >= 4:
                # First td: <a> with agency name
                agency = ""
                a = tds[0].find("a")
                if a:
                    agency = _norm(a.get_text(strip=True))
                else:
                    agency = _norm(tds[0].get_text(" ", strip=True))

                left_txt = _norm(tds[1].get_text(" ", strip=True))
                right_txt = _norm(tds[2].get_text(" ", strip=True))
                updated_txt = _norm(tds[3].get_text(" ", strip=True))
                updated = _parse_time_tail(updated_txt) or updated_txt

                rows.append({
                    "agency": agency,
                    "left": left_txt,
                    "right": right_txt,
                    "updated": updated,
                })

            # move to next row (there may be a blank spacer; loop handles it)
            tr = tr.find_next_sibling("tr")

        if not rows:
            return None

        # Find best odds per side (numeric)
        best_left: Tuple[Optional[str], float] = (None, -1.0)
        best_right: Tuple[Optional[str], float] = (None, -1.0)

        for r in rows:
            lf = _parse_float(r.get("left") or "")
            rf = _parse_float(r.get("right") or "")
            if lf is not None and lf > best_left[1]:
                best_left = (r["agency"], lf)
            if rf is not None and rf > best_right[1]:
                best_right = (r["agency"], rf)

        best = {
            "left": {"agency": best_left[0], "odds": best_left[1] if best_left[1] > 0 else None},
            "right": {"agency": best_right[0], "odds": best_right[1] if best_right[1] > 0 else None},
        }

        return {"headers": headers, "rows": rows, "best": best}

    except Exception:
        return None


def run_once(comp_ids: List[int]) -> Dict[str, Any]:
    driver = make_driver()
    all_rows: List[Dict[str, Any]] = []
    try:
        for compid in comp_ids:
            try:
                print(f"Processing competition ID: {compid}")
                rows = scrape_competition(driver, compid)
                all_rows.extend(rows)
                print(f"  + {len(rows)} rows")
            except Exception as e:
                print(f"  ! Error on compid {compid}: {e}")

        # --------- NEW: enrich each arb with the bookies table ----------
        # Cache repeated URL+search_phrase so we don’t fetch the same page twice
        table_cache: Dict[Tuple[str, str], Optional[Dict[str, Any]]] = {}
        for it in all_rows:
            url = it.get("url")
            if not url:
                continue  # skip, no betting link to scrape
            phrase = it.get("search_phrase") or ""
            key = (url, phrase)
            if key not in table_cache:
                table_cache[key] = _scrape_betting_table_for_search(driver, url, phrase)
            table = table_cache[key]
            if table:
                it["book_table"] = table
        # ----------------------------------------------------------------

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
