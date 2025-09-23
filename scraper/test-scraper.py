from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

TARGET_URL = "http://odds.aussportsbetting.com/multibet"

def make_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1600,1200")
    return webdriver.Chrome(options=options)

import os
import json
from your_scraper_module import make_driver, scrape_competition, DATA_PATH

# Use compid=11 (AFL)
compid = 11

# Start driver
driver = make_driver()
try:
    # Scrape full competition (odds, market, games)
    rows = scrape_competition(driver, compid)

    if not rows:
        print("No rows found for compid", compid)
    else:
        print(f"Found {len(rows)} odds rows for compid {compid}")

    # Save a quick JSON dump (like your main scraper does)
    payload = {"lastUpdated": "manual-test", "items": rows}
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    test_path = os.path.join(os.path.dirname(DATA_PATH), f"debug_comp_{compid}_test.json")
    with open(test_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(rows)} rows to {test_path}")

finally:
    driver.quit()

