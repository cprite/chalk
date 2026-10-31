import math
from backend.app.scene import SpringScene, SceneAdapter
from backend.app.solver import solve, spring
from backend.app.verify import verify
from backend.app.analyze import FlatAnalysisResponse, _convert_flat_to_scene


def test_spring_scene_validation():
    s = SpringScene(
        scenario="spring",
        mass=5.0,
        spring_constant=120.0,
        spring_count=2,
        arrangement="series",
        amplitude=0.35,
        confidence=0.95,
        assumptions=["Springs in series"],
        gravity=9.81,
    )
    assert s.mass == 5.0
    assert s.spring_constant == 120.0
    assert s.spring_count == 2
    assert s.arrangement == "series"

    serialized = s.model_dump()
    parsed = SceneAdapter.validate_python(serialized)
    assert isinstance(parsed, SpringScene)


def test_spring_analytic_solver():
    s = SpringScene(
        scenario="spring",
        mass=5.0,
        spring_constant=120.0,
        spring_count=2,
        arrangement="series",
        amplitude=0.35,
        confidence=0.95,
        assumptions=[],
        gravity=9.81,
    )
    expected = solve(s)
    assert expected.moves is True
    assert expected.regime == "simple_harmonic_motion"

    omega = math.sqrt(120.0 / 5.0)  # sqrt(24) = 4.89898
    expected_T = 2.0 * math.pi / omega  # ~1.28255 s
    assert math.isclose(expected.time_to_end_s, expected_T, rel_tol=1e-3)


def test_spring_verification():
    s = SpringScene(
        scenario="spring",
        mass=5.0,
        spring_constant=120.0,
        spring_count=2,
        arrangement="series",
        amplitude=0.35,
        confidence=0.95,
        assumptions=[],
        gravity=9.81,
    )
    expected_T = 2.0 * math.pi / math.sqrt(120.0 / 5.0)

    # 1% error should match (< 2% tolerance)
    v_match = verify(s, {"moved": True, "time_to_end_s": expected_T * 1.01})
    assert v_match["verdict"] == "match"

    # 10% error should mismatch (> 2% tolerance)
    v_mismatch = verify(s, {"moved": True, "time_to_end_s": expected_T * 1.10})
    assert v_mismatch["verdict"] == "mismatch"


def test_spring_series_calculation_from_sketch():
    # User's sketch: k1 = 200, k2 = 300, mass = 5kg in series
    flat = FlatAnalysisResponse(
        scenario="spring",
        confidence=0.95,
        mass=5.0,
        k1=200.0,
        k2=300.0,
        arrangement="series",
        spring_count=2,
    )
    scene = _convert_flat_to_scene(flat)
    assert isinstance(scene, SpringScene)
    assert scene.mass == 5.0
    # 1/k = 1/200 + 1/300 = 5/600 -> k = 120 N/m
    assert math.isclose(scene.spring_constant, 120.0, rel_tol=1e-3)
    assert scene.arrangement == "series"
    assert scene.spring_count == 2
