import * as THREE from "three";
import { characterGltfAnimationClipsKey } from "../general/engine/characterLoader";
import { createCharacterRuntime } from "../general/runtime/runtimeBase";
import { CharacterRuntimeObject } from "../general/runtime/runtimeObject";
import { tryReflectLinearProjectile } from "../../../object/projectile/reflection";
import type {
  CharacterRuntime,
  CharacterRuntimeFactory,
  CharacterRuntimeUpdate,
  MeleeHitTargetResolvedArgs,
} from "../general/types";
import { profile } from "./profile";

const walkClipName = "walk";
const holdAttackClipName = "normalAttackHold";
const skillQClipName = "skillQ";
const skillQEClipName = "skillQ_E";
const skillEClipName = "skillE";
const skillRClipName = "skillR";
const skillQESkillRClipName = "skillQ_E_R";
const skillQESuperAttack1ClipName = "skillQ_E_normalAtatack1";
const skillQESuperAttack2ClipName = "skillQ_E_normalAtatack2";
const skillQESuperAttack3ClipName = "skillQ_E_normalAtatack3";
const rootPositionTrackName = "Root.position";
const comboContinueWindowMs = 420;
const legTrackPattern = /shoe|leg|foot/i;
const primaryHoldActivationMs = 180;
const primaryHoldTickIntervalMs = 1000;
const primaryHoldStaminaCostPerSecond = 20;
const skillQMinEnergyToCast = 100;
const basicAttackHitManaGain = 4.5;
const burnDamageEnergyGain = 5;
const primaryHoldBaseDamagePerTick = 20;
const primaryHoldSecondaryBurnDamagePerTick = 35;
const primaryHoldSuperBurnDamagePerTick = 60;
const primaryHoldContactRadius = 0.34;
const primaryHoldMidContactRadius = 0.28;
const primaryHoldForwardContactOffset = 0.78;
const primaryHoldForwardContactRadius = 0.42;
const primaryHoldForwardMidContactRadius = 0.34;
const primaryHoldMaxHitsPerTick = 6;
const primaryHoldReflectRadius = 0.66;
const primaryHoldReflectSuperRadiusMultiplier = 1.12;
const primaryHoldReflectCenterLift = 0.04;
const primaryHoldReflectSpeedMultiplier = 1.2;
const primaryHoldWeaponSpinRadPerSecond = Math.PI * 4;
const secondaryBurnPrimaryHoldSpinMultiplier = 2;
const skillQBurningModeDurationMs = 20000;
const burningModeHeadFallbackRelativeOffset = new THREE.Vector3(0, 1.22, 0);
// Q flame tuning knobs: offset is x/y/z, rotation is degrees x/y/z.
const burningModeRelativeOffset = new THREE.Vector3(0, -1.8, -1.2);
const burningModeRelativeRotationDegrees = new THREE.Vector3(0, 0, 0);
const burningModeHeadFadeMs = 260;
const burningModeHeadLift = 0.18;
const burningModeHeadFallbackFromHeadLift = 1.55;
const burningModeHeadFxScale = 1.5;
const burningModeHeadFxWidthScale = 2;
const burningModeCoverPadding = new THREE.Vector3(0.34, 0.3, 0.78);
const burningModePreludeDurationMs = 1500;
const burningModePreludeGatherStartProgress = 0.2;
const burningModePreludeGatherEndProgress = 0.58;
const burningModeFlameGrowthStartProgress = 0.6;
const burningModeFlameGrowthEndProgress = 1;
const burningModePreludeClusterRadiusScale = 0.72;
const burningModeHeadClusterRadiusScale = 0.68;
const secondaryBurnDurationMs = 10000;
const secondaryBurnFallbackLocalOffset = new THREE.Vector3(0, 2.6, 0);
const secondaryBurnOppositeFallbackLocalOffset = new THREE.Vector3(0, 1.62, 0);
const secondaryBurnTipNudge = -0.06;
const secondaryBurnTipBandRatio = 0.04;
const secondaryBurnFxTopLift = 0.06;
const secondaryBurnFxTipDistanceBandRatio = 0.04;
const secondaryBurnAnchorResampleIntervalMs = 8;
const secondaryBurnAnchorWeaponBonePattern = /weapon/i;
const secondaryBurnAnchorFallbackBoneIncludePattern = /(weapon|hand|arm)/i;
const secondaryBurnAnchorFallbackBoneExcludePattern = /(head|shoe|leg|foot)/i;
const secondaryBurnLandingMinTravel = 0.14;
const secondaryBurnLandingRecoveryDistance = 0.012;
const secondaryBurnLandingProgressFloor = 0.22;
const secondaryBurnLateTriggerProgress = 0.72;
const secondaryBurnImpactPulseMs = 360;
const secondaryBurnFadeOutMs = 420;
const secondaryBurnPreludeStartProgress = 0.08;
const secondaryBurnPreludeBuildProgress = 0.42;
const secondaryBurnPreludeGatherStartProgress = 0.48;
const secondaryBurnPreludeGatherEndProgress = 0.62;
const secondaryBurnSkillRProjectileTriggerProgress = 0.4;
const secondaryBurnSkillRProjectileSpeed = 12.5;
const secondaryBurnSkillRProjectileLifetimeSec = 1.35;
const secondaryBurnSkillRProjectileDamage = 46;
const secondaryBurnSkillRProjectileRadius = 0.22;
const secondaryBurnSkillRProjectileTargetHitRadius = 0;
const secondaryBurnSkillRProjectileTrackAlignMs = 90;
const secondaryBurnSkillRProjectileTrackTurnRate = 34;
const secondaryBurnSkillRProjectilePoolSize = 4;
const secondaryBurnSkillRBurnLayer1DurationMs = 4000;
const secondaryBurnSkillRBurnLayer2DurationMs = 5000;
const secondaryBurnSkillRBurnTickIntervalMs = 500;
const secondaryBurnSkillRBurnLayer1TickDamage = 20;
const secondaryBurnSkillRBurnLayer2TickDamage = 30;
const secondaryBurnSkillRBurnAnchorLiftRatio = 0.16;
const secondaryBurnSkillRBurnAnchorLiftMin = 0.16;
const secondaryBurnSkillRBurnAnchorLiftMax = 0.5;
const secondaryBurnSkillRBurnStage2PulseSpeedMultiplier = 1.35;
const secondaryBurnSkillRBurnStage2FerocityMultiplier = 1.36;
const secondaryBurnSkillRBurnExplosionDirectDamage = 120;
const secondaryBurnSkillRBurnExplosionRadius = 3.6;
const secondaryBurnSkillRBurnExplosionDamage = 120;
const secondaryBurnSkillRBurnExplosionMinDamage = 50;
const secondaryBurnSkillRBurnExplosionFxDurationMs = 760;
const secondaryBurnSkillRBurnExplosionBurstProjectileCount = 96;
const secondaryBurnSkillRBurnExplosionBurstSpeed = 24;
const secondaryBurnSkillRBurnExplosionBurstRadius = 0.12;
const secondaryBurnSkillRBurnExplosionBurstVisualScale = 0.18;
const secondaryBurnSkillRBurnExplosionBurstLifetimeSec =
  secondaryBurnSkillRBurnExplosionRadius / secondaryBurnSkillRBurnExplosionBurstSpeed +
  0.08;
const skillRBurnCollisionNamePattern = /hitbox|hurtbox|collider|collision|trigger/i;
const skillRBurnFxRootFlagKey = "__flareSkillRBurnFxRoot";
const secondaryBurnSwingTrailPoolSize = 56;
const secondaryBurnSwingTrailLifetimeMs = 420;
const secondaryBurnSwingTrailMinDistance = 0.008;
const secondaryBurnSwingTrailMaxDistance = 2.4;
const secondaryBurnSwingTrailSpawnIntervalMs = 8;
const superBurnSwingTrailSpawnIntervalMs = 22;
const secondaryBurnFlameBaseHeight = 0.42;
const secondaryBurnSwingTrailVisualMinDistance = 0.22;
const secondaryBurnSwingTrailMinLengthScale = 0.92;
const secondaryBurnSwingTrailMinRadiusScale = 1.42;
const secondaryBurnPrimaryHoldTrailSizeScale = 0.56;
const secondaryBurnPrimaryHoldTrailOpacityScale = 0.34;
const secondaryBurnPrimaryHoldTrailGlowOpacityScale = 0.26;
const secondaryBurnPrimaryHoldSparkRadialScale = 1.18;
const secondaryBurnPrimaryHoldSparkAxialScale = 2.15;
const secondaryBurnPrimaryHoldSparkOpacityScale = 1.22;
const superBurnSparkCountMultiplier = 3;
const superBurnSparkSpreadMultiplier = 1.72;
const superBurnFlameIntensityMultiplier = 1.42;
const superBurnLightIntensityMultiplier = 1.7;
const superBurnComboChainTriggerProgress = 0.72;
const superBurnBasicAttackDamage = 40;
const superBurnBasicAttackBurnStacks = 2;
const superBurnBasicAttackHitIntervalMs = 72;
const superBurnThirdAttackHitStart = 0.04;
const superBurnThirdAttackHitEnd = 0.94;
const superBurnThirdAttackCollisionRadius = 1.48;
const superBurnThirdAttackMaxHits = 6;
const superBurnThirdAttackPoolSpawnProgress = 0.74;
const superBurnThirdAttackPoolFallbackProgress = 0.92;
const superBurnThirdAttackPoolDropThreshold = 0.16;
const superBurnThirdAttackPoolDownwardDeltaThreshold = -0.0012;
const superBurnThirdAttackPoolDurationMs = 6000;
const superBurnThirdAttackPoolTickMs = 1000;
const superBurnThirdAttackPoolTickDamage = 35;
const superBurnThirdAttackPoolRadius = 2.8;
const superBurnThirdAttackPoolForwardOffset = 2.5;
const superBurnThirdAttackPoolGroundLift = 0.03;
const superBurnThirdAttackPoolMaxHitsPerTick = 8;
const superBurnThirdAttackPoolMaxActive = 3;
const superBurnThirdAttackPoolFlameCount = 12;
const superBurnThirdAttackPoolSparkCount = 22;
const superBurnThirdAttackPoolVisualUpdateIntervalMsNear = 16;
const superBurnThirdAttackPoolVisualUpdateIntervalMsFar = 42;
const superBurnThirdAttackPoolHighDetailDistance = 11;
const superBurnThirdAttackPoolHighDetailDistanceSq =
  superBurnThirdAttackPoolHighDetailDistance * superBurnThirdAttackPoolHighDetailDistance;
const superBurnSkillRFanTickIntervalMs = 500;
const superBurnSkillRFanTickDamage = 15;
const superBurnSkillRFanRange = 10;
const superBurnSkillRFanHalfAngleDeg = 42;
const superBurnSkillRFanHalfAngleRad = THREE.MathUtils.degToRad(
  superBurnSkillRFanHalfAngleDeg
);
const superBurnSkillRFanRayCount = 9;
const superBurnSkillRFanRayMaxHits = 4;
const superBurnSkillRFanRayHitRadius = 0.58;
const superBurnSkillRFanHitStart = 0.18;
const superBurnSkillRFanHitEnd = 0.94;
const superBurnSkillRFlameIntensityMultiplier = 1.3;
const superBurnSkillRLightIntensityMultiplier = 1.36;
const superBurnSkillRSparkSpreadMultiplier = 1.28;
const superBurnSkillRFanFxLift = 0.04;
const superBurnSkillRFanFxFlameCount = 40;
const superBurnSkillRFanFxSparkCount = 96;
const secondaryBurnWeaponFlameSizeMultiplier = 1.2;
const secondaryBurnWeaponFlameOpacityMultiplier = 1.24;
const secondaryBurnWeaponLightDistanceMultiplier = 1.22;
const secondaryBurnWeaponTongueScaleMultiplier = 1.2;
const burningModeCameraParticleSuppressDistance = 1.08;
const skillQEPreludeFadeOutMs = 360;
const skillQEIgniteMinProgress = 0.46;
const skillQEIgniteFallbackProgress = 0.78;
const skillQEIgniteMaxDistance = 0.58;
const skillQEPreludeScatterRadiusScale = 2.4;
const skillQEPreludeVisibility = 0.96;
const skillQEPreludeGatherStartProgress = 0.52;
const skillQEPreludeGatherEndProgress = 0.74;
const skillQEPreludeOpacityBoost = 1.9;
const flareWeaponSweepRadiusScale = 0.22;
const flareWeaponContactRadiusScale = 0.16;
const flareWeaponSweepMaxDistance = 0.72;
const flareFirstPersonVisibleBonePattern = /(hand|weapon|arm)/i;
const flareMainCameraLayerMask = 1 << 0;
const flareMiniBodyCameraLayerMask = 1 << 2;

const createBurstDirections = (count: number) => {
  const directions: THREE.Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const y = 1 - t * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    directions.push(
      new THREE.Vector3(
        Math.cos(theta) * radius,
        y,
        Math.sin(theta) * radius
      ).normalize()
    );
  }
  return directions;
};

const secondaryBurnSkillRBurnExplosionBurstDirections = createBurstDirections(
  secondaryBurnSkillRBurnExplosionBurstProjectileCount
);

type AttackStepConfig = {
  clipName: string;
  damage: number;
  hitStart: number;
  hitEnd: number;
  collisionRadius: number;
  maxHits: number;
  comboChainTriggerProgress?: number;
};

const normalAttackCombo: readonly AttackStepConfig[] = [
  {
    clipName: "normalAttack1",
    damage: 18,
    hitStart: 0.18,
    hitEnd: 0.58,
    collisionRadius: 1.05,
    maxHits: 3,
  },
  {
    clipName: "normalAttack2",
    damage: 24,
    hitStart: 0.16,
    hitEnd: 0.6,
    collisionRadius: 1.12,
    maxHits: 3,
  },
  {
    clipName: "normalAttack3",
    damage: 32,
    hitStart: 0.12,
    hitEnd: 0.72,
    collisionRadius: 1.2,
    maxHits: 4,
  },
] as const;

const superBurnAttackCombo: readonly AttackStepConfig[] = [
  {
    ...normalAttackCombo[0],
    clipName: skillQESuperAttack1ClipName,
    damage: superBurnBasicAttackDamage,
    comboChainTriggerProgress: superBurnComboChainTriggerProgress,
  },
  {
    ...normalAttackCombo[1],
    clipName: skillQESuperAttack2ClipName,
    damage: superBurnBasicAttackDamage,
    comboChainTriggerProgress: superBurnComboChainTriggerProgress,
  },
  {
    ...normalAttackCombo[2],
    clipName: skillQESuperAttack3ClipName,
    damage: superBurnBasicAttackDamage,
    hitStart: superBurnThirdAttackHitStart,
    hitEnd: superBurnThirdAttackHitEnd,
    collisionRadius: superBurnThirdAttackCollisionRadius,
    maxHits: superBurnThirdAttackMaxHits,
  },
] as const;

const skillRConfig = {
  damage: 46,
  hitStart: 0.28,
  hitEnd: 0.68,
  collisionRadius: 1.12,
  maxHits: 4,
} as const;

type ActionBinding = {
  clipName: string;
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
};

type WeaponHitConfig = {
  damage: number;
  collisionRadius: number;
  maxHits: number;
};

type AttackClipBinding = ActionBinding & {
  config: AttackStepConfig;
};

type WeaponSampleState = {
  hasWeaponSample: boolean;
};

type FirstPersonProxyMaterialState = {
  material: THREE.Material;
  colorWrite: boolean;
  depthWrite: boolean;
  depthTest: boolean;
};

type FirstPersonMeshSplitEntry = {
  source: THREE.SkinnedMesh;
  sourceLayerMask: number;
  proxy: THREE.SkinnedMesh;
  proxyMaterialStates: FirstPersonProxyMaterialState[];
};

type SecondaryBurnEmber = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
  scale: number;
};

type SecondaryBurnTongue = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  orbitRadius: number;
  orbitSpeed: number;
  baseScale: THREE.Vector3;
  tilt: number;
};

type SecondaryBurnSmoke = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
  scale: number;
};

type SecondaryBurnSpark = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  orbitRadius: number;
  orbitSpeed: number;
  lift: number;
  scale: number;
};

type SecondaryBurnHoldTopParticle = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
  scale: number;
};

type SecondaryBurnHoldTopSpark = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  orbitRadius: number;
  speed: number;
  lift: number;
  scale: number;
};

type BurningModeHeadPlume = {
  pivot: THREE.Group;
  shell: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  phase: number;
  yaw: number;
  radius: number;
  height: number;
  speed: number;
  baseScale: THREE.Vector3;
  lean: number;
  twist: number;
};

type BurningModeHeadJet = {
  pivot: THREE.Group;
  shell: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  phase: number;
  yaw: number;
  radius: number;
  speed: number;
  burst: number;
  baseScale: THREE.Vector3;
  lean: number;
};

type BurningModeHeadTongue = {
  pivot: THREE.Group;
  shell: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  phase: number;
  yaw: number;
  radius: number;
  speed: number;
  burst: number;
  baseScale: THREE.Vector3;
  lean: number;
};

type BurningModeHeadSpark = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
  scale: number;
};

type BurningModeHeadEmber = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
  scale: number;
};

type BurningModeHeadSmoke = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
  radius: number;
  speed: number;
  lift: number;
  scale: number;
};

type SkillRProjectileVisual = {
  root: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  material: THREE.MeshStandardMaterial;
  core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  coreMaterial: THREE.MeshStandardMaterial;
  flames: SecondaryBurnTongue[];
  sparks: SecondaryBurnSpark[];
  inUse: boolean;
  launchedAt: number;
};

type SecondaryBurnSwingTrail = {
  root: THREE.Group;
  outerFlame: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  outerMaterial: THREE.MeshBasicMaterial;
  innerFlame: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  innerMaterial: THREE.MeshBasicMaterial;
  glow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  glowMaterial: THREE.MeshBasicMaterial;
  active: boolean;
  spawnedAt: number;
  endsAt: number;
  radiusScale: number;
  lengthScale: number;
  opacityScale: number;
  glowOpacityScale: number;
  phase: number;
};

type SkillRBurnStage = 1 | 2;

type ActiveSkillRBurn = {
  targetId: string;
  targetObject: THREE.Object3D;
  isTargetActive: () => boolean;
  dealDamageToTarget: (damage: number, now?: number) => void;
  stage: SkillRBurnStage;
  appliedAt: number;
  endsAt: number;
  nextTickAt: number;
  fxRoot: THREE.Group;
  glow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  glowMaterial: THREE.MeshBasicMaterial;
  outerFlame: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  outerMaterial: THREE.MeshBasicMaterial;
  innerFlame: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  innerMaterial: THREE.MeshBasicMaterial;
  headGlow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  headGlowMaterial: THREE.MeshBasicMaterial;
  headOuterFlame: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  headOuterMaterial: THREE.MeshBasicMaterial;
  headInnerFlame: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  headInnerMaterial: THREE.MeshBasicMaterial;
  tongues: SecondaryBurnTongue[];
  embers: SecondaryBurnEmber[];
  sparks: SecondaryBurnSpark[];
  headSparks: SecondaryBurnSpark[];
};

type ActiveSkillRBurnExplosionFx = {
  root: THREE.Group;
  startedAt: number;
  endsAt: number;
  glow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  glowMaterial: THREE.MeshBasicMaterial;
  core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  coreMaterial: THREE.MeshBasicMaterial;
  flames: SecondaryBurnTongue[];
  embers: SecondaryBurnEmber[];
  sparks: SecondaryBurnSpark[];
  light: THREE.PointLight;
};

type SuperBurnFlamePoolEntry = {
  root: THREE.Group;
  center: THREE.Vector3;
  direction: THREE.Vector3;
  radius: number;
  startedAt: number;
  expiresAt: number;
  nextTickAt: number;
  phase: number;
  lastVisualUpdateAt: number;
  core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  coreMaterial: THREE.MeshBasicMaterial;
  ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  ringMaterial: THREE.MeshBasicMaterial;
  glow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  glowMaterial: THREE.MeshBasicMaterial;
  flames: SecondaryBurnTongue[];
  sparks: SecondaryBurnSpark[];
  light: THREE.PointLight;
};

type SuperBurnSkillRFanFlame = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  phase: number;
  yawOffset: number;
  distanceRatio: number;
  speed: number;
  lift: number;
  scale: number;
};

type SuperBurnSkillRFanSpark = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  material: THREE.MeshBasicMaterial;
  phase: number;
  yawOffset: number;
  distanceRatio: number;
  speed: number;
  lift: number;
  scale: number;
};

const createFlameAlphaMap = () => {
  const width = 24;
  const height = 64;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    const verticalFade = Math.pow(Math.sin(v * Math.PI), 0.72);

    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const edgeDistance = Math.abs(u - 0.5) * 2;
      const radialFade = Math.pow(1 - THREE.MathUtils.clamp(edgeDistance, 0, 1), 0.55);
      const alpha = Math.round(
        THREE.MathUtils.clamp(verticalFade * radialFade * 255, 0, 255)
      );
      const index = (y * width + x) * 4;

      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = alpha;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
};

const isMeshObject = (
  object: THREE.Object3D | null
): object is THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> =>
  Boolean((object as THREE.Mesh | null)?.isMesh);

const isSkinnedMeshObject = (
  object: THREE.Object3D | null
): object is THREE.SkinnedMesh =>
  Boolean((object as THREE.SkinnedMesh | null)?.isSkinnedMesh);

const isSkillRBurnInvisibleMaterial = (material: THREE.Material) =>
  material.visible === false || (material.transparent && material.opacity <= 0.02);

const isSkillRBurnInvisibleMesh = (
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
) => {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (!materials.length) return true;
  for (let i = 0; i < materials.length; i += 1) {
    if (!isSkillRBurnInvisibleMaterial(materials[i])) {
      return false;
    }
  }
  return true;
};

const isSkillRBurnCollisionMesh = (
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
) =>
  skillRBurnCollisionNamePattern.test(mesh.name) || isSkillRBurnInvisibleMesh(mesh);

const expandSkillRBurnBoundsByMeshGeometry = ({
  mesh,
  bounds,
  meshBounds,
}: {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
  bounds: THREE.Box3;
  meshBounds: THREE.Box3;
}) => {
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }
  const geometryBounds = geometry.boundingBox;
  if (!geometryBounds) return false;
  meshBounds.copy(geometryBounds).applyMatrix4(mesh.matrixWorld);
  if (meshBounds.isEmpty()) return false;
  if (bounds.isEmpty()) {
    bounds.copy(meshBounds);
  } else {
    bounds.union(meshBounds);
  }
  return true;
};

const resolveSkillRBurnAnchorObject = (targetObject: THREE.Object3D) => {
  if (!targetObject.parent) return targetObject;
  if (isMeshObject(targetObject) && isSkillRBurnCollisionMesh(targetObject)) {
    return targetObject.parent;
  }
  if (skillRBurnCollisionNamePattern.test(targetObject.name) || !targetObject.visible) {
    return targetObject.parent;
  }
  return targetObject;
};

const resolveSkillRBurnBounds = ({
  targetObject,
  bounds,
  meshBounds,
}: {
  targetObject: THREE.Object3D;
  bounds: THREE.Box3;
  meshBounds: THREE.Box3;
}) => {
  const anchorObject = resolveSkillRBurnAnchorObject(targetObject);
  anchorObject.updateWorldMatrix(true, true);
  bounds.makeEmpty();
  let hasRenderableMesh = false;
  anchorObject.traverse((child) => {
    if (!isMeshObject(child) || !child.visible) return;
    if (isSkillRBurnCollisionMesh(child)) return;
    let current: THREE.Object3D | null = child;
    while (current && current !== anchorObject) {
      if (current.userData?.[skillRBurnFxRootFlagKey]) {
        return;
      }
      current = current.parent;
    }
    if (
      expandSkillRBurnBoundsByMeshGeometry({
        mesh: child,
        bounds,
        meshBounds,
      })
    ) {
      hasRenderableMesh = true;
    }
  });
  return hasRenderableMesh;
};

const getAnimationClips = (model: THREE.Object3D) => {
  const clips = model.userData[characterGltfAnimationClipsKey];
  return Array.isArray(clips) ? (clips as THREE.AnimationClip[]) : [];
};

const resolveInPlaceClip = (model: THREE.Object3D, clipName: string) => {
  const clip = getAnimationClips(model).find(
    (entry) => entry.name.trim().toLowerCase() === clipName.trim().toLowerCase()
  );
  if (!clip) return null;
  const tracks = clip.tracks
    .filter((track) => track.name !== rootPositionTrackName)
    .map((track) => track.clone());
  if (!tracks.length) return null;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
};

const resolveInPlaceClipWithFallbacks = (model: THREE.Object3D, clipName: string) => {
  const candidates = [clipName];
  if (clipName.includes("Atatack")) {
    candidates.push(clipName.replace("Atatack", "Attack"));
  }
  if (clipName.includes("Attack")) {
    candidates.push(clipName.replace("Attack", "Atatack"));
  }
  for (let i = 0; i < candidates.length; i += 1) {
    const resolved = resolveInPlaceClip(model, candidates[i]);
    if (resolved) return resolved;
  }
  return null;
};

const filterClipTracks = (
  clip: THREE.AnimationClip | null,
  includeTrack: (track: THREE.KeyframeTrack) => boolean
) => {
  if (!clip) return null;
  const tracks = clip.tracks.filter(includeTrack).map((track) => track.clone());
  if (!tracks.length) return null;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
};

const makeLoopSeamlessClip = (clip: THREE.AnimationClip | null) => {
  if (!clip) return null;

  let startTime = Infinity;
  let endTime = 0;
  for (let i = 0; i < clip.tracks.length; i += 1) {
    const track = clip.tracks[i];
    if (track.times.length === 0) continue;
    startTime = Math.min(startTime, track.times[0]);
    endTime = Math.max(endTime, track.times[track.times.length - 1]);
  }

  if (!Number.isFinite(startTime)) {
    return clip.clone();
  }

  const normalizedStartTime = Math.max(0, startTime);
  const normalizedDuration = Math.max(
    0.001,
    (endTime || clip.duration) - normalizedStartTime
  );

  const tracks = clip.tracks.map((track) => {
    const clonedTrack = track.clone();
    if (normalizedStartTime > 0) {
      for (let i = 0; i < clonedTrack.times.length; i += 1) {
        clonedTrack.times[i] = Math.max(0, clonedTrack.times[i] - normalizedStartTime);
      }
    }
    const valueSize = clonedTrack.getValueSize();
    if (valueSize <= 0 || clonedTrack.values.length < valueSize * 2) {
      return clonedTrack;
    }

    const firstOffset = 0;
    const lastOffset = clonedTrack.values.length - valueSize;
    for (let i = 0; i < valueSize; i += 1) {
      clonedTrack.values[lastOffset + i] = clonedTrack.values[firstOffset + i];
    }

    return clonedTrack;
  });

  return new THREE.AnimationClip(clip.name, normalizedDuration, tracks);
};

const findWeaponNode = (model: THREE.Object3D) => {
  let exactBone: THREE.Object3D | null = null;
  let exactNonMesh: THREE.Object3D | null = null;
  let exactMesh: THREE.Object3D | null = null;
  let fallbackBone: THREE.Object3D | null = null;
  let fallbackNonMesh: THREE.Object3D | null = null;
  let fallbackMesh: THREE.Object3D | null = null;

  model.traverse((child) => {
    if (!child.name) return;
    const normalizedName = child.name.trim().toLowerCase();
    if (!normalizedName) return;
    const isExactWeaponName = /^weapon(?:_[0-9]+)?$/i.test(normalizedName);
    const isWeaponLikeName =
      isExactWeaponName || normalizedName.includes("weapon");
    if (!isWeaponLikeName) return;
    const isMesh = (child as THREE.Mesh).isMesh === true;
    const isBone = (child as THREE.Bone).isBone === true;

    if (isExactWeaponName) {
      if (isBone) {
        if (!exactBone) {
          exactBone = child;
        }
        return;
      }
      if (!isMesh) {
        if (!exactNonMesh) {
          exactNonMesh = child;
        }
        return;
      }
      if (!exactMesh) {
        exactMesh = child;
      }
      return;
    }

    if (isBone) {
      if (!fallbackBone) {
        fallbackBone = child;
      }
      return;
    }
    if (!isMesh) {
      if (!fallbackNonMesh) {
        fallbackNonMesh = child;
      }
      return;
    }
    if (!fallbackMesh) {
      fallbackMesh = child;
    }
  });

  return (
    exactBone ??
    exactNonMesh ??
    fallbackBone ??
    fallbackNonMesh ??
    exactMesh ??
    fallbackMesh
  );
};

const findCoverNode = (model: THREE.Object3D) => {
  let exact: THREE.Object3D | null = null;
  let fallback: THREE.Object3D | null = null;

  model.traverse((child) => {
    if (!child.name) return;
    const nodeName = child.name.trim().toLowerCase();
    if (!exact && nodeName === "cover") {
      exact = child;
      return;
    }
    if (!fallback && nodeName.includes("cover")) {
      fallback = child;
    }
  });

  return exact ?? fallback;
};

const findHeadNode = (model: THREE.Object3D) => {
  let exact: THREE.Object3D | null = null;
  let fallback: THREE.Object3D | null = null;

  model.traverse((child) => {
    if (!child.name) return;
    const nodeName = child.name.trim().toLowerCase();
    if (!exact && nodeName === "head") {
      exact = child;
      return;
    }
    if (!fallback && /head|face|helmet|mask/i.test(nodeName)) {
      fallback = child;
    }
  });

  return exact ?? fallback;
};

const isFirstPersonVisibleBoneName = (boneName: string) =>
  flareFirstPersonVisibleBonePattern.test(boneName.trim().toLowerCase());

const buildFirstPersonVisibleProxyGeometry = (mesh: THREE.SkinnedMesh) => {
  const geometry = mesh.geometry;
  const skinIndex = geometry.getAttribute("skinIndex") as THREE.BufferAttribute | null;
  const skinWeight = geometry.getAttribute("skinWeight") as THREE.BufferAttribute | null;
  const bones = mesh.skeleton?.bones ?? [];
  if (!skinIndex || !skinWeight || !bones.length) return null;

  const vertexCount = Math.min(skinIndex.count, skinWeight.count);
  if (vertexCount <= 0) return null;
  const keepVertex = new Uint8Array(vertexCount);
  for (let i = 0; i < vertexCount; i += 1) {
    let dominantWeight = -Infinity;
    let dominantJoint = -1;
    const j0 = Math.floor(skinIndex.getX(i));
    const j1 = Math.floor(skinIndex.getY(i));
    const j2 = Math.floor(skinIndex.getZ(i));
    const j3 = Math.floor(skinIndex.getW(i));
    const w0 = skinWeight.getX(i);
    const w1 = skinWeight.getY(i);
    const w2 = skinWeight.getZ(i);
    const w3 = skinWeight.getW(i);
    if (w0 > dominantWeight) {
      dominantWeight = w0;
      dominantJoint = j0;
    }
    if (w1 > dominantWeight) {
      dominantWeight = w1;
      dominantJoint = j1;
    }
    if (w2 > dominantWeight) {
      dominantWeight = w2;
      dominantJoint = j2;
    }
    if (w3 > dominantWeight) {
      dominantWeight = w3;
      dominantJoint = j3;
    }
    const dominantBoneName =
      dominantJoint >= 0 && dominantJoint < bones.length ? bones[dominantJoint].name : "";
    if (isFirstPersonVisibleBoneName(dominantBoneName)) {
      keepVertex[i] = 1;
    }
  }

  const keptIndices: number[] = [];
  const sourceIndex = geometry.getIndex();
  if (sourceIndex) {
    for (let i = 0; i + 2 < sourceIndex.count; i += 3) {
      const a = sourceIndex.getX(i);
      const b = sourceIndex.getX(i + 1);
      const c = sourceIndex.getX(i + 2);
      if (
        a < vertexCount &&
        b < vertexCount &&
        c < vertexCount &&
        keepVertex[a] === 1 &&
        keepVertex[b] === 1 &&
        keepVertex[c] === 1
      ) {
        keptIndices.push(a, b, c);
      }
    }
  } else {
    for (let i = 0; i + 2 < vertexCount; i += 3) {
      if (keepVertex[i] === 1 && keepVertex[i + 1] === 1 && keepVertex[i + 2] === 1) {
        keptIndices.push(i, i + 1, i + 2);
      }
    }
  }
  if (!keptIndices.length) return null;

  const proxyGeometry = geometry.clone();
  proxyGeometry.setIndex(keptIndices);
  proxyGeometry.computeBoundingSphere();
  proxyGeometry.computeBoundingBox();
  return proxyGeometry;
};

const findDominantSkinBone = (mesh: THREE.SkinnedMesh) => {
  const skinIndex = mesh.geometry.getAttribute("skinIndex");
  const skinWeight = mesh.geometry.getAttribute("skinWeight");
  const bones = mesh.skeleton?.bones ?? [];
  if (!skinIndex || !skinWeight || !bones.length) return null;

  const boneWeights = new Array<number>(bones.length).fill(0);
  for (let i = 0; i < skinIndex.count; i += 1) {
    const i0 = skinIndex.getX(i);
    const i1 = skinIndex.getY(i);
    const i2 = skinIndex.getZ(i);
    const i3 = skinIndex.getW(i);
    if (i0 < bones.length) boneWeights[i0] += skinWeight.getX(i);
    if (i1 < bones.length) boneWeights[i1] += skinWeight.getY(i);
    if (i2 < bones.length) boneWeights[i2] += skinWeight.getZ(i);
    if (i3 < bones.length) boneWeights[i3] += skinWeight.getW(i);
  }

  let bestIndex = -1;
  let bestWeight = 0;
  for (let i = 0; i < boneWeights.length; i += 1) {
    if (boneWeights[i] <= bestWeight) continue;
    bestWeight = boneWeights[i];
    bestIndex = i;
  }

  return bestIndex >= 0 ? bones[bestIndex] ?? null : null;
};

