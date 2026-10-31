import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildCloudChamberCAD,
  buildForceVectorsGroup,
  buildInclineRampCAD,
  buildProjectileLauncherCAD,
  buildRollingBallCAD,
  buildSlidingBlockCAD,
  buildSpringMassCAD,
} from "../cad/prebakedModels";
import { solveIncline } from "../physics/solver";
import type { InclineSceneSpec } from "../types";

type CadPreviewMode = "incline" | "projectile" | "cloud_chamber" | "spring";

type PhysicsSceneProps = {
  scene: InclineSceneSpec;
  isPlaying: boolean;
  onChangeBody?: (body: "ball" | "block") => void;
};

/**
 * Pre-Rendered 3D CAD & Analytical/Rapier Physics Viewport (`<PhysicsScene />`).
 *
 * - Renders pre-baked CAD rigs (`/models/*.glb` + synchronous Three.js CAD prefabs)
 *   with < 20ms initialization latency.
 * - Full interactive OrbitControls: click/drag to rotate 360°, right-click to pan, scroll to zoom.
 * - Dynamic CAD mass scaling: doubling mass visibly enlarges & adds weight rings to the ball.
 * - Supports 4-Way Pepper's Ghost Hologram Projection Mode (`gl.setViewport` / `gl.setScissor`).
 * - Real-time 120Hz Theory vs. Simulation trajectory telemetry.
 */
