// Plain script (not a module) so the page works when opened directly from a file.
const SCHOOLS = window.SCHOOLS, PLANS = window.PLANS;

const $ = id => document.getElementById(id);
// crypto.randomUUID only exists on https; fall back so logging works over plain http too
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
const DAY = 86400000;
const STORE = 'ddt.v3';
const CUSTOM = 'custom';
const OTHER_SCHOOL = 'other';   // "my school isn't listed" — built from state.custom

// Starting point for a school we don't know: one swipe bucket, one money bucket.
const DEFAULT_CUSTOM = () => ({
  name: '',
  buckets: [
    { key: 'swipes', label: 'Meal swipes', kind: 'count', period: 'semester', unit: 'swipe' },
    { key: 'dollars', label: 'Dining dollars', kind: 'money', period: 'semester' },
  ],
  locations: [],
  breaks: [],
});

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
const fmtRate = (b, n) => b.kind === 'money' ? `${fmt$(n)}/day` : `${fmtN(n, 1)}/day`;   // per eating day

// ---------- state ----------
let state = load();
function load() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { s = null; }
  if (!s) s = migrateV2();
  return normalizeState(s);
}
function normalizeState(s) {
  const sch = SCHOOLS[s?.school] || s?.school === OTHER_SCHOOL ? s.school : 'cmu';
  const t0 = termFor(SCHOOLS[sch] || SCHOOLS.cmu) || { start: '2026-08-24', end: '2026-12-13' };
  const base = { mode: 'log', school: sch, planId: CUSTOM, start: {}, current: {}, asOf: toISO(today()),
                 semStart: t0.start, semEnd: t0.end, txns: [], custom: DEFAULT_CUSTOM(),
                 eat: { weekends: true, breaks: false }, blockValues: {},
                 trackFrom: null, trackBalance: {} };   // mid-semester start: balance on the day you began logging
  if (s && s.mode !== 'log' && s.mode !== 'quick') s.mode = 'log';   // heal a bad mode from the old .seg bug
  const st = { ...base, ...(s || {}), asOf: s?.asOf || base.asOf,
               custom: { ...DEFAULT_CUSTOM(), ...(s?.custom || {}) }, eat: { ...base.eat, ...(s?.eat || {}) }, blockValues: { ...(s?.blockValues || {}) }, trackBalance: { ...(s?.trackBalance || {}) } };
  st.school = sch;
  st.txns = (Array.isArray(st.txns) ? st.txns : []).map(normalizeTx);
  return st;
}
// Old single-balance data → put it in the school's money bucket.
function migrateV2() {
  let old;
  try { old = JSON.parse(localStorage.getItem('ddt.v2') || 'null'); } catch { return null; }
  if (!old) return null;
  const key = old.school === 'pitt' ? 'dd' : 'flex';
  return {
    ...old, planId: CUSTOM,
    start: old.start ? { [key]: +old.start } : {},
    current: old.current ? { [key]: +old.current } : {},
    txns: (old.txns || []).map(t => ({ ...t, bucket: key })),
  };
}
function save() {
  if (window.trackerAccount) { window.trackerAccount.save(state); return; }
  localStorage.setItem(STORE, JSON.stringify(state));
}

// Replace the entire visible state when changing accounts; never merge identities.
function replaceTrackerState(value) {
  state = normalizeState(value);
  $('schoolSearch').value = schoolLabel(state.school);
  for (const id of ['semStart', 'semEnd', 'asOf']) $(id).value = state[id];
  $('txForm').reset();
  $('txDate').value = toISO(today());
  $('txLocationOther').hidden = true;
  $('txLocationOther').required = false;
  $('splitFields').hidden = true;
  $('btnSplit').hidden = false;
  $('pasteText').value = '';
  $('scanResult').hidden = true;
  $('scanBody').replaceChildren();
  $('scanStatus').hidden = true;
  chartBalance?.destroy(); chartBalance = null;
  chartPlaces?.destroy(); chartPlaces = null;
  chartKey = null;
  refreshSchool();
  setMode(state.mode, false);
  showTab(Object.values(state.start || {}).some(v => v > 0) || state.txns.length ? 'home' : 'setup', false);
  window.dispatchEvent(new Event('tracker-account-changed'));
}

// A purchase can be paid from more than one bucket (a block for the meal + FLEX for the
// extras). Older data had a single bucket/amount; fold it into parts.
function normalizeTx(t) {
  if (Array.isArray(t.parts) && t.parts.length) return t;
  const { bucket, amount, ...rest } = t;
  return { ...rest, parts: [{ bucket, amount }] };
}
const partFor = (t, key) => t.parts.find(pt => pt.bucket === key);

// What one block/swipe buys at a location, in dollars: a manual entry wins, otherwise the
// average of values seen on receipts there ("MEAL BLOCK -12.49"). null if unknown.
function blockValueAt(location) {
  const manual = +state.blockValues?.[location];
  if (manual > 0) return { value: manual, source: 'manual', n: 0 };
  const seen = [];
  for (const t of state.txns) if (t.location === location) for (const pt of t.parts) if (pt.value > 0 && pt.amount > 0) seen.push(pt.value / pt.amount);
  if (!seen.length) return null;
  return { value: seen.reduce((a, b) => a + b, 0) / seen.length, source: 'receipts', n: seen.length };
}

// ---------- terms ----------
// The term that contains `on` (today by default); otherwise the next upcoming one; otherwise the last.
function termFor(sch, on = today()) {
  const terms = sch?.terms || [];
  if (!terms.length) return null;
  const iso = toISO(on);
  return terms.find(t => t.start <= iso && iso <= t.end) || terms.find(t => t.start > iso) || terms[terms.length - 1];
}
const termById = name => (school().terms || []).find(t => t.name === name) || null;
// Next term after the one whose end date matches the current semEnd, if any.
function nextTerm() {
  const terms = school().terms || [];
  const i = terms.findIndex(t => t.end === state.semEnd);
  return i >= 0 ? terms[i + 1] || null : null;
}

function school() {
  if (state.school !== OTHER_SCHOOL) return SCHOOLS[state.school];
  const c = state.custom;
  return {
    name: c.name || 'My school',
    buckets: Object.fromEntries(c.buckets.map(b => [b.key, { label: b.label || 'Untitled', kind: b.kind, period: b.period, unit: b.unit || 'swipe' }])),
    semStart: state.semStart, semEnd: state.semEnd,
    locations: c.locations, breaks: c.breaks || [], aliases: [], terms: [],
  };
}
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
// Searchable school picker: type to filter by name or alias, click/Enter to choose.
const SCHOOL_OPTIONS = Object.entries(SCHOOLS)
  .sort((a, b) => a[1].name.localeCompare(b[1].name))
  .map(([id, s]) => ({ id, name: s.name, aliases: s.aliases || [] }));
