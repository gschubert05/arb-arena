// scripts/renderPost.mjs — Arb Arena social post renderer (drop-in)

import fs from "fs";
import path from "path";
import { chromium } from "playwright";

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1] ?? def;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function fmtOdds(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}
function fmtRoi(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2).replace(/\.00$/, "");
}
function safeReadJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}
function fileToDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".svg"
      ? "image/svg+xml"
      : ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : "application/octet-stream";
  const buf = fs.readFileSync(filePath);
  const b64 = buf.toString("base64");
  return `data:${mime};base64,${b64}`;
}
function resolveAssetDataUrl(relPathCandidates) {
  for (const rel of relPathCandidates) {
    const p = path.resolve(rel);
    if (fs.existsSync(p)) return fileToDataUrl(p);
  }
  return null;
}

// ✅ UPDATED: bookie logos are in web/images and are .jpeg (but allow other extensions too)
function resolveBookieLogo(bookieKey) {
  if (!bookieKey) return null;
  return resolveAssetDataUrl([
    `web/images/${bookieKey}.jpeg`,
    `web/images/${bookieKey}.jpg`,
    `web/images/${bookieKey}.png`,
    `web/images/${bookieKey}.svg`,
  ]);
}

// ✅ UPDATED: brand logo is web/logo.svg (allow fallbacks)
function resolveBrandLogo() {
  return resolveAssetDataUrl([
    "web/logo.svg",
    "web/logo.png",
    "web/logo.jpeg",
    "web/logo.jpg",
  ]);
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v === 0) return 0;
    if (v === false) return false;
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return v;
  }
  return "";
}

/** Bookie → glow colour (extend anytime). */
const BOOKIE_COLORS = {
  bet365:    "#047c5c",
  betestate: "#ecdc1c",
  betfair:   "#e4ac1c",
  betr:      "#0c3cd4",
  betright:  "#f018c9",
  boombet:   "#c32195",
  dabble:    "#7c4cf4",
  neds:      "#f48c2c",
  palmerbet: "#849ccc",
  playup:    "#0cec74",
  pointsbet: "#ec1c44",
  sportsbet: "#045ca4",
  tab:       "#24e46c",
  unibet:    "#147c44",
};

