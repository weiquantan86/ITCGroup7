import * as THREE from "three";
import type {
  PlayerAttackTarget,
  PlayerWorldTickArgs,
} from "../../character/general/player";
import type { SceneResourceTracker } from "../../../scenes/general/resourceTracker";

export type UnifiedMonsterOption = {
  id: string;
  label: string;
  path: string;
};

export type UnifiedMonsterState = {
  monsterId: string;
  monsterLabel: string;
  monsterHealth: number;
  monsterMaxHealth: number;
  monsterAlive: boolean;
};

export type UnifiedMonsterRuntimeOptions = {
  respawnOnDefeat?: boolean;
  isGameEnded?: () => boolean;
  mochiGeneral?: {
    damageMultiplier?: number;
    defenseRatio?: number;
    tempoMultiplier?: number;
    maxBosses?: number;
  };
  mochiSoldier?: {
    healthMultiplier?: number;
    attackMultiplier?: number;
    defenseRatio?: number;
    speedMultiplier?: number;
    aggroRangeMultiplier?: number;
    attackRangeMultiplier?: number;
  };
  mada?: {
    healthMultiplier?: number;
    damageMultiplier?: number;
    tempoMultiplier?: number;
    triggerRangeMultiplier?: number;
    strikeRangeMultiplier?: number;
    completenessTier?: number;
  };
};

export type UnifiedMonsterRuntimeHost = {
  scene: THREE.Scene;
  hostGroup: THREE.Group;
  resourceTracker: SceneResourceTracker;
  monster: UnifiedMonsterOption;
  groundY: number;
  spawnPosition: THREE.Vector3;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  isBlocked: (x: number, z: number) => boolean;
  attackTargets: PlayerAttackTarget[];
  runtimeOptions?: UnifiedMonsterRuntimeOptions;
};

export type UnifiedMonsterRuntime = {
  tick: (args: PlayerWorldTickArgs) => void;
  reset: (now: number) => void;
  getState: () => UnifiedMonsterState;
  getProjectileColliders?: () => THREE.Object3D[];
  dispose: () => void;
};
