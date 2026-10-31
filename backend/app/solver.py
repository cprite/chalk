from dataclasses import dataclass
import math
from typing import Any, Optional


class Unsupported(Exception):
    """Raised when a scenario is not supported by the analytic solver."""
    pass


@dataclass
class Expected:
    moves: bool
    acceleration: float
    time_to_end_s: Optional[float]
    regime: str
    formula: str


def incline(scene: Any) -> Expected:
    """
    Pure analytic solver for an incline problem.
    No I/O. Mass must not appear in any formula or computation.
    """
    if getattr(scene, "scenario", None) != "incline":
        raise Unsupported(f"Scenario '{getattr(scene, 'scenario', None)}' is unsupported")

    theta_rad = math.radians(scene.angle_deg)
    sin_theta = math.sin(theta_rad)
    cos_theta = math.cos(theta_rad)
    tan_theta = math.tan(theta_rad)

    g = scene.gravity
    length = scene.length
    friction = scene.friction
    body = scene.body

    if body == "block":
        if tan_theta <= friction:
            return Expected(
                moves=False,
                acceleration=0.0,
                time_to_end_s=None,
                regime="static",
                formula="static: tan(theta) <= friction",
            )
        else:
            a = g * (sin_theta - friction * cos_theta)
            t = math.sqrt(2.0 * length / a)
            return Expected(
                moves=True,
                acceleration=a,
                time_to_end_s=t,
                regime="sliding",
                formula="a = g*(sin(theta) - friction*cos(theta)); t = sqrt(2*L/a)",
            )
    elif body == "ball":
        critical_friction = (2.0 / 7.0) * tan_theta
        if friction >= critical_friction:
            a = (5.0 / 7.0) * g * sin_theta
            t = math.sqrt(2.0 * length / a)
            return Expected(
                moves=True,
                acceleration=a,
                time_to_end_s=t,
                regime="rolling",
                formula="a = (5/7)*g*sin(theta); t = sqrt(2*L/a)",
            )
        else:
            a = g * (sin_theta - friction * cos_theta)
            t = math.sqrt(2.0 * length / a)
            return Expected(
                moves=True,
                acceleration=a,
                time_to_end_s=t,
                regime="rolling_with_slip",
                formula="a = g*(sin(theta) - friction*cos(theta)); t = sqrt(2*L/a)",
            )
    else:
        raise Unsupported(f"Body type '{body}' is not supported")


def solve(scene: Any) -> Expected:
    """General solver dispatch."""
    if getattr(scene, "scenario", None) == "incline":
        return incline(scene)
    raise Unsupported(f"Scenario '{getattr(scene, 'scenario', None)}' is unsupported")
