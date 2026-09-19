// On-device receipt reading with Tesseract.js — free, no account, nothing leaves the phone.
// Produces the same shape as the Claude reader in receipt.js:
//   { is_receipt, location, location_in_list, item_summary, items, date, parts, notes }
// Loaded after app.js; uses its globals (school, activeBuckets, $, OTHER, toISO, today).

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

// Words that identify each kind of bucket on a receipt. Matched against the bucket's own
// label too, so custom schools work as long as the receipt uses the same word.
const TENDER_WORDS = {
  blocks:    ['meal block', 'block'],
  flex:      ['flex'],
  dinex:     ['dinex', 'dine xtra', 'dinextra'],
  dd:        ['dining dollar', 'dining $', 'dining dlr', 'dd bal'],
  meals:     ['meal swipe', 'swipe', 'meal plan', 'meal exchange', 'meal'],
  swipes:    ['meal swipe', 'swipe', 'meal exchange'],
  flexMeals: ['flex meal', 'guest meal'],
  guest:     ['guest'],
  points:    ['points', 'point'],
  nova:      ['nova bucks', 'novabucks'],
  lioncash:  ['lioncash', 'lion cash'],
  plus:      ['plus'],
  ruexpress: ['ru express', 'ruexpress'],
  diamond:   ['diamond'],
};
const NOISE = /sub\s*total|tax|change|tip|balance|remaining|bal\b|auth|approved|thank|order|cashier|server|table|visit|www|http|\.com|receipt|copy|customer/i;
const MONEY = /-?\$?\s*(\d{1,4}[.,]\d{2})\b/g;
const MONEY_LOOSE = /-?\$?\s*(\d{1,4}[.,]\d{1,2})(?!\d)/g;   // OCR sometimes eats a digit: "2.7%" 

let tesseractPromise = null;
async function ocrWorker(onProgress) {
  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = TESSERACT_URL; s.onload = resolve; s.onerror = () => reject(new Error('Could not load the OCR engine (offline?)')); document.head.appendChild(s);
    }).then(() => Tesseract.createWorker('eng', 1, { logger: m => onProgress?.(m) }))
      .then(async w => { await w.setParameters({ tessedit_pageseg_mode: '4' }); return w; });   // 4 = single column, variable sizes: receipts
  }
  return tesseractPromise;
}

// Grayscale + Otsu threshold + upscale: thermal receipts OCR far better as clean black/white.
async function preprocess(file, binarize = true) {
  const bitmap = await createImageBitmap(file);
  const target = 1800;
  const scale = Math.max(1, target / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(bitmap, 0, 0, c.width, c.height);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const hist = new Uint32Array(256), gray = new Uint8ClampedArray(d.length / 4);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; gray[j] = v; hist[v | 0]++; }
  // Otsu's method
  const total = gray.length; let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break;
    sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; thr = t; }
  }
  // binarized pass for crisp thermal print; plain-grayscale pass as a fallback for noisy photos
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = binarize ? (gray[j] > thr ? 255 : 0) : gray[j]; d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(img, 0, 0);
  return { canvas: c, dataUrl: c.toDataURL('image/jpeg', 0.7) };
}

