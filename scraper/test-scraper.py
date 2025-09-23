from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def main():
    chrome_opts = Options()
    chrome_opts.add_argument("--no-sandbox")
    chrome_opts.add_argument("--disable-dev-shm-usage")
    chrome_opts.add_argument("--disable-gpu")

    # Run in headed mode under Xvfb
    driver = webdriver.Chrome(options=chrome_opts)

    try:
        url = "http://www.odds.aussportsbetting.com/multibet/"
        driver.get(url)
        print("Page title is:", driver.title)

        # Try grab the H1 heading if it exists
        try:
            h1 = driver.find_element(By.TAG_NAME, "h1")
            print("Found H1 text:", h1.text)
        except Exception as e:
            print("Could not find H1 element:", e)

    finally:
        driver.quit()

if __name__ == "__main__":
    main()
