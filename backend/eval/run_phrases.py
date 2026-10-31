"""Score dictated phrases against fixtures/phrases.json with the real model."""
import json
import math
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.analyze import AnalysisError, analyze_text  # noqa: E402
from app.followup import followup  # noqa: E402

BASE = {"scenario": "incline", "body": "ball", "mass": 1, "angle_deg": 30, "length": 2, "friction": 1,
        "gravity": 9.81, "confidence": 0.9, "assumptions": []}


def check(case, run):
    try:
        got = run(case["text"])
    except AnalysisError as e:
        ok = case.get("expect_error") == e.code
        return ok, case["text"], f"error {e.code}: {e.message[:80]}"
    if "expect_error" in case:
        return False, case["text"], f"expected {case['expect_error']}, got {got}"
    wrong = {k: got.get(k) for k, v in case["expect"].items()
             if not (math.isclose(got.get(k) or 0, v, abs_tol=0.01) if isinstance(v, (int, float)) else got.get(k) == v)}
    return not wrong, case["text"], f"wrong {wrong}" if wrong else "ok"


def main():
    data = json.loads((ROOT / "fixtures" / "phrases.json").read_text(encoding="utf-8"))
    runs = [(c, lambda t: analyze_text(t).model_dump()) for c in data["scenes"]]
    runs += [(c, lambda t: followup(BASE, t)["scene"].model_dump()) for c in data["followups"]]
    with ThreadPoolExecutor(4) as pool:
        results = list(pool.map(lambda r: check(*r), runs))
    for ok, text, detail in results:
        print("PASS" if ok else "FAIL", text, "->", detail)
    print(f"{sum(r[0] for r in results)}/{len(results)}")


if __name__ == "__main__":
    main()
