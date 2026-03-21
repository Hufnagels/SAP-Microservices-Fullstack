# Changelog

All notable changes to the MicroServices monorepo are documented here.

---

## 2026-03-20 (session 12)

### auth-service — `POST /auth/refresh` endpoint

- **`app/security.py`** — added `get_current_user` FastAPI dependency (validates Bearer JWT, returns payload, no role check)
- **`app/routes/auth.py`** — added `POST /auth/refresh`: validates current token, issues fresh 8 h JWT with same `sub`/`role`/`service_roles`; returns `TokenResponse`; returns 401 if token is already expired

### All frontends — SessionGuard (idle timeout)

Implemented on all 6 UIs: `admin-ui`, `sap-sync-ui`, `sap-map-ui`, `binpack-ui`, `s7-status-ui`, `live-labeling-ui`.

- **`src/features/auth/authSlice.ts`** (each UI) — added `renewToken` async thunk (`POST /auth/refresh`); `renewToken.fulfilled` stores new token in Redux + localStorage
- **`src/components/common/SessionGuard.tsx`** (new, each UI) — listens for `mousemove`, `click`, `keydown`, `scroll`, `touchstart`; after **15 minutes** of inactivity shows a MUI Dialog:
  - **Stay logged in** → `dispatch(renewToken())` → fresh token; if renewal fails (expired) → forced `signOut`
  - **Exit** → `dispatch(signOut())`
- **`src/App.tsx`** (each UI) — renders `{token && <SessionGuard />}` outside `<BrowserRouter>`

### sap-map-ui — removed "My Account"

- **`src/components/layout/Header.tsx`** — removed "My Account" `<MenuItem>` from avatar dropdown menu
- **`src/routes/routes.tsx`** — removed `/account` route entry, removed `UserAccount` and `PersonIcon` imports

### README.md

- Added section **8.7 Session Guard** (idle timeout behaviour, backend endpoint, how to change timeout)
- Added **10.1 Session Guard** troubleshooting table
- Added note to sap-map-ui section: "My Account" removed
- Added Grafana InfluxDB datasource correct-values table

---

## 2026-03-20 (session 11)

### opcua-service — node-config CRUD bug fixes

- **`app/routes/opcua.py`** — `NodeDefCreate` and `NodeDefUpdate` Pydantic models were missing `sim_behavior`, `sim_min`, `sim_max`, `sim_period` fields; FastAPI stripped them from the request body before they reached the DB → PUT always sent original values back
- **`app/routes/opcua.py`** — `node_config_create` handler updated to pass sim params to `database.create_node()`
- **`app/database.py`** — `update_node()` `allowed` set was missing `sim_behavior`, `sim_min`, `sim_max`, `sim_period` → silently ignored all sim field changes; set now includes all four
- **`app/database.py`** — `create_node()` signature extended to accept `sim_behavior`, `sim_min`, `sim_max`, `sim_period`; INSERT updated accordingly

### s7-status-ui — NodeDialog form reset bug fix

- **`src/pages/nodeconfig/NodeConfigPage.tsx`** — removed `useEffect(() => { setForm(initial); }, [initial])` from `NodeDialog`; the `initial` prop is an inline object recreated on every parent re-render, so the effect fired continuously and overwrote user edits with the original DB values
- Added `key={editTarget.id}` to the Edit dialog and `key={addOpen ? 'add-open' : 'add-closed'}` to the Add dialog — forces remount on open/target-change so `useState(initial)` initialises fresh without the effect

### InfluxDB — org renamed  → `compani`

`DOCKER_INFLUXDB_INIT_ORG` is bootstrap-only; renaming requires the HTTP API:
```bash
# Get org ID
curl -s http://localhost:8086/api/v2/orgs -H "Authorization: Token my-super-secret-token"
# Rename
curl -X PATCH http://localhost:8086/api/v2/orgs/<id> \
  -H "Authorization: Token my-super-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"name":"compani"}'
```
- **`.env`** — added `INFLUXDB_ORG=compani` (and full InfluxDB block)
- **`docker-compose.yml`** — default changed to `compani`
- **`monitoring/grafana/provisioning/datasources/datasources.yml`** — `organization: compani`
- `opcua-service` rebuilt; `grafana` restarted

### Grafana — OPC-UA dashboard rewrite

- **`monitoring/grafana/provisioning/dashboards/opcua-dashboard.json`** — full rewrite:
  - **Panel 1 — Temperature** (full row): dedicated timeseries, `node_name == "temperature"`, added missing `_field == "value"` filter
  - **Panel 2 — Working Speed** (full row): new panel, `node_name == "working_speed"`; replaced the stale "Setpoint" gauge (Setpoint node no longer exists)
  - **Panel 3 — Alarms State Timeline** (w=18): fixed query — added `map(fn: (r) => ({r with _value: int(v: r._value)}))` cast so state-timeline receives integers 0/1
  - **Panel 4 — Active Alarms (last 5 min)** (w=6): unchanged logic, repositioned
  - **Datasource variable**: changed from `${DS_INFLUXDB-OPC-UA}` (hyphens broke template resolution → Prometheus selected instead) to `${datasource}` with `"regex": "InfluxDB-OPC-UA"` — pins the variable to the correct datasource

### README.md — major update

- Architecture diagram updated: added `postgres-opcua`, `influxdb`, `opcua-simulator (--profile sim)`
- Repo structure: added `opcua-simulator/` entry
- External systems: added OPC-UA Simulator and InfluxDB 2.7
- Section 8.6 s7-status-ui fully rewritten: pages table (Status / Charts / Node Config), Node Config details (unit Autocomplete, sim behaviors, trapezoidal period), Charts localStorage persistence, direct DB/InfluxDB connection params table, simulator quick-start
- Troubleshooting: 5 new rows (OPC-UA 503, charts no data, node config PUT, sim hot-reload delay, sim_behavior reverts)
- New subsection: "Renaming the InfluxDB organisation (without wiping data)" with step-by-step API commands and Grafana datasource settings table

---

## 2026-03-20 (session 10)

### opcua-service — InfluxDB timeseries persistence

- **`app/client.py`** — split `_default_nodes()` into `_default_process_nodes()` (floats → `DB_ProcessData`) and `_default_alarm_nodes()` (bools → `DB_Alarms`); `_read_all_nodes()` now returns a tuple `(process_data, alarm_data)`
- **`app/client.py`** — added `InfluxWriter` class: async write using `influxdb_client[async]`; writes `process_data` and `alarms` InfluxDB measurements with line protocol after every poll cycle; `query()` method for Flux-based timeseries retrieval
- **`app/client.py`** — `OPCUAPoller` now accepts `influx: InfluxWriter | None`; InfluxDB write errors are logged as warnings (do not kill the poll loop)
- **`app/main.py`** — instantiates `InfluxWriter` in lifespan context, passes to poller, closes on shutdown
- **`app/settings.py`** — added `influxdb_url`, `influxdb_token`, `influxdb_org`, `influxdb_bucket`
- **`requirements.txt`** — added `influxdb-client[async]`
- **`app/routes/opcua.py`** — added `GET /opcua/nodes` (returns process + alarm node name lists) and `GET /opcua/timeseries` (Flux query with measurement, node, from_ts, to_ts, limit params)

### opcua-simulator — New Docker OPC-UA simulation server

- **`services/opcua-simulator/`** — new service; asyncua `Server` on port 4840
- Generates realistic data: Temperature (sine 20–30°C), Pressure (sine 0.95–1.05 bar), FlowRate (random walk 3–7), Setpoint (static 25)
- Alarm nodes: `HighTemp` (Temp > 28), `LowPressure` (Pressure < 0.95), `Running` (always True)
- Started with: `docker compose --profile sim up -d opcua-simulator`
- Set `OPCUA_ENDPOINT=opc.tcp://opcua-simulator:4840` to use with opcua-service

### docker-compose.yml — InfluxDB + simulator

- Added `influxdb:2.7` service (port 8086, auto-setup bucket `opcua`)
- Added `opcua-simulator` service under `profiles: [sim]`
- `opcua-service` now depends on `influxdb`; 4 new INFLUXDB env vars injected
- `grafana` now depends on `influxdb`

### Grafana — OPC-UA dashboard provisioned

- **`monitoring/grafana/provisioning/datasources/datasources.yml`** — added `InfluxDB-OPC-UA` datasource (Flux mode)
- **`monitoring/grafana/provisioning/dashboards/dashboards.yml`** — created dashboard provider (folder: OPC-UA)
- **`monitoring/grafana/provisioning/dashboards/opcua-dashboard.json`** — 4-panel dashboard: Process Data time series, Setpoint gauge, Active Alarms stat, Alarms State Timeline

### opcua-service — node_definitions + sensor_units DB

- **`app/database.py`** (new file) — PostgreSQL registry backed by `postgres-opcua` (port 5438, `opcua_db`)
  - `node_definitions` table: `id, name, node_id, type, unit, description, is_active, sim_behavior, sim_min, sim_max, sim_period, created_at`; seeded with 7 nodes (Temperature, Pressure, Flow Rate, Working speed, High Temperature, Low Pressure, Running)
  - `sensor_units` table: 45+ standard industrial units grouped by category (Temperature, Pressure, Flow, Speed, Electrical, Power, Weight, Time, Concentration); `UNIQUE(unit)` constraint, seeded once
  - CRUD helpers: `list_nodes()`, `get_node()`, `create_node()`, `update_node()`, `delete_node()`, `build_node_maps()`; `list_sensor_units()`
  - `build_node_maps()` returns `(process_nodes, alarm_nodes)` dicts keyed by `name.lower().replace(" ", "_")` → node_id; used by poller on startup and after hot-reload
- **`app/settings.py`** — added `postgres_url`
- **`app/main.py`** — calls `database.configure(settings.postgres_url)` in lifespan; initial `build_node_maps()` + `poller.reload_nodes()` on startup
- **`app/routes/opcua.py`** — new endpoints:
  - `GET /opcua/node-config` — list all node definitions (viewer+)
  - `POST /opcua/node-config` — create node, hot-reload poller (operator+)
  - `PUT /opcua/node-config/{id}` — update node, hot-reload poller (operator+)
  - `DELETE /opcua/node-config/{id}` — delete node, hot-reload poller (operator+)
  - `GET /opcua/sensor-units` — list all sensor units (viewer+)
- **`app/client.py`** — removed hardcoded `_default_process_nodes()` / `_default_alarm_nodes()`; added `reload_nodes(monitored, alarms)` method for hot-reload without restart
- **`requirements.txt`** — added `psycopg2-binary`

### opcua-simulator — rewrite with DB-backed behaviors

- **`app/server.py`** — full rewrite:
  - Reads node definitions from `postgres-opcua` on startup via `load_node_defs()`; falls back to `_default_nodes()` if DB unavailable
  - `NodeSim` dataclass: `tick(dt, process_values)` implements all 8 behaviors: `sine`, `random_walk`, `random`, `sawtooth`, `trapezoidal`, `step`, `constant`, `threshold`
  - **Trapezoidal**: `sim_period` = ONE phase duration; full cycle = 4 × period: ramp-up → plateau → ramp-down → off
  - **Threshold**: alarm logic reads process node values by name (e.g. `temperature`, `pressure`) from `process_values` dict
  - Hot-reload: re-reads DB config every 15 s in the main loop; updates `sims[nid].cfg` in-place without restarting
