// Plain script (not a module) so the page works when opened directly from a file.
const SCHOOLS = window.SCHOOLS;

const $ = id => document.getElementById(id);
const DAY = 86400000;
const STORE = 'ddt.v2';

// ---------- helpers ----------
const fmt$ = n => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((b - a) / DAY);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------- state ----------
let state = load();
function load() {
  const s = JSON.parse(localStorage.getItem(STORE) || 'null');
  const sch = SCHOOLS.cmu;
  return { mode: 'log', school: 'cmu', start: '', current: '', semStart: sch.semStart, semEnd: sch.semEnd, txns: [], ...s, asOf: s?.asOf || toISO(today()) };
}
function save() { localStorage.setItem(STORE, JSON.stringify(state)); }

// ---------- setup form ----------
for (const [id, s] of Object.entries(SCHOOLS)) $('school').add(new Option(s.name, id));
$('school').value = state.school;
$('start').value = state.start;
$('semStart').value = state.semStart;
$('semEnd').value = state.semEnd;
$('current').value = state.current;
$('asOf').value = state.asOf;
$('txDate').value = toISO(today());

// mode toggle
const MODE_HINT = {
  log: 'Log each purchase to get a breakdown by restaurant and meal.',
  quick: 'Just type your balances — no logging needed.',
};
function setMode(m) {
  state.mode = m; save();
  for (const b of document.querySelectorAll('.seg button')) b.setAttribute('aria-checked', b.dataset.mode === m);
  $('modeHint').textContent = MODE_HINT[m];
  $('quickFields').hidden = m !== 'quick';
  $('logCard').hidden = m !== 'log';
  $('txCard').hidden = m !== 'log';
  render();
}
for (const b of document.querySelectorAll('.seg button')) b.addEventListener('click', () => setMode(b.dataset.mode));

$('school').addEventListener('change', e => {
  state.school = e.target.value;
  const sch = SCHOOLS[state.school];
  state.semStart = $('semStart').value = sch.semStart;
  state.semEnd = $('semEnd').value = sch.semEnd;
  save(); loadLocations(); render();
});
for (const id of ['start', 'current', 'asOf', 'semStart', 'semEnd']) {
  $(id).addEventListener('input', e => { state[id] = e.target.value; save(); render(); });
}

const OTHER = '__other__';
async function loadLocations() {
  const id = state.school, sch = SCHOOLS[id];
  const fill = names => {
    const sel = $('txLocation');
    const keep = sel.value;
    sel.replaceChildren(
      new Option('Pick a place…', '', true, true),
      ...[...new Set(names)].sort((a, b) => a.localeCompare(b)).map(n => new Option(n)),
      new Option('Other…', OTHER),
    );
    sel.options[0].disabled = true;
    if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
  };
  fill(sch.locations);
  if (sch.fetchLocations) {
    try {
      const live = await sch.fetchLocations();
      if (state.school === id) fill(live);   // user may have switched schools meanwhile
    } catch (e) { console.warn('live locations failed, using fallback', e); }
  }
}
$('txLocation').addEventListener('change', e => {
  const other = e.target.value === OTHER;
  $('txLocationOther').hidden = !other;
  $('txLocationOther').required = other;
  if (other) $('txLocationOther').focus();
});

// ---------- transactions ----------
$('txForm').addEventListener('submit', e => {
  e.preventDefault();
  state.txns.push({
    id: crypto.randomUUID(),
    date: $('txDate').value,
    location: ($('txLocation').value === OTHER ? $('txLocationOther').value : $('txLocation').value).trim(),
    item: $('txItem').value.trim(),
    amount: Math.round(parseFloat($('txAmount').value) * 100) / 100,
  });
  save(); render();
  $('txAmount').value = ''; $('txItem').value = ''; $('txLocationOther').value = '';
  $('txAmount').focus();
});

function removeTx(id) {
  state.txns = state.txns.filter(t => t.id !== id);
  save(); render();
}

