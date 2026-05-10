# OpenVPN Client — Setup & Integration Guide

**LXC:** `10.63.10.111` | **SAP B1 target:** `172.22.248.4:50000`

> **Status: FULLY WORKING** (2026-05-10)
> On-demand VPN managed by Python inside `sap-b1-adapter-service`.
> TLS 1.2 · cipher DHE-RSA-AES256-SHA · VPN IP 192.168.219.100 · SAP reachable ✓

---

## 1. Which services require VPN?

Only **one** service is gated behind a VPN check:

| Service | Why |
|---|---|
| `sap-b1-adapter-service` | Calls SAP B1 Service Layer at `172.22.248.4:50000` (internal network) |

All other services (auth, files, opcua, labeling, maps, binpack, …) are **not affected**.

---

## 2. How the VPN check works (Python side)

Every sync/query endpoint calls `get_vpn_manager().ensure_connected()` before any SAP B1 request.

**Module:** `shared/python_common/vpn_manager.py`

```
Sync endpoint called
    │
    ▼
ensure_connected()
    │
    ├─ VPN_BYPASS=true? → skip (dev/test only)
    │
    ├─ TCP probe 172.22.248.4:50000 reachable? → tunnel already up, reset idle timer
    │
    └─ probe failed
           │
           ├─ /dev/net/tun exists?
           │     yes → subprocess openvpn --config /etc/vpn/<ovpn>.conf
           │              poll every 1s until probe passes → "VPN tunnel up ✓"
           │     no  → raise VPNConnectionError (HTTP 503)
           │
           └─ after VPN_IDLE_TTL seconds of no syncs → auto-disconnect
```

**Env vars:**

| Var | Production value | Effect |
|---|---|---|
| `VPN_BYPASS` | `false` | `true` skips all checks (dev only) |
| `VPN_CONFIG` | `/etc/vpn/<ovpn>.conf` | Path to OpenVPN config inside container |
| `VPN_TARGET_HOST` | `172.22.248.4` | Host probed for connectivity |
| `VPN_TARGET_PORT` | `50000` | Port probed |
| `VPN_CONNECT_TIMEOUT` | `30` | Seconds to wait for tunnel |
| `VPN_IDLE_TTL` | `300` | Idle seconds before auto-disconnect |

---

## 3. Network architecture

```
Browser / sap-sync-ui (5173)
      │
      ▼
LXC 10.63.10.111
  ├── Docker bridge (172.19.0.x)
  │     └── sap-b1-adapter-service container
  │               │  openvpn process → tun0 (192.168.219.100)
  │               │  route: 172.22.248.0/24 via tun0
  │               ▼
  │         SAP B1 server 172.22.248.4:50000
  │
  └── tun0 created inside container (NET_ADMIN cap + /dev/net/tun device)
```

---

## 4. PVE LXC — TUN device (one-time, already done)

`/dev/net/tun` must be granted by the Proxmox host. Add to `/etc/pve/lxc/<CTID>.conf`:

```
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
```

Or via **PVE Web UI → Container → Options → Features → TUN device ✓**.

After changing the config, hard-restart the LXC (`pct stop <CTID> && pct start <CTID>`).

Verify inside the LXC:
```bash
ls -la /dev/net/tun
# crw-rw-rw- 1 root root 10, 200 ...
```

---

## 5. VPN file structure on the LXC

Files live at `/opt/microservices/vpn/` — **excluded from `deploy.sh`**, never overwritten.

```
/opt/microservices/vpn/
├── <ovpn>.conf       ← OpenVPN config (see §6 for content)
├── ca.crt            ← CA certificate
├── client.crt        ← client certificate
├── client.key        ← client private key   (chmod 600)
└── credentials.txt   ← username line 1, password line 2   (chmod 600)
```

Upload from Mac:
```bash
VPN="docs/migration/scripts"   # or wherever your source files are
for f in <ovpn>.conf ca.crt client.crt client.key credentials.txt; do
  sshpass -p <password> scp -o StrictHostKeyChecking=no \
    "files/ovpn/$f" <user>@10.63.10.111:/home/<user>/vpn-staging/$f
done

ssh <user>@10.63.10.111
echo '<password>' | sudo -S bash -c '
  mkdir -p /opt/microservices/vpn
  chmod 700 /opt/microservices/vpn
  cp /home/<user>/vpn-staging/* /opt/microservices/vpn/
  chmod 600 /opt/microservices/vpn/client.key /opt/microservices/vpn/credentials.txt
'
```

---

## 6. `<ovpn>.conf` — working configuration

```
client
dev tun
proto udp
remote 194.39.46.112 1194

resolv-retry infinite
nobind
persist-key
persist-tun

tls-client
ca /etc/vpn/ca.crt
cert /etc/vpn/client.crt
key /etc/vpn/client.key

verb 3
link-mtu 1436

cipher AES-256-CBC
data-ciphers AES-256-CBC:AES-128-CBC:AES-256-GCM
tls-version-max 1.2
tls-cipher TLS-DHE-RSA-WITH-AES-256-CBC-SHA:TLS-RSA-WITH-AES-256-CBC-SHA

auth-user-pass /etc/vpn/credentials.txt
auth-nocache

route-nopull
route 172.22.248.0 255.255.255.0
```

