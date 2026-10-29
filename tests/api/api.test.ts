import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";

describe("Area 3: Health and API Walking Skeleton", () => {
  const baseConfig = loadConfig({ NODE_ENV: "test" });

  it("API-01: GET /healthz returns 200 in core demo mode with not_configured dependencies", async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      mode: "demo",
      checks: {
        db: "not_configured",
        model: "not_configured",
        scores: "not_configured",
      },
    });
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("API-01 (cont): GET /healthz returns 200 when all configured dependencies are ok", async () => {
    const configuredConfig = loadConfig({
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://dummy:27017/test",
    });

    const app = createApp(configuredConfig, {
      checkDb: async () => "ok",
      checkModel: async () => "ok",
      checkScores: async () => "ok",
    });

    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.checks.db).toBe("ok");
  });

  it("API-02: GET /healthz returns 503 when an enabled dependency is unavailable", async () => {
    const configuredConfig = loadConfig({
      NODE_ENV: "test",
      MONGODB_URI: "mongodb://dummy:27017/test",
    });

    const app = createApp(configuredConfig, {
      checkDb: async () => "unavailable",
    });

    const res = await request(app).get("/healthz");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("unavailable");
    expect(res.body.checks.db).toBe("unavailable");
  });

  it("GET /api/health alias functions identically to /healthz", async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("API-03: GET /api/cases/:id returns known fixture case", async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get("/api/cases/case_demo_01");

    expect(res.status).toBe(200);
    expect(res.body.case_id).toBe("case_demo_01");
    expect(res.body.owner_status).toBe("verified");
    expect(res.body.ghost_type).toBe("LOST");
    expect(res.body.claims_accepted.length).toBeGreaterThan(0);
  });

  it("API-04: GET /api/cases/:id returns 404 for unknown case ID", async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get("/api/cases/case_unknown_999");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Case not found" });
  });

  it("API-05: Returns safe sanitized 404 for unmatched routes without leaking internals", async () => {
    const app = createApp(baseConfig);
    const res = await request(app).get("/random-route");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
    expect(JSON.stringify(res.body)).not.toContain("C:\\");
    expect(JSON.stringify(res.body)).not.toContain("/home/");
  });
});
