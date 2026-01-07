// server/index.js
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import pg from 'pg';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// --- GitHub Actions trigger config ---
const GH_OWNER = process.env.GH_OWNER || "gschubert05";
const GH_REPO  = process.env.GH_REPO  || "arb-arena";
const GH_WORKFLOW_FILE = process.env.GH_WORKFLOW_FILE || "scrape-fast.yml";
const GH_TOKEN = process.env.GH_TOKEN || "";
let lastManualTs = 0;
const COOLDOWN_MS = (Number(process.env.REQUEST_COOLDOWN_SEC) || 180) * 1000;

// --- Postgres pool ---
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Ensure the opportunities table exists (runs on startup)
async function ensureSchema() {
  const sql = `
    CREATE TABLE IF NOT EXISTS opportunities (
      id          SERIAL PRIMARY KEY,
      data        JSONB NOT NULL,
      scraped_at  TIMESTAMPTZ DEFAULT now()
    );
  `;
  try {
    await pool.query(sql);
    console.log('[db] ensured opportunities table exists');
  } catch (err) {
    console.error('[db] error ensuring schema:', err);
  }
}

// Kick it off (no shell needed)
ensureSchema();

// --- App + paths ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan('tiny'));

const WEB_DIR = path.join(__dirname, '..', 'web');

// Main data (opportunities)
const DATA_FILE = path.join(__dirname, 'data', 'opportunities.json');
const DATA_URL = process.env.DATA_URL ?? ''; // if set, fetch from URL; otherwise read local file

// Active compids + leagues
const ACTIVE_JSON_PATH = process.env.ACTIVE_JSON_PATH || path.join(__dirname, 'data', 'active_comp_ids.json');
// If not provided, we will try to derive from DATA_URL by swapping the filename:
const ACTIVE_JSON_URL  = process.env.ACTIVE_JSON_URL || '';

function deriveActiveUrlFromDataUrl(dataUrl) {
  if (!dataUrl) return '';
  try {
    const u = new URL(dataUrl);
    const parts = u.pathname.split('/');
    parts[parts.length - 1] = 'active_comp_ids.json';
    u.pathname = parts.join('/');
    return u.toString();
  } catch {
    return '';
  }
}

// --- Caches ---
let dataCache   = { ts: 0, data: { lastUpdated: null, items: [] } };
let activeCache = { ts: 0, data: null };

// --- robust fetch with timeout + retries, fallback to cache/local ---
async function fetchWithRetry(url, { attempts = 3, timeoutMs = 5000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        cache: 'no-store',
        signal: ac.signal,
        headers: { 'User-Agent': 'arb-arena/1.0 (+server)' },
      });
      clearTimeout(t);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      const backoff = Math.min(2000 * Math.pow(2, i), 8000) + Math.random() * 250;
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

// --- helpers ---
function toStrId(x) { return String(x ?? '').trim(); }

// Very tolerant mapper: accepts several shapes and tries to build { compid -> leagueName }
function resolveLeagueMap(json) {
  if (!json || typeof json !== 'object') return {};

  // 1) { leagues_by_compid: { "15": "NFL", ... } }
  if (json.leagues_by_compid && typeof json.leagues_by_compid === 'object') {
    return json.leagues_by_compid;
  }

  // 2) top-level object of id->name
  if (!Array.isArray(json)) {
    const vals = Object.values(json);
    if (vals.length && vals.every(v => typeof v === 'string')) return json;
  }

  const out = {};

  // 3) arrays of objects: items/competitions/active/rows etc.
  const candidates = [
    json.items, json.competitions, json.active, json.rows, json.data, json.list, json.leagues
  ].filter(Array.isArray);

  // also allow the json *itself* to be an array
  if (Array.isArray(json)) candidates.push(json);

  for (const arr of candidates) {
    for (const r of arr) {
      if (!r || typeof r !== 'object') continue;
      const id = toStrId(r.competitionid ?? r.competitionId ?? r.id ?? r.compid ?? r.cid);
      const name = r.league ?? r.name ?? r.league_name ?? r.title ?? '';
      if (id && name) out[id] = name;
    }
  }

  // 4) arrays like [["15","NFL"],["16","NBA"]] or [[15,"NFL"],...]
  const pairish = candidates.find(a =>
    Array.isArray(a) && a.length && Array.isArray(a[0]) && a[0].length >= 2
  );
  if (pairish) {
    for (const row of pairish) {
      const id = toStrId(row[0]);
      const name = row[1];
      if (id && typeof name === 'string' && name) out[id] = name;
    }
  }

  return out;
}

