"""SAM (Segment Anything) backend — box-prompted segmentation via transformers.

torch / transformers are imported lazily inside ``load()`` so importing this
module stays cheap on machines without the ML dependencies.
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Sequence

from PIL import Image

from satquery.config import get_settings
from satquery.utils.images import to_pil

logger = logging.getLogger(__name__)

Box = Sequence[float]


class SamSegmenter:
    name = "sam"

    def __init__(self, *, model_id: str | None = None, device_map: str | None = None) -> None:
        settings = get_settings()
        self.model_id = model_id or settings.sam_model_id
        self.device_map = device_map or settings.sam_device_map
        self._model: Any = None
        self._processor: Any = None
        self._load_lock = threading.Lock()
        self._infer_lock = threading.Lock()

    def load(self) -> None:
        if self._model is not None and self._processor is not None:
            return
        with self._load_lock:
            if self._model is not None and self._processor is not None:
                return
            import torch
            from transformers import SamModel, SamProcessor

            logger.info("Loading SAM %s", self.model_id)
            processor = SamProcessor.from_pretrained(self.model_id)
            model = SamModel.from_pretrained(self.model_id)
            model.eval()
            if torch.cuda.is_available() and self.device_map != "cpu":
                model = model.to("cuda")
            self._processor = processor
            self._model = model
            logger.info("SAM ready: %s", self.model_id)

    @property
    def is_loaded(self) -> bool:
        return self._model is not None and self._processor is not None

    def segment_box(self, image: Any, box: Box) -> Image.Image:
        self.load()
        import torch

        img = to_pil(image)
        width, height = img.size
        pixel_box = [
            [
                float(box[0]) * width,
                float(box[1]) * height,
                float(box[2]) * width,
                float(box[3]) * height,
            ]
        ]
        inputs = self._processor(img, input_boxes=[pixel_box], return_tensors="pt")
        with self._infer_lock:
            inputs = {k: v.to(self._model.device) for k, v in inputs.items()}
            with torch.inference_mode():
                outputs = self._model(**inputs)
            masks = self._processor.image_processor.post_process_masks(
                outputs.pred_masks.cpu(),
                inputs["original_sizes"].cpu(),
                inputs["reshaped_input_sizes"].cpu(),
            )
        # masks: list[Tensor(num_boxes, num_masks, H, W)] -> take best mask of box 0
        mask_tensor = masks[0][0]
        best = mask_tensor[outputs.iou_scores[0, 0].argmax()] if mask_tensor.ndim == 3 else mask_tensor
        arr = (best.numpy() * 255).astype("uint8")
        return Image.fromarray(arr, mode="L")

    def health(self) -> dict[str, Any]:
        return {"backend": self.name, "model_id": self.model_id, "loaded": self.is_loaded}
