import dotenv from "dotenv";
import { loadConfig } from "../config.js";
import { MongoConnectionManager } from "./connection.js";

dotenv.config();

async function checkLiveConnection() {
  const config = loadConfig();
  if (!config.MONGODB_URI) {
    console.log("[MongoDB Verification] MONGODB_URI is not configured in environment.");
    return;
  }

  const manager = MongoConnectionManager.getInstance();
  try {
    const db = await manager.connect(config);
    if (!db) {
      console.log("[MongoDB Verification] Connection returned null database.");
      return;
    }
    const pingOk = await manager.ping();
    console.log(
      `[MongoDB Verification] Live Atlas Connection: ${pingOk ? "SUCCESS (Ping Command OK 1)" : "FAILED"}`,
    );
    console.log(`[MongoDB Verification] Database Name: ${config.MONGODB_DB_NAME}`);
    await manager.disconnect();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[MongoDB Verification] Connection Failure: ${msg}`);
  }
}

checkLiveConnection();
