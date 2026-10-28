# BRD MicroServices – Projektdokumentáció

| Metaadat | Érték |
|---|---|
| **Készítő** | CLAUDE |
| **Model** | Opus 5.5 |
| **Készült** | 2026-10-20 |
| **Verzió** | 0.1.0 |
| **Módosítás dátuma** | 2026-10-20 |
| **Módosítás leírása** | Első kiadás: projektleírás, architektúra, megvalósítás lépésről lépésre, PVE2 / CT 503 integráció, üzemeltetés, a helyi Colima kivezetésének terve |

### Verziótörténet

| Verzió | Dátum | Leírás |
|---|---|---|
| 0.1.0 | 2026-10-20 | Első kiadás: a repó (git-történet, `docs/`, `docker-compose.yml`, scriptek) teljes áttekintése alapján |

> **Forrás:** a dokumentum a repó állapotából készült (`main`, utolsó commit: `d3205cd updated LOT-GEN`, 2026-07-22).
> Ez egy összefoglaló dokumentum. A részletes angol nyelvű leírások a [docs/](.) mappában maradnak, és ahol kell, hivatkozunk rájuk.
>
> ⚠️ **Feltételezés:** a „pve2 503” jelentése: a **`pve2` Proxmox node-on futó, 503-as CTID-jű LXC konténer**, amely az **`10.63.10.111`** IP-címen érhető el. Ezt a hozzárendelést a repó nem rögzíti (a dokumentumokban csak `<CTID>` szerepel). A dokumentáció elkészítésekor az LXC nem volt elérhető erről a gépről (VPN/hálózat), ezért élőben nem tudtam ellenőrizni. Ellenőrzés a PVE shellben: `pct config 503`.

---

## Tartalomjegyzék

