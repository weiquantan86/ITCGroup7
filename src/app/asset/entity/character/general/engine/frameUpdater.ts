import * as THREE from "three";
import { clampToBounds, resolveInputDirection } from "../player/movement";
import { filterWorldOnlyProjectileBlockers } from "../../../../object/projectile/blocking";
import type { PlayerLookState } from "./input";
import type { CharacterRuntime, CharacterStats } from "../types";
import type { CharacterVisualState } from "./characterLoader";
import type { PlayerLookOverride, PlayerWorldTickArgs } from "./types";
import type { createPlayerStatsState } from "../player/statsState";
import type { createPlayerCameraRig } from "./cameraRig";
import type { createProjectileSystem } from "../combat/projectileSystem";
import type { createPlayerSurvivalState } from "../combat/survival";
import type { createPlayerStatusEffectState } from "../combat/statusEffects";

type PlayerStatsState = ReturnType<typeof createPlayerStatsState>;
type PlayerCameraRig = ReturnType<typeof createPlayerCameraRig>;
type PlayerProjectileSystem = ReturnType<typeof createProjectileSystem>;
type PlayerSurvivalState = ReturnType<typeof createPlayerSurvivalState>;
type PlayerStatusEffectState = ReturnType<typeof createPlayerStatusEffectState>;

type PlayerMovementBlockerUserData = {
  playerBlocker?: boolean;
};

type CreatePlayerFrameUpdaterArgs = {
  avatar: THREE.Group;
  lookPivot: THREE.Group;
  camera: THREE.PerspectiveCamera;
  pressedKeys: Set<string>;
  lookState: PlayerLookState;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } | undefined;
  groundY: number;
  gravity: number;
  statsState: PlayerStatsState;
  cameraRig: PlayerCameraRig;
  projectileSystem: PlayerProjectileSystem;
  getRuntime: () => CharacterRuntime | null;
  isWorldInputLocked: () => boolean;
  getWorldLookOverride: (now: number) => PlayerLookOverride | null;
  getVisualState: () => CharacterVisualState;
  getSurvivalState: () => PlayerSurvivalState | null;
  getStatusEffectState: () => PlayerStatusEffectState | null;
  getProjectileBlockers: () => THREE.Object3D[];
  isBlocked: (x: number, z: number) => boolean;
  worldTick?: (args: PlayerWorldTickArgs) => void;
  emitUiState: (now: number) => void;
};

