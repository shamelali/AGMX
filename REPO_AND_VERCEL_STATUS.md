# AGMX — Repo & Vercel Project Status

*Compiled 2026-08-12 from the cloned repo + live checks*

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

### ❌ What the live deployment actually returns (verified today)

| Path | Expected | Live response |
|---|---|---|
| `/` (index.html) | Landing page | ✅ 200 `text/html` (matches repo) |
| `/app.html` | SPA shell | ✅ 200 `text/html` (matches repo) |
| `/sw.js` | Service worker JS | ✅ 200 (matches repo) |
| `/manifest.json` | PWA manifest | ✅ 200 (matches repo) |
| `/styles.css` | **CSS 72 KB** | ❌ 200 but **returns index.html** (`text/html`) |
| `/app.js` | **JS 174 KB** | ❌ 200 but **returns index.html** |
| `/data.js` | **JS 12 KB** | ❌ 200 but **returns index.html** |
| `/robots.txt` | robots file | ❌ 200 but **returns index.html** |
| `/sitemap.xml` | sitemap | ❌ 200 but **returns index.html** |
| any unknown path | 404 page | ❌ 200 but **returns index.html** |

**Root cause:** `vercel.json` routes end with the catch-all
`{ "src": "/(.*)", "dest": "/index.html" }` and there is **no
`{ "handle": "filesystem" }` rule** — so Vercel never serves the real static
files; every path not explicitly listed falls into the catch-all.

**Net effect:** the SPA (`app.html`) loads an empty page on the live site; the
whole application is invisible. The repo itself is healthy.

### ✅ The fix (ready in repo as `vercel.json.fixed`)

```json
"routes": [
  { "src": "/app", "dest": "/app.html" },
  { "src": "/app.html", "dest": "/app.html" },
  ...
  { "handle": "filesystem" },          ← ADD THIS before the catch-all
  { "src": "/(.*)", "dest": "/index.html" }
]
```

Deploy that → `/app.html`, `app.js`, `styles.css`, `data.js`, 404 all work and
the full 13-view app goes live immediately.

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
