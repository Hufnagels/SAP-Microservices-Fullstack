from pydantic import BaseModel, Field, model_validator, field_validator
from typing import List, Optional
import math

# ── Package boundary conditions (docs/Binpack.md, updated 2026-03-12) ─────────
PKG_WIDTH_MIN_MM  = 220.0   # short side minimum [mm]
PKG_WIDTH_MAX_MM  = 500.0   # short side maximum [mm]
PKG_LENGTH_MIN_MM = 240.0   # long side minimum [mm]
PKG_LENGTH_MAX_MM = 700.0   # long side maximum [mm]
PKG_WEIGHT_MIN_KG = 2.0     # minimum total package weight (kg)
PKG_WEIGHT_MAX_KG = 8.0     # maximum total package weight (kg)
BIN_HEIGHT_MIN_MM = 2150.0  # pallet netto height minimum [mm]
BIN_HEIGHT_MAX_MM = 2500.0  # pallet netto height maximum [mm]


def _best_rect(n: int):
    """Smallest-diff rows×cols factorisation (mirrors packing.best_rectangular_arrangement)."""
    if n <= 0:
        return (1, 1)
    best_r, best_c, best_d = 1, n, n - 1
    for r in range(1, int(math.isqrt(n)) + 1):
        if n % r == 0:
            c = n // r
            d = abs(c - r)
            if d < best_d:
                best_d, best_r, best_c = d, r, c
    return (min(best_r, best_c), max(best_r, best_c))


class LayerRequest(BaseModel):
    pallet_width: float = Field(..., description="Pallet X dimension in mm")
    pallet_length: float = Field(..., description="Pallet Y dimension in mm")
    roll_diameter: float = Field(..., description="Roll diameter in mm")
    roll_height: Optional[float] = Field(None, description="Roll height in mm (used for stacking)")
    roll_weight: Optional[float] = Field(None, description="Roll weight (kg)")
    tolerance_mm: Optional[float] = Field(0.0, description="Manufacturing tolerance — reduces effective diameter (mm)")
    compression_mm: Optional[float] = Field(0.0, description="Compression allowance — reduces effective diameter (mm)")
    packing_mode: Optional[str] = Field("hexagonal", description="Packing mode: 'hexagonal' or 'square'")
    overhang: Optional[bool] = Field(True, description="Allow rolls to overhang pallet edge by roll_diameter/2 (per spec)")
    pack_size: Optional[int] = Field(None, description="If provided, trim pallet roll count to be divisible by this value")

    @model_validator(mode="after")
    def validate_package_bounds(self) -> "LayerRequest":
        ps, d, w = self.pack_size, self.roll_diameter, self.roll_weight
        if ps and ps > 0 and d and d > 0:
            rows, cols = _best_rect(ps)
            short_mm = min(rows, cols) * d
            long_mm  = max(rows, cols) * d
            if not (PKG_WIDTH_MIN_MM <= short_mm <= PKG_WIDTH_MAX_MM):
                raise ValueError(
                    f"Package short side {short_mm:.1f} mm outside allowed range "
                    f"[{PKG_WIDTH_MIN_MM:.0f}–{PKG_WIDTH_MAX_MM:.0f}] mm "
                    f"(pack_size={ps}, roll_diameter={d} mm)"
                )
            if not (PKG_LENGTH_MIN_MM <= long_mm <= PKG_LENGTH_MAX_MM):
                raise ValueError(
                    f"Package long side {long_mm:.1f} mm outside allowed range "
                    f"[{PKG_LENGTH_MIN_MM:.0f}–{PKG_LENGTH_MAX_MM:.0f}] mm"
                )
        if ps and ps > 0 and w and w > 0:
            total_kg = ps * w
            if not (PKG_WEIGHT_MIN_KG <= total_kg <= PKG_WEIGHT_MAX_KG):
                raise ValueError(
                    f"Package weight {total_kg:.2f} kg outside allowed range "
                    f"[{PKG_WEIGHT_MIN_KG:.0f}–{PKG_WEIGHT_MAX_KG:.0f}] kg"
                )
        return self


class CirclePosition(BaseModel):
    x: float
    y: float


class BoundingBox(BaseModel):
    min_x: float
    min_y: float
    max_x: float
    max_y: float
    width: float
    height: float
    center_x: float
    center_y: float


class LayerResponse(BaseModel):
    count: int
    positions: List[CirclePosition]
    bbox: Optional[BoundingBox] = None


class PackageGroup(BaseModel):
    size: int
    indices: List[int]
    bbox: Optional[BoundingBox] = None


class PackageRequest(BaseModel):
    layer_positions: List[CirclePosition]
    roll_diameter: Optional[float] = Field(None, description="Roll diameter used to compute package geometry; inferred from positions if omitted")
    pack_size: int = Field(..., description="Number of rolls per package")
    weights: Optional[List[float]] = Field(None, description="Per-roll weights (kg)")
    max_pack_weight: Optional[float] = Field(None, description="Maximum weight per package (kg)")
    pallet_width: float = Field(800.0, description="Pallet width in mm — used to center bbox on pallet origin")
    pallet_length: float = Field(1200.0, description="Pallet length in mm — used to center bbox on pallet origin")


class PackageResponse(BaseModel):
    packages: List[PackageGroup]


class StackRequest(BaseModel):
    base_layer_positions: List[CirclePosition]
    roll_height: float = Field(..., description="Height of a roll in mm")
    bin_max_height: float = Field(..., description="Total stack height in mm (= pkg_layers_on_pallet × layers_in_package × roll_height)")
    layer_offset_rule: Optional[float] = Field(None, description="Horizontal X offset between alternating layers (mm); defaults to roll_diameter/2 inferred from position spacing")


class RobotPick(BaseModel):
    x: float
    y: float
    z: float


class RobotTemplateRequest(BaseModel):
    layers: List[List[List[float]]] = Field(
        ...,
        description="List of layers; each layer is a list of [x, y, z] coordinate triples"
    )
    pick_z_clearance: Optional[float] = Field(10.0, description="Z clearance for robot approach in mm")


class RobotTemplateResponse(BaseModel):
    picks: List[RobotPick]
    krl_program: str = ""
