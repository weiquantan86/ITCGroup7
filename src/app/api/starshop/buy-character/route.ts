import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/database/client";

const CHARACTER_COST_STAR_COIN = 1000;

const parsePositiveInt = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

const ensureUserResourcesRow = async (client: Awaited<ReturnType<typeof pool.connect>>, userId: number) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_resources (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      energy_sugar INTEGER NOT NULL DEFAULT 0 CHECK (energy_sugar >= 0),
      dream_fruit_dust INTEGER NOT NULL DEFAULT 0 CHECK (dream_fruit_dust >= 0),
      core_crunch_seed INTEGER NOT NULL DEFAULT 0 CHECK (core_crunch_seed >= 0),
      star_gel_essence INTEGER NOT NULL DEFAULT 0 CHECK (star_gel_essence >= 0),
      star_coin INTEGER NOT NULL DEFAULT 0 CHECK (star_coin >= 0),
      point INTEGER NOT NULL DEFAULT 0 CHECK (point >= 0)
    )
  `);
  await client.query(`
    ALTER TABLE user_resources
    ADD COLUMN IF NOT EXISTS star_coin INTEGER NOT NULL DEFAULT 0
  `);
  await client.query(
    `
      INSERT INTO user_resources (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );
};

type BuyCharacterPayload = {
  characterId?: unknown;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const userId = parsePositiveInt(userIdValue);
  if (!userId) {
    return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  }

  let payload: BuyCharacterPayload;
  try {
    payload = (await request.json()) as BuyCharacterPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const characterId = parsePositiveInt(payload?.characterId);
  if (!characterId) {
    return NextResponse.json({ error: "Invalid character ID." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureUserResourcesRow(client, userId);

    const resourceResult = await client.query(
      `
        SELECT COALESCE(star_coin, 0) AS star_coin
        FROM user_resources
        WHERE user_id = $1
        FOR UPDATE
      `,
      [userId]
    );
    if (resourceResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "User resource row not found." },
        { status: 404 }
      );
    }

    const starCoin = parsePositiveInt(resourceResult.rows[0].star_coin) ?? 0;
    if (starCoin < CHARACTER_COST_STAR_COIN) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Not enough Star Coin." },
        { status: 400 }
      );
    }

    const characterResult = await client.query(
      `
        SELECT id, name
        FROM characters
        WHERE id = $1
        LIMIT 1
      `,
      [characterId]
    );
    if (characterResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Character not found." },
        { status: 404 }
      );
    }

    const insertOwnedResult = await client.query(
      `
        INSERT INTO user_characters (user_id, character_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING character_id
      `,
      [userId, characterId]
    );
    if (!insertOwnedResult.rowCount || insertOwnedResult.rowCount <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Character already owned." },
        { status: 400 }
      );
    }

    const updatedResourceResult = await client.query(
      `
        UPDATE user_resources
        SET star_coin = COALESCE(star_coin, 0) - $2
        WHERE user_id = $1
        RETURNING COALESCE(star_coin, 0) AS star_coin
      `,
      [userId, CHARACTER_COST_STAR_COIN]
    );
    const updatedStarCoin = parsePositiveInt(
      updatedResourceResult.rows[0]?.star_coin
    ) ?? 0;

    await client.query("COMMIT");
    return NextResponse.json({
      success: true,
      starCoin: updatedStarCoin,
      character: {
        id: characterId,
        name: String(characterResult.rows[0].name ?? `Character #${characterId}`),
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
      { error: "Failed to buy character." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
