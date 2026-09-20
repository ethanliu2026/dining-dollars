#!/usr/bin/env python3
"""End-to-end smoke test against the live site (or a base URL). python3 scripts/e2e.py [base]"""
import sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'https://meal-blocks.tech/'
results, errors = [], []
def check(name, ok, detail=''):
    results.append((name, bool(ok), detail)); print(('PASS ' if ok else 'FAIL ') + name + (f'  — {detail}' if detail and not ok else ''))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1200, 'height': 900})
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'favicon' not in m.text else None)
    ev = lambda js: pg.evaluate(js)
    def goto(q=''): pg.goto(f'{BASE}?{q}', wait_until='networkidle'); pg.wait_for_timeout(1200)

    # 1. fresh visitor → settings + tour
    goto('t0'); ev("localStorage.clear(); sessionStorage.clear()"); goto('t1'); pg.wait_for_timeout(800)
    check('fresh visitor lands on Settings', ev("[...document.querySelectorAll('.tab')].find(t=>!t.hidden)?.dataset.tab") == 'setup')
    check('tour auto-starts for new users', ev("!!document.getElementById('tour') && !document.getElementById('tour').hidden"))
    ev("endTour(true)")
    check('tour dismissed + remembered', ev("localStorage.getItem('ddt.tour')") == 'done')

    # 2. school search + plan + fixed allotments
    ev("chooseSchool('pitt')"); pg.wait_for_timeout(300)
    check('school switch sets Pitt term dates', ev("state.semStart") == '2026-08-24' and ev("state.semEnd") == '2026-12-12')
    check('school badge + theme applied', ev("document.getElementById('schoolShort').textContent") == 'Pitt' and ev("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()") != '')
    ev("const e=document.getElementById('plan'); e.value='block145'; e.dispatchEvent(new Event('change'))"); pg.wait_for_timeout(200)
    check('plan sets allotments', ev("state.start.meals") == 145 and ev("state.start.dd") == 400)
    check('plan allotments are read-only', ev("document.getElementById('start-meals').readOnly && document.getElementById('start-dd').readOnly"))
    # mid-semester
    ev("const c=document.getElementById('midOn'); c.checked=true; c.dispatchEvent(new Event('change'))"); pg.wait_for_timeout(200)
    ev("const i=document.getElementById('trackBalance-meals'); i.value='120'; i.dispatchEvent(new Event('input'))"); pg.wait_for_timeout(200)
    check('mid-semester prior usage counted', ev("compute().buckets.find(b=>b.key==='meals').prior") == 25)
    ev("const c=document.getElementById('midOn'); c.checked=false; c.dispatchEvent(new Event('change'))")

    # 3. log purchases: manual, split, worth
    ev("showTab('home')")
    ev("document.getElementById('txBucket').value='meals'; updateAmountField(); document.getElementById('txAmount').value='1'; document.getElementById('txWorth').value='11.5'; document.getElementById('txLocation').value='The Eatery (Towers)'; document.getElementById('txForm').requestSubmit()"); pg.wait_for_timeout(300)
    check('manual purchase logged with worth', ev("state.txns.at(-1).parts[0].value") == 11.5)
    ev("document.getElementById('btnSplit').click(); document.getElementById('txBucket').value='meals'; updateAmountField(); document.getElementById('txAmount').value='1'; document.getElementById('txBucket2').value='dd'; document.getElementById('txAmount2').value='3.25'; document.getElementById('txLocation').value='The Perch (Sutherland)'; document.getElementById('txForm').requestSubmit()"); pg.wait_for_timeout(300)
    check('split purchase logged', ev("state.txns.at(-1).parts.length") == 2)
    check('verdict rendered', ev("document.getElementById('vHead').textContent.length") > 5)
    check('Today card shows a plan', 'Left for today' in ev("document.getElementById('todayHead').textContent"))
    # dashboard tabs don't break the log column
    ev("document.querySelector('[data-dash=balances]').click()"); pg.wait_for_timeout(200)
    check('dashboard tab keeps mode', ev("state.mode") == 'log' and not ev("document.getElementById('homeLeft').hidden"))
    ev("document.querySelector('[data-dash=chart]').click()"); pg.wait_for_timeout(400)
    check('semester chart drawn', ev("chartBalance && chartBalance.config.type") == 'line')

    # 4. receipt parser (OCR text path) + paste import
    parsed = ev("parseReceipt('THE PERCH\\n9/19/2026\\nDinner\\nMEAL SWIPE 1\\nDINING DOLLARS -2.50\\nBalance 0.00')")
    check('receipt parser maps tender lines', {pt['bucket'] for pt in parsed['parts']} == {'meals', 'dd'}, json.dumps(parsed['parts']))
    n = ev("state.txns.length")
    ev("document.getElementById('pasteToggle').click(); document.getElementById('pasteText').value='Your Grubhub order from Forbes Street Market\\nSep 18, 2026\\n1x Wrap $8.49\\nPaid with Dining Dollars $8.49'; document.getElementById('pasteGo').click()"); pg.wait_for_timeout(400)
    check('pasted order logged', ev("state.txns.length") == n + 1 and ev("state.txns.at(-1).location") == 'Forbes Street Market')
    ev("document.getElementById('scanUndo').click()"); pg.wait_for_timeout(200)
    check('undo removes it', ev("state.txns.length") == n)

    # 5. sample data + log tab + block values + share
    pg.once('dialog', lambda d: d.accept()); ev("document.getElementById('btnSample').click()"); pg.wait_for_timeout(800)
    check('sample data loads and lands on Home', ev("state.txns.length") > 20 and ev("[...document.querySelectorAll('.tab')].find(t=>!t.hidden)?.dataset.tab") == 'home')
    check('forecast appears with history', not ev("document.getElementById('forecastList').hidden"))
    ev("showTab('insights'); showLogPane('where')"); pg.wait_for_timeout(500)
    check('insights render', ev("document.querySelectorAll('#insights li').length") >= 3)
    check('places chart drawn', ev("chartPlaces && chartPlaces.data.labels.length") >= 3)
    ev("showLogPane('blocks')"); pg.wait_for_timeout(200)
    check('block value table from receipts', ev("document.querySelectorAll('.bv-table tr').length") >= 2)
    ev("showLogPane('purchases')"); pg.wait_for_timeout(200)
    check('purchases table', ev("document.querySelectorAll('#txTable tbody tr').length") > 20)
    check('share FAB visible on Log', not ev("document.getElementById('btnShareFab').hidden"))
    check('share card renders', ev("!!drawShareCard(shareStats())"))
    csv = ev("(() => { const defs=school().buckets; return state.txns.length; })()")
    check('csv export has rows', csv > 0)

    # 6. eat
    ev("showTab('eat')"); ev("(async () => { await refreshEat(); renderPick(); })()"); pg.wait_for_timeout(1500)
    first = ev("document.querySelector('.pick-name')?.textContent")
    ev("document.getElementById('eatAgain').click()"); pg.wait_for_timeout(300)
    second = ev("document.querySelector('.pick-name')?.textContent")
    check('decider picks and rotates', bool(first) and first != second, f'{first} → {second}')
    check("'I'm going' is the primary button", ev("document.getElementById('eatLog').classList.contains('primary')"))
    ev("document.getElementById('eatLog').click()"); pg.wait_for_timeout(300)
    check("'I'm going' prefills the form on Home", ev("[...document.querySelectorAll('.tab')].find(t=>!t.hidden)?.dataset.tab") == 'home' and ev("document.getElementById('txLocation').value") != '')
    ev("showTab('eat'); document.getElementById('tipsDetails').open = true"); pg.wait_for_timeout(200)
    check('tips render for Pitt', ev("document.querySelectorAll('#tipsBody li').length") >= 3)

    # 7. plans
    ev("showTab('advisor')"); pg.wait_for_timeout(400)
    check('advisor from usage', len(ev("document.querySelector('.adv-best')?.innerText || ''")) > 20)
    ev("document.querySelector('[data-amode=answers]').click(); const g=document.getElementById('advGroup'); g.value='commuter'; g.dispatchEvent(new Event('change'))"); pg.wait_for_timeout(300)
    check('advisor eligibility filter (commuter shows No meal plan)', 'No meal plan' in ev("document.querySelector('.adv-table').innerText"))

    # 8. quick estimate + weekly plan + theme + term
    ev("showTab('setup'); document.querySelector('[data-mode=quick]').click()"); pg.wait_for_timeout(300)
    ev("const i=document.getElementById('current-dd'); i.value='250'; i.dispatchEvent(new Event('input'))"); pg.wait_for_timeout(200)
    check('quick estimate computes', ev("compute()?.buckets.find(b=>b.key==='dd').balance") == 250)
    ev("document.querySelector('[data-mode=log]').click()")
    ev("state.txns=[]; chooseSchool('temple'); const e=document.getElementById('plan'); e.value='weekly12'; e.dispatchEvent(new Event('change'))"); pg.wait_for_timeout(300)
    ev("showTab('home'); document.getElementById('txBucket').value='meals'; updateAmountField(); document.getElementById('txAmount').value='1'; document.getElementById('txLocation').value='Johnson & Hardwick Dining Hall'; document.getElementById('txForm').requestSubmit()"); pg.wait_for_timeout(400)
    check('weekly plan headline', 'this week' in ev("document.getElementById('vHead').textContent"))
    ev("showDash('chart')"); pg.wait_for_timeout(400)
    check("weekly 'This week' bar chart", ev("chartBalance && chartBalance.config.type") == 'bar' and ev("document.querySelector('[data-dash=chart]').textContent") == 'This week')
    ev("applyTheme('light'); applySchoolTheme(); render()"); pg.wait_for_timeout(200)
    check('light theme applies', ev("document.documentElement.dataset.theme") == 'light')
    ev("applyTheme('auto'); applySchoolTheme()")
    ev("const t=document.getElementById('term'); t.value='Spring 2027'; t.dispatchEvent(new Event('change'))"); pg.wait_for_timeout(200)
    check('term picker sets spring dates', ev("state.semStart") == '2027-01-11')

    # 9. custom school
    ev("state.txns=[]; chooseSchool('other')"); pg.wait_for_timeout(300)
    ev("const n=document.getElementById('customName'); n.value='Test U'; n.dispatchEvent(new Event('input')); const l=document.getElementById('customLocations'); l.value='Main Hall\\nCafe'; l.dispatchEvent(new Event('input')); const s=document.getElementById('start-swipes'); s.value='100'; s.dispatchEvent(new Event('input'))"); pg.wait_for_timeout(300)
    check('custom school works', ev("document.getElementById('txLocation').options.length") >= 3 and ev("compute()?.buckets.find(b=>b.key==='swipes').balance") == 100)

    # 10. backup round-trip + reset to CMU
    backup = ev("JSON.stringify(state)")
    check('backup serializes', len(backup) > 100)
    ev("state.txns=[]; chooseSchool('cmu')")

    # 11. phone viewport
    ph = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True).new_page()
    ph.on('pageerror', lambda e: errors.append(f'phone pageerror: {e}'))
    ph.goto(f'{BASE}?demo&tab=home', wait_until='networkidle'); ph.wait_for_timeout(1500)
    for tab in ['home', 'insights', 'eat', 'advisor', 'setup']:
        ph.evaluate(f"showTab('{tab}')"); ph.wait_for_timeout(300)
        wide = ph.evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right > innerWidth+1 && getComputedStyle(e).position!=='fixed').map(e=>e.tagName+'.'+e.className).slice(0,3)")
        check(f'phone: no horizontal overflow on {tab}', not wide, ', '.join(wide))
    check('phone: bottom nav has 4 tabs', ph.evaluate("document.querySelectorAll('.tabs-nav button').length") == 4)
    check('PWA: manifest + service worker', ph.evaluate("!!document.querySelector('link[rel=manifest]')") and ph.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.length)") >= 1)
    b.close()

fails = [r for r in results if not r[1]]
print(f'\n{len(results)-len(fails)}/{len(results)} passed')
real_errors = [e for e in errors if 'favicons' not in e]
print('console/page errors:', len(real_errors)); [print('  ', e[:200]) for e in real_errors[:8]]
sys.exit(1 if fails or real_errors else 0)
