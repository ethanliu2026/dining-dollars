// "Today" card: turn safe pace into a concrete plan for the rest of today.
// Loaded after app.js; uses its globals (state, compute, school, blockValueTable, $, esc, fmt$, …).

// Meal periods (CMU's, which are typical): [startHour, endHour) in local time.
const PERIODS = [
  { key: 'breakfast', label: 'Breakfast', from: 3.5, to: 10.5 },
  { key: 'lunch', label: 'Lunch', from: 10.5, to: 16.5 },
  { key: 'dinner', label: 'Dinner', from: 16.5, to: 21 },
  { key: 'late', label: 'Late night', from: 21, to: 27.5 },   // runs past midnight
];
// how many blocks a period can reasonably take (school rules: CMU max 2 per period)
const PER_PERIOD = { breakfast: 1, lunch: 2, dinner: 2, late: 1 };

function periodsLeft(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  const hh = h < 3.5 ? h + 24 : h;   // 1 AM counts as tonight's late night
  return PERIODS.filter(p => hh < p.to);
}

// Today's purchases per bucket
function usedToday() {
  const iso = toISO(today()), out = {};
  for (const t of state.txns) if (t.date === iso) for (const pt of t.parts) out[pt.bucket] = (out[pt.bucket] || 0) + pt.amount;
  return out;
}

function todayPlan(r) {
  const used = usedToday();
  const left = periodsLeft();
  const countBs = r.buckets.filter(b => b.kind === 'count' && !b.noData && !b.passive && b.period !== 'unlimited');
  const moneyBs = r.buckets.filter(b => b.kind === 'money' && !b.noData);
  const items = [];

  // ---- blocks / swipes ----
  for (const b of countBs) {
    let perDay;
    if (b.period === 'week') perDay = b.balance / Math.max(1, b.daysLeftWk);
    else if (r.daysLeft === 0) perDay = b.balance;
    else perDay = b.safe;
    // spare → round up (use them!), short → round down, else nearest
    let n = b.status === 'warn' ? Math.ceil(perDay - 0.15) : b.status === 'bad' ? Math.floor(perDay + 0.1) : Math.round(perDay);
    n = Math.max(0, Math.min(n, b.maxPerDay || 4, Math.floor(b.balance)));
    const usedN = used[b.key] || 0;
    const remaining = Math.max(0, n - usedN);
    items.push({ b, perDay, n, usedN, remaining });
  }
  // ---- money ----
  for (const b of moneyBs) {
    let perDay = b.period === 'week' ? b.balance / Math.max(1, b.daysLeftWk) : r.daysLeft === 0 ? b.balance : b.safe;
    if (b.status === 'warn') perDay *= 1.15;   // spare: nudge up a little
    const usedM = used[b.key] || 0;
    items.push({ b, perDay, n: perDay, usedN: usedM, remaining: Math.max(0, perDay - usedM) });
  }

  // ---- assign blocks to remaining periods: dinner, lunch, breakfast, late ----
  const order = ['dinner', 'lunch', 'breakfast', 'late'];
  const slots = Object.fromEntries(left.map(p => [p.key, { period: p, blocks: 0, money: 0 }]));
  const countItem = items.find(i => i.b.kind === 'count');
  let toPlace = countItem ? countItem.remaining : 0;
  while (toPlace > 0) {
    let placed = false;
    for (const k of order) { if (slots[k] && slots[k].blocks < PER_PERIOD[k] && toPlace > 0) { slots[k].blocks++; toPlace--; placed = true; } }
    if (!placed) break;
  }
  // money: spread over remaining periods, weighted to periods without a block
  const moneyItem = items.find(i => i.b.kind === 'money');
  if (moneyItem && left.length) {
    const noBlock = left.filter(p => !slots[p.key].blocks);
    const share = moneyItem.remaining;
    if (noBlock.length) noBlock.forEach(p => slots[p.key].money = share / noBlock.length);
    else left.forEach(p => slots[p.key].money = share / left.length);
  }
  return { items, left, slots, used };
}

