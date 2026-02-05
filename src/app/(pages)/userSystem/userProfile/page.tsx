import type { ReactNode } from "react";
import { cookies } from "next/headers";
import pool from "../../../../database/client";
import UserProfileClient from "./UserProfileClient";

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

function ErrorState({ message }: { message: string }) {
  return (
    <main className="min-h-screen w-full bg-[#06080b] text-slate-200">
      <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 lg:px-8">
          <div className="w-full rounded-[28px] border border-slate-200/20 bg-[#0b1016]/80 p-8 text-center shadow-[0_0_40px_rgba(70,120,210,0.18)]">
            <p className="text-lg font-semibold text-slate-100">{message}</p>
            <p className="mt-2 text-sm text-slate-300">
              Please log in before entering the user profile.
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

export default async function UserProfilePage() {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) {
    return <ErrorState message="Load failed: no login information found." />;
  }

  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId)) {
    return <ErrorState message="Load failed: login information is invalid." />;
  }

  try {
    const userQuery = await pool.query(
      "SELECT username, created_at, self_introduction FROM users WHERE id = $1",
      [userId]
    );
    if (userQuery.rows.length === 0) {
      return <ErrorState message="Load failed: user does not exist." />;
    }

    const user = userQuery.rows[0];
    const createdAtLabel = new Date(user.created_at).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }
    );

    return (
      <main className="min-h-screen w-full bg-[#06080b] text-slate-200">
        <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
          <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10 lg:px-10">
            <Panel className="w-full p-8 lg:p-10">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                    User Profile
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold text-slate-100">
                    Profile Console
                  </h1>
                </div>
                <a
                  href="/userSystem/user"
                  className="rounded-full border border-slate-200/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10"
                >
                  Back
                </a>
              </div>

              <UserProfileClient
                username={user.username}
                createdAtLabel={createdAtLabel}
                selfIntroduction={user.self_introduction}
              />
            </Panel>
          </div>
        </div>
      </main>
    );
  } catch (error) {
    console.error(error);
    return (
      <ErrorState message="Load failed: unable to read user information." />
    );
  }
}
