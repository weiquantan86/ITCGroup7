import * as THREE from "three";
import { resolveCharacterStats } from "./registry";
import type { StatusHud } from "../engine/statusHud";
import type { PlayerUiState } from "../engine/types";
import type { CharacterProfile, CharacterStats, SkillKey } from "../types";

export type EnergyConfigResolved = {
  passivePerSecond: number;
  movingPerSecond: number;
  hitGain: number;
  damageTakenRatio: number;
};

export type ManaConfigResolved = {
  passivePerSecond: number;
};

export type MovementConfigResolved = {
  baseSpeed: number;
  sprintMultiplier: number;
};

export type CameraConfigResolved = {
  followHeadBone: boolean;
  miniBehindDistance: number;
  miniUpDistance: number;
  miniLookUpOffset: number;
};

type CreatePlayerStatsStateArgs = {
  profile: CharacterProfile;
  infiniteFire: boolean;
  statusHud: StatusHud;
  onUiStateChange?: (state: PlayerUiState) => void;
};

type EmitUiStateArgs = {
  now: number;
  getCooldownRemainingMs: (key: SkillKey) => number;
  getCooldownDurationMs: (key: SkillKey) => number;
};

const resolveSkillCooldownDurations = (
  profile?: CharacterProfile
): Record<SkillKey, number> => ({
  q: Math.max(0, profile?.kit?.skills?.q?.cooldownMs ?? 0),
  e: Math.max(0, profile?.kit?.skills?.e?.cooldownMs ?? 0),
  r: Math.max(0, profile?.kit?.skills?.r?.cooldownMs ?? 0),
});

const resolveEnergyConfig = (
  profile?: CharacterProfile
): EnergyConfigResolved => ({
  passivePerSecond: Math.max(0, profile?.energy?.passivePerSecond ?? 0),
  movingPerSecond: Math.max(0, profile?.energy?.movingPerSecond ?? 0),
  hitGain: Math.max(0, profile?.energy?.hitGain ?? 0),
  damageTakenRatio: Math.max(0, profile?.energy?.damageTakenRatio ?? 0),
});

const resolveMovementConfig = (
  profile?: CharacterProfile
): MovementConfigResolved => ({
  baseSpeed: Math.max(0.1, profile?.movement?.baseSpeed ?? 5),
  sprintMultiplier: Math.max(1, profile?.movement?.sprintMultiplier ?? 1.6),
});

const resolveManaConfig = (
  profile?: CharacterProfile
): ManaConfigResolved => ({
  passivePerSecond: Math.max(0, profile?.mana?.passivePerSecond ?? 0),
});

const resolveCameraConfig = (
  profile?: CharacterProfile
): CameraConfigResolved => ({
  followHeadBone: Boolean(profile?.camera?.followHeadBone),
  miniBehindDistance: Math.max(1, profile?.camera?.miniBehindDistance ?? 3.9),
  miniUpDistance: Math.max(0.2, profile?.camera?.miniUpDistance ?? 2.4),
  miniLookUpOffset: profile?.camera?.miniLookUpOffset ?? 0,
});

type SkillCost = number | "all";