> `tls-version-max 1.2` is required — the BRD firewall does not support TLS 1.3.
> `route-nopull` + explicit route ensures only SAP B1 traffic goes through the tunnel.

`credentials.txt`:
```
<vpn-username>
<vpn-password>
```

---

## 7. `docker-compose.yml` — sap-b1-adapter-service

```yaml
  sap-b1-adapter-service:
    restart: unless-stopped
    build:
      context: .
      dockerfile: services/sap-b1-adapter-service/Dockerfile
    environment:
      VPN_BYPASS: ${VPN_BYPASS:-false}
      VPN_CONFIG: /etc/vpn/<ovpn>.conf
      VPN_TARGET_HOST: 172.22.248.4
      VPN_TARGET_PORT: "50000"
      VPN_CONNECT_TIMEOUT: "30"
      VPN_IDLE_TTL: "300"
      B1_BASE_URL: ${SAP_B1_SERVICE_LAYER_URL:-https://172.22.248.4:50000/b1s}
      ...
    cap_add:
      - NET_ADMIN
    devices:
      - /dev/net/tun
    volumes:
      - ./vpn:/etc/vpn:ro
```

---

## 8. `.env` on the LXC — key values

`/opt/microservices/.env` is **never overwritten by deploy** (`--exclude=/.env` in deploy.sh).

```dotenv
SAP_B1_SERVICE_LAYER_URL=https://172.22.248.4:50000/b1s
SAP_B1_COMPANY_DB=BRD_PS_20260325
SAP_B1_USERNAME=termelesig
SAP_B1_PASSWORD=<password>

VPN_BYPASS=false
VPN_CONNECT_TIMEOUT=30
VPN_IDLE_TTL=300
```

After editing `.env`:
```bash
cd /opt/microservices
sudo docker compose up -d --no-build sap-b1-adapter-service
```

---

## 9. Dev / test without VPN (Mac)

The Mac `.env` uses `VPN_BYPASS=true` and `host.docker.internal:50001` — this is intentional for local development where a VPN client runs on the Mac and Docker Desktop proxies through it. Never copy the Mac `.env` to the LXC.

---

## 10. Auto-start on LXC reboot

Both services are enabled in systemd:

```bash
systemctl is-enabled docker          # → enabled
systemctl is-enabled microservices   # → enabled
```

Boot sequence:
1. `docker.service` starts Docker daemon
2. `microservices.service` runs:
   - `docker compose -f infrastructure/mssql/docker-compose.yml up -d`
   - `sleep 15`
   - `docker compose up -d`
3. All containers have `restart: unless-stopped` — Docker restarts any that crash

---

## 11. Troubleshooting

### HTTP 503 `VPN_NOT_CONNECTED`

```json
{ "error_code": "VPN_NOT_CONNECTED", "details": { "server": "172.22.248.4", "port": 50000 } }
```

Check inside the container:
```bash
sudo docker logs microservices-sap-b1-adapter-service-1 | grep -i vpn
sudo docker exec microservices-sap-b1-adapter-service-1 ls /dev/net/tun
sudo docker exec microservices-sap-b1-adapter-service-1 ls /etc/vpn/
```

Common causes:

| Symptom | Fix |
|---|---|
| `/dev/net/tun` missing | PVE TUN feature not enabled — see §4 |
| `/etc/vpn/` empty | VPN files not uploaded — see §5 |
| `TLS key negotiation failed` | Missing `tls-version-max 1.2` in `<ovpn>.conf` — see §6 |
| `openvpn exited early` | Wrong credentials in `credentials.txt` |
| Probe passes but HTTPS times out | Route missing: `route 172.22.248.0 255.255.255.0` in `<ovpn>.conf` |

### SAP login fails (401) after VPN connects

VPN is up but B1 credentials are wrong. Check `SAP_B1_USERNAME`, `SAP_B1_PASSWORD`, `SAP_B1_COMPANY_DB` in `.env`.

### Re-upload VPN files (e.g. after cert renewal)

```bash
# From Mac — files/ovpn/ contains the source
VPN="/path/to/MicroServices/files/ovpn"
for f in <ovpn>.conf ca.crt client.crt client.key credentials.txt; do
  sshpass -p <password> scp -o StrictHostKeyChecking=no \
    "$VPN/$f" <user>@10.63.10.111:/home/<user>/vpn-staging/$f
done
ssh <user>@10.63.10.111 "echo '<password>' | sudo -S cp /home/<user>/vpn-staging/* /opt/microservices/vpn/ && echo done"
# No rebuild needed — volume is mounted read-only at runtime
```

---

## 12. VPN module — `shared/python_common/vpn_manager.py`

Full source is in the codebase. Key behaviour:
- Module-level singleton `_manager` — one tunnel shared across all concurrent requests
- `ensure_connected()` is thread-safe (`threading.Lock`)
- Idle timer reset on every call — disconnects after `VPN_IDLE_TTL` seconds of no activity
- `_start()` checks `/dev/net/tun` first and raises `VPNConnectionError` (HTTP 503) if missing rather than crashing

Called from:
- `services/sap-b1-adapter-service/app/routes/sync.py` — `_run_sync()`, `_start_sync_job()`, `_bg_run_sync()`
- `services/sap-b1-adapter-service/app/routes/queries.py` — `preview_query()`
