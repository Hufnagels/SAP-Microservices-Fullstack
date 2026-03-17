"""
SQL Server database operations
"""
import time
import logging
from typing import Any, Optional
from datetime import datetime, date

import pyodbc

from app.settings import Settings as _Settings

_s = _Settings()
DRIVER = _s.mssql_driver
DST_SERVER = _s.dst_server
DST_DB = _s.dst_db
DST_USER = _s.dst_user
DST_PWD = _s.dst_password
DST_TRUSTED = _s.dst_trusted
MAX_RETRIES = 3
RETRY_DELAY = 2


logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Custom database error with JSON-serializable details"""
    def __init__(self, message: str, error_code: str, details: Optional[dict] = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)

    def to_json(self):
        """Convert error to JSON-serializable dict"""
        return {
            "error": True,
            "error_code": self.error_code,
            "message": self.message,
            "details": self.details,
            "timestamp": datetime.now().isoformat()
        }


def connect_sql(retry_count: int = 0):
    """Connect to SQL Server with proper connection string and retry logic"""

    # Build proper connection string
    if DST_TRUSTED:
        connection_string = (
            f"DRIVER={{{DRIVER}}};"
            f"SERVER={DST_SERVER};"
            f"DATABASE={DST_DB};"
            "Trusted_Connection=yes;"
            "Connection Timeout=30;"
            "Login Timeout=30;"
            "TrustServerCertificate=yes;"
            "MultipleActiveResultSets=true;"
        )
    else:
        connection_string = (
            f"DRIVER={{{DRIVER}}};"
            f"SERVER={DST_SERVER};"
            f"DATABASE={DST_DB};"
            f"UID={DST_USER};"
            f"PWD={DST_PWD};"
            "Encrypt=no;"
            "Connection Timeout=30;"
            "Login Timeout=30;"
            "TrustServerCertificate=yes;"
            "MultipleActiveResultSets=true;"
        )

    try:
        conn = pyodbc.connect(connection_string, autocommit=False)
        logger.info(f"Database connection established to {DST_SERVER}/{DST_DB}")
        return conn

    except (pyodbc.OperationalError, pyodbc.InterfaceError) as e:
        error_msg = str(e)

        # Check for timeout errors
        if "Login timeout expired" in error_msg or "HYT00" in error_msg:
            if retry_count < MAX_RETRIES:
                logger.warning(
                    f"Connection timeout, retrying in {RETRY_DELAY}s... "
                    f"(attempt {retry_count + 1}/{MAX_RETRIES})"
                )
                time.sleep(RETRY_DELAY)
                return connect_sql(retry_count + 1)
            else:
                logger.error(
                    f"Database connection failed after {MAX_RETRIES} retries: {error_msg}"
                )
                raise DatabaseError(
                    message="Database connection timeout - server not responding",
                    error_code="DB_CONNECTION_TIMEOUT",
                    details={
                        "server": DST_SERVER,
                        "database": DST_DB,
                        "retry_attempts": MAX_RETRIES,
                        "troubleshooting": [
                            "Check if SQL Server is running",
                            "Verify server address and port (default: 1433)",
                            "Check firewall allows SQL Server connections",
                            "Verify network connectivity to server"
                        ]
                    }
                )

        # Check for authentication errors (18456 = Login failed, 28000 = SQLSTATE)
        if "Login failed" in error_msg or "28000" in error_msg or "18456" in error_msg:
            logger.error(f"Authentication failed: {error_msg}")
            raise DatabaseError(
                message="Database authentication failed - invalid credentials",
                error_code="DB_AUTH_FAILED",
                details={
                    "server": DST_SERVER,
                    "database": DST_DB,
                    "username": DST_USER,
                    "troubleshooting": [
                        "Verify username and password are correct",
                        "Check if SQL Server authentication is enabled",
                        "Ensure user has access to the database"
                    ]
                }
            )

        # Check for server not found errors
        if "SQL Server does not exist" in error_msg or "08001" in error_msg:
            logger.error(f"Server not found: {error_msg}")
            raise DatabaseError(
                message="Database server not found or not accessible",
                error_code="DB_SERVER_NOT_FOUND",
                details={
                    "server": DST_SERVER,
                    "troubleshooting": [
                        "Verify server address is correct",
                        "Check if server is online",
                        "Ensure SQL Server Browser service is running (for named instances)"
                    ]
                }
            )

        # Generic operational error
        logger.error(f"Database operational error: {error_msg}")
        raise DatabaseError(
            message="Database connection failed",
            error_code="DB_CONNECTION_ERROR",
            details={
                "server": DST_SERVER,
                "database": DST_DB,
                "raw_error": error_msg[:200]
            }
        )

    except Exception as e:
        logger.error(f"Unexpected database error: {e}")
        raise DatabaseError(
            message="Unexpected database error occurred",
            error_code="DB_UNEXPECTED_ERROR",
            details={
                "error_type": type(e).__name__,
                "raw_error": str(e)[:200]
            }
        )


def coerce_value(value):
    """
    Normalize values coming from SAP Service Layer
    so pyodbc can safely insert them into SQL Server.
    """
    if value is None:
        return None

    # Convert ISO datetime strings -> datetime
    if isinstance(value, str):
        try:
            # Example: "2024-10-12T00:00:00"
            if "T" in value:
                return datetime.fromisoformat(value.replace("Z", ""))
            # Example: "2024-10-12"
            if len(value) == 10 and value[4] == "-" and value[7] == "-":
                return date.fromisoformat(value)
        except Exception:
            return value

    return value


def infer_sql_type(py_sample: Any) -> str:
    """Infer SQL Server type from Python value"""
    if py_sample is None:
        return "NVARCHAR(4000)"
    if isinstance(py_sample, int):
        return "BIGINT"
    if isinstance(py_sample, float):
        return "FLOAT"
    if isinstance(py_sample, bool):
        return "BIT"
    if isinstance(py_sample, datetime):
        return "DATETIME2(3)"
    if isinstance(py_sample, date):
        return "DATE"
    return "NVARCHAR(MAX)"


def ensure_table(cur, schema: str, table: str, col_names: list, col_types: list):
    """Ensure table exists, create if not"""
    cur.execute("""
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    """, (schema, table))

    if not cur.fetchone():
        cols_sql = ", ".join(f"[{n}] {t}" for n, t in zip(col_names, col_types))
        cur.execute(f"CREATE TABLE [{schema}].[{table}] ({cols_sql});")


def insert_rows(cur, schema: str, table: str, col_names: list, rows: list):
    """Insert rows into table using fast_executemany"""
    placeholders = ", ".join("?" for _ in col_names)
    col_sql = ", ".join(f"[{c}]" for c in col_names)
    sql = f"INSERT INTO [{schema}].[{table}] ({col_sql}) VALUES ({placeholders});"
    cur.fast_executemany = True
    cur.executemany(sql, rows)


def write_to_sql_server(
    rows: list[dict],
    table: str,
    schema: str,
    load_mode: str,
):
    """
    Write rows to SQL Server table
    """
    if not rows:
        return

    # Column order from first row (already remapped / decoded)
    col_names = list(rows[0].keys())

    # Matrix for pyodbc executemany
    rows_matrix = [
        tuple(coerce_value(r.get(col)) for col in col_names)
        for r in rows
    ]

    conn = connect_sql()
    try:
        cur = conn.cursor()

        # Infer SQL types from first row
        col_types = [infer_sql_type(v) for v in rows_matrix[0]]

        # Ensure table exists
        ensure_table(cur, schema, table, col_names, col_types)

        # Replace or append
        if load_mode == "replace":
            cur.execute(f"TRUNCATE TABLE [{schema}].[{table}]")

        # Insert
        insert_rows(cur, schema, table, col_names, rows_matrix)

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def log_job_start(cur, endpoint: str, sql_code: str, table: str,
                  username: str | None = None, sync_type: str = 'sync') -> int:
    """Log sync job start and return job_id"""
    cur.execute("""
        INSERT INTO dbo.logs_SyncJobs
            (endpoint, started_at, status, source_query, target_table, username, sync_type)
        OUTPUT INSERTED.job_id
        VALUES
            (?, SYSDATETIME(), 'RUNNING', ?, ?, ?, ?)
    """, (endpoint, sql_code, table, username, sync_type))
    return cur.fetchone()[0]


def log_job_end(
    cur,
    job_id: int,
    status: str,
    rows_written: int | None = None,
    error: str | None = None
):
    """Log sync job completion"""
    cur.execute("""
        UPDATE dbo.logs_SyncJobs
        SET finished_at = SYSDATETIME(),
            status = ?,
            rows_written = ?,
            error_message = ?
        WHERE job_id = ?
    """, (status, rows_written, error, job_id))
