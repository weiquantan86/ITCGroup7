"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import SceneLauncher from "../../../asset/scenes/general/SceneLauncher";
import type { SceneUiState } from "../../../asset/scenes/general/sceneTypes";
import MochiSoldierPreview from "./MochiSoldierPreview";
import {
  SURGE_SCENE_STATE_KEY,
  SURGE_SNACK_KEYS,
  SURGE_SNACK_LABELS,
  createEmptySurgeSnackRewards,
  createInitialMochiSoldierSurgeState,
  type MochiSoldierSurgeDifficultyConfig,
  type MochiSoldierSurgeState,
  type SurgeSnackRewards,
} from "./surgeConfig";

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

type MochiSoldierSurgeClientProps = {
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
  obtainedSnackBase?: Partial<SurgeSnackRewards>;
  obtainedSnackMultiplierBonus?: Partial<SurgeSnackRewards>;
  winBonus?: Partial<SurgeSnackRewards>;
  winBonusBase?: Partial<SurgeSnackRewards>;
  winBonusMultiplierBonus?: Partial<SurgeSnackRewards>;
};

type LockedSurgeRunConfig = {
  difficultyConfig: MochiSoldierSurgeDifficultyConfig;
  rewardMultiplier: number;
  monsterTotal: number;
  monsterHealthMultiplier: number;
  spawnIntervalMs: number;
  spawnBatchSize: number;
};

const REWARD_LINE_STAGGER_MS = 280;
const REWARD_COUNT_STEP_MS = 90;
const END_SCENE_FADE_OUT_MS = 950;
const REWARD_REQUEST_TIMEOUT_MS = 12_000;

const MONSTER_TOTAL_OPTIONS = [
  { value: 50, label: "50", rewardBonus: 0 },
  { value: 100, label: "100", rewardBonus: 0.1 },
  { value: 150, label: "150", rewardBonus: 0.3 },
  { value: 200, label: "200", rewardBonus: 0.5 },
  { value: 300, label: "300", rewardBonus: 1 },
] as const;

const HEALTH_MULTIPLIER_OPTIONS = [
  { value: 1, label: "x1.0", rewardBonus: 0 },
  { value: 1.1, label: "x1.1", rewardBonus: 0.2 },
  { value: 1.2, label: "x1.2", rewardBonus: 0.4 },
  { value: 1.3, label: "x1.3", rewardBonus: 0.6 },
  { value: 1.4, label: "x1.4", rewardBonus: 0.8 },
  { value: 1.5, label: "x1.5", rewardBonus: 1.0 },
  { value: 1.6, label: "x1.6", rewardBonus: 1.2 },
  { value: 1.7, label: "x1.7", rewardBonus: 1.4 },
  { value: 1.8, label: "x1.8", rewardBonus: 1.6 },
  { value: 1.9, label: "x1.9", rewardBonus: 1.8 },
  { value: 2.0, label: "x2.0", rewardBonus: 2.0 },
] as const;

const SPAWN_INTERVAL_OPTIONS = [
  { valueMs: 5000, label: "5s", rewardBonus: 0 },
  { valueMs: 4000, label: "4s", rewardBonus: 0.3 },
  { valueMs: 3000, label: "3s", rewardBonus: 0.6 },
  { valueMs: 2000, label: "2s", rewardBonus: 0.9 },
  { valueMs: 1000, label: "1s", rewardBonus: 1.2 },
] as const;

const SPAWN_BATCH_OPTIONS = Array.from({ length: 10 }, (_, index) => {
  const value = index + 1;
  return {
    value,
    label: `${value}`,
    rewardBonus: Number(((value - 1) * 0.15).toFixed(2)),
  };
});

const MAX_DIFFICULTY_REWARD_BONUS =
  MONSTER_TOTAL_OPTIONS[MONSTER_TOTAL_OPTIONS.length - 1].rewardBonus +
  HEALTH_MULTIPLIER_OPTIONS[HEALTH_MULTIPLIER_OPTIONS.length - 1].rewardBonus +
  SPAWN_INTERVAL_OPTIONS[SPAWN_INTERVAL_OPTIONS.length - 1].rewardBonus +
  SPAWN_BATCH_OPTIONS[SPAWN_BATCH_OPTIONS.length - 1].rewardBonus;

const cloneRewards = (rewards: SurgeSnackRewards): SurgeSnackRewards => ({
  energy_sugar: rewards.energy_sugar || 0,
  dream_fruit_dust: rewards.dream_fruit_dust || 0,
  core_crunch_seed: rewards.core_crunch_seed || 0,
  star_gel_essence: rewards.star_gel_essence || 0,
});

