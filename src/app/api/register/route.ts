import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import pool from '../../../database/client';

export async function POST(request) {
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

    // Insert user
    await pool.query('INSERT INTO users (email, phone, username, password_hash) VALUES ($1, $2, $3, $4)', [email, phone, username, passwordHash]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}