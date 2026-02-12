import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Blob } from "node:buffer";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

if (typeof globalThis.Blob === "undefined") globalThis.Blob = Blob;

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null;
      this.onloadend = null;
      this.onload = null;
      this.onerror = null;
    }
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((buffer) => {
          this.result = buffer;
          this.onload?.({ target: this });
          this.onloadend?.({ target: this });
        })
        .catch((err) => {
          this.onerror?.(err);
          this.onloadend?.({ target: this });
        });
    }
    readAsDataURL(blob) {
      blob
        .arrayBuffer()
        .then((buffer) => {
          const base64 = Buffer.from(buffer).toString("base64");
          const type = blob.type || "application/octet-stream";
          this.result = `data:${type};base64,${base64}`;
          this.onload?.({ target: this });
          this.onloadend?.({ target: this });
        })
        .catch((err) => {
          this.onerror?.(err);
          this.onloadend?.({ target: this });
        });
    }
  };
}

const outPath = "public/assets/characters/carrot/carrot.glb";
mkdirSync(dirname(outPath), { recursive: true });

const scene = new THREE.Scene();

const palette = {
  obsidian: 0x07080d,
  charcoal: 0x151922,
  graphite: 0x232732,
  violet: 0x5b3a89,
  violetGlow: 0x211235,
  hornViolet: 0x311255,
  hornGlow: 0x190a2f,
  eyeGray: 0x767c89,
  eyePurple: 0x724ab5,
  eyeCorePurpleDeep: 0x3b1367,
};

const bodyMat = new THREE.MeshStandardMaterial({
  color: palette.obsidian,
  roughness: 0.9,
  metalness: 0.07,
  emissive: palette.violetGlow,
  emissiveIntensity: 0.22,
});
const bodyMatAlt = new THREE.MeshStandardMaterial({
  color: palette.charcoal,
  roughness: 0.86,
  metalness: 0.11,
  emissive: palette.violetGlow,
  emissiveIntensity: 0.18,
});
const accentMat = new THREE.MeshStandardMaterial({
  color: palette.graphite,
  roughness: 0.82,
  metalness: 0.16,
  emissive: palette.violet,
  emissiveIntensity: 0.26,
});
const hatMat = new THREE.MeshStandardMaterial({
  color: 0x06070a,
  roughness: 0.9,
  metalness: 0.58,
  emissive: 0x020205,
  emissiveIntensity: 0.08,
});
const roofMat = new THREE.MeshStandardMaterial({
  color: 0x08090d,
  roughness: 0.48,
  metalness: 0.42,
  emissive: 0x06070b,
  emissiveIntensity: 0.1,
});
const hornMat = new THREE.MeshStandardMaterial({
  color: palette.hornViolet,
  roughness: 0.3,
  metalness: 0.68,
  emissive: palette.hornGlow,
  emissiveIntensity: 0.18,
});
const eyeGrayMat = new THREE.MeshStandardMaterial({
  color: palette.eyeGray,
  roughness: 0.78,
  metalness: 0.48,
  emissive: 0x171b24,
  emissiveIntensity: 0.14,
});
const eyePurpleMat = new THREE.MeshStandardMaterial({
  color: palette.eyePurple,
  roughness: 0.74,
  metalness: 0.1,
  emissive: 0x2a1644,
  emissiveIntensity: 0.2,
});
const eyeCoreDeepPurpleMat = new THREE.MeshStandardMaterial({
  color: palette.eyeCorePurpleDeep,
  roughness: 0.68,
  metalness: 0.12,
  emissive: 0x17072a,
  emissiveIntensity: 0.24,
});

const createOutlinedMesh = (
  geometry,
  material,
  { name = "" } = {}
) => {
  const mesh = new THREE.Mesh(geometry, material);
  if (name) mesh.name = name;

  return mesh;
};

const createSlitEyeGeometry = (w, h) => {
  const s = new THREE.Shape();

  const rx = w * 0.5;   
  const ry = h;        
  const topY = 0;      
  const cx = 0;       
  const cy = topY;   

  s.moveTo(-rx, topY);
  s.lineTo(rx, topY);

  s.ellipse(cx, cy, rx, ry, 0, 0, Math.PI, true);

  s.closePath();
  return new THREE.ShapeGeometry(s);
};

const createTrianglePlate = (w, h, thickness = 0.08) => {
  const shape = new THREE.Shape();
  shape.moveTo(0, h);
  shape.lineTo(-w * 0.5, 0);
  shape.lineTo(w * 0.5, 0);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });
};

const root = new THREE.Group();
root.name = "carrot_root";

// Head sphere (this is the face).
const head = new THREE.Group();
head.name = "head";
head.position.set(0, 1.05, 0);
root.add(head);

const headBall = createOutlinedMesh(
  new THREE.SphereGeometry(0.71, 32, 24),
  bodyMat,
  { name: "headBall" }
);
headBall.scale.set(1.0, 1.22, 1.0);
head.add(headBall);

