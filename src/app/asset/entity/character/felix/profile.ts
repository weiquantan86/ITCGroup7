import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "felix",
  label: "Felix",
  pathToken: "/felix/",
  energy: {
    movingPerSecond: 8,
    hitGain: 5,
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
    color: 0xeab308,
  },
};

