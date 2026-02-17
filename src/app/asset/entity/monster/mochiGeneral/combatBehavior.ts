import * as THREE from "three";
import type { Monster } from "../general";

export type MochiGeneralRig = {
  body: THREE.Object3D | null;
  armLeft: THREE.Object3D | null;
  armRight: THREE.Object3D | null;
  sword: THREE.Object3D | null;
  swordTip: THREE.Object3D | null;
  heldMochi: THREE.Object3D | null;
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
  swordFeintLocked: boolean;
  swordFeintLockWeight: number;
  swordAttackPoseWeight: number;
  swordHandSwing: number;
  skill1CooldownRemaining: number;
  skill1Casting: boolean;
  skill1CastTimer: number;
  skill1CastBlend: number;
  skill1ProjectileBurstFired: boolean;
  skill1ProjectileBurstRequested: boolean;
  skill1ProjectileBurstPendingCount: number;
  skill1BurstCountFired: number;
  skill1NextBurstAt: number;
  skill2CooldownRemaining: number;
  skill2WindupActive: boolean;
  skill2WindupTimer: number;
  skill2WindupBlend: number;
  skill2ThrowRequested: boolean;
  skill2ProjectileActive: boolean;
  rig: MochiGeneralRig | null;
};

const MOCHI_GENERAL_TRACK_RANGE = 200;
const MOCHI_GENERAL_SWORD_FRONT_MAX_YAW_OFFSET = 0.72;
const MOCHI_GENERAL_SWORD_FRONT_EXTRA_RANGE = 1.2;
const MOCHI_GENERAL_SWORD_FRONT_BLEND_DISTANCE = 1.25;
const MOCHI_GENERAL_SWORD_FEINT_MAX_YAW_OFFSET = 0.28;
const MOCHI_GENERAL_SWORD_FEINT_REVERSE_MULTIPLIER = 3;
const MOCHI_GENERAL_SWORD_FEINT_REVERSE_AMPLITUDE_MULTIPLIER = 2;
const MOCHI_GENERAL_SWORD_FEINT_REVERSE_DURATION =
  0.3 * MOCHI_GENERAL_SWORD_FEINT_REVERSE_MULTIPLIER;
const MOCHI_GENERAL_SWORD_FEINT_FORWARD_DURATION = 0.3 / 3;
const MOCHI_GENERAL_SWORD_FEINT_HOLD_DURATION = 0.3;
const MOCHI_GENERAL_SWORD_FEINT_RECOVER_DURATION = 0.3;
const MOCHI_GENERAL_SWORD_FEINT_IDLE_DURATION = 0.3;
const MOCHI_GENERAL_SWORD_FEINT_START_WEIGHT = 0.72;
const MOCHI_GENERAL_SWORD_HAND_SWING_MULTIPLIER = 2.5;
const MOCHI_GENERAL_SWORD_FEINT_INTERVAL =
  MOCHI_GENERAL_SWORD_FEINT_REVERSE_DURATION +
  MOCHI_GENERAL_SWORD_FEINT_FORWARD_DURATION +
  MOCHI_GENERAL_SWORD_FEINT_HOLD_DURATION +
  MOCHI_GENERAL_SWORD_FEINT_RECOVER_DURATION +
  MOCHI_GENERAL_SWORD_FEINT_IDLE_DURATION;
const MOCHI_GENERAL_SKILL1_COOLDOWN = 10;
const MOCHI_GENERAL_SKILL1_CAST_WINDUP = 1.6;
const MOCHI_GENERAL_SKILL1_BURST_COUNT = 3;
const MOCHI_GENERAL_SKILL1_BURST_INTERVAL = 0.5;
const MOCHI_GENERAL_SKILL1_CAST_RECOVER_DURATION = 0.3;
const MOCHI_GENERAL_SKILL1_CAST_DURATION =
  MOCHI_GENERAL_SKILL1_CAST_WINDUP +
  (MOCHI_GENERAL_SKILL1_BURST_COUNT - 1) * MOCHI_GENERAL_SKILL1_BURST_INTERVAL +
  MOCHI_GENERAL_SKILL1_CAST_RECOVER_DURATION;