export default function MochiSoldierSurgeClient({
  characterOptions,
}: MochiSoldierSurgeClientProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    characterOptions[0]?.id ?? ""
  );
  const [activeSkillKey, setActiveSkillKey] = useState<"q" | "e" | "r">("q");
  const [hasConfiguredDifficulty, setHasConfiguredDifficulty] = useState(false);
  const [monsterTotal, setMonsterTotal] = useState(50);
  const [monsterHealthMultiplier, setMonsterHealthMultiplier] = useState(1);
  const [spawnIntervalMs, setSpawnIntervalMs] = useState(5000);
  const [spawnBatchSize, setSpawnBatchSize] = useState(1);
  const [isStarting, setIsStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [deltaStartAtMs, setDeltaStartAtMs] = useState<number | null>(null);
  const [sceneSessionId, setSceneSessionId] = useState(0);
  const [surgeState, setSurgeState] = useState<MochiSoldierSurgeState>(
    createInitialMochiSoldierSurgeState()
  );
  const latestSurgeStateRef = useRef<MochiSoldierSurgeState>(surgeState);
  const [rewardClaimStatus, setRewardClaimStatus] =
    useState<RewardClaimStatus>("idle");
  const [rewardClaimMessage, setRewardClaimMessage] = useState("");
  const [obtainedSnackRewards, setObtainedSnackRewards] = useState<SurgeSnackRewards>(
    createEmptySurgeSnackRewards()
  );
  const [obtainedSnackBaseRewards, setObtainedSnackBaseRewards] =
    useState<SurgeSnackRewards>(createEmptySurgeSnackRewards());
  const [
    obtainedSnackMultiplierBonusRewards,
    setObtainedSnackMultiplierBonusRewards,
  ] = useState<SurgeSnackRewards>(createEmptySurgeSnackRewards());
  const [winBonusRewards, setWinBonusRewards] = useState<SurgeSnackRewards>(
    createEmptySurgeSnackRewards()
  );
  const [winBonusBaseRewards, setWinBonusBaseRewards] = useState<SurgeSnackRewards>(
    createEmptySurgeSnackRewards()
  );
  const [winBonusMultiplierBonusRewards, setWinBonusMultiplierBonusRewards] =
    useState<SurgeSnackRewards>(createEmptySurgeSnackRewards());
  const [revealedObtainedLines, setRevealedObtainedLines] = useState(0);
  const [revealedWinBonusLines, setRevealedWinBonusLines] = useState(0);
  const [obtainedAnimatedCounts, setObtainedAnimatedCounts] = useState<
    Record<string, number>
  >({});
  const [winBonusAnimatedCounts, setWinBonusAnimatedCounts] = useState<
    Record<string, number>
  >({});
  const [endTransitionPhase, setEndTransitionPhase] =
    useState<EndTransitionPhase>("idle");
  const rewardSubmittedRef = useRef(false);
  const rewardAnimationTimersRef = useRef<number[]>([]);
  const endTransitionTimerRef = useRef<number | null>(null);
  const [lockedRunConfig, setLockedRunConfig] =
    useState<LockedSurgeRunConfig | null>(null);
  const lockedRunConfigRef = useRef<LockedSurgeRunConfig | null>(null);

  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId) return characterOptions[0] ?? null;
    return (
      characterOptions.find((option) => option.id === selectedCharacterId) ??
      characterOptions[0] ??
      null
    );
  }, [characterOptions, selectedCharacterId]);

  useEffect(() => {
    latestSurgeStateRef.current = surgeState;
  }, [surgeState]);

  const activeSkill = useMemo(() => {
    if (!selectedCharacter) return null;
    return (
      selectedCharacter.skills.find((skill) => skill.key === activeSkillKey) ??
      selectedCharacter.skills[0] ??
      null
    );
  }, [activeSkillKey, selectedCharacter]);

  const selectedTotalOption = useMemo(() => {
    return (
      MONSTER_TOTAL_OPTIONS.find((option) => option.value === monsterTotal) ??
      MONSTER_TOTAL_OPTIONS[0]
    );
  }, [monsterTotal]);

  const selectedHealthOption = useMemo(() => {
    return (
      HEALTH_MULTIPLIER_OPTIONS.find(
        (option) => option.value === monsterHealthMultiplier
      ) ?? HEALTH_MULTIPLIER_OPTIONS[0]
    );
  }, [monsterHealthMultiplier]);

  const selectedIntervalOption = useMemo(() => {
    return (
      SPAWN_INTERVAL_OPTIONS.find((option) => option.valueMs === spawnIntervalMs) ??
      SPAWN_INTERVAL_OPTIONS[0]
    );
  }, [spawnIntervalMs]);

  const selectedBatchOption = useMemo(() => {
    return (
      SPAWN_BATCH_OPTIONS.find((option) => option.value === spawnBatchSize) ??
      SPAWN_BATCH_OPTIONS[0]
    );
  }, [spawnBatchSize]);

  const rewardMultiplier = useMemo(() => {
    const value =
      1 +
      selectedTotalOption.rewardBonus +
      selectedHealthOption.rewardBonus +
      selectedIntervalOption.rewardBonus +
      selectedBatchOption.rewardBonus;
    return Math.round(value * 100) / 100;
  }, [
    selectedBatchOption.rewardBonus,
    selectedHealthOption.rewardBonus,
    selectedIntervalOption.rewardBonus,
    selectedTotalOption.rewardBonus,
  ]);

  const difficultyHeatRatio = useMemo(() => {
    const normalized =
      (rewardMultiplier - 1) / Math.max(0.00001, MAX_DIFFICULTY_REWARD_BONUS);
    return Math.min(1, Math.max(0, normalized));
  }, [rewardMultiplier]);

  const rewardGoldRatio = useMemo(() => {
    const normalized =
      (rewardMultiplier - 1) / Math.max(0.00001, MAX_DIFFICULTY_REWARD_BONUS);
    return Math.min(1, Math.max(0, normalized));
  }, [rewardMultiplier]);

  const rewardGoldLineStyle = useMemo<CSSProperties>(() => {
    return {
      borderColor: `rgba(251,191,36,${(0.28 + rewardGoldRatio * 0.36).toFixed(3)})`,
      backgroundColor: `rgba(245,158,11,${(0.1 + rewardGoldRatio * 0.18).toFixed(3)})`,
      color: `rgba(255,248,220,${(0.88 + rewardGoldRatio * 0.12).toFixed(3)})`,
      boxShadow: `0 0 28px rgba(251,191,36,${(0.14 + rewardGoldRatio * 0.36).toFixed(3)})`,
    };
  }, [rewardGoldRatio]);

  const rewardGoldLineActiveStyle = useMemo<CSSProperties>(() => {
    return {
      borderColor: `rgba(252,211,77,${(0.45 + rewardGoldRatio * 0.42).toFixed(3)})`,
      backgroundColor: `rgba(245,158,11,${(0.2 + rewardGoldRatio * 0.24).toFixed(3)})`,
      color: "rgba(255,251,235,0.98)",
      boxShadow: `0 0 34px rgba(251,191,36,${(0.24 + rewardGoldRatio * 0.44).toFixed(3)})`,
    };
  }, [rewardGoldRatio]);

  const rewardGoldPillStyle = useMemo<CSSProperties>(() => {
    return {
      backgroundColor: `rgba(234,179,8,${(0.2 + rewardGoldRatio * 0.26).toFixed(3)})`,
      color: "rgba(255,251,235,0.98)",
      boxShadow: `0 0 16px rgba(251,191,36,${(0.16 + rewardGoldRatio * 0.3).toFixed(3)})`,
    };
  }, [rewardGoldRatio]);

  const rewardGoldPillActiveStyle = useMemo<CSSProperties>(() => {
    return {
      backgroundColor: `rgba(250,204,21,${(0.3 + rewardGoldRatio * 0.34).toFixed(3)})`,
      color: "rgba(255,255,255,0.98)",
      boxShadow: `0 0 20px rgba(252,211,77,${(0.24 + rewardGoldRatio * 0.36).toFixed(3)})`,
    };
  }, [rewardGoldRatio]);

  const difficultyShellStyle = useMemo<CSSProperties>(() => {
    const upperRed = 0.04 + difficultyHeatRatio * 0.2;
    const sideRed = 0.03 + difficultyHeatRatio * 0.24;
    const lowerRed = 0.1 + difficultyHeatRatio * 0.38;
    const borderRed = 0.08 + difficultyHeatRatio * 0.52;
    const glowRed = 0.08 + difficultyHeatRatio * 0.32;
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
    const intensity = Math.min(1, Math.max(0, (rewardMultiplier - 1) / 3));
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

  const surgeDifficultyConfig = useMemo<MochiSoldierSurgeDifficultyConfig>(() => {
    return {
      totalMonsters: monsterTotal,
      healthMultiplier: monsterHealthMultiplier,
      spawnIntervalMs,
      spawnBatchSize,
    };
  }, [monsterHealthMultiplier, monsterTotal, spawnBatchSize, spawnIntervalMs]);

  const runtimeRewardMultiplier =
    lockedRunConfig?.rewardMultiplier ?? rewardMultiplier;
  const runtimeSurgeDifficultyConfig =
    lockedRunConfig?.difficultyConfig ?? surgeDifficultyConfig;
  const runtimeMonsterTotal = lockedRunConfig?.monsterTotal ?? monsterTotal;
  const runtimeMonsterHealthMultiplier =
    lockedRunConfig?.monsterHealthMultiplier ?? monsterHealthMultiplier;
  const runtimeSpawnIntervalMs = lockedRunConfig?.spawnIntervalMs ?? spawnIntervalMs;
  const runtimeSpawnBatchSize = lockedRunConfig?.spawnBatchSize ?? spawnBatchSize;
  const runtimeSelectedTotalOption = useMemo(() => {
    return (
      MONSTER_TOTAL_OPTIONS.find((option) => option.value === runtimeMonsterTotal) ??
      MONSTER_TOTAL_OPTIONS[0]
    );
  }, [runtimeMonsterTotal]);
  const runtimeSelectedHealthOption = useMemo(() => {
    return (
      HEALTH_MULTIPLIER_OPTIONS.find(
        (option) => option.value === runtimeMonsterHealthMultiplier
      ) ?? HEALTH_MULTIPLIER_OPTIONS[0]
    );
  }, [runtimeMonsterHealthMultiplier]);
  const runtimeSelectedIntervalOption = useMemo(() => {
    return (
      SPAWN_INTERVAL_OPTIONS.find(
        (option) => option.valueMs === runtimeSpawnIntervalMs
      ) ?? SPAWN_INTERVAL_OPTIONS[0]
    );
  }, [runtimeSpawnIntervalMs]);
  const runtimeSelectedBatchOption = useMemo(() => {
    return (
      SPAWN_BATCH_OPTIONS.find((option) => option.value === runtimeSpawnBatchSize) ??
      SPAWN_BATCH_OPTIONS[0]
    );
  }, [runtimeSpawnBatchSize]);

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

  const handleSceneStateChange = useCallback((state: SceneUiState) => {
    const next = (state as Record<string, MochiSoldierSurgeState | undefined>)[
      SURGE_SCENE_STATE_KEY
    ];
    if (!next) return;
    setSurgeState({
      totalMonsters: next.totalMonsters || 0,
      spawnedMonsters: next.spawnedMonsters || 0,
      aliveMonsters: next.aliveMonsters || 0,
      defeatedMonsters: next.defeatedMonsters || 0,
      playerDead: Boolean(next.playerDead),
      gameEnded: Boolean(next.gameEnded),
      victory: Boolean(next.victory),
    });
  }, []);

  const clearEndTransitionTimer = useCallback(() => {
    if (endTransitionTimerRef.current !== null) {
      window.clearTimeout(endTransitionTimerRef.current);
      endTransitionTimerRef.current = null;
    }
  }, []);

  const resetRunUi = useCallback(() => {
    clearEndTransitionTimer();
    setSurgeState(createInitialMochiSoldierSurgeState());
    setRewardClaimStatus("idle");
    setRewardClaimMessage("");
    setObtainedSnackRewards(createEmptySurgeSnackRewards());
    setObtainedSnackBaseRewards(createEmptySurgeSnackRewards());
    setObtainedSnackMultiplierBonusRewards(createEmptySurgeSnackRewards());
    setWinBonusRewards(createEmptySurgeSnackRewards());
    setWinBonusBaseRewards(createEmptySurgeSnackRewards());
    setWinBonusMultiplierBonusRewards(createEmptySurgeSnackRewards());
    setRevealedObtainedLines(0);
    setRevealedWinBonusLines(0);
    setObtainedAnimatedCounts({});
    setWinBonusAnimatedCounts({});
    setEndTransitionPhase("idle");
    rewardSubmittedRef.current = false;
  }, [clearEndTransitionTimer]);

  const startGame = async () => {
    if (isStarting || !selectedCharacter || !hasConfiguredDifficulty) return;
    const nextLockedRunConfig: LockedSurgeRunConfig = {
      difficultyConfig: {
        totalMonsters: surgeDifficultyConfig.totalMonsters,
        healthMultiplier: surgeDifficultyConfig.healthMultiplier,
        spawnIntervalMs: surgeDifficultyConfig.spawnIntervalMs,
        spawnBatchSize: surgeDifficultyConfig.spawnBatchSize,
      },
      rewardMultiplier,
      monsterTotal,
      monsterHealthMultiplier,
      spawnIntervalMs,
      spawnBatchSize,
    };
    lockedRunConfigRef.current = nextLockedRunConfig;
    setLockedRunConfig(nextLockedRunConfig);
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
    const { createMochiSoldierSurgeScene } = await import("./surgeSceneDefinition");
    const effectiveDifficultyConfig =
      lockedRunConfigRef.current?.difficultyConfig ?? runtimeSurgeDifficultyConfig;
    return {
      id: "mochiSoldierSurge",
      setupScene: (
        scene: Parameters<typeof createMochiSoldierSurgeScene>[0],
        context?: Parameters<typeof createMochiSoldierSurgeScene>[1]
      ) =>
        createMochiSoldierSurgeScene(scene, context, effectiveDifficultyConfig),
    };
  }, [runtimeSurgeDifficultyConfig]);

  useEffect(() => {
    const lockedRewardMultiplier =
      lockedRunConfigRef.current?.rewardMultiplier ??
      lockedRunConfig?.rewardMultiplier;
    if (
      !hasStarted ||
      !surgeState.gameEnded ||
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
      const settledState = latestSurgeStateRef.current;
      setRewardClaimStatus("claiming");
      setRewardClaimMessage("");
      try {
        const response = await fetch("/api/games/reward", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            defeatedMonsters: settledState.defeatedMonsters,
            victory: settledState.victory,
            rewardMultiplier: lockedRewardMultiplier,
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
        const obtainedSnack = cloneRewards({
          ...createEmptySurgeSnackRewards(),
          ...(data.obtainedSnack ?? {}),
        });
        const obtainedSnackBase = cloneRewards({
          ...createEmptySurgeSnackRewards(),
          ...(data.obtainedSnackBase ?? data.obtainedSnack ?? {}),
        });
        const obtainedSnackMultiplierBonus = cloneRewards({
          ...createEmptySurgeSnackRewards(),
          ...(data.obtainedSnackMultiplierBonus ?? {}),
        });
        const winBonus = cloneRewards({
          ...createEmptySurgeSnackRewards(),
          ...(data.winBonus ?? {}),
        });
        const winBonusBase = cloneRewards({
          ...createEmptySurgeSnackRewards(),
          ...(data.winBonusBase ?? data.winBonus ?? {}),
        });
        const winBonusMultiplierBonus = cloneRewards({
          ...createEmptySurgeSnackRewards(),
          ...(data.winBonusMultiplierBonus ?? {}),
        });
        const grantedCount = SURGE_SNACK_KEYS.reduce(
          (total, key) => total + granted[key],
          0
        );
        setObtainedSnackRewards(obtainedSnack);
        setObtainedSnackBaseRewards(obtainedSnackBase);
        setObtainedSnackMultiplierBonusRewards(obtainedSnackMultiplierBonus);
        setWinBonusRewards(winBonus);
        setWinBonusBaseRewards(winBonusBase);
        setWinBonusMultiplierBonusRewards(winBonusMultiplierBonus);
        setRewardClaimStatus("claimed");
        if (grantedCount <= 0) {
          setRewardClaimMessage("No snack reward earned in this run.");
        } else {
          setRewardClaimMessage("Snack rewards have been added to storage.");
        }
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
    hasStarted,
    surgeState.gameEnded,
    lockedRunConfig,
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

    if (!isSettlementVisible || rewardClaimStatus !== "claimed") return;

    const animateRewardEntries = (
      entries: RewardEntry[],
      baseRewards: SurgeSnackRewards,
      multiplierBonusRewards: SurgeSnackRewards,
      setRevealedLines: Dispatch<SetStateAction<number>>,
      setAnimatedCounts: Dispatch<SetStateAction<Record<string, number>>>,
      startDelayMs: number
    ) => {
      entries.forEach((entry, index) => {
        const revealTimer = window.setTimeout(() => {
          const baseCount = Math.max(0, Math.floor(baseRewards[entry.key] ?? 0));
          const multiplierBonusCount = Math.max(
            0,
            Math.floor(multiplierBonusRewards[entry.key] ?? 0)
          );
          setRevealedLines((prev) => Math.max(prev, index + 1));
          setAnimatedCounts((prev) => ({ ...prev, [entry.key]: baseCount }));
          if (multiplierBonusCount <= 0) return;

          let appliedBonus = 0;
          const countTimer = window.setInterval(() => {
            appliedBonus += 1;
            if (appliedBonus >= multiplierBonusCount) {
              appliedBonus = multiplierBonusCount;
              window.clearInterval(countTimer);
            }
            setAnimatedCounts((prev) => ({
              ...prev,
              [entry.key]: baseCount + appliedBonus,
            }));
          }, REWARD_COUNT_STEP_MS);
          rewardAnimationTimersRef.current.push(countTimer);
        }, startDelayMs + index * REWARD_LINE_STAGGER_MS);
        rewardAnimationTimersRef.current.push(revealTimer);
      });
    };

    animateRewardEntries(
      obtainedSnackEntries,
      obtainedSnackBaseRewards,
      obtainedSnackMultiplierBonusRewards,
      setRevealedObtainedLines,
      setObtainedAnimatedCounts,
      0
    );

    const winStartDelay =
      Math.max(1, obtainedSnackEntries.length) * REWARD_LINE_STAGGER_MS + 220;
    animateRewardEntries(
      winBonusEntries,
      winBonusBaseRewards,
      winBonusMultiplierBonusRewards,
      setRevealedWinBonusLines,
      setWinBonusAnimatedCounts,
      winStartDelay
    );

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
    obtainedSnackBaseRewards,
    obtainedSnackMultiplierBonusRewards,
    winBonusEntries,
    winBonusBaseRewards,
    winBonusMultiplierBonusRewards,
  ]);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#05070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_25%,rgba(251,146,60,0.46),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(96,165,250,0.4),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.62)_48%,rgba(2,6,23,0.86)_68%,rgba(2,6,23,0.95)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-none flex-col justify-start px-3 pb-2 pt-2 md:px-4">
        <section className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-center shadow-[0_0_52px_rgba(59,130,246,0.18)] backdrop-blur-md">
          <h1 className="bg-gradient-to-r from-orange-400 via-pink-500 to-sky-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            Mochi Soldier Surge
          </h1>
        </section>

        {hasStarted ? (
          <>
            {shouldRenderBattleSection ? (
              <section
                className={`mt-2 grid h-[calc(100dvh-150px)] min-h-[700px] w-full items-stretch gap-3 overflow-hidden transition-[opacity,transform,filter] ease-out xl:grid-cols-[minmax(250px,15vw)_minmax(0,1fr)_minmax(250px,15vw)] ${
                  surgeState.gameEnded
                    ? "pointer-events-none opacity-0 blur-[8px] scale-[0.985]"
                    : "opacity-100 blur-0 scale-100"
                }`}
                style={{ transitionDuration: `${END_SCENE_FADE_OUT_MS}ms` }}
              >
                <aside className="flex min-h-0 flex-col overflow-y-auto rounded-[24px] border border-cyan-200/20 bg-slate-900/75 p-4 shadow-[0_25px_70px_-40px_rgba(2,6,23,0.9)] backdrop-blur-md">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
                    Challenge Modifiers
                  </h2>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-cyan-200/20 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                        Total Monsters
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-50">
                        {runtimeMonsterTotal}
                      </p>
                      <p className="mt-1 text-xs text-emerald-300">
                        Reward +{runtimeSelectedTotalOption.rewardBonus.toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-cyan-200/20 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                        Health Multiplier
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-50">
                        x{runtimeMonsterHealthMultiplier.toFixed(1)}
                      </p>
                      <p className="mt-1 text-xs text-emerald-300">
                        Reward +{runtimeSelectedHealthOption.rewardBonus.toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-cyan-200/20 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                        Spawn Interval
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-50">
                        {(runtimeSpawnIntervalMs / 1000).toFixed(0)}s
                      </p>
                      <p className="mt-1 text-xs text-emerald-300">
                        Reward +{runtimeSelectedIntervalOption.rewardBonus.toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-cyan-200/20 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                        Spawn Per Wave
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-50">
                        {runtimeSpawnBatchSize}
                      </p>
                      <p className="mt-1 text-xs text-emerald-300">
                        Reward +{runtimeSelectedBatchOption.rewardBonus.toFixed(2)}
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
                </aside>

                <div className="relative flex w-full justify-center">
                  <SceneLauncher
                    key={sceneSessionId}
                    gameMode="mochisoldiersurge"
                    characterPath={selectedCharacter?.path}
                    sceneLoader={loadSurgeScene}
                    deltaStartAtMs={deltaStartAtMs ?? undefined}
                    onSceneStateChange={handleSceneStateChange}
                    maxPixelRatio={1.25}
                    antialias={false}
                    className="h-[calc(100dvh-150px)] min-h-[700px] w-full max-w-none overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1119] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]"
                  />
                </div>

                <aside className="flex min-h-0 flex-col overflow-y-auto rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_25px_70px_-40px_rgba(2,6,23,0.9)] backdrop-blur-md">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Counter
                  </h2>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Defeated
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">
                        {surgeState.defeatedMonsters}/{surgeState.totalMonsters}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Spawned
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-cyan-200">
                        {surgeState.spawnedMonsters}/{surgeState.totalMonsters}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/65 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Alive Now
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-amber-200">
                        {surgeState.aliveMonsters}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/65 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                      Settlement Rule
                    </p>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-slate-100">
                      Base: every 5 kills gives 1 random snack.
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-300">
                      Full clear bonus: +3 random snacks.
                    </p>
                    <p className="mt-2 text-sm font-semibold text-emerald-300">
                      Current multiplier: x{runtimeRewardMultiplier.toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-4 flex min-h-[360px] flex-1 flex-col rounded-xl border border-white/10 bg-slate-950/65 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Mochi Soldier
                    </p>
                    <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_28%_18%,rgba(56,189,248,0.2),transparent_54%),linear-gradient(180deg,rgba(2,6,23,0.85)_0%,rgba(2,6,23,0.98)_100%)]">
                      <MochiSoldierPreview />
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
                      ? `All ${surgeState.totalMonsters} Mochi Soldiers Defeated`
                      : "Player Eliminated"}
                  </h3>

                  <div className="mt-8 rounded-[22px] border border-white/10 bg-slate-950/70 p-6 text-center md:p-8">
                    <p className="text-2xl font-semibold text-slate-200 md:text-3xl">Numbers Killed:</p>
                    <p className="mt-2 text-4xl font-semibold tabular-nums text-slate-100 md:text-5xl">
                      {surgeState.defeatedMonsters}
                    </p>

                    <p className="mt-8 text-2xl font-semibold text-slate-200 md:text-3xl">Obtained Snack:</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Base x1.00 first, then multiplier x{runtimeRewardMultiplier.toFixed(2)} adds bonus one by one.
                    </p>
                    {rewardClaimStatus === "claiming" ? (
                      <p className="mt-3 text-xl text-slate-300">Calculating...</p>
                    ) : obtainedSnackEntries.length === 0 ? (
                      <p className="mt-3 text-xl text-slate-300">None</p>
                    ) : (
                      <ul className="mt-4 space-y-3 text-xl md:text-2xl">
                        {obtainedSnackEntries.slice(0, revealedObtainedLines).map((entry) => {
                          const baseCount = obtainedSnackBaseRewards[entry.key] ?? 0;
                          const multiplierBonusCount =
                            obtainedSnackMultiplierBonusRewards[entry.key] ?? 0;
                          const shownCount = obtainedAnimatedCounts[entry.key] ?? baseCount;
                          const isApplyingMultiplier =
                            multiplierBonusCount > 0 && shownCount < entry.count;
                          const hasMultiplierBonus =
                            runtimeRewardMultiplier > 1 && multiplierBonusCount > 0;
                          return (
                            <li
                              key={entry.key}
                              className={`mx-auto flex max-w-[680px] items-center justify-center gap-3 rounded-xl border px-5 py-3 transition ${
                                !hasMultiplierBonus && isApplyingMultiplier
                                  ? "border-cyan-300/45 bg-cyan-500/12 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.24)]"
                                  : "border-white/12 bg-white/[0.03] text-slate-100"
                              }`}
                              style={
                                hasMultiplierBonus
                                  ? isApplyingMultiplier
                                    ? rewardGoldLineActiveStyle
                                    : rewardGoldLineStyle
                                  : undefined
                              }
                            >
                              <span className="font-semibold">
                                {entry.label}
                                {hasMultiplierBonus ? (
                                  <span className="ml-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/85">
                                    base {baseCount} + bonus{" "}
                                    {Math.max(0, shownCount - baseCount)}/{multiplierBonusCount}
                                  </span>
                                ) : null}
                              </span>
                              <span
                                className={`inline-flex min-w-[96px] items-center justify-center rounded-full px-3 py-1 text-lg font-bold tabular-nums ${
                                  !hasMultiplierBonus && isApplyingMultiplier
                                    ? "animate-pulse bg-cyan-300/25 text-cyan-100"
                                    : "bg-slate-100/12 text-slate-100"
                                }`}
                                style={
                                  hasMultiplierBonus
                                    ? isApplyingMultiplier
                                      ? rewardGoldPillActiveStyle
                                      : rewardGoldPillStyle
                                    : undefined
                                }
                              >
                                x {shownCount}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <p className="mt-8 text-2xl font-semibold text-slate-200 md:text-3xl">Win Bonus:</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Base x1.00 first, then multiplier x{runtimeRewardMultiplier.toFixed(2)} adds bonus one by one.
                    </p>
                    {rewardClaimStatus === "claiming" ? (
                      <p className="mt-3 text-xl text-slate-300">Calculating...</p>
                    ) : winBonusEntries.length === 0 ? (
                      <p className="mt-3 text-xl text-slate-300">None</p>
                    ) : (
                      <ul className="mt-4 space-y-3 text-xl md:text-2xl">
                        {winBonusEntries.slice(0, revealedWinBonusLines).map((entry) => {
                          const baseCount = winBonusBaseRewards[entry.key] ?? 0;
                          const multiplierBonusCount =
                            winBonusMultiplierBonusRewards[entry.key] ?? 0;
                          const shownCount = winBonusAnimatedCounts[entry.key] ?? baseCount;
                          const isApplyingMultiplier =
                            multiplierBonusCount > 0 && shownCount < entry.count;
                          const hasMultiplierBonus =
                            runtimeRewardMultiplier > 1 && multiplierBonusCount > 0;
                          return (
                            <li
                              key={entry.key}
                              className={`mx-auto flex max-w-[680px] items-center justify-center gap-3 rounded-xl border px-5 py-3 transition ${
                                !hasMultiplierBonus && isApplyingMultiplier
                                  ? "border-amber-300/45 bg-amber-500/12 text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.2)]"
                                  : "border-white/12 bg-white/[0.03] text-slate-100"
                              }`}
                              style={
                                hasMultiplierBonus
                                  ? isApplyingMultiplier
                                    ? rewardGoldLineActiveStyle
                                    : rewardGoldLineStyle
                                  : undefined
                              }
                            >
                              <span className="font-semibold">
                                {entry.label}
                                {hasMultiplierBonus ? (
                                  <span className="ml-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/85">
                                    base {baseCount} + bonus{" "}
                                    {Math.max(0, shownCount - baseCount)}/{multiplierBonusCount}
                                  </span>
                                ) : null}
                              </span>
                              <span
                                className={`inline-flex min-w-[96px] items-center justify-center rounded-full px-3 py-1 text-lg font-bold tabular-nums ${
                                  !hasMultiplierBonus && isApplyingMultiplier
                                    ? "animate-pulse bg-amber-300/25 text-amber-100"
                                    : "bg-slate-100/12 text-slate-100"
                                }`}
                                style={
                                  hasMultiplierBonus
                                    ? isApplyingMultiplier
                                      ? rewardGoldPillActiveStyle
                                      : rewardGoldPillStyle
                                    : undefined
                                }
                              >
                                x {shownCount}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <p
                      className={`mt-6 text-base md:text-lg ${
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
                    style={{
                      color: `rgba(254,226,226,${(0.58 + difficultyHeatRatio * 0.34).toFixed(3)})`,
                    }}
                  >
                    Battle Difficulty
                  </p>
                  <div className="mt-6 space-y-4">
                    <div
                      className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                      style={difficultySectionStyle}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                        1. Total Mochi Soldiers
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {MONSTER_TOTAL_OPTIONS.map((option) => {
                          const selected = option.value === monsterTotal;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setMonsterTotal(option.value)}
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

                    <div
                      className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                      style={difficultySectionStyle}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                        2. Mochi Soldier Health Multiplier
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {HEALTH_MULTIPLIER_OPTIONS.map((option) => {
                          const selected = option.value === monsterHealthMultiplier;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setMonsterHealthMultiplier(option.value)}
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

                    <div
                      className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                      style={difficultySectionStyle}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                        3. Spawn Interval
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {SPAWN_INTERVAL_OPTIONS.map((option) => {
                          const selected = option.valueMs === spawnIntervalMs;
                          return (
                            <button
                              key={option.valueMs}
                              type="button"
                              onClick={() => setSpawnIntervalMs(option.valueMs)}
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

                    <div
                      className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                      style={difficultySectionStyle}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                        4. Spawn Per Interval
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {SPAWN_BATCH_OPTIONS.map((option) => {
                          const selected = option.value === spawnBatchSize;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setSpawnBatchSize(option.value)}
                              className={`rounded-xl border px-4 py-3 text-left transition ${
                                selected
                                  ? "border-violet-300/70 bg-violet-400/15 shadow-[0_0_20px_rgba(167,139,250,0.22)]"
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
                      style={{
                        color: `rgba(254,226,226,${(0.72 + difficultyHeatRatio * 0.24).toFixed(3)})`,
                      }}
                    >
                      Reward Multiplier
                    </p>
                    <p
                      className="mt-2 text-4xl font-bold tabular-nums text-cyan-100 md:text-5xl"
                      style={{
                        color: `rgba(255,241,242,${(0.88 + difficultyHeatRatio * 0.12).toFixed(3)})`,
                      }}
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
                      disabled={isStarting}
                      onClick={() => setHasConfiguredDifficulty(false)}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-cyan-100/35 bg-slate-900/40 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-50 transition hover:border-cyan-100/55 hover:bg-cyan-100/10 disabled:cursor-not-allowed disabled:opacity-60"
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
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setSelectedCharacterId(option.id);
                                setActiveSkillKey("q");
                              }}
                              className={`rounded-2xl border px-6 py-6 text-center transition duration-300 ${
                                selected ? "scale-[1.02]" : "hover:scale-[1.01]"
                              }`}
                              style={
                                selected
                                  ? {
                                      borderColor: "rgba(103,232,249,0.78)",
                                      backgroundImage:
                                        "linear-gradient(152deg, rgba(14,116,144,0.62) 0%, rgba(59,130,246,0.34) 46%, rgba(236,72,153,0.28) 100%)",
                                      boxShadow:
                                        "0 0 34px rgba(56,189,248,0.32), inset 0 0 0 1px rgba(255,255,255,0.08)",
                                    }
                                  : {
                                      borderColor: "rgba(255,255,255,0.16)",
                                      backgroundImage:
                                        index % 2 === 0
                                          ? "linear-gradient(152deg, rgba(15,23,42,0.88) 0%, rgba(30,64,175,0.2) 52%, rgba(79,70,229,0.16) 100%)"
                                          : "linear-gradient(152deg, rgba(15,23,42,0.88) 0%, rgba(21,128,61,0.2) 52%, rgba(6,182,212,0.15) 100%)",
                                    }
                              }
                            >
                              <p className="text-xl font-semibold text-slate-50 md:text-2xl">
                                {option.label}
                              </p>
                              <p className="mt-2 text-sm uppercase tracking-[0.22em] text-slate-200">
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
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setActiveSkillKey(key)}
                              className={`rounded-lg border px-2 py-2 text-xs font-semibold uppercase transition ${
                                isActive
                                  ? "border-sky-300/70 bg-sky-500/20 text-sky-100"
                                  : "border-white/15 bg-slate-950/65 text-slate-200 hover:border-white/35"
                              }`}
                            >
                              {key.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 p-3">
                        <p className="text-sm font-semibold text-slate-100">
                          {activeSkill?.label ?? "Skill"}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                          {activeSkill?.description || "No description."}
                        </p>
                      </div>

                      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Basic Attack
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">
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
                      className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-8 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
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
      `}</style>
    </main>
  );
}
