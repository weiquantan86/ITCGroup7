import * as THREE from "three";
import { createCharacterRuntime } from "../player/runtimeBase";
import { CharacterRuntimeObject } from "../player/runtimeObject";
import type { CharacterRuntimeFactory } from "../types";
import { profile } from "./profile";

type ChargeHud = {
  setVisible: (visible: boolean) => void;
  setRatio: (ratio: number) => void;
  dispose: () => void;
};

const createShurikenChargeHud = (mount?: HTMLElement): ChargeHud => {
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
    "width:196px;height:196px;pointer-events:none;opacity:0;" +
    "transition:opacity 140ms ease;z-index:6;";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 180 180");
  svg.setAttribute("width", "196");
  svg.setAttribute("height", "196");

  const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  track.setAttribute("cx", "90");
  track.setAttribute("cy", "90");
  track.setAttribute("r", "68");
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "rgba(148,163,184,0.3)");
  track.setAttribute("stroke-width", "12");

  const fill = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  fill.setAttribute("cx", "90");
  fill.setAttribute("cy", "90");
  fill.setAttribute("r", "68");
  fill.setAttribute("fill", "none");
  fill.setAttribute("stroke", "#38bdf8");
  fill.setAttribute("stroke-width", "12");
  fill.setAttribute("stroke-linecap", "round");
  fill.setAttribute("transform", "rotate(-90 90 90)");
  fill.setAttribute("style", "filter:drop-shadow(0 0 12px rgba(56,189,248,0.7));");

  const shurikenGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g"
  );
  const shuriken = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  shuriken.setAttribute(
    "points",
    "90,24 106,70 154,90 106,110 90,156 74,110 26,90 74,70"
  );
  shuriken.setAttribute("fill", "rgba(148,163,184,0.28)");
  shuriken.setAttribute("stroke", "rgba(186,230,253,0.95)");
  shuriken.setAttribute("stroke-width", "4");

  const shurikenCore = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  shurikenCore.setAttribute("cx", "90");
  shurikenCore.setAttribute("cy", "90");
  shurikenCore.setAttribute("r", "14");
  shurikenCore.setAttribute("fill", "rgba(186,230,253,0.85)");
  shurikenCore.setAttribute("stroke", "rgba(59,130,246,0.9)");
  shurikenCore.setAttribute("stroke-width", "3");

  shurikenGroup.appendChild(shuriken);
  shurikenGroup.appendChild(shurikenCore);
  svg.appendChild(track);
  svg.appendChild(fill);
  svg.appendChild(shurikenGroup);
  hud.appendChild(svg);
  hudHost.appendChild(hud);

  let ringLength = 0;
  const setRatio = (ratio: number) => {
    if (!ringLength) {
      ringLength = fill.getTotalLength();
      fill.style.strokeDasharray = `${ringLength}`;
    }
    const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
    fill.style.strokeDashoffset = `${ringLength * (1 - clamped)}`;
    shurikenGroup.setAttribute(
      "transform",
      `translate(90 90) rotate(${clamped * 300}) scale(${0.9 + clamped * 0.12}) translate(-90 -90)`
    );
    shurikenCore.setAttribute("r", `${14 + clamped * 4}`);
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

type DrawSwordFx = {
  attachTo: (arm: THREE.Object3D | null) => void;
  setVisible: (visible: boolean) => void;
  setDrawRatio: (ratio: number) => void;
  dispose: () => void;
};

const createDrawSwordFx = (avatar: THREE.Object3D): DrawSwordFx => {
  const group = new THREE.Group();
  group.visible = false;

  const handleGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.3, 10);
  const guardGeometry = new THREE.BoxGeometry(0.2, 0.03, 0.08);
  const bladeGeometry = new THREE.BoxGeometry(0.05, 1.1, 0.12);
  const auraGeometry = new THREE.BoxGeometry(0.08, 1.08, 0.2);

  const handleMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.5,
    metalness: 0.25,
  });
  const guardMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.26,
    metalness: 0.62,
  });
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.2,
    metalness: 0.78,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.28,
  });
  const auraMaterial = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const handle = new THREE.Mesh(handleGeometry, handleMaterial);
  const guard = new THREE.Mesh(guardGeometry, guardMaterial);
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  const aura = new THREE.Mesh(auraGeometry, auraMaterial);

  handle.castShadow = true;
  guard.castShadow = true;
  blade.castShadow = true;
  blade.receiveShadow = true;

  handle.position.y = 0;
  guard.position.y = 0.12;
  blade.position.y = 0.34;
  aura.position.y = 0.34;

  group.add(handle, guard, blade, aura);
  avatar.add(group);

  const attachTo = (arm: THREE.Object3D | null) => {
    const parent = arm ?? avatar;
    if (group.parent !== parent) {
      group.removeFromParent();
      parent.add(group);
    }
    if (!arm) {
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      return;
    }
    group.position.set(0.05, -0.78, 0.12);
    group.rotation.set(-1.12, 0.22, Math.PI * 0.55);
  };

  const setDrawRatio = (ratio: number) => {
    const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
    blade.position.y = 0.26 + clamped * 0.52;
    aura.position.y = blade.position.y;
    aura.scale.y = 0.65 + clamped * 0.55;
    auraMaterial.opacity = 0.12 + clamped * 0.42;
    bladeMaterial.emissiveIntensity = 0.28 + clamped * 0.66;
    group.position.x = 0.05 + clamped * 0.03;
    group.position.z = 0.12 - clamped * 0.06;
  };

  const setVisible = (visible: boolean) => {
    group.visible = visible;
  };

  return {
    attachTo,
    setVisible,
    setDrawRatio,
    dispose: () => {
      group.removeFromParent();
      handleGeometry.dispose();
      guardGeometry.dispose();
      bladeGeometry.dispose();
      auraGeometry.dispose();
      handleMaterial.dispose();
      guardMaterial.dispose();
      bladeMaterial.dispose();
      auraMaterial.dispose();
    },
  };
};