// Face mount only (no face shell mesh) to avoid angle-dependent artifact planes.
const faceMount = new THREE.Group();
faceMount.name = "faceMount";
faceMount.rotation.x = -Math.PI / 2;
faceMount.position.set(0, -0.18, 0.56);
headBall.add(faceMount);

const eyesGroup = new THREE.Group();
eyesGroup.name = "eyesGroup";
faceMount.add(eyesGroup);

// Eyes (half-spheres) + inward-slanted slit eyes.
const eyeGeo = new THREE.SphereGeometry(0.23, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2);
const eyeL = createOutlinedMesh(eyeGeo, eyeGrayMat, {
  name: "eyeL",
  outlineThreshold: 30,
  outlineOpacity: 0.55,
});
const eyeR = createOutlinedMesh(eyeGeo, eyePurpleMat, {
  name: "eyeR",
  outlineThreshold: 30,
  outlineOpacity: 0.55,
});
[eyeL, eyeR].forEach((eye) => {
  eye.rotation.x = -Math.PI / 2;
  eye.scale.set(1, 1, 0.6);
});

eyeL.position.set(-0.25, -0.02, 0.13);
eyeR.position.set(0.25, -0.02, 0.13);

eyeL.rotation.z = THREE.MathUtils.degToRad(26);
eyeR.rotation.z = THREE.MathUtils.degToRad(-26);

faceMount.add(eyeL, eyeR);

// Hat (visor + low pyramid roof) attached to the sphere head.
const hat = new THREE.Group();
hat.name = "hat";
hat.position.set(0, 0.42, 0);
headBall.add(hat);

const visor = createOutlinedMesh(
  new THREE.BoxGeometry(1.45, 0.36, 1.4),
  hatMat,
  { name: "visor" }
);
visor.position.set(0, -0.08, 0.01);
hat.add(visor);

const roof = createOutlinedMesh(
  new THREE.ConeGeometry(0.98, 0.6, 4),
  roofMat,
  { name: "roof" }
);
// Align the pyramid base edges with the visor.
roof.rotation.y = Math.PI / 4;
roof.position.set(0, 0.36, 0.02);
// Preserve width/depth, lower height only.
roof.scale.set(1.0, 0.85, 1.05);
hat.add(roof);

// Horns: sit on the upper slanted sides of the pyramid.
const hornGeo = new THREE.ConeGeometry(0.275, 0.8, 4);
const hornL = createOutlinedMesh(hornGeo, hornMat, {
  name: "hornL",
  outlineThreshold: 26,
  outlineOpacity: 0.85,
});
const hornR = createOutlinedMesh(hornGeo, hornMat, {
  name: "hornR",
  outlineThreshold: 26,
  outlineOpacity: 0.85,
});
hornL.position.set(-0.4, 0.2, -0.37);
hornR.position.set(0.4, 0.2, 0.37);
hornL.rotation.set(-0.7, 0, 0.5);
hornR.rotation.set(0.7, 0, -0.5);
roof.add(hornL, hornR);

// Legs/feet (named legs for runtime animation).
const footGeo = new THREE.BoxGeometry(0.62, 0.22, 0.52);
const footL = createOutlinedMesh(footGeo, bodyMatAlt, { name: "footL" });
const footR = createOutlinedMesh(footGeo, bodyMatAlt, { name: "footR" });

const legLeft = new THREE.Group();
legLeft.name = "legLeft";
legLeft.position.set(-0.4, 0.15, 0);
footL.position.set(0, 0, 0);
legLeft.add(footL);

const legRight = new THREE.Group();
legRight.name = "legRight";
legRight.position.set(0.4, 0.15, 0);
footR.position.set(0, 0, 0);
legRight.add(footR);

root.add(legLeft, legRight);

// Small inner wedges (pelvis hints).
const wedgeGeo = createTrianglePlate(0.25, 0.22, 0.12);
const legWedgeL = createOutlinedMesh(wedgeGeo, accentMat, { name: "legWedgeL" });
const legWedgeR = createOutlinedMesh(wedgeGeo, accentMat, { name: "legWedgeR" });
legWedgeL.position.set(-0.3, 0.46, 0.02);
legWedgeR.position.set(0.3, 0.46, 0.02);
legWedgeL.rotation.y = Math.PI;
legWedgeR.rotation.y = Math.PI;
root.add(legWedgeL, legWedgeR);

// Big right hand (bigger and closer; still slightly detached).
const armRight = new THREE.Group();
armRight.name = "armRight";
armRight.position.set(1.5, 1.08, 0.18);

const palm = createOutlinedMesh(
  new THREE.CylinderGeometry(0.54, 0.54, 0.22, 8),
  bodyMatAlt,
  { name: "palm" }
);
palm.rotation.x = Math.PI / 2;
palm.scale.set(1.0, 1.08, 0.9);
armRight.add(palm);

const magicEyeGroup = new THREE.Group();
magicEyeGroup.name = "magicEye group";
magicEyeGroup.position.set(0, 0, 0);
palm.add(magicEyeGroup);

