import io
import json
from types import SimpleNamespace

from fastapi.testclient import TestClient
from PIL import Image

import app.api as api
from app.analyze import AnalysisError, analyze_text
from app.main import app

client = TestClient(app)
BALL = {"scenario": "incline", "body": "ball", "mass": 1, "angle_deg": 30, "length": 2,
        "friction": 0.5, "gravity": 9.81, "confidence": 1, "assumptions": []}


class FakeClient:
    def __init__(self, payload):
        self.models = SimpleNamespace(
            generate_content=lambda **_: SimpleNamespace(text=json.dumps(payload))
        )


def png():
    out = io.BytesIO()
    Image.new("RGB", (10, 10)).save(out, "PNG")
    return out.getvalue()


def test_health():
    assert client.get("/healthz").json() == {"status": "ok"}


def test_analyze_requires_one_input():
    r = client.post("/api/v1/scenes/analyze")
    assert r.status_code == 400 and r.json()["code"] == "bad_request" and r.json()["trace_id"]


def test_analyze_rejects_non_image():
    r = client.post("/api/v1/scenes/analyze", files={"image": ("x.png", b"nope", "image/png")})
    assert r.status_code == 400 and r.json()["code"] == "invalid_image"


def test_analyze_image_returns_scene(monkeypatch, tmp_path):
    monkeypatch.setenv("TRACE_DIR", str(tmp_path))
    from app.scene import SceneAdapter
    monkeypatch.setattr(api, "analyze_image", lambda *a, **k: SceneAdapter.validate_python(BALL))
    r = client.post("/api/v1/scenes/analyze", files={"image": ("x.png", png(), "image/png")})
    assert r.status_code == 200 and r.json()["scene"]["body"] == "ball"
    assert "image" not in next(tmp_path.glob("*.jsonl")).read_text()


def test_internal_error_does_not_leak(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("secret-key-value")
    monkeypatch.setattr(api, "analyze_text", boom)
    r = client.post("/api/v1/scenes/analyze", data={"text": "x"})
    assert r.status_code == 500 and "secret" not in r.text


def test_model_failure_is_503(monkeypatch):
    def down(*a, **k):
        raise AnalysisError("model_unavailable", "down")
    monkeypatch.setattr(api, "analyze_text", down)
    assert client.post("/api/v1/scenes/analyze", data={"text": "x"}).status_code == 503


def test_verify_and_mass_independence():
    t = 1.0685
    for mass in (1, 2):
        r = client.post("/api/v1/verify", json={"scene": {**BALL, "mass": mass},
                                               "measured": {"moved": True, "time_to_end_s": t}})
        assert r.status_code == 200 and r.json()["verdict"] == "match"


def test_verify_mismatch_is_reported():
    r = client.post("/api/v1/verify", json={"scene": BALL, "measured": {"moved": True, "time_to_end_s": 2.0}})
    assert r.json()["verdict"] == "mismatch" and r.json()["error_pct"] > 2


def test_patch_rejects_unknown_field_and_out_of_range():
    url = "/api/v1/scenes/patch"
    assert client.post(url, json={"scene": BALL, "field": "mass", "value": 2}).json()["scene"]["mass"] == 2
    assert client.post(url, json={"scene": BALL, "field": "confidence", "value": 1}).status_code == 400
    assert client.post(url, json={"scene": BALL, "field": "mass", "value": -1}).status_code == 400


def test_replay_rejects_bad_id():
    assert client.get("/api/v1/replay/default").json()["body"] == "ball"
    assert client.get("/api/v1/replay/no-such").status_code == 404
    assert client.get("/api/v1/replay/bad.id").status_code == 400


def test_unlabelled_ball_rolls_and_defaults_are_recorded():
    scene = analyze_text("ball on slope", client=FakeClient({"scenario": "incline", "body": "ball", "angle_deg": 30}))
    assert scene.friction == 1.0 and scene.mass == 1.0 and scene.length == 2.0
    assert scene.confidence == 0.5 and len(scene.assumptions) == 4


def test_missing_angle_is_an_error():
    try:
        analyze_text("ball", client=FakeClient({"scenario": "incline", "body": "ball"}))
    except AnalysisError as e:
        assert e.code == "invalid_scene" and "angle_deg" in e.message
    else:
        raise AssertionError("expected AnalysisError")
