"""Final answer generation."""

from __future__ import annotations

import logging

from satquery.graph.llm import invoke_text
from satquery.graph.nodes._common import as_text, trace
from satquery.graph.prompts import ANSWER_SYNTHESIS_PROMPT
from satquery.graph.state import SatQueryState

logger = logging.getLogger(__name__)


def answer_synthesis_node(state: SatQueryState) -> dict:
    # Reached directly from input_validation when the request is unusable.
    if not state.get("input_valid", True):
        errors = state.get("validation_errors") or ["Unknown validation error."]
        message = "The request could not be analyzed. " + " ".join(errors)
        return {
            "final_answer": message,
            "execution_trace": trace(
                state, {"node": "answer_synthesis", "status": "completed", "mode": "validation_error"}
            ),
        }

    evidence = state.get("evidence", [])
    parts: list[str] = []
    for item in evidence:
        if item.get("status") == "failed":
            continue
        text = as_text(item.get("verified_finding") or item.get("finding")).strip()
        if text:
            parts.append(f"[{item.get('agent', 'agent')} · {item.get('task', '')}]\n{text}")
    evidence_text = "\n\n".join(parts)

    if not evidence_text:
        failures = [as_text(e.get("finding")).strip() for e in evidence if e.get("status") == "failed"]
        unique = list(dict.fromkeys(f for f in failures if f))
        reason = " ".join(unique) or "No usable visual evidence was produced."
        return {
            "final_answer": f"SatQuery could not produce a grounded answer. {reason}",
            "execution_trace": trace(
                state, {"node": "answer_synthesis", "status": "completed", "mode": "no_evidence"}
            ),
        }

    artifacts = state.get("artifacts") or []
    if artifacts:
        kinds = ", ".join(sorted({a.get("kind", "artifact") for a in artifacts}))
        evidence_text += (
            f"\n\n[Visual evidence attached to the response ({kinds}). "
            "Refer the user to it for the exact location.]"
        )

    try:
        confidence = float(state.get("confidence") or 0.0)
    except (TypeError, ValueError):
        confidence = 0.0

    history_str = ""
    history = state.get("conversation_history") or []
    if history:
        history_lines = []
        for t in history[-4:]:
            q = t.get("query", "")
            a = t.get("final_answer", "")
            if q and a:
                history_lines.append(f"User: {q}\nAssistant: {a}")
        if history_lines:
            history_str = "Prior conversation:\n" + "\n".join(history_lines) + "\n\n"

    user_query = state.get("raw_query") or state.get("query", "")
    if state.get("resolved_query") and state.get("resolved_query") != user_query:
        user_query = f"{user_query} (Context: {state.get('resolved_query')})"

    prompt = ANSWER_SYNTHESIS_PROMPT.format(
        query=user_query,
        evidence=evidence_text,
        confidence=confidence,
        conversation_history=history_str,
    )
    try:
        answer = invoke_text(prompt)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Answer synthesis LLM unavailable: %s", exc)
        answer = (
            "SatQuery gathered the following verified evidence but could not run the "
            f"final summariser ({exc}):\n\n{evidence_text}"
        )

    return {
        "final_answer": answer,
        "execution_trace": trace(
            state, {"node": "answer_synthesis", "status": "completed", "mode": "synthesised"}
        ),
    }
