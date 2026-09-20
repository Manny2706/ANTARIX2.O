"""Request / response models for the HTTP API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    evidence_id: str | None = None
    agent: str | None = None
    task: str | None = None
    finding: Any = None
    verified_finding: str | None = None
    confidence: float = 0.0
    status: str = "ok"
    visual_evidence: list[str] = Field(default_factory=list)
    boxes: list[list[float]] | None = None      # grounding: [[x1,y1,x2,y2], ...] in [0,1]
    change_stats: dict[str, Any] | None = None  # change_detection: changed_fraction, change_bbox


class ArtifactRef(BaseModel):
    artifact_id: str
    kind: str                                   # grounding_overlay | change_map
    produced_by: str | None = None
    image_b64: str | None = None                # data:image/png;base64,...


class AnalyzeResult(BaseModel):
    session_id: str | None = Field(default=None, description="Session ID for multi-turn conversation tracking")
    query: str = ""
    raw_query: str | None = None
    resolved_query: str | None = None
    final_answer: str = ""
    confidence: float = 0.0
    current_task: str | None = None
    temporal_mode: str | None = None
    modalities: list[str] = Field(default_factory=list)
    image_count: int = 0
    input_valid: bool = True
    validation_errors: list[str] = Field(default_factory=list)
    retry_count: int = 0
    reflection: dict[str, Any] | None = None
    evidence: list[EvidenceItem] = Field(default_factory=list)
    artifacts: list[ArtifactRef] = Field(default_factory=list)
    execution_trace: list[Any] = Field(default_factory=list)
    duration_seconds: float | None = None
    stac_metadata: dict[str, Any] | None = None
    conversation_history: list[dict[str, Any]] = Field(default_factory=list)
    output_image_b64: str | None = Field(
        default=None,
        description="Base64-encoded PNG image of the analyzed satellite AOI (data:image/png;base64,...)",
    )

    @classmethod
    def from_state(cls, state: dict) -> "AnalyzeResult":
        evidence: list[EvidenceItem] = []
        for raw in state.get("evidence", []) or []:
            data = {k: v for k, v in raw.items() if k in EvidenceItem.model_fields}
            data["confidence"] = float(data.get("confidence") or 0.0)
            evidence.append(EvidenceItem(**data))

        output_image_b64 = state.get("output_image_b64")
        stac_metadata = state.get("stac_metadata")
        if not output_image_b64 and stac_metadata and isinstance(stac_metadata, dict):
            output_image_b64 = stac_metadata.get("image_b64")

        clean_stac_meta = None
        if stac_metadata and isinstance(stac_metadata, dict):
            clean_stac_meta = {k: v for k, v in stac_metadata.items() if k != "image_b64"}

        artifacts = [
            ArtifactRef(**{k: v for k, v in raw.items() if k in ArtifactRef.model_fields})
            for raw in state.get("artifacts", []) or []
        ]
        if output_image_b64 and not any(a.artifact_id == "satellite_crop" for a in artifacts):
            artifacts.append(
                ArtifactRef(
                    artifact_id="satellite_crop",
                    kind="optical_source",
                    produced_by="stac",
                    image_b64=output_image_b64,
                )
            )

        try:
            confidence = float(state.get("confidence") or 0.0)
        except (TypeError, ValueError):
            confidence = 0.0

        return cls(
            session_id=state.get("session_id"),
            query=state.get("query", ""),
            raw_query=state.get("raw_query"),
            resolved_query=state.get("resolved_query"),
            final_answer=state.get("final_answer", ""),
            confidence=confidence,
            current_task=state.get("current_task"),
            temporal_mode=state.get("temporal_mode"),
            modalities=state.get("modalities", []),
            image_count=state.get("image_count", 0),
            input_valid=state.get("input_valid", True),
            validation_errors=state.get("validation_errors", []),
            retry_count=state.get("retry_count", 0),
            reflection=state.get("reflection"),
            evidence=evidence,
            artifacts=artifacts,
            execution_trace=state.get("execution_trace", []),
            duration_seconds=state.get("duration_seconds"),
            stac_metadata=clean_stac_meta,
            conversation_history=state.get("conversation_history", []),
            output_image_b64=None,
        )


class AnalyzeJsonRequest(BaseModel):
    query: str = Field(min_length=1)
    session_id: str | None = Field(default=None, description="Optional session ID for multi-turn conversation memory")
    max_retries: int | None = Field(default=None, ge=0, le=5)

    bbox: list[float] | None = Field(
        default=None,
        description="[min_lon, min_lat, max_lon, max_lat] bounding box in WGS84 (EPSG:4326)",
    )
    datetime_range: str | None = Field(
        default=None,
        description="ISO-8601 datetime or range, e.g. '2024-01-01T00:00:00Z/2024-03-01T23:59:59Z'",
    )
    max_cloud_cover: float | None = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Maximum cloud cover percentage filter (0-100)",
    )

    optical_image_url: str | None = None
    sar_image_url: str | None = None
    image_t1_url: str | None = None
    image_t2_url: str | None = None

    optical_image_b64: str | None = None
    sar_image_b64: str | None = None
    image_t1_b64: str | None = None
    image_t2_b64: str | None = None


class JobSummary(BaseModel):
    job_id: str
    status: str
    created_at: float
    started_at: float | None = None
    finished_at: float | None = None
    error: str | None = None


class JobDetail(JobSummary):
    result: AnalyzeResult | None = None


class SessionSummary(BaseModel):
    session_id: str
    created_at: float
    last_accessed: float
    turn_count: int
    has_assets: bool


class TurnDetail(BaseModel):
    turn_id: int
    query: str
    resolved_query: str
    final_answer: str
    task: str | None = None
    evidence_summary: str | None = None
    timestamp: float


class SessionDetail(BaseModel):
    session_id: str
    created_at: float
    last_accessed: float
    turn_count: int
    image_count: int
    has_optical: bool
    has_sar: bool
    bbox: list[float] | None = None
    turns: list[TurnDetail] = Field(default_factory=list)

