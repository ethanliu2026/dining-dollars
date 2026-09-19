// "Where to eat?" decider + tips. Loaded after app.js; uses its globals.
//
// The decider scores every place on: open right now (when the school has live hours),
// how you're paying (blocks vs dollars), where a block buys the most, variety (places
// you haven't been in a while), ratings and today's specials, plus a little randomness
// so "Not feeling it" gives a different answer.

let LIVE = null;         // [{ name, area, blurb, times, rating, ratings, specials, menu }] for schools with a live API
let liveFor = null;      // school id LIVE belongs to
let lastPicks = [];      // ids shown last time, so "next" rotates
const eatState = () => (state.eatPick ||= { pay: 'auto', openOnly: true });

async function loadLive() {
  const sch = school();
  if (!sch.fetchLive) { LIVE = null; liveFor = state.school; return; }
  if (liveFor === state.school && LIVE) return;
  try { LIVE = await sch.fetchLive(); liveFor = state.school; }
  catch (e) { console.warn('live dining data unavailable', e); LIVE = null; liveFor = state.school; }
}

function liveFor_(name) { return LIVE?.find(l => l.name.toLowerCase() === name.toLowerCase()) || null; }
function openNow(l, now = Date.now()) {
  if (!l?.times?.length) return null;   // unknown
  const w = l.times.find(([s, e]) => now >= s && now <= e);
  return w ? { until: new Date(w[1]) } : false;
}
function nextOpen(l, now = Date.now()) {
  const w = (l?.times || []).filter(([s]) => s > now).sort((a, b) => a[0] - b[0])[0];
  return w ? new Date(w[0]) : null;
}
const fmtTime = d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function daysSinceVisit(name) {
  const last = state.txns.filter(t => t.location === name).map(t => t.date).sort().at(-1);
  return last ? daysBetween(parse(last), today()) : null;
}
// Places where blocks are known to work: user has paid with blocks there, or a value is set.
function takesBlocks(name) {
  const defs = school().buckets;
  return !!state.blockValues?.[name] || state.txns.some(t => t.location === name && t.parts.some(pt => defs[pt.bucket]?.kind === 'count'));
}

function decide() {
  const st = eatState();
  const r = compute();
  const locs = [...$('txLocation').options].map(o => o.value).filter(v => v && v !== OTHER);
  const defs = school().buckets;
  const countB = r?.buckets.find(b => b.kind === 'count' && !b.passive && !b.noData && b.period !== 'unlimited');
  const moneyB = r?.buckets.find(b => b.kind === 'money' && !b.noData);
  // auto pay-with: spare blocks → blocks; dollars running out → blocks; else either
  let pay = st.pay;
  if (pay === 'auto') pay = countB && (countB.status === 'warn' || moneyB?.status === 'bad') ? 'blocks' : (countB?.status === 'bad' && moneyB) ? 'money' : 'either';
  const uv = r ? unitValue(r) : null;
  const anyBlockKnown = locs.some(takesBlocks);

  const scored = locs.map(name => {
    const l = liveFor_(name);
    const open = openNow(l);
    const why = [], flags = [];
    let score = 0;
    if (open === false) { if (st.openOnly && LIVE) return null; score -= 5; flags.push(`closed${nextOpen(l) ? ` · opens ${fmtTime(nextOpen(l))}` : ''}`); }
    if (open) why.push(`Open until ${fmtTime(open.until)}`);
    else if (open === null && LIVE) flags.push('hours not listed — check before you go');
    const bv = blockValueAt(name);
    const blocksOk = takesBlocks(name);
    if (pay === 'blocks') {
      // Known block places first; others still allowed (most spots sell a block meal), just flagged.
      if (bv) { const ratio = bv.value / (uv?.value || bv.value); score += (ratio - 1) * 6 + 2; why.push(`A block buys ${fmt$(bv.value)} here${ratio >= 1.05 ? ' — great value' : ratio < 0.85 ? ' — a bit low' : ''}`); }
      else if (blocksOk) { score += 1.5; why.push('Takes blocks'); }
      else if (anyBlockKnown) { score -= 1; flags.push('check that they offer a block meal'); }
    } else if (pay === 'money' && bv && uv && bv.value < uv.value - 1) { score += 1; why.push(`Better paid with ${moneyB?.label || 'dollars'} here (block only covers ${fmt$(bv.value)})`); }
    else if (pay === 'either' && bv && uv) { const ratio = bv.value / uv.value; if (ratio >= 1.05) { score += 2; why.push(`Use a block: it buys ${fmt$(bv.value)} here`); } else if (ratio < 0.85 && moneyB) why.push(`Pay ${moneyB.label} here; a block only covers ${fmt$(bv.value)}`); }
    const since = daysSinceVisit(name);
    if (since === null) { score += 1.5; why.push("Somewhere you haven't logged yet"); }
    else if (since >= 7) { score += 1; why.push(`Haven't been in ${since} days`); }
    else if (since <= 1) score -= 2;
    if (l?.rating && l.ratings >= 5) { score += (l.rating - 3) * 0.8; if (l.rating >= 4) why.push(`Rated ${l.rating.toFixed(1)} ★ by ${l.ratings} students`); }
    if (l?.specials?.length) { score += 1; why.push(`Today: ${l.specials.slice(0, 2).join(', ')}`); }
    score += Math.random() * 2;   // a little serendipity
    return { name, score, why, flags, l, bv };
  }).filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  // "Not feeling it": never repeat the last top pick; avoid the last three when the pool allows
  const lastTop = lastPicks[0];
  let pool = scored.filter(p => !lastPicks.includes(p.name));
  if (pool.length < 3) pool = scored.filter(p => p.name !== lastTop);
  if (!pool.length) pool = scored;
  const picks = pool.slice(0, 3);
  lastPicks = picks.map(p => p.name);
  return { picks, pay, openKnown: !!LIVE, total: scored.length };
}

