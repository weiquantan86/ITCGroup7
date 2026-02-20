import * as THREE from "three";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import type { CharacterRuntimeFactory, SkillKey } from "../general/types";
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

type ElectricAura = {
  group: THREE.Group;
  setVisible: (visible: boolean) => void;
  update: (now: number) => void;
  dispose: () => void;
};

type SkillRVortexRing = {
  mesh: THREE.Mesh;
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  yawSpeed: number;
  wobbleSpeed: number;
  wobbleAmount: number;
  phase: number;
};

type SkillRVortexOrb = {
  mesh: THREE.Mesh;
  orbitRadius: number;
  orbitSpeed: number;
  orbitYOffset: number;
  swirlSpeed: number;
  phase: number;
};

type SkillQArcOrb = {
  mesh: THREE.Mesh;
  orbitRadius: number;
  orbitSpeed: number;
  heightOffset: number;
  phase: number;
};

type SkillQArcDebuffEntry = {
  targetId: string;
  targetObject: THREE.Object3D;
  isTargetActive: () => boolean;
  dealDamageToTarget: (damage: number, now?: number) => void;
  expiresAt: number;
  nextTickAt: number;
  group: THREE.Group;
  upperArc: THREE.Mesh;
  lowerArc: THREE.Mesh;
  arcMaterialA: THREE.MeshBasicMaterial;
  arcMaterialB: THREE.MeshBasicMaterial;
  orbMaterial: THREE.MeshBasicMaterial;
  upperArcGeometry: THREE.TorusGeometry;
  lowerArcGeometry: THREE.TorusGeometry;
  orbGeometry: THREE.SphereGeometry;
  orbs: SkillQArcOrb[];
  radius: number;
  phase: number;
};

