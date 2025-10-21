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

// --- Calc modal compact styles (scoped) ---
(() => {
  const css = `
  .calc-card{border:1px solid rgb(226 232 240/1);border-radius:14px;padding:12px;background:var(--calc-bg,#fff)}
  .dark .calc-card{border-color:rgb(51 65 85/1);background:rgb(15 23 42/1)}
  .calc-row{display:flex;align-items:center;gap:.75rem;justify-content:space-between}
  .calc-id{display:flex;align-items:center;gap:.5rem;min-width:0}
  .calc-id img{width:20px;height:20px;border-radius:6px;flex:none}
  .calc-id .name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .calc-odds{font-variant-numeric:tabular-nums;opacity:.85}
  .calc-stake{display:flex;align-items:center;gap:.5rem}
  .calc-stake input{width:110px;padding:.375rem .5rem;border:1px solid rgb(203 213 225/1);border-radius:10px;background:var(--calc-bg,#fff)}
  .dark .calc-stake input{border-color:rgb(71 85 105/1);background:rgb(30 41 59/1)}
  .calc-copy{font-size:.75rem;padding:.375rem .5rem;border-radius:8px;background:rgb(241 245 249/1)}
  .dark .calc-copy{background:rgb(30 41 59/1)}
  .calc-meta{font-size:.75rem;color:rgb(100 116 139/1)}
  .dark .calc-meta{color:rgb(148 163 184/1)}
  .calc-summary{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between;border-top:1px solid rgb(226 232 240/1);padding-top:12px}
  .dark .calc-summary{border-color:rgb(51 65 85/1)}
  .pill{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .6rem;border-radius:999px;background:rgb(241 245 249/1)}
  .dark .pill{background:rgb(30 41 59/1)}
  .pill b{font-variant-numeric:tabular-nums}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

(() => {
  const style = document.createElement('style');
  style.textContent = `
    #calcRecalc{background:#1d4ed8 !important;color:#fff}
    #calcRecalc:hover{filter:brightness(0.95)}
  `;
  document.head.appendChild(style);
})();

(() => {
  const css = `
  /* Card = 2 columns: left (identity+meta), right (odds+stake) */
  .calc-card{
    display:grid;
    grid-template-columns: 1fr auto;
    align-items:center;
    gap:16px;
    border:1px solid rgb(226 232 240/1);
    border-radius:16px;
    padding:16px;
    background:var(--calc-bg,#fff)
  }
  .dark .calc-card{border-color:rgb(51 65 85/1);background:rgb(15 23 42/1)}

  .calc-left{display:flex;flex-direction:column;gap:6px;min-width:0}
  .calc-top{display:flex;align-items:center;gap:.6rem}
  .calc-id img{width:22px;height:22px;border-radius:6px;flex:none}
  .calc-id .name{font-weight:700;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  .calc-right{display:flex;align-items:center;gap:14px}
  .calc-odds{font-variant-numeric:tabular-nums;opacity:.9;font-weight:600}
  .calc-stake{display:flex;align-items:center;gap:.5rem}
  .calc-stake input{width:128px;padding:.45rem .6rem;border:1px solid rgb(203 213 225/1);border-radius:10px;background:var(--calc-bg,#fff);font-size:0.95rem}
  .dark .calc-stake input{border-color:rgb(71 85 105/1);background:rgb(30 41 59/1)}
  .calc-copy{font-size:.78rem;padding:.4rem .6rem;border-radius:8px;background:rgb(241 245 249/1)}
  .dark .calc-copy{background:rgb(30 41 59/1)}

  .calc-meta{font-size:.85rem;color:rgb(100 116 139/1)}
  .dark .calc-meta{color:rgb(148 163 184/1)}

  /* Recalc always hover colour */
  #calcRecalc{background:#1d4ed8 !important;color:#fff}
  #calcRecalc:hover{filter:brightness(0.95)}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

(() => {
  const style = document.createElement('style');
  style.textContent = `
    /* Stack odds above stake on the right side */
    .calc-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px}

    /* Slightly more breathing room above the divider that precedes the pills */
    .calc-summary{padding-top:16px}
  `;
  document.head.appendChild(style);
})();

(() => {
  const style = document.createElement('style');
  style.textContent = `
    /* Extra space above the pills divider */
    .calc-summary { margin-top: 18px; padding-top: 14px; }
  `;
  document.head.appendChild(style);
})();

// --- App state ---
const state = {
  sortBy: 'roi',
  sortDir: 'desc',
  page: 1,
  pageSize: 15,
  filters: {
    dateFrom: '',
    dateTo: '',
    minRoi: 0,
  },
  tz: localStorage.getItem('tzMode') || 'AEST',
  selectedBookies: new Set(JSON.parse(localStorage.getItem('bookiesSelected') || '[]')),
  selectedSports: new Set(JSON.parse(localStorage.getItem('sportsSelected') || '[]')),
  selectedLeagues: new Set(JSON.parse(localStorage.getItem('leaguesSelected') || '[]')),
  _agencies: [],
  _sports: [],
  _leagues: [], // array of league names (strings)
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

  // Sports dropdown UI
  sportsWrapper: document.getElementById('sportsWrapper'),
  sportsDropdown: document.getElementById('sportsDropdown'),
  sportsSummary: document.getElementById('sportsSummary'),
  sportsPanel: document.getElementById('sportsPanel'),
  sportsChkWrap: document.getElementById('sportsChkWrap'),
  sportsSelectAll: document.getElementById('sportsSelectAll'),
  sportsSelectedCount: document.getElementById('sportsSelectedCount'),

  // Leagues dropdown UI
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
  addCsv(state.selectedLeagues, state._leagues, 'leagues'); // send leagues by name

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
// Creates a singleton modal and exposes openCalc(data)

const Calc = (() => {
  let modal, overlay, els = {};
  const fmtMoney = v => '$' + (Number(v)||0).toFixed(2);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function ensureModal() {
    if (modal) return;

    // Backdrop (inline styles to beat any CSS)
    overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0', top: '0', right: '0', bottom: '0',
      background: 'rgba(0,0,0,0.5)',
      zIndex: '2147483646',   // just below modal
      display: 'none',
    });
    overlay.addEventListener('click', close);

    // Modal (centered, highest z-index)
    modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      left: '50%', top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '95vw',
      maxWidth: '680px',
      borderRadius: '20px',
      overflow: 'hidden',
      padding: '12px',
      boxShadow: '0 10px 40px rgba(0,0,0,.25)',
      border: '1px solid rgba(100,116,139,.3)',
      zIndex: '2147483647',
      display: 'none',
    });


    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

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
        <div class="calc-card">
          <div class="calc-left">
            <div class="calc-top">
              <div class="calc-id">
                <img id="calcAlogo" src="/logos/placeholder.jpeg" alt="">
              </div>
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
              <button id="copyA" class="calc-copy">Copy</button>
            </div>
          </div>
        </div>

        <!-- Side B -->
        <div class="calc-card" style="margin-top:12px">
          <div class="calc-left">
            <div class="calc-top">
              <div class="calc-id">
                <img id="calcBlogo" src="/logos/placeholder.jpeg" alt="">
              </div>
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
              <button id="copyB" class="calc-copy">Copy</button>
            </div>
          </div>
        </div>

        <!-- Controls (stacked) -->
        <div class="calc-controls mt-6">
          <div class="mb-3">
            <label class="block text-xs text-slate-500 mb-1">Max stake</label>
            <input id="calcMaxStake" type="number" step="10" min="0" value="1000"
                   class="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
          </div>

          <div class="mb-4">
            <label class="block text-xs text-slate-500 mb-1">Rounding</label>
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





    // append as last children of body (portal)
    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // wire controls
    els = {
      title: modal.querySelector('#calcTitle'),
      close: modal.querySelector('#calcClose'),
      //close2: modal.querySelector('#calcClose2'),
      //recalc: modal.querySelector('#calcRecalc'),
      maxStake: modal.querySelector('#calcMaxStake'),
      round: modal.querySelector('#calcRound'),
      Aname: modal.querySelector('#calcAname'),
      Aodds: modal.querySelector('#calcAodds'),
      Alogo: modal.querySelector('#calcAlogo'),
      Astake: modal.querySelector('#calcAstake'),
      Apayout: modal.querySelector('#calcApayout'),
      copyA: modal.querySelector('#copyA'),
      Bname: modal.querySelector('#calcBname'),
      Bodds: modal.querySelector('#calcBodds'),
      Blogo: modal.querySelector('#calcBlogo'),
      Bstake: modal.querySelector('#calcBstake'),
      Bpayout: modal.querySelector('#calcBpayout'),
      copyB: modal.querySelector('#copyB'),
      total: modal.querySelector('#calcTotal'),
      minPayout: modal.querySelector('#calcMinPayout'),
      profit: modal.querySelector('#calcProfit'),
      hint: modal.querySelector('#calcHint'),
      Abet: modal.querySelector('#calcAbet'),
      Bbet: modal.querySelector('#calcBbet'),
      Roi: modal.querySelector('#calcRoi'),
      profitLabel: modal.querySelector('#profitLabel'),
    };

    els.close.addEventListener('click', close);
    //els.close2.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    els.copyA.addEventListener('click', () => navigator.clipboard.writeText(String(els.Astake.value || '')));
    els.copyB.addEventListener('click', () => navigator.clipboard.writeText(String(els.Bstake.value || '')));

    //els.recalc.addEventListener('click', () => autoSplit());
    els.maxStake.addEventListener('change', () => autoSplit());
    els.round.addEventListener('change', () => autoSplit());
    els.Astake.addEventListener('input', manualRecalc);
    els.Bstake.addEventListener('input', manualRecalc);
  }

  function show() {
    //document.documentElement.style.overflow = 'hidden'; // lock background scroll
    const root = document.documentElement;
    modal.style.background = root.classList.contains('dark') ? 'rgb(15 23 42)' : '#ffffff';
    overlay.style.display = 'block';
    modal.style.display = 'block';
  }

  function close() {
    //document.documentElement.style.overflow = '';
    overlay.style.display = 'none';
    modal.style.display = 'none';
  }


  // core math
  function equalize(total, oA, oB) {
    // equal-payout baseline (unrounded)
    const T = total / (1/oA + 1/oB);       // target payout
    const sA = T / oA;
    const sB = T / oB;
    return { sA, sB, T };
  }

  function roundTo(x, step) {
    return Math.round(x/step)*step;
  }

  // Try totals from maxStake down to (maxStake - 100) in $1 steps.
  // For each total, round stakes to `step` but also allow $1 micro-tweaks
  // around the rounded split to maximize *minimum profit*.
  function searchRounded(oA, oB, maxStake, step) {
    const stepAmt = Math.max(1, Number(step) || 10);

    // Start at a step-aligned total; search down by `stepAmt`, for up to $100.
    const start = Math.floor((Math.max(0, Math.floor(maxStake))) / stepAmt) * stepAmt;
    const minTotal = Math.max(0, start - 100);

    const roundTo = (x, s) => Math.round(x / s) * s;

    // Equal-payout baseline (unrounded)
    const equalize = (total) => {
      const T = total / (1 / oA + 1 / oB);
      return { sA: T / oA, sB: T / oB };
    };

    // Score: max min-profit, then more used stake, then closer payouts
    function scoreCandidate(total, rA, rB) {
      if (rA < 0 || rB < 0) return null;
      if ((rA + rB) > total) return null;

      const payoutA = rA * oA;
      const payoutB = rB * oB;
      const used = rA + rB;
      const minPayout = Math.min(payoutA, payoutB);
      const profit = minPayout - used;
      const diff = Math.abs(payoutA - payoutB);

      const score = profit * 1e9 + used * 1e3 - diff; // tie-breakers
      return { total, rA, rB, payoutA, payoutB, used, minPayout, profit, diff, score };
    }

    // If over total, reduce in `stepAmt` chunks choosing the reduction that hurts min payout least
    function shaveToFit(total, rA, rB) {
      while (rA + rB > total) {
        const tryA = (rA >= stepAmt) ? scoreCandidate(total, rA - stepAmt, rB) : null;
        const tryB = (rB >= stepAmt) ? scoreCandidate(total, rA, rB - stepAmt) : null;

        if (!tryA && !tryB) break;
        if (!tryB || (tryA && tryA.minPayout >= tryB.minPayout)) rA -= stepAmt;
        else rB -= stepAmt;
      }
      return { rA: Math.max(0, rA), rB: Math.max(0, rB) };
    }

    // If slack remains, add in `stepAmt` chunks to improve minimum payout the most
    function topUpToTotal(total, rA, rB) {
      while (rA + rB + stepAmt <= total) {
        const addA = scoreCandidate(total, rA + stepAmt, rB);
        const addB = scoreCandidate(total, rA, rB + stepAmt);

        // pick the addition that gives higher minPayout; tie → reduce payout diff
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

      // 1) equalize, 2) round to step, 3) shave to fit, 4) top up with step chunks
      const { sA, sB } = equalize(total);
      let rA = roundTo(sA, stepAmt);
      let rB = roundTo(sB, stepAmt);

      ({ rA, rB } = shaveToFit(total, rA, rB));
      ({ rA, rB } = topUpToTotal(total, rA, rB));

      const cand = scoreCandidate(total, rA, rB);
      if (cand && (!best || cand.score > best.score)) best = cand;
    }

    return best || { total: 0, rA: 0, rB: 0, payoutA: 0, payoutB: 0, minPayout: 0, profit: 0, diff: Infinity, score: -Infinity };
  }

  let ctx = { oA:1.9, oB:1.9, aName:'', bName:'', aLogo:'', bLogo:'' };

  function autoSplit() {
    const maxStake = clamp(Number(els.maxStake.value) || 1000, 0, 1e7);
    const step = Number(els.round.value) || 10;

    const res = searchRounded(ctx.oA, ctx.oB, maxStake, step);
    els.Astake.value = Math.max(0, Math.round(res.rA));
    els.Bstake.value = Math.max(0, Math.round(res.rB));

    updateOutputs();
    els.hint.textContent = `Checked totals from $${Math.floor(maxStake)} down $${Math.min(100, Math.floor(maxStake))} using $${step} steps; stakes are exact $${step} multiples.`;
  }

  function manualRecalc() {
    const sA = Math.max(0, Number(els.Astake.value) || 0);
    const sB = Math.max(0, Number(els.Bstake.value) || 0);
    const payoutA = sA * ctx.oA;
    const payoutB = sB * ctx.oB;
    const total   = sA + sB;
    const minPayout = Math.min(payoutA, payoutB);
    const profit    = minPayout - total;
    const roiPct    = total > 0 ? (profit / total) * 100 : 0;

    els.total.textContent     = fmtMoney(total);
    els.Apayout.textContent   = fmtMoney(payoutA);
    els.Bpayout.textContent   = fmtMoney(payoutB);
    els.minPayout.textContent = fmtMoney(minPayout);

    // Label is plain text to avoid any spacing surprises
    els.profitLabel.textContent = `Profit (${roiPct.toFixed(2)}%): `;
    els.profit.textContent      = fmtMoney(profit);
  }


  function updateOutputs() {
    // recompute based on entered stakes
    manualRecalc();
  }

  function openCalc({ aName, bName, aOdds, bOdds, aLogo, bLogo, title, aBet = '', bBet = '', maxStake = 1000 }) {
    ensureModal();
    ctx = { oA: Number(aOdds), oB: Number(bOdds), aName, bName, aLogo, bLogo };

    els.title.textContent = title || 'Calculator';
    els.Aname.textContent = aName || 'Side A';
    els.Bname.textContent = bName || 'Side B';
    els.Aodds.textContent = (Number(aOdds)||0).toFixed(2);
    els.Bodds.textContent = (Number(bOdds)||0).toFixed(2);
    els.Alogo.src = aLogo || '/logos/placeholder.jpeg';
    els.Blogo.src = bLogo || '/logos/placeholder.jpeg';
    els.Abet.textContent = aBet;
    els.Bbet.textContent = bBet;
    els.maxStake.value = maxStake;

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
    const j = await res.json();
    ok = j.ok; msg = j.message || j.error || '';
  } catch (e) {
    msg = String(e);
  }

  if (!ok) {
    status.textContent = `Failed: ${msg || 'Unknown error'}`;
    btn.disabled = false;
    return;
  }

  status.textContent = 'Updating… (this can take a few minutes)';
  const start = Date.now();
  const limitMs = 5 * 60 * 1000;
  const intervalMs = 15000;

  const poll = async () => {
    await fetchData();
    const nowTotal = Number(document.getElementById('totalCount').textContent) || 0;
    if (nowTotal !== beforeTotal) {
      status.textContent = 'Updated ✔';
      btn.disabled = false;
      setTimeout(() => (status.textContent=''), 4000);
      return;
    }
    if (Date.now() - start > limitMs) {
      status.textContent = 'No change detected yet.';
      btn.disabled = false;
    } else {
      setTimeout(poll, intervalMs);
    }
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

      if (selectAllEl.checked === true && selectedSet.size === 0) {
        items.forEach(v => selectedSet.add(v));
      }

      if (cb.checked) selectedSet.add(val);
      else selectedSet.delete(val);

      if (selectedSet.size >= items.length) {
        selectedSet.clear();
        selectAllEl.checked = true;
      } else {
        selectAllEl.checked = false;
      }

      onChange();
    });
  });

  selectAllEl.onchange = () => {
    if (selectAllEl.checked) {
      selectedSet.clear();
      wrapEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    } else {
      selectedSet.clear();
      wrapEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
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
  panelEl.style.left = '';
  panelEl.style.right = '';

  const wasHidden = panelEl.classList.contains('hidden');
  if (wasHidden) { panelEl.classList.remove('hidden'); panelEl.style.visibility = 'hidden'; }

  const wrapRect = wrapperEl.getBoundingClientRect();
  const panelRect = panelEl.getBoundingClientRect();
  const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const margin = 8;

  const fitsLeft = wrapRect.left + panelRect.width <= vw - margin;
  const fitsRight = wrapRect.right - panelRect.width >= margin;

  if (fitsLeft)      panelEl.style.left = '0';
  else if (fitsRight)panelEl.style.right = '0';
  else {
    const availLeft = wrapRect.right - margin;
    const availRight = vw - wrapRect.left - margin;
    const targetSide = availRight >= availLeft ? 'left' : 'right';
    panelEl.style.maxWidth = `${Math.max(availLeft, availRight)}px`;
    if (targetSide === 'left') panelEl.style.left = '0';
    else                       panelEl.style.right = '0';
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

// Wire all three dropdowns
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
      items: state._sports,
      wrapEl: els.sportsChkWrap,
      selectAllEl: els.sportsSelectAll,
      selectedSet: state.selectedSports,
      allKey: 'sport',
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

  // Leagues (display names)
  const lgNow = JSON.stringify(leagues || []);
  const lgPrev = JSON.stringify(state._leagues || []);
  if (lgNow !== lgPrev) {
    state._leagues = (leagues || []).slice();
    renderCheckboxPanel({
      items: state._leagues,
      wrapEl: els.leaguesChkWrap,
      selectAllEl: els.leaguesSelectAll,
      selectedSet: state.selectedLeagues,
      allKey: 'league',
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
      items: state._agencies,
      wrapEl: els.bookiesChkWrap,
      selectAllEl: els.bookiesSelectAll,
      selectedSet: state.selectedBookies,
      allKey: 'bookie',
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

    // ---- NEW: precompute calculator cell (no IIFE) ----
    let calcCell = '<span class="text-slate-300">—</span>';
    if (it.book_table && it.book_table.best) {
      const left  = it.book_table.best.left  || {};
      const right = it.book_table.best.right || {};
      const aName = cleanAgencyName(left.agency || '');
      const bName = cleanAgencyName(right.agency || '');
      const aOdds = Number(left.odds);
      const bOdds = Number(right.odds);

      if (aName && bName && aOdds > 0 && bOdds > 0) {
        const aLogo = logoFor(aName);
        const bLogo = logoFor(bName);
        const title = `${it.game || ''} — ${it.market || ''}`.replace(/"/g, '&quot;');

        const headerL = it.book_table?.headers?.[1] || bets.top || 'Left';
        const headerR = it.book_table?.headers?.[2] || bets.bottom || 'Right';

        calcCell = `
          <button class="calc-btn p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Open calculator"
            data-aname="${aName}"
            data-bname="${bName}"
            data-aodds="${aOdds}"
            data-bodds="${bOdds}"
            data-alogo="${aLogo}"
            data-blogo="${bLogo}"
            data-title="${title}"
            data-abet="${headerL}"
            data-bbet="${headerR}">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 inline-block" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M8 7h8M7 11h3M7 15h3M7 19h3M14 11h3M14 15h3M14 19h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>`;

      }
    }
    // ---------------------------------------------------

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
      <td class="px-2 py-3 text-center">${calcCell}</td>
    `;

    // details row stays the same, just ensure colSpan=9
    const trDetails = document.createElement('tr');
    trDetails.className = 'hidden';
    const tdDetails = document.createElement('td');
    tdDetails.colSpan = 9;
    tdDetails.innerHTML = it.book_table ? renderFullBookTable(it) : '';
    trDetails.appendChild(tdDetails);

    // append both
    const fragRow = document.createDocumentFragment();
    fragRow.appendChild(tr);
    fragRow.appendChild(trDetails);
    frag.appendChild(fragRow);

    // toggle on row click
    tr.addEventListener('click', (e) => {
      if (isInteractive(e.target)) return;
      const isHidden = trDetails.classList.contains('hidden');
      trDetails.classList.toggle('hidden');
      if (isHidden) {
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

  renderCheckboxPanel({
    items: state._sports, wrapEl: els.sportsChkWrap, selectAllEl: els.sportsSelectAll,
    selectedSet: state.selectedSports, allKey: 'sport', onChange: ()=>{}
  });
  renderCheckboxPanel({
    items: state._leagues, wrapEl: els.leaguesChkWrap, selectAllEl: els.leaguesSelectAll,
    selectedSet: state.selectedLeagues, allKey: 'league', onChange: ()=>{}
  });
  renderCheckboxPanel({
    items: state._agencies, wrapEl: els.bookiesChkWrap, selectAllEl: els.bookiesSelectAll,
    selectedSet: state.selectedBookies, allKey: 'bookie', onChange: ()=>{}
  });
  updateSummaryText(state.selectedSports, state._sports, els.sportsSummary, 'All sports');
  updateSummaryText(state.selectedLeagues, state._leagues, els.leaguesSummary, 'All leagues');
  updateSummaryText(state.selectedBookies, state._agencies, els.bookiesSummary, 'All bookies');

  updateAndFetch();
});

els.tbody.addEventListener('click', (e) => {
  const btn = e.target.closest('.calc-btn');
  if (!btn) return;

  const data = {
    aName: btn.getAttribute('data-aname') || 'Side A',
    bName: btn.getAttribute('data-bname') || 'Side B',
    aOdds: Number(btn.getAttribute('data-aodds') || '0'),
    bOdds: Number(btn.getAttribute('data-bodds') || '0'),
    aLogo: btn.getAttribute('data-alogo') || '/logos/placeholder.jpeg',
    bLogo: btn.getAttribute('data-blogo') || '/logos/placeholder.jpeg',
    title: btn.getAttribute('data-title') || 'Calculator',
    aBet: btn.getAttribute('data-abet') || '',
    bBet: btn.getAttribute('data-bbet') || '',
    maxStake: 1000
  };
  Calc.openCalc(data);
  e.stopPropagation(); // don't toggle the row expansion
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
