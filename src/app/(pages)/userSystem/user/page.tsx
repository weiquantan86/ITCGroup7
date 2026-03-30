import type { ReactNode } from "react";
import { cookies } from "next/headers";
import EmailLauncher from "@/app/components/email/EmailLauncher";
import pool from "../../../../database/client";
import { ConnectionTimeoutWarning } from "./warning/ConnectionTimeoutWarning";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

function Panel({ children, className = "" }: PanelProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[clamp(20px,2vw,28px)] border border-white/10 bg-white/[0.04] p-[clamp(0.7rem,1.1vw,1.4rem)] shadow-[0_0_24px_rgba(59,130,246,0.14)] backdrop-blur-md before:pointer-events-none before:absolute before:inset-[clamp(4px,0.35vw,6px)] before:rounded-[clamp(14px,1.4vw,20px)] before:border before:border-white/10 before:content-[''] ${className}`}
    >
      {children}
    </div>
  );
}

type MenuButtonProps = {
  label: string;
  className?: string;
  href?: string;
  art?: MenuArtKind;
};

type MenuArtKind =
  | "snack"
  | "character"
  | "storage"
  | "community"
  | "surge"
  | "battle"
  | "lab"
  | "origin"
  | "starshop";

function MenuArtwork({ kind }: { kind: MenuArtKind }) {
  const baseProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 3.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "snack":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full text-white/90" aria-hidden="true">
          <path {...baseProps} d="M50 150 66 80l26-27h56l25 26-10 71H76Z" />
          <path {...baseProps} d="m92 53-10-30 32 13 18-18 14 35" />
          <path {...baseProps} d="m66 80 18 17m89-17-20 18M95 53l10 97m33-97-10 97" />
          <path {...baseProps} d="M95 83c12 7 26 10 42 10m-40 20c12 7 28 11 46 11" />
          <path {...baseProps} d="M103 119c8 4 14 10 17 18m18-20c9 3 16 8 21 15" />
        </svg>
      );
    case "character":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full text-white/75" aria-hidden="true">
          <path {...baseProps} d="M140 57c0 23-18 41-40 41S60 80 60 57 78 16 100 16s40 18 40 41Z" />
          <path {...baseProps} d="M52 156c14-28 42-45 69-45 30 0 57 17 70 45" />
          <path {...baseProps} d="M81 60c4 6 10 10 18 11m22 0c8-2 13-5 18-11m-28-22c4-9 13-14 24-14" />
        </svg>
      );
    case "storage":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full text-white/75" aria-hidden="true">
          <path {...baseProps} d="M58 62 120 31l62 31-62 30-62-30Z" />
          <path {...baseProps} d="M58 62v54l62 33 62-33V62" />
          <path {...baseProps} d="M120 92v57M91 46l58 30m-62 15 33 17" />
        </svg>
      );
    case "community":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full text-white/72" aria-hidden="true">
          <path {...baseProps} d="M44 53h84a18 18 0 0 1 18 18v32a18 18 0 0 1-18 18H91l-25 22v-22H44a18 18 0 0 1-18-18V71a18 18 0 0 1 18-18Z" />
          <path {...baseProps} d="M146 78h45a18 18 0 0 1 18 18v26a18 18 0 0 1-18 18h-15l-18 15v-15h-12a18 18 0 0 1-18-18V96a18 18 0 0 1 18-18Z" />
          <path {...baseProps} d="M64 86h43m-43 18h28m95 5h-27m-74-23h0" />
          <circle {...baseProps} cx="63" cy="86" r="1" />
        </svg>
      );
    case "surge":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full text-white/78" aria-hidden="true">
          <path {...baseProps} d="M63 150 109 49l14 41 31-9-53 93-10-42-28 5Z" />
          <path {...baseProps} d="M134 47c17 5 31 13 45 24m-35 21c13 3 24 9 35 18m-98 12c20 1 37 8 55 20" />
        </svg>
      );
    case "battle":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full text-white/76" aria-hidden="true">
          <path {...baseProps} d="M82 49 113 80m0 0 46 46m-46-46 10-34 23-11-10 24-23 11Z" />
          <path {...baseProps} d="m158 49-31 31m0 0-46 46m46-46-10-34-23-11 10 24 23 11Z" />
          <circle {...baseProps} cx="120" cy="95" r="17" />
        </svg>
      );
    case "lab":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full text-white/72" aria-hidden="true">
          <path {...baseProps} d="M94 33h52m-15 0v34l34 56a15 15 0 0 1-13 23H88a15 15 0 0 1-13-23l34-56V33" />
          <path {...baseProps} d="M90 103c11 8 21 11 32 11 12 0 24-4 39-17" />
          <circle {...baseProps} cx="99" cy="124" r="5" />
          <circle {...baseProps} cx="130" cy="133" r="8" />
          <circle {...baseProps} cx="151" cy="110" r="4" />
        </svg>
      );
    case "origin":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full text-white/70" aria-hidden="true">
          <path {...baseProps} d="M49 129 90 88l33 17 52-44" />
          <path {...baseProps} d="M68 58h35m34 0h35m-69 76h39" />
          <circle {...baseProps} cx="49" cy="129" r="8" />
          <circle {...baseProps} cx="90" cy="88" r="8" />
          <circle {...baseProps} cx="123" cy="105" r="8" />
          <circle {...baseProps} cx="175" cy="61" r="8" />
        </svg>
      );
    case "starshop":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full text-white/78" aria-hidden="true">
          <path {...baseProps} d="m67 86 11-24 33-4 19-22 16 23 32 5 12 22-18 22 4 32-30 13-16 24-23-20-33 7-6-33-29-16 8-31-18-28Z" />
          <path {...baseProps} d="m120 66 8 16 18 3-13 12 3 18-16-9-16 9 3-18-13-12 18-3 8-16Z" />
          <path {...baseProps} d="M51 145h138M164 145l8 20m-92-20-8 20" />
          <path {...baseProps} d="M183 74h22m-11-11v22" />
        </svg>
      );
  }
}

function MenuButton({ label, className = "", href, art }: MenuButtonProps) {
  const sharedClassName = `group relative isolate flex w-full items-start justify-start overflow-hidden rounded-[20px] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.04),transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.98)_0%,rgba(24,35,58,0.94)_54%,rgba(15,23,42,0.98)_100%)] px-4 py-4 text-slate-100 shadow-[0_10px_28px_rgba(15,23,42,0.3)] transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_16px_34px_rgba(15,23,42,0.42)] ${className}`;
  const labelNode = (
    <span
      className={`pointer-events-none absolute left-3 top-3 z-40 block origin-top-left text-left text-[clamp(1.1rem,1.65vw,2.1rem)] font-thin uppercase leading-[0.9] tracking-[0.2em] text-slate-50 drop-shadow-[0_1px_10px_rgba(2,6,23,0.9)] [text-wrap:balance] [transform:scaleX(0.84)] ${
        art ? "max-w-[50%]" : "max-w-[78%]"
      }`}
    >
      {label}
    </span>
  );
  const textShieldNode = art ? (
    <span className="pointer-events-none absolute left-0 top-0 z-20 h-[58%] w-[58%] rounded-br-[44px] bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,1)_0%,rgba(15,23,42,0.98)_34%,rgba(15,23,42,0.86)_58%,rgba(15,23,42,0.18)_82%,transparent_100%)]" />
  ) : null;
  const artNode = art ? (
    <span className="pointer-events-none absolute bottom-2 right-2 z-10 flex h-[62%] w-[46%] items-center justify-center opacity-82">
      <MenuArtwork kind={art} />
    </span>
  ) : null;
  const frameNode = (
    <span className="pointer-events-none absolute inset-0 z-0">
      <span className="pointer-events-none absolute inset-[2px] rounded-[18px] border border-white/[0.04]" />
      <span className="pointer-events-none absolute inset-[7px] rounded-[16px] border border-white/[0.08] transition duration-200 group-hover:border-white/[0.12]" />
      <span className="pointer-events-none absolute inset-[11px] rounded-[13px] border border-white/[0.05]" />
      <span className="pointer-events-none absolute left-6 top-6 h-px w-11 bg-gradient-to-r from-white/45 to-transparent opacity-50" />
      <span className="pointer-events-none absolute left-6 top-6 h-11 w-px bg-gradient-to-b from-white/30 to-transparent opacity-45" />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.018)_0%,rgba(255,255,255,0)_36%,rgba(255,255,255,0.04)_58%,rgba(255,255,255,0)_76%)] opacity-90" />
    </span>
  );

  if (href) {
    return (
      <a href={href} className={sharedClassName}>
        {frameNode}
        {artNode}
        {textShieldNode}
        {labelNode}
      </a>
    );
  }

  return (
    <button className={sharedClassName}>
      {frameNode}
      {artNode}
      {textShieldNode}
      {labelNode}
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

const isConnectionTimeoutError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const record = error as {
    message?: unknown;
    code?: unknown;
    name?: unknown;
    cause?: unknown;
  };
  const cause = record.cause as { message?: unknown; code?: unknown } | undefined;
  const combined = [
    record.message,
    record.code,
    record.name,
    cause?.message,
    cause?.code,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    combined.includes("timeout") ||
    combined.includes("etimedout") ||
    combined.includes("connection terminated due to connection timeout")
  );
};

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
  let hasUnreadEmail = false;
  try {
    const [userQuery, unreadEmailQuery] = await Promise.all([
      pool.query("SELECT username, is_authorised FROM users WHERE id = $1", [
        userId,
      ]),
      pool.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM user_email
            WHERE (user_id = $1 OR user_id IS NULL)
              AND is_read = FALSE
          ) AS has_unread
        `,
        [userId]
      ),
    ]);
    if (userQuery.rows.length === 0) {
      return <ErrorState message="Load failed: user does not exist." />;
    }
    username = userQuery.rows[0].username;
    isAuthorised = Boolean(userQuery.rows[0].is_authorised);
    hasUnreadEmail = Boolean(unreadEmailQuery.rows[0]?.has_unread);
  } catch (error) {
    if (isConnectionTimeoutError(error)) {
      return <ConnectionTimeoutWarning />;
    }
    return <ErrorState message="Load failed: unable to read user information." />;
  }

  const stageWidth =
    "min(calc(100vw - 2rem), calc((100dvh - 4.5rem) * 16 / 9), 1760px)";
  const stageHeight = `calc(${stageWidth} * 9 / 16)`;

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-[#05070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_25%,rgba(251,146,60,0.46),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(96,165,250,0.4),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.62)_48%,rgba(2,6,23,0.86)_68%,rgba(2,6,23,0.95)_100%)]" />

      <div className="relative z-10 flex min-h-[100dvh] w-full items-center justify-center p-[clamp(0.6rem,1.2vw,1rem)]">
        <div style={{ width: stageWidth, height: stageHeight }} className="relative">
          <div className="h-full w-full rounded-[clamp(24px,2.4vw,36px)] border border-white/10 bg-white/[0.03] px-[clamp(0.8rem,1.8vw,3.2rem)] py-[clamp(0.8rem,2.2dvh,2.6rem)] shadow-[0_0_44px_rgba(59,130,246,0.16)] backdrop-blur-md">
            <div className="grid h-full min-h-0 gap-[clamp(0.5rem,1vw,1.2rem)] grid-cols-[1fr_1.5fr_1fr] grid-rows-[minmax(180px,0.72fr)_minmax(0,1.28fr)]">
            <Panel className="grid h-full min-h-0 grid-rows-3 gap-[clamp(0.5rem,0.9vw,1.1rem)]">
              <div className="relative flex h-full min-h-0 items-center justify-center">
                <div className="absolute left-0 top-1/2 z-10 -translate-y-1/2">
                  <EmailLauncher
                    username={username}
                    initialHasUnreadEmail={hasUnreadEmail}
                  />
                </div>
                <span className="flex min-w-0 items-center justify-center gap-3 px-[clamp(3rem,5vw,5rem)] text-base text-slate-200/90">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400/80 shadow-[0_0_10px_rgba(56,189,248,0.7)]" />
                  <span className="inline-flex items-center text-center text-[clamp(1.25rem,2.15vw,1.9rem)] font-semibold tracking-wide">
                    {username}
                    {isAuthorised ? (
                      <span className="ml-2.5 inline-flex h-[clamp(1.5rem,2vw,2rem)] w-[clamp(1.5rem,2vw,2rem)] items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-full w-full drop-shadow-[0_0_10px_rgba(251,191,36,0.95)]"
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
                </span>
              </div>

              <a
                href="/userSystem/userProfile"
                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] border border-white/15 bg-gradient-to-r from-orange-500/85 to-pink-500/80 px-4 py-2 text-[clamp(1rem,1.7vw,1.45rem)] font-semibold tracking-[0.06em] text-white shadow-[0_10px_30px_rgba(236,72,153,0.28)] transition duration-200 hover:brightness-105"
              >
                View my profile
                <span className="pointer-events-none absolute inset-[5px] rounded-[14px] border border-white/20" />
              </a>

              <form action="/api/logout" method="post" className="h-full w-full">
                <button
                  type="submit"
                  className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] border border-white/15 bg-gradient-to-r from-sky-500/85 to-cyan-400/85 px-4 py-2 text-[clamp(1rem,1.7vw,1.45rem)] font-semibold tracking-[0.06em] text-white shadow-[0_10px_30px_rgba(14,165,233,0.28)] transition duration-200 hover:brightness-105"
                >
                  Log out
                  <span className="pointer-events-none absolute inset-[5px] rounded-[14px] border border-white/20" />
                </button>
              </form>
            </Panel>

            <Panel className="flex h-full items-center justify-between gap-[clamp(0.8rem,2vw,2.5rem)] px-[clamp(0.8rem,2vw,2.5rem)] py-[clamp(0.7rem,1.8dvh,1.9rem)]">
              <div className="h-[clamp(2.2rem,3vw,3.5rem)] w-[clamp(2.2rem,3vw,3.5rem)] rounded-full border border-white/20 bg-white/10 shadow-[0_0_18px_rgba(120,180,255,0.24)]" />
              <div className="bg-gradient-to-r from-orange-400 via-pink-500 to-sky-400 bg-clip-text text-center text-[clamp(2.4rem,4.5vw,4.8rem)] font-semibold italic tracking-[0.16em] text-transparent">
                Strike!
              </div>
              <div className="h-[clamp(2.2rem,3vw,3.5rem)] w-[clamp(2.2rem,3vw,3.5rem)] rounded-full border border-white/20 bg-white/10 shadow-[0_0_18px_rgba(120,180,255,0.24)]" />
            </Panel>

            <Panel className="grid h-full min-h-0 grid-rows-4 gap-[clamp(0.5rem,0.9vw,1.1rem)] col-start-3 row-span-2 row-start-1">
              <MenuButton label="Snack Gacha" art="snack" className="h-full" href="/gacha" />
              <MenuButton label="Character" art="character" className="h-full" href="/characterManagement" />
              <MenuButton label="Storage" art="storage" className="h-full" href="/storage" />
              <MenuButton label="Community" art="community" className="h-full" href="/community" />
            </Panel>

            <Panel className="grid h-full min-h-0 grid-rows-3 gap-[clamp(0.5rem,0.9vw,1.1rem)]">
              <MenuButton
                label="Mochi Soldier Surge"
                art="surge"
                className="h-full"
                href="/mochiSoldierSurge"
              />
              <MenuButton label="Mochi General Battle" art="battle" className="h-full" href="/mochiGeneralBattle" />
              <MenuButton label="? ? ?" art="lab" className="h-full" href="/madacombat" />
            </Panel>

            <Panel className="grid h-full min-h-0 grid-rows-2 gap-[clamp(0.5rem,0.9vw,1.1rem)]">
              <MenuButton label="Origin" art="origin" className="h-full" href="/origin"/>
              <MenuButton label="Star Shop" art="starshop" className="h-full" href="/starshop" />
            </Panel>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
