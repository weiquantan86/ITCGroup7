import * as THREE from "three";
import type { PlayerWorld } from "../../entity/character/general/player";

export interface SceneSetupResult {
  world?: PlayerWorld;
  dispose?: () => void;
}

export interface SceneUiState {
  tester?: {
    health: number;
    maxHealth: number;
    alive: boolean;
  };
}

export interface SceneSetupContext {
  onStateChange?: (state: SceneUiState) => void;
}

export interface SceneDefinition {
  id: string;
  setupScene: (
    scene: THREE.Scene,
    context?: SceneSetupContext
  ) => SceneSetupResult;
}
