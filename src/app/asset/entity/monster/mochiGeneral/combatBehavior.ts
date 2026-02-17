import * as THREE from "three";
import type { Monster } from "../general";

export type MochiGeneralRig = {
  body: THREE.Object3D | null;
  armLeft: THREE.Object3D | null;
  armRight: THREE.Object3D | null;
  sword: THREE.Object3D | null;
  swordTip: THREE.Object3D | null;
  leftForeArm: THREE.Object3D | null;
  leftHand: THREE.Object3D | null;
  legLeft: THREE.Object3D | null;
  legRight: THREE.Object3D | null;
  headPivot: THREE.Object3D | null;
  head: THREE.Object3D | null;
  leftPauldron: THREE.Object3D | null;
  rightPauldron: THREE.Object3D | null;
  bodyBaseY: number;
  bodyBaseRotY: number;
  bodyBaseRotX: number;
  bodyBaseRotZ: number;
  armLeftBasePos: THREE.Vector3;
  armRightBasePos: THREE.Vector3;
  armLeftBaseQuat: THREE.Quaternion;
  armRightBaseQuat: THREE.Quaternion;
  armLeftBaseX: number;
  armLeftBaseY: number;
  armLeftBaseZ: number;
  armRightBaseX: number;
  armRightBaseY: number;
  armRightBaseZ: number;
  swordBaseQuat: THREE.Quaternion;
  swordBladeAxisLocal: THREE.Vector3;
  leftForeArmBaseX: number;
  leftForeArmBaseY: number;
  leftForeArmBaseZ: number;
  leftHandBaseX: number;
  leftHandBaseY: number;
  leftHandBaseZ: number;
  headPivotBaseX: number;
  headPivotBaseY: number;
  headPivotBaseZ: number;
  headBaseX: number;
  headBaseY: number;
  headBaseZ: number;
  leftPauldronBasePos: THREE.Vector3 | null;
  rightPauldronBasePos: THREE.Vector3 | null;
  legLeftBaseX: number;
  legRightBaseX: number;
};

export type MochiGeneralCombatEntry = {
  anchor: THREE.Group;
  fallback: THREE.Mesh;
  model: THREE.Object3D | null;
  monster: Monster;
  walkPhase: number;
  walkBlend: number;
  headLookYaw: number;
  headLookPitch: number;
  swordFeintTimer: number;
  swordAttackPoseWeight: number;
  swordHandSwing: number;
  rig: MochiGeneralRig | null;
};

const MOCHI_GENERAL_TRACK_RANGE = 200;
const MOCHI_GENERAL_SWORD_FRONT_MAX_YAW_OFFSET = 0.72;
const MOCHI_GENERAL_SWORD_FRONT_EXTRA_RANGE = 1.2;
const MOCHI_GENERAL_SWORD_FRONT_BLEND_DISTANCE = 1.25;
const MOCHI_GENERAL_SWORD_FEINT_MAX_YAW_OFFSET = 0.28;
const MOCHI_GENERAL_SWORD_FEINT_REVERSE_MULTIPLIER = 3;
const MOCHI_GENERAL_SWORD_FEINT_REVERSE_DURATION =
  0.3 * MOCHI_GENERAL_SWORD_FEINT_REVERSE_MULTIPLIER;
const MOCHI_GENERAL_SWORD_FEINT_FORWARD_DURATION = 0.3;
const MOCHI_GENERAL_SWORD_FEINT_HOLD_DURATION = 0.3;
const MOCHI_GENERAL_SWORD_FEINT_RECOVER_DURATION = 0.3;
const MOCHI_GENERAL_SWORD_FEINT_IDLE_DURATION = 0.3;
const MOCHI_GENERAL_SWORD_HAND_SWING_MULTIPLIER = 2.5;
const MOCHI_GENERAL_SWORD_FEINT_INTERVAL =
  MOCHI_GENERAL_SWORD_FEINT_REVERSE_DURATION +
  MOCHI_GENERAL_SWORD_FEINT_FORWARD_DURATION +
  MOCHI_GENERAL_SWORD_FEINT_HOLD_DURATION +
  MOCHI_GENERAL_SWORD_FEINT_RECOVER_DURATION +
  MOCHI_GENERAL_SWORD_FEINT_IDLE_DURATION;

