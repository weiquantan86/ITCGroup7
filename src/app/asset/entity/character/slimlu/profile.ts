import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "slimlu",
  label: "Slimlu",
  pathToken: "/slimlu/",
  rarity: "common",
  starter: true,
  energy: {
    hitGain: 5,
  },
  mana: {
    passivePerSecond: 1,
  },
  camera: {
    followHeadBone: true,
    hideLocalHead: true,
    hideLocalBody: true,
  },
  kit: {
    basicAttack: {
      id: "basic",
      label: "Basic",
      description:
        "Hold Basic to drain a nearby enemy through a link. Every 0.5s the link deals scaling damage and grants Mana, EN, and Absorption Coefficient. Release to stop draining.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        cost: 0,
        cooldownMs: 0,
        description:
          "Requires full EN and consumes all current EN. Launch Slimlu's head to bite a target. High-HP targets take heavy damage; low-HP targets can be consumed for HP, Mana, and AC rewards.",
      },
      e: {
        id: "e",
        label: "E",
        cost: 60,
        cooldownMs: 7000,
        description:
          "Summon 1 + floor(AC / 5) slime clones (40 HP, decay over time). Clones seek targets and attach; pressing E again during detonation window explodes attached clones for 30 + 0.5 * AC damage.",
      },
      r: {
        id: "r",
        label: "R",
        cost: 0,
        cooldownMs: 0,
        description:
          "Dual mode. No attached clones: channel then fire beam for 75 + 0.5 * AC damage (60 Mana, 10s cooldown). With attached clones: recall all attachments; each recalled clone deals 10 + 0.02 * AC, grants AC and resource gain, and reduces R cooldown (30 Mana, 5s base cooldown).",
      },
    },
  },
  slash: {
    enabled: true,
    color: 0x22c55e,
  },
};
