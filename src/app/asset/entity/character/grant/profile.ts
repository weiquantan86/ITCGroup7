import type { CharacterProfile } from "../types";

export const profile: CharacterProfile = {
  id: "grant",
  label: "Grant",
  pathToken: "/grant/",
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