const moveTargetPosition = new THREE.Vector3();
const headLookTargetWorld = new THREE.Vector3();
const headLookTargetLocal = new THREE.Vector3();
const headLookOriginLocal = new THREE.Vector3();
const headLookDirectionLocal = new THREE.Vector3();
const armDeltaRotation = new THREE.Quaternion();
const armBaseInverseRotation = new THREE.Quaternion();
const rotatedPauldronOffset = new THREE.Vector3();
const pauldronAnchorCompensation = new THREE.Vector3();
const swordBaseAxisInParent = new THREE.Vector3();
const swordDesiredDirectionLocal = new THREE.Vector3();
const swordTargetRotation = new THREE.Quaternion();
const swordRotationDelta = new THREE.Quaternion();
const swordParentWorldRotation = new THREE.Quaternion();
const swordParentWorldRotationInverse = new THREE.Quaternion();
const anchorWorldRotation = new THREE.Quaternion();
const anchorForwardWorld = new THREE.Vector3();

export const createMochiGeneralCombatState = () => ({
  walkPhase: Math.random() * Math.PI * 2,
  walkBlend: 0,
  headLookYaw: 0,
  headLookPitch: 0,
  swordFeintTimer: 0,
  swordAttackPoseWeight: 0,
  swordHandSwing: 0,
  rig: null as MochiGeneralRig | null,
});

export const resetMochiGeneralCombatState = (entry: MochiGeneralCombatEntry) => {
  entry.rig = null;
  entry.headLookYaw = 0;
  entry.headLookPitch = 0;
  entry.walkBlend = 0;
  entry.swordFeintTimer = 0;
  entry.swordAttackPoseWeight = 0;
  entry.swordHandSwing = 0;
};

