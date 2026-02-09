import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../database/client";
import { characterProfiles } from "../../../asset/entity/character/player/registry";

type Payload = {
  characterId?: unknown;
};

const selectableCharacterIds = new Set(
  characterProfiles.map((profile) => profile.id.toLowerCase())
);

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

  let payload: Payload;
  try {
    payload = await request.json();
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (typeof payload.characterId !== "string") {
    return NextResponse.json({ error: "Invalid character id" }, { status: 400 });
  }

  const characterId = payload.characterId.trim().toLowerCase();
  if (!characterId || !selectableCharacterIds.has(characterId)) {
    return NextResponse.json({ error: "Unsupported character id" }, { status: 400 });
  }

  try {
    const ownershipQuery = await pool.query(
      `
        SELECT 1
        FROM user_characters uc
        JOIN characters c ON c.id = uc.character_id
        WHERE uc.user_id = $1 AND LOWER(c.name) = $2
        LIMIT 1;
      `,
      [userId, characterId]
    );
    if (ownershipQuery.rows.length === 0) {
      return NextResponse.json({ error: "Character not owned" }, { status: 403 });
    }

    const response = NextResponse.json({ success: true, characterId });
    response.cookies.set({
      name: "selected_character_id",
      value: characterId,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to set selected character" },
      { status: 500 }
    );
  }
}
