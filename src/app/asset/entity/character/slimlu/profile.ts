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
      description: "...",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        cost: 0,
        cooldownMs: 0,
        description: "Play eat animation.",
      },
      e: {
        id: "e",
        label: "E",
        cost: 60,
        cooldownMs: 7000,
        description:
          "Summon 1 + floor(AC/5) slime clones (40 HP, move with Slimlu speed, lose 6 HP/s). " +
          "Clones auto-seek and attach for up to 30s; pressing E again detonates attached clones for 30 + 0.5*AC damage.",
      },
      r: {
        id: "r",
        label: "R",
        cost: 0,
        cooldownMs: 0,
        description:
          "Dual mode. If no clone is attached: charge at mouth for 2s with dense particles and a compressed green core, then fire a Hyper Beam-style blast that deals 75 + 0.5*AC once to targets hit (60 mana, 10s cooldown). " +
          "If any clone is attached: instantly recall all attachments to Slimlu; each recalled clone deals 10 + 0.02*AC to its host and grants Slimlu +0.1 AC with recovery VFX (30 mana, 5s cooldown).",
      },
    },
  },
  slash: {
    enabled: true,
    color: 0x22c55e,
  },
};
