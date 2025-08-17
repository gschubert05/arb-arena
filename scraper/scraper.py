import os
import re
import json
import time
import datetime as dt
from typing import List, Dict, Any, Optional

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

# ----------------------
# Config
# ----------------------
DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'server', 'data', 'opportunities.json')
TARGET_URL = "http://odds.aussportsbetting.com/multibet"
SKIP_IDS = {72, 73, 108, 114}  # known-problem comps you had before

# ----------------------
# Helpers
# ----------------------
def parse_comp_ids(env_val: Optional[str]) -> List[int]:
    """
    Parse COMP_IDS like "1-150" or "11,12,13" or mixed "10-20,40" into a list of ints.
    Default is 1-150.
    """
    if not env_val:
        comp_ids = list(range(1, 151))
    else:
        out: set[int] = set()
        for part in env_val.split(','):
            p = part.strip()
            if not p:
                continue
            if '-' in p:
                a, b = p.split('-', 1)
                try:
                    a, b = int(a), int(b)
                    lo, hi = (a, b) if a <= b else (b, a)
                    out.update(range(lo, hi + 1))
                except ValueError:
                    continue
            else:
                try:
                    out.add(int(p))
                except ValueError:
                    continue
        comp_ids = sorted(out)

    # Drop known-skips
    comp_ids = [i for i in comp_ids if i not in SKIP_IDS]
    return comp_ids


def make_driver() -> webdriver.Chrome:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1600,1200")
    # Faster: don't wait for all subresources
    options.page_load_strategy = "eager"

    # If Actions provided CHROME_BIN, use it
    chrome_bin = os.environ.get("CHROME_BIN")
    if chrome_bin:
        options.binary_location = chrome_bin

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(30)
    return driver


def extract_search_phrase(match_text: str) -> str:
    """
    From "Home - 1.90 | Under 200.5 - 1.95" returns the right side label before odds.
    Also removes '+' in Under phrases.
    """
    try:
        right = match_text.split('|', 1)[1].strip()
        phrase = right.split(' - ', 1)[0].strip()
        if 'Under' in phrase:
            phrase = phrase.replace('+', '')
        return phrase
    except Exception:
        return match_text


_MONTHS = {m.lower(): i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], start=1
)}
def coerce_date_iso(date_str: str) -> Optional[str]:
    """
    Best-effort: handle formats like "Sun 17 Aug 16:40".
    Returns "YYYY-MM-DD" or None if it can't parse.
    Uses current year (works well for near-term fixtures).
    """
    if not date_str:
        return None
    s = date_str.strip()

    # e.g. Sun 17 Aug 16:40
    m = re.match(r"^\w{3}\s+(\d{1,2})\s+([A-Za-z]{3})\s+\d{1,2}:\d{2}", s)
    if m:
        day = int(m.group(1))
        mon_abbr = m.group(2).lower()
        mon = _MONTHS.get(mon_abbr)
        if mon:
            now = dt.datetime.utcnow()
            year = now.year
            try:
                d = dt.date(year, mon, day)
                return d.strftime("%Y-%m-%d")
            except ValueError:
                return None

    # Try a couple common day-first formats with/without year
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y", "%d-%m-%Y", "%d/%m %H:%M"):
        try:
            dtm = dt.datetime.strptime(s, fmt)
            year = dtm.year if "%Y" in fmt else dt.datetime.utcnow().year
            d = dt.date(year, dtm.month, dtm.day)
            return d.strftime("%Y-%m-%d")
        except Exception:
            pass

    return None


def _odds_url_fallback(compid: int) -> str:
    return f"http://odds.aussportsbetting.com/betting?competitionid={compid}"


def _safe_text(el) -> str:
    return el.get_text(strip=True) if el else ""


def _wait_for_rows_or_timeout(driver: webdriver.Chrome, timeout: float = 4) -> bool:
    """
    Poll for presence of at least one 'td#more-market-odds' quickly.
    Return True if found, False if not within timeout.
    """
    end = time.time() + timeout
    while time.time() < end:
        html = driver.page_source
        if "more-market-odds" in html:
            return True
        time.sleep(0.15)
    return False

