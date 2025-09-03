import os
import re
import json
import time
import datetime as dt
from typing import List, Dict, Any, Optional, Tuple

from bs4 import BeautifulSoup, NavigableString
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'server', 'data', 'opportunities.json')
TARGET_URL = "http://odds.aussportsbetting.com/multibet"
SKIP_IDS = {72, 73, 108, 114}

# --- Skip noisy Baseball O/U +0.5 totals (e.g., "Over +0.5" vs "Under +0.5")
_RE_OVER_05  = re.compile(r'\bover\s*\(?\+?0\.5\)?\b', re.I)
_RE_UNDER_05 = re.compile(r'\bunder\s*\(?\+?0\.5\)?\b', re.I)

def _is_bad_baseball_half_total(txt: str) -> bool:
    s = re.sub(r'\s+', ' ', txt or '').lower().replace('−', '-')  # normalize spaces / unicode minus
    return bool(_RE_OVER_05.search(s) and _RE_UNDER_05.search(s))

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

def _updated_from_td(td) -> str:
    """
    Prefer the JS timestamp inside <script>write_local_time(…)</script>.
    Fallback to last direct text node (not inside child tags).
    Returns HH:MM (24h) or "".
    """
    if td is None:
        return ""

    # 1) Try <script>write_local_time(1755509596000);</script>
    for sc in td.find_all("script"):
        s = sc.string or ""
        m = re.search(r"write_local_time\(\s*(\d{10,})\s*\)", s)
        if m:
            try:
                ms = int(m.group(1))
                t = dt.datetime.fromtimestamp(ms / 1000.0)  # local time of runner
                return t.strftime("%H:%M")
            except Exception:
                pass

    # 2) Fallback: last direct text node (ignore children like <span>/<script>)
    direct_texts = [
        (txt or "").strip()
        for txt in td.find_all(string=True, recursive=False)
        if isinstance(txt, NavigableString) and (txt or "").strip()
    ]
    candidate = direct_texts[-1] if direct_texts else (td.get_text(" ", strip=True) or "")
    m2 = re.search(r"(?<!\d)(\d{1,2}:\d{2})(?!\d)", candidate)
    return m2.group(1) if m2 else candidate

