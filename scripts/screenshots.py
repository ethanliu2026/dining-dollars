#!/usr/bin/env python3
"""Capture 3:2 screenshots of each screen (for Devpost / README) using Playwright.
    python3 scripts/screenshots.py [base_url]   → docs/screenshots/*.png (1200×800 @2x = 2400×1600, 3:2)
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'https://meal-blocks.tech/'
OUT = Path(__file__).resolve().parent.parent / 'docs' / 'screenshots'
OUT.mkdir(parents=True, exist_ok=True)
SHOTS = [
    ('01-home-today',    'demo&tab=home&dash=today'),
    ('02-home-semester', 'demo&tab=home&dash=chart', None, 0.74),
    ('03-log-where',     'demo&tab=insights&pane=where'),
    ('04-log-blockvalue','demo&tab=insights&pane=blocks'),
    ('05-eat',           'demo&tab=eat'),
    ('06-plans',         'demo&tab=advisor', '.adv-best'),
    ('07-settings',      'demo&tab=setup'),
]
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1200, 'height': 800}, device_scale_factor=2, color_scheme='dark')
    page = ctx.new_page()
    for name, q, *rest in SHOTS:
        scroll = rest[0] if rest else None
        zoom = rest[1] if len(rest) > 1 else None
        page.goto(f'{BASE}?{q}', wait_until='networkidle')
        page.wait_for_timeout(1500)          # charts animate in; live data settles
        if zoom: page.evaluate(f"document.body.style.zoom='{zoom}'"); page.evaluate("chartBalance && chartBalance.resize()"); page.wait_for_timeout(600)
        if scroll: page.evaluate(f"document.querySelector('{scroll}').scrollIntoView({{block: 'start'}}); window.scrollBy(0, -16)"); page.wait_for_timeout(400)
        if 'tab=eat' in q:
            page.evaluate("(async () => { showTab('eat'); await refreshEat(); renderPick(); })()"); page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT / f'{name}.png'))
        print('saved', name)
    # phone shots (composited later if wanted)
    phone = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, color_scheme='dark', is_mobile=True)
    pg = phone.new_page()
    for name, q in [('m1-home', 'demo&tab=home&dash=today'), ('m2-eat', 'demo&tab=eat')]:
        pg.goto(f'{BASE}?{q}', wait_until='networkidle'); pg.wait_for_timeout(1500)
        if 'tab=eat' in q: pg.evaluate("(async () => { showTab('eat'); await refreshEat(); renderPick(); })()"); pg.wait_for_timeout(1200)
        pg.screenshot(path=str(OUT / f'{name}.png')); print('saved', name)
    b.close()
