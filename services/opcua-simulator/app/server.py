"""
OPC-UA Simulator — Siemens S7-1500 stand-in for development/testing.

Reads node definitions and simulation behaviors from opcua_db (postgres-opcua).
Supported sim_behavior values:
  sine         — sinusoidal oscillation between sim_min and sim_max
  random_walk  — random walk clamped to [sim_min, sim_max]
  random       — uniform random in [sim_min, sim_max]
  sawtooth     — linear ramp from sim_min to sim_max, then reset (period = sim_period s)
  constant     — fixed value = sim_min
  step         — toggles between sim_min and sim_max every sim_period/2 seconds
  threshold    — alarm: True when linked process node crosses sim_max
"""
import asyncio
import logging
import math
import os
import random
import time
from dataclasses import dataclass, field
from typing import Any

import psycopg2
import psycopg2.extras
from asyncua import Server, ua

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("opcua-simulator")

ENDPOINT     = os.getenv("SIM_ENDPOINT",    "opc.tcp://0.0.0.0:4840")
INTERVAL_MS  = int(os.getenv("SIM_INTERVAL_MS", "500"))
POSTGRES_URL = os.getenv("POSTGRES_URL",    "postgresql://postgres:postgres@postgres-opcua:5432/opcua_db")


# ── Load node definitions from DB ─────────────────────────────────────────────

