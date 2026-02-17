import * as THREE from "three";
import { createMochiGeneralSkill1BurstRuntime } from "../../../object/projectile/projectile/mochiGeneral/skill1BurstRuntime";
import type { ProjectileBlockHitHandler } from "../../../object/projectile/blocking";
import type { MochiGeneralCombatEntry } from "./combatBehavior";

type BossSkillChargeParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  entry: MochiGeneralCombatEntry;
  offset: THREE.Vector3;
  swirlAxis: THREE.Vector3;
  swirlAmplitude: number;
  swirlFrequency: number;
  swirlPhase: number;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

export type MochiGeneralSkill1Runtime = {
  onBossTick: (
    entry: MochiGeneralCombatEntry,
    delta: number,
    gameEnded: boolean
  ) => void;
  update: (args: {
    now: number;
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
    projectileBlockers: THREE.Object3D[];
    handleProjectileBlockHit?: ProjectileBlockHitHandler;
  }) => void;
  onBossRemoved: (entry: MochiGeneralCombatEntry) => void;
  dispose: () => void;
};

const BOSS_SKILL1_CHARGE_SPAWN_RATE_MIN = 80;
const BOSS_SKILL1_CHARGE_SPAWN_RATE_MAX = 180;
const BOSS_SKILL1_CHARGE_SPAWN_RATE_AFTER_BURST = 34;
const BOSS_SKILL1_CHARGE_SPAWN_PER_FRAME_CAP = 30;
const BOSS_SKILL1_CHARGE_PARTICLE_LIFE_MIN = 0.34;
const BOSS_SKILL1_CHARGE_PARTICLE_LIFE_MAX = 0.62;
const BOSS_SKILL1_CHARGE_PARTICLE_OFFSET_MIN = 1.25;
const BOSS_SKILL1_CHARGE_PARTICLE_OFFSET_MAX = 2.85;
const BOSS_SKILL1_CHARGE_PARTICLE_SCALE_MIN = 0.6;
const BOSS_SKILL1_CHARGE_PARTICLE_SCALE_MAX = 1.45;
const BOSS_SKILL1_CHARGE_PARTICLE_SWIRL_AMPLITUDE_MIN = 0.08;
const BOSS_SKILL1_CHARGE_PARTICLE_SWIRL_AMPLITUDE_MAX = 0.2;
const BOSS_SKILL1_CHARGE_PARTICLE_SWIRL_FREQUENCY_MIN = 10;
const BOSS_SKILL1_CHARGE_PARTICLE_SWIRL_FREQUENCY_MAX = 24;

const bossSkillBurstOrigin = new THREE.Vector3();
const bossSkillChargeTargetWorld = new THREE.Vector3();
const bossSkillChargeSpawnDirection = new THREE.Vector3();
const bossSkillChargeSpawnOffset = new THREE.Vector3();
const bossSkillChargeSwirlAxisTemp = new THREE.Vector3();
const bossSkillChargeUpAxis = new THREE.Vector3(0, 1, 0);

