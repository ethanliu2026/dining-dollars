// Receipt scanning: photo → Claude → purchase. Loaded after app.js and uses its globals
// (state, save, render, school, activeBuckets, fillBuckets, removeTx, $, esc, fmt$, plural, toISO, today, OTHER).
//
// Three engines, best available wins:
//   1. A proxy URL (see server/worker.js) that holds an API key server-side → Claude vision.
//   2. An API key stored in this browser → Claude vision via the official SDK (CDN-loaded).
//   3. Nothing configured → on-device OCR (ocr.js, Tesseract.js). Free, private, less accurate.

// Set to false to ship with no language model at all (SteelHacks "No Wrapper" track):
// receipts are then read only by the on-device OCR, and the Claude settings are hidden.
const CLAUDE_ENABLED = true;

const KEY_STORE = 'ddt.apiKey';
const PROXY_STORE = 'ddt.proxyUrl';
// Team proxy (server/worker.js) so users never need a key. Set this to your deployed
// Worker URL, e.g. 'https://meal-plan-receipts.<you>.workers.dev'. Settings can override it.
const DEFAULT_PROXY = '';
const proxyUrl = () => localStorage.getItem(PROXY_STORE) || DEFAULT_PROXY;
const MODEL = 'claude-opus-5';
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm';

// What we ask Claude to return. Bucket keys are constrained to the current plan's buckets.
function receiptSchema(bucketKeys) {
  return {
    type: 'object',
    properties: {
      is_receipt: { type: 'boolean', description: 'false if the image is not a purchase receipt' },
      location: { type: 'string', description: 'Restaurant / dining location name as printed, or the closest match from the known list' },
      location_in_list: { type: 'boolean', description: 'true if `location` is exactly one of the known locations' },
      item_summary: { type: 'string', description: 'Short summary of what was bought, e.g. "Chicken bowl + drink"' },
      items: { type: 'array', items: { type: 'string' } },
      date: { type: ['string', 'null'], description: 'Purchase date as YYYY-MM-DD if printed, else null' },
      parts: {
        type: 'array',
        description: 'How the purchase was paid, one entry per bucket used',
        items: {
          type: 'object',
          properties: {
            bucket: { type: 'string', enum: bucketKeys },
            amount: { type: 'number', description: 'Dollars for money buckets; number of blocks/swipes for count buckets' },
            value: { type: ['number', 'null'], description: 'For a block/swipe: the dollar amount it covered, as printed on that tender line (e.g. "MEAL BLOCK -12.49" → 12.49). null for money buckets or if not printed.' },
          },
          required: ['bucket', 'amount', 'value'], additionalProperties: false,
        },
      },
      notes: { type: 'string', description: 'Anything uncertain, e.g. "total partly cut off"' },
    },
    required: ['is_receipt', 'location', 'location_in_list', 'item_summary', 'items', 'date', 'parts', 'notes'],
    additionalProperties: false,
  };
}

function receiptPrompt() {
  const sch = school();
  const buckets = activeBuckets().filter(b => b.period !== 'unlimited');
  const locs = [...$('txLocation').options].map(o => o.value).filter(v => v && v !== OTHER);
  return `You are reading a campus dining receipt for a student at ${sch.name}. Today is ${toISO(today())}.

The student's meal plan has these payment buckets (use the key in "bucket"):
${buckets.map(b => `- ${b.key}: ${b.label} — ${b.kind === 'money' ? 'dollars' : `count of ${b.unit}s`}`).join('\n')}

Known dining locations on campus:
${locs.map(l => `- ${l}`).join('\n')}

Read the receipt and report how it was paid. Rules:
- Receipts often show tender lines like "MEAL BLOCK", "MEAL SWIPE", "FLEX", "DINING DOLLARS", "DineXtra", "Points" — map each to the matching bucket. A block/swipe line counts as 1 ${buckets.find(b => b.kind === 'count')?.unit || 'block'} unless a quantity is printed.
- If a money bucket paid, use the amount charged to that bucket (after discounts), not the pre-discount subtotal.
- If the receipt was paid with cash/credit card and none of the buckets above, return an empty parts array.
- Pick "location" from the known list when the receipt clearly matches one (different capitalization or a shorter name still counts as a match); otherwise use the name printed on the receipt and set location_in_list to false.
- If the image is not a receipt at all, set is_receipt to false.`;
}

