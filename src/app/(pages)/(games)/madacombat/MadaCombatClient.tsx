"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import SceneLauncher from "../../../asset/scenes/general/SceneLauncher";
import type { SceneUiState } from "../../../asset/scenes/general/sceneTypes";
import MadaPreview from "./MadaPreview";
import {
  MADA_LAB_STATE_KEY,
  createInitialMadaLabState,
  type MadaLabState,
} from "./labConfig";

type SelectedCharacter = {
  id: string;
  label: string;
  path: string;
};

type MadaCombatClientProps = {
  selectedCharacter: SelectedCharacter;
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

export default function MadaCombatClient({
  selectedCharacter,
}: MadaCombatClientProps) {
  const [, setLabState] = useState<MadaLabState>(createInitialMadaLabState());

  const handleSceneStateChange = useCallback((state: SceneUiState) => {
    const next = (state as Record<string, MadaLabState | undefined>)[
      MADA_LAB_STATE_KEY
    ];
    if (!next) return;
    setLabState({
      madaHealth: next.madaHealth || 0,
      madaMaxHealth: next.madaMaxHealth || 0,
      containmentIntegrity: clampPercent(next.containmentIntegrity || 0),
      electricActivity: clampPercent(next.electricActivity || 0),
      fluidPatches: next.fluidPatches || 0,
      circuitBreaks: next.circuitBreaks || 0,
      statusLabel: next.statusLabel || "Containment stabilizing",
    });
  }, []);

  const loadLabScene = useCallback(async () => {
    const { createMadaLabScene } = await import("./labSceneDefinition");
    return {
      id: "madaLab",
      setupScene: createMadaLabScene,
    };
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#02070a] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(120,255,241,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(120,255,241,0.045)_1px,transparent_1px)] bg-[length:34px_34px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(45,212,191,0.18),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_16%,rgba(16,185,129,0.16),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(1,9,13,0.18)_0%,rgba(1,9,13,0.72)_58%,rgba(1,9,13,0.95)_100%)]" />

      <div className="absolute left-6 top-6 z-20 flex flex-wrap items-center gap-3">
        <Link
          href="/userSystem/user"
          className="inline-flex h-11 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-6 text-sm font-semibold text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:border-cyan-200/55 hover:bg-cyan-400/16"
        >
          Back
        </Link>
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1760px] flex-col justify-start px-6 pb-6 pt-16">
        <section className="w-full rounded-[32px] border border-cyan-200/12 bg-white/[0.03] px-8 py-6 text-center shadow-[0_0_60px_rgba(16,185,129,0.12)] backdrop-blur-md">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-center text-5xl font-black leading-none tracking-[1.01em] text-cyan-100 md:text-6xl">
              ???
            </h1>
          </div>
        </section>

        <section className="mt-4 grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="rounded-[28px] border border-cyan-200/12 bg-[#071118]/90 p-4 shadow-[0_28px_80px_-42px_rgba(0,0,0,0.9)]">
              <SceneLauncher
                gameMode="madacombat"
                characterPath={selectedCharacter.path}
                sceneLoader={loadLabScene}
                onSceneStateChange={handleSceneStateChange}
                maxPixelRatio={1.25}
                antialias={false}
                enableShadows={false}
                useDefaultLights={false}
                className="h-[74vh] min-h-[600px] w-full overflow-hidden rounded-[30px] border border-cyan-300/10 bg-[#02090c] shadow-[inset_0_0_48px_rgba(34,211,238,0.08)]"
              />
            </div>
          </div>

          <aside className="flex min-h-0 flex-col gap-4">
            <div className="rounded-[28px] border border-cyan-200/12 bg-[#071118]/92 p-5 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                Field Notes
              </p>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
                <p>
                  The room is framed as a damaged laboratory: metal wall panels,
                  observation glass, containment rings, broken wall circuits, and
                  bright electric arcs along the perimeter.
                </p>
                <p>
                  Research benches, canisters, tanks, and monitor stations are
                  placed around the chamber to sell the experiment-site setting.
                </p>
                <p>
                  Multiple reactive puddles spread across the floor as unidentified
                  chemical runoff.
                </p>
              </div>
            </div>

            <div className="flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-[28px] border border-cyan-200/12 bg-[#071118]/92 p-5 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                Mada Preview
              </p>
              <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[22px] border border-cyan-300/16 bg-[radial-gradient(circle_at_35%_18%,rgba(34,211,238,0.18),transparent_48%),linear-gradient(180deg,rgba(5,18,24,0.92)_0%,rgba(1,8,10,0.98)_100%)]">
                <MadaPreview />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
