import * as THREE from "three";
import { Monster } from "../general";
import { mochiGeneralCombatConfig } from "./profile";

export type MochiGeneralRig = {
  body: THREE.Object3D | null;
  armLeft: THREE.Object3D | null;
  armRight: THREE.Object3D | null;
  leftForeArm: THREE.Object3D | null;
  leftHand: THREE.Object3D | null;
  legLeft: THREE.Object3D | null;
  legRight: THREE.Object3D | null;
  head: THREE.Object3D | null;
  leftPauldron: THREE.Object3D | null;
  rightPauldron: THREE.Object3D | null;
  sword: THREE.Object3D | null;
  swordBaseQuat: THREE.Quaternion;
  swordBaseX: number;
  swordBaseY: number;
  swordBaseZ: number;
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
  lastAttackAt: number;
  attackStartedAt: number;
  attackHitApplied: boolean;
  walkPhase: number;
  walkBlend: number;
  headLookYaw: number;
  headLookPitch: number;
  rig: MochiGeneralRig | null;
  swordCollider: THREE.Mesh | null;
};

const MOCHI_GENERAL_TRACK_RANGE = 200;
const MOCHI_GENERAL_SWING_DURATION_MS = 620;
const MOCHI_GENERAL_SWING_HIT_START = 0.5;
const MOCHI_GENERAL_SWING_HIT_END = 0.84;
const MOCHI_GENERAL_SWORD_DAMAGE = 30;
const MOCHI_GENERAL_PLAYER_HIT_RADIUS = 0.68;

const playerWorldPosition = new THREE.Vector3();
const playerChestPosition = new THREE.Vector3();
const playerHeadPosition = new THREE.Vector3();
const swordColliderPosition = new THREE.Vector3();
const swordColliderScale = new THREE.Vector3();
const moveTargetPosition = new THREE.Vector3();
const headLookTargetWorld = new THREE.Vector3();
const headLookTargetLocal = new THREE.Vector3();
const headLookDirectionLocal = new THREE.Vector3();
const armDeltaRotation = new THREE.Quaternion();
const armBaseInverseRotation = new THREE.Quaternion();
const rotatedPauldronOffset = new THREE.Vector3();
const pauldronAnchorCompensation = new THREE.Vector3();
const swordForwardAxis = new THREE.Vector3(1, 0, 0);
const swordWindupDirection = new THREE.Vector3(0.86, 0.72, 0.42).normalize();
const swordFrontCenterDirection = new THREE.Vector3(0.02, 0.18, 0.98).normalize();
const swordDownOppositeDirection = new THREE.Vector3(-0.84, -0.52, 0.36).normalize();
const swordSlashDirection = new THREE.Vector3();
const swordAimQuaternion = new THREE.Quaternion();
const swordRollQuaternion = new THREE.Quaternion();
const swordTargetQuaternion = new THREE.Quaternion();

export const createMochiGeneralCombatState = () => ({
  lastAttackAt: 0,
  attackStartedAt: 0,
  attackHitApplied: false,
  walkPhase: Math.random() * Math.PI * 2,
  walkBlend: 0,
  headLookYaw: 0,
  headLookPitch: 0,
  rig: null as MochiGeneralRig | null,
  swordCollider: null as THREE.Mesh | null,
});

export const resetMochiGeneralCombatState = (entry: MochiGeneralCombatEntry) => {
  entry.rig = null;
  entry.swordCollider = null;
  entry.attackStartedAt = 0;
  entry.attackHitApplied = false;
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
  let head: THREE.Object3D | null = null;
  let leftPauldron: THREE.Object3D | null = null;
  let rightPauldron: THREE.Object3D | null = null;
  let sword: THREE.Object3D | null = null;

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
    if (!leftPauldron && name.includes("leftpauldron")) {
      leftPauldron = child;
    }
    if (!rightPauldron && name.includes("rightpauldron")) {
      rightPauldron = child;
    }
    if (!sword && name.includes("generalsword")) {
      sword = child;
    }
  });

  return {
    body,
    armLeft,
    armRight,
    leftForeArm,
    leftHand,
    legLeft,
    legRight,
    head,
    leftPauldron,
    rightPauldron,
    sword,
    swordBaseQuat: sword?.quaternion.clone() ?? new THREE.Quaternion(),
    swordBaseX: sword?.rotation.x ?? 0,
    swordBaseY: sword?.rotation.y ?? 0,
    swordBaseZ: sword?.rotation.z ?? 0,
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
    headBaseX: head?.rotation.x ?? 0,
    headBaseY: head?.rotation.y ?? 0,
    headBaseZ: head?.rotation.z ?? 0,
    leftPauldronBasePos: leftPauldron?.position.clone() ?? null,
    rightPauldronBasePos: rightPauldron?.position.clone() ?? null,
    legLeftBaseX: legLeft?.rotation.x ?? 0,
    legRightBaseX: legRight?.rotation.x ?? 0,
  };
};

