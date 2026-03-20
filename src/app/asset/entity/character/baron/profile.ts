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
        "Hold to charge a sword slash. Release to deal charge-scaled melee damage; full charge also fires a fast sword wave. The swing can reflect frontal linear projectiles, and successful hits restore Energy and Mana.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        description:
          "Consume all EN to summon 5 clones for 10s. Clones move with reduced stats, can synchronize with E, and disappear after duration or when consumed by combo actions.",
        cost: "all",
        cooldownMs: 15000,
      },
      e: {
        id: "e",
        label: "E",
        description:
          "Hold to charge shuriken power, release to fire a 3-shuriken explosive volley. Charge increases throw quality. If clones are active, they throw synchronized empowered shurikens and are consumed after the synchronized throw.",
        cost: 20,
        cooldownMs: 5000,
      },
      r: {
        id: "r",
        label: "R",
        description:
          "Enter dance stance for 5s: move speed is reduced, Baron performs periodic melee pulses and dance waves, and frontal projectiles are reflected. Hits and reflections grant extra Energy.",
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
