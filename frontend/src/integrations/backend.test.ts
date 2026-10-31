import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeSketch, BackendError, createDemoScene, sendFollowup, verifyMeasurement } from "./backend";

const reply = (status: number, body: unknown) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body === null ? "" : JSON.stringify(body), { status })));
const file = new File(["x"], "ramp.png", { type: "image/png" });

afterEach(() => vi.unstubAllGlobals());

describe("backend client", () => {
  it("the demo scene rolls without slipping", () => {
    const s = createDemoScene();
    expect(s.friction).toBeGreaterThanOrEqual((2 / 7) * Math.tan((s.angle_deg * Math.PI) / 180));
  });

  it("shows the backend's refusal instead of a demo scene", async () => {
    reply(400, { code: "unsupported_problem", message: "Not physics", trace_id: "t" });
    await expect(analyzeSketch(file)).rejects.toMatchObject({ code: "unsupported_problem", message: "Not physics" });
  });

  it("reports a stopped backend instead of a demo scene", async () => {
    reply(502, null);
    await expect(analyzeSketch(file)).rejects.toBeInstanceOf(BackendError);
  });

  it("refuses a scene this lab cannot show", async () => {
    reply(200, { scene: { scenario: "pendulum" }, changes: [] });
    await expect(sendFollowup(createDemoScene(), "pendulum")).rejects.toMatchObject({ code: "unsupported_problem" });
  });

  it("passes the backend verdict through unchanged", async () => {
    reply(200, { verdict: "mismatch", expected: { time_to_end_s: 1.5 }, measured: { moved: true, time_to_end_s: 2 }, error_pct: 33, tolerance_pct: 2, formula: "f" });
    const { verdict } = await verifyMeasurement(createDemoScene(), { moved: true, time_to_end_s: 2 });
    expect(verdict).toMatchObject({ status: "mismatch", expectedSeconds: 1.5, measuredSeconds: 2, errorPct: 33 });
  });
});
