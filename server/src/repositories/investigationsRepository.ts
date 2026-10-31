import path from "path";
import {
  CreateInvestigationInput,
  DashboardStats,
  EvidenceRecord,
  EvidenceRecordSchema,
  EvidenceRecordType,
  Investigation,
  InvestigationFindings,
  SingleFileInput,
  UploadedFile,
  ArchiveAccount,
  AccountsQuery,
  AccountsResponse,
  Case,
  ApprovalRequest,
  CreateApprovalInput,
} from "@keys/contracts";
import { SYNTHETIC_ACCOUNTS } from "../fixtures/syntheticAccounts.js";
import { SYNTHETIC_CASES, SYNTHETIC_RECORDS } from "../fixtures/syntheticCases.js";
import { SandboxRemediationAdapter } from "../services/sandboxRemediationAdapter.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_EXTENSIONS = new Set([".json", ".jsonl", ".ndjson", ".log", ".txt", ".csv"]);

export interface InvestigationsRepository {
  createInvestigation(input: CreateInvestigationInput, ownerId?: string): Promise<Investigation>;
  listInvestigations(
    callerOwnerId?: string,
    demoFilter?: "true" | "false",
  ): Promise<Investigation[]>;
  findInvestigationById(id: string): Promise<Investigation | null>;
  addUploadedFiles(
    investigationId: string,
    files: SingleFileInput[],
  ): Promise<{
    investigation: Investigation;
    files: UploadedFile[];
    extracted_records: EvidenceRecord[];
    errors: string[];
  }>;
  findFilesByInvestigationId(investigationId: string): Promise<UploadedFile[]>;
  processInvestigation(investigationId: string): Promise<InvestigationFindings>;
  getFindingsByInvestigationId(investigationId: string): Promise<InvestigationFindings | null>;
  getDashboardStats(callerOwnerId?: string): Promise<DashboardStats>;
  getDiscoveredAccountsForOwner(
    callerOwnerId: string,
    query: AccountsQuery,
  ): Promise<AccountsResponse>;
  createApprovalRequest(
    investigationId: string,
    input: CreateApprovalInput,
    requestingUserId: string,
  ): Promise<ApprovalRequest>;
  listApprovalRequests(investigationId: string): Promise<ApprovalRequest[]>;
  findApprovalRequestById(requestId: string): Promise<ApprovalRequest | null>;
  decideApprovalRequest(
    requestId: string,
    decision: "approved" | "rejected",
    approverId: string,
    reason?: string,
  ): Promise<ApprovalRequest>;
}

export class FixtureInvestigationsRepository implements InvestigationsRepository {
  private readonly investigations: Map<string, Investigation> = new Map();
  private readonly uploadedFiles: Map<string, UploadedFile[]> = new Map();
  private readonly investigationRecords: Map<string, EvidenceRecord[]> = new Map();
  private readonly investigationFindings: Map<string, InvestigationFindings> = new Map();
  private readonly approvalRequests: Map<string, ApprovalRequest> = new Map();

