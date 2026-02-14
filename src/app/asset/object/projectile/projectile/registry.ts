import { abilityOrbProjectileType } from "./adam/abilityOrb";
import { shurikenProjectileType } from "./baron/shuriken";
import { carrotDeepPhantomOrbProjectileType } from "./carrot/deepPhantomOrb";
import { carrotDemonVolleyOrbProjectileType } from "./carrot/demonVolleyOrb";
import { createStandardProjectileHooks } from "./shared/standardHooks";
import type {
  ProjectileTypeHooks,
  ProjectileTypeDefaults,
  ProjectileTypeDefinition,
  ProjectileTypeRules,
  ResolvedProjectileTypeDefinition,
} from "./types";

const baseDefaults: ProjectileTypeDefaults = {
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
  explosionMinDamage: 0,
  explosionColor: null,
  explosionEmissive: null,
  explosionEmissiveIntensity: null,
};

const baseRules: ProjectileTypeRules = {
  grantEnergyOnTargetHit: true,
  explodeOnTargetHit: true,
  explodeOnWorldHit: true,
  explodeOnExpire: false,
  removeOnTargetHit: true,
  removeOnWorldHit: true,
};

const baseHooks: ProjectileTypeHooks = createStandardProjectileHooks();

const projectileTypeMap: Record<string, ProjectileTypeDefinition> = {
  abilityOrb: abilityOrbProjectileType,
  shuriken: shurikenProjectileType,
  carrotDeepPhantomOrb: carrotDeepPhantomOrbProjectileType,
  carrotDemonVolleyOrb: carrotDemonVolleyOrbProjectileType,
};

const fallbackProjectileTypeId = "abilityOrb";

export const getProjectileTypeDefinition = (
  projectileType?: string
): ResolvedProjectileTypeDefinition => {
  const key =
    projectileType && projectileTypeMap[projectileType]
      ? projectileType
      : fallbackProjectileTypeId;
  const definition = projectileTypeMap[key] ?? abilityOrbProjectileType;
  return {
    id: definition.id,
    defaults: {
      ...baseDefaults,
      ...(definition.defaults ?? {}),
    },
    rules: {
      ...baseRules,
      ...(definition.rules ?? {}),
    },
    hooks: {
      ...baseHooks,
      ...(definition.hooks ?? {}),
    },
  };
};

export const listProjectileTypeIds = () => Object.keys(projectileTypeMap);
