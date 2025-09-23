#!/usr/bin/env python3
import argparse, json, os, re, subprocess, sys

def norm_agency(a: str) -> str:
    a = (a or "")
    a = re.sub(r"\(.*?\)", "", a)
    a = a.split('-', 1)[0]
    a = a.strip().lower().replace(" ", "")
    return a

def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, help="opportunities.json path")
    p.add_argument("--seen", required=True, help="seen_keys.json path")
    p.add_argument("--roi-threshold-pct", type=float, default=float(os.environ.get("ROI_THRESHOLD_PCT","2.0")))
    p.add_argument("--notify-bookies", default=os.environ.get("NOTIFY_BOOKIES","sportsbet,bet365,neds,tab"))
    args = p.parse_args()

    thresh = (args.roi_threshold_pct or 0.0) / 100.0
    allow = {norm_agency(x) for x in (args.notify_bookies or "").split(",") if x.strip()}

    cur = load_json(args.input, {"items":[]})
    if isinstance(cur, list):
        cur = {"items": cur}
    items = cur.get("items", [])

    seen = load_json(args.seen, [])
    seen_set = set(seen if isinstance(seen, list) else [])

    def key(it):
        def n(x): return (x or "").strip().lower()
        return "|".join([
            str(it.get("competitionid") or it.get("competitionId") or ""),
            n(it.get("sport")), n(it.get("game")), n(it.get("market")),
            n(it.get("match")), it.get("dateISO") or it.get("date") or ""
        ])

    new_hits = []
    for it in items:
        try:
            roi = float(it.get("roi") or 0.0)
        except Exception:
            roi = 0.0
        if roi < thresh:
            continue

        best = (it.get("book_table") or {}).get("best") or {}
        L = best.get("left")  or {}
        R = best.get("right") or {}
        if not (L.get("agency") and R.get("agency") and L.get("odds") and R.get("odds")):
            continue

        if norm_agency(L["agency"]) not in allow or norm_agency(R["agency"]) not in allow:
            continue

        k = key(it)
        if k in seen_set:
            continue

        new_hits.append(it)
        seen_set.add(k)

    # write back seen
    with open(args.seen, "w", encoding="utf-8") as f:
        json.dump(sorted(list(seen_set)), f, ensure_ascii=False, indent=0)

    if not new_hits:
        print("No new hits above threshold; nothing to notify.")
        return 0

    new_hits.sort(key=lambda x: float(x.get('roi') or 0), reverse=True)

    def fmt(it):
        best = it["book_table"]["best"]
        L, R = best["left"], best["right"]
        sport = it.get("sport") or ""
        game  = it.get("game") or ""
        market= it.get("market") or ""
        match = it.get("match") or ""
        date  = it.get("date") or it.get("dateISO") or ""
        roi_pct = f"{(float(it.get('roi') or 0)*100):.2f}%"
        line1 = f"⚡ {sport}"
        line2 = f"{game} — {market}"
        line3 = f"{match}"
        line4 = f"{L['agency']} @ {float(L['odds']):.2f}  |  {R['agency']} @ {float(R['odds']):.2f}"
        line5 = f"ROI: {roi_pct}  |  {date}"
        return "\n".join([line1, line2, line3, line4, line5])

    msg = "New arbs over threshold (" + str(args.roi_threshold_pct) + "%)\n\n" + "\n\n".join(fmt(it) for it in new_hits[:8])
    print(msg)

    # Telegram
    tok = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat= os.environ.get("TELEGRAM_CHAT_ID")
    if tok and chat:
        api = f"https://api.telegram.org/bot{tok}/sendMessage"
        subprocess.run([
            "curl","-fsS","-X","POST",api,
            "-d", f"chat_id={chat}",
            "--data-urlencode","disable_web_page_preview=true",
            "--data-urlencode", f"text={msg}"
        ], check=False)

    # Discord
    wh = os.environ.get("DISCORD_WEBHOOK_URL")
    if wh:
        payload = json.dumps({"content": msg})
        subprocess.run([
            "curl","-fsS","-H","Content-Type: application/json",
            "-d", payload, wh
        ], check=False)

    return 0

if __name__ == "__main__":
    sys.exit(main())
