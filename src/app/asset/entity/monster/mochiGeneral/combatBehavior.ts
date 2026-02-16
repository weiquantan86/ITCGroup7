import * as THREE from "three";
import type { Monster } from "../general";

export type MochiGeneralRig = {
  body: THREE.Object3D | null;
  armLeft: THREE.Object3D | null;
  armRight: THREE.Object3D | null;
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
  rig: MochiGeneralRig | null;
};

const MOCHI_GENERAL_TRACK_RANGE = 200;

const moveTargetPosition = new THREE.Vector3();
const headLookTargetWorld = new THREE.Vector3();
const headLookTargetLocal = new THREE.Vector3();
const headLookOriginLocal = new THREE.Vector3();
const headLookDirectionLocal = new THREE.Vector3();
const armDeltaRotation = new THREE.Quaternion();
const armBaseInverseRotation = new THREE.Quaternion();
const rotatedPauldronOffset = new THREE.Vector3();
const pauldronAnchorCompensation = new THREE.Vector3();

export const createMochiGeneralCombatState = () => ({
  walkPhase: Math.random() * Math.PI * 2,
  walkBlend: 0,
  headLookYaw: 0,
  headLookPitch: 0,
  rig: null as MochiGeneralRig | null,
});

export const resetMochiGeneralCombatState = (entry: MochiGeneralCombatEntry) => {
  entry.rig = null;
  entry.headLookYaw = 0;
  entry.headLookPitch = 0;
  entry.walkBlend = 0;
};

export const resolveMochiGeneralRig = (
  model: THREE.Object3D
): MochiGeneralRig => {
  let body: THREE.Object3D | null = null;
  let armLeft: THREE.Object3D | null = null;
  let armRight: THREE.Object3D | null = null;
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

  return {
    body,
    armLeft,
    armRight,
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
    rig.armLeft.rotation.x = rig.armLeftBaseX - stride * 0.3;
    rig.armLeft.rotation.y = rig.armLeftBaseY + commandSway * 0.16;
    rig.armLeft.rotation.z = rig.armLeftBaseZ - stride * 0.28;
  }
  if (rig.leftForeArm) {
    rig.leftForeArm.rotation.x = rig.leftForeArmBaseX;
    rig.leftForeArm.rotation.y = rig.leftForeArmBaseY;
    rig.leftForeArm.rotation.z = rig.leftForeArmBaseZ;
  }
  if (rig.leftHand) {
    rig.leftHand.rotation.x = rig.leftHandBaseX;
    rig.leftHand.rotation.y = rig.leftHandBaseY;
    rig.leftHand.rotation.z = rig.leftHandBaseZ;
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

    entry.monster.faceTarget(player);
  }

  updateBossHeadLook(entry, player, delta, trackingActive);
  applyBossAnimation(entry, delta, isMoving);
};
