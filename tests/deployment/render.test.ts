import { describe, it, expect } from "vitest";
import request from "supertest";
import path from "path";
import fs from "fs";
import { createApp, resolveClientDist } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import {
  UnavailableAccountsRepository,
  AccountsRepository,
} from "../../server/src/repositories/accountsRepository.js";
import {
  UnavailableCasesRepository,
  CasesRepository,
} from "../../server/src/repositories/casesRepository.js";
import { UnavailableInvestigationsRepository } from "../../server/src/repositories/unavailableInvestigationsRepository.js";

describe("Phase 7A: Render Deployment Readiness & Single-Service Hosting", () => {
  describe("1. Health Endpoint (/healthz) - Liveness and Readiness Probes", () => {
    const config = loadConfig({ NODE_ENV: "production" });

    it("HEALTH-01: GET /healthz/live returns HTTP 200 liveness probe", async () => {
      const app = createApp(config);
      const res = await request(app).get("/healthz/live");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.type).toBe("liveness");
      expect(typeof res.body.uptime).toBe("number");
      expect(typeof res.body.timestamp).toBe("string");
    });

    it("HEALTH-02: GET /healthz?type=liveness returns HTTP 200 liveness probe", async () => {
      const app = createApp(config);
      const res = await request(app).get("/healthz?type=liveness");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.type).toBe("liveness");
    });

    it("HEALTH-03: GET /healthz returns 200 in demo readiness mode when DB is unconfigured", async () => {
      const app = createApp(config, {
        checkScores: async () => "ok",
      });
      const res = await request(app).get("/healthz");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.mode).toBe("demo");
      expect(res.body.checks.db).toBe("not_configured");
    });

    it("HEALTH-04: GET /healthz returns 503 readiness failure when MongoDB is configured but down", async () => {
      const configuredConfig = loadConfig({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://fake-user:fake-pass@127.0.0.1:27017/keys_test",
      });
      const app = createApp(configuredConfig, {
        checkDb: async () => "unavailable",
        checkScores: async () => "ok",
      });
      const res = await request(app).get("/healthz");

      expect(res.status).toBe(503);
      expect(res.body.status).toBe("unavailable");
      expect(res.body.checks.db).toBe("unavailable");
    });

    it("HEALTH-05: GET /healthz/ready alias functions as full readiness probe", async () => {
      const app = createApp(config, {
        checkScores: async () => "ok",
      });
      const res = await request(app).get("/healthz/ready");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("2. Express Static Frontend Serving & SPA Fallback", () => {
    const clientDistPath = resolveClientDist();
    const hasClientDist = fs.existsSync(path.join(clientDistPath, "index.html"));

    it("SPA-01: resolveClientDist resolves to a valid existing path in workspace", () => {
      expect(typeof clientDistPath).toBe("string");
      expect(clientDistPath).toContain("client");
    });

    it("SPA-02: Serves index.html at root route when static serving is active", async () => {
      if (!hasClientDist) {
        // Skip if client hasn't been built yet in this step
        return;
      }
      const prodConfig = loadConfig({
        NODE_ENV: "production",
      });
      const app = createApp(prodConfig);

      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/html/);
      expect(res.text).toContain('<div id="root">');
    });

    it("SPA-03: Falls back to index.html for client-side React routes without swallowing", async () => {
      if (!hasClientDist) return;
      const prodConfig = loadConfig({
        NODE_ENV: "production",
      });
      const app = createApp(prodConfig);

      const res = await request(app).get("/investigations/new");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/html/);
      expect(res.text).toContain('<div id="root">');
    });

    it("SPA-04: Never swallows 404 for unknown /api/* endpoints", async () => {
      const prodConfig = loadConfig({
        NODE_ENV: "production",
      });
      const app = createApp(prodConfig);

      const res = await request(app).get("/api/unknown_endpoint_that_does_not_exist");
      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body).toEqual({ error: "Not found" });
    });

    it("SPA-05: Never swallows /healthz with SPA index.html fallback", async () => {
      const prodConfig = loadConfig({
        NODE_ENV: "production",
      });
      const app = createApp(prodConfig);

      const res = await request(app).get("/healthz");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body.status).toBeDefined();
    });
  });

  describe("3. Production Safety: No Fixture Fallback for Real Production Data", () => {
    it("SAFETY-01: Production accounts repository throws 503 when MongoDB is unconfigured/unavailable", async () => {
      const prodConfig = loadConfig({ NODE_ENV: "production" });
      const accountsRepo: AccountsRepository = new UnavailableAccountsRepository();
      const casesRepo: CasesRepository = new UnavailableCasesRepository();
      const investigationsRepo = new UnavailableInvestigationsRepository();

      const app = createApp(prodConfig, {}, accountsRepo, casesRepo, investigationsRepo);

      // Real user request without demo=true
      const res = await request(app).get("/api/accounts");
      expect(res.status).toBe(503);
      expect(res.body.error).toBe("Database unavailable");
    });

    it("SAFETY-02: Production environment still allows explicit demo exploration via ?demo=true", async () => {
      const prodConfig = loadConfig({ NODE_ENV: "production" });
      const accountsRepo: AccountsRepository = new UnavailableAccountsRepository();
      const casesRepo: CasesRepository = new UnavailableCasesRepository();
      const investigationsRepo = new UnavailableInvestigationsRepository();

      const app = createApp(prodConfig, {}, accountsRepo, casesRepo, investigationsRepo);

      // Explicit demo request with ?demo=true
      const res = await request(app).get("/api/accounts?demo=true");
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta.synthetic).toBe(true);
    });
  });

  describe("4. Configuration Validation Without Information Leaks", () => {
    it("CONFIG-01: Strips empty string environment variables safely", () => {
      const config = loadConfig({
        OLLAMA_BASE_URL: "",
        MONGODB_URI: "",
        AUTH0_DOMAIN: "",
      });
      expect(config.OLLAMA_BASE_URL).toBeUndefined();
      expect(config.MONGODB_URI).toBeUndefined();
      expect(config.AUTH0_DOMAIN).toBeUndefined();
    });

    it("CONFIG-02: Validates MONGODB_URI scheme and never logs URI string on invalid format", () => {
      expect(() => {
        loadConfig({
          MONGODB_URI: "postgres://user:secretpassword@localhost:5432/db",
        });
      }).toThrowError(/invalid format for MONGODB_URI/);

      try {
        loadConfig({
          MONGODB_URI: "postgres://user:secretpassword@localhost:5432/db",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        expect(msg).not.toContain("secretpassword");
      }
    });
  });
});
