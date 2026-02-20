import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { PlayerAttackTarget } from "../../character/general/player";
import type { StatusEffectApplication } from "../../character/general/types";
import type { ProjectileBlockHitHandler } from "../../../object/projectile/blocking";
import { Monster } from "../general";
import type { MochiGeneralCombatEntry } from "./combatBehavior";
import {
  createMochiGeneralCombatState,
  isMochiGeneralDamageImmune,
  resetMochiGeneralCombatState,
  resolveMochiGeneralRig,
} from "./combatBehavior";
import { createMochiGeneralCombatRuntime } from "./combatRuntime";
import { mochiGeneralProfile } from "./profile";

type EntranceSmokeParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

type PreparedBossModel = {
  model: THREE.Object3D;
  rig: MochiGeneralCombatEntry["rig"];
};

export type MochiGeneralBossEntry = {
  id: string;
  hitbox: THREE.Mesh;
} & MochiGeneralCombatEntry;

export type MochiGeneralBossLifecycleStats = {
  spawned: number;
  alive: number;
  defeated: number;
};

export type MochiGeneralBossLifecycle = {
  spawn: (position: THREE.Vector3) => boolean;
  setPrototype: (prototype: THREE.Object3D | null) => void;
  tick: (args: {
    now: number;
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
    applyStatusEffect: (effect: StatusEffectApplication) => boolean;
    projectileBlockers: THREE.Object3D[];
    handleProjectileBlockHit?: ProjectileBlockHitHandler;
  }) => void;
  getStats: () => MochiGeneralBossLifecycleStats;
  drainDefeatedCount: () => number;
  dispose: () => void;
};

const BOSS_ENTRANCE_SMOKE_COUNT = 96;
const BOSS_ENTRANCE_SMOKE_POOL_SIZE = BOSS_ENTRANCE_SMOKE_COUNT;

