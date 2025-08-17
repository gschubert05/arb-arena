// ESM server (server/index.js)
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet());
app.use(compression());
app.use(morgan('tiny'));

const WEB_DIR = path.join(__dirname, '..', 'web');
const DATA_FILE = path.join(__dirname, 'data', 'opportunities.json');

// --- Remote data support (GitHub raw) ---
const DATA_URL = process.env.DATA_URL ?? 'https://raw.githubusercontent.com/gschubert05/arb-arena/data/server/data/opportunities.json';
let cache = { ts: 0, data: { lastUpdated: null, items: [] } };

const GH_OWNER = process.env.GH_OWNER || "gschubert05";
const GH_REPO  = process.env.GH_REPO  || "arb-arena";
const GH_WORKFLOW_FILE = process.env.GH_WORKFLOW_FILE || "scrape.yml"; // must match your file name in .github/workflows
const GH_TOKEN = process.env.GH_TOKEN || ""; // fine-grained PAT with Actions:write + Contents:read

let lastManualTs = 0; // simple cooldown
const COOLDOWN_MS = (Number(process.env.REQUEST_COOLDOWN_SEC) || 180) * 1000;

async function loadData() {
  // If DATA_URL not set, read local file (dev)
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
  if (now - cache.ts < 60_000) return cache.data; // cache 60s

  const resp = await fetch(DATA_URL, { cache: 'no-store' });
  const json = await resp.json();
  const normalized = json.items ? json : { lastUpdated: null, items: json };
  cache = { ts: now, data: normalized };
  return normalized;
}

// --- Date fallback: coerce "Sun 17 Aug 16:40" -> "YYYY-MM-DD" (current year) ---
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

app.use(express.static(WEB_DIR));

app.get('/api/opportunities', async (req, res) => {
  const {
    sport = '',
    competitionId = '',
    dateFrom = '',
    dateTo = '',
    minRoi = '0',
    sortBy = 'roi',
    sortDir = 'desc',
    page = '1',
    pageSize = '50'
  } = req.query;

  const { lastUpdated, items } = await loadData();

  // derive dateISO if missing
  for (const it of items) {
    if (!it.dateISO && it.date) {
      const iso = coerceISO(it.date);
      if (iso) it.dateISO = iso;
    }
  }

  // normalize
  const mRoi = Number(minRoi) || 0;
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(500, Math.max(1, Number(pageSize) || 50));

  // filter
  let filtered = items.filter(it => {
    const roiOk = (Number(it.roi) || 0) >= mRoi / 100;
    const sportOk = !sport || (it.sport || '').toLowerCase() === sport.toLowerCase();
    const compOk = !competitionId || String(it.competitionid || it.competitionId) === String(competitionId);
    const dfOk = !dateFrom || (it.dateISO && it.dateISO >= dateFrom);
    const dtOk = !dateTo || (it.dateISO && it.dateISO <= dateTo);
    return roiOk && sportOk && compOk && dfOk && dtOk;
  });

  // sort
  const dir = sortDir === 'asc' ? 1 : -1;
  const key = (a) => {
    switch (sortBy) {
      case 'dateISO': return a.dateISO || '';
      case 'sport': return (a.sport || '').toLowerCase();
      case 'roi': default: return Number(a.roi) || 0;
    }
  };
  filtered.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * dir);

  // paginate
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / ps));
  const start = (p - 1) * ps;
  const pageItems = filtered.slice(start, start + ps);

  // meta lists
  const sports = [...new Set(items.map(i => i.sport).filter(Boolean))].sort();
  const competitionIds = [...new Set(items.map(i => i.competitionid || i.competitionId).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));

  res.json({ items: pageItems, total, page: p, pages, lastUpdated, sports, competitionIds });
});

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
      body: JSON.stringify({ ref: 'main' }) // or another branch if you deploy from a different branch
    });

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(500).json({ ok:false, error:`GitHub API ${resp.status}: ${text}` });
    }

    lastManualTs = now;
    res.json({ ok:true, message:'Scrape requested.' });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on http://localhost:${PORT}`));
