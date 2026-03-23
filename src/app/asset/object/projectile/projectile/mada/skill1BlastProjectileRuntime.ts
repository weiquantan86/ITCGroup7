import * as THREE from "three";
import {
  resolveProjectileBlockHit,
  type ProjectileBlockHitHandler,
} from "../../blocking";
import { LinearProjectileUpdater } from "../../linearUpdater";

const MADA_SKILL1_PROJECTILE_DAMAGE = 20;
const MADA_SKILL1_PROJECTILE_SPEED = 21.5 * 3.75;
const MADA_SKILL1_PROJECTILE_LIFE_S = 6.2;
const MADA_SKILL1_PROJECTILE_RADIUS = 1.76;
const MADA_SKILL1_PLAYER_RADIUS = 0.7;
const MADA_SKILL1_FLASH_INTERVAL_S = 0.2;
const MADA_SKILL1_TRAIL_INTERVAL_S = 0.04;
const MADA_SKILL1_TRAIL_LIFE_S = 0.42;
const MADA_SKILL1_RED_COLOR = 0xff321f;
const MADA_SKILL1_RED_EMISSIVE = 0xb5140d;
const MADA_SKILL1_BLACK_COLOR = 0x100606;
const MADA_SKILL1_BLACK_EMISSIVE = 0x2b0606;

type MadaSkill1Projectile = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  auraMaterial: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  radius: number;
  damage: number;
  flashElapsed: number;
  redPhase: boolean;
  trailCarry: number;
};

type TrailParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  spin: number;
};

type SpawnProjectileArgs = {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
};

type UpdateArgs = {
  now: number;
  delta: number;
  player: THREE.Object3D;
  applyDamage: (amount: number) => number;
  projectileBlockers: THREE.Object3D[];
  handleProjectileBlockHit?: ProjectileBlockHitHandler;
};

const playerProbe = new THREE.Vector3();
const trailOffset = new THREE.Vector3();
const trailVelocity = new THREE.Vector3();
const projectileDirection = new THREE.Vector3();

const randomSigned = () => Math.random() * 2 - 1;

