import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../database/client";
import { syncFeedbackByIdToNotion } from "@/app/api/feedback/syncFromDatabase";

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

    const inserted = result.rows[0];
    const feedbackId = Number.parseInt(String(inserted.id), 10);
    if (!Number.isFinite(feedbackId) || feedbackId <= 0) {
      throw new Error("Inserted feedback id is invalid.");
    }

    const notionSync = await syncFeedbackByIdToNotion(feedbackId);

    if (!notionSync.synced) {
      console.error(
        `[api/community/bug-report] Notion sync failed for feedback ${String(
          feedbackId
        )} after ${String(notionSync.attempts)} attempts: ${
          notionSync.reason ?? "unknown reason"
        }`
      );
      return NextResponse.json(
        {
          error:
            "Feedback saved in database but failed to sync to Notion. Please retry sync from admin panel.",
          report: inserted,
          notionSynced: false,
          reason: notionSync.reason,
          syncAttempts: notionSync.attempts,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      report: inserted,
      notionSynced: true,
    });
  } catch (error) {
    console.error("[api/community/bug-report] Failed to submit report:", error);
    return NextResponse.json(
      { error: "Failed to submit bug report." },
      { status: 500 }
    );
  }
}
