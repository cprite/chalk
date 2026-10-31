import type { Measurement } from "../physics/rapierMeasure";
import type { InclineSceneSpec, SceneSpec, SpringSceneSpec, VerificationVerdict } from "../types";

export const createDemoScene = (): InclineSceneSpec => ({
  scenario: "incline",
  body: "ball",
  mass: 1,
  angle_deg: 30,
  length: 4,
  // High enough to roll without slipping, which needs at least (2/7)·tan(θ) = 0.165 here.
  friction: 0.5,
  gravity: 9.81,
  confidence: 0.94,
  assumptions: ["Rolling without slipping", "No air resistance"],
});

export const createSpringDemoScene = (): SpringSceneSpec => ({
  scenario: "spring",
  mass: 5,
  spring_constant: 120,
  spring_count: 2,
  arrangement: "series",
  amplitude: 0.35,
  k1: 200,
  k2: 300,
  gravity: 9.81,
  confidence: 0.95,
  assumptions: [
    "Read k1 = 200 N/m, k2 = 300 N/m from hand-drawn sketch",
    "Springs in series: 1/k = 1/200 + 1/300 -> k_eff = 120.0 N/m",
    "Vertical Simple Harmonic Motion (SHM)",
  ],
});

export type AnalysisResult = {
  scene: SceneSpec;
  source: "live";
};

class AnalysisRefused extends Error {}

function isSupportedScene(scene: unknown): scene is SceneSpec {
  if (!scene || typeof scene !== "object") return false;
  const c = scene as any;
  if (c.scenario === "incline") {
    return typeof c.mass === "number" && typeof c.angle_deg === "number";
  }
  if (c.scenario === "spring") {
    return typeof c.mass === "number" && typeof c.spring_constant === "number";
  }
  return false;
}

/** Calls the validated FastAPI analysis endpoint with Gemini 4 Argon image recognition. */
export async function analyzeSketch(file: File | Blob): Promise<AnalysisResult> {
  if (file instanceof File && file.type && !file.type.startsWith("image/")) {
    throw new Error("Upload a PNG or JPEG image of your physics sketch.");
  }

  const urls = ["/api/v1/scenes/analyze", "http://127.0.0.1:8000/api/v1/scenes/analyze"];
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const formData = new FormData();
      formData.append("image", file, "sketch.png");
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as { message?: unknown; scene?: any } | null;
      if (!response.ok) {
        const message = typeof data?.message === "string" ? data.message : "Could not analyze this sketch.";
        lastError = new Error(message);
        // A 4xx is the backend's real answer. Only retry the direct URL when the server was not reached.
        if (response.status < 500) throw new AnalysisRefused(message);
        continue;
      }

      if (data?.scene && isSupportedScene(data.scene)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = data.scene as any;
        if (s.scenario === "spring") {
          return {
            scene: {
              scenario: "spring",
              mass: Number(s.mass ?? 5.0),
              spring_constant: Number(s.spring_constant ?? 120.0),
              spring_count: Math.max(1, Math.min(5, Number(s.spring_count ?? 2))),
              arrangement: s.arrangement || "series",
              amplitude: Number(s.amplitude ?? 0.35),
              k1: s.k1 ? Number(s.k1) : 200,
              k2: s.k2 ? Number(s.k2) : 300,
              gravity: Number(s.gravity ?? 9.81),
              confidence: Number(s.confidence ?? 0.95),
              assumptions: s.assumptions || ["Simple Harmonic Oscillator via Gemini 4 Argon"],
            },
            source: "live",
          };
        } else {
          return {
            scene: {
              scenario: "incline",
              body: s.body === "block" ? "block" : "ball",
              mass: Number(s.mass ?? 1.0),
              angle_deg: Number(s.angle_deg ?? 30),
              length: Math.max(1.0, Math.min(10.0, Number(s.length ?? 4.0))),
              friction: s.friction !== undefined ? Number(s.friction) : 0.0,
              gravity: Number(s.gravity ?? 9.81),
              confidence: Number(s.confidence ?? 0.95),
              assumptions: s.assumptions || ["Parsed via Gemini 4 Argon"],
            },
            source: "live",
          };
        }
      }

      lastError = new Error("The analysis did not return a supported physics scene.");
    } catch (error) {
      if (error instanceof AnalysisRefused) throw error;
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const message = lastError?.message ?? "Could not reach the analysis service.";
  throw new Error(`${message} Try again, or choose a preset sketch.`);
}

const SESSION_ID = `s-${Date.now().toString(36)}`;
const HEADERS = { "x-session-id": SESSION_ID };

export class BackendError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { ...HEADERS, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new BackendError("backend_unavailable", "Chalk's server is not reachable.");
  }
  // Vite's proxy answers 502 with an empty body when the backend is not running.
  const body = await response.json().catch(() => null);
  if (response.ok && body) return body as T;
  if (body?.code) throw new BackendError(body.code, body.message);
  throw new BackendError("backend_unavailable", "Chalk's server is not reachable.");
}

export type RawVerification = {
  verdict: "match" | "mismatch" | "not_applicable";
  expected: { time_to_end_s: number | null } | null;
  measured: Measurement;
  error_pct: number | null;
  tolerance_pct: number;
  formula: string | null;
};

export async function verifyMeasurement(scene: SceneSpec, measured: Measurement) {
  const raw = await postJson<RawVerification>("/api/v1/verify", { scene, measured });
  const verdict: VerificationVerdict = {
    source: "backend",
    status: raw.verdict,
    expectedSeconds: raw.expected?.time_to_end_s ?? 0,
    measuredSeconds: raw.measured.time_to_end_s ?? 0,
    errorPct: raw.error_pct ?? 0,
    tolerancePct: raw.tolerance_pct,
    formulaLatex: raw.formula ?? undefined,
  };
  return { verdict, raw };
}

export async function explainResult(scene: SceneSpec, verification: RawVerification, prediction: string | null) {
  const { text } = await postJson<{ text: string }>("/api/v1/explain", { scene, verification, prediction });
  return text;
}

export async function sendFollowup(scene: SceneSpec, text: string) {
  const result = await postJson<{ scene: SceneSpec; changes: { field: string; value: unknown }[]; reply?: string | null }>("/api/v1/scenes/followup", { scene, text });
  if (!isSupportedScene(result.scene)) {
    throw new BackendError("unsupported_problem", `Chalk read a ${(result.scene as { scenario: string }).scenario} problem, but this lab only runs inclined planes and springs for now.`);
  }
  return result;
}

export const recordPrediction = (text: string) => postJson("/api/v1/predictions", { text });
