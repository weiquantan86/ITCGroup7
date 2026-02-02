import { Pool } from "pg";
import { connectionString } from "./client.ts";

const adminUrl = new URL(connectionString);
adminUrl.pathname = "/postgres";
const targetDb = "ITCGroup7";

async function deleteDB() {
  const adminPool = new Pool({ connectionString: adminUrl.toString() });
  try {
    await adminPool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();",
      [targetDb]
    );
    await adminPool.query(`DROP DATABASE IF EXISTS "${targetDb}"`);
    console.log(`Database ${targetDb} deleted successfully`);
  } catch (err) {
    console.error("Error deleting database:", err);
  } finally {
    await adminPool.end();
  }
}

deleteDB();
