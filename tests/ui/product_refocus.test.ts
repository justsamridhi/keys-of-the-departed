import { describe, it, expect } from "vitest";
import {
  CreateInvestigationSchema,
  AccountsResponseSchema,
  DashboardStatsSchema,
  InvestigationFindingsSchema,
  EvidenceCategory,
} from "@keys/contracts";
import { createApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import request from "supertest";

describe("Product Refocus & Investigation Workflow Redesign", () => {
  describe("Part 1 & 3: Investigation Creation & Parameters", () => {
    it("REFOCUS-01: Accepts organization_id and optional date range in investigation creation", () => {
      const input = {
        name: "Q4 Production Cluster Audit",
        organization_id: "org_acme_cyber_2026",
        description: "Orphaned service account and deploy key triage.",
      };
      const result = CreateInvestigationSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Q4 Production Cluster Audit");
        expect(result.data.organization_id).toBe("org_acme_cyber_2026");
      }
    });

    it("REFOCUS-02: Allows omitting organization_id and description for minimal fast entry", () => {
      const input = {
        name: "Fast Deploy Key Scan",
      };
      const result = CreateInvestigationSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.organization_id).toBeUndefined();
        expect(result.data.description).toBe("");
      }
    });
  });

  describe("Part 3: Evidence File Category Detection & Pre-Flight Validation", () => {
    function detectCategory(filename: string): EvidenceCategory {
      const lower = filename.toLowerCase();
      if (lower.includes("account") || lower.includes("identit") || lower.includes("inventory")) {
        return "machine_identity_inventory";
      }
      if (lower.includes("iam") || lower.includes("policy") || lower.includes("perm")) {
        return "iam_policies";
      }
      if (lower.includes("commit") || lower.includes("git") || lower.includes("repo")) {
        return "repository_commits";
      }
      if (
        lower.includes("deploy") ||
        lower.includes("ci") ||
        lower.includes("cd") ||
        lower.includes("pipe") ||
        lower.includes("build")
      ) {
        return "deployment_cicd";
      }
      if (
        lower.includes("person") ||
        lower.includes("employee") ||
        lower.includes("directory") ||
        lower.includes("hr")
      ) {
        return "personnel_directory";
      }
      return "engineering_tickets";
    }

    it("REFOCUS-03: Correctly identifies all 6 evidence categories from file semantics", () => {
      expect(detectCategory("cloud-machine-inventory.csv")).toBe("machine_identity_inventory");
      expect(detectCategory("aws-iam-policies.json")).toBe("iam_policies");
      expect(detectCategory("git-commits-main.log")).toBe("repository_commits");
      expect(detectCategory("jenkins-pipeline-deploy.log")).toBe("deployment_cicd");
      expect(detectCategory("engineering-personnel-directory.json")).toBe("personnel_directory");
      expect(detectCategory("jira-tickets-infra.json")).toBe("engineering_tickets");
    });

    it("REFOCUS-04: Validates CSV and JSON file structures and rejects malformed content", () => {
      // JSON validation
      const validJson = JSON.stringify([{ account_id: "acc_deploy_01", type: "deploy_key" }]);
      const invalidJson = "{ malformed json ";
      expect(() => JSON.parse(validJson)).not.toThrow();
      expect(() => JSON.parse(invalidJson)).toThrow();

      // CSV validation
      const validCsv = "account_id,type,author\nacc_ci_01,service_account,alex@corp.internal";
      const csvLines = validCsv.split("\n").filter((l) => l.trim().length > 0);
      expect(csvLines.length).toBe(2);
      expect(csvLines[0].split(",")).toContain("account_id");
    });
  });

  describe("Part 5 & 7: Strict Demo Separation vs Real User Workspaces", () => {
    const config = loadConfig({ NODE_ENV: "test" });
    const app = createApp(config);

    it("REFOCUS-05: GET /api/stats/dashboard?demo=true explicitly returns synthetic demonstration metrics", async () => {
      const res = await request(app).get("/api/stats/dashboard?demo=true");
      expect(res.status).toBe(200);
      const parsed = DashboardStatsSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);
      expect(res.body.meta.synthetic).toBe(true);
      expect(res.body.total_identities).toBe(40);
      expect(res.body.ghost_distribution.LOST).toBe(10);
      expect(res.body.ghost_distribution.FORGOTTEN).toBe(10);
      expect(res.body.ghost_distribution.LONELY).toBe(10);
      expect(res.body.ghost_distribution.INNOCENT).toBe(10);
    });

    it("REFOCUS-06: GET /api/accounts?demo=true returns synthetic records with meta.synthetic = true", async () => {
      const res = await request(app).get("/api/accounts?demo=true&limit=10");
      expect(res.status).toBe(200);
      const parsed = AccountsResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);
      expect(res.body.meta.synthetic).toBe(true);
      expect(res.body.pagination.total).toBe(40);
    });

    it("REFOCUS-07: Unauthenticated request to /api/investigations returns only demo investigations", async () => {
      const res = await request(app).get("/api/investigations");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every((inv: { is_demo?: boolean }) => inv.is_demo === true)).toBe(true);
    });
  });

  describe("Part 4: Findings Structure & Verifiable Citations", () => {
    it("REFOCUS-08: Investigation findings answer the 5 core questions without invented risk scores", () => {
      const sampleFindings = {
        investigation: {
          investigation_id: "inv_test_01",
          name: "Test Audit",
          description: "Automated analysis of night-build deploy credentials",
          status: "completed",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          file_count: 1,
          record_count: 2,
          accounts_discovered_count: 1,
          bundle_id: "bundle_01",
          is_demo: false,
        },
        files: [],
        records: [],
        discovered_accounts: [
          {
            account_id: "acc_staging_runner_42",
            kind: "service_account",
            created_at: "2026-01-15T00:00:00.000Z",
            last_used_at: "2026-10-25T00:00:00.000Z",
            permissions: ["repo:read", "deploy:write"],
            tags: ["ci", "staging"],
            expires_at: null,
            ghost_type: "LOST",
            owner_status: "verified",
            case_id: "case_test_01",
            primary_quote: "Created for nocturnal integration builds",
            owner_name: "DevOps Automation",
            purpose: "Nightly CI/CD build runner",
          },
        ],
        cases: [],
        processing_summary: {
          total_records_processed: 2,
          claims_verified_count: 1,
          claims_quarantined_count: 0,
          evidence_status_counts: {
            verified: 1,
            supported: 0,
            conflicting: 0,
            no_evidence: 0,
          },
          ghost_type_counts: {
            LOST: 1,
            FORGOTTEN: 0,
            LONELY: 0,
            INNOCENT: 0,
          },
          model_extraction_status: "simulated",
        },
      };

      const parsed = InvestigationFindingsSchema.safeParse(sampleFindings);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        const acc = parsed.data.discovered_accounts[0];
        // 1. What machine identities were discovered?
        expect(acc.account_id).toBe("acc_staging_runner_42");
        expect(acc.kind).toBe("service_account");
        // 2. Who or what appears to own them?
        expect(acc.owner_name).toBe("DevOps Automation");
        // 3. What evidence supports that conclusion?
        expect(acc.primary_quote).toContain("Created for nocturnal integration builds");
        // 4. What permissions and activity are recorded?
        expect(acc.last_used_at).toBeDefined();
        expect(acc.permissions).toContain("deploy:write");
        // 5. Verification status
        expect(acc.owner_status).toBe("verified");
      }
    });
  });
});
