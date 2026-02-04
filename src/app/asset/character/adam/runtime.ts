import * as THREE from "three";
import { createCharacterRuntime } from "../runtimeBase";
import type { CharacterRuntimeFactory } from "../types";
import { profile } from "./profile";

type ChargeHud = {
  setVisible: (visible: boolean) => void;
  setRatio: (ratio: number) => void;
  dispose: () => void;
};

const createChargeHud = (mount?: HTMLElement): ChargeHud => {
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

  const chargeHud = document.createElement("div");
  chargeHud.style.cssText =
    "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);" +
    "width:180px;height:120px;pointer-events:none;opacity:0;" +
    "transition:opacity 160ms ease;z-index:5;";

  const chargeSvg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  chargeSvg.setAttribute("viewBox", "0 0 200 140");
  chargeSvg.setAttribute("width", "180");
  chargeSvg.setAttribute("height", "120");

  const chargeTrack = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  const chargeFill = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  const chargePath = "M60 20 V95 A40 40 0 0 0 140 95 V20";
  chargeTrack.setAttribute("d", chargePath);
  chargeTrack.setAttribute("fill", "none");
  chargeTrack.setAttribute("stroke", "rgba(148,163,184,0.35)");
  chargeTrack.setAttribute("stroke-width", "10");
  chargeTrack.setAttribute("stroke-linecap", "round");
  chargeFill.setAttribute("d", chargePath);
  chargeFill.setAttribute("fill", "none");
  chargeFill.setAttribute("stroke", "#38bdf8");
  chargeFill.setAttribute("stroke-width", "10");
  chargeFill.setAttribute("stroke-linecap", "round");
  chargeFill.setAttribute(
    "style",
    "filter:drop-shadow(0 0 10px rgba(56,189,248,0.6));"
  );

  chargeSvg.appendChild(chargeTrack);
  chargeSvg.appendChild(chargeFill);
  chargeHud.appendChild(chargeSvg);
  hudHost.appendChild(chargeHud);

  let chargePathLength = 0;
  const setRatio = (ratio: number) => {
    if (!chargePathLength) {
      chargePathLength = chargeFill.getTotalLength();
      chargeFill.style.strokeDasharray = `${chargePathLength}`;
    }
    const clamped = THREE.MathUtils.clamp(ratio, 0, 1);
    chargeFill.style.strokeDashoffset = `${chargePathLength * (1 - clamped)}`;
  };

  const setVisible = (visible: boolean) => {
    chargeHud.style.opacity = visible ? "1" : "0";
  };

  setRatio(0);

  return {
    setVisible,
    setRatio,
    dispose: () => {
      chargeHud.parentElement?.removeChild(chargeHud);
    },
  };
};

  type SkillGlow = {
    setActive: (active: boolean) => void;
    bindModel: (model: THREE.Object3D | null) => void;
    update: (now: number) => void;
    dispose: () => void;
  };
  
  const createSkillGlow = (): SkillGlow => {
    // We want the *actual left antenna tip* to glow, not a floating overlay mesh.
    // The GLB is generated from primitives and multiple parts share materials, so
    // we must clone materials to avoid turning all dark parts green.
    let boundModel: THREE.Object3D | null = null;
    let hornTarget: THREE.Mesh | null = null;
    let originalMaterial: THREE.Material | THREE.Material[] | null = null;
    let glowMaterial: THREE.Material | THREE.Material[] | null = null;
    let isActive = false;
    const baseGlowIntensity = 2.4;
    const flickerOffset = Math.random() * Math.PI * 2;

    const scratchBoxModel = new THREE.Box3();
    const scratchCenter = new THREE.Vector3();
    const scratchSize = new THREE.Vector3();
    const modelWorldInverse = new THREE.Matrix4();
    const toModel = new THREE.Matrix4();
  
    const cloneGlowMaterial = (material: THREE.Material) => {
      const clone = material.clone();
      const asAny = clone as unknown as {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
        toneMapped?: boolean;
      };
        if (asAny.color) asAny.color.set(0x22c55e);
        if (asAny.emissive) {
          asAny.emissive.set(0x22c55e);
          asAny.emissiveIntensity = baseGlowIntensity;
        }
        if (typeof asAny.toneMapped === "boolean") {
          asAny.toneMapped = false;
        }
        return clone;
      };

    const apply = () => {
      if (!isActive || !hornTarget) return;
      if (glowMaterial) return;

      originalMaterial = hornTarget.material;
      if (Array.isArray(originalMaterial)) {
        glowMaterial = originalMaterial.map((m) => cloneGlowMaterial(m));
      } else {
        glowMaterial = cloneGlowMaterial(originalMaterial);
      }
      hornTarget.material = glowMaterial as any;
    };

    const restore = () => {
      if (hornTarget && originalMaterial) {
        hornTarget.material = originalMaterial as any;
      }

      if (glowMaterial) {
        if (Array.isArray(glowMaterial)) glowMaterial.forEach((m) => m.dispose());
        else glowMaterial.dispose();
      }

      glowMaterial = null;
      originalMaterial = null;
    };

    const pickHornTarget = (model: THREE.Object3D) => {
      model.updateMatrixWorld(true);
      modelWorldInverse.copy(model.matrixWorld).invert();
      let maxY = -Infinity;

      model.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        if (!mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }
        if (!mesh.geometry.boundingBox) return;
        toModel.multiplyMatrices(modelWorldInverse, mesh.matrixWorld);
        scratchBoxModel.copy(mesh.geometry.boundingBox).applyMatrix4(toModel);
        maxY = Math.max(maxY, scratchBoxModel.max.y);
      });

      if (!Number.isFinite(maxY)) return null;
  
      // Tip sphere is slightly below the cylinder top because of the tilt, so use a
      // generous epsilon and then prefer "ball-like" meshes (near-uniform bbox).
      const yEpsilon = 0.18;
      let best: {
        mesh: THREE.Mesh;
        centerX: number;
        sphericity: number;
        maxY: number;
      } | null = null;
  
      model.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry || !mesh.geometry.boundingBox) return;
        toModel.multiplyMatrices(modelWorldInverse, mesh.matrixWorld);
        scratchBoxModel.copy(mesh.geometry.boundingBox).applyMatrix4(toModel);
        if (Math.abs(scratchBoxModel.max.y - maxY) > yEpsilon) return;
  
        scratchBoxModel.getCenter(scratchCenter);
        scratchBoxModel.getSize(scratchSize);
        const maxDim = Math.max(scratchSize.x, scratchSize.y, scratchSize.z);
        const minDim = Math.min(scratchSize.x, scratchSize.y, scratchSize.z);
        if (!Number.isFinite(maxDim) || maxDim <= 0) return;
        // Ignore huge spherical parts like the head; the horn tip is tiny.
        if (maxDim > 0.35) return;
        const sphericity = minDim / maxDim;
        const centerX = scratchCenter.x;
  
        if (
          !best ||
          sphericity > best.sphericity + 0.08 ||
          (Math.abs(sphericity - best.sphericity) <= 0.08 &&
            centerX < best.centerX - 0.001) ||
          (Math.abs(sphericity - best.sphericity) <= 0.08 &&
            Math.abs(centerX - best.centerX) <= 0.001 &&
            scratchBoxModel.max.y > best.maxY + 0.001)
        ) {
          best = { mesh, centerX, sphericity, maxY: scratchBoxModel.max.y };
        }
      });
  
      return best?.mesh ?? null;
    };
  
    const setGlowIntensity = (intensity: number) => {
      const apply = (material: THREE.Material) => {
        const asAny = material as unknown as { emissiveIntensity?: number };
        if (typeof asAny.emissiveIntensity === "number") {
          asAny.emissiveIntensity = intensity;
        }
      };
      if (Array.isArray(glowMaterial)) {
        glowMaterial.forEach((material) => apply(material));
      } else if (glowMaterial) {
        apply(glowMaterial);
      }
    };

    return {
      setActive: (active: boolean) => {
        const next = Boolean(active);
        if (next === isActive) return;
        isActive = next;
        if (isActive) apply();
        else restore();
      },
      bindModel: (model: THREE.Object3D | null) => {
        if (!model) return;
        if (boundModel === model && hornTarget) return;

        restore();
        boundModel = model;
        hornTarget = pickHornTarget(model);
        apply();
      },
      update: (now: number) => {
        if (!isActive || !glowMaterial) return;
        const baseWave = Math.sin(now * 0.018 + flickerOffset);
        const jitterWave = Math.sin(now * 0.062 + flickerOffset * 2.3);
        const pulse = THREE.MathUtils.clamp(
          0.7 + 0.25 * baseWave + 0.12 * jitterWave,
          0.35,
          1.05
        );
        setGlowIntensity(baseGlowIntensity * pulse);
      },
      dispose: () => {
        restore();
        hornTarget = null;
        boundModel = null;
      },
    };
  };

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  mount,
  fireProjectile,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const hud = createChargeHud(mount);
  const skillGlow = createSkillGlow();
  const chargeConfig = {
    maxHoldMs: 2400,
    minHoldMs: 260,
    releaseMs: 240,
    minSpeed: 8,
    maxSpeed: 20,
    minLifetime: 0.9,
    maxLifetime: 1.8,
  };
  const chargeState = {
    isCharging: false,
    startTime: 0,
    ratio: 0,
    releaseUntil: 0,
  };
  const skillE = {
    active: false,
    expiresAt: 0,
    cooldownUntil: 0,
  };
  const armAnim = {
    // Smoothed 0..1 so the arm can return smoothly when charge ends.
    raise: 0,
  };
  const raiseAxis = new THREE.Vector3(1, 0, 0);
  const throwAxis = new THREE.Vector3(0, 0, 1);
  const armBase = {
    captured: false,
    rightId: "",
    leftId: "",
    right: new THREE.Quaternion(),
    left: new THREE.Quaternion(),
  };
  const baseQuat = new THREE.Quaternion();
  const raiseQuat = new THREE.Quaternion();
  const throwQuat = new THREE.Quaternion();

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
    chargeState.releaseUntil = 0;
    chargeState.ratio = 0;
    hud.setVisible(false);
    hud.setRatio(0);
  };

  const deactivateSkillE = (startCooldown: boolean) => {
    if (!skillE.active) return;
    skillE.active = false;
    skillE.expiresAt = 0;
    skillGlow.setActive(false);
    if (startCooldown) {
      skillE.cooldownUntil = performance.now() + 10000;
    }
  };

  const handleSkillE = () => {
    const now = performance.now();
    if (skillE.active || now < skillE.cooldownUntil) return false;
    skillE.active = true;
    skillE.expiresAt = now + 5000;
    skillGlow.setActive(true);
    return true;
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
    const speed = THREE.MathUtils.lerp(
      chargeConfig.minSpeed,
      chargeConfig.maxSpeed,
      ratio
    );
    const lifetime = THREE.MathUtils.lerp(
      chargeConfig.minLifetime,
      chargeConfig.maxLifetime,
      ratio
    );
    if (skillE.active) {
      fireProjectile({
        speed,
        lifetime,
        color: 0x22c55e,
        emissive: 0x22c55e,
        emissiveIntensity: 0.9,
        scale: 5.1,
      });
      deactivateSkillE(true);
    } else {
      fireProjectile({ speed, lifetime });
    }
    chargeState.releaseUntil = now + chargeConfig.releaseMs;
    hud.setVisible(true);
    hud.setRatio(ratio);
  };

  return {
    ...baseRuntime,
    handlePrimaryDown: beginCharge,
    handlePrimaryUp: releaseCharge,
    handlePrimaryCancel: cancelCharge,
    handleSkillE,
    update: (args) => {
      baseRuntime.update(args);
      if (args.avatarModel) {
        skillGlow.bindModel(args.avatarModel);
      }
      skillGlow.update(args.now);
      if (skillE.active && args.now >= skillE.expiresAt) {
        deactivateSkillE(true);
      }
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

      if (args.arms.length) {
        const releaseActive = chargeState.releaseUntil > args.now;
        const leftArm = pickArm(args.arms, "left") ?? args.arms[0];
        const rightArm =
          pickArm(args.arms.filter((arm) => arm !== leftArm), "right") ??
          args.arms.find((arm) => arm !== leftArm) ??
          leftArm;
        if (rightArm && leftArm) {
          // Target: raise a single arm 180deg (PI) from front to up while charging,
          // keep the right hand frozen while charging/returning, and only allow
          // walk-swing once we are fully back to base.
          const releaseProgress = releaseActive
            ? THREE.MathUtils.clamp(
                1 - (chargeState.releaseUntil - args.now) / chargeConfig.releaseMs,
                0,
                1
              )
            : 0;
          const targetRaise =
            chargeState.isCharging
              ? chargeState.ratio
              : releaseActive
                ? chargeState.ratio * (1 - releaseProgress)
                : 0;

          // Smoothing helps avoid "snapping" when charge is canceled/ends.
          const damp = chargeState.isCharging ? 0.32 : 0.18;
          armAnim.raise = THREE.MathUtils.lerp(armAnim.raise, targetRaise, damp);

          const stillLockArms =
            chargeState.isCharging || releaseActive || armAnim.raise > 0.01;
          if (!stillLockArms) {
            armBase.captured = false;
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

          // Freeze right arm while charging/returning.
          if (rightArm !== leftArm) {
            rightArm.quaternion.copy(armBase.right);
          }

          // 180 degrees raise around local X.
          const raiseAngle = -Math.PI * armAnim.raise;

          // Small throw twist for the release window (optional).
          const throwTwist = releaseActive
            ? Math.sin(releaseProgress * Math.PI) * -0.55
            : 0;

          baseQuat.copy(armBase.left);
          raiseQuat.setFromAxisAngle(raiseAxis, raiseAngle);
          throwQuat.setFromAxisAngle(throwAxis, throwTwist);

          // Apply as additive rotations on top of base pose so we "return to original"
          // automatically when raiseAngle/throwTwist go back to 0.
          leftArm.quaternion
            .copy(baseQuat)
            // Use parent/world axes for a cleaner "raise from front to up".
            .premultiply(raiseQuat)
            .premultiply(throwQuat);
        }
      }
    },
    dispose: () => {
      cancelCharge();
      deactivateSkillE(false);
      skillGlow.dispose();
      hud.dispose();
      baseRuntime.dispose();
    },
  };
};
