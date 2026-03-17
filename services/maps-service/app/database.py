"""
database.py — PostgreSQL connection + table init for maps-service.
Tables:
  map_shapes   — user-drawn shapes
  map_custom   — preset locations
"""
import json
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from .settings import settings

# ── Connection pool (simple) ──────────────────────────────────────────────────

@contextmanager
def get_conn():
    conn = psycopg2.connect(settings.postgres_url)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Migrations ────────────────────────────────────────────────────────────────

def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS map_shapes (
                    id          SERIAL PRIMARY KEY,
                    name        VARCHAR(255) NOT NULL DEFAULT '',
                    type        VARCHAR(50)  NOT NULL,
                    description TEXT,
                    lat         DOUBLE PRECISION,
                    lng         DOUBLE PRECISION,
                    radius      DOUBLE PRECISION,
                    bounds_ne   JSONB,
                    bounds_sw   JSONB,
                    latlngs     JSONB,
                    created_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS map_custom (
                    id          SERIAL PRIMARY KEY,
                    name        VARCHAR(255) NOT NULL,
                    lat         DOUBLE PRECISION NOT NULL,
                    lng         DOUBLE PRECISION NOT NULL,
                    type        VARCHAR(50)  NOT NULL DEFAULT 'marker',
                    description TEXT NOT NULL DEFAULT '',
                    bounds_ne   JSONB,
                    bounds_sw   JSONB,
                    created_at  TIMESTAMPTZ DEFAULT NOW()
                )
            """)


# ── Formatters ────────────────────────────────────────────────────────────────

def _fmt_shape(row: dict) -> dict:
    return {
        "id":          row["id"],
        "name":        row["name"] or "",
        "type":        row["type"],
        "description": row.get("description") or "",
        "lat":         row.get("lat"),
        "lng":         row.get("lng"),
        "radius":      row.get("radius"),
        "boundsNE":    row["bounds_ne"] if row.get("bounds_ne") else None,
        "boundsSW":    row["bounds_sw"] if row.get("bounds_sw") else None,
        "latlngs":     row["latlngs"] if row.get("latlngs") else None,
    }


def _fmt_custom(row: dict) -> dict:
    return {
        "id":          row["id"],
        "name":        row["name"],
        "lat":         row["lat"],
        "lng":         row["lng"],
        "type":        row["type"],
        "description": row["description"] or "",
        "boundsNE":    row["bounds_ne"] if row.get("bounds_ne") else None,
        "boundsSW":    row["bounds_sw"] if row.get("bounds_sw") else None,
    }


# ── Shapes CRUD ───────────────────────────────────────────────────────────────

def get_shapes() -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM map_shapes ORDER BY id")
            return [_fmt_shape(r) for r in cur.fetchall()]


def insert_shapes(shapes: list[dict]) -> list[dict]:
    result = []
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for s in shapes:
                cur.execute("""
                    INSERT INTO map_shapes
                        (name, type, description, lat, lng, radius, bounds_ne, bounds_sw, latlngs)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING *
                """, (
                    s.get("name", ""),
                    s["type"],
                    s.get("description"),
                    s.get("lat"),
                    s.get("lng"),
                    s.get("radius"),
                    json.dumps(s["boundsNE"]) if s.get("boundsNE") else None,
                    json.dumps(s["boundsSW"]) if s.get("boundsSW") else None,
                    json.dumps(s["latlngs"])  if s.get("latlngs")  else None,
                ))
                result.append(_fmt_shape(cur.fetchone()))
    return result


def update_shape(shape_id: int, data: dict) -> dict | None:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                UPDATE map_shapes
                SET name=%s, type=%s, description=%s, lat=%s, lng=%s, radius=%s,
                    bounds_ne=%s, bounds_sw=%s, latlngs=%s
                WHERE id=%s
                RETURNING *
            """, (
                data.get("name", ""),
                data["type"],
                data.get("description"),
                data.get("lat"),
                data.get("lng"),
                data.get("radius"),
                json.dumps(data["boundsNE"]) if data.get("boundsNE") else None,
                json.dumps(data["boundsSW"]) if data.get("boundsSW") else None,
                json.dumps(data["latlngs"])  if data.get("latlngs")  else None,
                shape_id,
            ))
            row = cur.fetchone()
            return _fmt_shape(row) if row else None


def delete_shape(shape_id: int) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM map_shapes WHERE id=%s", (shape_id,))
            return cur.rowcount > 0


# ── Custom items CRUD ─────────────────────────────────────────────────────────

def get_custom() -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM map_custom ORDER BY id")
            return [_fmt_custom(r) for r in cur.fetchall()]


def insert_custom(data: dict) -> dict:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO map_custom (name, lat, lng, type, description, bounds_ne, bounds_sw)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
            """, (
                data["name"],
                data["lat"],
                data["lng"],
                data.get("type", "marker"),
                data.get("description", ""),
                json.dumps(data["boundsNE"]) if data.get("boundsNE") else None,
                json.dumps(data["boundsSW"]) if data.get("boundsSW") else None,
            ))
            return _fmt_custom(cur.fetchone())


def update_custom(item_id: int, data: dict) -> dict | None:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                UPDATE map_custom
                SET name=%s, lat=%s, lng=%s, type=%s, description=%s,
                    bounds_ne=%s, bounds_sw=%s
                WHERE id=%s
                RETURNING *
            """, (
                data["name"],
                data["lat"],
                data["lng"],
                data.get("type", "marker"),
                data.get("description", ""),
                json.dumps(data["boundsNE"]) if data.get("boundsNE") else None,
                json.dumps(data["boundsSW"]) if data.get("boundsSW") else None,
                item_id,
            ))
            row = cur.fetchone()
            return _fmt_custom(row) if row else None


def delete_custom(item_id: int) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM map_custom WHERE id=%s", (item_id,))
            return cur.rowcount > 0
