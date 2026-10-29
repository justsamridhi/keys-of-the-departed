import { Case, EvidenceRecord } from "@keys/contracts";

export const MOCK_DEMO_CASE: Case = {
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
  ],
  owner_status: "verified",
  purpose_status: "verified",
  ghost_type: "LOST",
  model: "gemma3:4b",
  latency_ms: 124.5,
};

export const MOCK_DEMO_RECORDS: EvidenceRecord[] = [
  {
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
  {
    record_id: "rec_ticket_1092",
    type: "ticket",
    ts: "2025-04-10T14:22:00.000Z",
    author_handle: "cmendez",
    assignee_handle: "cmendez",
    actor_account_id: null,
    content:
      "TICKET-1092: Provision Staging Deploy Credentials\nAutomated night-build deployment pipeline key for staging cluster. Expire in 90 days.",
    structured: false,
  },
];