const MOCHI_GENERAL_SKILL1_TRIGGER_CHANCE_PER_SECOND = 0.24;
const MOCHI_GENERAL_SKILL1_SIDE_TURN_DURATION = 1;
const MOCHI_GENERAL_SKILL1_SIDE_TURN_MAX_OFFSET = Math.PI * 0.25;
const MOCHI_GENERAL_SKILL1_ARM_RIGHT_X = -0.2;
const MOCHI_GENERAL_SKILL1_ARM_RIGHT_Y = -0.58;
const MOCHI_GENERAL_SKILL1_ARM_RIGHT_Z = 0.08;
const MOCHI_GENERAL_SKILL2_COOLDOWN = 10;
const MOCHI_GENERAL_SKILL2_WINDUP_DURATION = 1.7;
const MOCHI_GENERAL_SKILL2_TRIGGER_CHANCE_PER_SECOND = 0.18;
const MOCHI_GENERAL_SKILL2_ARM_RIGHT_X = -1.38;
const MOCHI_GENERAL_SKILL2_ARM_RIGHT_Y = -0.28;
const MOCHI_GENERAL_SKILL2_ARM_RIGHT_Z = 0.52;

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
const skill1HeldMochiWorld = new THREE.Vector3();
const skill1HeldMochiLocal = new THREE.Vector3();

export const createMochiGeneralCombatState = () => ({
  walkPhase: Math.random() * Math.PI * 2,
  walkBlend: 0,
  headLookYaw: 0,
  headLookPitch: 0,
  swordFeintTimer: 0,
  swordFeintLocked: false,
  swordFeintLockWeight: 0,
  swordAttackPoseWeight: 0,
  swordHandSwing: 0,
  skill1CooldownRemaining: Math.random() * 3.4,
  skill1Casting: false,
  skill1CastTimer: 0,
  skill1CastBlend: 0,
  skill1ProjectileBurstFired: false,
  skill1ProjectileBurstRequested: false,
  skill1ProjectileBurstPendingCount: 0,
  skill1BurstCountFired: 0,
  skill1NextBurstAt: MOCHI_GENERAL_SKILL1_CAST_WINDUP,
  skill2CooldownRemaining: Math.random() * 2.8,
  skill2WindupActive: false,
  skill2WindupTimer: 0,
  skill2WindupBlend: 0,
  skill2ThrowRequested: false,
  skill2ProjectileActive: false,
  rig: null as MochiGeneralRig | null,
});

export const resetMochiGeneralCombatState = (entry: MochiGeneralCombatEntry) => {
  entry.rig = null;
  entry.headLookYaw = 0;
  entry.headLookPitch = 0;
  entry.walkBlend = 0;
  entry.swordFeintTimer = 0;
  entry.swordFeintLocked = false;
  entry.swordFeintLockWeight = 0;
  entry.swordAttackPoseWeight = 0;
  entry.swordHandSwing = 0;
  entry.skill1CooldownRemaining = 0;
  entry.skill1Casting = false;
  entry.skill1CastTimer = 0;
  entry.skill1CastBlend = 0;
  entry.skill1ProjectileBurstFired = false;
  entry.skill1ProjectileBurstRequested = false;
  entry.skill1ProjectileBurstPendingCount = 0;
  entry.skill1BurstCountFired = 0;
  entry.skill1NextBurstAt = MOCHI_GENERAL_SKILL1_CAST_WINDUP;
  entry.skill2CooldownRemaining = 0;
  entry.skill2WindupActive = false;
  entry.skill2WindupTimer = 0;
  entry.skill2WindupBlend = 0;
  entry.skill2ThrowRequested = false;
  entry.skill2ProjectileActive = false;
};

