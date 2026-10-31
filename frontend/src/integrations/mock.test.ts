import { describe, expect, it } from "vitest";
import { analyzeSketch, createDemoScene, verifySimulation } from "./mock";
import { completeVoiceTurn } from "./live";

describe("mock integration adapters", () => {
  it("returns a live-source incline scene after a successful drawing analysis", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ scene: createDemoScene() }), { status: 200 });

    try {
      const result = await analyzeSketch(new File(["sketch"], "ramp.png", { type: "image/png" }));

      expect(result.source).toBe("live");
      expect(result.scene.scenario).toBe("incline");
      expect(result.scene.angle_deg).toBeGreaterThan(0);
      expect(result.scene.assumptions).not.toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("surfaces an analysis failure instead of silently loading a demo scene", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "Analysis service is unavailable." }), { status: 503 });

    try {
      await expect(analyzeSketch(new File(["sketch"], "ramp.png", { type: "image/png" })))
        .rejects.toThrow("Analysis service is unavailable.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reports a close theory-versus-simulation match for the demo scene", async () => {
    const verdict = await verifySimulation(createDemoScene());

    expect(verdict.source).toBe("mock");
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
