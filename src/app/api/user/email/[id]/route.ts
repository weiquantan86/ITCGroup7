import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/database/client";
import { hasClaimableEmailReward } from "@/app/components/email/rewardUtils";

type RequestContext = {
  params: Promise<{ id: string }>;
};

const parseUserIdFromCookie = async () => {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) return null;
  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  return userId;
};

const parseEmailId = (value: string) => {
  const emailId = Number.parseInt(value, 10);
  if (!Number.isFinite(emailId) || emailId <= 0) return null;
  return emailId;
};

const toNullableUserId = (value: unknown) => {
  if (value == null) return null;
  const userId = Number(value);
  return Number.isFinite(userId) ? userId : null;
};

const buildCanDelete = (
  emailUserId: number | null,
  isRead: boolean,
  rawReward: string | null,
  currentUserId: number
) => isRead && !hasClaimableEmailReward(rawReward) && emailUserId === currentUserId;

export async function PATCH(_request: Request, context: RequestContext) {
  const userId = await parseUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const emailId = parseEmailId(id);
  if (!emailId) {
    return NextResponse.json({ error: "Invalid email id." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const emailResult = await client.query(
      `
        SELECT id, user_id, reward, is_read
        FROM user_email
        WHERE id = $1
          AND (user_id = $2 OR user_id IS NULL)
        FOR UPDATE
      `,
      [emailId, userId]
    );

    if (emailResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Email not found." }, { status: 404 });
    }

    const currentRow = emailResult.rows[0];
    const rawReward =
      typeof currentRow.reward === "string" ? currentRow.reward : null;
    const emailUserId = toNullableUserId(currentRow.user_id);
    const alreadyRead = Boolean(currentRow.is_read);

    if (!alreadyRead) {
      await client.query(
        `
          UPDATE user_email
          SET is_read = TRUE
          WHERE id = $1
        `,
        [emailId]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      email: {
        id: emailId,
        isRead: true,
        canDelete: buildCanDelete(emailUserId, true, rawReward, userId),
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(rollbackError);
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update email." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function DELETE(_request: Request, context: RequestContext) {
  const userId = await parseUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const emailId = parseEmailId(id);
  if (!emailId) {
    return NextResponse.json({ error: "Invalid email id." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const emailResult = await client.query(
      `
        SELECT id, user_id, reward, is_read
        FROM user_email
        WHERE id = $1
          AND user_id = $2
        FOR UPDATE
      `,
      [emailId, userId]
    );

    if (emailResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Email not found or cannot be deleted." },
        { status: 404 }
      );
    }

    const currentRow = emailResult.rows[0];
    const rawReward =
      typeof currentRow.reward === "string" ? currentRow.reward : null;
    if (!Boolean(currentRow.is_read)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Only read emails can be deleted." },
        { status: 400 }
      );
    }

    if (hasClaimableEmailReward(rawReward)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Emails with claimable rewards cannot be deleted." },
        { status: 400 }
      );
    }

    await client.query(
      `
        DELETE FROM user_email
        WHERE id = $1
      `,
      [emailId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      deletedEmailId: emailId,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(rollbackError);
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete email." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
