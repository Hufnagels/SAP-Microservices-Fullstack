# Migration Summary — Post-Deploy Steps
**LXC:** `10.63.10.111` | **User:** `user / password` | **Deploy root:** `/opt/microservices`

---
## 0. BASE GUIDES

[MIGRATION_Guide_v1.nd](@docs/migration/MIGRATION_Guide_v1.nd)

[MIGRATION_Guide_v2.nd](@docs/migration/MIGRATION_Guide_v2.nd)

## 1. Run deploy.sh

```bash
bash docs/migration/scripts/deploy.sh
# or with explicit host:
bash docs/migration/scripts/deploy.sh 10.63.10.111
```

`deploy.sh` does two things:
1. **rsync** project from Mac → `~/ms-staging` on LXC (excludes `node_modules`, `data/`, `files/`, `.git`)
2. **sudo rsync** staging → `/opt/microservices` with `--delete` (also excludes `data/` and `files/`)

> ⚠️ `data/` and `files/` are **never touched** by deploy.sh. They are permanent on the LXC.

---

## 2. After deploy — rebuild and restart services

```bash
ssh xxxx@10.63.10.111
cd /opt/microservices

# Rebuild changed images and restart (databases are NOT affected)
sudo docker compose up -d --build
```

---

## 3. If `data/` directories are missing (after lxc-setup or manual wipe)

This happens after a fresh LXC setup or if `data/` was accidentally deleted.

### 3a. Recreate data directories with correct ownership

```bash
sudo mkdir -p /opt/microservices/data/{pg-auth,pg-shared,pg-files,pg-maps,pg-labeling,pg-opcua,pg-lot,influxdb,prometheus,loki,grafana,mssql}
sudo mkdir -p /opt/microservices/files

# Fix ownership — each service runs as a specific non-root UID
sudo chown -R 10001:10001 /opt/microservices/data/mssql
sudo chown -R 10001:10001 /opt/microservices/data/loki
sudo chown -R 472:472     /opt/microservices/data/grafana
sudo chown -R 65534:65534 /opt/microservices/data/prometheus
sudo chown -R 1000:1000   /opt/microservices/data/influxdb
# PostgreSQL (UID 999) sets its own ownership on first start — leave as root
```

### 3b. Start infrastructure (MSSQL) and main stack

```bash
cd /opt/microservices

# Start MSSQL first (owns the db_net network)
sudo docker compose -f infrastructure/mssql/docker-compose.yml up -d
sleep 30

# Start everything else
sudo docker compose up -d --build
```

---

## 4. Restore MSSQL ReportingDB after data wipe

Run whenever `data/mssql` is empty (error 4060 / login failed in TablePlus).

### 4a. Create database + schema

```bash
sudo docker exec -i mssql_server \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'MyS3cureP@ss!' -No -C \
  < /opt/microservices/infrastructure/mssql/init.sql
```

### 4b. Restore table data (run in this order — FK dependency)

```bash
SA="sudo docker exec -i mssql_server /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'MyS3cureP@ss!' -No -C"

$SA < /tmp/wrk_TableDesc.sql
$SA < /tmp/wrk_QueryDef.sql
$SA < /tmp/auth_User.sql
$SA < /tmp/logs_SyncJobs.sql
$SA < /tmp/qry_SalesOrders.sql
$SA < /tmp/qry_ItemListUniqueFields.sql
```

> The SQL files are pre-uploaded at `/tmp/` on the LXC. If `/tmp` was cleared, re-upload from:
> `docs/sql/MSSQL/ReportingDB/` on the Mac using `scp`.

### 4c. Verify

```bash
sudo docker exec -i mssql_server \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'MyS3cureP@ss!' \
  -d ReportingDB -No -C \
  -Q "SELECT t.name, p.rows FROM sys.tables t JOIN sys.partitions p ON t.object_id=p.object_id WHERE p.index_id<2 ORDER BY t.name"
```

Expected:

| Table | Rows |
|---|---|
| auth_User | 1 |
| log_SyncLog | 0 |
| logs_SyncJobs | 29 |
| qry_ItemListUniqueFields | 360 |
| qry_SalesOrders | 100 |
| wrk_QueryDef | 5 |
| wrk_TableDesc | 4 |

---

## 5. After changing dynamic.yml (Traefik routes)

Traefik hot-reloads the file provider but sometimes misses changes on bind-mount filesystems.
Force a reload with:

```bash
cd /opt/microservices
sudo docker compose restart traefik
```

---

## 6. Restore SQL files to /tmp (if /tmp was cleared)

```bash
# From Mac:
SQL="docs/sql/MSSQL/ReportingDB"
for f in wrk_TableDesc.sql wrk_QueryDef.sql auth_User.sql logs_SyncJobs.sql qry_SalesOrders.sql qry_ItemListUniqueFields.sql; do
  sshpass -p xxxxxpasswordxxxx scp -o StrictHostKeyChecking=no \
    "$SQL/$f" xxxx@10.63.10.111:/tmp/$f
done
```

---

## Service URLs

| Service | URL |
|---|---|
| API gateway (all backends) | `http://10.63.10.111` |
| admin-ui | `http://10.63.10.111:5176` |
| sap-sync-ui | `http://10.63.10.111:5173` |
| sap-map-ui | `http://10.63.10.111:5174` |
| binpack-ui | `http://10.63.10.111:5175` |
| live-labeling-ui | `http://10.63.10.111:5178` |
| s7-status-ui | `http://10.63.10.111:5179` |
| lotgen-ui | `http://10.63.10.111:5177` |
| Grafana | `http://10.63.10.111:3000` |
| Traefik dashboard | `http://10.63.10.111:8080` |
| RabbitMQ management | `http://10.63.10.111:15672` |
| Portainer | `http://10.63.10.111:9000` |

## Credentials

| Service | Username | Password |
|---|---|---|
| MSSQL sa | `sa` | `MyS3cureP@ss!` |
| MSSQL | _(set in .env)_ | _(set in .env)_ |
| Grafana | `admin` | `admin` |
| RabbitMQ | `guest` | `guest` |
| LXC | _(set in .env)_ | _(set in .env)_ |
