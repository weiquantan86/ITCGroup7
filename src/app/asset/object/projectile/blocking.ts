import * as THREE from "three";
import type { ProjectileLike } from "./types";

export type ProjectileBlockHitContext = {
  now: number;
  projectile: ProjectileLike;
  blockerHit: THREE.Intersection;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  travelDistance: number;
  nextPosition: THREE.Vector3;
};

export type ProjectileBlockHitHandler = (
  args: ProjectileBlockHitContext
) => boolean;

export type ProjectileBlockResolution = "none" | "handled" | "blocked";

type ProjectileBlockerUserData = {
  worldOnlyBlocker?: boolean;
};

export const isWorldOnlyProjectileBlocker = (
  object: THREE.Object3D | null | undefined
): boolean => {
  let current = object;
  while (current) {
    const userData = current.userData as ProjectileBlockerUserData;
    if (userData.worldOnlyBlocker) return true;
    current = current.parent;
  }
  return false;
};

export const filterWorldOnlyProjectileBlockers = (
  projectileBlockers: THREE.Object3D[],
  out: THREE.Object3D[] = []
) => {
  out.length = 0;
  for (let i = 0; i < projectileBlockers.length; i += 1) {
    const blocker = projectileBlockers[i];
    if (isWorldOnlyProjectileBlocker(blocker)) continue;
    out.push(blocker);
  }
  return out;
};

export const findNearestProjectileBlockHit = ({
  origin,
  direction,
  travelDistance,
  projectileRadius,
  projectileBlockers,
  raycaster,
}: {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  travelDistance: number;
  projectileRadius: number;
  projectileBlockers: THREE.Object3D[];
  raycaster: THREE.Raycaster;
}) => {
  if (!projectileBlockers.length) return null;
  raycaster.set(origin, direction);
  raycaster.far = travelDistance + projectileRadius;
  const blockerHits = raycaster.intersectObjects(projectileBlockers, true);
  if (!blockerHits.length) return null;
  for (let i = 0; i < blockerHits.length; i += 1) {
    const blockerHit = blockerHits[i];
    if (isWorldOnlyProjectileBlocker(blockerHit.object)) continue;
    return blockerHit;
  }
  return null;
};

export const resolveProjectileBlockHit = ({
  now,
  projectile,
  origin,
  direction,
  travelDistance,
  nextPosition,
  projectileBlockers,
  raycaster,
  handleProjectileBlockHit,
  blockerHit,
}: {
  now: number;
  projectile: ProjectileLike;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  travelDistance: number;
  nextPosition: THREE.Vector3;
  projectileBlockers: THREE.Object3D[];
  raycaster: THREE.Raycaster;
  handleProjectileBlockHit?: ProjectileBlockHitHandler;
  blockerHit?: THREE.Intersection | null;
}): ProjectileBlockResolution => {
  const resolvedBlockerHit =
    blockerHit ??
    findNearestProjectileBlockHit({
      origin,
      direction,
      travelDistance,
      projectileRadius: projectile.radius,
      projectileBlockers,
      raycaster,
    });
  if (!resolvedBlockerHit) return "none";
  const handledByRuntime =
    handleProjectileBlockHit?.({
      now,
      projectile,
      blockerHit: resolvedBlockerHit,
      origin,
      direction,
      travelDistance,
      nextPosition,
    }) ?? false;
  return handledByRuntime ? "handled" : "blocked";
};
