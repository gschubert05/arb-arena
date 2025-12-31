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

const AEST_OFFSET_MS = 10 * 60 * 60 * 1000; // UTC+10

function formatAEST(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";

  // shift UTC instant -> AEST clock time
  const aest = new Date(dt.getTime() + AEST_OFFSET_MS);

  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC", // important: we already shifted, so format as UTC
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(aest);

  const get = (t) => parts.find(p => p.type === t)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = (get("dayPeriod") || "").toLowerCase();

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

function formatAESTNoYear(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";

  const aest = new Date(dt.getTime() + AEST_OFFSET_MS);

  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(aest);

  const get = (t) => parts.find(p => p.type === t)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = (get("dayPeriod") || "").toLowerCase();

  return `${day} ${month}, ${hour}:${minute} ${dayPeriod}`;
}

function getAestNowParts() {
  // "now" in AEST clock time (read via UTC getters after shifting)
  const aest = new Date(Date.now() + AEST_OFFSET_MS);

  return {
    year: aest.getUTCFullYear(),
    month: aest.getUTCMonth(), // 0-11
    day: aest.getUTCDate(),
    hour: aest.getUTCHours(),
    minute: aest.getUTCMinutes(),
  };
}

function dateFromAestLocal(year, monthIndex, day, hour, minute) {
  // Construct a Date representing that AEST local time.
  // Brisbane is UTC+10 always, so UTC = local - 10 hours.
  return new Date(Date.UTC(year, monthIndex, day, hour - 10, minute, 0));
}

function parseOpportunitiesEventDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

  const s = String(raw).trim();

  // Parse NO-YEAR format FIRST: "Tue 30 Dec 20:00"
  const m = s.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{1,2}):(\d{2})$/);
  if (m) {
    const day = Number(m[2]);
    const monStr = m[3].toLowerCase();
    const hh = Number(m[4]);
    const mm = Number(m[5]);

    const monthMap = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    const monthIndex = monthMap[monStr];
    if (monthIndex === undefined) return null;

    const nowParts = getAestNowParts(); // Brisbane month/year
    const year = (monthIndex < nowParts.month) ? (nowParts.year + 1) : nowParts.year;

    return dateFromAestLocal(year, monthIndex, day, hh, mm);
  }

  // Only accept real ISO / explicit-year strings here
  const looksIso =
    /^\d{4}-\d{2}-\d{2}/.test(s) || s.includes("T") || /Z$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s);
  const hasYear = /\b(19|20)\d{2}\b/.test(s);

  if (looksIso || hasYear) {
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
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
  const oppsPath = arg("opps");     // e.g. data/server/data/opportunities.json
  const activePath = arg("active"); // e.g. data/server/data/active_comp_ids.json
  const outDir = arg("outDir", "data/server/data/social/posts");
  const postedKeysPath = arg("postedKeys", "data/server/data/social/posted_keys.json");
  const topN = Number(arg("top", "1")) || 1;

  if (!oppsPath || !activePath) {
    console.error("Usage: node renderFromOpportunities.mjs --opps <opportunities.json> --active <active_comp_ids.json>");
    process.exit(1);
  }

  const opps = safeReadJson(oppsPath);
  const items = Array.isArray(opps?.items) ? opps.items : [];

  const lastUpdatedIso = opps?.lastUpdated || opps?.last_updated || "";
  const lastUpdatedText = lastUpdatedIso ? formatAEST(lastUpdatedIso) : "";

  const leagueMap = loadLeagueMap(activePath);

  // Sort by ROI desc
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

    // Determine "line" displayed in your header:
    // Prefer numeric part from header if present (e.g. "Over 3.50" → 3.50)
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
        lastUpdatedText, // ✅ formatted AEST
      },
      arb: {
        roi: roiPct,
        sport: item?.sport ?? "",
        date: eventDateText, // ✅ formatted AEST
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

    // Run your existing renderer
    execFileSync(
      "node",
      [
        RENDER_POST,
        "--in", tmpJson,
        "--out", outPath,
        "--format", "square",
        "--scale", "2",
      ],
      { stdio: "inherit" }
    );


    // Clean temp payload json if you want
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
