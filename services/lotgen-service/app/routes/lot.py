from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
import psycopg2

from app import database as db
from app.lot_format import format_lot_number, get_date_string
from app.security import get_current_user, require_admin

router = APIRouter(prefix="/lot", tags=["lot"])

VALID_PREFIXES  = db.VALID_PREFIXES
VALID_FORMATS   = {"YYYYMMDD", "YYMMDD", "YYMM", "YYYYWW", "none"}
VALID_SIZES     = {"70x37", "80x50", "102x51", "102x76", "102x152"}


# ── Request / Response models ─────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prefix:      str = Field(..., pattern="^(TM1|TM2|SZ1|DM1)$")
    date_format: str = Field("YYMMDD")
    separator:   str = Field("-")
    seq_digits:  int = Field(4, ge=3, le=6)
    suffix:      str = Field("")
    quantity:    int = Field(1, ge=1, le=100)
    label_size:  str = Field("80x50")
    zpl_list:    list[str] = Field(default_factory=list)


class CounterSetRequest(BaseModel):
    value: int = Field(..., ge=1, le=99999)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "service": "lotgen-backend"}


@router.get("/counter/{prefix}")
def get_counter(prefix: str, _: dict = Depends(get_current_user)):
    if prefix not in VALID_PREFIXES:
        raise HTTPException(400, f"Invalid prefix. Valid: {sorted(VALID_PREFIXES)}")
    return {"prefix": prefix, "counter": db.get_counter(prefix)}


@router.put("/counter/{prefix}")
def set_counter(prefix: str, req: CounterSetRequest, _: dict = Depends(get_current_user)):
    if prefix not in VALID_PREFIXES:
        raise HTTPException(400, f"Invalid prefix. Valid: {sorted(VALID_PREFIXES)}")
    db.set_counter(prefix, req.value)
    return {"prefix": prefix, "counter": req.value}


@router.post("/generate")
def generate(req: GenerateRequest, user: dict = Depends(get_current_user)):
    if req.date_format not in VALID_FORMATS:
        raise HTTPException(400, f"Invalid date_format")
    if req.label_size not in VALID_SIZES:
        raise HTTPException(400, f"Invalid label_size")
    if len(req.zpl_list) not in (0, req.quantity):
        raise HTTPException(400, "zpl_list length must be 0 or equal to quantity")

    today = date.today()
    date_str = get_date_string(req.date_format, today)

    from psycopg2.extras import RealDictCursor

    with db.get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT counter FROM lot_counters WHERE prefix = %s FOR UPDATE",
                (req.prefix,),
            )
            row = cur.fetchone()
            start = row[0] if row else 1

        records = []
        for i in range(req.quantity):
            seq = start + i
            records.append({
                "lot_number":   format_lot_number(
                                    seq, req.prefix, req.date_format,
                                    req.separator, req.seq_digits, req.suffix, today),
                "prefix":       req.prefix,
                "sequence":     seq,
                "date_str":     date_str,
                "separator":    req.separator,
                "seq_digits":   req.seq_digits,
                "suffix":       req.suffix,
                "date_format":  req.date_format,
                "label_size":   req.label_size,
                "zpl":          req.zpl_list[i] if req.zpl_list else None,
                "generated_by": user.get("sub"),
            })

        next_counter = start + req.quantity
        inserted = []
        with conn.cursor(cursor_factory=RealDictCursor) as cur2:
            cur2.execute(
                "UPDATE lot_counters SET counter = %s, updated_at = NOW() WHERE prefix = %s",
                (next_counter, req.prefix),
            )
            for r in records:
                # ON CONFLICT: if this lot_number already exists (e.g. after a counter reset),
                # update the record so the user gets fresh history for the new run.
                cur2.execute("""
                    INSERT INTO lot_history
                        (lot_number, prefix, sequence, date_str, separator,
                         seq_digits, suffix, date_format, label_size, zpl, generated_by)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (lot_number) DO UPDATE SET
                        generated_at = NOW(),
                        generated_by = EXCLUDED.generated_by,
                        label_size   = EXCLUDED.label_size,
                        printed      = FALSE,
                        printed_at   = NULL
                    RETURNING *
                """, (
                    r["lot_number"], r["prefix"], r["sequence"],
                    r["date_str"],   r["separator"], r["seq_digits"],
                    r["suffix"],     r["date_format"], r["label_size"],
                    r.get("zpl"),    r.get("generated_by"),
                ))
                inserted.append(dict(cur2.fetchone()))

    return {"items": inserted, "next_counter": next_counter}


@router.get("/history")
def history(
    prefix: Optional[str] = Query(None),
    limit:  int = Query(100, ge=1, le=500),
    offset: int = Query(0,   ge=0),
    _: dict = Depends(get_current_user),
):
    if prefix and prefix not in VALID_PREFIXES:
        raise HTTPException(400, f"Invalid prefix")
    return db.fetch_history(prefix, limit, offset)


@router.put("/{lot_id}/printed")
def mark_printed(lot_id: int, _: dict = Depends(get_current_user)):
    row = db.mark_printed(lot_id)
    if not row:
        raise HTTPException(404, "LOT not found")
    return row
