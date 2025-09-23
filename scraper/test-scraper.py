from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

TARGET_URL = "http://odds.aussportsbetting.com/multibet"

def make_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1600,1200")
    return webdriver.Chrome(options=options)

def test_compid(compid: int):
    driver = make_driver()
    try:
        driver.get(TARGET_URL)
        print("Page loaded:", driver.title)

        # Find the compid input
        input_el = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.NAME, "compid"))
        )

        # Set compid
        driver.execute_script("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('change', {bubbles:true}));", input_el, compid)
        print(f"Set compid to {compid}")

        # Click the update button
        update_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, "update"))
        )
        update_btn.click()
        print("Clicked update button")

        # Wait for some result element to show up
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "more-market-odds"))
        )
        print("Page updated, compid selection works!")

    finally:
        driver.quit()

if __name__ == "__main__":
    test_compid(11)  # example compid
