import uuid
import socket
import os
import base64
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from .models import LabelRequest, LabelResponse, PrinterInfo, LabelField, RawPrintRequest, LabelDesignTemplateCreate, LabelDesignTemplateOut
from .database import init_db, get_db, LabelDesignTemplate

load_dotenv()

PRINTER_IP   = os.getenv("PRINTER_IP", "10.63.94.107")
PRINTER_PORT = int(os.getenv("PRINTER_PORT", 9100))

app = FastAPI(
    title="Labeling Service",
    description="Live label printing — CAB SQUIX printer via TCP/ZPL.",
    version="0.3.0",
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# ── Printer helpers ────────────────────────────────────────────────────────────

def _check_printer() -> bool:
    """Return True if the printer TCP port is reachable."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3)
            s.connect((PRINTER_IP, PRINTER_PORT))
        return True
    except Exception:
        return False


def _send_zpl(zpl: str) -> None:
    """Send a ZPL string to the printer over raw TCP port 9100."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(5)
        s.connect((PRINTER_IP, PRINTER_PORT))
        s.sendall(zpl.encode("utf-8"))


# ── ZPL template builder ───────────────────────────────────────────────────────

def _build_zpl(template: str, fields: list[LabelField], copies: int) -> str:
    """Generate ZPL from a named template and a list of key/value fields."""
    fm = {f.key: f.value for f in fields}

    if template == "roll-label":
        item_code = fm.get("ItemCode", "")
        item_name = fm.get("ItemName", "")
        diameter  = fm.get("Diameter", "")
        return (
            f"^XA^LL400^PW600\n"
            f"^FO30,30^A0N,40,40^FD{item_code}^FS\n"
            f"^FO30,80^A0N,25,25^FD{item_name}^FS\n"
            f"^FO30,120^A0N,20,20^FDDia: {diameter} mm^FS\n"
            f"^FO30,160^BY2^BCN,80,Y,N,N^FD{item_code}^FS\n"
            f"^PQ{copies}^XZ"
        )

    if template == "package-label":
        item_code = fm.get("ItemCode", "")
        qty       = fm.get("Qty", "")
        weight    = fm.get("Weight", "")
        return (
            f"^XA^LL500^PW600\n"
            f"^FO30,30^A0N,45,45^FDPackage^FS\n"
            f"^FO30,90^A0N,30,30^FD{item_code}^FS\n"
            f"^FO30,135^A0N,25,25^FDQty: {qty}  Weight: {weight} kg^FS\n"
            f"^FO30,175^BY2^BCN,80,Y,N,N^FD{item_code}^FS\n"
            f"^PQ{copies}^XZ"
        )

    if template == "pallet-label":
        pallet_id = fm.get("PalletID", "")
        item_code = fm.get("ItemCode", "")
        total_qty = fm.get("TotalQty", "")
        return (
            f"^XA^LL600^PW800\n"
            f"^FO30,30^A0N,55,55^FDPallet^FS\n"
            f"^FO30,100^A0N,35,35^FD{item_code}^FS\n"
            f"^FO30,150^A0N,30,30^FDTotal: {total_qty} pcs^FS\n"
            f"^FO30,200^BY3^BCN,100,Y,N,N^FD{pallet_id}^FS\n"
            f"^PQ{copies}^XZ"
        )

    # Generic fallback: print all fields as lines of text
    lines = []
    y = 30
    for f in fields:
        lines.append(f"^FO30,{y}^A0N,30,30^FD{f.key}: {f.value}^FS")
        y += 40
    body = "\n".join(lines)
    return f"^XA^LL{y + 50}^PW600\n{body}\n^PQ{copies}^XZ"


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    online = _check_printer()
    return {
        "status": "ok",
        "printer": {"ip": PRINTER_IP, "port": PRINTER_PORT, "online": online},
    }


@app.get("/printers", response_model=list[PrinterInfo])
async def list_printers():
    """Return printer status (single CAB SQUIX instance configured via env)."""
    online = _check_printer()
    return [
        PrinterInfo(
            name=f"cab-squix ({PRINTER_IP}:{PRINTER_PORT})",
            is_default=True,
            status="ready" if online else "offline",
        )
    ]


@app.get("/status")
async def printer_status():
    """Raw reachability check — mirrors original cab-label-printer API."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3)
            s.connect((PRINTER_IP, PRINTER_PORT))
        return {"online": True, "ip": PRINTER_IP, "port": PRINTER_PORT}
    except Exception as e:
        return {"online": False, "ip": PRINTER_IP, "port": PRINTER_PORT, "error": str(e)}


def _raise_printer_error(e: Exception) -> None:
    """Map socket/OS errors to appropriate HTTP exceptions."""
    if isinstance(e, socket.timeout):
        raise HTTPException(status_code=504, detail=f"Printer {PRINTER_IP}:{PRINTER_PORT} timed out")
    if isinstance(e, (ConnectionRefusedError, ConnectionResetError)):
        raise HTTPException(status_code=503, detail=f"Printer {PRINTER_IP}:{PRINTER_PORT} refused connection")
    if isinstance(e, OSError):
        raise HTTPException(status_code=503, detail=f"Printer {PRINTER_IP}:{PRINTER_PORT} unreachable — {e}")
    raise HTTPException(status_code=500, detail=str(e))


@app.post("/print")
async def print_raw(req: RawPrintRequest):
    """Send a raw ZPL string directly to the printer (low-level endpoint)."""
    try:
        _send_zpl(req.zpl)
        return {"success": True}
    except Exception as e:
        _raise_printer_error(e)


@app.post("/labels", response_model=LabelResponse)
async def print_label(req: LabelRequest):
    """Build ZPL from a named template + fields and send it to the printer."""
    zpl = _build_zpl(req.template, req.fields, req.copies)
    try:
        _send_zpl(zpl)
    except Exception as e:
        _raise_printer_error(e)

    return LabelResponse(
        job_id=str(uuid.uuid4()),
        template=req.template,
        copies=req.copies,
        printer=f"{PRINTER_IP}:{PRINTER_PORT}",
        status="printed",
    )


@app.get("/templates")
async def list_templates():
    return [
        {"name": "roll-label",    "description": "Single roll — item code + barcode",          "fields": ["ItemCode", "ItemName", "Diameter"]},
        {"name": "package-label", "description": "Shrink-wrap package label",                  "fields": ["ItemCode", "Qty", "Weight"]},
        {"name": "pallet-label",  "description": "Full pallet label with barcode",             "fields": ["PalletID", "ItemCode", "TotalQty"]},
    ]


# ── Label design templates (designer canvas) ────────────────────────────────

def _row_to_out(row: LabelDesignTemplate) -> LabelDesignTemplateOut:
    """Convert ORM row → Pydantic out, decoding preview bytes → base64 data URL."""
    preview_b64 = None
    if row.preview:
        preview_b64 = "data:image/png;base64," + base64.b64encode(row.preview).decode()
    return LabelDesignTemplateOut(
        id=row.id,
        name=row.name,
        description=row.description,
        size_w_mm=row.size_w_mm,
        size_h_mm=row.size_h_mm,
        elements_json=row.elements_json,
        preview_b64=preview_b64,
        created_at=row.created_at,
    )


@app.get("/label-templates", response_model=list[LabelDesignTemplateOut])
def get_label_templates(db: Session = Depends(get_db)):
    rows = db.query(LabelDesignTemplate).order_by(LabelDesignTemplate.created_at.desc()).all()
    return [_row_to_out(r) for r in rows]


@app.post("/label-templates", response_model=LabelDesignTemplateOut, status_code=201)
def create_label_template(body: LabelDesignTemplateCreate, db: Session = Depends(get_db)):
    existing = db.query(LabelDesignTemplate).filter(LabelDesignTemplate.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Template '{body.name}' already exists.")

    # Decode base64 data URL preview → raw bytes for bytea storage
    preview_bytes: bytes | None = None
    if body.preview_b64:
        try:
            header, b64data = body.preview_b64.split(",", 1)
            preview_bytes = base64.b64decode(b64data)
        except Exception:
            preview_bytes = None

    record = LabelDesignTemplate(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        size_w_mm=body.size_w_mm,
        size_h_mm=body.size_h_mm,
        elements_json=body.elements_json,
        preview=preview_bytes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _row_to_out(record)


@app.delete("/label-templates/{template_id}", status_code=204)
def delete_label_template(template_id: str, db: Session = Depends(get_db)):
    record = db.query(LabelDesignTemplate).filter(LabelDesignTemplate.id == template_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Template not found.")
    db.delete(record)
    db.commit()
