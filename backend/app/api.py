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
from .explain import explain
from .followup import followup
from .patch import apply_patch
from .replay import SESSION_ID_REGEX, load_session, save_session
from .trace import log_trace, read_session
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


class FollowupPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scene: dict[str, Any]
    text: str


class ExplainPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scene: dict[str, Any]
    verification: dict[str, Any]
    prediction: Optional[str] = None


class PredictionPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str


class SaveReplayPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str


def get_session_id(request: Request) -> str:
    session_id = request.headers.get("x-session-id", "default")
    return session_id if SESSION_ID_REGEX.match(session_id) else "default"


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
            session_id=get_session_id(request),
            event="analyze",
            duration_ms=duration_ms,
            model=os.getenv("GEMINI_REASONING_MODEL", "gemini-4-argon"),
            scene=scene,
            data={"text": text.strip() if has_text else None},
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
        log_trace(trace_id, "verify", get_session_id(request), data=result)
        return result
    except (ValueError, ValidationError) as e:
        return error_response("validation_error", str(e), trace_id, status_code=400)
    except Exception as e:
        return error_response("validation_error", str(e), trace_id, status_code=400)


@router.post("/api/v1/scenes/followup")
async def followup_endpoint(request: Request, payload: FollowupPayload):
    trace_id = get_trace_id(request)
    try:
        result = followup(payload.scene, payload.text)
    except AnalysisError as e:
        status_code = 503 if e.code == "model_unavailable" else 400
        return error_response(e.code, e.message, trace_id, status_code=status_code)
    except (ValueError, ValidationError):
        return error_response("invalid_scene", "The current scene is not valid", trace_id)
    log_trace(trace_id, "followup", get_session_id(request), scene=result["scene"], data={"text": payload.text, "changes": result["changes"]})
    return {"scene": result["scene"].model_dump(), "changes": result["changes"], "kind": result["kind"], "trace_id": trace_id}


@router.post("/api/v1/predictions")
async def record_prediction(request: Request, payload: PredictionPayload):
    # Stored before the run, so the journal shows the prediction was not written afterwards.
    trace_id = get_trace_id(request)
    if not 0 < len(payload.text) <= 500:
        return error_response("invalid_prediction", "Prediction must be 1 to 500 characters", trace_id)
    log_trace(trace_id, "prediction", get_session_id(request), data={"text": payload.text})
    return {"recorded": True, "trace_id": trace_id}


@router.post("/api/v1/explain")
async def explain_endpoint(request: Request, payload: ExplainPayload):
    trace_id = get_trace_id(request)
    text, source = explain(payload.scene, payload.verification, payload.prediction)
    log_trace(trace_id, "explain", get_session_id(request), data={"text": text, "source": source})
    return {"text": text, "source": source, "trace_id": trace_id}


@router.post("/api/v1/replay/{id}")
async def save_replay(id: str, request: Request, payload: SaveReplayPayload):
    trace_id = get_trace_id(request)
    if id == "default":
        return error_response("invalid_id", "'default' is reserved", trace_id)
    try:
        events = read_session(payload.session_id)
        save_session(id, {"session_id": payload.session_id, "events": events})
    except ValueError as e:
        return error_response("invalid_id", str(e), trace_id)
    except FileNotFoundError as e:
        return error_response("not_found", str(e), trace_id, status_code=404)
    return {"saved": id, "events": len(events), "trace_id": trace_id}


@router.get("/api/v1/replay/{id}")
async def get_replay(id: str, request: Request):
    trace_id = get_trace_id(request)
    try:
        return load_session(id)
    except ValueError as e:
        return error_response("invalid_id", str(e), trace_id, status_code=400)
    except FileNotFoundError as e:
        return error_response("not_found", str(e), trace_id, status_code=404)
