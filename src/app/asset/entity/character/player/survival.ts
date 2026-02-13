import type * as THREE from "three";
import type { HpPool } from "../../hpPool";
import type { createPlayerStatsState } from "./statsState";
import type {
  PlayerDeathArgs,
  PlayerDeathResolution,
  RecoveryZone,
} from "./types";

type PlayerStatsState = ReturnType<typeof createPlayerStatsState>;

type CreatePlayerSurvivalStateArgs = {
  avatar: THREE.Object3D;
  sceneId?: string;
  gameMode: string;
  resetOnDeath: boolean;
  recoveryZones: RecoveryZone[];
  statsState: PlayerStatsState;
  healthPool: HpPool;
  syncHealthFromPool: () => void;
  onResetPlayer: (now: number) => void;
  worldPlayerDeath?: (
    args: PlayerDeathArgs
  ) => PlayerDeathResolution | void;
  beforeDamage?: (args: {
    amount: number;
    now: number;
  }) => { amount: number } | number | void;
};

export const createPlayerSurvivalState = ({
  avatar,
  sceneId,
  gameMode,
  resetOnDeath,
  recoveryZones,
  statsState,
  healthPool,
  syncHealthFromPool,
  onResetPlayer,
  worldPlayerDeath,
  beforeDamage,
}: CreatePlayerSurvivalStateArgs) => {
  const recoveryZoneLastTriggered = new Map<string, number>();
  let respawnProtectionUntil = 0;

  const setRespawnProtection = (until: number) => {
    respawnProtectionUntil = until;
  };

  const beginRespawnProtection = (now: number, durationMs: number) => {
    respawnProtectionUntil = now + Math.max(0, durationMs);
  };

  const clearRecoveryZoneCooldowns = () => {
    recoveryZoneLastTriggered.clear();
  };

  const restoreFullHealth = () => {
    const recovered = healthPool.restoreFull();
    if (recovered <= 0) return false;
    syncHealthFromPool();
    return true;
  };

  const applyDamageToPlayer = (amount: number) => {
    const now = performance.now();
    if (now < respawnProtectionUntil) return 0;
    const damageModifier = beforeDamage?.({ amount, now });
    let modifiedAmount = amount;
    if (typeof damageModifier === "number") {
      modifiedAmount = damageModifier;
    } else if (damageModifier) {
      modifiedAmount = damageModifier.amount;
    }
    const resolvedAmount = Math.max(0, modifiedAmount);
    if (resolvedAmount <= 0) return 0;

    const applied = healthPool.takeDamage(resolvedAmount);
    if (applied > 0) {
      syncHealthFromPool();
      statsState.applyEnergy(applied * statsState.energyConfig.damageTakenRatio);
      statsState.syncHud();
    }

    if (!healthPool.isAlive) {
      let didReset = false;
      const resetPlayer = () => {
        if (didReset) return;
        didReset = true;
        onResetPlayer(now);
      };
      const deathResolution = worldPlayerDeath?.({
        now,
        sceneId,
        gameMode,
        player: avatar,
        currentStats: statsState.currentStats,
        maxStats: statsState.maxStats,
        resetPlayer,
      });
      if (didReset || deathResolution === "handled") {
        return applied;
      }
      if (deathResolution === "reset") {
        resetPlayer();
      } else if (deathResolution === undefined && resetOnDeath) {
        resetPlayer();
      }
    }

    return applied;
  };

  const applyRecoveryZones = (now: number) => {
    if (!recoveryZones.length) return;
    const x = avatar.position.x;
    const z = avatar.position.z;

    for (let i = 0; i < recoveryZones.length; i += 1) {
      const zone = recoveryZones[i];
      if (x < zone.minX || x > zone.maxX || z < zone.minZ || z > zone.maxZ) {
        continue;
      }
      const cooldownMs = zone.cooldownMs ?? 200;
      const lastTriggered = recoveryZoneLastTriggered.get(zone.id) ?? -Infinity;
      if (now - lastTriggered < cooldownMs) {
        continue;
      }

      let recovered = false;
      if (zone.type === "health" || zone.type === "both") {
        recovered = restoreFullHealth() || recovered;
      }
      if (zone.type === "mana" || zone.type === "both") {
        recovered = statsState.restoreFullMana() || recovered;
      }
      if (zone.type === "energy" || zone.type === "both") {
        recovered = statsState.restoreFullEnergy() || recovered;
      }

      if (!recovered) continue;
      statsState.syncHud();
      recoveryZoneLastTriggered.set(zone.id, now);
    }
  };

  return {
    applyDamageToPlayer,
    applyRecoveryZones,
    beginRespawnProtection,
    clearRecoveryZoneCooldowns,
    setRespawnProtection,
  };
};
