# Adding a New Service to BRD MicroServices

> Running services are never touched. Each step is isolated and additive.
> LOTGEN (`lotgen-service` + `lotgen-ui`) is used as the worked example throughout.

---

## Overview — What you will create

| File / section | Purpose |
|---|---|
| `services/<name>/` | Backend service code + Dockerfile |
| `docker-compose.yml` | DB + service + (optional) UI entries |
| `api-gateway/traefik/dynamic.yml` | Traefik router + backend |
| `frontend/<name>-ui/` | (optional) SPA frontend |
| `docs/<Name>.md` | Service documentation |

---

## Step 1 — Create the backend service

### 1a. Directory structure

```
services/
└── my-service/
    ├── Dockerfile
    ├── requirements.txt
    └── app/
        ├── __init__.py
        ├── main.py          # FastAPI app
        ├── settings.py      # pydantic-settings config
        ├── security.py      # JWT verification (copy from lotgen-service)
        ├── database.py      # DB init + helpers
        └── routes/
            ├── __init__.py
            └── my_routes.py
```

### 1b. Dockerfile

Build context is the **repo root** (so `COPY` paths start from there):

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY services/my-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/my-service/app /app/app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 1c. requirements.txt (minimal)

```
fastapi
uvicorn[standard]
pydantic
pydantic-settings
psycopg2-binary
python-jose[cryptography]
```

### 1d. settings.py

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    postgres_url: str = "postgresql://postgres:postgres@postgres-my:5432/my_db"
    jwt_secret: str   = "change-me-in-production-at-least-256-bits-long"
    jwt_algo: str     = "HS256"

    model_config = {"env_file": ".env"}
```

### 1e. security.py — copy verbatim from `lotgen-service`

JWT tokens are shared across all services via the same `JWT_SECRET`. Copy
`services/lotgen-service/app/security.py` and use the same `get_current_user`
and `require_admin` FastAPI dependencies.

### 1f. main.py — minimal template

```python
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
from .settings import Settings
from . import database, security
from .routes.my_routes import router

logging.basicConfig(level=logging.INFO)
settings = Settings()

