import * as THREE from "three";
import type { PlayerAttackSource, PlayerAttackTarget } from "../engine/types";

export type AttackTargetHit = {
  target: PlayerAttackTarget;
  point: THREE.Vector3;
  distance: number;
};

type HitTargetResolvedArgs = {
  now: number;
  targetId: string;
  targetObject: THREE.Object3D;
  isTargetActive: () => boolean;
  dealDamageToTarget: (damage: number, now?: number) => void;
  point: THREE.Vector3;
  direction: THREE.Vector3;
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
  onHitTargetResolved?: (args: HitTargetResolvedArgs) => void;
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
  onHitTargetResolved?: (args: HitTargetResolvedArgs) => void;
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

const ATTACK_SPATIAL_CELL_SIZE = 6;
const ATTACK_SPATIAL_REBUILD_INTERVAL_MS = 50;

export class AttackTargetResolver {
  readonly attackTargets: PlayerAttackTarget[];
  private readonly raycaster = new THREE.Raycaster();
  private readonly activeRoots: THREE.Object3D[] = [];
  private readonly attackTargetBounds = new THREE.Box3();
  private readonly attackTargetRay = new THREE.Ray();
  private readonly attackTargetClosestPoint = new THREE.Vector3();
  private readonly attackTargetPoint = new THREE.Vector3();
  private readonly attackTargetSegmentEnd = new THREE.Vector3();
  private readonly attackTargetCapsuleStart = new THREE.Vector3();
  private readonly attackTargetCapsuleEnd = new THREE.Vector3();
  private readonly attackTargetSegmentClosestPoint = new THREE.Vector3();
  private readonly attackTargetCapsuleClosestPoint = new THREE.Vector3();
  private readonly attackTargetWorldScale = new THREE.Vector3();
  private readonly attackTargetSegmentDelta = new THREE.Vector3();
  private readonly attackTargetCapsuleDelta = new THREE.Vector3();
  private readonly attackTargetSegmentOffset = new THREE.Vector3();
  private readonly spatialBuckets = new Map<string, PlayerAttackTarget[]>();
  private readonly spatialActiveTargets: PlayerAttackTarget[] = [];
  private readonly spatialCandidateIds = new Set<string>();
  private readonly spatialCandidates: PlayerAttackTarget[] = [];
  private readonly spatialPoint = new THREE.Vector3();
  private spatialLastRebuildAt = -Infinity;

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

  private resolveSpatialCellCoord(value: number) {
    return Math.floor(value / ATTACK_SPATIAL_CELL_SIZE);
  }

  private resolveSpatialCellKey(cellX: number, cellZ: number) {
    return `${cellX}:${cellZ}`;
  }

  private rebuildSpatialIndex() {
    const now = performance.now();
    if (now - this.spatialLastRebuildAt < ATTACK_SPATIAL_REBUILD_INTERVAL_MS) {
      return;
    }
    this.spatialLastRebuildAt = now;
    this.spatialBuckets.clear();
    this.spatialActiveTargets.length = 0;

    for (let i = 0; i < this.attackTargets.length; i += 1) {
      const target = this.attackTargets[i];
      if (target.isActive && !target.isActive()) continue;
      target.object.getWorldPosition(this.spatialPoint);
      const cellX = this.resolveSpatialCellCoord(this.spatialPoint.x);
      const cellZ = this.resolveSpatialCellCoord(this.spatialPoint.z);
      const key = this.resolveSpatialCellKey(cellX, cellZ);
      const bucket = this.spatialBuckets.get(key);
      if (bucket) {
        bucket.push(target);
      } else {
        this.spatialBuckets.set(key, [target]);
      }
      this.spatialActiveTargets.push(target);
    }
  }

  private collectSpatialCandidatesInRadius(
    center: THREE.Vector3,
    radius: number,
    excludeTargetIds?: ReadonlySet<string>
  ) {
    this.rebuildSpatialIndex();
    this.spatialCandidates.length = 0;
    this.spatialCandidateIds.clear();

    const minCellX = this.resolveSpatialCellCoord(center.x - radius);
    const maxCellX = this.resolveSpatialCellCoord(center.x + radius);
    const minCellZ = this.resolveSpatialCellCoord(center.z - radius);
    const maxCellZ = this.resolveSpatialCellCoord(center.z + radius);

    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const key = this.resolveSpatialCellKey(cellX, cellZ);
        const bucket = this.spatialBuckets.get(key);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i += 1) {
          const target = bucket[i];
          if (excludeTargetIds?.has(target.id)) continue;
          if (this.spatialCandidateIds.has(target.id)) continue;
          this.spatialCandidateIds.add(target.id);
          this.spatialCandidates.push(target);
        }
      }
    }

    return this.spatialCandidates;
  }

  private isMeshObject(
    object: THREE.Object3D
  ): object is THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> {
    return Boolean((object as THREE.Mesh).isMesh);
  }

  private getCapsuleParameters(targetObject: THREE.Object3D) {
    if (!this.isMeshObject(targetObject)) return null;
    const parameters = (
      targetObject.geometry as THREE.BufferGeometry & {
        parameters?: { radius?: number; length?: number };
      }
    ).parameters;
    if (!parameters) return null;
    if (!Number.isFinite(parameters.radius) || !Number.isFinite(parameters.length)) {
      return null;
    }
    if (targetObject.geometry.type !== "CapsuleGeometry") {
      return null;
    }
    return {
      radius: Math.max(0, parameters.radius ?? 0),
      length: Math.max(0, parameters.length ?? 0),
    };
  }

  private getClosestDistanceToTarget(
    target: PlayerAttackTarget,
    point: THREE.Vector3
  ): AttackTargetHit | null {
    target.object.updateMatrixWorld(true);
    const capsule = this.getCapsuleParameters(target.object);
    if (capsule) {
      const halfSegment = capsule.length * 0.5;
      this.attackTargetCapsuleStart.set(0, -halfSegment, 0);
      this.attackTargetCapsuleEnd.set(0, halfSegment, 0);
      target.object.localToWorld(this.attackTargetCapsuleStart);
      target.object.localToWorld(this.attackTargetCapsuleEnd);
      target.object.getWorldScale(this.attackTargetWorldScale);
      const worldRadius =
        capsule.radius *
        Math.max(
          Math.abs(this.attackTargetWorldScale.x),
          Math.abs(this.attackTargetWorldScale.y),
          Math.abs(this.attackTargetWorldScale.z)
        );
      const capsuleAxis = new THREE.Line3(
        this.attackTargetCapsuleStart,
        this.attackTargetCapsuleEnd
      );
      capsuleAxis.closestPointToPoint(point, true, this.attackTargetCapsuleClosestPoint);
      const centerDistance = this.attackTargetCapsuleClosestPoint.distanceTo(point);
      return {
        target,
        point: this.attackTargetCapsuleClosestPoint.clone(),
        distance: Math.max(0, centerDistance - worldRadius),
      };
    }

    this.attackTargetBounds.setFromObject(target.object);
    if (this.attackTargetBounds.isEmpty()) {
      return null;
    }
    this.attackTargetBounds.clampPoint(point, this.attackTargetClosestPoint);
    return {
      target,
      point: this.attackTargetClosestPoint.clone(),
      distance: this.attackTargetClosestPoint.distanceTo(point),
    };
  }

  private closestSegmentDistanceSq(
    segmentStartA: THREE.Vector3,
    segmentEndA: THREE.Vector3,
    segmentStartB: THREE.Vector3,
    segmentEndB: THREE.Vector3
  ) {
    const epsilon = 0.000001;
    this.attackTargetSegmentDelta.copy(segmentEndA).sub(segmentStartA);
    this.attackTargetCapsuleDelta.copy(segmentEndB).sub(segmentStartB);
    this.attackTargetSegmentOffset.copy(segmentStartA).sub(segmentStartB);

    const a = this.attackTargetSegmentDelta.lengthSq();
    const e = this.attackTargetCapsuleDelta.lengthSq();
    const f = this.attackTargetCapsuleDelta.dot(this.attackTargetSegmentOffset);

    let s = 0;
    let t = 0;

    if (a <= epsilon && e <= epsilon) {
      this.attackTargetSegmentClosestPoint.copy(segmentStartA);
      this.attackTargetCapsuleClosestPoint.copy(segmentStartB);
      return this.attackTargetSegmentClosestPoint.distanceToSquared(
        this.attackTargetCapsuleClosestPoint
      );
    }

    if (a <= epsilon) {
      s = 0;
      t = THREE.MathUtils.clamp(f / e, 0, 1);
    } else {
      const c = this.attackTargetSegmentDelta.dot(this.attackTargetSegmentOffset);
      if (e <= epsilon) {
        t = 0;
        s = THREE.MathUtils.clamp(-c / a, 0, 1);
      } else {
        const b = this.attackTargetSegmentDelta.dot(this.attackTargetCapsuleDelta);
        const denominator = a * e - b * b;
        if (Math.abs(denominator) > epsilon) {
          s = THREE.MathUtils.clamp((b * f - c * e) / denominator, 0, 1);
        } else {
          s = 0;
        }

        t = (b * s + f) / e;
        if (t < 0) {
          t = 0;
          s = THREE.MathUtils.clamp(-c / a, 0, 1);
        } else if (t > 1) {
          t = 1;
          s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
        }
      }
    }

    this.attackTargetSegmentClosestPoint
      .copy(this.attackTargetSegmentDelta)
      .multiplyScalar(s)
      .add(segmentStartA);
    this.attackTargetCapsuleClosestPoint
      .copy(this.attackTargetCapsuleDelta)
      .multiplyScalar(t)
      .add(segmentStartB);
    return this.attackTargetSegmentClosestPoint.distanceToSquared(
      this.attackTargetCapsuleClosestPoint
    );
  }

  private getSweepHitAgainstTarget(
    target: PlayerAttackTarget,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    far: number,
    hitRadius: number
  ): AttackTargetHit | null {
    target.object.updateMatrixWorld(true);
    const capsule = this.getCapsuleParameters(target.object);

    if (capsule) {
      const halfSegment = capsule.length * 0.5;
      this.attackTargetCapsuleStart.set(0, -halfSegment, 0);
      this.attackTargetCapsuleEnd.set(0, halfSegment, 0);
      target.object.localToWorld(this.attackTargetCapsuleStart);
      target.object.localToWorld(this.attackTargetCapsuleEnd);
      target.object.getWorldScale(this.attackTargetWorldScale);
      const worldRadius =
        capsule.radius *
        Math.max(
          Math.abs(this.attackTargetWorldScale.x),
          Math.abs(this.attackTargetWorldScale.y),
          Math.abs(this.attackTargetWorldScale.z)
        );
      this.attackTargetSegmentEnd.copy(origin).addScaledVector(direction, far);
      const distanceSq = this.closestSegmentDistanceSq(
        origin,
        this.attackTargetSegmentEnd,
        this.attackTargetCapsuleStart,
        this.attackTargetCapsuleEnd
      );
      const combinedRadius = worldRadius + hitRadius;
      if (distanceSq > combinedRadius * combinedRadius) {
        return null;
      }
      return {
        target,
        point: this.attackTargetSegmentClosestPoint.clone(),
        distance: origin.distanceTo(this.attackTargetSegmentClosestPoint),
      };
    }

    this.attackTargetBounds.setFromObject(target.object);
    if (this.attackTargetBounds.isEmpty()) {
      return null;
    }
    if (hitRadius > 0) {
      this.attackTargetBounds.expandByScalar(hitRadius);
    }
    this.attackTargetRay.set(origin, direction);
    if (this.attackTargetBounds.containsPoint(origin)) {
      return {
        target,
        point: origin.clone(),
        distance: 0,
      };
    }
    const hitPoint = this.attackTargetRay.intersectBox(
      this.attackTargetBounds,
      this.attackTargetPoint
    );
    if (!hitPoint) {
      return null;
    }
    const distance = origin.distanceTo(hitPoint);
    if (distance > far) {
      return null;
    }
    return {
      target,
      point: hitPoint.clone(),
      distance,
    };
  }

  intersectByRay(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    far: number
  ): AttackTargetHit | null {
    if (!this.attackTargets.length) return null;
    this.rebuildSpatialIndex();
    this.activeRoots.length = 0;
    for (let i = 0; i < this.spatialActiveTargets.length; i += 1) {
      this.activeRoots.push(this.spatialActiveTargets[i].object);
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
    const broadRadius = far * 0.5 + Math.max(0, hitRadius) + ATTACK_SPATIAL_CELL_SIZE;
    this.attackTargetPoint
      .copy(origin)
      .addScaledVector(direction, far * 0.5);
    const candidates = this.collectSpatialCandidatesInRadius(
      this.attackTargetPoint,
      broadRadius
    );

    for (let i = 0; i < candidates.length; i += 1) {
      const target = candidates[i];
      const hit = this.getSweepHitAgainstTarget(
        target,
        origin,
        direction,
        far,
        hitRadius
      );
      if (!hit) continue;
      if (!nearest || hit.distance < nearest.distance) {
        nearest = hit;
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
    let nearest: AttackTargetHit | null = null;
    const candidates = this.collectSpatialCandidatesInRadius(center, radius);

    for (let i = 0; i < candidates.length; i += 1) {
      const target = candidates[i];
      const hit = this.getClosestDistanceToTarget(target, center);
      if (!hit || hit.distance > radius) continue;
      if (!nearest || hit.distance < nearest.distance) {
        nearest = hit;
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
    onHitTargetResolved,
  }: PerformMeleeAttackArgs) {
    if (!this.attackTargets.length) return 0;
    if (damage <= 0 || maxDistance <= 0) return 0;

    const resolvedDamage = Math.max(1, Math.round(damage));
    const resolvedMaxDistance = Math.max(0.1, maxDistance);
    const resolvedHitRadius = Math.max(0, hitRadius);
    const resolvedMaxHits = Math.max(1, Math.floor(maxHits));
    const hits: AttackTargetHit[] = [];
    this.attackTargetPoint
      .copy(origin)
      .addScaledVector(direction, resolvedMaxDistance * 0.5);
    const candidates = this.collectSpatialCandidatesInRadius(
      this.attackTargetPoint,
      resolvedMaxDistance * 0.5 + resolvedHitRadius + ATTACK_SPATIAL_CELL_SIZE,
      excludeTargetIds
    );

    for (let i = 0; i < candidates.length; i += 1) {
      const target = candidates[i];
      const hit = this.getSweepHitAgainstTarget(
        target,
        origin,
        direction,
        resolvedMaxDistance,
        resolvedHitRadius
      );
      if (!hit) continue;
      hits.push(hit);
    }

    if (!hits.length) return 0;
    hits.sort((a, b) => a.distance - b.distance);

    let hitCount = 0;
    for (let i = 0; i < hits.length && hitCount < resolvedMaxHits; i += 1) {
      const hit = hits[i];
      const dealDamageToTarget = (damage: number, damageNow = now) => {
        const resolvedExtraDamage = Math.max(1, Math.round(damage));
        hit.target.onHit({
          now: damageNow,
          source,
          damage: resolvedExtraDamage,
          point: hit.point.clone(),
          direction: direction.clone(),
        });
      };
      hit.target.onHit({
        now,
        source,
        damage: resolvedDamage,
        point: hit.point.clone(),
        direction: direction.clone(),
      });
      onHitTarget?.(hit.target.id);
      onHitTargetResolved?.({
        now,
        targetId: hit.target.id,
        targetObject: hit.target.object,
        isTargetActive: () => (hit.target.isActive ? hit.target.isActive() : true),
        dealDamageToTarget,
        point: hit.point.clone(),
        direction: direction.clone(),
      });
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
    onHitTargetResolved,
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
    const candidates = this.collectSpatialCandidatesInRadius(
      center,
      resolvedRadius,
      excludeTargetIds
    );

    for (let i = 0; i < candidates.length; i += 1) {
      const target = candidates[i];
      const hit = this.getClosestDistanceToTarget(target, center);
      if (!hit || hit.distance > resolvedRadius) continue;
      hits.push(hit);
    }

    if (!hits.length) return 0;
    hits.sort((a, b) => a.distance - b.distance);

    let hitCount = 0;
    for (let i = 0; i < hits.length && hitCount < resolvedMaxHits; i += 1) {
      const hit = hits[i];
      const dealDamageToTarget = (damage: number, damageNow = now) => {
        const resolvedExtraDamage = Math.max(1, Math.round(damage));
        hit.target.onHit({
          now: damageNow,
          source,
          damage: resolvedExtraDamage,
          point: hit.point.clone(),
          direction: resolvedDirection.clone(),
        });
      };
      hit.target.onHit({
        now,
        source,
        damage: resolvedDamage,
        point: hit.point.clone(),
        direction: resolvedDirection.clone(),
      });
      onHitTarget?.(hit.target.id);
      onHitTargetResolved?.({
        now,
        targetId: hit.target.id,
        targetObject: hit.target.object,
        isTargetActive: () => (hit.target.isActive ? hit.target.isActive() : true),
        dealDamageToTarget,
        point: hit.point.clone(),
        direction: resolvedDirection.clone(),
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
    const candidates = this.collectSpatialCandidatesInRadius(center, radius);

    for (let i = 0; i < candidates.length; i += 1) {
      const target = candidates[i];
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
