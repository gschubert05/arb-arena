#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import time
from typing import Dict, List, Optional, Set, Tuple

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://odds.aussportsbetting.com/betting?competitionid={}"

# Module-level: side-channel for league names
LEAGUES_BY_COMPID: Dict[str, str] = {}


def make_driver(headful: bool = False) -> webdriver.Chrome:
    """
    Deterministic Chrome that matches setup-chrome outputs, plus
    the small HTTP-origin allowances that fixed your main scraper.
    """
    # Clear proxy env so Chrome doesn't inherit any runner proxy
    for k in ("http_proxy","https_proxy","HTTP_PROXY","HTTPS_PROXY",
              "ALL_PROXY","all_proxy","NO_PROXY","no_proxy"):
        os.environ.pop(k, None)

    opts = Options()
    if not headful:
        opts.add_argument("--headless=new")

    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1600,1200")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-first-run")
    opts.add_argument("--no-default-browser-check")
    opts.add_argument("--disable-extensions")
    # Keep close to your working setup
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_argument("--disable-features=IsolateOrigins,site-per-process")
    # Networking: direct & prefer IPv4
    opts.add_argument("--proxy-server=direct://")
    opts.add_argument("--proxy-bypass-list=*")
    opts.add_argument("--disable-ipv6")
    # Allow loading plain-HTTP origin in newer Chrome
    opts.add_argument("--allow-running-insecure-content")
    opts.add_argument("--unsafely-treat-insecure-origin-as-secure=http://odds.aussportsbetting.com")
    # Realistic UA
    opts.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/124.0.0.0 Safari/537.36")

    # Wire the exact Chrome/Driver installed by setup-chrome
    chrome_bin = os.environ.get("CHROME_BIN") or os.environ.get("GOOGLE_CHROME_SHIM")
    if chrome_bin:
        opts.binary_location = chrome_bin
    chromedriver_path = os.environ.get("CHROMEDRIVER_PATH") or os.environ.get("CHROMEWEBDRIVER")
    service = Service(chromedriver_path) if chromedriver_path else Service()

    drv = webdriver.Chrome(service=service, options=opts)
    drv.set_page_load_timeout(45)
    return drv


def parse_range(range_str: str) -> List[int]:
    out: List[int] = []
    for piece in range_str.split(","):
        piece = piece.strip()
        if not piece:
            continue
        if "-" in piece:
            a, b = piece.split("-", 1)
            a, b = int(a), int(b)
            lo, hi = (a, b) if a <= b else (b, a)
            out.extend(range(lo, hi + 1))
        else:
            out.append(int(piece))
    return out


def ensure_dir(path: Optional[str]) -> None:
    if path:
        os.makedirs(path, exist_ok=True)


def save_html(dirpath: Optional[str], comp_id: int, html: str) -> None:
    if not dirpath:
        return
    ensure_dir(dirpath)
    with open(os.path.join(dirpath, f"comp_{comp_id}.html"), "w", encoding="utf-8") as f:
        f.write(html)


def save_screenshot(driver: webdriver.Chrome, dirpath: Optional[str], comp_id: int) -> None:
    if not dirpath:
        return
    ensure_dir(dirpath)
    driver.save_screenshot(os.path.join(dirpath, f"comp_{comp_id}.png"))


def extract_league_name(page_html: str) -> Optional[str]:
    """Read <td id="datapage-title-strip"><h1>…</h1></td> and strip trailing 'live odds'."""
    soup = BeautifulSoup(page_html, "html.parser")
    td = soup.find("td", id="datapage-title-strip")
    if not td:
        return None
    h1 = td.find("h1")
    if not h1:
        return None
    txt = h1.get_text(" ", strip=True)
    if not txt:
        return None
    txt = re.sub(r"[\s–-]*live\s*odds\s*$", "", txt, flags=re.IGNORECASE)
    return txt.strip() or None


def inspect_dom(page_html: str) -> Tuple[bool, str, Dict[str, int]]:
    """
    Decide if page shows odds rows. Return (is_active, reason, counts).
    Heuristics (all from rendered DOM):
      1) any <td id="more-market-odds"> cells
      2) any anchor with onclick containing 'addSelection('
      3) any table/tbody whose first row has a 'Market %' header cell
    """
    soup = BeautifulSoup(page_html, "html.parser")

    # 1) direct odds cells
    tds = soup.find_all("td", id="more-market-odds")
    if len(tds) > 0:
        return True, f"td#more-market-odds x{len(tds)}", {
            "td_more_market_odds": len(tds), "a_addSelection": 0, "market_header_tables": 0
        }

    # 2) anchors calling addSelection
    anchors = soup.find_all("a", onclick=True)
    a_sel = sum(1 for a in anchors if "addSelection(" in (a.get("onclick") or ""))
    if a_sel > 0:
        return True, f"<a onclick=addSelection> x{a_sel}", {
            "td_more_market_odds": 0, "a_addSelection": a_sel, "market_header_tables": 0
        }

    # 3) tables that look like the odds listing (header has "Market %")
    tables = soup.find_all("tbody")
    header_hits = 0
    for tb in tables:
        first_tr = tb.find("tr")
        if not first_tr:
            continue
        headers = [td.get_text(strip=True) for td in first_tr.find_all("td")]
        if any(h.lower() in ("market %", "market%") for h in headers):
            rows = tb.find_all("tr", recursive=False)
            if len(rows) > 1:
                header_hits += 1
    if header_hits > 0:
        return True, f'table with "Market %" header x{header_hits}', {
            "td_more_market_odds": 0, "a_addSelection": 0, "market_header_tables": header_hits
        }

    return False, "no odds markers found", {
        "td_more_market_odds": 0, "a_addSelection": 0, "market_header_tables": 0
    }


