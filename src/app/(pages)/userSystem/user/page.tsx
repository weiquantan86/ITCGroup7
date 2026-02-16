import type { ReactNode } from "react";
import { cookies } from "next/headers";
import pool from "../../../../database/client";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

function Panel({ children, className = "" }: PanelProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_28px_rgba(59,130,246,0.16)] backdrop-blur-md before:pointer-events-none before:absolute before:inset-[6px] before:rounded-[20px] before:border before:border-white/10 before:content-[''] ${className}`}
    >
      {children}
    </div>
  );
}

type MenuButtonProps = {
  label: string;
  className?: string;
  href?: string;
};

function MenuButton({ label, className = "", href }: MenuButtonProps) {
  const sharedClassName = `group relative flex w-full items-center justify-center rounded-[20px] border border-white/15 bg-gradient-to-r from-slate-900/85 to-slate-800/75 px-7 py-7 text-center text-xl font-semibold tracking-wide text-slate-100 shadow-[0_8px_24px_rgba(15,23,42,0.35)] transition duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:shadow-[0_12px_30px_rgba(14,165,233,0.25)] ${className}`;

  if (href) {
    return (
      <a href={href} className={sharedClassName}>
        <span className="relative z-10">{label}</span>
        <span className="pointer-events-none absolute inset-[6px] rounded-[14px] border border-white/10 transition duration-200 group-hover:border-white/20" />
      </a>
    );
  }

  return (
    <button className={sharedClassName}>
      <span className="relative z-10">{label}</span>
      <span className="pointer-events-none absolute inset-[6px] rounded-[14px] border border-white/10 transition duration-200 group-hover:border-white/20" />
    </button>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <main className="min-h-screen w-full bg-[#06080b] text-slate-200">
      <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 lg:px-8">
          <div className="w-full rounded-[28px] border border-slate-200/20 bg-[#0b1016]/80 p-8 text-center shadow-[0_0_40px_rgba(70,120,210,0.18)]">
            <p className="text-lg font-semibold text-slate-100">{message}</p>
            <p className="mt-2 text-sm text-slate-300">
              Please log in before entering the user home.
            </p>
            <a
              href="/userSystem/login"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-slate-200/30 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function UserPage() {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) {
    return <ErrorState message="Load failed: no login information found." />;
  }

  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId)) {
    return <ErrorState message="Load failed: login information is invalid." />;
  }

  let username = "";
  let isAuthorised = false;
  try {
    const userQuery = await pool.query(
      "SELECT username, is_authorised FROM users WHERE id = $1",
      [userId]
    );
    if (userQuery.rows.length === 0) {
      return <ErrorState message="Load failed: user does not exist." />;
    }
    username = userQuery.rows[0].username;
    isAuthorised = Boolean(userQuery.rows[0].is_authorised);
  } catch (error) {
    console.error(error);
    return <ErrorState message="Load failed: unable to read user information." />;
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#05070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_25%,rgba(251,146,60,0.46),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(96,165,250,0.4),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.62)_48%,rgba(2,6,23,0.86)_68%,rgba(2,6,23,0.95)_100%)]" />

      <div className="relative mx-auto flex h-full w-full max-w-[1920px] items-stretch px-6 py-6 lg:px-12 xl:px-16">
        <div className="h-full w-full rounded-[36px] border border-white/10 bg-white/[0.03] py-10 px-12 shadow-[0_0_52px_rgba(59,130,246,0.18)] backdrop-blur-md lg:py-12 lg:px-14">
          <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[1fr_1.5fr_1fr] lg:grid-rows-[280px_minmax(0,1fr)] xl:grid-rows-[320px_minmax(0,1fr)]">
            <Panel className="grid h-full min-h-0 grid-rows-3 gap-6">
              <div className="flex h-full items-center justify-center gap-3 text-base text-slate-200/90">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400/80 shadow-[0_0_10px_rgba(56,189,248,0.7)]" />
                <span className="inline-flex items-center text-center text-2xl font-semibold tracking-wide md:text-3xl">
                  {username}
                  {isAuthorised ? (
                    <span className="ml-2.5 inline-flex h-8 w-8 items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-8 w-8 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]"
                        aria-label="Authorised"
                        role="img"
                      >
                        <path
                          d="M12 2.6l2.75 5.57 6.15.9-4.45 4.34 1.05 6.13L12 16.66l-5.5 2.88 1.05-6.13L3.1 9.07l6.15-.9L12 2.6z"
                          fill="#facc15"
                          stroke="#fff7cc"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : null}
                </span>
              </div>

              <a
                href="/userSystem/userProfile"
                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] border border-white/15 bg-gradient-to-r from-orange-500/85 to-pink-500/80 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition duration-200 hover:brightness-105"
              >
                View my profile
                <span className="pointer-events-none absolute inset-[5px] rounded-[14px] border border-white/20" />
              </a>

              <form action="/api/logout" method="post" className="h-full w-full">
                <button
                  type="submit"
                  className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] border border-white/15 bg-gradient-to-r from-sky-500/85 to-cyan-400/85 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(14,165,233,0.28)] transition duration-200 hover:brightness-105"
                >
                  Log out
                  <span className="pointer-events-none absolute inset-[5px] rounded-[14px] border border-white/20" />
                </button>
              </form>
            </Panel>

            <Panel className="flex h-full items-center justify-between gap-10 px-10 py-8">
              <div className="h-14 w-14 rounded-full border border-white/20 bg-white/10 shadow-[0_0_18px_rgba(120,180,255,0.24)]" />
              <div className="bg-gradient-to-r from-orange-400 via-pink-500 to-sky-400 bg-clip-text text-center text-6xl font-semibold italic tracking-[0.16em] text-transparent md:text-7xl">
                Lab 7.5
              </div>
              <div className="h-14 w-14 rounded-full border border-white/20 bg-white/10 shadow-[0_0_18px_rgba(120,180,255,0.24)]" />
            </Panel>

            <Panel className="grid h-full min-h-0 grid-rows-4 gap-6 lg:col-start-3 lg:row-span-2 lg:row-start-1">
              <MenuButton label="Snack Gacha" className="h-full text-4xl" href="/gacha" />
              <MenuButton label="Character" className="h-full" href="/characterManagement" />
              <MenuButton label="Storage" className="h-full" href="/storage" />
              <MenuButton label="Community" className="h-full" href="/community" />
            </Panel>

            <Panel className="grid h-full min-h-0 grid-rows-3 gap-6">
              <MenuButton
                label="Mochi Soldier Surge"
                className="h-full"
                href="/mochiSoldierSurge"
              />
              <MenuButton label="Mochi General Battle" className="h-full" href="/mochiGeneralBattle" />
              <MenuButton label="Game" className="h-full" />
            </Panel>

            <Panel className="grid h-full min-h-0 grid-rows-2 gap-6">
              <MenuButton label="Subgame1" className="h-full" />
              <MenuButton label="Subgame2" className="h-full" />
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}
