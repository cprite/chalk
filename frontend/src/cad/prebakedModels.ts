import * as THREE from "three";

/**
 * Shared pre-baked CAD materials palette ("Modern Chalkboard meets Precision Physics Lab").
 * Zero external texture fetches required -> 0ms shader compile & instant launch.
 */
export const CAD_MATERIALS = {
  birchWood: new THREE.MeshStandardMaterial({
    color: 0xd9c29c,
    roughness: 0.62,
    metalness: 0.05,
  }),
  anodizedAluminum: new THREE.MeshStandardMaterial({
    color: 0x7b9387,
    roughness: 0.35,
    metalness: 0.55,
  }),
  darkForestSteel: new THREE.MeshStandardMaterial({
    color: 0x214a3d,
    roughness: 0.4,
    metalness: 0.45,
  }),
  terracottaBody: new THREE.MeshStandardMaterial({
    color: 0xc76f50,
    roughness: 0.32,
    metalness: 0.18,
  }),
  turnedBrass: new THREE.MeshStandardMaterial({
    color: 0xd9a14c,
    roughness: 0.25,
    metalness: 0.78,
  }),
  chalkWhite: new THREE.MeshStandardMaterial({
    color: 0xfbf9f2,
    roughness: 0.8,
    metalness: 0.02,
  }),
  rubberStopper: new THREE.MeshStandardMaterial({
    color: 0x2c3531,
    roughness: 0.85,
    metalness: 0.05,
  }),
  glassChamber: new THREE.MeshPhysicalMaterial({
    color: 0xdff5f0,
    transparent: true,
    opacity: 0.24,
    roughness: 0.1,
    metalness: 0.05,
    transmission: 0.65,
  }),
  copperCoil: new THREE.MeshStandardMaterial({
    color: 0xd47445,
    roughness: 0.28,
    metalness: 0.82,
    emissive: 0x6b280e,
    emissiveIntensity: 0.35,
  }),
  goldFoil: new THREE.MeshStandardMaterial({
    color: 0xffcf40,
    roughness: 0.2,
    metalness: 0.9,
    emissive: 0x996515,
    emissiveIntensity: 0.4,
    side: THREE.DoubleSide,
  }),
};

/**
 * 1. P0 CAD Assembly: Precision Laboratory Inclined Plane Bench (`incline_ramp_rig.glb`)
 */
