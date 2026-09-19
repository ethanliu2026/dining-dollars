// Plan advisor: which meal plan fits you best next semester?
// Two inputs: (a) your tracked usage, projected over a full semester, or (b) a few answers
// from a new student. Both become "needs per semester" and are scored against every plan
// you're eligible for. Loaded after app.js; uses its globals.

const GROUPS = [
  { id: 'firstYear', label: 'First-year', hint: 'living in a residence hall' },
  { id: 'resident',  label: 'Returning resident', hint: 'residence hall, 2nd year+' },
  { id: 'apartment', label: 'On-campus apartment', hint: 'suite / apartment with a kitchen' },
  { id: 'commuter',  label: 'Off-campus / grad', hint: 'commuter, grad, or opted out' },
];
const RETAIL_MEAL = 14;   // what a dining-hall meal costs if you have to pay out of pocket

const advisorState = () => (state.advisor ||= { mode: 'usage', group: 'firstYear', mealsWk: 12, moneyWk: 40 });

// ---------- needs ----------
// Weeks you'll actually be eating on campus this semester.
function semesterWeeks() {
  const breaks = breaksFor();
  const days = countEatDays(parse(state.semStart), parse(state.semEnd), breaks);
  return days / (state.eat.weekends ? 7 : 5);
}
// Needs per semester: { meals, money, moneyByKey } — meals are dining-hall swipes/blocks.
function needsFromAnswers(mealsWk, moneyWk) {
  const w = semesterWeeks();
  return { meals: mealsWk * w, money: moneyWk * w, weeks: w, source: 'answers' };
}
function needsFromUsage() {
  const r = compute();
  if (!r || r.quick && !r.buckets.some(b => !b.noData)) return null;
  const eatDaysTotal = countEatDays(parse(state.semStart), parse(state.semEnd), breaksFor());
  const eatDaysSoFar = Math.max(1, r.elapsed);
  if (eatDaysSoFar < 7) return null;   // too early to extrapolate
  let meals = 0, money = 0;
  for (const b of r.buckets) {
    if (b.noData || b.passive || b.period === 'unlimited') continue;
    if (b.period === 'week') { meals += (b.used / Math.max(1, 7 - ((r.asOf.getDay() + 6) % 7))) * eatDaysTotal; continue; }   // rough: this week's rate
    const perDay = b.spent / eatDaysSoFar;
    if (b.kind === 'count') meals += perDay * eatDaysTotal; else money += perDay * eatDaysTotal;
  }
  return { meals, money, weeks: semesterWeeks(), source: 'usage', daysSoFar: eatDaysSoFar, eatDaysTotal };
}

// ---------- scoring ----------
function planAllotment(p, weeks) {
  const defs = school().buckets;
  let meals = 0, money = 0, unlimited = false;
  for (const [k, v] of Object.entries(p.buckets)) {
    const d = defs[k]; if (!d || d.passive) continue;
    const amt = typeof v === 'object' ? v.amount : v, period = typeof v === 'object' ? v.period : d.period;
    if (period === 'unlimited') { unlimited = true; continue; }
    const perSem = period === 'week' ? amt * weeks : amt;
    if (d.kind === 'count') meals += perSem; else money += perSem;
  }
  return { meals, money, unlimited };
}
function scorePlan(p, need) {
  const a = planAllotment(p, need.weeks);
  const hallCost = school().hallMealCost;   // money-only schools: meals come out of the money bucket
  const needMeals = hallCost ? 0 : need.meals;
  const needMoney = need.money + (hallCost ? need.meals * hallCost : 0);
  const unit = !a.unlimited && a.meals > 0 ? Math.max(0, (p.cost - a.money) / a.meals) : 0;   // what a swipe costs on this plan
  const mealsShort = a.unlimited ? 0 : Math.max(0, needMeals - a.meals);
  const mealsSpare = a.unlimited ? 0 : Math.max(0, a.meals - needMeals);
  const moneyShort = Math.max(0, needMoney - a.money);
  const moneySpare = Math.max(0, a.money - needMoney);
  const outOfPocket = mealsShort * RETAIL_MEAL + moneyShort;
  const waste = mealsSpare * unit + moneySpare;
  return { plan: p, a, unit, mealsShort, mealsSpare, moneyShort, moneySpare, outOfPocket, waste,
           trueCost: p.cost + outOfPocket, fits: mealsShort === 0 && moneyShort === 0 };
}
const NO_PLAN = { id: '__none', name: 'No meal plan', cost: 0, buckets: {}, note: 'pay as you go' };
function rankPlans(need, group) {
  const cat = PLANS[state.school];
  if (!cat) return [];
  const plans = cat.plans.filter(p => !p.eligible || p.eligible.includes(group));
  if (group === 'apartment' || group === 'commuter') plans.push(NO_PLAN);   // opting out is allowed
  return plans
    .map(p => scorePlan(p, need))
    .sort((x, y) => (x.trueCost - y.trueCost) || (x.waste - y.waste));
}

