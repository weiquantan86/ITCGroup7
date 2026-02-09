import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { LinearProjectileUpdater } from "../../../object/projectile/linearUpdater";
import type {
  ProjectileExplosionFragment,
} from "../../../object/projectile/types";
import { HpPool } from "../../hpPool";
import { getCharacterEntry, resolveCharacterStats } from "./registry";
import { bindPlayerInput } from "./input";
import { createStatusHud } from "./statusHud";
import type {
  PlayerAttackTarget,
  PlayerController,
  PlayerUiState,
  PlayerWorld,
  Projectile,
} from "./types";
import type {
  FireProjectileArgs,
  CharacterProfile,
  ProjectileLifecycleHooks,
  ProjectileRemoveReason,
  CharacterRuntime,
  CharacterStats,
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

  const camera = new THREE.PerspectiveCamera(
    70,
    mount.clientWidth / mount.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 4.5, 10);

  const miniCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
  miniCamera.position.set(0, 6, 6);
  if (hideLocalHead) {
    miniCamera.layers.enable(1);
  }
  if (hideLocalBody) {
    miniCamera.layers.enable(2);
  }

  const pressedKeys = new Set<string>();

  const lookState = {
    yaw: 0,
    pitch: 0,
    minPitch: -1.2,
    maxPitch: 1.1,
    sensitivity: 0.002,
  };

  const moveState = {
    baseSpeed: 5,
    sprintMultiplier: 1.6,
  };

  const cameraTarget = new THREE.Vector3();
  const cameraLookDir = new THREE.Vector3();
  const cameraLookAt = new THREE.Vector3();
  const miniTarget = new THREE.Vector3();
  const miniOffset = new THREE.Vector3();
  const moveDir = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const attackAimOrigin = new THREE.Vector3();
  const attackAimDirection = new THREE.Vector3();
  const attackAimPoint = new THREE.Vector3();
  const attackAimOffset = new THREE.Vector3(0, -0.2, 0);
  const attackAimForwardOffset = 0.4;
  const attackAimDistance = 30;
  const projectileSpeed = 18;
  const projectileLifetime = 2.2;
  const projectileRadius = 0.12;
  const projectileGravity = -12;

  let velocityY = 0;
  let isGrounded = true;
  let eyeHeight = 1.6;
  let modelFootOffset = 0;
  const gravity = -18;
  const jumpVelocity = 6.5;
  const miniViewport = { size: 0, margin: 14 };
  const headLayer = 1;
  const bodyLayer = 2;
  let projectileId = 0;
  const projectiles: Projectile[] = [];
  const projectileLifecycleHooks = new Map<number, ProjectileLifecycleHooks>();
  const projectileRemovedReason = new Map<number, ProjectileRemoveReason>();
  const projectileExploded = new Set<number>();
  const projectileExplosionFragments: ProjectileExplosionFragment[] = [];
  const projectileColliders = resolvedWorld.projectileColliders ?? [];
  const recoveryZones = resolvedWorld.recoveryZones ?? [];
  const attackTargets = resolvedWorld.attackTargets ?? [];
  const worldTick = resolvedWorld.onTick;
  const worldPlayerDeath = resolvedWorld.onPlayerDeath;
  const worldPlayerReset = resolvedWorld.onPlayerReset;
  const resetOnDeath = Boolean(resolvedWorld.resetOnDeath);
  const recoveryZoneLastTriggered = new Map<string, number>();
  const projectileRaycaster = new THREE.Raycaster();
  const projectileUpdater = new LinearProjectileUpdater();
  const attackRayHitPoint = new THREE.Vector3();
  const attackRayDirection = new THREE.Vector3();
  const attackTargetBounds = new THREE.Box3();
  const attackTargetSphere = new THREE.Sphere();
  const attackTargetCenterOffset = new THREE.Vector3();
  const attackTargetClosestPoint = new THREE.Vector3();
  const projectileGeometry = new THREE.SphereGeometry(projectileRadius, 12, 12);
  const projectileMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x93c5fd,
    emissiveIntensity: 0.6,
    roughness: 0.35,
    metalness: 0.1,
  });
  const projectileExplosionGeometry = new THREE.IcosahedronGeometry(0.09, 0);
  const projectileExplosionMaterial = new THREE.MeshStandardMaterial({
    color: 0x86efac,
    roughness: 0.22,
    metalness: 0.18,
    emissive: 0x22c55e,
    emissiveIntensity: 0.7,
  });
  const explosionOrigin = new THREE.Vector3();
  const explosionDirection = new THREE.Vector3();
  const attackTargetPoint = new THREE.Vector3();
  const playerSpawn = (
    resolvedWorld.playerSpawn ?? new THREE.Vector3(0, resolvedWorld.groundY, 6)
  ).clone();
  let respawnProtectionUntil = 0;

  const isHeadRelated = (obj: THREE.Object3D | null) => {
    let current = obj;
    while (current) {
      if (/head|eye|face|hair/i.test(current.name)) return true;
      current = current.parent;
    }
    return false;
  };

  const isArmRelated = (obj: THREE.Object3D | null) => {
    let current = obj;
    while (current) {
      if (/arm|hand|weapon|gun|sword|blade/i.test(current.name)) return true;
      current = current.parent;
    }
    return false;
  };

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
  avatar.position.copy(playerSpawn);
  if (hideLocalBody) {
    avatarBody.layers.set(bodyLayer);
    avatarGlow.layers.set(bodyLayer);
  }
  scene.add(avatar);

  const loader = new GLTFLoader();
  let isMounted = true;
  let avatarModel: THREE.Object3D | null = null;
  let arms: THREE.Object3D[] = [];
  let legLeft: THREE.Object3D | null = null;
  let legRight: THREE.Object3D | null = null;
  let headBone: THREE.Object3D | null = null;
  let headBoneRest: THREE.Quaternion | null = null;

  const defaultCharacterPath = "/assets/characters/adam/adam.glb";
  let characterEntry = getCharacterEntry(characterPath || defaultCharacterPath);
  let characterRuntime: CharacterRuntime | null = null;
  let fireProjectile: (args?: FireProjectileArgs) => void = () => {};
  const statusHud = createStatusHud(mount);
  let maxStats: CharacterStats = resolveCharacterStats(characterEntry.profile);
  let currentStats: CharacterStats = { ...maxStats };
  const healthPool = new HpPool({
    max: maxStats.health,
    current: currentStats.health,
  });
  let statsDirty = true;
  const resolveSkillCooldownDurations = (
    profile?: CharacterProfile
  ): Record<SkillKey, number> => ({
    q: Math.max(0, profile?.kit?.skills?.q?.cooldownMs ?? 0),
    e: Math.max(0, profile?.kit?.skills?.e?.cooldownMs ?? 0),
    r: Math.max(0, profile?.kit?.skills?.r?.cooldownMs ?? 0),
  });
  let skillCooldownDurations: Record<SkillKey, number> =
    resolveSkillCooldownDurations(characterEntry.profile);
  let skillCooldownUntil: Record<SkillKey, number> = { q: 0, e: 0, r: 0 };
  let lastUiStateSnapshot = "";
  const emptyProjectileBlockers: THREE.Object3D[] = [];
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

  type EnergyConfigResolved = {
    passivePerSecond: number;
    movingPerSecond: number;
    hitGain: number;
    damageTakenRatio: number;
  };
  const resolveEnergyConfig = (
    profile?: CharacterProfile
  ): EnergyConfigResolved => ({
    passivePerSecond: Math.max(
      0,
      profile?.energy?.passivePerSecond ?? 0
    ),
    movingPerSecond: Math.max(
      0,
      profile?.energy?.movingPerSecond ?? 0
    ),
    hitGain: Math.max(0, profile?.energy?.hitGain ?? 0),
    damageTakenRatio: Math.max(
      0,
      profile?.energy?.damageTakenRatio ?? 0
    ),
  });
  let energyConfig: EnergyConfigResolved =
    resolveEnergyConfig(characterEntry.profile);

  const getRuntimeSkillHandler = (key: SkillKey) => {
    if (!characterRuntime) return null;
    if (key === "q") return characterRuntime.handleSkillQ ?? null;
    if (key === "e") return characterRuntime.handleSkillE ?? null;
    return characterRuntime.handleSkillR ?? null;
  };

  const getRuntimeProjectileBlockers = () => {
    const blockers = characterRuntime?.getProjectileBlockers?.();
    if (!blockers?.length) return emptyProjectileBlockers;
    return blockers;
  };

  const isRuntimeMovementLocked = () =>
    Boolean(characterRuntime?.isMovementLocked?.());

  const getRuntimeSkillCooldownRemainingMs = (key: SkillKey) => {
    const remainingMs = characterRuntime?.getSkillCooldownRemainingMs?.(key);
    if (remainingMs === null || remainingMs === undefined) return null;
    return Math.max(0, remainingMs);
  };

  const getSkillCooldownDurationMs = (key: SkillKey) => {
    const runtimeDuration = characterRuntime?.getSkillCooldownDurationMs?.(key);
    if (runtimeDuration === null || runtimeDuration === undefined) {
      return skillCooldownDurations[key];
    }
    return Math.max(0, runtimeDuration);
  };

  const getSkillCooldownRemainingMs = (now: number, key: SkillKey) => {
    if (infiniteFire) return 0;
    const runtimeRemaining = getRuntimeSkillCooldownRemainingMs(key);
    if (runtimeRemaining !== null) {
      return runtimeRemaining;
    }
    return Math.max(0, skillCooldownUntil[key] - now);
  };

  const getSkillCooldownRemaining = (now: number, key: SkillKey) =>
    getSkillCooldownRemainingMs(now, key) / 1000;

  const isRuntimeCooldownManaged = (key: SkillKey) => {
    if (!characterRuntime) return false;
    if (characterRuntime.getSkillCooldownRemainingMs?.(key) != null) return true;
    if (characterRuntime.getSkillCooldownDurationMs?.(key) != null) return true;
    return false;
  };

  const applyEnergy = (amount: number) => {
    if (infiniteFire) return 0;
    if (maxStats.energy <= 0 || amount <= 0) return 0;
    const next = Math.min(maxStats.energy, currentStats.energy + amount);
    const gained = next - currentStats.energy;
    if (gained > 0) {
      currentStats.energy = next;
      statsDirty = true;
    }
    return gained;
  };

  const getSkillCost = (key: SkillKey) => {
    if (characterEntry.profile.id === "adam" && key === "q") {
      return 0;
    }
    const configuredCost = characterEntry.profile.kit?.skills?.[key]?.cost;
    if (configuredCost == null) {
      // Q is energy-based globally; keep a small default cost when profiles omit it.
      return key === "q" ? 20 : 0;
    }
    return Math.max(0, configuredCost);
  };

  const getSkillResource = (key: SkillKey): "mana" | "energy" =>
    key === "q" ? "energy" : "mana";

  const hasEnoughSkillResource = (key: SkillKey) => {
    if (infiniteFire) return true;
    if (characterEntry.profile.id === "adam" && key === "q") {
      return currentStats.energy > 0;
    }
    const cost = getSkillCost(key);
    if (cost <= 0) return true;
    if (getSkillResource(key) === "energy") {
      return currentStats.energy >= cost;
    }
    return currentStats.mana >= cost;
  };

  const spendSkillCost = (key: SkillKey) => {
    if (infiniteFire) return;
    const cost = getSkillCost(key);
    if (cost <= 0) return;
    if (getSkillResource(key) === "energy") {
      currentStats.energy = Math.max(0, currentStats.energy - cost);
    } else {
      currentStats.mana = Math.max(0, currentStats.mana - cost);
    }
    statsDirty = true;
    syncStatsHud();
  };

  const consumeAllEnergy = () => {
    if (infiniteFire) return;
    if (currentStats.energy <= 0) return;
    currentStats.energy = 0;
    statsDirty = true;
    syncStatsHud();
  };

  const activateSkillCooldown = (key: SkillKey, now: number) => {
    if (infiniteFire) return;
    if (isRuntimeCooldownManaged(key)) return;
    const cooldownMs = skillCooldownDurations[key];
    if (cooldownMs <= 0) return;
    skillCooldownUntil[key] = now + cooldownMs;
  };

  const tryUseSkill = (key: SkillKey, now: number) => {
    if (!infiniteFire && getSkillCooldownRemainingMs(now, key) > 0) {
      return false;
    }
    if (!hasEnoughSkillResource(key)) {
      return false;
    }
    const handler = getRuntimeSkillHandler(key);
    if (!handler) return false;
    const didTrigger = handler();
    if (!didTrigger) return false;
    if (characterEntry.profile.id === "adam" && key === "q") {
      consumeAllEnergy();
    }
    spendSkillCost(key);
    activateSkillCooldown(key, now);
    emitUiState(now);
    return true;
  };

  const syncStatsHud = () => {
    if (!statsDirty) return;
    statusHud.setStats(currentStats, maxStats);
    statsDirty = false;
  };

  const syncHealthFromPool = () => {
    currentStats.health = healthPool.current;
  };

  const clearActiveProjectiles = () => {
    for (let i = 0; i < projectiles.length; i += 1) {
      const projectile = projectiles[i];
      scene.remove(projectile.mesh);
      if (projectile.ownsMaterial) {
        projectile.material.dispose();
      }
      projectileLifecycleHooks.delete(projectile.id);
      projectileRemovedReason.delete(projectile.id);
      projectileExploded.delete(projectile.id);
    }
    projectiles.length = 0;
    for (let i = 0; i < projectileExplosionFragments.length; i += 1) {
      scene.remove(projectileExplosionFragments[i].mesh);
    }
    projectileExplosionFragments.length = 0;
  };

  const resetPlayerState = (now: number) => {
    pressedKeys.clear();
    characterRuntime?.handlePrimaryCancel?.();
    characterRuntime?.resetState?.();
    velocityY = 0;
    isGrounded = true;
    lookState.yaw = 0;
    lookState.pitch = 0;
    skillCooldownUntil = { q: 0, e: 0, r: 0 };
    recoveryZoneLastTriggered.clear();
    const spawnY = resolvedWorld.groundY + modelFootOffset;
    avatar.position.set(playerSpawn.x, spawnY, playerSpawn.z);
    avatar.rotation.y = 0;
    currentStats = { ...maxStats };
    healthPool.reset(maxStats.health, maxStats.health);
    syncHealthFromPool();
    statsDirty = true;
    syncStatsHud();
    clearActiveProjectiles();
    worldPlayerReset?.();
    respawnProtectionUntil = now + 550;
    emitUiState(now);
  };

  const emitUiState = (now: number) => {
    if (!onUiStateChange) return;
    const cooldowns: Record<SkillKey, number> = {
      q: getSkillCooldownRemaining(now, "q"),
      e: getSkillCooldownRemaining(now, "e"),
      r: getSkillCooldownRemaining(now, "r"),
    };
    const cooldownDurations: Record<SkillKey, number> = {
      q: getSkillCooldownDurationMs("q") / 1000,
      e: getSkillCooldownDurationMs("e") / 1000,
      r: getSkillCooldownDurationMs("r") / 1000,
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

  const applyDamageToPlayer = (amount: number) => {
    const now = performance.now();
    if (now < respawnProtectionUntil) return 0;
    const applied = healthPool.takeDamage(amount);
    if (applied > 0) {
      syncHealthFromPool();
      applyEnergy(applied * energyConfig.damageTakenRatio);
      statsDirty = true;
      syncStatsHud();
    }
    if (!healthPool.isAlive) {
      let didReset = false;
      const resetPlayer = () => {
        if (didReset) return;
        didReset = true;
        resetPlayerState(now);
      };
      const deathResolution = worldPlayerDeath?.({
        now,
        sceneId: resolvedWorld.sceneId,
        gameMode,
        player: avatar,
        currentStats,
        maxStats,
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

  const restoreFullHealth = () => {
    const recovered = healthPool.restoreFull();
    if (recovered <= 0) return false;
    syncHealthFromPool();
    return recovered > 0;
  };

  const restoreFullMana = () => {
    if (currentStats.mana >= maxStats.mana) return false;
    currentStats.mana = maxStats.mana;
    return true;
  };

  const restoreFullEnergy = () => {
    if (currentStats.energy >= maxStats.energy) return false;
    currentStats.energy = maxStats.energy;
    return true;
  };

  const applyRecoveryZones = (now: number) => {
    if (!recoveryZones.length) return;

    const x = avatar.position.x;
    const z = avatar.position.z;

    for (let i = 0; i < recoveryZones.length; i += 1) {
      const zone = recoveryZones[i];
      if (
        x < zone.minX ||
        x > zone.maxX ||
        z < zone.minZ ||
        z > zone.maxZ
      ) {
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
        recovered = restoreFullMana() || recovered;
      }
      if (zone.type === "energy" || zone.type === "both") {
        recovered = restoreFullEnergy() || recovered;
      }

      if (!recovered) continue;
      statsDirty = true;
      syncStatsHud();
      recoveryZoneLastTriggered.set(zone.id, now);
    }
  };

  const applyStatsFromProfile = () => {
    const resolved = resolveCharacterStats(characterEntry.profile);
    maxStats = { ...resolved };
    currentStats = { ...resolved };
    energyConfig = resolveEnergyConfig(characterEntry.profile);
    healthPool.reset(maxStats.health, maxStats.health);
    syncHealthFromPool();
    skillCooldownDurations = resolveSkillCooldownDurations(characterEntry.profile);
    skillCooldownUntil = { q: 0, e: 0, r: 0 };
    if (infiniteFire && maxStats.mana > 0) {
      currentStats.mana = maxStats.mana;
    }
    if (infiniteFire && maxStats.energy > 0) {
      currentStats.energy = maxStats.energy;
    }
    statsDirty = true;
    syncStatsHud();
    emitUiState(performance.now());
  };

  const disposeAvatarModel = (model: THREE.Object3D) => {
    model.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
  };

  const loadCharacter = (path?: string) => {
    const resolvedPath = path || defaultCharacterPath;
    const nextEntry = getCharacterEntry(resolvedPath);
    if (characterRuntime) {
      clearActiveProjectiles();
      characterRuntime.dispose();
      characterRuntime = null;
    }
    characterEntry = nextEntry;
    applyStatsFromProfile();
    characterRuntime = nextEntry.createRuntime({
      avatar,
      mount,
      fireProjectile,
      noCooldown: infiniteFire,
    });
    loader.load(
      resolvedPath,
      (gltf) => {
        if (!isMounted || !gltf?.scene) return;
        if (avatarModel) {
          lookPivot.remove(avatarModel);
          disposeAvatarModel(avatarModel);
        }
        avatarModel = gltf.scene;
        avatarModel.scale.setScalar(1.15);
        avatarModel.position.set(0, 0, 0);
        arms = [];
        legLeft = null;
        legRight = null;
        headBone = null;
        headBoneRest = null;
        const meshes: THREE.Mesh[] = [];
        const skinnedMeshes: THREE.SkinnedMesh[] = [];
        let foundHeadMesh = false;
        avatarModel.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            meshes.push(mesh);
            if (isHeadRelated(mesh)) {
              foundHeadMesh = true;
            }
            if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
              skinnedMeshes.push(mesh as THREE.SkinnedMesh);
            }
          }
          if (child.name && child.name.startsWith("arm")) arms.push(child);
          if (child.name === "legLeft") legLeft = child;
          if (child.name === "legRight") legRight = child;
          if (!headBone && /head/i.test(child.name)) {
            headBone = child;
            headBoneRest = child.quaternion.clone();
          }
        });

        if (!headBone) {
          for (let i = 0; i < skinnedMeshes.length; i += 1) {
            const mesh = skinnedMeshes[i];
            const bones = mesh.skeleton?.bones || [];
            const bone = bones.find((item) => /head/i.test(item.name));
            if (bone) {
              headBone = bone;
              headBoneRest = bone.quaternion.clone();
              break;
            }
          }
        }

        const useHideBody =
          hideLocalBody || (hideLocalHead && !foundHeadMesh);
        if (useHideBody) {
          miniCamera.layers.enable(bodyLayer);
        }

        meshes.forEach((mesh) => {
          mesh.castShadow = true;
          if (useHideBody) {
            if (isArmRelated(mesh)) {
              mesh.layers.set(0);
            } else if (hideLocalHead && isHeadRelated(mesh)) {
              mesh.layers.set(headLayer);
            } else {
              mesh.layers.set(bodyLayer);
            }
          } else if (hideLocalHead && isHeadRelated(mesh)) {
            mesh.layers.set(headLayer);
          } else {
            mesh.layers.set(0);
          }
        });
        lookPivot.remove(avatarBody, avatarGlow);
        lookPivot.add(avatarModel);
        avatar.updateMatrixWorld(true);
        const modelBounds = new THREE.Box3().setFromObject(avatarModel);
        modelFootOffset = avatar.position.y - modelBounds.min.y;
        const modelHeight = modelBounds.max.y - modelBounds.min.y;
        eyeHeight = THREE.MathUtils.clamp(modelHeight * 0.85, 1.4, 2.1);
        avatar.position.y = resolvedWorld.groundY + modelFootOffset;
      },
      undefined,
      () => {
        // Keep placeholder if model fails to load.
      }
    );
  };

  const updateMiniViewport = (width: number, height: number) => {
    if (!showMiniMap) {
      miniViewport.size = 0;
      return;
    }
    const minEdge = Math.min(width, height);
    miniViewport.size = Math.max(120, Math.floor(minEdge * 0.25));
    miniCamera.aspect = 16 / 9;
    miniCamera.updateProjectionMatrix();
  };

  const resolveInputDirection = (out: THREE.Vector3) => {
    const inputX =
      (pressedKeys.has("a") || pressedKeys.has("left") ? 1 : 0) +
      (pressedKeys.has("d") || pressedKeys.has("right") ? -1 : 0);
    const inputZ =
      (pressedKeys.has("w") || pressedKeys.has("up") ? 1 : 0) +
      (pressedKeys.has("s") || pressedKeys.has("down") ? -1 : 0);
    if (inputX === 0 && inputZ === 0) return false;
    const length = Math.hypot(inputX, inputZ) || 1;
    const dirX = inputX / length;
    const dirZ = inputZ / length;
    forward.set(Math.sin(lookState.yaw), 0, Math.cos(lookState.yaw));
    right.set(forward.z, 0, -forward.x);
    out.set(
      right.x * dirX + forward.x * dirZ,
      0,
      right.z * dirX + forward.z * dirZ
    );
    return true;
  };

  const isBlocked = (x: number, z: number) =>
    resolvedWorld.isBlocked ? resolvedWorld.isBlocked(x, z) : false;

  const clampToBounds = (x: number, z: number) => {
    if (!resolvedWorld.bounds) return { x, z };
    return {
      x: THREE.MathUtils.clamp(
        x,
        resolvedWorld.bounds.minX,
        resolvedWorld.bounds.maxX
      ),
      z: THREE.MathUtils.clamp(
        z,
        resolvedWorld.bounds.minZ,
        resolvedWorld.bounds.maxZ
      ),
    };
  };

  const isObjectWithinRoot = (child: THREE.Object3D, root: THREE.Object3D) => {
    let current: THREE.Object3D | null = child;
    while (current) {
      if (current === root) return true;
      current = current.parent;
    }
    return false;
  };

  const resolveAttackTargetFromObject = (object: THREE.Object3D) => {
    for (let i = 0; i < attackTargets.length; i += 1) {
      const target = attackTargets[i];
      if (target.isActive && !target.isActive()) continue;
      if (isObjectWithinRoot(object, target.object)) {
        return target;
      }
    }
    return null;
  };

  type AttackTargetHit = {
    target: PlayerAttackTarget;
    point: THREE.Vector3;
    distance: number;
  };

  const intersectAttackTargetsByRay = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    far: number
  ): AttackTargetHit | null => {
    if (!attackTargets.length) return null;
    const activeRoots: THREE.Object3D[] = [];
    for (let i = 0; i < attackTargets.length; i += 1) {
      const target = attackTargets[i];
      if (target.isActive && !target.isActive()) continue;
      activeRoots.push(target.object);
    }
    if (!activeRoots.length) return null;

    projectileRaycaster.set(origin, direction);
    projectileRaycaster.far = far;
    const hits = projectileRaycaster.intersectObjects(activeRoots, true);
    for (let i = 0; i < hits.length; i += 1) {
      const hit = hits[i];
      const target = resolveAttackTargetFromObject(hit.object);
      if (!target) continue;
      return {
        target,
        point: hit.point.clone(),
        distance: hit.distance,
      };
    }
    return null;
  };

  // Radius-aware fallback so large projectiles do not visually pass through targets.
  const intersectAttackTargetsByRadius = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    far: number,
    projectileHitRadius: number
  ): AttackTargetHit | null => {
    if (!attackTargets.length) return null;
    let nearest: AttackTargetHit | null = null;

    for (let i = 0; i < attackTargets.length; i += 1) {
      const target = attackTargets[i];
      if (target.isActive && !target.isActive()) continue;

      target.object.updateMatrixWorld(true);
      attackTargetBounds.setFromObject(target.object);
      if (attackTargetBounds.isEmpty()) continue;
      attackTargetBounds.getBoundingSphere(attackTargetSphere);

      attackTargetCenterOffset.copy(attackTargetSphere.center).sub(origin);
      const projectedDistance = THREE.MathUtils.clamp(
        attackTargetCenterOffset.dot(direction),
        0,
        far
      );
      attackTargetClosestPoint
        .copy(origin)
        .addScaledVector(direction, projectedDistance);

      const combinedRadius = attackTargetSphere.radius + projectileHitRadius;
      if (
        attackTargetClosestPoint.distanceToSquared(attackTargetSphere.center) >
        combinedRadius * combinedRadius
      ) {
        continue;
      }

      if (!nearest || projectedDistance < nearest.distance) {
        nearest = {
          target,
          point: attackTargetClosestPoint.clone(),
          distance: projectedDistance,
        };
      }
    }

    return nearest;
  };

  const intersectAttackTargets = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    far: number,
    projectileHitRadius: number
  ): AttackTargetHit | null => {
    const rayHit = intersectAttackTargetsByRay(origin, direction, far);
    if (projectileHitRadius <= 0) {
      return rayHit;
    }
    const radiusHit = intersectAttackTargetsByRadius(
      origin,
      direction,
      far,
      projectileHitRadius
    );

    if (rayHit && radiusHit) {
      return rayHit.distance <= radiusHit.distance ? rayHit : radiusHit;
    }
    return rayHit ?? radiusHit;
  };

  const spawnProjectile = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number = projectileSpeed,
    lifetime: number = projectileLifetime,
    options?: FireProjectileArgs
  ) => {
    const providedMesh = options?.mesh;
    const useCustomMaterial =
      !providedMesh &&
      (options?.color !== undefined ||
        options?.emissive !== undefined ||
        options?.emissiveIntensity !== undefined);
    const material = useCustomMaterial
      ? new THREE.MeshStandardMaterial({
          color: options?.color ?? 0xe2e8f0,
          emissive: options?.emissive ?? 0x93c5fd,
          emissiveIntensity: options?.emissiveIntensity ?? 0.6,
          roughness: 0.35,
          metalness: 0.1,
        })
      : providedMesh
        ? ((Array.isArray(providedMesh.material)
            ? providedMesh.material[0]
            : providedMesh.material) as THREE.Material)
        : projectileMaterial;
    const mesh = providedMesh ?? new THREE.Mesh(projectileGeometry, material);
    if (mesh.parent) {
      mesh.removeFromParent();
    }
    mesh.position.copy(origin);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (options?.scale) {
      mesh.scale.setScalar(options.scale);
    }
    scene.add(mesh);
    const velocity = direction.clone();
    if (velocity.lengthSq() < 0.000001) {
      velocity.set(0, 0, 1);
    } else {
      velocity.normalize();
    }
    velocity.multiplyScalar(speed);
    let resolvedRadius = options?.radius;
    if (resolvedRadius == null && providedMesh) {
      if (!providedMesh.geometry.boundingSphere) {
        providedMesh.geometry.computeBoundingSphere();
      }
      const geometryRadius = providedMesh.geometry.boundingSphere?.radius;
      if (geometryRadius) {
        const maxScale = Math.max(
          providedMesh.scale.x,
          providedMesh.scale.y,
          providedMesh.scale.z
        );
        resolvedRadius = geometryRadius * maxScale;
      }
    }
    const resolvedDamage = Math.max(
      8,
      options?.damage ?? Math.round(10 + speed * 0.6)
    );
    const id = projectileId++;
    projectiles.push({
      id,
      mesh,
      velocity,
      life: 0,
      maxLife: lifetime,
      radius: Math.max(
        0.05,
        resolvedRadius ?? projectileRadius * (options?.scale ?? 1)
      ),
      targetHitRadius: Math.max(0, options?.targetHitRadius ?? 0),
      damage: resolvedDamage,
      energyGainOnHit:
        options?.energyGainOnHit == null
          ? null
          : Math.max(0, options.energyGainOnHit),
      splitOnImpact: Boolean(options?.splitOnImpact),
      explosionRadius: Math.max(0, options?.explosionRadius ?? 0),
      explosionDamage: Math.max(0, options?.explosionDamage ?? 0),
      material,
      ownsMaterial: useCustomMaterial && !providedMesh,
    });
    if (options?.lifecycle) {
      projectileLifecycleHooks.set(id, options.lifecycle);
    }
  };

  const triggerProjectileExplosion = (
    now: number,
    projectile: Projectile,
    impactPoint: THREE.Vector3,
    impactDirection: THREE.Vector3,
    primaryTarget?: PlayerAttackTarget | null
  ) => {
    if (!projectile.splitOnImpact) return;
    projectileExploded.add(projectile.id);

    explosionOrigin.copy(impactPoint);
    explosionDirection.copy(impactDirection);
    if (explosionDirection.lengthSq() < 0.000001) {
      explosionDirection.set(0, 0, 1);
    }
    explosionDirection.normalize();

    const baseExplosionRadius = 3.6;
    const visualFactor = THREE.MathUtils.clamp(
      projectile.explosionRadius > 0
        ? projectile.explosionRadius / baseExplosionRadius
        : 1,
      0.75,
      5
    );
    const fragmentCount = Math.max(
      14,
      Math.min(42, Math.round(14 * visualFactor))
    );
    const spread = 0.45 * visualFactor;
    const velocityScale = Math.sqrt(visualFactor);
    const minScale = 0.72 * visualFactor;
    const maxScale = 1.08 * visualFactor;

    for (let i = 0; i < fragmentCount; i += 1) {
      const mesh = new THREE.Mesh(
        projectileExplosionGeometry,
        projectileExplosionMaterial
      );
      const baseScale = THREE.MathUtils.lerp(minScale, maxScale, Math.random());
      mesh.scale.setScalar(baseScale);
      mesh.position.copy(explosionOrigin).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread
        )
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4.6 * velocityScale,
        (1.5 + Math.random() * 2.8) * velocityScale,
        (Math.random() - 0.5) * 4.6 * velocityScale
      ).addScaledVector(explosionDirection, -2.2 * velocityScale);
      projectileExplosionFragments.push({
        mesh,
        velocity,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 7.4,
          (Math.random() - 0.5) * 7.4,
          (Math.random() - 0.5) * 7.4
        ),
        life: 0,
        maxLife: (0.55 + Math.random() * 0.2) * velocityScale,
        baseScale,
      });
    }

    if (projectile.explosionRadius <= 0 || projectile.explosionDamage <= 0) return;

    const radius = projectile.explosionRadius;
    const radiusSq = radius * radius;

    for (let i = 0; i < attackTargets.length; i += 1) {
      const target = attackTargets[i];
      if (target.isActive && !target.isActive()) continue;
      if (primaryTarget && target.id === primaryTarget.id) continue;
      target.object.getWorldPosition(attackTargetPoint);
      const distSq = attackTargetPoint.distanceToSquared(explosionOrigin);
      if (distSq > radiusSq) continue;
      const dist = Math.sqrt(distSq);
      const ratio = 1 - dist / radius;
      const splashDamage = Math.max(
        1,
        Math.round(projectile.explosionDamage * (0.45 + ratio * 0.55))
      );
      target.onHit({
        now,
        source: "projectile",
        damage: splashDamage,
        point: explosionOrigin.clone(),
        direction: explosionDirection.clone(),
      });
    }
  };

  const updateProjectileExplosionFragments = (delta: number) => {
    for (let i = projectileExplosionFragments.length - 1; i >= 0; i -= 1) {
      const fragment = projectileExplosionFragments[i];
      fragment.velocity.y -= 11.5 * delta;
      fragment.mesh.position.addScaledVector(fragment.velocity, delta);
      fragment.mesh.rotation.x += fragment.spin.x * delta;
      fragment.mesh.rotation.y += fragment.spin.y * delta;
      fragment.mesh.rotation.z += fragment.spin.z * delta;
      fragment.life += delta;
      const lifeRatio = Math.max(0, 1 - fragment.life / fragment.maxLife);
      fragment.mesh.scale.setScalar(
        Math.max(0.08, fragment.baseScale * lifeRatio)
      );
      if (fragment.life >= fragment.maxLife) {
        scene.remove(fragment.mesh);
        projectileExplosionFragments.splice(i, 1);
      }
    }
  };

  const updateProjectiles = (
    now: number,
    delta: number,
    projectileBlockers: THREE.Object3D[]
  ) => {
    for (let i = 0; i < projectileBlockers.length; i += 1) {
      projectileBlockers[i].updateMatrixWorld(true);
    }

    projectileUpdater.update(projectiles, now, delta, {
      getObject: (projectile) => projectile.mesh,
      applyForces: (projectile, stepDelta) => {
        let defaultGravityApplied = false;
        const applyDefaultGravity = () => {
          if (defaultGravityApplied) return;
          defaultGravityApplied = true;
          projectile.velocity.y += projectileGravity * stepDelta;
        };
        const lifecycle = projectileLifecycleHooks.get(projectile.id);
        if (!lifecycle?.applyForces) {
          applyDefaultGravity();
          return;
        }
        lifecycle.applyForces({
          velocity: projectile.velocity,
          delta: stepDelta,
          applyDefaultGravity,
        });
      },
      onTravel: (
        projectile,
        travelNow,
        _delta,
        origin,
        _nextPosition,
        direction,
        distance,
        raycaster,
        remove
      ) => {
        const reach = distance + projectile.radius;
        const attackHit = intersectAttackTargets(
          origin,
          direction,
          reach,
          projectile.targetHitRadius
        );

        let worldHit: THREE.Intersection | null = null;
        if (projectileColliders.length) {
          raycaster.set(origin, direction);
          raycaster.far = reach;
          const hits = raycaster.intersectObjects(projectileColliders, true);
          if (hits.length) {
            worldHit = hits[0];
          }
        }
        if (projectileBlockers.length) {
          raycaster.set(origin, direction);
          raycaster.far = reach;
          const blockerHits = raycaster.intersectObjects(projectileBlockers, true);
          if (
            blockerHits.length &&
            (!worldHit || blockerHits[0].distance < worldHit.distance)
          ) {
            worldHit = blockerHits[0];
          }
        }

        const shouldUseAttackHit =
          Boolean(attackHit) &&
          (!worldHit || attackHit!.distance <= worldHit.distance);

        if (shouldUseAttackHit && attackHit) {
          projectileRemovedReason.set(projectile.id, "impact");
          attackRayHitPoint.copy(attackHit.point);
          attackRayDirection.copy(direction);
          applyEnergy(projectile.energyGainOnHit ?? energyConfig.hitGain);
          attackHit.target.onHit({
            now: travelNow,
            source: "projectile",
            damage: projectile.damage,
            point: attackRayHitPoint.clone(),
            direction: attackRayDirection.clone(),
          });
          triggerProjectileExplosion(
            travelNow,
            projectile,
            attackRayHitPoint,
            attackRayDirection,
            attackHit.target
          );
          remove();
          return;
        }

        if (worldHit) {
          projectileRemovedReason.set(projectile.id, "impact");
          attackRayHitPoint.copy(worldHit.point);
          attackRayDirection.copy(direction);
          triggerProjectileExplosion(
            travelNow,
            projectile,
            attackRayHitPoint,
            attackRayDirection,
            null
          );
          remove();
        }
      },
      shouldExpire: (projectile) => {
        const shouldExpireByGround =
          projectile.mesh.position.y <=
          resolvedWorld.groundY + projectile.radius * 0.4;
        if (shouldExpireByGround) {
          projectileRemovedReason.set(projectile.id, "expired");
        }
        return shouldExpireByGround;
      },
      onRemove: (projectile) => {
        const lifecycle = projectileLifecycleHooks.get(projectile.id);
        if (lifecycle?.onRemove) {
          const reason =
            projectileRemovedReason.get(projectile.id) ??
            (projectile.life >= projectile.maxLife ? "expired" : "cleared");
          lifecycle.onRemove({
            reason,
            now,
            position: projectile.mesh.position,
            velocity: projectile.velocity,
            triggerExplosion: () => {
              if (projectileExploded.has(projectile.id)) return;
              attackRayHitPoint.copy(projectile.mesh.position);
              attackRayDirection.copy(projectile.velocity);
              if (attackRayDirection.lengthSq() < 0.000001) {
                attackRayDirection.set(0, 0, 1);
              } else {
                attackRayDirection.normalize();
              }
              triggerProjectileExplosion(
                now,
                projectile,
                attackRayHitPoint,
                attackRayDirection,
                null
              );
            },
          });
        }
        scene.remove(projectile.mesh);
        if (projectile.ownsMaterial) {
          projectile.material.dispose();
        }
        projectileLifecycleHooks.delete(projectile.id);
        projectileRemovedReason.delete(projectile.id);
        projectileExploded.delete(projectile.id);
      },
    });
  };

  const updateAttackAim = () => {
    camera.getWorldPosition(attackAimOrigin);
    camera.getWorldDirection(attackAimDirection);
    attackAimOrigin.add(attackAimOffset);
    attackAimOrigin.addScaledVector(attackAimDirection, attackAimForwardOffset);
    attackAimPoint
      .copy(attackAimOrigin)
      .addScaledVector(attackAimDirection, attackAimDistance);
  };

