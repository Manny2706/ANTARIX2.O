from __future__ import annotations

from fastapi.testclient import TestClient

from satquery.graph import run_analysis
from satquery.main import create_app
from satquery.segmentation import set_segmenter
from tests.conftest import FakeSegmenter


def test_grounding_route_and_overlay(png_file):
    state = run_analysis(
        query="Highlight the water body referred to in the query.",
        optical_image=png_file("scene.png"),
    )
    assert state["current_task"] == "grounding"
    ev = state["evidence"][-1]
    assert ev["task"] == "grounding_analysis"
    assert ev["boxes"] and len(ev["boxes"][0]) == 4
    assert all(0.0 <= v <= 1.0 for v in ev["boxes"][0])

    arts = state.get("artifacts", [])
    assert len(arts) == 1
    assert arts[0]["kind"] == "grounding_overlay"
    assert arts[0]["image_b64"].startswith("data:image/png;base64,")

    # grounding is spatial output -> not LLM-verified
    nodes = [t for t in state["execution_trace"] if isinstance(t, dict)]
    v = next(t for t in nodes if t["node"] == "verification")
    assert v.get("mode") == "tool_output"


def test_grounding_via_generic_images_field(png_file):
    state = run_analysis(query="Where is the runway in this image?", images=[png_file("a.png")])
    assert state["current_task"] == "grounding"


def test_grounding_with_sam_segmenter(png_file):
    set_segmenter(FakeSegmenter())
    state = run_analysis(query="Outline the built-up area.", optical_image=png_file("s.png"))
    assert state["current_task"] == "grounding"
    assert state["evidence"][-1]["parameters"]["segmenter"] == "sam"
    assert state["artifacts"][0]["image_b64"].startswith("data:image/png;base64,")


def test_grounding_api_returns_artifact(png_bytes):
    with TestClient(create_app()) as client:
        r = client.post(
            "/api/v1/analyze",
            data={"query": "Highlight the water body in this image."},
            files={"optical": ("o.png", png_bytes(), "image/png")},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["current_task"] == "grounding"
        assert body["artifacts"]
        assert body["artifacts"][0]["kind"] == "grounding_overlay"
        assert body["artifacts"][0]["image_b64"].startswith("data:image/png;base64,")
        assert body["evidence"][-1]["boxes"]


def test_grounding_artifacts_dont_leak_across_turns(png_file):
    from satquery.graph.session import get_session_manager

    # Seed a session with a stale overlay from an earlier (hypothetical) turn,
    # the way `update_assets` would have left it after a prior grounding call.
    mgr = get_session_manager()
    session = mgr.get_or_create("leak-test-session")
    mgr.update_assets(
        session.session_id,
        optical_image=png_file("scene.png"),
        artifacts=[
            {
                "artifact_id": "grounding_2_overlay",
                "kind": "grounding_overlay",
                "produced_by": "grounding_agent",
                "image_b64": "data:image/png;base64,STALE",
            }
        ],
    )

    state = run_analysis(query="Highlight the water body in this image.", session_id=session.session_id)
    assert state["current_task"] == "grounding"
    # Only this turn's own overlay should be present, not the seeded stale one
    # (even though the specialist reuses the same evidence/artifact ID scheme
    # every turn, so a naive carry-forward would silently collide with it).
    assert len(state["artifacts"]) == 1
    assert state["artifacts"][0]["image_b64"] != "data:image/png;base64,STALE"


def test_grounding_stream_includes_artifact_image(png_bytes):
    with TestClient(create_app()) as client:
        with client.stream(
            "POST",
            "/api/v1/analyze/stream",
            data={"query": "Highlight the water body in this image."},
            files={"optical": ("o.png", png_bytes(), "image/png")},
        ) as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())

    import json

    events, event, data = [], None, []
    for line in body.splitlines():
        if line.startswith("event:"):
            event = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            data.append(line.split(":", 1)[1].strip())
        elif line == "":
            if event is not None:
                events.append((event, "\n".join(data)))
            event, data = None, []

    by_event = dict(events)
    result = json.loads(by_event["result"])
    assert result["current_task"] == "grounding"
    assert result["artifacts"]
    assert result["artifacts"][0]["kind"] == "grounding_overlay"
    assert result["artifacts"][0]["image_b64"].startswith("data:image/png;base64,")


def test_grounding_retry_replaces_prior_overlay(png_file):
    """A retried grounding attempt (same task, this turn) must supersede its
    own earlier overlay rather than piling up a second artifact alongside it —
    each retry re-does the same job, it doesn't add a second finding."""
    from satquery.graph.nodes.grounding import grounding_node

    state = {
        "optical_image": png_file("scene.png"),
        "query": "Highlight the water body in this image.",
        "artifacts": [],
        "agent_results": [],
        "execution_trace": [],
        "retry_count": 0,
    }
    first = grounding_node(state)
    assert len(first["artifacts"]) == 1

    state = {**state, **first, "retry_count": 1}
    second = grounding_node(state)

    assert len(second["artifacts"]) == 1
    assert second["artifacts"][0]["artifact_id"] != first["artifacts"][0]["artifact_id"]
