import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Monster } from "../general";
import { mochiSoldierCombatConfig } from "./profile";

export type MochiSoldierRig = {
  body: THREE.Object3D | null;
  legLeft: THREE.Object3D | null;
  legRight: THREE.Object3D | null;
  armLeft: THREE.Object3D | null;
  armRight: THREE.Object3D | null;
  bodyBaseY: number;
  legLeftBaseX: number;
  legRightBaseX: number;
  armLeftBaseX: number;
  armRightBaseX: number;
};

export type MochiSoldierRuntimeState = {
  walkPhase: number;
  walkBlend: number;
  lastAttackAt: number;
  rig: MochiSoldierRig | null;
};

export type MochiSoldierRuntimeEntry = {
  anchor: THREE.Group;
  fallback: THREE.Mesh;
  model: THREE.Object3D | null;
  monster: Monster;
} & MochiSoldierRuntimeState;

export type MochiSoldierRemovableEntry = MochiSoldierRuntimeEntry & {
  id: string;
  hitbox: THREE.Object3D;
};

type SummonSmokeParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

export type MochiSoldierSummonFxRuntime = {
  spawn: (center: THREE.Vector3) => void;
  update: (delta: number) => void;
  dispose: () => void;
};

type DeathDissolveParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

export type MochiSoldierDeathFxRuntime = {
  spawn: (entry: MochiSoldierRuntimeEntry) => void;
  update: (delta: number) => void;
  dispose: () => void;
};

const moveTarget = new THREE.Vector3();
const summonSmokePosition = new THREE.Vector3();
const deathDissolveCenter = new THREE.Vector3();
const deathDissolveSpawnPosition = new THREE.Vector3();

const SUMMON_SMOKE_PARTICLE_COUNT = 22;
const SUMMON_SMOKE_RADIUS = 0.85;
const SUMMON_SMOKE_LIFE_MIN = 0.34;
const SUMMON_SMOKE_LIFE_MAX = 0.78;
const SUMMON_SMOKE_START_SCALE_MIN = 0.18;
const SUMMON_SMOKE_START_SCALE_MAX = 0.44;
const SUMMON_SMOKE_END_SCALE_MULTIPLIER_MIN = 1.8;
const SUMMON_SMOKE_END_SCALE_MULTIPLIER_MAX = 2.9;
const SUMMON_SMOKE_SPEED_MIN = 0.8;
const SUMMON_SMOKE_SPEED_MAX = 2.4;
const SUMMON_SMOKE_UPWARD_MIN = 1.1;
const SUMMON_SMOKE_UPWARD_MAX = 2.8;
const DEATH_DISSOLVE_PARTICLE_COUNT = 34;
const DEATH_DISSOLVE_HORIZONTAL_RADIUS = 0.62;
const DEATH_DISSOLVE_HEIGHT_MIN = 0.42;
const DEATH_DISSOLVE_HEIGHT_MAX = 1.98;
const DEATH_DISSOLVE_LIFE_MIN = 0.36;
const DEATH_DISSOLVE_LIFE_MAX = 0.92;
const DEATH_DISSOLVE_START_SCALE_MIN = 0.08;
const DEATH_DISSOLVE_START_SCALE_MAX = 0.24;
const DEATH_DISSOLVE_END_SCALE_MULTIPLIER_MIN = 1.4;
const DEATH_DISSOLVE_END_SCALE_MULTIPLIER_MAX = 2.8;
const DEATH_DISSOLVE_OUTWARD_SPEED_MIN = 1.4;
const DEATH_DISSOLVE_OUTWARD_SPEED_MAX = 4.1;
const DEATH_DISSOLVE_UPWARD_SPEED_MIN = 1.8;
const DEATH_DISSOLVE_UPWARD_SPEED_MAX = 4.8;

export const createMochiSoldierRuntimeState = (): MochiSoldierRuntimeState => ({
  walkPhase: Math.random() * Math.PI * 2,
  walkBlend: 0,
  lastAttackAt: 0,
  rig: null,
});

