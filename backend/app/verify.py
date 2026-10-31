from dataclasses import asdict
import math
from typing import Any, Mapping

from .scene import SceneAdapter
from .solver import Unsupported, incline


def verify(scene: Any, measured: Mapping[str, Any] | Any) -> dict[str, Any]:
    """
    Compare measured simulation trajectory outcome against analytical expectation.
    tolerance_pct = 2.0.
    verdict: "match" | "mismatch" | "not_applicable"
    """
    if isinstance(scene, dict):
        scene = SceneAdapter.validate_python(scene)

    if isinstance(measured, Mapping):
        if "moved" not in measured:
            raise ValueError("measured must contain 'moved'")
        moved = measured["moved"]
        time_to_end_s = measured.get("time_to_end_s")
    else:
        moved = getattr(measured, "moved", None)
        time_to_end_s = getattr(measured, "time_to_end_s", None)

    if not isinstance(moved, bool):
        raise ValueError("measured.moved must be a boolean")

    if time_to_end_s is not None:
        if isinstance(time_to_end_s, bool) or not isinstance(time_to_end_s, (int, float)):
            raise ValueError("measured.time_to_end_s must be a number or None")
        if not math.isfinite(time_to_end_s):
            raise ValueError("measured.time_to_end_s must be finite")
        if time_to_end_s <= 0:
            raise ValueError("measured.time_to_end_s must be strictly positive")
        time_to_end_s = float(time_to_end_s)

    tolerance_pct = 2.0
    measured_dict = {"moved": moved, "time_to_end_s": time_to_end_s}

    try:
        expected = incline(scene)
    except Unsupported:
        return {
            "verdict": "not_applicable",
            "expected": None,
            "measured": measured_dict,
            "error_pct": None,
            "tolerance_pct": tolerance_pct,
            "formula": None,
        }

    expected_dict = asdict(expected)

    if not expected.moves:
        # Static regime: match iff moved is False
        if not moved:
            verdict = "match"
            error_pct = 0.0
        else:
            verdict = "mismatch"
            error_pct = None
    else:
        # Moving regime: mismatch if not moved or no time
        if not moved or time_to_end_s is None:
            verdict = "mismatch"
            error_pct = None
        else:
            exp_time = expected.time_to_end_s
            assert exp_time is not None and exp_time > 0
            error_pct = abs(time_to_end_s - exp_time) / exp_time * 100.0
            # Rounded so a value exactly on the tolerance is not lost to float error.
            verdict = "match" if round(error_pct, 9) <= tolerance_pct else "mismatch"

    return {
        "verdict": verdict,
        "expected": expected_dict,
        "measured": measured_dict,
        "error_pct": round(error_pct, 4) if error_pct is not None else None,
        "tolerance_pct": tolerance_pct,
        "formula": expected.formula,
    }
