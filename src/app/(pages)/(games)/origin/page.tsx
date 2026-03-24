export default function OriginPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#05070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_25%,rgba(251,146,60,0.46),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(96,165,250,0.4),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.62)_48%,rgba(2,6,23,0.86)_68%,rgba(2,6,23,0.95)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-none flex-col justify-start px-3 pb-2 pt-2 md:px-4">
        <section className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-6 text-center shadow-[0_0_52px_rgba(59,130,246,0.18)] backdrop-blur-md">
          <h1 className="bg-[linear-gradient(90deg,#7c3aed_0%,#be185d_46%,#0ea5e9_100%)] bg-clip-text text-4xl font-bold tracking-[0.08em] text-transparent drop-shadow-[0_0_24px_rgba(139,92,246,0.28)] md:text-5xl">
            Strike Origin
          </h1>
        </section>

        <section className="mt-2 grid min-h-0 flex-1 w-full items-stretch gap-3 xl:grid-cols-[minmax(250px,15vw)_minmax(0,1fr)_minmax(250px,15vw)]">
          <aside className="flex min-h-0 flex-col overflow-y-auto rounded-[24px] border border-cyan-200/20 bg-slate-900/75 p-4 shadow-[0_25px_70px_-40px_rgba(2,6,23,0.9)] backdrop-blur-md">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Left Panel
            </h2>
            <div className="mt-4 flex min-h-0 flex-1 items-center justify-center rounded-xl border border-cyan-200/20 bg-slate-950/65 text-sm text-cyan-200/70">
              Empty
            </div>
          </aside>

          <div className="relative flex w-full justify-center">
            <div className="h-full min-h-0 w-full max-w-none overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1119] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]">
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.14),transparent_54%),linear-gradient(180deg,rgba(11,17,25,0.98)_0%,rgba(4,8,14,0.98)_100%)]">
                <p className="text-lg font-semibold uppercase tracking-[0.22em] text-cyan-100/75">
                  Game Frame Placeholder
                </p>
              </div>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col overflow-y-auto rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_25px_70px_-40px_rgba(2,6,23,0.9)] backdrop-blur-md">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Right Panel
            </h2>
            <div className="mt-4 flex min-h-0 flex-1 items-center justify-center rounded-xl border border-white/10 bg-slate-950/65 text-sm text-slate-300/70">
              Empty
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
