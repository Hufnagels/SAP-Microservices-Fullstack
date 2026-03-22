# Migration Guide — macOS → Linux Server

## Recommended OS: Ubuntu 24.04 LTS

**Why Ubuntu 24.04 LTS over Debian / Fedora:**

| Criterion | Ubuntu 24.04 LTS | Debian 12 | Fedora 41 |
|---|---|---|---|
| Support until | 2029 (LTS) | 2026 | ~1 year rolling |
| Docker CE official repo | ✅ First-party | ✅ Supported | ✅ Supported |
| MS ODBC Driver 18 | ✅ Official `.deb` | ✅ Works | ⚠ RPM only |
| Python 3.12 in apt | ✅ | ✅ | ✅ |
| Systemd (service auto-start) | ✅ | ✅ | ✅ |
| Colima needed | ❌ (Docker native) | ❌ | ❌ |
| Community / docs volume | ★★★★★ | ★★★★ | ★★★ |

> **Short answer:** Ubuntu 24.04 LTS is the safest choice for a production server hosting this stack.
> Debian 12 is an excellent alternative if you want a leaner base.
> Avoid Fedora for long-running production — it has no LTS track.

---

## Prerequisites on the Linux server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install make, curl, git, unzip
sudo apt install -y make curl git unzip ca-certificates gnupg lsb-release

# Install Docker CE (official Docker repo, not snap)
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker version
docker compose version
```

> **Important:** Do NOT install Docker via `snap` — the snap version has socket path issues with `docker-compose-plugin`.

---

## macOS → Linux differences

| Topic | macOS (Colima) | Linux (native Docker) |
|---|---|---|
| Docker runtime | Colima VM | Native daemon |
| Docker context | `docker context use colima` | Default context (no change needed) |
| `startup.sh` Colima step | Required | Remove / skip |
| Image arch | `linux/arm64` (M1/M2/M3) | `linux/amd64` (standard server) |
| Dockerfile `FROM` | arm64-compatible bases | amd64 bases — may need explicit `--platform` |
| File paths | macOS home `/Users/...` | Linux home `/home/...` or `/opt/...` |

---

## Step-by-step migration

### 1. Transfer the repository

**Option A — Git (recommended):**
```bash
# On Linux server
git clone <your-repo-url> ~/microservices
cd ~/microservices
```

**Option B — rsync from Mac:**
```bash
# Run on your Mac
rsync -avz --exclude node_modules --exclude .git \
  "~/MicroServices/" \
  user@server:~/microservices/
```

### 2. Transfer persistent data (optional — if you want to keep existing data)

#### PostgreSQL data

PostgreSQL volumes are Docker-managed. Export from Mac:

```bash
# On Mac — dump auth DB
docker exec postgres-auth pg_dump -U postgres auth_db > auth_db.sql

# On Mac — dump files DB
docker exec postgres-files pg_dump -U postgres files_db > files_db.sql
```

Copy to Linux and restore after stack is up:

```bash
# On Linux (after make up-core)
cat auth_db.sql | docker exec -i postgres-auth psql -U postgres auth_db
cat files_db.sql | docker exec -i postgres-files psql -U postgres files_db
```

#### InfluxDB data

```bash
# On Mac — export InfluxDB bucket
docker exec influxdb influx backup /tmp/influx-backup \
  --token my-super-secret-token --org compani
docker cp influxdb:/tmp/influx-backup ./influx-backup

# Copy to Linux
scp -r influx-backup user@server:~/microservices/

# On Linux (after influxdb container is up)
docker cp ./influx-backup influxdb:/tmp/influx-backup
docker exec influxdb influx restore /tmp/influx-backup \
  --token my-super-secret-token --org compani
```

#### MSSQL data

MSSQL is in `infrastructure/mssql/` — its volume is `sql_data`.

```bash
# On Mac — backup ReportingDB
docker exec mssql_server /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
  -Q "BACKUP DATABASE [ReportingDB] TO DISK = '/var/opt/mssql/ReportingDB.bak' WITH FORMAT"
docker cp mssql_server:/var/opt/mssql/ReportingDB.bak ./ReportingDB.bak

# Copy to Linux
scp ReportingDB.bak user@server:~/microservices/

# On Linux (after make infra-up)
docker cp ./ReportingDB.bak mssql_server:/var/opt/mssql/ReportingDB.bak
docker exec mssql_server /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
  -Q "RESTORE DATABASE [ReportingDB] FROM DISK = '/var/opt/mssql/ReportingDB.bak' WITH REPLACE"
