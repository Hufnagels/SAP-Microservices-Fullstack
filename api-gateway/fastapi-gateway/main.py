from fastapi import FastAPI, Request, Response
import httpx

SERVICES = {
    "auth": "http://auth-service:8000",
    "orders": "http://orders-service:8000",
    "inventory": "http://inventory-service:8000",
    "reporting": "http://reporting-service:8000",
    "sensors": "http://sensor-ingest-service:8000",
    "sap": "http://sap-b1-adapter-service:8000",
}

app = FastAPI(title="fastapi-gateway")

async def proxy(request: Request, target_url: str):
    async with httpx.AsyncClient(timeout=60) as client:
        body = await request.body()
        resp = await client.request(
            method=request.method,
            url=target_url,
            headers=dict(request.headers),
            params=dict(request.query_params),
            content=body,
        )
        excluded = {"content-encoding", "transfer-encoding", "connection"}
        headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded}
        return Response(content=resp.content, status_code=resp.status_code, headers=headers)

@app.api_route("/{service}/{path:path}", methods=["GET","POST","PUT","PATCH","DELETE"])
async def route_service(service: str, path: str, request: Request):
    if service not in SERVICES:
        return Response(content="Unknown service", status_code=404)
    return await proxy(request, f"{SERVICES[service]}/{path}")
