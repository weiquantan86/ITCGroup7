import type {
  CharacterProfile,
  CharacterRuntime,
  SkillKey,
} from "../types";
import type { createPlayerStatsState } from "./statsState";

type PlayerStatsState = ReturnType<typeof createPlayerStatsState>;

type CreatePlayerSkillStateArgs = {
  infiniteFire: boolean;
  statsState: PlayerStatsState;
  getCurrentProfile: () => CharacterProfile;
  getCurrentRuntime: () => CharacterRuntime | null;
  getSkillCooldownRemainingMs: (now: number, key: SkillKey) => number;
  isRuntimeCooldownManaged: (key: SkillKey) => boolean;
  emitUiState: (now: number) => void;
};

const getRuntimeSkillHandler = (
  runtime: CharacterRuntime | null,
  key: SkillKey
) => {
  if (!runtime) return null;
  if (key === "q") return runtime.handleSkillQ ?? null;
  if (key === "e") return runtime.handleSkillE ?? null;
  return runtime.handleSkillR ?? null;
};

export const createPlayerSkillState = ({
  infiniteFire,
  statsState,
  getCurrentProfile,
  getCurrentRuntime,
  getSkillCooldownRemainingMs,
  isRuntimeCooldownManaged,
  emitUiState,
}: CreatePlayerSkillStateArgs) => {
  const tryUseSkill = (key: SkillKey, now: number) => {
    if (!infiniteFire && getSkillCooldownRemainingMs(now, key) > 0) {
      return false;
    }
    const profile = getCurrentProfile();
    if (!statsState.hasEnoughSkillResource(key, profile)) {
      return false;
    }

    const handler = getRuntimeSkillHandler(getCurrentRuntime(), key);
    if (!handler) return false;

    const didTrigger = handler();
    if (!didTrigger) return false;

    statsState.spendSkillCost(key, profile);
    statsState.activateSkillCooldown(key, now, isRuntimeCooldownManaged(key));
    emitUiState(now);
    return true;
  };

  return {
    tryUseSkill,
  };
};

