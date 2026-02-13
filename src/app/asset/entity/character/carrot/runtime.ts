import * as THREE from "three";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import type { CharacterRuntimeFactory } from "../general/types";
import { createCarrotPhantomModifier } from "./phantomModifier";
import { profile } from "./profile";

type PunchPhase = "idle" | "charging" | "outbound" | "inbound" | "failedReturn";

type FingerRootState = {
  node: THREE.Object3D;
  baseX: number;
  baseY: number;
  baseZ: number;
};

type FingerPivotState = {
  node: THREE.Object3D;
  baseZ: number;
};

type ChargeHud = {
  setVisible: (visible: boolean) => void;
  setRatio: (ratio: number) => void;
  dispose: () => void;
};

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);
const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

const createCarrotChargeHud = (mount?: HTMLElement): ChargeHud => {
  if (!mount) {
    return {
      setVisible: () => {},
      setRatio: () => {},
      dispose: () => {},
    };
  }

  const hudHost = mount.parentElement ?? mount;
  if (!hudHost.style.position) {
    hudHost.style.position = "relative";
  }

  const hud = document.createElement("div");
  hud.style.cssText =
    "position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);" +
    "width:220px;height:140px;pointer-events:none;opacity:0;" +
    "transition:opacity 140ms ease;z-index:6;";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 220 140");
  svg.setAttribute("width", "220");
  svg.setAttribute("height", "140");

  const track = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const fill = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const arcPath = "M40 114 A70 70 0 0 1 180 114";
  track.setAttribute("d", arcPath);
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "rgba(148,163,184,0.32)");
  track.setAttribute("stroke-width", "11");
  track.setAttribute("stroke-linecap", "round");
  fill.setAttribute("d", arcPath);
  fill.setAttribute("fill", "none");
  fill.setAttribute("stroke", "#7c3aed");
  fill.setAttribute("stroke-width", "11");
  fill.setAttribute("stroke-linecap", "round");
  fill.setAttribute("style", "filter:drop-shadow(0 0 10px rgba(124,58,237,0.66));");

  const eyeOuter = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  eyeOuter.setAttribute("cx", "110");
  eyeOuter.setAttribute("cy", "90");
  eyeOuter.setAttribute("rx", "42");
  eyeOuter.setAttribute("ry", "20");
  eyeOuter.setAttribute("fill", "rgba(8,10,18,0.9)");
  eyeOuter.setAttribute("stroke", "rgba(167,139,250,0.92)");
  eyeOuter.setAttribute("stroke-width", "4");

  const eyeCore = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  eyeCore.setAttribute("cx", "110");
  eyeCore.setAttribute("cy", "90");
  eyeCore.setAttribute("r", "9");
  eyeCore.setAttribute("fill", "#4c1d95");

  const eyeShine = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  eyeShine.setAttribute("cx", "114");
  eyeShine.setAttribute("cy", "86");
  eyeShine.setAttribute("r", "3");
  eyeShine.setAttribute("fill", "rgba(243,232,255,0.95)");

  svg.appendChild(track);
  svg.appendChild(fill);
  svg.appendChild(eyeOuter);
  svg.appendChild(eyeCore);
  svg.appendChild(eyeShine);
  hud.appendChild(svg);
  hudHost.appendChild(hud);

  let arcLength = 0;
  const setRatio = (ratio: number) => {
    if (!arcLength) {
      arcLength = fill.getTotalLength();
      fill.style.strokeDasharray = `${arcLength}`;
    }
    const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
    fill.style.strokeDashoffset = `${arcLength * (1 - clamped)}`;
    eyeCore.setAttribute("r", `${9 + clamped * 3.5}`);
    eyeShine.setAttribute("cx", `${114 + clamped * 1.2}`);
  };

  const setVisible = (visible: boolean) => {
    hud.style.opacity = visible ? "1" : "0";
  };

  setRatio(0);

  return {
    setVisible,
    setRatio,
    dispose: () => {
      hud.parentElement?.removeChild(hud);
    },
  };
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  fireProjectile,
  applyHealth,
  performMeleeAttack,
  applyEnergy,
  mount,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const chargeHud = createCarrotChargeHud(mount);

  const punchConfig = {
    maxChargeMs: 1600,
    minChargeMs: 220,
    pullInMs: 180,
    failedReturnMs: 180,
    minDistance: 3.9,
    maxDistance: 11.4,
    forwardNudge: 0.35,
    minSpeed: 7.2,
    maxSpeed: 20.5,
    minDamage: 11,
    maxDamage: 29,
    hitRadius: 0.52,
  };

  const punchState = {
    phase: "idle" as PunchPhase,
    chargeStartedAt: 0,
    phaseStartedAt: 0,
    chargeRatio: 0,
    outboundDurationMs: 0,
    inboundDurationMs: 0,
    attackDistance: 0,
    hitPending: false,
    pendingCapture: false,
    currentCurl: 0,
    failedFromCurl: 0,
  };

  const armRig = {
    arm: null as THREE.Object3D | null,
    armId: "",
    hasRestPose: false,
    restPosition: new THREE.Vector3(),
    restQuaternion: new THREE.Quaternion(),
    hasCapturedBase: false,
    basePosition: new THREE.Vector3(),
    baseQuaternion: new THREE.Quaternion(),
    chargePosition: new THREE.Vector3(),
    chargeQuaternion: new THREE.Quaternion(),
    outboundPosition: new THREE.Vector3(),
    outboundQuaternion: new THREE.Quaternion(),
    failedFromPosition: new THREE.Vector3(),
    failedFromQuaternion: new THREE.Quaternion(),
    fingerRoots: [] as FingerRootState[],
    fingerPivots: [] as FingerPivotState[],
  };

  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const tempQuatX = new THREE.Quaternion();
  const tempQuatY = new THREE.Quaternion();
  const punchAimOrigin = new THREE.Vector3();
  const punchAimDirection = new THREE.Vector3();
  const punchAimParentQuaternion = new THREE.Quaternion();
  const punchAimAvatarQuaternion = new THREE.Quaternion();
  const phantomModifier = createCarrotPhantomModifier({
    avatar,
    fireProjectile,
    applyHealth,
    applyEnergy,
  });

  const resetChargeHud = () => {
    chargeHud.setVisible(false);
    chargeHud.setRatio(0);
  };

  const resetFingerPose = () => {
    for (let i = 0; i < armRig.fingerRoots.length; i += 1) {
      const finger = armRig.fingerRoots[i];
      finger.node.rotation.x = finger.baseX;
      finger.node.rotation.y = finger.baseY;
      finger.node.rotation.z = finger.baseZ;
    }
    for (let i = 0; i < armRig.fingerPivots.length; i += 1) {
      const finger = armRig.fingerPivots[i];
      finger.node.rotation.z = finger.baseZ;
    }
  };

  const applyFistCurl = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    punchState.currentCurl = clamped;

    for (let i = 0; i < armRig.fingerRoots.length; i += 1) {
      const finger = armRig.fingerRoots[i];
      finger.node.rotation.x = THREE.MathUtils.lerp(finger.baseX, finger.baseX - 0.52, clamped);
      finger.node.rotation.y = THREE.MathUtils.lerp(finger.baseY, finger.baseY + 0.12, clamped);
      finger.node.rotation.z = THREE.MathUtils.lerp(finger.baseZ, finger.baseZ + 0.1, clamped);
    }

    for (let i = 0; i < armRig.fingerPivots.length; i += 1) {
      const finger = armRig.fingerPivots[i];
      finger.node.rotation.z = THREE.MathUtils.lerp(finger.baseZ, finger.baseZ - 1.35, clamped);
    }
  };

  const attachArm = (arms: THREE.Object3D[]) => {
    if (!arms.length) {
      armRig.arm = null;
      armRig.armId = "";
      armRig.hasRestPose = false;
      armRig.hasCapturedBase = false;
      armRig.fingerRoots.length = 0;
      armRig.fingerPivots.length = 0;
      return;
    }

    const nextArm = arms.find((arm) => /right/i.test(arm.name)) ?? arms[0];
    if (!nextArm) return;
    if (armRig.armId === nextArm.uuid) return;

    armRig.arm = nextArm;
    armRig.armId = nextArm.uuid;
    armRig.hasRestPose = true;
    armRig.restPosition.copy(nextArm.position);
    armRig.restQuaternion.copy(nextArm.quaternion);
    armRig.hasCapturedBase = false;
    armRig.fingerRoots.length = 0;
    armRig.fingerPivots.length = 0;

    nextArm.traverse((child) => {
      if (/^fingerRoot\d+$/i.test(child.name)) {
        armRig.fingerRoots.push({
          node: child,
          baseX: child.rotation.x,
          baseY: child.rotation.y,
          baseZ: child.rotation.z,
        });
      }
      if (/^finger\d+Bpivot$/i.test(child.name)) {
        armRig.fingerPivots.push({
          node: child,
          baseZ: child.rotation.z,
        });
      }
    });
  };

  const captureArmChargePose = () => {
    const arm = armRig.arm;
    if (!arm) return false;

    const basePosition = armRig.hasRestPose ? armRig.restPosition : arm.position;
    const baseQuaternion = armRig.hasRestPose ? armRig.restQuaternion : arm.quaternion;

    armRig.basePosition.copy(basePosition);
    armRig.baseQuaternion.copy(baseQuaternion);

    armRig.chargePosition.copy(armRig.basePosition);
    armRig.chargePosition.x = THREE.MathUtils.lerp(armRig.basePosition.x, 0.18, 0.9);
    armRig.chargePosition.y = armRig.basePosition.y - 0.12;
    armRig.chargePosition.z = Math.max(0.72, armRig.basePosition.z + 0.5);

    tempQuatX.setFromAxisAngle(axisX, -0.58);
    tempQuatY.setFromAxisAngle(axisY, -0.06);
    armRig.chargeQuaternion
      .copy(armRig.baseQuaternion)
      .multiply(tempQuatX)
      .multiply(tempQuatY);

    armRig.outboundPosition.copy(armRig.chargePosition);
    armRig.outboundQuaternion.copy(armRig.chargeQuaternion);
    armRig.hasCapturedBase = true;
    return true;
  };

  const restoreIdlePose = () => {
    const arm = armRig.arm;
    if (!arm) return;
    if (armRig.hasCapturedBase) {
      arm.position.copy(armRig.basePosition);
      arm.quaternion.copy(armRig.baseQuaternion);
    }
    resetFingerPose();
    punchState.currentCurl = 0;
  };

  const clearPunchState = () => {
    punchState.phase = "idle";
    punchState.chargeStartedAt = 0;
    punchState.phaseStartedAt = 0;
    punchState.chargeRatio = 0;
    punchState.outboundDurationMs = 0;
    punchState.inboundDurationMs = 0;
    punchState.attackDistance = 0;
    punchState.hitPending = false;
    punchState.pendingCapture = false;
    punchState.currentCurl = 0;
    punchState.failedFromCurl = 0;
    resetChargeHud();
  };

  const failAndReturn = (now: number) => {
    const arm = armRig.arm;
    if (!arm) {
      clearPunchState();
      return;
    }
    if (!armRig.hasCapturedBase && !captureArmChargePose()) {
      clearPunchState();
      return;
    }

    armRig.failedFromPosition.copy(arm.position);
    armRig.failedFromQuaternion.copy(arm.quaternion);
    punchState.failedFromCurl = punchState.currentCurl;
    punchState.phase = "failedReturn";
    punchState.phaseStartedAt = now;
  };

  const resolvePunchMeleeAim = () => {
    const arm = armRig.arm;
    if (arm) {
      arm.updateMatrixWorld(true);
      arm.getWorldPosition(punchAimOrigin);
    } else {
      avatar.updateMatrixWorld(true);
      avatar.getWorldPosition(punchAimOrigin);
      punchAimOrigin.y += 1;
    }

    punchAimDirection.copy(armRig.outboundPosition).sub(armRig.chargePosition);
    if (punchAimDirection.lengthSq() > 0.000001) {
      const parent = arm?.parent;
      if (parent) {
        parent.updateMatrixWorld(true);
        parent.getWorldQuaternion(punchAimParentQuaternion);
        punchAimDirection.applyQuaternion(punchAimParentQuaternion);
      } else {
        avatar.updateMatrixWorld(true);
        avatar.getWorldQuaternion(punchAimAvatarQuaternion);
        punchAimDirection.applyQuaternion(punchAimAvatarQuaternion);
      }
    }

    if (punchAimDirection.lengthSq() < 0.000001) {
      avatar.updateMatrixWorld(true);
      avatar.getWorldQuaternion(punchAimAvatarQuaternion);
      punchAimDirection.set(0, 0, 1).applyQuaternion(punchAimAvatarQuaternion);
    }
    if (punchAimDirection.lengthSq() < 0.000001) {
      punchAimDirection.set(0, 0, 1);
    } else {
      punchAimDirection.normalize();
    }

    return {
      origin: punchAimOrigin,
      direction: punchAimDirection,
    };
  };

  const applyPunchMeleeHit = (
    ratio: number,
    distance: number,
    origin: THREE.Vector3,
    direction: THREE.Vector3
  ) => {
    if (!performMeleeAttack) return;
    const damage = Math.round(
      THREE.MathUtils.lerp(punchConfig.minDamage, punchConfig.maxDamage, ratio)
    );
    const hitCount = performMeleeAttack({
      damage,
      maxDistance: distance,
      hitRadius: punchConfig.hitRadius,
      maxHits: 1,
      origin,
      direction,
    });
    if (hitCount > 0) {
      applyEnergy?.(5 * hitCount);
    }
  };

  const beginCharge = () => {
    if (punchState.phase !== "idle") return;
    if (baseRuntime.isFacingLocked()) return;

    punchState.phase = "charging";
    punchState.chargeStartedAt = performance.now();
    punchState.phaseStartedAt = punchState.chargeStartedAt;
    punchState.chargeRatio = 0;
    punchState.pendingCapture = true;
    chargeHud.setVisible(true);
    chargeHud.setRatio(0);
  };

  const releaseCharge = () => {
    if (punchState.phase !== "charging") return;

    const now = performance.now();
    const elapsed = now - punchState.chargeStartedAt;
    if (elapsed < punchConfig.minChargeMs) {
      failAndReturn(now);
      return;
    }

    if (punchState.pendingCapture && !captureArmChargePose()) {
      clearPunchState();
      return;
    }

    const ratio = THREE.MathUtils.clamp(elapsed / punchConfig.maxChargeMs, 0, 1);
    const speed = THREE.MathUtils.lerp(punchConfig.minSpeed, punchConfig.maxSpeed, ratio);
    const distance = THREE.MathUtils.lerp(punchConfig.minDistance, punchConfig.maxDistance, ratio);
    const outboundDurationMs = THREE.MathUtils.clamp((distance / speed) * 1000, 90, 420);

    punchState.phase = "outbound";
    punchState.phaseStartedAt = now;
    punchState.chargeRatio = ratio;
    punchState.outboundDurationMs = outboundDurationMs;
    punchState.inboundDurationMs = THREE.MathUtils.clamp(outboundDurationMs * 0.9, 120, 430);
    punchState.attackDistance = distance + punchConfig.forwardNudge;
    punchState.hitPending = true;

    armRig.outboundPosition.copy(armRig.chargePosition).addScaledVector(
      new THREE.Vector3(0, 0, 1),
      punchState.attackDistance
    );
    tempQuatX.setFromAxisAngle(axisX, -0.08);
    armRig.outboundQuaternion.copy(armRig.chargeQuaternion).multiply(tempQuatX);
    resetChargeHud();
  };

  const cancelCharge = () => {
    if (punchState.phase === "idle") return;
    failAndReturn(performance.now());
  };

  const updatePunchPose = (now: number) => {
    const arm = armRig.arm;
    if (!arm) return;

    if (punchState.phase === "charging") {
      if (punchState.pendingCapture) {
        if (!captureArmChargePose()) return;
        punchState.pendingCapture = false;
      }
      const elapsed = now - punchState.chargeStartedAt;
      const moveInRatio = THREE.MathUtils.clamp(elapsed / punchConfig.pullInMs, 0, 1);
      const chargeRatio = THREE.MathUtils.clamp(elapsed / punchConfig.maxChargeMs, 0, 1);
      punchState.chargeRatio = chargeRatio;
      chargeHud.setVisible(true);
      chargeHud.setRatio(chargeRatio);
      const eased = easeOutCubic(moveInRatio);

      arm.position.lerpVectors(armRig.basePosition, armRig.chargePosition, eased);
      arm.quaternion.slerpQuaternions(armRig.baseQuaternion, armRig.chargeQuaternion, eased);
      applyFistCurl(THREE.MathUtils.lerp(0.62, 1, chargeRatio));
      return;
    }

    if (punchState.phase === "outbound") {
      const progress = THREE.MathUtils.clamp(
        (now - punchState.phaseStartedAt) / punchState.outboundDurationMs,
        0,
        1
      );
      const eased = easeOutCubic(progress);

      arm.position.lerpVectors(armRig.chargePosition, armRig.outboundPosition, eased);
      arm.quaternion.slerpQuaternions(armRig.chargeQuaternion, armRig.outboundQuaternion, eased);
      applyFistCurl(1);

      if (punchState.hitPending && progress >= 0.2) {
        const aim = resolvePunchMeleeAim();
        applyPunchMeleeHit(
          punchState.chargeRatio,
          punchState.attackDistance,
          aim.origin,
          aim.direction
        );
        punchState.hitPending = false;
      }

      if (progress >= 1) {
        punchState.phase = "inbound";
        punchState.phaseStartedAt = now;
      }
      return;
    }

    if (punchState.phase === "inbound") {
      const progress = THREE.MathUtils.clamp(
        (now - punchState.phaseStartedAt) / punchState.inboundDurationMs,
        0,
        1
      );
      const eased = easeInOutCubic(progress);

      arm.position.lerpVectors(armRig.outboundPosition, armRig.basePosition, eased);
      arm.quaternion.slerpQuaternions(armRig.outboundQuaternion, armRig.baseQuaternion, eased);
      applyFistCurl(1 - eased);

      if (progress >= 1) {
        restoreIdlePose();
        clearPunchState();
      }
      return;
    }

    if (punchState.phase === "failedReturn") {
      const progress = THREE.MathUtils.clamp(
        (now - punchState.phaseStartedAt) / punchConfig.failedReturnMs,
        0,
        1
      );
      const eased = easeInOutCubic(progress);

      arm.position.lerpVectors(armRig.failedFromPosition, armRig.basePosition, eased);
      arm.quaternion.slerpQuaternions(
        armRig.failedFromQuaternion,
        armRig.baseQuaternion,
        eased
      );
      applyFistCurl((1 - eased) * punchState.failedFromCurl);

      if (progress >= 1) {
        restoreIdlePose();
        clearPunchState();
      }
    }
  };

  const resetState = () => {
    clearPunchState();
    restoreIdlePose();
    phantomModifier.reset();
    baseRuntime.resetState?.();
  };

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handleRightClick: (facing) => {
      if (punchState.phase !== "idle") return;
      baseRuntime.handleRightClick(facing);
    },
    handlePrimaryDown: beginCharge,
    handlePrimaryUp: releaseCharge,
    handlePrimaryCancel: cancelCharge,
    handleSkillQ: baseRuntime.handleSkillQ,
    handleSkillE: phantomModifier.handleSkillE,
    handleSkillR: baseRuntime.handleSkillR,
    getProjectileBlockers: baseRuntime.getProjectileBlockers,
    handleProjectileBlockHit: baseRuntime.handleProjectileBlockHit,
    getMovementSpeedMultiplier: baseRuntime.getMovementSpeedMultiplier,
    isBasicAttackLocked: () => punchState.phase !== "idle",
    isMovementLocked: baseRuntime.isMovementLocked,
    getSkillCooldownRemainingMs: baseRuntime.getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs: baseRuntime.getSkillCooldownDurationMs,
    beforeSkillUse: phantomModifier.beforeSkillUse,
    beforeDamage: phantomModifier.beforeDamage,
    onTick: phantomModifier.onTick,
    resetState,
    update: (args) => {
      phantomModifier.setAimDirectionWorld(
        args.aimDirectionWorld,
        args.aimOriginWorld
      );
      baseRuntime.update(args);
      attachArm(args.arms);
      if (armRig.arm && punchState.phase === "idle" && !args.isMoving) {
        armRig.hasRestPose = true;
        armRig.restPosition.copy(armRig.arm.position);
        armRig.restQuaternion.copy(armRig.arm.quaternion);
      }
      if (!armRig.arm && punchState.phase !== "idle") {
        clearPunchState();
        return;
      }
      if (punchState.phase !== "idle") {
        updatePunchPose(args.now);
      }
    },
    dispose: () => {
      resetState();
      phantomModifier.dispose();
      chargeHud.dispose();
      baseRuntime.dispose();
    },
    isFacingLocked: baseRuntime.isFacingLocked,
  });
};




