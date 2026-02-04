import * as THREE from "three";
import type { PlayerWorld } from "../asset/character/player";

export interface SceneSetupResult {
  world?: PlayerWorld;
  dispose?: () => void;
}

export interface SceneDefinition {
  id: string;
  setupScene: (scene: THREE.Scene) => SceneSetupResult;
}

const createGrassScene = (scene: THREE.Scene): SceneSetupResult => {
  scene.background = new THREE.Color(0x0b0f1a);
  scene.fog = new THREE.Fog(0x0b0f1a, 10, 32);
  const groundSize = { width: 120, depth: 120 };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize.width, groundSize.depth),
    new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.98,
      metalness: 0.02,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.4;
  ground.receiveShadow = true;
  scene.add(ground);

  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(26, 64),
    new THREE.MeshStandardMaterial({
      color: 0x1f4d2b,
      roughness: 0.95,
      metalness: 0,
    })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -1.39;
  grass.receiveShadow = true;
  scene.add(grass);

  const trees = new THREE.Group();
  const treeColliders: { position: THREE.Vector3; radius: number }[] = [];
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b2e12,
    roughness: 0.95,
    metalness: 0.05,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f5132,
    roughness: 0.7,
    metalness: 0.1,
  });
  for (let i = 0; i < 28; i += 1) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 2.8, 10),
      trunkMaterial
    );
    trunk.castShadow = true;
    trunk.position.y = 0.0;
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(1.2 + Math.random() * 0.7, 3.4, 12),
      leafMaterial
    );
    canopy.castShadow = true;
    canopy.position.y = 1.8;
    const tree = new THREE.Group();
    tree.add(trunk, canopy);
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 12;
    tree.position.set(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    );
    tree.scale.setScalar(1.2 + Math.random() * 0.45);
    trees.add(tree);
    treeColliders.push({
      position: tree.position,
      radius: 1.05 * tree.scale.x,
    });
  }
  scene.add(trees);

  const world: PlayerWorld = {
    groundY: ground.position.y,
    bounds: {
      minX: -groundSize.width / 2 + 3,
      maxX: groundSize.width / 2 - 3,
      minZ: -groundSize.depth / 2 + 3,
      maxZ: groundSize.depth / 2 - 3,
    },
    projectileColliders: [ground, trees],
    isBlocked: (x, z) => {
      for (let i = 0; i < treeColliders.length; i += 1) {
        const collider = treeColliders[i];
        const dx = x - collider.position.x;
        const dz = z - collider.position.z;
        if (dx * dx + dz * dz < (collider.radius + 0.45) ** 2) {
          return true;
        }
      }
      return false;
    },
  };

  const dispose = () => {
    scene.remove(ground);
    scene.remove(grass);
    scene.remove(trees);
    ground.geometry.dispose();
    ground.material.dispose();
    grass.geometry.dispose();
    grass.material.dispose();
    trunkMaterial.dispose();
    leafMaterial.dispose();
    trees.children.forEach((tree) => {
      tree.children.forEach((child) => {
        child.geometry.dispose();
      });
    });
  };

  return { world, dispose };
};

