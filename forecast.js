// Monte Carlo forecast: instead of a straight line, simulate the rest of the semester
// thousands of times by resampling your own daily spending (per weekday when there's
// enough history), and report the chance of running out plus a likely range.
// Loaded after app.js; uses its globals.

const RUNS = 2000;
const MIN_DAYS = 7;   // need a week of history before a forecast means anything

// Deterministic RNG so the band doesn't jitter on every render (seeded by the data).
function mulberry32(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Daily spend history for a bucket: one entry per eating day from the tracking start to yesterday.
function dailyHistory(b, r, breaks) {
  const from = b.trackFrom && b.trackFrom > r.semStart ? b.trackFrom : r.semStart;
  const byDate = {};
  for (const t of b.txns) byDate[t.date] = (byDate[t.date] || 0) + t.amount;
  const days = [];
  for (let d = new Date(from); d < r.asOf; d = new Date(d.getTime() + DAY)) {
    if (!isEatDay(d, breaks)) continue;
    days.push({ dow: d.getDay(), amt: byDate[toISO(d)] || 0 });
  }
  return days;
}

function forecastBucket(b, r) {
  if (b.period !== 'semester' || b.noData || b.passive || r.quick) return null;
  const breaks = breaksFor();
  const hist = dailyHistory(b, r, breaks);
  if (hist.length < MIN_DAYS || r.daysLeft === 0) return null;
  if (hist.filter(h => h.amt > 0).length < 3) return null;   // nothing logged yet → no forecast
  // future eating days
  const future = [];
  for (let d = new Date(r.asOf.getTime() + DAY); d <= r.semEnd; d = new Date(d.getTime() + DAY)) if (isEatDay(d, breaks)) future.push({ date: new Date(d), dow: d.getDay() });
  if (!future.length) return null;
  const byDow = Array.from({ length: 7 }, (_, i) => hist.filter(h => h.dow === i).map(h => h.amt));
  const all = hist.map(h => h.amt);
  const rnd = mulberry32(hist.length * 7919 + Math.round(b.balance * 100));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  const ends = new Array(RUNS), runOutIdx = new Array(RUNS).fill(-1);
  // balance path percentiles at a handful of checkpoints for the chart band
  const checkpoints = [];
  for (let i = 0; i < future.length; i += Math.max(1, Math.floor(future.length / 12))) checkpoints.push(i);
  if (checkpoints[checkpoints.length - 1] !== future.length - 1) checkpoints.push(future.length - 1);
  const paths = checkpoints.map(() => new Array(RUNS));

  for (let k = 0; k < RUNS; k++) {
    let bal = b.balance;
    let ci = 0;
    for (let i = 0; i < future.length; i++) {
      const pool = byDow[future[i].dow].length >= 3 ? byDow[future[i].dow] : all;
      bal -= pick(pool);
      if (bal <= 0 && runOutIdx[k] < 0) runOutIdx[k] = i;
      if (checkpoints[ci] === i) { paths[ci][k] = Math.max(0, bal); ci++; }
    }
    ends[k] = bal;
  }
  const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const pRunOut = runOutIdx.filter(i => i >= 0).length / RUNS;
  const outDays = runOutIdx.filter(i => i >= 0);
  const band = checkpoints.map((i, ci) => ({ date: future[i].date, lo: q(paths[ci], 0.1), mid: q(paths[ci], 0.5), hi: q(paths[ci], 0.9) }));
  return {
    pRunOut,
    endLo: q(ends, 0.1), endMid: q(ends, 0.5), endHi: q(ends, 0.9),
    runOutEarly: outDays.length ? future[q(outDays, 0.1)].date : null,
    runOutLate: outDays.length ? future[q(outDays, 0.9)].date : null,
    band, days: hist.length, runs: RUNS,
  };
}

// One line of English per bucket for the verdict list.
function forecastLine(b, f) {
  const pct = Math.round(f.pRunOut * 100);
  const pctTxt = pct < 1 ? 'under 1%' : pct > 99 ? 'over 99%' : `${pct}%`;
  const lo = Math.max(0, f.endLo), hi = Math.max(0, f.endHi);
  const range = b.kind === 'money' ? `${fmt$(lo)}–${fmt$(hi)}` : `${Math.round(lo)}–${Math.round(hi)} ${b.unit}s`;
  if (pct >= 85) return `${b.label}: ${pctTxt} chance of running out — most likely between ${fmtDate(f.runOutEarly)} and ${fmtDate(f.runOutLate)}.`;
  if (pct >= 15) return `${b.label}: ${pctTxt} chance of running out${f.runOutEarly ? ` (if so, around ${fmtDate(f.runOutEarly)}–${fmtDate(f.runOutLate)})` : ''}; otherwise ${range} left.`;
  return `${b.label}: ${pctTxt} chance of running out — you'll likely finish with ${range} unused.`;
}

function renderForecast(r) {
  const box = $('forecastList');
  if (!r) { box.hidden = true; return; }
  const lines = [];
  for (const b of r.buckets) { const f = forecastBucket(b, r); if (f) lines.push(`<li class="${f.pRunOut >= 0.5 ? 'bad' : f.pRunOut >= 0.15 ? 'warn' : 'good'}">${esc(forecastLine(b, f))}</li>`); }
  box.hidden = !lines.length;
  if (lines.length) box.innerHTML = `<li class="fc-head">Forecast <span class="muted">— ${RUNS.toLocaleString()} simulated semesters from your own daily spending</span></li>` + lines.join('');
}

const _renderF = render;
render = function () { _renderF(); try { renderForecast(compute()); } catch (e) { console.error(e); } };
render();
