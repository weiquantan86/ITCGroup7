"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import SceneLauncher from "../../../asset/scenes/general/SceneLauncher";

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

export default function MochiSoldierSurgeClient({
  characterOptions,
}: MochiSoldierSurgeClientProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    characterOptions[0]?.id ?? ""
  );
  const [activeSkillKey, setActiveSkillKey] = useState<"q" | "e" | "r">("q");
  const [isStarting, setIsStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

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

  const startGame = async () => {
    if (isStarting || !selectedCharacter) return;
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
      setHasStarted(true);
      setIsStarting(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#05070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_25%,rgba(251,146,60,0.46),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(96,165,250,0.4),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.62)_48%,rgba(2,6,23,0.86)_68%,rgba(2,6,23,0.95)_100%)]" />

      <div className="absolute left-6 top-6 z-20">
        <Link
          href="/userSystem/user"
          className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition hover:brightness-105"
        >
          Back to User Home
        </Link>
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col justify-start px-6 pt-20 pb-6">
        <section className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_0_52px_rgba(59,130,246,0.18)] backdrop-blur-md">
          <h1 className="bg-gradient-to-r from-orange-400 via-pink-500 to-sky-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            Mochi Soldier Surge
          </h1>
        </section>

        {hasStarted ? (
          <section className="mt-4 flex w-full justify-center">
            <SceneLauncher
              sceneId="mochiStreet"
              gameMode="default"
              characterPath={selectedCharacter?.path}
              className="h-[72vh] min-h-[560px] w-full max-w-[1400px] overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1119] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]"
            />
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
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Choose Character
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                              className={`rounded-xl border px-4 py-4 text-left transition ${
                                selected
                                  ? "border-sky-300/70 bg-sky-500/15 shadow-[0_0_20px_rgba(56,189,248,0.25)]"
                                  : "border-white/10 bg-slate-900/60 hover:border-white/30"
                              }`}
                            >
                              <p className="text-lg font-semibold text-slate-100">{option.label}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                                {option.id}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <aside className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
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
