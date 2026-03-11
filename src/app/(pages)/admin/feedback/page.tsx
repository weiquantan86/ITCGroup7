import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import pool from "../../../../database/client";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";
import AdminFeedbackClient from "./AdminFeedbackClient";

type FeedbackRow = {
  id: number;
  user_id: number;
  username: string;
  status: string;
  report_date: string;
  settle_date: string | null;
  description: string | null;
};

const MAX_ROWS = 300;

const isSafeResourceColumn = (value: string) => /^[a-z_][a-z0-9_]*$/.test(value);

export default async function AdminFeedbackPage() {
  const cookieStore = await cookies();
  if (!hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value)) {
    redirect("/userSystem/login");
  }

  let feedbackRows: FeedbackRow[] = [];
  let rewardResourceKeys: string[] = [];
  let loadError = "";
  try {
    const [feedbackResult, resourcesResult] = await Promise.all([
      pool.query(
        `
          SELECT
            uf.id,
            uf.user_id,
            u.username,
            uf.status,
            uf.report_date,
            uf.settle_date,
            uf.description
          FROM user_feedback uf
          INNER JOIN users u ON u.id = uf.user_id
          ORDER BY uf.report_date DESC
          LIMIT $1
        `,
        [MAX_ROWS]
      ),
      pool.query(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'user_resources'
          ORDER BY ordinal_position ASC
        `
      ),
    ]);

    feedbackRows = feedbackResult.rows.map((row) => ({
      id: Number(row.id),
      user_id: Number(row.user_id),
      username: String(row.username ?? ""),
      status: String(row.status ?? ""),
      report_date:
        row.report_date instanceof Date
          ? row.report_date.toISOString()
          : String(row.report_date ?? ""),
      settle_date:
        row.settle_date instanceof Date
          ? row.settle_date.toISOString()
          : row.settle_date
            ? String(row.settle_date)
            : null,
      description: typeof row.description === "string" ? row.description : null,
    }));

    rewardResourceKeys = resourcesResult.rows
      .map((row) => String(row.column_name ?? ""))
      .filter((columnName) => columnName !== "user_id" && isSafeResourceColumn(columnName));
  } catch (error) {
    console.error("[admin/feedback] Failed to load user feedback:", error);
    loadError = "Failed to load feedback reports.";
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admin Feedback</h1>
            <p className="text-slate-300">Showing latest {MAX_ROWS} feedback reports.</p>
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
          <AdminFeedbackClient
            initialFeedbackRows={feedbackRows}
            rewardResourceKeys={rewardResourceKeys}
          />
        )}
      </main>
    </div>
  );
}
