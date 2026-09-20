"""Specialist analysis nodes.

Each produces one entry in ``agent_results`` with a ``finding``. Vision-model
and text-model failures are caught and turned into failed-evidence records so
the pipeline always reaches ``answer_synthesis`` with something to say.
"""

from __future__ import annotations

import logging

from satquery.artifacts import render_mask_overlay
from satquery.config import get_settings
from satquery.geospatial.raster import (
    analyze_spatial_properties,
    get_pixel_space_info,
    get_raster_metadata,
)
from satquery.graph.geometry import change_mask
from satquery.graph.llm import invoke_text
from satquery.graph.nodes._common import (
    append_result,
    as_text,
    first_image,
    next_evidence_id,
    trace,
    with_artifact,
)
from satquery.graph.prompts import (
    CROSS_MODAL_REASONING_PROMPT,
    CHANGE_DETECTION_PROMPT,
    IMAGE_ANALYSIS_PROMPT,
    RETRIEVAL_PROMPT,
    SAR_ANALYSIS_PROMPT,
)
from satquery.graph.state import SatQueryState
from satquery.vlm import get_vlm
from satquery.vlm.base import VLMUnavailableError

logger = logging.getLogger(__name__)


# Specialist task name -> graph node name (they differ for cross_modal / geo_spatial),
# so a failed run traces the same node name a successful run does.
_TASK_TO_NODE = {
    "image_analysis": "image_analysis",
    "change_detection": "change_detection",
    "cross_modal_analysis": "cross_modal",
    "geo_spatial_analysis": "geo_spatial",
    "grounding_analysis": "grounding",
    "retrieval": "retrieval",
}


def _failed(state: SatQueryState, agent: str, task: str, message: str, reason: str | None = None) -> dict:
    evidence = {
        "evidence_id": f"{task}_error",
        "agent": agent,
        "task": task,
        "status": "failed",
        "finding": message,
        "confidence": 0.0,
        "visual_evidence": [],
    }
    return {
        "agent_results": append_result(state, evidence),
        "execution_trace": trace(
            state,
            {
                "node": _TASK_TO_NODE.get(task, task),
                "status": "failed",
                "reason": reason or message,
            },
        ),
    }


def _completed(state: SatQueryState, node: str, evidence: dict, **trace_extra) -> dict:
    return {
        "agent_results": append_result(state, evidence),
        "execution_trace": trace(
            state, {"node": node, "status": "completed", **trace_extra}
        ),
    }


def _resolve_pair(state: SatQueryState, key_a: str, key_b: str) -> tuple:
    """Return the ``(a, b)`` image pair for a two-image specialist.

    Uses the labelled slots (``key_a`` / ``key_b``) when the client provided
    them, otherwise fills from the generic ``images`` pool — so ``images=[x, y]``
    works without naming which is which.
    """
    a, b = state.get(key_a), state.get(key_b)
    pool = [p for p in (state.get("images") or []) if p]
    if not a:
        a = next((p for p in pool if p != b), None)
    if not b:
        b = next((p for p in pool if p != a), None)
    return a, b


# --------------------------------------------------------------------------- #
# Single image                                                                 #
# --------------------------------------------------------------------------- #
def image_analysis_node(state: SatQueryState) -> dict:
    image = state.get("optical_image") or state.get("sar_image") or first_image(state)
    if image is None:
        return _failed(state, "image_analysis_agent", "image_analysis", "No image was provided.")
    query = state.get("query", "")
    history = state.get("conversation_history") or []
    history_ctx = ""
    if history:
        last = history[-1]
        summary = last.get("evidence_summary") or last.get("final_answer", "")
        if summary:
            history_ctx = f"\n\nPRIOR CONTEXT:\nPrevious finding: {str(summary)[:250]}"
    prompt = f"{IMAGE_ANALYSIS_PROMPT}{history_ctx}\n\nUSER QUESTION:\n{query}"
    try:
        finding = get_vlm().caption(image, prompt, max_new_tokens=300)
    except VLMUnavailableError as exc:
        return _failed(state, "image_analysis_agent", "image_analysis", str(exc), "vlm unavailable")
    except Exception as exc:  # noqa: BLE001
        logger.exception("image_analysis VLM error")
        return _failed(
            state, "image_analysis_agent", "image_analysis",
            f"Vision model error: {exc}", "vlm error",
        )

    evidence = {
        "evidence_id": next_evidence_id(state, "image_analysis"),
        "agent": "image_analysis_agent",
        "task": "image_analysis",
        "model": get_settings().vlm_model_id,
        "finding": finding,
        "confidence": 0.75,
        "visual_evidence": ["source_image"],
        "parameters": {"max_new_tokens": 300},
    }
    return _completed(state, "image_analysis", evidence)


