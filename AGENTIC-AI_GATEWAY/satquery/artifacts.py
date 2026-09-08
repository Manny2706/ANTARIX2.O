"""Render visual evidence (box overlays, mask overlays) as base64 PNG data URIs.

Pure Pillow. The graph attaches the returned data URIs to ``state["artifacts"]``;
the API returns them inline in ``AnalyzeResult.artifacts`` (no file serving).
"""

from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import Sequence

from PIL import Image, ImageDraw

from satquery.config import get_settings

Box = Sequence[float]  # [x1, y1, x2, y2] in [0, 1]

_PALETTE = [
    (255, 64, 64),
    (64, 160, 255),
    (64, 220, 120),
    (255, 200, 0),
    (200, 80, 255),
]


def _downscale(img: Image.Image, max_dim: int) -> Image.Image:
    width, height = img.size
    if max(width, height) <= max_dim:
        return img
    scale = max_dim / max(width, height)
    return img.resize((max(1, int(width * scale)), max(1, int(height * scale))))


def to_data_uri(img: Image.Image, *, max_dim: int | None = None) -> str:
    max_dim = max_dim or get_settings().artifact_max_dim
    buffer = io.BytesIO()
    _downscale(img.convert("RGB"), max_dim).save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _line_width(img: Image.Image) -> int:
    return max(2, round(min(img.size) * 0.004))


def render_boxes(
    base_path: str | Path,
    boxes: Sequence[Box],
    labels: Sequence[str] | None = None,
) -> str:
    """Draw normalised boxes on the source image; return a base64 PNG data URI."""
    img = Image.open(str(base_path)).convert("RGB")
    width, height = img.size
    draw = ImageDraw.Draw(img)
    line_width = _line_width(img)
    for i, box in enumerate(boxes):
        colour = _PALETTE[i % len(_PALETTE)]
        rect = [box[0] * width, box[1] * height, box[2] * width, box[3] * height]
        draw.rectangle(rect, outline=colour, width=line_width)
        if labels and i < len(labels) and labels[i]:
            draw.text((rect[0] + line_width, max(0.0, rect[1] - 14)), str(labels[i]), fill=colour)
    return to_data_uri(img)


def render_mask_overlay(
    base_path: str | Path,
    mask: Image.Image,
    *,
    colour: tuple[int, int, int] = (255, 64, 64),
    alpha: int = 110,
    bbox: Box | None = None,
) -> str:
    """Tint the masked region on the source image; optionally draw a bbox."""
    img = Image.open(str(base_path)).convert("RGB")
    if mask.size != img.size:
        mask = mask.resize(img.size)
    tint = Image.new("RGB", img.size, colour)
    alpha_mask = mask.convert("L").point(lambda p: alpha if p else 0)
    img = Image.composite(tint, img, alpha_mask)
    if bbox is not None:
        width, height = img.size
        ImageDraw.Draw(img).rectangle(
            [bbox[0] * width, bbox[1] * height, bbox[2] * width, bbox[3] * height],
            outline=colour,
            width=_line_width(img),
        )
    return to_data_uri(img)
