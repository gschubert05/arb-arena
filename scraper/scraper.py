import os
import re
import time
import json
import datetime as dt
from typing import List, Dict, Any, Optional, Tuple

from bs4 import BeautifulSoup, NavigableString
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# === Paths & constants ===
DATA_PATH   = os.path.join(os.path.dirname(__file__), '..', 'server', 'data', 'opportunities.json')
TARGET_URL  = "http://odds.aussportsbetting.com/multibet"
SKIP_IDS    = {72, 73, 108, 114}  # keep your historical skip list

# Filter: skip noisy Baseball O/U +0.5 pairs (e.g., "Over +0.5" vs "Under +0.5")
_RE_OVER_05  = re.compile(r'\bover\s*\(?\+?0\.5\)?\b', re.I)
_RE_UNDER_05 = re.compile(r'\bunder\s*\(?\+?0\.5\)?\b', re.I)


# === Small helpers ===
def _is_bad_baseball_half_total(txt: str) -> bool:
    s = re.sub(r'\s+', ' ', txt or '').lower().replace('−', '-')
    return bool(_RE_OVER_05.search(s) and _RE_UNDER_05.search(s))


def parse_comp_ids(env_val: Optional[str]) -> List[int]:
    """
    Parse COMP_IDS like "1-150" or "11,12,13" into a list of ints.
    Defaults to [10,11] (AFL comps) when not provided.
    """
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
    """
    Keep exactly the same Chrome/Selenium setup as your working test.
    (Headless, minimal flags, and CHROMEDRIVER_PATH from the workflow.)
    """
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1600,1200")
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                         "AppleWebKit/537.36 (KHTML, like Gecko) "
                         "Chrome/124.0.0.0 Safari/537.36")
    chromedriver_path = os.environ.get("CHROMEDRIVER_PATH")
    service = Service(chromedriver_path) if chromedriver_path else Service()
    return webdriver.Chrome(service=service, options=options)