def load_node_defs() -> list[dict]:
    try:
        conn = psycopg2.connect(POSTGRES_URL)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, name, node_id, type, sim_behavior, sim_min, sim_max, sim_period,
                       sim_ramp, sim_plateau, sim_off, is_active
                FROM node_definitions WHERE is_active = TRUE ORDER BY id
            """)
            rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        log.info(f"Loaded {len(rows)} node definitions from DB")
        return rows
    except Exception as e:
        log.warning(f"Could not load from DB ({e}), using built-in defaults")
        return _default_nodes()


def _default_nodes() -> list[dict]:
    return [
        {"id": 1, "name": "Temperature",      "node_id": "ns=2;i=2", "type": "process", "sim_behavior": "sine",        "sim_min": 18,  "sim_max": 32,  "sim_period": 60,  "is_active": True},
        {"id": 2, "name": "Pressure",          "node_id": "ns=2;i=3", "type": "process", "sim_behavior": "sine",        "sim_min": 0.8, "sim_max": 1.2, "sim_period": 90,  "is_active": True},
        {"id": 3, "name": "Flow Rate",         "node_id": "ns=2;i=4", "type": "process", "sim_behavior": "random_walk", "sim_min": 2,   "sim_max": 10,  "sim_period": 0,   "is_active": True},
        {"id": 4, "name": "Working speed",     "node_id": "ns=2;i=5", "type": "process", "sim_behavior": "trapezoidal", "sim_min": 0,   "sim_max": 500, "sim_period": 30,  "sim_ramp": 15, "sim_plateau": 60, "sim_off": 30, "is_active": True},
        {"id": 5, "name": "High Temperature",  "node_id": "ns=2;i=7", "type": "alarm",   "sim_behavior": "threshold",   "sim_min": 0,   "sim_max": 1,   "sim_period": 0,   "is_active": True},
        {"id": 6, "name": "Low Pressure",      "node_id": "ns=2;i=8", "type": "alarm",   "sim_behavior": "threshold",   "sim_min": 0,   "sim_max": 1,   "sim_period": 0,   "is_active": True},
        {"id": 7, "name": "Running",           "node_id": "ns=2;i=9", "type": "alarm",   "sim_behavior": "constant",    "sim_min": 1,   "sim_max": 1,   "sim_period": 0,   "is_active": True},
    ]


# ── Per-node simulation state ──────────────────────────────────────────────────

@dataclass
class NodeSim:
    cfg: dict
    t: float = 0.0
    _walk_val: float = field(init=False)
    _step_val: float = field(init=False)

    def __post_init__(self):
        mid = (self.cfg["sim_min"] + self.cfg["sim_max"]) / 2
        self._walk_val = mid
        self._step_val = self.cfg["sim_min"]

    def tick(self, dt: float, process_values: dict[str, float]) -> Any:
        self.t += dt
        b = self.cfg["sim_behavior"]
        lo = float(self.cfg["sim_min"])
        hi = float(self.cfg["sim_max"])
        period = float(self.cfg["sim_period"]) or 30.0

        if self.cfg["type"] == "alarm":
            return self._alarm_tick(process_values, lo, hi)

        if b == "sine":
            mid = (lo + hi) / 2
            amp = (hi - lo) / 2
            return round(mid + amp * math.sin(2 * math.pi * self.t / period), 4)

        if b == "random_walk":
            step = (hi - lo) * 0.01
            self._walk_val += random.gauss(0, step)
            self._walk_val = max(lo, min(hi, self._walk_val))
            return round(self._walk_val, 4)

        if b == "random":
            return round(random.uniform(lo, hi), 4)

        if b == "sawtooth":
            phase = (self.t % period) / period   # 0 → 1
            return round(lo + (hi - lo) * phase, 4)

        if b == "trapezoidal":
            # Asymmetric phases; fall back to equal quarters if columns absent
            ramp    = float(self.cfg.get("sim_ramp")    or period)
            plateau = float(self.cfg.get("sim_plateau") or period)
            off     = float(self.cfg.get("sim_off")     or period)
            total   = ramp + plateau + ramp + off
            t_mod   = self.t % total
            if t_mod < ramp:
                return round(lo + (hi - lo) * (t_mod / ramp), 4)
            elif t_mod < ramp + plateau:
                return round(float(hi), 4)
            elif t_mod < ramp + plateau + ramp:
                return round(hi - (hi - lo) * ((t_mod - ramp - plateau) / ramp), 4)
            else:
                return round(float(lo), 4)

        if b == "step":
            half = period / 2
            self._step_val = lo if (self.t % period) < half else hi
            return self._step_val

        if b == "constant":
            return lo

        return lo   # fallback

    def _alarm_tick(self, process_values: dict[str, float], lo: float, hi: float) -> bool:
        name = self.cfg["name"].lower()
        if "high" in name or "temp" in name:
            ref = process_values.get("temperature", 0)
            threshold = process_values.get("temperature_setpoint", 28.0)
            return float(ref) > float(threshold)
        if "low" in name or "pressure" in name:
            ref = process_values.get("pressure", 1.0)
            return float(ref) < 0.95
        if "running" in name:
            return bool(hi)
        return bool(lo)


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    node_defs = load_node_defs()
    process_defs = [n for n in node_defs if n["type"] == "process"]
    alarm_defs   = [n for n in node_defs if n["type"] == "alarm"]

    server = Server()
    await server.init()
    server.set_endpoint(ENDPOINT)
    server.set_server_name("OPC-UA Simulator")
    server.set_security_policy([ua.SecurityPolicyType.NoSecurity])

    uri = "urn:brd:simulator"
    idx = await server.register_namespace(uri)
    log.info(f"Namespace index: {idx}")

    objects = server.nodes.objects
    db_process = await objects.add_object(idx, "DB_ProcessData")
    db_alarms  = await objects.add_object(idx, "DB_Alarms")

    # Create OPC-UA variable nodes and sync the real node_ids back to DB
    opc_nodes: dict[int, Any] = {}
    sims: dict[int, NodeSim] = {}
    node_id_updates: list[tuple[str, int]] = []

    for nd in process_defs:
        mid = (nd["sim_min"] + nd["sim_max"]) / 2
        opc_node = await db_process.add_variable(idx, nd["name"], float(mid), ua.VariantType.Float)
        await opc_node.set_writable()
        opc_nodes[nd["id"]] = opc_node
        sims[nd["id"]] = NodeSim(cfg=nd)
        actual_id = opc_node.nodeid.to_string()
        node_id_updates.append((actual_id, nd["id"]))
        log.info(f"  Process node: {nd['name']}  [{nd['sim_min']}–{nd['sim_max']}]  behavior={nd['sim_behavior']}  node_id={actual_id}")

    for nd in alarm_defs:
        opc_node = await db_alarms.add_variable(idx, nd["name"], False, ua.VariantType.Boolean)
        await opc_node.set_writable()
        opc_nodes[nd["id"]] = opc_node
        sims[nd["id"]] = NodeSim(cfg=nd)
        actual_id = opc_node.nodeid.to_string()
        node_id_updates.append((actual_id, nd["id"]))
        log.info(f"  Alarm node:   {nd['name']}  behavior={nd['sim_behavior']}  node_id={actual_id}")

    # Write actual node IDs back to DB so opcua-service always reads the right nodes
    try:
        conn = psycopg2.connect(POSTGRES_URL)
        with conn.cursor() as cur:
            for actual_id, db_id in node_id_updates:
                cur.execute("UPDATE node_definitions SET node_id = %s WHERE id = %s", (actual_id, db_id))
        conn.commit()
        conn.close()
        log.info(f"Synced {len(node_id_updates)} node IDs back to DB")
    except Exception as e:
        log.warning(f"Could not sync node IDs to DB: {e}")

    interval   = INTERVAL_MS / 1000.0
    reload_every = 15.0   # re-read DB config every 15 s
    last_reload  = time.time()

    async with server:
        log.info(f"OPC-UA simulator running on {ENDPOINT}  (interval={INTERVAL_MS}ms, config-reload={reload_every}s)")
        while True:
            tick_start = time.time()

            # Hot-reload config from DB periodically
            if tick_start - last_reload >= reload_every:
                fresh = load_node_defs()
                fresh_process = [n for n in fresh if n["type"] == "process"]
                fresh_alarms  = [n for n in fresh if n["type"] == "alarm"]
                for nd in fresh_process + fresh_alarms:
                    nid = nd["id"]
                    if nid in sims:
                        old_b = sims[nid].cfg["sim_behavior"]
                        sims[nid].cfg = nd
                        if old_b != nd["sim_behavior"]:
                            log.info(f"  Reloaded '{nd['name']}': {old_b} → {nd['sim_behavior']}")
                process_defs = fresh_process
                alarm_defs   = fresh_alarms
                last_reload  = tick_start

            # Tick process nodes first — alarm nodes may reference their values
            process_values: dict[str, float] = {}
            for nd in process_defs:
                val = sims[nd["id"]].tick(interval, process_values)
                process_values[nd["name"].lower().replace(" ", "_")] = float(val)
                await opc_nodes[nd["id"]].write_value(
                    ua.DataValue(ua.Variant(float(val), ua.VariantType.Float))
                )

            for nd in alarm_defs:
                val = sims[nd["id"]].tick(interval, process_values)
                await opc_nodes[nd["id"]].write_value(
                    ua.DataValue(ua.Variant(bool(val), ua.VariantType.Boolean))
                )

            elapsed = time.time() - tick_start
            await asyncio.sleep(max(0, interval - elapsed))


if __name__ == "__main__":
    asyncio.run(main())
