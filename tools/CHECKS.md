# AGMX — Repository Checks

`tools/check.sh` runs eight validation passes over the repo. No dependencies
beyond `node` and `python3`.

```bash
./tools/check.sh              # full run (includes live host probe)
AGMX_SKIP_NET=1 ./tools/check.sh   # skip network probe — for CI/offline
```

Exit code is non-zero on the first failing pass, so it works as a pre-commit
hook and as a CI step.

## Install as a pre-commit hook

```bash
printf '%s\n' '#!/bin/sh' 'AGMX_SKIP_NET=1 bash tools/check.sh || exit 1' \
  > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

Or symlink: `ln -sf ../../tools/check.sh .git/hooks/pre-commit`

## What each pass covers

| # | Pass | Guards against |
|---|---|---|
| 1 | JavaScript syntax | Typos that blank out `app.js` / `login.js` at runtime |
| 2 | JSON + XML validity | Malformed `vercel.json` / `manifest.json` breaking deploys |
| 3 | Vercel routing invariants | The `{"handle": "filesystem"}` route moving after the catch-all — the bug that made every asset resolve to `index.html` |
| 4 | HTML asset references | `<script src>` / `<link href>` pointing at files that don't exist |
| 5 | Live host probe | Absolute URLs referencing a Vercel alias that isn't serving (social cards + `robots.txt` pointed at a 404 domain) |
| 6 | PocketBase schema integrity | Dangling relations, tenancy gaps on business tables, and `votes`/`audit_events` losing append-only protection |
| 7 | Service worker precache | Missing files in `PRECACHE`, and runtime scripts absent from it |
| 8 | Secrets hygiene | Credential patterns in tracked files; `config.js` being committed |

## Design notes

- **`config.*` is deliberately never precached** — it varies per environment, and a
  cached copy would pin a stale Google client ID or PocketBase URL.
- **Pass 5 needs outbound network.** CI sets `AGMX_SKIP_NET=1` and reports it as a
  warning rather than silently passing.
- **Pass 6 treats `federations` correctly** — it uses `ownerOrgId`, not
  `organizationId`, because a federation *is* the tenant.

## GitHub Actions

`.github/workflows/check.yml` just calls this script, so local and CI run
identical checks.

Committing that file requires your git token to carry the **`workflow` scope**.
Until it does, the pre-commit hook gives you the same protection locally. To fix:

```bash
# SSH (no token scope limits)
git remote set-url origin git@github.com:shamelali/AGMX.git

# or a PAT created with `workflow` checked
git remote set-url origin https://<PAT>@github.com/shamelali/AGMX.git
```
