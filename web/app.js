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
      wrapEl.querySelectorAll('input[type="checkbox)').forEach(cb => cb.checked = false);
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
    let bookiesCell = it.book_table ? renderBestChips(it.book_table) : `<span class="text-slate-400">—</span>`;

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
    `;

    frag.appendChild(tr);

    const trDetails = document.createElement('tr');
    trDetails.className = 'hidden';
    const tdDetails = document.createElement('td');
    tdDetails.colSpan = 8; // League col added
    tdDetails.innerHTML = it.book_table ? renderFullBookTable(it) : '';
    trDetails.appendChild(tdDetails);
    frag.appendChild(trDetails);

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
