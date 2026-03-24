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
        "Hold Basic to link and drain nearby targets. Every 0.5s each link deals damage that scales with Absorption Coefficient, and successful ticks grant Mana, Energy, and more Absorption Coefficient. Release to stop draining.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        cost: 0,
        cooldownMs: 0,
        description:
          "Requires full EN and consumes all current EN. Launch Slimlu's head forward to bite/consume targets. High-HP targets take heavy strike damage with sustain rewards; low-HP targets are executed for large HP/Mana/Absorption rewards.",
      },
      e: {
        id: "e",
        label: "E",
        cost: 60,
        cooldownMs: 7000,
        description:
          "Summon 1 + floor(AC / 5) slime clones (40 HP, decays over time). Clones seek and attach to targets. Press E again during detonation window to explode attached clones for AC-scaled damage and resource gain.",
      },
      r: {
        id: "r",
        label: "R",
        cost: 0,
        cooldownMs: 0,
        description:
          "Dual mode. No attached clones: charge then fire a beam that ticks AC-scaled damage and grants Energy on hit (60 Mana, 10s cooldown). With attached clones: recall attachments; each recall deals AC-scaled damage, grants AC/Mana/Energy, and reduces cooldown time (30 Mana, 5s base cooldown).",
      },
    },
  },
  slash: {
    enabled: true,
    color: 0x22c55e,
  },
};