export const createMochiGeneralSkill1Runtime = (
  scene: THREE.Scene
): MochiGeneralSkill1Runtime => {
  const projectileRuntime = createMochiGeneralSkill1BurstRuntime(scene);
  const chargeSphereGeometry = new THREE.SphereGeometry(0.07, 8, 6);
  const chargeSphereMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xfff7e6,
    roughness: 0.26,
    metalness: 0.04,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.42,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const chargeParticles: BossSkillChargeParticle[] = [];
  const chargeSpawnCarryByEntry = new WeakMap<MochiGeneralCombatEntry, number>();

  const resolveSkill1Origin = (entry: MochiGeneralCombatEntry, out: THREE.Vector3) => {
    const burstOriginNode = entry.rig?.heldMochi;
    if (burstOriginNode) {
      burstOriginNode.getWorldPosition(out);
    } else {
      out.copy(entry.anchor.position);
      out.y += 2.2;
    }
  };

  const removeChargeParticleAt = (index: number) => {
    const particle = chargeParticles[index];
    if (!particle) return;
    if (particle.mesh.parent) {
      particle.mesh.parent.remove(particle.mesh);
    }
    particle.material.dispose();
    chargeParticles.splice(index, 1);
  };

  const spawnChargeParticle = (
    entry: MochiGeneralCombatEntry,
    gameEnded: boolean
  ) => {
    if (gameEnded || !entry.monster.isAlive) return;

    resolveSkill1Origin(entry, bossSkillChargeTargetWorld);
    let safety = 0;
    do {
      bossSkillChargeSpawnDirection.set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      );
      safety += 1;
      if (safety > 10) break;
    } while (bossSkillChargeSpawnDirection.lengthSq() <= 0.00001);
    if (bossSkillChargeSpawnDirection.lengthSq() <= 0.00001) {
      bossSkillChargeSpawnDirection.set(1, 0.45, 0);
    }
    bossSkillChargeSpawnDirection.normalize();

    const offsetDistance = THREE.MathUtils.lerp(
      BOSS_SKILL1_CHARGE_PARTICLE_OFFSET_MIN,
      BOSS_SKILL1_CHARGE_PARTICLE_OFFSET_MAX,
      Math.random()
    );
    bossSkillChargeSpawnOffset
      .copy(bossSkillChargeSpawnDirection)
      .multiplyScalar(offsetDistance);
    bossSkillChargeSpawnOffset.y += 0.25 + Math.random() * 0.95;

    bossSkillChargeSwirlAxisTemp
      .copy(bossSkillChargeSpawnOffset)
      .cross(bossSkillChargeUpAxis);
    if (bossSkillChargeSwirlAxisTemp.lengthSq() <= 0.00001) {
      bossSkillChargeSwirlAxisTemp.set(
        bossSkillChargeSpawnOffset.z,
        0,
        -bossSkillChargeSpawnOffset.x
      );
    }
    if (bossSkillChargeSwirlAxisTemp.lengthSq() <= 0.00001) {
      bossSkillChargeSwirlAxisTemp.set(1, 0, 0);
    }
    bossSkillChargeSwirlAxisTemp.normalize();

    const material = chargeSphereMaterialTemplate.clone();
    material.opacity = THREE.MathUtils.lerp(0.52, 0.95, Math.random());
    material.emissiveIntensity = THREE.MathUtils.lerp(0.42, 0.8, Math.random());

    const startScale = THREE.MathUtils.lerp(
      BOSS_SKILL1_CHARGE_PARTICLE_SCALE_MIN,
      BOSS_SKILL1_CHARGE_PARTICLE_SCALE_MAX,
      Math.random()
    );
    const endScale = startScale * THREE.MathUtils.lerp(0.1, 0.4, Math.random());
    const life = THREE.MathUtils.lerp(
      BOSS_SKILL1_CHARGE_PARTICLE_LIFE_MIN,
      BOSS_SKILL1_CHARGE_PARTICLE_LIFE_MAX,
      Math.random()
    );
    const mesh = new THREE.Mesh(chargeSphereGeometry, material);
    mesh.position.copy(bossSkillChargeTargetWorld).add(bossSkillChargeSpawnOffset);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.scale.setScalar(startScale);
    scene.add(mesh);

    chargeParticles.push({
      mesh,
      material,
      entry,
      offset: bossSkillChargeSpawnOffset.clone(),
      swirlAxis: bossSkillChargeSwirlAxisTemp.clone(),
      swirlAmplitude: THREE.MathUtils.lerp(
        BOSS_SKILL1_CHARGE_PARTICLE_SWIRL_AMPLITUDE_MIN,
        BOSS_SKILL1_CHARGE_PARTICLE_SWIRL_AMPLITUDE_MAX,
        Math.random()
      ),
      swirlFrequency: THREE.MathUtils.lerp(
        BOSS_SKILL1_CHARGE_PARTICLE_SWIRL_FREQUENCY_MIN,
        BOSS_SKILL1_CHARGE_PARTICLE_SWIRL_FREQUENCY_MAX,
        Math.random()
      ),
      swirlPhase: Math.random() * Math.PI * 2,
      age: 0,
      life,
      startScale,
      endScale,
    });
  };

  const updateChargeParticles = (delta: number) => {
    for (let i = chargeParticles.length - 1; i >= 0; i -= 1) {
      const particle = chargeParticles[i];
      particle.age += delta;
      const t = particle.life > 0 ? particle.age / particle.life : 1;
      if (t >= 1) {
        removeChargeParticleAt(i);
        continue;
      }

      resolveSkill1Origin(particle.entry, bossSkillChargeTargetWorld);
      const decay = Math.max(0, 1 - t);
      const decaySquared = decay * decay;
      particle.mesh.position
        .copy(bossSkillChargeTargetWorld)
        .addScaledVector(particle.offset, decaySquared);
      const swirlOffset =
        Math.sin(particle.swirlPhase + t * particle.swirlFrequency) *
        particle.swirlAmplitude *
        decay;
      particle.mesh.position.addScaledVector(particle.swirlAxis, swirlOffset);

      const scale = THREE.MathUtils.lerp(particle.startScale, particle.endScale, t);
      particle.mesh.scale.setScalar(scale);
      particle.material.opacity = Math.max(0.03, decay * decay * 0.95);
      particle.material.emissiveIntensity = THREE.MathUtils.lerp(0.46, 1.05, t);
    }
  };

  return {
    onBossTick: (entry, delta, gameEnded) => {
      const pendingBurstCount = Math.max(
        entry.skill1ProjectileBurstPendingCount,
        entry.skill1ProjectileBurstRequested ? 1 : 0
      );
      if (pendingBurstCount > 0) {
        entry.skill1ProjectileBurstRequested = false;
        entry.skill1ProjectileBurstPendingCount = 0;
        for (let i = 0; i < pendingBurstCount; i += 1) {
          resolveSkill1Origin(entry, bossSkillBurstOrigin);
          projectileRuntime.spawnBurst({
            origin: bossSkillBurstOrigin,
            gameEnded,
          });
        }
      }

      if (gameEnded || !entry.monster.isAlive) {
        chargeSpawnCarryByEntry.delete(entry);
        return;
      }

      if (!entry.skill1Casting) {
        chargeSpawnCarryByEntry.delete(entry);
        return;
      }

      const spawnRate = entry.skill1ProjectileBurstFired
        ? BOSS_SKILL1_CHARGE_SPAWN_RATE_AFTER_BURST
        : THREE.MathUtils.lerp(
            BOSS_SKILL1_CHARGE_SPAWN_RATE_MIN,
            BOSS_SKILL1_CHARGE_SPAWN_RATE_MAX,
            entry.skill1CastBlend
          );
      let chargeSpawnCarry = chargeSpawnCarryByEntry.get(entry) ?? 0;
      chargeSpawnCarry += spawnRate * delta;
      const spawnCount = Math.min(
        BOSS_SKILL1_CHARGE_SPAWN_PER_FRAME_CAP,
        Math.floor(chargeSpawnCarry)
      );
      if (spawnCount > 0) {
        chargeSpawnCarry -= spawnCount;
        for (let i = 0; i < spawnCount; i += 1) {
          spawnChargeParticle(entry, gameEnded);
        }
      }
      chargeSpawnCarryByEntry.set(entry, chargeSpawnCarry);
    },
    update: ({
      now,
      delta,
      player,
      applyDamage,
      projectileBlockers,
      handleProjectileBlockHit,
    }) => {
      projectileRuntime.update({
        now,
        delta,
        player,
        applyDamage,
        projectileBlockers,
        handleProjectileBlockHit,
      });
      updateChargeParticles(delta);
    },
    onBossRemoved: (entry) => {
      chargeSpawnCarryByEntry.delete(entry);
      for (let i = chargeParticles.length - 1; i >= 0; i -= 1) {
        if (chargeParticles[i]?.entry !== entry) continue;
        removeChargeParticleAt(i);
      }
    },
    dispose: () => {
      projectileRuntime.dispose();
      for (let i = chargeParticles.length - 1; i >= 0; i -= 1) {
        removeChargeParticleAt(i);
      }
      chargeSphereGeometry.dispose();
      chargeSphereMaterialTemplate.dispose();
    },
  };
};
