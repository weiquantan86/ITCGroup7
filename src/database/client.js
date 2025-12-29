import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PH8moJRf9uxO@ep-raspy-breeze-a4cktifa-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

export default pool;