(() => {
  const $ = (id) => document.getElementById(id);

  const els = {
    oddsA: $('oddsA'),
    oddsB: $('oddsB'),
    stakeA: $('stakeA'),
    stakeB: $('stakeB'),
    totalStake: $('totalStake'),
    roundStep: $('roundStep'),
    modeLabel: $('modeLabel'),
    lockA: $('lockA'),
    lockB: $('lockB'),
    reset: $('reset'),
    payoutA: $('payoutA'),
    payoutB: $('payoutB'),
    outTotal: $('outTotal'),
    outMinPayout: $('outMinPayout'),
    outProfit: $('outProfit'),
    outRoi: $('outRoi'),
    note: $('note'),
  };

  // mode: 'auto' | 'lockA' | 'lockB'
  let mode = 'lockB';

  // Persist settings
  const savedRound = localStorage.getItem('calcRoundStep');
  if (savedRound && ['1','5','10'].includes(savedRound)) els.roundStep.value = savedRound;

  const savedTotal = localStorage.getItem('calcTotalStake');
  if (savedTotal && !Number.isNaN(Number(savedTotal))) els.totalStake.value = String(savedTotal);

  const savedMode = localStorage.getItem('calcMode');
  if (savedMode && ['auto','lockA','lockB'].includes(savedMode)) mode = savedMode;

  function clampPos(n){ n = Number(n) || 0; return n < 0 ? 0 : n; }
  const fmtMoney = (v) => '$' + (Number(v) || 0).toFixed(2);

  function snapToStep(x, step, how = 'nearest') {
    step = Math.max(1, Number(step) || 10);
    x = Number(x) || 0;
    const q = x / step;
    if (how === 'floor') return Math.floor(q) * step;
    if (how === 'ceil')  return Math.ceil(q) * step;
    return Math.round(q) * step;
  }

  function readOdds() {
    const oA = Number(els.oddsA.value);
    const oB = Number(els.oddsB.value);
    return { oA, oB, ok: (oA > 1 && oB > 1) };
  }

  function score(oA, oB, sA, sB) {
    const payoutA = sA * oA;
    const payoutB = sB * oB;
    const total = sA + sB;
    const minPayout = Math.min(payoutA, payoutB);
    const profit = minPayout - total;
    const diff = Math.abs(payoutA - payoutB);
    const roiPct = total > 0 ? (profit / total) * 100 : 0;
    return { payoutA, payoutB, total, minPayout, profit, diff, roiPct };
  }

  // Auto: keep total (rounded) and pick best rounded split near equal payouts
  function computeAuto(oA, oB, total, step) {
    step = Math.max(1, Number(step) || 10);
    const T = snapToStep(clampPos(total), step, 'nearest');
    if (T <= 0) return { sA: 0, sB: 0, ...score(oA, oB, 0, 0) };

    const payoutTarget = T / (1 / oA + 1 / oB);
    const sA0 = payoutTarget / oA;
    const baseA = snapToStep(sA0, step, 'nearest');

    let best = null;
    for (let k = -6; k <= 6; k++) {
      const sA = baseA + k * step;
      const sB = T - sA;
      if (sA < 0 || sB < 0) continue;

      const sc = score(oA, oB, sA, sB);
      const key = sc.profit * 1e9 - sc.diff; // profit first, then balance
      if (!best || key > best.key) best = { key, sA, sB, sc };
    }
    return best ? { sA: best.sA, sB: best.sB, ...best.sc } : { sA: 0, sB: 0, ...score(oA, oB, 0, 0) };
  }

  // Locked: keep locked stake exact; compute other side rounded
  function computeLocked(oLocked, oOther, lockedStake, step) {
    step = Math.max(1, Number(step) || 10);
    const locked = clampPos(lockedStake);

    const targetPayout = locked * oLocked;
    const otherRaw = oOther > 0 ? (targetPayout / oOther) : 0;
    const base = snapToStep(otherRaw, step, 'nearest');

    let best = null;
    for (let k = -6; k <= 6; k++) {
      const other = Math.max(0, base + k * step);

      const payoutLocked = locked * oLocked;
      const payoutOther = other * oOther;
      const total = locked + other;
      const minPayout = Math.min(payoutLocked, payoutOther);
      const profit = minPayout - total;
      const diff = Math.abs(payoutLocked - payoutOther);
      const roiPct = total > 0 ? (profit / total) * 100 : 0;

      const key = profit * 1e9 - diff;
      if (!best || key > best.key) best = { key, other, sc: { payoutLocked, payoutOther, total, minPayout, profit, diff, roiPct } };
    }
    return best || { other: 0, sc: { payoutLocked: 0, payoutOther: 0, total: 0, minPayout: 0, profit: 0, diff: 0, roiPct: 0 } };
  }

  function setMode(next) {
    mode = next;
    localStorage.setItem('calcMode', mode);

    els.lockA.classList.toggle('active', mode === 'lockA');
    els.lockB.classList.toggle('active', mode === 'lockB');

    els.modeLabel.textContent =
      mode === 'auto'  ? 'Auto' :
      mode === 'lockA' ? 'Lock A' :
      mode === 'lockB' ? 'Lock B' : 'Auto';

    // Disable total stake outside auto (matches expectations)
    const auto = (mode === 'auto');
    els.totalStake.disabled = !auto;
    els.totalStake.classList.toggle('disabled', !auto);

    els.note.textContent =
      mode === 'auto'
        ? 'Auto: type Total stake — stakes are calculated (rounded).'
        : mode === 'lockA'
          ? 'Lock A: type Stake (A) — Stake (B) follows (rounded).'
          : 'Lock B: type Stake (B) — Stake (A) follows (rounded).';
  }

  function render(sc) {
    els.payoutA.textContent = `Payout: ${fmtMoney(sc.payoutA)}`;
    els.payoutB.textContent = `Payout: ${fmtMoney(sc.payoutB)}`;
    els.outTotal.textContent = fmtMoney(sc.total);
    els.outMinPayout.textContent = fmtMoney(sc.minPayout);
    els.outProfit.textContent = fmtMoney(sc.profit);
    els.outRoi.textContent = (Number(sc.roiPct) || 0).toFixed(2);
  }

  function recalc() {
    const { oA, oB, ok } = readOdds();
    const step = Number(els.roundStep.value) || 10;

    if (!ok) {
      render(score(oA || 0, oB || 0, 0, 0));
      return;
    }

    if (mode === 'auto') {
      const total = Number(els.totalStake.value) || 0;
      localStorage.setItem('calcTotalStake', String(total));

      const out = computeAuto(oA, oB, total, step);
      els.stakeA.value = String(out.sA);
      els.stakeB.value = String(out.sB);
      render(out);
      return;
    }

    if (mode === 'lockA') {
      const locked = Number(els.stakeA.value) || 0;
      const best = computeLocked(oA, oB, locked, step);
      els.stakeB.value = String(best.other);

      const sc = score(oA, oB, clampPos(locked), clampPos(best.other));
      render(sc);
      return;
    }

    // lockB
    const locked = Number(els.stakeB.value) || 0;
    const best = computeLocked(oB, oA, locked, step);
    els.stakeA.value = String(best.other);

    const sc = score(oA, oB, clampPos(best.other), clampPos(locked));
    render(sc);
  }

  // Events
  els.oddsA.addEventListener('input', recalc);
  els.oddsB.addEventListener('input', recalc);

  // Typing total stake switches to auto
  els.totalStake.addEventListener('input', () => {
    if (mode !== 'auto') setMode('auto');
    recalc();
  });

  els.roundStep.addEventListener('change', () => {
    localStorage.setItem('calcRoundStep', String(els.roundStep.value || '10'));
    recalc();
  });

  // Lock button toggles (click active lock again -> auto)
  els.lockA.addEventListener('click', () => {
    setMode(mode === 'lockA' ? 'auto' : 'lockA');
    recalc();
  });

  els.lockB.addEventListener('click', () => {
    setMode(mode === 'lockB' ? 'auto' : 'lockB');
    recalc();
  });

  // Typing a stake switches to that lock mode automatically
  els.stakeA.addEventListener('input', () => { if (mode !== 'lockA') setMode('lockA'); recalc(); });
  els.stakeB.addEventListener('input', () => { if (mode !== 'lockB') setMode('lockB'); recalc(); });

  els.reset.addEventListener('click', () => {
    els.oddsA.value = '1.90';
    els.oddsB.value = '1.90';
    els.stakeA.value = '0';
    els.stakeB.value = '0';
    els.totalStake.value = '1000';
    els.roundStep.value = '10';
    setMode('lockB'); // matches your screenshot / preference
    recalc();
  });

  // Init
  setMode(mode);
  recalc();
})();
