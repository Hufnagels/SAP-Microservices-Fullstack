#!/usr/bin/env bash
# ── MicroServices — Graceful Shutdown Script ───────────────────────────────
# Stops the stack in reverse startup order.
# Usage:
#       ./shutdown.sh              # stop app stack only (MSSQL kept running)
#       ./shutdown.sh --infra      # + stop MSSQL infrastructure
#       ./shutdown.sh --sim        # also stop opcua-simulator profile
#       ./shutdown.sh --all        # stop everything (app + sim + infra)
# ──────────────────────────────────────────────────────────────────────────

set -euo pipefail

STOP_INFRA=false
STOP_SIM=false
for arg in "$@"; do
  [[ "$arg" == "--infra" || "$arg" == "--all" ]] && STOP_INFRA=true
  [[ "$arg" == "--sim"   || "$arg" == "--all" ]] && STOP_SIM=true
done

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${YELLOW}  $1${NC}"; }

# ── Step 0: Frontend dev servers ──────────────────────────────────────────
step "Stopping frontend dev servers (Vite)..."
FE_PORTS=(5173 5174 5175 5176 5178 5179)
FE_NAMES=("sap-sync-ui" "sap-map-ui" "binpack-ui" "admin-ui" "live-labeling-ui" "s7-status-ui")
KILLED=0
for i in "${!FE_PORTS[@]}"; do
  port="${FE_PORTS[$i]}"
  name="${FE_NAMES[$i]}"
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    kill "$pid" 2>/dev/null && info "Stopped $name (:$port, pid $pid)" && ((KILLED++)) || true
  fi
done
if [[ $KILLED -eq 0 ]]; then
  info "No frontend dev servers were running"
else
  ok "$KILLED frontend dev server(s) stopped"
fi

# ── Step 1: OPC-UA simulator (if running) ─────────────────────────────────
if $STOP_SIM; then
  step "Stopping OPC-UA simulator..."
  docker compose --profile sim stop opcua-simulator 2>/dev/null || true
  docker compose --profile sim rm -f opcua-simulator 2>/dev/null || true
  ok "OPC-UA simulator stopped"
fi

# ── Step 2: Monitoring stack + Portainer ──────────────────────────────────
step "Stopping monitoring stack (Grafana, Prometheus, Loki, Promtail, InfluxDB, Portainer)..."
docker compose stop grafana promtail loki prometheus influxdb portainer 2>/dev/null || true
ok "Monitoring stack + Portainer stopped"

# ── Step 3: App services ───────────────────────────────────────────────────
step "Stopping app services..."
docker compose stop \
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
  rabbitmq 2>/dev/null || true
ok "App services stopped"

# ── Step 4: Auth service ───────────────────────────────────────────────────
step "Stopping auth-service..."
docker compose stop auth-service 2>/dev/null || true
ok "auth-service stopped"

# ── Step 5: Gateway ────────────────────────────────────────────────────────
step "Stopping Traefik gateway..."
docker compose stop traefik 2>/dev/null || true
ok "Traefik stopped"

# ── Step 6: Databases ──────────────────────────────────────────────────────
step "Stopping PostgreSQL databases..."
docker compose stop postgres-auth postgres-files postgres postgres-maps postgres-labeling postgres-opcua 2>/dev/null || true
ok "Databases stopped"

# ── Step 7: MSSQL infrastructure (optional) ───────────────────────────────
if $STOP_INFRA; then
  step "Stopping MSSQL infrastructure..."
  docker compose -f infrastructure/mssql/docker-compose.yml stop
  ok "MSSQL infrastructure stopped (data volume preserved)"
fi

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  MicroServices stack stopped${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
if ! $STOP_INFRA; then
  echo -e "  ${YELLOW}MSSQL infrastructure is still running.${NC}"
  echo -e "  To stop it too:  ${CYAN}./shutdown.sh --infra${NC}"
  echo -e "  To stop + wipe:  ${CYAN}make infra-reset${NC}"
fi
echo ""
echo -e "  To restart:      ${CYAN}./startup.sh${NC}"
echo ""
