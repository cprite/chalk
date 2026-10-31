import math
import pytest

from app.scene import InclineScene, ProjectileScene
from app.solver import Expected, Unsupported, incline, solve


def test_ball_incline_hand_computed():
    """Ball on incline: 30 deg, L=2, mu=0.5, g=9.81 -> a=3.5036, t=1.0685."""
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
    res = incline(scene)
    assert res.moves is True
    assert res.regime == "rolling"
    assert round(res.acceleration, 4) == 3.5036
    assert res.time_to_end_s is not None
    assert round(res.time_to_end_s, 4) == 1.0685


def test_block_incline_hand_computed():
    """Block on incline: 30 deg, mu=0.2, L=2, g=9.81 -> a=3.2059, t=1.1170."""
    scene = InclineScene(
        scenario="incline",
        body="block",
        mass=2.5,
        angle_deg=30.0,
        length=2.0,
        friction=0.2,
        gravity=9.81,
        confidence=1.0,
        assumptions=[],
    )
    res = incline(scene)
    assert res.moves is True
    assert res.regime == "sliding"
    assert round(res.acceleration, 4) == 3.2059
    assert res.time_to_end_s is not None
    assert round(res.time_to_end_s, 4) == 1.1170


def test_mass_independence():
    """Mass must not affect kinematics, and must not appear in any formula."""
    base_kwargs = dict(
        scenario="incline",
        body="ball",
        angle_deg=30.0,
        length=2.0,
        friction=0.5,
        gravity=9.81,
        confidence=1.0,
        assumptions=[],
    )

    res_1kg = incline(InclineScene(mass=1.0, **base_kwargs))
    res_10kg = incline(InclineScene(mass=10.0, **base_kwargs))
    res_500kg = incline(InclineScene(mass=500.0, **base_kwargs))

    assert res_1kg.acceleration == res_10kg.acceleration == res_500kg.acceleration
    assert res_1kg.time_to_end_s == res_10kg.time_to_end_s == res_500kg.time_to_end_s
    assert res_1kg.regime == res_10kg.regime == res_500kg.regime

    # Ensure "mass" does not appear in formula
    assert "mass" not in res_1kg.formula.lower()

    # Test also for block
    block_1kg = incline(InclineScene(mass=1.0, body="block", angle_deg=30.0, length=2.0, friction=0.2, gravity=9.81, confidence=1.0, assumptions=[]))
    block_100kg = incline(InclineScene(mass=100.0, body="block", angle_deg=30.0, length=2.0, friction=0.2, gravity=9.81, confidence=1.0, assumptions=[]))
    assert block_1kg.acceleration == block_100kg.acceleration
    assert "mass" not in block_1kg.formula.lower()


def test_static_block():
    """If tan(theta) <= friction -> moves False, regime static."""
    # tan(30 deg) = 0.57735... <= 0.6 friction
    scene = InclineScene(
        scenario="incline",
        body="block",
        mass=1.0,
        angle_deg=30.0,
        length=2.0,
        friction=0.6,
        gravity=9.81,
        confidence=1.0,
        assumptions=[],
    )
    res = incline(scene)
    assert res.moves is False
    assert res.regime == "static"
    assert res.acceleration == 0.0
    assert res.time_to_end_s is None
    assert "mass" not in res.formula.lower()


def test_ball_slip_boundary():
    """
    Ball: if friction >= (2/7)tan(theta) -> rolling
    else -> rolling_with_slip
    """
    angle = 30.0
    tan_theta = math.tan(math.radians(angle))
    crit_friction = (2.0 / 7.0) * tan_theta  # approx 0.164957

    # Above boundary: rolling
    scene_roll = InclineScene(
        scenario="incline",
        body="ball",
        mass=1.0,
        angle_deg=angle,
        length=2.0,
        friction=crit_friction + 0.05,
        gravity=9.81,
        confidence=1.0,
        assumptions=[],
    )
    res_roll = incline(scene_roll)
    assert res_roll.regime == "rolling"
    assert res_roll.moves is True

    # Below boundary: rolling_with_slip
    scene_slip = InclineScene(
        scenario="incline",
        body="ball",
        mass=1.0,
        angle_deg=angle,
        length=2.0,
        friction=crit_friction - 0.05,
        gravity=9.81,
        confidence=1.0,
        assumptions=[],
    )
    res_slip = incline(scene_slip)
    assert res_slip.regime == "rolling_with_slip"
    assert res_slip.moves is True
    assert "mass" not in res_slip.formula.lower()


def test_unsupported_scenario_raises():
    """Other scenarios raise Unsupported."""
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
    with pytest.raises(Unsupported):
        incline(proj)

    with pytest.raises(Unsupported):
        solve(proj)
