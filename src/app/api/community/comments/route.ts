import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../database/client";

const DEFAULT_LIMIT = 120;
const MAX_LIMIT = 300;

const ORDER_BY_MAP: Record<string, string> = {
  newest: "cc.commented_date DESC",
  oldest: "cc.commented_date ASC",
  username_asc: "u.username ASC, cc.commented_date DESC",
  username_desc: "u.username DESC, cc.commented_date DESC",
};

function parseLimit(limitParam: string | null): number {
  const parsed = Number.parseInt(limitParam ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function parseDays(daysParam: string | null): number | null {
  if (!daysParam || daysParam === "all") {
    return null;
  }
  const parsed = Number.parseInt(daysParam, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeComment(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, 2000);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const sort = searchParams.get("sort") ?? "newest";
  const username = searchParams.get("username")?.trim() ?? "";
  const keyword = searchParams.get("keyword")?.trim() ?? "";
  const days = parseDays(searchParams.get("days"));
  const limit = parseLimit(searchParams.get("limit"));
  const orderBy = ORDER_BY_MAP[sort] ?? ORDER_BY_MAP.newest;

  const values: Array<string | number> = [];
  let whereClause = "WHERE 1 = 1";

  if (username) {
    values.push(`%${username}%`);
    whereClause += ` AND u.username ILIKE $${values.length}`;
  }

  if (keyword) {
    values.push(`%${keyword}%`);
    whereClause += ` AND cc.comment ILIKE $${values.length}`;
  }

  if (typeof days === "number") {
    values.push(days);
    whereClause += ` AND cc.commented_date >= NOW() - ($${values.length} * INTERVAL '1 day')`;
  }

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

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
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ${limitPlaceholder}
      `,
      values
    );

    return NextResponse.json({
      comments: result.rows,
    });
  } catch (error) {
    console.error("[api/community/comments] Failed to load comments:", error);
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 }
    );
  }
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

  let body: { comment?: unknown };
  try {
    body = await request.json();
  } catch (error) {
    console.error("[api/community/comments] Invalid payload:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const comment = normalizeComment(body.comment);
  if (!comment) {
    return NextResponse.json(
      { error: "Comment cannot be empty." },
      { status: 400 }
    );
  }

  try {
    const insertResult = await pool.query(
      `
        INSERT INTO community_comments (user_id, comment, commented_date)
        VALUES ($1, $2, NOW())
        RETURNING id, comment, commented_date
      `,
      [userId, comment]
    );

    return NextResponse.json({
      success: true,
      comment: insertResult.rows[0],
    });
  } catch (error) {
    console.error("[api/community/comments] Failed to post comment:", error);
    return NextResponse.json(
      { error: "Failed to post comment" },
      { status: 500 }
    );
  }
}
