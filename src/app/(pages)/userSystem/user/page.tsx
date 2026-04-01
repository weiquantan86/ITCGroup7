import type { CSSProperties, ReactNode } from "react";
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

type MenuTheme = {
  surfaceStart: string;
  surfaceMid: string;
  surfaceEnd: string;
  border: string;
  glow: string;
  hoverGlow: string;
  shieldTint: string;
  highlight: string;
  text: string;
  iconPrimary: string;
  iconSecondary: string;
  iconTertiary: string;
  shadow: string;
};

const defaultMenuTheme: MenuTheme = {
  surfaceStart: "rgba(17,24,39,0.98)",
  surfaceMid: "rgba(30,41,59,0.95)",
  surfaceEnd: "rgba(15,23,42,0.98)",
  border: "rgba(255,255,255,0.12)",
  glow: "rgba(96,165,250,0.18)",
  hoverGlow: "rgba(148,163,184,0.16)",
  shieldTint: "rgba(59,130,246,0.1)",
  highlight: "rgba(255,255,255,0.1)",
  text: "rgba(248,250,252,0.98)",
  iconPrimary: "rgba(255,255,255,0.9)",
  iconSecondary: "rgba(191,219,254,0.95)",
  iconTertiary: "rgba(226,232,240,0.88)",
  shadow: "rgba(15,23,42,0.34)",
};

