#!/bin/sh
# Installs a pre-commit hook that stamps asset URLs so deploys never serve stale JS/CSS.
cd "$(git rev-parse --show-toplevel)" || exit 1
cat > .git/hooks/pre-commit <<'H'
#!/bin/sh
python3 scripts/stamp.py >/dev/null && git add index.html
H
chmod +x .git/hooks/pre-commit && echo "pre-commit hook installed"
