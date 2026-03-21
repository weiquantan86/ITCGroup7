import * as THREE from "three";
import {
  registerSlimluThreatEntry,
  unregisterSlimluThreatEntry,
} from "../slimlu/threatRegistry";

export type BaronCloneThreatTarget = {
  id: string;
  object: THREE.Object3D;
  maxHealth: number;
  health: number;
  spawnedAt: number;
  expiresAt: number;
  active: boolean;
};

export const createBaronCloneThreatTarget = ({
  id,
  object,
  maxHealth,
  spawnedAt,
  lifetimeMs,
}: {
  id: string;
  object: THREE.Object3D;
  maxHealth: number;
  spawnedAt: number;
  lifetimeMs: number;
}): BaronCloneThreatTarget => {
  const resolvedMaxHealth = Math.max(1, maxHealth);
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

export const isBaronCloneThreatTargetAlive = (
  target: BaronCloneThreatTarget,
  now: number
) =>
  target.active &&
  target.health > 0 &&
  now < target.expiresAt &&
  Boolean(target.object.parent);

export const applyDamageToBaronCloneThreatTarget = (
  target: BaronCloneThreatTarget,
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

export const registerBaronCloneThreatTarget = (
  target: BaronCloneThreatTarget,
  applyDamage: (amount: number) => number
) => {
  registerSlimluThreatEntry({
    id: target.id,
    object: target.object,
    isActive: () => {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      return isBaronCloneThreatTargetAlive(target, now);
    },
    applyDamage,
  });
};

export const unregisterBaronCloneThreatTarget = (id: string) => {
  unregisterSlimluThreatEntry(id);
};
