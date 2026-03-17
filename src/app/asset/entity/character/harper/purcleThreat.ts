import * as THREE from "three";
import {
  registerSlimluThreatEntry,
  unregisterSlimluThreatEntry,
} from "../slimlu/threatRegistry";

export type HarperEnemyTarget = {
  id: string;
  object: THREE.Object3D;
  maxHealth: number;
  health: number;
  spawnedAt: number;
  expiresAt: number;
  active: boolean;
};

export const createHarperEnemyTarget = ({
  id,
  object,
  spawnedAt,
  lifetimeMs,
  maxHealth,
}: {
  id: string;
  object: THREE.Object3D;
  spawnedAt: number;
  lifetimeMs: number;
  maxHealth: number;
}): HarperEnemyTarget => {
  const resolvedMaxHealth = Math.max(1, Math.round(maxHealth));
  const resolvedLifetimeMs = Math.max(0, lifetimeMs);
  return {
    id,
    object,
    maxHealth: resolvedMaxHealth,
    health: resolvedMaxHealth,
    spawnedAt,
    expiresAt: spawnedAt + resolvedLifetimeMs,
    active: true,
  };
};

export const isHarperEnemyTargetAlive = (
  target: HarperEnemyTarget,
  now: number
) =>
  target.active &&
  target.health > 0 &&
  now < target.expiresAt &&
  Boolean(target.object.parent);

export const applyDamageToHarperEnemyTarget = (
  target: HarperEnemyTarget,
  amount: number
) => {
  if (!target.active || target.health <= 0) return 0;
  const resolvedAmount = Math.max(0, amount);
  if (resolvedAmount <= 0) return 0;
  const applied = Math.min(target.health, resolvedAmount);
  if (applied <= 0) return 0;
  target.health = Math.max(0, target.health - applied);
  if (target.health <= 0) {
    target.active = false;
  }
  return applied;
};

export const registerHarperEnemyTarget = (
  target: HarperEnemyTarget
) => {
  registerSlimluThreatEntry({
    id: target.id,
    object: target.object,
    isActive: () => {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      return isHarperEnemyTargetAlive(target, now);
    },
    applyDamage: (amount) => applyDamageToHarperEnemyTarget(target, amount),
  });
};

export const unregisterHarperEnemyTarget = (id: string) => {
  unregisterSlimluThreatEntry(id);
};

// Backward-compatible aliases for existing Purcle naming.
export type HarperPurcleEnemyTarget = HarperEnemyTarget;
export const createHarperPurcleEnemyTarget = createHarperEnemyTarget;
export const isHarperPurcleEnemyTargetAlive = isHarperEnemyTargetAlive;
export const registerHarperPurcleEnemyTarget = registerHarperEnemyTarget;
export const unregisterHarperPurcleEnemyTarget = unregisterHarperEnemyTarget;
