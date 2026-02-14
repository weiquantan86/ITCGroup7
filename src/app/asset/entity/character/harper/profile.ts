import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "harper",
  label: "Harper",
  pathToken: "/harper/",
  energy: {
    passivePerSecond: 2,
    hitGain: 6,
    movingPerSecond: 2,
  },
  movement: {
    baseSpeed: 5,
    sprintMultiplier: 1.6,
  },
  kit: {
    basicAttack: { id: "basic", label: "Basic", description: "..." },
    skills: {
      q: {
        id: "q",
        label: "Q",
        description: `CD：0s
Mana：20 EN
Description：...`,
      },
      e: {
        id: "e",
        label: "E",
        description: `CD：0s
Mana：0 Mana
Description：...`,
      },
      r: {
        id: "r",
        label: "R",
        description: `CD：0s
Mana：0 Mana
Description：...`,
      },
    },
  },
  controls: {
    rightClick: "slash",
  },
  slash: {
    enabled: true,
    color: 0xa78bfa,
  },
};

