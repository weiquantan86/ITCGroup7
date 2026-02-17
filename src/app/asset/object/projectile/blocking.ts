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
}): ProjectileBlockResolution => {
  if (!projectileBlockers.length) return "none";
  raycaster.set(origin, direction);
  raycaster.far = travelDistance + projectile.radius;
  const blockerHits = raycaster.intersectObjects(projectileBlockers, true);
  if (!blockerHits.length) return "none";
  const handledByRuntime =
    handleProjectileBlockHit?.({
      now,
      projectile,
      blockerHit: blockerHits[0],
      origin,
      direction,
      travelDistance,
      nextPosition,
    }) ?? false;
  return handledByRuntime ? "handled" : "blocked";
};

