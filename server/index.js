// server/index.js
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// --- GitHub Actions trigger config ---
const GH_OWNER = process.env.GH_OWNER || "gschubert05";
const GH_REPO  = process.env.GH_REPO  || "arb-arena";
const GH_WORKFLOW_FILE = process.env.GH_WORKFLOW_FILE || "scrape-fast.yml"; // must match your file name in .github/workflows
const GH_TOKEN = process.env.GH_TOKEN || ""; // fine-grained PAT with Actions:write + Contents:read
let lastManualTs = 0; // simple cooldown
const COOLDOWN_MS = (Number(process.env.REQUEST_COOLDOWN_SEC) || 180) * 1000;

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
const ACTIVE_JSON_URL  = process.env.ACTIVE_JSON_URL || ''; // if set, fetch from URL; otherwise read local file

// --- Tiny caches ---
let cache = { ts: 0, data: { lastUpdated: null, items: [] } };
let activeCache = { ts: 0, data: null }; // holds the whole active_comp_ids.json

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

// Load opportunities (URL if provided, else local), with a small cache
async function loadData() {
  // If using local file, never fetch
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
  // serve cached within 60s to avoid hammering
  if (now - cache.ts < 60_000 && cache.data) return cache.data;

  try {
    const json = await fetchWithRetry(DATA_URL, { attempts: 4, timeoutMs: 6000 });
    const normalized = json.items ? json : { lastUpdated: null, items: json };
    cache = { ts: now, data: normalized };
    return normalized;
  } catch (err) {
    // Fallback: serve last cache or local file; never throw
    if (cache.data && cache.data.items) return cache.data;
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed) ? { lastUpdated: null, items: parsed } : parsed;
      cache = { ts: now, data: normalized };
      return normalized;
    } catch {
      return { lastUpdated: null, items: [] };
    }
  }
}

// Load active_comp_ids.json (URL if provided, else local), with a small cache
async function loadActive() {
  // If using local file, never fetch
  if (!ACTIVE_JSON_URL) {
    try {
      const raw = await fs.readFile(ACTIVE_JSON_PATH, 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  const now = Date.now();
  // serve cached within 60s to avoid hammering
  if (now - activeCache.ts < 60_000 && activeCache.data) return activeCache.data;

  try {
    const json = await fetchWithRetry(ACTIVE_JSON_URL, { attempts: 4, timeoutMs: 6000 });
    activeCache = { ts: now, data: json };
    return json;
  } catch (err) {
    // Fallback: serve last cache or local file; never throw
    if (activeCache.data) return activeCache.data;
    try {
      const raw = await fs.readFile(ACTIVE_JSON_PATH, 'utf8');
      const json = JSON.parse(raw);
      activeCache = { ts: now, data: json };
      return json;
    } catch {
      return {};
    }
  }
}

// --- helpers ---
function cleanAgency(name) {
  if (!name) return '';
  let out = String(name).split('(')[0];
  out = out.split('-')[0];
  return out.trim();
}
const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
function coerceISO(dstr) {
  if (typeof dstr !== 'string') return null;
  const m = dstr.match(/^\w{3}\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon == null) return null;
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), mon, day, 0, 0, 0));
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
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), mon, day, hh, mi, 0));
  return d.toISOString();
}

// --- static web ---
app.use(express.static(WEB_DIR, { etag: true, lastModified: true, cacheControl: false }));

