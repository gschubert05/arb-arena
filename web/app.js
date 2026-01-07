// ==== DIAGNOSTIC BANNER ====
console.log("ARB app.js build drop-in 2025-12-30-2");

// --- Theme (fixed to dark) ---
(() => {
  // App theme is fixed to dark
  document.documentElement.classList.add('dark');
  localStorage.setItem('theme', 'dark');
})();

// ONE consolidated style injection
(() => {
  const css = `
    /* --- Bookie chips (table) --- */
    .stack{display:flex;flex-direction:column;gap:10px}
    .bookie-chip{
      display:flex;align-items:center;justify-content:space-between;gap:10px;
      background:rgba(16,185,129,.12);
      border:1px solid rgba(16,185,129,.18);
      border-radius:14px;padding:8px 10px;
    }
    .dark .bookie-chip{ background: rgba(16,185,129,.16); border-color: rgba(16,185,129,.22); }
    .bookie-identity{ display:flex; align-items:center; gap:8px; min-width:0; }
    .bookie-chip img{ width:18px; height:18px; border-radius:5px; flex:none; }
    .bookie-name{ font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .bookie-odds{ font-weight:800; min-width:3.5rem; text-align:right; font-variant-numeric:tabular-nums; }

    /* --- Checkbox dropdown rows (filters) --- */
    .chk-grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    @media (max-width: 768px){ .chk-grid{ grid-template-columns:1fr; gap:10px; } }
    .chk-row{
      display:flex; align-items:center; gap:10px;
      padding:12px 12px; border-radius:14px;
      cursor:pointer; user-select:none;
    }
    .chk-row:hover{ background:rgba(255,255,255,.06); }
    .chk-row input{ margin:0; }
    .chk-row .chk-input{ margin-right:0; }
    .bookie-icon-16{ width:18px; height:18px; border-radius:5px; flex:none; }
    .chk-name{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    /* --- Min ROI slider: cleaner --- */
    input[type="range"]{
      -webkit-appearance:none; appearance:none;
      height:6px; border-radius:999px;
      background:rgba(148,163,184,.25);
      outline:none;
    }
    input[type="range"]::-webkit-slider-thumb{
      -webkit-appearance:none; appearance:none;
      width:16px; height:16px; border-radius:999px;
      background:rgb(59 130 246);
      border:2px solid rgba(255,255,255,.7);
      box-shadow:0 4px 10px rgba(0,0,0,.25);
      cursor:pointer;
    }
    input[type="range"]::-moz-range-thumb{
      width:16px; height:16px; border-radius:999px;
      background:rgb(59 130 246);
      border:2px solid rgba(255,255,255,.7);
      box-shadow:0 4px 10px rgba(0,0,0,.25);
      cursor:pointer;
    }

    /* --- Calculator styles (updated) --- */
    .calc-card{
      position:relative; display:grid; grid-template-columns:1fr auto; align-items:center; gap:14px;
      border:1px solid rgba(148,163,184,.25); border-radius:18px; padding:14px;
      background:rgba(255,255,255,.04);
    }
    .calc-left{display:flex;flex-direction:column;gap:6px;min-width:0}
    .calc-top{display:flex;align-items:center;gap:10px;min-width:0}
    .calc-id img{width:22px;height:22px;border-radius:6px;flex:none}
    .calc-id .name{font-weight:800;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .calc-meta{font-size:.92rem;color:rgba(226,232,240,.72)}
    .calc-meta b{color:rgba(226,232,240,.92)}
    .calc-right{display:flex;flex-direction:column;align-items:flex-end;gap:10px;min-width:260px}
    .calc-oddsline{display:flex;align-items:center;gap:8px}
    .calc-oddsline label{font-size:.9rem;color:rgba(226,232,240,.72)}
    .calc-oddsline input{
      width:96px;padding:.45rem .55rem;border-radius:12px;
      border:1px solid rgba(148,163,184,.25);
      background:rgba(2,6,23,.25); color:rgba(226,232,240,.95);
      font-variant-numeric:tabular-nums;
    }
    .calc-stake{display:flex;align-items:center;gap:10px}
    .calc-stake label{font-size:.9rem;color:rgba(226,232,240,.72)}
    .calc-stake input{
      width:120px; padding:.50rem .65rem; border-radius:12px;
      border:1px solid rgba(148,163,184,.25);
      background:rgba(2,6,23,.25); color:rgba(226,232,240,.95);
      font-variant-numeric:tabular-nums;
    }
    .calc-lock{
      width:40px; height:36px; border-radius:12px;
      border:1px solid rgba(148,163,184,.25);
      background:rgba(255,255,255,.04); color:rgba(226,232,240,.9);
      display:inline-flex; align-items:center; justify-content:center;
      cursor:pointer;
    }
    .calc-lock.active{ background:rgba(59,130,246,.18); border-color:rgba(59,130,246,.35); }
    .calc-dd{
      position:absolute; right:14px; top:100%; margin-top:8px;
      width:min(340px, 88vw); max-height:280px; overflow:auto;
      background:rgb(15 23 42);
      border:1px solid rgba(148,163,184,.25);
      border-radius:14px; box-shadow:0 14px 30px rgba(0,0,0,.35);
      z-index:2147483647;
    }
    .calc-dd.hidden{display:none}
    .calc-dd .opt{display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; cursor:pointer; border-radius:12px;}
    .calc-dd .opt:hover{background:rgba(255,255,255,.06)}
    .calc-dd .left{display:flex;align-items:center;gap:10px;min-width:0}
    .calc-dd img{width:18px;height:18px;border-radius:5px;flex:none}
    .calc-dd .name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .calc-dd .odds{font-variant-numeric:tabular-nums;opacity:.9}

    .calc-controls{display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:16px;}
    @media (max-width: 640px){ .calc-controls{ grid-template-columns:1fr; } .calc-right{ min-width:0; } }
    .calc-controls label{display:block; font-size:.92rem; color:rgba(226,232,240,.72); margin-bottom:6px}
    .calc-controls input,.calc-controls select{
      width:100%; padding:.6rem .7rem; border-radius:14px;
      border:1px solid rgba(148,163,184,.25);
      background:rgba(2,6,23,.25); color:rgba(226,232,240,.95);
    }

    .calc-summary{
      border-top:1px solid rgba(148,163,184,.22);
      margin-top:16px; padding-top:14px;
      display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;
    }
    .pill{
      display:inline-flex; align-items:center; gap:8px;
      padding:.45rem .7rem; border-radius:999px;
      background:rgba(255,255,255,.06); border:1px solid rgba(148,163,184,.20);
      font-size:.92rem;
    }
    .pill b{font-variant-numeric:tabular-nums}
    .calc-hint{margin-top:8px; font-size:.9rem; color:rgba(226,232,240,.65)}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

// --- App state ---
const state = {
  sortBy: 'roi',
  sortDir: 'desc',
  page: 1,
  pageSize: 15,
  filters: { dateFrom: '', dateTo: '', minRoi: 0 },
  tz: normalizeTZ(localStorage.getItem('tzMode') || 'Australia/Brisbane'),
  selectedBookies: new Set(JSON.parse(localStorage.getItem('bookiesSelected') || '[]')),
  selectedSports: new Set(JSON.parse(localStorage.getItem('sportsSelected') || '[]')),
  selectedLeagues: new Set(JSON.parse(localStorage.getItem('leaguesSelected') || '[]')),
  _agencies: [],
  _sports: [],
  _leagues: [],
};

const els = {
  lastUpdated: document.getElementById('lastUpdated'),
  tbody: document.getElementById('tbody'),
  totalCount: document.getElementById('totalCount'),
  page: document.getElementById('page'),
  pages: document.getElementById('pages'),
  prev: document.getElementById('prevPage'),
  next: document.getElementById('nextPage'),
  pageSize: document.getElementById('pageSize'),

  dateFrom: document.getElementById('dateFrom'),
  dateTo: document.getElementById('dateTo'),
  minRoi: document.getElementById('minRoi'),
  minRoiValue: document.getElementById('minRoiValue'),
  reset: document.getElementById('resetFilters'),
  refresh: document.getElementById('refresh'),

  // Bookies dropdown UI
  bookiesWrapper: document.getElementById('bookiesWrapper'),
  bookiesDropdown: document.getElementById('bookiesDropdown'),
  bookiesSummary: document.getElementById('bookiesSummary'),
  bookiesPanel: document.getElementById('bookiesPanel'),
  bookiesChkWrap: document.getElementById('bookiesChkWrap'),
  bookiesSelectAll: document.getElementById('bookiesSelectAll'),
  bookiesSelectedCount: document.getElementById('bookiesSelectedCount'),

  // Sports
  sportsWrapper: document.getElementById('sportsWrapper'),
  sportsDropdown: document.getElementById('sportsDropdown'),
  sportsSummary: document.getElementById('sportsSummary'),
  sportsPanel: document.getElementById('sportsPanel'),
  sportsChkWrap: document.getElementById('sportsChkWrap'),
  sportsSelectAll: document.getElementById('sportsSelectAll'),
  sportsSelectedCount: document.getElementById('sportsSelectedCount'),

  // Leagues
  leaguesWrapper: document.getElementById('leaguesWrapper'),
  leaguesDropdown: document.getElementById('leaguesDropdown'),
  leaguesSummary: document.getElementById('leaguesSummary'),
  leaguesPanel: document.getElementById('leaguesPanel'),
  leaguesChkWrap: document.getElementById('leaguesChkWrap'),
  leaguesSelectAll: document.getElementById('leaguesSelectAll'),
  leaguesSelectedCount: document.getElementById('leaguesSelectedCount'),

  tzSelect: document.getElementById('tzSelect'),
};

initTZSelect();

// --- Utility: Querystring builder (client-only bookie filtering) ---
function qs() {
  const params = {
    page: state.page,
    pageSize: state.pageSize,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    ...state.filters,
  };

  // Do NOT send bookies to API anymore – we'll filter bookies entirely client-side
  const addCsv = (set, fullArr, key) => {
    if (!fullArr.length) return;
    if (set.size > 0 && set.size < fullArr.length) params[key] = [...set].join(',');
  };

  // keep these server-side
  addCsv(state.selectedSports, state._sports, 'sports');
  addCsv(state.selectedLeagues, state._leagues, 'leagues');

  return new URLSearchParams(params).toString();
}

// --- Sort indicators ---
const ICONS = {
  both: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M3 4l3-3 3 3H3zm6 4l-3 3-3-3h6z" fill="currentColor"/></svg>',
  up: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M3 7l3-3 3 3H3z" fill="currentColor"/></svg>',
  down: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M3 5l3 3 3-3H3z" fill="currentColor"/></svg>',
};
function renderSortIndicators() {
  const ths = document.querySelectorAll('thead [data-sort]');
  ths.forEach((th) => {
    const key = th.getAttribute('data-sort');
    let icon = th.querySelector('.sort-indicator');
    if (!icon) {
      th.insertAdjacentHTML('beforeend', ' <span class="sort-indicator inline-block ml-1 opacity-60"></span>');
      icon = th.querySelector('.sort-indicator');
    }
    if (state.sortBy === key) {
      icon.innerHTML = state.sortDir === 'asc' ? ICONS.up : ICONS.down;
      icon.classList.remove('opacity-60');
      icon.classList.add('opacity-90');
    } else {
      icon.innerHTML = ICONS.both;
      icon.classList.remove('opacity-90');
      icon.classList.add('opacity-60');
    }
  });
}

// --- Name cleaning + logos (.jpeg) ---
function cleanAgencyName(name) {
  if (!name) return '';
  let out = String(name).split('(')[0];
  out = out.split('-')[0];
  return out.trim();
}
function agencySlug(name) {
  return cleanAgencyName(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function logoFor(name) {
  const slug = agencySlug(name);
  return `/images/${slug}.jpeg`;
}

// --- Timezone options (values are IANA tz IDs; "local" means browser local) ---
const TZ_OPTIONS = [
  { value: 'local', label: 'Auto (Local)' },

  // Australia
  { value: 'Australia/Brisbane',  label: 'Brisbane (QLD) — AEST' },         // no DST
  { value: 'Australia/Sydney',    label: 'Sydney (NSW/ACT) — AEST/AEDT' },  // DST
  { value: 'Australia/Melbourne', label: 'Melbourne (VIC) — AEST/AEDT' },   // DST
  { value: 'Australia/Hobart',    label: 'Hobart (TAS) — AEST/AEDT' },      // DST
  { value: 'Australia/Adelaide',  label: 'Adelaide (SA) — ACST/ACDT' },     // DST
  { value: 'Australia/Darwin',    label: 'Darwin (NT) — ACST' },            // no DST
  { value: 'Australia/Perth',     label: 'Perth (WA) — AWST' },             // no DST
];

// Back-compat + safety: convert old stored values ("AEST", "Local", etc.) to new scheme
function normalizeTZ(v) {
  const s = String(v || '').trim();

  if (!s) return 'Australia/Brisbane';
  if (/^local$/i.test(s) || /^auto$/i.test(s)) return 'local';
  if (s === 'AEST') return 'Australia/Brisbane';

  // If it's already an IANA zone like "Australia/Sydney", keep it
  if (s.includes('/')) return s;

  // Unknown string -> treat as local instead of breaking formatting
  return 'local';
}

function getIntlTimeZone() {
  const v = normalizeTZ(state.tz);
  return v === 'local' ? undefined : v;
}

function initTZSelect() {
  if (!els.tzSelect) return;

  // Build options (shows state next to city)
  els.tzSelect.innerHTML = TZ_OPTIONS
    .map(o => `<option value="${o.value}">${o.label}</option>`)
    .join('');

  // Ensure state.tz is normalized and select shows it
  state.tz = normalizeTZ(state.tz);
  els.tzSelect.value = state.tz;
  localStorage.setItem('tzMode', state.tz);
}

// --- Date/time formatting ---
function fmtWithTZ(iso) {
  if (!iso) return '';
  const opts = { dateStyle: 'medium', timeStyle: 'short' };
  const timeZone = getIntlTimeZone();
  const fmt = new Intl.DateTimeFormat('en-AU', timeZone ? { ...opts, timeZone } : opts);
  try {
    return fmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

// time-only helper for Updated column
function fmtTimeWithTZ(iso) {
  if (!iso) return '';
  const timeZone = getIntlTimeZone();
  const fmt = new Intl.DateTimeFormat('en-AU', timeZone ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZone } : { hour: '2-digit', minute: '2-digit', hour12: false });
  try {
    return fmt.format(new Date(iso));
  } catch {
    return '';
  }
}

function formatUpdated(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';

  // Your selector currently uses "Local" and "AEST" (guessing from your note)
  // If you later expand to more zones, set state.tz to an IANA zone string.
  let timeZone;
  if (state.tz && state.tz !== 'Local') {
    // If you store "AEST" as the value, map it:
    timeZone = (state.tz === 'AEST') ? 'Australia/Brisbane' : state.tz;
  }

  try {
    return new Intl.DateTimeFormat('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...(timeZone ? { timeZone } : {})
    }).format(d);
  } catch {
    return '';
  }
}


// --- ROI & pairing helpers ---
function roiFromOdds(a, b) {
  const edge = 1 / a + 1 / b;
  if (edge >= 1) return -Infinity; // not profitable
  return 1 / edge - 1; // correct ROI
}
function requiredLeftOdds(bestRight) {
  return 1 / (1 - 1 / Number(bestRight));
}
function requiredRightOdds(bestLeft) {
  return 1 / (1 - 1 / Number(bestLeft));
}

// --- Expanded odds table ---
function renderFullBookTable(it) {
  const t = it.book_table;
  if (!t) return '';
  const headerL = t.headers?.[1] ?? 'Left';
  const headerR = t.headers?.[2] ?? 'Right';
  const rowsHtml = (t.rows || [])
    .map((r) => {
      const agency = cleanAgencyName(r.agency || '');
      const isBestL =
        t.best?.left?.agency &&
        cleanAgencyName(t.best.left.agency) === agency &&
        Number(t.best.left.odds).toFixed(2) === Number(r.left).toFixed(2);
      const isBestR =
        t.best?.right?.agency &&
        cleanAgencyName(t.best.right.agency) === agency &&
        Number(t.best.right.odds).toFixed(2) === Number(r.right).toFixed(2);
      const mark = (v, on) =>
        `<span class="px-2 py-0.5 rounded ${on ? 'bg-amber-100 dark:bg-amber-900/40 font-semibold' : ''} tabular-nums">${v || ''}</span>`;
      return `
      <tr class="border-t border-slate-200 dark:border-slate-700">
        <td class="px-3 py-2"><div class="flex items-center gap-2">
          <img src="${logoFor(agency)}" class="w-5 h-5 rounded" onerror="this.src='/logos/placeholder.jpeg'"><span>${agency}</span></div></td>
        <td class="px-3 py-2 text-right">${mark(r.left, isBestL)}</td>
        <td class="px-3 py-2 text-right">${mark(r.right, isBestR)}</td>
        <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
          ${r.updatedISO ? formatUpdated(r.updatedISO) : (r.updated || '')}
        </td>
      </tr>`;
    })
    .join('');
  return `
    <div class="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 p-3 mt-3">
      <div class="text-xs mb-2 text-slate-600 dark:text-slate-300">${(it.game || '')} — ${(it.market || '')}</div>
      <div class="overflow-x-auto">
        <table class="min-w-[560px] w-full text-sm">
          <thead class="text-slate-600 dark:text-slate-300">
            <tr>
              <th class="px-3 py-2 text-left">Agency</th>
              <th class="px-3 py-2 text-right">${headerL}</th>
              <th class="px-3 py-2 text-right">${headerR}</th>
              <th class="px-3 py-2 text-right">Updated</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;
}

// === Pop-up Calculator (updated) =============================================
const Calc = (() => {
  let modal, overlay;
  let els = {};
  let ctx = {
    oA: 1.9, oB: 1.9,
    aName: '', bName: '',
    aLogo: '', bLogo: '',
    aBet: '', bBet: '',
    optsA: [], optsB: []
  };

  // mode: 'auto' | 'lockA' | 'lockB'
  let mode = 'auto';

  const fmtMoney = (v) => '$' + (Number(v) || 0).toFixed(2);

  function clampPos(n) { n = Number(n) || 0; return n < 0 ? 0 : n; }
  function stepVal() { return Math.max(1, Number(els.round?.value) || 10); }

  function snapToStep(x, step, how = 'nearest') {
    step = Math.max(1, Number(step) || 10);
    if (!Number.isFinite(x)) return 0;
    const q = x / step;
    if (how === 'floor') return Math.floor(q) * step;
    if (how === 'ceil')  return Math.ceil(q) * step;
    return Math.round(q) * step;
  }

  function setMode(next) {
    mode = next;
    if (!els.lockA || !els.lockB) return;
    els.lockA.classList.toggle('active', mode === 'lockA');
    els.lockB.classList.toggle('active', mode === 'lockB');
  }

  function ensureModal() {
    if (modal) return;

    // Backdrop
    overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.55)',
      zIndex: '2147483646',
      display: 'none',
    });
    overlay.addEventListener('click', close);

    // Modal shell
    modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '94vw',
      maxWidth: '720px',
      maxHeight: '92vh',
      borderRadius: '22px',
      overflow: 'hidden',
      border: '1px solid rgba(148,163,184,.25)',
      boxShadow: '0 18px 60px rgba(0,0,0,.45)',
      zIndex: '2147483647',
      display: 'none',
      background: 'rgb(15 23 42)',
    });
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div style="display:flex;flex-direction:column;max-height:92vh;">
        <div class="px-6 py-4 flex items-center justify-between border-b border-slate-700/70" style="background:rgba(2,6,23,.30);">
          <div class="text-base font-semibold text-slate-100" id="calcTitle">Calculator</div>
          <button id="calcClose" class="p-2 rounded hover:bg-white/10" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path stroke="currentColor" stroke-width="2" d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>

        <div id="calcBody" class="px-6 py-5" style="overflow:auto;">
          <!-- Side A -->
          <div id="cardA" class="calc-card">
            <div class="calc-left">
              <div class="calc-top">
                <div class="calc-id"><img id="calcAlogo" src="/logos/placeholder.jpeg" alt=""></div>
                <div class="name" id="calcAname">Side A</div>
              </div>
              <div class="calc-meta">Bet: <b id="calcAbet"></b></div>
              <div class="calc-meta">Payout: <b id="calcApayout" class="tabular-nums"></b></div>
            </div>
            <div class="calc-right">
              <div class="calc-oddsline">
                <label for="calcAoddsInput">Odds</label>
                <input id="calcAoddsInput" type="number" min="1.01" step="0.01" inputmode="decimal">
              </div>
              <div class="calc-stake">
                <label for="calcAstake">Stake</label>
                <input id="calcAstake" type="number" step="1" min="0" inputmode="numeric">
                <button id="lockA" class="calc-lock" type="button" title="Lock this stake">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M6 11h12v10H6V11Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
              <div id="ddA" class="calc-dd hidden"></div>
            </div>
          </div>

          <!-- Side B -->
          <div id="cardB" class="calc-card" style="margin-top:12px">
            <div class="calc-left">
              <div class="calc-top">
                <div class="calc-id"><img id="calcBlogo" src="/logos/placeholder.jpeg" alt=""></div>
                <div class="name" id="calcBname">Side B</div>
              </div>
              <div class="calc-meta">Bet: <b id="calcBbet"></b></div>
              <div class="calc-meta">Payout: <b id="calcBpayout" class="tabular-nums"></b></div>
            </div>
            <div class="calc-right">
              <div class="calc-oddsline">
                <label for="calcBoddsInput">Odds</label>
                <input id="calcBoddsInput" type="number" min="1.01" step="0.01" inputmode="decimal">
              </div>
              <div class="calc-stake">
                <label for="calcBstake">Stake</label>
                <input id="calcBstake" type="number" step="1" min="0" inputmode="numeric">
                <button id="lockB" class="calc-lock" type="button" title="Lock this stake">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M6 11h12v10H6V11Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
              <div id="ddB" class="calc-dd hidden"></div>
            </div>
          </div>

          <!-- Controls -->
          <div class="calc-controls">
            <div>
              <label for="calcMaxStake">Max total stake</label>
              <input id="calcMaxStake" type="number" step="10" min="0" value="1000">
            </div>
            <div>
              <label for="calcRound">Rounding</label>
              <select id="calcRound">
                <option value="10">Nearest $10</option>
                <option value="5">Nearest $5</option>
                <option value="1">Nearest $1</option>
              </select>
            </div>
          </div>

          <!-- Summary -->
          <div class="calc-summary">
            <div class="flex flex-wrap gap-2">
              <span class="pill">Total stake <b id="calcTotal" class="tabular-nums"></b></span>
              <span class="pill">Min payout <b id="calcMinPayout" class="tabular-nums"></b></span>
              <span class="pill profit-pill"><span id="profitLabel"></span><b id="calcProfit" class="tabular-nums"></b></span>
            </div>
          </div>
          <div class="calc-hint" id="calcHint"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // wire elements
    els = {
      title: modal.querySelector('#calcTitle'),
      close: modal.querySelector('#calcClose'),

      cardA: modal.querySelector('#cardA'),
      cardB: modal.querySelector('#cardB'),
      ddA: modal.querySelector('#ddA'),
      ddB: modal.querySelector('#ddB'),

      Aname: modal.querySelector('#calcAname'),
      Blogo: modal.querySelector('#calcBlogo'),
      Alogo: modal.querySelector('#calcAlogo'),
      Bname: modal.querySelector('#calcBname'),
      Abet: modal.querySelector('#calcAbet'),
      Bbet: modal.querySelector('#calcBbet'),

      AoddsIn: modal.querySelector('#calcAoddsInput'),
      BoddsIn: modal.querySelector('#calcBoddsInput'),

      Astake: modal.querySelector('#calcAstake'),
      Bstake: modal.querySelector('#calcBstake'),
      lockA: modal.querySelector('#lockA'),
      lockB: modal.querySelector('#lockB'),

      Apayout: modal.querySelector('#calcApayout'),
      Bpayout: modal.querySelector('#calcBpayout'),

      maxStake: modal.querySelector('#calcMaxStake'),
      round: modal.querySelector('#calcRound'),

      total: modal.querySelector('#calcTotal'),
      minPayout: modal.querySelector('#calcMinPayout'),
      profit: modal.querySelector('#calcProfit'),
      profitLabel: modal.querySelector('#profitLabel'),
      hint: modal.querySelector('#calcHint'),
    };

    // Persist + restore rounding and max stake
    const savedRound = localStorage.getItem('calcRoundStep');
    if (savedRound && ['1','5','10'].includes(savedRound)) els.round.value = savedRound;

    const savedMax = localStorage.getItem('calcMaxStake');
    if (savedMax && !Number.isNaN(Number(savedMax))) els.maxStake.value = savedMax;

    els.round.addEventListener('change', () => {
      localStorage.setItem('calcRoundStep', String(els.round.value || ''));
      recalc();
    });
    els.maxStake.addEventListener('change', () => {
      localStorage.setItem('calcMaxStake', String(els.maxStake.value || ''));
      recalc();
    });

    // close handlers
    els.close.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // lock buttons
    els.lockA.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode(mode === 'lockA' ? 'auto' : 'lockA');
      recalc();
    });
    els.lockB.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode(mode === 'lockB' ? 'auto' : 'lockB');
      recalc();
    });

    // Stake inputs: typing locks that side
    els.Astake.addEventListener('input', () => { setMode('lockA'); recalc(); });
    els.Bstake.addEventListener('input', () => { setMode('lockB'); recalc(); });

    // snap to step on blur
    els.Astake.addEventListener('blur', () => {
      if (mode !== 'lockA') {
        els.Astake.value = String(snapToStep(clampPos(els.Astake.value), stepVal()));
        recalc();
      }
    });
    els.Bstake.addEventListener('blur', () => {
      if (mode !== 'lockB') {
        els.Bstake.value = String(snapToStep(clampPos(els.Bstake.value), stepVal()));
        recalc();
      }
    });

    // Odds inputs: live update
    els.AoddsIn.addEventListener('input', () => {
      const v = Number(els.AoddsIn.value);
      if (Number.isFinite(v) && v > 1) ctx.oA = v;
      recalc();
    });
    els.BoddsIn.addEventListener('input', () => {
      const v = Number(els.BoddsIn.value);
      if (Number.isFinite(v) && v > 1) ctx.oB = v;
      recalc();
    });

    // Open dropdown by clicking the whole card (ignore stake/lock/odds/dropdown itself)
    els.cardA.addEventListener('click', (e) => {
      if (e.target.closest('.calc-stake') || e.target.closest('.calc-oddsline') || e.target.closest('.calc-dd')) return;
      toggleDD('A');
    });
    els.cardB.addEventListener('click', (e) => {
      if (e.target.closest('.calc-stake') || e.target.closest('.calc-oddsline') || e.target.closest('.calc-dd')) return;
      toggleDD('B');
    });

    // click outside dropdowns closes them
    modal.addEventListener('click', (e) => {
      const inA = e.target.closest('#ddA') || e.target.closest('#cardA');
      const inB = e.target.closest('#ddB') || e.target.closest('#cardB');
      if (!inA) els.ddA.classList.add('hidden');
      if (!inB) els.ddB.classList.add('hidden');
    });
  }

  function show() {
    overlay.style.display = 'block';
    modal.style.display = 'block';
  }
  function close() {
    if (overlay) overlay.style.display = 'none';
    if (modal) modal.style.display = 'none';
  }

  // --- core math (AUTO) ---
  function searchRounded(oA, oB, maxStake, step) {
    const stepAmt = Math.max(1, Number(step) || 10);
    const start = Math.floor(Math.max(0, Math.floor(maxStake)) / stepAmt) * stepAmt;
    const minTotal = Math.max(0, start - 200);

    const equalize = (total) => {
      const T = total / (1 / oA + 1 / oB);
      return { sA: T / oA, sB: T / oB };
    };

    const score = (rA, rB) => {
      const payoutA = rA * oA, payoutB = rB * oB;
      const used = rA + rB;
      const minPayout = Math.min(payoutA, payoutB);
      const profit = minPayout - used;
      const diff = Math.abs(payoutA - payoutB);
      return { payoutA, payoutB, used, minPayout, profit, diff, score: profit * 1e9 - diff };
    };

    let best = null;

    for (let total = start; total >= minTotal; total -= stepAmt) {
      if (total <= 0) break;

      const { sA, sB } = equalize(total);

      // small candidate set around rounded values
      const baseA = snapToStep(sA, stepAmt, 'nearest');
      const baseB = snapToStep(sB, stepAmt, 'nearest');

      const candidates = [];
      const tries = [baseA - stepAmt, baseA, baseA + stepAmt, baseA + 2 * stepAmt].filter(x => x >= 0);
      for (const rA of tries) {
        const rBraw = total - rA;
        const rB = snapToStep(rBraw, stepAmt, 'nearest');
        if (rA + rB > total) continue;
        candidates.push({ rA, rB, ...score(rA, rB) });
      }

      // fallback: perfect split rounding
      candidates.push({ rA: baseA, rB: baseB, ...score(baseA, baseB) });

      for (const c of candidates) {
        if (!best || c.score > best.score) best = c;
      }
    }

    if (!best) best = { rA: 0, rB: 0, payoutA: 0, payoutB: 0, used: 0, minPayout: 0, profit: 0, diff: 0 };
    return best;
  }

  // --- core math (LOCKED side) ---
  function computeOtherFromLocked(whichLocked) {
    const step = stepVal();
    const oA = Number(ctx.oA), oB = Number(ctx.oB);
    if (!(oA > 1) || !(oB > 1)) return;

    // IMPORTANT: do NOT round the locked side (the one being edited)
    const lockedEl = whichLocked === 'A' ? els.Astake : els.Bstake;
    const lockedRaw = clampPos(Number(lockedEl.value)); // keep exactly what user typed

    const fixedOdds = whichLocked === 'A' ? oA : oB;
    const otherOdds = whichLocked === 'A' ? oB : oA;

    // Target payout based on the unrounded locked stake
    const targetPayout = lockedRaw * fixedOdds;
    const otherRaw = otherOdds > 0 ? (targetPayout / otherOdds) : 0;

    // Round ONLY the computed (other) side to the step
    const base = snapToStep(otherRaw, step, 'nearest');

    const candidates = [];
    for (let k = -3; k <= 3; k++) {
      const stake = Math.max(0, base + k * step);

      const payoutLocked = targetPayout;
      const payoutOther  = stake * otherOdds;

      const total = lockedRaw + stake;
      const minP = Math.min(payoutLocked, payoutOther);
      const profit = minP - total;
      const diff = Math.abs(payoutLocked - payoutOther);

      candidates.push({ stake, total, profit, diff, minP });
    }

    // best: profit desc, then diff asc, then total desc
    candidates.sort((a, b) =>
      (b.profit - a.profit) ||
      (a.diff - b.diff) ||
      (b.total - a.total)
    );

    const best = candidates[0];

    // Write ONLY to the other side
    if (whichLocked === 'A') els.Bstake.value = String(best.stake);
    else els.Astake.value = String(best.stake);
  }

  function updateSummary() {
    const oA = Number(ctx.oA), oB = Number(ctx.oB);
    const sA = clampPos(Number(els.Astake.value));
    const sB = clampPos(Number(els.Bstake.value));

    const payoutA = sA * oA;
    const payoutB = sB * oB;
    const total = sA + sB;
    const minPayout = Math.min(payoutA, payoutB);
    const profit = minPayout - total;
    const roiPct = total > 0 ? (profit / total) * 100 : 0;

    els.Apayout.textContent = fmtMoney(payoutA);
    els.Bpayout.textContent = fmtMoney(payoutB);

    els.total.textContent = fmtMoney(total);
    els.minPayout.textContent = fmtMoney(minPayout);
    els.profitLabel.textContent = `Profit (${roiPct.toFixed(2)}%): `;
    els.profit.textContent = fmtMoney(profit);

    // hint + warnings
    const maxStake = clampPos(Number(els.maxStake.value));
    if (total > maxStake && maxStake > 0) {
      els.hint.textContent = `Total stake exceeds Max total stake by ${fmtMoney(total - maxStake)}.`;
    } else {
      const step = stepVal();
      if (mode === 'auto') els.hint.textContent = `Auto split using $${step} rounding. Click a lock to set one side manually.`;
      if (mode === 'lockA') els.hint.textContent = `Locked ${ctx.aName || 'Side A'} stake. Adjust odds or stake; other side follows ($${step} rounding).`;
      if (mode === 'lockB') els.hint.textContent = `Locked ${ctx.bName || 'Side B'} stake. Adjust odds or stake; other side follows ($${step} rounding).`;
    }
  }

  function recalc() {
    const oA = Number(ctx.oA), oB = Number(ctx.oB);
    if (!(oA > 1) || !(oB > 1)) { updateSummary(); return; }

    const step = stepVal();
    const maxStake = clampPos(Number(els.maxStake.value) || 1000);

    if (mode === 'auto') {
      const best = searchRounded(oA, oB, maxStake, step);
      els.Astake.value = String(best.rA ?? 0);
      els.Bstake.value = String(best.rB ?? 0);
    } else if (mode === 'lockA') {
      computeOtherFromLocked('A');
    } else if (mode === 'lockB') {
      computeOtherFromLocked('B');
    }

    updateSummary();
  }

  function renderOptions(listEl, options, side) {
    const sorted = (options || [])
      .slice()
      .filter(o => Number(o.odds) > 1)
      .sort((a, b) => Number(b.odds || 0) - Number(a.odds || 0)); // DESC by odds

    listEl.innerHTML = sorted.map(o => `
      <div class="opt" data-agency="${(o.agency || '').replace(/"/g,'&quot;')}" data-odds="${o.odds}">
        <div class="left">
          <img src="${logoFor(o.agency)}" onerror="this.src='/logos/placeholder.jpeg'">
          <div class="name">${o.agency}</div>
        </div>
        <div class="odds">${(Number(o.odds)||0).toFixed(2)}</div>
      </div>
    `).join('');

    listEl.querySelectorAll('.opt').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const agency = opt.getAttribute('data-agency') || '';
        const odds = Number(opt.getAttribute('data-odds') || '0');

        if (side === 'A') {
          ctx.aName = agency; ctx.oA = odds;
          els.Aname.textContent = agency; els.Alogo.src = logoFor(agency);
          els.AoddsIn.value = (odds > 0 ? odds.toFixed(2) : '');
        } else {
          ctx.bName = agency; ctx.oB = odds;
          els.Bname.textContent = agency; els.Blogo.src = logoFor(agency);
          els.BoddsIn.value = (odds > 0 ? odds.toFixed(2) : '');
        }

        // keep current mode; just recompute
        recalc();
        listEl.classList.add('hidden');
      });
    });
  }

  function toggleDD(which) {
    const open = which === 'A' ? els.ddA : els.ddB;
    const other = which === 'A' ? els.ddB : els.ddA;
    other.classList.add('hidden');
    open.classList.toggle('hidden');
  }

  function openCalc({ aName, bName, aOdds, bOdds, aLogo, bLogo, title, aBet = '', bBet = '', maxStake = 1000, optionsA = [], optionsB = [] }) {
    ensureModal();

    ctx = {
      oA: Number(aOdds) || 1.9,
      oB: Number(bOdds) || 1.9,
      aName: aName || 'Side A',
      bName: bName || 'Side B',
      aLogo: aLogo || '/logos/placeholder.jpeg',
      bLogo: bLogo || '/logos/placeholder.jpeg',
      aBet, bBet,
      optsA: (optionsA || []).slice(),
      optsB: (optionsB || []).slice(),
    };

    els.title.textContent = title || 'Calculator';

    els.Aname.textContent = ctx.aName;
    els.Bname.textContent = ctx.bName;
    els.Alogo.src = ctx.aLogo;
    els.Blogo.src = ctx.bLogo;
    els.Abet.textContent = aBet || '';
    els.Bbet.textContent = bBet || '';

    els.AoddsIn.value = (ctx.oA > 0 ? ctx.oA.toFixed(2) : '');
    els.BoddsIn.value = (ctx.oB > 0 ? ctx.oB.toFixed(2) : '');

    // Restore persisted values where possible
    const savedMax = localStorage.getItem('calcMaxStake');
    els.maxStake.value = (savedMax && !Number.isNaN(Number(savedMax)))
      ? savedMax
      : String(maxStake || els.maxStake.value || 1000);

    const savedRound = localStorage.getItem('calcRoundStep');
    if (savedRound && ['1', '5', '10'].includes(savedRound)) els.round.value = savedRound;

    renderOptions(els.ddA, ctx.optsA, 'A');
    renderOptions(els.ddB, ctx.optsB, 'B');

    // reset mode to auto on open
    setMode('auto');
    recalc();

    show();
  }

  return { openCalc };
})();

