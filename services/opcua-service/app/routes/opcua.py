"""
OPC-UA routes — all endpoints under /opcua prefix.
JWT auth required on every endpoint (viewer+ for reads, operator+ for writes).
"""
import logging
import time
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app import security, database

log = logging.getLogger(__name__)
router = APIRouter(prefix="/opcua", tags=["opcua"])

ALL_ROLES = ["superadmin", "admin", "operator", "viewer"]
WRITE_ROLES = ["superadmin", "admin", "operator"]


def _poller(request: Request):
    p = request.app.state.poller
    if p is None:
        raise HTTPException(status_code=503, detail="OPC-UA poller not initialized")
    return p


# ── Models ────────────────────────────────────────────────────────────────────

class WriteRequest(BaseModel):
    node_id: str
    value: Any
    data_type: Optional[str] = None


class NodeDefCreate(BaseModel):
    name: str
    node_id: str
    type: str = "process"          # "process" | "alarm"
    unit: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    sim_behavior: str = "sine"
    sim_min: float = 0.0
    sim_max: float = 100.0
    sim_period: float = 30.0


class NodeDefUpdate(BaseModel):
    name: Optional[str] = None
    node_id: Optional[str] = None
    type: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sim_behavior: Optional[str] = None
    sim_min: Optional[float] = None
    sim_max: Optional[float] = None
    sim_period: Optional[float] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
async def health(poller=Depends(_poller)):
    connected = await poller.is_connected()
    errors = poller.get_error_count()
    if not connected:
        status = "unhealthy"
    elif errors > 5:
        status = "degraded"
    else:
        status = "healthy"
    return {
        "status": status,
        "connected": connected,
        "consecutive_errors": errors,
        "uptime_seconds": poller.get_uptime(),
    }


@router.get("/status")
async def status(
    poller=Depends(_poller),
    _=Depends(security.require_jwt(ALL_ROLES)),
):
    return await poller.get_status()


@router.get("/process-data")
async def process_data(
    poller=Depends(_poller),
    _=Depends(security.require_jwt(ALL_ROLES)),
):
    snapshot = await poller.get_latest(timeout=2.0)
    if snapshot is None:
        raise HTTPException(status_code=503, detail="No data available — check OPC-UA connection")
    return {
        "timestamp": snapshot.timestamp,
        "read_time_ms": snapshot.read_time_ms,
        "data": snapshot.data,
    }


@router.get("/statistics")
async def statistics(
    poller=Depends(_poller),
    _=Depends(security.require_jwt(ALL_ROLES)),
):
    return await poller.get_statistics()


@router.get("/browse-nodes")
async def browse_nodes(
    parent_node: str = 'ns=3;s=DataBlocksGlobal',
    poller=Depends(_poller),
    _=Depends(security.require_jwt(ALL_ROLES)),
):
    try:
        nodes = await poller.browse_nodes(parent_node)
        return {"parent_node": parent_node, "child_nodes": nodes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/read-node")
async def read_node(
    node_id: str,
    poller=Depends(_poller),
    _=Depends(security.require_jwt(ALL_ROLES)),
):
    try:
        value = await poller.read_node(node_id)
        return {"node_id": node_id, "value": value}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/write-value")
async def write_value(
    body: WriteRequest,
    poller=Depends(_poller),
    _=Depends(security.require_jwt(WRITE_ROLES)),
):
    ok = await poller.write_value(body.node_id, body.value, body.data_type)
    if not ok:
        raise HTTPException(status_code=500, detail="Write operation failed")
    return {"status": "ok", "node_id": body.node_id, "value": body.value}


@router.get("/nodes")
async def get_nodes(
    poller=Depends(_poller),
    _=Depends(security.require_jwt(ALL_ROLES)),
):
    """Return the names of all monitored process nodes and alarm nodes."""
    return poller.get_node_names()


@router.get("/timeseries")
async def timeseries(
    measurement: str = "process_data",
    node: str = "temperature",
    from_ts: Optional[float] = None,
    to_ts: Optional[float] = None,
    limit: int = 1000,
    poller=Depends(_poller),
    _=Depends(security.require_jwt(ALL_ROLES)),
):
    """
    Query timeseries data from InfluxDB.

    - measurement: process_data | alarms
    - node: node_name (process) or alarm_name (alarms)
    - from_ts / to_ts: Unix timestamps (float). Default: last 1 hour.
    - limit: max number of points returned (default 1000).
    """
    now = time.time()
    if from_ts is None:
        from_ts = now - 3600.0
    if to_ts is None:
        to_ts = now

    if measurement not in ("process_data", "alarms"):
        raise HTTPException(status_code=400, detail="measurement must be 'process_data' or 'alarms'")
    if limit < 1 or limit > 10_000:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 10000")

    try:
        points = await poller.query_timeseries(measurement, node, from_ts, to_ts, limit)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        log.error(f"Timeseries query error: {e}")
        raise HTTPException(status_code=500, detail="Query failed")

    return {
        "measurement": measurement,
        "node": node,
        "from_ts": from_ts,
        "to_ts": to_ts,
        "count": len(points),
        "points": points,
    }


# ── Node config CRUD ──────────────────────────────────────────────────────────

@router.get("/sensor-units")
def sensor_units_list(_=Depends(security.require_jwt(ALL_ROLES))):
    """List all standard sensor units grouped for dropdown use."""
    return database.list_sensor_units()


@router.get("/node-config")
def node_config_list(_=Depends(security.require_jwt(ALL_ROLES))):
    """List all node definitions."""
    return database.list_nodes()


@router.post("/node-config", status_code=201)
def node_config_create(
    body: NodeDefCreate,
    request: Request,
    _=Depends(security.require_jwt(WRITE_ROLES)),
):
    """Create a new node definition and hot-reload the poller."""
    row = database.create_node(body.name, body.node_id, body.type,
                               body.unit, body.description, body.is_active,
                               body.sim_behavior, body.sim_min, body.sim_max, body.sim_period)
    _reload_poller(request)
    return row


@router.put("/node-config/{id}")
def node_config_update(
    id: int,
    body: NodeDefUpdate,
    request: Request,
    _=Depends(security.require_jwt(WRITE_ROLES)),
):
    """Update a node definition and hot-reload the poller."""
    row = database.update_node(id, **body.model_dump(exclude_none=True))
    if row is None:
        raise HTTPException(status_code=404, detail="Node not found")
    _reload_poller(request)
    return row


@router.delete("/node-config/{id}", status_code=204)
def node_config_delete(
    id: int,
    request: Request,
    _=Depends(security.require_jwt(WRITE_ROLES)),
):
    """Delete a node definition and hot-reload the poller."""
    if not database.delete_node(id):
        raise HTTPException(status_code=404, detail="Node not found")
    _reload_poller(request)


def _reload_poller(request: Request):
    poller = getattr(request.app.state, "poller", None)
    if poller:
        process_nodes, alarm_nodes = database.build_node_maps()
        poller.reload_nodes(process_nodes, alarm_nodes)
