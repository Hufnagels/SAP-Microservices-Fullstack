"""
OPC-UA Client — S7-1500 connection, polling, node browsing, InfluxDB persistence.
Adapted from Archive/OPC-UA/opcua_client.py for microservice integration.
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Tuple

from asyncua import Client, ua

logger = logging.getLogger(__name__)


@dataclass
class OPCUASnapshot:
    timestamp: float
    data: Dict[str, Any]          # process data (floats)
    alarm_data: Dict[str, Any]    # alarm states (bools)
    read_time_ms: float


class _SubHandler:
    """Duck-typed subscription handler for asyncua."""
    def __init__(self, callback):
        self.callback = callback
        self.update_count = 0

    def datachange_notification(self, node, val, data):
        self.update_count += 1
        try:
            self.callback(node, val, data)
        except Exception as e:
            logger.error(f"Subscription callback error: {e}")


# ── InfluxDB writer ────────────────────────────────────────────────────────────

class InfluxWriter:
    """
    Async InfluxDB 2.x writer using the line protocol.
    Writes two measurements:
      - process_data  tag: node_name  field: value (float)
      - alarms        tag: alarm_name field: active (int 0/1)
    """

    def __init__(self, url: str, token: str, org: str, bucket: str):
        from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync
        self._client = InfluxDBClientAsync(url=url, token=token, org=org)
        self._write  = self._client.write_api()
        self._query  = self._client.query_api()
        self._org    = org
        self._bucket = bucket
        logger.info(f"InfluxWriter → {url}  org={org}  bucket={bucket}")

    async def write_process(self, ts: float, data: Dict[str, Any]):
        """Write process_data measurement — one point per node."""
        ts_ns = int(ts * 1_000_000_000)
        lines = []
        for name, val in data.items():
            if val is None:
                continue
            try:
                fval = float(val)
            except (TypeError, ValueError):
                continue
            safe = name.replace(" ", "_")
            lines.append(f"process_data,node_name={safe} value={fval} {ts_ns}")
        if lines:
            await self._write.write(bucket=self._bucket, record="\n".join(lines),
                                    precision="ns")

    async def write_alarms(self, ts: float, alarms: Dict[str, Any]):
        """Write alarms measurement — active stored as int (0/1)."""
        ts_ns = int(ts * 1_000_000_000)
        lines = []
        for name, val in alarms.items():
            if val is None:
                continue
            active = 1 if val else 0
            safe = name.replace(" ", "_")
            lines.append(f"alarms,alarm_name={safe} active={active}i {ts_ns}")
        if lines:
            await self._write.write(bucket=self._bucket, record="\n".join(lines),
                                    precision="ns")

    async def query(
        self,
        measurement: str,
        node_tag: str,
        tag_key: str,
        from_ts: float,
        to_ts: float,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        """Query timeseries points; returns list of {ts, value} dicts."""
        from_rfc = _unix_to_rfc3339(from_ts)
        to_rfc   = _unix_to_rfc3339(to_ts)

        flux = (
            f'from(bucket: "{self._bucket}")\n'
            f'  |> range(start: {from_rfc}, stop: {to_rfc})\n'
            f'  |> filter(fn: (r) => r._measurement == "{measurement}")\n'
            f'  |> filter(fn: (r) => r.{tag_key} == "{node_tag}")\n'
            f'  |> limit(n: {limit})\n'
        )

        tables = await self._query.query(flux, org=self._org)
        points = []
        for table in tables:
            for record in table.records:
                points.append({
                    "ts":    record.get_time().timestamp(),
                    "value": record.get_value(),
                })
        return points

    async def close(self):
        await self._client.__aexit__(None, None, None)


def _unix_to_rfc3339(ts: float) -> str:
    import datetime
    dt = datetime.datetime.utcfromtimestamp(ts).replace(
        tzinfo=datetime.timezone.utc
    )
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


# ── OPC-UA Poller ──────────────────────────────────────────────────────────────

class OPCUAPoller:
    """
    Async OPC-UA polling service for Siemens S7-1500.
    - Polls process nodes + alarm nodes on a fixed interval
    - Persists each snapshot to InfluxDB (if writer provided)
    - Auto-reconnects on failure
    - Exposes status / statistics for health/status endpoints
    """

    def __init__(self, endpoint_url: str, username: Optional[str] = None,
                 password: Optional[str] = None, security_mode: str = "None",
                 poll_interval_ms: int = 500,
                 influx: Optional[InfluxWriter] = None):
        self.endpoint_url = endpoint_url
        self.username = username or None
        self.password = password or None
        self.security_mode = security_mode
        self.poll_interval = poll_interval_ms / 1000.0
        self._influx = influx

        self.client: Optional[Client] = None
        self._connected = False

        self.latest_data: Optional[OPCUASnapshot] = None
        self._data_lock = asyncio.Lock()

        self.subscription = None
        self._monitored_items = []

        self._polling_task: Optional[asyncio.Task] = None
        self._running = False

        # Statistics
        self._consecutive_errors = 0
        self._total_reads = 0
        self._total_writes = 0
        self._successful_reads = 0
        self._failed_reads = 0
        self._subscription_updates = 0
        self._read_times: List[float] = []
        self._last_successful_read: Optional[float] = None
        self._start_time = time.time()

        # Node maps loaded from DB (or fallback defaults)
        self.monitored_nodes: Dict[str, str] = {}
        self.alarm_nodes: Dict[str, str] = {}

    def reload_nodes(self, monitored: Dict[str, str], alarms: Dict[str, str]):
        """Hot-reload node maps from DB (called by main after DB init or after config change)."""
        self.monitored_nodes = monitored
        self.alarm_nodes     = alarms
        logger.info(f"Node maps reloaded: {len(monitored)} process, {len(alarms)} alarm nodes")

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    async def start(self):
        if self._running:
            return
        logger.info(f"Starting OPC-UA poller → {self.endpoint_url}")
        self._running = True
        self._start_time = time.time()
        await self._ensure_connected()
        self._polling_task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        logger.info("Stopping OPC-UA poller…")
        self._running = False
        if self._polling_task:
            self._polling_task.cancel()
            try:
                await self._polling_task
            except asyncio.CancelledError:
                pass
        if self.client:
            try:
                if self.subscription:
                    await self.subscription.delete()
            except Exception:
                pass
            await self._safe_disconnect()
            logger.info("Disconnected from OPC-UA server")

    # ── Public API ─────────────────────────────────────────────────────────────

    async def get_latest(self, timeout: float = 2.0) -> Optional[OPCUASnapshot]:
        start = time.time()
        while (time.time() - start) < timeout:
            async with self._data_lock:
                if self.latest_data:
                    return self.latest_data
            await asyncio.sleep(0.05)
        return None

    async def is_connected(self) -> bool:
        return self._connected

    def get_error_count(self) -> int:
        return self._consecutive_errors

    def get_uptime(self) -> float:
        return time.time() - self._start_time

    def get_node_names(self) -> Dict[str, List[str]]:
        return {
            "process": list(self.monitored_nodes.keys()),
            "alarms":  list(self.alarm_nodes.keys()),
        }

    async def get_status(self) -> Dict[str, Any]:
        server_state = None
        namespace_count = 0
        if self.client and self._connected:
            try:
                state_node = self.client.get_node("i=2259")
                server_state = await state_node.read_value()
                ns_array = await self.client.get_namespace_array()
                namespace_count = len(ns_array)
            except Exception:
                pass
        return {
            "connected": self._connected,
            "endpoint_url": self.endpoint_url,
            "security_mode": self.security_mode,
            "poll_interval_ms": int(self.poll_interval * 1000),
            "server_state": str(server_state) if server_state is not None else None,
            "namespace_count": namespace_count,
            "consecutive_errors": self._consecutive_errors,
            "last_successful_read": self._last_successful_read,
            "total_reads": self._total_reads,
            "total_writes": self._total_writes,
            "subscription_active": self.subscription is not None,
            "uptime_seconds": round(self.get_uptime(), 1),
        }

    async def get_statistics(self) -> Dict[str, Any]:
        times = self._read_times
        return {
            "total_reads": self._total_reads,
            "total_writes": self._total_writes,
            "successful_reads": self._successful_reads,
            "failed_reads": self._failed_reads,
            "subscription_updates": self._subscription_updates,
            "avg_read_time_ms": round(sum(times) / len(times), 2) if times else 0,
            "min_read_time_ms": round(min(times), 2) if times else 0,
            "max_read_time_ms": round(max(times), 2) if times else 0,
            "uptime_seconds": round(self.get_uptime(), 1),
            "queue_size": 1 if self.latest_data else 0,
        }

    async def write_value(self, node_id: str, value: Any,
                          data_type: Optional[str] = None) -> bool:
        if not await self._ensure_connected():
            return False
        try:
            node = self.client.get_node(node_id)
            if data_type == "Boolean":
                value = bool(value)
            elif data_type in ("Int16", "Int32"):
                value = int(value)
            elif data_type in ("Float", "Double"):
                value = float(value)
            await node.write_value(value)
            self._total_writes += 1
            logger.info(f"Wrote {value} → {node_id}")
            return True
        except Exception as e:
            logger.error(f"Write error: {e}")
            return False

    async def read_node(self, node_id: str) -> Any:
        if not await self._ensure_connected():
            raise ConnectionError("Not connected to OPC-UA server")
        node = self.client.get_node(node_id)
        return await node.read_value()

    async def browse_nodes(self, parent_node_id: str) -> List[Dict[str, Any]]:
        if not await self._ensure_connected():
            raise ConnectionError("Not connected to OPC-UA server")
        parent = self.client.get_node(parent_node_id)
        children = await parent.get_children()
        result = []
        for child in children:
            try:
                browse_name = await child.read_browse_name()
                node_class  = await child.read_node_class()
                value = None
                if node_class == ua.NodeClass.Variable:
                    try:
                        value = str(await child.read_value())
                    except Exception:
                        value = "N/A"
                result.append({
                    "node_id":    child.nodeid.to_string(),
                    "browse_name": browse_name.Name,
                    "node_class":  str(node_class),
                    "value":       value,
                })
            except Exception as e:
                logger.debug(f"Browse child error: {e}")
        return result

    async def query_timeseries(
        self,
        measurement: str,
        node: str,
        from_ts: float,
        to_ts: float,
        limit: int = 1000,
    ) -> List[Dict[str, Any]]:
        if not self._influx:
            raise RuntimeError("InfluxDB not configured")
        tag_key = "node_name" if measurement == "process_data" else "alarm_name"
        return await self._influx.query(measurement, node, tag_key, from_ts, to_ts, limit)

    # ── Internal ───────────────────────────────────────────────────────────────

    async def _safe_disconnect(self):
        """Disconnect with a hard timeout so the poll loop never hangs."""
        if not self.client:
            return
        try:
            await asyncio.wait_for(self.client.disconnect(), timeout=5.0)
        except Exception:
            pass
        finally:
            self.client = None

    async def _ensure_connected(self) -> bool:
        if self.client and self._connected:
            return True
        try:
            logger.info(f"Connecting → {self.endpoint_url}")
            # watchdog_intervall=30: extend the internal keepalive to 30 s so it
            # doesn't fire during a normal poll cycle. We handle reconnection
            # ourselves in _poll_loop.
            self.client = Client(url=self.endpoint_url, timeout=10, watchdog_intervall=30)
            if self.username and self.password:
                self.client.set_user(self.username)
                self.client.set_password(self.password)
            await self.client.connect()
            namespaces = await self.client.get_namespace_array()
            logger.info(f"Connected. Namespaces: {namespaces}")
            self._connected = True
            return True
        except Exception as e:
            logger.error(f"OPC-UA connection failed: {e}")
            self._connected = False
            await self._safe_disconnect()
            return False

    async def _poll_loop(self):
        logger.info("Poll loop started")
        while self._running:
            loop_start = time.time()
            try:
                if not await self._ensure_connected():
                    await asyncio.sleep(self.poll_interval)
                    continue

                t0 = time.time()
                process_data, alarm_data = await self._read_all_nodes()
                read_ms = (time.time() - t0) * 1000

                self._read_times.append(read_ms)
                if len(self._read_times) > 1000:
                    self._read_times = self._read_times[-1000:]

                combined = {**process_data, **alarm_data}
                snapshot = OPCUASnapshot(
                    timestamp=time.time(),
                    data=combined,
                    alarm_data=alarm_data,
                    read_time_ms=round(read_ms, 2),
                )
                async with self._data_lock:
                    self.latest_data = snapshot

                # Persist to InfluxDB
                if self._influx:
                    try:
                        await self._influx.write_process(snapshot.timestamp, process_data)
                        await self._influx.write_alarms(snapshot.timestamp, alarm_data)
                    except Exception as e:
                        logger.warning(f"InfluxDB write error: {e}")

                self._total_reads += 1
                self._successful_reads += 1
                self._consecutive_errors = 0
                self._last_successful_read = time.time()
                self._connected = True

            except Exception as e:
                self._consecutive_errors += 1
                self._failed_reads += 1
                logger.error(f"Poll error #{self._consecutive_errors}: {e}")
                self._connected = False
                await self._safe_disconnect()

            elapsed = time.time() - loop_start
            await asyncio.sleep(max(0, self.poll_interval - elapsed))
        logger.info("Poll loop stopped")

    async def _read_all_nodes(self) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        process_data: Dict[str, Any] = {}
        alarm_data:   Dict[str, Any] = {}

        for name, node_id in self.monitored_nodes.items():
            try:
                node = self.client.get_node(node_id)
                val  = await node.read_value()
                process_data[name] = val if isinstance(val, (int, float, bool, str)) else str(val)
            except Exception as e:
                logger.debug(f"Read process node {name} failed: {e}")
                process_data[name] = None

        for name, node_id in self.alarm_nodes.items():
            try:
                node = self.client.get_node(node_id)
                val  = await node.read_value()
                alarm_data[name] = bool(val) if val is not None else None
            except Exception as e:
                logger.debug(f"Read alarm node {name} failed: {e}")
                alarm_data[name] = None

        return process_data, alarm_data
