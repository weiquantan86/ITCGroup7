import { createFallbackMonsterRuntime } from "./fallbackRuntime";
import { createMadaUnifiedRuntime } from "./madaRuntime";
import { createMochiGeneralUnifiedRuntime } from "./mochiGeneralRuntime";
import { createMochiSoldierUnifiedRuntime } from "./mochiSoldierRuntime";
import type { UnifiedMonsterRuntime, UnifiedMonsterRuntimeHost } from "./types";

export const createUnifiedMonsterRuntime = (
  host: UnifiedMonsterRuntimeHost
): UnifiedMonsterRuntime => {
  const monsterId = host.monster.id.toLowerCase();
  if (monsterId === "mochigeneral") {
    return createMochiGeneralUnifiedRuntime(host);
  }
  if (monsterId === "mochisoldier") {
    return createMochiSoldierUnifiedRuntime(host);
  }
  if (monsterId === "mada") {
    return createMadaUnifiedRuntime(host);
  }
  return createFallbackMonsterRuntime(host);
};

