import type { ProjectileTypeDefinition } from "../../types";
import { createStandardProjectileHooks } from "../../shared/standardHooks";

export const abilityOrbProjectileType: ProjectileTypeDefinition = {
  id: "abilityOrb",
  defaults: {
    speed: 18,
    lifetime: 2.2,
    radius: 0.12,
    targetHitRadius: 0,
    gravity: -12,
    damageBase: 10,
    damagePerSpeed: 0.6,
    energyGainOnHit: null,
    splitOnImpact: false,
    explosionRadius: 0,
    explosionDamage: 0,
    explosionColor: null,
    explosionEmissive: null,
    explosionEmissiveIntensity: null,
  },
  rules: {
    grantEnergyOnTargetHit: true,
    explodeOnTargetHit: true,
    explodeOnWorldHit: true,
    explodeOnExpire: false,
    removeOnTargetHit: true,
    removeOnWorldHit: true,
  },
  hooks: createStandardProjectileHooks({
    defaultMeshColor: 0xe2e8f0,
    defaultMeshEmissive: 0x93c5fd,
    defaultMeshEmissiveIntensity: 0.6,
  }),
};
