import type { CharacterProfile } from "../types";

export const profile: CharacterProfile = {
  id: "carrot",
  label: "Carrot",
  pathToken: "/carrot/",
  controls: {
    rightClick: "slash",
  },
  slash: {
    enabled: true,
    color: 0xf97316,
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
