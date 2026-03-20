"""
PostgreSQL database connection and initialization for auth-service.
"""
import json
import logging
import psycopg2
import psycopg2.extras
from contextlib import contextmanager

log = logging.getLogger(__name__)

ROLE_RANK: dict[str, int] = {"superadmin": 4, "admin": 3, "operator": 2, "viewer": 1, "worker": 0}

_postgres_url: str = ""


def init_db(postgres_url: str):
    """Store the DB URL and ensure the users table exists."""
    global _postgres_url
    _postgres_url = postgres_url
    _create_tables()


@contextmanager
def get_conn():
    """Context manager for a psycopg2 connection."""
    conn = psycopg2.connect(_postgres_url)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _create_tables():
    """Create tables and apply column migrations if needed."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS auth_users (
                    id            SERIAL PRIMARY KEY,
                    username      VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(200) NOT NULL,
                    role          VARCHAR(50)  NOT NULL DEFAULT 'viewer',
                    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
                    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                    name          VARCHAR(200),
                    email         VARCHAR(200),
                    service_roles JSONB        NOT NULL DEFAULT '{}'
                );
            """)
            # Migrate existing installs that lack the newer columns
            for stmt in [
                "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS name          VARCHAR(200)",
                "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email         VARCHAR(200)",
                "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS service_roles JSONB NOT NULL DEFAULT '{}'",
                "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS avatar_mode   VARCHAR(20) DEFAULT 'letter'",
                "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS avatar_base64 TEXT",
            ]:
                cur.execute(stmt)
        # Role permissions table — one row per role (role_name UNIQUE)
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS role_permissions (
                    id          SERIAL PRIMARY KEY,
                    role_name   VARCHAR(50) UNIQUE NOT NULL,
                    permissions JSONB NOT NULL DEFAULT '{}'
                )
            """)
            # Migrate old single-row format (no role_name) → per-role rows
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name='role_permissions' AND column_name='role_name'
            """)
            has_col = cur.fetchone() is not None
            # Default seed (runs only when table is empty — fresh install)
            cur.execute("SELECT COUNT(*) FROM role_permissions")
            if cur.fetchone()[0] == 0:
                default_perms = {
                    "superadmin": {
                        "auth-service":         ["create", "read", "update", "delete"],
                        "sap-b1-adapter-service":["create", "read", "update", "delete"],
                        "file-service":         ["create", "read", "update", "delete"],
                        "binpack-service":      ["create", "read", "update", "delete"],
                        "labeling-service":     ["create", "read", "update", "delete"],
                        "orders-service":       ["create", "read", "update", "delete"],
                        "inventory-service":    ["create", "read", "update", "delete"],
                        "reporting-service":    ["create", "read", "update", "delete"],
                        "sensor-ingest-service":["create", "read", "update", "delete"],
                        "maps-service":         ["create", "read", "update", "delete"],
                    },
                    "admin": {
                        "auth-service":         ["create", "read", "update", "delete"],
                        "sap-b1-adapter-service":["create", "read", "update"],
                        "file-service":         ["create", "read", "update", "delete"],
                        "binpack-service":      ["read"],
                        "labeling-service":     ["create", "read", "update"],
                        "orders-service":       ["create", "read", "update"],
                        "inventory-service":    ["create", "read", "update"],
                        "reporting-service":    ["create", "read", "update"],
                        "sensor-ingest-service":["read"],
                        "maps-service":         ["create", "read", "update", "delete"],
                    },
                    "operator": {
                        "auth-service":         ["read"],
                        "sap-b1-adapter-service":["create", "read"],
                        "file-service":         ["create", "read", "update"],
                        "binpack-service":      ["read"],
                        "labeling-service":     ["create", "read"],
                        "orders-service":       ["read"],
                        "inventory-service":    ["read"],
                        "reporting-service":    ["read"],
                        "sensor-ingest-service":["create", "read"],
                        "maps-service":         ["read"],
                    },
                    "viewer": {
                        "auth-service":         ["read"],
                        "sap-b1-adapter-service":["read"],
                        "file-service":         ["read"],
                        "binpack-service":      ["read"],
                        "labeling-service":     [],
                        "orders-service":       ["read"],
                        "inventory-service":    ["read"],
                        "reporting-service":    ["read"],
                        "sensor-ingest-service":["read"],
                        "maps-service":         ["read"],
                    },
                    "worker": {
                        "auth-service":         [],
                        "sap-b1-adapter-service":[],
                        "file-service":         ["read"],
                        "binpack-service":      ["read"],
                        "labeling-service":     ["create", "read"],
                        "orders-service":       ["read"],
                        "inventory-service":    ["read"],
                        "reporting-service":    [],
                        "sensor-ingest-service":["create", "read"],
                        "maps-service":         ["read"],
                    },
                }
                for rn, perms in default_perms.items():
                    cur.execute(
                        "INSERT INTO role_permissions (role_name, permissions) VALUES (%s, %s)",
                        (rn, json.dumps(perms)),
                    )
            else:
                # Ensure worker row exists on upgraded installs
                cur.execute("SELECT 1 FROM role_permissions WHERE role_name = 'worker'")
                if not cur.fetchone():
                    cur.execute(
                        "INSERT INTO role_permissions (role_name, permissions) VALUES ('worker', %s)",
                        (json.dumps({}),),
                    )
    log.info("auth_users table ready")
    _create_services_table()