const resolveMochiSoldierRig = (model: THREE.Object3D): MochiSoldierRig => {
  let body: THREE.Object3D | null = null;
  let legLeft: THREE.Object3D | null = null;
  let legRight: THREE.Object3D | null = null;
  let armLeft: THREE.Object3D | null = null;
  let armRight: THREE.Object3D | null = null;

  model.traverse((child) => {
    const name = child.name.toLowerCase();
    if (!body && (name === "body" || name.includes("body"))) {
      body = child;
    }
    if (!legLeft && name.includes("legleft")) {
      legLeft = child;
    }
    if (!legRight && name.includes("legright")) {
      legRight = child;
    }
    if (!armLeft && name.includes("armleft")) {
      armLeft = child;
    }
    if (!armRight && name.includes("armright")) {
      armRight = child;
    }
  });

  return {
    body,
    legLeft,
    legRight,
    armLeft,
    armRight,
    bodyBaseY: body?.position.y ?? 0,
    legLeftBaseX: legLeft?.rotation.x ?? 0,
    legRightBaseX: legRight?.rotation.x ?? 0,
    armLeftBaseX: armLeft?.rotation.x ?? 0,
    armRightBaseX: armRight?.rotation.x ?? 0,
  };
};

export const cloneMochiSoldierMaterials = (object: THREE.Object3D) => {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material.clone());
    } else {
      mesh.material = mesh.material.clone();
    }
  });
};

export const normalizeMochiSoldierPrototype = (
  prototype: THREE.Object3D,
  targetHeight = 2.5
) => {
  const modelBounds = new THREE.Box3().setFromObject(prototype);
  const modelHeight = Math.max(0.001, modelBounds.max.y - modelBounds.min.y);
  prototype.scale.setScalar(targetHeight / modelHeight);
  prototype.updateMatrixWorld(true);

  modelBounds.setFromObject(prototype);
  prototype.position.y -= modelBounds.min.y;
  prototype.updateMatrixWorld(true);
};

export const attachMochiSoldierPrototype = ({
  entry,
  prototype,
  trackObject,
}: {
  entry: MochiSoldierRuntimeEntry;
  prototype: THREE.Object3D;
  trackObject: (
    object: THREE.Object3D,
    options?: {
      castShadow?: boolean;
      receiveShadow?: boolean;
    }
  ) => void;
}) => {
  if (entry.model || !entry.monster.isAlive) return;
  const model = cloneSkeleton(prototype);
  model.name = `${(entry.anchor.name || "mochi-soldier")}-model`;
  model.visible = true;
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.copy(prototype.scale);
  cloneMochiSoldierMaterials(model);
  trackObject(model, { castShadow: true, receiveShadow: true });
  entry.anchor.add(model);
  entry.model = model;
  entry.rig = resolveMochiSoldierRig(model);
  entry.fallback.visible = false;
  entry.monster.invalidateHitFlashMaterialCache();
};

export const clearMochiSoldierVisual = ({
  entry,
  disposeObjectResources,
}: {
  entry: MochiSoldierRuntimeEntry;
  disposeObjectResources: (object: THREE.Object3D) => void;
}) => {
  if (entry.model) {
    entry.anchor.remove(entry.model);
    disposeObjectResources(entry.model);
    entry.model = null;
  }
  entry.rig = null;
  if (entry.fallback.parent === entry.anchor) {
    entry.anchor.remove(entry.fallback);
  }
};

export const removeMochiSoldierEntry = <
  TEntry extends MochiSoldierRemovableEntry,
>({
  entry,
  entries,
  group,
  deathFxRuntime,
  removeAttackTarget,
  disposeObjectResources,
}: {
  entry: TEntry;
  entries: TEntry[];
  group: THREE.Group;
  deathFxRuntime: MochiSoldierDeathFxRuntime;
  removeAttackTarget: (id: string) => void;
  disposeObjectResources: (object: THREE.Object3D) => void;
}) => {
  if (!entry.monster.isAlive) {
    deathFxRuntime.spawn(entry);
  }
  removeAttackTarget(entry.id);
  clearMochiSoldierVisual({
    entry,
    disposeObjectResources,
  });
  if (entry.hitbox.parent === entry.anchor) {
    entry.anchor.remove(entry.hitbox);
  }
  entry.monster.dispose();
  if (entry.anchor.parent === group) {
    group.remove(entry.anchor);
  }
  const index = entries.indexOf(entry);
  if (index >= 0) {
    entries.splice(index, 1);
  }
};

