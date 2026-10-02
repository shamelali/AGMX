# AGMX — PocketBase Backend

Replaces Supabase. Single Go binary, SQLite, built-in auth + realtime + file
storage, self-hostable for data sovereignty.

---

## Files

| File | Purpose |
|---|---|
| `collections.json` | 31 collection definitions (schema + RLS rules + indexes) |
| `seed.json` | Commercial plans + compliance rules (Akta 1993 / GP14 / UUK / BRule) |
| `../pocketbase-client.js` | Dependency-free PocketBase SDK + AGMX query layer |
| `../login.js` | Login view: Google OAuth2, SMS OTP, role picker, demo mode |
| `../tools/pb_migrate.py` | Creates collections against a running instance, then seeds |
| `../GOOGLE_AUTH_SETUP.md` | Google Cloud Console + PocketBase provider config |

---

## Quick start

```bash
# 1. Get PocketBase
wget https://github.com/pocketbase/pocketbase/releases/download/v0.22.21/pocketbase_0.22.21_linux_amd64.zip
unzip pocketbase_0.22.21_linux_amd64.zip && chmod +x pocketbase

# 2. Start it (first run prints a temp superuser password)
./pocketbase serve --http=127.0.0.1:8090

# 3. Create collections + seed data
python3 tools/pb_migrate.py --url http://127.0.0.1:8090 \
  --email <email> --password <temp-password>

# 4. Configure Google OAuth2 — see GOOGLE_AUTH_SETUP.md

# 5. Point the client at it
cp config.example.js config.js   # then edit url + googleClientId

# 6. Serve the app
python3 -m http.server 8091
# open http://localhost:8091/app.html
```

Admin UI: <http://127.0.0.1:8090/_/>

---

## Tenancy model

`organizationId` on every business collection is the tenancy boundary.
Collection rules enforce isolation in the database, not in JavaScript:

```
listRule:   organizationId = @request.auth.organizationId
createRule: organizationId = @request.auth.organizationId
```

`organizationId` and `role` live on the **auth record** (set in the admin UI
per user) so PocketBase exposes them as `@request.auth.*`.

### Append-only tables

`votes` and `audit_events` have `updateRule: ""` and `deleteRule: ""` — once a
vote is cast or an audit event written, no client can change or remove it.

### Tamper-evident audit chain

`pocketbase-client.js → appendAudit()` computes
`sha256(prev_hash | occurred_at | action | entity_type | entity_id | payload)`
and stores it. Every event links to its predecessor, so altering any historical
record breaks every hash after it.

> Requires HTTPS. On an `http://` origin the WebCrypto API is unavailable and
> the client falls back to a **non-cryptographic** hash, which is logged as
> `weak-<n>`.

---

## Collections

| Group | Collections |
|---|---|
| Identity | `organizations` |
| Members | `members`, `member_status_history` |
| AGM | `agms`, `agm_settings`, `agenda_items`, `candidates`, `agm_notices`, `notice_recipients`, `attendance`, `quorum_snapshots` |
| Governance | `motions`, `votes`, `resolutions`, `questions`, `actions` |
| Compliance | `compliance_rules`, `compliance_checks`, `compliance_findings` |
| Evidence | `documents`, `audit_events` |
| Commercial | `plans`, `subscriptions`, `agm_assessments`, `quotes`, `invoices`, `payments` |
| Distribution | `partners`, `partner_organizations`, `federations`, `federation_organizations` |

Plus the built-in `_pb_users_auth_` collection for accounts.

---

## Demo mode

`config.example.js` ships `demoMode: true`. When PocketBase is unreachable the
app falls back to `data.js` (the KOPEMAJU mock dataset) so the demo keeps
working. **Set `demoMode: false` in production** so a database outage surfaces
as an error rather than silently showing fabricated data.

---

## Deployment

PocketBase is a single binary — deploy it anywhere:

```bash
# Docker
docker run -d -p 8090:8090 \
  -v /srv/agmx-pb/pb_data:/pb/pb_data \
  -e PB_ADMIN_EMAIL=... -e PB_ADMIN_PASSWORD=... \
  pocketbase/pocketbase:latest

# systemd on a VPS
./pocketbase serve --http=127.0.0.1:8090 --dir /srv/agmx-pb/pb_data
```

Put it behind a reverse proxy with TLS. Back up by copying `pb_data/`.

**Data sovereignty:** self-hosting in Malaysia keeps cooperative member records
under local control — relevant for SKM-facing deployments.
