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
from selenium.common.exceptions import TimeoutException

DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'server', 'data', 'opportunities.json')
TARGET_URL = "http://odds.aussportsbetting.com/multibet"
SKIP_IDS = {72, 73, 108, 114}

# --- Skip noisy Baseball O/U +0.5 totals
_RE_OVER_05  = re.compile(r'\bover\s*\(?\+?0\.5\)?\b', re.I)
_RE_UNDER_05 = re.compile(r'\bunder\s*\(?\+?0\.5\)?\b', re.I)

def _is_bad_baseball_half_total(txt: str) -> bool:
    s = re.sub(r'\s+', ' ', txt or '').lower().replace('−', '-')
    return bool(_RE_OVER_05.search(s) and _RE_UNDER_05.search(s))

def parse_comp_ids(env_val: Optional[str]) -> List[int]:
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

def _find_in_any_frame(driver, by, value, timeout=15):
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            driver.switch_to.default_content()
            return WebDriverWait(driver, 2).until(EC.presence_of_element_located((by, value)))
        except Exception as e:
            last_err = e
        try:
            frames = driver.find_elements(By.TAG_NAME, "iframe")
        except Exception:
            frames = []
        for fr in frames:
            try:
                driver.switch_to.default_content()
                driver.switch_to.frame(fr)
                return WebDriverWait(driver, 2).until(EC.presence_of_element_located((by, value)))
            except Exception as e:
                last_err = e
        time.sleep(0.3)
    driver.switch_to.default_content()
    raise last_err or TimeoutException(f"Could not locate {value} in any frame")

def extract_search_phrase(match_text: str) -> str:
    try:
        right = match_text.split('|')[1].strip()
        phrase = right.split(' - ')[0].strip()
        if 'Under' in phrase:
            phrase = phrase.replace('+', '')
        return phrase
    except Exception:
        return match_text

def _parse_float(text: str) -> Optional[float]:
    try:
        return float(text.strip())
    except Exception:
        nums = re.findall(r"(\d+(?:\.\d+)?)", text or "")
        return float(nums[-1]) if nums else None

def _norm(s: str) -> str:
    return (s or "").strip()

def _updated_from_td(td) -> str:
    if td is None:
        return ""
    for sc in td.find_all("script"):
        s = sc.string or ""
        m = re.search(r"write_local_time\(\s*(\d{10,})\s*\)", s)
        if m:
            try:
                ms = int(m.group(1))
                t = dt.datetime.fromtimestamp(ms / 1000.0)
                return t.strftime("%H:%M")
            except Exception:
                pass
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
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-background-networking")

    chrome_bin = os.environ.get("CHROME_BIN")
    if chrome_bin:
        options.binary_location = chrome_bin

    chromedriver_path = os.environ.get("CHROMEDRIVER_PATH") or os.environ.get("CHROMEWEBDRIVER")
    if chromedriver_path:
        service = Service(chromedriver_path)
        return webdriver.Chrome(service=service, options=options)
    return webdriver.Chrome(options=options)

def scrape_competition(driver: webdriver.Chrome, compid: int) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    driver.get(TARGET_URL)

    input_el = _find_in_any_frame(driver, By.NAME, "compid", timeout=15)
    driver.execute_script("arguments[0].value = arguments[1];", input_el, compid)
    driver.execute_script("arguments[0].dispatchEvent(new Event('change', {bubbles:true}));", input_el)

    driver.switch_to.default_content()
    update_btn = _find_in_any_frame(driver, By.ID, "update", timeout=10)
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", update_btn)
    update_btn.click()

    WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.ID, "more-market-odds")))
    time.sleep(1.0)

    soup = BeautifulSoup(driver.page_source, "html.parser")
    sport_value = "Unknown Sport"
    try:
        sport_select = soup.find("select", class_="dd-select", attrs={"name": "sport"})
        sport_value = sport_select.find("option", selected=True).text.strip() if sport_select else sport_value
    except Exception:
        pass

    for td in soup.find_all("td", id="more-market-odds"):
        a_tags = td.find_all("a")
        if len(a_tags) < 2:
            continue

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
                tds_ = game_tr.find_all("td")
                if len(tds_) >= 3:
                    match_date = tds_[1].text.strip()
                    game_name = tds_[2].text.strip()
        except Exception:
            pass

        if use_outer_two:
            left_anchor = a_tags[0]
            right_anchor = a_tags[2]
        else:
            left_anchor = a_tags[0]
            right_anchor = a_tags[1]

        link_text_1 = left_anchor.text.strip()
        link_text_2 = right_anchor.text.strip()

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

        try:
            a = float(link_text_1.split(" - ")[1])
            b = float(link_text_2.split(" - ")[1])
            market_pct = ((1/a) + (1/b)) * 100 if a > 0 and b > 0 else 100.0
        except Exception:
            continue
        roi = round((100 - market_pct), 2)

        rows.append({
            "url": full_url or "",
            "market_percentage": round(market_pct, 2),
            "roi": roi,
            "match": game_name,
            "market": market_name,
            "game": game_name,
            "date": match_date,
            "competitionid": compid,
            "sport": sport_value,
            "dateISO": dt.datetime.now().isoformat(),
            "search_phrase": extract_search_phrase(link_text_1),
            "book_table": {
                left_anchor.text.strip(): _parse_float(left_anchor.text.strip()),
                right_anchor.text.strip(): _parse_float(right_anchor.text.strip())
            }
        })

    return rows

def main():
    driver = make_driver()
    all_results: List[Dict[str, Any]] = []

    comp_ids = parse_comp_ids(os.environ.get("COMP_IDS"))
    for cid in comp_ids:
        try:
            all_results.extend(scrape_competition(driver, cid))
        except Exception as e:
            print(f"Error scraping competition {cid}: {e}")

    driver.quit()

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
