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
