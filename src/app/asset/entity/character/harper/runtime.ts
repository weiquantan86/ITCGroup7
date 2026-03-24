import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { characterGltfAnimationClipsKey } from "../general/engine/characterLoader";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import type { CharacterRuntimeFactory } from "../general/types";
import { profile } from "./profile";
import {
  applyDamageToHarperEnemyTarget,
  createHarperEnemyTarget,
  isHarperEnemyTargetAlive,
  registerHarperEnemyTarget,
  type HarperEnemyTarget,
  unregisterHarperEnemyTarget,
} from "./purcleThreat";

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
const normalAttackBareRecoveryDurationScale = 0.5;
const normalAttackBareRecoveryEndBufferMs = 40;
const normalAttackBareSpeedMultiplier = 1.4;
const normalAttackBareMinProjectileSpeed = 16;
const normalAttackBareMaxProjectileSpeed = 22;
const normalAttackBareProjectileLifetime = 1.4;
const normalAttackBareProjectileRadius = 0.34;
const normalAttackBareProjectileScale = 2.25;
const normalAttackBareProjectileForwardOffset = 0.62;
const normalAttackBareDamageBase = 10;
const normalAttackBareDamagePerSpeed = 0.6;
const normalAttackBareDamageMultiplier = 1.5;
const normalAttackWeaponMoveSpeedMultiplier = 0.2;
const normalAttackWeaponThirdBackstepDistance = 2;
const normalAttackWeaponBackstepStepDistance = 0.08;
const normalAttackWeaponThirdBackstepProgress = 0.69;
const normalAttackWeaponThirdBackstepAdvanceSeconds = 0.2;
const normalAttackWeaponThirdBackstepDurationMs = 390;
const normalAttackWeaponStageDamage = [50, 60, 70] as const;
const normalAttackWeaponStageManaGain = [2, 4, 8] as const;
const normalAttackWeaponStageEnergyGain = [5, 10, 15] as const;
const normalAttackWeaponFinalStageHeal = 10;
const normalAttackWeaponAoEMaxHits = 12;
const normalAttackWeaponContactRadius = [0.72, 0.8, 0.92] as const;
const normalAttackWeaponContactForwardOffset = [0.18, 0.26, 0.56] as const;
const normalAttackBareHitManaGain = 4;
const skillEBareToWeaponLocomotionBlendMs = 220;
const skillEBareAutoFinishProgress = 0.84;
const harperSkillEBareManaCost = 70;
const harperSkillECooldownMs = 20_000;
const harperSkillRManaCost = 50;
const harperSkillRCooldownMs = 13_000;
const normalAttackWeaponComboStages = [
  {
    startProgress: 0.11,
    hitProgress: 0.151,
    endProgress: 0.24,
  },
  {
    startProgress: 0.3,
    hitProgress: 0.354,
    endProgress: 0.45,
  },
  {
    startProgress: 0.51,
    hitProgress: 0.575,
    endProgress: 0.66,
  },
] as const;
const skillEWeaponThrowProgressFallback = 0.45;
const skillEWeaponProjectileSpeed = 23.5;
const skillEWeaponProjectileLifetime = 2.2;
const skillEWeaponProjectileRadius = 0.2;
const skillEWeaponProjectileTargetHitRadius = 0.34;
const skillEWeaponProjectileDamage = 30;
const skillEWeaponProjectileExplosionRadius = 5.8;
const skillEWeaponProjectileExplosionDamage = 100;
const skillEWeaponProjectileExplosionMinDamage = 24;
const skillEWeaponProjectileForwardOffset = 0.52;
const skillEWeaponProjectileMaxBackwardOffset = 1.28;
const skillEWeaponProjectileUpwardOffset = 0.16;
const skillEBareWeaponFadeInStartProgress = 0.03;
const skillEBareWeaponFadeInEndProgress = 0.62;
const skillEBareSummonParticleCount = 32;
const skillEBareSummonParticleSpawnRate = 64;
const skillEBareSummonParticleLifeMin = 0.2;
const skillEBareSummonParticleLifeMax = 0.56;
const skillEBareSummonParticleSpeedMin = 0.55;
const skillEBareSummonParticleSpeedMax = 1.95;
const skillEWeaponExplosionFxDurationMs = 5200;
const skillEWeaponExplosionShakeDurationMs = skillEWeaponExplosionFxDurationMs;
const skillEWeaponExplosionShakeMagnitude = 0.34;
const skillEWeaponExplosionCameraShakeMagnitude = 0.32;
const skillEWeaponExplosionCameraShakeDurationMs = skillEWeaponExplosionFxDurationMs;
const skillEWeaponExplosionParticleCount = 24;
const skillEWeaponExplosionMaxActiveCount = 3;
const skillEWeaponExplosionFlashIntervalMs = 250;
const skillEWeaponExplosionDamageTickIntervalMs = 250;
const skillEWeaponExplosionDamageTick = 100;
const skillQWeaponExplosionTriggerStartProgress = 0.14;
const skillQWeaponExplosionTriggerEndProgress = 0.9;
const skillQWeaponSwingMinSpeed = 3.2;
const skillQWeaponSwingPersistMs = 95;
const skillQWeaponContactRadius = 0.5;
const skillQWeaponContactForwardOffset = 0.16;
const skillQWeaponContactMinTravel = 0.18;
const skillQWeaponExplosionSweepMaxHits = 12;
const skillQWeaponColliderDamage = 1;
const skillQCastMoveSpeedMultiplier = 0.1;
const skillQBarePurcleHitManaGain = 1;
const skillQBarePurcleHitEnergyGain = 1;
const weaponMeshColliderBoundsPadding = 0.04;
const skillQBareGateSummonProgress = 0.52;
const skillQBareGateSpawnForwardOffset = 2.2;
const skillQBareGateGroundYOffset = -0.04;
const skillQBareGateRiseDepth = 3.2;
const skillQBareGateRiseDurationMs = 900;
const skillQBareGateScale = 1;
const skillQBareGateColliderDepth = 0.78;
const skillQBareGatePurcleSpawnIntervalMs = 7000;
const skillQBareGateMaxHealth = 10;
const skillQBarePurcleScale = 0.86;
const skillQBarePurcleMoveSpeed = 3.6;
const skillQBarePurcleSpawnForwardOffset = 1.15;
const skillQBarePurcleLifetimeMs = 20000;
const skillQBarePurcleMaxHealth = 50;
const skillQBarePurcleEnemySearchRadius = 100;
const skillQBarePurcleAttackRange = 2.325;
const skillQBarePurcleAttackReach = 0.42;
const skillQBarePurcleAttackHitRadius = 0.68;
const skillQBarePurcleAttackDamage = 9;
const skillQBarePurcleAttackCooldownMs = 900;
const skillQBarePurcleAttackHitProgress = 0.5;
const skillQBarePurcleSpawnBoundsPadding = 0.28;
const skillQBarePurcleSpawnCheckRadius = 0.48;
const skillQBarePurcleSpawnStep = 0.45;
const skillQBarePurcleGravity = -22;
const skillRWeaponPurcleSummonProgress = 0.36;
const skillRWeaponPurcleSummonCount = 3;
const skillRWeaponPurcleSummonRadius = 5;
const skillRWeaponPurcleSummonMinRadius = 1.15;
const skillRWeaponPurcleSummonAttemptsPerUnit = 12;
const skillRWeaponPurcleMinSeparation = 1.35;
const purcleSmokeFxDurationMs = 900;
const purcleSmokeFxParticleCount = 11;
const purcleSmokeFxMaxActiveBursts = 24;
const purcleSmokeFxSpeedMin = 0.68;
const purcleSmokeFxSpeedMax = 2.05;
const purcleSmokeFxRiseBoostMin = 0.42;
const purcleSmokeFxRiseBoostMax = 1.24;
const skillQBarePurcleMeleeHitHeightMin = 1.05;
const skillQBarePurcleMeleeHitHeightMax = 2.4;
const skillQBarePurcleMeleeHitRadiusMin = 0.58;
const skillQBarePurcleMeleeHitRadiusMax = 1.28;
const skillQBarePortalParticleCount = 24;
const skillRBareLiftStartProgress = 0.08;
const skillRBareLiftPeakProgress = 0.56;
const skillRBareLiftReleaseEndProgress = 0.92;
const skillRBareLiftMaxHeight = 1.05;
const skillRBareChargeStartProgress = 0.08;
const skillRBareChargeEndProgress = 0.64;
const skillRBareBurstProgress = 0.68;
const skillRBareFxFadeOutProgress = 0.95;
const skillRBareOrbitParticleCount = 36;
const skillRBareHomingProjectileCount = 34;
const skillRBareHomingSpawnRadius = 1.32;
const skillRBareHomingSpawnHeight = 1.14;
const skillRBareFxBaseHeight = 1.22;
const skillRBareOuterRingBaseYOffset = 0.36;
const skillRBareOuterRingOrbitRadius = 0.3;
const skillRBareOuterRingVerticalOrbitRadius = 0.2;
const skillRBareOuterRingOrbitSpeedA = 1.9;
const skillRBareOuterRingOrbitSpeedB = 2.6;
const skillRBareOuterRingSpinSpeedX = 2.1;
const skillRBareOuterRingSpinSpeedY = 2.8;
const skillRBareOuterRingSpinSpeedZ = 2.3;
const skillRBareExpandingRingBaseYOffset = 0.18;
const skillRBareExpandingRingOrbitRadius = 0.56;
const skillRBareExpandingRingVerticalOrbitRadius = 0.3;
const skillRBareExpandingRingOrbitSpeedA = 1.45;
const skillRBareExpandingRingOrbitSpeedB = 2.05;
const skillRBareExpandingRingSpinSpeedX = 1.7;
const skillRBareExpandingRingSpinSpeedY = 2.2;
const skillRBareExpandingRingSpinSpeedZ = 1.9;
const skillRBareExplosionSphereBaseYOffset = -0.34;
const skillRBareExplosionSphereBurstScaleBoost = 3.9;
const skillRBareExplosionSphereShakeDurationMs = 800;
const skillRBareExplosionSphereShakeMagnitude = 0.16;
const skillRBareHomingMinSpeed = 11.8;
const skillRBareHomingMaxSpeed = 17.2;
const skillRBareHomingLifetime = 2.3;
const skillRBareHomingTurnRate = 5.8;
const skillRBareHomingTargetRadius = 18;
const skillRBareHomingEnergyGainOnHit = 2;
const skillRBareCameraShakeMagnitude = 0.21;
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

type WeaponPrimaryAttackState = {
  active: boolean;
  stageIndex: number;
  stageHitApplied: boolean;
  stage3BackstepApplied: boolean;
};

type WeaponPrimaryBackstepState = {
  active: boolean;
  direction: THREE.Vector3;
  plannedDistance: number;
  appliedDistance: number;
  elapsedMs: number;
  durationMs: number;
};

type SkillQWeaponExplosionState = {
  active: boolean;
  hasWeaponSample: boolean;
  previousSampleAt: number;
  swingActiveUntil: number;
  hitTargetIds: Set<string>;
};

type SkillEWeaponThrowState = {
  active: boolean;
  projectileLaunched: boolean;
  forcedBare: boolean;
  hasSourceSample: boolean;
  previousSourceWorldPos: THREE.Vector3;
};

type WeaponMeshColliderHitResolvedArgs = {
  targetId: string;
  point: THREE.Vector3;
  direction: THREE.Vector3;
};

type WeaponMeshColliderResult = {
  hitCount: number;
  hasCollider: boolean;
};

type HarperWeaponMaterialEntry = {
  material: THREE.Material;
  baseOpacity: number;
  baseTransparent: boolean;
};

type SkillEBareSummonParticle = {
  mesh: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  life: number;
  startScale: number;
  active: boolean;
};

type SkillEWeaponExplosionParticle = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  angle: number;
  radius: number;
  radialSpeed: number;
  height: number;
  heightSpeed: number;
  swirl: number;
  phase: number;
};

type SkillEWeaponExplosionFxEntry = {
  root: THREE.Group;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  coreMaterial: THREE.MeshBasicMaterial;
  shell: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  shellMaterial: THREE.MeshBasicMaterial;
  voidShell: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  voidShellMaterial: THREE.MeshBasicMaterial;
  ringOuter: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  ringOuterMaterial: THREE.MeshBasicMaterial;
  ringInner: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  ringInnerMaterial: THREE.MeshBasicMaterial;
  pulseRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  pulseRingMaterial: THREE.MeshBasicMaterial;
  shockDisk: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  shockDiskMaterial: THREE.MeshBasicMaterial;
  particleMaterial: THREE.MeshBasicMaterial;
  particles: SkillEWeaponExplosionParticle[];
  startedAt: number;
  endsAt: number;
  shakeEndsAt: number;
  nextDamageTickAt: number;
  baseWorldPos: THREE.Vector3;
  shakeOffset: THREE.Vector3;
  spin: number;
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
  id: string;
  root: THREE.Object3D;
  enemyTarget: HarperEnemyTarget;
  collider: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  spawnAnchor: THREE.Object3D;
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
  groundY: number;
  requestedAt: number;
};

type SkillQBarePurcleMotionState = "idle" | "walk" | "attack";
type PurcleSmokeReason = "spawn" | "expired" | "dead";

type SkillQBarePurcleEntry = {
  id: string;
  root: THREE.Object3D;
  targetAnchor: THREE.Object3D;
  enemyTarget: HarperEnemyTarget;
  worldPos: THREE.Vector3;
  mixer: THREE.AnimationMixer | null;
  idleAction: THREE.AnimationAction | null;
  walkAction: THREE.AnimationAction | null;
  attackAction: THREE.AnimationAction | null;
  handL: THREE.Object3D | null;
  handR: THREE.Object3D | null;
  groundY: number;
  groundOffset: number;
  verticalVelocity: number;
  motionState: SkillQBarePurcleMotionState;
  attackActive: boolean;
  attackHitApplied: boolean;
  attackHitAt: number;
  attackEndsAt: number;
  nextAttackAt: number;
  attackDurationMs: number;
  speed: number;
};

type PurcleSmokeFxParticle = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  startScale: number;
  baseOpacity: number;
  phase: number;
};

type PurcleSmokeFxEntry = {
  root: THREE.Group;
  particles: PurcleSmokeFxParticle[];
  startedAt: number;
  endsAt: number;
};

let harperGateTemplatePromise: Promise<THREE.Object3D | null> | null = null;
type HarperPurcleTemplate = {
  root: THREE.Object3D;
  clips: THREE.AnimationClip[];
};

let harperPurcleTemplatePromise: Promise<HarperPurcleTemplate | null> | null = null;

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
        return {
          root,
          clips: gltf.animations?.map((clip) => clip.clone()) ?? [],
        } satisfies HarperPurcleTemplate;
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