const moveMochiSoldierTowardPlayer = ({
  entry,
  player,
  delta,
  isBlocked,
}: {
  entry: MochiSoldierRuntimeEntry;
  player: THREE.Object3D;
  delta: number;
  isBlocked: (x: number, z: number) => boolean;
}) => {
  player.getWorldPosition(moveTarget);
  const startX = entry.anchor.position.x;
  const startZ = entry.anchor.position.z;
  const dx = moveTarget.x - startX;
  const dz = moveTarget.z - startZ;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.00001) return 0;

  const step = entry.monster.stats.speed * delta;
  const ratio = Math.min(step / distance, 1);
  const candidateX = startX + dx * ratio;
  const candidateZ = startZ + dz * ratio;
  if (!isBlocked(candidateX, candidateZ)) {
    entry.anchor.position.x = candidateX;
    entry.anchor.position.z = candidateZ;
  } else {
    let moved = false;
    const slideX = startX + dx * ratio;
    if (!isBlocked(slideX, startZ)) {
      entry.anchor.position.x = slideX;
      moved = true;
    }
    const slideZ = startZ + dz * ratio;
    if (!isBlocked(entry.anchor.position.x, slideZ)) {
      entry.anchor.position.z = slideZ;
      moved = true;
    }
    if (!moved) return 0;
  }

  const movedDistance = Math.hypot(
    entry.anchor.position.x - startX,
    entry.anchor.position.z - startZ
  );
  if (movedDistance > 0.0001) {
    const moveDx = entry.anchor.position.x - startX;
    const moveDz = entry.anchor.position.z - startZ;
    entry.anchor.rotation.y = Math.atan2(moveDx, moveDz);
  }
  return movedDistance;
};

const applyMochiSoldierWalkAnimation = ({
  entry,
  delta,
  isMoving,
}: {
  entry: MochiSoldierRuntimeEntry;
  delta: number;
  isMoving: boolean;
}) => {
  const targetBlend = isMoving ? 1 : 0;
  entry.walkBlend = THREE.MathUtils.damp(entry.walkBlend, targetBlend, 8.5, delta);
  entry.walkPhase += delta * (3 + entry.walkBlend * 9);
  if (!entry.model || !entry.rig) {
    const swing = Math.sin(entry.walkPhase) * 0.14 * entry.walkBlend;
    const bounce = Math.max(0, Math.sin(entry.walkPhase * 2)) * 0.03 * entry.walkBlend;
    entry.fallback.rotation.x = swing;
    entry.fallback.position.y = 1.16 + bounce;
    return;
  }

  const rig = entry.rig;
  const legSwing = Math.sin(entry.walkPhase) * 0.56 * entry.walkBlend;
  const armSwing = legSwing * 0.45;
  const bodyBob = Math.max(0, Math.sin(entry.walkPhase * 2)) * 0.04 * entry.walkBlend;

  if (rig.legLeft) {
    rig.legLeft.rotation.x = rig.legLeftBaseX + legSwing;
  }
  if (rig.legRight) {
    rig.legRight.rotation.x = rig.legRightBaseX - legSwing;
  }
  if (rig.armLeft) {
    rig.armLeft.rotation.x = rig.armLeftBaseX - armSwing;
  }
  if (rig.armRight) {
    rig.armRight.rotation.x = rig.armRightBaseX + armSwing;
  }
  if (rig.body) {
    rig.body.position.y = rig.bodyBaseY + bodyBob;
  }
};

export const tickMochiSoldierCombat = ({
  entry,
  now,
  delta,
  player,
  gameEnded,
  isBlocked,
  applyDamage,
}: {
  entry: MochiSoldierRuntimeEntry;
  now: number;
  delta: number;
  player: THREE.Object3D;
  gameEnded: boolean;
  isBlocked: (x: number, z: number) => boolean;
  applyDamage: (amount: number) => number;
}) => {
  let isMoving = false;
  if (!gameEnded) {
    const detectRange = entry.monster.stats.aggroRange;
    let distance = entry.monster.distanceTo(player);
    if (distance <= detectRange) {
      if (distance > entry.monster.stats.attackRange + 0.15) {
        const movedDistance = moveMochiSoldierTowardPlayer({
          entry,
          player,
          delta,
          isBlocked,
        });
        isMoving = movedDistance > 0.0001;
        distance = entry.monster.distanceTo(player);
      }

      entry.monster.faceTarget(player);
      if (
        distance <= entry.monster.stats.attackRange + 0.15 &&
        now - entry.lastAttackAt >= mochiSoldierCombatConfig.attackCooldownMs
      ) {
        applyDamage(entry.monster.stats.attack);
        entry.lastAttackAt = now;
      }
    }
  }

  applyMochiSoldierWalkAnimation({
    entry,
    delta,
    isMoving,
  });
};