  constructor() {
    // Seed with a verified baseline investigation record for the demo bundle
    const seedId = "inv_staging_2026_q1";
    const seedInv: Investigation = {
      investigation_id: seedId,
      name: "Staging CI/CD Night-Build Audit",
      description:
        "Automated analysis of night-build deploy credentials and staging pipeline tickets.",
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
    this.investigations.set(seedId, seedInv);

    const seedFiles: UploadedFile[] = [
      {
        file_id: "file_commit_logs",
        investigation_id: seedId,
        filename: "staging-commits.log",
        size_bytes: 4096,
        extension: ".log",
        uploaded_at: "2026-10-28T14:30:10.000Z",
        status: "processed",
        records_extracted: 2,
      },
      {
        file_id: "file_tickets_json",
        investigation_id: seedId,
        filename: "infra-tickets.json",
        size_bytes: 8192,
        extension: ".json",
        uploaded_at: "2026-10-28T14:30:15.000Z",
        status: "processed",
        records_extracted: 1,
      },
    ];
    this.uploadedFiles.set(seedId, seedFiles);

    const seedRecords: EvidenceRecord[] = [
      SYNTHETIC_RECORDS.rec_commit_4021,
      SYNTHETIC_RECORDS.rec_ticket_1092,
      SYNTHETIC_RECORDS.rec_log_909,
    ].filter(Boolean);
    this.investigationRecords.set(seedId, seedRecords);

    // Seed findings for the baseline investigation
    const discoveredAccounts: ArchiveAccount[] = SYNTHETIC_ACCOUNTS.filter(
      (a) => a.account_id === "acc_deploy_key_881" || a.account_id === "acc_service_runner_404",
    );
    const discoveredCases: Case[] = [
      SYNTHETIC_CASES.case_demo_01,
      SYNTHETIC_CASES.case_demo_02,
    ].filter(Boolean);

    this.investigationFindings.set(seedId, {
      investigation: seedInv,
      files: seedFiles,
      records: seedRecords,
      discovered_accounts: discoveredAccounts,
      cases: discoveredCases,
      processing_summary: {
        total_records_processed: seedRecords.length,
        claims_verified_count: discoveredCases.reduce(
          (sum, c) => sum + c.claims_accepted.length,
          0,
        ),
        claims_quarantined_count: discoveredCases.reduce(
          (sum, c) => sum + c.claims_removed.length,
          0,
        ),
        evidence_status_counts: {
          verified: 1,
          supported: 0,
          conflicting: 0,
          no_evidence: 1,
        },
        ghost_type_counts: {
          LOST: 1,
          FORGOTTEN: 1,
        },
        model_extraction_status: "simulated",
      },
    });
  }

  async createInvestigation(
    input: CreateInvestigationInput,
    ownerId?: string,
  ): Promise<Investigation> {
    const timestamp = new Date().toISOString();
    const idSuffix = Math.random().toString(36).substring(2, 8);
    const investigationId = `inv_${Date.now().toString(36)}_${idSuffix}`;

    const newInv: Investigation = {
      investigation_id: investigationId,
      name: input.name,
      organization_id: input.organization_id || null,
      description: input.description || "",
      status: "created",
      created_at: timestamp,
      updated_at: timestamp,
      file_count: 0,
      record_count: 0,
      accounts_discovered_count: 0,
      bundle_id: `bundle_${investigationId}`,
      owner_id: ownerId || null,
      is_demo: false,
    };

    this.investigations.set(investigationId, newInv);
    this.uploadedFiles.set(investigationId, []);
    this.investigationRecords.set(investigationId, []);
    return newInv;
  }

  async listInvestigations(
    callerOwnerId?: string,
    demoFilter?: "true" | "false",
  ): Promise<Investigation[]> {
    return Array.from(this.investigations.values())
      .filter((inv) => {
        if (demoFilter === "true") {
          return inv.is_demo === true;
        }
        if (demoFilter === "false") {
          return callerOwnerId ? inv.owner_id === callerOwnerId && !inv.is_demo : false;
        }
        return callerOwnerId
          ? inv.is_demo === true || inv.owner_id === callerOwnerId
          : inv.is_demo === true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async findInvestigationById(id: string): Promise<Investigation | null> {
    return this.investigations.get(id) || null;
  }

  async findFilesByInvestigationId(investigationId: string): Promise<UploadedFile[]> {
    return this.uploadedFiles.get(investigationId) || [];
  }

  async addUploadedFiles(
    investigationId: string,
    files: SingleFileInput[],
  ): Promise<{
    investigation: Investigation;
    files: UploadedFile[];
    extracted_records: EvidenceRecord[];
    errors: string[];
  }> {
    const inv = this.investigations.get(investigationId);
    if (!inv) {
      throw new Error("Investigation not found");
    }

    const currentFiles = this.uploadedFiles.get(investigationId) || [];
    const currentRecords = this.investigationRecords.get(investigationId) || [];
    const errors: string[] = [];
    const newFiles: UploadedFile[] = [];
    const newRecords: EvidenceRecord[] = [];

    const now = new Date().toISOString();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const safeFilename = path.basename(file.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = path.extname(safeFilename).toLowerCase();
      const contentBytes = Buffer.byteLength(file.content, "utf8");
      const fileId = `file_${Date.now().toString(36)}_${i}_${Math.random().toString(36).substring(2, 6)}`;

      // 1. Validate file extension
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        errors.push(
          `File "${safeFilename}" rejected: Unsupported extension "${ext}". Allowed: .json, .jsonl, .ndjson, .log, .txt`,
        );
        newFiles.push({
          file_id: fileId,
          investigation_id: investigationId,
          filename: safeFilename,
          size_bytes: contentBytes,
          extension: ext,
          uploaded_at: now,
          status: "invalid",
          records_extracted: 0,
          error_message: `Unsupported extension "${ext}"`,
        });
        continue;
      }

      // 2. Validate file size
      if (contentBytes === 0) {
        errors.push(`File "${safeFilename}" rejected: File content is empty (0 bytes).`);
        newFiles.push({
          file_id: fileId,
          investigation_id: investigationId,
          filename: safeFilename,
          size_bytes: 0,
          extension: ext,
          uploaded_at: now,
          status: "invalid",
          records_extracted: 0,
          error_message: "File is empty",
        });
        continue;
      }

      if (contentBytes > MAX_FILE_SIZE) {
        errors.push(
          `File "${safeFilename}" rejected: Size (${(contentBytes / (1024 * 1024)).toFixed(2)} MB) exceeds 5MB limit.`,
        );
        newFiles.push({
          file_id: fileId,
          investigation_id: investigationId,
          filename: safeFilename,
          size_bytes: contentBytes,
          extension: ext,
          uploaded_at: now,
          status: "invalid",
          records_extracted: 0,
          error_message: "File exceeds 5MB limit",
        });
        continue;
      }

      // 3. Extract evidence records based on file type
      try {
        const extracted = this.extractRecordsFromFile(safeFilename, ext, file.content, now);
        if (extracted.length === 0) {
          errors.push(
            `File "${safeFilename}" warning: No valid engineering or audit records could be parsed.`,
          );
          newFiles.push({
            file_id: fileId,
            investigation_id: investigationId,
            filename: safeFilename,
            size_bytes: contentBytes,
            extension: ext,
            uploaded_at: now,
            status: "failed",
            records_extracted: 0,
            error_message: "No parseable evidence records found",
          });
        } else {
          newFiles.push({
            file_id: fileId,
            investigation_id: investigationId,
            filename: safeFilename,
            size_bytes: contentBytes,
            extension: ext,
            uploaded_at: now,
            status: "valid",
            records_extracted: extracted.length,
          });
          newRecords.push(...extracted);
        }
      } catch (parseErr: unknown) {
        const msg = parseErr instanceof Error ? parseErr.message : "Parsing failure";
        errors.push(`File "${safeFilename}" failed parsing: ${msg}`);
        newFiles.push({
          file_id: fileId,
          investigation_id: investigationId,
          filename: safeFilename,
          size_bytes: contentBytes,
          extension: ext,
          uploaded_at: now,
          status: "failed",
          records_extracted: 0,
          error_message: msg,
        });
      }
    }

    currentFiles.push(...newFiles);
    currentRecords.push(...newRecords);
    this.uploadedFiles.set(investigationId, currentFiles);
    this.investigationRecords.set(investigationId, currentRecords);

    // Update investigation metadata
    inv.file_count = currentFiles.filter((f) => f.status === "valid").length;
    inv.record_count = currentRecords.length;
    inv.status = inv.record_count > 0 ? "files_uploaded" : inv.status;
    inv.updated_at = now;

    return {
      investigation: inv,
      files: newFiles,
      extracted_records: newRecords,
      errors,
    };
  }

  async processInvestigation(investigationId: string): Promise<InvestigationFindings> {
    const inv = this.investigations.get(investigationId);
    if (!inv) {
      throw new Error("Investigation not found");
    }

    const files = this.uploadedFiles.get(investigationId) || [];
    const records = this.investigationRecords.get(investigationId) || [];

    inv.status = "processing";
    inv.updated_at = new Date().toISOString();

    // 1. Identify machine identities associated with the ingested records
    // Match either actor_account_id or regex scan of content against known account pattern
    const matchedAccountIds = new Set<string>();
    for (const rec of records) {
      if (rec.actor_account_id) {
        matchedAccountIds.add(rec.actor_account_id);
      }
      const matches = rec.content.match(/\bacc_[a-zA-Z0-9_-]+\b/g);
      if (matches) {
        matches.forEach((m) => matchedAccountIds.add(m));
      }
    }

    // If no specific accounts were referenced, match top synthetic accounts as demonstration baseline
    if (matchedAccountIds.size === 0 && records.length > 0) {
      matchedAccountIds.add("acc_deploy_key_881");
      matchedAccountIds.add("acc_service_runner_404");
    }

    const discoveredAccounts: ArchiveAccount[] = [];
    const discoveredCases: Case[] = [];

    const evidenceStatusCounts: Record<string, number> = {
      verified: 0,
      supported: 0,
      conflicting: 0,
      no_evidence: 0,
    };
    const ghostTypeCounts: Record<string, number> = {
      LOST: 0,
      FORGOTTEN: 0,
      LONELY: 0,
      INNOCENT: 0,
    };

    let claimsVerifiedCount = 0;
    let claimsQuarantinedCount = 0;

    for (const accId of matchedAccountIds) {
      const acc = SYNTHETIC_ACCOUNTS.find((a) => a.account_id === accId);
      if (acc) {
        discoveredAccounts.push(acc);
        const c = SYNTHETIC_CASES[acc.case_id];
        if (c) {
          discoveredCases.push(c);
          claimsVerifiedCount += c.claims_accepted.length;
          claimsQuarantinedCount += c.claims_removed.length;

          evidenceStatusCounts[c.owner_status] = (evidenceStatusCounts[c.owner_status] || 0) + 1;
          ghostTypeCounts[c.ghost_type] = (ghostTypeCounts[c.ghost_type] || 0) + 1;
        }
      }
    }

    // Mark files as processed
    files.forEach((f) => {
      if (f.status === "valid") {
        f.status = "processed";
      }
    });

    inv.status = "completed";
    inv.accounts_discovered_count = discoveredAccounts.length;
    inv.updated_at = new Date().toISOString();

    const findings: InvestigationFindings = {
      investigation: inv,
      files,
      records,
      discovered_accounts: discoveredAccounts,
      cases: discoveredCases,
      processing_summary: {
        total_records_processed: records.length,
        claims_verified_count: claimsVerifiedCount,
        claims_quarantined_count: claimsQuarantinedCount,
        evidence_status_counts: evidenceStatusCounts,
        ghost_type_counts: ghostTypeCounts,
        model_extraction_status: "simulated",
      },
    };

    this.investigationFindings.set(investigationId, findings);
    return findings;
  }

  async getFindingsByInvestigationId(
    investigationId: string,
  ): Promise<InvestigationFindings | null> {
    return this.investigationFindings.get(investigationId) || null;
  }

  async getDashboardStats(callerOwnerId?: string): Promise<DashboardStats> {
    if (!callerOwnerId) {
      // Demo / unauthenticated caller returns synthetic demonstration stats
      const accounts = SYNTHETIC_ACCOUNTS;
      const total = accounts.length;

      const ghostDist = {
        LOST: accounts.filter((a) => a.ghost_type === "LOST").length,
        FORGOTTEN: accounts.filter((a) => a.ghost_type === "FORGOTTEN").length,
        LONELY: accounts.filter((a) => a.ghost_type === "LONELY").length,
        INNOCENT: accounts.filter((a) => a.ghost_type === "INNOCENT").length,
      };

      const evidenceDist = {
        verified: accounts.filter((a) => a.owner_status === "verified").length,
        supported: accounts.filter((a) => a.owner_status === "supported").length,
        conflicting: accounts.filter((a) => a.owner_status === "conflicting").length,
        no_evidence: accounts.filter((a) => a.owner_status === "no_evidence").length,
      };

      const reviewRequired = accounts.filter(
        (a) => a.owner_status === "conflicting" || a.owner_status === "no_evidence",
      ).length;

      const recentInvestigations = await this.listInvestigations();

      return {
        total_identities: total,
        ghost_distribution: ghostDist,
        evidence_status_distribution: evidenceDist,
        review_required_count: reviewRequired,
        recent_investigations: recentInvestigations.slice(0, 5),
        meta: {
          synthetic: true,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Authenticated caller: derive stats strictly from their accessible non-demo investigations
    const userInvs = Array.from(this.investigations.values()).filter(
      (inv) => inv.owner_id === callerOwnerId && !inv.is_demo,
    );

    let totalIdentities = 0;
    const ghostDist = { LOST: 0, FORGOTTEN: 0, LONELY: 0, INNOCENT: 0 };
    const evidenceDist = { verified: 0, supported: 0, conflicting: 0, no_evidence: 0 };
    let reviewRequired = 0;

    for (const inv of userInvs) {
      const findings = this.investigationFindings.get(inv.investigation_id);
      if (findings) {
        totalIdentities += findings.discovered_accounts.length;
        for (const acc of findings.discovered_accounts) {
          if (acc.ghost_type in ghostDist) {
            ghostDist[acc.ghost_type as keyof typeof ghostDist]++;
          }
          if (acc.owner_status in evidenceDist) {
            evidenceDist[acc.owner_status as keyof typeof evidenceDist]++;
          }
          if (acc.owner_status === "conflicting" || acc.owner_status === "no_evidence") {
            reviewRequired++;
          }
        }
      }
    }

    return {
      total_identities: totalIdentities,
      ghost_distribution: ghostDist,
      evidence_status_distribution: evidenceDist,
      review_required_count: reviewRequired,
      recent_investigations: userInvs.slice(0, 5),
      meta: {
        synthetic: false,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Helper to parse and extract structured EvidenceRecords from uploaded files safely.
   */
  private extractRecordsFromFile(
    filename: string,
    extension: string,
    content: string,
    timestamp: string,
  ): EvidenceRecord[] {
    const records: EvidenceRecord[] = [];

    if (extension === ".json") {
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.records)
          ? parsed.records
          : [parsed];

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const recordId = item.record_id || `rec_${path.parse(filename).name}_${idx + 1}`;
        const type: EvidenceRecordType = ["commit", "ticket", "deploy_log", "policy"].includes(
          item.type,
        )
          ? item.type
          : "deploy_log";

        const recCandidate = {
          record_id: String(recordId),
          type,
          ts: item.ts || timestamp,
          author_handle: item.author_handle ? String(item.author_handle) : null,
          assignee_handle: item.assignee_handle ? String(item.assignee_handle) : null,
          actor_account_id: item.actor_account_id ? String(item.actor_account_id) : null,
          content: typeof item.content === "string" ? item.content : JSON.stringify(item, null, 2),
          structured: Boolean(item.structured ?? true),
        };

        const validated = EvidenceRecordSchema.safeParse(recCandidate);
        if (validated.success) {
          records.push(validated.data);
        }
      }
    } else if (extension === ".jsonl" || extension === ".ndjson") {
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      for (let idx = 0; idx < lines.length; idx++) {
        try {
          const item = JSON.parse(lines[idx]);
          const recordId = item.record_id || `rec_${path.parse(filename).name}_line${idx + 1}`;
          const type: EvidenceRecordType = ["commit", "ticket", "deploy_log", "policy"].includes(
            item.type,
          )
            ? item.type
            : "deploy_log";

          const recCandidate = {
            record_id: String(recordId),
            type,
            ts: item.ts || timestamp,
            author_handle: item.author_handle ? String(item.author_handle) : null,
            assignee_handle: item.assignee_handle ? String(item.assignee_handle) : null,
            actor_account_id: item.actor_account_id ? String(item.actor_account_id) : null,
            content: typeof item.content === "string" ? item.content : JSON.stringify(item),
            structured: Boolean(item.structured ?? true),
          };

          const validated = EvidenceRecordSchema.safeParse(recCandidate);
          if (validated.success) {
            records.push(validated.data);
          }
        } catch {
          // Skip invalid JSONL line
        }
      }
    } else if (extension === ".csv") {
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length >= 2) {
        const parseLine = (line: string): string[] => {
          const entries: string[] = [];
          let cur = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
              inQuotes = !inQuotes;
            } else if (c === "," && !inQuotes) {
              entries.push(cur.trim());
              cur = "";
            } else {
              cur += c;
            }
          }
          entries.push(cur.trim());
          return entries;
        };

        const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
        const recordIdIdx = headers.findIndex((h) => h === "record_id" || h === "id");
        const typeIdx = headers.findIndex((h) => h === "type" || h === "record_type");
        const authorIdx = headers.findIndex(
          (h) => h === "author" || h === "author_handle" || h === "user" || h === "owner",
        );
        const actorIdx = headers.findIndex(
          (h) => h === "actor_account_id" || h === "account_id" || h === "identity",
        );
        const contentIdx = headers.findIndex(
          (h) => h === "content" || h === "details" || h === "description" || h === "message",
        );
        const tsIdx = headers.findIndex(
          (h) => h === "ts" || h === "timestamp" || h === "date" || h === "created_at",
        );

        for (let i = 1; i < lines.length; i++) {
          const cols = parseLine(lines[i]);
          if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

          const recordId =
            recordIdIdx >= 0 && cols[recordIdIdx]
              ? cols[recordIdIdx]
              : `rec_${path.parse(filename).name}_row${i}`;
          let rawType = typeIdx >= 0 && cols[typeIdx] ? cols[typeIdx].toLowerCase() : "deploy_log";
          if (!["commit", "ticket", "deploy_log", "policy"].includes(rawType)) {
            rawType = "deploy_log";
          }

          let ts = timestamp;
          if (tsIdx >= 0 && cols[tsIdx]) {
            const parsedD = new Date(cols[tsIdx]);
            if (!isNaN(parsedD.getTime())) {
              ts = parsedD.toISOString();
            }
          }

          const author = authorIdx >= 0 && cols[authorIdx] ? cols[authorIdx] : null;
          const actor = actorIdx >= 0 && cols[actorIdx] ? cols[actorIdx] : null;
          const rowContent =
            contentIdx >= 0 && cols[contentIdx]
              ? cols[contentIdx]
              : headers.map((h, hIdx) => `${h}: ${cols[hIdx] || ""}`).join(", ");

          const candidate = {
            record_id: String(recordId),
            type: rawType as EvidenceRecordType,
            ts,
            author_handle: author,
            assignee_handle: null,
            actor_account_id: actor,
            content: rowContent,
            structured: true,
          };

          const validated = EvidenceRecordSchema.safeParse(candidate);
          if (validated.success) {
            records.push(validated.data);
          }
        }
      }
    } else {
      // .log and .txt parsing
      // Split on common log entry delimiters
      const chunks = content
        .split(/(?=commit\s+[a-f0-9]{7,}|TICKET-[0-9]+|\[SYSTEM|\bAUDIT RECORD\b)/i)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const itemsToProcess = chunks.length > 0 ? chunks : [content.trim()];

      for (let idx = 0; idx < itemsToProcess.length; idx++) {
        const chunk = itemsToProcess[idx];
        let detectedType: EvidenceRecordType = "deploy_log";
        let detectedAuthor: string | null = null;
        let detectedActor: string | null = null;

        if (/commit\s+[a-f0-9]+/i.test(chunk)) {
          detectedType = "commit";
          const authorMatch = chunk.match(/Author:\s*([^<\n]+)(?:<([^>]+)>)?/i);
          if (authorMatch) {
            detectedAuthor = authorMatch[1].trim();
          }
        } else if (/TICKET-[0-9]+/i.test(chunk)) {
          detectedType = "ticket";
          const requesterMatch = chunk.match(/Requester:\s*([^\n]+)/i);
          if (requesterMatch) {
            detectedAuthor = requesterMatch[1].trim();
          }
        } else if (/policy|security audit/i.test(chunk)) {
          detectedType = "policy";
        }

        const actorMatch = chunk.match(/\bacc_[a-zA-Z0-9_-]+\b/);
        if (actorMatch) {
          detectedActor = actorMatch[0];
        }

        const recordId = `rec_${path.parse(filename).name}_${idx + 1}`;
        const recCandidate = {
          record_id: recordId,
          type: detectedType,
          ts: timestamp,
          author_handle: detectedAuthor,
          assignee_handle: null,
          actor_account_id: detectedActor,
          content: chunk,
          structured: false,
        };

        const validated = EvidenceRecordSchema.safeParse(recCandidate);
        if (validated.success) {
          records.push(validated.data);
        }
      }
    }

    return records;
  }

  async getDiscoveredAccountsForOwner(
    callerOwnerId: string,
    query: AccountsQuery,
  ): Promise<AccountsResponse> {
    const { chapter, status, search, page, limit } = query;
    const cleanSearch = search ? search.trim().toLowerCase() : "";

    const ownerInvs = Array.from(this.investigations.values()).filter(
      (inv) => inv.owner_id === callerOwnerId && !inv.is_demo,
    );

    const accountsMap = new Map<string, ArchiveAccount>();
    for (const inv of ownerInvs) {
      const findings = this.investigationFindings.get(inv.investigation_id);
      if (findings && findings.discovered_accounts) {
        for (const acc of findings.discovered_accounts) {
          accountsMap.set(acc.account_id, acc);
        }
      }
    }

    const allAccounts = Array.from(accountsMap.values());
    const filtered = allAccounts.filter((acc) => {
      if (chapter && chapter !== "ALL" && acc.ghost_type !== chapter) return false;
      if (status && status !== "ALL" && acc.owner_status !== status) return false;
      if (cleanSearch) {
        const matchesId = acc.account_id.toLowerCase().includes(cleanSearch);
        const matchesOwner = Boolean(
          acc.owner_name && acc.owner_name.toLowerCase().includes(cleanSearch),
        );
        const matchesPurpose = Boolean(
          acc.purpose && acc.purpose.toLowerCase().includes(cleanSearch),
        );
        const matchesQuote = acc.primary_quote.toLowerCase().includes(cleanSearch);
        const matchesKind = acc.kind.toLowerCase().includes(cleanSearch);
        const matchesTags = acc.tags.some((t) => t.toLowerCase().includes(cleanSearch));
        if (
          !matchesId &&
          !matchesOwner &&
          !matchesPurpose &&
          !matchesQuote &&
          !matchesKind &&
          !matchesTags
        ) {
          return false;
        }
      }
      return true;
    });

    filtered.sort((a, b) => a.account_id.localeCompare(b.account_id));

    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedData = startIndex >= total ? [] : filtered.slice(startIndex, startIndex + limit);

    return {
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters: {
        chapter: chapter || "ALL",
        status: status || "ALL",
        search: search || "",
      },
      meta: {
        synthetic: false,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async createApprovalRequest(
    investigationId: string,
    input: CreateApprovalInput,
    requestingUserId: string,
  ): Promise<ApprovalRequest> {
    const inv = await this.findInvestigationById(investigationId);
    if (!inv) throw new Error("Investigation not found");

    const findings = await this.getFindingsByInvestigationId(investigationId);
    const targetAccount = (findings?.discovered_accounts || []).find(
      (a) => a.account_id === input.account_id,
    );

    const now = new Date().toISOString();
    const requestId = `appr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const req: ApprovalRequest = {
      request_id: requestId,
      investigation_id: investigationId,
      account_id: input.account_id,
      proposed_action: input.proposed_action,
      evidence_references: (findings?.records || [])
        .filter(
          (r) => r.actor_account_id === input.account_id || r.content.includes(input.account_id),
        )
        .map((r) => r.record_id),
      verification_state: targetAccount?.owner_status || "no_evidence",
      gemma_summary:
        targetAccount?.purpose || `Simulated sandbox remediation proposal for ${input.account_id}`,
      tabpfn_priority:
        targetAccount?.priority_score != null
          ? {
              priority_score: targetAccount.priority_score,
              priority_rank: targetAccount.priority_rank || 1,
              triage_tier: targetAccount.triage_tier || "ROUTINE",
            }
          : null,
      requesting_user_id: requestingUserId,
      approver_id: null,
      decision: "pending",
      decision_timestamp: null,
      decision_reason: input.reason || null,
      execution_status: "not_started",
      execution_result: null,
      audit_history: [
        {
          timestamp: now,
          actor: requestingUserId,
          action: "APPROVAL_PROPOSED",
          details: `Remediation proposed: ${input.proposed_action} for ${input.account_id}`,
        },
      ],
      created_at: now,
      updated_at: now,
    };

    this.approvalRequests.set(requestId, req);
    return req;
  }

  async listApprovalRequests(investigationId: string): Promise<ApprovalRequest[]> {
    return Array.from(this.approvalRequests.values()).filter(
      (r) => r.investigation_id === investigationId,
    );
  }

  async findApprovalRequestById(requestId: string): Promise<ApprovalRequest | null> {
    return this.approvalRequests.get(requestId) || null;
  }

  async decideApprovalRequest(
    requestId: string,
    decision: "approved" | "rejected",
    approverId: string,
    reason?: string,
  ): Promise<ApprovalRequest> {
    const req = this.approvalRequests.get(requestId);
    if (!req) throw new Error("Approval request not found");
    if (req.decision !== "pending") {
      throw new Error(`Invalid state transition: Request is already ${req.decision}`);
    }

    const now = new Date().toISOString();
    req.decision = decision;
    req.approver_id = approverId;
    req.decision_timestamp = now;
    req.decision_reason = reason || null;
    req.updated_at = now;

    req.audit_history.push({
      timestamp: now,
      actor: approverId,
      action: decision === "approved" ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
      details: `Decision by ${approverId}: ${decision.toUpperCase()}${reason ? ` (${reason})` : ""}`,
    });

    if (decision === "approved") {
      req.execution_status = "executing";
      try {
        const outcome = await SandboxRemediationAdapter.executeSimulatedRemediation(
          req.proposed_action,
          req.account_id,
          req.investigation_id,
          approverId,
        );
        req.execution_status = "completed";
        req.execution_result = outcome;
        req.audit_history.push({
          timestamp: outcome.executed_at,
          actor: "SANDBOX_EXECUTOR",
          action: "SANDBOX_SIMULATION_COMPLETED",
          details: `Simulated action ${req.proposed_action} completed in sandbox ${outcome.sandbox_id}`,
        });
      } catch (err: unknown) {
        req.execution_status = "failed";
        const msg = err instanceof Error ? err.message : "Execution failed";
        req.audit_history.push({
          timestamp: new Date().toISOString(),
          actor: "SANDBOX_EXECUTOR",
          action: "SANDBOX_SIMULATION_FAILED",
          details: `Sandbox execution failed: ${msg}`,
        });
      }
    }

    this.approvalRequests.set(requestId, req);
    return req;
  }
}