fireProjectile = (args?: FireProjectileArgs) => {
  const useOverrideAim = Boolean(args?.origin && args?.direction);
  if (!useOverrideAim) {
    updateAttackAim();
  }
  const origin = args?.origin ?? attackAimOrigin;
  const direction = args?.direction ?? attackAimDirection;
  spawnProjectile(
    origin,
    direction,
    args?.speed ?? projectileSpeed,
    args?.lifetime ?? projectileLifetime,
    args
  );
};

  const performSlashAttackHit = (damage: number, maxDistance: number) => {
    updateAttackAim();
    const hit = intersectAttackTargetsByRay(
      attackAimOrigin,
      attackAimDirection,
      maxDistance
    );
    if (!hit) return false;
    applyEnergy(energyConfig.hitGain);
    hit.target.onHit({
      now: performance.now(),
      source: "slash",
      damage,
      point: hit.point.clone(),
      direction: attackAimDirection.clone(),
    });
    return true;
  };

  const triggerPrimaryAttack = () => {
    if (!characterRuntime) return;
    updateAttackAim();
    characterRuntime.handleRightClick({
      yaw: lookState.yaw,
      pitch: lookState.pitch,
      aimWorld: attackAimPoint,
      aimOriginWorld: attackAimOrigin,
    });
    performSlashAttackHit(18, 8);
  };

  const inputBindings = bindPlayerInput({
    mount,
    pressedKeys,
    lookState,
    isGrounded: () => isGrounded,
    isMovementLocked: isRuntimeMovementLocked,
    onJump: () => {
      velocityY = jumpVelocity;
      isGrounded = false;
    },
    onPrimaryDown: () => {
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
      triggerPrimaryAttack();
    },
    onSkill: (skillKey, now) => {
      tryUseSkill(skillKey, now);
    },
  });

  loadCharacter(characterPath);
  updateMiniViewport(mount.clientWidth, mount.clientHeight);
  emitUiState(performance.now());

  const update = (now: number, delta: number) => {
    const movementLocked = isRuntimeMovementLocked();
    const hasMoveInput = movementLocked ? false : resolveInputDirection(moveDir);
    let isMoving = false;
    if (hasMoveInput) {
      const speedBoost = pressedKeys.has("shift")
        ? moveState.sprintMultiplier
        : 1;
      const moveSpeed = moveState.baseSpeed * speedBoost * delta;
      const nextX = avatar.position.x + moveDir.x * moveSpeed;
      const nextZ = avatar.position.z + moveDir.z * moveSpeed;
      const clamped = clampToBounds(nextX, nextZ);
      if (!isBlocked(clamped.x, clamped.z)) {
        avatar.position.x = clamped.x;
        avatar.position.z = clamped.z;
        isMoving = true;
      }
    }

    velocityY += gravity * delta;
    avatar.position.y += velocityY * delta;
    const groundY = resolvedWorld.groundY + modelFootOffset;
    if (avatar.position.y <= groundY) {
      avatar.position.y = groundY;
      velocityY = 0;
      isGrounded = true;
    } else {
      isGrounded = false;
    }

    if (!characterRuntime?.isFacingLocked?.()) {
      avatar.rotation.y = lookState.yaw;
    }

    const headPitch = THREE.MathUtils.clamp(-lookState.pitch, -0.8, 0.8);
    if (headBone) {
      if (headBoneRest) {
        headBone.quaternion.copy(headBoneRest);
        headBone.rotateX(headPitch);
      } else {
        headBone.rotation.x = headPitch;
      }
      lookPivot.rotation.x = 0;
    } else {
      lookPivot.rotation.x = headPitch * 0.35;
    }

    cameraTarget.set(
      avatar.position.x,
      avatar.position.y + eyeHeight,
      avatar.position.z
    );
    cameraLookDir.set(
      Math.sin(lookState.yaw) * Math.cos(lookState.pitch),
      Math.sin(lookState.pitch),
      Math.cos(lookState.yaw) * Math.cos(lookState.pitch)
    );
    camera.position.copy(cameraTarget).addScaledVector(cameraLookDir, 0.05);
    cameraLookAt.copy(cameraTarget).add(cameraLookDir);
    camera.lookAt(cameraLookAt);

    miniTarget.set(
      avatar.position.x,
      avatar.position.y + eyeHeight * 0.6,
      avatar.position.z
    );
    const behindDistance = 3.9;
    const upDistance = 2.4;
    miniOffset.set(
      -Math.sin(lookState.yaw) * behindDistance,
      upDistance,
      -Math.cos(lookState.yaw) * behindDistance
    );
    miniCamera.position.copy(miniTarget).add(miniOffset);
    miniCamera.lookAt(miniTarget);

    if (characterRuntime) {
      characterRuntime.update({
        now,
        isMoving,
        aimDirectionWorld: cameraLookDir,
        arms,
        legLeft,
        legRight,
        avatarModel,
      });
    }
    const runtimeProjectileBlockers = getRuntimeProjectileBlockers();
    applyRecoveryZones(now);
    updateProjectiles(now, delta, runtimeProjectileBlockers);
    updateProjectileExplosionFragments(delta);
    if (worldTick) {
      worldTickCurrentStatsSnapshot.health = currentStats.health;
      worldTickCurrentStatsSnapshot.mana = currentStats.mana;
      worldTickCurrentStatsSnapshot.energy = currentStats.energy;
      worldTickMaxStatsSnapshot.health = maxStats.health;
      worldTickMaxStatsSnapshot.mana = maxStats.mana;
      worldTickMaxStatsSnapshot.energy = maxStats.energy;
      worldTick({
        now,
        delta,
        player: avatar,
        camera,
        currentStats: worldTickCurrentStatsSnapshot,
        maxStats: worldTickMaxStatsSnapshot,
        applyDamage: applyDamageToPlayer,
        projectileBlockers: runtimeProjectileBlockers,
      });
    }
    if (infiniteFire) {
      if (maxStats.mana > 0 && currentStats.mana < maxStats.mana) {
        currentStats.mana = maxStats.mana;
        statsDirty = true;
      }
      if (maxStats.energy > 0 && currentStats.energy < maxStats.energy) {
        currentStats.energy = maxStats.energy;
        statsDirty = true;
      }
    } else {
      if (characterEntry.profile.id === "adam" && maxStats.mana > 0) {
        const manaRegen = 2 * delta;
        if (manaRegen > 0 && currentStats.mana < maxStats.mana) {
          currentStats.mana = Math.min(maxStats.mana, currentStats.mana + manaRegen);
          statsDirty = true;
        }
      }
      if (maxStats.energy > 0) {
        const energyRegen =
          energyConfig.passivePerSecond * delta +
          (isMoving ? energyConfig.movingPerSecond * delta : 0);
        applyEnergy(energyRegen);
      }
    }
    syncStatsHud();
    emitUiState(now);
  };

  const render = (renderer: THREE.WebGLRenderer) => {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    renderer.setViewport(0, 0, width, height);
    renderer.render(scene, camera);
    if (!showMiniMap) return;

    const miniSize = miniViewport.size;
    const miniWidth = Math.floor(miniSize * 1.6);
    const miniHeight = miniSize;
    const miniLeft = width - miniWidth - miniViewport.margin;
    const miniBottom = height - miniHeight - miniViewport.margin;
    renderer.setScissorTest(true);
    renderer.clearDepth();
    renderer.setViewport(miniLeft, miniBottom, miniWidth, miniHeight);
    renderer.setScissor(miniLeft, miniBottom, miniWidth, miniHeight);
    renderer.render(scene, miniCamera);
    renderer.setScissorTest(false);
  };

  const resize = (width: number, height: number) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateMiniViewport(width, height);
  };

  const setCharacterPath = (path?: string) => {
    loadCharacter(path);
  };

  const dispose = () => {
    isMounted = false;
    inputBindings.dispose();
    avatarBody.geometry.dispose();
    avatarBody.material.dispose();
    avatarGlow.geometry.dispose();
    avatarGlow.material.dispose();
    if (avatarModel) {
      disposeAvatarModel(avatarModel);
    }
    if (characterRuntime) {
      clearActiveProjectiles();
      characterRuntime.dispose();
    }
    scene.remove(avatar);
    projectileGeometry.dispose();
    projectileMaterial.dispose();
    projectileExplosionGeometry.dispose();
    projectileExplosionMaterial.dispose();
    statusHud.dispose();
  };

  return {
    camera,
    miniCamera,
    projectiles,
    update,
    render,
    resize,
    setCharacterPath,
    dispose,
  };
};
