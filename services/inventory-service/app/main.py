from fastapi import FastAPI
from shared.python_common.observability import metrics_router
from .settings import Settings

settings = Settings()
app = FastAPI(title=settings.app_name)

@app.get("/health")
@app.get("/inventory/health")
def health():
    return {"status": "ok", "service": settings.app_name}

@app.get("/inventory")
def inventory():
    return [
        {"item_code": "TOWEL-V", "on_hand": 1200},
        {"item_code": "ROLL-MIDI", "on_hand": 850},
    ]

app.include_router(metrics_router(settings.app_name))