- **`requirements.txt`** — added `psycopg2-binary`
- **`docker-compose.yml`** — added `POSTGRES_URL` env var to `opcua-simulator`; added `depends_on: postgres-opcua`

### s7-status-ui — NodeConfigPage (new page)

- **`src/pages/nodeconfig/NodeConfigPage.tsx`** — new page: CRUD table of node definitions
  - `NodeDialog`: fields for name, OPC-UA Node ID, type, unit (MUI Autocomplete freeSolo grouped by category), description, is_active Switch, sim_behavior Select (with hint text), sim_min / sim_max / sim_period TextFields
  - `ConfirmDelete` dialog
  - Hot-reload on save/delete: opcua-service `_reload_poller()` called server-side after every mutation
- **`src/api/opcuaApi.ts`** — added `SensorUnit`, `NodeDef`, `NodeDefCreate`, `NodeDefUpdate` interfaces; added `getSensorUnits()`, `getNodeConfig()`, `createNodeConfig()`, `updateNodeConfig()`, `deleteNodeConfig()`
- **`src/routes/routes.tsx`** — added `/node-config` route with `SettingsInputComponentIcon`, label "Node Config"

### s7-status-ui — Charts page

- **`src/pages/charts/ChartsPage.tsx`** — new page: measurement + node selector, 4 time-range toggles (10min/1h/8h/24h), Recharts `LineChart` for process data, alarm state summary + step chart for alarms; auto-refreshes every 30 s; last selected Measurement and Node persisted to `localStorage` (`s7ui.charts.measurement`, `s7ui.charts.node`)
- **`src/api/opcuaApi.ts`** — added `getNodes()` and `getTimeseries()` typed helpers
- **`src/routes/routes.tsx`** — added `/charts` route with `ShowChartIcon`
- **`package.json`** — added `recharts ^2`

### s7-status-ui — S7StatusPage rename

- **`src/pages/s7/S7StatusPage.tsx`** — renamed "Process Data" → "Node List" throughout

---

## 2026-03-19 (session 9)

### opcua-service — New microservice (S7-1500 OPC-UA integration)

**New service:** `services/opcua-service/`

- **`app/client.py`** — Async `OPCUAPoller` class using `asyncua 1.1.5`:
  - Polls configured nodes on a fixed interval (default 500 ms)
  - Auto-reconnects on failure with per-poll error counter
  - Exposes `get_status()`, `get_statistics()`, `get_latest()`, `write_value()`, `read_node()`, `browse_nodes()`
  - Duck-typed `_SubHandler` class (no base class inheritance) — required because `asyncua 1.1.5` removed `SubHandler` and `SubscriptionHandler` is a `Union` type alias, not a base class
- **`app/settings.py`** — Extends `CommonSettings`; env vars: `OPCUA_ENDPOINT`, `OPCUA_USERNAME`, `OPCUA_PASSWORD`, `OPCUA_SECURITY_MODE`, `POLL_INTERVAL_MS`
- **`app/main.py`** — FastAPI with `lifespan` context manager: starts/stops `OPCUAPoller` on startup/shutdown
- **`app/routes/opcua.py`** — JWT-protected endpoints:
  - `GET /opcua/health` — public health check
  - `GET /opcua/status` — connection + server state (viewer+)
  - `GET /opcua/process-data` — latest polled node values (viewer+)
  - `GET /opcua/statistics` — read/write counts, avg/min/max read times (viewer+)
  - `GET /opcua/browse-nodes` — browse OPC-UA node tree (viewer+)
  - `GET /opcua/read-node` — read a single node value (viewer+)
  - `POST /opcua/write-value` — write a value to a node (operator+)
- **`Dockerfile`** — same build-context-at-repo-root pattern as other services
- **`requirements.txt`** — `asyncua==1.1.5`, `cryptography`, `fastapi`, `uvicorn[standard]`

**`docker-compose.yml`** — added `opcua-service` block with all OPC-UA env vars.

**`api-gateway/traefik/dynamic.yml`** — added `opcua` router (`PathPrefix('/opcua')`) + `opcua-service` load-balancer; added `http://localhost:5179` to CORS allowed origins.

---

### s7-status-ui — New frontend (S7-1500 live status dashboard)

**New app:** `frontend/s7-status-ui/` — React 19 + TypeScript + Vite + MUI + Redux on port **5179**.

- **Theme:** Industrial dark — cyan primary `#00bcd4`, deep navy `#0a0f1a` / `#111827`
- **`src/api/opcuaApi.ts`** — axios instance with `/opcua` base URL; JWT interceptor reads token from `localStorage`
- **`src/pages/s7/S7StatusPage.tsx`** — Three MUI cards auto-refreshing every 1500 ms via `setInterval` + `Promise.allSettled`:
  - **ConnectionCard** — endpoint, security mode, server state, namespace count, uptime, consecutive errors
  - **StatisticsCard** — total/successful/failed reads, subscription updates, avg/min/max read time
  - **ProcessDataCard** — live values for all monitored nodes with chip-style display
- **Layout:** `Sidebar` with single nav item "S7-1500 Status" + `DesignServicesIcon`; `Header` titled "S7-1500 Monitor"
- **`src/pages/SignIn.tsx`** — MUI card login form; navigates to `/s7` on success
- **`vite.config.ts`** — port 5179, proxy `/auth` → `http://localhost:8001`, `/opcua` → `http://localhost:8006`

---

### sap-b1-adapter-service — Username in query save request body

- **`services/sap-b1-adapter-service/app/routes/queries.py`** — Added `username: Optional[str] = None` to `QueryDefIn` model; both `create_query` and `update_query` handlers now use `body.username or current_user.get("sub")` so the frontend can pass the display username explicitly
- **`frontend/sap-sync-ui/src/features/queries/queriesSlice.ts`** — Added `username?: string` to `QueryDefIn` interface
- **`frontend/sap-sync-ui/src/pages/querys/QueryBuilder.tsx`** — Added `username: user?.username` to the save request body

---

### maps-service — `bulk_upsert_partners` INSERT column mismatch fix

- **`services/maps-service/app/database.py`** — Removed `synced_at` from the `INSERT INTO map_partners (...)` column list; the column has `DEFAULT NOW()` so it does not need to be in the VALUES tuple. Fix resolved `psycopg2` error: "INSERT has more target columns than expressions".

---

## 2026-03-16 (session 8)

### live-labeling-ui — LabelDesignerPage enhancements (`src/pages/designer/LabelDesignerPage.tsx`)

**New element types — Rect + Circle (`KonvaRectNode`, `KonvaCircleNode`):**
- Added `rect` and `circle` to `ElementType`; both use `<Rect>` / `<Ellipse>` Konva primitives
- Properties: `fillColor` (`#000000` | `#ffffff` | `transparent`), `strokeColor`, `strokeWidthMm`
- ZPL output via `^GB` (Graphic Box): `corner=0` for rect, `corner=8` for circle; filled vs border logic

**QR / DataMatrix square constraint:**
- `handleTransformEnd` in `KonvaBarcodeNode`: when `el.type === 'qr' || 'datamatrix'`, clamps both dims to `Math.min(newW, newH)`
- `renderBwip` effect: for QR/DataMatrix sets `width = height = Math.max(heightMm, widthMm)` from SVG viewBox
- `renderBwip` return type extended: `{ img, heightMm, widthMm }`

**Barcode height calibration:**
- `BWIP_MM_PER_UNIT` corrected from `25.4/(72×3)` to `25.4/(72×3) × (16.82/12.82) ≈ 0.1543 mm/unit` — calibrated against real printer output (barHeight=10mm → total rendered height ≈ 16.82mm)

**dnd-kit layer reordering (`SortableLayerItem`):**
- `DndContext` + `SortableContext` (verticalListSortingStrategy) wraps the Layers panel
- `useSortable` per layer item; drag handle via `DragIndicatorIcon` with `{...listeners}`
- `handleLayerDragEnd`: works in reversed-ID space (layers panel is top-first, elements array is bottom-first), uses `arrayMove` then reverses back
- ▲/▼ buttons retained alongside drag

**300 dpi PNG export:**
- `pixelRatio = DPM / (SCALE × zoom)` where `DPM = 11.811 px/mm` at 300 dpi — normalises current zoom out of the capture
- Pre-capture: imperatively detaches all Transformers (`stage.find('Transformer') → tr.nodes([])`) and hides grid layer (`stage.findOne('#grid-layer')`) before `toDataURL`, restores after

**Template preview capture** uses the same Transformer-detach + grid-hide pattern with `pixelRatio: 0.5`.

---

### sap-b1-adapter-service — SQL preprocessor improvements (`app/core/sql_preprocessor.py`)

**Bracket notation stripping (step 0b):**
```python
sql_text = re.sub(r"\[([^\]]+)\]", r"\1", sql_text)
```
SAP B1 Service Layer rejects `[TableName]` and `Table.[Column]` syntax entirely. All brackets stripped before any other transformation.

**Auto-alias unaliased `Table.Column` expressions:**
In the `if not m:` (no alias) branch, `Table.Column` patterns now become `Table.Column AS Column`. Required because SAP B1's SQL validator treats shared column names (e.g. `ItemCode` in both `OITW` and `OITM`) as ambiguous even with an explicit table prefix, unless an alias is present.

---

### sap-b1-adapter-service — SAP B1 error transparency + SqlCode guard (`app/core/sap.py`)

- **SqlCode length check**: raises a clear `RuntimeError` before attempting `POST /SQLQueries` if `len(sql_code) > 20` — SAP B1 rejects codes longer than 20 characters with a generic 400.
- **SAP B1 error body exposed**: instead of `cr.raise_for_status()` (which discards the response body), now extracts `error.message.value` from the SAP B1 JSON error response and raises `RuntimeError(f"SAP B1 rejected SQLQuery creation ({status}): {detail}")` — the real rejection reason propagates to the frontend toast.

---

### sap-b1-adapter-service — username stored in query definitions (`app/routes/queries.py`)

- `create_query`: `created_by = current_user.get("sub")` added to INSERT into `dbo.wrk_QueryDef`
- `update_query`: `updated_by = current_user.get("sub")` and `updated_at = SYSDATETIME()` added to UPDATE

Required MSSQL migration:
```sql
ALTER TABLE dbo.wrk_QueryDef ADD created_by NVARCHAR(100) NULL;
ALTER TABLE dbo.wrk_QueryDef ADD updated_by  NVARCHAR(100) NULL;
ALTER TABLE dbo.wrk_QueryDef ADD updated_at  DATETIME2     NULL;
```

---

### sap-sync-ui — QueryBuilder query name validation (`src/pages/querys/QueryBuilder.tsx`)

- Query name `TextField`: `inputProps={{ maxLength: 20 }}`, live `error` state and `helperText` showing `N/20` character count; turns red when > 20 chars
- `handleSave`: early return with `toast.warn` if `queryName.length > 20` — prevents saving a name that SAP B1 would reject at sync time

---

## 2026-03-15 (session 7)

### live-labeling-ui — Full rebuild with admin-ui architecture + Konva designer

Replaced the single-file `LabelDesigner.jsx` (raw HTML canvas, CDN barcode libs, no auth, no routing) with a full-stack React app mirroring the admin-ui architecture.

