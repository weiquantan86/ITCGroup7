import * as THREE from "three";
import { LinearProjectileUpdater } from "../../../object/projectile/linearUpdater";
import type { ProjectileExplosionFragment } from "../../../object/projectile/types";
import type {
  FireProjectileArgs,
  ProjectileBlockHitArgs,
  ProjectileLifecycleHooks,
  ProjectileRemoveReason,
} from "../types";
import type { Projectile } from "./types";
import type { AttackTargetResolver } from "./attackResolver";

type CreateProjectileSystemArgs = {
  scene: THREE.Scene;
  groundY: number;
  projectileColliders: THREE.Object3D[];
  attackResolver: AttackTargetResolver;
  applyEnergy: (amount: number) => number;
  getDefaultHitEnergyGain: () => number;
};

type UpdateProjectileSystemArgs = {
  now: number;
  delta: number;
  projectileBlockers: THREE.Object3D[];
  handleProjectileBlockHit?: (args: ProjectileBlockHitArgs) => boolean;
};

const projectileSpeed = 18;
const projectileLifetime = 2.2;
const projectileRadius = 0.12;
const projectileGravity = -12;

export const createProjectileSystem = ({
  scene,
  groundY,
  projectileColliders,
  attackResolver,
  applyEnergy,
  getDefaultHitEnergyGain,
}: CreateProjectileSystemArgs) => {
  let projectileId = 0;
  const projectiles: Projectile[] = [];
  const projectileLifecycleHooks = new Map<number, ProjectileLifecycleHooks>();
  const projectileRemovedReason = new Map<number, ProjectileRemoveReason>();
  const projectileForcedRemoval = new Set<number>();
  const projectileExploded = new Set<number>();
  const projectileExplosionFragments: ProjectileExplosionFragment[] = [];
  const projectileUpdater = new LinearProjectileUpdater();
  const attackRayHitPoint = new THREE.Vector3();
  const attackRayDirection = new THREE.Vector3();
  const explosionOrigin = new THREE.Vector3();
  const explosionDirection = new THREE.Vector3();
  const projectileGeometry = new THREE.SphereGeometry(projectileRadius, 12, 12);
  const projectileMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x93c5fd,
    emissiveIntensity: 0.6,
    roughness: 0.35,
    metalness: 0.1,
  });
  const projectileExplosionGeometry = new THREE.IcosahedronGeometry(0.09, 0);
  const projectileExplosionMaterial = new THREE.MeshStandardMaterial({
    color: 0x86efac,
    roughness: 0.22,
    metalness: 0.18,
    emissive: 0x22c55e,
    emissiveIntensity: 0.7,
  });

  const clear = () => {
    for (let i = 0; i < projectiles.length; i += 1) {
      const projectile = projectiles[i];
      scene.remove(projectile.mesh);
      if (projectile.ownsMaterial) {
        projectile.material.dispose();
      }
      projectileLifecycleHooks.delete(projectile.id);
      projectileRemovedReason.delete(projectile.id);
      projectileForcedRemoval.delete(projectile.id);
      projectileExploded.delete(projectile.id);
    }
    projectiles.length = 0;
    for (let i = 0; i < projectileExplosionFragments.length; i += 1) {
      const fragment = projectileExplosionFragments[i];
      scene.remove(fragment.mesh);
      if (fragment.ownsMaterial) {
        fragment.material.dispose();
      }
    }
    projectileExplosionFragments.length = 0;
  };

  const spawnProjectile = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number = projectileSpeed,
    lifetime: number = projectileLifetime,
    options?: FireProjectileArgs
  ) => {
    const providedMesh = options?.mesh;
    const useCustomMaterial =
      !providedMesh &&
      (options?.color !== undefined ||
        options?.emissive !== undefined ||
        options?.emissiveIntensity !== undefined);
    const material = useCustomMaterial
      ? new THREE.MeshStandardMaterial({
          color: options?.color ?? 0xe2e8f0,
          emissive: options?.emissive ?? 0x93c5fd,
          emissiveIntensity: options?.emissiveIntensity ?? 0.6,
          roughness: 0.35,
          metalness: 0.1,
        })
      : providedMesh
        ? ((Array.isArray(providedMesh.material)
            ? providedMesh.material[0]
            : providedMesh.material) as THREE.Material)
        : projectileMaterial;
    const mesh = providedMesh ?? new THREE.Mesh(projectileGeometry, material);
    if (mesh.parent) {
      mesh.removeFromParent();
    }
    mesh.position.copy(origin);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (options?.scale) {
      mesh.scale.setScalar(options.scale);
    }
    scene.add(mesh);
    const velocity = direction.clone();
    if (velocity.lengthSq() < 0.000001) {
      velocity.set(0, 0, 1);
    } else {
      velocity.normalize();
    }
    velocity.multiplyScalar(speed);
    let resolvedRadius = options?.radius;
    if (resolvedRadius == null && providedMesh) {
      if (!providedMesh.geometry.boundingSphere) {
        providedMesh.geometry.computeBoundingSphere();
      }
      const geometryRadius = providedMesh.geometry.boundingSphere?.radius;
      if (geometryRadius) {
        const maxScale = Math.max(
          providedMesh.scale.x,
          providedMesh.scale.y,
          providedMesh.scale.z
        );
        resolvedRadius = geometryRadius * maxScale;
      }
    }
    const resolvedDamage = Math.max(
      8,
      options?.damage ?? Math.round(10 + speed * 0.6)
    );
    const id = projectileId++;
    projectiles.push({
      id,
      mesh,
      velocity,
      life: 0,
      maxLife: lifetime,
      radius: Math.max(
        0.05,
        resolvedRadius ?? projectileRadius * (options?.scale ?? 1)
      ),
      targetHitRadius: Math.max(0, options?.targetHitRadius ?? 0),
      damage: resolvedDamage,
      energyGainOnHit:
        options?.energyGainOnHit == null
          ? null
          : Math.max(0, options.energyGainOnHit),
      splitOnImpact: Boolean(options?.splitOnImpact),
      explosionRadius: Math.max(0, options?.explosionRadius ?? 0),
      explosionDamage: Math.max(0, options?.explosionDamage ?? 0),
      explosionColor: options?.explosionColor ?? null,
      explosionEmissive: options?.explosionEmissive ?? null,
      explosionEmissiveIntensity: options?.explosionEmissiveIntensity ?? null,
      material,
      ownsMaterial: useCustomMaterial && !providedMesh,
    });
    if (options?.lifecycle) {
      projectileLifecycleHooks.set(id, options.lifecycle);
    }
  };

  const triggerProjectileExplosion = (
    now: number,
    projectile: Projectile,
    impactPoint: THREE.Vector3,
    impactDirection: THREE.Vector3,
    primaryTargetId?: string | null
  ) => {
    if (!projectile.splitOnImpact) return;
    projectileExploded.add(projectile.id);

    explosionOrigin.copy(impactPoint);
    explosionDirection.copy(impactDirection);
    if (explosionDirection.lengthSq() < 0.000001) {
      explosionDirection.set(0, 0, 1);
    }
    explosionDirection.normalize();

    const baseExplosionRadius = 3.6;
    const visualFactor = THREE.MathUtils.clamp(
      projectile.explosionRadius > 0
        ? projectile.explosionRadius / baseExplosionRadius
        : 1,
      0.75,
      5
    );
    const fragmentCount = Math.max(
      14,
      Math.min(42, Math.round(14 * visualFactor))
    );
    const spread = 0.45 * visualFactor;
    const velocityScale = Math.sqrt(visualFactor);
    const minScale = 0.72 * visualFactor;
    const maxScale = 1.08 * visualFactor;
    const useCustomExplosionMaterial =
      projectile.explosionColor != null ||
      projectile.explosionEmissive != null ||
      projectile.explosionEmissiveIntensity != null;

    for (let i = 0; i < fragmentCount; i += 1) {
      const fragmentMaterial = useCustomExplosionMaterial
        ? new THREE.MeshStandardMaterial({
            color: projectile.explosionColor ?? 0x86efac,
            roughness: 0.22,
            metalness: 0.18,
            emissive: projectile.explosionEmissive ?? 0x22c55e,
            emissiveIntensity: projectile.explosionEmissiveIntensity ?? 0.7,
          })
        : projectileExplosionMaterial;
      const mesh = new THREE.Mesh(projectileExplosionGeometry, fragmentMaterial);
      const baseScale = THREE.MathUtils.lerp(minScale, maxScale, Math.random());
      mesh.scale.setScalar(baseScale);
      mesh.position.copy(explosionOrigin).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread
        )
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4.6 * velocityScale,
        (1.5 + Math.random() * 2.8) * velocityScale,
        (Math.random() - 0.5) * 4.6 * velocityScale
      ).addScaledVector(explosionDirection, -2.2 * velocityScale);
      projectileExplosionFragments.push({
        mesh,
        velocity,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 7.4,
          (Math.random() - 0.5) * 7.4,
          (Math.random() - 0.5) * 7.4
        ),
        life: 0,
        maxLife: (0.55 + Math.random() * 0.2) * velocityScale,
        baseScale,
        material: fragmentMaterial,
        ownsMaterial: useCustomExplosionMaterial,
      });
    }

    if (projectile.explosionRadius <= 0 || projectile.explosionDamage <= 0) return;
    attackResolver.applyExplosionDamage({
      now,
      center: explosionOrigin,
      radius: projectile.explosionRadius,
      baseDamage: projectile.explosionDamage,
      direction: explosionDirection,
      excludeTargetId: primaryTargetId ?? undefined,
    });
  };

  const updateProjectileExplosionFragments = (delta: number) => {
    for (let i = projectileExplosionFragments.length - 1; i >= 0; i -= 1) {
      const fragment = projectileExplosionFragments[i];
      fragment.velocity.y -= 11.5 * delta;
      fragment.mesh.position.addScaledVector(fragment.velocity, delta);
      fragment.mesh.rotation.x += fragment.spin.x * delta;
      fragment.mesh.rotation.y += fragment.spin.y * delta;
      fragment.mesh.rotation.z += fragment.spin.z * delta;
      fragment.life += delta;
      const lifeRatio = Math.max(0, 1 - fragment.life / fragment.maxLife);
      fragment.mesh.scale.setScalar(
        Math.max(0.08, fragment.baseScale * lifeRatio)
      );
      if (fragment.life >= fragment.maxLife) {
        scene.remove(fragment.mesh);
        if (fragment.ownsMaterial) {
          fragment.material.dispose();
        }
        projectileExplosionFragments.splice(i, 1);
      }
    }
  };

  const update = ({
    now,
    delta,
    projectileBlockers,
    handleProjectileBlockHit,
  }: UpdateProjectileSystemArgs) => {
    for (let i = 0; i < projectileBlockers.length; i += 1) {
      projectileBlockers[i].updateMatrixWorld(true);
    }

    projectileUpdater.update(projectiles, now, delta, {
      getObject: (projectile) => projectile.mesh,
      applyForces: (projectile, stepDelta) => {
        let defaultGravityApplied = false;
        const applyDefaultGravity = () => {
          if (defaultGravityApplied) return;
          defaultGravityApplied = true;
          projectile.velocity.y += projectileGravity * stepDelta;
        };
        const lifecycle = projectileLifecycleHooks.get(projectile.id);
        if (!lifecycle?.applyForces) {
          applyDefaultGravity();
          return;
        }
        lifecycle.applyForces({
          velocity: projectile.velocity,
          delta: stepDelta,
          applyDefaultGravity,
          removeProjectile: (reason) => {
            if (reason) {
              projectileRemovedReason.set(projectile.id, reason);
            }
            projectileForcedRemoval.add(projectile.id);
          },
        });
      },
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
        if (projectileForcedRemoval.has(projectile.id)) return;
        const reach = distance + projectile.radius;
        const attackHit = attackResolver.intersect(
          origin,
          direction,
          reach,
          projectile.targetHitRadius
        );

        let worldHit: THREE.Intersection | null = null;
        if (projectileColliders.length) {
          raycaster.set(origin, direction);
          raycaster.far = reach;
          const hits = raycaster.intersectObjects(projectileColliders, true);
          if (hits.length) {
            worldHit = hits[0];
          }
        }
        let blockerHit: THREE.Intersection | null = null;
        if (projectileBlockers.length) {
          raycaster.set(origin, direction);
          raycaster.far = reach;
          const blockerHits = raycaster.intersectObjects(projectileBlockers, true);
          if (blockerHits.length) {
            blockerHit = blockerHits[0];
          }
        }

        const nearestObstacleDistance = Math.min(
          worldHit?.distance ?? Infinity,
          blockerHit?.distance ?? Infinity
        );
        const shouldUseAttackHit =
          Boolean(attackHit) && attackHit!.distance <= nearestObstacleDistance;

        if (shouldUseAttackHit && attackHit) {
          projectileRemovedReason.set(projectile.id, "impact");
          attackRayHitPoint.copy(attackHit.point);
          attackRayDirection.copy(direction);
          applyEnergy(projectile.energyGainOnHit ?? getDefaultHitEnergyGain());
          attackHit.target.onHit({
            now: travelNow,
            source: "projectile",
            damage: projectile.damage,
            point: attackRayHitPoint.clone(),
            direction: attackRayDirection.clone(),
          });
          triggerProjectileExplosion(
            travelNow,
            projectile,
            attackRayHitPoint,
            attackRayDirection,
            attackHit.target.id
          );
          remove();
          return;
        }

        const blockerIsNearest =
          Boolean(blockerHit) &&
          (!worldHit || blockerHit!.distance <= worldHit.distance);

        if (blockerIsNearest && blockerHit) {
          const handledByRuntime =
            handleProjectileBlockHit?.({
              now: travelNow,
              projectile,
              blockerHit,
              origin,
              direction,
              travelDistance: distance,
              nextPosition,
            }) ?? false;
          if (handledByRuntime) {
            return;
          }
        }

        const collisionHit = blockerIsNearest ? blockerHit : worldHit;
        if (collisionHit) {
          projectileRemovedReason.set(projectile.id, "impact");
          attackRayHitPoint.copy(collisionHit.point);
          attackRayDirection.copy(direction);
          triggerProjectileExplosion(
            travelNow,
            projectile,
            attackRayHitPoint,
            attackRayDirection,
            null
          );
          remove();
        }
      },
      shouldExpire: (projectile) => {
        if (projectileForcedRemoval.has(projectile.id)) {
          return true;
        }
        const shouldExpireByGround =
          projectile.mesh.position.y <= groundY + projectile.radius * 0.4;
        if (shouldExpireByGround) {
          projectileRemovedReason.set(projectile.id, "expired");
        }
        return shouldExpireByGround;
      },
      onRemove: (projectile) => {
        const lifecycle = projectileLifecycleHooks.get(projectile.id);
        if (lifecycle?.onRemove) {
          const reason =
            projectileRemovedReason.get(projectile.id) ??
            (projectile.life >= projectile.maxLife ? "expired" : "cleared");
          lifecycle.onRemove({
            reason,
            now,
            position: projectile.mesh.position,
            velocity: projectile.velocity,
            triggerExplosion: () => {
              if (projectileExploded.has(projectile.id)) return;
              attackRayHitPoint.copy(projectile.mesh.position);
              attackRayDirection.copy(projectile.velocity);
              if (attackRayDirection.lengthSq() < 0.000001) {
                attackRayDirection.set(0, 0, 1);
              } else {
                attackRayDirection.normalize();
              }
              triggerProjectileExplosion(
                now,
                projectile,
                attackRayHitPoint,
                attackRayDirection,
                null
              );
            },
          });
        }
        scene.remove(projectile.mesh);
        if (projectile.ownsMaterial) {
          projectile.material.dispose();
        }
        projectileLifecycleHooks.delete(projectile.id);
        projectileRemovedReason.delete(projectile.id);
        projectileForcedRemoval.delete(projectile.id);
        projectileExploded.delete(projectile.id);
      },
    });

    updateProjectileExplosionFragments(delta);
  };

  const fire = (
    fallbackOrigin: THREE.Vector3,
    fallbackDirection: THREE.Vector3,
    args?: FireProjectileArgs
  ) => {
    const origin = args?.origin ?? fallbackOrigin;
    const direction = args?.direction ?? fallbackDirection;
    spawnProjectile(
      origin,
      direction,
      args?.speed ?? projectileSpeed,
      args?.lifetime ?? projectileLifetime,
      args
    );
  };

  const dispose = () => {
    clear();
    projectileGeometry.dispose();
    projectileMaterial.dispose();
    projectileExplosionGeometry.dispose();
    projectileExplosionMaterial.dispose();
  };

  return {
    projectiles,
    clear,
    update,
    fire,
    dispose,
  };
};
