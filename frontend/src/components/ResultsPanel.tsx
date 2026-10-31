import type { InclineSceneSpec, VerificationVerdict } from "../types";

type ResultsPanelProps = {
  scene: InclineSceneSpec;
  verdict: VerificationVerdict | null;
  isVerifying: boolean;
};

export function ResultsPanel({ scene, verdict, isVerifying }: ResultsPanelProps) {
  const status = verdict?.status ?? "not_applicable";
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
  const detail = isVerifying
    ? "Measuring in the physics engine and comparing with the formula."
    : verdict?.status === "match"
      ? `Within the ${verdict.tolerancePct}% tolerance.`
      : verdict?.status === "mismatch"
        ? `Outside the ${verdict.tolerancePct}% tolerance.`
        : verdict?.explanation ?? "Set the ball in motion to compare both results.";

  return (
    <section className="results-panel" aria-labelledby="results-title">
      <div>
        <p className="eyebrow">04 / CHECK</p>
        <h2 id="results-title">Theory vs. simulation</h2>
        <p className="results-copy">We check the experiment with the analytic result — we do not ask AI to mark its own work.</p>
      </div>
      <div className="formula">
        <span>{scene.body === "ball" ? "Ball" : "Block"}</span>
        <strong>{verdict?.formulaLatex ?? (scene.body === "ball" ? "a = 5/7 · g · sin(θ)" : "a = g · (sin(θ) − μ·cos(θ))")}</strong>
        <small>Checked by code, not by AI</small>
      </div>
      <dl className="result-values">
        <div><dt>Theory</dt><dd>{seconds(verdict?.expectedSeconds)}</dd></div>
        <div><dt>Simulation</dt><dd>{seconds(verdict?.measuredSeconds)}</dd></div>
        <div><dt>Difference</dt><dd>{verdict && verdict.status !== "not_applicable" ? `${verdict.errorPct.toFixed(1)}%` : "—"}</dd></div>
      </dl>
      <div className={`verdict verdict--${status}`} aria-live="polite">
        <span aria-hidden="true">{isVerifying ? "…" : status === "match" ? "✓" : status === "mismatch" ? "✕" : "○"}</span>
        <div>
          <strong>{heading}</strong>
          <p>{detail}</p>
        </div>
      </div>
    </section>
  );
}