export const createPlayerFrameUpdater = ({
  avatar,
  lookPivot,
  camera,
  pressedKeys,
  lookState,
  bounds,
  groundY,
  gravity,
  statsState,
  cameraRig,
  projectileSystem,
  getRuntime,
  isWorldInputLocked,
  getWorldLookOverride,
  getVisualState,
  getSurvivalState,
  getStatusEffectState,
  getProjectileBlockers,
  isBlocked,
  worldTick,
  emitUiState,
}: CreatePlayerFrameUpdaterArgs) => {
  const DASH_STAMINA_COST = 25;
  const DASH_DISTANCE = 3.5;
  const DASH_DURATION_SECONDS = 0.16;
  const DASH_SPEED = DASH_DISTANCE / DASH_DURATION_SECONDS;
  const miniOrbitYawRotateSpeed = 1.8;
  const miniOrbitPitchRotateSpeed = 1.35;
  const miniOrbitDistanceAdjustSpeed = 3.2;
  const maxFacingTurnRate = Math.PI * 7;
  const miniOrbitPitchMinOffset = -0.85;
  const miniOrbitPitchMaxOffset = 0.85;
  const miniOrbitDistanceMinOffset = -2;
  const miniOrbitDistanceMaxOffset = 6;
  const maxLookYawSpeed = Math.PI * 6.5;
  const maxLookPitchSpeed = Math.PI * 5;
  let velocityY = 0;
  let isGrounded = true;
  let miniOrbitYawOffset = 0;
  let miniOrbitPitchOffset = 0;
  let miniOrbitDistanceOffset = 0;
  const moveDir = new THREE.Vector3();
  const dashDirection = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const worldTickCurrentStatsSnapshot: CharacterStats = {
    health: 0,
    stamina: 0,
    mana: 0,
    energy: 0,
  };
  const worldTickMaxStatsSnapshot: CharacterStats = {
    health: 0,
    stamina: 0,
    mana: 0,
    energy: 0,
  };
  const projectileSystemBlockers: THREE.Object3D[] = [];
  const cameraAimOriginWorld = new THREE.Vector3();
  const runtimeAimDirection = new THREE.Vector3();
  const movementBlockerBounds = new THREE.Box3();
  const movementBlockerPadding = 0.24;
  const cameraScaleSmoothRate = 10;
  let smoothedCameraScaleMultiplier = 1;
  let dashRequested = false;
  let dashRemainingDistance = 0;
  const hasPlayerBlockerFlag = (object: THREE.Object3D | null | undefined) => {
    let current = object ?? null;
    while (current) {
      const userData = current.userData as PlayerMovementBlockerUserData;
      if (userData.playerBlocker) return true;
      current = current.parent;
    }
    return false;
  };
  const isRuntimeMovementBlocked = (x: number, z: number) => {
    const blockers = getProjectileBlockers();
    if (!blockers.length) return false;
    for (let i = 0; i < blockers.length; i += 1) {
      const blocker = blockers[i];
      if (!hasPlayerBlockerFlag(blocker)) continue;
      movementBlockerBounds.setFromObject(blocker);
      if (movementBlockerBounds.isEmpty()) continue;
      if (
        x >= movementBlockerBounds.min.x - movementBlockerPadding &&
        x <= movementBlockerBounds.max.x + movementBlockerPadding &&
        z >= movementBlockerBounds.min.z - movementBlockerPadding &&
        z <= movementBlockerBounds.max.z + movementBlockerPadding
      ) {
        return true;
      }
    }
    return false;
  };
  const applyLookOverride = (
    override: PlayerLookOverride | null,
    delta: number
  ) => {
    if (!override) return;
    const blend = THREE.MathUtils.clamp(
      override.blend ?? Math.max(0.08, Math.min(1, delta * 7)),
      0,
      1
    );
    if (typeof override.yaw === "number" && Number.isFinite(override.yaw)) {
      const yawDelta =
        THREE.MathUtils.euclideanModulo(
          override.yaw - lookState.yaw + Math.PI,
          Math.PI * 2
        ) - Math.PI;
      lookState.yaw += yawDelta * blend;
    }
    if (typeof override.pitch === "number" && Number.isFinite(override.pitch)) {
      const targetPitch = THREE.MathUtils.clamp(
        override.pitch,
        lookState.minPitch,
        lookState.maxPitch
      );
      lookState.pitch = THREE.MathUtils.lerp(lookState.pitch, targetPitch, blend);
    }
  };

  const getMovementSpeedMultiplier = (runtime: CharacterRuntime | null) => {
    const multiplier = runtime?.getMovementSpeedMultiplier?.();
    if (multiplier == null || !Number.isFinite(multiplier)) return 1;
    return Math.max(0, multiplier);
  };

  const getCameraScaleMultiplier = (runtime: CharacterRuntime | null) => {
    const multiplier = runtime?.getCameraScaleMultiplier?.();
    if (multiplier == null || !Number.isFinite(multiplier)) return 1;
    return THREE.MathUtils.clamp(multiplier, 0.2, 6);
  };

  const resolveSmoothedCameraScaleMultiplier = (target: number, delta: number) => {
    const safeTarget = THREE.MathUtils.clamp(target, 0.2, 6);
    if (
      !Number.isFinite(smoothedCameraScaleMultiplier) ||
      smoothedCameraScaleMultiplier <= 0
    ) {
      smoothedCameraScaleMultiplier = safeTarget;
      return smoothedCameraScaleMultiplier;
    }
    const safeDelta = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    if (safeDelta <= 0) {
      smoothedCameraScaleMultiplier = safeTarget;
      return smoothedCameraScaleMultiplier;
    }
    const alpha = THREE.MathUtils.clamp(
      1 - Math.exp(-cameraScaleSmoothRate * safeDelta),
      0,
      1
    );
    smoothedCameraScaleMultiplier = THREE.MathUtils.lerp(
      smoothedCameraScaleMultiplier,
      safeTarget,
      alpha
    );
    return smoothedCameraScaleMultiplier;
  };

  const applyPendingLookDelta = (delta: number) => {
    if (delta <= 0) return;

    const maxYawStep = maxLookYawSpeed * delta;
    const yawStep = THREE.MathUtils.clamp(
      lookState.pendingYawDelta,
      -maxYawStep,
      maxYawStep
    );
    lookState.yaw += yawStep;
    lookState.pendingYawDelta -= yawStep;
    if (Math.abs(lookState.pendingYawDelta) < 0.0001) {
      lookState.pendingYawDelta = 0;
    }

    const maxPitchStep = maxLookPitchSpeed * delta;
    const pitchStep = THREE.MathUtils.clamp(
      lookState.pendingPitchDelta,
      -maxPitchStep,
      maxPitchStep
    );
    lookState.pitch = THREE.MathUtils.clamp(
      lookState.pitch + pitchStep,
      lookState.minPitch,
      lookState.maxPitch
    );
    lookState.pendingPitchDelta -= pitchStep;
    if (Math.abs(lookState.pendingPitchDelta) < 0.0001) {
      lookState.pendingPitchDelta = 0;
    }
  };

  const update = (now: number, delta: number) => {
    const runtime = getRuntime();
    const visualState = getVisualState();
    const survivalState = getSurvivalState();
    const statusEffectState = getStatusEffectState();
    statusEffectState?.update(now, delta);
    applyPendingLookDelta(delta);
    applyLookOverride(getWorldLookOverride(now), delta);
    const movementLocked =
      isWorldInputLocked() || Boolean(runtime?.isMovementLocked?.());
    const hasMoveInput = movementLocked
      ? false
      : resolveInputDirection({
          pressedKeys,
          lookState,
          out: moveDir,
          forward,
          right,
        });
    const shiftHeld = pressedKeys.has("shift");
    const canSprint =
      shiftHeld &&
      !statsState.staminaLocked &&
      statsState.currentStats.stamina > 0;
    const miniOrbitYawInput =
      (pressedKeys.has("z") ? 1 : 0) + (pressedKeys.has("x") ? -1 : 0);
    if (miniOrbitYawInput !== 0) {
      miniOrbitYawOffset += miniOrbitYawInput * miniOrbitYawRotateSpeed * delta;
    }
    const miniOrbitPitchInput =
      (pressedKeys.has("c") ? 1 : 0) + (pressedKeys.has("v") ? -1 : 0);
    if (miniOrbitPitchInput !== 0) {
      miniOrbitPitchOffset = THREE.MathUtils.clamp(
        miniOrbitPitchOffset + miniOrbitPitchInput * miniOrbitPitchRotateSpeed * delta,
        miniOrbitPitchMinOffset,
        miniOrbitPitchMaxOffset
      );
    }
    const miniOrbitDistanceInput =
      (pressedKeys.has("b") ? 1 : 0) + (pressedKeys.has("n") ? -1 : 0);
    if (miniOrbitDistanceInput !== 0) {
      miniOrbitDistanceOffset = THREE.MathUtils.clamp(
        miniOrbitDistanceOffset +
          miniOrbitDistanceInput * miniOrbitDistanceAdjustSpeed * delta,
        miniOrbitDistanceMinOffset,
        miniOrbitDistanceMaxOffset
      );
    }
    let isMoving = false;

    if (hasMoveInput) {
      const speedBoost = canSprint ? statsState.movementConfig.sprintMultiplier : 1;
      const moveSpeedMultiplier = getMovementSpeedMultiplier(runtime);
      const statusMovementSpeedMultiplier =
        statusEffectState?.getMovementSpeedMultiplier(now) ?? 1;
      const moveSpeed =
        statsState.movementConfig.baseSpeed *
        speedBoost *
        moveSpeedMultiplier *
        statusMovementSpeedMultiplier *
        delta;
      const nextX = avatar.position.x + moveDir.x * moveSpeed;
      const nextZ = avatar.position.z + moveDir.z * moveSpeed;
      const clamped = clampToBounds(bounds, nextX, nextZ);
      if (
        !isBlocked(clamped.x, clamped.z) &&
        !isRuntimeMovementBlocked(clamped.x, clamped.z)
      ) {
        avatar.position.x = clamped.x;
        avatar.position.z = clamped.z;
        isMoving = true;
      }
    }

    if (dashRequested) {
      dashRequested = false;
      if (hasMoveInput && !movementLocked && dashRemainingDistance <= 0) {
        const currentStamina = statsState.currentStats.stamina;
        if (!statsState.staminaLocked && currentStamina >= DASH_STAMINA_COST) {
          const spent = statsState.spendStamina(DASH_STAMINA_COST);
          if (spent >= DASH_STAMINA_COST - 0.0001) {
            dashDirection.copy(moveDir).normalize();
            dashRemainingDistance = DASH_DISTANCE;
          }
        }
      }
    }

    if (dashRemainingDistance > 0) {
      const dashStep = Math.max(0, DASH_SPEED * Math.max(0, delta));
      const moveStep = Math.min(dashRemainingDistance, dashStep);
      if (moveStep > 0.000001) {
        const nextX = avatar.position.x + dashDirection.x * moveStep;
        const nextZ = avatar.position.z + dashDirection.z * moveStep;
        const clamped = clampToBounds(bounds, nextX, nextZ);
        if (
          !isBlocked(clamped.x, clamped.z) &&
          !isRuntimeMovementBlocked(clamped.x, clamped.z)
        ) {
          avatar.position.x = clamped.x;
          avatar.position.z = clamped.z;
          dashRemainingDistance -= moveStep;
          isMoving = true;
        } else {
          dashRemainingDistance = 0;
        }
      } else {
        dashRemainingDistance = 0;
      }
    }

    const isDashing = dashRemainingDistance > 0;
    const isSprinting = isMoving && canSprint && !isDashing;

    velocityY += gravity * delta;
    avatar.position.y += velocityY * delta;
    const resolvedGroundY = groundY + visualState.modelFootOffset;
    if (avatar.position.y <= resolvedGroundY) {
      avatar.position.y = resolvedGroundY;
      velocityY = 0;
      isGrounded = true;
    } else {
      isGrounded = false;
    }

    if (!runtime?.isFacingLocked?.()) {
      const currentYaw = avatar.rotation.y;
      const targetYaw = lookState.yaw;
      const yawDelta =
        THREE.MathUtils.euclideanModulo(targetYaw - currentYaw + Math.PI, Math.PI * 2) -
        Math.PI;
      const maxStep = Math.max(0, maxFacingTurnRate * delta);
      if (Math.abs(yawDelta) <= maxStep) {
        avatar.rotation.y = targetYaw;
      } else {
        avatar.rotation.y = currentYaw + Math.sign(yawDelta) * maxStep;
      }
    }

    const headPitch = THREE.MathUtils.clamp(-lookState.pitch, -0.8, 0.8);
    if (visualState.headBone) {
      if (visualState.headBoneRest) {
        visualState.headBone.quaternion.copy(visualState.headBoneRest);
        visualState.headBone.rotateX(headPitch);
      } else {
        visualState.headBone.rotation.x = headPitch;
      }
      lookPivot.rotation.x = 0;
    } else {
      lookPivot.rotation.x = headPitch * 0.35;
    }

    const cameraScaleMultiplier = resolveSmoothedCameraScaleMultiplier(
      getCameraScaleMultiplier(runtime),
      delta
    );
    runtimeAimDirection.set(
      Math.sin(lookState.yaw) * Math.cos(lookState.pitch),
      Math.sin(lookState.pitch),
      Math.cos(lookState.yaw) * Math.cos(lookState.pitch)
    );

    runtime?.update({
      now,
      isMoving,
      isSprinting,
      aimOriginWorld: camera.getWorldPosition(cameraAimOriginWorld),
      aimDirectionWorld: runtimeAimDirection,
      arms: visualState.arms,
      legLeft: visualState.legLeft,
      legRight: visualState.legRight,
      avatarModel: visualState.avatarModel,
    });
    runtime?.onTick?.({
      now,
      delta,
      isMoving,
      isSprinting,
    });
    const runtimeCameraFollowTarget = runtime?.getCameraFollowTarget?.() ?? null;
    cameraRig.update({
      avatar,
      eyeHeight: visualState.eyeHeight * cameraScaleMultiplier,
      delta,
      lookState,
      miniOrbitYawOffset,
      miniOrbitPitchOffset,
      miniOrbitDistanceOffset,
      followTarget: runtimeCameraFollowTarget,
      followHeadBone: statsState.cameraConfig.followHeadBone,
      miniBehindDistance:
        statsState.cameraConfig.miniBehindDistance * cameraScaleMultiplier,
      miniUpDistance: statsState.cameraConfig.miniUpDistance * cameraScaleMultiplier,
      miniLookUpOffset: statsState.cameraConfig.miniLookUpOffset * cameraScaleMultiplier,
      headBone: visualState.headBone,
    });

    const runtimeProjectileBlockers = getProjectileBlockers();
    filterWorldOnlyProjectileBlockers(runtimeProjectileBlockers, projectileSystemBlockers);
    survivalState?.applyRecoveryZones(now);
    projectileSystem.update({
      now,
      delta,
      projectileBlockers: projectileSystemBlockers,
      handleProjectileBlockHit: runtime?.handleProjectileBlockHit,
    });

    if (worldTick) {
      worldTickCurrentStatsSnapshot.health = statsState.currentStats.health;
      worldTickCurrentStatsSnapshot.stamina = statsState.currentStats.stamina;
      worldTickCurrentStatsSnapshot.mana = statsState.currentStats.mana;
      worldTickCurrentStatsSnapshot.energy = statsState.currentStats.energy;
      worldTickMaxStatsSnapshot.health = statsState.maxStats.health;
      worldTickMaxStatsSnapshot.stamina = statsState.maxStats.stamina;
      worldTickMaxStatsSnapshot.mana = statsState.maxStats.mana;
      worldTickMaxStatsSnapshot.energy = statsState.maxStats.energy;
      worldTick({
        now,
        delta,
        player: avatar,
        camera,
        currentStats: worldTickCurrentStatsSnapshot,
        maxStats: worldTickMaxStatsSnapshot,
        applyDamage: (amount) => survivalState?.applyDamageToPlayer(amount) ?? 0,
        applyStatusEffect: (effect) =>
          statusEffectState?.apply(effect, now) ?? false,
        clearStatusEffectsBySource: (source) =>
          statusEffectState?.clearBySource(source) ?? 0,
        projectileBlockers: runtimeProjectileBlockers,
        handleProjectileBlockHit: runtime?.handleProjectileBlockHit,
      });
    }

    statsState.applyPassiveRegen(delta, isMoving, isSprinting);
    statsState.syncHud();
    emitUiState(now);
  };

  const resetKinematics = () => {
    velocityY = 0;
    isGrounded = true;
    miniOrbitYawOffset = 0;
    miniOrbitPitchOffset = 0;
    miniOrbitDistanceOffset = 0;
    smoothedCameraScaleMultiplier = 1;
    dashRequested = false;
    dashRemainingDistance = 0;
    dashDirection.set(0, 0, 0);
  };

  const jump = (jumpVelocity: number) => {
    velocityY = jumpVelocity;
    isGrounded = false;
  };

  return {
    update,
    resetKinematics,
    jump,
    requestDash: () => {
      dashRequested = true;
    },
    isGrounded: () => isGrounded,
  };
};



