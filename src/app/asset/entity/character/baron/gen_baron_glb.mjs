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
          if (this.onload) this.onload({ target: this });
          if (this.onloadend) this.onloadend({ target: this });
        })
        .catch((err) => {
          if (this.onerror) this.onerror(err);
          if (this.onloadend) this.onloadend({ target: this });
        });
    }
    readAsDataURL(blob) {
      blob
        .arrayBuffer()
        .then((buffer) => {
          const base64 = Buffer.from(buffer).toString("base64");
          const type = blob.type || "application/octet-stream";
          this.result = `data:${type};base64,${base64}`;
          if (this.onload) this.onload({ target: this });
          if (this.onloadend) this.onloadend({ target: this });
        })
        .catch((err) => {
          if (this.onerror) this.onerror(err);
          if (this.onloadend) this.onloadend({ target: this });
        });
    }
  };
}

const outPath = "public/assets/characters/baron/baron.glb";
mkdirSync(dirname(outPath), { recursive: true });

const scene = new THREE.Scene();

const clothPrimary = new THREE.MeshStandardMaterial({
  color: 0x0f172a,
  roughness: 0.82,
  metalness: 0.05,
});
const clothSecondary = new THREE.MeshStandardMaterial({
  color: 0x1f2937,
  roughness: 0.74,
  metalness: 0.06,
});
const clothTrim = new THREE.MeshStandardMaterial({
  color: 0x111827,
  roughness: 0.78,
  metalness: 0.04,
});
const steelMat = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  roughness: 0.35,
  metalness: 0.62,
});
const accentMat = new THREE.MeshStandardMaterial({
  color: 0xdc2626,
  roughness: 0.45,
  metalness: 0.12,
});
const faceLineMat = new THREE.MeshBasicMaterial({
  color: 0xe5e7eb,
});
faceLineMat.depthTest = false;
faceLineMat.depthWrite = false;

const group = new THREE.Group();

const torso = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.12, 0.54), clothSecondary);
torso.name = "torso";
torso.position.y = 0.8;

const chestPlate = new THREE.Mesh(
  new THREE.BoxGeometry(0.66, 0.54, 0.08),
  clothPrimary
);
chestPlate.name = "chest";
chestPlate.position.set(0, 0.08, 0.31);
torso.add(chestPlate);

const waistBelt = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.045, 12, 38), accentMat);
waistBelt.position.y = -0.3;
waistBelt.rotation.x = Math.PI / 2;
torso.add(waistBelt);

const sashKnot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), accentMat);
sashKnot.position.set(0, -0.3, 0.31);
torso.add(sashKnot);

const sashTailLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.045), accentMat);
const sashTailRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.045), accentMat);
sashTailLeft.position.set(0.05, -0.53, 0.31);
sashTailRight.position.set(-0.05, -0.49, 0.31);
sashTailLeft.rotation.z = 0.14;
sashTailRight.rotation.z = -0.09;
torso.add(sashTailLeft, sashTailRight);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 22, 16), clothPrimary);
head.name = "head";
head.position.set(0, 1.74, 0);
head.scale.set(1, 1.03, 1);

const hood = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 18), clothTrim);
hood.position.set(0, 0.03, -0.11);
hood.scale.set(1, 1.08, 0.92);
head.add(hood);

const hoodTail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.1), clothTrim);
hoodTail.position.set(0, -0.27, -0.3);
hoodTail.rotation.x = 0.3;
head.add(hoodTail);

const faceRig = new THREE.Group();
faceRig.position.set(0, -0.03, 0.3);
head.add(faceRig);

const facePlate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.06), clothPrimary);
faceRig.add(facePlate);

const browGeo = new THREE.PlaneGeometry(0.28, 0.03);
const browLeft = new THREE.Mesh(browGeo, faceLineMat);
const browRight = new THREE.Mesh(browGeo, faceLineMat);
browLeft.name = "eyeLeft";
browRight.name = "eyeRight";
browLeft.position.set(-0.12, 0.04, 0.036);
browRight.position.set(0.12, 0.04, 0.036);
browLeft.rotation.z = -0.42;
browRight.rotation.z = 0.42;
browLeft.renderOrder = 20;
browRight.renderOrder = 20;
faceRig.add(browLeft, browRight);

const shoulderLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.3), clothPrimary);
const shoulderRight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.3), clothPrimary);
shoulderLeft.position.set(-0.46, 1.04, 0.02);
shoulderRight.position.set(0.46, 1.04, 0.02);
shoulderLeft.rotation.z = 0.24;
shoulderRight.rotation.z = -0.24;

const armGeo = new THREE.CapsuleGeometry(0.11, 0.72, 6, 12);
const armLeftGroup = new THREE.Group();
const armRightGroup = new THREE.Group();
armLeftGroup.name = "armLeft";
armRightGroup.name = "armRight";
armLeftGroup.position.set(-0.56, 0.52, 0);
armRightGroup.position.set(0.56, 0.52, 0);
armLeftGroup.rotation.z = 0.08;
armRightGroup.rotation.z = -0.08;

const armLeft = new THREE.Mesh(armGeo, clothSecondary);
const armRight = new THREE.Mesh(armGeo, clothSecondary);
armLeft.position.y = -0.48;
armRight.position.y = -0.48;

const forearmLeft = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.28, 0.17), steelMat);
const forearmRight = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.28, 0.17), steelMat);
forearmLeft.position.y = -0.87;
forearmRight.position.y = -0.87;

const handLeft = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), clothPrimary);
const handRight = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), clothPrimary);
handLeft.position.y = -1.12;
handRight.position.y = -1.12;

armLeftGroup.add(armLeft, forearmLeft, handLeft);
armRightGroup.add(armRight, forearmRight, handRight);

const legGeo = new THREE.CapsuleGeometry(0.17, 0.6, 6, 12);
const legLeftGroup = new THREE.Group();
const legRightGroup = new THREE.Group();
legLeftGroup.name = "legLeft";
legRightGroup.name = "legRight";
legLeftGroup.position.set(-0.22, 0.28, 0);
legRightGroup.position.set(0.22, 0.28, 0);

const legLeft = new THREE.Mesh(legGeo, clothSecondary);
const legRight = new THREE.Mesh(legGeo, clothSecondary);
legLeft.position.y = -0.38;
legRight.position.y = -0.38;

const shinGuardLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.18), steelMat);
const shinGuardRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.18), steelMat);
shinGuardLeft.position.y = -0.61;
shinGuardRight.position.y = -0.61;

const footGeo = new THREE.BoxGeometry(0.34, 0.16, 0.58);
const footLeft = new THREE.Mesh(footGeo, clothPrimary);
const footRight = new THREE.Mesh(footGeo, clothPrimary);
footLeft.position.set(0, -0.8, 0.15);
footRight.position.set(0, -0.8, 0.15);

legLeftGroup.add(legLeft, shinGuardLeft, footLeft);
legRightGroup.add(legRight, shinGuardRight, footRight);

const swordRig = new THREE.Group();
swordRig.position.set(0.29, 0.16, -0.28);
swordRig.rotation.z = 0.58;
swordRig.rotation.x = 0.2;
const swordScabbard = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.055, 1.42, 12),
  clothTrim
);
const swordHandle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10),
  clothPrimary
);
swordHandle.position.set(0, 0.86, -0.08);
const swordGuard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.08), steelMat);
swordGuard.position.set(0, 0.73, -0.05);
swordRig.add(swordScabbard, swordHandle, swordGuard);
torso.add(swordRig);

group.add(
  torso,
  head,
  shoulderLeft,
  shoulderRight,
  legLeftGroup,
  legRightGroup
);
torso.add(armLeftGroup, armRightGroup);
scene.add(group);

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (result) => {
    if (result instanceof ArrayBuffer) {
      writeFileSync(outPath, Buffer.from(result));
      console.log(`Wrote ${outPath}`);
    } else {
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
    }
  },
  { binary: true }
);