export const resolveMochiGeneralRig = (
  model: THREE.Object3D
): MochiGeneralRig => {
  let body: THREE.Object3D | null = null;
  let armLeft: THREE.Object3D | null = null;
  let armRight: THREE.Object3D | null = null;
  let sword: THREE.Object3D | null = null;
  let swordTip: THREE.Object3D | null = null;
  let leftForeArm: THREE.Object3D | null = null;
  let leftHand: THREE.Object3D | null = null;
  let legLeft: THREE.Object3D | null = null;
  let legRight: THREE.Object3D | null = null;
  let headPivot: THREE.Object3D | null = null;
  let head: THREE.Object3D | null = null;
  let crest: THREE.Object3D | null = null;
  let eyeLeft: THREE.Object3D | null = null;
  let eyeRight: THREE.Object3D | null = null;
  let leftPauldron: THREE.Object3D | null = null;
  let rightPauldron: THREE.Object3D | null = null;

  model.traverse((child) => {
    const name = child.name.toLowerCase();
    if (!body && (name === "body" || name.includes("body"))) {
      body = child;
    }
    if (!armLeft && name.includes("armleft")) {
      armLeft = child;
    }
    if (!armRight && name.includes("armright")) {
      armRight = child;
    }
    if (!sword && name.includes("generalsword")) {
      sword = child;
    }
    if (!swordTip && name.includes("swordtip")) {
      swordTip = child;
    }
    if (!leftForeArm && name.includes("leftforearm")) {
      leftForeArm = child;
    }
    if (!leftHand && name.includes("lefthand")) {
      leftHand = child;
    }
    if (!legLeft && name.includes("legleft")) {
      legLeft = child;
    }
    if (!legRight && name.includes("legright")) {
      legRight = child;
    }
    if (!head && (name === "head" || name.includes("head"))) {
      head = child;
    }
    if (!crest && (name === "crest" || name.includes("crest"))) {
      crest = child;
    }
    if (!eyeLeft && (name === "eyel" || name.includes("eyel"))) {
      eyeLeft = child;
    }
    if (!eyeRight && (name === "eyer" || name.includes("eyer"))) {
      eyeRight = child;
    }
    if (!leftPauldron && name.includes("leftpauldron")) {
      leftPauldron = child;
    }
    if (!rightPauldron && name.includes("rightpauldron")) {
      rightPauldron = child;
    }
  });

  if (head?.parent) {
    const headParent = head.parent;
    headPivot = new THREE.Object3D();
    headPivot.name = "mochiGeneralHeadPivot";
    headPivot.position.copy(head.position);
    headPivot.position.y -= 0.32;
    headPivot.position.z -= 0.08;
    headParent.add(headPivot);
    headPivot.updateMatrixWorld(true);
    headPivot.attach(head);
    if (crest && crest.parent === headParent) headPivot.attach(crest);
    if (eyeLeft && eyeLeft.parent === headParent) headPivot.attach(eyeLeft);
    if (eyeRight && eyeRight.parent === headParent) headPivot.attach(eyeRight);
  }

  const swordBladeAxisLocal = new THREE.Vector3(1, 0, 0);
  if (sword && swordTip && swordTip.parent === sword) {
    swordBladeAxisLocal.copy(swordTip.position);
    if (swordBladeAxisLocal.lengthSq() <= 0.00001) {
      swordBladeAxisLocal.set(1, 0, 0);
    } else {
      swordBladeAxisLocal.normalize();
    }
  }

  return {
    body,
    armLeft,
    armRight,
    sword,
    swordTip,
    leftForeArm,
    leftHand,
    legLeft,
    legRight,
    headPivot,
    head,
    leftPauldron,
    rightPauldron,
    bodyBaseY: body?.position.y ?? 0,
    bodyBaseRotY: body?.rotation.y ?? 0,
    bodyBaseRotX: body?.rotation.x ?? 0,
    bodyBaseRotZ: body?.rotation.z ?? 0,
    armLeftBasePos: armLeft?.position.clone() ?? new THREE.Vector3(),
    armRightBasePos: armRight?.position.clone() ?? new THREE.Vector3(),
    armLeftBaseQuat: armLeft?.quaternion.clone() ?? new THREE.Quaternion(),
    armRightBaseQuat: armRight?.quaternion.clone() ?? new THREE.Quaternion(),
    armLeftBaseX: armLeft?.rotation.x ?? 0,
    armLeftBaseY: armLeft?.rotation.y ?? 0,
    armLeftBaseZ: armLeft?.rotation.z ?? 0,
    armRightBaseX: armRight?.rotation.x ?? 0,
    armRightBaseY: armRight?.rotation.y ?? 0,
    armRightBaseZ: armRight?.rotation.z ?? 0,
    swordBaseQuat: sword?.quaternion.clone() ?? new THREE.Quaternion(),
    swordBladeAxisLocal,
    leftForeArmBaseX: leftForeArm?.rotation.x ?? 0,
    leftForeArmBaseY: leftForeArm?.rotation.y ?? 0,
    leftForeArmBaseZ: leftForeArm?.rotation.z ?? 0,
    leftHandBaseX: leftHand?.rotation.x ?? 0,
    leftHandBaseY: leftHand?.rotation.y ?? 0,
    leftHandBaseZ: leftHand?.rotation.z ?? 0,
    headPivotBaseX: headPivot?.rotation.x ?? 0,
    headPivotBaseY: headPivot?.rotation.y ?? 0,
    headPivotBaseZ: headPivot?.rotation.z ?? 0,
    headBaseX: head?.rotation.x ?? 0,
    headBaseY: head?.rotation.y ?? 0,
    headBaseZ: head?.rotation.z ?? 0,
    leftPauldronBasePos: leftPauldron?.position.clone() ?? null,
    rightPauldronBasePos: rightPauldron?.position.clone() ?? null,
    legLeftBaseX: legLeft?.rotation.x ?? 0,
    legRightBaseX: legRight?.rotation.x ?? 0,
  };
};

const moveBossTowardPlayer = (
  entry: MochiGeneralCombatEntry,
  player: THREE.Object3D,
  delta: number,
  isBlocked: (x: number, z: number) => boolean
) => {
  player.getWorldPosition(moveTargetPosition);
  const startX = entry.anchor.position.x;
  const startZ = entry.anchor.position.z;
  const dx = moveTargetPosition.x - startX;
  const dz = moveTargetPosition.z - startZ;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.00001) return 0;

  const step = entry.monster.stats.speed * delta;
  const ratio = Math.min(step / distance, 1);
  const nextX = startX + dx * ratio;
  const nextZ = startZ + dz * ratio;

  if (!isBlocked(nextX, nextZ)) {
    entry.anchor.position.x = nextX;
    entry.anchor.position.z = nextZ;
  } else {
    let moved = false;
    const slideX = startX + dx * ratio;
    if (!isBlocked(slideX, startZ)) {
      entry.anchor.position.x = slideX;
      moved = true;
    }
    const slideZ = startZ + dz * ratio;
    if (!isBlocked(entry.anchor.position.x, slideZ)) {
      entry.anchor.position.z = slideZ;
      moved = true;
    }
    if (!moved) return 0;
  }

  const movedDistance = Math.hypot(
    entry.anchor.position.x - startX,
    entry.anchor.position.z - startZ
  );
  if (movedDistance > 0.0001) {
    const moveDx = entry.anchor.position.x - startX;
    const moveDz = entry.anchor.position.z - startZ;
    entry.anchor.rotation.y = Math.atan2(moveDx, moveDz);
  }
  return movedDistance;
};

