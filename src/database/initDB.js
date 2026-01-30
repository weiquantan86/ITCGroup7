import bcrypt from 'bcrypt';
import pool from './client.js';

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);
    console.log('Users table created or already exists');

    const passwordHash = await bcrypt.hash('123456', 10);
    await pool.query(
      `
        INSERT INTO users (email, phone, username, password_hash)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING;
      `,
      ['sarcus1925@gmail.com', '91994680', 'Sarcus', passwordHash]
    );
    console.log('Seed user inserted or already exists');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    await pool.end();
  }
}

initDB();