def _load_with_retries(driver: webdriver.Chrome, url: str, wait_secs: int) -> None:
    """
    Small, robust loader for the betting page.
    Retries a few times if navigation throws (e.g., transient ERR_CONNECTION_REFUSED).
    """
    last = None
    for _ in range(3):
        try:
            driver.get(url)
            WebDriverWait(driver, wait_secs).until(
                EC.presence_of_all_elements_located((By.TAG_NAME, "table"))
            )
            return
        except Exception as e:
            last = e
            time.sleep(0.8)
    if last:
        raise last


def check_competition(
    driver: webdriver.Chrome,
    comp_id: int,
    wait_secs: int,
    extra_sleep: float,
    save_bad_html_dir: Optional[str],
    save_bad_screens_dir: Optional[str],
    save_all_html_dir: Optional[str],
    save_all_screens_dir: Optional[str],
    very_verbose: bool
) -> Tuple[int, bool, str, Dict[str, int]]:
    url = BASE_URL.format(comp_id)
    try:
        _load_with_retries(driver, url, wait_secs)

        if extra_sleep > 0:
            time.sleep(extra_sleep)

        html = driver.page_source
        is_active, reason, counts = inspect_dom(html)

        # Capture league name if present
        league = extract_league_name(html)
        if league:
            LEAGUES_BY_COMPID[str(comp_id)] = league

        # Save assets if requested
        if save_all_html_dir:
            save_html(save_all_html_dir, comp_id, html)
        if save_all_screens_dir:
            save_screenshot(driver, save_all_screens_dir, comp_id)
        if not is_active:
            save_html(save_bad_html_dir, comp_id, html)
            save_screenshot(driver, save_bad_screens_dir, comp_id)

        return comp_id, is_active, (reason if not very_verbose else f"{reason} | counts={counts}"), counts

    except WebDriverException as e:
        return comp_id, False, f"webdriver error: {e.__class__.__name__}", {}


def main():
    ap = argparse.ArgumentParser(description="Discover active competition IDs via Selenium.")
    mx = ap.add_mutually_exclusive_group()
    mx.add_argument("--range", help='ID range/list, e.g. "1-150" or "1-20,40,41"')
    mx.add_argument("--single", type=int, help="Test a single comp ID")

    ap.add_argument("--skip", default="72,73,108,114", help="Comma-separated IDs to skip")
    ap.add_argument("--out", default="server/data/active_comp_ids.json", help="Where to write JSON list")
    ap.add_argument("--wait", type=int, default=12, help="Max seconds to wait for <table>")
    ap.add_argument("--sleep", type=float, default=0.8, help="Extra sleep after wait (settle time)")
    ap.add_argument("--headful", action="store_true", help="Show a real browser (non-headless)")

    ap.add_argument("-v", "--verbose", action="store_true", help="Per-ID status lines")
    ap.add_argument("-vv", "--very-verbose", action="store_true", help="Verbose + include heuristic counts")
    ap.add_argument("--save-bad-html", default=None, help="Dir to save HTML for inactive/error pages")
    ap.add_argument("--save-bad-screens", default=None, help="Dir to save screenshots for inactive/error pages")
    ap.add_argument("--save-all-html", default=None, help="Dir to save HTML for all pages")
    ap.add_argument("--save-all-screens", default=None, help="Dir to save screenshots for all pages")

    args = ap.parse_args()
    if args.very_verbose:
        args.verbose = True

    # Build candidate IDs
    if args.single is not None:
        ids = [args.single]
    else:
        rng = args.range or "1-150"
        ids = parse_range(rng)

    skip: Set[int] = set(int(x.strip()) for x in args.skip.split(",") if x.strip())
    candidates = [i for i in ids if i not in skip]

    if not candidates:
        print("", end="")  # print empty CSV
        return

    active: List[int] = []
    meta_per_id: Dict[int, Dict[str, int]] = {}

    start = time.time()
    driver = make_driver(headful=args.headful)
    try:
        for cid in candidates:
            cid, ok, reason, counts = check_competition(
                driver, cid, args.wait, args.sleep,
                args.save_bad_html, args.save_bad_screens,
                args.save_all_html, args.save_all_screens,
                args.very_verbose
            )
            meta_per_id[cid] = counts
            if args.verbose:
                print(f"[{cid:>3}] {'ACTIVE' if ok else '----- '}  {reason}", file=sys.stderr)
            if ok:
                active.append(cid)
    finally:
        driver.quit()

    active.sort()
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({
            "discoveredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "range": args.range or (f"{args.single}" if args.single is not None else "1-150"),
            "skip": sorted(list(skip)),
            "active_comp_ids": active,
            "leagues_by_compid": LEAGUES_BY_COMPID,
            "debug_counts": meta_per_id,
        }, f, ensure_ascii=False, indent=2)

    # Print compact CSV for CI piping
    print(",".join(str(x) for x in active))

    dur = time.time() - start
    if args.verbose:
        print(f"Discovered {len(active)} active IDs in {dur:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
