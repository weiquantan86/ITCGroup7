import type { PlayerWorld } from "./types";

export const resolveWorldHooks = (world?: PlayerWorld) => {
  const isTrainingScene = world?.sceneId === "training";
  return {
    worldTick: isTrainingScene ? world?.onTick : undefined,
    worldPlayerDeath: isTrainingScene ? world?.onPlayerDeath : undefined,
    worldPlayerReset: isTrainingScene ? world?.onPlayerReset : undefined,
  };
};