// ---------- computation ----------
function compute() {
  const start = parseFloat(state.start);
  if (!(start > 0) || !state.semStart || !state.semEnd) return null;
  const semStart = parse(state.semStart), semEnd = parse(state.semEnd), now = today();
  const totalDays = daysBetween(semStart, semEnd);
  if (totalDays <= 0) return null;

  const quick = state.mode === 'quick';
  if (quick && !(parseFloat(state.current) >= 0 && state.asOf)) return null;
  const txns = quick ? [] : [...state.txns].sort((a, b) => a.date.localeCompare(b.date));
  const spent = quick ? start - parseFloat(state.current) : txns.reduce((s, t) => s + t.amount, 0);
  const balance = start - spent;
  const asOf = quick ? parse(state.asOf) : now;
  const elapsed = Math.max(1, daysBetween(semStart, asOf));
  const daysLeft = Math.max(0, daysBetween(asOf, semEnd));
  const pace = spent / elapsed;
  const safe = daysLeft > 0 ? Math.max(0, balance) / daysLeft : 0;
  const endBal = balance - pace * daysLeft;
  const runOutDate = pace > 0 && balance > 0 ? new Date(asOf.getTime() + (balance / pace) * DAY) : (balance <= 0 ? asOf : null);

  return { quick, start, semStart, semEnd, now: asOf, totalDays, elapsed, daysLeft, txns, spent, balance, pace, safe, endBal, runOutDate };
}

