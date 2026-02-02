import type { CharacterProfile } from "../types";

export const profile: CharacterProfile = {
  id: "adam",
  label: "Adam",
  pathToken: "/adam/",
  kit: {
    basicAttack: { id: "basic", label: "Basic", description: "..." },
    skills: {
      q: { id: "q", label: "Q", description: "..." },
      e: { id: "e", label: "E", description: "Next normal attack will be larger" },
      r: { id: "r", label: "R", description: "..." },
    },
  },
  controls: {
    rightClick: "slash",
  },
  slash: {
    enabled: true,
    color: 0x8bc34a,
    freezeArms: true,
    effect: {
      radius: 1.5,
      segments: 36,
      thetaStart: -3 * Math.PI / 4,
      thetaLength: Math.PI / 2,
      height: 1.15,
      forward: 0.9,
      expandFrom: 0.7,
      expandTo: 1.3,
      opacity: 0.85,
      rotationX: -Math.PI / 2,
      rotationY: 0,
      rotationZ: 0,
    },
  },
};
