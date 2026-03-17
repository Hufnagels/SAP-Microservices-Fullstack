from fastapi import APIRouter
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

REQUEST_COUNTER = Counter("app_requests_total", "Total requests", ["service"])

def metrics_router(service_name: str) -> APIRouter:
    router = APIRouter()

    @router.get("/metrics")
    def metrics():
        REQUEST_COUNTER.labels(service=service_name).inc()
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    return router