function cleanAgency(name) {
  if (!name) return '';
  let out = String(name).split('(')[0];
  out = out.split('-')[0];
  return out.trim();
}

function getAestYearMonth() {
  // AEST (Brisbane) year + month index (0-11)
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const get = (t) => parts.find(p => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")) - 1,
  };
}

function isLiveishDate(dstr) {
  if (typeof dstr !== 'string') return false;
  const s = dstr.toLowerCase();
  // website uses these when game is about to start / underway
  return /\bto go\b/.test(s) || /\bago\b/.test(s);
}

function requiredLeftOdds(bestRight) {
  const br = Number(bestRight);
  if (!(br > 1)) return Infinity;
  return 1 / (1 - 1 / br);
}
function requiredRightOdds(bestLeft) {
  const bl = Number(bestLeft);
  if (!(bl > 1)) return Infinity;
  return 1 / (1 - 1 / bl);
}

function shouldDropBet365Glitch(it) {
  const rows = it?.book_table?.rows || [];
  if (!rows.length) return false;

  const bestLAgency = cleanAgency(it?.book_table?.best?.left?.agency || '').toLowerCase();
  const bestRAgency = cleanAgency(it?.book_table?.best?.right?.agency || '').toLowerCase();

  // Only care when bet365 is actually the best on a side
  const betIsBestLeft  = bestLAgency === 'bet365';
  const betIsBestRight = bestRAgency === 'bet365';
  if (!betIsBestLeft && !betIsBestRight) return false;

  // Count unique agencies in table
  const agencies = rows
    .map(r => cleanAgency(r?.agency || '').toLowerCase())
    .filter(Boolean);
  const uniq = new Set(agencies);
  const n = uniq.size;

  // Your explicit rule: if only 2 bookies showing odds, ignore it
  if (n <= 2) return true;

  const bestLeftOdds  = Number(it?.book_table?.best?.left?.odds);
  const bestRightOdds = Number(it?.book_table?.best?.right?.odds);
  if (!(bestLeftOdds > 1 && bestRightOdds > 1)) return false;

  const needL = requiredLeftOdds(bestRightOdds);
  const needR = requiredRightOdds(bestLeftOdds);

  const leftProfitable  = new Set();
  const rightProfitable = new Set();

  for (const r of rows) {
    const a = cleanAgency(r?.agency || '').toLowerCase();
    if (!a) continue;

    const lo = Number(r?.left);
    const ro = Number(r?.right);

    if (lo >= needL) leftProfitable.add(a);
    if (ro >= needR) rightProfitable.add(a);
  }

  const halfOrMore = Math.ceil(n / 2);

  // If bet365 is the ONLY profitable bookie on its side,
  // and half+ of bookies are profitable on the other side, drop it.
  if (betIsBestLeft) {
    const onlyBet365OnLeft = leftProfitable.size === 1 && leftProfitable.has('bet365');
    if (onlyBet365OnLeft && rightProfitable.size >= halfOrMore) return true;
  }

  if (betIsBestRight) {
    const onlyBet365OnRight = rightProfitable.size === 1 && rightProfitable.has('bet365');
    if (onlyBet365OnRight && leftProfitable.size >= halfOrMore) return true;
  }

  return false;
}

const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
function coerceISO(dstr) {
  if (typeof dstr !== 'string') return null;
  const m = dstr.match(/^\w{3}\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon == null) return null;

  // ✅ only change: choose year using AEST month rule
  const nowAest = getAestYearMonth();
  const year = (mon < nowAest.month) ? (nowAest.year + 1) : nowAest.year;

  const d = new Date(Date.UTC(year, mon, day, 0, 0, 0));
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function coerceKickoffISO(dstr) {
  if (typeof dstr !== 'string') return null;
  const m = dstr.match(/^\w{3}\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].toLowerCase()];
  const hh = parseInt(m[3], 10);
  const mi = parseInt(m[4], 10);
  if (mon == null) return null;

  // ✅ only change: choose year using AEST month rule
  const nowAest = getAestYearMonth();
  const year = (mon < nowAest.month) ? (nowAest.year + 1) : nowAest.year;

  const d = new Date(Date.UTC(year, mon, day, hh, mi, 0));
  return d.toISOString(); // unchanged (still Z, same as before)
}

