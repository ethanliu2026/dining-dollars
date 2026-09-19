// Plain script (not a module) so the page works when opened directly from a file.
const SCHOOLS = window.SCHOOLS, PLANS = window.PLANS;

const $ = id => document.getElementById(id);
const DAY = 86400000;
const STORE = 'ddt.v3';
const CUSTOM = 'custom';

// ---------- helpers ----------
const fmt$ = n => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n, d = 1) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
const fmtDate = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((b - a) / DAY);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plural = (n, unit) => `${fmtN(n)} ${unit}${Math.abs(n) === 1 ? '' : 's'}`;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Format a quantity in a bucket's own units.
const fmtQ = (b, n, d = 1) => b.kind === 'money' ? fmt$(n) : plural(Number(n.toFixed(d)), b.unit);
const fmtRate = (b, n) => b.kind === 'money' ? `${fmt$(n)}/day` : `${fmtN(n, 1)}/day`;

// ---------- state ----------
let state = load();
function load() {
  let s = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (!s) s = migrateV2();
  const sch = SCHOOLS[s?.school] ? s.school : 'cmu';
  const base = { mode: 'log', school: sch, planId: CUSTOM, start: {}, current: {}, asOf: toISO(today()),
                 semStart: SCHOOLS[sch].semStart, semEnd: SCHOOLS[sch].semEnd, txns: [] };
  return { ...base, ...(s || {}), asOf: s?.asOf || base.asOf };
}
// Old single-balance data → put it in the school's money bucket.
function migrateV2() {
  const old = JSON.parse(localStorage.getItem('ddt.v2') || 'null');
  if (!old) return null;
  const key = old.school === 'pitt' ? 'dd' : 'flex';
  return {
    ...old, planId: CUSTOM,
    start: old.start ? { [key]: +old.start } : {},
    current: old.current ? { [key]: +old.current } : {},
    txns: (old.txns || []).map(t => ({ ...t, bucket: key })),
  };
}
function save() { localStorage.setItem(STORE, JSON.stringify(state)); }

const school = () => SCHOOLS[state.school];
const plan = () => (PLANS[state.school]?.plans || []).find(p => p.id === state.planId) || null;

// Buckets that matter right now, with their resolved period and starting amount.
function activeBuckets() {
  const p = plan();
  const out = [];
  for (const [key, def] of Object.entries(school().buckets)) {
    const pb = p?.buckets?.[key];
    const period = (pb && typeof pb === 'object' && pb.period) || def.period;
    const start = +state.start[key] || 0;
    const inPlan = pb !== undefined;
    if (period === 'unlimited' || start > 0 || (inPlan && !def.optional) || (!p && !def.optional)) {
      out.push({ key, ...def, period, start });
    }
  }
  return out;
}

// ---------- setup form ----------
for (const [id, s] of Object.entries(SCHOOLS)) $('school').add(new Option(s.name, id));
$('school').value = state.school;
$('semStart').value = state.semStart;
$('semEnd').value = state.semEnd;
$('asOf').value = state.asOf;
$('txDate').value = toISO(today());

const MODE_HINT = {
  log: 'Log each purchase to get a breakdown by restaurant and meal.',
  quick: 'Just type what you started with and what you have now.',
};
function setMode(m) {
  state.mode = m; save();
  for (const b of document.querySelectorAll('.seg button')) b.setAttribute('aria-checked', b.dataset.mode === m);
  $('modeHint').textContent = MODE_HINT[m];
  $('quickFields').hidden = m !== 'quick';
  $('logCard').hidden = m !== 'log';
  $('txCard').hidden = m !== 'log';
  renderStartFields();
  render();
}
for (const b of document.querySelectorAll('.seg button')) b.addEventListener('click', () => setMode(b.dataset.mode));

