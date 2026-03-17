import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/database/client";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";
import { normalizeRewardKey } from "@/app/components/email/rewardUtils";
import { syncFeedbackByIdToNotion } from "@/app/api/feedback/syncFromDatabase";

type RequestContext = {
  params: Promise<{ id: string }>;
};

type FeedbackPatchPayload = {
  status?: unknown;
  email?: {
    title?: unknown;
    description?: unknown;
    reward?: unknown;
  };
};

const ALLOWED_STATUSES = new Set([
  "not_started",
  "validating",
  "in_progress",
  "in_valid",
  "done",
]);

const FINAL_STATUSES = new Set(["in_valid", "done"]);

const parseFeedbackId = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const ensureAdminAccess = async () => {
  const cookieStore = await cookies();
  if (!hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value)) {
    return false;
  }
  return true;
};

const normalizeStatus = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return null;

  const aliasMap: Record<string, string> = {
    invalid: "in_valid",
    inprogress: "in_progress",
  };
  const mapped = aliasMap[normalized] ?? normalized;
  return ALLOWED_STATUSES.has(mapped) ? mapped : null;
};

const normalizeText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const normalizePositiveInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const floored = Math.floor(parsed);
  return floored > 0 ? floored : 0;
};

const getUserResourceColumns = async () => {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_resources'
    `
  );

  const columns = new Set<string>();
  for (const row of result.rows as Array<{ column_name?: unknown }>) {
    const columnName = String(row.column_name ?? "");
    if (columnName !== "user_id" && /^[a-z_][a-z0-9_]*$/.test(columnName)) {
      columns.add(columnName);
    }
  }
  return columns;
};

const parseRewardPayload = (
  rewardPayload: unknown,
  allowedResources: Set<string>
) => {
  if (!rewardPayload || typeof rewardPayload !== "object" || Array.isArray(rewardPayload)) {
    return {
      rewards: null as Record<string, number> | null,
      unsupportedKeys: [] as string[],
    };
  }

  const rewards: Record<string, number> = {};
  const unsupportedKeys: string[] = [];
  for (const [rawKey, rawValue] of Object.entries(
    rewardPayload as Record<string, unknown>
  )) {
    const normalizedKey = normalizeRewardKey(rawKey);
    const count = normalizePositiveInt(rawValue);
    if (!normalizedKey || count <= 0) continue;
    if (!allowedResources.has(normalizedKey)) {
      unsupportedKeys.push(normalizedKey);
      continue;
    }
    rewards[normalizedKey] = (rewards[normalizedKey] ?? 0) + count;
  }

  return {
    rewards: Object.keys(rewards).length > 0 ? rewards : null,
    unsupportedKeys,
  };
};

export async function PATCH(request: Request, context: RequestContext) {
  if (!(await ensureAdminAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const feedbackId = parseFeedbackId(id);
  if (feedbackId == null) {
    return NextResponse.json({ error: "Invalid feedback id" }, { status: 400 });
  }

  let payload: FeedbackPatchPayload;
  try {
    payload = (await request.json()) as FeedbackPatchPayload;
  } catch (error) {
    console.error("[api/admin/feedback/[id]] Invalid payload:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const status = normalizeStatus(payload.status);
  if (!status) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const requiresSettlement = FINAL_STATUSES.has(status);
  const settleDate = requiresSettlement ? new Date() : null;
  let emailTitle = "";
  let emailDescription = "";
  let emailRewardText: string | null = null;

  if (status === "done") {
    emailTitle = normalizeText(payload.email?.title, 255);
    emailDescription = normalizeText(payload.email?.description, 3000);
    if (!emailTitle || !emailDescription) {
      return NextResponse.json(
        {
          error: "When status is done, email title and description are required.",
        },
        { status: 400 }
      );
    }

    const resourceColumns = await getUserResourceColumns();
    const parsedReward = parseRewardPayload(payload.email?.reward, resourceColumns);
    if (parsedReward.unsupportedKeys.length > 0) {
      return NextResponse.json(
        {
          error: `Unsupported reward keys: ${parsedReward.unsupportedKeys.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (!parsedReward.rewards) {
      return NextResponse.json(
        {
          error: "When status is done, reward is required.",
        },
        { status: 400 }
      );
    }
    emailRewardText = JSON.stringify(parsedReward.rewards);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const feedbackRowResult = await client.query(
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
        FOR UPDATE
      `,
      [feedbackId]
    );

    if (feedbackRowResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    const updatedResult = await client.query(
      `
        UPDATE user_feedback
        SET status = $1,
            settle_date = $2
        WHERE id = $3
        RETURNING id, user_id, status, report_date, settle_date, description
      `,
      [status, settleDate, feedbackId]
    );

    if (status === "done") {
      const feedbackRow = feedbackRowResult.rows[0];
      await client.query(
        `
          INSERT INTO user_email (
            user_id,
            title,
            description,
            reward,
            send_date,
            is_read
          )
          VALUES ($1, $2, $3, $4, NOW(), FALSE)
        `,
        [feedbackRow.user_id, emailTitle, emailDescription, emailRewardText]
      );
    }

    await client.query("COMMIT");

    const updated = updatedResult.rows[0];
    const notionSync = await syncFeedbackByIdToNotion(feedbackId);

    if (!notionSync.synced) {
      console.error(
        `[api/admin/feedback/[id]] Notion sync failed for feedback ${String(
          feedbackId
        )} after ${String(notionSync.attempts)} attempts: ${
          notionSync.reason ?? "unknown reason"
        }`
      );
      return NextResponse.json(
        {
          error:
            "Feedback status updated in database but failed to sync to Notion. Please retry sync from admin panel.",
          notionSynced: false,
          syncAttempts: notionSync.attempts,
          reason: notionSync.reason,
          feedback: {
            id: Number(updated.id),
            user_id: Number(updated.user_id),
            username: String(feedbackRowResult.rows[0].username ?? ""),
            status: String(updated.status ?? ""),
            report_date:
              updated.report_date instanceof Date
                ? updated.report_date.toISOString()
                : String(updated.report_date ?? ""),
            settle_date:
              updated.settle_date instanceof Date
                ? updated.settle_date.toISOString()
                : updated.settle_date
                  ? String(updated.settle_date)
                  : null,
            description:
              typeof updated.description === "string" ? updated.description : null,
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      feedback: {
        id: Number(updated.id),
        user_id: Number(updated.user_id),
        username: String(feedbackRowResult.rows[0].username ?? ""),
        status: String(updated.status ?? ""),
        report_date:
          updated.report_date instanceof Date
            ? updated.report_date.toISOString()
            : String(updated.report_date ?? ""),
        settle_date:
          updated.settle_date instanceof Date
            ? updated.settle_date.toISOString()
            : updated.settle_date
              ? String(updated.settle_date)
              : null,
        description:
          typeof updated.description === "string" ? updated.description : null,
      },
      emailed: status === "done",
      notionSynced: notionSync.synced,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(rollbackError);
    }
    console.error("[api/admin/feedback/[id]] Failed to patch feedback:", error);
    return NextResponse.json(
      { error: "Failed to update feedback." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