**New dependencies (`package.json`):**
`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@reduxjs/toolkit`, `react-redux`, `react-router-dom`, `axios`, `konva`, `react-konva`, `bwip-js`, `nanoid`; React upgraded 18→19.

**New files:**

| File | Purpose |
|---|---|
| `src/theme/muiTheme.ts` | Dark bg `#080b12` (matches existing feel), light bg `#fafaf9`; orange primary `#f97316` |
| `src/features/config/index.ts` | `VITE_APP_NAME`, `VITE_APP_API_URL` constants |
| `src/features/auth/authSlice.ts` | JWT auth slice — `signIn` / `signOut` / `fetchCurrentUser` thunks |
| `src/features/theme/themeSlice.ts` | Theme toggle; defaults to **dark** |
| `src/app/store.ts` | Redux store — auth + theme only |
| `src/layout/Sidebar.tsx` | **"CAB SQUIX"** brand (800 weight, letter-spacing), single "Label Designer" nav item |
| `src/layout/Header.tsx` | **"Label design"** AppBar title, theme toggle, avatar/sign-out menu |
| `src/layout/MainLayout.tsx` | Sidebar + Header + `<Outlet />` |
| `src/pages/SignIn.tsx` | MUI login form; navigates to `/designer` on success |
| `src/App.tsx` | `ThemeProvider` + `BrowserRouter`; `ProtectedRoute`; global axios 401 → `signOut` |
| `src/main.tsx` | Redux `Provider` + `App` |
| `src/pages/designer/LabelDesignerPage.tsx` | New Konva-based label designer (see below) |

**`vite.config.ts`:** Port changed 5177→5178; `/auth` proxy added alongside `/labeling`.

**`tsconfig.json`:** Added `"types": ["vite/client"]` — fixes `import.meta.env` type errors.

---

#### LabelDesignerPage — Konva designer

**5 element types**, all selectable, moveable (drag), resizable/rotatable (Konva `Transformer`), deletable (Delete key or button), duplicatable:

| Element | Konva primitive | Renderer |
|---|---|---|
| Text | `<Text>` | Konva native — fontSize (pt), bold, align |
| Image | `<KonvaImage>` | `FileReader` → base64 → `HTMLImageElement` |
| Barcode (Code128 / Code39 / EAN-13) | `<KonvaImage>` | `bwip-js.toCanvas()` → `HTMLImageElement` |
| QR Code | `<KonvaImage>` | bwip-js `bcid: 'qrcode'` |
| DataMatrix | `<KonvaImage>` | bwip-js `bcid: 'datamatrix'` |

**Element state:** `id (nanoid), type, x/y/width/height (mm), rotation (°)` + type-specific fields.

**Konva Transformer:** `useEffect` on `selectedId` — finds node by `#id` in Stage, attaches Transformer; `onTransformEnd` resets `scaleX/scaleY` to 1 and stores new `width/height/rotation` in mm.

**Layout:**
```
[Label size selector]  [ZPL Preview btn]  [Print btn]   ← top bar
[Layers + Add toolbar] [Designer/ZPL tabs + Canvas]  [Properties panel]
```

**Properties panel:** context-sensitive — text (content textarea, font-size slider, align select, bold checkbox), barcode/QR/DataMatrix (value input, type select for barcode), image (replace button). Delete + Duplicate buttons always shown.

**ZPL generation:** Ported `buildZPL` async function from old `LabelDesigner.jsx` — supports text (`^A0N`/`^CF0`), Code128/QR/DataMatrix (`^BC`/`^BQ`/`^BX`), and image (1-bit GRF via `imageToGRF`). Label sizes preserved: `small (80×105 mm)`, `large (105×145 mm)`.

**Print:** `POST /labeling/print` via axios with JWT Bearer header; `toast.loading` / `toast.update` feedback.

**Import fix:** `bwip-js` browser types accessed via `'bwip-js/browser'` subpath export (TypeScript `bundler` resolution doesn't include the `browser` condition, but the `./browser` subpath export has explicit types).

---

## 2026-03-15 (session 6)

### auth-service — Docker CLI fix (`Dockerfile`)

`docker.io` on Debian bookworm only ships the daemon (`dockerd`), not the client binary. Replaced with `docker-ce-cli` from Docker's official apt repository:
```dockerfile
RUN apt-get install -y ca-certificates curl gnupg \
 && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor ... \
 && apt-get install -y docker-ce-cli
```
Rebuilt with `--no-cache` to bypass the stale layer. `docker version` now returns 29.3.0 inside the container — Start/Stop/Restart actions in ServiceManage are functional.

---

### admin-ui — ServiceManage improvements (`ServiceManage.tsx`)

- Added **Back** button (top-right, outlined, `← Back`) navigating to `/services/list`
- Health poll interval now reads `VITE_APP_SERVICE_CHECK_INTERVAL` env var (fallback `30_000 ms`); previously hardcoded to `10_000 ms`

---

### admin-ui — Dashboard improvements (`Dashboard.tsx`)

- **Jobs (recent)** KPI card now smooth-scrolls to the `#recent-sync-jobs` Paper on the same page instead of navigating to `/services/manage`
- Data refresh interval reads `VITE_APP_SERVICE_CHECK_INTERVAL` (was hardcoded `30_000 ms`)

---

### admin-ui — ServiceList stale-closure fix (`ServiceList.tsx`)

`healthMap` was missing from the `useMemo` dependency array for `columns`. The Status `Cell` closure captured the initial all-`'checking'` snapshot and never saw async health-check updates. Added `healthMap` to deps — status chips now resolve to UP/DOWN correctly.

---

### orders / inventory / reporting / sensor services — prefixed health endpoints

Traefik forwards the full path without stripping prefixes for these services (e.g. `/orders/health` → `orders-service:8000/orders/health`), but each service only had `@app.get("/health")`. Added a second route decorator on each:

| Service | New alias |
|---|---|
| orders-service | `@app.get("/orders/health")` |
| inventory-service | `@app.get("/inventory/health")` |
| reporting-service | `@app.get("/reporting/health")` |
| sensor-ingest-service | `@app.get("/sensor/health")` |

All four rebuilt and restarted. Health chips in ServiceList and Dashboard now resolve for these services.

---

### sap-b1-adapter-service — async sync-query endpoint + job polling

**`app/core/database.py`**
- `log_job_start` gains `sync_type: str = 'sync'` parameter, inserted into `logs_SyncJobs.sync_type`

**`app/routes/sync.py`**
- `_run_sync` gains `sync_type` param (passed to `log_job_start`); return type changed to `{"job_id": ..., "rows_written": ...}`
- Added `DashboardSyncRequest` model (`query_name`, `base_table`, `dst_schema`, `load_mode`)
- New `POST /sap/sync-query` (202 Accepted, JWT auth):
  - Creates RUNNING job row immediately → returns `{job_id}` to caller
  - Fires `_bg_run_sync` as a FastAPI `BackgroundTask`
  - Background task runs SAP fetch + MSSQL write, updates job to `SUCCESS`/`FAILED`
  - `sync_type = 'async'`

**`app/routes/jobs.py`**
- New `GET /sap/jobs/{job_id}` endpoint — returns a single job row by ID (JWT auth)

**`Dashboard.tsx`**
- `Job` interface: added `sync_type` field
- Recent Sync Jobs table: new **Type** column (`sync_type` as outlined chip)
- Queries modal: **Run sync** button per row (only when `base_table` is not empty)
  - Fires `POST /sap/sync-query` → gets `job_id` immediately
  - Polls `GET /sap/jobs/{job_id}` every 2 s (max 120 s) until `status != 'RUNNING'`
  - Toast success (`X rows → table, job #N`) or error
  - Refreshes Recent Sync Jobs table + jobs count card on completion

---

## 2026-03-15 (session 5)

### admin-ui — Dashboard rewrite (`Dashboard.tsx`)

Full rewrite of the dashboard with real-time data:

- **Service health panel**: fetches all active services, pings each `api_endpoint/health` concurrently, shows UP/DOWN chips. Each card navigates to `/services/manage?name={svc.name}`.
- **KPI stat cards**: Users (→`/users/list`), Files (→`/files/files2`), Queries (→queries modal), Jobs recent (→`/services/manage`). Uses `Promise.allSettled` so one failing endpoint doesn't break others.
- **Recent sync jobs table**: last 8 jobs from `/sap/jobs?limit=8` with status chips.
- **Queries modal**: `GET /sap/queries`, displays `query_name`, `description`, `service_name`, `base_table` (fixed from wrong `Service`/`TargetTable` field names).
- Auto-refresh every 30 s; manual refresh button; "Updated HH:MM:SS" timestamp.

---

### admin-ui — Services pages (new: `ServiceList.tsx`, `ServiceManage.tsx`)

**`/services/list` (`ServiceList.tsx`)**:
- MRT table of all services (no active_only filter)
- Live health: after `fetchServices`, pings `api_endpoint/health` for each service; Status column shows live UP/DOWN chip from `healthMap` state (not stale `is_active` DB field)
- Edit dialog: PUT `/auth/services/{id}` — fields: pascal_name, description, service_url, port, make_command, api_endpoint, is_active toggle
- Manage button navigates to `/services/manage?name={svc.name}`

**`/services/manage` (`ServiceManage.tsx`)**:
- Reads `?name=` from URL, fetches service detail
- Health check every 10 s via `setInterval`
- Start / Stop / Restart buttons → `POST /auth/services/{id}/action`
- Dark terminal panel (`grey.900` bg, `grey.100` text) shows real stdout/stderr with timestamps; `logLines` state + `appendLog` helper
- Re-checks health 2 s after a successful action
- Make command shown in monospace box with copy-to-clipboard button

---

### auth-service — Service action endpoint (`routes/auth.py`)

New `POST /auth/services/{service_id}/action` endpoint:
- Accepts `action: "start" | "stop" | "restart"`
- Derives container name: `microservices-{svc['name']}-1`
- Runs `docker {action} {container}` via `subprocess.run(..., timeout=60)`
- Returns `{action, service, container, returncode, stdout, stderr}`
- Error handling: `FileNotFoundError` (docker CLI missing), `TimeoutExpired` (60 s), generic exception

### auth-service — Dockerfile (`Dockerfile`)

Added `docker.io` CLI install:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends docker.io && rm -rf /var/lib/apt/lists/*
```

### docker-compose.yml — auth-service socket mount

Added to auth-service:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

---

## 2026-03-14 (session 4)

### sap-sync-ui — permission-aware query filtering (`Sync.tsx`, `QueryBuilder.tsx`, `QueryList.tsx`)

Replaced the simple `service_roles['forbidden']` check with a full cross-reference against the `role_permissions` table from `GET /auth/permissions`.

**Logic (`canAccessService` / `canEdit`):**
- Queries with `service_name = null` → always visible / always editable (no service restriction)
- Queries with `service_name` set → check user's *effective* role for that service (`service_roles[svc] ?? global_role`):
  - If effective role is `'forbidden'` → hide / disable
  - Otherwise check `role_permissions[effectiveRole][serviceName]` — must have at least one action (non-empty array) to show
- For `canEdit` (QueryList only): global `superadmin` / `admin` role bypasses all service-level checks regardless of `service_roles` overrides

**`Sync.tsx`:**
- Added `axios` import + `VITE_APP_API_URL`
- `permissions` state fetched from `/auth/permissions` on mount (via token)
- `queries` filtered with `canAccessService(user, q.service_name, permissions)`

**`QueryBuilder.tsx`:**
- Service dropdown now fetches `/auth/services` and `/auth/permissions` in parallel (`Promise.all`)
- Services filtered with `canAccessService(user, svc.name, perms)` — only services the user can actually run queries against are offered

**`QueryList.tsx`:**
- All queries remain listed (no row is hidden)
- Edit and Delete `IconButton`s disabled when `canEdit(user, service_name, permissions)` returns false
- Tooltip shows `'No permission'` on disabled buttons (wrapped in `<span>` so MUI Tooltip fires on disabled elements)
- `permissions` state fetched alongside services in one `Promise.all`
- `canEdit` checks global role first (`superadmin`/`admin` → always true), then falls through to effective service role + permission array lookup

---

### sap-sync-ui — QueryBuilder form reset on new query (`QueryBuilder.tsx`)

After saving an edit and navigating to `/querys/builder` (no `?id=`), the form fields were not cleared because the `useEffect` that loads `existing` had an `if (existing)` guard with no `else` branch.

**Fix:** Added `else if (!editId)` branch that resets all six state fields (`queryName`, `dstTable`, `description`, `sqlOrig`, `serviceName`, `preview`) to empty/null whenever the component is in "new query" mode.

---

### sap-sync-ui — QueryTiming role guard (`QueryTiming.tsx`)

Added access restriction at component level: only `superadmin`, `admin`, `worker` see the scheduled sync table. All other roles receive a "Access denied" message.

```ts
const ALLOWED_ROLES = new Set(['superadmin', 'admin', 'worker']);
if (!user || !ALLOWED_ROLES.has(user.role)) { /* return access denied */ }
```

---

### sap-sync-ui — Sync.tsx query permission filter rebuilt (`Sync.tsx`)

Previous filter (`effectiveRole !== 'forbidden'`) passed all queries where `service_name = null`, making the filter effectively a no-op for most saved queries. Replaced with `canAccessService` which cross-references `role_permissions`.

---

## 2026-03-14 (session 3)

### auth-service — services registry table (`services/auth-service/app/database.py`, `app/routes/auth.py`)

Added a `services` table to `auth_db` (PostgreSQL) as the single authoritative registry of all microservices in the platform.

**Schema:**

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(100) UNIQUE | kebab-case, e.g. `auth-service` |
| `pascal_name` | VARCHAR(100) | e.g. `AuthService` |
| `description` | TEXT | |
| `service_url` | VARCHAR(300) | internal Docker URL, e.g. `http://auth-service:8000` |
| `port` | INTEGER | |
| `make_command` | VARCHAR(200) | e.g. `make up-sap`; services without a dedicated target use `make up` |
| `api_endpoint` | VARCHAR(200) | Traefik gateway prefix, e.g. `/auth` |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