export const resolveMochiGeneralRig = (
  model: THREE.Object3D
): MochiGeneralRig => {
  let body: THREE.Object3D | null = null;
  let armLeft: THREE.Object3D | null = null;
  let armRight: THREE.Object3D | null = null;
  let sword: THREE.Object3D | null = null;
  let swordTip: THREE.Object3D | null = null;
  let heldMochi: THREE.Object3D | null = null;
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
    if (!heldMochi && name.includes("heldmochi")) {
      heldMochi = child;
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
    heldMochi,
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

const sampleSwordFeintMotion = (time: number, maxYawOffset: number) => {
  if (maxYawOffset <= 0.00001) {
    return {
      yawOffset: 0,
      attackPoseWeight: 0,
      handSwing: 0,
    };
  }

  const reverseMaxYawOffset =
    maxYawOffset *
    MOCHI_GENERAL_SWORD_FEINT_REVERSE_MULTIPLIER *
    MOCHI_GENERAL_SWORD_FEINT_REVERSE_AMPLITUDE_MULTIPLIER;
  const reverseEnd = MOCHI_GENERAL_SWORD_FEINT_REVERSE_DURATION;
  const forwardEnd = reverseEnd + MOCHI_GENERAL_SWORD_FEINT_FORWARD_DURATION;
  const holdEnd = forwardEnd + MOCHI_GENERAL_SWORD_FEINT_HOLD_DURATION;
  const recoverEnd = holdEnd + MOCHI_GENERAL_SWORD_FEINT_RECOVER_DURATION;
  const t = THREE.MathUtils.clamp(time, 0, MOCHI_GENERAL_SWORD_FEINT_INTERVAL);

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

const updateBossSkill1State = ({
  entry,
  delta,
  canAttemptStart,
  forceStop,
}: {
  entry: MochiGeneralCombatEntry;
  delta: number;
  canAttemptStart: boolean;
  forceStop: boolean;
}) => {
  entry.skill1ProjectileBurstRequested = false;

  if (forceStop) {
    entry.skill1Casting = false;
    entry.skill1CastTimer = 0;
    entry.skill1CastBlend = 0;
    entry.skill1ProjectileBurstFired = false;
    entry.skill1ProjectileBurstPendingCount = 0;
    entry.skill1BurstCountFired = 0;
    entry.skill1NextBurstAt = MOCHI_GENERAL_SKILL1_CAST_WINDUP;
    return;
  }

  entry.skill1CooldownRemaining = Math.max(0, entry.skill1CooldownRemaining - delta);

  if (!entry.skill1Casting && canAttemptStart && entry.skill1CooldownRemaining <= 0) {
    const chance =
      1 - Math.exp(-MOCHI_GENERAL_SKILL1_TRIGGER_CHANCE_PER_SECOND * Math.max(0, delta));
    if (Math.random() < chance) {
      entry.skill1Casting = true;
      entry.skill1CastTimer = 0;
      entry.skill1CastBlend = 0;
      entry.skill1ProjectileBurstFired = false;
      entry.skill1ProjectileBurstPendingCount = 0;
      entry.skill1BurstCountFired = 0;
      entry.skill1NextBurstAt = MOCHI_GENERAL_SKILL1_CAST_WINDUP;
      entry.skill1CooldownRemaining = MOCHI_GENERAL_SKILL1_COOLDOWN;
    }
  }

  if (!entry.skill1Casting) {
    entry.skill1CastTimer = 0;
    entry.skill1CastBlend = 0;
    entry.skill1ProjectileBurstFired = false;
    entry.skill1ProjectileBurstPendingCount = 0;
    entry.skill1BurstCountFired = 0;
    entry.skill1NextBurstAt = MOCHI_GENERAL_SKILL1_CAST_WINDUP;
    return;
  }

  entry.skill1CastTimer += delta;
  const windupBlend = THREE.MathUtils.clamp(
    entry.skill1CastTimer / Math.max(0.00001, MOCHI_GENERAL_SKILL1_CAST_WINDUP),
    0,
    1
  );
  const recoverBlend = THREE.MathUtils.clamp(
    (MOCHI_GENERAL_SKILL1_CAST_DURATION - entry.skill1CastTimer) / 0.2,
    0,
    1
  );
  entry.skill1CastBlend = Math.min(windupBlend, recoverBlend);

  while (
    entry.skill1BurstCountFired < MOCHI_GENERAL_SKILL1_BURST_COUNT &&
    entry.skill1CastTimer >= entry.skill1NextBurstAt
  ) {
    entry.skill1ProjectileBurstFired = true;
    entry.skill1ProjectileBurstRequested = true;
    entry.skill1ProjectileBurstPendingCount += 1;
    entry.skill1BurstCountFired += 1;
    entry.skill1NextBurstAt += MOCHI_GENERAL_SKILL1_BURST_INTERVAL;
  }

  if (entry.skill1CastTimer >= MOCHI_GENERAL_SKILL1_CAST_DURATION) {
    entry.skill1Casting = false;
    entry.skill1CastTimer = 0;
    entry.skill1CastBlend = 0;
    entry.skill1ProjectileBurstFired = false;
    entry.skill1ProjectileBurstRequested = false;
    entry.skill1ProjectileBurstPendingCount = 0;
    entry.skill1BurstCountFired = 0;
    entry.skill1NextBurstAt = MOCHI_GENERAL_SKILL1_CAST_WINDUP;
  }
};

const updateBossSkill2State = ({
  entry,
  delta,
  canAttemptStart,
  forceStop,
}: {
  entry: MochiGeneralCombatEntry;
  delta: number;
  canAttemptStart: boolean;
  forceStop: boolean;
}) => {
  entry.skill2ThrowRequested = false;

  if (forceStop) {
    entry.skill2WindupActive = false;
    entry.skill2WindupTimer = 0;
    entry.skill2WindupBlend = 0;
    entry.skill2CooldownRemaining = 0;
    return;
  }

  entry.skill2CooldownRemaining = Math.max(0, entry.skill2CooldownRemaining - delta);

  if (
    !entry.skill2WindupActive &&
    !entry.skill2ProjectileActive &&
    canAttemptStart &&
    entry.skill2CooldownRemaining <= 0
  ) {
    const chance =
      1 - Math.exp(-MOCHI_GENERAL_SKILL2_TRIGGER_CHANCE_PER_SECOND * Math.max(0, delta));
    if (Math.random() < chance) {
      entry.skill2WindupActive = true;
      entry.skill2WindupTimer = 0;
      entry.skill2CooldownRemaining = MOCHI_GENERAL_SKILL2_COOLDOWN;
    }
  }

  if (!entry.skill2WindupActive) {
    entry.skill2WindupTimer = 0;
    entry.skill2WindupBlend = THREE.MathUtils.damp(
      entry.skill2WindupBlend,
      0,
      15,
      delta
    );
    return;
  }

  entry.skill2WindupTimer += delta;
  const rawWindupBlend = THREE.MathUtils.clamp(
    entry.skill2WindupTimer / Math.max(0.00001, MOCHI_GENERAL_SKILL2_WINDUP_DURATION),
    0,
    1
  );
  entry.skill2WindupBlend = THREE.MathUtils.damp(
    entry.skill2WindupBlend,
    rawWindupBlend,
    18,
    delta
  );

  if (entry.skill2WindupTimer >= MOCHI_GENERAL_SKILL2_WINDUP_DURATION) {
    entry.skill2WindupActive = false;
    entry.skill2WindupTimer = 0;
    entry.skill2ThrowRequested = true;
    entry.skill2ProjectileActive = true;
  }
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
    entry.swordFeintTimer = 0;
    entry.swordFeintLocked = false;
    entry.swordFeintLockWeight = 0;
    entry.swordAttackPoseWeight = 0;
    entry.swordHandSwing = 0;
    return;
  }

  const baseYaw = Math.atan2(dx, dz);
  if (entry.skill1Casting) {
    entry.swordFeintTimer = 0;
    entry.swordFeintLocked = false;
    entry.swordFeintLockWeight = 0;
    entry.swordAttackPoseWeight = 0;
    entry.swordHandSwing = 0;
    let skill1Yaw = baseYaw;
    const heldMochi = entry.rig?.heldMochi;
    if (heldMochi) {
      // Face the mochi-holding side toward the player during skill 1.
      entry.anchor.updateWorldMatrix(true, false);
      heldMochi.getWorldPosition(skill1HeldMochiWorld);
      skill1HeldMochiLocal.copy(skill1HeldMochiWorld);
      entry.anchor.worldToLocal(skill1HeldMochiLocal);
      const mochiSideSign = skill1HeldMochiLocal.x >= 0 ? 1 : -1;
      const sideTurnProgress = THREE.MathUtils.clamp(
        entry.skill1CastTimer / Math.max(0.00001, MOCHI_GENERAL_SKILL1_SIDE_TURN_DURATION),
        0,
        1
      );
      skill1Yaw =
        baseYaw -
        mochiSideSign *
          MOCHI_GENERAL_SKILL1_SIDE_TURN_MAX_OFFSET *
          sideTurnProgress;
    }
    entry.anchor.rotation.y = skill1Yaw;
    return;
  }

  if (entry.skill2WindupActive) {
    entry.swordFeintTimer = 0;
    entry.swordFeintLocked = false;
    entry.swordFeintLockWeight = 0;
    entry.swordAttackPoseWeight = 0;
    entry.swordHandSwing = 0;
    entry.anchor.rotation.y = baseYaw;
    return;
  }

  const swordFrontStartDistance = attackRange + MOCHI_GENERAL_SWORD_FRONT_EXTRA_RANGE;
  const rawSwordFrontWeight = THREE.MathUtils.clamp(
    (swordFrontStartDistance - horizontalDistance) /
      MOCHI_GENERAL_SWORD_FRONT_BLEND_DISTANCE,
    0,
    1
  );

  const canStartFeint = rawSwordFrontWeight >= MOCHI_GENERAL_SWORD_FEINT_START_WEIGHT;
  if (canStartFeint && !entry.swordFeintLocked) {
    entry.swordFeintLocked = true;
    entry.swordFeintLockWeight = rawSwordFrontWeight;
    entry.swordFeintTimer = 0;
  }

  const feintWeight = entry.swordFeintLocked
    ? Math.max(MOCHI_GENERAL_SWORD_FEINT_START_WEIGHT, entry.swordFeintLockWeight)
    : rawSwordFrontWeight;
  const swordFrontYawOffset = MOCHI_GENERAL_SWORD_FRONT_MAX_YAW_OFFSET * feintWeight;

  const swordFeintMotion = entry.swordFeintLocked
    ? sampleSwordFeintMotion(
        entry.swordFeintTimer,
        MOCHI_GENERAL_SWORD_FEINT_MAX_YAW_OFFSET * feintWeight
      )
    : {
        yawOffset: 0,
        attackPoseWeight: 0,
        handSwing: 0,
      };
  entry.swordAttackPoseWeight =
    swordFeintMotion.attackPoseWeight * feintWeight;
  entry.swordHandSwing = swordFeintMotion.handSwing * feintWeight;

  if (entry.swordFeintLocked) {
    entry.swordFeintTimer += delta;
    if (entry.swordFeintTimer >= MOCHI_GENERAL_SWORD_FEINT_INTERVAL) {
      entry.swordFeintTimer = 0;
      entry.swordFeintLocked = false;
      entry.swordFeintLockWeight = 0;
    }
  } else {
    entry.swordFeintTimer = 0;
    entry.swordFeintLockWeight = 0;
  }

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
  const skill1CastPose = THREE.MathUtils.clamp(entry.skill1CastBlend, 0, 1);
  const skill2WindupPose = THREE.MathUtils.clamp(entry.skill2WindupBlend, 0, 1);

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
    const armRightDefaultX = rig.armRightBaseX + stride * 0.96;
    const armRightDefaultY = rig.armRightBaseY + commandSway * 0.2;
    const armRightDefaultZ = rig.armRightBaseZ + stride * 0.24;
    const armRightSkillX = rig.armRightBaseX + MOCHI_GENERAL_SKILL1_ARM_RIGHT_X;
    const armRightSkillY = rig.armRightBaseY + MOCHI_GENERAL_SKILL1_ARM_RIGHT_Y;
    const armRightSkillZ = rig.armRightBaseZ + MOCHI_GENERAL_SKILL1_ARM_RIGHT_Z;
    const armRightSkill2X = rig.armRightBaseX + MOCHI_GENERAL_SKILL2_ARM_RIGHT_X;
    const armRightSkill2Y = rig.armRightBaseY + MOCHI_GENERAL_SKILL2_ARM_RIGHT_Y;
    const armRightSkill2Z = rig.armRightBaseZ + MOCHI_GENERAL_SKILL2_ARM_RIGHT_Z;
    const armRightSkill1BlendedX = THREE.MathUtils.lerp(
      armRightDefaultX,
      armRightSkillX,
      skill1CastPose
    );
    const armRightSkill1BlendedY = THREE.MathUtils.lerp(
      armRightDefaultY,
      armRightSkillY,
      skill1CastPose
    );
    const armRightSkill1BlendedZ = THREE.MathUtils.lerp(
      armRightDefaultZ,
      armRightSkillZ,
      skill1CastPose
    );
    rig.armRight.rotation.x = THREE.MathUtils.lerp(
      armRightSkill1BlendedX,
      armRightSkill2X,
      skill2WindupPose
    );
    rig.armRight.rotation.y = THREE.MathUtils.lerp(
      armRightSkill1BlendedY,
      armRightSkill2Y,
      skill2WindupPose
    );
    rig.armRight.rotation.z = THREE.MathUtils.lerp(
      armRightSkill1BlendedZ,
      armRightSkill2Z,
      skill2WindupPose
    );
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
  const swordThrustInProgress =
    entry.swordFeintLocked ||
    entry.swordFeintTimer > 0.0001 ||
    entry.swordAttackPoseWeight > 0.0001;
  const chasingTarget = trackingActive && distance > attackRange;
  const skill2Busy = entry.skill2WindupActive || entry.skill2ProjectileActive;

  updateBossSkill1State({
    entry,
    delta,
    canAttemptStart: chasingTarget && !swordThrustInProgress && !skill2Busy,
    forceStop: gameEnded,
  });

  updateBossSkill2State({
    entry,
    delta,
    canAttemptStart:
      chasingTarget &&
      !swordThrustInProgress &&
      !entry.skill1Casting &&
      !entry.skill2WindupActive &&
      !entry.skill2ProjectileActive,
    forceStop: gameEnded,
  });

  if (trackingActive) {
    if (
      distance > attackRange &&
      !entry.skill1Casting &&
      !entry.skill2WindupActive &&
      !swordThrustInProgress
    ) {
      const movedDistance = moveBossTowardPlayer(entry, player, delta, isBlocked);
      isMoving = movedDistance > 0.0001;
      distance = entry.monster.distanceTo(player);
    }

    faceBossTowardPlayer(entry, player, attackRange, delta);
  } else {
    entry.swordFeintTimer = 0;
    entry.swordFeintLocked = false;
    entry.swordFeintLockWeight = 0;
    entry.swordAttackPoseWeight = 0;
    entry.swordHandSwing = 0;
  }

  updateBossHeadLook(entry, player, delta, trackingActive);
  applyBossAnimation(entry, delta, isMoving);
};
