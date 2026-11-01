# Chalk 3D — Pre-Rendered CAD & Physics Architecture (`docs/CAD_MODELS.md`)

> **Owner:** KirilBoiko — 3D CAD Assets, Three.js Viewport, Rapier Physics & Analytic Trajectory Verification.
> **Core Principle:** Teachers and students cannot wait 15–60 seconds for runtime 3D mesh generation or heavy cloud shaders. **All 3D CAD laboratory apparatus, bodies, and rigs are pre-modeled, pre-baked as binary `.glb` assets in `frontend/public/models/`, and paired with synchronous procedural CAD prefabs** so the 3D lab launches in **< 50 ms** and runs at **60 FPS** on any laptop, Chromebook, or projector.

---

## 1. Why Pre-Rendered / Pre-Baked CAD?

1. **Instant Startup (< 50 ms Time-to-First-Frame):**
   - Every scenario in [`contracts/scene_spec.schema.json`](../contracts/scene_spec.schema.json) (`incline`, `projectile`, `pendulum`, `collision_1d`) plus `cloud_chamber` maps to a **pre-rendered `.glb` CAD assembly** stored locally in `frontend/public/models/`.
   - On page load, our `PrebakedCadRegistry` renders immediately using pre-compiled buffer geometries and hydrates from local `.glb` binaries with **zero network wait**.
2. **Parametric CAD Pivot Nodes (60 FPS Mutation):**
   - Instead of regenerating meshes when a student asks *"What if the angle is 45° or mass is doubled?"*, our pre-rendered CAD assemblies expose named transform pivots (`#Ramp_Pivot`, `#Body_Origin`, `#Launcher_Barrel`, `#Pendulum_Arm`) that update mathematically in `< 1 ms`.
3. **Exact Analytic vs. Rapier Verification (< 2% Tolerance):**
   -Per [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md), the AI model never grades itself. Our physics engine steps at a fixed $\Delta t = 1/120\text{ s}$, records the trajectory $s(t)$, compares it against the exact closed-form analytical solution, and plots the **Theory vs. Simulation Curve** live on screen.

---

## 2. Pre-Rendered CAD Asset Manifest (`frontend/public/models/`)

All `.glb` files are generated and verified via `node frontend/scripts/generate-prebaked-cad.mjs` (or exported from Fusion 360 / Blender following the node conventions below).

### P0 Scenario: Inclined Plane (`scenario: "incline"`)

| Asset File | Rigging / Node Hierarchy | Visual & CAD Details | Physics Formula Verified |
| :--- | :--- | :--- | :--- |
| `incline_ramp_rig.glb` | `Ramp_Base` $\rightarrow$ `Ramp_Hinge` (rotates by `angle_deg` $\theta$) $\rightarrow$ `Ramp_Track` (scales to `length` $L$) + `Protractor_Arc` | Brushed aluminum & birch laboratory incline bench with engraved 10 cm calibration ticks, adjustable angle strut, and rubber stop bumper at $s = L$. | — |
| `rolling_ball_cad.glb` | `Ball_Root` (`r = 0.22 m`) with orthogonal meridian bands (`Band_X`, `Band_Y`, `Band_Z`) | High-contrast brass/terracotta sphere with meridian stripes so rotational angular velocity $\omega(t) = v(t)/r$ is visually unmistakable during no-slip rolling. | $a = \frac{5}{7} g \sin\theta$, $t = \sqrt{\frac{2L}{a}}$ *(independent of mass $m$!)* |
| `sliding_block_cad.glb` | `Block_Root` (`0.45 m × 0.28 m × 0.32 m`) with top brass mass stack (`Mass_Plates`) | Anodized sled block with replaceable brass weight plates (visual height scales with `mass`) and felt friction pad base. | $a = g(\sin\theta - \mu\cos\theta)$, $t = \sqrt{\frac{2L}{a}}$ (stationary if $\tan\theta \le \mu$) |

### P1 Scenario 1: Projectile Launcher (`scenario: "projectile"`)

| Asset File | Rigging / Node Hierarchy | Visual & CAD Details | Physics Formula Verified |
| :--- | :--- | :--- | :--- |
| `projectile_launcher_rig.glb` | `Pedestal_Base` (scales to `height` $h_0$) $\rightarrow$ `Barrel_Pivot` (rotates by `angle_deg` $\theta$) $\rightarrow$ `Muzzle_Origin` | Precision spring-loaded classroom cannon with brass protractor quadrant, launch platform, and landing bullseye ring (`Target_Ring`) placed at $x = R$. | $t = \frac{v_0\sin\theta + \sqrt{(v_0\sin\theta)^2 + 2gh_0}}{g}$, $R = v_0\cos\theta \cdot t$ |

### P1 Scenario 2: Simple / Large-Angle Pendulum (`scenario: "pendulum"`)

