import type { InclineSceneSpec } from "../types";

type PhysicsSceneProps = {
  scene: InclineSceneSpec;
  isPlaying: boolean;
};

/**
 * Visual stand-in for the teammate-owned Three.js/Rapier component.
 * Keep this prop contract stable when swapping in the real scene.
 */
export function PhysicsScene({ scene, isPlaying }: PhysicsSceneProps) {
  const rampAngle = Math.max(18, Math.min(42, scene.angle_deg * 0.9));

  return (
    <div className="scene-stage" aria-label={`A ${scene.body} on a ${scene.angle_deg} degree incline`}>
      <div className="scene-grid" />
      <span className="scene-label scene-label--top">inclined plane</span>
      <span className="scene-label scene-label--angle">{scene.angle_deg}°</span>
      <div className="ramp" style={{ transform: `rotate(${-rampAngle}deg)` }} />
      <div className={`rolling-body rolling-body--${scene.body} ${isPlaying ? "rolling-body--moving" : ""}`}>
        {scene.body === "ball" ? <span className="ball-mark">×</span> : null}
      </div>
      <div className="trajectory" aria-hidden="true" />
      <div className="axis axis--x" />
      <div className="axis axis--y" />
      <span className="scene-unit">m</span>
      <p className="scene-caption">Rapier / Three.js integration boundary</p>
    </div>
  );
}
