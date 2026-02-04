"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { characterProfiles } from "../../asset/character/registry";
import SceneLauncher from "../SceneLauncher";

const characters = characterProfiles.map((profile) => ({
  id: profile.id,
  label: profile.label,
  path: `/assets/characters${profile.pathToken}${profile.id}.glb`,
}));

export default function ThreePage() {
  const searchParams = useSearchParams();
  const lockedId = searchParams.get("character") ?? "";
  const lockedCharacter =
    characters.find((character) => character.id === lockedId) ?? null;
  const [selected, setSelected] = useState(
    () => lockedCharacter?.path ?? characters[0]?.path ?? ""
  );
  const showSelector = !lockedCharacter;

  useEffect(() => {
    if (!lockedCharacter?.path) return;
    setSelected(lockedCharacter.path);
  }, [lockedCharacter?.path]);

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

        <div
          className={`grid gap-6 ${
            showSelector ? "lg:grid-cols-[minmax(0,1fr)_220px]" : ""
          }`}
        >
          <div className="flex justify-center">
            <SceneLauncher
              sceneId="range"
              characterPath={selected}
              className="relative h-[70vh] min-h-[520px] w-full max-w-[1300px] overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1119] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]"
            />
          </div>
          {showSelector ? (
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
          ) : null}
        </div>

      </main>
    </div>
  );
}
