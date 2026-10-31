import type { InclineSceneSpec, SceneSpec, SpringSceneSpec } from "../types";

type ControlsProps = {
  scene: SceneSpec;
  isPlaying: boolean;
  onChange: (field: string, value: any) => void;
  onTogglePlay: () => void;
  onReset: () => void;
};

export function Controls({ scene, isPlaying, onChange, onTogglePlay, onReset }: ControlsProps) {
  const isSpring = scene.scenario === "spring";
  const springScene = isSpring ? (scene as SpringSceneSpec) : null;
  const inclineScene = !isSpring ? (scene as InclineSceneSpec) : null;

  return (
    <section className="controls" aria-label="Simulation controls">
      <div className="run-controls">
        <button className="button button--play" type="button" onClick={onTogglePlay}>
          <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span> {isPlaying ? "Pause" : "Run simulation"}
        </button>
        <button className="button button--icon" type="button" aria-label="Reset simulation" onClick={onReset}>
          ↺
        </button>
      </div>

      <div className="sliders">
        {isSpring && springScene ? (
          <>
            <label className="control-row">
              <span>Mass</span>
              <input
                type="range"
                min={0.5}
                max={50}
                step={0.5}
                value={springScene.mass}
                onChange={(event) => onChange("mass", Number(event.target.value))}
              />
              <output>
                {springScene.mass} <small>kg</small>
              </output>
            </label>

            <label className="control-row">
              <span>Spring k</span>
              <input
                type="range"
                min={10}
                max={800}
                step={5}
                value={springScene.spring_constant}
                onChange={(event) => onChange("spring_constant", Number(event.target.value))}
              />
              <output>
                {springScene.spring_constant.toFixed(0)} <small>N/m</small>
              </output>
            </label>

            <label className="control-row">
              <span>Springs</span>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={springScene.spring_count}
                onChange={(event) => onChange("spring_count", Number(event.target.value))}
              />
              <output>
                {springScene.spring_count} <small>units</small>
              </output>
            </label>

            <div className="control-row" style={{ gridTemplateColumns: "72px 1fr" }}>
              <span>Arrangement</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  className={`button button--sm ${springScene.arrangement === "series" ? "button--primary" : "button--secondary"}`}
                  onClick={() => onChange("arrangement", "series")}
                  style={{ flex: 1, minHeight: "26px", fontSize: "0.68rem" }}
                >
                  Series (1/k = Σ 1/kᵢ)
                </button>
                <button
                  type="button"
                  className={`button button--sm ${springScene.arrangement === "parallel" ? "button--primary" : "button--secondary"}`}
                  onClick={() => onChange("arrangement", "parallel")}
                  style={{ flex: 1, minHeight: "26px", fontSize: "0.68rem" }}
                >
                  Parallel (k = Σ kᵢ)
                </button>
              </div>
            </div>

            <label className="control-row">
              <span>Gravity</span>
              <input
                type="range"
                min={1}
                max={25}
                step={0.1}
                value={springScene.gravity}
                onChange={(event) => onChange("gravity", Number(event.target.value))}
              />
              <output>
                {springScene.gravity.toFixed(1)} <small>m/s²</small>
              </output>
            </label>
          </>
        ) : inclineScene ? (
          <>
            <label className="control-row">
              <span>Angle</span>
              <input
                type="range"
                min={5}
                max={80}
                step={1}
                value={inclineScene.angle_deg}
                onChange={(event) => onChange("angle_deg", Number(event.target.value))}
              />
              <output>
                {inclineScene.angle_deg} <small>°</small>
              </output>
            </label>

            <label className="control-row">
              <span>Mass</span>
              <input
                type="range"
                min={0.5}
                max={100}
                step={0.5}
                value={inclineScene.mass}
                onChange={(event) => onChange("mass", Number(event.target.value))}
              />
              <output>
                {inclineScene.mass} <small>kg</small>
              </output>
            </label>

            <label className="control-row">
              <span>Gravity</span>
              <input
                type="range"
                min={1}
                max={25}
                step={0.1}
                value={inclineScene.gravity}
                onChange={(event) => onChange("gravity", Number(event.target.value))}
              />
              <output>
                {inclineScene.gravity.toFixed(1)} <small>m/s²</small>
              </output>
            </label>
          </>
        ) : null}
      </div>
    </section>
  );
}
