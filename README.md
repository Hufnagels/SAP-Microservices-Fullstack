# Production Company MicroServices — Usage Guide

---

## Table of Contents

- [Production Company MicroServices — Usage Guide](#production-company-microservices--usage-guide)
  - [Table of Contents](#table-of-contents)
  - [1. Project Goal](#1-project-goal)
  - [2. Architecture](#2-architecture)
    - [2.1 Logical architecture](#21-logical-architecture)
    - [2.2 Two-stack design](#22-two-stack-design)
    - [2.3 Repository structure](#23-repository-structure)
  - [3. Prerequisites](#3-prerequisites)
    - [3.1 Runtime (to run the stack)](#31-runtime-to-run-the-stack)
    - [3.2 Development (to edit backend services)](#32-development-to-edit-backend-services)
    - [3.3 Development (to edit frontends)](#33-development-to-edit-frontends)
    - [3.4 External systems required](#34-external-systems-required)
  - [4. First Install (new machine)](#4-first-install-new-machine)
    - [Step 1 — Start Colima](#step-1--start-colima)
    - [Step 2 — Clone / navigate to repo](#step-2--clone--navigate-to-repo)
    - [Step 3 — Create `.env`](#step-3--create-env)
    - [Step 4 — Start MSSQL infrastructure](#step-4--start-mssql-infrastructure)
    - [Step 5 — Start core app services](#step-5--start-core-app-services)
    - [Step 6 — Initialize MSSQL schema (first time only)](#step-6--initialize-mssql-schema-first-time-only)
    - [Step 7 — Start all services](#step-7--start-all-services)
    - [Step 8 — Install frontend dependencies](#step-8--install-frontend-dependencies)
  - [5. Makefile Reference](#5-makefile-reference)
    - [Infrastructure](#infrastructure)
    - [App services](#app-services)
    - [Observation](#observation)
    - [Frontend dev servers](#frontend-dev-servers)
    - [Local backend dev (no Docker)](#local-backend-dev-no-docker)
  - [6. Service Restart After Code Changes](#6-service-restart-after-code-changes)
  - [7. Gateway Routes and Service Ports](#7-gateway-routes-and-service-ports)
    - [Monitoring](#monitoring)
  - [8. Frontend Usage](#8-frontend-usage)
    - [8.1 admin-ui (port 5176)](#81-admin-ui-port-5176)
    - [8.2 sap-sync-ui (port 5173)](#82-sap-sync-ui-port-5173)
      - [Query Builder (`/querys/builder`)](#query-builder-querysbuilder)
      - [Query List (`/querys/list`)](#query-list-queryslist)
      - [Sync Jobs / Run Sync](#sync-jobs--run-sync)
    - [8.3 sap-map-ui (port 5174)](#83-sap-map-ui-port-5174)
    - [8.4 binpack-ui (port 5175)](#84-binpack-ui-port-5175)
    - [8.6 s7-status-ui (port 5179)](#86-s7-status-ui-port-5179)
    - [8.5 live-labeling-ui (port 5178)](#85-live-labeling-ui-port-5178)
  - [9. SAP B1 Sync Flow (summary)](#9-sap-b1-sync-flow-summary)
  - [10. Troubleshooting](#10-troubleshooting)
    - [Renaming the InfluxDB organisation (without wiping data)](#renaming-the-influxdb-organisation-without-wiping-data)
  - [11. Third-Party Sources](#11-third-party-sources)
    - [Infrastructure \& Runtime](#infrastructure--runtime)
    - [Backend (Python)](#backend-python)
    - [Frontend — Core Stack](#frontend--core-stack)
    - [Frontend — UI Components \& Utilities](#frontend--ui-components--utilities)
    - [Frontend — Label Designer](#frontend--label-designer)
    - [Frontend — Maps](#frontend--maps)
    - [Frontend — 3D Bin Packing Visualization](#frontend--3d-bin-packing-visualization)
    - [Bin Packing — Algorithm Sources](#bin-packing--algorithm-sources)

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
│  s7-status-ui  :5179   S7-1500 OPC-UA live status dashboard         │
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
                /opcua → opcua-service (S7-1500 OPC-UA polling → InfluxDB)
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
│  postgres-opcua (node defs),    │
│  sap-b1-adapter-service,        │
│  file-service, binpack-service, │
│  labeling-service, maps-service,│
│  opcua-service, influxdb,       │
│  opcua-simulator (--profile sim)│
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
│   ├── opcua-service/             # OPC-UA polling for Siemens S7-1500 → InfluxDB timeseries
│   ├── opcua-simulator/           # asyncua fake S7-1500 PLC (dev/test, --profile sim)
│   ├── orders-service/            # stub
│   ├── inventory-service/         # stub
│   ├── reporting-service/         # stub
│   └── sensor-ingest-service/     # stub
├── frontend/
│   ├── admin-ui/                  # User mgmt, permissions, files, charts
│   ├── sap-sync-ui/               # Query Builder + SAP sync jobs
│   ├── sap-map-ui/                # Leaflet map view of SAP data
│   ├── binpack-ui/                # 3D bin-pack UI
│   ├── live-labeling-ui/          # Label designer (Konva canvas + ZPL)
│   └── s7-status-ui/              # S7-1500 OPC-UA live status dashboard (:5179)
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
| **Siemens S7-1500 PLC** | opcua-service polls process data via OPC-UA (port 4840) |
| **OPC-UA Simulator** | asyncua Docker service replacing the PLC for dev/test (`--profile sim`) |
| **PostgreSQL** (per-service, in Docker) | auth-service, file-service, opcua-service internal DBs |
| **InfluxDB 2.7** (in Docker, port 8086) | opcua-service writes timeseries; Grafana reads it |

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

# OPC-UA (Siemens S7-1500)
OPCUA_ENDPOINT=opc.tcp://192.168.0.1:4840
OPCUA_USERNAME=
OPCUA_PASSWORD=
OPCUA_SECURITY_MODE=None
OPCUA_POLL_INTERVAL_MS=500

# InfluxDB — timeseries storage for OPC-UA data
INFLUXDB_USER=admin
INFLUXDB_PASSWORD=adminpassword
INFLUXDB_TOKEN=my-super-secret-token
INFLUXDB_ORG=compani
INFLUXDB_BUCKET=opcua

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
make up-opcua      # Start opcua-service only
make up-influx     # Start InfluxDB only (timeseries DB)
make up-sim        # Start opcua-simulator (fake S7-1500 PLC for dev/test)
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
make fe-s7         # Start s7-status-ui dev server (:5179)
```

### Local backend dev (no Docker)

```bash
make dev-auth      # Run auth-service with uvicorn on :8002
make dev-sap       # Run sap-b1-adapter-service with uvicorn on :8003
make dev-labeling  # Run labeling-service with uvicorn on :8001
make dev-opcua     # Run opcua-service with uvicorn on :8006
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
| opcua-service | `http://localhost/opcua/...` | 8000 |

### Monitoring

| Tool | URL | Default login |
|---|---|---|
| Traefik dashboard | http://localhost:8080 | — |
| RabbitMQ management | http://localhost:15672 | guest / guest |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3000 | admin / admin |
| InfluxDB | http://localhost:8086 | admin / adminpassword |

---

## 8. Frontend Usage

> Note: in docs/pics are Screenshots from ui-s

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

### 8.6 s7-status-ui (port 5179)

**Purpose:** Real-time status dashboard for a Siemens S7-1500 PLC via OPC-UA, with timeseries charts and editable node configuration.

**Start:**
```bash
make fe-s7
# Open: http://localhost:5179
```

**Login:** Same JWT credentials as other frontends (auth-service).

**Pages:**

| Path | Description |
|---|---|
| `/status` | Live OPC-UA connection, statistics, node list (auto-refresh 1.5 s) |
| `/charts` | Recharts timeseries — process data line chart + alarm state timeline; remembers last selection |
| `/node-config` | CRUD editor for OPC-UA node definitions (name, Node ID, unit, sim behavior) |

**Node Config (`/node-config`):**
- Add / edit / delete OPC-UA nodes stored in `postgres-opcua` (`node_definitions` table)
- Changes hot-reload into `opcua-service` and `opcua-simulator` immediately (no restart needed)
- **Unit field**: searchable Autocomplete grouped by category (Temperature, Pressure, Flow, Speed, …) — 45+ standard sensor units from `sensor_units` table; freeSolo allows custom input
- **Sim behavior** fields per node: `sine`, `random_walk`, `random`, `sawtooth`, `trapezoidal`, `step`, `constant`, `threshold`
  - `sim_period` = duration of ONE phase (trapezoidal: ramp-up → plateau → ramp-down → off, total = 4 × period)

**Charts (`/charts`):**
- Measurement selector: **Process Data** (line chart, one node at a time) or **Alarms** (state timeline for all alarm nodes)
- Time range: 10 min / 1 h / 8 h / 24 h
- Auto-refresh every 30 s; manual Refresh button
- Last selected Measurement and Node are persisted in `localStorage`

**Theme:** Industrial dark — cyan primary (`#00bcd4`), deep navy background.

**Key env vars for opcua-service:**

| Variable | Default | Description |
|---|---|---|
| `OPCUA_ENDPOINT` | `opc.tcp://192.168.0.1:4840` | OPC-UA server URL (PLC or simulator) |
| `OPCUA_USERNAME` | *(empty)* | OPC-UA user (leave blank for anonymous) |
| `OPCUA_PASSWORD` | *(empty)* | OPC-UA password |
| `OPCUA_SECURITY_MODE` | `None` | `None` / `Basic256Sha256` |
| `OPCUA_POLL_INTERVAL_MS` | `500` | How often to poll nodes (milliseconds) |
| `POSTGRES_URL` | `postgresql://…@postgres-opcua:5432/opcua_db` | Node definitions DB |
| `INFLUXDB_URL` | `http://influxdb:8086` | Timeseries storage |
| `INFLUXDB_TOKEN` | `my-super-secret-token` | InfluxDB auth token |
| `INFLUXDB_ORG` | `compani` | InfluxDB organisation |
| `INFLUXDB_BUCKET` | `opcua` | InfluxDB bucket |

**Using the OPC-UA simulator (dev/test — no real PLC needed):**

```bash
# In .env:
OPCUA_ENDPOINT=opc.tcp://opcua-simulator:4840

make up-sim      # starts opcua-simulator container (profile=sim)
make up-opcua    # (re)starts opcua-service pointing at the simulator
```

The simulator reads node definitions from `postgres-opcua` and hot-reloads config every 15 s.

**Direct DB / InfluxDB access (for debugging):**

| System | Host | Port | DB / Bucket | User | Password |
|---|---|---|---|---|---|
| PostgreSQL (node defs) | `localhost` | `5438` | `opcua_db` | `postgres` | `postgres` |
| InfluxDB | `localhost` | `8086` | bucket: `opcua` | `admin` | `adminpassword` |
| InfluxDB token | — | — | — | — | `my-super-secret-token` |
| InfluxDB org | — | — | `compani` | — | — |

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
| Need to rename InfluxDB org (keep data) | `DOCKER_INFLUXDB_INIT_ORG` only applies on first init | See procedure below |
| OPC-UA 503 | opcua-service not connected or simulator not running | `make up-sim && make up-opcua`; check `OPCUA_ENDPOINT` in `.env` |
| Charts show no data | InfluxDB not running or opcua-service not writing | `make up-influx`, check `http://localhost:8086` → bucket `opcua` |
| Node Config PUT doesn't update sim behavior | Old opcua-service image (Pydantic model missing sim fields) | `docker compose up -d --build opcua-service` |
| Simulator shows old behavior after node edit | Hot-reload fires every 15 s | Wait up to 15 s, or restart simulator: `docker compose restart opcua-simulator` |
| `sim_behavior` reverts after Save in UI | Old frontend build (NodeDialog useEffect bug) | Hard-refresh browser (Cmd+Shift+R) or `make fe-s7` |

---

### Renaming the InfluxDB organisation (without wiping data)

`DOCKER_INFLUXDB_INIT_ORG` is a **bootstrap-only** variable — it runs once on the very first container start. Changing it in `.env` or `docker-compose.yml` has no effect on an already-initialised instance. Use the API instead:

```bash
# 1. Find the org ID
curl -s http://localhost:8086/api/v2/orgs \
  -H "Authorization: Token my-super-secret-token" | python3 -m json.tool | grep -E '"id"|"name"'

# 2. Rename it (replace <ORG_ID> with the id from step 1)
curl -s -X PATCH http://localhost:8086/api/v2/orgs/<ORG_ID> \
  -H "Authorization: Token my-super-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"name":"compani"}'
```

**Grafana InfluxDB datasource settings** (Connections → Data Sources → InfluxDB-OPC-UA):

| Field | Value |
|---|---|
| URL | `http://influxdb:8086` |
| Query Language | Flux |
| Organization | `compani` |
| Default Bucket | `opcua` |
| Token | `my-super-secret-token` |

> `localhost:8086` will **not** work — Grafana runs inside Docker and must use the service name `influxdb`.

Then update the org name everywhere and restart the affected services:

```bash
# In .env:
INFLUXDB_ORG=compani

# In monitoring/grafana/provisioning/datasources/datasources.yml:
#   organization: compani

# In docker-compose.yml the default is already compani.

docker compose up -d --build opcua-service
docker compose restart grafana
```

---

## 11. Third-Party Sources

### Infrastructure & Runtime

| Name | URL |
|---|---|
| Docker | https://www.docker.com |
| Colima (macOS Docker runtime) | https://github.com/abiosoft/colima |
| Traefik Proxy | https://traefik.io |
| PostgreSQL | https://www.postgresql.org |
| Microsoft SQL Server (azure-sql-edge) | https://hub.docker.com/_/microsoft-azure-sql-edge |
| RabbitMQ | https://www.rabbitmq.com |
| Prometheus | https://prometheus.io |
| Grafana | https://grafana.com |
| Grafana Loki | https://grafana.com/oss/loki |
| OpenVPN | https://openvpn.net |

### Backend (Python)

| Name | URL |
|---|---|
| FastAPI | https://fastapi.tiangolo.com |
| Uvicorn | https://www.uvicorn.org |
| Pydantic | https://docs.pydantic.dev |
| pydantic-settings | https://docs.pydantic.dev/latest/concepts/pydantic_settings |
| python-jose (JWT) | https://github.com/mpdavis/python-jose |
| bcrypt | https://github.com/pyca/bcrypt |
| psycopg2 (PostgreSQL driver) | https://www.psycopg.org |
| pyodbc (MSSQL driver) | https://github.com/mkleehammer/pyodbc |
| Requests | https://requests.readthedocs.io |
| SQLAlchemy | https://www.sqlalchemy.org |
| prometheus-client | https://github.com/prometheus/client_python |
| python-dotenv | https://github.com/theskumar/python-dotenv |

### Frontend — Core Stack

| Name | URL |
|---|---|
| React | https://react.dev |
| TypeScript | https://www.typescriptlang.org |
| Vite | https://vite.dev |
| pnpm | https://pnpm.io |
| MUI (Material UI) | https://mui.com |
| MUI X Tree View | https://mui.com/x/react-tree-view |
| MUI X Data Grid | https://mui.com/x/react-data-grid |
| Emotion (CSS-in-JS) | https://emotion.sh |
| Redux Toolkit | https://redux-toolkit.js.org |
| React Redux | https://react-redux.js.org |
| React Router | https://reactrouter.com |
| axios | https://axios-http.com |
| react-toastify | https://fkhadra.github.io/react-toastify |

### Frontend — UI Components & Utilities

| Name | URL |
|---|---|
| Material React Table | https://www.material-react-table.com |
| TanStack Table | https://tanstack.com/table |
| Recharts | https://recharts.org |
| D3.js | https://d3js.org |
| react-dropzone | https://react-dropzone.js.org |
| react-avatar-editor | https://github.com/mosch/react-avatar-editor |
| react-pdf | https://react-pdf.org |
| mammoth.js (DOCX reader) | https://github.com/mwilliamson/mammoth.js |
| xlsx (SheetJS) | https://sheetjs.com |
| dnd kit (drag and drop) | https://dndkit.com |
| nanoid | https://github.com/ai/nanoid |

### Frontend — Label Designer

| Name | URL |
|---|---|
| Konva | https://konvajs.org |
| react-konva | https://konvajs.org/docs/react |
| bwip-js (barcode/QR/DataMatrix renderer) | https://github.com/metafloor/bwip-js |

### Frontend — Maps

| Name | URL |
|---|---|
| Leaflet | https://leafletjs.com |
| React Leaflet | https://react-leaflet.js.org |
| Leaflet.markercluster | https://github.com/Leaflet/Leaflet.markercluster |
| react-leaflet-cluster | https://github.com/akursat/react-leaflet-cluster |
| Leaflet-Geoman (geometry editing) | https://geoman.io |

### Frontend — 3D Bin Packing Visualization

| Name | URL |
|---|---|
| Three.js | https://threejs.org |
| React Three Fiber | https://r3f.docs.pmnd.rs |
| React Three Drei | https://drei.docs.pmnd.rs |

### Bin Packing — Algorithm Sources

| Name / Title | URL |
|---|---|
| **3dbinpacking** by Enzo Ruiz ⭐ *(main implemented source)* | https://github.com/enzoruiz/3dbinpacking |
| Circle Packing — Wolfram MathWorld | https://mathworld.wolfram.com/CirclePacking.html |
| Frontiers in Mechanical Engineering — Circle packing article (2022) | https://www.frontiersin.org/journals/mechanical-engineering/articles/10.3389/fmech.2022.966691/full |
| Math StackExchange — Maximum circles in a rectangle | https://math.stackexchange.com/questions/2548513/maximum-number-of-circle-packing-into-a-rectangle |
| bed-bpp-env by Florian Kagerer | https://github.com/floriankagerer/bed-bpp-env |
| unknown-binsize-3dpacker by KoukatsuMahoutsukai | https://github.com/KoukatsuMahoutsukai/unknown-binsize-3dpacker |
| IR-BPP by alexfrom0815 | https://github.com/alexfrom0815/IR-BPP |