const isWithinHiddenWeaponNode = (node: THREE.Object3D) => {
  let current: THREE.Object3D | null = node;
  while (current) {
    if (hiddenNodePattern.test(current.name || "")) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

const collectHarperWeaponMaterialEntries = (
  avatarModel: THREE.Object3D | null,
  out: HarperWeaponMaterialEntry[]
) => {
  out.length = 0;
  if (!avatarModel) return;
  const seen = new Set<string>();
  avatarModel.traverse((node) => {
    if (!isWithinHiddenWeaponNode(node)) return;
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;

    const attachOwnedMaterial = (index: number | null) => {
      const arrayMaterials = Array.isArray(mesh.material) ? mesh.material : null;
      const currentMaterial =
        index == null ? (arrayMaterials ? null : mesh.material) : arrayMaterials?.[index];
      if (!currentMaterial) return;
      const owned =
        currentMaterial.userData && currentMaterial.userData.harperOwnedWeaponMaterial
          ? currentMaterial
          : currentMaterial.clone();
      if (owned !== currentMaterial) {
        owned.userData = {
          ...(owned.userData ?? {}),
          harperOwnedWeaponMaterial: true,
        };
        if (index == null) {
          mesh.material = owned;
        } else {
          const nextMaterials = mesh.material.slice();
          nextMaterials[index] = owned;
          mesh.material = nextMaterials;
        }
      }
      if (seen.has(owned.uuid)) return;
      seen.add(owned.uuid);
      out.push({
        material: owned,
        baseOpacity: THREE.MathUtils.clamp(
          Number.isFinite(owned.opacity) ? owned.opacity : 1,
          0,
          1
        ),
        baseTransparent: Boolean(owned.transparent),
      });
    };

    if (Array.isArray(mesh.material)) {
      for (let i = 0; i < mesh.material.length; i += 1) {
        attachOwnedMaterial(i);
      }
      return;
    }
    attachOwnedMaterial(null);
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

const weaponThrowSourceNamePattern = /(weapon(root)?|sword)/i;

const findWeaponThrowSourceNode = (avatarModel: THREE.Object3D | null) => {
  if (!avatarModel) return null;
  let fallback: THREE.Object3D | null = null;
  let best: THREE.Object3D | null = null;
  avatarModel.traverse((node) => {
    const name = (node.name || "").trim();
    if (!name) return;
    if (hiddenNodePattern.test(name)) {
      if (!best || (node as THREE.Mesh).isMesh) {
        best = node;
      }
      return;
    }
    if (!fallback && weaponThrowSourceNamePattern.test(name)) {
      fallback = node;
    }
  });
  return best ?? fallback;
};

const collectWeaponColliderNodes = (
  avatarModel: THREE.Object3D | null,
  out: THREE.Object3D[]
) => {
  out.length = 0;
  if (!avatarModel) return;

  avatarModel.traverse((node) => {
    if (!hiddenNodePattern.test(node.name || "")) return;
    let current = node.parent;
    while (current) {
      if (hiddenNodePattern.test(current.name || "")) {
        return;
      }
      current = current.parent;
    }
    out.push(node);
  });

  if (out.length > 0) return;
  const fallback = findWeaponThrowSourceNode(avatarModel);
  if (fallback) {
    out.push(fallback);
  }
};

const cloneObjectWithClonedMaterials = (source: THREE.Object3D) => {
  const clone = SkeletonUtils.clone(source);
  const materials: THREE.Material[] = [];
  let hasMesh = false;
  clone.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    hasMesh = true;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => {
        const clonedMaterial = material.clone();
        materials.push(clonedMaterial);
        return clonedMaterial;
      });
    } else if (mesh.material) {
      const clonedMaterial = mesh.material.clone();
      mesh.material = clonedMaterial;
      materials.push(clonedMaterial);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return { clone, materials, hasMesh };
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

const finishOneShotBindingWithoutRewind = (binding: ActionBinding | null) => {
  if (!binding) return;
  const action = binding.action;
  action.enabled = true;
  action.paused = true;
  action.setEffectiveTimeScale(1);
  action.time = Math.max(0, binding.clip.duration - 1 / 120);
  action.setEffectiveWeight(0);
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

const setActionWeight = (
  action: THREE.AnimationAction | null,
  weight: number,
  timeScale = 1
) => {
  if (!action) return;
  action.enabled = true;
  action.paused = false;
  action.setEffectiveTimeScale(timeScale);
  action.setEffectiveWeight(THREE.MathUtils.clamp(weight, 0, 1));
  if (!action.isRunning()) {
    action.play();
  }
};

const freezeLoopBinding = (binding: ActionBinding | null, time = 0) => {
  if (!binding) return;
  const action = binding.action;
  action.enabled = true;
  action.paused = true;
  action.time = Math.max(0, time);
  action.setEffectiveWeight(0);
};

const resolveClipByPatterns = (
  clips: THREE.AnimationClip[],
  patterns: RegExp[]
) => {
  for (let i = 0; i < patterns.length; i += 1) {
    const found = clips.find((clip) => patterns[i].test(clip.name));
    if (found) return found;
  }
  return null;
};

const parseTrackNodeBinding = (track: THREE.KeyframeTrack) => {
  try {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name) as {
      nodeName?: unknown;
      propertyName?: unknown;
    };
    const nodeName =
      typeof parsed.nodeName === "string" ? parsed.nodeName.trim() : "";
    const propertyName =
      typeof parsed.propertyName === "string" ? parsed.propertyName : "";
    if (!nodeName || !propertyName) return null;
    return { nodeName, propertyName };
  } catch {
    return null;
  }
};

const scoreWeaponTrackNode = (
  nodeName: string,
  preferredNodeNameLower: string | null
) => {
  const normalizedNodeName = nodeName.toLowerCase();
  let score = 0;
  if (preferredNodeNameLower && normalizedNodeName === preferredNodeNameLower) {
    score += 120;
  }
  if (hiddenNodePattern.test(nodeName)) {
    score += 80;
  } else if (weaponThrowSourceNamePattern.test(nodeName)) {
    score += 40;
  }
  return score;
};

const skillEThrowInitialPos = new THREE.Vector3();
const skillEThrowPreviousPos = new THREE.Vector3();
const skillEThrowCurrentPos = new THREE.Vector3();
const skillEThrowInitialQuat = new THREE.Quaternion();
const skillEThrowPreviousQuat = new THREE.Quaternion();
const skillEThrowCurrentQuat = new THREE.Quaternion();

const resolveFirstMeaningfulPositionKeyTime = (track: THREE.KeyframeTrack) => {
  const times = (track as unknown as { times?: ArrayLike<number> }).times;
  const values = (track as unknown as { values?: ArrayLike<number> }).values;
  if (!times || !values || times.length < 2 || values.length < times.length * 3) {
    return null;
  }

  skillEThrowInitialPos.set(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0);
  skillEThrowPreviousPos.copy(skillEThrowInitialPos);
  let maxDisplacement = 0;
  let maxStepSpeed = 0;
  for (let i = 1; i < times.length; i += 1) {
    const valueIndex = i * 3;
    skillEThrowCurrentPos.set(
      values[valueIndex] ?? 0,
      values[valueIndex + 1] ?? 0,
      values[valueIndex + 2] ?? 0
    );
    const displacement = skillEThrowCurrentPos.distanceTo(skillEThrowInitialPos);
    const stepDistance = skillEThrowCurrentPos.distanceTo(skillEThrowPreviousPos);
    const deltaTime = Math.max(0.00001, (times[i] ?? 0) - (times[i - 1] ?? 0));
    maxDisplacement = Math.max(maxDisplacement, displacement);
    maxStepSpeed = Math.max(maxStepSpeed, stepDistance / deltaTime);
    skillEThrowPreviousPos.copy(skillEThrowCurrentPos);
  }

  const displacementThreshold = Math.max(0.008, maxDisplacement * 0.08);
  const speedThreshold = Math.max(0.04, maxStepSpeed * 0.18);
  skillEThrowPreviousPos.copy(skillEThrowInitialPos);
  for (let i = 1; i < times.length; i += 1) {
    const valueIndex = i * 3;
    skillEThrowCurrentPos.set(
      values[valueIndex] ?? 0,
      values[valueIndex + 1] ?? 0,
      values[valueIndex + 2] ?? 0
    );
    const displacement = skillEThrowCurrentPos.distanceTo(skillEThrowInitialPos);
    const stepDistance = skillEThrowCurrentPos.distanceTo(skillEThrowPreviousPos);
    const deltaTime = Math.max(0.00001, (times[i] ?? 0) - (times[i - 1] ?? 0));
    const stepSpeed = stepDistance / deltaTime;
    if (displacement >= displacementThreshold && stepSpeed >= speedThreshold) {
      return times[i] ?? null;
    }
    skillEThrowPreviousPos.copy(skillEThrowCurrentPos);
  }

  const fallbackDisplacementThreshold = Math.max(0.004, maxDisplacement * 0.03);
  const fallbackSpeedThreshold = Math.max(0.02, maxStepSpeed * 0.08);
  skillEThrowPreviousPos.copy(skillEThrowInitialPos);
  for (let i = 1; i < times.length; i += 1) {
    const valueIndex = i * 3;
    skillEThrowCurrentPos.set(
      values[valueIndex] ?? 0,
      values[valueIndex + 1] ?? 0,
      values[valueIndex + 2] ?? 0
    );
    const displacement = skillEThrowCurrentPos.distanceTo(skillEThrowInitialPos);
    const stepDistance = skillEThrowCurrentPos.distanceTo(skillEThrowPreviousPos);
    const deltaTime = Math.max(0.00001, (times[i] ?? 0) - (times[i - 1] ?? 0));
    const stepSpeed = stepDistance / deltaTime;
    if (
      displacement >= fallbackDisplacementThreshold &&
      stepSpeed >= fallbackSpeedThreshold
    ) {
      return times[i] ?? null;
    }
    skillEThrowPreviousPos.copy(skillEThrowCurrentPos);
  }

  return null;
};

const resolveFirstMeaningfulRotationKeyTime = (track: THREE.KeyframeTrack) => {
  const times = (track as unknown as { times?: ArrayLike<number> }).times;
  const values = (track as unknown as { values?: ArrayLike<number> }).values;
  if (!times || !values || times.length < 2 || values.length < times.length * 4) {
    return null;
  }

  skillEThrowInitialQuat
    .set(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1)
    .normalize();
  skillEThrowPreviousQuat.copy(skillEThrowInitialQuat);
  let maxAngle = 0;
  let maxAngularSpeed = 0;
  for (let i = 1; i < times.length; i += 1) {
    const valueIndex = i * 4;
    skillEThrowCurrentQuat
      .set(
        values[valueIndex] ?? 0,
        values[valueIndex + 1] ?? 0,
        values[valueIndex + 2] ?? 0,
        values[valueIndex + 3] ?? 1
      )
      .normalize();
    const angle = skillEThrowCurrentQuat.angleTo(skillEThrowInitialQuat);
    const deltaAngle = skillEThrowCurrentQuat.angleTo(skillEThrowPreviousQuat);
    const deltaTime = Math.max(0.00001, (times[i] ?? 0) - (times[i - 1] ?? 0));
    maxAngle = Math.max(maxAngle, angle);
    maxAngularSpeed = Math.max(maxAngularSpeed, deltaAngle / deltaTime);
    skillEThrowPreviousQuat.copy(skillEThrowCurrentQuat);
  }

  const angleThreshold = Math.max(0.06, maxAngle * 0.12);
  const speedThreshold = Math.max(0.22, maxAngularSpeed * 0.18);
  skillEThrowPreviousQuat.copy(skillEThrowInitialQuat);
  for (let i = 1; i < times.length; i += 1) {
    const valueIndex = i * 4;
    skillEThrowCurrentQuat
      .set(
        values[valueIndex] ?? 0,
        values[valueIndex + 1] ?? 0,
        values[valueIndex + 2] ?? 0,
        values[valueIndex + 3] ?? 1
      )
      .normalize();
    const angle = skillEThrowCurrentQuat.angleTo(skillEThrowInitialQuat);
    const deltaAngle = skillEThrowCurrentQuat.angleTo(skillEThrowPreviousQuat);
    const deltaTime = Math.max(0.00001, (times[i] ?? 0) - (times[i - 1] ?? 0));
    const angularSpeed = deltaAngle / deltaTime;
    if (angle >= angleThreshold && angularSpeed >= speedThreshold) {
      return times[i] ?? null;
    }
    skillEThrowPreviousQuat.copy(skillEThrowCurrentQuat);
  }

  return null;
};

const resolveSkillEWeaponThrowProgressFromClip = ({
  clip,
  preferredNodeName,
}: {
  clip: THREE.AnimationClip | null;
  preferredNodeName?: string | null;
}) => {
  if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0.00001) {
    return skillEWeaponThrowProgressFallback;
  }

  const preferredNodeNameLower =
    typeof preferredNodeName === "string" && preferredNodeName.trim()
      ? preferredNodeName.trim().toLowerCase()
      : null;

  let bestPositionTrack: THREE.KeyframeTrack | null = null;
  let bestPositionScore = -Infinity;
  let bestRotationTrack: THREE.KeyframeTrack | null = null;
  let bestRotationScore = -Infinity;
  for (let i = 0; i < clip.tracks.length; i += 1) {
    const track = clip.tracks[i];
    const parsed = parseTrackNodeBinding(track);
    if (!parsed) continue;
    const nodeScore = scoreWeaponTrackNode(parsed.nodeName, preferredNodeNameLower);
    if (nodeScore <= 0) continue;
    if (parsed.propertyName === "position" && nodeScore > bestPositionScore) {
      bestPositionTrack = track;
      bestPositionScore = nodeScore;
    }
    if (parsed.propertyName === "quaternion" && nodeScore > bestRotationScore) {
      bestRotationTrack = track;
      bestRotationScore = nodeScore;
    }
  }

  const throwTime =
    (bestPositionTrack
      ? resolveFirstMeaningfulPositionKeyTime(bestPositionTrack)
      : null) ??
    (bestRotationTrack
      ? resolveFirstMeaningfulRotationKeyTime(bestRotationTrack)
      : null);
  if (throwTime == null) {
    return skillEWeaponThrowProgressFallback;
  }
  return THREE.MathUtils.clamp(throwTime / clip.duration, 0.02, 0.95);
};

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  groundY,
  bounds,
  isBlocked,
  noCooldown,
  fireProjectile,
  getAttackTargets,
  performMeleeAttack,
  applyHealth,
  applyEnergy,
  applyMana,
  spendMana,
  clearSkillCooldown,
  getCurrentStats,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const runtimeGroundY = Number.isFinite(groundY) ? groundY : avatar.position.y;
  const runtimeBounds = bounds ?? null;
  const runtimeIsBlocked = isBlocked ?? null;
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
  const weaponPrimaryAttackState: WeaponPrimaryAttackState = {
    active: false,
    stageIndex: 0,
    stageHitApplied: false,
    stage3BackstepApplied: false,
  };
  const weaponPrimaryBackstepState: WeaponPrimaryBackstepState = {
    active: false,
    direction: new THREE.Vector3(0, 0, 1),
    plannedDistance: 0,
    appliedDistance: 0,
    elapsedMs: 0,
    durationMs: normalAttackWeaponThirdBackstepDurationMs,
  };
  const skillQWeaponExplosionState: SkillQWeaponExplosionState = {
    active: false,
    hasWeaponSample: false,
    previousSampleAt: 0,
    swingActiveUntil: 0,
    hitTargetIds: new Set<string>(),
  };
  const skillEWeaponThrowState: SkillEWeaponThrowState = {
    active: false,
    projectileLaunched: false,
    forcedBare: false,
    hasSourceSample: false,
    previousSourceWorldPos: new THREE.Vector3(),
  };
  let skillEWeaponResolvedThrowProgress = skillEWeaponThrowProgressFallback;
  let weaponThrowSourceNode: THREE.Object3D | null = null;
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
  const weaponPrimaryBackstepForward = new THREE.Vector3(0, 0, 1);
  const weaponPrimaryBackstepDirection = new THREE.Vector3(0, 0, 1);
  const weaponPrimaryHitPrevWorldPos = new THREE.Vector3();
  const weaponPrimaryHitTravel = new THREE.Vector3();
  const weaponPrimaryHitWorldPos = new THREE.Vector3();
  const weaponPrimaryHitContactCenter = new THREE.Vector3();
  const weaponPrimaryHitDirection = new THREE.Vector3(0, 0, 1);
  const weaponPrimaryHitSourceQuat = new THREE.Quaternion();
  let weaponPrimaryHitSampleValid = false;
  const skillQWeaponHitWorldPos = new THREE.Vector3();
  const skillQWeaponHitPrevWorldPos = new THREE.Vector3();
  const skillQWeaponHitTravel = new THREE.Vector3();
  const skillQWeaponHitDirection = new THREE.Vector3(0, 0, 1);
  const skillQWeaponHitSourceQuat = new THREE.Quaternion();
  const skillQWeaponHitContactCenter = new THREE.Vector3();
  const skillQWeaponFallbackBounds = new THREE.Box3();
  const skillQWeaponFallbackClosestPoint = new THREE.Vector3();
  const skillQWeaponFallbackDirection = new THREE.Vector3(0, 0, 1);
  const weaponColliderNodes: THREE.Object3D[] = [];
  const weaponColliderWorldBounds = new THREE.Box3();
  const weaponColliderNodeBounds = new THREE.Box3();
  const weaponColliderTargetBounds = new THREE.Box3();
  const weaponColliderIntersectionBounds = new THREE.Box3();
  const weaponColliderCenter = new THREE.Vector3();
  const weaponColliderHitPoint = new THREE.Vector3();
  const weaponColliderHitDirection = new THREE.Vector3(0, 0, 1);
  const runtimeAimDirection = new THREE.Vector3(0, 0, 1);
  const skillEWeaponThrowOriginWorld = new THREE.Vector3();
  const skillEWeaponThrowDirection = new THREE.Vector3(0, 0, 1);
  const skillEWeaponThrowSourceQuat = new THREE.Quaternion();
  const skillEWeaponThrowSourceScale = new THREE.Vector3(1, 1, 1);
  const skillEWeaponThrowSampleEndWorld = new THREE.Vector3();
  const skillEWeaponThrowAvatarQuat = new THREE.Quaternion();
  const skillEWeaponThrowAvatarForward = new THREE.Vector3(0, 0, 1);
  const skillEWeaponThrowAxisWorldCandidate = new THREE.Vector3();
  const skillEWeaponThrowSelectedLocalAxis = new THREE.Vector3(0, 0, 1);
  const skillEWeaponSpawnToTarget = new THREE.Vector3();
  const skillEWeaponSpawnTargetBounds = new THREE.Box3();
  const skillEWeaponSpawnClosestPoint = new THREE.Vector3();
  const skillEWeaponLaunchSourceWorld = new THREE.Vector3();
  const skillEWeaponThrowAxisProbe = [
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
  ] as const;
  const skillEWeaponExplosionFxEntries: SkillEWeaponExplosionFxEntry[] = [];
  const skillEWeaponExplosionCoreGeometry = new THREE.SphereGeometry(0.44, 18, 16);
  const skillEWeaponExplosionShellGeometry = new THREE.SphereGeometry(0.7, 16, 14);
  const skillEWeaponExplosionRingOuterGeometry = new THREE.TorusGeometry(
    0.98,
    0.09,
    10,
    44
  );
  const skillEWeaponExplosionRingInnerGeometry = new THREE.TorusGeometry(
    0.58,
    0.06,
    10,
    36
  );
  const skillEWeaponExplosionShockDiskGeometry = new THREE.RingGeometry(0.2, 1.22, 44);
  const skillEWeaponExplosionParticleGeometry = new THREE.SphereGeometry(0.09, 8, 8);
  const skillEBareSummonParticleGeometry = new THREE.ConeGeometry(0.09, 0.28, 3, 1, true);
  const skillEBareSummonFxRoot = new THREE.Group();
  const skillEBareSummonParticles: SkillEBareSummonParticle[] = [];
  const skillEWeaponExplosionSpawnWorldPos = new THREE.Vector3();
  const skillEWeaponExplosionDamageCenter = new THREE.Vector3();
  const skillEWeaponExplosionDamageDirection = new THREE.Vector3(0, 0, 1);
  const skillEWeaponExplosionFallbackTargetPos = new THREE.Vector3();
  const skillEBareSummonSourceWorldPos = new THREE.Vector3();
  const skillEBareSummonSourceLocalPos = new THREE.Vector3();
  const skillEBareSummonSpawnDirection = new THREE.Vector3();
  const skillEBareSummonVelocityScratch = new THREE.Vector3();
  const harperWeaponMaterialEntries: HarperWeaponMaterialEntry[] = [];
  let harperWeaponVisualOpacity = 1;
  let skillEBareSummonFxActive = false;
  let skillEBareSummonParticleBudget = 0;
  let primaryAttackChargePulse = 0;
  let primaryAttackHeld = false;
  let wasPrimaryAttackAnimationActive = false;
  let weaponEquipped = false;
  let runtimeSkillECooldownUntil = 0;
  let runtimeSkillRCooldownUntil = 0;
  let skillEBarePostTransitionEndsAt = 0;
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
  let skillRBareExplosionSphereShakeEndsAt = 0;
  const skillRBareExplosionSphereShakeOffset = new THREE.Vector3();
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
  const skillRBareGroundDiskGeometry = new THREE.SphereGeometry(0.8, 24, 20);
  const skillRBareGroundDiskMaterial = new THREE.MeshBasicMaterial({
    color: 0x6d28d9,
    transparent: true,
    opacity: 0.58,
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
  let skillQBarePurcleTemplateClips: THREE.AnimationClip[] = [];
  let skillQBarePurcleTemplateLoading = false;
  let skillQBareGateSummonedInCast = false;
  let skillRWeaponPurcleSummonedInCast = false;
  let skillQBareGateIdCounter = 0;
  let skillQBarePurcleIdCounter = 0;
  const skillQBareGateActiveEntries: SkillQBareGateEntry[] = [];
  const skillQBareGateEntryById = new Map<string, SkillQBareGateEntry>();
  const skillQBareGatePendingSummons: SkillQBareGatePendingSummon[] = [];
  const skillQBarePurclePendingSummons: SkillQBarePurclePendingSummon[] = [];
  const skillQBarePurcleEntries: SkillQBarePurcleEntry[] = [];
  const purcleSmokeParticleGeometry = new THREE.SphereGeometry(0.12, 10, 10);
  const purcleSmokeFxEntries: PurcleSmokeFxEntry[] = [];
  const runtimeProjectileBlockersScratch: THREE.Object3D[] = [];
  const skillQBareGateSpawnWorldPos = new THREE.Vector3();
  const skillQBareGateSpawnLocalPos = new THREE.Vector3();
  const skillQBareGateSpawnDirection = new THREE.Vector3();
  const skillQBareGateBounds = new THREE.Box3();
  const skillQBareGateBoundsSize = new THREE.Vector3();
  const skillQBareGateBoundsCenter = new THREE.Vector3();
  const skillQBarePurcleBounds = new THREE.Box3();
  const skillQBarePurcleBoundsSize = new THREE.Vector3();
  const skillQBarePurcleBoundsCenter = new THREE.Vector3();
  const skillQBareGateCenterLocal = new THREE.Vector3();
  const skillQBarePurcleSpawnLocalPos = new THREE.Vector3();
  const skillQBarePurcleGateWorldPos = new THREE.Vector3();
  const skillQBarePurcleWorldPos = new THREE.Vector3();
  const skillQBarePurcleTargetWorldPos = new THREE.Vector3();
  const skillQBarePurcleNextWorldPos = new THREE.Vector3();
  const skillQBarePurcleAttackDirection = new THREE.Vector3();
  const skillQBarePurcleAttackOrigin = new THREE.Vector3();
  const skillQBarePurcleAttackTargetWorldPos = new THREE.Vector3();
  const skillQBarePurcleFistWorldPos = new THREE.Vector3();
  const skillQBarePurcleFallbackForward = new THREE.Vector3();
  const skillQBarePurcleSpawnPerp = new THREE.Vector3();
  const skillQBarePurcleSpawnSample = new THREE.Vector3();
  const skillRWeaponPurcleCenterWorldPos = new THREE.Vector3();
  const skillRWeaponPurcleCandidateWorldPos = new THREE.Vector3();
  const skillRWeaponPurcleDirection = new THREE.Vector3();
  const skillRWeaponPurcleForward = new THREE.Vector3();
  const purcleSmokeLocalPos = new THREE.Vector3();
  const purcleSmokeStep = new THREE.Vector3();
  const purcleSmokeVelocityDirection = new THREE.Vector3();

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
  skillRBareWaistRing.position.y = skillRBareOuterRingBaseYOffset;
  skillRBareGroundDisk.position.y = skillRBareExplosionSphereBaseYOffset;
  skillRBareGroundRing.rotation.x = Math.PI * 0.5;
  skillRBareGroundRing.position.y = skillRBareExpandingRingBaseYOffset;
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
      baseRadius: THREE.MathUtils.lerp(0.9, 1.95, Math.random()),
      height: THREE.MathUtils.lerp(-0.72, 1.1, Math.random()),
      phase: Math.random() * Math.PI * 2,
      drift: THREE.MathUtils.lerp(0.05, 0.18, Math.random()),
    });
  }
  avatar.add(skillRBareFxRoot);

  skillEBareSummonFxRoot.name = "__harperSkillEBareSummonFx";
  skillEBareSummonFxRoot.visible = false;
  skillEBareSummonFxRoot.renderOrder = 11;
  for (let i = 0; i < skillEBareSummonParticleCount; i += 1) {
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    const particleMesh = new THREE.Mesh(skillEBareSummonParticleGeometry, particleMaterial);
    particleMesh.visible = false;
    particleMesh.castShadow = false;
    particleMesh.receiveShadow = false;
    particleMesh.renderOrder = 12;
    skillEBareSummonFxRoot.add(particleMesh);
    skillEBareSummonParticles.push({
      mesh: particleMesh,
      material: particleMaterial,
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      age: 0,
      life: 0.0001,
      startScale: 0.12,
      active: false,
    });
  }
  avatar.add(skillEBareSummonFxRoot);

  const isSkillAnimationActive = () =>
    Boolean(activeSkillBinding && activeSkillBinding.action.isRunning());

  const isBareSkillQCastActive = () =>
    Boolean(
      !weaponEquipped &&
        skillQBareBinding &&
        activeSkillBinding === skillQBareBinding &&
        skillQBareBinding.action.isRunning()
    );

  const isSkillQCastActive = () =>
    Boolean(
      (skillQBareBinding &&
        activeSkillBinding === skillQBareBinding &&
        skillQBareBinding.action.isRunning()) ||
        (skillQWeaponBinding &&
          activeSkillBinding === skillQWeaponBinding &&
          skillQWeaponBinding.action.isRunning())
    );

  const isBareSkillRCastActive = () =>
    Boolean(
      !weaponEquipped &&
        skillRBareBinding &&
        activeSkillBinding === skillRBareBinding &&
        skillRBareBinding.action.isRunning()
    );

  const setPrimaryAttackChargeVisible = (visible: boolean) => {
    primaryAttackChargeOrb.visible = visible;
    if (!visible) {
      primaryAttackChargeLight.intensity = 0;
    }
  };

  const setSkillRBareFxVisible = (visible: boolean) => {
    skillRBareFxRoot.visible = visible;
  };

  const setHarperWeaponVisualOpacity = (opacity: number) => {
    harperWeaponVisualOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
    const applyOpacity = (material: THREE.Material, baseOpacity = 1, baseTransparent = false) => {
      const nextTransparent =
        baseTransparent || baseOpacity < 0.999 || harperWeaponVisualOpacity < 0.999;
      if (material.transparent !== nextTransparent) {
        material.transparent = nextTransparent;
        material.needsUpdate = true;
      }
      material.opacity = THREE.MathUtils.clamp(
        baseOpacity * harperWeaponVisualOpacity,
        0,
        1
      );
    };

    if (!harperWeaponMaterialEntries.length && lastAvatarModel) {
      lastAvatarModel.traverse((node) => {
        if (!isWithinHiddenWeaponNode(node)) return;
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (Array.isArray(mesh.material)) {
          for (let i = 0; i < mesh.material.length; i += 1) {
            applyOpacity(mesh.material[i], 1, Boolean(mesh.material[i].transparent));
          }
        } else if (mesh.material) {
          applyOpacity(mesh.material, 1, Boolean(mesh.material.transparent));
        }
      });
      return;
    }

    for (let i = 0; i < harperWeaponMaterialEntries.length; i += 1) {
      const entry = harperWeaponMaterialEntries[i];
      applyOpacity(entry.material, entry.baseOpacity, entry.baseTransparent);
    }
  };

  const resetSkillEBareSummonFxState = (restoreWeaponOpacity = true) => {
    skillEBareSummonFxActive = false;
    skillEBareSummonParticleBudget = 0;
    skillEBareSummonFxRoot.visible = false;
    for (let i = 0; i < skillEBareSummonParticles.length; i += 1) {
      const particle = skillEBareSummonParticles[i];
      particle.active = false;
      particle.age = 0;
      particle.mesh.visible = false;
      particle.mesh.position.set(0, 0, 0);
      particle.mesh.scale.setScalar(0.0001);
      particle.material.opacity = 0;
      particle.velocity.set(0, 0, 0);
      particle.spin.set(0, 0, 0);
    }
    if (restoreWeaponOpacity) {
      setHarperWeaponVisualOpacity(1);
    }
  };

  const trySpawnSkillEBareSummonParticle = () => {
    for (let i = 0; i < skillEBareSummonParticles.length; i += 1) {
      const particle = skillEBareSummonParticles[i];
      if (particle.active) continue;
      skillEBareSummonSpawnDirection.set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      );
      if (skillEBareSummonSpawnDirection.lengthSq() < 0.000001) {
        skillEBareSummonSpawnDirection.set(0, 1, 0);
      } else {
        skillEBareSummonSpawnDirection.normalize();
      }
      const spawnRadius = THREE.MathUtils.lerp(0.08, 0.34, Math.random());
      const speed = THREE.MathUtils.lerp(
        skillEBareSummonParticleSpeedMin,
        skillEBareSummonParticleSpeedMax,
        Math.random()
      );
      particle.active = true;
      particle.age = 0;
      particle.life = THREE.MathUtils.lerp(
        skillEBareSummonParticleLifeMin,
        skillEBareSummonParticleLifeMax,
        Math.random()
      );
      particle.startScale = THREE.MathUtils.lerp(0.14, 0.32, Math.random());
      particle.mesh.visible = true;
      particle.mesh.position.copy(skillEBareSummonSpawnDirection).multiplyScalar(spawnRadius);
      particle.mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      particle.mesh.scale.setScalar(particle.startScale);
      particle.velocity.copy(skillEBareSummonSpawnDirection).multiplyScalar(speed);
      particle.velocity.y += THREE.MathUtils.lerp(0.45, 1.55, Math.random());
      particle.spin.set(
        THREE.MathUtils.lerp(-8.5, 8.5, Math.random()),
        THREE.MathUtils.lerp(-8.5, 8.5, Math.random()),
        THREE.MathUtils.lerp(-8.5, 8.5, Math.random())
      );
      particle.material.opacity = THREE.MathUtils.lerp(0.76, 1, Math.random());
      return true;
    }
    return false;
  };

  const updateSkillEBareSummonState = (now: number, deltaSeconds: number) => {
    const isBareSkillEActive = Boolean(
      skillEBareBinding &&
        activeSkillBinding === skillEBareBinding
    );

    if (!isBareSkillEActive) {
      if (skillEBareSummonFxActive) {
        resetSkillEBareSummonFxState(true);
      }
      return;
    }

    if (!skillEBareSummonFxActive) {
      skillEBareSummonFxActive = true;
      skillEBareSummonParticleBudget = 0;
      skillEBareSummonFxRoot.visible = true;
      setHarperWeaponVisualOpacity(0);
    }

    const duration = Math.max(0.001, skillEBareBinding?.clip.duration ?? 0.001);
    const progress = THREE.MathUtils.clamp(
      (skillEBareBinding?.action.time ?? 0) / duration,
      0,
      1
    );
    const weaponFadeAlpha = THREE.MathUtils.smoothstep(
      progress,
      skillEBareWeaponFadeInStartProgress,
      skillEBareWeaponFadeInEndProgress
    );
    setHarperWeaponVisualOpacity(weaponFadeAlpha);

    const sourceNode =
      (weaponThrowSourceNode && weaponThrowSourceNode.parent
        ? weaponThrowSourceNode
        : findWeaponThrowSourceNode(lastAvatarModel)) ?? null;
    if (sourceNode && sourceNode.parent) {
      weaponThrowSourceNode = sourceNode;
      sourceNode.updateWorldMatrix(true, true);
      sourceNode.getWorldPosition(skillEBareSummonSourceWorldPos);
    } else {
      avatar.getWorldPosition(skillEBareSummonSourceWorldPos);
      skillEBareSummonSourceWorldPos.y += 1.05;
      if (runtimeAimDirection.lengthSq() > 0.000001) {
        skillEBareSummonSourceWorldPos.addScaledVector(runtimeAimDirection, 0.36);
      } else {
        skillEBareSummonSourceWorldPos.z += 0.36;
      }
    }
    skillEBareSummonSourceLocalPos.copy(skillEBareSummonSourceWorldPos);
    avatar.worldToLocal(skillEBareSummonSourceLocalPos);
    skillEBareSummonFxRoot.position.copy(skillEBareSummonSourceLocalPos);

    const safeDelta = Math.max(0, deltaSeconds);
    const spawnScale = THREE.MathUtils.lerp(1.2, 0.5, weaponFadeAlpha);
    skillEBareSummonParticleBudget +=
      safeDelta * skillEBareSummonParticleSpawnRate * spawnScale;
    while (skillEBareSummonParticleBudget >= 1) {
      if (!trySpawnSkillEBareSummonParticle()) {
        skillEBareSummonParticleBudget = 0;
        break;
      }
      skillEBareSummonParticleBudget -= 1;
    }

    const drag = Math.exp(-2.4 * safeDelta);
    for (let i = 0; i < skillEBareSummonParticles.length; i += 1) {
      const particle = skillEBareSummonParticles[i];
      if (!particle.active) continue;
      particle.age += safeDelta;
      if (particle.age >= particle.life) {
        particle.active = false;
        particle.mesh.visible = false;
        particle.material.opacity = 0;
        continue;
      }
      const lifeRatio = 1 - particle.age / particle.life;
      skillEBareSummonVelocityScratch.copy(particle.velocity).multiplyScalar(safeDelta);
      particle.mesh.position.add(skillEBareSummonVelocityScratch);
      particle.velocity.multiplyScalar(drag);
      particle.velocity.y += safeDelta * 0.6;
      particle.mesh.rotation.x += particle.spin.x * safeDelta;
      particle.mesh.rotation.y += particle.spin.y * safeDelta;
      particle.mesh.rotation.z += particle.spin.z * safeDelta;
      particle.mesh.scale.setScalar(
        Math.max(0.03, particle.startScale * (0.25 + lifeRatio * 0.95))
      );
      particle.material.opacity = THREE.MathUtils.clamp(
        lifeRatio * lifeRatio * (0.85 - weaponFadeAlpha * 0.24),
        0,
        0.92
      );
    }
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
    skillRBareWaistRing.position.set(0, skillRBareOuterRingBaseYOffset, 0);
    skillRBareWaistRing.rotation.set(Math.PI * 0.5, 0, 0);
    skillRBareGroundDisk.scale.setScalar(1);
    skillRBareGroundDisk.position.set(0, skillRBareExplosionSphereBaseYOffset, 0);
    skillRBareGroundDisk.rotation.set(0, 0, 0);
    skillRBareGroundRing.scale.setScalar(1);
    skillRBareGroundRing.position.set(0, skillRBareExpandingRingBaseYOffset, 0);
    skillRBareGroundRing.rotation.set(Math.PI * 0.5, 0, 0);
    skillRBareShellMaterial.opacity = 0.44;
    skillRBareCoreMaterial.emissiveIntensity = 1.8;
    skillRBareWaistRingMaterial.opacity = 0.66;
    skillRBareGroundDiskMaterial.opacity = 0.58;
    skillRBareGroundRingMaterial.opacity = 0.68;
    skillRBareExplosionSphereShakeEndsAt = 0;
    skillRBareExplosionSphereShakeOffset.set(0, 0, 0);
    clearSkillRBareShockwaves();
    setSkillRBareFxVisible(false);
  };

  const startSkillRBareState = () => {
    skillRBareActive = true;
    skillRBareBurstTriggered = false;
    skillRBareBaseAvatarY = avatar.position.y;
    skillRBareCurrentLift = 0;
    skillRBareExplosionSphereShakeEndsAt = 0;
    skillRBareExplosionSphereShakeOffset.set(0, 0, 0);
    skillRBareGroundDisk.position.set(0, skillRBareExplosionSphereBaseYOffset, 0);
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
        grantEnergyOnTargetHit: true,
        energyGainOnHit: skillRBareHomingEnergyGainOnHit,
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
    skillRBareExplosionSphereShakeEndsAt =
      now + skillRBareExplosionSphereShakeDurationMs;
    skillRBareCoreMaterial.emissiveIntensity = 4.2;
    skillRBareShellMaterial.opacity = 0.8;
    skillRBareWaistRingMaterial.opacity = 0.92;
    spawnSkillRBareShockwave({
      yOffset: -0.08,
      life: 0.64,
      startScale: 0.26,
      endScale: 5.8,
      opacity: 0.9,
      color: 0x581c87,
      spin: 2.6,
    });
    spawnSkillRBareShockwave({
      yOffset: 0.42,
      life: 0.58,
      startScale: 0.22,
      endScale: 5.1,
      opacity: 0.8,
      color: 0x6d28d9,
      tiltX: 0.2,
      spin: -2.2,
    });
    spawnSkillRBareShockwave({
      yOffset: 0.95,
      life: 0.48,
      startScale: 0.2,
      endScale: 4.6,
      opacity: 0.76,
      color: 0x7e22ce,
      tiltX: -0.25,
      tiltZ: 0.5,
      spin: 2.9,
    });
    spawnSkillRBareShockwave({
      yOffset: 0.18,
      life: 0.72,
      startScale: 0.24,
      endScale: 6.4,
      opacity: 0.58,
      color: 0xc084fc,
      tiltX: 0.08,
      tiltZ: -0.18,
      spin: -1.9,
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
    const ringOrbitRadius = THREE.MathUtils.lerp(
      skillRBareOuterRingOrbitRadius * 0.55,
      skillRBareOuterRingOrbitRadius,
      chargeProgress
    );
    const ringVerticalOrbit = THREE.MathUtils.lerp(
      skillRBareOuterRingVerticalOrbitRadius * 0.45,
      skillRBareOuterRingVerticalOrbitRadius,
      chargeProgress
    );
    const ringOrbitAngleA = t * skillRBareOuterRingOrbitSpeedA;
    const ringOrbitAngleB = t * skillRBareOuterRingOrbitSpeedB + 0.7;
    skillRBareWaistRing.position.set(
      Math.cos(ringOrbitAngleA) * ringOrbitRadius,
      skillRBareOuterRingBaseYOffset + Math.sin(ringOrbitAngleB) * ringVerticalOrbit,
      Math.sin(ringOrbitAngleA * 0.73 + ringOrbitAngleB * 0.37) * ringOrbitRadius
    );
    const ringSpinStep = Math.max(0, deltaSeconds);
    skillRBareWaistRing.rotation.x += ringSpinStep * skillRBareOuterRingSpinSpeedX;
    skillRBareWaistRing.rotation.y += ringSpinStep * skillRBareOuterRingSpinSpeedY;
    skillRBareWaistRing.rotation.z += ringSpinStep * skillRBareOuterRingSpinSpeedZ;
    const burstEnergy = skillRBareBurstTriggered ? 1 - decayAfterBurst : 0;
    const explosionSpherePulse = 0.9 + Math.sin(t * 7.2 + 0.45) * 0.1;
    const explosionSphereScale =
      THREE.MathUtils.lerp(0.96, 2.5, chargeProgress) *
      explosionSpherePulse *
      (1 + burstEnergy * skillRBareExplosionSphereBurstScaleBoost);
    skillRBareGroundDisk.scale.setScalar(explosionSphereScale);
    skillRBareGroundDisk.position.set(0, skillRBareExplosionSphereBaseYOffset, 0);
    if (now < skillRBareExplosionSphereShakeEndsAt) {
      const shakeRemaining = skillRBareExplosionSphereShakeEndsAt - now;
      const shakeProgress = THREE.MathUtils.clamp(
        shakeRemaining / skillRBareExplosionSphereShakeDurationMs,
        0,
        1
      );
      const shakeAmplitude =
        skillRBareExplosionSphereShakeMagnitude * Math.pow(shakeProgress, 1.15);
      skillRBareExplosionSphereShakeOffset.set(
        (Math.sin(t * 67.3 + 0.8) + Math.sin(t * 123.7 + 1.4) * 0.5) * shakeAmplitude,
        (Math.cos(t * 91.4 + 0.3) + Math.sin(t * 141.1 + 2.2) * 0.4) *
          shakeAmplitude *
          0.7,
        (Math.sin(t * 79.8 + 1.2) + Math.cos(t * 117.5 + 0.6) * 0.45) * shakeAmplitude
      );
      skillRBareGroundDisk.position.add(skillRBareExplosionSphereShakeOffset);
    } else {
      skillRBareExplosionSphereShakeOffset.set(0, 0, 0);
    }
    skillRBareGroundRing.scale.setScalar(THREE.MathUtils.lerp(1.45, 5.35, chargeProgress));
    const expandingRingOrbitRadius = THREE.MathUtils.lerp(
      skillRBareExpandingRingOrbitRadius * 0.5,
      skillRBareExpandingRingOrbitRadius,
      chargeProgress
    );
    const expandingRingVerticalOrbit = THREE.MathUtils.lerp(
      skillRBareExpandingRingVerticalOrbitRadius * 0.4,
      skillRBareExpandingRingVerticalOrbitRadius,
      chargeProgress
    );
    const expandingRingOrbitAngleA = t * skillRBareExpandingRingOrbitSpeedA + 0.35;
    const expandingRingOrbitAngleB = t * skillRBareExpandingRingOrbitSpeedB + 1.2;
    skillRBareGroundRing.position.set(
      Math.cos(expandingRingOrbitAngleA) * expandingRingOrbitRadius,
      skillRBareExpandingRingBaseYOffset +
        Math.sin(expandingRingOrbitAngleB) * expandingRingVerticalOrbit,
      Math.sin(expandingRingOrbitAngleA * 0.67 + expandingRingOrbitAngleB * 0.41) *
        expandingRingOrbitRadius
    );
    const expandingRingSpinStep = Math.max(0, deltaSeconds);
    skillRBareGroundRing.rotation.x +=
      expandingRingSpinStep * skillRBareExpandingRingSpinSpeedX;
    skillRBareGroundRing.rotation.y +=
      expandingRingSpinStep * skillRBareExpandingRingSpinSpeedY;
    skillRBareGroundRing.rotation.z -=
      expandingRingSpinStep * skillRBareExpandingRingSpinSpeedZ;

    skillRBareCoreMaterial.emissiveIntensity = THREE.MathUtils.lerp(
      1.5,
      3.6,
      chargeProgress
    );
    skillRBareShellMaterial.opacity = THREE.MathUtils.lerp(0.24, 0.7, chargeProgress) * alpha;
    skillRBareWaistRingMaterial.opacity =
      THREE.MathUtils.lerp(0.3, 0.82, chargeProgress) * alpha;
    const explosionSphereOpacityBoost = 1 + burstEnergy * 0.7;
    skillRBareGroundDiskMaterial.opacity = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(0.28, 0.78, chargeProgress) *
        explosionSphereOpacityBoost *
        alpha,
      0,
      0.95
    );
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
      const orbitRadius = THREE.MathUtils.lerp(particle.baseRadius, 0.34, chargeProgress);
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

  const startBarePrimaryAttack = (now: number) => {
    if (!normalAttackBareBinding) return false;
    const started = playActionBinding(normalAttackBareBinding);
    if (!started) return false;

    const durationMs = Math.max(
      1,
      (normalAttackBareBinding.clip.duration * 1000) /
        Math.max(0.01, normalAttackBareSpeedMultiplier)
    );
    const chargeEndsAt = now + durationMs * normalAttackBareChargeEndProgress;
    const fireAt = now + durationMs * normalAttackBareProjectileFireProgress;
    const fullEndsAt = now + durationMs;
    const fullRecoveryDuration = Math.max(1, fullEndsAt - fireAt);
    const shortenedRecoveryDuration =
      fullRecoveryDuration * normalAttackBareRecoveryDurationScale;

    barePrimaryAttackState.active = true;
    barePrimaryAttackState.projectileFired = false;
    barePrimaryAttackState.startedAt = now;
    barePrimaryAttackState.chargeEndsAt = chargeEndsAt;
    barePrimaryAttackState.fireAt = fireAt;
    barePrimaryAttackState.endsAt = fireAt + shortenedRecoveryDuration;
    primaryAttackChargePulse = 0;
    setPrimaryAttackChargeVisible(true);
    return true;
  };

  const resetWeaponPrimaryAttackState = (stopAnimation = true) => {
    weaponPrimaryAttackState.active = false;
    weaponPrimaryAttackState.stageIndex = 0;
    weaponPrimaryAttackState.stageHitApplied = false;
    weaponPrimaryAttackState.stage3BackstepApplied = false;
    weaponPrimaryHitSampleValid = false;
    if (stopAnimation) {
      stopActionBinding(normalAttackWeaponBinding);
    } else if (normalAttackWeaponBinding) {
      const action = normalAttackWeaponBinding.action;
      action.enabled = true;
      action.paused = true;
      action.setEffectiveTimeScale(1);
    }
  };

  const resetWeaponPrimaryBackstepState = () => {
    weaponPrimaryBackstepState.active = false;
    weaponPrimaryBackstepState.plannedDistance = 0;
    weaponPrimaryBackstepState.appliedDistance = 0;
    weaponPrimaryBackstepState.elapsedMs = 0;
    weaponPrimaryBackstepState.durationMs = normalAttackWeaponThirdBackstepDurationMs;
  };

  const refreshWeaponColliderNodes = (avatarModel: THREE.Object3D | null) => {
    collectWeaponColliderNodes(avatarModel, weaponColliderNodes);
  };

  const resolveWeaponMeshColliderBounds = () => {
    weaponColliderWorldBounds.makeEmpty();
    if (!lastAvatarModel) return false;

    if (!weaponColliderNodes.length || weaponColliderNodes.some((node) => !node.parent)) {
      refreshWeaponColliderNodes(lastAvatarModel);
    }

    let hasBounds = false;
    for (let i = 0; i < weaponColliderNodes.length; i += 1) {
      const node = weaponColliderNodes[i];
      if (!node?.parent) continue;
      node.updateWorldMatrix(true, true);
      weaponColliderNodeBounds.setFromObject(node);
      if (weaponColliderNodeBounds.isEmpty()) continue;
      if (!hasBounds) {
        weaponColliderWorldBounds.copy(weaponColliderNodeBounds);
        hasBounds = true;
      } else {
        weaponColliderWorldBounds.union(weaponColliderNodeBounds);
      }
    }

    if (!hasBounds) return false;
    weaponColliderWorldBounds.expandByScalar(weaponMeshColliderBoundsPadding);
    return true;
  };

  const applyWeaponMeshColliderHits = ({
    now,
    damage,
    maxHits,
    hitTargetIds,
    onHitTargetResolved,
  }: {
    now: number;
    damage: number;
    maxHits?: number;
    hitTargetIds?: Set<string>;
    onHitTargetResolved?: (args: WeaponMeshColliderHitResolvedArgs) => void;
  }): WeaponMeshColliderResult => {
    if (!resolveWeaponMeshColliderBounds()) {
      return {
        hitCount: 0,
        hasCollider: false,
      };
    }

    const targets = getAttackTargets?.() ?? [];
    if (!targets.length) {
      return {
        hitCount: 0,
        hasCollider: true,
      };
    }

    const resolvedMaxHits = Number.isFinite(maxHits)
      ? Math.max(1, Math.floor(maxHits ?? 1))
      : Number.POSITIVE_INFINITY;

    weaponColliderWorldBounds.getCenter(weaponColliderCenter);
    let hitCount = 0;
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target?.object) continue;
      if (!target.object.parent) continue;
      if (target.isActive && !target.isActive()) continue;
      if (hitTargetIds?.has(target.id)) continue;

      target.object.updateWorldMatrix(true, true);
      weaponColliderTargetBounds.setFromObject(target.object);
      if (weaponColliderTargetBounds.isEmpty()) continue;
      if (!weaponColliderWorldBounds.intersectsBox(weaponColliderTargetBounds)) continue;

      weaponColliderIntersectionBounds
        .copy(weaponColliderWorldBounds)
        .intersect(weaponColliderTargetBounds);
      if (weaponColliderIntersectionBounds.isEmpty()) {
        weaponColliderTargetBounds.getCenter(weaponColliderHitPoint);
      } else {
        weaponColliderIntersectionBounds.getCenter(weaponColliderHitPoint);
      }

      weaponColliderHitDirection
        .copy(weaponColliderHitPoint)
        .sub(weaponColliderCenter);
      weaponColliderHitDirection.y = 0;
      if (weaponColliderHitDirection.lengthSq() <= 0.000001) {
        weaponColliderHitDirection.copy(runtimeAimDirection);
        weaponColliderHitDirection.y = 0;
      }
      if (weaponColliderHitDirection.lengthSq() <= 0.000001) {
        weaponColliderHitDirection.set(0, 0, 1).applyQuaternion(avatar.quaternion);
        weaponColliderHitDirection.y = 0;
      }
      if (weaponColliderHitDirection.lengthSq() <= 0.000001) {
        weaponColliderHitDirection.set(0, 0, 1);
      } else {
        weaponColliderHitDirection.normalize();
      }

      const hitPoint = weaponColliderHitPoint.clone();
      const hitDirection = weaponColliderHitDirection.clone();
      target.onHit({
        now,
        source: "slash",
        damage,
        point: hitPoint,
        direction: hitDirection,
      });
      hitTargetIds?.add(target.id);
      onHitTargetResolved?.({
        targetId: target.id,
        point: hitPoint,
        direction: hitDirection,
      });
      hitCount += 1;
      if (hitCount >= resolvedMaxHits) {
        break;
      }
    }

    return {
      hitCount,
      hasCollider: true,
    };
  };

  const sampleWeaponPrimaryHitPose = () => {
    const sourceNode =
      (weaponThrowSourceNode && weaponThrowSourceNode.parent
        ? weaponThrowSourceNode
        : findWeaponThrowSourceNode(lastAvatarModel)) ?? null;
    if (sourceNode && sourceNode.parent) {
      weaponThrowSourceNode = sourceNode;
      sourceNode.updateWorldMatrix(true, true);
      sourceNode.getWorldPosition(weaponPrimaryHitWorldPos);
      sourceNode.getWorldQuaternion(weaponPrimaryHitSourceQuat);
      return;
    }
    avatar.getWorldPosition(weaponPrimaryHitWorldPos);
    weaponPrimaryHitWorldPos.y += 1.08;
    avatar.getWorldQuaternion(weaponPrimaryHitSourceQuat);
  };

  const startWeaponPrimaryAttackCombo = () => {
    if (!normalAttackWeaponBinding) return false;
    const action = normalAttackWeaponBinding.action;
    const duration = Math.max(0.001, normalAttackWeaponBinding.clip.duration);
    const startupTrimProgress = THREE.MathUtils.clamp(
      normalAttackWeaponComboStages[0]?.startProgress ?? 0,
      0,
      0.95
    );
    const startupTrimTime = duration * startupTrimProgress;
    action.reset();
    action.enabled = true;
    action.paused = false;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.play();
    if (startupTrimTime > 0) {
      action.time = Math.min(duration - 1 / 240, startupTrimTime);
    }
    weaponPrimaryAttackState.active = true;
    weaponPrimaryAttackState.stageIndex = 0;
    weaponPrimaryAttackState.stageHitApplied = false;
    weaponPrimaryAttackState.stage3BackstepApplied = false;
    sampleWeaponPrimaryHitPose();
    weaponPrimaryHitPrevWorldPos.copy(weaponPrimaryHitWorldPos);
    weaponPrimaryHitSampleValid = true;
    return true;
  };

  const applyWeaponPrimaryThirdStageBackstep = () => {
    avatar.getWorldQuaternion(skillEWeaponThrowAvatarQuat);
    weaponPrimaryBackstepForward
      .set(0, 0, 1)
      .applyQuaternion(skillEWeaponThrowAvatarQuat);
    weaponPrimaryBackstepForward.y = 0;
    if (weaponPrimaryBackstepForward.lengthSq() <= 0.000001) {
      weaponPrimaryBackstepForward.set(0, 0, 1);
    } else {
      weaponPrimaryBackstepForward.normalize();
    }
    weaponPrimaryBackstepDirection.copy(weaponPrimaryBackstepForward).multiplyScalar(-1);

    const startX = avatar.position.x;
    const startZ = avatar.position.z;
    const step = Math.max(0.02, normalAttackWeaponBackstepStepDistance);
    let appliedDistance = 0;
    for (
      let d = step;
      d <= normalAttackWeaponThirdBackstepDistance + 0.0001;
      d += step
    ) {
      const sampleX = startX + weaponPrimaryBackstepDirection.x * d;
      const sampleZ = startZ + weaponPrimaryBackstepDirection.z * d;
      if (isOutsideRuntimeBounds(sampleX, sampleZ)) {
        break;
      }
      if (runtimeIsBlocked && runtimeIsBlocked(sampleX, sampleZ)) {
        break;
      }
      appliedDistance = d;
    }

    if (appliedDistance <= 0) {
      resetWeaponPrimaryBackstepState();
      return;
    }
    weaponPrimaryBackstepState.active = true;
    weaponPrimaryBackstepState.direction.copy(weaponPrimaryBackstepDirection);
    weaponPrimaryBackstepState.plannedDistance = appliedDistance;
    weaponPrimaryBackstepState.appliedDistance = 0;
    weaponPrimaryBackstepState.elapsedMs = 0;
    weaponPrimaryBackstepState.durationMs = Math.max(
      80,
      normalAttackWeaponThirdBackstepDurationMs
    );
  };

  const updateWeaponPrimaryBackstepState = (deltaSeconds: number) => {
    if (!weaponPrimaryBackstepState.active) return;
    const safeDelta = Math.max(0, deltaSeconds);
    if (safeDelta <= 0) return;

    const durationMs = Math.max(1, weaponPrimaryBackstepState.durationMs);
    const previousProgress = THREE.MathUtils.clamp(
      weaponPrimaryBackstepState.elapsedMs / durationMs,
      0,
      1
    );
    weaponPrimaryBackstepState.elapsedMs = Math.min(
      durationMs,
      weaponPrimaryBackstepState.elapsedMs + safeDelta * 1000
    );
    const nextProgress = THREE.MathUtils.clamp(
      weaponPrimaryBackstepState.elapsedMs / durationMs,
      0,
      1
    );
    const previousEase = 1 - Math.pow(1 - previousProgress, 2);
    const nextEase = 1 - Math.pow(1 - nextProgress, 2);
    let targetDelta =
      weaponPrimaryBackstepState.plannedDistance * (nextEase - previousEase);

    if (targetDelta <= 0.000001) {
      if (nextProgress >= 1) {
        resetWeaponPrimaryBackstepState();
      }
      return;
    }

    const stepUnit = Math.max(0.01, normalAttackWeaponBackstepStepDistance);
    while (targetDelta > 0.000001) {
      const remaining =
        weaponPrimaryBackstepState.plannedDistance -
        weaponPrimaryBackstepState.appliedDistance;
      if (remaining <= 0.000001) {
        resetWeaponPrimaryBackstepState();
        return;
      }

      const step = Math.min(targetDelta, stepUnit, remaining);
      const nextX =
        avatar.position.x + weaponPrimaryBackstepState.direction.x * step;
      const nextZ =
        avatar.position.z + weaponPrimaryBackstepState.direction.z * step;

      if (isOutsideRuntimeBounds(nextX, nextZ)) {
        resetWeaponPrimaryBackstepState();
        return;
      }
      if (runtimeIsBlocked && runtimeIsBlocked(nextX, nextZ)) {
        resetWeaponPrimaryBackstepState();
        return;
      }

      avatar.position.x = nextX;
      avatar.position.z = nextZ;
      weaponPrimaryBackstepState.appliedDistance += step;
      targetDelta -= step;
    }

    if (
      weaponPrimaryBackstepState.elapsedMs >= durationMs ||
      weaponPrimaryBackstepState.appliedDistance >=
        weaponPrimaryBackstepState.plannedDistance - 0.0001
    ) {
      resetWeaponPrimaryBackstepState();
    }
  };

  const performWeaponPrimaryAttackHit = (stageIndex: number, now: number) => {
    const resolvedStageIndex = Math.min(
      normalAttackWeaponStageDamage.length - 1,
      Math.max(0, Math.floor(stageIndex))
    );
    const gainResourcesFromStageHit = (hitCount: number) => {
      if (hitCount <= 0) return;
      applyMana?.(normalAttackWeaponStageManaGain[resolvedStageIndex] * hitCount);
      applyEnergy?.(normalAttackWeaponStageEnergyGain[resolvedStageIndex] * hitCount);
      if (
        resolvedStageIndex === normalAttackWeaponComboStages.length - 1
      ) {
        applyHealth?.(normalAttackWeaponFinalStageHeal);
      }
    };
    const hitTargetIds = new Set<string>();
    const meshHits = applyWeaponMeshColliderHits({
      now,
      damage: normalAttackWeaponStageDamage[resolvedStageIndex],
      maxHits: normalAttackWeaponAoEMaxHits,
      hitTargetIds,
    });
    let totalHitCount = Math.max(0, meshHits.hitCount);

    if (!performMeleeAttack) {
      if (totalHitCount > 0) {
        gainResourcesFromStageHit(totalHitCount);
        sampleWeaponPrimaryHitPose();
        weaponPrimaryHitPrevWorldPos.copy(weaponPrimaryHitWorldPos);
        weaponPrimaryHitSampleValid = true;
      }
      return totalHitCount;
    }

    sampleWeaponPrimaryHitPose();
    if (!weaponPrimaryHitSampleValid) {
      weaponPrimaryHitPrevWorldPos.copy(weaponPrimaryHitWorldPos);
      weaponPrimaryHitSampleValid = true;
      gainResourcesFromStageHit(totalHitCount);
      return totalHitCount;
    }

    weaponPrimaryHitTravel
      .copy(weaponPrimaryHitWorldPos)
      .sub(weaponPrimaryHitPrevWorldPos);
    let travelDistance = weaponPrimaryHitTravel.length();
    if (travelDistance > 0.0001) {
      weaponPrimaryHitDirection.copy(weaponPrimaryHitTravel).multiplyScalar(1 / travelDistance);
    } else {
      weaponPrimaryHitDirection.copy(runtimeAimDirection);
      weaponPrimaryHitDirection.y = 0;
      if (weaponPrimaryHitDirection.lengthSq() < 0.000001) {
        weaponPrimaryHitDirection
          .set(0, 0, 1)
          .applyQuaternion(weaponPrimaryHitSourceQuat);
        weaponPrimaryHitDirection.y = 0;
      }
      if (weaponPrimaryHitDirection.lengthSq() < 0.000001) {
        weaponPrimaryHitDirection.set(0, 0, 1);
      } else {
        weaponPrimaryHitDirection.normalize();
      }
      travelDistance = 0.06;
    }

    weaponPrimaryHitContactCenter
      .copy(weaponPrimaryHitWorldPos)
      .addScaledVector(
        weaponPrimaryHitDirection,
        normalAttackWeaponContactForwardOffset[resolvedStageIndex]
      );
    const remainingMaxHits = Math.max(0, normalAttackWeaponAoEMaxHits - totalHitCount);
    if (remainingMaxHits > 0) {
      const meleeHitCount = performMeleeAttack({
        damage: normalAttackWeaponStageDamage[resolvedStageIndex],
        maxDistance: Math.max(
          0.1,
          travelDistance + normalAttackWeaponContactForwardOffset[resolvedStageIndex]
        ),
        maxHits: remainingMaxHits,
        excludeTargetIds: hitTargetIds,
        origin: weaponPrimaryHitPrevWorldPos.clone(),
        direction: weaponPrimaryHitDirection.clone(),
        contactCenter: weaponPrimaryHitContactCenter.clone(),
        contactRadius: normalAttackWeaponContactRadius[resolvedStageIndex],
      });
      if (meleeHitCount > 0) {
        totalHitCount += meleeHitCount;
      }
    }
    gainResourcesFromStageHit(totalHitCount);
    weaponPrimaryHitPrevWorldPos.copy(weaponPrimaryHitWorldPos);
    return totalHitCount;
  };

  const updateWeaponPrimaryAttackState = (now: number) => {
    const binding = normalAttackWeaponBinding;
    if (!weaponEquipped || !binding || isSkillAnimationActive()) {
      if (weaponPrimaryAttackState.active) {
        resetWeaponPrimaryAttackState(true);
      }
      return;
    }

    if (!primaryAttackHeld) {
      if (weaponPrimaryAttackState.active) {
        resetWeaponPrimaryAttackState(false);
      }
      return;
    }

    if (!weaponPrimaryAttackState.active) {
      startWeaponPrimaryAttackCombo();
      return;
    }

    const stageCount = normalAttackWeaponComboStages.length;
    const duration = Math.max(0.001, binding.clip.duration);
    const action = binding.action;

    while (weaponPrimaryAttackState.stageIndex < stageCount) {
      const stageIndex = Math.min(
        stageCount - 1,
        Math.max(0, Math.floor(weaponPrimaryAttackState.stageIndex))
      );
      const stage = normalAttackWeaponComboStages[stageIndex];
      const stageStartTime = duration * stage.startProgress;
      const stageHitTime = duration * stage.hitProgress;
      const stageEndTime = duration * stage.endProgress;

      if (action.time < stageStartTime) {
        break;
      }

      if (!weaponPrimaryAttackState.stageHitApplied && action.time >= stageHitTime) {
        const hitCount = performWeaponPrimaryAttackHit(stageIndex, now);
        if (hitCount > 0) {
          weaponPrimaryAttackState.stageHitApplied = true;
        }
      }

      if (action.time >= stageEndTime) {
        if (!weaponPrimaryAttackState.stageHitApplied) {
          performWeaponPrimaryAttackHit(stageIndex, now);
        }
        weaponPrimaryAttackState.stageIndex = stageIndex + 1;
        weaponPrimaryAttackState.stageHitApplied = false;
        continue;
      }

      break;
    }

    const thirdStageBackstepTime = Math.max(
      0,
      duration * THREE.MathUtils.clamp(normalAttackWeaponThirdBackstepProgress, 0, 1) -
        normalAttackWeaponThirdBackstepAdvanceSeconds
    );
    if (
      weaponPrimaryAttackState.stageIndex >= stageCount &&
      !weaponPrimaryAttackState.stage3BackstepApplied &&
      action.time >= thirdStageBackstepTime
    ) {
      applyWeaponPrimaryThirdStageBackstep();
      weaponPrimaryAttackState.stage3BackstepApplied = true;
    }

    if (action.time < duration && action.isRunning()) {
      return;
    }

    startWeaponPrimaryAttackCombo();
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
      skillQBarePurcleTemplate = template.root;
      skillQBarePurcleTemplateClips = template.clips.slice();
    });
  };

  const disposeSkillQBarePurcleEntry = (entry: SkillQBarePurcleEntry) => {
    entry.enemyTarget.active = false;
    unregisterHarperEnemyTarget(entry.id);
    if (entry.mixer) {
      entry.mixer.stopAllAction();
      entry.mixer.uncacheRoot(entry.root);
    }
    entry.root.removeFromParent();
  };

  const disposeSkillQBareGateEntry = (entry: SkillQBareGateEntry) => {
    entry.enemyTarget.active = false;
    unregisterHarperEnemyTarget(entry.id);
    skillQBareGateEntryById.delete(entry.id);
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

  const isOutsideRuntimeBounds = (x: number, z: number, padding = 0) => {
    if (!runtimeBounds) return false;
    return (
      x < runtimeBounds.minX + padding ||
      x > runtimeBounds.maxX - padding ||
      z < runtimeBounds.minZ + padding ||
      z > runtimeBounds.maxZ - padding
    );
  };

  const isSpawnBlockedAt = (x: number, z: number) => {
    if (isOutsideRuntimeBounds(x, z, skillQBarePurcleSpawnBoundsPadding)) return true;
    if (!runtimeIsBlocked) return false;
    return runtimeIsBlocked(x, z);
  };

  const canSpawnSkillQBarePurcleAt = (
    gateWorldPos: THREE.Vector3,
    spawnWorldPos: THREE.Vector3,
    forwardWorld: THREE.Vector3
  ) => {
    if (isSpawnBlockedAt(spawnWorldPos.x, spawnWorldPos.z)) return false;
    skillQBarePurcleSpawnPerp.set(-forwardWorld.z, 0, forwardWorld.x);
    if (skillQBarePurcleSpawnPerp.lengthSq() < 0.000001) {
      skillQBarePurcleSpawnPerp.set(1, 0, 0);
    } else {
      skillQBarePurcleSpawnPerp.normalize();
    }
    const offsets = [
      [0, 0],
      [skillQBarePurcleSpawnCheckRadius, 0],
      [-skillQBarePurcleSpawnCheckRadius, 0],
      [0, skillQBarePurcleSpawnCheckRadius],
      [0, -skillQBarePurcleSpawnCheckRadius],
      [skillQBarePurcleSpawnCheckRadius * 0.72, skillQBarePurcleSpawnCheckRadius * 0.72],
      [skillQBarePurcleSpawnCheckRadius * 0.72, -skillQBarePurcleSpawnCheckRadius * 0.72],
      [-skillQBarePurcleSpawnCheckRadius * 0.72, skillQBarePurcleSpawnCheckRadius * 0.72],
      [-skillQBarePurcleSpawnCheckRadius * 0.72, -skillQBarePurcleSpawnCheckRadius * 0.72],
    ] as const;
    for (let i = 0; i < offsets.length; i += 1) {
      const [forwardOffset, sideOffset] = offsets[i];
      skillQBarePurcleSpawnSample
        .copy(spawnWorldPos)
        .addScaledVector(forwardWorld, forwardOffset)
        .addScaledVector(skillQBarePurcleSpawnPerp, sideOffset);
      if (isSpawnBlockedAt(skillQBarePurcleSpawnSample.x, skillQBarePurcleSpawnSample.z)) {
        return false;
      }
    }
    const segmentDx = spawnWorldPos.x - gateWorldPos.x;
    const segmentDz = spawnWorldPos.z - gateWorldPos.z;
    const segmentDistance = Math.hypot(segmentDx, segmentDz);
    if (segmentDistance <= 0.0001) return true;
    const segmentSteps = Math.max(2, Math.ceil(segmentDistance / skillQBarePurcleSpawnStep));
    for (let i = 1; i <= segmentSteps; i += 1) {
      const alpha = i / segmentSteps;
      const sampleX = gateWorldPos.x + segmentDx * alpha;
      const sampleZ = gateWorldPos.z + segmentDz * alpha;
      if (isSpawnBlockedAt(sampleX, sampleZ)) {
        return false;
      }
    }
    return true;
  };

  const setSkillQBarePurcleMotionState = (
    entry: SkillQBarePurcleEntry,
    nextState: SkillQBarePurcleMotionState
  ) => {
    if (entry.motionState === nextState) return;
    entry.motionState = nextState;
    switch (nextState) {
      case "walk":
        setActionWeight(entry.walkAction, 1);
        setActionWeight(entry.idleAction, 0);
        setActionWeight(entry.attackAction, 0);
        break;
      case "attack":
        setActionWeight(entry.walkAction, 0);
        setActionWeight(entry.idleAction, 0);
        break;
      default:
        setActionWeight(entry.walkAction, 0);
        setActionWeight(entry.idleAction, 1);
        setActionWeight(entry.attackAction, 0);
        break;
    }
  };

  const syncSkillQBareObjectToWorld = (
    object: THREE.Object3D,
    worldPos: THREE.Vector3
  ) => {
    const parent = object.parent;
    if (!parent) return;
    skillQBarePurcleSpawnLocalPos.copy(worldPos);
    parent.worldToLocal(skillQBarePurcleSpawnLocalPos);
    object.position.copy(skillQBarePurcleSpawnLocalPos);
    object.updateMatrixWorld(true);
  };

  const applySkillQBarePurcleGrounding = (
    entry: SkillQBarePurcleEntry,
    deltaSeconds: number
  ) => {
    const groundedWorldY = entry.groundY + entry.groundOffset;
    const safeDelta = Math.max(0, deltaSeconds);
    let currentWorldY = entry.worldPos.y;
    if (currentWorldY > groundedWorldY + 0.0001 || entry.verticalVelocity < -0.0001) {
      entry.verticalVelocity += skillQBarePurcleGravity * safeDelta;
      currentWorldY += entry.verticalVelocity * safeDelta;
      if (currentWorldY <= groundedWorldY) {
        currentWorldY = groundedWorldY;
        entry.verticalVelocity = 0;
      }
    } else {
      currentWorldY = groundedWorldY;
      entry.verticalVelocity = 0;
    }
    entry.worldPos.y = currentWorldY;
    syncSkillQBareObjectToWorld(entry.root, entry.worldPos);
  };

  const disposePurcleSmokeFxEntry = (entry: PurcleSmokeFxEntry) => {
    entry.root.removeFromParent();
    for (let i = 0; i < entry.particles.length; i += 1) {
      entry.particles[i].material.dispose();
    }
  };

  const clearPurcleSmokeFxState = () => {
    for (let i = purcleSmokeFxEntries.length - 1; i >= 0; i -= 1) {
      disposePurcleSmokeFxEntry(purcleSmokeFxEntries[i]);
    }
    purcleSmokeFxEntries.length = 0;
  };

  const spawnPurcleSmokeFx = (
    worldPos: THREE.Vector3,
    now: number,
    reason: PurcleSmokeReason
  ) => {
    const parent = avatar.parent ?? avatar;
    const root = new THREE.Group();
    root.name = "__harperPurcleSmoke";
    purcleSmokeLocalPos.copy(worldPos);
    parent.worldToLocal(purcleSmokeLocalPos);
    root.position.copy(purcleSmokeLocalPos);
    root.renderOrder = 14;
    parent.add(root);

    const particles: PurcleSmokeFxParticle[] = [];
    const baseColor =
      reason === "dead" ? 0x9333ea : reason === "expired" ? 0x6d28d9 : 0xc084fc;
    const durationScale = reason === "spawn" ? 0.88 : 1;
    const opacityScale = reason === "spawn" ? 0.85 : 1;
    for (let i = 0; i < purcleSmokeFxParticleCount; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(purcleSmokeParticleGeometry, material);
      mesh.renderOrder = 14;
      mesh.position.set(
        THREE.MathUtils.lerp(-0.22, 0.22, Math.random()),
        THREE.MathUtils.lerp(0.04, 0.22, Math.random()),
        THREE.MathUtils.lerp(-0.22, 0.22, Math.random())
      );
      purcleSmokeVelocityDirection.set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      );
      if (purcleSmokeVelocityDirection.lengthSq() < 0.000001) {
        purcleSmokeVelocityDirection.set(0, 1, 0);
      } else {
        purcleSmokeVelocityDirection.normalize();
      }
      const speed = THREE.MathUtils.lerp(
        purcleSmokeFxSpeedMin,
        purcleSmokeFxSpeedMax,
        Math.random()
      );
      const velocity = purcleSmokeVelocityDirection.multiplyScalar(speed);
      velocity.y += THREE.MathUtils.lerp(
        purcleSmokeFxRiseBoostMin,
        purcleSmokeFxRiseBoostMax,
        Math.random()
      );
      const particle: PurcleSmokeFxParticle = {
        mesh,
        material,
        velocity: velocity.clone(),
        spin: new THREE.Vector3(
          THREE.MathUtils.lerp(-4.2, 4.2, Math.random()),
          THREE.MathUtils.lerp(-4.2, 4.2, Math.random()),
          THREE.MathUtils.lerp(-4.2, 4.2, Math.random())
        ),
        startScale: THREE.MathUtils.lerp(0.42, 1.02, Math.random()),
        baseOpacity: THREE.MathUtils.lerp(0.4, 0.82, Math.random()) * opacityScale,
        phase: Math.random() * Math.PI * 2,
      };
      mesh.scale.setScalar(particle.startScale * 0.45);
      root.add(mesh);
      particles.push(particle);
    }

    purcleSmokeFxEntries.push({
      root,
      particles,
      startedAt: now,
      endsAt: now + purcleSmokeFxDurationMs * durationScale,
    });
    while (purcleSmokeFxEntries.length > purcleSmokeFxMaxActiveBursts) {
      const removed = purcleSmokeFxEntries.shift();
      if (removed) {
        disposePurcleSmokeFxEntry(removed);
      }
    }
  };

  const updatePurcleSmokeFx = (now: number, deltaSeconds: number) => {
    if (!purcleSmokeFxEntries.length) return;
    const safeDelta = Math.max(0, deltaSeconds);
    const drag = Math.exp(-2.35 * safeDelta);
    for (let i = purcleSmokeFxEntries.length - 1; i >= 0; i -= 1) {
      const entry = purcleSmokeFxEntries[i];
      const duration = Math.max(1, entry.endsAt - entry.startedAt);
      const progress = THREE.MathUtils.clamp((now - entry.startedAt) / duration, 0, 1);
      if (progress >= 1 || !entry.root.parent) {
        disposePurcleSmokeFxEntry(entry);
        purcleSmokeFxEntries.splice(i, 1);
        continue;
      }
      entry.root.position.y += safeDelta * 0.36;
      const fade = Math.pow(1 - progress, 1.5);
      for (let j = 0; j < entry.particles.length; j += 1) {
        const particle = entry.particles[j];
        purcleSmokeStep.copy(particle.velocity).multiplyScalar(safeDelta);
        particle.mesh.position.add(purcleSmokeStep);
        particle.velocity.multiplyScalar(drag);
        particle.velocity.y += safeDelta * 0.28;
        particle.mesh.rotation.x += particle.spin.x * safeDelta;
        particle.mesh.rotation.y += particle.spin.y * safeDelta;
        particle.mesh.rotation.z += particle.spin.z * safeDelta;
        const swell = 0.6 + progress * 1.55;
        particle.mesh.scale.setScalar(Math.max(0.01, particle.startScale * swell));
        particle.material.opacity = THREE.MathUtils.clamp(
          particle.baseOpacity *
            fade *
            (0.8 + Math.sin(now * 0.015 + particle.phase) * 0.2),
          0,
          0.9
        );
      }
    }
  };

  const startSkillQBarePurcleAttack = (entry: SkillQBarePurcleEntry, now: number) => {
    entry.attackActive = true;
    entry.attackHitApplied = false;
    entry.attackHitAt = now + entry.attackDurationMs * skillQBarePurcleAttackHitProgress;
    entry.attackEndsAt = now + entry.attackDurationMs;
    entry.nextAttackAt = now + Math.max(skillQBarePurcleAttackCooldownMs, entry.attackDurationMs);
    if (entry.attackAction) {
      entry.attackAction.reset();
      entry.attackAction.enabled = true;
      entry.attackAction.paused = false;
      entry.attackAction.setEffectiveTimeScale(1);
      entry.attackAction.setEffectiveWeight(1);
      entry.attackAction.play();
    }
    setSkillQBarePurcleMotionState(entry, "attack");
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
    const spawnAnchor = new THREE.Object3D();
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
    spawnAnchor.position.copy(portalFxRoot.position);
    root.add(spawnAnchor, portalFxRoot);
    const forwardWorld = new THREE.Vector3(
      Math.sin(pending.yaw),
      0,
      Math.cos(pending.yaw)
    ).normalize();
    const spawnedAt =
      typeof performance !== "undefined" ? performance.now() : pending.requestedAt;
    const id = `harper-gate-${++skillQBareGateIdCounter}`;
    const enemyTarget = createHarperEnemyTarget({
      id,
      object: root,
      spawnedAt,
      lifetimeMs: Number.POSITIVE_INFINITY,
      maxHealth: skillQBareGateMaxHealth,
    });
    collider.userData.harperGateTargetId = id;
    registerHarperEnemyTarget(enemyTarget);

    return {
      id,
      root,
      enemyTarget,
      collider,
      spawnAnchor,
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
    const root = SkeletonUtils.clone(skillQBarePurcleTemplate);
    root.scale.multiplyScalar(skillQBarePurcleScale);
    const worldPos = pending.worldPos.clone();
    parent.add(root);
    syncSkillQBareObjectToWorld(root, worldPos);
    root.rotation.y = Math.atan2(
      pending.directionWorld.x,
      pending.directionWorld.z
    );
    const spawnedAt = typeof performance !== "undefined" ? performance.now() : pending.requestedAt;
    let groundOffset = 0;
    const targetAnchor = new THREE.Object3D();
    targetAnchor.name = "__harperPurcleTargetAnchor";
    root.updateMatrixWorld(true);
    skillQBarePurcleBounds.setFromObject(root);
    if (!skillQBarePurcleBounds.isEmpty() && skillQBarePurcleBounds.min.y < pending.groundY) {
      worldPos.y += pending.groundY - skillQBarePurcleBounds.min.y;
      syncSkillQBareObjectToWorld(root, worldPos);
      skillQBarePurcleBounds.setFromObject(root);
    }
    if (!skillQBarePurcleBounds.isEmpty()) {
      groundOffset = worldPos.y - skillQBarePurcleBounds.min.y;
    }
    if (!skillQBarePurcleBounds.isEmpty()) {
      skillQBarePurcleBounds.getCenter(skillQBarePurcleBoundsCenter);
      skillQBarePurcleSpawnLocalPos.set(
        skillQBarePurcleBoundsCenter.x,
        skillQBarePurcleBounds.min.y,
        skillQBarePurcleBoundsCenter.z
      );
      root.worldToLocal(skillQBarePurcleSpawnLocalPos);
      targetAnchor.position.copy(skillQBarePurcleSpawnLocalPos);
    } else {
      targetAnchor.position.set(0, 0, 0);
    }
    let meleeHitHeight = 1.25;
    let meleeHitRadius = 0.72;
    if (!skillQBarePurcleBounds.isEmpty()) {
      skillQBarePurcleBounds.getSize(skillQBarePurcleBoundsSize);
      meleeHitHeight = THREE.MathUtils.clamp(
        skillQBarePurcleBoundsSize.y * 0.58,
        skillQBarePurcleMeleeHitHeightMin,
        skillQBarePurcleMeleeHitHeightMax
      );
      meleeHitRadius = THREE.MathUtils.clamp(
        Math.max(skillQBarePurcleBoundsSize.x, skillQBarePurcleBoundsSize.z) * 0.36,
        skillQBarePurcleMeleeHitRadiusMin,
        skillQBarePurcleMeleeHitRadiusMax
      );
    }
    const meleeHitUserData = targetAnchor.userData as {
      mochiGeneralMeleeHitHeight?: number;
      mochiGeneralMeleeHitRadius?: number;
      mochiGeneralMeleeHitBottom?: number;
      mochiGeneralMeleeHitTop?: number;
      mochiGeneralMeleeHitBoundsSource?: THREE.Object3D;
    };
    meleeHitUserData.mochiGeneralMeleeHitHeight = meleeHitHeight;
    meleeHitUserData.mochiGeneralMeleeHitRadius = meleeHitRadius;
    meleeHitUserData.mochiGeneralMeleeHitBottom = -0.08;
    meleeHitUserData.mochiGeneralMeleeHitTop = Math.max(
      meleeHitHeight + 0.72,
      1.95
    );
    // Use the animated purcle root as the melee bounds source so enemy melee checks
    // track the real body volume instead of a single anchor point.
    meleeHitUserData.mochiGeneralMeleeHitBoundsSource = root;
    root.add(targetAnchor);
    targetAnchor.updateMatrixWorld(true);
    const id = `harper-purcle-${++skillQBarePurcleIdCounter}`;
    const enemyTarget = createHarperEnemyTarget({
      id,
      object: targetAnchor,
      spawnedAt,
      lifetimeMs: skillQBarePurcleLifetimeMs,
      maxHealth: skillQBarePurcleMaxHealth,
    });
    registerHarperEnemyTarget(enemyTarget);
    let mixer: THREE.AnimationMixer | null = null;
    let idleAction: THREE.AnimationAction | null = null;
    let walkAction: THREE.AnimationAction | null = null;
    let attackAction: THREE.AnimationAction | null = null;
    let attackDurationMs = 860;
    if (skillQBarePurcleTemplateClips.length > 0) {
      mixer = new THREE.AnimationMixer(root);
      const idleClip = resolveClipByPatterns(skillQBarePurcleTemplateClips, [
        /^idlebare$/i,
        /^idle$/i,
        /idle/i,
      ]);
      const walkClip = resolveClipByPatterns(skillQBarePurcleTemplateClips, [
        /^walk$/i,
        /walk/i,
      ]);
      const attackClip = resolveClipByPatterns(skillQBarePurcleTemplateClips, [
        /^attack$/i,
        /normalattack/i,
        /attack/i,
      ]);
      if (idleClip) {
        idleAction = mixer.clipAction(idleClip);
        idleAction.setLoop(THREE.LoopRepeat, Infinity);
        idleAction.clampWhenFinished = false;
        idleAction.enabled = true;
        idleAction.paused = false;
        idleAction.setEffectiveWeight(1);
        idleAction.play();
      }
      if (walkClip) {
        walkAction = mixer.clipAction(walkClip);
        walkAction.setLoop(THREE.LoopRepeat, Infinity);
        walkAction.clampWhenFinished = false;
        walkAction.enabled = true;
        walkAction.paused = false;
        walkAction.setEffectiveWeight(0);
        walkAction.play();
      }
      if (attackClip) {
        attackAction = mixer.clipAction(attackClip);
        attackAction.setLoop(THREE.LoopOnce, 1);
        attackAction.clampWhenFinished = true;
        attackAction.enabled = true;
        attackAction.paused = true;
        attackAction.setEffectiveWeight(0);
        attackDurationMs = Math.max(420, attackClip.duration * 1000);
      }
    }
    const entry: SkillQBarePurcleEntry = {
      id,
      root,
      targetAnchor,
      enemyTarget,
      worldPos,
      mixer,
      idleAction,
      walkAction,
      attackAction,
      handL: root.getObjectByName("HandL"),
      handR: root.getObjectByName("HandR"),
      groundY: pending.groundY,
      groundOffset,
      verticalVelocity: 0,
      motionState: "idle",
      attackActive: false,
      attackHitApplied: false,
      attackHitAt: 0,
      attackEndsAt: 0,
      nextAttackAt: spawnedAt + 300,
      attackDurationMs,
      speed: skillQBarePurcleMoveSpeed,
    };
    setSkillQBarePurcleMotionState(entry, "idle");
    spawnPurcleSmokeFx(entry.worldPos, spawnedAt, "spawn");
    return entry;
  };

  const spawnPendingSkillQBareGates = () => {
    if (!skillQBareGateTemplate || !skillQBareGatePendingSummons.length) return;
    while (skillQBareGatePendingSummons.length > 0) {
      const pending = skillQBareGatePendingSummons.shift();
      if (!pending) break;
      const entry = createSkillQBareGateEntry(pending);
      if (!entry) continue;
      skillQBareGateActiveEntries.push(entry);
      skillQBareGateEntryById.set(entry.id, entry);
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
    directionWorld: THREE.Vector3,
    groundYValue: number,
    requestedAt: number
  ) => {
    if (directionWorld.lengthSq() < 0.000001) return;
    skillQBarePurclePendingSummons.push({
      worldPos: worldPos.clone(),
      directionWorld: directionWorld.clone().normalize(),
      groundY: groundYValue,
      requestedAt,
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
    skillQBareGateEntryById.clear();
    for (let i = skillQBarePurcleEntries.length - 1; i >= 0; i -= 1) {
      disposeSkillQBarePurcleEntry(skillQBarePurcleEntries[i]);
    }
    skillQBarePurcleEntries.length = 0;
  };

  const resolveSkillQBareGateEntryFromBlocker = (
    object: THREE.Object3D | null | undefined
  ) => {
    let current = object;
    while (current) {
      const targetId = (current.userData as { harperGateTargetId?: unknown })
        .harperGateTargetId;
      if (typeof targetId === "string") {
        return skillQBareGateEntryById.get(targetId) ?? null;
      }
      current = current.parent;
    }
    return null;
  };

  const handleRuntimeProjectileBlockHit = (
    args: Parameters<NonNullable<typeof baseRuntime.handleProjectileBlockHit>>[0]
  ) => {
    const gateEntry = resolveSkillQBareGateEntryFromBlocker(args.blockerHit.object);
    if (gateEntry && isHarperEnemyTargetAlive(gateEntry.enemyTarget, args.now)) {
      const damageValue = (args.projectile as { damage?: unknown }).damage;
      if (typeof damageValue === "number" && Number.isFinite(damageValue) && damageValue > 0) {
        applyDamageToHarperEnemyTarget(
          gateEntry.enemyTarget,
          Math.max(1, Math.round(damageValue))
        );
        if (!isHarperEnemyTargetAlive(gateEntry.enemyTarget, args.now)) {
          const index = skillQBareGateActiveEntries.indexOf(gateEntry);
          if (index >= 0) {
            disposeSkillQBareGateEntry(gateEntry);
            skillQBareGateActiveEntries.splice(index, 1);
          }
        }
      }
      // Treat gate collider as a real hit surface: projectile is consumed here.
      return false;
    }
    return baseRuntime.handleProjectileBlockHit?.(args) ?? false;
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

  const requestSkillRWeaponPurcleSummon = (now: number) => {
    avatar.getWorldPosition(skillRWeaponPurcleCenterWorldPos);
    skillRWeaponPurcleCenterWorldPos.y = runtimeGroundY;
    skillRWeaponPurcleForward.copy(runtimeAimDirection);
    skillRWeaponPurcleForward.y = 0;
    if (skillRWeaponPurcleForward.lengthSq() < 0.000001) {
      skillRWeaponPurcleForward
        .set(0, 0, 1)
        .applyQuaternion(avatar.quaternion);
      skillRWeaponPurcleForward.y = 0;
    }
    if (skillRWeaponPurcleForward.lengthSq() < 0.000001) {
      skillRWeaponPurcleForward.set(0, 0, 1);
    } else {
      skillRWeaponPurcleForward.normalize();
    }
    const summonedPositions: THREE.Vector3[] = [];
    const maxAttempts =
      skillRWeaponPurcleSummonCount * skillRWeaponPurcleSummonAttemptsPerUnit;
    const minSeparationSq =
      skillRWeaponPurcleMinSeparation * skillRWeaponPurcleMinSeparation;
    for (
      let attempt = 0;
      attempt < maxAttempts && summonedPositions.length < skillRWeaponPurcleSummonCount;
      attempt += 1
    ) {
      const angle = Math.random() * Math.PI * 2;
      const radius = THREE.MathUtils.lerp(
        skillRWeaponPurcleSummonMinRadius,
        skillRWeaponPurcleSummonRadius,
        Math.sqrt(Math.random())
      );
      skillRWeaponPurcleCandidateWorldPos.copy(skillRWeaponPurcleCenterWorldPos);
      skillRWeaponPurcleCandidateWorldPos.x += Math.cos(angle) * radius;
      skillRWeaponPurcleCandidateWorldPos.z += Math.sin(angle) * radius;
      skillRWeaponPurcleDirection
        .copy(skillRWeaponPurcleCandidateWorldPos)
        .sub(skillRWeaponPurcleCenterWorldPos);
      skillRWeaponPurcleDirection.y = 0;
      if (skillRWeaponPurcleDirection.lengthSq() < 0.000001) {
        skillRWeaponPurcleDirection.copy(skillRWeaponPurcleForward);
      } else {
        skillRWeaponPurcleDirection.normalize();
      }
      let blockedByNeighbor = false;
      for (let i = 0; i < summonedPositions.length; i += 1) {
        if (
          summonedPositions[i].distanceToSquared(skillRWeaponPurcleCandidateWorldPos) <
          minSeparationSq
        ) {
          blockedByNeighbor = true;
          break;
        }
      }
      if (blockedByNeighbor) continue;
      if (
        !canSpawnSkillQBarePurcleAt(
          skillRWeaponPurcleCenterWorldPos,
          skillRWeaponPurcleCandidateWorldPos,
          skillRWeaponPurcleDirection
        )
      ) {
        continue;
      }
      const acceptedPos = skillRWeaponPurcleCandidateWorldPos.clone();
      summonedPositions.push(acceptedPos);
      queueSkillQBarePurcleSpawn(
        acceptedPos,
        skillRWeaponPurcleDirection,
        runtimeGroundY,
        now
      );
    }
  };

  const updateSkillRWeaponState = (now: number) => {
    const isWeaponSkillRRunning = Boolean(
      weaponEquipped &&
        skillRWeaponBinding &&
        activeSkillBinding === skillRWeaponBinding &&
        skillRWeaponBinding.action.isRunning()
    );
    if (!isWeaponSkillRRunning) {
      skillRWeaponPurcleSummonedInCast = false;
      return;
    }
    if (skillRWeaponPurcleSummonedInCast) return;
    const duration = Math.max(0.001, skillRWeaponBinding?.clip.duration ?? 0.001);
    const progress = THREE.MathUtils.clamp(
      (skillRWeaponBinding?.action.time ?? 0) / duration,
      0,
      1
    );
    if (progress < skillRWeaponPurcleSummonProgress) return;
    skillRWeaponPurcleSummonedInCast = true;
    requestSkillRWeaponPurcleSummon(now);
  };

  const updateSkillQBareGates = (now: number, deltaSeconds: number) => {
    spawnPendingSkillQBareGates();
    spawnPendingSkillQBarePurcles();
    const safeDelta = Math.max(0, deltaSeconds);
    updatePurcleSmokeFx(now, safeDelta);
    if (skillQBareGateActiveEntries.length > 0) {
    for (let i = skillQBareGateActiveEntries.length - 1; i >= 0; i -= 1) {
      const entry = skillQBareGateActiveEntries[i];
      if (!entry.root.parent) {
        disposeSkillQBareGateEntry(entry);
        skillQBareGateActiveEntries.splice(i, 1);
        continue;
      }
      if (!isHarperEnemyTargetAlive(entry.enemyTarget, now)) {
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
        entry.spawnAnchor.getWorldPosition(skillQBarePurcleGateWorldPos);
        skillQBarePurcleTargetWorldPos
          .copy(skillQBarePurcleGateWorldPos)
          .addScaledVector(entry.forwardWorld, skillQBarePurcleSpawnForwardOffset);
        while (now >= entry.nextPurcleSpawnAt) {
          if (
            canSpawnSkillQBarePurcleAt(
              skillQBarePurcleGateWorldPos,
              skillQBarePurcleTargetWorldPos,
              entry.forwardWorld
            )
          ) {
            queueSkillQBarePurcleSpawn(
              skillQBarePurcleTargetWorldPos,
              entry.forwardWorld,
              runtimeGroundY,
              now
            );
          }
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
      if (!isHarperEnemyTargetAlive(entry.enemyTarget, now)) {
        const smokeReason: PurcleSmokeReason | null =
          entry.enemyTarget.health <= 0
            ? "dead"
            : now >= entry.enemyTarget.expiresAt
            ? "expired"
            : null;
        if (smokeReason) {
          entry.targetAnchor.getWorldPosition(skillQBarePurcleSpawnSample);
          spawnPurcleSmokeFx(skillQBarePurcleSpawnSample, now, smokeReason);
        }
        disposeSkillQBarePurcleEntry(entry);
        skillQBarePurcleEntries.splice(i, 1);
        continue;
      }
      entry.mixer?.update(safeDelta);
      entry.root.getWorldPosition(entry.worldPos);
      skillQBarePurcleWorldPos.copy(entry.worldPos);
      let nearestTarget: (typeof targets)[number] | null = null;
      let bestDistanceSq = searchRadiusSq;
      for (let j = 0; j < targets.length; j += 1) {
        const target = targets[j];
        if (!target?.object) continue;
        if (!target.object.parent) continue;
        if (target.isActive && !target.isActive()) continue;
        target.object.getWorldPosition(skillQBarePurcleNextWorldPos);
        const dx = skillQBarePurcleNextWorldPos.x - skillQBarePurcleWorldPos.x;
        const dz = skillQBarePurcleNextWorldPos.z - skillQBarePurcleWorldPos.z;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq >= bestDistanceSq) continue;
        bestDistanceSq = distanceSq;
        nearestTarget = target;
        skillQBarePurcleAttackTargetWorldPos.copy(skillQBarePurcleNextWorldPos);
      }
      if (!nearestTarget) {
        entry.attackActive = false;
        setSkillQBarePurcleMotionState(entry, "idle");
        applySkillQBarePurcleGrounding(entry, safeDelta);
        continue;
      }

      skillQBarePurcleAttackDirection
        .copy(skillQBarePurcleAttackTargetWorldPos)
        .sub(skillQBarePurcleWorldPos);
      skillQBarePurcleAttackDirection.y = 0;
      const targetDistance = skillQBarePurcleAttackDirection.length();
      const lockFacingDuringAttackLaunch =
        entry.attackActive && now >= entry.attackHitAt;
      if (lockFacingDuringAttackLaunch) {
        // Once the fist launch/hit phase starts, keep a fixed attack direction.
        skillQBarePurcleFallbackForward
          .set(0, 0, 1)
          .applyQuaternion(entry.root.quaternion);
        skillQBarePurcleAttackDirection.copy(skillQBarePurcleFallbackForward).setY(0);
        if (skillQBarePurcleAttackDirection.lengthSq() > 0.000001) {
          skillQBarePurcleAttackDirection.normalize();
        } else {
          skillQBarePurcleAttackDirection.set(0, 0, 1);
        }
      } else if (targetDistance > 0.0001) {
        skillQBarePurcleAttackDirection.multiplyScalar(1 / targetDistance);
        entry.root.rotation.y = Math.atan2(
          skillQBarePurcleAttackDirection.x,
          skillQBarePurcleAttackDirection.z
        );
      } else {
        skillQBarePurcleFallbackForward
          .set(0, 0, 1)
          .applyQuaternion(entry.root.quaternion);
        skillQBarePurcleAttackDirection.copy(skillQBarePurcleFallbackForward).setY(0);
        if (skillQBarePurcleAttackDirection.lengthSq() > 0.000001) {
          skillQBarePurcleAttackDirection.normalize();
        } else {
          skillQBarePurcleAttackDirection.set(0, 0, 1);
        }
      }

      if (entry.attackActive) {
        if (!entry.attackHitApplied && now >= entry.attackHitAt) {
          const rewardPurcleHit = (hitCount: number) => {
            if (hitCount <= 0) return;
            applyMana?.(skillQBarePurcleHitManaGain * hitCount);
            applyEnergy?.(skillQBarePurcleHitEnergyGain * hitCount);
          };
          const hitFromFist = (fist: THREE.Object3D | null) => {
            if (!fist) return 0;
            fist.getWorldPosition(skillQBarePurcleFistWorldPos);
            skillQBarePurcleAttackOrigin
              .copy(skillQBarePurcleFistWorldPos)
              .addScaledVector(skillQBarePurcleAttackDirection, -0.08);
            if (performMeleeAttack) {
              const hitCount = performMeleeAttack({
                damage: skillQBarePurcleAttackDamage,
                maxDistance: skillQBarePurcleAttackReach,
                hitRadius: skillQBarePurcleAttackHitRadius,
                maxHits: 1,
                origin: skillQBarePurcleAttackOrigin.clone(),
                direction: skillQBarePurcleAttackDirection.clone(),
              });
              rewardPurcleHit(hitCount);
              return hitCount;
            }
            nearestTarget.onHit({
              now,
              source: "slash",
              damage: skillQBarePurcleAttackDamage,
              point: skillQBarePurcleAttackOrigin.clone(),
              direction: skillQBarePurcleAttackDirection.clone(),
            });
            rewardPurcleHit(1);
            return 1;
          };
          const rightHits = hitFromFist(entry.handR);
          const leftHits = rightHits > 0 ? 0 : hitFromFist(entry.handL);
          if (rightHits <= 0 && leftHits <= 0) {
            skillQBarePurcleAttackOrigin
              .copy(skillQBarePurcleWorldPos)
              .addScaledVector(skillQBarePurcleAttackDirection, 0.66);
            if (performMeleeAttack) {
              const hitCount = performMeleeAttack({
                damage: skillQBarePurcleAttackDamage,
                maxDistance: skillQBarePurcleAttackReach,
                hitRadius: skillQBarePurcleAttackHitRadius * 1.05,
                maxHits: 1,
                origin: skillQBarePurcleAttackOrigin.clone(),
                direction: skillQBarePurcleAttackDirection.clone(),
              });
              rewardPurcleHit(hitCount);
            } else {
              nearestTarget.onHit({
                now,
                source: "slash",
                damage: skillQBarePurcleAttackDamage,
                point: skillQBarePurcleAttackOrigin.clone(),
                direction: skillQBarePurcleAttackDirection.clone(),
              });
              rewardPurcleHit(1);
            }
          }
          entry.attackHitApplied = true;
        }
        if (now >= entry.attackEndsAt) {
          entry.attackActive = false;
          setSkillQBarePurcleMotionState(entry, "idle");
        }
        applySkillQBarePurcleGrounding(entry, safeDelta);
        continue;
      }

      if (targetDistance <= skillQBarePurcleAttackRange && now >= entry.nextAttackAt) {
        startSkillQBarePurcleAttack(entry, now);
        applySkillQBarePurcleGrounding(entry, safeDelta);
        continue;
      }

      if (targetDistance > skillQBarePurcleAttackRange) {
        setSkillQBarePurcleMotionState(entry, "walk");
        const moveDistance = Math.min(targetDistance, entry.speed * safeDelta);
        entry.worldPos.addScaledVector(
          skillQBarePurcleAttackDirection,
          moveDistance
        );
        syncSkillQBareObjectToWorld(entry.root, entry.worldPos);
      } else {
        setSkillQBarePurcleMotionState(entry, "idle");
      }
      applySkillQBarePurcleGrounding(entry, safeDelta);
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

  const resetSkillQWeaponExplosionState = () => {
    skillQWeaponExplosionState.active = false;
    skillQWeaponExplosionState.hasWeaponSample = false;
    skillQWeaponExplosionState.previousSampleAt = 0;
    skillQWeaponExplosionState.swingActiveUntil = 0;
    skillQWeaponExplosionState.hitTargetIds.clear();
  };

  const sampleSkillQWeaponHitPose = () => {
    const sourceNode =
      (weaponThrowSourceNode && weaponThrowSourceNode.parent
        ? weaponThrowSourceNode
        : findWeaponThrowSourceNode(lastAvatarModel)) ?? null;
    if (sourceNode && sourceNode.parent) {
      weaponThrowSourceNode = sourceNode;
      sourceNode.updateWorldMatrix(true, true);
      sourceNode.getWorldPosition(skillQWeaponHitWorldPos);
      sourceNode.getWorldQuaternion(skillQWeaponHitSourceQuat);
      return;
    }
    avatar.getWorldPosition(skillQWeaponHitWorldPos);
    skillQWeaponHitWorldPos.y += 1.08;
    avatar.getWorldQuaternion(skillQWeaponHitSourceQuat);
  };

  const triggerSkillQWeaponHitExplosion = (
    now: number,
    point: THREE.Vector3,
    direction: THREE.Vector3
  ) => {
    spawnSkillEWeaponExplosionFx(now, point);
    applySkillEWeaponExplosionAreaDamage(
      now,
      point,
      skillEWeaponProjectileExplosionDamage,
      direction
    );
  };

  const updateSkillQWeaponState = (now: number) => {
    const isWeaponSkillQRunning = Boolean(
      weaponEquipped &&
        skillQWeaponBinding &&
        activeSkillBinding === skillQWeaponBinding &&
        skillQWeaponBinding.action.isRunning()
    );
    if (!isWeaponSkillQRunning) {
      resetSkillQWeaponExplosionState();
      return;
    }

    if (!skillQWeaponExplosionState.active) {
      skillQWeaponExplosionState.active = true;
      skillQWeaponExplosionState.hasWeaponSample = false;
      skillQWeaponExplosionState.previousSampleAt = 0;
      skillQWeaponExplosionState.swingActiveUntil = 0;
      skillQWeaponExplosionState.hitTargetIds.clear();
    }

    const duration = Math.max(0.001, skillQWeaponBinding?.clip.duration ?? 0.001);
    const progress = THREE.MathUtils.clamp(
      (skillQWeaponBinding?.action.time ?? 0) / duration,
      0,
      1
    );
    if (
      progress < skillQWeaponExplosionTriggerStartProgress ||
      progress > skillQWeaponExplosionTriggerEndProgress
    ) {
      skillQWeaponExplosionState.hasWeaponSample = false;
      skillQWeaponExplosionState.previousSampleAt = 0;
      skillQWeaponExplosionState.swingActiveUntil = 0;
      return;
    }

    sampleSkillQWeaponHitPose();
    const hadPreviousSample = skillQWeaponExplosionState.hasWeaponSample;
    if (!hadPreviousSample) {
      skillQWeaponHitPrevWorldPos.copy(skillQWeaponHitWorldPos);
      skillQWeaponExplosionState.hasWeaponSample = true;
      skillQWeaponExplosionState.previousSampleAt = now;
      skillQWeaponExplosionState.swingActiveUntil = 0;
      return;
    }

    const sampleDeltaMs = Math.max(
      1,
      now - skillQWeaponExplosionState.previousSampleAt
    );
    const sampleTravel = skillQWeaponHitWorldPos.distanceTo(skillQWeaponHitPrevWorldPos);
    const sampleSpeed = sampleTravel / (sampleDeltaMs / 1000);
    if (sampleSpeed >= skillQWeaponSwingMinSpeed) {
      skillQWeaponExplosionState.swingActiveUntil = now + skillQWeaponSwingPersistMs;
    }
    const isSwingActive = now <= skillQWeaponExplosionState.swingActiveUntil;
    if (!isSwingActive) {
      skillQWeaponHitPrevWorldPos.copy(skillQWeaponHitWorldPos);
      skillQWeaponExplosionState.previousSampleAt = now;
      return;
    }

    const meshColliderResult = applyWeaponMeshColliderHits({
      now,
      damage: skillQWeaponColliderDamage,
      maxHits: skillQWeaponExplosionSweepMaxHits,
      hitTargetIds: skillQWeaponExplosionState.hitTargetIds,
      onHitTargetResolved: ({ point, direction }) => {
        triggerSkillQWeaponHitExplosion(now, point, direction);
      },
    });
    if (meshColliderResult.hasCollider) {
      skillQWeaponHitPrevWorldPos.copy(skillQWeaponHitWorldPos);
      skillQWeaponExplosionState.previousSampleAt = now;
      return;
    }

    if (!hadPreviousSample) {
      skillQWeaponExplosionState.previousSampleAt = now;
      return;
    }

    skillQWeaponHitTravel.copy(skillQWeaponHitWorldPos).sub(skillQWeaponHitPrevWorldPos);
    let travelDistance = skillQWeaponHitTravel.length();
    if (travelDistance > 0.0001) {
      skillQWeaponHitDirection.copy(skillQWeaponHitTravel).multiplyScalar(1 / travelDistance);
    } else {
      skillQWeaponHitDirection.copy(runtimeAimDirection);
      skillQWeaponHitDirection.y = 0;
      if (skillQWeaponHitDirection.lengthSq() < 0.000001) {
        skillQWeaponHitDirection
          .set(0, 0, 1)
          .applyQuaternion(skillQWeaponHitSourceQuat);
        skillQWeaponHitDirection.y = 0;
      }
      if (skillQWeaponHitDirection.lengthSq() < 0.000001) {
        skillQWeaponHitDirection.set(0, 0, 1);
      } else {
        skillQWeaponHitDirection.normalize();
      }
      travelDistance = skillQWeaponContactMinTravel;
    }

    skillQWeaponHitContactCenter
      .copy(skillQWeaponHitWorldPos)
      .addScaledVector(skillQWeaponHitDirection, skillQWeaponContactForwardOffset);

    if (performMeleeAttack) {
      performMeleeAttack({
        damage: skillQWeaponColliderDamage,
        maxDistance: Math.max(
          skillQWeaponContactMinTravel,
          travelDistance + skillQWeaponContactForwardOffset
        ),
        maxHits: skillQWeaponExplosionSweepMaxHits,
        origin: skillQWeaponHitPrevWorldPos.clone(),
        direction: skillQWeaponHitDirection.clone(),
        contactCenter: skillQWeaponHitContactCenter.clone(),
        contactRadius: skillQWeaponContactRadius,
        excludeTargetIds: skillQWeaponExplosionState.hitTargetIds,
        onHitTarget: (targetId) => {
          skillQWeaponExplosionState.hitTargetIds.add(targetId);
        },
        onHitTargetResolved: ({ point, direction: hitDirection }) => {
          triggerSkillQWeaponHitExplosion(now, point, hitDirection);
        },
      });
    } else {
      const targets = getAttackTargets?.() ?? [];
      const contactRadiusSq = skillQWeaponContactRadius * skillQWeaponContactRadius;
      for (let i = 0; i < targets.length; i += 1) {
        const target = targets[i];
        if (!target?.object) continue;
        if (!target.object.parent) continue;
        if (target.isActive && !target.isActive()) continue;
        if (skillQWeaponExplosionState.hitTargetIds.has(target.id)) continue;
        skillQWeaponFallbackBounds.setFromObject(target.object);
        if (skillQWeaponFallbackBounds.isEmpty()) continue;
        skillQWeaponFallbackBounds.clampPoint(
          skillQWeaponHitContactCenter,
          skillQWeaponFallbackClosestPoint
        );
        if (
          skillQWeaponFallbackClosestPoint.distanceToSquared(skillQWeaponHitContactCenter) >
          contactRadiusSq
        ) {
          continue;
        }
        skillQWeaponFallbackDirection
          .copy(skillQWeaponFallbackClosestPoint)
          .sub(skillQWeaponHitContactCenter);
        if (skillQWeaponFallbackDirection.lengthSq() > 0.000001) {
          skillQWeaponFallbackDirection.normalize();
        } else {
          skillQWeaponFallbackDirection.copy(skillQWeaponHitDirection);
        }
        target.onHit({
          now,
          source: "slash",
          damage: skillQWeaponColliderDamage,
          point: skillQWeaponFallbackClosestPoint.clone(),
          direction: skillQWeaponFallbackDirection.clone(),
        });
        skillQWeaponExplosionState.hitTargetIds.add(target.id);
        triggerSkillQWeaponHitExplosion(
          now,
          skillQWeaponFallbackClosestPoint,
          skillQWeaponFallbackDirection
        );
      }
    }

    skillQWeaponHitPrevWorldPos.copy(skillQWeaponHitWorldPos);
    skillQWeaponExplosionState.previousSampleAt = now;
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
    const damage = Math.max(
      1,
      Math.round(
        (normalAttackBareDamageBase + speed * normalAttackBareDamagePerSpeed) *
          normalAttackBareDamageMultiplier
      )
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
      damage,
      lifetime: normalAttackBareProjectileLifetime,
      radius: normalAttackBareProjectileRadius,
      targetHitRadius: normalAttackBareProjectileRadius * 1.18,
      grantEnergyOnTargetHit: false,
      grantManaOnTargetHit: true,
      manaGainOnHit: normalAttackBareHitManaGain,
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

  const disposeSkillEWeaponExplosionFxEntry = (
    entry: SkillEWeaponExplosionFxEntry
  ) => {
    entry.root.removeFromParent();
    entry.coreMaterial.dispose();
    entry.shellMaterial.dispose();
    entry.voidShellMaterial.dispose();
    entry.ringOuterMaterial.dispose();
    entry.ringInnerMaterial.dispose();
    entry.pulseRingMaterial.dispose();
    entry.shockDiskMaterial.dispose();
    entry.particleMaterial.dispose();
  };

  const clearSkillEWeaponExplosionFxState = () => {
    for (let i = skillEWeaponExplosionFxEntries.length - 1; i >= 0; i -= 1) {
      disposeSkillEWeaponExplosionFxEntry(skillEWeaponExplosionFxEntries[i]);
    }
    skillEWeaponExplosionFxEntries.length = 0;
  };

  const spawnSkillEWeaponExplosionFx = (now: number, point: THREE.Vector3) => {
    const host = avatar.parent ?? avatar;
    if (skillEWeaponExplosionFxEntries.length >= skillEWeaponExplosionMaxActiveCount) {
      const removed = skillEWeaponExplosionFxEntries.shift();
      if (removed) {
        disposeSkillEWeaponExplosionFxEntry(removed);
      }
    }

    const root = new THREE.Group();
    root.position.copy(point);
    root.renderOrder = 12;
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xf3e8ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.64,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const voidShellMaterial = new THREE.MeshBasicMaterial({
      color: 0x120018,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ringOuterMaterial = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ringInnerMaterial = new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pulseRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x14001e,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const shockDiskMaterial = new THREE.MeshBasicMaterial({
      color: 0x581c87,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xe9d5ff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(skillEWeaponExplosionCoreGeometry, coreMaterial);
    const shell = new THREE.Mesh(skillEWeaponExplosionShellGeometry, shellMaterial);
    const voidShell = new THREE.Mesh(
      skillEWeaponExplosionShellGeometry,
      voidShellMaterial
    );
    const ringOuter = new THREE.Mesh(
      skillEWeaponExplosionRingOuterGeometry,
      ringOuterMaterial
    );
    const ringInner = new THREE.Mesh(
      skillEWeaponExplosionRingInnerGeometry,
      ringInnerMaterial
    );
    const pulseRing = new THREE.Mesh(
      skillEWeaponExplosionRingOuterGeometry,
      pulseRingMaterial
    );
    const shockDisk = new THREE.Mesh(
      skillEWeaponExplosionShockDiskGeometry,
      shockDiskMaterial
    );
    core.renderOrder = 15;
    shell.renderOrder = 14;
    voidShell.renderOrder = 13;
    ringOuter.renderOrder = 16;
    ringInner.renderOrder = 17;
    pulseRing.renderOrder = 18;
    shockDisk.renderOrder = 13;
    ringOuter.rotation.x = Math.PI * 0.5;
    ringInner.rotation.y = Math.PI * 0.5;
    pulseRing.rotation.x = Math.PI * 0.5;
    shockDisk.rotation.x = -Math.PI * 0.5;
    root.add(core, shell, voidShell, ringOuter, ringInner, pulseRing, shockDisk);

    const particles: SkillEWeaponExplosionParticle[] = [];
    for (let i = 0; i < skillEWeaponExplosionParticleCount; i += 1) {
      const particleMesh = new THREE.Mesh(
        skillEWeaponExplosionParticleGeometry,
        particleMaterial
      );
      particleMesh.renderOrder = 18;
      particleMesh.scale.setScalar(THREE.MathUtils.lerp(0.7, 1.45, Math.random()));
      root.add(particleMesh);
      particles.push({
        mesh: particleMesh,
        angle: (i / skillEWeaponExplosionParticleCount) * Math.PI * 2,
        radius: THREE.MathUtils.lerp(0.32, 0.9, Math.random()),
        radialSpeed: THREE.MathUtils.lerp(0.95, 3.4, Math.random()),
        height: THREE.MathUtils.lerp(-0.12, 0.52, Math.random()),
        heightSpeed: THREE.MathUtils.lerp(0.2, 0.88, Math.random()),
        swirl: THREE.MathUtils.lerp(1.3, 4.6, Math.random()),
        phase: Math.random() * Math.PI * 2,
      });
    }

    host.add(root);
    skillEWeaponExplosionSpawnWorldPos.copy(point);
    skillEWeaponExplosionFxEntries.push({
      root,
      core,
      coreMaterial,
      shell,
      shellMaterial,
      voidShell,
      voidShellMaterial,
      ringOuter,
      ringOuterMaterial,
      ringInner,
      ringInnerMaterial,
      pulseRing,
      pulseRingMaterial,
      shockDisk,
      shockDiskMaterial,
      particleMaterial,
      particles,
      startedAt: now,
      endsAt: now + skillEWeaponExplosionFxDurationMs,
      shakeEndsAt: now + skillEWeaponExplosionShakeDurationMs,
      nextDamageTickAt: now,
      baseWorldPos: skillEWeaponExplosionSpawnWorldPos.clone(),
      shakeOffset: new THREE.Vector3(),
      spin: THREE.MathUtils.lerp(1.6, 4.2, Math.random()),
    });
    triggerCameraShake(
      now,
      skillEWeaponExplosionCameraShakeMagnitude,
      skillEWeaponExplosionCameraShakeDurationMs
    );
  };

  const applySkillEWeaponExplosionAreaDamage = (
    now: number,
    center: THREE.Vector3,
    damage: number,
    directionHint?: THREE.Vector3
  ) => {
    const damageValue = Math.max(1, Math.round(damage));
    skillEWeaponExplosionDamageCenter.copy(center);

    if (directionHint && directionHint.lengthSq() > 0.000001) {
      skillEWeaponExplosionDamageDirection.copy(directionHint).normalize();
    } else if (runtimeAimDirection.lengthSq() > 0.000001) {
      skillEWeaponExplosionDamageDirection.copy(runtimeAimDirection).normalize();
    } else {
      avatar.getWorldQuaternion(skillEWeaponThrowAvatarQuat);
      skillEWeaponExplosionDamageDirection
        .set(0, 0, 1)
        .applyQuaternion(skillEWeaponThrowAvatarQuat);
      if (skillEWeaponExplosionDamageDirection.lengthSq() > 0.000001) {
        skillEWeaponExplosionDamageDirection.normalize();
      } else {
        skillEWeaponExplosionDamageDirection.set(0, 0, 1);
      }
    }

    if (performMeleeAttack) {
      performMeleeAttack({
        damage: damageValue,
        maxDistance: skillEWeaponProjectileExplosionRadius,
        maxHits: 24,
        contactCenter: skillEWeaponExplosionDamageCenter.clone(),
        contactRadius: skillEWeaponProjectileExplosionRadius,
        direction: skillEWeaponExplosionDamageDirection.clone(),
      });
      return;
    }

    const targets = getAttackTargets?.() ?? [];
    const damageRadiusSq =
      skillEWeaponProjectileExplosionRadius * skillEWeaponProjectileExplosionRadius;
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target?.object) continue;
      if (!target.object.parent) continue;
      if (target.isActive && !target.isActive()) continue;
      target.object.getWorldPosition(skillEWeaponExplosionFallbackTargetPos);
      if (
        skillEWeaponExplosionFallbackTargetPos.distanceToSquared(
          skillEWeaponExplosionDamageCenter
        ) > damageRadiusSq
      ) {
        continue;
      }
      skillEWeaponExplosionDamageDirection
        .copy(skillEWeaponExplosionFallbackTargetPos)
        .sub(skillEWeaponExplosionDamageCenter);
      if (skillEWeaponExplosionDamageDirection.lengthSq() > 0.000001) {
        skillEWeaponExplosionDamageDirection.normalize();
      } else {
        skillEWeaponExplosionDamageDirection.set(0, 0, 1);
      }
      target.onHit({
        now,
        source: "slash",
        damage: damageValue,
        point: skillEWeaponExplosionFallbackTargetPos.clone(),
        direction: skillEWeaponExplosionDamageDirection.clone(),
      });
    }
  };

  const applySkillEWeaponExplosionTickDamage = (
    entry: SkillEWeaponExplosionFxEntry,
    now: number
  ) => {
    applySkillEWeaponExplosionAreaDamage(
      now,
      entry.baseWorldPos,
      skillEWeaponExplosionDamageTick
    );
  };

  const updateSkillEWeaponExplosionFx = (now: number, deltaSeconds: number) => {
    const safeDelta = Math.max(0, deltaSeconds);
    const timeSec = now * 0.001;
    for (let i = skillEWeaponExplosionFxEntries.length - 1; i >= 0; i -= 1) {
      const entry = skillEWeaponExplosionFxEntries[i];
      const life = Math.max(1, entry.endsAt - entry.startedAt);
      const progress = THREE.MathUtils.clamp((now - entry.startedAt) / life, 0, 1);
      if (progress >= 1) {
        disposeSkillEWeaponExplosionFxEntry(entry);
        skillEWeaponExplosionFxEntries.splice(i, 1);
        continue;
      }

      entry.root.position.copy(entry.baseWorldPos);
      if (now < entry.shakeEndsAt) {
        const shakeRatio = THREE.MathUtils.clamp(
          (entry.shakeEndsAt - now) / skillEWeaponExplosionShakeDurationMs,
          0,
          1
        );
        const shakeAmp = skillEWeaponExplosionShakeMagnitude * Math.pow(shakeRatio, 1.1);
        entry.shakeOffset.set(
          (Math.sin(timeSec * 73.4 + entry.spin) + Math.cos(timeSec * 121.1 + 0.5) * 0.5) *
            shakeAmp,
          (Math.sin(timeSec * 97.2 + 1.2) + Math.cos(timeSec * 157.7 + 0.2) * 0.35) *
            shakeAmp *
            0.62,
          (Math.cos(timeSec * 83.9 + 1.7) + Math.sin(timeSec * 134.8 + 0.8) * 0.45) *
            shakeAmp
        );
        entry.root.position.add(entry.shakeOffset);
      }

      while (
        now >= entry.nextDamageTickAt &&
        entry.nextDamageTickAt < entry.endsAt
      ) {
        applySkillEWeaponExplosionTickDamage(entry, entry.nextDamageTickAt);
        entry.nextDamageTickAt += skillEWeaponExplosionDamageTickIntervalMs;
      }

      const burst = 1 - Math.pow(1 - progress, 2.1);
      const fade = Math.pow(1 - progress, 1.3);
      const pulse = 1 + Math.sin(timeSec * 9.6 + entry.spin) * 0.08 * fade;
      const flashDarkPhase =
        Math.floor((now - entry.startedAt) / skillEWeaponExplosionFlashIntervalMs) % 2 ===
        1;

      const coreColor = flashDarkPhase ? 0x1a0124 : 0xf3e8ff;
      const shellColor = flashDarkPhase ? 0x2a0140 : 0xc084fc;
      const voidShellColor = flashDarkPhase ? 0x040006 : 0x7c3aed;
      const ringOuterColor = flashDarkPhase ? 0x220033 : 0xa855f7;
      const ringInnerColor = flashDarkPhase ? 0x300048 : 0xe879f9;
      const pulseRingColor = flashDarkPhase ? 0x09000f : 0x6d28d9;
      const shockDiskColor = flashDarkPhase ? 0x180022 : 0x581c87;
      const particleColor = flashDarkPhase ? 0x14001e : 0xe9d5ff;

      entry.coreMaterial.color.setHex(coreColor);
      entry.shellMaterial.color.setHex(shellColor);
      entry.voidShellMaterial.color.setHex(voidShellColor);
      entry.ringOuterMaterial.color.setHex(ringOuterColor);
      entry.ringInnerMaterial.color.setHex(ringInnerColor);
      entry.pulseRingMaterial.color.setHex(pulseRingColor);
      entry.shockDiskMaterial.color.setHex(shockDiskColor);
      entry.particleMaterial.color.setHex(particleColor);

      entry.core.scale.setScalar((0.74 + burst * 5.5) * pulse);
      entry.shell.scale.setScalar((1.05 + burst * 7.8) * (1 + 0.09 * fade));
      entry.voidShell.scale.setScalar((1.24 + burst * 9.4) * (1 + 0.14 * fade));
      entry.ringOuter.scale.setScalar(1.1 + burst * 7.2);
      entry.ringInner.scale.setScalar(1 + burst * 5.9);
      entry.pulseRing.scale.setScalar(1.22 + burst * 9.8);
      entry.shockDisk.scale.setScalar(0.9 + burst * 8.6);

      entry.ringOuter.rotation.y += safeDelta * 2.8;
      entry.ringOuter.rotation.z += safeDelta * 2.1;
      entry.ringInner.rotation.x -= safeDelta * 3.2;
      entry.ringInner.rotation.z += safeDelta * 3.8;
      entry.pulseRing.rotation.z += safeDelta * 4.6;
      entry.pulseRing.rotation.x -= safeDelta * 1.8;
      entry.shockDisk.rotation.z += safeDelta * 1.75;

      const flashOpacityMul = flashDarkPhase ? 0.78 : 1;
      entry.coreMaterial.opacity = THREE.MathUtils.clamp(
        0.98 * fade * flashOpacityMul,
        0,
        0.98
      );
      entry.shellMaterial.opacity = THREE.MathUtils.clamp(
        0.8 * fade * flashOpacityMul,
        0,
        0.86
      );
      entry.voidShellMaterial.opacity = THREE.MathUtils.clamp(
        0.62 * fade * (flashDarkPhase ? 1.12 : 0.92),
        0,
        0.74
      );
      entry.ringOuterMaterial.opacity = THREE.MathUtils.clamp(
        0.94 * fade * flashOpacityMul,
        0,
        0.96
      );
      entry.ringInnerMaterial.opacity = THREE.MathUtils.clamp(
        0.98 * fade * flashOpacityMul,
        0,
        0.98
      );
      entry.pulseRingMaterial.opacity = THREE.MathUtils.clamp(
        0.86 * fade * (flashDarkPhase ? 0.92 : 1.06),
        0,
        0.94
      );
      entry.shockDiskMaterial.opacity = THREE.MathUtils.clamp(
        0.88 * fade * flashOpacityMul,
        0,
        0.9
      );
      entry.particleMaterial.opacity = THREE.MathUtils.clamp(
        0.9 * fade * (flashDarkPhase ? 0.84 : 1.08),
        0,
        0.95
      );

      for (let j = 0; j < entry.particles.length; j += 1) {
        const particle = entry.particles[j];
        const radius = particle.radius + particle.radialSpeed * burst;
        const angle = particle.angle + timeSec * particle.swirl + particle.phase;
        const y =
          particle.height +
          particle.heightSpeed * burst +
          Math.sin(timeSec * (2.4 + particle.swirl) + particle.phase) * 0.09 * fade;
        particle.mesh.position.set(
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius
        );
        particle.mesh.scale.setScalar(
          THREE.MathUtils.lerp(1.1, 0.3, progress) *
            (0.65 + Math.sin(timeSec * 7.3 + particle.phase) * 0.1)
        );
      }
    }
  };

  const resolveSkillEWeaponFallbackDirection = () => {
    if (runtimeAimDirection.lengthSq() > 0.000001) {
      skillEWeaponThrowDirection.copy(runtimeAimDirection).normalize();
      return;
    }
    avatar.getWorldQuaternion(skillEWeaponThrowAvatarQuat);
    skillEWeaponThrowAvatarForward
      .set(0, 0, 1)
      .applyQuaternion(skillEWeaponThrowAvatarQuat);
    if (skillEWeaponThrowAvatarForward.lengthSq() > 0.000001) {
      skillEWeaponThrowAvatarForward.normalize();
      skillEWeaponThrowDirection.copy(skillEWeaponThrowAvatarForward);
      return;
    }
    skillEWeaponThrowDirection.set(0, 0, 1);
  };

  const resolveSkillEWeaponProjectileForwardOffset = (
    throwOrigin: THREE.Vector3,
    throwDirection: THREE.Vector3
  ) => {
    const baseOffset = Math.max(0, skillEWeaponProjectileForwardOffset);
    const targets = getAttackTargets?.();
    if (!targets?.length) return baseOffset;

    // Use the nearest point on each target bounds instead of root position to
    // avoid misses on large meshes whose pivots are offset.
    const laneRadius = 2.4;
    const laneRadiusSq = laneRadius * laneRadius;
    let nearestForwardDistance = Infinity;
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target?.object) continue;
      if (!target.object.parent) continue;
      if (target.isActive && !target.isActive()) continue;
      skillEWeaponSpawnTargetBounds.setFromObject(target.object);
      if (skillEWeaponSpawnTargetBounds.isEmpty()) continue;
      skillEWeaponSpawnTargetBounds.clampPoint(
        throwOrigin,
        skillEWeaponSpawnClosestPoint
      );
      skillEWeaponSpawnToTarget
        .copy(skillEWeaponSpawnClosestPoint)
        .sub(throwOrigin);
      const forwardDistance = skillEWeaponSpawnToTarget.dot(throwDirection);
      const radialDistanceSq =
        skillEWeaponSpawnToTarget.lengthSq() - forwardDistance * forwardDistance;
      if (radialDistanceSq > laneRadiusSq) continue;
      if (forwardDistance < nearestForwardDistance) {
        nearestForwardDistance = forwardDistance;
      }
    }

    if (!Number.isFinite(nearestForwardDistance)) return baseOffset;
    const safetyMargin = Math.max(
      0.08,
      skillEWeaponProjectileRadius * 0.75 + skillEWeaponProjectileTargetHitRadius * 0.45
    );
    const clampedOffset = nearestForwardDistance - safetyMargin;
    return THREE.MathUtils.clamp(
      clampedOffset,
      -skillEWeaponProjectileMaxBackwardOffset,
      baseOffset
    );
  };

  const resetSkillEWeaponThrowState = () => {
    skillEWeaponThrowState.active = false;
    skillEWeaponThrowState.projectileLaunched = false;
    skillEWeaponThrowState.forcedBare = false;
    skillEWeaponThrowState.hasSourceSample = false;
    skillEWeaponThrowState.previousSourceWorldPos.set(0, 0, 0);
  };

  const startSkillEWeaponThrowState = () => {
    skillEWeaponThrowState.active = true;
    skillEWeaponThrowState.projectileLaunched = false;
    skillEWeaponThrowState.forcedBare = false;
    skillEWeaponThrowState.hasSourceSample = false;
    skillEWeaponThrowState.previousSourceWorldPos.set(0, 0, 0);
  };

  const refreshSkillEWeaponThrowProgress = () => {
    skillEWeaponResolvedThrowProgress = resolveSkillEWeaponThrowProgressFromClip({
      clip: skillEWeaponBinding?.clip ?? null,
      preferredNodeName: weaponThrowSourceNode?.name ?? null,
    });
  };

  const launchSkillEWeaponProjectile = (
    resolvedSourceNodeHint?: THREE.Object3D | null
  ) => {
    if (!fireProjectile) return false;

    avatar.updateMatrixWorld(true);
    const resolvedSourceNode =
      (resolvedSourceNodeHint && resolvedSourceNodeHint.parent
        ? resolvedSourceNodeHint
        : weaponThrowSourceNode && weaponThrowSourceNode.parent
        ? weaponThrowSourceNode
        : findWeaponThrowSourceNode(lastAvatarModel)) ?? null;

    if (resolvedSourceNode && resolvedSourceNode.parent) {
      weaponThrowSourceNode = resolvedSourceNode;
      resolvedSourceNode.updateWorldMatrix(true, true);
      resolvedSourceNode.getWorldPosition(skillEWeaponThrowOriginWorld);
      resolvedSourceNode.getWorldQuaternion(skillEWeaponThrowSourceQuat);
      resolvedSourceNode.getWorldScale(skillEWeaponThrowSourceScale);
    } else {
      avatar.getWorldPosition(skillEWeaponThrowOriginWorld);
      skillEWeaponThrowOriginWorld.y += 1.12;
      skillEWeaponThrowSourceQuat.copy(avatar.quaternion);
      skillEWeaponThrowSourceScale.set(1, 1, 1);
    }

    resolveSkillEWeaponFallbackDirection();

    skillEWeaponLaunchSourceWorld.copy(skillEWeaponThrowOriginWorld);
    if (skillEWeaponThrowState.hasSourceSample) {
      skillEWeaponSpawnToTarget
        .copy(skillEWeaponThrowOriginWorld)
        .sub(skillEWeaponThrowState.previousSourceWorldPos);
      const forwardStep = skillEWeaponSpawnToTarget.dot(skillEWeaponThrowDirection);
      if (forwardStep > 0.0001) {
        const nearestFromCurrent = resolveSkillEWeaponProjectileForwardOffset(
          skillEWeaponThrowOriginWorld,
          skillEWeaponThrowDirection
        );
        if (
          nearestFromCurrent <=
          skillEWeaponProjectileForwardOffset + skillEWeaponProjectileTargetHitRadius
        ) {
          skillEWeaponLaunchSourceWorld.copy(
            skillEWeaponThrowState.previousSourceWorldPos
          );
        }
      }
    }

    const resolvedForwardOffset = resolveSkillEWeaponProjectileForwardOffset(
      skillEWeaponLaunchSourceWorld,
      skillEWeaponThrowDirection
    );
    const origin = skillEWeaponLaunchSourceWorld
      .clone()
      .addScaledVector(skillEWeaponThrowDirection, resolvedForwardOffset);
    origin.y += skillEWeaponProjectileUpwardOffset;

    const projectileRootGeometry = new THREE.SphereGeometry(0.01, 8, 8);
    const projectileRootMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const projectileRoot = new THREE.Mesh(
      projectileRootGeometry,
      projectileRootMaterial
    );
    projectileRoot.castShadow = false;
    projectileRoot.receiveShadow = false;
    projectileRoot.frustumCulled = false;

    const ownedGeometries: THREE.BufferGeometry[] = [projectileRootGeometry];
    const ownedMaterials: THREE.Material[] = [projectileRootMaterial];
    let swordVisual: THREE.Object3D | null = null;

    if (resolvedSourceNode) {
      const clonedWeapon = cloneObjectWithClonedMaterials(resolvedSourceNode);
      if (clonedWeapon.hasMesh) {
        swordVisual = clonedWeapon.clone;
        for (let i = 0; i < clonedWeapon.materials.length; i += 1) {
          ownedMaterials.push(clonedWeapon.materials[i]);
        }
      }
    }

    if (!swordVisual) {
      const fallbackRoot = new THREE.Group();
      const bladeGeometry = new THREE.BoxGeometry(0.08, 0.08, 1.1);
      const bladeMaterial = new THREE.MeshStandardMaterial({
        color: 0x6d28d9,
        emissive: 0x4c1d95,
        emissiveIntensity: 1.4,
        roughness: 0.22,
        metalness: 0.42,
      });
      const guardGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10);
      const guardMaterial = new THREE.MeshStandardMaterial({
        color: 0x581c87,
        emissive: 0x581c87,
        emissiveIntensity: 0.8,
        roughness: 0.3,
        metalness: 0.4,
      });
      const hiltGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.34, 10);
      const hiltMaterial = new THREE.MeshStandardMaterial({
        color: 0x7c3aed,
        emissive: 0x581c87,
        emissiveIntensity: 0.7,
        roughness: 0.35,
        metalness: 0.2,
      });
      const pommelGeometry = new THREE.SphereGeometry(0.08, 10, 10);
      const pommelMaterial = new THREE.MeshStandardMaterial({
        color: 0xc4b5fd,
        emissive: 0xa855f7,
        emissiveIntensity: 1.8,
        roughness: 0.18,
        metalness: 0.35,
      });
      const bladeMesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
      const guardMesh = new THREE.Mesh(guardGeometry, guardMaterial);
      const hiltMesh = new THREE.Mesh(hiltGeometry, hiltMaterial);
      const pommelMesh = new THREE.Mesh(pommelGeometry, pommelMaterial);
      bladeMesh.position.z = 0.44;
      guardMesh.rotation.x = Math.PI * 0.5;
      hiltMesh.rotation.x = Math.PI * 0.5;
      hiltMesh.position.z = -0.2;
      pommelMesh.position.z = -0.38;
      fallbackRoot.add(bladeMesh, guardMesh, hiltMesh, pommelMesh);
      fallbackRoot.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      });
      ownedGeometries.push(bladeGeometry, guardGeometry, hiltGeometry, pommelGeometry);
      ownedMaterials.push(bladeMaterial, guardMaterial, hiltMaterial, pommelMaterial);
      swordVisual = fallbackRoot;
    }

    swordVisual.position.set(0, 0, 0);
    swordVisual.quaternion.identity();
    swordVisual.scale.copy(skillEWeaponThrowSourceScale);
    projectileRoot.add(swordVisual);

    const flightDirection = skillEWeaponThrowDirection.clone();
    let bestAxisDot = -Infinity;
    for (let i = 0; i < skillEWeaponThrowAxisProbe.length; i += 1) {
      skillEWeaponThrowAxisWorldCandidate
        .copy(skillEWeaponThrowAxisProbe[i])
        .applyQuaternion(skillEWeaponThrowSourceQuat);
      if (skillEWeaponThrowAxisWorldCandidate.lengthSq() <= 0.000001) continue;
      skillEWeaponThrowAxisWorldCandidate.normalize();
      const dot = skillEWeaponThrowAxisWorldCandidate.dot(flightDirection);
      if (dot > bestAxisDot) {
        bestAxisDot = dot;
        skillEWeaponThrowSelectedLocalAxis.copy(skillEWeaponThrowAxisProbe[i]);
      }
    }
    const projectileAimQuat = new THREE.Quaternion().setFromUnitVectors(
      skillEWeaponThrowSelectedLocalAxis,
      flightDirection
    );
    let impactFxSpawned = false;
    const spawnImpactFx = (impactNow: number, impactPoint: THREE.Vector3) => {
      if (impactFxSpawned) return;
      impactFxSpawned = true;
      spawnSkillEWeaponExplosionFx(impactNow, impactPoint);
    };

    projectileRoot.quaternion.copy(projectileAimQuat);

    fireProjectile({
      projectileType: "abilityOrb",
      mesh: projectileRoot,
      origin,
      direction: skillEWeaponThrowDirection.clone(),
      speed: skillEWeaponProjectileSpeed,
      lifetime: skillEWeaponProjectileLifetime,
      radius: skillEWeaponProjectileRadius,
      targetHitRadius: skillEWeaponProjectileTargetHitRadius,
      damage: skillEWeaponProjectileDamage,
      gravity: 0,
      splitOnImpact: true,
      explosionRadius: skillEWeaponProjectileExplosionRadius,
      explosionDamage: skillEWeaponProjectileExplosionDamage,
      explosionMinDamage: skillEWeaponProjectileExplosionMinDamage,
      color: 0xf5d0fe,
      emissive: 0x7e22ce,
      emissiveIntensity: 1.7,
      explosionColor: 0xe9d5ff,
      explosionEmissive: 0x86198f,
      explosionEmissiveIntensity: 2.4,
      explodeOnTargetHit: false,
      explodeOnWorldHit: false,
      explodeOnExpire: false,
      removeOnTargetHit: true,
      removeOnWorldHit: true,
      lifecycle: {
        onTargetHit: ({ now, point, triggerExplosion }) => {
          spawnImpactFx(now, point);
          triggerExplosion(null);
        },
        onWorldHit: ({ now, point, triggerExplosion }) => {
          spawnImpactFx(now, point);
          triggerExplosion(null);
        },
        applyForces: ({ velocity }) => {
          velocity.copy(flightDirection).multiplyScalar(skillEWeaponProjectileSpeed);
          projectileRoot.quaternion.copy(projectileAimQuat);
        },
        onRemove: ({ reason, now, position, triggerExplosion }) => {
          if (!impactFxSpawned && reason === "expired") {
            spawnImpactFx(now, position);
            triggerExplosion();
          }
          for (let i = 0; i < ownedGeometries.length; i += 1) {
            ownedGeometries[i].dispose();
          }
          for (let i = 0; i < ownedMaterials.length; i += 1) {
            ownedMaterials[i].dispose();
          }
        },
      },
    });

    return true;
  };

  const updateSkillEWeaponThrowState = () => {
    const isWeaponSkillERunning = Boolean(
      skillEWeaponBinding &&
        activeSkillBinding === skillEWeaponBinding &&
        skillEWeaponBinding.action.isRunning()
    );
    if (!isWeaponSkillERunning) {
      if (skillEWeaponThrowState.active) {
        if (!skillEWeaponThrowState.forcedBare && weaponEquipped) {
          setWeaponEquipped(false, { refreshECooldown: true });
        }
        resetSkillEWeaponThrowState();
      }
      return;
    }

    if (!skillEWeaponThrowState.active) {
      startSkillEWeaponThrowState();
    }

    const resolvedSourceNode =
      (weaponThrowSourceNode && weaponThrowSourceNode.parent
        ? weaponThrowSourceNode
        : findWeaponThrowSourceNode(lastAvatarModel)) ?? null;
    if (resolvedSourceNode && resolvedSourceNode.parent) {
      weaponThrowSourceNode = resolvedSourceNode;
      resolvedSourceNode.updateWorldMatrix(true, true);
      resolvedSourceNode.getWorldPosition(skillEWeaponThrowSampleEndWorld);
      if (!skillEWeaponThrowState.hasSourceSample) {
        skillEWeaponThrowState.previousSourceWorldPos.copy(
          skillEWeaponThrowSampleEndWorld
        );
        skillEWeaponThrowState.hasSourceSample = true;
      }
    } else {
      skillEWeaponThrowState.hasSourceSample = false;
    }

    const duration = Math.max(0.001, skillEWeaponBinding?.clip.duration ?? 0.001);
    const progress = THREE.MathUtils.clamp(
      (skillEWeaponBinding?.action.time ?? 0) / duration,
      0,
      1
    );
    const throwProgress = THREE.MathUtils.clamp(
      skillEWeaponResolvedThrowProgress,
      0.02,
      0.95
    );

    if (
      !skillEWeaponThrowState.projectileLaunched &&
      progress >= throwProgress
    ) {
      launchSkillEWeaponProjectile(resolvedSourceNode);
      skillEWeaponThrowState.projectileLaunched = true;
    }

    const shouldForceBare =
      progress >= throwProgress || skillEWeaponThrowState.projectileLaunched;
    if (!skillEWeaponThrowState.forcedBare && shouldForceBare) {
      setWeaponEquipped(false, { refreshECooldown: true });
      skillEWeaponThrowState.forcedBare = true;
    }

    if (resolvedSourceNode && resolvedSourceNode.parent) {
      skillEWeaponThrowState.previousSourceWorldPos.copy(
        skillEWeaponThrowSampleEndWorld
      );
      skillEWeaponThrowState.hasSourceSample = true;
    }
  };

  const settleInactiveSkillBinding = (now: number) => {
    if (!activeSkillBinding || activeSkillBinding.action.isRunning()) return;
    if (activeSkillBinding === skillEBareBinding) {
      // Preserve the anti-pop transition for bare E when ending naturally.
      finishOneShotBindingWithoutRewind(activeSkillBinding);
      skillEBarePostTransitionEndsAt = now + skillEBareToWeaponLocomotionBlendMs;
    } else {
      stopActionBinding(activeSkillBinding);
    }
    activeSkillBinding = null;
  };

  const tryPlaySkill = (binding: ActionBinding | null) => {
    if (!mixer || !binding) return false;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    settleInactiveSkillBinding(now);
    if (isSkillAnimationActive()) return false;
    const started = playActionBinding(binding);
    if (started) {
      skillEBarePostTransitionEndsAt = 0;
      primaryAttackHeld = false;
      resetBarePrimaryAttackState();
      resetWeaponPrimaryAttackState(true);
      resetWeaponPrimaryBackstepState();
      resetSkillQWeaponExplosionState();
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
    resetSkillEBareSummonFxState(true);
    resetSkillEWeaponThrowState();
    clearSkillEWeaponExplosionFxState();
    resetSkillQWeaponExplosionState();
    weaponThrowSourceNode = null;
    skillEWeaponResolvedThrowProgress = skillEWeaponThrowProgressFallback;
    harperWeaponMaterialEntries.length = 0;
    harperWeaponVisualOpacity = 1;
    primaryAttackHandBone = null;
    setPrimaryAttackChargeVisible(false);
    clearSkillQBareGateState(true);
    clearPurcleSmokeFxState();
    resetSkillRBareState(true);
    skillRWeaponPurcleSummonedInCast = false;
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
    resetWeaponPrimaryAttackState(false);
    resetWeaponPrimaryBackstepState();
    primaryAttackChargePulse = 0;
    primaryAttackHeld = false;
    wasPrimaryAttackAnimationActive = false;
    skillEBarePostTransitionEndsAt = 0;
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
    normalAttackWeaponBinding = createOneShotBinding(
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
      resetWeaponPrimaryBackstepState();
      resetSkillQWeaponExplosionState();
      updateSkillEWeaponExplosionFx(now, 0);
      updateSkillQBareGates(now, 0);
      updateCameraShake(now);
      lastAnimationUpdateAt = now;
      return;
    }

    const deltaSeconds =
      lastAnimationUpdateAt > 0 ? Math.max(0, (now - lastAnimationUpdateAt) / 1000) : 0;
    lastAnimationUpdateAt = now;

    if (
      activeSkillBinding === skillEBareBinding &&
      skillEBareBinding?.action.isRunning()
    ) {
      const duration = Math.max(0.001, skillEBareBinding.clip.duration);
      const progress = THREE.MathUtils.clamp(
        skillEBareBinding.action.time / duration,
        0,
        1
      );
      // skillEBare tail has a second shoulder-carry motion. Cut over at the
      // first settled receive pose to avoid replaying shoulder-lift at the end.
      if (progress >= skillEBareAutoFinishProgress) {
        finishOneShotBindingWithoutRewind(skillEBareBinding);
        activeSkillBinding = null;
        skillEBarePostTransitionEndsAt = now + skillEBareToWeaponLocomotionBlendMs;
      }
    }

    settleInactiveSkillBinding(now);

    updateSkillQBareState(now);
    updateSkillQWeaponState(now);
    updateSkillRBareState(now, deltaSeconds);
    updateSkillRWeaponState(now);
    updateSkillEBareSummonState(now, deltaSeconds);

    const hasSkillAnimationActive = isSkillAnimationActive();
    const barePrimaryAttackAction = normalAttackBareBinding?.action ?? null;
    if (
      barePrimaryAttackState.active &&
      (!barePrimaryAttackAction ||
        now >=
          barePrimaryAttackState.endsAt + normalAttackBareRecoveryEndBufferMs)
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
      if (!weaponEquipped && primaryAttackHeld && !hasSkillAnimationActive) {
        startBarePrimaryAttack(now);
      }
    }

    updateWeaponPrimaryAttackState(now);
    updateWeaponPrimaryBackstepState(deltaSeconds);

    const weaponPrimaryAttackAnimationActive =
      weaponEquipped &&
      weaponPrimaryAttackState.active &&
      !hasSkillAnimationActive &&
      Boolean(normalAttackWeaponBinding);
    const barePrimaryAttackAnimationActive =
      !weaponEquipped && barePrimaryAttackState.active;
    const primaryAttackAnimationActive =
      weaponPrimaryAttackAnimationActive || barePrimaryAttackAnimationActive;
    const inSkillEBarePostTransition =
      weaponEquipped &&
      !hasSkillAnimationActive &&
      now < skillEBarePostTransitionEndsAt;
    const forceImmediateBlend =
      primaryAttackAnimationActive;
    const skillEBareActive = Boolean(
      skillEBareBinding && activeSkillBinding === skillEBareBinding
    );
    const skillEWeaponActive = Boolean(
      skillEWeaponBinding && activeSkillBinding === skillEWeaponBinding
    );
    const skillRWeaponActive = Boolean(
      skillRWeaponBinding && activeSkillBinding === skillRWeaponBinding
    );
    const skillCastWalkLegsActive =
      hasSkillAnimationActive &&
      isMoving &&
      (skillEBareActive || skillEWeaponActive || skillRWeaponActive);
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
    const preferWeaponWalkLegs =
      skillEWeaponActive || skillRWeaponActive || (!skillEBareActive && weaponEquipped);
    const resolvedWalkLegsBinding =
      (preferWeaponWalkLegs ? walkWeaponLegsBinding : walkBareLegsBinding) ??
      walkBareLegsBinding ??
      walkWeaponLegsBinding;

    const walkTimeScale = isSprinting ? 1.4 : 1;
    const targetWalkWeight =
      hasSkillAnimationActive || primaryAttackAnimationActive || inSkillEBarePostTransition
        ? 0
        : isMoving
        ? 1
        : 0;
    const targetIdleWeight =
      hasSkillAnimationActive || primaryAttackAnimationActive
        ? 0
        : inSkillEBarePostTransition
        ? 1
        : isMoving
        ? 0
        : 1;
    const targetWalkLegsWeight =
      skillCastWalkLegsActive || primaryAttackWalkLegsActive || inSkillEBarePostTransition
        ? 1
        : 0;
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
    if (normalAttackWeaponBinding) {
      const action = normalAttackWeaponBinding.action;
      action.setEffectiveWeight(
        THREE.MathUtils.lerp(
          action.getEffectiveWeight(),
          targetWeaponPrimaryAttackWeight,
          blend
        )
      );
      action.setEffectiveTimeScale(1);
      action.enabled = true;
      if (weaponPrimaryAttackAnimationActive) {
        action.paused = false;
        if (!action.isRunning()) {
          action.play();
        }
      }
    }
    if (normalAttackBareBinding) {
      normalAttackBareBinding.action.setEffectiveWeight(
        THREE.MathUtils.lerp(
          normalAttackBareBinding.action.getEffectiveWeight(),
          targetBarePrimaryAttackWeight,
          blend
        )
      );
      normalAttackBareBinding.action.setEffectiveTimeScale(
        barePrimaryAttackAnimationActive ? normalAttackBareSpeedMultiplier : 1
      );
      normalAttackBareBinding.action.enabled = true;
    }

    // During bare E summon, keep weapon loop layers frozen at phase 0 so they do
    // not accumulate hidden time and pop in with a random shoulder-carry phase.
    if (skillEBareActive) {
      freezeLoopBinding(idleWeaponBinding, 0);
      freezeLoopBinding(walkWeaponBinding, 0);
      freezeLoopBinding(walkWeaponLegsBinding, 0);
    }

    wasPrimaryAttackAnimationActive = primaryAttackAnimationActive;

    if (deltaSeconds > 0) {
      mixer.update(deltaSeconds);
    }
    updateSkillEWeaponThrowState();
    updateSkillEWeaponExplosionFx(now, deltaSeconds);
    updateSkillQBareGates(now, deltaSeconds);
    updateCameraShake(now);
  };

  const bindModel = (avatarModel: THREE.Object3D | null) => {
    if (avatarModel === lastAvatarModel) return;
    clearAnimationBinding();
    clearEyeAnchor();
    lastAvatarModel = avatarModel;
    if (!avatarModel) {
      weaponColliderNodes.length = 0;
      return;
    }
    collectHarperWeaponMaterialEntries(avatarModel, harperWeaponMaterialEntries);
    setHarperWeaponNodesVisible(avatarModel, weaponEquipped);
    setHarperWeaponVisualOpacity(weaponEquipped ? harperWeaponVisualOpacity : 1);
    bindEyeAnchor(avatarModel);
    bindAnimations(avatarModel);
    primaryAttackHandBone = findPrimaryAttackHand(avatarModel);
    weaponThrowSourceNode = findWeaponThrowSourceNode(avatarModel);
    refreshWeaponColliderNodes(avatarModel);
    refreshSkillEWeaponThrowProgress();
  };

  const getRuntimeNow = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const hasEnoughManualMana = (cost: number) => {
    if (noCooldown || cost <= 0) return true;
    const currentMana = getCurrentStats?.().mana;
    if (typeof currentMana !== "number" || !Number.isFinite(currentMana)) return true;
    return currentMana + 0.0001 >= cost;
  };

  const spendManualMana = (cost: number) => {
    if (noCooldown || cost <= 0) return true;
    const spent = spendMana?.(cost);
    if (typeof spent !== "number" || !Number.isFinite(spent)) return true;
    return spent + 0.0001 >= cost;
  };

  const startRuntimeSkillECooldown = (now: number) => {
    if (noCooldown || harperSkillECooldownMs <= 0) {
      runtimeSkillECooldownUntil = 0;
      clearSkillCooldown?.("e");
      return;
    }
    runtimeSkillECooldownUntil = now + harperSkillECooldownMs;
  };

  const startRuntimeSkillRCooldown = (now: number) => {
    if (noCooldown || harperSkillRCooldownMs <= 0) {
      runtimeSkillRCooldownUntil = 0;
      clearSkillCooldown?.("r");
      return;
    }
    runtimeSkillRCooldownUntil = now + harperSkillRCooldownMs;
  };

  const getRuntimeSkillCooldownRemainingMs = (key: "e" | "r") => {
    const now = getRuntimeNow();
    if (key === "e") {
      return Math.max(0, runtimeSkillECooldownUntil - now);
    }
    return Math.max(0, runtimeSkillRCooldownUntil - now);
  };

  const getRuntimeSkillCooldownDurationMs = (key: "e" | "r") =>
    key === "e" ? harperSkillECooldownMs : harperSkillRCooldownMs;

  const setWeaponEquipped = (
    equipped: boolean,
    options?: {
      refreshECooldown?: boolean;
      now?: number;
    }
  ) => {
    if (weaponEquipped === equipped) return;
    weaponEquipped = equipped;
    if (options?.refreshECooldown ?? false) {
      startRuntimeSkillECooldown(options?.now ?? getRuntimeNow());
    }
    setHarperWeaponNodesVisible(lastAvatarModel, weaponEquipped);
    const shouldKeepSummonFade =
      weaponEquipped &&
      Boolean(
        skillEBareBinding &&
          activeSkillBinding === skillEBareBinding
      );
    setHarperWeaponVisualOpacity(shouldKeepSummonFade ? 0 : 1);
    if (!shouldKeepSummonFade) {
      resetSkillEBareSummonFxState(false);
    }
    if (!weaponEquipped) {
      resetWeaponPrimaryAttackState(true);
      resetWeaponPrimaryBackstepState();
      resetSkillQWeaponExplosionState();
      primaryAttackHeld = false;
    }
  };

  const handlePrimaryDown = () => {
    if (isSkillAnimationActive()) return;
    if (!weaponEquipped) {
      primaryAttackHeld = true;
      if (barePrimaryAttackState.active) return;
      startBarePrimaryAttack(performance.now());
      return;
    }
    primaryAttackHeld = true;
    if (!weaponPrimaryAttackState.active) {
      startWeaponPrimaryAttackCombo();
    }
  };

  const handlePrimaryUp = () => {
    if (!weaponEquipped && barePrimaryAttackState.active) {
      const inChargeWindow = performance.now() < barePrimaryAttackState.chargeEndsAt;
      if (!barePrimaryAttackState.projectileFired && inChargeWindow) {
        resetBarePrimaryAttackState();
      }
    }
    primaryAttackHeld = false;
    if (weaponEquipped && weaponPrimaryAttackState.active) {
      resetWeaponPrimaryAttackState(false);
    }
  };

  const handlePrimaryCancel = () => {
    if (!weaponEquipped && barePrimaryAttackState.active) {
      const inChargeWindow = performance.now() < barePrimaryAttackState.chargeEndsAt;
      if (!barePrimaryAttackState.projectileFired && inChargeWindow) {
        resetBarePrimaryAttackState();
      }
    }
    primaryAttackHeld = false;
    if (weaponEquipped && weaponPrimaryAttackState.active) {
      resetWeaponPrimaryAttackState(false);
    }
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
    const now = getRuntimeNow();
    if (!noCooldown && runtimeSkillECooldownUntil > now) {
      return false;
    }
    if (weaponEquipped) {
      const skillEBinding = skillEWeaponBinding ?? skillEBareBinding;
      if (tryPlaySkill(skillEBinding)) {
        if (skillEBinding === skillEWeaponBinding) {
          startSkillEWeaponThrowState();
        } else {
          setWeaponEquipped(false, { now, refreshECooldown: true });
        }
        return true;
      }
      return baseRuntime.handleSkillE?.() ?? false;
    }

    if (!hasEnoughManualMana(harperSkillEBareManaCost)) {
      return false;
    }
    if (!skillEBareBinding) {
      if (!spendManualMana(harperSkillEBareManaCost)) return false;
      setWeaponEquipped(true, { now, refreshECooldown: false });
      return true;
    }
    if (!tryPlaySkill(skillEBareBinding)) return false;
    if (!spendManualMana(harperSkillEBareManaCost)) return false;
    setWeaponEquipped(true, { now, refreshECooldown: false });
    return true;
  };

  const handleSkillR = () => {
    const now = getRuntimeNow();
    if (!noCooldown && runtimeSkillRCooldownUntil > now) {
      return false;
    }
    if (!hasEnoughManualMana(harperSkillRManaCost)) {
      return false;
    }
    const skillRBinding =
      (weaponEquipped ? skillRWeaponBinding : skillRBareBinding) ??
      skillRBareBinding ??
      skillRWeaponBinding;
    if (tryPlaySkill(skillRBinding)) {
      if (!spendManualMana(harperSkillRManaCost)) {
        return false;
      }
      startRuntimeSkillRCooldown(now);
      if (!weaponEquipped && skillRBinding === skillRBareBinding) {
        startSkillRBareState();
      } else if (weaponEquipped && skillRBinding === skillRWeaponBinding) {
        skillRWeaponPurcleSummonedInCast = false;
      }
      return true;
    }
    return baseRuntime.handleSkillR?.() ?? false;
  };

  const beforeSkillUse: NonNullable<typeof baseRuntime.beforeSkillUse> = (args) => {
    const baseModifierResult = baseRuntime.beforeSkillUse?.(args);
    const baseModifier =
      baseModifierResult && typeof baseModifierResult === "object"
        ? baseModifierResult
        : {};
    if (args.key === "e" || args.key === "r") {
      return {
        ...baseModifier,
        ignoreCostAndCooldown: true,
      };
    }
    return baseModifier;
  };

  const getSkillCooldownRemainingMs: NonNullable<
    typeof baseRuntime.getSkillCooldownRemainingMs
  > = (key) => {
    if (key === "e" || key === "r") {
      return getRuntimeSkillCooldownRemainingMs(key);
    }
    return baseRuntime.getSkillCooldownRemainingMs?.(key) ?? null;
  };

  const getSkillCooldownDurationMs: NonNullable<
    typeof baseRuntime.getSkillCooldownDurationMs
  > = (key) => {
    if (key === "e" || key === "r") {
      return getRuntimeSkillCooldownDurationMs(key);
    }
    return baseRuntime.getSkillCooldownDurationMs?.(key) ?? null;
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
    resetWeaponPrimaryAttackState(false);
    resetWeaponPrimaryBackstepState();
    resetSkillQWeaponExplosionState();
    resetSkillEWeaponThrowState();
    clearSkillEWeaponExplosionFxState();
    resetSkillEBareSummonFxState(true);
    activeSkillBinding = null;
    skillEBarePostTransitionEndsAt = 0;
    barePrimaryAttackState.active = false;
    barePrimaryAttackState.projectileFired = false;
    barePrimaryAttackState.startedAt = 0;
    barePrimaryAttackState.chargeEndsAt = 0;
    barePrimaryAttackState.fireAt = 0;
    barePrimaryAttackState.endsAt = 0;
    primaryAttackHandBone = null;
    setPrimaryAttackChargeVisible(false);
    clearSkillQBareGateState(true);
    clearPurcleSmokeFxState();
    resetSkillRBareState(true);
    skillRWeaponPurcleSummonedInCast = false;
    primaryAttackChargePulse = 0;
    primaryAttackHeld = false;
    wasPrimaryAttackAnimationActive = false;
    cameraShakeStartedAt = 0;
    cameraShakeEndsAt = 0;
    cameraShakeMagnitude = 0;
    runtimeSkillECooldownUntil = 0;
    runtimeSkillRCooldownUntil = 0;
    clearSkillCooldown?.("e");
    clearSkillCooldown?.("r");
    if (eyeAnchor) {
      eyeAnchor.position.copy(eyeAnchorRestLocalPos);
    }
    weaponEquipped = false;
    setHarperWeaponNodesVisible(lastAvatarModel, false);
    weaponThrowSourceNode =
      lastAvatarModel ? findWeaponThrowSourceNode(lastAvatarModel) : null;
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
    handleProjectileBlockHit: handleRuntimeProjectileBlockHit,
    getMovementSpeedMultiplier: () => {
      const baseMultiplier = baseRuntime.getMovementSpeedMultiplier?.() ?? 1;
      if (isSkillQCastActive()) {
        return baseMultiplier * skillQCastMoveSpeedMultiplier;
      }
      const weaponPrimaryActionRunning = Boolean(
        normalAttackWeaponBinding?.action.isRunning()
      );
      if (
        weaponPrimaryAttackState.active &&
        primaryAttackHeld &&
        weaponPrimaryActionRunning
      ) {
        return baseMultiplier * normalAttackWeaponMoveSpeedMultiplier;
      }
      if (isBareSkillRCastActive()) {
        return baseMultiplier * 0.3;
      }
      return baseMultiplier;
    },
    getCameraScaleMultiplier: baseRuntime.getCameraScaleMultiplier,
    getCameraFollowTarget: () => eyeAnchor,
    isBasicAttackLocked: baseRuntime.isBasicAttackLocked,
    isMovementLocked: () => {
      if (isBareSkillQCastActive()) return true;
      return baseRuntime.isMovementLocked?.() ?? false;
    },
    getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs,
    getSkillHudIndicators: baseRuntime.getSkillHudIndicators,
    beforeSkillUse,
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
      clearPurcleSmokeFxState();
      skillRBareFxRoot.removeFromParent();
      skillEBareSummonFxRoot.removeFromParent();
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
      skillEWeaponExplosionCoreGeometry.dispose();
      skillEWeaponExplosionShellGeometry.dispose();
      skillEWeaponExplosionRingOuterGeometry.dispose();
      skillEWeaponExplosionRingInnerGeometry.dispose();
      skillEWeaponExplosionShockDiskGeometry.dispose();
      skillEWeaponExplosionParticleGeometry.dispose();
      skillEBareSummonParticleGeometry.dispose();
      purcleSmokeParticleGeometry.dispose();
      for (let i = 0; i < skillEBareSummonParticles.length; i += 1) {
        skillEBareSummonParticles[i].material.dispose();
      }
      baseRuntime.dispose();
    },
    isFacingLocked: () => {
      if (isBareSkillQCastActive()) return true;
      return baseRuntime.isFacingLocked();
    },
  });
};
