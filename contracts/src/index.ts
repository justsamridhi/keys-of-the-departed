import { z } from "zod";

// ==========================================
// 1. Enums
// ==========================================

export const AccountKindEnum = z.enum(["deploy_key", "service_account", "bot"]);
export type AccountKind = z.infer<typeof AccountKindEnum>;

export const PersonStatusEnum = z.enum(["active", "departed"]);
export type PersonStatus = z.infer<typeof PersonStatusEnum>;

export const EvidenceRecordTypeEnum = z.enum(["commit", "ticket", "deploy_log", "policy"]);
export type EvidenceRecordType = z.infer<typeof EvidenceRecordTypeEnum>;

export const ClaimKindEnum = z.enum(["owner", "purpose"]);
export type ClaimKind = z.infer<typeof ClaimKindEnum>;

export const ReasonCodeEnum = z.enum(["R1", "R2", "R3", "R4", "R5"]);
export type ReasonCode = z.infer<typeof ReasonCodeEnum>;

export const OwnerStatusEnum = z.enum(["verified", "supported", "conflicting", "no_evidence"]);
export type OwnerStatus = z.infer<typeof OwnerStatusEnum>;

export const PurposeStatusEnum = z.enum(["verified", "supported", "no_evidence"]);
export type PurposeStatus = z.infer<typeof PurposeStatusEnum>;

export const GhostTypeEnum = z.enum(["LOST", "FORGOTTEN", "LONELY", "INNOCENT", "NOT_GHOST"]);
export type GhostType = z.infer<typeof GhostTypeEnum>;

export const HealthComponentStatusEnum = z.enum(["ok", "not_configured", "unavailable"]);
export type HealthComponentStatus = z.infer<typeof HealthComponentStatusEnum>;

// ==========================================
// 2. Domain Schemas
// ==========================================

export const AccountSchema = z
  .object({
    account_id: z.string().min(1),
    kind: AccountKindEnum,
    created_at: z.string().datetime(),
    last_used_at: z.string().datetime().nullable(),
    permissions: z.array(z.string()),
    tags: z.array(z.string()),
    expires_at: z.string().datetime().nullable(),
  })
  .strict();
export type Account = z.infer<typeof AccountSchema>;

export const PersonDirectoryEntrySchema = z
  .object({
    person_id: z.string().min(1),
    display_name: z.string().min(1),
    handles: z.array(z.string()),
    status: PersonStatusEnum,
    departed_at: z.string().datetime().nullable(),
  })
  .strict();
export type PersonDirectoryEntry = z.infer<typeof PersonDirectoryEntrySchema>;

export const EvidenceRecordSchema = z
  .object({
    record_id: z.string().min(1),
    type: EvidenceRecordTypeEnum,
    ts: z.string().datetime(),
    author_handle: z.string().nullable(),
    assignee_handle: z.string().nullable(),
    actor_account_id: z.string().nullable(),
    content: z.string(),
    structured: z.boolean(),
  })
  .strict();
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export const InvestigationClaimSchema = z
  .object({
    kind: ClaimKindEnum,
    account_id: z.string().min(1),
    person_id: z.string().nullable(),
    record_id: z.string().min(1),
    quote: z.string(),
    text: z.string(),
  })
  .strict();
export type InvestigationClaim = z.infer<typeof InvestigationClaimSchema>;

export const RemovedClaimSchema = InvestigationClaimSchema.extend({
  reason_code: ReasonCodeEnum,
}).strict();
export type RemovedClaim = z.infer<typeof RemovedClaimSchema>;

export const CaseSchema = z
  .object({
    case_id: z.string().min(1),
    bundle_id: z.string().min(1),
    account_id: z.string().min(1),
    claims_accepted: z.array(InvestigationClaimSchema),
    claims_removed: z.array(RemovedClaimSchema),
    owner_status: OwnerStatusEnum,
    purpose_status: PurposeStatusEnum,
    ghost_type: GhostTypeEnum,
    model: z.string(),
    latency_ms: z.number().nonnegative(),
  })
  .strict();
export type Case = z.infer<typeof CaseSchema>;

export const HealthStatusSchema = z
  .object({
    status: z.enum(["ok", "degraded", "unavailable"]),
    uptime: z.number().nonnegative(),
    timestamp: z.string().datetime(),
    mode: z.enum(["demo", "configured"]),
    checks: z
      .object({
        db: HealthComponentStatusEnum,
        model: HealthComponentStatusEnum,
        scores: HealthComponentStatusEnum,
      })
      .strict(),
  })
  .strict();
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
