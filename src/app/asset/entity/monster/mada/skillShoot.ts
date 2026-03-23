import * as THREE from "three";
import type { PlayerWorldTickArgs } from "../../character/general/player";
import type { ProjectileBlockHitHandler } from "../../../object/projectile/blocking";
import { createMadaShootProjectileRuntime } from "../../../object/projectile/projectile/mada/shootProjectileRuntime";

const MADA_SHOOT_SECOND_SEGMENT_DELAY_MS = 210;
const MADA_SHOOT_RAISE_SPEED_THRESHOLD = 0.62;
const MADA_SHOOT_STATIC_SPEED_THRESHOLD = 0.2;
const MADA_SHOOT_FINISH_GRACE_MS = 90;

type BeginCastArgs = {
  now: number;
  durationMs: number;
};

type TickArgs = {
  now: number;
  delta: number;
  rig: THREE.Object3D;
  player: PlayerWorldTickArgs["player"];
  applyDamage: PlayerWorldTickArgs["applyDamage"];
  projectileBlockers: PlayerWorldTickArgs["projectileBlockers"];
  handleProjectileBlockHit?: ProjectileBlockHitHandler;
  getHandLFrontWorldPosition: (
    target: THREE.Vector3,
    forwardOffset?: number
  ) => boolean;
  isShootPlaying: () => boolean;
};

const probeHand = new THREE.Vector3();

export const createMadaSkillShootRuntime = (scene: THREE.Scene) => {
  const projectileRuntime = createMadaShootProjectileRuntime(scene);

  let castActive = false;
  let castEndsAt = 0;
  let raisedDetected = false;
  let staticStartedAt = -1;
  let secondSegmentFired = false;
  let hasPrevHandSample = false;
  const previousHandPosition = new THREE.Vector3();

  const maybeFireSegments = (
    now: number,
    delta: number,
    currentHandPosition: THREE.Vector3 | null
  ) => {
    if (!castActive || !currentHandPosition) return;

    if (hasPrevHandSample) {
      const handSpeed =
        currentHandPosition.distanceTo(previousHandPosition) /
        Math.max(0.0001, delta);
      if (handSpeed >= MADA_SHOOT_RAISE_SPEED_THRESHOLD) {
        raisedDetected = true;
      }
      const staticNow =
        raisedDetected && handSpeed <= MADA_SHOOT_STATIC_SPEED_THRESHOLD;

      if (staticNow && staticStartedAt < 0) {
        staticStartedAt = now;
        projectileRuntime.spawnChargedProjectile(now, currentHandPosition);
      }

      if (
        staticStartedAt >= 0 &&
        !secondSegmentFired &&
        staticNow &&
        now - staticStartedAt >= MADA_SHOOT_SECOND_SEGMENT_DELAY_MS
      ) {
        projectileRuntime.spawnChargedProjectile(now, currentHandPosition);
        secondSegmentFired = true;
      }
    }

    previousHandPosition.copy(currentHandPosition);
    hasPrevHandSample = true;
  };

  return {
    beginCast: ({ now, durationMs }: BeginCastArgs) => {
      castActive = true;
      castEndsAt = now + Math.max(200, durationMs + MADA_SHOOT_FINISH_GRACE_MS);
      raisedDetected = false;
      staticStartedAt = -1;
      secondSegmentFired = false;
      hasPrevHandSample = false;
    },
    isCasting: () => castActive,
    tick: ({
      now,
      delta,
      rig,
      player,
      applyDamage,
      projectileBlockers,
      handleProjectileBlockHit,
      getHandLFrontWorldPosition,
      isShootPlaying,
    }: TickArgs) => {
      const shootPlaying = isShootPlaying();
      let handPosition: THREE.Vector3 | null = null;
      if (shootPlaying && getHandLFrontWorldPosition(probeHand, 0.36)) {
        handPosition = probeHand;
      }
      if (castActive && shootPlaying) {
        maybeFireSegments(now, delta, handPosition);
      }

      if (castActive && !shootPlaying && now >= castEndsAt) {
        castActive = false;
      }

      projectileRuntime.update({
        now,
        delta,
        rig,
        player,
        applyDamage,
        getHandLFrontWorldPosition,
        projectileBlockers,
        handleProjectileBlockHit,
      });
    },
    reset: () => {
      castActive = false;
      castEndsAt = 0;
      raisedDetected = false;
      staticStartedAt = -1;
      secondSegmentFired = false;
      hasPrevHandSample = false;
      projectileRuntime.clear();
    },
    dispose: () => {
      projectileRuntime.dispose();
    },
  };
};

