"use client";

import Link from "next/link";

export default function UserPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <main className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.8)]">
        <h1 className="text-3xl font-semibold tracking-tight">User Home</h1>
        <p className="mt-3 text-base text-slate-300">
          Welcome back! Choose where you want to go next.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/three"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Enter Three.js Lab
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
          >
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