1. [Projektleírás](#1-projektleírás)
2. [Architektúra](#2-architektúra)
3. [Szolgáltatások és frontendek](#3-szolgáltatások-és-frontendek)
4. [Technológiai stack](#4-technológiai-stack)
5. [Repó szerkezete](#5-repó-szerkezete)
6. [Megvalósítás lépésről lépésre (idővonal)](#6-megvalósítás-lépésről-lépésre-idővonal)
7. [Fejlesztői környezet (VS Code + Mac + Colima)](#7-fejlesztői-környezet-vs-code--mac--colima)
8. [PVE2 / CT 503 integráció (éles környezet)](#8-pve2--ct-503-integráció-éles-környezet)
9. [Telepítési (deploy) folyamat](#9-telepítési-deploy-folyamat)
10. [Üzemeltetés: indítás, mentés, visszaállítás, monitorozás](#10-üzemeltetés-indítás-mentés-visszaállítás-monitorozás)
11. [Hibaelhárítás](#11-hibaelhárítás)
12. [A helyi Colima kivezetése (kézi lépések)](#12-a-helyi-colima-kivezetése-kézi-lépések)
13. [Nyitott kérdések, ismert hiányosságok](#13-nyitott-kérdések-ismert-hiányosságok)
14. [Kapcsolódó dokumentumok](#14-kapcsolódó-dokumentumok)

---

## 1. Projektleírás

A **BRD MicroServices** egy monorepóban fejlesztett, konténerizált mikroszolgáltatás-platform, amely a gyártó vállalat belső folyamatait szolgálja ki. Egységes bejelentkezéssel és szerepkör-alapú jogosultságokkal integrálja a következő rendszereket:

| Terület | Mit csinál |
|---|---|
| **SAP Business One** | SAP B1 Service Layer lekérdezések futtatása (VPN-en keresztül), az eredmények szinkronizálása az MSSQL `ReportingDB`-be. Query Builder, ütemezett és kézi szinkron, job-napló. |
| **Felhasználókezelés** | JWT-alapú bejelentkezés, felhasználók CRUD, szerepkör-hierarchia (`superadmin > admin > operator > viewer`), szolgáltatásonkénti jogosultsági mátrix, avatar, SessionGuard (inaktivitási kiléptetés). |
| **Fájlkezelés** | Képek, PDF-ek, Office-fájlok, CSV és videó feltöltése és kiszolgálása; metaadatok PostgreSQL-ben. |
| **Címkenyomtatás** | Címketervező (Konva canvas) → ZPL → CAB SQUIX / Zebra nyomtató nyers TCP-n (port 9100). |
| **LOT-generálás (LOTGEN)** | Sorszámozott sarzs- (LOT) számok előtagonkénti számlálóval, ZPL-címkenyomtatás, Avery 3474 PDF-ívek. |
| **PLC / OPC-UA** | Siemens S7-1500 OPC-UA lekérdezése, idősoros adatok InfluxDB-be, élő státusz-dashboard, node-konfiguráció; fejlesztéshez szimulátor. |
| **Logisztika** | 3D bin-packing (EUR raklap) optimalizálás és vizualizáció. |
| **Térkép** | SAP partnercímek megjelenítése Leaflet térképen. |
| **Megfigyelhetőség** | Prometheus metrikák, Grafana dashboardok, Loki/Promtail log-gyűjtés, Portainer. |

**Alapelvek:**

- Minden frontend **csak az API gatewayen (Traefik)** keresztül éri el a backendet, közvetlenül soha.
- Minden szolgáltatásnak **saját adatbázisa** van (database-per-service).
- A JWT-t az `auth-service` adja ki; a többi szolgáltatás a közös `JWT_SECRET`-tel **lokálisan, állapotmentesen** validálja.
- A konfigurációt **környezeti változók** adják (`.env`); a közös beállítások a `shared/python_common` csomagban vannak.

---

## 2. Architektúra

### 2.1 Logikai kép

```text
 Böngésző
   │
   ├── admin-ui :5176 ── sap-sync-ui :5173 ── sap-map-ui :5174 ── binpack-ui :5175
   ├── lotgen-ui :5177 ── live-labeling-ui :5178 ── s7-status-ui :5179
   │       (mindegyik nginx konténer; az API-útvonalakat a Traefiknek proxyzza)
   ▼
 Traefik API gateway  :80 (route-ok)   :8080 (dashboard)
   │  PathPrefix-alapú routing
   ├── /auth       → auth-service           → postgres-auth   (auth_db)
   ├── /files      → file-service           → postgres-files  (files_db) + ./files
   ├── /sap        → sap-b1-adapter-service → MSSQL ReportingDB (db_net) + OpenVPN → SAP B1
   ├── /maps       → maps-service           → postgres-maps   (maps_db)
   ├── /opcua      → opcua-service          → postgres-opcua + InfluxDB → S7-1500 PLC
   ├── /labeling   → labeling-service       → postgres-labeling → nyomtató :9100
   ├── /lot        → lotgen-service         → postgres-lot    (lot_db) → /labeling
   ├── /binpack    → binpack-service        (nincs DB)
   └── /orders /inventory /reporting /sensor → stub szolgáltatások → postgres (megosztott)

 Infrastruktúra:  RabbitMQ · Prometheus · Loki · Promtail · Grafana · Portainer
```

### 2.2 Két Compose-stack

| Stack | Fájl | Tartalom |
|---|---|---|
| **Infrastruktúra** | `infrastructure/mssql/docker-compose.yml` | `mssql_server` (SQL Server 2022), a `db_net` hálózat **tulajdonosa** |
| **Alkalmazás** | `docker-compose.yml` | Az összes szolgáltatás, a PostgreSQL-ek, a monitoring és a frontendek |

**Indok:** az alkalmazás-stack újraépítése vagy törlése (`down -v`) nem érinti az MSSQL-t. **Sorrend:** mindig az MSSQL-stack indul először, mert ő hozza létre a `db_net` hálózatot.

### 2.3 Adattárolás

| Adat | Hol van | Típus |
|---|---|---|
| PostgreSQL-ek (auth, shared, files, maps, labeling, lot) | `./data/pg-*` | bind mount |
| MSSQL | `./data/mssql` | bind mount |
| InfluxDB, Prometheus, Loki, Grafana | `./data/<név>` | bind mount |
| Feltöltött fájlok | `./files` | bind mount |
| **OPC-UA node-definíciók** (`postgres-opcua`) | `postgres_opcua_data` | **named volume** (a Docker VM-en belül) |
| RabbitMQ, Portainer | `rabbitmq_data`, `portainer_data` | **named volume** |
| VPN-konfiguráció | `./vpn` (csak az LXC-n) | bind mount, csak olvasható |

> A bind mountok a host fájlrendszerén vannak. A named volume-ok viszont **a Docker-hoszt belsejében**: Macen a Colima VM-ben, az LXC-n a `/var/lib/docker/volumes` alatt. Ez a Colima törlésekor számít (lásd [12. fejezet](#12-a-helyi-colima-kivezetése-kézi-lépések)).

---

## 3. Szolgáltatások és frontendek

### 3.1 Backend-szolgáltatások (FastAPI, Python)

| Szolgáltatás | Gateway prefix | DB (host port) | Állapot | Rövid leírás |
|---|---|---|---|---|
| `auth-service` | `/auth` | postgres-auth (5433) | ✅ kész | JWT, refresh, user CRUD, szerepkörök, `role_permissions`, szolgáltatás-registry, Docker-vezérlés (`docker.sock`) |
| `sap-b1-adapter-service` | `/sap` | MSSQL (1433) | ✅ kész | Query Builder, SQL-előfeldolgozó, szinkron (szinkron + aszinkron job), ütemezés, beépített OpenVPN-kezelő |
| `file-service` | `/files` | postgres-files (5436) | ✅ kész | Base64 data-URL feltöltés, `{STORAGE_DIR}/{folder}/{uuid}{ext}` |
| `maps-service` | `/maps` | postgres-maps (5435) | ✅ kész | Partnerek bulk upsert, térképadatok |
| `opcua-service` | `/opcua` | postgres-opcua (5438) + InfluxDB | ✅ kész | S7-1500 polling, node-config CRUD, mértékegységek, idősorok |
| `opcua-simulator` | – (OPC-UA :4840) | postgres-opcua | ✅ dev | asyncua alapú hamis PLC (`--profile sim`) |
| `labeling-service` | `/labeling` | postgres-labeling (5437) | ✅ kész | `POST /labeling/print`: ZPL nyers TCP-n a nyomtatónak |
| `lotgen-service` | `/lot` | postgres-lot (5440) | ✅ kész | LOT-sorszámok, előtag-számlálók, nyomtatás a labeling-service-en át |
| `binpack-service` | `/binpack` | – | ✅ kész | 3D raklap-optimalizálás |
| `orders-` / `inventory-` / `reporting-` / `sensor-ingest-service` | `/orders` … `/sensor` | postgres (5434, megosztott) | 🟡 stub | Csak health/metrics; későbbi fázis |

### 3.2 Frontendek (React 19 + TypeScript + Vite + MUI, nginx konténerben)

| Frontend | Port | Használt API-k | Funkció |
|---|---|---|---|
| `admin-ui` | 5176 | `/auth`, `/files` | Dashboard, felhasználók, jogosultságok, szolgáltatások, fájlkezelők, grafikonok |
| `sap-sync-ui` | 5173 | `/auth`, `/sap` | Query Builder, Query List, szinkron, job-történet, crontab ütemezés, DB tools |
| `sap-map-ui` | 5174 | `/auth`, `/maps` | Vevők térképen |
| `binpack-ui` | 5175 | `/auth`, `/binpack` | 3D raklap-vizualizáció |
| `lotgen-ui` | 5177 | `/auth`, `/lot` | LOT-generálás, nyomtatás, PDF |
| `live-labeling-ui` | 5178 | `/auth`, `/labeling` | Címketervező (Konva, vonalkód, QR, DataMatrix) |
| `s7-status-ui` | 5179 | `/auth`, `/opcua` | PLC élő státusz, node-konfiguráció, grafikonok |

### 3.3 Infrastruktúra-konténerek

| Konténer | Port | Megjegyzés |
|---|---|---|
| `traefik` (v3.3) | 80, 8080 | File provider: `api-gateway/traefik/dynamic.yml` |
| `mssql_server` (SQL Server 2022) | 1433 | Külön stack; az ARM-os Macen korábban azure-sql-edge futott |
| `rabbitmq` | 5672, 15672 | Jelenleg gyakorlatilag nincs használva (lásd [TODO.md](TODO.md)) |
| `influxdb` (2.7) | 8086 | OPC-UA idősorok |
| `prometheus` | 9090 | `/metrics` scrape |
| `loki` + `promtail` | 3100 | Log-gyűjtés, Grafanában még nincs bekötve |
| `grafana` | 3000 | Előre telepített OPC-UA dashboard |
| `portainer` | 9000 | Konténer-UI |

A teljes port-, DB- és jelszó-referencia: [Ports.md](Ports.md), illetve az LXC-re: [migration/PortsOnUbuntu.md](migration/PortsOnUbuntu.md).

---

## 4. Technológiai stack

| Réteg | Technológia |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy / psycopg, pyodbc (MSSQL, ODBC Driver 18), asyncua, python-jose (JWT) |
| Frontend | React 19, TypeScript, Vite, MUI v6, Redux Toolkit, React Router v7, axios, react-toastify, material-react-table, Konva, Leaflet, three.js |
| Gateway | Traefik v3 (path-alapú routing) |
| Adatbázis | PostgreSQL 16 (szolgáltatásonként), SQL Server 2022, InfluxDB 2.7 |
| Üzenetsor | RabbitMQ 3 (előkészítve) |
| Monitoring | Prometheus, Grafana, Loki, Promtail, Portainer |
| Konténer | Docker + Compose v2. Dev: **Colima** (Mac M-széria, arm64). Prod: **Docker CE az LXC-ben** (amd64) |
| Hálózat | OpenVPN kliens a `sap-b1-adapter-service` konténeren belül (SAP B1: `172.22.248.4:50000`) |
| Fejlesztőeszköz | VS Code, pnpm workspace, Makefile, `startup.sh` / `shutdown.sh` |

---

## 5. Repó szerkezete

```text
MicroServices/
├── api-gateway/traefik/        traefik.yml (statikus), dynamic.yml (route-ok), certs/
├── services/                   13 backend (auth, sap-b1-adapter, file, maps, opcua, opcua-simulator,
│                               labeling, lotgen, binpack, orders, inventory, reporting, sensor-ingest)
├── frontend/                   7 frontend (Dockerfile + nginx.conf mindegyikben)
├── shared/python_common/       CommonSettings, metrics_router, vpn_manager
├── infrastructure/
│   ├── mssql/                  külön Compose-stack, init.sql, init-schema.py
│   └── postgres/               init-multiple-dbs.sh (megosztott postgres)
├── monitoring/                 prometheus / promtail / grafana provisioning
├── docs/                       dokumentáció, migration/ (deploy-scriptek), sql/ (mentett adatok)
├── data/                       DB-adatkönyvtárak (gitignore)
├── files/                      file-service tárhely (gitignore)
├── docker-compose.yml          alkalmazás-stack
├── Makefile                    orkesztrációs parancsok
├── startup.sh / shutdown.sh    lépésenkénti indítás / leállítás
└── .env / .env.example         titkok / sablon
```

**Új szolgáltatás felvétele:** lépésről lépésre a [Adding_a_Service.md](Adding_a_Service.md) írja le. Röviden: Dockerfile a repó gyökeréből mint build-contextből, compose-bejegyzés, Traefik-route, LXC-adatkönyvtár, majd build.

---

## 6. Megvalósítás lépésről lépésre (idővonal)

A git-történet (24 commit), a [CHANGES.md](CHANGES.md) és a migrációs dokumentumok alapján.

### 0. fázis – Alapok (2026-03-08 – 03-13)
1. Kiindulás az enterprise starter template-ből ([Starter_template.md](Starter_template.md)): monorepo-váz, Traefik gateway (az Nginx helyett), FastAPI-szolgáltatásonkénti szerkezet.
2. `shared/python_common`: közös `CommonSettings` és `metrics_router`. Minden Dockerfile a repó gyökeréből buildel (`COPY shared /app/shared`).
3. Kétstackes Docker-felépítés: MSSQL külön stackben, `db_net` hálózat.

### 1. fázis – Mag-szolgáltatások (2026-03-14 – 03-17, 1–8. session)
4. **auth-service:** JWT, user CRUD, szerepkör-rang (`ROLE_RANK`), `role_permissions` JSONB, szolgáltatás-registry, Docker-socketen át service start/stop.
5. **sap-b1-adapter-service:** SAP B1 Service Layer → MSSQL `ReportingDB`, `wrk_QueryDef` / `wrk_TableDesc` / `logs_SyncJobs`, aszinkron sync + job-polling, SQL-előfeldolgozó, SAP-hibák átláthatósága.
6. **file-service** és **admin-ui** (Dashboard, ServiceList/Manage, felhasználók, jogosultságok, FileManager 1–2).
7. **sap-sync-ui:** Query Builder, Query List, jogosultság-szűrés, Jobs (material-react-table), időzítés.
8. **live-labeling-ui** újraépítése az admin-ui architektúrájára + Konva-tervező. **maps-service** + **sap-map-ui**. **binpack-service** + **binpack-ui**.
9. 2026-03-17: **első commit** a git repóba; SQL-adatok tisztítása, README.

### 2. fázis – PLC / OPC-UA (2026-03-19 – 03-20, 9–12. session)
10. **opcua-service:** S7-1500 polling, `node_definitions` + `sensor_units` DB, InfluxDB-perzisztencia.
11. **opcua-simulator:** DB-alapú viselkedések (`--profile sim`).
12. **s7-status-ui:** élő státusz, NodeConfig, Charts. Grafana OPC-UA dashboard.
13. Részletes útmutató: [s7_opcua_unified_guide.md](s7_opcua_unified_guide.md).

### 3. fázis – Biztonság, UX (2026-03-21 – 04-26)
14. `POST /auth/refresh`, **SessionGuard** (inaktivitási timeout) minden frontendben.
15. Migrációs útmutató v1 (macOS → Linux): [migration/MIGRATION_Guide_v1.md](migration/MIGRATION_Guide_v1.md).
16. Címkeszerkesztő-csere (03-29), OPC-UA szolgáltatás módosítása (04-26), demóvideó.

### 4. fázis – Éles telepítés Proxmox LXC-re (2026-05-03 – 05-10)
17. **Deploy-terv v2** ([migration/MIGRATION_Guide_v2.md](migration/MIGRATION_Guide_v2.md)): minden frontend kapott többlépcsős `Dockerfile`-t (node build → nginx) és egy `nginx.conf`-ot, amely az API-útvonalakat a `traefik:80`-ra proxyzza.
18. Scriptek a `docs/migration/scripts/` alatt: `lxc-setup.sh`, `deploy.sh`, `gen-cert.sh`, `microservices.service`.
19. MSSQL image-csere: `azure-sql-edge` (ARM) → `mssql/server:2022-latest` (amd64). Az azure-sql-edge LXC-ben capability-hibát dob.
20. **LXC-deploy** (05-10): adatkönyvtárak UID-jogosultságai, MSSQL `ReportingDB` visszaállítása a `docs/sql/MSSQL/ReportingDB/*.sql` fájlokból ([migration/MIGRATION_SUMMARY.md](migration/MIGRATION_SUMMARY.md)).
21. **OpenVPN a konténerben:** `vpn_manager.py`, igény szerinti tunnel, idle-lekapcsolás, TUN device az LXC-ben ([migration/OVPN_Guide.md](migration/OVPN_Guide.md)). Állapot: *FULLY WORKING (2026-05-10)*.

### 5. fázis – LOTGEN és nyomtatás (2026-05-17 – 07-22)
22. **lotgen-service + lotgen-ui** beintegrálása az önálló `LOTGEN` projektből, közös auth-tal ([LOTGEN.md](LOTGEN.md)). Szinkronizáló script: `sync-lotgen.sh` ([migration/LOTGEN_Migration_Guide.md](migration/LOTGEN_Migration_Guide.md)).
23. Útmutató új szolgáltatáshoz: [Adding_a_Service.md](Adding_a_Service.md).
24. **Printing service** frissítése (07-09): hibakódok (503/504), timeoutok ([PrintingService.md](PrintingService.md)).
25. **LOTGEN frissítése** (07-22): az utolsó commit.

> ⚠️ A 2026-07-09-i és 07-22-i változásokról a repó nem rögzíti, hogy telepítve lettek-e az LXC-re. A [12.2 pont](#122-a-paritás-ellenőrzése-mac--ct-503) egy rsync dry-runnal ellenőrzi ezt.

---

## 7. Fejlesztői környezet (VS Code + Mac + Colima)

### 7.1 Előfeltételek
- Colima (Docker runtime, `docker context use colima`), Docker CLI + Compose v2
- Node.js 22+, pnpm 10+, Python 3.x (szolgáltatásonként venv), unixODBC + MS ODBC Driver 18
- VS Code (a `.vscode/` mappában vannak a workspace-beállítások)

### 7.2 Indítás helyben
```bash
colima start && docker context use colima
make infra-up          # MSSQL + db_net
make infra-init        # első alkalommal: ReportingDB séma
./startup.sh           # teljes stack (--sim: OPC-UA szimulátor, --feAll: frontend dev szerverek)
```
A Makefile főbb célpontjai: `up`, `up-core`, `up-sap`, `up-opcua`, `up-sim`, `down`, `down-all`, `reset`, `fe-*` (Vite dev szerverek), `dev-*` (backend Docker nélkül), `logs`, `ps`.

### 7.3 Különbségek a Mac-dev és az LXC-prod között

| Téma | Mac (dev) | CT 503 (prod) |
|---|---|---|
| Architektúra | arm64 | amd64 |
| MSSQL image | korábban azure-sql-edge | `mssql/server:2022-latest` |
| SAP-elérés | `VPN_BYPASS=true`, Mac-es VPN-kliens + `host.docker.internal:50001` | `VPN_BYPASS=false`, OpenVPN a konténerben |
| Hostnév | `localhost` / `brd-micro` | `10.63.10.111` (tervezett DNS: `brd.internal`) |
| `.env` | Mac-es | külön, a deploy **nem írja felül**. A Mac-es `.env`-et **soha ne másold** az LXC-re! |

### 7.4 Frontendfejlesztés Colima nélkül
A Vite-proxy célpontját környezeti változó adja (`vite.config.*`: `AUTH_DEV_URL`, `SAP_DEV_URL`, … alapértéke `http://localhost`). A helyi frontend dev szerver ezért **közvetlenül az LXC backendjét** is használhatja, Colima nélkül is:
```bash
cd frontend/sap-sync-ui
AUTH_DEV_URL=http://10.63.10.111 SAP_DEV_URL=http://10.63.10.111 pnpm dev
```
Ezzel a Colima kivezetése után is lehet frontendet fejleszteni.

---

## 8. PVE2 / CT 503 integráció (éles környezet)

### 8.1 Célkörnyezet

| Tulajdonság | Érték |
|---|---|
| Proxmox node | `pve2` *(feltételezés, lásd a fejléc megjegyzését)* |
| CTID | `503` *(feltételezés)* |
| IP | `10.63.10.111` |
| Hostnév | `brd-micro` (tervezett DNS: `brd.internal`) |
| OS | Ubuntu 22.04 / Debian 12 |
| Erőforrás (terv) | 4 vCPU, 8–10 GB RAM, 60 GB disk |
| Deploy-gyökér | `/opt/microservices` |
| Belépés | SSH nem-root felhasználóval + `sudo` (root SSH tiltva) |

### 8.2 LXC-konfiguráció a PVE hoston (`/etc/pve/lxc/503.conf`)

```ini
features: nesting=1,keyctl=1
# TUN device az OpenVPN-hez (sap-b1-adapter-service)
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
```
- A `nesting=1` a Docker futtatásához kell. Az `auth-service` a `/var/run/docker.sock`-ot mountolja. Ha ez nem elég, `unprivileged: 0` (privilegizált konténer) a megoldás.
- Módosítás után hidegindítás kell: `pct stop 503 && pct start 503`.
- Ellenőrzés az LXC-ben: `ls -la /dev/net/tun` → `crw-rw-rw- … 10, 200`.

### 8.3 Első telepítés (egyszeri)

| # | Hol | Lépés |
|---|---|---|
| 1 | PVE (pve2) | CT-template letöltése, CT 503 létrehozása (8.1 szerint), a 8.2-es konfig beírása, indítás |
| 2 | CT 503 (root) | `bash lxc-setup.sh`: Docker CE + compose plugin, `/opt/microservices/data/*` könyvtárak, UID-jogosultságok |
| 3 | Mac | (opcionális) `gen-cert.sh brd.internal`: saját CA + szerver-tanúsítvány a Traefiknek |
| 4 | Mac | `bash docs/migration/scripts/deploy.sh 10.63.10.111`: kód feltöltése |
| 5 | CT 503 | `cp .env.example .env && nano .env`: titkok kitöltése (JWT_SECRET, POSTGRES_PASSWORD, MSSQL_SA_PASSWORD, SAP_B1_*, OPCUA_ENDPOINT, PRINTER_IP, VPN_* …) |
| 6 | CT 503 | VPN-fájlok a `/opt/microservices/vpn/` alá (`chmod 700`, a kulcsok és a credentials `600`) |
| 7 | CT 503 | `docker compose -f infrastructure/mssql/docker-compose.yml up -d`, várakozás, `init.sql`, adat-visszatöltés |
| 8 | CT 503 | `docker compose up -d --build` |
| 9 | CT 503 | systemd: `microservices.service` → `/etc/systemd/system/`, `systemctl enable --now microservices` |
| 10 | kliensek | hosts/DNS: `10.63.10.111 brd.internal`, a CA importja (ha TLS van) |

### 8.4 Adatkönyvtárak jogosultságai (CT 503)

| Könyvtár | UID:GID |
|---|---|
| `data/mssql`, `data/loki` | `10001:10001` |
| `data/grafana` | `472:472` |
| `data/prometheus` | `65534:65534` |
| `data/influxdb` | `1000:1000` |
| `data/pg-*` | a PostgreSQL (UID 999) maga állítja be első induláskor |

> Megjegyzés: a `lxc-setup.sh` `mkdir` sorából hiányzik a `data/mssql`, a `chown` viszont hivatkozik rá. Friss gépen ezért a [MIGRATION_SUMMARY.md §3a](migration/MIGRATION_SUMMARY.md) parancsait kell használni.

### 8.5 Automatikus indulás (systemd)
`microservices.service` (oneshot):
1. MSSQL-stack `up -d` → 15 s várakozás → alkalmazás-stack `up -d`.
2. Leállításkor csak az alkalmazás-stack áll le; az MSSQL fut tovább.
3. Minden konténer `restart: unless-stopped`.

### 8.6 SAP-integráció VPN-nel
A `sap-b1-adapter-service` minden SAP-hívás előtt meghívja az `ensure_connected()`-et:
TCP-probe a `172.22.248.4:50000`-ra → ha nem él, `openvpn` indul a konténerben (`/etc/vpn/*.conf`) → a tunnel `VPN_IDLE_TTL` (300 s) tétlenség után lebomlik. Ha nincs TUN device vagy hiányzik a konfig: **HTTP 503 `VPN_NOT_CONNECTED`**. Részletek: [migration/OVPN_Guide.md](migration/OVPN_Guide.md).

### 8.7 Szolgáltatás-URL-ek (CT 503)

| Mit | URL |
|---|---|
| API gateway | `http://10.63.10.111` (pl. `/auth/health`) |
| admin-ui / sap-sync-ui / sap-map-ui / binpack-ui | `:5176` / `:5173` / `:5174` / `:5175` |
| lotgen-ui / live-labeling-ui / s7-status-ui | `:5177` / `:5178` / `:5179` |
| Grafana / Traefik / RabbitMQ / Portainer | `:3000` / `:8080` / `:15672` / `:9000` |

### 8.8 Külső rendszerek a CT 503-ból nézve

| Rendszer | Cím | Szükséges |
|---|---|---|
| SAP B1 Service Layer | `172.22.248.4:50000` (VPN) | `/dev/net/tun`, VPN-fájlok |
| CAB SQUIX nyomtató | `10.63.94.107:9100` (`PRINTER_IP`) | routing a 10.63.94.x felé |
| Siemens S7-1500 | `OPCUA_ENDPOINT` (opc.tcp://…:4840) | routing a PLC-hálóra |

---

## 9. Telepítési (deploy) folyamat

### 9.1 Kódfrissítés (Mac → CT 503)
```bash
# Macen, a repó gyökerében
bash docs/migration/scripts/deploy.sh 10.63.10.111
```
A `deploy.sh` két lépésben dolgozik:
1. `rsync` → `~/ms-staging` (kihagyja: `node_modules`, `.git`, `/.env`, `/data/`, `/files/`, `__pycache__`, `*.log`).
2. `sudo rsync --delete` → `/opt/microservices` (szintén **nem nyúl** a `.env`, `data/`, `files/`, `vpn/` könyvtárakhoz).

Utána a CT 503-on:
```bash
cd /opt/microservices
sudo docker compose up -d --build                  # csak a változott image-ek épülnek újra
sudo docker compose restart traefik                # ha dynamic.yml változott
```

### 9.2 LOTGEN-szinkron (önálló projekt → monorepo)
```bash
bash docs/migration/scripts/sync-lotgen.sh
```
Az ütközésmentes fájlokat automatikusan másolja. Az auth- és deploy-specifikus fájlokról (`main.py`, `database.py`, `settings.py`, `Dockerfile`) csak diffet mutat, ezeket kézzel kell összefésülni. Ezután jön a 9.1-es deploy.

### 9.3 Biztonsági megjegyzés a scriptekhez
A `deploy.sh` `sshpass`-szal, a scriptbe írt jelszóval dolgozik, és kikapcsolja a host key ellenőrzést. Javasolt áttérni SSH-kulcsos belépésre (`ssh-copy-id`), és a jelszót eltávolítani a scriptből és a dokumentumokból (pl. a `MIGRATION_SUMMARY.md`-ben szerepel az MSSQL `sa` jelszava).

---

## 10. Üzemeltetés: indítás, mentés, visszaállítás, monitorozás

### 10.1 Napi parancsok (CT 503)
```bash
cd /opt/microservices
sudo docker compose ps
sudo docker compose logs -f --tail=100 <szolgáltatás>
sudo systemctl status microservices
```

### 10.2 Mentés – javasolt rend
| Mit | Hogyan |
|---|---|
| Teljes CT | PVE: `vzdump 503 --mode snapshot --storage <backup-storage>` (ütemezett job a PVE-ben) |
| PostgreSQL-ek | `docker exec <pg-konténer> pg_dumpall -U postgres > backup_<név>_<dátum>.sql` |
| MSSQL ReportingDB | `BACKUP DATABASE ReportingDB TO DISK='/var/opt/mssql/backup/ReportingDB.bak'` |
| Fájlok | `/opt/microservices/files` |
| Konfig | `/opt/microservices/.env`, `/opt/microservices/vpn/` (titkok, biztonságos helyen) |

### 10.3 Visszaállítás
- **MSSQL `ReportingDB` üres** (4060-as hiba): `init.sql` → táblák betöltése FK-sorrendben ([MIGRATION_SUMMARY.md §4](migration/MIGRATION_SUMMARY.md)).
- **Hiányzó `data/` könyvtárak:** [MIGRATION_SUMMARY.md §3](migration/MIGRATION_SUMMARY.md).

### 10.4 Monitorozás
- **Grafana** (`:3000`): OPC-UA dashboard, Prometheus-metrikák.
- **Prometheus** (`:9090`): minden szolgáltatás `/metrics` végpontja.
- **Loki:** gyűjt, de Grafanában nincs bekötve (nyitott döntés, [TODO.md](TODO.md)).
- **admin-ui → Services:** szolgáltatás-állapot, start/stop.

---

## 11. Hibaelhárítás

| Tünet | Ok | Megoldás |
|---|---|---|
| SAP sync → 503 `VPN_NOT_CONNECTED` | nincs TUN / VPN-fájl / rossz konfig | [OVPN_Guide §11](migration/OVPN_Guide.md) |
| SAP 401 a VPN felépülése után | rossz B1-felhasználó vagy -cég | `.env`: `SAP_B1_*` |
| Nyomtatás → 503/504 | nyomtató ki van kapcsolva, rossz IP, nincs route | [PrintingService.md](PrintingService.md) |
| OPC-UA 503 | a PLC/szimulátor nem elérhető | `OPCUA_ENDPOINT`, hálózat |
| MSSQL 4060 / login failed | üres `data/mssql` | 10.3 |
| Új route nem él | a Traefik nem töltötte újra a fájlt | `docker compose restart traefik` |
| Konténer jogosultsági hiba indításkor | rossz UID a `data/*`-n | 8.4 |
| `docker.sock` permission denied (auth-service) | LXC nesting / privilegizáltság | 8.2 |
| Mac: „Cannot connect to the Docker daemon” | Colima nem fut, rossz context | `colima start && docker context use colima` |

---

## 12. A helyi Colima kivezetése (kézi lépések)

> 🛑 **Ezt a fejezetet kézzel kell végrehajtani. Semmi nem fut le automatikusan.** A dokumentáció elkészítésekor semmi nem lett törölve vagy leállítva.

### 12.1 Kiinduló állapot (2026-10-20-i felmérés)

| Tétel | Állapot |
|---|---|
| Colima profil `default` | **Stopped**, 4 CPU, 6 GiB RAM, 60 GiB disk |
| `~/.colima` mérete | **≈ 54 GB** (gyakorlatilag a VM-disk: `~/.colima/_lima`) |
| Aktív Docker context | `desktop-linux` (a Docker Desktop nem fut). A `colima` context létezik |
| A repó `data/` könyvtára (bind mount, a Mac lemezén) | ≈ 3,3 GB (ebből MSSQL 2,5 GB). **Nincs** a Colima VM-ben |
| `files/` | ≈ 92 MB, benne a `files/ovpn/` (VPN-titkok!) |

**Ami a Colima törlésével VÉGLEG elveszne** (named volume-ok és image-ek a VM-ben):

| Projekt | Volume-ok |
|---|---|
| MicroServices | `postgres_opcua_data` (**OPC-UA node-definíciók, mértékegységek**), `rabbitmq_data`, `portainer_data` |
| `BRD/n8n/Email_Contacts_Topics` | `n8n_data`, `ollama_data`, `email_db_data` |
| `BRD/StandAloneOpcua` | `SAO_postgres_auth_data`, `SAO_postgres_opcua_data`, `SAO_influxdb_data` |
| `BRD/sap/dockerize/app` | `sql_data` |
| `BRD/LOTGEN` (önálló), `BRD/LM-n8n`, `BRD/osticket` | lehetnek konténerek/image-ek (bind mount esetén az adat megmarad) |

> ⚠️ A Colima **nem csak a MicroServices-é**. Teljes törlés előtt döntsd el, mi legyen az n8n/Ollama, a StandAloneOpcua és a sap/dockerize adataival.

### 12.2 A paritás ellenőrzése (Mac ↔ CT 503)

Minden pont legyen ✅, mielőtt bármit törölsz.

**A) Kód**
```bash
# Macen: mi térne el, ha most deployolnál (nem módosít semmit)
rsync -avnc --delete \
  --exclude=node_modules --exclude=.git --exclude=/.env --exclude=/data/ \
  --exclude=/files/ --exclude=/vpn/ --exclude='**/__pycache__' --exclude=.DS_Store --exclude='*.log' \
  ./ <user>@10.63.10.111:/opt/microservices/
```
- [ ] Nincs eltérés. Ha van (pl. a 07-09-i printing és a 07-22-i LOTGEN commit), előbb `deploy.sh` + `up -d --build`.

**B) Konténerek és health (CT 503)**
```bash
sudo docker compose ps          # minden Up / healthy
for p in auth files sap maps opcua labeling lot binpack; do
  printf "%-9s " $p; curl -s -o /dev/null -w "%{http_code}\n" http://localhost/$p/health; done
```
- [ ] Minden konténer fut, minden health 200
- [ ] Mind a 7 frontend betölt böngészőből (`:5173`–`:5179`)

**C) Funkcionális próba**
- [ ] Bejelentkezés (admin-ui), felhasználólista, jogosultságok
- [ ] SAP sync (sap-sync-ui): a VPN felépül, a job `success`, az MSSQL-be írás megtörténik
- [ ] Fájlfeltöltés és -letöltés (admin-ui → FileManager)
- [ ] LOT-generálás + nyomtatás (lotgen-ui) → fizikai címke
- [ ] Címketervező-nyomtatás (live-labeling-ui)
- [ ] s7-status-ui: élő PLC-értékek; Grafana OPC-UA dashboard
- [ ] Térkép, binpack

**D) Adat-paritás.** Csak ha a Mac-es adatok frissebbek vagy egyediek lehetnek. Indítsd el **ideiglenesen** a Colimát (`colima start`), és hasonlítsd össze:
```bash
# PostgreSQL: táblánkénti sorszám (ugyanez Macen: docker exec … és a CT 503-on: sudo docker exec …)
docker compose exec -T postgres-auth psql -U postgres -d auth_db -c \
  "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY 1;"
# Ugyanígy: postgres-files/files_db, postgres-maps/maps_db, postgres-labeling/labeling_db,
#           postgres-lot/lot_db, postgres-opcua/opcua_db, postgres (orders/inventory/reporting/events)

# MSSQL ReportingDB táblaméretek
docker exec -i mssql_server /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" \
  -d ReportingDB -No -C -Q "SELECT t.name, p.rows FROM sys.tables t JOIN sys.partitions p ON t.object_id=p.object_id WHERE p.index_id<2 ORDER BY t.name"

# Fájlok darabszáma
find files -type f | wc -l            # Macen
sudo find /opt/microservices/files -type f | wc -l   # CT 503-on
```
- [ ] `opcua_db` (node-definíciók): a CT 503-on is megvannak. **Ez van a named volume-ban, a Colimával együtt elveszne!**
- [ ] `labeling_db` (címkesablonok), `lot_db` (előtag-számlálók): a CT 503 a hiteles, a Mac-es adat nem kell
- [ ] `auth_db` (felhasználók, jogosultságok): a CT 503 a hiteles
- [ ] `ReportingDB`: a CT 503-on vannak a lekérdezés-definíciók (`wrk_QueryDef`) és az ütemezések

**E) Üzembiztonság**
- [ ] Újraindítási próba: `pct reboot 503` (pve2) → minden magától feláll (systemd)
- [ ] Van PVE-mentés a CT 503-ról (`vzdump 503`), és legalább egyszer visszaállítható volt
- [ ] A `.env` és a `vpn/` másolata biztonságos helyen van (jelszókezelő vagy titkosított tár)

### 12.3 Mentés a Macről a törlés előtt (Colima fut)

```bash
BK=~/Backups/colima_$(date +%Y%m%d); mkdir -p "$BK"
cd "/Users/pisti/My Projects.local/dev/BRD/MicroServices"

# 1) Named-volume-ban lévő OPC-UA DB
docker compose exec -T postgres-opcua pg_dumpall -U postgres > "$BK/ms_postgres_opcua.sql"

# 2) Az összes named volume nyers mentése (minden projektre)
for v in $(docker volume ls -q); do
  docker run --rm -v "$v":/v -v "$BK":/b alpine tar czf "/b/vol_$v.tgz" -C /v .
done

# 3) Volume-lista és image-lista dokumentálásra
docker volume ls > "$BK/volumes.txt"; docker image ls > "$BK/images.txt"
```
- [ ] A mentés megvan, a fájlméretek nem nullák (`ls -lh "$BK"`)

### 12.4 Két lehetőség

**„A” lehetőség – csak a MicroServices-erőforrások törlése (a többi projekt megmarad)**
```bash
cd "/Users/pisti/My Projects.local/dev/BRD/MicroServices"
docker compose down --rmi local -v                                  # app-stack konténerek, image-ek, named volume-ok
docker compose -f infrastructure/mssql/docker-compose.yml down      # MSSQL-konténer (az adat a data/mssql-ben marad)
docker image prune -a                                               # a megmaradt, nem használt image-ek
colima stop
```
> A VM-disk ettől nem feltétlenül zsugorodik a Mac-en; a hely csak a „B” lehetőséggel szabadul fel biztosan.

**„B” lehetőség – a Colima teljes törlése (≈ 54 GB felszabadul)**
Csak akkor, ha a 12.2 minden pontja ✅, a 12.3-as mentés kész, és a **többi projekt** (n8n/Ollama, StandAloneOpcua, sap/dockerize) adata is mentve van vagy már nem kell.
```bash
colima stop
colima delete                 # a 'default' VM és disk törlése (rákérdez)
docker context use default
docker context rm colima
# opcionális, ha a Colimára később sem lesz szükség:
# brew uninstall colima lima
# rm -rf ~/.colima
```

### 12.5 A törlés után (opcionális takarítás)
- A repó `data/` könyvtára (≈ 3,3 GB) a Mac lemezén marad, a Colima törlése **nem** érinti. Ha a CT 503 a hiteles forrás, archiválható (`tar czf`), majd törölhető. **Ez is kézi döntés.**
- A `files/ovpn/` titkokat tartalmaz: maradjon meg, vagy kerüljön titkosított tárba.
- A frontendfejlesztés ezután a CT 503 backendjével megy (lásd 7.4).
- Ha a jövőben helyi konténer kell, a Colima újratelepíthető (`brew install colima && colima start`). A stack a repóból és a mentésekből újraépíthető.

---

## 13. Nyitott kérdések, ismert hiányosságok

| # | Téma | Javaslat |
|---|---|---|
| 1 | A „pve2 / 503” hozzárendelés nincs rögzítve a repóban | `pct config 503` alapján pontosítsd ezt a dokumentumot |
| 2 | Titkok a scriptekben és dokumentumokban (`deploy.sh`, `MIGRATION_SUMMARY.md`) | SSH-kulcs, jelszavak eltávolítása, rotáció |
| 3 | TLS: a terv (`gen-cert.sh`, `brd.internal`) megvan, de a `traefik.yml` csak `:80`-at és `insecure` dashboardot használ | HTTPS entrypoint, dashboard védelme |
| 4 | RabbitMQ, Loki: erőforrást fogyasztanak, de nincsenek kihasználva | Döntés a [TODO.md](TODO.md) szerint |
| 5 | Stub szolgáltatások (orders, inventory, reporting, sensor) | Későbbi fázis |
| 6 | `lxc-setup.sh`: hiányzik a `data/mssql` `mkdir`, és a régi IP (`192.168.1.50`) szerepel a v2-es útmutatóban | Script- és dokumentumjavítás |
| 7 | A README hivatkozik a `docs/MIGRATION.md`-re, ami nem létezik (a `docs/migration/` alatt van) | Link javítása |
| 8 | Mentés: nincs dokumentált, ütemezett mentés a CT 503-ra | PVE backup job + DB-dump cron |
| 9 | Grafana régi memóriabejegyzés szerint `brd-micro:3000`. Hostnév vs. IP vs. `brd.internal` | Egységes DNS-név |

---

## 14. Kapcsolódó dokumentumok

| Dokumentum | Tartalom |
|---|---|
| [README.md](../README.md) | Részletes használati útmutató (angol), képernyőképek |
| [START.md](START.md) | Első telepítés, Makefile, start/stop scriptek |
| [architecture.md](architecture.md), [diagrams.md](diagrams.md) | Architektúra-diagramok |
| [Ports.md](Ports.md) / [migration/PortsOnUbuntu.md](migration/PortsOnUbuntu.md) | Portok, DB-k, hitelesítés (dev / LXC) |
| [Adding_a_Service.md](Adding_a_Service.md) | Új szolgáltatás felvétele, LXC-deploy |
| [migration/MIGRATION_Guide_v1.md](migration/MIGRATION_Guide_v1.md), [v2](migration/MIGRATION_Guide_v2.md) | macOS → Linux / Proxmox LXC terv |
| [migration/MIGRATION_SUMMARY.md](migration/MIGRATION_SUMMARY.md) | Deploy utáni lépések, MSSQL-visszaállítás |
| [migration/OVPN_Guide.md](migration/OVPN_Guide.md) | OpenVPN a konténerben, TUN az LXC-ben |
| [migration/LOTGEN_Migration_Guide.md](migration/LOTGEN_Migration_Guide.md) | LOTGEN szinkron és deploy |
| [LOTGEN.md](LOTGEN.md), [PrintingService.md](PrintingService.md) | LOT-generátor, nyomtatás |
| [s7_opcua_unified_guide.md](s7_opcua_unified_guide.md) | S7-1500 OPC-UA (TIA Portal → Python → prod) |
| [CHANGES.md](CHANGES.md), [TestingFunc.md](TestingFunc.md), [TODO.md](TODO.md) | Changelog, tesztnapló, nyitott döntések |
