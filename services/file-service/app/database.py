"""
database.py — PostgreSQL helpers for file-service.

Table: files
  id           SERIAL PRIMARY KEY
  name         TEXT NOT NULL            — original filename
  mime_type    TEXT NOT NULL
  size         INTEGER NOT NULL
  description  TEXT DEFAULT ''
  tags         TEXT[] DEFAULT '{}'
  uploaded     TEXT NOT NULL            — ISO date string from client
  project      TEXT DEFAULT ''
  folder       TEXT DEFAULT ''          — logical subfolder name
  file_path    TEXT NOT NULL            — relative path inside STORAGE_DIR
  uploaded_by  TEXT NOT NULL DEFAULT '' — username of the uploader
"""
import psycopg2
import psycopg2.extras
from .settings import settings

# ── Connection ────────────────────────────────────────────────────────────────

def _conn():
    return psycopg2.connect(settings.postgres_url)


def init_db():
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    id          SERIAL PRIMARY KEY,
                    name        TEXT    NOT NULL,
                    mime_type   TEXT    NOT NULL,
                    size        INTEGER NOT NULL,
                    description TEXT    NOT NULL DEFAULT '',
                    tags        TEXT[]  NOT NULL DEFAULT '{}',
                    uploaded    TEXT    NOT NULL DEFAULT '',
                    project     TEXT    NOT NULL DEFAULT '',
                    folder      TEXT    NOT NULL DEFAULT '',
                    file_path   TEXT    NOT NULL
                )
            """)
            # Migrate existing installs
            cur.execute(
                "ALTER TABLE files ADD COLUMN IF NOT EXISTS uploaded_by TEXT NOT NULL DEFAULT ''"
            )
        con.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_dict(row, cur) -> dict:
    cols = [d[0] for d in cur.description]
    return dict(zip(cols, row))


# ── CRUD ──────────────────────────────────────────────────────────────────────

def list_files(uploaded_by: str | None = None) -> list[dict]:
    """Return all files (superadmin) or only those owned by uploaded_by."""
    with _conn() as con:
        with con.cursor() as cur:
            if uploaded_by is None:
                cur.execute(
                    "SELECT id, name, mime_type, size, description, tags, "
                    "uploaded, project, folder, uploaded_by FROM files ORDER BY id DESC"
                )
            else:
                cur.execute(
                    "SELECT id, name, mime_type, size, description, tags, "
                    "uploaded, project, folder, uploaded_by FROM files "
                    "WHERE uploaded_by = %s ORDER BY id DESC",
                    (uploaded_by,),
                )
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in rows]


def get_file(file_id: int) -> dict | None:
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute("SELECT * FROM files WHERE id = %s", (file_id,))
            row = cur.fetchone()
            if row is None:
                return None
            return _row_to_dict(row, cur)


def get_file_owner(file_id: int) -> str | None:
    """Returns the username of the uploader, or None if file not found."""
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute("SELECT uploaded_by FROM files WHERE id = %s", (file_id,))
            row = cur.fetchone()
            return row[0] if row else None


def insert_file(
    name: str, mime_type: str, size: int, description: str,
    tags: list[str], uploaded: str, project: str, folder: str,
    file_path: str, uploaded_by: str = "",
) -> dict:
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                INSERT INTO files
                    (name, mime_type, size, description, tags, uploaded, project, folder, file_path, uploaded_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id, name, mime_type, size, description, tags, uploaded, project, folder, uploaded_by
                """,
                (name, mime_type, size, description, tags, uploaded, project, folder, file_path, uploaded_by),
            )
            row = cur.fetchone()
            con.commit()
            return _row_to_dict(row, cur)


def update_file(file_id: int, description: str, tags: list[str], project: str, folder: str) -> dict | None:
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                UPDATE files
                SET description=%s, tags=%s, project=%s, folder=%s
                WHERE id=%s
                RETURNING id, name, mime_type, size, description, tags, uploaded, project, folder, file_path, uploaded_by
                """,
                (description, tags, project, folder, file_id),
            )
            row = cur.fetchone()
            if row is None:
                return None
            con.commit()
            return _row_to_dict(row, cur)


def delete_file(file_id: int) -> str | None:
    """Returns file_path if the record existed, else None."""
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute("DELETE FROM files WHERE id=%s RETURNING file_path", (file_id,))
            row = cur.fetchone()
            if row is None:
                return None
            con.commit()
            return row[0]
