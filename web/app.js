// --- Theme toggle ---
(() => {
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  if (saved) root.classList.toggle('dark', saved === 'dark');
  else root.classList.add('dark');

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#themeToggle');
    if (!btn) return;
    const isDark = root.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
})();

// --- Calculator styles (single, consolidated) ---
(() => {
  const css = `
  /* Card */
  .calc-card{
    position:relative;
    display:grid;
    grid-template-columns:1fr auto;
    align-items:center;
    gap:16px;
    border:1px solid rgb(226 232 240/1);
    border-radius:16px;
    padding:16px;
    background:var(--calc-bg,#fff);
    cursor:pointer; /* whole card clickable to open dropdown */
  }
  .dark .calc-card{border-color:rgb(51 65 85/1);background:rgb(15 23 42/1)}

  /* Left column (logo/name + bet + payout) */
  .calc-left{display:flex;flex-direction:column;gap:6px;min-width:0}
  .calc-top{display:flex;align-items:center;gap:.6rem}
  .calc-id img{width:22px;height:22px;border-radius:6px;flex:none}
  .calc-id .name{font-weight:700;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* Right column (odds above stake) */
  .calc-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
  .calc-odds{font-variant-numeric:tabular-nums;opacity:.9;font-weight:600}
  .calc-stake{display:flex;align-items:center;gap:.5rem}
  .calc-stake input{
    width:128px;
    padding:.45rem .6rem;
    border:1px solid rgb(203 213 225/1);
    border-radius:10px;
    background:var(--calc-bg,#fff);
    font-size:.95rem;
  }
  .dark .calc-stake input{border-color:rgb(71 85 105/1);background:rgb(30 41 59/1)}
  .calc-copy{font-size:.78rem;padding:.4rem .6rem;border-radius:8px;background:rgb(241 245 249/1);cursor:pointer}
  .dark .calc-copy{background:rgb(30 41 59/1)}

  /* Meta text */
  .calc-meta{font-size:.90rem;color:rgb(100 116 139/1)}
  .dark .calc-meta{color:rgb(148 163 184/1)}

  /* Controls (spacing above headings) */
  .calc-controls > div > label{margin-top:12px}
  .calc-controls label{font-size:.95rem}

  /* Summary divider & pills */
  .calc-summary{
    border-top:1px solid rgb(226 232 240/1);
    margin-top:18px;
    padding-top:14px;
    display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between;
  }
  .dark .calc-summary{border-color:rgb(51 65 85/1)}
  .pill{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .6rem;border-radius:999px;background:rgb(241 245 249/1)}
  .dark .pill{background:rgb(30 41 59/1)}
  .pill b{font-variant-numeric:tabular-nums}

  /* Dropdown of bookies inside calc */
  .calc-dd{
    position:absolute; right:16px; top:100%; margin-top:8px;
    min-width:280px; max-height:280px; overflow:auto;
    background:var(--calc-bg,#fff);
    border:1px solid rgb(226 232 240/1); border-radius:12px; box-shadow:0 12px 24px rgba(0,0,0,.25);
    z-index:2147483647;
  }
  .dark .calc-dd{background:rgb(15 23 42/1);border-color:rgb(51 65 85/1)}
  .calc-dd .opt{
    display:flex; align-items:center; justify-content:space-between; gap:8px;
    padding:10px 12px; cursor:pointer;
  }
  .calc-dd .opt:hover{background:rgb(241 245 249/1)}
  .dark .calc-dd .opt:hover{background:rgb(30 41 59/1)}
  .calc-dd .left{display:flex;align-items:center;gap:8px;min-width:0}
  .calc-dd img{width:18px;height:18px;border-radius:4px;flex:none}
  .calc-dd .name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .calc-dd .odds{font-variant-numeric:tabular-nums;opacity:.9}
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
  tz: localStorage.getItem('tzMode') || 'AEST',
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

// --- Utility: Querystring builder ---
function qs() {
  const params = {
    page: state.page,
    pageSize: state.pageSize,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    ...state.filters,
  };
  const addCsv = (set, fullArr, key) => {
    if (!fullArr.length) return;
    if (set.size > 0 && set.size < fullArr.length) params[key] = [...set].join(',');
  };
  addCsv(state.selectedBookies, state._agencies, 'bookies');
  addCsv(state.selectedSports, state._sports, 'sports');
  addCsv(state.selectedLeagues, state._leagues, 'leagues');
  return new URLSearchParams(params).toString();
}

// --- Sort indicators ---
const ICONS = {
  both: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M3 4l3-3 3 3H3zm6 4l-3 3-3-3h6z" fill="currentColor"/></svg>',
  up:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M3 7l3-3 3 3H3z" fill="currentColor"/></svg>',
  down: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M3 5l3 3 3-3H3z" fill="currentColor"/></svg>'
};
function renderSortIndicators() {
  const ths = document.querySelectorAll('thead [data-sort]');
  ths.forEach(th => {
    const key = th.getAttribute('data-sort');
    let icon = th.querySelector('.sort-indicator');
    if (!icon) {
      th.insertAdjacentHTML('beforeend', ' <span class="sort-indicator inline-block ml-1 opacity-60"></span>');
      icon = th.querySelector('.sort-indicator');
    }
    if (state.sortBy === key) {
      icon.innerHTML = state.sortDir === 'asc' ? ICONS.up : ICONS.down;
      icon.classList.remove('opacity-60'); icon.classList.add('opacity-90');
    } else {
      icon.innerHTML = ICONS.both;
      icon.classList.remove('opacity-90'); icon.classList.add('opacity-60');
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

// --- Date/time formatting ---
function fmtWithTZ(iso) {
  if (!iso) return '';
  const opts = { dateStyle:'medium', timeStyle:'short' };
  let tz = undefined;
  if (state.tz === 'AEST') tz = 'Australia/Brisbane';
  const fmt = new Intl.DateTimeFormat('en-AU', tz ? { ...opts, timeZone: tz } : opts);
  try { return fmt.format(new Date(iso)); } catch { return iso; }
}

// --- Bookies chips ---
function renderBestChips(bookTable) {
  if (!bookTable || !bookTable.best) return '';
  const left  = bookTable.best.left  || {};
  const right = bookTable.best.right || {};
  const chip = (agencyRaw, odds) => {
    const agency = cleanAgencyName(agencyRaw || '');
    if (!agency || odds == null) return '';
    const oddsTxt = Number(odds).toFixed(2);
    return `
      <div class="bookie-chip">
        <div class="bookie-identity min-w-0">
          <img src="${logoFor(agency)}" alt="${agency}" onerror="this.src='/logos/placeholder.jpeg'">
          <span class="bookie-name truncate">${agency}</span>
        </div>
        <span class="bookie-odds tabular-nums">${oddsTxt}</span>
      </div>`;
  };
  return `<div class="flex flex-col gap-2">${chip(left.agency, left.odds)}${chip(right.agency, right.odds)}</div>`;
}

// --- Expanded odds table ---
function renderFullBookTable(it) {
  const t = it.book_table;
  if (!t) return '';
  const headerL = t.headers?.[1] ?? 'Left';
  const headerR = t.headers?.[2] ?? 'Right';
  const rowsHtml = (t.rows || []).map(r => {
    const agency = cleanAgencyName(r.agency || '');
    const isBestL = t.best?.left?.agency && cleanAgencyName(t.best.left.agency) === agency && Number(t.best.left.odds).toFixed(2) === Number(r.left).toFixed(2);
    const isBestR = t.best?.right?.agency && cleanAgencyName(t.best.right.agency) === agency && Number(t.best.right.odds).toFixed(2) === Number(r.right).toFixed(2);
    const mark = (v, on) => `<span class="px-2 py-0.5 rounded ${on ? 'bg-amber-100 dark:bg-amber-900/40 font-semibold' : ''} tabular-nums">${v || ''}</span>`;
    return `
      <tr class="border-t border-slate-200 dark:border-slate-700">
        <td class="px-3 py-2"><div class="flex items-center gap-2">
          <img src="${logoFor(agency)}" class="w-5 h-5 rounded" onerror="this.src='/logos/placeholder.jpeg'"><span>${agency}</span></div></td>
        <td class="px-3 py-2 text-right">${mark(r.left, isBestL)}</td>
        <td class="px-3 py-2 text-right">${mark(r.right, isBestR)}</td>
        <td class="px-3 py-2 text-right text-slate-500 dark:text-slate-400">${r.updated || ''}</td>
      </tr>`;
  }).join('');
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

// === Pop-up Calculator =======================================================
const Calc = (() => {
  let modal, overlay, els = {};
  const fmtMoney = v => '$' + (Number(v)||0).toFixed(2);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function ensureModal() {
    if (modal) return;

    // Backdrop
    overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
      background: 'rgba(0,0,0,0.5)', zIndex: '2147483646', display: 'none',
    });
    overlay.addEventListener('click', close);

    // Modal
    modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      width: '95vw', maxWidth: '680px', borderRadius: '20px', overflow: 'hidden',
      padding: '12px', boxShadow: '0 10px 40px rgba(0,0,0,.25)',
      border: '1px solid rgba(100,116,139,.3)', zIndex: '2147483647', display: 'none',
    });
    modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');

    modal.innerHTML = `
      <div class="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div class="text-base font-semibold text-slate-800 dark:text-slate-100" id="calcTitle">Calculator</div>
        <button id="calcClose" class="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <path stroke="currentColor" stroke-width="2" d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>
      </div>

      <div class="px-6 py-5 bg-white dark:bg-slate-900">

        <!-- Side A -->
        <div id="cardA" class="calc-card">
          <div class="calc-left">
            <div class="calc-top">
              <div class="calc-id"><img id="calcAlogo" src="/logos/placeholder.jpeg" alt=""></div>
              <div class="name" id="calcAname">Side A</div>
            </div>
            <div class="calc-meta">Bet: <span id="calcAbet"></span></div>
            <div class="calc-meta">Payout: <span id="calcApayout" class="tabular-nums"></span></div>
          </div>
          <div class="calc-right">
            <div class="calc-odds">Odds: <span id="calcAodds" class="tabular-nums"></span></div>
            <div class="calc-stake">
              <span class="calc-meta">Stake</span>
              <input id="calcAstake" type="number" step="1" min="0">
              <button id="copyA" class="calc-copy" type="button">Copy</button>
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
            <div class="calc-meta">Bet: <span id="calcBbet"></span></div>
            <div class="calc-meta">Payout: <span id="calcBpayout" class="tabular-nums"></span></div>
          </div>
          <div class="calc-right">
            <div class="calc-odds">Odds: <span id="calcBodds" class="tabular-nums"></span></div>
            <div class="calc-stake">
              <span class="calc-meta">Stake</span>
              <input id="calcBstake" type="number" step="1" min="0">
              <button id="copyB" class="calc-copy" type="button">Copy</button>
            </div>
            <div id="ddB" class="calc-dd hidden"></div>
          </div>
        </div>

        <!-- Controls -->
        <div class="calc-controls mt-6">
          <div class="mb-3">
            <label class="block text-sm text-slate-500 mt-3 mb-1">Max stake</label>
            <input id="calcMaxStake" type="number" step="10" min="0" value="1000"
                   class="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
          </div>
          <div class="mb-4">
            <label class="block text-sm text-slate-500 mt-3 mb-1">Rounding</label>
            <select id="calcRound"
                    class="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
              <option value="10">Nearest $10</option>
              <option value="5">Nearest $5</option>
              <option value="1">Nearest $1</option>
            </select>
          </div>
        </div>

        <!-- Summary -->
        <div class="calc-summary mt-6">
          <div class="flex flex-wrap gap-2">
            <span class="pill">Total stake: <b id="calcTotal" class="tabular-nums"></b></span>
            <span class="pill">Min payout: <b id="calcMinPayout" class="tabular-nums"></b></span>
            <span class="pill"><span id="profitLabel"></span><b id="calcProfit" class="tabular-nums"></b></span>
          </div>
          <div class="calc-meta" id="calcHint"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // wire controls
    els = {
      title: modal.querySelector('#calcTitle'),
      close: modal.querySelector('#calcClose'),
      maxStake: modal.querySelector('#calcMaxStake'),
      round: modal.querySelector('#calcRound'),

      cardA: modal.querySelector('#cardA'),
      cardB: modal.querySelector('#cardB'),
      ddA: modal.querySelector('#ddA'),
      ddB: modal.querySelector('#ddB'),

      Aname: modal.querySelector('#calcAname'),
      Aodds: modal.querySelector('#calcAodds'),
      Alogo: modal.querySelector('#calcAlogo'),
      Astake: modal.querySelector('#calcAstake'),
      Apayout: modal.querySelector('#calcApayout'),
      copyA: modal.querySelector('#copyA'),
      Abet: modal.querySelector('#calcAbet'),

      Bname: modal.querySelector('#calcBname'),
      Bodds: modal.querySelector('#calcBodds'),
      Blogo: modal.querySelector('#calcBlogo'),
      Bstake: modal.querySelector('#calcBstake'),
      Bpayout: modal.querySelector('#calcBpayout'),
      copyB: modal.querySelector('#copyB'),
      Bbet: modal.querySelector('#calcBbet'),

      total: modal.querySelector('#calcTotal'),
      minPayout: modal.querySelector('#calcMinPayout'),
      profit: modal.querySelector('#calcProfit'),
      profitLabel: modal.querySelector('#profitLabel'),
      hint: modal.querySelector('#calcHint'),
    };

    els.close.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    els.copyA.addEventListener('click', () => navigator.clipboard.writeText(String(els.Astake.value || '')));
    els.copyB.addEventListener('click', () => navigator.clipboard.writeText(String(els.Bstake.value || '')));
    els.maxStake.addEventListener('change', () => autoSplit());
    els.round.addEventListener('change', () => autoSplit());
    els.Astake.addEventListener('input', manualRecalc);
    els.Bstake.addEventListener('input', manualRecalc);

    // Open dropdown by clicking the whole card (but ignore stake inputs & copy buttons)
    els.cardA.addEventListener('click', (e) => {
      if (e.target.closest('.calc-stake') || e.target.closest('.calc-dd')) return;
      toggleDD('A');
    });
    els.cardB.addEventListener('click', (e) => {
      if (e.target.closest('.calc-stake') || e.target.closest('.calc-dd')) return;
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
    const root = document.documentElement;
    modal.style.background = root.classList.contains('dark') ? 'rgb(15 23 42)' : '#ffffff';
    overlay.style.display = 'block';
    modal.style.display = 'block';
  }
  function close() { overlay.style.display = 'none'; modal.style.display = 'none'; }

  // core math
  function searchRounded(oA, oB, maxStake, step) {
    const stepAmt = Math.max(1, Number(step) || 10);
    const start = Math.floor((Math.max(0, Math.floor(maxStake))) / stepAmt) * stepAmt;
    const minTotal = Math.max(0, start - 100);

    const equalize = (total) => {
      const T = total / (1 / oA + 1 / oB);
      return { sA: T / oA, sB: T / oB };
    };
    const roundTo = (x, s) => Math.round(x / s) * s;

    function scoreCandidate(total, rA, rB) {
      if (rA < 0 || rB < 0) return null;
      if ((rA + rB) > total) return null;
      const payoutA = rA * oA, payoutB = rB * oB, used = rA + rB;
      const minPayout = Math.min(payoutA, payoutB);
      const profit = minPayout - used;
      const diff = Math.abs(payoutA - payoutB);
      const score = profit * 1e9 + used * 1e3 - diff;
      return { total, rA, rB, payoutA, payoutB, used, minPayout, profit, diff, score };
    }
    function shaveToFit(total, rA, rB) {
      while (rA + rB > total) {
        const tryA = (rA >= stepAmt) ? scoreCandidate(total, rA - stepAmt, rB) : null;
        const tryB = (rB >= stepAmt) ? scoreCandidate(total, rA, rB - stepAmt) : null;
        if (!tryA && !tryB) break;
        if (!tryB || (tryA && tryA.minPayout >= tryB.minPayout)) rA -= stepAmt; else rB -= stepAmt;
      }
      return { rA: Math.max(0, rA), rB: Math.max(0, rB) };
    }
    function topUpToTotal(total, rA, rB) {
      while (rA + rB + stepAmt <= total) {
        const addA = scoreCandidate(total, rA + stepAmt, rB);
        const addB = scoreCandidate(total, rA, rB + stepAmt);
        const pickA = addA && (!addB || addA.minPayout > addB.minPayout ||
                               (addA.minPayout === addB.minPayout && addA.diff < addB.diff));
        if (pickA) rA += stepAmt;
        else if (addB) rB += stepAmt;
        else break;
      }
      return { rA, rB };
    }

    let best = null;
    for (let total = start; total >= minTotal; total -= stepAmt) {
      if (total <= 0) break;
      const { sA, sB } = equalize(total);
      let rA = roundTo(sA, stepAmt), rB = roundTo(sB, stepAmt);
      ({ rA, rB } = shaveToFit(total, rA, rB));
      ({ rA, rB } = topUpToTotal(total, rA, rB));
      const cand = scoreCandidate(total, rA, rB);
      if (cand && (!best || cand.score > best.score)) best = cand;
    }
    return best || { total: 0, rA: 0, rB: 0, payoutA: 0, payoutB: 0, minPayout: 0, profit: 0, diff: Infinity, score: -Infinity };
  }

  let ctx = { oA:1.9, oB:1.9, aName:'', bName:'', aLogo:'', bLogo:'', optsA:[], optsB:[] };

  function autoSplit() {
    const maxStake = Math.max(0, Number(els.maxStake.value) || 1000);
    const step = Number(els.round.value) || 10;
    const res = searchRounded(ctx.oA, ctx.oB, maxStake, step);
    els.Astake.value = Math.max(0, Math.round(res.rA));
    els.Bstake.value = Math.max(0, Math.round(res.rB));
    manualRecalc();
    els.hint.textContent = `Checked totals from $${Math.floor(maxStake)} down $${Math.min(100, Math.floor(maxStake))} using $${step} steps; stakes are exact $${step} multiples.`;
  }

  function manualRecalc() {
    const sA = Math.max(0, Number(els.Astake.value) || 0);
    const sB = Math.max(0, Number(els.Bstake.value) || 0);
    const payoutA = sA * ctx.oA, payoutB = sB * ctx.oB;
    const total = sA + sB, minPayout = Math.min(payoutA, payoutB), profit = minPayout - total;
    const roiPct = total > 0 ? (profit/total)*100 : 0;
    els.total.textContent = fmtMoney(total);
    els.Apayout.textContent = fmtMoney(payoutA);
    els.Bpayout.textContent = fmtMoney(payoutB);
    els.minPayout.textContent = fmtMoney(minPayout);
    els.profitLabel.textContent = `Profit (${roiPct.toFixed(2)}%): `;
    els.profit.textContent = fmtMoney(profit);
  }

  function renderOptions(listEl, options, side) {
    listEl.innerHTML = options.map(o => `
      <div class="opt" data-agency="${o.agency}" data-odds="${o.odds}">
        <div class="left">
          <img src="${logoFor(o.agency)}" onerror="this.src='/logos/placeholder.jpeg'">
          <div class="name">${o.agency}</div>
        </div>
        <div class="odds">${(Number(o.odds)||0).toFixed(2)}</div>
      </div>
    `).join('');
    listEl.querySelectorAll('.opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const agency = opt.getAttribute('data-agency');
        const odds = Number(opt.getAttribute('data-odds') || '0');
        if (side === 'A') {
          ctx.aName = agency; ctx.oA = odds;
          els.Aname.textContent = agency; els.Alogo.src = logoFor(agency);
          els.Aodds.textContent = odds.toFixed(2);
        } else {
          ctx.bName = agency; ctx.oB = odds;
          els.Bname.textContent = agency; els.Blogo.src = logoFor(agency);
          els.Bodds.textContent = odds.toFixed(2);
        }
        autoSplit();
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

  function openCalc({ aName, bName, aOdds, bOdds, aLogo, bLogo, title, aBet='', bBet='', maxStake=1000, optionsA=[], optionsB=[] }) {
    ensureModal();
    ctx = { oA:Number(aOdds), oB:Number(bOdds), aName, bName, aLogo, bLogo, optsA:optionsA.slice(), optsB:optionsB.slice() };
    els.title.textContent = title || 'Calculator';

    els.Aname.textContent = aName || 'Side A';
    els.Bname.textContent = bName || 'Side B';
    els.Aodds.textContent = (Number(aOdds)||0).toFixed(2);
    els.Bodds.textContent = (Number(bOdds)||0).toFixed(2);
    els.Alogo.src = aLogo || '/logos/placeholder.jpeg';
    els.Blogo.src = bLogo || '/logos/placeholder.jpeg';
    els.Abet.textContent = aBet; els.Bbet.textContent = bBet;
    els.maxStake.value = maxStake;

    renderOptions(els.ddA, ctx.optsA, 'A');
    renderOptions(els.ddB, ctx.optsB, 'B');

    autoSplit();
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

// --- Generic checkbox panel renderer (fixed) ---
function renderCheckboxPanel({ items, wrapEl, selectAllEl, selectedSet, allKey, onChange }) {
  wrapEl.innerHTML = '';
  const treatAllSelected = (selectAllEl.checked === true) && (selectedSet.size === 0 || selectedSet.size >= items.length);
  items.forEach(v => {
    const id = `${allKey}-${v.toString().replace(/[^a-z0-9]/gi,'-').toLowerCase()}`;
    const isChecked = treatAllSelected ? true : selectedSet.has(v);
    const row = document.createElement('label');
    row.className = "inline-flex items-center gap-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800";
    row.innerHTML = `<input type="checkbox" id="${id}" class="rounded" ${isChecked ? 'checked' : ''} data-val="${v}"><span class="truncate">${v}</span>`;
    wrapEl.appendChild(row);
  });

  selectAllEl.checked = treatAllSelected;

  wrapEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const val = cb.getAttribute('data-val');
      if (selectAllEl.checked === true && selectedSet.size === 0) items.forEach(v => selectedSet.add(v));
      if (cb.checked) selectedSet.add(val); else selectedSet.delete(val);
      if (selectedSet.size >= items.length) { selectedSet.clear(); selectAllEl.checked = true; } else selectAllEl.checked = false;
      onChange();
    });
  });

  selectAllEl.onchange = () => {
    if (selectAllEl.checked) { selectedSet.clear(); wrapEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true); }
    else { selectedSet.clear(); wrapEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); }
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

// --- Fetch + render ---
async function fetchData() {
  if (els.tzSelect) els.tzSelect.value = state.tz;

  const res = await fetch(`/api/opportunities?${qs()}`);
  const { items, total, page, pages, lastUpdated, sports, leagues, agencies } = await res.json();

  // meta
  els.lastUpdated.textContent = lastUpdated ? fmtWithTZ(lastUpdated) : '—';
  els.totalCount.textContent = total;
  els.page.textContent = page;
  els.pages.textContent = pages;
  els.prev.disabled = page <= 1;
  els.next.disabled = page >= pages;

  // Sports
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

  // Leagues
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

  // Bookies
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

  // Rows
  els.tbody.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (const it of items) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50';

    const roiPct = ((Number(it.roi) || 0) * 100).toFixed(2) + '%';
    const bets = parseBets(it.match);
    const kickoffTxt = it.kickoff ? fmtWithTZ(it.kickoff) : (it.date || it.dateISO || '');
    const leagueCell = it.league || '—';
    const bookiesCell = it.book_table ? renderBestChips(it.book_table) : `<span class="text-slate-400">—</span>`;

    // Build options arrays for each side from full table
    let optionsPacked = '';
    if (it.book_table?.rows?.length) {
      const rows = it.book_table.rows;
      const optsA = rows.map(r => ({ agency: cleanAgencyName(r.agency||''), odds: Number(r.left)  })).filter(o=>o.agency && o.odds>0);
      const optsB = rows.map(r => ({ agency: cleanAgencyName(r.agency||''), odds: Number(r.right) })).filter(o=>o.agency && o.odds>0);
      optionsPacked = btoa(unescape(encodeURIComponent(JSON.stringify({A:optsA, B:optsB}))));
    }

    // Get best sides
    let aName='', bName='', aOdds=0, bOdds=0, aLogo='', bLogo='';
    if (it.book_table?.best) {
      const left=it.book_table.best.left||{}, right=it.book_table.best.right||{};
      aName = cleanAgencyName(left.agency||''); bName = cleanAgencyName(right.agency||'');
      aOdds = Number(left.odds)||0; bOdds = Number(right.odds)||0;
      aLogo = logoFor(aName); bLogo = logoFor(bName);
    }
    const title = `${it.game || ''} — ${it.market || ''}`.replace(/"/g, '&quot;');
    const headerL = it.book_table?.headers?.[1] || bets.top || 'Left';
    const headerR = it.book_table?.headers?.[2] || bets.bottom || 'Right';

    // Store calc data on the row (so clicking the row opens the calc)
    tr.dataset.calc = JSON.stringify({
      aName,bName,aOdds,bOdds,aLogo,bLogo,title,aBet:headerL,bBet:headerR,optionsPacked
    });

    // “Odds table” button now goes in the calc column
    const oddsBtn = `
      <button class="toggle-odds p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Show odds table">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 inline-block" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
          <path d="M8 7h8M7 11h10M7 15h10M7 19h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>`;

    tr.innerHTML = `
      <td class="px-4 py-3 whitespace-nowrap">${kickoffTxt}</td>
      <td class="px-4 py-3 whitespace-nowrap">${it.sport || ''}</td>
      <td class="px-4 py-3 whitespace-nowrap">${leagueCell}</td>
      <td class="px-4 py-3">${it.game || ''}</td>
      <td class="px-4 py-3">${it.market || ''}</td>
      <td class="px-4 py-3 text-right font-semibold tabular-nums">${roiPct}</td>
      <td class="px-4 py-3">
        <div class="flex flex-col gap-1">
          <div>${bets.top}</div>
          <div>${bets.bottom}</div>
        </div>
      </td>
      <td class="px-4 py-3">${bookiesCell}</td>
      <td class="px-2 py-3 text-center">${oddsBtn}</td>
    `;

    // details row
    const trDetails = document.createElement('tr');
    trDetails.className = 'hidden';
    const tdDetails = document.createElement('td');
    tdDetails.colSpan = 9;
    tdDetails.innerHTML = it.book_table ? renderFullBookTable(it) : '';
    trDetails.appendChild(tdDetails);

    // add to fragment
    const bundle = document.createDocumentFragment();
    bundle.appendChild(tr); bundle.appendChild(trDetails);
    frag.appendChild(bundle);

    // Clicking the **row** opens calculator
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.toggle-odds')) return; // the button has its own behavior
      const payload = JSON.parse(tr.dataset.calc || '{}');
      let optionsA=[], optionsB=[];
      try {
        if (payload.optionsPacked) {
          const decoded = JSON.parse(decodeURIComponent(escape(atob(payload.optionsPacked))));
          optionsA = decoded.A || []; optionsB = decoded.B || [];
        }
      } catch {}
      Calc.openCalc({
        aName: payload.aName, bName: payload.bName,
        aOdds: payload.aOdds, bOdds: payload.bOdds,
        aLogo: payload.aLogo, bLogo: payload.bLogo,
        title: payload.title, aBet: payload.aBet, bBet: payload.bBet,
        maxStake: 1000, optionsA, optionsB
      });
    });

    // Clicking the **button** toggles odds table
    tr.querySelector('.toggle-odds').addEventListener('click', (e) => {
      e.stopPropagation();
      trDetails.classList.toggle('hidden');
      if (!trDetails.classList.contains('hidden')) {
        const rect = trDetails.getBoundingClientRect();
        if (rect.bottom > window.innerHeight) trDetails.scrollIntoView({ block: 'nearest' });
      }
    });
  }

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
  state.tz = els.tzSelect.value;
  localStorage.setItem('tzMode', state.tz);
  fetchData();
});

// init
fetchData();