// --- loaders (URL-or-local, with cache & fallback) ---
async function loadData() {
  if (!DATA_URL) {
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? { lastUpdated: null, items: parsed } : parsed;
    } catch {
      return { lastUpdated: null, items: [] };
    }
  }
  const now = Date.now();
  if (now - dataCache.ts < 60_000 && dataCache.data) return dataCache.data;
  try {
    const json = await fetchWithRetry(DATA_URL, { attempts: 4, timeoutMs: 6000 });
    const normalized = json.items ? json : { lastUpdated: null, items: json };
    dataCache = { ts: now, data: normalized };
    return normalized;
  } catch {
    if (dataCache.data && dataCache.data.items) return dataCache.data;
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed) ? { lastUpdated: null, items: parsed } : parsed;
      dataCache = { ts: now, data: normalized };
      return normalized;
    } catch {
      return { lastUpdated: null, items: [] };
    }
  }
}

async function loadActive() {
  // priority: ACTIVE_JSON_URL -> derived from DATA_URL -> local file
  const derivedUrl = deriveActiveUrlFromDataUrl(DATA_URL);
  const tryUrls = [ACTIVE_JSON_URL, derivedUrl].filter(Boolean);

  const now = Date.now();
  if (now - activeCache.ts < 60_000 && activeCache.data) return activeCache.data;

  // Try URLs first
  for (const url of tryUrls) {
    try {
      const json = await fetchWithRetry(url, { attempts: 4, timeoutMs: 6000 });
      activeCache = { ts: now, data: json };
      return json;
    } catch {
      // continue
    }
  }

  // Fallback: local file
  try {
    const raw = await fs.readFile(ACTIVE_JSON_PATH, 'utf8');
    const json = JSON.parse(raw);
    activeCache = { ts: now, data: json };
    return json;
  } catch {
    return {};
  }
}

// --- static web ---
app.use(express.static(WEB_DIR, {etag: true, lastModified: true, cacheControl: false, index: false }));

// --- multi-page shell (marketing + app) ---
app.set('trust proxy', 1);

const MARKETING_INDEX = path.join(WEB_DIR, 'index.html');
const APP_INDEX = path.join(WEB_DIR, 'app.html');

function wantsAppHost(req) {
  const hostHeader = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
  const host = hostHeader.split(',')[0].trim().split(':')[0].toLowerCase();
  return host.startsWith('app.');
}

// Root: marketing on www/root, app on app subdomain
app.get('/', (req, res) => {
  return res.sendFile(wantsAppHost(req) ? APP_INDEX : MARKETING_INDEX);
});

// App route for same-domain usage (e.g., www -> /app)
app.get('/app', (req, res) => res.sendFile(APP_INDEX));
app.get('/app/*', (req, res) => res.sendFile(APP_INDEX));

