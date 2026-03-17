import * as THREE from "three";
import { createMochiGeneralSkill5VolleyRuntime } from "../../../object/projectile/projectile/mochiGeneral/skill5VolleyRuntime";
import type { ProjectileBlockHitHandler } from "../../../object/projectile/blocking";
import type { MochiGeneralCombatEntry } from "./combatBehavior";
import { createMochiGeneralShadowChargeFx } from "./shadowChargeFx";

const skill5OriginWorld = new THREE.Vector3();
const SKILL5_CHARGE_FX_INTERVAL_MS = 84;
const SKILL5_PRE_FIRE_CHARGE_MS = 150;
const SKILL5_PRE_FIRE_STAGGER_MS = 36;

type PendingSkill5Shot = {
  entry: MochiGeneralCombatEntry;
  target: THREE.Object3D;
  fireAtMs: number;
};

export type MochiGeneralSkill5Runtime = {
  onBossTick: (args: {
    entry: MochiGeneralCombatEntry;
    player: THREE.Object3D;
    gameEnded: boolean;
  }) => void;
  update: (args: {
    now: number;
    delta: number;
    applyDamageToTarget: (target: THREE.Object3D, amount: number) => number;
    gameEnded: boolean;
    projectileBlockers: THREE.Object3D[];
    handleProjectileBlockHit?: ProjectileBlockHitHandler;
  }) => void;
  onBossRemoved: (_entry: MochiGeneralCombatEntry) => void;
  dispose: () => void;
};

export const createMochiGeneralSkill5Runtime = (
  scene: THREE.Scene
): MochiGeneralSkill5Runtime => {
  const projectileRuntime = createMochiGeneralSkill5VolleyRuntime(scene);
  const shadowChargeFx = createMochiGeneralShadowChargeFx(scene);
  const nextChargeAtByEntry = new WeakMap<MochiGeneralCombatEntry, number>();
  const pendingShots: PendingSkill5Shot[] = [];

  const resolveSkill5Origin = (entry: MochiGeneralCombatEntry, out: THREE.Vector3) => {
    const heldMochi = entry.rig?.heldMochi;
    if (heldMochi) {
      heldMochi.getWorldPosition(out);
      return;
    }
    out.copy(entry.anchor.position);
    out.y += 2.35;
  };

  const spawnSingleShot = ({
    entry,
    target,
    gameEnded,
  }: {
    entry: MochiGeneralCombatEntry;
    target: THREE.Object3D;
    gameEnded: boolean;
  }) => {
    if (gameEnded || !entry.monster.isAlive) return;
    resolveSkill5Origin(entry, skill5OriginWorld);
    projectileRuntime.spawnProjectile({
      origin: skill5OriginWorld,
      target,
      gameEnded,
    });
  };

  const emitCastingChargeFx = (entry: MochiGeneralCombatEntry, gameEnded: boolean) => {
    if (!entry.skill5Casting || gameEnded || !entry.monster.isAlive) {
      nextChargeAtByEntry.delete(entry);
      return;
    }
    const now = performance.now();
    const nextAt = nextChargeAtByEntry.get(entry) ?? 0;
    if (now < nextAt) return;
    resolveSkill5Origin(entry, skill5OriginWorld);
    shadowChargeFx.spawnBurst(skill5OriginWorld, {
      count: entry.rageActive ? 8 : 6,
      radiusScale: 0.74,
      inwardSpeedScale: 0.88,
      lifeScale: 0.98,
    });
    nextChargeAtByEntry.set(entry, now + SKILL5_CHARGE_FX_INTERVAL_MS);
  };

  const processPendingShots = (nowMs: number, gameEnded: boolean) => {
    for (let i = pendingShots.length - 1; i >= 0; i -= 1) {
      const pending = pendingShots[i];
      if (!pending.entry.monster.isAlive || gameEnded) {
        pendingShots.splice(i, 1);
        continue;
      }
      if (nowMs < pending.fireAtMs) continue;
      spawnSingleShot({
        entry: pending.entry,
        target: pending.target,
        gameEnded,
      });
      pendingShots.splice(i, 1);
    }
  };

  const removePendingShotsForEntry = (entry: MochiGeneralCombatEntry) => {
    for (let i = pendingShots.length - 1; i >= 0; i -= 1) {
      if (pendingShots[i]?.entry === entry) {
        pendingShots.splice(i, 1);
      }
    }
  };

  return {
    onBossTick: ({ entry, player, gameEnded }) => {
      emitCastingChargeFx(entry, gameEnded);

      const pendingBurstCount = Math.max(
        entry.skill5BurstPendingCount,
        entry.skill5BurstRequested ? 1 : 0
      );
      if (pendingBurstCount <= 0) return;

      entry.skill5BurstRequested = false;
      entry.skill5BurstPendingCount = 0;
      const startAt = performance.now() + SKILL5_PRE_FIRE_CHARGE_MS;
      for (let i = 0; i < pendingBurstCount; i += 1) {
        resolveSkill5Origin(entry, skill5OriginWorld);
        shadowChargeFx.spawnBurst(skill5OriginWorld, {
          count: entry.rageActive ? 16 : 12,
          radiusScale: 1.06,
          inwardSpeedScale: 1.18,
          lifeScale: 1.18,
        });
        pendingShots.push({
          entry,
          target: player,
          fireAtMs: startAt + i * SKILL5_PRE_FIRE_STAGGER_MS,
        });
      }
    },
    update: ({
      now,
      delta,
      applyDamageToTarget,
      gameEnded,
      projectileBlockers,
      handleProjectileBlockHit,
    }) => {
      shadowChargeFx.update(delta);
      processPendingShots(now, gameEnded);
      projectileRuntime.update({
        now,
        delta,
        applyDamageToTarget,
        projectileBlockers,
        handleProjectileBlockHit,
      });
    },
    onBossRemoved: (entry) => {
      nextChargeAtByEntry.delete(entry);
      removePendingShotsForEntry(entry);
    },
    dispose: () => {
      pendingShots.length = 0;
      shadowChargeFx.dispose();
      projectileRuntime.dispose();
    },
  };
};
