import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-10 px-6 py-12 sm:px-10 md:gap-12 md:px-16 md:py-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50 md:text-4xl md:leading-tight">
            Welcome to ITCGroup7
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400 md:text-lg md:leading-8">
            Please login or register to continue.
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-4 text-base font-medium sm:flex-row sm:justify-center">
          <Link
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] sm:min-w-[168px] sm:flex-1 sm:w-auto"
            href="/userSystem/login"
          >
            Login
          </Link>
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] sm:min-w-[168px] sm:flex-1 sm:w-auto"
            href="/userSystem/register"
          >
            Register
          </Link>
        </div>
      </main>
    </div>
  );
}
