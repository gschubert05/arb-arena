// scripts/renderTopFromOpportunities.mjs
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1] ?? def;
}
function safeReadJson(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function escapeStr(s) {
  return (s ?? "").toString();
}

function toBookieKey(agency = "") {
  const a = agency.toLowerCase().replace(/[^a-z0-9]/g, "");
  const map = {
    unibet: "unibet",
    neds: "neds",
    tab: "tab",
    sportsbet: "sportsbet",
    pointsbet: "pointsbet",
    playup: "playup",
    palmerbet: "palmerbet",
    betfair: "betfair",
    betr: "betr",
    betright: "betright",
    boombet: "boombet",
    dabble: "dabble",
    bet365: "bet365",
    betestate: "betestate",
  };
  return map[a] ?? a;
}

function parseUrlParams(url = "") {
  try {
    const u = new URL(url);
    const get = (k) => u.searchParams.get(k) || "";
    return {
      matchnumber: get("matchnumber"),
      marketid: get("marketid"),
      competitionid: get("competitionid"),
    };
  } catch {
    return { matchnumber: "", marketid: "", competitionid: "" };
  }
}

function formatAestFromIso(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);

  const fmtDate = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);

  const fmtTime = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d).replace(" am", "am").replace(" pm", "pm");

  return `${fmtDate} • ${fmtTime} AEST`;
}

// Convert header label → { side, line, headerLineForTop }
function parseSelectionLabel(label = "") {
  const s = String(label || "").trim();
  if (!s) return { side: "", line: "", headerLine: "" };

  // Over 3.50 / Under 3.50
  let m = s.match(/^(Over|Under)\s+([+\-]?\d+(?:\.\d+)?)$/i);
  if (m) {
    const side = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    const num = m[2];
    const line = num.startsWith("+") || num.startsWith("-") ? num : `+${num}`;
    const headerLine = num.replace(/^[+\-]/, "");
    return { side, line, headerLine };
  }

  // Team (+12.5) or Team (-12.5)
  m = s.match(/^(.+?)\s*\(\s*([+\-]\d+(?:\.\d+)?)\s*\)\s*$/);
  if (m) {
    const side = m[1].trim();
    const line = m[2].trim();
    const headerLine = line.replace(/^[+\-]/, "");
    return { side, line, headerLine };
  }

  // Team +12.5 (no parens)
  m = s.match(/^(.+?)\s+([+\-]\d+(?:\.\d+)?)$/);
  if (m) {
    const side = m[1].trim();
    const line = m[2].trim();
    const headerLine = line.replace(/^[+\-]/, "");
    return { side, line, headerLine };
  }

  // Fallback: no line
  return { side: s, line: "", headerLine: "" };
}

function buildDedupeKey(item) {
  const urlBits = parseUrlParams(item?.url || "");
  const bt = item?.book_table || {};
  const headers = Array.isArray(bt.headers) ? bt.headers : [];
  const leftLabel = (headers[1] || "").trim();
  const rightLabel = (headers[2] || "").trim();
  // Stable-ish: IDs + market + labels + game + sport (NO odds)
  return [
    urlBits.competitionid || item?.competitionid || "",
    urlBits.marketid || "",
    urlBits.matchnumber || "",
    (item?.sport || "").trim(),
    (item?.game || "").trim(),
    (item?.market || "").trim(),
    leftLabel,
    rightLabel,
  ].join("|");
}

