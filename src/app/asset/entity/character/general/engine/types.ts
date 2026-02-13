import * as THREE from "three";
import type { Projectile as CharacterProjectile } from "../../../../object/projectile/types";
import type { CharacterStats, SkillKey } from "../types";

export type RecoveryZoneType = "health" | "mana" | "energy" | "both";

export interface RecoveryZone {
  id: string;
  type: RecoveryZoneType;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cooldownMs?: number;
}

export type PlayerAttackSource = "projectile" | "slash";

export interface PlayerAttackHit {
  now: number;
  source: PlayerAttackSource;
  damage: number;
  point: THREE.Vector3;
  direction: THREE.Vector3;
}

export interface PlayerAttackTarget {
  id: string;
  object: THREE.Object3D;
  isActive?: () => boolean;
  onHit: (hit: PlayerAttackHit) => void;
}

export interface PlayerWorldTickArgs {
  now: number;
  delta: number;
  player: THREE.Object3D;
  camera: THREE.PerspectiveCamera;
  currentStats: CharacterStats;
  maxStats: CharacterStats;
  applyDamage: (amount: number) => number;
  projectileBlockers: THREE.Object3D[];
}

export type PlayerDeathResolution = "handled" | "reset" | "ignore";

export interface PlayerDeathArgs {
  now: number;
  sceneId?: string;
  gameMode: string;
  player: THREE.Object3D;
  currentStats: CharacterStats;
  maxStats: CharacterStats;
  resetPlayer: () => void;
}

export interface PlayerWorld {
  sceneId?: string;
  groundY: number;
  playerSpawn?: THREE.Vector3;
  resetOnDeath?: boolean;
  isBlocked?: (x: number, z: number) => boolean;
  projectileColliders?: THREE.Object3D[];
  recoveryZones?: RecoveryZone[];
  attackTargets?: PlayerAttackTarget[];
  onTick?: (args: PlayerWorldTickArgs) => void;
  onPlayerDeath?: (
    args: PlayerDeathArgs
  ) => PlayerDeathResolution | void;
  onPlayerReset?: () => void;
  bounds?: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export interface PlayerUiState {
  cooldowns: Record<SkillKey, number>;
  cooldownDurations: Record<SkillKey, number>;
  manaCurrent: number;
  manaMax: number;
  energyCurrent: number;
  energyMax: number;
  infiniteFire: boolean;
}

export interface PlayerController {
  camera: THREE.PerspectiveCamera;
  miniCamera: THREE.PerspectiveCamera;
  projectiles: Projectile[];
  update: (now: number, delta: number) => void;
  render: (renderer: THREE.WebGLRenderer) => void;
  resize: (width: number, height: number) => void;
  setCharacterPath: (path?: string) => void;
  dispose: () => void;
}

export type Projectile = CharacterProjectile;


