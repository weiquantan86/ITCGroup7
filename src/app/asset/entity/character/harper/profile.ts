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
        "Bare state: hold to charge and release a projectile; early release cancels before firing. Bare hits restore Mana. Weapon state: 3-stage sword combo with per-stage damage/resource gain; stage 3 adds forward reach, backstep, and self-heal on hit.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        cost: 100,
        description:
          "Cast movement is heavily reduced. Bare Q summons a gate that periodically spawns Purcles; Purcle hits restore Harper Mana and Energy. Weapon Q uses weapon collider sweep with repeated explosion-hit windows.",
      },
      e: {
        id: "e",
        label: "E",
        cost: 70,
        cooldownMs: 20_000,
        description:
          "State swap skill. Bare E spends 70 Mana to equip weapon (no E cooldown start). Weapon E throws the weapon as an explosive projectile and leaves a damaging explosion field, then starts E cooldown.",
      },
      r: {
        id: "r",
        label: "R",
        cost: 50,
        cooldownMs: 13_000,
        description:
          "Both states cost 50 Mana with 13s cooldown. Bare R releases a homing projectile barrage with Energy gain on hit. Weapon R summons 3 Purcles around Harper.",
      },
    },
  },
  slash: {
    enabled: true,
    color: 0xa78bfa,
  },
};
