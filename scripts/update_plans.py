#!/usr/bin/env python3
"""Refresh plans.json / plans.js from the schools' official meal plan pages.

plans.json is the source of truth (edit it by hand for schools this script can't fetch);
plans.js is generated from it so the page can load it without a server.

    python3 scripts/update_plans.py            # update every school it knows how to fetch
    python3 scripts/update_plans.py cmu        # just one

CMU publishes its plans as a PDF agreement, which this parses. Pitt's page (dineoncampus.com)
blocks scripted requests, so its entry is kept as-is unless you paste the page text into
scripts/pitt.txt (select-all → copy from the page) and re-run.

Needs `curl` and `pdftotext` (brew install poppler) for CMU.
"""
import json, re, subprocess, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLANS_JS = ROOT / 'plans.js'
PLANS_JSON = ROOT / 'plans.json'
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/128 Safari/537.36'}

CMU_PDF = 'https://www.cmu.edu/dining/your-dining-plan/26-27-uc-meal-plan-agreementfinal.pdf'
PITT_URL = 'https://dineoncampus.com/pitt/20262027-meal-memberships'


def slug(name):
    return re.sub(r'[^a-z0-9]+', '', name.lower().split()[0])


def fetch_cmu():
    pdf = subprocess.run(['curl', '-sSL', '-A', UA['User-Agent'], CMU_PDF], capture_output=True, check=True).stdout
    text = subprocess.run(['pdftotext', '-layout', '-', '-'], input=pdf, capture_output=True, check=True).stdout.decode()
    # "Red Plan = $7,736 per year / $3,868 per semester" followed by
    # "205 meal blocks per semester (average 13 ...), $880 flexible dollars per"
    pat = re.compile(r"([A-Za-z'’ ]+?)\s*=\s*\$[\d,]+ per year\s*/\s*\$([\d,]+) per semester\*{0,2}\s*\n\s*(\d+) meal blocks per semester.*?\$([\d,]+) flexible dollars", re.S)
    plans, section = [], 'traditional'
    for line_no, m in enumerate(pat.finditer(text)):
        name = m.group(1).strip().replace('’', "'")
        cost, blocks, flex = (int(m.group(i).replace(',', '')) for i in (2, 3, 4))
        p = {'id': slug(name), 'name': name, 'cost': cost, 'buckets': {'blocks': blocks, 'flex': flex}}
        if text.find('COMMUNITY DINING PLANS') < m.start():
            p['who'] = 'Community plan'
        plans.append(p)
    if not plans:
        raise RuntimeError('no plans parsed from CMU PDF — layout changed?')
    return {'source': CMU_PDF, 'verified': date.today().isoformat(),
            'note': 'Upperclass pricing; first-year plans have the same blocks/FLEX at slightly higher cost.',
            'plans': plans}


def fetch_pitt(existing):
    """Parse a saved copy of the Dine On Campus page text (scripts/pitt.txt)."""
    f = ROOT / 'scripts' / 'pitt.txt'
    if not f.exists():
        print('  pitt: no scripts/pitt.txt — keeping existing entry', file=sys.stderr)
        return existing
    text = f.read_text()
    blocks = re.split(r'\n(?=(?:Full-Access|Weekly|Block|\d+ All-Day Access|\$\d+ Plan)[^\n]*\n)', text)
    plans = []
    for b in blocks:
        head = b.strip().split('\n')[0].strip()
        if not re.match(r'(Full-Access|Weekly|Block|\d+ All-Day Access|\$\d+ Plan)', head):
            continue
        cost = re.findall(r'\n\s*([\d,]{3,6})\s*$', b.rstrip() + '\n')
        dd = re.search(r'\$(\d+) Dining Dollars', b)
        flex = re.search(r'(\d+) Flex [Mm]eals', b)
        buckets = {}
        if head.startswith('Full-Access'):
            buckets['meals'] = {'amount': 0, 'period': 'unlimited'}
        elif head.startswith('Weekly'):
            buckets['meals'] = {'amount': int(re.search(r'(\d+) meals per week', b).group(1)), 'period': 'week'}
        elif head.startswith('Block'):
            buckets['meals'] = int(re.search(r'(\d+) meals per semester', b).group(1))
        elif 'All-Day' in head:
            buckets['meals'] = int(head.split()[0])
        if flex: buckets['flexMeals'] = int(flex.group(1))
        if dd: buckets['dd'] = int(dd.group(1))
        plans.append({'id': re.sub(r'[^a-z0-9]', '', head.lower()), 'name': head,
                      'cost': int(cost[-1].replace(',', '')) if cost else 0, 'buckets': buckets})
    if not plans:
        raise RuntimeError('no plans parsed from scripts/pitt.txt')
    return {'source': PITT_URL, 'verified': date.today().isoformat(), 'plans': plans}


def load_existing():
    return json.loads(PLANS_JSON.read_text())


def write(plans):
    PLANS_JSON.write_text(json.dumps(plans, indent=2, ensure_ascii=False) + '\n')
    PLANS_JS.write_text('// GENERATED from plans.json by scripts/update_plans.py — do not edit by hand.\n'
                        'window.PLANS = ' + json.dumps(plans, indent=2, ensure_ascii=False) + ';\n')


if __name__ == '__main__':
    want = sys.argv[1:] or ['cmu', 'pitt']
    if want == ['--no-fetch']: want = []          # just regenerate plans.js from plans.json
    plans = load_existing()
    if 'cmu' in want:
        plans['cmu'] = fetch_cmu(); print(f"  cmu: {len(plans['cmu']['plans'])} plans")
    if 'pitt' in want:
        plans['pitt'] = fetch_pitt(plans.get('pitt')); print(f"  pitt: {len(plans['pitt']['plans'])} plans")
    write(plans)
    print('wrote plans.json and plans.js')