let listIndex = -1;
function schoolLabel(id) { return id === OTHER_SCHOOL ? (state.custom.name || 'My school') : SCHOOLS[id].name; }
function renderSchoolList(q) {
  const needle = q.trim().toLowerCase();
  const hits = SCHOOL_OPTIONS.filter(o => !needle || o.name.toLowerCase().includes(needle) || o.aliases.some(a => a.toLowerCase().includes(needle)));
  const ul = $('schoolList');
  ul.replaceChildren(
    ...(hits.length ? hits.map(o => {
      const li = document.createElement('li'); li.setAttribute('role', 'option'); li.dataset.id = o.id;
      const alias = needle && !o.name.toLowerCase().includes(needle) ? o.aliases.find(a => a.toLowerCase().includes(needle)) : (o.aliases[0] || '');
      li.innerHTML = `${esc(o.name)}${alias ? `<span class="alias">${esc(alias)}</span>` : ''}`;
      return li;
    }) : [Object.assign(document.createElement('li'), { className: 'none', textContent: `No match for “${q.trim()}”` })]),
    Object.assign(document.createElement('li'), { className: 'other', textContent: "Other — my school isn't listed", role: 'option' }),
  );
  ul.lastElementChild.dataset.id = OTHER_SCHOOL;
  listIndex = -1;
  openList(true);
}
function openList(open) { $('schoolList').hidden = !open; $('schoolSearch').setAttribute('aria-expanded', open); }
function highlight(i) {
  const items = [...$('schoolList').querySelectorAll('li[data-id]')];
  if (!items.length) return;
  listIndex = (i + items.length) % items.length;
  items.forEach((li, k) => li.setAttribute('aria-selected', k === listIndex));
  items[listIndex].scrollIntoView({ block: 'nearest' });
}
$('schoolSearch').addEventListener('focus', e => { e.target.select(); renderSchoolList(''); });
$('schoolSearch').addEventListener('input', e => renderSchoolList(e.target.value));
$('schoolSearch').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); if ($('schoolList').hidden) renderSchoolList(e.target.value); highlight(listIndex + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(listIndex - 1); }
  else if (e.key === 'Enter' || e.key === 'Return') { e.preventDefault(); const items = $('schoolList').querySelectorAll('li[data-id]'); const pick = items[listIndex] || items[0]; if (pick) chooseSchool(pick.dataset.id); }
  else if (e.key === 'Escape') closeList();
});
// Close on a tap/click anywhere outside the picker. (Not on blur: on iOS the input blurs
// before a tap on the list lands, which would close the list under the finger.)
function closeList() { openList(false); $('schoolSearch').value = schoolLabel(state.school); }
document.addEventListener('pointerdown', e => { if (!e.target.closest('.combo') && !$('schoolList').hidden) closeList(); });
$('schoolList').addEventListener('mousedown', e => { if (e.target.closest('li[data-id]')) e.preventDefault(); });   // keep input focus on desktop
$('schoolList').addEventListener('click', e => {
  const li = e.target.closest('li[data-id]');
  if (li) { e.preventDefault(); chooseSchool(li.dataset.id); }
});
function chooseSchool(id) {
  openList(false); $('schoolSearch').value = schoolLabel(id === state.school ? id : state.school); $('schoolSearch').blur();
  if (id === state.school) return;
  if (state.txns.length && !confirm('Switching schools clears your logged purchases. Continue?')) { $('schoolSearch').value = schoolLabel(state.school); return; }
  state.school = id;
  state.txns = [];
  if (id !== OTHER_SCHOOL) {
    const t = termFor(school());
    if (t) { state.semStart = $('semStart').value = t.start; state.semEnd = $('semEnd').value = t.end; }
  }
  state.planId = CUSTOM; state.start = {}; state.current = {};
  save(); $('schoolSearch').value = schoolLabel(id); refreshSchool();
}
$('schoolSearch').value = schoolLabel(state.school);
$('semStart').value = state.semStart;
$('semEnd').value = state.semEnd;
$('asOf').value = state.asOf;
$('txDate').value = toISO(today());

const MODE_HINT = {
  log: 'Log each purchase to get a breakdown by restaurant and meal.',
  quick: 'Just type what you started with and what you have now.',
};
function setMode(m, persist = true) {
  if (m !== 'log' && m !== 'quick') m = 'log';
  state.mode = m; if (persist) save();
  for (const b of document.querySelectorAll('.seg button[data-mode]')) b.setAttribute('aria-checked', b.dataset.mode === m);
  $('modeHint').textContent = MODE_HINT[m];
  $('quickFields').hidden = m !== 'quick';
  $('logCard').hidden = m !== 'log';
  $('scanCard').hidden = m !== 'log';
  $('homeLeft').hidden = m !== 'log';
  setAvail('txCard', m === 'log');
  renderStartFields();
  render();
}
for (const b of document.querySelectorAll('.seg button[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));

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
    : (cat ? `Plans from <a href="${cat.source}" target="_blank" rel="noopener">official ${esc(school().name)} dining info</a>, verified ${cat.verified}.`
           : 'No catalog for this school yet — type your starting amounts below.');
}

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
$('midOn').addEventListener('change', e => {
  state.trackFrom = e.target.checked ? ($('midFrom').value || toISO(today())) : null;
  if (!e.target.checked) state.trackBalance = {};
  save(); renderStartFields(); render();
});
$('midFrom').addEventListener('input', e => { if (state.trackFrom) { state.trackFrom = e.target.value; save(); render(); } });
$('eatWeekends').addEventListener('change', e => { state.eat.weekends = e.target.checked; save(); render(); });
$('eatBreaks').addEventListener('change', e => { state.eat.breaks = e.target.checked; save(); render(); });
$('eatWeekends').checked = state.eat.weekends;
$('eatBreaks').checked = state.eat.breaks;

// ---------- eating days ----------
// A "day" for pacing purposes is a day you actually use the plan: weekends and breaks are
// optional. All rates (pace, safe pace) are per eating day.
const WEEKEND = d => d.getDay() === 0 || d.getDay() === 6;
function breaksFor() {
  const sch = school();
  const all = sch.terms?.length ? sch.terms.flatMap(t => t.breaks || []) : (sch.breaks || []);
  const s0 = parse(state.semStart), e0 = parse(state.semEnd);
  return all.map(b => ({ ...b, s: parse(b.start), e: parse(b.end || b.start) }))
    .filter(b => !isNaN(b.s) && !isNaN(b.e) && b.e >= s0 && b.s <= e0);
}
function inBreak(d, breaks) { return breaks.find(b => d >= b.s && d <= b.e) || null; }
function isEatDay(d, breaks) {
  if (!state.eat.weekends && WEEKEND(d)) return false;
  if (!state.eat.breaks && inBreak(d, breaks)) return false;
  return true;
}
// Count eating days in [from, to] inclusive.
function countEatDays(from, to, breaks) {
  let n = 0;
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY)) if (isEatDay(d, breaks)) n++;
  return n;
}
// The calendar date on which `balance` runs out at `pace` per eating day, starting the day after `from`.
function runOutOn(from, balance, pace, breaks, limit) {
  if (!(pace > 0)) return null;
  let bal = balance;
  for (let d = new Date(from.getTime() + DAY); d <= limit; d = new Date(d.getTime() + DAY)) {
    if (isEatDay(d, breaks)) { bal -= pace; if (bal <= 0) return d; }
  }
  return null;
}
function renderEatSummary(r) {
  const breaks = breaksFor();
  const skipped = state.eat.breaks ? [] : breaks.filter(b => b.e >= (r?.asOf || today()) && b.s <= (r ? r.semEnd : parse(state.semEnd)));
  $('breaksHint').textContent = breaks.length
    ? `${school().name} breaks: ` + breaks.map(b => `${b.name} (${fmtDate(b.s)}${b.e > b.s ? '–' + fmtDate(b.e) : ''})`).join(', ')
    : (state.school === OTHER_SCHOOL ? 'Add your breaks above to skip them.' : 'No breaks on file.');
  if (!r) { $('eatSummary').textContent = ''; return; }
  const parts = [];
  if (!state.eat.weekends) parts.push('weekends');
  if (skipped.length) parts.push(skipped.map(b => b.name).join(', '));
  $('eatSummary').textContent = `${r.daysLeft} eating days left of ${r.calDaysLeft} calendar days` + (parts.length ? ` — skipping ${parts.join(' and ')}.` : '.');
}

