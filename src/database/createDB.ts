import { Pool } from "pg";
import { connectionString } from "./client.ts";

const adminUrl = new URL(connectionString);
adminUrl.pathname = "/postgres";
const targetDb = "ITCGroup7";

async function createDB() {
  const adminPool = new Pool({ connectionString: adminUrl.toString() });
  try {
    await adminPool.query(`CREATE DATABASE "${targetDb}"`);
    console.log(`Database ${targetDb} created successfully`);
  } catch (err) {
    console.error("Error creating database:", err);
  } finally {
    await adminPool.end();
  }
}

createDB();
