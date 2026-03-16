import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { characterGltfAnimationClipsKey } from "../general/engine/characterLoader";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import type { CharacterRuntimeFactory } from "../general/types";
import { profile } from "./profile";

const hiddenNodePattern = /^weapon(root)?$/i;
const idleBareClipName = "idleBare";
const walkBareClipName = "walkBare";
const idleWeaponClipName = "idleWeapon";
const walkWeaponClipName = "walkWeapon";
const skillQBareClipName = "skillQBare";
const skillEBareClipName = "skillEBare";
const skillRBareClipName = "skillRBare";
const skillQWeaponClipName = "skillQWeapon";
const skillEWeaponClipName = "skillEWeapon";
const skillRWeaponClipName = "skillRWeapon";
const normalAttackBareClipName = "normalAttackBare";
const normalAttackWeaponClipName = "normalAttackWeapon";
const normalAttackBareChargeEndProgress = 0.56;
const normalAttackBareProjectileFireProgress = 0.6;
const normalAttackBareMinProjectileSpeed = 16;
const normalAttackBareMaxProjectileSpeed = 22;
const normalAttackBareProjectileLifetime = 1.4;
const normalAttackBareProjectileRadius = 0.34;
const normalAttackBareProjectileScale = 2.25;
const normalAttackBareProjectileForwardOffset = 0.62;
const skillQBareGateSummonProgress = 0.52;
const skillQBareGateSpawnForwardOffset = 2.2;
const skillQBareGateGroundYOffset = -0.04;
const skillQBareGateRiseDepth = 3.2;
const skillQBareGateRiseDurationMs = 900;
const skillQBareGateScale = 1;
const skillQBareGateColliderDepth = 0.78;
const skillQBareGatePurcleSpawnIntervalMs = 7000;
const skillQBarePurcleScale = 0.86;
const skillQBarePurcleMoveSpeed = 3.6;
const skillQBarePurcleForwardDistance = 3;
const skillQBarePurcleEnemySearchRadius = 100;
const skillQBarePortalParticleCount = 24;
const skillRBareLiftStartProgress = 0.08;
const skillRBareLiftPeakProgress = 0.56;
const skillRBareLiftReleaseEndProgress = 0.92;
const skillRBareLiftMaxHeight = 1.05;
const skillRBareChargeStartProgress = 0.08;
const skillRBareChargeEndProgress = 0.64;
const skillRBareBurstProgress = 0.68;
const skillRBareFxFadeOutProgress = 0.95;
const skillRBareOrbitParticleCount = 24;
const skillRBareHomingProjectileCount = 28;
const skillRBareHomingSpawnRadius = 0.88;
const skillRBareHomingSpawnHeight = 1.14;
const skillRBareFxBaseHeight = 1.22;
const skillRBareHomingMinSpeed = 11.8;
const skillRBareHomingMaxSpeed = 17.2;
const skillRBareHomingLifetime = 2.3;
const skillRBareHomingTurnRate = 5.8;
const skillRBareHomingTargetRadius = 13.5;
const skillRBareCameraShakeMagnitude = 0.15;
const skillRBareCameraShakeDurationMs = 420;
const legTrackPattern = /shoe|leg|foot|thigh|calf|toe|hips|pelvis|ankle/i;
const headBoneName = "Head";
const headEyeOffset = new THREE.Vector3(0, 0.5, 0.1);
const primaryAttackChargeFallbackWorldOffset = new THREE.Vector3(0.46, 1.18, 0.28);
const primaryAttackChargeHandForwardOffset = 0.34;
const primaryAttackChargeHandUpOffset = 0.03;
const primaryAttackHandNamePattern =
  /^(hand1|righthand|handright|hand_r|r_hand|hand\.r)$/i;

type BarePrimaryAttackState = {
  active: boolean;
  projectileFired: boolean;
  startedAt: number;
  chargeEndsAt: number;
  fireAt: number;
  endsAt: number;
};

type ActionBinding = {
  clipName: string;
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
};

type SkillRBareOrbitParticle = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  angle: number;
  spin: number;
  baseRadius: number;
  height: number;
  phase: number;
  drift: number;
};

type SkillRBareShockwave = {
  mesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
  spin: number;
  baseOpacity: number;
};

type SkillQBareGateEntry = {
  root: THREE.Object3D;
  collider: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  portalFxRoot: THREE.Group;
  portalCore: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  portalAura: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  portalRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  portalSwirlA: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  portalSwirlB: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  portalSwirlC: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  portalParticleGeometry: THREE.SphereGeometry;
  portalParticles: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[];
  portalParticleMaterial: THREE.MeshBasicMaterial;
  portalCoreMaterial: THREE.MeshBasicMaterial;
  portalAuraMaterial: THREE.MeshBasicMaterial;
  portalRingMaterial: THREE.MeshBasicMaterial;
  portalSwirlAMaterial: THREE.MeshBasicMaterial;
  portalSwirlBMaterial: THREE.MeshBasicMaterial;
  portalSwirlCMaterial: THREE.MeshBasicMaterial;
  riseActive: boolean;
  riseStartedAt: number;
  riseEndsAt: number;
  startY: number;
  targetY: number;
  phase: number;
  forwardWorld: THREE.Vector3;
  nextPurcleSpawnAt: number;
};

type SkillQBareGatePendingSummon = {
  worldPos: THREE.Vector3;
  yaw: number;
  requestedAt: number;
};

type SkillQBarePurclePendingSummon = {
  worldPos: THREE.Vector3;
  directionWorld: THREE.Vector3;
};

type SkillQBarePurcleEntry = {
  root: THREE.Object3D;
  forwardTargetWorld: THREE.Vector3;
  speed: number;
  stopped: boolean;
};

let harperGateTemplatePromise: Promise<THREE.Object3D | null> | null = null;
let harperPurcleTemplatePromise: Promise<THREE.Object3D | null> | null = null;

const loadHarperGateTemplate = () => {
  if (!harperGateTemplatePromise) {
    const loader = new GLTFLoader();
    harperGateTemplatePromise = loader
      .loadAsync("/assets/characters/harper/gateOfHell.glb")
      .then((gltf) => {
        const root = gltf.scene ?? gltf.scenes?.[0] ?? null;
        if (!root) return null;
        root.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
        return root;
      })
      .catch(() => null);
  }
  return harperGateTemplatePromise;
};

const loadHarperPurcleTemplate = () => {
  if (!harperPurcleTemplatePromise) {
    const loader = new GLTFLoader();
    harperPurcleTemplatePromise = loader
      .loadAsync("/assets/characters/harper/purcle.glb")
      .then((gltf) => {
        const root = gltf.scene ?? gltf.scenes?.[0] ?? null;
        if (!root) return null;
        root.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
        return root;
      })
      .catch(() => null);
  }
  return harperPurcleTemplatePromise;
};

const setHarperWeaponNodesVisible = (
  avatarModel: THREE.Object3D | null,
  visible: boolean
) => {
  if (!avatarModel) return;
  avatarModel.traverse((node) => {
    if (!hiddenNodePattern.test(node.name || "")) return;
    node.visible = visible;
  });
};

const findPrimaryAttackHand = (avatarModel: THREE.Object3D | null) => {
  if (!avatarModel) return null;
  const namedHand = avatarModel.getObjectByName("Hand1");
  if (namedHand) return namedHand;

  let fallback: THREE.Object3D | null = null;
  avatarModel.traverse((node) => {
    const name = (node.name || "").trim();
    if (!name) return;
    if (primaryAttackHandNamePattern.test(name)) {
      fallback = node;
      return;
    }
    if (
      !fallback &&
      /hand/i.test(name) &&
      (/right|r\b/i.test(name) || /hand[\W_]*1$/i.test(name))
    ) {
      fallback = node;
    }
    if (!fallback && /(lowerarm1|armbrigde1|armbridge1)/i.test(name)) {
      fallback = node;
    }
  });
  return fallback;
};

const stopAction = (action: THREE.AnimationAction | null) => {
  if (!action) return;
  action.stop();
  action.enabled = true;
  action.paused = true;
  action.setEffectiveWeight(0);
};

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
  action.paused = false;
  action.setEffectiveWeight(0);
  action.play();
  return { clipName, clip, action };
};

