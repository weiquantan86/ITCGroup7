import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../../database/client";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";

type RequestContext = {
  params: Promise<{ id: string }>;
};

const parseUserId = (value: string) => {
  const userId = Number.parseInt(value, 10);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  return userId;
};

const ensureAdminAccess = async () => {
  const cookieStore = await cookies();
  if (!hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value)) {
    return false;
  }
  return true;
};

export async function PATCH(request: Request, context: RequestContext) {
  if (!(await ensureAdminAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const userId = parseUserId(id);
  if (userId == null) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let payload: { isAuthorised?: unknown };
  try {
    payload = await request.json();
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (typeof payload.isAuthorised !== "boolean") {
    return NextResponse.json(
      { error: "isAuthorised must be boolean" },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      `
        UPDATE users
        SET is_authorised = $1
        WHERE id = $2
        RETURNING
          id,
          email,
          phone,
          username,
          is_authorised,
          created_at,
          self_introduction
      `,
      [payload.isAuthorised, userId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user: result.rows[0] });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update user authorisation" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RequestContext) {
  if (!(await ensureAdminAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const userId = parseUserId(id);
  if (userId == null) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM user_resources WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM user_characters WHERE user_id = $1", [userId]);
    const deleteUserResult = await client.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [userId]
    );
    if (deleteUserResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    await client.query("COMMIT");
    return NextResponse.json({
      success: true,
      deletedUserId: deleteUserResult.rows[0].id,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(rollbackError);
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
