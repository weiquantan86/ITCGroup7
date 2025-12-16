const client = require('./client');

async function deleteDB() {
  try {
    await client.connect();
    await client.query('DROP DATABASE ITCGroup7');
    console.log('Database ITCGroup7 deleted successfully');
  } catch (err) {
    console.error('Error deleting database:', err);
  } finally {
    await client.end();
  }
}

deleteDB();