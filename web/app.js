// --- Theme toggle ---

// ==== DIAGNOSTIC BANNER ====
console.log("ARB app.js build 2025-11-12-09");

// --- Theme (fixed to dark) ---
(() => {
  document.documentElement.classList.add('dark');
})();

// ONE consolidated style injection
(() => {
  const css = `
    /* --- Bookies dropdown: compact icons + checkbox spacing --- */
    .bookie-icon-16 { width:18px; height:18px; border-radius:4px; flex:none; }
    .chk-input { margin-right:.5rem; } /* keeps space between checkbox and label text */

    /* --- Calculator styles (unchanged) --- */
    .calc-card{
      position:relative; display:grid; grid-template-columns:1fr auto; align-items:center; gap:16px;
      border:1px solid rgb(226 232 240/1); border-radius:16px; padding:16px; background:var(--calc-bg,#fff); cursor:pointer;
    }
    .dark .calc-card{border-color:rgb(51 65 85/1);background:rgb(15 23 42/1)}
    .calc-left{display:flex;flex-direction:column;gap:6px;min-width:0}
    .calc-top{display:flex;align-items:center;gap:.6rem}
    .calc-id img{width:22px;height:22px;border-radius:6px;flex:none}
    .calc-id .name{font-weight:700;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .calc-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
    .calc-odds{font-variant-numeric:tabular-nums;opacity:.9;font-weight:600}
    .calc-stake{display:flex;align-items:center;gap:.5rem}
    .calc-stake input{
      width:128px; padding:.45rem .6rem; border:1px solid rgb(203 213 225/1); border-radius:10px;
      background:var(--calc-bg,#fff); font-size:.95rem;
    }
    .dark .calc-stake input{border-color:rgb(71 85 105/1);background:rgb(30 41 59/1)}
    .calc-copy{font-size:.78rem;padding:.4rem .6rem;border-radius:8px;background:rgb(241 245 249/1);cursor:pointer}
    .dark .calc-copy{background:rgb(30 41 59/1)}
    .calc-meta{font-size:.90rem;color:rgb(100 116 139/1)}
    .dark .calc-meta{color:rgb(148 163 184/1)}
    .calc-controls > div > label{margin-top:12px}
    .calc-controls label{font-size:.95rem}
    .calc-summary{
      border-top:1px solid rgb(226 232 240/1); margin-top:18px; padding-top:14px;
      display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between;
    }
    .dark .calc-summary{border-color:rgb(51 65 85/1)}
    .pill{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .6rem;border-radius:999px;background:rgb(241 245 249/1)}
    .dark .pill{background:rgb(30 41 59/1)}
    .pill b{font-variant-numeric:tabular-nums}
    .calc-dd{
      position:absolute; right:16px; top:100%; margin-top:8px; min-width:280px; max-height:280px; overflow:auto;
      background:var(--calc-bg,#fff); border:1px solid rgb(226 232 240/1); border-radius:12px; box-shadow:0 12px 24px rgba(0,0,0,.25);
      z-index:2147483647;
    }
    .dark .calc-dd{background:rgb(15 23 42/1);border-color:rgb(51 65 85/1)}
    .calc-dd .opt{display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; cursor:pointer;}
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
  addCsv(state.selectedSports,  state._sports,   'sports');
  addCsv(state.selectedLeagues, state._leagues,  'leagues');

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

// --- ROI & pairing helpers ---
function roiFromOdds(a, b) {
  const edge = (1 / a) + (1 / b);
  if (edge >= 1) return -Infinity;   // not profitable
  return (1 / edge) - 1;             // correct ROI
}
function bestPairWithin(optionsLeft, optionsRight, allowedSetLeft, allowedSetRight) {
  const L = allowedSetLeft ? optionsLeft.filter(o => allowedSetLeft.has(cleanAgencyName(o.agency))) : optionsLeft;
  const R = allowedSetRight ? optionsRight.filter(o => allowedSetRight.has(cleanAgencyName(o.agency))) : optionsRight;
  let best = null;
  for (const a of L) {
    const ao = Number(a.odds);
    if (!(ao > 1)) continue;
    for (const b of R) {
      const bo = Number(b.odds);
      if (!(bo > 1)) continue;
      const roi = roiFromOdds(ao, bo);
      if (roi > 0 && (!best || roi > best.roi)) best = { left: a, right: b, roi };
    }
  }
  return best; // {left, right, roi} or null
}
function requiredLeftOdds(bestRight) { return 1 / (1 - 1 / Number(bestRight)); }
function requiredRightOdds(bestLeft) { return 1 / (1 - 1 / Number(bestLeft)); }
function countProfitableOnLeft(optionsLeft, bestRight, allowedSetLeft){
  if (!(bestRight > 1)) return 0;
  const need = requiredLeftOdds(bestRight);
  return optionsLeft.filter(o => (!allowedSetLeft || allowedSetLeft.has(cleanAgencyName(o.agency))) && Number(o.odds) >= need).length;
}
function countProfitableOnRight(optionsRight, bestLeft, allowedSetRight){
  if (!(bestLeft > 1)) return 0;
  const need = requiredRightOdds(bestLeft);
  return optionsRight.filter(o => (!allowedSetRight || allowedSetRight.has(cleanAgencyName(o.agency))) && Number(o.odds) >= need).length;
}

// --- Bookies chips (legacy best-only renderer; we now override dynamically) ---
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
// === Pop-up Calculator (NEW) =================================================
const Calc = (() => {
  let overlay, modal, els = {}, ctx = null;
  let mode = 'total'; // 'total' | 'A' | 'B'

  const fmtMoney = (v) => '$' + (Number(v) || 0).toFixed(2);
  const roundTo = (x, step) => Math.round((Number(x) || 0) / step) * step;

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function ensureModal() {
    if (modal) return;

    overlay = document.createElement('div');
    overlay.className = 'calc-overlay';
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close(); // click outside closes
    });

    modal = document.createElement('div');
    modal.className = 'calc-modal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');

    modal.innerHTML = `
      <div class="calc-head">
        <div>
          <h3 class="calc-title" id="calcTitle">Calculator</h3>
          <div class="calc-sub">Edit odds, choose rounding, lock a side to set its stake.</div>
        </div>
        <button class="calc-close" id="calcClose" type="button" aria-label="Close">✕</button>
      </div>

      <div class="calc-body">
        <div class="calc-legs">
          <!-- A -->
          <div class="leg-card" id="legA">
            <div class="leg-top">
              <div class="leg-id" id="pickA">
                <img id="calcAlogo" src="/logos/placeholder.jpeg" alt="">
                <div style="min-width:0">
                  <div class="leg-name" id="calcAname">Side A</div>
                  <div class="leg-bet">Bet: <span id="calcAbet"></span></div>
                </div>
              </div>
              <div class="leg-actions">
                <button class="swap-btn" id="changeA" type="button">Change</button>
                <button class="lock-btn" id="lockA" type="button">Lock stake</button>
              </div>
            </div>

            <div class="leg-fields">
              <div>
                <div class="flabel">Odds</div>
                <input class="fin" id="calcAoddsIn" inputmode="decimal" />
              </div>
              <div>
                <div class="flabel">Stake</div>
                <input class="fin" id="calcAstake" inputmode="numeric" />
              </div>
            </div>

            <div class="payout-row">
              <div>Payout: <b id="calcApayout" class="tabular-nums">$0.00</b></div>
              <div></div>
            </div>

            <div id="ddA" class="calc-dd hidden"></div>
          </div>

          <!-- B -->
          <div class="leg-card" id="legB">
            <div class="leg-top">
              <div class="leg-id" id="pickB">
                <img id="calcBlogo" src="/logos/placeholder.jpeg" alt="">
                <div style="min-width:0">
                  <div class="leg-name" id="calcBname">Side B</div>
                  <div class="leg-bet">Bet: <span id="calcBbet"></span></div>
                </div>
              </div>
              <div class="leg-actions">
                <button class="swap-btn" id="changeB" type="button">Change</button>
                <button class="lock-btn" id="lockB" type="button">Lock stake</button>
              </div>
            </div>

            <div class="leg-fields">
              <div>
                <div class="flabel">Odds</div>
                <input class="fin" id="calcBoddsIn" inputmode="decimal" />
              </div>
              <div>
                <div class="flabel">Stake</div>
                <input class="fin" id="calcBstake" inputmode="numeric" />
              </div>
            </div>

            <div class="payout-row">
              <div>Payout: <b id="calcBpayout" class="tabular-nums">$0.00</b></div>
              <div></div>
            </div>

            <div id="ddB" class="calc-dd hidden"></div>
          </div>
        </div>

        <div class="calc-controls">
          <div class="ctrl-card">
            <div class="flabel">Max stake (total)</div>
            <input class="fin" id="calcMaxStake" inputmode="numeric" value="1000">
          </div>
          <div class="ctrl-card">
            <div class="flabel">Rounding</div>
            <select class="fin" id="calcRound">
              <option value="10">Nearest $10</option>
              <option value="5">Nearest $5</option>
              <option value="1">Nearest $1</option>
            </select>
          </div>
        </div>
      </div>

      <div class="summary">
        <div>
          Total: <b id="calcTotal" class="tabular-nums">$0.00</b>
          &nbsp;&nbsp;•&nbsp;&nbsp;
          Min payout: <b id="calcMinPayout" class="tabular-nums">$0.00</b>
          &nbsp;&nbsp;•&nbsp;&nbsp;
          <span id="profitLabel">Profit (0.00%):</span> <b id="calcProfit" class="tabular-nums">$0.00</b>
        </div>
        <div style="color:rgba(148,163,184,.92)" id="calcModeText">Mode: Total stake</div>
      </div>
      <div class="summary-note" id="calcHint"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    els = {
      title: modal.querySelector('#calcTitle'),
      close: modal.querySelector('#calcClose'),

      maxStake: modal.querySelector('#calcMaxStake'),
      round: modal.querySelector('#calcRound'),

      Aname: modal.querySelector('#calcAname'),
      Alogo: modal.querySelector('#calcAlogo'),
      Abet:  modal.querySelector('#calcAbet'),
      AoddsIn: modal.querySelector('#calcAoddsIn'),
      Astake:  modal.querySelector('#calcAstake'),
      Apayout: modal.querySelector('#calcApayout'),
      ddA: modal.querySelector('#ddA'),
      changeA: modal.querySelector('#changeA'),
      lockA: modal.querySelector('#lockA'),

      Bname: modal.querySelector('#calcBname'),
      Blogo: modal.querySelector('#calcBlogo'),
      Bbet:  modal.querySelector('#calcBbet'),
      BoddsIn: modal.querySelector('#calcBoddsIn'),
      Bstake:  modal.querySelector('#calcBstake'),
      Bpayout: modal.querySelector('#calcBpayout'),
      ddB: modal.querySelector('#ddB'),
      changeB: modal.querySelector('#changeB'),
      lockB: modal.querySelector('#lockB'),

      total: modal.querySelector('#calcTotal'),
      minPayout: modal.querySelector('#calcMinPayout'),
      profit: modal.querySelector('#calcProfit'),
      profitLabel: modal.querySelector('#profitLabel'),
      hint: modal.querySelector('#calcHint'),
      modeText: modal.querySelector('#calcModeText'),
    };

    els.close.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // Persist + restore rounding/max stake
    const savedRound = localStorage.getItem('calcRoundStep');
    if (savedRound && ['1','5','10'].includes(savedRound)) els.round.value = savedRound;
    els.round.addEventListener('change', () => {
      localStorage.setItem('calcRoundStep', String(els.round.value || ''));
      recalc();
    });

    const savedMax = localStorage.getItem('calcMaxStake');
    if (savedMax && !Number.isNaN(Number(savedMax))) els.maxStake.value = savedMax;
    els.maxStake.addEventListener('change', () => {
      localStorage.setItem('calcMaxStake', String(els.maxStake.value || ''));
      recalc();
    });

    // odds edits
    els.AoddsIn.addEventListener('input', () => { mode = 'total'; syncModeUI(); recalc(); });
    els.BoddsIn.addEventListener('input', () => { mode = 'total'; syncModeUI(); recalc(); });

    // stake edits => lock that side
    els.Astake.addEventListener('input', () => { mode = 'A'; syncModeUI(); recalc(); });
    els.Bstake.addEventListener('input', () => { mode = 'B'; syncModeUI(); recalc(); });

    // lock buttons toggle
    els.lockA.addEventListener('click', () => { mode = (mode === 'A') ? 'total' : 'A'; syncModeUI(); recalc(); });
    els.lockB.addEventListener('click', () => { mode = (mode === 'B') ? 'total' : 'B'; syncModeUI(); recalc(); });

    // open dropdowns
    els.changeA.addEventListener('click', (e) => { e.stopPropagation(); toggleDD('A'); });
    els.changeB.addEventListener('click', (e) => { e.stopPropagation(); toggleDD('B'); });

    // click anywhere inside modal closes dropdowns unless inside
    modal.addEventListener('click', (e) => {
      const inA = e.target.closest('#ddA') || e.target.closest('#changeA');
      const inB = e.target.closest('#ddB') || e.target.closest('#changeB');
      if (!inA) els.ddA.classList.add('hidden');
      if (!inB) els.ddB.classList.add('hidden');
    });
  }

  function show() { overlay.classList.add('open'); }
  function close(){ overlay.classList.remove('open'); }

  function syncModeUI(){
    els.lockA.classList.toggle('active', mode === 'A');
    els.lockB.classList.toggle('active', mode === 'B');
    els.lockA.textContent = mode === 'A' ? 'Locked' : 'Lock stake';
    els.lockB.textContent = mode === 'B' ? 'Locked' : 'Lock stake';
    els.modeText.textContent =
      mode === 'total' ? 'Mode: Total stake' :
      mode === 'A' ? 'Mode: Locked A stake' : 'Mode: Locked B stake';
  }

  // core math (same idea as your old one)
  function searchRounded(oA, oB, maxStake, step) {
    const stepAmt = Math.max(1, Number(step) || 10);
    const start = Math.floor((Math.max(0, Math.floor(maxStake))) / stepAmt) * stepAmt;
    const minTotal = Math.max(0, start - 100);
    const equalize = (total) => {
      const T = total / (1 / oA + 1 / oB);
      return { sA: T / oA, sB: T / oB };
    };

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

  function solveOtherForEqualPayout(lockedStake, lockedOdds, otherOdds){
    if (!(lockedOdds > 1) || !(otherOdds > 1)) return 0;
    return (lockedStake * lockedOdds) / otherOdds;
  }

  function renderOptions(listEl, options, side) {
    const sorted = (options || [])
      .slice()
      .filter(o => Number(o.odds) > 1)
      .sort((a,b) => Number(b.odds || 0) - Number(a.odds || 0));

    listEl.innerHTML = sorted.map(o => `
      <div class="calc-opt" data-agency="${escapeHtml(o.agency)}" data-odds="${Number(o.odds)}">
        <div class="calc-opt-left">
          <img src="${logoFor(o.agency)}" onerror="this.src='/logos/placeholder.jpeg'">
          <div class="name">${escapeHtml(o.agency)}</div>
        </div>
        <div class="odds">${(Number(o.odds)||0).toFixed(2)}</div>
      </div>
    `).join('');

    listEl.querySelectorAll('.calc-opt').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const agency = opt.getAttribute('data-agency');
        const odds = Number(opt.getAttribute('data-odds') || '0');

        if (side === 'A') {
          ctx.aName = agency; ctx.oA = odds;
          els.Aname.textContent = agency; els.Alogo.src = logoFor(agency);
          els.AoddsIn.value = odds.toFixed(2);
        } else {
          ctx.bName = agency; ctx.oB = odds;
          els.Bname.textContent = agency; els.Blogo.src = logoFor(agency);
          els.BoddsIn.value = odds.toFixed(2);
        }

        // switching odds should return to total mode unless you’re actively locked
        if (mode === 'A' || mode === 'B') {
          // keep lock mode, but recompute other side
        } else {
          mode = 'total';
          syncModeUI();
        }
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

  function recalc(){
    if (!ctx) return;

    const step = Math.max(1, Number(els.round.value) || 10);
    const maxStake = Math.max(0, Number(els.maxStake.value) || 1000);

    // read odds inputs (user-editable)
    const oA = Math.max(1.01, Number(els.AoddsIn.value) || ctx.oA || 1.9);
    const oB = Math.max(1.01, Number(els.BoddsIn.value) || ctx.oB || 1.9);
    ctx.oA = oA; ctx.oB = oB;

    let sA = Math.max(0, Number(els.Astake.value) || 0);
    let sB = Math.max(0, Number(els.Bstake.value) || 0);

    if (mode === 'total'){
      const res = searchRounded(oA, oB, maxStake, step);
      sA = Math.max(0, Math.round(res.rA));
      sB = Math.max(0, Math.round(res.rB));
      els.Astake.value = sA;
      els.Bstake.value = sB;
      els.hint.textContent = `Checked totals from $${Math.floor(maxStake)} down $${Math.min(100, Math.floor(maxStake))} using $${step} steps; stakes are exact $${step} multiples.`;
    } else if (mode === 'A'){
      sA = roundTo(sA, step);
      let wantB = solveOtherForEqualPayout(sA, oA, oB);
      sB = roundTo(wantB, step);

      // cap by maxStake (reduce locked side if needed)
      while (sA + sB > maxStake && sA > 0){
        sA = Math.max(0, sA - step);
        sB = roundTo(solveOtherForEqualPayout(sA, oA, oB), step);
      }

      els.Astake.value = sA;
      els.Bstake.value = sB;
      els.hint.textContent = `A stake locked (rounded to $${step}); B matched to equal payout and rounded.`;
    } else if (mode === 'B'){
      sB = roundTo(sB, step);
      let wantA = solveOtherForEqualPayout(sB, oB, oA);
      sA = roundTo(wantA, step);

      while (sA + sB > maxStake && sB > 0){
        sB = Math.max(0, sB - step);
        sA = roundTo(solveOtherForEqualPayout(sB, oB, oA), step);
      }

      els.Astake.value = sA;
      els.Bstake.value = sB;
      els.hint.textContent = `B stake locked (rounded to $${step}); A matched to equal payout and rounded.`;
    }

    // summary
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
    els.profitLabel.textContent = `Profit (${roiPct.toFixed(2)}%):`;
    els.profit.textContent = fmtMoney(profit);
  }

  function openCalc({ aName, bName, aOdds, bOdds, aLogo, bLogo, title, aBet='', bBet='', maxStake=1000, optionsA=[], optionsB=[] }) {
    ensureModal();

    ctx = {
      aName: aName || 'Side A',
      bName: bName || 'Side B',
      oA: Number(aOdds) || 1.9,
      oB: Number(bOdds) || 1.9,
      optsA: optionsA.slice(),
      optsB: optionsB.slice(),
    };

    els.title.textContent = title || 'Calculator';

    els.Aname.textContent = ctx.aName;
    els.Bname.textContent = ctx.bName;
    els.Alogo.src = aLogo || '/logos/placeholder.jpeg';
    els.Blogo.src = bLogo || '/logos/placeholder.jpeg';
    els.Abet.textContent = aBet;
    els.Bbet.textContent = bBet;

    // restore persisted values
    const savedMax = localStorage.getItem('calcMaxStake');
    els.maxStake.value = (savedMax && !Number.isNaN(Number(savedMax))) ? savedMax : String(maxStake);

    const savedRound = localStorage.getItem('calcRoundStep');
    if (savedRound && ['1','5','10'].includes(savedRound)) els.round.value = savedRound;

    // set odds inputs
    els.AoddsIn.value = ctx.oA.toFixed(2);
    els.BoddsIn.value = ctx.oB.toFixed(2);

    // dropdown options
    renderOptions(els.ddA, ctx.optsA, 'A');
    renderOptions(els.ddB, ctx.optsB, 'B');

    // reset mode to total on open
    mode = 'total';
    syncModeUI();

    // compute stakes
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

  // treat "All" as selected (empty set) when Select all is on or everything is selected
  const treatAllSelected = (selectAllEl.checked === true) && (selectedSet.size === 0 || selectedSet.size >= items.length);

  items.forEach(v => {
    const id = `${allKey}-${v.toString().replace(/[^a-z0-9]/gi,'-').toLowerCase()}`;
    const isChecked = treatAllSelected ? true : selectedSet.has(v);

    const row = document.createElement('label');
    row.className = "inline-flex items-center p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800";
    // We’ll manage spacing via .chk-input (margin-right) so the other panels don’t get scrunched.
    // Only Bookies rows get an icon.
    if (allKey === 'bookie') {
      row.innerHTML = `
        <input type="checkbox" id="${id}" class="rounded chk-input" ${isChecked ? 'checked' : ''} data-val="${v}">
        <img src="${logoFor(v)}" alt="" class="bookie-icon-16" onerror="this.src='/logos/placeholder.jpeg'">
        <span class="truncate ml-2">${v}</span>
      `;
    } else {
      row.innerHTML = `
        <input type="checkbox" id="${id}" class="rounded chk-input" ${isChecked ? 'checked' : ''} data-val="${v}">
        <span class="truncate">${v}</span>
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
      if (cb.checked) selectedSet.add(val); else selectedSet.delete(val);

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
    const params = new URLSearchParams(qs()); // reuse your qs()
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

  // ---------- filters panels (unchanged) ----------
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
    // optional: client-side resort when sorting by ROI using recomputed roi
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
  // include the first page we already have
  for (const it of items) {
    const b = buildBundle(it, allowed);
    if (b) allBundles.push(b);
  }
  // pull remaining pages
  for (let p = 1; p <= pages; p++) {
    if (p === page) continue;
    const r = await fetch(buildURL(p));
    const j = await r.json();
    for (const it of (j.items || [])) {
      const b = buildBundle(it, allowed);
      if (b) allBundles.push(b);
    }
  }

  // Sort if sorting by ROI (recomputed)
  if (state.sortBy === 'roi') {
    allBundles.sort((a,b) => state.sortDir === 'asc' ? (a.roi - b.roi) : (b.roi - a.roi));
  }

  // Client totals + pagination
  const clientTotal = allBundles.length;
  const pageSize    = state.pageSize;
  const clientPages = Math.max(1, Math.ceil(clientTotal / pageSize));

  // Clamp state.page if out of range after filtering
  if (state.page > clientPages) state.page = clientPages;

  // Update UI counters to filtered values
  els.totalCount.textContent = clientTotal;
  els.pages.textContent      = clientPages;
  els.page.textContent       = state.page;
  els.prev.disabled          = state.page <= 1;
  els.next.disabled          = state.page >= clientPages;

  // Slice current page
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
  state.tz = els.tzSelect.value;
  localStorage.setItem('tzMode', state.tz);
  fetchData();
});

// init
fetchData();
