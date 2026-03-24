import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  PlayerAttackTarget,
  PlayerWorldTickArgs,
} from "../../character/general/player";
import { Monster } from "../general";
import {
  normalizeModelToHeight,
  removeAttackTargetById,
} from "./runtimeUtils";
import type {
  UnifiedMonsterRuntime,
  UnifiedMonsterRuntimeHost,
  UnifiedMonsterState,
} from "./types";

const FALLBACK_RESPAWN_DELAY_MS = 1600;
const FALLBACK_ATTACK_COOLDOWN_MS = 950;

const resolveFallbackConfig = (monsterId: string) => {
  const key = monsterId.toLowerCase();
  if (key === "tester") {
    return {
      health: 1000,
      attackDamage: 14,
      moveSpeed: 2.75,
      attackRange: 2.1,
      targetHeight: 2.8,
    };
  }
  return {
    health: 1400,
    attackDamage: 16,
    moveSpeed: 2.65,
    attackRange: 2.2,
    targetHeight: 4,
  };
};

export const createFallbackMonsterRuntime = (
  host: UnifiedMonsterRuntimeHost
): UnifiedMonsterRuntime => {
  const {
    monster,
    hostGroup,
    resourceTracker,
    spawnPosition,
    attackTargets,
    bounds,
    isBlocked,
    runtimeOptions,
  } = host;
  const runtimeConfig = resolveFallbackConfig(monster.id);
  const allowRespawn = runtimeOptions?.respawnOnDefeat !== false;
  const isGameEnded = runtimeOptions?.isGameEnded ?? (() => false);

  const runtimeGroup = new THREE.Group();
  runtimeGroup.name = `unified-fallback-runtime-${monster.id}`;
  hostGroup.add(runtimeGroup);

  const monsterAnchor = new THREE.Group();
  monsterAnchor.name = `${monster.id}-anchor`;
  monsterAnchor.position.copy(spawnPosition);
  runtimeGroup.add(monsterAnchor);

  const modelRoot = new THREE.Group();
  modelRoot.name = `${monster.id}-model-root`;
  monsterAnchor.add(modelRoot);

  const fallbackBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(1, 2.3, 6, 16),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.46,
      metalness: 0.14,
      emissive: 0x1e293b,
      emissiveIntensity: 0.35,
    })
  );
  fallbackBody.position.y = 2.2;
  modelRoot.add(fallbackBody);
  resourceTracker.trackMesh(fallbackBody);

  const hitbox = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.76, 2.4, 6, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  hitbox.position.set(0, 2, 0);
  monsterAnchor.add(hitbox);
  resourceTracker.trackMesh(hitbox);

  const monsterRuntime = new Monster({
    model: monsterAnchor,
    profile: {
      id: monster.id,
      label: monster.label,
      stats: {
        health: runtimeConfig.health,
        attack: runtimeConfig.attackDamage,
        defense: 0,
        speed: runtimeConfig.moveSpeed,
        aggroRange: 120,
        attackRange: runtimeConfig.attackRange,
      },
    },
  });

  const attackTargetId = `unified-fallback-${monster.id}`;
  const attackTarget: PlayerAttackTarget = {
    id: attackTargetId,
    object: hitbox,
    category: "boss",
    label: monster.label,
    isActive: () => monsterRuntime.isAlive,
    getHealth: () => monsterRuntime.health,
    getMaxHealth: () => monsterRuntime.maxHealth,
    onHit: (hit) => {
      if (!monsterRuntime.isAlive) return;
      const applied = monsterRuntime.takeDamage(Math.max(1, Math.round(hit.damage)));
      if (applied <= 0) return;
      if (!monsterRuntime.isAlive) {
        onMonsterDown(hit.now);
      }
    },
  };
  attackTargets.push(attackTarget);

  let respawnAt = 0;
  let nextAttackAt = performance.now() + FALLBACK_ATTACK_COOLDOWN_MS;

  const onMonsterDown = (now: number) => {
    monsterAnchor.visible = false;
    respawnAt = allowRespawn ? now + FALLBACK_RESPAWN_DELAY_MS : 0;
  };

  const reset = (now: number) => {
    monsterRuntime.revive(1);
    monsterAnchor.visible = true;
    monsterAnchor.position.copy(spawnPosition);
    monsterAnchor.rotation.set(0, 0, 0);
    respawnAt = 0;
    nextAttackAt = now + FALLBACK_ATTACK_COOLDOWN_MS;
  };

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
      const model = gltf.scene;
      normalizeModelToHeight(model, runtimeConfig.targetHeight);
      while (modelRoot.children.length > 0) {
        modelRoot.remove(modelRoot.children[0]);
      }
      modelRoot.add(model);
      resourceTracker.trackObject(model, { castShadow: true, receiveShadow: true });
      monsterRuntime.invalidateHitFlashMaterialCache();
    },
    undefined,
    () => {}
  );

  return {
    tick: ({ now, delta, player, applyDamage }: PlayerWorldTickArgs) => {
      if (!monsterRuntime.isAlive) {
        if (allowRespawn && respawnAt > 0 && now >= respawnAt) {
          reset(now);
        }
        return;
      }
      if (isGameEnded()) return;

      monsterRuntime.faceTarget(player);
      let distance = monsterRuntime.distanceTo(player);
      if (distance > monsterRuntime.stats.attackRange * 0.9) {
        monsterRuntime.moveToward(player, delta);
        monsterAnchor.position.x = THREE.MathUtils.clamp(
          monsterAnchor.position.x,
          bounds.minX + 1,
          bounds.maxX - 1
        );
        monsterAnchor.position.z = THREE.MathUtils.clamp(
          monsterAnchor.position.z,
          bounds.minZ + 1,
          bounds.maxZ - 1
        );
        if (isBlocked(monsterAnchor.position.x, monsterAnchor.position.z)) {
          monsterAnchor.position.copy(spawnPosition);
        }
        distance = monsterRuntime.distanceTo(player);
      }

      if (distance <= monsterRuntime.stats.attackRange && now >= nextAttackAt) {
        applyDamage(monsterRuntime.stats.attack);
        nextAttackAt = now + FALLBACK_ATTACK_COOLDOWN_MS;
      }
    },
    reset,
    getState: (): UnifiedMonsterState => ({
      monsterId: monster.id,
      monsterLabel: monster.label,
      monsterHealth: Math.max(0, Math.floor(monsterRuntime.health)),
      monsterMaxHealth: Math.max(1, Math.floor(monsterRuntime.maxHealth)),
      monsterAlive: monsterRuntime.isAlive,
    }),
    dispose: () => {
      isDisposed = true;
      removeAttackTargetById(attackTargets, attackTargetId);
      monsterRuntime.dispose();
      if (runtimeGroup.parent) {
        runtimeGroup.parent.remove(runtimeGroup);
      }
    },
  };
};
