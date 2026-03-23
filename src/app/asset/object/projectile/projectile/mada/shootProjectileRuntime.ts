import * as THREE from "three";
import {
  resolveProjectileBlockHit,
  type ProjectileBlockHitHandler,
} from "../../blocking";
import { LinearProjectileUpdater } from "../../linearUpdater";

const MADA_SHOOT_PROJECTILE_DAMAGE = 16;
const MADA_SHOOT_PROJECTILE_SPEED = 21.5;
const MADA_SHOOT_PROJECTILE_LIFE_S = 4.8;
const MADA_SHOOT_PROJECTILE_RADIUS = 0.45;
const MADA_SHOOT_PLAYER_RADIUS = 0.62;
const MADA_SHOOT_CHARGE_MS = 85;
const MADA_SHOOT_RED_COLOR = 0xff2a1f;
const MADA_SHOOT_RED_EMISSIVE = 0xb3120d;
const MADA_SHOOT_BLACK_COLOR = 0x140909;
const MADA_SHOOT_BLACK_EMISSIVE = 0x320707;

type MadaShootProjectile = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  radius: number;
  damage: number;
  chargingUntil: number;
  fired: boolean;
};

type UpdateArgs = {
  now: number;
  delta: number;
  rig: THREE.Object3D;
  player: THREE.Object3D;
  applyDamage: (amount: number) => number;
  getHandLFrontWorldPosition: (
    target: THREE.Vector3,
    forwardOffset?: number
  ) => boolean;
  projectileBlockers: THREE.Object3D[];
  handleProjectileBlockHit?: ProjectileBlockHitHandler;
};

const fallbackForward = new THREE.Vector3();
const targetWorld = new THREE.Vector3();
const aimDirection = new THREE.Vector3();
const probeHand = new THREE.Vector3();
const probePlayer = new THREE.Vector3();

export const createMadaShootProjectileRuntime = (scene: THREE.Scene) => {
  const projectileGeometry = new THREE.SphereGeometry(0.22, 12, 10);
  const projectileMaterialTemplate = new THREE.MeshStandardMaterial({
    color: MADA_SHOOT_RED_COLOR,
    emissive: MADA_SHOOT_RED_EMISSIVE,
    emissiveIntensity: 1.08,
    roughness: 0.22,
    metalness: 0.08,
    transparent: true,
    opacity: 0.95,
  });
  const projectiles: MadaShootProjectile[] = [];
  const projectileUpdater = new LinearProjectileUpdater();
  let shotCounter = 0;

  const removeProjectileAt = (index: number) => {
    const projectile = projectiles[index];
    if (!projectile) return;
    if (projectile.mesh.parent) {
      projectile.mesh.parent.remove(projectile.mesh);
    }
    const material = projectile.mesh.material as THREE.Material;
    material.dispose();
    projectiles.splice(index, 1);
  };

  return {
    spawnChargedProjectile: (now: number, origin: THREE.Vector3) => {
      const useRedPhase = shotCounter % 2 === 0;
      shotCounter += 1;
      const projectileMaterial = projectileMaterialTemplate.clone();
      projectileMaterial.color.setHex(
        useRedPhase ? MADA_SHOOT_RED_COLOR : MADA_SHOOT_BLACK_COLOR
      );
      projectileMaterial.emissive.setHex(
        useRedPhase ? MADA_SHOOT_RED_EMISSIVE : MADA_SHOOT_BLACK_EMISSIVE
      );
      projectileMaterial.emissiveIntensity = useRedPhase ? 1.18 : 0.92;
      projectileMaterial.opacity = useRedPhase ? 0.95 : 0.9;
      const projectileMesh = new THREE.Mesh(
        projectileGeometry,
        projectileMaterial
      );
      projectileMesh.position.copy(origin);
      projectileMesh.scale.setScalar(0.22);
      projectileMesh.castShadow = false;
      projectileMesh.receiveShadow = false;
      scene.add(projectileMesh);
      projectiles.push({
        mesh: projectileMesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: MADA_SHOOT_PROJECTILE_LIFE_S,
        radius: MADA_SHOOT_PROJECTILE_RADIUS,
        damage: MADA_SHOOT_PROJECTILE_DAMAGE,
        chargingUntil: now + MADA_SHOOT_CHARGE_MS,
        fired: false,
      });
    },
    update: ({
      now,
      delta,
      rig,
      player,
      applyDamage,
      getHandLFrontWorldPosition,
      projectileBlockers,
      handleProjectileBlockHit,
    }: UpdateArgs) => {
      if (projectiles.length === 0) return;

      for (let i = 0; i < projectiles.length; i += 1) {
        const projectile = projectiles[i];
        if (!projectile || projectile.fired) continue;
        const chargeProgress = Math.max(
          0,
          Math.min(1, 1 - (projectile.chargingUntil - now) / MADA_SHOOT_CHARGE_MS)
        );
        projectile.mesh.scale.setScalar(0.22 + chargeProgress * 0.92);
        const material = projectile.mesh.material as THREE.MeshStandardMaterial;
        material.opacity = 0.6 + chargeProgress * 0.35;

        if (now < projectile.chargingUntil) {
          if (getHandLFrontWorldPosition(probeHand, 0.36)) {
            projectile.mesh.position.copy(probeHand);
          }
          continue;
        }

        player.getWorldPosition(targetWorld);
        targetWorld.y += 1.25;
        aimDirection.copy(targetWorld).sub(projectile.mesh.position);
        if (aimDirection.lengthSq() <= 0.00001) {
          fallbackForward
            .set(Math.sin(rig.rotation.y), 0.05, Math.cos(rig.rotation.y))
            .normalize();
          aimDirection.copy(fallbackForward);
        } else {
          aimDirection.normalize();
        }
        projectile.velocity
          .copy(aimDirection)
          .multiplyScalar(MADA_SHOOT_PROJECTILE_SPEED);
        projectile.fired = true;
      }

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
          if (!projectile.fired) return;
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
        onAfterMove: (projectile, _stepNow, _stepDelta, remove) => {
          if (!projectile.fired || !player.parent) return;
          player.getWorldPosition(probePlayer);
          probePlayer.y += 1.25;
          const hitDistance = projectile.radius + MADA_SHOOT_PLAYER_RADIUS;
          if (
            projectile.mesh.position.distanceToSquared(probePlayer) <=
            hitDistance * hitDistance
          ) {
            applyDamage(projectile.damage);
            remove();
          }
        },
        onRemove: (projectile) => {
          projectile.mesh.removeFromParent();
          const material = projectile.mesh.material as THREE.Material;
          material.dispose();
        },
      });
    },
    clear: () => {
      shotCounter = 0;
      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        removeProjectileAt(i);
      }
    },
    dispose: () => {
      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        removeProjectileAt(i);
      }
      projectileGeometry.dispose();
      projectileMaterialTemplate.dispose();
    },
  };
};