const updateBossHeadLook = (
  entry: MochiGeneralCombatEntry,
  player: THREE.Object3D,
  delta: number,
  trackingActive: boolean
) => {
  if (!entry.model || !entry.rig?.head) return;
  if (!trackingActive) {
    entry.headLookYaw = THREE.MathUtils.damp(entry.headLookYaw, 0, 10, delta);
    entry.headLookPitch = THREE.MathUtils.damp(entry.headLookPitch, 0, 10, delta);
    return;
  }
  const lookPivot = entry.rig.headPivot;
  const lookNode = lookPivot ?? entry.rig.head;
  const lookParent = lookNode.parent;
  if (!lookParent) return;

  player.getWorldPosition(headLookTargetWorld);
  headLookTargetWorld.y += 1.35;
  headLookTargetLocal.copy(headLookTargetWorld);
  lookParent.worldToLocal(headLookTargetLocal);
  headLookOriginLocal.copy(lookNode.position);
  headLookDirectionLocal.copy(headLookTargetLocal).sub(headLookOriginLocal);

  const horizontal = Math.hypot(headLookDirectionLocal.x, headLookDirectionLocal.z);
  if (horizontal <= 0.00001 && Math.abs(headLookDirectionLocal.y) <= 0.00001) {
    entry.headLookYaw = THREE.MathUtils.damp(entry.headLookYaw, 0, 10, delta);
    entry.headLookPitch = THREE.MathUtils.damp(entry.headLookPitch, 0, 10, delta);
    return;
  }

  const targetYaw = THREE.MathUtils.clamp(
    Math.atan2(headLookDirectionLocal.x, headLookDirectionLocal.z),
    -1.05,
    1.05
  );
  const targetPitch = THREE.MathUtils.clamp(
    // For this rig, negative local Y should drive a downward look.
    Math.atan2(-headLookDirectionLocal.y, Math.max(0.00001, horizontal)),
    -0.95,
    0.55
  );
  entry.headLookYaw = THREE.MathUtils.damp(entry.headLookYaw, targetYaw, 16, delta);
  entry.headLookPitch = THREE.MathUtils.damp(
    entry.headLookPitch,
    targetPitch,
    16,
    delta
  );
};

const sampleSwordFeintMotion = (
  entry: MochiGeneralCombatEntry,
  delta: number,
  maxYawOffset: number,
  active: boolean
) => {
  if (!active || maxYawOffset <= 0.00001) {
    entry.swordFeintTimer = 0;
    return {
      yawOffset: 0,
      attackPoseWeight: 0,
      handSwing: 0,
    };
  }

  entry.swordFeintTimer =
    (entry.swordFeintTimer + delta) % MOCHI_GENERAL_SWORD_FEINT_INTERVAL;
  const reverseMaxYawOffset =
    maxYawOffset * MOCHI_GENERAL_SWORD_FEINT_REVERSE_MULTIPLIER;
  const reverseEnd = MOCHI_GENERAL_SWORD_FEINT_REVERSE_DURATION;
  const forwardEnd = reverseEnd + MOCHI_GENERAL_SWORD_FEINT_FORWARD_DURATION;
  const holdEnd = forwardEnd + MOCHI_GENERAL_SWORD_FEINT_HOLD_DURATION;
  const recoverEnd = holdEnd + MOCHI_GENERAL_SWORD_FEINT_RECOVER_DURATION;
  const t = entry.swordFeintTimer;

  if (t <= reverseEnd) {
    const phase = THREE.MathUtils.smoothstep(
      t / Math.max(0.00001, MOCHI_GENERAL_SWORD_FEINT_REVERSE_DURATION),
      0,
      1
    );
    return {
      yawOffset: THREE.MathUtils.lerp(0, -reverseMaxYawOffset, phase),
      attackPoseWeight: 0,
      handSwing: THREE.MathUtils.lerp(0, -1, phase),
    };
  }

  if (t <= forwardEnd) {
    const phase = THREE.MathUtils.smoothstep(
      (t - reverseEnd) / Math.max(0.00001, MOCHI_GENERAL_SWORD_FEINT_FORWARD_DURATION),
      0,
      1
    );
    return {
      yawOffset: THREE.MathUtils.lerp(-reverseMaxYawOffset, maxYawOffset, phase),
      attackPoseWeight: phase,
      handSwing: THREE.MathUtils.lerp(-1, 1, phase),
    };
  }

  if (t <= holdEnd) {
    return {
      yawOffset: maxYawOffset,
      attackPoseWeight: 1,
      handSwing: 1,
    };
  }

  if (t <= recoverEnd) {
    const phase = THREE.MathUtils.smoothstep(
      (t - holdEnd) / Math.max(0.00001, MOCHI_GENERAL_SWORD_FEINT_RECOVER_DURATION),
      0,
      1
    );
    return {
      yawOffset: THREE.MathUtils.lerp(maxYawOffset, 0, phase),
      attackPoseWeight: 1 - phase,
      handSwing: THREE.MathUtils.lerp(1, 0, phase),
    };
  }

  return {
    yawOffset: 0,
    attackPoseWeight: 0,
    handSwing: 0,
  };
};

