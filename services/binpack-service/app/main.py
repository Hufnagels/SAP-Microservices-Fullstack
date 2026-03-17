from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import json
import math
import os

from .models import (
    LayerRequest, LayerResponse, CirclePosition,
    PackageRequest, PackageResponse,
    StackRequest,
    RobotTemplateRequest, RobotTemplateResponse, RobotPick,
    BoundingBox,
)
from .packing import pack_circles_in_rectangle, group_into_packages, stack_layers, trim_to_divisible, package_dimensions


app = FastAPI(
    title="3D Bin Packing Backend",
    description="Endpoints to compute layer circle packing and package grouping.",
    version="0.2.0",
)

# items.json is copied into the image at /app/data/items.json
# Override with ITEMS_PATH env var if needed.
ITEMS_PATH = Path(os.getenv("ITEMS_PATH", Path(__file__).resolve().parent.parent / "data" / "items.json"))


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/items")
async def get_items():
    if not ITEMS_PATH.exists():
        raise HTTPException(status_code=404, detail="items.json not found")
    with open(ITEMS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return JSONResponse(content=data)


@app.post("/optimize-layer", response_model=LayerResponse)
async def optimize_layer(req: LayerRequest):
    if req.roll_diameter <= 0:
        raise HTTPException(status_code=400, detail="roll_diameter must be positive")
    if req.pallet_width <= 0 or req.pallet_length <= 0:
        raise HTTPException(status_code=400, detail="pallet dimensions must be positive")

    r = req.roll_diameter / 2.0
    if req.overhang:
        pack_width = req.pallet_width + r
        pack_length = req.pallet_length + r
    else:
        pack_width = req.pallet_width
        pack_length = req.pallet_length

    centers = pack_circles_in_rectangle(
        pack_width,
        pack_length,
        req.roll_diameter,
        req.tolerance_mm or 0.0,
        req.compression_mm or 0.0,
        req.packing_mode or "hexagonal",
    )
    if req.pack_size and req.pack_size > 0:
        centers = trim_to_divisible(centers, req.pack_size)

    if centers:
        xs0 = [c[0] for c in centers]
        ys0 = [c[1] for c in centers]
        cx_mid = (min(xs0) + max(xs0)) / 2.0
        cy_mid = (min(ys0) + max(ys0)) / 2.0
    else:
        cx_mid = req.pallet_width / 2.0
        cy_mid = req.pallet_length / 2.0
    centered = [(cx - cx_mid, cy - cy_mid) for (cx, cy) in centers]

    bbox: BoundingBox | None = None
    if centered:
        xs = [c[0] for c in centered]
        ys = [c[1] for c in centered]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        bbox = BoundingBox(
            min_x=min_x - r,
            min_y=min_y - r,
            max_x=max_x + r,
            max_y=max_y + r,
            width=max_x - min_x + 2 * r,
            height=max_y - min_y + 2 * r,
            center_x=(min_x + max_x) / 2.0,
            center_y=(min_y + max_y) / 2.0,
        )

    positions = [CirclePosition(x=float(c[0]), y=float(c[1])) for c in centered]
    return LayerResponse(count=len(positions), positions=positions, bbox=bbox)


@app.get("/package-dimensions")
async def get_package_dimensions(pack_size: int, roll_diameter: float):
    if pack_size <= 0 or roll_diameter <= 0:
        raise HTTPException(status_code=400, detail="pack_size and roll_diameter must be positive")
    return package_dimensions(pack_size, roll_diameter)


@app.post("/stack-layers")
async def create_stacked_layers(req: StackRequest):
    base = [(p.x, p.y) for p in req.base_layer_positions]
    layers = stack_layers(base, req.roll_height, req.bin_max_height, req.layer_offset_rule)
    return {
        "layers": [
            [[float(x), float(y), float(z)] for (x, y, z) in layer]
            for layer in layers
        ]
    }


@app.post("/robot-template", response_model=RobotTemplateResponse)
async def robot_template(req: RobotTemplateRequest):
    clearance = req.pick_z_clearance or 0.0
    picks = []
    for layer in req.layers:
        for pos in layer:
            if len(pos) < 2:
                continue
            x = float(pos[0])
            y = float(pos[1])
            z = float(pos[2]) + clearance if len(pos) > 2 else clearance
            picks.append(RobotPick(x=x, y=y, z=z))

    import datetime
    total = len(picks)
    lines = [
        "; === BinPack KUKA Palletizing Template ===",
        f"; Generated : {datetime.date.today().isoformat()}",
        f"; Total picks: {total}",
        f"; Layers     : {len(req.layers)}",
        f"; Z clearance: {clearance:.1f} mm",
        "",
        "&ACCESS RVO",
        "&REL 1",
        "",
        "DEF PALLETIZE_TEMPLATE()",
        "INI",
        "",
        "  PTP HOME Vel=20 % DEFAULT",
        "",
    ]
    pick_num = 1
    for layer_idx, layer in enumerate(req.layers):
        if not layer:
            continue
        base_z = float(layer[0][2]) if len(layer[0]) > 2 else 0.0
        lines.append(f"  ; --- Layer {layer_idx + 1} (base Z = {base_z:.1f} mm) ---")
        for pos in layer:
            if len(pos) < 2:
                continue
            px = float(pos[0])
            py = float(pos[1])
            pz = float(pos[2]) if len(pos) > 2 else 0.0
            approach_z = pz + clearance
            lines += [
                f"  ; Pick {pick_num}",
                f"  PTP {{X {px:.3f}, Y {py:.3f}, Z {approach_z:.3f}, A 0.0, B 0.0, C 0.0}} Vel=50 % DEFAULT  ; approach",
                f"  LIN {{X {px:.3f}, Y {py:.3f}, Z {pz:.3f}, A 0.0, B 0.0, C 0.0}} Vel=0.3 m/s DEFAULT  ; pick pos",
                "  ; [GRIPPER CLOSE]",
                f"  LIN {{X {px:.3f}, Y {py:.3f}, Z {approach_z:.3f}, A 0.0, B 0.0, C 0.0}} Vel=0.3 m/s DEFAULT  ; retract",
                "  ; [PLACE LOGIC HERE]",
                "",
            ]
            pick_num += 1
    lines += [
        "  PTP HOME Vel=20 % DEFAULT",
        "",
        "END",
    ]
    krl_program = "\n".join(lines)

    return RobotTemplateResponse(picks=picks, krl_program=krl_program)


@app.post("/package", response_model=PackageResponse)
async def create_packages(req: PackageRequest):
    if req.pack_size <= 0:
        raise HTTPException(status_code=400, detail="pack_size must be positive")

    positions = [(p.x, p.y) for p in req.layer_positions]
    weights = req.weights if req.weights and len(req.weights) == len(positions) else None
    idx_groups = group_into_packages(positions, req.pack_size, weights=weights, max_pack_weight=req.max_pack_weight)

    if req.roll_diameter and req.roll_diameter > 0:
        r = req.roll_diameter / 2.0
    else:
        min_sep = float("inf")
        n = len(positions)
        for i in range(n):
            xi, yi = positions[i]
            for j in range(i + 1, n):
                d = math.hypot(xi - positions[j][0], yi - positions[j][1])
                if d > 1e-9 and d < min_sep:
                    min_sep = d
        r = min_sep / 2.0 if min_sep != float("inf") else 0.0

    pw2 = req.pallet_width / 2.0
    pl2 = req.pallet_length / 2.0

    pkg_models = []
    for group in idx_groups:
        group_pos = [positions[i] for i in group]
        if group_pos:
            xs = [pt[0] for pt in group_pos]
            ys = [pt[1] for pt in group_pos]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            bbox = {
                "min_x": min_x - r - pw2,
                "min_y": min_y - r - pl2,
                "max_x": max_x + r - pw2,
                "max_y": max_y + r - pl2,
                "width": max_x - min_x + 2 * r,
                "height": max_y - min_y + 2 * r,
                "center_x": (min_x + max_x) / 2.0 - pw2,
                "center_y": (min_y + max_y) / 2.0 - pl2,
            }
        else:
            bbox = None
        pkg_models.append({"size": len(group), "indices": group, "bbox": bbox})

    return PackageResponse(packages=pkg_models)