// --- API: opportunities ---
app.get('/api/opportunities', async (req, res) => {
  // Load data + leagues
  let data;
  try {
    data = await loadData();
  } catch {
    data = { lastUpdated: null, items: [] };
  }
  const active = await loadActive();
  const leagueMap = active?.leagues_by_compid || {};

  const {
    sports = '',
    sport = '',
    competitionIds = '',
    competitionId = '',
    leagues = '',         // optional: allow league names as a param
    dateFrom = '',
    dateTo = '',
    minRoi = '0',
    sortBy = 'roi',
    sortDir = 'desc',
    page = '1',
    pageSize = '50',
    bookies = '',
  } = req.query;

  const { lastUpdated } = data;
  const items = Array.isArray(data.items) ? data.items : [];

  // Coerce dates
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

  // Multi: sports & leagues & compids
  const sportSet  = (sports ? toLowerSet(sports) : toLowerSet(sport));
  const compSet   = (competitionIds ? toIdSet(competitionIds) : toIdSet(competitionId));
  const bookSet   = toLowerSet(bookies);
  const leagueSet = new Set(String(leagues || '').split(',').map(s => s.trim()).filter(Boolean)); // optional (names)

  // ➊ Harden the source list before UI filters/pagination
  const clean = (s) => (s || '').trim().toLowerCase();

  let base = (items || []).filter((it) => {
    // Exclude any row where “Bookmaker” appears (best or any row)
    const rows = it.book_table?.rows || [];
    const bestL = clean(it.book_table?.best?.left?.agency || '');
    const bestR = clean(it.book_table?.best?.right?.agency || '');
    const anyBookmaker =
      bestL === 'bookmaker' ||
      bestR === 'bookmaker' ||
      rows.some(r => clean(r?.agency) === 'bookmaker');
    if (anyBookmaker) return false;

    // If best odds exist, recompute market%/ROI from freshest prices
    const L = it.book_table?.best?.left?.odds;
    const R = it.book_table?.best?.right?.odds;
    if (Number.isFinite(L) && Number.isFinite(R) && L > 0 && R > 0) {
      const mktPct = (1 / L + 1 / R) * 100;
      if (!Number.isFinite(mktPct) || mktPct >= 100) return false; // arb evaporated
      it.market_percentage = Math.round(mktPct * 100) / 100;
      it.roi = Math.round(((1 / (mktPct / 100)) - 1) * 1e6) / 1e6;
    }
    return true;
  });

  // Attach leagues to cleaned items
  for (const it of base) {
    const compId = String(it.competitionid || it.competitionId || '');
    it.league = leagueMap[compId] || null;
  }

  // Apply UI filters
  let filtered = base.filter(it => {
    const roiOk = (Number(it.roi) || 0) >= mRoi / 100;

    const s = (it.sport || '').toLowerCase();
    const sportOk = sportSet.size === 0 || sportSet.has(s);

    const cid = String(it.competitionid || it.competitionId || '');
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

  // Sort
  const dir = sortDir === 'asc' ? 1 : -1;
  const key = (a) => {
    switch (sortBy) {
      case 'dateISO': return a.dateISO || '';
      case 'kickoff': return a.kickoff || '';
      case 'sport': return (a.sport || '').toLowerCase();
      case 'league': return (a.league || '').toLowerCase();
      case 'roi':
      default: return Number(a.roi) || 0;
    }
  };
  filtered.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * dir);

  // Pagination
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / ps));
  const start = (p - 1) * ps;
  const pageItems = filtered.slice(start, start + ps);

  // Meta lists (built from base to reflect cleaned data)
  const sportsList = [...new Set(base.map(i => i.sport).filter(Boolean))]
    .sort((a,b)=>(a||'').localeCompare(b||''));
  const competitionIdsList = [...new Set(base.map(i => i.competitionid || i.competitionId).filter(Boolean))]
    .sort((a,b)=>Number(a)-Number(b));
  const leaguesList = [...new Set(base.map(i => i.league).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));
  const agenciesSet = new Set();
  for (const it of base) {
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
    competitionIds: competitionIdsList, // your UI still uses this param name for the leagues dropdown
    leagues: leaguesList,               // league names list (if your UI wants it directly)
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
    // Lightly bust the data cache so next fetch re-pulls soon
    cache.ts = 0;
    activeCache.ts = 0;
    res.json({ ok:true, message:'Scrape requested.' });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
});

// --- SPA fallback ---
app.get('*', (req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));

// --- start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on http://localhost:${PORT}`));
