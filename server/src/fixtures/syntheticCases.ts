import { Case, EvidenceRecord } from "@keys/contracts";
import { SYNTHETIC_ACCOUNTS } from "./syntheticAccounts.js";

/**
 * Standard audit records supporting the synthetic cases.
 */
export const SYNTHETIC_RECORDS: Record<string, EvidenceRecord> = {
  // Case demo 01 records
  rec_commit_4021: {
    record_id: "rec_commit_4021",
    type: "commit",
    ts: "2025-04-12T10:15:30.000Z",
    author_handle: "cmendez",
    assignee_handle: null,
    actor_account_id: "acc_deploy_key_881",
    content:
      "commit 8f92ab018442bc014aef72948c21a4f00123\nAuthor: Carlos Mendez <cmendez@internal.corp>\nDate: Sat Apr 12 10:15:30 2025 -0400\n\n    Add staging deploy key for automated night-build pipeline.\n    Signed-off-by: Carlos Mendez <cmendez@internal.corp>",
    structured: true,
  },
  rec_ticket_1092: {
    record_id: "rec_ticket_1092",
    type: "ticket",
    ts: "2025-04-10T14:22:00.000Z",
    author_handle: "cmendez",
    assignee_handle: "cmendez",
    actor_account_id: null,
    content:
      "TICKET-1092 [INFRA]: Provision Staging Deploy Credentials\n\nRequester: Carlos Mendez\nComponent: Nightly CI/CD\nDetails: Automated night-build deployment pipeline key for staging cluster.\nExpiration: Set to expire in 90 days.\nAudit Note: Keep key active until rollback window closes next sprint.",
    structured: false,
  },

  // Case demo 02 records
  rec_log_909: {
    record_id: "rec_log_909",
    type: "deploy_log",
    ts: "2024-11-03T08:15:00.000Z",
    author_handle: null,
    assignee_handle: null,
    actor_account_id: "acc_service_runner_404",
    content:
      "[SYSTEM DAEMON LOG 2024-11-03 08:15:00 UTC]\nService Runner Initialized.\nAutomated sync runner deployed with unmanaged token rotation.\nNamespace: cluster-mirror-sync.\nWarning: No engineering owner tagged in deployment manifest.",
    structured: false,
  },

  // Case demo 03 records
  rec_policy_301: {
    record_id: "rec_policy_301",
    type: "policy",
    ts: "2023-01-20T11:00:00.000Z",
    author_handle: "sec-ops",
    assignee_handle: "marcus",
    actor_account_id: "acc_backup_bot_112",
    content:
      "SECURITY POLICY AUDIT RECORD #301\nAsset ID: acc_backup_bot_112\nDesignated Maintainer: Marcus Vance <mvance@internal.corp>\nStatus: Backup sync daemon maintained by Marcus Vance.\nLast Access: Inactive for >200 days. Human owner remains active in organization directory.",
    structured: true,
  },

  // Case demo 04 records
  rec_ticket_8820: {
    record_id: "rec_ticket_8820",
    type: "ticket",
    ts: "2026-10-05T09:30:00.000Z",
    author_handle: "marcus",
    assignee_handle: "marcus",
    actor_account_id: "acc_temp_hotfix_990",
    content:
      "TICKET-8820 [URGENT SEV-2 HOTFIX]:\nAuthor: Marcus Vance\nSummary: Temporary hotfix key for emergency patch release. Revoke after deployment.\nDeployment Window: 24h. No TTL configured at provision time.",
    structured: false,
  },
};

/**
 * Standard synthetic cases dictionary with verified evidence claims and R1-R5 removed claims.
 */