def _create_services_table():
    """Create the services registry table and seed with known services."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS services (
                    id           SERIAL PRIMARY KEY,
                    name         VARCHAR(100) UNIQUE NOT NULL,
                    pascal_name  VARCHAR(100),
                    description  TEXT,
                    service_url  VARCHAR(300),
                    port         INTEGER,
                    make_command VARCHAR(200),
                    api_endpoint VARCHAR(200),
                    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            # Seed with all known services if the table is empty
            cur.execute("SELECT COUNT(*) FROM services")
            if cur.fetchone()[0] == 0:
                seeds = [
                    ("auth-service",         "AuthService",        "JWT authentication, user management, role permissions",    "http://auth-service:8000",         8000, "make dev-auth",    "/auth"),
                    ("sap-b1-adapter-service","SapB1AdapterService","SAP B1 Service Layer adapter — sync queries to MSSQL",     "http://sap-b1-adapter-service:8000",8000, "make up-sap",      "/sap"),
                    ("file-service",         "FileService",        "File upload/download with PostgreSQL metadata store",       "http://file-service:8000",         8000, "make up",          "/files"),
                    ("binpack-service",      "BinpackService",     "3D bin packing optimisation service",                       "http://binpack-service:8000",      8000, "make up-binpack",  "/binpack"),
                    ("labeling-service",     "LabelingService",    "Live labeling and label printing service",                  "http://labeling-service:8000",     8000, "make up-labeling", "/labeling"),
                    ("orders-service",       "OrdersService",      "Order management service (stub)",                           "http://orders-service:8000",       8000, "make up",          "/orders"),
                    ("inventory-service",    "InventoryService",   "Inventory management service (stub)",                       "http://inventory-service:8000",    8000, "make up",          "/inventory"),
                    ("reporting-service",    "ReportingService",   "Reporting and analytics service (stub)",                    "http://reporting-service:8000",    8000, "make up",          "/reporting"),
                    ("sensor-ingest-service","SensorIngestService","Sensor data ingest and event pipeline (stub)",             "http://sensor-ingest-service:8000",8000, "make up",          "/sensor"),
                    ("maps-service",         "MapsService",        "Geospatial / Leaflet map data service (stub)",              "http://maps-service:8000",         8000, "make up",          "/maps"),
                    ("opcua-service",        "OpcuaService",       "Siemens S7-1500 OPC-UA polling, InfluxDB timeseries persistence", "http://opcua-service:8000",       8000, "make up-opcua",    "/opcua"),
                ]
                cur.executemany(
                    """INSERT INTO services
                       (name, pascal_name, description, service_url, port, make_command, api_endpoint)
                       VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                    seeds,
                )
    log.info("services table ready")


_SELECT = (
    "SELECT id, username, name, email, role, service_roles, is_active, created_at, "
    "avatar_mode, avatar_base64 "
)


def _fmt(row: dict) -> dict:
    """Convert a DB row (RealDictRow) to the API response format."""
    return {
        "id":            row["id"],
        "username":      row["username"],
        "name":          row["name"] or row["username"],
        "email":         row["email"] or "",
        "role":          row["role"],
        "service_roles": row["service_roles"] or {},
        "status":        "active" if row["is_active"] else "inactive",
        "joined":        row["created_at"].isoformat() if row["created_at"] else "",
        "avatar_mode":   row.get("avatar_mode") or "letter",
        "avatar_base64": row.get("avatar_base64"),
    }


def list_users() -> list:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_SELECT + "FROM auth_users ORDER BY id")
            return [_fmt(r) for r in cur.fetchall()]


def get_user(user_id: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_SELECT + "FROM auth_users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            return _fmt(row) if row else None


def get_user_by_username(username: str) -> dict | None:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_SELECT + "FROM auth_users WHERE username = %s", (username,))
            row = cur.fetchone()
            return _fmt(row) if row else None


