"""
Query definition CRUD routes — wrk_QueryDef table.
Stores original SQL + SAP B1-preprocessed variant.
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core import connect_sql, fetch_b1_rows, VPNConnectionError, check_vpn_connection
from app.core.sql_preprocessor import preprocess_sql
from app import security

log = logging.getLogger(__name__)
router = APIRouter(prefix="/sap", tags=["sap-queries"])


class QueryDefIn(BaseModel):
    query_name: str
    dst_table: Optional[str] = None
    description: Optional[str] = None
    sql_original: str
    service_name: Optional[str] = None
    is_active: bool = True
    username: Optional[str] = None


class PreviewReq(BaseModel):
    sql_code: str
    sql_text: Optional[str] = None
    log_to_jobs: bool = False   # if True, write an EXCEL row to logs_SyncJobs


def _upsert_table_desc(cur, dst_table: str, description: str, username: str) -> None:
    """MERGE into wrk_TableDesc. Skipped when dst_table is empty or 'EXCEL'."""
    if not dst_table or dst_table.strip().upper() == "EXCEL":
        return
    cur.execute(
        """
        MERGE dbo.wrk_TableDesc AS t
        USING (SELECT ? AS table_name, ? AS description, ? AS owner) AS s
            ON t.table_name = s.table_name
        WHEN MATCHED THEN
            UPDATE SET description = s.description, owner = s.owner
        WHEN NOT MATCHED THEN
            INSERT (table_name, description, owner, is_active)
            VALUES (s.table_name, s.description, s.owner, 1);
        """,
        (dst_table.strip(), description or "", username),
    )


def _preprocess(sql_original: str) -> tuple[str, str]:
    """Run sql_preprocessor and return (clean_sql, extra_opts_json)."""
    clean_sql, calc_cols = preprocess_sql(sql_original)
    extra_opts = json.dumps([{"name": name} for name, _ in calc_cols])
    return clean_sql, extra_opts


# ── List ────────────────────────────────────────────────────────────────────

@router.get("/queries", summary="List query definitions")
def list_queries(
    current_user: dict = Depends(
        security.require_jwt(["superadmin", "admin", "operator", "viewer"])
    ),
):
    conn = None
    try:
        check_vpn_connection()
        conn = connect_sql()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT q.*, td.description AS table_description
            FROM dbo.wrk_QueryDef q
            LEFT JOIN dbo.wrk_TableDesc td ON td.table_name = q.base_table
            WHERE q.is_active = 1
            ORDER BY q.query_id DESC
            """
        )
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    except VPNConnectionError as e:
        raise HTTPException(status_code=503, detail=e.to_json())
    except Exception:
        log.exception("Failed to list queries")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        if conn:
            conn.close()


# ── Create ───────────────────────────────────────────────────────────────────

