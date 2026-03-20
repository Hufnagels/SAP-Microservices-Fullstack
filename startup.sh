#!/usr/bin/env bash
# ── MicroServices — Startup Script ────────────────────────────────────────
# Starts the full stack step by step using Makefile targets.
# Usage: 
#       ./startup.sh          # full stack
#       ./startup.sh --sim    # + OPC-UA simulator
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
for arg in "$@"; do [[ "$arg" == "--sim" ]] && SIM=true; done

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
docker compose up -d postgres-auth postgres-files postgres postgres-maps postgres-labeling
wait_healthy "PostgreSQL instances" 8
ok "Databases up"

# ── Step 2: Core infrastructure ────────────────────────────────────────────────
step "Starting Traefik gateway..."
docker compose up -d traefik
sleep 3
ok "Traefik up → http://localhost:8080"

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

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  MicroServices stack is up!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Gateway (Traefik):   ${CYAN}http://localhost${NC}"
echo -e "  Traefik dashboard:   ${CYAN}http://localhost:8080${NC}"
echo -e "  Grafana:             ${CYAN}http://localhost:3000${NC}"
echo -e "  InfluxDB:            ${CYAN}http://localhost:8086${NC}"
echo ""
echo -e "  Frontend dev servers (run separately):"
echo -e "    SAP Sync UI:       ${CYAN}make fe-sap   ${NC} → http://localhost:5173"
echo -e "    S7 Status UI:      ${CYAN}make fe-s7    ${NC} → http://localhost:5179"
echo -e "    Admin UI:          ${CYAN}make fe-admin ${NC} → http://localhost:5176"
echo -e "    Binpack UI:        ${CYAN}make fe-binpack${NC} → http://localhost:5175"
echo ""
echo -e "  Status:              ${CYAN}make ps${NC}"
echo -e "  Logs:                ${CYAN}make logs${NC}"
echo ""
