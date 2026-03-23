"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SceneLauncher from "../../../asset/scenes/general/SceneLauncher";
import type { SceneUiState } from "../../../asset/scenes/general/sceneTypes";
import MadaPreview from "./MadaPreview";
import {
  MADA_LAB_STATE_KEY,
  MADA_TERMINAL_UNLOCK_EVENT,
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

const BATTLE_MULTIPLIER_OPTIONS = [
  { value: 1, label: "x1.00" },
  { value: 1.25, label: "x1.25" },
  { value: 1.5, label: "x1.50" },
  { value: 2, label: "x2.00" },
] as const;

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
  selectedCharacter,
}: MadaCombatClientProps) {
  const [labState, setLabState] = useState<MadaLabState>(createInitialMadaLabState());
  const [battleMultiplier, setBattleMultiplier] = useState<
    (typeof BATTLE_MULTIPLIER_OPTIONS)[number]["value"]
  >(1);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalCode, setTerminalCode] = useState("");
  const [terminalFeedback, setTerminalFeedback] = useState<"idle" | "error">("idle");
  const [terminalUnlocked, setTerminalUnlocked] = useState(false);
  const codeResetTimerRef = useRef<number | null>(null);

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
      if (code !== "1986") {
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
      setTerminalUnlocked(true);
      setTerminalCode("");
      setTerminalFeedback("idle");
      setTerminalOpen(false);
      window.dispatchEvent(
        new CustomEvent(MADA_TERMINAL_UNLOCK_EVENT, {
          detail: { code },
        })
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
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
  }, [labState.terminalInRange, terminalOpen, terminalUnlocked]);

  const loadLabScene = useCallback(async () => {
    const { createMadaLabScene } = await import("./labSceneDefinition");
    return {
      id: "madaLab",
      setupScene: (
        scene: Parameters<typeof createMadaLabScene>[0],
        context?: Parameters<typeof createMadaLabScene>[1]
      ) =>
        createMadaLabScene(scene, context, {
          battleMultiplier,
        }),
    };
  }, [battleMultiplier]);

  const terminalDisplayChars = Array.from({ length: 4 }, (_, index) =>
    terminalCode[index] ?? "\u53e3"
  );

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#02070a] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(120,255,241,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(120,255,241,0.045)_1px,transparent_1px)] bg-[length:34px_34px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(45,212,191,0.18),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_16%,rgba(16,185,129,0.16),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(1,9,13,0.18)_0%,rgba(1,9,13,0.72)_58%,rgba(1,9,13,0.95)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1760px] flex-col justify-start px-6 pb-6 pt-16">
        <section className="w-full rounded-[32px] border border-cyan-200/12 bg-white/[0.03] px-8 py-6 text-center shadow-[0_0_60px_rgba(16,185,129,0.12)] backdrop-blur-md">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-center text-5xl font-black leading-none tracking-[1.01em] text-cyan-100 md:text-6xl">
              ???
            </h1>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {BATTLE_MULTIPLIER_OPTIONS.map((option) => {
                const selected = option.value === battleMultiplier;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBattleMultiplier(option.value)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.16em] transition ${
                      selected
                        ? "border-rose-200/80 bg-rose-500/20 text-rose-100 shadow-[0_0_18px_rgba(251,113,133,0.28)]"
                        : "border-cyan-200/25 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/45"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-4 grid w-full gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col gap-4">
            <div className="relative rounded-[28px] border border-cyan-200/12 bg-[#071118]/90 p-4 shadow-[0_28px_80px_-42px_rgba(0,0,0,0.9)]">
              <SceneLauncher
                gameMode="madacombat"
                characterPath={selectedCharacter.path}
                sceneLoader={loadLabScene}
                onSceneStateChange={handleSceneStateChange}
                maxPixelRatio={1.25}
                antialias={false}
                enableShadows={false}
                useDefaultLights={false}
                className="h-[74dvh] min-h-[600px] w-full overflow-hidden rounded-[30px] border border-cyan-300/10 bg-[#02090c] shadow-[inset_0_0_48px_rgba(34,211,238,0.08)]"
              />
              {labState.terminalInRange ? (
                <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-full border border-cyan-300/40 bg-[#021118]/88 px-5 py-2 font-mono text-sm tracking-[0.24em] text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
                  Press [F]
                </div>
              ) : null}
            </div>
          </div>

          <aside className="flex min-h-0 flex-col gap-4">
            <div className="rounded-[28px] border border-cyan-200/12 bg-[#071118]/92 p-5 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                Containment Terminal
              </p>
              <div className="mt-3 h-[248px] overflow-hidden rounded-[22px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(7,17,24,0.98)_0%,rgba(3,10,14,0.96)_100%)]">
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

            <div className="flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-[28px] border border-cyan-200/12 bg-[#071118]/92 p-5 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
                {terminalUnlocked ? "Mada Preview" : "? ? ?"}
              </p>
              <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[22px] border border-cyan-300/16 bg-[radial-gradient(circle_at_35%_18%,rgba(34,211,238,0.18),transparent_48%),linear-gradient(180deg,rgba(5,18,24,0.92)_0%,rgba(1,8,10,0.98)_100%)]">
                {terminalUnlocked ? <MadaPreview /> : null}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
