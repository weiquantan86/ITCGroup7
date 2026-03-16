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
    passivePerSecond: 2,
    hitGain: 6,
    movingPerSecond: 2,
  },
  kit: {
    basicAttack: { id: "basic", label: "Basic", description: "..." },
    skills: {
      q: {
        id: "q",
        label: "Q",
        cost: 100,
        description: `CD:0s
Energy:100 EN
Description:...`,
      },
      e: {
        id: "e",
        label: "E",
        description: `CD:0s
Mana:0
Description:...`,
      },
      r: {
        id: "r",
        label: "R",
        description: `CD:0s
Mana:0
Description:...`,
      },
    },
  },
  slash: {
    enabled: true,
    color: 0xa78bfa,
  },
};
