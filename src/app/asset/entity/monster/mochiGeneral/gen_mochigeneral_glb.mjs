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

const outPath = "public/assets/monsters/mochiGeneral/mochiGeneral.glb";
mkdirSync(dirname(outPath), { recursive: true });

const scene = new THREE.Scene();

const whiteMat = new THREE.MeshStandardMaterial({
  color: 0xf8f8f6,
  roughness: 0.74,
  metalness: 0.04,
});

const blackMat = new THREE.MeshStandardMaterial({
  color: 0x101217,
  roughness: 0.66,
  metalness: 0.16,
});

const goldMat = new THREE.MeshStandardMaterial({
  color: 0xd4af37,
  roughness: 0.3,
  metalness: 0.86,
  emissive: 0x3d2d08,
  emissiveIntensity: 0.2,
});

const steelMat = new THREE.MeshStandardMaterial({
  color: 0xd9e1ea,
  roughness: 0.24,
  metalness: 0.9,
  emissive: 0x667d95,
  emissiveIntensity: 0.08,
});

const mochiMat = new THREE.MeshStandardMaterial({
  color: 0xfffbef,
  roughness: 0.84,
  metalness: 0.03,
});

const detailBlackMat = new THREE.MeshStandardMaterial({
  color: 0x15171d,
  roughness: 0.78,
  metalness: 0.08,
});

const root = new THREE.Group();
root.name = "mochiGeneralRoot";

const body = new THREE.Mesh(new THREE.SphereGeometry(1.15, 44, 34), whiteMat);
body.name = "body";
body.scale.set(1., 1.4, 1.0);
body.position.set(0, 1.8, 0);
root.add(body);

const armorBottomRim = new THREE.Mesh(
  new THREE.TorusGeometry(1.13, 0.065, 12, 44),
  goldMat
);
armorBottomRim.name = "armorBottomRim";
armorBottomRim.position.set(0, 0.86, 0);
armorBottomRim.rotation.x = Math.PI / 2;
root.add(armorBottomRim);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 34, 26), whiteMat);
head.name = "head";
head.position.set(0, 3.2, 0.02);
root.add(head);

const crest = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.32, 8), goldMat);
crest.name = "crest";
crest.position.set(0, 4, 0.02);
root.add(crest);

const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), detailBlackMat);
eyeL.name = "eyeL";
eyeL.position.set(-0.28, 3.45, 0.65);
eyeL.rotation.set(-0.2, -0.3, -0.5);
eyeL.scale.set(2, 1, 0.5);
root.add(eyeL);

const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), detailBlackMat);
eyeR.name = "eyeR";
eyeR.position.set(0.28, 3.45, 0.65);
eyeR.rotation.set(-0.2, 0.3, 0.5);
eyeR.scale.set(2, 1,  0.5);
root.add(eyeR);

const cape = new THREE.Mesh(
  new THREE.CylinderGeometry(1.2, 0.95, 0.8, 26, 1, true),
  blackMat
);
cape.name = "cape";
cape.position.set(0, 1.1, 0);
cape.rotation.y = Math.PI;
root.add(cape);

const legLeft = new THREE.Group();
legLeft.name = "legLeft";
legLeft.position.set(-0.62, 0.24, 0.02);
const shinLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.28, 4, 8), whiteMat);
shinLeft.name = "shinLeft";
shinLeft.position.set(0, 0.25, 0);
legLeft.add(shinLeft);
const footLeft = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.92), blackMat);
footLeft.name = "footLeft";
footLeft.position.set(0, -0.02, 0.06);
legLeft.add(footLeft);
root.add(legLeft);

const legRight = new THREE.Group();
legRight.name = "legRight";
legRight.position.set(0.62, 0.24, 0.02);
const shinRight = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.28, 4, 8), whiteMat);
shinRight.name = "shinRight";
shinRight.position.set(0, 0.25, 0);
legRight.add(shinRight);
const footRight = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 0.34, 0.92),
  blackMat
);
footRight.name = "footRight";
footRight.position.set(0, -0.02, 0.06);
legRight.add(footRight);
root.add(legRight);

