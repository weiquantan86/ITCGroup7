import * as THREE from "three";
import type { MochiGeneralCombatEntry } from "./combatBehavior";
import {
  MOCHI_GENERAL_SKILL3_SUMMON_COUNT,
  MOCHI_GENERAL_SKILL3_SUMMON_RADIUS,
} from "./combatBehavior";

export type MochiGeneralSkill3Runtime = {
  onBossTick: (args: {
    entry: MochiGeneralCombatEntry;
    gameEnded: boolean;
    isBlocked: (x: number, z: number) => boolean;
    summonAt: (args: {
      entry: MochiGeneralCombatEntry;
      position: THREE.Vector3;
    }) => void;
  }) => void;
  onBossRemoved: (entry: MochiGeneralCombatEntry) => void;
  dispose: () => void;
};

const summonPosition = new THREE.Vector3();

export const createMochiGeneralSkill3Runtime = (): MochiGeneralSkill3Runtime => ({
  onBossTick: ({ entry, gameEnded, isBlocked, summonAt }) => {
    if (!entry.skill3SummonRequested) return;
    entry.skill3SummonRequested = false;

    if (gameEnded || !entry.monster.isAlive) return;

    const center = entry.anchor.position;
    for (let i = 0; i < MOCHI_GENERAL_SKILL3_SUMMON_COUNT; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * MOCHI_GENERAL_SKILL3_SUMMON_RADIUS;
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;
      if (isBlocked(x, z)) continue;
      summonPosition.set(x, center.y, z);
      summonAt({
        entry,
        position: summonPosition.clone(),
      });
    }
  },
  onBossRemoved: () => {},
  dispose: () => {},
});

