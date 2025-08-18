import os
import re
import json
import time
import datetime as dt
from typing import List, Dict, Any

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
                # parse odds from "... - 1.00"
                mid_odds = float(mid_text.split('-')[-1].strip())
            except Exception:
                mid_odds = None

            if mid_odds is not None and abs(mid_odds - 1.0) < 1e-6:
                # treat as two-way using a_tags[0] and a_tags[2]
                use_outer_two = True
            else:
                # real 3-way market: skip
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
            "url": full_url or f"http://odds.aussportsbetting.com/betting?competitionid={compid}",
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
