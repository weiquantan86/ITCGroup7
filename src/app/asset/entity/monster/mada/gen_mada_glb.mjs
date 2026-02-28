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

const outPath = "public/assets/monsters/mada/mada.glb";
mkdirSync(dirname(outPath), { recursive: true });

const scene = new THREE.Scene();

const shellMat = new THREE.MeshStandardMaterial({
  color: 0x1a1b1f,
  roughness: 0.64,
  metalness: 0.12,
  emissive: 0x060608,
  emissiveIntensity: 0.16,
});
const trimMat = new THREE.MeshStandardMaterial({
  color: 0x3a3d46,
  roughness: 0.58,
  metalness: 0.18,
});
const darkMat = new THREE.MeshStandardMaterial({
  color: 0x0a0b0f,
  roughness: 0.72,
  metalness: 0.05,
});
const eyeMat = new THREE.MeshStandardMaterial({
  color: 0xff4d4d,
  roughness: 0.18,
  metalness: 0.0,
  emissive: 0xb91c1c,
  emissiveIntensity: 1.8,
});

function createEyeGeometry(mirrored = false) {
  const size = 0.15;
  const depth = 0.05;
  const half = size / 2;
  const shape = new THREE.Shape();

  if (mirrored) {
    shape.moveTo(half, -half);
    shape.lineTo(-half, -half);
    shape.lineTo(half, half);
  } else {
    shape.moveTo(-half, -half);
    shape.lineTo(half, -half);
    shape.lineTo(-half, half);
  }

  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, -depth / 2);

  return geometry;
}

const root = new THREE.Group();
root.name = "madaRoot";

const headGroup = new THREE.Group();
headGroup.name = "headGroup";
const bodyGroup = new THREE.Group();
bodyGroup.name = "bodyGroup";
const handGroup = new THREE.Group();
handGroup.name = "handGroup";
const feetGroup = new THREE.Group();
feetGroup.name = "feetGroup";

const bodyBaseY = 0.9;
const headBaseY = 1.7;

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.1, 6, 18), shellMat);
torso.name = "torso";
torso.scale.y = 0.92;

const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 18), shellMat);
head.name = "head";

const hornLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.012, 0.48, 8), darkMat);
const hornRight = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.012, 0.48, 8), darkMat);
hornLeft.position.set(-0.18, 0.48, -0.02);
hornRight.position.set(0.18, 0.48, -0.02);
hornLeft.rotation.z = Math.PI / 6;
hornRight.rotation.z = -Math.PI / 6;

const hornTipLeft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 8), darkMat);
const hornTipRight = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 8), darkMat);
hornTipLeft.position.set(-0.29, 0.7, -0.02);
hornTipRight.position.set(0.29, 0.7, -0.02);
hornTipLeft.rotation.z = Math.PI / 6;
hornTipRight.rotation.z = -Math.PI / 6;

const eyeLeft = new THREE.Mesh(createEyeGeometry(false), eyeMat);
const eyeRight = new THREE.Mesh(createEyeGeometry(true), eyeMat);
eyeLeft.position.set(-0.18, 0.09, 0.4);
eyeRight.position.set(0.18, 0.09, 0.4);
eyeLeft.rotation.set(0, -0.3, 0.1);
eyeRight.rotation.set(0, 0.3, -0.1);

const armGeo = new THREE.CapsuleGeometry(0.14, 0.65, 6, 12);

const armLeftGroup = new THREE.Group();
armLeftGroup.name = "armLeft";
armLeftGroup.position.set(-0.55, 0.58, 0);
armLeftGroup.rotation.z = Math.PI / 32;

const armRightGroup = new THREE.Group();
armRightGroup.name = "armRight";
armRightGroup.position.set(0.55, 0.58, 0);
armRightGroup.rotation.z = -Math.PI / 32;

const armLeft = new THREE.Mesh(armGeo, shellMat);
const armRight = new THREE.Mesh(armGeo, shellMat);
armLeft.position.y = -0.45;
armRight.position.y = -0.45;

const handGeo = new THREE.SphereGeometry(0.12, 12, 10);
const handLeft = new THREE.Mesh(handGeo, darkMat);
const handRight = new THREE.Mesh(handGeo, darkMat);
handLeft.position.y = -1.08;
handRight.position.y = -1.08;

armLeftGroup.add(armLeft, handLeft);
armRightGroup.add(armRight, handRight);

const legGeo = new THREE.CapsuleGeometry(0.18, 0.55, 6, 12);

const legLeftGroup = new THREE.Group();
legLeftGroup.name = "legLeft";
legLeftGroup.position.set(-0.24, 0.3, 0);

const legRightGroup = new THREE.Group();
legRightGroup.name = "legRight";
legRightGroup.position.set(0.24, 0.3, 0);

const legLeft = new THREE.Mesh(legGeo, shellMat);
const legRight = new THREE.Mesh(legGeo, shellMat);
legLeft.position.y = -0.35;
legRight.position.y = -0.35;


const footGeo = new THREE.BoxGeometry(0.36, 0.1, 0.56);
const footLeft = new THREE.Mesh(footGeo, darkMat);
const footRight = new THREE.Mesh(footGeo, darkMat);
footLeft.position.set(0, -0.7, 0.14);
footRight.position.set(0, -0.7, 0.14);

legLeftGroup.add(legLeft, footLeft);
legRightGroup.add(legRight,  footRight);

bodyGroup.position.y = bodyBaseY;
bodyGroup.add(torso);

headGroup.position.y = headBaseY;
headGroup.add(head, hornLeft, hornRight, hornTipLeft, hornTipRight, eyeLeft, eyeRight);

handGroup.position.y = bodyBaseY;
handGroup.scale.y = torso.scale.y;
handGroup.add(armLeftGroup, armRightGroup);

feetGroup.add(legLeftGroup, legRightGroup);

root.add(headGroup, bodyGroup, handGroup, feetGroup);

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