export const createMadaSkill1BlastProjectileRuntime = (scene: THREE.Scene) => {
  const projectileGeometry = new THREE.SphereGeometry(0.84, 22, 18);
  const projectileAuraGeometry = new THREE.IcosahedronGeometry(1.44, 1);
  const trailGeometry = new THREE.SphereGeometry(0.09, 8, 7);
  const trailMaterialTemplate = new THREE.MeshBasicMaterial({
    color: MADA_SKILL1_RED_COLOR,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const projectiles: MadaSkill1Projectile[] = [];
  const trailParticles: TrailParticle[] = [];
  const projectileUpdater = new LinearProjectileUpdater();

  const applyProjectileFlashPhase = (
    projectile: MadaSkill1Projectile,
    redPhase: boolean
  ) => {
    projectile.redPhase = redPhase;
    if (redPhase) {
      projectile.material.color.setHex(MADA_SKILL1_RED_COLOR);
      projectile.material.emissive.setHex(MADA_SKILL1_RED_EMISSIVE);
      projectile.material.emissiveIntensity = 2.35;
      projectile.material.opacity = 0.96;
      projectile.auraMaterial.color.setHex(0xff3f31);
      projectile.auraMaterial.opacity = 0.82;
      projectile.mesh.scale.setScalar(1.08);
    } else {
      projectile.material.color.setHex(MADA_SKILL1_BLACK_COLOR);
      projectile.material.emissive.setHex(MADA_SKILL1_BLACK_EMISSIVE);
      projectile.material.emissiveIntensity = 0.18;
      projectile.material.opacity = 0.86;
      projectile.auraMaterial.color.setHex(0x140505);
      projectile.auraMaterial.opacity = 0.24;
      projectile.mesh.scale.setScalar(0.94);
    }
  };

  const removeTrailAt = (index: number) => {
    const particle = trailParticles[index];
    if (!particle) return;
    particle.mesh.removeFromParent();
    particle.material.dispose();
    trailParticles.splice(index, 1);
  };

  const spawnTrailParticles = (projectile: MadaSkill1Projectile) => {
    for (let i = 0; i < 2; i += 1) {
      const material = trailMaterialTemplate.clone();
      if (!projectile.redPhase) {
        material.color.setHex(0x3a0b0b);
      }
      const mesh = new THREE.Mesh(trailGeometry, material);
      trailOffset.set(randomSigned(), randomSigned(), randomSigned());
      if (trailOffset.lengthSq() <= 0.0001) {
        trailOffset.set(0.5, 0.25, -0.3);
      }
      trailOffset.normalize().multiplyScalar(0.1 + Math.random() * 0.26);
      mesh.position.copy(projectile.mesh.position).add(trailOffset);
      mesh.scale.setScalar(0.7 + Math.random() * 1.2);
      scene.add(mesh);

      trailVelocity
        .copy(projectile.velocity)
        .multiplyScalar(-0.08 - Math.random() * 0.12);
      trailVelocity.x += randomSigned() * 1.6;
      trailVelocity.y += randomSigned() * 1.35;
      trailVelocity.z += randomSigned() * 1.6;
      trailParticles.push({
        mesh,
        material,
        velocity: trailVelocity.clone(),
        life: 0,
        maxLife: MADA_SKILL1_TRAIL_LIFE_S * (0.82 + Math.random() * 0.42),
        spin: randomSigned() * 7.5,
      });
    }
  };

  const updateTrailParticles = (delta: number) => {
    for (let i = trailParticles.length - 1; i >= 0; i -= 1) {
      const particle = trailParticles[i];
      particle.life += delta;
      if (particle.life >= particle.maxLife) {
        removeTrailAt(i);
        continue;
      }
      const t = particle.life / particle.maxLife;
      const inv = 1 - t;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.rotateY(particle.spin * delta);
      particle.mesh.scale.setScalar(Math.max(0.02, inv * 1.6));
      particle.material.opacity = Math.max(0.02, 0.88 * inv * inv);
    }
  };

  const removeProjectileAt = (index: number) => {
    const projectile = projectiles[index];
    if (!projectile) return;
    projectile.mesh.removeFromParent();
    projectile.material.dispose();
    projectile.auraMaterial.dispose();
    projectiles.splice(index, 1);
  };

  return {
    spawnProjectile: ({ origin, direction }: SpawnProjectileArgs) => {
      projectileDirection.copy(direction);
      if (projectileDirection.lengthSq() <= 0.00001) {
        projectileDirection.set(0, 0, 1);
      } else {
        projectileDirection.normalize();
      }

      const material = new THREE.MeshStandardMaterial({
        color: MADA_SKILL1_RED_COLOR,
        emissive: MADA_SKILL1_RED_EMISSIVE,
        emissiveIntensity: 2.35,
        roughness: 0.2,
        metalness: 0.08,
        transparent: true,
        opacity: 0.96,
      });
      const auraMaterial = new THREE.MeshBasicMaterial({
        color: 0xff3f31,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(projectileGeometry, material);
      const aura = new THREE.Mesh(projectileAuraGeometry, auraMaterial);
      aura.scale.setScalar(1.08);
      mesh.add(aura);
      mesh.position.copy(origin);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      scene.add(mesh);

      const projectile: MadaSkill1Projectile = {
        mesh,
        material,
        auraMaterial,
        velocity: projectileDirection
          .clone()
          .multiplyScalar(MADA_SKILL1_PROJECTILE_SPEED),
        life: 0,
        maxLife: MADA_SKILL1_PROJECTILE_LIFE_S,
        radius: MADA_SKILL1_PROJECTILE_RADIUS,
        damage: MADA_SKILL1_PROJECTILE_DAMAGE,
        flashElapsed: 0,
        redPhase: true,
        trailCarry: 0,
      };
      mesh.scale.setScalar(1.08);
      applyProjectileFlashPhase(projectile, true);
      projectiles.push(projectile);
      spawnTrailParticles(projectile);
    },
    update: ({
      now,
      delta,
      player,
      applyDamage,
      projectileBlockers,
      handleProjectileBlockHit,
    }: UpdateArgs) => {
      if (projectiles.length > 0) {
        for (let i = 0; i < projectileBlockers.length; i += 1) {
          projectileBlockers[i].updateMatrixWorld(true);
        }

        projectileUpdater.update(projectiles, now, delta, {
          getObject: (projectile) => projectile.mesh,
          onTravel: (
            projectile,
            travelNow,
            _travelDelta,
            origin,
            nextPosition,
            direction,
            distance,
            raycaster,
            remove
          ) => {
            const blockResolution = resolveProjectileBlockHit({
              now: travelNow,
              projectile,
              origin,
              direction,
              travelDistance: distance,
              nextPosition,
              projectileBlockers,
              raycaster,
              handleProjectileBlockHit,
            });
            if (blockResolution === "blocked") {
              remove();
            }
          },
          onAfterMove: (projectile, _stepNow, stepDelta, remove) => {
            if (!player.parent) {
              remove();
              return;
            }

            projectile.flashElapsed += stepDelta;
            while (projectile.flashElapsed >= MADA_SKILL1_FLASH_INTERVAL_S) {
              projectile.flashElapsed -= MADA_SKILL1_FLASH_INTERVAL_S;
              applyProjectileFlashPhase(projectile, !projectile.redPhase);
            }

            projectile.mesh.rotateY(stepDelta * 6.5);
            projectile.trailCarry += stepDelta;
            while (projectile.trailCarry >= MADA_SKILL1_TRAIL_INTERVAL_S) {
              projectile.trailCarry -= MADA_SKILL1_TRAIL_INTERVAL_S;
              spawnTrailParticles(projectile);
            }

            player.getWorldPosition(playerProbe);
            playerProbe.y += 1.2;
            const hitDistance = projectile.radius + MADA_SKILL1_PLAYER_RADIUS;
            if (
              projectile.mesh.position.distanceToSquared(playerProbe) <=
              hitDistance * hitDistance
            ) {
              applyDamage(projectile.damage);
              remove();
            }
          },
          onRemove: (projectile) => {
            projectile.mesh.removeFromParent();
            projectile.material.dispose();
            projectile.auraMaterial.dispose();
          },
        });
      }

      updateTrailParticles(delta);
    },
    clear: () => {
      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        removeProjectileAt(i);
      }
      for (let i = trailParticles.length - 1; i >= 0; i -= 1) {
        removeTrailAt(i);
      }
    },
    dispose: () => {
      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        removeProjectileAt(i);
      }
      for (let i = trailParticles.length - 1; i >= 0; i -= 1) {
        removeTrailAt(i);
      }
      projectileGeometry.dispose();
      projectileAuraGeometry.dispose();
      trailGeometry.dispose();
      trailMaterialTemplate.dispose();
    },
  };
};
