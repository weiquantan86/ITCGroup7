import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../database/client";
import { adminAccessCookieName, hasAdminAccess } from "@/app/admin/adminAuth";

export async function GET() {
  const cookieStore = await cookies();
  if (!hasAdminAccess(cookieStore.get(adminAccessCookieName)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          email,
          phone,
          username,
          is_authorised,
          created_at,
          self_introduction
        FROM users
        ORDER BY id ASC
      `
    );
    return NextResponse.json({ users: result.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }
}
