"""
OPC-UA Service — S7-1500 real-time data via OPC-UA protocol.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .settings import Settings
from . import security, database
from .client import OPCUAPoller, InfluxWriter
from .routes.opcua import router as opcua_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("opcua-service")

settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    security.configure(
        jwt_secret=settings.jwt_secret,
        jwt_algo=settings.jwt_algo,
    )

    database.configure(settings.postgres_url)

    influx = InfluxWriter(
        url=settings.influxdb_url,
        token=settings.influxdb_token,
        org=settings.influxdb_org,
        bucket=settings.influxdb_bucket,
    )

    poller = OPCUAPoller(
        endpoint_url=settings.opcua_endpoint,
        username=settings.opcua_username or None,
        password=settings.opcua_password or None,
        security_mode=settings.opcua_security_mode,
        poll_interval_ms=settings.poll_interval_ms,
        influx=influx,
    )
    app.state.poller = poller

    # Load node definitions from DB
    process_nodes, alarm_nodes = database.build_node_maps()
    poller.reload_nodes(process_nodes, alarm_nodes)

    log.info(f"Starting OPC-UA poller → {settings.opcua_endpoint}")
    await poller.start()

    yield

    log.info("Shutting down OPC-UA poller…")
    await poller.stop()
    await influx.close()


app = FastAPI(
    title="OPC-UA Service",
    description="Real-time S7-1500 PLC data via OPC-UA",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(opcua_router)
