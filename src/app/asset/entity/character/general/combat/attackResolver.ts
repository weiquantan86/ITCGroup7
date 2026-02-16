import * as THREE from "three";
import type { PlayerAttackSource, PlayerAttackTarget } from "../engine/types";

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
  excludeTargetIds?: ReadonlySet<string>;
  onHitTarget?: (targetId: string) => void;
};

type PerformMeleeContactAttackArgs = {
  now: number;
  source: PlayerAttackSource;
  center: THREE.Vector3;
  direction: THREE.Vector3;
  damage: number;
  radius: number;
  maxHits?: number;
  excludeTargetIds?: ReadonlySet<string>;
  onHitTarget?: (targetId: string) => void;
};

type ApplyExplosionDamageArgs = {
  now: number;
  center: THREE.Vector3;
  radius: number;
  baseDamage: number;
  minDamage?: number;
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

  findNearestInRadius(
    center: THREE.Vector3,
    radius: number
  ): AttackTargetHit | null {
    if (!this.attackTargets.length) return null;
    if (radius <= 0) return null;
    const radiusSq = radius * radius;
    let nearest: AttackTargetHit | null = null;

    for (let i = 0; i < this.attackTargets.length; i += 1) {
      const target = this.attackTargets[i];
      if (target.isActive && !target.isActive()) continue;

      target.object.updateMatrixWorld(true);
      this.attackTargetBounds.setFromObject(target.object);
      if (this.attackTargetBounds.isEmpty()) continue;
      this.attackTargetBounds.getBoundingSphere(this.attackTargetSphere);

      const distSq = center.distanceToSquared(this.attackTargetSphere.center);
      const combined = radius + this.attackTargetSphere.radius;
      if (distSq > combined * combined) continue;
      const dist = Math.sqrt(distSq);
      if (!nearest || dist < nearest.distance) {
        nearest = {
          target,
          point: this.attackTargetSphere.center.clone(),
          distance: dist,
        };
      }
    }

    return nearest;
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
    excludeTargetIds,
    onHitTarget,
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
      if (excludeTargetIds?.has(target.id)) continue;

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
      onHitTarget?.(hit.target.id);
      hitCount += 1;
    }
    return hitCount;
  }

  performMeleeContactAttack({
    now,
    source,
    center,
    direction,
    damage,
    radius,
    maxHits = 1,
    excludeTargetIds,
    onHitTarget,
  }: PerformMeleeContactAttackArgs) {
    if (!this.attackTargets.length) return 0;
    if (damage <= 0 || radius <= 0) return 0;

    const resolvedDamage = Math.max(1, Math.round(damage));
    const resolvedRadius = Math.max(0.05, radius);
    const resolvedMaxHits = Math.max(1, Math.floor(maxHits));
    const resolvedDirection =
      direction.lengthSq() > 0.000001
        ? direction.clone().normalize()
        : new THREE.Vector3(0, 0, 1);
    const hits: AttackTargetHit[] = [];

    for (let i = 0; i < this.attackTargets.length; i += 1) {
      const target = this.attackTargets[i];
      if (target.isActive && !target.isActive()) continue;
      if (excludeTargetIds?.has(target.id)) continue;

      target.object.updateMatrixWorld(true);
      this.attackTargetBounds.setFromObject(target.object);
      if (this.attackTargetBounds.isEmpty()) continue;
      this.attackTargetBounds.getBoundingSphere(this.attackTargetSphere);

      const combinedRadius = resolvedRadius + this.attackTargetSphere.radius;
      const distSq = center.distanceToSquared(this.attackTargetSphere.center);
      if (distSq > combinedRadius * combinedRadius) continue;

      hits.push({
        target,
        point: this.attackTargetSphere.center.clone(),
        distance: Math.sqrt(distSq),
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
        direction: resolvedDirection.clone(),
      });
      onHitTarget?.(hit.target.id);
      hitCount += 1;
    }
    return hitCount;
  }

  applyExplosionDamage({
    now,
    center,
    radius,
    baseDamage,
    minDamage = 1,
    direction,
    excludeTargetId,
  }: ApplyExplosionDamageArgs) {
    if (radius <= 0 || baseDamage <= 0 || !this.attackTargets.length) return;
    const radiusSq = radius * radius;
    const resolvedMinDamage = THREE.MathUtils.clamp(
      Math.round(minDamage),
      1,
      Math.max(1, Math.round(baseDamage))
    );

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
        resolvedMinDamage,
        Math.round(
          THREE.MathUtils.lerp(resolvedMinDamage, baseDamage, ratio)
        )
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

