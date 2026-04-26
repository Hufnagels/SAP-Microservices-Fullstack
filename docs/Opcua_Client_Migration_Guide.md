# OPC-UA Client Migration Guide: Simulator → Real S7-1500

**Scope:** Everything you need to change *inside this repository* to switch from the
built-in `opcua-simulator` to a real Siemens S7-1500 PLC.

For TIA Portal / PLC-side configuration (enabling the OPC-UA server, creating Data Blocks,
security settings, UaExpert node discovery) see
[s7_opcua_unified_guide.md](s7_opcua_unified_guide.md) — that guide is still fully current.

---

## Table of Contents

1. [What the Simulator Setup Looks Like](#1-what-the-simulator-setup-looks-like)
2. [Prerequisites](#2-prerequisites)
3. [Step 1 — Update `.env`](#3-step-1--update-env)
4. [Step 2 — Discover Real Node IDs](#4-step-2--discover-real-node-ids)
5. [Step 3 — Update Node Definitions in the DB](#5-step-3--update-node-definitions-in-the-db)
   - [Option A: via the UI (recommended)](#option-a-via-the-ui-recommended)
   - [Option B: via psql / direct SQL](#option-b-via-psql--direct-sql)
6. [Step 4 — Restart the Service](#6-step-4--restart-the-service)
7. [Step 5 — Verify](#7-step-5--verify)
8. [Security Upgrade (username / certificate)](#8-security-upgrade-username--certificate)
9. [Troubleshooting](#9-troubleshooting)
10. [Quick Reference: Simulator vs Real PLC](#10-quick-reference-simulator-vs-real-plc)

---

## 1. What the Simulator Setup Looks Like

| Item | Simulator value | Real PLC value |
|---|---|---|
| **OPCUA_ENDPOINT** | `opc.tcp://opcua-simulator:4840` | `opc.tcp://<PLC_IP>:4840` |
| **OPCUA_USERNAME** | *(empty)* | depends on TIA Portal config |
| **OPCUA_PASSWORD** | *(empty)* | depends on TIA Portal config |
| **OPCUA_SECURITY_MODE** | `None` | `None` / `Basic256Sha256` |
| **node_id column** | `ns=2;i=2` … `ns=2;i=9` (numeric simulator IDs) | `ns=3;s="DataBlocksGlobal"."DB_Process"."Temperature"` |

The simulator's numeric node IDs (`ns=2;i=X`) are **completely different** from real S7-1500
symbolic node IDs (`ns=3;s="..."`). This is the most important thing to update.

---

## 2. Prerequisites

Before starting:

- [ ] TIA Portal OPC-UA server is enabled on the CPU (see [s7_opcua_unified_guide.md §3.1](s7_opcua_unified_guide.md#31-enable-opcua-server))
- [ ] Data Blocks are created and marked **"Accessible from HMI/OPC UA"** (see [§3.3](s7_opcua_unified_guide.md#33-create-and-expose-data-blocks))
- [ ] You have the PLC IP address and TCP port 4840 is reachable from the Docker host
- [ ] You know the node IDs of your variables (from UaExpert — see [§3.4](s7_opcua_unified_guide.md#34-find-node-ids-with-uaexpert))
- [ ] Stack is running: `make ps` shows `opcua-service` up

---

## 3. Step 1 — Update `.env`

Open `.env` in the repo root and update the OPC-UA section:

```dotenv
# ── OPC-UA ──────────────────────────────────────────────────────────────────
# Comment out the simulator line, uncomment and fill in the real PLC:
#OPCUA_ENDPOINT=opc.tcp://opcua-simulator:4840
OPCUA_ENDPOINT=opc.tcp://192.168.0.1:4840     # ← your PLC IP

# Anonymous access (development / trusted LAN):
OPCUA_USERNAME=
OPCUA_PASSWORD=
OPCUA_SECURITY_MODE=None

# Username + password (recommended for production):
#OPCUA_USERNAME=opcua_client
#OPCUA_PASSWORD=YourStrongPassword123
#OPCUA_SECURITY_MODE=Basic256Sha256
```

> **Note:** The Docker Compose service maps this directly:
> ```yaml
> OPCUA_ENDPOINT: ${OPCUA_ENDPOINT:-opc.tcp://192.168.0.1:4840}
> OPCUA_USERNAME: ${OPCUA_USERNAME:-}
> OPCUA_PASSWORD: ${OPCUA_PASSWORD:-}
> OPCUA_SECURITY_MODE: ${OPCUA_SECURITY_MODE:-None}
> ```
> You only need to change `.env` — no Dockerfile or compose changes required.

---

## 4. Step 2 — Discover Real Node IDs

The node IDs depend entirely on how your Data Blocks are named in TIA Portal.

### Using UaExpert (recommended)

1. Download UaExpert (free): https://www.unified-automation.com/products/development-tools/uaexpert.html
2. Add Server → `opc.tcp://<PLC_IP>:4840` → Connect
3. Browse: `Root → Objects → DeviceSet → <CPU> → DataBlocksGlobal → <DB_name>`
4. Right-click a variable → **"Copy Node ID"**

Typical result:
```
ns=3;s="DataBlocksGlobal"."DB_ProcessData"."Temperature"
ns=3;s="DataBlocksGlobal"."DB_ProcessData"."Pressure"
ns=3;s="DataBlocksGlobal"."DB_ProcessData"."WorkingSpeed"
ns=3;s="DataBlocksGlobal"."DB_Alarms"."HighTemp"
ns=3;s="DataBlocksGlobal"."DB_Alarms"."LowPressure"
ns=3;s="DataBlocksGlobal"."DB_Alarms"."Running"
```

### Using the opcua-service browse API

If you can reach the PLC already (even with wrong node config), the service can browse for you:

```bash
TOKEN=$(curl -s -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Browse DataBlocksGlobal
curl "http://localhost/opcua/browse?node_id=ns%3D3%3Bs%3DDataBlocksGlobal" \
  -H "Authorization: Bearer $TOKEN"

# Browse a specific DB
curl "http://localhost/opcua/browse?node_id=ns%3D3%3Bs%3D%22DataBlocksGlobal%22.%22DB_ProcessData%22" \
  -H "Authorization: Bearer $TOKEN"
```

> **Namespace note:** On real S7-1500 your program data is **always `ns=3`**. `ns=2` (used by
> the simulator) is the Siemens type namespace — it will not exist on the PLC.

---

## 5. Step 3 — Update Node Definitions in the DB

The `node_definitions` table in `postgres-opcua` is the single source of truth for what
the poller reads. The seeded rows contain the simulator's `ns=2;i=X` IDs — these need to
be replaced with your real PLC node IDs.

### Option A: via the UI (recommended)

1. Open the s7-status-ui: `make fe-s7` → http://localhost:5179
2. Go to the **Node Config** page
3. For each row: click **Edit** → update the **OPC-UA Node ID** field → Save
4. The service hot-reloads node definitions every 15 seconds — no restart needed

### Option B: via psql / direct SQL

```bash
# Connect to postgres-opcua
docker exec -it microservices-postgres-opcua-1 \
  psql -U postgres -d opcua_db
```

```sql
-- See current nodes
SELECT id, name, node_id, type FROM node_definitions ORDER BY id;

-- Update each node to its real PLC node ID:
UPDATE node_definitions SET node_id = 'ns=3;s="DataBlocksGlobal"."DB_ProcessData"."Temperature"'
  WHERE name = 'Temperature';

UPDATE node_definitions SET node_id = 'ns=3;s="DataBlocksGlobal"."DB_ProcessData"."Pressure"'
  WHERE name = 'Pressure';

UPDATE node_definitions SET node_id = 'ns=3;s="DataBlocksGlobal"."DB_ProcessData"."FlowRate"'
  WHERE name = 'Flow Rate';

UPDATE node_definitions SET node_id = 'ns=3;s="DataBlocksGlobal"."DB_ProcessData"."WorkingSpeed"'
  WHERE name = 'Working speed';

UPDATE node_definitions SET node_id = 'ns=3;s="DataBlocksGlobal"."DB_Alarms"."HighTemp"'
  WHERE name = 'High Temperature';

UPDATE node_definitions SET node_id = 'ns=3;s="DataBlocksGlobal"."DB_Alarms"."LowPressure"'
  WHERE name = 'Low Pressure';

UPDATE node_definitions SET node_id = 'ns=3;s="DataBlocksGlobal"."DB_Alarms"."Running"'
  WHERE name = 'Running';
```

> Replace the node ID strings with the actual IDs you copied from UaExpert.
> The **name** column is only a display label — it does not need to match the PLC variable name.

### Adding new nodes

If the PLC has variables that don't exist in the table yet, add them:

```sql
INSERT INTO node_definitions (name, node_id, type, unit, description)
VALUES ('Motor Speed', 'ns=3;s="DataBlocksGlobal"."DB_Drive"."Speed"', 'process', 'rpm', 'Drive motor speed');

-- For alarm/boolean nodes:
INSERT INTO node_definitions (name, node_id, type, description)
VALUES ('Emergency Stop', 'ns=3;s="DataBlocksGlobal"."DB_Safety"."EStop"', 'alarm', 'Emergency stop active');
```

---

## 6. Step 4 — Restart the Service

The `.env` endpoint change requires a container restart (env vars are read at startup):

```bash
docker compose up --build -d opcua-service
```

> Node definition changes (DB rows) do **not** need a restart — the poller hot-reloads them
> every 15 seconds automatically.

If you were previously running the simulator and want to stop it:

```bash
docker compose stop opcua-simulator
```

---

## 7. Step 5 — Verify

### Check service logs

```bash
docker logs microservices-opcua-service-1 -f --tail 30
```

Expected on successful connection:
```
INFO  opcua-service: Connecting → opc.tcp://192.168.0.1:4840
INFO  opcua-service: Connected. Namespaces: ['', 'http://opcfoundation.org/UA/', ...]
INFO  opcua-service: Node maps reloaded: 4 process, 3 alarm nodes
```

### Health endpoint

```bash
curl http://localhost/opcua/health
# {"status":"ok","connected":true,"endpoint":"opc.tcp://192.168.0.1:4840",...}
```

### Live data endpoint

```bash
TOKEN=<your_jwt>
curl http://localhost/opcua/data -H "Authorization: Bearer $TOKEN"
# {"data":{"temperature":22.5,"pressure":1.03,...},"alarm_data":{"running":true,...}}
```

### s7-status-ui dashboard

Open http://localhost:5179 — the Status page should show:
- Connection: **Connected**
- Endpoint: your PLC IP
- Live values updating every 1.5 seconds

---

## 8. Security Upgrade (username / certificate)

### Username + password (Basic256Sha256)

After configuring a user in TIA Portal (see [s7_opcua_unified_guide.md §3.2](s7_opcua_unified_guide.md#32-configure-security)):

```dotenv
OPCUA_USERNAME=opcua_client
OPCUA_PASSWORD=YourStrongPassword123
OPCUA_SECURITY_MODE=Basic256Sha256
```

On first connection with `Basic256Sha256`, the `asyncua` library auto-generates a
self-signed client certificate. The PLC will reject it until you trust it in TIA Portal:

1. After the first (failed) connection attempt, in TIA Portal go to:
   **CPU Properties → OPC UA → Trusted clients**
2. The rejected certificate appears in the list
3. Select it → **"Add to trusted"**
4. Restart `opcua-service` — connection will now succeed

### Verifying the security mode in logs

```bash
docker logs microservices-opcua-service-1 2>&1 | grep -i "secur\|connect\|Basic"
```

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Connection refused` on port 4840 | OPC-UA server not enabled or firewall | Enable in TIA Portal, check network route |
| `Connected` but all values `None` | Wrong node IDs | Re-check IDs in UaExpert; update `node_definitions` |
| `BadNodeIdUnknown` in logs | Node ID string has typo / wrong namespace | Copy-paste directly from UaExpert, use `ns=3` |
| `BadIdentityTokenRejected` | Wrong username/password | Check TIA Portal user config |
| `BadSecurityPolicyRejected` | Security mode mismatch | Match `OPCUA_SECURITY_MODE` to TIA Portal settings |
| Certificate not trusted | First connection with `Basic256Sha256` | Trust client cert in TIA Portal → restart service |
| Values stale / not updating | Poll loop error or reconnect loop | Check logs for repeated errors; verify PLC is online |
| Namespace `ns=2` errors | Using simulator node IDs on real PLC | Update all `node_id` rows to `ns=3;s=...` |
| `BadTooManySessions` | Previous sessions not closed cleanly | Restart PLC OPC-UA server or increase max sessions in TIA Portal |

---

## 10. Quick Reference: Simulator vs Real PLC

| What | Simulator | Real S7-1500 |
|---|---|---|
| **Endpoint** | `opc.tcp://opcua-simulator:4840` | `opc.tcp://<PLC_IP>:4840` |
| **Username** | *(empty)* | optional / required (TIA Portal user) |
| **Security mode** | `None` | `None` or `Basic256Sha256` |
| **Namespace** | `ns=2` | `ns=3` |
| **Node ID format** | `ns=2;i=2` (numeric) | `ns=3;s="DataBlocksGlobal"."DB"."Var"` (symbolic) |
| **Node ID source** | hardcoded in `server.py` | UaExpert / browse API |
| **Where to change node IDs** | `node_definitions` table (same place) | `node_definitions` table |
| **Restart needed after node ID change** | No (hot-reload every 15 s) | No (hot-reload every 15 s) |
| **Restart needed after `.env` change** | Yes | Yes |
| **Stop simulator after switching?** | `docker compose stop opcua-simulator` | — |

---

## Summary: Minimal Steps Checklist

```
[ ] 1. PLC: OPC-UA server enabled, DB accessible from HMI/OPC UA
[ ] 2. Network: TCP 4840 reachable from Docker host to PLC IP
[ ] 3. .env: OPCUA_ENDPOINT updated to real PLC IP
[ ] 4. .env: credentials / security mode set (if not anonymous)
[ ] 5. node_definitions: all node_id rows updated to ns=3;s="..." IDs
[ ] 6. docker compose up --build -d opcua-service
[ ] 7. Verify: logs show "Connected", /opcua/health returns connected=true
[ ] 8. (if Basic256Sha256) Trust client cert in TIA Portal → restart service
```
