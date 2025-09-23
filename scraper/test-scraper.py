from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def main():
    chrome_opts = Options()
    chrome_opts.add_argument("--no-sandbox")
    chrome_opts.add_argument("--disable-dev-shm-usage")
    chrome_opts.add_argument("--disable-gpu")

    # Run in headed mode (not --headless) but under Xvfb
    driver = webdriver.Chrome(options=chrome_opts)

    try:
        driver.get("https://en.wikipedia.org/wiki/Main_Page")
        print("Page title is:", driver.title)

        # Just grab one element to prove scraping works
        el = driver.find_element(By.ID, "mp-welcome")
        print("Found element text:", el.text[:80])
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
