"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PlayerUiState } from "../../entity/character/general/player";
import { characterProfiles } from "../../entity/character/general/player/registry";
import SceneLauncher from "../general/SceneLauncher";
import type { SceneUiState } from "../general/registry";

const characters = characterProfiles.map((profile) => ({
  id: profile.id,
  label: profile.label,
  path: `/assets/characters${profile.pathToken}${profile.id}.glb`,
}));

type TrainingScenePageProps = {
  selectedCharacterId?: string;
};

export default function TrainingScenePage({
  selectedCharacterId = "",
}: TrainingScenePageProps) {
  const selectedCharacterPath =
    characters.find((character) => character.id === selectedCharacterId)?.path ??
    characters[0]?.path ??
    "";
  const [testerState, setTesterState] = useState({
    health: 0,
    maxHealth: 0,
    alive: true,
  });
  const [infiniteFire, setInfiniteFire] = useState(false);
  const [playerUi, setPlayerUi] = useState<PlayerUiState>({
    cooldowns: { q: 0, e: 0, r: 0 },
    cooldownDurations: { q: 0, e: 0, r: 0 },
    manaCurrent: 0,
    manaMax: 0,
    energyCurrent: 0,
    energyMax: 0,
    infiniteFire: false,
  });

  const handleSceneStateChange = useCallback((state: SceneUiState) => {
    if (!state.tester) return;
    setTesterState(state.tester);
  }, []);

  const handlePlayerStateChange = useCallback((state: PlayerUiState) => {
    setPlayerUi(state);
  }, []);

  const renderCooldown = (label: "Q" | "E" | "R", seconds: number) => (
    <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-100">
        {seconds > 0 ? `${seconds.toFixed(1)}s` : "Ready"}
      </p>
    </div>
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    fetch("/api/gen-characters", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <main className="mx-auto flex w-full max-w-none flex-col gap-8">
        <div className="flex items-center">
          <Link
            href="/characterManagement"
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 px-5 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
          >
            Back
          </Link>
        </div>

        <h1 className="text-center text-4xl font-semibold text-slate-100">
          Training Scene
        </h1>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex justify-center">
            <SceneLauncher
              sceneId="training"
              gameMode="training"
              characterPath={selectedCharacterPath || undefined}
              infiniteFire={infiniteFire}
              onSceneStateChange={handleSceneStateChange}
              onPlayerStateChange={handlePlayerStateChange}
              className="relative h-[70vh] min-h-[520px] w-full max-w-[1300px] overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1119] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]"
            />
          </div>
          <aside className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.7)]">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Tester Monster
            </h2>
            <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                HP
              </p>
              <div className="mt-2 h-3 overflow-hidden rounded-full border border-red-300/40 bg-slate-900">
                <div
                  className="h-full bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.55)] transition-[width] duration-150 ease-out"
                  style={{
                    width: `${
                      testerState.maxHealth > 0
                        ? Math.round(
                            (Math.max(0, testerState.health) /
                              testerState.maxHealth) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="mt-2 text-right text-xs font-semibold tabular-nums text-slate-200">
                {Math.max(0, Math.round(testerState.health))}/
                {Math.max(0, Math.round(testerState.maxHealth))}
              </p>
              <p
                className={`mt-3 text-xs font-semibold uppercase tracking-[0.2em] ${
                  testerState.alive ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {testerState.alive ? "Alive" : "Down"}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Q / E / R Cooldown
                </p>
                <p className="text-[11px] font-semibold tabular-nums text-cyan-200">
                  MP {Math.round(playerUi.manaCurrent)}/{Math.round(playerUi.manaMax)}
                </p>
                <p className="text-[11px] font-semibold tabular-nums text-emerald-200">
                  EN {Math.round(playerUi.energyCurrent)}/{Math.round(playerUi.energyMax)}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {renderCooldown("Q", playerUi.cooldowns.q)}
                {renderCooldown("E", playerUi.cooldowns.e)}
                {renderCooldown("R", playerUi.cooldowns.r)}
              </div>
              <button
                type="button"
                onClick={() => setInfiniteFire((prev) => !prev)}
                className={`mt-4 w-full rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                  infiniteFire
                    ? "border-emerald-300/70 bg-emerald-400/20 text-emerald-200"
                    : "border-white/20 bg-slate-900/70 text-slate-100 hover:border-white/40"
                }`}
              >
                {infiniteFire ? "Infinite Fire: On" : "Infinite Fire: Off"}
              </button>
              <p className="mt-2 text-[11px] text-slate-400">
                Toggle to remove cooldown and mana/energy cost for Q/E/R in test scene.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

