"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SceneLauncher from "../../../asset/scenes/general/SceneLauncher";
import type { SceneUiState } from "../../../asset/scenes/general/sceneTypes";
import MochiGeneralPreview from "./MochiGeneralPreview";
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

const REWARD_LINE_STAGGER_MS = 280;
const REWARD_COUNT_STEP_MS = 90;

const cloneRewards = (rewards: SurgeSnackRewards): SurgeSnackRewards => ({
  energy_sugar: rewards.energy_sugar || 0,
  dream_fruit_dust: rewards.dream_fruit_dust || 0,
  core_crunch_seed: rewards.core_crunch_seed || 0,
  star_gel_essence: rewards.star_gel_essence || 0,
});

export default function MochiGeneralBattleClient({
  characterOptions,
}: MochiGeneralBattleClientProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    characterOptions[0]?.id ?? ""
  );
  const [activeSkillKey, setActiveSkillKey] = useState<"q" | "e" | "r">("q");
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
  const rewardSubmittedRef = useRef(false);
  const rewardAnimationTimersRef = useRef<number[]>([]);

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

  const resetRunUi = useCallback(() => {
    setSurgeState(createInitialMochiSoldierSurgeState());
    setRewardClaimStatus("idle");
    setRewardClaimMessage("");
    setObtainedSnackRewards(createEmptySurgeSnackRewards());
    setWinBonusRewards(createEmptySurgeSnackRewards());
    setRevealedObtainedLines(0);
    setRevealedWinBonusLines(0);
    setObtainedAnimatedCounts({});
    setWinBonusAnimatedCounts({});
    rewardSubmittedRef.current = false;
  }, []);

  const startGame = async () => {
    if (isStarting || !selectedCharacter) return;
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
      setupScene: createMochiGeneralBattleScene,
    };
  }, []);

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
            defeatedMonsters: surgeState.defeatedMonsters,
            victory: surgeState.victory,
          }),
        });
        const data = (await response.json()) as {
          error?: string;
          granted?: Partial<SurgeSnackRewards>;
          obtainedSnack?: Partial<SurgeSnackRewards>;
          winBonus?: Partial<SurgeSnackRewards>;
        };
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
        setObtainedSnackRewards(obtainedSnack);
        setWinBonusRewards(winBonus);
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
  }, [hasStarted, surgeState.gameEnded, surgeState.defeatedMonsters, surgeState.victory]);

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

    if (!surgeState.gameEnded || rewardClaimStatus !== "claimed") return;

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
      }, index * REWARD_LINE_STAGGER_MS);
      rewardAnimationTimersRef.current.push(revealTimer);
    });

    const winStartDelay =
      Math.max(1, obtainedSnackEntries.length) * REWARD_LINE_STAGGER_MS + 220;
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

    return () => {
      rewardAnimationTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
        window.clearInterval(timer);
      });
      rewardAnimationTimersRef.current = [];
    };
  }, [surgeState.gameEnded, rewardClaimStatus, obtainedSnackEntries, winBonusEntries]);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#05070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_25%,rgba(251,146,60,0.46),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(96,165,250,0.4),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.62)_48%,rgba(2,6,23,0.86)_68%,rgba(2,6,23,0.95)_100%)]" />

      {!(hasStarted && surgeState.gameEnded) ? (
        <div className="absolute left-6 top-6 z-20">
          <Link
            href="/userSystem/user"
            className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition hover:brightness-105"
          >
            Back to User Home
          </Link>
        </div>
      ) : null}

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1800px] flex-col justify-start px-6 pb-6 pt-20">
        <section className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_0_52px_rgba(59,130,246,0.18)] backdrop-blur-md">
          <h1 className="bg-gradient-to-r from-orange-400 via-pink-500 to-sky-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            Mochi General Battle
          </h1>
        </section>

        {hasStarted ? surgeState.gameEnded ? (
          <section className="mt-6 flex w-full justify-center">
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

              <div className="mt-8 rounded-[22px] border border-white/10 bg-slate-950/70 p-6 text-center md:p-8">
                <p className="text-2xl font-semibold text-slate-200 md:text-3xl">Numbers Killed:</p>
                <p className="mt-2 text-4xl font-semibold tabular-nums text-slate-100 md:text-5xl">
                  {surgeState.defeatedMonsters}
                </p>

                <p className="mt-8 text-2xl font-semibold text-slate-200 md:text-3xl">Obtained Snack:</p>
                {rewardClaimStatus === "claiming" ? (
                  <p className="mt-3 text-xl text-slate-300">Calculating...</p>
                ) : obtainedSnackEntries.length === 0 ? (
                  <p className="mt-3 text-xl text-slate-300">None</p>
                ) : (
                  <ul className="mt-4 space-y-3 text-xl md:text-2xl">
                    {obtainedSnackEntries.slice(0, revealedObtainedLines).map((entry) => {
                      const shownCount = obtainedAnimatedCounts[entry.key] ?? 1;
                      const isCounting = shownCount < entry.count;
                      return (
                        <li
                          key={entry.key}
                          className={`mx-auto flex max-w-[680px] items-center justify-center gap-3 rounded-xl border px-5 py-3 transition ${
                            isCounting
                              ? "border-cyan-300/45 bg-cyan-500/12 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.24)]"
                              : "border-white/12 bg-white/[0.03] text-slate-100"
                          }`}
                        >
                          <span className="font-semibold">{entry.label}</span>
                          <span
                            className={`inline-flex min-w-[96px] items-center justify-center rounded-full px-3 py-1 text-lg font-bold tabular-nums ${
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

                <p className="mt-8 text-2xl font-semibold text-slate-200 md:text-3xl">Win Bonus:</p>
                {rewardClaimStatus === "claiming" ? (
                  <p className="mt-3 text-xl text-slate-300">Calculating...</p>
                ) : winBonusEntries.length === 0 ? (
                  <p className="mt-3 text-xl text-slate-300">None</p>
                ) : (
                  <ul className="mt-4 space-y-3 text-xl md:text-2xl">
                    {winBonusEntries.slice(0, revealedWinBonusLines).map((entry) => {
                      const shownCount = winBonusAnimatedCounts[entry.key] ?? 1;
                      const isCounting = shownCount < entry.count;
                      return (
                        <li
                          key={entry.key}
                          className={`mx-auto flex max-w-[680px] items-center justify-center gap-3 rounded-xl border px-5 py-3 transition ${
                            isCounting
                              ? "border-amber-300/45 bg-amber-500/12 text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.2)]"
                              : "border-white/12 bg-white/[0.03] text-slate-100"
                          }`}
                        >
                          <span className="font-semibold">{entry.label}</span>
                          <span
                            className={`inline-flex min-w-[96px] items-center justify-center rounded-full px-3 py-1 text-lg font-bold tabular-nums ${
                              isCounting
                                ? "animate-pulse bg-amber-300/25 text-amber-100"
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
        ) : (
          <section className="mt-4 grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="relative flex w-full justify-center">
              <SceneLauncher
                key={sceneSessionId}
                gameMode="mochiGeneralBattle"
                characterPath={selectedCharacter?.path}
                sceneLoader={loadSurgeScene}
                deltaStartAtMs={deltaStartAtMs ?? undefined}
                onSceneStateChange={handleSceneStateChange}
                className="h-[72vh] min-h-[560px] w-full max-w-[1680px] overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1119] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]"
              />
            </div>

            <aside className="flex min-h-0 flex-col rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_25px_70px_-40px_rgba(2,6,23,0.9)] backdrop-blur-md">
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
                <p className="mt-3 text-base font-medium leading-relaxed text-slate-100">
                  Every 5 kills gives 1 random snack.
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-300">
                  Full clear bonus: +3 random snacks.
                </p>
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
        ) : (
          <section className="mt-4 flex w-full justify-center">
            <div className="w-full max-w-[1400px] rounded-[30px] border border-white/10 bg-[#0b1119]/95 p-6 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)] backdrop-blur-xl md:p-8">
              {characterOptions.length === 0 ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-5 text-sm text-rose-200">
                  No available characters to start this game.
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-full max-w-[1120px] space-y-4 text-center">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300 md:text-base">
                        Choose Character
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                              className={`rounded-2xl border px-6 py-6 text-center transition ${
                                selected
                                  ? "border-sky-300/70 bg-sky-500/15 shadow-[0_0_26px_rgba(56,189,248,0.28)]"
                                  : "border-white/10 bg-slate-900/60 hover:border-white/30"
                              }`}
                            >
                              <p className="text-xl font-semibold text-slate-100 md:text-2xl">
                                {option.label}
                              </p>
                              <p className="mt-2 text-sm uppercase tracking-[0.22em] text-slate-400">
                                {option.id}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <aside className="w-full max-w-[760px] rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
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
                                  : "border-white/15 bg-slate-950/60 text-slate-200 hover:border-white/35"
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
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Basic Attack</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">
                          {selectedCharacter?.basicAttackDescription || "No description."}
                        </p>
                      </div>
                    </aside>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      disabled={!selectedCharacter || isStarting}
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
    </main>
  );
}
