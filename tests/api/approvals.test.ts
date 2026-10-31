import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import { ApprovalRequestSchema, SandboxRemediationResultSchema } from "@keys/contracts";
import { setupMockAuth0Server, MockAuth0Server } from "../helpers/authHelper.js";
import { InMemoryMongoDb } from "../db/testMongoDb.js";
import { MongoInvestigationsRepository } from "../../server/src/repositories/mongoInvestigationsRepository.js";
import { UnavailableInvestigationsRepository } from "../../server/src/repositories/unavailableInvestigationsRepository.js";
import { SandboxRemediationAdapter } from "../../server/src/services/sandboxRemediationAdapter.js";

describe("Phase 4: Auth0 Human Approval & Sandbox Remediation Workflow", () => {
  let mockAuth0: MockAuth0Server;
  let inMemoryDb: InMemoryMongoDb;
  let mongoRepo: MongoInvestigationsRepository;
  let app: ReturnType<typeof createApp>;

  let ownerToken: string;
  let approverToken: string;
  let approverScopeToken: string;
  let userWithoutPermissionToken: string;
  let otherUserToken: string;
  let invalidToken: string;

  let testInvId: string;
  const targetAccountId = "acc_deploy_key_881";

  beforeAll(async () => {
    mockAuth0 = await setupMockAuth0Server();

    // 1. Owner of the investigation (has create/read permissions, but NOT approve:revocations)
    ownerToken = await mockAuth0.generateToken({
      sub: "auth0|user_owner_alice",
      permissions: ["create:investigations", "read:investigations"],
    });

    // 2. Security Operator / Approver (has approve:revocations via Auth0 RBAC permissions array)
    approverToken = await mockAuth0.generateToken({
      sub: "auth0|secops_approver_bob",
      permissions: ["create:investigations", "read:investigations", "approve:revocations"],
    });

    // 3. Security Operator with approve:revocations via OAuth2 scope string
    approverScopeToken = await mockAuth0.generateToken({
      sub: "auth0|secops_scope_charlie",
      scope: "read:investigations approve:revocations",
    });

    // 4. Authenticated user without approve:revocations permission
    userWithoutPermissionToken = await mockAuth0.generateToken({
      sub: "auth0|user_regular_dave",
      permissions: ["read:investigations"],
    });

    // 5. Another user (for testing cross-user tenancy boundaries)
    otherUserToken = await mockAuth0.generateToken({
      sub: "auth0|user_intruder_eve",
      permissions: ["create:investigations", "read:investigations", "approve:revocations"],
    });

    // 6. Cryptographically invalid token (signed by an untrusted key)
    invalidToken = await mockAuth0.generateUntrustedToken({
      permissions: ["approve:revocations"],
    });

    inMemoryDb = new InMemoryMongoDb();
    mongoRepo = new MongoInvestigationsRepository(inMemoryDb.getDb());

    const config = loadConfig({
      NODE_ENV: "test",
      AUTH0_DOMAIN: `127.0.0.1:${mockAuth0.port}`,
      AUTH0_AUDIENCE: mockAuth0.audience,
    });

    app = createApp(config, {}, undefined, undefined, mongoRepo, {
      issuerBaseURL: mockAuth0.issuer,
      jwksUri: mockAuth0.jwksUri,
      audience: mockAuth0.audience,
    });

    // Seed test investigation owned by ownerToken (auth0|user_owner_alice)
    const inv = await mongoRepo.createInvestigation(
      {
        name: "Security Remediation Audit - Q4",
        description: "Evaluating machine identities for sandbox remediation",
      },
      "auth0|user_owner_alice",
    );
    testInvId = inv.investigation_id;

    // Upload evidence and process
    await mongoRepo.addUploadedFiles(testInvId, [
      {
        filename: "deploy_keys.json",
        content: JSON.stringify([
          {
            record_id: `rec_${testInvId}_001`,
            type: "deploy_log",
            ts: "2026-10-30T10:00:00Z",
            actor_account_id: targetAccountId,
            content: "Deployment build key accessed in production pipeline",
          },
        ]),
      },
    ]);
    await mongoRepo.processInvestigation(testInvId);
  });

  afterAll(async () => {
    await mockAuth0.close();
  });

  describe("1. Proposing Simulated Remediation (POST /api/investigations/:id/approvals)", () => {
    it("APPR-01: Proposing remediation returns 201 and stores a pending request", async () => {
      const res = await request(app)
        .post(`/api/investigations/${testInvId}/approvals`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          account_id: targetAccountId,
          proposed_action: "simulate_revoke_deploy_key",
          reason: "Key has been inactive for >90 days and flagged by TabPFN",
        });

      expect(res.status).toBe(201);
      const parsed = ApprovalRequestSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);

      expect(res.body.investigation_id).toBe(testInvId);
      expect(res.body.account_id).toBe(targetAccountId);
      expect(res.body.proposed_action).toBe("simulate_revoke_deploy_key");
      expect(res.body.decision).toBe("pending");
      expect(res.body.execution_status).toBe("not_started");
      expect(res.body.requesting_user_id).toBe("auth0|user_owner_alice");
      expect(res.body.approver_id).toBeNull();
      expect(res.body.audit_history.length).toBeGreaterThan(0);
      expect(res.body.audit_history[0].action).toBe("APPROVAL_PROPOSED");
    });

    it("APPR-02: Rejects invalid action payloads with 400 Bad Request", async () => {
      const res = await request(app)
        .post(`/api/investigations/${testInvId}/approvals`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          account_id: targetAccountId,
          proposed_action: "delete_real_production_aws_iam_user", // Forbidden production action!
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid approval request payload");
    });

    it("APPR-03: Cross-user boundary: another user cannot propose actions for private investigation", async () => {
      const res = await request(app)
        .post(`/api/investigations/${testInvId}/approvals`)
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send({
          account_id: targetAccountId,
          proposed_action: "simulate_revoke_deploy_key",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Investigation not found");
    });
  });

  describe("2. Listing Approval Requests (GET /api/investigations/:id/approvals)", () => {
    it("APPR-04: Returns the list of approval requests for the investigation", async () => {
      const res = await request(app)
        .get(`/api/investigations/${testInvId}/approvals`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].account_id).toBe(targetAccountId);
    });

    it("APPR-05: Denies cross-user list access with 404 Not Found", async () => {
      const res = await request(app)
        .get(`/api/investigations/${testInvId}/approvals`)
        .set("Authorization", `Bearer ${otherUserToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("3. Authorization & Permissions (POST /api/investigations/:id/approvals/:reqId/decide)", () => {
    let pendingReqId: string;

    beforeAll(async () => {
      // Create a fresh pending request
      const res = await request(app)
        .post(`/api/investigations/${testInvId}/approvals`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          account_id: targetAccountId,
          proposed_action: "simulate_disable_service_account",
          reason: "Simulated rotation for forgotten service account",
        });
      pendingReqId = res.body.request_id;
    });

    it("APPR-06: Denies approval when token is missing with 401 Unauthorized", async () => {
      const res = await request(app)
        .post(`/api/investigations/${testInvId}/approvals/${pendingReqId}/decide`)
        .send({ decision: "approved" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("APPR-07: Denies approval when token signature is invalid with 401 Unauthorized", async () => {
      const res = await request(app)
        .post(`/api/investigations/${testInvId}/approvals/${pendingReqId}/decide`)
        .set("Authorization", `Bearer ${invalidToken}`)
        .send({ decision: "approved" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("APPR-08: Denies approval when approve:revocations permission is missing (403 Forbidden)", async () => {
      const res = await request(app)
        .post(`/api/investigations/${testInvId}/approvals/${pendingReqId}/decide`)
        .set("Authorization", `Bearer ${userWithoutPermissionToken}`)
        .send({ decision: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
      expect(res.body.message).toContain("approve:revocations");
    });

    it("APPR-09: Investigation owner lacking approve:revocations cannot approve their own proposal (403 Forbidden)", async () => {
      const res = await request(app)
        .post(`/api/investigations/${testInvId}/approvals/${pendingReqId}/decide`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ decision: "approved" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });
  });

  describe("4. Human Decision Lifecycle & Sandbox Execution", () => {
    it("APPR-10: Human operator rejects approval request -> transitions to rejected, no execution", async () => {
      // Create request to reject
      const createRes = await request(app)
        .post(`/api/investigations/${testInvId}/approvals`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          account_id: targetAccountId,
          proposed_action: "simulate_quarantine_token",
          reason: "Needs review",
        });
      expect(createRes.status).toBe(201);

      // Make approver the owner or allow decision
      // Note: for this test, let's create an investigation owned by approver
      const approverInv = await mongoRepo.createInvestigation(
        { name: "SecOps Queue" },
        "auth0|secops_approver_bob",
      );
      const appReq = await mongoRepo.createApprovalRequest(
        approverInv.investigation_id,
        {
          account_id: targetAccountId,
          proposed_action: "simulate_quarantine_token",
          reason: "Triage queue",
        },
        "auth0|secops_approver_bob",
      );

      const res = await request(app)
        .post(
          `/api/investigations/${approverInv.investigation_id}/approvals/${appReq.request_id}/decide`,
        )
        .set("Authorization", `Bearer ${approverToken}`)
        .send({
          decision: "rejected",
          reason: "Investigation confirms token is active in secondary pipeline",
        });

      expect(res.status).toBe(200);
      expect(res.body.decision).toBe("rejected");
      expect(res.body.approver_id).toBe("auth0|secops_approver_bob");
      expect(res.body.execution_status).toBe("not_started");
      expect(res.body.execution_result).toBeNull();
      expect(res.body.decision_reason).toContain("secondary pipeline");

      // Verify audit history
      const lastAudit = res.body.audit_history[res.body.audit_history.length - 1];
      expect(lastAudit.action).toBe("APPROVAL_REJECTED");
      expect(lastAudit.actor).toBe("auth0|secops_approver_bob");
    });

    it("APPR-11: Authorized approver grants approval -> triggers sandbox execution and completes simulation", async () => {
      const approverInv = await mongoRepo.createInvestigation(
        { name: "SecOps Execution Queue" },
        "auth0|secops_approver_bob",
      );
      const appReq = await mongoRepo.createApprovalRequest(
        approverInv.investigation_id,
        {
          account_id: targetAccountId,
          proposed_action: "simulate_revoke_deploy_key",
          reason: "Inactive key approved for simulated revocation",
        },
        "auth0|secops_approver_bob",
      );

      const res = await request(app)
        .post(
          `/api/investigations/${approverInv.investigation_id}/approvals/${appReq.request_id}/decide`,
        )
        .set("Authorization", `Bearer ${approverToken}`)
        .send({
          decision: "approved",
          reason: "Simulated remediation confirmed safe by SecOps Lead",
        });

      expect(res.status).toBe(200);
      expect(res.body.decision).toBe("approved");
      expect(res.body.approver_id).toBe("auth0|secops_approver_bob");
      expect(res.body.execution_status).toBe("completed");

      // Verify execution result contract
      const execResult = res.body.execution_result;
      expect(execResult).not.toBeNull();
      const parsedExec = SandboxRemediationResultSchema.safeParse(execResult);
      expect(parsedExec.success).toBe(true);
      expect(execResult.is_sandbox_simulation).toBe(true);
      expect(execResult.simulated_action).toBe("simulate_revoke_deploy_key");
      expect(execResult.target_account).toBe(targetAccountId);
      expect(execResult.simulated_logs.length).toBeGreaterThan(0);
      expect(execResult.simulated_logs.some((l: string) => l.includes("[SIMULATED SANDBOX]"))).toBe(
        true,
      );

      // Verify full audit trail
      const auditActions = res.body.audit_history.map((a: any) => a.action);
      expect(auditActions).toContain("APPROVAL_PROPOSED");
      expect(auditActions).toContain("APPROVAL_GRANTED");
      expect(auditActions).toContain("SANDBOX_SIMULATION_COMPLETED");
    });

    it("APPR-12: Approver with OAuth2 scope claim also succeeds", async () => {
      const scopeInv = await mongoRepo.createInvestigation(
        { name: "Scope SecOps Queue" },
        "auth0|secops_scope_charlie",
      );
      const appReq = await mongoRepo.createApprovalRequest(
        scopeInv.investigation_id,
        {
          account_id: targetAccountId,
          proposed_action: "simulate_disable_service_account",
        },
        "auth0|secops_scope_charlie",
      );

      const res = await request(app)
        .post(
          `/api/investigations/${scopeInv.investigation_id}/approvals/${appReq.request_id}/decide`,
        )
        .set("Authorization", `Bearer ${approverScopeToken}`)
        .send({
          decision: "approved",
          reason: "Scope authorized",
        });

      expect(res.status).toBe(200);
      expect(res.body.decision).toBe("approved");
      expect(res.body.execution_status).toBe("completed");
    });
  });

  describe("5. Concurrency, Duplicate Approvals & Safety Guards", () => {
    it("APPR-13: Duplicate decision returns 409 Conflict", async () => {
      const testInv = await mongoRepo.createInvestigation(
        { name: "Conflict Queue" },
        "auth0|secops_approver_bob",
      );
      const appReq = await mongoRepo.createApprovalRequest(
        testInv.investigation_id,
        {
          account_id: targetAccountId,
          proposed_action: "simulate_revoke_deploy_key",
        },
        "auth0|secops_approver_bob",
      );

      // First decision
      const res1 = await request(app)
        .post(
          `/api/investigations/${testInv.investigation_id}/approvals/${appReq.request_id}/decide`,
        )
        .set("Authorization", `Bearer ${approverToken}`)
        .send({ decision: "approved" });
      expect(res1.status).toBe(200);

      // Second decision on same request
      const res2 = await request(app)
        .post(
          `/api/investigations/${testInv.investigation_id}/approvals/${appReq.request_id}/decide`,
        )
        .set("Authorization", `Bearer ${approverToken}`)
        .send({ decision: "rejected" });

      expect(res2.status).toBe(409);
      expect(res2.body.error).toBe("Conflict");
      expect(res2.body.message).toContain("already");
    });

    it("APPR-14: Concurrent approval attempts race test: exactly one succeeds, other receives 409 Conflict", async () => {
      const testInv = await mongoRepo.createInvestigation(
        { name: "Race Queue" },
        "auth0|secops_approver_bob",
      );
      const appReq = await mongoRepo.createApprovalRequest(
        testInv.investigation_id,
        {
          account_id: targetAccountId,
          proposed_action: "simulate_quarantine_token",
        },
        "auth0|secops_approver_bob",
      );

      // Fire 2 concurrent approval requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app)
          .post(
            `/api/investigations/${testInv.investigation_id}/approvals/${appReq.request_id}/decide`,
          )
          .set("Authorization", `Bearer ${approverToken}`)
          .send({ decision: "approved", reason: "Attempt 1" }),
        request(app)
          .post(
            `/api/investigations/${testInv.investigation_id}/approvals/${appReq.request_id}/decide`,
          )
          .set("Authorization", `Bearer ${approverToken}`)
          .send({ decision: "approved", reason: "Attempt 2" }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });

    it("APPR-15: Sandbox safety adapter strictly rejects any real/unpermitted action", async () => {
      await expect(
        SandboxRemediationAdapter.executeSimulatedRemediation(
          "revoke_real_aws_secret" as any,
          targetAccountId,
          testInvId,
          "tester",
        ),
      ).rejects.toThrow(/not an authorized sandbox remediation action/);
    });
  });

  describe("6. Database Unavailability Handling", () => {
    it("APPR-16: Returns 503 Service Unavailable when database is disconnected", async () => {
      const unavailApp = createApp(
        loadConfig({
          NODE_ENV: "test",
          AUTH0_DOMAIN: `127.0.0.1:${mockAuth0.port}`,
          AUTH0_AUDIENCE: mockAuth0.audience,
        }),
        {},
        undefined,
        undefined,
        new UnavailableInvestigationsRepository(),
        {
          issuerBaseURL: mockAuth0.issuer,
          jwksUri: mockAuth0.jwksUri,
          audience: mockAuth0.audience,
        },
      );

      const res = await request(unavailApp)
        .post(`/api/investigations/inv_real_001/approvals`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          account_id: targetAccountId,
          proposed_action: "simulate_revoke_deploy_key",
        });

      expect(res.status).toBe(503);
      expect(res.body.error).toBe("Database unavailable");
    });
  });
});
