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
    hideLocalBody: true,
    miniBehindDistance: 6.9,
    miniUpDistance: 4.2,
  },
  animateArms: ({ arms, isMoving, now, THREE }) => {
    const basePose = isMoving ? 0.62 : 0.52;
    const sway = isMoving
      ? Math.sin(now * 0.01) * 0.08
      : Math.sin(now * 0.004) * 0.02;
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
        "Three-hit weapon combo with weapon sweep collision. Holding Basic enters a spinning hold attack that deals periodic fire damage, drains stamina, and can reflect incoming projectiles.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        cost: 0,
        cooldownMs: 15000,
        description:
          "Requires full EN and consumes all EN to cast. Enter Burning Mode for 20s and maintain the flame aura state used by enhanced E and R interactions.",
      },
      e: {
        id: "e",
        label: "E",
        cost: 30,
        cooldownMs: 5000,
        description:
          "Normal cast plays Skill E and ignites Secondary Burn (weapon fire state). If Burning Mode is active, E upgrades to Q_E, ignites immediately, and enables Super Burn attacks.",
      },
      r: {
        id: "r",
        label: "R",
        cost: 70,
        cooldownMs: 10000,
        description:
          "Normal cast is a forward strike. With Secondary Burn active, R throws a burn projectile that applies layered burn and explosion effects. In Super Burn, R switches to Q_E_R fan-flame mode with repeated cone damage ticks.",
      },
    },
  },
  slash: {
    enabled: true,
    color: 0xf97316,
  },
};
