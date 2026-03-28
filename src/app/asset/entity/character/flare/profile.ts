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
        "Three-hit weapon combo with sweep collision. Holding Basic enters a spinning attack that deals periodic fire damage, drains stamina, and can reflect incoming linear projectiles.",
    },
    skills: {
      q: {
        id: "q",
        label: "Q",
        cost: 0,
        cooldownMs: 15000,
        description:
          "Enter Burning Overdrive immediately (auto-enables enhanced weapon state). While active: drains EN at 3.5/s, regenerates HP at 3/s, and upgrades combat behavior. Press Q again to cancel.",
      },
      e: {
        id: "e",
        label: "E",
        cost: 0,
        cooldownMs: 5000,
        description:
          "Outside Overdrive: cast to ignite Secondary Burn. During Overdrive: consume 40 Mana + 40 Energy to auto-cast the empowered heavy slash (enhanced basic attack) with a wide frontal blast.",
      },
      r: {
        id: "r",
        label: "R",
        cost: 70,
        cooldownMs: 10000,
        description:
          "Mode-based cast: normal R is a forward strike. With Secondary Burn, R fires a burn projectile that applies layered burn and explosion effects. In enhanced burn, R switches to fan-flame mode with repeated cone damage ticks.",
      },
    },
  },
  slash: {
    enabled: true,
    color: 0xf97316,
  },
};
