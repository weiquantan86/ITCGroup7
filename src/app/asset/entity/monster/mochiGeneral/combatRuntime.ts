import * as THREE from "three";
import type { MochiGeneralCombatEntry } from "./combatBehavior";
import { tickMochiGeneralCombat } from "./combatBehavior";
import { createMochiGeneralSkill1Runtime } from "./skill1Runtime";
import { createMochiGeneralSkill2Runtime } from "./skill2Runtime";
import { createMochiGeneralSkill3Runtime } from "./skill3Runtime";
import { createMochiGeneralSkill4Runtime } from "./skill4Runtime";
import { createMochiGeneralSkill5Runtime } from "./skill5Runtime";
import type { ProjectileBlockHitHandler } from "../../../object/projectile/blocking";
import type { StatusEffectApplication } from "../../character/general/types";

type SwordThrustState = {
  active: boolean;
  hitTarget: boolean;
  hasPreviousBladeSample: boolean;
  previousBladeBase: THREE.Vector3;
  previousBladeTip: THREE.Vector3;
};

type RageTransitionSmokeParticle = {
  entry: MochiGeneralCombatEntry;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

export type MochiGeneralCombatRuntime = {
  tickBoss: (args: {
    entry: MochiGeneralCombatEntry;
    delta: number;
    player: THREE.Object3D;
    gameEnded: boolean;
    isBlocked: (x: number, z: number) => boolean;
    applyDamage: (amount: number) => number;
    summonSkill3Soldier: (args: {
      entry: MochiGeneralCombatEntry;
      position: THREE.Vector3;
    }) => void;
  }) => void;
  update: (args: {
    now: number;
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
    applyDamageToTarget: (target: THREE.Object3D, amount: number) => number;
    applyStatusEffect: (effect: StatusEffectApplication) => boolean;
    gameEnded: boolean;
    projectileBlockers: THREE.Object3D[];
    handleProjectileBlockHit?: ProjectileBlockHitHandler;
  }) => void;
  onBossRemoved: (entry: MochiGeneralCombatEntry) => void;
  dispose: () => void;
};

const BOSS_SWORD_THRUST_DAMAGE = 30;
const BOSS_SWORD_THRUST_ATTACK_WEIGHT_THRESHOLD = 0.2;
const BOSS_SWORD_THRUST_SWING_THRESHOLD = 0.02;
const BOSS_SWORD_THRUST_BLADE_RADIUS = 0.5;
const BOSS_SWORD_THRUST_TARGET_RADIUS = 0.55;
const BOSS_SWORD_THRUST_TARGET_HEIGHT_OFFSET = 0.95;
const BOSS_SWORD_THRUST_RANGE_MULTIPLIER = 1.5;
const BOSS_SWORD_THRUST_CLOSE_COMBAT_RADIUS = 1.12;
const BOSS_SWORD_THRUST_CLOSE_COMBAT_BASE_Y = 0.14;
const BOSS_SWORD_THRUST_CLOSE_COMBAT_TOP_Y = 2.28;
const BOSS_SWORD_THRUST_CLOSE_COMBAT_FORWARD_MIN = 0.52;
const BOSS_SWORD_THRUST_CLOSE_COMBAT_FORWARD_EXTRA = 0.92;
const BOSS_SWORD_THRUST_CLOSE_COMBAT_MIN_FORWARD_DOT = -0.42;
const BOSS_RAGE_SMOKE_SPAWN_RATE = 132;
const BOSS_RAGE_SMOKE_PARTICLE_LIFE_MIN = 1.9;
const BOSS_RAGE_SMOKE_PARTICLE_LIFE_MAX = 3.1;
const BOSS_RAGE_SMOKE_RADIUS_MIN = 0.12;
const BOSS_RAGE_SMOKE_RADIUS_MAX = 1.95;
const BOSS_RAGE_SMOKE_HEIGHT_MIN = 0.2;
const BOSS_RAGE_SMOKE_HEIGHT_MAX = 5.3;
const BOSS_RAGE_SMOKE_SCALE_MIN = 0.408;
const BOSS_RAGE_SMOKE_SCALE_MAX = 1.032;
const BOSS_RAGE_SMOKE_END_SCALE_MULTIPLIER_MIN = 2.2;
const BOSS_RAGE_SMOKE_END_SCALE_MULTIPLIER_MAX = 4.4;
const BOSS_RAGE_SMOKE_OUTWARD_SPEED_MIN = 0.15;
const BOSS_RAGE_SMOKE_OUTWARD_SPEED_MAX = 1.05;
const BOSS_RAGE_SMOKE_UPWARD_SPEED_MIN = 0.45;
const BOSS_RAGE_SMOKE_UPWARD_SPEED_MAX = 2.2;
const BOSS_RAGE_SMOKE_SPIN_SPEED = 3.2;

const swordBaseWorld = new THREE.Vector3();
const swordTipWorld = new THREE.Vector3();
const swordClosestPoint = new THREE.Vector3();
const swordTargetClosestPoint = new THREE.Vector3();
const targetCapsuleStartWorld = new THREE.Vector3();
const targetCapsuleEndWorld = new THREE.Vector3();
const targetAnchorWorld = new THREE.Vector3();
const targetCapsuleCenterWorld = new THREE.Vector3();
const targetDirectionFromBoss = new THREE.Vector3();
const targetBounds = new THREE.Box3();
const targetBoundsSize = new THREE.Vector3();
const targetBoundsCenter = new THREE.Vector3();
const bossAnchorWorld = new THREE.Vector3();
const bossForwardWorld = new THREE.Vector3();
const bossCloseCombatCapsuleStartWorld = new THREE.Vector3();
const bossCloseCombatCapsuleEndWorld = new THREE.Vector3();
const bossAnchorWorldRotation = new THREE.Quaternion();
const segmentDelta = new THREE.Vector3();
const capsuleDelta = new THREE.Vector3();
const segmentOffset = new THREE.Vector3();
const rageSmokeCenterWorld = new THREE.Vector3();
const rageSmokeSpawnWorld = new THREE.Vector3();

type MochiGeneralMeleeHitHintUserData = {
  mochiGeneralMeleeHitHeight?: unknown;
  mochiGeneralMeleeHitRadius?: unknown;
  mochiGeneralMeleeHitBottom?: unknown;
  mochiGeneralMeleeHitTop?: unknown;
  mochiGeneralMeleeHitBoundsSource?: unknown;
};

type MochiGeneralMeleeHitCapsule = {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
};

const resolveFiniteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const resolveMochiGeneralSegmentDistanceSq = (
  segmentStartA: THREE.Vector3,
  segmentEndA: THREE.Vector3,
  segmentStartB: THREE.Vector3,
  segmentEndB: THREE.Vector3
) => {
  const epsilon = 0.000001;
  segmentDelta.copy(segmentEndA).sub(segmentStartA);
  capsuleDelta.copy(segmentEndB).sub(segmentStartB);
  segmentOffset.copy(segmentStartA).sub(segmentStartB);

  const a = segmentDelta.lengthSq();
  const e = capsuleDelta.lengthSq();
  const f = capsuleDelta.dot(segmentOffset);

  let s = 0;
  let t = 0;

  if (a <= epsilon && e <= epsilon) {
    swordClosestPoint.copy(segmentStartA);
    swordTargetClosestPoint.copy(segmentStartB);
    return swordClosestPoint.distanceToSquared(swordTargetClosestPoint);
  }

  if (a <= epsilon) {
    s = 0;
    t = THREE.MathUtils.clamp(f / e, 0, 1);
  } else {
    const c = segmentDelta.dot(segmentOffset);
    if (e <= epsilon) {
      t = 0;
      s = THREE.MathUtils.clamp(-c / a, 0, 1);
    } else {
      const b = segmentDelta.dot(capsuleDelta);
      const denominator = a * e - b * b;
      if (Math.abs(denominator) > epsilon) {
        s = THREE.MathUtils.clamp((b * f - c * e) / denominator, 0, 1);
      } else {
        s = 0;
      }

      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = THREE.MathUtils.clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
      }
    }
  }

  swordClosestPoint.copy(segmentDelta).multiplyScalar(s).add(segmentStartA);
  swordTargetClosestPoint.copy(capsuleDelta).multiplyScalar(t).add(segmentStartB);
  return swordClosestPoint.distanceToSquared(swordTargetClosestPoint);
};

