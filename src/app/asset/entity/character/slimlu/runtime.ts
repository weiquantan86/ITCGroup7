import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { characterGltfAnimationClipsKey } from "../general/engine/characterLoader";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import type {
  CharacterRuntimeFactory,
  RuntimeAttackTarget,
} from "../general/types";
import { profile } from "./profile";
import {
  clearSlimluThreatEntries,
  registerSlimluThreatEntry,
  unregisterSlimluThreatEntry,
} from "./threatRegistry";

const walkClipName = "walk";
const skillQClipName = "eat";
const skillEClipName = "skillE";
const skillRClipName = "skillR";
const legTrackPattern = /shoe|leg|foot|thigh|calf|toe|hips|pelvis|ankle/i;

const drainRange = 6.8;
const drainRangeSq = drainRange * drainRange;
const drainAcquireHorizontalRange = drainRange + 3.2;
const drainAcquireHorizontalRangeSq =
  drainAcquireHorizontalRange * drainAcquireHorizontalRange;
const drainRetainHorizontalRange = drainAcquireHorizontalRange * 1.15;
const drainRetainHorizontalRangeSq =
  drainRetainHorizontalRange * drainRetainHorizontalRange;
const drainTickMs = 500;
const drainManaGainPerDamageHit = 2;
const drainEnergyGainPerDamageHit = 2;
const drainAcGainPerDamageHit = 0.02;
const drainBaseDamage = 2;
const drainDamageBonusBase = 0;
const drainDamageBonusAcStep = 5;
const drainDamageBonusPerStep = 0.5;
const drainLinkTubeRadius = 0.22;
const drainLinkControlPointCount = 10;
const drainLinkSegmentRadialSegments = 10;
const drainLinkRevealDurationMs = 220;
const slimeCloneBaseHealth = 40;
const slimeCloneHealthDecayPerSecond = 6;
const slimeCloneAttachDurationMs = 30000;
const slimeCloneAcquireRange = 24;
const slimeCloneAcquireRangeSq = slimeCloneAcquireRange * slimeCloneAcquireRange;
const slimeCloneAttachDistance = 1.12;
const slimeCloneAttachDistanceSq = slimeCloneAttachDistance * slimeCloneAttachDistance;
const slimeCloneAttachHeightOffset = 0.3;
const slimeCloneAttachOrbitRadius = 0.42;
const slimeCloneSpawnRadius = 0.9;
const slimeCloneSummonIntervalMs = 250;
const slimeCloneModelScale = 0.4;
const slimeCloneExplosionBaseDamage = 30;
const slimeCloneExplosionAcScale = 0.5;
const slimeCloneExplosionManaGainOnDamage = 5;
const slimeCloneExplosionEnergyGainOnDamage = 3;
const slimeCloneDissolveParticleCount = 18;
const slimeCloneDissolveLifeMin = 0.42;
const slimeCloneDissolveLifeMax = 0.92;
const slimeCloneAttachPulseLife = 0.5;
const skillRBeamChargeDurationMs = 2000;
const skillRBeamDurationSec = 0.46;
const skillRMouthOpenStartNormalized = 0.46;
const skillRChargeFrontOffset = 1.3;
const skillRChargeVerticalOffset = -0.3;
const skillRBeamLength = 34;
const skillRBeamCoreStartRadius = 0.22;
const skillRBeamCoreEndRadius = 1.18;
const skillRBeamShellStartRadius = 0.46;
const skillRBeamShellEndRadius = 2.8;
const skillRBeamAuraStartRadius = 0.66;
const skillRBeamAuraEndRadius = 4.4;
const skillRBeamHitStartRadius = 0.92;
const skillRBeamHitEndRadius = 4.2;
const skillRBeamGrowthDistanceCap = 10;
const skillRBeamGrowthCoefficient = 1.55;
const skillRBeamDamageBase = 75;
const skillRBeamDamageAcScale = 0.5;
const skillRBeamEnergyGainOnHit = 10;
const skillRBeamManaCost = 60;
const skillRBeamCooldownMs = 10000;
const skillRRecallDamageBase = 10;
const skillRRecallDamageAcScale = 0.02;
const skillRRecallAcGain = 0.1;
const skillRRecallManaGainPerClone = 5;
const skillRRecallEnergyGainPerClone = 5;
const skillRRecallCooldownReductionPerCloneMs = 1000;
const skillRRecallManaCost = 30;
const skillRRecallCooldownMs = 5000;
const skillRChargeParticleCount = 120;
const skillQAnimationSpeed = 3;
const skillQRequiredFullEnergy = profile.stats?.energy ?? 100;
const skillQHeadFlightSpeed = 24;
const skillQHeadMaxDistance = 12;
const skillQHeadSteerWeight = 0.62;
const skillQHeadHitRadius = 1.35;
const skillQHeadReturnDurationMs = 260;
const skillQKillHealthThreshold = 1000;
const skillQHighHealthDamage = 500;
const skillQHighHealthAcGain = 1;
const skillQConsumeRewardHealth = 30;
const skillQConsumeRewardMana = 30;
const skillQConsumeRewardAc = 5;
const skillQFlyBoneNamePattern =
  /mouseup|mousedown|uppermouth|lowermouth|uppermonth|lowermonth|eye1|eye2/i;

type ActionBinding = {
  clipName: string;
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
};

type AbsorptionCoefficientHud = {
  setValue: (value: number) => void;
  dispose: () => void;
};

type DrainPromptHud = {
  setVisible: (visible: boolean) => void;
  setActive: (active: boolean) => void;
  dispose: () => void;
};

type DrainLinkState = {
  target: RuntimeAttackTarget;
  root: THREE.Group;
  segmentGeometry: THREE.CylinderGeometry;
  segments: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>[];
  material: THREE.MeshBasicMaterial;
  controlPoints: THREE.Vector3[];
  wobblePhase: number;
  wobbleSpeed: number;
  wobbleScale: number;
  nextDamageAt: number;
  createdAt: number;
};

type SlimeCloneState = {
  id: string;
  root: THREE.Group;
  visual: THREE.Object3D;
  visualMaterials: THREE.Material[];
  mixer: THREE.AnimationMixer | null;
  walkAction: THREE.AnimationAction | null;
  isWalking: boolean;
  health: number;
  speed: number;
  attachedTargetId: string | null;
  attachedTarget: RuntimeAttackTarget | null;
  attachedUntil: number;
  attachedOffset: THREE.Vector3;
  attachedVisualApplied: boolean;
  recalling: boolean;
  recallStartedAt: number;
  recallDurationMs: number;
  recallStartLocalPos: THREE.Vector3;
  recallArcHeight: number;
};

type SlimeDissolveParticle = {
  mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

type SlimeAttachPulse = {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
};

type SkillRChargeParticle = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  angle: number;
  spin: number;
  baseRadius: number;
  height: number;
  phase: number;
  drift: number;
};

type SkillRBeamLayerState = {
  material: THREE.MeshBasicMaterial;
  growthMesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> | null;
  staticMesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> | null;
};

type SkillRBeamState = {
  root: THREE.Group;
  aura: SkillRBeamLayerState;
  core: SkillRBeamLayerState;
  shell: SkillRBeamLayerState;
  rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[];
  ringOffsets: number[];
  startedAt: number;
  durationSec: number;
  length: number;
};

type SkillQFlyBoneState = {
  bone: THREE.Bone;
  restLocalPos: THREE.Vector3;
  restLocalQuat: THREE.Quaternion;
};

const isBoneObject = (object: THREE.Object3D | null): object is THREE.Bone =>
  Boolean((object as THREE.Bone | null)?.isBone);

const resolveClip = (clips: THREE.AnimationClip[], clipName: string) =>
  clips.find((clip) => clip.name === clipName) ?? null;

const filterClipTracks = (
  clip: THREE.AnimationClip | null,
  includeTrack: (track: THREE.KeyframeTrack) => boolean
) => {
  if (!clip) return null;
  const tracks = clip.tracks.filter(includeTrack).map((track) => track.clone());
  if (!tracks.length) return null;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
};

const createOneShotBinding = (
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip | null,
  clipName: string
) => {
  if (!clip) return null;
  const action = mixer.clipAction(clip);
  action.clampWhenFinished = true;
  action.setLoop(THREE.LoopOnce, 1);
  action.enabled = true;
  action.paused = true;
  action.setEffectiveWeight(0);
  return { clipName, clip, action };
};

const createLoopBinding = (
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip | null,
  clipName: string
) => {
  if (!clip) return null;
  const action = mixer.clipAction(clip);
  action.clampWhenFinished = false;
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.enabled = true;
  action.paused = true;
  action.setEffectiveWeight(0);
  return { clipName, clip, action };
};

const stopActionBinding = (binding: ActionBinding | null) => {
  if (!binding) return;
  binding.action.stop();
  binding.action.paused = true;
  binding.action.enabled = true;
  binding.action.setEffectiveWeight(0);
};

const playActionBinding = (binding: ActionBinding | null) => {
  if (!binding) return false;
  binding.action.reset();
  binding.action.enabled = true;
  binding.action.paused = false;
  binding.action.setEffectiveTimeScale(1);
  binding.action.setEffectiveWeight(1);
  binding.action.play();
  return true;
};

const createAbsorptionCoefficientHud = (
  mount?: HTMLElement
): AbsorptionCoefficientHud => {
  if (!mount) {
    return {
      setValue: () => {},
      dispose: () => {},
    };
  }

  const host = mount.parentElement ?? mount;
  const statusHud = Array.from(host.children).find(
    (child): child is HTMLDivElement =>
      child instanceof HTMLDivElement &&
      child.style.position === "absolute" &&
      child.style.left === "16px" &&
      child.style.top === "16px" &&
      child.style.display === "flex"
  );
  if (!statusHud) {
    return {
      setValue: () => {},
      dispose: () => {},
    };
  }

  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:8px;min-width:320px;";

  const label = document.createElement("span");
  label.textContent = "AC";
  label.style.cssText =
    "width:26px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;" +
    "color:rgba(226,232,240,0.9);";

  const name = document.createElement("span");
  name.textContent = "Absorption Coefficient";
  name.style.cssText =
    "flex:1;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;" +
    "color:rgba(226,232,240,0.82);";

  const value = document.createElement("span");
  value.style.cssText =
    "min-width:58px;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;" +
    "color:rgba(226,232,240,0.9);";

  row.append(label, name, value);
  statusHud.appendChild(row);

  const setValue = (nextValue: number) => {
    const normalized = Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
    const rounded = Math.round(normalized * 100) / 100;
    value.textContent = Number.isInteger(rounded)
      ? `${rounded}`
      : `${rounded}`.replace(/0+$/, "").replace(/\.$/, "");
  };

  setValue(0);

  return {
    setValue,
    dispose: () => {
      row.parentElement?.removeChild(row);
    },
  };
};

const createDrainPromptHud = (mount?: HTMLElement): DrainPromptHud => {
  if (!mount) {
    return {
      setVisible: () => {},
      setActive: () => {},
      dispose: () => {},
    };
  }

  const host = mount.parentElement ?? mount;
  if (!host.style.position) {
    host.style.position = "relative";
  }

  const prompt = document.createElement("div");
  prompt.style.cssText =
    "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0.88);" +
    "width:120px;height:92px;display:flex;align-items:center;justify-content:center;" +
    "pointer-events:none;opacity:0;z-index:9;" +
    "transition:opacity 120ms ease,transform 120ms ease;";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 120 88");
  svg.setAttribute("width", "108");
  svg.setAttribute("height", "80");

  const upperTeeth = document.createElementNS("http://www.w3.org/2000/svg", "path");
  upperTeeth.setAttribute(
    "d",
    "M24 6 L32 24 L24 42 L16 24 Z " +
      "M42 3 L52 24 L42 45 L32 24 Z " +
      "M60 2 L71 24 L60 46 L49 24 Z " +
      "M78 3 L88 24 L78 45 L68 24 Z " +
      "M96 6 L104 24 L96 42 L88 24 Z"
  );

  const lowerTeeth = document.createElementNS("http://www.w3.org/2000/svg", "path");
  lowerTeeth.setAttribute(
    "d",
    "M24 46 L32 64 L24 82 L16 64 Z " +
      "M42 43 L52 64 L42 85 L32 64 Z " +
      "M60 42 L71 64 L60 86 L49 64 Z " +
      "M78 43 L88 64 L78 85 L68 64 Z " +
      "M96 46 L104 64 L96 82 L88 64 Z"
  );

  upperTeeth.setAttribute("stroke-width", "2.1");
  lowerTeeth.setAttribute("stroke-width", "2.1");
  upperTeeth.setAttribute("stroke-linejoin", "round");
  lowerTeeth.setAttribute("stroke-linejoin", "round");

  svg.append(upperTeeth, lowerTeeth);
  prompt.appendChild(svg);
  host.appendChild(prompt);

  let visible = false;
  let active = false;
  const applyToothTone = () => {
    const fill = active ? "rgba(34,197,94,0.94)" : "rgba(248,250,252,0.88)";
    const stroke = active ? "rgba(22,163,74,0.98)" : "rgba(248,250,252,0.98)";
    upperTeeth.setAttribute("fill", fill);
    lowerTeeth.setAttribute("fill", fill);
    upperTeeth.setAttribute("stroke", stroke);
    lowerTeeth.setAttribute("stroke", stroke);
  };

  const applyStyle = () => {
    prompt.style.opacity = visible ? "1" : "0";
    prompt.style.transform = visible
      ? active
        ? "translate(-50%,-50%) scale(1.16)"
        : "translate(-50%,-50%) scale(1)"
      : "translate(-50%,-50%) scale(0.88)";
    applyToothTone();
  };

  applyStyle();

  return {
    setVisible: (nextVisible: boolean) => {
      visible = nextVisible;
      applyStyle();
    },
    setActive: (nextActive: boolean) => {
      active = nextActive;
      applyStyle();
    },
    dispose: () => {
      prompt.parentElement?.removeChild(prompt);
    },
  };
};