const norm = s => s.toLowerCase().replace(/[^a-z0-9$ ]+/g, ' ').replace(/\s+/g, ' ').trim();
// OCR swaps a letter now and then ("FLEK", "BL0CK"): a keyword matches if every word of it is
// within one edit of some word on the line (words of 4+ letters only).
function lev1(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
function lineHas(nl, keyword) {
  if (nl.includes(keyword)) return true;
  // digits inside a word are almost always misread letters: BL0CK, F1EX, 5WIPE
  const lw = nl.split(' ').filter(w => /[a-z]/.test(w)).map(w => w.replace(/0/g, 'o').replace(/1/g, 'l').replace(/5/g, 's').replace(/8/g, 'b').replace(/[^a-z]/g, ''));
  return keyword.split(' ').every(k => k.length >= 4 ? lw.some(w => lev1(w, k)) : nl.includes(k));
}
function lastMoney(line, loose = false) {
  let m = [...line.matchAll(MONEY)];
  if (!m.length && loose) m = [...line.matchAll(MONEY_LOOSE)];
  return m.length ? parseFloat(m[m.length - 1][1].replace(',', '.')) : null;
}

function parseDate(lines) {
  for (const l of lines) {
    let m = l.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m) { let [, a, b, y] = m; y = y.length === 2 ? '20' + y : y; const mo = +a, da = +b; if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`; }
    m = l.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    m = l.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i);
    if (m) { const mo = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].slice(0, 3).toLowerCase()) + 1; return `${m[3]}-${String(mo).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`; }
  }
  return null;
}

function matchLocation(lines) {
  const locs = [...$('txLocation').options].map(o => o.value).filter(v => v && v !== OTHER);
  const head = lines.slice(0, 12).map(norm).join(' | ');
  // score each known location by how many of its significant words appear near the top
  let best = null, bestScore = 0;
  for (const loc of locs) {
    const words = norm(loc).split(' ').filter(w => w.length > 2 && !['the', 'and', 'cafe', 'caf', 'at'].includes(w));
    if (!words.length) continue;
    const hits = words.filter(w => head.includes(w)).length;
    const score = hits / words.length + (hits === words.length ? 0.5 : 0);
    if (hits && score > bestScore) { best = loc; bestScore = score; }
  }
  if (best && bestScore >= 0.5) return { location: best, inList: true };
  const first = lines.find(l => l.trim().length > 3 && !/\d{2}[\/.-]\d{2}/.test(l) && !lastMoney(l));
  return { location: (first || 'Unknown').trim().replace(/\s+/g, ' ').slice(0, 40), inList: false };
}

function parseReceipt(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
  const buckets = activeBuckets().filter(b => b.period !== 'unlimited');
  const notes = [];
  const parts = [], usedLines = new Set();

  // 1. tender lines → buckets
  for (const b of buckets) {
    const words = [...(TENDER_WORDS[b.key] || []), norm(b.label)].filter(Boolean).sort((a, c) => c.length - a.length);
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const nl = norm(lines[i]);
      if (/remain|balance|bal\b|avail|left|prior|previous|new bal/.test(nl)) continue;   // "FLEX Remaining 701.29" is not a payment
      const w = words.find(w => lineHas(nl, w));
      if (!w) continue;
      // avoid "meal" matching "meal block" lines for a different bucket: longer keyword wins elsewhere
      if (w === 'meal' && buckets.some(o => o !== b && (TENDER_WORDS[o.key] || []).some(k => k !== 'meal' && nl.includes(k)))) continue;
      if (b.kind === 'money') {
        let money = lastMoney(lines[i]);
        if (money == null) { money = lastMoney(lines[i], true); if (money != null) notes.push(`${b.label} amount may be misread`); }
        if (money == null || money <= 0) continue;
        parts.push({ bucket: b.key, amount: money });
      } else {
        // quantity only from the text part, never from inside a price like "12.49 x"
        const textPart = lines[i].replace(MONEY_LOOSE, ' ');
        const q = textPart.match(/(?:^|\s)(\d)\s*x(?:\s|$)|(?:^|\s)x\s*(\d)\b|qty\s*(\d)/i);
        const part = { bucket: b.key, amount: q ? +(q[1] || q[2] || q[3]) : 1 };
        const worth = lastMoney(lines[i]);   // "MEAL BLOCK -12.49": what the block covered
        if (worth > 0) part.value = worth;
        parts.push(part);
      }
      usedLines.add(i);
      break;   // one line per bucket
    }
  }

  // 2. items = priced lines that aren't totals/tender/noise
  const items = [];
  lines.forEach((l, i) => {
    if (usedLines.has(i) || NOISE.test(l) || /total/i.test(l)) return;
    const price = lastMoney(l);
    if (price == null || price <= 0 || price > 200) return;
    const name = l.replace(MONEY, '').replace(/[-$@x\d.\s]+$/, '').replace(/^\W+/, '').replace(/^\d+\s*x\s*/i, '').trim();   // "1x Bowl" → "Bowl"
    if (name.length >= 3 && !/^\d/.test(name)) items.push(name.replace(/\s+/g, ' '));
  });

  // 3. nothing matched? fall back to the TOTAL line into the first money bucket
  if (!parts.length) {
    const tot = lines.find(l => /\btotal\b/i.test(l) && !/sub/i.test(l) && lastMoney(l) != null);
    const moneyB = buckets.find(b => b.kind === 'money');
    if (tot && moneyB) { parts.push({ bucket: moneyB.key, amount: lastMoney(tot) }); notes.push(`no ${moneyB.label} line found — used the total`); }
  }
  if (!parts.length) notes.push("couldn't find a meal-plan payment line");
  const { location, inList } = matchLocation(lines);
  if (!inList) notes.push('location not recognized');
  const looksLikeReceipt = lines.length >= 3 && (parts.length > 0 || items.length > 0 || /total/i.test(text));
  return {
    is_receipt: looksLikeReceipt,
    location, location_in_list: inList,
    item_summary: items.slice(0, 3).join(', ') + (items.length > 3 ? ` +${items.length - 3}` : ''),
    items, date: parseDate(lines), parts, notes: notes.join('; '),
  };
}

// Entry point used by receipt.js.
const scoreRead = r => r.parts.length * 10 + r.items.length + (r.location_in_list ? 3 : 0) + (r.date ? 1 : 0);
async function localReadReceipt(file, onProgress) {
  const worker = await ocrWorker(m => { if (m.status === 'recognizing text') onProgress?.(`Reading… ${Math.round(m.progress * 100)}%`); else if (m.status && m.progress < 1) onProgress?.(m.status === 'loading tesseract core' ? 'Loading OCR engine (first time only)…' : `${m.status}…`); });
  let best = null;
  for (const binarize of [true, false]) {
    const { canvas, dataUrl } = await preprocess(file, binarize);
    const { data } = await worker.recognize(canvas);
    const r = parseReceipt(data.text || '');
    r.raw = data.text; r.dataUrl = dataUrl;
    if (!best || scoreRead(r) > scoreRead(best)) best = r;
    if (best.parts.length && best.location_in_list) break;   // good enough, skip the second pass
    onProgress?.('Trying again with different processing…');
  }
  return best;
}
