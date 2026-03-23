import { createFallbackMonsterRuntime } from "./fallbackRuntime";
import { createMadaUnifiedRuntime } from "../mada/runtime";
import { createMochiGeneralUnifiedRuntime } from "../mochiGeneral/runtime";
import { createMochiSoldierUnifiedRuntime } from "../mochiSoldier/unifiedRuntime";
import type { UnifiedMonsterRuntime, UnifiedMonsterRuntimeHost } from "./types";

type UnifiedRuntimeFactory = (
  host: UnifiedMonsterRuntimeHost
) => UnifiedMonsterRuntime;

const runtimeFactoryByMonsterId: Record<string, UnifiedRuntimeFactory> = {
  mochigeneral: createMochiGeneralUnifiedRuntime,
  mochisoldier: createMochiSoldierUnifiedRuntime,
  mada: createMadaUnifiedRuntime,
};

export const createUnifiedMonsterRuntime = (
  host: UnifiedMonsterRuntimeHost
): UnifiedMonsterRuntime => {
  const monsterId = host.monster.id.toLowerCase();
  const factory = runtimeFactoryByMonsterId[monsterId];
  return factory ? factory(host) : createFallbackMonsterRuntime(host);
};
