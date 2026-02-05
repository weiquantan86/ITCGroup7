import Link from "next/link";

export default function StoragePage() {
  return (
    <main className="min-h-screen w-full bg-[#06080b] text-slate-200">
      <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
          <div className="w-full rounded-[32px] border border-slate-200/20 bg-[#0b1016]/80 p-10 shadow-[0_0_52px_rgba(70,120,210,0.22)]">
            <div className="flex flex-col gap-6 text-center">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl">
                Storage
              </h1>
              <p className="text-base leading-7 text-slate-300 md:text-lg">
                This is the storage page. Add inventory or items here.
              </p>
              <div className="mt-2 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/userSystem/user"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200/30 px-6 text-sm font-semibold text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10"
                >
                  Back to User Home
                </Link>
                <Link
                  href="/gacha"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200/30 px-6 text-sm font-semibold text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10"
                >
                  Snack Gacha
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
