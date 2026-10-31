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
  const leftX = -(visualLen * Math.cos(theta)) / 2;
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

  // Side guide rails
  for (const zOffset of [-0.42, 0.42]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(visualLen, 0.06, 0.05),
      CAD_MATERIALS.anodizedAluminum
    );
    rail.position.set(visualLen / 2, 0.02, zOffset);
    rampPlank.add(rail);
  }

  // Ruler calibration tick marks
  const numTicks = Math.floor(visualLen / 0.35);
  for (let i = 1; i <= numTicks; i++) {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.006, 0.76),
      CAD_MATERIALS.darkForestSteel
    );
    tick.position.set((i / (numTicks + 1)) * visualLen, 0.003, 0);
    rampPlank.add(tick);
  }

  // Bottom rubber bumper stop
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
 * Scales radius & weight rings with massKg so "double the mass" visibly enlarges the sphere.
 */
export function buildRollingBallCAD(baseRadius = 0.2, massKg = 1.0): THREE.Group {
  const group = new THREE.Group();
  group.name = "Rolling_Ball_CAD";

  const radius = baseRadius * Math.pow(Math.max(0.5, Math.min(10, massKg)), 0.24);

  const bodyMat =
    massKg >= 2.0
      ? new THREE.MeshStandardMaterial({
          color: 0x9e472a,
          roughness: 0.25,
          metalness: 0.48,
        })
      : CAD_MATERIALS.terracottaBody;

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), bodyMat);
  sphere.castShadow = true;
  group.add(sphere);

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
 * 3. P0 CAD Body: Sliding Friction Block with Stackable Brass Weights (`sliding_block_cad.glb`)
 */
export function buildSlidingBlockCAD(massKg = 1.0): THREE.Group {
  const group = new THREE.Group();
  group.name = "Sliding_Block_CAD";

  const sled = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.22, 0.36),
    CAD_MATERIALS.terracottaBody
  );
  sled.position.y = 0.11;
  sled.castShadow = true;
  group.add(sled);

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.03, 0.37),
    CAD_MATERIALS.rubberStopper
  );
  pad.position.y = 0.015;
  group.add(pad);

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
 * 4. P1 CAD Assembly: Projectile Launcher (`projectile_launcher_rig.glb`)
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

  const groundBar = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.08, 1.1),
    CAD_MATERIALS.darkForestSteel
  );
  groundBar.position.set(0.2, -0.04, 0);
  root.add(groundBar);

  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, visualH, 0.46),
    CAD_MATERIALS.anodizedAluminum
  );
  pedestal.position.set(launchX, visualH / 2, 0);
  root.add(pedestal);

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
 * 5. Rutherford Alpha Particle Cloud Chamber CAD Assembly (`cloud_chamber_rig.glb`)
 */
export function buildCloudChamberCAD(atomicNumberZ: number): {
  root: THREE.Group;
  nucleusGroup: THREE.Group;
} {
  const root = new THREE.Group();
  root.name = "Cloud_Chamber_Rig";

  const basePlate = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.4, 0.18, 40),
    CAD_MATERIALS.darkForestSteel
  );
  basePlate.position.y = -0.9;
  root.add(basePlate);

  for (const yPos of [-0.72, 0.85]) {
    const coil = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.11, 16, 48),
      CAD_MATERIALS.copperCoil
    );
    coil.rotation.x = Math.PI / 2;
    coil.position.y = yPos;
    root.add(coil);
  }

  const glassWall = new THREE.Mesh(
    new THREE.CylinderGeometry(2.15, 2.15, 1.55, 40, 1, true),
    CAD_MATERIALS.glassChamber
  );
  glassWall.position.y = 0.06;
  root.add(glassWall);

  const emitterBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.42, 0.42),
    CAD_MATERIALS.anodizedAluminum
  );
  emitterBox.position.set(-1.95, 0.05, 0);
  root.add(emitterBox);

  const foilSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    CAD_MATERIALS.goldFoil
  );
  foilSheet.rotation.y = Math.PI / 2;
  foilSheet.position.set(0, 0.05, 0);
  root.add(foilSheet);

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
 * Parametric 3D Vertical Helical Spring Curve (hangs along -Y)
 */
