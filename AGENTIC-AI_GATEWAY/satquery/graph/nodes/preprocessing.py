"""Context detection + input validation (graph entry nodes).

Neither node decides *which* specialist runs — that is the supervisor's job.
They only record how many images arrived and any labels the client attached.
"""

from __future__ import annotations

import logging
from typing import Any

from satquery.config import get_settings
from satquery.graph.llm import invoke_text
from satquery.graph.nodes._common import trace
from satquery.graph.prompts import CONTEXTUALIZE_QUERY_PROMPT
from satquery.graph.state import SatQueryState

logger = logging.getLogger(__name__)

_IMAGE_SLOTS = ("optical_image", "sar_image", "image_t1", "image_t2")


def contextualize_query(query: str, history: list[dict[str, Any]]) -> str:
    """Rewrite a follow-up query using conversation history into a standalone query."""
    if not history or not query.strip():
        return query

    lines: list[str] = []
    for turn in history[-4:]:
        q = turn.get("query")
        a = turn.get("final_answer")
        if q:
            lines.append(f"User: {q}")
        if a:
            lines.append(f"Assistant: {a[:300]}")
    if not lines:
        return query

    history_text = "\n".join(lines)
    prompt = CONTEXTUALIZE_QUERY_PROMPT.format(history=history_text, query=query)
    try:
        rewritten = invoke_text(prompt)
        rewritten = rewritten.strip().strip('"').strip("'")
        if rewritten and len(rewritten) > 2:
            return rewritten
    except Exception as exc:  # noqa: BLE001
        logger.warning("Contextualize query failed: %s", exc)
    return query


def context_manager(state: SatQueryState) -> dict:
    images = state.get("images") or []
    image_count = len(images) or sum(1 for key in _IMAGE_SLOTS if state.get(key) is not None)

    raw_query = state.get("raw_query") or state.get("query") or ""
    history = state.get("conversation_history") or []
    resolved_query = state.get("resolved_query")
    if not resolved_query or (history and resolved_query == raw_query):
        resolved_query = contextualize_query(raw_query, history)

    # `modalities` / `temporal_mode` are informational hints derived from the
    # optional upload labels; routing does not depend on them.
    modalities: list[str] = []
    if state.get("optical_image") is not None:
        modalities.append("optical")
    if state.get("sar_image") is not None:
        modalities.append("sar")

    if state.get("image_t1") is not None and state.get("image_t2") is not None:
        temporal_mode = "bi_temporal"
    elif state.get("optical_image") is not None and state.get("sar_image") is not None:
        temporal_mode = "cross_modal"
    elif image_count >= 2:
        temporal_mode = "multi_image"
    else:
        temporal_mode = "single"

    settings = get_settings()
    return {
        "raw_query": raw_query,
        "resolved_query": resolved_query,
        "query": resolved_query,
        "image_count": image_count,
        "modalities": modalities,
        "temporal_mode": temporal_mode,
        "retry_count": state.get("retry_count", 0),
        "max_retries": state.get("max_retries", settings.default_max_retries),
        "execution_trace": trace(
            state,
            {
                "node": "context_manager",
                "status": "completed",
                "image_count": image_count,
                "modalities": modalities,
                "temporal_mode": temporal_mode,
                "resolved_query": resolved_query,
            },
        ),
    }


def input_validation(state: SatQueryState) -> dict:
    """Only guards against the one unrecoverable case: an image-directed query
    with nothing attached. General knowledge questions with no image are fine
    (the supervisor routes them to `retrieval`)."""
    errors: list[str] = []
    query = (state.get("query") or "").strip()
    image_count = state.get("image_count", 0)

    if not query:
        errors.append("No query supplied.")

    if image_count == 0 and _refers_to_an_image(query):
        errors.append(
            "The query refers to an image but none was attached. Add one or "
            "more images (any field), or rephrase as a general question."
        )

    valid = not errors
    return {
        "validation_errors": errors,
        "input_valid": valid,
        "execution_trace": trace(
            state,
            {
                "node": "input_validation",
                "status": "completed",
                "valid": valid,
                "errors": errors,
            },
        ),
    }


_IMAGE_REFERENCES = (
    "this image", "the image", "in the image", "this picture", "the picture",
    "this scene", "the scene", "this raster", "the raster", "this tile",
    "shown", "visible", "do you see", "can you see", "describe this",
    "what changed", "these images", "the two images", "both images",
)


def _refers_to_an_image(query: str) -> bool:
    q = query.lower()
    return any(phrase in q for phrase in _IMAGE_REFERENCES)
