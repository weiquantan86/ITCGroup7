import bcrypt from 'bcrypt';
import pool from './client.ts';

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
      await pool.query(
        `
          INSERT INTO user_characters (user_id, character_id)
          SELECT $1, c.id
          FROM characters c
          WHERE c.name = 'Adam'
          ON CONFLICT DO NOTHING;
        `,
        [userId]
      );
      console.log("Seed user_characters reset: Sarcus only owns Adam");
    }
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    await pool.end();
  }
}

initDB();