function renderToday() {
  const card = $('todayCard');
  const r = (typeof compute === 'function') ? compute() : null;
  if (!r || r.quick || state.mode !== 'log') { card.hidden = true; return; }
  const plan = todayPlan(r);
  const { items, left, slots } = plan;
  if (!items.length) { card.hidden = true; return; }
  card.hidden = false;

  const hall = school().hallMealCost;
  const bv = blockValueTable();
  const bestPlace = bv[0];
  const countItem = items.find(i => i.b.kind === 'count');
  const moneyItems = items.filter(i => i.b.kind === 'money');

  // headline: what's left to use today
  const bits = [];
  if (countItem) bits.push(countItem.remaining === 0 && countItem.usedN
    ? `<b>no more ${countItem.b.unit}s</b> <span class="muted">(${plural(countItem.usedN, countItem.b.unit)} used — that's today's share)</span>`
    : `<b>${plural(countItem.remaining, countItem.b.unit)}</b>${countItem.usedN ? ` <span class="muted">(${plural(countItem.usedN, countItem.b.unit)} used)</span>` : ''}`);
  for (const m of moneyItems) bits.push(m.remaining < 0.5 && m.usedN
    ? `<b>no more ${esc(m.b.label)}</b> <span class="muted">(${fmt$(m.usedN)} spent — that's today's share)</span>`
    : `<b>${fmt$(m.remaining)}</b> ${esc(m.b.label)}${m.usedN ? ` <span class="muted">(${fmt$(m.usedN)} spent)</span>` : ''}`);
  const done = left.length === 0;
  $('todayHead').innerHTML = done ? 'Today\'s meal periods are over — tomorrow you get a fresh budget.' : `Left for today: ${bits.join(' and ')}`;

  // per-period plan
  const rows = left.map(p => {
    const s = slots[p.key];
    const parts = [];
    if (s.blocks) parts.push(`<b>${s.blocks === 1 ? `1 ${countItem.b.unit}` : `${s.blocks} ${countItem.b.unit}s`}</b>${bestPlace && s.blocks ? ` — best value at ${esc(bestPlace.location)} (${fmt$(bestPlace.value)})` : ''}`);
    if (s.money >= 1) parts.push(`up to <b>${fmt$(s.money)}</b>${s.blocks ? ' for a drink or extra' : hall ? ` (≈ ${Math.max(1, Math.floor(s.money / hall))} dining-commons meal${Math.floor(s.money / hall) > 1 ? 's' : ''})` : ' from ' + esc(moneyItems[0]?.b.label || 'dollars')}`);
    if (!parts.length) parts.push('<span class="muted">skip or pay cash</span>');
    return `<tr><td>${p.label}</td><td>${parts.join(' · ')}</td></tr>`;
  });
  $('todayBody').innerHTML = done ? '' : `<table class="today-table"><tbody>${rows.join('')}</tbody></table>`;

  // why line
  const why = [];
  if (countItem) {
    const b = countItem.b;
    const pace = b.period === 'week' ? `${plural(b.balance, b.unit)} left this week` : `${fmtN(countItem.perDay, 1)}/day keeps you on pace`;
    why.push(b.status === 'warn' ? `You have spare ${b.unit}s — use ${countItem.n} today (${pace}).` : b.status === 'bad' ? `${b.label} are running short — hold to ${countItem.n} today (${pace}).` : `${countItem.n} ${b.unit}${countItem.n === 1 ? '' : 's'} today (${pace}).`);
  }
  for (const m of moneyItems) {
    why.push(m.b.status === 'warn' ? `${m.b.label}: you're under pace, so ${fmt$(m.perDay)} today is fine (a bit above the ${fmt$(m.b.safe)} safe rate).` : m.b.status === 'bad' ? `${m.b.label}: running low — ${fmt$(m.perDay)} today or less.` : `${m.b.label}: ${fmt$(m.perDay)}/day keeps you on pace.`);
  }
  $('todayWhy').textContent = why.join(' ');
}

const _renderT = render;
render = function () { _renderT(); try { renderToday(); } catch (e) { console.error(e); } };
renderToday();
