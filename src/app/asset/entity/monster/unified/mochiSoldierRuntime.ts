import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { PlayerWorldTickArgs } from "../../character/general/player";
import type { MonsterProfile } from "../general";
import { createMochiSoldierLifecycle } from "../mochiSoldier/lifecycle";
import { mochiSoldierProfile } from "../mochiSoldier/profile";
import { normalizeMochiSoldierPrototype } from "../mochiSoldier/runtime";
import { findBossHealthFromAttackTargets } from "./runtimeUtils";
import type {
  UnifiedMonsterRuntime,
  UnifiedMonsterRuntimeHost,
  UnifiedMonsterState,
} from "./types";

const SOLDIER_RESPAWN_DELAY_MS = 1500;
let mochiSoldierRuntimeInstanceCounter = 0;

const normalizePositiveMultiplier = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const normalizeDefenseRatio = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return THREE.MathUtils.clamp(parsed, 0, 1);
};

export const createMochiSoldierUnifiedRuntime = (
  host: UnifiedMonsterRuntimeHost
): UnifiedMonsterRuntime => {
  const {
    scene,
    hostGroup,
    resourceTracker,
    attackTargets,
    isBlocked,
    monster,
    spawnPosition,
    runtimeOptions,
  } = host;

  const allowRespawn = runtimeOptions?.respawnOnDefeat !== false;
  const isGameEnded = runtimeOptions?.isGameEnded ?? (() => false);
  const soldierConfig = runtimeOptions?.mochiSoldier;
  const baseStats = mochiSoldierProfile.stats ?? {};
  const resolvedProfile: MonsterProfile = {
    ...mochiSoldierProfile,
    stats: {
      ...baseStats,
      health: Math.max(
        1,
        (baseStats.health ?? 50) *
          normalizePositiveMultiplier(soldierConfig?.healthMultiplier, 1)
      ),
      attack: Math.max(
        0,
        (baseStats.attack ?? 0) *
          normalizePositiveMultiplier(soldierConfig?.attackMultiplier, 1)
      ),
      defense: normalizeDefenseRatio(
        soldierConfig?.defenseRatio ?? baseStats.defense ?? 0
      ),
      speed: Math.max(
        0.01,
        (baseStats.speed ?? 0.01) *
          normalizePositiveMultiplier(soldierConfig?.speedMultiplier, 1)
      ),
      aggroRange: Math.max(
        0.01,
        (baseStats.aggroRange ?? 0.01) *
          normalizePositiveMultiplier(soldierConfig?.aggroRangeMultiplier, 1)
      ),
      attackRange: Math.max(
        0.01,
        (baseStats.attackRange ?? 0.01) *
          normalizePositiveMultiplier(soldierConfig?.attackRangeMultiplier, 1)
      ),
    },
  };

  const runtimeGroup = new THREE.Group();
  runtimeGroup.name = "unified-mochi-soldier-runtime";
  hostGroup.add(runtimeGroup);
  mochiSoldierRuntimeInstanceCounter += 1;
  const runtimeInstancePrefix = `mochi-soldier-runtime-${mochiSoldierRuntimeInstanceCounter}`;
  const runtimeTargetIdPrefix = `${runtimeInstancePrefix}-mochi-soldier-`;

  const fallbackGeometry = new THREE.CapsuleGeometry(0.58, 1.15, 6, 14);
  const fallbackMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xf8d2a6,
    roughness: 0.38,
    metalness: 0.08,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.16,
  });
  const hitboxGeometry = new THREE.CapsuleGeometry(0.9, 1.56, 6, 12);
  const hitboxMaterialTemplate = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  resourceTracker.trackGeometry(fallbackGeometry);
  resourceTracker.trackGeometry(hitboxGeometry);
  resourceTracker.trackMaterial(fallbackMaterialTemplate);
  resourceTracker.trackMaterial(hitboxMaterialTemplate);

  const createLifecycle = () =>
    createMochiSoldierLifecycle({
      scene,
      group: runtimeGroup,
      attackTargets,
      isGameEnded,
      isBlocked,
      trackMesh: resourceTracker.trackMesh,
      fallbackGeometry,
      fallbackMaterialTemplate,
      hitboxGeometry,
      hitboxMaterialTemplate,
      profileOverride: resolvedProfile,
      idPrefix: "mochi-soldier",
      idNamespace: runtimeInstancePrefix,
    });

  let lifecycle = createLifecycle();
  let prototype: THREE.Object3D | null = null;
  let respawnAt = 0;

  const spawn = () => {
    lifecycle.spawn(spawnPosition.clone());
  };

  const rebuild = () => {
    lifecycle.dispose();
    lifecycle = createLifecycle();
    if (prototype) {
      lifecycle.setPrototype(prototype);
    }
  };

  spawn();

  const loader = new GLTFLoader();
  let isDisposed = false;
  loader.load(
    monster.path,
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        resourceTracker.disposeObjectResources(gltf.scene);
        return;
      }
      prototype = gltf.scene;
      normalizeMochiSoldierPrototype(prototype);
      resourceTracker.trackObject(prototype, {
        castShadow: true,
        receiveShadow: true,
      });
      lifecycle.setPrototype(prototype);
    },
    undefined,
    () => {}
  );

  const resolveState = (): UnifiedMonsterState => {
    const healthState = findBossHealthFromAttackTargets(attackTargets, (target) =>
      target.id.startsWith(runtimeTargetIdPrefix)
    );
    return {
      monsterId: monster.id,
      monsterLabel: monster.label,
      monsterHealth: Math.max(0, Math.floor(healthState.health)),
      monsterMaxHealth: Math.max(1, Math.floor(healthState.maxHealth || 1)),
      monsterAlive: lifecycle.getStats().alive > 0,
    };
  };

  return {
    tick: ({ now, delta, player, applyDamage }: PlayerWorldTickArgs) => {
      lifecycle.tick({
        now,
        delta,
        player,
        applyDamage,
      });
      const stats = lifecycle.getStats();
      if (allowRespawn && stats.spawned > 0 && stats.alive === 0 && respawnAt <= 0) {
        respawnAt = now + SOLDIER_RESPAWN_DELAY_MS;
      }
      if (allowRespawn && respawnAt > 0 && now >= respawnAt) {
        respawnAt = 0;
        rebuild();
        spawn();
      }
    },
    reset: () => {
      respawnAt = 0;
      rebuild();
      spawn();
    },
    getState: resolveState,
    dispose: () => {
      isDisposed = true;
      lifecycle.dispose();
      if (runtimeGroup.parent) {
        runtimeGroup.parent.remove(runtimeGroup);
      }
    },
  };
};
