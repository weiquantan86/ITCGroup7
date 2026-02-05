import Link from "next/link";
import { cookies } from "next/headers";
import pool from "../../../database/client";
import CharacterManagementShell from "./CharacterManagementShell";

function ErrorState({ message }: { message: string }) {
  return (
    <main className="min-h-screen w-full bg-[#06080b] text-slate-200">
      <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 lg:px-8">
          <div className="w-full rounded-[28px] border border-slate-200/20 bg-[#0b1016]/80 p-8 text-center shadow-[0_0_40px_rgba(70,120,210,0.18)]">
            <p className="text-lg font-semibold text-slate-100">{message}</p>
            <p className="mt-2 text-sm text-slate-300">
              Please log in before entering character management.
            </p>
            <Link
              href="/userSystem/login"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-slate-200/30 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function CharacterManagementPage() {
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
    const { rows } = await pool.query(
      `
        SELECT LOWER(c.name) AS id
        FROM user_characters uc
        JOIN characters c ON c.id = uc.character_id
        WHERE uc.user_id = $1
        ORDER BY c.name;
      `,
      [userId]
    );
    const ownedIds = rows.map((row) => row.id);
    return <CharacterManagementShell ownedIds={ownedIds} />;
  } catch (error) {
    console.error(error);
    return (
      <ErrorState message="Load failed: unable to read character ownership." />
    );
  }
}
