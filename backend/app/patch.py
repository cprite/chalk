from typing import Any
from .scene import SceneAdapter, SceneSpec

ALLOWED_PATCH_FIELDS = frozenset({
    "mass",
    "angle_deg",
    "length",
    "friction",
    "gravity",
    "body",
    "speed",
    "height",
})


def apply_patch(scene: Any, field: str, value: Any) -> SceneSpec:
    """
    Apply a single field patch to a SceneSpec.
    Only fields mass, angle_deg, length, friction, gravity, body, speed, height are allowed.
    Re-validates with SceneSpec and returns the updated model.
    """
    if field not in ALLOWED_PATCH_FIELDS:
        raise ValueError(
            f"Field '{field}' is not in allowed patch fields: {sorted(ALLOWED_PATCH_FIELDS)}"
        )

    if hasattr(scene, "model_dump"):
        data = scene.model_dump()
    elif isinstance(scene, dict):
        data = dict(scene)
    else:
        raise TypeError("scene must be a SceneSpec instance or dict")

    data[field] = value
    return SceneAdapter.validate_python(data)


# Assumptions that stop being true once the user sets the field themselves.
STALE_NOTES = {
    "mass": ("Default: mass",),
    "length": ("Default: slope length",),
    "friction": ("Default: ball rolls", "Default: frictionless"),
    "gravity": ("Default: g",),
}


def apply_changes(scene: Any, changes: list[tuple[str, Any]]) -> SceneSpec:
    """Apply several changes atomically: one invalid change rejects them all."""
    current = SceneAdapter.validate_python(scene) if isinstance(scene, dict) else scene
    for field, value in changes:
        current = apply_patch(current, field, value)
        stale = STALE_NOTES.get(field, ())
        current.assumptions = [a for a in current.assumptions if not a.startswith(stale)] if stale else current.assumptions
    return current
