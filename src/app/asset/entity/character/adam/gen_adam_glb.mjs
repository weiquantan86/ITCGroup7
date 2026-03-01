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

const outPath = "public/assets/characters/adam/adam.glb";
mkdirSync(dirname(outPath), { recursive: true });

const scene = new THREE.Scene();

const botGreen = new THREE.MeshStandardMaterial({ color: 0xa3daf2, roughness: 0.55, metalness: 0.05 });
const botDark = new THREE.MeshStandardMaterial({ color: 0x4c7285, roughness: 0.7, metalness: 0.05 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.4, metalness: 0.0 });

const group = new THREE.Group();

const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 1.35, 6), botGreen);
torso.position.y = 0.9;
torso.scale.y = 0.9;

const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 18), botGreen);
head.position.y = 1.7;
const headSeamBand = new THREE.Mesh(
  new THREE.CylinderGeometry(0.455, 0.455, 0.05, 24, 1, true),
  botDark
);
headSeamBand.position.y = 0.03;
const headSeamClampFront = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.04), botDark);
const headSeamClampBack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.04), botDark);
headSeamClampFront.position.set(0, 0.03, 0.43);
headSeamClampBack.position.set(0, 0.03, -0.43);
head.add(headSeamBand, headSeamClampFront, headSeamClampBack);

const antennaLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.45, 8), botDark);
const antennaRight = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.45, 8), botDark);
antennaLeft.position.set(-0.18, 2.2, 0);
antennaRight.position.set(0.18, 2.2, 0);
antennaLeft.rotation.z = Math.PI / 8;
antennaRight.rotation.z = -Math.PI / 8;
const antennaTipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), botDark);
const antennaTipRight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), botDark);
antennaTipLeft.position.set(-0.27, 2.42, 0);
antennaTipRight.position.set(0.27, 2.42, 0);
antennaTipLeft.rotation.set(0, 0, 0.45);
antennaTipRight.rotation.set(0, 0, -0.45);

const eyeGeo = new THREE.SphereGeometry(0.11, 35, 28);
const eyeLeft = new THREE.Mesh(eyeGeo, eyeMat);
const eyeRight = new THREE.Mesh(eyeGeo, eyeMat);
eyeLeft.position.set(-0.17, 1.75, 0.33);
eyeRight.position.set(0.17, 1.75, 0.33);
eyeLeft.rotation.set(0, 0, -0.3);
eyeRight.rotation.set(0, 0, 0.3);
eyeLeft.scale.set(1.0, 1, 1);
eyeRight.scale.set(1.0, 1, 1);

const armGeo = new THREE.CapsuleGeometry(0.14, 0.65, 6, 12);
const armLeftGroup = new THREE.Group();
const armRightGroup = new THREE.Group();
armLeftGroup.name = "armLeft";
armRightGroup.name = "armRight";
armLeftGroup.position.set(-0.55, 0.58, 0);
armRightGroup.position.set(0.55, 0.58, 0);
armLeftGroup.rotation.z = Math.PI / 48;
armRightGroup.rotation.z = -Math.PI / 48;

const armLeft = new THREE.Mesh(armGeo, botGreen);
const armRight = new THREE.Mesh(armGeo, botGreen);
armLeft.position.y = -0.45;
armRight.position.y = -0.45;

const handGeo = new THREE.SphereGeometry(0.12, 12, 10);
const handLeft = new THREE.Mesh(handGeo, botDark);
const handRight = new THREE.Mesh(handGeo, botDark);
handLeft.position.y = -1.08;
handRight.position.y = -1.08;

armLeftGroup.add(armLeft, handLeft);
armRightGroup.add(armRight, handRight);

const legGeo = new THREE.CapsuleGeometry(0.18, 0.55, 6, 12);
const legLeftGroup = new THREE.Group();
const legRightGroup = new THREE.Group();
legLeftGroup.name = "legLeft";
legRightGroup.name = "legRight";
legLeftGroup.position.set(-0.24, 0.3, 0);
legRightGroup.position.set(0.24, 0.3, 0);

const legLeft = new THREE.Mesh(legGeo, botGreen);
const legRight = new THREE.Mesh(legGeo, botGreen);
legLeft.position.y = -0.35;
legRight.position.y = -0.35;

const footGeo = new THREE.BoxGeometry(0.36, 0.16, 0.54);
const footLeft = new THREE.Mesh(footGeo, botDark);
const footRight = new THREE.Mesh(footGeo, botDark);
footLeft.position.set(0, -0.7, 0.12);
footRight.position.set(0, -0.7, 0.12);

legLeftGroup.add(legLeft, footLeft);
legRightGroup.add(legRight, footRight);

[group, torso, head, antennaLeft, antennaRight, antennaTipLeft, antennaTipRight, eyeLeft, eyeRight, legLeftGroup, legRightGroup].forEach((m) => {
  if (m !== group) group.add(m);
});
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
