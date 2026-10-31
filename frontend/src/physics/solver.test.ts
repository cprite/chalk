import { describe, expect, it } from "vitest";
import { createDemoScene } from "../integrations/backend";
import { solveIncline, solveProjectile, solvePendulum, solveCollision1D } from "./solver";

describe("Analytic & 120Hz Simulation Physics Solver", () => {
  it("verifies rolling ball acceleration is independent of mass and matches 5/7 g sin(theta)", () => {
    const baseScene = createDemoScene();
    const lightBall = solveIncline({ ...baseScene, body: "ball", mass: 1.0 });
    const heavyBall = solveIncline({ ...baseScene, body: "ball", mass: 10.0 });

    expect(lightBall.acceleration).toBeCloseTo(heavyBall.acceleration, 6);
    expect(lightBall.verdict.status).toBe("match");
    expect(lightBall.verdict.errorPct).toBeLessThanOrEqual(2.0);
  });

  it("handles sliding block static friction threshold tan(theta) <= mu", () => {
    const stationaryBlock = solveIncline({
      ...createDemoScene(),
      body: "block",
      angle_deg: 10,
      friction: 0.5, // tan(10°) ≈ 0.176 <= 0.5
    });
    expect(stationaryBlock.isStationary).toBe(true);
    expect(stationaryBlock.verdict.status).toBe("not_applicable");
  });

  it("solves projectile kinematics within 2% tolerance", () => {
    const res = solveProjectile({
      scenario: "projectile",
      mass: 2,
      speed: 12,
      angle_deg: 45,
      height: 1.5,
      gravity: 9.81,
      confidence: 0.95,
      assumptions: ["No air drag"],
    });
    expect(res.verdict.status).toBe("match");
    expect(res.verdict.errorPct).toBeLessThanOrEqual(2.0);
  });

  it("solves nonlinear pendulum and 1D collision", () => {
    const pend = solvePendulum({
      scenario: "pendulum",
      mass: 1,
      length: 2.0,
      angle_deg: 25,
      gravity: 9.81,
      confidence: 0.9,
      assumptions: [],
    });
    expect(pend.verdict.status).toBe("match");

    const col = solveCollision1D({
      scenario: "collision_1d",
      mass_a: 2,
      mass_b: 2,
      velocity_a: 3,
      velocity_b: 0,
      restitution: 1,
      gravity: 9.81,
      confidence: 0.9,
      assumptions: [],
    });
    expect(col.verdict.expectedSeconds).toBeCloseTo(3.0, 3);
  });
});
