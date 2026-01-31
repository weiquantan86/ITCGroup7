"use client";

import Link from "next/link";

export default function DragonNestScene() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-emerald-950/50 to-slate-900 px-6 py-16 text-slate-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
              Hunter Mode
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Dragon Nest
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              A smoldering cavern deep in the emerald wilds. This scene is ready
              for you to drop in creatures, quests, and a full combat loop.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/userSystem/user"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
            >
              Back to User Home
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-950/40 p-6 shadow-[0_30px_80px_-40px_rgba(16,185,129,0.45)]">
            <div className="flex h-[360px] items-center justify-center rounded-2xl border border-emerald-200/20 bg-slate-950/70 text-center text-sm text-emerald-100/80">
              Scene Placeholder
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-200">
            <h2 className="text-lg font-semibold text-white">Quest Briefing</h2>
            <p>
              The nest awakens at dusk. Track heat signatures, map flight paths,
              and prepare the Hunter squad for a coordinated strike.
            </p>
            <div className="rounded-2xl border border-emerald-200/20 bg-emerald-950/40 p-4 text-xs uppercase tracking-[0.2em] text-emerald-200">
              Status: staging
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