# --------------------------------------------------------------------------- #
# Bi-temporal change                                                           #
# --------------------------------------------------------------------------- #
def _build_change_map(t1, t2) -> tuple[dict, str | None]:
    """Classical pixel-difference change map (no model). Returns (stats, overlay_b64|None)."""
    try:
        result = change_mask(t1, t2)
    except Exception:  # noqa: BLE001
        logger.exception("change map generation failed")
        return {}, None
    stats = {
        "changed_fraction": result["changed_fraction"],
        "change_bbox": result["change_bbox"],
        "method": "pixel_difference",
        "threshold": result["threshold"],
    }
    overlay = None
    if result["change_bbox"] is not None:
        try:
            overlay = render_mask_overlay(t2, result["mask"], bbox=result["change_bbox"])
        except Exception:  # noqa: BLE001
            logger.exception("change overlay render failed")
    return stats, overlay


def _change_result(state: SatQueryState, evidence: dict, overlay: str | None) -> dict:
    result = _completed(state, "change_detection", evidence)
    if overlay:
        result["artifacts"] = with_artifact(
            state,
            artifact_id=f"{evidence['evidence_id']}_change_map",
            kind="change_map",
            produced_by="change_detection_agent",
            image_b64=overlay,
            replace_kind="change_map",
        )
    return result


def change_detection_node(state: SatQueryState) -> dict:
    t1, t2 = _resolve_pair(state, "image_t1", "image_t2")
    if not t1 or not t2:
        return _failed(
            state, "change_detection_agent", "change_detection",
            f"Change detection needs two images; {state.get('image_count', 0)} supplied.",
        )

    # Spatial "where" — deterministic, works even if the VLM is unavailable.
    stats, overlay = _build_change_map(t1, t2)
    pct = None if not stats else round(stats["changed_fraction"] * 100, 1)

    try:
        finding = get_vlm().compare(
            t1, t2, CHANGE_DETECTION_PROMPT,
            label_a="IMAGE 1 - EARLIER OBSERVATION",
            label_b="IMAGE 2 - LATER OBSERVATION",
            max_new_tokens=220,
        )
    except Exception as exc:  # noqa: BLE001
        if not isinstance(exc, VLMUnavailableError):
            logger.exception("change_detection VLM error")
        # No textual interpretation, but the pixel-difference map still answers "where".
        if pct is not None:
            evidence = {
                "evidence_id": next_evidence_id(state, "change_detection"),
                "agent": "change_detection_agent",
                "task": "change_detection",
                "finding": (
                    f"Pixel-difference change detection: about {pct}% of the scene changed, "
                    "concentrated within the highlighted region. "
                    f"(Textual change interpretation unavailable: {exc})"
                ),
                "confidence": 0.5,
                "change_stats": stats,
                "visual_evidence": ["change_map"],
                "parameters": {"method": "pixel_difference"},
            }
            return _change_result(state, evidence, overlay)
        reason = "vlm unavailable" if isinstance(exc, VLMUnavailableError) else "vlm error"
        return _failed(state, "change_detection_agent", "change_detection", str(exc), reason)

    finding_text = finding
    if pct is not None:
        finding_text = f"{finding}\n\nPixel-difference check: ~{pct}% of the scene changed."
    evidence = {
        "evidence_id": next_evidence_id(state, "change_detection"),
        "agent": "change_detection_agent",
        "task": "change_detection",
        "model": get_settings().vlm_model_id,
        "finding": finding_text,
        "confidence": 0.75,
        "change_stats": stats or None,
        "visual_evidence": ["image_t1", "image_t2"] + (["change_map"] if overlay else []),
        "parameters": {"max_new_tokens": 220},
    }
    return _change_result(state, evidence, overlay)


