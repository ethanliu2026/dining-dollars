// Shareable semester card: a 1080×1350 PNG drawn on a canvas (no server), handed to the
// phone's share sheet when available, otherwise downloaded. Loaded after app.js.

const SHARE_URL = 'https://ethanliu2026.github.io/dining-dollars/';

function shareStats() {
  const r = compute();
  if (!r) return null;
  const tracked = r.buckets.filter(b => !b.noData && b.period === 'semester' && !b.passive);
  const count = tracked.find(b => b.kind === 'count'), money = tracked.find(b => b.kind === 'money');
  const a = !r.quick && r.txns.length ? analyze(r) : null;
  const lines = [];
  for (const b of tracked) {
    const pct = Math.round(b.spent / b.start * 100);
    lines.push({ label: b.label, big: b.kind === 'money' ? fmt$(b.spent) : `${fmtN(b.spent, 0)} ${b.unit}s`, sub: `used of ${b.kind === 'money' ? fmt$(b.start) : fmtN(b.start, 0)} · ${pct}%` });
  }
  let verdict;
  const worst = ['bad', 'warn', 'good'].map(s => tracked.find(b => b.status === s)).find(Boolean);
  if (!worst) verdict = 'Just getting started.';
  else if (worst.status === 'bad') verdict = `Running out of ${worst.label} around ${fmtDate(worst.runOutDate)}`;
  else if (worst.status === 'warn') verdict = `On track to leave ${worst.kind === 'money' ? fmt$(worst.endBal) : fmtN(worst.endBal, 0) + ' ' + worst.unit + 's'} unused`;
  else verdict = 'Right on pace 🎯';
  // advisor headline, if it has an opinion
  let advice = null;
  try {
    const need = needsFromUsage();
    if (need) {
      const st = advisorState();
      const ranked = rankPlans(need, st.group);
      const best = ranked[0], cur = ranked.find(x => x.plan.id === state.planId);
      if (best && cur && best.plan.id !== cur.plan.id && cur.trueCost - best.trueCost >= 25) advice = `Next semester: ${best.plan === NO_PLAN ? 'skip the plan' : best.plan.name} saves ~${fmt$(cur.trueCost - best.trueCost)}`;
      else if (best && cur) advice = `${cur.plan.name} is the right plan for me`;
    }
  } catch {}
  const top = a?.places?.[0];
  return { r, lines, verdict, advice, top, days: r.elapsed, school: school().name, plan: plan()?.name || 'Custom plan', count, money };
}

function roundRect(g, x, y, w, h, rad) { g.beginPath(); g.roundRect(x, y, w, h, rad); }

function drawShareCard(s) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // background
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1b2a4a'); bg.addColorStop(1, '#0f1a30');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.arc(W - 120, 160, 260, 0, Math.PI * 2); g.fill();
  const font = (px, weight = 400) => `${weight} ${px}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const text = (t, x, y, px, weight = 400, color = '#fff', align = 'left') => { g.font = font(px, weight); g.fillStyle = color; g.textAlign = align; g.fillText(t, x, y); };
  const clip = (t, max) => { g.font = font(40, 600); while (g.measureText(t).width > max && t.length > 4) t = t.slice(0, -2) + '…'; return t; };

  text('MY MEAL PLAN', 72, 120, 30, 700, 'rgba(255,255,255,.6)');
  text(clip(`${s.school}`, 900), 72, 200, 64, 800);
  text(`${s.plan} · ${s.days} eating days in`, 72, 256, 34, 500, 'rgba(255,255,255,.75)');

  // stat tiles
  let y = 330;
  const tileH = 190, gap = 24, tw = (W - 144 - gap) / 2;
  s.lines.slice(0, 2).forEach((l, i) => {
    const x = 72 + i * (tw + gap);
    g.fillStyle = 'rgba(255,255,255,.08)'; roundRect(g, x, y, tw, tileH, 28); g.fill();
    text(l.label.toUpperCase(), x + 32, y + 56, 26, 700, 'rgba(255,255,255,.6)');
    text(l.big, x + 32, y + 126, 60, 800);
    text(l.sub, x + 32, y + 166, 26, 500, 'rgba(255,255,255,.7)');
  });
  if (s.lines.length === 1) { /* single tile is fine */ }
  y += tileH + 40;

  // verdict
  const vcol = /Running out/.test(s.verdict) ? '#ff7b72' : /unused/.test(s.verdict) ? '#ffc866' : '#7ee2a8';
  g.fillStyle = 'rgba(255,255,255,.08)'; roundRect(g, 72, y, W - 144, 150, 28); g.fill();
  g.fillStyle = vcol; roundRect(g, 72, y, 14, 150, 7); g.fill();
  text('STATUS', 112, y + 54, 26, 700, 'rgba(255,255,255,.6)');
  g.font = font(44, 700); g.fillStyle = vcol; g.textAlign = 'left';
  let vt = s.verdict; while (g.measureText(vt).width > W - 144 - 80 && vt.length > 5) vt = vt.slice(0, -2) + '…';
  g.fillText(vt, 112, y + 116);
  y += 190;

  // top place + advice
  const rows = [];
  if (s.top) rows.push(['MOST VISITED', `${s.top.name} · ${s.top.count} visit${s.top.count > 1 ? 's' : ''} · ${fmt$(s.top.total)}`]);
  if (s.advice) rows.push(['PLAN ADVISOR', s.advice]);
  for (const [k, v] of rows) {
    g.fillStyle = 'rgba(255,255,255,.08)'; roundRect(g, 72, y, W - 144, 130, 28); g.fill();
    text(k, 104, y + 50, 26, 700, 'rgba(255,255,255,.6)');
    g.font = font(38, 600); g.fillStyle = '#fff';
    let t = v; while (g.measureText(t).width > W - 144 - 64 && t.length > 5) t = t.slice(0, -2) + '…';
    g.fillText(t, 104, y + 102);
    y += 154;
  }

  // footer
  text('Track blocks, FLEX & dining dollars · plan advisor · receipt scanning', 72, H - 120, 28, 500, 'rgba(255,255,255,.7)');
  text(SHARE_URL.replace('https://', ''), 72, H - 70, 32, 700, '#8ec5ff');
  return c;
}

async function shareCard() {
  const s = shareStats();
  if (!s) { alert('Set up your plan and log a few purchases first.'); return; }
  const canvas = drawShareCard(s);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], 'my-meal-plan.png', { type: 'image/png' });
  const textLine = `${s.verdict}${s.advice ? ' · ' + s.advice : ''} — ${SHARE_URL}`;
  // preview
  $('sharePreview').src = URL.createObjectURL(blob);
  $('sharePreviewWrap').hidden = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'My meal plan', text: textLine }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'my-meal-plan.png' });
  a.click();
  try { await navigator.clipboard.writeText(textLine); $('shareHint').textContent = 'Image downloaded and caption copied to your clipboard.'; } catch { $('shareHint').textContent = 'Image downloaded.'; }
}
$('btnShare').addEventListener('click', shareCard);
$('btnShareTop').addEventListener('click', () => { showTab('insights'); $('shareCard').scrollIntoView({ block: 'start' }); shareCard(); });