export const createMochiSoldierDeathFxRuntime = (
  scene: THREE.Scene
): MochiSoldierDeathFxRuntime => {
  const dissolveGeometry = new THREE.IcosahedronGeometry(1, 0);
  const dissolveMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xf8ede3,
    roughness: 0.56,
    metalness: 0,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles: DeathDissolveParticle[] = [];

  const removeParticleAt = (index: number) => {
    const particle = particles[index];
    if (!particle) return;
    if (particle.mesh.parent) {
      particle.mesh.parent.remove(particle.mesh);
    }
    particle.material.dispose();
    particles.splice(index, 1);
  };

  return {
    spawn: (entry) => {
      entry.anchor.getWorldPosition(deathDissolveCenter);
      for (let i = 0; i < DEATH_DISSOLVE_PARTICLE_COUNT; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * DEATH_DISSOLVE_HORIZONTAL_RADIUS;
        const life = THREE.MathUtils.lerp(
          DEATH_DISSOLVE_LIFE_MIN,
          DEATH_DISSOLVE_LIFE_MAX,
          Math.random()
        );
        const startScale = THREE.MathUtils.lerp(
          DEATH_DISSOLVE_START_SCALE_MIN,
          DEATH_DISSOLVE_START_SCALE_MAX,
          Math.random()
        );
        const endScale =
          startScale *
          THREE.MathUtils.lerp(
            DEATH_DISSOLVE_END_SCALE_MULTIPLIER_MIN,
            DEATH_DISSOLVE_END_SCALE_MULTIPLIER_MAX,
            Math.random()
          );

        const material = dissolveMaterialTemplate.clone();
        material.opacity = THREE.MathUtils.lerp(0.62, 0.94, Math.random());
        material.emissiveIntensity = THREE.MathUtils.lerp(0.2, 0.48, Math.random());
        if (Math.random() < 0.38) {
          material.color.set(0x2f2f2f);
          material.emissive.set(0x111111);
        }

        const particleMesh = new THREE.Mesh(dissolveGeometry, material);
        deathDissolveSpawnPosition.set(
          deathDissolveCenter.x + Math.cos(angle) * radius,
          deathDissolveCenter.y +
            THREE.MathUtils.lerp(
              DEATH_DISSOLVE_HEIGHT_MIN,
              DEATH_DISSOLVE_HEIGHT_MAX,
              Math.random()
            ),
          deathDissolveCenter.z + Math.sin(angle) * radius
        );
        particleMesh.position.copy(deathDissolveSpawnPosition);
        particleMesh.castShadow = false;
        particleMesh.receiveShadow = false;
        particleMesh.scale.setScalar(startScale);
        scene.add(particleMesh);

        const outwardSpeed = THREE.MathUtils.lerp(
          DEATH_DISSOLVE_OUTWARD_SPEED_MIN,
          DEATH_DISSOLVE_OUTWARD_SPEED_MAX,
          Math.random()
        );
        const upwardSpeed = THREE.MathUtils.lerp(
          DEATH_DISSOLVE_UPWARD_SPEED_MIN,
          DEATH_DISSOLVE_UPWARD_SPEED_MAX,
          Math.random()
        );
        particles.push({
          mesh: particleMesh,
          material,
          velocity: new THREE.Vector3(
            Math.cos(angle) * outwardSpeed + (Math.random() - 0.5) * 0.72,
            upwardSpeed,
            Math.sin(angle) * outwardSpeed + (Math.random() - 0.5) * 0.72
          ),
          spin: new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
          ),
          age: 0,
          life,
          startScale,
          endScale,
        });
      }
    },
    update: (delta) => {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.age += delta;
        const t = particle.life > 0 ? particle.age / particle.life : 1;
        if (t >= 1) {
          removeParticleAt(i);
          continue;
        }

        particle.mesh.position.addScaledVector(particle.velocity, delta);
        particle.velocity.multiplyScalar(0.95);
        particle.velocity.y += 0.44 * delta;
        particle.mesh.rotation.x += particle.spin.x * delta;
        particle.mesh.rotation.y += particle.spin.y * delta;
        particle.mesh.rotation.z += particle.spin.z * delta;

        particle.mesh.scale.setScalar(
          THREE.MathUtils.lerp(particle.startScale, particle.endScale, t)
        );
        const fade = Math.max(0, 1 - t);
        particle.material.opacity = fade * fade * 0.9;
      }
    },
    dispose: () => {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        removeParticleAt(i);
      }
      dissolveGeometry.dispose();
      dissolveMaterialTemplate.dispose();
    },
  };
};

