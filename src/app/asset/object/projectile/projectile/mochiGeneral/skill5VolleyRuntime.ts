import * as THREE from "three";
import {
  resolveProjectileBlockHit,
  type ProjectileBlockHitHandler,
} from "../../blocking";
import { LinearProjectileUpdater } from "../../linearUpdater";

type MochiGeneralSkill5Projectile = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  radius: number;
  life: number;
  maxLife: number;
};

export type MochiGeneralSkill5VolleyRuntime = {
  spawnProjectile: (args: {
    origin: THREE.Vector3;
    target: THREE.Object3D;
    gameEnded: boolean;
  }) => void;
  update: (args: {
    now: number;
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
    projectileBlockers: THREE.Object3D[];
    handleProjectileBlockHit?: ProjectileBlockHitHandler;
  }) => void;
  dispose: () => void;
};

const SKILL5_PROJECTILE_DAMAGE = 25;
const SKILL5_PROJECTILE_LIFETIME = 3.3;
const SKILL5_PROJECTILE_SPEED_MIN = 8.5 * 3;
const SKILL5_PROJECTILE_SPEED_MAX = 13.5 * 3;
const SKILL5_PROJECTILE_RADIUS = 0.84;
const SKILL5_PROJECTILE_PLAYER_RADIUS = 0.55;
const SKILL5_PROJECTILE_PLAYER_HEIGHT_OFFSET = 1;
const SKILL5_PROJECTILE_TARGET_HEIGHT_OFFSET = 1;
const SKILL5_PROJECTILE_SPREAD = 0.08;
const SKILL5_PROJECTILE_SCALE_MIN = 0.94;
const SKILL5_PROJECTILE_SCALE_MAX = 1.18;

const volleyOriginWorld = new THREE.Vector3();
const volleyTargetWorld = new THREE.Vector3();
const projectileDirectionWorld = new THREE.Vector3();
const playerProbeWorld = new THREE.Vector3();

export const createMochiGeneralSkill5VolleyRuntime = (
  scene: THREE.Scene
): MochiGeneralSkill5VolleyRuntime => {
  const projectileGeometry = new THREE.SphereGeometry(0.54, 11, 9);
  const projectileMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xfff1d6,
    roughness: 0.36,
    metalness: 0.08,
    emissive: 0xb91c1c,
    emissiveIntensity: 0.52,
  });
  const projectiles: MochiGeneralSkill5Projectile[] = [];
  const projectileUpdater = new LinearProjectileUpdater();

  const removeProjectileAt = (index: number) => {
    const projectile = projectiles[index];
    if (!projectile) return;
    if (projectile.mesh.parent) {
      projectile.mesh.parent.remove(projectile.mesh);
    }
    projectiles.splice(index, 1);
  };

  return {
    spawnProjectile: ({ origin, target, gameEnded }) => {
      if (gameEnded) return;

      volleyOriginWorld.copy(origin);
      target.getWorldPosition(volleyTargetWorld);
      volleyTargetWorld.y += SKILL5_PROJECTILE_TARGET_HEIGHT_OFFSET;
      projectileDirectionWorld.copy(volleyTargetWorld).sub(volleyOriginWorld);
      if (projectileDirectionWorld.lengthSq() <= 0.00001) {
        projectileDirectionWorld.set(0, 0.08, 1);
      } else {
        projectileDirectionWorld.normalize();
      }
      projectileDirectionWorld.x += (Math.random() * 2 - 1) * SKILL5_PROJECTILE_SPREAD;
      projectileDirectionWorld.y += (Math.random() * 2 - 1) * SKILL5_PROJECTILE_SPREAD;
      projectileDirectionWorld.z += (Math.random() * 2 - 1) * SKILL5_PROJECTILE_SPREAD;
      if (projectileDirectionWorld.lengthSq() <= 0.00001) {
        projectileDirectionWorld.set(0, 0.1, 1);
      } else {
        projectileDirectionWorld.normalize();
      }

      const speed = THREE.MathUtils.lerp(
        SKILL5_PROJECTILE_SPEED_MIN,
        SKILL5_PROJECTILE_SPEED_MAX,
        Math.random()
      );
      const projectileMesh = new THREE.Mesh(
        projectileGeometry,
        projectileMaterialTemplate
      );
      projectileMesh.position.copy(volleyOriginWorld);
      const projectileScale = THREE.MathUtils.lerp(
        SKILL5_PROJECTILE_SCALE_MIN,
        SKILL5_PROJECTILE_SCALE_MAX,
        Math.random()
      );
      projectileMesh.scale.setScalar(projectileScale);
      projectileMesh.castShadow = false;
      projectileMesh.receiveShadow = false;
      scene.add(projectileMesh);
      projectiles.push({
        mesh: projectileMesh,
        velocity: projectileDirectionWorld.clone().multiplyScalar(speed),
        radius: SKILL5_PROJECTILE_RADIUS * projectileScale,
        life: 0,
        maxLife: SKILL5_PROJECTILE_LIFETIME,
      });
    },
    update: ({
      now,
      delta,
      player,
      applyDamage,
      projectileBlockers,
      handleProjectileBlockHit,
    }) => {
      for (let i = 0; i < projectileBlockers.length; i += 1) {
        projectileBlockers[i].updateMatrixWorld(true);
      }

      player.getWorldPosition(playerProbeWorld);
      playerProbeWorld.y += SKILL5_PROJECTILE_PLAYER_HEIGHT_OFFSET;

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
        onAfterMove: (projectile, _stepNow, _stepDelta, remove) => {
          projectile.velocity.multiplyScalar(0.998);
          const collisionDistance =
            projectile.radius + SKILL5_PROJECTILE_PLAYER_RADIUS;
          if (
            projectile.mesh.position.distanceToSquared(playerProbeWorld) <=
            collisionDistance * collisionDistance
          ) {
            applyDamage(SKILL5_PROJECTILE_DAMAGE);
            remove();
          }
        },
        onRemove: (projectile) => {
          projectile.mesh.removeFromParent();
        },
      });
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
