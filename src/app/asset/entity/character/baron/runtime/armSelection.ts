import * as THREE from "three";

type ArmSide = "right" | "left";

const scoreArmCandidate = (arm: THREE.Object3D, side: ArmSide) => {
  const name = (arm.name || "").toLowerCase();
  let score = 0;
  if (name.includes(side)) score += 10;
  if (name.includes("arm")) score += 5;
  if (name.includes("upper") || name.includes("shoulder")) score += 3;
  if (name.includes("hand") || name.includes("fore") || name.includes("lower")) {
    score -= 6;
  }
  if (name === `arm${side}` || name === `${side}arm`) score += 6;
  return score;
};

export const pickArm = (arms: THREE.Object3D[], side: ArmSide) => {
  let best: THREE.Object3D | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < arms.length; i += 1) {
    const arm = arms[i];
    const score = scoreArmCandidate(arm, side);
    if (score > bestScore) {
      best = arm;
      bestScore = score;
    }
  }
  return best;
};

