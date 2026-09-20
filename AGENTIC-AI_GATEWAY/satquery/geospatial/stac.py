"""Microsoft Planetary Computer STAC search and GeoTIFF AOI window cropping.

Enables dynamic satellite imagery acquisition from geographic bounding boxes (WGS84).
Searches Sentinel-2 L2A scenes, selects the optimal low-cloud acquisition, signs
the Cloud-Optimized GeoTIFF (COG) visual asset via SAS token, and streams only
the exact AOI pixel window with rasterio (zero multi-hundred-megabyte full-scene download).
"""

from __future__ import annotations

import datetime
import json
import logging
from pathlib import Path
from typing import Any

from PIL import Image
import numpy as np

from satquery.config import get_settings

logger = logging.getLogger(__name__)


class STACError(Exception):
    """Base exception for STAC operations."""


class STACSearchError(STACError):
    """Raised when the STAC search query fails."""


class SceneNotFoundError(STACError):
    """Raised when no suitable satellite scenes match the query."""


class WindowCropError(STACError):
    """Raised when cropping the GeoTIFF window fails."""


def validate_bbox(bbox: Any) -> list[float]:
    """Validate and normalize bounding box [min_lon, min_lat, max_lon, max_lat]."""
    if isinstance(bbox, str):
        try:
            bbox = json.loads(bbox)
        except Exception:
            bbox = [float(x.strip()) for x in bbox.split(",") if x.strip()]

    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        raise ValueError(
            "Bounding box must be a 4-element list/tuple: [min_lon, min_lat, max_lon, max_lat]"
        )

    coords = [float(v) for v in bbox]
    min_lon, min_lat, max_lon, max_lat = coords

    if not (-180.0 <= min_lon <= 180.0 and -180.0 <= max_lon <= 180.0):
        raise ValueError(f"Longitudes must be between -180 and 180 (got {min_lon}, {max_lon})")
    if not (-90.0 <= min_lat <= 90.0 and -90.0 <= max_lat <= 90.0):
        raise ValueError(f"Latitudes must be between -90 and 90 (got {min_lat}, {max_lat})")
    if min_lon >= max_lon:
        raise ValueError(f"min_lon ({min_lon}) must be less than max_lon ({max_lon})")
    if min_lat >= max_lat:
        raise ValueError(f"min_lat ({min_lat}) must be less than max_lat ({max_lat})")

    return coords


def _default_datetime_range(days_back: int = 90) -> str:
    """Generate ISO-8601 datetime interval for the past `days_back` days."""
    now = datetime.datetime.now(datetime.timezone.utc)
    start = now - datetime.timedelta(days=days_back)
    return f"{start.strftime('%Y-%m-%dT%H:%M:%SZ')}/{now.strftime('%Y-%m-%dT%H:%M:%SZ')}"


