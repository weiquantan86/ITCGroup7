import bcrypt from 'bcrypt';
import pool from './client.ts';

const DEFAULT_CHARACTER_NAME = 'Adam';
const DEFAULT_SEED_RESOURCE_AMOUNT = 5;

async function assignDefaultCharacter(userId: number) {
  await pool.query(
    `
      INSERT INTO user_characters (user_id, character_id)
      SELECT $1, c.id
      FROM characters c
      WHERE c.name = $2
      ON CONFLICT DO NOTHING;
    `,
    [userId, DEFAULT_CHARACTER_NAME]
  );
}

async function assignUserResources(userId: number, amount: number) {
  await pool.query(
    `
      INSERT INTO user_resources (
        user_id,
        energy_sugar,
        dream_fruit_dust,
        core_crunch_seed,
        star_gel_essence,
        point
      )
      VALUES ($1, $2, $2, $2, $2, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET
        energy_sugar = EXCLUDED.energy_sugar,
        dream_fruit_dust = EXCLUDED.dream_fruit_dust,
        core_crunch_seed = EXCLUDED.core_crunch_seed,
        star_gel_essence = EXCLUDED.star_gel_essence,
        point = EXCLUDED.point;
    `,
    [userId, amount]
  );
}

async function initDB() {
  try {
    await pool.query(`
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
    console.log('Users table created or already exists');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS characters (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL
      );
    `);
    console.log('Characters table created or already exists');

    await pool.query(
      `
        INSERT INTO characters (name)
        VALUES ($1), ($2), ($3), ($4), ($5), ($6), ($7), ($8)
        ON CONFLICT DO NOTHING;
      `,
      ['Adam', 'Baron', 'Carrot', 'Dakota', 'Eli', 'Felix', 'Grant', 'Harper']
    );
    console.log('Seed characters inserted or already exist');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_characters (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, character_id)
      );
    `);
    console.log('User characters table created or already exists');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_resources (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        energy_sugar INTEGER NOT NULL DEFAULT 0 CHECK (energy_sugar >= 0),
        dream_fruit_dust INTEGER NOT NULL DEFAULT 0 CHECK (dream_fruit_dust >= 0),
        core_crunch_seed INTEGER NOT NULL DEFAULT 0 CHECK (core_crunch_seed >= 0),
        star_gel_essence INTEGER NOT NULL DEFAULT 0 CHECK (star_gel_essence >= 0),
        point INTEGER NOT NULL DEFAULT 0 CHECK (point >= 0)
      );
    `);
    console.log('User resources table created or already exists');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS community_comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        commented_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Community comments table created or already exists');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_community_comments_user_id
      ON community_comments (user_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_community_comments_commented_date
      ON community_comments (commented_date DESC);
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'isAuthorised'
        ) THEN
          ALTER TABLE users RENAME COLUMN "isAuthorised" TO is_authorised;
        END IF;
      END
      $$;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_authorised BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS self_introduction TEXT;
    `);

    await pool.query(`
      ALTER TABLE user_resources
      ADD COLUMN IF NOT EXISTS energy_sugar INTEGER NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE user_resources
      ADD COLUMN IF NOT EXISTS dream_fruit_dust INTEGER NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE user_resources
      ADD COLUMN IF NOT EXISTS core_crunch_seed INTEGER NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE user_resources
      ADD COLUMN IF NOT EXISTS star_gel_essence INTEGER NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE user_resources
      ADD COLUMN IF NOT EXISTS point INTEGER NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      INSERT INTO user_resources (user_id)
      SELECT u.id
      FROM users u
      LEFT JOIN user_resources ur ON ur.user_id = u.id
      WHERE ur.user_id IS NULL;
    `);

    const passwordHash = await bcrypt.hash('123456', 10);
    await pool.query(
      `
        INSERT INTO users (email, phone, username, password_hash, is_authorised)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING;
      `,
      ['sarcus1925@gmail.com', '91994680', 'Sarcus', passwordHash, true]
    );
    console.log('Seed user inserted or already exists');

    const userResult = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      ["Sarcus"]
    );
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      // Clear existing user characters
      await pool.query(
        "DELETE FROM user_characters WHERE user_id = $1",
        [userId]
      );
      
      // Only insert Adam as the default character
      await assignDefaultCharacter(userId);
      await assignUserResources(userId, DEFAULT_SEED_RESOURCE_AMOUNT);
      console.log("Seed user_characters reset: Sarcus only owns Adam");
    }
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    await pool.end();
  }
}

initDB();

