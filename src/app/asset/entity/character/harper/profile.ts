import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "harper",
  label: "Harper",
  pathToken: "/harper/",
  rarity: "epic",
  starter: false,
  camera: {
    followHeadBone: true,
    hideLocalHead: true,
    hideLocalBody: true,
    miniUpDistance: 2.4,
  },
  energy: {
    passivePerSecond: 0,
    hitGain: 0,
    movingPerSecond: 0,
  },
  mana: {
    passivePerSecond: 1,
  },
  kit: {
    basicAttack: {
      id: "basic",
      label: "Basic",
      description:
        "Bare state: hold to charge and release a projectile; early release cancels before firing. Bare hit restores 4 Mana. Weapon state: 3-stage sword combo with weapon mesh hit detection; each hit restores 2 Mana, and stage 3 has extra forward reach plus a smooth backstep.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        cost: 100,
        description:
          "Cast-state move speed is reduced to 0.1x. Bare Q summons a gate that periodically spawns Purcles; each Purcle hit restores Harper 1 Mana and 1 EN. Weapon Q uses weapon mesh collision to trigger repeated explosion hits during the swing.",
      },
      e: {
        id: "e",
        label: "E",
        cost: 70,
        cooldownMs: 20_000,
        description:
          "State-swap skill. Bare E costs 70 Mana to equip weapon and does not start cooldown. Weapon E throws the weapon, applies explosion damage on impact, and starts the 20s E cooldown when the sword is dropped.",
      },
      r: {
        id: "r",
        label: "R",
        cost: 50,
        cooldownMs: 13_000,
        description:
          "Both states cost 50 Mana and use a 13s cooldown. Bare R releases a homing projectile barrage and each hit restores 2 EN. Weapon R summons 3 Purcles around Harper.",
      },
    },
  },
  slash: {
    enabled: true,
    color: 0xa78bfa,
  },
};
