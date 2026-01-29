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

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf4c7a4, roughness: 0.6, metalness: 0.05 });
const suitMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5, metalness: 0.1 });
const hairMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8, metalness: 0.0 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.0 });

const group = new THREE.Group();

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.0, 6, 16), suitMat);
torso.position.y = 0.9;

const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 18), bodyMat);
head.position.y = 1.7;

const hair = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
hair.position.y = 1.76;

const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), eyeMat);
const eyeRight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), eyeMat);
eyeLeft.position.set(-0.12, 1.7, 0.33);
eyeRight.position.set(0.12, 1.7, 0.33);

const armGeo = new THREE.CapsuleGeometry(0.12, 0.7, 4, 10);
const armLeft = new THREE.Mesh(armGeo, suitMat);
const armRight = new THREE.Mesh(armGeo, suitMat);
armLeft.position.set(-0.55, 1.05, 0);
armLeft.rotation.z = Math.PI / 12;
armRight.position.set(0.55, 1.05, 0);
armRight.rotation.z = -Math.PI / 12;

const legGeo = new THREE.CapsuleGeometry(0.14, 0.8, 4, 10);
const legLeft = new THREE.Mesh(legGeo, suitMat);
const legRight = new THREE.Mesh(legGeo, suitMat);
legLeft.position.set(-0.2, 0.1, 0);
legRight.position.set(0.2, 0.1, 0);

const shoeGeo = new THREE.BoxGeometry(0.25, 0.14, 0.4);
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8, metalness: 0.0 });
const shoeLeft = new THREE.Mesh(shoeGeo, shoeMat);
const shoeRight = new THREE.Mesh(shoeGeo, shoeMat);
shoeLeft.position.set(-0.2, -0.35, 0.08);
shoeRight.position.set(0.2, -0.35, 0.08);

[group, torso, head, hair, eyeLeft, eyeRight, armLeft, armRight, legLeft, legRight, shoeLeft, shoeRight].forEach((m) => {
  if (m !== group) group.add(m);
});
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
