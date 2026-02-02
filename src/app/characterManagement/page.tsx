import Link from "next/link";

export default function CharacterManagementPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Character Management
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage characters, loadouts, and progression here.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 px-5 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
          >
            Back to Home
          </Link>
        </div>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-200 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.7)]">
          This page is ready for character management features.
        </section>
      </main>
    </div>
  );
}
