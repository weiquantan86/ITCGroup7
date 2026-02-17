import * as THREE from "three";
import type {
  CharacterRuntime,
  StatusEffectApplication,
  StatusEffectApplyArgs,
  StatusEffectType,
} from "../types";

type ActiveStatusEffect = {
  id: number;
  type: StatusEffectType;
  source?: string;
  tag?: string;
  endsAt: number;
  moveSpeedMultiplier: number;
  dotDamagePerSecond: number;
};

type CreatePlayerStatusEffectStateArgs = {
  getRuntime: () => CharacterRuntime | null;
  applyDamage: (amount: number) => number;
};

const clampDurationScale = (value: number | undefined) => {
  if (value == null || !Number.isFinite(value)) return 1;
  return THREE.MathUtils.clamp(value, 0, 100);
};

const clampMoveSpeedMultiplier = (value: number | undefined) => {
  if (value == null || !Number.isFinite(value)) return 1;
  return THREE.MathUtils.clamp(value, 0, 1);
};

const clampDotDamagePerSecond = (value: number | undefined) => {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
};

export const createPlayerStatusEffectState = ({
  getRuntime,
  applyDamage,
}: CreatePlayerStatusEffectStateArgs) => {
  let nextId = 1;
  const activeEffects: ActiveStatusEffect[] = [];

  const pruneExpired = (now: number) => {
    for (let i = activeEffects.length - 1; i >= 0; i -= 1) {
      if (activeEffects[i].endsAt <= now) {
        activeEffects.splice(i, 1);
      }
    }
  };

  const apply = (
    effect: StatusEffectApplication,
    now: number = performance.now()
  ) => {
    const runtime = getRuntime();
    if (
      runtime?.isImmuneToStatus?.({
        type: effect.type,
        source: effect.source,
        now,
      })
    ) {
      return false;
    }

    const applyArgs: StatusEffectApplyArgs = {
      ...effect,
      now,
    };
    const modifier = runtime?.beforeStatusApply?.(applyArgs);
    if (modifier === false) return false;
    if (modifier && typeof modifier === "object" && modifier.allow === false) {
      return false;
    }

    const durationScale =
      modifier && typeof modifier === "object"
        ? clampDurationScale(modifier.durationScale)
        : 1;
    const durationSec = Math.max(
      0,
      (Number.isFinite(effect.durationSec) ? effect.durationSec : 0) * durationScale
    );
    if (durationSec <= 0.000001) return false;

    const durationMs = durationSec * 1000;
    let moveSpeedMultiplier =
      effect.type === "root"
        ? 0
        : clampMoveSpeedMultiplier(effect.moveSpeedMultiplier);
    let dotDamagePerSecond = clampDotDamagePerSecond(effect.dotDamagePerSecond);
    if (modifier && typeof modifier === "object") {
      if (modifier.moveSpeedMultiplier != null) {
        moveSpeedMultiplier = clampMoveSpeedMultiplier(modifier.moveSpeedMultiplier);
      }
      if (modifier.dotDamagePerSecond != null) {
        dotDamagePerSecond = clampDotDamagePerSecond(modifier.dotDamagePerSecond);
      }
    }

    if (effect.tag) {
      const existing = activeEffects.find(
        (entry) => entry.type === effect.type && entry.tag === effect.tag
      );
      if (existing) {
        existing.endsAt = Math.max(existing.endsAt, now + durationMs);
        existing.source = effect.source ?? existing.source;
        if (effect.type === "slow") {
          existing.moveSpeedMultiplier = Math.min(
            existing.moveSpeedMultiplier,
            moveSpeedMultiplier
          );
        } else if (effect.type === "root") {
          existing.moveSpeedMultiplier = 0;
        }
        existing.dotDamagePerSecond = Math.max(
          existing.dotDamagePerSecond,
          dotDamagePerSecond
        );
        return true;
      }
    }

    activeEffects.push({
      id: nextId,
      type: effect.type,
      source: effect.source,
      tag: effect.tag,
      endsAt: now + durationMs,
      moveSpeedMultiplier:
        effect.type === "root" ? 0 : moveSpeedMultiplier,
      dotDamagePerSecond,
    });
    nextId += 1;
    return true;
  };

  const update = (now: number, delta: number) => {
    pruneExpired(now);
    if (delta <= 0) return;

    for (let i = 0; i < activeEffects.length; i += 1) {
      const effect = activeEffects[i];
      if (effect.type !== "dot") continue;
      if (effect.dotDamagePerSecond <= 0) continue;
      applyDamage(effect.dotDamagePerSecond * delta);
    }
    pruneExpired(now);
  };

  const getMovementSpeedMultiplier = (now: number = performance.now()) => {
    pruneExpired(now);
    let multiplier = 1;
    for (let i = 0; i < activeEffects.length; i += 1) {
      const effect = activeEffects[i];
      if (effect.type === "root") return 0;
      if (effect.type === "slow") {
        multiplier = Math.min(multiplier, effect.moveSpeedMultiplier);
      }
    }
    return THREE.MathUtils.clamp(multiplier, 0, 1);
  };

  const isActive = (
    type: StatusEffectType,
    now: number = performance.now()
  ) => {
    pruneExpired(now);
    return activeEffects.some((entry) => entry.type === type);
  };

  const clear = () => {
    activeEffects.length = 0;
  };

  const clearBySource = (source: string) => {
    if (!source) return 0;
    let removed = 0;
    for (let i = activeEffects.length - 1; i >= 0; i -= 1) {
      if (activeEffects[i].source !== source) continue;
      activeEffects.splice(i, 1);
      removed += 1;
    }
    return removed;
  };

  return {
    apply,
    update,
    getMovementSpeedMultiplier,
    isActive,
    clear,
    clearBySource,
  };
};