app = FastAPI(title="My Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    logging.exception("Unhandled error")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )

app.include_router(router)

@app.on_event("startup")
def on_startup():
    database.init(settings.postgres_url)
    security.configure(settings.jwt_secret, settings.jwt_algo)
```

### 1g. routes/my_routes.py — minimal template

```python
from fastapi import APIRouter, Depends
from app.security import get_current_user

router = APIRouter(prefix="/my", tags=["my"])

@router.get("/health")
def health():
    return {"status": "ok", "service": "my-service"}

@router.get("/items")
def list_items(user: dict = Depends(get_current_user)):
    return []
```

> **Prefix rule:** Keep the router prefix (`prefix="/my"`) identical to the
> Traefik path prefix (`PathPrefix("/my")`). Traefik does **not** strip the
> prefix — the service receives the full path.

---

## Step 2 — Add to `docker-compose.yml`

Open `docker-compose.yml`. Find the `# ── <last service> ──` block and append
**after** it (before the `volumes:` section).

### 2a. If the service needs its own Postgres DB

```yaml
  # ── My Service ───────────────────────────────────────────────────────────────

  postgres-my:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: my_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - ./data/pg-my:/var/lib/postgresql/data
    ports:
      - "5441:5432"           # pick next free host port — see docs/Ports.md
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d my_db"]
      interval: 5s
      timeout: 5s
      retries: 10

  my-service:
    restart: unless-stopped
    build:
      context: .
      dockerfile: services/my-service/Dockerfile
    environment:
      APP_NAME: my-service
      POSTGRES_URL: postgresql://postgres:${POSTGRES_PASSWORD:-postgres}@postgres-my:5432/my_db
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production-at-least-256-bits-long}
    depends_on:
      postgres-my:
        condition: service_healthy
```

### 2b. If the service shares an existing DB (postgres-shared on port 5434)

```yaml
  my-service:
    restart: unless-stopped
    build:
      context: .
      dockerfile: services/my-service/Dockerfile
    environment:
      APP_NAME: my-service
      POSTGRES_URL: postgresql://postgres:${POSTGRES_PASSWORD:-postgres}@postgres:5432/my_db
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production-at-least-256-bits-long}
    depends_on:
      - postgres
```

### 2c. If there is a frontend SPA

```yaml
  my-ui:
    build:
      context: frontend/my-ui
      dockerfile: Dockerfile
    ports:
      - "5181:80"             # pick next free host port
    restart: unless-stopped
```

---

## Step 3 — Add Traefik routing to `api-gateway/traefik/dynamic.yml`

### 3a. Router entry (inside `routers:`)

```yaml
    my:
      rule: "PathPrefix(`/my`)"
      service: my-service
      entryPoints: [web]
      middlewares: [cors]
```

> Add `strip-my` middleware only if the backend routes do **not** include the
> path prefix. If `router = APIRouter(prefix="/my")` is used in the backend,
> no stripping is needed (the backend handles the full `/my/...` path).

### 3b. Strip middleware (only if needed — inside `middlewares:`)

```yaml
    strip-my:
      stripPrefix:
        prefixes: ["/my"]
```

### 3c. Backend entry (inside `services:`)

```yaml
    my-service:
      loadBalancer:
        servers:
          - url: "http://my-service:8000"
```

### 3d. Restart Traefik to pick up the new route

Traefik watches the file but sometimes misses bind-mount changes:

```bash
# Dev (Mac)
docker compose restart traefik

# Production (LXC)
ssh user@10.63.10.111 "cd /opt/microservices && sudo docker compose restart traefik"
```

---

## Step 4 — (Optional) Create the frontend SPA

### 4a. Directory structure

```
frontend/
└── my-ui/
    ├── Dockerfile
    ├── .dockerignore
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts
    └── src/
        └── ...
```

### 4b. Dockerfile (identical for all React/Vite SPAs)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx vite build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 4c. .dockerignore (mandatory — prevents macOS binaries entering Linux image)

```
node_modules
dist
.env
```

### 4d. nginx.conf — list all backend prefixes the UI calls

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Proxy API calls to Traefik — add every prefix the SPA uses
    location ~ ^/(auth|my) {
        proxy_pass http://traefik:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 4e. Frontend API URLs — use relative paths

```typescript
// src/hooks/useMyApi.ts
const API      = ''        // → /my/...  (nginx proxies to Traefik)
const AUTH_URL = '/auth'   // → /auth/... (nginx proxies to Traefik)
```

Do **not** hardcode `http://localhost:80` — that breaks inside Docker.

### 4f. Add port 5181 to Traefik CORS (if needed for dev)

`api-gateway/traefik/dynamic.yml`, inside `accessControlAllowOriginList`:

```yaml
"http://localhost:5181", "http://10.63.10.111:5181"
```

---

## Step 5 — Start only the new services

Do **not** run `docker compose up -d` (restarts everything). Start only what is new:

```bash
# Backend + DB
docker compose up -d --build postgres-my my-service

# After traefik restart — verify the route
curl http://localhost/my/health

# Frontend (if added)
docker compose up -d --build my-ui
curl -o /dev/null -w "%{http_code}" http://localhost:5181/
```

All existing services continue running undisturbed.

---

## Step 6 — Deploy to LXC (Proxmox)

### 6a. Push code

```bash
bash docs/migration/scripts/deploy.sh
```

`deploy.sh` rsyncs code → `~/ms-staging` → `/opt/microservices` on the LXC.
It never touches `data/` or `files/`.

### 6b. Create data directory on LXC (first time only)

```bash
ssh user@10.63.10.111
sudo mkdir -p /opt/microservices/data/pg-my
# PostgreSQL sets its own ownership on first start — leave as root
```

### 6c. Build and start new services on LXC

```bash
ssh user@10.63.10.111
cd /opt/microservices

# Build only the new images
sudo docker compose build postgres-my my-service

# Start only the new containers
sudo docker compose up -d postgres-my my-service

# Reload Traefik routes
sudo docker compose restart traefik

# Verify
curl http://localhost/my/health
```

### 6d. If a frontend was added

```bash
sudo docker compose up -d --build my-ui
```

---

## Step 7 — Document the service

Create `docs/<Name>.md` following the `LOTGEN.md` template:

- Overview + purpose
- Architecture diagram
- All API endpoints (method, path, auth, description)
- DB schema (SQL)
- Environment variables
- Quick-start commands

Update `docs/Ports.md`:
- Add the service row to the backend table
- Add the UI row to the frontend table
- Add `psql` connect command

Update `docs/migration/MIGRATION_SUMMARY.md`:
- Add `pg-my` to the `mkdir -p` command in step 3a
- Add the UI URL to the Service URLs table

---

## Checklist

```
[ ] services/my-service/Dockerfile          — build context = repo root
[ ] services/my-service/app/main.py         — FastAPI + CORS + exception handler
[ ] services/my-service/app/settings.py     — pydantic-settings, env_file=".env"
[ ] services/my-service/app/security.py     — JWT from shared JWT_SECRET
[ ] docker-compose.yml                      — postgres-my + my-service (+ my-ui)
[ ] api-gateway/traefik/dynamic.yml         — router + service entry
[ ] docker compose restart traefik          — force route reload
[ ] curl http://localhost/my/health         — route confirmed ✓
[ ] frontend/.dockerignore                  — node_modules excluded
[ ] frontend/nginx.conf                     — API prefixes proxied to traefik
[ ] frontend API URLs                       — relative paths only ('')
[ ] docs/Ports.md                           — port row added
[ ] docs/<Name>.md                          — service documentation
[ ] docs/migration/MIGRATION_SUMMARY.md     — pg-my mkdir + URL table
[ ] LXC: mkdir /opt/microservices/data/pg-my
[ ] LXC: docker compose up -d postgres-my my-service
[ ] LXC: docker compose restart traefik
```

---

## Quick Reference — Port Allocation

| Host port | Service |
|---|---|
| 5432 | adviser-helper-postgres (unrelated project) |
| 5433 | postgres-auth |
| 5434 | postgres (shared) |
| 5435 | postgres-maps |
| 5436 | postgres-files |
| 5437 | postgres-labeling |
| 5438 | postgres-opcua |
| 5439 | postgres-lot (LOTGEN standalone dev) |
| 5440 | postgres-lot (MicroServices) |
| **5441+** | **next free DB port** |
| 5173–5176 | frontend UIs (sap-sync, sap-map, binpack, admin) |
| 5177 | lotgen-ui |
| 5178–5179 | live-labeling-ui, s7-status-ui |
| **5180+** | **next free UI port** |
