"""Port of frontend/src/lib/lot.ts — must stay in sync."""
from datetime import date as Date


def _iso_week(d: Date) -> str:
    return str(d.isocalendar()[1]).zfill(2)


def get_date_string(fmt: str, d: Date | None = None) -> str:
    if d is None:
        d = Date.today()
    Y  = str(d.year)
    YY = Y[2:]
    MM = str(d.month).zfill(2)
    DD = str(d.day).zfill(2)

    if fmt == "YYYYMMDD": return f"{Y}{MM}{DD}"
    if fmt == "YYMMDD":   return f"{YY}{MM}{DD}"
    if fmt == "YYMM":     return f"{YY}{MM}"
    if fmt == "YYYYWW":   return f"{Y}{_iso_week(d)}"
    return ""  # "none"


def format_lot_number(
    seq: int, prefix: str, date_format: str,
    separator: str, seq_digits: int, suffix: str,
    d: Date | None = None,
) -> str:
    date_str = get_date_string(date_format, d)
    seq_str  = str(seq).zfill(seq_digits)
    parts    = [p for p in [prefix, date_str, seq_str, suffix] if p]
    return separator.join(parts)
