import * as THREE from "three";

export type ProjectileReflectorResult =
  | {
      speedMultiplier?: number;
    }
  | boolean
  | number
  | null
  | undefined;

export type ProjectileReflector = (args: {
  now: number;
  hitPoint: THREE.Vector3;
  incomingDirection: THREE.Vector3;
  incomingSpeed: number;
}) => ProjectileReflectorResult;

const reflectionHitPoint = new THREE.Vector3();
const reflectionIncomingDirection = new THREE.Vector3();
const reflectedDirection = new THREE.Vector3();

export const resolveProjectileReflector = (
  object: THREE.Object3D | null
): ProjectileReflector | null => {
  let current: THREE.Object3D | null = object;
  while (current) {
    const reflector = (
      current.userData as { projectileReflector?: unknown }
    ).projectileReflector;
    if (typeof reflector === "function") {
      return reflector as ProjectileReflector;
    }
    current = current.parent;
  }
  return null;
};

export const resolveReflectionSpeedMultiplier = (
  result: ProjectileReflectorResult
) => {
  if (typeof result === "number") return result;
  if (typeof result === "object" && result && "speedMultiplier" in result) {
    const speedMultiplier = result.speedMultiplier;
    if (typeof speedMultiplier === "number") return speedMultiplier;
  }
  return 1;
};

export const tryReflectLinearProjectile = ({
  blockerHit,
  now,
  origin,
  direction,
  travelDistance,
  nextPosition,
  velocity,
  radius,
  outDirection,
}: {
  blockerHit: THREE.Intersection;
  now: number;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  travelDistance: number;
  nextPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  outDirection?: THREE.Vector3;
}) => {
  const reflector = resolveProjectileReflector(blockerHit.object);
  if (!reflector) return false;

  reflectionHitPoint.copy(blockerHit.point);
  reflectionIncomingDirection.copy(direction);
  const reflectionResponse = reflector({
    now,
    hitPoint: reflectionHitPoint,
    incomingDirection: reflectionIncomingDirection,
    incomingSpeed: velocity.length(),
  });
  if (reflectionResponse === false) return false;

  reflectedDirection.copy(direction);
  if (reflectedDirection.lengthSq() < 0.000001) {
    if (velocity.lengthSq() < 0.000001) return false;
    reflectedDirection.copy(velocity).normalize();
  }
  reflectedDirection.multiplyScalar(-1).normalize();

  const speedMultiplier = Math.max(
    0.05,
    resolveReflectionSpeedMultiplier(reflectionResponse)
  );
  const reflectedSpeed = Math.max(0.1, velocity.length() * speedMultiplier);
  velocity.copy(reflectedDirection).multiplyScalar(reflectedSpeed);

  const remainingDistance = Math.max(0, travelDistance - blockerHit.distance);
  nextPosition
    .copy(blockerHit.point)
    .addScaledVector(
      reflectedDirection,
      Math.max(radius * 1.25, remainingDistance + radius * 0.65)
    );
  if (nextPosition.distanceToSquared(origin) < 0.000001) {
    nextPosition.addScaledVector(reflectedDirection, radius * 0.95);
  }
  outDirection?.copy(reflectedDirection);
  return true;
};
