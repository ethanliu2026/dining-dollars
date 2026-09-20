// First-run guide: a short step-by-step tour that walks new users through the app.
// "New" = nothing set up yet (no plan or balances, no purchases) and the tour hasn't been
// completed or skipped on this device. Re-run any time from Settings → "Show the guide".

const TOUR_STORE = 'ddt.tour';
const STEPS = [
  { tab: 'setup', target: 'schoolSearch', title: 'Start with your school', body: 'Type your school and pick your meal plan — the app fills in your blocks, dollars and semester dates from the official plan.' },
  { tab: 'setup', target: 'midWrap', title: 'Already mid-semester?', body: 'Tick this and enter what your dining app says you have left. Everything used before today counts, so your pace is right from day one.' },
  { tab: 'home', target: 'logCard', title: 'Log what you buy', body: 'Snap a receipt, paste a Grubhub email, or type it in. Split payments (a block + a few dollars) are fine.' },
  { tab: 'home', target: 'verdict', title: 'Know where you stand', body: 'Are you going to run out, or leave money on the table? Below it: what to use today, your balances, and the semester chart.' },
  { tab: 'insights', target: 'logStack', title: 'See where it goes', body: 'Which places eat your budget, where a block buys the most, and every purchase you\'ve logged.' },
  { tab: 'eat', target: 'eatCard', title: 'Can\'t decide where to eat?', body: 'Let it pick — it knows what\'s open, how you\'re paying, and where you haven\'t been in a while.' },
  { tab: 'advisor', target: 'advisorCard', title: 'Next semester', body: 'It projects your habits and tells you which plan actually fits — or whether to skip one.' },
];
let tourStep = -1;

function tourIsNew() {
  try { if (localStorage.getItem(TOUR_STORE)) return false; } catch {}
  const set = Object.values(state.start || {}).some(v => v > 0) || state.txns.length > 0;
  return !set;
}
function tourEl() {
  let el = $('tour');
  if (el) return el;
  el = document.createElement('div'); el.id = 'tour'; el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<div class="tour-card"><div class="tour-step" id="tourStep"></div><h3 id="tourTitle"></h3><p id="tourBody"></p>
    <div class="tour-actions"><button type="button" class="link" id="tourSkip">Skip</button><span class="spacer"></span><button type="button" id="tourBack">Back</button><button type="button" class="primary" id="tourNext" style="width:auto;margin:0">Next</button></div></div>`;
  document.body.appendChild(el);
  $('tourSkip').addEventListener('click', () => endTour());
  $('tourBack').addEventListener('click', () => showStep(tourStep - 1));
  $('tourNext').addEventListener('click', () => tourStep >= STEPS.length - 1 ? endTour(true) : showStep(tourStep + 1));
  return el;
}
function clearHighlight() { for (const e of document.querySelectorAll('.tour-target')) e.classList.remove('tour-target'); }
function showStep(i) {
  tourStep = Math.max(0, Math.min(STEPS.length - 1, i));
  const s = STEPS[tourStep];
  tourEl().hidden = false;
  showTab(s.tab, false);
  clearHighlight();
  const t = $(s.target);
  if (t) { t.classList.add('tour-target'); setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }
  $('tourStep').textContent = `${tourStep + 1} of ${STEPS.length}`;
  $('tourTitle').textContent = s.title;
  $('tourBody').textContent = s.body;
  $('tourBack').hidden = tourStep === 0;
  $('tourNext').textContent = tourStep === STEPS.length - 1 ? 'Get started' : 'Next';
}
function startTour() { showStep(0); }
function endTour(finished = false) {
  clearHighlight();
  if ($('tour')) $('tour').hidden = true;
  try { localStorage.setItem(TOUR_STORE, finished ? 'done' : 'skipped'); } catch {}
  showTab('setup');
  $('schoolSearch')?.focus();
}
$('btnGuide')?.addEventListener('click', () => { startTour(); });
// Auto-start for first-timers, after the page has settled (and not on top of the sign-in dialog).
setTimeout(() => { if (tourIsNew() && !document.querySelector('dialog[open]')) startTour(); }, 900);
