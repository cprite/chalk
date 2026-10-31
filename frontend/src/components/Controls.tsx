import type { InclineSceneSpec } from "../types";

type ControlsProps = {
  scene: InclineSceneSpec;
  isPlaying: boolean;
  onChange: (field: "angle_deg" | "mass" | "gravity", value: number) => void;
  onTogglePlay: () => void;
  onReset: () => void;
};

const controls = [
  { field: "angle_deg" as const, label: "Angle", unit: "°", min: 5, max: 80, step: 1 },
  { field: "mass" as const, label: "Mass", unit: "kg", min: 0.5, max: 100, step: 0.5 },
  { field: "gravity" as const, label: "Gravity", unit: "m/s²", min: 1, max: 25, step: 0.1 },
];

export function Controls({ scene, isPlaying, onChange, onTogglePlay, onReset }: ControlsProps) {
  return (
    <section className="controls" aria-label="Simulation controls">
      <div className="run-controls">
        <button className="button button--play" type="button" onClick={onTogglePlay}>
          <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span> {isPlaying ? "Pause" : "Run simulation"}
        </button>
        <button className="button button--icon" type="button" aria-label="Reset simulation" onClick={onReset}>↺</button>
      </div>
      <div className="sliders">
        {controls.map(({ field, label, unit, min, max, step }) => (
          <label className="control-row" key={field}>
            <span>{label}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={scene[field]}
              onChange={(event) => onChange(field, Number(event.target.value))}
            />
            <output>{scene[field]} <small>{unit}</small></output>
          </label>
        ))}
      </div>
    </section>
  );
}
