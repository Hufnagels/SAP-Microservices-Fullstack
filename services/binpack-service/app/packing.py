import math
from typing import List, Tuple, Optional, Dict, Any


def pack_circles_in_rectangle(
    width: float,
    height: float,
    diameter: float,
    tolerance_mm: float = 0.0,
    compression_mm: float = 0.0,
    packing_mode: str = "hexagonal",
) -> List[Tuple[float, float]]:
    effective_diameter = max(1e-6, diameter - (tolerance_mm or 0.0) - (compression_mm or 0.0))
    r = effective_diameter / 2.0
    centers: List[Tuple[float, float]] = []

    if packing_mode == "square":
        y = r
        while y + r <= height + 1e-9:
            x = r
            while x + r <= width + 1e-9:
                centers.append((x, y))
                x += effective_diameter
            y += effective_diameter
    else:
        dy = r * math.sqrt(3)
        y = r
        row = 0
        while y + r <= height + 1e-9:
            x_start = r + (row % 2) * r
            x = x_start
            while x + r <= width + 1e-9:
                centers.append((x, y))
                x += effective_diameter
            row += 1
            y += dy

    centers = _gap_fill(centers, width, height, r, effective_diameter)
    return centers


def _gap_fill(
    centers: List[Tuple[float, float]],
    width: float,
    height: float,
    r: float,
    effective_diameter: float,
) -> List[Tuple[float, float]]:
    if not centers:
        return centers

    step = r / 2.0
    bucket = _build_bucket(centers, effective_diameter)

    probe_y = r
    while probe_y + r <= height + 1e-9:
        probe_x = r
        while probe_x + r <= width + 1e-9:
            if not _overlaps(probe_x, probe_y, centers, bucket, effective_diameter, effective_diameter):
                centers.append((probe_x, probe_y))
                key = (int(probe_x / effective_diameter), int(probe_y / effective_diameter))
                bucket.setdefault(key, []).append(len(centers) - 1)
            probe_x += step
        probe_y += step

    return centers


def _build_bucket(
    centers: List[Tuple[float, float]], cell_size: float
) -> dict:
    bucket: dict = {}
    for i, (x, y) in enumerate(centers):
        key = (int(x / cell_size), int(y / cell_size))
        bucket.setdefault(key, []).append(i)
    return bucket


def _overlaps(
    px: float,
    py: float,
    centers: List[Tuple[float, float]],
    bucket: dict,
    min_sep: float,
    cell_size: float,
) -> bool:
    cx = int(px / cell_size)
    cy = int(py / cell_size)
    for dcx in (-1, 0, 1):
        for dcy in (-1, 0, 1):
            for idx in bucket.get((cx + dcx, cy + dcy), []):
                ox, oy = centers[idx]
                if math.hypot(px - ox, py - oy) < min_sep - 1e-9:
                    return True
    return False


def _col_key(x: float, half_sep: float) -> int:
    return int(x / half_sep + 0.5)


def _group_with_orientation(
    col_map: Dict[int, List[Tuple[float, int]]],
    sorted_col_keys: List[int],
    rows_per_pkg: int,
    cols_per_pkg: int,
) -> List[List[int]]:
    packages: List[List[int]] = []
    num_cols = len(sorted_col_keys)

    for col_start in range(0, num_cols, cols_per_pkg):
        col_group = sorted_col_keys[col_start: col_start + cols_per_pkg]
        if len(col_group) < cols_per_pkg:
            break

        n_rows_available = min(len(col_map[k]) for k in col_group)

        for row_start in range(0, n_rows_available, rows_per_pkg):
            if row_start + rows_per_pkg > n_rows_available:
                break

            pkg: List[int] = []
            for k in col_group:
                for row_idx in range(row_start, row_start + rows_per_pkg):
                    _, pos_idx = col_map[k][row_idx]
                    pkg.append(pos_idx)
            packages.append(pkg)

    return packages


def group_into_packages(
    positions: List[Tuple[float, float]],
    pack_size: int,
    weights: Optional[List[float]] = None,
    max_pack_weight: Optional[float] = None,
) -> List[List[int]]:
    n = len(positions)
    if n == 0:
        return []
    if pack_size <= 1:
        return [[i] for i in range(n)]

    rows_per_pkg, cols_per_pkg = best_rectangular_arrangement(pack_size)

    min_sep = _compute_min_sep(positions)
    if min_sep == float("inf"):
        return [[0]]

    half_sep = min_sep / 2.0

    col_map: Dict[int, List[Tuple[float, int]]] = {}
    for i, (x, y) in enumerate(positions):
        key = _col_key(x, half_sep)
        col_map.setdefault(key, []).append((y, i))

    sorted_col_keys = sorted(col_map.keys())
    for k in sorted_col_keys:
        col_map[k].sort()

    pkgs_a = _group_with_orientation(col_map, sorted_col_keys, rows_per_pkg, cols_per_pkg)
    if rows_per_pkg == cols_per_pkg:
        return pkgs_a

    pkgs_b = _group_with_orientation(col_map, sorted_col_keys, cols_per_pkg, rows_per_pkg)
    return pkgs_a if len(pkgs_a) >= len(pkgs_b) else pkgs_b


