from fastapi import FastAPI
from pydantic import BaseModel
from shared.python_common.observability import metrics_router
from shared.python_common.messaging import publish_json
from .settings import Settings

class SensorEvent(BaseModel):
    machine_id: str
    event: str
    product: str
    lot: str
    timestamp: str

settings = Settings()
app = FastAPI(title=settings.app_name)

@app.get("/health")
@app.get("/sensor/health")
def health():
    return {"status": "ok", "service": settings.app_name}

@app.post("/sensor/event")
def ingest(event: SensorEvent):
    payload = event.model_dump()
    publish_json(settings.rabbitmq_url, "sensor.events", "sensor.event.created", payload)
    return {"accepted": True, "payload": payload}

app.include_router(metrics_router(settings.app_name))
