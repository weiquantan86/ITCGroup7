import type * as THREE from "three";
import type { Projectile as RuntimeProjectile } from "../../object/projectile/types";

export type ThreeModule = typeof import("three");

export type RightClickAction = "slash";

export interface CharacterFacing {
  yaw: number;
  pitch: number;
  aimWorld?: THREE.Vector3;
  aimOriginWorld?: THREE.Vector3;
}

export type SkillKey = "q" | "e" | "r";

export interface CharacterControls {
  rightClick?: RightClickAction | null;
}

export type SlashShape = "fan" | "rect" | "cube";

export interface SlashEffectConfig {
  shape?: SlashShape;
  radius?: number;
  segments?: number;
  thetaStart?: number;
  thetaLength?: number;
  width?: number;
  length?: number;
  size?: number;
  travel?: number;
  rollTurns?: number;
  height?: number;
  forward?: number;
  expandFrom?: number;
  expandTo?: number;
  opacity?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  duration?: number;
}

export interface SlashConfig {
  enabled?: boolean;
  color?: number;
  freezeArms?: boolean;
  effect?: SlashEffectConfig;
}

export interface CharacterStats {
  health: number;
  mana: number;
  energy: number;
}

export interface CharacterEnergyConfig {
  passivePerSecond?: number;
  movingPerSecond?: number;
  hitGain?: number;
  damageTakenRatio?: number;
}

export interface CharacterManaConfig {
  passivePerSecond?: number;
}

export interface CharacterMovementConfig {
  baseSpeed?: number;
  sprintMultiplier?: number;
}

export interface CharacterCameraConfig {
  followHeadBone?: boolean;
}

export interface SkillDefinition {
  id: string;
  label: string;
  description?: string;
  cost?: number | "all";
  cooldownMs?: number;
}

export interface SkillBindings {
  q: SkillDefinition;
  e: SkillDefinition;
  r: SkillDefinition;
}

export interface CharacterKit {
  basicAttack: SkillDefinition;
  skills: SkillBindings;
}

export interface CharacterProfile {
  id: string;
  label: string;
  pathToken: string;
  stats?: CharacterStats;
  energy?: CharacterEnergyConfig;
  mana?: CharacterManaConfig;
  movement?: CharacterMovementConfig;
  camera?: CharacterCameraConfig;
  kit?: CharacterKit;
  controls?: CharacterControls;
  slash?: SlashConfig;
  animateArms?: (args: {
    arms: THREE.Object3D[];
    isMoving: boolean;
    now: number;
    THREE: ThreeModule;
  }) => void;
  animateModel?: (args: {
    avatarModel: THREE.Object3D;
    isMoving: boolean;
    isSprinting?: boolean;
    now?: number;
    THREE: ThreeModule;
  }) => void;
}

export interface CharacterRuntimeUpdate {
  now: number;
  isMoving: boolean;
  isSprinting?: boolean;
  aimDirectionWorld?: THREE.Vector3;
  arms: THREE.Object3D[];
  legLeft: THREE.Object3D | null;
  legRight: THREE.Object3D | null;
  avatarModel: THREE.Object3D | null;
}

export type ProjectileRemoveReason = "impact" | "expired" | "cleared";

export interface ProjectileLifecycleHooks {
  applyForces?: (args: {
    velocity: THREE.Vector3;
    delta: number;
    applyDefaultGravity: () => void;
    removeProjectile: (reason?: ProjectileRemoveReason) => void;
  }) => void;
  onRemove?: (args: {
    reason: ProjectileRemoveReason;
    now: number;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    triggerExplosion: () => void;
  }) => void;
}

export interface FireProjectileArgs {
  speed?: number;
  lifetime?: number;
  origin?: THREE.Vector3;
  direction?: THREE.Vector3;
  mesh?: THREE.Mesh;
  radius?: number;
  targetHitRadius?: number;
  color?: number;
  emissive?: number;
  emissiveIntensity?: number;
  scale?: number;
  damage?: number;
  energyGainOnHit?: number;
  splitOnImpact?: boolean;
  explosionRadius?: number;
  explosionDamage?: number;
  explosionColor?: number;
  explosionEmissive?: number;
  explosionEmissiveIntensity?: number;
  lifecycle?: ProjectileLifecycleHooks;
}

export interface MeleeAttackArgs {
  damage: number;
  maxDistance: number;
  hitRadius?: number;
  maxHits?: number;
}

export interface ProjectileBlockHitArgs {
  now: number;
  projectile: RuntimeProjectile;
  blockerHit: THREE.Intersection;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  travelDistance: number;
  nextPosition: THREE.Vector3;
}

export interface CharacterRuntime {
  setProfile: (nextProfile: CharacterProfile) => void;
  triggerSlash: (facing: CharacterFacing) => void;
  handleRightClick: (facing: CharacterFacing) => void;
  handlePrimaryDown?: () => void;
  handlePrimaryUp?: () => void;
  handlePrimaryCancel?: () => void;
  handleSkillQ?: () => boolean;
  handleSkillE?: () => boolean;
  handleSkillR?: () => boolean;
  getProjectileBlockers?: () => THREE.Object3D[];
  handleProjectileBlockHit?: (args: ProjectileBlockHitArgs) => boolean;
  getMovementSpeedMultiplier?: () => number;
  isBasicAttackLocked?: () => boolean;
  isMovementLocked?: () => boolean;
  getSkillCooldownRemainingMs?: (key: SkillKey) => number | null;
  getSkillCooldownDurationMs?: (key: SkillKey) => number | null;
  resetState?: () => void;
  update: (args: CharacterRuntimeUpdate) => void;
  dispose: () => void;
  isFacingLocked: () => boolean;
}

export interface CharacterRuntimeFactory {
  (args: {
    avatar: THREE.Object3D;
    mount?: HTMLElement;
    noCooldown?: boolean;
    fireProjectile?: (args?: FireProjectileArgs) => void;
    performMeleeAttack?: (args: MeleeAttackArgs) => number;
    applyEnergy?: (amount: number) => number;
    applyMana?: (amount: number) => number;
    getCurrentStats?: () => CharacterStats;
  }): CharacterRuntime;
}

export interface CharacterEntry {
  profile: CharacterProfile;
  createRuntime: CharacterRuntimeFactory;
}
