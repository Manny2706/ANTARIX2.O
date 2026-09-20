from __future__ import annotations

import time

from satquery.graph.session import SessionManager


def test_session_creation_and_get():
    mgr = SessionManager(db_path=":memory:")
    session = mgr.get_or_create()
    assert session.session_id
    assert len(session.turns) == 0

    fetched = mgr.get(session.session_id)
    assert fetched is not None
    assert fetched.session_id == session.session_id


def test_session_custom_id():
    mgr = SessionManager(db_path=":memory:")
    session = mgr.get_or_create("custom-123")
    assert session.session_id == "custom-123"

    session2 = mgr.get_or_create("custom-123")
    assert session2.session_id == "custom-123"


def test_save_turn_and_history():
    mgr = SessionManager(db_path=":memory:")
    session = mgr.get_or_create("test-sess")

    mgr.save_turn(
        "test-sess",
        query="Is there vegetation?",
        resolved_query="Is there vegetation in the scene?",
        final_answer="Yes, dense green vegetation is visible.",
        task="image_analysis",
        evidence=[{"status": "ok", "finding": "green canopy detected"}],
    )

    assert len(session.turns) == 1
    turn = session.turns[0]
    assert turn.turn_id == 1
    assert turn.query == "Is there vegetation?"
    assert turn.resolved_query == "Is there vegetation in the scene?"
    assert "green canopy" in (turn.evidence_summary or "")

    history_text = mgr.format_history_text("test-sess")
    assert "User: Is there vegetation?" in history_text
    assert "Assistant: Yes, dense green vegetation is visible." in history_text


def test_update_and_hydrate_assets():
    mgr = SessionManager(db_path=":memory:")
    session = mgr.get_or_create("sess-hydrate")

    mgr.update_assets(
        "sess-hydrate",
        images=["/path/to/img1.png"],
        optical_image="/path/to/optical.png",
        bbox=[10.0, 20.0, 11.0, 21.0],
    )

    assert session.has_assets() is True

    # Empty state should be hydrated
    state = {"session_id": "sess-hydrate", "images": []}
    hydrated = mgr.hydrate_state(state)
    assert hydrated["images"] == ["/path/to/img1.png"]
    assert hydrated["optical_image"] == "/path/to/optical.png"
    assert hydrated["bbox"] == [10.0, 20.0, 11.0, 21.0]


def test_session_deletion_and_listing():
    mgr = SessionManager(db_path=":memory:")
    mgr.get_or_create("s1")
    mgr.get_or_create("s2")

    sessions = mgr.list_sessions()
    assert len(sessions) == 2

    assert mgr.delete("s1") is True
    assert mgr.get("s1") is None
    assert mgr.delete("nonexistent") is False
    assert len(mgr.list_sessions()) == 1


def test_session_ttl_cleanup():
    mgr = SessionManager(db_path=":memory:", ttl_seconds=0.05)
    s = mgr.get_or_create("short-lived")
    assert mgr.get("short-lived") is not None

    time.sleep(0.06)
    # Expiration cleanup triggers on next access
    assert mgr.get("short-lived") is None


def test_sqlite_persistence_survives_restart(tmp_path):
    db_file = tmp_path / "test_sessions.db"

    # Process 1 creates session and turns
    mgr1 = SessionManager(db_path=db_file)
    mgr1.get_or_create("persisted-session")
    mgr1.update_assets(
        "persisted-session",
        images=["/path/to/img1.png"],
        optical_image="/path/to/optical.png",
        bbox=[77.1, 28.5, 77.2, 28.6],
    )
    mgr1.save_turn(
        "persisted-session",
        query="Is there water?",
        resolved_query="Is there a water body?",
        final_answer="A river was detected in the south.",
        task="image_analysis",
        evidence=[{"finding": "river body"}],
    )

    # Process 2 simulates a server restart by opening the same db file in a fresh instance
    mgr2 = SessionManager(db_path=db_file)
    loaded = mgr2.get("persisted-session")
    assert loaded is not None
    assert loaded.session_id == "persisted-session"
    assert loaded.optical_image == "/path/to/optical.png"
    assert loaded.bbox == [77.1, 28.5, 77.2, 28.6]
    assert len(loaded.turns) == 1
    assert loaded.turns[0].query == "Is there water?"
    assert loaded.turns[0].final_answer == "A river was detected in the south."
    assert loaded.turns[0].task == "image_analysis"