Table is created automatically on startup via `_create_services_table()`. Seeded on first run with all 10 known services:
`auth-service`, `sap-b1-adapter-service`, `file-service`, `binpack-service`, `labeling-service`, `orders-service`, `inventory-service`, `reporting-service`, `sensor-ingest-service`, `maps-service`.

**New DB helpers (`database.py`):** `list_services()`, `get_service()`, `create_service()`, `update_service()`, `delete_service()`

**New API endpoints (`/auth/services`):**

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/auth/services` | any authenticated | `?active_only=true` to filter |
| GET | `/auth/services/{id}` | any authenticated | |
| POST | `/auth/services` | admin, superadmin | |
| PUT | `/auth/services/{id}` | admin, superadmin | |
| DELETE | `/auth/services/{id}` | superadmin only | |

---

### sap-b1-adapter-service — superadmin allowed on POST /sap/sync (`app/routes/sync.py`)

`require_jwt(["admin", "operator"])` was missing `"superadmin"`. Added it → superadmin users can now trigger syncs. Error was `{"detail": "Insufficient permissions"}`.

---

### sap-b1-adapter-service — SAP B1 query auto-create hardened (`app/core/sap.py`, `app/routes/sync.py`, `app/routes/queries.py`)

**Problem:** When a query code existed in `wrk_QueryDef` but not yet in SAP B1's SQLQueries, the sync failed with a confusing `404 Not Found` on the `/List` endpoint. Root causes:

1. `_lookup_sql_text()` in `sync.py` was only called when `create_if_missing=True`, but the auto-lookup should always run when `sql_text` is not supplied.
2. In `sap.py`, the SAP B1 existence check (`GET /SQLQueries('{code}')`) only ran when `create_if_missing=True`, so queries were executed blindly and returned 404 on `/List`.
3. The preview endpoint (`queries.py`) only resolved `sql_text` when a DB connection was already open (`log_to_jobs=True`).

**Fixes:**

- `sync.py`: `_lookup_sql_text()` now runs unconditionally when `sql_text` is not supplied (removed the `and req.create_if_missing` guard).
- `sap.py` `fetch_b1_rows()`: SAP B1 existence check now always runs (regardless of `create_if_missing`). If the query is missing and `sql_text` is available → auto-creates it. If missing and no `sql_text` → raises a clear `RuntimeError`: *"Query 'X' not found in SAP B1. Save in Query Builder first."*
- `queries.py` preview endpoint: `sql_text` auto-lookup now opens its own temporary connection when `log_to_jobs=False` so the lookup works even without a pre-existing connection.

---

## 2026-03-14 (session 2)

### sap-sync-ui — Jobs page migrated to material-react-table

- Installed `material-react-table ^3.2.1` and `@tanstack/react-table ^8.21.3`
- Replaced `@mui/x-data-grid` DataGrid with `MaterialReactTable` in `pages/Jobs.tsx`
- Features: sticky header, column resizing, compact density, pagination (25/page), status chip coloring, error message truncation, loading state
- Added `username` column display (shows who triggered the sync)

### sap-b1-adapter-service — username stored in sync job records

- `app/core/database.py`: `log_job_start()` now accepts optional `username: str | None`; inserts into `logs_SyncJobs.username`
- `app/routes/sync.py`:
  - `/sap/sync`: changed from `dependencies=[Depends(...)]` to `current_user: dict = Depends(...)` so username (`sub` claim) is extracted and stored
  - `/sap/sync-async`: API key caller stored as `"api:{role}"` in username column

### infrastructure/mssql/init.sql — username column added to logs_SyncJobs

- New tables get `username NVARCHAR(100)` column from creation
- Existing tables: `ALTER TABLE` guard adds the column if missing

---

## 2026-03-14

### binpack-ui — Full rebuild from admin-ui architecture (`frontend/binpack-ui/src/`)

Replaced the legacy single-file React app (no routing, no Redux, plain CSS) with a clean clone of admin-ui's architecture.

**New dependencies added to `package.json`:**
`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@reduxjs/toolkit`, `react-redux`, `react-router-dom`, `axios`, `@types/react`, `@types/react-dom`, `typescript`

**New files:**

| File | Purpose |
|---|---|
| `features/config/index.ts` | `VITE_APP_NAME = 'BinPack'`, `PAGE_SIGNIN_SUBTITLE`, `VITE_APP_API_URL` |
| `features/auth/authSlice.ts` | `signIn` / `signOut` / `fetchCurrentUser` thunks; `User` interface with `name`, `avatar_mode`, `avatar_base64` |
| `features/theme/themeSlice.ts` | `toggleTheme` / `setTheme`, persisted to `localStorage` |
| `app/store.ts` | Redux store — `auth` + `theme` only |
| `auth/logoutBus.ts` | Lazy logout bus — no circular dependency; `registerLogout(fn)` wired from `main.tsx` |
| `theme/muiTheme.ts` | `lightTheme` (primary `#33338f` indigo) · `darkTheme` (primary `#7986cb` light indigo, bg `#0d0d1a`) |
| `components/layout/BinpackHeader.tsx` | MUI AppBar: theme toggle, avatar (image or name initial, admin-ui pattern), sign-out menu |
| `components/layout/BinpackSidebar.tsx` | MUI Responsive Drawer containing all binpack controls (roll params, packing mode, pack size, info stats, package list) — no nav links |
| `pages/SignIn.tsx` | Two-panel sign-in (gradient left panel, form right); redirects to `/binpack` on success |
| `pages/BinpackPage.tsx` | All Three.js logic preserved (SearchModal, CirclePackages, CirclesPlain, PackageRectangles, PalletOutline, LogPanel, MeshPallet, StackView, Lighting); wrapped in MUI layout with BinpackHeader + BinpackSidebar + secondary toolbar above canvas |
| `routes/routes.tsx` | `SignIn` (public), `BinpackPage` (protected); `flattenRoutes()` helper |
| `App.tsx` | `ThemeProvider`, `BrowserRouter`, `ProtectedRoute`, global axios 401 → `signOut` |
| `main.tsx` | Redux `Provider` + `registerLogout` wiring |
| `style.css` | Stripped to modal + LogPanel CSS only (layout replaced by MUI) |

**Layout structure:**
```
[MUI AppBar fixed]                   ← BinpackHeader (theme toggle, avatar, sign-out)
[MUI Drawer 280px permanent/mobile]  ← BinpackSidebar (all controls)
[main area]
  [secondary toolbar]                ← OverSize checkbox, View Mode select, Show 3D Stack checkbox
  [Three.js Canvas]                  ← fills remaining space (overflow hidden)
[LogPanel draggable overlay]
[SearchModal overlay]
```

**vite.config.ts:** Added `/auth` proxy alongside `/binpack`; supports `AUTH_DEV_URL` / `BINPACK_DEV_URL` env vars for no-Docker dev mode.

**Makefile:** Added `fe-binpack-dev` target — runs binpack-ui Vite proxied to local dev servers (bypasses Traefik).

---

### binpack-ui — Avatar fix (`frontend/binpack-ui/src/components/layout/BinpackHeader.tsx`, `features/auth/authSlice.ts`)

**Problem:** Avatar used `bgcolor: 'primary.light'` (`#5c5cb8`) on an AppBar with `bgcolor: 'primary.main'` (`#33338f`) — both indigo shades, making the avatar circle invisible against the AppBar.

**Fix:**
- `User` interface extended with `name`, `avatar_base64`, `avatar_mode` fields (matches auth-service `GET /auth/me` response).
- Avatar now uses the admin-ui pattern: `src` for image avatars, `user?.name?.[0]?.toUpperCase()` for letter fallback, `bgcolor: 'primary.light'` styling.

---

### binpack-ui — Sidebar stats always visible (`frontend/binpack-ui/src/components/layout/BinpackSidebar.tsx`)

Removed the `{showStack && (...)}` condition wrapper around "Pkg layers on pallet" and "Stack height" info rows — both stats are now always shown in the sidebar regardless of whether the 3D stack view is active.

---

## 2026-03-13 (session 3 — evening)

### sap-sync-ui — Full rebuild from admin-ui architecture (`frontend/sap-sync-ui/src/`)

Replaced the patched legacy codebase with a clean clone of admin-ui's architecture.

**New files:**

