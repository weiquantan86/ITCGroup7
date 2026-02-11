import bcrypt from 'bcrypt';
import pool from './client.ts';

const DEFAULT_CHARACTER_NAME = 'Adam';

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

async function initUserWeiquan() {
  const account = {
    email: 'weiquan.itc7@gmail.com',
    phone: '90000001',
    username: 'weiquan',
    password: 'weiquan',
    isAuthorised: true,
  };

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

    await pool.query('COMMIT');
    console.log('initUserWeiquan completed: user reset with Adam');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error initUserWeiquan:', err);
  } finally {
    await pool.end();
  }
}

initUserWeiquan();