// ---------- UI ----------
function renderAdvisor() {
  const st = advisorState();
  const card = $('advisorCard');
  const cat = PLANS[state.school];
  if (!cat) { card.hidden = true; return; }
  card.hidden = false;

  const usage = needsFromUsage();
  const p = plan();
  // group default: infer from the current plan if it's only for one group
  if (!st.groupTouched && p?.eligible?.length === 1) st.group = p.eligible[0];
  for (const b of card.querySelectorAll('[data-amode]')) b.setAttribute('aria-checked', b.dataset.amode === st.mode);
  $('advUsageNote').hidden = st.mode !== 'usage';
  $('advAnswers').hidden = st.mode !== 'answers';
  $('advGroup').value = st.group;
  $('advMealsWk').value = st.mealsWk; $('advMealsWkOut').textContent = st.mealsWk;
  $('advMoneyWk').value = st.moneyWk; $('advMoneyWkOut').textContent = '$' + st.moneyWk;
  $('advEligNote').textContent = cat.eligibility || '';

  let need;
  if (st.mode === 'usage') {
    if (!usage) {
      $('advUsageNote').innerHTML = state.mode === 'log' && state.txns.length
        ? 'Log about a week of purchases and this will project your whole semester.'
        : 'Track purchases (or fill in Quick estimate) and this will project your whole semester from real usage. Or answer two questions instead →';
      $('advResults').innerHTML = ''; return;
    }
    need = usage;
    const hall = school().hallMealCost;
    $('advUsageNote').innerHTML = `Based on ${usage.daysSoFar} eating days so far, projected over ${usage.eatDaysTotal} this semester: about <b>${hall ? fmt$(usage.money) : `${fmtN(usage.meals, 0)} swipes + ${fmt$(usage.money)}`}</b>.`;
  } else {
    need = needsFromAnswers(st.mealsWk, st.moneyWk);
  }

  const ranked = rankPlans(need, st.group);
  if (!ranked.length) { $('advResults').innerHTML = `<p class="hint">No plans in the catalog for that group.</p>`; return; }
  const best = ranked[0], cur = ranked.find(r => r.plan.id === state.planId);
  const tied = ranked.filter(r => r.trueCost - best.trueCost < Math.max(25, best.trueCost * 0.01));
  const safest = ranked.find(r => r.fits && r.plan !== NO_PLAN);   // cheapest plan with nothing out of pocket
  const hall = school().hallMealCost;
  const fitText = r => {
    if (r.a.unlimited && r.moneyShort === 0) return 'fits (unlimited)';
    const bits = [];
    if (r.mealsShort) bits.push(`${fmtN(r.mealsShort, 0)} swipes short`);
    if (r.moneyShort) bits.push(`${fmt$(r.moneyShort)} short`);
    if (bits.length) return bits.join(', ');
    const spare = [];
    if (r.mealsSpare > 2) spare.push(`${fmtN(r.mealsSpare, 0)} swipes spare`);
    if (r.moneySpare > 10) spare.push(`${fmt$(r.moneySpare)} spare`);
    return spare.length ? 'fits · ' + spare.join(', ') : 'fits';
  };

  let head;
  if (tied.length > 1 && !(cur && tied.includes(cur))) {
    head = `<b>${tied.map(r => esc(r.plan.name)).join(', ')}</b> all cost about the same overall (~${fmt$(best.trueCost)}) for how you eat. Pick the cheapest up front (${esc(best.plan.name)}) and top up as you go, or the biggest for fewer surprises.`;
  } else if (cur && (cur.plan.id === best.plan.id || tied.includes(cur))) head = `<b>Stay on ${esc(cur.plan.name)}.</b> ${cur.plan.id === best.plan.id ? "It's the best fit for how you eat." : 'Switching would save less than ' + fmt$(Math.max(25, best.trueCost * 0.01)) + '.'}`;
  else if (cur) {
    const delta = cur.trueCost - best.trueCost;
    const verb = best.plan === NO_PLAN ? '<b>Drop the meal plan</b>' : `<b>Switch to ${esc(best.plan.name)}</b>`;
    head = `${verb} next semester — about <b>${fmt$(Math.abs(delta))}</b> ${delta > 0 ? 'cheaper' : 'more'} than ${esc(cur.plan.name)} once ${cur.outOfPocket ? 'out-of-pocket meals are' : 'waste is'} counted.`;
  } else if (best.plan === NO_PLAN) head = `<b>Skip the meal plan.</b> Paying as you go (~${fmt$(best.trueCost)}/semester) beats every plan you're eligible for.`;
  else head = `<b>${esc(best.plan.name)}</b> is the best value — ${fmt$(best.plan.cost)}/semester, ${fitText(best)}.`;
  let why = best.plan === NO_PLAN
    ? `Dining-hall meals at ~${fmt$(RETAIL_MEAL)} each plus your retail spending. Worth it only if you don't mind paying at the register.`
    : best.outOfPocket
    ? `You'd pay ~${fmt$(best.outOfPocket)} out of pocket over the semester, but that's still cheaper than buying a bigger plan.`
    : best.waste > 50 ? `You'd leave ~${fmt$(best.waste)} of value unused — the least of any plan that covers you.` : 'Covers you with little left over.';
  if (best.outOfPocket && safest && safest.plan.id !== best.plan.id) why += ` Prefer nothing out of pocket? <b>${esc(safest.plan.name)}</b> (${fmt$(safest.plan.cost)}) covers everything, ~${fmt$(safest.trueCost - best.trueCost)} more overall.`;

  $('advResults').innerHTML = `
    <div class="adv-best">${head}<div class="hint">${why}</div></div>
    <div class="table-x"><table class="adv-table">
      <thead><tr><th>Plan</th><th class="num">Cost</th><th>Includes</th><th>Fit</th><th class="num" title="Plan cost plus what you'd pay out of pocket">True cost</th></tr></thead>
      <tbody>${ranked.map(r => `<tr class="${r.plan.id === best.plan.id ? 'best' : ''} ${r.plan.id === state.planId ? 'current' : ''}">
        <td>${esc(r.plan.name)}${r.plan.id === state.planId ? ' <span class="pill">current</span>' : ''}${r.plan.id === best.plan.id ? ' <span class="pill best">best</span>' : ''}</td>
        <td class="num">${fmt$(r.plan.cost)}</td>
        <td class="muted">${r.plan === NO_PLAN ? 'pay at the register' : `${r.a.unlimited ? 'unlimited swipes' : r.a.meals ? `${fmtN(r.a.meals, 0)} swipes` : ''}${r.a.money ? `${r.a.meals || r.a.unlimited ? ' + ' : ''}${fmt$(r.a.money)}` : ''}${r.unit ? ` <small>(${fmt$(r.unit)}/swipe)</small>` : ''}`}</td>
        <td class="${r.fits ? 'good' : 'warn'}">${r.plan === NO_PLAN ? `${fmt$(r.outOfPocket)} out of pocket` : fitText(r)}</td>
        <td class="num">${fmt$(r.trueCost)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="hint">"True cost" = plan price + out-of-pocket for anything the plan doesn't cover (dining-hall meals at ~${fmt$(RETAIL_MEAL)}). Unused swipes/dollars are shown as spare — that's money you paid for but won't use.${hall ? ' Dining-hall meals here come out of Dining Dollars, counted at ' + fmt$(hall) + ' each.' : ''}</p>`;
}

for (const b of document.querySelectorAll('#advisorCard [data-amode]')) b.addEventListener('click', () => { advisorState().mode = b.dataset.amode; save(); renderAdvisor(); });
$('advGroup').addEventListener('change', e => { const st = advisorState(); st.group = e.target.value; st.groupTouched = true; save(); renderAdvisor(); });
$('advMealsWk').addEventListener('input', e => { advisorState().mealsWk = +e.target.value; save(); renderAdvisor(); });
$('advMoneyWk').addEventListener('input', e => { advisorState().moneyWk = +e.target.value; save(); renderAdvisor(); });
for (const g of GROUPS) $('advGroup').add(new Option(`${g.label} — ${g.hint}`, g.id));

// Re-render whenever the main app renders.
const _render = render;
render = function () { _render(); try { renderAdvisor(); } catch (e) { console.error(e); } };
renderAdvisor();