export class VerticalHelicalSpringCurve extends THREE.Curve<THREE.Vector3> {
  coils: number;
  radius: number;
  length: number;

  constructor(coils = 8, radius = 0.11, length = 1.0) {
    super();
    this.coils = coils;
    this.radius = radius;
    this.length = length;
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    const y = -t * this.length;
    let x = 0;
    let z = 0;
    if (t > 0.05 && t < 0.95) {
      const u = (t - 0.05) / 0.9;
      const angle = u * Math.PI * 2 * this.coils;
      x = Math.cos(angle) * this.radius;
      z = Math.sin(angle) * this.radius;
    }
    return optionalTarget.set(x, y, z);
  }
}

/**
 * 6. Generative Modular Vertical Spring-Mass Assembly:
 * Assembles 1 to 5 pre-baked springs in PARALLEL (side-by-side) or SERIES (chained end-to-end),
 * calculating effective spring constant k_eff and linking CAD nodes dynamically in real-time.
 */
export interface GenerativeSpringConfig {
  count: number; // 1, 2, 3, 4, 5 springs
  arrangement: "series" | "parallel";
  massKg: number;
  kPerSpring?: number; // default 40 N/m
}

export interface GenerativeSpringAssembly {
  root: THREE.Group;
  springMeshes: THREE.Mesh[];
  massGroup: THREE.Group;
  topY: number;
  restLength: number;
  effectiveK: number;
  arrangement: "series" | "parallel";
  springCount: number;
  connectors: THREE.Group[];
}

