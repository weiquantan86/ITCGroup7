import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import pool from '../../../database/client';
import { getDatabaseErrorDetails } from '../../../database/error';
import {
  assignInitialCharacterToUser,
  ensureCharacterCatalog,
} from '../../../database/characterCatalog';

export async function POST(request) {
  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
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
    transactionStarted = true;

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

    await ensureCharacterCatalog(client);
    await assignInitialCharacterToUser(client, userId);

    await client.query('COMMIT');
    transactionStarted = false;

    return NextResponse.json({ success: true });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[api/register] Failed to rollback transaction:', rollbackError);
      }
    }

    const dbError = getDatabaseErrorDetails(error);

    if (dbError.isConnectionError) {
      console.error(
        `[api/register] Database connection failed (timeout=${dbError.isTimeout}, codes=${
          dbError.codes.join(',') || 'none'
        }): ${dbError.message}`,
        error
      );
      return NextResponse.json(
        {
          error: dbError.isTimeout
            ? 'Database connection timed out. Please try again shortly.'
            : 'Database is temporarily unavailable. Please try again shortly.',
        },
        { status: 503 }
      );
    }

    console.error('[api/register] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
