# LOTGEN — Sarzs / LOT Generáló és Nyomtató

> Integrated into MicroServices 2026-05-17.
> Standalone source: `/Users/pisti/My Projects.local/dev/BRD/LOTGEN/`

---

## Overview

LOTGEN generates sequential LOT numbers for production batches, prints ZPL labels to a CAB SQUIX / Zebra printer, and exports Avery 3474 (A4, 3×8 = 24 labels/sheet) PDF sheets.

**LOT number format:** `{PREFIX}-{DATE}-{SEQ}`
Example: `TM1-260517-0001`

| Field | Options | Notes |
|---|---|---|
| Prefix | `TM1`, `TM2`, `SZ1`, `DM1` | Per-prefix sequential counter in DB |
| Date | `YYYYMMDD`, `YYMMDD`, `YYMM`, `YYYYWW`, none | Generation date |
| Separator | `-`, `/`, `_`, none | |
| Sequence digits | 3–6 | Zero-padded |
| Suffix | optional | Appended after sequence |

---

## Architecture

```
Browser → localhost:5177 (nginx / lotgen-ui)
            ├─ /auth/*  → Traefik:80 → auth-service     (JWT login)
            └─ /lot/*   → Traefik:80 → lotgen-service   (LOT API)
                                            └─ postgres-lot (lot_db)
```

Auth is shared with the rest of the platform — same JWT secret, same `auth_db`.

---

## Services

### `lotgen-service` (backend)

| Property | Value |
|---|---|
| Source | `services/lotgen-service/` |
| Framework | FastAPI + psycopg2 |
| Gateway prefix | `/lot` |
| Internal port | `8000` |
| DB | `postgres-lot` → `lot_db` |
| Host DB port | **5440** |
| Auth | JWT (shared `JWT_SECRET` from `.env`) |

**Key endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/lot/health` | public | Health check |
| `GET` | `/lot/counter/{prefix}` | any user | Current counter for prefix |
| `PUT` | `/lot/counter/{prefix}` | any user | Set counter (reset to 1) |
| `POST` | `/lot/generate` | any user | Generate & persist LOT numbers |
| `GET` | `/lot/history` | any user | Generation history |
| `PUT` | `/lot/{id}/printed` | any user | Mark item as printed |

**Generate request body:**
```json
{
  "prefix":      "TM1",
  "date_format": "YYMMDD",
  "separator":   "-",
  "seq_digits":  4,
  "suffix":      "",
  "quantity":    24,
  "label_size":  "70x37"
}
```

**Counter behaviour:** counter is per-prefix in `lot_counters` table. Reset (`PUT /lot/counter/TM1 {"value":1}`) is honoured exactly — no auto-advance. If the same lot number already exists, the record is updated in-place (`ON CONFLICT DO UPDATE`), enabling same-day reprint runs.

---

### `postgres-lot` (database)

| Property | Value |
|---|---|
| Image | `postgres:16` |
| Database | `lot_db` |
| Host port | **5440** |
| Data volume | `./data/pg-lot` |
| User / Password | `postgres` / `$POSTGRES_PASSWORD` |

**Schema:**

```sql
-- Per-prefix sequential counters
CREATE TABLE lot_counters (
  prefix     VARCHAR(10) PRIMARY KEY,   -- TM1, TM2, SZ1, DM1
  counter    INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full generation history
CREATE TABLE lot_history (
  id           SERIAL PRIMARY KEY,
  lot_number   VARCHAR(100) NOT NULL UNIQUE,
  prefix       VARCHAR(10)  NOT NULL,
  sequence     INTEGER      NOT NULL,
  date_str     VARCHAR(20)  NOT NULL,
  separator    VARCHAR(5)   NOT NULL,
  seq_digits   INTEGER      NOT NULL,
  suffix       VARCHAR(50)  NOT NULL,
  date_format  VARCHAR(20)  NOT NULL,
  label_size   VARCHAR(20)  NOT NULL,
  zpl          TEXT,
  generated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  generated_by VARCHAR(100),           -- username from JWT
  printed      BOOLEAN      NOT NULL DEFAULT FALSE,
  printed_at   TIMESTAMPTZ
);
```

---

### `lotgen-ui` (frontend)

| Property | Value |
|---|---|
| Source | `frontend/lotgen-ui/` |
| Framework | React 18 + Vite + Tailwind |
| Host port | **5177** |
| Proxied APIs | `/auth`, `/lot` |
| Auth | BRD microservices JWT (shared `auth_db`) |

**Features:**
- Login via shared auth-service; user management (admin/superadmin only)
- Format configurator: prefix, date, separator, digits, suffix
- Live preview + range display (`TM1-260517-0001 – TM1-260517-0024`)
- Generate → persists to backend DB with atomic counter increment
- ZPL label preview + copy to clipboard
- Direct TCP print to CAB SQUIX via `labeling-service`
- **PDF export:** Avery 3474 layout (A4, 3×8, 70×37 mm), opens preview modal before download
- Cancel PDF → reverts counter and clears generated items

---

## Label Sizes

| Key | Dimensions | Notes |
|---|---|---|
| `70x37` | 70 × 37 mm | **Default** — Avery 3474 |
| `80x50` | 80 × 50 mm | |
| `102x51` | 102 × 51 mm | |
| `102x76` | 102 × 76 mm | |
| `102x152` | 102 × 152 mm | |

**Avery 3474 PDF layout:**
- 3 columns × 8 rows = 24 labels per A4 sheet
- Top margin: 8.5 mm, no side margins, no gaps between labels
- Each label: LOT number (top, centered) + Code128 barcode (below)

---

## Environment Variables

All inherited from the root `.env` — no separate config needed.

| Variable | Used by | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | `postgres-lot` | DB password |
| `JWT_SECRET` | `lotgen-service` | Must match `auth-service` |
| `PRINTER_IP` | `labeling-service` | CAB SQUIX printer IP |
| `PRINTER_PORT` | `labeling-service` | Default `9100` |

---

## Quick Start

```bash
# Start everything (from MicroServices root)
docker compose up -d postgres-lot lotgen-service lotgen-ui traefik

# Open the app
open http://localhost:5177

# Connect to LOT DB
psql -h localhost -p 5440 -U postgres -d lot_db

# Health check
curl http://localhost/lot/health

# Generate via API (requires JWT)
TOKEN=$(curl -s -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}' | jq -r .access_token)

curl -s -X POST http://localhost/lot/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prefix":"TM1","date_format":"YYMMDD","separator":"-","seq_digits":4,"suffix":"","quantity":5,"label_size":"70x37"}'
```

---

## Standalone Development

The original project remains at `/Users/pisti/My Projects.local/dev/BRD/LOTGEN/` with its own `docker-compose.yml` (standalone stack, port 8001 for backend, port 5439 for DB). Use that for local dev without the full MicroServices stack.

| Standalone | MicroServices |
|---|---|
| Backend: `localhost:8001` | Backend: `localhost/lot` |
| DB: port `5439` | DB: port `5440` |
| Auth: `localhost/auth` | Auth: `localhost/auth` (same) |
| Frontend: `localhost:5173` (Vite dev) | Frontend: `localhost:5177` (nginx) |
