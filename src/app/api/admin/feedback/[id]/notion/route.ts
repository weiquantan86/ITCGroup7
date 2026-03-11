import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/database/client";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";
import { upsertFeedbackToNotion } from "@/app/components/notion/feedbackSync";

type RequestContext = {
  params: Promise<{ id: string }>;
};

const parseFeedbackId = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const ensureAdminAccess = async () => {
  const cookieStore = await cookies();
  return hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value);
};

export async function POST(_request: Request, context: RequestContext) {
  if (!(await ensureAdminAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const feedbackId = parseFeedbackId(id);
  if (feedbackId == null) {
    return NextResponse.json({ error: "Invalid feedback id" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          uf.id,
          uf.user_id,
          uf.status,
          uf.report_date,
          uf.settle_date,
          uf.description,
          u.username
        FROM user_feedback uf
        INNER JOIN users u ON u.id = uf.user_id
        WHERE uf.id = $1
      `,
      [feedbackId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    const row = result.rows[0];
    const syncResult = await upsertFeedbackToNotion({
      id: Number(row.id),
      userId: Number(row.user_id),
      username: String(row.username ?? ""),
      status: String(row.status ?? ""),
      reportDate:
        row.report_date instanceof Date
          ? row.report_date.toISOString()
          : String(row.report_date ?? ""),
      settleDate:
        row.settle_date instanceof Date
          ? row.settle_date.toISOString()
          : row.settle_date
            ? String(row.settle_date)
            : null,
      description: typeof row.description === "string" ? row.description : null,
    });

    if (!syncResult.synced) {
      return NextResponse.json(
        {
          error: "Failed to sync feedback to Notion.",
          reason: syncResult.reason,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      notionSynced: true,
      pageId: syncResult.pageId,
    });
  } catch (error) {
    console.error(
      "[api/admin/feedback/[id]/notion] Failed to sync feedback to Notion:",
      error
    );
    return NextResponse.json(
      { error: "Failed to sync feedback to Notion." },
      { status: 500 }
    );
  }
}
