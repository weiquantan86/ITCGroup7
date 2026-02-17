import * as THREE from "three";
import { LinearProjectileUpdater } from "../../../../object/projectile/linearUpdater";
import {
  findNearestProjectileBlockHit,
  resolveProjectileBlockHit,
} from "../../../../object/projectile/blocking";
import { getProjectileTypeDefinition } from "../../../../object/projectile/projectile/registry";
import { createProjectileFxSystem } from "../../../../object/projectile/projectile/shared/fxSystem";
import { createProjectileMeshFactory } from "../../../../object/projectile/projectile/shared/meshFactory";
import type { ProjectileVisualOptions } from "../../../../object/projectile/projectile/types";
import type {
  FireProjectileArgs,
  ProjectileBlockHitArgs,
  ProjectileLifecycleHooks,
  ProjectileRemoveReason,
} from "../types";
import type { Projectile } from "../engine/types";
import type { AttackTargetResolver } from "./attackResolver";

type CreateProjectileSystemArgs = {
  scene: THREE.Scene;
  groundY: number;
  projectileColliders: THREE.Object3D[];
  attackResolver: AttackTargetResolver;
  applyEnergy: (amount: number) => number;
  applyMana: (amount: number) => number;
  getDefaultHitEnergyGain: () => number;
  getDefaultHitManaGain: () => number;
};

type UpdateProjectileSystemArgs = {
  now: number;
  delta: number;
  projectileBlockers: THREE.Object3D[];
  handleProjectileBlockHit?: (args: ProjectileBlockHitArgs) => boolean;
};

type ResolveCameraAimArgs = {
  camera: THREE.Camera;
  offset?: THREE.Vector3;
  forwardOffset?: number;
  distance?: number;
  outOrigin?: THREE.Vector3;
  outDirection?: THREE.Vector3;
  outPoint?: THREE.Vector3;
};

type FireWithCameraAimArgs = {
  camera: THREE.Camera;
  args?: FireProjectileArgs;
  offset?: THREE.Vector3;
  forwardOffset?: number;
};

const defaultAttackAimOffset = new THREE.Vector3(0, -0.2, 0);
const defaultAttackAimForwardOffset = 0.4;
const defaultAttackAimDistance = 30;

const toProjectileVisualOptions = (
  args: FireProjectileArgs | undefined
): ProjectileVisualOptions | undefined => {
  if (!args) return undefined;
  return {
    mesh: args.mesh,
    color: args.color,
    emissive: args.emissive,
    emissiveIntensity: args.emissiveIntensity,
    scale: args.scale,
    radius: args.radius,
  };
};