export const SYNTHETIC_CASES: Record<string, Case> = {
  case_demo_01: {
    case_id: "case_demo_01",
    bundle_id: "bundle_synth_01",
    account_id: "acc_deploy_key_881",
    claims_accepted: [
      {
        kind: "owner",
        account_id: "acc_deploy_key_881",
        person_id: "person_carlos_mendez",
        record_id: "rec_commit_4021",
        quote: "Signed-off-by: Carlos Mendez <cmendez@internal.corp>",
        text: "Commit log indicates Carlos Mendez created and authored initial deployment key setup.",
      },
      {
        kind: "purpose",
        account_id: "acc_deploy_key_881",
        person_id: null,
        record_id: "rec_ticket_1092",
        quote: "Automated night-build deployment pipeline key for staging cluster",
        text: "Deployment key dedicated to staging nightly releases.",
      },
    ],
    claims_removed: [
      {
        kind: "owner",
        account_id: "acc_deploy_key_881",
        person_id: "person_unknown_99",
        record_id: "rec_commit_4021",
        quote: "Reviewed-by: unknown_contractor",
        text: "Contractor review attribution lacks supporting personnel record in directory.",
        reason_code: "R3",
      },
      {
        kind: "purpose",
        account_id: "acc_deploy_key_881",
        person_id: null,
        record_id: "rec_ticket_1092",
        quote: "safe to revoke immediately",
        text: "Rollback window note in TICKET-1092 directly contradicts immediate revocation recommendation.",
        reason_code: "R2",
      },
    ],
    owner_status: "verified",
    purpose_status: "verified",
    ghost_type: "LOST",
    model: "gemma3:4b",
    latency_ms: 124.5,
  },

  case_demo_02: {
    case_id: "case_demo_02",
    bundle_id: "bundle_synth_01",
    account_id: "acc_service_runner_404",
    claims_accepted: [
      {
        kind: "purpose",
        account_id: "acc_service_runner_404",
        person_id: null,
        record_id: "rec_log_909",
        quote: "Automated sync runner deployed with unmanaged token rotation.",
        text: "Service account running synchronization cron jobs across repository mirrors.",
      },
    ],
    claims_removed: [
      {
        kind: "owner",
        account_id: "acc_service_runner_404",
        person_id: "person_dev_lead",
        record_id: "rec_log_909",
        quote: "Dev lead: Alice",
        text: "Audit log does not confirm Alice as registered owner in active directory.",
        reason_code: "R1",
      },
    ],
    owner_status: "no_evidence",
    purpose_status: "supported",
    ghost_type: "FORGOTTEN",
    model: "gemma3:4b",
    latency_ms: 108.2,
  },

  case_demo_03: {
    case_id: "case_demo_03",
    bundle_id: "bundle_synth_01",
    account_id: "acc_backup_bot_112",
    claims_accepted: [
      {
        kind: "owner",
        account_id: "acc_backup_bot_112",
        person_id: "person_marcus_vance",
        record_id: "rec_policy_301",
        quote: "Backup sync daemon maintained by Marcus Vance.",
        text: "Marcus Vance is identified as the designated owner in engineering records.",
      },
      {
        kind: "purpose",
        account_id: "acc_backup_bot_112",
        person_id: null,
        record_id: "rec_policy_301",
        quote: "Backup sync daemon maintained by Marcus Vance.",
        text: "Configured for daily backups to secondary cloud archive.",
      },
    ],
    claims_removed: [],
    owner_status: "supported",
    purpose_status: "supported",
    ghost_type: "LONELY",
    model: "gemma3:4b",
    latency_ms: 95.8,
  },

  case_demo_04: {
    case_id: "case_demo_04",
    bundle_id: "bundle_synth_01",
    account_id: "acc_temp_hotfix_990",
    claims_accepted: [
      {
        kind: "purpose",
        account_id: "acc_temp_hotfix_990",
        person_id: null,
        record_id: "rec_ticket_8820",
        quote: "Temporary hotfix key for emergency patch release. Revoke after deployment.",
        text: "Provisioned for an emergency release with an unfulfilled promise of manual revocation.",
      },
    ],
    claims_removed: [],
    owner_status: "supported",
    purpose_status: "verified",
    ghost_type: "INNOCENT",
    model: "gemma3:4b",
    latency_ms: 115.0,
  },
};

// Generate deterministic cases and evidence records for all remaining accounts in SYNTHETIC_ACCOUNTS
for (const acc of SYNTHETIC_ACCOUNTS) {
  if (SYNTHETIC_CASES[acc.case_id]) continue;

  const recordId = `rec_${acc.account_id.replace(/^acc_/, "")}`;
  const recordContent = `AUDIT RECORD [${acc.account_id}]:\nType: ${acc.kind}\nCreated: ${acc.created_at}\nTags: ${acc.tags.join(", ")}\nAttribution: ${acc.primary_quote}\nPurpose: ${acc.purpose || "Operational daemon"}`;

  SYNTHETIC_RECORDS[recordId] = {
    record_id: recordId,
    type:
      acc.kind === "deploy_key"
        ? "commit"
        : acc.kind === "service_account"
          ? "deploy_log"
          : "ticket",
    ts: acc.created_at,
    author_handle: acc.owner_name ? acc.owner_name.toLowerCase().replace(/\s+/g, "_") : null,
    assignee_handle: null,
    actor_account_id: acc.account_id,
    content: recordContent,
    structured: true,
  };

  const claimsAccepted = [];
  if (acc.owner_status === "verified" || acc.owner_status === "supported") {
    claimsAccepted.push({
      kind: "owner" as const,
      account_id: acc.account_id,
      person_id: acc.owner_name
        ? `person_${acc.owner_name.toLowerCase().replace(/\s+/g, "_")}`
        : null,
      record_id: recordId,
      quote: acc.primary_quote,
      text: `Evidence citation confirms ${acc.owner_name || "author"} created this machine access.`,
    });
  }

  if (acc.purpose) {
    claimsAccepted.push({
      kind: "purpose" as const,
      account_id: acc.account_id,
      person_id: null,
      record_id: recordId,
      quote: acc.primary_quote,
      text: acc.purpose,
    });
  }

  const claimsRemoved = [];
  if (acc.ghost_type === "FORGOTTEN") {
    claimsRemoved.push({
      kind: "owner" as const,
      account_id: acc.account_id,
      person_id: null,
      record_id: recordId,
      quote: "unmanaged token",
      text: "Model proposed owner, but source audit records contain zero human signatures.",
      reason_code: "R1" as const,
    });
  }

  SYNTHETIC_CASES[acc.case_id] = {
    case_id: acc.case_id,
    bundle_id: "bundle_synth_01",
    account_id: acc.account_id,
    claims_accepted: claimsAccepted,
    claims_removed: claimsRemoved,
    owner_status: acc.owner_status,
    purpose_status: acc.purpose ? "verified" : "no_evidence",
    ghost_type: acc.ghost_type,
    model: "gemma3:4b",
    latency_ms: 110.0,
  };
}
