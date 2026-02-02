"use client";

import { useMemo, useState } from "react";
import CharacterScene from "./characterScene/CharacterScene";

type CharacterCard = {
  id: string;
  name: string;
  path?: string;
  locked?: boolean;
};

const characterCards: CharacterCard[] = [
  { id: "adam", name: "Adam", path: "/assets/characters/adam/adam.glb" },
  { id: "baron", name: "Baron", path: "/assets/characters/baron/baron.glb" },
  { id: "carrot", name: "Carrot", path: "/assets/characters/carrot/carrot.glb" },
  { id: "locked-1", name: "Unknown", locked: true },
  { id: "locked-2", name: "Unknown", locked: true },
];

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6 text-slate-200/70"
    >
      <path
        d="M7 10V8a5 5 0 0 1 10 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" />
    </svg>
  );
}

export default function CharacterManagementClient() {
  const selectable = useMemo(
    () => characterCards.filter((card) => !card.locked),
    []
  );
  const [selectedId, setSelectedId] = useState(selectable[0]?.id ?? "");
  const selected = characterCards.find((card) => card.id === selectedId);

  return (
    <section className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex items-center justify-between rounded-[22px] border border-slate-200/25 bg-[#0f151f]/90 px-6 py-5 shadow-[0_0_24px_rgba(90,140,220,0.16)]">
        <div className="h-10 w-10 rounded-full border border-slate-200/30 bg-[#0b1119]/90" />
        <h1 className="text-3xl font-semibold tracking-[0.18em] text-slate-100">
          Character
        </h1>
        <div className="h-10 w-10 rounded-full border border-slate-200/30 bg-[#0b1119]/90" />
      </div>

      <div className="relative flex min-h-0 flex-1 rounded-[28px] border border-slate-200/20 bg-[#0f151f]/90 p-5 shadow-[0_0_30px_rgba(90,140,220,0.18)]">
        <div className="absolute inset-6 rounded-[20px] border border-slate-200/15" />
        <div className="relative z-10 h-full w-full">
          <CharacterScene
            characterPath={selected?.path}
            className="h-full w-full border border-slate-200/15 bg-[#0b1119]/90 shadow-[0_0_24px_rgba(90,140,220,0.18)]"
          />
        </div>
      </div>

      <div className="rounded-[22px] border border-slate-200/20 bg-[#0f151f]/90 p-5 shadow-[0_0_20px_rgba(90,140,220,0.14)]">
        <div className="flex items-center gap-3">
          <div className="h-2 w-full rounded-full bg-slate-200/10">
            <div className="h-full w-1/3 rounded-full bg-slate-100/40" />
          </div>
          <span className="text-xs uppercase tracking-[0.35em] text-slate-400">
            Scroll bar
          </span>
        </div>
        <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
          {characterCards.map((card) => {
            const isSelected = card.id === selectedId;
            const isLocked = Boolean(card.locked);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  if (isLocked) return;
                  setSelectedId(card.id);
                }}
                className={`flex min-w-[170px] flex-col items-center justify-center rounded-[16px] border bg-[#0b1119]/90 px-4 py-4 text-sm font-semibold text-slate-100 shadow-[0_0_14px_rgba(90,140,220,0.12)] transition ${
                  isLocked
                    ? "cursor-not-allowed border-slate-200/10 text-slate-400"
                    : "border-slate-200/25 hover:border-slate-100/45"
                } ${isSelected ? "border-sky-400/70 shadow-[0_0_18px_rgba(56,189,248,0.25)]" : ""}`}
              >
                {isLocked ? <LockIcon /> : <span>{card.name}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
