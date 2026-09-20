"""Session management endpoints for conversational memory."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from satquery.api.deps import require_api_key
from satquery.api.schemas import SessionDetail, SessionSummary, TurnDetail
from satquery.graph.session import get_session_manager

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"], dependencies=[Depends(require_api_key)])


@router.get("", response_model=list[SessionSummary])
def list_sessions() -> list[SessionSummary]:
    """List all active conversation sessions."""
    mgr = get_session_manager()
    return [SessionSummary(**s) for s in mgr.list_sessions()]


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: str) -> SessionDetail:
    """Get conversation history and metadata for a specific session."""
    session = get_session_manager().get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    turns = [
        TurnDetail(
            turn_id=t.turn_id,
            query=t.query,
            resolved_query=t.resolved_query,
            final_answer=t.final_answer,
            task=t.task,
            evidence_summary=t.evidence_summary,
            timestamp=t.timestamp,
        )
        for t in session.turns
    ]

    return SessionDetail(
        session_id=session.session_id,
        created_at=session.created_at,
        last_accessed=session.last_accessed,
        turn_count=len(session.turns),
        image_count=len(session.images),
        has_optical=session.optical_image is not None,
        has_sar=session.sar_image is not None,
        bbox=session.bbox,
        turns=turns,
    )


@router.delete("/{session_id}")
def delete_session(session_id: str) -> dict[str, str]:
    """Delete a session and clear its conversation memory."""
    mgr = get_session_manager()
    if not mgr.delete(session_id):
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return {"status": "deleted", "session_id": session_id}
