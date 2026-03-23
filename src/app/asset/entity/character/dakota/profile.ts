import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "dakota",
  label: "Dakota",
  pathToken: "/dakota/",
  rarity: "rare",
  starter: false,
  energy: {
    hitGain: 0,
  },
  mana: {
    passivePerSecond: 0,
  },
  kit: {
    basicAttack: {
      id: "basic",
      label: "Basic",
      description:
        "Hold to charge. Projectile only fires at full charge. Base mode fires a single shot; Q and E states change this into a 2-shot burst; R state fires one heavy gravity shell and then exits R.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        cooldownMs: 10000,
        cost: 0,
        description:
          "Toggle Mech-Electric mode. Requires at least 70 EN to activate, drains EN over time, grants move speed, and changes charged Basic into explosive 2-shot shells.",
      },
      e: {
        id: "e",
        label: "E",
        cooldownMs: 15000,
        cost: 60,
        description:
          "Enter Light-Jump mode for 10s. Gain move speed and convert charged Basic into a 2-shot burst with improved on-hit sustain.",
      },
      r: {
        id: "r",
        label: "R",
        cooldownMs: 20000,
        cost: 40,
        description:
          "Enter Gravity mode for 10s with reduced move speed. Charged Basic becomes a crimson explosive gravity shell; its first hit restores HP and Energy, and firing it ends Gravity mode.",
      },
    },
  },
  camera: {
    followHeadBone: true,
    hideLocalBody: true,
  },
  slash: {
    enabled: true,
    color: 0x9ca3af,
  },
};
