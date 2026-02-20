"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { characterProfiles } from "../../entity/character/general/player/registry";
import SceneLauncher from "../general/SceneLauncher";
import type { SceneUiState } from "../general/sceneTypes";
import type { TrainingSceneUiState } from "./trainingSceneTypes";

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
  const [combatState, setCombatState] = useState({
    lastDamage: 0,
    dps: 0,
  });
  const [infiniteFire, setInfiniteFire] = useState(false);

  const handleSceneStateChange = useCallback((state: SceneUiState) => {
    const trainingState = state as TrainingSceneUiState;
    if (trainingState.tester) {
      setTesterState(trainingState.tester);
    }
    if (trainingState.trainingCombat) {
      setCombatState(trainingState.trainingCombat);
    }
  }, []);

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
              useDefaultLights={false}
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
                  Damage Metrics
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Last Hit
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-slate-100">
                    {combatState.lastDamage.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    DPS
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-slate-100">
                    {combatState.dps.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Infinite Fire
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Toggle to remove cooldown and mana/energy cost for Q/E/R in
                    test scene.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInfiniteFire((prev) => !prev)}
                  className={`inline-flex h-8 min-w-14 items-center justify-center rounded-full border px-3 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                    infiniteFire
                      ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-200"
                      : "border-slate-400/50 bg-slate-800/70 text-slate-300"
                  }`}
                >
                  {infiniteFire ? "On" : "Off"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

