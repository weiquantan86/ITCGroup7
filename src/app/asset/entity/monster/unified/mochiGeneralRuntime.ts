import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { PlayerWorldTickArgs } from "../../character/general/player";
import { createMochiGeneralBossLifecycle } from "../mochiGeneral/lifecycle";
import { createMochiSoldierLifecycle } from "../mochiSoldier/lifecycle";
import { normalizeMochiSoldierPrototype } from "../mochiSoldier/runtime";
import { findBossHealthFromAttackTargets } from "./runtimeUtils";
import type {
  UnifiedMonsterRuntime,
  UnifiedMonsterRuntimeHost,
  UnifiedMonsterState,
} from "./types";

const BOSS_RESPAWN_DELAY_MS = 1700;

export const createMochiGeneralUnifiedRuntime = (
  host: UnifiedMonsterRuntimeHost
): UnifiedMonsterRuntime => {
  const {
    scene,
    hostGroup,
    resourceTracker,
    attackTargets,
    isBlocked,
    groundY,
    monster,
    spawnPosition,
    runtimeOptions,
  } = host;
  const allowRespawn = runtimeOptions?.respawnOnDefeat !== false;
  const isGameEnded = runtimeOptions?.isGameEnded ?? (() => false);
  const generalConfig = runtimeOptions?.mochiGeneral;

  const runtimeGroup = new THREE.Group();
  runtimeGroup.name = "unified-mochi-general-runtime";
  hostGroup.add(runtimeGroup);

  const bossesGroup = new THREE.Group();
  bossesGroup.name = "unified-mochi-general-bosses";
  runtimeGroup.add(bossesGroup);
  const soldiersGroup = new THREE.Group();
  soldiersGroup.name = "unified-mochi-general-soldiers";
  runtimeGroup.add(soldiersGroup);

  const bossFallbackGeometry = new THREE.CapsuleGeometry(2.1375, 3.0375, 7, 16);
  const bossFallbackMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xddd6fe,
    roughness: 0.34,
    metalness: 0.12,
    emissive: 0x581c87,
    emissiveIntensity: 0.18,
  });
  const bossHitboxGeometry = new THREE.CapsuleGeometry(2.8125, 4.32, 7, 14);
  const soldierFallbackGeometry = new THREE.CapsuleGeometry(0.58, 1.15, 6, 14);
  const soldierFallbackMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xf8d2a6,
    roughness: 0.38,
    metalness: 0.08,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.16,
  });
  const soldierHitboxGeometry = new THREE.CapsuleGeometry(0.9, 1.56, 6, 12);
  const hitboxMaterialTemplate = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  resourceTracker.trackGeometry(bossFallbackGeometry);
  resourceTracker.trackGeometry(bossHitboxGeometry);
  resourceTracker.trackGeometry(soldierFallbackGeometry);
  resourceTracker.trackGeometry(soldierHitboxGeometry);
  resourceTracker.trackMaterial(bossFallbackMaterialTemplate);
  resourceTracker.trackMaterial(soldierFallbackMaterialTemplate);
  resourceTracker.trackMaterial(hitboxMaterialTemplate);

  const createSoldierLifecycle = () =>
    createMochiSoldierLifecycle({
      scene,
      group: soldiersGroup,
      attackTargets,
      isGameEnded,
      isBlocked,
      trackMesh: resourceTracker.trackMesh,
      fallbackGeometry: soldierFallbackGeometry,
      fallbackMaterialTemplate: soldierFallbackMaterialTemplate,
      hitboxGeometry: soldierHitboxGeometry,
      hitboxMaterialTemplate,
      idPrefix: "mochi-general-summon",
    });

  const createBossLifecycle = (soldierLifecycle: ReturnType<typeof createMochiSoldierLifecycle>) =>
    createMochiGeneralBossLifecycle({
      scene,
      group: bossesGroup,
      attackTargets,
      isGameEnded,
      isBlocked,
      groundY,
      maxBosses: Math.max(1, Math.floor(generalConfig?.maxBosses ?? 1)),
      onSummonSoldier: (position) => {
        soldierLifecycle.spawn(position);
      },
      trackMesh: resourceTracker.trackMesh,
      fallbackGeometry: bossFallbackGeometry,
      fallbackMaterialTemplate: bossFallbackMaterialTemplate,
      hitboxGeometry: bossHitboxGeometry,
      hitboxMaterialTemplate,
      damageMultiplier: generalConfig?.damageMultiplier,
      defenseRatio: generalConfig?.defenseRatio,
      tempoMultiplier: generalConfig?.tempoMultiplier,
    });

  let soldierLifecycle = createSoldierLifecycle();
  let bossLifecycle = createBossLifecycle(soldierLifecycle);
  let bossPrototype: THREE.Object3D | null = null;
  let soldierPrototype: THREE.Object3D | null = null;
  let respawnAt = 0;
  let isDisposed = false;

  const spawnBoss = () => {
    bossLifecycle.spawn(spawnPosition.clone());
  };

  const rebuild = () => {
    bossLifecycle.dispose();
    soldierLifecycle.dispose();
    soldierLifecycle = createSoldierLifecycle();
    bossLifecycle = createBossLifecycle(soldierLifecycle);
    if (bossPrototype) {
      bossLifecycle.setPrototype(bossPrototype);
    }
    if (soldierPrototype) {
      soldierLifecycle.setPrototype(soldierPrototype);
    }
  };

  spawnBoss();

  const loader = new GLTFLoader();
  loader.load(
    monster.path,
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        resourceTracker.disposeObjectResources(gltf.scene);
        return;
      }
      const prototype = gltf.scene;
      const modelBounds = new THREE.Box3().setFromObject(prototype);
      const modelHeight = Math.max(0.001, modelBounds.max.y - modelBounds.min.y);
      const targetHeight = 6.975;
      prototype.scale.setScalar(targetHeight / modelHeight);
      prototype.updateMatrixWorld(true);
      modelBounds.setFromObject(prototype);
      prototype.position.y -= modelBounds.min.y;
      prototype.updateMatrixWorld(true);
      resourceTracker.trackObject(prototype, {
        castShadow: true,
        receiveShadow: true,
      });
      bossPrototype = prototype;
      bossLifecycle.setPrototype(prototype);
    },
    undefined,
    () => {}
  );

  loader.load(
    "/assets/monsters/mochiSoldier/mochiSoldier.glb",
    (gltf) => {
      if (!gltf?.scene) return;
      if (isDisposed) {
        resourceTracker.disposeObjectResources(gltf.scene);
        return;
      }
      soldierPrototype = gltf.scene;
      normalizeMochiSoldierPrototype(soldierPrototype);
      resourceTracker.trackObject(soldierPrototype, {
        castShadow: true,
        receiveShadow: true,
      });
      soldierLifecycle.setPrototype(soldierPrototype);
    },
    undefined,
    () => {}
  );

  const resolveState = (): UnifiedMonsterState => {
    const healthState = findBossHealthFromAttackTargets(attackTargets, (target) => {
      return (
        target.id.startsWith("mochi-general-") &&
        !target.id.startsWith("mochi-general-summon-")
      );
    });
    return {
      monsterId: monster.id,
      monsterLabel: monster.label,
      monsterHealth: Math.max(0, Math.floor(healthState.health)),
      monsterMaxHealth: Math.max(1, Math.floor(healthState.maxHealth || 1)),
      monsterAlive: bossLifecycle.getStats().alive > 0,
    };
  };

  return {
    tick: ({
      now,
      delta,
      player,
      applyDamage,
      applyStatusEffect,
      projectileBlockers,
      handleProjectileBlockHit,
    }: PlayerWorldTickArgs) => {
      bossLifecycle.tick({
        now,
        delta,
        player,
        applyDamage,
        applyStatusEffect,
        projectileBlockers,
        handleProjectileBlockHit,
      });
      soldierLifecycle.tick({
        now,
        delta,
        player,
        applyDamage,
      });

      const bossStats = bossLifecycle.getStats();
      if (allowRespawn && bossStats.spawned > 0 && bossStats.alive === 0 && respawnAt <= 0) {
        respawnAt = now + BOSS_RESPAWN_DELAY_MS;
      }
      if (allowRespawn && respawnAt > 0 && now >= respawnAt) {
        respawnAt = 0;
        rebuild();
        spawnBoss();
      }
    },
    reset: () => {
      respawnAt = 0;
      rebuild();
      spawnBoss();
    },
    getState: resolveState,
    dispose: () => {
      isDisposed = true;
      bossLifecycle.dispose();
      soldierLifecycle.dispose();
      if (runtimeGroup.parent) {
        runtimeGroup.parent.remove(runtimeGroup);
      }
    },
  };
};
