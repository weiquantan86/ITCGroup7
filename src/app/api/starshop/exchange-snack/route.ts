import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/database/client";
import {
  SNACK_KEYS,
  ZERO_SNACK_INVENTORY,
  type SnackInventory,
  type SnackKey,
} from "@/app/components/gachaHandler/rateConfig";

const SNACK_EXCHANGE_RATIO = 2;
const SNACK_KEY_SET = new Set<SnackKey>(SNACK_KEYS);

const parsePositiveInt = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

const parseNonNegativeInt = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
};

const isSnackKey = (value: unknown): value is SnackKey =>
  typeof value === "string" && SNACK_KEY_SET.has(value as SnackKey);

const parseSnackInventory = (row?: Record<string, unknown>): SnackInventory => {
  const parsed: SnackInventory = { ...ZERO_SNACK_INVENTORY };
  if (!row) return parsed;
  for (const key of SNACK_KEYS) {
    parsed[key] = parseNonNegativeInt(row[key]);
  }
  return parsed;
};

const ensureUserResourcesRow = async (
  client: Awaited<ReturnType<typeof pool.connect>>,
  userId: number
) => {
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

type ExchangeSnackPayload = {
  fromSnack?: unknown;
  toSnack?: unknown;
  targetCount?: unknown;
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

  let payload: ExchangeSnackPayload;
  try {
    payload = (await request.json()) as ExchangeSnackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const fromSnack = payload?.fromSnack;
  const toSnack = payload?.toSnack;
  const targetCount = parsePositiveInt(payload?.targetCount);
  if (!isSnackKey(fromSnack) || !isSnackKey(toSnack) || !targetCount) {
    return NextResponse.json(
      { error: "Invalid snack exchange parameters." },
      { status: 400 }
    );
  }
  if (fromSnack === toSnack) {
    return NextResponse.json(
      { error: "Source and target snacks must be different." },
      { status: 400 }
    );
  }

  const requiredFrom = targetCount * SNACK_EXCHANGE_RATIO;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureUserResourcesRow(client, userId);

    const resourceResult = await client.query(
      `
        SELECT
          COALESCE(energy_sugar, 0) AS energy_sugar,
          COALESCE(dream_fruit_dust, 0) AS dream_fruit_dust,
          COALESCE(core_crunch_seed, 0) AS core_crunch_seed,
          COALESCE(star_gel_essence, 0) AS star_gel_essence,
          COALESCE(star_coin, 0) AS star_coin
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

    const currentInventory = parseSnackInventory(
      resourceResult.rows[0] as Record<string, unknown>
    );
    if (currentInventory[fromSnack] < requiredFrom) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Not enough source snacks." },
        { status: 400 }
      );
    }

    const updateResult = await client.query(
      `
        UPDATE user_resources
        SET
          ${fromSnack} = COALESCE(${fromSnack}, 0) - $2,
          ${toSnack} = COALESCE(${toSnack}, 0) + $3
        WHERE user_id = $1
        RETURNING
          COALESCE(energy_sugar, 0) AS energy_sugar,
          COALESCE(dream_fruit_dust, 0) AS dream_fruit_dust,
          COALESCE(core_crunch_seed, 0) AS core_crunch_seed,
          COALESCE(star_gel_essence, 0) AS star_gel_essence,
          COALESCE(star_coin, 0) AS star_coin
      `,
      [userId, requiredFrom, targetCount]
    );
    const updatedRow = updateResult.rows[0] as Record<string, unknown> | undefined;
    const updatedInventory = parseSnackInventory(updatedRow);
    const updatedStarCoin = parseNonNegativeInt(updatedRow?.star_coin);

    await client.query("COMMIT");
    return NextResponse.json({
      success: true,
      inventory: updatedInventory,
      starCoin: updatedStarCoin,
      spentFrom: requiredFrom,
      receivedTo: targetCount,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(rollbackError);
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to exchange snacks." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
