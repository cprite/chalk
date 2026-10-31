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


def spring(scene: Any) -> Expected:
    """
    Analytic solver for a vertical simple harmonic oscillator / spring system.
    T = 2 * pi * sqrt(m / k_eff)
    """
    if getattr(scene, "scenario", None) != "spring":
        raise Unsupported(f"Scenario '{getattr(scene, 'scenario', None)}' is unsupported")

    m = float(scene.mass)
    k = float(scene.spring_constant)
    if k <= 0 or m <= 0:
        raise Unsupported("Mass and spring constant must be strictly positive")

    omega = math.sqrt(k / m)
    T = 2.0 * math.pi / omega
    freq = 1.0 / T
    static_ext = (m * scene.gravity) / k
    A = getattr(scene, "amplitude", 0.35)
    a_max = omega * omega * A

    return Expected(
        moves=True,
        acceleration=a_max,
        time_to_end_s=T,
        regime="simple_harmonic_motion",
        formula=f"T = 2*pi*sqrt(m/k) = {T:.3f}s; f = {freq:.2f}Hz; delta_x = {static_ext:.3f}m; a_max = {a_max:.2f}m/s^2",
    )


def solve(scene: Any) -> Expected:
    """General solver dispatch."""
    scen = getattr(scene, "scenario", None)
    if scen == "incline":
        return incline(scene)
    if scen == "spring":
        return spring(scene)
    raise Unsupported(f"Scenario '{scen}' is unsupported")
