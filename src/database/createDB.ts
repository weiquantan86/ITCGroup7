import pool from "./client";

async function createDB() {
  try {
    await pool.connect();
    await pool.query('CREATE DATABASE ITCGroup7');
    console.log('Database ITCGroup7 created successfully');
  } catch (err) {
    console.error('Error creating database:', err);
  } finally {
    await pool.end();
  }
}

createDB();
