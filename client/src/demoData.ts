import { Case, EvidenceRecord, Account } from "@keys/contracts";

export interface DemoChamberData {
  accounts: (Account & {
    ghost_type: string;
    owner_status: string;
    case_id: string;
    primary_quote: string;
  })[];
  cases: Record<string, Case>;
  records: Record<string, EvidenceRecord>;
}

export const SYNTHETIC_DEMO_DATA: DemoChamberData = {
  accounts: [
    {
      account_id: "acc_deploy_key_881",
      kind: "deploy_key",
      created_at: "2025-04-10T14:22:00.000Z",
      last_used_at: "2026-08-15T03:12:00.000Z",
      permissions: ["repo:write", "deployments:write"],
      tags: ["staging", "legacy", "nightly"],
      expires_at: null,
      ghost_type: "LOST",
      owner_status: "verified",
      case_id: "case_demo_01",
      primary_quote: "Signed-off-by: Carlos Mendez <cmendez@internal.corp>",
    },
    {
      account_id: "acc_service_runner_404",
      kind: "service_account",
      created_at: "2024-11-03T08:15:00.000Z",
      last_used_at: "2026-09-01T22:45:00.000Z",
      permissions: ["admin:org", "secrets:read"],
      tags: ["migration", "ci-bot"],
      expires_at: null,
      ghost_type: "FORGOTTEN",
      owner_status: "no_evidence",
      case_id: "case_demo_02",
      primary_quote: "Automated sync runner deployed with unmanaged token rotation.",
    },
    {
      account_id: "acc_backup_bot_112",
      kind: "bot",
      created_at: "2023-01-20T11:00:00.000Z",
      last_used_at: "2026-02-14T01:00:00.000Z",
      permissions: ["repo:read", "packages:read"],
      tags: ["backup", "cron", "s3"],
      expires_at: null,
      ghost_type: "LONELY",
      owner_status: "supported",
      case_id: "case_demo_03",
      primary_quote: "Backup sync daemon maintained by Marcus Vance.",
    },
    {
      account_id: "acc_temp_hotfix_990",
      kind: "deploy_key",
      created_at: "2026-10-05T09:30:00.000Z",
      last_used_at: "2026-10-06T18:00:00.000Z",
      permissions: ["repo:write"],
      tags: ["temp", "incident-hotfix", "unmanaged"],
      expires_at: null,
      ghost_type: "INNOCENT",
      owner_status: "supported",
      case_id: "case_demo_04",
      primary_quote: "Temporary hotfix key for emergency patch release. Revoke after deployment.",
    },
  ],
  cases: {
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
          text: "Contractor review claim",
          reason_code: "R3",
        },
        {
          kind: "purpose",
          account_id: "acc_deploy_key_881",
          person_id: null,
          record_id: "rec_ticket_1092",
          quote: "safe to revoke immediately",
          text: "Rollback window note contradicts immediate revocation recommendation.",
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
          text: "No record confirms Alice as registered owner in active directory.",
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
  },
  records: {
    rec_commit_4021: {
      record_id: "rec_commit_4021",
      type: "commit",
      ts: "2025-04-12T10:15:30.000Z",
      author_handle: "cmendez",
      assignee_handle: null,
      actor_account_id: "acc_deploy_key_881",
      content:
        "commit 8f92ab01\nAuthor: Carlos Mendez <cmendez@internal.corp>\nDate: Sat Apr 12 10:15:30 2025\n\nAdd staging deploy key.\nSigned-off-by: Carlos Mendez <cmendez@internal.corp>",
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
        "TICKET-1092: Provision Staging Deploy Credentials\nAutomated night-build deployment pipeline key for staging cluster. Expire in 90 days. Keep key active until rollback window closes next sprint.",
      structured: false,
    },
    rec_log_909: {
      record_id: "rec_log_909",
      type: "deploy_log",
      ts: "2024-11-03T08:15:00.000Z",
      author_handle: null,
      assignee_handle: null,
      actor_account_id: "acc_service_runner_404",
      content:
        "[SYSTEM DAEMON LOG]\nAutomated sync runner deployed with unmanaged token rotation.\nAssigned to cluster-wide namespace without personal identity metadata.",
      structured: false,
    },
    rec_policy_301: {
      record_id: "rec_policy_301",
      type: "policy",
      ts: "2023-01-20T11:00:00.000Z",
      author_handle: "sec-ops",
      assignee_handle: "marcus",
      actor_account_id: "acc_backup_bot_112",
      content:
        "POLICY AUDIT #301:\nBackup sync daemon maintained by Marcus Vance.\nStatus: Owner active in HR directory, but credential silent for over 200 days.",
      structured: true,
    },
    rec_ticket_8820: {
      record_id: "rec_ticket_8820",
      type: "ticket",
      ts: "2026-10-05T09:30:00.000Z",
      author_handle: "marcus",
      assignee_handle: "marcus",
      actor_account_id: "acc_temp_hotfix_990",
      content:
        "TICKET-8820 [URGENT HOTFIX]:\nTemporary hotfix key for emergency patch release. Revoke after deployment.\nCreated without TTL expiration timestamp.",
      structured: false,
    },
  },
};