async function requestUpdateAndPoll() {
  const status = document.getElementById('updateStatus');
  const btn = document.getElementById('requestUpdate');
  let beforeTotal = Number(document.getElementById('totalCount').textContent) || 0;

  btn.disabled = true;
  status.textContent = 'Requesting…';

  let ok = false, msg = '';
  try {
    const res = await fetch('/api/trigger-scrape', { method: 'POST', headers: { 'Content-Type':'application/json' }});
    const j = await res.json(); ok = j.ok; msg = j.message || j.error || '';
  } catch (e) { msg = String(e); }

  if (!ok) { status.textContent = `Failed: ${msg || 'Unknown error'}`; btn.disabled = false; return; }

  status.textContent = 'Updating… (this can take a few minutes)';
  const start = Date.now(); const limitMs = 5*60*1000; const intervalMs = 15000;

  const poll = async () => {
    await fetchData();
    const nowTotal = Number(document.getElementById('totalCount').textContent) || 0;
    if (nowTotal !== beforeTotal) {
      status.textContent = 'Updated ✔'; btn.disabled = false; setTimeout(()=> (status.textContent=''), 4000); return;
    }
    if (Date.now()-start > limitMs) { status.textContent = 'No change detected yet.'; btn.disabled = false; }
    else setTimeout(poll, intervalMs);
  };
  setTimeout(poll, intervalMs);
}

