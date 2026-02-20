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

const outPath = "public/assets/characters/dakota/dakota.glb";
mkdirSync(dirname(outPath), { recursive: true });

const scene = new THREE.Scene();

const primaryMat = new THREE.MeshStandardMaterial({
  color: 0x16a34a,
  roughness: 0.55,
  metalness: 0.08,
});
const darkMat = new THREE.MeshStandardMaterial({
  color: 0x14532d,
  roughness: 0.7,
  metalness: 0.05,
});
const accentMat = new THREE.MeshStandardMaterial({
  color: 0x0ea5e9,
  roughness: 0.35,
  metalness: 0.2,
});
const eyeMat = new THREE.MeshStandardMaterial({
  color: 0x0f172a,
  roughness: 0.4,
  metalness: 0.0,
});

const group = new THREE.Group();

const torso = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.36, 1.3, 6, 18),
  primaryMat
);
torso.position.y = 0.94;

const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 18), primaryMat);
head.name = "head";
head.position.y = 1.75;

const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), eyeMat);
const eyeRight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), eyeMat);
eyeLeft.position.set(-0.16, 0.02, 0.36);
eyeRight.position.set(0.16, 0.02, 0.36);
head.add(eyeLeft, eyeRight);

const faceGlasses = new THREE.Mesh(
  new THREE.BoxGeometry(0.44, 0.25, 0.1),
  accentMat
);
faceGlasses.name = "faceGlasses";
faceGlasses.position.set(0, 0.02, 0.45);
head.add(faceGlasses);

const headsetBase = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.2), darkMat);
headsetBase.name = "headsetBase";
headsetBase.position.set(-0.46, 0.00, 0.00);
headsetBase.rotation.y = Math.PI / 9;
head.add(headsetBase);

const headsetMic = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.32, 14), darkMat);
headsetMic.name = "headsetMic";
headsetMic.position.set(-0.5, 0.3, 0);
headsetMic.rotation.set(0, 0, 0);
head.add(headsetMic);

const armGeo = new THREE.CapsuleGeometry(0.14, 0.65, 6, 12);
const armLeftGroup = new THREE.Group();
const armRightGroup = new THREE.Group();
armLeftGroup.name = "armLeft";
armRightGroup.name = "armRight";
armLeftGroup.position.set(-0.48, 0.5, 0);
armRightGroup.position.set(0.48, 0.5, 0);
armLeftGroup.rotation.z = Math.PI / 36;
armRightGroup.rotation.z = -Math.PI / 36;

const armLeft = new THREE.Mesh(armGeo, primaryMat);
const armRight = new THREE.Mesh(armGeo, primaryMat);
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
const legRightGroup = new THREE.Group();
legLeftGroup.name = "legLeft";
legRightGroup.name = "legRight";
legLeftGroup.position.set(-0.2, 0.28, 0);
legRightGroup.position.set(0.2, 0.28, 0);

const legLeft = new THREE.Mesh(legGeo, primaryMat);
const legRight = new THREE.Mesh(legGeo, primaryMat);
legLeft.position.y = -0.35;
legRight.position.y = -0.35;

const footGeo = new THREE.BoxGeometry(0.36, 0.16, 0.54);
const footLeft = new THREE.Mesh(footGeo, darkMat);
const footRight = new THREE.Mesh(footGeo, darkMat);
footLeft.position.set(0, -0.7, 0.12);
footRight.position.set(0, -0.7, 0.12);

legLeftGroup.add(legLeft, footLeft);
legRightGroup.add(legRight, footRight);

const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.74, 0.24), darkMat);
backpack.name = "backpack";
backpack.position.set(0, 0.02, -0.35);
torso.add(backpack);

const backpackPocket = new THREE.Mesh(
  new THREE.BoxGeometry(0.42, 0.24, 0.1),
  accentMat
);
backpackPocket.name = "backpackPocket";
backpackPocket.position.set(0, -0.12, -0.5);
torso.add(backpackPocket);

const gunGroup = new THREE.Group();
gunGroup.position.set(0.01, -0.01, 0.13);
gunGroup.rotation.set(Math.PI / 2, 0, 0);

const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.44), darkMat);
gunBody.position.set(0, 0.02, 0.2);
gunGroup.add(gunBody);

const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 14), eyeMat);
gunBarrel.rotation.x = Math.PI / 2;
gunBarrel.position.set(0, 0.02, 0.48);
gunGroup.add(gunBarrel);

const gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.12), primaryMat);
gunGrip.position.set(0, 0, 0.02);
gunGroup.add(gunGrip);

const gunSight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.1), accentMat);
gunSight.position.set(0, 0.08, 0.24);
gunGroup.add(gunSight);

handRight.add(gunGroup);

group.add(torso, head, legLeftGroup, legRightGroup);
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