# ----------------------
# Scrape a single comp
# ----------------------
def scrape_competition(driver: webdriver.Chrome, compid: int) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []

    # Load multibet
    driver.get(TARGET_URL)

    # Set compid, click update
    input_el = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "compid")))
    driver.execute_script("arguments[0].value = arguments[1];", input_el, compid)
    driver.execute_script("arguments[0].dispatchEvent(new Event('change'));", input_el)
    update_btn = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.ID, "update")))
    update_btn.click()

    # Fast path: if no rows appear quickly, skip this comp
    try:
        has_rows = _wait_for_rows_or_timeout(driver, timeout=)
    except Exception:
        has_rows = False
    if not has_rows:
        # Nothing to parse here
        return rows

    # short settle
    time.sleep(0.3)

    soup = BeautifulSoup(driver.page_source, "html.parser")

    # Sport (optional)
    sport_value = "Unknown Sport"
    try:
        sport_select = soup.find("select", class_="dd-select", attrs={"name": "sport"})
        if sport_select:
            opt = sport_select.find("option", selected=True)
            sport_value = opt.text.strip() if opt else sport_value
    except Exception:
        pass

    # Iterate the odds cells
    td_cells = soup.find_all("td", id="more-market-odds")
    if not td_cells:
        return rows

    for td in td_cells:
        a_tags = td.find_all("a")
        # Need at least 2 selections; skip broken rows
        if len(a_tags) < 2:
            continue

        # Market & Game & Date via parent traversal (all guarded)
        market_name = "Unknown Market"
        game_name = "Unknown Game"
        match_date = "Unknown Date"

        try:
            # market: go 2 parents up, then previous sibling row
            second_parent_tr = td.find_parent("tr").find_parent("tr")
            market_tr = second_parent_tr.find_previous_sibling("tr") if second_parent_tr else None
            market_a = market_tr.find("a") if market_tr else None
            market_name = _safe_text(market_a) or market_name
        except Exception:
            pass

        try:
            # game/date: go 3 parents up, then previous sibling row (td[1]=date, td[2]=game)
            third_parent_tr = td.find_parent("tr").find_parent("tr").find_parent("tr")
            game_tr = third_parent_tr.find_previous_sibling("tr") if third_parent_tr else None
            if game_tr:
                tds = game_tr.find_all("td")
                if len(tds) >= 3:
                    match_date = _safe_text(tds[1]) or match_date
                    game_name = _safe_text(tds[2]) or game_name
        except Exception:
            pass

        # Extract odds links
        link_text_1 = a_tags[0].get_text(strip=True)
        link_text_2 = a_tags[1].get_text(strip=True)

        # Compute target URL (onclick or fallback)
        full_url = _odds_url_fallback(compid)
        onclick_1 = a_tags[0].get("onclick")
        if onclick_1:
            m = re.search(r"addSelection\((.*)\);", onclick_1)
            if m:
                # Split simple comma args; site uses simple quoted args
                args = [arg.strip().strip("'") for arg in m.group(1).split(",")]
                if len(args) >= 7:
                    marketid = args[2]
                    competitionid = args[3]
                    matchnumber = args[4]
                    period = args[5]
                    function = args[6]
                    full_url = (
                        "http://odds.aussportsbetting.com/betting"
                        f"?function={function}&competitionid={competitionid}"
                        f"&period={period}&marketid={marketid}&matchnumber={matchnumber}"
                        "&websiteid=1856&oddsType=&swif=&whitelabel="
                    )

        # Parse odds safely & compute ROI
        try:
            a = float(link_text_1.split(" - ", 1)[1])
            b = float(link_text_2.split(" - ", 1)[1])
            if a <= 0 or b <= 0:
                continue
            market_pct = ((1.0 / a) + (1.0 / b)) * 100.0
        except Exception:
            continue

        if market_pct >= 100.0:
            # not an arb
            continue

        roi = (1.0 / (market_pct / 100.0)) - 1.0

        match_pair = f"{link_text_1} | {link_text_2}"
        row: Dict[str, Any] = {
            "url": full_url,
            "market_percentage": round(market_pct, 2),
            "roi": round(roi, 6),
            "match": match_pair,
            "market": market_name,
            "game": game_name,
            "date": match_date,
            "competitionid": compid,
            "sport": sport_value,
        }

        # Best-effort ISO date (keeps original too)
        iso = coerce_date_iso(match_date)
        if iso:
            row["dateISO"] = iso

        # Precompute search phrase for your UI copy button
        row["search_phrase"] = extract_search_phrase(match_pair)

        rows.append(row)

    return rows

# ----------------------
# Run (all comps)
# ----------------------
def run_once(comp_ids: List[int]) -> Dict[str, Any]:
    driver = make_driver()
    all_rows: List[Dict[str, Any]] = []

    # Ensure output dir exists
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)

    try:
        for compid in comp_ids:
            try:
                print(f"Processing competition ID: {compid}")
                rows = scrape_competition(driver, compid)
                all_rows.extend(rows)
                print(f"  • Added {len(rows)} rows (running total: {len(all_rows)})")

                # Optional incremental save (uncomment if you want progress written every comp)
                # with open(DATA_PATH, 'w', encoding='utf-8') as f:
                #     json.dump({"lastUpdated": dt.datetime.utcnow().isoformat() + 'Z', "items": all_rows}, f, ensure_ascii=False)

            except TimeoutException as te:
                print(f"  ! Timeout on compid {compid}: {te}. Skipping.")
                continue
            except Exception as e:
                print(f"  ! Error on compid {compid}: {e}. Skipping.")
                continue
            # tiny pause to be polite
            time.sleep(0.15)
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    # Sort ROI desc for your site
    all_rows.sort(key=lambda r: r.get('roi', 0.0), reverse=True)

    payload = {"lastUpdated": dt.datetime.utcnow().isoformat() + 'Z', "items": all_rows}
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f"Wrote {len(all_rows)} rows to {DATA_PATH}")
    return payload


if __name__ == "__main__":
    comp_ids = parse_comp_ids(os.getenv('COMP_IDS'))
    run_once(comp_ids)
