"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SceneLauncher from "../../../asset/scenes/general/SceneLauncher";
import type { SceneUiState } from "../../../asset/scenes/general/sceneTypes";
import {
  ADMIN_TEST_SCENE_STATE_KEY,
  type AdminTestSceneUiState,
} from "../../../asset/scenes/adminTest/sceneDefinition";

type AdminTestMonsterOption = {
  id: string;
  label: string;
  path: string;
};

type AdminTestClientProps = {
  monsters: AdminTestMonsterOption[];
};

const ADAM_CHARACTER_PATH = "/assets/characters/adam/adam.glb";

const createFallbackState = (
  monster?: AdminTestMonsterOption | null
): AdminTestSceneUiState => ({
  monsterId: monster?.id ?? "",
  monsterLabel: monster?.label ?? "-",
  monsterHealth: 0,
  monsterMaxHealth: 0,
  monsterAlive: false,
});

export default function AdminTestClient({ monsters }: AdminTestClientProps) {
  const [selectedMonsterId, setSelectedMonsterId] = useState(monsters[0]?.id ?? "");
  const selectedMonster = useMemo(
    () =>
      monsters.find((monster) => monster.id === selectedMonsterId) ??
      monsters[0] ??
      null,
    [monsters, selectedMonsterId]
  );
  const [sceneState, setSceneState] = useState<AdminTestSceneUiState>(
    createFallbackState(selectedMonster)
  );

  useEffect(() => {
    if (!selectedMonster) {
      setSceneState(createFallbackState(null));
      return;
    }
    setSceneState((previous) => ({
      ...previous,
      monsterId: selectedMonster.id,
      monsterLabel: selectedMonster.label,
    }));
  }, [selectedMonster]);

  const handleSceneStateChange = useCallback((state: SceneUiState) => {
    const next = (state as Record<string, AdminTestSceneUiState | undefined>)[
      ADMIN_TEST_SCENE_STATE_KEY
    ];
    if (!next) return;
    setSceneState({
      monsterId: next.monsterId || "",
      monsterLabel: next.monsterLabel || "-",
      monsterHealth: Math.max(0, Math.floor(next.monsterHealth || 0)),
      monsterMaxHealth: Math.max(0, Math.floor(next.monsterMaxHealth || 0)),
      monsterAlive: Boolean(next.monsterAlive),
    });
  }, []);

  const loadScene = useCallback(async () => {
    if (!selectedMonster) {
      throw new Error("No monster selected.");
    }
    const { createAdminTestSceneDefinition } = await import(
      "../../../asset/scenes/adminTest/sceneDefinition"
    );
    return createAdminTestSceneDefinition(selectedMonster);
  }, [selectedMonster]);

  if (!selectedMonster) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
        No monster GLB found in `public/assets/monsters`.
      </div>
    );
  }

  const healthPercent =
    sceneState.monsterMaxHealth > 0
      ? Math.round((sceneState.monsterHealth / sceneState.monsterMaxHealth) * 100)
      : 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
        <SceneLauncher
          key={`admin-test-${selectedMonster.id}`}
          gameMode="adminTest"
          characterPath={ADAM_CHARACTER_PATH}
          sceneLoader={loadScene}
          onSceneStateChange={handleSceneStateChange}
          useDefaultLights={false}
          maxPixelRatio={1.5}
          className="h-[78dvh] min-h-[620px] w-full overflow-hidden rounded-2xl border border-slate-700 bg-[#070d18]"
        />
      </div>

      <aside className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Character
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-100">Adam</p>
          <p className="mt-2 text-xs text-slate-400">
            Adam dies {"->"} auto reset at same side, same selected monster
            respawns.
          </p>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <label
            htmlFor="admin-test-monster"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
          >
            Spawn Monster (Center)
          </label>
          <select
            id="admin-test-monster"
            value={selectedMonster.id}
            onChange={(event) => setSelectedMonsterId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400"
          >
            {monsters.map((monster) => (
              <option key={monster.id} value={monster.id}>
                {monster.label}
              </option>
            ))}
          </select>
          <p className="mt-2 break-all text-xs text-slate-400">{selectedMonster.path}</p>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Monster State
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-100">{sceneState.monsterLabel}</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full border border-rose-300/35 bg-slate-950">
            <div
              className="h-full bg-rose-500 transition-[width] duration-150"
              style={{ width: `${Math.max(0, Math.min(100, healthPercent))}%` }}
            />
          </div>
          <p className="mt-2 text-right text-xs font-semibold tabular-nums text-slate-200">
            {sceneState.monsterHealth}/{sceneState.monsterMaxHealth}
          </p>
          <p
            className={`mt-2 text-xs font-semibold uppercase tracking-[0.2em] ${
              sceneState.monsterAlive ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {sceneState.monsterAlive ? "Alive" : "Respawning"}
          </p>
        </section>
      </aside>
    </div>
  );
}
