#!/usr/bin/env bash
# ============================================================
# AGMX — Repository checks
# ------------------------------------------------------------
# Run locally:      ./tools/check.sh
# Run in CI:         bash tools/check.sh
# Install as hook:   ln -sf ../../tools/check.sh .git/hooks/pre-commit
#
# No dependencies beyond node + python3.
# Exits non-zero on the first failure so hooks and CI both block.
# ============================================================

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

FAIL=0
PASS=0
WARN=0

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; WARN=$((WARN+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# ----------------------------------------------------------------
head_ "1. JavaScript syntax"
# ----------------------------------------------------------------
# Check every top-level .js file, excluding vendored/minified output.
while IFS= read -r f; do
  if node --check "$f" 2>/dev/null; then ok "$f"; else
    bad "$f"
    node --check "$f" 2>&1 | head -5 | sed 's/^/      /'
  fi
done < <(find . -maxdepth 1 -name '*.js' -not -name '*.min.js' | sort)
[ "$PASS" -gt 0 ] || true

# ----------------------------------------------------------------
head_ "2. JSON validity"
# ----------------------------------------------------------------
for f in vercel.json manifest.json package.json sitemap.xml; do
  [ -f "$f" ] || continue
  case "$f" in
    *.xml) continue ;;
  esac
  if node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" 2>/dev/null; then
    ok "$f"
  else
    bad "$f — invalid JSON"
  fi
done

# sitemap.xml and the pocketbase payloads
for f in sitemap.xml; do
  [ -f "$f" ] || continue
  if python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse('$f')" 2>/dev/null; then
    ok "$f (well-formed XML)"
  else
    bad "$f — malformed XML"
  fi
done

for f in pocketbase/collections.json pocketbase/seed.json; do
  [ -f "$f" ] || continue
  if python3 -c "import json; json.load(open('$f'))" 2>/dev/null; then
    ok "$f"
  else
    bad "$f — invalid JSON"
  fi
done

# ----------------------------------------------------------------
head_ "3. Vercel routing invariants"
# ----------------------------------------------------------------
# Regression guard: the filesystem handler MUST precede the catch-all,
# otherwise Vercel serves index.html for every asset and the SPA dies.
if [ -f vercel.json ]; then
  if python3 - <<'PY'
import json, sys
try:
    cfg = json.load(open("vercel.json"))
except Exception as e:
    print(f"  \033[31m✗\033[0m vercel.json unreadable: {e}"); sys.exit(1)

routes = cfg.get("routes", [])
fails  = []

# The filesystem handler is expressed as {"handle": "filesystem"} — it has
# no "src" key, so track route order positionally instead.
fs_idx = next((i for i, r in enumerate(routes) if r.get("handle") == "filesystem"), None)
catch_idx = next((i for i, r in enumerate(routes) if r.get("src") == "/(.*)"), None)

if fs_idx is None:
    fails.append('no {"handle": "filesystem"} route — static assets get swallowed by the catch-all')
elif catch_idx is None:
    fails.append("filesystem handler present but no catch-all route")
elif fs_idx > catch_idx:
    fails.append("filesystem handler comes AFTER the catch-all — assets will resolve to index.html")
else:
    print("  \033[32m✓\033[0m filesystem handler precedes catch-all")

# A redirect to another host breaks the deployment if that alias is unset.
for r in cfg.get("redirects", []):
    dest = r.get("destination", "")
    if dest.startswith("http"):
        print(f"  \033[33m!\033[0m cross-host redirect to {dest} — confirm that alias resolves")

for f in fails:
    print(f"  \033[31m✗\033[0m {f}")
sys.exit(1 if fails else 0)
PY
  then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
fi

# ----------------------------------------------------------------
head_ "4. HTML asset references"
# ----------------------------------------------------------------
# Every local src/href in the HTML must resolve to a real file.
if python3 - <<'PY'
import os, re, sys, glob
missing = []
checked = 0
for page in ["index.html", "app.html", "assessment.html", "offline.html", "404.html"]:
    if not os.path.exists(page):
        continue
    html = open(page, encoding="utf-8").read()
    for url in re.findall(r'(?:src|href)\s*=\s*"([^"]+)"', html):
        if url.startswith(("http://", "https://", "//", "data:", "#", "mailto:", "tel:")):
            continue
        path = url.split("?")[0].split("#")[0]
        if not path or path == "/":
            continue  # site root, served by index.html
        checked += 1
        if not os.path.exists(path.lstrip("/")):
            missing.append(f"{page} → {url}")

if missing:
    print(f"  \033[31m✗\033[0m {len(missing)} broken reference(s):")
    for m in sorted(set(missing)):
        print(f"      {m}")
    sys.exit(1)
print(f"  \033[32m✓\033[0m {checked} local reference(s) resolve")
PY
  then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi

# ----------------------------------------------------------------
head_ "5. Absolute URLs point at a live deployment"
# ----------------------------------------------------------------
# You already shipped index.html + sitemap.xml referencing an alias that
# 404'd. This catches that class of error offline.
# Capture bare hostnames — the loop prepends the scheme.
HOSTS=$(grep -rhoE 'https://[a-z0-9.-]+\.vercel\.app' \
        index.html app.html assessment.html sitemap.xml robots.txt vercel.json 2>/dev/null \
        | sed 's|^https://||' | sort -u)
if [ -n "$HOSTS" ]; then
  for h in $HOSTS; do
    if [ "${AGMX_SKIP_NET:-0}" = "1" ]; then
      warn "$h (network check skipped)"
      continue
    fi
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$h/" 2>/dev/null)
    rc=$?
    if [ "$rc" -ne 0 ] || [ -z "$code" ] || [ "$code" = "000" ]; then
      bad "$h → unreachable from this network (curl exit $rc)"
    elif [ "$code" = "200" ]; then
      ok "$h → 200"
    else
      bad "$h → HTTP $code (referenced but not serving)"
    fi
  done
else
  warn "no absolute deployment URLs found"
fi

# ----------------------------------------------------------------
head_ "6. PocketBase schema integrity"
# ----------------------------------------------------------------
if [ -f pocketbase/collections.json ]; then
  if python3 - <<'PY'
import json, sys
cols   = json.load(open("pocketbase/collections.json"))
names  = {c["name"] for c in cols}
fails  = []

# Relations must point at a collection that exists (or a PB built-in).
for c in cols:
    for f in c.get("schema", []):
        if f.get("type") == "relation":
            t = f.get("collectionId", "")
            if t and not t.startswith("_pb_") and t not in names:
                fails.append(f"{c['name']}.{f['name']} → unknown collection '{t}'")

# Tenancy boundary: every business table must be org-scoped.
# `federations` deliberately uses ownerOrgId — it is the federation itself,
# and federation_organizations joins child orgs.
ORG_SCOPED = {"organizations", "plans", "compliance_rules"}
ORG_FIELDS = {"organizationId", "ownerOrgId"}
for c in cols:
    if c["name"] in ORG_SCOPED:
        continue
    if not any(f.get("name") in ORG_FIELDS for f in c.get("schema", [])):
        fails.append(f"{c['name']} has no organizationId — tenancy gap")

# Append-only tables must forbid update and delete.
for c in cols:
    if c["name"] in ("votes", "audit_events"):
        if c.get("updateRule") != "" or c.get("deleteRule") != "":
            fails.append(f"{c['name']} is not append-only — votes/audit must be immutable")

if fails:
    for f in fails:
        print(f"  \033[31m✗\033[0m {f}")
    sys.exit(1)
print(f"  \033[32m✓\033[0m {len(cols)} collections — relations, tenancy, append-only OK")
PY
    then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
fi

# ----------------------------------------------------------------
head_ "7. Service worker cache manifest"
# ----------------------------------------------------------------
if [ -f sw.js ]; then
  if python3 - <<'PY'
import re, sys, os
src = open("sw.js").read()
m   = re.search(r"PRECACHE\s*=\s*\[(.*?)\]", src, re.S)
if not m:
    print("  \033[33m!\033[0m no PRECACHE array found"); sys.exit(0)

entries = re.findall(r'"([^"]+)"', m.group(1))
missing = [e for e in entries if e != "/" and not os.path.exists(e.lstrip("/"))]

# Per-deployment config must never be precached: it changes per environment
# and a cached copy would pin a stale Google client id / PocketBase URL.
NEVER_CACHE = {"sw.js"}
def never_cache(f):
    return f in NEVER_CACHE or f.startswith("config.")

# Warn when a top-level script is absent from the precache list.
scripts = {f for f in os.listdir(".") if f.endswith(".js")}
listed  = {e.lstrip("/") for e in entries}
unlisted = sorted(f for f in scripts
                  if f not in listed and not never_cache(f) and os.path.getsize(f) > 0)

if missing:
    print(f"  \033[31m✗\033[0m precache references missing files: {missing}")
    sys.exit(1)
if unlisted:
    print(f"  \033[33m!\033[0m not precached (offline will miss them): {', '.join(unlisted)}")
else:
    print(f"  \033[32m✓\033[0m {len(entries)} precache entries resolve; all runtime scripts cached")
PY
    then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
fi

# ----------------------------------------------------------------
head_ "8. Secrets hygiene"
# ----------------------------------------------------------------
# Nothing that looks like a live credential may be committed.
# The pattern is assembled from fragments so this file does not match itself.
SK_P="sk""_live_"
AK="AK""IA[0-9A-Z]{16}"
PEM="-----BEGIN [A-Z ]*PR""IVATE KEY-----"
JWT="eyJ""hbGciOi[A-Za-z0-9_-]{10,}\."
# This script and its documentation legitimately contain the patterns.
SELF="^tools/check\.sh$|^tools/CHECKS\.md$"

LEAKS=$(git ls-files -z 2>/dev/null \
        | grep -zvE "$SELF" \
        | xargs -0 grep -lIE "($SK_P|$AK|$PEM|$JWT)" 2>/dev/null || true)

if [ -n "$LEAKS" ]; then
  bad "possible secrets in: $(echo "$LEAKS" | tr '\n' ' ')"
  printf '      Review before pushing — if these are false positives, refine the pattern.\n'
else
  ok "no credential patterns in tracked files"
fi

# config.js must never be tracked — it holds per-deployment values.
if git ls-files --error-unmatch config.js >/dev/null 2>&1; then
  bad "config.js is tracked but should be gitignored"
else
  ok "config.js is not tracked"
fi

# ----------------------------------------------------------------
printf '\n\033[1m%s\033[0m\n' "───────────────────────────────────────"
if [ "$FAIL" -gt 0 ]; then
  printf '\033[31m✗\033[0m  %d passed · %d warning(s) · \033[31m%d failed\033[0m\n' "$PASS" "$WARN" "$FAIL"
  exit 1
else
  printf '\033[32m✓ all checks passed\033[0m  (%d passed · %d warning(s))\n' "$PASS" "$WARN"
  exit 0
fi
