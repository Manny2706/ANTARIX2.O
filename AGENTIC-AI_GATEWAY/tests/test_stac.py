"""Tests for Planetary Computer STAC search, scene selection, and GeoTIFF window cropping."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
from PIL import Image
import pytest
import rasterio
from rasterio.transform import from_origin

from satquery.api.schemas import AnalyzeJsonRequest, AnalyzeResult
from satquery.geospatial.stac import (
    SceneNotFoundError,
    crop_sentinel_window,
    fetch_sentinel2_aoi,
    search_sentinel2_scenes,
    select_best_scene,
    validate_bbox,
)


def test_validate_bbox():
    # Valid list
    coords = validate_bbox([77.1234, 28.6123, 77.1356, 28.6201])
    assert coords == [77.1234, 28.6123, 77.1356, 28.6201]

    # Valid JSON string
    coords = validate_bbox("[77.1234, 28.6123, 77.1356, 28.6201]")
    assert coords == [77.1234, 28.6123, 77.1356, 28.6201]

    # Valid comma-separated string
    coords = validate_bbox("77.1234, 28.6123, 77.1356, 28.6201")
    assert coords == [77.1234, 28.6123, 77.1356, 28.6201]

    # Inverted longitudes
    with pytest.raises(ValueError, match="min_lon .* must be less than max_lon"):
        validate_bbox([78.0, 28.0, 77.0, 29.0])

    # Out of range latitudes
    with pytest.raises(ValueError, match="Latitudes must be between"):
        validate_bbox([77.0, -95.0, 78.0, 29.0])

    # Wrong element count
    with pytest.raises(ValueError, match="Bounding box must be a 4-element"):
        validate_bbox([77.0, 28.0, 78.0])


def test_select_best_scene():
    features = [
        {
            "id": "scene_high_cloud",
            "properties": {"eo:cloud_cover": 35.0, "datetime": "2024-03-01T05:00:00Z"},
            "assets": {"visual": {"href": "https://example.com/high.tif"}},
        },
        {
            "id": "scene_low_cloud",
            "properties": {"eo:cloud_cover": 3.2, "datetime": "2024-02-20T05:00:00Z"},
            "assets": {"visual": {"href": "https://example.com/low.tif"}},
        },
        {
            "id": "scene_no_visual",
            "properties": {"eo:cloud_cover": 0.5, "datetime": "2024-02-25T05:00:00Z"},
            "assets": {"B02": {"href": "https://example.com/b2.tif"}},
        },
    ]

    best = select_best_scene(features)
    assert best["id"] == "scene_low_cloud"


def test_select_best_scene_empty_raises():
    with pytest.raises(SceneNotFoundError):
        select_best_scene([])


def test_crop_sentinel_window(tmp_path: Path):
    # Create a synthetic 3-band GeoTIFF in EPSG:4326
    tif_path = tmp_path / "synthetic_cog.tif"
    width, height = 200, 200
    transform = from_origin(77.0, 29.0, 0.005, 0.005)  # covers lon [77.0, 78.0], lat [28.0, 29.0]
    data = np.full((3, height, width), 128, dtype=np.uint8)

    with rasterio.open(
        tif_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=3,
        dtype=np.uint8,
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(data)

    out_png = tmp_path / "cropped.png"
    crop_bbox = [77.2, 28.2, 77.4, 28.5]
    w, h = crop_sentinel_window(str(tif_path), crop_bbox, out_png)

    assert out_png.exists()
    assert w > 0 and h > 0
    with Image.open(out_png) as img:
        assert img.size == (w, h)
        assert img.mode == "RGB"


def test_fetch_sentinel2_aoi_mocked(tmp_path: Path):
    # Synthetic GeoTIFF
    tif_path = tmp_path / "fake_s2.tif"
    transform = from_origin(77.0, 29.0, 0.005, 0.005)
    data = np.full((3, 100, 100), 200, dtype=np.uint8)

    with rasterio.open(
        tif_path,
        "w",
        driver="GTiff",
        height=100,
        width=100,
        count=3,
        dtype=np.uint8,
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(data)

    mock_feat = {
        "id": "S2_MOCK_SCENE",
        "properties": {"eo:cloud_cover": 2.5, "datetime": "2024-03-10T05:00:00Z", "platform": "Sentinel-2B"},
        "assets": {"visual": {"href": str(tif_path)}},
    }

    with patch("satquery.geospatial.stac.search_sentinel2_scenes", return_value=[mock_feat]):
        with patch("satquery.geospatial.stac.sign_planetary_url", return_value=str(tif_path)):
            img_path, meta = fetch_sentinel2_aoi(
                [77.1, 28.6, 77.3, 28.8],
                dest_dir=tmp_path / "aoi_out",
            )
            assert img_path.exists()
            assert meta["scene_id"] == "S2_MOCK_SCENE"
            assert meta["cloud_cover"] == 2.5
            assert meta["source"] == "Sentinel-2 L2A"
            assert (tmp_path / "aoi_out" / "S2_MOCK_SCENE_metadata.json").exists()


def test_analyze_json_with_bbox_endpoint(tmp_path: Path):
    from fastapi.testclient import TestClient
    from satquery.main import create_app

    # Create sample image
    sample_img = tmp_path / "sample.png"
    Image.new("RGB", (64, 64), color="blue").save(sample_img)

    mock_meta = {
        "source": "Sentinel-2 L2A",
        "scene_id": "S2_TEST_123",
        "acquisition_date": "2024-03-01T00:00:00Z",
        "cloud_cover": 1.2,
        "bbox": [77.12, 28.61, 77.13, 28.62],
        "pixel_size": [64, 64],
    }

    with patch("satquery.api.inputs.fetch_sentinel2_aoi", return_value=(sample_img, mock_meta)):
        with TestClient(create_app()) as client:
            resp = client.post(
                "/api/v1/analyze/json",
                json={
                    "query": "What buildings are present in this area?",
                    "bbox": [77.12, 28.61, 77.13, 28.62],
                },
            )
            assert resp.status_code == 200, resp.text
            data = resp.json()
            assert data["final_answer"]
            assert data["stac_metadata"] is not None
            assert data["stac_metadata"]["scene_id"] == "S2_TEST_123"
            assert data["stac_metadata"]["cloud_cover"] == 1.2
            assert data.get("output_image_b64") is None
            assert "image_b64" not in data["stac_metadata"]
            crop_artifact = next(
                (a for a in data["artifacts"] if a["artifact_id"] == "satellite_crop"), None
            )
            assert crop_artifact is not None
            assert crop_artifact["kind"] == "optical_source"
            assert crop_artifact["image_b64"].startswith("data:image/png;base64,")


def test_analyze_multipart_with_bbox_endpoint(tmp_path: Path):
    from fastapi.testclient import TestClient
    from satquery.main import create_app

    sample_img = tmp_path / "sample.png"
    Image.new("RGB", (64, 64), color="green").save(sample_img)

    mock_meta = {
        "source": "Sentinel-2 L2A",
        "scene_id": "S2_MULTIPART_TEST",
        "acquisition_date": "2024-03-05T00:00:00Z",
        "cloud_cover": 0.5,
        "bbox": [77.12, 28.61, 77.13, 28.62],
        "pixel_size": [64, 64],
    }

    with patch("satquery.api.inputs.fetch_sentinel2_aoi", return_value=(sample_img, mock_meta)):
        with TestClient(create_app()) as client:
            resp = client.post(
                "/api/v1/analyze",
                data={
                    "query": "Describe the land cover in this area.",
                    "bbox": "[77.12, 28.61, 77.13, 28.62]",
                },
            )
            assert resp.status_code == 200, resp.text
            data = resp.json()
            assert data["final_answer"]
            assert data["stac_metadata"] is not None
            assert data["stac_metadata"]["scene_id"] == "S2_MULTIPART_TEST"
            assert data.get("output_image_b64") is None
            assert "image_b64" not in data["stac_metadata"]
            crop_artifact = next(
                (a for a in data["artifacts"] if a["artifact_id"] == "satellite_crop"), None
            )
            assert crop_artifact is not None
            assert crop_artifact["kind"] == "optical_source"
            assert crop_artifact["image_b64"].startswith("data:image/png;base64,")


def test_analyze_stream_with_bbox_endpoint(tmp_path: Path):
    from fastapi.testclient import TestClient
    from satquery.main import create_app

    sample_img = tmp_path / "sample.png"
    Image.new("RGB", (64, 64), color="red").save(sample_img)

    mock_meta = {
        "source": "Sentinel-2 L2A",
        "scene_id": "S2_STREAM_TEST",
        "acquisition_date": "2024-03-05T00:00:00Z",
        "cloud_cover": 0.1,
        "bbox": [77.12, 28.61, 77.13, 28.62],
        "pixel_size": [64, 64],
    }

    with patch("satquery.api.inputs.fetch_sentinel2_aoi", return_value=(sample_img, mock_meta)):
        with TestClient(create_app()) as client:
            resp = client.post(
                "/api/v1/analyze/stream",
                data={
                    "query": "Describe the scene.",
                    "bbox": "[77.12, 28.61, 77.13, 28.62]",
                },
            )
            assert resp.status_code == 200
            assert "event: result" in resp.text
            # Extract JSON data payload for result event
            for line in resp.text.splitlines():
                if line.startswith("data: ") and '"satellite_crop"' in line:
                    payload = json.loads(line[len("data: "):])
                    assert payload.get("output_image_b64") is None
                    assert any(
                        a["artifact_id"] == "satellite_crop"
                        and a["image_b64"].startswith("data:image/png;base64,")
                        for a in payload.get("artifacts", [])
                    )
                    break
            else:
                pytest.fail("result event with satellite_crop artifact not found in stream")


def test_jobs_with_bbox_endpoint(tmp_path: Path):
    import time
    from fastapi.testclient import TestClient
    from satquery.main import create_app

    sample_img = tmp_path / "sample.png"
    Image.new("RGB", (64, 64), color="yellow").save(sample_img)

    mock_meta = {
        "source": "Sentinel-2 L2A",
        "scene_id": "S2_JOB_TEST",
        "acquisition_date": "2024-03-05T00:00:00Z",
        "cloud_cover": 0.2,
        "bbox": [77.12, 28.61, 77.13, 28.62],
        "pixel_size": [64, 64],
    }

    with patch("satquery.api.inputs.fetch_sentinel2_aoi", return_value=(sample_img, mock_meta)):
        with TestClient(create_app()) as client:
            create_resp = client.post(
                "/api/v1/jobs",
                data={
                    "query": "What is in this area?",
                    "bbox": "[77.12, 28.61, 77.13, 28.62]",
                },
            )
            assert create_resp.status_code == 202, create_resp.text
            job_id = create_resp.json()["job_id"]

            for _ in range(50):
                poll = client.get(f"/api/v1/jobs/{job_id}")
                assert poll.status_code == 200
                data = poll.json()
                if data["status"] in ("succeeded", "failed"):
                    break
                time.sleep(0.05)

            assert data["status"] == "succeeded"
            assert data["result"] is not None
            assert data["result"].get("output_image_b64") is None
            assert "image_b64" not in data["result"].get("stac_metadata", {})
            crop_artifact = next(
                (a for a in data["result"]["artifacts"] if a["artifact_id"] == "satellite_crop"), None
            )
            assert crop_artifact is not None
            assert crop_artifact["image_b64"].startswith("data:image/png;base64,")


