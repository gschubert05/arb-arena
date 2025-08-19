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

// --- Intro modal (unchanged) ---
(() => {
  const modal = document.getElementById('introModal');
  if (!modal) return;
  const overlay = document.getElementById('introOverlay');
  const closeBtn = document.getElementById('introClose');
  const dontShow = document.getElementById('introDontShow');

  const dismissed = localStorage.getItem('introDismissed') === '1';
  if (!dismissed) {
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }
  const close = () => {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  };
  closeBtn?.addEventListener('click', () => {
    if (dontShow?.checked) localStorage.setItem('introDismissed', '1');
    close();
  });
  overlay?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });
})();

// --- App state ---
const state = {
  sortBy: 'roi',
  sortDir: 'desc',
  page: 1,
  pageSize: 50,
  filters: {
    sport: '',
    competitionId: '',
    dateFrom: '',
    dateTo: '',
    minRoi: 0,
    bookies: [], // array of cleaned agency names
  },
  tz: localStorage.getItem('tzMode') || 'AEST', // 'auto' or 'AEST'
  selectedBookies: new Set(JSON.parse(localStorage.getItem('bookiesSelected') || '[]')),
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

  sport: document.getElementById('sport'),
  competitionId: document.getElementById('competitionId'),
  dateFrom: document.getElementById('dateFrom'),
  dateTo: document.getElementById('dateTo'),
  minRoi: document.getElementById('minRoi'),
  minRoiValue: document.getElementById('minRoiValue'),
  reset: document.getElementById('resetFilters'),
  refresh: document.getElementById('refresh'),

  bookies: document.getElementById('bookies'),
  bookiesAll: document.getElementById('bookiesAll'),

  tzSelect: document.getElementById('tzSelect'),
};

// --- Utility: build querystring from state ---
function qs(params) {
  const usp = new URLSearchParams({
    page: state.page,
    pageSize: state.pageSize,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    ...state.filters,
    bookies: (state.filters.bookies || []).join(','),
    ...params,
  });
  return usp.toString();
}

// --- Sort indicators (SVGs) ---
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
      icon.classList.remove('opacity-60');
      icon.classList.add('opacity-90');
    } else {
      icon.innerHTML = ICONS.both;
      icon.classList.remove('opacity-90');
      icon.classList.add('opacity-60');
    }
  });
}

// --- Name cleaning + logos ---
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
  return `/images/${slug}.png`; // or .jpg/.jpeg depending on your assets
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

// --- Render helpers for book_table ---
function renderBestChips(bookTable) {
  if (!bookTable || !bookTable.best) return '';
  const left  = bookTable.best.left  || {};
  const right = bookTable.best.right || {};

  const chip = (agencyRaw, odds) => {
    const agency = cleanAgencyName(agencyRaw || '');
    if (!agency || odds == null) return '';
    const oddsTxt = Number(odds).toFixed(2);
    return `
      <div class="flex items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-900/30
                  text-emerald-800 dark:text-emerald-200 px-2.5 py-1 rounded-xl w-full">
        <div class="flex items-center gap-2 min-w-0">
          <img src="${logoFor(agency)}" alt="${agency}" class="w-5 h-5 rounded shrink-0"
               onerror="this.src='/logos/placeholder.svg'">
          <span class="font-medium truncate">${agency}</span>
        </div>
        <span class="tabular-nums text-right font-semibold min-w-[3.5rem]">${oddsTxt}</span>
      </div>`;
  };

  return `
    <div class="flex flex-col gap-2 items-stretch">
      ${chip(left.agency, left.odds)}
      ${chip(right.agency, right.odds)}
    </div>`;
}

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
        <td class="px-3 py-2">
          <div class="flex items-center gap-2">
            <img src="${logoFor(agency)}" alt="${agency}" class="w-5 h-5 rounded" onerror="this.src='/logos/placeholder.svg'">
            <span>${agency}</span>
          </div>
        </td>
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

// --- Request update poller (unchanged) ---
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

  status.textContent = 'Updating… (this can take a couple of minutes)';
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
  // "Team A (-1.5) - 3.15 | Team B (+1.5) - 1.55" -> labels without odds
  if (!matchStr) return { top: '', bottom: '' };
  const parts = matchStr.split('|').map(s => s.trim());
  const label = (s) => s.split(' - ')[0].trim();
  return { top: label(parts[0] || ''), bottom: label(parts[1] || '') };
}

function isInteractive(el) {
  return !!el.closest('a, button, input, select, label, textarea');
}

