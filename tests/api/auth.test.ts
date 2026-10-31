import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import { setupMockAuth0Server, MockAuth0Server } from "../helpers/authHelper.js";

describe("Stage 1: Real Auth0 JWT Verification & Route Protection", () => {
  let mockAuth0: MockAuth0Server;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    mockAuth0 = await setupMockAuth0Server();
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

  describe("Protected Mutation Route: POST /api/investigations", () => {
    it("SEC-01: Missing bearer token returns 401 Unauthorized", async () => {
      const res = await request(app)
        .post("/api/investigations")
        .send({ name: "Unauthenticated Investigation" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("SEC-02: Malformed bearer token returns 401 Unauthorized", async () => {
      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", "Bearer invalid-junk-not-a-token")
        .send({ name: "Malformed Token Investigation" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("SEC-03: Invalid signature (untrusted key) returns 401 Unauthorized", async () => {
      const untrustedToken = await mockAuth0.generateUntrustedToken({
        permissions: ["create:investigations"],
      });

      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${untrustedToken}`)
        .send({ name: "Untrusted Key Investigation" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("SEC-04: Wrong issuer returns 401 Unauthorized", async () => {
      const wrongIssuerToken = await mockAuth0.generateToken({
        issuer: "https://imposter.auth0.com/",
        permissions: ["create:investigations"],
      });

      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${wrongIssuerToken}`)
        .send({ name: "Wrong Issuer Investigation" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("SEC-05: Wrong audience returns 401 Unauthorized", async () => {
      const wrongAudienceToken = await mockAuth0.generateToken({
        audience: "https://other-unrelated-api.internal",
        permissions: ["create:investigations"],
      });

      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${wrongAudienceToken}`)
        .send({ name: "Wrong Audience Investigation" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("SEC-06: Expired token returns 401 Unauthorized", async () => {
      const past = Math.floor(Date.now() / 1000) - 600;
      const expiredToken = await mockAuth0.generateToken({
        iat: past - 60,
        expiresIn: past,
        permissions: ["create:investigations"],
      });

      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${expiredToken}`)
        .send({ name: "Expired Token Investigation" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("SEC-07: Valid token with insufficient scope/permission returns 403 Forbidden", async () => {
      // Token has read:cases but lacks create:investigations
      const insufficientToken = await mockAuth0.generateToken({
        permissions: ["read:cases"],
      });

      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${insufficientToken}`)
        .send({ name: "Forbidden Investigation" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
      expect(res.body.message).toContain("create:investigations");
    });

    it("SEC-08: Valid token with Auth0 RBAC permission 'create:investigations' succeeds (201)", async () => {
      const validToken = await mockAuth0.generateToken({
        permissions: ["create:investigations"],
      });

      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          name: "Sprint 43 Credential Review",
          description: "Authenticated investigation creation",
        });

      expect(res.status).toBe(201);
      expect(res.body.investigation_id).toMatch(/^inv_/);
      expect(res.body.name).toBe("Sprint 43 Credential Review");
    });

    it("SEC-09: Valid token with OAuth2 scope 'create:investigations' succeeds (201)", async () => {
      const validScopeToken = await mockAuth0.generateToken({
        scope: "read:cases create:investigations",
      });

      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${validScopeToken}`)
        .send({
          name: "Scope Authenticated Investigation",
        });

      expect(res.status).toBe(201);
      expect(res.body.investigation_id).toMatch(/^inv_/);
    });
  });

  describe("Protected Mutation Routes: Upload and Process", () => {
    let createdInvId = "";

    beforeAll(async () => {
      const validToken = await mockAuth0.generateToken({
        permissions: ["create:investigations"],
      });
      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ name: "Investigation for Upload Testing" });
      createdInvId = res.body.investigation_id;
    });

    it("SEC-10: POST /api/investigations/:id/upload without token returns 401", async () => {
      const res = await request(app)
        .post(`/api/investigations/${createdInvId}/upload`)
        .send({ files: [] });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("SEC-11: POST /api/investigations/:id/upload with valid token succeeds", async () => {
      const validToken = await mockAuth0.generateToken({
        permissions: ["create:investigations"],
      });

      const res = await request(app)
        .post(`/api/investigations/${createdInvId}/upload`)
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          files: [
            {
              filename: "auth_audit.log",
              content: "commit 123456\nAuthor: Carlos Mendez <cmendez@internal.corp>\n",
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.files).toHaveLength(1);
    });

    it("SEC-12: POST /api/investigations/:id/process without token returns 401", async () => {
      const res = await request(app).post(`/api/investigations/${createdInvId}/process`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("SEC-13: POST /api/investigations/:id/process with valid token succeeds", async () => {
      const validToken = await mockAuth0.generateToken({
        permissions: ["create:investigations"],
      });

      const res = await request(app)
        .post(`/api/investigations/${createdInvId}/process`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.processing_summary).toBeDefined();
    });
  });

  describe("Fail-Closed Behavior When Auth0 Is Not Configured", () => {
    it("SEC-14: Protected mutations fail closed with HTTP 500 when Auth0 is unconfigured", async () => {
      // Initialize app with zero Auth0 credentials
      const unconfiguredApp = createApp(loadConfig({ NODE_ENV: "test" }));

      const res = await request(unconfiguredApp)
        .post("/api/investigations")
        .send({ name: "Fail Closed Investigation" });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain("Authentication configuration error");
      expect(res.body.message).toContain("AUTH0_DOMAIN and AUTH0_AUDIENCE");
    });
  });

  describe("Public Read-Only Endpoints Remain Accessible Without Token", () => {
    it("SEC-15: Public endpoints (health, accounts, cases) accept anonymous requests", async () => {
      const healthRes = await request(app).get("/healthz");
      expect(healthRes.status).toBe(200);

      const accountsRes = await request(app).get("/api/accounts");
      expect(accountsRes.status).toBe(200);

      const casesRes = await request(app).get("/api/cases/case_demo_01");
      expect(casesRes.status).toBe(200);

      const dashboardRes = await request(app).get("/api/stats/dashboard");
      expect(dashboardRes.status).toBe(200);

      const investigationsListRes = await request(app).get("/api/investigations");
      expect(investigationsListRes.status).toBe(200);
    });
  });

  describe("Investigation Ownership & Read Authorization (BOLA / IDOR Defense)", () => {
    let userAToken: string;
    let userBToken: string;
    let userANoReadToken: string;
    let userAInvId: string;
    let userBInvId: string;

    beforeAll(async () => {
      // User A with create:investigations and read:investigations
      userAToken = await mockAuth0.generateToken({
        sub: "auth0|user-a-111",
        permissions: ["create:investigations", "read:investigations"],
      });

      // User B with create:investigations and read:investigations
      userBToken = await mockAuth0.generateToken({
        sub: "auth0|user-b-222",
        permissions: ["create:investigations", "read:investigations"],
      });

      // User A with create:investigations only (lacks read:investigations)
      userANoReadToken = await mockAuth0.generateToken({
        sub: "auth0|user-a-111",
        permissions: ["create:investigations"],
      });

      // User A creates an investigation
      const resA = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({ name: "User A Confidential Audit", description: "Internal finance audit" });
      userAInvId = resA.body.investigation_id;

      // User A uploads evidence and processes it
      await request(app)
        .post(`/api/investigations/${userAInvId}/upload`)
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          files: [
            {
              filename: "audit.log",
              content:
                "commit abc123\nAuthor: Carlos Mendez <cmendez@internal.corp>\nSigned-off-by: Carlos Mendez\nDeploy key acc_deploy_key_881 added.\n",
            },
          ],
        });
      await request(app)
        .post(`/api/investigations/${userAInvId}/process`)
        .set("Authorization", `Bearer ${userAToken}`);

      // User B creates an investigation
      const resB = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${userBToken}`)
        .send({ name: "User B Private Audit", description: "HR access audit" });
      userBInvId = resB.body.investigation_id;
    });

    it("OWN-01: Anonymous user can list demo investigations only", async () => {
      const res = await request(app).get("/api/investigations");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.every((inv: { is_demo: boolean }) => inv.is_demo === true)).toBe(true);
    });

    it("OWN-02: Anonymous user cannot list private investigations", async () => {
      const res = await request(app).get("/api/investigations");
      expect(res.status).toBe(200);
      const ids = res.body.map((i: { investigation_id: string }) => i.investigation_id);
      expect(ids).not.toContain(userAInvId);
      expect(ids).not.toContain(userBInvId);
    });

    it("OWN-03: Anonymous user can retrieve a demo investigation", async () => {
      const res = await request(app).get("/api/investigations/inv_staging_2026_q1");
      expect(res.status).toBe(200);
      expect(res.body.investigation_id).toBe("inv_staging_2026_q1");
      expect(res.body.is_demo).toBe(true);
    });

    it("OWN-04: Anonymous user cannot retrieve private investigation details", async () => {
      const res = await request(app).get(`/api/investigations/${userAInvId}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("OWN-05: Anonymous user cannot retrieve private findings", async () => {
      const res = await request(app).get(`/api/investigations/${userAInvId}/findings`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("OWN-06: User A can create an investigation and becomes its verified owner", async () => {
      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({ name: "User A Second Audit" });

      expect(res.status).toBe(201);
      expect(res.body.owner_id).toBe("auth0|user-a-111");
      expect(res.body.is_demo).toBe(false);
    });

    it("OWN-07: User A can retrieve their own investigation", async () => {
      const res = await request(app)
        .get(`/api/investigations/${userAInvId}`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.investigation_id).toBe(userAInvId);
      expect(res.body.owner_id).toBe("auth0|user-a-111");
    });

    it("OWN-08: User A can retrieve their own findings", async () => {
      const res = await request(app)
        .get(`/api/investigations/${userAInvId}/findings`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.investigation.investigation_id).toBe(userAInvId);
      expect(res.body.records.length).toBeGreaterThan(0);
      expect(res.body.files.length).toBeGreaterThan(0);
    });

    it("OWN-09: User A cannot retrieve User B's investigation (returns 404)", async () => {
      const res = await request(app)
        .get(`/api/investigations/${userBInvId}`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Investigation not found");
    });

    it("OWN-10: User A cannot retrieve User B's findings (returns 404)", async () => {
      const res = await request(app)
        .get(`/api/investigations/${userBInvId}/findings`)
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Investigation findings not found");
    });

    it("OWN-11: A request body attempting to spoof owner_id or is_demo is ignored", async () => {
      const res = await request(app)
        .post("/api/investigations")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "Spoof Attempt Investigation",
          owner_id: "auth0|victim-999",
          is_demo: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.owner_id).toBe("auth0|user-a-111"); // Verified sub enforced
      expect(res.body.is_demo).toBe(false); // Demo status cannot be set by user
    });

    it("OWN-12: A document with missing owner_id and no demo flag is not publicly exposed", async () => {
      const unownedApp = createApp(
        loadConfig({
          NODE_ENV: "test",
          AUTH0_DOMAIN: `127.0.0.1:${mockAuth0.port}`,
          AUTH0_AUDIENCE: mockAuth0.audience,
        }),
      );

      // Querying anonymous list on unowned/unclassified app returns demo only
      const res = await request(unownedApp).get("/api/investigations");
      expect(res.status).toBe(200);
      expect(res.body.every((i: { is_demo: boolean }) => i.is_demo === true)).toBe(true);
    });

    it("OWN-13: Authenticated users without read:investigations receive 403 for private data", async () => {
      // User A attempting to read own investigation without read:investigations scope
      const res = await request(app)
        .get(`/api/investigations/${userAInvId}`)
        .set("Authorization", `Bearer ${userANoReadToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
      expect(res.body.message).toContain("read:investigations");

      // Listing investigations without read:investigations returns 403
      const listRes = await request(app)
        .get("/api/investigations")
        .set("Authorization", `Bearer ${userANoReadToken}`);

      expect(listRes.status).toBe(403);
      expect(listRes.body.error).toBe("Forbidden");
    });

    it("OWN-14: Demo investigations remain publicly accessible anonymously", async () => {
      const invRes = await request(app).get("/api/investigations/inv_staging_2026_q1");
      expect(invRes.status).toBe(200);
      expect(invRes.body.investigation_id).toBe("inv_staging_2026_q1");
      expect(invRes.body.is_demo).toBe(true);

      const findingsRes = await request(app).get(
        "/api/investigations/inv_staging_2026_q1/findings",
      );
      expect(findingsRes.status).toBe(200);
      expect(findingsRes.body.investigation.investigation_id).toBe("inv_staging_2026_q1");
    });

    it("OWN-15: Authenticated User with read:investigations lists demo plus own investigations", async () => {
      const res = await request(app)
        .get("/api/investigations")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.map((i: { investigation_id: string }) => i.investigation_id);
      expect(ids).toContain("inv_staging_2026_q1"); // Demo
      expect(ids).toContain(userAInvId); // User A's private
      expect(ids).not.toContain(userBInvId); // User B's private NOT included
    });
  });
});