export function buildInclineRampCAD(lengthMeters: number, angleDeg: number): {
  root: THREE.Group;
  rampPlank: THREE.Group;
} {
  const root = new THREE.Group();
  root.name = "Incline_Ramp_Rig";

  const visualLen = Math.max(2.6, Math.min(5.2, lengthMeters * 0.85));
  const theta = (angleDeg * Math.PI) / 180;

  // Base laboratory bench frame
  const baseLength = visualLen * Math.cos(theta) + 0.6;
  const baseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(baseLength, 0.12, 1.15),
    CAD_MATERIALS.darkForestSteel
  );
  baseMesh.position.set(0, -0.06, 0);
  baseMesh.receiveShadow = true;
  root.add(baseMesh);

  // Support vertical post on the left (high end of incline)
  const leftX = - (visualLen * Math.cos(theta)) / 2;
  const topY = visualLen * Math.sin(theta);
  const pillarGeo = new THREE.CylinderGeometry(0.05, 0.06, Math.max(0.2, topY), 20);
  const pillar = new THREE.Mesh(pillarGeo, CAD_MATERIALS.anodizedAluminum);
  pillar.position.set(leftX, topY / 2, -0.35);
  pillar.castShadow = true;
  root.add(pillar);

  const pillarFront = pillar.clone();
  pillarFront.position.z = 0.35;
  root.add(pillarFront);

  // Brass protractor arc at bottom-right hinge
  const hingeX = leftX + visualLen * Math.cos(theta);
  const protractorArc = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.5, 28, 1, Math.PI - theta, theta),
    CAD_MATERIALS.turnedBrass
  );
  protractorArc.position.set(hingeX, 0.02, 0.48);
  root.add(protractorArc);

  // Articulated Ramp Plank group (origin at top-left start of ramp)
  const rampPlank = new THREE.Group();
  rampPlank.name = "Ramp_Hinge";
  rampPlank.position.set(leftX, topY, 0);
  rampPlank.rotation.z = -theta;

  // Main birch + aluminum track bed
  const plankBed = new THREE.Mesh(
    new THREE.BoxGeometry(visualLen, 0.1, 0.9),
    CAD_MATERIALS.birchWood
  );
  plankBed.position.set(visualLen / 2, -0.05, 0);
  plankBed.castShadow = true;
  plankBed.receiveShadow = true;
  rampPlank.add(plankBed);

  // Side guide rails with ruler ticks
  for (const zOffset of [-0.42, 0.42]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(visualLen, 0.06, 0.05),
      CAD_MATERIALS.anodizedAluminum
    );
    rail.position.set(visualLen / 2, 0.02, zOffset);
    rampPlank.add(rail);
  }

  // Ruler calibration tick marks every 0.5m along the ramp surface
  const numTicks = Math.floor(visualLen / 0.35);
  for (let i = 1; i <= numTicks; i++) {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.006, 0.76),
      CAD_MATERIALS.darkForestSteel
    );
    tick.position.set((i / (numTicks + 1)) * visualLen, 0.003, 0);
    rampPlank.add(tick);
  }

  // Bottom rubber bumper stop at s = L
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.22, 0.84),
    CAD_MATERIALS.rubberStopper
  );
  bumper.position.set(visualLen + 0.04, 0.08, 0);
  rampPlank.add(bumper);

  root.add(rampPlank);
  return { root, rampPlank };
}

/**
 * 2. P0 CAD Body: Rolling Sphere with Orthogonal Meridian Stripes (`rolling_ball_cad.glb`)
 * Visually scales radius & brass weight rings with `massKg` so "double the mass"
 * visibly makes the sphere heavier in 3D while preserving a = (5/7) g sin(θ).
 */
export function buildRollingBallCAD(baseRadius = 0.2, massKg = 1.0): THREE.Group {
  const group = new THREE.Group();
  group.name = "Rolling_Ball_CAD";

  // Cube-root mass scaling so doubling mass visibly enlarges the sphere
  const radius = baseRadius * Math.pow(Math.max(0.5, Math.min(10, massKg)), 0.24);

  const bodyMat =
    massKg >= 2.0
      ? new THREE.MeshStandardMaterial({
          color: 0x9e472a, // deeper heavy cast-bronze/terracotta tone for heavier mass
          roughness: 0.25,
          metalness: 0.48,
        })
      : CAD_MATERIALS.terracottaBody;

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 24),
    bodyMat
  );
  sphere.castShadow = true;
  group.add(sphere);

  // Brass meridian bands so rotation omega = v/r is unmistakably visible
  const bandMat = CAD_MATERIALS.turnedBrass;
  const bandThickness = radius * (massKg >= 2.0 ? 0.075 : 0.045);
  const band1 = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.006, bandThickness, 12, 36),
    bandMat
  );
  group.add(band1);

  const band2 = band1.clone();
  band2.rotation.x = Math.PI / 2;
  group.add(band2);

  if (massKg >= 1.8) {
    // Extra equatorial heavy brass ring when mass is increased/doubled
    const heavyRing = band1.clone();
    heavyRing.rotation.y = Math.PI / 2;
    group.add(heavyRing);
  }

  const axisHub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, radius * 2.1, 16),
    CAD_MATERIALS.chalkWhite
  );
  axisHub.rotation.x = Math.PI / 2;
  group.add(axisHub);

  return group;
}

/**
 * 3. P0 CAD Body: Sliding Friction Block with Brass Mass Stack (`sliding_block_cad.glb`)
 */
