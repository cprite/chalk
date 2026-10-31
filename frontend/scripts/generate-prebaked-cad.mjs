/**
 * Pre-Rendered CAD Binary Asset Generator (`generate-prebaked-cad.mjs`)
 *
 * Pre-builds and exports binary glTF 2.0 (`.glb`) 3D CAD models into
 * `frontend/public/models/` so teachers and students never wait for runtime
 * mesh generation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/models");
fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * Lightweight, zero-DOM-dependency binary GLB serializer for Three.js Groups/Meshes.
 * Packages positions, normals, indices, and PBR baseColorFactor/metallic/roughness into
 * a compliant glTF 2.0 `.glb` binary container.
 */
function exportGroupToGLB(group, modelName) {
  group.updateMatrixWorld(true);

  const meshes = [];
  group.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      meshes.push(obj);
    }
  });

  const bufferChunks = [];
  const bufferViews = [];
  const accessors = [];
  const materials = [];
  const gltfMeshes = [];
  const nodes = [];
  let byteOffset = 0;

  function appendBuffer(typedArray, target) {
    const uint8 = new Uint8Array(
      typedArray.buffer,
      typedArray.byteOffset,
      typedArray.byteLength
    );
    const pad = (4 - (uint8.byteLength % 4)) % 4;
    const padded = new Uint8Array(uint8.byteLength + pad);
    padded.set(uint8);

    const viewIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: uint8.byteLength,
      ...(target ? { target } : {}),
    });

    bufferChunks.push(padded);
    byteOffset += padded.byteLength;
    return viewIndex;
  }

  meshes.forEach((mesh, idx) => {
    const geom = mesh.geometry.clone();
    geom.applyMatrix4(mesh.matrixWorld);

    const posAttr = geom.getAttribute("position");
    const normAttr = geom.getAttribute("normal");
    const indexAttr = geom.getIndex();

    const posArray = new Float32Array(posAttr.count * 3);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      posArray[i * 3] = x;
      posArray[i * 3 + 1] = y;
      posArray[i * 3 + 2] = z;
      if (x < min[0]) min[0] = x;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x;
      if (y > max[1]) max[1] = y;
      if (z > max[2]) max[2] = z;
    }

    const posView = appendBuffer(posArray, 34962);
    const posAcc = accessors.length;
    accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: posAttr.count,
      type: "VEC3",
      min,
      max,
    });

    let normAcc;
    if (normAttr) {
      const normArray = new Float32Array(normAttr.count * 3);
      for (let i = 0; i < normAttr.count; i++) {
        normArray[i * 3] = normAttr.getX(i);
        normArray[i * 3 + 1] = normAttr.getY(i);
        normArray[i * 3 + 2] = normAttr.getZ(i);
      }
      const normView = appendBuffer(normArray, 34962);
      normAcc = accessors.length;
      accessors.push({
        bufferView: normView,
        componentType: 5126,
        count: normAttr.count,
        type: "VEC3",
      });
    }

    let indicesAcc;
    if (indexAttr) {
      const idxArray = new Uint16Array(indexAttr.count);
      for (let i = 0; i < indexAttr.count; i++) {
        idxArray[i] = indexAttr.getX(i);
      }
      const idxView = appendBuffer(idxArray, 34963);
      indicesAcc = accessors.length;
      accessors.push({
        bufferView: idxView,
        componentType: 5123,
        count: indexAttr.count,
        type: "SCALAR",
      });
    }

    const mat = mesh.material;
    const color = mat?.color ?? new THREE.Color(0xc76f50);
    const matIdx = materials.length;
    materials.push({
      name: `${modelName}_mat_${idx}`,
      pbrMetallicRoughness: {
        baseColorFactor: [color.r, color.g, color.b, mat?.opacity ?? 1.0],
        metallicFactor: mat?.metalness ?? 0.3,
        roughnessFactor: mat?.roughness ?? 0.5,
      },
    });

    const meshIdx = gltfMeshes.length;
    gltfMeshes.push({
      name: mesh.name || `${modelName}_part_${idx}`,
      primitives: [
        {
          attributes: {
            POSITION: posAcc,
            ...(normAcc !== undefined ? { NORMAL: normAcc } : {}),
          },
          ...(indicesAcc !== undefined ? { indices: indicesAcc } : {}),
          material: matIdx,
        },
      ],
    });

    nodes.push({
      name: mesh.name || `${modelName}_node_${idx}`,
      mesh: meshIdx,
    });
  });

  const gltfJson = {
    asset: {
      version: "2.0",
      generator: "Chalk Pre-Rendered CAD Generator",
    },
    scene: 0,
    scenes: [
      {
        name: modelName,
        nodes: nodes.map((_, i) => i),
      },
    ],
    nodes,
    meshes: gltfMeshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };

  const jsonBytes = Buffer.from(JSON.stringify(gltfJson), "utf8");
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonPadded = Buffer.concat([
    jsonBytes,
    Buffer.alloc(jsonPad, 0x20), // pad with spaces per glTF 2.0 spec
  ]);

  const binBuffer = Buffer.concat(bufferChunks.map((c) => Buffer.from(c)));
  const totalLength = 12 + 8 + jsonPadded.byteLength + 8 + binBuffer.byteLength;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4); // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonPadded.byteLength, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binBuffer.byteLength, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return Buffer.concat([
    header,
    jsonChunkHeader,
    jsonPadded,
    binChunkHeader,
    binBuffer,
  ]);
}