function fillPlans() {
  const sel = $('plan');
  const cat = PLANS[state.school];
  sel.replaceChildren(
    ...(cat?.plans || []).map(p => {
      const parts = Object.entries(p.buckets).map(([k, v]) => {
        const def = school().buckets[k]; const amt = typeof v === 'object' ? v.amount : v;
        if (typeof v === 'object' && v.period === 'unlimited') return `unlimited ${def.label.toLowerCase()}`;
        if (typeof v === 'object' && v.period === 'week') return `${amt} ${def.label.toLowerCase()}/wk`;
        return def.kind === 'money' ? `$${amt} ${def.label}` : `${amt} ${def.label.toLowerCase()}`;
      });
      return new Option(`${p.name} — ${parts.join(', ')}`, p.id);
    }),
    new Option("Custom / I'll type my own", CUSTOM),
  );
  sel.value = state.planId;
  if (sel.value !== state.planId) { sel.value = CUSTOM; state.planId = CUSTOM; }
  const p = plan();
  $('planHint').innerHTML = p
    ? `${p.who ? esc(p.who) + ' · ' : ''}${fmt$(p.cost)}/semester${p.note ? ' · ' + esc(p.note) : ''}`
    : (cat ? `Plans from <a href="${cat.source}" target="_blank" rel="noopener">official ${school().name} dining info</a>, verified ${cat.verified}.` : '');
}

$('school').addEventListener('change', e => {
  if (state.txns.length && !confirm('Switching schools clears your logged purchases. Continue?')) { e.target.value = state.school; return; }
  state.school = e.target.value;
  state.txns = [];
  const sch = school();
  state.semStart = $('semStart').value = sch.semStart;
  state.semEnd = $('semEnd').value = sch.semEnd;
  state.planId = CUSTOM; state.start = {}; state.current = {};
  save(); fillPlans(); renderStartFields(); loadLocations(); fillBuckets(); render();
});
$('plan').addEventListener('change', e => {
  state.planId = e.target.value;
  const p = plan();
  if (p) {
    state.start = {};
    for (const [k, v] of Object.entries(p.buckets)) state.start[k] = typeof v === 'object' ? v.amount : v;
  }
  save(); fillPlans(); renderStartFields(); fillBuckets(); render();
});
for (const id of ['asOf', 'semStart', 'semEnd']) {
  $(id).addEventListener('input', e => { state[id] = e.target.value; save(); render(); });
}

// One input per bucket for the starting amount; in quick mode a second column for "now".
function renderStartFields() {
  const quick = state.mode === 'quick';
  const wrap = $('startFields');
  wrap.replaceChildren();
  const p = plan();
  for (const [key, def] of Object.entries(school().buckets)) {
    const pb = p?.buckets?.[key];
    if (p && pb === undefined && !def.optional) continue;
    const period = (pb && typeof pb === 'object' && pb.period) || def.period;
    if (period === 'unlimited') continue;
    const grid = document.createElement('div');
    grid.className = 'startgrid' + (quick ? '' : ' one');
    const mk = (which, label) => {
      const cell = document.createElement('div');
      const lab = document.createElement('label');
      lab.htmlFor = `${which}-${key}`;
      lab.innerHTML = `${esc(label)}${def.optional ? ' <span style="color:var(--text-3)">(optional)</span>' : ''}${period === 'week' ? ' <span class="pill">per week</span>' : ''}`;
      const box = document.createElement('div'); box.className = def.kind === 'money' ? 'money' : '';
      if (def.kind === 'money') box.innerHTML = '<span>$</span>';
      const inp = document.createElement('input');
      inp.type = 'number'; inp.id = `${which}-${key}`; inp.min = 0;
      inp.step = def.kind === 'money' ? '0.01' : '1';
      inp.placeholder = def.kind === 'money' ? '0.00' : '0';
      inp.value = state[which][key] ?? '';
      inp.addEventListener('input', () => { state[which][key] = inp.value === '' ? undefined : +inp.value; save(); fillBuckets(); render(); });
      box.appendChild(inp); cell.append(lab, box);
      return cell;
    };
    grid.appendChild(mk('start', quick ? `${def.label} at start` : def.label));
    if (quick) grid.appendChild(mk('current', period === 'week' ? `${def.label} left this week` : `${def.label} now`));
    if (def.hint) { const h = document.createElement('p'); h.className = 'hint'; h.textContent = def.hint; h.style.gridColumn = '1 / -1'; grid.appendChild(h); }
    wrap.appendChild(grid);
  }
}