| File | Purpose |
|---|---|
| `features/config/index.ts` | `VITE_APP_NAME`, `PAGE_SIGNIN_SUBTITLE`, `VITE_APP_API_URL` |
| `features/auth/authSlice.ts` | `signIn` / `signOut` / `fetchCurrentUser` thunks via axios directly |
| `features/theme/themeSlice.ts` | `toggleTheme` / `setTheme`, persisted to `localStorage` |
| `app/store.ts` | Redux store — `auth` + `theme` only |
| `theme/muiTheme.ts` | `lightTheme` (#1976d2 blue) · `darkTheme` (slate-navy #0d1b2a + teal #29b6f6) |
| `routes/routes.tsx` | Declarative route tree: Logs/Jobs · DB Tools/Sync/AsyncSync/ScheduledSync |
| `components/layout/Sidebar.tsx` | MUI Responsive Drawer (temporary mobile, permanent desktop) |
| `components/layout/Header.tsx` | AppBar with theme toggle + avatar/signout menu |
| `components/layout/MainLayout.tsx` | Flex layout: Header + Sidebar + `<Outlet />` |
| `pages/SignIn.tsx` | Two-panel (video left, form right); redirects to `/logs/jobs` on success |
| `App.tsx` | `BrowserRouter` + `Routes`; `ThemeProvider`; global axios 401 → `signOut` |
| `main.tsx` | `<Provider store={store}><App /></Provider>` — no legacy wrappers |
| `api/client.ts` | `sapApi` axios instance; token injected via request interceptor from `localStorage` (no circular dep) |

**Deleted (legacy architecture):**
- `src/auth/` — `AuthContext.tsx`, `logoutBus.ts`
- `src/resources/` — old `createBrowserRouter` files
- `src/components/layouts/` — old `AdminLayout`, `NavBar`, `SideRouteLinks`, `Avatar`, `BreadcrumbsNav`
- `src/components/ThemeToggleButton.tsx`, `ProtectedRoute.tsx`, `RequireRole.tsx`
- `src/theme/ThemeContext.tsx`
- `src/pages/Login.tsx` (replaced by `SignIn.tsx`)
- `src/pages/users/` — `ApiKeys`, `Policies`, `RowPolicies`, `Users` (not relevant to SAP sync)
- `src/pages/db-tools/Queries.tsx`, `Tables.tsx`

**Updated pages:**
- `pages/Jobs.tsx` — `useAuth()` → `useSelector((s) => s.auth.token/role)`
- `pages/users/Users.tsx` — same migration

### sap-sync-ui — Circular dependency fix (`src/auth/logoutBus.ts`, `src/main.tsx`)

**Problem:** `store` → `authSlice` → `api/client` → `logoutBus` → `store` caused `ReferenceError: Cannot access 'authReducer' before initialization`.

**Fix:** `logoutBus.ts` no longer imports `store`. Instead it exports `registerLogout(fn)` which stores a lazy callback. `main.tsx` calls `registerLogout(() => store.dispatch(logout()))` after the store is created.

### sap-b1-adapter-service — superadmin 403 fix (`services/sap-b1-adapter-service/app/routes/jobs.py`)

`require_jwt(["admin", "operator", "viewer"])` was missing `"superadmin"`. Added it → `GET /sap/jobs` now works for superadmin users.

### sap-sync-ui — vite.config.ts: no-Docker dev mode proxy

`AUTH_DEV_URL` / `SAP_DEV_URL` env vars override the proxy targets when running without Docker:
```ts
const AUTH_URL = process.env.AUTH_DEV_URL || 'http://localhost'
const SAP_URL  = process.env.SAP_DEV_URL  || 'http://localhost'
```

### Makefile — direct-run targets for no-Docker dev

| Target | Action |
|---|---|
| `make dev-auth` | Runs `auth-service` directly on port 8002 (python3.14, PYTHONPATH=../.. ) |
| `make dev-sap` | Runs `sap-b1-adapter-service` directly on port 8003 |
| `make fe-sap-dev` | Runs sap-sync-ui Vite proxied to dev ports (bypasses Traefik) |

### Docker — Colima context fix (`docs/START.md`)

Docker CLI was defaulting to the Docker Desktop context (`desktop-linux`) while Colima was running at a different socket. Fix: `docker context use colima` (one-time, persists).

Added to `START.md` setup instructions and troubleshooting table.

### admin-ui — FileManager2.tsx VideoViewer support

Ported video file handling from `FileManager.tsx` to `FileManager2.tsx`:
- `VIDEO_EXTS` constant and `isVideoFile(name)` helper (MIME type + extension fallback)
- `getFileIcon()` and `viewerType()` updated to handle video
- `token` from Redux state passed to `<VideoViewer>`
- `handleView()` skips base64 fetch for video files
- `<VideoViewer>` rendered when `vType === 'video'`

---

## 2026-03-13 (session 2 — afternoon)

### auth-service — role hierarchy + self-edit fix (`services/auth-service/app/routes/auth.py`)

- **Same-rank edit allowed:** Changed `put_user` and `remove_user` rank checks from `<=`/`>=` to `<`/`>` — admin can now edit, update, and delete other admin users.
- **Self-edit always allowed:** `put_user` now fetches the requester's own DB record and sets `is_self = requester["id"] == user_id`. When editing yourself the rank check is skipped entirely. Role-promotion guard still applies (can't promote yourself above your own rank).
- **Frontend (`Users.tsx`):** `canModify = isSelf || ROLE_RANK[currentUserRole] >= ROLE_RANK[targetRole]` — Edit/Delete buttons enabled for self regardless of rank.

### auth-service — role permissions table + endpoints (`services/auth-service/app/database.py`, `app/routes/auth.py`)

- `role_permissions` table created on startup (JSONB, single-row).
- Seeded with default permissions map:
  ```json
  {
    "superadmin": {"maps":["c","r","u","d"],"files":["c","r","u","d"],"users":["c","r","u","d"],"reports":["c","r","u","d"],"sensors":["c","r","u","d"]},
    "admin":      {"maps":["c","r","u","d"],"files":["c","r","u","d"],"users":["c","r","u","d"],"reports":["c","r","u"],"sensors":["r"]},
    "operator":   {"maps":["r"],"files":["c","r","u"],"users":["r"],"reports":["r"],"sensors":["c","r"]},
    "viewer":     {"maps":["r"],"files":["r"],"users":[],"reports":["r"],"sensors":["r"]}
  }
  ```
- `GET /auth/permissions` — returns permissions map (any authenticated role).
- `PUT /auth/permissions` — saves permissions map (superadmin only).
- `get_permissions()` / `set_permissions()` helpers added to `database.py`.

### admin-ui — Permissions page (`frontend/admin-ui/src/pages/users/Permissions.tsx`)

- New page: grid of resources × CRUD actions with checkboxes per role.
- Superadmin: fully editable, Save button calls `PUT /auth/permissions` via Redux thunk.
- Other roles: read-only view with informational note.
- Chip color coding per role: superadmin=error, admin=warning, operator=info, viewer=default.

### admin-ui — permissions Redux slice (`frontend/admin-ui/src/features/permissions/permissionsSlice.ts`)

- New slice with `fetchPermissions` and `savePermissions` async thunks.
- Registered in `store.ts` as `permissions`.

### admin-ui — routes restructured (`frontend/admin-ui/src/routes/routes.tsx`)

- `/users` is now a collapsible group with two children:
  - `/users/list` — User List (existing Users page)
  - `/users/permissions` — Permissions editor
- Added `SecurityIcon` import.

### admin-ui — Vite proxy bypass (`frontend/admin-ui/vite.config.ts`)

- Added `bypass(req)` function to `/files`, `/maps`, `/orders`, `/inventory`, `/reporting`, `/sensor` proxy entries.
- Returns `/index.html` for browser navigations (`Accept: text/html`) — prevents React Router paths from being intercepted by the API proxy and returning raw JSON.

### file-service — new service (`services/file-service/`)

- New FastAPI service with PostgreSQL metadata store and physical disk storage.
- Files stored as `{STORAGE_DIR}/{folder}/{uuid}{ext}` (volume: `./files:/app/storage`).
- Metadata table `files` in `files_db` (postgres-files, port 5436).
- Upload via base64 data-URL in request body; decoded server-side before writing to disk.
- Endpoints: `GET /files/health`, `GET /files/`, `GET /files/{id}`, `POST /files/`, `PUT /files/{id}`, `DELETE /files/{id}`.
- Traefik route added in `dynamic.yml`: `/files` → `file-service:8000`.
- `docker-compose.yml`: added `postgres-files` (pg_isready healthcheck) and `file-service` (depends_on with `condition: service_healthy`).

### admin-ui — File Manager folder autocomplete (`frontend/admin-ui/src/pages/files/FileManager.tsx`)

- `FileInfoDialog` and `EditDialog`: replaced `Folder` TextField with MUI `Autocomplete freeSolo`.
- Existing folder names derived from file list and offered as suggestions; new folder names can be typed freely.

### admin-ui — FileDropzone MP4 support (`frontend/admin-ui/src/components/common/FileDropzone.tsx`)

- Added `'video/mp4': []` to `ACCEPTED` types.
- Updated caption to include "MP4".

### admin-ui — Toastify on all backend interactions

Added `import { toast } from 'react-toastify'` and `.unwrap()` + try/catch to all pages that previously had no feedback or used MUI `<Alert>`:

| Page | Was | Now |
|---|---|---|
| `SignIn.tsx` | MUI `<Alert>` | `toast.error` on catch |
| `UserAccount.tsx` | `saveMsg` state + MUI `<Alert>` | `toast.success/error` |
| `FileManager.tsx` | No feedback | `toast.*` on upload, edit, delete |
| `HistoryMap.tsx` | No feedback | `toast.error` on fetch failure |
| `GeoJsonMap.tsx` | No feedback | `toast.error` on fetch failure |
| `CustomMap.tsx` | Silent `catch {}` | `toast.success/error` on all mutations |

### admin-ui — maps pages archived and removed

- `src/pages/maps/` (HistoryMap.tsx, GeoJsonMap.tsx, CustomMap.tsx) archived to `src/pages/maps_archive.zip` and deleted.
- Routes for `/maps/history`, `/maps/geojson`, `/maps/custom` removed from `routes.tsx`.
- Related Redux slice imports cleaned up.

### auth-service — avatar fields in user CRUD (`services/auth-service/app/routes/auth.py`, `app/database.py`)

- `CreateUserRequest` and `UpdateUserRequest` gain `avatar_mode` and `avatar_base64` fields.
- `create_user` INSERT now includes `avatar_mode`, `avatar_base64` columns.
- `update_user()` gains `clear_avatar: bool = False` — when `True` explicitly sets `avatar_base64 = NULL` (needed when switching back to letter mode since `None` was already used as "not provided").
- `put_user` passes `clear_avatar=req.avatar_mode == "letter"` to `update_user()`.

---

## 2026-03-13

### auth-service — avatar columns + username in API response (`services/auth-service/app/database.py`)

- Added `avatar_mode VARCHAR(20) DEFAULT 'letter'` and `avatar_base64 TEXT` columns to `auth_users` table.
- Migration via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — zero-downtime for existing installs.
- `_fmt()` now includes `username`, `avatar_mode`, `avatar_base64` in every API response.
- Added `_SELECT` constant to keep all SELECT column lists in sync across helpers.
- New `get_user_by_username(username)` function.
- `update_user()` accepts `avatar_mode` and `avatar_base64` kwargs.

### auth-service — new endpoints + role enforcement (`services/auth-service/app/routes/auth.py`)

