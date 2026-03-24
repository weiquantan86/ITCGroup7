export const MADA_LAB_STATE_KEY = "madaLabState";
export const MADA_TERMINAL_UNLOCK_EVENT = "madacombat:terminal-unlock";

export type MadaTerminalUnlockDetail = {
  code?: string;
  madaDamageMultiplier?: number;
  madaMaxHealth?: number;
  madaCompletenessTier?: number;
};

export type MadaLabState = {
  madaHealth: number;
  madaMaxHealth: number;
  elapsedSeconds: number;
  score: number;
  damageScore: number;
  hitPenaltyCount: number;
  hitPenaltyScore: number;
  victoryTimeBonusScore: number;
  gameEnded: boolean;
  victory: boolean;
  playerDead: boolean;
  containmentIntegrity: number;
  electricActivity: number;
  fluidPatches: number;
  circuitBreaks: number;
  statusLabel: string;
  terminalInRange: boolean;
};

export const createInitialMadaLabState = (): MadaLabState => ({
  madaHealth: 4000,
  madaMaxHealth: 4000,
  elapsedSeconds: 0,
  score: 0,
  damageScore: 0,
  hitPenaltyCount: 0,
  hitPenaltyScore: 0,
  victoryTimeBonusScore: 0,
  gameEnded: false,
  victory: false,
  playerDead: false,
  containmentIntegrity: 100,
  electricActivity: 84,
  fluidPatches: 0,
  circuitBreaks: 0,
  statusLabel: "Containment stabilizing",
  terminalInRange: false,
});
