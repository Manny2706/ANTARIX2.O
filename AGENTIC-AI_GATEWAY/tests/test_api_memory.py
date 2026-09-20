from __future__ import annotations

import base64

from fastapi.testclient import TestClient

from satquery.main import create_app


def _client() -> TestClient:
    return TestClient(create_app())


def test_api_multi_turn_multipart(png_bytes):
    with _client() as client:
        # --- Turn 1: Initial question with image upload ---
        res1 = client.post(
            "/api/v1/analyze",
            data={"query": "Is there vegetation in this image?"},
            files={"optical": ("scene.png", png_bytes(), "image/png")},
        )
        assert res1.status_code == 200, res1.text
        body1 = res1.json()
        session_id = body1["session_id"]
        assert session_id is not None
        assert body1["final_answer"]

        # --- Turn 2: Follow-up question with session_id and NO image ---
        res2 = client.post(
            "/api/v1/analyze",
            data={"query": "what percentage?", "session_id": session_id},
        )
        assert res2.status_code == 200, res2.text
        body2 = res2.json()
        assert body2["session_id"] == session_id
        assert body2["raw_query"] == "what percentage?"
        assert "vegetation" in (body2["resolved_query"] or "").lower()
        assert len(body2["conversation_history"]) == 1
        assert body2["conversation_history"][0]["query"] == "Is there vegetation in this image?"


def test_api_multi_turn_json(png_bytes):
    with _client() as client:
        b64_img = base64.b64encode(png_bytes()).decode()

        # Turn 1
        payload1 = {
            "query": "Is there vegetation in this satellite scene?",
            "optical_image_b64": b64_img,
        }
        res1 = client.post("/api/v1/analyze/json", json=payload1)
        assert res1.status_code == 200, res1.text
        session_id = res1.json()["session_id"]
        assert session_id

        # Turn 2: Follow-up without re-sending base64 image
        payload2 = {
            "query": "what percentage?",
            "session_id": session_id,
        }
        res2 = client.post("/api/v1/analyze/json", json=payload2)
        assert res2.status_code == 200, res2.text
        body2 = res2.json()
        assert body2["session_id"] == session_id
        assert "vegetation" in (body2["resolved_query"] or "").lower()


def test_sessions_endpoints(png_bytes):
    with _client() as client:
        # Create a session via /analyze
        res = client.post(
            "/api/v1/analyze",
            data={"query": "Detect water bodies"},
            files={"optical": ("scene.png", png_bytes(), "image/png")},
        )
        assert res.status_code == 200
        sid = res.json()["session_id"]

        # GET /api/v1/sessions
        sessions_res = client.get("/api/v1/sessions")
        assert sessions_res.status_code == 200
        sessions = sessions_res.json()
        assert any(s["session_id"] == sid for s in sessions)

        # GET /api/v1/sessions/{sid}
        detail_res = client.get(f"/api/v1/sessions/{sid}")
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["session_id"] == sid
        assert detail["turn_count"] == 1
        assert len(detail["turns"]) == 1
        assert detail["turns"][0]["query"] == "Detect water bodies"

        # DELETE /api/v1/sessions/{sid}
        del_res = client.delete(f"/api/v1/sessions/{sid}")
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "deleted"

        # Verify 404 after deletion
        assert client.get(f"/api/v1/sessions/{sid}").status_code == 404
