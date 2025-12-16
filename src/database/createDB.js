const client = require('./client');

async function createDB() {
  try {
    await client.connect();
    await client.query('CREATE DATABASE ITCGroup7');
    console.log('Database ITCGroup7 created successfully');
  } catch (err) {
    console.error('Error creating database:', err);
  } finally {
    await client.end();
  }
}

createDB();