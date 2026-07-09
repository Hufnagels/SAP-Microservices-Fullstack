# Printing Service

> `labeling-service` — CAB SQUIX / Zebra label printer via raw TCP/ZPL II.
> Route: `POST http://localhost/labeling/print`
> Source: `services/labeling-service/`

---

## Architecture

```
LOTGEN frontend  (generates ZPL in browser)
    │
    │  POST /labeling/print  { "zpl": "^XA...^XZ" }
    ▼
Traefik :80  →  strips /labeling  →  labeling-service:8000
                                           │
                                           │  raw TCP socket :9100
                                           ▼
                                    CAB SQUIX Printer
                                    IP: 10.63.94.107  (PRINTER_IP env)
```

The printer has **no HTTP API**. The service opens a raw TCP socket on port 9100
and sends the ZPL string as plain bytes. No queue, no acknowledgement, no job tracking.

```python
def _send_zpl(zpl: str) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(5)
        s.connect((PRINTER_IP, PRINTER_PORT))
        s.sendall(zpl.encode("utf-8"))
```

---

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/labeling/health` | public | Service OK + printer reachability |
| `GET` | `/labeling/status` | public | Raw printer TCP ping |
| `GET` | `/labeling/printers` | public | List configured printers |
| `POST` | `/labeling/print` | public | Send raw ZPL to printer |
| `POST` | `/labeling/labels` | public | Build ZPL from named template + print |
| `GET` | `/labeling/templates` | public | List available named templates |
| `GET` | `/labeling/label-templates` | public | List canvas design templates (from DB) |
| `POST` | `/labeling/label-templates` | public | Save a canvas design template |
| `DELETE` | `/labeling/label-templates/{id}` | public | Delete a canvas design template |

---

## Two printing modes

### Mode 1 — Raw ZPL  (`POST /labeling/print`)

The caller generates ZPL and passes it directly. **This is what LOTGEN uses.**

```bash
curl -X POST http://localhost/labeling/print \
  -H "Content-Type: application/json" \
  -d '{"zpl": "^XA^LL296^PW826^FO50,30^A0N,28,28^FDTM1-260517-0001^FS^PQ1^XZ"}'
```

Response:
```json
{ "success": true }
```

### Mode 2 — Named template  (`POST /labeling/labels`)

The caller picks a template name and passes field values. The service builds the ZPL internally.

```bash
curl -X POST http://localhost/labeling/labels \
  -H "Content-Type: application/json" \
  -d '{
    "template": "roll-label",
    "copies": 2,
    "fields": [
      {"key": "ItemCode",  "value": "WIRE-6MM"},
      {"key": "ItemName",  "value": "Rézhuzal 6mm"},
      {"key": "Diameter",  "value": "6"}
    ]
  }'
```

Response:
```json
{
  "job_id":   "a3f2...",
  "template": "roll-label",
  "copies":   2,
  "printer":  "10.63.94.107:9100",
  "status":   "printed"
}
```

---

## Built-in ZPL templates

| Template | Required fields | Label content |
|---|---|---|
| `roll-label` | `ItemCode`, `ItemName`, `Diameter` | Item code (large) + name + diameter + Code128 barcode |
| `package-label` | `ItemCode`, `Qty`, `Weight` | "Package" heading + code + qty / weight + barcode |
| `pallet-label` | `PalletID`, `ItemCode`, `TotalQty` | "Pallet" heading + code + total qty + wide barcode |
| _(generic fallback)_ | any keys | Each field printed as a text line, top to bottom |

---

## ZPL II — Language basics

ZPL (Zebra Programming Language) is a plain-text command language sent over TCP.
Commands start with `^` (caret). A complete label is wrapped in `^XA … ^XZ`.

```
^XA                      ← start label
^LL296^PW826             ← Label Length 296 dots, Print Width 826 dots
                            (at 300 dpi: ≈ 25 mm tall × 70 mm wide)
