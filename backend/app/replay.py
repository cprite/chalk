import json
import os
from pathlib import Path
import re
from typing import Any

from .scene import SceneAdapter, SceneSpec

REPO_ROOT = Path(__file__).resolve().parents[2]

SESSION_ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _get_replay_dir() -> Path:
    return Path(os.getenv("REPLAY_DIR", REPO_ROOT / "fixtures" / "replay")).resolve()


def _resolve_session_path(session_id: str) -> Path:
    if not isinstance(session_id, str) or not SESSION_ID_REGEX.match(session_id):
        raise ValueError(
            f"Invalid session id '{session_id}'. Must match ^[A-Za-z0-9_-]{{1,64}}$"
        )
    base = _get_replay_dir()
    target = (base / f"{session_id}.json").resolve()
    # Path traversal protection
    try:
        target.relative_to(base)
    except ValueError as e:
        raise ValueError(f"Path traversal detected for id '{session_id}'") from e
    return target


def save_session(session_id: str, data: dict[str, Any]) -> None:
    """Save a recorded session by id with path traversal rejected."""
    path = _resolve_session_path(session_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_session(session_id: str) -> dict[str, Any]:
    """Load a recorded session by id with path traversal rejected."""
    path = _resolve_session_path(session_id)
    if not path.is_file():
        raise FileNotFoundError(f"Session '{session_id}' not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def is_replay_mode() -> bool:
    """Check if REPLAY_MODE is enabled."""
    return os.getenv("REPLAY_MODE", "false").lower() in ("true", "1", "yes")


def load_default_replay() -> SceneSpec:
    """Load default replay scene from fixtures/replay/default.json and validate with SceneSpec."""
    default_path = Path(os.getenv("DEFAULT_REPLAY_PATH", REPO_ROOT / "fixtures" / "replay" / "default.json")).resolve()
    if not default_path.is_file():
        raise FileNotFoundError(f"Default replay file not found at {default_path}")
    with open(default_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return SceneAdapter.validate_python(data)