| Asset File | Rigging / Node Hierarchy | Visual & CAD Details | Physics Formula Verified |
| :--- | :--- | :--- | :--- |
| `pendulum_rig.glb` | `Gantry_Frame` $\rightarrow$ `Pivot_Axle` $\rightarrow$ `Pendulum_Rod` (length $L$) $\rightarrow$ `Bob_Mass` | A-frame laboratory support stand with top encoder protractor, rigid carbon rod, and turned brass spherical bob. | Small/large angle RK4 & elliptic integral period $T = 2\pi\sqrt{\frac{L}{g}}\left(1 + \frac{\theta_0^2}{16} + \dots\right)$ |

### P1 Scenario 3: 1D Linear Air-Track Collision (`scenario: "collision_1d"`)

| Asset File | Rigging / Node Hierarchy | Visual & CAD Details | Physics Formula Verified |
| :--- | :--- | :--- | :--- |
| `collision_track_rig.glb` | `Air_Track_Rail` + `Cart_A` (`mass_a`, `velocity_a`) + `Cart_B` (`mass_b`, `velocity_b`) | Low-friction anodized linear air track with two color-coded glider carts (`#c76f50` Terracotta & `#214a3d` Forest Green) and spring bumpers. | $v_A' = \frac{(m_A - e m_B)v_A + (1+e)m_B v_B}{m_A + m_B}$, $v_B' = \frac{(1+e)m_A v_A + (m_B - e m_A)v_B}{m_A + m_B}$ |

### P1 Scenario 4: Spring-Mass Harmonic Oscillator (`scenario: "spring_mass"`)

| Asset File | Rigging / Node Hierarchy | Visual & CAD Details | Physics Formula Verified |
| :--- | :--- | :--- | :--- |
| `spring_mass_rig.glb` | `Anchor_Wall` $\rightarrow$ `Helical_Spring` ($9$ coils, parametric tube) $\rightarrow$ `Glider_Mass` (scales with $m$) | Precision laboratory air-rail with engraved ticks, left anchor eyelet, dynamic brass helical spring that stretches/compresses at 60 FPS, and stackable mass plates. | Hooke's Law $F = -k x$, Natural frequency $\omega_0 = \sqrt{\frac{k}{m}}$, Period $T = 2\pi\sqrt{\frac{m}{k}}$ |

### Stage Showcase Bonus: Rutherford Cloud Chamber & 4-Way Hologram Mode

| Asset File | Rigging / Node Hierarchy | Visual & CAD Details | Physics Formula Verified |
| :--- | :--- | :--- | :--- |
| `cloud_chamber_rig.glb` | `Chamber_Glass` + `Helmholtz_Coils` + `Gold_Foil_Mount` + `Nucleus_Lattice` | Cylindrical glass diffusion chamber with glowing Gold ($Z=79$) / Aluminum ($Z=13$) / Hydrogen ($Z=1$) nucleus lattice and instanced $\alpha$-particle trails. | Coulomb repulsion $\vec{F}_C = \frac{k q_\alpha Z e}{r^2}\hat{r}$ + Lorentz force $\vec{F}_B = q_\alpha(\vec{v} \times \vec{B})$ |

---

## 3. CAD Export Standards (Fusion 360 / SolidWorks / Blender $\rightarrow$ `.glb`)

If editing or adding new models in external CAD software:
- **Coordinate System:** `+Y` Up, `+X` Right (down-ramp horizontal projection), `+Z` Forward toward camera.
- **Units:** `1.0 WebGL unit = 1.0 meter` (SI units matching `contracts/scene_spec.schema.json`).
- **Triangle Budget:** `< 8,000 triangles` per assembly so even 4-way Pepper's Ghost Hologram Mode renders at a locked `60 FPS`.
- **Pre-Baked Materials:** Use `MeshStandardMaterial` with baked vertex/roughness values (Warm Brass `#d49b4b`, Terracotta `#c76f50`, Chalk Forest `#214a3d`, Birch Wood `#d8c39e`, Brushed Steel `#8c9bae`) so models require zero external texture image requests.

---

## 4. 3D Force Vectors & Analytic Verification Overlay

Every pre-rendered CAD scene automatically renders real-time 3D engineering overlays:
1. **3D Force & Velocity Vectors (`THREE.ArrowHelper`):**
   - Gravity $m\vec{g}$ (Terracotta `#c76f50`)
   - Normal Force $\vec{N}$ (Forest Green `#214a3d`)
   - Friction $\vec{f}$ or Restoring Force (Amber `#d49b4b`)
   - Velocity Vector $\vec{v}(t)$ (Teal `#2a9d8f`)
2. **Real-Time Analytic vs. Simulated Trajectory Chart:**
   - Embedded directly below/inside the viewport: plots theoretical position $s_{\text{theory}}(t)$ (dashed curve) vs. Rapier/measured position $s_{\text{sim}}(t)$ (solid curve) at 120 Hz.
3. **4-Way Pepper's Ghost Hologram Mode (`hologramMode`):**
   - Splits the WebGL canvas into 4 rotated viewports (`0°, 90°, 180°, 270°`) around a `#000000` center square for physical acetate pyramid projection on stage.