def _find_in_any_frame(driver, by, value, timeout=15):
    """
    Same frame search behavior as your test script:
    try top document, then all iframes, until found or timeout.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            driver.switch_to.default_content()
            return WebDriverWait(driver, 2).until(EC.presence_of_element_located((by, value)))
        except Exception:
            pass
        frames = driver.find_elements(By.TAG_NAME, "iframe")
        for fr in frames:
            try:
                driver.switch_to.default_content()
                driver.switch_to.frame(fr)
                return WebDriverWait(driver, 2).until(EC.presence_of_element_located((by, value)))
            except Exception:
                pass
        time.sleep(0.3)
    driver.switch_to.default_content()
    raise TimeoutError(f"Could not locate {value} in any frame")


def extract_search_phrase(match_text: str) -> str:
    """
    From "Home - 1.90 | Under 200.5 - 1.95" return the right side label before odds.
    Used to anchor into the betting page sub-table.
    """
    try:
        right = match_text.split('|')[1].strip()
        phrase = right.split(' - ')[0].strip()
        if 'Under' in phrase:
            phrase = phrase.replace('+', '')
        return phrase
    except Exception:
        return match_text


# === First stage: scrape MultiBet page for pairs ===
def scrape_competition(driver: webdriver.Chrome, compid: int) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    driver.get(TARGET_URL)

    # EXACTLY like the test script: look for name="compid" and id="update"
    input_el = _find_in_any_frame(driver, By.NAME, "compid", timeout=20)
    driver.execute_script("arguments[0].value = arguments[1];", input_el, compid)
    driver.execute_script("arguments[0].dispatchEvent(new Event('change', {bubbles:true}));", input_el)

    driver.switch_to.default_content()
    update_btn = _find_in_any_frame(driver, By.ID, "update", timeout=20)
    update_btn.click()

    WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, "more-market-odds")))
    time.sleep(1.0)  # small settle to ensure table is populated

    soup = BeautifulSoup(driver.page_source, "html.parser")

    # sport name
    sport_value = "Unknown Sport"
    try:
        sport_select = soup.find("select", class_="dd-select", attrs={"name": "sport"})
        sport_value = sport_select.find("option", selected=True).text.strip() if sport_select else sport_value
    except Exception:
        pass

    # iterate all odds cells
    for td in soup.find_all("td", id="more-market-odds"):
        a_tags = td.find_all("a")
        if len(a_tags) < 2:
            continue

        # 3-anchor case: middle draw @ 1.00 -> use outer two
        use_outer_two = False
        if len(a_tags) == 3:
            try:
                mid_odds = float(a_tags[1].text.split('-')[-1].strip())
            except Exception:
                mid_odds = None
            if mid_odds is not None and abs(mid_odds - 1.0) < 1e-6:
                use_outer_two = True
            else:
                continue

        # market/game/date via parent traversal
        market_name = "Unknown Market"
        game_name   = "Unknown Game"
        match_date  = "Unknown Date"

        try:
            second_parent_tr = td.find_parent("tr").find_parent("tr")
            market_tr = second_parent_tr.find_previous_sibling("tr")
            market_a = market_tr.find("a") if market_tr else None
            market_name = market_a.text.strip() if market_a else market_name
        except Exception:
            pass

        # skip Win* markets (keeps parity with your original heuristic)
        if market_name.startswith("Win"):
            continue

        try:
            third_parent_tr = td.find_parent("tr").find_parent("tr").find_parent("tr")
            game_tr = third_parent_tr.find_previous_sibling("tr") if third_parent_tr else None
            if game_tr:
                tds = game_tr.find_all("td")
                if len(tds) >= 3:
                    match_date = tds[1].text.strip()
                    game_name  = tds[2].text.strip()
        except Exception:
            pass

        if use_outer_two:
            left_anchor, right_anchor = a_tags[0], a_tags[2]
        else:
            left_anchor, right_anchor = a_tags[0], a_tags[1]

        link_text_1 = left_anchor.text.strip()
        link_text_2 = right_anchor.text.strip()

        # baseball +0.5 noise filter
        if 'baseball' in (sport_value or '').lower() and _is_bad_baseball_half_total(f"{link_text_1} | {link_text_2}"):
            continue

        # build betting URL when onclick has addSelection(...)
        onclick_1 = left_anchor.get("onclick")
        full_url = None
        if onclick_1:
            m = re.search(r"addSelection\((.*)\);", onclick_1)
            if m:
                args = [arg.strip().strip("'") for arg in m.group(1).split(",")]
                if len(args) >= 7:
                    marketid      = args[2]
                    competitionid = args[3]
                    matchnumber   = args[4]
                    period        = args[5]
                    function      = args[6]
                    full_url = (
                        f"http://odds.aussportsbetting.com/betting?function={function}"
                        f"&competitionid={competitionid}&period={period}&marketid={marketid}"
                        f"&matchnumber={matchnumber}&websiteid=1856&oddsType=&swif=&whitelabel="
                    )

        # parse odds -> market% & ROI
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
            "url": full_url,  # may be None; we handle that later
            "market_percentage": round(market_pct, 2),
            "roi": round(roi, 6),
            "match": match_pair,
            "market": market_name,
            "game": game_name,
            "date": match_date,
            "competitionid": compid,
            "sport": sport_value,
            "search_phrase": extract_search_phrase(match_pair),
        }

        # optional ISO date
        try:
            date_iso = dt.datetime.fromisoformat(match_date)
        except Exception:
            try:
                date_iso = dt.datetime.strptime(match_date, "%d/%m/%Y %H:%M")
            except Exception:
                date_iso = None
        if date_iso:
            row["dateISO"] = date_iso.strftime("%Y-%m-%d")

        rows.append(row)

    return rows


# === Second stage: open betting page and compute best-agency odds ===
def _scrape_betting_table_for_search(driver: webdriver.Chrome, url: str, search_phrase: str) -> Optional[Dict[str, Any]]:
    """
    Open `url`, find the <td class="subheading"> containing `search_phrase`,
    then parse the agency odds table beneath it.
    Handles NORMAL, MAIN MARKET, and LINE-DRAW layouts.
    """
    if not url:
        return None
    try:
        driver.get(url)
        try:
            WebDriverWait(driver, 12).until(EC.presence_of_all_elements_located((By.TAG_NAME, "table")))
        except Exception:
            pass
        soup = BeautifulSoup(driver.page_source, "html.parser")

        # find subheading anchor
        anchor_cell = None
        for td_sub in soup.find_all("td", class_="subheading"):
            if (search_phrase or "").lower() in td_sub.get_text(" ", strip=True).lower():
                anchor_cell = td_sub
                break
        if not anchor_cell:
            return None

        anchor_tr = anchor_cell.find_parent("tr")
        header_tds = anchor_tr.find_all("td", recursive=False)
        header_len = len(header_tds)

        def is_blank_row(tr):
            tds = tr.find_all("td", recursive=False)
            return (not tds) or all((td.get_text(strip=True) == "") for td in tds)

        def is_new_subheading(tr):
            tds = tr.find_all("td", recursive=False)
            return bool(tds and any("subheading" in (td.get("class") or []) for td in tds))

        # first data row (skip blank lines)
        first_data_tr = anchor_tr.find_next_sibling("tr")
        while first_data_tr and is_blank_row(first_data_tr):
            first_data_tr = first_data_tr.find_next_sibling("tr")
        if not first_data_tr or is_new_subheading(first_data_tr):
            return None

        first_row_tds = first_data_tr.find_all("td", recursive=False)
        row_len = len(first_row_tds)

        # map columns depending on layout
        if header_len > 5:          # "main market" wide header
            header_left_idx, header_right_idx = 2, 4
            row_agency_idx, row_left_idx, row_right_idx, row_updated_idx = 0, 1, 3, None
        elif row_len == 5:          # line-draw variant
            header_left_idx, header_right_idx = 1, 3
            row_agency_idx, row_left_idx, row_right_idx, row_updated_idx = 0, 1, 3, 4
        else:                       # normal
            header_left_idx, header_right_idx = 2, 3
            row_agency_idx, row_left_idx, row_right_idx, row_updated_idx = 0, 1, 2, 3

        def td_text_safe(tds, idx):
            if idx is None or idx < 0 or idx >= len(tds):
                return ""
            return (tds[idx].get_text(" ", strip=True) or "").strip()

        left_head = td_text_safe(header_tds, header_left_idx)
        right_head = td_text_safe(header_tds, header_right_idx)
        headers = ["Agency", left_head, right_head, "Updated"]

        rows_out = []

        def extract_row(tr, default_map):
            tds = tr.find_all("td", recursive=False)
            n = len(tds)
            a_idx, l_idx, r_idx, u_idx = default_map
            if n == 4:
                a_idx, l_idx, r_idx, u_idx = 0, 1, 2, 3
            elif n == 5:
                a_idx, l_idx, r_idx, u_idx = 0, 1, 3, 4

            def safe(idx):
                return (tds[idx].get_text(" ", strip=True) if 0 <= idx < n else "").strip()

            a = tds[a_idx].find("a") if 0 <= a_idx < n else None
            agency   = (a.get_text(strip=True) if a else safe(a_idx)).strip()
            left_txt = safe(l_idx)
            right_txt= safe(r_idx)

            updated = ""
            if u_idx is not None and 0 <= u_idx < n:
                td_u = tds[u_idx]
                direct_texts = [
                    s.strip()
                    for s in td_u.find_all(string=True, recursive=False)
                    if isinstance(s, NavigableString) and s.strip()
                ]
                candidate = direct_texts[-1] if direct_texts else ""
                m = re.search(r"(?<!\d)(\d{1,2}:\d{2})(?!\d)", candidate)
                updated = m.group(1) if m else candidate

            return {"agency": agency, "left": left_txt, "right": right_txt, "updated": updated if u_idx is not None else ""}

        tr = first_data_tr
        default_map = (row_agency_idx, row_left_idx, row_right_idx, row_updated_idx)
        while tr:
            if is_new_subheading(tr):
                break
            if not is_blank_row(tr):
                rows_out.append(extract_row(tr, default_map))
            tr = tr.find_next_sibling("tr")

        if not rows_out:
            return None

        def to_float(x):
            try:
                return float(x)
            except Exception:
                m = re.findall(r"(\d+(?:\.\d+)?)", x or "")
                return float(m[-1]) if m else None

        best_left  = (None, -1.0)
        best_right = (None, -1.0)
        for r in rows_out:
            lf, rf = to_float(r["left"]), to_float(r["right"])
            if lf is not None and lf > best_left[1]:
                best_left = (r["agency"], lf)
            if rf is not None and rf > best_right[1]:
                best_right = (r["agency"], rf)

        best = {
            "left":  {"agency": best_left[0],  "odds": best_left[1]  if best_left[1]  > 0 else None},
            "right": {"agency": best_right[0], "odds": best_right[1] if best_right[1] > 0 else None},
        }

        return {"headers": headers, "rows": rows_out, "best": best}
    except Exception:
        return None


# === Orchestrator ===
def run_once(comp_ids: List[int]) -> Dict[str, Any]:
    driver = make_driver()
    all_rows: List[Dict[str, Any]] = []
    try:
        # 1) scrape multibet page for each compid
        for compid in comp_ids:
            print(f"Scraping compid: {compid} …")
            try:
                rows = scrape_competition(driver, compid) or []
                all_rows.extend(rows)
                print(f"  + {len(rows)} rows")
            except Exception as e:
                print(f"  ! Error on compid {compid}: {type(e).__name__}: {e}")
                continue

        # 2) verify on betting page (if we have a URL), recompute market% & ROI from best agencies
        table_cache: Dict[Tuple[str, str], Optional[Dict[str, Any]]] = {}
        verified: List[Dict[str, Any]] = []
        for it in all_rows:
            url    = it.get("url")
            phrase = it.get("search_phrase") or ""
            table  = None
            if url:
                key = (url, phrase)
                if key not in table_cache:
                    table_cache[key] = _scrape_betting_table_for_search(driver, url, phrase)
                table = table_cache[key]

            # --- inside run_once(), in the "verified" build loop after we've set `table` ---
            if table:
                it["book_table"] = table

                # ➊ Exclude if ANY agency in the table is exactly "Bookmaker"
                has_bookmaker = any(
                    (r.get("agency") or "").strip().lower() == "bookmaker"
                    for r in (table.get("rows") or [])
                )
                if has_bookmaker:
                    continue  # drop this row entirely

                best = table.get("best") or {}
                L = (best.get("left")  or {}).get("odds")
                R = (best.get("right") or {}).get("odds")

                # ➋ If we have current best prices, recompute market% and ROI and keep only if still an arb
                if isinstance(L, (int, float)) and isinstance(R, (int, float)) and L > 0 and R > 0:
                    new_market_pct = ((1.0 / L) + (1.0 / R)) * 100.0
                    if new_market_pct >= 100.0:
                        continue  # no longer an arbitrage after the best-odds refresh
                    it["market_percentage"] = round(new_market_pct, 2)
                    it["roi"] = round((1.0 / (new_market_pct / 100.0)) - 1.0, 6)


            verified.append(it)

        all_rows = verified

    finally:
        try:
            driver.quit()
        except Exception:
            pass

    all_rows.sort(key=lambda r: r.get('roi', 0.0), reverse=True)

    payload = {"lastUpdated": dt.datetime.utcnow().isoformat() + 'Z', "items": all_rows}
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f"Wrote {len(all_rows)} rows to {DATA_PATH}")
    return payload


if __name__ == "__main__":
    comp_ids = parse_comp_ids(os.getenv('COMP_IDS'))
    run_once(comp_ids)
