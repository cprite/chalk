from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any, Optional


def _session_file(session_id: str, trace_dir: Path) -> Path:
    # Sanitize session_id to avoid path traversal
    safe_session_id = "".join(c for c in session_id if c.isalnum() or c in ("-", "_")) or "default"
    return trace_dir / f"{safe_session_id}.jsonl"


def read_session(session_id: str) -> list[dict[str, Any]]:
    path = _session_file(session_id, Path(os.getenv("TRACE_DIR", "./traces")))
    if not path.is_file():
        raise FileNotFoundError(f"Session '{session_id}' has no recorded events")
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def log_trace(
    trace_id: str,
    event: str,
    session_id: str = "default",
    duration_ms: Optional[float] = None,
    model: Optional[str] = None,
    scene: Any = None,
    data: Any = None,
) -> None:
    """
    Append JSON line to env TRACE_DIR (default ./traces), one file per session.
    Format: trace_id, timestamp, event, duration_ms, model, scene.
    Never log images, keys, or tokens.
    """
    trace_dir = Path(os.getenv("TRACE_DIR", "./traces"))
    trace_dir.mkdir(parents=True, exist_ok=True)
    file_path = _session_file(session_id, trace_dir)

    scene_dict = None
    if scene is not None:
        if hasattr(scene, "model_dump"):
            scene_dict = scene.model_dump()
        elif isinstance(scene, dict):
            scene_dict = scene

    record = {
        "trace_id": trace_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "duration_ms": duration_ms,
        "model": model,
        "scene": scene_dict,
        "data": data,
    }

    with open(file_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