function analyze(r) {
  const { txns, elapsed, pace, safe, spent } = r;
  if (!txns.length) return null;

  const byPlace = new Map();
  for (const t of txns) {
    const p = byPlace.get(t.location) || { name: t.location, total: 0, count: 0 };
    p.total += t.amount; p.count++; byPlace.set(t.location, p);
  }
  const places = [...byPlace.values()].sort((a, b) => b.total - a.total);

  const byItem = new Map();
  for (const t of txns) if (t.item) {
    const k = t.item.toLowerCase();
    const it = byItem.get(k) || { name: t.item, total: 0, count: 0 };
    it.total += t.amount; it.count++; byItem.set(k, it);
  }
  const items = [...byItem.values()].sort((a, b) => b.total - a.total);

  const byDow = Array.from({ length: 7 }, () => ({ total: 0, days: new Set() }));
  for (const t of txns) { const d = parse(t.date); byDow[d.getDay()].total += t.amount; byDow[d.getDay()].days.add(t.date); }

  const biggest = txns.reduce((m, t) => t.amount > m.amount ? t : m, txns[0]);
  const top = places[0];
  const insights = [];

  insights.push({
    hot: top.total / spent > 0.35,
    html: `<b>${esc(top.name)}</b> is <b>${Math.round(top.total / spent * 100)}%</b> of your spending — ${fmt$(top.total)} over ${top.count} visit${top.count > 1 ? 's' : ''} (avg ${fmt$(top.total / top.count)}).`,
  });

  if (pace > safe && r.daysLeft > 0) {
    const topPerDay = top.total / elapsed;
    const over = pace - safe;
    const cut = Math.min(1, over / topPerDay);
    if (cut < 1) insights.push({ hot: true, html: `You're ${fmt$(over)}/day over budget. Cutting ${esc(top.name)} by <b>${Math.round(cut * 100)}%</b> would fix it.` });
    else insights.push({ hot: true, html: `You're ${fmt$(over)}/day over budget — more than all of ${esc(top.name)} combined.` });
  }

  const dowStats = byDow.map((d, i) => ({ i, avg: d.days.size ? d.total / d.days.size : 0, n: d.days.size })).filter(d => d.n >= 2);
  if (dowStats.length >= 3) {
    const worst = dowStats.reduce((m, d) => d.avg > m.avg ? d : m);
    insights.push({ html: `<b>${WEEKDAYS[worst.i]}s</b> are your priciest day — ${fmt$(worst.avg)} on average.` });
  }

  if (items.length) {
    const fav = [...items].sort((a, b) => b.count - a.count)[0];
    if (fav.count >= 2) insights.push({ html: `You've bought <b>${esc(fav.name)}</b> ${fav.count} times (${fmt$(fav.total)} total).` });
  }

  insights.push({ html: `Biggest single purchase: <b>${fmt$(biggest.amount)}</b> at ${esc(biggest.location)}${biggest.item ? ` (${esc(biggest.item)})` : ''} on ${fmtDate(parse(biggest.date))}.` });
  insights.push({ html: `${txns.length} purchases, averaging <b>${fmt$(spent / txns.length)}</b> each, about ${(txns.length / elapsed * 7).toFixed(1)} per week.` });

  return { places, items, insights };
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- render ----------
let chartBalance, chartPlaces;

function render() {
  const r = compute();
  renderTable();

  $('verdict').hidden = !r; $('stats').hidden = !r; $('emptyBalance').hidden = !!r;
  if (!r) { chartBalance?.destroy(); chartBalance = null; $('analytics').hidden = true; return; }

  const cur = SCHOOLS[state.school].currency;
  const tol = Math.max(25, r.start * 0.03);
  const v = $('verdict');
  if (r.balance <= 0) {
    v.className = 'verdict bad';
    $('vHead').textContent = `You're out of ${cur}.`;
    $('vDetail').textContent = `${fmt$(r.spent)} spent with ${r.daysLeft} days to go.`;
  } else if (r.daysLeft === 0) {
    v.className = 'verdict ' + (r.balance > tol ? 'warn' : 'good');
    $('vHead').textContent = r.balance > tol ? `Semester's over with ${fmt$(r.balance)} left.` : "Semester's over — nicely done.";
    $('vDetail').textContent = '';
  } else if (!r.quick && !r.txns.length) {
    v.className = 'verdict good';
    $('vHead').textContent = `Nothing logged yet.`;
    $('vDetail').textContent = `Spend up to ${fmt$(r.safe)}/day and you'll use every dollar.`;
  } else if (r.endBal < -tol) {
    v.className = 'verdict bad';
    $('vHead').textContent = `You'll run out around ${fmtDate(r.runOutDate)}.`;
    $('vDetail').textContent = `That's ${daysBetween(r.runOutDate, r.semEnd)} days early. Drop to ${fmt$(r.safe)}/day to make it.`;
  } else if (r.endBal > tol) {
    v.className = 'verdict warn';
    $('vHead').textContent = `You're on track to waste ${fmt$(r.endBal)}.`;
    $('vDetail').textContent = `You can afford ${fmt$(r.safe - r.pace)}/day more than you're spending. Treat yourself.`;
  } else {
    v.className = 'verdict good';
    $('vHead').textContent = "You're right on pace.";
    $('vDetail').textContent = `Keep it near ${fmt$(r.safe)}/day and you'll finish close to $0.`;
  }

  $('safe').textContent = fmt$(r.safe) + '/day';
  $('pace').textContent = fmt$(r.pace) + '/day';
  $('paceSub').textContent = `${fmt$(r.spent)} spent over ${r.elapsed} days`;
  $('balance').textContent = fmt$(r.balance);
  $('balanceSub').textContent = `of ${fmt$(r.start)} · ${Math.round(r.balance / r.start * 100)}% left`;
  $('daysLeft').textContent = r.daysLeft;
  $('daysSub').textContent = `of ${r.totalDays} · ends ${fmtDate(r.semEnd)}`;

  drawBalance(r);

  const a = r.quick ? null : analyze(r);
  $('analytics').hidden = !a;
  if (a) {
    $('insights').innerHTML = a.insights.map(i => `<li class="${i.hot ? 'hot' : ''}">${i.html}</li>`).join('');
    drawPlaces(a);
  }
}

function renderTable() {
  const txns = [...state.txns].sort((a, b) => b.date.localeCompare(a.date));
  $('txCount').textContent = txns.length ? `${txns.length} · ${fmt$(txns.reduce((s, t) => s + t.amount, 0))}` : '';
  $('emptyTx').hidden = txns.length > 0;
  $('txTable').hidden = !txns.length;
  const tb = $('txTable').tBodies[0];
  tb.replaceChildren(...txns.map(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="muted">${fmtDate(parse(t.date))}</td><td>${esc(t.location)}</td><td class="muted">${esc(t.item)}</td><td class="num">${fmt$(t.amount)}</td><td class="act"><button class="link danger" aria-label="Delete">✕</button></td>`;
    tr.querySelector('button').addEventListener('click', () => removeTx(t.id));
    return tr;
  }));
}

function drawBalance(r) {
  const pt = (d, y) => ({ x: d.getTime(), y });
  // Actual: running balance after each day that has purchases.
  const actual = [pt(r.semStart, r.start)];
  let bal = r.start, lastDate = null;
  for (const t of r.txns) {
    bal -= t.amount;
    if (t.date === lastDate) actual[actual.length - 1].y = bal;
    else actual.push(pt(parse(t.date), bal));
    lastDate = t.date;
  }
  if (!lastDate || parse(lastDate) < r.now) actual.push(pt(r.now, bal));

  const projected = [pt(r.now, r.balance)];
  projected.push(r.endBal < 0 && r.runOutDate ? pt(r.runOutDate, 0) : pt(r.semEnd, Math.max(0, r.endBal)));
  const ideal = [pt(r.semStart, r.start), pt(r.semEnd, 0)];

  const accent = css('--accent'), idealC = css('--ideal'), grid = css('--grid'), ink = css('--text-2');
  const data = { datasets: [
    { label: 'Actual', data: actual, borderColor: accent, backgroundColor: accent, borderWidth: 2.5, pointRadius: actual.length > 30 ? 0 : 3, pointHoverRadius: 6 },
    { label: 'Projected', data: projected, borderColor: accent, backgroundColor: accent, borderWidth: 2, borderDash: [6, 5], pointRadius: [0, 4], pointHoverRadius: 6 },
    { label: 'Ideal pace', data: ideal, borderColor: idealC, backgroundColor: idealC, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5 },
  ] };
  const options = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    interaction: { mode: 'nearest', intersect: false },
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      title: items => fmtDate(new Date(items[0].parsed.x)),
      label: it => ` ${it.dataset.label}: ${fmt$(it.parsed.y)}`,
    } } },
    scales: {
      x: { type: 'linear', min: r.semStart.getTime(), max: r.semEnd.getTime(),
        ticks: { color: ink, maxTicksLimit: 6, callback: v => fmtDate(new Date(v)) }, grid: { color: grid }, border: { color: grid } },
      y: { min: 0, ticks: { color: ink, callback: v => '$' + v }, grid: { color: grid }, border: { color: grid } },
    },
  };
  if (chartBalance) { chartBalance.data = data; chartBalance.options = options; chartBalance.update(); }
  else chartBalance = new Chart($('chartBalance'), { type: 'line', data, options });
}

function drawPlaces(a) {
  const MAX = 7;
  let rows = a.places.slice(0, MAX);
  if (a.places.length > MAX) {
    const rest = a.places.slice(MAX);
    rows.push({ name: `Other (${rest.length})`, total: rest.reduce((s, p) => s + p.total, 0), count: rest.reduce((s, p) => s + p.count, 0) });
  }
  const accent = css('--accent'), grid = css('--grid'), ink = css('--text-2');
  const data = { labels: rows.map(p => p.name), datasets: [{
    data: rows.map(p => Math.round(p.total * 100) / 100), backgroundColor: accent,
    borderRadius: 4, borderSkipped: 'start', barThickness: 14, counts: rows.map(p => p.count),
  }] };
  const options = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      label: it => ` ${fmt$(it.parsed.x)} · ${it.dataset.counts[it.dataIndex]} visit${it.dataset.counts[it.dataIndex] > 1 ? 's' : ''}`,
    } } },
    scales: {
      x: { min: 0, ticks: { color: ink, callback: v => '$' + v, maxTicksLimit: 6 }, grid: { color: grid }, border: { color: grid } },
      y: { ticks: { color: ink, autoSkip: false }, grid: { display: false }, border: { color: grid } },
    },
  };
  $('chartPlaces').parentElement.style.height = (rows.length * 34 + 50) + 'px';
  if (chartPlaces) { chartPlaces.data = data; chartPlaces.options = options; chartPlaces.update(); }
  else chartPlaces = new Chart($('chartPlaces'), { type: 'bar', data, options });
}

// ---------- sample data / import / export ----------
$('btnSample').addEventListener('click', () => {
  if (state.mode !== 'log') setMode('log');
  if (state.txns.length && !confirm('Replace your current purchases with sample data?')) return;
  const sch = SCHOOLS[state.school];
  state.start = state.start || '1800';
  $('start').value = state.start;
  state.txns = sampleTxns(parse(state.semStart), today(), sch.locations);
  save(); render();
});

function sampleTxns(from, to, locations) {
  let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const menu = [
    ['Chipotle-style bowl', 11.5], ['Coffee', 4.25], ['Breakfast sandwich', 6.75], ['Sushi roll', 9.5],
    ['Noodle soup', 12], ['Burger & fries', 13.25], ['Salad', 10.5], ['Smoothie', 7.5], ['Pizza slice', 4.5],
    ['Tacos', 9.75], ['Curry plate', 12.5], ['Iced latte', 5.5], ['Snacks', 6], ['Sandwich', 9.25],
  ];
  const favs = [locations[0], locations[3], locations[5]];
  const out = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY)) {
    const n = d.getDay() === 5 ? 2 + (rnd() < 0.6 ? 1 : 0) : rnd() < 0.25 ? 0 : 1 + (rnd() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const loc = rnd() < 0.55 ? favs[Math.floor(rnd() * favs.length)] : locations[Math.floor(rnd() * locations.length)];
      const [item, base] = menu[Math.floor(rnd() * menu.length)];
      out.push({ id: crypto.randomUUID(), date: toISO(d), location: loc, item, amount: Math.round((base * (0.85 + rnd() * 0.4)) * 100) / 100 });
    }
  }
  return out;
}

$('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'dining-dollars.json' });
  a.click(); URL.revokeObjectURL(a.href);
});
$('btnImport').addEventListener('click', () => $('fileImport').click());
$('fileImport').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!Array.isArray(s.txns)) throw new Error('bad file');
    state = s; save(); location.reload();
  } catch { alert('That file doesn\'t look like a tracker export.'); }
  e.target.value = '';
});

// ---------- go ----------
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
loadLocations();
setMode(state.mode);