def _compute_min_sep(positions: List[Tuple[float, float]]) -> float:
    if len(positions) < 2:
        return float("inf")

    xs = [p[0] for p in positions]
    ys = [p[1] for p in positions]
    span = max(max(xs) - min(xs), max(ys) - min(ys), 1.0)
    cell_size = span / max(math.sqrt(len(positions)), 1.0)

    bucket: dict = {}
    for i, (x, y) in enumerate(positions):
        key = (int(x / cell_size), int(y / cell_size))
        bucket.setdefault(key, []).append(i)

    min_sep = float("inf")
    for i, (xi, yi) in enumerate(positions):
        cx = int(xi / cell_size)
        cy = int(yi / cell_size)
        for dcx in (-2, -1, 0, 1, 2):
            for dcy in (-2, -1, 0, 1, 2):
                for j in bucket.get((cx + dcx, cy + dcy), []):
                    if j <= i:
                        continue
                    d = math.hypot(xi - positions[j][0], yi - positions[j][1])
                    if d > 1e-9 and d < min_sep:
                        min_sep = d

    return min_sep


def stack_layers(
    base_positions: List[Tuple[float, float]],
    roll_height: float,
    bin_max_height: float,
    layer_offset: Optional[float] = None,
) -> List[List[Tuple[float, float, float]]]:
    layers: List[List[Tuple[float, float, float]]] = []
    if roll_height <= 0:
        return layers
    num_layers = int(bin_max_height // roll_height)
    if num_layers <= 0:
        return layers

    if layer_offset is None:
        if len(base_positions) >= 2:
            layer_offset = abs(base_positions[1][0] - base_positions[0][0]) / 2.0
        else:
            layer_offset = 0.0

    for layer_idx in range(num_layers):
        z = layer_idx * roll_height + roll_height / 2.0
        offset_x = (layer_idx % 2) * layer_offset
        layer = [(x + offset_x, y, z) for (x, y) in base_positions]
        layers.append(layer)

    return layers


def _trim_with_orientation(
    centers: List[Tuple[float, float]],
    col_map: Dict[int, List[Tuple[float, int]]],
    sorted_col_keys: List[int],
    rows_per_pkg: int,
    cols_per_pkg: int,
) -> List[Tuple[float, float]]:
    nc = len(sorted_col_keys)
    target_nc = (nc // cols_per_pkg) * cols_per_pkg
    if target_nc == 0:
        return []
    cols_to_remove = nc - target_nc
    left_remove = cols_to_remove // 2
    right_remove = cols_to_remove - left_remove
    keep_col_keys = sorted_col_keys[
        left_remove: (nc - right_remove) if right_remove > 0 else nc
    ]

    min_height = min(len(col_map[k]) for k in keep_col_keys)
    target_height = (min_height // rows_per_pkg) * rows_per_pkg
    if target_height == 0:
        return []

    result: List[Tuple[float, float]] = []
    for k in keep_col_keys:
        circles = col_map[k]
        excess = len(circles) - target_height
        top_trim = excess // 2
        bottom_trim = excess - top_trim
        end = len(circles) - bottom_trim if bottom_trim > 0 else len(circles)
        for _, idx in circles[top_trim:end]:
            result.append(centers[idx])
    return result


def trim_to_divisible(
    centers: List[Tuple[float, float]], pack_size: int
) -> List[Tuple[float, float]]:
    n = len(centers)
    if n == 0 or pack_size <= 0:
        return centers

    rows_per_pkg, cols_per_pkg = best_rectangular_arrangement(pack_size)

    min_sep = _compute_min_sep(centers)
    if min_sep == float("inf"):
        return centers[:1]

    half_sep = min_sep / 2.0

    col_map: Dict[int, List[Tuple[float, int]]] = {}
    for i, (x, y) in enumerate(centers):
        key = _col_key(x, half_sep)
        col_map.setdefault(key, []).append((y, i))

    sorted_col_keys = sorted(col_map.keys())
    for k in sorted_col_keys:
        col_map[k].sort()

    result_a = _trim_with_orientation(centers, col_map, sorted_col_keys, rows_per_pkg, cols_per_pkg)
    if rows_per_pkg == cols_per_pkg:
        return result_a

    result_b = _trim_with_orientation(centers, col_map, sorted_col_keys, cols_per_pkg, rows_per_pkg)
    return result_a if len(result_a) >= len(result_b) else result_b


def best_rectangular_arrangement(n: int) -> Tuple[int, int]:
    if n <= 0:
        return (1, 1)
    best_rows, best_cols = 1, n
    best_diff = n - 1
    for rows in range(1, int(math.isqrt(n)) + 1):
        if n % rows == 0:
            cols = n // rows
            diff = abs(cols - rows)
            if diff < best_diff:
                best_diff = diff
                best_rows, best_cols = rows, cols
    return (min(best_rows, best_cols), max(best_rows, best_cols))


def package_dimensions(pack_size: int, roll_diameter: float) -> Dict[str, Any]:
    rows, cols = best_rectangular_arrangement(pack_size)
    return {
        "rows": rows,
        "cols": cols,
        "width_mm": cols * roll_diameter,
        "length_mm": rows * roll_diameter,
    }
