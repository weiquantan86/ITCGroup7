import { createStandardProjectileHooks } from "../../shared/standardHooks";
import type { ProjectileTypeDefinition } from "../../types";

const defaultScale = 6;
const fallbackColor = 0x3b0764;
const fallbackEmissive = 0x6d28d9;
const fallbackEmissiveIntensity = 1.24;

const standardHooks = createStandardProjectileHooks({
  defaultMeshColor: fallbackColor,
  defaultMeshEmissive: fallbackEmissive,
  defaultMeshEmissiveIntensity: fallbackEmissiveIntensity,
});

export const carrotDeepPhantomOrbProjectileType: ProjectileTypeDefinition = {
  id: "carrotDeepPhantomOrb",
  defaults: {
    speed: 17.5,
    lifetime: 1.8,
    radius: 0.12,
    targetHitRadius: 0,
    gravity: 0,
    damageBase: 30,
    damagePerSpeed: 0,
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
