import type { ProjectileTypeDefinition } from "../../types";
import { createStandardProjectileHooks } from "../../shared/standardHooks";

export const shurikenProjectileType: ProjectileTypeDefinition = {
  id: "shuriken",
  defaults: {
    speed: 22,
    lifetime: 2,
    radius: 0.18,
    targetHitRadius: 0.28,
    gravity: -4,
    damageBase: 11,
    damagePerSpeed: 0.58,
    energyGainOnHit: 4,
    splitOnImpact: true,
    explosionRadius: 3.4,
    explosionDamage: 14,
    explosionColor: 0x60a5fa,
    explosionEmissive: 0x2563eb,
    explosionEmissiveIntensity: 1.05,
  },
  rules: {
    grantEnergyOnTargetHit: true,
    explodeOnTargetHit: true,
    explodeOnWorldHit: true,
    explodeOnExpire: true,
    removeOnTargetHit: true,
    removeOnWorldHit: true,
  },
  hooks: createStandardProjectileHooks({
    defaultMeshColor: 0xdbeafe,
    defaultMeshEmissive: 0x38bdf8,
    defaultMeshEmissiveIntensity: 0.85,
  }),
};
