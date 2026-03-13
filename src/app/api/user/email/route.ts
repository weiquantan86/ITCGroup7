import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../database/client";
import {
  describeEmailRewardText,
  hasClaimableEmailReward,
} from "@/app/components/email/rewardUtils";

const parseUserIdFromCookie = async () => {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) return null;
  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  return userId;
};

export async function GET() {
  const userId = await parseUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          user_id,
          title,
          description,
          reward,
          send_date,
          is_read
        FROM user_email
        WHERE user_id = $1 OR user_id IS NULL
        ORDER BY send_date DESC, id DESC
      `,
      [userId]
    );

    return NextResponse.json({
      emails: result.rows.map((row) => {
        const rawReward =
          typeof row.reward === "string" ? row.reward : null;
        const isRead = Boolean(row.is_read);
        const hasReward = hasClaimableEmailReward(rawReward);
        const userIdValue = row.user_id == null ? null : Number(row.user_id);
        return {
          id: Number(row.id),
          userId: userIdValue,
          title: String(row.title ?? ""),
          description:
            typeof row.description === "string" ? row.description : "",
          reward: rawReward,
          rewardLabel: describeEmailRewardText(rawReward),
          sendDate:
            row.send_date instanceof Date
              ? row.send_date.toISOString()
              : String(row.send_date ?? ""),
          isRead,
          hasClaimableReward: hasReward,
          canDelete: isRead && !hasReward && userIdValue === userId,
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load user emails." },
      { status: 500 }
    );
  }
}
