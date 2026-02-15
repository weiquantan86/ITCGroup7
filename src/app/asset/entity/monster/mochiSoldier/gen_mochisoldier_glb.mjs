import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Blob } from "node:buffer";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

if (typeof globalThis.Blob === "undefined") {
  globalThis.Blob = Blob;
}

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
        .catch((error) => {
          this.onerror?.(error);
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
        .catch((error) => {
          this.onerror?.(error);
          this.onloadend?.({ target: this });
        });
    }
  };
}

const outPath = "public/assets/monsters/mochiSoldier/mochiSoldier.glb";
mkdirSync(dirname(outPath), { recursive: true });

const scene = new THREE.Scene();

const bodyMat = new THREE.MeshStandardMaterial({
  color: 0xf8fafc,
  roughness: 0.78,
  metalness: 0.06,
  emissive: 0xe2e8f0,
  emissiveIntensity: 0.08,
});

const bodyAccentMat = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  roughness: 0.72,
  metalness: 0.08,
});

const footMat = new THREE.MeshStandardMaterial({
  color: 0x334155,
  roughness: 0.86,
  metalness: 0.1,
});

const eyeShellMat = new THREE.MeshStandardMaterial({
  color: 0x000000,
  roughness: 0.62,
  metalness: 0.05,
  emissive: 0x000000,
  emissiveIntensity: 0,
});

const weaponShaftMat = new THREE.MeshStandardMaterial({
  color: 0x5b6677,
  roughness: 0.64,
  metalness: 0.24,
});

const weaponBladeMat = new THREE.MeshStandardMaterial({
  color: 0xe5e7eb,
  roughness: 0.28,
  metalness: 0.65,
  emissive: 0x94a3b8,
  emissiveIntensity: 0.12,
});

const root = new THREE.Group();
root.name = "mochiSoldierRoot";

const body = new THREE.Mesh(new THREE.SphereGeometry(0.82, 32, 24), bodyMat);
body.name = "body";
body.scale.set(1.0, 1.08, 1.0);
body.position.set(0, 1.18, 0);
root.add(body);

const bodyBand = new THREE.Mesh(
  new THREE.TorusGeometry(0.54, 0.06, 14, 28),
  bodyAccentMat
);
bodyBand.name = "bodyBand";
bodyBand.position.set(0, 1.05, 0);
bodyBand.rotation.x = Math.PI / 2;
root.add(bodyBand);

const legLeft = new THREE.Group();
legLeft.name = "legLeft";
legLeft.position.set(-0.34, 0.12, 0);
const footLeft = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.58), footMat);
footLeft.name = "footL";
legLeft.add(footLeft);
root.add(legLeft);

const legRight = new THREE.Group();
legRight.name = "legRight";
legRight.position.set(0.34, 0.12, 0);
const footRight = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.58), footMat);
footRight.name = "footR";
legRight.add(footRight);
root.add(legRight);

const faceMount = new THREE.Group();
faceMount.name = "faceMount";
faceMount.position.set(0, 1.33, 0.71);
root.add(faceMount);

const eyeGeo = new THREE.SphereGeometry(
  0.23,
  18,
  14,
  0,
  Math.PI * 2,
  0,
  Math.PI / 2
);

const eyeLeft = new THREE.Mesh(eyeGeo, eyeShellMat);
eyeLeft.name = "eyeL";
const eyeRight = new THREE.Mesh(eyeGeo, eyeShellMat);
eyeRight.name = "eyeR";
for (const eye of [eyeLeft, eyeRight]) {
  eye.rotation.x = -Math.PI / 2;
  eye.scale.set(1, 1, 0.6);
}

eyeLeft.position.set(-0.28, -0.05, 0);
eyeRight.position.set(0.28, -0.05, 0);

eyeLeft.rotation.set(3, 0.1, 0.5);
eyeRight.rotation.set(-3, 0.1, -0.5);

faceMount.add(eyeLeft, eyeRight);

const armRight = new THREE.Group();
armRight.name = "armRight";
armRight.position.set(0.67, 1.02, 0.03);
const rightArmMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.22, 0.62, 0.22),
  bodyAccentMat
);
rightArmMesh.name = "armRightMesh";
armRight.add(rightArmMesh);
root.add(armRight);

const armLeft = new THREE.Group();
armLeft.name = "armLeft";
armLeft.position.set(-0.67, 1.02, 0.03);
const leftArmMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.56, 0.2),
  bodyAccentMat
);
leftArmMesh.name = "armLeftMesh";
armLeft.add(leftArmMesh);
root.add(armLeft);

const spear = new THREE.Group();
spear.name = "coldSpear";
spear.position.set(0.73, 1.1, 0.14);
spear.rotation.y = 0.12;
root.add(spear);

const spearShaft = new THREE.Mesh(
  new THREE.CylinderGeometry(0.05, 0.05, 1.65, 12),
  weaponShaftMat
);
spearShaft.name = "spearShaft";
spearShaft.rotation.z = Math.PI / 2;
spear.add(spearShaft);

const spearGuard = new THREE.Mesh(
  new THREE.BoxGeometry(0.08, 0.28, 0.28),
  weaponBladeMat
);
spearGuard.name = "spearGuard";
spearGuard.position.set(0.72, 0, 0);
spear.add(spearGuard);

const spearBlade = new THREE.Mesh(
  new THREE.ConeGeometry(0.12, 0.4, 6),
  weaponBladeMat
);
spearBlade.name = "spearBlade";
spearBlade.position.set(0.92, 0, 0);
spearBlade.rotation.z = -Math.PI / 2;
spear.add(spearBlade);

const spearTail = new THREE.Mesh(
  new THREE.ConeGeometry(0.08, 0.22, 6),
  weaponBladeMat
);
spearTail.name = "spearTail";
spearTail.position.set(-0.88, 0, 0);
spearTail.rotation.z = Math.PI / 2;
spear.add(spearTail);

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
    if (!base64Match) {
      throw new Error("Expected embedded base64 buffer for GLB conversion.");
    }

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