const isWeaponRenderMesh = (mesh: THREE.Object3D, model: THREE.Object3D) => {
  let current: THREE.Object3D | null = mesh;
  while (current && current !== model) {
    if (/weapon/i.test(current.name)) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

const findWeaponMeshes = (model: THREE.Object3D) => {
  const matches: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.Material | THREE.Material[]
  >[] = [];

  model.traverse((child) => {
    if (!isMeshObject(child) || !isWeaponRenderMesh(child, model)) return;
    matches.push(child);
  });

  return matches;
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

  return {
    clipName,
    clip,
    action,
  };
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

  return {
    clipName,
    clip,
    action,
  };
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

export const createRuntime: CharacterRuntimeFactory = ({
  avatar,
  fireProjectile,
  performMeleeAttack,
  applyEnergy,
  applyMana,
  spendStamina,
  spendEnergy,
  getCurrentStats,
}) => {
  const baseRuntime = createCharacterRuntime({ avatar, profile });
  const avatarForward = new THREE.Vector3();
  const avatarUp = new THREE.Vector3(0, 1, 0);
  const latestAimDirection = new THREE.Vector3();
  const latestAimOriginWorld = new THREE.Vector3();
  let hasAimOriginWorld = false;
  const skillQDirection = new THREE.Vector3();
  const burningModeHeadRelativeOffset =
    burningModeHeadFallbackRelativeOffset.clone();
  const burningModeHeadSurfaceSize = new THREE.Vector3(1, 1, 1);
  const burningModeHeadSurfaceBoundsMin = new THREE.Vector3(
    Infinity,
    Infinity,
    Infinity
  );
  const burningModeHeadSurfaceBoundsMax = new THREE.Vector3(
    -Infinity,
    -Infinity,
    -Infinity
  );
  const burningModeHeadSurfaceBounds = new THREE.Box3();
  const burningModeHeadSurfaceCenterLocal = new THREE.Vector3();
  const burningModeHeadSurfaceVertex = new THREE.Vector3();
  const burningModeHeadSurfaceBoundsCorner = new THREE.Vector3();
  const burningModeAnchorWorldQuaternion = new THREE.Quaternion();
  const burningModeAnchorNeutralizeQuaternion = new THREE.Quaternion();
  const burningModePreludeWorldTarget = new THREE.Vector3();
  const burningModePreludeAuraTargetLocal = new THREE.Vector3();
  const burningModePreludeParticlePosition = new THREE.Vector3();
  const currentWeaponWorldPosition = new THREE.Vector3();
  const previousWeaponWorldPosition = new THREE.Vector3();
  const currentWeaponFxWorldPosition = new THREE.Vector3();
  const previousWeaponFxWorldPosition = new THREE.Vector3();
  const currentWeaponOppositeWorldPosition = new THREE.Vector3();
  const previousWeaponOppositeWorldPosition = new THREE.Vector3();
  const weaponContactMidpointWorldPosition = new THREE.Vector3();
  const primaryHoldForwardContactWorldPosition = new THREE.Vector3();
  const primaryHoldForwardMidContactWorldPosition = new THREE.Vector3();
  const swingDelta = new THREE.Vector3();
  const skillRDirection = new THREE.Vector3();
  const firstPersonHiddenBoneMaskViewport = new THREE.Vector4();
  const secondaryBurnAnchorLocal = secondaryBurnFallbackLocalOffset.clone();
  const secondaryBurnFxAnchorLocal = secondaryBurnFallbackLocalOffset.clone();
  const secondaryBurnOppositeAnchorLocal =
    secondaryBurnOppositeFallbackLocalOffset.clone();
  const secondaryBurnHoldTopLocal = new THREE.Vector3(1.14, 2.64, -0.05);
  const secondaryBurnHoldTopSpread = new THREE.Vector3(0.16, 0.26, 0.16);
  const secondaryBurnTipCandidate = new THREE.Vector3();
  const secondaryBurnTipBest = new THREE.Vector3();
  const secondaryBurnTipDirection = new THREE.Vector3();
  const secondaryBurnTipRangeMin = new THREE.Vector3(Infinity, Infinity, Infinity);
  const secondaryBurnTipRangeMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const secondaryBurnFallbackTipRangeMin = new THREE.Vector3(
    Infinity,
    Infinity,
    Infinity
  );
  const secondaryBurnFallbackTipRangeMax = new THREE.Vector3(
    -Infinity,
    -Infinity,
    -Infinity
  );
  const secondaryBurnFxTipRangeMin = new THREE.Vector3(Infinity, Infinity, Infinity);
  const secondaryBurnFxTipRangeMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const secondaryBurnFxFallbackTipRangeMin = new THREE.Vector3(
    Infinity,
    Infinity,
    Infinity
  );
  const secondaryBurnFxFallbackTipRangeMax = new THREE.Vector3(
    -Infinity,
    -Infinity,
    -Infinity
  );
  const secondaryBurnTipAccum = new THREE.Vector3();
  const secondaryBurnOppositeTipAccum = new THREE.Vector3();
  const secondaryBurnTipSamples: THREE.Vector3[] = [];
  const secondaryBurnFallbackTipSamples: THREE.Vector3[] = [];
  const secondaryBurnFxTipSamples: THREE.Vector3[] = [];
  const secondaryBurnFxFallbackTipSamples: THREE.Vector3[] = [];
  const secondaryBurnHoldAxisLocal = new THREE.Vector3();
  const secondaryBurnHoldMidLocal = new THREE.Vector3();
  const secondaryBurnPreludeWorldTarget = new THREE.Vector3();
  const secondaryBurnPreludeAuraTargetLocal = new THREE.Vector3();
  const secondaryBurnPreludeParticlePosition = new THREE.Vector3();
  const secondaryBurnPreludeTipTargetLocal = new THREE.Vector3();
  const skillRProjectileForwardAxis = new THREE.Vector3(0, 0, 1);
  const skillRProjectileOrigin = new THREE.Vector3();
  const skillRProjectileVelocityDirection = new THREE.Vector3();
  const skillRBurnTargetWorldCenter = new THREE.Vector3();
  const skillRBurnTargetLocalCenter = new THREE.Vector3();
  const skillRBurnTargetSize = new THREE.Vector3();
  const skillRBurnParticlePosition = new THREE.Vector3();
  const skillRBurnBounds = new THREE.Box3();
  const skillRBurnMeshBounds = new THREE.Box3();
  const skillRBurnExplosionCenter = new THREE.Vector3();
  const superBurnFlamePoolSpawnCenter = new THREE.Vector3();
  const superBurnFlamePoolSpawnDirection = new THREE.Vector3();
  const superBurnSkillRFanOrigin = new THREE.Vector3();
  const superBurnSkillRFanDirection = new THREE.Vector3();
  const superBurnSkillRFanFlowDirection = new THREE.Vector3();
  const secondaryBurnSwingTrailDirection = new THREE.Vector3();
  const attackSweepDirection = new THREE.Vector3();
  const primaryHoldAttackDirection = new THREE.Vector3();
  const primaryHoldReflectCenterWorld = new THREE.Vector3();
  const primaryHoldReflectLocalPosition = new THREE.Vector3();
  const reflectedProjectileDirection = new THREE.Vector3();
  const reflectedProjectileHitPoint = new THREE.Vector3();
  const primaryHoldTickHitTargetIds = new Set<string>();
  const mergedProjectileBlockers: THREE.Object3D[] = [];

  const secondaryBurnFlameGeometry = new THREE.ConeGeometry(0.12, 0.42, 12, 1, true);
  secondaryBurnFlameGeometry.translate(0, 0.21, 0);
  const skillRProjectileShellGeometry = new THREE.SphereGeometry(0.18, 14, 14);
  const skillRProjectileCoreGeometry = new THREE.SphereGeometry(0.1, 12, 12);
  const skillRProjectileFlameGeometry = new THREE.ConeGeometry(0.1, 0.32, 12, 1, true);
  skillRProjectileFlameGeometry.translate(0, 0.16, 0);
  const burningModeHeadShellGeometry = new THREE.ConeGeometry(0.24, 0.72, 16, 1, false);
  burningModeHeadShellGeometry.translate(0, 0.34, 0);
  const burningModeHeadCoreGeometry = new THREE.ConeGeometry(0.16, 0.56, 16, 1, false);
  burningModeHeadCoreGeometry.translate(0, 0.26, 0);
  const burningModeHeadPlumeShellGeometry = new THREE.ConeGeometry(
    0.12,
    0.42,
    14,
    1,
    false
  );
  burningModeHeadPlumeShellGeometry.translate(0, 0.21, 0);
  const burningModeHeadPlumeCoreGeometry = new THREE.ConeGeometry(
    0.072,
    0.3,
    14,
    1,
    false
  );
  burningModeHeadPlumeCoreGeometry.translate(0, 0.15, 0);
  const burningModeHeadSparkGeometry = new THREE.SphereGeometry(0.03, 7, 7);
  const burningModeHeadEmberGeometry = new THREE.SphereGeometry(0.042, 8, 8);
  const burningModeHeadSmokeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
  const superBurnFlamePoolCoreGeometry = new THREE.CircleGeometry(1, 36);
  const superBurnFlamePoolRingGeometry = new THREE.RingGeometry(0.66, 1, 40);
  const superBurnFlamePoolSparkGeometry = new THREE.OctahedronGeometry(0.032, 0);
  const superBurnSkillRFanFillGeometry = new THREE.CircleGeometry(
    1,
    56,
    -Math.PI * 0.5 - superBurnSkillRFanHalfAngleRad,
    superBurnSkillRFanHalfAngleRad * 2
  );
  const superBurnSkillRFanEdgeGeometry = new THREE.RingGeometry(
    0.82,
    1,
    56,
    1,
    -Math.PI * 0.5 - superBurnSkillRFanHalfAngleRad,
    superBurnSkillRFanHalfAngleRad * 2
  );
  const superBurnSkillRFanFlameGeometry = new THREE.ConeGeometry(
    0.11,
    0.58,
    9,
    1,
    true
  );
  superBurnSkillRFanFlameGeometry.translate(0, 0.29, 0);
  const burningModeHeadAlphaMap = createFlameAlphaMap();
  const secondaryBurnHaloGeometry = new THREE.TorusGeometry(0.1, 0.026, 10, 22);
  const secondaryBurnCoronaGeometry = new THREE.TorusGeometry(0.14, 0.015, 10, 28);
  const secondaryBurnGlowGeometry = new THREE.SphereGeometry(0.11, 12, 12);
  const secondaryBurnEmberGeometry = new THREE.SphereGeometry(0.04, 8, 8);
  const secondaryBurnSmokeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
  const secondaryBurnSparkGeometry = new THREE.OctahedronGeometry(0.028, 0);
  const primaryHoldReflectBlockerGeometry = new THREE.SphereGeometry(1, 16, 14);
  const secondaryBurnOuterMaterial = new THREE.MeshBasicMaterial({
    color: 0xff6b1a,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const secondaryBurnInnerMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff1a8,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const secondaryBurnHaloMaterial = new THREE.MeshBasicMaterial({
    color: 0xffa84a,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const secondaryBurnGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const secondaryBurnCoronaMaterial = new THREE.MeshBasicMaterial({
    color: 0xffcf73,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const secondaryBurnOuterCoronaMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7b1f,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const secondaryBurnHoldTopGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffcf73,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const primaryHoldReflectBlockerMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
    side: THREE.DoubleSide,
  });
  const primaryHoldReflectBlocker = new THREE.Mesh(
    primaryHoldReflectBlockerGeometry,
    primaryHoldReflectBlockerMaterial
  );
  primaryHoldReflectBlocker.visible = false;
  primaryHoldReflectBlocker.frustumCulled = false;
  (primaryHoldReflectBlocker.userData as { projectileReflector?: unknown }).projectileReflector =
    () => ({
      speedMultiplier: primaryHoldReflectSpeedMultiplier,
    });
  avatar.add(primaryHoldReflectBlocker);
  const secondaryBurnPreludeFxRoot = new THREE.Group();
  secondaryBurnPreludeFxRoot.visible = false;
  secondaryBurnPreludeFxRoot.position.copy(secondaryBurnFxAnchorLocal);
  const secondaryBurnPreludeAuraFxRoot = new THREE.Group();
  secondaryBurnPreludeAuraFxRoot.visible = false;
  const secondaryBurnFxRoot = new THREE.Group();
  secondaryBurnFxRoot.visible = false;
  secondaryBurnFxRoot.position.copy(secondaryBurnFxAnchorLocal);
  const secondaryBurnHoldTopFxRoot = new THREE.Group();
  secondaryBurnHoldTopFxRoot.visible = false;
  secondaryBurnHoldTopFxRoot.position.copy(secondaryBurnHoldTopLocal);
  const secondaryBurnSwingTrailFxRoot = new THREE.Group();
  secondaryBurnSwingTrailFxRoot.visible = true;
  const secondaryBurnLight = new THREE.PointLight(0xff8c33, 1.1, 2.4, 2);
  secondaryBurnLight.position.y = 0.18;
  secondaryBurnLight.visible = false;
  const secondaryBurnHoldTopGlow = new THREE.Mesh(
    secondaryBurnGlowGeometry,
    secondaryBurnHoldTopGlowMaterial
  );
  secondaryBurnHoldTopGlow.scale.set(0.72, 0.52, 0.72);
  secondaryBurnHoldTopGlow.frustumCulled = false;
  secondaryBurnHoldTopFxRoot.add(secondaryBurnHoldTopGlow);
  const secondaryBurnOuterFlame = new THREE.Mesh(
    secondaryBurnFlameGeometry,
    secondaryBurnOuterMaterial
  );
  secondaryBurnOuterFlame.position.y = 0;
  secondaryBurnOuterFlame.frustumCulled = false;
  const secondaryBurnInnerFlame = new THREE.Mesh(
    secondaryBurnFlameGeometry,
    secondaryBurnInnerMaterial
  );
  secondaryBurnInnerFlame.position.y = 0.03;
  secondaryBurnInnerFlame.scale.set(0.62, 0.76, 0.62);
  secondaryBurnInnerFlame.frustumCulled = false;
  const secondaryBurnHalo = new THREE.Mesh(
    secondaryBurnHaloGeometry,
    secondaryBurnHaloMaterial
  );
  secondaryBurnHalo.position.y = 0.015;
  secondaryBurnHalo.rotation.x = Math.PI / 2;
  secondaryBurnHalo.frustumCulled = false;
  const secondaryBurnGlow = new THREE.Mesh(
    secondaryBurnGlowGeometry,
    secondaryBurnGlowMaterial
  );
  secondaryBurnGlow.position.y = 0.08;
  secondaryBurnGlow.scale.set(1.1, 0.7, 1.1);
  secondaryBurnGlow.frustumCulled = false;
  const secondaryBurnCorona = new THREE.Mesh(
    secondaryBurnCoronaGeometry,
    secondaryBurnCoronaMaterial
  );
  secondaryBurnCorona.position.y = 0.14;
  secondaryBurnCorona.rotation.set(Math.PI / 2, 0, 0.35);
  secondaryBurnCorona.frustumCulled = false;
  const secondaryBurnOuterCorona = new THREE.Mesh(
    secondaryBurnCoronaGeometry,
    secondaryBurnOuterCoronaMaterial
  );
  secondaryBurnOuterCorona.position.y = 0.18;
  secondaryBurnOuterCorona.rotation.set(Math.PI / 3.2, 0.5, 0);
  secondaryBurnOuterCorona.scale.set(1.18, 1.18, 1.18);
  secondaryBurnOuterCorona.frustumCulled = false;
  secondaryBurnFxRoot.add(
    secondaryBurnOuterFlame,
    secondaryBurnInnerFlame,
    secondaryBurnHalo,
    secondaryBurnGlow,
    secondaryBurnCorona,
    secondaryBurnOuterCorona,
    secondaryBurnLight
  );
  const secondaryBurnTongues: SecondaryBurnTongue[] = Array.from(
    { length: 8 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 3 === 1 ? 0xfff1a8 : index % 2 === 0 ? 0xff7b1f : 0xffa13c,
        transparent: true,
        opacity: index % 3 === 1 ? 0.74 : 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(secondaryBurnFlameGeometry, material);
      mesh.position.y = 0.008 + index * 0.011;
      mesh.scale.set(
        0.44 - index * 0.035,
        0.84 - index * 0.07,
        0.44 - index * 0.035
      );
      mesh.frustumCulled = false;
      secondaryBurnFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 8) * Math.PI * 2,
        orbitRadius: 0.012 + index * 0.008,
        orbitSpeed: 1.6 + index * 0.28,
        baseScale: mesh.scale.clone(),
        tilt: 0.16 + index * 0.035,
      };
    }
  );
  const secondaryBurnEmbers: SecondaryBurnEmber[] = Array.from(
    { length: 14 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 3 === 0 ? 0xfff1a8 : index % 2 === 0 ? 0xffe08a : 0xff7f2a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnEmberGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      secondaryBurnFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 14) * Math.PI * 2,
        radius: 0.05 + index * 0.01,
        speed: 1.7 + index * 0.18,
        lift: 0.18 + index * 0.025,
        scale: 0.48 + index * 0.06,
      };
    }
  );
  const secondaryBurnSmokeWisps: SecondaryBurnSmoke[] = Array.from(
    { length: 6 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0x4a3328,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(secondaryBurnSmokeGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      secondaryBurnFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 6) * Math.PI * 2,
        radius: 0.018 + index * 0.006,
        speed: 0.42 + index * 0.09,
        lift: 0.2 + index * 0.04,
        scale: 0.58 + index * 0.12,
      };
    }
  );
  const secondaryBurnSparks: SecondaryBurnSpark[] = Array.from(
    { length: 36 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xfff3bf : 0xff9a3a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnSparkGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      secondaryBurnFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 36) * Math.PI * 2,
        orbitRadius: 0.09 + index * 0.009,
        orbitSpeed: 2.8 + index * 0.22,
        lift: 0.1 + index * 0.01,
        scale: 0.5 + index * 0.06,
      };
    }
  );
  const secondaryBurnHoldTopParticles: SecondaryBurnHoldTopParticle[] = Array.from(
    { length: 36 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 3 === 0 ? 0xfff1a8 : index % 2 === 0 ? 0xffa84a : 0xff7b1f,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnEmberGeometry, material);
      mesh.frustumCulled = false;
      mesh.visible = false;
      secondaryBurnHoldTopFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 36) * Math.PI * 2,
        radius: 0.03 + index * 0.008,
        speed: 1.4 + index * 0.18,
        lift: 0.16 + index * 0.024,
        scale: 0.42 + index * 0.06,
      };
    }
  );
  const secondaryBurnHoldTopSparks: SecondaryBurnHoldTopSpark[] = Array.from(
    { length: 42 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xfff3bf : 0xff9f3a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnSparkGeometry, material);
      mesh.frustumCulled = false;
      mesh.visible = false;
      secondaryBurnHoldTopFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 42) * Math.PI * 2,
        orbitRadius: 0.04 + index * 0.012,
        speed: 2.2 + index * 0.26,
        lift: 0.12 + index * 0.016,
        scale: 0.48 + index * 0.08,
      };
    }
  );
  const secondaryBurnSwingTrails: SecondaryBurnSwingTrail[] = Array.from(
    { length: secondaryBurnSwingTrailPoolSize },
    (_, index) => {
      const root = new THREE.Group();
      root.visible = false;

      const outerMaterial = new THREE.MeshBasicMaterial({
        color: 0xff7a1f,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const outerFlame = new THREE.Mesh(secondaryBurnFlameGeometry, outerMaterial);
      outerFlame.frustumCulled = false;
      root.add(outerFlame);

      const innerMaterial = new THREE.MeshBasicMaterial({
        color: 0xfff1b4,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const innerFlame = new THREE.Mesh(secondaryBurnFlameGeometry, innerMaterial);
      innerFlame.scale.set(0.62, 0.86, 0.62);
      innerFlame.frustumCulled = false;
      root.add(innerFlame);

      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffba5a,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(secondaryBurnGlowGeometry, glowMaterial);
      glow.frustumCulled = false;
      root.add(glow);

      secondaryBurnSwingTrailFxRoot.add(root);
      return {
        root,
        outerFlame,
        outerMaterial,
        innerFlame,
        innerMaterial,
        glow,
        glowMaterial,
        active: false,
        spawnedAt: 0,
        endsAt: 0,
        radiusScale: 1,
        lengthScale: 1,
        opacityScale: 1,
        glowOpacityScale: 1,
        phase:
          (index / Math.max(1, secondaryBurnSwingTrailPoolSize)) * Math.PI * 2,
      };
    }
  );
  const secondaryBurnPreludeEmbers: SecondaryBurnEmber[] = Array.from(
    { length: 24 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 3 === 0 ? 0xfff0b3 : index % 2 === 0 ? 0xffc56a : 0xff7f2a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnEmberGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      secondaryBurnPreludeFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 24) * Math.PI * 2,
        radius: 0.036 + index * 0.0072,
        speed: 1.36 + index * 0.11,
        lift: 0.15 + index * 0.022,
        scale: 0.42 + index * 0.046,
      };
    }
  );
  const secondaryBurnPreludeSparks: SecondaryBurnSpark[] = Array.from(
    { length: 30 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xfff3bf : 0xff9a3a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnSparkGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      secondaryBurnPreludeFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 30) * Math.PI * 2,
        orbitRadius: 0.056 + index * 0.008,
        orbitSpeed: 2.3 + index * 0.16,
        lift: 0.1 + index * 0.012,
        scale: 0.44 + index * 0.04,
      };
    }
  );
  const secondaryBurnPreludeAuraEmbers: SecondaryBurnEmber[] = Array.from(
    { length: 72 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 4 === 0
            ? 0xfff2be
            : index % 3 === 0
              ? 0xffcf73
              : index % 2 === 0
                ? 0xff9a3a
                : 0xff6f22,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnEmberGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      secondaryBurnPreludeAuraFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 72) * Math.PI * 2,
        radius: 0.5 + (index % 7) * 0.09,
        speed: 1.08 + index * 0.038,
        lift: 0.86 + (index % 8) * 0.09,
        scale: 0.42 + (index % 5) * 0.065,
      };
    }
  );
  const secondaryBurnPreludeAuraSparks: SecondaryBurnSpark[] = Array.from(
    { length: 72 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? 0xfff3bf : index % 2 === 0 ? 0xffb04a : 0xff8129,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnSparkGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      secondaryBurnPreludeAuraFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 72) * Math.PI * 2,
        orbitRadius: 0.62 + (index % 6) * 0.11,
        orbitSpeed: 1.44 + index * 0.048,
        lift: 0.72 + (index % 6) * 0.078,
        scale: 0.4 + (index % 5) * 0.052,
      };
    }
  );
  const burningModeHeadShellMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8d28,
    emissive: 0xff6119,
    emissiveIntensity: 1.15,
    alphaMap: burningModeHeadAlphaMap,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    side: THREE.FrontSide,
    roughness: 0.42,
    metalness: 0,
    flatShading: true,
  });
  const burningModeHeadCoreMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff5bd,
    emissive: 0xffd875,
    emissiveIntensity: 1.9,
    alphaMap: burningModeHeadAlphaMap,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    side: THREE.FrontSide,
    roughness: 0.18,
    metalness: 0,
    flatShading: true,
  });
  const burningModeHeadFxAnchor = new THREE.Group();
  burningModeHeadFxAnchor.position.copy(burningModeHeadFallbackRelativeOffset);
  const burningModeHeadFxRoot = new THREE.Group();
  burningModeHeadFxAnchor.add(burningModeHeadFxRoot);
  burningModeHeadFxRoot.visible = false;
  const burningModeHeadLight = new THREE.PointLight(0xff9b3d, 1.35, 3.4, 2);
  burningModeHeadLight.position.y = 0;
  burningModeHeadLight.visible = false;
  const burningModeHeadShell = new THREE.Mesh(
    burningModeHeadShellGeometry,
    burningModeHeadShellMaterial
  );
  burningModeHeadShell.position.y = -0.18;
  burningModeHeadShell.scale.set(1.08, 1.18, 1.08);
  burningModeHeadShell.frustumCulled = false;
  const burningModeHeadCore = new THREE.Mesh(
    burningModeHeadCoreGeometry,
    burningModeHeadCoreMaterial
  );
  burningModeHeadCore.position.y = -0.12;
  burningModeHeadCore.scale.set(0.84, 0.98, 0.84);
  burningModeHeadCore.frustumCulled = false;
  burningModeHeadFxRoot.add(
    burningModeHeadShell,
    burningModeHeadCore,
    burningModeHeadLight
  );
  const burningModeHeadPlumes: BurningModeHeadPlume[] = Array.from(
    { length: 30 },
    (_, index) => {
      const shellMaterial = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0xffa53a : 0xff7d22,
        emissive: index % 2 === 0 ? 0xff6f1e : 0xff5715,
        emissiveIntensity: 1.05,
        alphaMap: burningModeHeadAlphaMap,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        side: THREE.FrontSide,
        roughness: 0.4,
        metalness: 0,
        flatShading: true,
      });
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0xfff0b4 : 0xffffd2,
        emissive: index % 2 === 0 ? 0xffcf68 : 0xffe3a1,
        emissiveIntensity: 1.6,
        alphaMap: burningModeHeadAlphaMap,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.FrontSide,
        roughness: 0.18,
        metalness: 0,
        flatShading: true,
      });
      const pivot = new THREE.Group();
      const shell = new THREE.Mesh(
        burningModeHeadPlumeShellGeometry,
        shellMaterial
      );
      shell.frustumCulled = false;
      const core = new THREE.Mesh(
        burningModeHeadPlumeCoreGeometry,
        coreMaterial
      );
      core.position.y = 0.012;
      core.frustumCulled = false;
      pivot.add(shell, core);
      burningModeHeadFxRoot.add(pivot);
      const heightBands = [0.14, 0.34, 0.58, 0.82];
      return {
        pivot,
        shell,
        core,
        phase: (index / 30) * Math.PI * 2,
        yaw: (index / 30) * Math.PI * 2,
        radius: 0.98 + (index % 5) * 0.11,
        height: heightBands[index % heightBands.length],
        speed: 0.92 + (index % 5) * 0.1,
        baseScale: new THREE.Vector3(
          0.94 + (index % 4) * 0.12,
          1.08 + (index % 3) * 0.12,
          0.98 + (index % 4) * 0.14
        ),
        lean: 0.24 + (index % 4) * 0.04,
        twist: index % 2 === 0 ? 0.12 : -0.12,
      };
    }
  );
  const burningModeHeadJets: BurningModeHeadJet[] = Array.from(
    { length: 24 },
    (_, index) => {
      const shellMaterial = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0xff9c2d : 0xff6e1f,
        emissive: index % 2 === 0 ? 0xff741f : 0xff4f15,
        emissiveIntensity: 1.2,
        alphaMap: burningModeHeadAlphaMap,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        side: THREE.FrontSide,
        roughness: 0.34,
        metalness: 0,
        flatShading: true,
      });
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0xfff4c3 : 0xffffe0,
        emissive: index % 2 === 0 ? 0xffd777 : 0xffefaa,
        emissiveIntensity: 1.72,
        alphaMap: burningModeHeadAlphaMap,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        side: THREE.FrontSide,
        roughness: 0.14,
        metalness: 0,
        flatShading: true,
      });
      const pivot = new THREE.Group();
      const shell = new THREE.Mesh(
        burningModeHeadPlumeShellGeometry,
        shellMaterial
      );
      shell.frustumCulled = false;
      const core = new THREE.Mesh(
        burningModeHeadPlumeCoreGeometry,
        coreMaterial
      );
      core.position.y = 0.03;
      core.frustumCulled = false;
      pivot.add(shell, core);
      burningModeHeadFxRoot.add(pivot);
      return {
        pivot,
        shell,
        core,
        phase: (index / 24) * Math.PI * 2,
        yaw: (index / 24) * Math.PI * 2,
        radius: 0.72 + (index % 4) * 0.09,
        speed: 1.18 + (index % 6) * 0.11,
        burst: 0.72 + (index % 5) * 0.08,
        baseScale: new THREE.Vector3(
          1.04 + (index % 3) * 0.14,
          1.28 + (index % 4) * 0.14,
          1.08 + (index % 3) * 0.16
        ),
        lean: 0.26 + (index % 4) * 0.04,
      };
    }
  );
  const burningModeHeadTongues: BurningModeHeadTongue[] = Array.from(
    { length: 18 },
    (_, index) => {
      const shellMaterial = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0xffaf3a : 0xff7a22,
        emissive: index % 2 === 0 ? 0xff7b22 : 0xff5618,
        emissiveIntensity: 1.18,
        alphaMap: burningModeHeadAlphaMap,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        side: THREE.FrontSide,
        roughness: 0.32,
        metalness: 0,
        flatShading: true,
      });
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0xfff6cf : 0xffffeb,
        emissive: index % 2 === 0 ? 0xffdc8a : 0xffefbc,
        emissiveIntensity: 1.76,
        alphaMap: burningModeHeadAlphaMap,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.FrontSide,
        roughness: 0.12,
        metalness: 0,
        flatShading: true,
      });
      const pivot = new THREE.Group();
      const shell = new THREE.Mesh(
        burningModeHeadPlumeShellGeometry,
        shellMaterial
      );
      shell.frustumCulled = false;
      const core = new THREE.Mesh(
        burningModeHeadPlumeCoreGeometry,
        coreMaterial
      );
      core.position.y = 0.02;
      core.frustumCulled = false;
      pivot.add(shell, core);
      burningModeHeadFxRoot.add(pivot);
      return {
        pivot,
        shell,
        core,
        phase: (index / 18) * Math.PI * 2,
        yaw: (index / 18) * Math.PI * 2,
        radius: 0.28 + (index % 4) * 0.05,
        speed: 1.24 + (index % 5) * 0.12,
        burst: 0.78 + (index % 4) * 0.08,
        baseScale: new THREE.Vector3(
          0.82 + (index % 3) * 0.1,
          1.02 + (index % 4) * 0.1,
          0.82 + (index % 3) * 0.1
        ),
        lean: 0.18 + (index % 4) * 0.04,
      };
    }
  );
  const burningModeHeadSparks: BurningModeHeadSpark[] = Array.from(
    { length: 56 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 3 === 0 ? 0xfff3c4 : index % 2 === 0 ? 0xffd98c : 0xff9b37,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(burningModeHeadSparkGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      burningModeHeadFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 56) * Math.PI * 2,
        radius: 0.24 + index * 0.032,
        speed: 1.7 + index * 0.1,
        lift: 0.96 + index * 0.04,
        scale: 0.26 + index * 0.02,
      };
    }
  );
  const burningModeHeadEmbers: BurningModeHeadEmber[] = Array.from(
    { length: 72 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 4 === 0
            ? 0xfff4bf
            : index % 3 === 0
              ? 0xffc861
              : index % 2 === 0
                ? 0xff932b
                : 0xff6d1a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(burningModeHeadEmberGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      burningModeHeadFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 72) * Math.PI * 2,
        radius: 0.2 + (index % 12) * 0.05,
        speed: 1 + index * 0.03,
        lift: 1.08 + (index % 8) * 0.08,
        scale: 0.24 + (index % 7) * 0.05,
      };
    }
  );
  const burningModeHeadSmokeWisps: BurningModeHeadSmoke[] = Array.from(
    { length: 16 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0x5f4334 : 0x3f2b24,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(burningModeHeadSmokeGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      burningModeHeadFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 16) * Math.PI * 2,
        radius: 0.24 + index * 0.05,
        speed: 0.28 + index * 0.05,
        lift: 0.96 + index * 0.06,
        scale: 0.42 + index * 0.06,
      };
    }
  );
  const burningModePreludeAuraFxRoot = new THREE.Group();
  burningModePreludeAuraFxRoot.visible = false;
  const burningModePreludeAuraEmbers: BurningModeHeadEmber[] = Array.from(
    { length: 224 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 4 === 0
            ? 0xfff4bf
            : index % 3 === 0
              ? 0xffc861
              : index % 2 === 0
                ? 0xff932b
                : 0xff6d1a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(burningModeHeadEmberGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      burningModePreludeAuraFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 224) * Math.PI * 2,
        radius: 0.54 + (index % 9) * 0.102,
        speed: 1.12 + index * 0.02,
        lift: 1 + (index % 11) * 0.096,
        scale: 0.38 + (index % 6) * 0.058,
      };
    }
  );
  const burningModePreludeAuraSparks: BurningModeHeadSpark[] = Array.from(
    { length: 160 },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 3 === 0 ? 0xfff3c4 : index % 2 === 0 ? 0xffd98c : 0xff9b37,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(burningModeHeadSparkGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      burningModePreludeAuraFxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 160) * Math.PI * 2,
        radius: 0.66 + (index % 8) * 0.12,
        speed: 1.42 + index * 0.026,
        lift: 0.9 + (index % 9) * 0.086,
        scale: 0.36 + (index % 5) * 0.052,
      };
    }
  );
  const superBurnSkillRFanFxRoot = new THREE.Group();
  superBurnSkillRFanFxRoot.visible = false;
  const superBurnSkillRFanFillMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7a20,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const superBurnSkillRFanFill = new THREE.Mesh(
    superBurnSkillRFanFillGeometry,
    superBurnSkillRFanFillMaterial
  );
  superBurnSkillRFanFill.rotation.x = -Math.PI * 0.5;
  superBurnSkillRFanFill.position.y = superBurnSkillRFanFxLift;
  superBurnSkillRFanFill.frustumCulled = false;
  superBurnSkillRFanFxRoot.add(superBurnSkillRFanFill);

  const superBurnSkillRFanEdgeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffca64,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const superBurnSkillRFanEdge = new THREE.Mesh(
    superBurnSkillRFanEdgeGeometry,
    superBurnSkillRFanEdgeMaterial
  );
  superBurnSkillRFanEdge.rotation.x = -Math.PI * 0.5;
  superBurnSkillRFanEdge.position.y = superBurnSkillRFanFxLift + 0.01;
  superBurnSkillRFanEdge.frustumCulled = false;
  superBurnSkillRFanFxRoot.add(superBurnSkillRFanEdge);

  const superBurnSkillRFanGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffc36d,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const superBurnSkillRFanGlow = new THREE.Mesh(
    secondaryBurnGlowGeometry,
    superBurnSkillRFanGlowMaterial
  );
  superBurnSkillRFanGlow.position.y = superBurnSkillRFanFxLift + 0.12;
  superBurnSkillRFanGlow.scale.set(1.2, 0.45, 1.2);
  superBurnSkillRFanGlow.frustumCulled = false;
  superBurnSkillRFanFxRoot.add(superBurnSkillRFanGlow);

  const superBurnSkillRFanLight = new THREE.PointLight(0xffa74b, 0, 0, 2);
  superBurnSkillRFanLight.position.set(0, superBurnSkillRFanFxLift + 0.34, 0);
  superBurnSkillRFanFxRoot.add(superBurnSkillRFanLight);

  const superBurnSkillRFanSourceMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe08a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const superBurnSkillRFanSource = new THREE.Mesh(
    superBurnSkillRFanFlameGeometry,
    superBurnSkillRFanSourceMaterial
  );
  superBurnSkillRFanSource.position.set(0, superBurnSkillRFanFxLift + 0.08, 0.16);
  superBurnSkillRFanSource.rotation.x = -Math.PI * 0.5;
  superBurnSkillRFanSource.scale.set(1.05, 2.4, 1.05);
  superBurnSkillRFanSource.frustumCulled = false;
  superBurnSkillRFanFxRoot.add(superBurnSkillRFanSource);

  const superBurnSkillRFanFlames: SuperBurnSkillRFanFlame[] = Array.from(
    { length: superBurnSkillRFanFxFlameCount },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xff8e2a : 0xffd276,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(superBurnSkillRFanFlameGeometry, material);
      mesh.frustumCulled = false;
      superBurnSkillRFanFxRoot.add(mesh);
      const t =
        superBurnSkillRFanFxFlameCount <= 1
          ? 0.5
          : index / (superBurnSkillRFanFxFlameCount - 1);
      const row = Math.floor((index / superBurnSkillRFanFxFlameCount) * 4);
      return {
        mesh,
        material,
        phase: (index / superBurnSkillRFanFxFlameCount) * Math.PI * 2,
        yawOffset: THREE.MathUtils.lerp(
          -superBurnSkillRFanHalfAngleRad,
          superBurnSkillRFanHalfAngleRad,
          t
        ),
        distanceRatio: THREE.MathUtils.clamp(0.16 + row * 0.2 + (index % 6) * 0.05, 0.16, 0.96),
        speed: 1.2 + (index % 7) * 0.17,
        lift: 0.1 + (index % 4) * 0.06,
        scale: 0.64 + (index % 5) * 0.12,
      };
    }
  );

  const superBurnSkillRFanSparks: SuperBurnSkillRFanSpark[] = Array.from(
    { length: superBurnSkillRFanFxSparkCount },
    (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xfff1bf : 0xffb350,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnSparkGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      superBurnSkillRFanFxRoot.add(mesh);
      const t =
        superBurnSkillRFanFxSparkCount <= 1
          ? 0.5
          : index / (superBurnSkillRFanFxSparkCount - 1);
      return {
        mesh,
        material,
        phase: (index / superBurnSkillRFanFxSparkCount) * Math.PI * 2,
        yawOffset: THREE.MathUtils.lerp(
          -superBurnSkillRFanHalfAngleRad,
          superBurnSkillRFanHalfAngleRad,
          t
        ),
        distanceRatio: THREE.MathUtils.clamp(0.12 + (index % 11) * 0.08, 0.12, 0.98),
        speed: 1.8 + (index % 9) * 0.22,
        lift: 0.22 + (index % 6) * 0.08,
        scale: 0.36 + (index % 4) * 0.09,
      };
    }
  );
  const createSkillRProjectileVisual = (): SkillRProjectileVisual => {
    const material = new THREE.MeshStandardMaterial({
      color: 0xff8f2f,
      emissive: 0xff5c1b,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      roughness: 0.26,
      metalness: 0,
    });
    const root = new THREE.Mesh(skillRProjectileShellGeometry, material);
    root.visible = false;
    root.frustumCulled = false;

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff1af,
      emissive: 0xffd87f,
      emissiveIntensity: 2.1,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      roughness: 0.12,
      metalness: 0,
    });
    const core = new THREE.Mesh(skillRProjectileCoreGeometry, coreMaterial);
    core.frustumCulled = false;
    root.add(core);

    const flames: SecondaryBurnTongue[] = Array.from({ length: 5 }, (_, index) => {
      const flameMaterial = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? 0xffb347 : 0xff7b1f,
        emissive: index % 2 === 0 ? 0xff7a22 : 0xff5518,
        emissiveIntensity: 1.46,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        side: THREE.DoubleSide,
        roughness: 0.34,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(skillRProjectileFlameGeometry, flameMaterial);
      mesh.frustumCulled = false;
      mesh.rotation.x = Math.PI / 2;
      root.add(mesh);
      return {
        mesh,
        material: flameMaterial,
        phase: (index / 5) * Math.PI * 2,
        orbitRadius: 0.05 + index * 0.018,
        orbitSpeed: 1.8 + index * 0.22,
        baseScale: new THREE.Vector3(
          0.56 + index * 0.06,
          0.84 + index * 0.08,
          0.56 + index * 0.04
        ),
        tilt: 0.28 + index * 0.07,
      };
    });

    const sparks: SecondaryBurnSpark[] = Array.from({ length: 18 }, (_, index) => {
      const sparkMaterial = new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? 0xfff3bf : index % 2 === 0 ? 0xffc56a : 0xff7f2a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnSparkGeometry, sparkMaterial);
      mesh.visible = false;
      mesh.frustumCulled = false;
      root.add(mesh);
      return {
        mesh,
        material: sparkMaterial,
        phase: (index / 18) * Math.PI * 2,
        orbitRadius: 0.16 + index * 0.014,
        orbitSpeed: 2.8 + index * 0.18,
        lift: 0.06 + index * 0.008,
        scale: 0.32 + index * 0.032,
      };
    });

    return {
      root,
      material,
      core,
      coreMaterial,
      flames,
      sparks,
      inUse: false,
      launchedAt: 0,
    };
  };

  const resetSkillRProjectileVisual = (entry: SkillRProjectileVisual) => {
    entry.inUse = false;
    entry.launchedAt = 0;
    entry.root.visible = false;
    entry.root.removeFromParent();
    entry.root.position.set(0, 0, 0);
    entry.root.rotation.set(0, 0, 0);
    entry.root.quaternion.identity();
    entry.root.scale.setScalar(1);
    entry.material.opacity = 0.94;
    entry.material.emissiveIntensity = 1.8;
    entry.coreMaterial.opacity = 0.96;
    entry.coreMaterial.emissiveIntensity = 2.1;
    entry.core.scale.setScalar(1);
    for (let i = 0; i < entry.flames.length; i += 1) {
      const flame = entry.flames[i];
      flame.mesh.visible = true;
      flame.mesh.position.set(0, 0, 0);
      flame.mesh.rotation.set(Math.PI / 2, 0, 0);
      flame.mesh.scale.copy(flame.baseScale);
      flame.material.opacity = 0.82;
      flame.material.emissiveIntensity = 1.46;
    }
    for (let i = 0; i < entry.sparks.length; i += 1) {
      const spark = entry.sparks[i];
      spark.mesh.visible = false;
      spark.mesh.position.set(0, 0, 0);
      spark.mesh.rotation.set(0, 0, 0);
      spark.mesh.scale.setScalar(1);
      spark.material.opacity = 0;
    }
  };

  const skillRProjectileVisuals: SkillRProjectileVisual[] = Array.from(
    { length: secondaryBurnSkillRProjectilePoolSize },
    () => createSkillRProjectileVisual()
  );

  const acquireSkillRProjectileVisual = () => {
    const idle = skillRProjectileVisuals.find((entry) => !entry.inUse);
    if (idle) {
      resetSkillRProjectileVisual(idle);
      idle.inUse = true;
      return idle;
    }
    const created = createSkillRProjectileVisual();
    created.inUse = true;
    skillRProjectileVisuals.push(created);
    return created;
  };

  const createSkillRBurnEntry = ({
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
  }): ActiveSkillRBurn => {
    const fxRoot = new THREE.Group();
    fxRoot.userData[skillRBurnFxRootFlagKey] = true;
    fxRoot.visible = false;

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffa13c,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(secondaryBurnGlowGeometry, glowMaterial);
    glow.frustumCulled = false;
    fxRoot.add(glow);

    const outerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6b1a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const outerFlame = new THREE.Mesh(secondaryBurnFlameGeometry, outerMaterial);
    outerFlame.frustumCulled = false;
    fxRoot.add(outerFlame);

    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff1a8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const innerFlame = new THREE.Mesh(secondaryBurnFlameGeometry, innerMaterial);
    innerFlame.frustumCulled = false;
    fxRoot.add(innerFlame);

    const headGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd271,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const headGlow = new THREE.Mesh(secondaryBurnGlowGeometry, headGlowMaterial);
    headGlow.frustumCulled = false;
    fxRoot.add(headGlow);

    const headOuterMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8124,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const headOuterFlame = new THREE.Mesh(secondaryBurnFlameGeometry, headOuterMaterial);
    headOuterFlame.frustumCulled = false;
    fxRoot.add(headOuterFlame);

    const headInnerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffcf,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const headInnerFlame = new THREE.Mesh(secondaryBurnFlameGeometry, headInnerMaterial);
    headInnerFlame.frustumCulled = false;
    fxRoot.add(headInnerFlame);

    const tongues: SecondaryBurnTongue[] = Array.from({ length: 5 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xff8f2f : 0xffbf58,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(secondaryBurnFlameGeometry, material);
      mesh.frustumCulled = false;
      fxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 5) * Math.PI * 2,
        orbitRadius: 0.14 + index * 0.06,
        orbitSpeed: 1.12 + index * 0.16,
        baseScale: new THREE.Vector3(
          0.58 + index * 0.08,
          0.9 + index * 0.1,
          0.58 + index * 0.08
        ),
        tilt: 0.2 + index * 0.06,
      };
    });

    const embers: SecondaryBurnEmber[] = Array.from({ length: 24 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 3 === 0 ? 0xfff2be : index % 2 === 0 ? 0xffc56a : 0xff7f2a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnEmberGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      fxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 24) * Math.PI * 2,
        radius: 0.24 + (index % 8) * 0.08,
        speed: 1 + index * 0.08,
        lift: 0.44 + (index % 6) * 0.08,
        scale: 0.34 + (index % 5) * 0.07,
      };
    });

    const sparks: SecondaryBurnSpark[] = Array.from({ length: 16 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xfff3bf : 0xff9a3a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnSparkGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      fxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 16) * Math.PI * 2,
        orbitRadius: 0.28 + index * 0.026,
        orbitSpeed: 2 + index * 0.16,
        lift: 0.2 + (index % 5) * 0.05,
        scale: 0.42 + (index % 4) * 0.08,
      };
    });

    const headSparks: SecondaryBurnSpark[] = Array.from({ length: 18 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 3 === 0 ? 0xfff5c8 : index % 2 === 0 ? 0xffd176 : 0xff9a3a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnSparkGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      fxRoot.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 18) * Math.PI * 2,
        orbitRadius: 0.18 + index * 0.018,
        orbitSpeed: 2.6 + index * 0.18,
        lift: 0.16 + (index % 4) * 0.04,
        scale: 0.46 + (index % 5) * 0.08,
      };
    });

    return {
      targetId,
      targetObject,
      isTargetActive,
      dealDamageToTarget,
      stage: 1,
      appliedAt: now,
      endsAt: now + secondaryBurnSkillRBurnLayer1DurationMs,
      nextTickAt: now + secondaryBurnSkillRBurnTickIntervalMs,
      fxRoot,
      glow,
      glowMaterial,
      outerFlame,
      outerMaterial,
      innerFlame,
      innerMaterial,
      headGlow,
      headGlowMaterial,
      headOuterFlame,
      headOuterMaterial,
      headInnerFlame,
      headInnerMaterial,
      tongues,
      embers,
      sparks,
      headSparks,
    };
  };

  const disposeSkillRBurnEntry = (entry: ActiveSkillRBurn) => {
    entry.fxRoot.removeFromParent();
    entry.glowMaterial.dispose();
    entry.outerMaterial.dispose();
    entry.innerMaterial.dispose();
    entry.headGlowMaterial.dispose();
    entry.headOuterMaterial.dispose();
    entry.headInnerMaterial.dispose();
    for (let i = 0; i < entry.tongues.length; i += 1) {
      entry.tongues[i].material.dispose();
    }
    for (let i = 0; i < entry.embers.length; i += 1) {
      entry.embers[i].material.dispose();
    }
    for (let i = 0; i < entry.sparks.length; i += 1) {
      entry.sparks[i].material.dispose();
    }
    for (let i = 0; i < entry.headSparks.length; i += 1) {
      entry.headSparks[i].material.dispose();
    }
  };

  const activeSkillRBurns = new Map<string, ActiveSkillRBurn>();
  const activeSkillRBurnExplosions: ActiveSkillRBurnExplosionFx[] = [];
  let skillRBurnExplosionBurstSerial = 0;
  let secondaryBurnSwingTrailCursor = 0;
  let secondaryBurnSwingTrailLastSpawnAt = -Infinity;

  const clearSkillRBurn = (targetId: string) => {
    const entry = activeSkillRBurns.get(targetId);
    if (!entry) return;
    activeSkillRBurns.delete(targetId);
    disposeSkillRBurnEntry(entry);
  };

  const clearAllSkillRBurns = () => {
    const targetIds = Array.from(activeSkillRBurns.keys());
    for (let i = 0; i < targetIds.length; i += 1) {
      clearSkillRBurn(targetIds[i]);
    }
  };

  const clearSkillRBurnExplosionFx = (index: number) => {
    const entry = activeSkillRBurnExplosions[index];
    if (!entry) return;
    entry.root.removeFromParent();
    entry.glowMaterial.dispose();
    entry.coreMaterial.dispose();
    for (let i = 0; i < entry.flames.length; i += 1) {
      entry.flames[i].material.dispose();
    }
    for (let i = 0; i < entry.embers.length; i += 1) {
      entry.embers[i].material.dispose();
    }
    for (let i = 0; i < entry.sparks.length; i += 1) {
      entry.sparks[i].material.dispose();
    }
    activeSkillRBurnExplosions.splice(index, 1);
  };

  const clearAllSkillRBurnExplosionFx = () => {
    for (let i = activeSkillRBurnExplosions.length - 1; i >= 0; i -= 1) {
      clearSkillRBurnExplosionFx(i);
    }
  };

  const activeSuperBurnFlamePools: SuperBurnFlamePoolEntry[] = [];
  const inactiveSuperBurnFlamePools: SuperBurnFlamePoolEntry[] = [];

  const resetSuperBurnFlamePoolEntry = (entry: SuperBurnFlamePoolEntry) => {
    entry.root.visible = false;
    entry.root.removeFromParent();
    entry.root.position.set(0, 0, 0);
    entry.root.rotation.set(0, 0, 0);
    entry.root.scale.setScalar(1);
    entry.center.set(0, 0, 0);
    entry.direction.set(0, 0, 1);
    entry.radius = superBurnThirdAttackPoolRadius;
    entry.startedAt = 0;
    entry.expiresAt = 0;
    entry.nextTickAt = 0;
    entry.phase = 0;
    entry.lastVisualUpdateAt = 0;

    entry.core.position.set(0, 0.01, 0);
    entry.core.rotation.set(-Math.PI * 0.5, 0, 0);
    entry.core.scale.setScalar(1);
    entry.coreMaterial.opacity = 0;

    entry.ring.position.set(0, 0.012, 0);
    entry.ring.rotation.set(-Math.PI * 0.5, 0, 0);
    entry.ring.scale.setScalar(1);
    entry.ringMaterial.opacity = 0;

    entry.glow.position.set(0, 0.08, 0);
    entry.glow.rotation.set(0, 0, 0);
    entry.glow.scale.set(2, 0.45, 2);
    entry.glowMaterial.opacity = 0;

    entry.light.position.set(0, 0.32, 0);
    entry.light.intensity = 0;
    entry.light.distance = 0;

    for (let i = 0; i < entry.flames.length; i += 1) {
      const flame = entry.flames[i];
      flame.mesh.visible = true;
      flame.mesh.position.set(0, 0, 0);
      flame.mesh.rotation.set(0, 0, 0);
      flame.mesh.scale.copy(flame.baseScale);
      flame.material.opacity = 0;
    }
    for (let i = 0; i < entry.sparks.length; i += 1) {
      const spark = entry.sparks[i];
      spark.mesh.visible = false;
      spark.mesh.position.set(0, 0, 0);
      spark.mesh.rotation.set(0, 0, 0);
      spark.mesh.scale.setScalar(1);
      spark.material.opacity = 0;
    }
  };

  const createSuperBurnFlamePoolEntry = (): SuperBurnFlamePoolEntry => {
    const root = new THREE.Group();
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6f1f,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const core = new THREE.Mesh(superBurnFlamePoolCoreGeometry, coreMaterial);
    core.rotation.x = -Math.PI * 0.5;
    core.position.y = 0.01;
    core.frustumCulled = false;
    root.add(core);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb44a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(superBurnFlamePoolRingGeometry, ringMaterial);
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = 0.012;
    ring.frustumCulled = false;
    root.add(ring);

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb866,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(secondaryBurnGlowGeometry, glowMaterial);
    glow.position.y = 0.08;
    glow.scale.set(2, 0.45, 2);
    glow.frustumCulled = false;
    root.add(glow);

    const light = new THREE.PointLight(0xffa14a, 0, 0, 2);
    light.position.set(0, 0.32, 0);
    root.add(light);

    const flames: SecondaryBurnTongue[] = Array.from(
      { length: superBurnThirdAttackPoolFlameCount },
      (_, index) => {
        const material = new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0xff8a28 : 0xffc96a,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(secondaryBurnFlameGeometry, material);
        mesh.frustumCulled = false;
        root.add(mesh);
        return {
          mesh,
          material,
          phase:
            (index / Math.max(1, superBurnThirdAttackPoolFlameCount)) * Math.PI * 2,
          orbitRadius: 0.24 + (index % 4) * 0.12,
          orbitSpeed: 1.5 + index * 0.14,
          baseScale: new THREE.Vector3(
            0.62 + (index % 3) * 0.14,
            0.94 + (index % 4) * 0.12,
            0.62 + (index % 3) * 0.14
          ),
          tilt: 0.24 + (index % 4) * 0.08,
        };
      }
    );

    const sparks: SecondaryBurnSpark[] = Array.from(
      { length: superBurnThirdAttackPoolSparkCount },
      (_, index) => {
        const material = new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0xfff2bf : 0xffa13d,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(superBurnFlamePoolSparkGeometry, material);
        mesh.frustumCulled = false;
        mesh.visible = false;
        root.add(mesh);
        return {
          mesh,
          material,
          phase:
            (index / Math.max(1, superBurnThirdAttackPoolSparkCount)) *
            Math.PI *
            2,
          orbitRadius: 0.36 + (index % 7) * 0.1,
          orbitSpeed: 1.8 + index * 0.11,
          lift: 0.22 + (index % 6) * 0.06,
          scale: 0.38 + (index % 5) * 0.08,
        };
      }
    );

    const entry: SuperBurnFlamePoolEntry = {
      root,
      center: new THREE.Vector3(),
      direction: new THREE.Vector3(0, 0, 1),
      radius: superBurnThirdAttackPoolRadius,
      startedAt: 0,
      expiresAt: 0,
      nextTickAt: 0,
      phase: 0,
      lastVisualUpdateAt: 0,
      core,
      coreMaterial,
      ring,
      ringMaterial,
      glow,
      glowMaterial,
      flames,
      sparks,
      light,
    };
    resetSuperBurnFlamePoolEntry(entry);
    return entry;
  };

  const acquireSuperBurnFlamePoolEntry = () => {
    const idle = inactiveSuperBurnFlamePools.pop();
    if (idle) {
      resetSuperBurnFlamePoolEntry(idle);
      return idle;
    }
    return createSuperBurnFlamePoolEntry();
  };

  const releaseSuperBurnFlamePoolEntry = (index: number) => {
    const entry = activeSuperBurnFlamePools[index];
    if (!entry) return;
    activeSuperBurnFlamePools.splice(index, 1);
    resetSuperBurnFlamePoolEntry(entry);
    inactiveSuperBurnFlamePools.push(entry);
  };

  const clearAllSuperBurnFlamePools = () => {
    for (let i = activeSuperBurnFlamePools.length - 1; i >= 0; i -= 1) {
      releaseSuperBurnFlamePoolEntry(i);
    }
  };

  const disposeSuperBurnFlamePoolEntry = (entry: SuperBurnFlamePoolEntry) => {
    entry.root.removeFromParent();
    entry.coreMaterial.dispose();
    entry.ringMaterial.dispose();
    entry.glowMaterial.dispose();
    for (let i = 0; i < entry.flames.length; i += 1) {
      entry.flames[i].material.dispose();
    }
    for (let i = 0; i < entry.sparks.length; i += 1) {
      entry.sparks[i].material.dispose();
    }
  };

  const disposeAllSuperBurnFlamePools = () => {
    clearAllSuperBurnFlamePools();
    for (let i = inactiveSuperBurnFlamePools.length - 1; i >= 0; i -= 1) {
      disposeSuperBurnFlamePoolEntry(inactiveSuperBurnFlamePools[i]);
    }
    inactiveSuperBurnFlamePools.length = 0;
  };

  const spawnSuperBurnThirdAttackFlamePool = (now: number) => {
    if (!superBurnState.active) return;
    const worldRoot = avatar.parent ?? avatar;
    avatar.updateMatrixWorld(true);
    avatar.getWorldPosition(superBurnFlamePoolSpawnCenter);
    getAttackDirection(superBurnFlamePoolSpawnDirection);
    superBurnFlamePoolSpawnCenter.addScaledVector(
      superBurnFlamePoolSpawnDirection,
      superBurnThirdAttackPoolForwardOffset
    );
    superBurnFlamePoolSpawnCenter.y += superBurnThirdAttackPoolGroundLift;

    while (activeSuperBurnFlamePools.length >= superBurnThirdAttackPoolMaxActive) {
      releaseSuperBurnFlamePoolEntry(0);
    }

    const entry = acquireSuperBurnFlamePoolEntry();
    entry.root.position.copy(superBurnFlamePoolSpawnCenter);
    entry.root.visible = true;
    worldRoot.add(entry.root);

    entry.center.copy(superBurnFlamePoolSpawnCenter);
    entry.direction.copy(superBurnFlamePoolSpawnDirection);
    entry.radius = superBurnThirdAttackPoolRadius;
    entry.startedAt = now;
    entry.expiresAt = now + superBurnThirdAttackPoolDurationMs;
    entry.nextTickAt = now + superBurnThirdAttackPoolTickMs;
    entry.phase = Math.random() * Math.PI * 2;
    entry.lastVisualUpdateAt = -Infinity;

    activeSuperBurnFlamePools.push(entry);
  };

  const updateSuperBurnFlamePools = (now: number) => {
    if (!activeSuperBurnFlamePools.length) return;

    for (let i = activeSuperBurnFlamePools.length - 1; i >= 0; i -= 1) {
      const entry = activeSuperBurnFlamePools[i];
      if (!entry.root.parent || now >= entry.expiresAt) {
        releaseSuperBurnFlamePoolEntry(i);
        continue;
      }

      const lifeProgress = THREE.MathUtils.clamp(
        (now - entry.startedAt) / Math.max(1, entry.expiresAt - entry.startedAt),
        0,
        1
      );
      const fadeIn = THREE.MathUtils.smoothstep(lifeProgress, 0, 0.12);
      const fadeOut = 1 - THREE.MathUtils.smoothstep(lifeProgress, 0.72, 1);
      const fade = fadeIn * fadeOut;

      while (entry.nextTickAt <= entry.expiresAt && now + 0.001 >= entry.nextTickAt) {
        if (performMeleeAttack) {
          performMeleeAttack({
            damage: superBurnThirdAttackPoolTickDamage,
            maxDistance: 0.1,
            maxHits: superBurnThirdAttackPoolMaxHitsPerTick,
            origin: entry.center,
            direction: entry.direction,
            contactCenter: entry.center,
            contactRadius: entry.radius,
            onHitTargetResolved: ({
              targetId,
              targetObject,
              isTargetActive,
              dealDamageToTarget,
              now: hitNow,
            }) => {
              applySecondaryBurnSkillRBurn({
                targetId,
                targetObject,
                isTargetActive,
                dealDamageToTarget,
                now: hitNow,
                applicationMode: "direct",
                stackCount: 1,
              });
            },
          });
        }
        entry.nextTickAt += superBurnThirdAttackPoolTickMs;
      }

      entry.root.visible = fade > 0.001;
      if (fade <= 0.001) {
        entry.light.intensity = 0;
        entry.light.distance = 0;
        continue;
      }

      const isHighDetailPool =
        !hasAimOriginWorld ||
        latestAimOriginWorld.distanceToSquared(entry.center) <=
          superBurnThirdAttackPoolHighDetailDistanceSq;
      const visualUpdateIntervalMs = isHighDetailPool
        ? superBurnThirdAttackPoolVisualUpdateIntervalMsNear
        : superBurnThirdAttackPoolVisualUpdateIntervalMsFar;
      if (
        Number.isFinite(entry.lastVisualUpdateAt) &&
        now - entry.lastVisualUpdateAt < visualUpdateIntervalMs
      ) {
        continue;
      }
      entry.lastVisualUpdateAt = now;

      const t = (now - entry.startedAt) * 0.001;
      const pulse =
        1 + Math.sin(t * 6.6 + entry.phase) * 0.14 + Math.cos(t * 3.8 + entry.phase) * 0.07;
      const flameUpdateStride = isHighDetailPool ? 1 : 2;
      const sparkUpdateStride = isHighDetailPool ? 1 : 3;

      entry.core.scale.setScalar(entry.radius * pulse);
      entry.ring.scale.setScalar(entry.radius * (1.02 + pulse * 0.08));
      entry.ring.rotation.z = t * 1.5 + entry.phase;
      entry.glow.scale.set(
        entry.radius * (1.72 + pulse * 0.16),
        0.46 + pulse * 0.08,
        entry.radius * (1.72 + pulse * 0.16)
      );

      entry.coreMaterial.opacity = Math.min(1, 0.52 * fade);
      entry.ringMaterial.opacity = Math.min(1, 0.62 * fade);
      entry.glowMaterial.opacity = Math.min(1, 0.34 * fade);
      entry.light.intensity = fade * (1.4 + pulse * 0.9);
      entry.light.distance = entry.radius * (2.4 + pulse * 0.8);

      for (let j = 0; j < entry.flames.length; j += 1) {
        const flame = entry.flames[j];
        const shouldUpdateFlame = j % flameUpdateStride === 0;
        flame.mesh.visible = shouldUpdateFlame;
        if (!shouldUpdateFlame) {
          flame.material.opacity = 0;
          continue;
        }
        const spin = t * flame.orbitSpeed + flame.phase;
        const surge = 0.82 + Math.sin(t * (8.8 + j * 0.22) + flame.phase) * 0.22;
        flame.mesh.position.set(
          Math.cos(spin) * flame.orbitRadius * entry.radius,
          0.03 + surge * 0.16,
          Math.sin(spin) * flame.orbitRadius * entry.radius
        );
        flame.mesh.rotation.set(
          Math.sin(spin) * flame.tilt,
          spin + t * 0.8,
          Math.cos(spin) * flame.tilt
        );
        flame.mesh.scale
          .copy(flame.baseScale)
          .multiplyScalar((0.54 + surge * 0.34) * (entry.radius * 0.56));
        flame.material.opacity = Math.min(1, fade * (0.44 + surge * 0.26));
      }

      for (let j = 0; j < entry.sparks.length; j += 1) {
        const spark = entry.sparks[j];
        const shouldUpdateSpark = j % sparkUpdateStride === 0;
        spark.mesh.visible = shouldUpdateSpark;
        if (!shouldUpdateSpark) {
          spark.material.opacity = 0;
          continue;
        }
        const spin = t * spark.orbitSpeed + spark.phase;
        const risePhase = THREE.MathUtils.euclideanModulo(
          t * (0.7 + j * 0.03) + spark.phase * 0.18,
          1
        );
        spark.mesh.position.set(
          Math.cos(spin) * spark.orbitRadius * entry.radius * (0.44 + risePhase * 0.56),
          0.08 + risePhase * spark.lift,
          Math.sin(spin) * spark.orbitRadius * entry.radius * (0.44 + risePhase * 0.56)
        );
        spark.mesh.rotation.set(spin * 1.2, spin, spin * 1.7);
        spark.mesh.scale.setScalar(spark.scale * (0.56 + risePhase * 0.58));
        spark.material.opacity = Math.min(1, fade * (1 - risePhase * 0.72) * 0.52);
      }
    }
  };

  const setSkillRBurnStage = (
    entry: ActiveSkillRBurn,
    stage: SkillRBurnStage,
    now: number
  ) => {
    entry.stage = stage;
    entry.appliedAt = now;
    entry.endsAt =
      now +
      (stage === 2
        ? secondaryBurnSkillRBurnLayer2DurationMs
        : secondaryBurnSkillRBurnLayer1DurationMs);
    entry.nextTickAt = now + secondaryBurnSkillRBurnTickIntervalMs;
  };

  const spawnSecondaryBurnSkillRBurnExplosionFx = (
    center: THREE.Vector3,
    now: number
  ) => {
    const worldRoot = avatar.parent ?? avatar;
    const root = new THREE.Group();
    root.position.copy(center);
    worldRoot.add(root);

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(secondaryBurnGlowGeometry, glowMaterial);
    glow.frustumCulled = false;
    root.add(glow);

    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffd2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(secondaryBurnGlowGeometry, coreMaterial);
    core.frustumCulled = false;
    root.add(core);

    const flames: SecondaryBurnTongue[] = Array.from({ length: 10 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xff8b24 : 0xffc25b,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(secondaryBurnFlameGeometry, material);
      mesh.frustumCulled = false;
      root.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 10) * Math.PI * 2,
        orbitRadius: 0.18 + index * 0.06,
        orbitSpeed: 1.2 + index * 0.12,
        baseScale: new THREE.Vector3(
          1.2 + (index % 3) * 0.26,
          1.8 + (index % 4) * 0.22,
          1.2 + (index % 3) * 0.22
        ),
        tilt: 0.42 + (index % 4) * 0.08,
      };
    });

    const embers: SecondaryBurnEmber[] = Array.from({ length: 54 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color:
          index % 4 === 0
            ? 0xfff3bf
            : index % 3 === 0
              ? 0xffcf73
              : index % 2 === 0
                ? 0xff9a3a
                : 0xff6f22,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnEmberGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      root.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 54) * Math.PI * 2,
        radius: 0.28 + (index % 10) * 0.08,
        speed: 1.2 + index * 0.07,
        lift: 0.9 + (index % 8) * 0.12,
        scale: 0.5 + (index % 5) * 0.1,
      };
    });

    const sparks: SecondaryBurnSpark[] = Array.from({ length: 38 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xfff6cf : 0xffa13c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(secondaryBurnSparkGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      root.add(mesh);
      return {
        mesh,
        material,
        phase: (index / 38) * Math.PI * 2,
        orbitRadius: 0.44 + index * 0.038,
        orbitSpeed: 2 + index * 0.12,
        lift: 0.54 + (index % 6) * 0.08,
        scale: 0.54 + (index % 5) * 0.09,
      };
    });

    const light = new THREE.PointLight(0xff8c33, 0, 0, 2);
    root.add(light);

    activeSkillRBurnExplosions.push({
      root,
      startedAt: now,
      endsAt: now + secondaryBurnSkillRBurnExplosionFxDurationMs,
      glow,
      glowMaterial,
      core,
      coreMaterial,
      flames,
      embers,
      sparks,
      light,
    });
  };

  let boundModel: THREE.Object3D | null = null;
  let boundBurningModeSurface: THREE.Object3D | null = null;
  let boundBurningModeAnchor: THREE.Object3D | null = null;
  let boundBurningModeFallbackHead: THREE.Object3D | null = null;
  let boundWeapon: THREE.Object3D | null = null;
  let boundWeaponMeshes: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.Material | THREE.Material[]
  >[] = [];
  let firstPersonHiddenBoneMaskSplitEntries: FirstPersonMeshSplitEntry[] = [];
  let mixer: THREE.AnimationMixer | null = null;
  let walkAction: THREE.AnimationAction | null = null;
  let walkLegsAction: THREE.AnimationAction | null = null;
  let normalAttackBindings: AttackClipBinding[] = [];
  let superBurnAttackBindings: AttackClipBinding[] = [];
  let holdAttackBinding: ActionBinding | null = null;
  let skillQBinding: ActionBinding | null = null;
  let skillQEBinding: ActionBinding | null = null;
  let skillEBinding: ActionBinding | null = null;
  let skillRBinding: ActionBinding | null = null;
  let skillQERSkillBinding: ActionBinding | null = null;
  let lastAnimationUpdateAt = 0;
  let lastCompletedAttackIndex = -1;
  let lastCompletedAttackAt = -Infinity;
  let runtimeFrameStamp = 0;
  let boundWeaponMatrixFrameStamp = -1;
  let secondaryBurnAnchorLastResolvedAt = -Infinity;

  const attackState = {
    active: false,
    queuedNext: false,
    currentIndex: -1,
    comboVariant: "normal" as "normal" | "super",
    startedAt: 0,
    durationMs: 0,
    hitTargetIds: new Set<string>(),
    hasWeaponSample: false,
    superThirdPoolSpawned: false,
    superThirdPoolHasWeaponSample: false,
    superThirdPoolPeakWeaponY: 0,
    superThirdPoolPreviousWeaponY: 0,
    nextHitAt: 0,
  };

  const primaryHoldState = {
    pressing: false,
    pressedAt: 0,
    active: false,
    nextTickAt: 0,
    hasWeaponSample: false,
  };

  const skillEState = {
    active: false,
    startedAt: 0,
    durationMs: 0,
    hasWeaponSample: false,
    initialWeaponY: 0,
    peakWeaponY: 0,
    lowestWeaponY: 0,
    previousWeaponY: 0,
    landingArmed: false,
    flameTriggered: false,
  };

  const skillQState = {
    active: false,
    startedAt: 0,
    durationMs: 0,
  };

  const skillQEState = {
    active: false,
    startedAt: 0,
    durationMs: 0,
    ignited: false,
  };
  let skillQEPreludeFadeOutEndsAt = 0;

  const skillRState = {
    active: false,
    startedAt: 0,
    durationMs: 0,
    hitTargetIds: new Set<string>(),
    hasWeaponSample: false,
    activeBinding: null as ActionBinding | null,
    superFanMode: false,
    nextFanTickAt: 0,
    projectileMode: false,
    projectileFired: false,
  };

  const secondaryBurnState = {
    active: false,
    activatedAt: 0,
    endsAt: 0,
    fadingOut: false,
    fadeOutStartedAt: 0,
    linkedToBurningMode: false,
  };

  const burningModeState = {
    active: false,
    activatedAt: 0,
    endsAt: 0,
  };

  const superBurnState = {
    active: false,
    activatedAt: 0,
    endsAt: 0,
  };

  const getCurrentEnergy = () => getCurrentStats?.().energy ?? 0;

  const canCastSkillQByEnergy = () =>
    getCurrentEnergy() + 0.0001 >= skillQMinEnergyToCast;

  const consumeAllEnergy = () => {
    if (!spendEnergy) return;
    const energy = getCurrentEnergy();
    if (energy <= 0) return;
    spendEnergy(energy);
  };

  const grantEnergyFromBurnDamage = () => {
    applyEnergy?.(burnDamageEnergyGain);
  };

  const getAttackBindingsByVariant = (variant: "normal" | "super") =>
    variant === "super" ? superBurnAttackBindings : normalAttackBindings;

  const resolveAttackVariantForNewCombo = (): "normal" | "super" =>
    superBurnState.active && superBurnAttackBindings.length >= 3
      ? "super"
      : "normal";

  const resolveAttackBinding = (
    index: number,
    preferredVariant: "normal" | "super"
  ): { binding: AttackClipBinding | null; variant: "normal" | "super" } => {
    const preferredBindings = getAttackBindingsByVariant(preferredVariant);
    const preferredBinding = preferredBindings[index] ?? null;
    if (preferredBinding) {
      return {
        binding: preferredBinding,
        variant: preferredVariant,
      };
    }
    const fallbackVariant = preferredVariant === "super" ? "normal" : "super";
    const fallbackBinding = getAttackBindingsByVariant(fallbackVariant)[index] ?? null;
    return {
      binding: fallbackBinding,
      variant: fallbackBinding ? fallbackVariant : preferredVariant,
    };
  };

  const stopAllAttackActions = () => {
    for (let i = 0; i < normalAttackBindings.length; i += 1) {
      stopActionBinding(normalAttackBindings[i]);
    }
    for (let i = 0; i < superBurnAttackBindings.length; i += 1) {
      stopActionBinding(superBurnAttackBindings[i]);
    }
    stopActionBinding(holdAttackBinding);
    primaryHoldState.active = false;
    primaryHoldState.nextTickAt = 0;
    primaryHoldState.hasWeaponSample = false;
    primaryHoldReflectBlocker.visible = false;
  };

  const stopAllSkillActions = () => {
    stopActionBinding(skillQBinding);
    stopActionBinding(skillQEBinding);
    stopActionBinding(skillEBinding);
    stopActionBinding(skillRBinding);
    stopActionBinding(skillQERSkillBinding);
  };

  const getBurningModeHeadFxAnchor = () =>
    boundBurningModeAnchor ??
    boundBurningModeSurface ??
    boundBurningModeFallbackHead ??
    avatar;

  const resolveBurningModeHeadLayout = () => {
    burningModeHeadRelativeOffset.copy(burningModeHeadFallbackRelativeOffset);
    burningModeHeadSurfaceSize.set(0.86, 1.34, 0.58);

    if (!boundBurningModeSurface) {
      if (boundBurningModeFallbackHead) {
        const anchor = getBurningModeHeadFxAnchor();
        anchor.updateMatrixWorld(true);
        boundBurningModeFallbackHead.updateMatrixWorld(true);
        boundBurningModeFallbackHead.getWorldPosition(burningModeHeadSurfaceVertex);
        burningModeHeadRelativeOffset.copy(burningModeHeadSurfaceVertex);
        anchor.worldToLocal(burningModeHeadRelativeOffset);
        burningModeHeadRelativeOffset.y += burningModeHeadFallbackFromHeadLift;
        burningModeHeadRelativeOffset.add(burningModeRelativeOffset);
      }
      return;
    }

    const anchor = getBurningModeHeadFxAnchor();
    boundBurningModeSurface.updateMatrixWorld(true);
    anchor.updateMatrixWorld(true);
    const positionAttribute = isMeshObject(boundBurningModeSurface)
      ? boundBurningModeSurface.geometry.getAttribute("position")
      : null;

    if (positionAttribute) {
      burningModeHeadSurfaceBoundsMin.set(Infinity, Infinity, Infinity);
      burningModeHeadSurfaceBoundsMax.set(-Infinity, -Infinity, -Infinity);

      for (let i = 0; i < positionAttribute.count; i += 1) {
        burningModeHeadSurfaceVertex.fromBufferAttribute(positionAttribute, i);
        if (isSkinnedMeshObject(boundBurningModeSurface)) {
          boundBurningModeSurface.applyBoneTransform(i, burningModeHeadSurfaceVertex);
        }
        boundBurningModeSurface.localToWorld(burningModeHeadSurfaceVertex);
        anchor.worldToLocal(burningModeHeadSurfaceVertex);
        burningModeHeadSurfaceBoundsMin.min(burningModeHeadSurfaceVertex);
        burningModeHeadSurfaceBoundsMax.max(burningModeHeadSurfaceVertex);
      }

      if (!Number.isFinite(burningModeHeadSurfaceBoundsMin.x)) return;
    } else {
      burningModeHeadSurfaceBounds.setEmpty();
      if (!isMeshObject(boundBurningModeSurface)) return;
      const { geometry } = boundBurningModeSurface;
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }
      const bounds = geometry.boundingBox;
      if (!bounds) return;

      for (let cornerIndex = 0; cornerIndex < 8; cornerIndex += 1) {
        burningModeHeadSurfaceBoundsCorner.set(
          cornerIndex & 1 ? bounds.max.x : bounds.min.x,
          cornerIndex & 2 ? bounds.max.y : bounds.min.y,
          cornerIndex & 4 ? bounds.max.z : bounds.min.z
        );
        boundBurningModeSurface.localToWorld(burningModeHeadSurfaceBoundsCorner);
        anchor.worldToLocal(burningModeHeadSurfaceBoundsCorner);
        burningModeHeadSurfaceBounds.expandByPoint(burningModeHeadSurfaceBoundsCorner);
      }
      burningModeHeadSurfaceBoundsMin.copy(burningModeHeadSurfaceBounds.min);
      burningModeHeadSurfaceBoundsMax.copy(burningModeHeadSurfaceBounds.max);
    }

    burningModeHeadSurfaceCenterLocal
      .copy(burningModeHeadSurfaceBoundsMin)
      .add(burningModeHeadSurfaceBoundsMax)
      .multiplyScalar(0.5);
    burningModeHeadSurfaceSize
      .subVectors(burningModeHeadSurfaceBoundsMax, burningModeHeadSurfaceBoundsMin)
      .add(burningModeCoverPadding);
    burningModeHeadSurfaceSize.x = Math.max(0.68, burningModeHeadSurfaceSize.x);
    burningModeHeadSurfaceSize.y = Math.max(1.34, burningModeHeadSurfaceSize.y);
    burningModeHeadSurfaceSize.z = Math.max(1.18, burningModeHeadSurfaceSize.z);
    burningModeHeadRelativeOffset
      .copy(burningModeHeadSurfaceCenterLocal)
      .setY(burningModeHeadSurfaceCenterLocal.y + burningModeHeadLift)
      .add(burningModeRelativeOffset);
  };

  const applyBurningModeHeadRotation = (yawSwayRad = 0) => {
    burningModeHeadFxRoot.rotation.set(
      THREE.MathUtils.degToRad(burningModeRelativeRotationDegrees.x),
      THREE.MathUtils.degToRad(burningModeRelativeRotationDegrees.y) + yawSwayRad,
      THREE.MathUtils.degToRad(burningModeRelativeRotationDegrees.z)
    );
  };

  const syncBurningModeHeadFxLayers = () => {
    const layerSource =
      boundBurningModeAnchor ??
      boundBurningModeSurface ??
      boundBurningModeFallbackHead ??
      avatar;
    const suppressFirstPersonFlame =
      profile.camera?.hideLocalBody === true && burningModeState.active;
    const layerMask = suppressFirstPersonFlame
      ? flareMiniBodyCameraLayerMask
      : layerSource.layers.mask;
    burningModeHeadFxAnchor.traverse((child) => {
      child.layers.mask = layerMask;
    });
  };

  const syncBurningModeHeadFxTransform = () => {
    resolveBurningModeHeadLayout();
    burningModeHeadFxAnchor.position.copy(burningModeHeadRelativeOffset);
    burningModeHeadFxAnchor.quaternion.copy(burningModeAnchorNeutralizeQuaternion);
    burningModeHeadFxAnchor.scale.setScalar(1);
  };

  const syncBurningModePreludeFxLayers = () => {
    const suppressFirstPersonFlame =
      profile.camera?.hideLocalBody === true && burningModeState.active;
    const layerMask = suppressFirstPersonFlame
      ? flareMiniBodyCameraLayerMask
      : avatar.layers.mask;
    burningModePreludeAuraFxRoot.traverse((child) => {
      child.layers.mask = layerMask;
    });
  };

  const attachBurningModeHeadFx = () => {
    burningModeHeadFxAnchor.removeFromParent();
    burningModePreludeAuraFxRoot.removeFromParent();
    avatar.add(burningModePreludeAuraFxRoot);
    const anchor = getBurningModeHeadFxAnchor();
    anchor.add(burningModeHeadFxAnchor);
    anchor.updateMatrixWorld(true);
    anchor.getWorldQuaternion(burningModeAnchorWorldQuaternion);
    burningModeAnchorNeutralizeQuaternion
      .copy(burningModeAnchorWorldQuaternion)
      .invert();
    syncBurningModePreludeFxLayers();
    syncBurningModeHeadFxLayers();
    syncBurningModeHeadFxTransform();
    burningModePreludeAuraFxRoot.position.set(0, 0, 0);
    burningModePreludeAuraFxRoot.rotation.set(0, 0, 0);
    burningModePreludeAuraFxRoot.scale.setScalar(1);
    burningModeHeadFxRoot.position.set(0, 0, 0);
    burningModeHeadFxRoot.scale.set(
      burningModeHeadFxScale * burningModeHeadFxWidthScale,
      burningModeHeadFxScale,
      burningModeHeadFxScale
    );
    applyBurningModeHeadRotation();
  };

  const deactivateSuperBurn = () => {
    superBurnState.active = false;
    superBurnState.activatedAt = 0;
    superBurnState.endsAt = 0;
  };

  const activateSuperBurn = (now: number) => {
    superBurnState.active = true;
    superBurnState.activatedAt = now;
    superBurnState.endsAt = Math.max(
      now + secondaryBurnDurationMs,
      burningModeState.endsAt || now
    );
  };

  const deactivateBurningMode = () => {
    burningModeState.active = false;
    burningModeState.activatedAt = 0;
    burningModeState.endsAt = 0;
    burningModePreludeAuraFxRoot.visible = false;
    burningModeHeadFxRoot.visible = false;
    burningModeHeadLight.visible = false;
    for (let i = 0; i < burningModePreludeAuraSparks.length; i += 1) {
      const spark = burningModePreludeAuraSparks[i];
      spark.mesh.visible = false;
      spark.material.opacity = 0;
    }
    for (let i = 0; i < burningModePreludeAuraEmbers.length; i += 1) {
      const ember = burningModePreludeAuraEmbers[i];
      ember.mesh.visible = false;
      ember.material.opacity = 0;
    }
    for (let i = 0; i < burningModeHeadJets.length; i += 1) {
      const jet = burningModeHeadJets[i];
      jet.shell.material.opacity = 0;
      jet.core.material.opacity = 0;
    }
    for (let i = 0; i < burningModeHeadTongues.length; i += 1) {
      const tongue = burningModeHeadTongues[i];
      tongue.shell.material.opacity = 0;
      tongue.core.material.opacity = 0;
    }
    for (let i = 0; i < burningModeHeadSparks.length; i += 1) {
      const spark = burningModeHeadSparks[i];
      spark.mesh.visible = false;
      spark.material.opacity = 0;
    }
    for (let i = 0; i < burningModeHeadEmbers.length; i += 1) {
      const ember = burningModeHeadEmbers[i];
      ember.mesh.visible = false;
      ember.material.opacity = 0;
    }
    for (let i = 0; i < burningModeHeadSmokeWisps.length; i += 1) {
      const smoke = burningModeHeadSmokeWisps[i];
      smoke.mesh.visible = false;
      smoke.material.opacity = 0;
    }
    deactivateSuperBurn();
    if (secondaryBurnState.linkedToBurningMode) {
      deactivateSecondaryBurn({ immediate: true });
    }
  };

  const activateBurningMode = (now: number) => {
    burningModeState.active = true;
    burningModeState.activatedAt = now;
    burningModeState.endsAt = now + skillQBurningModeDurationMs;
    attachBurningModeHeadFx();
    burningModeHeadFxRoot.visible = true;
  };

  const resolveSecondaryBurnAnchor = () => {
    secondaryBurnAnchorLocal.copy(secondaryBurnFallbackLocalOffset);
    secondaryBurnFxAnchorLocal.copy(secondaryBurnFallbackLocalOffset);
    secondaryBurnOppositeAnchorLocal.copy(secondaryBurnOppositeFallbackLocalOffset);
    secondaryBurnHoldTopLocal.set(1.14, 2.64, -0.05);
    secondaryBurnHoldTopSpread.set(0.16, 0.26, 0.16);
    if (!boundWeapon || boundWeaponMeshes.length === 0) return;

    boundWeapon.updateMatrixWorld(true);

    secondaryBurnTipRangeMin.set(Infinity, Infinity, Infinity);
    secondaryBurnTipRangeMax.set(-Infinity, -Infinity, -Infinity);
    secondaryBurnTipSamples.length = 0;
    secondaryBurnFallbackTipRangeMin.set(Infinity, Infinity, Infinity);
    secondaryBurnFallbackTipRangeMax.set(-Infinity, -Infinity, -Infinity);
    secondaryBurnFallbackTipSamples.length = 0;
    secondaryBurnFxTipRangeMin.set(Infinity, Infinity, Infinity);
    secondaryBurnFxTipRangeMax.set(-Infinity, -Infinity, -Infinity);
    secondaryBurnFxTipSamples.length = 0;
    secondaryBurnFxFallbackTipRangeMin.set(Infinity, Infinity, Infinity);
    secondaryBurnFxFallbackTipRangeMax.set(-Infinity, -Infinity, -Infinity);
    secondaryBurnFxFallbackTipSamples.length = 0;

    for (let meshIndex = 0; meshIndex < boundWeaponMeshes.length; meshIndex += 1) {
      const weaponMesh = boundWeaponMeshes[meshIndex];
      const positionAttribute = weaponMesh.geometry.getAttribute("position");
      if (!positionAttribute) continue;
      const isSkinned = isSkinnedMeshObject(weaponMesh);
      const skinIndexAttribute = isSkinned
        ? (weaponMesh.geometry.getAttribute("skinIndex") as THREE.BufferAttribute | null)
        : null;
      const skinWeightAttribute = isSkinned
        ? (weaponMesh.geometry.getAttribute("skinWeight") as THREE.BufferAttribute | null)
        : null;
      const skinBones = isSkinned ? weaponMesh.skeleton?.bones ?? [] : [];

      weaponMesh.updateMatrixWorld(true);

      for (let i = 0; i < positionAttribute.count; i += 1) {
        secondaryBurnTipCandidate.fromBufferAttribute(positionAttribute, i);
        if (isSkinned) {
          weaponMesh.applyBoneTransform(i, secondaryBurnTipCandidate);
        }
        weaponMesh.localToWorld(secondaryBurnTipCandidate);
        secondaryBurnTipBest.copy(boundWeapon.worldToLocal(secondaryBurnTipCandidate));
        const tipSample = secondaryBurnTipBest.clone();
        let dominantBoneName = "";
        if (
          skinIndexAttribute &&
          skinWeightAttribute &&
          skinBones.length > 0 &&
          i < skinIndexAttribute.count &&
          i < skinWeightAttribute.count
        ) {
          const j0 = Math.floor(skinIndexAttribute.getX(i));
          const j1 = Math.floor(skinIndexAttribute.getY(i));
          const j2 = Math.floor(skinIndexAttribute.getZ(i));
          const j3 = Math.floor(skinIndexAttribute.getW(i));
          const w0 = skinWeightAttribute.getX(i);
          const w1 = skinWeightAttribute.getY(i);
          const w2 = skinWeightAttribute.getZ(i);
          const w3 = skinWeightAttribute.getW(i);
          let dominantJoint = j0;
          let dominantWeight = w0;
          if (w1 > dominantWeight) {
            dominantJoint = j1;
            dominantWeight = w1;
          }
          if (w2 > dominantWeight) {
            dominantJoint = j2;
            dominantWeight = w2;
          }
          if (w3 > dominantWeight) {
            dominantJoint = j3;
          }
          dominantBoneName =
            dominantJoint >= 0 && dominantJoint < skinBones.length
              ? skinBones[dominantJoint].name
              : "";
        }
        const isWeaponDominantBone =
          secondaryBurnAnchorWeaponBonePattern.test(dominantBoneName);
        if (isWeaponDominantBone) {
          secondaryBurnTipSamples.push(tipSample);
          secondaryBurnTipRangeMin.min(tipSample);
          secondaryBurnTipRangeMax.max(tipSample);
          secondaryBurnFxTipSamples.push(tipSample);
          secondaryBurnFxTipRangeMin.min(tipSample);
          secondaryBurnFxTipRangeMax.max(tipSample);
          continue;
        }
        const includeFallbackSample =
          !dominantBoneName ||
          (secondaryBurnAnchorFallbackBoneIncludePattern.test(dominantBoneName) &&
            !secondaryBurnAnchorFallbackBoneExcludePattern.test(dominantBoneName));
        if (includeFallbackSample) {
          secondaryBurnFallbackTipSamples.push(tipSample);
          secondaryBurnFallbackTipRangeMin.min(tipSample);
          secondaryBurnFallbackTipRangeMax.max(tipSample);
          secondaryBurnFxFallbackTipSamples.push(tipSample);
          secondaryBurnFxFallbackTipRangeMin.min(tipSample);
          secondaryBurnFxFallbackTipRangeMax.max(tipSample);
        }
      }
    }

    let tipSamples: THREE.Vector3[] = secondaryBurnTipSamples;
    let tipRangeMin = secondaryBurnTipRangeMin;
    let tipRangeMax = secondaryBurnTipRangeMax;
    if (tipSamples.length === 0 && secondaryBurnFallbackTipSamples.length > 0) {
      tipSamples = secondaryBurnFallbackTipSamples;
      tipRangeMin = secondaryBurnFallbackTipRangeMin;
      tipRangeMax = secondaryBurnFallbackTipRangeMax;
    }

    if (!tipSamples.length) {
      secondaryBurnAnchorLocal.copy(secondaryBurnFallbackLocalOffset);
      secondaryBurnFxAnchorLocal.copy(secondaryBurnFallbackLocalOffset);
      secondaryBurnOppositeAnchorLocal.copy(secondaryBurnOppositeFallbackLocalOffset);
      return;
    }

    const rangeX = tipRangeMax.x - tipRangeMin.x;
    const rangeY = tipRangeMax.y - tipRangeMin.y;
    const rangeZ = tipRangeMax.z - tipRangeMin.z;
    secondaryBurnHoldTopSpread.set(
      Math.max(0.08, rangeX * 0.42),
      Math.max(0.18, rangeY * 0.18),
      Math.max(0.08, rangeZ * 0.42)
    );
    secondaryBurnHoldTopLocal
      .copy(tipRangeMin)
      .add(tipRangeMax)
      .multiplyScalar(0.5);
    secondaryBurnHoldTopLocal.y = tipRangeMax.y + 0.06;
    let majorAxis: "x" | "y" | "z" = "x";
    let majorRange = rangeX;
    if (rangeY > majorRange) {
      majorAxis = "y";
      majorRange = rangeY;
    }
    if (rangeZ > majorRange) {
      majorAxis = "z";
      majorRange = rangeZ;
    }

    const axisMin = tipRangeMin[majorAxis];
    const axisMax = tipRangeMax[majorAxis];
    const useAxisMax = Math.abs(axisMax) >= Math.abs(axisMin);
    const extremeValue = useAxisMax ? axisMax : axisMin;
    const bandSize = Math.max(0.02, majorRange * secondaryBurnTipBandRatio);
    secondaryBurnTipAccum.set(0, 0, 0);
    let matchedCount = 0;

    for (let i = 0; i < tipSamples.length; i += 1) {
      const sample = tipSamples[i];
      const axisValue = sample[majorAxis];
      const withinTipBand = useAxisMax
        ? axisValue >= extremeValue - bandSize
        : axisValue <= extremeValue + bandSize;
      if (!withinTipBand) continue;
      secondaryBurnTipAccum.add(sample);
      matchedCount += 1;
    }

    if (matchedCount > 0) {
      secondaryBurnAnchorLocal.copy(
        secondaryBurnTipAccum.multiplyScalar(1 / matchedCount)
      );
    } else {
      secondaryBurnAnchorLocal.copy(useAxisMax ? tipRangeMax : tipRangeMin);
    }

    const oppositeExtremeValue = useAxisMax ? axisMin : axisMax;
    secondaryBurnOppositeTipAccum.set(0, 0, 0);
    let oppositeMatchedCount = 0;
    for (let i = 0; i < tipSamples.length; i += 1) {
      const sample = tipSamples[i];
      const axisValue = sample[majorAxis];
      const withinOppositeBand = useAxisMax
        ? axisValue <= oppositeExtremeValue + bandSize
        : axisValue >= oppositeExtremeValue - bandSize;
      if (!withinOppositeBand) continue;
      secondaryBurnOppositeTipAccum.add(sample);
      oppositeMatchedCount += 1;
    }
    if (oppositeMatchedCount > 0) {
      secondaryBurnOppositeAnchorLocal.copy(
        secondaryBurnOppositeTipAccum.multiplyScalar(1 / oppositeMatchedCount)
      );
    } else {
      secondaryBurnOppositeAnchorLocal.copy(useAxisMax ? tipRangeMin : tipRangeMax);
    }

    secondaryBurnTipDirection.copy(secondaryBurnAnchorLocal);
    if (secondaryBurnTipDirection.lengthSq() > 0.000001) {
      secondaryBurnAnchorLocal.addScaledVector(
        secondaryBurnTipDirection.normalize(),
        secondaryBurnTipNudge
      );
    }

    secondaryBurnTipDirection.copy(secondaryBurnOppositeAnchorLocal);
    if (secondaryBurnTipDirection.lengthSq() > 0.000001) {
      secondaryBurnOppositeAnchorLocal.addScaledVector(
        secondaryBurnTipDirection.normalize(),
        secondaryBurnTipNudge
      );
    }

    let fxSamples: THREE.Vector3[] = secondaryBurnFxTipSamples;
    let fxRangeMin = secondaryBurnFxTipRangeMin;
    let fxRangeMax = secondaryBurnFxTipRangeMax;
    if (fxSamples.length === 0 && secondaryBurnFxFallbackTipSamples.length > 0) {
      fxSamples = secondaryBurnFxFallbackTipSamples;
      fxRangeMin = secondaryBurnFxFallbackTipRangeMin;
      fxRangeMax = secondaryBurnFxFallbackTipRangeMax;
    }
    if (fxSamples.length === 0) {
      fxSamples = tipSamples;
      fxRangeMin = tipRangeMin;
      fxRangeMax = tipRangeMax;
    }
    let fxFarthestDistanceSq = -Infinity;
    for (let i = 0; i < fxSamples.length; i += 1) {
      const distanceSq = fxSamples[i].lengthSq();
      if (distanceSq > fxFarthestDistanceSq) {
        fxFarthestDistanceSq = distanceSq;
      }
    }
    const fxDistanceBand = Math.max(
      0.0001,
      fxFarthestDistanceSq * secondaryBurnFxTipDistanceBandRatio
    );
    secondaryBurnTipAccum.set(0, 0, 0);
    let topBandMatchCount = 0;
    for (let i = 0; i < fxSamples.length; i += 1) {
      const sample = fxSamples[i];
      const distanceSq = sample.lengthSq();
      if (distanceSq < fxFarthestDistanceSq - fxDistanceBand) continue;
      secondaryBurnTipAccum.add(sample);
      topBandMatchCount += 1;
    }
    if (topBandMatchCount > 0) {
      secondaryBurnFxAnchorLocal.copy(
        secondaryBurnTipAccum.multiplyScalar(1 / topBandMatchCount)
      );
    } else {
      secondaryBurnFxAnchorLocal
        .copy(fxRangeMin)
        .add(fxRangeMax)
        .multiplyScalar(0.5);
    }
    secondaryBurnTipDirection.copy(secondaryBurnFxAnchorLocal);
    if (secondaryBurnTipDirection.lengthSq() > 0.000001) {
      secondaryBurnFxAnchorLocal.addScaledVector(
        secondaryBurnTipDirection.normalize(),
        secondaryBurnFxTopLift
      );
    }
  };

  const syncSecondaryBurnAnchors = (
    now: number,
    {
      force = false,
    }: {
      force?: boolean;
    } = {}
  ) => {
    if (!boundWeapon) return;
    if (!force && now - secondaryBurnAnchorLastResolvedAt < secondaryBurnAnchorResampleIntervalMs) {
      return;
    }
    resolveSecondaryBurnAnchor();
    secondaryBurnAnchorLastResolvedAt = now;
    secondaryBurnPreludeFxRoot.position.copy(secondaryBurnFxAnchorLocal);
    secondaryBurnFxRoot.position.copy(secondaryBurnFxAnchorLocal);
    secondaryBurnHoldTopFxRoot.position.copy(secondaryBurnHoldTopLocal);
  };

  const attachSecondaryBurnFx = () => {
    secondaryBurnPreludeAuraFxRoot.removeFromParent();
    secondaryBurnPreludeFxRoot.removeFromParent();
    secondaryBurnFxRoot.removeFromParent();
    secondaryBurnHoldTopFxRoot.removeFromParent();
    avatar.add(secondaryBurnPreludeAuraFxRoot);
    if (!boundWeapon) return;
    boundWeapon.add(secondaryBurnPreludeFxRoot);
    boundWeapon.add(secondaryBurnFxRoot);
    boundWeapon.add(secondaryBurnHoldTopFxRoot);
    syncSecondaryBurnAnchors(performance.now(), { force: true });
    secondaryBurnPreludeAuraFxRoot.position.set(0, 0, 0);
    secondaryBurnPreludeAuraFxRoot.rotation.set(0, 0, 0);
    secondaryBurnPreludeAuraFxRoot.scale.setScalar(1);
    secondaryBurnPreludeFxRoot.position.copy(secondaryBurnFxAnchorLocal);
    secondaryBurnPreludeFxRoot.rotation.set(0, 0, 0);
    secondaryBurnPreludeFxRoot.scale.setScalar(1);
    secondaryBurnFxRoot.position.copy(secondaryBurnFxAnchorLocal);
    secondaryBurnFxRoot.rotation.set(0, 0, 0);
    secondaryBurnFxRoot.scale.setScalar(1);
    secondaryBurnHoldTopFxRoot.position.copy(secondaryBurnHoldTopLocal);
    secondaryBurnHoldTopFxRoot.rotation.set(0, 0, 0);
    secondaryBurnHoldTopFxRoot.scale.setScalar(1);
  };

  const resetSecondaryBurnSwingTrail = (entry: SecondaryBurnSwingTrail) => {
    entry.active = false;
    entry.spawnedAt = 0;
    entry.endsAt = 0;
    entry.radiusScale = 1;
    entry.lengthScale = 1;
    entry.opacityScale = 1;
    entry.glowOpacityScale = 1;
    entry.root.visible = false;
    entry.root.position.set(0, 0, 0);
    entry.root.rotation.set(0, 0, 0);
    entry.root.quaternion.identity();
    entry.outerFlame.position.set(0, 0, 0);
    entry.outerFlame.rotation.set(0, 0, 0);
    entry.outerFlame.scale.setScalar(1);
    entry.innerFlame.position.set(0, 0, 0);
    entry.innerFlame.rotation.set(0, 0, 0);
    entry.innerFlame.scale.set(0.62, 0.86, 0.62);
    entry.glow.position.set(0, 0, 0);
    entry.glow.scale.setScalar(1);
    entry.outerMaterial.opacity = 0;
    entry.innerMaterial.opacity = 0;
    entry.glowMaterial.opacity = 0;
  };

  const clearSecondaryBurnSwingTrailFx = () => {
    secondaryBurnSwingTrailLastSpawnAt = -Infinity;
    secondaryBurnSwingTrailFxRoot.visible = false;
    for (let i = 0; i < secondaryBurnSwingTrails.length; i += 1) {
      resetSecondaryBurnSwingTrail(secondaryBurnSwingTrails[i]);
    }
  };

  const syncSecondaryBurnSwingTrailFxLayers = () => {
    const layerMask = avatar.layers.mask;
    secondaryBurnSwingTrailFxRoot.traverse((child) => {
      child.layers.mask = layerMask;
    });
  };

  const attachSecondaryBurnSwingTrailFx = () => {
    secondaryBurnSwingTrailFxRoot.removeFromParent();
    (avatar.parent ?? avatar).add(secondaryBurnSwingTrailFxRoot);
    syncSecondaryBurnSwingTrailFxLayers();
  };

  const acquireSecondaryBurnSwingTrail = () => {
    const poolSize = secondaryBurnSwingTrails.length;
    if (poolSize <= 0) return null;
    for (let attempt = 0; attempt < poolSize; attempt += 1) {
      const index = (secondaryBurnSwingTrailCursor + attempt) % poolSize;
      const candidate = secondaryBurnSwingTrails[index];
      if (candidate.active) continue;
      secondaryBurnSwingTrailCursor = (index + 1) % poolSize;
      return candidate;
    }
    const fallbackIndex = secondaryBurnSwingTrailCursor % poolSize;
    secondaryBurnSwingTrailCursor = (fallbackIndex + 1) % poolSize;
    const fallback = secondaryBurnSwingTrails[fallbackIndex];
    resetSecondaryBurnSwingTrail(fallback);
    return fallback;
  };

  const spawnSecondaryBurnSwingTrail = ({
    start,
    end,
    now,
    fallbackDirection,
    sizeScale = 1,
    opacityScale = 1,
    glowOpacityScale = opacityScale,
    ignoreSpawnInterval = false,
    spawnIntervalMs,
    suppressHoldBoost = false,
  }: {
    start: THREE.Vector3;
    end: THREE.Vector3;
    now: number;
    fallbackDirection?: THREE.Vector3;
    sizeScale?: number;
    opacityScale?: number;
    glowOpacityScale?: number;
    ignoreSpawnInterval?: boolean;
    spawnIntervalMs?: number;
    suppressHoldBoost?: boolean;
  }) => {
    const resolvedSpawnIntervalMs = Math.max(
      0,
      spawnIntervalMs ?? secondaryBurnSwingTrailSpawnIntervalMs
    );
    if (
      !ignoreSpawnInterval &&
      now - secondaryBurnSwingTrailLastSpawnAt < resolvedSpawnIntervalMs
    ) {
      return;
    }
    secondaryBurnSwingTrailDirection.copy(end).sub(start);
    const rawSweepDistance = secondaryBurnSwingTrailDirection.length();
    if (rawSweepDistance > secondaryBurnSwingTrailMinDistance) {
      secondaryBurnSwingTrailDirection.divideScalar(rawSweepDistance);
    } else if (fallbackDirection && fallbackDirection.lengthSq() > 0.000001) {
      secondaryBurnSwingTrailDirection.copy(fallbackDirection).normalize();
    } else {
      secondaryBurnSwingTrailDirection.copy(getAttackDirection(avatarForward));
    }

    const worldFxRoot = avatar.parent ?? avatar;
    if (secondaryBurnSwingTrailFxRoot.parent !== worldFxRoot) {
      attachSecondaryBurnSwingTrailFx();
    }
    const trail = acquireSecondaryBurnSwingTrail();
    if (!trail) return;

    const effectiveDistance = Math.max(
      rawSweepDistance,
      secondaryBurnSwingTrailVisualMinDistance
    );
    const sweepDistance = Math.min(effectiveDistance, secondaryBurnSwingTrailMaxDistance);
    const distanceRange = Math.max(
      0.001,
      secondaryBurnSwingTrailMaxDistance - secondaryBurnSwingTrailMinDistance
    );
    const distanceIntensity = THREE.MathUtils.clamp(
      (sweepDistance - secondaryBurnSwingTrailMinDistance) / distanceRange,
      0,
      1
    );
    const resolvedSizeScale = Math.max(0.2, sizeScale);
    const resolvedOpacityScale = THREE.MathUtils.clamp(opacityScale, 0, 1);
    const resolvedGlowOpacityScale = THREE.MathUtils.clamp(glowOpacityScale, 0, 1);
    const holdBoost =
      primaryHoldState.active && !suppressHoldBoost ? 0.24 : 0;
    const ferocity = 1 + distanceIntensity * 0.9 + holdBoost;

    trail.active = true;
    trail.spawnedAt = now;
    trail.endsAt =
      now +
      secondaryBurnSwingTrailLifetimeMs *
        (0.92 + distanceIntensity * 0.42 + holdBoost * 0.26);
    trail.radiusScale = Math.max(
      secondaryBurnSwingTrailMinRadiusScale,
      1.12 + ferocity * 0.88
    ) * resolvedSizeScale;
    trail.lengthScale = Math.max(
      secondaryBurnSwingTrailMinLengthScale,
      (sweepDistance / secondaryBurnFlameBaseHeight) * (1.04 + ferocity * 0.24)
    ) * resolvedSizeScale;
    trail.opacityScale = resolvedOpacityScale;
    trail.glowOpacityScale = resolvedGlowOpacityScale;
    secondaryBurnSwingTrailFxRoot.visible = true;
    trail.root.visible = true;
    trail.root.position.copy(start);
    trail.root.quaternion.setFromUnitVectors(avatarUp, secondaryBurnSwingTrailDirection);
    trail.root.rotateY(trail.phase + distanceIntensity * Math.PI * 0.36);

    trail.outerFlame.scale.set(
      trail.radiusScale,
      trail.lengthScale,
      trail.radiusScale
    );
    trail.outerFlame.rotation.set(0, 0, 0);

    trail.innerFlame.scale.set(
      trail.radiusScale * 0.62,
      trail.lengthScale * 0.84,
      trail.radiusScale * 0.62
    );
    trail.innerFlame.rotation.set(0, 0, 0);

    trail.glow.position.set(0, sweepDistance * 0.32, 0);
    trail.glow.scale.set(
      trail.radiusScale * 1.7,
      trail.radiusScale * 1.04,
      trail.radiusScale * 1.7
    );

    trail.outerMaterial.opacity = 0.92 * resolvedOpacityScale;
    trail.innerMaterial.opacity = 1 * resolvedOpacityScale;
    trail.glowMaterial.opacity = 0.72 * resolvedGlowOpacityScale;
    if (!ignoreSpawnInterval) {
      secondaryBurnSwingTrailLastSpawnAt = now;
    }
  };

  const clearSecondaryBurnFx = () => {
    secondaryBurnPreludeAuraFxRoot.visible = false;
    secondaryBurnPreludeFxRoot.visible = false;
    secondaryBurnFxRoot.visible = false;
    secondaryBurnHoldTopFxRoot.visible = false;
    secondaryBurnLight.visible = false;
    for (let i = 0; i < secondaryBurnPreludeAuraEmbers.length; i += 1) {
      const ember = secondaryBurnPreludeAuraEmbers[i];
      ember.mesh.visible = false;
      ember.material.opacity = 0;
    }
    for (let i = 0; i < secondaryBurnPreludeAuraSparks.length; i += 1) {
      const spark = secondaryBurnPreludeAuraSparks[i];
      spark.mesh.visible = false;
      spark.material.opacity = 0;
    }
    for (let i = 0; i < secondaryBurnPreludeEmbers.length; i += 1) {
      const ember = secondaryBurnPreludeEmbers[i];
      ember.mesh.visible = false;
      ember.material.opacity = 0;
    }
    for (let i = 0; i < secondaryBurnPreludeSparks.length; i += 1) {
      const spark = secondaryBurnPreludeSparks[i];
      spark.mesh.visible = false;
      spark.material.opacity = 0;
    }
    for (let i = 0; i < secondaryBurnEmbers.length; i += 1) {
      const ember = secondaryBurnEmbers[i];
      ember.mesh.visible = false;
      ember.material.opacity = 0;
    }
    for (let i = 0; i < secondaryBurnSmokeWisps.length; i += 1) {
      const smoke = secondaryBurnSmokeWisps[i];
      smoke.mesh.visible = false;
      smoke.material.opacity = 0;
    }
    for (let i = 0; i < secondaryBurnSparks.length; i += 1) {
      const spark = secondaryBurnSparks[i];
      spark.mesh.visible = false;
      spark.material.opacity = 0;
    }
    for (let i = 0; i < secondaryBurnHoldTopParticles.length; i += 1) {
      const particle = secondaryBurnHoldTopParticles[i];
      particle.mesh.visible = false;
      particle.material.opacity = 0;
    }
    for (let i = 0; i < secondaryBurnHoldTopSparks.length; i += 1) {
      const spark = secondaryBurnHoldTopSparks[i];
      spark.mesh.visible = false;
      spark.material.opacity = 0;
    }
    secondaryBurnHoldTopGlowMaterial.opacity = 0;
    clearSecondaryBurnSwingTrailFx();
  };

  const deactivateSecondaryBurn = ({
    immediate = false,
    now = performance.now(),
  }: {
    immediate?: boolean;
    now?: number;
  } = {}) => {
    const shouldFade =
      !immediate &&
      (secondaryBurnState.active || secondaryBurnState.fadingOut) &&
      secondaryBurnFxRoot.visible;
    secondaryBurnState.active = false;
    secondaryBurnState.activatedAt = 0;
    secondaryBurnState.endsAt = 0;
    secondaryBurnState.linkedToBurningMode = false;
    deactivateSuperBurn();

    if (shouldFade) {
      if (!secondaryBurnState.fadingOut) {
        secondaryBurnState.fadingOut = true;
        secondaryBurnState.fadeOutStartedAt = now;
      }
      return;
    }

    secondaryBurnState.fadingOut = false;
    secondaryBurnState.fadeOutStartedAt = 0;
    clearSecondaryBurnFx();
  };

  const activateSecondaryBurn = (
    now: number,
    {
      linkToBurningMode = false,
    }: {
      linkToBurningMode?: boolean;
    } = {}
  ) => {
    secondaryBurnState.active = true;
    secondaryBurnState.activatedAt = now;
    secondaryBurnState.linkedToBurningMode =
      linkToBurningMode && burningModeState.active;
    const baseEndAt = now + secondaryBurnDurationMs;
    secondaryBurnState.endsAt = secondaryBurnState.linkedToBurningMode
      ? Math.max(baseEndAt, burningModeState.endsAt)
      : baseEndAt;
    secondaryBurnState.fadingOut = false;
    secondaryBurnState.fadeOutStartedAt = 0;
    attachSecondaryBurnFx();
    secondaryBurnFxRoot.visible = true;
  };

  const resetAttackState = () => {
    attackState.active = false;
    attackState.queuedNext = false;
    attackState.currentIndex = -1;
    attackState.comboVariant = "normal";
    attackState.startedAt = 0;
    attackState.durationMs = 0;
    attackState.hitTargetIds.clear();
    attackState.hasWeaponSample = false;
    attackState.superThirdPoolSpawned = false;
    attackState.superThirdPoolHasWeaponSample = false;
    attackState.superThirdPoolPeakWeaponY = 0;
    attackState.superThirdPoolPreviousWeaponY = 0;
    attackState.nextHitAt = 0;
  };

  const resetPrimaryHoldState = () => {
    primaryHoldState.pressing = false;
    primaryHoldState.pressedAt = 0;
    primaryHoldState.active = false;
    primaryHoldState.nextTickAt = 0;
    primaryHoldState.hasWeaponSample = false;
    primaryHoldReflectBlocker.visible = false;
    stopActionBinding(holdAttackBinding);
  };

  const resetSkillEState = () => {
    skillEState.active = false;
    skillEState.startedAt = 0;
    skillEState.durationMs = 0;
    skillEState.hasWeaponSample = false;
    skillEState.initialWeaponY = 0;
    skillEState.peakWeaponY = 0;
    skillEState.lowestWeaponY = 0;
    skillEState.previousWeaponY = 0;
    skillEState.landingArmed = false;
    skillEState.flameTriggered = false;
  };

  const resetSkillQState = () => {
    skillQState.active = false;
    skillQState.startedAt = 0;
    skillQState.durationMs = 0;
  };

  const resetSkillQEState = ({
    preservePreludeFade = false,
  }: {
    preservePreludeFade?: boolean;
  } = {}) => {
    skillQEState.active = false;
    skillQEState.startedAt = 0;
    skillQEState.durationMs = 0;
    skillQEState.ignited = false;
    if (!preservePreludeFade) {
      skillQEPreludeFadeOutEndsAt = 0;
    }
  };

  const resetSkillRState = () => {
    skillRState.active = false;
    skillRState.startedAt = 0;
    skillRState.durationMs = 0;
    skillRState.hitTargetIds.clear();
    skillRState.hasWeaponSample = false;
    skillRState.activeBinding = null;
    skillRState.superFanMode = false;
    skillRState.nextFanTickAt = 0;
    skillRState.projectileMode = false;
    skillRState.projectileFired = false;
    resetSuperBurnSkillRFanFx();
  };

  const isMiniViewportRenderPass = (renderer: THREE.WebGLRenderer) => {
    renderer.getCurrentViewport(firstPersonHiddenBoneMaskViewport);
    return (
      firstPersonHiddenBoneMaskViewport.x > 0.5 ||
      firstPersonHiddenBoneMaskViewport.y > 0.5
    );
  };

  const removeFirstPersonHiddenBoneMaskRenderHooks = () => {
    for (let i = 0; i < firstPersonHiddenBoneMaskSplitEntries.length; i += 1) {
      const entry = firstPersonHiddenBoneMaskSplitEntries[i];
      entry.proxy.onBeforeRender = () => {};
      entry.proxy.onAfterRender = () => {};
      entry.proxy.removeFromParent();
      entry.proxy.geometry.dispose();
      for (let materialIndex = 0; materialIndex < entry.proxyMaterialStates.length; materialIndex += 1) {
        entry.proxyMaterialStates[materialIndex].material.dispose();
      }
      entry.source.layers.mask = entry.sourceLayerMask;
      entry.source.visible = true;
    }
    firstPersonHiddenBoneMaskSplitEntries = [];
  };

  const installFirstPersonHiddenBoneMaskRenderHooks = (model: THREE.Object3D) => {
    removeFirstPersonHiddenBoneMaskRenderHooks();
    const sourceMeshes: THREE.SkinnedMesh[] = [];
    model.traverse((child) => {
      if (!isSkinnedMeshObject(child) || !child.parent) return;
      sourceMeshes.push(child);
    });
    for (let i = 0; i < sourceMeshes.length; i += 1) {
      const source = sourceMeshes[i];
      const proxyGeometry = buildFirstPersonVisibleProxyGeometry(source);
      if (!proxyGeometry) continue;
      const sourceMaterials = Array.isArray(source.material)
        ? source.material
        : [source.material];
      const proxyMaterials = sourceMaterials.map((material) => material.clone());
      const proxyMaterial = Array.isArray(source.material)
        ? proxyMaterials
        : proxyMaterials[0];
      const proxy = new THREE.SkinnedMesh(proxyGeometry, proxyMaterial);
      proxy.name = `${source.name || "flareMesh"}__firstPerson`;
      proxy.bind(source.skeleton, source.bindMatrix);
      proxy.bindMode = source.bindMode;
      proxy.castShadow = source.castShadow;
      proxy.receiveShadow = source.receiveShadow;
      proxy.frustumCulled = source.frustumCulled;
      proxy.renderOrder = source.renderOrder;
      proxy.matrixAutoUpdate = source.matrixAutoUpdate;
      proxy.layers.mask = flareMainCameraLayerMask;
      proxy.position.copy(source.position);
      proxy.quaternion.copy(source.quaternion);
      proxy.scale.copy(source.scale);
      source.parent.add(proxy);
      const proxyMaterialStates: FirstPersonProxyMaterialState[] = proxyMaterials.map(
        (material) => ({
          material,
          colorWrite: material.colorWrite,
          depthWrite: material.depthWrite,
          depthTest: material.depthTest,
        })
      );
      proxy.onBeforeRender = (
        renderer,
        _scene,
        _camera,
        _geometry,
        material
      ) => {
        const state = proxyMaterialStates.find((entry) => entry.material === material);
        if (!state) return;
        if (isMiniViewportRenderPass(renderer)) {
          material.colorWrite = false;
          material.depthWrite = false;
          material.depthTest = false;
          return;
        }
        material.colorWrite = state.colorWrite;
        material.depthWrite = state.depthWrite;
        material.depthTest = state.depthTest;
      };
      proxy.onAfterRender = (
        _renderer,
        _scene,
        _camera,
        _geometry,
        material
      ) => {
        const state = proxyMaterialStates.find((entry) => entry.material === material);
        if (!state) return;
        material.colorWrite = state.colorWrite;
        material.depthWrite = state.depthWrite;
        material.depthTest = state.depthTest;
      };
      const sourceLayerMask = source.layers.mask;
      source.layers.mask = flareMiniBodyCameraLayerMask;
      source.visible = true;
      firstPersonHiddenBoneMaskSplitEntries.push({
        source,
        sourceLayerMask,
        proxy,
        proxyMaterialStates,
      });
    }
  };

  const clearFirstPersonHiddenBoneMask = () => {
    removeFirstPersonHiddenBoneMaskRenderHooks();
  };

  const clearAnimationBinding = () => {
    clearFirstPersonHiddenBoneMask();
    stopAllAttackActions();
    stopAllSkillActions();
    if (walkAction) {
      walkAction.stop();
      walkAction = null;
    }
    if (walkLegsAction) {
      walkLegsAction.stop();
      walkLegsAction = null;
    }
    if (mixer && boundModel) {
      mixer.stopAllAction();
      mixer.uncacheRoot(boundModel);
    }
    secondaryBurnPreludeAuraFxRoot.removeFromParent();
    secondaryBurnPreludeFxRoot.removeFromParent();
    secondaryBurnFxRoot.removeFromParent();
    secondaryBurnHoldTopFxRoot.removeFromParent();
    secondaryBurnSwingTrailFxRoot.removeFromParent();
    burningModePreludeAuraFxRoot.removeFromParent();
    burningModeHeadFxAnchor.removeFromParent();
    mixer = null;
    normalAttackBindings = [];
    superBurnAttackBindings = [];
    holdAttackBinding = null;
    skillQBinding = null;
    skillQEBinding = null;
    skillEBinding = null;
    skillRBinding = null;
    skillQERSkillBinding = null;
    boundModel = null;
    boundBurningModeSurface = null;
    boundBurningModeAnchor = null;
    boundBurningModeFallbackHead = null;
    boundWeapon = null;
    boundWeaponMatrixFrameStamp = -1;
    secondaryBurnAnchorLastResolvedAt = -Infinity;
    boundWeaponMeshes = [];
    lastAnimationUpdateAt = 0;
    resetAttackState();
    resetPrimaryHoldState();
    resetSkillEState();
    resetSkillQState();
    resetSkillQEState();
    resetSkillRState();
    deactivateSecondaryBurn({ immediate: true });
    deactivateBurningMode();
    clearAllSkillRBurns();
    clearAllSkillRBurnExplosionFx();
    clearAllSuperBurnFlamePools();
    for (let i = 0; i < skillRProjectileVisuals.length; i += 1) {
      resetSkillRProjectileVisual(skillRProjectileVisuals[i]);
    }
    lastCompletedAttackIndex = -1;
    lastCompletedAttackAt = -Infinity;
  };

  const bindModel = (model: THREE.Object3D | null) => {
    if (model === boundModel) return;
    clearAnimationBinding();
    if (!model) return;

    boundModel = model;
    boundBurningModeSurface = findCoverNode(model);
    boundBurningModeAnchor = isSkinnedMeshObject(boundBurningModeSurface)
      ? findDominantSkinBone(boundBurningModeSurface) ?? boundBurningModeSurface
      : boundBurningModeSurface;
    boundBurningModeFallbackHead =
      !boundBurningModeSurface ? findHeadNode(model) : null;
    boundWeapon = findWeaponNode(model);
    boundWeaponMatrixFrameStamp = -1;
    secondaryBurnAnchorLastResolvedAt = -Infinity;
    boundWeaponMeshes = findWeaponMeshes(model);
    if (profile.camera?.hideLocalBody === true) {
      installFirstPersonHiddenBoneMaskRenderHooks(model);
    }
    mixer = new THREE.AnimationMixer(model);

    attachBurningModeHeadFx();
    attachSecondaryBurnSwingTrailFx();
    if (boundWeapon) {
      attachSecondaryBurnFx();
    }

    const resolvedWalkClip = makeLoopSeamlessClip(
      resolveInPlaceClip(model, walkClipName)
    );
    if (resolvedWalkClip) {
      walkAction = mixer.clipAction(resolvedWalkClip);
      walkAction.setLoop(THREE.LoopRepeat, Infinity);
      walkAction.enabled = true;
      walkAction.play();
      walkAction.paused = true;
      walkAction.setEffectiveWeight(0);

      const resolvedWalkLegsClip = filterClipTracks(
        resolvedWalkClip,
        (track) => legTrackPattern.test(track.name)
      );
      if (resolvedWalkLegsClip) {
        walkLegsAction = mixer.clipAction(resolvedWalkLegsClip);
        walkLegsAction.setLoop(THREE.LoopRepeat, Infinity);
        walkLegsAction.enabled = true;
        walkLegsAction.play();
        walkLegsAction.paused = true;
        walkLegsAction.setEffectiveWeight(0);
      }
    }

    const createAttackBindings = (combo: readonly AttackStepConfig[]) =>
      combo.flatMap((config) => {
        if (!mixer) return [];
        const binding = createOneShotBinding(
          mixer,
          filterClipTracks(
            resolveInPlaceClipWithFallbacks(model, config.clipName),
            (track) => !legTrackPattern.test(track.name)
          ),
          config.clipName
        );
        if (!binding) return [];
        return [{ ...binding, config }];
      });

    normalAttackBindings = createAttackBindings(normalAttackCombo);
    superBurnAttackBindings = createAttackBindings(superBurnAttackCombo);

    if (mixer) {
      holdAttackBinding = createLoopBinding(
        mixer,
        makeLoopSeamlessClip(
          filterClipTracks(
            resolveInPlaceClip(model, holdAttackClipName),
            (track) => !legTrackPattern.test(track.name)
          )
        ),
        holdAttackClipName
      );
      skillQBinding = createOneShotBinding(
        mixer,
        resolveInPlaceClip(model, skillQClipName),
        skillQClipName
      );
      skillQEBinding = createOneShotBinding(
        mixer,
        resolveInPlaceClip(model, skillQEClipName) ??
          resolveInPlaceClip(model, "skillQE"),
        skillQEClipName
      );
      skillEBinding = createOneShotBinding(
        mixer,
        resolveInPlaceClip(model, skillEClipName),
        skillEClipName
      );
      skillRBinding = createOneShotBinding(
        mixer,
        resolveInPlaceClip(model, skillRClipName),
        skillRClipName
      );
      skillQERSkillBinding = createOneShotBinding(
        mixer,
        resolveInPlaceClip(model, skillQESkillRClipName) ??
          resolveInPlaceClip(model, "skillQE_R"),
        skillQESkillRClipName
      );
    }
  };

  const getAttackDirection = (target = new THREE.Vector3()) => {
    if (latestAimDirection.lengthSq() > 0.000001) {
      target.copy(latestAimDirection);
    } else {
      target.set(0, 0, 1).applyQuaternion(avatar.quaternion);
    }
    target.y = 0;
    if (target.lengthSq() < 0.000001) {
      target.copy(avatarForward.set(0, 0, 1).applyQuaternion(avatar.quaternion));
      target.y = 0;
    }
    if (target.lengthSq() < 0.000001) {
      target.set(0, 0, 1);
    }
    return target.normalize();
  };

  const getProjectileAimDirection = (target = new THREE.Vector3()) => {
    if (latestAimDirection.lengthSq() > 0.000001) {
      target.copy(latestAimDirection);
    } else {
      target.set(0, 0, 1).applyQuaternion(avatar.quaternion);
    }
    if (target.lengthSq() < 0.000001) {
      target.set(0, 0, 1);
    }
    return target.normalize();
  };

  const syncAttackFacingToAim = () => {
    if (
      (!attackState.active && !primaryHoldState.active) ||
      latestAimDirection.lengthSq() <= 0.000001
    ) {
      return;
    }
    avatar.rotation.y = Math.atan2(latestAimDirection.x, latestAimDirection.z);
  };

  const isDescendantOf = (
    object: THREE.Object3D | null,
    ancestor: THREE.Object3D
  ) => {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
  };

  const getWeaponSweepSamplePositionFromLocal = (
    localPoint: THREE.Vector3,
    target: THREE.Vector3
  ) => {
    if (!boundWeapon) return false;
    if (boundWeaponMatrixFrameStamp !== runtimeFrameStamp) {
      boundWeapon.updateMatrixWorld(true);
      boundWeaponMatrixFrameStamp = runtimeFrameStamp;
    }
    target.copy(localPoint);
    boundWeapon.localToWorld(target);
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.z)) {
      boundWeapon.getWorldPosition(target);
    }
    return true;
  };

  const getWeaponSweepSamplePosition = (target: THREE.Vector3) =>
    getWeaponSweepSamplePositionFromLocal(secondaryBurnAnchorLocal, target);

  const getWeaponFxTipSamplePosition = (target: THREE.Vector3) =>
    getWeaponSweepSamplePositionFromLocal(secondaryBurnFxAnchorLocal, target);

  const updatePrimaryHoldProjectileReflectBlocker = () => {
    const shouldReflect =
      primaryHoldState.active && (secondaryBurnState.active || superBurnState.active);
    if (!shouldReflect) {
      primaryHoldReflectBlocker.visible = false;
      return;
    }

    const hasPrimaryPoint = getWeaponSweepSamplePosition(currentWeaponWorldPosition);
    const hasSecondaryPoint = getWeaponSweepSamplePositionFromLocal(
      secondaryBurnOppositeAnchorLocal,
      currentWeaponOppositeWorldPosition
    );
    if (!hasPrimaryPoint && !hasSecondaryPoint) {
      primaryHoldReflectBlocker.visible = false;
      return;
    }

    if (hasPrimaryPoint && hasSecondaryPoint) {
      primaryHoldReflectCenterWorld
        .copy(currentWeaponWorldPosition)
        .add(currentWeaponOppositeWorldPosition)
        .multiplyScalar(0.5);
    } else if (hasPrimaryPoint) {
      primaryHoldReflectCenterWorld.copy(currentWeaponWorldPosition);
    } else {
      primaryHoldReflectCenterWorld.copy(currentWeaponOppositeWorldPosition);
    }
    primaryHoldReflectCenterWorld.y += primaryHoldReflectCenterLift;

    avatar.updateMatrixWorld(true);
    primaryHoldReflectLocalPosition.copy(primaryHoldReflectCenterWorld);
    avatar.worldToLocal(primaryHoldReflectLocalPosition);
    primaryHoldReflectBlocker.position.copy(primaryHoldReflectLocalPosition);

    const reflectRadius =
      primaryHoldReflectRadius *
      (superBurnState.active ? primaryHoldReflectSuperRadiusMultiplier : 1);
    primaryHoldReflectBlocker.scale.setScalar(reflectRadius);
    primaryHoldReflectBlocker.visible = true;
    primaryHoldReflectBlocker.updateMatrixWorld(true);
  };

  const sampleWeaponPosition = (state: WeaponSampleState) => {
    if (!getWeaponSweepSamplePosition(previousWeaponWorldPosition)) return false;
    if (!getWeaponFxTipSamplePosition(previousWeaponFxWorldPosition)) {
      previousWeaponFxWorldPosition.copy(previousWeaponWorldPosition);
    }
    state.hasWeaponSample = true;
    return true;
  };

  const applyWeaponSweepHit = (
    config: WeaponHitConfig,
    hitTargetIds: Set<string>,
    directionOverride?: THREE.Vector3,
    now = performance.now(),
    grantBasicAttackManaOnHit = false
  ) => {
    if (!performMeleeAttack || !getWeaponSweepSamplePosition(currentWeaponWorldPosition)) return;
    if (secondaryBurnState.active) {
      syncSecondaryBurnAnchors(now);
    }
    if (!getWeaponFxTipSamplePosition(currentWeaponFxWorldPosition)) {
      currentWeaponFxWorldPosition.copy(currentWeaponWorldPosition);
    }
    const attackDirection = directionOverride
      ? directionOverride
      : getAttackDirection(avatarForward);

    swingDelta.copy(currentWeaponWorldPosition).sub(previousWeaponWorldPosition);
    const sweepDistance = swingDelta.length();
    const clampedSweepDistance = Math.min(sweepDistance, flareWeaponSweepMaxDistance);
    const sweepHitRadius = config.collisionRadius * flareWeaponSweepRadiusScale;
    const contactHitRadius = config.collisionRadius * flareWeaponContactRadiusScale;
    const sweepDirection =
      sweepDistance > 0.0001
        ? attackSweepDirection.copy(swingDelta).multiplyScalar(1 / sweepDistance)
        : attackDirection;
    const burnStackCount = superBurnState.active ? superBurnBasicAttackBurnStacks : 1;
    const burnApplicationMode = "direct";
    const onHitTargetResolved = secondaryBurnState.active
      ? ({
          targetId,
          targetObject,
          isTargetActive,
          dealDamageToTarget,
          now: hitNow,
        }: MeleeHitTargetResolvedArgs) => {
          applySecondaryBurnSkillRBurn({
            targetId,
            targetObject,
            isTargetActive,
            dealDamageToTarget,
            now: hitNow,
            stackCount: burnStackCount,
            applicationMode: burnApplicationMode,
          });
        }
      : undefined;

    if (secondaryBurnState.active) {
      const trailSpawnInterval = superBurnState.active
        ? superBurnSwingTrailSpawnIntervalMs
        : secondaryBurnSwingTrailSpawnIntervalMs;
      spawnSecondaryBurnSwingTrail({
        start: previousWeaponFxWorldPosition,
        end: currentWeaponFxWorldPosition,
        now,
        fallbackDirection: attackDirection,
        spawnIntervalMs: trailSpawnInterval,
      });
    }

    if (sweepDistance > 0.0001) {
      performMeleeAttack({
        damage: config.damage,
        maxDistance: clampedSweepDistance,
        hitRadius: sweepHitRadius,
        maxHits: config.maxHits,
        origin: previousWeaponWorldPosition,
        direction: sweepDirection,
        excludeTargetIds: hitTargetIds,
        onHitTarget: (targetId) => {
          hitTargetIds.add(targetId);
          if (grantBasicAttackManaOnHit) {
            applyMana?.(basicAttackHitManaGain);
          }
        },
        onHitTargetResolved,
      });
    }

    const applyWeaponContactHit = (center: THREE.Vector3, radius: number) => {
      performMeleeAttack({
        damage: config.damage,
        maxDistance: 0.001,
        contactCenter: center,
        contactRadius: radius,
        maxHits: config.maxHits,
        direction: attackDirection,
        excludeTargetIds: hitTargetIds,
        onHitTarget: (targetId) => {
          hitTargetIds.add(targetId);
          if (grantBasicAttackManaOnHit) {
            applyMana?.(basicAttackHitManaGain);
          }
        },
        onHitTargetResolved,
      });
    };

    applyWeaponContactHit(currentWeaponWorldPosition, contactHitRadius);

    if (
      getWeaponSweepSamplePositionFromLocal(
        secondaryBurnOppositeAnchorLocal,
        currentWeaponOppositeWorldPosition
      )
    ) {
      applyWeaponContactHit(currentWeaponOppositeWorldPosition, contactHitRadius);
      weaponContactMidpointWorldPosition
        .copy(currentWeaponWorldPosition)
        .add(currentWeaponOppositeWorldPosition)
        .multiplyScalar(0.5);
      applyWeaponContactHit(
        weaponContactMidpointWorldPosition,
        contactHitRadius * 0.85
      );
    }

    previousWeaponWorldPosition.copy(currentWeaponWorldPosition);
    previousWeaponFxWorldPosition.copy(currentWeaponFxWorldPosition);
  };

  const startAttack = (
    index: number,
    now: number,
    preferredVariant: "normal" | "super" = resolveAttackVariantForNewCombo()
  ) => {
    const { binding, variant } = resolveAttackBinding(index, preferredVariant);
    if (!binding) return false;

    stopAllAttackActions();
    attackState.active = true;
    attackState.queuedNext = false;
    attackState.currentIndex = index;
    attackState.comboVariant = variant;
    attackState.startedAt = now;
    attackState.durationMs = Math.max(1, binding.clip.duration * 1000);
    attackState.hitTargetIds.clear();
    attackState.hasWeaponSample = false;
    attackState.superThirdPoolSpawned = false;
    attackState.superThirdPoolHasWeaponSample = false;
    attackState.superThirdPoolPeakWeaponY = 0;
    attackState.superThirdPoolPreviousWeaponY = 0;
    attackState.nextHitAt = 0;

    return playActionBinding(binding);
  };

  const finishAttack = (now: number) => {
    const binding =
      getAttackBindingsByVariant(attackState.comboVariant)[attackState.currentIndex];
    stopActionBinding(binding ?? null);

    lastCompletedAttackIndex = attackState.currentIndex;
    lastCompletedAttackAt = now;
    resetAttackState();
  };

  const startPrimaryHold = (now: number) => {
    if (!holdAttackBinding) return false;
    stopAllAttackActions();
    primaryHoldState.active = true;
    primaryHoldState.nextTickAt = now + primaryHoldTickIntervalMs;
    primaryHoldState.hasWeaponSample = false;
    getAttackDirection(avatarForward);
    avatar.rotation.y = Math.atan2(avatarForward.x, avatarForward.z);
    return playActionBinding(holdAttackBinding);
  };

  const finishPrimaryHold = () => {
    primaryHoldState.active = false;
    primaryHoldState.nextTickAt = 0;
    primaryHoldState.hasWeaponSample = false;
    primaryHoldReflectBlocker.visible = false;
    stopActionBinding(holdAttackBinding);
  };

  const resolvePrimaryHoldTickDamage = () => {
    if (superBurnState.active) {
      return primaryHoldSuperBurnDamagePerTick;
    }
    if (secondaryBurnState.active) {
      return primaryHoldSecondaryBurnDamagePerTick;
    }
    return primaryHoldBaseDamagePerTick;
  };

  const applyPrimaryHoldDamageTick = () => {
    if (!performMeleeAttack) return;
    const hasPrimaryPoint = getWeaponSweepSamplePosition(currentWeaponWorldPosition);
    const hasSecondaryPoint = getWeaponSweepSamplePositionFromLocal(
      secondaryBurnOppositeAnchorLocal,
      currentWeaponOppositeWorldPosition
    );
    if (!hasPrimaryPoint && !hasSecondaryPoint) return;

    const damage = resolvePrimaryHoldTickDamage();
    if (damage <= 0) return;

    const shouldApplyBurn = secondaryBurnState.active || superBurnState.active;
    const burnApplicationMode = "direct";
    const onHitTargetResolved = shouldApplyBurn
      ? ({
          targetId,
          targetObject,
          isTargetActive,
          dealDamageToTarget,
          now: hitNow,
        }: MeleeHitTargetResolvedArgs) => {
          applySecondaryBurnSkillRBurn({
            targetId,
            targetObject,
            isTargetActive,
            dealDamageToTarget,
            now: hitNow,
            stackCount: 1,
            applicationMode: burnApplicationMode,
          });
        }
      : undefined;

    getAttackDirection(primaryHoldAttackDirection);
    primaryHoldTickHitTargetIds.clear();

    const applyContactTick = (center: THREE.Vector3, radius: number) => {
      performMeleeAttack({
        damage,
        maxDistance: 0.001,
        contactCenter: center,
        contactRadius: radius,
        maxHits: primaryHoldMaxHitsPerTick,
        direction: primaryHoldAttackDirection,
        excludeTargetIds: primaryHoldTickHitTargetIds,
        onHitTarget: (targetId) => {
          primaryHoldTickHitTargetIds.add(targetId);
        },
        onHitTargetResolved,
      });
    };

    if (hasPrimaryPoint) {
      applyContactTick(currentWeaponWorldPosition, primaryHoldContactRadius);
      primaryHoldForwardContactWorldPosition
        .copy(currentWeaponWorldPosition)
        .addScaledVector(
          primaryHoldAttackDirection,
          primaryHoldForwardContactOffset
        );
      applyContactTick(
        primaryHoldForwardContactWorldPosition,
        primaryHoldForwardContactRadius
      );
    }
    if (hasSecondaryPoint) {
      applyContactTick(currentWeaponOppositeWorldPosition, primaryHoldContactRadius);
    }
    if (hasPrimaryPoint && hasSecondaryPoint) {
      weaponContactMidpointWorldPosition
        .copy(currentWeaponWorldPosition)
        .add(currentWeaponOppositeWorldPosition)
        .multiplyScalar(0.5);
      applyContactTick(weaponContactMidpointWorldPosition, primaryHoldMidContactRadius);
      primaryHoldForwardMidContactWorldPosition
        .copy(weaponContactMidpointWorldPosition)
        .addScaledVector(
          primaryHoldAttackDirection,
          primaryHoldForwardContactOffset * 0.7
        );
      applyContactTick(
        primaryHoldForwardMidContactWorldPosition,
        primaryHoldForwardMidContactRadius
      );
    }
  };

  const updatePrimaryHoldDamage = (now: number) => {
    if (!primaryHoldState.active) {
      primaryHoldState.nextTickAt = 0;
      return;
    }
    if (primaryHoldState.nextTickAt <= 0) {
      primaryHoldState.nextTickAt = now + primaryHoldTickIntervalMs;
      return;
    }

    while (primaryHoldState.active && now + 0.001 >= primaryHoldState.nextTickAt) {
      primaryHoldState.nextTickAt += primaryHoldTickIntervalMs;
      applyPrimaryHoldDamageTick();
    }
  };

  const updatePrimaryHoldTrailFx = (now: number) => {
    if (!primaryHoldState.active || !secondaryBurnState.active) {
      primaryHoldState.hasWeaponSample = false;
      return;
    }
    if (
      !getWeaponSweepSamplePosition(currentWeaponWorldPosition) ||
      !getWeaponSweepSamplePositionFromLocal(
        secondaryBurnOppositeAnchorLocal,
        currentWeaponOppositeWorldPosition
      )
    ) {
      primaryHoldState.hasWeaponSample = false;
      return;
    }
    if (!primaryHoldState.hasWeaponSample) {
      previousWeaponWorldPosition.copy(currentWeaponWorldPosition);
      previousWeaponOppositeWorldPosition.copy(currentWeaponOppositeWorldPosition);
      primaryHoldState.hasWeaponSample = true;
      return;
    }

    if (now - secondaryBurnSwingTrailLastSpawnAt < secondaryBurnSwingTrailSpawnIntervalMs) {
      previousWeaponWorldPosition.copy(currentWeaponWorldPosition);
      previousWeaponOppositeWorldPosition.copy(currentWeaponOppositeWorldPosition);
      return;
    }

    const fallbackDirection = getAttackDirection(avatarForward);
    spawnSecondaryBurnSwingTrail({
      start: previousWeaponWorldPosition,
      end: currentWeaponWorldPosition,
      now,
      fallbackDirection,
      sizeScale: secondaryBurnPrimaryHoldTrailSizeScale,
      opacityScale: secondaryBurnPrimaryHoldTrailOpacityScale,
      glowOpacityScale: secondaryBurnPrimaryHoldTrailGlowOpacityScale,
      suppressHoldBoost: true,
    });
    spawnSecondaryBurnSwingTrail({
      start: previousWeaponOppositeWorldPosition,
      end: currentWeaponOppositeWorldPosition,
      now,
      fallbackDirection,
      sizeScale: secondaryBurnPrimaryHoldTrailSizeScale,
      opacityScale: secondaryBurnPrimaryHoldTrailOpacityScale,
      glowOpacityScale: secondaryBurnPrimaryHoldTrailGlowOpacityScale,
      ignoreSpawnInterval: true,
      suppressHoldBoost: true,
    });
    previousWeaponWorldPosition.copy(currentWeaponWorldPosition);
    previousWeaponOppositeWorldPosition.copy(currentWeaponOppositeWorldPosition);
  };

  const startSkillQ = (now: number) => {
    if (!skillQBinding) return false;
    stopAllSkillActions();
    resetSkillQState();
    skillQState.active = true;
    skillQState.startedAt = now;
    skillQState.durationMs = Math.max(1, skillQBinding.clip.duration * 1000);
    getAttackDirection(skillQDirection);
    avatar.rotation.y = Math.atan2(skillQDirection.x, skillQDirection.z);
    activateBurningMode(now);
    return playActionBinding(skillQBinding);
  };

  const finishSkillQ = () => {
    stopActionBinding(skillQBinding);
    resetSkillQState();
  };

  const startSkillQE = (now: number) => {
    if (!skillQEBinding) return false;
    stopAllSkillActions();
    resetSkillQState();
    resetSkillQEState();
    resetSkillEState();
    skillQEPreludeFadeOutEndsAt = 0;
    skillQEState.active = true;
    skillQEState.startedAt = now;
    skillQEState.durationMs = Math.max(1, skillQEBinding.clip.duration * 1000);
    getAttackDirection(skillQDirection);
    avatar.rotation.y = Math.atan2(skillQDirection.x, skillQDirection.z);
    return playActionBinding(skillQEBinding);
  };

  const finishSkillQE = () => {
    stopActionBinding(skillQEBinding);
    resetSkillQEState({ preservePreludeFade: true });
  };

  const igniteSkillQE = (now: number) => {
    if (skillQEState.ignited) return;
    skillQEState.ignited = true;
    skillQEPreludeFadeOutEndsAt = Math.max(
      skillQEPreludeFadeOutEndsAt,
      now + skillQEPreludeFadeOutMs
    );
    activateSecondaryBurn(now, { linkToBurningMode: true });
    activateSuperBurn(now);
  };

  const startSkillE = (now: number) => {
    if (!skillEBinding) return false;
    stopAllSkillActions();
    resetSkillEState();
    skillEState.active = true;
    skillEState.startedAt = now;
    skillEState.durationMs = Math.max(1, skillEBinding.clip.duration * 1000);
    return playActionBinding(skillEBinding);
  };

  const finishSkillE = () => {
    stopActionBinding(skillEBinding);
    resetSkillEState();
  };

  const updateSkillRProjectileVisual = (
    entry: SkillRProjectileVisual,
    now: number,
    velocity: THREE.Vector3
  ) => {
    skillRProjectileVelocityDirection.copy(velocity);
    if (skillRProjectileVelocityDirection.lengthSq() < 0.000001) {
      skillRProjectileVelocityDirection.copy(skillRDirection);
    }
    if (skillRProjectileVelocityDirection.lengthSq() < 0.000001) {
      skillRProjectileVelocityDirection.set(0, 0, 1);
    } else {
      skillRProjectileVelocityDirection.normalize();
    }

    entry.root.visible = true;
    entry.root.quaternion.setFromUnitVectors(
      skillRProjectileForwardAxis,
      skillRProjectileVelocityDirection
    );

    const t = now * 0.001;
    const age = Math.max(0, now - entry.launchedAt) * 0.001;
    const pulse = 1 + Math.sin(t * 16 + age * 8) * 0.12 + Math.cos(t * 9.4) * 0.06;
    const flare = 1 + Math.sin(t * 23.6) * 0.08 + Math.cos(t * 14.2) * 0.05;

    entry.root.scale.set(1 + pulse * 0.12, 1 + flare * 0.08, 1.1 + pulse * 0.24);
    entry.material.opacity = 0.8 + flare * 0.08;
    entry.material.emissiveIntensity = 1.7 + pulse * 0.28;
    entry.core.scale.setScalar(0.92 + pulse * 0.18);
    entry.coreMaterial.opacity = 0.88 + flare * 0.08;
    entry.coreMaterial.emissiveIntensity = 2 + pulse * 0.36;

    for (let i = 0; i < entry.flames.length; i += 1) {
      const flame = entry.flames[i];
      const spin = t * flame.orbitSpeed + flame.phase;
      flame.mesh.position.set(
        Math.cos(spin) * flame.orbitRadius,
        Math.sin(spin * 1.4) * 0.04,
        -0.08 - flame.orbitRadius * 1.2
      );
      flame.mesh.rotation.set(
        Math.PI / 2 + Math.sin(spin) * flame.tilt,
        0,
        spin + flame.tilt
      );
      flame.mesh.scale.copy(flame.baseScale).multiplyScalar(0.86 + pulse * 0.2);
      flame.material.opacity = 0.56 + flare * 0.12;
      flame.material.emissiveIntensity = 1.28 + pulse * 0.24;
    }

    for (let i = 0; i < entry.sparks.length; i += 1) {
      const spark = entry.sparks[i];
      const spin = t * spark.orbitSpeed + spark.phase;
      const rise = Math.sin(spin * 1.8) * 0.06 + spark.lift * 0.08;
      spark.mesh.visible = true;
      spark.mesh.position.set(
        Math.cos(spin) * spark.orbitRadius,
        rise,
        Math.sin(spin) * spark.orbitRadius * 0.72
      );
      spark.mesh.rotation.set(spin * 1.2, spin * 0.9, spin * 1.6);
      spark.mesh.scale.setScalar(spark.scale * (0.68 + pulse * 0.22));
      spark.material.opacity = 0.22 + flare * 0.16;
    }
  };

  const getSecondaryBurnSkillRBurnExplosionDamage = (distance: number) => {
    const falloff = 1 - THREE.MathUtils.clamp(
      distance / secondaryBurnSkillRBurnExplosionRadius,
      0,
      1
    );
    return Math.max(
      secondaryBurnSkillRBurnExplosionMinDamage,
      Math.round(
        THREE.MathUtils.lerp(
          secondaryBurnSkillRBurnExplosionMinDamage,
          secondaryBurnSkillRBurnExplosionDamage,
          falloff
        )
      )
    );
  };

  const launchSecondaryBurnSkillRBurnExplosionBurst = ({
    center,
    sharedHitGroupId,
    primaryTargetId,
  }: {
    center: THREE.Vector3;
    sharedHitGroupId: string;
    primaryTargetId: string;
  }) => {
    if (!fireProjectile) return;
    const explosionCenter = center.clone();

    for (
      let i = 0;
      i < secondaryBurnSkillRBurnExplosionBurstDirections.length;
      i += 1
    ) {
      const burstDirection =
        secondaryBurnSkillRBurnExplosionBurstDirections[i].clone();

      fireProjectile({
        projectileType: "abilityOrb",
        origin: explosionCenter.clone(),
        direction: burstDirection,
        speed: secondaryBurnSkillRBurnExplosionBurstSpeed,
        lifetime: secondaryBurnSkillRBurnExplosionBurstLifetimeSec,
        gravity: 0,
        radius: secondaryBurnSkillRBurnExplosionBurstRadius,
        targetHitRadius: 0,
        damage: 1,
        scale: secondaryBurnSkillRBurnExplosionBurstVisualScale,
        color: i % 3 === 0 ? 0xfff2be : i % 2 === 0 ? 0xffb347 : 0xff7b24,
        emissive: 0xffa13c,
        emissiveIntensity: 1.4,
        splitOnImpact: false,
        explodeOnTargetHit: false,
        explodeOnWorldHit: false,
        explodeOnExpire: false,
        removeOnTargetHit: true,
        removeOnWorldHit: true,
        singleHitPerTarget: true,
        sharedHitGroupId,
        lifecycle: {
          onTargetHit: ({
            now: hitNow,
            targetId,
            targetObject,
            isTargetActive,
            dealDamageToTarget,
          }) => {
            const targetCenter = new THREE.Vector3();
            targetObject.updateMatrixWorld(true);
            targetObject.getWorldPosition(targetCenter);
            const splashDamage =
              targetId === primaryTargetId
                ? secondaryBurnSkillRBurnExplosionDamage
                : getSecondaryBurnSkillRBurnExplosionDamage(
                    targetCenter.distanceTo(explosionCenter)
                  );
            const extraDamage = Math.max(0, splashDamage - 1);
            if (extraDamage > 0) {
              dealDamageToTarget(extraDamage, hitNow);
            }
            applySecondaryBurnSkillRBurn({
              targetId,
              targetObject,
              isTargetActive,
              dealDamageToTarget,
              now: hitNow,
              applicationMode: "explosion",
            });
          },
        },
      });
    }
  };

  const triggerSecondaryBurnSkillRBurnExplosion = (
    entry: ActiveSkillRBurn,
    now: number
  ) => {
    if (!entry.targetObject.parent) {
      clearSkillRBurn(entry.targetId);
      return;
    }

    const hasBounds = resolveSkillRBurnBounds({
      targetObject: entry.targetObject,
      bounds: skillRBurnBounds,
      meshBounds: skillRBurnMeshBounds,
    });
    if (!hasBounds || skillRBurnBounds.isEmpty()) {
      entry.targetObject.getWorldPosition(skillRBurnExplosionCenter);
      skillRBurnExplosionCenter.y += 1;
    } else {
      skillRBurnBounds.getCenter(skillRBurnExplosionCenter);
      skillRBurnExplosionCenter.y =
        skillRBurnBounds.min.y + (skillRBurnBounds.max.y - skillRBurnBounds.min.y) * 0.55;
    }
    const explosionCenter = skillRBurnExplosionCenter.clone();

    clearSkillRBurn(entry.targetId);
    entry.dealDamageToTarget(secondaryBurnSkillRBurnExplosionDirectDamage, now);
    spawnSecondaryBurnSkillRBurnExplosionFx(explosionCenter, now);
    applySecondaryBurnSkillRBurn({
      targetId: entry.targetId,
      targetObject: entry.targetObject,
      isTargetActive: entry.isTargetActive,
      dealDamageToTarget: entry.dealDamageToTarget,
      now,
      applicationMode: "explosion",
    });
    launchSecondaryBurnSkillRBurnExplosionBurst({
      center: explosionCenter,
      sharedHitGroupId: `flare-skillr-burn-explosion-${skillRBurnExplosionBurstSerial++}`,
      primaryTargetId: entry.targetId,
    });
  };

  const applySecondaryBurnSkillRBurn = ({
    targetId,
    targetObject,
    isTargetActive,
    dealDamageToTarget,
    now,
    applicationMode = "direct",
    stackCount = 1,
  }: {
    targetId: string;
    targetObject: THREE.Object3D;
    isTargetActive: () => boolean;
    dealDamageToTarget: (damage: number, now?: number) => void;
    now: number;
    applicationMode?: "direct" | "directSafe" | "explosion";
    stackCount?: number;
  }) => {
    const targetAnchorObject = resolveSkillRBurnAnchorObject(targetObject);
    const resolvedStackCount = Math.max(1, Math.floor(stackCount));
    let entry = activeSkillRBurns.get(targetId) ?? null;
    let createdEntry = false;
    if (entry) {
      entry.targetObject = targetObject;
      entry.isTargetActive = isTargetActive;
      entry.dealDamageToTarget = dealDamageToTarget;
      if (entry.fxRoot.parent !== targetAnchorObject) {
        entry.fxRoot.removeFromParent();
        targetAnchorObject.add(entry.fxRoot);
      }
      if (applicationMode === "explosion") {
        if (entry.stage === 1) {
          setSkillRBurnStage(entry, 1, now);
        } else {
          entry.appliedAt = now;
          entry.endsAt = Math.max(entry.endsAt, now + 1200);
        }
        return;
      }
    } else {
      entry = createSkillRBurnEntry({
        targetId,
        targetObject,
        isTargetActive,
        dealDamageToTarget,
        now,
      });
      targetAnchorObject.add(entry.fxRoot);
      setSkillRBurnStage(entry, 1, now);
      activeSkillRBurns.set(targetId, entry);
      createdEntry = true;
      if (applicationMode === "explosion") {
        return;
      }
    }

    let remainingStacks = resolvedStackCount - (createdEntry ? 1 : 0);
    if (remainingStacks <= 0) return;

    while (remainingStacks > 0) {
      if (entry.stage === 1) {
        setSkillRBurnStage(entry, 2, now);
        remainingStacks -= 1;
        continue;
      }
      if (applicationMode === "directSafe") {
        setSkillRBurnStage(entry, 2, now);
        break;
      }
      triggerSecondaryBurnSkillRBurnExplosion(entry, now);
      break;
    }
  };

  const launchSecondaryBurnSkillRProjectile = (now: number) => {
    if (!fireProjectile) return false;

    const visual = acquireSkillRProjectileVisual();
    visual.launchedAt = now;
    visual.root.visible = true;
    const projectileInitialDirection = new THREE.Vector3();
    const projectileTrackDirection = new THREE.Vector3();
    const currentDirection = new THREE.Vector3();
    const launchAt = now;

    if (boundWeapon) {
      syncSecondaryBurnAnchors(now, { force: true });
      if (!getWeaponFxTipSamplePosition(skillRProjectileOrigin)) {
        boundWeapon.updateMatrixWorld(true);
        boundWeapon.getWorldPosition(skillRProjectileOrigin);
      }
    } else {
      avatar.updateMatrixWorld(true);
      avatar.getWorldPosition(skillRProjectileOrigin);
      skillRProjectileOrigin.y += 1.4;
    }

    if (skillRDirection.lengthSq() < 0.000001) {
      getAttackDirection(skillRDirection);
    }
    projectileInitialDirection.copy(skillRDirection);
    if (projectileInitialDirection.lengthSq() < 0.000001) {
      getProjectileAimDirection(projectileInitialDirection);
    } else {
      projectileInitialDirection.normalize();
    }
    getProjectileAimDirection(projectileTrackDirection);

    skillRProjectileOrigin.addScaledVector(projectileInitialDirection, 0.18);
    visual.root.position.copy(skillRProjectileOrigin);
    updateSkillRProjectileVisual(visual, now, projectileInitialDirection);

    fireProjectile({
      projectileType: "abilityOrb",
      mesh: visual.root,
      origin: skillRProjectileOrigin.clone(),
      direction: projectileInitialDirection.clone(),
      speed: secondaryBurnSkillRProjectileSpeed,
      lifetime: secondaryBurnSkillRProjectileLifetimeSec,
      gravity: 0,
      radius: secondaryBurnSkillRProjectileRadius,
      targetHitRadius: secondaryBurnSkillRProjectileTargetHitRadius,
      damage: secondaryBurnSkillRProjectileDamage,
      energyGainOnHit: 8,
      splitOnImpact: false,
      explodeOnTargetHit: false,
      explodeOnWorldHit: false,
      explodeOnExpire: false,
      removeOnTargetHit: true,
      removeOnWorldHit: true,
      lifecycle: {
        onTargetHit: ({
          now: hitNow,
          targetId,
          targetObject,
          isTargetActive,
          dealDamageToTarget,
        }) => {
          applySecondaryBurnSkillRBurn({
            targetId,
            targetObject,
            isTargetActive,
            dealDamageToTarget,
            now: hitNow,
          });
        },
        applyForces: ({ velocity, delta }) => {
          const frameNow = performance.now();
          currentDirection.copy(velocity);
          if (currentDirection.lengthSq() < 0.000001) {
            currentDirection.copy(projectileInitialDirection);
          } else {
            currentDirection.normalize();
          }

          getProjectileAimDirection(projectileTrackDirection);
          const alignBase = THREE.MathUtils.clamp(
            (frameNow - launchAt) / secondaryBurnSkillRProjectileTrackAlignMs,
            0,
            1
          );
          const alignProgress = 1 - Math.pow(1 - alignBase, 4);
          const steer = THREE.MathUtils.clamp(
            (1 - Math.exp(-secondaryBurnSkillRProjectileTrackTurnRate * delta)) *
              (0.35 + alignProgress * 0.95),
            0,
            1
          );
          currentDirection
            .lerp(projectileTrackDirection, steer)
            .normalize();
          velocity.copy(currentDirection).multiplyScalar(
            secondaryBurnSkillRProjectileSpeed
          );
          updateSkillRProjectileVisual(visual, frameNow, velocity);
        },
        onRemove: () => {
          resetSkillRProjectileVisual(visual);
        },
      },
    });

    return true;
  };

  const updateSecondaryBurnSkillRBurns = (now: number) => {
    if (!activeSkillRBurns.size) return;

    const expiredTargetIds: string[] = [];

    activeSkillRBurns.forEach((entry, targetId) => {
      if (!entry.isTargetActive() || !entry.targetObject.parent) {
        expiredTargetIds.push(targetId);
        return;
      }

      while (
        entry.nextTickAt <= entry.endsAt + 0.001 &&
        now + 0.001 >= entry.nextTickAt
      ) {
        entry.dealDamageToTarget(
          entry.stage === 2
            ? secondaryBurnSkillRBurnLayer2TickDamage
            : secondaryBurnSkillRBurnLayer1TickDamage,
          entry.nextTickAt
        );
        grantEnergyFromBurnDamage();
        entry.nextTickAt += secondaryBurnSkillRBurnTickIntervalMs;
      }

      if (now >= entry.endsAt) {
        expiredTargetIds.push(targetId);
        return;
      }

      const targetAnchorObject = resolveSkillRBurnAnchorObject(entry.targetObject);
      if (entry.fxRoot.parent !== targetAnchorObject) {
        entry.fxRoot.removeFromParent();
        targetAnchorObject.add(entry.fxRoot);
      }
      const hasRenderableBounds = resolveSkillRBurnBounds({
        targetObject: entry.targetObject,
        bounds: skillRBurnBounds,
        meshBounds: skillRBurnMeshBounds,
      });
      if (!hasRenderableBounds || skillRBurnBounds.isEmpty()) {
        skillRBurnTargetSize.set(1, 1.8, 1);
        const anchorLift = THREE.MathUtils.clamp(
          skillRBurnTargetSize.y * secondaryBurnSkillRBurnAnchorLiftRatio,
          secondaryBurnSkillRBurnAnchorLiftMin,
          secondaryBurnSkillRBurnAnchorLiftMax
        );
        skillRBurnTargetLocalCenter.set(
          0,
          skillRBurnTargetSize.y + anchorLift,
          0
        );
      } else {
        skillRBurnBounds.getCenter(skillRBurnTargetWorldCenter);
        skillRBurnBounds.getSize(skillRBurnTargetSize);
        const anchorLift = THREE.MathUtils.clamp(
          skillRBurnTargetSize.y * secondaryBurnSkillRBurnAnchorLiftRatio,
          secondaryBurnSkillRBurnAnchorLiftMin,
          secondaryBurnSkillRBurnAnchorLiftMax
        );
        skillRBurnTargetWorldCenter.y =
          skillRBurnBounds.max.y + anchorLift;
        skillRBurnTargetLocalCenter.copy(skillRBurnTargetWorldCenter);
        targetAnchorObject.worldToLocal(skillRBurnTargetLocalCenter);
      }

      const bodyHeight = Math.max(0.9, Math.min(3.2, skillRBurnTargetSize.y));
      const bodyRadius = Math.max(
        0.22,
        Math.min(1.2, Math.max(skillRBurnTargetSize.x, skillRBurnTargetSize.z) * 0.42)
      );
      const fadeIn = THREE.MathUtils.clamp((now - entry.appliedAt) / 220, 0, 1);
      const fadeOut = THREE.MathUtils.clamp((entry.endsAt - now) / 280, 0, 1);
      const visibility = Math.min(fadeIn, fadeOut);
      entry.fxRoot.visible = visibility > 0.001;
      entry.fxRoot.position.copy(skillRBurnTargetLocalCenter);

      if (visibility <= 0.001) {
        entry.glowMaterial.opacity = 0;
        entry.outerMaterial.opacity = 0;
        entry.innerMaterial.opacity = 0;
        entry.headGlowMaterial.opacity = 0;
        entry.headOuterMaterial.opacity = 0;
        entry.headInnerMaterial.opacity = 0;
        for (let i = 0; i < entry.tongues.length; i += 1) {
          entry.tongues[i].material.opacity = 0;
        }
        for (let i = 0; i < entry.embers.length; i += 1) {
          entry.embers[i].mesh.visible = false;
          entry.embers[i].material.opacity = 0;
        }
        for (let i = 0; i < entry.sparks.length; i += 1) {
          entry.sparks[i].mesh.visible = false;
          entry.sparks[i].material.opacity = 0;
        }
        for (let i = 0; i < entry.headSparks.length; i += 1) {
          entry.headSparks[i].mesh.visible = false;
          entry.headSparks[i].material.opacity = 0;
        }
        return;
      }

      const stageBoost = entry.stage === 2 ? 1 : 0;
      const stagePulseSpeed =
        1 + stageBoost * (secondaryBurnSkillRBurnStage2PulseSpeedMultiplier - 1);
      const stageFerocity =
        1 + stageBoost * (secondaryBurnSkillRBurnStage2FerocityMultiplier - 1);
      const t = now * 0.001;
      const blaze =
        1 +
        Math.sin(t * 10.8 * stagePulseSpeed) * (0.1 + stageBoost * 0.09) +
        Math.cos(t * 6.2 * stagePulseSpeed) * (0.06 + stageBoost * 0.05);
      const lick =
        1 +
        Math.sin(t * 17.6 * stagePulseSpeed) * (0.12 + stageBoost * 0.1) +
        Math.cos(t * 12.3 * stagePulseSpeed) * (0.04 + stageBoost * 0.06);
      const headVisibility = 0;
      const bodyScaleBoost = 1 + stageBoost * 0.42;
      const headHeight = bodyHeight * 0.84;

      entry.glow.position.set(0, bodyHeight * 0.14, 0);
      entry.glow.scale.set(
        bodyRadius * bodyScaleBoost * (1.8 + blaze * 0.22),
        bodyHeight * (0.42 + lick * 0.04),
        bodyRadius * bodyScaleBoost * (1.8 + blaze * 0.22)
      );
      entry.glowMaterial.opacity = Math.min(
        1,
        visibility * stageFerocity * (0.18 + blaze * 0.08 + stageBoost * 0.14)
      );

      entry.outerFlame.position.set(0, bodyHeight * 0.14, 0);
      entry.outerFlame.scale.set(
        bodyRadius * bodyScaleBoost * (1.9 + blaze * 0.12),
        bodyHeight * (0.7 + lick * 0.08 + stageBoost * 0.18),
        bodyRadius * bodyScaleBoost * (1.9 + blaze * 0.12)
      );
      entry.outerFlame.rotation.x =
        Math.sin(t * 4.8 * stagePulseSpeed) * (0.12 + stageBoost * 0.07);
      entry.outerFlame.rotation.z =
        Math.cos(t * 5.6 * stagePulseSpeed) * (0.16 + stageBoost * 0.08);
      entry.outerMaterial.opacity = Math.min(
        1,
        visibility * stageFerocity * (0.46 + blaze * 0.14 + stageBoost * 0.24)
      );

      entry.innerFlame.position.set(0, bodyHeight * 0.2, 0);
      entry.innerFlame.scale.set(
        bodyRadius * bodyScaleBoost * (1.08 + blaze * 0.1),
        bodyHeight * (0.48 + lick * 0.06 + stageBoost * 0.16),
        bodyRadius * bodyScaleBoost * (1.08 + blaze * 0.1)
      );
      entry.innerFlame.rotation.x =
        Math.cos(t * 7.2 * stagePulseSpeed) * (0.1 + stageBoost * 0.06);
      entry.innerFlame.rotation.z =
        Math.sin(t * 8.1 * stagePulseSpeed) * (0.14 + stageBoost * 0.07);
      entry.innerMaterial.opacity = Math.min(
        1,
        visibility * stageFerocity * (0.68 + blaze * 0.18 + stageBoost * 0.26)
      );

      entry.headGlow.position.set(0, headHeight, 0);
      entry.headGlow.scale.set(
        bodyRadius * (1.4 + blaze * 0.22 + stageBoost * 0.7),
        bodyRadius * (0.8 + lick * 0.14 + stageBoost * 0.26),
        bodyRadius * (1.4 + blaze * 0.22 + stageBoost * 0.7)
      );
      entry.headGlowMaterial.opacity = headVisibility * (0.22 + blaze * 0.16);

      entry.headOuterFlame.position.set(0, headHeight + bodyRadius * 0.08, 0);
      entry.headOuterFlame.scale.set(
        bodyRadius * (0.9 + blaze * 0.14 + stageBoost * 0.42),
        bodyHeight * (0.3 + lick * 0.08 + stageBoost * 0.26),
        bodyRadius * (0.9 + blaze * 0.14 + stageBoost * 0.42)
      );
      entry.headOuterFlame.rotation.x = Math.sin(t * 6.1) * 0.14;
      entry.headOuterFlame.rotation.z = Math.cos(t * 7.3) * 0.18;
      entry.headOuterMaterial.opacity = headVisibility * (0.46 + blaze * 0.22);

      entry.headInnerFlame.position.set(0, headHeight + bodyRadius * 0.1, 0);
      entry.headInnerFlame.scale.set(
        bodyRadius * (0.52 + blaze * 0.1 + stageBoost * 0.28),
        bodyHeight * (0.22 + lick * 0.05 + stageBoost * 0.2),
        bodyRadius * (0.52 + blaze * 0.1 + stageBoost * 0.28)
      );
      entry.headInnerFlame.rotation.x = Math.cos(t * 8.2) * 0.12;
      entry.headInnerFlame.rotation.z = Math.sin(t * 9.4) * 0.16;
      entry.headInnerMaterial.opacity = headVisibility * (0.66 + blaze * 0.24);

      for (let i = 0; i < entry.tongues.length; i += 1) {
        const tongue = entry.tongues[i];
        const spin = t * tongue.orbitSpeed * stagePulseSpeed + tongue.phase;
        tongue.mesh.position.set(
          Math.cos(spin) * bodyRadius * tongue.orbitRadius,
          bodyHeight * (0.18 + (i % 3) * 0.08 + stageBoost * 0.04),
          Math.sin(spin) * bodyRadius * tongue.orbitRadius
        );
        tongue.mesh.rotation.set(
          Math.sin(spin) * tongue.tilt,
          spin,
          Math.cos(spin * 1.3) * tongue.tilt
        );
        tongue.mesh.scale.copy(tongue.baseScale).multiplyScalar(
          bodyRadius * bodyScaleBoost * (0.52 + blaze * 0.08 + stageBoost * 0.08)
        );
        tongue.material.opacity = Math.min(
          1,
          visibility * stageFerocity * (0.36 + lick * 0.14 + stageBoost * 0.2)
        );
      }

      for (let i = 0; i < entry.embers.length; i += 1) {
        const ember = entry.embers[i];
        const spin = t * ember.speed * stagePulseSpeed + ember.phase;
        const risePhase = THREE.MathUtils.euclideanModulo(spin * 0.32, 1);
        ember.mesh.visible = true;
        skillRBurnParticlePosition.set(
          Math.cos(spin) * bodyRadius * ember.radius,
          risePhase * bodyHeight * ember.lift * (1 + stageBoost * 0.24),
          Math.sin(spin) * bodyRadius * ember.radius
        );
        ember.mesh.position.copy(skillRBurnParticlePosition);
        ember.mesh.scale.setScalar(
          ember.scale * (bodyRadius * 0.56 + blaze * 0.08 + stageBoost * 0.08)
        );
        ember.material.opacity = Math.min(
          1,
          visibility *
            stageFerocity *
            (1 - risePhase * 0.78) *
            (0.28 + blaze * 0.18 + stageBoost * 0.16)
        );
      }

      for (let i = 0; i < entry.sparks.length; i += 1) {
        const spark = entry.sparks[i];
        const spin = t * spark.orbitSpeed * stagePulseSpeed + spark.phase;
        const risePhase = THREE.MathUtils.euclideanModulo(spin * 0.42, 1);
        spark.mesh.visible = true;
        spark.mesh.position.set(
          Math.cos(spin) * bodyRadius * spark.orbitRadius,
          bodyHeight * (0.08 + risePhase * spark.lift * (1 + stageBoost * 0.22)),
          Math.sin(spin) * bodyRadius * spark.orbitRadius
        );
        spark.mesh.rotation.set(spin * 1.2, spin * 0.8, spin * 1.5);
        spark.mesh.scale.setScalar(
          spark.scale * (bodyRadius * 0.6 + lick * 0.08 + stageBoost * 0.08)
        );
        spark.material.opacity = Math.min(
          1,
          visibility *
            stageFerocity *
            (1 - risePhase * 0.66) *
            (0.24 + blaze * 0.2 + stageBoost * 0.18)
        );
      }

      for (let i = 0; i < entry.headSparks.length; i += 1) {
        const spark = entry.headSparks[i];
        const spin = t * spark.orbitSpeed + spark.phase;
        const risePhase = THREE.MathUtils.euclideanModulo(spin * 0.34, 1);
        spark.mesh.visible = headVisibility > 0.001;
        spark.mesh.position.set(
          Math.cos(spin) * bodyRadius * spark.orbitRadius * (0.8 + stageBoost * 0.24),
          headHeight + risePhase * (0.24 + spark.lift * 0.2),
          Math.sin(spin) * bodyRadius * spark.orbitRadius * (0.8 + stageBoost * 0.24)
        );
        spark.mesh.rotation.set(spin * 1.4, spin, spin * 1.8);
        spark.mesh.scale.setScalar(spark.scale * (bodyRadius * 0.7 + lick * 0.1));
        spark.material.opacity =
          headVisibility * (1 - risePhase * 0.58) * (0.34 + blaze * 0.28);
      }
    });

    for (let i = 0; i < expiredTargetIds.length; i += 1) {
      clearSkillRBurn(expiredTargetIds[i]);
    }
  };

  const updateSecondaryBurnSkillRBurnExplosionFx = (now: number) => {
    for (let i = activeSkillRBurnExplosions.length - 1; i >= 0; i -= 1) {
      const entry = activeSkillRBurnExplosions[i];
      const progress = THREE.MathUtils.clamp(
        (now - entry.startedAt) /
          Math.max(1, entry.endsAt - entry.startedAt),
        0,
        1
      );
      if (progress >= 1) {
        clearSkillRBurnExplosionFx(i);
        continue;
      }

      const t = now * 0.001;
      const burst = Math.sin(progress * Math.PI);
      const fade = 1 - progress;

      entry.glow.scale.setScalar(1.6 + burst * 4.4);
      entry.glow.scale.y = 0.9 + burst * 2.6;
      entry.glowMaterial.opacity = fade * (0.34 + burst * 0.4);

      entry.core.scale.setScalar(0.8 + burst * 2.1);
      entry.coreMaterial.opacity = fade * (0.58 + burst * 0.28);

      entry.light.intensity = fade * (2.4 + burst * 3.8);
      entry.light.distance = 2.6 + burst * 5.2;

      for (let j = 0; j < entry.flames.length; j += 1) {
        const flame = entry.flames[j];
        const spin = t * flame.orbitSpeed + flame.phase;
        flame.mesh.position.set(
          Math.cos(spin) * flame.orbitRadius * burst,
          0.18 + burst * (0.36 + (j % 3) * 0.08),
          Math.sin(spin) * flame.orbitRadius * burst
        );
        flame.mesh.rotation.set(
          Math.sin(spin) * flame.tilt,
          spin,
          Math.cos(spin) * flame.tilt
        );
        flame.mesh.scale.copy(flame.baseScale).multiplyScalar(0.52 + burst * 1.06);
        flame.material.opacity = fade * (0.42 + burst * 0.3);
      }

      for (let j = 0; j < entry.embers.length; j += 1) {
        const ember = entry.embers[j];
        const spin = t * ember.speed + ember.phase;
        const risePhase = THREE.MathUtils.euclideanModulo(progress * 1.6 + j * 0.018, 1);
        ember.mesh.visible = true;
        ember.mesh.position.set(
          Math.cos(spin) * ember.radius * burst * (1.1 + risePhase * 0.6),
          risePhase * ember.lift * (1.2 + burst * 0.8),
          Math.sin(spin) * ember.radius * burst * (1.1 + risePhase * 0.6)
        );
        ember.mesh.scale.setScalar(ember.scale * (0.42 + burst * 0.72));
        ember.material.opacity = fade * (1 - risePhase * 0.72) * (0.28 + burst * 0.38);
      }

      for (let j = 0; j < entry.sparks.length; j += 1) {
        const spark = entry.sparks[j];
        const spin = t * spark.orbitSpeed + spark.phase;
        const risePhase = THREE.MathUtils.euclideanModulo(progress * 1.9 + j * 0.024, 1);
        spark.mesh.visible = true;
        spark.mesh.position.set(
          Math.cos(spin) * spark.orbitRadius * burst * (1 + risePhase * 0.8),
          0.08 + risePhase * spark.lift * (1.4 + burst),
          Math.sin(spin) * spark.orbitRadius * burst * (1 + risePhase * 0.8)
        );
        spark.mesh.rotation.set(spin * 1.5, spin, spin * 2);
        spark.mesh.scale.setScalar(spark.scale * (0.5 + burst * 0.9));
        spark.material.opacity = fade * (1 - risePhase * 0.64) * (0.28 + burst * 0.42);
      }
    }
  };

  const resolveSuperBurnSkillRFanOrigin = (target: THREE.Vector3) => {
    if (
      !getWeaponSweepSamplePositionFromLocal(
        secondaryBurnAnchorLocal,
        target
      )
    ) {
      avatar.updateMatrixWorld(true);
      avatar.getWorldPosition(target);
      target.y += 1.3;
    }
    return target;
  };

  const resetSuperBurnSkillRFanFx = () => {
    superBurnSkillRFanFxRoot.visible = false;
    superBurnSkillRFanFxRoot.removeFromParent();
    superBurnSkillRFanFxRoot.position.set(0, 0, 0);
    superBurnSkillRFanFxRoot.rotation.set(0, 0, 0);
    superBurnSkillRFanFxRoot.scale.setScalar(1);
    superBurnSkillRFanFillMaterial.opacity = 0;
    superBurnSkillRFanEdgeMaterial.opacity = 0;
    superBurnSkillRFanGlowMaterial.opacity = 0;
    superBurnSkillRFanLight.intensity = 0;
    superBurnSkillRFanLight.distance = 0;
    superBurnSkillRFanSourceMaterial.opacity = 0;
    superBurnSkillRFanSource.position.set(0, superBurnSkillRFanFxLift + 0.08, 0.16);
    superBurnSkillRFanSource.rotation.set(-Math.PI * 0.5, 0, 0);
    superBurnSkillRFanSource.scale.set(1.05, 2.4, 1.05);
    for (let i = 0; i < superBurnSkillRFanFlames.length; i += 1) {
      const flame = superBurnSkillRFanFlames[i];
      flame.mesh.position.set(0, 0, 0);
      flame.mesh.rotation.set(0, 0, 0);
      flame.mesh.quaternion.identity();
      flame.mesh.scale.setScalar(1);
      flame.material.opacity = 0;
    }
    for (let i = 0; i < superBurnSkillRFanSparks.length; i += 1) {
      const spark = superBurnSkillRFanSparks[i];
      spark.mesh.visible = false;
      spark.mesh.position.set(0, 0, 0);
      spark.mesh.rotation.set(0, 0, 0);
      spark.mesh.scale.setScalar(1);
      spark.material.opacity = 0;
    }
  };

  const updateSuperBurnSkillRFanFx = (now: number) => {
    const superFanActive = skillRState.active && skillRState.superFanMode;
    if (!superFanActive) {
      if (superBurnSkillRFanFxRoot.visible) {
        resetSuperBurnSkillRFanFx();
      }
      return;
    }

    const progress = THREE.MathUtils.clamp(
      (now - skillRState.startedAt) / skillRState.durationMs,
      0,
      1
    );
    const fadeIn = THREE.MathUtils.smoothstep(
      progress,
      Math.max(0, superBurnSkillRFanHitStart - 0.06),
      superBurnSkillRFanHitStart + 0.05
    );
    const fadeOut =
      1 -
      THREE.MathUtils.smoothstep(
        progress,
        Math.max(superBurnSkillRFanHitStart, superBurnSkillRFanHitEnd - 0.08),
        superBurnSkillRFanHitEnd + 0.03
      );
    const visibility = fadeIn * fadeOut;
    if (visibility <= 0.001) {
      if (superBurnSkillRFanFxRoot.visible) {
        superBurnSkillRFanFxRoot.visible = false;
        superBurnSkillRFanLight.intensity = 0;
      }
      return;
    }

    const worldRoot = avatar.parent ?? avatar;
    if (superBurnSkillRFanFxRoot.parent !== worldRoot) {
      superBurnSkillRFanFxRoot.removeFromParent();
      worldRoot.add(superBurnSkillRFanFxRoot);
    }
    superBurnSkillRFanFxRoot.visible = true;
    superBurnSkillRFanFxRoot.traverse((child) => {
      child.layers.mask = avatar.layers.mask;
    });

    resolveSuperBurnSkillRFanOrigin(superBurnSkillRFanOrigin);
    getAttackDirection(superBurnSkillRFanDirection);
    superBurnSkillRFanFxRoot.position.copy(superBurnSkillRFanOrigin);
    superBurnSkillRFanFxRoot.rotation.set(
      0,
      Math.atan2(superBurnSkillRFanDirection.x, superBurnSkillRFanDirection.z),
      0
    );

    const t = now * 0.001;
    const pulse =
      1 +
      Math.sin(t * 8.4 + progress * Math.PI * 2) * 0.11 +
      Math.cos(t * 4.1) * 0.05;
    const fanRange = superBurnSkillRFanRange;

    superBurnSkillRFanFill.scale.setScalar(fanRange * (0.98 + pulse * 0.04));
    superBurnSkillRFanEdge.scale.setScalar(fanRange * (1 + pulse * 0.07));
    superBurnSkillRFanGlow.scale.set(
      fanRange * (0.68 + pulse * 0.08),
      0.48 + pulse * 0.06,
      fanRange * (0.68 + pulse * 0.08)
    );
    // Keep the wedge subtle so the flame particles define the fan shape.
    superBurnSkillRFanFillMaterial.opacity = visibility * (0.035 + pulse * 0.018);
    superBurnSkillRFanEdgeMaterial.opacity = visibility * (0.11 + pulse * 0.04);
    superBurnSkillRFanGlowMaterial.opacity = visibility * (0.12 + pulse * 0.06);
    superBurnSkillRFanLight.intensity = visibility * (2.1 + pulse * 1.3);
    superBurnSkillRFanLight.distance = fanRange * (1.65 + pulse * 0.24);
    superBurnSkillRFanSource.position.set(
      0,
      superBurnSkillRFanFxLift + 0.08,
      0.14 + pulse * 0.1
    );
    superBurnSkillRFanSource.scale.set(
      1 + pulse * 0.3,
      2.5 + pulse * 0.9,
      1 + pulse * 0.3
    );
    superBurnSkillRFanSourceMaterial.opacity = visibility * (0.64 + pulse * 0.18);

    for (let i = 0; i < superBurnSkillRFanFlames.length; i += 1) {
      const flame = superBurnSkillRFanFlames[i];
      const spin = t * flame.speed + flame.phase;
      const travel = THREE.MathUtils.euclideanModulo(
        t * (0.42 + flame.speed * 0.09) + flame.phase * 0.72,
        1
      );
      const lick = 0.8 + Math.sin(spin * 1.8) * 0.24 + Math.cos(spin * 0.92) * 0.1;
      const yaw = flame.yawOffset + Math.sin(spin * 0.58) * 0.07;
      const radial =
        fanRange *
        (0.08 + travel * (0.78 + flame.distanceRatio * 0.2)) *
        (0.9 + lick * 0.12);
      flame.mesh.position.set(
        Math.sin(yaw) * radial,
        superBurnSkillRFanFxLift +
          0.08 +
          travel * (0.2 + flame.lift * 0.2) +
          lick * flame.lift * 0.18,
        Math.cos(yaw) * radial
      );
      superBurnSkillRFanFlowDirection.set(
        Math.sin(yaw),
        0.12 + flame.lift * 0.28 + travel * 0.12,
        Math.cos(yaw)
      );
      superBurnSkillRFanFlowDirection.normalize();
      flame.mesh.quaternion.setFromUnitVectors(
        avatarUp,
        superBurnSkillRFanFlowDirection
      );
      const flameWidth =
        (0.44 + lick * 0.34 + travel * 0.12) * flame.scale * 1.16;
      const flameLength =
        (1.34 + lick * 0.54 + travel * 0.88) * flame.scale * 1.5;
      flame.mesh.scale.set(flameWidth, flameLength, flameWidth);
      flame.material.opacity =
        visibility *
        (1 - travel * 0.22) *
        (0.62 + lick * 0.28);
    }

    for (let i = 0; i < superBurnSkillRFanSparks.length; i += 1) {
      const spark = superBurnSkillRFanSparks[i];
      const spin = t * spark.speed + spark.phase;
      const travel = THREE.MathUtils.euclideanModulo(
        t * (0.58 + spark.speed * 0.07) + spark.phase * 0.94,
        1
      );
      const yaw = spark.yawOffset + Math.sin(spin * 0.54) * 0.08;
      const radial =
        fanRange *
        (0.04 + travel * (0.84 + spark.distanceRatio * 0.22));
      spark.mesh.visible = true;
      spark.mesh.position.set(
        Math.sin(yaw) * radial,
        superBurnSkillRFanFxLift +
          0.1 +
          travel * (0.28 + spark.lift * 0.22),
        Math.cos(yaw) * radial
      );
      spark.mesh.rotation.set(spin * 1.2, spin * 0.94, spin * 1.6);
      spark.mesh.scale.setScalar((0.64 + travel * 0.88) * spark.scale);
      spark.material.opacity =
        visibility * (1 - travel * 0.66) * (0.52 + travel * 0.2);
    }
  };

  const applySuperBurnSkillRFlameTick = (now: number) => {
    if (!performMeleeAttack) return;

    resolveSuperBurnSkillRFanOrigin(skillRProjectileOrigin);

    const fanDirection = getAttackDirection(skillRDirection);
    const hitTargetIds = new Set<string>();

    for (let i = 0; i < superBurnSkillRFanRayCount; i += 1) {
      const t =
        superBurnSkillRFanRayCount <= 1
          ? 0.5
          : i / (superBurnSkillRFanRayCount - 1);
      const yawOffset = THREE.MathUtils.lerp(
        -superBurnSkillRFanHalfAngleRad,
        superBurnSkillRFanHalfAngleRad,
        t
      );
      skillRProjectileVelocityDirection
        .copy(fanDirection)
        .applyAxisAngle(avatarUp, yawOffset)
        .normalize();
      performMeleeAttack({
        damage: superBurnSkillRFanTickDamage,
        maxDistance: superBurnSkillRFanRange,
        hitRadius: superBurnSkillRFanRayHitRadius,
        maxHits: superBurnSkillRFanRayMaxHits,
        origin: skillRProjectileOrigin.clone(),
        direction: skillRProjectileVelocityDirection.clone(),
        excludeTargetIds: hitTargetIds,
        onHitTarget: (targetId) => {
          hitTargetIds.add(targetId);
        },
        onHitTargetResolved: ({
          targetId,
          targetObject,
          isTargetActive,
          dealDamageToTarget,
          now: hitNow,
        }) => {
          applySecondaryBurnSkillRBurn({
            targetId,
            targetObject,
            isTargetActive,
            dealDamageToTarget,
            now: hitNow,
            applicationMode: "direct",
            stackCount: 2,
          });
        },
      });
    }
  };

  const startSkillR = (now: number) => {
    const useSuperFanMode = superBurnState.active;
    const binding = useSuperFanMode
      ? skillQERSkillBinding ?? skillRBinding
      : skillRBinding;
    if (!binding) return false;
    stopAllSkillActions();
    resetSkillRState();
    skillRState.active = true;
    skillRState.startedAt = now;
    skillRState.durationMs = Math.max(1, binding.clip.duration * 1000);
    skillRState.activeBinding = binding;
    skillRState.superFanMode = useSuperFanMode;
    skillRState.nextFanTickAt = useSuperFanMode
      ? now + skillRState.durationMs * superBurnSkillRFanHitStart
      : 0;
    skillRState.projectileMode =
      !useSuperFanMode && secondaryBurnState.active && Boolean(fireProjectile);
    skillRState.projectileFired = false;
    getAttackDirection(skillRDirection);
    avatar.rotation.y = Math.atan2(skillRDirection.x, skillRDirection.z);
    return playActionBinding(binding);
  };

  const finishSkillR = () => {
    stopActionBinding(skillRBinding);
    stopActionBinding(skillQERSkillBinding);
    resetSkillRState();
  };

  const updateSkillQState = (now: number) => {
    if (!skillQState.active) return;

    const progress = THREE.MathUtils.clamp(
      (now - skillQState.startedAt) / skillQState.durationMs,
      0,
      1
    );

    if (progress >= 0.999) {
      finishSkillQ();
    }
  };

  const updateSkillQEState = (now: number) => {
    if (!skillQEState.active) return;
    const progress = THREE.MathUtils.clamp(
      (now - skillQEState.startedAt) / skillQEState.durationMs,
      0,
      1
    );
    if (!skillQEState.ignited) {
      let shouldIgnite =
        progress >= skillQEIgniteFallbackProgress;
      if (progress >= skillQEIgniteMinProgress) {
        const hasWeaponSample = getWeaponSweepSamplePosition(currentWeaponWorldPosition);
        if (hasWeaponSample) {
          const headAnchor = getBurningModeHeadFxAnchor();
          headAnchor.updateMatrixWorld(true);
          headAnchor.getWorldPosition(burningModePreludeWorldTarget);
          const weaponToHeadDistance =
            currentWeaponWorldPosition.distanceTo(burningModePreludeWorldTarget);
          shouldIgnite = shouldIgnite || weaponToHeadDistance <= skillQEIgniteMaxDistance;
        }
      }
      if (shouldIgnite) {
        igniteSkillQE(now);
      }
    }
    if (progress >= 0.999) {
      if (!skillQEState.ignited) {
        igniteSkillQE(now);
      }
      finishSkillQE();
    }
  };

  const updateSuperBurnState = (now: number) => {
    if (!superBurnState.active) return;
    if (
      !burningModeState.active ||
      (!secondaryBurnState.active && !secondaryBurnState.fadingOut) ||
      now >= superBurnState.endsAt
    ) {
      deactivateSuperBurn();
    }
  };

  const updatePrimaryHoldState = (now: number) => {
    if (
      !primaryHoldState.pressing ||
      primaryHoldState.active ||
      attackState.active ||
      skillQState.active ||
      skillQEState.active ||
      skillEState.active ||
      skillRState.active
    ) {
      return;
    }
    if (now - primaryHoldState.pressedAt < primaryHoldActivationMs) return;
    startPrimaryHold(now);
  };

  const updateAttackState = (now: number) => {
    if (!attackState.active) return;

    const activeBindings = getAttackBindingsByVariant(attackState.comboVariant);
    const binding = activeBindings[attackState.currentIndex];
    if (!binding) {
      finishAttack(now);
      return;
    }

    const progress = THREE.MathUtils.clamp(
      (now - attackState.startedAt) / attackState.durationMs,
      0,
      1
    );

    if (progress >= binding.config.hitStart && progress <= binding.config.hitEnd) {
      if (!attackState.hasWeaponSample) {
        sampleWeaponPosition(attackState);
      }
      const shouldApplyHit =
        attackState.comboVariant !== "super" ||
        now + 0.001 >= attackState.nextHitAt;
      if (shouldApplyHit) {
        applyWeaponSweepHit(
          binding.config,
          attackState.hitTargetIds,
          undefined,
          now,
          true
        );
        if (attackState.comboVariant === "super") {
          attackState.nextHitAt = now + superBurnBasicAttackHitIntervalMs;
        }
      } else {
        sampleWeaponPosition(attackState);
      }
    } else {
      sampleWeaponPosition(attackState);
    }

    if (
      attackState.comboVariant === "super" &&
      attackState.currentIndex === 2 &&
      !attackState.superThirdPoolSpawned
    ) {
      const hasWeaponSample = getWeaponSweepSamplePosition(currentWeaponWorldPosition);
      if (hasWeaponSample) {
        if (!attackState.superThirdPoolHasWeaponSample) {
          attackState.superThirdPoolHasWeaponSample = true;
          attackState.superThirdPoolPeakWeaponY = currentWeaponWorldPosition.y;
          attackState.superThirdPoolPreviousWeaponY = currentWeaponWorldPosition.y;
        } else {
          const weaponY = currentWeaponWorldPosition.y;
          const deltaY = weaponY - attackState.superThirdPoolPreviousWeaponY;
          attackState.superThirdPoolPeakWeaponY = Math.max(
            attackState.superThirdPoolPeakWeaponY,
            weaponY
          );
          const dropFromPeak = attackState.superThirdPoolPeakWeaponY - weaponY;
          const downwardStrikeMoment =
            progress >= superBurnThirdAttackPoolSpawnProgress &&
            dropFromPeak >= superBurnThirdAttackPoolDropThreshold &&
            deltaY <= superBurnThirdAttackPoolDownwardDeltaThreshold;
          if (downwardStrikeMoment) {
            spawnSuperBurnThirdAttackFlamePool(now);
            attackState.superThirdPoolSpawned = true;
          }
          attackState.superThirdPoolPreviousWeaponY = weaponY;
        }
      }
      if (
        !attackState.superThirdPoolSpawned &&
        progress >= superBurnThirdAttackPoolFallbackProgress
      ) {
        // Fallback keeps gameplay reliable when weapon sampling fails on some rigs.
        spawnSuperBurnThirdAttackFlamePool(now);
        attackState.superThirdPoolSpawned = true;
      }
    }

    const comboChainTriggerProgress =
      binding.config.comboChainTriggerProgress ?? 0.999;
    if (
      attackState.queuedNext &&
      attackState.currentIndex < activeBindings.length - 1 &&
      progress >= comboChainTriggerProgress
    ) {
      startAttack(
        attackState.currentIndex + 1,
        now,
        attackState.comboVariant
      );
      return;
    }

    if (progress < 0.999) return;

    finishAttack(now);
  };

  const updateSkillEState = (now: number) => {
    if (!skillEState.active) return;

    const progress = THREE.MathUtils.clamp(
      (now - skillEState.startedAt) / skillEState.durationMs,
      0,
      1
    );

    if (boundWeapon) {
      boundWeapon.updateMatrixWorld(true);
      boundWeapon.getWorldPosition(currentWeaponWorldPosition);

      if (!skillEState.hasWeaponSample) {
        skillEState.hasWeaponSample = true;
        skillEState.initialWeaponY = currentWeaponWorldPosition.y;
        skillEState.peakWeaponY = currentWeaponWorldPosition.y;
        skillEState.lowestWeaponY = currentWeaponWorldPosition.y;
        skillEState.previousWeaponY = currentWeaponWorldPosition.y;
      } else {
        const deltaY = currentWeaponWorldPosition.y - skillEState.previousWeaponY;
        skillEState.peakWeaponY = Math.max(
          skillEState.peakWeaponY,
          currentWeaponWorldPosition.y
        );

        const liftFromStart =
          skillEState.peakWeaponY - skillEState.initialWeaponY;
        const dropFromPeak =
          skillEState.peakWeaponY - currentWeaponWorldPosition.y;

        // Ignore the starting low pose and only watch for the landing
        // after the weapon has been raised and is clearly coming back down.
        if (
          !skillEState.landingArmed &&
          liftFromStart >= secondaryBurnLandingMinTravel &&
          dropFromPeak >= secondaryBurnLandingMinTravel
        ) {
          skillEState.landingArmed = true;
          skillEState.lowestWeaponY = currentWeaponWorldPosition.y;
        }

        if (skillEState.landingArmed) {
          skillEState.lowestWeaponY = Math.min(
            skillEState.lowestWeaponY,
            currentWeaponWorldPosition.y
          );

          const totalDrop = skillEState.peakWeaponY - skillEState.lowestWeaponY;
          const recoveredFromLow =
            currentWeaponWorldPosition.y - skillEState.lowestWeaponY;
          const shouldIgnite =
            !skillEState.flameTriggered &&
            progress >= secondaryBurnLandingProgressFloor &&
            totalDrop >= secondaryBurnLandingMinTravel &&
            (deltaY >= 0.002 ||
              recoveredFromLow >= secondaryBurnLandingRecoveryDistance ||
              progress >= secondaryBurnLateTriggerProgress);

          if (shouldIgnite) {
            skillEState.flameTriggered = true;
            activateSecondaryBurn(now);
          }
        }

        skillEState.previousWeaponY = currentWeaponWorldPosition.y;
      }
    } else if (
      !skillEState.flameTriggered &&
      progress >= secondaryBurnLateTriggerProgress
    ) {
      skillEState.flameTriggered = true;
      activateSecondaryBurn(now);
    }

    if (progress < 0.999) return;

    if (!skillEState.flameTriggered) {
      activateSecondaryBurn(now);
    }
    finishSkillE();
  };

  const updateSkillRState = (now: number) => {
    if (!skillRState.active) return;

    const progress = THREE.MathUtils.clamp(
      (now - skillRState.startedAt) / skillRState.durationMs,
      0,
      1
    );

    if (skillRState.superFanMode) {
      const fanTickStartAt = skillRState.startedAt + skillRState.durationMs * superBurnSkillRFanHitStart;
      const fanTickEndAt = skillRState.startedAt + skillRState.durationMs * superBurnSkillRFanHitEnd;
      while (
        skillRState.nextFanTickAt > 0 &&
        skillRState.nextFanTickAt <= fanTickEndAt + 0.001 &&
        now + 0.001 >= skillRState.nextFanTickAt
      ) {
        if (skillRState.nextFanTickAt + 0.001 >= fanTickStartAt) {
          applySuperBurnSkillRFlameTick(skillRState.nextFanTickAt);
        }
        skillRState.nextFanTickAt += superBurnSkillRFanTickIntervalMs;
      }
    } else if (skillRState.projectileMode) {
      if (
        !skillRState.projectileFired &&
        progress >= secondaryBurnSkillRProjectileTriggerProgress
      ) {
        skillRState.projectileFired = launchSecondaryBurnSkillRProjectile(now);
      }
    } else {
      if (progress >= skillRConfig.hitStart && progress <= skillRConfig.hitEnd) {
        if (!skillRState.hasWeaponSample) {
          sampleWeaponPosition(skillRState);
        }
        applyWeaponSweepHit(
          skillRConfig,
          skillRState.hitTargetIds,
          skillRDirection,
          now
        );
      } else {
        sampleWeaponPosition(skillRState);
      }
    }

    if (progress >= 0.999) {
      finishSkillR();
    }
  };

  const updateBurningModeFx = (now: number) => {
    if (!burningModeState.active) {
      burningModePreludeAuraFxRoot.visible = false;
      burningModeHeadFxRoot.visible = false;
      burningModeHeadLight.visible = false;
      return;
    }

    if (now >= burningModeState.endsAt) {
      deactivateBurningMode();
      return;
    }

    syncBurningModeHeadFxTransform();
    syncBurningModePreludeFxLayers();
    syncBurningModeHeadFxLayers();
    const fadeIn = THREE.MathUtils.clamp(
      (now - burningModeState.activatedAt) / burningModeHeadFadeMs,
      0,
      1
    );
    const fadeOut = THREE.MathUtils.clamp(
      (burningModeState.endsAt - now) / burningModeHeadFadeMs,
      0,
      1
    );
    const visibility = Math.min(fadeIn, fadeOut);
    const preludeProgress = THREE.MathUtils.clamp(
      (now - burningModeState.activatedAt) / burningModePreludeDurationMs,
      0,
      1
    );
    const gatherBase = THREE.MathUtils.smoothstep(
      preludeProgress,
      burningModePreludeGatherStartProgress,
      burningModePreludeGatherEndProgress
    );
    const gatherProgress = 1 - Math.pow(1 - gatherBase, 2.6);
    const flameGrowthBase = THREE.MathUtils.smoothstep(
      preludeProgress,
      burningModeFlameGrowthStartProgress,
      burningModeFlameGrowthEndProgress
    );
    const flameGrowth = flameGrowthBase * flameGrowthBase;
    const preludeVisibility = visibility * (1 - flameGrowth * 0.82);
    const headVisibility = visibility * flameGrowth;
    const flameEmergence = 0.02 + flameGrowth * 0.98;
    const skillQEPreludeFade = THREE.MathUtils.clamp(
      (skillQEPreludeFadeOutEndsAt - now) / skillQEPreludeFadeOutMs,
      0,
      1
    );
    const skillQEPreludeLive = skillQEState.active && !skillQEState.ignited;
    const skillQEPreludeBlend = skillQEPreludeLive ? 1 : skillQEPreludeFade;
    const skillQEPreludeActive = skillQEPreludeBlend > 0.001;
    const skillQEProgress =
      skillQEState.durationMs > 0
        ? THREE.MathUtils.clamp(
            (now - skillQEState.startedAt) / skillQEState.durationMs,
            0,
            1
          )
        : 1;
    const skillQEGatherBase = skillQEPreludeActive
      ? THREE.MathUtils.smoothstep(
          skillQEProgress,
          skillQEPreludeGatherStartProgress,
          skillQEPreludeGatherEndProgress
        )
      : 0;
    const skillQEGather = skillQEPreludeActive
      ? Math.max(skillQEGatherBase, 1 - skillQEPreludeBlend * 0.18)
      : 0;
    const skillQEClusterRadiusScale = skillQEPreludeActive
      ? THREE.MathUtils.lerp(skillQEPreludeScatterRadiusScale, 1, skillQEGather)
      : 1;
    const effectivePreludeVisibility = skillQEPreludeActive
      ? Math.max(preludeVisibility, skillQEPreludeVisibility * skillQEPreludeBlend)
      : preludeVisibility;
    const preludeOpacityBoost = skillQEPreludeActive
      ? skillQEPreludeOpacityBoost * (0.52 + skillQEPreludeBlend * 0.48)
      : 1;
    burningModeHeadFxRoot.visible = headVisibility > 0.001;
    burningModeHeadLight.visible = headVisibility > 0.001;
    avatar.updateMatrixWorld(true);
    burningModeHeadFxAnchor.updateMatrixWorld(true);
    burningModePreludeWorldTarget.set(0, 0, 0);
    burningModeHeadFxAnchor.localToWorld(burningModePreludeWorldTarget);
    burningModePreludeAuraTargetLocal.copy(burningModePreludeWorldTarget);
    avatar.worldToLocal(burningModePreludeAuraTargetLocal);
    const suppressCameraFrontParticles =
      hasAimOriginWorld &&
      latestAimOriginWorld.distanceToSquared(burningModePreludeWorldTarget) <=
        burningModeCameraParticleSuppressDistance *
          burningModeCameraParticleSuppressDistance &&
      (attackState.active || primaryHoldState.active || skillRState.active);
    burningModePreludeAuraFxRoot.visible =
      effectivePreludeVisibility > 0.001 && !suppressCameraFrontParticles;
    const t = now * 0.001;
    const flamePulse =
      0.96 + Math.sin(t * 12.4) * 0.12 + Math.sin(t * 25.2) * 0.05;
    const flameFlicker =
      0.92 +
      Math.sin(t * 18.6) * 0.09 +
      Math.cos(t * 10.4) * 0.07 +
      Math.sin(t * 31.2) * 0.04;
    const surgePulse = 0.94 + Math.sin(t * 8.2) * 0.14 + Math.cos(t * 5.6) * 0.08;
    const coverHalfX = Math.max(0.38, burningModeHeadSurfaceSize.x * 0.5);
    const coverHalfY = Math.max(0.72, burningModeHeadSurfaceSize.y * 0.5);
    const coverHalfZ = Math.max(0.62, burningModeHeadSurfaceSize.z * 0.5);
    const infernoPulse = 1.02 + Math.sin(t * 7.8) * 0.12 + Math.cos(t * 4.4) * 0.06;
    const bodyBreath = 1 + Math.sin(t * 8.4) * 0.045 + Math.cos(t * 5.2) * 0.02;
    const coreBreath = 1 + Math.cos(t * 9.6) * 0.04 + Math.sin(t * 6.4) * 0.018;
    const coverRadiusX = (coverHalfX + 0.1) * burningModeHeadClusterRadiusScale;
    const coverRadiusZ = (coverHalfZ + 0.24) * burningModeHeadClusterRadiusScale;
    const coverHeight = Math.max(1.34, burningModeHeadSurfaceSize.y);

    for (let i = 0; i < burningModePreludeAuraSparks.length; i += 1) {
      const spark = burningModePreludeAuraSparks[i];
      if (suppressCameraFrontParticles) {
        spark.mesh.visible = false;
        spark.material.opacity = 0;
        continue;
      }
      const spin = t * (spark.speed * 0.84) + spark.phase;
      const risePhase = (t * (0.58 + i * 0.016) + spark.phase * 0.42) % 1;
      const burst = 0.68 + 0.32 * Math.sin(t * (10.8 + i * 0.18) + spark.phase);
      const ring = spark.radius * (0.92 + (i % 5) * 0.08);
      const particleGatherBase = THREE.MathUtils.clamp(
        (gatherProgress - i * 0.004) / 0.82,
        0,
        1
      );
      const particleGather = 1 - Math.pow(1 - particleGatherBase, 3.2);
      const effectiveParticleGather = skillQEPreludeActive
        ? Math.max(particleGather, skillQEGather)
        : particleGather;
      spark.mesh.visible = effectivePreludeVisibility > 0.001;
      burningModePreludeParticlePosition.set(
        Math.cos(spin) *
          ring *
          burningModePreludeClusterRadiusScale *
          skillQEClusterRadiusScale,
        0.42 + risePhase * spark.lift,
        Math.sin(spin) *
          ring *
          burningModePreludeClusterRadiusScale *
          skillQEClusterRadiusScale
      );
      burningModePreludeParticlePosition.lerp(
        burningModePreludeAuraTargetLocal,
        effectiveParticleGather
      );
      spark.mesh.position.copy(burningModePreludeParticlePosition);
      spark.mesh.rotation.set(spin * 1.2, spin * 0.9, spin * 1.7);
      spark.mesh.scale.setScalar(
        spark.scale *
          (0.9 + burst * 0.42 + flameGrowth * 0.1) *
          (1 - effectiveParticleGather * 0.28)
      );
      spark.material.opacity =
        effectivePreludeVisibility *
        (1 - risePhase * (0.7 - effectiveParticleGather * 0.36)) *
        (0.28 + burst * 0.38 + effectiveParticleGather * 0.24) *
        preludeOpacityBoost;
    }

    for (let i = 0; i < burningModePreludeAuraEmbers.length; i += 1) {
      const ember = burningModePreludeAuraEmbers[i];
      if (suppressCameraFrontParticles) {
        ember.mesh.visible = false;
        ember.material.opacity = 0;
        continue;
      }
      const orbitPhase = t * (ember.speed * 0.7) + ember.phase;
      const risePhase = (t * (0.34 + i * 0.01) + ember.phase * 0.28) % 1;
      const band = (i % 5) / 4;
      const radius = ember.radius * (0.88 + band * 0.34);
      const yBase = 0.28 + band * 0.34;
      const crackle =
        0.58 + 0.42 * Math.sin(t * (8.6 + i * 0.16) + ember.phase * 2.2);
      const particleGatherBase = THREE.MathUtils.clamp(
        (gatherProgress - i * 0.003) / 0.86,
        0,
        1
      );
      const particleGather = 1 - Math.pow(1 - particleGatherBase, 3);
      const effectiveParticleGather = skillQEPreludeActive
        ? Math.max(particleGather, skillQEGather)
        : particleGather;
      ember.mesh.visible = effectivePreludeVisibility > 0.001;
      burningModePreludeParticlePosition.set(
        Math.cos(orbitPhase) *
          radius *
          burningModePreludeClusterRadiusScale *
          skillQEClusterRadiusScale,
        yBase + risePhase * ember.lift,
        Math.sin(orbitPhase) *
          radius *
          burningModePreludeClusterRadiusScale *
          skillQEClusterRadiusScale
      );
      burningModePreludeParticlePosition.lerp(
        burningModePreludeAuraTargetLocal,
        effectiveParticleGather
      );
      ember.mesh.position.copy(burningModePreludeParticlePosition);
      ember.mesh.scale.setScalar(
        ember.scale *
          (0.78 + crackle * 0.46 + flameGrowth * 0.08) *
          (1 - effectiveParticleGather * 0.32)
      );
      ember.material.opacity =
        effectivePreludeVisibility *
        (1 - risePhase * (0.66 - effectiveParticleGather * 0.38)) *
        (0.34 + crackle * 0.42 + effectiveParticleGather * 0.22) *
        preludeOpacityBoost;
    }

    burningModeHeadShell.position.y = THREE.MathUtils.lerp(
      0,
      -coverHalfY * 0.14,
      flameGrowth
    );
    burningModeHeadShell.scale.set(
      Math.max(
        0.04,
        coverHalfX *
          (2.08 + flameFlicker * 0.36 + infernoPulse * 0.16) *
          bodyBreath *
          flameEmergence
      ),
      Math.max(
        0.08,
        coverHeight *
          (1.26 + flamePulse * 0.34 + infernoPulse * 0.2) *
          bodyBreath *
          flameEmergence
      ),
      Math.max(
        0.06,
        coverHalfZ *
          (3.18 + flameFlicker * 0.54 + infernoPulse * 0.22) *
          bodyBreath *
          flameEmergence
      )
    );
    burningModeHeadShell.rotation.set(
      Math.sin(t * 3.6) * 0.24,
      Math.cos(t * 2.4) * 0.16,
      Math.cos(t * 3.2) * 0.18
    );
    burningModeHeadCore.position.y = THREE.MathUtils.lerp(
      0,
      -coverHalfY * 0.08,
      flameGrowth
    );
    burningModeHeadCore.scale.set(
      Math.max(
        0.03,
        coverHalfX *
          (1.48 + flameFlicker * 0.26 + infernoPulse * 0.1) *
          coreBreath *
          flameEmergence
      ),
      Math.max(
        0.07,
        coverHeight *
          (1.02 + flamePulse * 0.24 + infernoPulse * 0.14) *
          coreBreath *
          flameEmergence
      ),
      Math.max(
        0.05,
        coverHalfZ *
          (2.46 + flameFlicker * 0.4 + infernoPulse * 0.14) *
          coreBreath *
          flameEmergence
      )
    );
    burningModeHeadCore.rotation.set(
      Math.cos(t * 4.1) * 0.18,
      Math.sin(t * 3.3) * 0.14,
      Math.sin(t * 4.4) * 0.14
    );
    applyBurningModeHeadRotation();
    for (let i = 0; i < burningModeHeadJets.length; i += 1) {
      const jet = burningModeHeadJets[i];
      const jetRise = (t * jet.speed + jet.phase * 0.6) % 1;
      const jetBurst =
        0.74 +
        0.26 * Math.sin(t * (10.8 + jet.burst * 2.4) + jet.phase * 2) +
        surgePulse * 0.08;
      const jetOrbit =
        jet.yaw +
        Math.sin(t * (2.6 + i * 0.04) + jet.phase) * 0.18 +
        Math.cos(t * (4.4 + i * 0.06) + jet.phase * 0.5) * 0.12;
      const jetRadiusX = coverRadiusX * jet.radius * (0.56 + jetRise * 0.12);
      const jetRadiusZ = coverRadiusZ * jet.radius * (0.56 + jetRise * 0.12);
      const jetWidth = Math.max(
        0.42,
        coverHalfX * 0.42 * jet.baseScale.x * (0.92 + jetBurst * 0.42)
      );
      const jetDepth = Math.max(
        0.92,
        coverHalfZ * 0.94 * jet.baseScale.z * (1.04 + jetBurst * 0.46)
      );
      const jetHeight = Math.max(
        1.18,
        coverHeight * 0.82 * jet.baseScale.y * (1 + jetBurst * 0.6)
      );
      const jetBaseY = -coverHalfY * 0.22 + jetRise * coverHeight * 0.9;
      const jetLean =
        jet.lean +
        Math.sin(t * (7.4 + i * 0.12) + jet.phase) * 0.12 +
        (0.5 - jetRise) * 0.18;
      const jetPulse =
        1 + Math.sin(t * (11.4 + i * 0.08) + jet.phase) * 0.06 + jetBurst * 0.02;
      jet.pivot.position.set(
        Math.cos(jetOrbit) * jetRadiusX * flameEmergence,
        jetBaseY * flameEmergence,
        Math.sin(jetOrbit) * jetRadiusZ * flameEmergence
      );
      jet.pivot.rotation.set(
        Math.cos(jetOrbit) * jetLean,
        jetOrbit + Math.sin(t * (3.6 + i * 0.08) + jet.phase) * 0.18,
        -Math.sin(jetOrbit) * jetLean
      );
      jet.pivot.scale.set(0.96 + jetPulse * 0.06, jetPulse, 0.96 + jetPulse * 0.06);
      jet.shell.scale.set(
        jetWidth * flameEmergence,
        jetHeight * flameEmergence,
        jetDepth * flameEmergence
      );
      jet.shell.rotation.x = Math.sin(t * (8.6 + i * 0.16) + jet.phase) * 0.14;
      jet.shell.rotation.z = Math.cos(t * (9.2 + i * 0.14) + jet.phase) * 0.12;
      jet.core.scale.set(
        jetWidth * 0.58 * flameEmergence,
        jetHeight * 0.78 * flameEmergence,
        jetDepth * 0.58 * flameEmergence
      );
      jet.core.rotation.x = Math.cos(t * (9.8 + i * 0.18) + jet.phase) * 0.12;
      jet.core.rotation.z = Math.sin(t * (10.4 + i * 0.16) + jet.phase) * 0.1;
      jet.shell.material.opacity =
        headVisibility * (0.54 + jetBurst * 0.34 + flameFlicker * 0.12) * (1 - jetRise * 0.28);
      jet.core.material.opacity =
        headVisibility * (0.7 + jetBurst * 0.28 + flamePulse * 0.12) * (1 - jetRise * 0.22);
      jet.shell.material.emissiveIntensity = headVisibility * (1.18 + jetBurst * 0.92);
      jet.core.material.emissiveIntensity = headVisibility * (1.54 + jetBurst * 1.04);
    }
    for (let i = 0; i < burningModeHeadTongues.length; i += 1) {
      const tongue = burningModeHeadTongues[i];
      const tongueRise = (t * tongue.speed + tongue.phase * 0.46) % 1;
      const tongueBurst =
        0.76 +
        0.24 * Math.sin(t * (12.2 + tongue.burst * 2.1) + tongue.phase * 2.2) +
        flamePulse * 0.08;
      const tongueOrbit =
        tongue.yaw +
        Math.sin(t * (4.1 + i * 0.08) + tongue.phase) * 0.22 +
        Math.cos(t * (6.6 + i * 0.06) + tongue.phase * 0.6) * 0.1;
      const tongueWidth = Math.max(
        0.26,
        coverHalfX * 0.28 * tongue.baseScale.x * (0.88 + tongueBurst * 0.32)
      );
      const tongueDepth = Math.max(
        0.28,
        coverHalfZ * 0.34 * tongue.baseScale.z * (0.9 + tongueBurst * 0.34)
      );
      const tongueHeight = Math.max(
        0.78,
        coverHeight * 0.42 * tongue.baseScale.y * (0.94 + tongueBurst * 0.38)
      );
      const tongueBaseY = -coverHalfY * 0.06 + tongueRise * coverHeight * 0.62;
      const tongueLean =
        tongue.lean +
        Math.sin(t * (8.2 + i * 0.14) + tongue.phase) * 0.14 +
        (0.5 - tongueRise) * 0.12;
      const tonguePulse =
        1 + Math.sin(t * (12.6 + i * 0.12) + tongue.phase) * 0.07 + tongueBurst * 0.018;
      tongue.pivot.position.set(
        Math.cos(tongueOrbit) *
          coverRadiusX *
          tongue.radius *
          (0.4 + tongueRise * 0.1) *
          flameEmergence,
        tongueBaseY * flameEmergence,
        Math.sin(tongueOrbit) *
          coverRadiusZ *
          tongue.radius *
          (0.4 + tongueRise * 0.1) *
          flameEmergence
      );
      tongue.pivot.rotation.set(
        Math.cos(tongueOrbit) * tongueLean,
        tongueOrbit + Math.sin(t * (5.8 + i * 0.12) + tongue.phase) * 0.2,
        -Math.sin(tongueOrbit) * tongueLean
      );
      tongue.pivot.scale.set(0.95 + tonguePulse * 0.06, tonguePulse, 0.95 + tonguePulse * 0.06);
      tongue.shell.scale.set(
        tongueWidth * flameEmergence,
        tongueHeight * flameEmergence,
        tongueDepth * flameEmergence
      );
      tongue.shell.rotation.x = Math.sin(t * (9.6 + i * 0.18) + tongue.phase) * 0.16;
      tongue.shell.rotation.z = Math.cos(t * (10.6 + i * 0.16) + tongue.phase) * 0.14;
      tongue.core.scale.set(
        tongueWidth * 0.58 * flameEmergence,
        tongueHeight * 0.76 * flameEmergence,
        tongueDepth * 0.58 * flameEmergence
      );
      tongue.core.rotation.x = Math.cos(t * (10.8 + i * 0.2) + tongue.phase) * 0.12;
      tongue.core.rotation.z = Math.sin(t * (11.6 + i * 0.18) + tongue.phase) * 0.1;
      tongue.shell.material.opacity =
        headVisibility * (0.52 + tongueBurst * 0.28 + flameFlicker * 0.12) * (1 - tongueRise * 0.18);
      tongue.core.material.opacity =
        headVisibility * (0.68 + tongueBurst * 0.22 + flamePulse * 0.12) * (1 - tongueRise * 0.14);
      tongue.shell.material.emissiveIntensity = headVisibility * (1.14 + tongueBurst * 0.76);
      tongue.core.material.emissiveIntensity = headVisibility * (1.48 + tongueBurst * 0.84);
    }
    for (let i = 0; i < burningModeHeadPlumes.length; i += 1) {
      const plume = burningModeHeadPlumes[i];
      const risePhase = (t * plume.speed + plume.phase * 0.42) % 1;
      const orbit =
        plume.yaw +
        t * (0.94 + i * 0.02) +
        Math.sin(t * (2.6 + i * 0.1) + plume.phase) * 0.28;
      const flare =
        0.86 +
        Math.sin(t * (8.2 + i * 0.4) + plume.phase) * 0.22 +
        surgePulse * 0.06;
      const sway = Math.cos(t * (6.1 + i * 0.28) + plume.phase);
      const plumeWidthX = Math.max(
        0.34,
        coverHalfX *
          0.74 *
          plume.baseScale.x *
          (1 + flare * 0.32 + infernoPulse * 0.12 + risePhase * 0.12)
      );
      const plumeWidthZ = Math.max(
        0.84,
        coverHalfZ *
          1.42 *
          plume.baseScale.z *
          (1.1 + flare * 0.42 + infernoPulse * 0.18 + risePhase * 0.16)
      );
      const plumeHeight = Math.max(
        0.82,
        coverHeight *
          0.66 *
          plume.baseScale.y *
          (1.02 + flamePulse * 0.46 + infernoPulse * 0.18 + risePhase * 0.24)
      );
      const outwardLean = plume.lean + sway * 0.2 + (0.5 - risePhase) * 0.18;
      const plumePulse =
        1 + Math.sin(t * (9.4 + i * 0.16) + plume.phase) * 0.05 + flare * 0.018;
      plume.pivot.position.set(
        Math.cos(orbit) *
          coverRadiusX *
          plume.radius *
          (0.64 + risePhase * 0.1) *
          flameEmergence,
        (THREE.MathUtils.lerp(-coverHalfY * 0.18, coverHalfY * 1.08, risePhase) +
          coverHeight * (plume.height - 0.5) * 0.24 +
          flameFlicker * 0.08) *
          flameEmergence,
        Math.sin(orbit) *
          coverRadiusZ *
          plume.radius *
          (0.64 + risePhase * 0.1) *
          flameEmergence
      );
      plume.pivot.rotation.set(
        Math.cos(orbit) * outwardLean,
        orbit + plume.twist + Math.sin(t * (4.8 + i * 0.22) + plume.phase) * 0.22,
        -Math.sin(orbit) * outwardLean
      );
      plume.pivot.scale.set(0.97 + plumePulse * 0.05, plumePulse, 0.97 + plumePulse * 0.05);
      plume.shell.scale.set(
        plumeWidthX * flameEmergence,
        plumeHeight * flameEmergence,
        plumeWidthZ * flameEmergence
      );
      plume.shell.rotation.x =
        Math.sin(t * (6.8 + i * 0.3) + plume.phase) * (0.1 + risePhase * 0.08);
      plume.shell.rotation.z =
        Math.cos(t * (7.6 + i * 0.24) + plume.phase) * (0.08 + risePhase * 0.06);
      plume.core.scale.set(
        plumeWidthX * 0.62 * flameEmergence,
        plumeHeight * 0.72 * flameEmergence,
        plumeWidthZ * 0.62 * flameEmergence
      );
      plume.core.rotation.x =
        Math.cos(t * (8.4 + i * 0.34) + plume.phase) * (0.08 + risePhase * 0.06);
      plume.core.rotation.z =
        Math.sin(t * (9.2 + i * 0.28) + plume.phase) * (0.06 + risePhase * 0.05);
      plume.shell.material.opacity =
        headVisibility * (0.46 + flare * 0.3 + flameFlicker * 0.14) * (1 - risePhase * 0.18);
      plume.core.material.opacity =
        headVisibility * (0.66 + flare * 0.24 + flamePulse * 0.16) * (1 - risePhase * 0.12);
      plume.shell.material.emissiveIntensity = headVisibility * (1.26 + flare * 0.88);
      plume.core.material.emissiveIntensity = headVisibility * (1.62 + flare * 0.98);
    }
    burningModeHeadShellMaterial.opacity =
      headVisibility * (0.72 + flamePulse * 0.18 + flameFlicker * 0.1);
    burningModeHeadShellMaterial.emissiveIntensity =
      headVisibility * (1.18 + flameFlicker * 0.66 + infernoPulse * 0.2);
    burningModeHeadCoreMaterial.opacity =
      headVisibility * (0.86 + flamePulse * 0.18 + flameFlicker * 0.08);
    burningModeHeadCoreMaterial.emissiveIntensity =
      headVisibility * (1.64 + flamePulse * 0.84 + infernoPulse * 0.22);
    burningModeHeadLight.intensity =
      headVisibility * (1.8 + flamePulse * 1.1 + infernoPulse * 0.35);
    burningModeHeadLight.distance =
      3.2 + Math.max(coverHalfX, coverHalfY, coverHalfZ) * 3 + flameFlicker * 0.9;

    for (let i = 0; i < burningModeHeadSparks.length; i += 1) {
      const spark = burningModeHeadSparks[i];
      if (suppressCameraFrontParticles) {
        spark.mesh.visible = false;
        spark.material.opacity = 0;
        continue;
      }
      const orbitPhase = t * (spark.speed * 1.18) + spark.phase;
      const risePhase = (t * (0.54 + i * 0.05) + spark.phase * 0.5) % 1;
      const shimmer = 0.58 + 0.42 * Math.sin(t * (8.1 + i) + spark.phase * 2);
      spark.mesh.visible = headVisibility > 0.001;
      spark.mesh.position.set(
        Math.cos(orbitPhase) *
          (coverRadiusX + spark.radius * 0.1) *
          (0.66 + risePhase * 0.1),
        -coverHalfY * 0.02 + risePhase * (coverHeight + spark.lift * 0.18),
        Math.sin(orbitPhase) *
          (coverRadiusZ + spark.radius * 0.1) *
          (0.66 + risePhase * 0.1)
      );
      spark.mesh.rotation.set(
        orbitPhase * 1.4,
        orbitPhase * 0.9,
        orbitPhase * 1.8
      );
      spark.mesh.scale.setScalar(spark.scale * (0.86 + shimmer * 0.62));
      spark.material.opacity =
        headVisibility * (1 - risePhase * 0.42) * (0.36 + shimmer * 0.42);
    }

    for (let i = 0; i < burningModeHeadEmbers.length; i += 1) {
      const ember = burningModeHeadEmbers[i];
      if (suppressCameraFrontParticles) {
        ember.mesh.visible = false;
        ember.material.opacity = 0;
        continue;
      }
      const orbitPhase = t * (ember.speed * 1.12) + ember.phase;
      const risePhase = (t * (0.62 + i * 0.024) + ember.phase * 0.35) % 1;
      const crackle = 0.62 + 0.38 * Math.sin(t * (11.4 + i * 0.22) + ember.phase * 2.4);
      ember.mesh.visible = headVisibility > 0.001;
      ember.mesh.position.set(
        Math.cos(orbitPhase) * (coverRadiusX * 0.48 + ember.radius * (0.28 + risePhase * 0.3)),
        coverHalfY * 0.02 + risePhase * (coverHeight + ember.lift * 0.28),
        Math.sin(orbitPhase) * (coverRadiusZ * 0.48 + ember.radius * (0.28 + risePhase * 0.3))
      );
      ember.mesh.scale.setScalar(ember.scale * (0.86 + crackle * 0.62));
      ember.material.opacity =
        headVisibility * (1 - risePhase * 0.52) * (0.34 + crackle * 0.54);
    }

    for (let i = 0; i < burningModeHeadSmokeWisps.length; i += 1) {
      const smoke = burningModeHeadSmokeWisps[i];
      if (suppressCameraFrontParticles) {
        smoke.mesh.visible = false;
        smoke.material.opacity = 0;
        continue;
      }
      const driftPhase = t * (smoke.speed * 1.12) + smoke.phase;
      const risePhase = (t * (0.18 + i * 0.035) + smoke.phase * 0.3) % 1;
      smoke.mesh.visible = headVisibility > 0.001;
      smoke.mesh.position.set(
        Math.cos(driftPhase) * (coverRadiusX * 0.54 + smoke.radius * 0.1),
        coverHalfY * 0.08 + risePhase * (coverHeight + smoke.lift * 0.16),
        Math.sin(driftPhase) * (coverRadiusZ * 0.54 + smoke.radius * 0.1)
      );
      smoke.mesh.scale.setScalar(smoke.scale * (0.72 + risePhase * 0.9));
      smoke.material.opacity = headVisibility * (1 - risePhase) * 0.12 * flameFlicker;
    }
  };

  const updateSecondaryBurnFx = (now: number) => {
    if (secondaryBurnState.linkedToBurningMode && !burningModeState.active) {
      deactivateSecondaryBurn({ immediate: true, now });
      return;
    }

    if (!secondaryBurnState.active && !secondaryBurnState.fadingOut) {
      secondaryBurnFxRoot.visible = false;
      secondaryBurnHoldTopFxRoot.visible = false;
      return;
    }

    if (secondaryBurnState.active && now >= secondaryBurnState.endsAt) {
      deactivateSecondaryBurn({ now });
    }

    let fadeVisibility = 1;
    if (secondaryBurnState.fadingOut) {
      const fadeProgress = THREE.MathUtils.clamp(
        (now - secondaryBurnState.fadeOutStartedAt) / secondaryBurnFadeOutMs,
        0,
        1
      );
      fadeVisibility = 1 - THREE.MathUtils.smootherstep(fadeProgress, 0, 1);
      if (fadeVisibility <= 0.001) {
        secondaryBurnState.fadingOut = false;
        secondaryBurnState.fadeOutStartedAt = 0;
        clearSecondaryBurnFx();
        return;
      }
    }

    if (!secondaryBurnState.active && !secondaryBurnState.fadingOut) {
      return;
    }

    if (!boundWeapon) {
      secondaryBurnFxRoot.visible = false;
      secondaryBurnHoldTopFxRoot.visible = false;
      return;
    }
    syncSecondaryBurnAnchors(now);

    secondaryBurnFxRoot.visible = fadeVisibility > 0.001;
    secondaryBurnLight.visible = fadeVisibility > 0.001;
    secondaryBurnFxRoot.position.copy(secondaryBurnFxAnchorLocal);
    secondaryBurnHoldTopFxRoot.position.copy(secondaryBurnHoldTopLocal);
    secondaryBurnHoldTopFxRoot.quaternion.identity();
    const elapsed = Math.max(0, now - secondaryBurnState.activatedAt);
    const impactFade = 1 - THREE.MathUtils.clamp(elapsed / secondaryBurnImpactPulseMs, 0, 1);
    const t = now * 0.001;
    const superBurnActive = superBurnState.active;
    const superSkillRActive = skillRState.active && skillRState.superFanMode;
    const sparkCountDivisor = superBurnActive ? 1 : superBurnSparkCountMultiplier;
    const superFlameBoost =
      (superBurnActive ? superBurnFlameIntensityMultiplier : 1) *
      (superSkillRActive ? superBurnSkillRFlameIntensityMultiplier : 1);
    const superLightBoost =
      (superBurnActive ? superBurnLightIntensityMultiplier : 1) *
      (superSkillRActive ? superBurnSkillRLightIntensityMultiplier : 1);
    const superSparkSpread =
      (superBurnActive ? superBurnSparkSpreadMultiplier : 1) *
      (superSkillRActive ? superBurnSkillRSparkSpreadMultiplier : 1);
    const holdBoost = secondaryBurnState.active && primaryHoldState.active ? 1 : 0;
    const flamePulse =
      (0.94 + Math.sin(t * 12.5) * 0.08 + impactFade * 0.18) *
      (1 + (superFlameBoost - 1) * 0.28);
    const haloPulse =
      (0.9 + Math.sin(t * 7.2) * 0.1 + impactFade * 0.24) *
      (1 + (superFlameBoost - 1) * 0.18);
    const flameFlicker =
      (0.88 +
        Math.sin(t * 17.5) * 0.08 +
        Math.cos(t * 9.8) * 0.04 +
        impactFade * 0.16) *
      (1 + (superFlameBoost - 1) * 0.2);
    const flareBloom =
      (0.86 + Math.sin(t * 6.4) * 0.12 + impactFade * 0.22) *
      (1 + (superFlameBoost - 1) * 0.22);
    const weaponFlameScaleBoost =
      secondaryBurnWeaponFlameSizeMultiplier * (superBurnActive ? 1.06 : 1);
    const weaponFlameOpacityBoost =
      secondaryBurnWeaponFlameOpacityMultiplier * (superBurnActive ? 1.04 : 1);

    secondaryBurnOuterFlame.scale.set(
      weaponFlameScaleBoost,
      flamePulse * weaponFlameScaleBoost,
      weaponFlameScaleBoost
    );
    secondaryBurnOuterFlame.rotation.x = Math.sin(t * 5.6) * 0.06;
    secondaryBurnOuterFlame.rotation.z = Math.cos(t * 6.1) * 0.08;
    secondaryBurnInnerFlame.scale.set(
      (0.6 + impactFade * 0.08) * weaponFlameScaleBoost,
      flamePulse * 0.78 * weaponFlameScaleBoost,
      (0.6 + impactFade * 0.08) * weaponFlameScaleBoost
    );
    secondaryBurnInnerFlame.rotation.x = Math.cos(t * 7.4) * 0.08;
    secondaryBurnInnerFlame.rotation.z = Math.sin(t * 8.3) * 0.1;
    secondaryBurnHalo.scale.setScalar(haloPulse * weaponFlameScaleBoost);
    secondaryBurnHalo.rotation.z = t * 1.8;
    secondaryBurnCorona.scale.setScalar(
      (0.92 + flareBloom * 0.16) * weaponFlameScaleBoost
    );
    secondaryBurnCorona.rotation.y = t * 1.9;
    secondaryBurnCorona.rotation.z = 0.35 + Math.sin(t * 3.8) * 0.15;
    secondaryBurnOuterCorona.scale.setScalar(
      (1.05 + flareBloom * 0.22) * weaponFlameScaleBoost
    );
    secondaryBurnOuterCorona.rotation.x = Math.PI / 3.2 + Math.sin(t * 2.8) * 0.12;
    secondaryBurnOuterCorona.rotation.z = t * -1.35;
    secondaryBurnOuterMaterial.opacity =
      Math.min(
        1,
        (0.5 + flamePulse * 0.18 + flameFlicker * 0.08 + impactFade * 0.08) *
          fadeVisibility *
          weaponFlameOpacityBoost
      );
    secondaryBurnInnerMaterial.opacity =
      Math.min(
        1,
        (0.66 + flamePulse * 0.16 + flameFlicker * 0.1 + impactFade * 0.06) *
          fadeVisibility *
          weaponFlameOpacityBoost
      );
    secondaryBurnHaloMaterial.opacity =
      Math.min(
        1,
        (0.28 + haloPulse * 0.1 + impactFade * 0.24) *
          fadeVisibility *
          weaponFlameOpacityBoost
      );
    secondaryBurnGlow.scale.setScalar(
      (0.9 + flamePulse * 0.18 + impactFade * 0.16) * weaponFlameScaleBoost
    );
    secondaryBurnGlow.scale.y =
      (0.6 + flamePulse * 0.08) * weaponFlameScaleBoost;
    secondaryBurnGlowMaterial.opacity =
      Math.min(
        1,
        (0.2 + flameFlicker * 0.14 + impactFade * 0.12) *
          fadeVisibility *
          weaponFlameOpacityBoost
      );
    secondaryBurnCoronaMaterial.opacity =
      Math.min(
        1,
        (0.22 + flareBloom * 0.16 + impactFade * 0.08) *
          fadeVisibility *
          weaponFlameOpacityBoost
      );
    secondaryBurnOuterCoronaMaterial.opacity =
      Math.min(
        1,
        (0.12 + flareBloom * 0.12 + flameFlicker * 0.06 + impactFade * 0.06) *
          fadeVisibility *
          weaponFlameOpacityBoost
      );
    secondaryBurnLight.intensity =
      (1.05 + flamePulse * 0.55 + impactFade * 0.7) * fadeVisibility * superLightBoost;
    secondaryBurnLight.distance =
      (2.35 + flameFlicker * 0.45) *
      fadeVisibility *
      secondaryBurnWeaponLightDistanceMultiplier;

    secondaryBurnHoldTopFxRoot.visible = holdBoost > 0;
    if (holdBoost > 0) {
      let holdSpreadX = secondaryBurnHoldTopSpread.x;
      let holdSpreadY = secondaryBurnHoldTopSpread.y;
      let holdSpreadZ = secondaryBurnHoldTopSpread.z;
      secondaryBurnHoldAxisLocal
        .copy(secondaryBurnAnchorLocal)
        .sub(secondaryBurnOppositeAnchorLocal);
      const holdAxisLength = secondaryBurnHoldAxisLocal.length();
      if (holdAxisLength > 0.0001) {
        secondaryBurnHoldMidLocal
          .copy(secondaryBurnAnchorLocal)
          .add(secondaryBurnOppositeAnchorLocal)
          .multiplyScalar(0.5);
        secondaryBurnHoldTopFxRoot.position.copy(secondaryBurnHoldMidLocal);
        secondaryBurnHoldAxisLocal.divideScalar(holdAxisLength);
        secondaryBurnHoldTopFxRoot.quaternion.setFromUnitVectors(
          avatarUp,
          secondaryBurnHoldAxisLocal
        );
        const radialSpread = Math.max(0.08, holdAxisLength * 0.17);
        const axialSpread = Math.max(0.24, holdAxisLength * 0.56);
        holdSpreadX = radialSpread;
        holdSpreadY = axialSpread;
        holdSpreadZ = radialSpread;
      }
      holdSpreadX *= superSparkSpread;
      holdSpreadZ *= superSparkSpread;
      holdSpreadY *= 1 + (superSparkSpread - 1) * 0.52;

      const topGlowPulse =
        (0.92 + Math.sin(t * 8.8) * 0.1 + flamePulse * 0.08) *
        (1 + (superFlameBoost - 1) * 0.2);
      secondaryBurnHoldTopGlow.scale.set(
        0.56 + topGlowPulse * 0.26,
        0.42 + topGlowPulse * 0.14,
        0.56 + topGlowPulse * 0.26
      );
      secondaryBurnHoldTopGlowMaterial.opacity =
        (0.18 + topGlowPulse * 0.12 + impactFade * 0.08) * fadeVisibility;

      const holdParticleActiveCount = Math.max(
        1,
        Math.ceil(secondaryBurnHoldTopParticles.length / sparkCountDivisor)
      );
      for (let i = 0; i < secondaryBurnHoldTopParticles.length; i += 1) {
        const particle = secondaryBurnHoldTopParticles[i];
        if (i >= holdParticleActiveCount) {
          particle.mesh.visible = false;
          particle.material.opacity = 0;
          continue;
        }
        const driftPhase = t * particle.speed + particle.phase;
        const risePhase = (t * (0.9 + i * 0.08) + particle.phase * 0.3) % 1;
        const radiusScale = 0.54 + risePhase * 1.06;
        const axialOffset =
          (risePhase - 0.5) *
          particle.lift *
          holdSpreadY *
          secondaryBurnPrimaryHoldSparkAxialScale;
        const shimmer = 0.58 + 0.42 * Math.sin(t * (7.6 + i) + particle.phase * 2);
        particle.mesh.visible = true;
        particle.mesh.position.set(
          Math.cos(driftPhase) *
            particle.radius *
            holdSpreadX *
            radiusScale *
            secondaryBurnPrimaryHoldSparkRadialScale,
          axialOffset,
          Math.sin(driftPhase) *
            particle.radius *
            holdSpreadZ *
            radiusScale *
            secondaryBurnPrimaryHoldSparkRadialScale
        );
        particle.mesh.scale.setScalar(
          particle.scale * (0.7 + shimmer * 0.45)
        );
        particle.material.opacity =
          (1 - Math.abs(risePhase - 0.5) * 1.34) *
          (0.24 + shimmer * 0.34 + flameFlicker * 0.08) *
          secondaryBurnPrimaryHoldSparkOpacityScale *
          fadeVisibility;
      }

      const holdSparkActiveCount = Math.max(
        1,
        Math.ceil(secondaryBurnHoldTopSparks.length / sparkCountDivisor)
      );
      for (let i = 0; i < secondaryBurnHoldTopSparks.length; i += 1) {
        const spark = secondaryBurnHoldTopSparks[i];
        if (i >= holdSparkActiveCount) {
          spark.mesh.visible = false;
          spark.material.opacity = 0;
          continue;
        }
        const spin = t * spark.speed + spark.phase;
        const risePhase = (t * (1.25 + i * 0.07) + spark.phase * 0.4) % 1;
        const burst = 0.72 + 0.28 * Math.sin(t * (13 + i) + spark.phase);
        const axialOffset =
          (risePhase - 0.5) *
            spark.lift *
            holdSpreadY *
            secondaryBurnPrimaryHoldSparkAxialScale +
          Math.sin(spin * 1.4 + spark.phase) * holdSpreadY * 0.08;
        spark.mesh.visible = true;
        spark.mesh.position.set(
          Math.cos(spin) *
            spark.orbitRadius *
            holdSpreadX *
            secondaryBurnPrimaryHoldSparkRadialScale,
          axialOffset,
          Math.sin(spin) *
            spark.orbitRadius *
            holdSpreadZ *
            secondaryBurnPrimaryHoldSparkRadialScale
        );
        spark.mesh.rotation.set(spin * 1.2, spin * 0.8, spin * 1.7);
        spark.mesh.scale.setScalar(spark.scale * (0.76 + burst * 0.4));
        spark.material.opacity =
          (1 - Math.abs(risePhase - 0.5) * 1.22) *
          (0.22 + burst * 0.28) *
          secondaryBurnPrimaryHoldSparkOpacityScale *
          fadeVisibility;
      }
    } else {
      secondaryBurnHoldTopGlowMaterial.opacity = 0;
      for (let i = 0; i < secondaryBurnHoldTopParticles.length; i += 1) {
        const particle = secondaryBurnHoldTopParticles[i];
        particle.mesh.visible = false;
        particle.material.opacity = 0;
      }
      for (let i = 0; i < secondaryBurnHoldTopSparks.length; i += 1) {
        const spark = secondaryBurnHoldTopSparks[i];
        spark.mesh.visible = false;
        spark.material.opacity = 0;
      }
    }

    for (let i = 0; i < secondaryBurnTongues.length; i += 1) {
      const tongue = secondaryBurnTongues[i];
      const swirl = t * (5.2 + tongue.orbitSpeed) + tongue.phase;
      const lick = 0.82 + Math.sin(t * (11 + i * 1.8) + tongue.phase) * 0.16;
      tongue.mesh.position.set(
        Math.cos(swirl) * tongue.orbitRadius * weaponFlameScaleBoost,
        (0.01 + i * 0.012 + flameFlicker * 0.015) * weaponFlameScaleBoost,
        Math.sin(swirl) * tongue.orbitRadius * weaponFlameScaleBoost
      );
      tongue.mesh.scale.set(
        tongue.baseScale.x *
          (0.92 + lick * 0.22) *
          secondaryBurnWeaponTongueScaleMultiplier,
        tongue.baseScale.y *
          (0.82 + lick * 0.32 + impactFade * 0.1) *
          secondaryBurnWeaponTongueScaleMultiplier,
        tongue.baseScale.z *
          (0.92 + lick * 0.22) *
          secondaryBurnWeaponTongueScaleMultiplier
      );
      tongue.mesh.rotation.x =
        Math.sin(t * (4.6 + i * 0.7) + tongue.phase) * tongue.tilt;
      tongue.mesh.rotation.y = swirl * 0.35;
      tongue.mesh.rotation.z =
        Math.cos(t * (5.1 + i * 0.8) + tongue.phase) * tongue.tilt;
      tongue.material.opacity =
        Math.min(
          1,
          (0.34 + lick * 0.16 + flameFlicker * 0.12 + impactFade * 0.05) *
            fadeVisibility *
            weaponFlameOpacityBoost
        );
    }

    for (let i = 0; i < secondaryBurnEmbers.length; i += 1) {
      const ember = secondaryBurnEmbers[i];
      const orbitPhase = t * ember.speed + ember.phase;
      const risePhase = (t * (0.82 + i * 0.12) + ember.phase) % 1;
      const shimmer = 0.55 + 0.45 * Math.sin(t * (7.5 + i) + ember.phase * 2);
      ember.mesh.visible = true;
      ember.mesh.position.set(
        Math.cos(orbitPhase) * ember.radius,
        0.05 + risePhase * ember.lift,
        Math.sin(orbitPhase) * ember.radius
      );
      ember.mesh.scale.setScalar(ember.scale * (0.74 + shimmer * 0.48));
      ember.material.opacity =
        (1 - risePhase) * (0.26 + shimmer * 0.48) * fadeVisibility;
    }

    const sparkActiveCount = Math.max(
      1,
      Math.ceil(secondaryBurnSparks.length / sparkCountDivisor)
    );
    for (let i = 0; i < secondaryBurnSparks.length; i += 1) {
      const spark = secondaryBurnSparks[i];
      if (i >= sparkActiveCount) {
        spark.mesh.visible = false;
        spark.material.opacity = 0;
        continue;
      }
      const spin = t * spark.orbitSpeed + spark.phase;
      const pulse = (t * (1.9 + i * 0.08) + spark.phase * 0.5) % 1;
      const burst = 0.72 + 0.28 * Math.sin(t * (14 + i) + spark.phase);
      spark.mesh.visible = true;
      spark.mesh.position.set(
        Math.cos(spin) * spark.orbitRadius * superSparkSpread,
        0.07 + pulse * spark.lift * (1 + (superSparkSpread - 1) * 0.34),
        Math.sin(spin) * spark.orbitRadius * superSparkSpread
      );
      spark.mesh.rotation.set(spin * 1.3, spin * 0.7, spin * 1.8);
      spark.mesh.scale.setScalar(spark.scale * (0.8 + burst * 0.55));
      spark.material.opacity =
        (1 - pulse) * (0.28 + burst * 0.34) * fadeVisibility;
    }

    for (let i = 0; i < secondaryBurnSmokeWisps.length; i += 1) {
      const smoke = secondaryBurnSmokeWisps[i];
      const orbitPhase = t * smoke.speed + smoke.phase;
      const risePhase = (t * (0.24 + i * 0.05) + smoke.phase * 0.3) % 1;
      smoke.mesh.visible = true;
      smoke.mesh.position.set(
        Math.cos(orbitPhase) * smoke.radius,
        0.08 + risePhase * smoke.lift,
        Math.sin(orbitPhase) * smoke.radius
      );
      smoke.mesh.scale.setScalar(smoke.scale * (0.72 + risePhase * 0.9));
      smoke.material.opacity =
        (1 - risePhase) * 0.12 * flameFlicker * fadeVisibility;
    }
  };

  const updateSecondaryBurnSwingTrailFx = (now: number) => {
    let activeTrailCount = 0;
    for (let i = 0; i < secondaryBurnSwingTrails.length; i += 1) {
      const trail = secondaryBurnSwingTrails[i];
      if (!trail.active) continue;
      if (now >= trail.endsAt) {
        resetSecondaryBurnSwingTrail(trail);
        continue;
      }

      const duration = Math.max(1, trail.endsAt - trail.spawnedAt);
      const progress = THREE.MathUtils.clamp((now - trail.spawnedAt) / duration, 0, 1);
      const fadeIn = THREE.MathUtils.clamp(0.4 + progress / 0.2, 0, 1);
      const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.56, 1);
      const visibility = fadeIn * fadeOut;
      activeTrailCount += 1;
      const lifeBoost = 1 - progress;
      const t = now * 0.001;
      const flicker =
        0.9 +
        Math.sin(t * 20 + trail.phase * 1.6) * 0.12 +
        Math.cos(t * 12.4 + trail.phase * 0.7) * 0.06;
      const stretch = 1 + lifeBoost * 0.42;
      const radiusPulse = 0.9 + flicker * 0.22 + lifeBoost * 0.12;
      const glowPulse = 0.84 + flicker * 0.28 + lifeBoost * 0.18;

      trail.outerFlame.scale.set(
        trail.radiusScale * radiusPulse,
        trail.lengthScale * stretch,
        trail.radiusScale * radiusPulse
      );
      trail.outerFlame.rotation.x = Math.sin(t * 8.6 + trail.phase) * 0.1;
      trail.outerFlame.rotation.z = Math.cos(t * 9.3 + trail.phase * 0.8) * 0.12;
      trail.innerFlame.scale.set(
        trail.radiusScale * 0.62 * radiusPulse,
        trail.lengthScale * 0.86 * stretch,
        trail.radiusScale * 0.62 * radiusPulse
      );
      trail.innerFlame.rotation.x = Math.cos(t * 11.4 + trail.phase) * 0.09;
      trail.innerFlame.rotation.z = Math.sin(t * 12.1 + trail.phase * 0.8) * 0.11;
      trail.glow.position.y = secondaryBurnFlameBaseHeight * trail.lengthScale * 0.26;
      trail.glow.scale.set(
        trail.radiusScale * 1.64 * glowPulse,
        trail.radiusScale * 0.94 * glowPulse,
        trail.radiusScale * 1.64 * glowPulse
      );

      trail.outerMaterial.opacity =
        visibility * (0.68 + flicker * 0.22) * trail.opacityScale;
      trail.innerMaterial.opacity =
        visibility * (0.84 + flicker * 0.2) * trail.opacityScale;
      trail.glowMaterial.opacity =
        visibility * (0.44 + flicker * 0.16) * trail.glowOpacityScale;
    }
    secondaryBurnSwingTrailFxRoot.visible = activeTrailCount > 0;
  };

  const updateSecondaryBurnPreludeFx = (now: number) => {
    const skillEPreludeActive = skillEState.active && !skillEState.flameTriggered;
    const skillQEPreludeFade = THREE.MathUtils.clamp(
      (skillQEPreludeFadeOutEndsAt - now) / skillQEPreludeFadeOutMs,
      0,
      1
    );
    const skillQEPreludeLive = skillQEState.active && !skillQEState.ignited;
    const skillQEPreludeActive = skillQEPreludeLive || skillQEPreludeFade > 0.001;
    const skillQEPreludeBlend = skillQEPreludeLive ? 1 : skillQEPreludeFade;
    if (!boundWeapon || (!skillEPreludeActive && !skillQEPreludeActive)) {
      secondaryBurnPreludeAuraFxRoot.visible = false;
      for (let i = 0; i < secondaryBurnPreludeAuraEmbers.length; i += 1) {
        const ember = secondaryBurnPreludeAuraEmbers[i];
        ember.mesh.visible = false;
        ember.material.opacity = 0;
      }
      for (let i = 0; i < secondaryBurnPreludeAuraSparks.length; i += 1) {
        const spark = secondaryBurnPreludeAuraSparks[i];
        spark.mesh.visible = false;
        spark.material.opacity = 0;
      }
      secondaryBurnPreludeFxRoot.visible = false;
      for (let i = 0; i < secondaryBurnPreludeEmbers.length; i += 1) {
        const ember = secondaryBurnPreludeEmbers[i];
        ember.mesh.visible = false;
        ember.material.opacity = 0;
      }
      for (let i = 0; i < secondaryBurnPreludeSparks.length; i += 1) {
        const spark = secondaryBurnPreludeSparks[i];
        spark.mesh.visible = false;
        spark.material.opacity = 0;
      }
      return;
    }

    syncSecondaryBurnAnchors(now);
    secondaryBurnPreludeAuraFxRoot.visible = true;
    secondaryBurnPreludeFxRoot.visible = true;
    secondaryBurnPreludeFxRoot.position.copy(secondaryBurnFxAnchorLocal);

    const usingSkillQEPrelude = skillQEPreludeActive;
    const progress = THREE.MathUtils.clamp(
      usingSkillQEPrelude
        ? (skillQEState.durationMs > 0
            ? (now - skillQEState.startedAt) / skillQEState.durationMs
            : 1)
        : (now - skillEState.startedAt) / skillEState.durationMs,
      0,
      1
    );
    const warmupStart = usingSkillQEPrelude
      ? secondaryBurnPreludeStartProgress * 0.72
      : secondaryBurnPreludeStartProgress;
    const warmupEnd = usingSkillQEPrelude
      ? secondaryBurnPreludeBuildProgress * 1.08
      : secondaryBurnPreludeBuildProgress;
    const warmup = THREE.MathUtils.clamp(
      (progress - warmupStart) /
        Math.max(0.001, warmupEnd - warmupStart),
      0,
      1
    );
    const landingBoost = usingSkillQEPrelude
      ? THREE.MathUtils.smoothstep(
          progress,
          skillQEPreludeGatherStartProgress * 0.92,
          skillQEPreludeGatherEndProgress
        )
      : skillEState.landingArmed
        ? THREE.MathUtils.clamp((progress - 0.48) / 0.14, 0, 1)
        : 0;
    const preludeIntensity = usingSkillQEPrelude
      ? 1.26 + skillQEPreludeBlend * 0.24
      : 1;
    const preludeSpread = usingSkillQEPrelude
      ? 1.2 + skillQEPreludeBlend * 0.16
      : 1;
    const qeBlendVisibility = usingSkillQEPrelude ? skillQEPreludeBlend : 1;
    const visibility = THREE.MathUtils.clamp(
      warmup * (0.9 + landingBoost * 0.66) * preludeIntensity * qeBlendVisibility,
      0,
      1
    );
    const auraVisibility = THREE.MathUtils.clamp(
      (warmup * 1.08 + landingBoost * 0.58) * preludeIntensity * qeBlendVisibility,
      0,
      1
    );
    const gatherProgress = usingSkillQEPrelude
      ? THREE.MathUtils.clamp(
          Math.pow(
            THREE.MathUtils.smoothstep(
              progress,
              skillQEPreludeGatherStartProgress,
              skillQEPreludeGatherEndProgress
            ),
            0.68
          ) *
            (1.1 + skillQEPreludeBlend * 0.12),
          0,
          1
        )
      : skillEState.landingArmed
        ? THREE.MathUtils.smoothstep(
            progress,
            secondaryBurnPreludeGatherStartProgress,
            secondaryBurnPreludeGatherEndProgress
          )
        : 0;
    const t = now * 0.001;
    const emberDrift =
      0.92 +
      Math.cos(t * 8.1) * 0.12 +
      landingBoost * 0.18 +
      (usingSkillQEPrelude ? 0.16 : 0);

    boundWeapon.updateMatrixWorld(true);
    avatar.updateMatrixWorld(true);
    secondaryBurnPreludeWorldTarget.copy(secondaryBurnFxAnchorLocal);
    boundWeapon.localToWorld(secondaryBurnPreludeWorldTarget);
    secondaryBurnPreludeAuraTargetLocal.copy(secondaryBurnPreludeWorldTarget);
    avatar.worldToLocal(secondaryBurnPreludeAuraTargetLocal);

    for (let i = 0; i < secondaryBurnPreludeEmbers.length; i += 1) {
      const ember = secondaryBurnPreludeEmbers[i];
      const orbitPhase = t * ember.speed + ember.phase;
      const risePhase = (t * (0.92 + i * 0.08) + ember.phase * 0.35) % 1;
      const radiusScale = 0.56 + risePhase * 0.92;
      const shimmer = 0.6 + 0.4 * Math.sin(t * (7.2 + i) + ember.phase * 2);
      const particleGather = THREE.MathUtils.clamp(
        (gatherProgress - i * 0.014) / 0.68,
        0,
        1
      );
      ember.mesh.visible = visibility > 0.001;
      secondaryBurnPreludeParticlePosition.set(
        Math.cos(orbitPhase) * ember.radius * radiusScale * preludeSpread,
        0.04 + risePhase * ember.lift * (0.84 + landingBoost * 0.34),
        Math.sin(orbitPhase) * ember.radius * radiusScale * preludeSpread
      );
      secondaryBurnPreludeTipTargetLocal.set(0, 0.04 + particleGather * 0.03, 0);
      secondaryBurnPreludeParticlePosition.lerp(
        secondaryBurnPreludeTipTargetLocal,
        particleGather
      );
      ember.mesh.position.copy(secondaryBurnPreludeParticlePosition);
      ember.mesh.scale.setScalar(
        ember.scale *
          (0.82 + shimmer * 0.5 + landingBoost * 0.28) *
          (1 - particleGather * 0.26) *
          preludeIntensity
      );
      ember.material.opacity =
        visibility *
        (1 - risePhase * (1 - particleGather * 0.45)) *
        (0.32 + shimmer * 0.38 + emberDrift * 0.12 + particleGather * 0.12);
    }

    for (let i = 0; i < secondaryBurnPreludeSparks.length; i += 1) {
      const spark = secondaryBurnPreludeSparks[i];
      const spin = t * spark.orbitSpeed + spark.phase;
      const risePhase = (t * (1.18 + i * 0.1) + spark.phase * 0.42) % 1;
      const burst = 0.68 + 0.32 * Math.sin(t * (12.4 + i) + spark.phase);
      const particleGather = THREE.MathUtils.clamp(
        (gatherProgress - i * 0.012) / 0.72,
        0,
        1
      );
      spark.mesh.visible = visibility > 0.001;
      secondaryBurnPreludeParticlePosition.set(
        Math.cos(spin) *
          spark.orbitRadius *
          (0.86 + landingBoost * 0.36) *
          preludeSpread,
        0.03 + risePhase * spark.lift * (0.98 + landingBoost * 0.42),
        Math.sin(spin) *
          spark.orbitRadius *
          (0.86 + landingBoost * 0.36) *
          preludeSpread
      );
      secondaryBurnPreludeTipTargetLocal.set(0, 0.05 + particleGather * 0.04, 0);
      secondaryBurnPreludeParticlePosition.lerp(
        secondaryBurnPreludeTipTargetLocal,
        particleGather
      );
      spark.mesh.position.copy(secondaryBurnPreludeParticlePosition);
      spark.mesh.rotation.set(spin * 1.3, spin * 0.8, spin * 1.6);
      spark.mesh.scale.setScalar(
        spark.scale *
          (1 + burst * 0.52 + landingBoost * 0.32) *
          (1 - particleGather * 0.22) *
          preludeIntensity
      );
      spark.material.opacity =
        visibility *
        (1 - risePhase * (1 - particleGather * 0.52)) *
        (0.28 + burst * 0.38 + particleGather * 0.16);
    }

    for (let i = 0; i < secondaryBurnPreludeAuraEmbers.length; i += 1) {
      const ember = secondaryBurnPreludeAuraEmbers[i];
      const orbitPhase = t * (ember.speed * 0.72) + ember.phase;
      const risePhase = (t * (0.32 + i * 0.012) + ember.phase * 0.24) % 1;
      const band = (i % 4) / 3;
      const radius =
        ember.radius * (1.1 + band * 0.54 + landingBoost * 0.18) * preludeSpread;
      const yBase = 0.28 + band * 0.36;
      const shimmer = 0.62 + 0.38 * Math.sin(t * (6.2 + i * 0.14) + ember.phase * 2.2);
      const particleGather = THREE.MathUtils.clamp(
        (gatherProgress - i * 0.008) / 0.74,
        0,
        1
      );
      ember.mesh.visible = auraVisibility > 0.001;
      secondaryBurnPreludeParticlePosition.set(
        Math.cos(orbitPhase) * radius,
        yBase + risePhase * ember.lift * 1.1,
        Math.sin(orbitPhase) * radius
      );
      secondaryBurnPreludeParticlePosition.lerp(
        secondaryBurnPreludeAuraTargetLocal,
        particleGather
      );
      ember.mesh.position.copy(secondaryBurnPreludeParticlePosition);
      ember.mesh.scale.setScalar(
        ember.scale *
          (0.92 + shimmer * 0.54 + landingBoost * 0.26) *
          (1 - particleGather * 0.22) *
          preludeIntensity
      );
      ember.material.opacity =
        auraVisibility *
        (1 - risePhase * (0.68 - particleGather * 0.28)) *
        (0.3 + shimmer * 0.42 + emberDrift * 0.12 + particleGather * 0.14);
    }

    for (let i = 0; i < secondaryBurnPreludeAuraSparks.length; i += 1) {
      const spark = secondaryBurnPreludeAuraSparks[i];
      const spin = t * (spark.orbitSpeed * 0.82) + spark.phase;
      const risePhase = (t * (0.54 + i * 0.02) + spark.phase * 0.34) % 1;
      const burst = 0.64 + 0.36 * Math.sin(t * (10.6 + i * 0.3) + spark.phase);
      const ring =
        (1.02 + (i % 4) * 0.22 + landingBoost * 0.18) * preludeSpread;
      const particleGather = THREE.MathUtils.clamp(
        (gatherProgress - i * 0.006) / 0.78,
        0,
        1
      );
      spark.mesh.visible = auraVisibility > 0.001;
      secondaryBurnPreludeParticlePosition.set(
        Math.cos(spin) * spark.orbitRadius * ring,
        0.48 + risePhase * spark.lift * 1.08,
        Math.sin(spin) * spark.orbitRadius * ring
      );
      secondaryBurnPreludeParticlePosition.lerp(
        secondaryBurnPreludeAuraTargetLocal,
        particleGather
      );
      spark.mesh.position.copy(secondaryBurnPreludeParticlePosition);
      spark.mesh.rotation.set(spin * 1.2, spin * 0.9, spin * 1.7);
      spark.mesh.scale.setScalar(
        spark.scale *
          (1.08 + burst * 0.48 + landingBoost * 0.26) *
          (1 - particleGather * 0.18) *
          preludeIntensity
      );
      spark.material.opacity =
        auraVisibility *
        (1 - risePhase * (0.72 - particleGather * 0.34)) *
        (0.26 + burst * 0.34 + particleGather * 0.16);
    }
  };

  const updateAnimations = ({
    now,
    isMoving,
    isSprinting,
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

    if (walkAction) {
      const shouldWalk =
        isMoving &&
        !attackState.active &&
        !primaryHoldState.active &&
        !skillQState.active &&
        !skillQEState.active &&
        !skillEState.active &&
        !skillRState.active;
      const currentWeight = walkAction.getEffectiveWeight();
      const nextWeight = THREE.MathUtils.lerp(
        currentWeight,
        shouldWalk ? 1 : 0,
        shouldWalk ? 0.24 : 0.18
      );

      walkAction.paused = false;
      walkAction.setEffectiveWeight(nextWeight);
      walkAction.setEffectiveTimeScale(isSprinting ? 1.45 : 1);

      if (!shouldWalk && nextWeight < 0.001) {
        walkAction.paused = true;
        walkAction.setEffectiveWeight(0);
      }
    }

    if (walkLegsAction) {
      const shouldWalkLegs = isMoving && (attackState.active || primaryHoldState.active);
      const currentWeight = walkLegsAction.getEffectiveWeight();
      const nextWeight = THREE.MathUtils.lerp(
        currentWeight,
        shouldWalkLegs ? 1 : 0,
        shouldWalkLegs ? 0.26 : 0.18
      );

      walkLegsAction.paused = false;
      walkLegsAction.setEffectiveWeight(nextWeight);
      walkLegsAction.setEffectiveTimeScale(isSprinting ? 1.45 : 1);

      if (!shouldWalkLegs && nextWeight < 0.001) {
        walkLegsAction.paused = true;
        walkLegsAction.setEffectiveWeight(0);
      }
    }

    if (deltaSeconds > 0) {
      mixer.update(deltaSeconds);
      if (primaryHoldState.active && boundWeapon) {
        const spinRate =
          primaryHoldWeaponSpinRadPerSecond *
          (secondaryBurnState.active ? secondaryBurnPrimaryHoldSpinMultiplier : 1);
        boundWeapon.rotateOnWorldAxis(
          avatarUp,
          -spinRate * deltaSeconds
        );
      }
    }
  };

  const handlePrimaryDown = () => {
    const now = performance.now();
    if (!normalAttackBindings.length && !superBurnAttackBindings.length) return;
    if (skillQState.active || skillQEState.active || skillEState.active || skillRState.active) {
      return;
    }

    primaryHoldState.pressing = true;
    primaryHoldState.pressedAt = now;

    if (attackState.active) {
      const activeBindings = getAttackBindingsByVariant(attackState.comboVariant);
      if (attackState.currentIndex < activeBindings.length - 1) {
        attackState.queuedNext = true;
      }
      return;
    }

    const nextVariant = resolveAttackVariantForNewCombo();
    const nextBindings = getAttackBindingsByVariant(nextVariant);
    const shouldContinueCombo =
      lastCompletedAttackIndex >= 0 &&
      lastCompletedAttackIndex < nextBindings.length - 1 &&
      now - lastCompletedAttackAt <= comboContinueWindowMs;

    startAttack(
      shouldContinueCombo ? lastCompletedAttackIndex + 1 : 0,
      now,
      nextVariant
    );
  };

  const handlePrimaryUp = () => {
    primaryHoldState.pressing = false;
    primaryHoldState.pressedAt = 0;
    if (primaryHoldState.active) {
      finishPrimaryHold();
    }
  };

  const handlePrimaryCancel = () => {
    primaryHoldState.pressing = false;
    primaryHoldState.pressedAt = 0;
    if (primaryHoldState.active) {
      finishPrimaryHold();
    }
  };

  const handleSkillQ = () => {
    const now = performance.now();
    if (!canCastSkillQByEnergy()) {
      return false;
    }
    if (
      attackState.active ||
      primaryHoldState.active ||
      skillQState.active ||
      skillQEState.active ||
      skillEState.active ||
      skillRState.active ||
      burningModeState.active
    ) {
      return false;
    }
    const started = startSkillQ(now);
    if (!started) return false;
    consumeAllEnergy();
    return true;
  };

  const handleSkillE = () => {
    const now = performance.now();
    if (
      attackState.active ||
      primaryHoldState.active ||
      skillQEState.active ||
      skillRState.active
    ) {
      return false;
    }
    if (burningModeState.active || skillQState.active) {
      return startSkillQE(now);
    }
    if (
      skillEState.active
    ) {
      return false;
    }
    return startSkillE(now);
  };

  const handleSkillR = () => {
    const now = performance.now();
    if (
      attackState.active ||
      primaryHoldState.active ||
      skillQState.active ||
      skillQEState.active ||
      skillEState.active ||
      skillRState.active
    ) {
      return false;
    }
    return startSkillR(now);
  };

  const updatePrimaryHoldStaminaDrain = (delta: number) => {
    if (!primaryHoldState.active || !spendStamina || delta <= 0) return;
    const staminaDrain = primaryHoldStaminaCostPerSecond * delta;
    if (staminaDrain <= 0) return;
    const spent = spendStamina(staminaDrain);
    if (spent + 0.0001 < staminaDrain) {
      primaryHoldState.pressing = false;
      primaryHoldState.pressedAt = 0;
      finishPrimaryHold();
    }
  };

  const getProjectileBlockers = () => {
    const baseBlockers = baseRuntime.getProjectileBlockers?.() ?? [];
    const reflectActive =
      primaryHoldReflectBlocker.visible && Boolean(primaryHoldReflectBlocker.parent);
    if (!reflectActive) {
      return baseBlockers;
    }
    mergedProjectileBlockers.length = 0;
    for (let i = 0; i < baseBlockers.length; i += 1) {
      mergedProjectileBlockers.push(baseBlockers[i]);
    }
    mergedProjectileBlockers.push(primaryHoldReflectBlocker);
    return mergedProjectileBlockers;
  };

  const isPrimaryHoldReflectBlockerHit = (object: THREE.Object3D | null) =>
    Boolean(
      primaryHoldReflectBlocker.visible &&
        primaryHoldReflectBlocker.parent &&
        isDescendantOf(object, primaryHoldReflectBlocker)
    );

  const handleProjectileBlockHit: NonNullable<
    CharacterRuntime["handleProjectileBlockHit"]
  > = ({
    now,
    projectile,
    blockerHit,
    origin,
    direction,
    travelDistance,
    nextPosition,
  }) => {
    if (isPrimaryHoldReflectBlockerHit(blockerHit.object)) {
      const reflected = tryReflectLinearProjectile({
        blockerHit,
        now,
        origin,
        direction,
        travelDistance,
        nextPosition,
        velocity: projectile.velocity,
        radius: projectile.radius,
        outDirection: reflectedProjectileDirection,
      });
      if (reflected) {
        reflectedProjectileHitPoint.copy(blockerHit.point);
        nextPosition.copy(reflectedProjectileHitPoint).addScaledVector(
          reflectedProjectileDirection,
          Math.max(0.08, projectile.radius * 1.2)
        );
        return true;
      }
    }

    return (
      baseRuntime.handleProjectileBlockHit?.({
        now,
        projectile,
        blockerHit,
        origin,
        direction,
        travelDistance,
        nextPosition,
      }) ?? false
    );
  };

  const resetState = () => {
    stopAllAttackActions();
    stopAllSkillActions();
    if (walkAction) {
      walkAction.stop();
      walkAction.paused = true;
      walkAction.reset();
      walkAction.setEffectiveWeight(0);
    }
    if (walkLegsAction) {
      walkLegsAction.stop();
      walkLegsAction.paused = true;
      walkLegsAction.reset();
      walkLegsAction.setEffectiveWeight(0);
    }
    resetAttackState();
    resetPrimaryHoldState();
    resetSkillEState();
    resetSkillQState();
    resetSkillQEState();
    resetSkillRState();
    deactivateSecondaryBurn({ immediate: true });
    deactivateBurningMode();
    clearAllSkillRBurns();
    clearAllSkillRBurnExplosionFx();
    clearAllSuperBurnFlamePools();
    for (let i = 0; i < skillRProjectileVisuals.length; i += 1) {
      resetSkillRProjectileVisual(skillRProjectileVisuals[i]);
    }
    lastCompletedAttackIndex = -1;
    lastCompletedAttackAt = -Infinity;
    lastAnimationUpdateAt = 0;
    baseRuntime.resetState?.();
  };

  const update = (args: CharacterRuntimeUpdate) => {
    runtimeFrameStamp += 1;
    bindModel(args.avatarModel);
    if (args.aimOriginWorld) {
      latestAimOriginWorld.copy(args.aimOriginWorld);
      hasAimOriginWorld = true;
    } else {
      hasAimOriginWorld = false;
    }
    if (args.aimDirectionWorld && args.aimDirectionWorld.lengthSq() > 0.000001) {
      latestAimDirection.copy(args.aimDirectionWorld).normalize();
    }
    const useBaseArmPose =
      !attackState.active &&
      !primaryHoldState.active &&
      !skillQState.active &&
      !skillQEState.active &&
      !skillEState.active &&
      !skillRState.active;
    baseRuntime.update({
      ...args,
      arms: useBaseArmPose ? args.arms : [],
    });
    syncAttackFacingToAim();
    updateAnimations(args);
    updateAttackState(args.now);
    updatePrimaryHoldState(args.now);
    updatePrimaryHoldDamage(args.now);
    updatePrimaryHoldTrailFx(args.now);
    updatePrimaryHoldProjectileReflectBlocker();
    updateSkillQState(args.now);
    updateSkillQEState(args.now);
    updateSkillEState(args.now);
    updateSkillRState(args.now);
    updateSuperBurnSkillRFanFx(args.now);
    updateSuperBurnState(args.now);
    updateBurningModeFx(args.now);
    updateSecondaryBurnPreludeFx(args.now);
    updateSecondaryBurnFx(args.now);
    updateSecondaryBurnSwingTrailFx(args.now);
    updateSuperBurnFlamePools(args.now);
    updateSecondaryBurnSkillRBurns(args.now);
    updateSecondaryBurnSkillRBurnExplosionFx(args.now);
  };

  const getSkillHudIndicators = () =>
    burningModeState.active
      ? ({
          q: "overdrive-ready",
          e: "overdrive-ready",
          r: "overdrive-ready",
        } as const)
      : null;

  return new CharacterRuntimeObject({
    setProfile: baseRuntime.setProfile,
    triggerSlash: baseRuntime.triggerSlash,
    handlePrimaryDown,
    handlePrimaryUp,
    handlePrimaryCancel,
    handleSkillQ,
    handleSkillE,
    handleSkillR,
    getProjectileBlockers,
    handleProjectileBlockHit,
    getMovementSpeedMultiplier: baseRuntime.getMovementSpeedMultiplier,
    getCameraScaleMultiplier: baseRuntime.getCameraScaleMultiplier,
    isBasicAttackLocked: () =>
      Boolean(baseRuntime.isBasicAttackLocked?.()) ||
      primaryHoldState.active ||
      skillQState.active ||
      skillQEState.active ||
      skillEState.active ||
      skillRState.active,
    isMovementLocked: () =>
      Boolean(baseRuntime.isMovementLocked?.()) ||
      skillQState.active ||
      skillQEState.active ||
      skillEState.active ||
      skillRState.active,
    getSkillCooldownRemainingMs: baseRuntime.getSkillCooldownRemainingMs,
    getSkillCooldownDurationMs: baseRuntime.getSkillCooldownDurationMs,
    getSkillHudIndicators,
    beforeSkillUse: ({ key, now }) => {
      const baseModifierResult = baseRuntime.beforeSkillUse?.({ key, now });
      if (key !== "r" || superBurnState.active) {
        return baseModifierResult;
      }
      const baseModifier =
        baseModifierResult && typeof baseModifierResult === "object"
          ? baseModifierResult
          : {};
      return {
        ...baseModifier,
        ignoreCostAndCooldown: true,
      };
    },
    beforeDamage: baseRuntime.beforeDamage,
    beforeStatusApply: baseRuntime.beforeStatusApply,
    isImmuneToStatus: baseRuntime.isImmuneToStatus,
    onTick: (args) => {
      updatePrimaryHoldStaminaDrain(args.delta);
      baseRuntime.onTick?.(args);
    },
    resetState,
    update,
    dispose: () => {
      clearAnimationBinding();
      clearAllSkillRBurns();
      clearAllSkillRBurnExplosionFx();
      disposeAllSuperBurnFlamePools();
      primaryHoldReflectBlocker.removeFromParent();
      superBurnSkillRFanFxRoot.removeFromParent();
      secondaryBurnFlameGeometry.dispose();
      skillRProjectileShellGeometry.dispose();
      skillRProjectileCoreGeometry.dispose();
      skillRProjectileFlameGeometry.dispose();
      burningModeHeadShellGeometry.dispose();
      burningModeHeadCoreGeometry.dispose();
      burningModeHeadPlumeShellGeometry.dispose();
      burningModeHeadPlumeCoreGeometry.dispose();
      burningModeHeadSparkGeometry.dispose();
      burningModeHeadEmberGeometry.dispose();
      burningModeHeadSmokeGeometry.dispose();
      superBurnFlamePoolCoreGeometry.dispose();
      superBurnFlamePoolRingGeometry.dispose();
      superBurnFlamePoolSparkGeometry.dispose();
      superBurnSkillRFanFillGeometry.dispose();
      superBurnSkillRFanEdgeGeometry.dispose();
      superBurnSkillRFanFlameGeometry.dispose();
      secondaryBurnHaloGeometry.dispose();
      secondaryBurnCoronaGeometry.dispose();
      secondaryBurnGlowGeometry.dispose();
      secondaryBurnEmberGeometry.dispose();
      secondaryBurnSmokeGeometry.dispose();
      secondaryBurnSparkGeometry.dispose();
      primaryHoldReflectBlockerGeometry.dispose();
      secondaryBurnOuterMaterial.dispose();
      secondaryBurnInnerMaterial.dispose();
      secondaryBurnHaloMaterial.dispose();
      secondaryBurnGlowMaterial.dispose();
      secondaryBurnCoronaMaterial.dispose();
      secondaryBurnOuterCoronaMaterial.dispose();
      secondaryBurnHoldTopGlowMaterial.dispose();
      superBurnSkillRFanFillMaterial.dispose();
      superBurnSkillRFanEdgeMaterial.dispose();
      superBurnSkillRFanGlowMaterial.dispose();
      superBurnSkillRFanSourceMaterial.dispose();
      primaryHoldReflectBlockerMaterial.dispose();
      burningModeHeadAlphaMap.dispose();
      burningModeHeadShellMaterial.dispose();
      burningModeHeadCoreMaterial.dispose();
      for (let i = 0; i < secondaryBurnPreludeAuraEmbers.length; i += 1) {
        secondaryBurnPreludeAuraEmbers[i].material.dispose();
      }
      for (let i = 0; i < secondaryBurnPreludeAuraSparks.length; i += 1) {
        secondaryBurnPreludeAuraSparks[i].material.dispose();
      }
      for (let i = 0; i < secondaryBurnPreludeEmbers.length; i += 1) {
        secondaryBurnPreludeEmbers[i].material.dispose();
      }
      for (let i = 0; i < secondaryBurnPreludeSparks.length; i += 1) {
        secondaryBurnPreludeSparks[i].material.dispose();
      }
      for (let i = 0; i < secondaryBurnEmbers.length; i += 1) {
        secondaryBurnEmbers[i].material.dispose();
      }
      for (let i = 0; i < secondaryBurnSmokeWisps.length; i += 1) {
        secondaryBurnSmokeWisps[i].material.dispose();
      }
      for (let i = 0; i < secondaryBurnSparks.length; i += 1) {
        secondaryBurnSparks[i].material.dispose();
      }
      for (let i = 0; i < secondaryBurnHoldTopParticles.length; i += 1) {
        secondaryBurnHoldTopParticles[i].material.dispose();
      }
      for (let i = 0; i < secondaryBurnHoldTopSparks.length; i += 1) {
        secondaryBurnHoldTopSparks[i].material.dispose();
      }
      for (let i = 0; i < secondaryBurnSwingTrails.length; i += 1) {
        secondaryBurnSwingTrails[i].outerMaterial.dispose();
        secondaryBurnSwingTrails[i].innerMaterial.dispose();
        secondaryBurnSwingTrails[i].glowMaterial.dispose();
      }
      for (let i = 0; i < secondaryBurnTongues.length; i += 1) {
        secondaryBurnTongues[i].material.dispose();
      }
      for (let i = 0; i < superBurnSkillRFanFlames.length; i += 1) {
        superBurnSkillRFanFlames[i].material.dispose();
      }
      for (let i = 0; i < superBurnSkillRFanSparks.length; i += 1) {
        superBurnSkillRFanSparks[i].material.dispose();
      }
      for (let i = 0; i < skillRProjectileVisuals.length; i += 1) {
        const visual = skillRProjectileVisuals[i];
        visual.material.dispose();
        visual.coreMaterial.dispose();
        for (let j = 0; j < visual.flames.length; j += 1) {
          visual.flames[j].material.dispose();
        }
        for (let j = 0; j < visual.sparks.length; j += 1) {
          visual.sparks[j].material.dispose();
        }
      }
      for (let i = 0; i < burningModeHeadPlumes.length; i += 1) {
        burningModeHeadPlumes[i].shell.material.dispose();
        burningModeHeadPlumes[i].core.material.dispose();
      }
      for (let i = 0; i < burningModeHeadJets.length; i += 1) {
        burningModeHeadJets[i].shell.material.dispose();
        burningModeHeadJets[i].core.material.dispose();
      }
      for (let i = 0; i < burningModeHeadTongues.length; i += 1) {
        burningModeHeadTongues[i].shell.material.dispose();
        burningModeHeadTongues[i].core.material.dispose();
      }
      for (let i = 0; i < burningModeHeadSparks.length; i += 1) {
        burningModeHeadSparks[i].material.dispose();
      }
      for (let i = 0; i < burningModePreludeAuraSparks.length; i += 1) {
        burningModePreludeAuraSparks[i].material.dispose();
      }
      for (let i = 0; i < burningModeHeadEmbers.length; i += 1) {
        burningModeHeadEmbers[i].material.dispose();
      }
      for (let i = 0; i < burningModePreludeAuraEmbers.length; i += 1) {
        burningModePreludeAuraEmbers[i].material.dispose();
      }
      for (let i = 0; i < burningModeHeadSmokeWisps.length; i += 1) {
        burningModeHeadSmokeWisps[i].material.dispose();
      }
      baseRuntime.dispose();
    },
    isFacingLocked: () =>
      baseRuntime.isFacingLocked() ||
      skillQState.active ||
      skillQEState.active ||
      skillEState.active ||
      skillRState.active,
  });
};
