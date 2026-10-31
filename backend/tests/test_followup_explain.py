import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.analyze import AnalysisError
from app.explain import explain
from app.followup import followup
from app.main import app

BALL = {"scenario": "incline", "body": "ball", "mass": 1, "angle_deg": 30, "length": 2, "friction": 1,
        "gravity": 9.81, "confidence": 0.9, "assumptions": ["Default: mass 1 kg", "Default: g = 9.81 m/s^2"]}
client = TestClient(app)


class Fake:
    def __init__(self, *payloads):
        self.payloads = list(payloads)
        self.models = SimpleNamespace(generate_content=self._gen)

    def _gen(self, **_):
        p = self.payloads.pop(0)
        if isinstance(p, Exception):
            raise p
        return SimpleNamespace(text=json.dumps(p))


def test_change_applies_and_clears_stale_default():
    r = followup(BALL, "double the mass", Fake({"kind": "change", "changes": [{"field": "mass", "number_value": 2}]}))
    assert r["scene"].mass == 2 and r["changes"] == [{"field": "mass", "value": 2}]
    assert "Default: mass 1 kg" not in r["scene"].assumptions


def test_change_is_atomic_and_range_checked():
    bad = {"kind": "change", "changes": [{"field": "mass", "number_value": 2}, {"field": "angle_deg", "number_value": 120}]}
    with pytest.raises(AnalysisError) as e:
        followup(BALL, "x", Fake(bad))
    assert e.value.code == "invalid_change"


def test_non_whitelisted_field_rejected():
    with pytest.raises(AnalysisError) as e:
        followup(BALL, "x", Fake({"kind": "change", "changes": [{"field": "confidence", "number_value": 1}]}))
    assert e.value.code == "invalid_change"


def test_new_scene_uses_analysis():
    new = {"scenario": "incline", "body": "block", "angle_deg": 20}
    r = followup(BALL, "now a block", Fake({"kind": "new_scene", "description": "block on 20 degree slope"}, new))
    assert r["kind"] == "new_scene" and r["scene"].body == "block"


def test_unsupported_and_empty():
    with pytest.raises(AnalysisError):
        followup(BALL, "tell a joke", Fake({"kind": "unsupported", "reason": "no"}))
    with pytest.raises(AnalysisError):
        followup(BALL, "  ", Fake())


def test_replay_followup_needs_no_model(monkeypatch):
    monkeypatch.setenv("REPLAY_MODE", "true")
    assert followup(BALL, "anything")["scene"].mass == 2


VERIFIED = {"verdict": "match", "expected": {"time_to_end_s": 1.0685}, "measured": {"time_to_end_s": 1.07}}


def test_explain_model_and_fallback():
    assert explain(BALL, VERIFIED, "быстрее", Fake({"text": "ok"})) == ("ok", "model")
    text, source = explain(BALL, VERIFIED, "быстрее", Fake(RuntimeError("down")))
    assert source == "template" and "1.07" in text and "формула" in text


def test_explain_mismatch_fallback_warns():
    text, _ = explain(BALL, {"verdict": "mismatch"}, None, Fake(RuntimeError("down")))
    assert "not be trusted" in text


def test_prediction_and_session_journal_and_replay_save(monkeypatch, tmp_path):
    monkeypatch.setenv("TRACE_DIR", str(tmp_path / "t"))
    monkeypatch.setenv("REPLAY_DIR", str(tmp_path / "r"))
    h = {"x-session-id": "s1"}
    assert client.post("/api/v1/predictions", json={"text": "быстрее"}, headers=h).json()["recorded"]
    assert client.post("/api/v1/predictions", json={"text": ""}, headers=h).status_code == 400
    client.post("/api/v1/verify", json={"scene": BALL, "measured": {"moved": True, "time_to_end_s": 1.07}}, headers=h)
    saved = client.post("/api/v1/replay/demo", json={"session_id": "s1"})
    assert saved.json()["events"] == 2
    events = client.get("/api/v1/replay/demo").json()["events"]
    assert [e["event"] for e in events] == ["prediction", "verify"]
    assert client.post("/api/v1/replay/default", json={"session_id": "s1"}).status_code == 400
    assert client.post("/api/v1/replay/x", json={"session_id": "none"}).status_code == 404


def test_followup_api_rejects_invalid_scene():
    r = client.post("/api/v1/scenes/followup", json={"scene": {"scenario": "nope"}, "text": "x"})
    assert r.status_code == 400 and r.json()["code"] == "invalid_scene"
