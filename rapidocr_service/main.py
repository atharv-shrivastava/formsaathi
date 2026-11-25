from __future__ import annotations

import logging
import os
import secrets
import threading
from io import BytesIO

from fastapi import FastAPI, HTTPException, Request
from PIL import Image, UnidentifiedImageError
from rapidocr import RapidOCR

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("formsaathi.rapidocr")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

app = FastAPI(title="FormSaathi RapidOCR", version="1.0.0")
_engine: RapidOCR | None = None
_engine_lock = threading.RLock()


def get_engine() -> RapidOCR:
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = RapidOCR()
    return _engine


def verify_image(data: bytes) -> None:
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(status_code=415, detail="Only JPEG, PNG and WebP images are supported.")
            if not image.width or not image.height or image.width * image.height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="Image dimensions are too large.")
            image.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail="The uploaded image is invalid or could not be decoded.") from error


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "engine": "RapidOCR", "model_loaded": _engine is not None}


@app.post("/ocr")
async def run_ocr(request: Request) -> dict[str, object]:
    expected_token = os.getenv("RAPIDOCR_API_TOKEN", "")
    supplied_header = request.headers.get("authorization", "")
    supplied_token = supplied_header[7:].strip() if supplied_header.lower().startswith("bearer ") else ""

    if not expected_token or not supplied_token or not secrets.compare_digest(supplied_token, expected_token):
        raise HTTPException(status_code=401, detail="Unauthorized OCR request.")

    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="No image data was received.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="The processed image exceeds the 10 MB limit.")

    verify_image(data)

    try:
        # Keep model inference serial on the free CPU instance to limit peak memory use.
        with _engine_lock:
            result = get_engine()(data)
        text_lines = [str(value).strip() for value in (result.txts or ()) if str(value).strip()]
        scores = list(result.scores or ())
        lines = [
            {
                "text": line,
                "confidence": float(scores[index]) if index < len(scores) else None,
            }
            for index, line in enumerate(text_lines)
        ]
        return {
            "engine": "RapidOCR",
            "text": "\n".join(text_lines),
            "lines": lines,
            "elapsed_seconds": float(result.elapse),
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("RapidOCR processing failed")
        raise HTTPException(status_code=422, detail="RapidOCR could not process this image.") from error
