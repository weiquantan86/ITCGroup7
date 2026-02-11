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

const bodyMat = new THREE.MeshStandardMaterial({
  color: 0x0b0c10,
  roughness: 0.92,
  metalness: 0.04,
  emissive: 0x05060a,
  emissiveIntensity: 0.22,
});
const bodyMatAlt = new THREE.MeshStandardMaterial({
  color: 0x11141c,
  roughness: 0.9,
  metalness: 0.05,
  emissive: 0x05060a,
  emissiveIntensity: 0.18,
});
const eyeMat = new THREE.MeshBasicMaterial({
  color: 0xe9eef7,
  transparent: true,
  opacity: 0.98,
  side: THREE.DoubleSide,
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
  new THREE.SphereGeometry(0.72, 32, 24),
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

// Eye sockets (half-spheres) + inward-slanted slit eyes.
const eyeSocketGeo = new THREE.SphereGeometry(0.23, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2);
const eyeSocketL = createOutlinedMesh(eyeSocketGeo, bodyMat, {
  name: "eyeSocketL",
  outlineThreshold: 30,
  outlineOpacity: 0.55,
});
const eyeSocketR = createOutlinedMesh(eyeSocketGeo, bodyMat, {
  name: "eyeSocketR",
  outlineThreshold: 30,
  outlineOpacity: 0.55,
});
[eyeSocketL, eyeSocketR].forEach((socket) => {
  socket.rotation.x = -Math.PI / 2;
  socket.scale.set(1, 1, 0.6);
});

eyeSocketL.position.set(-0.25, -0.02, 0.13);
eyeSocketR.position.set(0.25, -0.02, 0.13);

eyeSocketL.rotation.z = THREE.MathUtils.degToRad(26);
eyeSocketR.rotation.z = THREE.MathUtils.degToRad(-26);

faceMount.add(eyeSocketL, eyeSocketR);

// Hat (visor + low pyramid roof) attached to the sphere head.
const hat = new THREE.Group();
hat.name = "hat";
hat.position.set(0, 0.42, 0);
headBall.add(hat);

const visor = createOutlinedMesh(
  new THREE.BoxGeometry(1.45, 0.36, 1.4),
  bodyMatAlt,
  { name: "visor" }
);
visor.position.set(0, -0.08, 0.01);
hat.add(visor);

const roof = createOutlinedMesh(
  new THREE.ConeGeometry(0.98, 0.6, 4),
  bodyMat,
  { name: "roof" }
);
// Align the pyramid base edges with the visor.
roof.rotation.y = Math.PI / 4;
roof.position.set(0, 0.36, 0.02);
// Preserve width/depth, lower height only.
roof.scale.set(1.0, 0.85, 1.05);
hat.add(roof);

// Horns: sit on the upper slanted sides of the pyramid.
const hornGeo = new THREE.ConeGeometry(0.11, 0.62, 3);
const hornL = createOutlinedMesh(hornGeo, bodyMatAlt, {
  name: "hornL",
  outlineThreshold: 26,
  outlineOpacity: 0.85,
});
const hornR = createOutlinedMesh(hornGeo, bodyMatAlt, {
  name: "hornR",
  outlineThreshold: 26,
  outlineOpacity: 0.85,
});
hornL.position.set(-0.48, 0.2, 0.14);
hornR.position.set(0.48, 0.2, 0.14);
hornL.rotation.set(-0.25, 0.35, Math.PI * 0.62);
hornR.rotation.set(0.25, -0.35, -Math.PI * 0.62);
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
const legWedgeL = createOutlinedMesh(wedgeGeo, bodyMatAlt, { name: "legWedgeL" });
const legWedgeR = createOutlinedMesh(wedgeGeo, bodyMatAlt, { name: "legWedgeR" });
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
  new THREE.SphereGeometry(0.38, 28, 20),
  bodyMatAlt,
  { name: "palm" }
);
palm.scale.set(1.12, 1.28, 0.7);
armRight.add(palm);

const fingerGeo = new THREE.BoxGeometry(0.12, 0.8, 0.14);
const fingerAngles = [105, 65, 30, -5, -40, -80];
const fingerDist = [0.4, 0.4, 0.38, 0.38, 0.42, 0.42];
const fingerLen = [1.2, 1.1, 1.05, 1.0, 1.1, 0.9];

fingerAngles.forEach((deg, i) => {
  const f = createOutlinedMesh(fingerGeo, bodyMat, {
    name: `finger${i + 1}`,
    outlineThreshold: 28,
    outlineOpacity: 0.85,
  });
  f.scale.set(1, fingerLen[i], 1);
  const t = THREE.MathUtils.degToRad(deg);
  f.position.set(Math.cos(t) * fingerDist[i], Math.sin(t) * fingerDist[i], 0.02);
  f.rotation.z = t - Math.PI / 2;
  armRight.add(f);
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
