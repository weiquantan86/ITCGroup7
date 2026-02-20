import type { SceneUiState } from "../general/sceneTypes";

export interface TrainingSceneUiState extends SceneUiState {
  tester?: {
    health: number;
    maxHealth: number;
    alive: boolean;
  };
  trainingCombat?: {
    lastDamage: number;
    dps: number;
  };
}
