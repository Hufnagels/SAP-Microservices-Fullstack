# Getting Started

## Table of Contents

- [Prerequisites](#prerequisites)
- [Repository Structure](#repository-structure)
- [Stack Architecture](#stack-architecture)
- [1. Install](#1-install)
  - [1.1 Clone / locate the repo](#11-clone--locate-the-repo)
  - [1.2 Copy and fill in environment variables](#12-copy-and-fill-in-environment-variables)
- [2. Start Colima (macOS)](#2-start-colima-macos)
- [3. First Start (new machine)](#3-first-start-new-machine)
  - [Step 1 — Start MSSQL infrastructure](#step-1--start-mssql-infrastructure)
  - [Step 2 — Start core app services](#step-2--start-core-app-services)
  - [Step 3 — Initialize MSSQL schema (first time only)](#step-3--initialize-mssql-schema-first-time-only)
  - [Step 4 — Start all services](#step-4--start-all-services)
  - [Stopping the stack](#stopping-the-stack)
- [4. Makefile Reference](#4-makefile-reference)
- [5. Verify Auth Service](#5-verify-auth-service)
  - [5.1 Traefik dashboard](#51-traefik-dashboard)
  - [5.2 Health check](#52-health-check)
  - [5.3 First login](#53-first-login)
  - [5.4 Verify token](#54-verify-token)
  - [5.5 Create additional users](#55-create-additional-users)
- [6. All Services and Gateway Paths](#6-all-services-and-gateway-paths)
  - [Monitoring](#monitoring)
- [7. SAP B1 Sync (requires VPN)](#7-sap-b1-sync-requires-vpn)
- [8. Stop / Restart](#8-stop--restart)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker | 29+ | https://docs.docker.com/get-docker/ |
| Colima (macOS) | latest | `brew install colima` |
| Docker Compose | v2 (bundled with Docker) | — |
| make | any | pre-installed on macOS |
| pnpm | 10+ | `brew install pnpm` |
| OpenVPN | any | required for SAP B1 connection |

> **Mac M1/M2/M3:** All images are `linux/arm64` compatible. No extra flags needed.

---

## Repository Structure

```
MicroServices/
├── services/
│   ├── auth-service/              # JWT auth, PostgreSQL-backed
│   ├── sap-b1-adapter-service/    # SAP B1 → MSSQL sync
│   ├── orders-service/            # stub
│   ├── inventory-service/         # stub
│   ├── reporting-service/         # stub
│   └── sensor-ingest-service/     # stub
├── infrastructure/
│   └── mssql/
│       ├── docker-compose.yml     # MSSQL infrastructure stack (owns db_net)
│       └── init.sql               # ReportingDB schema: tables, indexes
├── api-gateway/
│   └── traefik/
│       ├── traefik.yml            # static config
│       └── dynamic.yml            # routing rules (file provider)
├── shared/
│   └── python_common/             # CommonSettings, metrics_router
├── monitoring/                    # Prometheus, Loki, Promtail, Grafana configs
├── docker-compose.yml             # App stack (joins db_net as external)
├── Makefile                       # Orchestration commands
└── .env                           # Local secrets (never commit)
```

---

## Stack Architecture

Two independent Docker Compose stacks share a Docker network (`db_net`):

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Infrastructure stack       │     │  App stack                   │
│  infrastructure/mssql/      │     │  docker-compose.yml          │
│                             │     │                              │
│  mssql_server (azure-sql)   │     │  traefik (gateway :80/:8080) │
│  volume: sql_data           │     │  auth-service + postgres-auth│
│                             │     │  sap-b1-adapter-service      │
│  Owns: db_net network       │◄────│  orders, inventory, ...      │
└─────────────────────────────┘     │  rabbitmq, prometheus, loki, │
                                    │  grafana                     │
                                    └──────────────────────────────┘
```

**Why two stacks?**
- `make down -v` (or `docker compose down -v`) on the app stack resets all app data — MSSQL data survives
- MSSQL can be upgraded or restarted without touching the app stack
- `db_net` is owned by the infra stack; the app stack joins it as `external: true`

---

## 1. Install

### 1.1 Clone / locate the repo

```bash
cd ~/dev/MicroServices
```

### 1.2 Copy and fill in environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```dotenv
# PostgreSQL password (used for all internal DBs)
POSTGRES_PASSWORD=<SuperSecret>

# JWT secret — CHANGE THIS in production (min 32 chars)
JWT_SECRET=<SuperSecret>

# Bootstrap admin — auto-created on first start if DB is empty
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=<SuperSecret>

# SAP B1 Service Layer (requires VPN)
SAP_B1_SERVICE_LAYER_URL=https://<SAP host ip>:50000/b1s
SAP_B1_COMPANY_DB=test_DB
SAP_B1_USERNAME=<sap_username>
SAP_B1_PASSWORD=<SuperSecret>

# MSSQL ReportingDB — local Docker container
DST_SQL_SERVER=mssql_server,1433
DST_SQL_DB=ReportingDB
DST_SQL_USER=sa
DST_SQL_PASSWORD=<SuperSecret>

# MSSQL SA password (must match DST_SQL_PASSWORD)
MSSQL_SA_PASSWORD=<SuperSecret>
```

> Do not add inline comments (`# ...`) after values — Docker Compose includes them in the value.

---

## 2. Start Colima (macOS)

Colima is the Docker runtime. It must be running before any `docker compose` or `make` command.

```bash
colima start

# Point Docker CLI at Colima's socket (only needed once — persists across reboots)
docker context use colima

# Verify
docker version
docker ps
```

> If you see `Cannot connect to the Docker daemon` → run `colima start` then `docker context use colima`.

---

## 3. First Start (new machine)

### Step 1 — Start MSSQL infrastructure

```bash
make infra-up
```

This starts `mssql_server` (azure-sql-edge on port 1433) and creates the `db_net` Docker network.

Expected output:
```
Starting MSSQL infrastructure...
 Container mssql_server  Started
Waiting for SQL Server to accept connections...
MSSQL is up.
```

### Step 2 — Start core app services

```bash
make up-core
```

This starts Traefik + auth-service + postgres-auth. Enough to verify auth before bringing up everything.

Expected log lines (follow with `make logs`):
```
postgres-auth-1   | database system is ready to accept connections
auth-service-1    | auth_users table ready
auth-service-1    | Bootstrap admin 'admin' created        ← first run only
auth-service-1    | Auth service started
traefik-1         | Starting provider *file.Provider
```

### Step 3 — Initialize MSSQL schema (first time only)

Start the SAP adapter first, then run schema init:

```bash
make up-sap
make infra-init
```

This creates `ReportingDB` and all required tables (`logs_SyncJobs`, `wrk_TableDesc`, etc.).

### Step 4 — Start all services

**Option A — one-command startup (recommended):**

```bash
./startup.sh          # full stack
./startup.sh --sim    # + OPC-UA simulator (fake PLC)
```

**Option B — manual step-by-step:**

```bash
make up
```

### Stopping the stack

```bash
./shutdown.sh              # stop app services (MSSQL kept running)
./shutdown.sh --infra      # + stop MSSQL infrastructure
./shutdown.sh --all        # stop everything (app + sim + infra)
```

---

## 4. Makefile Reference

```bash
make infra-up      # Start MSSQL + create db_net
make infra-init    # Create ReportingDB schema (first time only)
make infra-down    # Stop MSSQL (keep data)
make infra-reset   # Stop MSSQL + delete volume (wipes DB)

make up            # Build + start all app services (detached)
make up-core       # Start traefik + auth-service only
make up-sap        # Start sap-b1-adapter-service only
make down          # Stop app services (keep volumes)
make down-all      # Stop app + infra (keep volumes)
make reset         # Full wipe: delete all volumes, restart everything

make logs          # Follow all app logs
make ps            # Show running containers (both stacks)
```

---

## 5. Verify Auth Service

### 5.1 Traefik dashboard

Open: http://localhost:8080 — you should see the `/auth` and `/sap` routers listed.

### 5.2 Health check

```bash
curl http://localhost/auth/health
# {"status":"ok","service":"auth-service"}
```

### 5.3 First login

```bash
curl -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_bootstrap_password"}'
```

Expected response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "role": "admin"
}
```

Save the token:
```bash
TOKEN=$(curl -s -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_bootstrap_password"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

### 5.4 Verify token

```bash
curl http://localhost/auth/me \
  -H "Authorization: Bearer $TOKEN"
# {"username":"admin","role":"admin"}
```

### 5.5 Create additional users

```bash
curl -X POST http://localhost/auth/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"username":"operator1","password":"pass123","role":"operator"}'
```

Roles: `admin`, `operator`, `viewer`.

---

## 6. All Services and Gateway Paths

| Service | Gateway path | Internal port |
|---|---|---|
| auth-service | `http://localhost/auth/...` | 8000 |
| sap-b1-adapter-service | `http://localhost/sap/...` | 8000 |
| orders-service | `http://localhost/orders/...` | 8000 |
| inventory-service | `http://localhost/inventory/...` | 8000 |
| reporting-service | `http://localhost/reporting/...` | 8000 |
| sensor-ingest-service | `http://localhost/sensor/...` | 8000 |

### Monitoring

| Tool | URL | Default login |
|---|---|---|
| Traefik dashboard | http://localhost:8080 | — |
| RabbitMQ management | http://localhost:15672 | guest / guest |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3000 | admin / admin |

---

## 7. SAP B1 Sync (requires VPN)

Connect OpenVPN first, then:

```bash
TOKEN=$(curl -s -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_bootstrap_password"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Run a sync (SAP B1 → MSSQL ReportingDB)
curl -X POST http://localhost/sap/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sql_code": "My_OpenOrders",
    "dst_table": "qry_SalesOrders",
    "dst_schema": "dbo",
    "load_mode": "replace"
  }'

# Expected: {"status":"ok","rows_written":5,"table":"qry_SalesOrders"}

# Check job history
curl http://localhost/sap/jobs \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8. Stop / Restart

```bash
# Stop app services (keep all data volumes)
make down

# Stop app + infra (keep all data volumes)
make down-all

# Restart a single service after code changes
docker compose up --build auth-service

# Full reset — DESTROYS ALL DATA, restarts everything
make reset
```

> `make down` / `docker compose down -v` resets app data (auth users, etc.) but **MSSQL data is safe** because it lives in the infra stack's volume.
>
> To also wipe MSSQL: `make infra-reset` (or `make reset` for everything).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot connect to Docker daemon` | Colima not running or wrong context | `colima start && docker context use colima` |
| `network db_net not found` | Infra stack not started | `make infra-up` |
| `Bootstrap admin not created` | `BOOTSTRAP_ADMIN_PASSWORD` empty in `.env` | Add a password, restart auth-service |
| `401 Invalid credentials` on login | Wrong password or user missing | Check `.env`, or `docker compose down -v` then `make up` |
| MSSQL login failed (18456) | Stale volume with old SA password | `make infra-reset` then `make infra-init` |
| SAP sync returns 503 | VPN not connected | Connect OpenVPN, then retry |
| SAP sync returns 500 with MSSQL error | Schema not initialized | `make infra-init` |
| Port 80 already in use | Another process on port 80 | `sudo lsof -i :80` to find and stop it |
| `client version 1.24 is too old` in Traefik | Colima Docker API mismatch | Already fixed — Docker provider removed, using file provider only |
