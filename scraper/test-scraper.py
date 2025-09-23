import os
import re
import time
import json
import datetime as dt
from bs4 import BeautifulSoup, NavigableString
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

DATA_PATH = os.path.join(os.path.dirname(__file__), 'afl_odds.json')
TARGET_URL = "http://odds.aussportsbetting.com/multibet"

def make_driver() -> webdriver.Chrome:
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

def scrape_competition(driver, compid):
    driver.get(TARGET_URL)
    input_el = _find_in_any_frame(driver, By.NAME, "compid")
    driver.execute_script("arguments[0].value = arguments[1];", input_el, compid)
    driver.execute_script("arguments[0].dispatchEvent(new Event('change', {bubbles:true}));", input_el)

    driver.switch_to.default_content()
    update_btn = _find_in_any_frame(driver, By.ID, "update")
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

    rows = []
    for td in soup.find_all("td", id="more-market-odds"):
        a_tags = td.find_all("a")
        if len(a_tags) < 2:
            continue
        if len(a_tags) == 3:
            try:
                mid_odds = float(a_tags[1].text.split('-')[-1].strip())
            except Exception:
                mid_odds = None
            if mid_odds is not None and abs(mid_odds - 1.0) < 1e-6:
                left_anchor, right_anchor = a_tags[0], a_tags[2]
            else:
                continue
        else:
            left_anchor, right_anchor = a_tags[0], a_tags[1]

        link_text_1 = left_anchor.text.strip()
        link_text_2 = right_anchor.text.strip()
        try:
            a, b = float(link_text_1.split(" - ")[1]), float(link_text_2.split(" - ")[1])
            market_pct = ((1/a) + (1/b)) * 100
            roi = (1.0 / (market_pct / 100.0)) - 1.0
        except Exception:
            continue

        rows.append({
            "match": f"{link_text_1} | {link_text_2}",
            "roi": round(roi, 6),
            "market_percentage": round(market_pct, 2),
            "sport": sport_value
        })
    return rows

if __name__ == "__main__":
    driver = make_driver()
    try:
        compid = 11
        rows = scrape_competition(driver, compid)
        rows.sort(key=lambda r: r['roi'], reverse=True)

        for r in rows:
            print(f"{r['match']} | ROI: {r['roi']*100:.2f}% | Market%: {r['market_percentage']} | Sport: {r['sport']}")

        payload = {"lastUpdated": dt.datetime.utcnow().isoformat() + 'Z', "items": rows}
        with open(DATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"Wrote {len(rows)} rows to {DATA_PATH}")
    finally:
        driver.quit()
