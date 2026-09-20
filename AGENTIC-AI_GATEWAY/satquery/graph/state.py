"""Shared graph state (ported from ``SatQueryState`` in the notebook)."""

from __future__ import annotations

from typing import Any, TypedDict


class SatQueryState(TypedDict, total=False):
    # --- session & conversation ---------------------------------------------
    session_id: str | None
    raw_query: str
    resolved_query: str
    conversation_history: list[dict[str, Any]]

    # --- request ------------------------------------------------------------
    query: str
    images: list[Any]
    optical_image: str | None
    sar_image: str | None
    image_t1: str | None
    image_t2: str | None
    roi: Any
    max_retries: int
    bbox: list[float] | None
    stac_metadata: dict[str, Any] | None
    output_image_b64: str | None

    # --- derived context -------------------------------------------------- --
    image_count: int
    modalities: list[str]
    temporal_mode: str          # single | bi_temporal | cross_modal

    # --- validation -------------------------------------------------------- -
    validation_errors: list[str]
    input_valid: bool

    # --- routing --------------------------------------------------------------
    plan: list[dict[str, Any]]
    current_task: str
    retry_task: str | None

    # --- analysis -----------------------------------------------------------
    agent_results: list[dict[str, Any]]
    evidence: list[dict[str, Any]]
    rag_context: str
    confidence: float

    # --- reflection / retry ----------------------------------------------- --
    qa_result: dict[str, Any]
    reflection: dict[str, Any]
    needs_reanalysis: bool
    retry_count: int

    # --- spatial / visual evidence ----------------------------------------- -
    artifacts: list[dict[str, Any]]     # {artifact_id, kind, produced_by, image_b64}

    # --- output -----------------------------------------------------------  -
    execution_trace: list[Any]
    final_answer: str
    duration_seconds: float
