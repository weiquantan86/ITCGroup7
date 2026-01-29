"use client";

import Link from "next/link";
import ThreeScene from "../components/ThreeScene";

export default function ThreePage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16 text-slate-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Lab
            </h1>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 px-5 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:bg-white"
          >
            Back to Home
          </Link>
        </div>

        <ThreeScene />

        <div className="rounded-2xl border border-black/10 bg-white/70 p-6 text-sm text-slate-700 shadow-sm">
          Move with WASD or arrow keys. Click the scene to focus.
        </div>
      </main>
    </div>
  );
}