def search_sentinel2_scenes(
    bbox: list[float],
    *,
    datetime_range: str | None = None,
    max_cloud_cover: float | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Query Microsoft Planetary Computer STAC search endpoint for Sentinel-2 L2A scenes."""
    import httpx

    settings = get_settings()
    dt_range = datetime_range or _default_datetime_range(settings.stac_search_days_back)
    cloud_threshold = (
        max_cloud_cover
        if max_cloud_cover is not None
        else settings.stac_default_cloud_cover
    )

    headers = {"Accept": "application/geo+json"}
    if settings.planetary_computer_api_key:
        headers["Ocp-Apim-Subscription-Key"] = settings.planetary_computer_api_key

    # Try search with requested cloud cover; if 0 results, expand cloud cover threshold
    thresholds = [cloud_threshold]
    if cloud_threshold < 50.0:
        thresholds.append(50.0)
    if cloud_threshold < 100.0:
        thresholds.append(100.0)

    features: list[dict[str, Any]] = []
    for threshold in thresholds:
        payload = {
            "collections": ["sentinel-2-l2a"],
            "bbox": bbox,
            "datetime": dt_range,
            "limit": limit,
            "query": {
                "eo:cloud_cover": {"lt": threshold}
            },
            "sortby": [
                {"field": "properties.datetime", "direction": "desc"}
            ],
        }

        try:
            with httpx.Client(timeout=20.0) as client:
                res = client.post(settings.stac_search_url, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
                features = data.get("features", [])
                if features:
                    logger.info(
                        "Found %d Sentinel-2 scenes with cloud cover < %.1f%%",
                        len(features),
                        threshold,
                    )
                    break
        except Exception as exc:
            logger.exception("Planetary Computer STAC search failed: %s", exc)
            raise STACSearchError(f"STAC search request failed: {exc}") from exc

    return features


def select_best_scene(features: list[dict[str, Any]]) -> dict[str, Any]:
    """Select the optimal Sentinel-2 scene from search candidates.

    Prioritizes:
    1. Availability of 'visual' true-color asset.
    2. Low cloud cover.
    3. Recent acquisition datetime.
    """
    valid_candidates: list[dict[str, Any]] = []
    for feat in features:
        assets = feat.get("assets", {})
        if "visual" in assets and assets["visual"].get("href"):
            valid_candidates.append(feat)

    if not valid_candidates:
        raise SceneNotFoundError(
            "No Sentinel-2 scenes with a valid 'visual' true-color asset were found."
        )

    def _score(item: dict[str, Any]) -> tuple[float, float]:
        props = item.get("properties", {})
        cloud = float(props.get("eo:cloud_cover", 100.0) or 100.0)
        # Parse datetime for recency scoring
        dt_str = props.get("datetime")
        timestamp = 0.0
        if dt_str:
            try:
                # Handle ISO datetime
                dt = datetime.datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                timestamp = dt.timestamp()
            except Exception:
                timestamp = 0.0
        # Lower cloud is better, higher timestamp (newer) is better
        # We return (cloud, -timestamp) so lowest cloud wins, ties broken by newer date
        return (cloud, -timestamp)

    valid_candidates.sort(key=_score)
    selected = valid_candidates[0]
    props = selected.get("properties", {})
    logger.info(
        "Selected Sentinel-2 scene %s (date: %s, cloud cover: %s%%)",
        selected.get("id"),
        props.get("datetime"),
        props.get("eo:cloud_cover"),
    )
    return selected


def sign_planetary_url(asset_href: str) -> str:
    """Sign an Azure Blob Storage URL with Microsoft Planetary Computer SAS token."""
    import httpx

    settings = get_settings()
    headers = {}
    if settings.planetary_computer_api_key:
        headers["Ocp-Apim-Subscription-Key"] = settings.planetary_computer_api_key

    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.get(
                settings.stac_sign_url,
                params={"href": asset_href},
                headers=headers,
            )
            res.raise_for_status()
            signed_url = res.json().get("href", asset_href)
            return signed_url
    except Exception as exc:
        logger.warning("Failed to sign Planetary Computer asset URL (%s): %s", asset_href, exc)
        return asset_href


def crop_sentinel_window(
    signed_url: str,
    bbox: list[float],
    dest_path: str | Path,
) -> tuple[int, int]:
    """Read and crop the target BBOX from the remote GeoTIFF without downloading the full tile.

    Converts WGS84 bbox to raster CRS, reads pixel window via rasterio,
    and writes RGB PNG to dest_path.
    Returns (width, height) in pixels.
    """
    try:
        import rasterio
        from rasterio.warp import transform_bounds
        from rasterio.windows import from_bounds
    except ImportError as exc:
        raise WindowCropError(
            "rasterio is required for GeoTIFF window cropping (pip install -r requirements-geo.txt)."
        ) from exc

    min_lon, min_lat, max_lon, max_lat = bbox

    try:
        with rasterio.open(signed_url) as src:
            # Transform WGS84 coordinates to native raster CRS (e.g. UTM)
            proj_bounds = transform_bounds(
                "EPSG:4326",
                src.crs,
                min_lon,
                min_lat,
                max_lon,
                max_lat,
            )

            # Intersect with raster extent
            left = max(src.bounds.left, proj_bounds[0])
            bottom = max(src.bounds.bottom, proj_bounds[1])
            right = min(src.bounds.right, proj_bounds[2])
            top = min(src.bounds.top, proj_bounds[3])

            if left >= right or bottom >= top:
                raise WindowCropError(
                    f"Requested bounding box {bbox} does not intersect raster extent {src.bounds}"
                )

            window = from_bounds(left, bottom, right, top, transform=src.transform)

            # Read only the selected window
            data = src.read(window=window)
            if data.size == 0:
                raise WindowCropError("Extracted raster window is empty.")

            # data shape is (bands, height, width)
            bands, height, width = data.shape
            if bands >= 3:
                # RGB channels
                rgb = data[:3]
                if rgb.dtype != np.uint8:
                    # Normalize if 16-bit
                    rgb = np.clip(rgb / 256, 0, 255).astype(np.uint8)
                # Transpose to (height, width, 3) for PIL
                arr = np.moveaxis(rgb, 0, -1)
                img = Image.fromarray(arr, mode="RGB")
            elif bands == 1:
                # Grayscale
                gray = data[0]
                if gray.dtype != np.uint8:
                    gray = np.clip(gray / 256, 0, 255).astype(np.uint8)
                img = Image.fromarray(gray, mode="L").convert("RGB")
            else:
                raise WindowCropError(f"Unexpected band count: {bands}")

            Path(dest_path).parent.mkdir(parents=True, exist_ok=True)
            img.save(str(dest_path), format="PNG")
            logger.info("Saved cropped AOI image (%dx%d) to %s", width, height, dest_path)
            return width, height

    except Exception as exc:
        if isinstance(exc, WindowCropError):
            raise
        logger.exception("GeoTIFF window cropping failed: %s", exc)
        raise WindowCropError(f"Failed to read/crop GeoTIFF window: {exc}") from exc


def fetch_sentinel2_aoi(
    bbox: list[float] | str,
    dest_dir: str | Path,
    *,
    datetime_range: str | None = None,
    max_cloud_cover: float | None = None,
) -> tuple[Path, dict[str, Any]]:
    """High-level function: Search, select, sign, and crop Sentinel-2 imagery for a BBOX.

    Returns:
        (image_path, metadata)
    """
    clean_bbox = validate_bbox(bbox)
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    # 1. STAC Search
    features = search_sentinel2_scenes(
        clean_bbox,
        datetime_range=datetime_range,
        max_cloud_cover=max_cloud_cover,
    )
    if not features:
        raise SceneNotFoundError(
            f"No Sentinel-2 imagery found covering bounding box {clean_bbox} "
            f"for time range {datetime_range or 'recent'}."
        )

    # 2. Scene Selection
    scene = select_best_scene(features)
    scene_id = scene.get("id", "sentinel2_scene")
    props = scene.get("properties", {})
    visual_href = scene["assets"]["visual"]["href"]

    # 3. SAS URL Signing
    signed_url = sign_planetary_url(visual_href)

    # 4. Window Crop via Rasterio
    out_image = dest_dir / f"{scene_id}_crop.png"
    width, height = crop_sentinel_window(signed_url, clean_bbox, out_image)

    # 5. Metadata Assembly
    metadata: dict[str, Any] = {
        "source": "Sentinel-2 L2A",
        "scene_id": scene_id,
        "acquisition_date": props.get("datetime"),
        "cloud_cover": props.get("eo:cloud_cover"),
        "platform": props.get("platform", "Sentinel-2"),
        "bbox": clean_bbox,
        "pixel_size": [width, height],
        "stac_item_id": scene_id,
        "asset_key": "visual",
    }

    # Save metadata JSON alongside image
    meta_path = dest_dir / f"{scene_id}_metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    return out_image, metadata