const resolveMochiGeneralMeleeHitCapsule = (target: THREE.Object3D) => {
  const userData = target.userData as MochiGeneralMeleeHitHintUserData;
  target.updateMatrixWorld(true);
  target.getWorldPosition(targetAnchorWorld);

  let centerX = targetAnchorWorld.x;
  let centerZ = targetAnchorWorld.z;
  let bottomY = targetAnchorWorld.y;
  let topY = bottomY + BOSS_SWORD_THRUST_TARGET_HEIGHT_OFFSET;
  let radius = BOSS_SWORD_THRUST_TARGET_RADIUS;

  const hintedHeight = resolveFiniteNumber(userData.mochiGeneralMeleeHitHeight);
  if (hintedHeight !== null && hintedHeight > 0) {
    topY = bottomY + hintedHeight;
  }
  const hintedRadius = resolveFiniteNumber(userData.mochiGeneralMeleeHitRadius);
  if (hintedRadius !== null && hintedRadius > 0) {
    radius = hintedRadius;
  }
  const hintedBottom = resolveFiniteNumber(userData.mochiGeneralMeleeHitBottom);
  if (hintedBottom !== null) {
    bottomY = targetAnchorWorld.y + hintedBottom;
  }
  const hintedTop = resolveFiniteNumber(userData.mochiGeneralMeleeHitTop);
  if (hintedTop !== null) {
    topY = targetAnchorWorld.y + hintedTop;
  }

  const hintedBoundsSource = userData.mochiGeneralMeleeHitBoundsSource;
  const boundsSource =
    hintedBoundsSource instanceof THREE.Object3D ? hintedBoundsSource : target;
  boundsSource.updateMatrixWorld(true);
  targetBounds.setFromObject(boundsSource);
  if (!targetBounds.isEmpty()) {
    targetBounds.getCenter(targetBoundsCenter);
    targetBounds.getSize(targetBoundsSize);
    centerX = targetBoundsCenter.x;
    centerZ = targetBoundsCenter.z;
    bottomY = Math.min(bottomY, targetBounds.min.y);
    topY = Math.max(topY, targetBounds.max.y);
    const boundsRadius = Math.max(targetBoundsSize.x, targetBoundsSize.z) * 0.42;
    if (boundsRadius > 0.0001) {
      radius = Math.max(radius, boundsRadius);
    }
  }

  radius = Math.max(0.05, radius);
  const minCombatHeight = Math.max(
    BOSS_SWORD_THRUST_TARGET_HEIGHT_OFFSET,
    radius * 2.35
  );
  if (topY - bottomY < minCombatHeight) {
    topY = bottomY + minCombatHeight;
  }
  bottomY -= radius * 0.18;
  topY += radius * 0.22;
  if (!Number.isFinite(topY) || topY <= bottomY + 0.01) {
    topY = bottomY + Math.max(0.05, hintedHeight ?? BOSS_SWORD_THRUST_TARGET_HEIGHT_OFFSET);
  }
  targetCapsuleStartWorld.set(centerX, bottomY, centerZ);
  targetCapsuleEndWorld.set(centerX, topY, centerZ);
  return {
    start: targetCapsuleStartWorld,
    end: targetCapsuleEndWorld,
    radius,
  };
};

