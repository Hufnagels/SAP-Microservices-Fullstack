# Plan: Deploy BRD MicroServices to Proxmox VE LXC

## Context

Deploy the full BRD MicroServices stack (13 backend services, 6 frontends, monitoring, MSSQL) to a Proxmox VE LXC container running Ubuntu 22.04/Debian 12. The LXC will be on the internal network with a self-signed TLS certificate served via Traefik. MSSQL runs inside the LXC. Code is pushed from the dev Mac via rsync.

---

## Phase 1 — Files to create/modify (do this on the Mac first)

### 1a. Frontend Dockerfiles (multi-stage: Node build → nginx serve)

The 6 frontends have no Dockerfiles — they need to be containerized to run in production.

Create for each frontend: `frontend/<name>/Dockerfile` and `frontend/<name>/nginx.conf`

**Template Dockerfile** (same for all 6):
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Template nginx.conf** (SPA routing — same for all 6):
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Frontends to create:
- `frontend/admin-ui/Dockerfile` + `nginx.conf`
- `frontend/binpack-ui/Dockerfile` + `nginx.conf`
- `frontend/sap-sync-ui/Dockerfile` + `nginx.conf`
- `frontend/sap-map-ui/Dockerfile` + `nginx.conf`
- `frontend/live-labeling-ui/Dockerfile` + `nginx.conf`
- `frontend/s7-status-ui/Dockerfile` + `nginx.conf`

### 1b. Add frontend services to docker-compose.yml

Add 6 new services after the existing backend block. Each service:
```yaml
  admin-ui:
    build:
      context: frontend/admin-ui
      dockerfile: Dockerfile
    restart: unless-stopped
    networks:
      - default
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.admin-ui.rule=PathPrefix(`/`)"
      - "traefik.http.routers.admin-ui.priority=1"
      - "traefik.http.routers.admin-ui.tls=true"
      - "traefik.http.services.admin-ui.loadbalancer.server.port=80"
```
Use appropriate path prefixes or hostname rules for the other UIs (e.g. `Host(\`brd.internal\`) && PathPrefix(\`/\`)`).

> Note: admin-ui currently uses a Vite dev proxy — after containerizing, the proxy is not needed; API calls go through Traefik at the same host.

### 1c. Update api-gateway/traefik/traefik.yml — add HTTPS + secure dashboard

```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true
  docker:
    exposedByDefault: false

api:
  dashboard: true
  insecure: false   # was: true

log:
  level: INFO
```

Mount cert dir in traefik service in docker-compose.yml:
```yaml
  traefik:
    ...
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - ./api-gateway/traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./api-gateway/traefik/dynamic.yml:/etc/traefik/dynamic.yml:ro
      - ./api-gateway/traefik/certs:/certs:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

### 1d. Update api-gateway/traefik/dynamic.yml — TLS + all HTTPS routers

Add TLS store pointing to cert files:
```yaml
tls:
  stores:
    default:
      defaultCertificate:
        certFile: /certs/server.crt
        keyFile: /certs/server.key
```

Add `tls: {}` to all existing HTTP routers so they serve on `websecure`.

### 1e. Create scripts/gen-cert.sh — self-signed cert generator

```bash
#!/bin/bash
DOMAIN="${1:-brd.internal}"
OUT=api-gateway/traefik/certs
mkdir -p $OUT

# Generate local CA
openssl genrsa -out $OUT/ca.key 4096
openssl req -x509 -new -nodes -key $OUT/ca.key -sha256 -days 3650 \
  -subj "/CN=BRD Internal CA" -out $OUT/ca.crt

# Generate server key + CSR
openssl genrsa -out $OUT/server.key 2048
openssl req -new -key $OUT/server.key \
  -subj "/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:*.${DOMAIN}" \
  -out $OUT/server.csr

# Sign with CA
openssl x509 -req -in $OUT/server.csr -CA $OUT/ca.crt -CAkey $OUT/ca.key \
  -CAcreateserial -out $OUT/server.crt -days 3650 -sha256 \
  -extfile <(echo "subjectAltName=DNS:$DOMAIN,DNS:*.${DOMAIN}")

echo "Done. Trust $OUT/ca.crt in your browser/OS."
```

### 1f. Create scripts/deploy.sh — rsync push to LXC

```bash
#!/bin/bash
# Usage: ./scripts/deploy.sh <LXC_IP>
set -e
HOST="${1:?Usage: deploy.sh <LXC_IP>}"
DEST="root@${HOST}:/opt/microservices"

rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='data/' \
  --exclude='files/' \
  --exclude='**/__pycache__' \
  --exclude='*.pyc' \
  "/Users/pisti/My Projects.local/dev/BRD/MicroServices/" \
  "$DEST/"

echo "Synced to $HOST"
```

### 1g. Create scripts/lxc-setup.sh — runs once on the LXC

```bash
#!/bin/bash
# Run as root on the LXC after first boot
set -e

# Docker CE
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable Docker on boot
systemctl enable docker
systemctl start docker

# Create deployment directory
mkdir -p /opt/microservices
mkdir -p /opt/microservices/data/{pg-auth,pg-shared,pg-files,pg-maps,pg-labeling,pg-opcua,influxdb,prometheus,loki,grafana}
mkdir -p /opt/microservices/files
chmod -R 755 /opt/microservices/data /opt/microservices/files