```

#### Physical files (file-service storage)

```bash
# On Mac — copy the files/ directory
scp -r "~/MicroServices/files/" \
  user@server:~/microservices/files/
```

### 3. Edit `startup.sh` for Linux

Remove the Colima step — it doesn't apply on Linux:

Open `startup.sh` and comment out or delete the line:
```bash
# colima start  ← not needed on Linux
```

Or create a `startup-linux.sh` wrapper:

```bash
#!/usr/bin/env bash
# Linux version — Docker runs natively, no Colima needed
cd "$(dirname "$0")"
./startup.sh "$@"
```

### 4. Handle image architecture

Images in `docker-compose.yml` must match the server CPU. If your Mac built `linux/arm64` images and the server is `x86_64`, Docker will pull/build the correct `amd64` variant automatically on first `make up --build`.

If any `Dockerfile` pins `--platform linux/arm64` explicitly, change it:
```dockerfile
# Before (Mac M1/M2/M3)
FROM --platform=linux/arm64 python:3.11-slim

# After (Linux amd64)
FROM python:3.11-slim
```

Search for pinned platforms:
```bash
grep -r "platform=linux/arm" services/*/Dockerfile
```

### 5. Install MS ODBC Driver 18 on Linux (for sap-b1-adapter-service)

The service runs inside Docker — the driver is installed in the container's Dockerfile.
If you run the service locally (outside Docker), install it on the host:

```bash
curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -
curl https://packages.microsoft.com/config/ubuntu/24.04/prod.list \
  | sudo tee /etc/apt/sources.list.d/mssql-release.list
sudo apt update
sudo ACCEPT_EULA=Y apt install -y msodbcsql18 unixodbc-dev
```

### 6. Configure `.env` for Linux paths

Most env vars are the same. Review:

```dotenv
# MSSQL — same as Mac if using Docker
DST_SQL_SERVER=mssql_server,1433

# OPC-UA endpoint — update to actual S7-1500 IP or simulator
OPCUA_ENDPOINT=opc.tcp://192.168.0.1:4840

# InfluxDB — same
INFLUXDB_URL=http://influxdb:8086
```

### 7. Start the stack

```bash
cd ~/microservices

# First time: start MSSQL infrastructure
make infra-up

# Full stack
./startup.sh

# With OPC-UA simulator (if no real PLC yet)
./startup.sh --sim
```

### 8. Set up auto-start on boot (systemd)

Create a systemd service so the stack starts automatically after a server reboot:

```bash
sudo tee /etc/systemd/system/microservices.service > /dev/null <<EOF
[Unit]
Description=MicroServices Stack
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/<your-user>/microservices
ExecStart=/bin/bash startup.sh
ExecStop=/bin/bash shutdown.sh --infra
User=<your-user>
Group=docker

[Install]
WantedBy=multi-user.target
EOF

# Enable + start
sudo systemctl daemon-reload
sudo systemctl enable microservices
sudo systemctl start microservices

# Check status
sudo systemctl status microservices
```

Replace `<your-user>` with your Linux username.

---

## Port / firewall notes

If the server has `ufw` enabled, open the required ports:

```bash
sudo ufw allow 80/tcp      # Traefik gateway
sudo ufw allow 8080/tcp    # Traefik dashboard (restrict in production)
sudo ufw allow 3000/tcp    # Grafana
sudo ufw allow 8086/tcp    # InfluxDB (restrict in production)
sudo ufw allow 15672/tcp   # RabbitMQ management (restrict in production)
# SAP B1 VPN port — handled by OpenVPN client
```

---

## Checklist

- [ ] Ubuntu 24.04 LTS installed, `apt upgrade` done
- [ ] Docker CE installed (not snap), user in `docker` group
- [ ] Repo transferred (git clone or rsync)
- [ ] `.env` created and filled
- [ ] `startup.sh` Colima step removed / skipped
- [ ] Image platform (`arm64` → `amd64`) checked in Dockerfiles
- [ ] `make infra-up` → MSSQL running
- [ ] `./startup.sh` → all services up
- [ ] `curl http://localhost/auth/health` → `{"status":"ok"}`
- [ ] MSSQL data restored (if migrating existing data)
- [ ] InfluxDB data restored (if migrating existing data)
- [ ] Files directory transferred
- [ ] systemd service created for auto-start
- [ ] Firewall ports opened
- [ ] OpenVPN configured for SAP B1 connection