// One input per bucket for the starting amount; in quick mode a second column for "now".
function renderStartFields() {
  const quick = state.mode === 'quick';
  const wrap = $('startFields');
  wrap.replaceChildren();
  $('midWrap').hidden = quick;
  $('midOn').checked = !!state.trackFrom;
  $('midFrom').value = state.trackFrom || toISO(today());
  $('midDate').hidden = !state.trackFrom;
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
      // A catalog plan fixes the starting allotment; only "what's left" is yours to type.
      const fixed = which === 'start' && p && pb !== undefined;
      if (fixed) { inp.readOnly = true; inp.tabIndex = -1; inp.classList.add('fixed'); inp.title = `Set by the ${p.name}`; lab.innerHTML += ' <span class="pill">from plan</span>'; }
      else inp.addEventListener('input', () => { state[which][key] = inp.value === '' ? undefined : +inp.value; save(); fillBuckets(); render(); });
      box.appendChild(inp); cell.append(lab, box);
      return cell;
    };
    grid.appendChild(mk('start', quick ? `${def.label} at start` : def.label));
    if (quick) grid.appendChild(mk('current', period === 'week' ? `${def.label} left this week` : `${def.label} now`));
    else if (period !== 'week') {
      // mid-semester start: what was left on the day you began logging
      const cell = mk('trackBalance', `${def.label} when you started logging`);
      cell.className = 'mid-field'; cell.hidden = !state.trackFrom;
      grid.appendChild(cell);
    }
    if (def.hint) { const h = document.createElement('p'); h.className = 'hint'; h.textContent = def.hint; h.style.gridColumn = '1 / -1'; grid.appendChild(h); }
    wrap.appendChild(grid);
  }
}

function renderTermPicker() {
  const terms = school().terms || [];
  const wrap = $('termWrap');
  wrap.hidden = !terms.length;
  if (!terms.length) return;
  const sel = $('term');
  sel.replaceChildren(...terms.map(t => new Option(`${t.name} · ${fmtDate(parse(t.start))} – ${fmtDate(parse(t.end))}`, t.name)), new Option('Custom dates', '__custom'));
  const cur = terms.find(t => t.start === state.semStart && t.end === state.semEnd);
  sel.value = cur ? cur.name : '__custom';
  // Semester over? Offer the next one.
  const nt = nextTerm();
  const over = today() > parse(state.semEnd) && nt;
  $('termOver').hidden = !over;
  if (over) $('termOverText').textContent = `${cur?.name || 'This term'} ended ${fmtDate(parse(state.semEnd))}. Start ${nt.name}?`;
}
$('term').addEventListener('change', e => {
  const t = termById(e.target.value);
  if (!t) return;
  state.semStart = $('semStart').value = t.start; state.semEnd = $('semEnd').value = t.end;
  save(); render();
});
$('termNext').addEventListener('click', () => {
  const nt = nextTerm(); if (!nt) return;
  const p = plan();
  if (!confirm(`Start ${nt.name}? This clears this term's purchases and resets your balances${p ? ` to the ${p.name} allotment` : ''}. Export first if you want to keep them.`)) return;
  state.txns = []; state.current = {};
  if (p) for (const [k, v] of Object.entries(p.buckets)) state.start[k] = typeof v === 'object' ? v.amount : v;
  state.semStart = $('semStart').value = nt.start; state.semEnd = $('semEnd').value = nt.end;
  save(); renderStartFields(); fillBuckets(); render();
});

// School colors + badge once a school is chosen; default blue otherwise.
function applySchoolTheme() {
  const sch = state.school !== OTHER_SCHOOL ? SCHOOLS[state.school] : null;
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  if (sch?.colors) {
    root.style.setProperty('--accent', dark ? sch.colors.dark : sch.colors.light);
    root.style.setProperty('--accent2', sch.colors.second);
    $('schoolShort').textContent = sch.short || sch.name;
    const img = $('schoolLogo');
    img.hidden = false; img.src = `https://www.google.com/s2/favicons?domain=${sch.domain}&sz=64`;
    img.onerror = () => { img.hidden = true; };
    $('schoolBadge').hidden = false;
  } else {
    root.style.removeProperty('--accent'); root.style.removeProperty('--accent2');
    $('schoolBadge').hidden = true;
  }
}

function refreshSchool() {
  applySchoolTheme();
  $('customSchool').hidden = state.school !== OTHER_SCHOOL;
  if (state.school === OTHER_SCHOOL) renderCustomEditor();
  fillPlans(); renderStartFields(); loadLocations(); fillBuckets(); render();
}

