import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import { CaseSchema, EvidenceRecordSchema, EvidenceRecord, RemovedClaim } from "@keys/contracts";

describe("Phase 2: Case Investigation & Evidence Records API", () => {
  const baseConfig = loadConfig({ NODE_ENV: "test" });
  const app = createApp(baseConfig);

  describe("GET /api/cases/:id", () => {
    it("CASE-01: Returns valid case dossier for known case ID (case_demo_01)", async () => {
      const res = await request(app).get("/api/cases/case_demo_01");

      expect(res.status).toBe(200);
      const parsed = CaseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      expect(res.body.case_id).toBe("case_demo_01");
      expect(res.body.account_id).toBe("acc_deploy_key_881");
      expect(res.body.owner_status).toBe("verified");
      expect(res.body.ghost_type).toBe("LOST");
      expect(res.body.claims_accepted).toHaveLength(2);
      expect(res.body.claims_removed).toHaveLength(2);
    });

    it("CASE-02: Returns 404 for non-existent case ID", async () => {
      const res = await request(app).get("/api/cases/case_nonexistent_999");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Case not found" });
    });

    it("CASE-03: Rejects invalid case ID format with 400 Bad Request", async () => {
      const res = await request(app).get("/api/cases/case!invalid@format#");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid case ID format" });
    });
  });

  describe("GET /api/cases/:id/records", () => {
    it("CASE-04: Returns all associated evidence records for case_demo_01", async () => {
      const res = await request(app).get("/api/cases/case_demo_01/records");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      for (const record of res.body) {
        const parsed = EvidenceRecordSchema.safeParse(record);
        expect(parsed.success).toBe(true);
      }

      const recordIds = res.body.map((r: EvidenceRecord) => r.record_id);
      expect(recordIds).toContain("rec_commit_4021");
      expect(recordIds).toContain("rec_ticket_1092");
    });

    it("CASE-05: Returns 404 for records of non-existent case", async () => {
      const res = await request(app).get("/api/cases/case_ghost_missing/records");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Case not found" });
    });
  });

  describe("GET /api/records/:id", () => {
    it("CASE-06: Returns single evidence record with raw log content", async () => {
      const res = await request(app).get("/api/records/rec_commit_4021");

      expect(res.status).toBe(200);
      const parsed = EvidenceRecordSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      expect(res.body.record_id).toBe("rec_commit_4021");
      expect(res.body.type).toBe("commit");
      expect(res.body.content).toContain("Signed-off-by: Carlos Mendez");
      expect(res.body.author_handle).toBe("cmendez");
    });

    it("CASE-07: Returns 404 for unknown record ID", async () => {
      const res = await request(app).get("/api/records/rec_phantom_9999");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Record not found" });
    });

    it("CASE-08: Rejects invalid record ID format with 400", async () => {
      const res = await request(app).get("/api/records/rec%20invalid%20id");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Invalid record ID format" });
    });
  });

  describe("Evidence Integrity & Reason Codes Verification", () => {
    it("CASE-09: Preserves R1-R5 reason codes on removed claims", async () => {
      const res = await request(app).get("/api/cases/case_demo_01");
      expect(res.status).toBe(200);

      const removed = res.body.claims_removed;
      const reasonCodes = removed.map((c: RemovedClaim) => c.reason_code);
      expect(reasonCodes).toContain("R3");
      expect(reasonCodes).toContain("R2");
    });

    it("CASE-10: Verifies exact quotation exists verbatim in associated source record", async () => {
      const caseRes = await request(app).get("/api/cases/case_demo_01");
      const recordRes = await request(app).get("/api/records/rec_commit_4021");

      const acceptedQuote = caseRes.body.claims_accepted[0].quote;
      expect(recordRes.body.content).toContain(acceptedQuote);
    });
  });
});