- `GET /auth/me` — now queries the DB (via `get_user_by_username`) and returns the full profile: `{id, username, name, email, role, service_roles, status, joined, avatar_mode, avatar_base64}`.
- `PUT /auth/users/me` — new self-service profile update endpoint; any authenticated user can update their own `name`, `email`, `avatar_mode`, `avatar_base64`, and `password`.
- `redirect_slashes=False` added to the router — prevents FastAPI 307 redirects on trailing slashes (which stripped the `Authorization` header in some Traefik/browser setups).

### auth-service — security (`services/auth-service/app/security.py`)

- `create_token()` accepts optional `service_roles: dict` kwarg; includes `service_roles` field in JWT payload.

### admin-ui — auth slice (`frontend/admin-ui/src/features/auth/authSlice.ts`)

- `fetchCurrentUser` URL changed from `/users/me` to `/auth/me`.
- `updateProfile` URL changed from `/users/me` to `/auth/users/me`.
- `User` interface gains `service_roles: Record<string, string>`.
- `signIn.fulfilled` no longer tries to set `user` from login response (login returns no user object); instead `fetchCurrentUser` is dispatched after sign-in.
- `fetchCurrentUser.rejected` now only clears token for `status === 401` — network errors and 500s no longer sign the user out.
- `fetchCurrentUser` passes `{ status, detail }` as the reject payload so the reducer can inspect the HTTP status code.

### admin-ui — App.tsx (`frontend/admin-ui/src/App.tsx`)

- Global axios 401 interceptor added: any 401 response dispatches `signOut()` → clears token → `ProtectedRoute` redirects to sign-in.
- `ToastContainer` added (bottom-right, 4 s auto-close).
- Imports `react-toastify` CSS.

### admin-ui — SignIn.tsx (`frontend/admin-ui/src/pages/SignIn.tsx`)

- Dispatches `fetchCurrentUser()` after successful login to populate the user object in Redux state.

### admin-ui — Users page (`frontend/admin-ui/src/pages/users/Users.tsx`)

- Table columns updated to match `auth_users` DB schema:
  - **User** column: avatar + name + email stacked.
  - **Username** column added (login name).
  - **Role** chip with colour coding.
  - **Service Roles** column: shows all 8 services for every user; italic+outlined = inherits global role, filled = explicit override, strikethrough = `forbidden`.
  - **Status** chip (active/inactive).
  - **Joined** formatted as locale date string.
- Create / Edit dialog updated:
  - `username` field — required on create, read-only on edit.
  - **Service Role Overrides** section: dropdown per service (`— inherit global —` / `superadmin` / `admin` / `operator` / `viewer` / **`forbidden`**).
  - `forbidden` role: blocks access to a specific service even if global role would otherwise allow it.
- All CRUD actions (`createUser`, `updateUser`, `deleteUser`) use `dispatch().unwrap()` + `toast.success` / `toast.error`.
- Delete button coloured red.

### admin-ui — usersSlice.ts (`frontend/admin-ui/src/features/users/usersSlice.ts`)

- `UserRow` interface gains `username: string`.
- `fetchUsers` and `createUser` axios calls: trailing slash removed from URL to avoid FastAPI 307 redirects.

### react-toastify — all frontends

Added `react-toastify@^11.0.5` and `<ToastContainer position="bottom-right" autoClose={4000}>` to all five frontends:

| Frontend | Change |
|---|---|
| `admin-ui` | installed; `ToastContainer` in `App.tsx`; CRUD toasts in `Users.tsx` |
| `binpack-ui` | already installed and used — no change |
| `live-labeling-ui` | already installed; `ToastContainer` in `App.tsx`; `handlePrint` uses `toast.loading` / `toast.update` |
| `sap-map-ui` | installed; `ToastContainer` in `App.tsx` |
| `sap-sync-ui` | installed; `ToastContainer` in `App.tsx` alongside `RouterProvider` |

### Labeling Service — printer error handling (`services/labeling-service/app/main.py`)

- Extracted `_raise_printer_error(e)` helper — maps all socket/OS network errors to proper HTTP codes:
  - `socket.timeout` → 504
  - `ConnectionRefusedError`, `ConnectionResetError` → 503
  - `OSError` (e.g. "No route to host", "Network unreachable") → 503 with detail
  - Other → 500
- Applied to both `POST /print` and `POST /labels` endpoints.
- Previously: `OSError` fell through to 500 with no readable message.

### Labeling Service — dev mode backend proxy (`frontend/live-labeling-ui/vite.config.ts`, `Makefile`)

- `vite.config.ts`: when `VITE_BACKEND_URL` env var is set, Vite proxy strips `/labeling` prefix and forwards directly to the local uvicorn backend (bypasses Traefik). Without the var, routes through Traefik at `http://localhost` as before.
- `Makefile`: added `dev-labeling` target — runs uvicorn on port 8001 for local dev without Docker.
- Usage (two terminals):
  ```
  # Terminal 1
  cd services/labeling-service && uvicorn app.main:app --reload --port 8001
  # Terminal 2
  cd frontend/live-labeling-ui && VITE_BACKEND_URL=http://localhost:8001 npm run dev
  ```

### Labeling Service — JSON error response fix (`frontend/live-labeling-ui/src/LabelDesigner.jsx`)

- `handlePrint`: added `res.ok` check before calling `res.json()`. Non-2xx responses now extract `detail` from JSON body (or fall back to `HTTP <status>`), then throw. Previously, a gateway error body (e.g. `502 Bad Gateway`) caused a JSON parse crash.

---

## 2026-03-12

### Binpack — Package boundary validation (`services/binpack-service/app/models.py`)

Added Pydantic validators enforcing constraints from `docs/Binpack.md` (updated 2026-03-12):

| Constraint | Rule | Where |
|---|---|---|
| Package short side | 220–500 mm | `LayerRequest` |
| Package long side | 240–700 mm | `LayerRequest` |
| Package weight | 2–8 kg (`pack_size × roll_weight`) | `LayerRequest` |

- `LayerRequest`: `@model_validator(mode="after")` `validate_package_bounds` — fires when `pack_size` + `roll_diameter` supplied; also validates weight when `roll_weight` supplied.
- `StackRequest`: `bin_max_height` validator removed — receives computed stack height (`pkg_layers × layers_in_package × roll_height`), not raw pallet height.
- Constants: `PKG_WIDTH_MIN_MM=220`, `PKG_WIDTH_MAX_MM=500`, `PKG_LENGTH_MIN_MM=240`, `PKG_LENGTH_MAX_MM=700`, `PKG_WEIGHT_MIN_KG=2`, `PKG_WEIGHT_MAX_KG=8`.
- Helper `_best_rect(n)` added (mirrors `packing.best_rectangular_arrangement`) to avoid circular import.
- Validation errors → HTTP 422 with field-level detail.

### Binpack — 3D stack Phase 2: per-package-level coloring (`frontend/binpack-ui/src/App.tsx`)

Replaced `LAYER_COLORS` with `PKG_LAYER_PALETTES` (6 palettes × 3 shades):
warm, cool, teal/green, purple/pink, amber/red, grey.

Color lookup in `StackView`:
- `pkgLayerIdx = floor(layerIdx / layersInPackage)` → palette (changes per package level on pallet)
- `rollLayerIdx = layerIdx % layersInPackage` → shade (different within a package)

### Labeling Service — LabelDesigner frontend integration (`frontend/live-labeling-ui/`)

- `src/LabelDesigner.jsx` — drag-and-drop ZPL label designer (ported from `docs/cab-label-printer/frontend/src/LabelDesigner.jsx`)
  - API calls use `const API = (import.meta.env.VITE_API_URL || '') + '/labeling'`
  - `handlePrint` calls `fetch(\`${API}/print\`, ...)` — routes through Vite proxy → Traefik
  - Removed emoji characters for plain text compatibility
- `src/App.tsx` — simplified to render `<LabelDesigner />` full-screen
- `services/labeling-service/app/models.py` — added `RawPrintRequest(zpl: str)` model
- `services/labeling-service/app/main.py` — fixed `POST /print` endpoint: was `zpl: str` query param, now accepts `RawPrintRequest` JSON body

### Binpack — 3D stack: package layers on pallet control (`frontend/binpack-ui/src/App.tsx`)

**Root cause fixed:** `bin_max_height` was `layersInPackage × rollHeight` (~180 mm) — backend stacked only 1 package level.

- New state `pkgLayersOnPallet` (default 11) replaces `binMaxHeight`.
- New UI control "Package layers on pallet" (range 1–20).
- `loadStack` sends `bin_max_height = pkgLayersOnPallet × layersInPackage × rollHeight`.
- Item search auto-computes `pkgLayersOnPallet = floor(2150 / (layers_in_package × roll_height))`.
- Info panel: "Package layers on pallet: N" and "Stack height: X mm".
- Removed wrong `setBinMaxHeight(layersInPackage × rollHeight)` from useEffect.

---

## 2026-03-11

### Phase 3 — Binpack Service

**Source:** Ported from `3dbinpacking/binpack/backend/`

**Files added:** `services/binpack-service/`
- `app/main.py` — FastAPI app; `ITEMS_PATH` fixed to use `/app/data/items.json` (env-var override via `ITEMS_PATH`)
- `app/models.py` — Pydantic request/response models (copied as-is)
- `app/packing.py` — Pure-stdlib circle packing + package grouping algorithms (copied as-is)
- `app/__init__.py` — empty package marker
- `data/items.json` — copied from `3dbinpacking/binpack/excel_to_json/items.json`
- `requirements.txt` — `fastapi==0.133.1`, `uvicorn[standard]==0.41.0`, `pydantic==2.12.5`
- `Dockerfile` — `python:3.12-slim`; build context is repo root

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/items` | Fetch item catalog from `items.json` |
| POST | `/optimize-layer` | Circle packing on pallet (hexagonal or square) |
| GET | `/package-dimensions` | Physical footprint of a package |
| POST | `/stack-layers` | Multi-layer 3D coordinates |
| POST | `/robot-template` | KUKA robot pick list + KRL program |
| POST | `/package` | Group layer positions into packages |

**No database** — fully stateless computation service.

**`ITEMS_PATH` fix:**

Original `main.py` resolved the path as `Path(__file__).parent.parent.parent / "excel_to_json" / "items.json"`, which pointed outside the repo root when run in a container. Fixed to:
```python
ITEMS_PATH = Path(os.getenv("ITEMS_PATH", Path(__file__).resolve().parent.parent / "data" / "items.json"))
```
`items.json` is now baked into the image at `/app/data/items.json`.

**Requirements note:**

The source repo's `requirements.txt` listed `numpy`, `matplotlib`, and `py3dbp` (GitHub) in a README but not in the pinned file. `packing.py` uses only stdlib `math` — none of those packages are actually imported. The service requirements file contains only the three FastAPI/Uvicorn/Pydantic dependencies.

**Traefik routing added** (`api-gateway/traefik/dynamic.yml`):
- Router `binpack`: `PathPrefix(/binpack)` → `binpack-service`, middlewares: `cors`, `strip-binpack`
- Middleware `strip-binpack`: strips `/binpack` prefix before forwarding to backend
- Service `binpack-service`: `http://binpack-service:8000`

**docker-compose.yml** — added `binpack-service` service (no `depends_on`, stateless).

**Makefile** — added `make up-binpack` target.

