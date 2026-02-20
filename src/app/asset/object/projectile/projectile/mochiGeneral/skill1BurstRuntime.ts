import * as THREE from "three";
import {
  resolveProjectileBlockHit,
  type ProjectileBlockHitHandler,
} from "../../blocking";
import { LinearProjectileUpdater } from "../../linearUpdater";

type MochiGeneralSkill1Projectile = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  radius: number;
  life: number;
  maxLife: number;
};

export type MochiGeneralSkill1BurstRuntime = {
  spawnBurst: (args: {
    origin: THREE.Vector3;
    gameEnded: boolean;
    rageActive?: boolean;
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
const BOSS_SKILL1_RAGE_PROJECTILE_COUNT = Math.max(
  1,
  Math.round(BOSS_SKILL1_PROJECTILE_COUNT * 1.5)
);
const BOSS_SKILL1_PROJECTILE_DAMAGE = 20;
const BOSS_SKILL1_PROJECTILE_LIFETIME = 3.2;
const BOSS_SKILL1_PROJECTILE_SPEED_MIN = 8.5;
const BOSS_SKILL1_PROJECTILE_SPEED_MAX = 13.5;
const BOSS_SKILL1_PROJECTILE_RADIUS = 0.26;
const BOSS_SKILL1_PROJECTILE_PLAYER_RADIUS = 0.55;
const BOSS_SKILL1_PROJECTILE_PLAYER_HEIGHT_OFFSET = 1;
const BOSS_SKILL1_PROJECTILE_MIN_DIRECTION_Y = -0.05;
const BOSS_SKILL1_PROJECTILE_RAGE_SCALE_MULTIPLIER = 1.2;

const burstOriginWorld = new THREE.Vector3();
const projectileDirectionWorld = new THREE.Vector3();
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
  const projectileMaterialRageTemplate = projectileMaterialTemplate.clone();
  projectileMaterialRageTemplate.color.set(0xffffff);
  projectileMaterialRageTemplate.emissive.set(0xffedd5);
  projectileMaterialRageTemplate.emissiveIntensity = 0.42;
  const projectiles: MochiGeneralSkill1Projectile[] = [];
  const projectileUpdater = new LinearProjectileUpdater();

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
    rageActive = false,
  }: {
    origin: THREE.Vector3;
    gameEnded: boolean;
    rageActive?: boolean;
  }) => {
    if (gameEnded) return;
    burstOriginWorld.copy(origin);
    const projectileMaterial = rageActive
      ? projectileMaterialRageTemplate
      : projectileMaterialTemplate;
    const projectileScaleMultiplier = rageActive
      ? BOSS_SKILL1_PROJECTILE_RAGE_SCALE_MULTIPLIER
      : 1;
    const projectileCount = rageActive
      ? BOSS_SKILL1_RAGE_PROJECTILE_COUNT
      : BOSS_SKILL1_PROJECTILE_COUNT;

    for (let i = 0; i < projectileCount; i += 1) {
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
        projectileMaterial
      );
      projectileMesh.position.copy(burstOriginWorld);
      const projectileScale =
        projectileScaleMultiplier * THREE.MathUtils.lerp(0.9, 1.12, Math.random());
      projectileMesh.scale.setScalar(projectileScale);
      projectileMesh.castShadow = false;
      projectileMesh.receiveShadow = false;
      scene.add(projectileMesh);
      projectiles.push({
        mesh: projectileMesh,
        velocity: projectileDirectionWorld.clone().multiplyScalar(speed),
        radius: BOSS_SKILL1_PROJECTILE_RADIUS * projectileScale,
        life: 0,
        maxLife: BOSS_SKILL1_PROJECTILE_LIFETIME,
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
        projectile.velocity.multiplyScalar(0.997);
        const collisionDistance = projectile.radius + BOSS_SKILL1_PROJECTILE_PLAYER_RADIUS;
        if (
          projectile.mesh.position.distanceToSquared(playerProbeWorld) <=
          collisionDistance * collisionDistance
        ) {
          applyDamage(BOSS_SKILL1_PROJECTILE_DAMAGE);
          remove();
        }
      },
      onRemove: (projectile) => {
        projectile.mesh.removeFromParent();
      },
    });
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
      projectileMaterialRageTemplate.dispose();
    },
  };
};