# --------------------------------------------------------------------------- #
# Optical + SAR                                                                #
# --------------------------------------------------------------------------- #
def cross_modal_agent_node(state: SatQueryState) -> dict:
    optical, sar = _resolve_pair(state, "optical_image", "sar_image")
    if not optical or not sar:
        return _failed(
            state, "cross_modal_agent", "cross_modal_analysis",
            f"Cross-modal analysis needs two images (optical + SAR); "
            f"{state.get('image_count', 0)} supplied.",
        )

    vlm = get_vlm()
    try:
        optical_result = vlm.caption(optical, IMAGE_ANALYSIS_PROMPT, max_new_tokens=180)
        sar_result = vlm.caption(sar, SAR_ANALYSIS_PROMPT, max_new_tokens=180)
    except VLMUnavailableError as exc:
        return _failed(state, "cross_modal_agent", "cross_modal_analysis", str(exc), "vlm unavailable")
    except Exception as exc:  # noqa: BLE001
        logger.exception("cross_modal VLM error")
        return _failed(
            state, "cross_modal_agent", "cross_modal_analysis",
            f"Vision model error: {exc}", "vlm error",
        )

    reasoning_prompt = CROSS_MODAL_REASONING_PROMPT.format(
        optical_observations=optical_result,
        sar_observations=sar_result,
    )
    try:
        finding = invoke_text(reasoning_prompt)
    except Exception as exc:  # noqa: BLE001
        logger.exception("cross_modal reasoning error")
        finding = (
            f"OPTICAL_FINDINGS:\n{optical_result}\n\n"
            f"SAR_FINDINGS:\n{sar_result}\n\n"
            f"(Cross-modal reasoning model unavailable: {exc})"
        )

    settings = get_settings()
    evidence = {
        "evidence_id": next_evidence_id(state, "cross_modal"),
        "agent": "cross_modal_agent",
        "task": "cross_modal_analysis",
        "model": {"vision": settings.vlm_model_id, "reasoning": settings.groq_model},
        "finding": finding,
        "raw_optical_analysis": optical_result,
        "raw_sar_analysis": sar_result,
        "confidence": 0.75,
        "visual_evidence": ["optical_image", "sar_image"],
        "parameters": {"optical_max_new_tokens": 180, "sar_max_new_tokens": 180},
    }
    return _completed(state, "cross_modal", evidence)


# --------------------------------------------------------------------------- #
# Geospatial                                                                   #
# --------------------------------------------------------------------------- #
def geo_spatial_agent_node(state: SatQueryState) -> dict:
    image = first_image(state)
    if image is None:
        return _failed(
            state, "geo_spatial_agent", "geo_spatial_analysis",
            "No image available for geospatial analysis.",
        )

    metadata = get_raster_metadata(image)
    spatial = analyze_spatial_properties(image)
    pixels = get_pixel_space_info(image)
    georeferenced = bool(spatial.get("georeferenced"))

    evidence = {
        "evidence_id": next_evidence_id(state, "geo_spatial"),
        "agent": "geo_spatial_agent",
        "task": "geo_spatial_analysis",
        "finding": {
            "raster_metadata": metadata,
            "spatial_properties": spatial,
            "pixel_space": pixels,
        },
        "confidence": 1.0 if georeferenced else 0.95,
        "visual_evidence": ["source_raster"],
        "parameters": {"tool": "rasterio"},
    }
    return _completed(state, "geo_spatial", evidence, georeferenced=georeferenced)


# --------------------------------------------------------------------------- #
# Retrieval / domain knowledge                                                 #
# --------------------------------------------------------------------------- #
def retrieval_node(state: SatQueryState) -> dict:
    gathered = [e.get("verified_finding") or e.get("finding") for e in state.get("evidence", [])]
    prompt = (
        f"{RETRIEVAL_PROMPT}\n\n"
        f"USER QUESTION:\n{state.get('query', '')}\n\n"
        f"EVIDENCE GATHERED SO FAR:\n{as_text(gathered)}"
    )
    try:
        text = invoke_text(prompt)
    except Exception as exc:  # noqa: BLE001
        return _failed(
            state, "retrieval_agent", "retrieval",
            f"Knowledge model unavailable: {exc}", "llm error",
        )

    evidence = {
        "evidence_id": next_evidence_id(state, "retrieval"),
        "agent": "retrieval_agent",
        "task": "retrieval",
        "finding": text,
        "confidence": 0.6,
        "visual_evidence": [],
        "parameters": {"source": "domain_knowledge"},
    }
    result = _completed(state, "retrieval", evidence)
    result["rag_context"] = text
    return result
