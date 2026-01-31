"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThreeScene from "../../components/ThreeScene";

export default function ThreePage() {
  const characters = [
    { id: "adam", label: "Adam", path: "/assets/characters/adam/adam.glb" },
    { id: "baron", label: "Baron", path: "/assets/characters/baron/baron.glb" },
    { id: "carrot", label: "Carrot", path: "/assets/characters/carrot/carrot.glb" },
  ];
  const [selected, setSelected] = useState(characters[0].path);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    fetch("/api/gen-characters", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Lab
            </h1>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 px-5 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
          >
            Back to Home
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
          <ThreeScene characterPath={selected} />
          <aside className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.7)]">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Choose Character
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {characters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => setSelected(character.path)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    selected === character.path
                      ? "border-white/60 bg-white text-slate-950"
                      : "border-white/10 bg-slate-900/60 text-slate-200 hover:border-white/30"
                  }`}
                >
                  {character.label}
                </button>
              ))}
            </div>
          </aside>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-200 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.7)]">
          Move with WASD or arrow keys. Click the scene to focus.
        </div>
      </main>
    </div>
  );
}
