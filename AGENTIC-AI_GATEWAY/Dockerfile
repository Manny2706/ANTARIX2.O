# SatQuery backend — full image (core API + local Qwen2-VL vision model + SAM
# + geospatial/STAC tools), configured for GPU inference.
#
# All three requirement sets are installed, plus bitsandbytes for the default
# 4-bit quantized VLM_MODEL_ID. VLM_BACKEND defaults to "local" below.
#
# REQUIRES AN NVIDIA GPU AT RUNTIME: bitsandbytes 4-bit inference has no CPU
# fallback and will error without one. Run with the NVIDIA Container Toolkit
# installed on the host and `--gpus all` (or the GPU block in
# docker-compose.yml, which must be uncommented — see there). The torch cu124
# wheel bundles its own CUDA runtime, so no CUDA base image is required, only
# a compatible host driver.
#
# CPU-only deployment: revert the torch --index-url below to
# https://download.pytorch.org/whl/cpu, drop the bitsandbytes install line,
# and set VLM_BACKEND back to "disabled" (or "local" with
# VLM_MODEL_ID=manny2706/satquery-qwen2vl-16bit, which is slow on CPU but
# doesn't need bitsandbytes/GPU).

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-ml.txt requirements-geo.txt ./

RUN pip install --no-cache-dir -r requirements.txt

# Local vision model (Qwen2-VL) + SAM — CUDA 12.4 wheels + bitsandbytes for
# 4-bit quantized inference (needs an NVIDIA GPU at runtime, see header).
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu124 \
    && pip install --no-cache-dir -r requirements-ml.txt \
    && pip install --no-cache-dir bitsandbytes

# Geospatial / STAC tools (rasterio, pyproj) — also the sole source of the
# numpy import that satquery/geospatial/stac.py needs unconditionally.
RUN pip install --no-cache-dir -r requirements-geo.txt

COPY . .
RUN pip install --no-cache-dir --no-deps -e .

ENV VLM_BACKEND=local \
    API_HOST=0.0.0.0 \
    API_PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["python", "-m", "satquery"]
