from fastapi import FastAPI
from shared.python_common.observability import metrics_router
from .settings import Settings

settings = Settings()
app = FastAPI(title=settings.app_name)

@app.get("/health")
@app.get("/reporting/health")
def health():
    return {"status": "ok", "service": settings.app_name}

@app.get("/reporting/production/daily")
def daily_report():
    return {
        "date": "2026-03-08",
        "lines": [
            {"line": "LINE_1", "pallets": 112},
            {"line": "LINE_2", "pallets": 97},
        ]
    }

app.include_router(metrics_router(settings.app_name))
