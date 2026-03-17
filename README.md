# Production Company MicroServices — Usage Guide

---

## Table of Contents

1. [Project Goal](#1-project-goal)
2. [Architecture](#2-architecture)
   - [2.1 Logical architecture](#21-logical-architecture)
   - [2.2 Two-stack design](#22-two-stack-design)
   - [2.3 Repository structure](#23-repository-structure)
3. [Prerequisites](#3-prerequisites)
   - [3.1 Runtime](#31-runtime-to-run-the-stack)
   - [3.2 Backend development](#32-development-to-edit-backend-services)
   - [3.3 Frontend development](#33-development-to-edit-frontends)
   - [3.4 External systems](#34-external-systems-required)
4. [First Install](#4-first-install-new-machine)
5. [Makefile Reference](#5-makefile-reference)
6. [Service Restart After Code Changes](#6-service-restart-after-code-changes)
7. [Gateway Routes and Service Ports](#7-gateway-routes-and-service-ports)
8. [Frontend Usage](#8-frontend-usage)
   - [8.1 admin-ui](#81-admin-ui-port-5176)
   - [8.2 sap-sync-ui](#82-sap-sync-ui-port-5173)
   - [8.3 sap-map-ui](#83-sap-map-ui-port-5174)
   - [8.4 binpack-ui](#84-binpack-ui-port-5175)
   - [8.5 live-labeling-ui](#85-live-labeling-ui-port-5178)
9. [SAP B1 Sync Flow](#9-sap-b1-sync-flow-summary)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Project Goal

Build a **full-stack enterprise microservice platform** for Production Company that:

- Connects to **SAP B1** via Service Layer (VPN-gated) — pulls query results into MSSQL
- Provides a **Query Builder** UI where operators design and save SAP SQL queries
- Syncs query data on demand or on schedule into a **MSSQL ReportingDB**
- Manages users, roles, and per-service permissions via a **JWT auth service**
- Stores and serves **files** (images, PDFs, spreadsheets) via a dedicated file service
- Allows print-ready **label design** (Konva canvas → ZPL → CAB SQUIX printer)
- Runs **3D bin-packing** optimization for logistics
- Displays SAP data on **interactive maps**
- All frontends talk only to a central **Traefik API gateway** — never directly to services

---

## 2. Architecture

### 2.1 Logical architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend layer  (Vite / React / MUI — each on its own dev port)    │
│                                                                     │
│  admin-ui      :5176   User & permission management                 │
│  sap-sync-ui   :5173   Query Builder + SAP B1 sync trigger          │
│  sap-map-ui    :5174   SAP data on Leaflet map                      │
│  binpack-ui    :5175   3D bin-packing                               │
│  live-labeling-ui :5178  Label designer (Konva + ZPL print)         │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTP → http://localhost (Traefik :80)
                             ▼
              ┌──────────────────────────┐
              │   API Gateway — Traefik  │  :80 (routes)  :8080 (dashboard)
              └──────┬───────────────────┘
                     │  path-based routing
   ┌─────────────────┼──────────────────────────────────────────┐
   │                 │                  │                        │
   ▼                 ▼                  ▼                        ▼
/auth           /sap              /labeling             /binpack
auth-service    sap-b1-adapter    labeling-service      binpack-service
(PostgreSQL)    -service          (no DB)               (no DB)
                (MSSQL)

   Also routed: /files → file-service (PostgreSQL + local storage)
                /maps  → maps-service
                /orders /inventory /reporting /sensor  (stub services)

┌─────────────────────────────────┐
│  Infrastructure stack           │
│  infrastructure/mssql/          │
│  mssql_server  (azure-sql-edge) │
│  port 1433, volume sql_data     │
│  Owns: db_net Docker network    │
└─────────────────────────────────┘
         ▲
         │ external network join
         │
┌─────────────────────────────────┐
│  App stack (docker-compose.yml) │
│  Traefik, auth-service,         │
│  postgres-auth, postgres-files, │
│  sap-b1-adapter-service,        │
│  file-service, binpack-service, │
│  labeling-service, maps-service,│
│  rabbitmq, prometheus, loki,    │
│  promtail, grafana              │
└─────────────────────────────────┘
```

### 2.2 Two-stack design

Two independent Docker Compose stacks share the `db_net` Docker network:

| Stack | File | What it owns |
|---|---|---|
| Infrastructure | `infrastructure/mssql/docker-compose.yml` | `mssql_server`, `db_net` network, `sql_data` volume |
| App | `docker-compose.yml` | All services, all internal PostgreSQL DBs, monitoring |

**Why two stacks?** `make down -v` (or `docker compose down -v`) on the app stack resets app data (auth users, etc.) without touching MSSQL. MSSQL can be upgraded or restarted independently.

### 2.3 Repository structure

```
MicroServices/
├── services/
│   ├── auth-service/              # JWT auth, user CRUD, role permissions (PostgreSQL)
│   ├── sap-b1-adapter-service/    # SAP B1 Service Layer → MSSQL sync
│   ├── file-service/              # File upload / serve (PostgreSQL + local storage)
│   ├── binpack-service/           # 3D bin-packing optimizer
│   ├── labeling-service/          # ZPL print endpoint (CAB SQUIX)
│   ├── maps-service/              # Map data backend
│   ├── orders-service/            # stub
│   ├── inventory-service/         # stub
│   ├── reporting-service/         # stub
│   └── sensor-ingest-service/     # stub
├── frontend/
│   ├── admin-ui/                  # User mgmt, permissions, files, charts
│   ├── sap-sync-ui/               # Query Builder + SAP sync jobs
│   ├── sap-map-ui/                # Leaflet map view of SAP data
│   ├── binpack-ui/                # 3D bin-pack UI
│   └── live-labeling-ui/          # Label designer (Konva canvas + ZPL)
├── infrastructure/
│   └── mssql/
│       ├── docker-compose.yml     # MSSQL infra stack
│       └── init.sql               # ReportingDB schema
├── api-gateway/
│   └── traefik/
│       ├── traefik.yml            # Traefik static config
│       └── dynamic.yml            # Path routing rules
├── shared/
│   └── python_common/             # CommonSettings, metrics_router (shared across all services)
├── monitoring/                    # Prometheus, Loki, Promtail, Grafana configs
├── docker-compose.yml             # App stack
├── Makefile                       # All orchestration commands
└── .env                           # Local secrets — never commit
```

---

## 3. Prerequisites

### 3.1 Runtime (to run the stack)

| Tool | Version | Notes |
|---|---|---|
| **Colima** | latest | Docker runtime for macOS (`brew install colima`) |
| **Docker** | 29+ | Bundled with Colima |
| **Docker Compose** | v2 | Bundled with Docker |
| **make** | any | Pre-installed on macOS |
| **OpenVPN** | any | Required for SAP B1 VPN connection |

> **Mac M1/M2/M3:** All images are built `linux/arm64` — no extra flags needed.

### 3.2 Development (to edit backend services)

| Tool | Version | Notes |
|---|---|---|
| **Python** | 3.14 | Matches what Dockerfiles use |
| **pip / venv** | bundled | Each service has its own `requirements.txt` |
| **pyodbc** | latest | Required by sap-b1-adapter-service (`brew install unixodbc`) |
| **ODBC Driver 18** | latest | MS ODBC driver for MSSQL — install separately |

### 3.3 Development (to edit frontends)

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | 22+ LTS | All frontends use Vite |
| **pnpm** | 10+ | `npm install -g pnpm` or `brew install pnpm` |

Frontend tech stack (consistent across all UIs):
- React 19 + TypeScript
- Vite
- MUI (Material UI) v6
- Redux Toolkit + React Redux
- React Router v7
- axios
- react-toastify

### 3.4 External systems required

| System | What uses it |
|---|---|
| **MSSQL** (Docker container) | sap-b1-adapter-service writes SAP query results |
| **SAP B1 Service Layer** | sap-b1-adapter-service pulls data (VPN required) |
| **CAB SQUIX printer** | labeling-service prints ZPL labels |
| **PostgreSQL** (per-service, in Docker) | auth-service, file-service internal DBs |

---

## 4. First Install (new machine)

### Step 1 — Start Colima

```bash
colima start
docker context use colima   # only needed once
docker version              # verify
```

> If you see `Cannot connect to the Docker daemon` → `colima start && docker context use colima`.

### Step 2 — Clone / navigate to repo

```bash
cd ~/dev/MicroServices
```

### Step 3 — Create `.env`

```bash
cp .env.example .env
```

Edit `.env` — fill in all required values:

```dotenv
# PostgreSQL (internal app DBs)
POSTGRES_PASSWORD=<SuperSecret>

# JWT — change in production (min 32 chars)
JWT_SECRET=<SuperSecret>

# Bootstrap admin user (auto-created on first start)
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=<SuperSecret>

# SAP B1 Service Layer (requires OpenVPN)
SAP_B1_SERVICE_LAYER_URL=https://<SAP host ip>:50000/b1s
SAP_B1_COMPANY_DB=test_DB
SAP_B1_USERNAME=<sap_username>
SAP_B1_PASSWORD=<SuperSecret>

# MSSQL ReportingDB
DST_SQL_SERVER=mssql_server,1433
DST_SQL_DB=ReportingDB
DST_SQL_USER=sa
DST_SQL_PASSWORD=<SuperSecret>
MSSQL_SA_PASSWORD=<SuperSecret>
```

> Do **not** add inline comments (`# ...`) after values — Docker Compose includes them in the value.

### Step 4 — Start MSSQL infrastructure

```bash
make infra-up
```

This starts `mssql_server` (azure-sql-edge, port 1433) and creates the `db_net` Docker network.

Expected output:
```
Starting MSSQL infrastructure...
 Container mssql_server  Started
Waiting for SQL Server to accept connections...
MSSQL is up.
```

### Step 5 — Start core app services

```bash
make up-core
```

Starts: Traefik + auth-service + postgres-auth. Verify:

```bash
curl http://localhost/auth/health
# {"status":"ok","service":"auth-service"}
```

### Step 6 — Initialize MSSQL schema (first time only)

```bash
make up-sap
make infra-init
```

Creates `ReportingDB` and all tables: `logs_SyncJobs`, `wrk_QueryDef`, `wrk_TableDesc`, etc.

### Step 7 — Start all services

```bash
make up
```

### Step 8 — Install frontend dependencies

```bash
make fe-install
```

This runs `pnpm install` from the repo root — the `pnpm-workspace.yaml` installs all five frontends at once.

---

## 5. Makefile Reference

### Infrastructure

```bash
make infra-up      # Start MSSQL + create db_net network
make infra-init    # Create ReportingDB schema (first time only — needs up-sap first)
make infra-down    # Stop MSSQL (data preserved)
make infra-reset   # Stop MSSQL + delete volume (WIPES DB)
```

### App services

```bash
make up            # Build + start all app services (detached)
make up-core       # Start traefik + auth-service + postgres-auth only
make up-sap        # Start sap-b1-adapter-service only
make up-binpack    # Start binpack-service only
make up-labeling   # Start labeling-service only
make down          # Stop app services (data preserved)
make down-all      # Stop app + infra (data preserved)
make reset         # FULL WIPE — deletes all volumes, restarts everything
```

### Observation

```bash
make logs          # Follow all app logs
make ps            # Show running containers (both stacks)
```

### Frontend dev servers

```bash
make fe-install    # pnpm install (workspace — installs all frontends at once)
make fe-sap        # Start sap-sync-ui dev server (:5173)
make fe-map        # Start sap-map-ui dev server (:5174)
make fe-binpack    # Start binpack-ui dev server (:5175)
make fe-admin      # Start admin-ui dev server (:5176)
make fe-labeling   # Start live-labeling-ui dev server (:5178)
```

### Local backend dev (no Docker)

```bash
make dev-auth      # Run auth-service with uvicorn on :8002
make dev-sap       # Run sap-b1-adapter-service with uvicorn on :8003
make dev-labeling  # Run labeling-service with uvicorn on :8001
```

Use `fe-sap-dev` / `fe-binpack-dev` to point the frontend proxy at local dev servers instead of Docker.

---

## 6. Service Restart After Code Changes

Backend services have **no volume mount** — source code is baked into the Docker image.
After any code change you must **rebuild** the image:

```bash
# Rebuild + restart a single service
docker compose up -d --build sap-b1-adapter-service
docker compose up -d --build auth-service
docker compose up -d --build labeling-service
docker compose up -d --build file-service

# Or rebuild everything
make up
```

> `docker compose restart <service>` does **not** pick up code changes — it only restarts the existing container.

Frontends run with Vite hot-module replacement — no restart needed during dev.

---

## 7. Gateway Routes and Service Ports

All production traffic goes through Traefik at `http://localhost`.

| Service | Gateway path | Internal port |
|---|---|---|
| auth-service | `http://localhost/auth/...` | 8000 |
| sap-b1-adapter-service | `http://localhost/sap/...` | 8000 |
| file-service | `http://localhost/files/...` | 8000 |
| labeling-service | `http://localhost/labeling/...` | 8000 |
| binpack-service | `http://localhost/binpack/...` | 8000 |
| maps-service | `http://localhost/maps/...` | 8000 |

### Monitoring

| Tool | URL | Default login |
|---|---|---|
| Traefik dashboard | http://localhost:8080 | — |
| RabbitMQ management | http://localhost:15672 | guest / guest |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3000 | admin / admin |

---

## 8. Frontend Usage

### 8.1 admin-ui (port 5176)

**Purpose:** User management, role permissions, file manager, charts.

**Start:**
```bash
make fe-admin
# Open: http://localhost:5176
```

**Features:**

| Section | Path | Roles |
|---|---|---|
| Dashboard | `/dashboard` | all |
| My Account | `/account` | all |
| User List | `/users/list` | admin+ |
| Permissions Editor | `/users/permissions` | superadmin (edit), others read-only |
| File Manager | `/files/files1`, `/files/files2` | admin+ |
| Bar Chart | `/charts/barchart` | all |
| Ridgeline Chart | `/charts/ridgeline` | all |

**Role hierarchy:** `superadmin > admin > operator > viewer`
- Same-rank users can edit each other; cannot promote above own rank
- Superadmin can always edit their own account

**Per-service roles:** Users can have a different role per service (e.g., `operator` globally but `admin` for SAP sync). Set in User List → edit user.

---

### 8.2 sap-sync-ui (port 5173)

**Purpose:** Design SAP B1 SQL queries, trigger syncs, view job history.

**Start:**
```bash
make fe-sap
# Open: http://localhost:5173
```

**Requires:** OpenVPN connected to SAP B1 server for any sync or preview operation.

**Features:**

#### Query Builder (`/querys/builder`)

1. Enter a **Query Name** (max 20 characters — SAP B1 SqlCode limit).
2. Enter a **Target Table** (MSSQL table name where results will be written; leave empty for Excel-only export).
3. Select the **Service** this query belongs to.
4. Write the **original SQL** in the text area.
   - Use any T-SQL: bracket notation `[X]`, `CAST`, `CONCAT`, `YEAR/MONTH`, arithmetic expressions — the preprocessor handles all of it.
5. Click **Save query** → the backend preprocesses the SQL into a SAP B1-compatible version and saves it.
6. The **SAP B1-compatible query** (generated) and **Computed columns** are shown below.

**SQL preprocessor transforms (automatic):**
- Strips bracket notation: `[OITW]` → `OITW`, `[ItemCode]` → `ItemCode`
- Strips `CAST(X AS TYPE)` → `X`
- Strips sized types: `VARCHAR(50)` → `VARCHAR`
- Strips SQL comment lines (`-- ...`)
- Converts `CONCAT(YEAR(X), '-', RIGHT(...MONTH(X)...), 2))` → Python-computed `YearMonth` column
- Auto-aliases ambiguous `Table.Column` → `Table.Column AS Column`
- Removes arithmetic expressions from SQL; computes them in Python after fetch

#### Query List (`/querys/list`)

- Shows all active queries.
- Click **Edit** to modify a query (re-runs preprocessor on save).
- Click **Delete** to soft-delete (sets `is_active = 0`).

#### Sync Jobs / Run Sync

- Select a saved query and trigger a sync → SAP B1 data is fetched and written to the MSSQL target table.
- Job log (start time, row count, status, error) is saved to `logs_SyncJobs`.

---

### 8.3 sap-map-ui (port 5174)

**Purpose:** Display SAP B1 query results on an interactive Leaflet map.

**Start:**
```bash
make fe-map
# Open: http://localhost:5174
```

---

### 8.4 binpack-ui (port 5175)

**Purpose:** 3D bin-packing optimization — input items and container, get visual 3D layout.

**Start:**
```bash
make fe-binpack
# Open: http://localhost:5175
```

---

### 8.5 live-labeling-ui (port 5178)

**Purpose:** Design print labels visually on a Konva canvas, then send ZPL to a CAB SQUIX printer.

**Start:**
```bash
make fe-labeling
# Open: http://localhost:5178
```

**Login:** Same JWT credentials as other frontends (auth-service).

**Features:**

| Control | Description |
|---|---|
| Label size selector | Choose label dimensions (4"×6", 4"×4", 2"×1", etc.) |
| **T** Text | Add a text element; edit value, font size, bold in Properties panel |
| **Image** | Add an image element; pick file → uploaded as base64 |
| **Barcode** | Add Code 128 barcode; edit value in Properties panel |
| **QR** | Add QR code (always square); edit URL/value |
| **DataMatrix** | Add DataMatrix code (always square) |
| **Transformer** | Drag to move, drag handles to resize; rotation supported |
| **Delete key** | Removes selected element |
| **ZPL Preview tab** | Shows generated ZPL string from current canvas state |
| **Print** | POSTs ZPL to `/labeling/print` → CAB SQUIX printer |

**Designer notes:**
- Canvas dimensions update live when label size changes.
- Barcode height reflects the rendered height from bwip-js (calibrated to real printer output).
- QR and DataMatrix elements are always constrained to square.
- Elements are rendered in Konva (no browser print dialog — pure ZPL to printer).

---

## 9. SAP B1 Sync Flow (summary)

```
1. User designs SQL in Query Builder
        ↓
2. Backend preprocesses SQL → saves to wrk_QueryDef (MSSQL)
        ↓
3. User triggers Sync (sap-sync-ui)
        ↓
4. sap-b1-adapter-service checks VPN reachability
        ↓
5. Logs into SAP B1 Service Layer
        ↓
6. If query doesn't exist in SAP B1: auto-creates it via POST /SQLQueries
        ↓
7. Executes query via POST /SQLQueries('{code}')/List  (with pagination)
        ↓
8. Writes rows to MSSQL target table (auto-created if missing)
        ↓
9. Updates logs_SyncJobs (status, row count, duration)
```

**SAP B1 constraints handled automatically:**
- SqlCode max 20 characters (validated in frontend + backend)
- No bracket-quoted identifiers `[X]`
- No `CAST(X AS TYPE)`
- No `YEAR/MONTH` in GROUP BY / ORDER BY
- No sized type specifiers like `VARCHAR(50)`
- Column ambiguity in JOINs requires explicit `AS` aliases

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot connect to Docker daemon` | Colima not running or wrong context | `colima start && docker context use colima` |
| `network db_net not found` | Infra stack not started | `make infra-up` |
| Bootstrap admin not created | `BOOTSTRAP_ADMIN_PASSWORD` empty in `.env` | Set password, restart auth-service |
| `401 Unauthorized` on login | Wrong password or user missing | Check `.env`, or `docker compose down -v && make up` |
| MSSQL login failed (18456) | Stale volume with old SA password | `make infra-reset && make up-sap && make infra-init` |
| SAP sync returns 503 | VPN not connected | Connect OpenVPN, retry |
| SAP sync 400 — "Invalid SQL syntax" | Bracket notation or CAST in query SQL | Re-save query in Query Builder (preprocessor will strip them) |
| SAP sync 400 — "SqlCode too long" | Query name > 20 chars | Rename in Query Builder |
| SAP sync 500 — MSSQL error | Schema not initialized | `make infra-init` |
| Port 80 in use | Another process on :80 | `sudo lsof -i :80` → stop it |
| Frontend shows old version | Docker has old image | `docker compose up -d --build <service>` |
| `restart` didn't apply code changes | No volume mount; code baked into image | Use `docker compose up -d --build <service>` |