def update_user(user_id: int, *, name: str | None = None, email: str | None = None,
                role: str | None = None, service_roles: dict | None = None,
                is_active: bool | None = None, password_hash: str | None = None,
                avatar_mode: str | None = None, avatar_base64: str | None = None,
                clear_avatar: bool = False) -> dict | None:
    fields, values = [], []
    if name          is not None: fields.append("name = %s");          values.append(name)
    if email         is not None: fields.append("email = %s");         values.append(email)
    if role          is not None: fields.append("role = %s");          values.append(role)
    if service_roles is not None: fields.append("service_roles = %s"); values.append(json.dumps(service_roles))
    if is_active     is not None: fields.append("is_active = %s");     values.append(is_active)
    if password_hash is not None: fields.append("password_hash = %s"); values.append(password_hash)
    if avatar_mode   is not None: fields.append("avatar_mode = %s");   values.append(avatar_mode)
    # avatar_base64 can be set to NULL (clear_avatar) or a new value
    if clear_avatar:              fields.append("avatar_base64 = %s"); values.append(None)
    elif avatar_base64 is not None: fields.append("avatar_base64 = %s"); values.append(avatar_base64)
    if not fields:
        return get_user(user_id)
    values.append(user_id)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"UPDATE auth_users SET {', '.join(fields)} WHERE id = %s "
                "RETURNING id, username, name, email, role, service_roles, is_active, created_at, "
                "avatar_mode, avatar_base64",
                values,
            )
            row = cur.fetchone()
            return _fmt(row) if row else None


def delete_user(user_id: int) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM auth_users WHERE id = %s", (user_id,))
            return cur.rowcount > 0


def get_permissions() -> dict:
    """Return full permissions map: {role_name: {resource: [actions]}}."""
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT role_name, permissions FROM role_permissions ORDER BY id")
            rows = cur.fetchall()
            return {r["role_name"]: dict(r["permissions"]) for r in rows}


def set_permissions(perms: dict) -> dict:
    """Upsert per-role rows from a full {role_name: {resource: [actions]}} map."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            for role_name, role_perms in perms.items():
                cur.execute("SELECT id FROM role_permissions WHERE role_name = %s", (role_name,))
                row = cur.fetchone()
                if row:
                    cur.execute(
                        "UPDATE role_permissions SET permissions = %s WHERE role_name = %s",
                        (json.dumps(role_perms), role_name),
                    )
                else:
                    cur.execute(
                        "INSERT INTO role_permissions (role_name, permissions) VALUES (%s, %s)",
                        (role_name, json.dumps(role_perms)),
                    )
    return get_permissions()


# ── Services registry ─────────────────────────────────────────────────────────

def list_services(active_only: bool = False) -> list:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sql = "SELECT * FROM services"
            if active_only:
                sql += " WHERE is_active = TRUE"
            sql += " ORDER BY id"
            cur.execute(sql)
            return [dict(r) for r in cur.fetchall()]


def get_service(service_id: int) -> dict | None:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM services WHERE id = %s", (service_id,))
            row = cur.fetchone()
            return dict(row) if row else None


def create_service(*, name: str, pascal_name: str | None = None, description: str | None = None,
                   service_url: str | None = None, port: int | None = None,
                   make_command: str | None = None, api_endpoint: str | None = None) -> dict:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """INSERT INTO services (name, pascal_name, description, service_url, port, make_command, api_endpoint)
                   VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (name, pascal_name, description, service_url, port, make_command, api_endpoint),
            )
            return dict(cur.fetchone())


def update_service(service_id: int, **kwargs) -> dict | None:
    allowed = {"pascal_name", "description", "service_url", "port", "make_command", "api_endpoint", "is_active"}
    fields, values = [], []
    for k, v in kwargs.items():
        if k in allowed and v is not None:
            fields.append(f"{k} = %s")
            values.append(v)
    if not fields:
        return get_service(service_id)
    values.append(service_id)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"UPDATE services SET {', '.join(fields)} WHERE id = %s RETURNING *",
                values,
            )
            row = cur.fetchone()
            return dict(row) if row else None


def delete_service(service_id: int) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM services WHERE id = %s", (service_id,))
            return cur.rowcount > 0


def bootstrap_admin(username: str, password: str):
    """Create an admin user if no users exist yet (first-run bootstrap)."""
    from app.security import hash_password
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM auth_users")
            count = cur.fetchone()[0]
            if count > 0:
                return
            cur.execute(
                "INSERT INTO auth_users (username, password_hash, role, name) VALUES (%s, %s, 'superadmin', %s)",
                (username, hash_password(password), username),
            )
    log.info(f"Bootstrap admin '{username}' created")
