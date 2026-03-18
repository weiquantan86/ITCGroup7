import type { PoolClient } from "pg";
import pool from "./client.ts";
import { ALL_CHARACTER_NAMES, ensureCharacterCatalog } from "./characterCatalog.ts";

const CANONICAL_CHARACTER_NAMES = [...ALL_CHARACTER_NAMES].map((name) =>
  name.toLowerCase()
);

const log = (message: string) => {
  console.log(`[initDB] ${message}`);
};

const ensureUsersTable = async (client: PoolClient) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_authorised BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      self_introduction TEXT
    );
  `);

  // Compatibility for legacy schema.
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'isAuthorised'
      ) THEN
        ALTER TABLE users RENAME COLUMN "isAuthorised" TO is_authorised;
      END IF;
    END
    $$;
  `);

  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_authorised BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS self_introduction TEXT;
  `);
};

const ensureCharactersTables = async (client: PoolClient) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS characters (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL
    );
  `);

  await ensureCharacterCatalog(client);

  const cleanupResult = await client.query(
    `
      DELETE FROM characters
      WHERE LOWER(name) <> ALL($1::text[]);
    `,
    [CANONICAL_CHARACTER_NAMES]
  );

  if ((cleanupResult.rowCount ?? 0) > 0) {
    log(`Removed ${String(cleanupResult.rowCount)} stale character(s).`);
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_characters (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, character_id)
    );
  `);
};

const ensureUserResourcesTable = async (client: PoolClient) => {
  await client.query(`
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

  // Compatibility for legacy schema.
  await client.query(`
    ALTER TABLE user_resources
    ADD COLUMN IF NOT EXISTS energy_sugar INTEGER NOT NULL DEFAULT 0;
  `);
  await client.query(`
    ALTER TABLE user_resources
    ADD COLUMN IF NOT EXISTS dream_fruit_dust INTEGER NOT NULL DEFAULT 0;
  `);
  await client.query(`
    ALTER TABLE user_resources
    ADD COLUMN IF NOT EXISTS core_crunch_seed INTEGER NOT NULL DEFAULT 0;
  `);
  await client.query(`
    ALTER TABLE user_resources
    ADD COLUMN IF NOT EXISTS star_gel_essence INTEGER NOT NULL DEFAULT 0;
  `);
  await client.query(`
    ALTER TABLE user_resources
    ADD COLUMN IF NOT EXISTS star_coin INTEGER NOT NULL DEFAULT 0;
  `);
  await client.query(`
    ALTER TABLE user_resources
    ADD COLUMN IF NOT EXISTS point INTEGER NOT NULL DEFAULT 0;
  `);

  await client.query(`
    INSERT INTO user_resources (user_id)
    SELECT u.id
    FROM users u
    LEFT JOIN user_resources ur ON ur.user_id = u.id
    WHERE ur.user_id IS NULL;
  `);
};

const ensureCommunityTable = async (client: PoolClient) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS community_comments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment TEXT NOT NULL,
      commented_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

const ensureFeedbackTables = async (client: PoolClient) => {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'user_feedback_status'
      ) THEN
        CREATE TYPE user_feedback_status AS ENUM (
          'not_started',
          'validating',
          'in_progress',
          'in_valid',
          'done'
        );
      END IF;
    END
    $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status user_feedback_status NOT NULL,
      report_date TIMESTAMPTZ NOT NULL,
      settle_date TIMESTAMPTZ,
      description TEXT
    );
  `);

  await client.query(`
    ALTER TABLE user_feedback
    ADD COLUMN IF NOT EXISTS description TEXT;
  `);
};

const ensureEmailTable = async (client: PoolClient) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_email (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      reward TEXT,
      send_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_read BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);
};

const ensureIndexes = async (client: PoolClient) => {
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_community_comments_user_id
    ON community_comments (user_id);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_community_comments_commented_date
    ON community_comments (commented_date DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_user_email_user_id
    ON user_email (user_id);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_user_email_send_date
    ON user_email (send_date DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id
    ON user_feedback (user_id);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_user_feedback_status
    ON user_feedback (status);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_user_feedback_report_date
    ON user_feedback (report_date DESC);
  `);
};

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await ensureUsersTable(client);
    await ensureCharactersTables(client);
    await ensureUserResourcesTable(client);
    await ensureCommunityTable(client);
    await ensureFeedbackTables(client);
    await ensureEmailTable(client);
    await ensureIndexes(client);

    await client.query("COMMIT");
    log("Database initialization completed.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[initDB] Rollback failed:", rollbackError);
    }
    console.error("[initDB] Failed:", error);
  } finally {
    client.release();
    await pool.end();
  }
};

initDB();
