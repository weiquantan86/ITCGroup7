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
const haloMat = new THREE.MeshStandardMaterial({
  color: 0xef4444,
  emissive: 0x7f1d1d,
  roughness: 0.28,
  metalness: 0.18,
});
const faceLineMat = new THREE.MeshBasicMaterial({
  color: 0xe5e7eb,
});

const group = new THREE.Group();

const torso = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.39, 0.9, 6, 16),
  clothSecondary
);
torso.name = "torso";
torso.position.y = 0.86;

const waistBelt = new THREE.Mesh(
  new THREE.TorusGeometry(0.42, 0.04, 12, 42),
  accentMat
);
waistBelt.position.y = -0.18;
waistBelt.rotation.x = Math.PI / 2;
torso.add(waistBelt);

const headRadius = 0.4;
const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 24, 18), clothPrimary);
head.name = "head";
head.position.set(0, 1.76, 0);

const headRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.34, 0.038, 12, 40),
  haloMat
);
headRing.name = "headRing";
headRing.position.set(0, 0.18, -0.05);
headRing.rotation.x = 1.2;
head.add(headRing);

const headRingKnot = new THREE.Group();
headRingKnot.name = "headRingKnot";
headRingKnot.position.set(0, -0.34, 0);

const knotCenter = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), haloMat);
knotCenter.scale.set(1.3, 0.9, 0.9);

const knotLoopLeft = new THREE.Mesh(new THREE.SphereGeometry(0.076, 12, 10), haloMat);
const knotLoopRight = new THREE.Mesh(new THREE.SphereGeometry(0.076, 12, 10), haloMat);
knotLoopLeft.scale.set(1.24, 0.72, 0.36);
knotLoopRight.scale.set(1.24, 0.72, 0.36);
knotLoopLeft.position.set(-0.088, 0.01, 0);
knotLoopRight.position.set(0.088, 0.01, 0);
knotLoopLeft.rotation.z = 0.34;
knotLoopRight.rotation.z = -0.34;

const knotTailLeft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.018), haloMat);
const knotTailRight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.018), haloMat);
knotTailLeft.position.set(-0.04, -0.1, 0);
knotTailRight.position.set(0.04, -0.1, 0);
knotTailLeft.rotation.z = 0.24;
knotTailRight.rotation.z = -0.24;

headRingKnot.add(
  knotCenter,
  knotLoopLeft,
  knotLoopRight,
  knotTailLeft,
  knotTailRight
);
headRing.add(headRingKnot);

const browGeo = new THREE.PlaneGeometry(0.21, 0.03);
const browLeft = new THREE.Mesh(browGeo, faceLineMat);
const browRight = new THREE.Mesh(browGeo, faceLineMat);
browLeft.name = "eyeLeft";
browRight.name = "eyeRight";

const placeEyeOnHead = (eye, x, y, tiltZ) => {
  const z = Math.sqrt(Math.max(headRadius * headRadius - x * x - y * y, 0));
  const normal = new THREE.Vector3(x, y, z).normalize();
  eye.position.copy(normal.multiplyScalar(headRadius + 0.016));
  eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  eye.rotateZ(tiltZ);
};

placeEyeOnHead(browLeft, -0.18, 0.055, -0.42);
placeEyeOnHead(browRight, 0.18, 0.055, 0.42);
browLeft.renderOrder = 20;
browRight.renderOrder = 20;
head.add(browLeft, browRight);

const armGeo = new THREE.CapsuleGeometry(0.11, 0.72, 6, 12);
const armLeftGroup = new THREE.Group();
const armRightGroup = new THREE.Group();
armLeftGroup.name = "armLeft";
armRightGroup.name = "armRight";
armLeftGroup.position.set(-0.53, 0.58, 0);
armRightGroup.position.set(0.53, 0.58, 0);
armLeftGroup.rotation.z = 0.08;
armRightGroup.rotation.z = -0.08;

const armLeft = new THREE.Mesh(armGeo, clothSecondary);
const armRight = new THREE.Mesh(armGeo, clothSecondary);
armLeft.position.y = -0.48;
armRight.position.y = -0.48;

const handLeft = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), clothPrimary);
const handRight = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), clothPrimary);
handLeft.position.y = -0.92;
handRight.position.y = -0.92;

armLeftGroup.add(armLeft, handLeft);
armRightGroup.add(armRight, handRight);

const legGeo = new THREE.CapsuleGeometry(0.17, 0.6, 6, 12);
const legLeftGroup = new THREE.Group();
const legRightGroup = new THREE.Group();
legLeftGroup.name = "legLeft";
legRightGroup.name = "legRight";
legLeftGroup.position.set(-0.21, 0.28, 0);
legRightGroup.position.set(0.21, 0.28, 0);

const legLeft = new THREE.Mesh(legGeo, clothSecondary);
const legRight = new THREE.Mesh(legGeo, clothSecondary);
legLeft.position.y = -0.38;
legRight.position.y = -0.38;

const footGeo = new THREE.BoxGeometry(0.34, 0.16, 0.58);
const footLeft = new THREE.Mesh(footGeo, clothPrimary);
const footRight = new THREE.Mesh(footGeo, clothPrimary);
footLeft.position.set(0, -0.8, 0.15);
footRight.position.set(0, -0.8, 0.15);

legLeftGroup.add(legLeft, footLeft);
legRightGroup.add(legRight, footRight);

const swordRig = new THREE.Group();
swordRig.position.set(-0.15, 0.06, -0.44);
swordRig.rotation.z = 0.35;
swordRig.rotation.x = 0.24;
const swordScabbard = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.055, 1.42, 12),
  clothTrim
);
const swordHandle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10),
  clothPrimary
);
swordHandle.position.set(0, 0.86, 0);
const swordGuard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.08), steelMat);
swordGuard.position.set(0, 0.73, 0);
swordRig.add(swordScabbard, swordHandle, swordGuard);
torso.add(swordRig);

group.add(
  torso,
  head,
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