// --- Fetch + render ---
async function fetchData() {
  // sync tz UI
  if (els.tzSelect) els.tzSelect.value = state.tz;

  const res = await fetch(`/api/opportunities?${qs()}`);
  const { items, total, page, pages, lastUpdated, sports, competitionIds, agencies } = await res.json();

  // meta
  els.lastUpdated.textContent = lastUpdated ? fmtWithTZ(lastUpdated) : '—';
  els.totalCount.textContent = total;
  els.page.textContent = page;
  els.pages.textContent = pages;
  els.prev.disabled = page <= 1;
  els.next.disabled = page >= pages;

  // populate sport/competition once
  if (els.sport.options.length === 1) {
    sports.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; els.sport.appendChild(o); });
  }
  if (els.competitionId.options.length === 1) {
    competitionIds.forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = id; els.competitionId.appendChild(o); });
  }
  // populate bookies multi-select
  if (els.bookies && els.bookies.options.length === 0) {
    (agencies || []).forEach(a => {
      const o = document.createElement('option');
      o.value = a;
      o.textContent = a;
      if (state.selectedBookies.has(a)) o.selected = true;
      els.bookies.appendChild(o);
    });
    // init filters from selectedBookies
    state.filters.bookies = [...state.selectedBookies];
  }

  // rows
  els.tbody.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (const it of items) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer';

    const roiPct = ((Number(it.roi) || 0) * 100).toFixed(2) + '%';
    const bets = parseBets(it.match);

    const kickoffTxt = it.kickoff ? fmtWithTZ(it.kickoff) : (it.date || it.dateISO || '');

    // Column: Bookies (best chips OR fallback link)
    let bookiesCell = '';
    if (it.book_table) {
      bookiesCell = renderBestChips(it.book_table);
    } else {
      const go = it.url ? `<a href="${it.url}" target="_blank" rel="noopener" class="inline-flex items-center px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-blue-700">Open</a>` : '';
      bookiesCell = `<div class="flex items-center justify-end gap-2">${go}</div>`;
    }

    tr.innerHTML = `
      <td class="px-4 py-3 whitespace-nowrap">${kickoffTxt}</td>
      <td class="px-4 py-3 whitespace-nowrap">${it.sport || ''}</td>
      <td class="px-4 py-3">${it.game || ''}</td>
      <td class="px-4 py-3">${it.market || ''}</td>
      <td class="px-4 py-3">
        <div class="flex flex-col gap-1">
          <div>${bets.top}</div>
          <div>${bets.bottom}</div>
        </div>
      </td>
      <td class="px-4 py-3 text-right font-semibold tabular-nums">${roiPct}</td>
      <td class="px-4 py-3">${bookiesCell}</td>
    `;

    frag.appendChild(tr);

    // Details row
    const trDetails = document.createElement('tr');
    trDetails.className = 'hidden';
    const tdDetails = document.createElement('td');
    tdDetails.colSpan = 7;
    tdDetails.innerHTML = it.book_table ? renderFullBookTable(it) : '';
    trDetails.appendChild(tdDetails);
    frag.appendChild(trDetails);

    // Whole-row toggle
    tr.addEventListener('click', (e) => {
      if (isInteractive(e.target)) return; // don't toggle when clicking buttons/links
      const isHidden = trDetails.classList.contains('hidden');
      trDetails.classList.toggle('hidden');
      if (isHidden) {
        // scroll into view if opening near bottom
        const rect = trDetails.getBoundingClientRect();
        if (rect.bottom > window.innerHeight) trDetails.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  els.tbody.appendChild(frag);
  renderSortIndicators();
}

function updateAndFetch(patch = {}) {
  Object.assign(state, patch);
  state.page = 1;
  fetchData();
}

// events (filters, paging, sorting)
['sport','competitionId','dateFrom','dateTo'].forEach(id => {
  const el = els[id];
  if (!el) return;
  el.addEventListener('change', () => {
    state.filters[id === 'competitionId' ? 'competitionId' : id] = el.value;
    updateAndFetch();
  });
});

els.minRoi?.addEventListener('input', () => {
  els.minRoiValue.textContent = Number(els.minRoi.value).toFixed(1);
});
els.minRoi?.addEventListener('change', () => {
  state.filters.minRoi = els.minRoi.value;
  updateAndFetch();
});

// bookies multi-select
function syncBookiesFilter() {
  const selected = [...els.bookies.selectedOptions].map(o => o.value);
  state.selectedBookies = new Set(selected);
  localStorage.setItem('bookiesSelected', JSON.stringify(selected));
  state.filters.bookies = selected;
}
els.bookies?.addEventListener('change', () => {
  syncBookiesFilter();
  updateAndFetch();
});
els.bookiesAll?.addEventListener('click', () => {
  const all = els.bookiesAll.getAttribute('data-mode') !== 'all';
  for (const o of els.bookies.options) o.selected = all;
  els.bookiesAll.textContent = all ? 'Clear all' : 'Select all';
  els.bookiesAll.setAttribute('data-mode', all ? 'all' : 'none');
  syncBookiesFilter();
  updateAndFetch();
});

els.pageSize?.addEventListener('change', () => {
  state.pageSize = Number(els.pageSize.value);
  state.page = 1; fetchData();
});

els.prev?.addEventListener('click', () => { if (state.page > 1) { state.page--; fetchData(); } });
els.next?.addEventListener('click', () => { state.page++; fetchData(); });

els.reset?.addEventListener('click', () => {
  state.filters = { sport: '', competitionId: '', dateFrom: '', dateTo: '', minRoi: 0, bookies: [] };
  els.sport.value = els.competitionId.value = els.dateFrom.value = els.dateTo.value = '';
  els.minRoi.value = 0; els.minRoiValue.textContent = '0.0';
  state.selectedBookies = new Set();
  localStorage.removeItem('bookiesSelected');
  if (els.bookies) for (const o of els.bookies.options) o.selected = false;
  updateAndFetch();
});

els.refresh?.addEventListener('click', fetchData);

// header sorting
for (const th of document.querySelectorAll('thead [data-sort]')) {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-sort');
    if (state.sortBy === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.sortBy = key; state.sortDir = 'asc'; }
    fetchData();
  });
}

document.getElementById('requestUpdate')?.addEventListener('click', requestUpdateAndPoll);

// timezone select
els.tzSelect?.addEventListener('change', () => {
  state.tz = els.tzSelect.value;
  localStorage.setItem('tzMode', state.tz);
  fetchData();
});

// init
fetchData();
