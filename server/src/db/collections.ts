import { Db } from "mongodb";

export const COLLECTIONS = {
  ACCOUNTS: "accounts",
  CASES: "cases",
  RECORDS: "records",
  INVESTIGATIONS: "investigations",
  INVESTIGATION_FILES: "investigation_files",
  INVESTIGATION_FINDINGS: "investigation_findings",
  APPROVAL_REQUESTS: "approval_requests",
} as const;

/**
 * Creates stable indexes idempotently across collections according to SPEC 4.1.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  const accounts = db.collection(COLLECTIONS.ACCOUNTS);
  await accounts.createIndex({ account_id: 1 }, { unique: true });
  await accounts.createIndex({ ghost_type: 1 });
  await accounts.createIndex({ owner_status: 1 });
  await accounts.createIndex({ ghost_type: 1, owner_status: 1 });

  const cases = db.collection(COLLECTIONS.CASES);
  await cases.createIndex({ case_id: 1 }, { unique: true });
  await cases.createIndex({ account_id: 1 });
  await cases.createIndex({ bundle_id: 1 });

  const records = db.collection(COLLECTIONS.RECORDS);
  await records.createIndex({ record_id: 1 }, { unique: true });
  await records.createIndex({ type: 1 });
  await records.createIndex({ actor_account_id: 1 });
  await records.createIndex({ investigation_id: 1 });
  await records.createIndex({ investigation_id: 1, record_id: 1 });

  const investigations = db.collection(COLLECTIONS.INVESTIGATIONS);
  await investigations.createIndex({ investigation_id: 1 }, { unique: true });
  await investigations.createIndex({ status: 1 });
  await investigations.createIndex({ created_at: -1 });
  await investigations.createIndex({ is_demo: 1 });
  await investigations.createIndex({ owner_id: 1 });
  await investigations.createIndex({ owner_id: 1, is_demo: 1 });
  await investigations.createIndex({ owner_id: 1, created_at: -1 });

  const files = db.collection(COLLECTIONS.INVESTIGATION_FILES);
  await files.createIndex({ file_id: 1 }, { unique: true });
  await files.createIndex({ investigation_id: 1 });
  try {
    await files.createIndex({ investigation_id: 1, filename: 1 }, { unique: true });
  } catch (err: unknown) {
    const errorObj = err as { code?: number; codeName?: string };
    if (errorObj?.code === 86 || errorObj?.codeName === "IndexKeySpecsConflict") {
      // Prior non-unique index exists with same name; drop it and recreate unique
      await files.dropIndex("investigation_id_1_filename_1");
      await files.createIndex({ investigation_id: 1, filename: 1 }, { unique: true });
    } else {
      throw err;
    }
  }

  const findings = db.collection(COLLECTIONS.INVESTIGATION_FINDINGS);
  await findings.createIndex({ investigation_id: 1 }, { unique: true });

  const approvals = db.collection(COLLECTIONS.APPROVAL_REQUESTS);
  await approvals.createIndex({ request_id: 1 }, { unique: true });
  await approvals.createIndex({ investigation_id: 1 });
  await approvals.createIndex({ account_id: 1 });
  await approvals.createIndex({ decision: 1 });
  await approvals.createIndex({ created_at: -1 });
}
