import * as THREE from "three";
import type { PlayerAttackTarget } from "../../character/general/player";

const resolveRenderableBounds = (object: THREE.Object3D) => {
  const bounds = new THREE.Box3();
  const meshBounds = new THREE.Box3();
  let hasMesh = false;
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshBounds.setFromObject(mesh);
    if (!hasMesh) {
      bounds.copy(meshBounds);
      hasMesh = true;
    } else {
      bounds.union(meshBounds);
    }
  });
  if (!hasMesh) {
    bounds.setFromObject(object);
  }
  return bounds;
};

export const normalizeModelToHeight = (model: THREE.Object3D, targetHeight: number) => {
  const bounds = resolveRenderableBounds(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  const sourceHeight = Math.max(0.001, size.y);
  model.scale.setScalar(targetHeight / sourceHeight);
  model.updateMatrixWorld(true);

  const normalizedBounds = resolveRenderableBounds(model);
  normalizedBounds.getCenter(center);
  model.position.set(-center.x, -normalizedBounds.min.y, -center.z);
  model.updateMatrixWorld(true);
};

export const removeAttackTargetById = (
  attackTargets: PlayerAttackTarget[],
  id: string
) => {
  const index = attackTargets.findIndex((target) => target.id === id);
  if (index < 0) return;
  attackTargets.splice(index, 1);
};

export const findBossHealthFromAttackTargets = (
  attackTargets: PlayerAttackTarget[],
  predicate: (target: PlayerAttackTarget) => boolean
) => {
  const target = attackTargets.find(
    (entry) =>
      predicate(entry) &&
      typeof entry.getHealth === "function" &&
      typeof entry.getMaxHealth === "function"
  );
  if (!target?.getHealth || !target?.getMaxHealth) {
    return { health: 0, maxHealth: 0, alive: false };
  }
  const health = Math.max(0, target.getHealth());
  const maxHealth = Math.max(1, target.getMaxHealth());
  return {
    health,
    maxHealth,
    alive: health > 0,
  };
};
