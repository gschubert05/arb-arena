import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

function coerceISO(dstr) {
  if (typeof dstr !== 'string') return null;
  // e.g. "Sun 17 Aug 16:40"
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

const app = express();
app.use(helmet());
app.use(compression());
app.use(morgan('tiny'));

const WEB_DIR = path.join(__dirname, '..', 'web');
const DATA_FILE = path.join(__dirname, 'data', 'opportunities.json');

app.use(express.static(WEB_DIR));

// Utility: load JSON (shape: { lastUpdated, items: [...] })
async function loadData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // backward-compat: old flat arrays
      return { lastUpdated: null, items: parsed };
    }
    return parsed;
  } catch (e) {
    return { lastUpdated: null, items: [] };
  }
}

app.get('/api/opportunities', async (req, res) => {
  const { sport = '', competitionId = '', dateFrom = '', dateTo = '', minRoi = '0', sortBy = 'roi', sortDir = 'desc', page = '1', pageSize = '50' } = req.query;

  const { lastUpdated, items } = await loadData();

  for (const it of items) {
    if (!it.dateISO && it.date) {
      const iso = coerceISO(it.date);
      if (iso) it.dateISO = iso;
    }
  }
  
  // Normalize types
  const mRoi = Number(minRoi) || 0;
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(500, Math.max(1, Number(pageSize) || 50));

  // Filter
  let filtered = items.filter(it => {
    const roiOk = (Number(it.roi) || 0) >= mRoi / 100; // minRoi is %
    const sportOk = !sport || (it.sport || '').toLowerCase() === sport.toLowerCase();
    const compOk = !competitionId || String(it.competitionid || it.competitionId) === String(competitionId);
    const dfOk = !dateFrom || (it.dateISO && it.dateISO >= dateFrom);
    const dtOk = !dateTo || (it.dateISO && it.dateISO <= dateTo);
    return roiOk && sportOk && compOk && dfOk && dtOk;
  });

  // Sort
  const dir = sortDir === 'asc' ? 1 : -1;
  const key = (a) => {
    switch (sortBy) {
      case 'dateISO': return a.dateISO || '';
      case 'sport': return (a.sport || '').toLowerCase();
      case 'roi': return Number(a.roi) || 0;
      default: return Number(a.roi) || 0;
    }
  };
  filtered.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * dir);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / ps));
  const start = (p - 1) * ps;
  const pageItems = filtered.slice(start, start + ps);

  // meta (unique lists for dropdowns)
  const sports = [...new Set(items.map(i => i.sport).filter(Boolean))].sort();
  const competitionIds = [...new Set(items.map(i => i.competitionid || i.competitionId).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));

  res.json({ items: pageItems, total, page: p, pages, lastUpdated, sports, competitionIds });
});

// Fallback to index.html for the web UI
app.get('*', (req, res) => {
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on http://localhost:${PORT}`));