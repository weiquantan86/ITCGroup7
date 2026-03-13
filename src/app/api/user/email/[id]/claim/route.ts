import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../../../database/client";
import {
  parseEmailRewardResources,
  formatEmailRewardResources,
} from "@/app/components/email/rewardUtils";

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

const pickNumber = (source: Record<string, unknown>, key: string) => {
  const parsed = Number(source[key]);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

let cachedUserResourceColumns: Set<string> | null = null;

const getUserResourceColumns = async () => {
  if (cachedUserResourceColumns) return cachedUserResourceColumns;
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
  cachedUserResourceColumns = columns;
  return columns;
};

export async function POST(_request: Request, context: RequestContext) {
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
        SELECT id, user_id, title, reward
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

    const rewardText =
      typeof emailResult.rows[0].reward === "string"
        ? emailResult.rows[0].reward
        : null;
    const emailUserId =
      emailResult.rows[0].user_id == null
        ? null
        : Number(emailResult.rows[0].user_id);

    const parsedRewards = parseEmailRewardResources(rewardText);
    const hasRawReward = Boolean(rewardText && rewardText.trim());
    const resourceColumns = await getUserResourceColumns();
    const unsupportedKeys =
      parsedRewards && hasRawReward
        ? Object.keys(parsedRewards).filter((key) => !resourceColumns.has(key))
        : [];

    if (hasRawReward && unsupportedKeys.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: `Unsupported reward resource keys: ${unsupportedKeys.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const claimableEntries = parsedRewards
      ? Object.entries(parsedRewards).filter(
          (entry) => entry[1] > 0 && resourceColumns.has(entry[0])
        )
      : [];

    if (!parsedRewards && hasRawReward) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error:
            "Invalid reward format. Use JSON or text like star_coin:100, point 50.",
        },
        { status: 400 }
      );
    }

    if (!parsedRewards || claimableEntries.length === 0) {
      await client.query(
        `
          UPDATE user_email
          SET is_read = TRUE,
              reward = NULL
          WHERE id = $1
        `,
        [emailId]
      );
      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        claimed: false,
        emailId,
        title: String(emailResult.rows[0].title ?? ""),
        message: "This email has no claimable reward.",
        canDelete: emailUserId === userId,
      });
    }

    const rewardColumns = claimableEntries.map((entry) => entry[0]);
    const rewardValues = claimableEntries.map((entry) => entry[1]);
    const insertColumns = rewardColumns.map((column) => quoteIdentifier(column)).join(",\n          ");
    const insertPlaceholders = rewardValues
      .map((_value, index) => `$${index + 2}`)
      .join(", ");
    const updateAssignments = rewardColumns
      .map(
        (column) =>
          `${quoteIdentifier(column)} = user_resources.${quoteIdentifier(column)} + EXCLUDED.${quoteIdentifier(column)}`
      )
      .join(",\n          ");
    const returningColumns = rewardColumns.map((column) => quoteIdentifier(column)).join(",\n          ");

    const upsertResult = await client.query(
      `
        INSERT INTO user_resources (
          user_id,
          ${insertColumns}
        )
        VALUES ($1, ${insertPlaceholders})
        ON CONFLICT (user_id)
        DO UPDATE SET
          ${updateAssignments}
        RETURNING
          ${returningColumns}
      `,
      [
        userId,
        ...rewardValues,
      ]
    );

    await client.query(
      `
        UPDATE user_email
        SET is_read = TRUE,
            reward = NULL
        WHERE id = $1
      `,
      [emailId]
    );

    await client.query("COMMIT");

    const resourceRow = (upsertResult.rows[0] ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      claimed: true,
      emailId,
      title: String(emailResult.rows[0].title ?? ""),
      rewardSummary: formatEmailRewardResources(
        Object.fromEntries(claimableEntries)
      ),
      claimedRewards: Object.fromEntries(claimableEntries),
      resources: rewardColumns.reduce<Record<string, number>>(
        (accumulator, key) => {
          accumulator[key] = pickNumber(resourceRow, key);
          return accumulator;
        },
        {}
      ),
      canDelete: emailUserId === userId,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(rollbackError);
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to claim email reward." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