export function buildSlidingBlockCAD(massKg = 1.0): THREE.Group {
  const group = new THREE.Group();
  group.name = "Sliding_Block_CAD";

  // Base sled block
  const sled = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.22, 0.36),
    CAD_MATERIALS.terracottaBody
  );
  sled.position.y = 0.11;
  sled.castShadow = true;
  group.add(sled);

  // Dark friction pad underneath
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.03, 0.37),
    CAD_MATERIALS.rubberStopper
  );
  pad.position.y = 0.015;
  group.add(pad);

  // Stackable brass weight plates proportional to massKg
  const numPlates = Math.max(1, Math.min(5, Math.round(massKg)));
  for (let i = 0; i < numPlates; i++) {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.045, 24),
      CAD_MATERIALS.turnedBrass
    );
    plate.position.y = 0.245 + i * 0.05;
    plate.castShadow = true;
    group.add(plate);
  }

  return group;
}

/**
 * 4. P1 CAD Assembly: Projectile Launcher + Custom Projectile Props (`projectile_launcher_rig.glb`)
 */
export function buildProjectileLauncherCAD(
  heightMeters: number,
  angleDeg: number,
  preset: "cannonball" | "football" | "rocket" | "apple" = "cannonball"
): {
  root: THREE.Group;
  projectileMesh: THREE.Group;
  launchOrigin: THREE.Vector3;
} {
  const root = new THREE.Group();
  root.name = "Projectile_Launcher_Rig";

  const visualH = Math.max(0.3, Math.min(2.2, heightMeters * 0.45));
  const launchX = -2.1;

  // Ground calibration grid plank
  const groundBar = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.08, 1.1),
    CAD_MATERIALS.darkForestSteel
  );
  groundBar.position.set(0.2, -0.04, 0);
  root.add(groundBar);

  // Launcher pedestal
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, visualH, 0.46),
    CAD_MATERIALS.anodizedAluminum
  );
  pedestal.position.set(launchX, visualH / 2, 0);
  root.add(pedestal);

  // Articulated cannon barrel
  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(launchX, visualH + 0.12, 0);
  barrelPivot.rotation.z = (angleDeg * Math.PI) / 180;

  const barrelTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.14, 0.65, 24),
    CAD_MATERIALS.turnedBrass
  );
  barrelTube.rotation.z = -Math.PI / 2;
  barrelTube.position.x = 0.25;
  barrelPivot.add(barrelTube);
  root.add(barrelPivot);

  // Pre-rendered Projectile Prop Swap
  const projectileMesh = new THREE.Group();
  if (preset === "rocket") {
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.42, 20),
      CAD_MATERIALS.terracottaBody
    );
    body.rotation.z = -Math.PI / 2;
    projectileMesh.add(body);
  } else if (preset === "football") {
    const ball = buildRollingBallCAD(0.16);
    projectileMesh.add(ball);
  } else {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 24, 20),
      CAD_MATERIALS.turnedBrass
    );
    projectileMesh.add(sphere);
  }

  const launchOrigin = new THREE.Vector3(launchX, visualH + 0.12, 0);
  projectileMesh.position.copy(launchOrigin);
  root.add(projectileMesh);

  return { root, projectileMesh, launchOrigin };
}

/**
 * 5. Stage Finale CAD Assembly: Rutherford Alpha Particle Cloud Chamber (`cloud_chamber_rig.glb`)
 */
