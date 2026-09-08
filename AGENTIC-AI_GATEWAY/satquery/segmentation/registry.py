"""Process-wide segmenter backend selection (mirrors satquery.vlm.registry)."""

from __future__ import annotations

import logging
from typing import Any

from satquery.config import get_settings
from satquery.segmentation.base import SegmenterUnavailableError

logger = logging.getLogger(__name__)

_backend: Any = None


class DisabledSegmenter:
    """Default backend: grounding falls back to a plain box overlay."""

    name = "disabled"

    def segment_box(self, *_args, **_kwargs):
        raise SegmenterUnavailableError(
            "No segmenter configured (SEGMENTER_BACKEND=disabled). Set "
            "SEGMENTER_BACKEND=sam to refine grounding boxes into masks."
        )

    def health(self) -> dict:
        return {"backend": self.name, "loaded": False}


def _build():
    settings = get_settings()
    backend = settings.segmenter_backend.strip().lower()
    if backend in ("disabled", "none", "off", ""):
        return DisabledSegmenter()
    if backend == "sam":
        from satquery.segmentation.sam import SamSegmenter

        return SamSegmenter()
    raise ValueError(f"Unknown segmenter backend: {settings.segmenter_backend!r}")


def get_segmenter():
    global _backend
    if _backend is None:
        _backend = _build()
    return _backend


def set_segmenter(backend) -> None:
    global _backend
    _backend = backend


def reset_segmenter() -> None:
    global _backend
    _backend = None