const createRangeScene = (scene: THREE.Scene): SceneSetupResult => {
  scene.background = new THREE.Color(0x090d15);
  scene.fog = new THREE.Fog(0x090d15, 12, 38);

  const groundY = -1.4;
  const floorSize = { width: 90, depth: 60 };
  const bounds = {
    minX: -floorSize.width / 2 + 2,
    maxX: floorSize.width / 2 - 2,
    minZ: -floorSize.depth / 2 + 2,
    maxZ: floorSize.depth / 2 - 2,
  };

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  const trackMesh = (mesh: THREE.Mesh) => {
    geometries.add(mesh.geometry);
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => materials.add(material));
    } else {
      materials.add(mesh.material);
    }
  };

  const rangeGroup = new THREE.Group();
  scene.add(rangeGroup);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorSize.width, floorSize.depth),
    new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.95,
      metalness: 0.05,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = groundY;
  floor.receiveShadow = true;
  rangeGroup.add(floor);
  trackMesh(floor);

  const laneMaterial = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.8,
    metalness: 0.25,
    emissive: 0x0b1220,
    emissiveIntensity: 0.3,
  });
  const laneGeometry = new THREE.BoxGeometry(0.18, 0.04, 46);
  [-7, 0, 7].forEach((x) => {
    const lane = new THREE.Mesh(laneGeometry, laneMaterial);
    lane.position.set(x, groundY + 0.02, -2);
    lane.receiveShadow = true;
    rangeGroup.add(lane);
    trackMesh(lane);
  });

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.92,
    metalness: 0.08,
  });
  const sideWallGeometry = new THREE.BoxGeometry(
    2,
    6,
    bounds.maxZ - bounds.minZ + 6
  );
  const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
  leftWall.position.set(bounds.minX - 2, groundY + 3, -4);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  rangeGroup.add(leftWall);
  trackMesh(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
  rightWall.position.set(bounds.maxX + 2, groundY + 3, -4);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  rangeGroup.add(rightWall);
  trackMesh(rightWall);

  const backWallGeometry = new THREE.BoxGeometry(
    bounds.maxX - bounds.minX + 6,
    7,
    2
  );
  const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
  backWall.position.set(0, groundY + 3.5, bounds.minZ - 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  rangeGroup.add(backWall);
  trackMesh(backWall);

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.7,
    metalness: 0.35,
  });
  const railGeometry = new THREE.BoxGeometry(0.4, 0.6, 46);
  [-3.6, 3.6].forEach((x) => {
    const rail = new THREE.Mesh(railGeometry, railMaterial);
    rail.position.set(x, groundY + 0.3, -2);
    rail.castShadow = true;
    rail.receiveShadow = true;
    rangeGroup.add(rail);
    trackMesh(rail);
  });

  const createTarget = (x: number) => {
    const standMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.8,
      metalness: 0.3,
    });
    const boardMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b1220,
      roughness: 0.85,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
    const group = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.4, 0.6),
      standMaterial
    );
    base.position.set(0, groundY + 0.2, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    trackMesh(base);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 2.6, 12),
      standMaterial
    );
    pole.position.set(0, groundY + 1.55, 0);
    pole.castShadow = true;
    pole.receiveShadow = true;
    group.add(pole);
    trackMesh(pole);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 3.2, 0.2),
      boardMaterial
    );
    board.position.set(0, groundY + 3, 0.3);
    board.castShadow = true;
    board.receiveShadow = true;
    group.add(board);
    trackMesh(board);

    const ringColors = [0x0f172a, 0xe11d48, 0xf8fafc, 0xe11d48, 0xf8fafc];
    const ringSizes = [1.15, 0.9, 0.62, 0.36, 0.16];
    ringSizes.forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 32),
        new THREE.MeshStandardMaterial({
          color: ringColors[index],
          roughness: 0.5,
          metalness: 0.05,
          side: THREE.DoubleSide,
        })
      );
      ring.position.set(0, groundY + 3, 0.42 + index * 0.02);
      group.add(ring);
      trackMesh(ring);
    });

    group.position.set(x, 0, bounds.minZ + 1.2);
    return group;
  };

  [-8, 0, 8].forEach((x) => {
    const target = createTarget(x);
    rangeGroup.add(target);
  });

  const world: PlayerWorld = {
    groundY,
    bounds,
    projectileColliders: [rangeGroup],
    isBlocked: (x, z) =>
      x < bounds.minX ||
      x > bounds.maxX ||
      z < bounds.minZ ||
      z > bounds.maxZ,
  };

  const dispose = () => {
    scene.remove(rangeGroup);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  };

  return { world, dispose };
};

const createEmptyScene = (): SceneSetupResult => ({
  world: { groundY: -1.4 },
});

const sceneRegistry: Record<string, SceneDefinition> = {
  grass: {
    id: "grass",
    setupScene: createGrassScene,
  },
  range: {
    id: "range",
    setupScene: createRangeScene,
  },
  empty: {
    id: "empty",
    setupScene: createEmptyScene,
  },
};

export const getSceneDefinition = (sceneId?: string): SceneDefinition =>
  sceneRegistry[sceneId || "grass"] || sceneRegistry.grass;
