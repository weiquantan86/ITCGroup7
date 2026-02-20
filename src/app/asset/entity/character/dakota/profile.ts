import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "dakota",
  label: "Dakota",
  pathToken: "/dakota/",
  energy: {
    hitGain: 0,
  },
  mana: {
    passivePerSecond: 0,
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
        cooldownMs: 10000,
        cost: 0,
        description: `CD: 10s
Mana: 0 EN
Description: Enter Mech-Electric state. Requires at least 70 EN to activate, drains 5 EN per second, grants 1.2x move speed, and charged basic attack fires 2 explosive shots.`,
      },
      e: {
        id: "e",
        label: "E",
        cooldownMs: 15000,
        cost: 60,
        description: `CD: 15s
Mana: 60
Description: Enter Light-Jump state for 10s. Gain 1.2x move speed, feet emit green particles, and charged basic attack fires a 2-shot burst.`,
      },
      r: {
        id: "r",
        label: "R",
        cooldownMs: 20000,
        cost: 40,
        description: `CD: 20s
Mana: 40
Description: Enter Gravity state. Move speed is halved. During this state, basic attack charges for 1.8s and fires one explosive shell, then immediately exits the state.`,
      },
    },
  },
  controls: {
    rightClick: "slash",
  },
  camera: {
    followHeadBone: true,
  },
  slash: {
    enabled: true,
    color: 0x16a34a,
  },
};