const resolveMochiGeneralCloseCombatDistanceSq = ({
  entry,
  targetCapsule,
}: {
  entry: MochiGeneralCombatEntry;
  targetCapsule: MochiGeneralMeleeHitCapsule;
}) => {
  entry.anchor.updateMatrixWorld(true);
  entry.anchor.getWorldPosition(bossAnchorWorld);
  entry.anchor.getWorldQuaternion(bossAnchorWorldRotation);
  bossForwardWorld.set(0, 0, 1).applyQuaternion(bossAnchorWorldRotation).setY(0);
  if (bossForwardWorld.lengthSq() <= 0.000001) {
    bossForwardWorld.set(0, 0, 1);
  } else {
    bossForwardWorld.normalize();
  }

  targetCapsuleCenterWorld
    .copy(targetCapsule.start)
    .add(targetCapsule.end)
    .multiplyScalar(0.5);
  targetDirectionFromBoss
    .copy(targetCapsuleCenterWorld)
    .sub(bossAnchorWorld)
    .setY(0);
  const horizontalDistance = targetDirectionFromBoss.length();
  if (horizontalDistance > 0.0001) {
    targetDirectionFromBoss.multiplyScalar(1 / horizontalDistance);
    if (
      targetDirectionFromBoss.dot(bossForwardWorld) <
      BOSS_SWORD_THRUST_CLOSE_COMBAT_MIN_FORWARD_DOT
    ) {
      return Number.POSITIVE_INFINITY;
    }
  }

  const attackRange = Math.max(0.5, entry.monster.stats.attackRange);
  const forwardDistance = THREE.MathUtils.clamp(
    attackRange * 0.55 + targetCapsule.radius * 0.45,
    BOSS_SWORD_THRUST_CLOSE_COMBAT_FORWARD_MIN,
    attackRange + BOSS_SWORD_THRUST_CLOSE_COMBAT_FORWARD_EXTRA
  );

  bossCloseCombatCapsuleStartWorld
    .copy(bossAnchorWorld)
    .addScaledVector(bossForwardWorld, forwardDistance * 0.18);
  bossCloseCombatCapsuleStartWorld.y += BOSS_SWORD_THRUST_CLOSE_COMBAT_BASE_Y;
  bossCloseCombatCapsuleEndWorld
    .copy(bossAnchorWorld)
    .addScaledVector(bossForwardWorld, forwardDistance);
  bossCloseCombatCapsuleEndWorld.y += BOSS_SWORD_THRUST_CLOSE_COMBAT_TOP_Y;

  return resolveMochiGeneralSegmentDistanceSq(
    bossCloseCombatCapsuleStartWorld,
    bossCloseCombatCapsuleEndWorld,
    targetCapsule.start,
    targetCapsule.end
  );
};

