"""
SAP B1 → MSSQL sync routes.
Adapted from sap/backend/app3 — auth changed to shared-JWT model.
"""
import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel

from app.schemas import SyncRequest
from app.core import (
    connect_sql,
    write_to_sql_server,
    fetch_b1_rows,
    log_job_start,
    log_job_end,
    VPNConnectionError,
)
from shared.python_common.vpn_manager import get_vpn_manager
from app import security

log = logging.getLogger(__name__)
router = APIRouter(prefix="/sap", tags=["sap-sync"])


class DashboardSyncRequest(BaseModel):
    query_name: str
    base_table: str
    dst_schema: str = "dbo"
    load_mode: str = "replace"


def _lookup_sql_text(cur, sql_code: str) -> str | None:
    """Return sql_b1_comp_base_query from wrk_QueryDef where query_name = sql_code."""
    try:
        cur.execute(
            "SELECT sql_b1_comp_base_query FROM dbo.wrk_QueryDef WHERE query_name = ? AND is_active = 1",
            (sql_code,),
        )
        row = cur.fetchone()
        return row[0] if row else None
    except Exception:
        return None


def _run_sync(*, endpoint: str, req: SyncRequest, username: str | None = None,
              sync_type: str = 'sync') -> dict:
    get_vpn_manager().ensure_connected()
    conn = connect_sql()
    job_id = None
    try:
        cur = conn.cursor()
        job_id = log_job_start(cur, endpoint=endpoint, sql_code=req.sql_code,
                               table=f"{req.dst_schema}.{req.dst_table}",
                               username=username, sync_type=sync_type)
        conn.commit()

        # Auto-populate sql_text from wrk_QueryDef if not supplied by caller
        sql_text = req.sql_text
        if sql_text is None:
            sql_text = _lookup_sql_text(cur, req.sql_code)
            if sql_text:
                log.info("Auto-resolved sql_text for '%s' from wrk_QueryDef", req.sql_code)

        rows = fetch_b1_rows(
            sql_code=req.sql_code,
            create_if_missing=req.create_if_missing,
            sql_text=sql_text,
            verify=False,
            force_labels=req.force_labels,
        )

        if rows and not req.dry_run:
            write_to_sql_server(rows=rows, table=req.dst_table,
                                schema=req.dst_schema, load_mode=req.load_mode)

        log_job_end(cur, job_id=job_id, status="SUCCESS", rows_written=len(rows))
        conn.commit()
        return {"job_id": job_id, "rows_written": len(rows)}

    except Exception as e:
        conn.rollback()
        if job_id:
            try:
                log_job_end(cur, job_id=job_id, status="FAILED", error=str(e))
                conn.commit()
            except Exception:
                pass
        raise
    finally:
        conn.close()


@router.get("/health")
def health():
    return {"status": "ok", "service": "sap-b1-adapter-service"}


@router.post(
    "/sync",
    summary="SAP B1 → MSSQL sync",
)
def sync(req: SyncRequest, current_user: dict = Depends(security.require_jwt(["superadmin", "admin", "operator"]))):
    try:
        result = _run_sync(endpoint="/sap/sync", req=req,
                           username=current_user.get("sub"), sync_type="sync")
        return {"status": "ok", "rows_written": result["rows_written"], "table": req.dst_table}
    except VPNConnectionError as e:
        raise HTTPException(status_code=503, detail=e.to_json())
    except Exception as e:
        log.exception("Sync failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/sync-async",
    summary="Background SAP B1 → MSSQL sync",
)
def sync_async(req: SyncRequest, bg: BackgroundTasks, api_role: str = Depends(security.require_api_key(["operator", "admin", "superadmin"]))):
    bg.add_task(_run_sync, endpoint="/sap/sync-async", req=req,
                username=f"api:{api_role}", sync_type="async")
    return {"status": "accepted"}


def _start_sync_job(*, req: SyncRequest, username: str | None) -> int:
    """Insert RUNNING job row and return job_id — used to hand off to background task."""
    get_vpn_manager().ensure_connected()
    conn = connect_sql()
    try:
        cur = conn.cursor()
        job_id = log_job_start(cur, endpoint="/sap/sync-query",
                               sql_code=req.sql_code,
                               table=f"{req.dst_schema}.{req.dst_table}",
                               username=username, sync_type="async")
        conn.commit()
        return job_id
    finally:
        conn.close()


def _bg_run_sync(*, job_id: int, req: SyncRequest, username: str | None) -> None:
    """Background task: run the sync and update the pre-created job row."""
    get_vpn_manager().ensure_connected()
    conn = connect_sql()
    try:
        cur = conn.cursor()
        sql_text = _lookup_sql_text(cur, req.sql_code)

        rows = fetch_b1_rows(
            sql_code=req.sql_code,
            create_if_missing=req.create_if_missing,
            sql_text=sql_text,
            verify=False,
            force_labels=req.force_labels,
        )

        if rows and not req.dry_run:
            write_to_sql_server(rows=rows, table=req.dst_table,
                                schema=req.dst_schema, load_mode=req.load_mode)

        log_job_end(cur, job_id=job_id, status="SUCCESS", rows_written=len(rows))
        conn.commit()

    except Exception as e:
        conn.rollback()
        try:
            log_job_end(cur, job_id=job_id, status="FAILED", error=str(e))
            conn.commit()
        except Exception:
            pass
    finally:
        conn.close()


@router.post(
    "/sync-query",
    status_code=202,
    summary="Start an async query sync from Dashboard (JWT auth)",
)
def sync_query(
    req: DashboardSyncRequest,
    bg: BackgroundTasks,
    current_user: dict = Depends(security.require_jwt(["superadmin", "admin", "operator"])),
):
    """Fires sync in background, returns job_id immediately. Frontend polls GET /sap/jobs/{id}."""
    sync_req = SyncRequest(
        sql_code=req.query_name,
        dst_table=req.base_table,
        dst_schema=req.dst_schema,
        load_mode=req.load_mode,
        create_if_missing=False,
    )
    try:
        job_id = _start_sync_job(req=sync_req, username=current_user.get("sub"))
    except Exception as e:
        log.exception("Failed to create job row")
        raise HTTPException(status_code=500, detail=str(e))

    bg.add_task(_bg_run_sync, job_id=job_id, req=sync_req, username=current_user.get("sub"))
    return {"job_id": job_id, "status": "accepted", "table": req.base_table}