echo "LXC ready. Now rsync the project and run: cp .env.example .env && nano .env"
```

---

## Phase 2 — Proxmox VE: Create the LXC container

Steps to run in PVE shell (or web UI):

1. Download CT template: Ubuntu 22.04 or Debian 12 (in PVE → CT Templates)
2. Create container:
   - **Cores**: 4
   - **RAM**: 8192 MB (10240 if budget allows)
   - **Disk**: 60 GB (on fast storage)
   - **Network**: static IP on LAN (e.g. `192.168.1.50/24`, gateway `192.168.1.1`)
   - **Hostname**: `brd-micro` (or whatever maps to `brd.internal` in DNS/hosts)
3. Edit LXC config to enable Docker (`/etc/pve/lxc/<CTID>.conf`):
   ```
   features: nesting=1,keyctl=1
   ```
   If nesting is insufficient for docker.sock mounts, set `unprivileged: 0` (privileged container).
4. Start container.

---

## Phase 3 — LXC first-time setup

```bash
# From PVE or SSH into LXC
bash /path/to/scripts/lxc-setup.sh
```

---

## Phase 4 — Deploy code

On the Mac:
```bash
# 1. Generate TLS cert (run once)
bash scripts/gen-cert.sh brd.internal

# 2. Push code to LXC
bash scripts/deploy.sh 192.168.1.50
```

---

## Phase 5 — Configure .env on LXC

```bash
ssh root@192.168.1.50
cd /opt/microservices
cp .env.example .env
nano .env
```

Critical values to set:
- `JWT_SECRET` — min 32 random chars
- `POSTGRES_PASSWORD` — strong password
- `BOOTSTRAP_ADMIN_PASSWORD` — first admin login
- `RABBITMQ_DEFAULT_USER` / `RABBITMQ_DEFAULT_PASS`
- `INFLUXDB_TOKEN` / `INFLUXDB_PASSWORD`
- `GRAFANA_ADMIN_PASSWORD`
- `MSSQL_SA_PASSWORD`
- `DST_SQL_SERVER=mssql_server,1433` (container name on db_net)
- `SAP_B1_SERVICE_LAYER_URL`, `SAP_B1_COMPANY_DB`, etc.
- `OPCUA_ENDPOINT`
- `PRINTER_IP`, `PRINTER_PORT`

---

## Phase 6 — Start services

```bash
cd /opt/microservices

# Start MSSQL infrastructure first (creates db_net network)
docker compose -f infrastructure/mssql/docker-compose.yml up -d
sleep 20

# Initialize MSSQL schema if needed
docker compose -f infrastructure/mssql/docker-compose.yml exec mssql \
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
  -Q "CREATE DATABASE IF NOT EXISTS ReportingDB"

# Build all images and start everything
docker compose up -d --build
```

Monitor startup:
```bash
docker compose ps
docker compose logs -f --tail=50
```

---

## Phase 7 — Add internal DNS / hosts entry

On any client machine that will access the system:
```
192.168.1.50  brd.internal
```

Or add to the LAN DNS server.

To trust the CA cert in Chrome/Firefox: import `api-gateway/traefik/certs/ca.crt`.

---

## Critical Files

| File | Action |
|---|---|
| `docker-compose.yml` | Modify: add 6 frontend services + update traefik mounts + add port 443 |
| `api-gateway/traefik/traefik.yml` | Modify: HTTPS entrypoint, secure dashboard |
| `api-gateway/traefik/dynamic.yml` | Modify: TLS store + tls:{} on all routers |
| `frontend/*/Dockerfile` | Create: 6 new files |
| `frontend/*/nginx.conf` | Create: 6 new files |
| `scripts/gen-cert.sh` | Create |
| `scripts/deploy.sh` | Create |
| `scripts/lxc-setup.sh` | Create |
| `docs/MIGRATION_Guide_v2.md` | Create: human-readable end-to-end deployment guide |

### docs/MIGRATION_Guide_v2.md — contents outline

This is a standalone reference doc (not the plan) written for anyone deploying the stack:

1. **Prerequisites** — PVE version, network requirements, SAP VPN access, MSSQL credentials
2. **Step 1: Create the LXC** — PVE web UI steps + required config lines (`nesting=1`)
3. **Step 2: OS bootstrap** — how to run `lxc-setup.sh`
4. **Step 3: Generate TLS cert** — `gen-cert.sh` + how to trust the CA in Windows/macOS/Chrome
5. **Step 4: Push code** — `deploy.sh` + what gets excluded
6. **Step 5: Configure .env** — table of every required variable with safe example values
7. **Step 6: Start the stack** — exact `docker compose` commands in order
8. **Step 7: Verify** — checklist of health endpoints to hit
9. **Re-deploy workflow** — how to push an update after code changes
10. **Troubleshooting** — common failure modes (MSSQL network, docker.sock permission, cert trust)

---

## Verification

1. `docker compose ps` — all services `Up (healthy)` or `Up`
2. `curl -k https://brd.internal/auth/health` → `{"status":"ok"}`
3. `curl -k https://brd.internal/files/health` → ok
4. Open `https://brd.internal` in browser → admin-ui loads
5. Grafana at `https://brd.internal:3000` (or add traefik route)
6. Traefik dashboard at `https://brd.internal:8080`
7. RabbitMQ UI at `https://brd.internal:15672`

---

## Notes

- `auth-service` mounts `/var/run/docker.sock` for service management — requires privileged LXC or `nesting=1`
- MSSQL container is on `db_net` (external network) — must start infrastructure stack first
- `postgres_opcua_data` is a named Docker volume — persists across `docker compose down`
- On re-deploy: `bash scripts/deploy.sh <IP>` then `docker compose up -d --build` (only changed images rebuild)
- `data/` and `files/` are excluded from rsync to preserve production data
