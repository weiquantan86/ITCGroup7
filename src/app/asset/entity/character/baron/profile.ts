import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "baron",
  label: "Baron",
  pathToken: "/baron/",
  rarity: "rare",
  starter: false,
  energy: {
    movingPerSecond: 0,
  },
  mana: {
    passivePerSecond: 0.5,
  },
  kit: {
    basicAttack: {
      id: "basic",
      label: "Basic",
      description:
        "Hold to charge a sword slash (0.18s-1.8s). Release for charge-scaled melee damage/range; full charge also fires a sword wave. Swing hits and projectile reflections restore Energy and Mana.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        description:
          "Consume all EN to summon 5 clones for 10s (reduced HP/speed). Recast Q while clones exist to trigger the super slash chain: clones strike in sequence, then Baron finishes with a stronger slash.",
        cost: "all",
        cooldownMs: 15000,
      },
      e: {
        id: "e",
        label: "E",
        description:
          "Hold to charge and release a 3-shuriken volley. Charge scales shuriken size/speed/lifetime/explosion. With active clones, shurikens become empowered/homing and clones throw synchronized explosive shurikens before being consumed.",
        cost: 20,
        cooldownMs: 5000,
      },
      r: {
        id: "r",
        label: "R",
        description:
          "Enter dance stance for 5s: move speed is reduced, periodic melee pulses trigger dance slashes, and frontal projectiles are reflected. Skill hits and reflections grant extra Energy and Mana.",
        cost: 35,
        cooldownMs: 10000,
      },
    },
  },
  camera: {
    followHeadBone: true,
  },
  slash: {
    enabled: true,
    color: 0x38bdf8,
    effect: {
      shape: "rect",
      width: 0.35,
      length: 2.6,
      height: 1.05,
      forward: 1.3,
      expandFrom: 0.85,
      expandTo: 1.15,
      opacity: 0.8,
      rotationX: -Math.PI / 2,
      rotationY: 0,
      rotationZ: 0,
    },
  },
};