const menuThemes: Record<MenuArtKind, MenuTheme> = {
  snack: {
    surfaceStart: "rgba(49,24,13,0.98)",
    surfaceMid: "rgba(94,45,19,0.94)",
    surfaceEnd: "rgba(40,17,22,0.98)",
    border: "rgba(251,191,36,0.28)",
    glow: "rgba(251,191,36,0.22)",
    hoverGlow: "rgba(244,114,182,0.18)",
    shieldTint: "rgba(251,191,36,0.12)",
    highlight: "rgba(253,224,71,0.18)",
    text: "rgba(255,250,240,0.98)",
    iconPrimary: "rgba(254,240,138,0.98)",
    iconSecondary: "rgba(251,191,36,0.98)",
    iconTertiary: "rgba(253,164,175,0.92)",
    shadow: "rgba(120,53,15,0.34)",
  },
  character: {
    surfaceStart: "rgba(34,19,55,0.98)",
    surfaceMid: "rgba(68,34,110,0.94)",
    surfaceEnd: "rgba(26,18,51,0.98)",
    border: "rgba(192,132,252,0.28)",
    glow: "rgba(168,85,247,0.22)",
    hoverGlow: "rgba(244,114,182,0.18)",
    shieldTint: "rgba(168,85,247,0.12)",
    highlight: "rgba(216,180,254,0.18)",
    text: "rgba(250,245,255,0.98)",
    iconPrimary: "rgba(233,213,255,0.96)",
    iconSecondary: "rgba(192,132,252,0.98)",
    iconTertiary: "rgba(244,114,182,0.92)",
    shadow: "rgba(76,29,149,0.34)",
  },
  storage: {
    surfaceStart: "rgba(12,43,37,0.98)",
    surfaceMid: "rgba(15,72,74,0.94)",
    surfaceEnd: "rgba(10,28,37,0.98)",
    border: "rgba(45,212,191,0.28)",
    glow: "rgba(16,185,129,0.2)",
    hoverGlow: "rgba(34,211,238,0.18)",
    shieldTint: "rgba(16,185,129,0.11)",
    highlight: "rgba(94,234,212,0.18)",
    text: "rgba(236,253,245,0.98)",
    iconPrimary: "rgba(167,243,208,0.98)",
    iconSecondary: "rgba(45,212,191,0.98)",
    iconTertiary: "rgba(103,232,249,0.92)",
    shadow: "rgba(6,78,59,0.34)",
  },
  community: {
    surfaceStart: "rgba(15,36,58,0.98)",
    surfaceMid: "rgba(20,68,114,0.94)",
    surfaceEnd: "rgba(13,23,48,0.98)",
    border: "rgba(56,189,248,0.28)",
    glow: "rgba(56,189,248,0.2)",
    hoverGlow: "rgba(103,232,249,0.18)",
    shieldTint: "rgba(56,189,248,0.1)",
    highlight: "rgba(125,211,252,0.18)",
    text: "rgba(240,249,255,0.98)",
    iconPrimary: "rgba(186,230,253,0.98)",
    iconSecondary: "rgba(56,189,248,0.98)",
    iconTertiary: "rgba(103,232,249,0.92)",
    shadow: "rgba(8,47,73,0.34)",
  },
  surge: {
    surfaceStart: "rgba(62,19,16,0.98)",
    surfaceMid: "rgba(125,44,35,0.94)",
    surfaceEnd: "rgba(38,13,21,0.98)",
    border: "rgba(251,113,133,0.28)",
    glow: "rgba(249,115,22,0.22)",
    hoverGlow: "rgba(251,146,60,0.18)",
    shieldTint: "rgba(249,115,22,0.11)",
    highlight: "rgba(253,186,116,0.18)",
    text: "rgba(255,245,245,0.98)",
    iconPrimary: "rgba(254,202,202,0.96)",
    iconSecondary: "rgba(251,113,133,0.98)",
    iconTertiary: "rgba(251,146,60,0.94)",
    shadow: "rgba(127,29,29,0.34)",
  },
  battle: {
    surfaceStart: "rgba(47,20,18,0.98)",
    surfaceMid: "rgba(92,28,43,0.94)",
    surfaceEnd: "rgba(37,17,20,0.98)",
    border: "rgba(251,146,60,0.28)",
    glow: "rgba(248,113,113,0.2)",
    hoverGlow: "rgba(252,211,77,0.18)",
    shieldTint: "rgba(248,113,113,0.1)",
    highlight: "rgba(254,215,170,0.18)",
    text: "rgba(255,247,237,0.98)",
    iconPrimary: "rgba(254,226,226,0.98)",
    iconSecondary: "rgba(251,146,60,0.98)",
    iconTertiary: "rgba(252,211,77,0.94)",
    shadow: "rgba(127,29,29,0.34)",
  },
  lab: {
    surfaceStart: "rgba(22,42,17,0.98)",
    surfaceMid: "rgba(36,82,47,0.94)",
    surfaceEnd: "rgba(13,27,29,0.98)",
    border: "rgba(163,230,53,0.28)",
    glow: "rgba(74,222,128,0.18)",
    hoverGlow: "rgba(45,212,191,0.18)",
    shieldTint: "rgba(163,230,53,0.1)",
    highlight: "rgba(190,242,100,0.16)",
    text: "rgba(247,254,231,0.98)",
    iconPrimary: "rgba(217,249,157,0.98)",
    iconSecondary: "rgba(52,211,153,0.98)",
    iconTertiary: "rgba(163,230,53,0.92)",
    shadow: "rgba(22,101,52,0.3)",
  },
  origin: {
    surfaceStart: "rgba(49,16,34,0.98)",
    surfaceMid: "rgba(95,31,78,0.94)",
    surfaceEnd: "rgba(24,16,49,0.98)",
    border: "rgba(244,114,182,0.28)",
    glow: "rgba(236,72,153,0.2)",
    hoverGlow: "rgba(192,132,252,0.18)",
    shieldTint: "rgba(244,114,182,0.1)",
    highlight: "rgba(249,168,212,0.18)",
    text: "rgba(253,242,248,0.98)",
    iconPrimary: "rgba(251,207,232,0.98)",
    iconSecondary: "rgba(244,114,182,0.98)",
    iconTertiary: "rgba(216,180,254,0.92)",
    shadow: "rgba(131,24,67,0.32)",
  },
  starshop: {
    surfaceStart: "rgba(44,30,8,0.98)",
    surfaceMid: "rgba(90,61,18,0.94)",
    surfaceEnd: "rgba(24,24,42,0.98)",
    border: "rgba(250,204,21,0.28)",
    glow: "rgba(250,204,21,0.22)",
    hoverGlow: "rgba(125,211,252,0.16)",
    shieldTint: "rgba(250,204,21,0.1)",
    highlight: "rgba(253,224,71,0.18)",
    text: "rgba(255,251,235,0.98)",
    iconPrimary: "rgba(254,243,199,0.98)",
    iconSecondary: "rgba(250,204,21,0.98)",
    iconTertiary: "rgba(125,211,252,0.92)",
    shadow: "rgba(120,53,15,0.3)",
  },
};

function resolveMenuTheme(art?: MenuArtKind) {
  return art ? menuThemes[art] : defaultMenuTheme;
}