export const attachMochiGeneralSwordCollider = (
  sword: THREE.Object3D | null,
  trackMesh?: (mesh: THREE.Mesh) => void
) => {
  if (!sword) return null;
  const collider = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 1.32, 4, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  collider.name = `${sword.name || "generalSword"}-collider`;
  collider.position.set(1.05, 0, 0);
  collider.rotation.z = -Math.PI / 2;
  collider.castShadow = false;
  collider.receiveShadow = false;
  sword.add(collider);
  trackMesh?.(collider);
  return collider;
};

const getAttackProgress = (entry: MochiGeneralCombatEntry, now: number) => {
  if (entry.attackStartedAt <= 0) return -1;
  return THREE.MathUtils.clamp(
    (now - entry.attackStartedAt) / MOCHI_GENERAL_SWING_DURATION_MS,
    0,
    1
  );
};

const isAttackHitWindow = (entry: MochiGeneralCombatEntry, now: number) => {
  const progress = getAttackProgress(entry, now);
  return (
    progress >= MOCHI_GENERAL_SWING_HIT_START &&
    progress <= MOCHI_GENERAL_SWING_HIT_END
  );
};

const isSwordCollidingPlayer = (
  entry: MochiGeneralCombatEntry,
  player: THREE.Object3D
) => {
  if (!entry.swordCollider || !entry.swordCollider.parent) return false;
  entry.swordCollider.getWorldPosition(swordColliderPosition);
  entry.swordCollider.getWorldScale(swordColliderScale);

  const swordGeometry = entry.swordCollider.geometry;
  if (!swordGeometry.boundingSphere) {
    swordGeometry.computeBoundingSphere();
  }
  const swordRadius =
    (swordGeometry.boundingSphere?.radius ?? 0.8) *
    Math.max(swordColliderScale.x, swordColliderScale.y, swordColliderScale.z);
  const hitDistance = swordRadius + MOCHI_GENERAL_PLAYER_HIT_RADIUS;

  player.getWorldPosition(playerWorldPosition);
  playerChestPosition.copy(playerWorldPosition);
  playerChestPosition.y += 1.05;
  playerHeadPosition.copy(playerWorldPosition);
  playerHeadPosition.y += 1.6;

  return (
    swordColliderPosition.distanceTo(playerWorldPosition) <= hitDistance ||
    swordColliderPosition.distanceTo(playerChestPosition) <= hitDistance ||
    swordColliderPosition.distanceTo(playerHeadPosition) <= hitDistance * 0.92
  );
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
  delta: number
) => {
  if (!entry.model || !entry.rig?.head) return;
  const head = entry.rig.head;
  const headParent = head.parent;
  if (!headParent) return;

  player.getWorldPosition(headLookTargetWorld);
  headLookTargetWorld.y += 1.15;
  headLookTargetLocal.copy(headLookTargetWorld);
  headParent.worldToLocal(headLookTargetLocal);
  headLookDirectionLocal.copy(headLookTargetLocal).sub(head.position);

  const horizontal = Math.hypot(headLookDirectionLocal.x, headLookDirectionLocal.z);
  if (horizontal <= 0.00001 && Math.abs(headLookDirectionLocal.y) <= 0.00001) {
    entry.headLookYaw = THREE.MathUtils.damp(entry.headLookYaw, 0, 10, delta);
    entry.headLookPitch = THREE.MathUtils.damp(entry.headLookPitch, 0, 10, delta);
    return;
  }

  const targetYaw = THREE.MathUtils.clamp(
    Math.atan2(headLookDirectionLocal.x, headLookDirectionLocal.z),
    -0.8,
    0.8
  );
  const targetPitch = THREE.MathUtils.clamp(
    Math.atan2(-headLookDirectionLocal.y, Math.max(0.00001, horizontal)),
    -0.58,
    0.48
  );
  entry.headLookYaw = THREE.MathUtils.damp(entry.headLookYaw, targetYaw, 12, delta);
  entry.headLookPitch = THREE.MathUtils.damp(
    entry.headLookPitch,
    targetPitch,
    12,
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
  now: number,
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

  const attackProgress = getAttackProgress(entry, now);
  let slashPitch = 0;
  let slashRoll = 0;
  let slashYaw = 0;
  let bodyAttackYaw = 0;
  let rightArmStrike = 0;
  let foreArmPitch = 0;
  let foreArmYaw = 0;
  let handPitch = 0;
  let handYaw = 0;
  let swordDirectionalRoll = 0;
  let swordBlend = 0;
  if (attackProgress >= 0) {
    if (attackProgress < 0.42) {
      const windup = THREE.MathUtils.clamp(attackProgress / 0.42, 0, 1);
      const easedWindup = 1 - Math.pow(1 - windup, 3);
      slashPitch = THREE.MathUtils.lerp(0, -0.86, easedWindup);
      slashRoll = THREE.MathUtils.lerp(0, -0.58, easedWindup);
      slashYaw = THREE.MathUtils.lerp(0, 1.04, easedWindup);
      bodyAttackYaw = THREE.MathUtils.lerp(0, 0.44, easedWindup);
      rightArmStrike = THREE.MathUtils.lerp(0, 0.24, easedWindup);
      foreArmPitch = THREE.MathUtils.lerp(0, -0.42, easedWindup);
      foreArmYaw = THREE.MathUtils.lerp(0, 0.62, easedWindup);
      handPitch = THREE.MathUtils.lerp(0, -0.34, easedWindup);
      handYaw = THREE.MathUtils.lerp(0, 0.66, easedWindup);
      swordDirectionalRoll = THREE.MathUtils.lerp(0.12, -0.34, easedWindup);
      swordBlend = easedWindup;
    } else {
      const strike = THREE.MathUtils.clamp((attackProgress - 0.42) / 0.58, 0, 1);
      const easedStrike = strike * strike * strike;
      slashPitch = THREE.MathUtils.lerp(-0.86, 0.52, easedStrike);
      slashRoll = THREE.MathUtils.lerp(-0.58, 0.86, easedStrike);
      slashYaw = THREE.MathUtils.lerp(1.04, -1.18, easedStrike);
      bodyAttackYaw = THREE.MathUtils.lerp(0.44, -0.34, easedStrike);
      rightArmStrike = THREE.MathUtils.lerp(0.24, -0.2, easedStrike);
      foreArmPitch = THREE.MathUtils.lerp(-0.42, 0.74, easedStrike);
      foreArmYaw = THREE.MathUtils.lerp(0.62, -1.08, easedStrike);
      handPitch = THREE.MathUtils.lerp(-0.34, 0.44, easedStrike);
      handYaw = THREE.MathUtils.lerp(0.66, -0.96, easedStrike);
      swordDirectionalRoll = THREE.MathUtils.lerp(-0.34, 0.46, easedStrike);
      swordBlend = 1;
    }
  }

  if (!entry.model || !entry.rig) {
    entry.fallback.position.y = 2.745;
    entry.fallback.rotation.x = stride * 0.74 + slashPitch * 0.48;
    entry.fallback.rotation.y = slashYaw * 0.24 + commandSway * 0.16;
    entry.fallback.rotation.z = slashRoll * 0.32;
    return;
  }

  const rig = entry.rig;
  if (rig.body) {
    rig.body.position.y = rig.bodyBaseY;
    rig.body.rotation.y = rig.bodyBaseRotY + bodyAttackYaw + commandSway * 0.14;
    rig.body.rotation.x = rig.bodyBaseRotX + commandLean;
    rig.body.rotation.z = rig.bodyBaseRotZ + commandSway * 0.32;
  }
  if (rig.armRight) {
    rig.armRight.rotation.x = rig.armRightBaseX + stride * 0.96 + rightArmStrike;
    rig.armRight.rotation.y = rig.armRightBaseY + commandSway * 0.2;
    rig.armRight.rotation.z = rig.armRightBaseZ + stride * 0.24 - slashRoll * 0.2;
  }
  if (rig.armLeft) {
    rig.armLeft.rotation.x = rig.armLeftBaseX - stride * 0.3 + slashPitch;
    rig.armLeft.rotation.y = rig.armLeftBaseY + slashYaw * 0.65 + commandSway * 0.16;
    rig.armLeft.rotation.z = rig.armLeftBaseZ - stride * 0.28 + slashRoll;
  }
  if (rig.leftForeArm) {
    rig.leftForeArm.rotation.x = rig.leftForeArmBaseX + foreArmPitch;
    rig.leftForeArm.rotation.y = rig.leftForeArmBaseY + foreArmYaw;
    rig.leftForeArm.rotation.z = rig.leftForeArmBaseZ + slashRoll * 0.22;
  }
  if (rig.leftHand) {
    rig.leftHand.rotation.x = rig.leftHandBaseX + handPitch;
    rig.leftHand.rotation.y = rig.leftHandBaseY + handYaw;
    rig.leftHand.rotation.z = rig.leftHandBaseZ + slashRoll * 0.16;
  }
  if (rig.sword) {
    if (attackProgress < 0) {
      rig.sword.quaternion.copy(rig.swordBaseQuat);
    } else if (attackProgress < 0.42) {
      const windup = THREE.MathUtils.clamp(attackProgress / 0.42, 0, 1);
      const easedWindup = 1 - Math.pow(1 - windup, 3);
      swordSlashDirection
        .copy(swordFrontCenterDirection)
        .lerp(swordWindupDirection, easedWindup)
        .normalize();
      swordAimQuaternion.setFromUnitVectors(swordForwardAxis, swordSlashDirection);
      swordRollQuaternion.setFromAxisAngle(swordSlashDirection, swordDirectionalRoll);
      swordTargetQuaternion.copy(swordRollQuaternion).multiply(swordAimQuaternion);
      rig.sword.quaternion
        .copy(rig.swordBaseQuat)
        .slerp(swordTargetQuaternion, swordBlend);
    } else {
      const strike = THREE.MathUtils.clamp((attackProgress - 0.42) / 0.58, 0, 1);
      const easedStrike = strike * strike * strike;
      if (easedStrike < 0.48) {
        const throughFront = easedStrike / 0.48;
        swordSlashDirection
          .copy(swordWindupDirection)
          .lerp(swordFrontCenterDirection, throughFront)
          .normalize();
      } else {
        const toOppositeDown = (easedStrike - 0.48) / 0.52;
        swordSlashDirection
          .copy(swordFrontCenterDirection)
          .lerp(swordDownOppositeDirection, toOppositeDown)
          .normalize();
      }
      swordAimQuaternion.setFromUnitVectors(swordForwardAxis, swordSlashDirection);
      swordRollQuaternion.setFromAxisAngle(swordSlashDirection, swordDirectionalRoll);
      swordTargetQuaternion.copy(swordRollQuaternion).multiply(swordAimQuaternion);
      rig.sword.quaternion
        .copy(rig.swordBaseQuat)
        .slerp(swordTargetQuaternion, swordBlend);
    }
  }
  if (rig.head) {
    rig.head.rotation.x = rig.headBaseX + entry.headLookPitch + commandLean * 0.08;
    rig.head.rotation.y = rig.headBaseY + entry.headLookYaw + bodyAttackYaw * 0.12;
    rig.head.rotation.z = rig.headBaseZ;
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
  now,
  delta,
  player,
  gameEnded,
  isBlocked,
  applyDamage,
}: {
  entry: MochiGeneralCombatEntry;
  now: number;
  delta: number;
  player: THREE.Object3D;
  gameEnded: boolean;
  isBlocked: (x: number, z: number) => boolean;
  applyDamage: (amount: number) => number;
}) => {
  updateBossHeadLook(entry, player, delta);

  let isMoving = false;
  const attackRange = Math.max(3.2, entry.monster.stats.attackRange + 0.7);
  let distance = entry.monster.distanceTo(player);

  if (!gameEnded && distance <= MOCHI_GENERAL_TRACK_RANGE) {
    if (distance > attackRange) {
      const movedDistance = moveBossTowardPlayer(entry, player, delta, isBlocked);
      isMoving = movedDistance > 0.0001;
      distance = entry.monster.distanceTo(player);
    }

    entry.monster.faceTarget(player);

    const isSwinging =
      entry.attackStartedAt > 0 &&
      now - entry.attackStartedAt < MOCHI_GENERAL_SWING_DURATION_MS;
    if (
      distance <= attackRange &&
      !isSwinging &&
      now - entry.lastAttackAt >= mochiGeneralCombatConfig.attackCooldownMs
    ) {
      entry.attackStartedAt = now;
      entry.lastAttackAt = now;
      entry.attackHitApplied = false;
    }

    if (
      entry.attackStartedAt > 0 &&
      !entry.attackHitApplied &&
      isAttackHitWindow(entry, now) &&
      isSwordCollidingPlayer(entry, player)
    ) {
      applyDamage(MOCHI_GENERAL_SWORD_DAMAGE);
      entry.attackHitApplied = true;
    }
  }

  if (
    entry.attackStartedAt > 0 &&
    now - entry.attackStartedAt >= MOCHI_GENERAL_SWING_DURATION_MS
  ) {
    entry.attackStartedAt = 0;
    entry.attackHitApplied = false;
  }

  applyBossAnimation(entry, now, delta, isMoving);
};
