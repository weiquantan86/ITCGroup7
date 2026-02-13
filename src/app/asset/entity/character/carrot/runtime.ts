import * as THREE from "three";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import type { CharacterRuntimeFactory } from "../general/types";
import { createCarrotPhantomModifier } from "./phantomModifier";
import { profile } from "./profile";

type PunchPhase =
  | "idle"
  | "charging"
  | "outbound"
  | "inbound"
  | "failedReturn"
  | "skillRSweep";

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

type SkillRTornadoParticleState = {
  mesh: THREE.Mesh;
  swirlOffset: number;
  swirlSpeed: number;
  riseOffset: number;
  radiusScale: number;
};

type SkillRTornadoVariant = "default" | "deep";

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
    handContactRadius: 0.64,
  };
  const skillRConfig = {
    forwardSpawnOffset: 1.25,
    verticalSpawnOffset: 1.4,
    speed: 12.9,
    lifetime: 2.8,
    damage: 34,
    radius: 1.02,
    targetHitRadius: 2.25,
    explosionRadius: 5.4,
    explosionDamage: 22,
    sweepForwardMs: 150,
    sweepReturnMs: 180,
    sweepOffsetX: -0.58,
    sweepOffsetY: 0.08,
    sweepOffsetZ: 0.46,
    sweepYaw: -1.12,
    sweepPitch: -0.2,
    deepSpreadYawOffsets: [-0.24, 0, 0.24],
    deepLaneOffsets: [-1.35, 0, 1.35],
    deepScaleMultiplier: 1.38,
    deepCollisionScale: 1.22,
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
    skillRSweepFromPosition: new THREE.Vector3(),
    skillRSweepFromQuaternion: new THREE.Quaternion(),
    skillRSweepOutPosition: new THREE.Vector3(),
    skillRSweepOutQuaternion: new THREE.Quaternion(),
    failedFromPosition: new THREE.Vector3(),
    failedFromQuaternion: new THREE.Quaternion(),
    fingerRoots: [] as FingerRootState[],
    fingerPivots: [] as FingerPivotState[],
  };

  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const tempQuatX = new THREE.Quaternion();
  const tempQuatY = new THREE.Quaternion();
  const skillRSpawnOrigin = new THREE.Vector3();
  const skillRDirection = new THREE.Vector3();
  const skillRRight = new THREE.Vector3();
  const skillRShotOrigin = new THREE.Vector3();
  const skillRShotDirection = new THREE.Vector3();
  const runtimeAimDirection = new THREE.Vector3(0, 0, 1);
  let hasRuntimeAimDirection = false;
  const skillRTornadoBaseScale = new THREE.Vector3(1.92, 1.86, 1.92);
  const skillRTornadoParticleCount = 34;
  const skillRTornadoGeometry = new THREE.ConeGeometry(1.12, 3.8, 24, 5, true);
  const skillRTornadoMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe5e7eb,
    emissiveIntensity: 0.72,
    transparent: true,
    opacity: 0.68,
    roughness: 0.32,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const skillRTornadoDeepMaterial = new THREE.MeshStandardMaterial({
    color: 0xc4b5fd,
    emissive: 0x6d28d9,
    emissiveIntensity: 1.1,
    transparent: true,
    opacity: 0.72,
    roughness: 0.26,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const skillRTornadoParticleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const skillRTornadoParticleMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xffffff,
    emissiveIntensity: 0.82,
    transparent: true,
    opacity: 0.84,
    roughness: 0.12,
    metalness: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const skillRTornadoDeepParticleMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9d5ff,
    emissive: 0xa855f7,
    emissiveIntensity: 1.18,
    transparent: true,
    opacity: 0.9,
    roughness: 0.08,
    metalness: 0.05,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
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

  const beginSkillRSweep = (now: number) => {
    const arm = armRig.arm;
    if (!arm) return;

    armRig.skillRSweepFromPosition.copy(arm.position);
    armRig.skillRSweepFromQuaternion.copy(arm.quaternion);
    armRig.skillRSweepOutPosition.copy(arm.position);
    armRig.skillRSweepOutPosition.x += skillRConfig.sweepOffsetX;
    armRig.skillRSweepOutPosition.y += skillRConfig.sweepOffsetY;
    armRig.skillRSweepOutPosition.z += skillRConfig.sweepOffsetZ;

    tempQuatY.setFromAxisAngle(axisY, skillRConfig.sweepYaw);
    tempQuatX.setFromAxisAngle(axisX, skillRConfig.sweepPitch);
    armRig.skillRSweepOutQuaternion
      .copy(arm.quaternion)
      .multiply(tempQuatY)
      .multiply(tempQuatX);

    punchState.phase = "skillRSweep";
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
    origin: THREE.Vector3,
    direction: THREE.Vector3
  ) => {
    if (!performMeleeAttack) return 0;
    const damage = Math.round(
      THREE.MathUtils.lerp(punchConfig.minDamage, punchConfig.maxDamage, ratio)
    );
    const hitCount = performMeleeAttack({
      damage,
      maxDistance: 0.1,
      hitRadius: punchConfig.hitRadius,
      maxHits: 1,
      origin,
      direction,
      contactCenter: origin,
      contactRadius: punchConfig.handContactRadius,
    });
    if (hitCount > 0) {
      applyEnergy?.(5 * hitCount);
    }
    return hitCount;
  };

  const resolveSkillRDirection = () => {
    if (hasRuntimeAimDirection) {
      skillRDirection.copy(runtimeAimDirection);
    } else {
      avatar.updateMatrixWorld(true);
      avatar.getWorldQuaternion(punchAimAvatarQuaternion);
      skillRDirection.set(0, 0, 1).applyQuaternion(punchAimAvatarQuaternion);
    }

    skillRDirection.y = 0;
    if (skillRDirection.lengthSq() < 0.000001) {
      avatar.updateMatrixWorld(true);
      avatar.getWorldQuaternion(punchAimAvatarQuaternion);
      skillRDirection.set(0, 0, 1).applyQuaternion(punchAimAvatarQuaternion);
      skillRDirection.y = 0;
    }

    if (skillRDirection.lengthSq() < 0.000001) {
      skillRDirection.set(0, 0, 1);
    } else {
      skillRDirection.normalize();
    }
    return skillRDirection;
  };

  const updateSkillRTornadoParticles = (
    particles: SkillRTornadoParticleState[],
    spinPhase: number,
    flowPhase: number
  ) => {
    const swirlDirection = -1;
    const flowDirection = -1;
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      const rawRise = (flowPhase * 0.22 + particle.riseOffset) % 1;
      const rise = flowDirection > 0 ? rawRise : 1 - rawRise;
      const radius = (0.24 + rise * 1.18) * particle.radiusScale;
      const angle =
        swirlDirection *
        (spinPhase * particle.swirlSpeed + particle.swirlOffset + rise * Math.PI * 6);
      const wobble = Math.sin(spinPhase * 1.6 + particle.swirlOffset * 2.2) * 0.05;
      particle.mesh.position.set(
        Math.cos(angle) * radius,
        THREE.MathUtils.lerp(-1.8, 1.9, rise) + wobble,
        Math.sin(angle) * radius
      );
      const shimmer = 0.72 + 0.28 * Math.sin(spinPhase * 2.1 + particle.swirlOffset * 3);
      const size = THREE.MathUtils.lerp(0.2, 0.44, rise) * shimmer;
      particle.mesh.scale.setScalar(size);
    }
  };

  const createSkillRTornadoMesh = ({
    variant = "default",
    scaleMultiplier = 1,
  }: {
    variant?: SkillRTornadoVariant;
    scaleMultiplier?: number;
  } = {}) => {
    const isDeepVariant = variant === "deep";
    const resolvedScaleMultiplier = Math.max(0.2, scaleMultiplier);
    const resolvedBaseScale = skillRTornadoBaseScale
      .clone()
      .multiplyScalar(resolvedScaleMultiplier);
    const mesh = new THREE.Mesh(
      skillRTornadoGeometry,
      isDeepVariant ? skillRTornadoDeepMaterial : skillRTornadoMaterial
    );
    mesh.scale.copy(resolvedBaseScale);
    mesh.rotation.x = Math.PI;
    mesh.rotation.y = Math.random() * Math.PI * 2;
    const particles: SkillRTornadoParticleState[] = [];

    for (let i = 0; i < skillRTornadoParticleCount; i += 1) {
      const particle = new THREE.Mesh(
        skillRTornadoParticleGeometry,
        isDeepVariant
          ? skillRTornadoDeepParticleMaterial
          : skillRTornadoParticleMaterial
      );
      particle.castShadow = false;
      particle.receiveShadow = false;
      mesh.add(particle);
      particles.push({
        mesh: particle,
        swirlOffset: (i / skillRTornadoParticleCount) * Math.PI * 2 + Math.random() * 0.45,
        swirlSpeed: THREE.MathUtils.lerp(3.8, 6.4, Math.random()),
        riseOffset: Math.random(),
        radiusScale: THREE.MathUtils.lerp(0.78, 1.22, Math.random()),
      });
    }

    return {
      mesh,
      particles,
      baseScale: resolvedBaseScale,
    };
  };

  const spawnSkillRTornadoProjectile = ({
    origin,
    direction,
    variant = "default",
    scaleMultiplier = 1,
    collisionScale = 1,
  }: {
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    variant?: SkillRTornadoVariant;
    scaleMultiplier?: number;
    collisionScale?: number;
  }) => {
    if (!fireProjectile) return;
    const isDeepVariant = variant === "deep";
    const resolvedCollisionScale = Math.max(0.2, collisionScale);
    const tornadoBuild = createSkillRTornadoMesh({
      variant,
      scaleMultiplier,
    });
    const tornadoMesh = tornadoBuild.mesh;
    const tornadoParticles = tornadoBuild.particles;
    const tornadoBaseScale = tornadoBuild.baseScale;
    let spinPhase = Math.random() * Math.PI * 2;
    let flowPhase = Math.random() * Math.PI * 2;
    updateSkillRTornadoParticles(tornadoParticles, spinPhase, flowPhase);

    fireProjectile({
      projectileType: "abilityOrb",
      origin: origin.clone(),
      direction: direction.clone(),
      mesh: tornadoMesh,
      speed: skillRConfig.speed,
      lifetime: skillRConfig.lifetime,
      damage: skillRConfig.damage,
      radius: skillRConfig.radius * resolvedCollisionScale,
      targetHitRadius: skillRConfig.targetHitRadius * resolvedCollisionScale,
      gravity: 0,
      splitOnImpact: true,
      explosionRadius: skillRConfig.explosionRadius * resolvedCollisionScale,
      explosionDamage: skillRConfig.explosionDamage,
      explosionColor: isDeepVariant ? 0xe9d5ff : 0xf8fafc,
      explosionEmissive: isDeepVariant ? 0x9333ea : 0xffffff,
      explosionEmissiveIntensity: isDeepVariant ? 1.34 : 1.08,
      explodeOnExpire: true,
      energyGainOnHit: 0,
      lifecycle: {
        applyForces: ({ delta, velocity }) => {
          flowPhase += delta * (isDeepVariant ? 2.35 : 2);
          spinPhase += delta * 8.5;
          tornadoMesh.rotation.y += delta * 7.8;
          tornadoMesh.rotation.z = Math.sin(spinPhase * 0.7) * (isDeepVariant ? 0.16 : 0.12);
          const pulse = 1 + Math.sin(spinPhase * 1.9) * (isDeepVariant ? 0.13 : 0.1);
          tornadoMesh.scale.set(
            tornadoBaseScale.x * pulse,
            tornadoBaseScale.y,
            tornadoBaseScale.z * pulse
          );
          updateSkillRTornadoParticles(tornadoParticles, spinPhase, flowPhase);
          velocity.y = THREE.MathUtils.lerp(velocity.y, 0, Math.min(1, delta * 7));
        },
        onRemove: () => {
          tornadoMesh.rotation.set(Math.PI, 0, 0);
          tornadoMesh.scale.copy(tornadoBaseScale);
        },
      },
    });
  };

  const handleSkillR = () => {
    if (!fireProjectile) return false;
    if (punchState.phase !== "idle") return false;
    const now = performance.now();

    avatar.updateMatrixWorld(true);
    avatar.getWorldPosition(skillRSpawnOrigin);
    const direction = resolveSkillRDirection();

    skillRSpawnOrigin.addScaledVector(direction, skillRConfig.forwardSpawnOffset);
    skillRSpawnOrigin.y += skillRConfig.verticalSpawnOffset;

    if (phantomModifier.isDeepPhaseActive(now)) {
      skillRRight.crossVectors(axisY, direction);
      if (skillRRight.lengthSq() < 0.000001) {
        skillRRight.set(1, 0, 0);
      } else {
        skillRRight.normalize();
      }

      const castCount = Math.min(
        skillRConfig.deepSpreadYawOffsets.length,
        skillRConfig.deepLaneOffsets.length
      );
      for (let i = 0; i < castCount; i += 1) {
        const yawOffset = skillRConfig.deepSpreadYawOffsets[i] ?? 0;
        const laneOffset = skillRConfig.deepLaneOffsets[i] ?? 0;

        skillRShotDirection.copy(direction).applyAxisAngle(axisY, yawOffset);
        if (skillRShotDirection.lengthSq() < 0.000001) {
          skillRShotDirection.copy(direction);
        } else {
          skillRShotDirection.normalize();
        }
        skillRShotOrigin.copy(skillRSpawnOrigin).addScaledVector(skillRRight, laneOffset);

        spawnSkillRTornadoProjectile({
          origin: skillRShotOrigin,
          direction: skillRShotDirection,
          variant: "deep",
          scaleMultiplier: skillRConfig.deepScaleMultiplier,
          collisionScale: skillRConfig.deepCollisionScale,
        });
      }
    } else {
      spawnSkillRTornadoProjectile({
        origin: skillRSpawnOrigin,
        direction,
        variant: "default",
      });
    }
    beginSkillRSweep(now);
    return true;
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

    if (punchState.phase === "skillRSweep") {
      const forwardDurationMs = skillRConfig.sweepForwardMs;
      const returnDurationMs = skillRConfig.sweepReturnMs;
      const elapsed = now - punchState.phaseStartedAt;

      if (elapsed <= forwardDurationMs) {
        const progress = THREE.MathUtils.clamp(elapsed / forwardDurationMs, 0, 1);
        const eased = easeOutCubic(progress);
        arm.position.lerpVectors(
          armRig.skillRSweepFromPosition,
          armRig.skillRSweepOutPosition,
          eased
        );
        arm.quaternion.slerpQuaternions(
          armRig.skillRSweepFromQuaternion,
          armRig.skillRSweepOutQuaternion,
          eased
        );
        applyFistCurl(THREE.MathUtils.lerp(0.35, 0.75, eased));
        return;
      }

      const returnProgress = THREE.MathUtils.clamp(
        (elapsed - forwardDurationMs) / returnDurationMs,
        0,
        1
      );
      const eased = easeInOutCubic(returnProgress);
      arm.position.lerpVectors(
        armRig.skillRSweepOutPosition,
        armRig.skillRSweepFromPosition,
        eased
      );
      arm.quaternion.slerpQuaternions(
        armRig.skillRSweepOutQuaternion,
        armRig.skillRSweepFromQuaternion,
        eased
      );
      applyFistCurl(THREE.MathUtils.lerp(0.75, 0, eased));

      if (returnProgress >= 1) {
        arm.position.copy(armRig.skillRSweepFromPosition);
        arm.quaternion.copy(armRig.skillRSweepFromQuaternion);
        resetFingerPose();
        punchState.currentCurl = 0;
        clearPunchState();
      }
      return;
    }

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

      if (punchState.hitPending && progress >= 0.08) {
        const aim = resolvePunchMeleeAim();
        const hitCount = applyPunchMeleeHit(
          punchState.chargeRatio,
          aim.origin,
          aim.direction
        );
        if (hitCount > 0 || progress >= 0.95) {
          punchState.hitPending = false;
        }
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
    handleSkillR,
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
      if (args.aimDirectionWorld && args.aimDirectionWorld.lengthSq() > 0.000001) {
        runtimeAimDirection.copy(args.aimDirectionWorld).normalize();
        hasRuntimeAimDirection = true;
      }
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
      skillRTornadoGeometry.dispose();
      skillRTornadoMaterial.dispose();
      skillRTornadoDeepMaterial.dispose();
      skillRTornadoParticleGeometry.dispose();
      skillRTornadoParticleMaterial.dispose();
      skillRTornadoDeepParticleMaterial.dispose();
      baseRuntime.dispose();
    },
    isFacingLocked: baseRuntime.isFacingLocked,
  });
};




