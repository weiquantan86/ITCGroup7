import bcrypt from "bcrypt";
import pool from "./client.ts";
import {
  assignInitialCharacterToUser,
  ensureCharacterCatalog,
} from "./characterCatalog.ts";

const DEFAULT_SEED_SNACK_AMOUNT = 1000;

const ACCOUNT = {
  email: "sarcus1925@gmail.com",
  phone: "91994680",
  username: "Sarcus",
  password: "123456",
  isAuthorised: true,
} as const;

const ensureUserResourcesTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_resources (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      energy_sugar INTEGER NOT NULL DEFAULT 0 CHECK (energy_sugar >= 0),
      dream_fruit_dust INTEGER NOT NULL DEFAULT 0 CHECK (dream_fruit_dust >= 0),
      core_crunch_seed INTEGER NOT NULL DEFAULT 0 CHECK (core_crunch_seed >= 0),
      star_gel_essence INTEGER NOT NULL DEFAULT 0 CHECK (star_gel_essence >= 0),
      star_coin INTEGER NOT NULL DEFAULT 0 CHECK (star_coin >= 0),
      point INTEGER NOT NULL DEFAULT 0 CHECK (point >= 0)
    );
  `);
};

const assignUserResources = async (userId: number, snackAmount: number) => {
  await pool.query(
    `
      INSERT INTO user_resources (
        user_id,
        energy_sugar,
        dream_fruit_dust,
        core_crunch_seed,
        star_gel_essence
      )
      VALUES ($1, $2, $2, $2, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET
        energy_sugar = EXCLUDED.energy_sugar,
        dream_fruit_dust = EXCLUDED.dream_fruit_dust,
        core_crunch_seed = EXCLUDED.core_crunch_seed,
        star_gel_essence = EXCLUDED.star_gel_essence;
    `,
    [userId, snackAmount]
  );
};

const insertUserSarcus = async () => {
  await pool.query("BEGIN");
  try {
    await ensureUserResourcesTable();

    const existingUserResult = await pool.query(
      "SELECT id FROM users WHERE username = $1 LIMIT 1",
      [ACCOUNT.username]
    );

    if (existingUserResult.rows.length > 0) {
      const existingUserId = Number(existingUserResult.rows[0].id);
      await pool.query("DELETE FROM user_characters WHERE user_id = $1", [
        existingUserId,
      ]);
      await pool.query("DELETE FROM user_resources WHERE user_id = $1", [
        existingUserId,
      ]);
      await pool.query("DELETE FROM users WHERE id = $1", [existingUserId]);
      console.log("[insertUserSarcus] Existing Sarcus account removed");
    }

    const passwordHash = await bcrypt.hash(ACCOUNT.password, 10);
    const createdUserResult = await pool.query(
      `
        INSERT INTO users (email, phone, username, password_hash, is_authorised)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `,
      [
        ACCOUNT.email,
        ACCOUNT.phone,
        ACCOUNT.username,
        passwordHash,
        ACCOUNT.isAuthorised,
      ]
    );

    const userId = Number(createdUserResult.rows[0].id);
    await ensureCharacterCatalog(pool);
    await assignInitialCharacterToUser(pool, userId);
    await assignUserResources(userId, DEFAULT_SEED_SNACK_AMOUNT);

    await pool.query("COMMIT");
    console.log(
      "[insertUserSarcus] Completed: user reset with Adam as initial character and seed resources"
    );
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("[insertUserSarcus] Failed:", error);
  } finally {
    await pool.end();
  }
};

insertUserSarcus();
