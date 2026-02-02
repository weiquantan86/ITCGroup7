import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import pool from '../../../database/client';

export async function POST(request) {
  try {
    const { identifier, password } = await request.json();

    // Find user by email, phone, or username
    const userQuery = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR phone = $1 OR username = $1',
      [identifier]
    );
    if (userQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = userQuery.rows[0];

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username },
    });
    response.cookies.set({
      name: 'user_id',
      value: String(user.id),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
