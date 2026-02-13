import type { CharacterProfile } from "../types";

export const profile: CharacterProfile = {
  id: "carrot",
  label: "Carrot",
  pathToken: "/carrot/",
  energy: {
    passivePerSecond: 3,
    movingPerSecond: 3,
  },
  movement: {
    baseSpeed: 5,
    sprintMultiplier: 1.6,
  },
  kit: {
    basicAttack: { id: "basic", label: "Basic", description: "..." },
    skills: {
      q: { id: "q", label: "Q", description: "..." },
      e: {
        id: "e",
        label: "E",
        description:
          "Cost 20 mana. Enter a 0.3s phasing state; getting hit triggers a 3s deep phase with full damage immunity. Recast during deep phase to fire 5 energy bolts. If deep phase ends naturally, recover 15 HP and 20 EN.",
        cost: 20,
        cooldownMs: 7000,
      },
      r: { id: "r", label: "R", description: "..." },
    },
  },
  controls: {
    rightClick: "slash",
  },
  slash: {
    enabled: true,
    color: 0x6d28d9,
    effect: {
      shape: "cube",
      size: 0.45,
      travel: 1.8,
      rollTurns: 1.75,
      height: 0.95,
      forward: 0.6,
      opacity: 0.9,
      duration: 520,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
    },
  },
  animateModel: ({ avatarModel, isMoving, now, THREE }) => {
    const swayTarget = isMoving ? Math.sin(now * 0.006) * 0.12 : 0;
    avatarModel.rotation.z = THREE.MathUtils.lerp(
      avatarModel.rotation.z,
      swayTarget,
      0.1
    );
  },
};
