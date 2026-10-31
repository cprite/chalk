import logging
import os
import time
from typing import Any, Optional
import uuid

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, ValidationError

from .analyze import AnalysisError, analyze_image, analyze_text
from .images import MAX_IMAGE_SIZE_BYTES, ImageError, normalize_image
from .patch import apply_patch
from .replay import load_session
from .trace import log_trace
from .verify import verify

logger = logging.getLogger(__name__)
router = APIRouter()


class PatchPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scene: dict[str, Any]
    field: str
    value: Any


class VerifyPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scene: dict[str, Any]
    measured: dict[str, Any]


def get_trace_id(request: Request) -> str:
    return request.headers.get("x-trace-id") or uuid.uuid4().hex[:16]


def error_response(code: str, message: str, trace_id: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": message, "trace_id": trace_id},
    )


@router.post("/api/v1/scenes/analyze")
async def analyze_scene(
    request: Request,
    image: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
):
    trace_id = get_trace_id(request)
    t0 = time.perf_counter()

    has_image = image is not None
    has_text = text is not None and bool(text.strip())

    if not has_image and not has_text:
        return error_response(
            "bad_request",
            "Either 'image' or 'text' must be provided",
            trace_id,
            status_code=400,
        )
    if has_image and has_text:
        return error_response(
            "bad_request",
            "Provide either 'image' or 'text', not both",
            trace_id,
            status_code=400,
        )

    try:
        if has_image:
            assert image is not None
            raw_bytes = await image.read(MAX_IMAGE_SIZE_BYTES + 1)
            normalized = normalize_image(raw_bytes)
            scene = analyze_image(normalized, mime_type="image/jpeg")
        else:
            assert text is not None
            scene = analyze_text(text.strip())

        duration_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        log_trace(
            trace_id=trace_id,
            event="analyze",
            duration_ms=duration_ms,
            model=os.getenv("GEMINI_REASONING_MODEL", "gemini-4-argon"),
            scene=scene,
        )
        return {"scene": scene.model_dump(), "trace_id": trace_id}
    except ImageError as e:
        return error_response("invalid_image", str(e), trace_id, status_code=400)
    except AnalysisError as e:
        status_code = 503 if e.code == "model_unavailable" else 400
        return error_response(e.code, e.message, trace_id, status_code=status_code)
    except Exception:
        logger.exception("analyze failed, trace_id=%s", trace_id)
        return error_response("internal_error", "Could not analyze the input", trace_id, status_code=500)


@router.post("/api/v1/scenes/patch")
async def patch_scene(request: Request, payload: PatchPayload):
    trace_id = get_trace_id(request)
    try:
        patched = apply_patch(payload.scene, payload.field, payload.value)
        return {"scene": patched.model_dump()}
    except (ValueError, ValidationError) as e:
        return error_response("invalid_patch", str(e), trace_id, status_code=400)
    except Exception as e:
        return error_response("invalid_patch", str(e), trace_id, status_code=400)


@router.post("/api/v1/verify")
async def verify_endpoint(request: Request, payload: VerifyPayload):
    trace_id = get_trace_id(request)
    try:
        result = verify(payload.scene, payload.measured)
        return result
    except (ValueError, ValidationError) as e:
        return error_response("validation_error", str(e), trace_id, status_code=400)
    except Exception as e:
        return error_response("validation_error", str(e), trace_id, status_code=400)


@router.get("/api/v1/replay/{id}")
async def get_replay(id: str, request: Request):
    trace_id = get_trace_id(request)
    try:
        return load_session(id)
    except ValueError as e:
        return error_response("invalid_id", str(e), trace_id, status_code=400)
    except FileNotFoundError as e:
        return error_response("not_found", str(e), trace_id, status_code=404)
