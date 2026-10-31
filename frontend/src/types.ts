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

export type SceneSpec =
  | InclineSceneSpec
  | ProjectileSceneSpec
  | PendulumSceneSpec
  | Collision1DSceneSpec
  | CloudChamberSceneSpec;

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