// --- Helpers ---
function parseBets(matchStr) {
  if (!matchStr) return { top: '', bottom: '' };
  const parts = matchStr.split('|').map(s => s.trim());
  const label = (s) => s.split(' - ')[0].trim();
  return { top: label(parts[0] || ''), bottom: label(parts[1] || '') };
}
function isInteractive(el) {
  return !!el.closest('a, button, input, select, label, textarea, summary');
}

// --- Generic checkbox panel renderer (with bookie icons) ---
function renderCheckboxPanel({ items, wrapEl, selectAllEl, selectedSet, allKey, onChange }) {
  wrapEl.innerHTML = '';
  wrapEl.classList.add('chk-grid');

  // treat "All" as selected (empty set) when Select all is on or everything is selected
  const treatAllSelected = (selectAllEl.checked === true) && (selectedSet.size === 0 || selectedSet.size >= items.length);

  items.forEach(v => {
    const id = `${allKey}-${v.toString().replace(/[^a-z0-9]/gi,'-').toLowerCase()}`;
    const isChecked = treatAllSelected ? true : selectedSet.has(v);

    const row = document.createElement('label');
    row.className = 'chk-row';

    if (allKey === 'bookie') {
      row.innerHTML = `
        <input type="checkbox" id="${id}" class="rounded chk-input" ${isChecked ? 'checked' : ''} data-val="${v}">
        <img src="${logoFor(v)}" alt="" class="bookie-icon-16" onerror="this.src='/logos/placeholder.jpeg'">
        <span class="chk-name">${v}</span>
      `;
    } else {
      row.innerHTML = `
        <input type="checkbox" id="${id}" class="rounded chk-input" ${isChecked ? 'checked' : ''} data-val="${v}">
        <span class="chk-name">${v}</span>
      `;
    }

    wrapEl.appendChild(row);
  });

  // reflect "Select all" visual state
  selectAllEl.checked = treatAllSelected;

  // wiring for each checkbox
  wrapEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const val = cb.getAttribute('data-val');

      // if "select all" was visually on but set is empty, seed the set with all items first
      if (selectAllEl.checked === true && selectedSet.size === 0) items.forEach(v => selectedSet.add(v));
      if (cb.checked) selectedSet.add(val);
      else selectedSet.delete(val);

      // If everything is selected, collapse to "All"
      if (selectedSet.size >= items.length) {
        selectedSet.clear();
        selectAllEl.checked = true;
      } else {
        selectAllEl.checked = false;
      }
      onChange();
    });
  });

  // Select all toggle
  selectAllEl.onchange = () => {
    if (selectAllEl.checked) {
      selectedSet.clear();
      wrapEl.querySelectorAll('input[type="checkbox"]').forEach(cb => (cb.checked = true));
    } else {
      selectedSet.clear();
      wrapEl.querySelectorAll('input[type="checkbox"]').forEach(cb => (cb.checked = false));
    }
    onChange();
  };
}

