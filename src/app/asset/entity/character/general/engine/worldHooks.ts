import type { PlayerWorld } from "./types";

export const resolveWorldHooks = (world?: PlayerWorld) => {
  return {
    worldTick: world?.onTick,
    worldPlayerDeath: world?.onPlayerDeath,
    worldPlayerReset: world?.onPlayerReset,
  };
};
