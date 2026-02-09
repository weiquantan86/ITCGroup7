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

const botBlue = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.55, metalness: 0.08 });
const botDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.05 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.0 });

const group = new THREE.Group();

const torsoGeo = new THREE.ConeGeometry(0.62, 1.5, 18);
torsoGeo.rotateX(Math.PI);
const torso = new THREE.Mesh(torsoGeo, botBlue);
torso.position.y = 0.75;
torso.scale.set(0.7, 0.9, 0.7);

const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 24), botBlue);
head.position.y = 1.72;

const antennaLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8), botDark);
const antennaRight = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8), botDark);
antennaLeft.position.set(-0.16, 2.06, 0);
antennaRight.position.set(0.16, 2.06, 0);
antennaLeft.rotation.z = Math.PI / 8;
antennaRight.rotation.z = -Math.PI / 8;
const antennaTipLeft = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 10), botDark);
const antennaTipRight = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 10), botDark);
antennaTipLeft.position.set(-0.27, 2.19, 0);
antennaTipRight.position.set(0.27, 2.19, 0);

const glassesMat = new THREE.MeshStandardMaterial({
  color: 0x0b0f1a,
  roughness: 0.2,
  metalness: 0.6,
});
const glassesGroup = new THREE.Group();
const lensGeo = new THREE.BoxGeometry(0.22, 0.11, 0.06);
const bridgeGeo = new THREE.BoxGeometry(0.05, 0.025, 0.04);
const lensLeft = new THREE.Mesh(lensGeo, glassesMat);
const lensRight = new THREE.Mesh(lensGeo, glassesMat);
const bridge = new THREE.Mesh(bridgeGeo, glassesMat);
lensLeft.position.set(-0.18, 0, 0);
lensRight.position.set(0.18, 0, 0);
bridge.position.set(0, 0, 0);
glassesGroup.add(lensLeft, lensRight, bridge);
glassesGroup.position.set(0, 0.03, 0.2);
glassesGroup.rotation.x = -0.55;
head.add(glassesGroup);

const armGeo = new THREE.CapsuleGeometry(0.12, 0.75, 6, 12);
const handGeo = new THREE.ConeGeometry(0.12, 0.24, 12);
handGeo.rotateX(Math.PI);
const armCount = 2;
const armRadius = 0.7;
const armHeight = 0.75;
const arms = [];

for (let i = 0; i < armCount; i += 1) {
  const armGroup = new THREE.Group();
  const name = i === 0 ? "armLeft" : i === 1 ? "armRight" : `armExtra_${i}`;
  armGroup.name = name;
  const angle = (i / armCount) * Math.PI * 2;
  const x = Math.cos(angle) * armRadius;
  const z = Math.sin(angle) * armRadius;
  armGroup.position.set(x, armHeight, z);
  armGroup.rotation.y = angle + Math.PI / 2;
  armGroup.rotation.z = Math.sin(angle) * 0.18;

  const arm = new THREE.Mesh(armGeo, botBlue);
  arm.position.y = -0.5;
  const hand = new THREE.Mesh(handGeo, botDark);
  hand.position.y = -1.25;
  armGroup.add(arm, hand);
  arms.push(armGroup);
}

const legGeo = new THREE.CapsuleGeometry(0.18, 0.55, 6, 12);
const legLeftGroup = new THREE.Group();
const legRightGroup = new THREE.Group();
legLeftGroup.name = "legLeft";
legRightGroup.name = "legRight";
legLeftGroup.position.set(-0.24, 0.2, 0);
legRightGroup.position.set(0.24, 0.2, 0);

const legLeft = new THREE.Mesh(legGeo, botBlue);
const legRight = new THREE.Mesh(legGeo, botBlue);
legLeft.position.y = -0.35;
legRight.position.y = -0.35;

const footGeo = new THREE.BoxGeometry(0.36, 0.16, 0.54);
const footLeft = new THREE.Mesh(footGeo, botDark);
const footRight = new THREE.Mesh(footGeo, botDark);
footLeft.position.set(0, -0.7, 0.12);
footRight.position.set(0, -0.7, 0.12);

legLeftGroup.add(legLeft, footLeft);
legRightGroup.add(legRight, footRight);

[group, torso, head, antennaLeft, antennaRight, antennaTipLeft, antennaTipRight, legLeftGroup, legRightGroup].forEach((m) => {
  if (m !== group) group.add(m);
});
torso.add(...arms);
scene.add(group);

scene.updateMatrixWorld(true);
const dumpTmpVec3 = new THREE.Vector3();
const dumpTmpQuat = new THREE.Quaternion();
const dump = (node) => {
  node.updateMatrixWorld(true);
  const det = node.matrixWorld.determinant();
  console.log(
    node.name || node.type,
    "det=",
    det.toFixed(3),
    "pos=",
    node.getWorldPosition(dumpTmpVec3).toArray().map((n) => n.toFixed(2)).join(","),
    "rot=",
    node.getWorldQuaternion(dumpTmpQuat).toArray().map((n) => n.toFixed(2)).join(","),
    "scale=",
    node.getWorldScale(dumpTmpVec3).toArray().map((n) => n.toFixed(2)).join(",")
  );
};

dump(group);
dump(torso);

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