def make_driver() -> webdriver.Chrome:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1600,1200")
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                         "AppleWebKit/537.36 (KHTML, like Gecko) "
                         "Chrome/124.0.0.0 Safari/537.36")

    # ✅ Use the Chrome that setup-chrome installed (matches its Chromedriver)
    chrome_bin = os.environ.get("CHROME_BIN")
    if chrome_bin:
        options.binary_location = chrome_bin

    # (optional) If the action exposes chromedriver path, use it explicitly
    chromedriver_path = os.environ.get("CHROMEDRIVER_PATH") or os.environ.get("CHROMEWEBDRIVER")
    if chromedriver_path:
        service = Service(chromedriver_path)
        return webdriver.Chrome(service=service, options=options)

    # Fallback: rely on PATH / Selenium Manager
    return webdriver.Chrome(options=options)


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

        # Skip Baseball Over/Under +0.5 pairs (problematic line)
        if 'baseball' in (sport_value or '').lower():
            if _is_bad_baseball_half_total(f"{link_text_1} | {link_text_2}"):
                continue


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
    Opens `url`, finds the <td class="subheading"> that contains `search_phrase`,
    then scrapes the agencies table beneath it. Layout rules:

      MAIN MARKET: header_len > 5
        headers: left = 3rd td, right = 5th td
        rows:    agency=1st, left=2nd, right=4th, updated=missing ("")

      LINE-DRAW (extra middle column):
        detected by first data row having 5 tds
        headers: left = 2nd td, right = 4th td
        rows:    agency=0, left=1, right=3, updated=4

      NORMAL:
        detected by first data row having 4 tds (even if header has 5)
        headers: left = 3rd td, right = 4th td
        rows:    agency=0, left=1, right=2, updated=3
    """
    try:
        driver.get(url)
        try:
            WebDriverWait(driver, 12).until(EC.presence_of_all_elements_located((By.TAG_NAME, "table")))
        except Exception:
            pass

        soup = BeautifulSoup(driver.page_source, "html.parser")

        # 1) locate our anchor subheading row
        anchor_cell = None
        for td_sub in soup.find_all("td", class_="subheading"):
            if (search_phrase or "").lower() in td_sub.get_text(" ", strip=True).lower():
                anchor_cell = td_sub
                break
        if not anchor_cell:
            return None

        anchor_tr = anchor_cell.find_parent("tr")
        if not anchor_tr:
            return None

        header_tds = anchor_tr.find_all("td", recursive=False)
        header_len = len(header_tds)

        # 2) find the first *data* row after (skip blank spacer rows)
        def is_blank_row(tr):
            tds = tr.find_all("td", recursive=False)
            return (not tds) or all((td.get_text(strip=True) == "") for td in tds)

        def is_new_subheading(tr):
            tds = tr.find_all("td", recursive=False)
            return bool(tds and any("subheading" in (td.get("class") or []) for td in tds))

        first_data_tr = anchor_tr.find_next_sibling("tr")
        while first_data_tr and (is_blank_row(first_data_tr)):
            first_data_tr = first_data_tr.find_next_sibling("tr")

        if not first_data_tr or is_new_subheading(first_data_tr):
            return None

        first_row_tds = first_data_tr.find_all("td", recursive=False)
        row_len = len(first_row_tds)

        # 3) decide mappings from (header_len, row_len)
        if header_len > 5:
            # MAIN MARKET
            header_left_idx, header_right_idx = 2, 4
            row_agency_idx, row_left_idx, row_right_idx, row_updated_idx = 0, 1, 3, None
        elif row_len == 5:
            # LINE-DRAW
            header_left_idx, header_right_idx = 1, 3
            row_agency_idx, row_left_idx, row_right_idx, row_updated_idx = 0, 1, 3, 4
        else:
            # NORMAL (row_len == 4 is the common case; also treat any other as normal fallback)
            header_left_idx, header_right_idx = 2, 3
            row_agency_idx, row_left_idx, row_right_idx, row_updated_idx = 0, 1, 2, 3

        def td_text_safe(tds, idx):
            if idx is None or idx < 0 or idx >= len(tds): return ""
            return (tds[idx].get_text(" ", strip=True) or "").strip()

        left_head = td_text_safe(header_tds, header_left_idx)
        right_head = td_text_safe(header_tds, header_right_idx)
        headers = ["Agency", left_head, right_head, "Updated"]

        # 4) walk data rows until the next subheading
        rows_out = []

        def extract_row(tr, default_map):
            tds = tr.find_all("td", recursive=False)
            n = len(tds)
            # adapt mapping if actual td count differs
            a_idx, l_idx, r_idx, u_idx = default_map
            if n == 4:
                a_idx, l_idx, r_idx, u_idx = 0, 1, 2, 3
            elif n == 5:
                a_idx, l_idx, r_idx, u_idx = 0, 1, 3, 4
            # (for main market headers rows can still be 4/5; above handles both)

            def safe(idx):
                return (tds[idx].get_text(" ", strip=True) if 0 <= idx < n else "").strip()

            a = tds[a_idx].find("a") if 0 <= a_idx < n else None
            agency = (a.get_text(strip=True) if a else safe(a_idx)).strip()

            left_txt = safe(l_idx)
            right_txt = safe(r_idx)

            updated = ""
            if u_idx is not None and 0 <= u_idx < n:
                td_u = tds[u_idx]

                # Only direct text nodes (skip <script>, <span>, etc.)
                direct_texts = [
                    s.strip()
                    for s in td_u.find_all(string=True, recursive=False)
                    if isinstance(s, NavigableString) and s.strip()
                ]

                # Prefer the last direct text; fall back to joined direct text
                candidate = direct_texts[-1] if direct_texts else ""

                # Extract a clean HH:MM from the candidate (e.g., "19:33")
                m = re.search(r"(?<!\d)(\d{1,2}:\d{2})(?!\d)", candidate)
                updated = m.group(1) if m else candidate

            return {
                "agency": agency,
                "left": left_txt,
                "right": right_txt,
                "updated": updated if u_idx is not None else "",
            }

        # start from first_data_tr and iterate
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

        # 5) best per side
        def to_float(x):
            try: return float(x)
            except Exception:
                m = re.findall(r"(\d+(?:\.\d+)?)", x or "")
                return float(m[-1]) if m else None

        best_left = (None, -1.0)
        best_right = (None, -1.0)
        for r in rows_out:
            lf, rf = to_float(r["left"]), to_float(r["right"])
            if lf is not None and lf > best_left[1]:
                best_left = (r["agency"], lf)
            if rf is not None and rf > best_right[1]:
                best_right = (r["agency"], rf)

        best = {
            "left": {"agency": best_left[0], "odds": best_left[1] if best_left[1] > 0 else None},
            "right": {"agency": best_right[0], "odds": best_right[1] if best_right[1] > 0 else None},
        }

        return {"headers": headers, "rows": rows_out, "best": best}

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