// ---------- custom school builder ----------
function renderCustomEditor() {
  const c = state.custom;
  $('customName').value = c.name;
  $('customLocations').value = c.locations.join('\n');
  $('customBreaks').value = (c.breaks || []).map(b => b.end && b.end !== b.start ? `${b.name}, ${b.start}, ${b.end}` : `${b.name}, ${b.start}`).join('\n');
  const rows = $('bucketRows');
  rows.replaceChildren(...c.buckets.map((b, i) => {
    const row = document.createElement('div'); row.className = 'brow';
    row.innerHTML = `
      <input data-f="label" placeholder="Name (e.g. Meal swipes)" value="${esc(b.label)}">
      <button type="button" class="link danger del" aria-label="Remove">✕</button>
      <div class="opts">
        <select data-f="kind" title="Count = swipes/blocks, Money = dollars"><option value="count">Count</option><option value="money">Money</option></select>
        <select data-f="period" title="When it resets"><option value="semester">Semester</option><option value="week">Weekly</option><option value="unlimited">Unlimited</option></select>
        <input data-f="unit" placeholder="unit" title="Singular unit, e.g. swipe" value="${esc(b.unit || '')}">
      </div>`;
    row.querySelector('[data-f=kind]').value = b.kind;
    row.querySelector('[data-f=period]').value = b.period;
    row.querySelector('[data-f=unit]').hidden = b.kind !== 'count';
    for (const el of row.querySelectorAll('[data-f]')) {
      el.addEventListener('input', () => {
        b[el.dataset.f] = el.value;
        if (el.dataset.f === 'kind') row.querySelector('[data-f=unit]').hidden = b.kind !== 'count';
        if (el.dataset.f === 'label' && !b.locked) b.key = slugKey(b.label, c.buckets.filter(x => x !== b));
        save(); fillPlans(); renderStartFields(); fillBuckets(); render();
      });
    }
    row.querySelector('.del').addEventListener('click', () => {
      c.buckets.splice(i, 1);
      state.txns = state.txns.map(t => ({ ...t, parts: t.parts.filter(pt => pt.bucket !== b.key) })).filter(t => t.parts.length);
      save(); renderCustomEditor(); renderStartFields(); fillBuckets(); render();
    });
    return row;
  }));
}
function slugKey(label, others) {
  let base = (label || 'bucket').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'bucket', k = base, n = 2;
  while (others.some(o => o.key === k)) k = `${base}_${n++}`;
  return k;
}
$('addBucket').addEventListener('click', () => {
  state.custom.buckets.push({ key: slugKey('bucket', state.custom.buckets), label: '', kind: 'count', period: 'semester', unit: 'swipe' });
  save(); renderCustomEditor();
  $('bucketRows').lastElementChild.querySelector('input').focus();
});
$('customName').addEventListener('input', e => { state.custom.name = e.target.value; save(); fillPlans(); $('schoolSearch').value = schoolLabel(state.school); });
$('customLocations').addEventListener('input', e => {
  state.custom.locations = e.target.value.split('\n').map(l => l.trim()).filter(Boolean);
  save(); loadLocations();
});
// "Name, 2026-10-12, 2026-10-16" or "Name, 2026-09-07" per line
$('customBreaks').addEventListener('input', e => {
  state.custom.breaks = e.target.value.split('\n').map(l => {
    const [name, start, end] = l.split(',').map(x => x.trim());
    return name && /^\d{4}-\d{2}-\d{2}$/.test(start || '') ? { name, start, end: /^\d{4}-\d{2}-\d{2}$/.test(end || '') ? end : start } : null;
  }).filter(Boolean);
  save(); render();
});

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
  const opts = activeBuckets().filter(b => b.period !== 'unlimited');
  for (const id of ['txBucket', 'txBucket2']) {
    const sel = $(id), keep = sel.value;
    sel.replaceChildren(...opts.map(b => new Option(b.label, b.key)));
    if (opts.some(b => b.key === keep)) sel.value = keep;
  }
  $('btnSplit').hidden = opts.length < 2;
  if (opts.length < 2) $('splitFields').hidden = true;
  updateAmountField();
}
// The second bucket defaults to "the other kind" (block ↔ money).
function pickOtherBucket() {
  const opts = activeBuckets().filter(b => b.period !== 'unlimited');
  const first = opts.find(b => b.key === $('txBucket').value);
  const other = opts.find(b => b.key !== first?.key && b.kind !== first?.kind) || opts.find(b => b.key !== first?.key);
  if (other) $('txBucket2').value = other.key;
}
$('btnSplit').addEventListener('click', () => { $('splitFields').hidden = false; $('btnSplit').hidden = true; pickOtherBucket(); updateAmountField(); $('txAmount2').focus(); });
$('btnUnsplit').addEventListener('click', () => { $('splitFields').hidden = true; $('btnSplit').hidden = false; $('txAmount2').value = ''; });
function styleAmount(selId, wrapId, inpId) {
  const b = activeBuckets().find(b => b.key === $(selId).value);
  const money = !b || b.kind === 'money';
  $(wrapId).className = money ? 'money' : '';
  $(wrapId).querySelector('span').hidden = !money;
  const inp = $(inpId);
  inp.step = money ? '0.01' : '1'; inp.min = money ? '0.01' : '1';
  inp.placeholder = money ? (inpId === 'txAmount' ? '12.50' : '3.50') : '1';
  if (!money && !inp.value) inp.value = '1';
  if (money && inp.value === '1') inp.value = '';
  return { b, money };
}
function updateAmountField() {
  const { b, money } = styleAmount('txBucket', 'txAmountWrap', 'txAmount');
  $('txAmountLabel').textContent = money ? 'Amount' : `${b.unit[0].toUpperCase() + b.unit.slice(1)}s`;
  $('txWorthWrap').hidden = money;   // "worth $" only makes sense for blocks/swipes
  styleAmount('txBucket2', 'txAmount2Wrap', 'txAmount2');
}
$('txBucket').addEventListener('change', updateAmountField);
$('txBucket2').addEventListener('change', updateAmountField);

$('txForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!$('txBucket').value) { alert('Pick a meal plan or enter a starting balance first.'); return; }
  const parts = [{ bucket: $('txBucket').value, amount: Math.round(parseFloat($('txAmount').value) * 100) / 100 }];
  const worth = Math.round(parseFloat($('txWorth').value || 0) * 100) / 100;
  if (!$('txWorthWrap').hidden && worth > 0) parts[0].value = worth;
  const amt2 = Math.round(parseFloat($('txAmount2').value || 0) * 100) / 100;
  if (!$('splitFields').hidden && amt2 > 0 && $('txBucket2').value !== parts[0].bucket) parts.push({ bucket: $('txBucket2').value, amount: amt2 });
  state.txns.push({
    id: uid(),
    date: $('txDate').value,
    location: ($('txLocation').value === OTHER ? $('txLocationOther').value : $('txLocation').value).trim(),
    item: $('txItem').value.trim(),
    parts,
  });
  save(); render();
  $('txAmount').value = ''; $('txAmount2').value = ''; $('txWorth').value = ''; $('txItem').value = ''; $('txLocationOther').value = '';
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
  const breaks = breaksFor();
  // elapsed = eating days so far (semester start through yesterday); daysLeft = eating days after today
  const elapsed = Math.max(1, countEatDays(semStart, new Date(asOf.getTime() - DAY), breaks));
  const calDaysLeft = Math.max(0, daysBetween(asOf, semEnd));
  const daysLeft = asOf < semEnd ? countEatDays(new Date(asOf.getTime() + DAY), semEnd, breaks) : 0;
  const txns = quick ? [] : [...state.txns].sort((a, b) => a.date.localeCompare(b.date));

  const buckets = activeBuckets().map(b => {
    // this bucket's share of each purchase, as {date, location, item, amount}
    const r = { ...b, txns: txns.filter(t => partFor(t, b.key)).map(t => ({ date: t.date, location: t.location, item: t.item, amount: partFor(t, b.key).amount })) };
    if (b.period === 'unlimited') return { ...r, status: 'muted' };
    if (b.passive) {   // e.g. guest swipes: just count them, no pacing
      if (!(b.start > 0)) return { ...r, status: 'muted', noData: true };
      const used = quick ? b.start - (+state.current[b.key] || 0) : r.txns.reduce((s, t) => s + t.amount, 0);
      return { ...r, spent: used, balance: b.start - used, status: 'muted' };
    }
    if (b.period === 'week') {
      // Week runs Monday → Sunday (Pitt resets Sunday 11:59 pm).
      const dow = (asOf.getDay() + 6) % 7;
      const weekStart = new Date(asOf.getTime() - dow * DAY);
      const thisWeek = r.txns.filter(t => parse(t.date) >= weekStart && parse(t.date) <= asOf);
      const used = quick ? b.start - (+state.current[b.key] || 0) : thisWeek.reduce((s, t) => s + t.amount, 0);
      const weekEnd = new Date(weekStart.getTime() + 6 * DAY);
      const left = b.start - used, daysLeftWk = Math.max(1, countEatDays(asOf, weekEnd, breaks));
      const status = left <= 0 ? 'bad' : left > daysLeftWk * 3 ? 'warn' : 'good';
      return { ...r, used, balance: left, daysLeftWk, safe: left / daysLeftWk, weekStart, status };
    }
    if (!(b.start > 0)) return { ...r, status: 'muted', noData: true };
    if (quick && !(+state.current[b.key] >= 0) ) return { ...r, status: 'muted', noData: true };
    if (quick && state.current[b.key] === undefined) return { ...r, status: 'muted', noData: true };
    // Started mid-semester? Whatever was gone before the first log counts as spent too.
    const priorBal = !quick && state.trackFrom && state.trackBalance[b.key] !== undefined ? +state.trackBalance[b.key] : null;
    const prior = priorBal !== null ? Math.max(0, b.start - priorBal) : 0;
    const spent = quick ? b.start - (+state.current[b.key]) : prior + r.txns.reduce((s, t) => s + t.amount, 0);
    const balance = b.start - spent;
    const pace = spent / elapsed;
    const safe = daysLeft > 0 ? Math.max(0, balance) / daysLeft : 0;
    const endBal = balance - pace * daysLeft;
    const runOutDate = balance <= 0 ? asOf : runOutOn(asOf, balance, pace, breaks, semEnd);
    const tol = b.kind === 'money' ? Math.max(25, b.start * 0.03) : Math.max(2, b.start * 0.05);
    const status = balance <= 0 ? 'bad' : daysLeft === 0 ? (balance > tol ? 'warn' : 'good')
      : endBal < -tol ? 'bad' : endBal > tol ? 'warn' : 'good';
    return { ...r, spent, balance, pace, safe, endBal, runOutDate, tol, status, prior, priorBal, trackFrom: prior ? parse(state.trackFrom) : null };
  });

  if (!buckets.some(b => !b.noData && b.period !== 'unlimited')) return null;
  return { quick, semStart, semEnd, asOf, totalDays, elapsed, daysLeft, calDaysLeft, txns, buckets };
}

