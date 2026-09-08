from __future__ import annotations

from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from satquery.graph import run_analysis
from satquery.main import create_app
from satquery.vlm import set_vlm


def _pair(tmp_path):
    a = tmp_path / "t1.png"
    b = tmp_path / "t2.png"
    Image.new("RGB", (256, 256), (30, 120, 40)).save(a)
    later = Image.new("RGB", (256, 256), (30, 120, 40))
    ImageDraw.Draw(later).rectangle([140, 40, 230, 130], fill=(150, 130, 100))
    later.save(b)
    return str(a), str(b)


def test_change_detection_emits_change_map(tmp_path):
    a, b = _pair(tmp_path)
    state = run_analysis(query="What changed between the two dates and where?", image_t1=a, image_t2=b)

    assert state["current_task"] == "change_detection"
    ev = state["evidence"][-1]
    assert ev["change_stats"]["changed_fraction"] > 0
    assert ev["change_stats"]["change_bbox"] is not None

    arts = state.get("artifacts", [])
    assert arts and arts[0]["kind"] == "change_map"
    assert arts[0]["image_b64"].startswith("data:image/png;base64,")


def test_change_where_works_without_vlm(tmp_path, monkeypatch):
    """Pixel-difference 'where' still returns even if the VLM is unavailable."""
    from satquery.vlm.registry import DisabledVLM

    set_vlm(DisabledVLM())
    a, b = _pair(tmp_path)
    state = run_analysis(query="Where did the change occur?", image_t1=a, image_t2=b)

    assert state["current_task"] == "change_detection"
    ev = state["evidence"][-1]
    assert ev["status"] == "ok"
    assert "pixel-difference" in ev["finding"].lower()
    assert state["artifacts"][0]["kind"] == "change_map"
    assert state["final_answer"]


def test_change_map_via_api(tmp_path):
    a, b = _pair(tmp_path)
    with TestClient(create_app()) as client:
        with open(a, "rb") as fa, open(b, "rb") as fb:
            r = client.post(
                "/api/v1/analyze",
                data={"query": "What changed and where?"},
                files={
                    "image_t1": ("t1.png", fa.read(), "image/png"),
                    "image_t2": ("t2.png", fb.read(), "image/png"),
                },
            )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["current_task"] == "change_detection"
    assert body["artifacts"] and body["artifacts"][0]["kind"] == "change_map"
    assert body["evidence"][-1]["change_stats"]["change_bbox"]