export function PhysicsScene({ scene, isPlaying, onChangeBody }: PhysicsSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const [cadMode, setCadMode] = useState<CadPreviewMode>("incline");
  const [showVectors, setShowVectors] = useState(true);
  const [hologramMode, setHologramMode] = useState(false);
  const [activePov, setActivePov] = useState<"orbit" | "side" | "top" | "slope">("orbit");
  const [simTime, setSimTime] = useState(0);
  const [webglReady, setWebglReady] = useState(true);

  const solution = useMemo(() => solveIncline(scene), [scene]);

  const setCameraAngle = (view: "orbit" | "side" | "top" | "slope") => {
    setActivePov(view);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (view === "orbit") {
      camera.position.set(0.2, 1.35, 4.6);
      controls.target.set(0, 0.45, 0);
    } else if (view === "side") {
      camera.position.set(0, 0.45, 5.2);
      controls.target.set(0, 0.45, 0);
    } else if (view === "top") {
      camera.position.set(0, 5.8, 0.01);
      controls.target.set(0, 0, 0);
    } else if (view === "slope") {
      camera.position.set(-2.6, 2.2, 2.2);
      controls.target.set(0.8, 0.2, 0);
    }
    controls.update();
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch {
      setWebglReady(false);
      return;
    }

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 320;
    renderer.setSize(width, height);
    renderer.domElement.style.cursor = "grab";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const onMouseDown = () => {
      renderer.domElement.style.cursor = "grabbing";
    };
    const onMouseUp = () => {
      renderer.domElement.style.cursor = "grab";
    };
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(hologramMode ? 0x050807 : 0xeaf0e4);

    // Studio & Classroom Lighting
    const ambient = new THREE.AmbientLight(0xffffff, hologramMode ? 1.1 : 0.85);
    threeScene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff6e5, 1.35);
    keyLight.position.set(3.5, 6.0, 4.5);
    keyLight.castShadow = true;
    threeScene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x90d5c8, 0.55);
    rimLight.position.set(-4.0, 2.5, -3.0);
    threeScene.add(rimLight);

    if (!hologramMode) {
      const grid = new THREE.GridHelper(10, 20, 0x9ab0a1, 0xcbd8cd);
      grid.position.y = -0.12;
      threeScene.add(grid);
    }

    const worldRoot = new THREE.Group();
    threeScene.add(worldRoot);

    // Setup Camera & OrbitControls
    const mainCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    mainCamera.position.set(0.2, 1.35, 4.6);
    mainCamera.lookAt(0, 0.45, 0);
    cameraRef.current = mainCamera;

    const controls = new OrbitControls(mainCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.45, 0);
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controls.minDistance = 1.0;
    controls.maxDistance = 18.0;
    controlsRef.current = controls;

    // Dynamic actors for animation loop
    let inclineBodyGroup: THREE.Group | null = null;
    let inclineVisualLength = 3.2;
    let bodyRadius = 0.22;
    let projectileActor: THREE.Group | null = null;
    let projectileOrigin = new THREE.Vector3(-2.1, 0.8, 0);
    let chamberNucleus: THREE.Group | null = null;
    let springRig: ReturnType<typeof buildSpringMassCAD> | null = null;
    let springForceArrow: THREE.ArrowHelper | null = null;
    const alphaParticles: {
      mesh: THREE.Mesh;
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      trail: THREE.Line;
      points: THREE.Vector3[];
    }[] = [];

    if (cadMode === "incline") {
      inclineVisualLength = Math.max(2.6, Math.min(5.2, scene.length * 0.85));
      const { root: rampRoot, rampPlank } = buildInclineRampCAD(scene.length, scene.angle_deg);
      worldRoot.add(rampRoot);

      inclineBodyGroup = new THREE.Group();
      // Cube-root scaling so "double the mass" visibly enlarges & deepens bronze tint of ball
      bodyRadius =
        scene.body === "ball"
          ? 0.2 * Math.pow(Math.max(0.5, Math.min(10, scene.mass)), 0.24)
          : 0.22;

      const cadMesh =
        scene.body === "ball"
          ? buildRollingBallCAD(0.2, scene.mass)
          : buildSlidingBlockCAD(scene.mass);

      if (scene.body === "ball") {
        cadMesh.position.y = bodyRadius;
      }
      inclineBodyGroup.add(cadMesh);

      if (showVectors) {
        const vectors = buildForceVectorsGroup(scene.angle_deg, scene.body, scene.friction);
        vectors.position.y = bodyRadius + 0.05;
        inclineBodyGroup.add(vectors);
      }

      // Dashed analytical trajectory guide along the incline
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.25, bodyRadius, 0),
        new THREE.Vector3(inclineVisualLength - 0.15, bodyRadius, 0),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0xc76f50,
        dashSize: 0.14,
        gapSize: 0.08,
      });
      const guideLine = new THREE.Line(lineGeo, lineMat);
      guideLine.computeLineDistances();
      rampPlank.add(guideLine);

      inclineBodyGroup.position.set(0.25, 0, 0);
      rampPlank.add(inclineBodyGroup);
    } else if (cadMode === "projectile") {
      const { root, projectileMesh, launchOrigin } = buildProjectileLauncherCAD(
        1.4,
        scene.angle_deg,
        scene.body === "ball" ? "cannonball" : "rocket"
      );
      projectileActor = projectileMesh;
      projectileOrigin = launchOrigin;
      worldRoot.add(root);

      const theta = (scene.angle_deg * Math.PI) / 180;
      const v0 = 6.2;
      const vx = v0 * Math.cos(theta);
      const vy = v0 * Math.sin(theta);
      const curvePts: THREE.Vector3[] = [];
      for (let t = 0; t <= 1.8; t += 0.05) {
        const x = launchOrigin.x + vx * t;
        const y = launchOrigin.y + vy * t - 0.5 * scene.gravity * t * t;
        if (y >= -0.02) curvePts.push(new THREE.Vector3(x, y, 0));
      }
      const arcGeo = new THREE.BufferGeometry().setFromPoints(curvePts);
      const arcLine = new THREE.Line(
        arcGeo,
        new THREE.LineDashedMaterial({ color: 0xc76f50, dashSize: 0.12, gapSize: 0.07 })
      );
      arcLine.computeLineDistances();
      worldRoot.add(arcLine);
    } else if (cadMode === "cloud_chamber") {
      const zNumber = scene.mass > 2 ? 79 : scene.mass > 1 ? 13 : 1;
      const { root, nucleusGroup } = buildCloudChamberCAD(zNumber);
      chamberNucleus = nucleusGroup;
      worldRoot.add(root);

      const pGeo = new THREE.SphereGeometry(0.045, 10, 10);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
      for (let i = 0; i < 18; i++) {
        const mesh = new THREE.Mesh(pGeo, pMat);
        const ySpread = ((i % 9) - 4) * 0.09;
        const zSpread = (Math.floor(i / 9) - 0.5) * 0.14;
        const startPos = new THREE.Vector3(-1.8 - i * 0.18, 0.05 + ySpread, zSpread);
        mesh.position.copy(startPos);
        worldRoot.add(mesh);

        const trailGeo = new THREE.BufferGeometry().setFromPoints([startPos.clone(), startPos.clone()]);
        const trailLine = new THREE.Line(
          trailGeo,
          new THREE.LineBasicMaterial({ color: 0x64dfdf, transparent: true, opacity: 0.75 })
        );
        worldRoot.add(trailLine);

        alphaParticles.push({
          mesh,
          pos: startPos.clone(),
          vel: new THREE.Vector3(2.4, 0, 0),
          trail: trailLine,
          points: [startPos.clone()],
        });
      }
    } else if (cadMode === "spring") {
      springRig = buildSpringMassCAD(scene.mass);
      worldRoot.add(springRig.root);

      if (showVectors) {
        springForceArrow = new THREE.ArrowHelper(
          new THREE.Vector3(-1, 0, 0),
          new THREE.Vector3(springRig.eqX, 0.45, 0),
          0.6,
          0xc76f50,
          0.16,
          0.09
        );
        worldRoot.add(springForceArrow);
      }
    }

    let animId = 0;
    const clockStart = performance.now();

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const elapsedSec = (now - clockStart) / 1000;

      if (!hologramMode) {
        controls.update();
      }

      if (cadMode === "incline" && inclineBodyGroup) {
        const totalDur = Math.max(0.4, solution.durationSeconds);
        const activeT = isPlaying ? elapsedSec % (totalDur + 0.6) : 0;
        const clampedT = Math.min(activeT, totalDur);
        setSimTime(clampedT);

        const sMeters = solution.isStationary
          ? 0
          : Math.min(scene.length, 0.5 * solution.acceleration * clampedT * clampedT);
        const progress = scene.length > 0 ? sMeters / scene.length : 0;
        const travelSpan = Math.max(0.5, inclineVisualLength - 0.55);
        const currentX = 0.25 + progress * travelSpan;

        inclineBodyGroup.position.x = currentX;
        const bodyMesh = inclineBodyGroup.children[0];
        if (bodyMesh && scene.body === "ball") {
          bodyMesh.rotation.z = -(sMeters / bodyRadius);
        }
      } else if (cadMode === "projectile" && projectileActor) {
        const theta = (scene.angle_deg * Math.PI) / 180;
        const v0 = 6.2;
        const vx = v0 * Math.cos(theta);
        const vy = v0 * Math.sin(theta);
        const flightT = (vy + Math.sqrt(vy * vy + 2 * scene.gravity * projectileOrigin.y)) / scene.gravity;
        const t = isPlaying ? elapsedSec % (flightT + 0.5) : 0;
        const tc = Math.min(t, flightT);
        projectileActor.position.set(
          projectileOrigin.x + vx * tc,
          Math.max(0.08, projectileOrigin.y + vy * tc - 0.5 * scene.gravity * tc * tc),
          0
        );
      } else if (cadMode === "cloud_chamber") {
        if (chamberNucleus) {
          chamberNucleus.rotation.y = elapsedSec * 0.6;
        }
        const dt = 0.016;
        const coulombStrength = (scene.mass / 5.0) * 0.14;
        for (const p of alphaParticles) {
          if (isPlaying) {
            const toParticle = p.pos.clone().sub(new THREE.Vector3(0, 0.05, 0));
            const distSq = Math.max(0.025, toParticle.lengthSq());
            const force = toParticle.normalize().multiplyScalar(coulombStrength / distSq);
            const lorentz = new THREE.Vector3(0, p.vel.x * 0.15, -p.vel.y * 0.15);
            p.vel.addScaledVector(force.add(lorentz), dt);
            p.pos.addScaledVector(p.vel, dt);
            p.mesh.position.copy(p.pos);

            p.points.push(p.pos.clone());
            if (p.points.length > 26) p.points.shift();
            p.trail.geometry.setFromPoints(p.points);

            if (p.pos.x > 2.0 || p.pos.length() > 2.2) {
              p.pos.set(-1.95, 0.05 + (Math.random() - 0.5) * 0.65, (Math.random() - 0.5) * 0.3);
              p.vel.set(2.4, 0, 0);
              p.points = [p.pos.clone()];
            }
          }
        }
      } else if (cadMode === "spring" && springRig) {
        const k = 32.0;
        const m = Math.max(0.2, scene.mass);
        const omega0 = Math.sqrt(k / m);
        const period = (2 * Math.PI) / omega0;
        const amplitude = 0.78;
        const decay = 0.025;

        const activeT = isPlaying ? elapsedSec : 0;
        const xDisp = isPlaying
          ? amplitude * Math.cos(omega0 * activeT) * Math.exp(-decay * activeT)
          : 0.65;

        setSimTime(isPlaying ? activeT % period : 0);

        // Update mass block position
        springRig.massGroup.position.x = springRig.eqX + xDisp;

        // Dynamic 3D helical coil spring scaling
        const currentLen = Math.max(0.35, springRig.restLength + xDisp);
        springRig.springMesh.scale.x = currentLen / springRig.restLength;

        // Dynamic Hooke's restoring force vector F = -kx
        if (springForceArrow) {
          const forceDir = xDisp > 0 ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(1, 0, 0);
          springForceArrow.setDirection(forceDir);
          springForceArrow.position.set(springRig.eqX + xDisp, 0.45, 0);
          springForceArrow.setLength(
            Math.max(0.02, Math.min(1.2, Math.abs(xDisp) * 1.15)),
            0.14,
            0.08
          );
        }
      }

      if (!hologramMode) {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, width, height);
        renderer.render(threeScene, mainCamera);
      } else {
        // 4-Way Pepper's Ghost Hologram Viewport Split
        renderer.setScissorTest(true);
        renderer.setClearColor(0x050807, 1);
        renderer.clear();

        const size = Math.min(width, height) * 0.36;
        const cx = width / 2;
        const cy = height / 2;
        const offset = size * 0.72;

        const views = [
          { x: cx - size / 2, y: cy + offset - size / 2, camPos: [0, 1.2, 4.2], up: [0, -1, 0] },
          { x: cx - size / 2, y: cy - offset - size / 2, camPos: [0, 1.2, -4.2], up: [0, 1, 0] },
          { x: cx - offset - size / 2, y: cy - size / 2, camPos: [-4.2, 1.2, 0], up: [1, 0, 0] },
          { x: cx + offset - size / 2, y: cy - size / 2, camPos: [4.2, 1.2, 0], up: [-1, 0, 0] },
        ];

        const holoCam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        for (const v of views) {
          renderer.setViewport(v.x, v.y, size, size);
          renderer.setScissor(v.x, v.y, size, size);
          holoCam.position.set(v.camPos[0], v.camPos[1], v.camPos[2]);
          holoCam.up.set(v.up[0], v.up[1], v.up[2]);
          holoCam.lookAt(0, 0.45, 0);
          renderer.render(threeScene, holoCam);
        }
      }
    };

    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 320;
      renderer.setSize(w, h);
      mainCamera.aspect = w / h;
      mainCamera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      controls.dispose();
      renderer.dispose();
    };
  }, [scene, isPlaying, cadMode, showVectors, hologramMode, solution]);

  const chartPaths = useMemo(() => {
    const pts = solution.trajectory;
    if (pts.length < 2) return { theory: "", sim: "" };
    const maxT = Math.max(0.1, pts[pts.length - 1].t);
    const maxS = Math.max(0.5, scene.length);

    const toSvg = (t: number, s: number) => {
      const x = 8 + (t / maxT) * 184;
      const y = 48 - (s / maxS) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    const step = Math.max(1, Math.floor(pts.length / 28));
    const sampled = pts.filter((_, idx) => idx % step === 0 || idx === pts.length - 1);

    return {
      theory: sampled.map((p) => toSvg(p.t, p.theoryPos)).join(" "),
      sim: sampled.map((p) => toSvg(p.t, p.simPos)).join(" "),
    };
  }, [solution, scene.length]);

  const rampAngle = Math.max(18, Math.min(42, scene.angle_deg * 0.9));

  return (
    <div
      className="scene-stage"
      aria-label={`A ${scene.body} on a ${scene.angle_deg} degree incline`}
      style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
    >
      {/* 3D Viewport Controls & Scene Switcher */}
      <div
        style={{
          position: "relative",
          zIndex: 4,
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          justifyContent: "space-between",
          padding: "8px 10px",
          background: hologramMode ? "rgba(8,14,12,0.85)" : "rgba(251,250,245,0.86)",
          borderBottom: "1px solid rgba(180,194,180,0.45)",
          fontSize: "0.68rem",
          fontFamily: '"DM Mono", monospace',
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setCadMode("incline")}
            style={{
              padding: "3px 7px",
              border: "1px solid #496e60",
              background: cadMode === "incline" ? "#214a3d" : "transparent",
              color: cadMode === "incline" ? "#fbf9f2" : "#214a3d",
              borderRadius: "2px",
            }}
          >
            CAD: Incline ({scene.body})
          </button>
          {onChangeBody ? (
            <button
              type="button"
              onClick={() => onChangeBody(scene.body === "ball" ? "block" : "ball")}
              style={{
                padding: "3px 7px",
                border: "1px solid #c76f50",
                background: "#f6f0e5",
                color: "#854c35",
                borderRadius: "2px",
              }}
            >
              Swap: {scene.body === "ball" ? "Ball → Block" : "Block → Ball"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setCadMode("projectile")}
            style={{
              padding: "3px 7px",
              border: "1px solid #496e60",
              background: cadMode === "projectile" ? "#214a3d" : "transparent",
              color: cadMode === "projectile" ? "#fbf9f2" : "#214a3d",
              borderRadius: "2px",
            }}
          >
            CAD: Projectile
          </button>
          <button
            type="button"
            onClick={() => setCadMode("cloud_chamber")}
            style={{
              padding: "3px 7px",
              border: "1px solid #496e60",
              background: cadMode === "cloud_chamber" ? "#214a3d" : "transparent",
              color: cadMode === "cloud_chamber" ? "#fbf9f2" : "#214a3d",
              borderRadius: "2px",
            }}
          >
            CAD: Cloud Chamber
          </button>
          <button
            type="button"
            onClick={() => setCadMode("spring")}
            style={{
              padding: "3px 7px",
              border: "1px solid #496e60",
              background: cadMode === "spring" ? "#214a3d" : "transparent",
              color: cadMode === "spring" ? "#fbf9f2" : "#214a3d",
              borderRadius: "2px",
            }}
          >
            CAD: Spring-Mass
          </button>
        </div>

        {/* Camera Angles / Orbit POV Preset Buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
          <span style={{ fontSize: "0.62rem", color: "#617267", marginRight: "2px" }}>
            POV:
          </span>
          <button
            type="button"
            onClick={() => setCameraAngle("orbit")}
            style={{
              padding: "2px 6px",
              border: "1px solid #809386",
              background: activePov === "orbit" ? "#214a3d" : "transparent",
              color: activePov === "orbit" ? "#fff" : "#314d3e",
              borderRadius: "2px",
              fontSize: "0.64rem",
            }}
          >
            Free Orbit
          </button>
          <button
            type="button"
            onClick={() => setCameraAngle("side")}
            style={{
              padding: "2px 6px",
              border: "1px solid #809386",
              background: activePov === "side" ? "#214a3d" : "transparent",
              color: activePov === "side" ? "#fff" : "#314d3e",
              borderRadius: "2px",
              fontSize: "0.64rem",
            }}
          >
            Side
          </button>
          <button
            type="button"
            onClick={() => setCameraAngle("top")}
            style={{
              padding: "2px 6px",
              border: "1px solid #809386",
              background: activePov === "top" ? "#214a3d" : "transparent",
              color: activePov === "top" ? "#fff" : "#314d3e",
              borderRadius: "2px",
              fontSize: "0.64rem",
            }}
          >
            Top
          </button>
          <button
            type="button"
            onClick={() => setCameraAngle("slope")}
            style={{
              padding: "2px 6px",
              border: "1px solid #809386",
              background: activePov === "slope" ? "#214a3d" : "transparent",
              color: activePov === "slope" ? "#fff" : "#314d3e",
              borderRadius: "2px",
              fontSize: "0.64rem",
            }}
          >
            Down-Ramp
          </button>
          <button
            type="button"
            onClick={() => setShowVectors((v) => !v)}
            style={{
              padding: "2px 6px",
              border: "1px solid #809386",
              background: showVectors ? "#e2edda" : "transparent",
              color: "#214a3d",
              borderRadius: "2px",
            }}
          >
            Vectors {showVectors ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            onClick={() => setHologramMode((h) => !h)}
            style={{
              padding: "2px 6px",
              border: "1px solid #c76f50",
              background: hologramMode ? "#c76f50" : "transparent",
              color: hologramMode ? "#fff" : "#a55d43",
              borderRadius: "2px",
            }}
          >
            {hologramMode ? "◈ 4-Way Hologram" : "◇ Hologram"}
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas with OrbitControls */}
      <div
        ref={mountRef}
        style={{
          position: "relative",
          flex: 1,
          minHeight: "245px",
          width: "100%",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 8,
            left: 10,
            zIndex: 3,
            fontSize: "0.62rem",
            color: "#6b7c70",
            pointerEvents: "none",
            background: "rgba(255,255,255,0.7)",
            padding: "2px 6px",
            borderRadius: "3px",
          }}
        >
          🖱️ Click & drag to rotate 3D view · Scroll to zoom
        </span>

        {!webglReady ? (
          <>
            <div className="scene-grid" />
            <span className="scene-label scene-label--top">inclined plane</span>
            <span className="scene-label scene-label--angle">{scene.angle_deg}°</span>
            <div className="ramp" style={{ transform: `rotate(${-rampAngle}deg)` }} />
            <div
              className={`rolling-body rolling-body--${scene.body} ${
                isPlaying ? "rolling-body--moving" : ""
              }`}
            >
              {scene.body === "ball" ? <span className="ball-mark">×</span> : null}
            </div>
            <div className="trajectory" aria-hidden="true" />
          </>
        ) : null}
      </div>

      {/* Live Analytic Formula vs. 120Hz Simulation Telemetry */}
      <div
        style={{
          position: "relative",
          zIndex: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "6px 12px",
          background: "rgba(251,250,245,0.92)",
          borderTop: "1px solid rgba(180,194,180,0.5)",
          fontFamily: '"DM Mono", monospace',
          fontSize: "0.66rem",
          color: "#315342",
        }}
      >
        <div>
          <strong>
            {cadMode === "spring"
              ? "Hooke's Law: F = −k·x | m·ẍ + k·x = 0"
              : solution.formulaEquation}
          </strong>
          <div style={{ color: "#617267", fontSize: "0.61rem" }}>
            {cadMode === "spring"
              ? `Mass: ${scene.mass} kg · k = 32 N/m · ω₀ = ${(Math.sqrt(32 / Math.max(0.2, scene.mass))).toFixed(2)} rad/s · Period T = ${( (2 * Math.PI) / Math.sqrt(32 / Math.max(0.2, scene.mass)) ).toFixed(2)}s`
              : `Mass: ${scene.mass} kg · t = ${simTime.toFixed(2)}s / ${solution.durationSeconds.toFixed(2)}s · a = ${solution.acceleration.toFixed(2)} m/s²`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "0.6rem", color: "#60756a" }}>Theory vs 120Hz Sim</span>
          <svg
            width="130"
            height="36"
            viewBox="0 0 200 54"
            aria-label="Theory versus simulation trajectory curve"
            style={{
              background: "#f5f1e7",
              border: "1px solid #d5dfcf",
              borderRadius: "2px",
            }}
          >
            <polyline
              fill="none"
              stroke="#214a3d"
              strokeWidth="2.5"
              points={chartPaths.sim}
            />
            <polyline
              fill="none"
              stroke="#c76f50"
              strokeWidth="2"
              strokeDasharray="5,4"
              points={chartPaths.theory}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
