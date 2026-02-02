import type * as THREE from "three";

export type ThreeModule = typeof import("three");

export type RightClickAction = "slash";

export interface CharacterFacing {
  yaw: number;
  pitch: number;
  aimWorld?: THREE.Vector3;
  aimOriginWorld?: THREE.Vector3;
}

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
  energy: number;
}

export interface SkillDefinition {
  id: string;
  label: string;
  description?: string;
  cost?: number;
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
    now?: number;
    THREE: ThreeModule;
  }) => void;
}

export interface CharacterRuntimeUpdate {
  now: number;
  isMoving: boolean;
  arms: THREE.Object3D[];
  legLeft: THREE.Object3D | null;
  legRight: THREE.Object3D | null;
  avatarModel: THREE.Object3D | null;
}

export interface CharacterRuntime {
  setProfile: (nextProfile: CharacterProfile) => void;
  triggerSlash: (facing: CharacterFacing) => void;
  handleRightClick: (facing: CharacterFacing) => void;
  update: (args: CharacterRuntimeUpdate) => void;
  dispose: () => void;
  isFacingLocked: () => boolean;
}

export interface CharacterRuntimeFactory {
  (args: { avatar: THREE.Object3D }): CharacterRuntime;
}

export interface CharacterEntry {
  profile: CharacterProfile;
  createRuntime: CharacterRuntimeFactory;
}