// Shrink the photo so uploads are fast; ~1600px on the long side is plenty for a receipt.
async function compressImage(file, maxSide = 1600) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {   // browser couldn't decode (e.g. HEIC on desktop) — send as-is
    const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(file); });
    return { data: b64, mediaType: file.type || 'image/jpeg', dataUrl: `data:${file.type || 'image/jpeg'};base64,${b64}` };
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { data: dataUrl.split(',')[1], mediaType: 'image/jpeg', dataUrl };
}

let sdkClientPromise = null;
async function claudeClient(apiKey) {
  if (!sdkClientPromise) {
    sdkClientPromise = import(SDK_URL).then(m => new (m.default || m.Anthropic)({ apiKey, dangerouslyAllowBrowser: true }));
  }
  return sdkClientPromise;
}

async function readReceipt({ data, mediaType }) {
  const apiKey = localStorage.getItem(KEY_STORE);
  const proxy = apiKey && localStorage.getItem(PROXY_STORE) === null ? '' : proxyUrl();   // a user-entered key wins over the default proxy
  const bucketKeys = activeBuckets().filter(b => b.period !== 'unlimited').map(b => b.key);
  const schema = receiptSchema(bucketKeys);
  const prompt = receiptPrompt();

  if (proxy) {
    const res = await fetch(proxy, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: data, media_type: mediaType, prompt, schema }) });
    if (!res.ok) throw new Error(`Proxy error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  if (!apiKey) throw new Error('NO_KEY');

  const client = await claudeClient(apiKey);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
        { type: 'text', text: prompt },
      ],
    }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Claude declined to read this image.');
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text);
}

// ---------- UI ----------
let lastScan = null;   // { txId, dataUrl }

function scanStatus(msg, kind = '') {
  const el = $('scanStatus');
  el.hidden = !msg;
  el.className = 'scan-status ' + kind;
  el.innerHTML = msg ? (kind === 'busy' ? '<span class="spinner"></span>' : '') + esc(msg) : '';
}

function pickLocation(name, inList) {
  const sel = $('txLocation');
  const opts = [...sel.options].map(o => o.value).filter(v => v && v !== OTHER);
  const n = name.trim().toLowerCase();
  return opts.find(o => o.toLowerCase() === n)
    || opts.find(o => o.toLowerCase().includes(n) || n.includes(o.toLowerCase()))
    || name.trim();
}

const engine = () => CLAUDE_ENABLED && (localStorage.getItem(KEY_STORE) || proxyUrl()) ? 'claude' : 'local';
window.addEventListener('tracker-account-changed', () => { lastScan = null; });

async function handleReceipt(file) {
  if (!file) return;
  if (document.querySelector('dialog[open]') || $('trackerContent').inert) return;
  const owner = window.trackerAccount?.generation;
  const receiptState = state;
  if (!activeBuckets().some(b => b.period !== 'unlimited')) { scanStatus('Pick your meal plan first so I know what buckets to charge.', 'error'); return; }

  $('scanLabel').classList.add('busy');
  $('scanResult').hidden = true;
  scanStatus('Reading your receipt…', 'busy');
  try {
    let r, img;
    if (engine() === 'claude') {
      img = await compressImage(file);
      r = await readReceipt(img);
    } else {
      r = await localReadReceipt(file, msg => scanStatus(msg, 'busy'));
      img = { dataUrl: r.dataUrl };
    }
    if (!r.is_receipt) { scanStatus("That doesn't look like a receipt. Try again with the whole receipt in frame.", 'error'); return; }
    if (owner !== window.trackerAccount?.generation || receiptState !== state) return;
    const defs = school().buckets;
    const parts = (r.parts || []).filter(p => defs[p.bucket] && p.amount > 0).map(p => ({ bucket: p.bucket, amount: Math.round(p.amount * 100) / 100, ...(defs[p.bucket].kind === 'count' && p.value > 0 ? { value: Math.round(p.value * 100) / 100 } : {}) }));
    if (!parts.length) { scanStatus(`Read "${r.location}" but couldn't find a meal-plan payment on it${r.notes ? ` (${r.notes})` : ''}. ${engine() === 'local' ? 'Try a sharper photo, or log it by hand below.' : 'Paid with card?'}`, 'error'); return; }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') && parse(r.date) <= today() ? r.date : toISO(today());
    const tx = { id: crypto.randomUUID(), date, location: pickLocation(r.location || 'Unknown', r.location_in_list), item: r.item_summary || (r.items || []).join(', '), parts };
    state.txns.push(tx); save(); render();
    lastScan = { txId: tx.id, dataUrl: img.dataUrl };
    showScanResult(tx, r);
    scanStatus('');
  } catch (e) {
    if (owner !== window.trackerAccount?.generation || receiptState !== state) return;
    if (e.message === 'NO_KEY') { openSettings(); scanStatus(''); return; }
    if (e.message === 'ABORT') { scanStatus(''); return; }
    console.error(e);
    scanStatus(`Couldn't read that: ${e.message || e}`, 'error');
  } finally {
    $('scanLabel').classList.remove('busy');
    $('receiptFile').value = '';
  }
}

