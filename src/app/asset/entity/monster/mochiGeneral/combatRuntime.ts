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
  hitPlayer: boolean;
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
const BOSS_SWORD_THRUST_PLAYER_RADIUS = 0.55;
const BOSS_SWORD_THRUST_PLAYER_HEIGHT_OFFSET = 0.95;
const BOSS_SWORD_THRUST_RANGE_MULTIPLIER = 1.5;
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
const playerHitProbeWorld = new THREE.Vector3();
const swordBladeSegment = new THREE.Line3();
const rageSmokeCenterWorld = new THREE.Vector3();
const rageSmokeSpawnWorld = new THREE.Vector3();

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
    state = { active: false, hitPlayer: false };
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
    player,
    applyDamage,
  }: {
    entry: MochiGeneralCombatEntry;
    player: THREE.Object3D;
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
      return;
    }

    if (!state.active) {
      state.active = true;
      state.hitPlayer = false;
    }

    if (state.hitPlayer) return;

    const sword = entry.rig?.sword;
    const swordTip = entry.rig?.swordTip;
    if (!sword || !swordTip) return;

    sword.getWorldPosition(swordBaseWorld);
    swordTip.getWorldPosition(swordTipWorld);
    if (swordBaseWorld.distanceToSquared(swordTipWorld) <= 0.00001) return;

    player.getWorldPosition(playerHitProbeWorld);
    playerHitProbeWorld.y += BOSS_SWORD_THRUST_PLAYER_HEIGHT_OFFSET;

    swordBladeSegment.set(swordBaseWorld, swordTipWorld);
    swordBladeSegment.closestPointToPoint(
      playerHitProbeWorld,
      true,
      swordClosestPoint
    );

    const collisionDistance =
      (BOSS_SWORD_THRUST_BLADE_RADIUS + BOSS_SWORD_THRUST_PLAYER_RADIUS) *
      BOSS_SWORD_THRUST_RANGE_MULTIPLIER;
    if (
      swordClosestPoint.distanceToSquared(playerHitProbeWorld) >
      collisionDistance * collisionDistance
    ) {
      return;
    }

    state.hitPlayer = true;
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
      skill1Runtime.onBossTick(entry, delta, gameEnded);
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
        player,
        applyDamage,
      });
      emitRageSmoke(entry, delta);
    },
    update: ({
      now,
      delta,
      player,
      applyDamage,
      applyStatusEffect,
      gameEnded,
      projectileBlockers,
      handleProjectileBlockHit,
    }) => {
      skill1Runtime.update({
        now,
        delta,
        player,
        applyDamage,
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
        player,
        applyDamage,
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
