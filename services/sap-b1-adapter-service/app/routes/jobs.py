"""
Job history routes — reads from MSSQL logs_SyncJobs table.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException

from app.core import connect_sql
from app import security

log = logging.getLogger(__name__)
router = APIRouter(prefix="/sap", tags=["sap-jobs"])


@router.get(
    "/jobs",
    summary="SAP sync job history",
    dependencies=[Depends(security.require_jwt(["superadmin", "admin", "operator", "viewer"]))],
)
def list_jobs(limit: int = 50):
    conn = connect_sql()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT TOP (?) * FROM dbo.logs_SyncJobs ORDER BY job_id DESC",
            (limit,),
        )
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception:
        log.exception("Failed to fetch job history")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        conn.close()


@router.get(
    "/jobs/{job_id}",
    summary="Get a single sync job by ID",
    dependencies=[Depends(security.require_jwt(["superadmin", "admin", "operator", "viewer"]))],
)
def get_job(job_id: int):
    conn = connect_sql()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM dbo.logs_SyncJobs WHERE job_id = ?", (job_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        cols = [c[0] for c in cur.description]
        return dict(zip(cols, row))
    except HTTPException:
        raise
    except Exception:
        log.exception("Failed to fetch job %s", job_id)
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        conn.close()