export const createMochiGeneralCombatRuntime = (
  scene: THREE.Scene
): MochiGeneralCombatRuntime => {
  const skill1Runtime = createMochiGeneralSkill1Runtime(scene);
  const skill2Runtime = createMochiGeneralSkill2Runtime(scene);
  const skill3Runtime = createMochiGeneralSkill3Runtime();
  const skill4Runtime = createMochiGeneralSkill4Runtime(scene);
  const skill5Runtime = createMochiGeneralSkill5Runtime(scene);
  const swordThrustStateByEntry = new WeakMap<
    MochiGeneralCombatEntry,
    SwordThrustState
  >();
  const rageSmokeSpawnCarryByEntry = new WeakMap<MochiGeneralCombatEntry, number>();
  const rageSmokeGeometry = new THREE.SphereGeometry(1, 8, 7);
  const rageSmokeMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 1,
    metalness: 0,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.42,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const rageSmokeParticles: RageTransitionSmokeParticle[] = [];

  const resolveSwordThrustState = (
    entry: MochiGeneralCombatEntry
  ): SwordThrustState => {
    let state = swordThrustStateByEntry.get(entry);
    if (state) return state;
    state = {
      active: false,
      hitTarget: false,
      hasPreviousBladeSample: false,
      previousBladeBase: new THREE.Vector3(),
      previousBladeTip: new THREE.Vector3(),
    };
    swordThrustStateByEntry.set(entry, state);
    return state;
  };

  const removeRageSmokeParticleAt = (index: number) => {
    const particle = rageSmokeParticles[index];
    if (!particle) return;
    if (particle.mesh.parent) {
      particle.mesh.parent.remove(particle.mesh);
    }
    particle.material.dispose();
    rageSmokeParticles.splice(index, 1);
  };

  const clearRageSmokeForEntry = (entry: MochiGeneralCombatEntry) => {
    for (let i = rageSmokeParticles.length - 1; i >= 0; i -= 1) {
      if (rageSmokeParticles[i]?.entry !== entry) continue;
      removeRageSmokeParticleAt(i);
    }
    rageSmokeSpawnCarryByEntry.delete(entry);
  };

  const spawnRageSmokeParticle = (
    entry: MochiGeneralCombatEntry,
    rageBlend: number
  ) => {
    entry.anchor.getWorldPosition(rageSmokeCenterWorld);
    const angle = Math.random() * Math.PI * 2;
    const radius = THREE.MathUtils.lerp(
      BOSS_RAGE_SMOKE_RADIUS_MIN,
      BOSS_RAGE_SMOKE_RADIUS_MAX,
      Math.random()
    );
    const life = THREE.MathUtils.lerp(
      BOSS_RAGE_SMOKE_PARTICLE_LIFE_MIN,
      BOSS_RAGE_SMOKE_PARTICLE_LIFE_MAX,
      Math.random()
    );
    const startScale = THREE.MathUtils.lerp(
      BOSS_RAGE_SMOKE_SCALE_MIN,
      BOSS_RAGE_SMOKE_SCALE_MAX,
      Math.random()
    );
    const endScale =
      startScale *
      THREE.MathUtils.lerp(
        BOSS_RAGE_SMOKE_END_SCALE_MULTIPLIER_MIN,
        BOSS_RAGE_SMOKE_END_SCALE_MULTIPLIER_MAX,
        Math.random()
      );

    const material = rageSmokeMaterialTemplate.clone();
    material.opacity *= THREE.MathUtils.lerp(0.95, 1.28, rageBlend);
    material.emissiveIntensity *= THREE.MathUtils.lerp(0.8, 1.35, rageBlend);
    if (Math.random() < 0.38) {
      material.color.set(0x111111);
      material.emissive.set(0x3f0a0a);
    }

    const mesh = new THREE.Mesh(rageSmokeGeometry, material);
    rageSmokeSpawnWorld.set(
      rageSmokeCenterWorld.x + Math.cos(angle) * radius,
      rageSmokeCenterWorld.y +
        THREE.MathUtils.lerp(
          BOSS_RAGE_SMOKE_HEIGHT_MIN,
          BOSS_RAGE_SMOKE_HEIGHT_MAX,
          Math.random()
        ),
      rageSmokeCenterWorld.z + Math.sin(angle) * radius
    );
    mesh.position.copy(rageSmokeSpawnWorld);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.scale.setScalar(startScale);
    scene.add(mesh);

    const outwardSpeed = THREE.MathUtils.lerp(
      BOSS_RAGE_SMOKE_OUTWARD_SPEED_MIN,
      BOSS_RAGE_SMOKE_OUTWARD_SPEED_MAX,
      Math.random()
    );
    const upwardSpeed = THREE.MathUtils.lerp(
      BOSS_RAGE_SMOKE_UPWARD_SPEED_MIN,
      BOSS_RAGE_SMOKE_UPWARD_SPEED_MAX,
      Math.random()
    );
    const blendSpeedMultiplier = THREE.MathUtils.lerp(0.8, 1.3, rageBlend);
    rageSmokeParticles.push({
      entry,
      mesh,
      material,
      velocity: new THREE.Vector3(
        Math.cos(angle) * outwardSpeed * blendSpeedMultiplier +
          (Math.random() - 0.5) * 0.45,
        upwardSpeed * blendSpeedMultiplier,
        Math.sin(angle) * outwardSpeed * blendSpeedMultiplier +
          (Math.random() - 0.5) * 0.45
      ),
      spin: new THREE.Vector3(
        (Math.random() - 0.5) * BOSS_RAGE_SMOKE_SPIN_SPEED,
        (Math.random() - 0.5) * BOSS_RAGE_SMOKE_SPIN_SPEED,
        (Math.random() - 0.5) * BOSS_RAGE_SMOKE_SPIN_SPEED
      ),
      age: 0,
      life,
      startScale,
      endScale,
    });
  };

  const emitRageSmoke = (entry: MochiGeneralCombatEntry, delta: number) => {
    if (!entry.rageTransitionActive) {
      rageSmokeSpawnCarryByEntry.set(entry, 0);
      return;
    }

    const previousCarry = rageSmokeSpawnCarryByEntry.get(entry) ?? 0;
    let carry =
      previousCarry +
      delta *
        BOSS_RAGE_SMOKE_SPAWN_RATE *
        THREE.MathUtils.lerp(0.5, 1.35, entry.rageTransitionBlend);
    while (carry >= 1) {
      carry -= 1;
      spawnRageSmokeParticle(entry, entry.rageTransitionBlend);
    }
    rageSmokeSpawnCarryByEntry.set(entry, carry);
  };

  const updateRageSmokeParticles = (delta: number) => {
    for (let i = rageSmokeParticles.length - 1; i >= 0; i -= 1) {
      const particle = rageSmokeParticles[i];
      particle.age += delta;
      const t = particle.life > 0 ? particle.age / particle.life : 1;
      if (t >= 1) {
        removeRageSmokeParticleAt(i);
        continue;
      }

      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.velocity.multiplyScalar(0.975);
      particle.velocity.y += 0.24 * delta;
      particle.mesh.rotation.x += particle.spin.x * delta;
      particle.mesh.rotation.y += particle.spin.y * delta;
      particle.mesh.rotation.z += particle.spin.z * delta;
      particle.mesh.scale.setScalar(
        THREE.MathUtils.lerp(particle.startScale, particle.endScale, t)
      );
      const fade = Math.max(0, 1 - t);
      particle.material.opacity = fade * fade * 0.96;
    }
  };

  const updateSwordThrustCollision = ({
    entry,
    target,
    applyDamage,
  }: {
    entry: MochiGeneralCombatEntry;
    target: THREE.Object3D;
    applyDamage: (amount: number) => number;
  }) => {
    const thrustActive =
      entry.swordAttackPoseWeight >= BOSS_SWORD_THRUST_ATTACK_WEIGHT_THRESHOLD &&
      entry.swordHandSwing >= BOSS_SWORD_THRUST_SWING_THRESHOLD &&
      !entry.skill4WindupActive &&
      !entry.skill4SwordActive &&
      !entry.rageTransitionPending &&
      !entry.rageTransitionActive;
    const state = resolveSwordThrustState(entry);

    if (!thrustActive) {
      state.active = false;
      state.hasPreviousBladeSample = false;
      return;
    }

    if (!state.active) {
      state.active = true;
      state.hitTarget = false;
      state.hasPreviousBladeSample = false;
    }

    if (state.hitTarget) return;

    const sword = entry.rig?.sword;
    const swordTip = entry.rig?.swordTip;
    if (!sword || !swordTip) return;

    sword.getWorldPosition(swordBaseWorld);
    swordTip.getWorldPosition(swordTipWorld);
    if (swordBaseWorld.distanceToSquared(swordTipWorld) <= 0.00001) {
      state.hasPreviousBladeSample = false;
      return;
    }

    const targetCapsule = resolveMochiGeneralMeleeHitCapsule(target);
    let distanceSq = resolveMochiGeneralSegmentDistanceSq(
      swordBaseWorld,
      swordTipWorld,
      targetCapsule.start,
      targetCapsule.end
    );
    if (state.hasPreviousBladeSample) {
      distanceSq = Math.min(
        distanceSq,
        resolveMochiGeneralSegmentDistanceSq(
          state.previousBladeBase,
          state.previousBladeTip,
          targetCapsule.start,
          targetCapsule.end
        ),
        resolveMochiGeneralSegmentDistanceSq(
          state.previousBladeBase,
          swordBaseWorld,
          targetCapsule.start,
          targetCapsule.end
        ),
        resolveMochiGeneralSegmentDistanceSq(
          state.previousBladeTip,
          swordTipWorld,
          targetCapsule.start,
          targetCapsule.end
        )
      );
    }
    state.previousBladeBase.copy(swordBaseWorld);
    state.previousBladeTip.copy(swordTipWorld);
    state.hasPreviousBladeSample = true;

    const collisionDistance =
      (BOSS_SWORD_THRUST_BLADE_RADIUS + targetCapsule.radius) *
      BOSS_SWORD_THRUST_RANGE_MULTIPLIER;
    const closeCombatDistanceSq = resolveMochiGeneralCloseCombatDistanceSq({
      entry,
      targetCapsule,
    });
    const closeCombatCollisionDistance =
      BOSS_SWORD_THRUST_CLOSE_COMBAT_RADIUS + targetCapsule.radius;
    const swordHit = distanceSq <= collisionDistance * collisionDistance;
    const closeCombatHit =
      closeCombatDistanceSq <=
      closeCombatCollisionDistance * closeCombatCollisionDistance;
    if (!swordHit && !closeCombatHit) {
      return;
    }

    state.hitTarget = true;
    applyDamage(BOSS_SWORD_THRUST_DAMAGE);
  };

  return {
    tickBoss: ({
      entry,
      delta,
      player,
      gameEnded,
      isBlocked,
      applyDamage,
      summonSkill3Soldier,
    }) => {
      tickMochiGeneralCombat({
        entry,
        delta,
        player,
        gameEnded,
        isBlocked,
      });
      skill1Runtime.onBossTick(entry, player, delta, gameEnded);
      skill2Runtime.onBossTick({
        entry,
        delta,
        player,
        gameEnded,
      });
      skill3Runtime.onBossTick({
        entry,
        gameEnded,
        isBlocked,
        summonAt: summonSkill3Soldier,
      });
      skill4Runtime.onBossTick({
        entry,
        gameEnded,
      });
      skill5Runtime.onBossTick({
        entry,
        player,
        gameEnded,
      });
      updateSwordThrustCollision({
        entry,
        target: player,
        applyDamage,
      });
      emitRageSmoke(entry, delta);
    },
    update: ({
      now,
      delta,
      player,
      applyDamage,
      applyDamageToTarget,
      applyStatusEffect,
      gameEnded,
      projectileBlockers,
      handleProjectileBlockHit,
    }) => {
      skill1Runtime.update({
        now,
        delta,
        applyDamageToTarget,
        projectileBlockers,
        handleProjectileBlockHit,
      });
      skill2Runtime.update({
        delta,
        player,
        applyDamage,
        applyStatusEffect,
        gameEnded,
        spawnSkill1SingleBurst: ({ entry, origin, gameEnded: burstGameEnded }) => {
          skill1Runtime.spawnSingleBurst({
            entry,
            target: player,
            origin,
            gameEnded: burstGameEnded,
          });
        },
      });
      skill4Runtime.update({
        delta,
        player,
        applyDamage,
        gameEnded,
      });
      skill5Runtime.update({
        now,
        delta,
        applyDamageToTarget,
        gameEnded,
        projectileBlockers,
        handleProjectileBlockHit,
      });
      updateRageSmokeParticles(delta);
    },
    onBossRemoved: (entry) => {
      skill1Runtime.onBossRemoved(entry);
      skill2Runtime.onBossRemoved(entry);
      skill3Runtime.onBossRemoved(entry);
      skill4Runtime.onBossRemoved(entry);
      skill5Runtime.onBossRemoved(entry);
      swordThrustStateByEntry.delete(entry);
      clearRageSmokeForEntry(entry);
    },
    dispose: () => {
      skill1Runtime.dispose();
      skill2Runtime.dispose();
      skill3Runtime.dispose();
      skill4Runtime.dispose();
      skill5Runtime.dispose();
      for (let i = rageSmokeParticles.length - 1; i >= 0; i -= 1) {
        removeRageSmokeParticleAt(i);
      }
      rageSmokeGeometry.dispose();
      rageSmokeMaterialTemplate.dispose();
    },
  };
};