// ---------- locations ----------
const OTHER = '__other__';
async function loadLocations() {
  const id = state.school, sch = school();
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

// ---------- purchase form ----------
function fillBuckets() {
  const sel = $('txBucket');
  const keep = sel.value;
  const opts = activeBuckets().filter(b => b.period !== 'unlimited');
  sel.replaceChildren(...opts.map(b => new Option(b.label, b.key)));
  if (opts.some(b => b.key === keep)) sel.value = keep;
  updateAmountField();
}
function updateAmountField() {
  const b = activeBuckets().find(b => b.key === $('txBucket').value);
  const money = !b || b.kind === 'money';
  $('txAmountLabel').textContent = money ? 'Amount' : `How many ${b.unit}s`;
  $('txAmountWrap').className = money ? 'money' : '';
  $('txAmountWrap').querySelector('span').hidden = !money;
  const inp = $('txAmount');
  inp.step = money ? '0.01' : '1'; inp.min = money ? '0.01' : '1';
  inp.placeholder = money ? '12.50' : '1';
  if (!money && !inp.value) inp.value = '1';
  if (money && inp.value === '1') inp.value = '';
}
$('txBucket').addEventListener('change', updateAmountField);

$('txForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!$('txBucket').value) { alert('Pick a meal plan or enter a starting balance first.'); return; }
  state.txns.push({
    id: crypto.randomUUID(),
    date: $('txDate').value,
    location: ($('txLocation').value === OTHER ? $('txLocationOther').value : $('txLocation').value).trim(),
    item: $('txItem').value.trim(),
    bucket: $('txBucket').value,
    amount: Math.round(parseFloat($('txAmount').value) * 100) / 100,
  });
  save(); render();
  $('txAmount').value = ''; $('txItem').value = ''; $('txLocationOther').value = '';
  updateAmountField();
  $('txAmount').focus();
});
function removeTx(id) { state.txns = state.txns.filter(t => t.id !== id); save(); render(); }

// ---------- computation ----------
function compute() {
  if (!state.semStart || !state.semEnd) return null;
  const semStart = parse(state.semStart), semEnd = parse(state.semEnd);
  const totalDays = daysBetween(semStart, semEnd);
  if (totalDays <= 0) return null;
  const quick = state.mode === 'quick';
  const asOf = quick && state.asOf ? parse(state.asOf) : today();
  const elapsed = Math.max(1, daysBetween(semStart, asOf));
  const daysLeft = Math.max(0, daysBetween(asOf, semEnd));
  const txns = quick ? [] : [...state.txns].sort((a, b) => a.date.localeCompare(b.date));

  const buckets = activeBuckets().map(b => {
    const r = { ...b, txns: txns.filter(t => t.bucket === b.key) };
    if (b.period === 'unlimited') return { ...r, status: 'muted' };
    if (b.period === 'week') {
      // Week runs Monday → Sunday (Pitt resets Sunday 11:59 pm).
      const dow = (asOf.getDay() + 6) % 7;
      const weekStart = new Date(asOf.getTime() - dow * DAY);
      const thisWeek = r.txns.filter(t => parse(t.date) >= weekStart && parse(t.date) <= asOf);
      const used = quick ? b.start - (+state.current[b.key] || 0) : thisWeek.reduce((s, t) => s + t.amount, 0);
      const left = b.start - used, daysLeftWk = 7 - dow;
      const status = left <= 0 ? 'bad' : left > daysLeftWk * 3 ? 'warn' : 'good';
      return { ...r, used, balance: left, daysLeftWk, safe: left / daysLeftWk, weekStart, status };
    }
    if (!(b.start > 0)) return { ...r, status: 'muted', noData: true };
    if (quick && !(+state.current[b.key] >= 0) ) return { ...r, status: 'muted', noData: true };
    if (quick && state.current[b.key] === undefined) return { ...r, status: 'muted', noData: true };
    const spent = quick ? b.start - (+state.current[b.key]) : r.txns.reduce((s, t) => s + t.amount, 0);
    const balance = b.start - spent;
    const pace = spent / elapsed;
    const safe = daysLeft > 0 ? Math.max(0, balance) / daysLeft : 0;
    const endBal = balance - pace * daysLeft;
    const runOutDate = pace > 0 && balance > 0 ? new Date(asOf.getTime() + (balance / pace) * DAY) : (balance <= 0 ? asOf : null);
    const tol = b.kind === 'money' ? Math.max(25, b.start * 0.03) : Math.max(2, b.start * 0.05);
    const status = balance <= 0 ? 'bad' : daysLeft === 0 ? (balance > tol ? 'warn' : 'good')
      : endBal < -tol ? 'bad' : endBal > tol ? 'warn' : 'good';
    return { ...r, spent, balance, pace, safe, endBal, runOutDate, tol, status };
  });

  if (!buckets.some(b => !b.noData && b.period !== 'unlimited')) return null;
  return { quick, semStart, semEnd, asOf, totalDays, elapsed, daysLeft, txns, buckets };
}

