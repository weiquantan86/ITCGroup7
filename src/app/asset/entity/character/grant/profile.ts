import type { CharacterProfile } from "../types";

export const profile: CharacterProfile = {
  id: "grant",
  label: "Grant",
  pathToken: "/grant/",
  energy: {
    passivePerSecond: 3,
    hitGain: 8,
    movingPerSecond: 2,
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
    color: 0x60a5fa,
  },
};
