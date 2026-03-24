import * as THREE from "three";
import { createSceneResourceTracker } from "../../general/resourceTracker";
import type { SceneSetupResult } from "../../general/sceneTypes";

type CircleCollider = {
  x: number;
  z: number;
  radius: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const seededRandom = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const isPositionBlockedByCollider = (
  x: number,
  z: number,
  radius: number,
  colliders: readonly CircleCollider[]
) => {
  for (let i = 0; i < colliders.length; i += 1) {
    const collider = colliders[i];
    const dx = x - collider.x;
    const dz = z - collider.z;
    const minDistance = collider.radius + radius;
    if (dx * dx + dz * dz < minDistance * minDistance) {
      return true;
    }
  }
  return false;
};

export const createForestScene = (scene: THREE.Scene): SceneSetupResult => {
  scene.background = new THREE.Color(0x071015);
  scene.fog = new THREE.Fog(0x071015, 26, 132);

  const groundY = -1.4;
  const forestSize = { width: 176, depth: 176 };
  const bounds = {
    minX: -forestSize.width / 2 + 3,
    maxX: forestSize.width / 2 - 3,
    minZ: -forestSize.depth / 2 + 3,
    maxZ: forestSize.depth / 2 - 3,
  };
  const safeSpawnRadius = 10;

  const resourceTracker = createSceneResourceTracker();
  const { trackMesh, disposeTrackedResources } = resourceTracker;
  const forestGroup = new THREE.Group();
  forestGroup.name = "chapterForestScene";
  scene.add(forestGroup);

  const colliders: CircleCollider[] = [];

  const addCircleCollider = (x: number, z: number, radius: number) => {
    colliders.push({ x, z, radius });
  };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(forestSize.width, forestSize.depth),
    new THREE.MeshStandardMaterial({
      color: 0x16261a,
      roughness: 0.97,
      metalness: 0.02,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = groundY;
  ground.receiveShadow = true;
  forestGroup.add(ground);
  trackMesh(ground);

  const mossRing = new THREE.Mesh(
    new THREE.RingGeometry(safeSpawnRadius + 1.6, safeSpawnRadius + 4.8, 72),
    new THREE.MeshStandardMaterial({
      color: 0x243d23,
      roughness: 0.93,
      metalness: 0.03,
      emissive: 0x0f1b10,
      emissiveIntensity: 0.25,
      side: THREE.DoubleSide,
    })
  );
  mossRing.rotation.x = -Math.PI / 2;
  mossRing.position.y = groundY + 0.015;
  mossRing.receiveShadow = true;
  forestGroup.add(mossRing);
  trackMesh(mossRing);

  const mossMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f3a1f,
    roughness: 0.96,
    metalness: 0.01,
  });
  for (let i = 0; i < 24; i += 1) {
    const scale = 1.8 + seededRandom(i + 4) * 3.4;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(scale, 28), mossMaterial);
    patch.rotation.x = -Math.PI / 2;
    const angle = seededRandom(i + 41) * Math.PI * 2;
    const radius = 18 + seededRandom(i + 91) * 58;
    patch.position.set(
      Math.cos(angle) * radius + (seededRandom(i + 141) - 0.5) * 6,
      groundY + 0.01,
      Math.sin(angle) * radius + (seededRandom(i + 181) - 0.5) * 6
    );
    patch.receiveShadow = true;
    forestGroup.add(patch);
    trackMesh(patch);
  }

  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a2e19,
    roughness: 0.95,
    metalness: 0.08,
  });
  const leafDarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c4a2b,
    roughness: 0.76,
    metalness: 0.08,
  });
  const leafBrightMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f6d3e,
    roughness: 0.72,
    metalness: 0.06,
    emissive: 0x0d1e11,
    emissiveIntensity: 0.2,
  });
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x49525a,
    roughness: 0.91,
    metalness: 0.12,
  });
  const logMaterial = new THREE.MeshStandardMaterial({
    color: 0x5f3b1f,
    roughness: 0.92,
    metalness: 0.06,
  });

  const tryPlace = (
    x: number,
    z: number,
    radius: number,
    shouldBlockSpawn = true
  ) => {
    if (
      x < bounds.minX + 1.6 ||
      x > bounds.maxX - 1.6 ||
      z < bounds.minZ + 1.6 ||
      z > bounds.maxZ - 1.6
    ) {
      return false;
    }
    if (shouldBlockSpawn) {
      const distSq = x * x + z * z;
      if (distSq < (safeSpawnRadius + radius + 1.6) ** 2) {
        return false;
      }
    }
    if (isPositionBlockedByCollider(x, z, radius + 0.4, colliders)) {
      return false;
    }
    return true;
  };

  const addTree = (x: number, z: number, scale: number) => {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);

    const trunkHeight = 2.8 * scale;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26 * scale, 0.34 * scale, trunkHeight, 10),
      trunkMaterial
    );
    trunk.position.y = groundY + trunkHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);
    trackMesh(trunk);

    const canopyBottom = new THREE.Mesh(
      new THREE.ConeGeometry(1.1 * scale, 2.6 * scale, 11),
      leafDarkMaterial
    );
    canopyBottom.position.y = groundY + trunkHeight + 0.8 * scale;
    canopyBottom.castShadow = true;
    canopyBottom.receiveShadow = true;
    tree.add(canopyBottom);
    trackMesh(canopyBottom);

    const canopyTop = new THREE.Mesh(
      new THREE.ConeGeometry(0.92 * scale, 2.1 * scale, 11),
      leafBrightMaterial
    );
    canopyTop.position.y = groundY + trunkHeight + 1.95 * scale;
    canopyTop.castShadow = true;
    canopyTop.receiveShadow = true;
    tree.add(canopyTop);
    trackMesh(canopyTop);

    forestGroup.add(tree);
    addCircleCollider(x, z, 0.9 * scale);
  };

  const addRock = (x: number, z: number, radius: number) => {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(radius, 0),
      rockMaterial
    );
    rock.position.set(x, groundY + radius * 0.62, z);
    rock.scale.set(
      1 + seededRandom(x * 0.17 + z * 0.31) * 0.3,
      0.65 + seededRandom(x * 0.37 + z * 0.11) * 0.35,
      1 + seededRandom(x * 0.29 + z * 0.21) * 0.35
    );
    rock.rotation.set(
      seededRandom(x * 0.67) * 0.4,
      seededRandom(z * 0.43) * Math.PI,
      seededRandom((x + z) * 0.51) * 0.4
    );
    rock.castShadow = true;
    rock.receiveShadow = true;
    forestGroup.add(rock);
    trackMesh(rock);
    addCircleCollider(x, z, radius * 1.08);
  };

  const addLog = (x: number, z: number, length: number, rotationY: number) => {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.44, length, 12),
      logMaterial
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rotationY;
    log.position.set(x, groundY + 0.32, z);
    log.castShadow = true;
    log.receiveShadow = true;
    forestGroup.add(log);
    trackMesh(log);
    addCircleCollider(x, z, clamp(length * 0.22, 1.2, 2.8));
  };

  for (let i = 0; i < 110; i += 1) {
    const angle = seededRandom(i + 12) * Math.PI * 2;
    const radius = 16 + seededRandom(i + 87) * 68;
    const x = Math.cos(angle) * radius + (seededRandom(i + 123) - 0.5) * 5;
    const z = Math.sin(angle) * radius + (seededRandom(i + 171) - 0.5) * 5;
    const treeScale = 0.95 + seededRandom(i + 231) * 0.8;
    if (!tryPlace(x, z, 1.05 * treeScale)) {
      continue;
    }
    addTree(x, z, treeScale);
  }

  for (let i = 0; i < 34; i += 1) {
    const angle = seededRandom(i + 301) * Math.PI * 2;
    const radius = 14 + seededRandom(i + 349) * 70;
    const x = Math.cos(angle) * radius + (seededRandom(i + 389) - 0.5) * 7;
    const z = Math.sin(angle) * radius + (seededRandom(i + 443) - 0.5) * 7;
    const rockRadius = 0.68 + seededRandom(i + 503) * 0.8;
    if (!tryPlace(x, z, rockRadius * 1.1)) {
      continue;
    }
    addRock(x, z, rockRadius);
  }

  for (let i = 0; i < 16; i += 1) {
    const angle = seededRandom(i + 601) * Math.PI * 2;
    const radius = 20 + seededRandom(i + 641) * 58;
    const x = Math.cos(angle) * radius + (seededRandom(i + 701) - 0.5) * 8;
    const z = Math.sin(angle) * radius + (seededRandom(i + 743) - 0.5) * 8;
    const length = 3.4 + seededRandom(i + 809) * 2.8;
    if (!tryPlace(x, z, Math.max(1.3, length * 0.23))) {
      continue;
    }
    addLog(x, z, length, seededRandom(i + 883) * Math.PI);
  }

  const fireflyMaterial = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    roughness: 0.2,
    metalness: 0.1,
    emissive: 0xeab308,
    emissiveIntensity: 0.7,
  });
  for (let i = 0; i < 18; i += 1) {
    const fly = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), fireflyMaterial);
    const x = (seededRandom(i + 911) - 0.5) * 58;
    const z = (seededRandom(i + 977) - 0.5) * 58;
    const y = groundY + 2.1 + seededRandom(i + 1033) * 1.7;
    fly.position.set(x, y, z);
    fly.castShadow = false;
    fly.receiveShadow = false;
    forestGroup.add(fly);
    trackMesh(fly);
  }

  const world = {
    sceneId: "forest",
    groundY,
    playerSpawn: new THREE.Vector3(0, groundY, 0),
    bounds,
    projectileColliders: [forestGroup] as THREE.Object3D[],
    isBlocked: (x: number, z: number) => {
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
        return true;
      }
      for (let i = 0; i < colliders.length; i += 1) {
        const collider = colliders[i];
        const dx = x - collider.x;
        const dz = z - collider.z;
        if (dx * dx + dz * dz < (collider.radius + 0.5) ** 2) {
          return true;
        }
      }
      return false;
    },
  };

  const dispose = () => {
    scene.remove(forestGroup);
    disposeTrackedResources();
  };

  return { world, dispose };
};