function MenuArtwork({ kind, theme }: { kind: MenuArtKind; theme: MenuTheme }) {
  const baseProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 3.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const secondaryProps = {
    ...baseProps,
    stroke: theme.iconSecondary,
  };
  const tertiaryProps = {
    ...baseProps,
    stroke: theme.iconTertiary,
  };
  const svgStyle: CSSProperties = {
    color: theme.iconPrimary,
    filter: `drop-shadow(0 0 18px ${theme.glow})`,
  };

  switch (kind) {
    case "snack":
      return (
        <svg
          viewBox="-20 -40 240 180"
          className="h-full w-full"
          style={svgStyle}
          aria-hidden="true"
        >
          <path
            {...baseProps}
            d="M10 60
            L10 10
            A10 -10 0 0 1 20 0
            L120 0
            A10 -10 0 0 1 130 10
            L130 120
            A10 -10 0 0 1 120 130
            L20 130
            A10 -10 0 0 1 10 120
            Z"
          />
          <path {...secondaryProps} d="M10 5 30 -40 50 0 70 -40 90 0 110 -40 130 5" />
          <path {...baseProps} d="M10 30 130 30" />
          <path
            {...tertiaryProps}
            d="M70 100 45 115 50 95 35 80 55 80 70 50 85 80 105 80 90 95 95 115 70 100"
          />
        </svg>
      );
    case "character":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full" style={svgStyle} aria-hidden="true">
          <circle cx="120" cy="70" r="60" fill="none" stroke="currentColor" strokeWidth="4" />
          <path {...baseProps} d="M105 70 80 50" />
          <path {...baseProps} d="M105 85 85 100" />
          <path {...baseProps} d="M 85 100 Q 60 75, 80 50" fill="none" />
          <path {...baseProps} d="M 80 105 Q 55 75, 75 45" fill="none" />
          <path {...secondaryProps} d="M135 70 160 50" />
          <path {...secondaryProps} d="M135 90 155 100" />
          <path {...secondaryProps} d="M 160 50 Q 175 75, 155 100" fill="none" />
          <path {...secondaryProps} d="M 165 45 Q 180 75, 160 105" fill="none" />
          <circle cx="30" cy="100" r="20" fill="none" stroke={theme.iconTertiary} strokeWidth="4" />
          <circle cx="200" cy="110" r="20" fill="none" stroke={theme.iconSecondary} strokeWidth="4" />
        </svg>
      );
    case "storage":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full" style={svgStyle} aria-hidden="true">
          <path {...baseProps} d="M58 62 120 31 l62 31 -62 30 -62 -30Z" />
          <path {...baseProps} d="M58 62v54l62 33 62-33V62" />
          <path {...secondaryProps} d="M120 92v57M91 46" />
          <path {...tertiaryProps} d="M59 90 l61 30 l61 -30" />
        </svg>
      );
    case "community":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full" style={svgStyle} aria-hidden="true">
          <path
            {...baseProps}
            d="M44 53h84a18 18 0 0 1 18 18v32a18 18 0 0 1-18 18H91l-25 22v-22H44a18 18 0 0 1-18-18V71a18 18 0 0 1 18-18Z"
          />
          <path
            {...secondaryProps}
            d="M166 78h45a18 18 0 0 1 18 18v26a18 18 0 0 1-18 18h-15l-18 15v-15h-12a18 18 0 0 1-18-18V96a18 18 0 0 1 18-18Z"
          />
          <path {...tertiaryProps} d="M84 86h43m-43 18h28 m87 5 h-27" />
        </svg>
      );
    case "surge":
      return (
        <svg viewBox="0 -50 240 180" className="h-full w-full" style={svgStyle} aria-hidden="true">
          <path {...baseProps} d="" />
          <circle cx="100" cy="30" r="65" fill="none" stroke="currentColor" strokeWidth="4" />
          <path {...secondaryProps} d="M90 35 q-35 13 -28 -20" />
          <path {...secondaryProps} d="M90 35 l-28 -20" />
          <path {...secondaryProps} d="M110 35 l28 -20" />
          <path {...secondaryProps} d="M110 35 q35 13 28 -20" />
          <path {...tertiaryProps} d="M170 100 l15 7.5 40 -100 -15 -7.5Z" />
          <path {...tertiaryProps} d="M227 8 l10 5 -6 -50 -30 33Z" />
        </svg>
      );
    case "battle":
      return (
        <svg viewBox="0 -20 240 180" className="h-full w-full" style={svgStyle} aria-hidden="true">
          <circle cx="130" cy="85" r="65" fill="none" stroke="currentColor" strokeWidth="4" />
          <path {...secondaryProps} d="M125 90 q-50 18 -40 -30" />
          <path {...secondaryProps} d="M125 90 l-40 -30" />
          <path {...secondaryProps} d="M135 90 l40 -30" />
          <path {...secondaryProps} d="M135 90 q50 13 40 -30" />
          <path {...tertiaryProps} d="M10 152 l10 0 0 -20 -10 0 0 20" />
          <path {...tertiaryProps} d="M10 132 l-10 -10 30 0 -10 10" />
          <path {...tertiaryProps} d="M10 122 l-5 -100 10 -20 10 20 -5 100" />
          <circle cx="230" cy="110" r="30" fill="none" stroke={theme.iconSecondary} strokeWidth="4" />
          <rect x="198" y="105" width="65" height="15" fill={theme.iconSecondary} />
          <path {...baseProps} d="M90 20 l80 0 5 -20 -25 10 -20 -20 -20 20 -25 -10Z" />
        </svg>
      );
    case "lab":
      return (
        <svg viewBox="0 -20 240 180" className="h-full w-full" style={svgStyle} aria-hidden="true">
          <path
            {...baseProps}
            d="M94 33h52m-15 0v34l34 56a15 15 0 0 1-13 23H88a15 15 0 0 1-13-23l34-56V33"
          />
          <path {...secondaryProps} d="M110 60 l20 0" />
          <circle {...tertiaryProps} cx="99" cy="124" r="5" />
          <circle {...secondaryProps} cx="130" cy="133" r="8" />
          <circle {...tertiaryProps} cx="151" cy="110" r="4" />
          <path {...baseProps} d="M92 33 v-20 h56 v20" />
          <path {...secondaryProps} stroke="red" d="M82 53 l-50 -30 q -10 60 50 30" />
          <path {...secondaryProps} stroke="red" d="M152 53 l50 -30 q 10 60 -50 30" />
        </svg>
      );
    case "origin":
      return (
        <svg viewBox="00 240 180" className="h-full w-full" style={svgStyle} aria-hidden="true">
          <circle {...baseProps} cx="150" cy="40" r="30" />
          <path {...secondaryProps} d="M132 68 q-30 20 -20 50" />
          <path {...secondaryProps} d="M168 68 q30 20 20 50" />
          <path
            {...tertiaryProps}
            d="M150 35 q45 -25 0 30 M150 35 q-45 -25 0 30"
          />
        </svg>
      );
    case "starshop":
      return (
        <svg viewBox="0 0 240 180" className="h-full w-full" style={svgStyle} aria-hidden="true">
          <path {...baseProps} d="M75 145 v-90 h90 v90" />
          <path
            {...secondaryProps}
            d="M80 55 l-20 -10 20 -10 10 5 30 -30 30 30 10 -5 20 10 -20 10"
          />
          <path
            {...tertiaryProps}
            d="m120 66 8 16 18 3-13 12 3 18-16-9-16 9 3-18-13-12 18-3 8-16Z"
          />
          <path {...baseProps} d="M51 145h138M164 145l8 20m-92-20-8 20" />
          <path {...secondaryProps} d="M183 74h22m-11-11v22" />
        </svg>
      );
  }
}

