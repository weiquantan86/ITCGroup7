import type * as THREE from "three";
import type { Projectile } from "../types";

export interface ProjectileTypeDefaults {
  speed: number;
  lifetime: number;
  radius: number;
  targetHitRadius: number;
  gravity: number;
  damageBase: number;
  damagePerSpeed: number;
  energyGainOnHit: number | null;
  manaGainOnHit: number | null;
  splitOnImpact: boolean;
  explosionRadius: number;
  explosionDamage: number;
  explosionMinDamage: number;
  explosionColor: number | null;
  explosionEmissive: number | null;
  explosionEmissiveIntensity: number | null;
}

export interface ProjectileTypeRules {
  grantEnergyOnTargetHit: boolean;
  grantManaOnTargetHit: boolean;
  explodeOnTargetHit: boolean;
  explodeOnWorldHit: boolean;
  explodeOnExpire: boolean;
  removeOnTargetHit: boolean;
  removeOnWorldHit: boolean;
}

export interface ProjectileVisualOptions {
  mesh?: THREE.Mesh;
  color?: number;
  emissive?: number;
  emissiveIntensity?: number;
  scale?: number;
  radius?: number;
}

export interface ProjectileMeshBuildResult {
  mesh: THREE.Mesh;
  material: THREE.Material;
  ownsMaterial: boolean;
  radiusFromMesh?: number;
}

export interface ProjectileBuildDefaultSphereMeshArgs {
  visual?: ProjectileVisualOptions;
  fallbackColor?: number;
  fallbackEmissive?: number;
  fallbackEmissiveIntensity?: number;
}

export interface ProjectileTypeCreateMeshArgs {
  visual?: ProjectileVisualOptions;
  buildDefaultSphereMesh: (
    args?: ProjectileBuildDefaultSphereMeshArgs
  ) => ProjectileMeshBuildResult;
}

export interface ProjectileTypeSpawnExplosionFxArgs {
  now: number;
  projectile: Projectile;
  point: THREE.Vector3;
  direction: THREE.Vector3;
  spawnDefaultExplosionFx: () => void;
}

export interface ProjectileTypeTargetHitArgs {
  now: number;
  projectile: Projectile;
  targetId: string;
  point: THREE.Vector3;
  direction: THREE.Vector3;
  applyTargetDamage: () => void;
  grantDefaultEnergyOnHit: () => void;
  grantDefaultManaOnHit: () => void;
  triggerExplosion: (primaryTargetId?: string | null) => void;
  removeProjectile: () => void;
}

export interface ProjectileTypeWorldHitArgs {
  now: number;
  projectile: Projectile;
  point: THREE.Vector3;
  direction: THREE.Vector3;
  triggerExplosion: (primaryTargetId?: string | null) => void;
  removeProjectile: () => void;
}

export interface ProjectileTypeExpireArgs {
  now: number;
  projectile: Projectile;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  triggerExplosion: (primaryTargetId?: string | null) => void;
}

export interface ProjectileTypeHooks {
  createMesh: (args: ProjectileTypeCreateMeshArgs) => ProjectileMeshBuildResult;
  spawnExplosionFx: (args: ProjectileTypeSpawnExplosionFxArgs) => void;
  onTargetHit: (args: ProjectileTypeTargetHitArgs) => void;
  onWorldHit: (args: ProjectileTypeWorldHitArgs) => void;
  onExpire: (args: ProjectileTypeExpireArgs) => void;
}

export interface ProjectileTypeDefinition {
  id: string;
  defaults?: Partial<ProjectileTypeDefaults>;
  rules?: Partial<ProjectileTypeRules>;
  hooks?: Partial<ProjectileTypeHooks>;
}

export interface ResolvedProjectileTypeDefinition {
  id: string;
  defaults: ProjectileTypeDefaults;
  rules: ProjectileTypeRules;
  hooks: ProjectileTypeHooks;
}
