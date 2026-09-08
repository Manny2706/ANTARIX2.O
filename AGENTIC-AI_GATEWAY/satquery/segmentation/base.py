"""Segmenter backend contract (SAM-style box-prompted segmentation).

The grounding node asks a :class:`Segmenter` to refine a bounding box into a
pixel mask. It is optional: when no segmenter is configured the grounding node
falls back to a plain box overlay.
"""

from __future__ import annotations

from typing import Any, Protocol, Sequence, runtime_checkable

Box = Sequence[float]  # [x1, y1, x2, y2] normalised to [0, 1]


class SegmenterUnavailableError(RuntimeError):
    """Raised when a segmentation is requested but no backend is configured."""


@runtime_checkable
class Segmenter(Protocol):
    name: str

    def segment_box(self, image: Any, box: Box) -> "Any":
        """Return an 'L'-mode PIL mask (255 = object) for ``box`` on ``image``."""

    def health(self) -> dict[str, Any]:
        ...
