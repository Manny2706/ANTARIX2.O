# 🧠 ANTARIX 2.O — Model Training & Fine-Tuning

This module contains the datasets, fine-tuning scripts, and Jupyter notebooks for training custom Vision-Language Models (VLMs) tailored for satellite imagery Visual Question Answering (VQA) and multi-spectral feature extraction.

---

## 📊 Dataset Ingestion

The training pipeline supports **BigEarthNet**, a benchmark satellite dataset:
- **Sentinel-1 (SAR)**: Synthetic Aperture Radar dual-polarization (VV & VH bands) for all-weather & day-night land observation.
- **Sentinel-2 (Optical)**: 12 multi-spectral bands (RGB, Red-Edge, NIR, SWIR).

---

## ⚙️ Fine-Tuning Pipeline (`satquery.ipynb`)

The fine-tuning notebook [`satquery.ipynb`](file:///c:/Users/mayan/Desktop/ANTARIX-SATQUERY_AI/MODEL_TRAINING/satquery.ipynb) executes:

1. **Dataset Download & Extraction**: Downloads BigEarthNet S1/S2 `.tar.zst` files and metadata `.parquet` tables.
2. **Quantization**: 4-bit NormalFloat quantization via `bitsandbytes`.
3. **PEFT / LoRA**: Low-Rank Adaptation targeting vision transformer layers and cross-attention blocks.
4. **ConfigILM / Qwen2-VL**: Multi-modal vision encoder integration for satellite scene understanding and grounding.

---

## 🚀 Running Notebook

Open `satquery.ipynb` in Google Colab (with T4 / A100 GPU) or a local GPU environment equipped with PyTorch, `transformers`, `peft`, `bitsandbytes`, `configilm`, and `rasterio`.
