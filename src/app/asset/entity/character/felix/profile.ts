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
      q: { id: "q", label: "Q", description: "..." },
      e: { id: "e", label: "E", description: "..." },
      r: { id: "r", label: "R", description: "..." },
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