const faceBossTowardPlayer = (
  entry: MochiGeneralCombatEntry,
  player: THREE.Object3D,
  attackRange: number,
  delta: number
) => {
  player.getWorldPosition(moveTargetPosition);
  const dx = moveTargetPosition.x - entry.anchor.position.x;
  const dz = moveTargetPosition.z - entry.anchor.position.z;
  const horizontalDistance = Math.hypot(dx, dz);
  if (horizontalDistance <= 0.00001) {
    entry.swordAttackPoseWeight = 0;
    entry.swordHandSwing = 0;
    return;
  }

  const baseYaw = Math.atan2(dx, dz);
  const swordFrontStartDistance = attackRange + MOCHI_GENERAL_SWORD_FRONT_EXTRA_RANGE;
  const swordFrontWeight = THREE.MathUtils.clamp(
    (swordFrontStartDistance - horizontalDistance) /
      MOCHI_GENERAL_SWORD_FRONT_BLEND_DISTANCE,
    0,
    1
  );
  const swordFrontYawOffset =
    MOCHI_GENERAL_SWORD_FRONT_MAX_YAW_OFFSET * swordFrontWeight;
  const swordFeintMotion = sampleSwordFeintMotion(
    entry,
    delta,
    MOCHI_GENERAL_SWORD_FEINT_MAX_YAW_OFFSET * swordFrontWeight,
    swordFrontWeight > 0.35
  );
  entry.swordAttackPoseWeight =
    swordFeintMotion.attackPoseWeight * swordFrontWeight;
  entry.swordHandSwing = swordFeintMotion.handSwing * swordFrontWeight;

  // Shift yaw at close range so the sword-side stance becomes the frontal pose.
  entry.anchor.rotation.y =
    baseYaw + swordFrontYawOffset + swordFeintMotion.yawOffset;
};

const applySwordAttackPose = (entry: MochiGeneralCombatEntry) => {
  const rig = entry.rig;
  if (!rig?.sword || !rig.armLeft) return;

  const swordAttackPoseWeight = THREE.MathUtils.clamp(
    entry.swordAttackPoseWeight,
    0,
    1
  );
  rig.sword.quaternion.copy(rig.swordBaseQuat);
  if (swordAttackPoseWeight <= 0.00001) return;

  entry.anchor.updateWorldMatrix(true, false);
  rig.armLeft.getWorldQuaternion(swordParentWorldRotation);
  swordParentWorldRotationInverse.copy(swordParentWorldRotation).invert();

  entry.anchor.getWorldQuaternion(anchorWorldRotation);
  anchorForwardWorld.set(0, 0, 1).applyQuaternion(anchorWorldRotation).normalize();
  swordDesiredDirectionLocal
    .copy(anchorForwardWorld)
    .applyQuaternion(swordParentWorldRotationInverse);
  if (swordDesiredDirectionLocal.lengthSq() <= 0.00001) return;
  swordDesiredDirectionLocal.normalize();

  swordBaseAxisInParent
    .copy(rig.swordBladeAxisLocal)
    .applyQuaternion(rig.swordBaseQuat);
  if (swordBaseAxisInParent.lengthSq() <= 0.00001) return;
  swordBaseAxisInParent.normalize();

  swordRotationDelta.setFromUnitVectors(
    swordBaseAxisInParent,
    swordDesiredDirectionLocal
  );
  swordTargetRotation.copy(rig.swordBaseQuat).premultiply(swordRotationDelta);
  rig.sword.quaternion.slerp(swordTargetRotation, swordAttackPoseWeight);
};

