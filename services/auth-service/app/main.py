"""
Auth Service — JWT + bcrypt authentication for the microservice platform.
Replaces the demo stub with real PostgreSQL-backed auth.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.python_common.observability import metrics_router
from .settings import Settings
from . import database, security
from .routes.auth import router as auth_router

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("auth-service")

settings = Settings()

app = FastAPI(title="Auth Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(metrics_router(settings.app_name))


@app.on_event("startup")
def on_startup():
    database.init_db(settings.postgres_url)
    security.configure(
        jwt_secret=settings.jwt_secret,
        jwt_algo=settings.jwt_algo,
        jwt_expire_hours=settings.jwt_expire_hours,
    )
    if settings.bootstrap_admin_username and settings.bootstrap_admin_password:
        database.bootstrap_admin(
            settings.bootstrap_admin_username,
            settings.bootstrap_admin_password,
        )
    log.info("Auth service started — DB initialized, security configured")
