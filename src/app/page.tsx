import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black font-sans">
      <main className="flex w-full max-w-3xl flex-col items-center justify-center gap-12 px-6 text-center">
        <div className="relative">
          <h1 className="text-8xl md:text-9xl font-black tracking-tighter italic flex select-none">
            <span className="text-white">S</span>
            <span className="text-[#9880ff] -ml-2">T</span>
            <span className="text-white -ml-2">R</span>
            <span className="text-[#9880ff] -ml-2">I</span>
            <span className="text-white -ml-2">K</span>
            <span className="text-[#9880ff] -ml-2">E!</span>
          </h1>
        </div>

        <p className="max-w-md text-lg font-medium leading-relaxed text-[#9880ff]">
          Defeat Mochi Monsters and earn points! Register or Log in to your
          account to play.
        </p>

        <div className="flex flex-col gap-6 sm:flex-row">
          <Link
            className="flex h-14 w-48 items-center justify-center rounded-full bg-white text-xl font-black uppercase tracking-widest text-[#9880ff] transition-transform hover:scale-105 active:scale-95"
            href="/userSystem/login"
          >
            Login
          </Link>
          <Link
            className="flex h-14 w-48 items-center justify-center rounded-full bg-white text-xl font-black uppercase tracking-widest text-[#9880ff] transition-transform hover:scale-105 active:scale-95"
            href="/userSystem/register"
          >
            Register
          </Link>
        </div>
      </main>
    </div>
  );
}
