import RAPIER from "@dimforge/rapier3d-compat";
import type { InclineSceneSpec } from "../types";

export type Measurement = { moved: boolean; time_to_end_s: number | null };

const DT = 1 / 120;
// Below about 0.1 m a fast rolling ball loses contact accuracy at this timestep (5% error at 0.05 m).
const BODY_SIZE = 0.2;
const STATIC_HORIZON_S = 3;
const MAX_TIME_S = 120;

/**
 * Runs the incline in the Rapier physics engine, which knows nothing about the
 * analytic formula, and reports how long the body takes to travel the slope.
 * The slope is flat in this world and gravity is tilted, so long slopes need no big rotated collider.
 */
export async function measureIncline(scene: InclineSceneSpec): Promise<Measurement> {
  await RAPIER.init();
  const theta = (scene.angle_deg * Math.PI) / 180;
  const world = new RAPIER.World({
    x: scene.gravity * Math.sin(theta),
    y: -scene.gravity * Math.cos(theta),
    z: 0,
  });
  world.timestep = DT;

  try {
    const groundHalf = scene.length + 50;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(groundHalf, 1, 5)
        .setTranslation(groundHalf - 5, -1, 0)
        .setFriction(scene.friction)
        .setRestitution(0),
    );

    const isBall = scene.body === "ball";
    const body = world.createRigidBody(
      // A block models a sliding point mass, so it must not tip over on steep slopes.
      (isBall ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.dynamic().lockRotations())
        .setTranslation(0, BODY_SIZE, 0)
        .setCanSleep(false),
    );
    world.createCollider(
      (isBall ? RAPIER.ColliderDesc.ball(BODY_SIZE) : RAPIER.ColliderDesc.cuboid(BODY_SIZE, BODY_SIZE, BODY_SIZE))
        .setDensity(scene.mass / (isBall ? (4 / 3) * Math.PI * BODY_SIZE ** 3 : (2 * BODY_SIZE) ** 3))
        .setFriction(scene.friction)
        .setRestitution(0),
      body,
    );

    let t = 0;
    while (t < MAX_TIME_S) {
      world.step();
      t += DT;
      const x = body.translation().x;
      if (x >= scene.length) return { moved: true, time_to_end_s: t };
      if (t >= STATIC_HORIZON_S && x < scene.length * 0.01) return { moved: false, time_to_end_s: null };
    }
    return { moved: true, time_to_end_s: null };
  } finally {
    world.free();
  }
}
