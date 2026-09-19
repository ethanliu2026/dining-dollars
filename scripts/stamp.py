#!/usr/bin/env python3
"""Stamp local <script>/<link> URLs in index.html with ?v=<git short hash> so browsers
never reuse a stale cached copy after a deploy. Run before committing (or via the
pre-commit hook: scripts/install-hooks.sh)."""
import re, subprocess
from pathlib import Path
root = Path(__file__).resolve().parent.parent
try:
    v = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=root, capture_output=True, text=True, check=True).stdout.strip()
    # include working-tree changes so the stamp changes even before the commit lands
    dirty = subprocess.run(['git', 'status', '--porcelain', '--', '*.js', '*.css'], cwd=root, capture_output=True, text=True).stdout.strip()
    if dirty: v += '-' + subprocess.run(['git', 'hash-object', '--stdin'], cwd=root, input=dirty, capture_output=True, text=True).stdout[:6]
except Exception:
    import time; v = str(int(time.time()))
p = root / 'index.html'
s = p.read_text()
s2 = re.sub(r'((?:src|href)="(?!https?:)[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"', rf'\1?v={v}"', s)
if s2 != s:
    p.write_text(s2); print(f'stamped index.html with v={v}')
else:
    print('index.html unchanged')