const magicEye = createOutlinedMesh(
  new THREE.SphereGeometry(0.24, 20, 16),
  eyePurpleMat,
  { name: "magicEye" }
);
magicEye.scale.set(0.8, 0.5, 1.4);
magicEye.position.set(0, 0.075, 0);
magicEye.rotation.set(0, 0.3, 0);
magicEyeGroup.add(magicEye);

const magicEyeCore = createOutlinedMesh(
  new THREE.SphereGeometry(0.175, 20, 16),
  eyeCoreDeepPurpleMat,
  { name: "magicEyeCore" }
);
magicEyeCore.position.set(0, 0.075, 0);
magicEyeGroup.add(magicEyeCore);

const fingerBaseGeo = new THREE.BoxGeometry(0.148, 0.54, 0.175);
const fingerJointGeo = new THREE.SphereGeometry(0.058, 12, 9);
const fingerTipGeo = new THREE.CylinderGeometry(0.046, 0.08, 0.42, 8);
// 5 fingers mapped to 5 sides of the octagon palm.
const fingerAngles = [112.5, 67.5, 22.5, -22.5, -67.5];
const fingerDist = [0.35, 0.34, 0.33, 0.34, 0.35];
const fingerBaseLen = [1.0, 0.95, 0.9, 0.95, 0.9];
const fingerTipLen = [0.9, 0.86, 0.82, 0.86, 0.82];
const fingerTipCurl = [-0.24, -0.28, -0.34, -0.28, -0.22];
const fingerBaseLength = 0.54;
const fingerTipLength = 0.42;
const fingerJointRadius = 0.058;

fingerAngles.forEach((deg, i) => {
  const t = THREE.MathUtils.degToRad(deg);

  const fingerRoot = new THREE.Group();
  fingerRoot.name = `fingerRoot${i + 1}`;
  fingerRoot.position.set(Math.cos(t) * fingerDist[i], Math.sin(t) * fingerDist[i], 0.02);
  fingerRoot.rotation.z = t - Math.PI / 2;
  armRight.add(fingerRoot);

  const fingerA = createOutlinedMesh(fingerBaseGeo, bodyMat, {
    name: `finger${i + 1}A`,
    outlineThreshold: 28,
    outlineOpacity: 0.85,
  });
  fingerA.scale.set(1, fingerBaseLen[i], 1);
  const fingerALength = fingerBaseLength * fingerBaseLen[i];
  fingerA.position.y = fingerALength * 0.5;
  fingerRoot.add(fingerA);

  const fingerJoint = createOutlinedMesh(fingerJointGeo, bodyMatAlt, {
    name: `finger${i + 1}Joint`,
    outlineThreshold: 28,
    outlineOpacity: 0.85,
  });
  const jointY = fingerALength + fingerJointRadius * 0.2;
  fingerJoint.position.y = jointY;
  fingerRoot.add(fingerJoint);

  const fingerTipPivot = new THREE.Group();
  fingerTipPivot.name = `finger${i + 1}Bpivot`;
  fingerTipPivot.position.y = jointY;
  fingerTipPivot.rotation.z = fingerTipCurl[i];
  fingerRoot.add(fingerTipPivot);

  const fingerB = createOutlinedMesh(fingerTipGeo, bodyMat, {
    name: `finger${i + 1}B`,
    outlineThreshold: 28,
    outlineOpacity: 0.85,
  });
  fingerB.scale.set(1, fingerTipLen[i], 1);
  const fingerBLength = fingerTipLength * fingerTipLen[i];
  fingerB.position.y = fingerJointRadius * 0.32 + fingerBLength * 0.5;
  fingerTipPivot.add(fingerB);
});

root.add(armRight);

root.traverse((child) => {
  if (!child.isMesh) return;
  child.castShadow = true;
  child.receiveShadow = true;
});

scene.add(root);

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (result) => {
    if (result instanceof ArrayBuffer) {
      writeFileSync(outPath, Buffer.from(result));
      console.log(`Wrote ${outPath}`);
      return;
    }

    const gltf = result;
    if (!gltf.buffers || gltf.buffers.length === 0) {
      throw new Error("No buffers found in glTF result.");
    }
    const bufferUri = gltf.buffers[0].uri || "";
    const base64Match = bufferUri.match(/^data:.*;base64,(.*)$/);
    if (!base64Match) throw new Error("Expected embedded base64 buffer.");

    const binBuffer = Buffer.from(base64Match[1], "base64");
    gltf.buffers[0].byteLength = binBuffer.length;
    delete gltf.buffers[0].uri;

    const jsonText = JSON.stringify(gltf);
    const jsonPadding = (4 - (jsonText.length % 4)) % 4;
    const jsonChunk = Buffer.from(jsonText + " ".repeat(jsonPadding));

    const binPadding = (4 - (binBuffer.length % 4)) % 4;
    const binChunk = Buffer.concat([binBuffer, Buffer.alloc(binPadding)]);

    const totalLength = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLength, 8);

    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonChunk.length, 0);
    jsonHeader.writeUInt32LE(0x4e4f534a, 4);

    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binChunk.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);

    const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
    writeFileSync(outPath, glb);
    console.log(`Wrote ${outPath}`);
  },
  { binary: true }
);