function showScanResult(tx, r) {
  const defs = school().buckets;
  const paid = tx.parts.map(p => defs[p.bucket].kind === 'money' ? `${fmt$(p.amount)} ${defs[p.bucket].label}` : `${plural(p.amount, defs[p.bucket].unit)}${p.value ? ` (worth ${fmt$(p.value)})` : ''}`).join(' + ');
  const uncertain = !r.location_in_list || (r.notes && r.notes.trim()) || engine() === 'local';
  $('scanResult').className = 'scan-result' + (uncertain ? ' warn' : '');
  $('scanTag').textContent = uncertain ? 'Logged — check this' : 'Logged';
  $('scanResult').title = r.raw ? 'OCR text:\n' + r.raw : '';
  $('scanWhere').textContent = tx.location;
  $('scanBody').innerHTML = `${lastScan?.dataUrl ? `<img class="scan-thumb" src="${lastScan.dataUrl}" alt="">` : ''}<b>${esc(paid)}</b>${tx.item ? ` · ${esc(tx.item)}` : ''} · ${esc(fmtDate(parse(tx.date)))}${r.notes ? `<br><small>${esc(r.notes)}</small>` : ''}`;
  $('scanResult').hidden = false;
}

function undoScan() {
  if (!lastScan) return;
  removeTx(lastScan.txId);
  $('scanResult').hidden = true;
  lastScan = null;
}
// Edit = pull the purchase out of the log and drop it into the manual form.
function editScan() {
  if (!lastScan) return;
  const tx = state.txns.find(t => t.id === lastScan.txId);
  undoScan();
  if (!tx) return;
  $('txBucket').value = tx.parts[0].bucket; updateAmountField();
  $('txAmount').value = tx.parts[0].amount;
  if (tx.parts[1]) { $('splitFields').hidden = false; $('btnSplit').hidden = true; $('txBucket2').value = tx.parts[1].bucket; updateAmountField(); $('txAmount2').value = tx.parts[1].amount; }
  const sel = $('txLocation');
  if ([...sel.options].some(o => o.value === tx.location)) { sel.value = tx.location; $('txLocationOther').hidden = true; }
  else { sel.value = OTHER; $('txLocationOther').hidden = false; $('txLocationOther').value = tx.location; }
  $('txItem').value = tx.item; $('txDate').value = tx.date;
  $('txAmount').focus();
  $('logCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- settings ----------
function openSettings() {
  $('apiKey').value = localStorage.getItem(KEY_STORE) || '';
  $('proxyUrl').value = localStorage.getItem(PROXY_STORE) ?? '';
  $('proxyUrl').placeholder = DEFAULT_PROXY || 'https://your-worker.workers.dev';
  $('settings').showModal();
}
$('btnSettings').addEventListener('click', openSettings);
$('btnSettings').hidden = !CLAUDE_ENABLED;
$('settingsCancel').addEventListener('click', () => $('settings').close());
$('settings').querySelector('form').addEventListener('submit', () => {
  const key = $('apiKey').value.trim(), proxy = $('proxyUrl').value.trim();
  key ? localStorage.setItem(KEY_STORE, key) : localStorage.removeItem(KEY_STORE);
  proxy ? localStorage.setItem(PROXY_STORE, proxy) : localStorage.removeItem(PROXY_STORE);
  sdkClientPromise = null;
  // Paste-an-order: same parser as the OCR path, no photo needed (Grubhub emails, GET receipts).
$('pasteGo').addEventListener('click', () => {
  const text = $('pasteText').value.trim();
  if (!text) return;
  $('scanResult').hidden = true;
  const r = parseReceipt(text);
  const defs = school().buckets;
  const parts = (r.parts || []).filter(p => defs[p.bucket] && p.amount > 0).map(p => ({ bucket: p.bucket, amount: Math.round(p.amount * 100) / 100, ...(defs[p.bucket].kind === 'count' && p.value > 0 ? { value: Math.round(p.value * 100) / 100 } : {}) }));
  if (!parts.length) { scanStatus(`Couldn't find a meal-plan payment in that text${r.notes ? ` (${r.notes})` : ''}. Log it by hand below.`, 'error'); return; }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') && parse(r.date) <= today() ? r.date : toISO(today());
  const tx = { id: crypto.randomUUID(), date, location: pickLocation(r.location || 'Unknown', r.location_in_list), item: r.item_summary || '', parts };
  state.txns.push(tx); save(); render();
  lastScan = { txId: tx.id, dataUrl: null };
  showScanResult(tx, { ...r, notes: r.notes });
  scanStatus('');
  $('pasteText').value = '';
});
updateScanHint();
});
function updateScanHint() {
  $('scanHint').innerHTML = engine() === 'claude'
    ? 'Read by Claude. Works best with the whole receipt in frame, flat, in good light.'
    : 'Read on your phone — nothing is uploaded. Flat, well-lit, whole receipt in frame. Always double-check the result.';
}

$('receiptFile').addEventListener('change', e => handleReceipt(e.target.files[0]));
$('scanUndo').addEventListener('click', undoScan);
$('scanEdit').addEventListener('click', editScan);
$('scanDismiss').addEventListener('click', () => { $('scanResult').hidden = true; });
// Desktop convenience: drop or paste an image anywhere on the scan card.
$('scanCard').addEventListener('dragover', e => { e.preventDefault(); $('scanLabel').style.borderColor = 'var(--accent)'; });
$('scanCard').addEventListener('dragleave', () => { $('scanLabel').style.borderColor = ''; });
$('scanCard').addEventListener('drop', e => { e.preventDefault(); $('scanLabel').style.borderColor = ''; handleReceipt(e.dataTransfer.files[0]); });
document.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (f && state.mode === 'log') handleReceipt(f); });
// Paste-an-order: same parser as the OCR path, no photo needed (Grubhub emails, GET receipts).
$('pasteGo').addEventListener('click', () => {
  const text = $('pasteText').value.trim();
  if (!text) return;
  $('scanResult').hidden = true;
  const r = parseReceipt(text);
  const defs = school().buckets;
  const parts = (r.parts || []).filter(p => defs[p.bucket] && p.amount > 0).map(p => ({ bucket: p.bucket, amount: Math.round(p.amount * 100) / 100 }));
  if (!parts.length) { scanStatus(`Couldn't find a meal-plan payment in that text${r.notes ? ` (${r.notes})` : ''}. Log it by hand below.`, 'error'); return; }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') && parse(r.date) <= today() ? r.date : toISO(today());
  const tx = { id: crypto.randomUUID(), date, location: pickLocation(r.location || 'Unknown', r.location_in_list), item: r.item_summary || '', parts };
  state.txns.push(tx); save(); render();
  lastScan = { txId: tx.id, dataUrl: null };
  showScanResult(tx, { ...r, notes: r.notes });
  scanStatus('');
  $('pasteText').value = '';
});
updateScanHint();