// --- Summaries
function updateSummaryText(set, fullArr, el, labelAll) {
  let text = labelAll;
  if (set.size > 0 && fullArr.length && set.size < fullArr.length) text = `${set.size} selected`;
  el.textContent = text;
}

// --- Dropdown positioning ---
function positionDropdown(wrapperEl, panelEl) {
  panelEl.style.left = ''; panelEl.style.right = '';
  const wasHidden = panelEl.classList.contains('hidden');
  if (wasHidden) { panelEl.classList.remove('hidden'); panelEl.style.visibility = 'hidden'; }
  const wrapRect = wrapperEl.getBoundingClientRect();
  const panelRect = panelEl.getBoundingClientRect();
  const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const margin = 8;

  const fitsLeft = wrapRect.left + panelRect.width <= vw - margin;
  const fitsRight = wrapRect.right - panelRect.width >= margin;
  if (fitsLeft) panelEl.style.left = '0';
  else if (fitsRight) panelEl.style.right = '0';
  else {
    const availLeft = wrapRect.right - margin;
    const availRight = vw - wrapRect.left - margin;
    const targetSide = availRight >= availLeft ? 'left' : 'right';
    panelEl.style.maxWidth = `${Math.max(availLeft, availRight)}px`;
    if (targetSide === 'left') panelEl.style.left = '0'; else panelEl.style.right = '0';
  }
  if (wasHidden) { panelEl.style.visibility = ''; panelEl.classList.add('hidden'); }
}