export const createMochiGeneralBossLifecycle = ({
  scene,
  group,
  attackTargets,
  isGameEnded,
  isBlocked,
  groundY,
  maxBosses,
  onSummonSoldier,
  trackMesh,
  trackObject,
  disposeObjectResources,
  fallbackGeometry,
  fallbackMaterialTemplate,
  hitboxGeometry,
  hitboxMaterialTemplate,
  onBossDamaged,
}: {
  scene: THREE.Scene;
  group: THREE.Group;
  attackTargets: PlayerAttackTarget[];
  isGameEnded: () => boolean;
  isBlocked: (x: number, z: number) => boolean;
  groundY: number;
  maxBosses: number;
  onSummonSoldier: (position: THREE.Vector3) => void;
  trackMesh: (mesh: THREE.Mesh) => void;
  trackObject: (
    object: THREE.Object3D,
    options?: {
      castShadow?: boolean;
      receiveShadow?: boolean;
    }
  ) => void;
  disposeObjectResources: (object: THREE.Object3D) => void;
  fallbackGeometry: THREE.BufferGeometry;
  fallbackMaterialTemplate: THREE.Material;
  hitboxGeometry: THREE.BufferGeometry;
  hitboxMaterialTemplate: THREE.Material;
  onBossDamaged?: (appliedDamage: number) => void;
}): MochiGeneralBossLifecycle => {
  const entries: MochiGeneralBossEntry[] = [];
  const combatRuntime = createMochiGeneralCombatRuntime(scene);
  const smokeGroup = new THREE.Group();
  smokeGroup.name = "mochiGeneralEntranceSmoke";
  scene.add(smokeGroup);

  const smokeGeometry = new THREE.SphereGeometry(1, 12, 10);
  const smokeMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0x7a8597,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    emissive: 0x111827,
    emissiveIntensity: 0.24,
  });
  const activeSmokeParticles: EntranceSmokeParticle[] = [];
  const idleSmokeParticles: EntranceSmokeParticle[] = [];
  const preparedBossModels: PreparedBossModel[] = [];

  let prototype: THREE.Object3D | null = null;
  let spawned = 0;
  let defeated = 0;
  let pendingDefeated = 0;

  const createPreparedBossModel = (): PreparedBossModel | null => {
    if (!prototype) return null;
    const model = cloneSkeleton(prototype);
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.copy(prototype.scale);
    model.userData.mochiGeneralBaseScale = prototype.scale.clone();
    trackObject(model, { castShadow: true, receiveShadow: true });
    const rig = resolveMochiGeneralRig(model);
    return { model, rig };
  };

  const clearPreparedBossModels = () => {
    while (preparedBossModels.length > 0) {
      const prepared = preparedBossModels.pop();
      if (!prepared) continue;
      if (prepared.model.parent) {
        prepared.model.parent.remove(prepared.model);
      }
    }
  };

  const refillPreparedBossModels = () => {
    if (!prototype) return;
    const remainingSpawns = Math.max(0, maxBosses - spawned);
    while (preparedBossModels.length < remainingSpawns) {
      const prepared = createPreparedBossModel();
      if (!prepared) break;
      preparedBossModels.push(prepared);
    }
  };

  const takePreparedBossModel = () => {
    const prepared = preparedBossModels.pop();
    if (prepared) return prepared;
    return createPreparedBossModel();
  };

  const createEntranceSmokeParticle = (): EntranceSmokeParticle => {
    const material = smokeMaterialTemplate.clone();
    const mesh = new THREE.Mesh(smokeGeometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.visible = false;
    smokeGroup.add(mesh);
    return {
      mesh,
      material,
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      age: 0,
      life: 1,
      startScale: 1,
      endScale: 1,
    };
  };

  for (let i = 0; i < BOSS_ENTRANCE_SMOKE_POOL_SIZE; i += 1) {
    idleSmokeParticles.push(createEntranceSmokeParticle());
  }

  const removeAttackTarget = (id: string) => {
    const index = attackTargets.findIndex((target) => target.id === id);
    if (index < 0) return;
    attackTargets.splice(index, 1);
  };

  const attachPrototype = (entry: MochiGeneralBossEntry) => {
    if (!prototype || entry.model || !entry.monster.isAlive) return;
    const prepared = takePreparedBossModel();
    if (!prepared) return;
    const { model, rig } = prepared;
    model.name = `${entry.id}-model`;
    model.visible = true;
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.copy(prototype.scale);
    model.userData.mochiGeneralBaseScale = prototype.scale.clone();
    entry.anchor.add(model);
    entry.model = model;
    entry.rig = rig;
    entry.fallback.visible = false;
    entry.monster.invalidateHitFlashMaterialCache();
    refillPreparedBossModels();
  };

  const clearBossVisual = (entry: MochiGeneralBossEntry) => {
    if (entry.model) {
      entry.anchor.remove(entry.model);
      disposeObjectResources(entry.model);
      entry.model = null;
    }
    resetMochiGeneralCombatState(entry);
    if (entry.fallback.parent === entry.anchor) {
      entry.anchor.remove(entry.fallback);
    }
    if (entry.hitbox.parent === entry.anchor) {
      entry.anchor.remove(entry.hitbox);
    }
  };

  const removeBossEntry = (
    entry: MochiGeneralBossEntry,
    countedAsDefeat: boolean
  ) => {
    if (countedAsDefeat) {
      defeated += 1;
      pendingDefeated += 1;
    }
    removeAttackTarget(entry.id);
    combatRuntime.onBossRemoved(entry);
    clearBossVisual(entry);
    entry.monster.dispose();
    if (entry.anchor.parent === group) {
      group.remove(entry.anchor);
    }
    const index = entries.indexOf(entry);
    if (index >= 0) {
      entries.splice(index, 1);
    }
  };

  const spawnEntranceSmoke = (center: THREE.Vector3) => {
    for (let i = 0; i < BOSS_ENTRANCE_SMOKE_COUNT; i += 1) {
      const particle = idleSmokeParticles.pop();
      if (!particle) break;

      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 5.2;
      const outwardSpeed = 2.1 + Math.random() * 6.2;
      const upwardSpeed = 2.6 + Math.random() * 6.8;
      const life = 1.1 + Math.random() * 1.4;
      const startScale = 1.1 + Math.random() * 2.2;
      const endScale = startScale * (2.7 + Math.random() * 1.9);

      const brightness = 0.78 + Math.random() * 0.34;
      const { mesh, material } = particle;
      material.color.copy(smokeMaterialTemplate.color).multiplyScalar(brightness);
      material.emissive.copy(smokeMaterialTemplate.emissive);
      material.emissiveIntensity = smokeMaterialTemplate.emissiveIntensity;
      material.opacity = 0.5 + Math.random() * 0.38;

      mesh.position.set(
        center.x + Math.cos(angle) * radius,
        groundY + 0.35 + Math.random() * 2.8,
        center.z + Math.sin(angle) * radius
      );
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      mesh.scale.setScalar(startScale);
      mesh.visible = true;

      particle.velocity.set(
        Math.cos(angle) * outwardSpeed + (Math.random() - 0.5) * 1.2,
        upwardSpeed,
        Math.sin(angle) * outwardSpeed + (Math.random() - 0.5) * 1.2
      );
      particle.spin.set(
        (Math.random() - 0.5) * 2.8,
        (Math.random() - 0.5) * 2.8,
        (Math.random() - 0.5) * 2.8
      );
      particle.age = 0;
      particle.life = life;
      particle.startScale = startScale;
      particle.endScale = endScale;
      activeSmokeParticles.push(particle);
    }
  };

  const updateEntranceSmoke = (delta: number) => {
    for (let i = activeSmokeParticles.length - 1; i >= 0; i -= 1) {
      const particle = activeSmokeParticles[i];
      particle.age += delta;
      const t = particle.life > 0 ? particle.age / particle.life : 1;

      if (t >= 1) {
        particle.mesh.visible = false;
        activeSmokeParticles.splice(i, 1);
        idleSmokeParticles.push(particle);
        continue;
      }

      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.velocity.multiplyScalar(0.986);
      particle.velocity.y += 0.62 * delta;

      particle.mesh.rotation.x += particle.spin.x * delta;
      particle.mesh.rotation.y += particle.spin.y * delta;
      particle.mesh.rotation.z += particle.spin.z * delta;

      particle.mesh.scale.setScalar(
        THREE.MathUtils.lerp(particle.startScale, particle.endScale, t)
      );
      const fade = Math.max(0, 1 - t);
      particle.material.opacity = fade * fade * 0.82;
    }
  };

  return {
    spawn: (position) => {
      if (spawned >= maxBosses) return false;

      const id = `mochi-general-${spawned + 1}`;
      const anchor = new THREE.Group();
      anchor.name = `${id}-anchor`;
      anchor.position.copy(position);
      group.add(anchor);

      const fallback = new THREE.Mesh(
        fallbackGeometry,
        fallbackMaterialTemplate.clone()
      );
      fallback.name = `${id}-fallback`;
      fallback.position.y = 2.745;
      fallback.castShadow = true;
      fallback.receiveShadow = true;
      anchor.add(fallback);

      const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterialTemplate.clone());
      hitbox.name = `${id}-hitbox`;
      hitbox.position.y = 3.0375;
      hitbox.castShadow = false;
      hitbox.receiveShadow = false;
      anchor.add(hitbox);

      trackMesh(fallback);
      trackMesh(hitbox);

      const monster = new Monster({
        model: anchor,
        profile: mochiGeneralProfile,
        spawn: {
          position: position.clone(),
          yaw: Math.PI,
        },
      });

      const entry: MochiGeneralBossEntry = {
        id,
        anchor,
        hitbox,
        fallback,
        model: null,
        monster,
        ...createMochiGeneralCombatState(),
      };

      entries.push(entry);
      spawned += 1;

      attackTargets.push({
        id,
        object: hitbox,
        isActive: () => !isGameEnded() && entry.monster.isAlive,
        category: "boss",
        label: mochiGeneralProfile.label,
        getHealth: () => entry.monster.health,
        getMaxHealth: () => entry.monster.maxHealth,
        onHit: (hit) => {
          if (isGameEnded() || !entry.monster.isAlive) return;
          if (isMochiGeneralDamageImmune(entry)) return;
          const applied = entry.monster.takeDamage(hit.damage);
          if (applied <= 0) return;
          onBossDamaged?.(applied);
          if (!entry.monster.isAlive) {
            removeBossEntry(entry, true);
          }
        },
      });

      attachPrototype(entry);
      spawnEntranceSmoke(position);
      return true;
    },
    setPrototype: (nextPrototype) => {
      clearPreparedBossModels();
      prototype = nextPrototype;
      if (!prototype) return;
      for (let i = 0; i < entries.length; i += 1) {
        attachPrototype(entries[i]);
      }
      refillPreparedBossModels();
    },
    tick: ({
      now,
      delta,
      player,
      applyDamage,
      applyStatusEffect,
      projectileBlockers,
      handleProjectileBlockHit,
    }) => {
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const entry = entries[i];
        if (!entry.monster.isAlive) {
          removeBossEntry(entry, true);
          continue;
        }
        combatRuntime.tickBoss({
          entry,
          delta,
          player,
          gameEnded: isGameEnded(),
          isBlocked,
          applyDamage,
          summonSkill3Soldier: ({ position }) => {
            onSummonSoldier(position);
          },
        });
        if (isGameEnded()) break;
      }

      combatRuntime.update({
        now,
        delta,
        player,
        applyDamage,
        applyStatusEffect,
        gameEnded: isGameEnded(),
        projectileBlockers,
        handleProjectileBlockHit,
      });
      updateEntranceSmoke(delta);
    },
    getStats: () => ({
      spawned,
      alive: entries.length,
      defeated,
    }),
    drainDefeatedCount: () => {
      const drained = pendingDefeated;
      pendingDefeated = 0;
      return drained;
    },
    dispose: () => {
      for (let i = activeSmokeParticles.length - 1; i >= 0; i -= 1) {
        const particle = activeSmokeParticles[i];
        if (particle.mesh.parent) particle.mesh.parent.remove(particle.mesh);
        particle.material.dispose();
      }
      for (let i = idleSmokeParticles.length - 1; i >= 0; i -= 1) {
        const particle = idleSmokeParticles[i];
        if (particle.mesh.parent) particle.mesh.parent.remove(particle.mesh);
        particle.material.dispose();
      }
      activeSmokeParticles.length = 0;
      idleSmokeParticles.length = 0;
      smokeGeometry.dispose();
      smokeMaterialTemplate.dispose();
      while (entries.length > 0) {
        removeBossEntry(entries[0], false);
      }
      clearPreparedBossModels();
      combatRuntime.dispose();
      if (smokeGroup.parent === scene) {
        scene.remove(smokeGroup);
      }
      prototype = null;
    },
  };
};