// What a block/swipe really costs on this plan: (plan price − money buckets) / count allotment.
function unitValue(r) {
  const p = plan();
  const counts = r.buckets.filter(b => b.kind === 'count' && b.period !== 'unlimited' && b.start > 0);
  if (!counts.length) return null;
  const fallback = 12;
  if (!p) return { value: fallback, estimated: true };
  const money = r.buckets.filter(b => b.kind === 'money').reduce((s, b) => s + (typeof p.buckets[b.key] === 'number' ? p.buckets[b.key] : 0), 0);
  // Weekly allotments count for every week of the semester.
  const n = counts.reduce((s, b) => s + (b.period === 'week' ? b.start * r.totalDays / 7 : b.start), 0);
  const value = (p.cost - money) / n;
  return value > 0 ? { value, estimated: false } : { value: fallback, estimated: true };
}

function analyze(r) {
  const { txns, elapsed } = r;
  if (!txns.length) return null;
  const uv = unitValue(r);
  const byKey = Object.fromEntries(r.buckets.map(b => [b.key, b]));
  const dollars = t => byKey[t.bucket]?.kind === 'count' ? t.amount * (uv?.value || 0) : t.amount;
  const spent = txns.reduce((s, t) => s + dollars(t), 0);

  const byPlace = new Map();
  for (const t of txns) {
    const p = byPlace.get(t.location) || { name: t.location, total: 0, count: 0 };
    p.total += dollars(t); p.count++; byPlace.set(t.location, p);
  }
  const places = [...byPlace.values()].sort((a, b) => b.total - a.total);

  const byItem = new Map();
  for (const t of txns) if (t.item) {
    const k = t.item.toLowerCase();
    const it = byItem.get(k) || { name: t.item, total: 0, count: 0 };
    it.total += dollars(t); it.count++; byItem.set(k, it);
  }
  const items = [...byItem.values()];

  const byDow = Array.from({ length: 7 }, () => ({ total: 0, days: new Set() }));
  for (const t of txns) { const d = parse(t.date); byDow[d.getDay()].total += dollars(t); byDow[d.getDay()].days.add(t.date); }

  const top = places[0];
  const insights = [];
  if (spent > 0) insights.push({
    hot: top.total / spent > 0.35,
    html: `<b>${esc(top.name)}</b> is <b>${Math.round(top.total / spent * 100)}%</b> of your spending — ${fmt$(top.total)} over ${top.count} visit${top.count > 1 ? 's' : ''}.`,
  });

  // Per-bucket "over budget → cut X" advice.
  for (const b of r.buckets) {
    if (b.period !== 'semester' || b.noData || !(b.pace > b.safe) || r.daysLeft === 0) continue;
    const over = b.pace - b.safe;
    const topB = [...b.txns.reduce((m, t) => m.set(t.location, (m.get(t.location) || 0) + t.amount), new Map())].sort((a, c) => c[1] - a[1])[0];
    if (!topB) continue;
    const cut = Math.min(1, over / (topB[1] / elapsed));
    insights.push({ hot: true, html: cut < 1
      ? `${esc(b.label)}: you're ${fmtRate(b, over)} over. Cutting ${esc(topB[0])} by <b>${Math.round(cut * 100)}%</b> would fix it.`
      : `${esc(b.label)}: you're ${fmtRate(b, over)} over — more than all of ${esc(topB[0])} combined.` });
  }

  // Blocks vs. money: were any money purchases pricier than a block?
  const moneyB = r.buckets.find(b => b.kind === 'money' && b.period === 'semester' && !b.noData);
  const countB = r.buckets.find(b => b.kind === 'count' && b.period !== 'unlimited' && !b.noData);
  if (uv && !uv.estimated && moneyB && countB) {
    const pricey = moneyB.txns.filter(t => t.amount > uv.value);
    if (pricey.length) insights.push({ html: `A ${countB.unit} costs you <b>${fmt$(uv.value)}</b> on this plan. ${pricey.length} of your ${esc(moneyB.label)} purchases cost more than that — ${countB.status === 'warn' ? `and you have ${countB.unit}s to spare.` : `consider using ${countB.unit}s for those.`}` });
    else insights.push({ html: `A ${countB.unit} costs you <b>${fmt$(uv.value)}</b> on this plan; none of your ${esc(moneyB.label)} purchases beat that. Nice.` });
  }

  const dowStats = byDow.map((d, i) => ({ i, avg: d.days.size ? d.total / d.days.size : 0, n: d.days.size })).filter(d => d.n >= 2);
  if (dowStats.length >= 3) {
    const worst = dowStats.reduce((m, d) => d.avg > m.avg ? d : m);
    insights.push({ html: `<b>${WEEKDAYS[worst.i]}s</b> are your priciest day — ${fmt$(worst.avg)} on average.` });
  }
  if (items.length) {
    const fav = [...items].sort((a, b) => b.count - a.count)[0];
    if (fav.count >= 2) insights.push({ html: `You've bought <b>${esc(fav.name)}</b> ${fav.count} times.` });
  }
  insights.push({ html: `${txns.length} purchases, about ${(txns.length / elapsed * 7).toFixed(1)} per week.` });

  return { places, insights, uv, hasCount: txns.some(t => byKey[t.bucket]?.kind === 'count') };
}

