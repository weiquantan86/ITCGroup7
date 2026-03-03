import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "flare",
  label: "Flare",
  pathToken: "/flare/",
  energy: {
    passivePerSecond: 1,
    hitGain: 5,
    movingPerSecond: 1,
  },
  mana: {
    passivePerSecond: 1,
  },
  movement: {
    baseSpeed: 5,
    sprintMultiplier: 1.6,
  },
  camera: {
    miniBehindDistance: 5.5,
    miniUpDistance: 3.2,
  },
  kit: {
    basicAttack: {
      id: "basic",
      label: "Basic",
      description:
        "Three-hit combo using normalAttack1, normalAttack2, and normalAttack3. Weapon collision deals damage on contact.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        description: "Flare skill data is not wired yet.",
      },
      e: {
        id: "e",
        label: "E",
        description:
          "Play skillE. When the weapon lands, ignite the weapon tip and enter Secondary Burn.",
      },
      r: {
        id: "r",
        label: "R",
        description: "Play skillR and thrust forward with the staff.",
      },
    },
  },
  slash: {
    enabled: true,
    color: 0xf97316,
  },
};
