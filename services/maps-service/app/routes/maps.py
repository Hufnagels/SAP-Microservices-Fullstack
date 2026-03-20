"""
maps.py — All /maps/* endpoints.

Routes (no prefix strip in Traefik, so paths start with /maps):
  GET    /maps/health
  GET    /maps/history    → List[HistoryMarker]
  GET    /maps/geojson    → GeoJSON FeatureCollection
  GET    /maps/custom     → List[CustomMapItem]
  POST   /maps/custom     → CustomMapItem
  PUT    /maps/custom/:id → CustomMapItem
  DELETE /maps/custom/:id → 204
  GET    /maps/shapes     → List[StoredShape]
  POST   /maps/shapes     → List[StoredShape]  (bulk insert)
  PUT    /maps/shapes/:id → StoredShape
  DELETE /maps/shapes/:id → 204
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from .. import database as db

router = APIRouter(prefix="/maps", tags=["maps"], redirect_slashes=False)


# ── Pydantic models ───────────────────────────────────────────────────────────

class HistoryMarker(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    value: float
    change: float


class CustomMapItem(BaseModel):
    id: Optional[int] = None
    name: str
    lat: float
    lng: float
    type: str = "marker"
    description: str = ""
    boundsNE: Optional[list[float]] = None
    boundsSW: Optional[list[float]] = None


class StoredShape(BaseModel):
    id: Optional[int] = None
    name: str = ""
    type: str
    description: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius: Optional[float] = None
    boundsNE: Optional[list[float]] = None
    boundsSW: Optional[list[float]] = None
    latlngs: Optional[list[list[float]]] = None


class Partner(BaseModel):
    id: Optional[int] = None
    card_code: str
    name: str
    address: str = ""
    sales: int = 0
    lat: float
    lon: float
    synced_at: Optional[str] = None


# ── Seed data ─────────────────────────────────────────────────────────────────

_HISTORY_MARKERS: list[dict] = [
    {"id": 1,  "name": "New York",     "lat": 40.7128,  "lng": -74.0060,  "value": 3420, "change":  2.4},
    {"id": 2,  "name": "London",       "lat": 51.5074,  "lng":  -0.1278,  "value": 2870, "change": -0.8},
    {"id": 3,  "name": "Tokyo",        "lat": 35.6762,  "lng": 139.6503,  "value": 3100, "change":  1.2},
    {"id": 4,  "name": "Frankfurt",    "lat": 50.1109,  "lng":   8.6821,  "value": 1950, "change":  0.5},
    {"id": 5,  "name": "Hong Kong",    "lat": 22.3193,  "lng": 114.1694,  "value": 2200, "change": -1.3},
    {"id": 6,  "name": "Singapore",    "lat":  1.3521,  "lng": 103.8198,  "value": 1800, "change":  3.1},
    {"id": 7,  "name": "Sydney",       "lat": -33.8688, "lng": 151.2093,  "value": 1400, "change":  0.9},
    {"id": 8,  "name": "Toronto",      "lat": 43.6532,  "lng": -79.3832,  "value": 1600, "change":  1.7},
    {"id": 9,  "name": "Zürich",       "lat": 47.3769,  "lng":   8.5417,  "value": 1300, "change": -0.3},
    {"id": 10, "name": "Dubai",        "lat": 25.2048,  "lng":  55.2708,  "value": 1100, "change":  4.2},
    {"id": 11, "name": "Shanghai",     "lat": 31.2304,  "lng": 121.4737,  "value": 2600, "change":  1.8},
    {"id": 12, "name": "Paris",        "lat": 48.8566,  "lng":   2.3522,  "value": 1700, "change":  0.2},
]


_GEOJSON: dict = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "Hungary", "value": 85},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[16.2, 48.0], [22.9, 48.0], [22.9, 45.7], [16.2, 45.7], [16.2, 48.0]]]
            }
        },
        {
            "type": "Feature",
            "properties": {"name": "Austria", "value": 72},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[9.5, 46.3], [17.2, 46.3], [17.2, 49.0], [9.5, 49.0], [9.5, 46.3]]]
            }
        },
        {
            "type": "Feature",
            "properties": {"name": "Germany", "value": 91},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[6.0, 47.2], [15.0, 47.2], [15.0, 55.0], [6.0, 55.0], [6.0, 47.2]]]
            }
        },
        {
            "type": "Feature",
            "properties": {"name": "Slovakia", "value": 63},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[16.8, 47.7], [22.6, 47.7], [22.6, 49.6], [16.8, 49.6], [16.8, 47.7]]]
            }
        },
        {
            "type": "Feature",
            "properties": {"name": "Romania", "value": 55},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[22.1, 43.6], [29.7, 43.6], [29.7, 48.3], [22.1, 48.3], [22.1, 43.6]]]
            }
        },
    ]
}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "service": "maps-service"}


@router.get("/history", response_model=list[HistoryMarker])
def get_history():
    return _HISTORY_MARKERS


@router.get("/geojson")
def get_geojson():
    return _GEOJSON


# Custom items

@router.get("/custom", response_model=list[CustomMapItem])
def get_custom():
    return db.get_custom()


@router.post("/custom", response_model=CustomMapItem, status_code=201)
def create_custom(item: CustomMapItem):
    return db.insert_custom(item.model_dump(exclude={"id"}))


@router.put("/custom/{item_id}", response_model=CustomMapItem)
def put_custom(item_id: int, item: CustomMapItem):
    result = db.update_custom(item_id, item.model_dump(exclude={"id"}))
    if not result:
        raise HTTPException(status_code=404, detail="Custom item not found")
    return result


@router.delete("/custom/{item_id}", status_code=204)
def del_custom(item_id: int):
    if not db.delete_custom(item_id):
        raise HTTPException(status_code=404, detail="Custom item not found")


# Shapes

@router.get("/shapes", response_model=list[StoredShape])
def get_shapes():
    return db.get_shapes()


@router.post("/shapes", response_model=list[StoredShape], status_code=201)
def save_shapes(shapes: list[StoredShape]):
    return db.insert_shapes([s.model_dump(exclude={"id"}) for s in shapes])


@router.put("/shapes/{shape_id}", response_model=StoredShape)
def put_shape(shape_id: int, shape: StoredShape):
    result = db.update_shape(shape_id, shape.model_dump(exclude={"id"}))
    if not result:
        raise HTTPException(status_code=404, detail="Shape not found")
    return result


@router.delete("/shapes/{shape_id}", status_code=204)
def del_shape(shape_id: int):
    if not db.delete_shape(shape_id):
        raise HTTPException(status_code=404, detail="Shape not found")


# Partners

@router.get("/partners", response_model=list[Partner])
def get_partners():
    return db.get_partners()


@router.post("/partners/bulk", status_code=200)
def bulk_partners(partners: list[Partner]):
    count = db.bulk_upsert_partners([p.model_dump(exclude={"id", "synced_at"}) for p in partners])
    return {"upserted": count}
