import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../database/client";
import { upsertFeedbackToNotion } from "@/app/components/notion/feedbackSync";

const STATUS_NOT_STARTED = "not_started";

function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: {
    description?: unknown;
    rewardAcknowledged?: unknown;
  };
  try {
    body = await request.json();
  } catch (error) {
    console.error("[api/community/bug-report] Invalid payload:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const description = normalizeText(body.description, 3000);
  const rewardAcknowledged = body.rewardAcknowledged === true;

  if (description.length < 10) {
    return NextResponse.json(
      { error: "Bug description must be at least 10 characters." },
      { status: 400 }
    );
  }

  if (!rewardAcknowledged) {
    return NextResponse.json(
      { error: "Please acknowledge the reward rules before submitting." },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO user_feedback (user_id, status, report_date, description)
        VALUES ($1, $2, NOW(), $3)
        RETURNING id, status, report_date, description
      `,
      [userId, STATUS_NOT_STARTED, description]
    );

    const usernameResult = await pool.query(
      `
        SELECT username
        FROM users
        WHERE id = $1
      `,
      [userId]
    );

    const inserted = result.rows[0];
    const username =
      typeof usernameResult.rows[0]?.username === "string"
        ? String(usernameResult.rows[0].username)
        : `user_${userId}`;

    const notionSync = await upsertFeedbackToNotion({
      id: Number(inserted.id),
      userId,
      username,
      status: String(inserted.status ?? STATUS_NOT_STARTED),
      reportDate:
        inserted.report_date instanceof Date
          ? inserted.report_date.toISOString()
          : String(inserted.report_date ?? ""),
      settleDate: null,
      description: typeof inserted.description === "string" ? inserted.description : null,
    });

    if (!notionSync.synced) {
      console.warn(
        `[api/community/bug-report] Notion sync skipped/failed for feedback ${String(
          inserted.id
        )}: ${notionSync.reason ?? "unknown reason"}`
      );
    }

    return NextResponse.json({
      success: true,
      report: inserted,
      notionSynced: notionSync.synced,
    });
  } catch (error) {
    console.error("[api/community/bug-report] Failed to submit report:", error);
    return NextResponse.json(
      { error: "Failed to submit bug report." },
      { status: 500 }
    );
  }
}