// ---------- render ----------
let chartBalance, chartPlaces, chartKey = null;

function render() {
  const r = compute();
  renderTable();

  $('verdict').hidden = !r; $('summaryCard').hidden = !r; $('emptyBalance').hidden = !!r;
  $('chartTabs').replaceChildren();
  if (!r) { chartBalance?.destroy(); chartBalance = null; $('analytics').hidden = true; return; }

  renderVerdict(r);
  renderSummary(r);
  renderChartTabs(r);

  const a = r.quick ? null : analyze(r);
  $('analytics').hidden = !a;
  if (a) {
    $('insights').innerHTML = a.insights.map(i => `<li class="${i.hot ? 'hot' : ''}">${i.html}</li>`).join('');
    $('placesHint').textContent = a.hasCount && a.uv
      ? (a.uv.estimated ? `Blocks/meals counted at an estimated ${fmt$(a.uv.value)} each — pick your plan for the real number.`
                        : `Blocks/meals counted at ${fmt$(a.uv.value)} each — what your plan actually charges per ${r.buckets.find(b => b.kind === 'count')?.unit || 'block'}.`)
      : '';
    drawPlaces(a);
  }
}

function describe(b, r) {
  if (b.period === 'unlimited') return `${b.label}: unlimited.`;
  if (b.noData) return `${b.label}: enter a balance to track.`;
  if (b.period === 'week') {
    return b.balance <= 0 ? `${b.label}: none left this week (resets Sunday night).`
      : `${b.label}: ${plural(b.balance, b.unit)} left this week — ${fmtN(b.safe, 1)}/day for the next ${b.daysLeftWk} day${b.daysLeftWk > 1 ? 's' : ''}.`;
  }
  if (b.balance <= 0) return `${b.label}: all gone, ${r.daysLeft} days to go.`;
  if (r.daysLeft === 0) return `${b.label}: ${fmtQ(b, b.balance)} left over.`;
  if (b.status === 'bad') return `${b.label}: runs out around ${fmtDate(b.runOutDate)} — drop to ${fmtRate(b, b.safe)} to make it.`;
  if (b.status === 'warn') return `${b.label}: ~${fmtQ(b, b.endBal, 0)} will go unused — you can afford ${fmtRate(b, b.safe - b.pace)} more.`;
  return `${b.label}: on pace — keep it near ${fmtRate(b, b.safe)}.`;
}

function renderVerdict(r) {
  const tracked = r.buckets.filter(b => !b.noData && b.period === 'semester');
  const worst = ['bad', 'warn', 'good'].map(s => tracked.find(b => b.status === s)).find(Boolean);
  const v = $('verdict');
  v.className = 'verdict ' + (worst?.status || 'good');
  let head;
  if (!worst) head = 'Nothing to project yet.';
  else if (worst.balance <= 0) head = `You're out of ${worst.label}.`;
  else if (r.daysLeft === 0) head = worst.status === 'warn' ? `Semester's over with ${fmtQ(worst, worst.balance)} unused.` : "Semester's over — nicely done.";
  else if (!r.quick && !r.txns.length) head = 'Nothing logged yet.';
  else if (worst.status === 'bad') head = `You'll run out of ${worst.label} around ${fmtDate(worst.runOutDate)}.`;
  else if (worst.status === 'warn') head = `You're on track to waste ${fmtQ(worst, worst.endBal, 0)}${worst.kind === 'money' ? ' of ' + worst.label : ''}.`;
  else head = tracked.length > 1 ? "You're on pace across the board." : "You're right on pace.";
  $('vHead').textContent = head;
  $('vList').innerHTML = r.buckets.map(b => `<li class="${b.status}">${esc(describe(b, r))}</li>`).join('');
}

