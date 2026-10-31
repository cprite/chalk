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

/** Temporary Argon adapter. Its public shape mirrors POST /api/v1/scenes/analyze. */
export async function analyzeSketch(file: File): Promise<InclineSceneSpec> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Upload a PNG or JPEG image of your physics sketch.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Your image is over the 5 MB limit. Choose a smaller file.");
  }

  await wait(850);
  return createDemoScene();
}

/** Temporary verification adapter. Replace with POST /api/v1/verify. */
export async function verifySimulation(scene: InclineSceneSpec): Promise<VerificationVerdict> {
  await wait(650);
  const acceleration = scene.body === "ball"
    ? (5 / 7) * scene.gravity * Math.sin((scene.angle_deg * Math.PI) / 180)
    : scene.gravity * (Math.sin((scene.angle_deg * Math.PI) / 180) - scene.friction * Math.cos((scene.angle_deg * Math.PI) / 180));
  const expectedSeconds = Math.sqrt((2 * scene.length) / Math.max(acceleration, 0.01));
  const measuredSeconds = expectedSeconds * 1.008;
  const errorPct = Math.abs((measuredSeconds - expectedSeconds) / expectedSeconds) * 100;

  return {
    status: errorPct <= 2 ? "match" : "mismatch",
    expectedSeconds,
    measuredSeconds,
    errorPct,
    tolerancePct: 2,
  };
}