**Verification:**
```bash
make up-binpack
curl http://localhost/binpack/health      # → {"status":"ok"}
curl http://localhost/binpack/items       # → item catalog JSON
```

---

### Phase 4 — Frontend Migration

All four frontends copied into `frontend/` and wired to the Traefik gateway.

**`sap-sync-ui`** (`frontend/sap-sync-ui/`)

- `src/api/client.ts` — replaced hardcoded `baseURL: "http://localhost:8080"` with `VITE_API_URL` env var. Added a second `sapApi` axios instance with `/sap` prefix for all SAP calls. `setAuthToken()` now sets the Authorization header on both instances. Shared 401 interceptor applied to both via a common `on401` function.
- `src/pages/Jobs.tsx` — switched import from `api` → `sapApi`; `GET /jobs` → `sapApi.get("/jobs")`
- `src/pages/db-tools/Sync.tsx` — switched import from `api` → `sapApi`; `POST /sync` → `sapApi.post("/sync")`
- `.env.local` — created with `VITE_API_URL=` (empty; Vite proxy handles routing)

**`sap-map-ui`** — no changes needed; uses only mock data and public Nominatim API.

**`binpack-ui`** (`frontend/binpack-ui/`)

- `src/App.tsx` — added `const API = (import.meta.env.VITE_API_URL || '') + '/binpack'`; all six `fetch('/<path>', ...)` calls replaced with `fetch(\`${API}/<path>\`, ...)`
- `.env.local` — created with `VITE_API_URL=` (empty)

**`admin-ui`** (`frontend/admin-ui/`)

- `src/features/auth/authSlice.ts` — login payload changed from `{ email, password }` to `{ username, password }` to match auth-service contract
- `src/pages/SignIn.tsx` — state renamed `email` → `username`; default value `'admin@example.com'` → `'admin'`; TextField label `"Email"` / type `"email"` → `"Username"` / type `"text"`
- `.env` — `VITE_APP_API_URL=` (empty)

**Makefile** — added `fe-install`, `fe-sap`, `fe-map`, `fe-binpack`, `fe-admin` targets.

---

### Avatar.tsx — null guard fix

**File:** `frontend/sap-sync-ui/src/components/layouts/Avatar.tsx`

**Error:** `Cannot read properties of null (reading 'trim')` at `stringAvatar:19` — `role` from Redux auth state is `null` during the first render after login before the user object populates.

**Fix:**
```ts
// Before
function stringAvatar(name: string) {
  const nameParts = name.trim().split(/\s+/)

// After
function stringAvatar(name: string | null | undefined) {
  if (!name) return { children: '?' };
  const nameParts = name.trim().split(/\s+/)
```

`RoleAvatar` prop type updated to `{ role?: string | null }`.

---

### Traefik — CORS middleware + `/maps` route

**File:** `api-gateway/traefik/dynamic.yml`

Added `cors` middleware:
```yaml
cors:
  headers:
    accessControlAllowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    accessControlAllowHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
    accessControlAllowOriginList:
      - "http://localhost:5173"
      - "http://localhost:5174"
      - "http://localhost:5175"
      - "http://localhost:5176"
    accessControlMaxAge: 3600
    addVaryHeader: true
```

Applied `middlewares: [cors]` to all existing routers (`auth`, `orders`, `inventory`, `reporting`, `sensor`, `sap`).

Added `/maps` router and `maps-service` stub entry (placeholder for future maps backend; allows preflight to pass without 404).

---

### Traefik — file provider watch enabled

**File:** `api-gateway/traefik/traefik.yml`

```yaml
providers:
  file:
    filename: /etc/traefik/dynamic.yml
    watch: true   # ← added
```

Traefik now reloads `dynamic.yml` automatically when the file changes. Previously required a container restart.

---

### Vite proxy — all four frontends

**Problem:** Traefik's `headers` middleware only wraps responses from reachable backends. When no backend exists (502) or no route matches (404), CORS headers are never added and browser preflight fails.

**Solution:** Configure Vite's `server.proxy` so the browser makes same-origin requests to the Vite dev server; Vite forwards them to Traefik server-side. No browser preflight, no CORS issue.

| Frontend | Proxied paths |
|---|---|
| `sap-sync-ui` | `/auth`, `/sap` |
| `sap-map-ui` | — (not needed) |
| `binpack-ui` | `/binpack` |
| `admin-ui` | `/auth`, `/maps`, `/orders`, `/inventory`, `/reporting`, `/sensor` |

All `VITE_API_URL` / `VITE_APP_API_URL` env vars set to empty string — API calls use relative paths, proxied by Vite.

---

### Admin-ui config — fallback fix

**File:** `frontend/admin-ui/src/features/config/index.tsx`

```ts
// Before — empty string is falsy, fell back to wrong port
export const VITE_APP_API_URL = import.meta.env.VITE_APP_API_URL || 'http://localhost:8000';

// After — only falls back on null/undefined
export const VITE_APP_API_URL = import.meta.env.VITE_APP_API_URL ?? '';
```

