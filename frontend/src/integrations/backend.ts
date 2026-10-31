import type { Measurement } from "../physics/rapierMeasure";
import type { InclineSceneSpec, VerificationVerdict } from "../types";

const SESSION_ID = `s-${Date.now().toString(36)}`;
const HEADERS = { "x-session-id": SESSION_ID };

export class BackendError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const createDemoScene = (): InclineSceneSpec => ({
  scenario: "incline",
  body: "ball",
  mass: 1,
  angle_deg: 30,
  length: 4,
  // High enough to roll without slipping, which needs at least (2/7)·tan(θ) = 0.165 here.
  friction: 0.5,
  gravity: 9.81,
  confidence: 1,
  assumptions: ["Demo scene", "Rolling without slipping", "No air resistance"],
});

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new BackendError("backend_unavailable", "Chalk's server is not reachable.");
  }
  // Vite's proxy answers 502 with an empty body when the backend is not running.
  const body = await response.json().catch(() => null);
  if (response.ok && body) return body as T;
  if (body?.code) throw new BackendError(body.code, body.message);
  throw new BackendError("backend_unavailable", "Chalk's server is not reachable.");
}

const postJson = <T>(path: string, payload: unknown) =>
  request<T>(path, {
    method: "POST",
    headers: { ...HEADERS, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

function inclineOnly(scene: { scenario: string }): InclineSceneSpec {
  if (scene.scenario !== "incline") {
    throw new BackendError("unsupported_problem", `Chalk read a ${scene.scenario} problem, but this lab only runs inclined planes for now.`);
  }
  return scene as InclineSceneSpec;
}

export async function analyzeSketch(file: File): Promise<InclineSceneSpec> {
  const form = new FormData();
  form.append("image", file);
  const { scene } = await request<{ scene: InclineSceneSpec }>("/api/v1/scenes/analyze", { method: "POST", headers: HEADERS, body: form });
  return inclineOnly(scene);
}

export type RawVerification = {
  verdict: "match" | "mismatch" | "not_applicable";
  expected: { time_to_end_s: number | null } | null;
  measured: Measurement;
  error_pct: number | null;
  tolerance_pct: number;
  formula: string | null;
};

export async function verifyMeasurement(scene: InclineSceneSpec, measured: Measurement) {
  const raw = await postJson<RawVerification>("/api/v1/verify", { scene, measured });
  const verdict: VerificationVerdict = {
    status: raw.verdict,
    expectedSeconds: raw.expected?.time_to_end_s ?? 0,
    measuredSeconds: raw.measured.time_to_end_s ?? 0,
    errorPct: raw.error_pct ?? 0,
    tolerancePct: raw.tolerance_pct,
    formulaLatex: raw.formula ?? undefined,
  };
  return { verdict, raw };
}

export async function explainResult(scene: InclineSceneSpec, verification: RawVerification, prediction: string | null) {
  const { text } = await postJson<{ text: string }>("/api/v1/explain", { scene, verification, prediction });
  return text;
}

export async function sendFollowup(scene: InclineSceneSpec, text: string) {
  const result = await postJson<{ scene: InclineSceneSpec; changes: { field: string; value: unknown }[] }>("/api/v1/scenes/followup", { scene, text });
  return { scene: inclineOnly(result.scene), changes: result.changes };
}

export const recordPrediction = (text: string) => postJson("/api/v1/predictions", { text });
