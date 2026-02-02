import { Pool } from "pg";

export const connectionString =
  "postgresql://neondb_owner:npg_PH8moJRf9uxO@ep-raspy-breeze-a4cktifa-pooler.us-east-1.aws.neon.tech/ITCGroup7?sslmode=require&channel_binding=require";

const pool = new Pool({ connectionString });

export default pool;