function cssRgba(hex, a) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return `rgba(59,130,246,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function calcImpliedEdgePct(oddsA, oddsB) {
  const a = Number(oddsA);
  const b = Number(oddsB);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  return (1 / a + 1 / b - 1) * 100;
}

function money(n, dp = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return x.toFixed(dp);
}

function calcTheoreticalRoiPct(oddsA, oddsB) {
  const a = Number(oddsA);
  const b = Number(oddsB);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  const sum = (1 / a) + (1 / b);
  if (sum <= 0) return null;
  return (1 / sum - 1) * 100;
}

function findBestRoundedStakes({
  oddsA,
  oddsB,
  targetProfit = 20,
  profitWindow = 10,
  step = 5,
  maxTotalCap = 5000,
}) {
  const a = Number(oddsA);
  const b = Number(oddsB);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;

  const theoPct = calcTheoreticalRoiPct(a, b);
  if (theoPct === null || theoPct <= 0) return null;
  const theo = theoPct / 100;

  const minTotalApprox = targetProfit / theo;
  const maxTotalApprox = (targetProfit + profitWindow) / theo;

  const roundDown = (x) => Math.floor(x / step) * step;
  const roundUp = (x) => Math.ceil(x / step) * step;

  const minTotal = Math.max(step * 2, roundDown(minTotalApprox) - step * 20);
  const maxTotal = Math.min(maxTotalCap, roundUp(maxTotalApprox) + step * 40);

  let best = null;

  for (let sA = step; sA <= maxTotal - step; sA += step) {
    for (let sB = step; sB <= maxTotal - sA; sB += step) {
      const total = sA + sB;
      if (total < minTotal) continue;

      const rA = sA * a;
      const rB = sB * b;
      const minReturn = Math.min(rA, rB);
      const profit = minReturn - total;

      if (profit < targetProfit || profit > targetProfit + profitWindow) continue;

      const actualRoi = profit / total;
      const score = actualRoi;

      if (!best) {
        best = { sA, sB, total, profit, minReturn, actualRoi, score };
        continue;
      }

      const eps = 1e-9;
      if (score > best.score + eps) {
        best = { sA, sB, total, profit, minReturn, actualRoi, score };
      } else if (Math.abs(score - best.score) <= eps) {
        const d1 = Math.abs(profit - targetProfit);
        const d2 = Math.abs(best.profit - targetProfit);
        if (d1 < d2 - eps) best = { sA, sB, total, profit, minReturn, actualRoi, score };
        else if (Math.abs(d1 - d2) <= eps) {
          if (total < best.total) best = { sA, sB, total, profit, minReturn, actualRoi, score };
        }
      }
    }
  }

  return best;
}

function buildHtml(payload, W, H, format) {
  const wrapper = payload.arb
    ? payload
    : { arb: payload, meta: payload.meta ?? {}, brand: payload.brand ?? {} };
  const { arb, meta = {}, brand = {} } = wrapper;

  const roi = fmtRoi(arb.roi);
  const sport = escapeHtml(arb.sport ?? "");
  const league = escapeHtml(arb.league ?? "");
  const event = escapeHtml(arb.event ?? "");
  const market = escapeHtml(arb.market ?? "");
  const line = escapeHtml(arb.line ?? "");

  const lastUpdatedText = escapeHtml(meta.lastUpdatedText ?? "");
  const url = escapeHtml(brand.url ?? "arb-arena.com");

  const eventDateRaw = arb?.date ?? "";
  const eventDateText = escapeHtml(eventDateRaw ? String(eventDateRaw) : "");

  const legs = Array.isArray(arb.legs) ? arb.legs.slice(0, 2) : [];
  while (legs.length < 2) legs.push({ side: "", line: "", odds: "", bookie: "", bookieKey: "" });

  const roundStep = Number(meta.roundStep ?? 5) || 5;
  const targetProfit = Number(meta.targetProfit ?? 20) || 20;
  const profitWindow = Number(meta.profitWindow ?? 10) || 10;

  const bestStakes = findBestRoundedStakes({
    oddsA: legs[0]?.odds,
    oddsB: legs[1]?.odds,
    targetProfit,
    profitWindow,
    step: roundStep,
  });

  const exampleLine = bestStakes
    ? `Example stakes: <strong>${escapeHtml(legs[0]?.bookie ?? "Bookie A")} $${bestStakes.sA}</strong> • <strong>${escapeHtml(legs[1]?.bookie ?? "Bookie B")} $${bestStakes.sB}</strong>`
    : "";

  const lockedProfitLine = bestStakes ? `Locked profit: <strong>$${money(bestStakes.profit, 2)}</strong>` : "";

  const brandLogo = resolveBrandLogo();
  const brandLogoHtml = brandLogo
    ? `<img class="brandLogoImg" src="${brandLogo}" alt="Arb Arena logo" />`
    : `<div class="brandLogoFallback">A</div>`;

  const isSquare = format === "square";

  const PAD = isSquare ? 34 : 40;
  const OUTER_RADIUS = 32;

  const titleSize = isSquare ? 54 : 56;
  const roiSize = isSquare ? 42 : 44;
  const eventSize = isSquare ? 44 : 46;
  const metaSize = isSquare ? 30 : 30;
  const marketSize = isSquare ? 30 : 30;

  const cardMinH = isSquare ? 290 : 300;
  const logoSize = isSquare ? 80 : 84;
  const pickSize = isSquare ? 32 : 34;
  const oddsSize = isSquare ? 44 : 46;

  const footerDisclaimer = isSquare ? 18 : 18;
  const footerSite = isSquare ? 40 : 40;

  const impliedEdge = calcImpliedEdgePct(legs[0]?.odds, legs[1]?.odds);
  const impliedEdgeText =
    impliedEdge === null ? "" : `${impliedEdge >= 0 ? "+" : ""}${impliedEdge.toFixed(2)}%`;

  const legCards = legs
    .map((leg) => {
      const side = escapeHtml(leg.side ?? "");
      const lline = escapeHtml(leg.line ?? "");
      const odds = escapeHtml(fmtOdds(leg.odds));
      const bookie = escapeHtml(leg.bookie ?? "");
      const bookieKey = String(leg.bookieKey ?? "").toLowerCase();

      const logo = resolveBookieLogo(bookieKey);

      const logoBlock = logo
        ? `<img class="bookieLogo" src="${logo}" alt="${bookie} logo" />`
        : `<div class="bookieFallback">${escapeHtml(initials(leg.bookie ?? ""))}</div>`;

      const colorHex = leg.bookieColor || BOOKIE_COLORS[bookieKey] || "#3b82f6";
      const glowA = cssRgba(colorHex, 0.26);
      const glowB = cssRgba(colorHex, 0.10);
      const tint = cssRgba(colorHex, 0.25);

      return `
        <div class="legCard" style="--glowA:${glowA}; --glowB:${glowB}; --tint:${tint};">
          <div class="legHeader">
            <div class="bookieRow">
              ${logoBlock}
              <div class="bookieMeta">
                <div class="bookieName">${bookie}</div>
                <div class="pick">${side}${lline ? `<span class="dot">•</span><span class="line">${lline}</span>` : ``}</div>
              </div>
            </div>
          </div>

          <div class="oddsArea">
            <div class="oddsPill">${odds}</div>
            <div class="oddsLabel">ODDS</div>
          </div>
        </div>
      `;
    })
    .join("\n");

  const marketRowHtml = line
    ? `Market: ${market} <span class="pillDot">•</span> Line ${line}`
    : `Market: ${market}`;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    :root{
      --bg: #0b1220;
      --bg2:#0a1020;
      --text:#e5e7eb;
      --muted:#94a3b8;
      --accent:#2563eb;
      --accent2:#3b82f6;
      --border: rgba(255,255,255,0.12);
    }
    *{ box-sizing:border-box; }
    html, body{ width:${W}px; height:${H}px; margin:0; }
    body{
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      color: var(--text);
      background-color: var(--bg);
      background-image:
        radial-gradient(1200px 700px at 18% -10%, rgba(37,99,235,0.22), transparent 60%),
        radial-gradient(900px 700px at 92% 8%, rgba(59,130,246,0.14), transparent 60%),
        linear-gradient(180deg, var(--bg) 0%, var(--bg2) 100%);
      background-repeat:no-repeat;
      background-size:cover;
    }

    .frame{ width:${W}px; height:${H}px; padding:${PAD}px; }

    .outer{
      height:100%;
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(255,255,255,0.055);
      border-radius: ${OUTER_RADIUS}px;
      padding: 28px;
      display:flex;
      flex-direction:column;
      gap: 18px;
      box-shadow: 0 18px 56px rgba(0,0,0,0.40);
      position:relative;
      overflow:hidden;
    }

    .header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 16px;
    }
    .brand{
      display:flex;
      align-items:center;
      gap: 14px;
      min-width:0;
    }
    .brandLogo{
      width: 72px; height: 72px;
      border-radius: 22px;
      overflow:hidden;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.06);
      display:flex; align-items:center; justify-content:center;
      flex:0 0 auto;
    }
    .brandLogoImg{ width:72px; height:72px; object-fit:cover; border-radius:22px; }
    .brandLogoFallback{
      width:72px; height:72px; border-radius:22px;
      display:flex; align-items:center; justify-content:center;
      background: linear-gradient(180deg, var(--accent2), var(--accent));
      color:#fff; font-weight:950; font-size:30px;
    }
    .brandText{ min-width:0; }
    .brandName{
      font-size: 38px;
      font-weight: 950;
      letter-spacing:-0.03em;
      line-height:1.0;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      max-width: 520px;
    }
    .brandTag{
      margin-top: 8px;
      font-size: 14px;
      font-weight: 950;
      color: rgba(148,163,184,0.95);
      letter-spacing: 0.22em;
    }

    .updatedBox{
      display:flex;
      flex-direction:column;
      align-items:flex-end;
      gap: 8px;
      flex: 0 0 auto;
      min-width: 320px;
    }
    .updated{
      font-size: 24px;
      font-weight: 750;
      color: rgba(148,163,184,0.95);
      white-space:nowrap;
    }

    .titleBlock{
      text-align:center;
      margin-top: 2px;
    }
    .title{
      font-size:${titleSize}px;
      font-weight: 950;
      letter-spacing:-0.03em;
      line-height:1.02;
      margin-top: 10px;
    }

    .roiBand{
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
      margin-top: 12px;
    }
    .roiBand::before{
      content:"";
      position:absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 4px;
      transform: translateY(-50%);
      background: linear-gradient(90deg,
        rgba(255,255,255,0.06),
        rgba(59,130,246,0.32),
        rgba(255,255,255,0.06)
      );
      border-radius: 999px;
    }
    .roiPill{
      position:relative;
      z-index:1;
      padding: 18px 28px;
      border-radius: 999px;
      background: linear-gradient(180deg, var(--accent2), var(--accent));
      border: 1px solid rgba(255,255,255,0.42);
      box-shadow:
        0 18px 52px rgba(37,99,235,0.48),
        0 0 46px rgba(59,130,246,0.38),
        0 0 0 1px rgba(255,255,255,0.12) inset;
      color:#fff;
      font-weight: 950;
      font-size:${roiSize}px;
      letter-spacing:-0.02em;
      white-space:nowrap;
    }
    .roiPill::before{
      content:"";
      position:absolute;
      inset:-18px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(59,130,246,0.35), transparent 60%);
      filter: blur(10px);
      z-index:-1;
    }

    .eventInfo{
      text-align:center;
      display:flex;
      flex-direction:column;
      gap: 10px;
      padding: 0 10px;
    }
    .eventName{
      font-size:${eventSize}px;
      font-weight: 950;
      letter-spacing:-0.03em;
      line-height:1.05;
      margin: 0;
    }
    .metaRow{
      font-size:${metaSize}px;
      font-weight: 850;
      color: rgba(148,163,184,0.95);
      display:flex;
      justify-content:center;
      gap: 14px;
      flex-wrap:wrap;
    }
    .pillDot{ color: rgba(148,163,184,0.75); }
    .marketRow{
      font-size:${marketSize}px;
      font-weight: 800;
      color: rgba(226,232,240,0.92);
    }

    .legs{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 6px;
      flex: 1;
      align-content:start;
    }

    .legCard{
      position:relative;
      border-radius: 30px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.055);
      padding: 20px;
      min-height:${cardMinH}px;
      overflow:hidden;
    }
    .legCard::before{
      content:"";
      position:absolute;
      inset:-60px;
      background:
        radial-gradient(560px 340px at 28% 22%, var(--glowA), transparent 62%),
        radial-gradient(720px 380px at 72% 78%, var(--glowB), transparent 62%);
      filter: blur(14px);
      pointer-events:none;
    }
    .legCard::after{
      content:"";
      position:absolute;
      inset:0;
      border-radius: 30px;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.07) inset,
        0 0 0 1px var(--tint);
      opacity: 0.55;
      pointer-events:none;
    }

    .bookieRow{
      position:relative;
      z-index:1;
      display:flex;
      gap: 16px;
      align-items:center;
      min-width:0;
    }
    .bookieLogo{
      width:${logoSize}px;
      height:${logoSize}px;
      border-radius: 22px;
      object-fit: cover;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.04);
      flex: 0 0 auto;
    }
    .bookieFallback{
      width:${logoSize}px;
      height:${logoSize}px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.12);
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight: 950;
      font-size: 22px;
      color: rgba(255,255,255,0.95);
      flex: 0 0 auto;
    }

    .bookieMeta{ min-width:0; }
    .bookieName{
      font-size: 30px;
      font-weight: 950;
      letter-spacing:-0.02em;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      max-width: 430px;
    }
    .pick{
      margin-top: 10px;
      font-size:${pickSize}px;
      font-weight: 950;
      letter-spacing:-0.02em;
      line-height:1.12;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      max-width: 430px;
    }
    .dot{ color: rgba(148,163,184,0.85); margin: 0 12px; }
    .line{ color: rgba(226,232,240,0.92); }

    .oddsArea{
      position:absolute;
      left: 50%;
      bottom: 22px;
      transform: translateX(-50%);
      z-index:1;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap: 10px;
    }
    .oddsPill{
      padding: 18px 30px;
      border-radius: 999px;
      background: rgba(255,255,255,0.94);
      color:#0b1220;
      font-weight: 950;
      font-size:${oddsSize}px;
      border: 1px solid rgba(255,255,255,0.44);
      min-width: 230px;
      text-align:center;
    }
    .oddsLabel{
      font-size: 24px;
      font-weight: 950;
      letter-spacing: 0.28em;
      color: rgba(148,163,184,0.95);
    }

    .cta{
      text-align:center;
      margin-top: 6px;
      display:flex;
      flex-direction:column;
      gap: 10px;
    }
    .ctaLine{
      font-size: 28px;
      font-weight: 650;
      color: rgba(226,232,240,0.94);
    }
    .ctaLine2{
      font-size: 40px;
      font-weight: 650;
      color: rgba(226,232,240,0.94);
    }
    .cta strong{ color:#fff; font-weight: 950; }

    .footer{
      display:flex;
      justify-content:space-between;
      align-items:flex-end;
      gap: 16px;
      margin-top: auto;
      padding-top: 8px;
    }
    .disclaimer{
      color: rgba(148,163,184,0.95);
      font-size:${footerDisclaimer}px;
      line-height: 1.35;
      font-weight: 650;
      max-width: 760px;
    }
    .site{
      color: rgba(226,232,240,0.96);
      font-weight: 950;
      font-size:${footerSite}px;
      letter-spacing:-0.01em;
      white-space:nowrap;
    }
  </style>
</head>

<body>
  <div class="frame">
    <div class="outer">

      <div class="header">
        <div class="brand">
          <div class="brandLogo">${brandLogoHtml}</div>
          <div class="brandText">
            <div class="brandName">${escapeHtml(brand.name ?? "Arb Arena")}</div>
            <div class="brandTag">ARB ALERT</div>
          </div>
        </div>

        <div class="updatedBox">
          <div class="updated">${lastUpdatedText}</div>
        </div>
      </div>

      <div class="titleBlock">
        <h1 class="title">Arbitrage Opportunity!</h1>
        <div class="roiBand">
          <div class="roiPill">ROI ${roi}%</div>
        </div>
      </div>

      <div class="eventInfo">
        <p class="eventName">${event}</p>
        <div class="metaRow">
          <span>${sport}</span>
          <span class="pillDot">•</span>
          <span>${league}</span>
          ${
            eventDateText
              ? `<span class="pillDot">•</span><span>${eventDateText}</span>`
              : ``
          }
        </div>
        <div class="marketRow">${marketRowHtml}</div>
      </div>

      <div class="legs">
        ${legCards}
      </div>

      <div class="cta">
        ${
          bestStakes
            ? `<div class="ctaLine">${exampleLine}</div>
               <div class="ctaLine2">${lockedProfitLine}</div>`
            : `Bet on both to lock in a <strong>NET ${roi}%</strong> profit.`
        }
      </div>

      <div class="footer">
        <div class="disclaimer">Verify odds on bookmaker sites before placing. <br> Informational only. Odds can change quickly. 18+.</div>
        <div class="site">${url}</div>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}

async function main() {
  const inPath = arg("in");
  const outPath = arg("out", "out.png");
  const scale = Number(arg("scale", "2")) || 2;
  const format = (arg("format", "square") || "square").toLowerCase();

  const W = 1080;
  const H = format === "portrait" ? 1350 : 1080;

  if (!inPath) {
    console.error("Missing --in <file.json>");
    process.exit(1);
  }

  const payload = safeReadJson(inPath);
  const html = buildHtml(payload, W, H, format);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: clamp(scale, 1, 3),
  });

  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(140);
  await page.screenshot({ path: outPath, fullPage: false });
  await browser.close();

  console.log(`Saved: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