const stabilizePauldronAnchor = ({
  arm,
  armBasePos,
  armBaseQuat,
  pauldron,
  pauldronBasePos,
}: {
  arm: THREE.Object3D | null;
  armBasePos: THREE.Vector3;
  armBaseQuat: THREE.Quaternion;
  pauldron: THREE.Object3D | null;
  pauldronBasePos: THREE.Vector3 | null;
}) => {
  if (!arm) return;

  if (!pauldron || !pauldronBasePos) {
    arm.position.copy(armBasePos);
    return;
  }

  // Keep pauldron at a fixed relative anchor point; allow rotation only.
  pauldron.position.copy(pauldronBasePos);

  armBaseInverseRotation.copy(armBaseQuat).invert();
  armDeltaRotation.copy(arm.quaternion).multiply(armBaseInverseRotation);
  rotatedPauldronOffset.copy(pauldronBasePos).applyQuaternion(armDeltaRotation);
  pauldronAnchorCompensation.copy(pauldronBasePos).sub(rotatedPauldronOffset);
  arm.position.copy(armBasePos).add(pauldronAnchorCompensation);
};

const applyBossAnimation = (
  entry: MochiGeneralCombatEntry,
  delta: number,
  isMoving: boolean
) => {
  const targetBlend = isMoving ? 1 : 0;
  entry.walkBlend = THREE.MathUtils.damp(entry.walkBlend, targetBlend, 8.5, delta);
  entry.walkPhase += delta * (2.4 + entry.walkBlend * 6.8);

  const stride = Math.sin(entry.walkPhase) * 0.72 * entry.walkBlend;
  const strideAbs = Math.abs(Math.sin(entry.walkPhase)) * entry.walkBlend;
  const commandSway = Math.sin(entry.walkPhase * 0.5) * 0.1 * entry.walkBlend;
  const commandLean = -0.16 * entry.walkBlend;
  const swordAttackPose = THREE.MathUtils.clamp(entry.swordAttackPoseWeight, 0, 1);
  const swordHandSwing = THREE.MathUtils.clamp(entry.swordHandSwing, -1, 1);

  if (!entry.model || !entry.rig) {
    entry.fallback.position.y = 2.745;
    entry.fallback.rotation.x = stride * 0.74;
    entry.fallback.rotation.y = commandSway * 0.16;
    entry.fallback.rotation.z = 0;
    return;
  }

  const rig = entry.rig;
  if (rig.body) {
    rig.body.position.y = rig.bodyBaseY;
    rig.body.rotation.y = rig.bodyBaseRotY + commandSway * 0.14;
    rig.body.rotation.x = rig.bodyBaseRotX + commandLean;
    rig.body.rotation.z = rig.bodyBaseRotZ + commandSway * 0.32;
  }
  if (rig.armRight) {
    rig.armRight.rotation.x = rig.armRightBaseX + stride * 0.96;
    rig.armRight.rotation.y = rig.armRightBaseY + commandSway * 0.2;
    rig.armRight.rotation.z = rig.armRightBaseZ + stride * 0.24;
  }
  if (rig.armLeft) {
    const armLeftDefaultX = rig.armLeftBaseX - stride * 0.3;
    const armLeftDefaultY = rig.armLeftBaseY + commandSway * 0.16;
    const armLeftDefaultZ = rig.armLeftBaseZ - stride * 0.28;
    const armLeftAttackX = rig.armLeftBaseX - 0.22;
    const armLeftAttackY = rig.armLeftBaseY - 0.62;
    const armLeftAttackZ = rig.armLeftBaseZ - 0.08;
    rig.armLeft.rotation.x = THREE.MathUtils.lerp(
      armLeftDefaultX,
      armLeftAttackX,
      swordAttackPose
    );
    rig.armLeft.rotation.y = THREE.MathUtils.lerp(
      armLeftDefaultY,
      armLeftAttackY,
      swordAttackPose
    );
    rig.armLeft.rotation.z = THREE.MathUtils.lerp(
      armLeftDefaultZ,
      armLeftAttackZ,
      swordAttackPose
    );
  }
  if (rig.leftForeArm) {
    rig.leftForeArm.rotation.x = THREE.MathUtils.lerp(
      rig.leftForeArmBaseX,
      rig.leftForeArmBaseX - 0.24,
      swordAttackPose
    );
    rig.leftForeArm.rotation.y = THREE.MathUtils.lerp(
      rig.leftForeArmBaseY,
      rig.leftForeArmBaseY - 0.26,
      swordAttackPose
    );
    rig.leftForeArm.rotation.z = THREE.MathUtils.lerp(
      rig.leftForeArmBaseZ,
      rig.leftForeArmBaseZ - 0.12,
      swordAttackPose
    );
  }
  if (rig.leftHand) {
    const amplifiedHandSwing =
      swordHandSwing * MOCHI_GENERAL_SWORD_HAND_SWING_MULTIPLIER;
    const handAttackX = rig.leftHandBaseX - 0.08 + amplifiedHandSwing * 0.18;
    const handAttackY = rig.leftHandBaseY + 0.18 + amplifiedHandSwing * 0.34;
    const handAttackZ =
      rig.leftHandBaseZ -
      Math.abs(amplifiedHandSwing) * 0.22 +
      amplifiedHandSwing * 0.06;
    rig.leftHand.rotation.x = THREE.MathUtils.lerp(
      rig.leftHandBaseX,
      handAttackX,
      swordAttackPose
    );
    rig.leftHand.rotation.y = THREE.MathUtils.lerp(
      rig.leftHandBaseY,
      handAttackY,
      swordAttackPose
    );
    rig.leftHand.rotation.z = THREE.MathUtils.lerp(
      rig.leftHandBaseZ,
      handAttackZ,
      swordAttackPose
    );
  }
  if (rig.head) {
    if (rig.headPivot) {
      rig.headPivot.rotation.x =
        rig.headPivotBaseX + entry.headLookPitch + commandLean * 0.08;
      rig.headPivot.rotation.y = rig.headPivotBaseY + entry.headLookYaw;
      rig.headPivot.rotation.z = rig.headPivotBaseZ;
    } else {
      rig.head.rotation.x = rig.headBaseX + entry.headLookPitch + commandLean * 0.08;
      rig.head.rotation.y = rig.headBaseY + entry.headLookYaw;
      rig.head.rotation.z = rig.headBaseZ;
    }
  }
  if (rig.legLeft) {
    rig.legLeft.rotation.x = rig.legLeftBaseX + stride + strideAbs * 0.26;
  }
  if (rig.legRight) {
    rig.legRight.rotation.x = rig.legRightBaseX - stride + strideAbs * 0.26;
  }

  applySwordAttackPose(entry);

  stabilizePauldronAnchor({
    arm: rig.armLeft,
    armBasePos: rig.armLeftBasePos,
    armBaseQuat: rig.armLeftBaseQuat,
    pauldron: rig.leftPauldron,
    pauldronBasePos: rig.leftPauldronBasePos,
  });
  stabilizePauldronAnchor({
    arm: rig.armRight,
    armBasePos: rig.armRightBasePos,
    armBaseQuat: rig.armRightBaseQuat,
    pauldron: rig.rightPauldron,
    pauldronBasePos: rig.rightPauldronBasePos,
  });
};

export const tickMochiGeneralCombat = ({
  entry,
  delta,
  player,
  gameEnded,
  isBlocked,
}: {
  entry: MochiGeneralCombatEntry;
  delta: number;
  player: THREE.Object3D;
  gameEnded: boolean;
  isBlocked: (x: number, z: number) => boolean;
}) => {
  let isMoving = false;
  const attackRange = Math.max(3.2, entry.monster.stats.attackRange + 0.7);
  let distance = entry.monster.distanceTo(player);
  const trackingActive = !gameEnded && distance <= MOCHI_GENERAL_TRACK_RANGE;

  if (trackingActive) {
    if (distance > attackRange) {
      const movedDistance = moveBossTowardPlayer(entry, player, delta, isBlocked);
      isMoving = movedDistance > 0.0001;
      distance = entry.monster.distanceTo(player);
    }

    faceBossTowardPlayer(entry, player, attackRange, delta);
  } else {
    entry.swordFeintTimer = 0;
    entry.swordAttackPoseWeight = 0;
    entry.swordHandSwing = 0;
  }

  updateBossHeadLook(entry, player, delta, trackingActive);
  applyBossAnimation(entry, delta, isMoving);
};
