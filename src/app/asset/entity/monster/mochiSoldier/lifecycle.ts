import * as THREE from "three";
import type { PlayerAttackTarget } from "../../character/general/player";
import { Monster } from "../general";
import { mochiSoldierProfile } from "./profile";
import {
  attachMochiSoldierPrototype,
  createMochiSoldierDeathFxRuntime,
  createMochiSoldierRuntimeState,
  createMochiSoldierSummonFxRuntime,
  removeMochiSoldierEntry,
  tickMochiSoldierCombat,
  type MochiSoldierRuntimeState,
} from "./runtime";

export type MochiSummonedSoldierEntry = {
  id: string;
  anchor: THREE.Group;
  hitbox: THREE.Mesh;
  fallback: THREE.Mesh;
  model: THREE.Object3D | null;
  monster: Monster;
} & MochiSoldierRuntimeState;

export type MochiSoldierLifecycleStats = {
  spawned: number;
  alive: number;
  defeated: number;
};

export type MochiSoldierLifecycle = {
  spawn: (position: THREE.Vector3) => void;
  setPrototype: (prototype: THREE.Object3D | null) => void;
  tick: (args: {
    now: number;
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
  }) => void;
  getStats: () => MochiSoldierLifecycleStats;
  drainDefeatedCount: () => number;
  dispose: () => void;
};

export const createMochiSoldierLifecycle = ({
  scene,
  group,
  attackTargets,
  isGameEnded,
  isBlocked,
  trackMesh,
  fallbackGeometry,
  fallbackMaterialTemplate,
  hitboxGeometry,
  hitboxMaterialTemplate,
}: {
  scene: THREE.Scene;
  group: THREE.Group;
  attackTargets: PlayerAttackTarget[];
  isGameEnded: () => boolean;
  isBlocked: (x: number, z: number) => boolean;
  trackMesh: (mesh: THREE.Mesh) => void;
  fallbackGeometry: THREE.BufferGeometry;
  fallbackMaterialTemplate: THREE.Material;
  hitboxGeometry: THREE.BufferGeometry;
  hitboxMaterialTemplate: THREE.Material;
}): MochiSoldierLifecycle => {
  const entries: MochiSummonedSoldierEntry[] = [];
  const summonFxRuntime = createMochiSoldierSummonFxRuntime(scene);
  const deathFxRuntime = createMochiSoldierDeathFxRuntime(scene);
  let prototype: THREE.Object3D | null = null;
  let idCounter = 0;
  let defeated = 0;
  let pendingDefeated = 0;
  let spawned = 0;

  const removeAttackTarget = (id: string) => {
    const index = attackTargets.findIndex((target) => target.id === id);
    if (index < 0) return;
    attackTargets.splice(index, 1);
  };

  const attachPrototype = (entry: MochiSummonedSoldierEntry) => {
    if (!prototype) return;
    attachMochiSoldierPrototype({
      entry,
      prototype,
    });
  };

  const removeEntry = (
    entry: MochiSummonedSoldierEntry,
    countedAsDefeat: boolean
  ) => {
    if (countedAsDefeat) {
      defeated += 1;
      pendingDefeated += 1;
    }
    removeMochiSoldierEntry({
      entry,
      entries,
      group,
      deathFxRuntime,
      removeAttackTarget,
    });
  };

  return {
    spawn: (position) => {
      idCounter += 1;
      spawned += 1;
      const id = `mochi-general-summon-${idCounter}`;
      const anchor = new THREE.Group();
      anchor.name = `${id}-anchor`;
      anchor.position.copy(position);
      group.add(anchor);

      const fallback = new THREE.Mesh(
        fallbackGeometry,
        fallbackMaterialTemplate.clone()
      );
      fallback.name = `${id}-fallback`;
      fallback.position.set(0, 1.16, 0);
      fallback.castShadow = true;
      fallback.receiveShadow = true;
      anchor.add(fallback);

      const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterialTemplate.clone());
      hitbox.name = `${id}-hitbox`;
      hitbox.position.set(0, 1.16, 0);
      hitbox.castShadow = false;
      hitbox.receiveShadow = false;
      anchor.add(hitbox);

      trackMesh(fallback);
      trackMesh(hitbox);

      const entry: MochiSummonedSoldierEntry = {
        id,
        anchor,
        hitbox,
        fallback,
        model: null,
        monster: new Monster({
          model: anchor,
          profile: mochiSoldierProfile,
        }),
        ...createMochiSoldierRuntimeState(),
      };
      entries.push(entry);

      attackTargets.push({
        id: entry.id,
        object: hitbox,
        isActive: () => !isGameEnded() && entry.monster.isAlive,
        category: "normal",
        label: mochiSoldierProfile.label,
        getHealth: () => entry.monster.health,
        getMaxHealth: () => entry.monster.maxHealth,
        onHit: (hit) => {
          if (isGameEnded() || !entry.monster.isAlive) return;
          const applied = entry.monster.takeDamage(
            Math.max(1, Math.round(hit.damage))
          );
          if (applied <= 0) return;
          if (!entry.monster.isAlive) {
            removeEntry(entry, true);
          }
        },
      });

      attachPrototype(entry);
      summonFxRuntime.spawn(position);
    },
    setPrototype: (nextPrototype) => {
      prototype = nextPrototype;
      if (!prototype) return;
      for (let i = 0; i < entries.length; i += 1) {
        attachPrototype(entries[i]);
      }
    },
    tick: ({ now, delta, player, applyDamage }) => {
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const entry = entries[i];
        if (!entry.monster.isAlive) {
          removeEntry(entry, true);
          continue;
        }
        tickMochiSoldierCombat({
          entry,
          now,
          delta,
          player,
          gameEnded: isGameEnded(),
          isBlocked,
          applyDamage,
        });
      }
      summonFxRuntime.update(delta);
      deathFxRuntime.update(delta);
    },
    getStats: () => ({
      spawned,
      alive: entries.length,
      defeated,
    }),
    drainDefeatedCount: () => {
      const drained = pendingDefeated;
      pendingDefeated = 0;
      return drained;
    },
    dispose: () => {
      while (entries.length > 0) {
        removeEntry(entries[0], false);
      }
      summonFxRuntime.dispose();
      deathFxRuntime.dispose();
      prototype = null;
    },
  };
};
