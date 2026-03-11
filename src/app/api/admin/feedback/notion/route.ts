import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/database/client";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";
import {
  probeNotionConnection,
  upsertFeedbackToNotion,
} from "@/app/components/notion/feedbackSync";

const MAX_FEEDBACK_IDS_PER_REQUEST = 500;

type FeedbackRow = {
  id: number;
  user_id: number;
  username: string;
  status: string;
  report_date: string | Date;
  settle_date: string | Date | null;
  description: string | null;
};

type SyncPayload = {
  feedbackIds?: unknown;
};

type FailedRow = {
  id: number;
  reason: string;
};

const ensureAdminAccess = async () => {
  const cookieStore = await cookies();
  return hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value);
};

const parseFeedbackIds = (value: unknown) => {
  if (!Array.isArray(value)) return [] as number[];

  const parsed = value
    .map((item) => Number.parseInt(String(item), 10))
    .filter((item) => Number.isFinite(item) && item > 0);

  return Array.from(new Set(parsed));
};

export async function POST(request: Request) {
  if (!(await ensureAdminAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SyncPayload = {};
  try {
    payload = (await request.json()) as SyncPayload;
  } catch {
    payload = {};
  }

  const feedbackIds = parseFeedbackIds(payload.feedbackIds);
  if (feedbackIds.length === 0) {
    return NextResponse.json({ error: "No feedback ids provided." }, { status: 400 });
  }
  if (feedbackIds.length > MAX_FEEDBACK_IDS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many feedback ids. Max is ${MAX_FEEDBACK_IDS_PER_REQUEST}.` },
      { status: 400 }
    );
  }

  try {
    const notionProbe = await probeNotionConnection();
    if (!notionProbe.ok) {
      const reason = notionProbe.reason ?? "Unknown Notion probe error";
      const isAuthError =
        typeof reason === "string" && reason.includes("Notion API 401");
      const isNotFoundError =
        typeof reason === "string" &&
        (reason.includes("Notion API 404") || reason.includes("object_not_found"));
      const isForbiddenError =
        typeof reason === "string" && reason.includes("Notion API 403");

      let errorMessage = "Notion connection check failed.";
      if (isAuthError) {
        errorMessage = "Notion authentication failed. Please check NOTION_API_KEY.";
      } else if (isNotFoundError || isForbiddenError) {
        errorMessage =
          "Notion database not accessible. Check NOTION_DATABASE_ID and share database to the integration.";
      }

      return NextResponse.json(
        {
          success: false,
          notionSynced: false,
          error: errorMessage,
          reason,
        },
        { status: isAuthError ? 401 : 502 }
      );
    }

    const feedbackResult = await pool.query(
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
        WHERE uf.id = ANY($1::int[])
        ORDER BY uf.report_date DESC
      `,
      [feedbackIds]
    );

    const rows = feedbackResult.rows as FeedbackRow[];
    if (rows.length === 0) {
      return NextResponse.json({ error: "No feedback rows found." }, { status: 404 });
    }

    const failedRows: FailedRow[] = [];
    let syncedCount = 0;

    for (const row of rows) {
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

      if (syncResult.synced) {
        syncedCount += 1;
      } else {
        const isAuthError =
          typeof syncResult.reason === "string" &&
          syncResult.reason.includes("Notion API 401");
        if (isAuthError) {
          return NextResponse.json(
            {
              success: false,
              notionSynced: false,
              syncedCount,
              totalCount: rows.length,
              error:
                "Notion authentication failed. Please check NOTION_API_KEY and integration access.",
              reason: syncResult.reason,
            },
            { status: 401 }
          );
        }

        failedRows.push({
          id: Number(row.id),
          reason: syncResult.reason ?? "Unknown sync error",
        });
      }
    }

    if (failedRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          notionSynced: false,
          syncedCount,
          totalCount: rows.length,
          failedRows,
          reason: failedRows[0]?.reason ?? null,
          error: `Synced ${syncedCount}/${rows.length}. Failed ${failedRows.length} rows.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      notionSynced: true,
      syncedCount,
      totalCount: rows.length,
    });
  } catch (error) {
    console.error("[api/admin/feedback/notion] Failed to sync feedback table:", error);
    return NextResponse.json(
      { error: "Failed to sync feedback table to Notion." },
      { status: 500 }
    );
  }
}
