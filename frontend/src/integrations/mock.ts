import type { InclineSceneSpec, VerificationVerdict } from "../types";

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export const createDemoScene = (): InclineSceneSpec => ({
  scenario: "incline",
  body: "ball",
  mass: 1,
  angle_deg: 30,
  length: 4,
  friction: 0.12,
  gravity: 9.81,
  confidence: 0.94,
  assumptions: ["Rolling without slipping", "No air resistance"],
});

export type AnalysisResult = {
  scene: InclineSceneSpec;
  source: "live";
};

/** Calls the validated FastAPI analysis endpoint. Demo use is an explicit UI action. */
export async function analyzeSketch(file: File): Promise<AnalysisResult> {
  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    throw new Error("Upload a PNG or JPEG image of your physics sketch.");
  }

  // Prefer relative /api proxy (same-origin, zero CORS issues in all browsers),
  // fallback to direct backend port 8000.
  const urls = ["/api/v1/scenes/analyze", "http://127.0.0.1:8000/api/v1/scenes/analyze"];
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null) as { message?: unknown; scene?: unknown } | null;
      if (!response.ok) {
        const message = typeof data?.message === "string" ? data.message : "Could not analyze this sketch.";
        lastError = new Error(message);
        continue;
      }

      if (!isInclineScene(data?.scene)) {
        lastError = new Error("The analysis did not return a supported inclined-plane scene.");
        continue;
      }

      return { scene: data.scene, source: "live" };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const message = lastError?.message ?? "Could not reach the analysis service.";
  throw new Error(`${message} Try again, or choose the demo scene.`);
}

function isInclineScene(scene: unknown): scene is InclineSceneSpec {
  if (!scene || typeof scene !== "object") return false;
  const candidate = scene as Partial<InclineSceneSpec>;
  return candidate.scenario === "incline" &&
    (candidate.body === "ball" || candidate.body === "block") &&
    typeof candidate.mass === "number" &&
    typeof candidate.angle_deg === "number" &&
    typeof candidate.length === "number" &&
    typeof candidate.friction === "number" &&
    typeof candidate.gravity === "number" &&
    typeof candidate.confidence === "number" &&
    Array.isArray(candidate.assumptions);
}

/**
 * Verification adapter
 */
export async function verifySimulation(scene: InclineSceneSpec): Promise<VerificationVerdict> {
  await wait(650);
  const acceleration =
    scene.body === "ball"
      ? (5 / 7) * scene.gravity * Math.sin((scene.angle_deg * Math.PI) / 180)
      : scene.gravity *
        (Math.sin((scene.angle_deg * Math.PI) / 180) -
          scene.friction * Math.cos((scene.angle_deg * Math.PI) / 180));
  const expectedSeconds = Math.sqrt((2 * scene.length) / Math.max(acceleration, 0.01));
  const measuredSeconds = expectedSeconds * 1.008;
  const errorPct = Math.abs((measuredSeconds - expectedSeconds) / expectedSeconds) * 100;

  return {
    source: "mock",
    status: errorPct <= 2 ? "match" : "mismatch",
    expectedSeconds,
    measuredSeconds,
    errorPct,
    tolerancePct: 2,
  };
}
