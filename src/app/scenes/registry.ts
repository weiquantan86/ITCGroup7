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

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
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

const createEmptyScene = (): SceneSetupResult => ({
  world: { groundY: -1.4 },
});

const sceneRegistry: Record<string, SceneDefinition> = {
  grass: {
    id: "grass",
    setupScene: createGrassScene,
  },
  empty: {
    id: "empty",
    setupScene: createEmptyScene,
  },
};

export const getSceneDefinition = (sceneId?: string): SceneDefinition =>
  sceneRegistry[sceneId || "grass"] || sceneRegistry.grass;