export function buildGenerativeSpringAssembly(
  config: GenerativeSpringConfig
): GenerativeSpringAssembly {
  const { count = 1, arrangement = "parallel", massKg = 1.0, kPerSpring = 40.0 } = config;
  const numSprings = Math.max(1, Math.min(5, Math.round(count)));
  const topY = 2.45;

  const root = new THREE.Group();
  root.name = `Generative_Spring_Assembly_${arrangement}_${numSprings}`;

  // 1. Support Gantry Frame
  const baseFloor = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.1, 1.4),
    CAD_MATERIALS.darkForestSteel
  );
  baseFloor.position.set(0, -0.05, 0);
  root.add(baseFloor);

  // Vertical structural posts on left and right
  for (const xSide of [-0.95, 0.95]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 2.65, 18),
      CAD_MATERIALS.anodizedAluminum
    );
    post.position.set(xSide, 1.28, 0);
    root.add(post);
  }

  // Top gantry crossbeam
  const topCrossbeam = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.09, 0.28),
    CAD_MATERIALS.darkForestSteel
  );
  topCrossbeam.position.set(0, topY + 0.045, 0);
  root.add(topCrossbeam);

  // Vertical calibration ruler with centimeter ticks
  for (let y = 0.2; y <= 2.3; y += 0.2) {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.008, 0.01),
      CAD_MATERIALS.chalkWhite
    );
    tick.position.set(0.9, y, 0.08);
    root.add(tick);
  }

  const springMeshes: THREE.Mesh[] = [];
  const connectors: THREE.Group[] = [];

  let effectiveK = kPerSpring;
  let restLength = 1.1;

  if (arrangement === "parallel") {
    // PARALLEL: N springs side-by-side across Z axis
    effectiveK = numSprings * kPerSpring;
    restLength = 1.15;

    // Determine Z positions for N parallel springs
    const zSpan = Math.min(0.9, (numSprings - 1) * 0.24);
    const zStep = numSprings > 1 ? zSpan / (numSprings - 1) : 0;
    const startZ = -zSpan / 2;

    for (let i = 0; i < numSprings; i++) {
      const zPos = startZ + i * zStep;

      // Top brass hook
      const topHook = new THREE.Mesh(
        new THREE.TorusGeometry(0.045, 0.012, 10, 20),
        CAD_MATERIALS.turnedBrass
      );
      topHook.position.set(0, topY, zPos);
      root.add(topHook);

      // Helical vertical spring
      const curve = new VerticalHelicalSpringCurve(9, 0.1, restLength);
      const geo = new THREE.TubeGeometry(curve, 100, 0.015, 8, false);
      const mesh = new THREE.Mesh(geo, CAD_MATERIALS.turnedBrass);
      mesh.position.set(0, topY, zPos);
      root.add(mesh);
      springMeshes.push(mesh);
    }
  } else {
    // SERIES: N springs chained end-to-end vertically
    effectiveK = kPerSpring / numSprings;
    const segLength = 1.4 / numSprings;
    restLength = 1.4;

    for (let i = 0; i < numSprings; i++) {
      const curve = new VerticalHelicalSpringCurve(6, 0.1, segLength);
      const geo = new THREE.TubeGeometry(curve, 80, 0.015, 8, false);
      const mesh = new THREE.Mesh(geo, CAD_MATERIALS.turnedBrass);
      mesh.position.set(0, topY - i * segLength, 0);
      root.add(mesh);
      springMeshes.push(mesh);

      // Coupling ring between series segments
      if (i < numSprings - 1) {
        const ring = new THREE.Group();
        const torus = new THREE.Mesh(
          new THREE.TorusGeometry(0.05, 0.014, 10, 20),
          CAD_MATERIALS.darkForestSteel
        );
        torus.rotation.x = Math.PI / 2;
        ring.add(torus);
        ring.position.set(0, topY - (i + 1) * segLength, 0);
        root.add(ring);
        connectors.push(ring);
      }
    }
  }

  // Hanging Mass Bob with stackable weights
  const massGroup = new THREE.Group();
  massGroup.name = "Hanging_Mass_Bob";

  // Top spreader crossbar if parallel springs > 1
  if (arrangement === "parallel" && numSprings > 1) {
    const zSpan = Math.min(0.9, (numSprings - 1) * 0.24);
    const spreader = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, zSpan + 0.12),
      CAD_MATERIALS.anodizedAluminum
    );
    spreader.position.y = 0;
    massGroup.add(spreader);
  }

  const blockRadius = 0.18 * Math.pow(Math.max(0.5, Math.min(10, massKg)), 0.22);
  const mainBob = new THREE.Mesh(
    new THREE.CylinderGeometry(blockRadius, blockRadius, 0.28, 24),
    CAD_MATERIALS.terracottaBody
  );
  mainBob.position.y = -0.16;
  massGroup.add(mainBob);

  // Top attachment hook on mass
  const massHook = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.014, 10, 20),
    CAD_MATERIALS.turnedBrass
  );
  massHook.position.y = 0.02;
  massGroup.add(massHook);

  // Stack of brass weight disks
  const numPlates = Math.max(1, Math.min(5, Math.round(massKg)));
  for (let i = 0; i < numPlates; i++) {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(blockRadius * 0.85, blockRadius * 0.85, 0.04, 20),
      CAD_MATERIALS.turnedBrass
    );
    plate.position.y = -0.32 - i * 0.045;
    massGroup.add(plate);
  }

  const initialY = topY - restLength;
  massGroup.position.set(0, initialY, 0);
  root.add(massGroup);

  return {
    root,
    springMeshes,
    massGroup,
    topY,
    restLength,
    effectiveK,
    arrangement,
    springCount: numSprings,
    connectors,
  };
}

/**
 * 3D Force Vector Helper builder
 */
export function buildForceVectorsGroup(
  angleDeg: number,
  body: "ball" | "block",
  friction: number
): THREE.Group {
  const vectors = new THREE.Group();
  vectors.name = "Force_Vectors_Overlay";
  const theta = (angleDeg * Math.PI) / 180;

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

  const normalArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    0.75 * Math.cos(theta),
    0x214a3d,
    0.16,
    0.1
  );
  vectors.add(normalArrow);

  const motionArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    0.68,
    0xd9a14c,
    0.16,
    0.1
  );
  vectors.add(motionArrow);

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
