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
      className={`relative overflow-hidden rounded-[24px] border border-slate-200/20 bg-[#0d1219]/90 p-6 shadow-[0_0_28px_rgba(90,140,220,0.14)] before:pointer-events-none before:absolute before:inset-[6px] before:rounded-[18px] before:border before:border-slate-200/10 before:content-[''] ${className}`}
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
  const sharedClassName = `group relative flex w-full items-center justify-center rounded-[20px] border border-slate-200/20 bg-[#111823]/90 px-7 py-7 text-center text-xl font-semibold tracking-wide text-slate-100 shadow-[0_0_18px_rgba(90,140,220,0.18)] transition duration-200 hover:border-slate-100/40 hover:shadow-[0_0_26px_rgba(130,190,255,0.26)] ${className}`;
  if (href) {
    return (
      <a href={href} className={sharedClassName}>
        <span className="relative z-10">{label}</span>
        <span className="pointer-events-none absolute inset-[6px] rounded-[16px] border border-slate-200/10 transition duration-200 group-hover:border-slate-100/25" />
      </a>
    );
  }
  return (
    <button className={sharedClassName}>
      <span className="relative z-10">{label}</span>
      <span className="pointer-events-none absolute inset-[6px] rounded-[16px] border border-slate-200/10 transition duration-200 group-hover:border-slate-100/25" />
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
    <main className="h-screen w-full bg-[#06080b] text-slate-200 overflow-hidden">
      <div className="relative h-full w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="pointer-events-none absolute right-6 top-6 z-20 flex items-center justify-center">
          <button
            type="button"
            aria-label="Evil button"
            className="pointer-events-auto group relative flex h-16 w-16 items-center justify-center rounded-full border border-rose-200/40 bg-[radial-gradient(circle_at_top,#3b0a12,#0a0d12_70%)] text-2xl font-semibold text-rose-200 shadow-[0_0_26px_rgba(248,113,113,0.35)] transition duration-200 hover:scale-105 hover:border-rose-100/80 hover:text-rose-100 hover:shadow-[0_0_34px_rgba(248,113,113,0.55)]"
          >
            <span className="relative z-10 translate-y-[1px]">{">:)"}</span>
            <span className="pointer-events-none absolute inset-[4px] rounded-full border border-rose-200/15" />
          </button>
        </div>
        <div className="mx-auto flex h-full w-full max-w-[1920px] items-stretch px-6 py-6 lg:px-12 xl:px-16">
          <div className="h-full w-full rounded-[36px] border border-slate-200/20 bg-[#0b1016]/80 py-10 px-12 shadow-[0_0_52px_rgba(70,120,210,0.22)] lg:py-12 lg:px-14">
            <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[1fr_1.5fr_1fr] lg:grid-rows-[280px_minmax(0,1fr)] xl:grid-rows-[320px_minmax(0,1fr)]">
              <Panel className="grid h-full min-h-0 grid-rows-3 gap-6">
                <div className="flex h-full items-center justify-center gap-3 text-base text-slate-200/90">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400/80 shadow-[0_0_10px_rgba(56,189,248,0.7)]" />
                  <span className="text-center text-2xl font-semibold tracking-wide md:text-3xl">
                    {username}
                    <span className="ml-2 inline-flex items-center text-amber-300">
                      {isAuthorised ? "★" : ""}
                    </span>
                  </span>
                </div>
                <a
                  href="/userSystem/userProfile"
                  className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] border border-slate-200/15 bg-[#111722]/80 px-4 py-2 text-sm font-semibold text-slate-100 shadow-[0_0_12px_rgba(90,140,220,0.16)] transition duration-200 hover:border-slate-100/35 hover:shadow-[0_0_18px_rgba(120,180,255,0.25)]"
                >
                  View my profile
                  <span className="pointer-events-none absolute inset-0 opacity-70">
                    <span className="absolute left-[10%] top-[18%] h-[70%] w-[2px] rotate-[10deg] bg-gradient-to-b from-transparent via-slate-100/25 to-transparent" />
                    <span className="absolute left-[44%] top-[8%] h-[84%] w-[2px] -rotate-[9deg] bg-gradient-to-b from-transparent via-slate-100/20 to-transparent" />
                    <span className="absolute left-[70%] top-[24%] h-[60%] w-[2px] rotate-[14deg] bg-gradient-to-b from-transparent via-slate-100/3 to-transparent" />
                    <span className="absolute left-[18%] top-[60%] h-[2px] w-[40%] -rotate-[7deg] bg-gradient-to-r from-transparent via-slate-100/25 to-transparent" />
                  </span>
                  <span className="pointer-events-none absolute inset-[5px] rounded-[14px] border border-slate-200/10" />
                </a>
                <form action="/api/logout" method="post" className="h-full w-full">
                  <button
                    type="submit"
                    className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] border border-slate-200/15 bg-[#111722]/80 px-4 py-2 text-sm font-semibold text-slate-100 shadow-[0_0_12px_rgba(90,140,220,0.16)] transition duration-200 hover:border-slate-100/35 hover:shadow-[0_0_18px_rgba(120,180,255,0.25)]"
                  >
                    Log out
                    <span className="pointer-events-none absolute inset-0 opacity-70">
                      <span className="absolute left-[12%] top-[18%] h-[70%] w-[2px] rotate-[12deg] bg-gradient-to-b from-transparent via-slate-100/30 to-transparent" />
                      <span className="absolute left-[48%] top-[10%] h-[80%] w-[2px] -rotate-[8deg] bg-gradient-to-b from-transparent via-slate-100/25 to-transparent" />
                      <span className="absolute left-[72%] top-[22%] h-[60%] w-[2px] rotate-[16deg] bg-gradient-to-b from-transparent via-slate-100/35 to-transparent" />
                      <span className="absolute left-[20%] top-[62%] h-[2px] w-[38%] -rotate-[6deg] bg-gradient-to-r from-transparent via-slate-100/25 to-transparent" />
                    </span>
                    <span className="pointer-events-none absolute inset-[5px] rounded-[14px] border border-slate-200/10" />
                  </button>
                </form>
              </Panel>

              <Panel className="flex h-full items-center justify-between gap-10 px-10 py-8">
                <div className="h-14 w-14 rounded-full border border-slate-200/30 bg-[#0d141d]/90 shadow-[0_0_18px_rgba(120,180,255,0.24)]" />
                <div className="text-center text-6xl font-semibold italic tracking-[0.2em] text-slate-100 md:text-7xl">
                  Lab 7½
                </div>
                <div className="h-14 w-14 rounded-full border border-slate-200/30 bg-[#0d141d]/90 shadow-[0_0_18px_rgba(120,180,255,0.24)]" />
              </Panel>

              <Panel className="grid h-full min-h-0 grid-rows-4 gap-6 lg:col-start-3 lg:row-span-2 lg:row-start-1">
                <MenuButton
                  label="Snack Gacha"
                  className="h-full text-4xl"
                  href="/gacha"
                />
                <MenuButton
                  label="Character"
                  className="h-full"
                  href="/characterManagement"
                />
                <MenuButton label="Storage" className="h-full" href="/storage" />
                <MenuButton label="Community" className="h-full" href="/community" />
              </Panel>

              <Panel className="grid h-full min-h-0 grid-rows-3 gap-6">
                <MenuButton label="Game 1" className="h-full" /> {/* Mech Onslaught */}
                <MenuButton label="Game 2" className="h-full" /> {/* Dragon Hunter */}
                <MenuButton label="Game" className="h-full" /> {/* Bluestone Colossus */}
              </Panel>

              <Panel className="grid h-full min-h-0 grid-rows-2 gap-6">
                <MenuButton label="Subgame1" className="h-full" /> {/* Deathmatch */}
                <MenuButton label="Subgame2" className="h-full" /> {/* Can Wars */}
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
