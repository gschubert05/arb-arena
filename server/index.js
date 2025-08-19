// server/index.js
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
const DATA_URL = process.env.DATA_URL ?? '';

let cache = { ts: 0, data: { lastUpdated: null, items: [] } };

async function loadData() {
  if (DATA_URL === '') {
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? { lastUpdated: null, items: parsed } : parsed;
    } catch { return { lastUpdated: null, items: [] }; }
  }
  const now = Date.now();
  if (now - cache.ts < 60_000 && cache.data) return cache.data;
  const resp = await fetch(DATA_URL, { cache: 'no-store' });
  const json = await resp.json();
  const normalized = json.items ? json : { lastUpdated: null, items: json };
  cache = { ts: now, data: normalized };
  return normalized;
}

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

app.use(express.static(WEB_DIR, { etag: true, lastModified: true, cacheControl: false }));

app.get('/api/opportunities', async (req, res) => {
  const {
    // CSV accepted for sports & competitionIds & bookies
    sports = '',
    sport = '',
    competitionIds = '',
    competitionId = '',
    dateFrom = '',
    dateTo = '',
    minRoi = '0',
    sortBy = 'roi',
    sortDir = 'desc',
    page = '1',
    pageSize = '50',
    bookies = '',
  } = req.query;

  const { lastUpdated, items } = await loadData();

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

  // Multi: sports & leagues
  const sportSet = (sports ? toLowerSet(sports) : toLowerSet(sport));
  const compSet  = (competitionIds ? toIdSet(competitionIds) : toIdSet(competitionId));
  const bookSet  = toLowerSet(bookies);

  let filtered = items.filter(it => {
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

    return roiOk && sportOk && compOk && dfOk && dtOk && bookOk;
  });

  const dir = sortDir === 'asc' ? 1 : -1;
  const key = (a) => {
    switch (sortBy) {
      case 'dateISO': return a.dateISO || '';
      case 'kickoff': return a.kickoff || '';
      case 'sport': return (a.sport || '').toLowerCase();
      case 'roi':
      default: return Number(a.roi) || 0;
    }
  };
  filtered.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * dir);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / ps));
  const start = (p - 1) * ps;
  const pageItems = filtered.slice(start, start + ps);

  const sportsList = [...new Set(items.map(i => i.sport).filter(Boolean))].sort((a,b)=>(a||'').localeCompare(b||''));
  const competitionIdsList = [...new Set(items.map(i => i.competitionid || i.competitionId).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  const agenciesSet = new Set();
  for (const it of items) {
    const l = cleanAgency(it.book_table?.best?.left?.agency || '');
    const r = cleanAgency(it.book_table?.best?.right?.agency || '');
    if (l) agenciesSet.add(l);
    if (r) agenciesSet.add(r);
  }
  const agencies = [...agenciesSet].sort((a,b)=>a.localeCompare(b));

  res.json({ items: pageItems, total, page: p, pages, lastUpdated, sports: sportsList, competitionIds: competitionIdsList, agencies });
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on http://localhost:${PORT}`));
