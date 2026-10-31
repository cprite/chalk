import pytest
from pydantic import ValidationError

from app.scene import (
    Collision1DScene,
    InclineScene,
    PendulumScene,
    ProjectileScene,
    SceneAdapter,
)


def test_incline_valid():
    data = {
        "scenario": "incline",
        "body": "ball",
        "mass": 1.0,
        "angle_deg": 30.0,
        "length": 2.0,
        "friction": 0.5,
        "gravity": 9.81,
        "confidence": 0.95,
        "assumptions": ["frictionless ramp initially assumed"],
    }
    scene = SceneAdapter.validate_python(data)
    assert isinstance(scene, InclineScene)
    assert scene.body == "ball"


def test_extra_fields_rejected():
    data = {
        "scenario": "incline",
        "body": "ball",
        "mass": 1.0,
        "angle_deg": 30.0,
        "length": 2.0,
        "friction": 0.5,
        "gravity": 9.81,
        "confidence": 0.95,
        "assumptions": [],
        "extra_unexpected_field": "hacker_payload",
    }
    with pytest.raises(ValidationError, match="extra_unexpected_field"):
        SceneAdapter.validate_python(data)


@pytest.mark.parametrize(
    "field,bad_value",
    [
        ("angle_deg", 0.0),       # exclusiveMinimum: 0
        ("angle_deg", 90.0),      # exclusiveMaximum: 90
        ("angle_deg", -5.0),
        ("angle_deg", 95.0),
        ("mass", 0.0),            # exclusiveMinimum: 0
        ("mass", -1.0),
        ("mass", 1000.1),         # maximum: 1000
        ("length", 0.0),          # exclusiveMinimum: 0
        ("length", 100.1),        # maximum: 100
        ("friction", -0.01),      # minimum: 0
        ("friction", 2.01),       # maximum: 2
        ("gravity", 0.0),         # exclusiveMinimum: 0
        ("gravity", 30.1),        # maximum: 30
        ("confidence", -0.1),     # minimum: 0
        ("confidence", 1.1),      # maximum: 1
        ("body", "cylinder"),     # enum block, ball
    ],
)
def test_incline_out_of_range_rejected(field, bad_value):
    base = {
        "scenario": "incline",
        "body": "ball",
        "mass": 1.0,
        "angle_deg": 30.0,
        "length": 2.0,
        "friction": 0.5,
        "gravity": 9.81,
        "confidence": 1.0,
        "assumptions": [],
    }
    base[field] = bad_value
    with pytest.raises(ValidationError):
        SceneAdapter.validate_python(base)


def test_assumptions_length_and_item_count():
    base = {
        "scenario": "incline",
        "body": "ball",
        "mass": 1.0,
        "angle_deg": 30.0,
        "length": 2.0,
        "friction": 0.5,
        "gravity": 9.81,
        "confidence": 1.0,
        "assumptions": ["valid item"] * 9,  # maxItems is 8
    }
    with pytest.raises(ValidationError):
        SceneAdapter.validate_python(base)

    # Item exceeding 200 chars
    base["assumptions"] = ["x" * 201]
    with pytest.raises(ValidationError):
        SceneAdapter.validate_python(base)


def test_projectile_bounds():
    valid = {
        "scenario": "projectile",
        "mass": 1.0,
        "speed": 10.0,
        "angle_deg": 45.0,
        "height": 0.0,
        "gravity": 9.81,
        "confidence": 1.0,
        "assumptions": [],
    }
    scene = SceneAdapter.validate_python(valid)
    assert isinstance(scene, ProjectileScene)

    # Speed > 200
    invalid = dict(valid, speed=200.5)
    with pytest.raises(ValidationError):
        SceneAdapter.validate_python(invalid)


def test_pendulum_and_collision_valid():
    pendulum_data = {
        "scenario": "pendulum",
        "mass": 1.0,
        "length": 5.0,
        "angle_deg": 30.0,
        "gravity": 9.81,
        "confidence": 1.0,
        "assumptions": [],
    }
    assert isinstance(SceneAdapter.validate_python(pendulum_data), PendulumScene)

    collision_data = {
        "scenario": "collision_1d",
        "mass_a": 1.0,
        "mass_b": 2.0,
        "velocity_a": 5.0,
        "velocity_b": -2.0,
        "restitution": 0.8,
        "gravity": 9.81,
        "confidence": 1.0,
        "assumptions": [],
    }
    assert isinstance(SceneAdapter.validate_python(collision_data), Collision1DScene)
