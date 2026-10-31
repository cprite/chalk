/**
 * Frontend view of the team's source-of-truth JSON schema at
 * `../../contracts/scene_spec.schema.json`.
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

export type ProjectileSceneSpec = {
  scenario: "projectile";
  mass: number;
  speed: number;
  angle_deg: number;
  height: number;
  gravity: number;
  confidence: number;
  assumptions: string[];
  projectilePreset?: "cannonball" | "football" | "rocket" | "apple";
};

export type PendulumSceneSpec = {
  scenario: "pendulum";
  mass: number;
  length: number;
  angle_deg: number;
  gravity: number;
  confidence: number;
  assumptions: string[];
};

export type Collision1DSceneSpec = {
  scenario: "collision_1d";
  mass_a: number;
  mass_b: number;
  velocity_a: number;
  velocity_b: number;
  restitution: number;
  gravity: number;
  confidence: number;
  assumptions: string[];
};

export type SpringSceneSpec = {
  scenario: "spring";
  mass: number;
  spring_constant: number;
  spring_count: number;
  arrangement: "series" | "parallel" | "single";
  amplitude: number;
  k1?: number;
  k2?: number;
  gravity: number;
  confidence: number;
  assumptions: string[];
};

export type CloudChamberSceneSpec = {
  scenario: "cloud_chamber";
  alphaEnergyMeV: number;
  targetElement: "Gold (Z=79)" | "Aluminum (Z=13)" | "Hydrogen (Z=1)";
  atomicNumberZ: number;
  emissionRate: number;
  magneticFieldTesla: number;
  gravity: number;
  confidence: number;
  assumptions: string[];
};

export type GenerativeObjectSpec = {
  id: string;
  type: "block" | "sphere" | "spring" | "string" | "anchor" | "pulley" | "ramp" | "cart" | "pivot" | string;
  label?: string;
  mass?: number;
  k?: number;
  position?: [number, number, number];
  connects?: string[];
  is_fixed?: boolean;
};

export type GenerativeSceneSpec = {
  scenario: "generative";
  title: string;
  primary_law: string;
  formula: string;
  mass: number;
  objects: GenerativeObjectSpec[];
  gravity: number;
  confidence: number;
  assumptions: string[];
};

export type SceneSpec =
  | InclineSceneSpec
  | SpringSceneSpec
  | ProjectileSceneSpec
  | PendulumSceneSpec
  | Collision1DSceneSpec
  | CloudChamberSceneSpec
  | GenerativeSceneSpec;

export function getSceneMass(s: SceneSpec): number {
  if ("mass" in s && typeof s.mass === "number") return s.mass;
  if ("mass_a" in s && typeof s.mass_a === "number") return s.mass_a;
  return 1.0;
}

export function getSceneAngle(s: SceneSpec): number {
  if ("angle_deg" in s && typeof s.angle_deg === "number") return s.angle_deg;
  return 30;
}

export function getSceneLength(s: SceneSpec): number {
  if ("length" in s && typeof s.length === "number") return s.length;
  return 4.0;
}

export function getSceneBody(s: SceneSpec): "ball" | "block" {
  if ("body" in s && (s.body === "ball" || s.body === "block")) return s.body;
  return "block";
}

export type TrajectoryPoint = {
  t: number;
  theoryPos: number;
  simPos: number;
  velocity: number;
};

export type VerificationVerdict = {
  /** Only a backend result is independently verified; absent provenance is unverified. */
  source?: "backend" | "mock";
  status: "match" | "mismatch" | "not_applicable";
  expectedSeconds: number;
  measuredSeconds: number;
  errorPct: number;
  tolerancePct: number;
  formulaLatex?: string;
  explanation?: string;
};

export type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";
