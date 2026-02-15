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
    [userId, amount]
  );
}

async function initUserWeiquan() {
  const account = {
    email: 'weiquan.itc7@gmail.com',
    phone: '90000001',
    username: 'weiquan',
    password: 'weiquan',
    isAuthorised: true,
  };

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_resources (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      energy_sugar INTEGER NOT NULL DEFAULT 0 CHECK (energy_sugar >= 0),
      dream_fruit_dust INTEGER NOT NULL DEFAULT 0 CHECK (dream_fruit_dust >= 0),
      core_crunch_seed INTEGER NOT NULL DEFAULT 0 CHECK (core_crunch_seed >= 0),
      star_gel_essence INTEGER NOT NULL DEFAULT 0 CHECK (star_gel_essence >= 0)
    );
  `);

  await pool.query('BEGIN');
  try {
    const existingUserResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [account.username]
    );

    if (existingUserResult.rows.length > 0) {
      const existingUserId = existingUserResult.rows[0].id;
      await pool.query('DELETE FROM user_characters WHERE user_id = $1', [
        existingUserId,
      ]);
      await pool.query('DELETE FROM user_resources WHERE user_id = $1', [
        existingUserId,
      ]);
      await pool.query('DELETE FROM users WHERE id = $1', [existingUserId]);
      console.log('Existing Weiquan account removed');
    }

    const passwordHash = await bcrypt.hash(account.password, 10);
    const createdUserResult = await pool.query(
      `
        INSERT INTO users (email, phone, username, password_hash, is_authorised)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `,
      [
        account.email,
        account.phone,
        account.username,
        passwordHash,
        account.isAuthorised,
      ]
    );

    const userId = createdUserResult.rows[0].id;
    await assignDefaultCharacter(userId);
    await assignUserResources(userId, DEFAULT_SEED_RESOURCE_AMOUNT);

    await pool.query('COMMIT');
    console.log('initUserWeiquan completed: user reset with Adam and seed resources');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error initUserWeiquan:', err);
  } finally {
    await pool.end();
  }
}

initUserWeiquan();
