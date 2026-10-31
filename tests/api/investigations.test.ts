import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import {
  DashboardStatsSchema,
  InvestigationFindingsSchema,
  InvestigationSchema,
} from "@keys/contracts";
import { setupMockAuth0Server, MockAuth0Server } from "../helpers/authHelper.js";

describe("Phase 3: Investigations, Uploads & Dashboard API", () => {
  let mockAuth0: MockAuth0Server;
  let app: ReturnType<typeof createApp>;
  let authToken = "";

  beforeAll(async () => {
    mockAuth0 = await setupMockAuth0Server();
    authToken = await mockAuth0.generateToken({
      permissions: ["create:investigations", "read:investigations"],
    });

    const config = loadConfig({
      NODE_ENV: "test",
      AUTH0_DOMAIN: `127.0.0.1:${mockAuth0.port}`,
      AUTH0_AUDIENCE: mockAuth0.audience,
    });

    app = createApp(config, {}, undefined, undefined, undefined, {
      issuerBaseURL: mockAuth0.issuer,
      jwksUri: mockAuth0.jwksUri,
      audience: mockAuth0.audience,
    });
  });

  afterAll(async () => {
    await mockAuth0.close();
  });

  describe("GET /api/stats/dashboard", () => {
    it("INV-01: Returns valid dashboard statistics matching DashboardStatsSchema", async () => {
      const res = await request(app).get("/api/stats/dashboard");

      expect(res.status).toBe(200);
      const parsed = DashboardStatsSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      expect(res.body.total_identities).toBe(40);
      expect(res.body.ghost_distribution.LOST).toBeGreaterThan(0);
      expect(res.body.ghost_distribution.FORGOTTEN).toBeGreaterThan(0);
      expect(res.body.ghost_distribution.LONELY).toBeGreaterThan(0);
      expect(res.body.ghost_distribution.INNOCENT).toBeGreaterThan(0);
      expect(res.body.evidence_status_distribution.verified).toBeGreaterThan(0);
      expect(res.body.evidence_status_distribution.no_evidence).toBeGreaterThan(0);
      expect(res.body.meta.synthetic).toBe(true);
    });
  });

  describe("POST /api/investigations (Creation)", () => {
    it("INV-02: Successfully creates a new investigation with valid input", async () => {
      const payload = {
        name: "Security Sprint 43 Deploy Key Audit",
        description: "Checking departed engineers against GitHub deploy keys.",
      };

      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${authToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      const parsed = InvestigationSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      expect(res.body.investigation_id).toMatch(/^inv_/);
      expect(res.body.name).toBe("Security Sprint 43 Deploy Key Audit");
      expect(res.body.status).toBe("created");
      expect(res.body.file_count).toBe(0);
      expect(res.body.record_count).toBe(0);
    });

    it("INV-03: Rejects investigation creation with missing name (400)", async () => {
      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "   " });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid investigation parameters");
    });

    it("INV-04: Rejects investigation creation with name exceeding 120 characters", async () => {
      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "A".repeat(125) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid investigation parameters");
    });
  });

  describe("GET /api/investigations & GET /api/investigations/:id", () => {
    it("INV-05: Lists all investigations including seed and created ones", async () => {
      const res = await request(app).get("/api/investigations");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].investigation_id).toBeDefined();
    });

    it("INV-06: Retrieves a single investigation by valid ID", async () => {
      const res = await request(app).get("/api/investigations/inv_staging_2026_q1");

      expect(res.status).toBe(200);
      const parsed = InvestigationSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);
      expect(res.body.investigation_id).toBe("inv_staging_2026_q1");
    });

    it("INV-07: Returns 404 for non-existent investigation ID", async () => {
      const res = await request(app).get("/api/investigations/inv_ghost_missing");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Investigation not found" });
    });

    it("INV-08: Returns 400 for malformed investigation ID format", async () => {
      const res = await request(app).get("/api/investigations/inv%20invalid%20id");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid investigation ID format" });
    });
  });

  describe("POST /api/investigations/:id/upload & Safe File Handling", () => {
    let testInvId = "";

    it("Setup: Creates an investigation for upload testing", async () => {
      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Upload Test Investigation" });
      testInvId = res.body.investigation_id;
      expect(testInvId).toBeDefined();
    });

    it("INV-09: Successfully ingests valid JSON and LOG engineering evidence files", async () => {
      const payload = {
        files: [
          {
            filename: "audit_commits.log",
            content:
              "commit 8f92ab018442bc014aef72948c21a4f00123\nAuthor: Carlos Mendez <cmendez@internal.corp>\nDate: Sat Apr 12 10:15:30 2025\n\n    Add staging deploy key acc_deploy_key_881 for night build.\n    Signed-off-by: Carlos Mendez\n",
          },
          {
            filename: "tickets.json",
            content: JSON.stringify([
              {
                record_id: "rec_ticket_test_01",
                type: "ticket",
                ts: "2025-04-10T14:22:00.000Z",
                author_handle: "cmendez",
                actor_account_id: "acc_deploy_key_881",
                content:
                  "TICKET-1092: Automated night-build deployment pipeline key for staging cluster.",
                structured: true,
              },
            ]),
          },
        ],
      };

      const res = await request(app)
        .post(`/api/investigations/${testInvId}/upload`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.files).toHaveLength(2);
      expect(res.body.extracted_records_count).toBeGreaterThanOrEqual(2);
      expect(res.body.investigation.file_count).toBe(2);
      expect(res.body.investigation.status).toBe("files_uploaded");
    });

    it("INV-10: Flags unsupported file extension (e.g. .pdf or .exe) as invalid", async () => {
      const payload = {
        files: [
          {
            filename: "exploit.exe",
            content: "MZbinarydata",
          },
        ],
      };

      const res = await request(app)
        .post(`/api/investigations/${testInvId}/upload`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.files[0].status).toBe("invalid");
      expect(res.body.files[0].error_message).toContain("Unsupported extension");
      expect(res.body.errors.some((e: string) => e.includes("Unsupported extension"))).toBe(true);
    });

    it("INV-11: Flags empty file (0 bytes) as invalid", async () => {
      const payload = {
        files: [
          {
            filename: "empty.log",
            content: "",
          },
        ],
      };

      const res = await request(app)
        .post(`/api/investigations/${testInvId}/upload`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.files[0].status).toBe("invalid");
      expect(res.body.files[0].error_message).toBe("File is empty");
    });

    it("INV-12: Sanitizes dangerous path traversal filenames safely", async () => {
      const payload = {
        files: [
          {
            filename: "../../../etc/passwd.log",
            content: "SYSTEM LOG: safe content",
          },
        ],
      };

      const res = await request(app)
        .post(`/api/investigations/${testInvId}/upload`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      // Path traversal characters stripped; file stored safely under base filename
      expect(res.body.files[0].filename).not.toContain("../");
      expect(res.body.files[0].filename).toBe("passwd.log");
    });
  });

  describe("POST /api/investigations/:id/process & Findings Review", () => {
    let processInvId = "";

    it("Setup: Creates an investigation and uploads records for processing", async () => {
      const invRes = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ name: "Processing Pipeline Test" });
      processInvId = invRes.body.investigation_id;

      await request(app)
        .post(`/api/investigations/${processInvId}/upload`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          files: [
            {
              filename: "deploy_key_evidence.log",
              content:
                "commit 8f92ab018442bc014aef72948c21a4f00123\nAuthor: Carlos Mendez <cmendez@internal.corp>\nSigned-off-by: Carlos Mendez\nDeploy key acc_deploy_key_881 added for night build staging pipeline.\n",
            },
          ],
        });
    });

    it("INV-13: Processes uploaded evidence and generates deterministic findings", async () => {
      const res = await request(app)
        .post(`/api/investigations/${processInvId}/process`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const parsed = InvestigationFindingsSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      expect(res.body.investigation.status).toBe("completed");
      expect(res.body.discovered_accounts.length).toBeGreaterThan(0);
      expect(
        res.body.discovered_accounts.some(
          (a: { account_id: string }) => a.account_id === "acc_deploy_key_881",
        ),
      ).toBe(true);
      expect(res.body.processing_summary.claims_verified_count).toBeGreaterThanOrEqual(1);
      expect(res.body.processing_summary.model_extraction_status).toBe("simulated");
    });

    it("INV-14: Retrieves completed investigation findings via GET /api/investigations/:id/findings", async () => {
      const res = await request(app)
        .get(`/api/investigations/${processInvId}/findings`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const parsed = InvestigationFindingsSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);
      expect(res.body.investigation.investigation_id).toBe(processInvId);
    });

    it("INV-15: Returns 404 for findings of un-processed or non-existent investigation", async () => {
      const res = await request(app).get("/api/investigations/inv_unprocessed_99/findings");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Investigation findings not found" });
    });
  });
});
