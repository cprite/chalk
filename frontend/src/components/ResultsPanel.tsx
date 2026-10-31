import type { InclineSceneSpec, SceneSpec, SpringSceneSpec, VerificationVerdict } from "../types";

type ResultsPanelProps = {
  scene: SceneSpec;
  verdict: VerificationVerdict | null;
  isVerifying: boolean;
};

export function ResultsPanel({ scene, verdict, isVerifying }: ResultsPanelProps) {
  const status = verdict?.status ?? "not_applicable";
  const isSpring = scene.scenario === "spring";
  const springScene = isSpring ? (scene as SpringSceneSpec) : null;
  const inclineScene = !isSpring ? (scene as InclineSceneSpec) : null;
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
          <dt>{isSpring ? "Theory Period" : "Theory Time"}</dt>
          <dd>{seconds(verdict?.expectedSeconds)}</dd>
        </div>
        <div>
          <dt>{isSpring ? "Sim Period" : "Sim Time"}</dt>
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
              : isSpring
              ? "Set the spring assembly in motion to compare period with theory."
              : `Set the body in motion to compare both results.`}
          </p>
        </div>
      </div>
    </section>
  );
}
