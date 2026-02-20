import * as THREE from "three";
import { createMochiGeneralSkill5VolleyRuntime } from "../../../object/projectile/projectile/mochiGeneral/skill5VolleyRuntime";
import type { ProjectileBlockHitHandler } from "../../../object/projectile/blocking";
import type { MochiGeneralCombatEntry } from "./combatBehavior";

const skill5OriginWorld = new THREE.Vector3();

export type MochiGeneralSkill5Runtime = {
  onBossTick: (args: {
    entry: MochiGeneralCombatEntry;
    player: THREE.Object3D;
    gameEnded: boolean;
  }) => void;
  update: (args: {
    now: number;
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
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
    player,
    gameEnded,
  }: {
    entry: MochiGeneralCombatEntry;
    player: THREE.Object3D;
    gameEnded: boolean;
  }) => {
    if (gameEnded || !entry.monster.isAlive) return;
    resolveSkill5Origin(entry, skill5OriginWorld);
    projectileRuntime.spawnProjectile({
      origin: skill5OriginWorld,
      target: player,
      gameEnded,
    });
  };

  return {
    onBossTick: ({ entry, player, gameEnded }) => {
      const pendingBurstCount = Math.max(
        entry.skill5BurstPendingCount,
        entry.skill5BurstRequested ? 1 : 0
      );
      if (pendingBurstCount <= 0) return;

      entry.skill5BurstRequested = false;
      entry.skill5BurstPendingCount = 0;
      for (let i = 0; i < pendingBurstCount; i += 1) {
        spawnSingleShot({
          entry,
          player,
          gameEnded,
        });
      }
    },
    update: ({
      now,
      delta,
      player,
      applyDamage,
      projectileBlockers,
      handleProjectileBlockHit,
    }) => {
      projectileRuntime.update({
        now,
        delta,
        player,
        applyDamage,
        projectileBlockers,
        handleProjectileBlockHit,
      });
    },
    onBossRemoved: () => {},
    dispose: () => {
      projectileRuntime.dispose();
    },
  };
};