export const createMochiSoldierSummonFxRuntime = (
  scene: THREE.Scene
): MochiSoldierSummonFxRuntime => {
  const smokeGeometry = new THREE.SphereGeometry(1, 10, 8);
  const smokeMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xe7d9c7,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    emissive: 0x78350f,
    emissiveIntensity: 0.2,
  });

  const particles: SummonSmokeParticle[] = [];

  const removeParticleAt = (index: number) => {
    const particle = particles[index];
    if (!particle) return;
    if (particle.mesh.parent) {
      particle.mesh.parent.remove(particle.mesh);
    }
    particle.material.dispose();
    particles.splice(index, 1);
  };

  return {
    spawn: (center) => {
      for (let i = 0; i < SUMMON_SMOKE_PARTICLE_COUNT; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * SUMMON_SMOKE_RADIUS;
        const life = THREE.MathUtils.lerp(
          SUMMON_SMOKE_LIFE_MIN,
          SUMMON_SMOKE_LIFE_MAX,
          Math.random()
        );
        const startScale = THREE.MathUtils.lerp(
          SUMMON_SMOKE_START_SCALE_MIN,
          SUMMON_SMOKE_START_SCALE_MAX,
          Math.random()
        );
        const endScale =
          startScale *
          THREE.MathUtils.lerp(
            SUMMON_SMOKE_END_SCALE_MULTIPLIER_MIN,
            SUMMON_SMOKE_END_SCALE_MULTIPLIER_MAX,
            Math.random()
          );
        const material = smokeMaterialTemplate.clone();
        material.opacity = THREE.MathUtils.lerp(0.48, 0.84, Math.random());
        material.emissiveIntensity = THREE.MathUtils.lerp(0.12, 0.28, Math.random());

        const puff = new THREE.Mesh(smokeGeometry, material);
        summonSmokePosition.set(
          center.x + Math.cos(angle) * radius,
          center.y + 0.12 + Math.random() * 0.42,
          center.z + Math.sin(angle) * radius
        );
        puff.position.copy(summonSmokePosition);
        puff.castShadow = false;
        puff.receiveShadow = false;
        puff.scale.setScalar(startScale);
        scene.add(puff);

        const outwardSpeed = THREE.MathUtils.lerp(
          SUMMON_SMOKE_SPEED_MIN,
          SUMMON_SMOKE_SPEED_MAX,
          Math.random()
        );
        const upwardSpeed = THREE.MathUtils.lerp(
          SUMMON_SMOKE_UPWARD_MIN,
          SUMMON_SMOKE_UPWARD_MAX,
          Math.random()
        );
        particles.push({
          mesh: puff,
          material,
          velocity: new THREE.Vector3(
            Math.cos(angle) * outwardSpeed + (Math.random() - 0.5) * 0.5,
            upwardSpeed,
            Math.sin(angle) * outwardSpeed + (Math.random() - 0.5) * 0.5
          ),
          spin: new THREE.Vector3(
            (Math.random() - 0.5) * 2.2,
            (Math.random() - 0.5) * 2.2,
            (Math.random() - 0.5) * 2.2
          ),
          age: 0,
          life,
          startScale,
          endScale,
        });
      }
    },
    update: (delta) => {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.age += delta;
        const t = particle.life > 0 ? particle.age / particle.life : 1;

        if (t >= 1) {
          removeParticleAt(i);
          continue;
        }

        particle.mesh.position.addScaledVector(particle.velocity, delta);
        particle.velocity.multiplyScalar(0.976);
        particle.velocity.y += 0.42 * delta;
        particle.mesh.rotation.x += particle.spin.x * delta;
        particle.mesh.rotation.y += particle.spin.y * delta;
        particle.mesh.rotation.z += particle.spin.z * delta;

        const scale = THREE.MathUtils.lerp(
          particle.startScale,
          particle.endScale,
          t
        );
        particle.mesh.scale.setScalar(scale);
        const fade = Math.max(0, 1 - t);
        particle.material.opacity = fade * fade * 0.84;
      }
    },
    dispose: () => {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        removeParticleAt(i);
      }
      smokeGeometry.dispose();
      smokeMaterialTemplate.dispose();
    },
  };
};
