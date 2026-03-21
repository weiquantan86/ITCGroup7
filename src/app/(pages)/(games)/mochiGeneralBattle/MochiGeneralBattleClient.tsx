"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import SceneLauncher from "../../../asset/scenes/general/SceneLauncher";
import type { SceneUiState } from "../../../asset/scenes/general/sceneTypes";
import MochiGeneralPreview from "./MochiGeneralPreview";
import type { MochiGeneralBattleDifficultyConfig } from "./battleSceneDefinition";
import {
  SURGE_SCENE_STATE_KEY,
  SURGE_SNACK_KEYS,
  SURGE_SNACK_LABELS,
  createEmptySurgeSnackRewards,
  createInitialMochiSoldierSurgeState,
  type MochiSoldierSurgeState,
  type SurgeSnackRewards,
} from "./battleConfig";

type SkillDetail = {
  key: "q" | "e" | "r";
  label: string;
  description: string;
};

type GameCharacterOption = {
  id: string;
  label: string;
  path: string;
  basicAttackDescription: string;
  skills: SkillDetail[];
};

type MochiGeneralBattleClientProps = {
  characterOptions: GameCharacterOption[];
};

type RewardClaimStatus = "idle" | "claiming" | "claimed" | "error";
type RewardEntry = {
  key: keyof SurgeSnackRewards;
  label: string;
  count: number;
};
type EndTransitionPhase = "idle" | "fadingScene" | "showingResult";
type RewardClaimResponse = {
  error?: string;
  granted?: Partial<SurgeSnackRewards>;
  obtainedSnack?: Partial<SurgeSnackRewards>;
  winBonus?: Partial<SurgeSnackRewards>;
  scoreStep?: number;
  rewardPacks?: number;
};

type ScoreDeltaFx = {
  id: number;
  delta: number;
  lane: number;
};

const REWARD_LINE_STAGGER_MS = 280;
const REWARD_COUNT_STEP_MS = 90;
const REWARD_CONVERSION_STEP_MS = 160;
const REWARD_CONVERSION_SETTLE_DELAY_MS = 220;
const SCORE_DELTA_LIFETIME_MS = 980;
const SCORE_DELTA_LANE_COUNT = 3;
const MOCHI_GENERAL_VICTORY_SCORE_STEP = 100;
const MOCHI_GENERAL_DEFEAT_SCORE_STEP = 400;
const END_SCENE_FADE_OUT_MS = 950;

const DAMAGE_RATE_OPTIONS = [
  { value: 1, label: "x1.00", rewardBonus: 0 },
  { value: 1.25, label: "x1.25", rewardBonus: 0.25 },
  { value: 1.5, label: "x1.50", rewardBonus: 0.5 },
  { value: 2, label: "x2.00", rewardBonus: 1 },
] as const;

const DEFENSE_RATE_OPTIONS = [
  { value: 0, label: "0%", rewardBonus: 0 },
  { value: 0.1, label: "10%", rewardBonus: 0.1 },
  { value: 0.2, label: "20%", rewardBonus: 0.2 },
  { value: 0.3, label: "30%", rewardBonus: 0.3 },
  { value: 0.4, label: "40%", rewardBonus: 0.4 },
  { value: 0.5, label: "50%", rewardBonus: 0.5 },
  { value: 0.6, label: "60%", rewardBonus: 0.6 },
  { value: 0.7, label: "70%", rewardBonus: 0.7 },
] as const;

const SPEED_RATE_OPTIONS = [
  { value: 0, label: "+0%", rewardBonus: 0 },
  { value: 5, label: "+5%", rewardBonus: 0.1 },
  { value: 10, label: "+10%", rewardBonus: 0.2 },
  { value: 15, label: "+15%", rewardBonus: 0.3 },
  { value: 20, label: "+20%", rewardBonus: 0.4 },
  { value: 25, label: "+25%", rewardBonus: 0.5 },
  { value: 30, label: "+30%", rewardBonus: 0.6 },
  { value: 35, label: "+35%", rewardBonus: 0.7 },
  { value: 40, label: "+40%", rewardBonus: 0.8 },
] as const;

const MAX_DIFFICULTY_REWARD_BONUS =
  DAMAGE_RATE_OPTIONS[DAMAGE_RATE_OPTIONS.length - 1].rewardBonus +
  DEFENSE_RATE_OPTIONS[DEFENSE_RATE_OPTIONS.length - 1].rewardBonus +
  SPEED_RATE_OPTIONS[SPEED_RATE_OPTIONS.length - 1].rewardBonus;

const CHARACTER_CARD_THEMES = [
  {
    accent: "rgba(96,165,250,0.86)",
    selectedBg:
      "linear-gradient(152deg, rgba(30,58,138,0.68) 0%, rgba(59,130,246,0.34) 46%, rgba(236,72,153,0.3) 100%)",
    idleBg:
      "linear-gradient(152deg, rgba(15,23,42,0.88) 0%, rgba(30,64,175,0.2) 52%, rgba(79,70,229,0.16) 100%)",
    glow: "0 0 34px rgba(96,165,250,0.32)",
    chipBg: "rgba(37,99,235,0.24)",
    chipColor: "rgba(219,234,254,0.92)",
  },
  {
    accent: "rgba(74,222,128,0.86)",
    selectedBg:
      "linear-gradient(152deg, rgba(20,83,45,0.68) 0%, rgba(74,222,128,0.28) 46%, rgba(16,185,129,0.28) 100%)",
    idleBg:
      "linear-gradient(152deg, rgba(15,23,42,0.88) 0%, rgba(21,128,61,0.2) 52%, rgba(6,182,212,0.15) 100%)",
    glow: "0 0 34px rgba(74,222,128,0.3)",
    chipBg: "rgba(22,163,74,0.24)",
    chipColor: "rgba(220,252,231,0.92)",
  },
  {
    accent: "rgba(251,113,133,0.86)",
    selectedBg:
      "linear-gradient(152deg, rgba(136,19,55,0.7) 0%, rgba(244,63,94,0.3) 46%, rgba(251,146,60,0.28) 100%)",
    idleBg:
      "linear-gradient(152deg, rgba(15,23,42,0.88) 0%, rgba(159,18,57,0.2) 52%, rgba(249,115,22,0.15) 100%)",
    glow: "0 0 34px rgba(251,113,133,0.32)",
    chipBg: "rgba(190,24,93,0.24)",
    chipColor: "rgba(255,228,230,0.94)",
  },
] as const;

