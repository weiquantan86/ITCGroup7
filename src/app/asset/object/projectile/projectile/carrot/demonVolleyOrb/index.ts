import { createStandardProjectileHooks } from "../../shared/standardHooks";
import type { ProjectileTypeDefinition } from "../../types";

const defaultScale = 6.2;
const fallbackColor = 0x22093f;
const fallbackEmissive = 0x120a2f;
const fallbackEmissiveIntensity = 1.05;

const standardHooks = createStandardProjectileHooks({
  defaultMeshColor: fallbackColor,
  defaultMeshEmissive: fallbackEmissive,
  defaultMeshEmissiveIntensity: fallbackEmissiveIntensity,
});

export const carrotDemonVolleyOrbProjectileType: ProjectileTypeDefinition = {
  id: "carrotDemonVolleyOrb",
  defaults: {
    speed: 19.5,
    lifetime: 1.7,
    radius: 0.12,
    targetHitRadius: 0,
    gravity: 0,
    damageBase: 13,
    damagePerSpeed: 0,
    energyGainOnHit: null,
    manaGainOnHit: null,
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
  hooks: {
    ...standardHooks,
    createMesh: ({ visual, buildDefaultSphereMesh }) => {
      const resolvedVisual = {
        ...visual,
        scale: visual?.scale ?? defaultScale,
        color: visual?.color ?? fallbackColor,
        emissive: visual?.emissive ?? fallbackEmissive,
        emissiveIntensity:
          visual?.emissiveIntensity ?? fallbackEmissiveIntensity,
      };
      return buildDefaultSphereMesh({
        visual: resolvedVisual,
        fallbackColor,
        fallbackEmissive,
        fallbackEmissiveIntensity,
      });
    },
  },
};
