"""Text-guided region grounding specialist.

VLM emits a bounding box for the object named in the query. If a segmenter
(SAM) is configured the box is refined into a mask; otherwise a box overlay is
rendered. The overlay is attached to ``state["artifacts"]`` as a base64 PNG.
"""

from __future__ import annotations

import logging
import re

from satquery.artifacts import render_boxes, render_mask_overlay
from satquery.config import get_settings
from satquery.graph.geometry import image_size, parse_boxes
from satquery.graph.nodes._common import append_result, first_image, next_evidence_id, trace, with_artifact
from satquery.graph.prompts import GROUNDING_PROMPT
from satquery.graph.state import SatQueryState
from satquery.segmentation import SegmenterUnavailableError, get_segmenter
from satquery.vlm import get_vlm
from satquery.vlm.base import VLMUnavailableError

logger = logging.getLogger(__name__)

_TARGET_RE = re.compile(r"TARGET:\s*(.+)", re.IGNORECASE)
_CONF_RE = re.compile(r"CONFIDENCE:\s*(0(?:\.\d+)?|1(?:\.0+)?)", re.IGNORECASE)


def _failed(state: SatQueryState, message: str, reason: str | None = None) -> dict:
    evidence = {
        "evidence_id": "grounding_error",
        "agent": "grounding_agent",
        "task": "grounding_analysis",
        "status": "failed",
        "finding": message,
        "confidence": 0.0,
        "visual_evidence": [],
    }
    return {
        "agent_results": append_result(state, evidence),
        "execution_trace": trace(
            state, {"node": "grounding", "status": "failed", "reason": reason or message}
        ),
    }


def _run_vlm_ground(vlm, image, query: str, *, retry: bool) -> str:
    if hasattr(vlm, "ground"):
        return vlm.ground(image, query, do_sample=retry)
    return vlm.caption(image, f"{GROUNDING_PROMPT}\n\nQUERY:\n{query}")


def grounding_node(state: SatQueryState) -> dict:
    image = state.get("optical_image") or first_image(state)
    if image is None:
        return _failed(state, "No image was provided for grounding.")

    query = state.get("query", "")
    is_retry = int(state.get("retry_count", 0) or 0) > 0
    try:
        raw = _run_vlm_ground(get_vlm(), image, query, retry=is_retry)
    except VLMUnavailableError as exc:
        return _failed(state, str(exc), "vlm unavailable")
    except Exception as exc:  # noqa: BLE001
        logger.exception("grounding VLM error")
        return _failed(state, f"Vision model error: {exc}", "vlm error")

    logger.debug("grounding raw VLM output (retry=%s): %r", is_retry, raw)

    width, height = image_size(image)
    boxes = parse_boxes(raw, width=width, height=height)
    target_match = _TARGET_RE.search(raw or "")
    target = target_match.group(1).strip() if target_match else (query or "target")

    if not boxes or "NOT_FOUND" in (raw or "").upper():
        evidence = {
            "evidence_id": next_evidence_id(state, "grounding"),
            "agent": "grounding_agent",
            "task": "grounding_analysis",
            "finding": f"The queried target could not be localised in the image.\n\n{raw}".strip(),
            "boxes": [],
            "confidence": 0.2,
            "visual_evidence": [],
            "parameters": {"segmenter": "none"},
        }
        return {
            "agent_results": append_result(state, evidence),
            "execution_trace": trace(
                state, {"node": "grounding", "status": "completed", "grounded": False}
            ),
        }

    primary = boxes[0]
    mask_used = False
    try:
        segmenter = get_segmenter()
        if getattr(segmenter, "name", "disabled") != "disabled":
            mask = segmenter.segment_box(image, primary)
            overlay = render_mask_overlay(image, mask, bbox=primary)
            mask_used = True
        else:
            overlay = render_boxes(image, boxes, labels=[target])
    except SegmenterUnavailableError:
        overlay = render_boxes(image, boxes, labels=[target])
    except Exception:  # noqa: BLE001
        logger.exception("segmentation failed; falling back to box overlay")
        overlay = render_boxes(image, boxes, labels=[target])

    conf_match = _CONF_RE.search(raw or "")
    confidence = float(conf_match.group(1)) if conf_match else 0.6

    evidence_id = next_evidence_id(state, "grounding")
    rounded = [round(v, 3) for v in primary]
    evidence = {
        "evidence_id": evidence_id,
        "agent": "grounding_agent",
        "task": "grounding_analysis",
        "model": get_settings().vlm_model_id,
        "finding": (
            f"Located '{target}' at normalised box {rounded}"
            + (" (mask refined with SAM)." if mask_used else ".")
        ),
        "boxes": boxes,
        "confidence": confidence,
        "visual_evidence": ["grounding_overlay"],
        "parameters": {"segmenter": "sam" if mask_used else "none"},
    }
    return {
        "agent_results": append_result(state, evidence),
        "artifacts": with_artifact(
            state,
            artifact_id=f"{evidence_id}_overlay",
            kind="grounding_overlay",
            produced_by="grounding_agent",
            image_b64=overlay,
            replace_kind="grounding_overlay",
        ),
        "execution_trace": trace(
            state,
            {
                "node": "grounding",
                "status": "completed",
                "grounded": True,
                "boxes": len(boxes),
                "segmenter": "sam" if mask_used else "none",
            },
        ),
    }
