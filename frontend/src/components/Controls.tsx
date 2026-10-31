import type { Collision1DSceneSpec, GenerativeSceneSpec, InclineSceneSpec, SceneSpec, SpringSceneSpec } from "../types";
import { getSceneAngle, getSceneMass } from "../types";

type ControlsProps = {
  scene: SceneSpec;
  isPlaying: boolean;
  onChange: (field: string, value: any) => void;
  onTogglePlay: () => void;
  onReset: () => void;
};

export function Controls({ scene, isPlaying, onChange, onTogglePlay, onReset }: ControlsProps) {
  const isSpring = scene.scenario === "spring";
  const isGenerative = scene.scenario === "generative";
  const isCollision = scene.scenario === "collision_1d";
  const springScene = isSpring ? (scene as SpringSceneSpec) : null;
  const genScene = isGenerative ? (scene as GenerativeSceneSpec) : null;
  const collisionScene = isCollision ? (scene as Collision1DSceneSpec) : null;
  const inclineScene = scene.scenario === "incline" ? (scene as InclineSceneSpec) : null;

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
        ) : isGenerative && genScene ? (
          <>
            <label className="control-row">
              <span>Mass</span>
              <input
                type="range"
                min={0.5}
                max={50}
                step={0.5}
                value={genScene.mass}
                onChange={(event) => onChange("mass", Number(event.target.value))}
              />
              <output>
                {genScene.mass} <small>kg</small>
              </output>
            </label>

            <label className="control-row">
              <span>Gravity</span>
              <input
                type="range"
                min={1}
                max={25}
                step={0.1}
                value={genScene.gravity}
                onChange={(event) => onChange("gravity", Number(event.target.value))}
              />
              <output>
                {genScene.gravity.toFixed(1)} <small>m/s²</small>
              </output>
            </label>
          </>
        ) : isCollision && collisionScene ? (
          <>
            <label className="control-row">
              <span>Mass A</span>
              <input
                type="range"
                min={0.5}
                max={50}
                step={0.5}
                value={collisionScene.mass_a}
                onChange={(event) => onChange("mass_a", Number(event.target.value))}
              />
              <output>
                {collisionScene.mass_a} <small>kg</small>
              </output>
            </label>

            <label className="control-row">
              <span>Mass B</span>
              <input
                type="range"
                min={0.5}
                max={50}
                step={0.5}
                value={collisionScene.mass_b}
                onChange={(event) => onChange("mass_b", Number(event.target.value))}
              />
              <output>
                {collisionScene.mass_b} <small>kg</small>
              </output>
            </label>

            <label className="control-row">
              <span>Velocity A</span>
              <input
                type="range"
                min={-15}
                max={15}
                step={0.5}
                value={collisionScene.velocity_a}
                onChange={(event) => onChange("velocity_a", Number(event.target.value))}
              />
              <output>
                {collisionScene.velocity_a.toFixed(1)} <small>m/s</small>
              </output>
            </label>

            <label className="control-row">
              <span>Velocity B</span>
              <input
                type="range"
                min={-15}
                max={15}
                step={0.5}
                value={collisionScene.velocity_b}
                onChange={(event) => onChange("velocity_b", Number(event.target.value))}
              />
              <output>
                {collisionScene.velocity_b.toFixed(1)} <small>m/s</small>
              </output>
            </label>

            <label className="control-row">
              <span>Restitution</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={collisionScene.restitution}
                onChange={(event) => onChange("restitution", Number(event.target.value))}
              />
              <output>
                {collisionScene.restitution.toFixed(2)} <small>(e)</small>
              </output>
            </label>
          </>
        ) : (
          <>
            <label className="control-row">
              <span>Angle</span>
              <input
                type="range"
                min={5}
                max={80}
                step={1}
                value={inclineScene?.angle_deg ?? getSceneAngle(scene)}
                onChange={(event) => onChange("angle_deg", Number(event.target.value))}
              />
              <output>
                {inclineScene?.angle_deg ?? getSceneAngle(scene)} <small>°</small>
              </output>
            </label>

            <label className="control-row">
              <span>Mass</span>
              <input
                type="range"
                min={0.5}
                max={100}
                step={0.5}
                value={inclineScene?.mass ?? getSceneMass(scene)}
                onChange={(event) => onChange("mass", Number(event.target.value))}
              />
              <output>
                {inclineScene?.mass ?? getSceneMass(scene)} <small>kg</small>
              </output>
            </label>

            <label className="control-row">
              <span>Gravity</span>
              <input
                type="range"
                min={1}
                max={25}
                step={0.1}
                value={scene.gravity ?? 9.81}
                onChange={(event) => onChange("gravity", Number(event.target.value))}
              />
              <output>
                {(scene.gravity ?? 9.81).toFixed(1)} <small>m/s²</small>
              </output>
            </label>
          </>
        )}
      </div>
    </section>
  );
}
