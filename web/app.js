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
  pageSize: 50,
  filters: {
    sport: '',
    competitionId: '',
    dateFrom: '',
    dateTo: '',
    minRoi: 0,
  },
  tz: localStorage.getItem('tzMode') || 'AEST', // 'auto' or 'AEST'
  selectedBookies: new Set(JSON.parse(localStorage.getItem('bookiesSelected') || '[]')),
  _agencies: [], // last agencies list from API
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

  // Bookies checkbox UI
  toggleBookiesFilter: document.getElementById('toggleBookiesFilter'),
  bookiesPanel: document.getElementById('bookiesPanel'),
  bookiesChkWrap: document.getElementById('bookiesChkWrap'),
  bookiesSelectAll: document.getElementById('bookiesSelectAll'),
  bookiesSelectedCount: document.getElementById('bookiesSelectedCount'),

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

  // Bookies filter: send CSV only when user picked a strict subset.
  if (state.selectedBookies.size > 0 && state._agencies.length && state.selectedBookies.size < state._agencies.length) {
    params.bookies = [...state.selectedBookies].join(',');
  }

  return new URLSearchParams(params).toString();
}

// --- Sort indicators (tiny SVGs) ---
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
  return `/images/${slug}.png`; // adjust to your actual image extensions
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

// --- Render Bookies column (best chips) ---
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
          <img src="${logoFor(agency)}" alt="${agency}" onerror="this.src='/logos/placeholder.svg'">
          <span class="bookie-name truncate">${agency}</span>
        </div>
        <span class="bookie-odds tabular-nums">${oddsTxt}</span>
      </div>`;
  };
  return `<div class="flex flex-col gap-2">${chip(left.agency, left.odds)}${chip(right.agency, right.odds)}</div>`;
}

// --- Full book table (expanded row) ---
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
          <img src="${logoFor(agency)}" class="w-5 h-5 rounded" onerror="this.src='/logos/placeholder.svg'"><span>${agency}</span></div></td>
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

// --- Bookies checkbox UI ---
function renderBookiesCheckboxes(agencies) {
  state._agencies = agencies.slice();
  const wrap = els.bookiesChkWrap;
  wrap.innerHTML = '';

  // Determine if we should show "all selected" as UI default
  const selected = state.selectedBookies;
  const treatAllSelected = selected.size === 0 || selected.size >= agencies.length;

  agencies.forEach(a => {
    const id = `bk-${agencySlug(a)}`;
    const checked = treatAllSelected ? true : selected.has(a);
    const row = document.createElement('label');
    row.className = "inline-flex items-center gap-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800";
    row.innerHTML = `
      <input type="checkbox" id="${id}" class="rounded" ${checked ? 'checked' : ''} data-agency="${a}">
      <span class="truncate">${a}</span>
    `;
    wrap.appendChild(row);
  });

  // Select all checkbox state
  els.bookiesSelectAll.checked = treatAllSelected;
  updateBookiesSelectedCount();

  // Attach listeners
  wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const a = cb.getAttribute('data-agency');
      if (cb.checked) state.selectedBookies.add(a);
      else state.selectedBookies.delete(a);

      // If user checks everything, collapse to "no filter" by clearing the explicit list
      if (state.selectedBookies.size >= agencies.length) {
        state.selectedBookies = new Set(); // means "no filter"
      }

      localStorage.setItem('bookiesSelected', JSON.stringify([...state.selectedBookies]));
      updateBookiesSelectedCount();
      fetchData();
    });
  });

  els.bookiesSelectAll.addEventListener('change', () => {
    if (els.bookiesSelectAll.checked) {
      // All selected -> clear explicit list (means "no filter")
      state.selectedBookies = new Set();
      wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    } else {
      // None selected -> explicit empty set (still means "no filter" for API, but reflects UI)
      state.selectedBookies = new Set();
      wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
    localStorage.setItem('bookiesSelected', JSON.stringify([...state.selectedBookies]));
    updateBookiesSelectedCount();
    fetchData();
  });
}

function updateBookiesSelectedCount() {
  let text = 'All';
  if (state.selectedBookies.size > 0 && state._agencies.length && state.selectedBookies.size < state._agencies.length) {
    text = `${state.selectedBookies.size} selected`;
  }
  els.bookiesSelectedCount.textContent = text;
}

// --- Toggle the hidden panel
els.toggleBookiesFilter?.addEventListener('click', () => {
  els.bookiesPanel.classList.toggle('hidden');
});

// --- Fetch + render ---
async function fetchData() {
  // sync tz UI
  if (els.tzSelect) els.tzSelect.value = state.tz;

  const res = await fetch(`/api/opportunities?${qs()}`);
  const { items, total, page, pages, lastUpdated, sports, competitionIds, agencies } = await res.json();

  els.lastUpdated.textContent = lastUpdated ? fmtWithTZ(lastUpdated) : '—';
  els.totalCount.textContent = total;
  els.page.textContent = page;
  els.pages.textContent = pages;
  els.prev.disabled = page <= 1;
  els.next.disabled = page >= pages;

  // Populate sport/competition once
  if (els.sport.options.length === 1) {
    (sports || []).forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; els.sport.appendChild(o); });
  }
  if (els.competitionId.options.length === 1) {
    (competitionIds || []).forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = id; els.competitionId.appendChild(o); });
  }

  // Render bookies checkbox panel (once or when the list changes)
  const agStrNow = JSON.stringify(agencies || []);
  const agStrPrev = JSON.stringify(state._agencies || []);
  if (agStrNow !== agStrPrev) {
    renderBookiesCheckboxes(agencies || []);
  } else {
    updateBookiesSelectedCount();
  }

  // Table rows
  els.tbody.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (const it of items) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer';

    const roiPct = ((Number(it.roi) || 0) * 100).toFixed(2) + '%';
    const bets = parseBets(it.match);
    const kickoffTxt = it.kickoff ? fmtWithTZ(it.kickoff) : (it.date || it.dateISO || '');

    let bookiesCell = '';
    if (it.book_table) {
      bookiesCell = renderBestChips(it.book_table);
    } else {
      bookiesCell = `<span class="text-slate-400">—</span>`;
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

    // Details row (odds table)
    const trDetails = document.createElement('tr');
    trDetails.className = 'hidden';
    const tdDetails = document.createElement('td');
    tdDetails.colSpan = 7;
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

function updateAndFetch() {
  state.page = 1;
  fetchData();
}

// events (filters, paging, sorting)
['sport','competitionId','dateFrom','dateTo'].forEach(id => {
  const el = els[id];
  if (!el) return;
  el.addEventListener('change', () => {
    state.filters[id] = el.value;
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

els.pageSize?.addEventListener('change', () => {
  state.pageSize = Number(els.pageSize.value);
  state.page = 1; fetchData();
});

els.prev?.addEventListener('click', () => { if (state.page > 1) { state.page--; fetchData(); } });
els.next?.addEventListener('click', () => { state.page++; fetchData(); });

els.reset?.addEventListener('click', () => {
  state.filters = { sport: '', competitionId: '', dateFrom: '', dateTo: '', minRoi: 0 };
  els.sport.value = els.competitionId.value = els.dateFrom.value = els.dateTo.value = '';
  els.minRoi.value = 0; els.minRoiValue.textContent = '0.0';
  // Reset bookies: clear explicit list (means "no filter")
  state.selectedBookies = new Set();
  localStorage.removeItem('bookiesSelected');
  renderBookiesCheckboxes(state._agencies || []);
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

// timezone select
els.tzSelect?.addEventListener('change', () => {
  state.tz = els.tzSelect.value;
  localStorage.setItem('tzMode', state.tz);
  fetchData();
});

// init
fetchData();
