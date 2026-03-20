"""
OPC-UA Service — PostgreSQL node definitions registry.
Table: node_definitions — stores OPC-UA node IDs with display metadata.
"""
import logging
from contextlib import contextmanager
from typing import Optional

import psycopg2
import psycopg2.extras

log = logging.getLogger(__name__)

_pg_url: str = ""


def configure(postgres_url: str):
    global _pg_url
    _pg_url = postgres_url
    _init_schema()


@contextmanager
def get_conn():
    conn = psycopg2.connect(_pg_url)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _init_schema():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS node_definitions (
                    id           SERIAL PRIMARY KEY,
                    name         VARCHAR(100) NOT NULL,
                    node_id      VARCHAR(300) NOT NULL,
                    type         VARCHAR(20)  NOT NULL DEFAULT 'process',
                    unit         VARCHAR(30),
                    description  TEXT,
                    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
                    sim_behavior VARCHAR(20)  NOT NULL DEFAULT 'sine',
                    sim_min      FLOAT        NOT NULL DEFAULT 0,
                    sim_max      FLOAT        NOT NULL DEFAULT 100,
                    sim_period   FLOAT        NOT NULL DEFAULT 30,
                    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
                )
            """)
            # Add sim columns if upgrading from older schema
            for col, typedef in [
                ("sim_behavior", "VARCHAR(20) NOT NULL DEFAULT 'sine'"),
                ("sim_min",      "FLOAT NOT NULL DEFAULT 0"),
                ("sim_max",      "FLOAT NOT NULL DEFAULT 100"),
                ("sim_period",   "FLOAT NOT NULL DEFAULT 30"),
            ]:
                cur.execute(f"""
                    ALTER TABLE node_definitions ADD COLUMN IF NOT EXISTS {col} {typedef}
                """)
            cur.execute("SELECT COUNT(*) FROM node_definitions")
            if cur.fetchone()[0] == 0:
                seeds = [
                    # name, node_id (simulator numeric IDs), type, unit, description
                    # Real S7-1500: use ns=3;s="DataBlocksGlobal"."DB_ProcessData"."Variable"
                    ("Temperature",      "ns=2;i=2", "process", "°C",   "Reactor temperature"),
                    ("Pressure",         "ns=2;i=3", "process", "bar",  "Line pressure"),
                    ("Flow Rate",        "ns=2;i=4", "process", "m³/h", "Process flow rate"),
                    ("Setpoint",         "ns=2;i=5", "process", "°C",   "Temperature setpoint"),
                    ("High Temperature", "ns=2;i=7", "alarm",   None,   "High temperature alarm"),
                    ("Low Pressure",     "ns=2;i=8", "alarm",   None,   "Low pressure alarm"),
                    ("Running",          "ns=2;i=9", "alarm",   None,   "Machine running state"),
                ]
                cur.executemany(
                    """INSERT INTO node_definitions (name, node_id, type, unit, description)
                       VALUES (%s, %s, %s, %s, %s)""",
                    seeds,
                )
    log.info("node_definitions table ready")
    with get_conn() as conn:
        _init_sensor_units(conn)
    log.info("sensor_units table ready")


def list_nodes(type_filter: Optional[str] = None) -> list:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if type_filter:
                cur.execute("SELECT * FROM node_definitions WHERE type = %s ORDER BY id", (type_filter,))
            else:
                cur.execute("SELECT * FROM node_definitions ORDER BY id")
            return [dict(r) for r in cur.fetchall()]


def get_node(id_: int) -> Optional[dict]:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM node_definitions WHERE id = %s", (id_,))
            row = cur.fetchone()
            return dict(row) if row else None


def create_node(name: str, node_id: str, type_: str, unit: Optional[str],
                description: Optional[str], is_active: bool = True,
                sim_behavior: str = "sine", sim_min: float = 0.0,
                sim_max: float = 100.0, sim_period: float = 30.0) -> dict:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """INSERT INTO node_definitions
                   (name, node_id, type, unit, description, is_active,
                    sim_behavior, sim_min, sim_max, sim_period)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *""",
                (name, node_id, type_, unit, description, is_active,
                 sim_behavior, sim_min, sim_max, sim_period),
            )
            return dict(cur.fetchone())


def update_node(id_: int, **fields) -> Optional[dict]:
    allowed = {"name", "node_id", "type", "unit", "description", "is_active",
               "sim_behavior", "sim_min", "sim_max", "sim_period"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return None
    cols = ", ".join(f"{k} = %s" for k in updates)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"UPDATE node_definitions SET {cols} WHERE id = %s RETURNING *",
                list(updates.values()) + [id_],
            )
            row = cur.fetchone()
            return dict(row) if row else None


def delete_node(id_: int) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM node_definitions WHERE id = %s", (id_,))
            return cur.rowcount > 0


# ── Sensor units ──────────────────────────────────────────────────────────────

_UNIT_SEEDS = [
    # category, unit, description, min_val, max_val
    ("Temperature",  "°C",   "Celsius"),
    ("Temperature",  "°F",   "Fahrenheit"),
    ("Temperature",  "K",    "Kelvin"),
    ("Pressure",     "bar",  "Bar"),
    ("Pressure",     "mbar", "Millibar"),
    ("Pressure",     "Pa",   "Pascal"),
    ("Pressure",     "kPa",  "Kilopascal"),
    ("Pressure",     "MPa",  "Megapascal"),
    ("Pressure",     "psi",  "Pounds per square inch"),
    ("Pressure",     "atm",  "Atmosphere"),
    ("Flow",         "m³/h", "Cubic metres per hour"),
    ("Flow",         "L/min","Litres per minute"),
    ("Flow",         "L/h",  "Litres per hour"),
    ("Flow",         "m³/s", "Cubic metres per second"),
    ("Flow",         "kg/h", "Kilograms per hour"),
    ("Flow",         "t/h",  "Tonnes per hour"),
    ("Level",        "m",    "Metre"),
    ("Level",        "cm",   "Centimetre"),
    ("Level",        "mm",   "Millimetre"),
    ("Level",        "%",    "Percent"),
    ("Speed",        "rpm",  "Revolutions per minute"),
    ("Speed",        "m/s",  "Metres per second"),
    ("Speed",        "m/min","Metres per minute"),
    ("Electrical",   "V",    "Volt"),
    ("Electrical",   "mV",   "Millivolt"),
    ("Electrical",   "kV",   "Kilovolt"),
    ("Electrical",   "A",    "Ampere"),
    ("Electrical",   "mA",   "Milliampere"),
    ("Electrical",   "Hz",   "Hertz"),
    ("Power",        "W",    "Watt"),
    ("Power",        "kW",   "Kilowatt"),
    ("Power",        "MW",   "Megawatt"),
    ("Power",        "kWh",  "Kilowatt-hour"),
    ("Power",        "MWh",  "Megawatt-hour"),
    ("Weight",       "kg",   "Kilogram"),
    ("Weight",       "t",    "Metric tonne"),
    ("Weight",       "N",    "Newton"),
    ("Weight",       "kN",   "Kilonewton"),
    ("Time",         "s",    "Second"),
    ("Time",         "min",  "Minute"),
    ("Time",         "h",    "Hour"),
    ("Concentration","ppm",  "Parts per million"),
    ("Concentration","pH",   "pH value"),
    ("Concentration","mg/L", "Milligrams per litre"),
    ("Concentration","g/L",  "Grams per litre"),
    ("Other",        "—",    "Dimensionless / no unit"),
]


def _init_sensor_units(conn):
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sensor_units (
                id          SERIAL PRIMARY KEY,
                category    VARCHAR(50)  NOT NULL,
                unit        VARCHAR(30)  NOT NULL UNIQUE,
                description VARCHAR(100),
                min_val     FLOAT,
                max_val     FLOAT
            )
        """)
        cur.execute("ALTER TABLE sensor_units ADD COLUMN IF NOT EXISTS min_val FLOAT")
        cur.execute("ALTER TABLE sensor_units ADD COLUMN IF NOT EXISTS max_val FLOAT")
        cur.execute("SELECT COUNT(*) FROM sensor_units")
        if cur.fetchone()[0] == 0:
            cur.executemany(
                "INSERT INTO sensor_units (category, unit, description) VALUES (%s, %s, %s)",
                _UNIT_SEEDS,
            )
        # Ensure working_speed exists
        cur.execute("""
            INSERT INTO sensor_units (category, unit, description, min_val, max_val)
            VALUES ('Speed', 'working_speed', 'Working speed (m/min)', 0, 500)
            ON CONFLICT (unit) DO NOTHING
        """)


def list_sensor_units() -> list:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM sensor_units ORDER BY category, unit")
            return [dict(r) for r in cur.fetchall()]


def build_node_maps() -> tuple[dict, dict]:
    """Return (monitored_nodes, alarm_nodes) dicts from active DB rows."""
    rows = list_nodes()
    process = {}
    alarms = {}
    for r in rows:
        if not r["is_active"]:
            continue
        key = r["name"].lower().replace(" ", "_")
        if r["type"] == "alarm":
            alarms[key] = r["node_id"]
        else:
            process[key] = r["node_id"]
    return process, alarms
