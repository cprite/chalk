import type { InclineSceneSpec, VerificationVerdict } from "../types";

type ResultsPanelProps = {
  scene: InclineSceneSpec;
  verdict: VerificationVerdict | null;
  isVerifying: boolean;
};

export function ResultsPanel({ scene, verdict, isVerifying }: ResultsPanelProps) {
  const status = verdict?.status ?? "not_applicable";
  const isMock = verdict?.source !== "backend";

  return (
    <section className="results-panel" aria-labelledby="results-title">
      <div>
        <p className="eyebrow">04 / CHECK</p>
        <h2 id="results-title">Theory vs. simulation</h2>
        <p className="results-copy">{isMock ? "This local demo comparison is not an independent verification." : "The backend checks the experiment with the analytic result — we do not ask AI to mark its own work."}</p>
      </div>
      <div className="formula">
        <span>Rolling ball</span>
        <strong>a = 5/7 · g · sin(θ)</strong>
        <small>Ideal rolling, no slip</small>
      </div>
      <dl className="result-values">
        <div><dt>Theory</dt><dd>{verdict ? `${verdict.expectedSeconds.toFixed(2)} s` : "—"}</dd></div>
        <div><dt>Simulation</dt><dd>{verdict ? `${verdict.measuredSeconds.toFixed(2)} s` : "—"}</dd></div>
        <div><dt>Difference</dt><dd>{verdict ? `${verdict.errorPct.toFixed(1)}%` : "—"}</dd></div>
      </dl>
      <div className={`verdict verdict--${status}`} aria-live="polite">
        <span aria-hidden="true">{isVerifying ? "…" : status === "match" ? "✓" : "○"}</span>
        <div>
          <strong>{isVerifying ? "Checking demo comparison" : isMock ? "Demo comparison only" : status === "match" ? "Verified match" : "Run the experiment"}</strong>
          <p>{isVerifying ? "Comparing the trajectory with the formula." : isMock ? "This local mock is not an independent verification." : verdict ? `Within the ${verdict.tolerancePct}% tolerance.` : `Set the ${scene.body} in motion to compare both results.`}</p>
        </div>
      </div>
    </section>
  );
}
