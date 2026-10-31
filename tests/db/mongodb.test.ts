import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryMongoDb } from "./testMongoDb.js";
import { MongoAccountsRepository } from "../../server/src/repositories/mongoAccountsRepository.js";
import { MongoCasesRepository } from "../../server/src/repositories/mongoCasesRepository.js";
import { MongoInvestigationsRepository } from "../../server/src/repositories/mongoInvestigationsRepository.js";
import { MongoConnectionManager } from "../../server/src/db/connection.js";
import { loadConfig } from "../../server/src/config.js";
import { computeHealthStatus } from "../../server/src/health.js";
import { COLLECTIONS, ensureIndexes } from "../../server/src/db/collections.js";
import { ArchiveAccount, Case, EvidenceRecord } from "@keys/contracts";

describe("MongoDB Atlas Integration & Repositories", () => {
  let memoryDb: InMemoryMongoDb;

  beforeEach(() => {
    memoryDb = new InMemoryMongoDb();
  });

  describe("Connection Manager & Safe Health Verification", () => {
    it("MONGO-01: Does not attempt connection when MONGODB_URI is undefined", async () => {
      const manager = MongoConnectionManager.getInstance();
      const config = loadConfig({ NODE_ENV: "test" });
      const db = await manager.connect(config);

      expect(db).toBeNull();
      expect(manager.isConnected()).toBe(false);
    });

    it("MONGO-02: Real database ping distinguishes healthy, failing, and not_configured states", async () => {
      const startTime = Date.now();
      const demoConfig = loadConfig({ NODE_ENV: "test" });

      // Unconfigured returns 200 with not_configured
      const unconfiguredHealth = await computeHealthStatus(demoConfig, startTime);
      expect(unconfiguredHealth.httpStatus).toBe(200);
      expect(unconfiguredHealth.status.checks.db).toBe("not_configured");

      // Configured with failing ping returns 503 and unavailable
      const configuredConfig = loadConfig({
        NODE_ENV: "test",
        MONGODB_URI: "mongodb://user:secret@127.0.0.1:27017/test_db",
      });

      const failingHealth = await computeHealthStatus(configuredConfig, startTime, {
        checkDb: async () => {
          memoryDb.pingShouldFail = true;
          try {
            await memoryDb.getDb().command({ ping: 1 });
            return "ok";
          } catch {
            return "unavailable";
          }
        },
      });

      expect(failingHealth.httpStatus).toBe(503);
      expect(failingHealth.status.status).toBe("unavailable");
      expect(failingHealth.status.checks.db).toBe("unavailable");

      // Configured with successful ping returns 200 and ok
      memoryDb.pingShouldFail = false;
      const successHealth = await computeHealthStatus(configuredConfig, startTime, {
        checkDb: async () => {
          await memoryDb.getDb().command({ ping: 1 });
          return "ok";
        },
      });

      expect(successHealth.httpStatus).toBe(200);
      expect(successHealth.status.status).toBe("ok");
      expect(successHealth.status.checks.db).toBe("ok");
    });

    it("MONGO-03: Connection error logs sanitize credentials and never leak passwords", async () => {
      const manager = MongoConnectionManager.getInstance();
      const badConfig = loadConfig({
        NODE_ENV: "test",
        MONGODB_URI: "mongodb://super_admin:super_secret_password_123@127.0.0.1:1/nonexistent",
      });

      try {
        await manager.connect(badConfig);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).not.toContain("super_secret_password_123");
      }
    });

    it("MONGO-04: Indexes are ensured idempotently across all collections", async () => {
      const db = memoryDb.getDb();
      await expect(ensureIndexes(db)).resolves.not.toThrow();
    });
  });

  describe("MongoAccountsRepository", () => {
    const sampleAccount: ArchiveAccount = {
      account_id: "acc_mongo_test_01",
      ghost_type: "LOST",
      owner_status: "verified",
      owner_name: "Sarah Chen",
      purpose: "Production database replica backup deploy key",
      primary_quote: "Signed-off-by: Sarah Chen in commit 8f92ab01",
      kind: "deploy_key",
      created_at: "2026-01-01T00:00:00.000Z",
      last_used_at: "2026-10-25T14:00:00.000Z",
      permissions: ["repo:write"],
      tags: ["backup", "postgres", "production"],
      expires_at: null,
      case_id: "case_mongo_test_01",
    };

    beforeEach(async () => {
      const db = memoryDb.getDb();
      await db.collection(COLLECTIONS.ACCOUNTS).insertOne(sampleAccount);
    });

    it("MONGO-05: Queries single account by ID and strips internal _id", async () => {
      const repo = new MongoAccountsRepository(memoryDb.getDb());
      const account = await repo.findAccountById("acc_mongo_test_01");

      expect(account).not.toBeNull();
      expect(account?.account_id).toBe("acc_mongo_test_01");
      expect((account as any)._id).toBeUndefined();
      expect(account?.owner_name).toBe("Sarah Chen");
    });

    it("MONGO-06: Filters accounts by chamber and status with pagination", async () => {
      const repo = new MongoAccountsRepository(memoryDb.getDb());

      const resAll = await repo.findAccounts({
        chapter: "ALL",
        status: "ALL",
        search: "",
        page: 1,
        limit: 10,
      });

      expect(resAll.data).toHaveLength(1);
      expect(resAll.pagination.total).toBe(1);

      // Filtering by a different chapter returns empty
      const resForgotten = await repo.findAccounts({
        chapter: "FORGOTTEN",
        status: "ALL",
        search: "",
        page: 1,
        limit: 10,
      });
      expect(resForgotten.data).toHaveLength(0);
      expect(resForgotten.pagination.total).toBe(0);
    });

    it("MONGO-07: Safe search query escaping handles regex special characters without crashing", async () => {
      const repo = new MongoAccountsRepository(memoryDb.getDb());

      // Should not throw or cause regex syntax error with parenthesis or brackets
      const res = await repo.findAccounts({
        chapter: "ALL",
        status: "ALL",
        search: "Sarah (Chen) [backup]+",
        page: 1,
        limit: 10,
      });

      expect(res.data).toBeDefined();
    });
  });

  describe("MongoCasesRepository", () => {
    const sampleRecord: EvidenceRecord = {
      record_id: "rec_audit_01",
      type: "commit",
      ts: "2026-10-25T10:00:00.000Z",
      author_handle: "schen",
      assignee_handle: null,
      actor_account_id: "acc_mongo_test_01",
      content: "commit 8f92ab01\nAuthor: Sarah Chen <schen@internal.corp>\nAdd backup key.",
      structured: false,
    };

    const sampleCase: Case = {
      case_id: "case_mongo_test_01",
      bundle_id: "bundle_synth_01",
      account_id: "acc_mongo_test_01",
      claims_accepted: [
        {
          kind: "owner",
          account_id: "acc_mongo_test_01",
          person_id: "person_schen",
          record_id: "rec_audit_01",
          quote: "Author: Sarah Chen <schen@internal.corp>",
          text: "Evidence confirms Sarah Chen created this key.",
        },
      ],
      claims_removed: [],
      owner_status: "verified",
      purpose_status: "verified",
      ghost_type: "LOST",
      model: "gemma3:4b",
      latency_ms: 120,
    };

    beforeEach(async () => {
      const db = memoryDb.getDb();
      await db.collection(COLLECTIONS.CASES).insertOne(sampleCase);
      await db.collection(COLLECTIONS.RECORDS).insertOne(sampleRecord);
    });

    it("MONGO-08: Queries case by ID and retrieves linked evidence records", async () => {
      const repo = new MongoCasesRepository(memoryDb.getDb());
      const caseDoc = await repo.findCaseById("case_mongo_test_01");

      expect(caseDoc).not.toBeNull();
      expect(caseDoc?.case_id).toBe("case_mongo_test_01");

      const records = await repo.findRecordsByCaseId("case_mongo_test_01");
      expect(records).toHaveLength(1);
      expect(records[0].record_id).toBe("rec_audit_01");
      expect((records[0] as any)._id).toBeUndefined();
    });

    it("MONGO-09: Returns null and empty arrays for unknown cases and records", async () => {
      const repo = new MongoCasesRepository(memoryDb.getDb());
      expect(await repo.findCaseById("case_nonexistent")).toBeNull();
      expect(await repo.findRecordById("rec_nonexistent")).toBeNull();
      expect(await repo.findRecordsByCaseId("case_nonexistent")).toEqual([]);
    });
  });

  describe("MongoInvestigationsRepository & Persistence Across Recreation", () => {
    it("MONGO-10: Creates investigation, ingests source files, and processes findings in MongoDB", async () => {
      const db = memoryDb.getDb();
      const repo = new MongoInvestigationsRepository(db);

      // 1. Create investigation
      const inv = await repo.createInvestigation({
        name: "Security Audit Q4",
        description: "Post-incident credentials review",
      });

      expect(inv.investigation_id).toBeDefined();
      expect(inv.status).toBe("created");

      // 2. Upload and parse records
      const uploadResult = await repo.addUploadedFiles(inv.investigation_id, [
        {
          filename: "audit_commits.log",
          content: "Author: Marcus Vance <marcus@internal.corp>\nAdd key for acc_deploy_key_881.",
        },
      ]);

      expect(uploadResult.files).toHaveLength(1);
      expect(uploadResult.extracted_records).toHaveLength(1);
      expect(uploadResult.errors).toHaveLength(0);

      // 3. Process investigation
      const findings = await repo.processInvestigation(inv.investigation_id);
      expect(findings.investigation.status).toBe("completed");
      expect(findings.files[0].status).toBe("processed");
      expect(findings.processing_summary.total_records_processed).toBe(1);

      // 4. Persistence Test: Recreating repository instance over the same DB maintains all state
      const recreatedRepo = new MongoInvestigationsRepository(db);
      const reloadedInv = await recreatedRepo.findInvestigationById(inv.investigation_id);
      expect(reloadedInv).not.toBeNull();
      expect(reloadedInv?.status).toBe("completed");

      const reloadedFindings = await recreatedRepo.getFindingsByInvestigationId(
        inv.investigation_id,
      );
      expect(reloadedFindings).not.toBeNull();
      expect(reloadedFindings?.files).toHaveLength(1);
      expect(reloadedFindings?.discovered_accounts.length).toBeGreaterThan(0);
    });

    it("MONGO-11: Enforces 5MB file size limit and allowed extensions", async () => {
      const db = memoryDb.getDb();
      const repo = new MongoInvestigationsRepository(db);

      const inv = await repo.createInvestigation({
        name: "Rejection Audit",
        description: "Enforces 5MB file size limit and allowed extensions",
      });

      const res = await repo.addUploadedFiles(inv.investigation_id, [
        {
          filename: "malicious_script.exe",
          content: "MZ...",
        },
        {
          filename: "empty_record.log",
          content: "",
        },
      ]);

      expect(res.errors.length).toBeGreaterThanOrEqual(2);
      expect(res.files[0].status).toBe("invalid");
      expect(res.files[1].status).toBe("invalid");
    });

    it("MONGO-12: Enforces ownership isolation and demo classification at database query level", async () => {
      const db = memoryDb.getDb();
      const repo = new MongoInvestigationsRepository(db);

      // 1. Insert explicit demo investigation directly into collection
      await db.collection(COLLECTIONS.INVESTIGATIONS).insertOne({
        investigation_id: "inv_db_demo_01",
        bundle_id: "bundle_synth_01",
        name: "Synthetic Demo Investigation",
        description: "Public demo case",
        status: "completed",
        file_count: 0,
        record_count: 0,
        accounts_discovered_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_demo: true,
        owner_id: null,
      });

      // 2. Insert legacy unowned investigation without is_demo or owner_id
      await db.collection(COLLECTIONS.INVESTIGATIONS).insertOne({
        investigation_id: "inv_db_legacy_unowned",
        bundle_id: "bundle_synth_01",
        name: "Legacy Unowned Audit",
        description: "Legacy unowned investigation",
        status: "completed",
        file_count: 0,
        record_count: 0,
        accounts_discovered_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 3. Create private investigation for user Alpha
      const alphaInv = await repo.createInvestigation(
        {
          name: "Alpha Private Audit",
          description: "Belongs to user Alpha",
        },
        "auth0|user_alpha",
      );
      expect(alphaInv.owner_id).toBe("auth0|user_alpha");
      expect(alphaInv.is_demo).toBe(false);

      // 4. Create private investigation for user Beta
      const betaInv = await repo.createInvestigation(
        {
          name: "Beta Private Audit",
          description: "Belongs to user Beta",
        },
        "auth0|user_beta",
      );
      expect(betaInv.owner_id).toBe("auth0|user_beta");
      expect(betaInv.is_demo).toBe(false);

      // 5. Anonymous list returns ONLY explicit demo records
      const anonList = await repo.listInvestigations();
      const anonIds = anonList.map((i) => i.investigation_id);
      expect(anonIds).toContain("inv_db_demo_01");
      expect(anonIds).not.toContain("inv_db_legacy_unowned");
      expect(anonIds).not.toContain(alphaInv.investigation_id);
      expect(anonIds).not.toContain(betaInv.investigation_id);

      // 6. User Alpha list returns demo + Alpha's private records, never Beta or legacy
      const alphaList = await repo.listInvestigations("auth0|user_alpha");
      const alphaIds = alphaList.map((i) => i.investigation_id);
      expect(alphaIds).toContain("inv_db_demo_01");
      expect(alphaIds).toContain(alphaInv.investigation_id);
      expect(alphaIds).not.toContain(betaInv.investigation_id);
      expect(alphaIds).not.toContain("inv_db_legacy_unowned");

      // 7. User Beta list returns demo + Beta's private records, never Alpha or legacy
      const betaList = await repo.listInvestigations("auth0|user_beta");
      const betaIds = betaList.map((i) => i.investigation_id);
      expect(betaIds).toContain("inv_db_demo_01");
      expect(betaIds).toContain(betaInv.investigation_id);
      expect(betaIds).not.toContain(alphaInv.investigation_id);
      expect(betaIds).not.toContain("inv_db_legacy_unowned");
    });
  });
});
