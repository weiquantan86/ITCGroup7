import type * as THREE from "three";

export interface LinearProjectileState {
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  radius: number;
}

export type RemoveLinearProjectile = () => void;

export interface LinearProjectileHooks<
  TProjectile extends LinearProjectileState,
> {
  getObject: (projectile: TProjectile) => THREE.Object3D;
  applyForces?: (projectile: TProjectile, delta: number) => void;
  onTravel?: (
    projectile: TProjectile,
    now: number,
    delta: number,
    origin: THREE.Vector3,
    nextPosition: THREE.Vector3,
    direction: THREE.Vector3,
    distance: number,
    raycaster: THREE.Raycaster,
    remove: RemoveLinearProjectile
  ) => void;
  shouldExpire?: (
    projectile: TProjectile,
    now: number,
    delta: number
  ) => boolean;
  onAfterMove?: (
    projectile: TProjectile,
    now: number,
    delta: number,
    remove: RemoveLinearProjectile
  ) => void;
  onRemove?: (projectile: TProjectile) => void;
}

export interface Projectile extends LinearProjectileState {
  id: number;
  projectileType: string;
  gravity: number;
  grantEnergyOnTargetHit: boolean;
  grantManaOnTargetHit: boolean;
  explodeOnTargetHit: boolean;
  explodeOnWorldHit: boolean;
  explodeOnExpire: boolean;
  removeOnTargetHit: boolean;
  removeOnWorldHit: boolean;
  singleHitPerTarget: boolean;
  sharedHitGroupId: string | null;
  mesh: THREE.Mesh;
  targetHitRadius: number;
  damage: number;
  energyGainOnHit: number | null;
  manaGainOnHit: number | null;
  splitOnImpact: boolean;
  explosionRadius: number;
  explosionDamage: number;
  explosionMinDamage: number;
  explosionColor: number | null;
  explosionEmissive: number | null;
  explosionEmissiveIntensity: number | null;
  material: THREE.Material;
  ownsMaterial: boolean;
}

export interface ProjectileExplosionFragment {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
  material: THREE.Material;
  ownsMaterial: boolean;
}
