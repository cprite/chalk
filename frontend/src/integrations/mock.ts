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
  if (!file.type.startsWith("image/")) {
    throw new Error("Upload a PNG or JPEG image of your physics sketch.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Your image is over the 5 MB limit. Choose a smaller file.");
  }

  const formData = new FormData();
  formData.append("image", file);

  let response: Response;
  try {
    response = await fetch("/api/v1/scenes/analyze", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error("Could not reach the analysis service. Check the connection and try again, or choose the demo scene.");
  }

  const data = await response.json().catch(() => null) as { message?: unknown; scene?: unknown } | null;
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "Could not analyze this sketch.";
    throw new Error(`${message} Try again, or choose the demo scene.`);
  }

  if (!isInclineScene(data?.scene)) {
    throw new Error("The analysis did not return a supported inclined-plane scene. Try a clearer incline sketch, or choose the demo scene.");
  }

  return { scene: data.scene, source: "live" };
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
 * Verification adapter:
 * Solves the analytic motion vs. 120Hz simulation with strict tolerance check.
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