const stopActionBinding = (binding: ActionBinding | null) => {
  if (!binding) return;
  stopAction(binding.action);
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

const applyLoopWeight = (
  binding: ActionBinding | null,
  targetWeight: number,
  timeScale: number,
  blend: number
) => {
  if (!binding) return;
  const action = binding.action;
  const clampedTarget = THREE.MathUtils.clamp(targetWeight, 0, 1);
  action.enabled = true;
  action.paused = false;
  action.setEffectiveTimeScale(timeScale);
  action.setEffectiveWeight(
    THREE.MathUtils.lerp(action.getEffectiveWeight(), clampedTarget, blend)
  );
  if (!action.isRunning()) {
    action.play();
  }
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  fireProjectile,
  getAttackTargets,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  let lastAvatarModel: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let idleBareBinding: ActionBinding | null = null;
  let walkBareBinding: ActionBinding | null = null;
  let idleWeaponBinding: ActionBinding | null = null;
  let walkWeaponBinding: ActionBinding | null = null;
  let walkBareLegsBinding: ActionBinding | null = null;
  let walkWeaponLegsBinding: ActionBinding | null = null;
  let skillQBareBinding: ActionBinding | null = null;
  let skillEBareBinding: ActionBinding | null = null;
  let skillRBareBinding: ActionBinding | null = null;
  let skillQWeaponBinding: ActionBinding | null = null;
  let skillEWeaponBinding: ActionBinding | null = null;
  let skillRWeaponBinding: ActionBinding | null = null;
  let normalAttackBareBinding: ActionBinding | null = null;
  let normalAttackWeaponBinding: ActionBinding | null = null;
  let activeSkillBinding: ActionBinding | null = null;
  const barePrimaryAttackState: BarePrimaryAttackState = {
    active: false,
    projectileFired: false,
    startedAt: 0,
    chargeEndsAt: 0,
    fireAt: 0,
    endsAt: 0,
  };
  let primaryAttackHandBone: THREE.Object3D | null = null;
  const primaryAttackChargeOrb = new THREE.Group();
  const primaryAttackChargeCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x7e22ce,
      emissiveIntensity: 1.9,
      roughness: 0.3,
      metalness: 0.06,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    })
  );
  const primaryAttackChargeShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 14, 14),
    new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  const primaryAttackChargeLight = new THREE.PointLight(0xd8b4fe, 0, 3.2, 2);
  const primaryAttackChargeWorldPos = new THREE.Vector3();
  const primaryAttackChargeLocalPos = new THREE.Vector3();
  const primaryAttackHandForward = new THREE.Vector3();
  const primaryAttackHandUp = new THREE.Vector3();
  const primaryAttackHandQuat = new THREE.Quaternion();
  const primaryAttackProjectileDirection = new THREE.Vector3(0, 0, 1);
  const runtimeAimDirection = new THREE.Vector3(0, 0, 1);
  let primaryAttackChargePulse = 0;
  let primaryAttackHeld = false;
  let wasPrimaryAttackAnimationActive = false;
  let weaponEquipped = false;
  let lastAnimationUpdateAt = 0;
  let eyeAnchor: THREE.Object3D | null = null;
  const eyeAnchorRestLocalPos = headEyeOffset.clone();
  const eyeAnchorShakeLocalOffset = new THREE.Vector3();
  let cameraShakeStartedAt = 0;
  let cameraShakeEndsAt = 0;
  let cameraShakeMagnitude = 0;
  let skillRBareActive = false;
  let skillRBareBurstTriggered = false;
  let skillRBareBaseAvatarY = 0;
  let skillRBareCurrentLift = 0;
  const skillRBareCenterWorld = new THREE.Vector3();
  const skillRBareBurstDirection = new THREE.Vector3();
  const skillRBareCurrentDirection = new THREE.Vector3();
  const skillRBareDesiredDirection = new THREE.Vector3();
  const skillRBareFxRoot = new THREE.Group();
  const skillRBareCoreGeometry = new THREE.SphereGeometry(0.25, 20, 20);
  const skillRBareCoreMaterial = new THREE.MeshStandardMaterial({
    color: 0xddd6fe,
    emissive: 0x7e22ce,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.14,
    transparent: true,
    opacity: 0.98,
    depthWrite: false,
  });
  const skillRBareCore = new THREE.Mesh(skillRBareCoreGeometry, skillRBareCoreMaterial);
  const skillRBareShellGeometry = new THREE.SphereGeometry(0.44, 16, 16);
  const skillRBareShellMaterial = new THREE.MeshBasicMaterial({
    color: 0x6d28d9,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const skillRBareShell = new THREE.Mesh(skillRBareShellGeometry, skillRBareShellMaterial);
  const skillRBareWaistRingGeometry = new THREE.TorusGeometry(0.78, 0.055, 12, 44);
  const skillRBareWaistRingMaterial = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.66,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const skillRBareWaistRing = new THREE.Mesh(
    skillRBareWaistRingGeometry,
    skillRBareWaistRingMaterial
  );
  const skillRBareGroundDiskGeometry = new THREE.CircleGeometry(1, 48);
  const skillRBareGroundDiskMaterial = new THREE.MeshBasicMaterial({
    color: 0x2e1065,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const skillRBareGroundDisk = new THREE.Mesh(
    skillRBareGroundDiskGeometry,
    skillRBareGroundDiskMaterial
  );
  const skillRBareGroundRingGeometry = new THREE.TorusGeometry(1, 0.08, 12, 56);
  const skillRBareGroundRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x581c87,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const skillRBareGroundRing = new THREE.Mesh(
    skillRBareGroundRingGeometry,
    skillRBareGroundRingMaterial
  );
  const skillRBareOrbitParticleGeometry = new THREE.SphereGeometry(0.07, 9, 9);
  const skillRBareOrbitParticleMaterial = new THREE.MeshBasicMaterial({
    color: 0xc4b5fd,
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const skillRBareShockwaveGeometry = new THREE.TorusGeometry(1, 0.11, 12, 56);
  const skillRBareOrbitParticles: SkillRBareOrbitParticle[] = [];
  const skillRBareShockwaves: SkillRBareShockwave[] = [];
  let skillQBareGateTemplate: THREE.Object3D | null = null;
  let skillQBareGateTemplateLoading = false;
  let skillQBarePurcleTemplate: THREE.Object3D | null = null;
  let skillQBarePurcleTemplateLoading = false;
  let skillQBareGateSummonedInCast = false;
  const skillQBareGateActiveEntries: SkillQBareGateEntry[] = [];
  const skillQBareGatePendingSummons: SkillQBareGatePendingSummon[] = [];
  const skillQBarePurclePendingSummons: SkillQBarePurclePendingSummon[] = [];
  const skillQBarePurcleEntries: SkillQBarePurcleEntry[] = [];
  const runtimeProjectileBlockersScratch: THREE.Object3D[] = [];
  const skillQBareGateSpawnWorldPos = new THREE.Vector3();
  const skillQBareGateSpawnLocalPos = new THREE.Vector3();
  const skillQBareGateSpawnDirection = new THREE.Vector3();
  const skillQBareGateBounds = new THREE.Box3();
  const skillQBareGateBoundsSize = new THREE.Vector3();
  const skillQBareGateBoundsCenter = new THREE.Vector3();
  const skillQBareGateCenterLocal = new THREE.Vector3();
  const skillQBarePurcleSpawnLocalPos = new THREE.Vector3();
  const skillQBarePurcleWorldPos = new THREE.Vector3();
  const skillQBarePurcleTargetWorldPos = new THREE.Vector3();
  const skillQBarePurcleMoveDirection = new THREE.Vector3();
  const skillQBarePurcleNextWorldPos = new THREE.Vector3();

  primaryAttackChargeCore.renderOrder = 6;
  primaryAttackChargeShell.renderOrder = 5;
  primaryAttackChargeShell.scale.setScalar(1.12);
  primaryAttackChargeOrb.visible = false;
  primaryAttackChargeOrb.name = "__harperPrimaryChargeOrb";
  primaryAttackChargeOrb.add(
    primaryAttackChargeCore,
    primaryAttackChargeShell,
    primaryAttackChargeLight
  );
  avatar.add(primaryAttackChargeOrb);

  skillRBareFxRoot.name = "__harperSkillRBareFx";
  skillRBareFxRoot.position.set(0, skillRBareFxBaseHeight, 0);
  skillRBareFxRoot.visible = false;
  skillRBareCore.renderOrder = 7;
  skillRBareShell.renderOrder = 6;
  skillRBareWaistRing.renderOrder = 8;
  skillRBareGroundDisk.renderOrder = 5;
  skillRBareGroundRing.renderOrder = 6;
  skillRBareShell.scale.setScalar(1.45);
  skillRBareWaistRing.rotation.x = Math.PI * 0.5;
  skillRBareGroundDisk.rotation.x = -Math.PI * 0.5;
  skillRBareGroundDisk.position.y = -0.96;
  skillRBareGroundRing.rotation.x = Math.PI * 0.5;
  skillRBareGroundRing.position.y = -0.94;
  skillRBareFxRoot.add(
    skillRBareCore,
    skillRBareShell,
    skillRBareWaistRing,
    skillRBareGroundDisk,
    skillRBareGroundRing
  );
  for (let i = 0; i < skillRBareOrbitParticleCount; i += 1) {
    const particleMesh = new THREE.Mesh(
      skillRBareOrbitParticleGeometry,
      skillRBareOrbitParticleMaterial
    );
    particleMesh.renderOrder = 9;
    particleMesh.scale.setScalar(THREE.MathUtils.lerp(0.55, 1.05, Math.random()));
    skillRBareFxRoot.add(particleMesh);
    skillRBareOrbitParticles.push({
      mesh: particleMesh,
      angle: Math.random() * Math.PI * 2,
      spin: THREE.MathUtils.lerp(1.5, 4.2, Math.random()),
      baseRadius: THREE.MathUtils.lerp(0.65, 1.35, Math.random()),
      height: THREE.MathUtils.lerp(-0.64, 0.9, Math.random()),
      phase: Math.random() * Math.PI * 2,
      drift: THREE.MathUtils.lerp(0.05, 0.18, Math.random()),
    });
  }
  avatar.add(skillRBareFxRoot);

  const isSkillAnimationActive = () =>
    Boolean(activeSkillBinding && activeSkillBinding.action.isRunning());

  const setPrimaryAttackChargeVisible = (visible: boolean) => {
    primaryAttackChargeOrb.visible = visible;
    if (!visible) {
      primaryAttackChargeLight.intensity = 0;
    }
  };

  const setSkillRBareFxVisible = (visible: boolean) => {
    skillRBareFxRoot.visible = visible;
  };

  const clearSkillRBareShockwaves = () => {
    for (let i = 0; i < skillRBareShockwaves.length; i += 1) {
      const wave = skillRBareShockwaves[i];
      wave.mesh.removeFromParent();
      wave.material.dispose();
    }
    skillRBareShockwaves.length = 0;
  };

  const triggerCameraShake = (now: number, magnitude: number, durationMs: number) => {
    const resolvedMagnitude = Math.max(0, magnitude);
    if (resolvedMagnitude <= 0) return;
    const resolvedDuration = Math.max(16, durationMs);
    const nextEnd = now + resolvedDuration;
    if (nextEnd > cameraShakeEndsAt) {
      cameraShakeStartedAt = now;
      cameraShakeEndsAt = nextEnd;
    }
    cameraShakeMagnitude = Math.max(cameraShakeMagnitude, resolvedMagnitude);
  };

  const updateCameraShake = (now: number) => {
    if (!eyeAnchor) return;
    if (cameraShakeMagnitude <= 0 || now >= cameraShakeEndsAt) {
      eyeAnchor.position.copy(eyeAnchorRestLocalPos);
      cameraShakeStartedAt = 0;
      cameraShakeEndsAt = 0;
      cameraShakeMagnitude = 0;
      return;
    }
    const totalDuration = Math.max(16, cameraShakeEndsAt - cameraShakeStartedAt);
    const progress = THREE.MathUtils.clamp(
      (now - cameraShakeStartedAt) / totalDuration,
      0,
      1
    );
    const amplitude = cameraShakeMagnitude * Math.pow(1 - progress, 1.35);
    const t = now * 0.001;
    eyeAnchorShakeLocalOffset.set(
      Math.sin(t * 71.3 + 0.3) * amplitude * 0.58 +
        Math.sin(t * 119.5 + 1.1) * amplitude * 0.22,
      Math.cos(t * 83.2 + 0.8) * amplitude * 0.46 +
        Math.sin(t * 137.4 + 1.6) * amplitude * 0.18,
      Math.sin(t * 97.1 + 0.5) * amplitude * 0.36 +
        Math.cos(t * 111.7 + 1.2) * amplitude * 0.2
    );
    eyeAnchor.position.copy(eyeAnchorRestLocalPos).add(eyeAnchorShakeLocalOffset);
  };

  const resetSkillRBareState = (restoreAvatarHeight = true) => {
    if (restoreAvatarHeight && skillRBareActive) {
      avatar.position.y = Math.max(
        skillRBareBaseAvatarY,
        avatar.position.y - skillRBareCurrentLift
      );
    }
    skillRBareActive = false;
    skillRBareBurstTriggered = false;
    skillRBareBaseAvatarY = 0;
    skillRBareCurrentLift = 0;
    skillRBareCore.scale.setScalar(1);
    skillRBareShell.scale.setScalar(1.45);
    skillRBareWaistRing.scale.setScalar(1);
    skillRBareGroundDisk.scale.setScalar(1);
    skillRBareGroundRing.scale.setScalar(1);
    skillRBareShellMaterial.opacity = 0.44;
    skillRBareCoreMaterial.emissiveIntensity = 1.8;
    skillRBareWaistRingMaterial.opacity = 0.66;
    skillRBareGroundDiskMaterial.opacity = 0.52;
    skillRBareGroundRingMaterial.opacity = 0.68;
    clearSkillRBareShockwaves();
    setSkillRBareFxVisible(false);
  };

  const startSkillRBareState = () => {
    skillRBareActive = true;
    skillRBareBurstTriggered = false;
    skillRBareBaseAvatarY = avatar.position.y;
    skillRBareCurrentLift = 0;
    setSkillRBareFxVisible(true);
  };

  const spawnSkillRBareShockwave = ({
    yOffset,
    life,
    startScale,
    endScale,
    opacity,
    color,
    tiltX = 0,
    tiltZ = 0,
    spin = 0,
  }: {
    yOffset: number;
    life: number;
    startScale: number;
    endScale: number;
    opacity: number;
    color: number;
    tiltX?: number;
    tiltZ?: number;
    spin?: number;
  }) => {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(skillRBareShockwaveGeometry, material);
    mesh.position.set(0, yOffset, 0);
    mesh.rotation.x = Math.PI * 0.5 + tiltX;
    mesh.rotation.z = tiltZ;
    mesh.scale.setScalar(startScale);
    mesh.renderOrder = 10;
    skillRBareFxRoot.add(mesh);
    skillRBareShockwaves.push({
      mesh,
      material,
      age: 0,
      life: Math.max(0.05, life),
      startScale,
      endScale,
      spin,
      baseOpacity: opacity,
    });
  };

  const fireSkillRBareHomingVolley = (chargeProgress: number) => {
    if (!fireProjectile) return;
    avatar.getWorldPosition(skillRBareCenterWorld);
    skillRBareCenterWorld.y += skillRBareHomingSpawnHeight;
    const projectileCount = Math.round(
      THREE.MathUtils.lerp(
        skillRBareHomingProjectileCount - 6,
        skillRBareHomingProjectileCount,
        THREE.MathUtils.clamp(chargeProgress, 0, 1)
      )
    );
    for (let i = 0; i < projectileCount; i += 1) {
      const angleJitter = (Math.random() - 0.5) * 0.24;
      const angle = (i / projectileCount) * Math.PI * 2 + angleJitter;
      const vertical = THREE.MathUtils.lerp(-0.1, 0.35, Math.random());
      skillRBareBurstDirection.set(Math.cos(angle), vertical, Math.sin(angle));
      if (skillRBareBurstDirection.lengthSq() < 0.000001) {
        skillRBareBurstDirection.set(0, 0, 1);
      } else {
        skillRBareBurstDirection.normalize();
      }
      const initialDirection = skillRBareBurstDirection.clone();
      const origin = skillRBareCenterWorld
        .clone()
        .addScaledVector(initialDirection, skillRBareHomingSpawnRadius);
      const speed = THREE.MathUtils.lerp(
        skillRBareHomingMinSpeed,
        skillRBareHomingMaxSpeed,
        Math.random()
      );
      const pulsePhase = Math.random() * Math.PI * 2;
      const orbitSign = Math.random() > 0.5 ? 1 : -1;
      const baseScale = THREE.MathUtils.lerp(1.15, 1.48, Math.random());
      const coreGeometry = new THREE.IcosahedronGeometry(0.11, 1);
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: 0xe9d5ff,
        emissive: 0x7e22ce,
        emissiveIntensity: 2.4,
        roughness: 0.2,
        metalness: 0.14,
        flatShading: true,
        transparent: true,
        opacity: 0.96,
      });
      const shellGeometry = new THREE.OctahedronGeometry(0.18, 0);
      const shellMaterial = new THREE.MeshBasicMaterial({
        color: 0xa21caf,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
      const mesh = new THREE.Mesh(coreGeometry, coreMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      shellMesh.scale.setScalar(1.25);
      mesh.add(shellMesh);
      mesh.scale.setScalar(baseScale);
      fireProjectile({
        projectileType: "abilityOrb",
        mesh,
        origin,
        direction: initialDirection.clone(),
        speed,
        lifetime: skillRBareHomingLifetime,
        radius: 0.19,
        targetHitRadius: 0.26,
        damage: 11,
        gravity: 0,
        splitOnImpact: true,
        explosionRadius: 0,
        explosionDamage: 0,
        color: 0xe9d5ff,
        emissive: 0x7e22ce,
        emissiveIntensity: 2.8,
        explosionColor: 0xe9d5ff,
        explosionEmissive: 0x86198f,
        explosionEmissiveIntensity: 2.2,
        lifecycle: {
          applyForces: ({ velocity, position, delta, findNearestTarget }) => {
            if (velocity.lengthSq() < 0.000001) {
              velocity.copy(initialDirection).multiplyScalar(speed);
            }
            skillRBareCurrentDirection.copy(velocity).normalize();
            const nearestTarget = findNearestTarget?.({
              center: position,
              radius: skillRBareHomingTargetRadius,
            });
            if (nearestTarget) {
              skillRBareDesiredDirection.copy(nearestTarget.point).sub(position);
              if (skillRBareDesiredDirection.lengthSq() > 0.000001) {
                skillRBareDesiredDirection.normalize();
                const homingBlend =
                  1 - Math.exp(-Math.max(0.01, skillRBareHomingTurnRate) * delta);
                skillRBareCurrentDirection
                  .lerp(skillRBareDesiredDirection, THREE.MathUtils.clamp(homingBlend, 0, 1))
                  .normalize();
              }
            } else {
              skillRBareDesiredDirection
                .set(-skillRBareCurrentDirection.z, 0, skillRBareCurrentDirection.x)
                .multiplyScalar(orbitSign * delta * 0.55);
              skillRBareCurrentDirection.add(skillRBareDesiredDirection).normalize();
            }
            skillRBareCurrentDirection.y = THREE.MathUtils.clamp(
              skillRBareCurrentDirection.y,
              -0.32,
              0.58
            );
            skillRBareCurrentDirection.normalize();
            velocity.copy(skillRBareCurrentDirection).multiplyScalar(speed);
            const pulse =
              1 + Math.sin(performance.now() * 0.001 * 14.5 + pulsePhase) * 0.17;
            mesh.scale.setScalar(baseScale * pulse);
            coreMaterial.emissiveIntensity = 2 + pulse * 1.6;
            shellMaterial.opacity = THREE.MathUtils.clamp(
              0.36 + (pulse - 1) * 0.95,
              0.2,
              0.82
            );
            shellMesh.rotation.y += delta * 5.8;
            shellMesh.rotation.x += delta * 3.6;
          },
          onRemove: () => {
            coreGeometry.dispose();
            coreMaterial.dispose();
            shellGeometry.dispose();
            shellMaterial.dispose();
          },
        },
      });
    }
  };

  const triggerSkillRBareBurst = (now: number, chargeProgress: number) => {
    if (skillRBareBurstTriggered) return;
    skillRBareBurstTriggered = true;
    skillRBareCoreMaterial.emissiveIntensity = 4.2;
    skillRBareShellMaterial.opacity = 0.8;
    skillRBareWaistRingMaterial.opacity = 0.92;
    spawnSkillRBareShockwave({
      yOffset: -0.08,
      life: 0.52,
      startScale: 0.26,
      endScale: 3.8,
      opacity: 0.86,
      color: 0x581c87,
      spin: 2.6,
    });
    spawnSkillRBareShockwave({
      yOffset: 0.42,
      life: 0.46,
      startScale: 0.22,
      endScale: 3.3,
      opacity: 0.74,
      color: 0x6d28d9,
      tiltX: 0.2,
      spin: -2.2,
    });
    spawnSkillRBareShockwave({
      yOffset: 0.95,
      life: 0.38,
      startScale: 0.2,
      endScale: 2.9,
      opacity: 0.7,
      color: 0x7e22ce,
      tiltX: -0.25,
      tiltZ: 0.5,
      spin: 2.9,
    });
    triggerCameraShake(now, skillRBareCameraShakeMagnitude, skillRBareCameraShakeDurationMs);
    fireSkillRBareHomingVolley(chargeProgress);
  };

  const updateSkillRBareState = (now: number, deltaSeconds: number) => {
    const isBareSkillRRunning = Boolean(
      !weaponEquipped &&
        skillRBareBinding &&
        activeSkillBinding === skillRBareBinding &&
        skillRBareBinding.action.isRunning()
    );

    if (!isBareSkillRRunning) {
      if (skillRBareActive) {
        resetSkillRBareState(true);
      }
      return;
    }

    if (!skillRBareActive) {
      startSkillRBareState();
    }

    const duration = Math.max(0.001, skillRBareBinding?.clip.duration ?? 0.001);
    const progress = THREE.MathUtils.clamp(
      (skillRBareBinding?.action.time ?? 0) / duration,
      0,
      1
    );
    const chargeProgress = THREE.MathUtils.clamp(
      (progress - skillRBareChargeStartProgress) /
        Math.max(0.001, skillRBareChargeEndProgress - skillRBareChargeStartProgress),
      0,
      1
    );
    const riseProgress = THREE.MathUtils.smoothstep(
      progress,
      skillRBareLiftStartProgress,
      skillRBareLiftPeakProgress
    );
    const dropProgress = THREE.MathUtils.smoothstep(
      progress,
      skillRBareLiftPeakProgress,
      skillRBareLiftReleaseEndProgress
    );
    const liftFactor = THREE.MathUtils.clamp(riseProgress * (1 - dropProgress), 0, 1);
    skillRBareCurrentLift = skillRBareLiftMaxHeight * liftFactor;
    avatar.position.y = skillRBareBaseAvatarY + skillRBareCurrentLift;

    const t = now * 0.001;
    const chargePulse = 0.92 + Math.sin(t * 8.5) * 0.08;
    const shellPulse = 0.88 + Math.sin(t * 6.2 + 0.8) * 0.14;
    const decayAfterBurst = THREE.MathUtils.clamp(
      (progress - skillRBareBurstProgress) /
        Math.max(0.001, skillRBareFxFadeOutProgress - skillRBareBurstProgress),
      0,
      1
    );
    const alpha = 1 - decayAfterBurst;
    skillRBareFxRoot.position.y =
      skillRBareFxBaseHeight + Math.sin(t * 4.4) * 0.04 + 1;
    skillRBareCore.scale.setScalar(
      THREE.MathUtils.lerp(0.64, 1.56, chargeProgress) * chargePulse
    );
    skillRBareShell.scale.setScalar(
      THREE.MathUtils.lerp(1.1, 2.15, chargeProgress) * shellPulse
    );
    skillRBareWaistRing.scale.setScalar(THREE.MathUtils.lerp(0.86, 1.65, chargeProgress));
    skillRBareWaistRing.rotation.z += Math.max(0, deltaSeconds) * 2.4;
    skillRBareGroundDisk.scale.setScalar(THREE.MathUtils.lerp(1.2, 3.4, chargeProgress));
    skillRBareGroundRing.scale.setScalar(THREE.MathUtils.lerp(1.15, 3.25, chargeProgress));
    skillRBareGroundRing.rotation.z -= Math.max(0, deltaSeconds) * 1.8;

    skillRBareCoreMaterial.emissiveIntensity = THREE.MathUtils.lerp(
      1.5,
      3.6,
      chargeProgress
    );
    skillRBareShellMaterial.opacity = THREE.MathUtils.lerp(0.24, 0.7, chargeProgress) * alpha;
    skillRBareWaistRingMaterial.opacity =
      THREE.MathUtils.lerp(0.3, 0.82, chargeProgress) * alpha;
    skillRBareGroundDiskMaterial.opacity =
      THREE.MathUtils.lerp(0.22, 0.62, chargeProgress) * alpha;
    skillRBareGroundRingMaterial.opacity =
      THREE.MathUtils.lerp(0.35, 0.86, chargeProgress) * alpha;
    skillRBareOrbitParticleMaterial.opacity =
      THREE.MathUtils.lerp(0.2, 0.9, chargeProgress) * alpha;

    for (let i = 0; i < skillRBareOrbitParticles.length; i += 1) {
      const particle = skillRBareOrbitParticles[i];
      const angle =
        particle.angle +
        t * particle.spin +
        Math.sin(t * 2.8 + particle.phase) * 0.25;
      const orbitRadius = THREE.MathUtils.lerp(particle.baseRadius, 0.22, chargeProgress);
      const lift = THREE.MathUtils.lerp(particle.height, 0.25, chargeProgress);
      const drift = Math.sin(t * 5.8 + particle.phase) * particle.drift;
      particle.mesh.position.set(
        Math.cos(angle) * orbitRadius,
        lift + drift,
        Math.sin(angle) * orbitRadius
      );
      const particleScale =
        THREE.MathUtils.lerp(0.95, 0.48, chargeProgress) *
        (0.88 + Math.sin(t * 11 + particle.phase) * 0.18);
      particle.mesh.scale.setScalar(Math.max(0.24, particleScale));
    }

    for (let i = skillRBareShockwaves.length - 1; i >= 0; i -= 1) {
      const wave = skillRBareShockwaves[i];
      wave.age += Math.max(0, deltaSeconds);
      const waveProgress = THREE.MathUtils.clamp(wave.age / wave.life, 0, 1);
      const eased = 1 - Math.pow(1 - waveProgress, 2.2);
      wave.mesh.scale.setScalar(
        THREE.MathUtils.lerp(wave.startScale, wave.endScale, eased)
      );
      wave.mesh.rotation.z += wave.spin * Math.max(0, deltaSeconds);
      wave.material.opacity = wave.baseOpacity * Math.pow(1 - waveProgress, 1.5);
      if (waveProgress >= 1) {
        wave.mesh.removeFromParent();
        wave.material.dispose();
        skillRBareShockwaves.splice(i, 1);
      }
    }

    if (!skillRBareBurstTriggered && progress >= skillRBareBurstProgress) {
      triggerSkillRBareBurst(now, chargeProgress);
    }
    setSkillRBareFxVisible(alpha > 0.02 || skillRBareShockwaves.length > 0);
  };

  const resetBarePrimaryAttackState = () => {
    barePrimaryAttackState.active = false;
    barePrimaryAttackState.projectileFired = false;
    barePrimaryAttackState.startedAt = 0;
    barePrimaryAttackState.chargeEndsAt = 0;
    barePrimaryAttackState.fireAt = 0;
    barePrimaryAttackState.endsAt = 0;
    stopActionBinding(normalAttackBareBinding);
    setPrimaryAttackChargeVisible(false);
  };

  const resolveBarePrimaryAttackChargeProgress = () => {
    if (!normalAttackBareBinding || !barePrimaryAttackState.active) return 0;
    const duration = Math.max(0.001, normalAttackBareBinding.clip.duration);
    const normalized = THREE.MathUtils.clamp(
      normalAttackBareBinding.action.time / duration,
      0,
      1
    );
    return THREE.MathUtils.clamp(
      normalized / Math.max(0.001, normalAttackBareChargeEndProgress),
      0,
      1
    );
  };

  const updatePrimaryAttackChargeOrb = (deltaSeconds: number, chargeProgress: number) => {
    if (primaryAttackHandBone) {
      primaryAttackHandBone.getWorldPosition(primaryAttackChargeWorldPos);
      primaryAttackHandBone.getWorldQuaternion(primaryAttackHandQuat);
      primaryAttackHandForward
        .set(0, 0, 1)
        .applyQuaternion(primaryAttackHandQuat)
        .normalize();
      primaryAttackHandUp
        .set(0, 1, 0)
        .applyQuaternion(primaryAttackHandQuat)
        .normalize();
      primaryAttackChargeWorldPos
        .addScaledVector(
          primaryAttackHandForward,
          primaryAttackChargeHandForwardOffset
        )
        .addScaledVector(primaryAttackHandUp, primaryAttackChargeHandUpOffset);
    } else {
      avatar.getWorldPosition(primaryAttackChargeWorldPos);
      primaryAttackChargeWorldPos.add(primaryAttackChargeFallbackWorldOffset);
    }
    primaryAttackChargeLocalPos.copy(primaryAttackChargeWorldPos);
    avatar.worldToLocal(primaryAttackChargeLocalPos);
    primaryAttackChargeOrb.position.copy(primaryAttackChargeLocalPos);
    primaryAttackChargePulse += Math.max(0, deltaSeconds);
    const pulse = 0.92 + Math.sin(primaryAttackChargePulse * 12) * 0.08;
    const chargeScale = THREE.MathUtils.lerp(0.7, 1.42, chargeProgress) * pulse;
    primaryAttackChargeCore.scale.setScalar(chargeScale);
    primaryAttackChargeShell.scale.setScalar(chargeScale * 1.52);
    primaryAttackChargeCore.material.emissiveIntensity = THREE.MathUtils.lerp(
      1.2,
      2.6,
      chargeProgress
    );
    primaryAttackChargeShell.material.opacity = THREE.MathUtils.lerp(
      0.35,
      0.62,
      chargeProgress
    );
    primaryAttackChargeLight.intensity = THREE.MathUtils.lerp(
      0.9,
      3.2,
      chargeProgress
    );
    setPrimaryAttackChargeVisible(true);
  };

  const ensureSkillQBareGateTemplate = () => {
    if (skillQBareGateTemplate || skillQBareGateTemplateLoading) return;
    skillQBareGateTemplateLoading = true;
    void loadHarperGateTemplate().then((template) => {
      skillQBareGateTemplateLoading = false;
      if (!template) return;
      skillQBareGateTemplate = template;
    });
  };

  const ensureSkillQBarePurcleTemplate = () => {
    if (skillQBarePurcleTemplate || skillQBarePurcleTemplateLoading) return;
    skillQBarePurcleTemplateLoading = true;
    void loadHarperPurcleTemplate().then((template) => {
      skillQBarePurcleTemplateLoading = false;
      if (!template) return;
      skillQBarePurcleTemplate = template;
    });
  };

  const disposeSkillQBarePurcleEntry = (entry: SkillQBarePurcleEntry) => {
    entry.root.removeFromParent();
  };

  const disposeSkillQBareGateEntry = (entry: SkillQBareGateEntry) => {
    entry.portalFxRoot.removeFromParent();
    entry.root.removeFromParent();
    entry.collider.geometry.dispose();
    entry.collider.material.dispose();
    entry.portalCore.geometry.dispose();
    entry.portalAura.geometry.dispose();
    entry.portalRing.geometry.dispose();
    entry.portalSwirlA.geometry.dispose();
    entry.portalSwirlB.geometry.dispose();
    entry.portalSwirlC.geometry.dispose();
    entry.portalParticleGeometry.dispose();
    entry.portalCoreMaterial.dispose();
    entry.portalAuraMaterial.dispose();
    entry.portalRingMaterial.dispose();
    entry.portalSwirlAMaterial.dispose();
    entry.portalSwirlBMaterial.dispose();
    entry.portalSwirlCMaterial.dispose();
    entry.portalParticleMaterial.dispose();
  };

  const createSkillQBareGateEntry = (pending: SkillQBareGatePendingSummon) => {
    if (!skillQBareGateTemplate) return null;
    const parent = avatar.parent ?? avatar;
    const root = skillQBareGateTemplate.clone(true);
    root.scale.setScalar(skillQBareGateScale);
    parent.add(root);
    skillQBareGateSpawnLocalPos.copy(pending.worldPos);
    parent.worldToLocal(skillQBareGateSpawnLocalPos);
    const targetY = skillQBareGateSpawnLocalPos.y + skillQBareGateGroundYOffset;
    const startY = targetY - skillQBareGateRiseDepth;
    root.position.set(
      skillQBareGateSpawnLocalPos.x,
      startY,
      skillQBareGateSpawnLocalPos.z
    );
    root.rotation.set(0, pending.yaw, 0);
    root.updateMatrixWorld(true);

    skillQBareGateBounds.setFromObject(root);
    skillQBareGateBounds.getSize(skillQBareGateBoundsSize);
    skillQBareGateBounds.getCenter(skillQBareGateBoundsCenter);
    skillQBareGateCenterLocal.copy(skillQBareGateBoundsCenter);
    root.worldToLocal(skillQBareGateCenterLocal);

    const gateWidth = Math.max(
      1.8,
      Math.max(skillQBareGateBoundsSize.x, skillQBareGateBoundsSize.z) * 0.58
    );
    const gateHeight = Math.max(2.6, skillQBareGateBoundsSize.y * 0.84);
    const colliderMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const collider = new THREE.Mesh(
      new THREE.BoxGeometry(gateWidth, gateHeight, skillQBareGateColliderDepth),
      colliderMaterial
    );
    collider.position.copy(skillQBareGateCenterLocal);
    collider.position.z += 0.04;
    collider.visible = false;
    collider.userData.harperGateCollider = true;
    collider.userData.playerBlocker = true;
    root.add(collider);

    const portalRadius = Math.max(
      0.55,
      Math.min(gateWidth * 0.34, gateHeight * 0.22)
    );
    const portalCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0x6d28d9,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portalAuraMaterial = new THREE.MeshBasicMaterial({
      color: 0x4c1d95,
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const portalRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portalSwirlAMaterial = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portalSwirlBMaterial = new THREE.MeshBasicMaterial({
      color: 0xd8b4fe,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portalSwirlCMaterial = new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      transparent: true,
      opacity: 0.66,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portalParticleGeometry = new THREE.SphereGeometry(0.055, 8, 8);
    const portalParticleMaterial = new THREE.MeshBasicMaterial({
      color: 0xe9d5ff,
      transparent: true,
      opacity: 0.76,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portalCore = new THREE.Mesh(
      new THREE.CircleGeometry(portalRadius, 44),
      portalCoreMaterial
    );
    const portalAura = new THREE.Mesh(
      new THREE.CircleGeometry(portalRadius * 1.4, 44),
      portalAuraMaterial
    );
    const portalRing = new THREE.Mesh(
      new THREE.TorusGeometry(portalRadius * 1.04, portalRadius * 0.11, 12, 48),
      portalRingMaterial
    );
    const portalSwirlA = new THREE.Mesh(
      new THREE.TorusGeometry(portalRadius * 0.68, portalRadius * 0.06, 12, 42),
      portalSwirlAMaterial
    );
    const portalSwirlB = new THREE.Mesh(
      new THREE.TorusGeometry(portalRadius * 0.42, portalRadius * 0.05, 10, 34),
      portalSwirlBMaterial
    );
    const portalSwirlC = new THREE.Mesh(
      new THREE.TorusGeometry(portalRadius * 0.24, portalRadius * 0.042, 10, 28),
      portalSwirlCMaterial
    );
    const portalFxRoot = new THREE.Group();
    portalFxRoot.position.copy(skillQBareGateCenterLocal);
    portalFxRoot.position.z += skillQBareGateColliderDepth * 0.6;
    portalFxRoot.rotation.x = Math.PI * 0.5;
    portalCore.position.set(0, 0, 0);
    portalAura.position.set(0, 0, -0.01);
    portalRing.position.set(0, 0, 0.01);
    portalSwirlA.position.set(0, 0, 0.02);
    portalSwirlB.position.set(0, 0, 0.03);
    portalSwirlC.position.set(0, 0, 0.04);
    portalRing.rotation.x = Math.PI * 0.5;
    portalSwirlA.rotation.x = Math.PI * 0.5;
    portalSwirlB.rotation.x = Math.PI * 0.5;
    portalSwirlC.rotation.x = Math.PI * 0.5;
    portalCore.renderOrder = 7;
    portalAura.renderOrder = 6;
    portalRing.renderOrder = 8;
    portalSwirlA.renderOrder = 9;
    portalSwirlB.renderOrder = 10;
    portalSwirlC.renderOrder = 11;
    portalFxRoot.add(
      portalAura,
      portalCore,
      portalRing,
      portalSwirlA,
      portalSwirlB,
      portalSwirlC
    );
    const portalParticles: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = [];
    for (let i = 0; i < skillQBarePortalParticleCount; i += 1) {
      const particle = new THREE.Mesh(portalParticleGeometry, portalParticleMaterial);
      const radius = THREE.MathUtils.lerp(
        portalRadius * 0.24,
        portalRadius * 1.18,
        Math.random()
      );
      particle.position.set(radius, 0, 0);
      particle.userData.phase = Math.random() * Math.PI * 2;
      particle.userData.spin = THREE.MathUtils.lerp(1.2, 4.6, Math.random());
      particle.userData.radius = radius;
      particle.userData.height = THREE.MathUtils.lerp(-0.22, 0.22, Math.random());
      particle.userData.drift = THREE.MathUtils.lerp(0.02, 0.14, Math.random());
      particle.renderOrder = 12;
      portalFxRoot.add(particle);
      portalParticles.push(particle);
    }
    root.add(portalFxRoot);
    const forwardWorld = new THREE.Vector3(
      Math.sin(pending.yaw),
      0,
      Math.cos(pending.yaw)
    ).normalize();

    return {
      root,
      collider,
      portalFxRoot,
      portalCore,
      portalAura,
      portalRing,
      portalSwirlA,
      portalSwirlB,
      portalSwirlC,
      portalParticleGeometry,
      portalParticles,
      portalParticleMaterial,
      portalCoreMaterial,
      portalAuraMaterial,
      portalRingMaterial,
      portalSwirlAMaterial,
      portalSwirlBMaterial,
      portalSwirlCMaterial,
      riseActive: true,
      riseStartedAt: pending.requestedAt,
      riseEndsAt: pending.requestedAt + skillQBareGateRiseDurationMs,
      startY,
      targetY,
      phase: Math.random() * Math.PI * 2,
      forwardWorld,
      nextPurcleSpawnAt:
        pending.requestedAt + skillQBareGatePurcleSpawnIntervalMs,
    } satisfies SkillQBareGateEntry;
  };

  const createSkillQBarePurcleEntry = (pending: SkillQBarePurclePendingSummon) => {
    if (!skillQBarePurcleTemplate) return null;
    const parent = avatar.parent ?? avatar;
    const root = skillQBarePurcleTemplate.clone(true);
    root.scale.multiplyScalar(skillQBarePurcleScale);
    skillQBarePurcleSpawnLocalPos.copy(pending.worldPos);
    parent.worldToLocal(skillQBarePurcleSpawnLocalPos);
    root.position.copy(skillQBarePurcleSpawnLocalPos);
    root.rotation.y = Math.atan2(
      pending.directionWorld.x,
      pending.directionWorld.z
    );
    parent.add(root);
    return {
      root,
      forwardTargetWorld: pending.worldPos
        .clone()
        .addScaledVector(pending.directionWorld, skillQBarePurcleForwardDistance),
      speed: skillQBarePurcleMoveSpeed,
      stopped: false,
    } satisfies SkillQBarePurcleEntry;
  };

  const spawnPendingSkillQBareGates = () => {
    if (!skillQBareGateTemplate || !skillQBareGatePendingSummons.length) return;
    while (skillQBareGatePendingSummons.length > 0) {
      const pending = skillQBareGatePendingSummons.shift();
      if (!pending) break;
      const entry = createSkillQBareGateEntry(pending);
      if (!entry) continue;
      skillQBareGateActiveEntries.push(entry);
    }
  };

  const spawnPendingSkillQBarePurcles = () => {
    if (!skillQBarePurcleTemplate || !skillQBarePurclePendingSummons.length) return;
    while (skillQBarePurclePendingSummons.length > 0) {
      const pending = skillQBarePurclePendingSummons.shift();
      if (!pending) break;
      const entry = createSkillQBarePurcleEntry(pending);
      if (!entry) continue;
      skillQBarePurcleEntries.push(entry);
    }
  };

  const queueSkillQBarePurcleSpawn = (
    worldPos: THREE.Vector3,
    directionWorld: THREE.Vector3
  ) => {
    if (directionWorld.lengthSq() < 0.000001) return;
    skillQBarePurclePendingSummons.push({
      worldPos: worldPos.clone(),
      directionWorld: directionWorld.clone().normalize(),
    });
    ensureSkillQBarePurcleTemplate();
    spawnPendingSkillQBarePurcles();
  };

  const clearSkillQBareGateState = (clearEntries: boolean) => {
    skillQBareGateSummonedInCast = false;
    skillQBareGatePendingSummons.length = 0;
    skillQBarePurclePendingSummons.length = 0;
    if (!clearEntries) return;
    for (let i = skillQBareGateActiveEntries.length - 1; i >= 0; i -= 1) {
      disposeSkillQBareGateEntry(skillQBareGateActiveEntries[i]);
    }
    skillQBareGateActiveEntries.length = 0;
    for (let i = skillQBarePurcleEntries.length - 1; i >= 0; i -= 1) {
      disposeSkillQBarePurcleEntry(skillQBarePurcleEntries[i]);
    }
    skillQBarePurcleEntries.length = 0;
  };

  const requestSkillQBareGateSummon = (now: number) => {
    avatar.getWorldPosition(skillQBareGateSpawnWorldPos);
    skillQBareGateSpawnDirection.copy(runtimeAimDirection);
    skillQBareGateSpawnDirection.y = 0;
    if (skillQBareGateSpawnDirection.lengthSq() < 0.000001) {
      skillQBareGateSpawnDirection
        .set(0, 0, 1)
        .applyQuaternion(avatar.quaternion);
      skillQBareGateSpawnDirection.y = 0;
    }
    if (skillQBareGateSpawnDirection.lengthSq() < 0.000001) {
      skillQBareGateSpawnDirection.set(0, 0, 1);
    } else {
      skillQBareGateSpawnDirection.normalize();
    }
    skillQBareGateSpawnWorldPos.addScaledVector(
      skillQBareGateSpawnDirection,
      skillQBareGateSpawnForwardOffset
    );
    const gateYaw = Math.atan2(
      skillQBareGateSpawnDirection.x,
      skillQBareGateSpawnDirection.z
    );
    skillQBareGatePendingSummons.push({
      worldPos: skillQBareGateSpawnWorldPos.clone(),
      yaw: gateYaw,
      requestedAt: now,
    });
    ensureSkillQBareGateTemplate();
    spawnPendingSkillQBareGates();
  };

  const updateSkillQBareGates = (now: number, deltaSeconds: number) => {
    spawnPendingSkillQBareGates();
    spawnPendingSkillQBarePurcles();
    const safeDelta = Math.max(0, deltaSeconds);
    if (skillQBareGateActiveEntries.length > 0) {
    for (let i = skillQBareGateActiveEntries.length - 1; i >= 0; i -= 1) {
      const entry = skillQBareGateActiveEntries[i];
      if (!entry.root.parent) {
        disposeSkillQBareGateEntry(entry);
        skillQBareGateActiveEntries.splice(i, 1);
        continue;
      }
      let riseAlpha = 1;
      if (entry.riseActive) {
        const duration = Math.max(1, entry.riseEndsAt - entry.riseStartedAt);
        const progress = THREE.MathUtils.clamp(
          (now - entry.riseStartedAt) / duration,
          0,
          1
        );
        const eased = 1 - Math.pow(1 - progress, 3);
        entry.root.position.y = THREE.MathUtils.lerp(entry.startY, entry.targetY, eased);
        riseAlpha = THREE.MathUtils.lerp(0.2, 1, eased);
        if (progress >= 1) {
          entry.riseActive = false;
          entry.root.position.y = entry.targetY;
        }
      }

      const t = now * 0.001 + entry.phase;
      const pulse = 0.92 + Math.sin(t * 6.4) * 0.12;
      const swirlPulse = 1 + Math.sin(t * 9.2 + 0.8) * 0.1;
      entry.portalCore.scale.setScalar(pulse);
      entry.portalAura.scale.setScalar(1.2 + (pulse - 1) * 1.55);
      entry.portalRing.rotation.z += safeDelta * 2.4;
      entry.portalSwirlA.rotation.z += safeDelta * 3.8;
      entry.portalSwirlB.rotation.z -= safeDelta * 3.2;
      entry.portalSwirlC.rotation.z += safeDelta * 5.1;
      entry.portalSwirlA.scale.setScalar(swirlPulse);
      entry.portalSwirlB.scale.setScalar(2 - swirlPulse);
      entry.portalSwirlC.scale.setScalar(0.9 + (swirlPulse - 1) * 1.6);
      for (let j = 0; j < entry.portalParticles.length; j += 1) {
        const particle = entry.portalParticles[j];
        const particleData = particle.userData as {
          phase?: number;
          spin?: number;
          radius?: number;
          height?: number;
          drift?: number;
        };
        const radius = particleData.radius ?? 0.3;
        const phase = particleData.phase ?? 0;
        const spin = particleData.spin ?? 1;
        const height = particleData.height ?? 0;
        const drift = particleData.drift ?? 0.04;
        const angle = phase + t * spin;
        particle.position.set(
          Math.cos(angle) * radius,
          height + Math.sin(t * 4 + phase) * drift,
          Math.sin(angle) * radius * 0.78
        );
        const particlePulse = 0.78 + Math.sin(t * 10.8 + phase) * 0.26;
        particle.scale.setScalar(Math.max(0.24, particlePulse));
      }
      entry.portalCoreMaterial.opacity = THREE.MathUtils.clamp(0.82 * riseAlpha, 0.2, 0.9);
      entry.portalAuraMaterial.opacity = THREE.MathUtils.clamp(0.54 * riseAlpha, 0.14, 0.62);
      entry.portalRingMaterial.opacity = THREE.MathUtils.clamp(0.88 * riseAlpha, 0.18, 0.92);
      entry.portalSwirlAMaterial.opacity = THREE.MathUtils.clamp(
        (0.72 + Math.sin(t * 8.4) * 0.1) * riseAlpha,
        0.16,
        0.82
      );
      entry.portalSwirlBMaterial.opacity = THREE.MathUtils.clamp(
        (0.5 + Math.sin(t * 7.2 + 1.1) * 0.08) * riseAlpha,
        0.12,
        0.64
      );
      entry.portalSwirlCMaterial.opacity = THREE.MathUtils.clamp(
        (0.56 + Math.sin(t * 9.6 + 0.5) * 0.16) * riseAlpha,
        0.16,
        0.86
      );
      entry.portalParticleMaterial.opacity = THREE.MathUtils.clamp(
        (0.52 + Math.sin(t * 11.2 + 0.3) * 0.14) * riseAlpha,
        0.22,
        0.78
      );

      if (!entry.riseActive && now >= entry.nextPurcleSpawnAt) {
        entry.portalCore.getWorldPosition(skillQBarePurcleTargetWorldPos);
        while (now >= entry.nextPurcleSpawnAt) {
          queueSkillQBarePurcleSpawn(
            skillQBarePurcleTargetWorldPos,
            entry.forwardWorld
          );
          entry.nextPurcleSpawnAt += skillQBareGatePurcleSpawnIntervalMs;
        }
      }
    }
    }

    if (!skillQBarePurcleEntries.length) return;
    const targets = getAttackTargets?.() ?? [];
    const searchRadiusSq =
      skillQBarePurcleEnemySearchRadius * skillQBarePurcleEnemySearchRadius;
    for (let i = skillQBarePurcleEntries.length - 1; i >= 0; i -= 1) {
      const entry = skillQBarePurcleEntries[i];
      if (!entry.root.parent) {
        disposeSkillQBarePurcleEntry(entry);
        skillQBarePurcleEntries.splice(i, 1);
        continue;
      }
      entry.root.getWorldPosition(skillQBarePurcleWorldPos);
      let hasTarget = false;
      let bestDistanceSq = searchRadiusSq;
      for (let j = 0; j < targets.length; j += 1) {
        const target = targets[j];
        if (!target?.object) continue;
        if (target.isActive && !target.isActive()) continue;
        target.object.getWorldPosition(skillQBarePurcleNextWorldPos);
        const dx = skillQBarePurcleNextWorldPos.x - skillQBarePurcleWorldPos.x;
        const dz = skillQBarePurcleNextWorldPos.z - skillQBarePurcleWorldPos.z;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq >= bestDistanceSq) continue;
        bestDistanceSq = distanceSq;
        hasTarget = true;
        skillQBarePurcleTargetWorldPos.copy(skillQBarePurcleNextWorldPos);
      }
      if (!hasTarget) {
        skillQBarePurcleTargetWorldPos.copy(entry.forwardTargetWorld);
      }
      skillQBarePurcleTargetWorldPos.y = skillQBarePurcleWorldPos.y;
      if (!hasTarget && entry.stopped) continue;
      skillQBarePurcleMoveDirection
        .copy(skillQBarePurcleTargetWorldPos)
        .sub(skillQBarePurcleWorldPos);
      const remainingDistance = skillQBarePurcleMoveDirection.length();
      if (remainingDistance <= 0.0001) {
        if (!hasTarget) {
          entry.stopped = true;
        }
        continue;
      }
      if (!hasTarget && remainingDistance <= 0.04) {
        entry.stopped = true;
        continue;
      }
      entry.stopped = false;
      skillQBarePurcleMoveDirection.multiplyScalar(1 / remainingDistance);
      const moveDistance = Math.min(remainingDistance, entry.speed * safeDelta);
      skillQBarePurcleWorldPos.addScaledVector(
        skillQBarePurcleMoveDirection,
        moveDistance
      );
      skillQBarePurcleSpawnLocalPos.copy(skillQBarePurcleWorldPos);
      entry.root.parent.worldToLocal(skillQBarePurcleSpawnLocalPos);
      entry.root.position.copy(skillQBarePurcleSpawnLocalPos);
      entry.root.rotation.y = Math.atan2(
        skillQBarePurcleMoveDirection.x,
        skillQBarePurcleMoveDirection.z
      );
    }
  };

  const updateSkillQBareState = (now: number) => {
    const isBareSkillQRunning = Boolean(
      !weaponEquipped &&
        skillQBareBinding &&
        activeSkillBinding === skillQBareBinding &&
        skillQBareBinding.action.isRunning()
    );
    if (!isBareSkillQRunning) {
      skillQBareGateSummonedInCast = false;
      return;
    }
    if (skillQBareGateSummonedInCast) return;
    const duration = Math.max(0.001, skillQBareBinding?.clip.duration ?? 0.001);
    const progress = THREE.MathUtils.clamp(
      (skillQBareBinding?.action.time ?? 0) / duration,
      0,
      1
    );
    if (progress < skillQBareGateSummonProgress) return;
    skillQBareGateSummonedInCast = true;
    requestSkillQBareGateSummon(now);
  };

  const fireBarePrimaryProjectile = () => {
    if (!fireProjectile) return;
    if (primaryAttackHandBone) {
      primaryAttackHandBone.getWorldPosition(primaryAttackChargeWorldPos);
    } else {
      avatar.getWorldPosition(primaryAttackChargeWorldPos);
      primaryAttackChargeWorldPos.add(primaryAttackChargeFallbackWorldOffset);
    }
    primaryAttackProjectileDirection.copy(runtimeAimDirection);
    primaryAttackProjectileDirection.y *= 0.8;
    if (primaryAttackProjectileDirection.lengthSq() < 0.000001) {
      primaryAttackProjectileDirection.set(0, 0, 1).applyQuaternion(avatar.quaternion);
    }
    if (primaryAttackProjectileDirection.lengthSq() < 0.000001) {
      primaryAttackProjectileDirection.set(0, 0, 1);
    } else {
      primaryAttackProjectileDirection.normalize();
    }
    const chargeProgress = resolveBarePrimaryAttackChargeProgress();
    const speed = THREE.MathUtils.lerp(
      normalAttackBareMinProjectileSpeed,
      normalAttackBareMaxProjectileSpeed,
      chargeProgress
    );
    const origin = primaryAttackChargeWorldPos
      .clone()
      .addScaledVector(
        primaryAttackProjectileDirection,
        normalAttackBareProjectileForwardOffset
      );
    const projectileGeometry = new THREE.IcosahedronGeometry(0.16, 3);
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: 0xf3e8ff,
      emissive: 0xc026d3,
      emissiveIntensity: 3.4,
      roughness: 0.12,
      metalness: 0.14,
      transparent: true,
      opacity: 0.99,
    });
    const auraGeometry = new THREE.SphereGeometry(0.24, 20, 20);
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringGeometry = new THREE.TorusGeometry(0.23, 0.045, 12, 28);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const projectileMesh = new THREE.Mesh(projectileGeometry, projectileMaterial);
    const auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    auraMesh.scale.setScalar(1.45);
    ringMesh.rotation.x = Math.PI * 0.5;
    ringMesh.rotation.z = Math.random() * Math.PI * 2;
    projectileMesh.add(auraMesh);
    projectileMesh.add(ringMesh);
    projectileMesh.castShadow = true;
    projectileMesh.receiveShadow = true;
    const baseScale = THREE.MathUtils.lerp(
      normalAttackBareProjectileScale * 0.88,
      normalAttackBareProjectileScale * 1.08,
      chargeProgress
    );
    projectileMesh.scale.setScalar(baseScale);
    const pulsePhase = Math.random() * Math.PI * 2;
    const pulseSpeed = THREE.MathUtils.lerp(12, 16, chargeProgress);
    const pulseAmplitude = THREE.MathUtils.lerp(0.12, 0.22, chargeProgress);
    fireProjectile({
      projectileType: "abilityOrb",
      mesh: projectileMesh,
      origin,
      direction: primaryAttackProjectileDirection.clone(),
      speed,
      lifetime: normalAttackBareProjectileLifetime,
      radius: normalAttackBareProjectileRadius,
      targetHitRadius: normalAttackBareProjectileRadius * 1.18,
      color: 0xe9d5ff,
      emissive: 0xa855f7,
      emissiveIntensity: 3.8,
      splitOnImpact: true,
      explosionColor: 0xe9d5ff,
      explosionEmissive: 0xa21caf,
      explosionEmissiveIntensity: 2.8,
      gravity: 0,
      lifecycle: {
        applyForces: ({ delta }) => {
          const pulse =
            1 +
            Math.sin(performance.now() * 0.001 * pulseSpeed + pulsePhase) *
              pulseAmplitude;
          projectileMesh.scale.setScalar(baseScale * pulse);
          projectileMaterial.emissiveIntensity =
            2.9 + (pulse - (1 - pulseAmplitude)) * 2.8;
          auraMesh.scale.setScalar(1.45 + (pulse - 1) * 1.9);
          auraMaterial.opacity = THREE.MathUtils.clamp(
            0.44 + (pulse - 1) * 1.2,
            0.34,
            0.88
          );
          ringMesh.rotation.z += delta * 8.5;
          ringMesh.rotation.x += delta * 2.4;
          ringMesh.scale.setScalar(1.16 + (pulse - 1) * 1.15);
        },
        onRemove: () => {
          projectileGeometry.dispose();
          projectileMaterial.dispose();
          auraGeometry.dispose();
          auraMaterial.dispose();
          ringGeometry.dispose();
          ringMaterial.dispose();
        },
      },
    });
  };

  const tryPlaySkill = (binding: ActionBinding | null) => {
    if (!mixer || !binding) return false;
    if (isSkillAnimationActive()) return false;
    const started = playActionBinding(binding);
    if (started) {
      primaryAttackHeld = false;
      resetBarePrimaryAttackState();
      if (binding !== skillRBareBinding || weaponEquipped) {
        resetSkillRBareState(true);
      }
      activeSkillBinding = binding;
    }
    return started;
  };

  const clearAnimationBinding = () => {
    stopActionBinding(idleBareBinding);
    stopActionBinding(walkBareBinding);
    stopActionBinding(idleWeaponBinding);
    stopActionBinding(walkWeaponBinding);
    stopActionBinding(walkBareLegsBinding);
    stopActionBinding(walkWeaponLegsBinding);
    stopActionBinding(skillQBareBinding);
    stopActionBinding(skillEBareBinding);
    stopActionBinding(skillRBareBinding);
    stopActionBinding(skillQWeaponBinding);
    stopActionBinding(skillEWeaponBinding);
    stopActionBinding(skillRWeaponBinding);
    stopActionBinding(normalAttackBareBinding);
    stopActionBinding(normalAttackWeaponBinding);
    activeSkillBinding = null;
    if (mixer && lastAvatarModel) {
      mixer.stopAllAction();
      mixer.uncacheRoot(lastAvatarModel);
    }
    mixer = null;
    idleBareBinding = null;
    walkBareBinding = null;
    idleWeaponBinding = null;
    walkWeaponBinding = null;
    walkBareLegsBinding = null;
    walkWeaponLegsBinding = null;
    skillQBareBinding = null;
    skillEBareBinding = null;
    skillRBareBinding = null;
    skillQWeaponBinding = null;
    skillEWeaponBinding = null;
    skillRWeaponBinding = null;
    normalAttackBareBinding = null;
    normalAttackWeaponBinding = null;
    primaryAttackHandBone = null;
    setPrimaryAttackChargeVisible(false);
    clearSkillQBareGateState(true);
    resetSkillRBareState(true);
    cameraShakeStartedAt = 0;
    cameraShakeEndsAt = 0;
    cameraShakeMagnitude = 0;
    if (eyeAnchor) {
      eyeAnchor.position.copy(eyeAnchorRestLocalPos);
    }
    barePrimaryAttackState.active = false;
    barePrimaryAttackState.projectileFired = false;
    barePrimaryAttackState.startedAt = 0;
    barePrimaryAttackState.chargeEndsAt = 0;
    barePrimaryAttackState.fireAt = 0;
    barePrimaryAttackState.endsAt = 0;
    primaryAttackChargePulse = 0;
    primaryAttackHeld = false;
    wasPrimaryAttackAnimationActive = false;
    lastAnimationUpdateAt = 0;
  };

  const clearEyeAnchor = () => {
    if (!eyeAnchor) return;
    eyeAnchor.parent?.remove(eyeAnchor);
    eyeAnchor = null;
  };

  const bindEyeAnchor = (avatarModel: THREE.Object3D) => {
    clearEyeAnchor();
    const headBone = avatarModel.getObjectByName(headBoneName);
    if (!headBone) return;
    eyeAnchor = new THREE.Object3D();
    eyeAnchor.name = "__harperEyeAnchor";
    eyeAnchor.position.copy(eyeAnchorRestLocalPos);
    headBone.add(eyeAnchor);
  };

  const bindAnimations = (avatarModel: THREE.Object3D) => {
    clearAnimationBinding();
    const clips =
      (avatarModel.userData[characterGltfAnimationClipsKey] as
        | THREE.AnimationClip[]
        | undefined) ?? [];
    if (!clips.length) return;

    mixer = new THREE.AnimationMixer(avatarModel);
    const walkBareClip = resolveClip(clips, walkBareClipName);
    const walkWeaponClip = resolveClip(clips, walkWeaponClipName);
    const walkBareLegsClip = filterClipTracks(
      walkBareClip,
      (track) => legTrackPattern.test(track.name)
    );
    const walkWeaponLegsClip = filterClipTracks(
      walkWeaponClip,
      (track) => legTrackPattern.test(track.name)
    );

    idleBareBinding = createLoopBinding(
      mixer,
      resolveClip(clips, idleBareClipName),
      idleBareClipName
    );
    walkBareBinding = createLoopBinding(mixer, walkBareClip, walkBareClipName);
    idleWeaponBinding = createLoopBinding(
      mixer,
      resolveClip(clips, idleWeaponClipName),
      idleWeaponClipName
    );
    walkWeaponBinding = createLoopBinding(
      mixer,
      walkWeaponClip,
      walkWeaponClipName
    );
    walkBareLegsBinding = createLoopBinding(
      mixer,
      walkBareLegsClip,
      `${walkBareClipName}-legs`
    );
    walkWeaponLegsBinding = createLoopBinding(
      mixer,
      walkWeaponLegsClip,
      `${walkWeaponClipName}-legs`
    );

    skillQBareBinding = createOneShotBinding(
      mixer,
      resolveClip(clips, skillQBareClipName),
      skillQBareClipName
    );
    skillEBareBinding = createOneShotBinding(
      mixer,
      resolveClip(clips, skillEBareClipName),
      skillEBareClipName
    );
    skillRBareBinding = createOneShotBinding(
      mixer,
      resolveClip(clips, skillRBareClipName),
      skillRBareClipName
    );
    skillQWeaponBinding = createOneShotBinding(
      mixer,
      resolveClip(clips, skillQWeaponClipName),
      skillQWeaponClipName
    );
    skillEWeaponBinding = createOneShotBinding(
      mixer,
      resolveClip(clips, skillEWeaponClipName),
      skillEWeaponClipName
    );
    skillRWeaponBinding = createOneShotBinding(
      mixer,
      resolveClip(clips, skillRWeaponClipName),
      skillRWeaponClipName
    );
    normalAttackBareBinding = createOneShotBinding(
      mixer,
      resolveClip(clips, normalAttackBareClipName),
      normalAttackBareClipName
    );
    normalAttackWeaponBinding = createLoopBinding(
      mixer,
      resolveClip(clips, normalAttackWeaponClipName),
      normalAttackWeaponClipName
    );

    if (weaponEquipped) {
      idleWeaponBinding?.action.setEffectiveWeight(1);
    } else {
      idleBareBinding?.action.setEffectiveWeight(1);
    }
  };

  const updateAnimations = (now: number, isMoving: boolean, isSprinting?: boolean) => {
    if (!mixer) {
      if (skillRBareActive) {
        resetSkillRBareState(true);
      }
      updateSkillQBareGates(now, 0);
      updateCameraShake(now);
      lastAnimationUpdateAt = now;
      return;
    }

    const deltaSeconds =
      lastAnimationUpdateAt > 0 ? Math.max(0, (now - lastAnimationUpdateAt) / 1000) : 0;
    lastAnimationUpdateAt = now;

    if (activeSkillBinding && !activeSkillBinding.action.isRunning()) {
      stopActionBinding(activeSkillBinding);
      activeSkillBinding = null;
    }

    updateSkillQBareState(now);
    updateSkillRBareState(now, deltaSeconds);

    const hasSkillAnimationActive = isSkillAnimationActive();
    const barePrimaryAttackAction = normalAttackBareBinding?.action ?? null;
    if (
      barePrimaryAttackState.active &&
      (!barePrimaryAttackAction || now >= barePrimaryAttackState.endsAt + 80)
    ) {
      resetBarePrimaryAttackState();
    }

    if (barePrimaryAttackState.active) {
      const inChargeWindow = now < barePrimaryAttackState.chargeEndsAt;
      if (
        !primaryAttackHeld &&
        !barePrimaryAttackState.projectileFired &&
        inChargeWindow
      ) {
        resetBarePrimaryAttackState();
      } else {
        const shouldCharge =
          primaryAttackHeld &&
          !barePrimaryAttackState.projectileFired &&
          inChargeWindow;
        if (shouldCharge) {
          const chargeDuration = Math.max(
            1,
            barePrimaryAttackState.chargeEndsAt - barePrimaryAttackState.startedAt
          );
          const chargeProgress = THREE.MathUtils.clamp(
            (now - barePrimaryAttackState.startedAt) / chargeDuration,
            0,
            1
          );
          updatePrimaryAttackChargeOrb(deltaSeconds, chargeProgress);
        } else {
          setPrimaryAttackChargeVisible(false);
        }
        if (
          !barePrimaryAttackState.projectileFired &&
          now >= barePrimaryAttackState.fireAt
        ) {
          barePrimaryAttackState.projectileFired = true;
          setPrimaryAttackChargeVisible(false);
          fireBarePrimaryProjectile();
        }
      }
    } else {
      setPrimaryAttackChargeVisible(false);
    }

    const weaponPrimaryAttackAnimationActive =
      weaponEquipped &&
      primaryAttackHeld &&
      !hasSkillAnimationActive &&
      Boolean(normalAttackWeaponBinding);
    const barePrimaryAttackAnimationActive =
      !weaponEquipped && barePrimaryAttackState.active;
    const primaryAttackAnimationActive =
      weaponPrimaryAttackAnimationActive || barePrimaryAttackAnimationActive;
    const forceImmediateBlend =
      primaryAttackAnimationActive || wasPrimaryAttackAnimationActive;
    const skillEWalkLegsActive =
      hasSkillAnimationActive &&
      isMoving &&
      Boolean(skillEBareBinding && activeSkillBinding === skillEBareBinding);
    const primaryAttackWalkLegsActive =
      isMoving && primaryAttackAnimationActive;
    const resolvedIdleBinding =
      (weaponEquipped ? idleWeaponBinding : idleBareBinding) ??
      idleBareBinding ??
      idleWeaponBinding;
    const resolvedWalkBinding =
      (weaponEquipped ? walkWeaponBinding : walkBareBinding) ??
      walkBareBinding ??
      walkWeaponBinding;
    const resolvedWalkLegsBinding =
      (weaponEquipped ? walkWeaponLegsBinding : walkBareLegsBinding) ??
      walkBareLegsBinding ??
      walkWeaponLegsBinding;

    const walkTimeScale = isSprinting ? 1.4 : 1;
    const targetWalkWeight =
      hasSkillAnimationActive || primaryAttackAnimationActive ? 0 : isMoving ? 1 : 0;
    const targetIdleWeight =
      hasSkillAnimationActive || primaryAttackAnimationActive ? 0 : isMoving ? 0 : 1;
    const targetWalkLegsWeight =
      skillEWalkLegsActive || primaryAttackWalkLegsActive ? 1 : 0;
    const targetWeaponPrimaryAttackWeight = weaponPrimaryAttackAnimationActive ? 1 : 0;
    const targetBarePrimaryAttackWeight = barePrimaryAttackAnimationActive ? 1 : 0;
    const blend = forceImmediateBlend ? 1 : isMoving ? 0.22 : 0.18;

    applyLoopWeight(
      idleBareBinding,
      resolvedIdleBinding === idleBareBinding ? targetIdleWeight : 0,
      1,
      blend
    );
    applyLoopWeight(
      idleWeaponBinding,
      resolvedIdleBinding === idleWeaponBinding ? targetIdleWeight : 0,
      1,
      blend
    );
    applyLoopWeight(
      walkBareBinding,
      resolvedWalkBinding === walkBareBinding ? targetWalkWeight : 0,
      walkTimeScale,
      blend
    );
    applyLoopWeight(
      walkWeaponBinding,
      resolvedWalkBinding === walkWeaponBinding ? targetWalkWeight : 0,
      walkTimeScale,
      blend
    );
    applyLoopWeight(
      walkBareLegsBinding,
      resolvedWalkLegsBinding === walkBareLegsBinding ? targetWalkLegsWeight : 0,
      walkTimeScale,
      blend
    );
    applyLoopWeight(
      walkWeaponLegsBinding,
      resolvedWalkLegsBinding === walkWeaponLegsBinding ? targetWalkLegsWeight : 0,
      walkTimeScale,
      blend
    );
    applyLoopWeight(
      normalAttackWeaponBinding,
      targetWeaponPrimaryAttackWeight,
      1,
      blend
    );
    if (normalAttackBareBinding) {
      normalAttackBareBinding.action.setEffectiveWeight(
        THREE.MathUtils.lerp(
          normalAttackBareBinding.action.getEffectiveWeight(),
          targetBarePrimaryAttackWeight,
          blend
        )
      );
      normalAttackBareBinding.action.setEffectiveTimeScale(1);
      normalAttackBareBinding.action.enabled = true;
    }
    wasPrimaryAttackAnimationActive = primaryAttackAnimationActive;

    if (deltaSeconds > 0) {
      mixer.update(deltaSeconds);
    }
    updateSkillQBareGates(now, deltaSeconds);
    updateCameraShake(now);
  };

  const bindModel = (avatarModel: THREE.Object3D | null) => {
    if (avatarModel === lastAvatarModel) return;
    clearAnimationBinding();
    clearEyeAnchor();
    lastAvatarModel = avatarModel;
    if (!avatarModel) return;
    setHarperWeaponNodesVisible(avatarModel, weaponEquipped);
    bindEyeAnchor(avatarModel);
    bindAnimations(avatarModel);
    primaryAttackHandBone = findPrimaryAttackHand(avatarModel);
  };

  const setWeaponEquipped = (equipped: boolean) => {
    if (weaponEquipped === equipped) return;
    weaponEquipped = equipped;
    setHarperWeaponNodesVisible(lastAvatarModel, weaponEquipped);
  };

  const handlePrimaryDown = () => {
    if (isSkillAnimationActive()) return;
    if (!weaponEquipped) {
      primaryAttackHeld = true;
      if (barePrimaryAttackState.active || !normalAttackBareBinding) return;
      const started = playActionBinding(normalAttackBareBinding);
      if (!started) return;
      const now = performance.now();
      const durationMs = Math.max(
        1,
        normalAttackBareBinding.clip.duration * 1000
      );
      barePrimaryAttackState.active = true;
      barePrimaryAttackState.projectileFired = false;
      barePrimaryAttackState.startedAt = now;
      barePrimaryAttackState.chargeEndsAt =
        now + durationMs * normalAttackBareChargeEndProgress;
      barePrimaryAttackState.fireAt =
        now + durationMs * normalAttackBareProjectileFireProgress;
      barePrimaryAttackState.endsAt = now + durationMs;
      primaryAttackChargePulse = 0;
      setPrimaryAttackChargeVisible(true);
      return;
    }
    primaryAttackHeld = true;
    fireProjectile?.();
  };

  const handlePrimaryUp = () => {
    if (!weaponEquipped && barePrimaryAttackState.active) {
      const inChargeWindow = performance.now() < barePrimaryAttackState.chargeEndsAt;
      if (!barePrimaryAttackState.projectileFired && inChargeWindow) {
        resetBarePrimaryAttackState();
      }
    }
    primaryAttackHeld = false;
  };

  const handlePrimaryCancel = () => {
    if (!weaponEquipped && barePrimaryAttackState.active) {
      const inChargeWindow = performance.now() < barePrimaryAttackState.chargeEndsAt;
      if (!barePrimaryAttackState.projectileFired && inChargeWindow) {
        resetBarePrimaryAttackState();
      }
    }
    primaryAttackHeld = false;
  };

  const handleSkillQ = () => {
    const skillQBinding =
      (weaponEquipped ? skillQWeaponBinding : skillQBareBinding) ??
      skillQBareBinding ??
      skillQWeaponBinding;
    if (tryPlaySkill(skillQBinding)) {
      if (!weaponEquipped && skillQBinding === skillQBareBinding) {
        skillQBareGateSummonedInCast = false;
        ensureSkillQBareGateTemplate();
        ensureSkillQBarePurcleTemplate();
      }
      return true;
    }
    return baseRuntime.handleSkillQ?.() ?? false;
  };

  const handleSkillE = () => {
    if (weaponEquipped) {
      const skillEBinding = skillEWeaponBinding ?? skillEBareBinding;
      if (tryPlaySkill(skillEBinding)) return true;
      return baseRuntime.handleSkillE?.() ?? false;
    }

    if (!skillEBareBinding) {
      setWeaponEquipped(true);
      return true;
    }
    if (!tryPlaySkill(skillEBareBinding)) return false;
    setWeaponEquipped(true);
    return true;
  };

  const handleSkillR = () => {
    const skillRBinding =
      (weaponEquipped ? skillRWeaponBinding : skillRBareBinding) ??
      skillRBareBinding ??
      skillRWeaponBinding;
    if (tryPlaySkill(skillRBinding)) {
      if (!weaponEquipped && skillRBinding === skillRBareBinding) {
        startSkillRBareState();
      }
      return true;
    }
    return baseRuntime.handleSkillR?.() ?? false;
  };

  const resetState = () => {
    baseRuntime.resetState?.();
    lastAnimationUpdateAt = 0;
    stopActionBinding(skillQBareBinding);
    stopActionBinding(skillEBareBinding);
    stopActionBinding(skillRBareBinding);
    stopActionBinding(skillQWeaponBinding);
    stopActionBinding(skillEWeaponBinding);
    stopActionBinding(skillRWeaponBinding);
    stopActionBinding(normalAttackBareBinding);
    stopActionBinding(normalAttackWeaponBinding);
    activeSkillBinding = null;
    barePrimaryAttackState.active = false;
    barePrimaryAttackState.projectileFired = false;
    barePrimaryAttackState.startedAt = 0;
    barePrimaryAttackState.chargeEndsAt = 0;
    barePrimaryAttackState.fireAt = 0;
    barePrimaryAttackState.endsAt = 0;
    primaryAttackHandBone = null;
    setPrimaryAttackChargeVisible(false);
    clearSkillQBareGateState(true);
    resetSkillRBareState(true);
    primaryAttackChargePulse = 0;
    primaryAttackHeld = false;
    wasPrimaryAttackAnimationActive = false;
    cameraShakeStartedAt = 0;
    cameraShakeEndsAt = 0;
    cameraShakeMagnitude = 0;
    if (eyeAnchor) {
      eyeAnchor.position.copy(eyeAnchorRestLocalPos);
    }
    weaponEquipped = false;
    setHarperWeaponNodesVisible(lastAvatarModel, false);
  };

  const getRuntimeProjectileBlockers = () => {
    runtimeProjectileBlockersScratch.length = 0;
    const baseBlockers = baseRuntime.getProjectileBlockers?.();
    if (baseBlockers?.length) {
      for (let i = 0; i < baseBlockers.length; i += 1) {
        runtimeProjectileBlockersScratch.push(baseBlockers[i]);
      }
    }
    for (let i = 0; i < skillQBareGateActiveEntries.length; i += 1) {
      const entry = skillQBareGateActiveEntries[i];
      if (!entry.collider.parent) continue;
      runtimeProjectileBlockersScratch.push(entry.collider);
    }
    return runtimeProjectileBlockersScratch;
  };

  ensureSkillQBareGateTemplate();
  ensureSkillQBarePurcleTemplate();

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handlePrimaryDown,
    handlePrimaryUp,
    handlePrimaryCancel,
    handleSkillQ,
    handleSkillE,
    handleSkillR,
    getProjectileBlockers: getRuntimeProjectileBlockers,
    handleProjectileBlockHit: baseRuntime.handleProjectileBlockHit,
    getMovementSpeedMultiplier: baseRuntime.getMovementSpeedMultiplier,
    getCameraScaleMultiplier: baseRuntime.getCameraScaleMultiplier,
    getCameraFollowTarget: () => eyeAnchor,
    isBasicAttackLocked: baseRuntime.isBasicAttackLocked,
    isMovementLocked: baseRuntime.isMovementLocked,
    getSkillCooldownRemainingMs: baseRuntime.getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs: baseRuntime.getSkillCooldownDurationMs,
    getSkillHudIndicators: baseRuntime.getSkillHudIndicators,
    beforeSkillUse: baseRuntime.beforeSkillUse,
    beforeDamage: baseRuntime.beforeDamage,
    beforeStatusApply: baseRuntime.beforeStatusApply,
    isImmuneToStatus: baseRuntime.isImmuneToStatus,
    onTick: baseRuntime.onTick,
    resetState,
    update: (args) => {
      bindModel(args.avatarModel);
      if (args.aimDirectionWorld && args.aimDirectionWorld.lengthSq() > 0.000001) {
        runtimeAimDirection.copy(args.aimDirectionWorld).normalize();
      }
      updateAnimations(args.now, args.isMoving, args.isSprinting);

      baseRuntime.update({
        ...args,
        arms: [],
        legLeft: null,
        legRight: null,
      });
    },
    dispose: () => {
      clearAnimationBinding();
      clearEyeAnchor();
      lastAvatarModel = null;
      primaryAttackChargeOrb.removeFromParent();
      clearSkillQBareGateState(true);
      skillRBareFxRoot.removeFromParent();
      clearSkillRBareShockwaves();
      primaryAttackChargeCore.geometry.dispose();
      primaryAttackChargeCore.material.dispose();
      primaryAttackChargeShell.geometry.dispose();
      primaryAttackChargeShell.material.dispose();
      skillRBareCoreGeometry.dispose();
      skillRBareCoreMaterial.dispose();
      skillRBareShellGeometry.dispose();
      skillRBareShellMaterial.dispose();
      skillRBareWaistRingGeometry.dispose();
      skillRBareWaistRingMaterial.dispose();
      skillRBareGroundDiskGeometry.dispose();
      skillRBareGroundDiskMaterial.dispose();
      skillRBareGroundRingGeometry.dispose();
      skillRBareGroundRingMaterial.dispose();
      skillRBareOrbitParticleGeometry.dispose();
      skillRBareOrbitParticleMaterial.dispose();
      skillRBareShockwaveGeometry.dispose();
      baseRuntime.dispose();
    },
    isFacingLocked: baseRuntime.isFacingLocked,
  });
};
