/**
 * Frontend view of the team's source-of-truth JSON schema at
 * `../../contracts/scene_spec.schema.json`.
 *
 * The UI currently supports only the P0 incline scenario. Replace this with
 * generated OpenAPI types as soon as the backend publishes its schema.
 */
export type InclineSceneSpec = {
  scenario: "incline";
  body: "ball" | "block";
  mass: number;
  angle_deg: number;
  length: number;
  friction: number;
  gravity: number;
  confidence: number;
  assumptions: string[];
};

export type VerificationVerdict = {
  status: "match" | "mismatch" | "not_applicable";
  expectedSeconds: number;
  measuredSeconds: number;
  errorPct: number;
  tolerancePct: number;
};

export type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";
