import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import { EntireService } from "../../server/src/services/entireService.js";
import {
  EntireProvenanceStatusSchema,
  EntireCheckpointSchema,
  EntireSessionSchema,
  EntireProvenanceReportSchema,
} from "@keys/contracts";

describe("Phase 5: Entire Provenance Integration & Verification", () => {
  const baseConfig = loadConfig({ NODE_ENV: "test" });
  const liveEntireService = new EntireService();
  const app = createApp(
    baseConfig,
    {},
    undefined,
    undefined,
    undefined,
    undefined,
    liveEntireService,
  );

  describe("GET /api/provenance/status", () => {
    it("PROV-01: Returns valid Entire status conforming to schema", async () => {
      const res = await request(app).get("/api/provenance/status");
      expect(res.status).toBe(200);

      const parsed = EntireProvenanceStatusSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      expect(typeof res.body.available).toBe("boolean");
      if (res.body.available) {
        expect(res.body.enabled).toBe(true);
        expect(res.body.cli_version).toMatch(/0\.[0-9]+\.[0-9]+/);
        expect(res.body.branch).toBe("main");
      }
    });

    it("PROV-02: Gracefully handles missing/failing CLI without crashing or inventing data", async () => {
      const failingRunner = () => {
        throw new Error("Command failed: entire not found");
      };
      const mockedService = new EntireService(process.cwd(), failingRunner);
      const testApp = createApp(
        baseConfig,
        {},
        undefined,
        undefined,
        undefined,
        undefined,
        mockedService,
      );

      const res = await request(testApp).get("/api/provenance/status");
      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
      expect(res.body.enabled).toBe(false);
      expect(res.body.error).toContain("Entire CLI is not installed or not available on PATH");
    });
  });

  describe("GET /api/provenance/checkpoints", () => {
    it("PROV-03: Returns genuine repository checkpoints from Entire git-ref tracking", async () => {
      const res = await request(app).get("/api/provenance/checkpoints");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      for (const cp of res.body) {
        const parsed = EntireCheckpointSchema.safeParse(cp);
        expect(parsed.success).toBe(true);
        expect(cp.checkpoint_id).toBeDefined();
      }

      // If Entire is active, checkpoint 01M63XF6H0XBRPXSDEPW3QMRX5 should be present
      if (res.body.length > 0) {
        const initialCp = res.body.find(
          (c: { checkpoint_id: string }) => c.checkpoint_id === "01M63XF6H0XBRPXSDEPW3QMRX5",
        );
        expect(initialCp).toBeDefined();
        expect(initialCp.agent).toBe("Antigravity");
        expect(initialCp.message).toContain("scaffolding, contracts, CI, fixture API");
      }
    });
  });

  describe("GET /api/provenance/sessions", () => {
    it("PROV-04: Returns tracked agent sessions conforming to schema", async () => {
      const res = await request(app).get("/api/provenance/sessions");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      for (const s of res.body) {
        const parsed = EntireSessionSchema.safeParse(s);
        expect(parsed.success).toBe(true);
        expect(s.session_id).toBeDefined();
      }
    });
  });

  describe("GET /api/provenance/report", () => {
    it("PROV-05: Returns combined report satisfying EntireProvenanceReportSchema", async () => {
      const res = await request(app).get("/api/provenance/report");
      expect(res.status).toBe(200);

      const parsed = EntireProvenanceReportSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);
      expect(res.body.status).toBeDefined();
      expect(Array.isArray(res.body.checkpoints)).toBe(true);
      expect(Array.isArray(res.body.sessions)).toBe(true);
    });
  });

  describe("GET /api/provenance/checkpoints/:id", () => {
    it("PROV-06: Returns checkpoint explanation for known checkpoint ID", async () => {
      const res = await request(app).get("/api/provenance/checkpoints/01M63XF6H0XBRPXSDEPW3QMRX5");
      if (res.status === 200) {
        expect(res.body.checkpoint_id).toBe("01M63XF6H0XBRPXSDEPW3QMRX5");
        expect(res.body.branch).toBe("main");
        expect(Array.isArray(res.body.files_touched)).toBe(true);
      } else {
        expect(res.status).toBe(404);
      }
    });

    it("PROV-07: Rejects invalid checkpoint ID format with 400 Bad Request", async () => {
      const res = await request(app).get("/api/provenance/checkpoints/invalid;drop-tables");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid checkpoint ID format");
    });
  });

  describe("GET /api/provenance/why", () => {
    it("PROV-08: Queries genuine Entire code attribution for package.json", async () => {
      const res = await request(app).get("/api/provenance/why?file=package.json&line=2");
      if (res.status === 200) {
        expect(res.body.file || res.body.line).toBeDefined();
      } else {
        // Line-level attribution might not be indexed for all lines in git
        expect([200, 404]).toContain(res.status);
      }
    });

    it("PROV-09: Rejects missing file parameter with 400 Bad Request", async () => {
      const res = await request(app).get("/api/provenance/why");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid or missing file parameter");
    });

    it("PROV-10: Rejects invalid/malicious file path with 400 Bad Request", async () => {
      const res = await request(app).get("/api/provenance/why?file=foo;rm%20-rf");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid or missing file parameter");
    });

    it("PROV-11: Rejects invalid line number with 400 Bad Request", async () => {
      const res = await request(app).get("/api/provenance/why?file=package.json&line=-5");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid line parameter");
    });
  });
});
