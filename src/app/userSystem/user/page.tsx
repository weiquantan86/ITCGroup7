"use client";

import Link from "next/link";

export default function UserPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
      >
        Log out
      </Link>
      <main className="w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-900/70 p-12 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.8)]">
        <h1 className="text-3xl font-semibold tracking-tight">User Home</h1>
        <p className="mt-3 text-base text-slate-300">
          Welcome back! Choose where you want to go next.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/scenes/test"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Enter Test Lab
          </Link>
          <Link
            href="/scenes/hunter/dragonNest"
            className="inline-flex h-12 items-center justify-center rounded-full border border-emerald-200/40 bg-emerald-200 px-6 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100"
          >
            Hunter Mode: Dragon Nest
          </Link>
        </div>
      </main>
    </div>
  );
}