// --- Open/close dropdown helpers ---
function wireDropdown(wrapper, trigger, panel) {
  function open() { positionDropdown(wrapper, panel); panel.classList.remove('hidden'); trigger.setAttribute('aria-expanded','true'); }
  function close(){ panel.classList.add('hidden');    trigger.setAttribute('aria-expanded','false'); }
  trigger.addEventListener('click', () => { panel.classList.contains('hidden') ? open() : close(); });
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.click(); }
    if (e.key === 'Escape') close();
  });
  document.addEventListener('click', (e) => { if (!wrapper.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (!panel.classList.contains('hidden')) positionDropdown(wrapper, panel); });
  window.addEventListener('scroll', () => { if (!panel.classList.contains('hidden')) positionDropdown(wrapper, panel); }, { passive: true });
}

// Wire dropdowns
wireDropdown(els.bookiesWrapper, els.bookiesDropdown, els.bookiesPanel);
wireDropdown(els.sportsWrapper,  els.sportsDropdown,  els.sportsPanel);
wireDropdown(els.leaguesWrapper, els.leaguesDropdown, els.leaguesPanel);

// --- Side list popovers (sorted by odds desc) ---
function openSideListPopover(anchorEl, side, options) {
  const items = (options || [])
    .filter(o => Number(o.odds) > 1)
    .sort((a,b) => Number(b.odds) - Number(a.odds));

  const pop = document.createElement('div');
  pop.className = 'side-list-popover';
  Object.assign(pop.style, {
    position: 'fixed',
    zIndex: '2147483645',
    minWidth: '220px',
    maxWidth: '320px',
    maxHeight: '60vh',
    overflowY: 'auto',
    background: document.documentElement.classList.contains('dark') ? 'rgb(15 23 42)' : '#fff',
    border: '1px solid rgba(100,116,139,.3)',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,.20)',
    padding: '8px',
  });

  pop.innerHTML = `
    <div class="text-xs font-semibold mb-2">${side === 'left' ? 'Left' : 'Right'} side — all bookies</div>
    <div class="divide-y divide-slate-200 dark:divide-slate-700">
      ${items.map(it => `
        <button class="w-full text-left px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2 side-pick"
                data-agency="${it.agency}" data-odds="${Number(it.odds)}">
          <img src="${logoFor(it.agency)}" class="w-5 h-5 rounded" onerror="this.src='/logos/placeholder.jpeg'">
          <span class="flex-1 truncate">${it.agency}</span>
          <span class="tabular-nums font-medium">${Number(it.odds).toFixed(2)}</span>
        </button>
      `).join('')}
    </div>
  `;

  document.body.appendChild(pop);

  // position near anchor
  const r = anchorEl.getBoundingClientRect();
  const x = Math.min(window.innerWidth - pop.offsetWidth - 8, r.left);
  const y = Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 6);
  pop.style.left = `${Math.max(8, x)}px`;
  pop.style.top  = `${Math.max(8, y)}px`;

  const onDoc = (e) => { if (!pop.contains(e.target)) cleanup(); };
  const onEsc = (e) => { if (e.key === 'Escape') cleanup(); };
  function cleanup() {
    document.removeEventListener('mousedown', onDoc);
    document.removeEventListener('keydown', onEsc);
    pop.remove();
  }
  document.addEventListener('mousedown', onDoc);
  document.addEventListener('keydown', onEsc);

  pop.querySelectorAll('.side-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const agency = btn.getAttribute('data-agency');
      const odds = Number(btn.getAttribute('data-odds'));
      const tr = anchorEl.closest('tr');
      if (!tr || !tr._pairToUse) return;
      const other = side === 'left' ? tr._pairToUse.right : tr._pairToUse.left;
      const a = side === 'left' ? { agency, odds } : other;
      const b = side === 'left' ? other : { agency, odds };

      const title = `${tr.dataset.game || ''} — ${tr.dataset.market || ''}`;

      Calc.openCalc({
        aName: a.agency, bName: b.agency,
        aOdds: a.odds,   bOdds: b.odds,
        aLogo: logoFor(a.agency),
        bLogo: logoFor(b.agency),
        title,
        aBet: 'Left', bBet: 'Right',
        maxStake: Number(localStorage.getItem('calcMaxStake')) || 1000,
        optionsA: tr._leftOptions || [],
        optionsB: tr._rightOptions || []
      });

      cleanup();
    });
  });
}

