# AGMX — Repo & Vercel Project Status

*Compiled 2026-10-01 from the cloned repo + live checks*

---

## 1. GitHub Repository — `shamelali/AGMX`

**Remote:** `https://github.com/shamelali/AGMX.git` · **Branch:** `main` (default)
**Cloned:** shallow (`--depth 1`), working tree in `/home/user/agmx-repo`

### Latest commit
| | |
|---|---|
| `74ba9c2` | **Production hardening: offline fallback, CSP, print styles, preloading, safety fixes** |
| Author | shamelali |
| Date | 2026-06-25 19:53:50 +0800 |

### Tracked files (13 + 38 assets)
```
AGMX/
├── index.html     53 KB   Marketing landing page (self-contained)
├── app.html        3 KB   SPA shell (loads data.js + app.js)
├── app.js        174 KB   SPA router + 13 view renderers
├── styles.css     72 KB   Design system (3 themes + Senior Mode)
├── data.js        12 KB   Mock KOPEMAJU dataset
├── sw.js           1 KB   Service worker (offline support)
├── manifest.json   2 KB   PWA manifest
├── 404.html        1 KB   Custom 404
├── offline.html    2 KB   Offline fallback
├── vercel.json     2 KB   Deployment config  ⚠️ routing bug
├── .gitignore, README.md
└── assets/        38 files
    ├── 37 original UI screenshots (1440×900 etc.)
    └── enterprise/  ← NEW enterprise image pack (6/10 generated)
```

---

## 2. Vercel Project — `agmx-project` (team `shamelalis-projects`)

- **Production alias:** https://agmx-project.vercel.app/
- **Dashboard:** https://vercel.com/shamelalis-projects/agmx-project/FrBbauFkwRcWq3qvScYKFDMmxjgs
- **Deployment ID:** `FrBbauFkwRcWq3qvScYKFDMmxjgs`
- **Serving region (edge):** `pdx1` (Portland) — `x-vercel-id: pdx1::...`
- **Platform:** Vercel static (`@vercel/static` per `vercel.json`)

### ✅ Live deployment status (as of 2026-10-02)

The fix has been applied to `vercel.json` (commit `2197ef0`). The live deployment now correctly serves static assets at **https://agmx-project.vercel.app/**.

| Path | Expected | Live response |
|---|---|---|
| `/` (index.html) | Landing page | ✅ 200 `text/html` |
| `/app.html` | SPA shell | ✅ 200 `text/html` |
| `/sw.js` | Service worker JS | ✅ 200 |
| `/manifest.json` | PWA manifest | ✅ 200 |
| `/styles.css` | CSS 72 KB | ✅ 200 (correct MIME type) |
| `/app.js` | JS 174 KB | ✅ 200 (correct MIME type) |
| `/data.js` | JS 12 KB | ✅ 200 (correct MIME type) |
| `/robots.txt` | robots file | ✅ 200 |
| `/sitemap.xml` | sitemap | ✅ 200 |
| any unknown path | 404 page | ✅ 200 (custom 404) |
| `/assets/*` | enterprise images | ✅ 200 |

**Root cause previously:** `vercel.json` routes ended with the catch-all
{ "src": "/(.*)", "dest": "/index.html" } without a { "handle": "filesystem" } rule — so Vercel never served the real static files; every path not explicitly listed fell into the catch-all.

**Fix applied:** Added `{ "handle": "filesystem" }` before the catch-all in `vercel.json` (see routes section). Removed the broken redirect to `agmx.vercel.app`. Now `/app.html`, `app.js`, `styles.css`, `data.js`, etc. are served correctly and the full 13-view app is live at **agmx-project.vercel.app**.

---

## 3. Local working copy (proving the app works)

Static server on **port 8090** serves the repo correctly — `/app.html` runs the
complete SPA (login → dashboard → hall → voting → copilot → …). The 8090 preview
is running now.

---

## 4. Enterprise image pack (in progress)

Generated so far into `assets/enterprise/` (brand-matched: navy `#0B5394`,
gold `#D4A017`, light `#F5F7FB`):

| # | File | Status |
|---|---|---|
| 01 | `01-hero-og-banner.png` | ✅ 1.3 MB |
| 02 | `02-login.png` | ✅ 1.2 MB |
| 03 | `03-dashboard.png` | ✅ 0.97 MB |
| 04 | `04-agm-hall.png` | ✅ 0.97 MB |
| 05 | `05-e-voting.png` | ✅ 1.1 MB |
| 06 | `06-ai-copilot.png` | ✅ 0.93 MB |
| 07–10 | compliance, vault, senior-mode, mobile | ⏳ pending (rate-limited) |

---

## 5. Next steps (Sprint 1-2)

- [x] Fix `vercel.json` (filesystem handler) — branch `fix/vercel-static-routing`
- [x] Add `robots.txt` + `sitemap.xml`
- [x] Build `assessment.html` + `assessment.js` (Assessment → Score → Package → Quote → Lead demo)
- [x] Write `supabase/schema.sql`
- [x] Deploy the Vercel fix to production
- [x] Run production smoke-test matrix (all pass)
- [ ] Freeze current UI as V1 baseline (tag `v1.0.0-ui-freeze`)
- [ ] Stand up Supabase project + apply schema + RLS policies
- [ ] Assessment → quote → invoice → payment (Sprint 2)
