import type { CharacterProfile } from "../general/types";

export const profile: CharacterProfile = {
  id: "flare",
  label: "Flare",
  pathToken: "/flare/",
  rarity: "epic",
  starter: true,
  energy: {
    passivePerSecond: 0,
    hitGain: 5,
    movingPerSecond: 0,
  },
  mana: {
    passivePerSecond: 0.5,
  },
  camera: {
    miniBehindDistance: 6.9,
    miniUpDistance: 4.2,
  },
  animateArms: ({ arms, isMoving, now, THREE }) => {
    const basePose = isMoving ? 0.62 : 0.52;
    const sway = isMoving ? Math.sin(now * 0.01) * 0.08 : Math.sin(now * 0.004) * 0.02;
    for (let i = 0; i < arms.length; i += 1) {
      const arm = arms[i];
      arm.rotation.x = THREE.MathUtils.lerp(
        arm.rotation.x,
        basePose + sway,
        0.18
      );
    }
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
        cost: 0,
        cooldownMs: 15000,
        description:
          "Play skillQ and enter Burning Mode for 20s. While active, a flame effect burns above Flare's head.",
      },
      e: {
        id: "e",
        label: "E",
        cost: 30,
        cooldownMs: 5000,
        description:
          "Play skillE. When the weapon lands, ignite the weapon tip and enter Secondary Burn for 10s.",
      },
      r: {
        id: "r",
        label: "R",
        cost: 70,
        cooldownMs: 10000,
        description:
          "Play skillR and thrust forward with the staff. In Super Burn, switch to skillQ_E_R and spray flames in a forward fan.",
      },
    },
  },
  slash: {
    enabled: true,
    color: 0xf97316,
  },
};
