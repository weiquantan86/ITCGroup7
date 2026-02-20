import type { CharacterProfile } from "../general/types";

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
  mana: {
    passivePerSecond: 2,
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
        description: `CD：10s
Mana：100 EN
Description：...`,
        cost: 100,
        cooldownMs: 10000,
      },
      e: {
        id: "e",
        label: "E",
        description: `CD：5s
Mana：20 Mana
Description：Next normal attack will be larger.`,
        cost: 20,
        cooldownMs: 5000,
      },
      r: {
        id: "r",
        label: "R",
        description: `CD：10s
Mana：30 Mana
Description：...`,
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