const SKILL_TAB_THEME = {
  q: {
    border: "rgba(129,140,248,0.7)",
    bg: "linear-gradient(145deg, rgba(79,70,229,0.5) 0%, rgba(56,189,248,0.35) 100%)",
    text: "rgba(224,231,255,0.98)",
  },
  e: {
    border: "rgba(45,212,191,0.72)",
    bg: "linear-gradient(145deg, rgba(13,148,136,0.5) 0%, rgba(74,222,128,0.32) 100%)",
    text: "rgba(204,251,241,0.98)",
  },
  r: {
    border: "rgba(251,113,133,0.76)",
    bg: "linear-gradient(145deg, rgba(190,24,93,0.52) 0%, rgba(251,146,60,0.32) 100%)",
    text: "rgba(255,228,230,0.98)",
  },
} as const;

const cloneRewards = (rewards: SurgeSnackRewards): SurgeSnackRewards => ({
  energy_sugar: rewards.energy_sugar || 0,
  dream_fruit_dust: rewards.dream_fruit_dust || 0,
  core_crunch_seed: rewards.core_crunch_seed || 0,
  star_gel_essence: rewards.star_gel_essence || 0,
});

const resolveMochiGeneralScoreStep = (victory: boolean) => {
  return victory
    ? MOCHI_GENERAL_VICTORY_SCORE_STEP
    : MOCHI_GENERAL_DEFEAT_SCORE_STEP;
};

const formatDurationLabel = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
};

