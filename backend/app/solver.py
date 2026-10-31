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


def generative_solve(scene: Any) -> Expected:
    m = float(getattr(scene, "mass", 1.0))
    formula = getattr(scene, "formula", "")
    primary_law = getattr(scene, "primary_law", "Newtonian Mechanics")
    g = float(getattr(scene, "gravity", 9.81))

    objects = getattr(scene, "objects", [])
    spring_objs = [
        obj for obj in objects
        if getattr(obj, "type", "") == "spring" or (isinstance(obj, dict) and obj.get("type") == "spring")
    ]
    if spring_objs:
        k_values = [
            float(getattr(obj, "k", 100.0) or (obj.get("k", 100.0) if isinstance(obj, dict) else 100.0))
            for obj in spring_objs
        ]
        k_values = [k for k in k_values if k > 0]
        if k_values:
            k_eff = 1.0 / sum(1.0 / k for k in k_values) if len(k_values) > 1 else k_values[0]
            omega = math.sqrt(k_eff / m)
            T = 2.0 * math.pi / omega
            return Expected(
                moves=True,
                acceleration=omega * omega * 0.35,
                time_to_end_s=T,
                regime="simple_harmonic_motion",
                formula=f"T = 2*pi*sqrt(m/k_eff) = {T:.3f}s; k_eff = {k_eff:.1f} N/m",
            )

    return Expected(
        moves=True,
        acceleration=g,
        time_to_end_s=1.0,
        regime="generative_dynamic",
        formula=formula or f"{primary_law}: F_net = m*a",
    )


def collision_1d(scene: Any) -> Expected:
    """
    Analytic solver for 1D linear collision with coefficient of restitution e.
    Conservation of momentum: m_A * v_A + m_B * v_B = m_A * v_A' + m_B * v_B'
    Restitution: v_B' - v_A' = e * (v_A - v_B)
    """
    mA = float(getattr(scene, "mass_a", 1.0))
    mB = float(getattr(scene, "mass_b", 1.0))
    vA = float(getattr(scene, "velocity_a", 1.0))
    vB = float(getattr(scene, "velocity_b", 0.0))
    e = float(getattr(scene, "restitution", 1.0))

    if mA <= 0 or mB <= 0:
        raise Unsupported("Masses must be strictly positive")

    total_m = mA + mB
    vA_after = ((mA - e * mB) * vA + (1.0 + e) * mB * vB) / total_m
    vB_after = ((1.0 + e) * mA * vA + (mB - e * mA) * vB) / total_m

    rel_v = vA - vB
    t_collision = 2.0 / rel_v if rel_v > 0.001 else 1.0

    return Expected(
        moves=True,
        acceleration=0.0,
        time_to_end_s=t_collision,
        regime="linear_collision",
        formula=(
            f"v_A' = ((mA - e*mB)vA + (1+e)mB*vB)/(mA+mB) = {vA_after:.2f} m/s; "
            f"v_B' = ((1+e)mA*vA + (mB - e*mA)vB)/(mA+mB) = {vB_after:.2f} m/s"
        ),
    )


def solve(scene: Any) -> Expected:
    """General solver dispatch."""
    scen = getattr(scene, "scenario", None)
    if scen == "incline":
        return incline(scene)
    if scen == "spring":
        return spring(scene)
    if scen == "generative":
        return generative_solve(scene)
    if scen == "collision_1d":
        return collision_1d(scene)
    raise Unsupported(f"Scenario '{scen}' is unsupported")
