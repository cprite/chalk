import os
from pathlib import Path
import pytest

from app.replay import (
    is_replay_mode,
    load_default_replay,
    load_session,
    save_session,
)
from app.scene import InclineScene


def test_save_and_load_session(tmp_path, monkeypatch):
    monkeypatch.setenv("REPLAY_DIR", str(tmp_path))
    session_id = "test-session_123"
    payload = {"scene": {"scenario": "incline"}, "history": [1, 2, 3]}

    save_session(session_id, payload)
    loaded = load_session(session_id)
    assert loaded == payload


@pytest.mark.parametrize(
    "bad_id",
    [
        "../traversal",
        "../../etc/passwd",
        "/absolute/path",
        "sub/dir",
        "sub\\dir",
        "has spaces",
        "special$char",
        "colon:test",
        "",
        "x" * 65,  # Exceeds 64 characters limit
    ],
)
def test_path_traversal_and_invalid_ids_rejected(bad_id, tmp_path, monkeypatch):
    monkeypatch.setenv("REPLAY_DIR", str(tmp_path))
    with pytest.raises(ValueError, match="Invalid session id|Path traversal"):
        save_session(bad_id, {"data": 1})

    with pytest.raises(ValueError, match="Invalid session id|Path traversal"):
        load_session(bad_id)


def test_load_nonexistent_session_raises_not_found(tmp_path, monkeypatch):
    monkeypatch.setenv("REPLAY_DIR", str(tmp_path))
    with pytest.raises(FileNotFoundError):
        load_session("non_existent_session")


def test_load_default_replay_file():
    scene = load_default_replay()
    assert isinstance(scene, InclineScene)
    assert scene.scenario == "incline"
    assert scene.body == "ball"
    assert scene.mass == 1.0
    assert scene.angle_deg == 30.0
    assert scene.length == 2.0
    assert scene.friction == 0.5
    assert scene.gravity == 9.81


def test_is_replay_mode(monkeypatch):
    monkeypatch.setenv("REPLAY_MODE", "true")
    assert is_replay_mode() is True

    monkeypatch.setenv("REPLAY_MODE", "1")
    assert is_replay_mode() is True

    monkeypatch.setenv("REPLAY_MODE", "false")
    assert is_replay_mode() is False

    monkeypatch.delenv("REPLAY_MODE", raising=False)
    assert is_replay_mode() is False