With `VITE_APP_API_URL=` in `.env`, `||` would silently redirect all API calls to `http://localhost:8000` (auth-service's internal Docker port, not externally reachable), causing login failures.

---

### Binpack — pallet coordinate centering fix

**Files:** `services/binpack-service/app/main.py`, `frontend/binpack-ui/src/App.tsx`

**Problem:** The circle packing algorithm fills from `y = r` (bottom edge) upward. With square packing and ⌀125 mm rolls on a 1200 mm pallet, 9 rows fit (`9 × 125 = 1125 mm`). The last row center is at `y = 1062.5`, but the previous centering subtracted `pallet_length / 2 = 600`. The content midpoint was at `562.5`, not `600`, leaving the circles shifted **37.5 mm** downward relative to the `PalletOutline` (circles partially outside the pallet boundary).

**Fix — `main.py` `/optimize-layer` endpoint:**
```python
# Before — always subtracted pallet half-dimensions, not content center
pw2 = req.pallet_width / 2.0
pl2 = req.pallet_length / 2.0
centered = [(cx - pw2, cy - pl2) for (cx, cy) in centers]

# After — center by actual bounding-box midpoint of packed circles
xs0 = [c[0] for c in centers]
ys0 = [c[1] for c in centers]
cx_mid = (min(xs0) + max(xs0)) / 2.0
cy_mid = (min(ys0) + max(ys0)) / 2.0
centered = [(cx - cx_mid, cy - cy_mid) for (cx, cy) in centers]
```

Circle centers are now always symmetric around world origin `(0, 0)`, matching `PalletOutline` which is also centered at the origin.

**Fix — `App.tsx` `MeshPallet` component:**
```tsx
// Before (wrong offset)
<mesh position={[-600, -400, -145]}>

// After (correct — STL model is centered at its own origin)
<mesh position={[0, 0, -145]}>
```

The `-145` z-offset lowers the mesh by the pallet height (145 mm in STL units) so the top surface lands at `z = 0`.

---

## 2026-03-10

### Stub service Dockerfiles — fixed build context paths

All four stub services (`orders-service`, `inventory-service`, `reporting-service`, `sensor-ingest-service`) had Dockerfiles written for a local build context:
```dockerfile
COPY requirements.txt /app/requirements.txt   # wrong — context is repo root
COPY . /app
COPY ../../shared /app/shared                 # wrong — can't go above context root
```

Fix applied to all four — same pattern as auth-service:
```dockerfile
COPY services/<name>/requirements.txt /app/requirements.txt
COPY shared /app/shared
COPY services/<name> /app
```

---

### `make infra-init` — password escaping failure in Makefile inline Python

**Problem:** The original `infra-init` Makefile target embedded the MSSQL password (`MyS3cureP@ss!`) directly inside an inline Python one-liner passed through Make → shell → Python string. The `@` and `!` characters were mangled through multiple escaping layers, producing a malformed ODBC connection string and a misleading 18456 login error.

The direct connection test (`docker compose exec ... python3 -c "..."` with hardcoded password) worked fine — confirming the issue was escaping, not connectivity.

**Fix:** Replaced the inline one-liner with a standalone script `infrastructure/mssql/init-schema.py`. The script reads credentials from the container's own environment variables (`DST_SERVER`, `DST_USER`, `DST_PASSWORD` — already injected by docker-compose). No password embedding in the Makefile at all.

Updated `infra-init` target:
```makefile
infra-init:
    docker cp infrastructure/mssql/init.sql       $$CONTAINER:/tmp/init.sql
    docker cp infrastructure/mssql/init-schema.py $$CONTAINER:/tmp/init-schema.py
    $(APP) exec sap-b1-adapter-service python3 /tmp/init-schema.py
```

**Files added:** `infrastructure/mssql/init-schema.py`

---

### `docker-compose.yml` — bind mounts + Postgres consolidation

**Bind mounts:** All named volumes replaced with bind mounts to `./data/`:

| Volume | Old (named) | New (bind mount) |
|---|---|---|
| auth DB | `pg_auth` | `./data/pg-auth` |
| shared DBs | `pg_orders`, `pg_inventory`, `pg_reporting`, `pg_events` | `./data/pg-shared` |
| RabbitMQ | — | `./data/rabbitmq` |
| Prometheus | — | `./data/prometheus` |
| Loki | — | `./data/loki` |
| Grafana | — | `./data/grafana` |
| MSSQL | `app_sql_data` (named, external) | `./data/mssql` |

Data is now visible in the filesystem, easy to backup, and gitignored via `.gitignore`.

**Postgres consolidation:** Reduced from 5 separate Postgres containers to 2:
- `postgres-auth` — dedicated, isolated, serves `auth_db` only (security boundary)
- `postgres` — shared instance, serves `orders_db`, `inventory_db`, `reporting_db`, `events_db`

The shared instance uses `infrastructure/postgres/init-multiple-dbs.sh` (mounted into `docker-entrypoint-initdb.d`) to create all four databases on first start via `POSTGRES_MULTIPLE_DATABASES` env var.

Each stub service's `POSTGRES_URL` updated to point to the shared `postgres` host.

---

### Added `.gitignore`

```
.env
data/
__pycache__/
*.pyc
.venv/
*.crt
*.pem
*.pfx
.DS_Store
```

---

### Infrastructure — MSSQL split into separate stack

**Problem:** MSSQL was running from `sap/dockerize/app/docker-compose.yml` — a directory outside the monorepo. This made it impossible to manage everything from one place, and a `docker compose down -v` on the app stack would threaten MSSQL data.

**Decision:** Keep MSSQL as a separate "infrastructure" stack. Two stacks share `db_net` network:
- Infrastructure stack **owns** `db_net` and the `sql_data` volume
- App stack joins `db_net` as `external: true`

**Files added:**
- `infrastructure/mssql/docker-compose.yml` — MSSQL infrastructure stack
  - Image: `mcr.microsoft.com/azure-sql-edge:latest` (ARM64-compatible)
  - Container name: `mssql_server`
  - Port: `1433`
  - Network: creates `db_net` (bridge)
  - Volume: `sql_data` (persistent, survives app stack resets)
  - Healthcheck: TCP probe on port 1433
  - `restart: unless-stopped`
- `infrastructure/mssql/init.sql` — ReportingDB schema (copied from `sap/dockerize/app/`)
  - Creates login `pisti`, database `ReportingDB`
  - Tables: `auth_User`, `log_SyncLog`, `logs_SyncJobs`, `wrk_TableDesc`, `wrk_QueryDef`

**Files modified:**
- `docker-compose.yml` — added comment on `db_net` clarifying ownership and start order dependency

---

### Added Makefile

`Makefile` added at repo root to orchestrate both stacks.

| Target | Action |
|---|---|
| `make infra-up` | Start MSSQL + create db_net |
| `make infra-init` | Initialize ReportingDB schema (first time only) |
| `make infra-down` | Stop MSSQL, keep data |
| `make infra-reset` | Stop MSSQL + delete volume |
| `make up` | Build + start all app services |
| `make up-core` | Start traefik + auth-service only |
| `make up-sap` | Start sap-b1-adapter-service only |
| `make down` | Stop app services, keep volumes |
| `make down-all` | Stop app + infra, keep volumes |
| `make reset` | Full wipe — delete all volumes, restart |
| `make logs` | Follow all app logs |
| `make ps` | Show containers in both stacks |

Schema init works by copying `infrastructure/mssql/init.sql` into the running `sap-b1-adapter-service` container and executing it via pyodbc (the container has ODBC Driver 18 installed).

---

### Updated `docs/START.md`

Complete rewrite to reflect the two-stack architecture and Makefile workflow:
- Added repository structure tree
- Added two-stack architecture diagram
- Replaced raw `docker compose` commands with `make` targets
- Added Makefile reference table
- Rewrote stop/reset section — clarifies what data each operation affects
- Added `.env` note: no inline comments (Docker Compose includes them in values)
- Expanded troubleshooting table: `network db_net not found`, MSSQL 18456 stale volume, schema not initialized

---

## 2026-03-09

### Phase 2 — SAP B1 Adapter Service

**Source:** Ported from `sap/backend/app3/` (real working code).

**Files added:** `services/sap-b1-adapter-service/`
- `app/main.py` — FastAPI app, mounts routers under `/sap`
- `app/settings.py` — extends `CommonSettings`; adds B1 config, MSSQL config, JWT config, API keys
- `app/security.py` — stateless JWT verification using shared `JWT_SECRET`; `require_jwt(roles)` and `require_api_key(roles)` FastAPI dependencies
- `app/core/database.py` — pyodbc MSSQL connection pool; connection string with `Encrypt=no` fix
- `app/core/b1_client.py` — SAP B1 Service Layer HTTP client (session management, query execution)
- `app/routes/sync.py` — `POST /sap/sync`, `POST /sap/sync-async`
- `app/routes/jobs.py` — `GET /sap/jobs` (reads `logs_SyncJobs` from ReportingDB)
- `app/routes/health.py` — `GET /sap/health`
- `requirements.txt` — `fastapi`, `uvicorn`, `pyodbc`, `httpx`, `python-jose[cryptography]`, `pydantic-settings`
- `Dockerfile` — installs ODBC Driver 18 for SQL Server

**Dockerfile fix — apt-key removed in Debian 12:**
The original Dockerfile used `apt-key adv` and `msodbcsql17`. Both fail on Debian 12 Bookworm ARM64:
- `apt-key` command removed in Debian 12
- `msodbcsql17` package not available for ARM64/Debian 12

Fix: switched to `gpg --dearmor` for key import and `msodbcsql18` package.

```dockerfile
RUN apt-get install -y curl gpg apt-transport-https ca-certificates unixodbc-dev \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list \
        -o /etc/apt/sources.list.d/mssql-release.list \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18
```

**ODBC Driver 18 breaking change — `Encrypt=YES` by default:**
Driver 18 changed the default from `Encrypt=NO` to `Encrypt=YES`. Without a valid TLS cert on the SQL Server this causes login failures (state 8, error 18456).

Fix: added `Encrypt=no;TrustServerCertificate=yes;` to the connection string.

**pyodbc error handling fix — `InterfaceError` not caught:**
Auth failures (SQLSTATE 28000) raise `pyodbc.InterfaceError`, not `pyodbc.OperationalError`. The original handler missed these, falling through to a generic "Unexpected database error" with no useful message.

Fix in `app/core/database.py`:
```python
# Before
except pyodbc.OperationalError as e:
# After
except (pyodbc.OperationalError, pyodbc.InterfaceError) as e:
```
Also added `"18456"` to the auth-error detection string check and changed `detail="Sync failed"` to `detail=str(e)` in sync route for real error messages.

**Network fix — Colima VM cannot reach LAN:**
Initial config pointed `DST_SQL_SERVER` at the Proxmox MSSQL on the LAN (192.168.10.109). The Colima VM runs on 192.168.5.x and cannot reach 192.168.10.x.

Fix: switched to local Docker MSSQL container (`mssql_server,1433`) reachable via `db_net`.

**docker-compose.yml changes:**
- Added `sap-b1-adapter-service` to `networks: [default, db_net]` so it can reach `mssql_server`
- Added `db_net` as external network at the bottom of the file

---

### Phase 1 — Auth Service

**Source:** Ported from `sap/backend/app3/app/core/` (security, config) and auth routes.

**Files added:** `services/auth-service/`
- `app/main.py` — FastAPI app; startup calls `init_db()`, `security.configure()`, `bootstrap_admin()`
- `app/settings.py` — extends `CommonSettings`; adds `postgres_url`, `jwt_secret`, `jwt_algo`, `jwt_expire_hours`, `bootstrap_admin_username`, `bootstrap_admin_password`
- `app/database.py` — psycopg2 PostgreSQL connection; creates `auth_users` table on startup; `bootstrap_admin()` inserts admin only if table is empty
- `app/security.py` — bcrypt with SHA-256 pre-hash (handles passwords > 72 bytes); JWT create/decode; `require_roles()` FastAPI dependency; `configure()` called at startup
- `app/routes/auth.py` — `POST /auth/login`, `GET /auth/me`, `POST /auth/create-user` (admin only), `GET /auth/health`
- `requirements.txt` — `fastapi`, `uvicorn`, `psycopg2-binary`, `bcrypt`, `python-jose[cryptography]`, `python-multipart`, `pydantic-settings`
- `Dockerfile` — standard Python 3.11-slim; build context is repo root

**Dockerfile COPY path fix:**
Build context is the repo root (not the service directory). All `COPY` paths must be relative to root:
```dockerfile
COPY services/auth-service/requirements.txt /app/requirements.txt
COPY shared /app/shared
COPY services/auth-service /app
```

**docker-compose.yml changes:**
- `auth-service` environment: wired `POSTGRES_URL`, `JWT_SECRET`, `JWT_EXPIRE_HOURS`, `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD` from `.env`
- `postgres-auth` already present, no changes needed

---

### Traefik — Docker provider removed

**Problem:** Traefik v3.3 uses Go's Docker SDK which defaults to Docker API 1.24. Colima's daemon requires minimum API 1.44. Setting `DOCKER_API_VERSION=1.44` env var has no effect on Traefik's embedded Go client.

```
ERR Provider error: client version 1.24 is too old, minimum supported API version is 1.44
```

Attempts tried:
1. `DOCKER_API_VERSION=1.44` environment variable on traefik — no effect
2. Upgrade to `traefik:v3.3` — same embedded SDK behaviour

**Fix:** Removed Docker provider entirely. All routing is static via file provider.

`api-gateway/traefik/traefik.yml` — removed `docker:` block, kept only:
```yaml
providers:
  file:
    filename: /etc/traefik/dynamic.yml
```

`docker-compose.yml` — removed Docker socket mount from Traefik, removed all `labels:` from services (no longer needed with file provider).

`api-gateway/traefik/dynamic.yml` — added static routes for all services:
- `/auth` → `http://auth-service:8000`
- `/sap` → `http://sap-b1-adapter-service:8000`
- `/orders`, `/inventory`, `/reporting`, `/sensor` → stub services

**Trade-off:** New services require a manual entry in `dynamic.yml` + Traefik restart. No auto-discovery. Acceptable for this stage.

---

### MSSQL container — stale volume issue

**Problem:** On first run, `make infra-up` started `mssql_server` fine. However SA login failed with error 18456 state 8 ("Password did not match") because the `sql_data` volume was created in a previous session with a different SA password and persisted.

**Symptom:** `pyodbc.InterfaceError: ('28000', "Login failed for user 'sa'. (18456)")`

**Fix:** `docker compose -f infrastructure/mssql/docker-compose.yml down -v` to delete the stale volume, then `make infra-up` to reinitialize with the correct password from `.env`.

**Note:** `autocommit=True` must be passed as a `pyodbc.connect()` keyword argument, not inside the ODBC connection string. Including it in the string causes a malformed DSN and a misleading 18456 error.

```python
# Wrong — causes malformed connection string
conn = pyodbc.connect('...;autocommit=True;')

# Correct
conn = pyodbc.connect('...', autocommit=True)
```

---

### MSSQL schema — `logs_SyncJobs` table added to `init.sql`

The `sap-b1-adapter-service` job history routes require a `logs_SyncJobs` table that was missing from the original `sap/dockerize/app/init.sql`.

Added to `infrastructure/mssql/init.sql`:
```sql
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'logs_SyncJobs')
BEGIN
    CREATE TABLE dbo.logs_SyncJobs (
        job_id        BIGINT IDENTITY PRIMARY KEY,
        started_at    DATETIME2 NOT NULL,
        finished_at   DATETIME2,
        status        NVARCHAR(20),
        source_query  NVARCHAR(100),
        target_table  NVARCHAR(100),
        rows_written  INT,
        error_message NVARCHAR(MAX),
        endpoint      NVARCHAR(MAX)
    );
END
```

---

### `.env` — inline comment fix

Docker Compose includes inline comments as part of the value. Example:

```dotenv
# This sets the value to "mssql_server,1433 # the container"
DST_SQL_SERVER=mssql_server,1433 # the container
```

Fix: rewrote `.env` without any inline comments.

---

### Created `docs/START.md`

First version of the getting started guide:
- Prerequisites table
- `.env` setup with all required variables
- Colima start instructions
- First-start curl commands for auth and SAP sync
- Troubleshooting table

---

## Build Status

| Service | Status | Notes |
|---|---|---|
| auth-service | ✅ Running | JWT + bcrypt + PostgreSQL + bootstrap admin |
| sap-b1-adapter-service | ✅ Running | SAP B1 sync → MSSQL ReportingDB confirmed working |
| binpack-service | ✅ Running | Stateless packing computation; items.json baked in |
| mssql_server | ✅ Running | azure-sql-edge, infra stack, ReportingDB initialized |
| orders-service | 🔲 Stub | Not yet implemented |
| inventory-service | 🔲 Stub | Not yet implemented |
| reporting-service | 🔲 Stub | Not yet implemented |
| sensor-ingest-service | 🔲 Stub | Not yet implemented |
| traefik | ✅ Running | File provider, static routes, CORS middleware, file watch |
| rabbitmq | ✅ Running | Management UI on :15672 |
| prometheus / loki / grafana | ✅ Running | Monitoring stack |

| Frontend | Status | Port | Notes |
|---|---|---|---|
| sap-sync-ui | ✅ Working | 5173 | Login + SAP sync confirmed |
| sap-map-ui | ✅ Working | 5174 | Leaflet map with mock data |
| binpack-ui | ✅ Working | 5175 | UI + backend both running |
| admin-ui | ✅ Working | 5176 | Login confirmed; /maps stub (no backend) |
