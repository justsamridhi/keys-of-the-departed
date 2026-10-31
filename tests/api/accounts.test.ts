import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import { AccountsResponseSchema, ArchiveAccount } from "@keys/contracts";

describe("Phase 1: GET /api/accounts - Four-Chamber Archive & Search API", () => {
  const baseConfig = loadConfig({ NODE_ENV: "test" });
  const app = createApp(baseConfig);

  it("ACC-01: Default GET /api/accounts returns all 40 accounts paginated (page=1, limit=12)", async () => {
    const res = await request(app).get("/api/accounts");

    expect(res.status).toBe(200);
    const parsed = AccountsResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);

    expect(res.body.pagination.total).toBe(40);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(12);
    expect(res.body.pagination.totalPages).toBe(4);
    expect(res.body.data.length).toBe(12);
    expect(res.body.meta.synthetic).toBe(true);
  });

  describe("Chamber Filtering", () => {
    it("ACC-02: Filters exclusively for LOST chamber (10 accounts)", async () => {
      const res = await request(app).get("/api/accounts?chapter=LOST&limit=50");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(10);
      expect(res.body.data.every((a: ArchiveAccount) => a.ghost_type === "LOST")).toBe(true);
    });

    it("ACC-03: Filters exclusively for FORGOTTEN chamber (10 accounts)", async () => {
      const res = await request(app).get("/api/accounts?chapter=FORGOTTEN&limit=50");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(10);
      expect(res.body.data.every((a: ArchiveAccount) => a.ghost_type === "FORGOTTEN")).toBe(true);
    });

    it("ACC-04: Filters exclusively for LONELY chamber (10 accounts)", async () => {
      const res = await request(app).get("/api/accounts?chapter=LONELY&limit=50");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(10);
      expect(res.body.data.every((a: ArchiveAccount) => a.ghost_type === "LONELY")).toBe(true);
    });

    it("ACC-05: Filters exclusively for INNOCENT chamber (10 accounts)", async () => {
      const res = await request(app).get("/api/accounts?chapter=INNOCENT&limit=50");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(10);
      expect(res.body.data.every((a: ArchiveAccount) => a.ghost_type === "INNOCENT")).toBe(true);
    });
  });

  describe("Evidence Status Filtering", () => {
    it("ACC-06: Filters by verified owner status", async () => {
      const res = await request(app).get("/api/accounts?status=verified&limit=50");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThan(0);
      expect(res.body.data.every((a: ArchiveAccount) => a.owner_status === "verified")).toBe(true);
    });

    it("ACC-07: Filters by supported owner status", async () => {
      const res = await request(app).get("/api/accounts?status=supported&limit=50");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThan(0);
      expect(res.body.data.every((a: ArchiveAccount) => a.owner_status === "supported")).toBe(true);
    });

    it("ACC-08: Filters by no_evidence owner status", async () => {
      const res = await request(app).get("/api/accounts?status=no_evidence&limit=50");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(10); // All 10 FORGOTTEN keys have no_evidence
      expect(res.body.data.every((a: ArchiveAccount) => a.owner_status === "no_evidence")).toBe(
        true,
      );
    });
  });

  describe("Combined Filtering & Search", () => {
    it("ACC-09: Combines chapter and status filters (LOST + verified)", async () => {
      const res = await request(app).get("/api/accounts?chapter=LOST&status=verified&limit=50");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(10);
      expect(
        res.body.data.every(
          (a: ArchiveAccount) => a.ghost_type === "LOST" && a.owner_status === "verified",
        ),
      ).toBe(true);
    });

    it("ACC-10: Searches by account ID with case insensitivity and whitespace tolerance", async () => {
      const res = await request(app).get("/api/accounts?search=%20ACC_DEPLOY_KEY_881%20");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(1);
      expect(res.body.data[0].account_id).toBe("acc_deploy_key_881");
    });

    it("ACC-11: Searches by engineer owner name", async () => {
      const res = await request(app).get("/api/accounts?search=Carlos%20Mendez");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
      expect(res.body.data.some((a: ArchiveAccount) => a.owner_name === "Carlos Mendez")).toBe(
        true,
      );
    });

    it("ACC-12: Searches by tag keyword (e.g. #nightly)", async () => {
      const res = await request(app).get("/api/accounts?search=nightly");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every(
          (a: ArchiveAccount) =>
            a.tags.includes("nightly") ||
            a.account_id.includes("nightly") ||
            a.primary_quote.toLowerCase().includes("nightly"),
        ),
      ).toBe(true);
    });

    it("ACC-13: Returns empty results when search query matches nothing", async () => {
      const res = await request(app).get("/api/accounts?search=nonexistent_quantum_token_xyz");
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBe(0);
      expect(res.body.pagination.totalPages).toBe(0);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("Pagination & Validation Boundaries", () => {
    it("ACC-14: Paginates correctly across multiple pages", async () => {
      const page1 = await request(app).get("/api/accounts?page=1&limit=5");
      const page2 = await request(app).get("/api/accounts?page=2&limit=5");

      expect(page1.status).toBe(200);
      expect(page2.status).toBe(200);
      expect(page1.body.data.length).toBe(5);
      expect(page2.body.data.length).toBe(5);

      // Verify no overlap between page 1 and page 2
      const page1Ids = page1.body.data.map((a: ArchiveAccount) => a.account_id);
      const page2Ids = page2.body.data.map((a: ArchiveAccount) => a.account_id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it("ACC-15: Safely handles out-of-range page index", async () => {
      const res = await request(app).get("/api/accounts?page=999&limit=10");
      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(999);
      expect(res.body.data).toEqual([]);
    });

    it("ACC-16: Rejects invalid chapter with 400 Bad Request", async () => {
      const res = await request(app).get("/api/accounts?chapter=INVALID_CHAMBER");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid query parameters");
      expect(res.body.details).toBeDefined();
    });

    it("ACC-17: Rejects invalid status with 400 Bad Request", async () => {
      const res = await request(app).get("/api/accounts?status=super_safe");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid query parameters");
    });

    it("ACC-18: Rejects negative or zero page number with 400 Bad Request", async () => {
      const res = await request(app).get("/api/accounts?page=0");
      expect(res.status).toBe(400);
    });
  });
});
