import math
import pytest

from app.scene import InclineScene, ProjectileScene
from app.verify import verify


@pytest.fixture
def moving_ball_scene():
    return InclineScene(
        scenario="incline",
        body="ball",
        mass=1.0,
        angle_deg=30.0,
        length=2.0,
        friction=0.5,
        gravity=9.81,
        confidence=1.0,
        assumptions=[],
    )


@pytest.fixture
def static_block_scene():
    return InclineScene(
        scenario="incline",
        body="block",
        mass=1.0,
        angle_deg=30.0,
        length=2.0,
        friction=0.7,
        gravity=9.81,
        confidence=1.0,
        assumptions=[],
    )


def test_verify_match_within_tolerance(moving_ball_scene):
    # Expected time is ~1.0685 s
    res = verify(moving_ball_scene, {"moved": True, "time_to_end_s": 1.07})
    assert res["verdict"] == "match"
    assert res["tolerance_pct"] == 2.0
    assert res["error_pct"] is not None
    assert res["error_pct"] < 2.0
    assert "formula" in res


def test_verify_mismatch_outside_tolerance(moving_ball_scene):
    res = verify(moving_ball_scene, {"moved": True, "time_to_end_s": 1.25})
    assert res["verdict"] == "mismatch"
    assert res["error_pct"] is not None
    assert res["error_pct"] > 2.0


def test_verify_two_percent_boundary():
    # Setup scene with known analytical time of exactly ~1.0685
    scene = InclineScene(
        scenario="incline",
        body="ball",
        mass=1.0,
        angle_deg=30.0,
        length=2.0,
        friction=0.5,
        gravity=9.81,
        confidence=1.0,
        assumptions=[],
    )
    # Expected time
    from app.solver import incline
    exp_t = incline(scene).time_to_end_s
    assert exp_t is not None

    # Exactly +2.0%
    t_exact_plus_2pct = exp_t * 1.020000000001
    res_plus_boundary = verify(scene, {"moved": True, "time_to_end_s": exp_t * 1.02})
    assert res_plus_boundary["verdict"] == "match"
    assert res_plus_boundary["error_pct"] == 2.0

    # Just above 2% (+2.1%)
    res_plus_exceeded = verify(scene, {"moved": True, "time_to_end_s": exp_t * 1.021})
    assert res_plus_exceeded["verdict"] == "mismatch"

    # Exactly -2.0%
    res_minus_boundary = verify(scene, {"moved": True, "time_to_end_s": exp_t * 0.98})
    assert res_minus_boundary["verdict"] == "match"
    assert res_minus_boundary["error_pct"] == 2.0

    # Just below -2% (-2.1%)
    res_minus_exceeded = verify(scene, {"moved": True, "time_to_end_s": exp_t * 0.979})
    assert res_minus_exceeded["verdict"] == "mismatch"


def test_verify_static_block_match_iff_not_moved(static_block_scene):
    # Static: match iff moved is False
    res_match = verify(static_block_scene, {"moved": False, "time_to_end_s": None})
    assert res_match["verdict"] == "match"
    assert res_match["error_pct"] == 0.0

    # If it moved in simulation, mismatch!
    res_mismatch = verify(static_block_scene, {"moved": True, "time_to_end_s": 1.5})
    assert res_mismatch["verdict"] == "mismatch"


def test_verify_moving_mismatch_if_not_moved_or_no_time(moving_ball_scene):
    # Should move, but simulation reported moved=False
    res_not_moved = verify(moving_ball_scene, {"moved": False, "time_to_end_s": None})
    assert res_not_moved["verdict"] == "mismatch"

    # Should move, moved=True, but time_to_end_s is None
    res_no_time = verify(moving_ball_scene, {"moved": True, "time_to_end_s": None})
    assert res_no_time["verdict"] == "mismatch"


def test_verify_rejects_non_finite_or_non_positive_time(moving_ball_scene):
    # Zero time
    with pytest.raises(ValueError, match="positive"):
        verify(moving_ball_scene, {"moved": True, "time_to_end_s": 0.0})

    # Negative time
    with pytest.raises(ValueError, match="positive"):
        verify(moving_ball_scene, {"moved": True, "time_to_end_s": -1.5})

    # NaN
    with pytest.raises(ValueError, match="finite"):
        verify(moving_ball_scene, {"moved": True, "time_to_end_s": float("nan")})

    # Infinity
    with pytest.raises(ValueError, match="finite"):
        verify(moving_ball_scene, {"moved": True, "time_to_end_s": float("inf")})


def test_verify_unsupported_scenario_returns_not_applicable():
    proj = ProjectileScene(
        scenario="projectile",
        mass=1.0,
        speed=10.0,
        angle_deg=45.0,
        height=0.0,
        gravity=9.81,
        confidence=1.0,
        assumptions=[],
    )
    res = verify(proj, {"moved": True, "time_to_end_s": 1.2})
    assert res["verdict"] == "not_applicable"
    assert res["expected"] is None
    assert res["error_pct"] is None
    assert res["tolerance_pct"] == 2.0
