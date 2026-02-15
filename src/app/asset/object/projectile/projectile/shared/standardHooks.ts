import type { ProjectileTypeHooks } from "../types";

type CreateStandardProjectileHooksArgs = {
  defaultMeshColor?: number;
  defaultMeshEmissive?: number;
  defaultMeshEmissiveIntensity?: number;
};

export const createStandardProjectileHooks = (
  args: CreateStandardProjectileHooksArgs = {}
): ProjectileTypeHooks => ({
  createMesh: ({ visual, buildDefaultSphereMesh }) =>
    buildDefaultSphereMesh({
      visual,
      fallbackColor: args.defaultMeshColor,
      fallbackEmissive: args.defaultMeshEmissive,
      fallbackEmissiveIntensity: args.defaultMeshEmissiveIntensity,
    }),
  spawnExplosionFx: ({ projectile, spawnDefaultExplosionFx }) => {
    if (!projectile.splitOnImpact) return;
    spawnDefaultExplosionFx();
  },
  onTargetHit: ({
    projectile,
    targetId,
    applyTargetDamage,
    grantDefaultEnergyOnHit,
    grantDefaultManaOnHit,
    triggerExplosion,
    removeProjectile,
  }) => {
    if (projectile.grantEnergyOnTargetHit) {
      grantDefaultEnergyOnHit();
    }
    if (projectile.grantManaOnTargetHit) {
      grantDefaultManaOnHit();
    }
    applyTargetDamage();
    if (projectile.explodeOnTargetHit) {
      triggerExplosion(targetId);
    }
    if (projectile.removeOnTargetHit) {
      removeProjectile();
    }
  },
  onWorldHit: ({ projectile, triggerExplosion, removeProjectile }) => {
    if (projectile.explodeOnWorldHit) {
      triggerExplosion(null);
    }
    if (projectile.removeOnWorldHit) {
      removeProjectile();
    }
  },
  onExpire: ({ projectile, triggerExplosion }) => {
    if (projectile.explodeOnExpire) {
      triggerExplosion(null);
    }
  },
});
