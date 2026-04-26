# ── MicroServices — Makefile ──────────────────────────────────────────────
# Usage:
#   make infra-up       Start infrastructure (MSSQL) — do this first on a new machine
#   make infra-init     Initialize MSSQL schema (ReportingDB + tables)
#   make up             Start all app services
#   make up-core        Start only auth + traefik (quick verification)
#   make down           Stop app services (keeps data)
#   make down-all       Stop app + infra (keeps data)
#   make reset          Full wipe: stop everything, delete ALL volumes, restart
#   make logs           Follow all logs
#   make ps             Show running containers

COMPOSE      = docker compose
INFRA_FILE   = infrastructure/mssql/docker-compose.yml
INFRA        = $(COMPOSE) -f $(INFRA_FILE)
APP          = $(COMPOSE)

# ── Infrastructure ─────────────────────────────────────────────────────────────

infra-up:
	@echo "Starting MSSQL infrastructure..."
	$(INFRA) up -d
	@echo "Waiting for SQL Server to accept connections..."
	@sleep 15
	@echo "MSSQL is up."

infra-down:
	$(INFRA) down

infra-reset:
	$(INFRA) down -v

infra-init:
	@echo "Initializing MSSQL schema..."
	@CONTAINER=$$($(APP) ps -q sap-b1-adapter-service 2>/dev/null); \
	if [ -z "$$CONTAINER" ]; then \
		echo "ERROR: sap-b1-adapter-service is not running. Run 'make up-sap' first."; \
		exit 1; \
	fi; \
	docker cp infrastructure/mssql/init.sql $$CONTAINER:/tmp/init.sql && \
	docker cp infrastructure/mssql/init-schema.py $$CONTAINER:/tmp/init-schema.py && \
	$(APP) exec sap-b1-adapter-service python3 /tmp/init-schema.py
	@echo "Done."

# ── App services ───────────────────────────────────────────────────────────────

up:
	$(APP) up --build -d

up-core:
	$(APP) up --build -d traefik postgres-auth auth-service

up-sap:
	$(APP) up --build -d sap-b1-adapter-service

up-binpack:
	$(APP) up --build -d binpack-service

up-labeling:
	$(APP) up --build -d labeling-service

up-opcua:
	$(APP) up --build -d opcua-service

up-portainer:
	$(APP) up -d portainer

up-influx:
	$(APP) up -d influxdb

up-sim:
	$(APP) --profile sim up --build -d opcua-simulator

down:
	$(APP) down

down-all:
	$(APP) down
	$(INFRA) down

# ── Full reset — DESTROYS ALL DATA ────────────────────────────────────────────

reset:
	@echo "WARNING: This will delete all volumes (all data). Ctrl-C to cancel."
	@sleep 3
	$(APP) down -v
	$(INFRA) down -v
	$(MAKE) infra-up
	$(MAKE) up

# ── Frontend dev servers ───────────────────────────────────────────────────────
# Each runs its own Vite dev server. API calls go through http://localhost (Traefik).
# Ports: sap-sync-ui=5173, sap-map-ui=5174, binpack-ui=5175, admin-ui=5176, live-labeling-ui=5178, s7-status-ui=5179
# Package manager: pnpm (workspace defined in pnpm-workspace.yaml)

fe-install:
	pnpm install

fe-sap:
	cd frontend/sap-sync-ui && pnpm dev

# Run sap-sync-ui frontend in no-Docker mode (proxies directly to local dev servers)
fe-sap-dev:
	cd frontend/sap-sync-ui && AUTH_DEV_URL=http://localhost:8002 SAP_DEV_URL=http://localhost:8003 pnpm dev

fe-map:
	cd frontend/sap-map-ui && pnpm dev

fe-binpack:
	cd frontend/binpack-ui && pnpm dev

# Run binpack-ui in no-Docker mode (proxies directly to local dev servers)
fe-binpack-dev:
	cd frontend/binpack-ui && AUTH_DEV_URL=http://localhost:8002 BINPACK_DEV_URL=http://localhost:8004 pnpm dev

fe-admin:
	cd frontend/admin-ui && pnpm dev

fe-labeling:
	cd frontend/live-labeling-ui && pnpm dev

fe-s7:
	cd frontend/s7-status-ui && pnpm dev

fe-all:
	(cd frontend/sap-sync-ui      && pnpm dev) &
	(cd frontend/sap-map-ui       && pnpm dev) &
	(cd frontend/binpack-ui       && pnpm dev) &
	(cd frontend/admin-ui         && pnpm dev) &
	(cd frontend/live-labeling-ui && pnpm dev) &
	(cd frontend/s7-status-ui     && pnpm dev) &
	wait

# Run services directly (no Docker) — use when Docker daemon is not available
# PYTHONPATH=../.. makes `shared/` importable the same way the Dockerfile does
# Ports: auth=8002, sap-b1-adapter=8003

dev-auth:
	cd services/auth-service && PYTHONPATH=../.. python3.14 -m uvicorn app.main:app --reload --port 8002

dev-sap:
	cd services/sap-b1-adapter-service && PYTHONPATH=../.. python3.14 -m uvicorn app.main:app --reload --port 8003

# Run labeling-service backend directly (no Docker) — proxied via Vite on port 5177
dev-labeling:
	cd services/labeling-service && VITE_BACKEND_URL=http://localhost:8001 uvicorn app.main:app --reload --port 8001

dev-opcua:
	cd services/opcua-service && PYTHONPATH=../.. uvicorn app.main:app --reload --port 8006

# ── Observation ───────────────────────────────────────────────────────────────

logs:
	$(APP) logs -f

ps:
	@echo "=== Infrastructure ==="
	$(INFRA) ps
	@echo ""
	@echo "=== App services ==="
	$(APP) ps

.PHONY: infra-up infra-down infra-reset infra-init up up-core up-sap up-binpack up-labeling up-opcua up-portainer up-influx up-sim down down-all reset logs ps \
        fe-install fe-sap fe-sap-dev fe-map fe-binpack fe-binpack-dev fe-admin fe-labeling fe-s7 fe-all dev-auth dev-sap dev-labeling dev-opcua