function MenuButton({ label, className = "", href, art }: MenuButtonProps) {
  const theme = resolveMenuTheme(art);
  const sharedClassName = `group relative isolate flex w-full items-start justify-start overflow-hidden rounded-[20px] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.04),transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.98)_0%,rgba(24,35,58,0.94)_54%,rgba(15,23,42,0.98)_100%)] px-4 py-4 text-slate-100 shadow-[0_10px_28px_rgba(15,23,42,0.3)] transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_16px_34px_rgba(15,23,42,0.42)] ${className}`;

  const labelNode = (
    <span
      className={`pointer-events-none absolute left-3 top-3 z-40 block origin-top-left bg-[linear-gradient(90deg,#fb7185_0%,#f59e0b_18%,#fde047_34%,#4ade80_50%,#38bdf8_68%,#a78bfa_84%,#f472b6_100%)] bg-clip-text text-left text-[clamp(1.1rem,1.65vw,2.1rem)] font-thin uppercase leading-[0.9] tracking-[0.2em] text-transparent drop-shadow-[0_1px_10px_rgba(2,6,23,0.9)] [text-wrap:balance] [transform:scaleX(0.84)] ${
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
    <span className="pointer-events-none absolute bottom-2 right-2 z-10 flex h-[62%] w-[46%] items-center justify-center opacity-95">
      <MenuArtwork kind={art} theme={theme} />
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
    <button type="button" className={sharedClassName}>
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_20%,rgba(251,146,60,0.42),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_14%,rgba(96,165,250,0.34),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_82%,rgba(74,222,128,0.24),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_74%,rgba(244,114,182,0.22),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_48%,rgba(168,85,247,0.14),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(2,6,23,0.18)_0%,rgba(2,6,23,0.5)_38%,rgba(2,6,23,0.82)_68%,rgba(2,6,23,0.96)_100%)]" />

      <div className="relative z-10 flex min-h-[100dvh] w-full items-center justify-center p-[clamp(0.6rem,1.2vw,1rem)]">
        <div style={{ width: stageWidth, height: stageHeight }} className="relative">
          <div className="h-full w-full rounded-[clamp(24px,2.4vw,36px)] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.055),transparent_28%),linear-gradient(155deg,rgba(7,11,19,0.9)_0%,rgba(11,17,30,0.92)_48%,rgba(5,8,14,0.95)_100%)] px-[clamp(0.8rem,1.8vw,3.2rem)] py-[clamp(0.8rem,2.2dvh,2.6rem)] shadow-[0_0_48px_rgba(34,197,94,0.06),0_0_64px_rgba(96,165,250,0.08),0_0_88px_rgba(236,72,153,0.08)] backdrop-blur-md">
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

              <Panel className="flex h-full items-center justify-between gap-[clamp(0.8rem,2vw,2.5rem)] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_32%),linear-gradient(145deg,rgba(42,17,40,0.75)_0%,rgba(15,23,42,0.86)_52%,rgba(16,28,53,0.82)_100%)] px-[clamp(0.8rem,2vw,2.5rem)] py-[clamp(0.7rem,1.8dvh,1.9rem)] shadow-[0_0_34px_rgba(236,72,153,0.1)]">
                <div className="h-[clamp(2.2rem,3vw,3.5rem)] w-[clamp(2.2rem,3vw,3.5rem)] rounded-full border border-pink-200/20 bg-[radial-gradient(circle_at_35%_35%,rgba(251,191,36,0.52),rgba(236,72,153,0.18)_60%,transparent_76%)] shadow-[0_0_24px_rgba(251,191,36,0.16)]" />
                <div className="bg-gradient-to-r from-orange-400 via-pink-500 to-sky-400 bg-clip-text text-center text-[clamp(2.4rem,4.5vw,4.8rem)] font-semibold italic tracking-[0.16em] text-transparent">
                  Strike!
                </div>
                <div className="h-[clamp(2.2rem,3vw,3.5rem)] w-[clamp(2.2rem,3vw,3.5rem)] rounded-full border border-sky-200/20 bg-[radial-gradient(circle_at_35%_35%,rgba(125,211,252,0.52),rgba(59,130,246,0.16)_60%,transparent_76%)] shadow-[0_0_24px_rgba(96,165,250,0.16)]" />
              </Panel>

              <Panel className="grid h-full min-h-0 grid-rows-4 gap-[clamp(0.5rem,0.9vw,1.1rem)] col-start-3 row-span-2 row-start-1">
                <MenuButton label="Snack Gacha" art="snack" className="h-full" href="/gacha" />
                <MenuButton
                  label="Character"
                  art="character"
                  className="h-full"
                  href="/characterManagement"
                />
                <MenuButton label="Storage" art="storage" className="h-full" href="/storage" />
                <MenuButton
                  label="Community"
                  art="community"
                  className="h-full"
                  href="/community"
                />
              </Panel>

              <Panel className="grid h-full min-h-0 grid-rows-3 gap-[clamp(0.5rem,0.9vw,1.1rem)]">
                <MenuButton
                  label="Mochi Soldier Surge"
                  art="surge"
                  className="h-full"
                  href="/mochiSoldierSurge"
                />
                <MenuButton
                  label="Mochi General Battle"
                  art="battle"
                  className="h-full"
                  href="/mochiGeneralBattle"
                />
                <MenuButton label="? ? ?" art="lab" className="h-full" href="/madacombat" />
              </Panel>

              <Panel className="grid h-full min-h-0 grid-rows-2 gap-[clamp(0.5rem,0.9vw,1.1rem)]">
                <MenuButton label="Origin" art="origin" className="h-full" href="/origin" />
                <MenuButton label="Star Shop" art="starshop" className="h-full" href="/starshop" />
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
