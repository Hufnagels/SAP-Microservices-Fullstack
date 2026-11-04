import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

_url: str = ""

VALID_PREFIXES = {"TM1", "TM2", "SZ1", "DM1"}

# Counter reset policy per prefix (lot_counters.reset_mode).
#   none    – never reset, the counter only grows
#   monthly – restart at 1 on the first generate of a new calendar month
#   yearly  – restart at 1 on the first generate of a new calendar year
RESET_MODES = {"none", "monthly", "yearly"}
DEFAULT_RESET_MODE = "monthly"   # keeps the pre-existing behaviour for old rows

# Date formats whose date part does not change within the reset period, so a
# reset would regenerate an existing lot number (and overwrite its history).
_RESET_CONFLICTS = {
    "monthly": {"none", "YYYYWW"},   # an ISO week can span two months
    "yearly":  {"none"},
    "none":    set(),
}


def reset_conflict(reset_mode: str, date_format: str) -> bool:
    return date_format in _RESET_CONFLICTS.get(reset_mode, set())


def effective_counter(counter: int, updated_at, reset_mode: str, today) -> int:
    """Next number to use, applying the prefix's reset policy (no DB write)."""
    if reset_mode == "monthly" and (updated_at.year, updated_at.month) != (today.year, today.month):
        return 1
    if reset_mode == "yearly" and updated_at.year != today.year:
        return 1
    return counter


def init(url: str):
    global _url
    _url = url
    _create_tables()


@contextmanager
def get_conn():
    conn = psycopg2.connect(_url)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _create_tables():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS lot_counters (
                    prefix      VARCHAR(10) PRIMARY KEY,
                    counter     INTEGER     NOT NULL DEFAULT 1,
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            # Migration for existing databases (idempotent)
            cur.execute(f"""
                ALTER TABLE lot_counters
                ADD COLUMN IF NOT EXISTS reset_mode VARCHAR(10) NOT NULL
                DEFAULT '{DEFAULT_RESET_MODE}'
                CHECK (reset_mode IN ('none', 'monthly', 'yearly'))
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS lot_history (
                    id           SERIAL PRIMARY KEY,
                    lot_number   VARCHAR(100) NOT NULL UNIQUE,
                    prefix       VARCHAR(10)  NOT NULL,
                    sequence     INTEGER      NOT NULL,
                    date_str     VARCHAR(20)  NOT NULL DEFAULT '',
                    separator    VARCHAR(5)   NOT NULL DEFAULT '-',
                    seq_digits   INTEGER      NOT NULL DEFAULT 4,
                    suffix       VARCHAR(50)  NOT NULL DEFAULT '',
                    date_format  VARCHAR(20)  NOT NULL DEFAULT 'YYMMDD',
                    label_size   VARCHAR(20)  NOT NULL DEFAULT '80x50',
                    zpl          TEXT,
                    generated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                    generated_by VARCHAR(100),
                    printed      BOOLEAN      NOT NULL DEFAULT FALSE,
                    printed_at   TIMESTAMPTZ
                )
            """)
            # Seed counters for all valid prefixes
            for prefix in VALID_PREFIXES:
                cur.execute("""
                    INSERT INTO lot_counters (prefix, counter)
                    VALUES (%s, 1)
                    ON CONFLICT (prefix) DO NOTHING
                """, (prefix,))


def get_counter(prefix: str) -> dict:
    """Read-only: returns the next number (reset policy applied) and the policy."""
    from datetime import date
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT counter, updated_at, reset_mode FROM lot_counters WHERE prefix = %s",
                (prefix,),
            )
            row = cur.fetchone()
            if not row:
                return {"counter": 1, "reset_mode": DEFAULT_RESET_MODE}
            counter, updated_at, reset_mode = row
            return {
                "counter": effective_counter(counter, updated_at, reset_mode, date.today()),
                "reset_mode": reset_mode,
            }


def set_counter(prefix: str, value: int):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO lot_counters (prefix, counter, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (prefix) DO UPDATE
                SET counter = EXCLUDED.counter, updated_at = NOW()
            """, (prefix, value))


def set_reset_mode(prefix: str, reset_mode: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO lot_counters (prefix, counter, reset_mode)
                VALUES (%s, 1, %s)
                ON CONFLICT (prefix) DO UPDATE SET reset_mode = EXCLUDED.reset_mode
            """, (prefix, reset_mode))


def insert_lots(lots: list[dict]) -> list[dict]:
    """Insert a batch of lot records and return them with DB-assigned ids."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            result = []
            for lot in lots:
                cur.execute("""
                    INSERT INTO lot_history
                        (lot_number, prefix, sequence, date_str, separator,
                         seq_digits, suffix, date_format, label_size, zpl, generated_by)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING *
                """, (
                    lot["lot_number"], lot["prefix"], lot["sequence"],
                    lot["date_str"],   lot["separator"], lot["seq_digits"],
                    lot["suffix"],     lot["date_format"], lot["label_size"],
                    lot.get("zpl"),    lot.get("generated_by"),
                ))
                result.append(dict(cur.fetchone()))
            return result


def fetch_history(prefix: str | None, limit: int, offset: int) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if prefix:
                cur.execute("""
                    SELECT * FROM lot_history
                    WHERE prefix = %s
                    ORDER BY generated_at DESC
                    LIMIT %s OFFSET %s
                """, (prefix, limit, offset))
            else:
                cur.execute("""
                    SELECT * FROM lot_history
                    ORDER BY generated_at DESC
                    LIMIT %s OFFSET %s
                """, (limit, offset))
            return [dict(r) for r in cur.fetchall()]


def mark_printed(lot_id: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                UPDATE lot_history
                SET printed = TRUE, printed_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (lot_id,))
            row = cur.fetchone()
            return dict(row) if row else None
