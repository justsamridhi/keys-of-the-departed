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

export const TriageTierEnum = z.enum(["URGENT", "ELEVATED", "ROUTINE", "NORMAL"]);
export type TriageTier = z.infer<typeof TriageTierEnum>;

export const HealthComponentStatusEnum = z.enum(["ok", "not_configured", "unavailable"]);
export type HealthComponentStatus = z.infer<typeof HealthComponentStatusEnum>;

export const SandboxActionEnum = z.enum([
  "simulate_revoke_deploy_key",
  "simulate_disable_service_account",
  "simulate_quarantine_token",
]);
export type SandboxAction = z.infer<typeof SandboxActionEnum>;

export const ApprovalDecisionEnum = z.enum(["pending", "approved", "rejected"]);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionEnum>;

export const ExecutionStatusEnum = z.enum(["not_started", "executing", "completed", "failed"]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusEnum>;

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
    repository: z.string().nullable().optional(),
    activity: z.string().nullable().optional(),
    confidence: z.enum(["explicit", "inferred"]).optional(),
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

export const ArchiveAccountSchema = AccountSchema.extend({
  ghost_type: GhostTypeEnum,
  owner_status: OwnerStatusEnum,
  case_id: z.string().min(1),
  primary_quote: z.string(),
  owner_name: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  priority_score: z.number().nullable().optional(),
  priority_rank: z.number().int().nullable().optional(),
  triage_tier: TriageTierEnum.nullable().optional(),
}).strict();
export type ArchiveAccount = z.infer<typeof ArchiveAccountSchema>;

export const PrioritizationFeaturesSchema = z
  .object({
    days_since_last_active: z.number().nullable(),
    owner_status_code: z.number(), // 0=no_evidence, 1=conflicting, 2=supported, 3=verified
    permission_count: z.number(),
    has_admin_perm: z.boolean(),
    repo_count: z.number(),
    recent_deploy_count: z.number(),
    account_kind_code: z.number(), // 0=bot, 1=deploy_key, 2=service_account
    evidence_record_count: z.number(),
    has_conflicting_ownership: z.boolean(),
  })
  .strict();
export type PrioritizationFeatures = z.infer<typeof PrioritizationFeaturesSchema>;

export const AccountPrioritizationSchema = z
  .object({
    account_id: z.string().min(1),
    priority_score: z.number().min(0).max(1),
    priority_rank: z.number().int().positive(),
    triage_tier: TriageTierEnum,
    features: PrioritizationFeaturesSchema,
    contributing_factors: z.array(z.string()),
    missing_inputs: z.array(z.string()),
  })
  .strict();
export type AccountPrioritization = z.infer<typeof AccountPrioritizationSchema>;

export const TabPfnSummarySchema = z
  .object({
    status: z.enum(["completed", "model_unavailable", "abstained", "simulated"]),
    model_name: z.string(),
    model_version: z.string(),
    executed_at: z.string().datetime(),
    latency_ms: z.number().nonnegative(),
    identities_ranked: z.number().int().nonnegative(),
    rankings: z.array(AccountPrioritizationSchema),
    disclaimer: z.string(),
  })
  .strict();
export type TabPfnSummary = z.infer<typeof TabPfnSummarySchema>;

export const AccountsQuerySchema = z.object({
  chapter: z.enum(["ALL", "LOST", "FORGOTTEN", "LONELY", "INNOCENT"]).optional().default("ALL"),
  status: z
    .enum(["ALL", "verified", "supported", "conflicting", "no_evidence"])
    .optional()
    .default("ALL"),
  search: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(12),
  demo: z.enum(["true", "false"]).optional(),
});
export type AccountsQuery = z.infer<typeof AccountsQuerySchema>;

export const AccountsResponseSchema = z
  .object({
    data: z.array(ArchiveAccountSchema),
    pagination: z
      .object({
        page: z.number().int().min(1),
        limit: z.number().int().min(1),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .strict(),
    filters: z
      .object({
        chapter: z.string(),
        status: z.string(),
        search: z.string(),
      })
      .strict(),
    meta: z
      .object({
        synthetic: z.boolean(),
        timestamp: z.string().datetime(),
      })
      .strict(),
  })
  .strict();
export type AccountsResponse = z.infer<typeof AccountsResponseSchema>;

// ==========================================
// 3. Phase 3: Investigations, Uploads & Dashboard
// ==========================================

export const InvestigationStatusEnum = z.enum([
  "created",
  "files_uploaded",
  "processing",
  "completed",
  "failed",
]);
export type InvestigationStatus = z.infer<typeof InvestigationStatusEnum>;

export const InvestigationSchema = z
  .object({
    investigation_id: z.string().min(1),
    name: z.string().min(1).max(120),
    description: z.string().max(500),
    status: InvestigationStatusEnum,
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    file_count: z.number().int().nonnegative(),
    record_count: z.number().int().nonnegative(),
    accounts_discovered_count: z.number().int().nonnegative(),
    bundle_id: z.string().min(1),
    owner_id: z.string().nullable().optional(),
    organization_id: z.string().max(120).nullable().optional(),
    is_demo: z.boolean().default(false),
  })
  .strict();
export type Investigation = z.infer<typeof InvestigationSchema>;

export const CreateInvestigationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Investigation name is required")
    .max(120, "Name must be 120 characters or less"),
  organization_id: z
    .string()
    .trim()
    .max(120, "Organization or project identifier must be 120 characters or less")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .default(""),
  owner_id: z.string().optional(),
  is_demo: z.boolean().optional(),
});
export type CreateInvestigationInput = z.infer<typeof CreateInvestigationSchema>;

export const UploadedFileSchema = z
  .object({
    file_id: z.string().min(1),
    investigation_id: z.string().min(1),
    filename: z.string().min(1),
    size_bytes: z.number().int().nonnegative(),
    extension: z.string(),
    uploaded_at: z.string().datetime(),
    status: z.enum(["valid", "invalid", "processed", "failed"]),
    records_extracted: z.number().int().nonnegative(),
    error_message: z.string().nullable().optional(),
  })
  .strict();
export type UploadedFile = z.infer<typeof UploadedFileSchema>;

export const SingleFileInputSchema = z
  .object({
    filename: z.string().min(1).max(255),
    content: z.string(),
    size_bytes: z.number().int().nonnegative().optional(),
  })
  .strict();
export type SingleFileInput = z.infer<typeof SingleFileInputSchema>;

export const UploadFilesInputSchema = z
  .object({
    files: z
      .array(SingleFileInputSchema)
      .min(1, "At least one file must be provided")
      .max(20, "Cannot upload more than 20 files per request"),
  })
  .strict();
export type UploadFilesInput = z.infer<typeof UploadFilesInputSchema>;

export const InvestigationFindingsSchema = z
  .object({
    investigation: InvestigationSchema,
    files: z.array(UploadedFileSchema),
    records: z.array(EvidenceRecordSchema),
    discovered_accounts: z.array(ArchiveAccountSchema),
    cases: z.array(CaseSchema),
    processing_summary: z
      .object({
        total_records_processed: z.number().int().nonnegative(),
        claims_verified_count: z.number().int().nonnegative(),
        claims_quarantined_count: z.number().int().nonnegative(),
        evidence_status_counts: z.record(z.string(), z.number().int().nonnegative()),
        ghost_type_counts: z.record(z.string(), z.number().int().nonnegative()),
        model_extraction_status: z.enum([
          "completed",
          "simulated",
          "pending_offline",
          "abstained",
          "model_unavailable",
        ]),
        model_name: z.string().optional(),
        model_provider: z.string().optional(),
        processed_at: z.string().datetime().optional(),
        candidate_claims_count: z.number().int().nonnegative().optional(),
        abstention_reason: z.string().nullable().optional(),
      })
      .strict(),
    tabpfn_prioritization: TabPfnSummarySchema.nullable().optional(),
  })
  .strict();
export type InvestigationFindings = z.infer<typeof InvestigationFindingsSchema>;

export const DashboardStatsSchema = z
  .object({
    total_identities: z.number().int().nonnegative(),
    ghost_distribution: z
      .object({
        LOST: z.number().int().nonnegative(),
        FORGOTTEN: z.number().int().nonnegative(),
        LONELY: z.number().int().nonnegative(),
        INNOCENT: z.number().int().nonnegative(),
      })
      .strict(),
    evidence_status_distribution: z
      .object({
        verified: z.number().int().nonnegative(),
        supported: z.number().int().nonnegative(),
        conflicting: z.number().int().nonnegative(),
        no_evidence: z.number().int().nonnegative(),
      })
      .strict(),
    review_required_count: z.number().int().nonnegative(),
    recent_investigations: z.array(InvestigationSchema),
    meta: z
      .object({
        synthetic: z.boolean(),
        timestamp: z.string().datetime(),
      })
      .strict(),
  })
  .strict();
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

// ==========================================
// 4. Human Approval & Sandbox Remediation Schemas
// ==========================================

export const AuditEntrySchema = z
  .object({
    timestamp: z.string().datetime(),
    actor: z.string().min(1),
    action: z.string().min(1),
    details: z.string(),
  })
  .strict();
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const SandboxRemediationResultSchema = z
  .object({
    sandbox_id: z.string(),
    executed_at: z.string().datetime(),
    simulated_action: SandboxActionEnum,
    target_account: z.string(),
    simulated_logs: z.array(z.string()),
    is_sandbox_simulation: z.literal(true),
  })
  .strict();
export type SandboxRemediationResult = z.infer<typeof SandboxRemediationResultSchema>;

export const ApprovalRequestSchema = z
  .object({
    request_id: z.string().min(1),
    investigation_id: z.string().min(1),
    account_id: z.string().min(1),
    proposed_action: SandboxActionEnum,
    evidence_references: z.array(z.string()),
    verification_state: OwnerStatusEnum,
    gemma_summary: z.string(),
    tabpfn_priority: z
      .object({
        priority_score: z.number(),
        priority_rank: z.number().int(),
        triage_tier: TriageTierEnum,
      })
      .nullable()
      .optional(),
    requesting_user_id: z.string().min(1),
    approver_id: z.string().nullable(),
    decision: ApprovalDecisionEnum,
    decision_timestamp: z.string().datetime().nullable(),
    decision_reason: z.string().nullable().optional(),
    execution_status: ExecutionStatusEnum,
    execution_result: SandboxRemediationResultSchema.nullable().optional(),
    audit_history: z.array(AuditEntrySchema),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .strict();
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const CreateApprovalInputSchema = z
  .object({
    account_id: z.string().min(1),
    proposed_action: SandboxActionEnum,
    reason: z.string().max(500).optional(),
  })
  .strict();
export type CreateApprovalInput = z.infer<typeof CreateApprovalInputSchema>;

export const DecideApprovalInputSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().max(500).optional(),
  })
  .strict();
export type DecideApprovalInput = z.infer<typeof DecideApprovalInputSchema>;

// ==========================================
// 6. Phase 5: Entire Provenance Schemas
// ==========================================

export const EntireCheckpointSchema = z
  .object({
    checkpoint_id: z.string(),
    session_id: z.string().optional(),
    agent: z.string().optional(),
    date: z.string().optional(),
    message: z.string().optional(),
    is_logs_only: z.boolean().optional(),
    session_count: z.number().int().optional(),
    session_ids: z.array(z.string()).optional(),
    files_touched: z.array(z.string()).optional(),
  })
  .passthrough();
export type EntireCheckpoint = z.infer<typeof EntireCheckpointSchema>;

export const EntireSessionSchema = z
  .object({
    session_id: z.string(),
    agent: z.string().optional(),
    model: z.string().optional(),
    status: z.string().optional(),
    branch: z.string().optional(),
    worktree_path: z.string().optional(),
    started_at: z.string().optional(),
    last_active: z.string().optional(),
    turns: z.number().int().optional(),
    pending_turns: z.number().int().optional(),
    checkpoints: z.number().int().optional(),
    files_touched: z.array(z.string()).optional(),
  })
  .passthrough();
export type EntireSession = z.infer<typeof EntireSessionSchema>;

export const EntireProvenanceStatusSchema = z
  .object({
    available: z.boolean(),
    cli_version: z.string().nullable().optional(),
    enabled: z.boolean(),
    branch: z.string().nullable().optional(),
    active_sessions_count: z.number().int().nonnegative(),
    checkpoints_count: z.number().int().nonnegative(),
    error: z.string().nullable().optional(),
  })
  .strict();
export type EntireProvenanceStatus = z.infer<typeof EntireProvenanceStatusSchema>;

export const EntireProvenanceReportSchema = z
  .object({
    status: EntireProvenanceStatusSchema,
    checkpoints: z.array(EntireCheckpointSchema),
    sessions: z.array(EntireSessionSchema),
  })
  .strict();
export type EntireProvenanceReport = z.infer<typeof EntireProvenanceReportSchema>;

// ==========================================
// 7. Phase 6: DevRelay Gateway & Session Registry Schemas
// ==========================================

export const DevRelayProfileSchema = z
  .object({
    username: z.string(),
    name: z.string().nullable().optional(),
    github_username: z.string().nullable().optional(),
    profile_image: z.string().nullable().optional(),
    joined_at: z.string().nullable().optional(),
    mlh_user_id: z.string().nullable().optional(),
  })
  .strict();
export type DevRelayProfile = z.infer<typeof DevRelayProfileSchema>;

export const DevRelayStatusSchema = z
  .object({
    available: z.boolean(),
    version: z.string().nullable().optional(),
    connected: z.boolean(),
    profile: DevRelayProfileSchema.nullable().optional(),
    skills_installed_count: z.number().int().nonnegative().optional(),
    error: z.string().nullable().optional(),
  })
  .strict();
export type DevRelayStatus = z.infer<typeof DevRelayStatusSchema>;

export const DevRelayAgentSessionSummarySchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    title: z.string(),
    slug: z.string().optional(),
    tool_name: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    messages_count: z.number().int().optional(),
    url: z.string().optional(),
  })
  .passthrough();
export type DevRelayAgentSessionSummary = z.infer<typeof DevRelayAgentSessionSummarySchema>;

export const DevRelayDoctorDiagnosticSchema = z
  .object({
    platform: z.string().optional(),
    binary_path: z.string().optional(),
    dev_connected: z.boolean(),
    mlh_connected: z.boolean(),
    skills_dirs: z.array(z.string()).optional(),
    issues_count: z.number().int().nonnegative().optional(),
  })
  .strict();
export type DevRelayDoctorDiagnostic = z.infer<typeof DevRelayDoctorDiagnosticSchema>;

export const DevRelayReportSchema = z
  .object({
    status: DevRelayStatusSchema,
    sessions: z.array(DevRelayAgentSessionSummarySchema),
    diagnostics: DevRelayDoctorDiagnosticSchema.nullable().optional(),
  })
  .strict();
export type DevRelayReport = z.infer<typeof DevRelayReportSchema>;
