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

def scrape_afl_odds(compid=11):
    driver = make_driver()
    try:
        driver.get(TARGET_URL)
        print("Page loaded:", driver.title)

        # Set compid
        input_el = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.NAME, "compid"))
        )
        driver.execute_script(
            "arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('change', {bubbles:true}));",
            input_el,
            compid
        )
        print(f"Set compid to {compid}")

        # Click update
        update_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, "update"))
        )
        update_btn.click()
        print("Clicked update button")

        # Wait for odds table to populate
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, "marketRow"))
        )
        print("Page updated, compid selection works!")

        # Scrape matches
        matches = driver.find_elements(By.CLASS_NAME, "marketRow")
        odds_list = []
        for match in matches[:5]:  # just first 5 for testing
            try:
                teams = match.find_element(By.CLASS_NAME, "marketName").text.strip()
                odds_cells = match.find_elements(By.CLASS_NAME, "marketPrice")
                odds = [cell.text.strip() for cell in odds_cells]
                odds_list.append({"teams": teams, "odds": odds})
            except:
                continue

        return odds_list

    finally:
        driver.quit()

if __name__ == "__main__":
    afl_odds = scrape_afl_odds(11)
    print("Sample AFL Odds:", afl_odds)
