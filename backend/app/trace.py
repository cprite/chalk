from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any, Optional


def log_trace(
    trace_id: str,
    event: str,
    session_id: str = "default",
    duration_ms: Optional[float] = None,
    model: Optional[str] = None,
    scene: Any = None,
) -> None:
    """
    Append JSON line to env TRACE_DIR (default ./traces), one file per session.
    Format: trace_id, timestamp, event, duration_ms, model, scene.
    Never log images, keys, or tokens.
    """
    trace_dir = Path(os.getenv("TRACE_DIR", "./traces"))
    trace_dir.mkdir(parents=True, exist_ok=True)

    # Sanitize session_id to avoid path traversal
    safe_session_id = "".join(c for c in session_id if c.isalnum() or c in ("-", "_")) or "default"
    file_path = trace_dir / f"{safe_session_id}.jsonl"

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
    }

    with open(file_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