export function buildCloudChamberCAD(atomicNumberZ: number): {
  root: THREE.Group;
  nucleusGroup: THREE.Group;
} {
  const root = new THREE.Group();
  root.name = "Cloud_Chamber_Rig";

  // Anodized chamber base plate
  const basePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.4, 0.18, 40),
    CAD_MATERIALS.darkForestSteel
  );
  basePlate.position.y = -0.9;
  root.add(basePlate);

  // Lower & Upper Copper Helmholtz Magnetic Coils
  for (const yPos of [-0.72, 0.85]) {
    const coil = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.11, 16, 48),
      CAD_MATERIALS.copperCoil
    );
    coil.rotation.x = Math.PI / 2;
    coil.position.y = yPos;
    root.add(coil);
  }

  // Transparent glass cylinder wall
  const glassWall = new THREE.Mesh(
    new THREE.CylinderGeometry(2.15, 2.15, 1.55, 40, 1, true),
    CAD_MATERIALS.glassChamber
  );
  glassWall.position.y = 0.06;
  root.add(glassWall);

  // Lead collimator alpha source gun on the left
  const emitterBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.42, 0.42),
    CAD_MATERIALS.anodizedAluminum
  );
  emitterBox.position.set(-1.95, 0.05, 0);
  root.add(emitterBox);

  // Thin Gold Foil sheet in the center
  const foilSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    CAD_MATERIALS.goldFoil
  );
  foilSheet.rotation.y = Math.PI / 2;
  foilSheet.position.set(0, 0.05, 0);
  root.add(foilSheet);

  // Central clustered atomic nucleus (Protons + Neutrons scaled by Z)
  const nucleusGroup = new THREE.Group();
  nucleusGroup.position.set(0, 0.05, 0);
  const nucleonCount = Math.max(4, Math.min(36, Math.round(atomicNumberZ * 0.45)));
  const nucleonGeo = new THREE.SphereGeometry(0.065, 12, 12);

  for (let i = 0; i < nucleonCount; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / nucleonCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = 0.08 + Math.cbrt(nucleonCount) * 0.04;
    const nucleon = new THREE.Mesh(
      nucleonGeo,
      i % 2 === 0 ? CAD_MATERIALS.terracottaBody : CAD_MATERIALS.turnedBrass
    );
    nucleon.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
    nucleusGroup.add(nucleon);
  }
  root.add(nucleusGroup);

  return { root, nucleusGroup };
}

/**
 * 3D Force Vector Helper builder (Gravity mg, Normal N, Friction f, Velocity v)
 */
export function buildForceVectorsGroup(
  angleDeg: number,
  body: "ball" | "block",
  friction: number
): THREE.Group {
  const vectors = new THREE.Group();
  vectors.name = "Force_Vectors_Overlay";
  const theta = (angleDeg * Math.PI) / 180;

  // 1. Gravity vector mg (straight down -Y in world space, rotated +theta in ramp local space)
  const gravityDir = new THREE.Vector3(Math.sin(theta), -Math.cos(theta), 0).normalize();
  const gravityArrow = new THREE.ArrowHelper(
    gravityDir,
    new THREE.Vector3(0, 0, 0),
    0.75,
    0xc76f50,
    0.16,
    0.1
  );
  vectors.add(gravityArrow);

  // 2. Normal force vector N (+Y in ramp local space)
  const normalArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    0.75 * Math.cos(theta),
    0x214a3d,
    0.16,
    0.1
  );
  vectors.add(normalArrow);

  // 3. Down-ramp acceleration / velocity direction (+X in ramp local space)
  const motionArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    0.68,
    0xd9a14c,
    0.16,
    0.1
  );
  vectors.add(motionArrow);

  // 4. Opposing friction vector (-X along ramp surface)
  const frictionLen = body === "ball" ? 0.25 : Math.min(0.6, friction * 0.55);
  if (frictionLen > 0.04) {
    const frictionArrow = new THREE.ArrowHelper(
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, -0.1, 0),
      frictionLen,
      0x496e60,
      0.13,
      0.08
    );
    vectors.add(frictionArrow);
  }

  return vectors;
}

/**
 * Parametric 3D Helical Spring Curve for Hooke's Law & Harmonic Oscillations
 */
export class HelicalSpringCurve extends THREE.Curve<THREE.Vector3> {
  coils: number;
  radius: number;
  length: number;

