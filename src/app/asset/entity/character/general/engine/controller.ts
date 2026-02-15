import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HpPool } from "../../../hpPool";
import { getCharacterEntry } from "../player/registry";
import { bindPlayerInput } from "./input";
import { createStatusHud } from "./statusHud";
import { AttackTargetResolver } from "../combat/attackResolver";
import { createPlayerCameraRig } from "./cameraRig";
import { createProjectileSystem } from "../combat/projectileSystem";
import { createPlayerStatsState } from "../player/statsState";
import { createPlayerSkillState } from "../combat/skills";
import { createPlayerSurvivalState } from "../combat/survival";
import {
  createCharacterLoader,
  type CharacterVisualState,
} from "./characterLoader";
import { createPlayerFrameUpdater } from "./frameUpdater";
import { resolveWorldHooks } from "./worldHooks";
import type {
  PlayerController,
  PlayerUiState,
  PlayerWorld,
} from "./types";
import type {
  FireProjectileArgs,
  MeleeAttackArgs,
  CharacterRuntime,
  SkillKey,
} from "../types";

export const createPlayer = ({
  scene,
  mount,
  characterPath,
  world,
  gameMode = "default",
  hideLocalHead = true,
  hideLocalBody = false,
  showMiniMap = true,
  infiniteFire = false,
  onUiStateChange,
}: {
  scene: THREE.Scene;
  mount: HTMLElement;
  characterPath?: string;
  world?: PlayerWorld;
  gameMode?: string;
  hideLocalHead?: boolean;
  hideLocalBody?: boolean;
  showMiniMap?: boolean;
  infiniteFire?: boolean;
  onUiStateChange?: (state: PlayerUiState) => void;
}): PlayerController => {
  const withDevCacheBust = (path: string) => {
    if (process.env.NODE_ENV !== "development") return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}v=${Date.now()}`;
  };

  const resolvedWorld: PlayerWorld = {
    sceneId: world?.sceneId,
    groundY: world?.groundY ?? -1.4,
    playerSpawn: world?.playerSpawn,
    resetOnDeath: world?.resetOnDeath,
    isBlocked: world?.isBlocked,
    projectileColliders: world?.projectileColliders,
    recoveryZones: world?.recoveryZones,
    attackTargets: world?.attackTargets,
    onTick: world?.onTick,
    onPlayerDeath: world?.onPlayerDeath,
    onPlayerReset: world?.onPlayerReset,
    bounds: world?.bounds,
  };
  const { worldTick, worldPlayerDeath, worldPlayerReset } =
    resolveWorldHooks(resolvedWorld);
  const resetOnDeath = Boolean(resolvedWorld.resetOnDeath);

  const cameraRig = createPlayerCameraRig({
    mount,
    hideLocalHead,
    hideLocalBody,
    showMiniMap,
  });
  const camera = cameraRig.camera;
  const miniCamera = cameraRig.miniCamera;

  const pressedKeys = new Set<string>();
  const lookState = {
    yaw: 0,
    pitch: 0,
    minPitch: -1.2,
    maxPitch: 1.1,
    sensitivity: 0.002,
  };

  const gravity = -18;
  const jumpVelocity = 6.5;
  const headLayer = 1;
  const bodyLayer = 2;

  const attackTargets = resolvedWorld.attackTargets ?? [];
  const projectileColliders = resolvedWorld.projectileColliders ?? [];
  const recoveryZones = resolvedWorld.recoveryZones ?? [];
  const attackResolver = new AttackTargetResolver(attackTargets);
  const emptyProjectileBlockers: THREE.Object3D[] = [];
  const avatar = new THREE.Group();
  const lookPivot = new THREE.Group();
  avatar.add(lookPivot);
  const avatarBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 1.1, 6, 16),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.2,
    })
  );
  avatarBody.castShadow = true;
  avatarBody.position.y = 0.9;
  const avatarGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 20, 20),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.9,
    })
  );
  avatarGlow.position.set(0, 1.65, 0);
  lookPivot.add(avatarBody, avatarGlow);
  const playerSpawn = (
    resolvedWorld.playerSpawn ?? new THREE.Vector3(0, resolvedWorld.groundY, 6)
  ).clone();
  avatar.position.copy(playerSpawn);
  if (hideLocalBody) {
    avatarBody.layers.set(bodyLayer);
    avatarGlow.layers.set(bodyLayer);
  }
  scene.add(avatar);

  let isMounted = true;
  const visualState: CharacterVisualState = {
    avatarModel: null,
    arms: [],
    legLeft: null,
    legRight: null,
    headBone: null,
    headBoneRest: null,
    eyeHeight: 1.6,
    modelFootOffset: 0,
  };
  const playerHitFlashColor = new THREE.Color(0xff3b30);
  const playerHitFlashOriginalState = new Map<
    THREE.Material,
    {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    }
  >();
  const playerHitFlashMaterials = new Set<THREE.Material>();
  const playerHitFlashDurationMs = 110;
  let playerHitFlashUntil = 0;
  let playerHitFlashTimer: ReturnType<typeof setTimeout> | null = null;

  const isColorMaterial = (
    material: THREE.Material
  ): material is THREE.Material & { color: THREE.Color } => {
    return Boolean(
      (material as THREE.Material & { color?: THREE.Color }).color?.isColor
    );
  };

  const isEmissiveMaterial = (
    material: THREE.Material
  ): material is THREE.Material & {
    emissive: THREE.Color;
    emissiveIntensity: number;
  } => {
    const mat = material as THREE.Material & {
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    };
    return Boolean(mat.emissive?.isColor);
  };

  const savePlayerHitMaterialState = (material: THREE.Material) => {
    if (playerHitFlashOriginalState.has(material)) return;
    const state: {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    } = {};
    if (isColorMaterial(material)) {
      state.color = material.color.clone();
    }
    if (isEmissiveMaterial(material)) {
      state.emissive = material.emissive.clone();
      state.emissiveIntensity = material.emissiveIntensity;
    }
    playerHitFlashOriginalState.set(material, state);
  };

  const collectPlayerHitMaterials = (): THREE.Material[] => {
    const materials = new Set<THREE.Material>();
    const collectFromObject = (object: THREE.Object3D | null | undefined) => {
      if (!object) return;
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => {
            if (material) materials.add(material);
          });
        } else {
          materials.add(mesh.material);
        }
      });
    };
    collectFromObject(visualState.avatarModel);
    collectFromObject(avatarBody);
    collectFromObject(avatarGlow);
    return Array.from(materials);
  };

  const restorePlayerHitFlash = () => {
    playerHitFlashMaterials.forEach((material) => {
      const state = playerHitFlashOriginalState.get(material);
      if (!state) return;
      if (state.color && isColorMaterial(material)) {
        material.color.copy(state.color);
      }
      if (state.emissive && isEmissiveMaterial(material)) {
        material.emissive.copy(state.emissive);
        if (typeof state.emissiveIntensity === "number") {
          material.emissiveIntensity = state.emissiveIntensity;
        }
      }
    });
    playerHitFlashMaterials.clear();
  };

  const clearPlayerHitFlash = () => {
    if (playerHitFlashTimer) {
      clearTimeout(playerHitFlashTimer);
      playerHitFlashTimer = null;
    }
    playerHitFlashUntil = 0;
    restorePlayerHitFlash();
    playerHitFlashOriginalState.clear();
  };

  const schedulePlayerHitFlashRestore = () => {
    if (playerHitFlashTimer) {
      clearTimeout(playerHitFlashTimer);
      playerHitFlashTimer = null;
    }
    const delay = Math.max(0, playerHitFlashUntil - performance.now());
    playerHitFlashTimer = setTimeout(() => {
      playerHitFlashTimer = null;
      if (performance.now() < playerHitFlashUntil) {
        schedulePlayerHitFlashRestore();
        return;
      }
      restorePlayerHitFlash();
    }, delay);
  };

  const triggerPlayerHitFlash = () => {
    const materials = collectPlayerHitMaterials();
    if (!materials.length) return;
    materials.forEach((material) => {
      savePlayerHitMaterialState(material);
      if (isColorMaterial(material)) {
        material.color.copy(playerHitFlashColor);
      }
      if (isEmissiveMaterial(material)) {
        material.emissive.copy(playerHitFlashColor);
        material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.78);
      }
      playerHitFlashMaterials.add(material);
    });
    playerHitFlashUntil = performance.now() + playerHitFlashDurationMs;
    schedulePlayerHitFlashRestore();
  };

  const defaultCharacterPath = "/assets/characters/adam/adam.glb";
  let characterEntry = getCharacterEntry(characterPath || defaultCharacterPath);
  let characterRuntime: CharacterRuntime | null = null;

  const statusHud = createStatusHud(mount, { showMiniMap });
  const statsState = createPlayerStatsState({
    profile: characterEntry.profile,
    infiniteFire,
    statusHud,
    onUiStateChange,
  });
  const healthPool = new HpPool({
    max: statsState.maxStats.health,
    current: statsState.currentStats.health,
  });

  const getRuntimeProjectileBlockers = () => {
    const blockers = characterRuntime?.getProjectileBlockers?.();
    if (!blockers?.length) return emptyProjectileBlockers;
    return blockers;
  };

  const isRuntimeMovementLocked = () =>
    Boolean(characterRuntime?.isMovementLocked?.());

  const isRuntimeBasicAttackLocked = () =>
    Boolean(characterRuntime?.isBasicAttackLocked?.());

  const getRuntimeSkillCooldownRemainingMs = (key: SkillKey) => {
    const remainingMs = characterRuntime?.getSkillCooldownRemainingMs?.(key);
    if (remainingMs === null || remainingMs === undefined) return null;
    return Math.max(0, remainingMs);
  };

  const getRuntimeSkillCooldownDurationMs = (key: SkillKey) => {
    const runtimeDuration = characterRuntime?.getSkillCooldownDurationMs?.(key);
    if (runtimeDuration === null || runtimeDuration === undefined) return null;
    return Math.max(0, runtimeDuration);
  };

  const getSkillCooldownRemainingMs = (now: number, key: SkillKey) =>
    statsState.getSkillCooldownRemainingMs({
      now,
      key,
      runtimeRemainingMs: getRuntimeSkillCooldownRemainingMs(key),
    });

  const getSkillCooldownDurationMs = (key: SkillKey) =>
    statsState.getSkillCooldownDurationMs({
      key,
      runtimeDurationMs: getRuntimeSkillCooldownDurationMs(key),
    });

  const isRuntimeCooldownManaged = (key: SkillKey) =>
    getRuntimeSkillCooldownRemainingMs(key) != null ||
    getRuntimeSkillCooldownDurationMs(key) != null;

  const emitUiState = (now: number) => {
    const cooldownRemainingMs: Record<SkillKey, number> = {
      q: getSkillCooldownRemainingMs(now, "q"),
      e: getSkillCooldownRemainingMs(now, "e"),
      r: getSkillCooldownRemainingMs(now, "r"),
    };
    const cooldownDurationMs: Record<SkillKey, number> = {
      q: getSkillCooldownDurationMs("q"),
      e: getSkillCooldownDurationMs("e"),
      r: getSkillCooldownDurationMs("r"),
    };
    statusHud.setSkillCooldowns(
      {
        q: cooldownRemainingMs.q / 1000,
        e: cooldownRemainingMs.e / 1000,
        r: cooldownRemainingMs.r / 1000,
      },
      {
        q: cooldownDurationMs.q / 1000,
        e: cooldownDurationMs.e / 1000,
        r: cooldownDurationMs.r / 1000,
      }
    );
    statsState.emitUiState({
      now,
      getCooldownRemainingMs: (key) => cooldownRemainingMs[key],
      getCooldownDurationMs: (key) => cooldownDurationMs[key],
    });
  };

  const syncHealthFromPool = () => {
    statsState.syncHealth(healthPool.current);
  };

  const applyHealth = (amount: number) => {
    if (amount <= 0) return 0;
    const recovered = healthPool.heal(amount);
    if (recovered <= 0) return 0;
    syncHealthFromPool();
    statsState.syncHud();
    return recovered;
  };

  const projectileSystem = createProjectileSystem({
    scene,
    groundY: resolvedWorld.groundY,
    projectileColliders,
    attackResolver,
    applyEnergy: statsState.applyEnergy,
    applyMana: statsState.applyMana,
    getDefaultHitEnergyGain: () => statsState.energyConfig.hitGain,
    getDefaultHitManaGain: () => 0,
  });
  const characterLoader = createCharacterLoader({
    loader: new GLTFLoader(),
    avatar,
    lookPivot,
    avatarBody,
    avatarGlow,
    miniCamera,
    hideLocalHead,
    hideLocalBody,
    headLayer,
    bodyLayer,
    isMounted: () => isMounted,
  });

  const performMeleeAttack = ({
    damage,
    maxDistance,
    hitRadius = 0.45,
    maxHits = 1,
    origin,
    direction,
    contactCenter,
    contactRadius = 0,
  }: MeleeAttackArgs) => {
    if (damage <= 0) return 0;
    const aim = projectileSystem.resolveCameraAim({ camera });
    const resolvedOrigin = origin ?? aim.origin;
    const resolvedDirection = direction ?? aim.direction;
    if (resolvedDirection.lengthSq() < 0.000001) return 0;
    const normalizedDirection = resolvedDirection.clone().normalize();
    const resolvedContactRadius = Math.max(0, contactRadius);
    if (resolvedContactRadius > 0) {
      const resolvedContactCenter = contactCenter ?? resolvedOrigin;
      return attackResolver.performMeleeContactAttack({
        now: performance.now(),
        source: "slash",
        center: resolvedContactCenter.clone(),
        direction: normalizedDirection,
        damage,
        radius: resolvedContactRadius,
        maxHits,
      });
    }
    if (maxDistance <= 0) return 0;
    return attackResolver.performMeleeAttack({
      now: performance.now(),
      source: "slash",
      origin: resolvedOrigin.clone(),
      direction: normalizedDirection,
      damage,
      maxDistance,
      hitRadius,
      maxHits,
    });
  };

  const fireProjectile = (args?: FireProjectileArgs) => {
    projectileSystem.fireWithCameraAim({ camera, args });
  };

  const skillState = createPlayerSkillState({
    infiniteFire,
    statsState,
    getCurrentProfile: () => characterEntry.profile,
    getCurrentRuntime: () => characterRuntime,
    getSkillCooldownRemainingMs,
    isRuntimeCooldownManaged,
    emitUiState,
  });

  const clearActiveProjectiles = () => {
    projectileSystem.clear();
  };

  let survivalState: ReturnType<typeof createPlayerSurvivalState> | null = null;
  const frameUpdater = createPlayerFrameUpdater({
    avatar,
    lookPivot,
    camera,
    pressedKeys,
    lookState,
    bounds: resolvedWorld.bounds,
    groundY: resolvedWorld.groundY,
    gravity,
    statsState,
    cameraRig,
    projectileSystem,
    getRuntime: () => characterRuntime,
    getVisualState: () => visualState,
    getSurvivalState: () => survivalState,
    getProjectileBlockers: getRuntimeProjectileBlockers,
    isBlocked: (x, z) => (resolvedWorld.isBlocked ? resolvedWorld.isBlocked(x, z) : false),
    worldTick,
    emitUiState,
  });

  const resetPlayerState = (now: number) => {
    pressedKeys.clear();
    characterRuntime?.handlePrimaryCancel?.();
    characterRuntime?.resetState?.();
    frameUpdater.resetKinematics();
    lookState.yaw = 0;
    lookState.pitch = 0;
    statsState.resetSkillCooldowns();
    survivalState?.clearRecoveryZoneCooldowns();
    clearPlayerHitFlash();
    const spawnY = resolvedWorld.groundY + visualState.modelFootOffset;
    avatar.position.set(playerSpawn.x, spawnY, playerSpawn.z);
    avatar.rotation.y = 0;
    statsState.resetCurrentToMax();
    healthPool.reset(statsState.maxStats.health, statsState.maxStats.health);
    syncHealthFromPool();
    statsState.syncHud();
    clearActiveProjectiles();
    worldPlayerReset?.();
    survivalState?.beginRespawnProtection(now, 550);
    emitUiState(now);
  };

  survivalState = createPlayerSurvivalState({
    avatar,
    sceneId: resolvedWorld.sceneId,
    gameMode,
    resetOnDeath,
    recoveryZones,
    statsState,
    healthPool,
    syncHealthFromPool,
    onResetPlayer: resetPlayerState,
    worldPlayerDeath,
    onDamageApplied: () => {
      triggerPlayerHitFlash();
      statusHud.triggerDamageFlash();
    },
    beforeDamage: ({ amount, now }) =>
      characterRuntime?.beforeDamage?.({ amount, now }) ?? amount,
  });

  const loadCharacter = (path?: string) => {
    clearPlayerHitFlash();
    const resolvedPath = path || defaultCharacterPath;
    const loadPath = withDevCacheBust(resolvedPath);
    const nextEntry = getCharacterEntry(resolvedPath);
    if (characterRuntime) {
      clearActiveProjectiles();
      characterRuntime.dispose();
      characterRuntime = null;
    }
    characterEntry = nextEntry;
    statsState.setProfile(characterEntry.profile);
    healthPool.reset(statsState.maxStats.health, statsState.maxStats.health);
    syncHealthFromPool();
    statsState.syncHud();
    emitUiState(performance.now());

    characterRuntime = nextEntry.createRuntime({
      avatar,
      mount,
      fireProjectile,
      performMeleeAttack,
      applyHealth,
      applyEnergy: statsState.applyEnergy,
      spendEnergy: statsState.spendEnergy,
      applyMana: statsState.applyMana,
      clearSkillCooldown: statsState.clearSkillCooldown,
      getCurrentStats: () => statsState.currentStats,
      noCooldown: infiniteFire,
    });

    characterLoader.loadCharacterVisual({
      path: loadPath,
      groundY: resolvedWorld.groundY,
      previousModel: visualState.avatarModel,
      onLoaded: (nextVisualState) => {
        visualState.avatarModel = nextVisualState.avatarModel;
        visualState.arms = nextVisualState.arms;
        visualState.legLeft = nextVisualState.legLeft;
        visualState.legRight = nextVisualState.legRight;
        visualState.headBone = nextVisualState.headBone;
        visualState.headBoneRest = nextVisualState.headBoneRest;
        visualState.eyeHeight = nextVisualState.eyeHeight;
        visualState.modelFootOffset = nextVisualState.modelFootOffset;
      },
    });
  };

  const triggerPrimaryAttack = () => {
    if (!characterRuntime) return;
    if (isRuntimeBasicAttackLocked()) return;
    const aim = projectileSystem.resolveCameraAim({ camera });
    characterRuntime.handleRightClick({
      yaw: lookState.yaw,
      pitch: lookState.pitch,
      aimWorld: aim.point,
      aimOriginWorld: aim.origin,
    });
  };

  const inputBindings = bindPlayerInput({
    mount,
    pressedKeys,
    lookState,
    isGrounded: frameUpdater.isGrounded,
    isMovementLocked: isRuntimeMovementLocked,
    onJump: () => {
      frameUpdater.jump(jumpVelocity);
    },
    onPrimaryDown: () => {
      if (isRuntimeBasicAttackLocked()) return;
      if (characterRuntime?.handlePrimaryDown) {
        characterRuntime.handlePrimaryDown();
      } else {
        fireProjectile();
      }
    },
    onPrimaryUp: () => {
      characterRuntime?.handlePrimaryUp?.();
    },
    onPrimaryCancel: () => {
      characterRuntime?.handlePrimaryCancel?.();
    },
    onSecondaryDown: () => {
      if (isRuntimeBasicAttackLocked()) return;
      triggerPrimaryAttack();
    },
    onSkill: (skillKey, now) => {
      skillState.tryUseSkill(skillKey, now);
    },
  });

  loadCharacter(characterPath);
  cameraRig.updateMiniViewport(mount.clientWidth, mount.clientHeight);
  emitUiState(performance.now());

  const update = (now: number, delta: number) => {
    frameUpdater.update(now, delta);
  };

  const render = (renderer: THREE.WebGLRenderer) => {
    cameraRig.render(renderer, scene);
  };

  const resize = (width: number, height: number) => {
    cameraRig.resize(width, height);
  };

  const setCharacterPath = (path?: string) => {
    loadCharacter(path);
  };

  const dispose = () => {
    isMounted = false;
    clearPlayerHitFlash();
    inputBindings.dispose();
    avatarBody.geometry.dispose();
    avatarBody.material.dispose();
    avatarGlow.geometry.dispose();
    avatarGlow.material.dispose();
    if (visualState.avatarModel) {
      characterLoader.disposeAvatarModel(visualState.avatarModel);
    }
    if (characterRuntime) {
      clearActiveProjectiles();
      characterRuntime.dispose();
    }
    projectileSystem.dispose();
    scene.remove(avatar);
    statusHud.dispose();
    playerHitFlashOriginalState.clear();
  };

  return {
    camera,
    miniCamera,
    projectiles: projectileSystem.projectiles,
    update,
    render,
    resize,
    setCharacterPath,
    dispose,
  };
};



