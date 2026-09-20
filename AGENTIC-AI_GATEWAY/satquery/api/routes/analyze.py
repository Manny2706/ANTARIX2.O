"""Synchronous analysis endpoints."""

from __future__ import annotations

import logging
from typing import Iterator

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from satquery.api.deps import require_api_key
from satquery.api.inputs import collect_json_inputs, collect_upload_inputs
from satquery.api.schemas import AnalyzeJsonRequest, AnalyzeResult
from satquery.api.streaming import SSE_HEADERS, sse_from_sync
from satquery.graph import run_analysis, stream_analysis
from satquery.graph.session import get_session_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["analyze"], dependencies=[Depends(require_api_key)])


def _run(query: str, session_id: str | None, max_retries: int | None, kwargs: dict) -> dict:
    return run_analysis(query=query, session_id=session_id, max_retries=max_retries, **kwargs)


@router.post("/analyze", response_model=AnalyzeResult)
async def analyze_multipart(
    query: str = Form(..., description="Natural-language question about the imagery"),
    session_id: str | None = Form(default=None, description="Optional session ID to continue conversation"),
    optical: UploadFile | None = File(default=None),
    sar: UploadFile | None = File(default=None),
    image_t1: UploadFile | None = File(default=None, description="Earlier image for change detection"),
    image_t2: UploadFile | None = File(default=None, description="Later image for change detection"),
    images: list[UploadFile] | None = File(default=None, description="Generic image(s)"),
    bbox: str | None = Form(default=None, description="[min_lon, min_lat, max_lon, max_lat] bounding box"),
    max_retries: int | None = Form(default=None, ge=0, le=5),
) -> AnalyzeResult:
    kwargs = await collect_upload_inputs(
        optical=optical, sar=sar, image_t1=image_t1, image_t2=image_t2, images=images, bbox=bbox
    )
    session = get_session_manager().get(session_id) if session_id else None
    if not kwargs and not (session and session.has_assets()):
        raise HTTPException(
            status_code=422,
            detail="Provide at least one image file (optical, sar, image_t1, image_t2, images) or a valid bbox, or an active session_id with imagery.",
        )
    state = await run_in_threadpool(_run, query, session_id, max_retries, kwargs)
    return AnalyzeResult.from_state(state)


@router.post("/analyze/json", response_model=AnalyzeResult)
async def analyze_json(request: AnalyzeJsonRequest) -> AnalyzeResult:
    kwargs = await run_in_threadpool(collect_json_inputs, request)
    session = get_session_manager().get(request.session_id) if request.session_id else None
    if not kwargs and not (session and session.has_assets()):
        raise HTTPException(
            status_code=422,
            detail="Provide at least one image via *_url or *_b64 fields, or a valid bbox, or an active session_id with imagery.",
        )
    state = await run_in_threadpool(_run, request.query, request.session_id, request.max_retries, kwargs)
    return AnalyzeResult.from_state(state)


@router.post(
    "/analyze/stream",
    responses={200: {"content": {"text/event-stream": {}}}},
)
async def analyze_stream(
    query: str = Form(...),
    session_id: str | None = Form(default=None, description="Optional session ID to continue conversation"),
    optical: UploadFile | None = File(default=None),
    sar: UploadFile | None = File(default=None),
    image_t1: UploadFile | None = File(default=None),
    image_t2: UploadFile | None = File(default=None),
    images: list[UploadFile] | None = File(default=None),
    bbox: str | None = Form(default=None, description="[min_lon, min_lat, max_lon, max_lat] bounding box"),
    max_retries: int | None = Form(default=None, ge=0, le=5),
) -> StreamingResponse:
    """Run an analysis and stream progress as Server-Sent Events.

    Events: ``start``, ``progress`` (one per graph node, carrying its trace
    entry), ``artifact`` (one per visual artifact, sent as soon as the run
    finishes and before ``result`` — full ``ArtifactRef`` including its
    image), ``result`` (the ``AnalyzeResult`` with artifact images omitted,
    since they were already sent as their own ``artifact`` events), ``error``.
    Splitting the image out of the final payload keeps every individual SSE
    frame small — a single frame carrying a multi-MB inline image has been
    unreliable through some proxies/tunnels.
    """
    kwargs = await collect_upload_inputs(
        optical=optical, sar=sar, image_t1=image_t1, image_t2=image_t2, images=images, bbox=bbox
    )
    session = get_session_manager().get(session_id) if session_id else None
    if not kwargs and not (session and session.has_assets()):
        raise HTTPException(
            status_code=422,
            detail="Provide at least one image file (optical, sar, image_t1, image_t2, images) or a valid bbox, or an active session_id with imagery.",
        )

    def _events() -> Iterator[dict]:
        for event in stream_analysis(query=query, session_id=session_id, max_retries=max_retries, **kwargs):
            kind = event.get("type")
            if kind == "progress":
                yield {"event": "progress", "data": event["entry"]}
            elif kind == "result":
                payload = AnalyzeResult.from_state(event["state"]).model_dump(mode="json")
                for artifact in payload.get("artifacts", []):
                    if artifact.get("image_b64"):
                        yield {"event": "artifact", "data": dict(artifact)}
                    artifact["image_b64"] = None
                yield {"event": "result", "data": payload}
            elif kind == "error":
                yield {"event": "error", "data": {"detail": event["detail"]}}
            else:  # "start"
                yield {"event": "start", "data": event.get("state", {})}

    return StreamingResponse(
        sse_from_sync(_events),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
