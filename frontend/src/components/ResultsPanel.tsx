import type { Collision1DSceneSpec, GenerativeSceneSpec, InclineSceneSpec, SceneSpec, SpringSceneSpec, VerificationVerdict } from "../types";

type ResultsPanelProps = {
  scene: SceneSpec;
  verdict: VerificationVerdict | null;
  isVerifying: boolean;
};

export function ResultsPanel({ scene, verdict, isVerifying }: ResultsPanelProps) {
  const status = verdict?.status ?? "not_applicable";
  const isSpring = scene.scenario === "spring";
  const isGenerative = scene.scenario === "generative";
  const isCollision = scene.scenario === "collision_1d";
  const springScene = isSpring ? (scene as SpringSceneSpec) : null;
  const genScene = isGenerative ? (scene as GenerativeSceneSpec) : null;
  const collisionScene = isCollision ? (scene as Collision1DSceneSpec) : null;
  const inclineScene = scene.scenario === "incline" ? (scene as InclineSceneSpec) : null;
  const isStatic = verdict?.status === "match" && verdict.expectedSeconds === 0;
  const seconds = (value: number | undefined) => (verdict && value ? `${value.toFixed(2)} s` : isStatic ? "At rest" : "—");
  const heading = isVerifying
    ? "Checking result"
    : status === "match"
    ? "Verified match"
    : status === "mismatch"
    ? "Mismatch: do not trust this run"
    : verdict
    ? "Could not check"
    : "Run the experiment";

  return (
    <section className="results-panel" aria-labelledby="results-title">
      <div>
        <p className="eyebrow">04 / CHECK</p>
        <h2 id="results-title">Theory vs. simulation</h2>
        <p className="results-copy">
          The analytic solver checks the experiment with source-of-truth formulas — we do not ask AI to mark its own work.
        </p>
      </div>

      <div className="formula">
        {isSpring ? (
          <>
            <span>Simple Harmonic Motion</span>
            <strong>T = 2π · √(m / k_eff)</strong>
            <small>
              Hooke's Law: F = -k·Δy (k_eff = {springScene?.spring_constant.toFixed(0)} N/m)
            </small>
          </>
        ) : isGenerative && genScene ? (
          <>
            <span>{genScene.primary_law}</span>
            <strong>{genScene.formula || "F_net = m·a"}</strong>
            <small>{genScene.title}</small>
          </>
        ) : isCollision && collisionScene ? (
          <>
            <span>1D Momentum & Restitution</span>
            <strong>v_A' = ((m_A − e·m_B)v_A + (1+e)m_B·v_B) / (m_A + m_B)</strong>
            <small>
              m_A = {collisionScene.mass_a}kg, m_B = {collisionScene.mass_b}kg · v_A = {collisionScene.velocity_a}m/s, v_B = {collisionScene.velocity_b}m/s (e = {collisionScene.restitution})
            </small>
          </>
        ) : inclineScene?.body === "ball" ? (
          <>
            <span>Rolling ball</span>
            <strong>a = 5/7 · g · sin(θ)</strong>
            <small>Ideal rolling, no slip</small>
          </>
        ) : (
          <>
            <span>Sliding block</span>
            <strong>a = g · (sin(θ) - μ·cos(θ))</strong>
            <small>Coulomb dry friction</small>
          </>
        )}
      </div>

      <dl className="result-values">
        <div>
          <dt>{isSpring || isGenerative ? "Theory Period" : "Theory Time"}</dt>
          <dd>{seconds(verdict?.expectedSeconds)}</dd>
        </div>
        <div>
          <dt>{isSpring || isGenerative ? "Sim Period" : "Sim Time"}</dt>
          <dd>{seconds(verdict?.measuredSeconds)}</dd>
        </div>
        <div>
          <dt>Difference</dt>
          <dd>{verdict && verdict.status !== "not_applicable" ? `${verdict.errorPct.toFixed(1)}%` : "—"}</dd>
        </div>
      </dl>

      <div className={`verdict verdict--${status}`} aria-live="polite">
        <span aria-hidden="true">{isVerifying ? "…" : status === "match" ? "✓" : status === "mismatch" ? "✕" : "○"}</span>
        <div>
          <strong>
            {heading}
          </strong>
          <p>
            {isVerifying
              ? "Measuring in the Rapier physics engine and comparing with the formula."
              : verdict?.status === "match"
              ? `Within the ${verdict.tolerancePct}% tolerance.`
              : verdict?.status === "mismatch"
              ? `Outside the ${verdict.tolerancePct}% tolerance.`
              : verdict
              ? verdict.explanation ?? "The check did not run."
              : isSpring || isGenerative
              ? "Set the apparatus in motion to compare live numerical simulation with theory."
              : `Set the body in motion to compare both results.`}
          </p>
        </div>
      </div>
    </section>
  );
}