// What a block/swipe really costs on this plan: (plan price − money buckets) / count allotment.
function unitValue(r) {
  const p = plan();
  const counts = r.buckets.filter(b => b.kind === 'count' && b.period !== 'unlimited' && !b.passive && b.start > 0);
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
  const dollars = t => t.parts.reduce((s, pt) => s + (byKey[pt.bucket]?.kind === 'count' ? (pt.value > 0 ? pt.value : pt.amount * (uv?.value || 0)) : pt.amount), 0);
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
    if (b.period !== 'semester' || b.noData || b.passive || !(b.pace > b.safe) || r.daysLeft === 0) continue;
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
  const countB = r.buckets.find(b => b.kind === 'count' && b.period !== 'unlimited' && !b.noData && !b.passive);
  if (uv && !uv.estimated && moneyB && countB) {
    const pricey = moneyB.txns.filter(t => t.amount > uv.value);   // money spent per purchase from this bucket
    if (pricey.length) insights.push({ html: `A ${countB.unit} costs you <b>${fmt$(uv.value)}</b> on this plan. ${pricey.length} of your ${esc(moneyB.label)} purchases cost more than that — ${countB.status === 'warn' ? `and you have ${countB.unit}s to spare.` : `consider using ${countB.unit}s for those.`}` });
    else insights.push({ html: `A ${countB.unit} costs you <b>${fmt$(uv.value)}</b> on this plan; none of your ${esc(moneyB.label)} purchases beat that. Nice.` });
  }

  // Block value by place: where do your blocks buy the most?
  const blockPlaces = blockValueTable();
  if (blockPlaces.length >= 2) {
    const hi = blockPlaces[0], lo = blockPlaces[blockPlaces.length - 1];
    if (hi.value - lo.value >= 1.5) {
      const unitTxt = uv && !uv.estimated ? ` (a block costs you ${fmt$(uv.value)})` : '';
      insights.push({ hot: lo.value < (uv?.value || 0) - 1, html: `A block buys <b>${fmt$(hi.value)}</b> of food at ${esc(hi.location)} but only <b>${fmt$(lo.value)}</b> at ${esc(lo.location)}${unitTxt}. ${lo.uses ? `Your ${lo.uses} block${lo.uses > 1 ? 's' : ''} at ${esc(lo.location)} left ~${fmt$((hi.value - lo.value) * lo.uses)} on the table — pay there with ${esc(moneyB?.label || 'dollars')} and save blocks for ${esc(hi.location)}.` : ''}` });
    }
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

  return { places, insights, uv, blockPlaces, hasCount: txns.some(t => t.parts.some(pt => byKey[pt.bucket]?.kind === 'count')) };
}

// Every place with a known block value, best first, with how many blocks you've used there.
function blockValueTable() {
  const defs = school().buckets;
  const uses = new Map();
  for (const t of state.txns) for (const pt of t.parts) if (defs[pt.bucket]?.kind === 'count') uses.set(t.location, (uses.get(t.location) || 0) + pt.amount);
  const places = new Set([...Object.keys(state.blockValues || {}), ...uses.keys()]);
  return [...places].map(loc => ({ location: loc, ...(blockValueAt(loc) || {}), uses: uses.get(loc) || 0 }))
    .filter(r => r.value > 0).sort((a, b) => b.value - a.value);
}

// ---------- render ----------
let chartBalance, chartPlaces, chartKey = null;

function render() {
  const r = compute();
  renderTable();
  renderEatSummary(r);
  renderTermPicker();

  renderContext();
  $('verdict').hidden = !r; $('emptyBalance').hidden = !!r;
  $('chartTabs').replaceChildren();
  syncDash(r);
  if (!r) { chartBalance?.destroy(); chartBalance = null; setAvail('analytics', false); setAvail('blockValues', false); setAvail('txCard', state.mode === 'log'); syncLogStack(); return; }

  renderVerdict(r);
  renderSummary(r);
  renderChartTabs(r);

  const a = r.quick ? null : analyze(r);
  setAvail('analytics', !!a);
  setAvail('txCard', state.mode === 'log');
  if (a) {
    $('insights').innerHTML = a.insights.map(i => `<li class="${i.hot ? 'hot' : ''}">${i.html}</li>`).join('');
    $('placesHint').textContent = a.hasCount && a.uv
      ? (a.uv.estimated ? `Blocks/meals counted at an estimated ${fmt$(a.uv.value)} each — pick your plan for the real number.`
                        : `Blocks/meals counted at what they actually bought when the receipt says so, otherwise at ${fmt$(a.uv.value)} — what your plan charges per ${r.buckets.find(b => b.kind === 'count')?.unit || 'block'}.`)
      : '';
    drawPlaces(a);
    renderBlockValues(a.blockPlaces);
  } else setAvail('blockValues', false);
  syncLogStack();
}

function renderBlockValues(rows) {
  const box = $('blockValues');
  const defs = school().buckets;
  const countB = Object.values(defs).find(d => d.kind === 'count' && !d.passive);
  if (!countB) { setAvail('blockValues', false); return; }
  setAvail('blockValues', true);
  const unit = countB.unit;
  $('blockValuesTab').textContent = `${unit[0].toUpperCase() + unit.slice(1)} value`;
  $('blockValuesHint').textContent = `How much a ${unit} covers at each place, from your receipts. Use ${unit}s where they buy the most.`;
  if (!rows.length) {
    $('blockValuesBody').innerHTML = `<p class="hint">Unknown so far. Scan a receipt that shows a ${unit} payment, or type a value when logging a ${unit} ("worth $"), or add one below.</p>`;
  } else {
    $('blockValuesBody').innerHTML = `<table class="bv-table"><tbody>${rows.map(r => `<tr>
      <td>${esc(r.location)}</td>
      <td class="num"><b>${fmt$(r.value)}</b><span class="sub">${r.source === 'manual' ? 'you set this' : `from ${r.n} receipt${r.n > 1 ? 's' : ''}`}</span></td>
      <td class="num muted">${r.uses ? plural(r.uses, unit) : ''}</td>
      <td class="act"><button class="link" data-bv-edit="${esc(r.location)}" aria-label="Edit">✎</button></td>
    </tr>`).join('')}</tbody></table>`;
    for (const b of box.querySelectorAll('[data-bv-edit]')) b.addEventListener('click', () => {
      const cur = blockValueAt(b.dataset.bvEdit)?.value;
      const v = prompt(`What does one ${unit} cover at ${b.dataset.bvEdit}? ($)`, cur ? cur.toFixed(2) : '');
      if (v === null) return;
      if (+v > 0) state.blockValues[b.dataset.bvEdit] = +v; else delete state.blockValues[b.dataset.bvEdit];
      save(); render();
    });
  }
}
$('bvAdd').addEventListener('click', () => {
  const loc = $('bvPlace').value, v = +$('bvValue').value;
  if (!loc || loc === OTHER || !(v > 0)) return;
  state.blockValues[loc] = v; $('bvValue').value = '';
  save(); render();
});
// keep the "add a place" dropdown in step with the location list
const _fillBvPlaces = () => { const sel = $('bvPlace'); const keep = sel.value; sel.replaceChildren(...[...$('txLocation').options].filter(o => o.value && o.value !== OTHER).map(o => new Option(o.text, o.value))); if ([...sel.options].some(o => o.value === keep)) sel.value = keep; };
new MutationObserver(_fillBvPlaces).observe($('txLocation'), { childList: true });

function describe(b, r) {
  if (b.period === 'unlimited') return `${b.label}: unlimited.`;
  if (b.noData) return `${b.label}: enter a balance to track.`;
  if (b.passive) return `${b.label}: ${fmtN(b.balance, 0)} of ${fmtN(b.start, 0)} left.`;
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
  const tracked = r.buckets.filter(b => !b.noData && b.period === 'semester' && !b.passive);
  const worst = ['bad', 'warn', 'good'].map(s => tracked.find(b => b.status === s)).find(Boolean);
  const weekly = r.buckets.find(b => b.period === 'week' && !b.noData);
  const v = $('verdict');
  v.className = 'verdict ' + (worst?.status || weekly?.status || 'good');
  let head;
  if (!worst && weekly) head = weekly.balance <= 0 ? `No ${weekly.unit}s left this week — resets ${weekly.daysLeftWk === 1 ? 'tomorrow' : 'Sunday night'}.` : `${plural(weekly.balance, weekly.unit)} left this week${weekly.daysLeftWk > 1 ? ` — about ${fmtN(weekly.safe, 1)} a day` : ''}.`;
  else if (!worst) head = 'Nothing to project yet.';
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
    else if (b.passive) cells = `<td class="num">${fmtQ(b, b.balance, 0)}${pct}</td><td class="num muted" colspan="3">not paced</td>`;
    else if (b.period === 'week') cells = `<td class="num">${fmtQ(b, b.balance, 0)}${pct}</td><td class="num">${fmtN(b.used, 0)} used<span class="sub">this week</span></td><td class="num">${fmtN(b.safe, 1)}/day</td><td class="num muted">resets Sun</td>`;
    else cells = `<td class="num">${fmtQ(b, b.balance)}${pct}</td><td class="num ${b.pace > b.safe ? 'warn' : ''}">${fmtRate(b, b.pace)}</td><td class="num">${fmtRate(b, b.safe)}</td><td class="num ${b.status}">${b.endBal < 0 ? `−${fmtQ(b, -b.endBal, 0)}<span class="sub">short</span>` : `${fmtQ(b, b.endBal, 0)}<span class="sub">left over</span>`}</td>`;
    tr.innerHTML = `<td>${esc(b.label)}</td>${cells}`;
    return tr;
  }));
}

