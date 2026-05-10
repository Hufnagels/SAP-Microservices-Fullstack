#!/usr/bin/env bash
# ── MicroServices — Startup Script ────────────────────────────────────────
# Starts the full stack step by step using Makefile targets.
# Usage:
#       ./startup.sh                    # full stack
#       ./startup.sh --sim              # + OPC-UA simulator
#       ./startup.sh --feAll            # + all frontend dev servers (background)
#       ./startup.sh --sim --feAll      # both
# Startup order:
# 
# 1. PostgreSQL DBs
# 2. Traefik gateway
# 3. auth-service (first — others need JWT)
# 4. All app services + RabbitMQ
# 5. Monitoring (InfluxDB → Prometheus/Loki → Grafana)
# 6. OPC-UA simulator (optional, --sim)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SIM=false
FE_ALL=false
for arg in "$@"; do
  [[ "$arg" == "--sim"   ]] && SIM=true
  [[ "$arg" == "--feAll" ]] && FE_ALL=true
done

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${YELLOW}  $1${NC}"; }

wait_healthy() {
  local name=$1 seconds=${2:-20}
  info "Waiting ${seconds}s for $name..."
  sleep "$seconds"
}

# ── Step 1: Databases ──────────────────────────────────────────────────────────
step "Starting PostgreSQL databases..."
docker compose up -d postgres-auth postgres-files postgres postgres-maps postgres-labeling postgres-opcua
wait_healthy "PostgreSQL instances" 8
ok "Databases up"

# ── Step 2: Core infrastructure ────────────────────────────────────────────────
step "Starting Traefik gateway + Portainer..."
docker compose up -d traefik portainer
sleep 3
ok "Traefik up    → http://localhost:8080"
ok "Portainer up  → http://localhost:9000  (first run: create user )"

# ── Step 3: Auth service ───────────────────────────────────────────────────────
step "Starting auth-service..."
docker compose up --build -d auth-service
wait_healthy "auth-service" 5
ok "Auth service up → /auth"

# ── Step 4: App services ───────────────────────────────────────────────────────
step "Starting app services..."
docker compose up --build -d \
  sap-b1-adapter-service \
  file-service \
  binpack-service \
  labeling-service \
  opcua-service \
  orders-service \
  inventory-service \
  reporting-service \
  sensor-ingest-service \
  maps-service \
  rabbitmq
wait_healthy "app services" 10
ok "App services up"

# ── Step 5: Monitoring stack ───────────────────────────────────────────────────
step "Starting monitoring stack (InfluxDB, Prometheus, Loki, Grafana)..."
docker compose up -d influxdb prometheus loki promtail
wait_healthy "InfluxDB + Prometheus" 10
docker compose up -d grafana
sleep 5
ok "Monitoring up → Grafana: http://localhost:3000"

# ── Step 6: OPC-UA simulator (optional) ───────────────────────────────────────
if $SIM; then
  step "Starting OPC-UA simulator..."
  docker compose --profile sim up --build -d opcua-simulator
  sleep 3
  ok "OPC-UA simulator up → opc.tcp://localhost:4840"
fi

# ── Step 7: Frontend dev servers (optional) ───────────────────────────────────
if $FE_ALL; then
  step "Starting all frontend dev servers (background)..."
  (cd frontend/sap-sync-ui     && pnpm dev) &
  (cd frontend/sap-map-ui      && pnpm dev) &
  (cd frontend/binpack-ui      && pnpm dev) &
  (cd frontend/admin-ui        && pnpm dev) &
  (cd frontend/live-labeling-ui && pnpm dev) &
  (cd frontend/s7-status-ui    && pnpm dev) &
  sleep 3
  ok "Frontend dev servers starting (may take a few seconds to be ready)"
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  MicroServices stack is up!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Gateway (Traefik):   ${CYAN}http://localhost${NC}"
echo -e "  Traefik dashboard:   ${CYAN}http://localhost:8080${NC}"
echo -e "  Portainer:           ${CYAN}http://localhost:9000${NC}"
echo -e "  Grafana:             ${CYAN}http://localhost:3000${NC}"
echo -e "  InfluxDB:            ${CYAN}http://localhost:8086${NC}"
echo ""
if $FE_ALL; then
echo -e "  Frontend dev servers (running in background):"
echo -e "    SAP Sync UI:       ${CYAN}http://localhost:5173${NC}"
echo -e "    SAP Map UI:        ${CYAN}http://localhost:5174${NC}"
echo -e "    Binpack UI:        ${CYAN}http://localhost:5175${NC}"
echo -e "    Admin UI:          ${CYAN}http://localhost:5176${NC}"
echo -e "    Live Labeling UI:  ${CYAN}http://localhost:5178${NC}"
echo -e "    S7 Status UI:      ${CYAN}http://localhost:5179${NC}"
else
echo -e "  Frontend dev servers (run separately):"
echo -e "    SAP Sync UI:       ${CYAN}make fe-sap      ${NC} → http://localhost:5173"
echo -e "    SAP Map UI:        ${CYAN}make fe-map      ${NC} → http://localhost:5174"
echo -e "    Binpack UI:        ${CYAN}make fe-binpack  ${NC} → http://localhost:5175"
echo -e "    Admin UI:          ${CYAN}make fe-admin    ${NC} → http://localhost:5176"
echo -e "    Live Labeling UI:  ${CYAN}make fe-labeling ${NC} → http://localhost:5178"
echo -e "    S7 Status UI:      ${CYAN}make fe-s7       ${NC} → http://localhost:5179"
fi
echo ""
echo -e "  Status:              ${CYAN}make ps${NC}"
echo -e "  Logs:                ${CYAN}make logs${NC}"
echo ""
