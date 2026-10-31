import dotenv from "dotenv";
import { loadConfig } from "../config.js";
import { MongoConnectionManager } from "./connection.js";
import { COLLECTIONS, ensureIndexes } from "./collections.js";
import { SYNTHETIC_ACCOUNTS } from "../fixtures/syntheticAccounts.js";
import { SYNTHETIC_CASES, SYNTHETIC_RECORDS } from "../fixtures/syntheticCases.js";

dotenv.config();

/**
 * Explicit seed script for MongoDB Atlas.
 * Never executed automatically at server startup.
 * Safe to run repeatedly (uses deterministic upsert, never overwrites user data).
 */
export async function seedDatabase(): Promise<{
  accountsUpserted: number;
  casesUpserted: number;
  recordsUpserted: number;
}> {
  const config = loadConfig();
  if (!config.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured in environment. Cannot seed database.");
  }

  const manager = MongoConnectionManager.getInstance();
  const db = await manager.connect(config);
  if (!db) {
    throw new Error("Failed to acquire MongoDB database instance.");
  }

  await ensureIndexes(db);

  let accountsCount = 0;
  const accountsCol = db.collection(COLLECTIONS.ACCOUNTS);
  for (const acc of SYNTHETIC_ACCOUNTS) {
    await accountsCol.updateOne(
      { account_id: acc.account_id },
      {
        $setOnInsert: {
          ...acc,
          is_synthetic: true,
          seeded_at: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    accountsCount++;
  }

  let casesCount = 0;
  const casesCol = db.collection(COLLECTIONS.CASES);
  for (const caseData of Object.values(SYNTHETIC_CASES)) {
    await casesCol.updateOne(
      { case_id: caseData.case_id },
      {
        $setOnInsert: {
          ...caseData,
          is_synthetic: true,
          seeded_at: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    casesCount++;
  }

  let recordsCount = 0;
  const recordsCol = db.collection(COLLECTIONS.RECORDS);
  for (const record of Object.values(SYNTHETIC_RECORDS)) {
    await recordsCol.updateOne(
      { record_id: record.record_id },
      {
        $setOnInsert: {
          ...record,
          is_synthetic: true,
          seeded_at: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    recordsCount++;
  }

  return {
    accountsUpserted: accountsCount,
    casesUpserted: casesCount,
    recordsUpserted: recordsCount,
  };
}

// Direct execution from CLI
if (process.argv[1] && process.argv[1].includes("seed")) {
  seedDatabase()
    .then((counts) => {
      console.log(
        `[keys-of-the-departed] Seed complete: ${counts.accountsUpserted} accounts, ${counts.casesUpserted} cases, ${counts.recordsUpserted} records registered.`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(
        "[keys-of-the-departed] Seed failed:",
        err instanceof Error ? err.message : "Unknown error",
      );
      process.exit(1);
    });
}
