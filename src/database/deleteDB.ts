import pool from "./client";

async function deleteDB() {
  try {
    await pool.connect();
    await pool.query('DROP DATABASE ITCGroup7');
    console.log('Database ITCGroup7 deleted successfully');
  } catch (err) {
    console.error('Error deleting database:', err);
  } finally {
    await pool.end();
  }
}

deleteDB();
