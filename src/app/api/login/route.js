import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import client from '../../../database/client';

export async function POST(request) {
  try {
    const { identifier, password } = await request.json();

    await client.connect();

    // Find user by email, phone, or username
    const userQuery = await client.query('SELECT * FROM users WHERE email = $1 OR phone = $1 OR username = $1', [identifier]);
    if (userQuery.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = userQuery.rows[0];

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email, username: user.username } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await client.end();
  }
}