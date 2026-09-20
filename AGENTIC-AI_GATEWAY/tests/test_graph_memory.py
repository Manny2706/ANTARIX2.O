from __future__ import annotations

from satquery.graph.runner import run_analysis
from satquery.graph.session import get_session_manager


def test_multi_turn_conversation_retains_image_and_context(png_file):
    image_path = str(png_file("scene.png"))
    mgr = get_session_manager()

    # --- Turn 1: User asks about vegetation with image attached ---
    res1 = run_analysis(
        query="Is there vegetation?",
        optical_image=image_path,
    )

    session_id = res1["session_id"]
    assert session_id is not None
    assert res1["current_task"] == "image_analysis"
    assert res1["final_answer"]
    assert len(res1["images"]) == 1

    # Verify turn 1 was recorded in session manager
    session = mgr.get(session_id)
    assert session is not None
    assert len(session.turns) == 1
    assert session.turns[0].query == "Is there vegetation?"

    # --- Turn 2: Follow-up question WITHOUT providing the image ---
    res2 = run_analysis(
        query="what percentage?",
        session_id=session_id,
    )

    # Context & image should be automatically retained from Turn 1!
    assert res2["session_id"] == session_id
    assert res2["image_count"] == 1
    assert len(res2["images"]) == 1
    assert res2["images"][0] == image_path

    # Raw query is preserved, while resolved_query is contextualized
    assert res2["raw_query"] == "what percentage?"
    assert "vegetation" in (res2["resolved_query"] or "").lower()
    assert res2["current_task"] == "image_analysis"
    assert res2["final_answer"]

    # Check conversation history in turn 2
    assert len(res2["conversation_history"]) == 1
    assert res2["conversation_history"][0]["query"] == "Is there vegetation?"

    # Verify session now has 2 turns
    session = mgr.get(session_id)
    assert len(session.turns) == 2
    assert session.turns[1].query == "what percentage?"
