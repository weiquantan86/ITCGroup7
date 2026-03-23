import * as THREE from "three";

type MadaBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type CreateMadaVanishManagerArgs = {
  bounds: MadaBounds;
  isBlocked: (x: number, z: number) => boolean;
  edgePadding?: number;
  vanishIntervalMs?: number;
  fadeDurationMs?: number;
  hiddenDurationMs?: number;
};

type MadaVanishPhase = "idle" | "pending" | "lookup" | "fading" | "hidden";

type MadaVanishRequestOptions = {
  skipLookup?: boolean;
};

export type MadaVanishManagerUpdateArgs = {
  now: number;
  skillActive: boolean;
  fallbackPosition: THREE.Vector3;
  groundY: number;
  playLookup: () => number;
  isLookupPlaying: () => boolean;
  hide: () => void;
  revealAt: (position: THREE.Vector3, now: number) => void;
};

export type MadaVanishManagerUpdateResult = {
  blockNewSkills: boolean;
  hidden: boolean;
  fadeAlpha: number;
  phase: MadaVanishPhase;
};

const EDGE_PADDING_DEFAULT = 5;
const VANISH_INTERVAL_MS_DEFAULT = 5000;
const FADE_DURATION_MS_DEFAULT = 420;
const HIDDEN_DURATION_MS_DEFAULT = 500;
const LOOKUP_FINISH_GRACE_MS = 90;
const MAX_RESPAWN_ATTEMPTS = 36;

const resolveRangedClamp = (min: number, max: number, padding: number) => {
  const paddedMin = min + padding;
  const paddedMax = max - padding;
  if (paddedMin <= paddedMax) {
    return { min: paddedMin, max: paddedMax };
  }
  const center = (min + max) * 0.5;
  return { min: center, max: center };
};

const sampleInRange = (min: number, max: number) =>
  min + (max - min) * Math.random();

export const createMadaVanishManager = ({
  bounds,
  isBlocked,
  edgePadding = EDGE_PADDING_DEFAULT,
  vanishIntervalMs = VANISH_INTERVAL_MS_DEFAULT,
  fadeDurationMs = FADE_DURATION_MS_DEFAULT,
  hiddenDurationMs = HIDDEN_DURATION_MS_DEFAULT,
}: CreateMadaVanishManagerArgs) => {
  const rangeX = resolveRangedClamp(bounds.minX, bounds.maxX, edgePadding);
  const rangeZ = resolveRangedClamp(bounds.minZ, bounds.maxZ, edgePadding);
  const respawnPosition = new THREE.Vector3();

  let phase: MadaVanishPhase = "idle";
  let nextVanishAt = performance.now() + vanishIntervalMs;
  let lookupDeadlineAt = 0;
  let fadeStartedAt = 0;
  let hiddenUntilAt = 0;
  let pendingSkipLookup = false;

  const resolveRespawnPosition = (
    fallbackPosition: THREE.Vector3,
    groundY: number
  ) => {
    for (let i = 0; i < MAX_RESPAWN_ATTEMPTS; i += 1) {
      const x = sampleInRange(rangeX.min, rangeX.max);
      const z = sampleInRange(rangeZ.min, rangeZ.max);
      if (isBlocked(x, z)) continue;
      respawnPosition.set(x, groundY, z);
      return respawnPosition;
    }

    const fallbackX = Math.max(rangeX.min, Math.min(rangeX.max, fallbackPosition.x));
    const fallbackZ = Math.max(rangeZ.min, Math.min(rangeZ.max, fallbackPosition.z));
    if (!isBlocked(fallbackX, fallbackZ)) {
      respawnPosition.set(fallbackX, groundY, fallbackZ);
      return respawnPosition;
    }

    respawnPosition.set((rangeX.min + rangeX.max) * 0.5, groundY, (rangeZ.min + rangeZ.max) * 0.5);
    return respawnPosition;
  };

  const enterHidden = (
    now: number,
    fallbackPosition: THREE.Vector3,
    groundY: number,
    hide: () => void
  ) => {
    resolveRespawnPosition(fallbackPosition, groundY);
    phase = "hidden";
    hiddenUntilAt = now + hiddenDurationMs;
    hide();
  };

  const beginFade = (now: number) => {
    phase = "fading";
    fadeStartedAt = now;
  };

  const update = ({
    now,
    skillActive,
    fallbackPosition,
    groundY,
    playLookup,
    isLookupPlaying,
    hide,
    revealAt,
  }: MadaVanishManagerUpdateArgs): MadaVanishManagerUpdateResult => {
    if (phase === "idle" && now >= nextVanishAt) {
      phase = "pending";
    }

    if (phase === "pending" && !skillActive) {
      if (pendingSkipLookup) {
        pendingSkipLookup = false;
        beginFade(now);
      } else {
        const lookupDurationS = playLookup();
        if (lookupDurationS > 0) {
          phase = "lookup";
          lookupDeadlineAt =
            now + lookupDurationS * 1000 + LOOKUP_FINISH_GRACE_MS;
        } else {
          beginFade(now);
        }
      }
    }

    if (phase !== "pending") {
      pendingSkipLookup = false;
    }

    if (phase === "lookup") {
      if (!isLookupPlaying() || now >= lookupDeadlineAt) {
        beginFade(now);
      }
    }

    let fadeAlpha = 1;
    if (phase === "fading") {
      const progress = Math.max(
        0,
        Math.min(1, (now - fadeStartedAt) / Math.max(1, fadeDurationMs))
      );
      fadeAlpha = 1 - progress;
      if (progress >= 1) {
        enterHidden(now, fallbackPosition, groundY, hide);
      }
    }

    if (phase === "hidden" && now >= hiddenUntilAt) {
      revealAt(respawnPosition, now);
      phase = "idle";
      nextVanishAt = now + vanishIntervalMs;
    }

    return {
      blockNewSkills: phase !== "idle",
      hidden: phase === "hidden",
      fadeAlpha: phase === "hidden" ? 0 : fadeAlpha,
      phase,
    };
  };

  const reset = (now: number) => {
    phase = "idle";
    nextVanishAt = now + vanishIntervalMs;
    lookupDeadlineAt = 0;
    fadeStartedAt = 0;
    hiddenUntilAt = 0;
    pendingSkipLookup = false;
  };

  const requestVanishNow = (now: number, options?: MadaVanishRequestOptions) => {
    if (phase === "hidden") return;
    phase = "pending";
    nextVanishAt = now;
    lookupDeadlineAt = 0;
    fadeStartedAt = 0;
    hiddenUntilAt = 0;
    pendingSkipLookup = options?.skipLookup === true;
  };

  return {
    update,
    reset,
    requestVanishNow,
    getPhase: () => phase,
  };
};