function renderPick(result) {
  const box = $('eatResult');
  const { picks, pay, openKnown, total } = result || decide();
  const defs = school().buckets;
  const countB = Object.values(defs).find(d => d.kind === 'count' && !d.passive);
  if (!picks.length) {
    box.innerHTML = `<div class="empty">${openKnown && eatState().openOnly ? 'Nothing that fits is open right now — turn off "Open now" or try later.' : 'No places to choose from — pick your school in Setup.'}</div>`;
    return;
  }
  const [top, ...alts] = picks;
  const tipsHere = (window.TIPS?.[state.school] || []).filter(t => t.place && t.place.toLowerCase() === top.name.toLowerCase());
  box.innerHTML = `
    <div class="pick">
      <div class="pick-label">Go eat at</div>
      <div class="pick-name">${esc(top.name)}</div>
      ${top.l?.area ? `<div class="pick-area">${esc(top.l.area)}${top.l.blurb ? ` · ${esc(top.l.blurb)}` : ''}</div>` : ''}
      <ul class="pick-why">${top.why.map(w => `<li>${esc(w)}</li>`).join('')}${top.flags.map(f => `<li class="flag">${esc(f)}</li>`).join('')}${tipsHere.map(t => `<li class="tip">💡 ${esc(t.tip)}</li>`).join('')}</ul>
      <div class="pick-actions">
        <button type="button" class="primary" id="eatAgain" style="width:auto;margin:0">Not feeling it</button>
        <button type="button" id="eatLog">I'm going — log it</button>
        ${top.l?.menu ? `<a class="link" href="${esc(top.l.menu)}" target="_blank" rel="noopener">Menu ↗</a>` : ''}
      </div>
    </div>
    ${alts.length ? `<div class="alts">Also good: ${alts.map(a => `<button type="button" class="link alt" data-alt="${esc(a.name)}">${esc(a.name)}</button>`).join(' · ')}</div>` : ''}
    <p class="hint">Paying with ${pay === 'blocks' ? (countB?.label || 'blocks') : pay === 'money' ? 'dollars' : 'whatever fits'}${pay !== eatState().pay && eatState().pay === 'auto' ? ' (auto — based on your balances)' : ''}. ${openKnown ? 'Hours, ratings and specials are live.' : 'No live hours for this school, so "open now" is skipped.'} ${total} place${total === 1 ? '' : 's'} considered${total <= 3 && openKnown && eatState().openOnly ? ' — few are open right now; untick "Open right now" for more' : ''}.</p>`;
  $('eatAgain').addEventListener('click', () => renderPick());
  $('eatLog').addEventListener('click', () => {
    const sel = $('txLocation');
    if ([...sel.options].some(o => o.value === top.name)) sel.value = top.name; else { sel.value = OTHER; $('txLocationOther').hidden = false; $('txLocationOther').value = top.name; }
    if (pay === 'blocks' && countB) { $('txBucket').value = Object.keys(defs).find(k => defs[k] === countB); updateAmountField(); if (top.bv) $('txWorth').value = top.bv.value.toFixed(2); }
    showTab('home'); $('logCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // promote an alternative to the top without re-rolling the dice
  for (const b of box.querySelectorAll('[data-alt]')) b.addEventListener('click', () => {
    const swap = picks.find(p => p.name === b.dataset.alt);
    const reordered = [swap, ...picks.filter(p => p !== swap)];
    renderPick({ picks: reordered, pay, openKnown, total });
  });
}

// ---------- tips ----------
const TAG_LABEL = { block: 'What your block includes', value: 'Best value', hidden: 'Hidden menu & off-campus', rule: 'Plan rules worth knowing' };
function renderTips() {
  const all = [...(window.TIPS?.[state.school] || []), ...((state.tips || []).filter(t => t.school === state.school))];
  const box = $('tipsBody');
  if (!all.length) { box.innerHTML = '<p class="hint">No tips for this school yet — add the first one below.</p>'; return; }
  const groups = ['block', 'value', 'hidden', 'rule'].map(tag => ({ tag, items: all.filter(t => t.tag === tag) })).filter(g => g.items.length);
  box.innerHTML = groups.map(g => `<h3>${TAG_LABEL[g.tag]}</h3><ul class="tips">${g.items.map(t => `<li>${t.place ? `<b>${esc(t.place)}</b> — ` : ''}${esc(t.tip)}${t.source ? ` <span class="src">${esc(t.source)}</span>` : ''}${t.mine ? ` <button type="button" class="link danger" data-tip-del="${esc(t.id)}" aria-label="Remove">✕</button>` : ''}</li>`).join('')}</ul>`).join('');
  for (const b of box.querySelectorAll('[data-tip-del]')) b.addEventListener('click', () => { state.tips = state.tips.filter(t => t.id !== b.dataset.tipDel); save(); renderTips(); });
}
$('tipAdd').addEventListener('click', () => {
  const tip = $('tipText').value.trim(); if (!tip) return;
  (state.tips ||= []).push({ id: crypto.randomUUID(), school: state.school, tag: $('tipTag').value, place: $('tipPlace').value !== OTHER ? $('tipPlace').value : '', tip, mine: true });
  $('tipText').value = ''; save(); renderTips();
});
$('tipShare').addEventListener('click', () => {
  const mine = (state.tips || []).filter(t => t.school === state.school);
  const body = mine.length ? mine.map(t => `- [${t.tag}] ${t.place ? t.place + ': ' : ''}${t.tip}`).join('\n') : '- [block] Place: what your block includes…';
  window.open(`https://github.com/ethanliu2026/dining-dollars/issues/new?title=${encodeURIComponent(`Tips for ${school().name}`)}&body=${encodeURIComponent(`School: ${school().name}\n\n${body}\n\n(Add these to tips.js)`)}`, '_blank', 'noopener');
});

// ---------- wiring ----------
for (const b of document.querySelectorAll('#eatCard [data-pay]')) b.addEventListener('click', () => { eatState().pay = b.dataset.pay; save(); syncEatControls(); renderPick(); });
$('eatOpenOnly').addEventListener('change', e => { eatState().openOnly = e.target.checked; save(); renderPick(); });
$('eatDecide').addEventListener('click', () => renderPick());
function syncEatControls() {
  for (const b of document.querySelectorAll('#eatCard [data-pay]')) b.setAttribute('aria-checked', b.dataset.pay === eatState().pay);
  $('eatOpenOnly').checked = eatState().openOnly;
  $('eatOpenWrap').hidden = !LIVE;
  const sel = $('tipPlace'); const keep = sel.value;
  sel.replaceChildren(new Option('Any place', OTHER), ...[...$('txLocation').options].filter(o => o.value && o.value !== OTHER).map(o => new Option(o.text, o.value)));
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
}
async function refreshEat() {
  syncEatControls(); renderTips();
  await loadLive();
  syncEatControls();
}
document.querySelector('.tabs-nav [data-tab="eat"]').addEventListener('click', () => { refreshEat(); });
new MutationObserver(() => syncEatControls()).observe($('txLocation'), { childList: true });
refreshEat();
