"""Small helpers shared by the graph nodes."""

from __future__ import annotations

import json
from typing import Any

from satquery.graph.state import SatQueryState

_IMAGE_SLOTS = ("optical_image", "sar_image", "image_t1", "image_t2")


def trace(state: SatQueryState, entry: dict[str, Any]) -> list[Any]:
    """Return the execution trace with ``entry`` appended (non-mutating)."""
    return list(state.get("execution_trace", [])) + [entry]


def append_result(state: SatQueryState, result: dict[str, Any]) -> list[Any]:
    return list(state.get("agent_results", [])) + [result]


def as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, indent=2, default=str)
    return str(value)


def first_image(state: SatQueryState) -> Any:
    for key in _IMAGE_SLOTS:
        if state.get(key):
            return state[key]
    images = state.get("images") or []
    # Return the first image first time  , then the second image next time and so on. If no images are present, return None.
    if not images:
        return None
    if state.get("evidence") and (len(state.get("evidence")) == 1 or len(state.get("evidence", [])) == 3) and len(images) > 1:
        return images[1]
    elif state.get("evidence") is None and len(images) > 0:
        return images[0]
    return images[0] if images else None


def has_any_image(state: SatQueryState) -> bool:
    return first_image(state) is not None


def next_evidence_id(state: SatQueryState, prefix: str) -> str:
    return f"{prefix}_{len(state.get('agent_results', [])) + 1}"


def with_artifact(
    state: SatQueryState,
    *,
    artifact_id: str,
    kind: str,
    produced_by: str,
    image_b64: str,
    replace_kind: str | None = None,
) -> list[Any]:
    """Return the artifacts list with a new visual-evidence entry appended.

    ``replace_kind``, if given, drops any existing artifact of that kind
    first — a retried specialist's overlay supersedes its own earlier
    attempt in this turn rather than piling up alongside it.
    """
    existing = list(state.get("artifacts", []))
    if replace_kind is not None:
        existing = [a for a in existing if a.get("kind") != replace_kind]
    return existing + [
        {
            "artifact_id": artifact_id,
            "kind": kind,
            "produced_by": produced_by,
            "image_b64": image_b64,
        }
    ]
