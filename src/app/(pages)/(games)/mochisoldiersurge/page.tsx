import Link from "next/link";
import SceneLauncher from "../../../asset/scenes/general/SceneLauncher";

export default function MochiSoldierSurgePage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#05070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_25%,rgba(251,146,60,0.46),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(96,165,250,0.4),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.62)_48%,rgba(2,6,23,0.86)_68%,rgba(2,6,23,0.95)_100%)]" />

      <div className="absolute left-6 top-6 z-10">
        <Link
          href="/userSystem/user"
          className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition hover:brightness-105"
        >
          Back to User Home
        </Link>
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col justify-start px-6 pt-20 pb-6">
        <section className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_0_52px_rgba(59,130,246,0.18)] backdrop-blur-md">
          <h1 className="bg-gradient-to-r from-orange-400 via-pink-500 to-sky-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            Mochi Soldier Surge
          </h1>
        </section>

        <section className="mt-4 flex w-full justify-center">
          <SceneLauncher
            sceneId="mochiStreet"
            gameMode="default"
            characterPath="/assets/characters/adam/adam.glb"
            className="h-[72vh] min-h-[560px] w-full max-w-[1400px] overflow-hidden rounded-[30px] border border-white/10 bg-[#0b1119] shadow-[0_30px_80px_-40px_rgba(2,6,23,0.85)]"
          />
        </section>
      </div>
    </main>
  );
}
