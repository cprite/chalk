import pytest
from pydantic import ValidationError

from app.patch import ALLOWED_PATCH_FIELDS, apply_patch
from app.scene import InclineScene, ProjectileScene


@pytest.fixture
def incline_scene():
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


def test_patch_whitelist_allowed_fields(incline_scene):
    # Allowed: mass, angle_deg, length, friction, gravity, body
    p1 = apply_patch(incline_scene, "mass", 5.0)
    assert p1.mass == 5.0

    p2 = apply_patch(incline_scene, "angle_deg", 45.0)
    assert p2.angle_deg == 45.0

    p3 = apply_patch(incline_scene, "length", 10.0)
    assert p3.length == 10.0

    p4 = apply_patch(incline_scene, "friction", 0.1)
    assert p4.friction == 0.1

    p5 = apply_patch(incline_scene, "gravity", 1.62)
    assert p5.gravity == 1.62

    p6 = apply_patch(incline_scene, "body", "block")
    assert p6.body == "block"


def test_patch_projectile_fields():
    proj = ProjectileScene(
        scenario="projectile",
        mass=1.0,
        speed=10.0,
        angle_deg=45.0,
        height=5.0,
        gravity=9.81,
        confidence=1.0,
        assumptions=[],
    )
    p_speed = apply_patch(proj, "speed", 25.0)
    assert p_speed.speed == 25.0

    p_height = apply_patch(proj, "height", 12.0)
    assert p_height.height == 12.0


@pytest.mark.parametrize("disallowed_field", ["confidence", "assumptions", "scenario", "fake_field", "model"])
def test_patch_disallowed_fields_rejected(incline_scene, disallowed_field):
    with pytest.raises(ValueError, match="not in allowed patch fields"):
        apply_patch(incline_scene, disallowed_field, 123)


def test_patch_revalidation_rejects_out_of_bounds(incline_scene):
    # angle_deg must be < 90
    with pytest.raises(ValidationError):
        apply_patch(incline_scene, "angle_deg", 95.0)

    # mass must be > 0
    with pytest.raises(ValidationError):
        apply_patch(incline_scene, "mass", -2.0)

    # body must be "block" or "ball"
    with pytest.raises(ValidationError):
        apply_patch(incline_scene, "body", "cube")


def test_patch_field_not_supported_by_scenario(incline_scene):
    # 'speed' is in ALLOWED_PATCH_FIELDS (for projectile), but incline forbids extra fields!
    with pytest.raises(ValidationError):
        apply_patch(incline_scene, "speed", 15.0)
