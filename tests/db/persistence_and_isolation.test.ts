import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import { InMemoryMongoDb } from "./testMongoDb.js";
import { MongoAccountsRepository } from "../../server/src/repositories/mongoAccountsRepository.js";
import { MongoCasesRepository } from "../../server/src/repositories/mongoCasesRepository.js";
import { MongoInvestigationsRepository } from "../../server/src/repositories/mongoInvestigationsRepository.js";
import { UnavailableInvestigationsRepository } from "../../server/src/repositories/unavailableInvestigationsRepository.js";
import { ensureIndexes } from "../../server/src/db/collections.js";
import { setupMockAuth0Server, MockAuth0Server } from "../helpers/authHelper.js";
import { InvestigationFindingsSchema } from "@keys/contracts";

describe("Phase 1: Complete Backend Persistence, Ownership Isolation & Fault Tolerance", () => {
  let mockAuth0: MockAuth0Server;
  let memoryDb: InMemoryMongoDb;
  let aliceToken: string;
  let bobToken: string;

  beforeAll(async () => {
    mockAuth0 = await setupMockAuth0Server();
    aliceToken = await mockAuth0.generateToken({
      sub: "auth0|alice_engineer",
      permissions: ["create:investigations", "read:investigations"],
    });
    bobToken = await mockAuth0.generateToken({
      sub: "auth0|bob_auditor",
      permissions: ["create:investigations", "read:investigations"],
    });
  });

  afterAll(async () => {
    await mockAuth0.close();
  });

  beforeEach(async () => {
    memoryDb = new InMemoryMongoDb();
    await ensureIndexes(memoryDb.getDb());
  });

  const createTestApp = (options?: {
    dbPingOk?: boolean;
    useUnavailableRepo?: boolean;
    configOverrides?: Record<string, string>;
  }) => {
    const config = loadConfig({
      NODE_ENV: "test",
      AUTH0_DOMAIN: `127.0.0.1:${mockAuth0.port}`,
      AUTH0_AUDIENCE: mockAuth0.audience,
      MONGODB_URI: "mongodb://127.0.0.1:27017/keys_departed_test",
      ...options?.configOverrides,
    });

    const db = memoryDb.getDb();
    const accountsRepo = new MongoAccountsRepository(db);
    const casesRepo = new MongoCasesRepository(db);
    const investigationsRepo = options?.useUnavailableRepo
      ? new UnavailableInvestigationsRepository()
      : new MongoInvestigationsRepository(db);

    const checkDb = async () => {
      if (options?.dbPingOk === false) {
        return "unavailable" as const;
      }
      return "ok" as const;
    };

    return createApp(config, { checkDb }, accountsRepo, casesRepo, investigationsRepo, {
      issuerBaseURL: mockAuth0.issuer,
      jwksUri: mockAuth0.jwksUri,
      audience: mockAuth0.audience,
    });
  };

  describe("Lifecycle Persistence & Restart Recovery (10-Step Lifecycle)", () => {
    it("PERSIST-01: Full investigation lifecycle persists across simulated backend restart", async () => {
      const app = createTestApp();

      // Step 1: Create investigation
      const createRes = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({
          name: "Nightly Backup Deploy Key Incident",
          organization_id: "secops_eng",
          description: "Tracking deprecated SSH keys in CI runners",
        });

      expect(createRes.status).toBe(201);
      const invId = createRes.body.investigation_id;
      expect(invId).toMatch(/^inv_/);
      expect(createRes.body.status).toBe("created");
      expect(createRes.body.file_count).toBe(0);
      expect(createRes.body.record_count).toBe(0);

      // Step 2 & 3 & 4: Upload evidence files, validate, parse, store records
      const uploadRes = await request(app)
        .post(`/api/investigations/${invId}/upload`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({
          files: [
            {
              filename: "deploy_pipeline.log",
              content:
                "commit 8f92ab01\nAuthor: Sarah Chen <schen@internal.corp>\nDeploy key acc_deploy_key_881 added for night build.",
            },
            {
              filename: "service_audit.json",
              content: JSON.stringify([
                {
                  record_id: "rec_service_audit_01",
                  type: "ticket",
                  ts: "2026-10-25T12:00:00.000Z",
                  author_handle: "schen",
                  actor_account_id: "acc_service_runner_404",
                  content: "TICKET-1092: Service runner 404 provisioned without rotation policy",
                  structured: true,
                },
              ]),
            },
          ],
        });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.files).toHaveLength(2);
      expect(uploadRes.body.extracted_records_count).toBe(2);
      expect(uploadRes.body.investigation.status).toBe("files_uploaded");
      expect(uploadRes.body.investigation.file_count).toBe(2);
      expect(uploadRes.body.investigation.record_count).toBe(2);

      // Step 5 & 6 & 7: Process investigation, store discovered identities, claims, verification results
      const processRes = await request(app)
        .post(`/api/investigations/${invId}/process`)
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(processRes.status).toBe(200);
      const parsedFindings = InvestigationFindingsSchema.safeParse(processRes.body);
      expect(parsedFindings.success).toBe(true);

      expect(processRes.body.investigation.status).toBe("completed");
      expect(processRes.body.discovered_accounts.length).toBeGreaterThanOrEqual(2);
      expect(processRes.body.processing_summary.claims_verified_count).toBeGreaterThanOrEqual(1);

      // Step 8: Retrieve investigation and findings
      const getInvRes = await request(app)
        .get(`/api/investigations/${invId}`)
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(getInvRes.status).toBe(200);
      expect(getInvRes.body.status).toBe("completed");

      const getFindingsRes = await request(app)
        .get(`/api/investigations/${invId}/findings`)
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(getFindingsRes.status).toBe(200);
      expect(getFindingsRes.body.discovered_accounts.length).toBeGreaterThanOrEqual(2);

      // Step 9: Simulate backend restart with a completely fresh app and repository instances over the same DB
      const restartedApp = createTestApp();

      // Step 10: Retrieve the same investigation and results again from the restarted backend
      const reloadedInvRes = await request(restartedApp)
        .get(`/api/investigations/${invId}`)
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(reloadedInvRes.status).toBe(200);
      expect(reloadedInvRes.body.investigation_id).toBe(invId);
      expect(reloadedInvRes.body.name).toBe("Nightly Backup Deploy Key Incident");
      expect(reloadedInvRes.body.status).toBe("completed");
      expect(reloadedInvRes.body.file_count).toBe(2);
      expect(reloadedInvRes.body.record_count).toBe(2);

      const reloadedFindingsRes = await request(restartedApp)
        .get(`/api/investigations/${invId}/findings`)
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(reloadedFindingsRes.status).toBe(200);
      expect(reloadedFindingsRes.body.investigation.investigation_id).toBe(invId);
      expect(reloadedFindingsRes.body.files).toHaveLength(2);
      expect(reloadedFindingsRes.body.discovered_accounts.length).toBeGreaterThanOrEqual(2);
      expect(
        reloadedFindingsRes.body.processing_summary.claims_verified_count,
      ).toBeGreaterThanOrEqual(1);
    });

    it("PERSIST-02: Handles duplicate uploads idempotently without corrupting record counts", async () => {
      const app = createTestApp();

      const invRes = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Idempotency Test" });
      const invId = invRes.body.investigation_id;

      const filePayload = {
        files: [
          {
            filename: "audit.log",
            content: "commit abc\nAuthor: Carlos\nDeploy key acc_deploy_key_881.",
          },
        ],
      };

      // Upload once
      const upload1 = await request(app)
        .post(`/api/investigations/${invId}/upload`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send(filePayload);
      expect(upload1.status).toBe(200);
      expect(upload1.body.files).toHaveLength(1);
      expect(upload1.body.investigation.file_count).toBe(1);

      // Re-upload the exact same file sequentially
      const upload2 = await request(app)
        .post(`/api/investigations/${invId}/upload`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send(filePayload);
      expect(upload2.status).toBe(200);
      expect(upload2.body.files).toHaveLength(1);
      // File count must remain 1 (no duplicate files)
      expect(upload2.body.investigation.file_count).toBe(1);
    });

    it("PERSIST-03: Two simultaneous (concurrent) duplicate-upload requests against the same investigation do not create duplicate files or records", async () => {
      const app = createTestApp();
      const inv = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Concurrent Upload Test" });
      const invId = inv.body.investigation_id;

      const filePayload = {
        files: [
          {
            filename: "concurrent_audit.log",
            content:
              "commit concurrent_1\nAuthor: Alice Engineer\nacc_deploy_key_881 active in cluster.",
          },
        ],
      };

      // Launch two simultaneous upload requests concurrently
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/investigations/${invId}/upload`)
          .set("Authorization", `Bearer ${aliceToken}`)
          .send(filePayload),
        request(app)
          .post(`/api/investigations/${invId}/upload`)
          .set("Authorization", `Bearer ${aliceToken}`)
          .send(filePayload),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // Both requests return valid, non-error data
      expect(resA.body.errors).toHaveLength(0);
      expect(resB.body.errors).toHaveLength(0);

      // Verify database collections directly
      const filesCol = memoryDb.getCollection("investigation_files");
      const recordsCol = memoryDb.getCollection("records");

      const savedFiles = await filesCol.find({ investigation_id: invId }).toArray();
      const savedRecords = await recordsCol.find({ investigation_id: invId }).toArray();

      // Exactly 1 file document exists in the collection
      expect(savedFiles).toHaveLength(1);
      expect(savedFiles[0].filename).toBe("concurrent_audit.log");

      // Exactly 1 evidence record exists in the collection (no duplicates)
      expect(savedRecords).toHaveLength(1);
      expect(savedRecords[0].record_id).toContain(invId);

      // Fetch the updated investigation and verify file_count and record_count are exactly 1
      const invCheck = await request(app)
        .get(`/api/investigations/${invId}`)
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(invCheck.status).toBe(200);
      expect(invCheck.body.file_count).toBe(1);
      expect(invCheck.body.record_count).toBe(1);
    });
  });

  describe("Strict Ownership & Demo Isolation", () => {
    it("ISOLATE-01: Cross-user access returns 404 (preventing enumeration of other users' investigations)", async () => {
      const app = createTestApp();

      // Alice creates an investigation
      const aliceInv = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Alice Confidential Audit" });
      const aliceInvId = aliceInv.body.investigation_id;

      // Bob attempts to read Alice's investigation -> 404
      const bobGet = await request(app)
        .get(`/api/investigations/${aliceInvId}`)
        .set("Authorization", `Bearer ${bobToken}`);
      expect(bobGet.status).toBe(404);
      expect(bobGet.body.error).toBe("Investigation not found");

      // Bob attempts to upload to Alice's investigation -> 404
      const bobUpload = await request(app)
        .post(`/api/investigations/${aliceInvId}/upload`)
        .set("Authorization", `Bearer ${bobToken}`)
        .send({
          files: [{ filename: "injected.log", content: "malicious" }],
        });
      expect(bobUpload.status).toBe(404);

      // Bob attempts to process Alice's investigation -> 404
      const bobProcess = await request(app)
        .post(`/api/investigations/${aliceInvId}/process`)
        .set("Authorization", `Bearer ${bobToken}`);
      expect(bobProcess.status).toBe(404);

      // Bob attempts to view Alice's findings -> 404
      const bobFindings = await request(app)
        .get(`/api/investigations/${aliceInvId}/findings`)
        .set("Authorization", `Bearer ${bobToken}`);
      expect(bobFindings.status).toBe(404);
    });

    it("ISOLATE-02: User workspace list (demo=false) strictly excludes synthetic demo records and other users", async () => {
      const app = createTestApp();

      // Alice creates an investigation
      await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Alice Real Audit" });

      // Bob creates an investigation
      await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${bobToken}`)
        .send({ name: "Bob Real Audit" });

      // Alice lists workspace investigations (demo=false)
      const aliceList = await request(app)
        .get("/api/investigations?demo=false")
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(aliceList.status).toBe(200);
      expect(aliceList.body).toHaveLength(1);
      expect(aliceList.body[0].name).toBe("Alice Real Audit");
      expect(aliceList.body[0].is_demo).toBe(false);

      // Bob lists workspace investigations (demo=false)
      const bobList = await request(app)
        .get("/api/investigations?demo=false")
        .set("Authorization", `Bearer ${bobToken}`);
      expect(bobList.status).toBe(200);
      expect(bobList.body).toHaveLength(1);
      expect(bobList.body[0].name).toBe("Bob Real Audit");
      expect(bobList.body[0].is_demo).toBe(false);

      // Anonymous list returns only demo
      const anonList = await request(app).get("/api/investigations?demo=true");
      expect(anonList.status).toBe(200);
      expect(anonList.body.every((i: { is_demo: boolean }) => i.is_demo === true)).toBe(true);
    });

    it("ISOLATE-03: Authenticated dashboard stats (demo=false) derives strictly from owner data", async () => {
      const app = createTestApp();

      // Alice with no investigations created yet
      const emptyStats = await request(app)
        .get("/api/stats/dashboard?demo=false")
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(emptyStats.status).toBe(200);
      expect(emptyStats.body.total_identities).toBe(0);
      expect(emptyStats.body.meta.synthetic).toBe(false);

      // Alice creates and processes an investigation
      const inv = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Alice Investigation" });

      await request(app)
        .post(`/api/investigations/${inv.body.investigation_id}/upload`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({
          files: [
            {
              filename: "keys.log",
              content: "commit x\nDeploy key acc_deploy_key_881 added.",
            },
          ],
        });

      await request(app)
        .post(`/api/investigations/${inv.body.investigation_id}/process`)
        .set("Authorization", `Bearer ${aliceToken}`);

      // Alice's dashboard stats now reflect her discovered identities
      const aliceStats = await request(app)
        .get("/api/stats/dashboard?demo=false")
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(aliceStats.status).toBe(200);
      expect(aliceStats.body.total_identities).toBeGreaterThan(0);
      expect(aliceStats.body.meta.synthetic).toBe(false);

      // Bob's dashboard stats remain 0
      const bobStats = await request(app)
        .get("/api/stats/dashboard?demo=false")
        .set("Authorization", `Bearer ${bobToken}`);
      expect(bobStats.status).toBe(200);
      expect(bobStats.body.total_identities).toBe(0);
      expect(bobStats.body.meta.synthetic).toBe(false);
    });
  });

  describe("Database-Unavailable (HTTP 503) Behavior", () => {
    it("UNAVAIL-01: Mutation endpoints return HTTP 503 when database is unavailable", async () => {
      // Create app with failing database ping
      const unavailApp = createTestApp({ dbPingOk: false });

      // 1. Create investigation returns 503
      const createRes = await request(unavailApp)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Unreachable DB Investigation" });

      expect(createRes.status).toBe(503);
      expect(createRes.body.error).toBe("Database unavailable");

      // 2. Upload returns 503
      const uploadRes = await request(unavailApp)
        .post("/api/investigations/inv_test_123/upload")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ files: [{ filename: "a.log", content: "text" }] });

      expect(uploadRes.status).toBe(503);
      expect(uploadRes.body.error).toBe("Database unavailable");

      // 3. Process returns 503
      const processRes = await request(unavailApp)
        .post("/api/investigations/inv_test_123/process")
        .set("Authorization", `Bearer ${aliceToken}`);

      expect(processRes.status).toBe(503);
      expect(processRes.body.error).toBe("Database unavailable");

      // 4. Healthcheck accurately reports 503 and unavailable
      const healthRes = await request(unavailApp).get("/api/health");
      expect(healthRes.status).toBe(503);
      expect(healthRes.body.status).toBe("unavailable");
      expect(healthRes.body.checks.db).toBe("unavailable");
    });

    it("UNAVAIL-02: UnavailableInvestigationsRepository rejects persistence operations with 503 while preserving demo mode", async () => {
      const degradedApp = createTestApp({ useUnavailableRepo: true });

      // Attempting to create persistent investigation returns 503
      const createRes = await request(degradedApp)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Degraded Mode Create" });
      expect(createRes.status).toBe(503);
      expect(createRes.body.error).toBe("Database unavailable");

      // Attempting to list real workspace records returns 503
      const listReal = await request(degradedApp)
        .get("/api/investigations?demo=false")
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(listReal.status).toBe(503);

      // Demo requests continue to function and are clearly labelled
      const demoList = await request(degradedApp).get("/api/investigations?demo=true");
      expect(demoList.status).toBe(200);
      expect(demoList.body[0].is_demo).toBe(true);

      const demoStats = await request(degradedApp).get("/api/stats/dashboard?demo=true");
      expect(demoStats.status).toBe(200);
      expect(demoStats.body.meta.synthetic).toBe(true);
    });
  });

  describe("Validation & Edge Cases", () => {
    it("EDGE-01: Rejects empty files and unsupported extensions", async () => {
      const app = createTestApp();
      const inv = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Validation Edge Cases" });
      const id = inv.body.investigation_id;

      const res = await request(app)
        .post(`/api/investigations/${id}/upload`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({
          files: [
            { filename: "malware.exe", content: "MZ" },
            { filename: "empty.log", content: "" },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.files[0].status).toBe("invalid");
      expect(res.body.files[0].error_message).toContain("Unsupported extension");
      expect(res.body.files[1].status).toBe("invalid");
      expect(res.body.files[1].error_message).toBe("File is empty");
    });

    it("EDGE-02: Strips path traversal characters in filenames", async () => {
      const app = createTestApp();
      const inv = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Path Traversal Test" });
      const id = inv.body.investigation_id;

      const res = await request(app)
        .post(`/api/investigations/${id}/upload`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({
          files: [{ filename: "../../../var/log/system.log", content: "log text" }],
        });

      expect(res.status).toBe(200);
      expect(res.body.files[0].filename).toBe("system.log");
      expect(res.body.files[0].filename).not.toContain("../");
    });

    it("EDGE-03: Blocks unauthenticated and cross-user direct access to private evidence records", async () => {
      const app = createTestApp();
      const inv = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Private Record Test" });
      const id = inv.body.investigation_id;

      // Alice uploads a log file with an extracted evidence record
      const uploadRes = await request(app)
        .post(`/api/investigations/${id}/upload`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({
          files: [
            {
              filename: "audit.log",
              content:
                "Author: Alice Engineer\nacc_deploy_key_881 deployed service successfully.\n\nAuthor: Alice Engineer\nacc_deploy_key_881 second log.",
            },
          ],
        });
      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.extracted_records_count).toBeGreaterThan(0);

      // Extract the record ID generated
      const recordCol = memoryDb.getCollection("records");
      const savedDocs = await recordCol.find({ investigation_id: id }).toArray();
      expect(savedDocs.length).toBeGreaterThan(0);
      const privateRecordId = savedDocs[0].record_id;

      // 1. Unauthenticated request to private record -> 401
      const unauthRes = await request(app).get(`/api/records/${privateRecordId}`);
      expect(unauthRes.status).toBe(401);

      // 2. Bob (cross-user) request to Alice's private record -> 404
      const bobRes = await request(app)
        .get(`/api/records/${privateRecordId}`)
        .set("Authorization", `Bearer ${bobToken}`);
      expect(bobRes.status).toBe(404);
      expect(bobRes.body.error).toBe("Record not found");

      // 3. Alice (owner) request to Alice's private record -> 200
      const aliceRes = await request(app)
        .get(`/api/records/${privateRecordId}`)
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(aliceRes.status).toBe(200);
      expect(aliceRes.body.record_id).toBe(privateRecordId);
    });

    it("EDGE-04: Prevents cross-investigation record collision for identical CSV/Log file names", async () => {
      const app = createTestApp();
      // Alice creates investigation
      const invAlice = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ name: "Alice CSV Audit" });
      const idAlice = invAlice.body.investigation_id;

      // Bob creates investigation
      const invBob = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${bobToken}`)
        .send({ name: "Bob CSV Audit" });
      const idBob = invBob.body.investigation_id;

      const csvContent =
        "record_id,type,author,actor_account_id,content\nrow_1,commit,user1,acc_deploy_key_881,test content";

      // Alice uploads audit.csv
      await request(app)
        .post(`/api/investigations/${idAlice}/upload`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ files: [{ filename: "audit.csv", content: csvContent }] });

      // Bob uploads same-named audit.csv
      await request(app)
        .post(`/api/investigations/${idBob}/upload`)
        .set("Authorization", `Bearer ${bobToken}`)
        .send({ files: [{ filename: "audit.csv", content: csvContent }] });

      // Verify records are segregated with investigation-scoped record_ids
      const recordCol = memoryDb.getCollection("records");
      const aliceRecords = await recordCol.find({ investigation_id: idAlice }).toArray();
      const bobRecords = await recordCol.find({ investigation_id: idBob }).toArray();

      expect(aliceRecords).toHaveLength(1);
      expect(bobRecords).toHaveLength(1);
      expect(aliceRecords[0].record_id).toContain(idAlice);
      expect(bobRecords[0].record_id).toContain(idBob);
      expect(aliceRecords[0].record_id).not.toBe(bobRecords[0].record_id);
    });

    it("EDGE-05: Rejects upload and process on legacy unowned investigations", async () => {
      const app = createTestApp();
      // Insert legacy investigation without owner_id
      const invCol = memoryDb.getCollection("investigations");
      const legacyId = "inv_legacy_unowned_999";
      await invCol.insertOne({
        investigation_id: legacyId,
        name: "Legacy Unowned System Audit",
        status: "created",
        is_demo: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_count: 0,
        record_count: 0,
        accounts_discovered_count: 0,
      });

      // Authenticated user attempts to upload to legacy unowned investigation -> 404
      const uploadRes = await request(app)
        .post(`/api/investigations/${legacyId}/upload`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ files: [{ filename: "test.json", content: "[]" }] });
      expect(uploadRes.status).toBe(404);

      // Authenticated user attempts to process legacy unowned investigation -> 404
      const processRes = await request(app)
        .post(`/api/investigations/${legacyId}/process`)
        .set("Authorization", `Bearer ${aliceToken}`);
      expect(processRes.status).toBe(404);
    });
  });
});
