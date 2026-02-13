import { createStandardProjectileHooks } from "../../shared/standardHooks";
import type { ProjectileTypeDefinition } from "../../types";

const defaultScale = 6;
const fallbackColor = 0x22093f;
const fallbackEmissive = 0x27125a;
const fallbackEmissiveIntensity = 1.12;

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
      const resolvedVisual = visual
        ? visual.scale == null
          ? { ...visual, scale: defaultScale }
          : visual
        : { scale: defaultScale };
      return buildDefaultSphereMesh({
        visual: resolvedVisual,
        fallbackColor,
        fallbackEmissive,
        fallbackEmissiveIntensity,
      });
    },
  },
};