  constructor(coils = 9, radius = 0.15, length = 1.85) {
    super();
    this.coils = coils;
    this.radius = radius;
    this.length = length;
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    const x = t * this.length;
    let y = 0;
    let z = 0;
    if (t > 0.05 && t < 0.95) {
      const u = (t - 0.05) / 0.9;
      const angle = u * Math.PI * 2 * this.coils;
      y = Math.sin(angle) * this.radius;
      z = Math.cos(angle) * this.radius;
    }
    return optionalTarget.set(x, y, z);
  }
}

/**
 * 6. Harmonic Oscillator CAD Assembly: Spring-Mass Rig (`spring_mass_rig.glb`)
 */
export function buildSpringMassCAD(massKg = 1.0): {
  root: THREE.Group;
  springGroup: THREE.Group;
  springMesh: THREE.Mesh;
  massGroup: THREE.Group;
  restLength: number;
  eqX: number;
} {
  const root = new THREE.Group();
  root.name = "Spring_Mass_Rig";

  const anchorX = -1.95;
  const restLength = 1.85;
  const eqX = anchorX + 0.14 + restLength;

  // Base laboratory air-track rail
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.1, 0.7),
    CAD_MATERIALS.darkForestSteel
  );
  rail.position.set(0.1, -0.05, 0);
  root.add(rail);

  // Calibration tick marks along rail
  for (let i = -7; i <= 7; i++) {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.005, 0.5),
      i === 0 ? CAD_MATERIALS.terracottaBody : CAD_MATERIALS.anodizedAluminum
    );
    tick.position.set(eqX + i * 0.22, 0.003, 0);
    root.add(tick);
  }

  // Anchor wall mount at left end
  const anchorWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.72, 0.6),
    CAD_MATERIALS.anodizedAluminum
  );
  anchorWall.position.set(anchorX, 0.36, 0);
  root.add(anchorWall);

  const wallEyelet = new THREE.Mesh(
    new THREE.TorusGeometry(0.065, 0.018, 12, 24),
    CAD_MATERIALS.turnedBrass
  );
  wallEyelet.position.set(anchorX + 0.12, 0.35, 0);
  root.add(wallEyelet);

  // Helical coil spring
  const springCurve = new HelicalSpringCurve(9, 0.15, restLength);
  const springGeo = new THREE.TubeGeometry(springCurve, 140, 0.018, 8, false);
  const springMesh = new THREE.Mesh(springGeo, CAD_MATERIALS.turnedBrass);

  const springGroup = new THREE.Group();
  springGroup.position.set(anchorX + 0.14, 0.35, 0);
  springGroup.add(springMesh);
  root.add(springGroup);

  // Glider Mass Block with stackable brass weights
  const massGroup = new THREE.Group();
  massGroup.name = "Glider_Mass";
  const blockRadius = 0.22 * Math.pow(Math.max(0.5, Math.min(10, massKg)), 0.22);
  const blockMesh = new THREE.Mesh(
    new THREE.BoxGeometry(blockRadius * 2, 0.34, 0.44),
    CAD_MATERIALS.terracottaBody
  );
  blockMesh.position.y = 0.17;
  massGroup.add(blockMesh);

  // Eyelet connecting mass to spring
  const massEyelet = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.018, 12, 24),
    CAD_MATERIALS.turnedBrass
  );
  massEyelet.position.set(-blockRadius, 0.35, 0);
  massGroup.add(massEyelet);

  // Stack of brass weight plates proportional to massKg
  const numPlates = Math.max(1, Math.min(5, Math.round(massKg)));
  for (let i = 0; i < numPlates; i++) {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.04, 20),
      CAD_MATERIALS.turnedBrass
    );
    plate.position.y = 0.36 + i * 0.045;
    massGroup.add(plate);
  }

  massGroup.position.set(eqX, 0, 0);
  root.add(massGroup);

  return { root, springGroup, springMesh, massGroup, restLength, eqX };
}

