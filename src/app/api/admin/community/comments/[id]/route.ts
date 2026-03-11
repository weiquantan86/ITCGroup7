import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/database/client";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";

type RequestContext = {
  params: Promise<{ id: string }>;
};

const parseCommentId = (value: string) => {
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

export async function DELETE(_request: Request, context: RequestContext) {
  if (!(await ensureAdminAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const commentId = parseCommentId(id);
  if (commentId == null) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `
        DELETE FROM community_comments
        WHERE id = $1
        RETURNING id
      `,
      [commentId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      deletedCommentId: Number(result.rows[0].id),
    });
  } catch (error) {
    console.error("[api/admin/community/comments/[id]] Failed to delete comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