const armLeft = new THREE.Group();
armLeft.name = "armLeft";
armLeft.position.set(-1.5, 2.0, 0.12);
const leftUpperArm = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.22, 0.6, 4, 10),
  whiteMat
);
leftUpperArm.name = "leftUpperArm";
leftUpperArm.rotation.set(0, 0, -0.5);
armLeft.add(leftUpperArm);
const leftForeArm = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.18, 0.35, 4, 10),
  blackMat
);
leftForeArm.name = "leftForeArm";
leftForeArm.position.set(-0.35, -0.6, 0.05);
leftForeArm.rotation.set(0, 0, 0.9);
armLeft.add(leftForeArm);
const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), whiteMat);
leftHand.name = "leftHand";
leftHand.position.set(-0.5, -0.9, 0.07);
armLeft.add(leftHand);
root.add(armLeft);

const armRight = new THREE.Group();
armRight.name = "armRight";
armRight.position.set(1.5, 2, 0.12);
const rightUpperArm = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.22, 0.6, 4, 10),
  whiteMat
);
rightUpperArm.name = "rightUpperArm";
rightUpperArm.rotation.set(0, 0, 0.5);
armRight.add(rightUpperArm);
const rightForeArm = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.18, 0.35, 4, 10),
  blackMat
);
rightForeArm.name = "rightForeArm";
rightForeArm.position.set(0.35, -0.6, 0.05);
rightForeArm.rotation.set(0, 0, -0.9);
armRight.add(rightForeArm);
const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), whiteMat);
rightHand.name = "rightHand";
rightHand.position.set(0.5, -0.9, 0.07);
armRight.add(rightHand);
root.add(armRight);

const leftPauldron = new THREE.Mesh(
  new THREE.SphereGeometry(0.4, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  goldMat
);
leftPauldron.name = "leftPauldron";
leftPauldron.position.set(-0.99, 2.5, 0.08);
leftPauldron.rotation.set(0, 0, -0.1);
root.add(leftPauldron);

const rightPauldron = new THREE.Mesh(
  new THREE.SphereGeometry(0.4, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  goldMat
);
rightPauldron.name = "rightPauldron";
rightPauldron.position.set(0.99, 2.5, 0.08);
leftPauldron.rotation.set(0, 0, 0.1);
root.add(rightPauldron);

const sword = new THREE.Group();
sword.name = "generalSword";
sword.position.set(-0.5, -0.95, 0.1);
sword.rotation.set(5, 0, -1.0);
armLeft.add(sword);

const swordGrip = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.06, 0.52, 14),
  blackMat
);
swordGrip.name = "swordGrip";
swordGrip.rotation.z = Math.PI / 2;
sword.add(swordGrip);

const swordGuard = new THREE.Mesh(
  new THREE.BoxGeometry(0.11, 0.34, 0.14),
  goldMat
);
swordGuard.name = "swordGuard";
swordGuard.position.set(0.28, 0, 0);
sword.add(swordGuard);

const swordBlade = new THREE.Mesh(
  new THREE.BoxGeometry(1.22, 0.13, 0.2),
  steelMat
);
swordBlade.name = "swordBlade";
swordBlade.position.set(1.03, 0, 0);
sword.add(swordBlade);

const swordTip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), steelMat);
swordTip.name = "swordTip";
swordTip.position.set(1.79, 0, 0);
swordTip.rotation.z = -Math.PI / 2;
sword.add(swordTip);

const swordPommel = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), goldMat);
swordPommel.name = "swordPommel";
swordPommel.position.set(-0.32, 0, 0);
sword.add(swordPommel);

const mochi = new THREE.Group();
mochi.name = "heldMochi";
mochi.position.set(0.5, -1.3, 0.1);
mochi.rotation.set(0, 0, 0);
armRight.add(mochi);

const mochiCore = new THREE.Mesh(new THREE.SphereGeometry(0.35, 28, 20), mochiMat);
mochiCore.name = "mochiCore";
mochi.add(mochiCore);

const mochiWrap = new THREE.Mesh(
  new THREE.TorusGeometry(0.35, 0.05, 10, 20),
  goldMat
);
mochiWrap.name = "mochiWrap";
mochiWrap.position.set(0, -0.15, 0);
mochiWrap.rotation.x = Math.PI / 2;
mochi.add(mochiWrap);

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