^FO50,30                 ← Field Origin: x=50, y=30 dots from top-left
^A0N,28,28               ← Font A, Normal orientation, 28×28 dots
^FDTM1-260517-0001^FS    ← Field Data … Field Separator
^FO50,70
^BY2                     ← Barcode module width multiplier
^BCN,80,Y,N,N            ← Code128 barcode, 80 dots tall, print human-readable text
^FDTM1-260517-0001^FS
^PQ1                     ← Print Quantity: 1 copy
^XZ                      ← end label
```

**Dot / mm conversion** (300 dpi printer):
`dots = mm × 300 / 25.4`  →  1 mm ≈ 11.8 dots

---

## Printer reachability

`/health` and `/status` both open a 3-second TCP probe to `PRINTER_IP:9100`.
The service starts regardless of printer state — offline printer returns `503`/`504` on print calls.

```json
// GET /labeling/health
{
  "status": "ok",
  "printer": { "ip": "10.63.94.107", "port": 9100, "online": false }
}
```

**Error mapping:**

| Exception | HTTP status | Meaning |
|---|---|---|
| `socket.timeout` | 504 | Printer reachable but not responding |
| `ConnectionRefusedError` | 503 | Port 9100 closed / printer off |
| `OSError` | 503 | Network unreachable (wrong IP, VPN down) |
| Any other | 500 | Unexpected error |

---

## Label design templates (DB-stored)

A secondary feature lets the `live-labeling-ui` canvas designer save visual label
designs to `postgres-labeling` (`labeling_db`). These are **blueprints only** —
they are not used for printing directly. Actual print jobs always go through
`/print` or `/labels`.

```sql
CREATE TABLE label_design_templates (
  id            UUID        PRIMARY KEY,
  name          VARCHAR     UNIQUE NOT NULL,
  description   TEXT,
  size_w_mm     FLOAT       NOT NULL,
  size_h_mm     FLOAT       NOT NULL,
  elements_json TEXT        NOT NULL,   -- JSON array of canvas elements
  preview       BYTEA,                  -- PNG thumbnail (binary)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The PNG preview is stored as raw bytes in `BYTEA` and returned as a base64
data URL (`data:image/png;base64,...`) so the canvas UI can render thumbnails
without a separate file endpoint.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PRINTER_IP` | `10.63.94.107` | CAB SQUIX printer IP on the factory LAN |
| `PRINTER_PORT` | `9100` | Raw TCP print port (standard for ZPL printers) |
| `POSTGRES_URL` | — | Connection string for `labeling_db` (design templates) |

Set in `docker-compose.yml` from `.env`:
```yaml
environment:
  PRINTER_IP:   ${PRINTER_IP:-192.168.1.100}
  PRINTER_PORT: ${PRINTER_PORT:-9100}
  POSTGRES_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres-labeling:5432/labeling_db
```

---

## How LOTGEN uses this service

LOTGEN generates ZPL **client-side** in the browser (`frontend/src/lib/zpl.ts`)
and POSTs the raw string to the labeling-service. The `lotgen-service` backend
is not involved — it only stores the `zpl` field in `lot_history` for auditing.

```
LOTGEN browser
  → generateZPL(lotNumber, labelSize)   [client-side, lib/zpl.ts]
  → POST /labeling/print { zpl: "^XA...^XZ" }
  → labeling-service → TCP → CAB SQUIX → label printed
  → POST /lot/{id}/printed              [mark as printed in lot_history]
```

---

## Quick checks

```bash
# Is the printer reachable?
curl http://localhost/labeling/health

# Is the service running?
docker logs microservices-labeling-service-1 --tail 20

# Manual print test (replace IP if needed)
curl -X POST http://localhost/labeling/print \
  -H "Content-Type: application/json" \
  -d '{"zpl":"^XA^FO50,50^A0N,50,50^FDTest Print^FS^PQ1^XZ"}'

# Change printer IP without rebuild
# Edit PRINTER_IP in .env, then:
docker compose up -d labeling-service
```
