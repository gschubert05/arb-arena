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
  const topN = Number(arg("top", "3")) || 3;

  if (!oppsPath || !activePath) {
    console.error("Usage: node renderFromOpportunities.mjs --opps <opportunities.json> --active <active_comp_ids.json>");
    process.exit(1);
  }

  const opps = safeReadJson(oppsPath);
  const items = Array.isArray(opps?.items) ? opps.items : [];
  const lastUpdated = opps?.lastUpdated || "";

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

    const payload = {
      brand: {
        name: "Arb Arena",
        url: "arb-arena.com",
        timezone: "AEST",
      },
      meta: {
        generatedAt: new Date().toISOString(),
        lastUpdatedText: lastUpdated ? isoOrString(lastUpdated) : "",
        // you can also pass these if you want:
        // roundStep: 5,
        // targetProfit: 20,
        // profitWindow: 10,
      },
      arb: {
        roi: roiPct,
        sport: item?.sport ?? "",
        date: item?.date ?? "",
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
