import * as THREE from "three";
import {
  resolveProjectileBlockHit,
  type ProjectileBlockHitHandler,
} from "../../blocking";

type MochiGeneralSkill1Projectile = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  radius: number;
  life: number;
};

export type MochiGeneralSkill1BurstRuntime = {
  spawnBurst: (args: {
    origin: THREE.Vector3;
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

const BOSS_SKILL1_PROJECTILE_COUNT = 40;
const BOSS_SKILL1_PROJECTILE_DAMAGE = 20;
const BOSS_SKILL1_PROJECTILE_LIFETIME = 3.2;
const BOSS_SKILL1_PROJECTILE_SPEED_MIN = 8.5;
const BOSS_SKILL1_PROJECTILE_SPEED_MAX = 13.5;
const BOSS_SKILL1_PROJECTILE_RADIUS = 0.26;
const BOSS_SKILL1_PROJECTILE_PLAYER_RADIUS = 0.55;
const BOSS_SKILL1_PROJECTILE_PLAYER_HEIGHT_OFFSET = 1;
const BOSS_SKILL1_PROJECTILE_MIN_DIRECTION_Y = -0.05;

const burstOriginWorld = new THREE.Vector3();
const projectileDirectionWorld = new THREE.Vector3();
const projectileTravelOriginWorld = new THREE.Vector3();
const projectileNextPositionWorld = new THREE.Vector3();
const projectileTravelDirectionWorld = new THREE.Vector3();
const projectileRaycaster = new THREE.Raycaster();
const playerProbeWorld = new THREE.Vector3();

export const createMochiGeneralSkill1BurstRuntime = (
  scene: THREE.Scene
): MochiGeneralSkill1BurstRuntime => {
  const projectileGeometry = new THREE.SphereGeometry(0.2, 12, 10);
  const projectileMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0xf9f0dd,
    roughness: 0.52,
    metalness: 0.08,
    emissive: 0xd4a373,
    emissiveIntensity: 0.22,
  });
  const projectiles: MochiGeneralSkill1Projectile[] = [];

  const removeProjectileAt = (index: number) => {
    const projectile = projectiles[index];
    if (!projectile) return;
    if (projectile.mesh.parent) {
      projectile.mesh.parent.remove(projectile.mesh);
    }
    projectiles.splice(index, 1);
  };

  const spawnBurst = ({
    origin,
    gameEnded,
  }: {
    origin: THREE.Vector3;
    gameEnded: boolean;
  }) => {
    if (gameEnded) return;
    burstOriginWorld.copy(origin);

    for (let i = 0; i < BOSS_SKILL1_PROJECTILE_COUNT; i += 1) {
      let safety = 0;
      do {
        projectileDirectionWorld.set(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        );
        safety += 1;
        if (safety > 12) break;
      } while (
        projectileDirectionWorld.lengthSq() <= 0.00001 ||
        projectileDirectionWorld.y < BOSS_SKILL1_PROJECTILE_MIN_DIRECTION_Y
      );
      if (projectileDirectionWorld.lengthSq() <= 0.00001) {
        projectileDirectionWorld.set(1, 0.08, 0);
      }
      projectileDirectionWorld.normalize();

      const speed = THREE.MathUtils.lerp(
        BOSS_SKILL1_PROJECTILE_SPEED_MIN,
        BOSS_SKILL1_PROJECTILE_SPEED_MAX,
        Math.random()
      );
      const projectileMesh = new THREE.Mesh(
        projectileGeometry,
        projectileMaterialTemplate
      );
      projectileMesh.position.copy(burstOriginWorld);
      projectileMesh.castShadow = false;
      projectileMesh.receiveShadow = false;
      scene.add(projectileMesh);
      projectiles.push({
        mesh: projectileMesh,
        velocity: projectileDirectionWorld.clone().multiplyScalar(speed),
        radius: BOSS_SKILL1_PROJECTILE_RADIUS,
        life: BOSS_SKILL1_PROJECTILE_LIFETIME,
      });
    }
  };

  const update = ({
    now,
    delta,
    player,
    applyDamage,
    projectileBlockers,
    handleProjectileBlockHit,
  }: {
    now: number;
    delta: number;
    player: THREE.Object3D;
    applyDamage: (amount: number) => number;
    projectileBlockers: THREE.Object3D[];
    handleProjectileBlockHit?: ProjectileBlockHitHandler;
  }) => {
    for (let i = 0; i < projectileBlockers.length; i += 1) {
      projectileBlockers[i].updateMatrixWorld(true);
    }

    player.getWorldPosition(playerProbeWorld);
    playerProbeWorld.y += BOSS_SKILL1_PROJECTILE_PLAYER_HEIGHT_OFFSET;

    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = projectiles[i];
      projectile.life -= delta;
      if (projectile.life <= 0) {
        removeProjectileAt(i);
        continue;
      }

      projectileTravelOriginWorld.copy(projectile.mesh.position);
      const travelDistance = projectile.velocity.length() * Math.max(0, delta);
      if (travelDistance > 0.000001) {
        projectileTravelDirectionWorld.copy(projectile.velocity).normalize();
        projectileNextPositionWorld
          .copy(projectileTravelOriginWorld)
          .addScaledVector(projectile.velocity, delta);

        if (projectileBlockers.length) {
          const blockResolution = resolveProjectileBlockHit({
            now,
            projectile,
            origin: projectileTravelOriginWorld,
            direction: projectileTravelDirectionWorld,
            travelDistance,
            nextPosition: projectileNextPositionWorld,
            projectileBlockers,
            raycaster: projectileRaycaster,
            handleProjectileBlockHit,
          });
          if (blockResolution === "blocked") {
            removeProjectileAt(i);
            continue;
          }
        }
      } else {
        projectileNextPositionWorld.copy(projectileTravelOriginWorld);
      }

      projectile.mesh.position.copy(projectileNextPositionWorld);
      projectile.velocity.multiplyScalar(0.997);

      const collisionDistance = projectile.radius + BOSS_SKILL1_PROJECTILE_PLAYER_RADIUS;
      if (
        projectile.mesh.position.distanceToSquared(playerProbeWorld) <=
        collisionDistance * collisionDistance
      ) {
        applyDamage(BOSS_SKILL1_PROJECTILE_DAMAGE);
        removeProjectileAt(i);
      }
    }
  };

  return {
    spawnBurst,
    update,
    dispose: () => {
      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        removeProjectileAt(i);
      }
      projectileGeometry.dispose();
      projectileMaterialTemplate.dispose();
    },
  };
};
