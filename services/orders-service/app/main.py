from fastapi import FastAPI
from shared.python_common.observability import metrics_router
from .settings import Settings

settings = Settings()
app = FastAPI(title=settings.app_name)

@app.get("/health")
@app.get("/orders/health")
def health():
    return {"status": "ok", "service": settings.app_name}

@app.get("/orders")
def list_orders():
    return [
        {"id": 1001, "customer": "ACME Kft.", "status": "open"},
        {"id": 1002, "customer": "BRD Papír Kft.", "status": "released"},
    ]

app.include_router(metrics_router(settings.app_name))