function renderSummary(r) {
  const tb = $('summary').tBodies[0];
  tb.replaceChildren(...r.buckets.map(b => {
    const tr = document.createElement('tr');
    const pct = b.start > 0 && b.balance !== undefined ? `<span class="sub">${Math.round(b.balance / b.start * 100)}% of ${fmtQ(b, b.start, 0)}</span>` : '';
    let cells;
    if (b.period === 'unlimited') cells = `<td class="num muted">∞</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td>`;
    else if (b.noData) cells = `<td class="num muted" colspan="4">enter a balance</td>`;
    else if (b.period === 'week') cells = `<td class="num">${fmtQ(b, b.balance, 0)}${pct}</td><td class="num">${fmtN(b.used, 0)} used<span class="sub">this week</span></td><td class="num">${fmtN(b.safe, 1)}/day</td><td class="num muted">resets Sun</td>`;
    else cells = `<td class="num">${fmtQ(b, b.balance)}${pct}</td><td class="num ${b.pace > b.safe ? 'warn' : ''}">${fmtRate(b, b.pace)}</td><td class="num">${fmtRate(b, b.safe)}</td><td class="num ${b.status}">${b.endBal < 0 ? `−${fmtQ(b, -b.endBal, 0)}<span class="sub">short</span>` : `${fmtQ(b, b.endBal, 0)}<span class="sub">left over</span>`}</td>`;
    tr.innerHTML = `<td>${esc(b.label)}</td>${cells}`;
    return tr;
  }));
}

function renderChartTabs(r) {
  const plottable = r.buckets.filter(b => b.period === 'semester' && !b.noData);
  if (!plottable.some(b => b.key === chartKey)) chartKey = plottable[0]?.key || null;
  if (!chartKey) { chartBalance?.destroy(); chartBalance = null; $('emptyBalance').hidden = false; return; }
  if (plottable.length > 1) {
    const tabs = document.createElement('div'); tabs.className = 'tabs';
    for (const b of plottable) {
      const btn = document.createElement('button'); btn.textContent = b.label;
      btn.setAttribute('aria-selected', b.key === chartKey);
      btn.addEventListener('click', () => { chartKey = b.key; render(); });
      tabs.appendChild(btn);
    }
    $('chartTabs').appendChild(tabs);
  }
  drawBalance(r, plottable.find(b => b.key === chartKey));
}

