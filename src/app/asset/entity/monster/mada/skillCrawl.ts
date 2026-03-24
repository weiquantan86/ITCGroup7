import * as THREE from "three";

const normalizePositive = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
};

export const MADA_CRAWL_DETECTION_RANGE = 9;
export const MADA_CRAWL_COOLDOWN_MS = 7000;
export const MADA_CRAWL_DAMAGE = 10;
export const MADA_CRAWL_DAMAGE_RANGE = 2.8;
export const MADA_CRAWL_WINDUP_RATIO = 0.28;
export const MADA_CRAWL_STRIKE_RATIO = 0.44;
export const MADA_CRAWL_EMIT_INTERVAL_MS = 45;
export const MADA_CRAWL_DAMAGE_RATIO = 0.55;

export const MADA_AMBUSH_CRAWL_DAMAGE = 1;
export const MADA_AMBUSH_CRAWL_CLAW_HIT_RANGE = 0.78;
export const MADA_AMBUSH_CRAWL_REFERENCE_HIT_RANGE = 0.58;

export const resolveMadaCrawlRuntimeValues = ({
  strikeRangeMultiplier,
}: {
  strikeRangeMultiplier: number;
}) => {
  const normalizedStrikeRangeMultiplier = normalizePositive(
    strikeRangeMultiplier,
    1
  );
  return {
    damage: MADA_CRAWL_DAMAGE,
    damageRange: MADA_CRAWL_DAMAGE_RANGE * normalizedStrikeRangeMultiplier,
    cooldownMs: MADA_CRAWL_COOLDOWN_MS,
  };
};

export const isMadaCrawlStrikeWindow = (progress: number) => {
  const strikeStart = MADA_CRAWL_WINDUP_RATIO;
  const strikeEnd = MADA_CRAWL_WINDUP_RATIO + MADA_CRAWL_STRIKE_RATIO;
  return progress >= strikeStart && progress < strikeEnd;
};

export const isMadaCrawlDamageHit = ({
  strikeOrigin,
  target,
  maxRange,
}: {
  strikeOrigin: THREE.Vector3;
  target: THREE.Vector3;
  maxRange: number;
}) => strikeOrigin.distanceTo(target) <= maxRange;

export const canApplyMadaAmbushCrawlDamage = ({
  clawPosition,
  referencePosition,
  hasReferencePosition,
  targetPosition,
  clawHitRange = MADA_AMBUSH_CRAWL_CLAW_HIT_RANGE,
  referenceHitRange = MADA_AMBUSH_CRAWL_REFERENCE_HIT_RANGE,
}: {
  clawPosition: THREE.Vector3;
  referencePosition: THREE.Vector3;
  hasReferencePosition: boolean;
  targetPosition: THREE.Vector3;
  clawHitRange?: number;
  referenceHitRange?: number;
}) => {
  const clawToPlayerDistance = clawPosition.distanceTo(targetPosition);
  if (clawToPlayerDistance > clawHitRange) return false;
  if (!hasReferencePosition) return false;
  return referencePosition.distanceTo(targetPosition) <= referenceHitRange;
};
