import type {
  CharacterProfile,
  CharacterRuntime,
  SkillUseModifier,
  SkillKey,
} from "../types";
import type { createPlayerStatsState } from "../player/statsState";

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
    const runtime = getCurrentRuntime();
    const skillModifierResult = runtime?.beforeSkillUse?.({ key, now });
    const skillModifier: SkillUseModifier =
      skillModifierResult && typeof skillModifierResult === "object"
        ? skillModifierResult
        : {};
    const allowSkill = skillModifier?.allow ?? true;
    if (!allowSkill) return false;
    const ignoreCostAndCooldown = Boolean(skillModifier?.ignoreCostAndCooldown);
    const ignoreCooldown =
      Boolean(skillModifier?.ignoreCooldown) || ignoreCostAndCooldown;
    const ignoreResource =
      Boolean(skillModifier?.ignoreResource) || ignoreCostAndCooldown;

    if (
      !ignoreCooldown &&
      !infiniteFire &&
      getSkillCooldownRemainingMs(now, key) > 0
    ) {
      return false;
    }
    const profile = getCurrentProfile();
    if (!ignoreResource && !statsState.hasEnoughSkillResource(key, profile)) {
      return false;
    }

    const handler = getRuntimeSkillHandler(runtime, key);
    if (!handler) return false;

    const didTrigger = handler();
    if (!didTrigger) return false;

    if (!ignoreCostAndCooldown) {
      statsState.spendSkillCost(key, profile);
      statsState.activateSkillCooldown(key, now, isRuntimeCooldownManaged(key));
    }
    emitUiState(now);
    return true;
  };

  return {
    tryUseSkill,
  };
};



