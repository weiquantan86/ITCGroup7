import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import pool from '../../../database/client';

export async function POST(request) {
  const client = await pool.connect();
  try {
    const { email, phone, username, password } = await request.json();

    // Check for existing email
    const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    // Check for existing phone
    const phoneCheck = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (phoneCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Phone already exists' }, { status: 400 });
    }

    // Check for existing username
    const usernameCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (usernameCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    await client.query('BEGIN');

    // Insert user
    const userInsertResult = await client.query(
      'INSERT INTO users (email, phone, username, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, phone, username, passwordHash]
    );

    const userId = userInsertResult.rows[0].id;

    await client.query(
      `
        INSERT INTO user_resources (
          user_id,
          energy_sugar,
          dream_fruit_dust,
          core_crunch_seed,
          star_gel_essence,
          point
        )
        VALUES ($1, 0, 0, 0, 0, 0)
        ON CONFLICT (user_id) DO NOTHING
      `,
      [userId]
    );

    await client.query('COMMIT');

    return NextResponse.json({ success: true });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(rollbackError);
    }
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
