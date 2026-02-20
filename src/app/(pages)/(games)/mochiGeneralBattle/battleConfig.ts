export const SURGE_SCENE_STATE_KEY = "mochiGeneralBattle";

export const SURGE_TOTAL_MONSTERS = 1;
export const SURGE_SPAWN_BATCH_SIZE = 1;
export const SURGE_SPAWN_INTERVAL_MS = 1000;
export const SURGE_EDGE_SPAWN_PADDING = 0.8;
export const SURGE_REWARD_KILL_STEP = 5;
export const SURGE_SCORE_BOSS_DEFEAT = 100;
export const SURGE_SCORE_SUMMONED_SOLDIER_DEFEAT = 20;

export const SURGE_SNACK_KEYS = [
  "energy_sugar",
  "dream_fruit_dust",
  "core_crunch_seed",
  "star_gel_essence",
] as const;

export type SurgeSnackKey = (typeof SURGE_SNACK_KEYS)[number];

export type SurgeSnackRewards = Record<SurgeSnackKey, number>;

export const SURGE_SNACK_LABELS: Record<SurgeSnackKey, string> = {
  energy_sugar: "Energy Sugar",
  dream_fruit_dust: "Dream Fruit Dust",
  core_crunch_seed: "Core Crunch Seed",
  star_gel_essence: "Star Gel Essence",
};

export const createEmptySurgeSnackRewards = (): SurgeSnackRewards => ({
  energy_sugar: 0,
  dream_fruit_dust: 0,
  core_crunch_seed: 0,
  star_gel_essence: 0,
});

export const resolveSurgeRewardPacksFromKills = (defeatedMonsters: number) => {
  const normalized = Math.max(0, Math.floor(defeatedMonsters));
  return Math.floor(normalized / SURGE_REWARD_KILL_STEP);
};

export interface MochiSoldierSurgeState {
  totalMonsters: number;
  spawnedMonsters: number;
  aliveMonsters: number;
  defeatedMonsters: number;
  elapsedSeconds: number;
  score: number;
  playerDead: boolean;
  gameEnded: boolean;
  victory: boolean;
}

export const createInitialMochiSoldierSurgeState = (): MochiSoldierSurgeState => ({
  totalMonsters: SURGE_TOTAL_MONSTERS,
  spawnedMonsters: 0,
  aliveMonsters: 0,
  defeatedMonsters: 0,
  elapsedSeconds: 0,
  score: 0,
  playerDead: false,
  gameEnded: false,
  victory: false,
});
