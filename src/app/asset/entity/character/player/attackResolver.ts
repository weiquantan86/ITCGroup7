import * as THREE from "three";
import type { PlayerAttackSource, PlayerAttackTarget } from "./types";

export type AttackTargetHit = {
  target: PlayerAttackTarget;
  point: THREE.Vector3;
  distance: number;
};

type PerformMeleeAttackArgs = {
  now: number;
  source: PlayerAttackSource;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  damage: number;
  maxDistance: number;
  hitRadius?: number;
  maxHits?: number;
};

type ApplyExplosionDamageArgs = {
  now: number;
  center: THREE.Vector3;
  radius: number;
  baseDamage: number;
  direction: THREE.Vector3;
  excludeTargetId?: string;
};

export class AttackTargetResolver {
  readonly attackTargets: PlayerAttackTarget[];
  private readonly raycaster = new THREE.Raycaster();
  private readonly activeRoots: THREE.Object3D[] = [];
  private readonly attackTargetBounds = new THREE.Box3();
  private readonly attackTargetSphere = new THREE.Sphere();
  private readonly attackTargetCenterOffset = new THREE.Vector3();
  private readonly attackTargetClosestPoint = new THREE.Vector3();
  private readonly attackTargetPoint = new THREE.Vector3();

  constructor(attackTargets: PlayerAttackTarget[]) {
    this.attackTargets = attackTargets;
  }

  private isObjectWithinRoot(child: THREE.Object3D, root: THREE.Object3D) {
    let current: THREE.Object3D | null = child;
    while (current) {
      if (current === root) return true;
      current = current.parent;
    }
    return false;
  }

  private resolveAttackTargetFromObject(object: THREE.Object3D) {
    for (let i = 0; i < this.attackTargets.length; i += 1) {
      const target = this.attackTargets[i];
      if (target.isActive && !target.isActive()) continue;
      if (this.isObjectWithinRoot(object, target.object)) {
        return target;
      }
    }
    return null;
  }

  intersectByRay(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    far: number
  ): AttackTargetHit | null {
    if (!this.attackTargets.length) return null;
    this.activeRoots.length = 0;
    for (let i = 0; i < this.attackTargets.length; i += 1) {
      const target = this.attackTargets[i];
      if (target.isActive && !target.isActive()) continue;
      this.activeRoots.push(target.object);
    }
    if (!this.activeRoots.length) return null;

    this.raycaster.set(origin, direction);
    this.raycaster.far = far;
    const hits = this.raycaster.intersectObjects(this.activeRoots, true);
    for (let i = 0; i < hits.length; i += 1) {
      const hit = hits[i];
      const target = this.resolveAttackTargetFromObject(hit.object);
      if (!target) continue;
      return {
        target,
        point: hit.point.clone(),
        distance: hit.distance,
      };
    }
    return null;
  }

  intersectByRadius(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    far: number,
    hitRadius: number
  ): AttackTargetHit | null {
    if (!this.attackTargets.length) return null;
    let nearest: AttackTargetHit | null = null;

    for (let i = 0; i < this.attackTargets.length; i += 1) {
      const target = this.attackTargets[i];
      if (target.isActive && !target.isActive()) continue;

      target.object.updateMatrixWorld(true);
      this.attackTargetBounds.setFromObject(target.object);
      if (this.attackTargetBounds.isEmpty()) continue;
      this.attackTargetBounds.getBoundingSphere(this.attackTargetSphere);

      this.attackTargetCenterOffset
        .copy(this.attackTargetSphere.center)
        .sub(origin);
      const projectedDistance = THREE.MathUtils.clamp(
        this.attackTargetCenterOffset.dot(direction),
        0,
        far
      );
      this.attackTargetClosestPoint
        .copy(origin)
        .addScaledVector(direction, projectedDistance);

      const combinedRadius = this.attackTargetSphere.radius + hitRadius;
      if (
        this.attackTargetClosestPoint.distanceToSquared(
          this.attackTargetSphere.center
        ) >
        combinedRadius * combinedRadius
      ) {
        continue;
      }

      if (!nearest || projectedDistance < nearest.distance) {
        nearest = {
          target,
          point: this.attackTargetClosestPoint.clone(),
          distance: projectedDistance,
        };
      }
    }

    return nearest;
  }

