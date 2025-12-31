import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RENDER_POST = path.resolve(__dirname, "renderPost.mjs");


function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1] ?? def;
}

function safeReadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function slugify(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toPct(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  // opportunities.json roi is decimal, e.g. 0.0627
  return n > 1 ? n : n * 100;
}

function normalizeBookieKey(name = "") {
  const s = String(name).trim().toLowerCase();

  const map = {
    "unibet": "unibet",
    "uni bet": "unibet",
    "neds": "neds",
    "sportsbet": "sportsbet",
    "sports bet": "sportsbet",
    "pointsbet": "pointsbet",
    "points bet": "pointsbet",
    "bet365": "bet365",
    "bet 365": "bet365",
    "tab": "tab",
    "betfair": "betfair",
    "bet right": "betright",
    "betright": "betright",
    "betr": "betr",
    "playup": "playup",
    "play up": "playup",
    "palmerbet": "palmerbet",
    "palmer bet": "palmerbet",
    "boombet": "boombet",
    "boom bet": "boombet",
    "dabble": "dabble",
    "beteasy": "beteasy",
    "bet easy": "beteasy",
    "betestate": "betestate",
    "bet estate": "betestate",
    "ladbrokes": "ladbrokes",
  };

  if (map[s]) return map[s];

  // fallback: strip non-alphanum
  return s.replace(/[^a-z0-9]/g, "");
}

function fmtOdds2(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

function buildCaption({ arb, meta, brand }) {
  const roi = (arb?.roi != null) ? `${Number(arb.roi).toFixed(2).replace(/\.00$/, "")}%` : "";
  const sport = arb?.sport ?? "";
  const league = arb?.league ?? "";
  const event = arb?.event ?? "";
  const market = arb?.market ?? "";
  const line = arb?.line ? ` | Line ${arb.line}` : "";
  const date = arb?.date ? `🗓️ ${arb.date}` : "";

  const legs = Array.isArray(arb?.legs) ? arb.legs.slice(0, 2) : [];
  const legLines = legs.map((l, i) => {
    const side = l?.side ?? "";
    const lline = l?.line ? ` ${l.line}` : "";
    const odds = fmtOdds2(l?.odds);
    const bookie = l?.bookie ?? "";
    // Example: "1) Over +3.50 @ 1.95 (Sportsbet)"
    return `${i + 1}) ${side}${lline} @ ${odds}${bookie ? ` (${bookie})` : ""}`.trim();
  });

  const updated = meta?.lastUpdatedText ? `Last updated: ${meta.lastUpdatedText}` : "";
  const url = brand?.url ?? "arb-arena.com";

  // Keep it clean + copy-paste friendly
  const lines = [
    `🚨 ARB ALERT — ROI ${roi}`,
    `${sport}${league ? ` • ${league}` : ""}`,
    event,
    market ? `Market: ${market}${line}` : "",
    date,
    "",
    ...legLines,
    "",
    updated,
    "",
    `🔗 ${url}`,
    "",
    `#arbitrage #sportsbetting #matchedbetting #valuebetting #sports`,
  ].filter(Boolean);

  // Optional: keep under typical IG limits
  const caption = lines.join("\n");
  return caption.length > 2100 ? caption.slice(0, 2100) + "…" : caption;
}

function formatAEST(d) {
  // returns "31 Dec 2025, 9:14 am" in AEST (Brisbane/Sydney time)
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane", // AEST (no DST)
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(dt);

  const get = (t) => parts.find(p => p.type === t)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = (get("dayPeriod") || "").toLowerCase(); // am/pm

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

function formatAESTNoYear(d) {
  // returns "31 Dec, 9:14 am" in AEST (Brisbane time)
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(dt);

  const get = (t) => parts.find(p => p.type === t)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = (get("dayPeriod") || "").toLowerCase();

  return `${day} ${month}, ${hour}:${minute} ${dayPeriod}`;
}

function getAestNowParts() {
  // returns {year, monthIndex(0-11), day, hour, minute}
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t) => parts.find(p => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")) - 1,
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function dateFromAestLocal(year, monthIndex, day, hour, minute) {
  // Construct a Date representing that AEST local time.
  // Brisbane is UTC+10 always, so UTC = local - 10 hours.
  return new Date(Date.UTC(year, monthIndex, day, hour - 10, minute, 0));
}

function parseOpportunitiesEventDate(raw) {
  // Handles:
  // 1) ISO strings -> Date
  // 2) "Tue 30 Dec 20:00" (no year) -> infer year around New Year
  if (!raw) return null;
  const s = String(raw).trim();

  // If ISO or parseable by Date(), use it
  const isoTry = new Date(s);
  if (!Number.isNaN(isoTry.getTime())) return isoTry;

  // Parse "Tue 30 Dec 20:00"
  const m = s.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const day = Number(m[2]);
  const monStr = m[3].toLowerCase();
  const hh = Number(m[4]);
  const mm = Number(m[5]);

  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = monthMap[monStr];
  if (month === undefined) return null;

  // Infer year based on AEST "now"
  const nowParts = getAestNowParts();
  const nowAest = dateFromAestLocal(nowParts.year, nowParts.month, nowParts.day, nowParts.hour, nowParts.minute);

  // Candidate in current year
  const candThisYear = dateFromAestLocal(nowParts.year, month, day, hh, mm);
  // Candidate in next year
  const candNextYear = dateFromAestLocal(nowParts.year + 1, month, day, hh, mm);

  // Choose the first candidate that is not "too far" in the past.
  // Rule: prefer this year unless it is earlier than now by more than 7 days.
  const MS_DAY = 24 * 60 * 60 * 1000;
  if (candThisYear.getTime() >= nowAest.getTime() - 7 * MS_DAY) {
    return candThisYear;
  }
  return candNextYear;
}

function parseHeaderCell(cell = "") {
  // Expected examples:
  // "Over 3.50" / "Under 3.50"
  // Sometimes could be "Yes" "No", "Home -1.5" etc
  const raw = String(cell).trim();
  if (!raw) return { side: "", line: "" };

  // split on first space
  const m = raw.match(/^([^\s]+)\s+(.+)$/);
  if (!m) return { side: raw, line: "" };

  const side = m[1];
  const line = m[2];

  return { side, line };
}

function buildLegsFromBookTable(item) {
  const bt = item?.book_table;
  if (!bt?.best || !Array.isArray(bt?.headers)) return null;

  // headers: ["Agency", "Over 3.50", "Under 3.50", "Updated"]
  // left column corresponds to headers[1], right column to headers[2]
  const leftHeader = bt.headers[1] ?? "";
  const rightHeader = bt.headers[2] ?? "";

  const left = parseHeaderCell(leftHeader);
  const right = parseHeaderCell(rightHeader);

  const bestLeft = bt.best.left;   // {agency, odds}
  const bestRight = bt.best.right; // {agency, odds}

  if (!bestLeft?.agency || !bestRight?.agency) return null;

  // For consistency with your design, prepend "+" if line is numeric-like and missing sign
  const normalizeLine = (ln) => {
    const s = String(ln ?? "").trim();
    if (!s) return "";
    if (/^[+-]/.test(s)) return s;
    // if starts with a number, add "+"
    if (/^\d/.test(s)) return `+${s}`;
    return s;
  };

  return [
    {
      side: left.side,
      line: normalizeLine(left.line),
      odds: Number(bestLeft.odds),
      bookie: bestLeft.agency,
      bookieKey: normalizeBookieKey(bestLeft.agency),
    },
    {
      side: right.side,
      line: normalizeLine(right.line),
      odds: Number(bestRight.odds),
      bookie: bestRight.agency,
      bookieKey: normalizeBookieKey(bestRight.agency),
    },
  ];
}

function loadLeagueMap(activeCompIdsPath) {
  const a = safeReadJson(activeCompIdsPath);

  // You said: "leagues_by_compid within active_comp_ids.json"
  // We'll support a couple shapes safely.
  const m =
    a?.leagues_by_compid ||
    a?.leaguesByCompid ||
    a?.leagues_by_compId ||
    null;

  if (m && typeof m === "object") return m;

  return {};
}

function dedupeKeyFromItem(item, league) {
  // Exclude odds/roi so we don't repost same arb just because odds changed.
  const sport = item?.sport ?? "";
  const comp = String(item?.competitionid ?? "");
  const game = item?.game ?? "";
  const market = item?.market ?? "";
  const headers = item?.book_table?.headers ?? [];
  const h1 = headers[1] ?? "";
  const h2 = headers[2] ?? "";

  return [
    String(sport).trim().toLowerCase(),
    String(league).trim().toLowerCase(),
    comp.trim(),
    String(game).trim().toLowerCase(),
    String(market).trim().toLowerCase(),
    String(h1).trim().toLowerCase(),
    String(h2).trim().toLowerCase(),
  ].join("|");
}

function readPostedKeys(p) {
  if (!fs.existsSync(p)) return new Set();
  try {
    const arr = safeReadJson(p);
    if (Array.isArray(arr)) return new Set(arr.map(String));
  } catch {}
  return new Set();
}

function writePostedKeys(p, set) {
  const arr = Array.from(set);
  fs.writeFileSync(p, JSON.stringify(arr, null, 2), "utf8");
}

function isoOrString(x) {
  if (!x) return "";
  return String(x);
}

async function main() {
  const oppsPath = arg("opps");
  const activePath = arg("active");
  const outDir = arg("outDir", "data/server/data/social/posts");
  const postedKeysPath = arg("postedKeys", "data/server/data/social/posted_keys.json");
  const topN = Number(arg("top", "3")) || 3;

  if (!oppsPath || !activePath) {
    console.error("Usage: node renderFromOpportunities.mjs --opps <opportunities.json> --active <active_comp_ids.json>");
    process.exit(1);
  }

  const opps = safeReadJson(oppsPath);
  const items = Array.isArray(opps?.items) ? opps.items : [];

  const lastUpdatedIso = opps?.lastUpdated || opps?.last_updated || "";
  const lastUpdatedText = lastUpdatedIso ? formatAESTNoYear(lastUpdatedIso) : "";

  const leagueMap = loadLeagueMap(activePath);

  const sorted = items
    .slice()
    .sort((a, b) => (Number(b?.roi) || 0) - (Number(a?.roi) || 0));

  ensureDir(outDir);
  ensureDir(path.dirname(postedKeysPath));

  const posted = readPostedKeys(postedKeysPath);

  let rendered = 0;

  for (const item of sorted) {
    if (rendered >= topN) break;

    const competitionid = item?.competitionid;
    const league = leagueMap?.[String(competitionid)] ?? "";

    const legs = buildLegsFromBookTable(item);
    if (!legs) continue;

    const headers = item?.book_table?.headers ?? [];
    const left = parseHeaderCell(headers[1] ?? "");
    const lineDisplay = left?.line ? String(left.line).trim() : "";

    const key = dedupeKeyFromItem(item, league);
    if (posted.has(key)) continue;

    const roiPct = toPct(item?.roi);
    if (roiPct === null) continue;

    const eventDateObj = parseOpportunitiesEventDate(item?.date);
    const eventDateText = eventDateObj ? formatAESTNoYear(eventDateObj) : (item?.date ?? "");

    const payload = {
      brand: {
        name: "Arb Arena",
        url: "arb-arena.com",
        timezone: "AEST",
      },
      meta: {
        generatedAt: new Date().toISOString(),
        lastUpdatedText,
      },
      arb: {
        roi: roiPct,
        sport: item?.sport ?? "",
        date: eventDateText,
        league: league,
        event: item?.game ?? "",
        market: item?.market ?? "",
        line: lineDisplay,
        legs,
      },
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileBase = `${stamp}_${slugify(item?.sport)}_${slugify(item?.game)}_${slugify(item?.market)}`.slice(0, 150);
    const outPath = path.join(outDir, `${fileBase}.png`);
    const tmpJson = path.join(outDir, `${fileBase}.json`);

    fs.writeFileSync(tmpJson, JSON.stringify(payload, null, 2), "utf8");

    execFileSync(
      "node",
      [RENDER_POST, "--in", tmpJson, "--out", outPath, "--format", "square", "--scale", "2"],
      { stdio: "inherit" }
    );

    const caption = buildCaption(payload);
    const captionPath = outPath.replace(/\.png$/i, ".caption.txt");
    fs.writeFileSync(captionPath, caption, "utf8");

    fs.unlinkSync(tmpJson);

    posted.add(key);
    rendered += 1;
  }

  writePostedKeys(postedKeysPath, posted);
  console.log(`Rendered ${rendered} post(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
