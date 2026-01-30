export const profile = {
  id: "carrot",
  label: "Carrot",
  pathToken: "/carrot/",
  slash: {
    enabled: false,
    color: 0xf97316,
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