function renderTable() {
  const txns = [...state.txns].sort((a, b) => b.date.localeCompare(a.date));
  const defs = school().buckets;
  $('txCount').textContent = txns.length ? `${txns.length}` : '';
  $('emptyTx').hidden = txns.length > 0;
  $('txTable').hidden = !txns.length;
  const tb = $('txTable').tBodies[0];
  tb.replaceChildren(...txns.map(t => {
    const d = defs[t.bucket];
    const paid = !d ? fmt$(t.amount) : d.kind === 'money' ? `${fmt$(t.amount)} <span class="sub">${esc(d.label)}</span>` : plural(t.amount, d.unit);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="muted">${fmtDate(parse(t.date))}</td><td>${esc(t.location)}</td><td class="muted">${esc(t.item)}</td><td class="num">${paid}</td><td class="act"><button class="link danger" aria-label="Delete">✕</button></td>`;
    tr.querySelector('button').addEventListener('click', () => removeTx(t.id));
    return tr;
  }));
}

function drawBalance(r, b) {
  const pt = (d, y) => ({ x: d.getTime(), y });
  const actual = [pt(r.semStart, b.start)];
  let bal = b.start, lastDate = null;
  for (const t of b.txns) {
    bal -= t.amount;
    if (t.date === lastDate) actual[actual.length - 1].y = bal;
    else actual.push(pt(parse(t.date), bal));
    lastDate = t.date;
  }
  if (r.quick) actual.push(pt(r.asOf, b.balance));
  else if (!lastDate || parse(lastDate) < r.asOf) actual.push(pt(r.asOf, bal));

  const projected = [pt(r.asOf, b.balance)];
  projected.push(b.endBal < 0 && b.runOutDate ? pt(b.runOutDate, 0) : pt(r.semEnd, Math.max(0, b.endBal)));
  const ideal = [pt(r.semStart, b.start), pt(r.semEnd, 0)];
  const fy = v => b.kind === 'money' ? fmt$(v) : fmtN(v, 0);

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
      label: it => ` ${it.dataset.label}: ${fy(it.parsed.y)}`,
    } } },
    scales: {
      x: { type: 'linear', min: r.semStart.getTime(), max: r.semEnd.getTime(),
        ticks: { color: ink, maxTicksLimit: 6, callback: v => fmtDate(new Date(v)) }, grid: { color: grid }, border: { color: grid } },
      y: { min: 0, ticks: { color: ink, callback: v => b.kind === 'money' ? '$' + v : v }, grid: { color: grid }, border: { color: grid } },
    },
  };
  if (chartBalance) { chartBalance.data = data; chartBalance.options = options; chartBalance.update(); }
  else chartBalance = new Chart($('chartBalance'), { type: 'line', data, options });
}

function drawPlaces(a) {
  const MAX = 7;
  const rows = a.places.slice(0, MAX);
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
  if (state.txns.length && !confirm('Replace your current purchases with sample data?')) return;
  if (state.mode !== 'log') setMode('log');
  if (!plan()) {
    state.planId = state.school === 'pitt' ? 'block145' : 'red';
    const p = plan(); state.start = {};
    for (const [k, v] of Object.entries(p.buckets)) state.start[k] = typeof v === 'object' ? v.amount : v;
  }
  state.txns = sampleTxns(parse(state.semStart), today());
  save(); fillPlans(); renderStartFields(); fillBuckets(); render();
});

function sampleTxns(from, to) {
  let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const locs = school().locations;
  const bs = activeBuckets().filter(b => b.period !== 'unlimited');
  const countB = bs.find(b => b.kind === 'count');   // first count bucket = the main one (blocks / meals)
  const moneyB = bs.find(b => b.kind === 'money');
  const menu = [['Coffee', 4.25], ['Breakfast sandwich', 6.75], ['Sushi roll', 9.5], ['Noodle soup', 12], ['Burger & fries', 13.25],
    ['Salad', 10.5], ['Smoothie', 7.5], ['Pizza slice', 4.5], ['Tacos', 9.75], ['Curry plate', 12.5], ['Iced latte', 5.5], ['Snacks', 6], ['Bowl', 11.5]];
  const halls = locs.filter(l => /schatz|nourish|exchange|eatery|perch|tepper eatery|stack'd underground/i.test(l)).slice(0, 3);
  const cafes = locs.filter(l => !halls.includes(l));
  const favs = [cafes[0], cafes[3], cafes[5]].filter(Boolean);
  const out = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY)) {
    const meals = d.getDay() === 5 ? 3 : rnd() < 0.2 ? 1 : 2;
    for (let i = 0; i < meals; i++) {
      const useBlock = countB && halls.length && rnd() < 0.45;
      if (useBlock) {
        out.push({ id: crypto.randomUUID(), date: toISO(d), location: halls[Math.floor(rnd() * halls.length)], item: ['Lunch', 'Dinner', 'Brunch'][Math.floor(rnd() * 3)], bucket: countB.key, amount: 1 });
      } else if (moneyB) {
        const loc = rnd() < 0.55 ? favs[Math.floor(rnd() * favs.length)] : cafes[Math.floor(rnd() * cafes.length)];
        const [item, base] = menu[Math.floor(rnd() * menu.length)];
        out.push({ id: crypto.randomUUID(), date: toISO(d), location: loc, item, bucket: moneyB.key, amount: Math.round((base * (0.85 + rnd() * 0.4)) * 100) / 100 });
      }
    }
  }
  return out;
}

$('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'meal-plan.json' });
  a.click(); URL.revokeObjectURL(a.href);
});
$('btnImport').addEventListener('click', () => $('fileImport').click());
$('fileImport').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!Array.isArray(s.txns)) throw new Error('bad file');
    state = s; save(); location.reload();
  } catch { alert("That file doesn't look like a tracker export."); }
  e.target.value = '';
});

// ---------- go ----------
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
$('footer').innerHTML = 'Data stays in your browser. ' + Object.entries(PLANS).map(([k, c]) => `${SCHOOLS[k].name} plans from <a href="${c.source}" target="_blank" rel="noopener">official source</a> (verified ${c.verified})`).join(' · ') + '.';
fillPlans();
loadLocations();
fillBuckets();
setMode(state.mode);
