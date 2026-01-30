export const profile = {
  id: "baron",
  label: "Baron",
  pathToken: "/baron/",
  slash: {
    enabled: false,
    color: 0x38bdf8,
  },
  animateArms: ({ arms, isMoving, now, THREE }) => {
    const baseArm = isMoving ? 0.9 : 0.1;
    const sway = isMoving ? Math.sin(now * 0.012) * 0.18 : 0;
    arms.forEach((arm) => {
      const targetArm = baseArm + sway;
      arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, targetArm, 0.2);
    });
  },
  animateModel: ({ avatarModel, isMoving, THREE }) => {
    const tiltTarget = isMoving ? -0.12 : 0;
    avatarModel.rotation.x = THREE.MathUtils.lerp(
      avatarModel.rotation.x,
      tiltTarget,
      0.08
    );
  },
};
