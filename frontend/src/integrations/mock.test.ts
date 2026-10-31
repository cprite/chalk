import { describe, expect, it } from "vitest";
import { analyzeSketch, createDemoScene, verifySimulation } from "./mock";
import { completeVoiceTurn } from "./live";

describe("mock integration adapters", () => {
  it("returns a valid incline scene after a drawing analysis", async () => {
    const scene = await analyzeSketch(new File(["sketch"], "ramp.png", { type: "image/png" }));

    expect(scene.scenario).toBe("incline");
    expect(scene.angle_deg).toBeGreaterThan(0);
    expect(scene.assumptions).not.toHaveLength(0);
  });

  it("reports a close theory-versus-simulation match for the demo scene", async () => {
    const verdict = await verifySimulation(createDemoScene());

    expect(verdict.status).toBe("match");
    expect(verdict.errorPct).toBeLessThanOrEqual(verdict.tolerancePct);
  });

  it("moves the mock voice client from thinking to speaking", async () => {
    const states: string[] = [];
    const response = await completeVoiceTurn("What changes on a steeper ramp?", (state) => states.push(state));

    expect(states).toEqual(["thinking", "speaking"]);
    expect(response).toContain("steeper ramp");
  });
});