// Simple content pages
app.get('/about', (req, res) => res.sendFile(path.join(WEB_DIR, 'about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(WEB_DIR, 'contact.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(WEB_DIR, 'terms.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(WEB_DIR, 'privacy.html')));
app.get('/disclaimer', (req, res) => res.sendFile(path.join(WEB_DIR, 'disclaimer.html')));


// --- debug route (where you tested; keep both spellings to be safe) ---
async function debugLeagues(req, res) {
  const derivedUrl = deriveActiveUrlFromDataUrl(DATA_URL);
  const src = ACTIVE_JSON_URL
    ? { source: 'url', url: ACTIVE_JSON_URL }
    : (derivedUrl ? { source: 'derived', url: derivedUrl } : { source: 'file', path: ACTIVE_JSON_PATH });

  const active = await loadActive();
  const map = resolveLeagueMap(active);

  res.json({
    ...src,
    keys: Object.keys(map).length,
    sample: Object.entries(map).slice(0, 10),
    topLevelKeys: active && typeof active === 'object' ? Object.keys(active).slice(0, 10) : [],
  });
}
app.get('/api/_debug/leagues', debugLeagues);
app.get('/api/_debug_leagues', debugLeagues); // your earlier path

// --- API: opportunities ---
app.get('/api/opportunities', async (req, res) => {
  // 1) Load items from Postgres
  let items = [];
  let lastUpdated = null;

  try {
    const result = await pool.query('SELECT data, scraped_at FROM opportunities');
    items = result.rows.map(r => r.data);

    if (result.rows.length > 0) {
      const latest = result.rows.reduce((max, r) => {
        const t = r.scraped_at ? new Date(r.scraped_at).getTime() : 0;
        return t > max ? t : max;
      }, 0);
      if (latest > 0) {
        lastUpdated = new Date(latest).toISOString();
      }
    }
  } catch (e) {
    console.error('DB error loading opportunities', e);
    return res.json({
      ok: false,
      lastUpdated: null,
      total: 0,
      page: 1,
      pages: 1,
      sports: [],
      competitionIds: [],
      leagues: [],
      agencies: [],
      items: []
    });
  }

  // 2) Load active leagues (same as before)
  const active = await loadActive();
  const leagueMap = resolveLeagueMap(active);

  const {
    sports = '',
    sport = '',
    competitionIds = '',
    competitionId = '',
    leagues = '',
    dateFrom = '',
    dateTo = '',
    minRoi = '0',
    sortBy = 'roi',
    sortDir = 'desc',
    page = '1',
    pageSize = '50',
    bookies = '',
  } = req.query;

  for (const it of items) {
    if (!it.dateISO && it.date) {
      const iso = coerceISO(it.date);
      if (iso) it.dateISO = iso;
    }
    if (!it.kickoff && it.date) {
      const k = coerceKickoffISO(it.date);
      if (k) it.kickoff = k;
    }
  }

  const mRoi = Number(minRoi) || 0;
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(500, Math.max(1, Number(pageSize) || 50));

  const toLowerSet = (csv) =>
    new Set(String(csv || '').split(',').map(s => s.trim()).filter(Boolean).map(s => s.toLowerCase()));
  const toIdSet = (csv) => new Set(String(csv || '').split(',').map(s => s.trim()).filter(Boolean));

  const sportSet  = (sports ? toLowerSet(sports) : toLowerSet(sport));
  const compSet   = (competitionIds ? toIdSet(competitionIds) : toIdSet(competitionId));
  const bookSet   = toLowerSet(bookies);
  const leagueSet = new Set(String(leagues || '').split(',').map(s => s.trim()).filter(Boolean));

  const clean = (s) => (s || '').trim().toLowerCase();

  let base = (items || []).filter((it) => {
    const rows = it.book_table?.rows || [];
    const bestL = clean(it.book_table?.best?.left?.agency || '');
    const bestR = clean(it.book_table?.best?.right?.agency || '');
    const anyBookmaker = bestL === 'bookmaker' || bestR === 'bookmaker' || rows.some(r => clean(r?.agency) === 'bookmaker');
    if (anyBookmaker) return false;

    // drop "to go" / "ago" timestamps (in-play / near start)
    if (isLiveishDate(it.date)) return false;

    // drop suspected bet365 glitch arbs
    if (shouldDropBet365Glitch(it)) return false;

    const L = it.book_table?.best?.left?.odds;
    const R = it.book_table?.best?.right?.odds;
    if (Number.isFinite(L) && Number.isFinite(R) && L > 0 && R > 0) {
      const mktPct = (1 / L + 1 / R) * 100;
      if (!Number.isFinite(mktPct) || mktPct >= 100) return false;
      it.market_percentage = Math.round(mktPct * 100) / 100;
      it.roi = Math.round(((1 / (mktPct / 100)) - 1) * 1e6) / 1e6;
    }
    return true;
  });

  // attach league
  for (const it of base) {
    const compId = toStrId(it.competitionid ?? it.competitionId ?? '');
    it.league = leagueMap[compId] || null;
  }

  let filtered = base.filter(it => {
    const roiOk = (Number(it.roi) || 0) >= mRoi / 100;
    const s = (it.sport || '').toLowerCase();
    const sportOk = sportSet.size === 0 || sportSet.has(s);
    const cid = toStrId(it.competitionid ?? it.competitionId ?? '');
    const compOk = compSet.size === 0 || compSet.has(cid);
    const dfOk = !dateFrom || (it.dateISO && it.dateISO >= dateFrom);
    const dtOk = !dateTo || (it.dateISO && it.dateISO <= dateTo);

    let bookOk = true;
    if (bookSet.size > 0) {
      const leftA = cleanAgency(it.book_table?.best?.left?.agency || '').toLowerCase();
      const rightA = cleanAgency(it.book_table?.best?.right?.agency || '').toLowerCase();
      bookOk = !!(leftA && rightA && bookSet.has(leftA) && bookSet.has(rightA));
    }

    const leagueOk = leagueSet.size === 0 ? true : (it.league && leagueSet.has(it.league));
    return roiOk && sportOk && compOk && dfOk && dtOk && bookOk && leagueOk;
  });

  const dir = sortDir === 'asc' ? 1 : -1;
  const key = (a) => {
    switch (sortBy) {
      case 'dateISO': return a.dateISO || '';
      case 'kickoff': return a.kickoff || '';
      case 'sport':   return (a.sport || '').toLowerCase();
      case 'league':  return (a.league || '').toLowerCase();
      case 'roi':
      default:        return Number(a.roi) || 0;
    }
  };
  filtered.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * dir);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / ps));
  const start = (p - 1) * ps;
  const pageItems = filtered.slice(start, start + ps);

  const sportsList = [...new Set(base.map(i => i.sport).filter(Boolean))].sort((a,b)=>(a||'').localeCompare(b||''));
  const competitionIdsList = [...new Set(base.map(i => i.competitionid || i.competitionId).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  const leaguesList = [...new Set(base.map(i => i.league).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

  const agenciesSet = new Set();

  for (const it of base) {
    // 1) Add ALL agencies present in the odds table rows (this is the key fix)
    const rows = it.book_table?.rows || [];
    for (const row of rows) {
      const a = cleanAgency(row?.agency || '');
      if (a) agenciesSet.add(a);
    }

    // 2) Also keep the best sides (harmless redundancy)
    const l = cleanAgency(it.book_table?.best?.left?.agency || '');
    const r = cleanAgency(it.book_table?.best?.right?.agency || '');
    if (l) agenciesSet.add(l);
    if (r) agenciesSet.add(r);
  }

  const agencies = [...agenciesSet].sort((a,b)=>a.localeCompare(b));

  res.json({
    ok: true,
    lastUpdated,
    total,
    page: p,
    pages,
    sports: sportsList,
    competitionIds: competitionIdsList, // still available if you want to use IDs
    leagues: leaguesList,               // names (what app.js uses)
    agencies,
    items: pageItems
  });
});

// --- API: trigger GitHub Actions scrape ---
app.post('/api/trigger-scrape', express.json(), async (req, res) => {
  if (!GH_TOKEN) return res.status(500).json({ ok:false, error: "Server missing GH_TOKEN" });

  const now = Date.now();
  if (now - lastManualTs < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - lastManualTs))/1000);
    return res.status(429).json({ ok:false, error:`Please wait ${wait}s before requesting again.` });
  }

  try {
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${encodeURIComponent(GH_WORKFLOW_FILE)}/dispatches`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: 'main' })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(500).json({ ok:false, error:`GitHub API ${resp.status}: ${text}` });
    }

    lastManualTs = now;
    dataCache.ts = 0;
    activeCache.ts = 0;
    res.json({ ok:true, message:'Scrape requested.' });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
});

// --- fallback ---
// Don't serve HTML for asset-like paths (prevents /styles.css returning index.html)
app.get('*', (req, res, next) => {
  // If path includes a dot, it's likely an asset (/styles.css, /logo.svg, /app.js, etc.)
  if (req.path.includes('.')) return res.status(404).end();

  // If someone hits a random path on app. subdomain, show the app.
  // Otherwise, show the marketing homepage.
  return res.sendFile(wantsAppHost(req) ? APP_INDEX : MARKETING_INDEX);
});

// --- start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const derivedUrl = deriveActiveUrlFromDataUrl(DATA_URL);
  const activeSrc = ACTIVE_JSON_URL ? `URL: ${ACTIVE_JSON_URL}` : (derivedUrl ? `derived URL: ${derivedUrl}` : `file: ${ACTIVE_JSON_PATH}`);
  const dataSrc   = DATA_URL ? `URL: ${DATA_URL}` : `file: ${DATA_FILE}`;
  console.log(`Web server running on http://localhost:${PORT}`);
  console.log(`[opportunities] ${dataSrc}`);
  console.log(`[active_comp_ids] ${activeSrc}`);
});
