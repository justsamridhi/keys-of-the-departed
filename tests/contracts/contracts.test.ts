import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  AccountSchema,
  PersonDirectoryEntrySchema,
  EvidenceRecordSchema,
  InvestigationClaimSchema,
  RemovedClaimSchema,
  CaseSchema,
} from "../../contracts/src/index.js";

describe("Area 1: Contracts and Schema Parity", () => {
  it("C-01: Validates a valid account fixture", () => {
    const validAccount = {
      account_id: "acc_deploy_key_881",
      kind: "deploy_key",
      created_at: "2025-01-01T00:00:00.000Z",
      last_used_at: "2025-06-01T12:00:00.000Z",
      permissions: ["repo:read", "actions:write"],
      tags: ["production", "ci"],
      expires_at: null,
    };

    const res = AccountSchema.safeParse(validAccount);
    expect(res.success).toBe(true);
  });

  it("C-02: Rejects invalid account kind enum", () => {
    const invalidAccount = {
      account_id: "acc_invalid",
      kind: "api_key", // Not allowed: only deploy_key, service_account, bot
      created_at: "2025-01-01T00:00:00.000Z",
      last_used_at: null,
      permissions: [],
      tags: [],
      expires_at: null,
    };

    const res = AccountSchema.safeParse(invalidAccount);
    expect(res.success).toBe(false);
  });

  it("C-03: Strictly rejects unknown keys on account", () => {
    const extraKeyAccount = {
      account_id: "acc_extra",
      kind: "bot",
      created_at: "2025-01-01T00:00:00.000Z",
      last_used_at: null,
      permissions: [],
      tags: [],
      expires_at: null,
      unrecognized_token: "secret123",
    };

    const res = AccountSchema.safeParse(extraKeyAccount);
    expect(res.success).toBe(false);
  });

  it("C-04: Validates active person directory entry", () => {
    const validPerson = {
      person_id: "person_carlos",
      display_name: "Carlos Mendez",
      handles: ["cmendez", "carlos-m"],
      status: "active",
      departed_at: null,
    };

    const res = PersonDirectoryEntrySchema.safeParse(validPerson);
    expect(res.success).toBe(true);
  });

  it("C-05: Validates departed person directory entry with timestamp", () => {
    const departedPerson = {
      person_id: "person_carlos",
      display_name: "Carlos Mendez",
      handles: ["cmendez"],
      status: "departed",
      departed_at: "2025-07-01T00:00:00.000Z",
    };

    const res = PersonDirectoryEntrySchema.safeParse(departedPerson);
    expect(res.success).toBe(true);
  });

  it("C-06: Validates valid evidence record with allowed type", () => {
    const validRecord = {
      record_id: "rec_1001",
      type: "commit",
      ts: "2025-05-01T10:00:00.000Z",
      author_handle: "cmendez",
      assignee_handle: null,
      actor_account_id: "acc_deploy_key_881",
      content: "Initial setup",
      structured: true,
    };

    const res = EvidenceRecordSchema.safeParse(validRecord);
    expect(res.success).toBe(true);
  });

  it("C-07: Rejects unauthorized evidence record type", () => {
    const invalidRecord = {
      record_id: "rec_1002",
      type: "slack_message", // Not in commit, ticket, deploy_log, policy
      ts: "2025-05-01T10:00:00.000Z",
      author_handle: null,
      assignee_handle: null,
      actor_account_id: null,
      content: "Hello",
      structured: false,
    };

    const res = EvidenceRecordSchema.safeParse(invalidRecord);
    expect(res.success).toBe(false);
  });

  it("C-08: Validates owner and purpose investigation claims", () => {
    const ownerClaim = {
      kind: "owner",
      account_id: "acc_1",
      person_id: "person_carlos",
      record_id: "rec_1",
      quote: "Signed-off-by: Carlos Mendez",
      text: "Carlos created key",
    };

    const purposeClaim = {
      kind: "purpose",
      account_id: "acc_1",
      person_id: null,
      record_id: "rec_2",
      quote: "Deployment pipeline key",
      text: "Pipeline access",
    };

    expect(InvestigationClaimSchema.safeParse(ownerClaim).success).toBe(true);
    expect(InvestigationClaimSchema.safeParse(purposeClaim).success).toBe(true);
  });

  it("C-09: Enforces reason codes R1 through R5 on removed claims", () => {
    const validRemoved = {
      kind: "owner",
      account_id: "acc_1",
      person_id: "person_carlos",
      record_id: "rec_1",
      quote: "Signed-off-by",
      text: "Quote too short",
      reason_code: "R5",
    };

    expect(RemovedClaimSchema.safeParse(validRemoved).success).toBe(true);

    const invalidReason = {
      ...validRemoved,
      reason_code: "R99",
    };
    expect(RemovedClaimSchema.safeParse(invalidReason).success).toBe(false);
  });

  it("C-10: Verifies canonical JSON Schema files exist and match properties", () => {
    const schemas = [
      "account.schema.json",
      "person.schema.json",
      "record.schema.json",
      "claim.schema.json",
      "removed_claim.schema.json",
      "case.schema.json",
    ];

    for (const schemaFile of schemas) {
      const fullPath = path.resolve(process.cwd(), "contracts", schemaFile);
      expect(fs.existsSync(fullPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      expect(parsed).toHaveProperty("properties");
      expect(parsed.additionalProperties).toBe(false);
    }
  });

  it("Validates full case schema with pinned owner_status and ghost_type", () => {
    const validCase = {
      case_id: "case_01",
      bundle_id: "bundle_01",
      account_id: "acc_01",
      claims_accepted: [],
      claims_removed: [],
      owner_status: "verified",
      purpose_status: "verified",
      ghost_type: "LOST",
      model: "gemma3:4b",
      latency_ms: 120,
    };

    expect(CaseSchema.safeParse(validCase).success).toBe(true);

    // Rejects invalid enums
    expect(CaseSchema.safeParse({ ...validCase, owner_status: "Verified" }).success).toBe(false);
    expect(CaseSchema.safeParse({ ...validCase, ghost_type: "unclassified" }).success).toBe(false);
  });
});