const findBodyCenterAnchor = (model: THREE.Object3D | null) => {
  if (!model) return null;
  let best: { node: THREE.Object3D; score: number } | null = null;
  model.traverse((child: THREE.Object3D) => {
    if (!child.name) return;
    const name = child.name.toLowerCase();
    let score = 0;
    if (/chest/.test(name)) score += 9;
    if (/spine|torso/.test(name)) score += 7;
    if (/body/.test(name)) score += 5;
    if (/hips|pelvis|waist/.test(name)) score += 4;
    if (/root/.test(name)) score += 2;
    if (score <= 0) return;
    if (!best || score > best.score) {
      best = { node: child, score };
    }
  });
  return best?.node ?? model;
};

const findRootChildBoneAnchor = (model: THREE.Object3D | null) => {
  if (!model) return null;
  let rootBone: THREE.Bone | null = null;
  let fallbackRootBone: THREE.Bone | null = null;
  model.traverse((child: THREE.Object3D) => {
    if (!isBoneObject(child)) return;
    const name = child.name.toLowerCase();
    if (!fallbackRootBone && /root/.test(name)) {
      fallbackRootBone = child;
    }
    if (name === "root") {
      rootBone = child;
    }
  });
  const resolvedRootBone = rootBone ?? fallbackRootBone;
  if (!resolvedRootBone) return null;

  const childBones = resolvedRootBone.children.filter((child) => isBoneObject(child));
  if (!childBones.length) return resolvedRootBone;
  let best = childBones[0];
  let bestScore = -Infinity;
  for (let i = 0; i < childBones.length; i += 1) {
    const bone = childBones[i];
    const name = bone.name.toLowerCase();
    let score = bone.position.y * 4;
    if (/head|neck|spine|chest|torso|body|mouth|mouse|container/.test(name)) score += 12;
    if (/shoe|foot|leg|toe/.test(name)) score -= 10;
    if (score > bestScore) {
      best = bone;
      bestScore = score;
    }
  }
  return best;
};

const findSkillQFlyBones = (model: THREE.Object3D | null) => {
  if (!model) return null;
  const result: THREE.Bone[] = [];
  const seen = new Set<number>();
  model.traverse((child: THREE.Object3D) => {
    if (!isBoneObject(child)) return;
    const name = child.name.toLowerCase();
    const isFlyPart =
      /mouseup|mousedown|uppermouth|lowermouth|uppermonth|lowermonth|eye1|eye2/.test(
        name
      );
    if (!isFlyPart || seen.has(child.id)) return;
    seen.add(child.id);
    result.push(child);
  });
  if (!result.length) return null;
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
};

