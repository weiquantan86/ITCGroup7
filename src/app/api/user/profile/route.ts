import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../database/client";

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let payload: { selfIntroduction?: unknown };
  try {
    payload = await request.json();
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (typeof payload.selfIntroduction !== "string") {
    return NextResponse.json({ error: "Invalid self introduction" }, { status: 400 });
  }

  try {
    const updateQuery = await pool.query(
      "UPDATE users SET self_introduction = $1 WHERE id = $2 RETURNING self_introduction",
      [payload.selfIntroduction, userId]
    );
    if (updateQuery.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      selfIntroduction: updateQuery.rows[0].self_introduction,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
