import type { CharacterProfile } from "../types";

export const profile: CharacterProfile = {
  id: "adam",
  label: "Adam",
  pathToken: "/adam/",
  energy: {
    passivePerSecond: 0,
    movingPerSecond: 0,
    hitGain: 4,
    damageTakenRatio: 0,
  },
  kit: {
    basicAttack: { id: "basic", label: "Basic", description: "..." },
    skills: {
      q: {
        id: "q",
        label: "Q",
        description: "...",
        cost: 0,
        cooldownMs: 30000,
      },
      e: {
        id: "e",
        label: "E",
        description: "Next normal attack will be larger",
        cost: 20,
        cooldownMs: 5000,
      },
      r: {
        id: "r",
        label: "R",
        description: "...",
        cost: 30,
        cooldownMs: 10000,
      },
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