// --- Fetch + render ---
async function fetchData() {
  if (els.tzSelect) els.tzSelect.value = state.tz;

  // helper to rebuild the API URL with a page override
  const buildURL = (pageOverride) => {
    const params = new URLSearchParams(qs());
    if (pageOverride != null) params.set('page', String(pageOverride));
    return `/api/opportunities?${params.toString()}`;
  };

  // First request (always needed for metadata like pages)
  const firstRes = await fetch(buildURL(state.page));
  const firstJson = await firstRes.json();
  let { items, total, page, pages, lastUpdated, sports, leagues, agencies } = firstJson;

  // meta (will be overridden later if we do client-side filtering/pagination)
  els.lastUpdated.textContent = lastUpdated ? fmtWithTZ(lastUpdated) : '—';
  els.totalCount.textContent  = total;
  els.page.textContent        = page;
  els.pages.textContent       = pages;
  els.prev.disabled           = page <= 1;
  els.next.disabled           = page >= pages;

  // ---------- filters panels ----------
  const spNow = JSON.stringify(sports || []);
  const spPrev = JSON.stringify(state._sports || []);
  if (spNow !== spPrev) {
    state._sports = (sports || []).slice().sort((a,b)=>(a||'').localeCompare(b||''));
    renderCheckboxPanel({
      items: state._sports, wrapEl: els.sportsChkWrap, selectAllEl: els.sportsSelectAll,
      selectedSet: state.selectedSports, allKey: 'sport',
      onChange: () => {
        localStorage.setItem('sportsSelected', JSON.stringify([...state.selectedSports]));
        updateSummaryText(state.selectedSports, state._sports, els.sportsSummary, 'All sports');
        updateSummaryText(state.selectedSports, state._sports, els.sportsSelectedCount, 'All');
        state.page = 1; fetchData();
      }
    });
  }
  updateSummaryText(state.selectedSports, state._sports, els.sportsSummary, 'All sports');
  updateSummaryText(state.selectedSports, state._sports, els.sportsSelectedCount, 'All');

  const lgNow = JSON.stringify(leagues || []);
  const lgPrev = JSON.stringify(state._leagues || []);
  if (lgNow !== lgPrev) {
    state._leagues = (leagues || []).slice();
    renderCheckboxPanel({
      items: state._leagues, wrapEl: els.leaguesChkWrap, selectAllEl: els.leaguesSelectAll,
      selectedSet: state.selectedLeagues, allKey: 'league',
      onChange: () => {
        localStorage.setItem('leaguesSelected', JSON.stringify([...state.selectedLeagues]));
        updateSummaryText(state.selectedLeagues, state._leagues, els.leaguesSummary, 'All leagues');
        updateSummaryText(state.selectedLeagues, state._leagues, els.leaguesSelectedCount, 'All');
        state.page = 1; fetchData();
      }
    });
  }
  updateSummaryText(state.selectedLeagues, state._leagues, els.leaguesSummary, 'All leagues');
  updateSummaryText(state.selectedLeagues, state._leagues, els.leaguesSelectedCount, 'All');

  const agNow = JSON.stringify(agencies || []);
  const agPrev = JSON.stringify(state._agencies || []);
  if (agNow !== agPrev) {
    state._agencies = (agencies || []).slice();
    renderCheckboxPanel({
      items: state._agencies, wrapEl: els.bookiesChkWrap, selectAllEl: els.bookiesSelectAll,
      selectedSet: state.selectedBookies, allKey: 'bookie',
      onChange: () => {
        localStorage.setItem('bookiesSelected', JSON.stringify([...state.selectedBookies]));
        updateSummaryText(state.selectedBookies, state._agencies, els.bookiesSummary, 'All bookies');
        updateSummaryText(state.selectedBookies, state._agencies, els.bookiesSelectedCount, 'All');
        state.page = 1; fetchData();
      }
    });
  }
  updateSummaryText(state.selectedBookies, state._agencies, els.bookiesSummary, 'All bookies');
  updateSummaryText(state.selectedBookies, state._agencies, els.bookiesSelectedCount, 'All');

  // -------- core row building util (returns {bundle|null, roi} ) --------
  function buildBundle(it, allowed) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50';

    const bets = parseBets(it.match);
    const kickoffTxt = it.kickoff ? fmtWithTZ(it.kickoff) : (it.date || it.dateISO || '');
    const leagueCell = it.league || '—';

    // Build option arrays from full table
    let optsAAll = [], optsBAll = [];
    if (it.book_table?.rows?.length) {
      const rows = it.book_table.rows;
      optsAAll = rows.map(r => ({ agency: cleanAgencyName(r.agency||''), odds: Number(r.left)  }))
                     .filter(o => o.agency && o.odds > 1);
      optsBAll = rows.map(r => ({ agency: cleanAgencyName(r.agency||''), odds: Number(r.right) }))
                     .filter(o => o.agency && o.odds > 1);
    }

    // Apply bookie filter (if any)
    const optsA = allowed ? optsAAll.filter(o => allowed.has(o.agency)) : optsAAll;
    const optsB = allowed ? optsBAll.filter(o => allowed.has(o.agency)) : optsBAll;

    // Best profitable pair within filtered sets
    let best = null;
    for (const a of optsA) {
      const ao = Number(a.odds); if (!(ao > 1)) continue;
      for (const b of optsB) {
        const bo = Number(b.odds); if (!(bo > 1)) continue;
        const roi = roiFromOdds(ao, bo);
        if (roi > 0 && (!best || roi > best.roi)) best = { left: a, right: b, roi };
      }
    }
    if (!best) return null; // not profitable given allowed bookies

    // Chosen pair
    const aName = best.left.agency, bName = best.right.agency;
    const aOdds = Number(best.left.odds), bOdds = Number(best.right.odds);
    const aLogo = logoFor(aName), bLogo = logoFor(bName);

    // Profitable alternatives (only within allowed)
    const needLeft  = requiredLeftOdds(bOdds);
    const needRight = requiredRightOdds(aOdds);
    const leftProfitable  = optsA.filter(o => Number(o.odds) >= needLeft);
    const rightProfitable = optsB.filter(o => Number(o.odds) >= needRight);
    const leftOthers  = leftProfitable.filter(o => o.agency !== aName).length;
    const rightOthers = rightProfitable.filter(o => o.agency !== bName).length;

    const leftLabel  = leftOthers  > 0
      ? `<button class="side-list-btn mt-1 text-[11px] text-slate-500 dark:text-slate-400 underline underline-offset-2" data-side="left">+${leftOthers} other profitable bookie${leftOthers>1?'s':''}</button>`
      : '';
    const rightLabel = rightOthers > 0
      ? `<button class="side-list-btn mt-1 text-[11px] text-slate-500 dark:text-slate-400 underline underline-offset-2" data-side="right">+${rightOthers} other profitable bookie${rightOthers>1?'s':''}</button>`
      : '';

    const chip = (agency, odds) => `
      <div class="bookie-chip">
        <div class="bookie-identity min-w-0">
          <img src="${logoFor(agency)}" alt="${agency}" onerror="this.src='/logos/placeholder.jpeg'">
          <span class="bookie-name truncate">${agency}</span>
        </div>
        <span class="bookie-odds tabular-nums">${Number(odds).toFixed(2)}</span>
      </div>`;

    const bookiesCell = `
      <div class="stack">
        <div>
          ${chip(aName, aOdds)}
          ${leftLabel}
        </div>
        <div>
          ${chip(bName, bOdds)}
          ${rightLabel}
        </div>
      </div>`;

    const roiLocal = best.roi;
    const roiPct   = (roiLocal * 100).toFixed(2) + '%';
    tr.dataset.roi = String(roiLocal);

    const title = `${it.game || ''} — ${it.market || ''}`.replace(/"/g, '&quot;');
    const headerL = it.book_table?.headers?.[1] || bets.top || 'Left';
    const headerR = it.book_table?.headers?.[2] || bets.bottom || 'Right';
    const optionsPacked = btoa(unescape(encodeURIComponent(JSON.stringify({ A: optsAAll, B: optsBAll }))));

    // keep extra info on the row for popovers + better title building
    tr._pairToUse = best;
    tr._leftOptions = optsAAll;
    tr._rightOptions = optsBAll;
    tr.dataset.game = it.game || '';
    tr.dataset.market = it.market || '';

    tr.innerHTML = `
      <td class="col-date">${kickoffTxt}</td>

      <td class="col-roi" data-roi="${roiLocal}">
        <span class="roi-pill">${roiPct}</span>
      </td>

      <td class="col-sport">${it.sport || ''}</td>

      <td class="col-league">${leagueCell}</td>

      <td class="col-gm">
        <div class="gm">
          <div class="gm-game">${it.game || ''}</div>
          <div class="gm-market">${it.market || ''}</div>
        </div>
      </td>

      <td class="col-bets">
        <div class="bets">
          <div>${bets.top}</div>
          <div>${bets.bottom}</div>
        </div>
      </td>

      <td class="col-bookies">${bookiesCell}</td>

      <td class="col-actions">
        <button class="toggle-odds icon-btn" title="Show odds table" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
            <path d="M8 7h8M7 11h10M7 15h10M7 19h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </td>
    `;

    const trDetails = document.createElement('tr');
    trDetails.className = 'hidden';
    const tdDetails = document.createElement('td');
    tdDetails.colSpan = 8;
    tdDetails.innerHTML = it.book_table ? renderFullBookTable(it) : '';
    trDetails.appendChild(tdDetails);

    // Handlers
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.toggle-odds') || e.target.closest('.side-list-btn')) return;
      const payload = {
        aName: aName, bName: bName, aOdds, bOdds,
        aLogo, bLogo, title, aBet: headerL, bBet: headerR, optionsPacked
      };
      let optionsA = [], optionsB = [];
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(payload.optionsPacked))));
        optionsA = decoded.A || []; optionsB = decoded.B || [];
      } catch {}
      Calc.openCalc({
        aName: payload.aName, bName: payload.bName,
        aOdds: payload.aOdds, bOdds: payload.bOdds,
        aLogo: payload.aLogo, bLogo: payload.bLogo,
        title: payload.title, aBet: payload.aBet, bBet: payload.bBet,
        maxStake: Number(localStorage.getItem('calcMaxStake')) || 1000,
        optionsA, optionsB
      });
    });

    tr.querySelector('.toggle-odds').addEventListener('click', (e) => {
      e.stopPropagation();
      trDetails.classList.toggle('hidden');
      if (!trDetails.classList.contains('hidden')) {
        const rect = trDetails.getBoundingClientRect();
        if (rect.bottom > window.innerHeight) trDetails.scrollIntoView({ block: 'nearest' });
      }
    });

    tr.addEventListener('click', (e) => {
      const btn = e.target.closest('.side-list-btn');
      if (!btn) return;
      e.stopPropagation();
      const side = btn.getAttribute('data-side');
      const options = side === 'left' ? leftProfitable : rightProfitable;
      if (!options || !options.length) return;
      openSideListPopover(btn, side, options);
    });

    // bundle (for later sorting/paging)
    const bundle = { tr, trDetails, roi: roiLocal };
    return bundle;
  }

  // ---------- Build rows ----------
  els.tbody.innerHTML = '';
  const selected = state.selectedBookies;
  const allowed = (selected && selected.size) ? new Set([...selected].map(cleanAgencyName)) : null;

  // If NO bookie filter: build only current page (server pagination)
  if (!allowed) {
    const bundles = [];
    for (const it of items) {
      const b = buildBundle(it, null);
      if (b) bundles.push(b);
    }
    if (state.sortBy === 'roi') {
      bundles.sort((a,b) => state.sortDir === 'asc' ? (a.roi - b.roi) : (b.roi - a.roi));
    }
    const frag = document.createDocumentFragment();
    for (const { tr, trDetails } of bundles) { frag.appendChild(tr); frag.appendChild(trDetails); }
    els.tbody.appendChild(frag);
    renderSortIndicators();
    return;
  }

  // WITH bookie filter: fetch ALL pages, then client-filter + client-paginate
  const allBundles = [];
  for (const it of items) {
    const b = buildBundle(it, allowed);
    if (b) allBundles.push(b);
  }
  for (let p = 1; p <= pages; p++) {
    if (p === page) continue;
    const r = await fetch(buildURL(p));
    const j = await r.json();
    for (const it of (j.items || [])) {
      const b = buildBundle(it, allowed);
      if (b) allBundles.push(b);
    }
  }

  if (state.sortBy === 'roi') {
    allBundles.sort((a,b) => state.sortDir === 'asc' ? (a.roi - b.roi) : (b.roi - a.roi));
  }

  const clientTotal = allBundles.length;
  const pageSize    = state.pageSize;
  const clientPages = Math.max(1, Math.ceil(clientTotal / pageSize));

  if (state.page > clientPages) state.page = clientPages;

  els.totalCount.textContent = clientTotal;
  els.pages.textContent      = clientPages;
  els.page.textContent       = state.page;
  els.prev.disabled          = state.page <= 1;
  els.next.disabled          = state.page >= clientPages;

  const start = (state.page - 1) * pageSize;
  const end   = start + pageSize;
  const slice = allBundles.slice(start, end);

  const frag = document.createDocumentFragment();
  for (const { tr, trDetails } of slice) { frag.appendChild(tr); frag.appendChild(trDetails); }
  els.tbody.appendChild(frag);
  renderSortIndicators();
}