function renderChartTabs(r) {
  const plottable = r.buckets.filter(b => b.period === 'semester' && !b.noData && !b.passive);
  const weekly = r.buckets.filter(b => b.period === 'week' && !b.noData);
  if (!plottable.length && weekly.length) { drawWeek(r, weekly[0]); return; }
  $('legendWeek').hidden = true; $('legendSem').hidden = false;
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
    const paid = t.parts.map(pt => {
      const d = defs[pt.bucket];
      return !d ? fmt$(pt.amount) : d.kind === 'money' ? `${fmt$(pt.amount)} <span class="sub">${esc(d.label)}</span>` : `${plural(pt.amount, d.unit)}${pt.value > 0 ? ` <span class="sub">worth ${fmt$(pt.value)}</span>` : ''}`;
    }).join(' <span class="plus">+</span> ');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="muted">${fmtDate(parse(t.date))}</td><td>${esc(t.location)}</td><td class="muted">${esc(t.item)}</td><td class="num">${paid}</td><td class="act"><button class="link danger" aria-label="Delete">✕</button></td>`;
    tr.querySelector('button').addEventListener('click', () => removeTx(t.id));
    return tr;
  }));
}

// Weekly plans: meals used each day this week vs. the even-pace allowance.
function drawWeek(r, b) {
  $('legendWeek').hidden = false; $('legendSem').hidden = true;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dow = (r.asOf.getDay() + 6) % 7;
  const used = Array(7).fill(0);
  for (const t of b.txns) { const d = parse(t.date); if (d >= b.weekStart && d <= new Date(b.weekStart.getTime() + 6 * DAY)) used[(d.getDay() + 6) % 7] += t.amount; }
  const perDay = b.start / 7;
  const accent = css('--accent'), idealC = css('--ideal'), grid = css('--grid'), ink = css('--text-2');
  const data = { labels: days, datasets: [
    { type: 'bar', label: 'Used', data: used, backgroundColor: days.map((_, i) => i > dow ? 'transparent' : accent), borderColor: accent, borderWidth: days.map((_, i) => i > dow ? 1 : 0), borderRadius: 4, barThickness: 22 },
    { type: 'line', label: 'Even pace', data: days.map(() => perDay), borderColor: idealC, borderWidth: 2, borderDash: [4, 4], pointRadius: 0 },
  ] };
  const options = { responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${fmtN(it.parsed.y, 1)} ${b.unit}${it.parsed.y === 1 ? '' : 's'}` } } },
    scales: { x: { ticks: { color: ink }, grid: { display: false }, border: { color: grid } },
              y: { min: 0, suggestedMax: Math.max(3, Math.ceil(perDay) + 1), ticks: { color: ink, stepSize: 1 }, grid: { color: grid }, border: { color: grid } } } };
  chartBalance?.destroy(); chartBalance = new Chart($('chartBalance'), { type: 'bar', data, options });
}

