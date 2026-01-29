"use client";

import Link from "next/link";

export default function UserPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 text-slate-900">
      <main className="w-full max-w-3xl rounded-3xl border border-black/10 bg-white p-10 shadow-lg">
        <h1 className="text-3xl font-semibold tracking-tight">User Home</h1>
        <p className="mt-3 text-base text-slate-600">
          Welcome back! Choose where you want to go next.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/three"
            className="inline-flex h-12 items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Enter Three.js Lab
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 px-6 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:bg-slate-50"
          >
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
