"""High-level entrypoint that builds the initial state and runs the graph."""

from __future__ import annotations

import logging
import time
from typing import Any, Iterator

from satquery.config import get_settings
from satquery.graph.builder import get_graph
from satquery.graph.session import get_session_manager

logger = logging.getLogger(__name__)


def build_initial_state(
    *,
    query: str,
    session_id: str | None = None,
    optical_image: str | None = None,
    sar_image: str | None = None,
    image_t1: str | None = None,
    image_t2: str | None = None,
    images: list[str] | None = None,
    roi: Any = None,
    max_retries: int | None = None,
    bbox: list[float] | None = None,
    stac_metadata: dict[str, Any] | None = None,
    output_image_b64: str | None = None,
    **extra: Any,
) -> dict:
    settings = get_settings()
    session_mgr = get_session_manager()
    session = session_mgr.get_or_create(session_id)
    sid = session.session_id

    # If assets are not supplied in this turn, hydrate from session
    all_images: list[str] = list(images) if images else []
    for path in (optical_image, sar_image, image_t1, image_t2):
        if path and path not in all_images:
            all_images.append(path)

    if not all_images and session.images:
        all_images = list(session.images)
    if optical_image is None and session.optical_image:
        optical_image = session.optical_image
    if sar_image is None and session.sar_image:
        sar_image = session.sar_image
    if image_t1 is None and session.image_t1:
        image_t1 = session.image_t1
    if image_t2 is None and session.image_t2:
        image_t2 = session.image_t2
    if roi is None and session.roi:
        roi = session.roi
    if bbox is None and session.bbox:
        bbox = session.bbox
    if stac_metadata is None and session.stac_metadata:
        stac_metadata = session.stac_metadata

    resolved_output_b64 = output_image_b64 or (
        stac_metadata.get("image_b64") if isinstance(stac_metadata, dict) else None
    )
    if resolved_output_b64 is None and session.output_image_b64:
        resolved_output_b64 = session.output_image_b64

    initial_artifacts: list[dict[str, Any]] = []
    if resolved_output_b64:
        initial_artifacts.append(
            {
                "artifact_id": "satellite_crop",
                "kind": "optical_source",
                "produced_by": "stac",
                "image_b64": resolved_output_b64,
            }
        )
    elif session.artifacts:
        # Only the base image carries forward as a turn-less asset; overlays
        # (grounding_overlay, change_map, ...) belong to the turn that produced
        # them and must not leak into a new turn's artifact list.
        initial_artifacts = [a for a in session.artifacts if a.get("kind") == "optical_source"]

    # Persist any newly supplied assets to session
    session_mgr.update_assets(
        sid,
        images=all_images,
        optical_image=optical_image,
        sar_image=sar_image,
        image_t1=image_t1,
        image_t2=image_t2,
        roi=roi,
        bbox=bbox,
        stac_metadata=stac_metadata,
        output_image_b64=resolved_output_b64,
        artifacts=initial_artifacts,
    )

    state = {
        "session_id": sid,
        "raw_query": query,
        "resolved_query": None,
        "conversation_history": [t.to_dict() for t in session.turns],
        "query": query,
        "images": all_images,
        "optical_image": optical_image,
        "sar_image": sar_image,
        "image_t1": image_t1,
        "image_t2": image_t2,
        "roi": roi,
        "bbox": bbox,
        "stac_metadata": stac_metadata,
        "output_image_b64": resolved_output_b64,
        "max_retries": settings.default_max_retries if max_retries is None else int(max_retries),
        "retry_count": 0,
        "retry_task": None,
        "agent_results": [],
        "evidence": [],
        "artifacts": initial_artifacts,
        "execution_trace": [],
        "confidence": 0.0,
        "final_answer": "",
    }
    for k, v in extra.items():
        if k not in state:
            state[k] = v
    return state


def run_analysis(**kwargs: Any) -> dict:
    """Run one full analysis. ``kwargs`` are forwarded to :func:`build_initial_state`."""
    state = build_initial_state(**kwargs)
    settings = get_settings()
    started = time.perf_counter()
    result = get_graph().invoke(state, config={"recursion_limit": settings.recursion_limit})
    result["duration_seconds"] = round(time.perf_counter() - started, 3)

    # Record completed turn into session memory
    sid = result.get("session_id")
    if sid:
        get_session_manager().save_turn(
            sid,
            query=result.get("raw_query") or state.get("raw_query") or state.get("query", ""),
            resolved_query=result.get("resolved_query") or result.get("query", ""),
            final_answer=result.get("final_answer", ""),
            task=result.get("current_task"),
            evidence=result.get("evidence", []),
        )
        if result.get("output_image_b64") or result.get("artifacts"):
            get_session_manager().update_assets(
                sid,
                output_image_b64=result.get("output_image_b64"),
                artifacts=result.get("artifacts"),
            )

    logger.info(
        "analysis done session=%s task=%s retries=%s duration=%.2fs",
        result.get("session_id"),
        result.get("current_task"),
        result.get("retry_count"),
        result["duration_seconds"],
    )
    return result


def stream_analysis(**kwargs: Any) -> Iterator[dict]:
    """Run one analysis, yielding events as the graph progresses.

    Event shapes::

        {"type": "start",    "state": <initial state summary>}
        {"type": "progress", "entry": <execution_trace entry>}
        {"type": "result",   "state": <final state (dict)>}
        {"type": "error",    "detail": "<message>"}

    Synchronous generator — bridge it to async with
    ``satquery.api.streaming.sse_from_sync``.
    """
    state = build_initial_state(**kwargs)
    settings = get_settings()
    started = time.perf_counter()

    yield {
        "type": "start",
        "state": {
            "session_id": state.get("session_id"),
            "query": state["query"],
            "image_count": len(state["images"]),
            "max_retries": state["max_retries"],
        },
    }

    final_state: dict = dict(state)
    seen = 0
    try:
        for snapshot in get_graph().stream(
            state,
            config={"recursion_limit": settings.recursion_limit},
            stream_mode="values",
        ):
            final_state = snapshot
            entries = snapshot.get("execution_trace", []) or []
            for entry in entries[seen:]:
                yield {"type": "progress", "entry": entry}
            seen = len(entries)
    except Exception as exc:  # noqa: BLE001
        logger.exception("stream_analysis failed")
        yield {"type": "error", "detail": f"{type(exc).__name__}: {exc}"}
        return

    final_state["duration_seconds"] = round(time.perf_counter() - started, 3)

    # Record completed turn into session memory
    sid = final_state.get("session_id")
    if sid:
        get_session_manager().save_turn(
            sid,
            query=final_state.get("raw_query") or state.get("raw_query") or state.get("query", ""),
            resolved_query=final_state.get("resolved_query") or final_state.get("query", ""),
            final_answer=final_state.get("final_answer", ""),
            task=final_state.get("current_task"),
            evidence=final_state.get("evidence", []),
        )
        if final_state.get("output_image_b64") or final_state.get("artifacts"):
            get_session_manager().update_assets(
                sid,
                output_image_b64=final_state.get("output_image_b64"),
                artifacts=final_state.get("artifacts"),
            )

    yield {"type": "result", "state": final_state}
