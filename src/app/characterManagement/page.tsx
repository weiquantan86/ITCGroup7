import Link from "next/link";
import CharacterManagementClient from "./CharacterManagementClient";

export default function CharacterManagementPage() {
  return (
    <main className="h-screen w-full overflow-hidden bg-[#06080b] text-slate-100">
      <div className="h-full w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="mx-auto flex h-full w-full max-w-[1900px] items-stretch px-6 py-6 xl:px-10">
          <div className="h-full w-full rounded-[32px] border border-slate-200/20 bg-[#0b1016]/80 p-8 shadow-[0_0_50px_rgba(80,140,230,0.2)] xl:p-10">
            <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[260px_1fr]">
              <aside className="flex h-full min-h-0 flex-col gap-6">
                <Link
                  href="/userSystem/user"
                  className="inline-flex items-center justify-center rounded-[14px] border border-slate-200/25 bg-[#101722]/80 px-5 py-3 text-sm font-semibold text-slate-100 shadow-[0_0_16px_rgba(90,140,220,0.14)] transition hover:border-slate-100/40 hover:shadow-[0_0_22px_rgba(120,180,255,0.2)]"
                >
                  &larr; Back
                </Link>

                <div className="flex items-center justify-between gap-2">
                  {["Q", "E", "R"].map((label) => (
                    <button
                      key={label}
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/25 bg-[#101722]/80 text-sm font-semibold text-slate-100 shadow-[0_0_14px_rgba(90,140,220,0.16)] transition hover:border-slate-100/45 hover:shadow-[0_0_22px_rgba(120,180,255,0.25)]"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 rounded-[20px] border border-slate-200/20 bg-[#0f151f]/90 p-5 shadow-[0_0_20px_rgba(90,140,220,0.12)]">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Skill Description
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-200/80">
                    Select a character to preview their core abilities, traits,
                    and combat roles. Ability slots Q, E, and R are highlighted
                    for quick reference.
                  </p>
                </div>

                <button className="rounded-[16px] border border-slate-200/25 bg-[#101722]/80 px-4 py-4 text-sm font-semibold text-slate-100 shadow-[0_0_16px_rgba(90,140,220,0.16)] transition hover:border-slate-100/45 hover:shadow-[0_0_24px_rgba(120,180,255,0.25)]">
                  Try Character
                </button>
              </aside>

              <CharacterManagementClient />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
