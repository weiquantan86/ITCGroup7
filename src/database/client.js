const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_PH8moJRf9uxO@ep-raspy-breeze-a4cktifa-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

module.exports = client;