function main() {
  const inPath = arg("in");
  const outDir = arg("outdir", "generated_posts");
  const topN = Number(arg("top", "3")) || 3;

  const renderer = arg("renderer", "scripts/renderPost.mjs");
  const format = arg("format", "square");
  const scale = arg("scale", "2");

  const postedIn = arg("posted-in", null);
  const postedOut = arg("posted-out", null);

  if (!inPath) {
    console.error("Missing --in <opportunities.json>");
    process.exit(1);
  }

  const opps = safeReadJson(inPath, {});
  const items = Array.isArray(opps.items) ? opps.items : [];

  const postedArr = postedIn ? safeReadJson(postedIn, []) : [];
  const postedSet = new Set(Array.isArray(postedArr) ? postedArr : []);

  const lastUpdatedText = formatAestFromIso(opps.lastUpdated || opps.lastUpdatedAt || opps.generatedAt);

  // Rank by ROI (decimal) high → low, but skip duplicates
  const ranked = items
    .filter((x) => Number.isFinite(Number(x?.roi)))
    .sort((a, b) => Number(b.roi) - Number(a.roi))
    .filter((item) => {
      const key = buildDedupeKey(item);
      return key && !postedSet.has(key);
    })
    .slice(0, topN);

  if (ranked.length === 0) {
    console.log("No new arbs to post (all top candidates are duplicates).");
    // still write postedOut if requested
    if (postedOut) fs.writeFileSync(postedOut, JSON.stringify([...postedSet], null, 2), "utf8");
    process.exit(0);
  }

  ensureDir(outDir);
  ensureDir(path.join(outDir, "payloads"));

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceLastUpdated: opps.lastUpdated || null,
    posts: [],
  };

  ranked.forEach((item, idx) => {
    const bt = item?.book_table || {};
    const headers = Array.isArray(bt.headers) ? bt.headers : [];
    const leftLabel = (headers[1] || "").trim();
    const rightLabel = (headers[2] || "").trim();

    const leftParsed = parseSelectionLabel(leftLabel);
    const rightParsed = parseSelectionLabel(rightLabel);

    const bestLeft = bt?.best?.left || {};
    const bestRight = bt?.best?.right || {};

    const legs = [
      {
        side: escapeStr(leftParsed.side),
        line: escapeStr(leftParsed.line),
        odds: Number(bestLeft.odds),
        bookie: escapeStr(bestLeft.agency || ""),
        bookieKey: toBookieKey(bestLeft.agency || ""),
      },
      {
        side: escapeStr(rightParsed.side),
        line: escapeStr(rightParsed.line),
        odds: Number(bestRight.odds),
        bookie: escapeStr(bestRight.agency || ""),
        bookieKey: toBookieKey(bestRight.agency || ""),
      },
    ];

    // Line shown at top: prefer something meaningful
    const headerLine = leftParsed.headerLine || rightParsed.headerLine || "";

    const payload = {
      brand: {
        name: "Arb Arena",
        url: "arb-arena.com",
        timezone: "AEST",
      },
      meta: {
        generatedAt: new Date().toISOString(),
        lastUpdatedText: lastUpdatedText || "",
        targetProfit: 20,
        profitWindow: 10,
        roundStep: 5,
      },
      arb: {
        roi: Number(item.roi) * 100,         // decimal → percent
        sport: escapeStr(item.sport || ""),
        date: escapeStr(item.date || ""),
        league: escapeStr(item.league || item.competition || item.season || ""),
        event: escapeStr(item.game || ""),
        market: escapeStr(item.market || ""),
        line: escapeStr(headerLine),
        legs,
      },
    };

    const payloadPath = path.join(outDir, "payloads", `post_${idx + 1}.json`);
    fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), "utf8");

    const outPng = path.join(outDir, `post_${idx + 1}.png`);
    const res = spawnSync(
      "node",
      [renderer, "--in", payloadPath, "--out", outPng, "--format", format, "--scale", String(scale)],
      { stdio: "inherit" }
    );

    if (res.status !== 0) {
      console.error(`Render failed for item ${idx + 1}`);
      process.exit(res.status || 1);
    }

    const key = buildDedupeKey(item);
    postedSet.add(key);

    manifest.posts.push({
      rank: idx + 1,
      roi: payload.arb.roi,
      game: payload.arb.event,
      market: payload.arb.market,
      left: leftLabel,
      right: rightLabel,
      outFile: path.basename(outPng),
      payloadFile: path.basename(payloadPath),
      url: item.url || "",
      dedupeKey: key,
    });
  });

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  if (postedOut) {
    fs.writeFileSync(postedOut, JSON.stringify([...postedSet], null, 2), "utf8");
  }

  console.log(`Done. Rendered ${manifest.posts.length} post(s) into: ${outDir}`);
}

main();