@router.post("/queries", summary="Create query definition")
def create_query(
    body: QueryDefIn,
    current_user: dict = Depends(
        security.require_jwt(["superadmin", "admin"])
    ),
):
    try:
        clean_sql, extra_opts = _preprocess(body.sql_original)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL preprocessing failed: {e}")

    conn = None
    try:
        check_vpn_connection()
        conn = connect_sql()
        cur = conn.cursor()
        username = body.username or current_user.get("sub")
        cur.execute(
            """
            INSERT INTO dbo.wrk_QueryDef
                (query_name, base_table, description,
                 sql_original, sql_b1_comp_base_query, sql_b1_comp_extra_options,
                 service_name, is_active, created_by)
            OUTPUT INSERTED.query_id
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                body.query_name,
                body.dst_table or None,
                body.description,
                body.sql_original,
                clean_sql,
                extra_opts,
                body.service_name,
                username,
            ),
        )
        query_id = cur.fetchone()[0]
        _upsert_table_desc(cur, body.dst_table or "", body.description or "", username)
        conn.commit()
        return {
            "query_id": query_id,
            "sql_b1_comp_base_query": clean_sql,
            "sql_b1_comp_extra_options": extra_opts,
        }
    except VPNConnectionError as e:
        raise HTTPException(status_code=503, detail=e.to_json())
    except Exception:
        if conn:
            conn.rollback()
        log.exception("Failed to create query")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        if conn:
            conn.close()


# ── Update ───────────────────────────────────────────────────────────────────

@router.put("/queries/{query_id}", summary="Update query definition")
def update_query(
    query_id: int,
    body: QueryDefIn,
    current_user: dict = Depends(
        security.require_jwt(["superadmin", "admin"])
    ),
):
    try:
        clean_sql, extra_opts = _preprocess(body.sql_original)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL preprocessing failed: {e}")

    conn = None
    try:
        check_vpn_connection()
        conn = connect_sql()
        cur = conn.cursor()
        username = body.username or current_user.get("sub")
        cur.execute(
            """
            UPDATE dbo.wrk_QueryDef
            SET query_name                = ?,
                base_table                = ?,
                description               = ?,
                sql_original              = ?,
                sql_b1_comp_base_query    = ?,
                sql_b1_comp_extra_options = ?,
                service_name              = ?,
                updated_by                = ?,
                updated_at                = SYSDATETIME()
            WHERE query_id = ?
            """,
            (
                body.query_name,
                body.dst_table or None,
                body.description,
                body.sql_original,
                clean_sql,
                extra_opts,
                body.service_name,
                username,
                query_id,
            ),
        )
        _upsert_table_desc(cur, body.dst_table or "", body.description or "", username)
        conn.commit()
        return {"query_id": query_id, "sql_b1_comp_base_query": clean_sql}
    except VPNConnectionError as e:
        raise HTTPException(status_code=503, detail=e.to_json())
    except Exception:
        if conn:
            conn.rollback()
        log.exception("Failed to update query")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        if conn:
            conn.close()


# ── Delete (soft) ────────────────────────────────────────────────────────────

@router.delete("/queries/{query_id}", summary="Deactivate query definition")
def delete_query(
    query_id: int,
    current_user: dict = Depends(
        security.require_jwt(["superadmin", "admin"])
    ),
):
    conn = None
    try:
        check_vpn_connection()
        conn = connect_sql()
        cur = conn.cursor()
        cur.execute(
            "UPDATE dbo.wrk_QueryDef SET is_active = 0 WHERE query_id = ?",
            (query_id,),
        )
        conn.commit()
        return {"deleted": query_id}
    except VPNConnectionError as e:
        raise HTTPException(status_code=503, detail=e.to_json())
    except Exception:
        if conn:
            conn.rollback()
        log.exception("Failed to delete query")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        if conn:
            conn.close()


# ── Preview (no MSSQL write) ──────────────────────────────────────────────────

@router.post("/queries/preview", summary="Fetch SAP B1 rows without writing to MSSQL")
def preview_query(
    body: PreviewReq,
    current_user: dict = Depends(
        security.require_jwt(["superadmin", "admin", "operator"])
    ),
):
    username = current_user.get("sub")
    conn = connect_sql() if body.log_to_jobs else None
    job_id = None
    try:
        if conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO dbo.logs_SyncJobs
                    (endpoint, started_at, status, source_query, target_table, username)
                OUTPUT INSERTED.job_id
                VALUES (?, SYSDATETIME(), 'RUNNING', ?, 'EXCEL', ?)
                """,
                ("/sap/queries/preview", body.sql_code, username),
            )
            job_id = cur.fetchone()[0]
            conn.commit()

        # Auto-resolve sql_text from wrk_QueryDef if not supplied
        sql_text = body.sql_text
        if not sql_text:
            _lconn = conn or connect_sql()
            try:
                _cur = _lconn.cursor()
                _cur.execute(
                    "SELECT sql_b1_comp_base_query FROM dbo.wrk_QueryDef WHERE query_name = ? AND is_active = 1",
                    (body.sql_code,),
                )
                _row = _cur.fetchone()
                if _row:
                    sql_text = _row[0]
                    log.info("Auto-resolved sql_text for preview of '%s'", body.sql_code)
            finally:
                if _lconn is not conn:
                    _lconn.close()

        rows = fetch_b1_rows(
            sql_code=body.sql_code,
            create_if_missing=bool(sql_text),
            sql_text=sql_text,
            verify=False,
            force_labels=None,
        )

        if conn and job_id:
            cur.execute(
                """
                UPDATE dbo.logs_SyncJobs
                SET finished_at = SYSDATETIME(), status = 'SUCCESS', rows_written = ?
                WHERE job_id = ?
                """,
                (len(rows), job_id),
            )
            conn.commit()

        return rows

    except VPNConnectionError as e:
        if conn and job_id:
            try:
                cur.execute(
                    "UPDATE dbo.logs_SyncJobs SET finished_at=SYSDATETIME(), status='FAILED', error_message=? WHERE job_id=?",
                    (str(e.message), job_id),
                )
                conn.commit()
            except Exception:
                pass
        raise HTTPException(status_code=503, detail=e.to_json())
    except Exception as e:
        log.exception("Preview failed")
        if conn and job_id:
            try:
                cur.execute(
                    "UPDATE dbo.logs_SyncJobs SET finished_at=SYSDATETIME(), status='FAILED', error_message=? WHERE job_id=?",
                    (str(e)[:500], job_id),
                )
                conn.commit()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()
