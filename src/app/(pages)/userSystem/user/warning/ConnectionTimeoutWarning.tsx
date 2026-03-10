export function ConnectionTimeoutWarning() {
  return (
    <main className="min-h-screen w-full bg-[#06080b] text-slate-200">
      <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 lg:px-8">
          <div className="w-full rounded-[28px] border border-amber-200/30 bg-[#0b1016]/80 p-8 text-center shadow-[0_0_40px_rgba(245,158,11,0.2)]">
            <p className="text-lg font-semibold text-amber-200">
              Warning: database connection timed out.
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Please retry in a moment. This is a temporary network issue.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <a
                href="/userSystem/user"
                className="inline-flex items-center justify-center rounded-full border border-amber-200/40 px-5 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-100/60 hover:bg-amber-100/10"
              >
                Retry
              </a>
              <a
                href="/userSystem/login"
                className="inline-flex items-center justify-center rounded-full border border-slate-200/30 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10"
              >
                Back to Login
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
