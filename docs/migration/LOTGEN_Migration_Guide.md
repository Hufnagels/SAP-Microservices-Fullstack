# LOTGEN Migration Guide

**Scope:** Two related things:
1. Syncing ongoing development from the **standalone** `LOTGEN` project
   (`/Users/pisti/My Projects.local/dev/BRD/LOTGEN`) into this monorepo's
   `services/lotgen-service` + `frontend/lotgen-ui`.
2. Deploying the lotgen module to the production LXC (already live — see
   [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)).

---

## Table of Contents

1. [Why Two Copies Exist](#1-why-two-copies-exist)
2. [What's Different Between Them](#2-whats-different-between-them)
3. [Dev Sync — Standalone LOTGEN → MicroServices](#3-dev-sync--standalone-lotgen--microservices)
4. [Production Deploy](#4-production-deploy)
5. [Post-Deploy Verification](#5-post-deploy-verification)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Why Two Copies Exist

`LOTGEN` started as a standalone project (own `docker-compose.yml`, own local
JSON/SQL auth, own dev backend port `8001`). It was later folded into this
monorepo as `services/lotgen-service` + `frontend/lotgen-ui`, adapted to:

- authenticate via the shared `auth-service` (JWT) instead of its own login,
- build through the monorepo's Docker context / `Dockerfile` conventions,
- route through Traefik (`PathPrefix('/lot')`, already in
  `api-gateway/traefik/dynamic.yml`) and through `lotgen-ui`'s `nginx.conf`
  instead of hitting `localhost:8001` directly.

Development on LOT-generator features still happens in the standalone
`LOTGEN` checkout. Periodically those changes need to be pulled into this
repo — that's what §3 covers.

---

## 2. What's Different Between Them

| File | Standalone LOTGEN | This repo (lotgen-service / lotgen-ui) |
|---|---|---|
| `app/routes/auth.py` | Local JSON/SQL login, issues its own JWT | **Does not exist** — auth-service issues the JWT |
| `app/database.py` | Has a `users` table + `get_user()` | No `users` table — auth handled elsewhere |
| `app/main.py` | Registers `auth_router` | Does not |
| `app/settings.py` | `postgres_url`/`labeling_url` point at `localhost` dev ports; has `auth_source`/`users_file` | Points at container hostnames (`postgres-lot`, `labeling-service`); no local-auth settings |
| `Dockerfile` | `COPY requirements.txt .` (context = `backend/`) | `COPY services/lotgen-service/requirements.txt ...` (context = repo root, per [Adding_a_Service.md](../Adding_a_Service.md) convention) |
| `src/hooks/useAuth.ts` | `AUTH_URL = 'http://localhost:8001/auth'` | `AUTH_URL = '/auth'` (relative — nginx proxies to Traefik) |
| `src/hooks/useLotStore.ts`, `PrefixLastNumbers.tsx` | `API = 'http://localhost:8001'` | `API = ''` (relative) |
| everything else (`lot_format.py`, `routes/lot.py`, `security.py`, most of `src/`) | — | identical / safe to overwrite |

`security.py` is identical in both — it already only validates a JWT against
`JWT_SECRET`, it doesn't care who issued it. That's what makes the shared-auth
adaptation possible without touching that file.

---

## 3. Dev Sync — Standalone LOTGEN → MicroServices

Use the script — it encodes exactly the rules in §2:

```bash
bash docs/migration/scripts/sync-lotgen.sh
# or with an explicit source path:
bash docs/migration/scripts/sync-lotgen.sh "/path/to/LOTGEN"
```

What it does:

1. **Backend — safe files** (`lot_format.py`, `routes/lot.py`, `security.py`,
   `requirements.txt`): copied over verbatim.
2. **Backend — review files** (`database.py`, `main.py`, `settings.py`,
   `Dockerfile`): **never auto-copied**. The script prints a diff; merge the
   new bits (e.g. a new column, a new business-logic function) by hand while
   keeping the shared-auth/container-hostname/build-context lines from the
   right column of the table above.
3. **`routes/auth.py`**: never copied — this repo doesn't use it.
4. **Frontend**: mirrors `LOTGEN/frontend/src/` → `frontend/lotgen-ui/src/`
   wholesale (`rsync --delete`), then patches known `localhost:8001` literals
   back to relative paths, then greps for any *other* hardcoded `localhost:PORT`
   the patch didn't anticipate (new features sometimes add their own — review
   and fix those by hand, same pattern as the existing patches).
   `Dockerfile` / `nginx.conf` / `.dockerignore` / `vite.config.ts` /
   `package.json` live outside `src/` and are untouched by the sync.

After running it:

```bash
# 1. Merge any flagged backend diffs by hand into services/lotgen-service/

# 2. Typecheck the frontend
cd frontend/lotgen-ui && npx tsc --noEmit
# If this fails with `Cannot find module '../lib/tsc.js'` or similar,
# node_modules has stale/broken symlinks — see §6.

# 3. Rebuild and smoke test locally
cd ../..
docker compose up -d --build postgres-lot lotgen-service lotgen-ui
curl http://localhost/lot/health
```

If `package.json` dependencies changed on the LOTGEN side, `npm install`
inside `frontend/lotgen-ui` after the sync.

---

## 4. Production Deploy

Lotgen is **already fully wired** into the production stack — no lotgen-specific
deploy step exists beyond the standard flow:

- `services/lotgen-service` has its own `Dockerfile`, is a normal
  `docker-compose.yml` service (`lotgen-service`, `postgres-lot`)
- `frontend/lotgen-ui` has `Dockerfile` + `nginx.conf`, is in `docker-compose.yml`
  mapped to host port **5177** (same pattern as every other frontend)
- `api-gateway/traefik/dynamic.yml` already routes `PathPrefix('/lot')` →
  `lotgen-service`
- `docs/migration/scripts/deploy.sh` rsyncs the whole repo — lotgen goes along
  for free, nothing lotgen-specific to configure there
- `docs/migration/MIGRATION_SUMMARY.md` already lists `lotgen-ui` in the
  service-URL table and `pg-lot` in the data-directory recovery list

So deploying lotgen changes to production is just the standard flow:

```bash
# From the Mac
bash docs/migration/scripts/deploy.sh

# On the LXC
ssh <user>@10.63.10.111
cd /opt/microservices
sudo docker compose up -d --build
```

**One gap this guide fixes:** `docs/migration/scripts/lxc-setup.sh` (used only
for bootstrapping a **fresh** LXC from scratch) was missing `pg-lot` from its
`mkdir -p .../data/{...}` list — `MIGRATION_SUMMARY.md`'s manual recovery
steps already had it, the bootstrap script didn't. Fixed as part of this
change; if you bootstrapped an LXC before this fix, create the dir by hand:

```bash
sudo mkdir -p /opt/microservices/data/pg-lot
```

---

## 5. Post-Deploy Verification

Whether local or on the LXC (swap `localhost` for the LXC IP):

```bash
# 1. Backend health
curl http://localhost/lot/health
# → {"status":"ok","service":"lotgen-backend"}

# 2. Login via shared auth-service
TOKEN=$(curl -s -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your_password>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 3. Generate a LOT number
curl -s -X POST http://localhost/lot/generate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"prefix":"TM1","date_format":"YYMMDD","separator":"-","seq_digits":4,"suffix":"","quantity":1,"label_size":"70x37","zpl_list":[]}'

# 4. Confirm it shows up in history and "last per prefix"
curl -s "http://localhost/lot/history?limit=5" -H "Authorization: Bearer $TOKEN"
curl -s http://localhost/lot/last -H "Authorization: Bearer $TOKEN"

# 5. UI
open http://localhost:5177   # or http://10.63.10.111:5177 on the LXC
```

Expect a clean login, a barcode preview, the counter incrementing, and the
generated item appearing in the "Generált számok" list. No console errors.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `npx tsc` fails with `Cannot find module '../lib/tsc.js'` | `node_modules/.bin` has broken/copied (non-symlink) binaries — happens if `node_modules` was ever populated via `cp -R` instead of `npm install` | `rm -rf frontend/lotgen-ui/node_modules && cd frontend/lotgen-ui && npm install` |
| Login/generate calls 404 when running raw `npm run dev` on port 5177 | `vite.config.ts` has no dev-mode API proxy (`/auth`, `/lot`) — unlike `admin-ui`/`live-labeling-ui` | Test via the built container instead: `docker compose up -d --build lotgen-ui`, hit `http://localhost:5177` (nginx proxies `/auth`,`/lot` → Traefik). Add a Vite proxy if you specifically need hot-reload dev mode. |
| `PrefixLastNumbers` panel never appears in the UI | Component exists but isn't imported into `App.tsx` — true in the standalone LOTGEN source too, not a sync bug | Wire it into `App.tsx` if you want it rendered; otherwise harmless dead code |
| Monthly counter reset hard to verify live | Reset only triggers when `updated_at.year/month` differs from today — can't be forced without DB time travel | Reviewed by code inspection (`app/database.py::get_counter`); to force-test, manually backdate `lot_counters.updated_at` in `postgres-lot` |
| Backend `settings.py`/`database.py`/`main.py` sync overwrites the shared-auth adaptation | Ran a raw `cp` instead of `sync-lotgen.sh` | Never `cp` those 4 files directly from LOTGEN — always go through the script, which flags them for manual merge instead |
