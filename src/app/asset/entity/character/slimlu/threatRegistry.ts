import * as THREE from "three";

export type SlimluThreatEntry = {
  id: string;
  object: THREE.Object3D;
  isActive: () => boolean;
  applyDamage: (amount: number) => number;
};

const threatEntries = new Map<string, SlimluThreatEntry>();
const threatIdByObjectUuid = new Map<string, string>();
const sourceWorldPos = new THREE.Vector3();
const candidateWorldPos = new THREE.Vector3();

const isEntryActive = (entry: SlimluThreatEntry) =>
  entry.isActive() && Boolean(entry.object.parent);

const resolveEntryByObject = (object: THREE.Object3D) => {
  const id = threatIdByObjectUuid.get(object.uuid);
  if (!id) return null;
  return threatEntries.get(id) ?? null;
};

export const registerSlimluThreatEntry = (entry: SlimluThreatEntry) => {
  const existing = threatEntries.get(entry.id);
  if (existing) {
    threatIdByObjectUuid.delete(existing.object.uuid);
  }
  threatEntries.set(entry.id, entry);
  threatIdByObjectUuid.set(entry.object.uuid, entry.id);
};

export const unregisterSlimluThreatEntry = (id: string) => {
  const existing = threatEntries.get(id);
  if (!existing) return;
  threatIdByObjectUuid.delete(existing.object.uuid);
  threatEntries.delete(id);
};

export const clearSlimluThreatEntries = () => {
  threatEntries.clear();
  threatIdByObjectUuid.clear();
};

export const isSlimluThreatTargetObject = (
  target: THREE.Object3D | null | undefined
) => {
  if (!target) return false;
  return Boolean(resolveEntryByObject(target));
};

export const resolveSlimluThreatTargetForEnemy = ({
  fallbackTarget,
  enemyObject,
  enemyPosition,
}: {
  fallbackTarget: THREE.Object3D;
  enemyObject?: THREE.Object3D | null;
  enemyPosition?: THREE.Vector3 | null;
}) => {
  if (!threatEntries.size) return fallbackTarget;
  if (enemyObject) {
    enemyObject.getWorldPosition(sourceWorldPos);
  } else if (enemyPosition) {
    sourceWorldPos.copy(enemyPosition);
  } else {
    return fallbackTarget;
  }

  let bestTarget: THREE.Object3D = fallbackTarget;
  fallbackTarget.getWorldPosition(candidateWorldPos);
  let bestDistanceSq = sourceWorldPos.distanceToSquared(candidateWorldPos);

  for (const entry of threatEntries.values()) {
    if (!isEntryActive(entry)) continue;
    entry.object.getWorldPosition(candidateWorldPos);
    const distanceSq = sourceWorldPos.distanceToSquared(candidateWorldPos);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestTarget = entry.object;
    }
  }
  return bestTarget;
};

export const applyDamageToSlimluThreatOrPlayer = ({
  target,
  amount,
  applyPlayerDamage,
}: {
  target: THREE.Object3D | null | undefined;
  amount: number;
  applyPlayerDamage: (amount: number) => number;
}) => {
  if (!target) {
    return applyPlayerDamage(amount);
  }
  const entry = resolveEntryByObject(target);
  if (!entry) {
    return applyPlayerDamage(amount);
  }
  if (!isEntryActive(entry)) {
    return 0;
  }
  return entry.applyDamage(amount);
};

export const collectActiveSlimluThreatTargets = (
  out: THREE.Object3D[] = []
) => {
  out.length = 0;
  for (const entry of threatEntries.values()) {
    if (!isEntryActive(entry)) continue;
    out.push(entry.object);
  }
  return out;
};
