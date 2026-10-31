import {
  ArchiveAccount,
  Case,
  EvidenceRecord,
  Investigation,
  InvestigationFindings,
  UploadedFile,
} from "@keys/contracts";
import { SYNTHETIC_ACCOUNTS } from "./syntheticAccounts.js";
import { SYNTHETIC_CASES, SYNTHETIC_RECORDS } from "./syntheticCases.js";

export const DEMO_INVESTIGATION_ID = "inv_staging_2026_q1";

export const SYNTHETIC_DEMO_INVESTIGATION: Investigation = {
  investigation_id: DEMO_INVESTIGATION_ID,
  name: "Staging CI/CD Night-Build Audit",
  organization_id: "org_synth_staging",
  description: "Automated analysis of night-build deploy credentials and staging pipeline tickets.",
  status: "completed",
  created_at: "2026-10-28T14:30:00.000Z",
  updated_at: "2026-10-28T14:32:15.000Z",
  file_count: 2,
  record_count: 3,
  accounts_discovered_count: 2,
  bundle_id: "bundle_synth_01",
  is_demo: true,
  owner_id: null,
};

export const SYNTHETIC_DEMO_FILES: UploadedFile[] = [
  {
    file_id: "file_commit_logs",
    investigation_id: DEMO_INVESTIGATION_ID,
    filename: "staging-commits.log",
    size_bytes: 4096,
    extension: ".log",
    uploaded_at: "2026-10-28T14:30:10.000Z",
    status: "processed",
    records_extracted: 2,
  },
  {
    file_id: "file_tickets_json",
    investigation_id: DEMO_INVESTIGATION_ID,
    filename: "infra-tickets.json",
    size_bytes: 8192,
    extension: ".json",
    uploaded_at: "2026-10-28T14:30:15.000Z",
    status: "processed",
    records_extracted: 1,
  },
];

export const SYNTHETIC_DEMO_RECORDS: EvidenceRecord[] = [
  SYNTHETIC_RECORDS.rec_commit_4021,
  SYNTHETIC_RECORDS.rec_ticket_1092,
  SYNTHETIC_RECORDS.rec_log_909,
].filter((r): r is EvidenceRecord => Boolean(r));

const demoAccounts: ArchiveAccount[] = SYNTHETIC_ACCOUNTS.filter(
  (a) => a.account_id === "acc_deploy_key_881" || a.account_id === "acc_service_runner_404",
);

const demoCases: Case[] = [SYNTHETIC_CASES.case_demo_01, SYNTHETIC_CASES.case_demo_02].filter(
  (c): c is Case => Boolean(c),
);

export const SYNTHETIC_DEMO_FINDINGS: InvestigationFindings = {
  investigation: SYNTHETIC_DEMO_INVESTIGATION,
  files: SYNTHETIC_DEMO_FILES,
  records: SYNTHETIC_DEMO_RECORDS,
  discovered_accounts: demoAccounts,
  cases: demoCases,
  processing_summary: {
    total_records_processed: SYNTHETIC_DEMO_RECORDS.length,
    claims_verified_count: demoCases.reduce((sum, c) => sum + c.claims_accepted.length, 0),
    claims_quarantined_count: demoCases.reduce((sum, c) => sum + c.claims_removed.length, 0),
    evidence_status_counts: {
      verified: 1,
      supported: 0,
      conflicting: 0,
      no_evidence: 1,
    },
    ghost_type_counts: {
      LOST: 1,
      FORGOTTEN: 1,
      LONELY: 0,
      INNOCENT: 0,
    },
    model_extraction_status: "simulated",
  },
};