export const createPlayerStatsState = ({
  profile,
  infiniteFire,
  statusHud,
  onUiStateChange,
}: CreatePlayerStatsStateArgs) => {
  let maxStats: CharacterStats = resolveCharacterStats(profile);
  let currentStats: CharacterStats = { ...maxStats };
  let skillCooldownDurations: Record<SkillKey, number> =
    resolveSkillCooldownDurations(profile);
  let skillCooldownUntil: Record<SkillKey, number> = { q: 0, e: 0, r: 0 };
  let energyConfig: EnergyConfigResolved = resolveEnergyConfig(profile);
  let manaConfig: ManaConfigResolved = resolveManaConfig(profile);
  let movementConfig: MovementConfigResolved = resolveMovementConfig(profile);
  let cameraConfig: CameraConfigResolved = resolveCameraConfig(profile);
  let statsDirty = true;
  let lastUiStateSnapshot = "";

  const syncHud = () => {
    if (!statsDirty) return;
    statusHud.setStats(currentStats, maxStats);
    statsDirty = false;
  };

  const markDirty = () => {
    statsDirty = true;
  };

  const setProfile = (nextProfile: CharacterProfile) => {
    maxStats = resolveCharacterStats(nextProfile);
    currentStats = { ...maxStats };
    energyConfig = resolveEnergyConfig(nextProfile);
    manaConfig = resolveManaConfig(nextProfile);
    movementConfig = resolveMovementConfig(nextProfile);
    cameraConfig = resolveCameraConfig(nextProfile);
    skillCooldownDurations = resolveSkillCooldownDurations(nextProfile);
    skillCooldownUntil = { q: 0, e: 0, r: 0 };
    if (infiniteFire && maxStats.mana > 0) {
      currentStats.mana = maxStats.mana;
    }
    if (infiniteFire && maxStats.energy > 0) {
      currentStats.energy = maxStats.energy;
    }
    markDirty();
  };

  const syncHealth = (health: number) => {
    const clamped = THREE.MathUtils.clamp(health, 0, maxStats.health);
    if (Math.abs(clamped - currentStats.health) < 0.000001) return;
    currentStats.health = clamped;
    markDirty();
  };

  const resetCurrentToMax = () => {
    currentStats = { ...maxStats };
    markDirty();
  };

  const damageHealth = (amount: number) => {
    if (amount <= 0 || currentStats.health <= 0) return 0;
    const next = Math.max(0, currentStats.health - amount);
    const applied = currentStats.health - next;
    if (applied > 0) {
      currentStats.health = next;
      markDirty();
    }
    return applied;
  };

  const healHealth = (amount: number) => {
    if (amount <= 0 || currentStats.health >= maxStats.health) return 0;
    const next = Math.min(maxStats.health, currentStats.health + amount);
    const applied = next - currentStats.health;
    if (applied > 0) {
      currentStats.health = next;
      markDirty();
    }
    return applied;
  };

  const applyEnergy = (amount: number) => {
    if (infiniteFire) return 0;
    if (maxStats.energy <= 0 || amount <= 0) return 0;
    const next = Math.min(maxStats.energy, currentStats.energy + amount);
    const gained = next - currentStats.energy;
    if (gained > 0) {
      currentStats.energy = next;
      markDirty();
    }
    return gained;
  };

  const spendEnergy = (amount: number) => {
    if (infiniteFire) return 0;
    if (amount <= 0 || currentStats.energy <= 0) return 0;
    const next = Math.max(0, currentStats.energy - amount);
    const spent = currentStats.energy - next;
    if (spent > 0) {
      currentStats.energy = next;
      markDirty();
    }
    return spent;
  };

  const applyMana = (amount: number) => {
    if (infiniteFire) return 0;
    if (maxStats.mana <= 0 || amount <= 0) return 0;
    const next = Math.min(maxStats.mana, currentStats.mana + amount);
    const gained = next - currentStats.mana;
    if (gained > 0) {
      currentStats.mana = next;
      markDirty();
    }
    return gained;
  };

  const spendMana = (amount: number) => {
    if (infiniteFire) return 0;
    if (amount <= 0 || currentStats.mana <= 0) return 0;
    const next = Math.max(0, currentStats.mana - amount);
    const spent = currentStats.mana - next;
    if (spent > 0) {
      currentStats.mana = next;
      markDirty();
    }
    return spent;
  };

  const consumeAllEnergy = () => {
    if (infiniteFire) return 0;
    if (currentStats.energy <= 0) return 0;
    const consumed = currentStats.energy;
    currentStats.energy = 0;
    markDirty();
    return consumed;
  };

  const getSkillCost = (
    key: SkillKey,
    currentProfile: CharacterProfile
  ): SkillCost => {
    const configuredCost = currentProfile.kit?.skills?.[key]?.cost;
    if (configuredCost == null) {
      return key === "q" ? 20 : 0;
    }
    if (configuredCost === "all") {
      return "all";
    }
    return Math.max(0, configuredCost);
  };

  const getSkillResource = (key: SkillKey): "mana" | "energy" =>
    key === "q" ? "energy" : "mana";

  const hasEnoughSkillResource = (key: SkillKey, currentProfile: CharacterProfile) => {
    if (infiniteFire) return true;
    const cost = getSkillCost(key, currentProfile);
    if (cost === "all") {
      if (getSkillResource(key) === "energy") {
        return currentStats.energy > 0;
      }
      return currentStats.mana > 0;
    }
    if (cost <= 0) return true;
    if (getSkillResource(key) === "energy") {
      return currentStats.energy >= cost;
    }
    return currentStats.mana >= cost;
  };

  const spendSkillCost = (key: SkillKey, currentProfile: CharacterProfile) => {
    if (infiniteFire) return;
    const cost = getSkillCost(key, currentProfile);
    if (cost === "all") {
      if (getSkillResource(key) === "energy") {
        consumeAllEnergy();
      } else if (currentStats.mana > 0) {
        currentStats.mana = 0;
        markDirty();
      }
      return;
    }
    if (cost <= 0) return;
    if (getSkillResource(key) === "energy") {
      spendEnergy(cost);
    } else {
      spendMana(cost);
    }
  };

  const resetSkillCooldowns = () => {
    skillCooldownUntil = { q: 0, e: 0, r: 0 };
  };

  const activateSkillCooldown = (
    key: SkillKey,
    now: number,
    runtimeManaged: boolean
  ) => {
    if (infiniteFire || runtimeManaged) return;
    const cooldownMs = skillCooldownDurations[key];
    if (cooldownMs <= 0) return;
    skillCooldownUntil[key] = now + cooldownMs;
  };

  const getSkillCooldownRemainingMs = ({
    now,
    key,
    runtimeRemainingMs,
  }: {
    now: number;
    key: SkillKey;
    runtimeRemainingMs: number | null;
  }) => {
    if (infiniteFire) return 0;
    if (runtimeRemainingMs !== null) return Math.max(0, runtimeRemainingMs);
    return Math.max(0, skillCooldownUntil[key] - now);
  };

  const getSkillCooldownDurationMs = ({
    key,
    runtimeDurationMs,
  }: {
    key: SkillKey;
    runtimeDurationMs: number | null;
  }) => {
    if (runtimeDurationMs !== null) {
      return Math.max(0, runtimeDurationMs);
    }
    return skillCooldownDurations[key];
  };

  const applyPassiveRegen = (delta: number, isMoving: boolean) => {
    if (infiniteFire) {
      if (maxStats.mana > 0 && currentStats.mana < maxStats.mana) {
        currentStats.mana = maxStats.mana;
        markDirty();
      }
      if (maxStats.energy > 0 && currentStats.energy < maxStats.energy) {
        currentStats.energy = maxStats.energy;
        markDirty();
      }
      return;
    }

    const manaRegen = manaConfig.passivePerSecond * delta;
    if (maxStats.mana > 0 && manaRegen > 0 && currentStats.mana < maxStats.mana) {
      currentStats.mana = Math.min(maxStats.mana, currentStats.mana + manaRegen);
      markDirty();
    }

    if (maxStats.energy > 0) {
      const energyRegen =
        energyConfig.passivePerSecond * delta +
        (isMoving ? energyConfig.movingPerSecond * delta : 0);
      applyEnergy(energyRegen);
    }
  };

  const restoreFullHealth = () => {
    if (currentStats.health >= maxStats.health) return false;
    currentStats.health = maxStats.health;
    markDirty();
    return true;
  };

  const restoreFullMana = () => {
    if (currentStats.mana >= maxStats.mana) return false;
    currentStats.mana = maxStats.mana;
    markDirty();
    return true;
  };

  const restoreFullEnergy = () => {
    if (currentStats.energy >= maxStats.energy) return false;
    currentStats.energy = maxStats.energy;
    markDirty();
    return true;
  };

  const emitUiState = ({
    now,
    getCooldownRemainingMs,
    getCooldownDurationMs,
  }: EmitUiStateArgs) => {
    if (!onUiStateChange) return;
    const cooldowns: Record<SkillKey, number> = {
      q: getCooldownRemainingMs("q") / 1000,
      e: getCooldownRemainingMs("e") / 1000,
      r: getCooldownRemainingMs("r") / 1000,
    };
    const cooldownDurations: Record<SkillKey, number> = {
      q: getCooldownDurationMs("q") / 1000,
      e: getCooldownDurationMs("e") / 1000,
      r: getCooldownDurationMs("r") / 1000,
    };
    const payload: PlayerUiState = {
      cooldowns,
      cooldownDurations,
      manaCurrent: currentStats.mana,
      manaMax: maxStats.mana,
      energyCurrent: currentStats.energy,
      energyMax: maxStats.energy,
      infiniteFire,
    };
    const snapshot = [
      cooldowns.q.toFixed(2),
      cooldowns.e.toFixed(2),
      cooldowns.r.toFixed(2),
      cooldownDurations.q.toFixed(2),
      cooldownDurations.e.toFixed(2),
      cooldownDurations.r.toFixed(2),
      Math.round(currentStats.mana),
      Math.round(maxStats.mana),
      Math.round(currentStats.energy),
      Math.round(maxStats.energy),
      infiniteFire ? "1" : "0",
    ].join("|");
    if (snapshot === lastUiStateSnapshot) return;
    lastUiStateSnapshot = snapshot;
    onUiStateChange(payload);
  };

  return {
    get maxStats() {
      return maxStats;
    },
    get currentStats() {
      return currentStats;
    },
    get energyConfig() {
      return energyConfig;
    },
    get movementConfig() {
      return movementConfig;
    },
    get cameraConfig() {
      return cameraConfig;
    },
    setProfile,
    syncHealth,
    damageHealth,
    healHealth,
    resetCurrentToMax,
    applyEnergy,
    spendEnergy,
    applyMana,
    spendMana,
    consumeAllEnergy,
    hasEnoughSkillResource,
    spendSkillCost,
    resetSkillCooldowns,
    activateSkillCooldown,
    getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs,
    applyPassiveRegen,
    restoreFullHealth,
    restoreFullMana,
    restoreFullEnergy,
    syncHud,
    emitUiState,
  };
};



