import { Pool } from "pg";

const DEFAULT_DB_CONNECTION_TIMEOUT_MS = 10_000;

const connectionTimeoutMsFromEnv = Number(process.env.DB_CONNECTION_TIMEOUT_MS);
const connectionTimeoutMillis =
  Number.isFinite(connectionTimeoutMsFromEnv) && connectionTimeoutMsFromEnv > 0
    ? connectionTimeoutMsFromEnv
    : DEFAULT_DB_CONNECTION_TIMEOUT_MS;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "[database] Missing DATABASE_URL. Add DATABASE_URL=... to .env.local."
  );
}

export const connectionString = databaseUrl;

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis,
});

pool.on("error", (error) => {
  console.error("[database] Unexpected idle client error:", error);
});

export default pool;