function drawBalance(r, b) {
  const pt = (d, y) => ({ x: d.getTime(), y });
  const actual = [pt(r.semStart, b.start)];
  let bal = b.start, lastDate = null;
  if (b.trackFrom && b.trackFrom > r.semStart) { bal = b.priorBal; actual.push(pt(b.trackFrom, bal)); lastDate = toISO(b.trackFrom); }
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
  // Monte Carlo band (10th–90th percentile of simulated balance), when there's enough history
  const f = typeof forecastBucket === 'function' ? forecastBucket(b, r) : null;
  const bandSets = f ? [
    { label: 'Likely range (90th pct)', data: [pt(r.asOf, b.balance), ...f.band.map(x => pt(x.date, x.hi))], borderColor: 'transparent', backgroundColor: accent.replace(')', ', 0.16)').replace('rgb(', 'rgba(').replace(/^#([0-9a-f]{6})$/i, (m, h) => `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},0.16)`), fill: '+1', pointRadius: 0, pointHoverRadius: 0, tension: 0.3 },
    { label: 'Likely range (10th pct)', data: [pt(r.asOf, b.balance), ...f.band.map(x => pt(x.date, x.lo))], borderColor: 'transparent', backgroundColor: 'transparent', fill: false, pointRadius: 0, pointHoverRadius: 0, tension: 0.3 },
  ] : [];
  $('legendBand').hidden = !f;
  const data = { datasets: [
    ...bandSets,
    { label: 'Actual', data: actual, borderColor: accent, backgroundColor: accent, borderWidth: 2.5, pointRadius: actual.length > 30 ? 0 : 3, pointHoverRadius: 6 },
    { label: 'Projected', data: projected, borderColor: accent, backgroundColor: accent, borderWidth: 2, borderDash: [6, 5], pointRadius: [0, 4], pointHoverRadius: 6 },
    { label: 'Ideal pace', data: ideal, borderColor: idealC, backgroundColor: idealC, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5 },
  ] };
  const options = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    interaction: { mode: 'nearest', intersect: false },
    plugins: { legend: { display: false }, tooltip: { filter: it => !/pct/.test(it.dataset.label), callbacks: {
      title: items => fmtDate(new Date(items[0].parsed.x)),
      label: it => ` ${it.dataset.label}: ${fy(it.parsed.y)}`,
    } } },
    scales: {
      x: { type: 'linear', min: r.semStart.getTime(), max: r.semEnd.getTime(),
        ticks: { color: ink, maxTicksLimit: 6, callback: v => fmtDate(new Date(v)) }, grid: { color: grid }, border: { color: grid } },
      y: { min: 0, ticks: { color: ink, callback: v => b.kind === 'money' ? '$' + v : v }, grid: { color: grid }, border: { color: grid } },
    },
  };
  if (chartBalance && chartBalance.config.type === 'line') { chartBalance.data = data; chartBalance.options = options; chartBalance.update(); }
  else { chartBalance?.destroy(); chartBalance = new Chart($('chartBalance'), { type: 'line', data, options }); }
}

function drawPlaces(a) {
  const MAX = 7;
  const rows = a.places.slice(0, MAX);
  if (a.places.length > MAX) {
    const rest = a.places.slice(MAX);
    rows.push({ name: `Other (${rest.length})`, total: rest.reduce((s, p) => s + p.total, 0), count: rest.reduce((s, p) => s + p.count, 0) });
  }
  const accent = css('--accent'), grid = css('--grid'), ink = css('--text-2');
  const narrow = innerWidth < 480;
  const short = n => narrow && n.length > 18 ? n.slice(0, 17) + '…' : n;
  const data = { labels: rows.map(p => short(p.name)), datasets: [{
    data: rows.map(p => Math.round(p.total * 100) / 100), backgroundColor: accent,
    borderRadius: 4, borderSkipped: 'start', barThickness: 14, counts: rows.map(p => p.count),
  }] };
  const options = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    plugins: { legend: { display: false }, tooltip: { callbacks: {
      title: items => rows[items[0].dataIndex].name,
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
  if (!plan() && PLANS[state.school]) {
    const cat = PLANS[state.school].plans;
    state.planId = ({ pitt: 'block145', cmu: 'red' })[state.school] || cat.find(p => Object.values(p.buckets).some(v => typeof v === 'number' && v > 20))?.id || cat[0].id;
    const p = plan(); state.start = {};
    for (const [k, v] of Object.entries(p.buckets)) state.start[k] = typeof v === 'object' ? v.amount : v;
  } else if (!plan()) {
    // Custom school with no catalog: seed the first count bucket and the first money bucket.
    const bs = activeBuckets().filter(b => b.period !== 'unlimited');
    const c = bs.find(b => b.kind === 'count'), m = bs.find(b => b.kind === 'money');
    if (c && !(state.start[c.key] > 0)) state.start[c.key] = c.period === 'week' ? 14 : 120;
    if (m && !(state.start[m.key] > 0)) state.start[m.key] = 500;
  }
  if (parse(state.semStart) > today()) { alert(`${school().name}'s term hasn't started yet (${fmtDate(parse(state.semStart))}), so there's nothing to sample. Change the semester dates to try it.`); return; }
  state.txns = sampleTxns(parse(state.semStart), today());
  save(); fillPlans(); renderStartFields(); fillBuckets(); render();
});

function sampleTxns(from, to) {
  let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const locs = school().locations;
  const bs = activeBuckets().filter(b => b.period !== 'unlimited');
  const countB = bs.find(b => b.kind === 'count' && !b.passive);   // first real count bucket = the main one (blocks / meals)
  const moneyB = bs.find(b => b.kind === 'money');
  const menu = [['Coffee', 4.25], ['Breakfast sandwich', 6.75], ['Sushi roll', 9.5], ['Noodle soup', 12], ['Burger & fries', 13.25],
    ['Salad', 10.5], ['Smoothie', 7.5], ['Pizza slice', 4.5], ['Tacos', 9.75], ['Curry plate', 12.5], ['Iced latte', 5.5], ['Snacks', 6], ['Bowl', 11.5]];
  // All-you-care-to-eat spots take swipes; everything else takes money.
  let halls = locs.filter(l => /dining|commons|hall|eatery|perch|nourish|schatz|exchange|stack'd underground|hogan|rathbone|brodhead|atrium/i.test(l)).slice(0, 3);
  if (!halls.length) halls = locs.slice(0, 2);
  const cafes = locs.filter(l => !halls.includes(l));
  const favs = [cafes[0], cafes[3], cafes[5]].filter(Boolean);
  const out = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY)) {
    const meals = d.getDay() === 5 ? 3 : rnd() < 0.2 ? 1 : 2;
    for (let i = 0; i < meals; i++) {
      const useBlock = countB && (!moneyB || rnd() < 0.45);
      if (useBlock) {
        const hall = halls[Math.floor(rnd() * halls.length)];
        // each place has its own block value (what the block covered on the receipt)
        const worth = 10.5 + ((hall.charCodeAt(0) * 5) % 6) + Math.round(rnd() * 100) / 100;
        const parts = [{ bucket: countB.key, amount: 1, value: Math.round(worth * 100) / 100 }];
        // sometimes a block plus a little money for a drink / extra side
        if (moneyB && rnd() < 0.35) parts.push({ bucket: moneyB.key, amount: Math.round((2 + rnd() * 4) * 100) / 100 });
        out.push({ id: uid(), date: toISO(d), location: hall, item: ['Lunch', 'Dinner', 'Brunch'][Math.floor(rnd() * 3)] + (parts.length > 1 ? ' + drink' : ''), parts });
      } else if (moneyB) {
        const loc = rnd() < 0.55 ? favs[Math.floor(rnd() * favs.length)] : cafes[Math.floor(rnd() * cafes.length)];
        const [item, base] = menu[Math.floor(rnd() * menu.length)];
        out.push({ id: uid(), date: toISO(d), location: loc, item, parts: [{ bucket: moneyB.key, amount: Math.round((base * (0.85 + rnd() * 0.4)) * 100) / 100 }] });
      }
    }
  }
  return out;
}

// Purchases as a spreadsheet
$('btnCsv').addEventListener('click', () => {
  const defs = school().buckets;
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['date', 'place', 'item', 'paid_with', 'amount', 'block_value_usd', 'second_paid_with', 'second_amount']];
  for (const t of [...state.txns].sort((a, b) => a.date.localeCompare(b.date))) {
    const [p1, p2] = t.parts;
    rows.push([t.date, t.location, t.item, defs[p1?.bucket]?.label || p1?.bucket, p1?.amount, p1?.value ?? '', p2 ? (defs[p2.bucket]?.label || p2.bucket) : '', p2?.amount ?? '']);
  }
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `purchases-${toISO(today())}.csv` });
  a.click(); URL.revokeObjectURL(a.href);
});

$('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `meal-plan-backup-${toISO(today())}.json` });
  a.click(); URL.revokeObjectURL(a.href);
});
$('btnImport').addEventListener('click', () => $('fileImport').click());
$('fileImport').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  const owner = window.trackerAccount?.generation;
  try {
    const s = JSON.parse(await f.text());
    if (owner !== window.trackerAccount?.generation) return;
    if (!Array.isArray(s.txns)) throw new Error('bad file');
    s.txns = s.txns.map(normalizeTx);
    replaceTrackerState(s); save();
  } catch { alert("That file doesn't look like a tracker export."); }
  e.target.value = '';
});