  intersect(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    far: number,
    hitRadius: number
  ): AttackTargetHit | null {
    const rayHit = this.intersectByRay(origin, direction, far);
    if (hitRadius <= 0) {
      return rayHit;
    }
    const radiusHit = this.intersectByRadius(origin, direction, far, hitRadius);
    if (rayHit && radiusHit) {
      return rayHit.distance <= radiusHit.distance ? rayHit : radiusHit;
    }
    return rayHit ?? radiusHit;
  }

  performMeleeAttack({
    now,
    source,
    origin,
    direction,
    damage,
    maxDistance,
    hitRadius = 0.45,
    maxHits = 1,
  }: PerformMeleeAttackArgs) {
    if (!this.attackTargets.length) return 0;
    if (damage <= 0 || maxDistance <= 0) return 0;

    const resolvedDamage = Math.max(1, Math.round(damage));
    const resolvedMaxDistance = Math.max(0.1, maxDistance);
    const resolvedHitRadius = Math.max(0, hitRadius);
    const resolvedMaxHits = Math.max(1, Math.floor(maxHits));
    const hits: AttackTargetHit[] = [];

    for (let i = 0; i < this.attackTargets.length; i += 1) {
      const target = this.attackTargets[i];
      if (target.isActive && !target.isActive()) continue;

      target.object.updateMatrixWorld(true);
      this.attackTargetBounds.setFromObject(target.object);
      if (this.attackTargetBounds.isEmpty()) continue;
      this.attackTargetBounds.getBoundingSphere(this.attackTargetSphere);

      this.attackTargetCenterOffset
        .copy(this.attackTargetSphere.center)
        .sub(origin);
      const projectedDistance =
        this.attackTargetCenterOffset.dot(direction);
      if (projectedDistance < 0 || projectedDistance > resolvedMaxDistance) {
        continue;
      }

      this.attackTargetClosestPoint
        .copy(origin)
        .addScaledVector(direction, projectedDistance);
      const combinedRadius = this.attackTargetSphere.radius + resolvedHitRadius;
      if (
        this.attackTargetClosestPoint.distanceToSquared(
          this.attackTargetSphere.center
        ) >
        combinedRadius * combinedRadius
      ) {
        continue;
      }

      hits.push({
        target,
        point: this.attackTargetClosestPoint.clone(),
        distance: projectedDistance,
      });
    }

    if (!hits.length) return 0;
    hits.sort((a, b) => a.distance - b.distance);

    let hitCount = 0;
    for (let i = 0; i < hits.length && hitCount < resolvedMaxHits; i += 1) {
      const hit = hits[i];
      hit.target.onHit({
        now,
        source,
        damage: resolvedDamage,
        point: hit.point.clone(),
        direction: direction.clone(),
      });
      hitCount += 1;
    }
    return hitCount;
  }

  applyExplosionDamage({
    now,
    center,
    radius,
    baseDamage,
    direction,
    excludeTargetId,
  }: ApplyExplosionDamageArgs) {
    if (radius <= 0 || baseDamage <= 0 || !this.attackTargets.length) return;
    const radiusSq = radius * radius;

    for (let i = 0; i < this.attackTargets.length; i += 1) {
      const target = this.attackTargets[i];
      if (target.isActive && !target.isActive()) continue;
      if (excludeTargetId && target.id === excludeTargetId) continue;
      target.object.getWorldPosition(this.attackTargetPoint);
      const distSq = this.attackTargetPoint.distanceToSquared(center);
      if (distSq > radiusSq) continue;
      const dist = Math.sqrt(distSq);
      const ratio = 1 - dist / radius;
      const splashDamage = Math.max(
        1,
        Math.round(baseDamage * (0.45 + ratio * 0.55))
      );
      target.onHit({
        now,
        source: "projectile",
        damage: splashDamage,
        point: center.clone(),
        direction: direction.clone(),
      });
    }
  }
}