export const createProjectileSystem = ({
  scene,
  groundY,
  projectileColliders,
  attackResolver,
  applyEnergy,
  applyMana,
  getDefaultHitEnergyGain,
  getDefaultHitManaGain,
}: CreateProjectileSystemArgs) => {
  let projectileId = 0;
  const projectiles: Projectile[] = [];
  const projectileLifecycleHooks = new Map<number, ProjectileLifecycleHooks>();
  const projectileRemovedReason = new Map<number, ProjectileRemoveReason>();
  const projectileForcedRemoval = new Set<number>();
  const projectileExploded = new Set<number>();
  const projectileHitTargets = new Map<number, Set<string>>();
  const sharedHitGroupTargets = new Map<string, Set<string>>();
  const sharedHitGroupRefCounts = new Map<string, number>();
  const projectileUpdater = new LinearProjectileUpdater();
  const projectileFxSystem = createProjectileFxSystem({ scene });
  const projectileMeshFactory = createProjectileMeshFactory();
  const attackRayHitPoint = new THREE.Vector3();
  const attackRayDirection = new THREE.Vector3();
  const explosionOrigin = new THREE.Vector3();
  const explosionDirection = new THREE.Vector3();
  const cameraAimOrigin = new THREE.Vector3();
  const cameraAimDirection = new THREE.Vector3();
  const cameraAimPoint = new THREE.Vector3();

  const retainSharedHitGroup = (groupId: string | null) => {
    if (!groupId) return;
    sharedHitGroupRefCounts.set(
      groupId,
      (sharedHitGroupRefCounts.get(groupId) ?? 0) + 1
    );
  };

  const releaseSharedHitGroup = (groupId: string | null) => {
    if (!groupId) return;
    const count = sharedHitGroupRefCounts.get(groupId) ?? 0;
    if (count <= 1) {
      sharedHitGroupRefCounts.delete(groupId);
      sharedHitGroupTargets.delete(groupId);
      return;
    }
    sharedHitGroupRefCounts.set(groupId, count - 1);
  };

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
      projectileHitTargets.delete(projectile.id);
      releaseSharedHitGroup(projectile.sharedHitGroupId);
    }
    projectiles.length = 0;
    sharedHitGroupTargets.clear();
    sharedHitGroupRefCounts.clear();
    projectileFxSystem.clear();
  };

  const spawnProjectile = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    lifetime: number,
    options: FireProjectileArgs | undefined,
    projectileTypeId: string
  ) => {
    const typeDefinition = getProjectileTypeDefinition(projectileTypeId);
    const visualOptions = toProjectileVisualOptions(options);
    const meshBuild = typeDefinition.hooks.createMesh({
      visual: visualOptions,
      buildDefaultSphereMesh: projectileMeshFactory.createDefaultSphereMesh,
    });
    const mesh = meshBuild.mesh;
    if (mesh.parent) {
      mesh.removeFromParent();
    }
    mesh.position.copy(origin);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const velocity = direction.clone();
    if (velocity.lengthSq() < 0.000001) {
      velocity.set(0, 0, 1);
    } else {
      velocity.normalize();
    }
    velocity.multiplyScalar(speed);

    const fallbackScale = options?.scale ?? Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
    const resolvedRadius = Math.max(
      0.05,
      options?.radius ??
        meshBuild.radiusFromMesh ??
        typeDefinition.defaults.radius * fallbackScale
    );
    const resolvedDamage = Math.max(
      1,
      options?.damage ??
        Math.round(
          typeDefinition.defaults.damageBase +
            speed * typeDefinition.defaults.damagePerSpeed
        )
    );
    const resolvedEnergyGainOnHit =
      options?.energyGainOnHit == null
        ? typeDefinition.defaults.energyGainOnHit
        : Math.max(0, options.energyGainOnHit);
    const resolvedManaGainOnHit =
      options?.manaGainOnHit == null
        ? typeDefinition.defaults.manaGainOnHit
        : Math.max(0, options.manaGainOnHit);

    const id = projectileId++;
    const sharedHitGroupId = options?.sharedHitGroupId ?? null;
    projectiles.push({
      id,
      projectileType: typeDefinition.id,
      gravity:
        options?.gravity == null
          ? typeDefinition.defaults.gravity
          : options.gravity,
      grantEnergyOnTargetHit:
        options?.grantEnergyOnTargetHit ??
        typeDefinition.rules.grantEnergyOnTargetHit,
      grantManaOnTargetHit:
        options?.grantManaOnTargetHit ??
        typeDefinition.rules.grantManaOnTargetHit,
      explodeOnTargetHit:
        options?.explodeOnTargetHit ?? typeDefinition.rules.explodeOnTargetHit,
      explodeOnWorldHit:
        options?.explodeOnWorldHit ?? typeDefinition.rules.explodeOnWorldHit,
      explodeOnExpire:
        options?.explodeOnExpire ?? typeDefinition.rules.explodeOnExpire,
      removeOnTargetHit:
        options?.removeOnTargetHit ?? typeDefinition.rules.removeOnTargetHit,
      removeOnWorldHit:
        options?.removeOnWorldHit ?? typeDefinition.rules.removeOnWorldHit,
      singleHitPerTarget: Boolean(options?.singleHitPerTarget),
      sharedHitGroupId,
      mesh,
      velocity,
      life: 0,
      maxLife: lifetime,
      radius: resolvedRadius,
      targetHitRadius: Math.max(
        0,
        options?.targetHitRadius ?? typeDefinition.defaults.targetHitRadius
      ),
      damage: resolvedDamage,
      energyGainOnHit: resolvedEnergyGainOnHit,
      manaGainOnHit: resolvedManaGainOnHit,
      splitOnImpact: options?.splitOnImpact ?? typeDefinition.defaults.splitOnImpact,
      explosionRadius: Math.max(
        0,
        options?.explosionRadius ?? typeDefinition.defaults.explosionRadius
      ),
      explosionDamage: Math.max(
        0,
        options?.explosionDamage ?? typeDefinition.defaults.explosionDamage
      ),
      explosionMinDamage: Math.max(
        0,
        options?.explosionMinDamage ?? typeDefinition.defaults.explosionMinDamage
      ),
      explosionColor:
        options?.explosionColor ?? typeDefinition.defaults.explosionColor,
      explosionEmissive:
        options?.explosionEmissive ?? typeDefinition.defaults.explosionEmissive,
      explosionEmissiveIntensity:
        options?.explosionEmissiveIntensity ??
        typeDefinition.defaults.explosionEmissiveIntensity,
      material: meshBuild.material,
      ownsMaterial: meshBuild.ownsMaterial,
    });
    retainSharedHitGroup(sharedHitGroupId);

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
    if (projectileExploded.has(projectile.id)) return;
    projectileExploded.add(projectile.id);

    explosionOrigin.copy(impactPoint);
    explosionDirection.copy(impactDirection);
    if (explosionDirection.lengthSq() < 0.000001) {
      explosionDirection.set(0, 0, 1);
    } else {
      explosionDirection.normalize();
    }

    const typeDefinition = getProjectileTypeDefinition(projectile.projectileType);
    typeDefinition.hooks.spawnExplosionFx({
      now,
      projectile,
      point: explosionOrigin,
      direction: explosionDirection,
      spawnDefaultExplosionFx: () => {
        projectileFxSystem.spawnDefaultExplosionFx({
          projectile,
          point: explosionOrigin,
          direction: explosionDirection,
        });
      },
    });

    if (!projectile.splitOnImpact) return;
    if (projectile.explosionRadius <= 0 || projectile.explosionDamage <= 0) return;

    attackResolver.applyExplosionDamage({
      now,
      center: explosionOrigin,
      radius: projectile.explosionRadius,
      baseDamage: projectile.explosionDamage,
      minDamage: projectile.explosionMinDamage,
      direction: explosionDirection,
      excludeTargetId: primaryTargetId ?? undefined,
    });
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
          projectile.velocity.y += projectile.gravity * stepDelta;
        };
        const lifecycle = projectileLifecycleHooks.get(projectile.id);
        if (!lifecycle?.applyForces) {
          applyDefaultGravity();
          return;
        }
        lifecycle.applyForces({
          velocity: projectile.velocity,
          position: projectile.mesh.position,
          delta: stepDelta,
          applyDefaultGravity,
          findNearestTarget: ({ center, radius }) => {
            const hit = attackResolver.findNearestInRadius(center, radius);
            if (!hit) return null;
            return {
              targetId: hit.target.id,
              point: hit.point.clone(),
              distance: hit.distance,
            };
          },
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

        const typeDefinition = getProjectileTypeDefinition(projectile.projectileType);
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

        const blockerHit = findNearestProjectileBlockHit({
          origin,
          direction,
          travelDistance: distance,
          projectileRadius: projectile.radius,
          projectileBlockers,
          raycaster,
        });

        const nearestObstacleDistance = Math.min(
          worldHit?.distance ?? Infinity,
          blockerHit?.distance ?? Infinity
        );
        const shouldUseAttackHit =
          Boolean(attackHit) && attackHit!.distance <= nearestObstacleDistance;
        let canApplyAttackHit = shouldUseAttackHit;

        if (
          canApplyAttackHit &&
          attackHit &&
          projectile.sharedHitGroupId
        ) {
          let groupTargets = sharedHitGroupTargets.get(projectile.sharedHitGroupId);
          if (!groupTargets) {
            groupTargets = new Set<string>();
            sharedHitGroupTargets.set(projectile.sharedHitGroupId, groupTargets);
          }
          if (groupTargets.has(attackHit.target.id)) {
            canApplyAttackHit = false;
          } else {
            groupTargets.add(attackHit.target.id);
          }
        }

        if (
          canApplyAttackHit &&
          attackHit &&
          projectile.singleHitPerTarget
        ) {
          let hitTargets = projectileHitTargets.get(projectile.id);
          if (!hitTargets) {
            hitTargets = new Set<string>();
            projectileHitTargets.set(projectile.id, hitTargets);
          }
          if (hitTargets.has(attackHit.target.id)) {
            canApplyAttackHit = false;
          } else {
            hitTargets.add(attackHit.target.id);
          }
        }

        if (canApplyAttackHit && attackHit) {
          attackRayHitPoint.copy(attackHit.point);
          attackRayDirection.copy(direction);

          let targetDamageApplied = false;
          let targetEnergyGranted = false;
          let targetManaGranted = false;
          let targetRemoved = false;
          const removeTargetProjectile = () => {
            if (targetRemoved) return;
            targetRemoved = true;
            projectileRemovedReason.set(projectile.id, "impact");
            remove();
          };

          typeDefinition.hooks.onTargetHit({
            now: travelNow,
            projectile,
            targetId: attackHit.target.id,
            point: attackRayHitPoint,
            direction: attackRayDirection,
            applyTargetDamage: () => {
              if (targetDamageApplied) return;
              targetDamageApplied = true;
              attackHit.target.onHit({
                now: travelNow,
                source: "projectile",
                damage: projectile.damage,
                point: attackRayHitPoint.clone(),
                direction: attackRayDirection.clone(),
              });
            },
            grantDefaultEnergyOnHit: () => {
              if (targetEnergyGranted) return;
              targetEnergyGranted = true;
              applyEnergy(projectile.energyGainOnHit ?? getDefaultHitEnergyGain());
            },
            grantDefaultManaOnHit: () => {
              if (targetManaGranted) return;
              targetManaGranted = true;
              applyMana(projectile.manaGainOnHit ?? getDefaultHitManaGain());
            },
            triggerExplosion: (primaryTargetId) => {
              const resolvedPrimaryTargetId =
                primaryTargetId === undefined ? attackHit.target.id : primaryTargetId;
              triggerProjectileExplosion(
                travelNow,
                projectile,
                attackRayHitPoint,
                attackRayDirection,
                resolvedPrimaryTargetId
              );
            },
            removeProjectile: removeTargetProjectile,
          });

          if (targetRemoved) {
            return;
          }
        }

        const blockerIsNearest =
          Boolean(blockerHit) &&
          (!worldHit || blockerHit!.distance <= worldHit.distance);

        if (blockerIsNearest && blockerHit) {
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
            blockerHit,
          });
          if (blockResolution === "handled") {
            return;
          }
        }

        const collisionHit = blockerIsNearest ? blockerHit : worldHit;
        if (!collisionHit) {
          return;
        }

        attackRayHitPoint.copy(collisionHit.point);
        attackRayDirection.copy(direction);
        let worldRemoved = false;
        const removeWorldProjectile = () => {
          if (worldRemoved) return;
          worldRemoved = true;
          projectileRemovedReason.set(projectile.id, "impact");
          remove();
        };

        typeDefinition.hooks.onWorldHit({
          now: travelNow,
          projectile,
          point: attackRayHitPoint,
          direction: attackRayDirection,
          triggerExplosion: (primaryTargetId) => {
            triggerProjectileExplosion(
              travelNow,
              projectile,
              attackRayHitPoint,
              attackRayDirection,
              primaryTargetId ?? null
            );
          },
          removeProjectile: removeWorldProjectile,
        });
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
        const reason =
          projectileRemovedReason.get(projectile.id) ??
          (projectile.life >= projectile.maxLife ? "expired" : "cleared");
        const typeDefinition = getProjectileTypeDefinition(projectile.projectileType);
        const triggerExplosion = (primaryTargetId?: string | null) => {
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
            primaryTargetId
          );
        };

        const lifecycle = projectileLifecycleHooks.get(projectile.id);
        if (lifecycle?.onRemove) {
          lifecycle.onRemove({
            reason,
            now,
            position: projectile.mesh.position,
            velocity: projectile.velocity,
            triggerExplosion: () => {
              triggerExplosion(null);
            },
          });
        }

        if (reason === "expired") {
          attackRayDirection.copy(projectile.velocity);
          if (attackRayDirection.lengthSq() < 0.000001) {
            attackRayDirection.set(0, 0, 1);
          } else {
            attackRayDirection.normalize();
          }
          typeDefinition.hooks.onExpire({
            now,
            projectile,
            position: projectile.mesh.position,
            direction: attackRayDirection,
            triggerExplosion,
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
        projectileHitTargets.delete(projectile.id);
        releaseSharedHitGroup(projectile.sharedHitGroupId);
      },
    });

    projectileFxSystem.update(delta);
  };

  const fire = (
    fallbackOrigin: THREE.Vector3,
    fallbackDirection: THREE.Vector3,
    args?: FireProjectileArgs
  ) => {
    const origin = args?.origin ?? fallbackOrigin;
    const direction = args?.direction ?? fallbackDirection;
    const projectileType = args?.projectileType;
    const definition = getProjectileTypeDefinition(projectileType);
    spawnProjectile(
      origin,
      direction,
      args?.speed ?? definition.defaults.speed,
      args?.lifetime ?? definition.defaults.lifetime,
      args,
      definition.id
    );
  };

  const resolveCameraAim = ({
    camera,
    offset = defaultAttackAimOffset,
    forwardOffset = defaultAttackAimForwardOffset,
    distance = defaultAttackAimDistance,
    outOrigin = cameraAimOrigin,
    outDirection = cameraAimDirection,
    outPoint = cameraAimPoint,
  }: ResolveCameraAimArgs) => {
    camera.getWorldPosition(outOrigin);
    camera.getWorldDirection(outDirection);
    outOrigin.add(offset);
    outOrigin.addScaledVector(outDirection, forwardOffset);
    outPoint.copy(outOrigin).addScaledVector(outDirection, distance);
    return {
      origin: outOrigin,
      direction: outDirection,
      point: outPoint,
    };
  };

  const fireWithCameraAim = ({
    camera,
    args,
    offset,
    forwardOffset,
  }: FireWithCameraAimArgs) => {
    if (args?.origin && args?.direction) {
      fire(args.origin, args.direction, args);
      return;
    }
    const aim = resolveCameraAim({
      camera,
      offset,
      forwardOffset,
    });
    fire(aim.origin, aim.direction, args);
  };

  const dispose = () => {
    clear();
    projectileFxSystem.dispose();
    projectileMeshFactory.dispose();
  };

  return {
    projectiles,
    clear,
    update,
    fire,
    resolveCameraAim,
    fireWithCameraAim,
    dispose,
  };
};



