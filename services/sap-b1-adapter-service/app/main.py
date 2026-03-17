"""
SAP B1 Adapter Service — syncs SAP B1 data into MSSQL ReportingDB.
Auth: stateless JWT verification (shared JWT_SECRET with auth-service).
"""
import logging
import urllib3

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.python_common.observability import metrics_router
from .settings import Settings
from . import security
from .routes import sync_router, jobs_router, queries_router

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("sap-b1-adapter")

settings = Settings()

app = FastAPI(title="SAP B1 Adapter Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sync_router)
app.include_router(jobs_router)
app.include_router(queries_router)
app.include_router(metrics_router(settings.app_name))


@app.on_event("startup")
def on_startup():
    security.configure(
        jwt_secret=settings.jwt_secret,
        jwt_algo=settings.jwt_algo,
        api_keys_json=settings.api_keys_json,
    )
    log.info("SAP B1 adapter started")
