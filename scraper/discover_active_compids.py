#!/usr/bin/env python3
import argparse
import concurrent.futures
import json
import os
import re
import sys
import time
from typing import List, Set

import requests
from bs4 import BeautifulSoup

BASE_URL = "http://odds.aussportsbetting.com/betting?competitionid={}"
DEFAULT_TIMEOUT = 10
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ArbFinder/1.0; +https://example.com)"
}

# Heuristics:
# - Presence of 'addSelection(' JS hook anywhere in the HTML
# - or at least one element with id="more-market-odds"
SEL_RE = re.compile(r"addSelection\s*\(")

def has_rows_for_comp(comp_id: int, timeout: int = DEFAULT_TIMEOUT) -> bool:
    url = BASE_URL.format(comp_id)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        if resp.status_code != 200:
            return False
        html = resp.text
        if SEL_RE.search(html):
            return True
        soup = BeautifulSoup(html, "html.parser")
        if soup.find(id="more-market-odds"):
            return True
        # fallback: look for any <a onclick="addSelection(..."> anchor (some pages inline it)
        if soup.find("a", onclick=SEL_RE):
            return True
        return False
    except Exception:
        return False

def parse_range(range_str: str) -> List[int]:
    parts = []
    for piece in range_str.split(","):
        piece = piece.strip()
        if not piece:
            continue
        if "-" in piece:
            a, b = piece.split("-", 1)
            a, b = int(a), int(b)
            lo, hi = (a, b) if a <= b else (b, a)
            parts.extend(range(lo, hi + 1))
        else:
            parts.append(int(piece))
    return parts

def main():
    ap = argparse.ArgumentParser(description="Discover active competition IDs on aussportsbetting.com.")
    ap.add_argument("--range", default="1-150", help='ID range/list, e.g. "1-150" or "1-20,40,41"')
    ap.add_argument("--skip", default="72,73,108,114", help="Comma-separated IDs to skip")
    ap.add_argument("--out", default="server/data/active_comp_ids.json", help="Where to write JSON list")
    ap.add_argument("--threads", type=int, default=16, help="Concurrent workers")
    ap.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Per-request timeout (s)")
    args = ap.parse_args()

    ids = parse_range(args.range)
    skip: Set[int] = set(int(x.strip()) for x in args.skip.split(",") if x.strip())

    candidates = [i for i in ids if i not in skip]
    active: List[int] = []

    start = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.threads) as ex:
        fut_to_id = {ex.submit(has_rows_for_comp, cid, args.timeout): cid for cid in candidates}
        for fut in concurrent.futures.as_completed(fut_to_id):
            cid = fut_to_id[fut]
            ok = False
            try:
                ok = fut.result()
            except Exception:
                ok = False
            if ok:
                active.append(cid)

    active.sort()
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"discoveredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   "range": args.range,
                   "skip": sorted(list(skip)),
                   "active_comp_ids": active}, f, ensure_ascii=False, indent=2)

    # For easy piping into $GITHUB_ENV, also print a compact comma-separated string to stdout
    print(",".join(str(x) for x in active))

    # Exit non-zero if none found (optional). For now, success even if empty.
    # if not active:
    #     sys.exit(2)

    dur = time.time() - start
    sys.stderr.write(f"Discovered {len(active)} active IDs in {dur:.1f}s\n")

if __name__ == "__main__":
    main()