export default function MochiGeneralBattleClient({
  characterOptions,
}: MochiGeneralBattleClientProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    characterOptions[0]?.id ?? ""
  );
  const [activeSkillKey, setActiveSkillKey] = useState<"q" | "e" | "r">("q");
  const [hasConfiguredDifficulty, setHasConfiguredDifficulty] = useState(false);
  const [bossDamageRate, setBossDamageRate] = useState<
    (typeof DAMAGE_RATE_OPTIONS)[number]["value"]
  >(1);
  const [bossDefenseRate, setBossDefenseRate] = useState<
    (typeof DEFENSE_RATE_OPTIONS)[number]["value"]
  >(0);
  const [bossSpeedRate, setBossSpeedRate] = useState<
    (typeof SPEED_RATE_OPTIONS)[number]["value"]
  >(0);
  const [isStarting, setIsStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [deltaStartAtMs, setDeltaStartAtMs] = useState<number | null>(null);
  const [sceneSessionId, setSceneSessionId] = useState(0);
  const [surgeState, setSurgeState] = useState<MochiSoldierSurgeState>(
    createInitialMochiSoldierSurgeState()
  );
  const [rewardClaimStatus, setRewardClaimStatus] =
    useState<RewardClaimStatus>("idle");
  const [rewardClaimMessage, setRewardClaimMessage] = useState("");
  const [obtainedSnackRewards, setObtainedSnackRewards] = useState<SurgeSnackRewards>(
    createEmptySurgeSnackRewards()
  );
  const [winBonusRewards, setWinBonusRewards] = useState<SurgeSnackRewards>(
    createEmptySurgeSnackRewards()
  );
  const [revealedObtainedLines, setRevealedObtainedLines] = useState(0);
  const [revealedWinBonusLines, setRevealedWinBonusLines] = useState(0);
  const [obtainedAnimatedCounts, setObtainedAnimatedCounts] = useState<
    Record<string, number>
  >({});
  const [winBonusAnimatedCounts, setWinBonusAnimatedCounts] = useState<
    Record<string, number>
  >({});
  const [rewardScoreStep, setRewardScoreStep] = useState<number | null>(null);
  const [rewardPackTarget, setRewardPackTarget] = useState<number | null>(null);
  const [animatedRewardPackCount, setAnimatedRewardPackCount] = useState(0);
  const [scoreDeltaFxList, setScoreDeltaFxList] = useState<ScoreDeltaFx[]>([]);
  const [endTransitionPhase, setEndTransitionPhase] =
    useState<EndTransitionPhase>("idle");
  const rewardSubmittedRef = useRef(false);
  const rewardAnimationTimersRef = useRef<number[]>([]);
  const scorePreviousValueRef = useRef<number | null>(0);
  const scoreDeltaTimerIdsRef = useRef<number[]>([]);
  const scoreDeltaNextIdRef = useRef(1);
  const endTransitionTimerRef = useRef<number | null>(null);

  const clearScoreDeltaTimers = useCallback(() => {
    scoreDeltaTimerIdsRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    scoreDeltaTimerIdsRef.current = [];
  }, []);

  const clearEndTransitionTimer = useCallback(() => {
    if (endTransitionTimerRef.current !== null) {
      window.clearTimeout(endTransitionTimerRef.current);
      endTransitionTimerRef.current = null;
    }
  }, []);

  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId) return characterOptions[0] ?? null;
    return (
      characterOptions.find((option) => option.id === selectedCharacterId) ??
      characterOptions[0] ??
      null
    );
  }, [characterOptions, selectedCharacterId]);

  const activeSkill = useMemo(() => {
    if (!selectedCharacter) return null;
    return (
      selectedCharacter.skills.find((skill) => skill.key === activeSkillKey) ??
      selectedCharacter.skills[0] ??
      null
    );
  }, [activeSkillKey, selectedCharacter]);

  const selectedDamageOption = useMemo(() => {
    return (
      DAMAGE_RATE_OPTIONS.find((option) => option.value === bossDamageRate) ??
      DAMAGE_RATE_OPTIONS[0]
    );
  }, [bossDamageRate]);

  const selectedDefenseOption = useMemo(() => {
    return (
      DEFENSE_RATE_OPTIONS.find((option) => option.value === bossDefenseRate) ??
      DEFENSE_RATE_OPTIONS[0]
    );
  }, [bossDefenseRate]);

  const selectedSpeedOption = useMemo(() => {
    return (
      SPEED_RATE_OPTIONS.find((option) => option.value === bossSpeedRate) ??
      SPEED_RATE_OPTIONS[0]
    );
  }, [bossSpeedRate]);

  const rewardMultiplier = useMemo(() => {
    const value =
      1 +
      selectedDamageOption.rewardBonus +
      selectedDefenseOption.rewardBonus +
      selectedSpeedOption.rewardBonus;
    return Math.round(value * 100) / 100;
  }, [selectedDamageOption, selectedDefenseOption, selectedSpeedOption]);

  const difficultyHeatRatio = useMemo(() => {
    const normalized =
      (rewardMultiplier - 1) / Math.max(0.00001, MAX_DIFFICULTY_REWARD_BONUS);
    return Math.min(1, Math.max(0, normalized));
  }, [rewardMultiplier]);

  const difficultyShellStyle = useMemo<CSSProperties>(() => {
    const upperRed = 0.05 + difficultyHeatRatio * 0.22;
    const sideRed = 0.04 + difficultyHeatRatio * 0.26;
    const lowerRed = 0.12 + difficultyHeatRatio * 0.42;
    const borderRed = 0.1 + difficultyHeatRatio * 0.55;
    const glowRed = 0.08 + difficultyHeatRatio * 0.34;
    return {
      borderColor: `rgba(248,113,113,${borderRed.toFixed(3)})`,
      backgroundImage: [
        `radial-gradient(circle at 14% 12%, rgba(251,113,133,${upperRed.toFixed(3)}), transparent 44%)`,
        `radial-gradient(circle at 84% 18%, rgba(220,38,38,${sideRed.toFixed(3)}), transparent 46%)`,
        `linear-gradient(180deg, rgba(11,17,25,0.96) 0%, rgba(69,10,10,${lowerRed.toFixed(3)}) 100%)`,
      ].join(", "),
      boxShadow: `0 30px 80px -40px rgba(2,6,23,0.85), 0 0 58px rgba(220,38,38,${glowRed.toFixed(3)})`,
    };
  }, [difficultyHeatRatio]);

  const difficultySectionStyle = useMemo<CSSProperties>(() => {
    const borderRed = 0.14 + difficultyHeatRatio * 0.4;
    const bgRed = 0.04 + difficultyHeatRatio * 0.14;
    const sectionGlow = 0.05 + difficultyHeatRatio * 0.22;
    return {
      borderColor: `rgba(248,113,113,${borderRed.toFixed(3)})`,
      backgroundColor: `rgba(30,41,59,${(0.62 - bgRed).toFixed(3)})`,
      boxShadow: `0 0 26px rgba(127,29,29,${sectionGlow.toFixed(3)})`,
    };
  }, [difficultyHeatRatio]);

  const difficultyMultiplierCardStyle = useMemo<CSSProperties>(() => {
    const borderRed = 0.26 + difficultyHeatRatio * 0.48;
    const bgRed = 0.18 + difficultyHeatRatio * 0.34;
    const glowRed = 0.1 + difficultyHeatRatio * 0.38;
    return {
      borderColor: `rgba(252,165,165,${borderRed.toFixed(3)})`,
      backgroundColor: `rgba(127,29,29,${bgRed.toFixed(3)})`,
      boxShadow: `0 0 30px rgba(220,38,38,${glowRed.toFixed(3)})`,
    };
  }, [difficultyHeatRatio]);

  const characterSelectionShellStyle = useMemo<CSSProperties>(() => {
    const intensity = Math.min(1, Math.max(0, (rewardMultiplier - 1) / 2.5));
    const borderAlpha = 0.22 + intensity * 0.3;
    const glowAlpha = 0.16 + intensity * 0.28;
    return {
      borderColor: `rgba(125,211,252,${borderAlpha.toFixed(3)})`,
      backgroundImage: [
        "radial-gradient(circle at 12% 8%, rgba(56,189,248,0.22), transparent 44%)",
        "radial-gradient(circle at 88% 18%, rgba(244,114,182,0.2), transparent 45%)",
        "radial-gradient(circle at 50% 110%, rgba(74,222,128,0.16), transparent 44%)",
        "linear-gradient(180deg, rgba(11,17,25,0.95) 0%, rgba(9,18,36,0.97) 100%)",
      ].join(", "),
      boxShadow: `0 30px 90px -42px rgba(2,6,23,0.88), 0 0 44px rgba(56,189,248,${glowAlpha.toFixed(3)})`,
    };
  }, [rewardMultiplier]);

  const skillPanelStyle = useMemo<CSSProperties>(() => {
    return {
      borderColor: "rgba(125,211,252,0.34)",
      backgroundImage: [
        "radial-gradient(circle at 14% 16%, rgba(99,102,241,0.2), transparent 44%)",
        "radial-gradient(circle at 84% 24%, rgba(45,212,191,0.18), transparent 44%)",
        "linear-gradient(180deg, rgba(15,23,42,0.86) 0%, rgba(30,41,59,0.82) 100%)",
      ].join(", "),
      boxShadow: "0 0 34px rgba(14,116,144,0.2)",
    };
  }, []);

  const bossTempoMultiplier = useMemo(() => {
    return 1 + bossSpeedRate / 100;
  }, [bossSpeedRate]);

  const battleDifficultyConfig = useMemo<MochiGeneralBattleDifficultyConfig>(() => {
    return {
      bossDamageMultiplier: bossDamageRate,
      bossDefenseRatio: bossDefenseRate,
      bossTempoMultiplier: bossTempoMultiplier,
    };
  }, [bossDamageRate, bossDefenseRate, bossTempoMultiplier]);

  const buildRewardEntries = useCallback((rewards: SurgeSnackRewards): RewardEntry[] => {
    return SURGE_SNACK_KEYS.filter((key) => rewards[key] > 0).map((key) => ({
      key,
      label: SURGE_SNACK_LABELS[key],
      count: rewards[key],
    }));
  }, []);

  const obtainedSnackEntries = useMemo(
    () => buildRewardEntries(obtainedSnackRewards),
    [buildRewardEntries, obtainedSnackRewards]
  );

  const winBonusEntries = useMemo(
    () => buildRewardEntries(winBonusRewards),
    [buildRewardEntries, winBonusRewards]
  );

  const resolvedRewardScoreStep = useMemo(() => {
    if (typeof rewardScoreStep === "number" && rewardScoreStep > 0) {
      return rewardScoreStep;
    }
    return resolveMochiGeneralScoreStep(surgeState.victory);
  }, [rewardScoreStep, surgeState.victory]);

  const resolvedRewardPackTarget = useMemo(() => {
    if (typeof rewardPackTarget === "number" && rewardPackTarget >= 0) {
      return Math.max(0, Math.floor(rewardPackTarget));
    }
    const scoreStep = Math.max(1, Math.floor(resolvedRewardScoreStep));
    return Math.floor((Math.max(0, surgeState.score) * rewardMultiplier) / scoreStep);
  }, [rewardPackTarget, resolvedRewardScoreStep, surgeState.score, rewardMultiplier]);

  const rewardConvertedScoreTarget = useMemo(() => {
    const rawTarget = resolvedRewardPackTarget * resolvedRewardScoreStep;
    return Math.max(0, Math.floor(rawTarget));
  }, [resolvedRewardPackTarget, resolvedRewardScoreStep]);

  const rewardConvertedScoreAnimated = useMemo(() => {
    const rawAnimated = animatedRewardPackCount * resolvedRewardScoreStep;
    return Math.max(0, Math.min(rewardConvertedScoreTarget, Math.floor(rawAnimated)));
  }, [animatedRewardPackCount, resolvedRewardScoreStep, rewardConvertedScoreTarget]);

  const rewardScoreRemainder = useMemo(() => {
    const effectiveScore = Math.floor(Math.max(0, surgeState.score) * rewardMultiplier);
    return Math.max(0, effectiveScore - rewardConvertedScoreTarget);
  }, [surgeState.score, rewardConvertedScoreTarget, rewardMultiplier]);

  const rewardConversionInProgress =
    rewardClaimStatus === "claimed" &&
    animatedRewardPackCount < resolvedRewardPackTarget;

  const handleSceneStateChange = useCallback((state: SceneUiState) => {
    const next = (state as Record<string, MochiSoldierSurgeState | undefined>)[
      SURGE_SCENE_STATE_KEY
    ];
    if (!next) return;
    const normalized: MochiSoldierSurgeState = {
      totalMonsters: next.totalMonsters || 0,
      spawnedMonsters: next.spawnedMonsters || 0,
      aliveMonsters: next.aliveMonsters || 0,
      defeatedMonsters: next.defeatedMonsters || 0,
      elapsedSeconds: next.elapsedSeconds || 0,
      score: next.score || 0,
      damageScore: next.damageScore || 0,
      hitPenaltyCount: next.hitPenaltyCount || 0,
      hitPenaltyScore: next.hitPenaltyScore || 0,
      victoryTimeBonusScore: next.victoryTimeBonusScore || 0,
      playerDead: Boolean(next.playerDead),
      gameEnded: Boolean(next.gameEnded),
      victory: Boolean(next.victory),
    };
    setSurgeState((previous) => {
      if (
        previous.totalMonsters === normalized.totalMonsters &&
        previous.spawnedMonsters === normalized.spawnedMonsters &&
        previous.aliveMonsters === normalized.aliveMonsters &&
        previous.defeatedMonsters === normalized.defeatedMonsters &&
        previous.elapsedSeconds === normalized.elapsedSeconds &&
        previous.score === normalized.score &&
        previous.damageScore === normalized.damageScore &&
        previous.hitPenaltyCount === normalized.hitPenaltyCount &&
        previous.hitPenaltyScore === normalized.hitPenaltyScore &&
        previous.victoryTimeBonusScore === normalized.victoryTimeBonusScore &&
        previous.playerDead === normalized.playerDead &&
        previous.gameEnded === normalized.gameEnded &&
        previous.victory === normalized.victory
      ) {
        return previous;
      }
      return normalized;
    });
  }, []);

  const resetRunUi = useCallback(() => {
    clearEndTransitionTimer();
    setSurgeState(createInitialMochiSoldierSurgeState());
    setRewardClaimStatus("idle");
    setRewardClaimMessage("");
    setObtainedSnackRewards(createEmptySurgeSnackRewards());
    setWinBonusRewards(createEmptySurgeSnackRewards());
    setRevealedObtainedLines(0);
    setRevealedWinBonusLines(0);
    setObtainedAnimatedCounts({});
    setWinBonusAnimatedCounts({});
    setRewardScoreStep(null);
    setRewardPackTarget(null);
    setAnimatedRewardPackCount(0);
    clearScoreDeltaTimers();
    setScoreDeltaFxList([]);
    setEndTransitionPhase("idle");
    scorePreviousValueRef.current = 0;
    rewardSubmittedRef.current = false;
  }, [clearEndTransitionTimer, clearScoreDeltaTimers]);

  const startGame = async () => {
    if (isStarting || !selectedCharacter || !hasConfiguredDifficulty) return;
    setDeltaStartAtMs(performance.now());
    setIsStarting(true);
    try {
      await fetch("/api/user/selected-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: selectedCharacter.id }),
      });
    } catch (error) {
      console.error(error);
    } finally {
      resetRunUi();
      setSceneSessionId((prev) => prev + 1);
      setHasStarted(true);
      setIsStarting(false);
    }
  };

  const loadSurgeScene = useCallback(async () => {
    const { createMochiGeneralBattleScene } = await import("./battleSceneDefinition");
    return {
      id: "mochiGeneralBattle",
      setupScene: (scene, context) =>
        createMochiGeneralBattleScene(scene, context, battleDifficultyConfig),
    };
  }, [battleDifficultyConfig]);

  useEffect(() => {
    if (!hasStarted || !surgeState.gameEnded || rewardSubmittedRef.current) return;

    rewardSubmittedRef.current = true;
    let cancelled = false;
    const claimRewards = async () => {
      setRewardClaimStatus("claiming");
      setRewardClaimMessage("");
      try {
        const response = await fetch("/api/games/mochisoldiersurge/reward", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameMode: "mochiGeneralBattle",
            score: surgeState.score,
            elapsedSeconds: surgeState.elapsedSeconds,
            defeatedMonsters: surgeState.defeatedMonsters,
            victory: surgeState.victory,
            rewardMultiplier,
          }),
        });
        const data = (await response.json()) as RewardClaimResponse;
        if (!response.ok) {
          throw new Error(data.error || "Failed to claim rewards.");
        }
        if (cancelled) return;
        const granted = cloneRewards({
          ...createEmptySurgeSnackRewards(),
          ...(data.granted ?? {}),
        });
        const obtainedSnack = cloneRewards({
          ...createEmptySurgeSnackRewards(),
          ...(data.obtainedSnack ?? {}),
        });
        const winBonus = cloneRewards({
          ...createEmptySurgeSnackRewards(),
          ...(data.winBonus ?? {}),
        });
        const grantedCount = SURGE_SNACK_KEYS.reduce(
          (total, key) => total + granted[key],
          0
        );
        const fallbackScoreStep = resolveMochiGeneralScoreStep(surgeState.victory);
        const normalizedScoreStepRaw = Number(data.scoreStep);
        const normalizedScoreStep =
          Number.isFinite(normalizedScoreStepRaw) && normalizedScoreStepRaw > 0
            ? Math.max(1, Math.floor(normalizedScoreStepRaw))
            : fallbackScoreStep;
        const fallbackPackCount = Math.floor(
          (Math.max(0, surgeState.score) * rewardMultiplier) / normalizedScoreStep
        );
        const normalizedPackCountRaw = Number(data.rewardPacks);
        const normalizedPackCount =
          Number.isFinite(normalizedPackCountRaw) && normalizedPackCountRaw >= 0
            ? Math.max(0, Math.floor(normalizedPackCountRaw))
            : fallbackPackCount;
        setObtainedSnackRewards(obtainedSnack);
        setWinBonusRewards(winBonus);
        setRewardScoreStep(normalizedScoreStep);
        setRewardPackTarget(normalizedPackCount);
        setRewardClaimStatus("claimed");
        if (grantedCount <= 0) {
          setRewardClaimMessage("No snack reward earned in this run.");
        } else {
          setRewardClaimMessage("Snack rewards have been added to storage.");
        }
      } catch (error) {
        if (cancelled) return;
        setRewardClaimStatus("error");
        setRewardClaimMessage(
          error instanceof Error ? error.message : "Failed to claim rewards."
        );
      }
    };

    void claimRewards();
    return () => {
      cancelled = true;
    };
  }, [
    hasStarted,
    surgeState.gameEnded,
    surgeState.score,
    surgeState.elapsedSeconds,
    surgeState.defeatedMonsters,
    surgeState.victory,
    rewardMultiplier,
  ]);

  useEffect(() => {
    if (!hasStarted || !surgeState.gameEnded) {
      clearEndTransitionTimer();
      setEndTransitionPhase("idle");
      return;
    }

    setEndTransitionPhase((prev) => {
      if (prev !== "idle") return prev;
      endTransitionTimerRef.current = window.setTimeout(() => {
        endTransitionTimerRef.current = null;
        setEndTransitionPhase("showingResult");
      }, END_SCENE_FADE_OUT_MS);
      return "fadingScene";
    });
  }, [clearEndTransitionTimer, hasStarted, surgeState.gameEnded]);

  useEffect(() => {
    return () => {
      clearEndTransitionTimer();
    };
  }, [clearEndTransitionTimer]);

  const isSettlementVisible =
    hasStarted && surgeState.gameEnded && endTransitionPhase === "showingResult";
  const shouldRenderBattleSection =
    hasStarted && (!surgeState.gameEnded || endTransitionPhase !== "showingResult");

  useEffect(() => {
    rewardAnimationTimersRef.current.forEach((timer) => {
      window.clearTimeout(timer);
      window.clearInterval(timer);
    });
    rewardAnimationTimersRef.current = [];
    setRevealedObtainedLines(0);
    setRevealedWinBonusLines(0);
    setObtainedAnimatedCounts({});
    setWinBonusAnimatedCounts({});
    setAnimatedRewardPackCount(0);

    if (!isSettlementVisible || rewardClaimStatus !== "claimed") return;

    const scheduleRewardLineAnimation = (startDelayMs: number) => {
      obtainedSnackEntries.forEach((entry, index) => {
        const revealTimer = window.setTimeout(() => {
          setRevealedObtainedLines((prev) => Math.max(prev, index + 1));
          if (entry.count <= 1) {
            setObtainedAnimatedCounts((prev) => ({ ...prev, [entry.key]: entry.count }));
            return;
          }
          let currentCount = 1;
          setObtainedAnimatedCounts((prev) => ({ ...prev, [entry.key]: currentCount }));
          const countTimer = window.setInterval(() => {
            currentCount += 1;
            if (currentCount >= entry.count) {
              currentCount = entry.count;
              window.clearInterval(countTimer);
            }
            setObtainedAnimatedCounts((prev) => ({ ...prev, [entry.key]: currentCount }));
          }, REWARD_COUNT_STEP_MS);
          rewardAnimationTimersRef.current.push(countTimer);
        }, startDelayMs + index * REWARD_LINE_STAGGER_MS);
        rewardAnimationTimersRef.current.push(revealTimer);
      });

      const winStartDelay =
        startDelayMs +
        Math.max(1, obtainedSnackEntries.length) * REWARD_LINE_STAGGER_MS +
        220;
      winBonusEntries.forEach((entry, index) => {
        const revealTimer = window.setTimeout(() => {
          setRevealedWinBonusLines((prev) => Math.max(prev, index + 1));
          if (entry.count <= 1) {
            setWinBonusAnimatedCounts((prev) => ({ ...prev, [entry.key]: entry.count }));
            return;
          }
          let currentCount = 1;
          setWinBonusAnimatedCounts((prev) => ({ ...prev, [entry.key]: currentCount }));
          const countTimer = window.setInterval(() => {
            currentCount += 1;
            if (currentCount >= entry.count) {
              currentCount = entry.count;
              window.clearInterval(countTimer);
            }
            setWinBonusAnimatedCounts((prev) => ({ ...prev, [entry.key]: currentCount }));
          }, REWARD_COUNT_STEP_MS);
          rewardAnimationTimersRef.current.push(countTimer);
        }, winStartDelay + index * REWARD_LINE_STAGGER_MS);
        rewardAnimationTimersRef.current.push(revealTimer);
      });
    };

    if (resolvedRewardPackTarget <= 0) {
      scheduleRewardLineAnimation(REWARD_CONVERSION_SETTLE_DELAY_MS);
    } else {
      let currentPack = 0;
      const conversionTickSize = Math.max(
        1,
        Math.ceil(resolvedRewardPackTarget / 36)
      );
      const conversionIntervalMs =
        resolvedRewardPackTarget > 36 ? 90 : REWARD_CONVERSION_STEP_MS;
      const conversionTimer = window.setInterval(() => {
        currentPack += conversionTickSize;
        if (currentPack >= resolvedRewardPackTarget) {
          currentPack = resolvedRewardPackTarget;
        }
        setAnimatedRewardPackCount(currentPack);
        if (currentPack >= resolvedRewardPackTarget) {
          window.clearInterval(conversionTimer);
          scheduleRewardLineAnimation(REWARD_CONVERSION_SETTLE_DELAY_MS);
        }
      }, conversionIntervalMs);
      rewardAnimationTimersRef.current.push(conversionTimer);
    }

    return () => {
      rewardAnimationTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
        window.clearInterval(timer);
      });
      rewardAnimationTimersRef.current = [];
    };
  }, [
    isSettlementVisible,
    rewardClaimStatus,
    obtainedSnackEntries,
    winBonusEntries,
    resolvedRewardPackTarget,
  ]);

  useEffect(() => {
    const previousScore = scorePreviousValueRef.current;
    scorePreviousValueRef.current = surgeState.score;

    if (!hasStarted || previousScore === null) return;
    const delta = surgeState.score - previousScore;
    if (delta === 0) return;

    const id = scoreDeltaNextIdRef.current;
    scoreDeltaNextIdRef.current += 1;
    const lane = id % SCORE_DELTA_LANE_COUNT;
    setScoreDeltaFxList((prev) => [...prev, { id, delta, lane }]);

    const removeTimer = window.setTimeout(() => {
      setScoreDeltaFxList((prev) => prev.filter((entry) => entry.id !== id));
    }, SCORE_DELTA_LIFETIME_MS);
    scoreDeltaTimerIdsRef.current.push(removeTimer);
  }, [hasStarted, surgeState.score]);

  useEffect(() => {
    return () => {
      clearScoreDeltaTimers();
    };
  }, [clearScoreDeltaTimers]);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#05070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_25%,rgba(251,146,60,0.46),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(96,165,250,0.4),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.62)_48%,rgba(2,6,23,0.86)_68%,rgba(2,6,23,0.95)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-none flex-col justify-start px-3 pb-2 pt-2 md:px-4">
        <section className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-center shadow-[0_0_52px_rgba(59,130,246,0.18)] backdrop-blur-md">
          <h1 className="bg-gradient-to-r from-orange-400 via-pink-500 to-sky-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            Mochi General Battle
          </h1>
        </section>

        {hasStarted ? (
          <>
            {shouldRenderBattleSection ? (
              <section
                className={`mt-2 grid min-h-[calc(100vh-150px)] w-full items-stretch gap-3 transition-[opacity,transform,filter] ease-out xl:grid-cols-[minmax(250px,15vw)_minmax(0,1fr)_minmax(250px,15vw)] ${
                  surgeState.gameEnded
                    ? "pointer-events-none opacity-0 blur-[8px] scale-[0.985]"
                    : "opacity-100 blur-0 scale-100"
                }`}
                style={{ transitionDuration: `${END_SCENE_FADE_OUT_MS}ms` }}
              >
                <aside className="flex min-h-0 flex-col rounded-[24px] border border-cyan-200/20 bg-slate-900/75 p-4 shadow-[0_25px_70px_-40px_rgba(2,6,23,0.9)] backdrop-blur-md">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
                    Boss Modifiers
                  </h2>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-cyan-200/20 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                        Damage Rate
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-50">
                        x{bossDamageRate.toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs text-emerald-300">
                        Reward +{selectedDamageOption.rewardBonus.toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-cyan-200/20 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                        Damage Reduction
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-50">
                        {(bossDefenseRate * 100).toFixed(0)}%
                      </p>
                      <p className="mt-1 text-xs text-emerald-300">
                        Reward +{selectedDefenseOption.rewardBonus.toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-cyan-200/20 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                        Move + Animation Speed
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-50">
                        +{bossSpeedRate}%
                      </p>
                      <p className="mt-1 text-xs text-sky-200">
                        Tempo x{bossTempoMultiplier.toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs text-emerald-300">
                        Reward +{selectedSpeedOption.rewardBonus.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-pink-200/25 bg-[linear-gradient(145deg,rgba(30,41,59,0.88)_0%,rgba(190,24,93,0.2)_100%)] p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-pink-100/80">
                      Reward Summary
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-pink-100/80">Total Bonus</span>
                      <span className="font-semibold tabular-nums text-pink-100">
                        +{Math.max(0, rewardMultiplier - 1).toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-pink-100/80">Reward Multiplier</span>
                      <span className="font-semibold tabular-nums text-pink-100">
                        x{rewardMultiplier.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </aside>

                <div className="relative flex w-full justify-center">
                  <SceneLauncher
                    key={sceneSessionId}
                    gameMode="mochiGeneralBattle"
                    characterPath={selectedCharacter?.path}
                    sceneLoader={loadSurgeScene}
                    deltaStartAtMs={deltaStartAtMs ?? undefined}
                    onSceneStateChange={handleSceneStateChange}
                    maxPixelRatio={1.25}
                    antialias={false}
                    className="h-[calc(100vh-150px)] min-h-[700px] w-full max-w-none overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1119] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]"
                  />
                </div>

                <aside className="flex min-h-0 flex-col rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_25px_70px_-40px_rgba(2,6,23,0.9)] backdrop-blur-md">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Run Data
                  </h2>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Game Time
                      </p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-100">
                        {formatDurationLabel(surgeState.elapsedSeconds)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Score
                      </p>
                      <p className="relative mt-1 text-3xl font-semibold tabular-nums text-cyan-200">
                        {surgeState.score}
                        <span className="pointer-events-none absolute inset-0 overflow-visible">
                          {scoreDeltaFxList.map((entry) => (
                            <span
                              key={entry.id}
                              className={`absolute text-xl font-bold tabular-nums animate-[mochiScoreDeltaFloat_980ms_cubic-bezier(0.18,0.8,0.32,1)_forwards] ${
                                entry.delta > 0
                                  ? "text-emerald-300 drop-shadow-[0_0_14px_rgba(52,211,153,0.45)]"
                                  : "text-rose-300 drop-shadow-[0_0_14px_rgba(251,113,133,0.45)]"
                              }`}
                              style={{
                                right: `${10 + entry.lane * 34}px`,
                                top: "50%",
                              }}
                            >
                              {entry.delta > 0 ? `+${entry.delta}` : `${entry.delta}`}
                            </span>
                          ))}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex min-h-[360px] flex-1 flex-col rounded-xl border border-red-300/35 bg-red-950/45 p-3 shadow-[0_0_34px_rgba(220,38,38,0.22)]">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Mochi General
                    </p>
                    <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-lg border border-red-300/40 bg-[radial-gradient(circle_at_40%_25%,rgba(248,113,113,0.5),transparent_56%),linear-gradient(180deg,rgba(69,10,10,0.9)_0%,rgba(127,29,29,0.95)_100%)]">
                      <MochiGeneralPreview />
                    </div>
                  </div>
                </aside>
              </section>
            ) : null}

            {isSettlementVisible ? (
              <section
                className="mt-6 flex w-full justify-center"
                style={{
                  animation:
                    "mochiSettlementFadeIn 760ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
                }}
              >
                <div className="w-full max-w-[1280px] rounded-[34px] border border-white/15 bg-[#0b1220]/95 p-8 text-center shadow-[0_30px_90px_-35px_rgba(2,6,23,0.95)] md:p-12">
                  <p
                    className={`text-lg font-semibold uppercase tracking-[0.24em] md:text-xl ${
                      surgeState.victory ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {surgeState.victory ? "Victory" : "Defeat"}
                  </p>
                  <h3 className="mt-4 text-5xl font-bold text-slate-100 md:text-7xl">
                    {surgeState.victory
                      ? "Mochi General Defeated"
                      : "Player Eliminated"}
                  </h3>

                  <div className="mt-8 rounded-[22px] border border-white/10 bg-slate-950/70 p-6 text-left md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                      Total Score
                    </p>
                    <p className="mt-2 text-5xl font-bold tabular-nums text-cyan-100 md:text-6xl">
                      {surgeState.score}
                    </p>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Settlement Bill
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-200 md:text-base">
                          <li className="flex items-center justify-between gap-4">
                            <span className="text-slate-400">Completion Time</span>
                            <span className="font-semibold tabular-nums">
                              {formatDurationLabel(surgeState.elapsedSeconds)}
                            </span>
                          </li>
                          <li className="flex items-center justify-between gap-4">
                            <span className="text-slate-400">Damage Score</span>
                            <span className="font-semibold tabular-nums text-emerald-300">
                              +{surgeState.damageScore}
                            </span>
                          </li>
                          <li className="flex items-center justify-between gap-4">
                            <span className="text-slate-400">Time Bonus</span>
                            <span className="font-semibold tabular-nums text-emerald-300">
                              +{surgeState.victoryTimeBonusScore}
                            </span>
                          </li>
                          <li className="flex items-center justify-between gap-4">
                            <span className="text-slate-400">Times Hit</span>
                            <span className="font-semibold tabular-nums">
                              {surgeState.hitPenaltyCount}
                            </span>
                          </li>
                          <li className="flex items-center justify-between gap-4">
                            <span className="text-slate-400">Hit Penalty</span>
                            <span className="font-semibold tabular-nums text-rose-300">
                              -{surgeState.hitPenaltyScore}
                            </span>
                          </li>
                          <li className="flex items-center justify-between gap-4 border-t border-white/10 pt-2">
                            <span className="text-slate-300">Final Score</span>
                            <span className="font-bold tabular-nums text-cyan-100">
                              {surgeState.score}
                            </span>
                          </li>
                        </ul>
                      </div>

                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-950/25 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                          Score To Reward
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-cyan-100 md:text-base">
                          <li className="flex items-center justify-between gap-4">
                            <span className="text-cyan-200/80">Rule</span>
                            <span className="font-semibold tabular-nums">
                              Every {resolvedRewardScoreStep} score = 1 pack
                            </span>
                          </li>
                          <li className="flex items-center justify-between gap-4">
                            <span className="text-cyan-200/80">Difficulty Multiplier</span>
                            <span className="font-semibold tabular-nums">
                              x{rewardMultiplier.toFixed(2)}
                            </span>
                          </li>
                          <li className="flex items-center justify-between gap-4">
                            <span className="text-cyan-200/80">Converted Score</span>
                            <span
                              className={`font-semibold tabular-nums ${
                                rewardConversionInProgress
                                  ? "animate-pulse text-cyan-100"
                                  : "text-cyan-100"
                              }`}
                            >
                              {rewardConvertedScoreAnimated}/{rewardConvertedScoreTarget}
                            </span>
                          </li>
                          <li className="flex items-center justify-between gap-4">
                            <span className="text-cyan-200/80">Reward Packs</span>
                            <span
                              className={`font-semibold tabular-nums ${
                                rewardConversionInProgress
                                  ? "animate-pulse text-cyan-100"
                                  : "text-cyan-100"
                              }`}
                            >
                              {animatedRewardPackCount}/{resolvedRewardPackTarget}
                            </span>
                          </li>
                          <li className="flex items-center justify-between gap-4">
                            <span className="text-cyan-200/80">Remaining Effective Score</span>
                            <span className="font-semibold tabular-nums text-cyan-100">
                              {rewardScoreRemainder}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/70 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Converted Rewards
                      </p>
                      {rewardClaimStatus === "claiming" ? (
                        <p className="mt-3 text-sm text-slate-300">Calculating...</p>
                      ) : obtainedSnackEntries.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-300">None</p>
                      ) : (
                        <ul className="mt-3 space-y-2 text-sm md:text-base">
                          {obtainedSnackEntries.slice(0, revealedObtainedLines).map((entry) => {
                            const shownCount = obtainedAnimatedCounts[entry.key] ?? 1;
                            const isCounting = shownCount < entry.count;
                            return (
                              <li
                                key={entry.key}
                                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition ${
                                  isCounting
                                    ? "border-cyan-300/45 bg-cyan-500/12 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.2)]"
                                    : "border-white/12 bg-white/[0.03] text-slate-100"
                                }`}
                              >
                                <span className="font-semibold">{entry.label}</span>
                                <span
                                  className={`inline-flex min-w-[84px] items-center justify-center rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
                                    isCounting
                                      ? "animate-pulse bg-cyan-300/25 text-cyan-100"
                                      : "bg-slate-100/12 text-slate-100"
                                  }`}
                                >
                                  x {shownCount}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <p
                      className={`mt-6 text-sm md:text-base ${
                        rewardClaimStatus === "error"
                          ? "text-rose-300"
                          : rewardClaimStatus === "claimed"
                          ? "text-emerald-300"
                          : "text-slate-400"
                      }`}
                    >
                      {rewardClaimStatus === "claiming"
                        ? "Claiming rewards..."
                        : rewardClaimMessage || "Settlement pending..."}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                    <Link
                      href="/userSystem/user"
                      className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-8 text-base font-semibold text-white transition hover:brightness-105"
                    >
                      Back to Menu
                    </Link>
                    <Link
                      href="/storage"
                      className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-8 text-base font-semibold text-slate-100 transition hover:border-white/45 hover:bg-white/10"
                    >
                      Open Storage
                    </Link>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section className="mt-4 flex w-full justify-center">
            <div
              className="w-full max-w-[1400px] rounded-[30px] border border-white/10 bg-[#0b1119]/95 p-6 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)] backdrop-blur-xl md:p-8"
              style={!hasConfiguredDifficulty ? difficultyShellStyle : undefined}
            >
              {!hasConfiguredDifficulty ? (
                <div className="mx-auto w-full max-w-[1120px]">
                  <p
                    className="text-center text-sm font-semibold uppercase tracking-[0.24em] text-slate-300 md:text-base"
                    style={{ color: `rgba(254,226,226,${(0.58 + difficultyHeatRatio * 0.34).toFixed(3)})` }}
                  >
                    Battle Difficulty
                  </p>
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4" style={difficultySectionStyle}>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                        1. Mochi General Damage Rate
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {DAMAGE_RATE_OPTIONS.map((option) => {
                          const selected = option.value === bossDamageRate;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setBossDamageRate(option.value)}
                              className={`rounded-xl border px-4 py-3 text-left transition ${
                                selected
                                  ? "border-amber-300/70 bg-amber-400/15 shadow-[0_0_20px_rgba(251,191,36,0.22)]"
                                  : "border-white/10 bg-slate-950/65 hover:border-white/30"
                              }`}
                            >
                              <p className="text-base font-semibold text-slate-100">
                                {option.label}
                              </p>
                              <p className="mt-1 text-xs text-slate-300">
                                {option.rewardBonus > 0
                                  ? `Reward +${option.rewardBonus.toFixed(2)}`
                                  : "No reward bonus"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4" style={difficultySectionStyle}>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                        2. Mochi General Damage Reduction Rate
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {DEFENSE_RATE_OPTIONS.map((option) => {
                          const selected = option.value === bossDefenseRate;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setBossDefenseRate(option.value)}
                              className={`rounded-xl border px-4 py-3 text-left transition ${
                                selected
                                  ? "border-emerald-300/70 bg-emerald-400/15 shadow-[0_0_20px_rgba(52,211,153,0.22)]"
                                  : "border-white/10 bg-slate-950/65 hover:border-white/30"
                              }`}
                            >
                              <p className="text-base font-semibold text-slate-100">
                                {option.label}
                              </p>
                              <p className="mt-1 text-xs text-slate-300">
                                {option.rewardBonus > 0
                                  ? `Reward +${option.rewardBonus.toFixed(2)}`
                                  : "No reward bonus"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4" style={difficultySectionStyle}>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                        3. Mochi General Move + Animation Speed
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {SPEED_RATE_OPTIONS.map((option) => {
                          const selected = option.value === bossSpeedRate;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setBossSpeedRate(option.value)}
                              className={`rounded-xl border px-4 py-3 text-left transition ${
                                selected
                                  ? "border-sky-300/70 bg-sky-400/15 shadow-[0_0_20px_rgba(56,189,248,0.22)]"
                                  : "border-white/10 bg-slate-950/65 hover:border-white/30"
                              }`}
                            >
                              <p className="text-base font-semibold text-slate-100">
                                {option.label}
                              </p>
                              <p className="mt-1 text-xs text-slate-300">
                                {option.rewardBonus > 0
                                  ? `Reward +${option.rewardBonus.toFixed(2)}`
                                  : "No reward bonus"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-7 rounded-2xl border border-cyan-300/35 bg-cyan-950/30 px-4 py-5 text-center"
                    style={difficultyMultiplierCardStyle}
                  >
                    <p
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200"
                      style={{ color: `rgba(254,226,226,${(0.72 + difficultyHeatRatio * 0.24).toFixed(3)})` }}
                    >
                      Reward Multiplier
                    </p>
                    <p
                      className="mt-2 text-4xl font-bold tabular-nums text-cyan-100 md:text-5xl"
                      style={{ color: `rgba(255,241,242,${(0.88 + difficultyHeatRatio * 0.12).toFixed(3)})` }}
                    >
                      x{rewardMultiplier.toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setHasConfiguredDifficulty(true)}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-8 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition hover:brightness-105"
                    >
                      Continue to Character Selection
                    </button>
                  </div>
                </div>
              ) : characterOptions.length === 0 ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-5 text-sm text-rose-200">
                  No available characters to start this game.
                </div>
              ) : (
                <>
                  <div
                    className="mb-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
                    style={{
                      borderColor: "rgba(125,211,252,0.34)",
                      backgroundImage:
                        "linear-gradient(90deg, rgba(30,64,175,0.24) 0%, rgba(14,116,144,0.2) 38%, rgba(190,24,93,0.2) 100%)",
                    }}
                  >
                    <p className="text-sm text-cyan-50">
                      Difficulty set. Reward multiplier:{" "}
                      <span className="bg-gradient-to-r from-cyan-100 via-sky-200 to-pink-200 bg-clip-text font-semibold tabular-nums text-transparent">
                        x{rewardMultiplier.toFixed(2)}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setHasConfiguredDifficulty(false)}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-cyan-100/35 bg-slate-900/40 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-50 transition hover:border-cyan-100/55 hover:bg-cyan-100/10"
                    >
                      Edit Difficulty
                    </button>
                  </div>

                  <div
                    className="flex flex-col items-center gap-6 rounded-[26px] border px-4 py-5 md:px-6"
                    style={characterSelectionShellStyle}
                  >
                    <div className="w-full max-w-[1120px] space-y-4 text-center">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100 md:text-base">
                        Choose Character
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {characterOptions.map((option, index) => {
                          const selected = option.id === selectedCharacter?.id;
                          const theme =
                            CHARACTER_CARD_THEMES[index % CHARACTER_CARD_THEMES.length];
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setSelectedCharacterId(option.id);
                                setActiveSkillKey("q");
                              }}
                              className={`rounded-2xl border px-6 py-6 text-center transition duration-300 ${
                                selected
                                  ? "scale-[1.02]"
                                  : "hover:scale-[1.01]"
                              }`}
                              style={
                                selected
                                  ? {
                                      borderColor: theme.accent,
                                      backgroundImage: theme.selectedBg,
                                      boxShadow: `${theme.glow}, inset 0 0 0 1px rgba(255,255,255,0.08)`,
                                    }
                                  : {
                                      borderColor: "rgba(255,255,255,0.16)",
                                      backgroundImage: theme.idleBg,
                                    }
                              }
                            >
                              <p className="text-xl font-semibold text-slate-50 md:text-2xl">
                                {option.label}
                              </p>
                              <p
                                className="mt-2 text-sm uppercase tracking-[0.22em]"
                                style={{
                                  color: theme.chipColor,
                                  backgroundColor: theme.chipBg,
                                  border: "1px solid rgba(255,255,255,0.14)",
                                  borderRadius: "9999px",
                                  display: "inline-block",
                                  padding: "4px 10px",
                                }}
                              >
                                {option.id}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <aside
                      className="w-full max-w-[760px] rounded-2xl border p-4"
                      style={skillPanelStyle}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                        Skill Info
                      </p>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {(["q", "e", "r"] as const).map((key) => {
                          const isActive = activeSkill?.key === key;
                          const tabTheme = SKILL_TAB_THEME[key];
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setActiveSkillKey(key)}
                              className={`rounded-lg border px-2 py-2 text-xs font-semibold uppercase transition ${
                                isActive
                                  ? ""
                                  : "border-white/15 bg-slate-950/65 text-slate-200 hover:border-white/35"
                              }`}
                              style={
                                isActive
                                  ? {
                                      borderColor: tabTheme.border,
                                      backgroundImage: tabTheme.bg,
                                      color: tabTheme.text,
                                      boxShadow: "0 0 20px rgba(255,255,255,0.08)",
                                    }
                                  : undefined
                              }
                            >
                              {key.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>

                      <div
                        className="mt-3 rounded-xl border p-3"
                        style={{
                          borderColor: "rgba(129,140,248,0.3)",
                          backgroundImage:
                            "linear-gradient(145deg, rgba(30,41,59,0.84) 0%, rgba(49,46,129,0.34) 100%)",
                        }}
                      >
                        <p className="text-sm font-semibold text-indigo-100">
                          {activeSkill?.label ?? "Skill"}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-200">
                          {activeSkill?.description || "No description."}
                        </p>
                      </div>

                      <div
                        className="mt-3 rounded-xl border p-3"
                        style={{
                          borderColor: "rgba(45,212,191,0.3)",
                          backgroundImage:
                            "linear-gradient(145deg, rgba(15,23,42,0.84) 0%, rgba(13,148,136,0.26) 100%)",
                        }}
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">Basic Attack</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-100">
                          {selectedCharacter?.basicAttackDescription || "No description."}
                        </p>
                      </div>
                    </aside>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      disabled={!selectedCharacter || isStarting || !hasConfiguredDifficulty}
                      onClick={() => void startGame()}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-pink-500 px-8 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(56,189,248,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isStarting ? "Starting..." : "Start"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </div>
      <style jsx>{`
        @keyframes mochiSettlementFadeIn {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.985);
            filter: blur(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes mochiScoreDeltaFloat {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.76);
          }
          16% {
            opacity: 1;
            transform: translateY(-40%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-150%) scale(1.1);
          }
        }
      `}</style>
    </main>
  );
}
