export const MADA_LAB_STATE_KEY = "madaLabState";
export const MADA_TERMINAL_UNLOCK_EVENT = "madacombat:terminal-unlock";

export type MadaTerminalUnlockDetail = {
  code?: string;
  madaDamageMultiplier?: number;
};

export type MadaLabState = {
  madaHealth: number;
  madaMaxHealth: number;
  containmentIntegrity: number;
  electricActivity: number;
  fluidPatches: number;
  circuitBreaks: number;
  statusLabel: string;
  terminalInRange: boolean;
};

export const createInitialMadaLabState = (): MadaLabState => ({
  madaHealth: 2800,
  madaMaxHealth: 2800,
  containmentIntegrity: 100,
  electricActivity: 84,
  fluidPatches: 0,
  circuitBreaks: 0,
  statusLabel: "Containment stabilizing",
  terminalInRange: false,
});
