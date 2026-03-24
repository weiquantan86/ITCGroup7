"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import SceneLauncher from "../../../asset/scenes/general/SceneLauncher";
import type { SceneUiState } from "../../../asset/scenes/general/sceneTypes";
import MadaPreview from "./MadaPreview";
import {
  SURGE_SNACK_KEYS,
  SURGE_SNACK_LABELS,
  createEmptySurgeSnackRewards,
  type SurgeSnackRewards,
} from "../mochiSoldierSurge/surgeConfig";
import {
  MADA_LAB_STATE_KEY,
  MADA_TERMINAL_UNLOCK_EVENT,
  createInitialMadaLabState,
  type MadaLabState,
} from "./labConfig";

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

type MadaCombatClientProps = {
  characterOptions: GameCharacterOption[];
  initialCharacterId: string;
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
  scoreStep?: number;
  rewardPacks?: number;
  pointReward?: number;
};

const MADA_UNLOCK_CODE = "1986";
const MADA_SETTLEMENT_SCORE_STEP_VICTORY = 100;
const MADA_SETTLEMENT_SCORE_STEP_DEFEAT = 400;
const MADA_VICTORY_POINT_REWARD_BASE = 100;
const END_SCENE_FADE_OUT_MS = 950;
const REWARD_REQUEST_TIMEOUT_MS = 12_000;
const MADA_DAMAGE_MULTIPLIER_OPTIONS = Array.from({ length: 7 }, (_, index) => {
  const value = 1 + index * 0.5;
  return {
    value,
    label: `x${value.toFixed(1)}`,
    rewardBonus: Number(((value - 1) * 0.3).toFixed(2)),
  };
});
const MADA_HEALTH_OPTIONS = [
  { value: 4000, label: "4000", rewardBonus: 0 },
  { value: 6000, label: "6000", rewardBonus: 1.5 },
  { value: 8000, label: "8000", rewardBonus: 3 },
] as const;
const MADA_COMPLETENESS_OPTIONS = [
  {
    tier: 1,
    label: "Relax",
    summary: "Vanish 15s, reveal skillShoot only",
    rewardBonus: 0.5,
  },
  {
    tier: 2,
    label: "Half",
    summary: "Vanish 10s, random skill1/skill3/skillShoot",
    rewardBonus: 1,
  },
  {
    tier: 3,
    label: "Full",
    summary: "Move speed +10%, random all except skillShoot, rage enabled",
    rewardBonus: 1.5,
  },
] as const;
const MADA_MAX_REWARD_BONUS =
  MADA_DAMAGE_MULTIPLIER_OPTIONS[MADA_DAMAGE_MULTIPLIER_OPTIONS.length - 1]
    .rewardBonus +
  MADA_HEALTH_OPTIONS[MADA_HEALTH_OPTIONS.length - 1].rewardBonus +
  MADA_COMPLETENESS_OPTIONS[MADA_COMPLETENESS_OPTIONS.length - 1].rewardBonus;

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const resolveMadaSettlementScoreStep = (victory: boolean) =>
  victory ? MADA_SETTLEMENT_SCORE_STEP_VICTORY : MADA_SETTLEMENT_SCORE_STEP_DEFEAT;

const formatDurationLabel = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
};

const cloneRewards = (rewards: SurgeSnackRewards): SurgeSnackRewards => ({
  energy_sugar: rewards.energy_sugar || 0,
  dream_fruit_dust: rewards.dream_fruit_dust || 0,
  core_crunch_seed: rewards.core_crunch_seed || 0,
  star_gel_essence: rewards.star_gel_essence || 0,
});

function MadaEyeGlyph({ active }: { active: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.12),transparent_42%)]" />
      <div
        className={`relative transition duration-300 ${
          active
            ? "scale-100 opacity-100"
            : "scale-[0.98] opacity-75 saturate-[0.82]"
        }`}
      >
        <svg
          viewBox="0 0 280 140"
          className={`h-28 w-56 transition duration-300 ${
            active
              ? "drop-shadow-[0_0_24px_rgba(248,113,113,0.45)]"
              : "drop-shadow-[0_0_16px_rgba(34,211,238,0.18)]"
          }`}
          aria-hidden="true"
        >
          <path
            d="M92 24 L78 8 L90 6 L104 22 Z"
            fill="rgba(8,12,16,0.82)"
          />
          <path
            d="M188 24 L202 8 L190 6 L176 22 Z"
            fill="rgba(8,12,16,0.82)"
          />
          <path
            d="M54 108 C58 68 88 36 140 36 C192 36 222 68 226 108 L54 108 Z"
            fill="rgba(7,12,16,0.94)"
          />
          <ellipse
            cx="140"
            cy="84"
            rx="82"
            ry="24"
            fill={active ? "rgba(127,29,29,0.42)" : "rgba(69,10,10,0.24)"}
          />
          <rect
            x="58"
            y="70"
            width="164"
            height="8"
            rx="4"
            fill={active ? "rgba(185,28,28,0.9)" : "rgba(127,29,29,0.7)"}
          />
          <path
            d="M102 70 L82 56 L86 84 Z"
            fill={active ? "rgba(252,165,165,0.96)" : "rgba(248,113,113,0.82)"}
          />
          <path
            d="M178 70 L198 56 L194 84 Z"
            fill={active ? "rgba(252,165,165,0.96)" : "rgba(248,113,113,0.82)"}
          />
          <ellipse
            cx="140"
            cy="76"
            rx="88"
            ry="22"
            fill="none"
            stroke={active ? "rgba(248,113,113,0.2)" : "rgba(125,211,252,0.14)"}
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
}