const createElectricAura = ({
  radius,
  arcCount,
  pointsPerArc,
  color = 0x22c55e,
  opacity = 0.72,
  jitter = 0.2,
  lineWidth = 2.5,
  thicknessLayers = 3,
  thicknessOffset = 0.035,
}: {
  radius: number;
  arcCount: number;
  pointsPerArc: number;
  color?: number;
  opacity?: number;
  jitter?: number;
  lineWidth?: number;
  thicknessLayers?: number;
  thicknessOffset?: number;
}): ElectricAura => {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    linewidth: lineWidth,
  });
  const arcs: Array<{
    geometry: THREE.BufferGeometry;
    positions: Float32Array;
    phase: number;
    speed: number;
    lift: number;
  }> = [];

  for (let i = 0; i < arcCount; i += 1) {
    const positions = new Float32Array(pointsPerArc * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const lineStack = new THREE.Group();
    lineStack.rotation.y = (i / arcCount) * Math.PI * 2;
    lineStack.rotation.x = (Math.random() - 0.5) * 0.9;
    lineStack.rotation.z = (Math.random() - 0.5) * 0.9;
    for (let layer = 0; layer < thicknessLayers; layer += 1) {
      const line = new THREE.Line(geometry, material);
      const center = (thicknessLayers - 1) / 2;
      const offset = (layer - center) * thicknessOffset;
      if (offset !== 0) {
        line.position.set(offset, 0, -offset * 0.45);
      }
      lineStack.add(line);
    }
    group.add(lineStack);
    arcs.push({
      geometry,
      positions,
      phase: Math.random() * Math.PI * 2,
      speed: 1 + Math.random() * 1.4,
      lift: 1 + Math.random() * 0.45,
    });
  }

  const update = (now: number) => {
    const time = now * 0.001;
    for (let i = 0; i < arcs.length; i += 1) {
      const arc = arcs[i];
      const position = arc.positions;
      for (let j = 0; j < pointsPerArc; j += 1) {
        const t = j / (pointsPerArc - 1);
        const angle = t * Math.PI * 2 + arc.phase + time * arc.speed;
        const pulse =
          1 + Math.sin(time * 5.6 + j * 0.9 + arc.phase * 1.5) * jitter;
        const radial = radius * pulse;
        const x = Math.cos(angle) * radial;
        const z = Math.sin(angle) * radial;
        const y =
          (t - 0.5) * radius * 0.85 * arc.lift +
          Math.sin(time * 7.1 + j * 0.7 + arc.phase) * radius * 0.12;
        const idx = j * 3;
        position[idx] = x;
        position[idx + 1] = y;
        position[idx + 2] = z;
      }
      (
        arc.geometry.attributes.position as THREE.BufferAttribute
      ).needsUpdate = true;
    }
  };

  return {
    group,
    setVisible: (visible: boolean) => {
      group.visible = visible;
    },
    update,
    dispose: () => {
      arcs.forEach((arc) => arc.geometry.dispose());
      material.dispose();
    },
  };
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  mount,
  noCooldown,
  fireProjectile,
  performMeleeAttack,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const bypassCooldown = Boolean(noCooldown);
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
  const skillECooldownMs = 5000;
  const skillR = {
    active: false,
    expiresAt: 0,
  };
  const armAnim = {
    // Smoothed 0..1 so the arm can return smoothly when charge ends.
    raise: 0,
  };
  const raiseAxis = new THREE.Vector3(1, 0, 0);
  const throwAxis = new THREE.Vector3(0, 0, 1);
  const skillRDurationMs = 3000;
  const skillRSphereConfig = {
    radius: 4.2,
    forwardOffset: 5.8,
  };
  const skillRECombo = {
    speed: 14,
    distance: 5,
    damage: 74,
    explosionRadius: 12,
    explosionDamage: 60,
  };
  const skillRComboExplosionDamage = 100;
  const skillRContact = {
    intervalMs: 200,
    damage: 10,
    maxHits: 2,
    nextTickAt: 0,
  };
  const skillQVolley = {
    count: 3,
    chargeMs: 2000,
    speed: 17,
    distance: 32,
    spreadRad: THREE.MathUtils.degToRad(18),
    lateralSpacing: 1.7,
    forwardSpawnOffset: 2.3,
    verticalSpawnOffset: 1.25,
    radius: 2.8,
    targetHitRadius: 3.3,
    ballDamage: 150,
  };
  const skillQArcDebuff = {
    triggerHitCount: 2,
    durationMs: 5000,
    tickMs: 1000,
    tickDamage: 100,
    minRadius: 0.52,
    maxRadius: 3.6,
  };
  const skillQChargeState = {
    active: false,
    startAt: 0,
    fireAt: 0,
  };
  const skillRSphereGeometry = new THREE.SphereGeometry(
    skillRSphereConfig.radius,
    40,
    28
  );
  const skillRSphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.14,
    metalness: 0.06,
    emissive: 0x22c55e,
    emissiveIntensity: 1.05,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
  });
  skillRSphereMaterial.depthWrite = false;
  const skillRSphere = new THREE.Mesh(skillRSphereGeometry, skillRSphereMaterial);
  skillRSphere.visible = false;
  skillRSphere.renderOrder = 8;
  avatar.add(skillRSphere);
  const skillRVortexGroup = new THREE.Group();
  skillRVortexGroup.visible = false;
  skillRSphere.add(skillRVortexGroup);
  const skillRVortexCoreGeometry = new THREE.SphereGeometry(
    skillRSphereConfig.radius * 0.34,
    24,
    18
  );
  const skillRVortexCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xdcfce7,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const skillRVortexCore = new THREE.Mesh(
    skillRVortexCoreGeometry,
    skillRVortexCoreMaterial
  );
  skillRVortexGroup.add(skillRVortexCore);
  const skillRVortexRingGeometry = new THREE.TorusGeometry(
    skillRSphereConfig.radius * 0.42,
    skillRSphereConfig.radius * 0.053,
    14,
    84
  );
  const skillRVortexRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x86efac,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const skillRVortexRings: SkillRVortexRing[] = Array.from(
    { length: 5 },
    (_, index) => {
      const mesh = new THREE.Mesh(skillRVortexRingGeometry, skillRVortexRingMaterial);
      mesh.scale.setScalar(0.66 + index * 0.1);
      skillRVortexGroup.add(mesh);
      return {
        mesh,
        tiltX: (Math.random() - 0.5) * 0.7,
        tiltY: (index / 5) * Math.PI * 0.7,
        tiltZ: (Math.random() - 0.5) * 0.7,
        yawSpeed: (index % 2 === 0 ? 1 : -1) * (1.7 + index * 0.22),
        wobbleSpeed: 2.3 + index * 0.45,
        wobbleAmount: 0.08 + index * 0.014,
        phase: Math.random() * Math.PI * 2,
      };
    }
  );
  const skillRVortexOrbGeometry = new THREE.SphereGeometry(
    skillRSphereConfig.radius * 0.082,
    12,
    10
  );
  const skillRVortexOrbMaterial = new THREE.MeshBasicMaterial({
    color: 0xbbf7d0,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const skillRVortexOrbs: SkillRVortexOrb[] = Array.from(
    { length: 18 },
    () => {
      const mesh = new THREE.Mesh(skillRVortexOrbGeometry, skillRVortexOrbMaterial);
      skillRVortexGroup.add(mesh);
      return {
        mesh,
        orbitRadius:
          skillRSphereConfig.radius *
          THREE.MathUtils.lerp(0.26, 0.58, Math.random()),
        orbitSpeed: THREE.MathUtils.lerp(2.4, 4.9, Math.random()),
        orbitYOffset:
          skillRSphereConfig.radius * THREE.MathUtils.lerp(-0.16, 0.16, Math.random()),
        swirlSpeed: THREE.MathUtils.lerp(2.6, 6.2, Math.random()),
        phase: Math.random() * Math.PI * 2,
      };
    }
  );
  const skillQProjectileGeometry = new THREE.SphereGeometry(
    skillQVolley.radius,
    36,
    26
  );
  const skillQProjectileMaterial = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.18,
    metalness: 0.06,
    emissive: 0x22c55e,
    emissiveIntensity: 1.2,
  });
  const skillQChargeAura = createElectricAura({
    radius: 1.75,
    arcCount: 6,
    pointsPerArc: 12,
    opacity: 0.96,
    jitter: 0.2,
    lineWidth: 4,
    thicknessLayers: 4,
    thicknessOffset: 0.04,
  });
  skillQChargeAura.group.position.set(0, 1.15, 0);
  skillQChargeAura.setVisible(false);
  avatar.add(skillQChargeAura.group);
  type SkillQProjectileEntry = {
    mesh: THREE.Mesh;
    aura: ElectricAura;
  };
  const skillQProjectilePoolSize = 12;
  const skillQProjectilePool: SkillQProjectileEntry[] = Array.from(
    { length: skillQProjectilePoolSize },
    () => {
      const mesh = new THREE.Mesh(skillQProjectileGeometry, skillQProjectileMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const aura = createElectricAura({
        radius: skillQVolley.radius * 1.06,
        arcCount: 4,
        pointsPerArc: 10,
        opacity: 0.98,
        jitter: 0.18,
        lineWidth: 3.5,
        thicknessLayers: 3,
        thicknessOffset: 0.035,
      });
      aura.setVisible(false);
      mesh.add(aura.group);
      return { mesh, aura };
    }
  );
  const activeProjectileBlockers: THREE.Object3D[] = [skillRSphere];
  const emptyProjectileBlockers: THREE.Object3D[] = [];
  const armBase = {
    captured: false,
    rightId: "",
    leftId: "",
    right: new THREE.Quaternion(),
    left: new THREE.Quaternion(),
  };
  const armNeutral = {
    captured: false,
    rightId: "",
    leftId: "",
    rightY: 0,
    rightZ: 0,
    leftY: 0,
    leftZ: 0,
  };
  const armReset = {
    pending: false,
  };
  const armPoseRestore = {
    pendingNeutralTwist: false,
  };
  const baseQuat = new THREE.Quaternion();
  const raiseQuat = new THREE.Quaternion();
  const throwQuat = new THREE.Quaternion();
  const skillRRightQuat = new THREE.Quaternion();
  const skillRLeftQuat = new THREE.Quaternion();
  const skillRArmMidpoint = new THREE.Vector3();
  const skillRLeftArmWorld = new THREE.Vector3();
  const skillRRightArmWorld = new THREE.Vector3();
  const skillRForwardWorld = new THREE.Vector3();
  const skillRSphereLaunchOrigin = new THREE.Vector3();
  const skillRExplosionDirection = new THREE.Vector3();
  const skillRContactCenterWorld = new THREE.Vector3();
  const skillRContactDirection = new THREE.Vector3();
  const skillRSphereWorldScale = new THREE.Vector3();
  const skillQAimDirection = new THREE.Vector3(0, 0, 1);
  const skillQOrigin = new THREE.Vector3();
  const skillQBaseDirection = new THREE.Vector3();
  const skillQRight = new THREE.Vector3();
  const skillQShotOrigin = new THREE.Vector3();
  const skillQShotDirection = new THREE.Vector3();
  const skillQUp = new THREE.Vector3(0, 1, 0);
  const skillQArcBounds = new THREE.Box3();
  const skillQArcSphere = new THREE.Sphere();
  const skillQArcCenterWorld = new THREE.Vector3();
  const skillQArcCenterLocal = new THREE.Vector3();
  const activeSkillQArcDebuffs = new Map<string, SkillQArcDebuffEntry>();
  let skillRSphereInFlight = false;

  const resolveBaseProjectileDamage = (speed: number) =>
    Math.max(8, Math.round(10 + speed * 0.6));

  const resolveEmpoweredBasicAttackDamage = (speed: number) =>
    resolveBaseProjectileDamage(speed) * 3;

  const acquireSkillQProjectile = () => {
    for (let i = 0; i < skillQProjectilePool.length; i += 1) {
      const entry = skillQProjectilePool[i];
      if (!entry.mesh.parent) return entry;
    }
    const mesh = new THREE.Mesh(skillQProjectileGeometry, skillQProjectileMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const aura = createElectricAura({
      radius: skillQVolley.radius * 1.06,
      arcCount: 4,
      pointsPerArc: 10,
      opacity: 0.98,
      jitter: 0.18,
      lineWidth: 3.5,
      thicknessLayers: 3,
      thicknessOffset: 0.035,
    });
    aura.setVisible(false);
    mesh.add(aura.group);
    const entry = { mesh, aura };
    skillQProjectilePool.push(entry);
    return entry;
  };

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

  const captureArmNeutralIfNeeded = (
    rightArm: THREE.Object3D,
    leftArm: THREE.Object3D
  ) => {
    const sameTargets =
      armNeutral.rightId === rightArm.uuid && armNeutral.leftId === leftArm.uuid;
    if (armNeutral.captured && sameTargets) return;
    armNeutral.captured = true;
    armNeutral.rightId = rightArm.uuid;
    armNeutral.leftId = leftArm.uuid;
    armNeutral.rightY = rightArm.rotation.y;
    armNeutral.rightZ = rightArm.rotation.z;
    armNeutral.leftY = leftArm.rotation.y;
    armNeutral.leftZ = leftArm.rotation.z;
  };

  const restoreArmNeutralTwist = (
    rightArm: THREE.Object3D,
    leftArm: THREE.Object3D
  ) => {
    if (!armNeutral.captured) return;
    const sameTargets =
      armNeutral.rightId === rightArm.uuid && armNeutral.leftId === leftArm.uuid;
    if (!sameTargets) return;
    rightArm.rotation.y = armNeutral.rightY;
    rightArm.rotation.z = armNeutral.rightZ;
    if (leftArm !== rightArm) {
      leftArm.rotation.y = armNeutral.leftY;
      leftArm.rotation.z = armNeutral.leftZ;
    }
  };

  const beginCharge = () => {
    if (chargeState.isCharging || skillQChargeState.active || !fireProjectile) {
      return;
    }
    chargeState.isCharging = true;
    chargeState.startTime = performance.now();
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    // If we start a new basic attack before the previous release pose settles,
    // force y/z arm twist back to neutral to avoid cumulative drift.
    armPoseRestore.pendingNeutralTwist = true;
    armBase.captured = false;
    hud.setVisible(true);
    hud.setRatio(0);
  };

  const cancelCharge = () => {
    if (!chargeState.isCharging && chargeState.releaseUntil === 0) return;
    chargeState.isCharging = false;
    chargeState.releaseUntil = 0;
    chargeState.ratio = 0;
    armPoseRestore.pendingNeutralTwist = true;
    hud.setVisible(false);
    hud.setRatio(0);
  };

  const deactivateSkillE = (startCooldown: boolean) => {
    if (!skillE.active) return;
    skillE.active = false;
    skillE.expiresAt = 0;
    skillGlow.setActive(false);
    if (startCooldown && !bypassCooldown) {
      skillE.cooldownUntil = performance.now() + 10000;
    }
  };

  const resetSkillRSphereAttachment = () => {
    skillRSphere.visible = false;
    skillRSphere.scale.setScalar(1);
    skillRVortexGroup.visible = false;
    skillRVortexGroup.scale.setScalar(1);
    skillRContact.nextTickAt = 0;
    skillRSphere.removeFromParent();
    avatar.add(skillRSphere);
    skillRSphere.position.set(0, 0, 0);
  };

  const deactivateSkillR = () => {
    if (!skillR.active && !skillRSphere.visible && !skillRSphereInFlight) return;
    if (skillR.active) {
      armReset.pending = true;
    }
    skillR.active = false;
    skillR.expiresAt = 0;
    skillRSphereInFlight = false;
    skillRContact.nextTickAt = 0;
    resetSkillRSphereAttachment();
  };

  const spawnSkillRExplosionRangeFx = (
    parent: THREE.Object3D,
    center: THREE.Vector3,
    radius: number
  ) => {
    const resolvedRadius = Math.max(0.5, radius);
    const ringGeometry = new THREE.TorusGeometry(1, 0.08, 10, 56);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x86efac,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(center);
    ring.position.y += 0.12;
    ring.scale.setScalar(resolvedRadius * 0.18);

    const shellGeometry = new THREE.SphereGeometry(1, 24, 16);
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.24,
      wireframe: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    shell.position.copy(center);
    shell.scale.setScalar(resolvedRadius * 0.22);

    parent.add(ring, shell);

    const startedAt = performance.now();
    const lifeMs = 360;
    ring.onBeforeRender = () => {
      const progress = THREE.MathUtils.clamp(
        (performance.now() - startedAt) / lifeMs,
        0,
        1
      );
      const fade = 1 - progress;
      ring.scale.setScalar(
        THREE.MathUtils.lerp(resolvedRadius * 0.18, resolvedRadius, progress)
      );
      shell.scale.setScalar(
        THREE.MathUtils.lerp(resolvedRadius * 0.22, resolvedRadius, progress)
      );
      ringMaterial.opacity = 0.62 * fade * fade;
      shellMaterial.opacity = 0.24 * fade;
      if (progress >= 1 || !ring.parent || !shell.parent) {
        ring.onBeforeRender = () => {};
        parent.remove(ring, shell);
        ringGeometry.dispose();
        ringMaterial.dispose();
        shellGeometry.dispose();
        shellMaterial.dispose();
      }
    };
  };

  const setSkillQChargeFxActive = (active: boolean) => {
    skillQChargeAura.setVisible(active);
    if (!active) {
      skillQChargeAura.group.scale.setScalar(1);
    }
  };

  const updateSkillQChargeFx = (now: number) => {
    if (!skillQChargeState.active) {
      setSkillQChargeFxActive(false);
      return;
    }
    setSkillQChargeFxActive(true);
    const progress = THREE.MathUtils.clamp(
      (now - skillQChargeState.startAt) / skillQVolley.chargeMs,
      0,
      1
    );
    skillQChargeAura.update(now);
    const pulse = 1 + Math.sin(now * 0.02) * 0.05 + progress * 0.08;
    skillQChargeAura.group.scale.setScalar(pulse);
  };

  const clearSkillQArcDebuffEntry = (entry: SkillQArcDebuffEntry) => {
    entry.group.removeFromParent();
    entry.upperArcGeometry.dispose();
    entry.lowerArcGeometry.dispose();
    entry.orbGeometry.dispose();
    entry.arcMaterialA.dispose();
    entry.arcMaterialB.dispose();
    entry.orbMaterial.dispose();
    activeSkillQArcDebuffs.delete(entry.targetId);
  };

  const clearAllSkillQArcDebuffs = () => {
    const entries = Array.from(activeSkillQArcDebuffs.values());
    for (let i = 0; i < entries.length; i += 1) {
      clearSkillQArcDebuffEntry(entries[i]);
    }
  };

  const resolveSkillQArcAnchor = (targetObject: THREE.Object3D) => {
    targetObject.updateMatrixWorld(true);
    skillQArcBounds.setFromObject(targetObject);

    if (skillQArcBounds.isEmpty()) {
      targetObject.getWorldPosition(skillQArcCenterWorld);
      skillQArcCenterLocal.copy(skillQArcCenterWorld);
      targetObject.worldToLocal(skillQArcCenterLocal);
      return {
        radius: 1,
        centerLocal: skillQArcCenterLocal.clone(),
      };
    }

    skillQArcBounds.getBoundingSphere(skillQArcSphere);
    skillQArcCenterWorld.copy(skillQArcSphere.center);
    skillQArcCenterLocal.copy(skillQArcCenterWorld);
    targetObject.worldToLocal(skillQArcCenterLocal);

    return {
      radius: THREE.MathUtils.clamp(
        skillQArcSphere.radius * 0.54,
        skillQArcDebuff.minRadius,
        skillQArcDebuff.maxRadius
      ),
      centerLocal: skillQArcCenterLocal.clone(),
    };
  };

  const applySkillQArcDebuff = ({
    targetId,
    targetObject,
    isTargetActive,
    dealDamageToTarget,
    now,
  }: {
    targetId: string;
    targetObject: THREE.Object3D;
    isTargetActive: () => boolean;
    dealDamageToTarget: (damage: number, now?: number) => void;
    now: number;
  }) => {
    const existing = activeSkillQArcDebuffs.get(targetId);
    if (existing) {
      existing.targetObject = targetObject;
      existing.isTargetActive = isTargetActive;
      existing.dealDamageToTarget = dealDamageToTarget;
      existing.expiresAt = now + skillQArcDebuff.durationMs;
      existing.nextTickAt = Math.min(
        existing.nextTickAt,
        now + skillQArcDebuff.tickMs
      );
      if (existing.group.parent !== targetObject) {
        const anchor = resolveSkillQArcAnchor(targetObject);
        existing.group.removeFromParent();
        targetObject.add(existing.group);
        existing.group.position.copy(anchor.centerLocal);
      }
      return;
    }

    const anchor = resolveSkillQArcAnchor(targetObject);
    const radius = anchor.radius;
    const tube = Math.max(0.03, radius * 0.14);
    const group = new THREE.Group();
    group.position.copy(anchor.centerLocal);
    targetObject.add(group);

    const upperArcGeometry = new THREE.TorusGeometry(
      radius,
      tube * 0.32,
      10,
      42,
      Math.PI * 1.34
    );
    const lowerArcGeometry = new THREE.TorusGeometry(
      radius * 0.8,
      tube * 0.3,
      10,
      38,
      Math.PI * 1.18
    );
    const arcMaterialA = new THREE.MeshBasicMaterial({
      color: 0x86efac,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const arcMaterialB = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const upperArc = new THREE.Mesh(upperArcGeometry, arcMaterialA);
    const lowerArc = new THREE.Mesh(lowerArcGeometry, arcMaterialB);
    upperArc.rotation.x = Math.PI * 0.5;
    lowerArc.rotation.x = -Math.PI * 0.52;
    lowerArc.position.y = -radius * 0.12;
    group.add(upperArc, lowerArc);

    const orbGeometry = new THREE.SphereGeometry(
      Math.max(0.05, radius * 0.16),
      10,
      8
    );
    const orbMaterial = new THREE.MeshBasicMaterial({
      color: 0xdcfce7,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const orbs: SkillQArcOrb[] = Array.from({ length: 6 }, () => {
      const mesh = new THREE.Mesh(orbGeometry, orbMaterial);
      group.add(mesh);
      return {
        mesh,
        orbitRadius: radius * THREE.MathUtils.lerp(0.62, 1.08, Math.random()),
        orbitSpeed: THREE.MathUtils.lerp(3.2, 6.8, Math.random()),
        heightOffset: radius * THREE.MathUtils.lerp(-0.32, 0.34, Math.random()),
        phase: Math.random() * Math.PI * 2,
      };
    });

    activeSkillQArcDebuffs.set(targetId, {
      targetId,
      targetObject,
      isTargetActive,
      dealDamageToTarget,
      expiresAt: now + skillQArcDebuff.durationMs,
      nextTickAt: now + skillQArcDebuff.tickMs,
      group,
      upperArc,
      lowerArc,
      arcMaterialA,
      arcMaterialB,
      orbMaterial,
      upperArcGeometry,
      lowerArcGeometry,
      orbGeometry,
      orbs,
      radius,
      phase: Math.random() * Math.PI * 2,
    });
  };

  const updateSkillQArcDebuffs = (now: number) => {
    if (!activeSkillQArcDebuffs.size) return;

    const entries = Array.from(activeSkillQArcDebuffs.values());
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      let targetActive = false;
      try {
        targetActive = entry.isTargetActive();
      } catch {
        targetActive = false;
      }

      if (!entry.targetObject.parent || !targetActive) {
        clearSkillQArcDebuffEntry(entry);
        continue;
      }

      const t = now * 0.001 + entry.phase;
      entry.upperArc.rotation.y = t * 5.6;
      entry.upperArc.rotation.z = Math.sin(t * 2.1) * 0.34;
      entry.lowerArc.rotation.y = -t * 4.7;
      entry.lowerArc.rotation.z = Math.sin(t * 2.6 + 0.8) * -0.3;

      const arcPulse = 0.86 + Math.sin(now * 0.02 + entry.phase) * 0.2;
      entry.arcMaterialA.opacity = THREE.MathUtils.clamp(
        0.62 * arcPulse,
        0.22,
        0.9
      );
      entry.arcMaterialB.opacity = THREE.MathUtils.clamp(
        0.46 * arcPulse,
        0.18,
        0.74
      );
      entry.orbMaterial.opacity = THREE.MathUtils.clamp(
        0.86 + Math.sin(now * 0.024 + entry.phase) * 0.08,
        0.62,
        0.96
      );

      for (let j = 0; j < entry.orbs.length; j += 1) {
        const orb = entry.orbs[j];
        const orbitAngle = t * orb.orbitSpeed + orb.phase;
        const radialJitter = entry.radius * 0.14;
        const radial =
          orb.orbitRadius + Math.sin(t * 2.9 + orb.phase * 1.4) * radialJitter;
        orb.mesh.position.set(
          Math.cos(orbitAngle) * radial,
          orb.heightOffset + Math.sin(t * 3.7 + orb.phase) * entry.radius * 0.18,
          Math.sin(orbitAngle) * radial
        );
      }

      while (entry.nextTickAt <= entry.expiresAt && now >= entry.nextTickAt) {
        entry.dealDamageToTarget(skillQArcDebuff.tickDamage, entry.nextTickAt);
        entry.nextTickAt += skillQArcDebuff.tickMs;
      }

      if (now >= entry.expiresAt && entry.nextTickAt > entry.expiresAt) {
        clearSkillQArcDebuffEntry(entry);
      }
    }
  };

  const updateSkillRVortex = (now: number) => {
    if (!skillRSphere.visible) {
      skillRVortexGroup.visible = false;
      return;
    }
    skillRVortexGroup.visible = true;
    const t = now * 0.001;

    const corePulse = 1 + Math.sin(now * 0.018) * 0.08;
    skillRVortexCore.scale.setScalar(corePulse);
    skillRVortexCoreMaterial.opacity = THREE.MathUtils.clamp(
      0.34 + Math.sin(now * 0.015) * 0.08,
      0.24,
      0.46
    );
    skillRVortexRingMaterial.opacity = THREE.MathUtils.clamp(
      0.42 + Math.sin(now * 0.012) * 0.1,
      0.28,
      0.56
    );
    skillRVortexOrbMaterial.opacity = THREE.MathUtils.clamp(
      0.8 + Math.sin(now * 0.022) * 0.1,
      0.64,
      0.92
    );

    for (let i = 0; i < skillRVortexRings.length; i += 1) {
      const ring = skillRVortexRings[i];
      const wobble = Math.sin(t * ring.wobbleSpeed + ring.phase) * ring.wobbleAmount;
      ring.mesh.rotation.set(
        ring.tiltX + wobble,
        ring.tiltY + t * ring.yawSpeed,
        ring.tiltZ + wobble * 0.65
      );
    }

    const radialJitter = skillRSphereConfig.radius * 0.08;
    const verticalJitter = skillRSphereConfig.radius * 0.11;
    for (let i = 0; i < skillRVortexOrbs.length; i += 1) {
      const orb = skillRVortexOrbs[i];
      const orbitAngle = t * orb.orbitSpeed + orb.phase;
      const radialOffset =
        orb.orbitRadius + Math.sin(t * orb.swirlSpeed + orb.phase * 1.7) * radialJitter;
      orb.mesh.position.set(
        Math.cos(orbitAngle) * radialOffset,
        orb.orbitYOffset +
          Math.sin(t * orb.swirlSpeed * 1.12 + orb.phase) * verticalJitter,
        Math.sin(orbitAngle) * radialOffset
      );
      orb.mesh.rotation.y = orbitAngle * 1.15;
    }
  };

  const applySkillRContactDamage = (now: number) => {
    if (!skillR.active || !skillRSphere.visible || !performMeleeAttack) return;
    if (skillRContact.nextTickAt <= 0) {
      skillRContact.nextTickAt = now + skillRContact.intervalMs;
      return;
    }
    if (now < skillRContact.nextTickAt) return;

    skillRSphere.updateMatrixWorld(true);
    skillRSphere.getWorldPosition(skillRContactCenterWorld);
    skillRSphere.getWorldScale(skillRSphereWorldScale);
    const sphereScale = Math.max(
      skillRSphereWorldScale.x,
      skillRSphereWorldScale.y,
      skillRSphereWorldScale.z
    );
    const contactRadius = Math.max(
      0.35,
      skillRSphereConfig.radius * sphereScale * 0.65
    );

    skillRContactDirection.set(0, 0, 1).applyQuaternion(avatar.quaternion);
    skillRContactDirection.y = 0;
    if (skillRContactDirection.lengthSq() < 0.000001) {
      skillRContactDirection.set(0, 0, 1);
    } else {
      skillRContactDirection.normalize();
    }

    while (now >= skillRContact.nextTickAt) {
      performMeleeAttack({
        damage: skillRContact.damage,
        maxDistance: 0.1,
        maxHits: skillRContact.maxHits,
        origin: skillRContactCenterWorld,
        direction: skillRContactDirection,
        contactCenter: skillRContactCenterWorld,
        contactRadius,
      });
      skillRContact.nextTickAt += skillRContact.intervalMs;
    }
  };

  const updateSkillRSphereTransform = (
    now: number,
    leftArm: THREE.Object3D | null,
    rightArm: THREE.Object3D | null
  ) => {
    if (!skillR.active) return;

    if (leftArm && rightArm) {
      leftArm.getWorldPosition(skillRLeftArmWorld);
      rightArm.getWorldPosition(skillRRightArmWorld);
      skillRArmMidpoint
        .copy(skillRLeftArmWorld)
        .add(skillRRightArmWorld)
        .multiplyScalar(0.5);
    } else {
      avatar.getWorldPosition(skillRArmMidpoint);
      skillRArmMidpoint.y += 1.2;
    }

    skillRForwardWorld.set(0, 0, 1).applyQuaternion(avatar.quaternion);
    skillRForwardWorld.y = 0;
    if (skillRForwardWorld.lengthSq() < 0.000001) {
      skillRForwardWorld.set(0, 0, 1);
    } else {
      skillRForwardWorld.normalize();
    }

    skillRArmMidpoint.y += 0.12;
    skillRArmMidpoint.addScaledVector(
      skillRForwardWorld,
      skillRSphereConfig.forwardOffset
    );

    avatar.updateMatrixWorld(true);
    skillRSphere.position.copy(avatar.worldToLocal(skillRArmMidpoint));
    const pulse = 1 + Math.sin(now * 0.012) * 0.04;
    skillRSphere.scale.setScalar(pulse);
    skillRSphereMaterial.emissiveIntensity = 1.05 + Math.sin(now * 0.02) * 0.2;
    skillRSphere.updateMatrixWorld(true);
    updateSkillRVortex(now);
    applySkillRContactDamage(now);
  };

  const handleSkillR = () => {
    if (skillQChargeState.active) return false;
    if (skillR.active || skillRSphereInFlight) return false;
    const now = performance.now();
    cancelCharge();
    armBase.captured = false;
    skillR.active = true;
    skillR.expiresAt = now + skillRDurationMs;
    skillRContact.nextTickAt = now + skillRContact.intervalMs;
    skillRSphere.visible = true;
    return true;
  };

  const fireSkillQVolley = (now: number) => {
    if (!fireProjectile) return;

    avatar.updateMatrixWorld(true);
    avatar.getWorldPosition(skillQOrigin);
    skillQBaseDirection.copy(skillQAimDirection);
    if (skillQBaseDirection.lengthSq() < 0.000001) {
      skillQBaseDirection.set(0, 0, 1).applyQuaternion(avatar.quaternion);
    }
    skillQBaseDirection.normalize();

    skillQRight.crossVectors(skillQUp, skillQBaseDirection);
    if (skillQRight.lengthSq() < 0.000001) {
      skillQRight.set(1, 0, 0).applyQuaternion(avatar.quaternion);
    }
    if (skillQRight.lengthSq() < 0.000001) {
      skillQRight.set(1, 0, 0);
    } else {
      skillQRight.normalize();
    }

    skillQOrigin
      .addScaledVector(skillQBaseDirection, skillQVolley.forwardSpawnOffset);
    skillQOrigin.y += skillQVolley.verticalSpawnOffset;
    const lifetime = skillQVolley.distance / skillQVolley.speed;
    const volleyDamage = skillQVolley.ballDamage;
    const sideOffsets = [0, 1, -1];
    const volleyHitCountsByTarget = new Map<string, number>();
    const volleyArcAppliedTargets = new Set<string>();

    for (let i = 0; i < sideOffsets.length; i += 1) {
      const side = sideOffsets[i];
      const entry = acquireSkillQProjectile();
      const yawOffset = side * skillQVolley.spreadRad;

      skillQShotDirection
        .copy(skillQBaseDirection)
        .applyAxisAngle(skillQUp, yawOffset)
        .normalize();
      skillQShotOrigin
        .copy(skillQOrigin)
        .addScaledVector(skillQRight, side * skillQVolley.lateralSpacing);

      entry.mesh.visible = true;
      entry.aura.setVisible(true);
      entry.aura.update(now);
      fireProjectile({
        projectileType: "abilityOrb",
        origin: skillQShotOrigin,
        direction: skillQShotDirection,
        mesh: entry.mesh,
        radius: skillQVolley.radius,
        targetHitRadius: skillQVolley.targetHitRadius,
        speed: skillQVolley.speed,
        lifetime,
        damage: volleyDamage,
        energyGainOnHit: 8,
        splitOnImpact: false,
        removeOnTargetHit: false,
        singleHitPerTarget: true,
        lifecycle: {
          onTargetHit: ({
            now: hitNow,
            targetId,
            targetObject,
            isTargetActive,
            dealDamageToTarget,
          }) => {
            const hitCount = (volleyHitCountsByTarget.get(targetId) ?? 0) + 1;
            volleyHitCountsByTarget.set(targetId, hitCount);
            if (
              hitCount >= skillQArcDebuff.triggerHitCount &&
              !volleyArcAppliedTargets.has(targetId)
            ) {
              volleyArcAppliedTargets.add(targetId);
              applySkillQArcDebuff({
                targetId,
                targetObject,
                isTargetActive,
                dealDamageToTarget,
                now: hitNow,
              });
            }
          },
          applyForces: () => {
            entry.aura.update(performance.now());
            entry.mesh.rotation.x += 0.08;
            entry.mesh.rotation.y += 0.14;
          },
          onRemove: () => {
            entry.aura.setVisible(false);
            entry.mesh.rotation.set(0, 0, 0);
          },
        },
      });
    }
  };

  const handleSkillQ = () => {
    if (!fireProjectile) return false;
    if (skillQChargeState.active) return false;
    if (skillR.active || skillRSphereInFlight) return false;

    const now = performance.now();
    cancelCharge();
    armBase.captured = false;
    skillQChargeState.active = true;
    skillQChargeState.startAt = now;
    skillQChargeState.fireAt = now + skillQVolley.chargeMs;
    return true;
  };

  const launchSkillRCombo = (now: number) => {
    if (!skillR.active || skillRSphereInFlight || !fireProjectile) return false;
    const worldRoot = avatar.parent;
    if (!worldRoot) return false;
    cancelCharge();
    deactivateSkillE(false);
    avatar.updateMatrixWorld(true);
    skillRSphere.updateMatrixWorld(true);
    skillRSphere.getWorldPosition(skillRSphereLaunchOrigin);
    skillRSphere.removeFromParent();
    worldRoot.add(skillRSphere);
    skillRSphere.position.copy(skillRSphereLaunchOrigin);
    skillRSphere.visible = true;
    armReset.pending = true;
    skillR.active = false;
    skillR.expiresAt = 0;
    skillRContact.nextTickAt = 0;
    skillRSphereInFlight = true;

    const lifetime = skillRECombo.distance / skillRECombo.speed;
    fireProjectile({
      projectileType: "abilityOrb",
      origin: skillRSphereLaunchOrigin,
      mesh: skillRSphere,
      radius: skillRSphereConfig.radius,
      speed: skillRECombo.speed,
      lifetime,
      damage: skillRECombo.damage,
      energyGainOnHit: 8,
      splitOnImpact: true,
      explosionRadius: skillRECombo.explosionRadius,
      explosionDamage: skillRComboExplosionDamage,
      lifecycle: {
        applyForces: () => {
          updateSkillRVortex(performance.now());
        },
        onRemove: ({ reason, triggerExplosion, position }) => {
          if (reason === "expired") {
            triggerExplosion();
          }
          if (reason !== "cleared") {
            spawnSkillRExplosionRangeFx(
              worldRoot,
              position.clone(),
              skillRECombo.explosionRadius
            );
          }
          skillRSphereInFlight = false;
          resetSkillRSphereAttachment();
        },
      },
    });
    if (!bypassCooldown) {
      skillE.cooldownUntil = now + skillECooldownMs;
    }
    return true;
  };

  const detonateSkillRInPlace = (now: number) => {
    if (!skillR.active || skillRSphereInFlight || !fireProjectile) return false;
    const worldRoot = avatar.parent;
    if (!worldRoot) return false;

    cancelCharge();
    deactivateSkillE(false);
    avatar.updateMatrixWorld(true);
    skillRSphere.updateMatrixWorld(true);
    skillRSphere.getWorldPosition(skillRSphereLaunchOrigin);
    skillRExplosionDirection.set(0, 0, 1).applyQuaternion(avatar.quaternion);
    if (skillRExplosionDirection.lengthSq() < 0.000001) {
      skillRExplosionDirection.set(0, 0, 1);
    } else {
      skillRExplosionDirection.normalize();
    }

    skillRSphere.removeFromParent();
    worldRoot.add(skillRSphere);
    skillRSphere.position.copy(skillRSphereLaunchOrigin);
    skillRSphere.visible = true;
    armReset.pending = true;
    skillR.active = false;
    skillR.expiresAt = 0;
    skillRContact.nextTickAt = 0;
    skillRSphereInFlight = true;

    fireProjectile({
      projectileType: "abilityOrb",
      origin: skillRSphereLaunchOrigin,
      direction: skillRExplosionDirection,
      mesh: skillRSphere,
      radius: skillRSphereConfig.radius,
      speed: 0,
      gravity: 0,
      lifetime: 0.02,
      damage: 0,
      energyGainOnHit: 0,
      splitOnImpact: true,
      explosionRadius: skillRECombo.explosionRadius,
      explosionDamage: skillRComboExplosionDamage,
      removeOnTargetHit: false,
      removeOnWorldHit: false,
      lifecycle: {
        applyForces: () => {
          updateSkillRVortex(performance.now());
        },
        onRemove: ({ reason, triggerExplosion, position }) => {
          if (reason === "expired") {
            triggerExplosion();
          }
          if (reason !== "cleared") {
            spawnSkillRExplosionRangeFx(
              worldRoot,
              position.clone(),
              skillRECombo.explosionRadius
            );
          }
          skillRSphereInFlight = false;
          resetSkillRSphereAttachment();
        },
      },
    });

    return true;
  };

  const handleSkillE = () => {
    if (skillQChargeState.active) return false;
    const now = performance.now();
    if (!bypassCooldown && now < skillE.cooldownUntil) {
      return false;
    }
    if (skillR.active) {
      return launchSkillRCombo(now);
    }
    if (skillE.active) return false;
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
    const baseDamage = resolveBaseProjectileDamage(speed);
    if (skillE.active) {
      fireProjectile({
        projectileType: "abilityOrb",
        speed,
        lifetime,
        color: 0x22c55e,
        emissive: 0x22c55e,
        emissiveIntensity: 0.9,
        scale: 12.24,
        damage: resolveEmpoweredBasicAttackDamage(speed),
        energyGainOnHit: 8,
        splitOnImpact: true,
        explosionRadius: 10.8,
        explosionDamage: baseDamage,
      });
      deactivateSkillE(true);
    } else {
      fireProjectile({
        projectileType: "abilityOrb",
        speed,
        lifetime,
        energyGainOnHit: 4,
      });
    }
    chargeState.releaseUntil = now + chargeConfig.releaseMs;
    hud.setVisible(true);
    hud.setRatio(ratio);
  };

  const resetState = () => {
    chargeState.startTime = 0;
    chargeState.ratio = 0;
    chargeState.releaseUntil = 0;
    skillQChargeState.active = false;
    skillQChargeState.startAt = 0;
    skillQChargeState.fireAt = 0;
    skillE.cooldownUntil = 0;
    armAnim.raise = 0;
    armReset.pending = false;
    armPoseRestore.pendingNeutralTwist = false;
    armBase.captured = false;
    armNeutral.captured = false;
    armNeutral.rightId = "";
    armNeutral.leftId = "";
    cancelCharge();
    deactivateSkillE(false);
    deactivateSkillR();
    setSkillQChargeFxActive(false);
    clearAllSkillQArcDebuffs();
    skillQProjectilePool.forEach((entry) => {
      entry.aura.setVisible(false);
      entry.mesh.rotation.set(0, 0, 0);
    });
    baseRuntime.resetState?.();
  };

  const getSkillCooldownRemainingMs = (key: SkillKey) => {
    if (key !== "e") return null;
    if (bypassCooldown) return 0;
    return Math.max(0, skillE.cooldownUntil - performance.now());
  };

  const getSkillCooldownDurationMs = (key: SkillKey) => {
    if (key !== "e") return null;
    return skillECooldownMs;
  };

  const getProjectileBlockers = () =>
    skillR.active && skillRSphere.visible
      ? activeProjectileBlockers
      : emptyProjectileBlockers;

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handleRightClick: (facing) => {
      if (skillQChargeState.active) return;
      if (skillR.active) {
        detonateSkillRInPlace(performance.now());
        return;
      }
      baseRuntime.handleRightClick(facing);
    },
    handleSkillQ,
    handlePrimaryDown: () => {
      if (skillR.active) {
        detonateSkillRInPlace(performance.now());
        return;
      }
      beginCharge();
    },
    handlePrimaryUp: releaseCharge,
    handlePrimaryCancel: cancelCharge,
    handleSkillE,
    handleSkillR,
    getProjectileBlockers,
    isMovementLocked: () => skillR.active || skillQChargeState.active,
    getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs,
    resetState,
    update: (args) => {
      baseRuntime.update(args);
      if (args.avatarModel) {
        skillGlow.bindModel(args.avatarModel);
      }
      skillGlow.update(args.now);
      if (args.aimDirectionWorld && args.aimDirectionWorld.lengthSq() > 0.000001) {
        skillQAimDirection.copy(args.aimDirectionWorld).normalize();
      }
      if (skillE.active && args.now >= skillE.expiresAt) {
        deactivateSkillE(true);
      }
      if (skillR.active && args.now >= skillR.expiresAt) {
        deactivateSkillR();
      }
      if (skillQChargeState.active && args.now >= skillQChargeState.fireAt) {
        skillQChargeState.active = false;
        skillQChargeState.startAt = 0;
        skillQChargeState.fireAt = 0;
        armReset.pending = true;
        fireSkillQVolley(args.now);
      }
      updateSkillQChargeFx(args.now);
      updateSkillQArcDebuffs(args.now);
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
          captureArmNeutralIfNeeded(rightArm, leftArm);
          if (armPoseRestore.pendingNeutralTwist) {
            restoreArmNeutralTwist(rightArm, leftArm);
            armBase.captured = false;
            armPoseRestore.pendingNeutralTwist = false;
          }

          if (armReset.pending) {
            if (armBase.captured) {
              const sameTargets =
                armBase.rightId === rightArm.uuid && armBase.leftId === leftArm.uuid;
              if (sameTargets) {
                rightArm.quaternion.copy(armBase.right);
                leftArm.quaternion.copy(armBase.left);
              }
            }
            restoreArmNeutralTwist(rightArm, leftArm);
            armReset.pending = false;
            armBase.captured = false;
            return;
          }

          if (skillQChargeState.active) {
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

            const progress = THREE.MathUtils.clamp(
              (args.now - skillQChargeState.startAt) / skillQVolley.chargeMs,
              0,
              1
            );
            const pushAngle =
              -0.62 - progress * 0.78 + Math.sin(args.now * 0.024) * 0.06;
            const sideSpread = 0.16 + Math.sin(args.now * 0.021) * 0.03;

            raiseQuat.setFromAxisAngle(raiseAxis, pushAngle);
            skillRRightQuat.setFromAxisAngle(throwAxis, -sideSpread);
            skillRLeftQuat.setFromAxisAngle(throwAxis, sideSpread);

            rightArm.quaternion
              .copy(armBase.right)
              .premultiply(raiseQuat)
              .premultiply(skillRRightQuat);
            leftArm.quaternion
              .copy(armBase.left)
              .premultiply(raiseQuat)
              .premultiply(skillRLeftQuat);
            return;
          }

          if (skillR.active) {
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

            const pushAngle = -1.12 + Math.sin(args.now * 0.018) * 0.07;
            const sideSpread = 0.22;

            raiseQuat.setFromAxisAngle(raiseAxis, pushAngle);
            skillRRightQuat.setFromAxisAngle(throwAxis, -sideSpread);
            skillRLeftQuat.setFromAxisAngle(throwAxis, sideSpread);

            rightArm.quaternion
              .copy(armBase.right)
              .premultiply(raiseQuat)
              .premultiply(skillRRightQuat);
            leftArm.quaternion
              .copy(armBase.left)
              .premultiply(raiseQuat)
              .premultiply(skillRLeftQuat);

            updateSkillRSphereTransform(args.now, leftArm, rightArm);
            return;
          }

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
            if (armBase.captured) {
              const sameTargets =
                armBase.rightId === rightArm.uuid && armBase.leftId === leftArm.uuid;
              if (sameTargets) {
                rightArm.quaternion.copy(armBase.right);
                leftArm.quaternion.copy(armBase.left);
              }
            }
            restoreArmNeutralTwist(rightArm, leftArm);
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
      if (skillR.active) {
        updateSkillRSphereTransform(args.now, null, null);
      }
    },
    dispose: () => {
      resetState();
      skillGlow.dispose();
      hud.dispose();
      skillRSphere.removeFromParent();
      skillRVortexGroup.removeFromParent();
      skillRVortexCoreGeometry.dispose();
      skillRVortexCoreMaterial.dispose();
      skillRVortexRingGeometry.dispose();
      skillRVortexRingMaterial.dispose();
      skillRVortexOrbGeometry.dispose();
      skillRVortexOrbMaterial.dispose();
      skillRSphereGeometry.dispose();
      skillRSphereMaterial.dispose();
      skillQChargeAura.group.removeFromParent();
      skillQChargeAura.dispose();
      skillQProjectilePool.forEach((entry) => {
        entry.aura.dispose();
        entry.mesh.removeFromParent();
      });
      skillQProjectileGeometry.dispose();
      skillQProjectileMaterial.dispose();
      baseRuntime.dispose();
    },
    isFacingLocked: baseRuntime.isFacingLocked,
  });
};




