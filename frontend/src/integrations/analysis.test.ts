import { describe, expect, it } from "vitest";
import {analyzeSketch, createDemoScene} from "./backend";
import { completeVoiceTurn } from "./live";

describe("mock integration adapters", () => {
  it("returns a live-source incline scene after a successful drawing analysis", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ scene: createDemoScene() }), { status: 200 });

    try {
      const result = await analyzeSketch(new File(["sketch"], "ramp.png", { type: "image/png" }));

      expect(result.source).toBe("live");
      expect(result.scene.scenario).toBe("incline");
      if (result.scene.scenario === "incline") {
        expect(result.scene.angle_deg).toBeGreaterThan(0);
      }
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

  it("uses the direct backend only as a live-analysis retry", async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls: string[] = [];
    globalThis.fetch = async (input) => {
      requestedUrls.push(String(input));
      return requestedUrls.length === 1
        ? new Response(JSON.stringify({ message: "Proxy unavailable." }), { status: 503 })
        : new Response(JSON.stringify({ scene: createDemoScene() }), { status: 200 });
    };

    try {
      const result = await analyzeSketch(new File(["sketch"], "ramp.png", { type: "image/png" }));

      expect(result.source).toBe("live");
      expect(requestedUrls).toEqual([
        "/api/v1/scenes/analyze",
        "http://127.0.0.1:8000/api/v1/scenes/analyze",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("moves the mock voice client from thinking to speaking", async () => {
    const states: string[] = [];
    const response = await completeVoiceTurn("What changes on a steeper ramp?", (state) => states.push(state));

    expect(states).toEqual(["thinking", "speaking"]);
    expect(response).toContain("steeper ramp");
  });
});