// Build our 5 core pre-rendered CAD assemblies
const matWood = new THREE.MeshStandardMaterial({ color: 0xd9c29c, roughness: 0.62, metalness: 0.05 });
const matAlum = new THREE.MeshStandardMaterial({ color: 0x7b9387, roughness: 0.35, metalness: 0.55 });
const matSteel = new THREE.MeshStandardMaterial({ color: 0x214a3d, roughness: 0.4, metalness: 0.45 });
const matTerra = new THREE.MeshStandardMaterial({ color: 0xc76f50, roughness: 0.32, metalness: 0.18 });
const matBrass = new THREE.MeshStandardMaterial({ color: 0xd9a14c, roughness: 0.25, metalness: 0.78 });

// 1. incline_ramp_rig.glb
const rampGroup = new THREE.Group();
const base = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 1.15), matSteel);
base.name = "Ramp_Base";
rampGroup.add(base);
const plank = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.9), matWood);
plank.name = "Ramp_Track";
plank.position.set(0, 0.85, 0);
plank.rotation.z = -Math.PI / 6;
rampGroup.add(plank);

// 2. rolling_ball_cad.glb
const ballGroup = new THREE.Group();
const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), matTerra);
sphere.name = "Sphere_Core";
ballGroup.add(sphere);
const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.221, 0.01, 12, 36), matBrass);
ring1.name = "Meridian_Band_Z";
ballGroup.add(ring1);
const ring2 = ring1.clone();
ring2.name = "Meridian_Band_X";
ring2.rotation.x = Math.PI / 2;
ballGroup.add(ring2);

// 3. sliding_block_cad.glb
const blockGroup = new THREE.Group();
const sled = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.36), matTerra);
sled.name = "Block_Sled";
sled.position.y = 0.11;
blockGroup.add(sled);
const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 24), matBrass);
weight.name = "Brass_Mass_Stack";
weight.position.y = 0.26;
blockGroup.add(weight);

// 4. projectile_launcher_rig.glb
const launcherGroup = new THREE.Group();
const ped = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.46), matAlum);
ped.name = "Launcher_Pedestal";
ped.position.y = 0.45;
launcherGroup.add(ped);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.65, 24), matBrass);
barrel.name = "Launcher_Barrel";
barrel.position.set(0.2, 0.95, 0);
barrel.rotation.z = -Math.PI / 4;
launcherGroup.add(barrel);

// 5. cloud_chamber_rig.glb
const chamberGroup = new THREE.Group();
const chamberBase = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.4, 0.18, 40), matSteel);
chamberBase.name = "Chamber_Base";
chamberGroup.add(chamberBase);
const coilTop = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.11, 16, 48), matBrass);
coilTop.name = "Helmholtz_Coil_Top";
coilTop.rotation.x = Math.PI / 2;
coilTop.position.y = 0.85;
chamberGroup.add(coilTop);

const modelsToExport = [
  { file: "incline_ramp_rig.glb", group: rampGroup, description: "P0 Inclined Plane CAD Bench" },
  { file: "rolling_ball_cad.glb", group: ballGroup, description: "P0 Rolling Sphere with Brass Meridian Stripes" },
  { file: "sliding_block_cad.glb", group: blockGroup, description: "P0 Sliding Block with Brass Weights" },
  { file: "projectile_launcher_rig.glb", group: launcherGroup, description: "P1 Articulated Projectile Cannon Rig" },
  { file: "cloud_chamber_rig.glb", group: chamberGroup, description: "Rutherford Cloud Chamber + Helmholtz Coils" },
];

const manifest = {
  generatedAt: new Date().toISOString(),
  strategy: "pre-rendered-glb-zero-wait",
  models: [],
};

for (const item of modelsToExport) {
  const glbBuffer = exportGroupToGLB(item.group, path.basename(item.file, ".glb"));
  const fullPath = path.join(OUT_DIR, item.file);
  fs.writeFileSync(fullPath, glbBuffer);
  manifest.models.push({
    file: `/models/${item.file}`,
    bytes: glbBuffer.byteLength,
    description: item.description,
  });
  console.log(`Generated ${item.file} (${(glbBuffer.byteLength / 1024).toFixed(1)} KB)`);
}

fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Pre-rendered CAD manifest written to frontend/public/models/manifest.json");