const shouldKeepSkillQTrack = (trackName: string) => {
  const isPositionTrack = /\.position$/i.test(trackName);
  if (!isPositionTrack) return true;
  return !skillQFlyBoneNamePattern.test(trackName);
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  mount,
  noCooldown,
  applyHealth,
  applyMana,
  applyEnergy,
  spendEnergy,
  spendMana,
  clearSkillCooldown,
  getCurrentStats,
  getAttackTargets,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const absorptionCoefficientHud = createAbsorptionCoefficientHud(mount);
  const drainPromptHud = createDrainPromptHud(mount);

  let absorptionCoefficient = 0;
  let primaryHeld = false;
  let rootChildBoneAnchor: THREE.Bone | null = null;
  let rootChildBoneTailChildren: THREE.Bone[] = [];
  let bodyCenterAnchor: THREE.Object3D | null = null;
  let skillQFlyBones: SkillQFlyBoneState[] = [];
  let skillQHeadFlightActive = false;
  let skillQHeadFlightStartedAt = 0;
  let skillQHeadLastUpdateAt = 0;
  let skillQHeadReturning = false;
  let skillQHeadReturnStartedAt = 0;
  const skillQConsumedTargetIds = new Set<string>();
  const skillQHeadStartWorldPos = new THREE.Vector3();
  const skillQHeadForwardWorldDir = new THREE.Vector3();

  let boundModel: THREE.Object3D | null = null;
  let boundWalkClip: THREE.AnimationClip | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let walkBinding: ActionBinding | null = null;
  let walkLegsBinding: ActionBinding | null = null;
  let skillQBinding: ActionBinding | null = null;
  let skillEBinding: ActionBinding | null = null;
  let skillRBinding: ActionBinding | null = null;
  let activeSkillBinding: ActionBinding | null = null;
  let lastAnimationUpdateAt = 0;
  let slimeCloneIdCounter = 0;
  let pendingSlimeCloneSpawnCount = 0;
  let nextSlimeCloneSpawnAt = 0;
  let runtimeSkillECooldownUntil = 0;
  let runtimeSkillRCooldownUntil = 0;
  let runtimeSkillRCooldownDurationMs = 0;
  let eDetonationWindowActive = false;
  let skillRAwaitMouthOpen = false;
  let skillRMouthHeld = false;
  let skillRCharging = false;
  let skillRChargeStartedAt = 0;
  let skillRChargeEndsAt = 0;
  let activeSkillRBeam: SkillRBeamState | null = null;
  let skillRChargeRoot: THREE.Group | null = null;
  let skillRChargeParticleMaterial: THREE.MeshBasicMaterial | null = null;
  let skillRChargeSphereMaterial: THREE.MeshBasicMaterial | null = null;
  let skillRChargeSphere: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshBasicMaterial
  > | null = null;
  const skillRChargeParticles: SkillRChargeParticle[] = [];
  const skillECooldownDurationMs = Math.max(
    0,
    profile.kit?.skills?.e?.cooldownMs ?? 0
  );

  const activeDrainLinks = new Map<string, DrainLinkState>();
  const activeSlimeClones = new Map<string, SlimeCloneState>();
  const nearbyTargetIds = new Set<string>();
  const slimeDissolveParticles: SlimeDissolveParticle[] = [];
  const slimeAttachPulses: SlimeAttachPulse[] = [];
  const slimeCloneBaseSpeed = Math.max(0.6, profile.movement?.baseSpeed ?? 5);
  const slimeCloneFallbackGeometry = new THREE.CapsuleGeometry(0.22, 0.52, 6, 12);
  const slimeCloneFallbackMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.44,
    metalness: 0.1,
    emissive: 0x166534,
    emissiveIntensity: 0.32,
  });
  const slimeCloneDissolveGeometry = new THREE.IcosahedronGeometry(1, 0);
  const slimeCloneAttachPulseGeometry = new THREE.RingGeometry(0.3, 0.46, 20);
  const slimeCloneDissolveMaterialTemplate = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    roughness: 0.35,
    metalness: 0,
    emissive: 0x22c55e,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const slimeCloneAttachPulseMaterialTemplate = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
  });
  const skillRChargeParticleGeometry = new THREE.SphereGeometry(1, 8, 8);
  const skillRChargeSphereGeometry = new THREE.SphereGeometry(1, 16, 16);
  const skillRBeamRingGeometry = new THREE.TorusGeometry(1, 0.15, 10, 24);

  const playerWorldPos = new THREE.Vector3();
  const targetWorldPos = new THREE.Vector3();
  const drainOriginWorldPos = new THREE.Vector3();
  const lineStartLocal = new THREE.Vector3();
  const lineEndLocal = new THREE.Vector3();
  const lineVisibleEndLocal = new THREE.Vector3();
  const lineDirection = new THREE.Vector3();
  const lineUp = new THREE.Vector3();
  const lineSideA = new THREE.Vector3();
  const lineSideB = new THREE.Vector3();
  const drainDirection = new THREE.Vector3();
  const segmentMidpoint = new THREE.Vector3();
  const segmentDirection = new THREE.Vector3();
  const segmentUpAxis = new THREE.Vector3(0, 1, 0);
  const drainOriginParentWorldPos = new THREE.Vector3();
  const drainOriginChildWorldPos = new THREE.Vector3();
  const drainOriginParentToBone = new THREE.Vector3();
  const targetLocalCenterPos = new THREE.Vector3();
  const targetWorldBounds = new THREE.Box3();
  const targetCenterScratch = new THREE.Vector3();
  const nearbyTargetsScratch: RuntimeAttackTarget[] = [];
  const runtimeProjectileBlockersScratch: THREE.Object3D[] = [];
  const slimeCloneMoveDirection = new THREE.Vector3();
  const slimeCloneSpawnWorldPos = new THREE.Vector3();
  const slimeCloneAttachWorldPos = new THREE.Vector3();
  const slimeCloneSourceWorldPos = new THREE.Vector3();
  const skillRAttachTargetLocalPos = new THREE.Vector3();
  const skillRBeamOriginWorldPos = new THREE.Vector3();
  const skillRBeamEndWorldPos = new THREE.Vector3();
  const skillRAimDirection = new THREE.Vector3();
  const skillRAvatarForward = new THREE.Vector3();
  const runtimeAimDirection = new THREE.Vector3(0, 0, 1);
  const skillRBeamSegmentVector = new THREE.Vector3();
  const skillRBeamPointOffset = new THREE.Vector3();
  const skillRBeamClosestPoint = new THREE.Vector3();
  const skillRTargetBoundsSize = new THREE.Vector3();
  const skillQHeadWorldPos = new THREE.Vector3();
  const skillQHeadDesiredWorldPos = new THREE.Vector3();
  const skillQHeadTargetLocalPos = new THREE.Vector3();
  const skillQHeadTargetDirection = new THREE.Vector3();
  const skillQHeadMoveDelta = new THREE.Vector3();
  const skillQFlyBoneWorldPos = new THREE.Vector3();
  const skillQHeadBaseWorldPos = new THREE.Vector3();
  const skillQHeadFlightOffsetWorld = new THREE.Vector3();
  const skillQHeadAppliedOffsetWorld = new THREE.Vector3();
  const skillQHeadReturnStartOffsetWorld = new THREE.Vector3();
  const skillQHeadZeroOffset = new THREE.Vector3(0, 0, 0);
  const skillQCameraAnchorLocalPos = new THREE.Vector3();
  const skillQCameraFollowAnchor = new THREE.Object3D();
  skillQCameraFollowAnchor.name = "slimlu-q-camera-anchor";
  avatar.add(skillQCameraFollowAnchor);

  const setAbsorptionCoefficient = (nextValue: number) => {
    absorptionCoefficient = Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
    absorptionCoefficientHud.setValue(absorptionCoefficient);
  };

  const startRuntimeSkillECooldown = (now: number) => {
    if (skillECooldownDurationMs <= 0) {
      runtimeSkillECooldownUntil = 0;
      return;
    }
    runtimeSkillECooldownUntil = now + skillECooldownDurationMs;
  };

  const clearRuntimeSkillECooldown = () => {
    runtimeSkillECooldownUntil = 0;
    clearSkillCooldown?.("e");
  };

  const startRuntimeSkillRCooldown = (now: number, durationMs: number) => {
    runtimeSkillRCooldownDurationMs = Math.max(0, durationMs);
    if (noCooldown || runtimeSkillRCooldownDurationMs <= 0) {
      runtimeSkillRCooldownUntil = 0;
      return;
    }
    runtimeSkillRCooldownUntil = now + runtimeSkillRCooldownDurationMs;
  };

  const reduceRuntimeCooldowns = (reductionMs: number, now: number) => {
    const resolvedReduction = Math.max(0, reductionMs);
    if (resolvedReduction <= 0) return;

    if (runtimeSkillECooldownUntil > 0) {
      runtimeSkillECooldownUntil = Math.max(
        0,
        runtimeSkillECooldownUntil - resolvedReduction
      );
      if (runtimeSkillECooldownUntil <= now + 0.001) {
        runtimeSkillECooldownUntil = 0;
        clearSkillCooldown?.("e");
      }
    }

    if (runtimeSkillRCooldownUntil > 0) {
      runtimeSkillRCooldownUntil = Math.max(
        0,
        runtimeSkillRCooldownUntil - resolvedReduction
      );
      if (runtimeSkillRCooldownUntil <= now + 0.001) {
        runtimeSkillRCooldownUntil = 0;
        clearSkillCooldown?.("r");
      }
    }
  };

  const hasEnoughManualMana = (cost: number) => {
    if (noCooldown || cost <= 0) return true;
    const mana = getCurrentStats?.()?.mana;
    if (typeof mana !== "number" || !Number.isFinite(mana)) return true;
    return mana + 0.0001 >= cost;
  };

  const spendManualMana = (cost: number) => {
    if (noCooldown || cost <= 0) return true;
    const spent = spendMana?.(cost);
    if (typeof spent !== "number" || !Number.isFinite(spent)) return true;
    return spent + 0.0001 >= cost;
  };

  const isSkillRSequenceActive = () =>
    skillRAwaitMouthOpen || skillRMouthHeld || skillRCharging || Boolean(activeSkillRBeam);

  const holdSkillRMouthOpen = () => {
    if (!skillRBinding) return;
    const action = skillRBinding.action;
    const holdTime = Math.max(
      0,
      skillRBinding.clip.duration * skillRMouthOpenStartNormalized
    );
    action.time = holdTime;
    action.paused = true;
    action.enabled = true;
    action.setEffectiveWeight(1);
    skillRMouthHeld = true;
  };

  const releaseSkillRMouthOpen = () => {
    if (!skillRMouthHeld) return;
    if (skillRBinding) {
      const action = skillRBinding.action;
      action.enabled = true;
      action.paused = false;
      action.setEffectiveWeight(1);
      if (!action.isRunning()) {
        action.play();
      }
    }
    skillRMouthHeld = false;
  };

  const removeDrainLink = (targetId: string) => {
    const state = activeDrainLinks.get(targetId);
    if (!state) return;
    state.root.removeFromParent();
    state.segmentGeometry.dispose();
    state.material.dispose();
    activeDrainLinks.delete(targetId);
  };

  const clearDrainLinks = () => {
    Array.from(activeDrainLinks.keys()).forEach((targetId) => removeDrainLink(targetId));
  };

  const createDrainLink = (target: RuntimeAttackTarget, now: number): DrainLinkState => {
    const controlPoints = Array.from(
      { length: drainLinkControlPointCount },
      () => new THREE.Vector3()
    );
    const root = new THREE.Group();
    const segmentGeometry = new THREE.CylinderGeometry(
      1,
      1,
      1,
      drainLinkSegmentRadialSegments,
      1,
      true
    );
    const material = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: true,
    });
    const segments = Array.from(
      { length: Math.max(0, controlPoints.length - 1) },
      () => {
        const segment = new THREE.Mesh(segmentGeometry, material);
        segment.frustumCulled = false;
        segment.renderOrder = 96;
        segment.layers.set(0);
        root.add(segment);
        return segment;
      }
    );
    root.layers.set(0);
    (avatar.parent ?? avatar).add(root);
    return {
      target,
      root,
      segmentGeometry,
      segments,
      material,
      controlPoints,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.006 + Math.random() * 0.004,
      wobbleScale: 0.11 + Math.random() * 0.06,
      nextDamageAt: now + drainTickMs,
      createdAt: now,
    };
  };

  const resolveDrainOriginWorldPosition = (target: THREE.Vector3) => {
    if (rootChildBoneAnchor) {
      rootChildBoneAnchor.updateMatrixWorld(true);
      if (rootChildBoneTailChildren.length > 0) {
        target.set(0, 0, 0);
        for (let i = 0; i < rootChildBoneTailChildren.length; i += 1) {
          const childBone = rootChildBoneTailChildren[i];
          childBone.updateMatrixWorld(true);
          childBone.getWorldPosition(drainOriginChildWorldPos);
          target.add(drainOriginChildWorldPos);
        }
        target.multiplyScalar(1 / rootChildBoneTailChildren.length);
        return target;
      }
      const parentBone = rootChildBoneAnchor.parent;
      if (isBoneObject(parentBone)) {
        parentBone.updateMatrixWorld(true);
        parentBone.getWorldPosition(drainOriginParentWorldPos);
        rootChildBoneAnchor.getWorldPosition(target);
        drainOriginParentToBone.copy(target).sub(drainOriginParentWorldPos);
        if (drainOriginParentToBone.lengthSq() > 0.000001) {
          target.add(drainOriginParentToBone);
          return target;
        }
      }
      return rootChildBoneAnchor.getWorldPosition(target);
    }
    if (bodyCenterAnchor) {
      bodyCenterAnchor.updateMatrixWorld(true);
      return bodyCenterAnchor.getWorldPosition(target);
    }
    avatar.updateMatrixWorld(true);
    avatar.getWorldPosition(target);
    target.y += 0.92;
    return target;
  };

  const resolveTargetCenterHeightWorldPosition = (
    object: THREE.Object3D,
    target: THREE.Vector3
  ) => {
    object.updateMatrixWorld(true);
    object.getWorldPosition(target);
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const geometry = mesh.geometry;
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }
      if (geometry.boundingBox) {
        targetLocalCenterPos
          .copy(geometry.boundingBox.min)
          .add(geometry.boundingBox.max)
          .multiplyScalar(0.5);
        targetCenterScratch.copy(targetLocalCenterPos);
        object.localToWorld(targetCenterScratch);
        target.y = targetCenterScratch.y;
        return target;
      }
    }
    targetWorldBounds.setFromObject(object);
    if (!targetWorldBounds.isEmpty()) {
      target.y = (targetWorldBounds.min.y + targetWorldBounds.max.y) * 0.5;
    }
    return target;
  };

  const removeSlimeDissolveParticleAt = (index: number) => {
    const particle = slimeDissolveParticles[index];
    if (!particle) return;
    particle.mesh.removeFromParent();
    particle.material.dispose();
    slimeDissolveParticles.splice(index, 1);
  };

  const updateSlimeDissolveParticles = (delta: number) => {
    for (let i = slimeDissolveParticles.length - 1; i >= 0; i -= 1) {
      const particle = slimeDissolveParticles[i];
      particle.age += delta;
      const t = particle.life > 0 ? particle.age / particle.life : 1;
      if (t >= 1) {
        removeSlimeDissolveParticleAt(i);
        continue;
      }
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.velocity.multiplyScalar(0.95);
      particle.velocity.y += 0.82 * delta;
      particle.mesh.rotation.x += particle.spin.x * delta;
      particle.mesh.rotation.y += particle.spin.y * delta;
      particle.mesh.rotation.z += particle.spin.z * delta;
      particle.mesh.scale.setScalar(
        THREE.MathUtils.lerp(particle.startScale, particle.endScale, t)
      );
      particle.material.opacity = Math.max(0, (1 - t) * (1 - t) * 0.92);
    }
  };

  const removeSlimeAttachPulseAt = (index: number) => {
    const pulse = slimeAttachPulses[index];
    if (!pulse) return;
    pulse.mesh.removeFromParent();
    pulse.material.dispose();
    slimeAttachPulses.splice(index, 1);
  };

  const updateSlimeAttachPulses = (delta: number) => {
    for (let i = slimeAttachPulses.length - 1; i >= 0; i -= 1) {
      const pulse = slimeAttachPulses[i];
      pulse.age += delta;
      const t = pulse.life > 0 ? pulse.age / pulse.life : 1;
      if (t >= 1) {
        removeSlimeAttachPulseAt(i);
        continue;
      }
      const scale = THREE.MathUtils.lerp(pulse.startScale, pulse.endScale, t);
      pulse.mesh.scale.set(scale, scale, scale);
      pulse.material.opacity = Math.max(0, (1 - t) * 0.82);
    }
  };

  const spawnSlimeDissolveFx = (worldPosition: THREE.Vector3, intensity = 1) => {
    const effectParent = avatar.parent ?? avatar;
    const spawnCount = Math.max(
      8,
      Math.round(slimeCloneDissolveParticleCount * THREE.MathUtils.clamp(intensity, 0.3, 2))
    );
    for (let i = 0; i < spawnCount; i += 1) {
      const material = slimeCloneDissolveMaterialTemplate.clone();
      material.opacity *= THREE.MathUtils.lerp(0.72, 1.08, Math.random());
      const mesh = new THREE.Mesh(slimeCloneDissolveGeometry, material);
      mesh.position.copy(worldPosition);
      mesh.position.x += (Math.random() - 0.5) * 0.36;
      mesh.position.y += Math.random() * 0.5;
      mesh.position.z += (Math.random() - 0.5) * 0.36;
      const startScale = THREE.MathUtils.lerp(0.08, 0.22, Math.random());
      const endScale = startScale * THREE.MathUtils.lerp(1.2, 2.4, Math.random());
      mesh.scale.setScalar(startScale);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      effectParent.add(mesh);
      slimeDissolveParticles.push({
        mesh,
        material,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 3.2,
          THREE.MathUtils.lerp(1.8, 4.4, Math.random()),
          (Math.random() - 0.5) * 3.2
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6
        ),
        age: 0,
        life: THREE.MathUtils.lerp(slimeCloneDissolveLifeMin, slimeCloneDissolveLifeMax, Math.random()),
        startScale,
        endScale,
      });
    }
  };

  const spawnSlimeAttachPulse = (worldPosition: THREE.Vector3) => {
    const effectParent = avatar.parent ?? avatar;
    const material = slimeCloneAttachPulseMaterialTemplate.clone();
    const mesh = new THREE.Mesh(slimeCloneAttachPulseGeometry, material);
    mesh.position.copy(worldPosition);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(0.28);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    effectParent.add(mesh);
    slimeAttachPulses.push({
      mesh,
      material,
      age: 0,
      life: slimeCloneAttachPulseLife,
      startScale: 0.28,
      endScale: 1.14,
    });
  };

  const clearSkillRChargeFx = () => {
    skillRChargeRoot?.removeFromParent();
    skillRChargeRoot = null;
    skillRChargeSphere = null;
    skillRChargeParticleMaterial?.dispose();
    skillRChargeSphereMaterial?.dispose();
    skillRChargeParticleMaterial = null;
    skillRChargeSphereMaterial = null;
    skillRChargeParticles.length = 0;
  };

  const ensureSkillRChargeFx = () => {
    if (skillRChargeRoot) return;
    const fxRoot = new THREE.Group();
    fxRoot.layers.set(0);

    skillRChargeSphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    skillRChargeSphere = new THREE.Mesh(
      skillRChargeSphereGeometry,
      skillRChargeSphereMaterial
    );
    skillRChargeSphere.renderOrder = 102;
    skillRChargeSphere.scale.setScalar(0.34);
    skillRChargeSphere.layers.set(0);
    fxRoot.add(skillRChargeSphere);

    skillRChargeParticleMaterial = new THREE.MeshBasicMaterial({
      color: 0x86efac,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < skillRChargeParticleCount; i += 1) {
      const mesh = new THREE.Mesh(
        skillRChargeParticleGeometry,
        skillRChargeParticleMaterial
      );
      mesh.layers.set(0);
      mesh.renderOrder = 103;
      const particle: SkillRChargeParticle = {
        mesh,
        angle: Math.random() * Math.PI * 2,
        spin: THREE.MathUtils.lerp(1.4, 4.8, Math.random()),
        baseRadius: THREE.MathUtils.lerp(0.45, 1.1, Math.random()),
        height: THREE.MathUtils.lerp(-0.38, 0.4, Math.random()),
        phase: Math.random() * Math.PI * 2,
        drift: THREE.MathUtils.lerp(0.02, 0.12, Math.random()),
      };
      mesh.scale.setScalar(THREE.MathUtils.lerp(0.02, 0.07, Math.random()));
      fxRoot.add(mesh);
      skillRChargeParticles.push(particle);
    }
    skillRChargeRoot = fxRoot;
    (avatar.parent ?? avatar).add(skillRChargeRoot);
  };

  const resolveSkillREffectOriginWorldPosition = (
    target: THREE.Vector3,
    directionHint?: THREE.Vector3 | null
  ) => {
    resolveDrainOriginWorldPosition(target);
    if (directionHint && directionHint.lengthSq() > 0.000001) {
      target.addScaledVector(directionHint, skillRChargeFrontOffset);
    } else if (runtimeAimDirection.lengthSq() > 0.000001) {
      target.addScaledVector(runtimeAimDirection, skillRChargeFrontOffset);
    } else {
      avatar.getWorldDirection(skillRAvatarForward);
      if (skillRAvatarForward.lengthSq() > 0.000001) {
        target.addScaledVector(skillRAvatarForward.normalize(), skillRChargeFrontOffset);
      }
    }
    target.y += skillRChargeVerticalOffset;
    return target;
  };

  const updateSkillRChargeFx = (now: number) => {
    if (!skillRChargeRoot || !skillRChargeSphere) return;
    const fxParent = avatar.parent ?? avatar;
    if (skillRChargeRoot.parent !== fxParent) {
      skillRChargeRoot.removeFromParent();
      fxParent.add(skillRChargeRoot);
    }
    resolveSkillREffectOriginWorldPosition(drainOriginWorldPos, runtimeAimDirection);
    skillRChargeRoot.position.copy(drainOriginWorldPos);
    fxParent.worldToLocal(skillRChargeRoot.position);

    const progress = THREE.MathUtils.clamp(
      (now - skillRChargeStartedAt) / skillRBeamChargeDurationMs,
      0,
      1
    );
    const gather = 1 - Math.pow(1 - progress, 3);
    const t = now * 0.001;
    for (let i = 0; i < skillRChargeParticles.length; i += 1) {
      const particle = skillRChargeParticles[i];
      const angle = particle.angle + t * particle.spin + Math.sin(t * 2 + particle.phase) * 0.22;
      const radius = THREE.MathUtils.lerp(particle.baseRadius, 0.04, gather);
      const lift = particle.height * (1 - gather);
      particle.mesh.position.set(
        Math.cos(angle) * radius,
        lift + Math.sin(t * 4.2 + particle.phase) * particle.drift,
        Math.sin(angle) * radius
      );
      const pulse = 0.8 + Math.sin(t * 9 + particle.phase) * 0.28;
      const particleScale = THREE.MathUtils.lerp(0.06, 0.024, gather) * pulse;
      particle.mesh.scale.setScalar(Math.max(0.012, particleScale));
    }

    const compressionPulse = 1 + Math.sin(now * 0.038) * 0.12;
    const compressedScale = THREE.MathUtils.lerp(0.26, 0.48, gather) * compressionPulse;
    skillRChargeSphere.scale.setScalar(compressedScale);
    if (skillRChargeSphereMaterial) {
      skillRChargeSphereMaterial.opacity = 0.2 + gather * 0.64;
      skillRChargeSphereMaterial.needsUpdate = true;
    }
    if (skillRChargeParticleMaterial) {
      skillRChargeParticleMaterial.opacity = 0.18 + gather * 0.76;
      skillRChargeParticleMaterial.needsUpdate = true;
    }
  };

  const resolveSkillRBeamGrowthFactor = (distance: number) => {
    const clampedDistance = Math.max(0, distance);
    const normalized =
      clampedDistance / Math.max(0.001, skillRBeamGrowthDistanceCap);
    return THREE.MathUtils.clamp(normalized * skillRBeamGrowthCoefficient, 0, 1);
  };

  const resolveSkillRBeamRadiusAtDistance = (
    startRadius: number,
    endRadius: number,
    distance: number
  ) =>
    THREE.MathUtils.lerp(
      startRadius,
      endRadius,
      resolveSkillRBeamGrowthFactor(distance)
    );

  const createSkillRBeamLayer = ({
    totalLength,
    growthLength,
    startRadius,
    endRadius,
    radialSegments,
    color,
    opacity,
    renderOrder,
  }: {
    totalLength: number;
    growthLength: number;
    startRadius: number;
    endRadius: number;
    radialSegments: number;
    color: number;
    opacity: number;
    renderOrder: number;
  }) => {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const clampedGrowthLength = THREE.MathUtils.clamp(growthLength, 0, totalLength);
    const lockedRadius = resolveSkillRBeamRadiusAtDistance(
      startRadius,
      endRadius,
      clampedGrowthLength
    );

    let growthMesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> | null = null;
    if (clampedGrowthLength > 0.0001) {
      const growthGeometry = new THREE.CylinderGeometry(
        lockedRadius,
        startRadius,
        clampedGrowthLength,
        radialSegments,
        1,
        true
      );
      growthMesh = new THREE.Mesh(growthGeometry, material);
      growthMesh.position.y = -totalLength * 0.5 + clampedGrowthLength * 0.5;
      growthMesh.renderOrder = renderOrder;
      growthMesh.layers.set(0);
    }

    const stableLength = Math.max(0, totalLength - clampedGrowthLength);
    let staticMesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> | null = null;
    if (stableLength > 0.0001) {
      const staticGeometry = new THREE.CylinderGeometry(
        lockedRadius,
        lockedRadius,
        stableLength,
        radialSegments,
        1,
        true
      );
      staticMesh = new THREE.Mesh(staticGeometry, material);
      staticMesh.position.y = -totalLength * 0.5 + clampedGrowthLength + stableLength * 0.5;
      staticMesh.renderOrder = renderOrder;
      staticMesh.layers.set(0);
    }

    return {
      material,
      growthMesh,
      staticMesh,
    } satisfies SkillRBeamLayerState;
  };

  const disposeSkillRBeamLayer = (layer: SkillRBeamLayerState) => {
    if (layer.growthMesh) {
      layer.growthMesh.geometry.dispose();
    }
    if (layer.staticMesh) {
      layer.staticMesh.geometry.dispose();
    }
    layer.material.dispose();
  };

  const clearSkillRBeamFx = () => {
    if (!activeSkillRBeam) return;
    activeSkillRBeam.root.removeFromParent();
    disposeSkillRBeamLayer(activeSkillRBeam.aura);
    disposeSkillRBeamLayer(activeSkillRBeam.core);
    disposeSkillRBeamLayer(activeSkillRBeam.shell);
    for (let i = 0; i < activeSkillRBeam.rings.length; i += 1) {
      activeSkillRBeam.rings[i].material.dispose();
    }
    activeSkillRBeam = null;
  };

  const spawnSkillRBeamFx = (
    now: number,
    beamOriginWorld: THREE.Vector3,
    beamDirectionWorld: THREE.Vector3
  ) => {
    clearSkillRBeamFx();
    const fxParent = avatar.parent ?? avatar;
    lineStartLocal.copy(beamOriginWorld);
    lineEndLocal.copy(beamDirectionWorld).multiplyScalar(skillRBeamLength).add(beamOriginWorld);
    fxParent.worldToLocal(lineStartLocal);
    fxParent.worldToLocal(lineEndLocal);
    segmentDirection.copy(lineEndLocal).sub(lineStartLocal);
    const localLength = segmentDirection.length();
    if (localLength <= 0.0001) return;
    segmentDirection.multiplyScalar(1 / localLength);
    segmentMidpoint.copy(lineStartLocal).add(lineEndLocal).multiplyScalar(0.5);

    const root = new THREE.Group();
    root.layers.set(0);
    root.position.copy(segmentMidpoint);
    root.quaternion.setFromUnitVectors(segmentUpAxis, segmentDirection);

    const growthLength = Math.min(localLength, skillRBeamGrowthDistanceCap);
    const aura = createSkillRBeamLayer({
      totalLength: localLength,
      growthLength,
      startRadius: skillRBeamAuraStartRadius,
      endRadius: skillRBeamAuraEndRadius,
      radialSegments: 18,
      color: 0x16a34a,
      opacity: 0.2,
      renderOrder: 102,
    });
    const shell = createSkillRBeamLayer({
      totalLength: localLength,
      growthLength,
      startRadius: skillRBeamShellStartRadius,
      endRadius: skillRBeamShellEndRadius,
      radialSegments: 20,
      color: 0x22c55e,
      opacity: 0.58,
      renderOrder: 103,
    });
    const core = createSkillRBeamLayer({
      totalLength: localLength,
      growthLength,
      startRadius: skillRBeamCoreStartRadius,
      endRadius: skillRBeamCoreEndRadius,
      radialSegments: 20,
      color: 0xbbf7d0,
      opacity: 0.95,
      renderOrder: 104,
    });

    const layerMeshes = [
      aura.growthMesh,
      aura.staticMesh,
      shell.growthMesh,
      shell.staticMesh,
      core.growthMesh,
      core.staticMesh,
    ];
    for (let i = 0; i < layerMeshes.length; i += 1) {
      const mesh = layerMeshes[i];
      if (mesh) {
        root.add(mesh);
      }
    }

    const rings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];
    const ringOffsets: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(skillRBeamRingGeometry, ringMaterial);
      ring.layers.set(0);
      ring.renderOrder = 105;
      const ringScale = THREE.MathUtils.lerp(0.9, 1.3, Math.random());
      ring.scale.setScalar(ringScale);
      ring.position.y = -localLength * 0.5 + (i / 4) * localLength;
      ringOffsets.push(Math.random());
      rings.push(ring);
      root.add(ring);
    }

    fxParent.add(root);
    activeSkillRBeam = {
      root,
      aura,
      core,
      shell,
      rings,
      ringOffsets,
      startedAt: now,
      durationSec: skillRBeamDurationSec,
      length: localLength,
    };
  };

  const updateSkillRBeamFx = (now: number) => {
    if (!activeSkillRBeam) return;
    const elapsedSec = Math.max(0, (now - activeSkillRBeam.startedAt) / 1000);
    const progress = elapsedSec / Math.max(0.001, activeSkillRBeam.durationSec);
    if (progress >= 1) {
      clearSkillRBeamFx();
      return;
    }

    const fade = 1 - progress;
    activeSkillRBeam.aura.material.opacity =
      (0.14 + Math.sin(now * 0.022) * 0.06) * fade;
    activeSkillRBeam.core.material.opacity = 0.94 * fade;
    activeSkillRBeam.shell.material.opacity =
      (0.44 + Math.sin(now * 0.036) * 0.14) * fade;
    for (let i = 0; i < activeSkillRBeam.rings.length; i += 1) {
      const ring = activeSkillRBeam.rings[i];
      const ringOffset = activeSkillRBeam.ringOffsets[i] ?? 0;
      const travel = (progress * 1.46 + ringOffset) % 1;
      const distanceAlongBeam = travel * activeSkillRBeam.length;
      ring.position.y = -activeSkillRBeam.length * 0.5 + distanceAlongBeam;
      const pulse = 0.74 + Math.sin(now * 0.027 + i * 1.2) * 0.24;
      const beamRadiusAtRing = resolveSkillRBeamRadiusAtDistance(
        skillRBeamShellStartRadius,
        skillRBeamShellEndRadius,
        distanceAlongBeam
      );
      ring.scale.setScalar(Math.max(0.35, beamRadiusAtRing * pulse));
      ring.material.opacity = Math.max(0, (1 - travel * 0.5) * fade * 0.68);
    }
  };

  const resolveSkillRTargetRadius = (targetObject: THREE.Object3D) => {
    targetWorldBounds.setFromObject(targetObject);
    if (targetWorldBounds.isEmpty()) return 0.62;
    targetWorldBounds.getSize(skillRTargetBoundsSize);
    const horizontalRadius = Math.max(skillRTargetBoundsSize.x, skillRTargetBoundsSize.z) * 0.5;
    return THREE.MathUtils.clamp(horizontalRadius, 0.45, 2.8);
  };

  const distanceSqAndTravelOnBeamSegment = (
    point: THREE.Vector3,
    beamStart: THREE.Vector3,
    beamEnd: THREE.Vector3
  ) => {
    skillRBeamSegmentVector.copy(beamEnd).sub(beamStart);
    const segmentLengthSq = skillRBeamSegmentVector.lengthSq();
    if (segmentLengthSq <= 0.000001) {
      return {
        distanceSq: point.distanceToSquared(beamStart),
        t: 0,
      };
    }
    skillRBeamPointOffset.copy(point).sub(beamStart);
    const t = THREE.MathUtils.clamp(
      skillRBeamPointOffset.dot(skillRBeamSegmentVector) / segmentLengthSq,
      0,
      1
    );
    skillRBeamClosestPoint.copy(beamStart).addScaledVector(skillRBeamSegmentVector, t);
    return {
      distanceSq: point.distanceToSquared(skillRBeamClosestPoint),
      t,
    };
  };

  const tintCloneMaterialGreen = (material: THREE.Material) => {
    const cloned = material.clone();
    const colorMaterial = cloned as THREE.Material & {
      color?: THREE.Color;
      emissive?: THREE.Color;
      emissiveIntensity?: number;
      map?: THREE.Texture | null;
      emissiveMap?: THREE.Texture | null;
    };
    if (Object.prototype.hasOwnProperty.call(colorMaterial, "map")) {
      colorMaterial.map = null;
    }
    if (Object.prototype.hasOwnProperty.call(colorMaterial, "emissiveMap")) {
      colorMaterial.emissiveMap = null;
    }
    if (colorMaterial.color?.isColor) {
      colorMaterial.color.set(0x22c55e);
    }
    if (colorMaterial.emissive?.isColor) {
      colorMaterial.emissive.set(0x166534);
      colorMaterial.emissiveIntensity = Math.max(
        colorMaterial.emissiveIntensity ?? 0,
        0.3
      );
    }
    cloned.needsUpdate = true;
    return cloned;
  };

  const buildSlimeCloneVisual = (cloneRootName: string) => {
    const visualMaterials: THREE.Material[] = [];
    const sourceModel = boundModel;
    let visual: THREE.Object3D;
    if (sourceModel) {
      const clonedModel = cloneSkeleton(sourceModel);
      clonedModel.name = `${cloneRootName}-visual`;
      clonedModel.position.set(0, 0, 0);
      clonedModel.rotation.set(0, 0, 0);
      clonedModel.scale.multiplyScalar(slimeCloneModelScale);
      clonedModel.traverse((child) => {
        child.layers.set(0);
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((material) => {
            const nextMaterial = tintCloneMaterialGreen(material);
            visualMaterials.push(nextMaterial);
            return nextMaterial;
          });
          return;
        }
        const nextMaterial = tintCloneMaterialGreen(mesh.material);
        visualMaterials.push(nextMaterial);
        mesh.material = nextMaterial;
      });
      visual = clonedModel;
    } else {
      const fallbackMaterial = slimeCloneFallbackMaterialTemplate.clone();
      visualMaterials.push(fallbackMaterial);
      const fallbackMesh = new THREE.Mesh(
        slimeCloneFallbackGeometry,
        fallbackMaterial
      );
      fallbackMesh.castShadow = true;
      fallbackMesh.receiveShadow = false;
      fallbackMesh.position.set(0, 0.48, 0);
      visual = fallbackMesh;
    }
    visual.layers.set(0);
    return { visual, visualMaterials };
  };

  const setSlimeCloneWalking = (clone: SlimeCloneState, shouldWalk: boolean) => {
    if (clone.isWalking === shouldWalk) return;
    clone.isWalking = shouldWalk;
    if (!clone.walkAction) return;
    if (shouldWalk) {
      clone.walkAction.enabled = true;
      clone.walkAction.paused = false;
      clone.walkAction.setEffectiveWeight(1);
      clone.walkAction.setEffectiveTimeScale(1);
      if (!clone.walkAction.isRunning()) {
        clone.walkAction.play();
      }
      return;
    }
    clone.walkAction.stop();
    clone.walkAction.paused = true;
    clone.walkAction.enabled = true;
    clone.walkAction.setEffectiveWeight(0);
  };

  const setSlimeCloneAttachedVisual = (
    clone: SlimeCloneState,
    attached: boolean
  ) => {
    if (clone.attachedVisualApplied === attached) return;
    clone.attachedVisualApplied = attached;
    for (let i = 0; i < clone.visualMaterials.length; i += 1) {
      const material = clone.visualMaterials[i] as THREE.Material & {
        transparent?: boolean;
        opacity?: number;
      };
      const baseOpacityRaw = material.userData?.slimeCloneBaseOpacity;
      const baseOpacity =
        typeof baseOpacityRaw === "number" && Number.isFinite(baseOpacityRaw)
          ? baseOpacityRaw
          : typeof material.opacity === "number"
            ? material.opacity
            : 1;
      if (material.userData) {
        material.userData.slimeCloneBaseOpacity = baseOpacity;
      }
      if (typeof material.opacity === "number") {
        material.opacity = attached ? Math.max(0.25, baseOpacity * 0.62) : baseOpacity;
      }
      if (typeof material.transparent === "boolean") {
        material.transparent = attached || baseOpacity < 1;
      }
      material.needsUpdate = true;
    }
  };

  const removeSlimeClone = (
    cloneId: string,
    options?: {
      spawnDissolve?: boolean;
      dissolveIntensity?: number;
    }
  ) => {
    const clone = activeSlimeClones.get(cloneId);
    if (!clone) return;
    clone.root.getWorldPosition(slimeCloneSourceWorldPos);
    if (options?.spawnDissolve ?? true) {
      spawnSlimeDissolveFx(
        slimeCloneSourceWorldPos,
        options?.dissolveIntensity ?? 1
      );
    }
    unregisterSlimluThreatEntry(clone.id);
    clone.root.removeFromParent();
    setSlimeCloneWalking(clone, false);
    if (clone.mixer) {
      clone.mixer.stopAllAction();
      clone.mixer.uncacheRoot(clone.visual);
    }
    for (let i = 0; i < clone.visualMaterials.length; i += 1) {
      clone.visualMaterials[i].dispose();
    }
    activeSlimeClones.delete(clone.id);
  };

  const clearSlimeClones = (spawnDissolve = false) => {
    const ids = Array.from(activeSlimeClones.keys());
    for (let i = 0; i < ids.length; i += 1) {
      removeSlimeClone(ids[i], { spawnDissolve });
    }
  };

  const clearSlimeCloneEffects = () => {
    for (let i = slimeDissolveParticles.length - 1; i >= 0; i -= 1) {
      removeSlimeDissolveParticleAt(i);
    }
    for (let i = slimeAttachPulses.length - 1; i >= 0; i -= 1) {
      removeSlimeAttachPulseAt(i);
    }
  };

  const disposeSlimeCloneRenderResources = () => {
    slimeCloneFallbackGeometry.dispose();
    slimeCloneFallbackMaterialTemplate.dispose();
    slimeCloneDissolveGeometry.dispose();
    slimeCloneAttachPulseGeometry.dispose();
    slimeCloneDissolveMaterialTemplate.dispose();
    slimeCloneAttachPulseMaterialTemplate.dispose();
  };

  const disposeSkillRRenderResources = () => {
    skillRChargeParticleGeometry.dispose();
    skillRChargeSphereGeometry.dispose();
    skillRBeamRingGeometry.dispose();
  };

  const applyDamageToSlimeClone = (cloneId: string, amount: number) => {
    const clone = activeSlimeClones.get(cloneId);
    if (!clone || amount <= 0) return 0;
    if (clone.attachedTargetId) return 0;
    const applied = Math.min(clone.health, Math.max(0, amount));
    if (applied <= 0) return 0;
    clone.health = Math.max(0, clone.health - applied);
    if (clone.health <= 0) {
      removeSlimeClone(clone.id, { spawnDissolve: true, dissolveIntensity: 1.15 });
    }
    return applied;
  };

  const createSlimeClone = () => {
    const cloneParent = avatar.parent ?? avatar;
    avatar.getWorldPosition(slimeCloneSpawnWorldPos);
    cloneParent.worldToLocal(slimeCloneSpawnWorldPos);
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnRadius = Math.sqrt(Math.random()) * slimeCloneSpawnRadius;
    const root = new THREE.Group();
    root.name = `slimlu-clone-${slimeCloneIdCounter + 1}`;
    root.position.set(
      slimeCloneSpawnWorldPos.x + Math.cos(spawnAngle) * spawnRadius,
      slimeCloneSpawnWorldPos.y,
      slimeCloneSpawnWorldPos.z + Math.sin(spawnAngle) * spawnRadius
    );
    root.layers.set(0);
    const cloneVisual = buildSlimeCloneVisual(root.name);
    root.add(cloneVisual.visual);
    cloneParent.add(root);

    let cloneMixer: THREE.AnimationMixer | null = null;
    let cloneWalkAction: THREE.AnimationAction | null = null;
    if (boundWalkClip) {
      cloneMixer = new THREE.AnimationMixer(cloneVisual.visual);
      cloneWalkAction = cloneMixer.clipAction(boundWalkClip);
      cloneWalkAction.setLoop(THREE.LoopRepeat, Infinity);
      cloneWalkAction.enabled = true;
      cloneWalkAction.paused = true;
      cloneWalkAction.setEffectiveWeight(0);
    }

    const cloneId = `slime-clone-${++slimeCloneIdCounter}`;
    const cloneState: SlimeCloneState = {
      id: cloneId,
      root,
      visual: cloneVisual.visual,
      visualMaterials: cloneVisual.visualMaterials,
      mixer: cloneMixer,
      walkAction: cloneWalkAction,
      isWalking: false,
      health: slimeCloneBaseHealth,
      speed: slimeCloneBaseSpeed,
      attachedTargetId: null,
      attachedTarget: null,
      attachedUntil: 0,
      attachedOffset: new THREE.Vector3(),
      attachedVisualApplied: false,
      recalling: false,
      recallStartedAt: 0,
      recallDurationMs: 0,
      recallStartLocalPos: new THREE.Vector3(),
      recallArcHeight: 0,
    };
    activeSlimeClones.set(cloneState.id, cloneState);
    registerSlimluThreatEntry({
      id: cloneState.id,
      object: cloneState.root,
      isActive: () =>
        activeSlimeClones.get(cloneState.id) === cloneState &&
        cloneState.health > 0 &&
        !cloneState.attachedTargetId,
      applyDamage: (amount) => applyDamageToSlimeClone(cloneState.id, amount),
    });
    spawnSlimeDissolveFx(root.getWorldPosition(slimeCloneSourceWorldPos), 0.62);
    return cloneState;
  };

  const processPendingSlimeCloneSpawns = (now: number) => {
    if (pendingSlimeCloneSpawnCount <= 0) return 0;
    if (nextSlimeCloneSpawnAt <= 0) {
      nextSlimeCloneSpawnAt = now;
    }
    let spawned = 0;
    while (
      pendingSlimeCloneSpawnCount > 0 &&
      now + 0.001 >= nextSlimeCloneSpawnAt
    ) {
      createSlimeClone();
      pendingSlimeCloneSpawnCount -= 1;
      spawned += 1;
      nextSlimeCloneSpawnAt += slimeCloneSummonIntervalMs;
    }
    if (pendingSlimeCloneSpawnCount <= 0) {
      pendingSlimeCloneSpawnCount = 0;
      nextSlimeCloneSpawnAt = 0;
    }
    return spawned;
  };

  const resolveAttackTargetById = (targetId: string) => {
    const targets = getAttackTargets?.() ?? [];
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target || target.id !== targetId) continue;
      if (target.isActive && !target.isActive()) return null;
      return target;
    }
    return null;
  };

  const countAttachedSlimeClones = (now: number) => {
    let count = 0;
    for (const clone of activeSlimeClones.values()) {
      if (!clone.attachedTargetId) continue;
      if (clone.attachedUntil > 0 && now >= clone.attachedUntil) continue;
      const resolvedTarget = resolveAttackTargetById(clone.attachedTargetId);
      if (!resolvedTarget?.object) continue;
      count += 1;
    }
    return count;
  };

  const closeEDetonationWindowIfNoAttachments = (now: number) => {
    if (!eDetonationWindowActive) return;
    if (countAttachedSlimeClones(now) > 0) return;
    eDetonationWindowActive = false;
    startRuntimeSkillECooldown(now);
  };

  const resolveSkillRAimDirection = (outputDirection: THREE.Vector3) => {
    if (runtimeAimDirection.lengthSq() > 0.000001) {
      outputDirection.copy(runtimeAimDirection).normalize();
      return outputDirection;
    }

    avatar.getWorldDirection(skillRAvatarForward);
    if (skillRAvatarForward.lengthSq() <= 0.000001) {
      skillRAvatarForward.set(0, 0, 1);
    }
    outputDirection.copy(skillRAvatarForward).normalize();
    return outputDirection;
  };

  const resolveRuntimeTargetHealth = (target: RuntimeAttackTarget) => {
    const targetWithHealth = target as RuntimeAttackTarget & {
      getHealth?: () => number;
    };
    const byTargetMethod = targetWithHealth.getHealth?.();
    if (typeof byTargetMethod === "number" && Number.isFinite(byTargetMethod)) {
      return byTargetMethod;
    }

    const targetObject = target.object as THREE.Object3D & {
      getHealth?: () => number;
      userData?: Record<string, unknown>;
    };
    const byObjectMethod = targetObject.getHealth?.();
    if (typeof byObjectMethod === "number" && Number.isFinite(byObjectMethod)) {
      return byObjectMethod;
    }

    const userDataHealth = targetObject.userData?.health;
    if (typeof userDataHealth === "number" && Number.isFinite(userDataHealth)) {
      return userDataHealth;
    }
    return null;
  };

  const resolveSkillQFlyBonesCenterWorldPosition = (output: THREE.Vector3) => {
    if (!skillQFlyBones.length) {
      output.set(0, 0, 0);
      return output;
    }
    output.set(0, 0, 0);
    for (let i = 0; i < skillQFlyBones.length; i += 1) {
      skillQFlyBones[i].bone.getWorldPosition(skillQFlyBoneWorldPos);
      output.add(skillQFlyBoneWorldPos);
    }
    output.multiplyScalar(1 / skillQFlyBones.length);
    return output;
  };

  const removeSkillQHeadFlightOffsetFromBones = () => {
    if (!skillQFlyBones.length) return;
    if (skillQHeadAppliedOffsetWorld.lengthSq() <= 0.0000001) return;
    for (let i = 0; i < skillQFlyBones.length; i += 1) {
      const state = skillQFlyBones[i];
      const parent = state.bone.parent;
      if (!parent) {
        state.bone.position.copy(state.restLocalPos);
        continue;
      }
      parent.updateMatrixWorld(true);
      state.bone.getWorldPosition(skillQFlyBoneWorldPos);
      skillQFlyBoneWorldPos.sub(skillQHeadAppliedOffsetWorld);
      skillQHeadTargetLocalPos.copy(skillQFlyBoneWorldPos);
      parent.worldToLocal(skillQHeadTargetLocalPos);
      state.bone.position.copy(skillQHeadTargetLocalPos);
      state.bone.updateMatrixWorld(true);
    }
  };

  const updateSkillQCameraFollowAnchor = (worldPos: THREE.Vector3) => {
    avatar.updateMatrixWorld(true);
    skillQCameraAnchorLocalPos.copy(worldPos);
    avatar.worldToLocal(skillQCameraAnchorLocalPos);
    skillQCameraFollowAnchor.position.copy(skillQCameraAnchorLocalPos);
    skillQCameraFollowAnchor.updateMatrixWorld(true);
  };

  const stopSkillQHeadFlight = () => {
    if (!skillQHeadFlightActive) return;
    removeSkillQHeadFlightOffsetFromBones();
    skillQHeadFlightActive = false;
    skillQHeadFlightStartedAt = 0;
    skillQHeadLastUpdateAt = 0;
    skillQHeadReturning = false;
    skillQHeadReturnStartedAt = 0;
    skillQHeadFlightOffsetWorld.set(0, 0, 0);
    skillQHeadAppliedOffsetWorld.set(0, 0, 0);
    skillQHeadReturnStartOffsetWorld.set(0, 0, 0);
    skillQConsumedTargetIds.clear();
    for (let i = 0; i < skillQFlyBones.length; i += 1) {
      const state = skillQFlyBones[i];
      state.bone.position.copy(state.restLocalPos);
      state.bone.updateMatrixWorld(true);
    }
  };

  const startSkillQHeadFlight = (now: number) => {
    if (!skillQFlyBones.length) return;
    for (let i = 0; i < skillQFlyBones.length; i += 1) {
      const state = skillQFlyBones[i];
      state.bone.updateMatrixWorld(true);
    }
    resolveSkillQFlyBonesCenterWorldPosition(skillQHeadStartWorldPos);
    resolveSkillRAimDirection(skillQHeadForwardWorldDir);
    skillQHeadReturning = false;
    skillQHeadReturnStartedAt = 0;
    skillQHeadFlightOffsetWorld.set(0, 0, 0);
    skillQHeadAppliedOffsetWorld.set(0, 0, 0);
    skillQHeadReturnStartOffsetWorld.set(0, 0, 0);
    updateSkillQCameraFollowAnchor(skillQHeadStartWorldPos);
    skillQHeadFlightActive = true;
    skillQHeadFlightStartedAt = now;
    skillQHeadLastUpdateAt = now;
    skillQConsumedTargetIds.clear();
  };

  const consumeSkillQTarget = (target: RuntimeAttackTarget, now: number) => {
    if (skillQConsumedTargetIds.has(target.id)) return;
    const healthBefore = resolveRuntimeTargetHealth(target);
    resolveTargetCenterHeightWorldPosition(target.object, targetWorldPos);
    skillQHeadTargetDirection.copy(targetWorldPos).sub(skillQHeadWorldPos);
    if (skillQHeadTargetDirection.lengthSq() <= 0.000001) {
      skillQHeadTargetDirection.copy(skillQHeadForwardWorldDir);
    } else {
      skillQHeadTargetDirection.normalize();
    }

    if (healthBefore === null || healthBefore >= skillQKillHealthThreshold) {
      target.onHit({
        now,
        source: "slash",
        damage: skillQHighHealthDamage,
        point: targetWorldPos.clone(),
        direction: skillQHeadTargetDirection.clone(),
      });
      setAbsorptionCoefficient(absorptionCoefficient + skillQHighHealthAcGain);
      skillQConsumedTargetIds.add(target.id);
      return;
    }

    target.onHit({
      now,
      source: "slash",
      damage: 999999,
      point: targetWorldPos.clone(),
      direction: skillQHeadTargetDirection.clone(),
    });
    applyHealth?.(skillQConsumeRewardHealth);
    applyMana?.(skillQConsumeRewardMana);
    setAbsorptionCoefficient(absorptionCoefficient + skillQConsumeRewardAc);
    skillQConsumedTargetIds.add(target.id);
  };

  const applySkillQHeadFlightOffsetToBones = () => {
    resolveSkillQFlyBonesCenterWorldPosition(skillQHeadBaseWorldPos).sub(
      skillQHeadAppliedOffsetWorld
    );
    skillQHeadWorldPos
      .copy(skillQHeadBaseWorldPos)
      .add(skillQHeadFlightOffsetWorld);
    for (let i = 0; i < skillQFlyBones.length; i += 1) {
      const state = skillQFlyBones[i];
      const parent = state.bone.parent;
      if (!parent) continue;
      parent.updateMatrixWorld(true);
      state.bone.getWorldPosition(skillQFlyBoneWorldPos);
      skillQFlyBoneWorldPos
        .sub(skillQHeadAppliedOffsetWorld)
        .add(skillQHeadFlightOffsetWorld);
      skillQHeadTargetLocalPos.copy(skillQFlyBoneWorldPos);
      parent.worldToLocal(skillQHeadTargetLocalPos);
      state.bone.position.copy(skillQHeadTargetLocalPos);
      state.bone.updateMatrixWorld(true);
    }
    skillQHeadAppliedOffsetWorld.copy(skillQHeadFlightOffsetWorld);
    updateSkillQCameraFollowAnchor(skillQHeadWorldPos);
  };

  const updateSkillQHeadFlight = (now: number) => {
    if (!skillQHeadFlightActive || !skillQFlyBones.length) return;
    const returnSec = Math.max(0.001, skillQHeadReturnDurationMs / 1000);
    const deltaSec =
      skillQHeadLastUpdateAt > 0
        ? Math.max(0.001, (now - skillQHeadLastUpdateAt) / 1000)
        : 0.016;
    skillQHeadLastUpdateAt = now;

    const outboundSec = skillQHeadMaxDistance / Math.max(1, skillQHeadFlightSpeed);
    const elapsedSec = Math.max(0, (now - skillQHeadFlightStartedAt) / 1000);

    if (!skillQHeadReturning && elapsedSec >= outboundSec) {
      skillQHeadReturning = true;
      skillQHeadReturnStartedAt = now;
      skillQHeadReturnStartOffsetWorld.copy(skillQHeadFlightOffsetWorld);
    }

    if (skillQHeadReturning) {
      const returnElapsedSec = Math.max(0, (now - skillQHeadReturnStartedAt) / 1000);
      const returnProgress = THREE.MathUtils.clamp(
        returnElapsedSec / returnSec,
        0,
        1
      );
      skillQHeadFlightOffsetWorld.lerpVectors(
        skillQHeadReturnStartOffsetWorld,
        skillQHeadZeroOffset,
        returnProgress
      );
      applySkillQHeadFlightOffsetToBones();
      if (returnProgress >= 0.999) {
        stopSkillQHeadFlight();
      }
      return;
    }

    const forwardDistance = Math.min(
      skillQHeadMaxDistance,
      elapsedSec * skillQHeadFlightSpeed
    );
    resolveSkillQFlyBonesCenterWorldPosition(skillQHeadBaseWorldPos).sub(
      skillQHeadAppliedOffsetWorld
    );
    skillQHeadWorldPos
      .copy(skillQHeadBaseWorldPos)
      .add(skillQHeadFlightOffsetWorld);
    skillQHeadDesiredWorldPos
      .copy(skillQHeadStartWorldPos)
      .addScaledVector(skillQHeadForwardWorldDir, forwardDistance);

    const targets = getAttackTargets?.() ?? [];
    let nearestTarget: RuntimeAttackTarget | null = null;
    let nearestDistanceSq = Infinity;
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target?.object) continue;
      if (target.isActive && !target.isActive()) continue;
      resolveTargetCenterHeightWorldPosition(target.object, targetWorldPos);
      const distanceSq = skillQHeadWorldPos.distanceToSquared(targetWorldPos);
      if (distanceSq >= nearestDistanceSq) continue;
      nearestDistanceSq = distanceSq;
      nearestTarget = target;
    }

    if (nearestTarget?.object) {
      resolveTargetCenterHeightWorldPosition(nearestTarget.object, targetWorldPos);
      skillQHeadDesiredWorldPos.lerp(
        targetWorldPos,
        THREE.MathUtils.clamp(skillQHeadSteerWeight + elapsedSec * 0.42, 0, 1)
      );
    }

    skillQHeadTargetDirection.copy(skillQHeadDesiredWorldPos).sub(skillQHeadWorldPos);
    skillQHeadMoveDelta.set(0, 0, 0);
    const desiredDistance = skillQHeadTargetDirection.length();
    if (desiredDistance > 0.0001) {
      const moveDistance = Math.min(desiredDistance, skillQHeadFlightSpeed * deltaSec);
      skillQHeadTargetDirection.multiplyScalar(1 / desiredDistance);
      skillQHeadMoveDelta.copy(skillQHeadTargetDirection).multiplyScalar(moveDistance);
      skillQHeadFlightOffsetWorld.add(skillQHeadMoveDelta);
      skillQHeadWorldPos.add(skillQHeadMoveDelta);
    }

    applySkillQHeadFlightOffsetToBones();

    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target?.object) continue;
      if (skillQConsumedTargetIds.has(target.id)) continue;
      if (target.isActive && !target.isActive()) continue;
      resolveTargetCenterHeightWorldPosition(target.object, targetWorldPos);
      const combinedRadius =
        skillQHeadHitRadius + resolveSkillRTargetRadius(target.object);
      if (
        skillQHeadWorldPos.distanceToSquared(targetWorldPos) >
        combinedRadius * combinedRadius
      ) {
        continue;
      }
      consumeSkillQTarget(target, now);
    }
  };

  const fireSkillRBeam = (now: number) => {
    resolveSkillRAimDirection(skillRAimDirection);
    resolveSkillREffectOriginWorldPosition(
      skillRBeamOriginWorldPos,
      skillRAimDirection
    );
    skillRBeamEndWorldPos
      .copy(skillRAimDirection)
      .multiplyScalar(skillRBeamLength)
      .add(skillRBeamOriginWorldPos);
    spawnSkillRBeamFx(now, skillRBeamOriginWorldPos, skillRAimDirection);

    const beamDamage = skillRBeamDamageBase + skillRBeamDamageAcScale * absorptionCoefficient;
    const targets = getAttackTargets?.() ?? [];
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target?.object) continue;
      if (target.isActive && !target.isActive()) continue;
      resolveTargetCenterHeightWorldPosition(target.object, targetWorldPos);
      const hitSample = distanceSqAndTravelOnBeamSegment(
        targetWorldPos,
        skillRBeamOriginWorldPos,
        skillRBeamEndWorldPos
      );
      const distanceAlongBeam = hitSample.t * skillRBeamLength;
      const beamHitRadiusAtTarget = resolveSkillRBeamRadiusAtDistance(
        skillRBeamHitStartRadius,
        skillRBeamHitEndRadius,
        distanceAlongBeam
      );
      const maxDistance =
        beamHitRadiusAtTarget + resolveSkillRTargetRadius(target.object);
      if (hitSample.distanceSq > maxDistance * maxDistance) {
        continue;
      }
      drainDirection.copy(targetWorldPos).sub(skillRBeamOriginWorldPos);
      if (drainDirection.lengthSq() <= 0.000001) {
        drainDirection.copy(skillRAimDirection);
      } else {
        drainDirection.normalize();
      }
      target.onHit({
        now,
        source: "slash",
        damage: beamDamage,
        point: targetWorldPos.clone(),
        direction: drainDirection.clone(),
      });
      applyEnergy?.(skillRBeamEnergyGainOnHit);
    }
  };

  const startSkillRBeamCharge = (now: number) => {
    skillRCharging = true;
    skillRChargeStartedAt = now;
    skillRChargeEndsAt = now + skillRBeamChargeDurationMs;
    ensureSkillRChargeFx();
    updateSkillRChargeFx(now);
  };

  const startAttachedCloneRecall = (clone: SlimeCloneState, now: number) => {
    const cloneParent = clone.root.parent ?? (avatar.parent ?? avatar);
    cloneParent.updateMatrixWorld(true);
    clone.recalling = true;
    clone.recallStartedAt = now;
    clone.recallStartLocalPos.copy(clone.root.position);
    clone.root.getWorldPosition(slimeCloneSourceWorldPos);
    resolveDrainOriginWorldPosition(drainOriginWorldPos);
    const recallDistance = slimeCloneSourceWorldPos.distanceTo(drainOriginWorldPos);
    clone.recallDurationMs = THREE.MathUtils.clamp(
      (recallDistance / Math.max(3.2, clone.speed * 2.6)) * 1000,
      260,
      880
    );
    clone.recallArcHeight = THREE.MathUtils.lerp(0.2, 0.5, Math.random());
    clone.attachedTarget = null;
    clone.attachedTargetId = null;
    clone.attachedUntil = 0;
    setSlimeCloneWalking(clone, false);
    setSlimeCloneAttachedVisual(clone, true);
  };

  const recallAttachedSlimeClones = (now: number) => {
    const cloneIds = Array.from(activeSlimeClones.keys());
    let recalledCount = 0;
    for (let i = 0; i < cloneIds.length; i += 1) {
      const clone = activeSlimeClones.get(cloneIds[i]);
      if (!clone || !clone.attachedTargetId) continue;
      const resolvedTarget = resolveAttackTargetById(clone.attachedTargetId);
      if (resolvedTarget?.object) {
        resolveTargetCenterHeightWorldPosition(resolvedTarget.object, targetWorldPos);
        clone.root.getWorldPosition(slimeCloneSourceWorldPos);
        slimeCloneMoveDirection.copy(targetWorldPos).sub(slimeCloneSourceWorldPos);
        if (slimeCloneMoveDirection.lengthSq() <= 0.000001) {
          slimeCloneMoveDirection.set(0, 1, 0);
        } else {
          slimeCloneMoveDirection.normalize();
        }
        resolvedTarget.onHit({
          now,
          source: "slash",
          damage: skillRRecallDamageBase + skillRRecallDamageAcScale * absorptionCoefficient,
          point: targetWorldPos.clone(),
          direction: slimeCloneMoveDirection.clone(),
        });
        spawnSlimeAttachPulse(targetWorldPos);
      }
      startAttachedCloneRecall(clone, now);
      recalledCount += 1;
    }
    return recalledCount;
  };

  const updateSkillRState = (now: number) => {
    if (skillRAwaitMouthOpen) {
      if (!skillRBinding) {
        skillRAwaitMouthOpen = false;
        skillRMouthHeld = false;
        startSkillRBeamCharge(now);
      } else {
        const action = skillRBinding.action;
        const holdTime = Math.max(
          0,
          skillRBinding.clip.duration * skillRMouthOpenStartNormalized
        );
        if (action.time + 0.0001 >= holdTime) {
          holdSkillRMouthOpen();
          skillRAwaitMouthOpen = false;
          startSkillRBeamCharge(now);
        }
      }
    }

    if (skillRCharging) {
      updateSkillRChargeFx(now);
      if (now + 0.001 >= skillRChargeEndsAt) {
        skillRCharging = false;
        clearSkillRChargeFx();
        fireSkillRBeam(now);
      }
    }
    const hadBeam = Boolean(activeSkillRBeam);
    updateSkillRBeamFx(now);
    if (hadBeam && !activeSkillRBeam) {
      releaseSkillRMouthOpen();
    }
  };

  const findNearestSlimeTarget = (
    sourcePosition: THREE.Vector3,
    sourceParent: THREE.Object3D
  ) => {
    const targets = getAttackTargets?.() ?? [];
    if (!targets.length) return null;
    sourceParent.updateMatrixWorld(true);
    let nearestTarget: RuntimeAttackTarget | null = null;
    let nearestDistanceSq = Infinity;
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target?.object) continue;
      if (target.isActive && !target.isActive()) continue;
      resolveTargetCenterHeightWorldPosition(target.object, targetWorldPos);
      sourceParent.worldToLocal(targetWorldPos);
      const dx = targetWorldPos.x - sourcePosition.x;
      const dz = targetWorldPos.z - sourcePosition.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq > slimeCloneAcquireRangeSq || distanceSq >= nearestDistanceSq) continue;
      nearestTarget = target;
      nearestDistanceSq = distanceSq;
    }
    return nearestTarget;
  };

  const attachSlimeCloneToTarget = (
    clone: SlimeCloneState,
    target: RuntimeAttackTarget,
    now: number
  ) => {
    unregisterSlimluThreatEntry(clone.id);
    setSlimeCloneWalking(clone, false);
    setSlimeCloneAttachedVisual(clone, true);
    clone.attachedTarget = target;
    clone.attachedTargetId = target.id;
    clone.attachedUntil = now + slimeCloneAttachDurationMs;
    clone.recalling = false;
    clone.recallStartedAt = 0;
    clone.recallDurationMs = 0;
    clone.recallArcHeight = 0;
    const attachAngle = Math.random() * Math.PI * 2;
    const attachRadius =
      slimeCloneAttachOrbitRadius * THREE.MathUtils.lerp(0.78, 1.22, Math.random());
    clone.attachedOffset.set(
      Math.cos(attachAngle) * attachRadius,
      slimeCloneAttachHeightOffset + (Math.random() - 0.5) * 0.14,
      Math.sin(attachAngle) * attachRadius
    );
    clone.root.getWorldPosition(slimeCloneSourceWorldPos);
    spawnSlimeAttachPulse(slimeCloneSourceWorldPos);
    if (!eDetonationWindowActive) {
      eDetonationWindowActive = true;
      clearRuntimeSkillECooldown();
    }
  };

  const explodeAttachedSlimeClones = (now: number) => {
    const cloneIds = Array.from(activeSlimeClones.keys());
    let explodedCount = 0;
    for (let i = 0; i < cloneIds.length; i += 1) {
      const clone = activeSlimeClones.get(cloneIds[i]);
      if (!clone || !clone.attachedTargetId) continue;
      const resolvedTarget = resolveAttackTargetById(clone.attachedTargetId);
      let didDealDamage = false;
      if (resolvedTarget?.object) {
        resolveTargetCenterHeightWorldPosition(resolvedTarget.object, targetWorldPos);
        clone.root.getWorldPosition(slimeCloneSourceWorldPos);
        slimeCloneMoveDirection.copy(targetWorldPos).sub(slimeCloneSourceWorldPos);
        if (slimeCloneMoveDirection.lengthSq() <= 0.000001) {
          slimeCloneMoveDirection.set(0, 1, 0);
        } else {
          slimeCloneMoveDirection.normalize();
        }
        const targetWithHealth = resolvedTarget as RuntimeAttackTarget & {
          getHealth?: () => number;
        };
        const healthBefore = targetWithHealth.getHealth?.();
        resolvedTarget.onHit({
          now,
          source: "slash",
          damage: slimeCloneExplosionBaseDamage + slimeCloneExplosionAcScale * absorptionCoefficient,
          point: targetWorldPos.clone(),
          direction: slimeCloneMoveDirection.clone(),
        });
        didDealDamage = true;
        if (typeof healthBefore === "number" && Number.isFinite(healthBefore)) {
          const healthAfter = targetWithHealth.getHealth?.();
          didDealDamage =
            typeof healthAfter !== "number" ||
            !Number.isFinite(healthAfter) ||
            healthAfter < healthBefore;
        }
      }
      if (didDealDamage) {
        applyMana?.(slimeCloneExplosionManaGainOnDamage);
        applyEnergy?.(slimeCloneExplosionEnergyGainOnDamage);
      }
      clone.root.getWorldPosition(slimeCloneSourceWorldPos);
      spawnSlimeDissolveFx(slimeCloneSourceWorldPos, 1.28);
      removeSlimeClone(clone.id, { spawnDissolve: false });
      explodedCount += 1;
    }
    return explodedCount > 0;
  };

  const summonSlimeClones = (now: number) => {
    const count = Math.max(1, 1 + Math.floor(absorptionCoefficient / 5));
    pendingSlimeCloneSpawnCount += count;
    if (nextSlimeCloneSpawnAt <= 0 || nextSlimeCloneSpawnAt > now) {
      nextSlimeCloneSpawnAt = now;
    }
    processPendingSlimeCloneSpawns(now);
    return count;
  };

  const updateSlimeCloneStates = (now: number, delta: number) => {
    if (delta > 0) {
      updateSlimeDissolveParticles(delta);
      updateSlimeAttachPulses(delta);
    }
    if (!activeSlimeClones.size || delta <= 0) {
      closeEDetonationWindowIfNoAttachments(now);
      return;
    }

    const cloneIds = Array.from(activeSlimeClones.keys());
    let attachedCloneCount = 0;
    for (let i = 0; i < cloneIds.length; i += 1) {
      const clone = activeSlimeClones.get(cloneIds[i]);
      if (!clone) continue;

      if (clone.mixer) {
        clone.mixer.update(delta);
      }

      if (clone.recalling) {
        const cloneParent = clone.root.parent ?? (avatar.parent ?? avatar);
        cloneParent.updateMatrixWorld(true);
        resolveDrainOriginWorldPosition(drainOriginWorldPos);
        skillRAttachTargetLocalPos.copy(drainOriginWorldPos);
        cloneParent.worldToLocal(skillRAttachTargetLocalPos);
        const recallProgress = clone.recallDurationMs > 0
          ? THREE.MathUtils.clamp(
              (now - clone.recallStartedAt) / clone.recallDurationMs,
              0,
              1
            )
          : 1;
        clone.root.position.lerpVectors(
          clone.recallStartLocalPos,
          skillRAttachTargetLocalPos,
          recallProgress
        );
        clone.root.position.y += Math.sin(Math.PI * recallProgress) * clone.recallArcHeight;
        slimeCloneMoveDirection
          .copy(skillRAttachTargetLocalPos)
          .sub(clone.root.position);
        slimeCloneMoveDirection.y = 0;
        if (slimeCloneMoveDirection.lengthSq() > 0.000001) {
          clone.root.rotation.y = Math.atan2(
            slimeCloneMoveDirection.x,
            slimeCloneMoveDirection.z
          );
        }
        if (recallProgress >= 1) {
          resolveDrainOriginWorldPosition(drainOriginWorldPos);
          spawnSlimeAttachPulse(drainOriginWorldPos);
          spawnSlimeDissolveFx(drainOriginWorldPos, 0.62);
          setAbsorptionCoefficient(absorptionCoefficient + skillRRecallAcGain);
          applyMana?.(skillRRecallManaGainPerClone);
          applyEnergy?.(skillRRecallEnergyGainPerClone);
          reduceRuntimeCooldowns(skillRRecallCooldownReductionPerCloneMs, now);
          removeSlimeClone(clone.id, { spawnDissolve: false });
        }
        continue;
      }

      if (clone.attachedTargetId) {
        const resolvedTarget = resolveAttackTargetById(clone.attachedTargetId);
        if (!resolvedTarget?.object || now >= clone.attachedUntil) {
          removeSlimeClone(clone.id, { spawnDissolve: true, dissolveIntensity: 0.9 });
          continue;
        }
        attachedCloneCount += 1;
        clone.attachedTarget = resolvedTarget;
        resolveTargetCenterHeightWorldPosition(resolvedTarget.object, targetWorldPos);
        const cloneParent = clone.root.parent ?? (avatar.parent ?? avatar);
        cloneParent.updateMatrixWorld(true);
        slimeCloneAttachWorldPos.copy(targetWorldPos);
        cloneParent.worldToLocal(slimeCloneAttachWorldPos);
        clone.root.position.copy(slimeCloneAttachWorldPos).add(clone.attachedOffset);
        continue;
      }

      clone.health = Math.max(
        0,
        clone.health - slimeCloneHealthDecayPerSecond * delta
      );
      if (clone.health <= 0) {
        removeSlimeClone(clone.id, { spawnDissolve: true, dissolveIntensity: 1.08 });
        continue;
      }

      let movedThisFrame = false;
      const cloneParent = clone.root.parent ?? (avatar.parent ?? avatar);
      const nearestTarget = findNearestSlimeTarget(clone.root.position, cloneParent);
      if (nearestTarget?.object) {
        resolveTargetCenterHeightWorldPosition(nearestTarget.object, targetWorldPos);
        cloneParent.updateMatrixWorld(true);
        slimeCloneAttachWorldPos.copy(targetWorldPos);
        cloneParent.worldToLocal(slimeCloneAttachWorldPos);
        slimeCloneMoveDirection.copy(slimeCloneAttachWorldPos).sub(clone.root.position);
        slimeCloneMoveDirection.y = 0;
        const distanceSq = slimeCloneMoveDirection.lengthSq();
        if (distanceSq <= slimeCloneAttachDistanceSq) {
          attachSlimeCloneToTarget(clone, nearestTarget, now);
          attachedCloneCount += 1;
          continue;
        }
        if (distanceSq > 0.000001) {
          const distance = Math.sqrt(distanceSq);
          slimeCloneMoveDirection.multiplyScalar(1 / distance);
          const moveDistance = Math.min(distance, clone.speed * delta);
          clone.root.position.addScaledVector(slimeCloneMoveDirection, moveDistance);
          clone.root.rotation.y = Math.atan2(slimeCloneMoveDirection.x, slimeCloneMoveDirection.z);
          movedThisFrame = moveDistance > 0.0001;
        }
      }
      setSlimeCloneWalking(clone, movedThisFrame);
    }

    if (attachedCloneCount <= 0) {
      closeEDetonationWindowIfNoAttachments(now);
    }
  };

  const getRuntimeProjectileBlockers = () => {
    runtimeProjectileBlockersScratch.length = 0;
    const baseBlockers = baseRuntime.getProjectileBlockers?.();
    if (baseBlockers?.length) {
      for (let i = 0; i < baseBlockers.length; i += 1) {
        runtimeProjectileBlockersScratch.push(baseBlockers[i]);
      }
    }
    if (activeSlimeClones.size > 0) {
      for (const clone of activeSlimeClones.values()) {
        if (clone.attachedTargetId || clone.recalling) continue;
        runtimeProjectileBlockersScratch.push(clone.root);
      }
    }
    return runtimeProjectileBlockersScratch;
  };

  const collectNearbyTargets = () => {
    nearbyTargetsScratch.length = 0;
    const targets = getAttackTargets?.() ?? [];
    if (!targets.length) return nearbyTargetsScratch;

    resolveDrainOriginWorldPosition(playerWorldPos);
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target?.object) continue;
      if (target.isActive && !target.isActive()) continue;
      resolveTargetCenterHeightWorldPosition(target.object, targetWorldPos);
      const dx = playerWorldPos.x - targetWorldPos.x;
      const dz = playerWorldPos.z - targetWorldPos.z;
      const horizontalDistanceSq = dx * dx + dz * dz;
      const maxDistanceSq = activeDrainLinks.has(target.id)
        ? drainRetainHorizontalRangeSq
        : drainAcquireHorizontalRangeSq;
      if (horizontalDistanceSq > maxDistanceSq) continue;
      if (playerWorldPos.distanceToSquared(targetWorldPos) > drainRangeSq * 4.5) continue;
      nearbyTargetsScratch.push(target);
    }
    return nearbyTargetsScratch;
  };

  const updateDrainLine = (state: DrainLinkState, now: number) => {
    const lineParent = avatar.parent ?? avatar;
    if (state.root.parent !== lineParent) {
      state.root.removeFromParent();
      lineParent.add(state.root);
    }

    resolveDrainOriginWorldPosition(drainOriginWorldPos);
    resolveTargetCenterHeightWorldPosition(state.target.object, targetWorldPos);
    lineStartLocal.copy(drainOriginWorldPos);
    lineEndLocal.copy(targetWorldPos);
    lineParent.worldToLocal(lineStartLocal);
    lineParent.worldToLocal(lineEndLocal);
    const revealLinear = THREE.MathUtils.clamp(
      (now - state.createdAt) / drainLinkRevealDurationMs,
      0,
      1
    );
    const revealT = THREE.MathUtils.smoothstep(revealLinear, 0, 1);
    lineVisibleEndLocal.lerpVectors(lineStartLocal, lineEndLocal, revealT);

    lineDirection.copy(lineVisibleEndLocal).sub(lineStartLocal);
    const length = lineDirection.length();
    if (length <= 0.0001) {
      for (let i = 0; i < state.controlPoints.length; i += 1) {
        state.controlPoints[i].copy(lineStartLocal);
      }
      for (let i = 0; i < state.segments.length; i += 1) {
        state.segments[i].visible = false;
      }
      return;
    }
    lineDirection.multiplyScalar(1 / length);
    lineUp.set(0, 1, 0);
    if (Math.abs(lineDirection.dot(lineUp)) > 0.95) {
      lineUp.set(1, 0, 0);
    }
    lineSideA.crossVectors(lineDirection, lineUp).normalize();
    lineSideB.crossVectors(lineDirection, lineSideA).normalize();

    const pointCount = state.controlPoints.length;
    for (let i = 0; i < pointCount; i += 1) {
      const t = pointCount > 1 ? i / (pointCount - 1) : 0;
      const point = state.controlPoints[i];
      point.lerpVectors(lineStartLocal, lineVisibleEndLocal, t);
      if (i === 0 || i === pointCount - 1) continue;
      const envelope = Math.sin(Math.PI * t);
      const baseWobble = state.wobbleScale * envelope * (0.8 + length * 0.1);
      const phase = state.wobblePhase + now * state.wobbleSpeed + t * 9.8;
      const offsetA = Math.sin(phase) * baseWobble;
      const offsetB = Math.cos(phase * 1.32 + 0.8) * baseWobble * 0.85;
      point.addScaledVector(lineSideA, offsetA);
      point.addScaledVector(lineSideB, offsetB);
    }

    for (let i = 0; i < state.segments.length; i += 1) {
      const startPoint = state.controlPoints[i];
      const endPoint = state.controlPoints[i + 1];
      const segment = state.segments[i];
      segmentDirection.copy(endPoint).sub(startPoint);
      const segmentLength = segmentDirection.length();
      if (segmentLength <= 0.0001) {
        segment.visible = false;
        continue;
      }
      segment.visible = true;
      segmentDirection.multiplyScalar(1 / segmentLength);
      segmentMidpoint.copy(startPoint).add(endPoint).multiplyScalar(0.5);
      segment.position.copy(segmentMidpoint);
      segment.quaternion.setFromUnitVectors(segmentUpAxis, segmentDirection);
      segment.scale.set(drainLinkTubeRadius, segmentLength, drainLinkTubeRadius);
    }
    const pulseOpacity = 0.82 + Math.sin(now * 0.012 + state.wobblePhase) * 0.12;
    state.material.opacity = pulseOpacity * (0.35 + revealT * 0.65);
  };

  const applyDrainDamage = (state: DrainLinkState, now: number) => {
    const target = state.target;
    if (target.isActive && !target.isActive()) return;
    resolveDrainOriginWorldPosition(drainOriginWorldPos);
    resolveTargetCenterHeightWorldPosition(target.object, targetWorldPos);
    drainDirection.copy(targetWorldPos).sub(drainOriginWorldPos);
    if (drainDirection.lengthSq() < 0.000001) {
      drainDirection.set(0, 0, 1);
    } else {
      drainDirection.normalize();
    }
    const damageBonus =
      drainDamageBonusBase +
      Math.floor(absorptionCoefficient / drainDamageBonusAcStep) *
        drainDamageBonusPerStep;
    const targetWithHealth = target as RuntimeAttackTarget & {
      getHealth?: () => number;
    };
    const healthBefore = targetWithHealth.getHealth?.();
    target.onHit({
      now,
      source: "slash",
      damage: drainBaseDamage + damageBonus,
      point: targetWorldPos.clone(),
      direction: drainDirection.clone(),
    });
    let didDealDamage = true;
    if (typeof healthBefore === "number" && Number.isFinite(healthBefore)) {
      const healthAfter = targetWithHealth.getHealth?.();
      if (
        typeof healthAfter === "number" &&
        Number.isFinite(healthAfter) &&
        healthAfter >= healthBefore
      ) {
        didDealDamage = false;
      }
    }
    if (!didDealDamage) return;
    applyMana?.(drainManaGainPerDamageHit);
    applyEnergy?.(drainEnergyGainPerDamageHit);
    setAbsorptionCoefficient(absorptionCoefficient + drainAcGainPerDamageHit);
  };

  const updateDrain = (now: number) => {
    const nearbyTargets = collectNearbyTargets();
    const hasNearbyTarget = nearbyTargets.length > 0;
    drainPromptHud.setVisible(hasNearbyTarget || activeDrainLinks.size > 0);

    if (!primaryHeld) {
      clearDrainLinks();
      drainPromptHud.setActive(false);
      return;
    }

    drainPromptHud.setActive(hasNearbyTarget);
    if (!hasNearbyTarget) {
      clearDrainLinks();
      return;
    }

    nearbyTargetIds.clear();
    for (let i = 0; i < nearbyTargets.length; i += 1) {
      const target = nearbyTargets[i];
      nearbyTargetIds.add(target.id);
      const existing = activeDrainLinks.get(target.id);
      if (existing) {
        existing.target = target;
      } else {
        activeDrainLinks.set(target.id, createDrainLink(target, now));
      }
    }

    for (const [targetId] of activeDrainLinks) {
      if (nearbyTargetIds.has(targetId)) continue;
      removeDrainLink(targetId);
    }

    for (const [targetId, state] of activeDrainLinks) {
      if (state.target.isActive && !state.target.isActive()) {
        removeDrainLink(targetId);
        continue;
      }

      updateDrainLine(state, now);
      let safety = 0;
      while (now >= state.nextDamageAt && safety < 8) {
        applyDrainDamage(state, state.nextDamageAt);
        state.nextDamageAt += drainTickMs;
        safety += 1;
      }
      if (safety >= 8 && now > state.nextDamageAt) {
        state.nextDamageAt = now + drainTickMs;
      }
    }

  };

  const clearAnimationBinding = () => {
    stopSkillQHeadFlight();
    stopActionBinding(walkBinding);
    stopActionBinding(walkLegsBinding);
    stopActionBinding(skillQBinding);
    stopActionBinding(skillEBinding);
    stopActionBinding(skillRBinding);
    activeSkillBinding = null;
    skillRAwaitMouthOpen = false;
    skillRMouthHeld = false;
    skillRCharging = false;
    skillRChargeStartedAt = 0;
    skillRChargeEndsAt = 0;
    clearSkillRChargeFx();
    clearSkillRBeamFx();

    if (mixer && boundModel) {
      mixer.stopAllAction();
      mixer.uncacheRoot(boundModel);
    }

    boundModel = null;
    boundWalkClip = null;
    rootChildBoneAnchor = null;
    rootChildBoneTailChildren.length = 0;
    bodyCenterAnchor = null;
    skillQFlyBones = [];
    mixer = null;
    walkBinding = null;
    walkLegsBinding = null;
    skillQBinding = null;
    skillEBinding = null;
    skillRBinding = null;
    lastAnimationUpdateAt = 0;
  };

  const bindModel = (model: THREE.Object3D | null) => {
    if (boundModel === model) return;
    clearAnimationBinding();
    if (!model) return;

    boundModel = model;
    rootChildBoneAnchor = findRootChildBoneAnchor(model);
    rootChildBoneTailChildren = rootChildBoneAnchor
      ? rootChildBoneAnchor.children.filter((child) => isBoneObject(child))
      : [];
    bodyCenterAnchor = findBodyCenterAnchor(model);
    skillQFlyBones = (findSkillQFlyBones(model) ?? []).map((bone) => ({
      bone,
      restLocalPos: bone.position.clone(),
      restLocalQuat: bone.quaternion.clone(),
    }));
    const clips =
      (model.userData[characterGltfAnimationClipsKey] as
        | THREE.AnimationClip[]
        | undefined) ?? [];
    boundWalkClip = resolveClip(clips, walkClipName);
    if (!clips.length) return;

    mixer = new THREE.AnimationMixer(model);
    const walkLegsClip = filterClipTracks(
      boundWalkClip,
      (track) => legTrackPattern.test(track.name)
    );
    const skillEUpperBodyClip = filterClipTracks(
      resolveClip(clips, skillEClipName),
      (track) => !legTrackPattern.test(track.name)
    );
    const skillRUpperBodyClip = filterClipTracks(
      resolveClip(clips, skillRClipName),
      (track) => !legTrackPattern.test(track.name)
    );
    walkBinding = createLoopBinding(
      mixer,
      boundWalkClip,
      walkClipName
    );
    walkLegsBinding = createLoopBinding(
      mixer,
      walkLegsClip,
      `${walkClipName}-legs`
    );
    const skillQClip = filterClipTracks(
      resolveClip(clips, skillQClipName),
      (track) => shouldKeepSkillQTrack(track.name)
    );
    skillQBinding = createOneShotBinding(
      mixer,
      skillQClip ?? resolveClip(clips, skillQClipName),
      skillQClipName
    );
    skillEBinding = createOneShotBinding(
      mixer,
      skillEUpperBodyClip,
      skillEClipName
    );
    skillRBinding = createOneShotBinding(
      mixer,
      skillRUpperBodyClip,
      skillRClipName
    );
  };

  const isSkillAnimationActive = () =>
    Boolean(
      (activeSkillBinding && activeSkillBinding.action.isRunning()) ||
        isSkillRSequenceActive()
    );

  const isSkillQMovementLocked = () =>
    skillQHeadFlightActive ||
    Boolean(
      skillQBinding &&
        activeSkillBinding === skillQBinding &&
        skillQBinding.action.isRunning()
    );

  const tryPlaySkill = (binding: ActionBinding | null) => {
    if (!binding) return false;
    if (isSkillAnimationActive()) return false;
    stopActionBinding(walkBinding);
    stopActionBinding(walkLegsBinding);
    const started = playActionBinding(binding);
    if (started) {
      activeSkillBinding = binding;
    }
    return started;
  };

  const updateAnimations = ({
    now,
    isMoving,
    isSprinting = false,
  }: {
    now: number;
    isMoving: boolean;
    isSprinting?: boolean;
  }) => {
    if (!mixer) {
      lastAnimationUpdateAt = now;
      return;
    }

    const deltaSeconds =
      lastAnimationUpdateAt > 0 ? Math.max(0, (now - lastAnimationUpdateAt) / 1000) : 0;
    lastAnimationUpdateAt = now;

    if (deltaSeconds > 0) {
      mixer.update(deltaSeconds);
    }

    const keepHeldSkillRBinding =
      activeSkillBinding === skillRBinding && skillRMouthHeld;
    if (
      activeSkillBinding &&
      !activeSkillBinding.action.isRunning() &&
      !keepHeldSkillRBinding
    ) {
      stopActionBinding(activeSkillBinding);
      activeSkillBinding = null;
    }

    const hasAnySkillActive = Boolean(activeSkillBinding) || isSkillRSequenceActive();
    const shouldWalk = isMoving && !hasAnySkillActive;
    if (walkBinding && shouldWalk) {
      walkBinding.action.enabled = true;
      walkBinding.action.paused = false;
      walkBinding.action.setEffectiveWeight(1);
      walkBinding.action.setEffectiveTimeScale(isSprinting ? 1.35 : 1);
      if (!walkBinding.action.isRunning()) {
        walkBinding.action.play();
      }
    } else {
      stopActionBinding(walkBinding);
    }

    const skillKeepsLegWalk =
      activeSkillBinding === skillEBinding ||
      activeSkillBinding === skillRBinding ||
      isSkillRSequenceActive();
    const shouldWalkLegs = isMoving && skillKeepsLegWalk;
    if (walkLegsBinding && shouldWalkLegs) {
      walkLegsBinding.action.enabled = true;
      walkLegsBinding.action.paused = false;
      walkLegsBinding.action.setEffectiveWeight(1);
      walkLegsBinding.action.setEffectiveTimeScale(isSprinting ? 1.35 : 1);
      if (!walkLegsBinding.action.isRunning()) {
        walkLegsBinding.action.play();
      }
    } else {
      stopActionBinding(walkLegsBinding);
    }
  };

  const handleSkillQ = () => {
    if (skillQHeadFlightActive) {
      return false;
    }
    const now = performance.now();
    const currentEnergy = Math.max(0, getCurrentStats?.()?.energy ?? 0);
    if (!noCooldown && currentEnergy + 0.001 < skillQRequiredFullEnergy) {
      return false;
    }
    const started = skillQBinding ? tryPlaySkill(skillQBinding) : !isSkillAnimationActive();
    if (!started) return false;
    if (skillQBinding) {
      skillQBinding.action.setEffectiveTimeScale(skillQAnimationSpeed);
    }
    if (!noCooldown && currentEnergy > 0) {
      spendEnergy?.(currentEnergy);
    }
    startSkillQHeadFlight(now);
    return true;
  };
  const handleSkillE = () => {
    const now = performance.now();
    if (eDetonationWindowActive) {
      if (!explodeAttachedSlimeClones(now)) {
        return false;
      }
      eDetonationWindowActive = false;
      startRuntimeSkillECooldown(now);
      return true;
    }

    if (isSkillAnimationActive()) return false;
    if (skillEBinding) {
      tryPlaySkill(skillEBinding);
    }
    const summoned = summonSlimeClones(now) > 0;
    if (summoned) {
      startRuntimeSkillECooldown(now);
    }
    return summoned;
  };

  const handleSkillR = () => {
    const now = performance.now();
    if (!noCooldown && runtimeSkillRCooldownUntil > now) {
      return false;
    }
    if (skillRCharging || activeSkillRBeam) {
      return false;
    }
    if (isSkillAnimationActive()) {
      return false;
    }

    const attachedCloneCount = countAttachedSlimeClones(now);
    const isRecallMode = attachedCloneCount > 0;
    const manaCost = isRecallMode ? skillRRecallManaCost : skillRBeamManaCost;
    if (!hasEnoughManualMana(manaCost)) {
      return false;
    }

    if (skillRBinding && !tryPlaySkill(skillRBinding)) {
      return false;
    }
    if (!spendManualMana(manaCost)) {
      return false;
    }

    if (isRecallMode) {
      const recalled = recallAttachedSlimeClones(now);
      if (recalled <= 0) {
        return false;
      }
      skillRAwaitMouthOpen = false;
      skillRMouthHeld = false;
      skillRCharging = false;
      clearSkillRChargeFx();
      clearSkillRBeamFx();
      startRuntimeSkillRCooldown(now, skillRRecallCooldownMs);
      return true;
    }

    startRuntimeSkillRCooldown(now, skillRBeamCooldownMs);
    skillRAwaitMouthOpen = Boolean(skillRBinding);
    if (!skillRAwaitMouthOpen) {
      holdSkillRMouthOpen();
      startSkillRBeamCharge(now);
    }
    return true;
  };

  const beforeSkillUse = (args: {
    key: "q" | "e" | "r";
    now: number;
  }) => {
    const baseModifier = baseRuntime.beforeSkillUse?.(args);
    if (args.key === "q") {
      if (skillQHeadFlightActive) {
        return {
          ...(baseModifier ?? {}),
          allow: false,
        };
      }
    }
    if (args.key === "q" && !noCooldown) {
      const currentEnergy = Math.max(0, getCurrentStats?.()?.energy ?? 0);
      if (currentEnergy + 0.001 < skillQRequiredFullEnergy) {
        return {
          ...(baseModifier ?? {}),
          allow: false,
        };
      }
    }
    if (args.key === "e" && eDetonationWindowActive) {
      return {
        ...(baseModifier ?? {}),
        ignoreCostAndCooldown: true,
      };
    }
    return baseModifier;
  };

  const getSkillCooldownRemainingMs = (key: "q" | "e" | "r") => {
    if (key === "e") {
      return Math.max(0, runtimeSkillECooldownUntil - performance.now());
    }
    if (key === "r") {
      return Math.max(0, runtimeSkillRCooldownUntil - performance.now());
    }
    return baseRuntime.getSkillCooldownRemainingMs?.(key) ?? null;
  };

  const getSkillCooldownDurationMs = (key: "q" | "e" | "r") => {
    if (key === "e") {
      return skillECooldownDurationMs;
    }
    if (key === "r") {
      return runtimeSkillRCooldownDurationMs;
    }
    return baseRuntime.getSkillCooldownDurationMs?.(key) ?? null;
  };

  const getSkillHudIndicators = () =>
    eDetonationWindowActive ? ({ e: "detonation-ready" } as const) : null;

  const stopDrain = () => {
    primaryHeld = false;
    clearDrainLinks();
    drainPromptHud.setActive(false);
  };

  setAbsorptionCoefficient(0);
  clearSlimluThreatEntries();

  const resetState = () => {
    stopSkillQHeadFlight();
    stopActionBinding(walkBinding);
    stopActionBinding(walkLegsBinding);
    stopActionBinding(skillQBinding);
    stopActionBinding(skillEBinding);
    stopActionBinding(skillRBinding);
    activeSkillBinding = null;
    lastAnimationUpdateAt = 0;
    runtimeSkillECooldownUntil = 0;
    runtimeSkillRCooldownUntil = 0;
    runtimeSkillRCooldownDurationMs = 0;
    eDetonationWindowActive = false;
    skillRAwaitMouthOpen = false;
    skillRMouthHeld = false;
    skillRCharging = false;
    skillRChargeStartedAt = 0;
    skillRChargeEndsAt = 0;
    clearSkillRChargeFx();
    clearSkillRBeamFx();
    pendingSlimeCloneSpawnCount = 0;
    nextSlimeCloneSpawnAt = 0;
    stopDrain();
    clearSlimeClones(false);
    clearSlimluThreatEntries();
    clearSkillCooldown?.("e");
    clearSkillCooldown?.("r");
    clearSlimeCloneEffects();
    drainPromptHud.setVisible(false);
    setAbsorptionCoefficient(0);
    baseRuntime.resetState?.();
  };

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handlePrimaryDown: () => {
      primaryHeld = true;
    },
    handlePrimaryUp: stopDrain,
    handlePrimaryCancel: stopDrain,
    handleSkillQ,
    handleSkillE,
    handleSkillR,
    getCameraFollowTarget: () =>
      skillQHeadFlightActive ? skillQCameraFollowAnchor : null,
    getProjectileBlockers: getRuntimeProjectileBlockers,
    getMovementSpeedMultiplier: baseRuntime.getMovementSpeedMultiplier,
    getCameraScaleMultiplier: baseRuntime.getCameraScaleMultiplier,
    isBasicAttackLocked: baseRuntime.isBasicAttackLocked,
    isMovementLocked: () =>
      Boolean(baseRuntime.isMovementLocked?.()) || isSkillQMovementLocked(),
    getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs,
    getSkillHudIndicators,
    beforeSkillUse,
    beforeDamage: baseRuntime.beforeDamage,
    beforeStatusApply: baseRuntime.beforeStatusApply,
    isImmuneToStatus: baseRuntime.isImmuneToStatus,
    onTick: (args) => {
      baseRuntime.onTick?.(args);
      processPendingSlimeCloneSpawns(args.now);
      updateSlimeCloneStates(args.now, args.delta);
      updateSkillRState(args.now);
    },
    resetState,
    update: (args) => {
      bindModel(args.avatarModel);
      if (args.aimDirectionWorld && args.aimDirectionWorld.lengthSq() > 0.000001) {
        runtimeAimDirection.copy(args.aimDirectionWorld).normalize();
      }
      const useBaseArmPose = !isSkillAnimationActive();
      baseRuntime.update({
        ...args,
        arms: useBaseArmPose ? args.arms : [],
      });
      updateAnimations(args);
      updateSkillQHeadFlight(args.now);
      updateDrain(args.now);
    },
    dispose: () => {
      clearAnimationBinding();
      runtimeSkillECooldownUntil = 0;
      runtimeSkillRCooldownUntil = 0;
      runtimeSkillRCooldownDurationMs = 0;
      eDetonationWindowActive = false;
      skillRAwaitMouthOpen = false;
      skillRMouthHeld = false;
      skillRCharging = false;
      skillRChargeStartedAt = 0;
      skillRChargeEndsAt = 0;
      clearSkillRChargeFx();
      clearSkillRBeamFx();
      pendingSlimeCloneSpawnCount = 0;
      nextSlimeCloneSpawnAt = 0;
      stopDrain();
      clearSlimeClones(false);
      clearSlimluThreatEntries();
      clearSlimeCloneEffects();
      disposeSlimeCloneRenderResources();
      disposeSkillRRenderResources();
      drainPromptHud.dispose();
      absorptionCoefficientHud.dispose();
      skillQCameraFollowAnchor.removeFromParent();
      baseRuntime.dispose();
    },
    isFacingLocked: baseRuntime.isFacingLocked,
  });
};