export default function MadaCombatClient({
  characterOptions,
  initialCharacterId,
}: MadaCombatClientProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(initialCharacterId);
  const [activeSkillKey, setActiveSkillKey] = useState<"q" | "e" | "r">("q");
  const [hasStarted, setHasStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const [labState, setLabState] = useState<MadaLabState>(createInitialMadaLabState());
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalCode, setTerminalCode] = useState("");
  const [terminalFeedback, setTerminalFeedback] = useState<"idle" | "error">("idle");
  const [terminalUnlocked, setTerminalUnlocked] = useState(false);
  const [unlockDifficultyOpen, setUnlockDifficultyOpen] = useState(false);
  const [madaDamageMultiplier, setMadaDamageMultiplier] = useState(1);
  const [madaMaxHealth, setMadaMaxHealth] = useState<
    (typeof MADA_HEALTH_OPTIONS)[number]["value"]
  >(MADA_HEALTH_OPTIONS[0].value);
  const [madaCompletenessTier, setMadaCompletenessTier] = useState<
    (typeof MADA_COMPLETENESS_OPTIONS)[number]["tier"]
  >(MADA_COMPLETENESS_OPTIONS[0].tier);
  const [battleRewardMultiplier, setBattleRewardMultiplier] = useState<number | null>(
    null
  );
  const [rewardClaimStatus, setRewardClaimStatus] =
    useState<RewardClaimStatus>("idle");
  const [rewardClaimMessage, setRewardClaimMessage] = useState("");
  const [grantedRewards, setGrantedRewards] = useState<SurgeSnackRewards>(
    createEmptySurgeSnackRewards()
  );
  const [rewardScoreStep, setRewardScoreStep] = useState(0);
  const [rewardPackCount, setRewardPackCount] = useState(0);
  const [grantedPointReward, setGrantedPointReward] = useState(0);
  const [endTransitionPhase, setEndTransitionPhase] =
    useState<EndTransitionPhase>("idle");
  const codeResetTimerRef = useRef<number | null>(null);
  const rewardSubmittedRef = useRef(false);
  const endTransitionTimerRef = useRef<number | null>(null);

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

  const selectedDamageOption = useMemo(
    () =>
      MADA_DAMAGE_MULTIPLIER_OPTIONS.find(
        (option) => option.value === madaDamageMultiplier
      ) ?? MADA_DAMAGE_MULTIPLIER_OPTIONS[0],
    [madaDamageMultiplier]
  );

  const selectedHealthOption = useMemo(
    () =>
      MADA_HEALTH_OPTIONS.find((option) => option.value === madaMaxHealth) ??
      MADA_HEALTH_OPTIONS[0],
    [madaMaxHealth]
  );

  const selectedCompletenessOption = useMemo(
    () =>
      MADA_COMPLETENESS_OPTIONS.find(
        (option) => option.tier === madaCompletenessTier
      ) ?? MADA_COMPLETENESS_OPTIONS[0],
    [madaCompletenessTier]
  );

  const configuredRewardMultiplier = useMemo(() => {
    const totalBonus =
      selectedDamageOption.rewardBonus +
      selectedHealthOption.rewardBonus +
      selectedCompletenessOption.rewardBonus;
    return Number((1 + totalBonus).toFixed(2));
  }, [
    selectedDamageOption.rewardBonus,
    selectedHealthOption.rewardBonus,
    selectedCompletenessOption.rewardBonus,
  ]);

  const runtimeRewardMultiplier =
    battleRewardMultiplier ?? configuredRewardMultiplier;
  const hasConfiguredDifficulty = battleRewardMultiplier !== null;
  const showBattleTimePanel =
    terminalUnlocked &&
    (Math.max(0, Math.floor(labState.elapsedSeconds || 0)) > 0 || labState.gameEnded);
  const isBattleEnded = hasStarted && terminalUnlocked && labState.gameEnded;
  const isBattleVictory = isBattleEnded && labState.victory;
  const settlementScore = useMemo(
    () => Math.max(0, Math.floor(labState.score || 0)),
    [labState.score]
  );
  const isSettlementVisible =
    hasStarted && isBattleEnded && endTransitionPhase === "showingResult";
  const shouldRenderBattleSection =
    hasStarted && (!isBattleEnded || endTransitionPhase !== "showingResult");
  const rewardConvertedScoreTarget = useMemo(() => {
    return Math.max(0, Math.floor(settlementScore * runtimeRewardMultiplier));
  }, [runtimeRewardMultiplier, settlementScore]);
  const resolvedRewardScoreStep =
    rewardScoreStep > 0
      ? rewardScoreStep
      : resolveMadaSettlementScoreStep(isBattleVictory);
  const resolvedRewardPackCount = useMemo(() => {
    if (rewardClaimStatus === "claimed") return Math.max(0, rewardPackCount);
    return Math.floor(
      rewardConvertedScoreTarget / Math.max(1, resolvedRewardScoreStep)
    );
  }, [
    rewardClaimStatus,
    rewardConvertedScoreTarget,
    resolvedRewardScoreStep,
    rewardPackCount,
  ]);
  const victoryPointRewardTarget = useMemo(() => {
    if (!isBattleVictory) return 0;
    return Math.max(
      0,
      Math.floor(MADA_VICTORY_POINT_REWARD_BASE * runtimeRewardMultiplier)
    );
  }, [isBattleVictory, runtimeRewardMultiplier]);

  const rewardEntries = useMemo<RewardEntry[]>(() => {
    return SURGE_SNACK_KEYS.filter((key) => grantedRewards[key] > 0).map((key) => ({
      key,
      label: SURGE_SNACK_LABELS[key],
      count: grantedRewards[key],
    }));
  }, [grantedRewards]);

  const difficultyHeatRatio = useMemo(() => {
    const bonus =
      selectedDamageOption.rewardBonus +
      selectedHealthOption.rewardBonus +
      selectedCompletenessOption.rewardBonus;
    const normalized = bonus / Math.max(0.0001, MADA_MAX_REWARD_BONUS);
    return Math.max(0, Math.min(1, normalized));
  }, [
    selectedDamageOption.rewardBonus,
    selectedHealthOption.rewardBonus,
    selectedCompletenessOption.rewardBonus,
  ]);

  const difficultyShellStyle = useMemo<CSSProperties>(() => {
    const upperRed = 0.05 + difficultyHeatRatio * 0.22;
    const sideRed = 0.04 + difficultyHeatRatio * 0.26;
    const lowerRed = 0.12 + difficultyHeatRatio * 0.42;
    const borderRed = 0.1 + difficultyHeatRatio * 0.55;
    const glowRed = 0.08 + difficultyHeatRatio * 0.34;
    return {
      backgroundImage: `linear-gradient(180deg, rgba(127,29,29,${upperRed.toFixed(3)}) 0%, rgba(15,23,42,${sideRed.toFixed(3)}) 46%, rgba(69,10,10,${lowerRed.toFixed(3)}) 100%)`,
      borderColor: `rgba(248,113,113,${borderRed.toFixed(3)})`,
      boxShadow: `0 30px 80px -40px rgba(2,6,23,0.85), 0 0 56px rgba(248,113,113,${glowRed.toFixed(3)})`,
    };
  }, [difficultyHeatRatio]);

  const clearEndTransitionTimer = useCallback(() => {
    if (endTransitionTimerRef.current !== null) {
      window.clearTimeout(endTransitionTimerRef.current);
      endTransitionTimerRef.current = null;
    }
  }, []);

  const handleSceneStateChange = useCallback((state: SceneUiState) => {
    const next = (state as Record<string, MadaLabState | undefined>)[
      MADA_LAB_STATE_KEY
    ];
    if (!next) return;
    setLabState({
      madaHealth: next.madaHealth || 0,
      madaMaxHealth: next.madaMaxHealth || 0,
      elapsedSeconds: next.elapsedSeconds || 0,
      score: next.score || 0,
      damageScore: next.damageScore || 0,
      hitPenaltyCount: next.hitPenaltyCount || 0,
      hitPenaltyScore: next.hitPenaltyScore || 0,
      victoryTimeBonusScore: next.victoryTimeBonusScore || 0,
      gameEnded: Boolean(next.gameEnded),
      victory: Boolean(next.victory),
      playerDead: Boolean(next.playerDead),
      containmentIntegrity: clampPercent(next.containmentIntegrity || 0),
      electricActivity: clampPercent(next.electricActivity || 0),
      fluidPatches: next.fluidPatches || 0,
      circuitBreaks: next.circuitBreaks || 0,
      statusLabel: next.statusLabel || "Containment stabilizing",
      terminalInRange: Boolean(next.terminalInRange),
    });
  }, []);

  useEffect(() => {
    if (!labState.terminalInRange) {
      setTerminalOpen(false);
      setTerminalCode("");
      setTerminalFeedback("idle");
    }
  }, [labState.terminalInRange]);

  useEffect(() => {
    const clearCodeResetTimer = () => {
      if (codeResetTimerRef.current !== null) {
        window.clearTimeout(codeResetTimerRef.current);
        codeResetTimerRef.current = null;
      }
    };

    const submitTerminalCode = (code: string) => {
      if (code !== MADA_UNLOCK_CODE) {
        setTerminalFeedback("error");
        clearCodeResetTimer();
        codeResetTimerRef.current = window.setTimeout(() => {
          setTerminalCode("");
          setTerminalFeedback("idle");
          codeResetTimerRef.current = null;
        }, 420);
        return;
      }

      clearCodeResetTimer();
      setTerminalCode("");
      setTerminalFeedback("idle");
      setTerminalOpen(false);
      setUnlockDifficultyOpen(true);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!hasStarted || event.repeat) {
        return;
      }

      if (unlockDifficultyOpen) {
        return;
      }

      if (
        event.code === "KeyF" &&
        labState.terminalInRange &&
        !terminalUnlocked
      ) {
        event.preventDefault();
        clearCodeResetTimer();
        setTerminalFeedback("idle");
        setTerminalOpen((current) => {
          const next = !current;
          if (!next) {
            setTerminalCode("");
          }
          return next;
        });
        return;
      }

      if (!terminalOpen || terminalUnlocked) {
        return;
      }

      if (event.code === "Backspace") {
        event.preventDefault();
        clearCodeResetTimer();
        setTerminalFeedback("idle");
        setTerminalCode((current) => current.slice(0, -1));
        return;
      }

      if (!/^\d$/.test(event.key)) {
        return;
      }

      event.preventDefault();
      clearCodeResetTimer();
      setTerminalFeedback("idle");
      setTerminalCode((current) => {
        if (current.length >= 4) return current;
        const next = `${current}${event.key}`;
        if (next.length === 4) {
          submitTerminalCode(next);
        }
        return next;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearCodeResetTimer();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    hasStarted,
    labState.terminalInRange,
    terminalOpen,
    terminalUnlocked,
    unlockDifficultyOpen,
  ]);

  useEffect(() => {
    if (!unlockDifficultyOpen) return;
    const blockKeyEvent = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", blockKeyEvent, true);
    window.addEventListener("keyup", blockKeyEvent, true);
    return () => {
      window.removeEventListener("keydown", blockKeyEvent, true);
      window.removeEventListener("keyup", blockKeyEvent, true);
    };
  }, [unlockDifficultyOpen]);

  useEffect(() => {
    if (!unlockDifficultyOpen) return;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    const previousBodyCursor = document.body.style.cursor;
    const previousRootCursor = document.documentElement.style.cursor;
    document.body.style.cursor = "default";
    document.documentElement.style.cursor = "default";
    return () => {
      document.body.style.cursor = previousBodyCursor;
      document.documentElement.style.cursor = previousRootCursor;
    };
  }, [unlockDifficultyOpen]);

  useEffect(() => {
    const lockedRewardMultiplier = battleRewardMultiplier;
    const settledScore = Math.max(0, Math.floor(labState.score || 0));
    const settledVictory = Boolean(labState.victory);
    const settledPointReward = settledVictory
      ? Math.max(
          0,
          Math.floor(
            MADA_VICTORY_POINT_REWARD_BASE * (lockedRewardMultiplier ?? 1)
          )
        )
      : 0;
    if (
      !hasStarted ||
      !isBattleEnded ||
      rewardSubmittedRef.current ||
      lockedRewardMultiplier == null
    ) {
      return;
    }

    rewardSubmittedRef.current = true;
    let disposed = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REWARD_REQUEST_TIMEOUT_MS);

    const claimRewards = async () => {
      setRewardClaimStatus("claiming");
      setRewardClaimMessage("");
      try {
        const response = await fetch("/api/games/reward", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            gameMode: "mochiGeneralBattle",
            score: settledScore,
            victory: settledVictory,
            rewardMultiplier: lockedRewardMultiplier,
            pointReward: settledPointReward,
          }),
        });
        const data = (await response.json()) as RewardClaimResponse;
        if (!response.ok) {
          throw new Error(data.error || "Failed to claim rewards.");
        }
        if (disposed) return;

        const granted = cloneRewards({
          ...createEmptySurgeSnackRewards(),
          ...(data.granted ?? {}),
        });
        const grantedCount = SURGE_SNACK_KEYS.reduce(
          (total, key) => total + granted[key],
          0
        );
        const normalizedPointRewardRaw = Number(data.pointReward);
        const normalizedPointReward =
          Number.isFinite(normalizedPointRewardRaw) && normalizedPointRewardRaw > 0
            ? Math.max(0, Math.floor(normalizedPointRewardRaw))
            : 0;
        const normalizedScoreStepRaw = Number(data.scoreStep);
        const fallbackScoreStep = resolveMadaSettlementScoreStep(settledVictory);
        const normalizedScoreStep =
          Number.isFinite(normalizedScoreStepRaw) && normalizedScoreStepRaw > 0
            ? Math.max(1, Math.floor(normalizedScoreStepRaw))
            : fallbackScoreStep;
        const fallbackPackCount = Math.floor(
          (settledScore * lockedRewardMultiplier) / normalizedScoreStep
        );
        const normalizedPackCountRaw = Number(data.rewardPacks);
        const normalizedPackCount =
          Number.isFinite(normalizedPackCountRaw) && normalizedPackCountRaw >= 0
            ? Math.max(0, Math.floor(normalizedPackCountRaw))
            : Math.max(0, fallbackPackCount);
        setGrantedRewards(granted);
        setRewardScoreStep(normalizedScoreStep);
        setRewardPackCount(normalizedPackCount);
        setGrantedPointReward(normalizedPointReward);
        setRewardClaimStatus("claimed");
        setRewardClaimMessage(
          grantedCount > 0 && normalizedPointReward > 0
            ? "Snacks and point rewards have been added to storage."
            : grantedCount > 0
            ? "Snack rewards have been added to storage."
            : normalizedPointReward > 0
            ? "Point rewards have been added to storage."
            : "No reward gained for this settlement."
        );
      } catch (error) {
        if (disposed) return;
        const isTimeoutError =
          error instanceof DOMException && error.name === "AbortError";
        setRewardClaimStatus("error");
        setRewardClaimMessage(
          isTimeoutError
            ? "Reward request timed out. Please try again."
            : error instanceof Error
              ? error.message
              : "Failed to claim rewards."
        );
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void claimRewards();
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    battleRewardMultiplier,
    hasStarted,
    isBattleEnded,
    labState.score,
    labState.victory,
  ]);

  useEffect(() => {
    if (!hasStarted || !isBattleEnded) {
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
  }, [clearEndTransitionTimer, hasStarted, isBattleEnded]);

  useEffect(() => {
    return () => {
      clearEndTransitionTimer();
    };
  }, [clearEndTransitionTimer]);

  const startGame = useCallback(async () => {
    if (isStarting || !selectedCharacter) return;
    setIsStarting(true);
    rewardSubmittedRef.current = false;
    clearEndTransitionTimer();
    setEndTransitionPhase("idle");
    setRewardClaimStatus("idle");
    setRewardClaimMessage("");
    setGrantedRewards(createEmptySurgeSnackRewards());
    setRewardScoreStep(0);
    setRewardPackCount(0);
    setGrantedPointReward(0);
    setLabState(createInitialMadaLabState());
    setTerminalUnlocked(false);
    setUnlockDifficultyOpen(false);
    setBattleRewardMultiplier(null);
    try {
      await fetch("/api/user/selected-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: selectedCharacter.id }),
      });
    } catch {}
    setHasStarted(true);
    setIsStarting(false);
  }, [clearEndTransitionTimer, isStarting, selectedCharacter]);

  const confirmUnlockAndApplyDifficulty = useCallback(() => {
    setUnlockDifficultyOpen(false);
    setTerminalUnlocked(true);
    setBattleRewardMultiplier(configuredRewardMultiplier);
    window.dispatchEvent(
      new CustomEvent(MADA_TERMINAL_UNLOCK_EVENT, {
        detail: {
          code: MADA_UNLOCK_CODE,
          madaDamageMultiplier,
          madaMaxHealth,
          madaCompletenessTier,
        },
      })
    );
  }, [
    configuredRewardMultiplier,
    madaCompletenessTier,
    madaDamageMultiplier,
    madaMaxHealth,
  ]);

  const loadLabScene = useCallback(async () => {
    const { createMadaLabScene } = await import("./labSceneDefinition");
    return {
      id: "madaLab",
      setupScene: createMadaLabScene,
    };
  }, []);

  const terminalDisplayChars = Array.from({ length: 4 }, (_, index) =>
    terminalCode[index] ?? "\u53e3"
  );

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#02070a] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(120,255,241,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(120,255,241,0.045)_1px,transparent_1px)] bg-[length:34px_34px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(45,212,191,0.18),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_16%,rgba(16,185,129,0.16),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(1,9,13,0.18)_0%,rgba(1,9,13,0.72)_58%,rgba(1,9,13,0.95)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-none flex-col justify-start px-3 pb-2 pt-2 md:px-4">
        <section className="w-full rounded-[32px] border border-cyan-200/12 bg-white/[0.03] px-8 py-6 text-center shadow-[0_0_60px_rgba(16,185,129,0.12)] backdrop-blur-md">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-center text-5xl font-black leading-none tracking-[1.01em] text-cyan-100 md:text-6xl">
              ???
            </h1>
          </div>
        </section>

        {!hasStarted ? (
          <section className="mt-4 flex w-full justify-center">
            <div className="w-full max-w-[1400px] rounded-[30px] border border-white/10 bg-[#0b1119]/95 p-6 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)] backdrop-blur-xl md:p-8">
              {characterOptions.length <= 0 ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-5 text-sm text-rose-200">
                  No available characters to start this game.
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100 md:text-base">
                    Choose Character
                  </p>

                  <div className="grid w-full max-w-[1120px] gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {characterOptions.map((option) => {
                      const selected = option.id === selectedCharacter?.id;
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
                              ? "scale-[1.02] border-cyan-300/70 bg-cyan-400/15 shadow-[0_0_24px_rgba(34,211,238,0.22)]"
                              : "border-white/16 bg-slate-950/65 hover:scale-[1.01] hover:border-white/35"
                          }`}
                        >
                          <p className="text-xl font-semibold text-slate-50 md:text-2xl">
                            {option.label}
                          </p>
                          <p className="mt-2 inline-block rounded-full border border-white/14 bg-cyan-400/16 px-2.5 py-1 text-sm uppercase tracking-[0.2em] text-cyan-50">
                            {option.id}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <aside className="w-full max-w-[760px] rounded-2xl border border-cyan-300/25 bg-[#0a1621]/85 p-4">
                    <div className="flex flex-wrap gap-2">
                      {(selectedCharacter?.skills ?? []).map((skill) => {
                        const selected = skill.key === activeSkillKey;
                        return (
                          <button
                            key={skill.key}
                            type="button"
                            onClick={() => setActiveSkillKey(skill.key)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                              selected
                                ? "border-cyan-300/75 bg-cyan-400/20 text-cyan-50"
                                : "border-white/20 bg-white/5 text-slate-300 hover:border-white/40"
                            }`}
                          >
                            {skill.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-sm text-cyan-50/90">
                      {activeSkill?.description || "No description."}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Basic: {selectedCharacter?.basicAttackDescription || "No description."}
                    </p>
                  </aside>

                  <button
                    type="button"
                    disabled={!selectedCharacter || isStarting}
                    onClick={() => void startGame()}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-8 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStarting ? "Entering..." : "Enter Mada Lab"}
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            {shouldRenderBattleSection ? (
              <section
                className={`relative mt-2 grid min-h-[calc(100dvh-150px)] w-full items-stretch gap-3 transition-[opacity,transform,filter] ease-out xl:grid-cols-[minmax(250px,15vw)_minmax(0,1fr)_minmax(250px,15vw)] ${
                  endTransitionPhase === "fadingScene"
                    ? "pointer-events-none opacity-0 blur-[8px] scale-[0.985]"
                    : "opacity-100 blur-0 scale-100"
                }`}
                style={{ transitionDuration: `${END_SCENE_FADE_OUT_MS}ms` }}
              >
                <aside className="min-h-0">
                  {hasConfiguredDifficulty ? (
                    <div className="flex h-full min-h-0 flex-col rounded-[24px] border border-cyan-200/20 bg-slate-900/75 p-4 shadow-[0_25px_70px_-40px_rgba(2,6,23,0.9)] backdrop-blur-md">
                      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
                        Boss Modifiers
                      </h2>

                      <div className="mt-4 space-y-3">
                        <div className="rounded-xl border border-cyan-200/20 bg-slate-950/65 p-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                            Mada Damage
                          </p>
                          <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-50">
                            {selectedDamageOption.label}
                          </p>
                          <p className="mt-1 text-xs text-emerald-300">
                            Reward +{selectedDamageOption.rewardBonus.toFixed(2)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-cyan-200/20 bg-slate-950/65 p-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                            Mada Max Health
                          </p>
                          <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-50">
                            {selectedHealthOption.label}
                          </p>
                          <p className="mt-1 text-xs text-emerald-300">
                            Reward +{selectedHealthOption.rewardBonus.toFixed(2)}
                          </p>
                        </div>

                        <div className="rounded-xl border border-cyan-200/20 bg-slate-950/65 p-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                            Mada Completeness
                          </p>
                          <p className="mt-1 text-xl font-semibold text-cyan-50">
                            {selectedCompletenessOption.label}
                          </p>
                          <p className="mt-1 text-xs text-sky-200">
                            {selectedCompletenessOption.summary}
                          </p>
                          <p className="mt-1 text-xs text-emerald-300">
                            Reward +{selectedCompletenessOption.rewardBonus.toFixed(2)}
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
                            +{Math.max(0, runtimeRewardMultiplier - 1).toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                          <span className="text-pink-100/80">Reward Multiplier</span>
                          <span className="font-semibold tabular-nums text-pink-100">
                            x{runtimeRewardMultiplier.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </aside>

                <div className="relative flex w-full justify-center">
                  <SceneLauncher
                    gameMode="madacombat"
                    characterPath={selectedCharacter?.path}
                    sceneLoader={loadLabScene}
                    onSceneStateChange={handleSceneStateChange}
                    maxPixelRatio={1.25}
                    antialias={false}
                    enableShadows={false}
                    useDefaultLights={false}
                    className="h-[calc(100dvh-150px)] min-h-[700px] w-full max-w-none overflow-hidden rounded-[30px] border border-white/10 bg-[#02090c] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]"
                  />
                  {labState.terminalInRange && !unlockDifficultyOpen ? (
                    <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-full border border-cyan-300/40 bg-[#021118]/88 px-5 py-2 font-mono text-sm tracking-[0.24em] text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
                      Press [F]
                    </div>
                  ) : null}
                </div>

                <aside className="flex min-h-0 flex-col rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_25px_70px_-40px_rgba(2,6,23,0.9)] backdrop-blur-md">
                  {showBattleTimePanel ? (
                    <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Game Time
                      </p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-100">
                        {formatDurationLabel(labState.elapsedSeconds)}
                      </p>
                    </div>
                  ) : null}

                  <div
                    className={`rounded-[22px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(7,17,24,0.98)_0%,rgba(3,10,14,0.96)_100%)] ${
                      showBattleTimePanel ? "mt-4" : ""
                    }`}
                  >
                    <div className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                        Containment Terminal
                      </p>
                    </div>
                    <div className="h-[248px] overflow-hidden border-t border-cyan-300/10">
                      {terminalOpen && !terminalUnlocked ? (
                        <div className="flex h-full flex-col justify-between px-4 py-4 font-mono text-[12px] leading-6 text-cyan-100">
                          <div className="flex items-center justify-between border-b border-cyan-300/10 pb-3">
                            <div>
                              <p className="font-mono text-sm tracking-[0.22em] text-cyan-100">
                                ACCESS GATE
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-cyan-200/55">
                                Enter authorization code
                              </p>
                            </div>
                            <div className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
                          </div>
                          <div className="flex flex-1 flex-col items-center justify-center">
                            <div className="flex items-center gap-3">
                              {terminalDisplayChars.map((char, index) => (
                                <div
                                  key={`${char}-${index}`}
                                  className={`flex h-14 w-14 items-center justify-center rounded-[14px] border text-2xl tracking-[0.12em] ${
                                    terminalFeedback === "error"
                                      ? "border-red-400/70 text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.18)]"
                                      : "border-cyan-300/24 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.08)]"
                                  } bg-[#02141c]`}
                                >
                                  {char}
                                </div>
                              ))}
                            </div>
                            <p className="mt-5 text-[11px] uppercase tracking-[0.26em] text-cyan-200/55">
                              Input: 4 digits
                            </p>
                            <p
                              className={`mt-2 text-[11px] uppercase tracking-[0.22em] ${
                                terminalFeedback === "error"
                                  ? "text-red-300"
                                  : "text-cyan-300/68"
                              }`}
                            >
                              {terminalFeedback === "error"
                                ? "Invalid code"
                                : "Awaiting authorization"}
                            </p>
                          </div>
                          <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-cyan-200/55">
                            Number keys to enter. Backspace to erase.
                          </p>
                        </div>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_18%,rgba(34,211,238,0.08),transparent_42%),linear-gradient(180deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.24)_100%)] px-4 py-5">
                          {terminalUnlocked ? (
                            <>
                              <div className="flex flex-1 items-center justify-center">
                                <MadaEyeGlyph active />
                              </div>
                              <p className="text-center text-[11px] uppercase tracking-[0.26em] text-red-200/88">
                                EMERGENCY!
                              </p>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-[22px] border border-cyan-200/12 bg-[#071118]/92 p-4 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                      {terminalUnlocked ? "Mada Preview" : "? ? ?"}
                    </p>
                    <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[18px] border border-cyan-300/16 bg-[radial-gradient(circle_at_35%_18%,rgba(34,211,238,0.18),transparent_48%),linear-gradient(180deg,rgba(5,18,24,0.92)_0%,rgba(1,8,10,0.98)_100%)]">
                      {terminalUnlocked ? <MadaPreview /> : null}
                    </div>
                  </div>
                </aside>

                {unlockDifficultyOpen ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[30px] border border-cyan-200/15 bg-[#04090de0] p-6 backdrop-blur-md md:p-8">
                <div
                  className="w-full max-w-[1120px] rounded-[30px] border border-white/10 bg-[#0b1119]/95 p-6 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)] md:p-8"
                  style={difficultyShellStyle}
                >
                  <p className="text-center text-sm font-semibold uppercase tracking-[0.24em] text-slate-200 md:text-base">
                    Battle Difficulty
                  </p>
                  <p className="mt-2 text-center text-xs uppercase tracking-[0.18em] text-slate-300">
                    Mada Damage + Max Health + Completeness (password step)
                  </p>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                      1. Mada Damage Multiplier
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {MADA_DAMAGE_MULTIPLIER_OPTIONS.map((option) => {
                        const selected = option.value === selectedDamageOption.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setMadaDamageMultiplier(option.value)}
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

                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                      2. Mada Max Health
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {MADA_HEALTH_OPTIONS.map((option) => {
                        const selected = option.value === selectedHealthOption.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setMadaMaxHealth(option.value)}
                            className={`rounded-xl border px-4 py-3 text-left transition ${
                              selected
                                ? "border-rose-300/70 bg-rose-400/15 shadow-[0_0_20px_rgba(251,113,133,0.22)]"
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

                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                      3. Mada Completeness
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {MADA_COMPLETENESS_OPTIONS.map((option) => {
                        const selected =
                          option.tier === selectedCompletenessOption.tier;
                        return (
                          <button
                            key={option.tier}
                            type="button"
                            onClick={() => setMadaCompletenessTier(option.tier)}
                            className={`rounded-xl border px-4 py-3 text-left transition ${
                              selected
                                ? "border-red-300/70 bg-red-400/15 shadow-[0_0_20px_rgba(248,113,113,0.22)]"
                                : "border-white/10 bg-slate-950/65 hover:border-white/30"
                            }`}
                          >
                            <p className="text-base font-semibold text-slate-100">
                              {option.label}
                            </p>
                            <p className="mt-1 text-xs text-slate-300">
                              {option.summary}
                            </p>
                            <p className="mt-2 text-xs text-slate-300">
                              Reward +{option.rewardBonus.toFixed(2)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-cyan-300/35 bg-cyan-950/30 px-4 py-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                      Selected
                    </p>
                    <p className="mt-2 text-lg font-semibold text-cyan-50">
                      Damage {selectedDamageOption.label} | HP{" "}
                      {selectedHealthOption.label} |{" "}
                      {selectedCompletenessOption.label}
                    </p>
                    <p className="mt-2 text-4xl font-bold tabular-nums text-cyan-100 md:text-5xl">
                      x{configuredRewardMultiplier.toFixed(2)}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-cyan-100/80">
                      Reward bonus +
                      {(
                        selectedDamageOption.rewardBonus +
                        selectedHealthOption.rewardBonus +
                        selectedCompletenessOption.rewardBonus
                      ).toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setUnlockDifficultyOpen(false)}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-slate-100 transition hover:border-white/45 hover:bg-white/10"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={confirmUnlockAndApplyDifficulty}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-7 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition hover:brightness-105"
                    >
                      Apply and Trigger Breach
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
              </section>
            ) : null}

            {isSettlementVisible ? (
              <section className="mt-4 flex w-full justify-center">
                <div className="w-full max-w-[980px] rounded-[30px] border border-white/10 bg-[#0b1119]/95 p-6 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)] backdrop-blur-xl md:p-8">
                  <p className="text-center text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100 md:text-base">
                    Mada Combat Settlement
                  </p>
                  <h2
                    className={`mt-3 text-center text-3xl font-semibold md:text-4xl ${
                      isBattleVictory ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {isBattleVictory ? "Victory" : "Defeat"}
                  </h2>
                  <p className="mt-2 text-center text-sm text-slate-300">
                    Score = Damage to Mada - Hit penalties + Victory time bonus.
                  </p>
                  <p className="mt-1 text-center text-xs text-slate-400">
                    Reward conversion step:{" "}
                    {isBattleVictory
                      ? `${MADA_SETTLEMENT_SCORE_STEP_VICTORY} score / snack`
                      : `${MADA_SETTLEMENT_SCORE_STEP_DEFEAT} score / snack`}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/12 bg-slate-900/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Damage Score
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-200">
                        +{Math.max(0, Math.floor(labState.damageScore || 0))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/12 bg-slate-900/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Hit Penalty
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-rose-300">
                        -{Math.max(0, Math.floor(labState.hitPenaltyScore || 0))}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Hits: {Math.max(0, Math.floor(labState.hitPenaltyCount || 0))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/12 bg-slate-900/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Victory Time Bonus
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-amber-200">
                        +{Math.max(0, Math.floor(labState.victoryTimeBonusScore || 0))}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Time: {Math.max(0, Math.floor(labState.elapsedSeconds || 0))}s
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/12 bg-slate-900/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Final Score
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">
                        {settlementScore}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/12 bg-slate-900/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Reward Multiplier
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">
                        x{runtimeRewardMultiplier.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/12 bg-slate-900/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Converted Score
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-cyan-200">
                        {rewardConvertedScoreTarget}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/12 bg-slate-900/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Score Step
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">
                        {resolvedRewardScoreStep}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/12 bg-slate-900/55 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Reward Packs
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-amber-200">
                        {resolvedRewardPackCount}
                      </p>
                    </div>
                    {isBattleVictory ? (
                      <div className="rounded-xl border border-white/12 bg-slate-900/55 p-4 sm:col-span-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Victory Point Reward
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-fuchsia-200">
                          {rewardClaimStatus === "claimed"
                            ? grantedPointReward
                            : victoryPointRewardTarget}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 rounded-xl border border-white/12 bg-slate-900/55 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Rewards
                    </p>
                    {rewardClaimStatus === "claiming" ? (
                      <p className="mt-2 text-sm text-cyan-200">
                        Claiming rewards...
                      </p>
                    ) : rewardEntries.length > 0 ? (
                      <ul className="mt-2 space-y-2 text-sm text-slate-100">
                        {rewardEntries.map((entry) => (
                          <li
                            key={entry.key}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                          >
                            <span>{entry.label}</span>
                            <span className="font-semibold tabular-nums">
                              x {entry.count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-400">
                        {rewardClaimStatus === "error"
                          ? "Reward claim failed."
                          : "No snack reward granted."}
                      </p>
                    )}
                    <p
                      className={`mt-3 text-sm ${
                        rewardClaimStatus === "error"
                          ? "text-rose-300"
                          : rewardClaimStatus === "claimed"
                          ? "text-emerald-300"
                          : "text-slate-400"
                      }`}
                    >
                      {rewardClaimStatus === "claiming"
                        ? "Settlement pending..."
                        : rewardClaimMessage || "Settlement pending..."}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link
                      href="/userSystem/user"
                      className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-7 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition hover:brightness-105"
                    >
                      Back to Menu
                    </Link>
                    {isBattleVictory || rewardEntries.length > 0 || grantedPointReward > 0 ? (
                      <Link
                        href="/storage"
                        className="inline-flex h-11 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-semibold text-slate-100 transition hover:border-white/45 hover:bg-white/10"
                      >
                        Open Storage
                      </Link>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
