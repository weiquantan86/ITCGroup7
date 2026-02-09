"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import CharacterManagementClient from "./CharacterManagementClient";
import { characterProfiles } from "../../asset/entity/character/player/registry";

type CharacterManagementShellProps = {
  ownedIds: string[];
};

export default function CharacterManagementShell({
  ownedIds,
}: CharacterManagementShellProps) {
  const router = useRouter();
  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);
  const fallbackSelectedId = useMemo(() => {
    return (
      characterProfiles.find((profile) => ownedSet.has(profile.id))?.id ??
      characterProfiles[0]?.id ??
      ""
    );
  }, [ownedSet]);
  const [selectedId, setSelectedId] = useState(fallbackSelectedId);
  const [activeSkill, setActiveSkill] = useState<"q" | "e" | "r">("q");

  const selectedProfile = useMemo(() => {
    if (!selectedId) return characterProfiles[0];
    return (
      characterProfiles.find((profile) => profile.id === selectedId) ||
      characterProfiles[0]
    );
  }, [selectedId]);
  const [isTryingCharacter, setIsTryingCharacter] = useState(false);

  const skillDescription =
    selectedProfile?.kit?.skills?.[activeSkill]?.description ??
    "No description yet.";
  const handleTryCharacter = async () => {
    if (isTryingCharacter) return;
    setIsTryingCharacter(true);
    try {
      const characterId = selectedProfile?.id;
      if (characterId) {
        await fetch("/api/user/selected-character", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId }),
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      router.push("/scenes/test");
      setIsTryingCharacter(false);
    }
  };

  return (
    <main className="h-screen w-full overflow-hidden bg-[#06080b] text-slate-100">
      <div className="h-full w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="mx-auto flex h-full w-full max-w-[1900px] items-stretch px-6 py-6 xl:px-10">
          <div className="h-full w-full rounded-[32px] border border-slate-200/20 bg-[#0b1016]/80 p-8 shadow-[0_0_50px_rgba(80,140,230,0.2)] xl:p-10">
            <div
              id="character-management-shell"
              className="grid h-full min-h-0 gap-6 xl:grid-cols-[260px_1fr]"
            >
              <aside className="flex h-full min-h-0 flex-col gap-6">
                <Link
                  href="/userSystem/user"
                  className="inline-flex items-center justify-center rounded-[14px] border border-slate-200/25 bg-[#101722]/80 px-5 py-3 text-lg font-semibold text-slate-100 shadow-[0_0_16px_rgba(90,140,220,0.14)] transition hover:border-slate-100/40 hover:shadow-[0_0_22px_rgba(120,180,255,0.2)]"
                >
                  &larr; Back
                </Link>

                <div className="flex items-center justify-center gap-5">
                  {(["q", "e", "r"] as const).map((key) => {
                    const isActive = activeSkill === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setActiveSkill(key)}
                        className={`flex h-12 w-12 items-center justify-center rounded-full border bg-[#101722]/80 text-sm font-semibold text-slate-100 shadow-[0_0_14px_rgba(90,140,220,0.16)] transition hover:border-slate-100/45 hover:shadow-[0_0_22px_rgba(120,180,255,0.25)] ${
                          isActive
                            ? "border-sky-300/80 text-slate-100 shadow-[0_0_20px_rgba(56,189,248,0.35)]"
                            : "border-slate-200/25 text-slate-300"
                        }`}
                      >
                        {key.toUpperCase()}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 rounded-[20px] border border-slate-200/20 bg-[#0f151f]/90 p-5 shadow-[0_0_20px_rgba(90,140,220,0.12)]">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Skill Description
                  </p>
                  <div className="mt-4 rounded-[14px] border border-slate-200/10 bg-[#05070a] px-4 py-3 text-sm leading-relaxed text-slate-100/80 shadow-[inset_0_0_18px_rgba(0,0,0,0.65)]">
                    {skillDescription}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTryCharacter}
                  disabled={isTryingCharacter}
                  style={{ height: "var(--character-selector-height, 96px)" }}
                  className={`flex items-center justify-center rounded-[18px] border border-slate-200/25 bg-[#101722]/80 px-6 text-2xl font-semibold text-slate-100 shadow-[0_0_16px_rgba(90,140,220,0.16)] transition hover:border-slate-100/45 hover:shadow-[0_0_24px_rgba(120,180,255,0.25)] ${
                    isTryingCharacter ? "cursor-wait opacity-70" : ""
                  }`}
                >
                  Try Character
                </button>
              </aside>

              <CharacterManagementClient
                onSelectCharacter={setSelectedId}
                ownedIds={ownedIds}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
