import type { CharacterProfile } from "../types";

export const profile: CharacterProfile = {
  id: "baron",
  label: "Baron",
  pathToken: "/baron/",
  energy: {
    movingPerSecond: 10,
  },
  movement: {
    baseSpeed: 5,
    sprintMultiplier: 1.6,
  },
  kit: {
    basicAttack: { id: "basic", label: "Basic", description: "..." },
    skills: {
      q: { id: "q", label: "Q", description: "...", cost: "all", cooldownMs: 30000 },
      e: { id: "e", label: "E", description: "...", cooldownMs: 5000 },
      r: { id: "r", label: "R", description: "...", cost: 35, cooldownMs: 10000 },
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
    color: 0x38bdf8,
    effect: {
      shape: "rect",
      width: 0.35,
      length: 2.6,
      height: 1.05,
      forward: 1.3,
      expandFrom: 0.85,
      expandTo: 1.15,
      opacity: 0.8,
      rotationX: -Math.PI / 2,
      rotationY: 0,
      rotationZ: 0,
    },
  },
  animateArms: ({ arms, isMoving, now, THREE }) => {
    const baseArm = isMoving ? 0.9 : 0.1;
    const sway = isMoving ? Math.sin(now * 0.012) * 0.18 : 0;
    arms.forEach((arm) => {
      const targetArm = baseArm + sway;
      arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, targetArm, 0.2);
    });
  },
  animateModel: ({ avatarModel, isMoving, isSprinting, THREE }) => {
    const tiltTarget = isSprinting ? 0.54 : isMoving ? 0.2 : 0;
    avatarModel.rotation.x = THREE.MathUtils.lerp(
      avatarModel.rotation.x,
      tiltTarget,
      isSprinting ? 0.2 : 0.14
    );
  },
};
