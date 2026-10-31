import React, { useState, useEffect, useRef } from "react";
import {
  CreateInvestigationSchema,
  Investigation,
  InvestigationFindings,
  SingleFileInput,
  ApprovalRequest,
} from "@keys/contracts";
import { useAuth } from "../auth/AuthProvider.js";
import { useApiClient } from "../auth/apiClient.js";

export interface NewInvestigationPageProps {
  investigationId?: string;
  onRouteChange: (route: string, params?: Record<string, string>) => void;
}

export type EvidenceCategory =
  | "identity_inventory"
  | "iam_policy"
  | "personnel_directory"
  | "repo_commits"
  | "deployment_logs"
  | "engineering_tickets";

export const EVIDENCE_CATEGORY_META: Record<
  EvidenceCategory,
  { label: string; description: string; expectedFormats: string }
> = {
  identity_inventory: {
    label: "Machine Identity Inventory",
    description: "Known deploy keys, service accounts, and machine identities.",
    expectedFormats: "JSON array of accounts or CSV with account_id, kind, permissions",
  },
  iam_policy: {
    label: "IAM Policies & Permissions",
    description: "Policy documents, role definitions, and access privileges.",
    expectedFormats: "JSON/YAML policy definitions or log statements",
  },
  personnel_directory: {
    label: "Personnel & Directory Records",
    description: "Employee and contractor status, handles, and departure timestamps.",
    expectedFormats: "JSON or CSV with person_id, display_name, handles, status",
  },
  repo_commits: {
    label: "Repository Commits",
    description: "Git commit messages, author signatures, and commit SHAs.",
    expectedFormats: "git log format (.log, .txt) or JSON commit records",
  },
  deployment_logs: {
    label: "Deployment & CI/CD Logs",
    description: "Pipeline deployment executions, daemon starts, and machine actions.",
    expectedFormats: "CI/CD execution logs (.log, .txt) or JSON deployment records",
  },
  engineering_tickets: {
    label: "Engineering Tickets & Projects",
    description: "Jira / Linear issue records authorizing service credentials.",
    expectedFormats: "JSON array of issues or CSV with ticket_id, author, summary",
  },
};

export function detectFileEvidenceCategory(
  filename: string,
  contentPreview: string,
): EvidenceCategory {
  const lowerName = filename.toLowerCase();
  const lowerContent = contentPreview.toLowerCase();

  if (
    lowerName.includes("commit") ||
    lowerContent.includes("commit ") ||
    lowerContent.includes("signed-off-by:")
  ) {
    return "repo_commits";
  }
  if (
    lowerName.includes("ticket") ||
    lowerName.includes("jira") ||
    lowerName.includes("issue") ||
    lowerContent.includes("ticket-")
  ) {
    return "engineering_tickets";
  }
  if (
    lowerName.includes("policy") ||
    lowerName.includes("iam") ||
    lowerName.includes("permission") ||
    lowerContent.includes('"statement"') ||
    lowerContent.includes('"effect":')
  ) {
    return "iam_policy";
  }
  if (
    lowerName.includes("person") ||
    lowerName.includes("directory") ||
    lowerName.includes("employee") ||
    lowerName.includes("hr") ||
    lowerContent.includes("departed_at") ||
    lowerContent.includes("display_name")
  ) {
    return "personnel_directory";
  }
  if (
    lowerName.includes("deploy") ||
    lowerName.includes("pipeline") ||
    lowerName.includes("ci") ||
    lowerName.includes("build") ||
    lowerContent.includes("[system") ||
    lowerContent.includes("build #")
  ) {
    return "deployment_logs";
  }
  return "identity_inventory";
}

