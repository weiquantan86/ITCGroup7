import * as THREE from "three";
import type { SceneSetupResult } from "../general/sceneTypes";

type BoxCollider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const createMochiStreetScene = (scene: THREE.Scene): SceneSetupResult => {
  scene.background = new THREE.Color(0x0b1020);
  scene.fog = new THREE.Fog(0x0b1020, 24, 95);

  const groundY = -1.4;
  const streetSize = { width: 74, depth: 98 };
  const bounds = {
    minX: -streetSize.width / 2 + 2,
    maxX: streetSize.width / 2 - 2,
    minZ: -streetSize.depth / 2 + 2,
    maxZ: streetSize.depth / 2 - 2,
  };

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const buildingColliders: BoxCollider[] = [];
  const mochiStreetGroup = new THREE.Group();
  scene.add(mochiStreetGroup);

  const trackMesh = (mesh: THREE.Mesh) => {
    geometries.add(mesh.geometry);
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => materials.add(material));
    } else {
      materials.add(mesh.material);
    }
  };

  const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.92,
    metalness: 0.08,
  });
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(streetSize.width, streetSize.depth),
    roadMaterial
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = groundY;
  road.receiveShadow = true;
  mochiStreetGroup.add(road);
  trackMesh(road);

  const laneMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.38,
    metalness: 0.28,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.08,
  });
  for (let z = bounds.minZ + 8; z <= bounds.maxZ - 8; z += 7.5) {
    const laneDash = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.05, 3.6),
      laneMaterial
    );
    laneDash.position.set(0, groundY + 0.03, z);
    laneDash.castShadow = true;
    laneDash.receiveShadow = true;
    mochiStreetGroup.add(laneDash);
    trackMesh(laneDash);
  }

  const sideLineMaterial = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.55,
    metalness: 0.2,
  });
  [-8.5, 8.5].forEach((x) => {
    const sideLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.05, streetSize.depth - 9),
      sideLineMaterial
    );
    sideLine.position.set(x, groundY + 0.03, 0);
    sideLine.castShadow = true;
    sideLine.receiveShadow = true;
    mochiStreetGroup.add(sideLine);
    trackMesh(sideLine);
  });

  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.86,
    metalness: 0.14,
  });
  [-15.5, 15.5].forEach((x) => {
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(11.2, 0.22, streetSize.depth - 6),
      sidewalkMaterial
    );
    sidewalk.position.set(x, groundY + 0.11, 0);
    sidewalk.castShadow = true;
    sidewalk.receiveShadow = true;
    mochiStreetGroup.add(sidewalk);
    trackMesh(sidewalk);
  });

  const buildingBaseMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.18,
  });
  const buildingAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.3,
    emissive: 0x6366f1,
    emissiveIntensity: 0.18,
  });
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    roughness: 0.2,
    metalness: 0.42,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.3,
  });

  const createBuilding = (x: number, z: number, width: number, height: number, depth: number) => {
    const root = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      buildingBaseMaterial
    );
    base.position.y = groundY + height / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);
    trackMesh(base);

    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.96, 0.25, depth * 0.96),
      buildingAccentMaterial
    );
    accent.position.y = groundY + height + 0.12;
    accent.castShadow = true;
    accent.receiveShadow = true;
    root.add(accent);
    trackMesh(accent);

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const windowMesh = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.22, 0.9, 0.08),
          windowMaterial
        );
        windowMesh.position.set(
          (col === 0 ? -1 : 1) * width * 0.22,
          groundY + 1.4 + row * 1.2,
          depth / 2 + 0.02
        );
        windowMesh.castShadow = true;
        windowMesh.receiveShadow = true;
        root.add(windowMesh);
        trackMesh(windowMesh);
      }
    }

    root.position.set(x, 0, z);
    mochiStreetGroup.add(root);

    buildingColliders.push({
      minX: x - width / 2 - 0.4,
      maxX: x + width / 2 + 0.4,
      minZ: z - depth / 2 - 0.4,
      maxZ: z + depth / 2 + 0.4,
    });
  };

  for (let i = 0; i < 7; i += 1) {
    const z = bounds.minZ + 10 + i * 12;
    const leftHeight = 5 + (i % 3) * 1.4;
    const rightHeight = 5.8 + ((i + 1) % 3) * 1.2;
    createBuilding(-24.5, z, 7.2, leftHeight, 8.5);
    createBuilding(24.5, z, 7.8, rightHeight, 8.8);
  }

  const lampPoleMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.4,
    metalness: 0.42,
  });
  const lampHeadMaterial = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.18,
    metalness: 0.15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.35,
  });
  for (let i = 0; i < 8; i += 1) {
    const z = bounds.minZ + 8 + i * 11.8;
    [-11.3, 11.3].forEach((x) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.16, 4.4, 12),
        lampPoleMaterial
      );
      pole.position.set(x, groundY + 2.2, z);
      pole.castShadow = true;
      pole.receiveShadow = true;
      mochiStreetGroup.add(pole);
      trackMesh(pole);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 12, 12),
        lampHeadMaterial
      );
      head.position.set(x, groundY + 4.5, z);
      head.castShadow = true;
      head.receiveShadow = true;
      mochiStreetGroup.add(head);
      trackMesh(head);
    });
  }

  const world = {
    sceneId: "mochiStreet",
    groundY,
    bounds,
    projectileColliders: [mochiStreetGroup] as THREE.Object3D[],
    isBlocked: (x: number, z: number) => {
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
        return true;
      }
      for (let i = 0; i < buildingColliders.length; i += 1) {
        const collider = buildingColliders[i];
        if (
          x >= collider.minX &&
          x <= collider.maxX &&
          z >= collider.minZ &&
          z <= collider.maxZ
        ) {
          return true;
        }
      }
      return false;
    },
  };

  const dispose = () => {
    scene.remove(mochiStreetGroup);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  };

  return { world, dispose };
};