// ---------- theme ----------
const THEME_STORE = 'ddt.theme';
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  for (const b of document.querySelectorAll('[data-theme-pick]')) b.setAttribute('aria-checked', b.dataset.themePick === (t || 'auto'));
  try { t && t !== 'auto' ? localStorage.setItem(THEME_STORE, t) : localStorage.removeItem(THEME_STORE); } catch {}
}
for (const b of document.querySelectorAll('[data-theme-pick]')) b.addEventListener('click', () => { applyTheme(b.dataset.themePick); applySchoolTheme(); render(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applySchoolTheme(); });
try { applyTheme(localStorage.getItem(THEME_STORE) || 'auto'); } catch { applyTheme('auto'); }

// ---------- home dashboard (Today / Balances / Semester) ----------
const DASH_STORE = 'ddt.dash';
let dashPane = 'today';
try { dashPane = localStorage.getItem(DASH_STORE) || 'today'; } catch {}
function showDash(name, remember = true) {
  const panes = [...document.querySelectorAll('#dashCard .dash-pane')];
  const available = panes.filter(p => !p.dataset.unavailable).map(p => p.dataset.pane);
  if (!available.includes(name)) name = available[0] || 'chart';
  dashPane = name;
  for (const p of panes) p.hidden = p.dataset.pane !== name;
  for (const b of document.querySelectorAll('[data-dash]')) { b.setAttribute('aria-checked', b.dataset.dash === name); b.hidden = !available.includes(b.dataset.dash); }
  if (remember) try { localStorage.setItem(DASH_STORE, name); } catch {}
  requestAnimationFrame(() => chartBalance?.resize());
}
for (const b of document.querySelectorAll('[data-dash]')) b.addEventListener('click', () => showDash(b.dataset.dash));
// Which panes make sense right now: Today only in log mode, Balances/Chart when there's a projection.
function syncDash(r) {
  const today = $('todayCard'), bal = $('summaryCard'), chart = $('chartCard');
  today.dataset.unavailable = (!r || r.quick || state.mode !== 'log') ? '1' : '';
  bal.dataset.unavailable = !r ? '1' : '';
  chart.dataset.unavailable = '';
  if (!today.dataset.unavailable) delete today.dataset.unavailable;
  if (!bal.dataset.unavailable) delete bal.dataset.unavailable;
  delete chart.dataset.unavailable;
  $('dashCard').hidden = false;
  const weeklyOnly = r && !r.buckets.some(b => b.period === 'semester' && !b.noData && !b.passive) && r.buckets.some(b => b.period === 'week' && !b.noData);
  document.querySelector('[data-dash="chart"]').textContent = weeklyOnly ? 'This week' : 'Semester';
  showDash(dashPane, false);
}
function renderContext() {
  const p = plan();
  $('contextLine').innerHTML = `<b>${esc(school().name)}</b>${p ? ` · ${esc(p.name)}` : ''} · ${esc(state.mode === 'log' ? 'tracking purchases' : 'quick estimate')} — <button type="button" class="link" data-goto="setup">change in ⚙︎ Settings</button>`;
}

// ---------- log stack (Where it goes / Purchases / Block value) ----------
const LSTACK_STORE = 'ddt.lstack';
let logPane = 'where';
try { logPane = localStorage.getItem(LSTACK_STORE) || 'where'; } catch {}
function showLogPane(name, remember = true) {
  const panes = [...document.querySelectorAll('#logStack .dash-pane')];
  const available = panes.filter(p => !p.dataset.unavailable).map(p => p.dataset.pane);
  if (!available.includes(name)) name = available[0];
  logPane = name;
  for (const p of panes) p.hidden = p.dataset.pane !== name;
  for (const b of document.querySelectorAll('[data-lpane]')) { b.setAttribute('aria-checked', b.dataset.lpane === name); b.hidden = !available.includes(b.dataset.lpane); }
  if (remember) try { localStorage.setItem(LSTACK_STORE, name); } catch {}
  requestAnimationFrame(() => chartPlaces?.resize());
}
for (const b of document.querySelectorAll('[data-lpane]')) b.addEventListener('click', () => showLogPane(b.dataset.lpane));
// availability flags are set during render(); this applies them
function syncLogStack() {
  const panes = [...document.querySelectorAll('#logStack .dash-pane')];
  const any = panes.some(p => !p.dataset.unavailable);
  $('logStack').hidden = !any;
  $('insightsEmpty').hidden = any;
  if (any) showLogPane(logPane, false);
}
const setAvail = (id, ok) => { const el = $(id); if (ok) delete el.dataset.unavailable; else el.dataset.unavailable = '1'; };

// ---------- section tabs ----------
const TAB_STORE = 'ddt.tab';
function showTab(name, push = true) {
  if (!document.querySelector(`.tab[data-tab="${name}"]`)) name = 'home';
  for (const t of document.querySelectorAll('.tab')) t.hidden = t.dataset.tab !== name;
  for (const b of document.querySelectorAll('.tabs-nav button')) b.setAttribute('aria-selected', b.dataset.tab === name);
  $('btnShareFab').hidden = name !== 'insights';
  try { localStorage.setItem(TAB_STORE, name); } catch {}
  // charts drawn while hidden have no size; nudge them once visible
  requestAnimationFrame(() => { chartBalance?.resize(); chartPlaces?.resize(); });
  if (push) window.scrollTo({ top: 0 });
}
for (const b of document.querySelectorAll('.tabs-nav button')) b.addEventListener('click', () => showTab(b.dataset.tab));
$('btnSettings').addEventListener('click', () => showTab('setup'));
document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) showTab(g.dataset.goto); });

// ---------- PWA ----------
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------- go ----------
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
$('footer').innerHTML = `Guest data stays on this device; sign in to sync. Plans for ${Object.keys(PLANS).length} schools from their official dining pages.`;
$('customSchool').hidden = state.school !== OTHER_SCHOOL;
if (state.school === OTHER_SCHOOL) renderCustomEditor();
applySchoolTheme();
fillPlans();
loadLocations();
fillBuckets();
setMode(state.mode);
// ?demo loads the CMU sample data (for judges / screenshots); ?tab=home|insights|eat|advisor|setup opens a tab;
// ?dash=today|balances|chart and ?pane=where|purchases|blocks pick the stacked panels.
const qs = new URLSearchParams(location.search);
if (qs.has('demo') && !state.txns.length) {
  state.school = 'cmu'; state.planId = 'red'; state.start = { blocks: 205, flex: 880 };
  state.txns = sampleTxns(parse(termFor(SCHOOLS.cmu).start), today());
  state.semStart = termFor(SCHOOLS.cmu).start; state.semEnd = termFor(SCHOOLS.cmu).end;
  try { localStorage.setItem('ddt.tour', 'done'); } catch {}
  save(); $('schoolSearch').value = schoolLabel('cmu'); refreshSchool();
}
if (qs.get('dash')) { dashPane = qs.get('dash'); }
if (qs.get('pane')) { logPane = qs.get('pane'); }
// First visit with nothing set up → start on Setup; otherwise the last tab used.
const hasSetup = Object.values(state.start || {}).some(v => v > 0) || state.txns.length;
showTab(qs.get('tab') || (hasSetup ? (localStorage.getItem(TAB_STORE) || 'home') : 'setup'), false);
if (qs.get('dash')) showDash(qs.get('dash'), false);
if (qs.get('pane')) showLogPane(qs.get('pane'), false);
