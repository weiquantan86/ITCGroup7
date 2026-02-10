import * as THREE from "three";
import { clampToBounds, resolveInputDirection } from "./movement";
import type { PlayerLookState } from "./input";
import type { CharacterRuntime, CharacterStats } from "../types";
import type { CharacterVisualState } from "./characterLoader";
import type { PlayerWorldTickArgs } from "./types";
import type { createPlayerStatsState } from "./statsState";
import type { createPlayerCameraRig } from "./cameraRig";
import type { createProjectileSystem } from "./projectileSystem";
import type { createPlayerSurvivalState } from "./survival";

type PlayerStatsState = ReturnType<typeof createPlayerStatsState>;
type PlayerCameraRig = ReturnType<typeof createPlayerCameraRig>;
type PlayerProjectileSystem = ReturnType<typeof createProjectileSystem>;
type PlayerSurvivalState = ReturnType<typeof createPlayerSurvivalState>;

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
  getVisualState: () => CharacterVisualState;
  getSurvivalState: () => PlayerSurvivalState | null;
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
  getVisualState,
  getSurvivalState,
  getProjectileBlockers,
  isBlocked,
  worldTick,
  emitUiState,
}: CreatePlayerFrameUpdaterArgs) => {
  let velocityY = 0;
  let isGrounded = true;
  const moveDir = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const worldTickCurrentStatsSnapshot: CharacterStats = {
    health: 0,
    mana: 0,
    energy: 0,
  };
  const worldTickMaxStatsSnapshot: CharacterStats = {
    health: 0,
    mana: 0,
    energy: 0,
  };
  const projectileSystemBlockers: THREE.Object3D[] = [];

  const getMovementSpeedMultiplier = (runtime: CharacterRuntime | null) => {
    const multiplier = runtime?.getMovementSpeedMultiplier?.();
    if (multiplier == null || !Number.isFinite(multiplier)) return 1;
    return Math.max(0, multiplier);
  };

  const update = (now: number, delta: number) => {
    const runtime = getRuntime();
    const visualState = getVisualState();
    const survivalState = getSurvivalState();
    const movementLocked = Boolean(runtime?.isMovementLocked?.());
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
    let isMoving = false;

    if (hasMoveInput) {
      const speedBoost = shiftHeld ? statsState.movementConfig.sprintMultiplier : 1;
      const moveSpeedMultiplier = getMovementSpeedMultiplier(runtime);
      const moveSpeed =
        statsState.movementConfig.baseSpeed *
        speedBoost *
        moveSpeedMultiplier *
        delta;
      const nextX = avatar.position.x + moveDir.x * moveSpeed;
      const nextZ = avatar.position.z + moveDir.z * moveSpeed;
      const clamped = clampToBounds(bounds, nextX, nextZ);
      if (!isBlocked(clamped.x, clamped.z)) {
        avatar.position.x = clamped.x;
        avatar.position.z = clamped.z;
        isMoving = true;
      }
    }
    const isSprinting = isMoving && shiftHeld;

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
      avatar.rotation.y = lookState.yaw;
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

    const cameraLookDir = cameraRig.update({
      avatar,
      eyeHeight: visualState.eyeHeight,
      lookState,
      followHeadBone: statsState.cameraConfig.followHeadBone,
      headBone: visualState.headBone,
    });

    runtime?.update({
      now,
      isMoving,
      isSprinting,
      aimDirectionWorld: cameraLookDir,
      arms: visualState.arms,
      legLeft: visualState.legLeft,
      legRight: visualState.legRight,
      avatarModel: visualState.avatarModel,
    });

    const runtimeProjectileBlockers = getProjectileBlockers();
    projectileSystemBlockers.length = 0;
    for (let i = 0; i < runtimeProjectileBlockers.length; i += 1) {
      const blocker = runtimeProjectileBlockers[i];
      const blockerUserData = blocker.userData as {
        worldOnlyBlocker?: boolean;
      };
      if (blockerUserData.worldOnlyBlocker) continue;
      projectileSystemBlockers.push(blocker);
    }
    survivalState?.applyRecoveryZones(now);
    projectileSystem.update({
      now,
      delta,
      projectileBlockers: projectileSystemBlockers,
      handleProjectileBlockHit: runtime?.handleProjectileBlockHit,
    });

    if (worldTick) {
      worldTickCurrentStatsSnapshot.health = statsState.currentStats.health;
      worldTickCurrentStatsSnapshot.mana = statsState.currentStats.mana;
      worldTickCurrentStatsSnapshot.energy = statsState.currentStats.energy;
      worldTickMaxStatsSnapshot.health = statsState.maxStats.health;
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
        projectileBlockers: runtimeProjectileBlockers,
      });
    }

    statsState.applyPassiveRegen(delta, isMoving);
    statsState.syncHud();
    emitUiState(now);
  };

  const resetKinematics = () => {
    velocityY = 0;
    isGrounded = true;
  };

  const jump = (jumpVelocity: number) => {
    velocityY = jumpVelocity;
    isGrounded = false;
  };

  return {
    update,
    resetKinematics,
    jump,
    isGrounded: () => isGrounded,
  };
};
