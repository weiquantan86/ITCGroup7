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
        "Hold to charge; only full charge fires. Base mode is single-shot. Q/E convert full-charge Basic into a 2-shot burst. R converts it into a heavy gravity shell, and firing that shell exits R.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        cooldownMs: 10000,
        cost: 0,
        description:
          "Toggle Mech-Electric mode (requires 70+ EN to enable). While active it drains EN continuously, boosts movement speed, and turns full-charge Basic into explosive 2-shot shells. Q-shell hits restore HP.",
      },
      e: {
        id: "e",
        label: "E",
        cooldownMs: 15000,
        cost: 60,
        description:
          "Enter Light-Jump mode for 10s. Gain movement speed and convert full-charge Basic into a 2-shot burst with stronger on-hit sustain.",
      },
      r: {
        id: "r",
        label: "R",
        cooldownMs: 20000,
        cost: 40,
        description:
          "Enter Gravity mode for 10s with reduced movement speed. Full-charge Basic becomes a crimson explosive gravity shell; first hit restores HP and Energy, and firing it ends Gravity mode.",
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
