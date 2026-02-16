import * as THREE from "three";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import type {
  CharacterRuntimeFactory,
  CharacterRuntimeTickArgs,
  SkillKey,
} from "../general/types";
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

type DemonFaceFlickerFx = {
  setActive: (active: boolean) => void;
  update: (now: number) => void;
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

type DemonMaterialSnapshot = {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  blending: THREE.Blending;
};

type DemonRingParticleState = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
};

type DemonTransitionPhase = "none" | "in" | "out";

type DemonTransitionParticleState = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  startedAt: number;
  lifeMs: number;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  baseRotation: THREE.Vector3;
  spin: THREE.Vector3;
};

type DemonShockwaveDamageWave = {
  startedAt: number;
  lastTickAt: number;
  durationMs: number;
  tickIntervalMs: number;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  travelDistance: number;
  startRadius: number;
  endRadius: number;
  damage: number;
  maxHits: number;
  hitTargetIds: Set<string>;
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

const createDemonFaceFlickerFx = (avatar: THREE.Object3D): DemonFaceFlickerFx => {
  let active = false;
  let lastUpdateAt = 0;
  let flickerElapsed = 0;
  let isWhite = true;
  const flickerInterval = 0.25;
  let targetMesh: THREE.Mesh | null = null;
  const materialEntries: Array<{
    material: THREE.Material & {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    };
    baseColor?: THREE.Color;
    baseEmissive?: THREE.Color;
    baseEmissiveIntensity: number;
  }> = [];

  const clearMaterials = () => {
    for (let i = 0; i < materialEntries.length; i += 1) {
      materialEntries[i].material.dispose();
    }
    materialEntries.length = 0;
  };

  const resolveTarget = () => {
    if (targetMesh?.parent && materialEntries.length > 0) return;
    targetMesh = null;
    clearMaterials();

    let visorCandidate: THREE.Mesh | null = null;
    let faceCandidate: THREE.Mesh | null = null;
    let headCandidate: THREE.Mesh | null = null;
    avatar.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const name = (node.name || "").toLowerCase();
      if (!visorCandidate && name === "visor") {
        visorCandidate = node;
        return;
      }
      if (!faceCandidate && name.includes("face")) {
        faceCandidate = node;
      }
      if (!headCandidate && name === "headball") {
        headCandidate = node;
      }
    });
    targetMesh = visorCandidate ?? faceCandidate ?? headCandidate;
    if (!targetMesh) return;

    const sourceMaterials = Array.isArray(targetMesh.material)
      ? targetMesh.material
      : [targetMesh.material];
    if (!sourceMaterials.length) return;

    const clonedMaterials = sourceMaterials.map(
      (material) =>
        material.clone() as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
          emissiveIntensity?: number;
        }
    );
    targetMesh.material = Array.isArray(targetMesh.material)
      ? clonedMaterials
      : clonedMaterials[0];

    for (let i = 0; i < clonedMaterials.length; i += 1) {
      const material = clonedMaterials[i];
      materialEntries.push({
        material,
        baseColor: material.color?.clone(),
        baseEmissive: material.emissive?.clone(),
        baseEmissiveIntensity: material.emissiveIntensity ?? 0,
      });
    }
  };

  const applyPalette = () => {
    if (!materialEntries.length) return;
    if (active) {
      for (let i = 0; i < materialEntries.length; i += 1) {
        const entry = materialEntries[i];
        if (isWhite) {
          entry.material.color?.set(0xffffff);
          entry.material.emissive?.set(0xffffff);
          entry.material.emissiveIntensity = 0.82;
        } else {
          entry.material.color?.set(0x000000);
          entry.material.emissive?.set(0x000000);
          entry.material.emissiveIntensity = 0;
        }
      }
      return;
    }
    for (let i = 0; i < materialEntries.length; i += 1) {
      const entry = materialEntries[i];
      if (entry.baseColor) {
        entry.material.color?.copy(entry.baseColor);
      }
      if (entry.baseEmissive) {
        entry.material.emissive?.copy(entry.baseEmissive);
      }
      entry.material.emissiveIntensity = entry.baseEmissiveIntensity;
    }
  };

  return {
    setActive: (nextActive) => {
      active = nextActive;
      if (!active) {
        lastUpdateAt = 0;
        flickerElapsed = 0;
        isWhite = true;
      }
      resolveTarget();
      applyPalette();
    },
    update: (now) => {
      if (!active) return;
      resolveTarget();
      const deltaSeconds =
        lastUpdateAt > 0
          ? THREE.MathUtils.clamp((now - lastUpdateAt) / 1000, 0, 0.08)
          : 0;
      lastUpdateAt = now;
      flickerElapsed += deltaSeconds;
      while (flickerElapsed >= flickerInterval) {
        flickerElapsed -= flickerInterval;
        isWhite = !isWhite;
      }
      applyPalette();
    },
    dispose: () => {
      clearMaterials();
      targetMesh = null;
    },
  };
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  fireProjectile,
  applyHealth,
  performMeleeAttack,
  applyEnergy,
  applyMana,
  clearSkillCooldown,
  mount,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const chargeHud = createCarrotChargeHud(mount);
  const demonFaceFlickerFx = createDemonFaceFlickerFx(avatar);

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
    handModelRadiusScale: 1.06,
    handModelMinRadius: 0.76,
    handContactRadiusFallback: 0.92,
    handContactRadiusByCharge: 0.22,
    handContactForwardOffsetFallback: 0.62,
    handContactForwardOffsetByCharge: 0.24,
    handMaxHits: 8,
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
    deepSpreadYawOffsets: [-0.52, 0, 0.52],
    deepLaneOffsets: [-2.4, 0, 2.4],
    deepScaleMultiplier: 1.38,
    deepCollisionScale: 1.22,
    deepSwayAmplitude: 0.48,
    deepSwayFrequency: 7.8,
  };
  const passiveManaRegenConfig = {
    intervalMs: 2000,
    amount: 1,
  };
  const demonFormConfig = {
    durationMs: 10000,
    transformInDurationMs: 1500,
    transformOutDurationMs: 1000,
    scaleMultiplier: 1.5,
    cameraScaleMultiplier: 1.5,
    damageTakenMultiplier: 1 / 3,
    healOnEnd: 25,
    transitionParticleSpawnPerSec: 92,
    transitionParticleLifeMinMs: 520,
    transitionParticleLifeMaxMs: 1300,
    projectileFireIntervalMs: 500,
    projectileEyeForwardOffset: 0.72,
    projectileForwardSpawnOffset: 1.45,
    projectileVerticalSpawnOffset: 3.6,
    projectileSpeed: 24,
    projectileLifetime: 2.2,
    projectileDamage: 26,
    projectileRadius: 0.24,
    projectileTargetHitRadius: 1.12,
    projectileScale: 2.8,
    projectileColor: 0xa855f7,
    projectileEmissive: 0x6d28d9,
    projectileEmissiveIntensity: 1.32,
    projectileExplosionRadius: 2.6,
    projectileExplosionDamage: 0,
    projectileExplosionColor: 0xd8b4fe,
    projectileExplosionEmissive: 0x9333ea,
    projectileExplosionEmissiveIntensity: 1.42,
    projectileShockwavePrimaryDurationMs: 420,
    projectileShockwaveSecondaryDurationMs: 600,
    projectileShockwaveTickIntervalMs: 72,
    projectileShockwavePrimarySpeed: 4.2,
    projectileShockwaveSecondarySpeed: 3.2,
    projectileShockwavePrimaryStartRadius: 0.88,
    projectileShockwavePrimaryEndRadius: 4.55,
    projectileShockwaveSecondaryStartRadius: 1.3,
    projectileShockwaveSecondaryEndRadius: 5.72,
    projectileShockwaveDamage: 16,
    projectileShockwaveMaxHits: 50,
    demonESummonScaleMultiplier: 0.5625,
    demonEProjectileScale: 10.7136,
    bodyColor: 0x4c1d95,
    bodyEmissive: 0x6d28d9,
    bodyEmissiveIntensity: 0.42,
    bodyRoughness: 0.5,
    bodyMetalness: 0.22,
  };
  let passiveManaElapsedMs = 0;
  const demonFormState = {
    active: false,
    startedAt: 0,
    endsAt: 0,
    transitionPhase: "none" as DemonTransitionPhase,
    transitionStartedAt: 0,
    transitionEndsAt: 0,
    projectileCooldownUntil: 0,
    hasAvatarBaseScale: false,
    avatarBaseScale: new THREE.Vector3(1, 1, 1),
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
    hitTargetIds: new Set<string>(),
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
  const mirrorReflectXMatrix = new THREE.Matrix4().makeScale(-1, 1, 1);
  const mirrorAvatarInverseMatrix = new THREE.Matrix4();
  const mirrorSourceMatrix = new THREE.Matrix4();
  const mirrorResultMatrix = new THREE.Matrix4();
  const runtimeAimDirection = new THREE.Vector3(0, 0, 1);
  const runtimeAimOrigin = new THREE.Vector3();
  let hasRuntimeAimDirection = false;
  let hasRuntimeAimOrigin = false;
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
  const punchContactCenter = new THREE.Vector3();
  const punchHandBounds = new THREE.Box3();
  const punchHandSphere = new THREE.Sphere();
  const punchAimParentQuaternion = new THREE.Quaternion();
  const punchAimAvatarQuaternion = new THREE.Quaternion();
  const demonProjectileSpawnOrigin = new THREE.Vector3();
  const demonProjectileDirection = new THREE.Vector3();
  const demonShockwaveUp = new THREE.Vector3(0, 1, 0);
  const demonShockwaveForwardFlat = new THREE.Vector3();
  const demonShockwaveLateralDirection = new THREE.Vector3();
  const demonShockwaveCenter = new THREE.Vector3();
  const demonShockwaveHitDirection = new THREE.Vector3();
  const demonShockwaveWaves: DemonShockwaveDamageWave[] = [];
  const demonMaterialSnapshots = new Map<THREE.Material, DemonMaterialSnapshot>();
  const demonPurpleColor = new THREE.Color(demonFormConfig.bodyColor);
  const demonPurpleEmissive = new THREE.Color(demonFormConfig.bodyEmissive);
  const demonLegState = {
    left: null as THREE.Object3D | null,
    right: null as THREE.Object3D | null,
    leftVisible: true,
    rightVisible: true,
  };
  const demonMirrorArmState = {
    sourceArm: null as THREE.Object3D | null,
    mirrorArm: null as THREE.Object3D | null,
  };
  const demonFootRingRoot = new THREE.Group();
  demonFootRingRoot.visible = false;
  demonFootRingRoot.position.set(0, 0.35, 0);
  avatar.add(demonFootRingRoot);
  const demonFootRingMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.08, 0.13, 18, 56),
    new THREE.MeshStandardMaterial({
      color: 0x581c87,
      emissive: 0x7e22ce,
      emissiveIntensity: 1.12,
      transparent: true,
      opacity: 0.86,
      roughness: 0.26,
      metalness: 0.3,
      depthWrite: false,
    })
  );
  demonFootRingMesh.rotation.x = Math.PI / 2;
  demonFootRingRoot.add(demonFootRingMesh);
  const demonRingParticles: DemonRingParticleState[] = [];
  const demonRingParticleGeometry = new THREE.SphereGeometry(0.08, 8, 8);
  for (let i = 0; i < 26; i += 1) {
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particleMesh = new THREE.Mesh(demonRingParticleGeometry, particleMaterial);
    demonFootRingRoot.add(particleMesh);
    demonRingParticles.push({
      mesh: particleMesh,
      material: particleMaterial,
      phase: (i / 26) * Math.PI * 2 + Math.random() * 0.4,
      radius: 0.88 + Math.random() * 0.48,
      speed: 1.6 + Math.random() * 1.9,
      lift: 0.22 + Math.random() * 0.78,
    });
  }
  const demonTransitionFxRoot = new THREE.Group();
  demonTransitionFxRoot.userData.carrotPhantomExclude = true;
  demonTransitionFxRoot.visible = false;
  avatar.add(demonTransitionFxRoot);
  const demonTransitionParticleGeometry = new THREE.IcosahedronGeometry(0.1, 0);
  const demonTransitionParticles: DemonTransitionParticleState[] = [];
  for (let i = 0; i < 180; i += 1) {
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xd8b4fe,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particleMesh = new THREE.Mesh(
      demonTransitionParticleGeometry,
      particleMaterial
    );
    particleMesh.userData.carrotPhantomExclude = true;
    particleMesh.visible = false;
    demonTransitionFxRoot.add(particleMesh);
    demonTransitionParticles.push({
      mesh: particleMesh,
      material: particleMaterial,
      active: false,
      startedAt: 0,
      lifeMs: 0,
      origin: new THREE.Vector3(),
      direction: new THREE.Vector3(0, 1, 0),
      speed: 0,
      baseRotation: new THREE.Vector3(),
      spin: new THREE.Vector3(),
    });
  }
  const demonTransitionFxState = {
    active: false,
    phase: "in" as Exclude<DemonTransitionPhase, "none">,
    spawnCarry: 0,
    lastUpdatedAt: 0,
    cursor: 0,
  };
  const phantomModifier = createCarrotPhantomModifier({
    avatar,
    fireProjectile,
    applyHealth,
    applyEnergy,
    applyMana,
  });

  const updatePassiveManaRegen = (delta: number) => {
    if (!applyMana || delta <= 0) return;
    passiveManaElapsedMs += delta * 1000;
    if (passiveManaElapsedMs < passiveManaRegenConfig.intervalMs) return;
    const regenTicks = Math.floor(passiveManaElapsedMs / passiveManaRegenConfig.intervalMs);
    passiveManaElapsedMs -= regenTicks * passiveManaRegenConfig.intervalMs;
    applyMana(regenTicks * passiveManaRegenConfig.amount);
  };

  const getDemonMaterialSnapshot = (material: THREE.Material): DemonMaterialSnapshot => {
    const existing = demonMaterialSnapshots.get(material);
    if (existing) return existing;
    const target = material as THREE.Material & {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
      roughness?: number;
      metalness?: number;
    };
    const snapshot: DemonMaterialSnapshot = {
      color: target.color ? target.color.clone() : undefined,
      emissive: target.emissive ? target.emissive.clone() : undefined,
      emissiveIntensity:
        typeof target.emissiveIntensity === "number"
          ? target.emissiveIntensity
          : undefined,
      roughness: typeof target.roughness === "number" ? target.roughness : undefined,
      metalness: typeof target.metalness === "number" ? target.metalness : undefined,
      opacity: target.opacity,
      transparent: target.transparent,
      depthWrite: target.depthWrite,
      blending: target.blending,
    };
    demonMaterialSnapshots.set(material, snapshot);
    return snapshot;
  };

  const forEachDemonMaterial = (
    callback: (
      material: THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
        roughness?: number;
        metalness?: number;
      },
      snapshot: DemonMaterialSnapshot
    ) => void
  ) => {
    avatar.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (object.userData?.carrotPhantomExclude) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (let i = 0; i < materials.length; i += 1) {
        const material = materials[i];
        if (!material) continue;
        if (material.userData?.carrotPhantomExclude) continue;
        const snapshot = getDemonMaterialSnapshot(material);
        callback(material, snapshot);
      }
    });
  };

  const applyDemonFormMaterials = () => {
    forEachDemonMaterial((material) => {
      if (material.color) {
        material.color.copy(demonPurpleColor);
      }
      if (material.emissive) {
        material.emissive.copy(demonPurpleEmissive);
      }
      if (typeof material.emissiveIntensity === "number") {
        material.emissiveIntensity = demonFormConfig.bodyEmissiveIntensity;
      }
      if (typeof material.roughness === "number") {
        material.roughness = demonFormConfig.bodyRoughness;
      }
      if (typeof material.metalness === "number") {
        material.metalness = demonFormConfig.bodyMetalness;
      }
      material.needsUpdate = true;
    });
  };

  const restoreDemonFormMaterials = () => {
    demonMaterialSnapshots.forEach((snapshot, material) => {
      const target = material as THREE.Material & {
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
        roughness?: number;
        metalness?: number;
      };
      if (snapshot.color && target.color) {
        target.color.copy(snapshot.color);
      }
      if (snapshot.emissive && target.emissive) {
        target.emissive.copy(snapshot.emissive);
      }
      if (
        snapshot.emissiveIntensity !== undefined &&
        typeof target.emissiveIntensity === "number"
      ) {
        target.emissiveIntensity = snapshot.emissiveIntensity;
      }
      if (snapshot.roughness !== undefined && typeof target.roughness === "number") {
        target.roughness = snapshot.roughness;
      }
      if (snapshot.metalness !== undefined && typeof target.metalness === "number") {
        target.metalness = snapshot.metalness;
      }
      target.opacity = snapshot.opacity;
      target.transparent = snapshot.transparent;
      target.depthWrite = snapshot.depthWrite;
      target.blending = snapshot.blending;
      target.needsUpdate = true;
    });
    demonMaterialSnapshots.clear();
  };

  const clearDemonMirrorArm = () => {
    if (demonMirrorArmState.mirrorArm?.parent) {
      demonMirrorArmState.mirrorArm.parent.remove(demonMirrorArmState.mirrorArm);
    }
    demonMirrorArmState.sourceArm = null;
    demonMirrorArmState.mirrorArm = null;
  };

  const ensureDemonMirrorArm = (sourceArm: THREE.Object3D) => {
    if (
      demonMirrorArmState.sourceArm === sourceArm &&
      demonMirrorArmState.mirrorArm
    ) {
      return demonMirrorArmState.mirrorArm;
    }
    clearDemonMirrorArm();
    const mirrorArm = sourceArm.clone(true);
    mirrorArm.name = `${sourceArm.name || "arm"}_demonMirror`;
    mirrorArm.userData.demonMirrorArm = true;
    mirrorArm.matrixAutoUpdate = false;
    avatar.add(mirrorArm);
    demonMirrorArmState.sourceArm = sourceArm;
    demonMirrorArmState.mirrorArm = mirrorArm;
    return mirrorArm;
  };

  const syncDemonMirrorArmTransform = (sourceArm: THREE.Object3D) => {
    const mirrorArm = ensureDemonMirrorArm(sourceArm);
    if (!mirrorArm) return;
    mirrorArm.visible = sourceArm.visible;
    sourceArm.updateMatrixWorld(true);
    avatar.updateMatrixWorld(true);
    mirrorAvatarInverseMatrix.copy(avatar.matrixWorld).invert();
    mirrorSourceMatrix
      .copy(sourceArm.matrixWorld)
      .premultiply(mirrorAvatarInverseMatrix);
    mirrorResultMatrix
      .copy(mirrorReflectXMatrix)
      .multiply(mirrorSourceMatrix);
    mirrorArm.matrix.copy(mirrorResultMatrix);
    mirrorArm.matrixWorldNeedsUpdate = true;
  };

  const applyDemonArmPose = (
    arms: THREE.Object3D[],
    now: number,
    isMoving: boolean
  ) => {
    let rightArm = arms.find((arm) => /right/i.test(arm.name)) ?? arms[0] ?? null;
    if (!rightArm && armRig.arm) {
      rightArm = armRig.arm;
    }
    const leftArm =
      arms.find((arm) => /left/i.test(arm.name) && arm !== rightArm) ??
      arms.find((arm) => arm !== rightArm) ??
      null;

    if (!rightArm) {
      clearDemonMirrorArm();
      return;
    }
    const sway = isMoving ? Math.sin(now * 0.008) * 0.08 : 0;
    const rightTargetX = -1.08 + sway;
    const leftTargetX = -1.08 - sway;
    const rightTargetY = -0.2;
    const leftTargetY = 0.2;
    const damp = 0.28;
    rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, rightTargetX, damp);
    rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, rightTargetY, damp);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0.2, damp);
    if (leftArm && leftArm !== rightArm) {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, leftTargetX, damp);
      leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, leftTargetY, damp);
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, -0.2, damp);
      clearDemonMirrorArm();
      return;
    }

    syncDemonMirrorArmTransform(rightArm);
  };

  const hideDemonLegs = (
    legLeft: THREE.Object3D | null,
    legRight: THREE.Object3D | null
  ) => {
    if (legLeft) {
      if (demonLegState.left !== legLeft) {
        if (demonLegState.left) {
          demonLegState.left.visible = demonLegState.leftVisible;
        }
        demonLegState.left = legLeft;
        demonLegState.leftVisible = legLeft.visible;
      }
      legLeft.visible = false;
    }
    if (legRight) {
      if (demonLegState.right !== legRight) {
        if (demonLegState.right) {
          demonLegState.right.visible = demonLegState.rightVisible;
        }
        demonLegState.right = legRight;
        demonLegState.rightVisible = legRight.visible;
      }
      legRight.visible = false;
    }
  };

  const restoreDemonLegs = () => {
    if (demonLegState.left) {
      demonLegState.left.visible = demonLegState.leftVisible;
    }
    if (demonLegState.right) {
      demonLegState.right.visible = demonLegState.rightVisible;
    }
    demonLegState.left = null;
    demonLegState.right = null;
    demonLegState.leftVisible = true;
    demonLegState.rightVisible = true;
  };

  const updateDemonFootRing = (now: number, active: boolean) => {
    if (!active) {
      demonFootRingRoot.visible = false;
      return;
    }
    demonFootRingRoot.visible = true;
    const t = now * 0.001;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5.8);
    demonFootRingMesh.rotation.z = t * 2.2;
    demonFootRingMesh.scale.setScalar(0.92 + pulse * 0.24);
    const ringMaterial = demonFootRingMesh.material as THREE.MeshStandardMaterial;
    ringMaterial.opacity = 0.56 + pulse * 0.34;
    ringMaterial.emissiveIntensity = 0.9 + pulse * 0.45;
    for (let i = 0; i < demonRingParticles.length; i += 1) {
      const particle = demonRingParticles[i];
      const angle = t * particle.speed + particle.phase;
      const radius = particle.radius + Math.sin(t * 2.8 + particle.phase) * 0.16;
      const risePhase = (t * (0.58 + particle.speed * 0.14) + particle.phase) % 1;
      const rise = risePhase < 0 ? risePhase + 1 : risePhase;
      particle.mesh.position.set(
        Math.cos(angle) * radius,
        0.06 + rise * particle.lift,
        Math.sin(angle) * radius
      );
      const shimmer = 0.5 + 0.5 * Math.sin(t * 8.4 + particle.phase * 2.6);
      particle.mesh.scale.setScalar(0.52 + shimmer * 0.68);
      particle.material.opacity = (1 - rise) * (0.28 + shimmer * 0.58);
    }
  };

  const setDemonScaleMultiplier = (multiplier: number) => {
    const safeMultiplier = Math.max(0.0001, multiplier);
    if (demonFormState.hasAvatarBaseScale) {
      avatar.scale.copy(demonFormState.avatarBaseScale).multiplyScalar(safeMultiplier);
      return;
    }
    avatar.scale.setScalar(safeMultiplier);
  };

  const resetDemonTransitionParticles = () => {
    for (let i = 0; i < demonTransitionParticles.length; i += 1) {
      const particle = demonTransitionParticles[i];
      particle.active = false;
      particle.startedAt = 0;
      particle.lifeMs = 0;
      particle.speed = 0;
      particle.mesh.visible = false;
      particle.mesh.position.set(0, 0, 0);
      particle.material.opacity = 0;
    }
  };

  const startDemonTransitionFx = (
    now: number,
    phase: Exclude<DemonTransitionPhase, "none">
  ) => {
    demonTransitionFxState.active = true;
    demonTransitionFxState.phase = phase;
    demonTransitionFxState.spawnCarry = 0;
    demonTransitionFxState.lastUpdatedAt = now;
    demonTransitionFxRoot.visible = true;
    resetDemonTransitionParticles();
  };

  const stopDemonTransitionFx = () => {
    demonTransitionFxState.active = false;
    demonTransitionFxState.spawnCarry = 0;
    demonTransitionFxState.lastUpdatedAt = 0;
    demonTransitionFxRoot.visible = false;
    resetDemonTransitionParticles();
  };

  const spawnDemonTransitionParticle = (now: number, intensity: number) => {
    const particle = demonTransitionParticles[demonTransitionFxState.cursor];
    demonTransitionFxState.cursor =
      (demonTransitionFxState.cursor + 1) % demonTransitionParticles.length;
    if (!particle) return;

    const angle = Math.random() * Math.PI * 2;
    const originRadius = 0.08 + Math.random() * 0.32;
    const outwardBias = 0.22 + Math.random() * 0.94;
    particle.active = true;
    particle.startedAt = now;
    particle.lifeMs =
      demonFormConfig.transitionParticleLifeMinMs +
      Math.random() *
        (demonFormConfig.transitionParticleLifeMaxMs -
          demonFormConfig.transitionParticleLifeMinMs);
    particle.origin.set(
      Math.cos(angle) * originRadius,
      0.95 + Math.random() * 2.35,
      Math.sin(angle) * originRadius
    );
    particle.direction.set(
      Math.cos(angle) * outwardBias + (Math.random() - 0.5) * 0.48,
      0.25 + Math.random() * 1.25,
      Math.sin(angle) * outwardBias + (Math.random() - 0.5) * 0.48
    );
    if (particle.direction.lengthSq() < 0.000001) {
      particle.direction.set(0, 1, 0);
    } else {
      particle.direction.normalize();
    }
    particle.speed = (2.9 + Math.random() * 5.4) * (0.75 + intensity * 0.5);
    particle.baseRotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    particle.spin.set(
      (Math.random() - 0.5) * 8.4,
      (Math.random() - 0.5) * 8.4,
      (Math.random() - 0.5) * 8.4
    );
    particle.mesh.visible = true;
    particle.mesh.position.copy(particle.origin);
    particle.mesh.rotation.copy(particle.baseRotation);
    particle.mesh.scale.setScalar((0.56 + Math.random() * 0.94) * (0.78 + intensity * 0.44));
    particle.material.opacity = 0.95;
  };

  const updateDemonTransitionFx = (now: number, phaseProgress: number) => {
    if (!demonTransitionFxState.active) {
      demonTransitionFxRoot.visible = false;
      return;
    }
    demonTransitionFxRoot.visible = true;

    const deltaMs =
      demonTransitionFxState.lastUpdatedAt > 0
        ? Math.max(0, now - demonTransitionFxState.lastUpdatedAt)
        : 16;
    demonTransitionFxState.lastUpdatedAt = now;

    const clampedProgress = THREE.MathUtils.clamp(phaseProgress, 0, 1);
    const inPhase = demonTransitionFxState.phase === "in";
    const intensity = inPhase
      ? THREE.MathUtils.lerp(0.78, 1.28, clampedProgress)
      : THREE.MathUtils.lerp(1.3, 0.82, clampedProgress);
    const spawnPerSec = demonFormConfig.transitionParticleSpawnPerSec * intensity;
    demonTransitionFxState.spawnCarry += (deltaMs * 0.001) * spawnPerSec;
    const spawnCount = Math.min(20, Math.floor(demonTransitionFxState.spawnCarry));
    if (spawnCount > 0) {
      demonTransitionFxState.spawnCarry -= spawnCount;
      for (let i = 0; i < spawnCount; i += 1) {
        spawnDemonTransitionParticle(now, intensity);
      }
    }

    let hasAliveParticle = false;
    for (let i = 0; i < demonTransitionParticles.length; i += 1) {
      const particle = demonTransitionParticles[i];
      if (!particle.active) continue;
      const elapsed = now - particle.startedAt;
      if (elapsed >= particle.lifeMs || particle.lifeMs <= 0) {
        particle.active = false;
        particle.mesh.visible = false;
        particle.material.opacity = 0;
        continue;
      }
      hasAliveParticle = true;
      const lifeProgress = THREE.MathUtils.clamp(elapsed / particle.lifeMs, 0, 1);
      const fade = 1 - lifeProgress;
      const travel = particle.speed * (elapsed * 0.001);
      const elapsedSec = elapsed * 0.001;
      const shimmer = 0.5 + 0.5 * Math.sin(now * 0.012 + i * 0.67);
      particle.mesh.position
        .copy(particle.origin)
        .addScaledVector(particle.direction, travel);
      particle.mesh.rotation.set(
        particle.baseRotation.x + particle.spin.x * elapsedSec,
        particle.baseRotation.y + particle.spin.y * elapsedSec,
        particle.baseRotation.z + particle.spin.z * elapsedSec
      );
      particle.mesh.scale.setScalar((0.56 + shimmer * 0.52) * (0.44 + fade * 0.72));
      particle.material.opacity = fade ** 1.2 * (0.36 + shimmer * 0.62);
    }

    if (!hasAliveParticle && demonTransitionFxState.spawnCarry < 0.001) {
      demonTransitionFxRoot.visible = false;
    }
  };

  const isDemonTransitionInvincible = () => demonFormState.transitionPhase !== "none";

  const isDemonFormTransitionActive = (now = performance.now()) => {
    updateDemonFormState(now);
    return demonFormState.transitionPhase !== "none";
  };

  const resolveDemonProjectileDirection = () => {
    if (hasRuntimeAimDirection) {
      demonProjectileDirection.copy(runtimeAimDirection);
    } else {
      avatar.updateMatrixWorld(true);
      avatar.getWorldQuaternion(punchAimAvatarQuaternion);
      demonProjectileDirection.set(0, 0, 1).applyQuaternion(punchAimAvatarQuaternion);
    }
    if (demonProjectileDirection.lengthSq() < 0.000001) {
      demonProjectileDirection.set(0, 0, 1);
    } else {
      demonProjectileDirection.normalize();
    }
    return demonProjectileDirection;
  };

  const clearDemonShockwaveDamageWaves = () => {
    demonShockwaveWaves.length = 0;
  };

  const queueDemonShockwaveDamageWaves = ({
    now,
    origin,
    direction,
  }: {
    now: number;
    origin: THREE.Vector3;
    direction: THREE.Vector3;
  }) => {
    if (!performMeleeAttack) return;
    demonShockwaveForwardFlat.set(direction.x, 0, direction.z);
    if (demonShockwaveForwardFlat.lengthSq() < 0.000001) {
      demonShockwaveForwardFlat.set(0, 0, 1);
    } else {
      demonShockwaveForwardFlat.normalize();
    }

    demonShockwaveLateralDirection
      .crossVectors(demonShockwaveUp, demonShockwaveForwardFlat)
      .setY(0);
    if (demonShockwaveLateralDirection.lengthSq() < 0.000001) {
      demonShockwaveLateralDirection.set(1, 0, 0);
    } else {
      demonShockwaveLateralDirection.normalize();
    }

    const sharedHitTargetIds = new Set<string>();
    const baseOrigin = origin.clone();
    const createWave = (
      waveDirection: THREE.Vector3,
      durationMs: number,
      speed: number,
      startRadius: number,
      endRadius: number
    ): DemonShockwaveDamageWave => ({
      startedAt: now,
      lastTickAt: now - demonFormConfig.projectileShockwaveTickIntervalMs,
      durationMs: Math.max(120, durationMs),
      tickIntervalMs: Math.max(24, demonFormConfig.projectileShockwaveTickIntervalMs),
      origin: baseOrigin.clone(),
      direction: waveDirection.clone(),
      travelDistance: Math.max(0.1, speed) * Math.max(0.12, durationMs * 0.001),
      startRadius: Math.max(0.25, startRadius),
      endRadius: Math.max(startRadius + 0.2, endRadius),
      damage: Math.max(1, Math.round(demonFormConfig.projectileShockwaveDamage)),
      maxHits: Math.max(1, Math.round(demonFormConfig.projectileShockwaveMaxHits)),
      hitTargetIds: sharedHitTargetIds,
    });

    demonShockwaveWaves.push(
      createWave(
        demonShockwaveLateralDirection,
        demonFormConfig.projectileShockwavePrimaryDurationMs,
        demonFormConfig.projectileShockwavePrimarySpeed,
        demonFormConfig.projectileShockwavePrimaryStartRadius,
        demonFormConfig.projectileShockwavePrimaryEndRadius
      ),
      createWave(
        demonShockwaveLateralDirection.clone().multiplyScalar(-1),
        demonFormConfig.projectileShockwaveSecondaryDurationMs,
        demonFormConfig.projectileShockwaveSecondarySpeed,
        demonFormConfig.projectileShockwaveSecondaryStartRadius,
        demonFormConfig.projectileShockwaveSecondaryEndRadius
      )
    );
  };

  const updateDemonShockwaveDamageWaves = (now: number) => {
    if (!performMeleeAttack) {
      clearDemonShockwaveDamageWaves();
      return;
    }
    for (let i = demonShockwaveWaves.length - 1; i >= 0; i -= 1) {
      const wave = demonShockwaveWaves[i];
      const durationMs = Math.max(1, wave.durationMs);
      const progress = THREE.MathUtils.clamp((now - wave.startedAt) / durationMs, 0, 1);
      demonShockwaveCenter
        .copy(wave.origin)
        .addScaledVector(wave.direction, wave.travelDistance * progress);
      demonShockwaveHitDirection.copy(wave.direction);
      if (demonShockwaveHitDirection.lengthSq() < 0.000001) {
        demonShockwaveHitDirection.set(0, 0, 1);
      } else {
        demonShockwaveHitDirection.normalize();
      }
      const shockwaveRadius = THREE.MathUtils.lerp(
        wave.startRadius,
        wave.endRadius,
        progress
      );
      const shouldTickDamage =
        now - wave.lastTickAt >= wave.tickIntervalMs || progress >= 1;
      if (shouldTickDamage) {
        wave.lastTickAt = now;
        const hitCount = performMeleeAttack({
          damage: wave.damage,
          maxDistance: 0.1,
          maxHits: wave.maxHits,
          origin: demonShockwaveCenter,
          direction: demonShockwaveHitDirection,
          contactCenter: demonShockwaveCenter,
          contactRadius: shockwaveRadius,
          excludeTargetIds: wave.hitTargetIds,
          onHitTarget: (targetId) => {
            wave.hitTargetIds.add(targetId);
          },
        });
        if (hitCount > 0) {
          applyMana?.(5 * hitCount);
        }
      }
      if (progress >= 1) {
        demonShockwaveWaves.splice(i, 1);
      }
    }
  };

  const fireDemonBasicProjectile = (now = performance.now()) => {
    if (!fireProjectile) return false;
    if (now < demonFormState.projectileCooldownUntil) return false;
    demonFormState.projectileCooldownUntil = now + demonFormConfig.projectileFireIntervalMs;
    const direction = resolveDemonProjectileDirection();
    if (hasRuntimeAimOrigin) {
      demonProjectileSpawnOrigin
        .copy(runtimeAimOrigin)
        .addScaledVector(direction, demonFormConfig.projectileEyeForwardOffset);
    } else {
      avatar.updateMatrixWorld(true);
      avatar.getWorldPosition(demonProjectileSpawnOrigin);
      demonProjectileSpawnOrigin.addScaledVector(
        direction,
        demonFormConfig.projectileForwardSpawnOffset
      );
      demonProjectileSpawnOrigin.y += demonFormConfig.projectileVerticalSpawnOffset;
    }
    fireProjectile({
      projectileType: "carrotDemonVolleyOrb",
      origin: demonProjectileSpawnOrigin.clone(),
      direction: direction.clone(),
      speed: demonFormConfig.projectileSpeed,
      lifetime: demonFormConfig.projectileLifetime,
      damage: demonFormConfig.projectileDamage,
      radius: demonFormConfig.projectileRadius,
      targetHitRadius: demonFormConfig.projectileTargetHitRadius,
      gravity: 0,
      scale: demonFormConfig.projectileScale,
      color: demonFormConfig.projectileColor,
      emissive: demonFormConfig.projectileEmissive,
      emissiveIntensity: demonFormConfig.projectileEmissiveIntensity,
      splitOnImpact: false,
      explosionRadius: demonFormConfig.projectileExplosionRadius,
      explosionDamage: demonFormConfig.projectileExplosionDamage,
      explosionColor: demonFormConfig.projectileExplosionColor,
      explosionEmissive: demonFormConfig.projectileExplosionEmissive,
      explosionEmissiveIntensity: demonFormConfig.projectileExplosionEmissiveIntensity,
      explodeOnExpire: true,
      energyGainOnHit: 0,
      manaGainOnHit: 5,
      grantManaOnTargetHit: true,
      lifecycle: {
        onRemove: ({ reason, now: removedAt, position, velocity }) => {
          if (reason === "cleared") return;
          queueDemonShockwaveDamageWaves({
            now: removedAt,
            origin: position.clone(),
            direction: velocity.clone(),
          });
        },
      },
    });
    return true;
  };

  const deactivateDemonForm = ({
    now,
    triggerHeal,
  }: {
    now: number;
    triggerHeal: boolean;
  }) => {
    if (
      !demonFormState.active &&
      demonFormState.transitionPhase === "none" &&
      !demonTransitionFxState.active
    ) {
      return;
    }
    demonFormState.active = false;
    demonFormState.startedAt = 0;
    demonFormState.endsAt = 0;
    demonFormState.transitionPhase = "none";
    demonFormState.transitionStartedAt = 0;
    demonFormState.transitionEndsAt = 0;
    demonFormState.projectileCooldownUntil = 0;
    clearDemonShockwaveDamageWaves();
    if (demonFormState.hasAvatarBaseScale) {
      avatar.scale.copy(demonFormState.avatarBaseScale);
    } else {
      avatar.scale.set(1, 1, 1);
    }
    restoreDemonFormMaterials();
    demonFaceFlickerFx.setActive(false);
    restoreDemonLegs();
    updateDemonFootRing(now, false);
    clearDemonMirrorArm();
    stopDemonTransitionFx();
    if (triggerHeal) {
      applyHealth?.(demonFormConfig.healOnEnd);
    }
  };

  const enterActiveDemonForm = (now: number) => {
    demonFormState.transitionPhase = "none";
    demonFormState.transitionStartedAt = 0;
    demonFormState.transitionEndsAt = 0;
    demonFormState.active = true;
    demonFormState.startedAt = now;
    demonFormState.endsAt = now + demonFormConfig.durationMs;
    demonFormState.projectileCooldownUntil = 0;
    setDemonScaleMultiplier(demonFormConfig.scaleMultiplier);
    applyDemonFormMaterials();
    demonFaceFlickerFx.setActive(true);
    stopDemonTransitionFx();
    updateDemonFootRing(now, true);
  };

  const startDemonFormTransitionOut = (now: number) => {
    if (demonFormState.transitionPhase === "out") return false;
    if (!demonFormState.active && demonFormState.transitionPhase !== "in") return false;
    demonFormState.active = false;
    demonFormState.startedAt = 0;
    demonFormState.endsAt = 0;
    demonFormState.transitionPhase = "out";
    demonFormState.transitionStartedAt = now;
    demonFormState.transitionEndsAt = now + demonFormConfig.transformOutDurationMs;
    demonFormState.projectileCooldownUntil = 0;
    setDemonScaleMultiplier(demonFormConfig.scaleMultiplier);
    applyDemonFormMaterials();
    updateDemonFootRing(now, false);
    clearDemonMirrorArm();
    startDemonTransitionFx(now, "out");
    return true;
  };

  const activateDemonForm = (now: number) => {
    if (demonFormState.active || demonFormState.transitionPhase !== "none") {
      return false;
    }
    if (!demonFormState.hasAvatarBaseScale) {
      demonFormState.avatarBaseScale.copy(avatar.scale);
      demonFormState.hasAvatarBaseScale = true;
    }
    demonFormState.active = false;
    demonFormState.startedAt = 0;
    demonFormState.endsAt = 0;
    demonFormState.transitionPhase = "in";
    demonFormState.transitionStartedAt = now;
    demonFormState.transitionEndsAt = now + demonFormConfig.transformInDurationMs;
    demonFormState.projectileCooldownUntil = 0;
    setDemonScaleMultiplier(1);
    applyDemonFormMaterials();
    clearDemonMirrorArm();
    updateDemonFootRing(now, false);
    startDemonTransitionFx(now, "in");
    return true;
  };

  const updateDemonFormState = (now: number) => {
    if (demonFormState.transitionPhase === "in") {
      const duration = Math.max(
        1,
        demonFormState.transitionEndsAt - demonFormState.transitionStartedAt
      );
      const progress = THREE.MathUtils.clamp(
        (now - demonFormState.transitionStartedAt) / duration,
        0,
        1
      );
      const eased = easeInOutCubic(progress);
      const multiplier = THREE.MathUtils.lerp(1, demonFormConfig.scaleMultiplier, eased);
      setDemonScaleMultiplier(multiplier);
      applyDemonFormMaterials();
      updateDemonFootRing(now, false);
      clearDemonMirrorArm();
      updateDemonTransitionFx(now, progress);
      if (now >= demonFormState.transitionEndsAt) {
        enterActiveDemonForm(now);
      }
      return;
    }

    if (demonFormState.transitionPhase === "out") {
      const duration = Math.max(
        1,
        demonFormState.transitionEndsAt - demonFormState.transitionStartedAt
      );
      const progress = THREE.MathUtils.clamp(
        (now - demonFormState.transitionStartedAt) / duration,
        0,
        1
      );
      const eased = easeInOutCubic(progress);
      const multiplier = THREE.MathUtils.lerp(demonFormConfig.scaleMultiplier, 1, eased);
      setDemonScaleMultiplier(multiplier);
      applyDemonFormMaterials();
      updateDemonFootRing(now, false);
      clearDemonMirrorArm();
      updateDemonTransitionFx(now, progress);
      if (now >= demonFormState.transitionEndsAt) {
        deactivateDemonForm({ now, triggerHeal: true });
      }
      return;
    }

    if (!demonFormState.active) {
      updateDemonFootRing(now, false);
      clearDemonMirrorArm();
      return;
    }
    if (now >= demonFormState.endsAt) {
      startDemonFormTransitionOut(now);
      return;
    }
    setDemonScaleMultiplier(demonFormConfig.scaleMultiplier);
    applyDemonFormMaterials();
    updateDemonFootRing(now, true);
  };

  const isDemonFormActive = (now = performance.now()) => {
    updateDemonFormState(now);
    return demonFormState.active;
  };

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
    punchState.hitTargetIds.clear();
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
    direction: THREE.Vector3,
    hitTargetIds?: Set<string>
  ) => {
    if (!performMeleeAttack) return 0;
    const damage = Math.round(
      THREE.MathUtils.lerp(punchConfig.minDamage, punchConfig.maxDamage, ratio)
    );
    const resolvedRatio = THREE.MathUtils.clamp(ratio, 0, 1);
    let contactRadius =
      punchConfig.handContactRadiusFallback +
      punchConfig.handContactRadiusByCharge * resolvedRatio;
    let contactForwardOffset =
      punchConfig.handContactForwardOffsetFallback +
      punchConfig.handContactForwardOffsetByCharge * resolvedRatio;

    if (armRig.arm) {
      armRig.arm.updateMatrixWorld(true);
      punchHandBounds.setFromObject(armRig.arm);
      if (!punchHandBounds.isEmpty()) {
        punchHandBounds.getBoundingSphere(punchHandSphere);
        contactRadius = Math.max(
          punchConfig.handModelMinRadius,
          punchHandSphere.radius * punchConfig.handModelRadiusScale +
            punchConfig.handContactRadiusByCharge * resolvedRatio
        );
        contactForwardOffset += contactRadius * 0.18;
        punchContactCenter.copy(punchHandSphere.center);
      } else {
        punchContactCenter.copy(origin);
      }
    } else {
      punchContactCenter.copy(origin);
    }
    punchContactCenter.addScaledVector(direction, contactForwardOffset);

    const hitCount = performMeleeAttack({
      damage,
      maxDistance: 0.1,
      hitRadius: punchConfig.hitRadius,
      maxHits: punchConfig.handMaxHits,
      origin,
      direction,
      contactCenter: punchContactCenter,
      contactRadius,
      excludeTargetIds: hitTargetIds,
      onHitTarget: (targetId) => {
        hitTargetIds?.add(targetId);
      },
    });
    if (hitCount > 0) {
      applyEnergy?.(5 * hitCount);
      applyMana?.(5 * hitCount);
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
    const forwardDirection = direction
      .clone()
      .setY(0)
      .normalize();
    if (forwardDirection.lengthSq() < 0.000001) {
      forwardDirection.set(0, 0, 1);
    }
    const deepSwayDirection = new THREE.Vector3();
    const deepRightDirection = new THREE.Vector3();
    if (isDeepVariant) {
      deepRightDirection.crossVectors(axisY, forwardDirection);
      if (deepRightDirection.lengthSq() < 0.000001) {
        deepRightDirection.set(1, 0, 0);
      } else {
        deepRightDirection.normalize();
      }
    }
    let deepSwayPhase = Math.random() * Math.PI * 2;
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
          if (isDeepVariant) {
            deepSwayPhase += delta * skillRConfig.deepSwayFrequency;
            deepSwayDirection
              .copy(forwardDirection)
              .addScaledVector(
                deepRightDirection,
                Math.sin(deepSwayPhase) * skillRConfig.deepSwayAmplitude
              );
            if (deepSwayDirection.lengthSq() > 0.000001) {
              const speed = velocity.length();
              deepSwayDirection.normalize();
              velocity.copy(deepSwayDirection).multiplyScalar(speed);
            }
          }
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
    const now = performance.now();
    updateDemonFormState(now);
    if (demonFormState.transitionPhase !== "none") return false;
    if (!fireProjectile) return false;
    if (punchState.phase !== "idle") return false;
    const deepPhantomActive = phantomModifier.isDeepPhaseActive(now);

    avatar.updateMatrixWorld(true);
    avatar.getWorldPosition(skillRSpawnOrigin);
    const direction = resolveSkillRDirection();

    skillRSpawnOrigin.addScaledVector(direction, skillRConfig.forwardSpawnOffset);
    skillRSpawnOrigin.y += skillRConfig.verticalSpawnOffset;

    if (deepPhantomActive || isDemonFormActive(now)) {
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
    if (deepPhantomActive) {
      phantomModifier.exitDeepPhase(now);
    }
    return true;
  };

  const handleSkillQ = () => {
    const now = performance.now();
    updateDemonFormState(now);
    if (demonFormState.active || demonFormState.transitionPhase !== "none") return false;
    // Ensure phantom material overrides do not leak into demon-form snapshot restore.
    phantomModifier.reset();
    if (punchState.phase !== "idle") {
      clearPunchState();
      restoreIdlePose();
    }
    return activateDemonForm(now);
  };

  const handleSkillE = () => {
    const now = performance.now();
    updateDemonFormState(now);
    if (demonFormState.transitionPhase !== "none") return false;
    if (demonFormState.active) {
      return phantomModifier.triggerDeepVolley(now, {
        projectileType: "carrotDemonVolleyOrb",
        summonScaleMultiplier: demonFormConfig.demonESummonScaleMultiplier,
        projectileScale: demonFormConfig.demonEProjectileScale,
      });
    }
    return phantomModifier.handleSkillE();
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
    punchState.hitTargetIds.clear();

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

  const handlePrimaryDown = () => {
    const now = performance.now();
    updateDemonFormState(now);
    if (demonFormState.transitionPhase !== "none") return;
    if (demonFormState.active) {
      fireDemonBasicProjectile(now);
      return;
    }
    beginCharge();
  };

  const handlePrimaryUp = () => {
    const now = performance.now();
    updateDemonFormState(now);
    if (demonFormState.transitionPhase !== "none") return;
    if (demonFormState.active) return;
    releaseCharge();
  };

  const handlePrimaryCancel = () => {
    const now = performance.now();
    updateDemonFormState(now);
    if (demonFormState.transitionPhase !== "none") return;
    if (demonFormState.active) return;
    cancelCharge();
  };

  const handleRightClick = (facing: Parameters<typeof baseRuntime.handleRightClick>[0]) => {
    const now = performance.now();
    updateDemonFormState(now);
    if (demonFormState.transitionPhase !== "none") return;
    if (demonFormState.active) {
      fireDemonBasicProjectile(now);
      return;
    }
    if (punchState.phase !== "idle") return;
    baseRuntime.handleRightClick(facing);
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
        applyPunchMeleeHit(
          punchState.chargeRatio,
          aim.origin,
          aim.direction,
          punchState.hitTargetIds
        );
        if (
          progress >= 0.95 ||
          punchState.hitTargetIds.size >= punchConfig.handMaxHits
        ) {
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
    passiveManaElapsedMs = 0;
    deactivateDemonForm({ now: performance.now(), triggerHeal: false });
    demonFaceFlickerFx.setActive(false);
    phantomModifier.reset();
    baseRuntime.resetState?.();
  };

  const beforeSkillUse = ({ key, now }: { key: SkillKey; now: number }) => {
    if (isDemonFormTransitionActive(now)) {
      return { allow: false };
    }
    const baseModifier = phantomModifier.beforeSkillUse?.({ key, now });
    const resolvedModifier =
      baseModifier && typeof baseModifier === "object"
        ? { ...baseModifier }
        : {};
    if (key === "e" && isDemonFormActive(now)) {
      resolvedModifier.ignoreCostAndCooldown = false;
      resolvedModifier.ignoreCooldown = false;
      resolvedModifier.ignoreResource = false;
      resolvedModifier.cooldownScale = 1 / 3;
    }
    if (!Object.keys(resolvedModifier).length) return;
    return resolvedModifier;
  };

  const beforeDamage = ({ amount, now }: { amount: number; now: number }) => {
    updateDemonFormState(now);
    const demonTransitionInvincible = isDemonTransitionInvincible();
    const wasDeepActive = phantomModifier.isDeepPhaseActive(now);
    const modifier = phantomModifier.beforeDamage({ amount, now });
    const isDeepActiveNow = phantomModifier.isDeepPhaseActive(now);
    if (!wasDeepActive && isDeepActiveNow) {
      clearSkillCooldown?.("r");
    }
    const baseAmount =
      typeof modifier === "number"
        ? modifier
        : modifier && typeof modifier === "object"
          ? modifier.amount
          : amount;
    const demonAdjustedAmount = demonFormState.active
      ? baseAmount * demonFormConfig.damageTakenMultiplier
      : baseAmount;
    const resolvedAmount = demonTransitionInvincible ? 0 : demonAdjustedAmount;
    if (typeof modifier === "number") {
      return resolvedAmount;
    }
    return { amount: resolvedAmount };
  };

  const onTick = (args: CharacterRuntimeTickArgs) => {
    phantomModifier.onTick(args);
    updateDemonFormState(args.now);
    updateDemonShockwaveDamageWaves(args.now);
    updatePassiveManaRegen(args.delta);
  };

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handleRightClick,
    handlePrimaryDown,
    handlePrimaryUp,
    handlePrimaryCancel,
    handleSkillQ,
    handleSkillE,
    handleSkillR,
    getProjectileBlockers: baseRuntime.getProjectileBlockers,
    handleProjectileBlockHit: baseRuntime.handleProjectileBlockHit,
    getMovementSpeedMultiplier: baseRuntime.getMovementSpeedMultiplier,
    getCameraScaleMultiplier: () =>
      (isDemonFormActive() ? demonFormConfig.cameraScaleMultiplier : 1),
    isBasicAttackLocked: () =>
      punchState.phase !== "idle" || isDemonFormTransitionActive(),
    isMovementLocked: () =>
      Boolean(baseRuntime.isMovementLocked?.()) || isDemonFormTransitionActive(),
    getSkillCooldownRemainingMs: baseRuntime.getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs: baseRuntime.getSkillCooldownDurationMs,
    beforeSkillUse,
    beforeDamage,
    onTick,
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
      if (args.aimOriginWorld) {
        runtimeAimOrigin.copy(args.aimOriginWorld);
        hasRuntimeAimOrigin = true;
      }
      baseRuntime.update(args);
      attachArm(args.arms);
      const demonActive = isDemonFormActive(args.now);
      demonFaceFlickerFx.setActive(demonActive);
      demonFaceFlickerFx.update(args.now);
      if (demonActive) {
        applyDemonArmPose(args.arms, args.now, args.isMoving);
        hideDemonLegs(args.legLeft, args.legRight);
      } else {
        restoreDemonLegs();
      }
      if (armRig.arm && punchState.phase === "idle" && !args.isMoving && !demonActive) {
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
      demonFaceFlickerFx.dispose();
      clearDemonMirrorArm();
      demonFootRingMesh.geometry.dispose();
      (demonFootRingMesh.material as THREE.Material).dispose();
      demonRingParticleGeometry.dispose();
      for (let i = 0; i < demonRingParticles.length; i += 1) {
        demonRingParticles[i].material.dispose();
      }
      demonTransitionParticleGeometry.dispose();
      for (let i = 0; i < demonTransitionParticles.length; i += 1) {
        demonTransitionParticles[i].material.dispose();
      }
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




