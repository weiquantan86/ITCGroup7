import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import pool from "../../../../database/client";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";
import AdminCommentClient from "./AdminCommentClient";

type CommunityCommentRow = {
  id: number;
  username: string;
  comment: string;
  commented_date: string;
};

const MAX_ROWS = 300;

export default async function AdminCommunityPage() {
  const cookieStore = await cookies();
  if (!hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value)) {
    redirect("/userSystem/login");
  }

  let comments: CommunityCommentRow[] = [];
  let loadError = "";
  try {
    const result = await pool.query(
      `
        SELECT
          cc.id,
          u.username,
          cc.comment,
          cc.commented_date
        FROM community_comments cc
        INNER JOIN users u ON u.id = cc.user_id
        ORDER BY cc.commented_date DESC
        LIMIT $1
      `,
      [MAX_ROWS]
    );
    comments = result.rows as CommunityCommentRow[];
  } catch (error) {
    console.error("[admin/comment] Failed to load community comments:", error);
    loadError = "Failed to load community comments.";
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Community</h1>
            <p className="text-slate-300">
              Showing latest {MAX_ROWS} community comments.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm transition-colors hover:bg-slate-700"
          >
            Back
          </Link>
        </header>

        {loadError ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {loadError}
          </div>
        ) : (
          <AdminCommentClient initialComments={comments} />
        )}
      </main>
    </div>
  );
}
