import { describe, expect, it } from "vitest";
import { getAnalysisSuccess, startsWithWord } from "./App";

describe("startsWithWord", () => {
  it("handles Russian and English", () => {
    expect(startsWithWord("Я думаю тяжёлый быстрее", "думаю|я думаю")).toBe(true);
    expect(startsWithWord("I think it is faster", "i think")).toBe(true);
    expect(startsWithWord("Запусти", "запусти")).toBe(true);
    expect(startsWithWord("Запустить ракету на Луну", "запусти")).toBe(false);
    expect(startsWithWord("running shoes", "run")).toBe(false);
  });
});

describe("getAnalysisSuccess", () => {
  it("describes each backend-supported scene without reading unrelated fields", () => {
    expect(getAnalysisSuccess({
      scenario: "incline", body: "ball", mass: 2, angle_deg: 30, length: 4, friction: 0.2, gravity: 9.81, confidence: 1, assumptions: [],
    })).toBe("Live analysis: 30° slope · 2 kg ball");
    expect(getAnalysisSuccess({
      scenario: "spring", mass: 3, spring_constant: 120, spring_count: 2, arrangement: "series", amplitude: 0.2, gravity: 9.81, confidence: 1, assumptions: [],
    })).toBe("Live analysis: 2 springs in series · 3 kg");
    expect(getAnalysisSuccess({
      scenario: "collision_1d", mass_a: 2, mass_b: 1, velocity_a: 3, velocity_b: -1, restitution: 1, gravity: 9.81, confidence: 1, assumptions: [],
    })).toBe("Live analysis: 1D collision · Cart A: 2 kg (3 m/s) · Cart B: 1 kg (-1 m/s)");
    expect(getAnalysisSuccess({
      scenario: "generative", title: "Pulley rig", primary_law: "Newton's laws", formula: "F = ma", mass: 1, objects: [], gravity: 9.81, confidence: 1, assumptions: [],
    })).toBe("Live analysis: Pulley rig");
  });
});
