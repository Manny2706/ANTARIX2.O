"""Bounding-box parsing and classical change-mask generation.

Pure Pillow — no model calls, no numpy. Used by the grounding and
change-detection specialists to turn model text / image pairs into spatial
outputs.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageFilter

logger = logging.getLogger(__name__)

Box = list[float]  # [x1, y1, x2, y2], normalised to [0, 1], top-left origin

# --- box parsing ----------------------------------------------------------- #

# Qwen2-VL: <|box_start|>(x1,y1),(x2,y2)<|box_end|>
_TAG_RE = re.compile(
    r"<\|box_start\|>\s*\(?\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)?\s*,\s*"
    r"\(?\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)?\s*<\|box_end\|>"
)
# (x1,y1),(x2,y2)
_PAREN_RE = re.compile(
    r"\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)\s*,\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)"
)
# [x1, y1, x2, y2]  or  \boxed{x1, y1, x2, y2}
_BRACKET_RE = re.compile(
    r"[\[\{]\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*[\]\}]"
)


def _to_unit(
    x1: float, y1: float, x2: float, y2: float, *, width: int, height: int
) -> Box | None:
    """Normalise raw coords to [0, 1], inferring the model's scale (0-1 / 0-1000 / pixels)."""
    biggest = max(abs(x1), abs(y1), abs(x2), abs(y2))
    if biggest <= 1.5:
        sx = sy = 1.0
    elif biggest <= 1000.0 + 1e-6 and biggest > max(width, height):
        sx = sy = 1000.0
    else:  # pixel coordinates
        sx, sy = float(width or 1), float(height or 1)

    bx1, bx2 = sorted((x1 / sx, x2 / sx))
    by1, by2 = sorted((y1 / sy, y2 / sy))
    box = [max(0.0, min(1.0, v)) for v in (bx1, by1, bx2, by2)]
    if box[2] - box[0] < 1e-3 or box[3] - box[1] < 1e-3:
        return None
    return box


def parse_boxes(raw: str, *, width: int, height: int) -> list[Box]:
    """Extract every bounding box from model output, normalised to [0, 1]."""
    if not raw:
        return []
    found: list[Box] = []
    for rx in (_TAG_RE, _PAREN_RE, _BRACKET_RE):
        for m in rx.finditer(raw):
            box = _to_unit(*(float(g) for g in m.groups()), width=width, height=height)
            if box:
                found.append(box)

    seen: set[tuple] = set()
    unique: list[Box] = []
    for box in found:
        key = tuple(round(v, 3) for v in box)
        if key not in seen:
            seen.add(key)
            unique.append(box)
    return unique


def image_size(path: str | Path) -> tuple[int, int]:
    with Image.open(str(path)) as im:
        return im.size


# --- classical change mask ----------------------------------------------- #

def _median_from_hist(hist: list[int]) -> int:
    total = sum(hist)
    if total == 0:
        return 0
    half, cumulative = total / 2.0, 0
    for value, count in enumerate(hist):
        cumulative += count
        if cumulative >= half:
            return value
    return 255


def change_mask(
    earlier_path: str | Path,
    later_path: str | Path,
    *,
    noise_floor: int = 18,
    min_fraction: float = 0.0015,
    max_fraction: float = 0.60,
) -> dict[str, Any]:
    """Pixel-difference change map between two co-registered images.

    Returns ``{mask (PIL 'L'), changed_fraction, change_bbox ([0,1] or None),
    size, threshold}``. Deterministic, needs no model — works even when the VLM
    is unavailable.
    """
    earlier = Image.open(str(earlier_path)).convert("RGB")
    later = Image.open(str(later_path)).convert("RGB")
    if earlier.size != later.size:
        later = later.resize(earlier.size)

    diff = ImageChops.difference(earlier, later).convert("L")
    diff = diff.filter(ImageFilter.MedianFilter(size=3))

    hist = diff.histogram()
    total = sum(hist) or 1
    # Robust threshold: a fixed floor, raised toward the typical no-change
    # residual (median of the difference) for noisy / mis-registered pairs.
    threshold = max(noise_floor, _median_from_hist(hist) * 3)

    mask = diff.point(lambda p: 255 if p > threshold else 0).convert("L")
    changed = sum(mask.histogram()[1:])
    fraction = changed / total

    width, height = earlier.size
    pixel_bbox = mask.getbbox()
    change_bbox: Box | None = None
    # A bbox is only meaningful for *localised* change; a huge fraction usually
    # means a global illumination/contrast shift, not a real ground change.
    if pixel_bbox and min_fraction <= fraction <= max_fraction:
        change_bbox = [
            pixel_bbox[0] / width,
            pixel_bbox[1] / height,
            pixel_bbox[2] / width,
            pixel_bbox[3] / height,
        ]

    return {
        "mask": mask,
        "changed_fraction": round(fraction, 4),
        "change_bbox": [round(v, 4) for v in change_bbox] if change_bbox else None,
        "size": [width, height],
        "threshold": threshold,
    }