export interface StagedFile {
  file: File;
  id: string;
  category: EvidenceCategory;
  recordEstimate: number;
  status: "valid" | "warning" | "error";
  errorMessage?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTS = [".json", ".jsonl", ".ndjson", ".log", ".txt", ".csv"];

export const NewInvestigationPage: React.FC<NewInvestigationPageProps> = ({
  investigationId: initialInvId,
  onRouteChange,
}) => {
  const { isAuthenticated } = useAuth();
  const api = useApiClient();

  // 5 Step Workflow: details -> upload -> config -> validate -> processing -> results
  const [currentStep, setCurrentStep] = useState<
    "details" | "upload" | "config" | "validate" | "processing" | "results"
  >(initialInvId ? "results" : "details");

  // Step 1: Investigation Details
  const [name, setName] = useState<string>("");
  const [organizationId, setOrganizationId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [formErrors, setFormErrors] = useState<{ name?: string; organizationId?: string }>({});

  // Step 2: Uploaded Files State
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<Array<{ name: string; reason: string }>>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showSchemasModal, setShowSchemasModal] = useState<boolean>(false);

  // Step 3: Investigation Configuration
  const [inactivityDays, setInactivityDays] = useState<number>(90);
  const [enabledCategories, setEnabledCategories] = useState<Record<EvidenceCategory, boolean>>({
    identity_inventory: true,
    iam_policy: true,
    personnel_directory: true,
    repo_commits: true,
    deployment_logs: true,
    engineering_tickets: true,
  });

  // Active Investigation & Findings
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [findings, setFindings] = useState<InvestigationFindings | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Phase 4: Human Approval & Sandbox Remediation State
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState<boolean>(false);
  const [approvalActionError, setApprovalActionError] = useState<string | null>(null);
  const [proposingForAccount, setProposingForAccount] = useState<string | null>(null);
  const [proposedAction, setProposedAction] = useState<
    "simulate_revoke_deploy_key" | "simulate_disable_service_account" | "simulate_quarantine_token"
  >("simulate_revoke_deploy_key");
  const [proposedReason, setProposedReason] = useState<string>("");
  const [confirmingApproval, setConfirmingApproval] = useState<ApprovalRequest | null>(null);
  const [rejectingApproval, setRejectingApproval] = useState<ApprovalRequest | null>(null);
  const [decisionReason, setDecisionReason] = useState<string>("");
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadApprovals = async (invId: string) => {
    try {
      setLoadingApprovals(true);
      const list = await api.listApprovalRequests(invId);
      setApprovals(list);
    } catch (err: unknown) {
      console.warn("Could not load approvals:", err);
    } finally {
      setLoadingApprovals(false);
    }
  };

  const handleProposeRemediation = async (accountId: string) => {
    if (!investigation) return;
    try {
      setApprovalActionError(null);
      await api.createApprovalRequest(investigation.investigation_id, {
        account_id: accountId,
        proposed_action: proposedAction,
        reason: proposedReason.trim() || undefined,
      });
      setProposingForAccount(null);
      setProposedReason("");
      await loadApprovals(investigation.investigation_id);
    } catch (err: unknown) {
      setApprovalActionError(err instanceof Error ? err.message : "Failed to propose remediation");
    }
  };

  const handleDecideApproval = async (
    requestId: string,
    decision: "approved" | "rejected",
    reason?: string,
  ) => {
    if (!investigation) return;
    try {
      setIsSubmittingDecision(true);
      setApprovalActionError(null);
      await api.decideApprovalRequest(investigation.investigation_id, requestId, {
        decision,
        reason: reason?.trim() || undefined,
      });
      setConfirmingApproval(null);
      setRejectingApproval(null);
      setDecisionReason("");
      await loadApprovals(investigation.investigation_id);
    } catch (err: unknown) {
      setApprovalActionError(err instanceof Error ? err.message : "Failed to record decision");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Load existing findings if opened with ID
  useEffect(() => {
    if (initialInvId) {
      loadApprovals(initialInvId);
      api
        .getInvestigationFindings(initialInvId)
        .then((data) => {
          setFindings(data);
          setInvestigation(data.investigation);
          setCurrentStep("results");
        })
        .catch(async () => {
          try {
            const inv = await api.getInvestigation(initialInvId);
            setInvestigation(inv);
            setCurrentStep(inv.status === "completed" ? "results" : "upload");
          } catch (invErr: unknown) {
            const msg = invErr instanceof Error ? invErr.message : "Failed to load investigation";
            setProcessingError(msg);
          }
        });
    }
  }, [initialInvId]);

  // Step 1 Submission: Validate details and create investigation record
  const handleProceedToUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    if (!name.trim()) {
      setFormErrors({ name: "Investigation name is required." });
      return;
    }

    if (!isAuthenticated) {
      setUploadError("Authentication required: Please sign in to initiate an investigation.");
      onRouteChange("signin");
      return;
    }

    const payload = {
      name: name.trim(),
      organization_id: organizationId.trim() || undefined,
      description: description.trim(),
    };

    const parseResult = CreateInvestigationSchema.safeParse(payload);
    if (!parseResult.success) {
      const errs: { name?: string } = {};
      parseResult.error.issues.forEach((i) => {
        if (i.path[0] === "name") errs.name = i.message;
      });
      setFormErrors(errs);
      return;
    }

    try {
      setUploadError(null);
      const created = await api.createInvestigation(payload);
      setInvestigation(created);
      setCurrentStep("upload");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Investigation creation failed.";
      setUploadError(msg);
    }
  };

  // Step 2: Handle adding files with pre-flight inspection
  const handleFilesAdded = async (files: FileList | null) => {
    if (!files) return;
    setUploadError(null);

    const newStaged: StagedFile[] = [];
    const newRejected: Array<{ name: string; reason: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = "." + f.name.split(".").pop()?.toLowerCase();

      if (!ALLOWED_EXTS.includes(ext)) {
        newRejected.push({
          name: f.name,
          reason: `Unsupported format (${ext}). Allowed: .json, .csv, .jsonl, .ndjson, .log, .txt`,
        });
        continue;
      }

      if (f.size === 0) {
        newRejected.push({ name: f.name, reason: "File is empty (0 bytes)." });
        continue;
      }

      if (f.size > MAX_FILE_SIZE) {
        newRejected.push({
          name: f.name,
          reason: `File size (${(f.size / (1024 * 1024)).toFixed(2)} MB) exceeds 5MB limit.`,
        });
        continue;
      }

      // Check duplicates
      if (stagedFiles.some((item) => item.file.name === f.name)) {
        newRejected.push({ name: f.name, reason: "File already selected." });
        continue;
      }

      // Read text preview for category detection and validation
      try {
        const text = await f.text();
        const category = detectFileEvidenceCategory(f.name, text.slice(0, 1000));
        let recordEstimate = 1;
        let status: "valid" | "warning" | "error" = "valid";
        let errorMessage: string | undefined;

        if (ext === ".json") {
          try {
            const parsed = JSON.parse(text) as unknown;
            const recordsField =
              typeof parsed === "object" && parsed !== null && "records" in parsed
                ? (parsed as { records: unknown }).records
                : null;
            recordEstimate = Array.isArray(parsed)
              ? parsed.length
              : Array.isArray(recordsField)
                ? recordsField.length
                : 1;
          } catch {
            status = "error";
            errorMessage = "Invalid JSON syntax.";
          }
        } else if (ext === ".csv") {
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length < 2) {
            status = "error";
            errorMessage = "CSV must contain header and at least one data row.";
          } else {
            recordEstimate = lines.length - 1;
          }
        } else if (ext === ".jsonl" || ext === ".ndjson") {
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          recordEstimate = lines.length;
        } else {
          const chunks = text
            .split(/(?=commit\s+[a-f0-9]{7,}|TICKET-[0-9]+|\[SYSTEM|\bAUDIT RECORD\b)/i)
            .filter((c) => c.trim().length > 0);
          recordEstimate = Math.max(1, chunks.length);
        }

        newStaged.push({
          file: f,
          id: `${f.name}-${Date.now()}-${i}`,
          category,
          recordEstimate,
          status,
          errorMessage,
        });
      } catch (err: unknown) {
        newRejected.push({
          name: f.name,
          reason: err instanceof Error ? err.message : "Failed to inspect file.",
        });
      }
    }

    setStagedFiles((prev) => [...prev, ...newStaged]);
    if (newRejected.length > 0) {
      setRejectedFiles((prev) => [...prev, ...newRejected]);
    }
  };

  const handleRemoveFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  // Helper to load standard sample demonstration bundle
  const handleLoadSampleBundle = () => {
    const sampleCommit = new File(
      [
        `commit 8f92ab018442bc014aef72948c21a4f00123\nAuthor: Carlos Mendez <cmendez@internal.corp>\nDate: Sat Apr 12 10:15:30 2025 -0400\n\n    Add staging deploy key acc_deploy_key_881 for automated night-build pipeline.\n    Signed-off-by: Carlos Mendez <cmendez@internal.corp>\n`,
      ],
      "staging-commits.log",
      { type: "text/plain" },
    );

    const sampleTicket = new File(
      [
        JSON.stringify(
          [
            {
              record_id: "rec_ticket_1092",
              type: "ticket",
              ts: "2025-04-10T14:22:00.000Z",
              author_handle: "cmendez",
              actor_account_id: "acc_deploy_key_881",
              content:
                "TICKET-1092 [INFRA]: Automated night-build deployment pipeline key for staging cluster. Expiration: 90 days.",
              structured: true,
            },
            {
              record_id: "rec_log_909",
              type: "deploy_log",
              ts: "2024-11-03T08:15:00.000Z",
              actor_account_id: "acc_service_runner_404",
              content:
                "[SYSTEM DAEMON] Automated sync runner deployed with unmanaged token rotation for acc_service_runner_404.",
              structured: false,
            },
          ],
          null,
          2,
        ),
      ],
      "infra-audit.json",
      { type: "application/json" },
    );

    const sampleCsv = new File(
      [
        `account_id,kind,permissions,tags,last_used_at\nacc_deploy_key_881,deploy_key,"repo:write,deploy:staging","ci,nightly",2025-04-12T10:15:30Z\nacc_service_runner_404,service_account,"cluster:admin,vault:read","daemon,sync",2024-11-03T08:15:00Z\n`,
      ],
      "machine-identities.csv",
      { type: "text/csv" },
    );

    handleFilesAdded([sampleCommit, sampleTicket, sampleCsv] as unknown as FileList);
  };

  // Step 4 to 5: Upload Files and Execute Backend Processing
  const handleExecuteProcessing = async () => {
    if (!investigation) return;

    const validFiles = stagedFiles.filter((f) => f.status !== "error");
    if (validFiles.length === 0) {
      setUploadError("Please upload at least one valid evidence file before processing.");
      return;
    }

    setCurrentStep("processing");
    setUploadError(null);
    setProcessingError(null);

    try {
      // Prepare payload
      const filesPayload: SingleFileInput[] = await Promise.all(
        validFiles.map(async ({ file }) => {
          const content = await file.text();
          return {
            filename: file.name,
            content,
            size_bytes: file.size,
          };
        }),
      );

      // 1. Upload files to investigation
      await api.uploadFiles(investigation.investigation_id, filesPayload);

      // 2. Trigger processing pipeline
      const completedFindings = await api.processInvestigation(investigation.investigation_id);
      setFindings(completedFindings);
      setInvestigation(completedFindings.investigation);
      setCurrentStep("results");
      loadApprovals(completedFindings.investigation.investigation_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Processing failed.";
      setProcessingError(msg);
      setCurrentStep("validate");
    }
  };

  // Calculations for Summary
  const validFilesCount = stagedFiles.filter((f) => f.status !== "error").length;
  const totalEstimatedRecords = stagedFiles
    .filter((f) => f.status !== "error")
    .reduce((sum, f) => sum + f.recordEstimate, 0);

  const availableCategories = Array.from(
    new Set(stagedFiles.filter((f) => f.status !== "error").map((f) => f.category)),
  );

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "1280px", margin: "40px auto 80px", padding: "0 clamp(16px, 3vw, 32px)" }}
    >
      {/* Navigation Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "28px",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <button
          type="button"
          onClick={() => onRouteChange("dashboard")}
          className="btn ghost small"
          style={{ padding: "6px 12px", fontSize: "11px" }}
        >
          ← Return to Dashboard
        </button>

        {/* Step Indicator Progress Bar */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          {[
            { id: "details", label: "1. DETAILS" },
            { id: "upload", label: "2. EVIDENCE" },
            { id: "config", label: "3. CONFIG" },
            { id: "validate", label: "4. VALIDATE" },
            { id: "results", label: "5. RESULTS" },
          ].map((s) => {
            const isActive = currentStep === s.id;
            return (
              <span
                key={s.id}
                className={`tag ${isActive ? "gold" : "gray"}`}
                style={{ fontSize: "10.5px" }}
              >
                {s.label}
              </span>
            );
          })}
        </div>
      </div>

      {uploadError && (
        <div
          role="alert"
          style={{
            padding: "14px 18px",
            background: "rgba(109,23,27,0.3)",
            border: "1px solid var(--crimson2)",
            borderRadius: "4px",
            color: "#f0b9ad",
            marginBottom: "24px",
            fontSize: "13px",
          }}
        >
          <strong>Notice:</strong> {uploadError}
        </div>
      )}

      {processingError && (
        <div
          role="alert"
          style={{
            padding: "14px 18px",
            background: "rgba(109,23,27,0.3)",
            border: "1px solid var(--crimson2)",
            borderRadius: "4px",
            color: "#f0b9ad",
            marginBottom: "24px",
            fontSize: "13px",
          }}
        >
          <strong>Processing Error:</strong> {processingError}
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 1: INVESTIGATION DETAILS                            */}
      {/* ======================================================== */}
      {currentStep === "details" && (
        <div className="panel" style={{ padding: "40px", maxWidth: "680px", margin: "0 auto" }}>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
            STEP 1 OF 5 · INVESTIGATION INITIATION
          </div>
          <h1
            className="display"
            style={{ fontSize: "28px", color: "var(--cream)", margin: "0 0 12px" }}
          >
            Start New Machine Identity Investigation
          </h1>
          <p
            className="serif"
            style={{
              fontSize: "15.5px",
              color: "#c7b591",
              fontStyle: "italic",
              marginBottom: "28px",
              lineHeight: 1.55,
            }}
          >
            Specify an investigation scope to group uploaded engineering logs, CI/CD credentials,
            and machine identity dossiers.
          </p>

          <form onSubmit={handleProceedToUpload}>
            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="inv-name"
                style={{
                  display: "block",
                  fontFamily: "var(--display)",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  color: "var(--gold2)",
                  marginBottom: "8px",
                }}
              >
                INVESTIGATION NAME *
              </label>
              <input
                id="inv-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q1 Staging Infrastructure & Deploy Key Audit"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "rgba(10, 8, 12, 0.8)",
                  border: formErrors.name
                    ? "1px solid var(--crimson2)"
                    : "1px solid rgba(197, 160, 89, 0.4)",
                  color: "#f7ebd2",
                  borderRadius: "3px",
                  fontSize: "14px",
                }}
              />
              {formErrors.name && (
                <div style={{ color: "var(--crimson2)", fontSize: "12px", marginTop: "6px" }}>
                  {formErrors.name}
                </div>
              )}
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="inv-org"
                style={{
                  display: "block",
                  fontFamily: "var(--display)",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  color: "var(--gold2)",
                  marginBottom: "8px",
                }}
              >
                ORGANIZATION OR PROJECT IDENTIFIER (OPTIONAL)
              </label>
              <input
                id="inv-org"
                type="text"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                placeholder="e.g. corp-infra-platform"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "rgba(10, 8, 12, 0.8)",
                  border: "1px solid rgba(197, 160, 89, 0.4)",
                  color: "#f7ebd2",
                  borderRadius: "3px",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="inv-desc"
                style={{
                  display: "block",
                  fontFamily: "var(--display)",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  color: "var(--gold2)",
                  marginBottom: "8px",
                }}
              >
                DESCRIPTION (OPTIONAL)
              </label>
              <textarea
                id="inv-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Targeted clusters, incident reference, or depart-employee access review..."
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "rgba(10, 8, 12, 0.8)",
                  border: "1px solid rgba(197, 160, 89, 0.4)",
                  color: "#f7ebd2",
                  borderRadius: "3px",
                  fontSize: "13px",
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "28px",
              }}
            >
              <div>
                <label
                  htmlFor="inv-date-start"
                  style={{
                    display: "block",
                    fontFamily: "var(--display)",
                    fontSize: "10px",
                    letterSpacing: "0.08em",
                    color: "var(--gold2)",
                    marginBottom: "6px",
                  }}
                >
                  AUDIT DATE RANGE START (OPTIONAL)
                </label>
                <input
                  id="inv-date-start"
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "rgba(10, 8, 12, 0.8)",
                    border: "1px solid rgba(197, 160, 89, 0.4)",
                    color: "#f7ebd2",
                    borderRadius: "3px",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="inv-date-end"
                  style={{
                    display: "block",
                    fontFamily: "var(--display)",
                    fontSize: "10px",
                    letterSpacing: "0.08em",
                    color: "var(--gold2)",
                    marginBottom: "6px",
                  }}
                >
                  AUDIT DATE RANGE END (OPTIONAL)
                </label>
                <input
                  id="inv-date-end"
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "rgba(10, 8, 12, 0.8)",
                    border: "1px solid rgba(197, 160, 89, 0.4)",
                    color: "#f7ebd2",
                    borderRadius: "3px",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              id="btn-proceed-to-upload"
              className="btn"
              style={{ width: "100%", padding: "14px", fontSize: "12px", letterSpacing: "0.1em" }}
            >
              Continue to Evidence Upload →
            </button>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 2: EVIDENCE UPLOAD                                  */}
      {/* ======================================================== */}
      {currentStep === "upload" && investigation && (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <div className="panel" style={{ padding: "32px", borderLeft: "4px solid var(--gold)" }}>
            <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "6px" }}>
              STEP 2 OF 5 · EVIDENCE INTAKE PORTAL
            </div>
            <h2
              className="display"
              style={{ fontSize: "24px", color: "var(--cream)", margin: "0 0 8px" }}
            >
              Upload Engineering Records for: {investigation.name}
            </h2>
            <div className="mono" style={{ fontSize: "12px", color: "var(--muted)" }}>
              INVESTIGATION ID: {investigation.investigation_id}
              {investigation.organization_id ? ` ✦ ORG: ${investigation.organization_id}` : ""}
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handleFilesAdded(e.dataTransfer.files);
            }}
            style={{
              padding: "44px 24px",
              textAlign: "center",
              border: isDragOver ? "2px dashed var(--gold2)" : "2px dashed var(--line)",
              background: isDragOver ? "rgba(197, 160, 89, 0.12)" : "rgba(18, 14, 20, 0.8)",
              borderRadius: "4px",
              transition: "all 0.2s ease",
            }}
          >
            <img
              src="/goldenbook.png"
              alt="Intake Records"
              style={{
                width: "64px",
                height: "64px",
                objectFit: "contain",
                margin: "0 auto 14px",
                opacity: 0.9,
              }}
            />
            <h3
              className="display"
              style={{ fontSize: "19px", color: "var(--gold2)", margin: "0 0 8px" }}
            >
              Drag &amp; Drop Engineering Records Here
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "var(--muted)",
                maxWidth: "560px",
                margin: "0 auto 18px",
                lineHeight: 1.5,
              }}
            >
              Upload structured bundles in <strong>JSON</strong>, <strong>CSV</strong>,{" "}
              <strong>JSONL</strong>, or <strong>raw audit logs</strong>. Max 5MB per file.
            </p>

            <div
              style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".json,.jsonl,.ndjson,.log,.txt,.csv"
                style={{ display: "none" }}
                onChange={(e) => handleFilesAdded(e.target.files)}
              />
              <button
                type="button"
                id="btn-browse-files"
                onClick={() => fileInputRef.current?.click()}
                className="btn small"
              >
                Browse Files
              </button>
              <button
                type="button"
                id="btn-load-sample-logs"
                onClick={handleLoadSampleBundle}
                className="btn secondary small"
              >
                + Load Sample Bundle (Logs &amp; CSV)
              </button>
              <button
                type="button"
                id="btn-view-schemas"
                onClick={() => setShowSchemasModal(true)}
                className="btn ghost small"
              >
                View Expected Schemas
              </button>
            </div>
          </div>

          {/* Rejected Files Alert */}
          {rejectedFiles.length > 0 && (
            <div
              style={{
                padding: "16px 20px",
                background: "rgba(109,23,27,0.25)",
                border: "1px solid var(--crimson2)",
                borderRadius: "4px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <strong style={{ color: "#f0b9ad", fontSize: "13px" }}>
                  Rejected Files ({rejectedFiles.length})
                </strong>
                <button
                  type="button"
                  onClick={() => setRejectedFiles([])}
                  className="btn ghost small"
                  style={{ fontSize: "10px", padding: "2px 6px" }}
                >
                  Dismiss
                </button>
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#e8c5be" }}>
                {rejectedFiles.map((rf, rfid) => (
                  <li key={rfid}>
                    <strong>{rf.name}</strong>: {rf.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Staged Files List */}
          {stagedFiles.length > 0 ? (
            <div className="panel" style={{ padding: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div className="eyebrow" style={{ color: "var(--gold)" }}>
                  STAGED EVIDENCE FILES ({stagedFiles.length})
                </div>
                <span className="mono" style={{ fontSize: "11px", color: "var(--gold2)" }}>
                  Total Estimated Records: {totalEstimatedRecords}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {stagedFiles.map((item) => {
                  const meta = EVIDENCE_CATEGORY_META[item.category];
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "rgba(0,0,0,0.35)",
                        borderRadius: "3px",
                        borderLeft:
                          item.status === "error"
                            ? "3px solid var(--crimson2)"
                            : "3px solid var(--gold)",
                        gap: "14px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: "200px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 600, color: "#f7ebd2", fontSize: "13.5px" }}>
                            {item.file.name}
                          </span>
                          <span
                            className={`tag ${item.status === "error" ? "red" : item.status === "warning" ? "gold" : "green"}`}
                            style={{ fontSize: "10px" }}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                          Size: {(item.file.size / 1024).toFixed(1)} KB ✦ Detected:{" "}
                          <strong>{meta.label}</strong>
                          {item.recordEstimate > 0 ? ` ✦ ~${item.recordEstimate} records` : ""}
                        </div>
                        {item.errorMessage && (
                          <div
                            style={{
                              color: "var(--crimson2)",
                              fontSize: "11.5px",
                              marginTop: "4px",
                            }}
                          >
                            {item.errorMessage}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(item.id)}
                        className="btn ghost small"
                        style={{ color: "var(--crimson2)", fontSize: "11px" }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: "24px",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  id="btn-proceed-to-config"
                  onClick={() => setCurrentStep("config")}
                  disabled={validFilesCount === 0}
                  className="btn"
                  style={{ padding: "12px 28px", fontSize: "12px" }}
                >
                  Configure Investigation Scope →
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              No files staged yet. Add files above or load the sample demonstration bundle to
              continue.
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 3: CONFIGURATION                                    */}
      {/* ======================================================== */}
      {currentStep === "config" && (
        <div className="panel" style={{ padding: "40px", maxWidth: "780px", margin: "0 auto" }}>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
            STEP 3 OF 5 · INVESTIGATION CONFIGURATION
          </div>
          <h2
            className="display"
            style={{ fontSize: "24px", color: "var(--cream)", margin: "0 0 10px" }}
          >
            Configure Analysis Parameters
          </h2>
          <p
            className="serif"
            style={{
              fontSize: "15px",
              color: "#c7b591",
              fontStyle: "italic",
              marginBottom: "28px",
              lineHeight: 1.5,
            }}
          >
            Customize detection heuristics. Only parameters supported by the deterministic verifier
            and activity models are presented here.
          </p>

          <div style={{ marginBottom: "28px" }}>
            <label
              htmlFor="cfg-inactivity"
              style={{
                display: "block",
                fontFamily: "var(--display)",
                fontSize: "11px",
                letterSpacing: "0.08em",
                color: "var(--gold2)",
                marginBottom: "6px",
              }}
            >
              INACTIVITY THRESHOLD (DAYS)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <input
                id="cfg-inactivity"
                type="number"
                min={1}
                max={365}
                value={inactivityDays}
                onChange={(e) => setInactivityDays(Number(e.target.value) || 90)}
                style={{
                  width: "120px",
                  padding: "10px 14px",
                  background: "rgba(10, 8, 12, 0.8)",
                  border: "1px solid rgba(197, 160, 89, 0.4)",
                  color: "#f7ebd2",
                  borderRadius: "3px",
                  fontSize: "14px",
                }}
              />
              <span style={{ fontSize: "12.5px", color: "#c8b994" }}>
                Default: <strong>90 days</strong>. Machine identities with no recorded activity
                exceeding this threshold are flagged as <em>Lonely / Inactive Keys</em>.
              </span>
            </div>
          </div>

          <div style={{ marginBottom: "28px" }}>
            <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "10px" }}>
              EVIDENCE CATEGORIES INCLUDED
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {(Object.keys(EVIDENCE_CATEGORY_META) as EvidenceCategory[]).map((catKey) => {
                const meta = EVIDENCE_CATEGORY_META[catKey];
                const isChecked = enabledCategories[catKey];
                return (
                  <label
                    key={catKey}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "10px 14px",
                      background: isChecked ? "rgba(197, 160, 89, 0.1)" : "rgba(0, 0, 0, 0.2)",
                      border: `1px solid ${isChecked ? "var(--gold)" : "var(--line)"}`,
                      borderRadius: "3px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        setEnabledCategories((prev) => ({ ...prev, [catKey]: e.target.checked }))
                      }
                      style={{ marginTop: "3px" }}
                    />
                    <div>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#f7ebd2" }}>
                        {meta.label}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                        {meta.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "32px",
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentStep("upload")}
              className="btn secondary small"
            >
              ← Back to Upload
            </button>
            <button
              type="button"
              id="btn-proceed-to-validate"
              onClick={() => setCurrentStep("validate")}
              className="btn"
              style={{ padding: "12px 28px", fontSize: "12px" }}
            >
              Review Pre-Flight Summary →
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 4: PRE-FLIGHT VALIDATION & SUMMARY                  */}
      {/* ======================================================== */}
      {currentStep === "validate" && (
        <div className="panel" style={{ padding: "40px", maxWidth: "820px", margin: "0 auto" }}>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
            STEP 4 OF 5 · PRE-FLIGHT AUDIT VALIDATION
          </div>
          <h2
            className="display"
            style={{ fontSize: "24px", color: "var(--cream)", margin: "0 0 10px" }}
          >
            Validate Staged Evidence Bundle
          </h2>
          <p
            className="serif"
            style={{
              fontSize: "15px",
              color: "#c7b591",
              fontStyle: "italic",
              marginBottom: "26px",
            }}
          >
            Verify that your evidence bundle is complete and meets strict verification requirements
            before running the audit.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                padding: "16px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: "3px",
                borderLeft: "3px solid var(--gold)",
              }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "var(--gold)" }}>
                STAGED FILES
              </div>
              <div
                className="mono"
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "var(--cream)",
                  marginTop: "4px",
                }}
              >
                {validFilesCount}
              </div>
            </div>

            <div
              style={{
                padding: "16px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: "3px",
                borderLeft: "3px solid var(--blue)",
              }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "var(--blue)" }}>
                ESTIMATED RECORDS
              </div>
              <div
                className="mono"
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "var(--cream)",
                  marginTop: "4px",
                }}
              >
                ~{totalEstimatedRecords}
              </div>
            </div>

            <div
              style={{
                padding: "16px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: "3px",
                borderLeft: "3px solid var(--green)",
              }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "var(--green)" }}>
                INACTIVITY GAP
              </div>
              <div
                className="mono"
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "var(--cream)",
                  marginTop: "4px",
                }}
              >
                {inactivityDays}d
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "28px" }}>
            <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "10px" }}>
              AVAILABLE EVIDENCE CATEGORIES
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {availableCategories.map((cat) => (
                <span key={cat} className="tag green" style={{ fontSize: "11px" }}>
                  ✓ {EVIDENCE_CATEGORY_META[cat].label}
                </span>
              ))}
              {availableCategories.length === 0 && (
                <span className="tag red">No valid evidence categories detected</span>
              )}
            </div>
          </div>

          <div
            style={{
              padding: "16px",
              background: "rgba(197, 160, 89, 0.08)",
              border: "1px solid var(--gold)",
              borderRadius: "3px",
              marginBottom: "32px",
              fontSize: "12.5px",
              color: "#e8d5b5",
              lineHeight: 1.55,
            }}
          >
            <strong>Analysis Architecture Notice:</strong> Proposes candidate machine identities and
            ownership hypotheses citing verbatim record substrings. Deterministic verification
            rejects ungrounded claims with reason codes R1–R5. No automated production credential
            revocation.
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setCurrentStep("config")}
              className="btn secondary small"
            >
              ← Back to Config
            </button>
            <button
              type="button"
              id="btn-process-investigation"
              onClick={handleExecuteProcessing}
              disabled={validFilesCount === 0}
              className="btn"
              style={{
                padding: "14px 32px",
                fontSize: "12.5px",
                letterSpacing: "0.12em",
                background: "linear-gradient(180deg, #b02638, #69131f)",
                borderColor: "var(--gold2)",
              }}
            >
              ✦ RUN INVESTIGATION ANALYSIS
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 5: PROCESSING SPINNER                               */}
      {/* ======================================================== */}
      {currentStep === "processing" && (
        <div
          className="panel"
          style={{
            padding: "54px 30px",
            textAlign: "center",
            border: "1px dashed var(--gold)",
            background: "rgba(18, 14, 20, 0.95)",
            maxWidth: "680px",
            margin: "40px auto",
          }}
        >
          <img
            src="/candleon.png"
            alt="Lighting Candle"
            className="candle-glow"
            style={{ width: "32px", height: "54px", margin: "0 auto 16px", objectFit: "contain" }}
          />
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
            EXECUTING INVESTIGATION PIPELINE
          </div>
          <h2
            className="display"
            style={{ fontSize: "22px", color: "var(--cream)", margin: "0 0 12px" }}
          >
            Reconstructing Machine Identity Lineage...
          </h2>
          <p
            className="serif"
            style={{
              color: "#c7b591",
              fontStyle: "italic",
              maxWidth: "520px",
              margin: "0 auto",
              lineHeight: 1.5,
            }}
          >
            Uploading source records, extracting candidate credentials, and performing deterministic
            substring verification with reason codes R1–R5.
          </p>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 5: COMPREHENSIVE INVESTIGATION RESULTS              */}
      {/* ======================================================== */}
      {currentStep === "results" && findings && (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {/* Header Card */}
          <div
            className="panel"
            style={{
              padding: "36px",
              border: "1px solid var(--gold)",
              backgroundImage: "linear-gradient(135deg, rgba(35,26,20,0.98), rgba(16,13,11,0.96))",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "20px",
              }}
            >
              <div>
                <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "6px" }}>
                  INVESTIGATION FINDINGS REPORT ✦ {findings.investigation.investigation_id}
                </div>
                <h1
                  className="display"
                  style={{ fontSize: "28px", color: "var(--cream)", margin: "4px 0 10px" }}
                >
                  {findings.investigation.name}
                </h1>
                <p style={{ fontSize: "14px", color: "#c7b591", margin: 0, fontStyle: "italic" }}>
                  {findings.investigation.description || "Machine identity audit investigation."}
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span className="tag green">STATUS: COMPLETED</span>
                <span className="tag gray">
                  RECORDS: {findings.processing_summary.total_records_processed}
                </span>
                <span className="tag gold">IDENTITIES: {findings.discovered_accounts.length}</span>
              </div>
            </div>

            {/* Architecture Transparency Banner */}
            <div
              style={{
                marginTop: "24px",
                padding: "16px 20px",
                background: "rgba(0,0,0,0.4)",
                borderRadius: "3px",
                borderLeft: "3px solid var(--blue)",
                fontSize: "12.5px",
                color: "#d0bd98",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}
                >
                  <span className="tag blue" style={{ fontSize: "10px" }}>
                    PROPOSED BY:{" "}
                    {findings.processing_summary.model_name?.toUpperCase() || "GEMMA 3 (4B)"}
                  </span>
                  <span className="tag green" style={{ fontSize: "10px" }}>
                    GUARDED BY: DETERMINISTIC VERIFIER
                  </span>
                  {findings.processing_summary.model_extraction_status === "abstained" && (
                    <span className="tag red" style={{ fontSize: "10px" }}>
                      STATUS: ABSTAINED (UNGROUNDED)
                    </span>
                  )}
                </div>
                <strong style={{ color: "#f0dfbd" }}>Deterministic Verification Engine:</strong>{" "}
                Gemma 3 interprets raw engineering logs and proposes structured candidate claims.
                Every claim is strictly validated by the deterministic verifier against immutable
                evidence records. Unsupported claims are quarantined with reason codes R1–R5.
                {findings.processing_summary.abstention_reason && (
                  <div style={{ color: "#f0b9ad", marginTop: "4px", fontSize: "11.5px" }}>
                    <em>Note: {findings.processing_summary.abstention_reason}</em>
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "4px",
                }}
              >
                <span className="tag gray" style={{ fontSize: "10px" }}>
                  VERIFIED CLAIMS: {findings.processing_summary.claims_verified_count} |
                  QUARANTINED: {findings.processing_summary.claims_quarantined_count}
                </span>
                <span className="mono" style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                  Provider: {findings.processing_summary.model_provider || "ollama"} (temp=0)
                </span>
              </div>
            </div>

            {/* TabPFN Machine Identity Prioritization & Triage Layer */}
            {findings.tabpfn_prioritization && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "20px 24px",
                  background: "rgba(18, 14, 24, 0.85)",
                  border: "1px solid rgba(197, 160, 89, 0.4)",
                  borderLeft: "4px solid var(--gold)",
                  borderRadius: "4px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="tag gold" style={{ fontSize: "10.5px" }}>
                      PRIORITIZATION ENGINE:{" "}
                      {findings.tabpfn_prioritization.model_name.toUpperCase()} (v
                      {findings.tabpfn_prioritization.model_version})
                    </span>
                    <span
                      className={`tag ${findings.tabpfn_prioritization.status === "completed" ? "green" : "red"}`}
                      style={{ fontSize: "10px" }}
                    >
                      STATUS: {findings.tabpfn_prioritization.status.toUpperCase()}
                    </span>
                  </div>
                  <span className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Latency: {Math.round(findings.tabpfn_prioritization.latency_ms)} ms (CPU) |
                    Ranked: {findings.tabpfn_prioritization.identities_ranked}
                  </span>
                </div>

                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(0, 0, 0, 0.35)",
                    border: "1px solid var(--line)",
                    borderRadius: "3px",
                    fontSize: "12px",
                    color: "var(--cream)",
                    marginBottom: "16px",
                  }}
                >
                  <strong style={{ color: "var(--gold)" }}>Important Guardrail:</strong>{" "}
                  {findings.tabpfn_prioritization.disclaimer}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {findings.tabpfn_prioritization.rankings.map((r) => {
                    const tierColor =
                      r.triage_tier === "URGENT"
                        ? "red"
                        : r.triage_tier === "ELEVATED"
                          ? "gold"
                          : r.triage_tier === "ROUTINE"
                            ? "blue"
                            : "gray";

                    return (
                      <div
                        key={r.account_id}
                        style={{
                          padding: "14px 18px",
                          background: "rgba(10, 8, 14, 0.6)",
                          border: "1px solid var(--line)",
                          borderRadius: "4px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          gap: "12px",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: "260px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "6px",
                            }}
                          >
                            <span
                              className="mono"
                              style={{ fontWeight: 700, color: "var(--gold2)", fontSize: "14px" }}
                            >
                              #{r.priority_rank} {r.account_id}
                            </span>
                            <span className={`tag ${tierColor}`} style={{ fontSize: "10px" }}>
                              {r.triage_tier} TRIAGE
                            </span>
                          </div>

                          <div style={{ fontSize: "12px", color: "#d5cbb8", marginBottom: "6px" }}>
                            <strong>Contributing Factors:</strong>
                            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                              {r.contributing_factors.map((cf, idx) => (
                                <li key={idx}>{cf}</li>
                              ))}
                            </ul>
                          </div>

                          {r.missing_inputs.length > 0 && (
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                              <em>Missing/Inferred Inputs: {r.missing_inputs.join(", ")}</em>
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: "right", minWidth: "140px" }}>
                          <div
                            className="eyebrow"
                            style={{ color: "var(--muted)", fontSize: "10px" }}
                          >
                            TRIAGE URGENCY SCORE
                          </div>
                          <div
                            className="mono"
                            style={{
                              fontSize: "20px",
                              fontWeight: 700,
                              color:
                                tierColor === "red"
                                  ? "var(--red)"
                                  : tierColor === "gold"
                                    ? "var(--gold)"
                                    : "var(--blue)",
                            }}
                          >
                            {(r.priority_score * 100).toFixed(1)}%
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                            Rank {r.priority_rank} of{" "}
                            {findings.tabpfn_prioritization?.identities_ranked}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Phase 4: Human-in-the-Loop Remediation & Approval Queue */}
          <div
            className="panel"
            style={{
              padding: "28px",
              marginTop: "24px",
              marginBottom: "24px",
              borderLeft: "4px solid var(--blue)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div>
                <div className="eyebrow" style={{ color: "var(--blue)", marginBottom: "4px" }}>
                  PHASE 4 · AUTH0 HUMAN-IN-THE-LOOP APPROVAL WORKFLOW
                </div>
                <h3
                  className="display"
                  style={{ fontSize: "20px", color: "var(--cream)", margin: 0 }}
                >
                  Remediation &amp; Sandbox Approval Queue
                </h3>
                <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "4px 0 0" }}>
                  Audited human governance for simulated machine identity remediation. Approvals
                  require verified Auth0 <code className="mono">approve:revocations</code>{" "}
                  permission. Never modifies real production credentials.
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span className="tag blue" style={{ fontSize: "10.5px" }}>
                  [SIMULATED SANDBOX ONLY]
                </span>
                <span className="tag gray" style={{ fontSize: "10.5px" }}>
                  PENDING: {approvals.filter((a) => a.decision === "pending").length}
                </span>
              </div>
            </div>

            {/* Error banner if any */}
            {approvalActionError && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(180, 40, 40, 0.2)",
                  border: "1px solid var(--red)",
                  borderRadius: "4px",
                  color: "#f7b0b0",
                  fontSize: "12.5px",
                  marginBottom: "16px",
                }}
              >
                <strong>Approval Error:</strong> {approvalActionError}
              </div>
            )}

            {/* Approvals list */}
            {loadingApprovals ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)" }}>
                <em>Loading approval requests...</em>
              </div>
            ) : approvals.length === 0 ? (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  border: "1px dashed var(--line)",
                  borderRadius: "4px",
                  color: "var(--muted)",
                  fontSize: "13px",
                }}
              >
                No remediation proposals submitted yet. You can propose simulated sandbox
                remediation for any identified machine identity below.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {approvals.map((req) => {
                  const isPending = req.decision === "pending";
                  const isApproved = req.decision === "approved";
                  const isRejected = req.decision === "rejected";
                  const isAuditExpanded = expandedAuditId === req.request_id;

                  return (
                    <div
                      key={req.request_id}
                      style={{
                        padding: "18px 20px",
                        background: "rgba(12, 10, 18, 0.7)",
                        border: "1px solid var(--line)",
                        borderLeft: `3px solid ${
                          isPending ? "var(--gold)" : isApproved ? "var(--green)" : "var(--red)"
                        }`,
                        borderRadius: "4px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          gap: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "6px",
                            }}
                          >
                            <span
                              className="mono"
                              style={{ fontWeight: 700, color: "var(--gold2)", fontSize: "14px" }}
                            >
                              {req.account_id}
                            </span>
                            <span
                              className={`tag ${isPending ? "gold" : isApproved ? "green" : "red"}`}
                              style={{ fontSize: "10px" }}
                            >
                              {isPending
                                ? "PENDING APPROVAL"
                                : isApproved
                                  ? "APPROVED"
                                  : "REJECTED"}
                            </span>
                            <span className="tag blue" style={{ fontSize: "10px" }}>
                              [SIMULATED SANDBOX]
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#e0d3be" }}>
                            <strong>Proposed Sandbox Action:</strong>{" "}
                            <code className="mono" style={{ color: "var(--gold)" }}>
                              {req.proposed_action}
                            </code>
                          </div>
                        </div>

                        {/* Decision buttons */}
                        {isPending && (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              className="btn primary small"
                              onClick={() => {
                                setDecisionReason("");
                                setConfirmingApproval(req);
                              }}
                              style={{
                                fontSize: "11px",
                                background: "var(--green)",
                                color: "#000",
                                fontWeight: 700,
                              }}
                            >
                              ✓ Review &amp; Approve
                            </button>
                            <button
                              type="button"
                              className="btn ghost small"
                              onClick={() => {
                                setDecisionReason("");
                                setRejectingApproval(req);
                              }}
                              style={{
                                fontSize: "11px",
                                color: "var(--red)",
                                borderColor: "var(--red)",
                              }}
                            >
                              ✕ Reject
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Request Context Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                          gap: "12px",
                          background: "rgba(0,0,0,0.3)",
                          padding: "12px 16px",
                          borderRadius: "3px",
                          fontSize: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        <div>
                          <div
                            className="eyebrow"
                            style={{ fontSize: "9px", color: "var(--muted)" }}
                          >
                            DETERMINISTIC VERIFICATION
                          </div>
                          <div style={{ marginTop: "4px" }}>
                            <span
                              className={`tag ${
                                req.verification_state === "verified"
                                  ? "green"
                                  : req.verification_state === "supported"
                                    ? "gold"
                                    : "red"
                              }`}
                              style={{ fontSize: "9.5px" }}
                            >
                              {req.verification_state.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {req.tabpfn_priority && (
                          <div>
                            <div
                              className="eyebrow"
                              style={{ fontSize: "9px", color: "var(--muted)" }}
                            >
                              TABPFN TRIAGE PRIORITY
                            </div>
                            <div style={{ marginTop: "4px", color: "#f0dfbd" }}>
                              <strong>{req.tabpfn_priority.triage_tier}</strong> · Rank #
                              {req.tabpfn_priority.priority_rank} (
                              {(req.tabpfn_priority.priority_score * 100).toFixed(1)}%)
                            </div>
                          </div>
                        )}

                        <div>
                          <div
                            className="eyebrow"
                            style={{ fontSize: "9px", color: "var(--muted)" }}
                          >
                            GEMMA 3 INTERPRETATION
                          </div>
                          <div style={{ marginTop: "4px", color: "#d0c5b0", fontStyle: "italic" }}>
                            {req.gemma_summary || "Automated candidate identification"}
                          </div>
                        </div>

                        <div>
                          <div
                            className="eyebrow"
                            style={{ fontSize: "9px", color: "var(--muted)" }}
                          >
                            PROPOSED BY / CREATED
                          </div>
                          <div
                            style={{ marginTop: "4px", color: "var(--muted)", fontSize: "11px" }}
                          >
                            <span className="mono">{req.requesting_user_id}</span>
                            <div>{new Date(req.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>

                      {/* Evidence Citations */}
                      {req.evidence_references && req.evidence_references.length > 0 && (
                        <div
                          style={{
                            fontSize: "11.5px",
                            color: "var(--muted)",
                            marginBottom: "10px",
                          }}
                        >
                          <strong>Evidence References:</strong>{" "}
                          {req.evidence_references.map((ref) => (
                            <span
                              key={ref}
                              className="mono"
                              style={{ marginRight: "6px", color: "var(--cream)" }}
                            >
                              [{ref}]
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Execution Results View */}
                      {req.execution_result && (
                        <div
                          style={{
                            padding: "12px 14px",
                            background: "rgba(20, 30, 20, 0.7)",
                            border: "1px solid rgba(80, 180, 80, 0.4)",
                            borderRadius: "3px",
                            fontSize: "12px",
                            marginBottom: "10px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "6px",
                            }}
                          >
                            <strong style={{ color: "#a5f0a5" }}>
                              ✓ Simulated Sandbox Execution Completed
                            </strong>
                            <span
                              className="mono"
                              style={{ fontSize: "10.5px", color: "var(--muted)" }}
                            >
                              Sandbox ID: {req.execution_result.sandbox_id}
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: "#b9cfb9" }}>
                            Executed At:{" "}
                            {new Date(req.execution_result.executed_at).toLocaleString()} by{" "}
                            <span className="mono">{req.approver_id}</span>
                          </div>
                          <div
                            style={{
                              marginTop: "8px",
                              background: "rgba(0,0,0,0.5)",
                              padding: "8px 10px",
                              borderRadius: "3px",
                            }}
                          >
                            <div
                              className="eyebrow"
                              style={{
                                fontSize: "8.5px",
                                color: "var(--muted)",
                                marginBottom: "4px",
                              }}
                            >
                              SANDBOX SIMULATION LOGS
                            </div>
                            {req.execution_result.simulated_logs.map((log, lidx) => (
                              <div
                                key={lidx}
                                className="mono"
                                style={{ fontSize: "11px", color: "#c0e0c0", lineHeight: "1.4" }}
                              >
                                {log}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rejection Details View */}
                      {isRejected && req.decision_reason && (
                        <div
                          style={{
                            padding: "10px 14px",
                            background: "rgba(40, 20, 20, 0.7)",
                            border: "1px solid rgba(220, 80, 80, 0.4)",
                            borderRadius: "3px",
                            fontSize: "12px",
                            marginBottom: "10px",
                            color: "#f0b5b5",
                          }}
                        >
                          <strong>Rejection Reason:</strong> {req.decision_reason} (by{" "}
                          <span className="mono">{req.approver_id}</span>)
                        </div>
                      )}

                      {/* Audit Trail Accordion */}
                      <div>
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() =>
                            setExpandedAuditId(isAuditExpanded ? null : req.request_id)
                          }
                          style={{ fontSize: "10.5px", padding: "4px 8px" }}
                        >
                          {isAuditExpanded
                            ? "▾ Hide Audit Trail"
                            : `▸ View Audit Trail (${req.audit_history.length})`}
                        </button>

                        {isAuditExpanded && (
                          <div
                            style={{
                              marginTop: "8px",
                              padding: "10px 12px",
                              background: "rgba(0,0,0,0.4)",
                              borderRadius: "3px",
                              fontSize: "11px",
                            }}
                          >
                            {req.audit_history.map((entry, eidx) => (
                              <div
                                key={eidx}
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  alignItems: "baseline",
                                  marginBottom: "4px",
                                  color: "var(--muted)",
                                }}
                              >
                                <span
                                  className="mono"
                                  style={{ minWidth: "140px", fontSize: "10px" }}
                                >
                                  {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>
                                <span className="tag gray" style={{ fontSize: "9px" }}>
                                  {entry.action}
                                </span>
                                <span className="mono" style={{ color: "var(--cream)" }}>
                                  {entry.actor}
                                </span>
                                <span style={{ color: "#d0c5b0" }}>{entry.details}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Core Answers Section: Answering the 5 Essential Questions */}
          <div className="panel" style={{ padding: "28px" }}>
            <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "6px" }}>
              DISCOVERED MACHINE IDENTITIES &amp; INVESTIGATION ANSWERS
            </div>
            <h3
              className="display"
              style={{ fontSize: "20px", color: "var(--cream)", margin: "0 0 20px" }}
            >
              Machine Identity Findings ({findings.discovered_accounts.length})
            </h3>

            {findings.discovered_accounts.length === 0 ? (
              <div
                style={{
                  padding: "36px",
                  textAlign: "center",
                  border: "1px dashed var(--line)",
                  borderRadius: "4px",
                }}
              >
                <p style={{ color: "var(--muted)", margin: 0, fontStyle: "italic" }}>
                  No machine identity records were detected in the uploaded evidence.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {findings.discovered_accounts.map((acc) => {
                  const matchingCase = findings.cases.find((c) => c.account_id === acc.account_id);
                  const isVerified = acc.owner_status === "verified";
                  const isSupported = acc.owner_status === "supported";
                  const isConflicting = acc.owner_status === "conflicting";

                  return (
                    <div
                      key={acc.account_id}
                      style={{
                        padding: "24px",
                        background: "rgba(10, 8, 12, 0.7)",
                        border: "1px solid rgba(197, 160, 89, 0.3)",
                        borderRadius: "4px",
                      }}
                    >
                      {/* Identity Header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          gap: "12px",
                          marginBottom: "16px",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span
                              className="mono"
                              style={{ fontSize: "16px", fontWeight: 700, color: "var(--gold2)" }}
                            >
                              {acc.account_id}
                            </span>
                            <span className="tag gray" style={{ fontSize: "10px" }}>
                              {acc.kind.toUpperCase()}
                            </span>
                            <span
                              className={`tag ${isVerified ? "green" : isSupported ? "gold" : isConflicting ? "red" : "gray"}`}
                              style={{ fontSize: "10px" }}
                            >
                              {acc.owner_status.toUpperCase()}
                            </span>
                            {acc.triage_tier && (
                              <span
                                className={`tag ${acc.triage_tier === "URGENT" ? "red" : acc.triage_tier === "ELEVATED" ? "gold" : acc.triage_tier === "ROUTINE" ? "blue" : "gray"}`}
                                style={{ fontSize: "10px" }}
                              >
                                {acc.priority_rank ? `#${acc.priority_rank} ` : ""}
                                {acc.triage_tier} TRIAGE
                              </span>
                            )}
                          </div>
                          <div
                            className="serif"
                            style={{
                              fontSize: "13px",
                              color: "#c7b591",
                              fontStyle: "italic",
                              marginTop: "4px",
                            }}
                          >
                            Governance Chamber: <strong>{acc.ghost_type}</strong>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setProposedReason("");
                              setProposedAction("simulate_revoke_deploy_key");
                              setProposingForAccount(
                                proposingForAccount === acc.account_id ? null : acc.account_id,
                              );
                            }}
                            className="btn primary small"
                            style={{
                              fontSize: "11px",
                              background: "rgba(197, 160, 89, 0.2)",
                              color: "var(--gold2)",
                              borderColor: "var(--gold)",
                            }}
                          >
                            🛡️ Propose Sandbox Remediation
                          </button>
                          <button
                            type="button"
                            onClick={() => onRouteChange("case", { caseId: acc.case_id })}
                            className="btn small"
                            style={{ fontSize: "11px" }}
                          >
                            Open Dossier →
                          </button>
                        </div>
                      </div>

                      {/* Inline Proposal Form */}
                      {proposingForAccount === acc.account_id && (
                        <div
                          style={{
                            marginBottom: "16px",
                            padding: "16px 20px",
                            background: "rgba(20, 16, 26, 0.95)",
                            border: "1px solid var(--gold)",
                            borderRadius: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "10px",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <strong style={{ color: "var(--gold2)", fontSize: "13px" }}>
                              Propose Simulated Sandbox Remediation for {acc.account_id}
                            </strong>
                            <span className="tag blue" style={{ fontSize: "9.5px" }}>
                              [SIMULATED SANDBOX ONLY]
                            </span>
                          </div>

                          <div style={{ marginBottom: "10px" }}>
                            <label
                              style={{
                                display: "block",
                                fontSize: "11px",
                                color: "var(--muted)",
                                marginBottom: "4px",
                              }}
                            >
                              Simulated Action
                            </label>
                            <select
                              value={proposedAction}
                              onChange={(e) => setProposedAction(e.target.value as any)}
                              className="input"
                              style={{ width: "100%", fontSize: "12px", background: "#110e17" }}
                            >
                              <option value="simulate_revoke_deploy_key">
                                simulate_revoke_deploy_key (Simulated revocation of test deploy key)
                              </option>
                              <option value="simulate_disable_service_account">
                                simulate_disable_service_account (Simulated deactivation of service
                                account)
                              </option>
                              <option value="simulate_quarantine_token">
                                simulate_quarantine_token (Simulated token quarantine &amp;
                                rotation)
                              </option>
                            </select>
                          </div>

                          <div style={{ marginBottom: "12px" }}>
                            <label
                              style={{
                                display: "block",
                                fontSize: "11px",
                                color: "var(--muted)",
                                marginBottom: "4px",
                              }}
                            >
                              Justification / Governance Reason
                            </label>
                            <input
                              type="text"
                              className="input"
                              value={proposedReason}
                              onChange={(e) => setProposedReason(e.target.value)}
                              placeholder="e.g. Identity inactive >90 days and prioritized by TabPFN triage"
                              style={{ width: "100%", fontSize: "12px" }}
                            />
                          </div>

                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="btn ghost small"
                              onClick={() => setProposingForAccount(null)}
                              style={{ fontSize: "11px" }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn primary small"
                              onClick={() => handleProposeRemediation(acc.account_id)}
                              style={{ fontSize: "11px" }}
                            >
                              Submit Proposal →
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 5 Questions Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                          gap: "16px",
                          background: "rgba(0,0,0,0.3)",
                          padding: "16px",
                          borderRadius: "3px",
                          fontSize: "13px",
                        }}
                      >
                        {/* 1. Ownership & Hypothesis */}
                        <div>
                          <div
                            className="eyebrow"
                            style={{ fontSize: "9.5px", color: "var(--gold)" }}
                          >
                            1 &amp; 2. RECORDED / PROPOSED OWNER
                          </div>
                          <div style={{ marginTop: "4px", color: "#f7ebd2" }}>
                            {acc.owner_name ? (
                              <span>
                                <strong>{acc.owner_name}</strong>{" "}
                                <span className="tag green" style={{ fontSize: "9px" }}>
                                  VERIFIED OWNER
                                </span>
                              </span>
                            ) : (
                              <span>
                                <em>No verified human owner</em>{" "}
                                <span className="tag red" style={{ fontSize: "9px" }}>
                                  ORPHANED
                                </span>
                              </span>
                            )}
                          </div>
                          {acc.purpose && (
                            <div style={{ fontSize: "12px", color: "#c8b994", marginTop: "6px" }}>
                              <strong>Purpose:</strong> {acc.purpose}
                            </div>
                          )}
                        </div>

                        {/* 3. Evidence Citations */}
                        <div>
                          <div
                            className="eyebrow"
                            style={{ fontSize: "9.5px", color: "var(--gold)" }}
                          >
                            3. GROUNDED EVIDENCE CITATION
                          </div>
                          <div
                            style={{
                              marginTop: "4px",
                              color: "#ecd8b6",
                              fontStyle: "italic",
                              fontSize: "12.5px",
                            }}
                          >
                            &ldquo;{acc.primary_quote || "No exact quote found in source evidence."}
                            &rdquo;
                          </div>
                        </div>

                        {/* 4. Permissions & Activity */}
                        <div>
                          <div
                            className="eyebrow"
                            style={{ fontSize: "9.5px", color: "var(--gold)" }}
                          >
                            4. RECORDED PERMISSIONS &amp; ACTIVITY
                          </div>
                          <div
                            style={{
                              marginTop: "4px",
                              display: "flex",
                              gap: "4px",
                              flexWrap: "wrap",
                            }}
                          >
                            {acc.permissions.map((p, pidx) => (
                              <span key={pidx} className="tag gray" style={{ fontSize: "10px" }}>
                                {p}
                              </span>
                            ))}
                          </div>
                          <div
                            style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "6px" }}
                          >
                            Last Active:{" "}
                            {acc.last_used_at
                              ? new Date(acc.last_used_at).toLocaleDateString()
                              : "Never recorded"}
                          </div>
                        </div>

                        {/* 5. Review & Reason Codes */}
                        <div>
                          <div
                            className="eyebrow"
                            style={{ fontSize: "9.5px", color: "var(--gold)" }}
                          >
                            5. HUMAN REVIEW &amp; RECOMMENDATION
                          </div>
                          {matchingCase && matchingCase.claims_removed.length > 0 ? (
                            <div style={{ marginTop: "4px", color: "#f0b9ad", fontSize: "12px" }}>
                              <strong>
                                Quarantined Claims ({matchingCase.claims_removed.length}):
                              </strong>
                              {matchingCase.claims_removed.map((rc, rcidx) => (
                                <div key={rcidx} style={{ marginTop: "2px" }}>
                                  Reason Code <strong>{rc.reason_code}</strong>: {rc.text}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ marginTop: "4px", color: "#b9e2b0", fontSize: "12px" }}>
                              ✓ All proposed claims satisfied deterministic checks.
                            </div>
                          )}
                          <div
                            style={{ fontSize: "12px", color: "var(--gold2)", marginTop: "6px" }}
                          >
                            <strong>Next Step:</strong>{" "}
                            {isVerified
                              ? "Verify if departed owner requires key transfer to designated successor."
                              : isConflicting
                                ? "Conduct manual ownership audit with repository maintainers."
                                : "Quarantine or rotate credential; investigate ungrounded token."}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schemas Documentation Modal */}
      {showSchemasModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSchemasModal(false);
          }}
        >
          <div
            className="panel"
            style={{
              maxWidth: "720px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "32px",
              border: "1px solid var(--gold)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div className="eyebrow" style={{ color: "var(--gold)" }}>
                SUPPORTED EVIDENCE SCHEMAS
              </div>
              <button
                type="button"
                onClick={() => setShowSchemasModal(false)}
                className="btn ghost small"
                style={{ fontSize: "14px" }}
              >
                ✕
              </button>
            </div>

            <h3
              className="display"
              style={{ fontSize: "20px", color: "var(--cream)", marginBottom: "14px" }}
            >
              Expected File Formats &amp; Examples
            </h3>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "12.5px" }}
            >
              <div>
                <strong>1. Machine Identity Inventory (CSV):</strong>
                <pre
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    padding: "10px",
                    borderRadius: "3px",
                    overflowX: "auto",
                    color: "#d0e4ff",
                  }}
                >
                  {`account_id,kind,permissions,tags,last_used_at\nacc_deploy_key_881,deploy_key,"repo:write,deploy:staging","ci,nightly",2025-04-12T10:15:30Z\nacc_service_runner_404,service_account,"cluster:admin,vault:read","daemon,sync",2024-11-03T08:15:00Z`}
                </pre>
              </div>

              <div>
                <strong>2. Engineering Tickets &amp; Audit Logs (JSON):</strong>
                <pre
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    padding: "10px",
                    borderRadius: "3px",
                    overflowX: "auto",
                    color: "#d0e4ff",
                  }}
                >
                  {`[\n  {\n    "record_id": "rec_ticket_1092",\n    "type": "ticket",\n    "ts": "2025-04-10T14:22:00Z",\n    "author_handle": "cmendez",\n    "actor_account_id": "acc_deploy_key_881",\n    "content": "Automated night-build key for staging cluster."\n  }\n]`}
                </pre>
              </div>

              <div>
                <strong>3. Git Commit Logs (.log / .txt):</strong>
                <pre
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    padding: "10px",
                    borderRadius: "3px",
                    overflowX: "auto",
                    color: "#d0e4ff",
                  }}
                >
                  {`commit 8f92ab018442bc014aef72948c21a4f00123\nAuthor: Carlos Mendez <cmendez@internal.corp>\nDate: Sat Apr 12 10:15:30 2025 -0400\n\n    Add staging deploy key acc_deploy_key_881`}
                </pre>
              </div>
            </div>

            <div style={{ marginTop: "24px", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setShowSchemasModal(false)}
                className="btn small"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Human Approval */}
      {confirmingApproval && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingDecision) setConfirmingApproval(null);
          }}
        >
          <div
            className="panel"
            style={{
              maxWidth: "580px",
              width: "100%",
              padding: "28px",
              border: "1px solid var(--gold)",
              background: "#14101d",
            }}
          >
            <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "4px" }}>
              CONFIRMATION REQUIRED · HUMAN-IN-THE-LOOP APPROVAL
            </div>
            <h3
              className="serif"
              style={{ fontSize: "22px", color: "#f0dfbd", margin: "0 0 12px" }}
            >
              Confirm Sandbox Remediation Execution
            </h3>

            <div
              style={{
                padding: "12px 14px",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(80, 180, 255, 0.3)",
                borderLeft: "4px solid var(--blue)",
                borderRadius: "3px",
                fontSize: "12px",
                color: "#c0dcf7",
                marginBottom: "16px",
              }}
            >
              <strong>🔒 Sandbox Safety Guarantee:</strong> This action will execute strictly within
              the isolated sandbox environment. It records synthetic remediation audit trails and
              will <strong>never</strong> call real cloud provider APIs or modify production
              credentials.
            </div>

            <div
              style={{
                fontSize: "13px",
                color: "#d5c9b4",
                marginBottom: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div>
                <strong>Target Machine Identity:</strong>{" "}
                <code className="mono" style={{ color: "var(--gold)" }}>
                  {confirmingApproval.account_id}
                </code>
              </div>
              <div>
                <strong>Proposed Action:</strong>{" "}
                <code className="mono" style={{ color: "var(--gold)" }}>
                  {confirmingApproval.proposed_action}
                </code>
              </div>
              <div>
                <strong>Verification State:</strong>{" "}
                <span className="tag green" style={{ fontSize: "9px" }}>
                  {confirmingApproval.verification_state}
                </span>
              </div>
              <div>
                <strong>Requesting Operator:</strong>{" "}
                <span className="mono" style={{ fontSize: "11px" }}>
                  {confirmingApproval.requesting_user_id}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  color: "var(--muted)",
                  marginBottom: "4px",
                }}
              >
                Approval Notes / Justification (Optional)
              </label>
              <input
                type="text"
                className="input"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="e.g. Approved simulated key revocation after reviewing TabPFN evidence"
                style={{ width: "100%", fontSize: "12px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn ghost small"
                disabled={isSubmittingDecision}
                onClick={() => setConfirmingApproval(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary small"
                disabled={isSubmittingDecision}
                onClick={() =>
                  handleDecideApproval(confirmingApproval.request_id, "approved", decisionReason)
                }
                style={{ background: "var(--green)", color: "#000", fontWeight: 700 }}
              >
                {isSubmittingDecision
                  ? "Executing Simulation..."
                  : "✓ Confirm & Execute Simulation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingApproval && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingDecision) setRejectingApproval(null);
          }}
        >
          <div
            className="panel"
            style={{
              maxWidth: "520px",
              width: "100%",
              padding: "28px",
              border: "1px solid var(--red)",
              background: "#14101d",
            }}
          >
            <div className="eyebrow" style={{ color: "var(--red)", marginBottom: "4px" }}>
              REJECT REMEDIATION REQUEST
            </div>
            <h3
              className="serif"
              style={{ fontSize: "20px", color: "#f0dfbd", margin: "0 0 12px" }}
            >
              Reject Remediation Proposal for {rejectingApproval.account_id}
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  color: "var(--muted)",
                  marginBottom: "4px",
                }}
              >
                Reason for Rejection
              </label>
              <input
                type="text"
                className="input"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="e.g. Identity is confirmed active in nightly pipeline"
                style={{ width: "100%", fontSize: "12px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn ghost small"
                disabled={isSubmittingDecision}
                onClick={() => setRejectingApproval(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary small"
                disabled={isSubmittingDecision}
                onClick={() =>
                  handleDecideApproval(rejectingApproval.request_id, "rejected", decisionReason)
                }
                style={{ background: "var(--red)", color: "#fff" }}
              >
                {isSubmittingDecision ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
