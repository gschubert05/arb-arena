(() => {
  const root = document.documentElement;
  const saved = localStorage.getItem('theme'); // 'dark' | 'light' | null
  if (saved) {
    root.classList.toggle('dark', saved === 'dark');
  } else {
    // Default to dark on first visit
    root.classList.add('dark');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#themeToggle');
    if (!btn) return;
    const isDark = root.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
})();

// --- Intro modal (show once; remember choice) ---
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


const state = {
  sortBy: 'roi',
  sortDir: 'desc',
  page: 1,
  pageSize: 50,
  filters: { sport: '', competitionId: '', dateFrom: '', dateTo: '', minRoi: 0 },
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
  refresh: document.getElementById('refresh')
};

function qs(params) {
  const usp = new URLSearchParams({
    page: state.page,
    pageSize: state.pageSize,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    ...state.filters,
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


async function fetchData() {
  const res = await fetch(`/api/opportunities?${qs()}`);
  const { items, total, page, pages, lastUpdated, sports, competitionIds } = await res.json();

  // meta
  els.lastUpdated.textContent = lastUpdated ? new Date(lastUpdated).toLocaleString() : '—';
  els.totalCount.textContent = total;
  els.page.textContent = page;
  els.pages.textContent = pages;
  els.prev.disabled = page <= 1;
  els.next.disabled = page >= pages;

  // populate filter dropdowns once
  if (els.sport.options.length === 1) {
    sports.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; els.sport.appendChild(o); });
  }
  if (els.competitionId.options.length === 1) {
    competitionIds.forEach(id => { const o = document.createElement('option'); o.value = id; o.textContent = id; els.competitionId.appendChild(o); });
  }

  // rows
  els.tbody.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (const it of items) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50';
    const roiPct = (it.roi * 100).toFixed(2) + '%';

    // Copy button
    const copyBtn = `<button class="px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" data-copy="${it.search_phrase}">Copy</button>`;

    tr.innerHTML = `
      <td class="px-4 py-3 whitespace-nowrap">${it.date}</td>
      <td class="px-4 py-3 whitespace-nowrap">${it.sport}</td>
      <td class="px-4 py-3">${it.game}</td>
      <td class="px-4 py-3">${it.market}</td>
      <td class="px-4 py-3">${it.match}</td>
      <td class="px-4 py-3 text-right font-semibold tabular-nums">${roiPct}</td>
      <td class="px-4 py-3 text-right">
        <span class="mr-2">${it.search_phrase}</span>
        ${copyBtn}
      </td>
      <td class="px-4 py-3">
        <a href="${it.url}" target="_blank" rel="noopener" class="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Go</a>
      </td>`;
    renderSortIndicators();
    fragment.appendChild(tr);
  }
  els.tbody.appendChild(fragment);
}

function updateAndFetch(patch = {}) {
  Object.assign(state, patch);
  state.page = 1; // reset page on filter/sort change
  fetchData();
}

// Events
['sport','competitionId','dateFrom','dateTo'].forEach(id => {
  els[id].addEventListener('change', () => {
    state.filters[id === 'competitionId' ? 'competitionId' : id] = els[id].value;
    updateAndFetch();
  });
});

els.minRoi.addEventListener('input', () => {
  els.minRoiValue.textContent = Number(els.minRoi.value).toFixed(1);
});
els.minRoi.addEventListener('change', () => {
  state.filters.minRoi = els.minRoi.value;
  updateAndFetch();
});

els.pageSize.addEventListener('change', () => {
  state.pageSize = Number(els.pageSize.value);
  state.page = 1; fetchData();
});

els.prev.addEventListener('click', () => { if (state.page > 1) { state.page--; fetchData(); } });
els.next.addEventListener('click', () => { state.page++; fetchData(); });

els.reset.addEventListener('click', () => {
  state.filters = { sport: '', competitionId: '', dateFrom: '', dateTo: '', minRoi: 0 };
  els.sport.value = els.competitionId.value = els.dateFrom.value = els.dateTo.value = '';
  els.minRoi.value = 0; els.minRoiValue.textContent = '0.0';
  updateAndFetch();
});

els.refresh.addEventListener('click', fetchData);

// Sorting by clicking header
for (const th of document.querySelectorAll('thead [data-sort]')) {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-sort');
    if (state.sortBy === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.sortBy = key; state.sortDir = 'asc'; }
    fetchData();
  });
}

// Delegate copy buttons
addEventListener('click', (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const text = btn.getAttribute('data-copy');
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied';
    setTimeout(() => (btn.textContent = 'Copy'), 1200);
  });
});

// Init
fetchData();