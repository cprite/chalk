import { describe, expect, it } from "vitest";
import { measureIncline } from "./rapierMeasure";
import type { InclineSceneSpec } from "../types";

const base: InclineSceneSpec = { scenario: "incline", body: "ball", mass: 1, angle_deg: 30, length: 2, friction: 1, gravity: 9.81, confidence: 1, assumptions: [] };
const rolling = (s: InclineSceneSpec) => Math.sqrt((2 * s.length) / ((5 / 7) * s.gravity * Math.sin((s.angle_deg * Math.PI) / 180)));
const sliding = (s: InclineSceneSpec) => {
  const t = (s.angle_deg * Math.PI) / 180;
  return Math.sqrt((2 * s.length) / (s.gravity * (Math.sin(t) - s.friction * Math.cos(t))));
};

describe("Rapier measurement agrees with the formulas within 2%", () => {
  const cases: [string, InclineSceneSpec, (s: InclineSceneSpec) => number][] = [
    ["rolling ball", base, rolling],
    ["rolling, heavy", { ...base, mass: 2 }, rolling],
    ["rolling, 45 deg, 4 m", { ...base, angle_deg: 45, length: 4, friction: 1 }, rolling],
    ["rolling on the Moon", { ...base, gravity: 1.62 }, rolling],
    ["ball with slip", { ...base, friction: 0.05 }, sliding],
    ["frictionless ball", { ...base, friction: 0 }, sliding],
    ["block", { ...base, body: "block", friction: 0.2 }, sliding],
    ["heavy block", { ...base, body: "block", friction: 0.2, mass: 50 }, sliding],
    ["block on a steep slope", { ...base, body: "block", friction: 0.2, angle_deg: 70 }, sliding],
    ["frictionless block", { ...base, body: "block", friction: 0, angle_deg: 45, length: 3 }, sliding],
  ];
  it.each(cases)("%s", async (_name, scene, formula) => {
    const m = await measureIncline(scene);
    expect(m.moved).toBe(true);
    expect(Math.abs((m.time_to_end_s as number) - formula(scene)) / formula(scene)).toBeLessThan(0.02);
  });

  it("static block stays put", async () => {
    expect(await measureIncline({ ...base, body: "block", friction: 0.8, angle_deg: 20 })).toEqual({ moved: false, time_to_end_s: null });
  });
});