function updateAndFetch() { state.page = 1; fetchData(); }

// Date filter handlers
['dateFrom','dateTo'].forEach(id => {
  const el = els[id];
  if (!el) return;
  el.addEventListener('change', () => { state.filters[id] = el.value; updateAndFetch(); });
});

els.minRoi?.addEventListener('input', () => { els.minRoiValue.textContent = Number(els.minRoi.value).toFixed(1); });
els.minRoi?.addEventListener('change', () => { state.filters.minRoi = els.minRoi.value; updateAndFetch(); });

els.pageSize?.addEventListener('change', () => { state.pageSize = Number(els.pageSize.value); state.page = 1; fetchData(); });
els.prev?.addEventListener('click', () => { if (state.page > 1) { state.page--; fetchData(); } });
els.next?.addEventListener('click', () => { state.page++; fetchData(); });

els.reset?.addEventListener('click', () => {
  state.filters = { dateFrom: '', dateTo: '', minRoi: 0 };
  els.dateFrom.value = els.dateTo.value = '';
  els.minRoi.value = 0; els.minRoiValue.textContent = '0.0';

  state.selectedBookies.clear(); localStorage.removeItem('bookiesSelected');
  state.selectedSports.clear();  localStorage.removeItem('sportsSelected');
  state.selectedLeagues.clear(); localStorage.removeItem('leaguesSelected');

  renderCheckboxPanel({ items: state._sports,  wrapEl: els.sportsChkWrap,  selectAllEl: els.sportsSelectAll,  selectedSet: state.selectedSports,  allKey: 'sport',  onChange: ()=>{} });
  renderCheckboxPanel({ items: state._leagues, wrapEl: els.leaguesChkWrap, selectAllEl: els.leaguesSelectAll, selectedSet: state.selectedLeagues, allKey: 'league', onChange: ()=>{} });
  renderCheckboxPanel({ items: state._agencies,wrapEl: els.bookiesChkWrap, selectAllEl: els.bookiesSelectAll, selectedSet: state.selectedBookies, allKey: 'bookie', onChange: ()=>{} });

  updateSummaryText(state.selectedSports,  state._sports,  els.sportsSummary,  'All sports');
  updateSummaryText(state.selectedLeagues, state._leagues, els.leaguesSummary, 'All leagues');
  updateSummaryText(state.selectedBookies, state._agencies, els.bookiesSummary, 'All bookies');

  updateAndFetch();
});

els.refresh?.addEventListener('click', fetchData);
document.getElementById('requestUpdate')?.addEventListener('click', requestUpdateAndPoll);

// header sorting
for (const th of document.querySelectorAll('thead [data-sort]')) {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-sort');
    if (state.sortBy === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.sortBy = key; state.sortDir = 'asc'; }
    fetchData();
  });
}

// timezone select
els.tzSelect?.addEventListener('change', () => {
  state.tz = normalizeTZ(els.tzSelect.value);
  localStorage.setItem('tzMode', state.tz);
  fetchData();
});

// init
fetchData();