type SwordWaveEntry = {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  baseScale: number;
  spinDirection: number;
};

const createSwordWaveEntry = (
  geometry: THREE.BufferGeometry
): SwordWaveEntry => {
  const material = new THREE.MeshStandardMaterial({
    color: 0xbfe8ff,
    roughness: 0.2,
    metalness: 0.14,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  material.depthWrite = false;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.renderOrder = 7;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  return {
    mesh,
    material,
    baseScale: 1,
    spinDirection: 1,
  };
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  mount,
  fireProjectile,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const hud = createShurikenChargeHud(mount);
  const drawSword = createDrawSwordFx(avatar);

  const chargeConfig = {
    maxHoldMs: 1800,
    minHoldMs: 180,
    releaseMs: 210,
    minSpeed: 15,
    maxSpeed: 28,
    minLifetime: 0.45,
    maxLifetime: 1.1,
    minDamage: 18,
    maxDamage: 42,
  };
  const chargeState = {
    isCharging: false,
    startTime: 0,
    ratio: 0,
    releaseUntil: 0,
  };
  const armAnim = {
    draw: 0,
  };
  const armBase = {
    captured: false,
    rightId: "",
    leftId: "",
    right: new THREE.Quaternion(),
    left: new THREE.Quaternion(),
  };

  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  const rightQuatX = new THREE.Quaternion();
  const rightQuatY = new THREE.Quaternion();
  const rightQuatZ = new THREE.Quaternion();
  const leftQuatX = new THREE.Quaternion();
  const leftQuatZ = new THREE.Quaternion();

  const swordWaveGeometry = new THREE.RingGeometry(
    0.45,
    1.16,
    44,
    1,
    -Math.PI * 0.7,
    Math.PI * 1.4
  );
  const swordWavePool: SwordWaveEntry[] = Array.from({ length: 8 }, () =>
    createSwordWaveEntry(swordWaveGeometry)
  );
  const projectileForward = new THREE.Vector3(0, 0, 1);
  const projectileDirection = new THREE.Vector3();

  const scoreArmCandidate = (
    arm: THREE.Object3D,
    side: "right" | "left"
  ) => {
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

  const pickArm = (arms: THREE.Object3D[], side: "right" | "left") => {
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

  const acquireSwordWave = () => {
    for (let i = 0; i < swordWavePool.length; i += 1) {
      const entry = swordWavePool[i];
      if (!entry.mesh.parent) return entry;
    }
    const entry = createSwordWaveEntry(swordWaveGeometry);
    swordWavePool.push(entry);
    return entry;
  };

  const beginCharge = () => {
    if (chargeState.isCharging || !fireProjectile) return;
    chargeState.isCharging = true;
    chargeState.startTime = performance.now();
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    armBase.captured = false;
    hud.setVisible(true);
    hud.setRatio(0);
  };

  const cancelCharge = () => {
    if (!chargeState.isCharging && chargeState.releaseUntil === 0) return;
    chargeState.isCharging = false;
    chargeState.startTime = 0;
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    armAnim.draw = 0;
    armBase.captured = false;
    drawSword.setVisible(false);
    drawSword.attachTo(null);
    hud.setVisible(false);
    hud.setRatio(0);
  };

  const releaseCharge = () => {
    if (!chargeState.isCharging || !fireProjectile) return;
    const now = performance.now();
    const elapsed = now - chargeState.startTime;
    if (elapsed < chargeConfig.minHoldMs) {
      cancelCharge();
      return;
    }

    const ratio = THREE.MathUtils.clamp(
      elapsed / chargeConfig.maxHoldMs,
      0,
      1
    );
    chargeState.isCharging = false;
    chargeState.ratio = ratio;
    chargeState.releaseUntil = now + chargeConfig.releaseMs;
    hud.setVisible(true);
    hud.setRatio(ratio);

    const speed = THREE.MathUtils.lerp(chargeConfig.minSpeed, chargeConfig.maxSpeed, ratio);
    const lifetime = THREE.MathUtils.lerp(
      chargeConfig.minLifetime,
      chargeConfig.maxLifetime,
      ratio
    );
    const damage = Math.round(
      THREE.MathUtils.lerp(chargeConfig.minDamage, chargeConfig.maxDamage, ratio)
    );
    const waveRadius = THREE.MathUtils.lerp(1.2, 2.3, ratio);
    const targetHitRadius = THREE.MathUtils.lerp(1.05, 1.9, ratio);
    const entry = acquireSwordWave();
    entry.baseScale = THREE.MathUtils.lerp(1.02, 1.62, ratio);
    entry.spinDirection = Math.random() < 0.5 ? -1 : 1;
    entry.mesh.visible = true;
    entry.mesh.rotation.set(0, 0, 0);
    entry.mesh.scale.setScalar(entry.baseScale);
    entry.material.opacity = THREE.MathUtils.lerp(0.66, 0.9, ratio);
    entry.material.emissiveIntensity = THREE.MathUtils.lerp(0.9, 1.6, ratio);

    fireProjectile({
      mesh: entry.mesh,
      speed,
      lifetime,
      radius: waveRadius,
      targetHitRadius,
      damage,
      energyGainOnHit: 6,
      lifecycle: {
        applyForces: ({ velocity }) => {
          if (velocity.lengthSq() > 0.000001) {
            projectileDirection.copy(velocity).normalize();
            entry.mesh.quaternion.setFromUnitVectors(
              projectileForward,
              projectileDirection
            );
          }
          entry.mesh.rotateZ((0.07 + ratio * 0.05) * entry.spinDirection);
          const pulse =
            1 + Math.sin(performance.now() * 0.022 + ratio * Math.PI) * 0.05;
          entry.mesh.scale.setScalar(entry.baseScale * pulse);
        },
        onRemove: () => {
          entry.mesh.visible = false;
          entry.mesh.rotation.set(0, 0, 0);
          entry.mesh.scale.setScalar(1);
        },
      },
    });
  };

  const resetState = () => {
    chargeState.startTime = 0;
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    armAnim.draw = 0;
    armBase.captured = false;
    cancelCharge();
    drawSword.setVisible(false);
    drawSword.attachTo(null);
    swordWavePool.forEach((entry) => {
      entry.mesh.removeFromParent();
      entry.mesh.visible = false;
      entry.mesh.rotation.set(0, 0, 0);
      entry.mesh.scale.setScalar(1);
    });
    baseRuntime.resetState?.();
  };

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handleRightClick: baseRuntime.handleRightClick,
    handlePrimaryDown: beginCharge,
    handlePrimaryUp: releaseCharge,
    handlePrimaryCancel: cancelCharge,
    handleSkillQ: baseRuntime.handleSkillQ,
    handleSkillE: baseRuntime.handleSkillE,
    handleSkillR: baseRuntime.handleSkillR,
    getProjectileBlockers: baseRuntime.getProjectileBlockers,
    isMovementLocked: baseRuntime.isMovementLocked,
    getSkillCooldownRemainingMs: baseRuntime.getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs: baseRuntime.getSkillCooldownDurationMs,
    resetState,
    update: (args) => {
      baseRuntime.update(args);

      if (chargeState.isCharging) {
        const elapsed = args.now - chargeState.startTime;
        const ratio = THREE.MathUtils.clamp(
          elapsed / chargeConfig.maxHoldMs,
          0,
          1
        );
        chargeState.ratio = ratio;
        hud.setVisible(true);
        hud.setRatio(ratio);
      } else if (
        chargeState.releaseUntil > 0 &&
        args.now >= chargeState.releaseUntil
      ) {
        chargeState.releaseUntil = 0;
        hud.setVisible(false);
        hud.setRatio(0);
      }

      if (!args.arms.length) {
        drawSword.setVisible(false);
        drawSword.attachTo(null);
        return;
      }

      const releaseActive = chargeState.releaseUntil > args.now;
      const releaseProgress = releaseActive
        ? THREE.MathUtils.clamp(
            1 - (chargeState.releaseUntil - args.now) / chargeConfig.releaseMs,
            0,
            1
          )
        : 0;
      const targetDraw = chargeState.isCharging
        ? chargeState.ratio
        : releaseActive
          ? chargeState.ratio * (1 - releaseProgress)
          : 0;
      const damp = chargeState.isCharging ? 0.28 : 0.18;
      armAnim.draw = THREE.MathUtils.lerp(armAnim.draw, targetDraw, damp);

      const leftArm = pickArm(args.arms, "left") ?? args.arms[0];
      const rightArm =
        pickArm(args.arms.filter((arm) => arm !== leftArm), "right") ??
        args.arms.find((arm) => arm !== leftArm) ??
        leftArm;

      const poseActive =
        chargeState.isCharging || releaseActive || armAnim.draw > 0.02;
      if (!poseActive) {
        if (armBase.captured) {
          const sameTargets =
            armBase.rightId === rightArm.uuid && armBase.leftId === leftArm.uuid;
          if (sameTargets) {
            rightArm.quaternion.copy(armBase.right);
            leftArm.quaternion.copy(armBase.left);
          }
        }
        armBase.captured = false;
        drawSword.setVisible(false);
        drawSword.attachTo(null);
        return;
      }

      if (
        !armBase.captured ||
        armBase.rightId !== rightArm.uuid ||
        armBase.leftId !== leftArm.uuid
      ) {
        armBase.captured = true;
        armBase.rightId = rightArm.uuid;
        armBase.leftId = leftArm.uuid;
        armBase.right.copy(rightArm.quaternion);
        armBase.left.copy(leftArm.quaternion);
      }

      drawSword.attachTo(rightArm);
      drawSword.setVisible(true);
      drawSword.setDrawRatio(armAnim.draw);

      const drawBackAngle = -0.32 - armAnim.draw * 1.04;
      const drawTwist = 0.1 + armAnim.draw * 0.52;
      const drawRoll = -0.12 - armAnim.draw * 0.46;
      const releaseSnap = releaseActive
        ? Math.sin(releaseProgress * Math.PI) * 0.48
        : 0;
      rightQuatX.setFromAxisAngle(axisX, drawBackAngle + releaseSnap);
      rightQuatY.setFromAxisAngle(axisY, drawTwist);
      rightQuatZ.setFromAxisAngle(axisZ, drawRoll);
      rightArm.quaternion
        .copy(armBase.right)
        .premultiply(rightQuatX)
        .premultiply(rightQuatY)
        .premultiply(rightQuatZ);

      const leftGuard = -0.06 + armAnim.draw * 0.22;
      const leftRoll = 0.05 + armAnim.draw * 0.09;
      leftQuatX.setFromAxisAngle(axisX, leftGuard);
      leftQuatZ.setFromAxisAngle(axisZ, leftRoll);
      leftArm.quaternion
        .copy(armBase.left)
        .premultiply(leftQuatX)
        .premultiply(leftQuatZ);
    },
    dispose: () => {
      resetState();
      hud.dispose();
      drawSword.dispose();
      swordWavePool.forEach((entry) => {
        entry.mesh.removeFromParent();
        entry.material.dispose();
      });
      swordWaveGeometry.dispose();
      baseRuntime.dispose();
    },
    isFacingLocked: baseRuntime.isFacingLocked,
  });
};

