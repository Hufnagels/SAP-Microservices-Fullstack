import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .settings import Settings
from . import database, security
from .routes.lot import router as lot_router

logging.basicConfig(level=logging.INFO)

settings = Settings()

app = FastAPI(title="LOTGEN Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.getLogger("lotgen").exception("Unhandled error")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )

app.include_router(lot_router)


@app.on_event("startup")
def on_startup():
    database.init(settings.postgres_url)
    security.configure(settings.jwt_secret, settings.jwt_algo)
    logging.getLogger("lotgen").info("LOTGEN backend started")
