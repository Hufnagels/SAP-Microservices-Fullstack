# MicroServices — Ports, DBs & Credentials Reference

> All passwords come from `.env` (or the defaults shown below).
> Internal ports (inside Docker) are always `5432` for Postgres and `8000` for services.
> **Host ports** are what you connect to from the dev machine.

---

## Backend Services

| Service | Gateway prefix | Internal port | DB container | Host port | DB name | User | Password |
|---|---|---|---|---|---|---|---|
| `auth-service` | `/auth` | 8000 | `postgres-auth` | **5433** | `auth_db` | `postgres` | `$POSTGRES_PASSWORD` |
| `orders-service` | `/orders` | 8000 | `postgres` (shared) | **5434** | `orders_db` | `postgres` | `$POSTGRES_PASSWORD` |
| `inventory-service` | `/inventory` | 8000 | `postgres` (shared) | **5434** | `inventory_db` | `postgres` | `$POSTGRES_PASSWORD` |
| `reporting-service` | `/reporting` | 8000 | `postgres` (shared) | **5434** | `reporting_db` | `postgres` | `$POSTGRES_PASSWORD` |
| `sensor-ingest-service` | `/sensor` | 8000 | `postgres` (shared) | **5434** | `events_db` | `postgres` | `$POSTGRES_PASSWORD` |
| `file-service` | `/files` | 8000 | `postgres-files` | **5436** | `files_db` | `postgres` | `$POSTGRES_PASSWORD` |
| `maps-service` | `/maps` | 8000 | `postgres-maps` | **5435** | `maps_db` | `postgres` | `$POSTGRES_PASSWORD` |
| `opcua-service` | `/opcua` | 8000 | `postgres-opcua` + InfluxDB | **5438** | `opcua_db` | `postgres` | `$POSTGRES_PASSWORD` |
| `sap-b1-adapter-service` | `/sap` | 8000 | MSSQL (external) | **1433** | `$DST_SQL_DB` (ReportingDB) | `$DST_SQL_USER` (sa) | `$DST_SQL_PASSWORD` |
| `binpack-service` | `/binpack` | 8000 | — | — | — | — | — |
| `labeling-service` | `/labeling` | 8000 | `postgres-labeling` | **5437** | `labeling_db` | `postgres` | `$POSTGRES_PASSWORD` |
| `lotgen-service` | `/lot` | 8000 | `postgres-lot` | **5440** | `lot_db` | `postgres` | `$POSTGRES_PASSWORD` |

---

## Frontend Dev Servers

| Frontend | Dev port | Proxied APIs |
|---|---|---|
| `sap-sync-ui` | **5173** | `/auth`, `/sap` |
| `sap-map-ui` | **5174** | `/auth`, `/maps` |
| `binpack-ui` | **5175** | `/auth`, `/binpack` |
| `admin-ui` | **5176** | `/auth`, `/files` |
| `live-labeling-ui` | **5178** | `/auth`, `/labeling` |
| `s7-status-ui` | **5179** | `/auth`, `/opcua` |
| `lotgen-ui` | **5177** | `/auth`, `/lot` |

---

## Infrastructure

| Container | Protocol | Host port | Default credentials |
|---|---|---|---|
| `traefik` | HTTP | **80** | — |
| `traefik` | Dashboard | **8080** | — |
| `rabbitmq` | AMQP | **5672** | `guest` / `guest` |
| `rabbitmq` | Management UI | **15672** | `guest` / `guest` |
| `influxdb` | HTTP | **8086** | `$INFLUXDB_USER` / `$INFLUXDB_PASSWORD` (admin / adminpassword) |
| `prometheus` | HTTP | **9090** | — |
| `grafana` | HTTP | **3000** | `$GRAFANA_ADMIN_USER` / `$GRAFANA_ADMIN_PASSWORD` (admin / admin) |
| `loki` | HTTP | **3100** | — |
| `opcua-simulator` | OPC-UA | **4840** | — |

---

## SAP B1 / MSSQL (external)

| Var | Default | Description |
|---|---|---|
| `SAP_B1_SERVICE_LAYER_URL` | _(set in .env)_ | SAP Business One Service Layer base URL |
| `SAP_B1_COMPANY_DB` | _(set in .env)_ | SAP company database name |
| `SAP_B1_USERNAME` | _(set in .env)_ | SAP login user |
| `SAP_B1_PASSWORD` | _(set in .env)_ | SAP login password |
| `DST_SQL_SERVER` | `mssql_server,1433` | MSSQL destination server |
| `DST_SQL_DB` | `ReportingDB` | MSSQL destination database |
| `DST_SQL_USER` | `sa` | MSSQL user |
| `DST_SQL_PASSWORD` | _(set in .env)_ | MSSQL password |

> **Network note:** `sap-b1-adapter-service` is on both `default` and `db_net` networks.
> `db_net` must be created first: `cd infrastructure/mssql && docker compose up -d`

---

## Quick Connect Cheatsheet

```bash
# Auth DB
psql -h localhost -p 5433 -U postgres -d auth_db

# Shared DB (orders / inventory / reporting / events)
psql -h localhost -p 5434 -U postgres

# Files DB
psql -h localhost -p 5436 -U postgres -d files_db

# Maps DB
psql -h localhost -p 5435 -U postgres -d maps_db

# OPC-UA DB
psql -h localhost -p 5438 -U postgres -d opcua_db

# Labeling DB
psql -h localhost -p 5437 -U postgres -d labeling_db

# LOT DB
psql -h localhost -p 5440 -U postgres -d lot_db

# InfluxDB UI
open http://localhost:8086

# Grafana
open http://localhost:3000

# Traefik dashboard
open http://localhost:8080

# RabbitMQ management
open http://localhost:15672
```
