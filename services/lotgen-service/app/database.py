import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

_url: str = ""

VALID_PREFIXES = {"TM1", "TM2", "SZ1", "DM1"}


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


def get_counter(prefix: str) -> int:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT counter FROM lot_counters WHERE prefix = %s", (prefix,))
            row = cur.fetchone()
            return row[0] if row else 1


def set_counter(prefix: str, value: int):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO lot_counters (prefix, counter, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (prefix) DO UPDATE
                SET counter = EXCLUDED.counter, updated_at = NOW()
            """, (prefix, value))


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
