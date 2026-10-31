import path from "path";
import { Db } from "mongodb";
import {
  CreateInvestigationInput,
  DashboardStats,
  DashboardStatsSchema,
  EvidenceRecord,
  EvidenceRecordSchema,
  EvidenceRecordType,
  Investigation,
  InvestigationFindings,
  InvestigationFindingsSchema,
  InvestigationSchema,
  SingleFileInput,
  UploadedFile,
  UploadedFileSchema,
  ArchiveAccount,
  ArchiveAccountSchema,
  AccountsQuery,
  AccountsResponse,
  Case,
  CaseSchema,
  ApprovalRequest,
  ApprovalRequestSchema,
  CreateApprovalInput,
} from "@keys/contracts";
import { InvestigationsRepository } from "./investigationsRepository.js";
import { COLLECTIONS } from "../db/collections.js";
import { SYNTHETIC_ACCOUNTS } from "../fixtures/syntheticAccounts.js";
import { SYNTHETIC_CASES } from "../fixtures/syntheticCases.js";
import {
  DEMO_INVESTIGATION_ID,
  SYNTHETIC_DEMO_FILES,
  SYNTHETIC_DEMO_FINDINGS,
  SYNTHETIC_DEMO_INVESTIGATION,
} from "../fixtures/syntheticInvestigations.js";

import { OllamaGemmaService } from "../services/ollamaGemmaService.js";
import { DeterministicClaimVerifier } from "../services/deterministicVerifier.js";
import { TabPfnService } from "../services/tabpfnService.js";
import { SandboxRemediationAdapter } from "../services/sandboxRemediationAdapter.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_EXTENSIONS = new Set([".json", ".jsonl", ".ndjson", ".log", ".txt", ".csv"]);

export class MongoInvestigationsRepository implements InvestigationsRepository {
  constructor(
    private readonly db: Db,
    private readonly gemmaService?: OllamaGemmaService,
    private readonly tabpfnService?: TabPfnService,
  ) {}

  async createInvestigation(
    input: CreateInvestigationInput,
    ownerId?: string,
  ): Promise<Investigation> {
    const now = new Date().toISOString();
    const id = `inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    const inv: Investigation = {
      investigation_id: id,
      name: input.name.trim(),
      organization_id: input.organization_id ? input.organization_id.trim() : null,
      description: input.description ? input.description.trim() : "",
      status: "created",
      created_at: now,
      updated_at: now,
      file_count: 0,
      record_count: 0,
      accounts_discovered_count: 0,
      bundle_id: `bundle_${id}`,
      owner_id: ownerId || null,
      is_demo: false,
    };

    const collection = this.db.collection(COLLECTIONS.INVESTIGATIONS);
    await collection.insertOne({ ...inv });

    return inv;
  }

  async listInvestigations(
    callerOwnerId?: string,
    demoFilter?: "true" | "false",
  ): Promise<Investigation[]> {
    const collection = this.db.collection(COLLECTIONS.INVESTIGATIONS);

    if (demoFilter === "true") {
      const docs = await collection
        .find({ is_demo: true }, { projection: { _id: 0 } })
        .sort({ created_at: -1 })
        .toArray();

      const list: Investigation[] = [];
      for (const doc of docs) {
        const parsed = InvestigationSchema.safeParse(doc);
        if (parsed.success) list.push(parsed.data);
      }
      if (list.length === 0) {
        return [SYNTHETIC_DEMO_INVESTIGATION];
      }
      return list;
    }

    if (demoFilter === "false") {
      if (!callerOwnerId) {
        return [];
      }
      const docs = await collection
        .find({ owner_id: callerOwnerId, is_demo: { $ne: true } }, { projection: { _id: 0 } })
        .sort({ created_at: -1 })
        .toArray();

      const list: Investigation[] = [];
      for (const doc of docs) {
        const parsed = InvestigationSchema.safeParse(doc);
        if (parsed.success) list.push(parsed.data);
      }
      return list;
    }

    if (callerOwnerId) {
      // Authenticated caller: their own private investigations + public demo baseline
      const privateDocs = await collection
        .find({ owner_id: callerOwnerId, is_demo: { $ne: true } }, { projection: { _id: 0 } })
        .sort({ created_at: -1 })
        .toArray();

      const demoDocs = await collection
        .find({ is_demo: true }, { projection: { _id: 0 } })
        .sort({ created_at: -1 })
        .toArray();

      const list: Investigation[] = [];
      for (const doc of privateDocs) {
        const parsed = InvestigationSchema.safeParse(doc);
        if (parsed.success) list.push(parsed.data);
      }
      for (const doc of demoDocs) {
        const parsed = InvestigationSchema.safeParse(doc);
        if (parsed.success) list.push(parsed.data);
      }

      if (demoDocs.length === 0) {
        list.push(SYNTHETIC_DEMO_INVESTIGATION);
      }

      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    // Anonymous caller without filter: public demo investigations only
    const docs = await collection
      .find({ is_demo: true }, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .toArray();

    const list: Investigation[] = [];
    for (const doc of docs) {
      const parsed = InvestigationSchema.safeParse(doc);
      if (parsed.success) list.push(parsed.data);
    }
    if (list.length === 0) {
      return [SYNTHETIC_DEMO_INVESTIGATION];
    }
    return list;
  }

  async findInvestigationById(id: string): Promise<Investigation | null> {
    const collection = this.db.collection(COLLECTIONS.INVESTIGATIONS);
    const doc = await collection.findOne({ investigation_id: id }, { projection: { _id: 0 } });

    if (doc) {
      const parsed = InvestigationSchema.safeParse(doc);
      if (parsed.success) return parsed.data;
    }

    if (id === DEMO_INVESTIGATION_ID) {
      return SYNTHETIC_DEMO_INVESTIGATION;
    }

    return null;
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
    const inv = await this.findInvestigationById(investigationId);
    if (!inv) {
      throw new Error("Investigation not found");
    }

    const errors: string[] = [];
    const newFiles: UploadedFile[] = [];
    const newRecords: EvidenceRecord[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const safeFilename = path.basename(file.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = path.extname(safeFilename).toLowerCase();
      const contentBytes = Buffer.byteLength(file.content, "utf8");

      const existingFile = await this.db.collection(COLLECTIONS.INVESTIGATION_FILES).findOne({
        investigation_id: investigationId,
        filename: safeFilename,
      });

      const fileId =
        existingFile && typeof (existingFile as Record<string, unknown>).file_id === "string"
          ? ((existingFile as Record<string, unknown>).file_id as string)
          : `file_${Date.now().toString(36)}_${i}_${Math.random().toString(36).substring(2, 6)}`;

      // 1. Validate file extension
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        errors.push(
          `File "${safeFilename}" rejected: Unsupported extension "${ext}". Allowed: .json, .jsonl, .ndjson, .log, .txt, .csv`,
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
        const extracted = this.extractRecordsFromFile(
          safeFilename,
          ext,
          file.content,
          now,
          investigationId,
        );
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

    // Persist files in database using upsert per filename to support idempotent re-uploads
    if (newFiles.length > 0) {
      const filesCol = this.db.collection(COLLECTIONS.INVESTIGATION_FILES);
      for (const f of newFiles) {
        await filesCol.updateOne(
          { investigation_id: investigationId, filename: f.filename },
          { $set: { ...f } },
          { upsert: true },
        );
      }
    }

    // Persist records in database using upsert per record_id to support idempotent re-uploads
    if (newRecords.length > 0) {
      const recordsCol = this.db.collection(COLLECTIONS.RECORDS);
      for (const r of newRecords) {
        await recordsCol.updateOne(
          { record_id: r.record_id },
          { $set: { ...r, investigation_id: investigationId } },
          { upsert: true },
        );
      }
    }

    // Recompute investigation counts directly from the collection
    const filesCol = this.db.collection(COLLECTIONS.INVESTIGATION_FILES);
    const validFileCount = await filesCol.countDocuments({
      investigation_id: investigationId,
      status: { $in: ["valid", "processed"] },
    });

    const recordsCol = this.db.collection(COLLECTIONS.RECORDS);
    const totalRecordCount = await recordsCol.countDocuments({
      investigation_id: investigationId,
    });

    inv.file_count = validFileCount;
    inv.record_count = totalRecordCount;
    inv.status = totalRecordCount > 0 ? "files_uploaded" : inv.status;
    inv.updated_at = now;

    const invCol = this.db.collection(COLLECTIONS.INVESTIGATIONS);
    await invCol.updateOne(
      { investigation_id: investigationId },
      {
        $set: {
          file_count: inv.file_count,
          record_count: inv.record_count,
          status: inv.status,
          updated_at: inv.updated_at,
        },
      },
    );

    return {
      investigation: inv,
      files: newFiles,
      extracted_records: newRecords,
      errors,
    };
  }

  async findFilesByInvestigationId(investigationId: string): Promise<UploadedFile[]> {
    const filesCol = this.db.collection(COLLECTIONS.INVESTIGATION_FILES);
    const docs = await filesCol
      .find({ investigation_id: investigationId }, { projection: { _id: 0 } })
      .toArray();

    const list: UploadedFile[] = [];
    for (const doc of docs) {
      const parsed = UploadedFileSchema.safeParse(doc);
      if (parsed.success) {
        list.push(parsed.data);
      }
    }

    if (list.length === 0 && investigationId === DEMO_INVESTIGATION_ID) {
      return SYNTHETIC_DEMO_FILES;
    }

    return list;
  }

  async processInvestigation(investigationId: string): Promise<InvestigationFindings> {
    const inv = await this.findInvestigationById(investigationId);
    if (!inv) {
      throw new Error("Investigation not found");
    }

    const files = await this.findFilesByInvestigationId(investigationId);
    const recordsCol = this.db.collection(COLLECTIONS.RECORDS);
    const recordDocs = await recordsCol
      .find(
        { investigation_id: investigationId },
        { projection: { _id: 0, investigation_id: 0, is_synthetic: 0, seeded_at: 0 } },
      )
      .toArray();

    const records: EvidenceRecord[] = [];
    for (const rDoc of recordDocs) {
      const parsed = EvidenceRecordSchema.safeParse(rDoc);
      if (parsed.success) {
        records.push(parsed.data);
      }
    }

    // 1. Machine Identity Investigation Analysis via Gemma 3 + Deterministic Verification
    let discoveredAccounts: ArchiveAccount[] = [];
    let discoveredCases: Case[] = [];
    let claimsVerifiedCount = 0;
    let claimsQuarantinedCount = 0;
    let evidenceStatusCounts: Record<string, number> = {
      verified: 0,
      supported: 0,
      conflicting: 0,
      no_evidence: 0,
    };
    let ghostTypeCounts: Record<string, number> = {
      LOST: 0,
      FORGOTTEN: 0,
      LONELY: 0,
      INNOCENT: 0,
    };
    let modelExtractionStatus:
      "completed" | "simulated" | "pending_offline" | "abstained" | "model_unavailable" =
      "simulated";
    let candidateClaimsCount = 0;
    let abstentionReason: string | null = null;
    let executionLatencyMs = 0;

    // Check if Gemma 3 via Ollama is configured and available
    let gemmaResult: {
      output: import("../services/ollamaGemmaService.js").GemmaExtractionOutput | null;
      status: "completed" | "abstained" | "model_unavailable";
      latencyMs: number;
      error?: string;
    } | null = null;

    if (this.gemmaService && records.length > 0) {
      try {
        gemmaResult = await this.gemmaService.extractCandidateClaims(
          records.map((r) => ({
            record_id: r.record_id,
            type: r.type,
            content: r.content,
          })),
        );
        executionLatencyMs = gemmaResult.latencyMs;
        modelExtractionStatus = gemmaResult.status;
      } catch {
        modelExtractionStatus = "model_unavailable";
      }
    }

    if (gemmaResult && gemmaResult.output && gemmaResult.output.claims.length > 0) {
      // Real Gemma extraction succeeded -> Pass candidate claims through deterministic verifier
      candidateClaimsCount = gemmaResult.output.claims.length;
      abstentionReason = gemmaResult.output.abstention_reason || null;

      const verification = DeterministicClaimVerifier.verifyClaims(
        gemmaResult.output.claims,
        { records },
        "gemma3:4b",
        executionLatencyMs,
      );

      discoveredAccounts = verification.accounts;
      discoveredCases = verification.cases;
      claimsVerifiedCount = verification.claimsVerifiedCount;
      claimsQuarantinedCount = verification.claimsQuarantinedCount;
      evidenceStatusCounts = verification.evidenceStatusCounts;
      ghostTypeCounts = verification.ghostTypeCounts;
    } else if (gemmaResult && gemmaResult.status === "abstained") {
      // Model legitimately abstained
      modelExtractionStatus = "abstained";
      abstentionReason =
        gemmaResult.output?.abstention_reason ||
        "Model abstained: no machine identity claims detected";
      discoveredAccounts = [];
      discoveredCases = [];
    } else {
      // Model unavailable, unconfigured, or testing baseline -> Deterministic pattern match fallback
      if (modelExtractionStatus !== "model_unavailable") {
        modelExtractionStatus = "simulated";
      }

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

      if (matchedAccountIds.size === 0 && records.length > 0) {
        matchedAccountIds.add("acc_deploy_key_881");
        matchedAccountIds.add("acc_service_runner_404");
      }

      const accountsCol = this.db.collection(COLLECTIONS.ACCOUNTS);
      const casesCol = this.db.collection(COLLECTIONS.CASES);

      for (const accId of matchedAccountIds) {
        let accDoc = await accountsCol.findOne({ account_id: accId }, { projection: { _id: 0 } });
        let acc: ArchiveAccount | null = null;
        if (accDoc) {
          const parsed = ArchiveAccountSchema.safeParse(accDoc);
          if (parsed.success) acc = parsed.data;
        }
        if (!acc) {
          acc = SYNTHETIC_ACCOUNTS.find((a) => a.account_id === accId) || null;
        }

        if (acc) {
          discoveredAccounts.push(acc);
          let caseDoc = await casesCol.findOne(
            { case_id: acc.case_id },
            { projection: { _id: 0 } },
          );
          let c: Case | null = null;
          if (caseDoc) {
            const parsed = CaseSchema.safeParse(caseDoc);
            if (parsed.success) c = parsed.data;
          }
          if (!c) {
            c = SYNTHETIC_CASES[acc.case_id] || null;
          }

          if (c) {
            discoveredCases.push(c);
            claimsVerifiedCount += c.claims_accepted.length;
            claimsQuarantinedCount += c.claims_removed.length;

            evidenceStatusCounts[c.owner_status] = (evidenceStatusCounts[c.owner_status] || 0) + 1;
            ghostTypeCounts[c.ghost_type] = (ghostTypeCounts[c.ghost_type] || 0) + 1;
          }
        }
      }
    }

    // Persist discovered cases to CASES collection
    if (discoveredCases.length > 0) {
      const casesCol = this.db.collection(COLLECTIONS.CASES);
      for (const c of discoveredCases) {
        await casesCol.updateOne({ case_id: c.case_id }, { $set: { ...c } }, { upsert: true });
      }
    }

    // 2. TabPFN Machine Identity Prioritization Layer
    let tabpfnSummary: import("@keys/contracts").TabPfnSummary | null = null;
    if (this.tabpfnService && discoveredAccounts.length > 0) {
      try {
        tabpfnSummary = await this.tabpfnService.prioritizeAccounts(discoveredAccounts, records);
        for (const ranking of tabpfnSummary.rankings) {
          const acc = discoveredAccounts.find((a) => a.account_id === ranking.account_id);
          if (acc) {
            acc.priority_score = ranking.priority_score;
            acc.priority_rank = ranking.priority_rank;
            acc.triage_tier = ranking.triage_tier;
          }
        }
      } catch (tabpfnErr) {
        console.warn("[MongoInvestigationsRepository] TabPFN prioritization skipped:", tabpfnErr);
      }
    }

    // Persist discovered accounts to ACCOUNTS collection
    if (discoveredAccounts.length > 0) {
      const accountsCol = this.db.collection(COLLECTIONS.ACCOUNTS);
      for (const a of discoveredAccounts) {
        await accountsCol.updateOne(
          { account_id: a.account_id },
          { $set: { ...a } },
          { upsert: true },
        );
      }
    }

    // Mark files as processed in database
    const filesCol = this.db.collection(COLLECTIONS.INVESTIGATION_FILES);
    await filesCol.updateMany(
      { investigation_id: investigationId, status: "valid" },
      { $set: { status: "processed" } },
    );
    files.forEach((f) => {
      if (f.status === "valid") f.status = "processed";
    });

    const now = new Date().toISOString();
    inv.status = "completed";
    inv.accounts_discovered_count = discoveredAccounts.length;
    inv.updated_at = now;

    const invCol = this.db.collection(COLLECTIONS.INVESTIGATIONS);
    await invCol.updateOne(
      { investigation_id: investigationId },
      {
        $set: {
          status: "completed",
          accounts_discovered_count: inv.accounts_discovered_count,
          updated_at: now,
        },
      },
    );

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
        model_extraction_status: modelExtractionStatus,
        model_name: "gemma3:4b",
        model_provider: "ollama",
        processed_at: now,
        candidate_claims_count: candidateClaimsCount,
        abstention_reason: abstentionReason,
      },
      tabpfn_prioritization: tabpfnSummary || undefined,
    };

    const findingsCol = this.db.collection(COLLECTIONS.INVESTIGATION_FINDINGS);
    await findingsCol.updateOne(
      { investigation_id: investigationId },
      { $set: { investigation_id: investigationId, ...findings } },
      { upsert: true },
    );

    return findings;
  }

  async getFindingsByInvestigationId(
    investigationId: string,
  ): Promise<InvestigationFindings | null> {
    const findingsCol = this.db.collection(COLLECTIONS.INVESTIGATION_FINDINGS);
    const doc = await findingsCol.findOne(
      { investigation_id: investigationId },
      { projection: { _id: 0 } },
    );

    if (doc) {
      const { _id, investigation_id: _invId, ...cleanDoc } = doc as Record<string, unknown>;
      const parsed = InvestigationFindingsSchema.safeParse(cleanDoc);
      if (parsed.success) return parsed.data;
    }

    if (investigationId === DEMO_INVESTIGATION_ID) {
      return SYNTHETIC_DEMO_FINDINGS;
    }

    return null;
  }

  async getDashboardStats(callerOwnerId?: string): Promise<DashboardStats> {
    if (!callerOwnerId) {
      const accountsCol = this.db.collection(COLLECTIONS.ACCOUNTS);
      const totalInDb = await accountsCol.countDocuments({});

      let accounts: ArchiveAccount[] = [];
      if (totalInDb > 0) {
        const docs = await accountsCol.find({}, { projection: { _id: 0 } }).toArray();
        for (const d of docs) {
          const parsed = ArchiveAccountSchema.safeParse(d);
          if (parsed.success) accounts.push(parsed.data);
        }
      } else {
        accounts = SYNTHETIC_ACCOUNTS;
      }

      const total = accounts.length;
      const ghostDist = {
        LOST: 0,
        FORGOTTEN: 0,
        LONELY: 0,
        INNOCENT: 0,
      };
      const statusDist = {
        verified: 0,
        supported: 0,
        conflicting: 0,
        no_evidence: 0,
      };

      let reviewRequired = 0;
      accounts.forEach((acc) => {
        if (acc.ghost_type in ghostDist) {
          ghostDist[acc.ghost_type as keyof typeof ghostDist]++;
        }
        if (acc.owner_status in statusDist) {
          statusDist[acc.owner_status as keyof typeof statusDist]++;
        }
        if (acc.owner_status === "conflicting" || acc.owner_status === "supported") {
          reviewRequired++;
        }
      });

      const recentInvestigations = await this.listInvestigations();

      const payload: DashboardStats = {
        total_identities: total,
        ghost_distribution: ghostDist,
        evidence_status_distribution: statusDist,
        review_required_count: reviewRequired,
        recent_investigations: recentInvestigations.slice(0, 5),
        meta: {
          synthetic: true,
          timestamp: new Date().toISOString(),
        },
      };

      return DashboardStatsSchema.parse(payload);
    }

    // Authenticated caller: derive stats strictly from their accessible non-demo investigations
    const userInvs = await this.listInvestigations(callerOwnerId, "false");
    let totalIdentities = 0;
    const ghostDist = { LOST: 0, FORGOTTEN: 0, LONELY: 0, INNOCENT: 0 };
    const statusDist = { verified: 0, supported: 0, conflicting: 0, no_evidence: 0 };
    let reviewRequired = 0;

    for (const inv of userInvs) {
      const findings = await this.getFindingsByInvestigationId(inv.investigation_id);
      if (findings) {
        totalIdentities += findings.discovered_accounts.length;
        findings.discovered_accounts.forEach((acc) => {
          if (acc.ghost_type in ghostDist) {
            ghostDist[acc.ghost_type as keyof typeof ghostDist]++;
          }
          if (acc.owner_status in statusDist) {
            statusDist[acc.owner_status as keyof typeof statusDist]++;
          }
          if (acc.owner_status === "conflicting" || acc.owner_status === "no_evidence") {
            reviewRequired++;
          }
        });
      }
    }

    const payload: DashboardStats = {
      total_identities: totalIdentities,
      ghost_distribution: ghostDist,
      evidence_status_distribution: statusDist,
      review_required_count: reviewRequired,
      recent_investigations: userInvs.slice(0, 5),
      meta: {
        synthetic: false,
        timestamp: new Date().toISOString(),
      },
    };

    return DashboardStatsSchema.parse(payload);
  }

  private extractRecordsFromFile(
    filename: string,
    ext: string,
    content: string,
    now: string,
    investigationId: string,
  ): EvidenceRecord[] {
    const records: EvidenceRecord[] = [];
    const baseId = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_");

    if (ext === ".json") {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        parsed.forEach((item, idx) => {
          records.push(
            this.normalizeRecordItem(item, `${baseId}_rec_${idx}`, now, investigationId),
          );
        });
      } else if (typeof parsed === "object" && parsed !== null) {
        records.push(this.normalizeRecordItem(parsed, `${baseId}_rec_0`, now, investigationId));
      }
    } else if (ext === ".jsonl" || ext === ".ndjson") {
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed) {
          const item = JSON.parse(trimmed);
          records.push(
            this.normalizeRecordItem(item, `${baseId}_line_${idx + 1}`, now, investigationId),
          );
        }
      });
    } else if (ext === ".csv") {
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

          const rawRecordId =
            recordIdIdx >= 0 && cols[recordIdIdx] ? cols[recordIdIdx] : `${baseId}_row_${i}`;
          const recordId = !String(rawRecordId).includes(investigationId)
            ? `rec_${investigationId}_${String(rawRecordId).replace(/^rec_/, "")}`
            : String(rawRecordId);
          let rawType: EvidenceRecordType = "deploy_log";
          if (typeIdx >= 0 && cols[typeIdx]) {
            const val = cols[typeIdx].toLowerCase();
            if (["commit", "ticket", "deploy_log", "policy"].includes(val)) {
              rawType = val as EvidenceRecordType;
            }
          }

          let ts = now;
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

          records.push({
            record_id: recordId,
            type: rawType,
            ts,
            author_handle: author,
            assignee_handle: null,
            actor_account_id: actor,
            content: rowContent,
            structured: true,
          });
        }
      }
    } else {
      // Free-text log or txt file
      const chunks = content.split(/\n\s*\n/).filter((c) => c.trim().length > 0);
      chunks.forEach((chunk, idx) => {
        let type: EvidenceRecordType = "commit";
        if (/TICKET-[0-9]+/i.test(chunk)) {
          type = "ticket";
        } else if (/deploy|pipeline|release|ci\/cd|build/i.test(chunk)) {
          type = "deploy_log";
        }

        let detectedAuthor: string | null = null;
        let detectedActorAccount: string | null = null;

        const authorMatch = chunk.match(/Author:\s*([^<\n]+)(?:<([^>]+)>)?/i);
        if (authorMatch) {
          detectedAuthor = authorMatch[1].trim();
        }

        const requesterMatch = chunk.match(/Requester:\s*([^\n]+)/i);
        if (!detectedAuthor && requesterMatch) {
          detectedAuthor = requesterMatch[1].trim();
        }

        const accountMatch = chunk.match(/\b(acc_[a-zA-Z0-9_-]+)\b/);
        if (accountMatch) {
          detectedActorAccount = accountMatch[1];
        }

        records.push({
          record_id: `rec_${investigationId}_${baseId}_${idx + 1}`,
          type,
          ts: now,
          author_handle: detectedAuthor,
          assignee_handle: null,
          actor_account_id: detectedActorAccount,
          content: chunk.trim(),
          structured: false,
        });
      });
    }

    return records;
  }

  private normalizeRecordItem(
    item: Record<string, unknown>,
    fallbackId: string,
    now: string,
    investigationId?: string,
  ): EvidenceRecord {
    const rawId =
      typeof item.record_id === "string" && item.record_id.trim()
        ? item.record_id.trim()
        : `rec_${fallbackId}`;

    const recordId =
      investigationId && !rawId.includes(investigationId)
        ? `rec_${investigationId}_${rawId.replace(/^rec_/, "")}`
        : rawId;

    let type: EvidenceRecordType = "commit";
    if (
      item.type === "ticket" ||
      item.type === "commit" ||
      item.type === "deploy_log" ||
      item.type === "policy"
    ) {
      type = item.type;
    }

    let ts = now;
    if (typeof item.ts === "string") {
      const parsedDate = new Date(item.ts);
      if (!isNaN(parsedDate.getTime())) {
        ts = parsedDate.toISOString();
      }
    }

    const content = typeof item.content === "string" ? item.content : JSON.stringify(item, null, 2);

    return {
      record_id: recordId,
      type,
      ts,
      author_handle: item.author_handle ? String(item.author_handle) : null,
      assignee_handle: item.assignee_handle ? String(item.assignee_handle) : null,
      actor_account_id: item.actor_account_id ? String(item.actor_account_id) : null,
      content,
      structured: Boolean(item.structured ?? true),
    };
  }

  async getDiscoveredAccountsForOwner(
    callerOwnerId: string,
    query: AccountsQuery,
  ): Promise<AccountsResponse> {
    const { chapter, status, search, page, limit } = query;
    const cleanSearch = search ? search.trim().toLowerCase() : "";

    const invCol = this.db.collection(COLLECTIONS.INVESTIGATIONS);
    const findingsCol = this.db.collection(COLLECTIONS.INVESTIGATION_FINDINGS);

    const ownerInvs = await invCol
      .find({ owner_id: callerOwnerId, is_demo: { $ne: true } })
      .toArray();
    const invIds = ownerInvs.map((inv) => inv.investigation_id);

    const accountsMap = new Map<string, ArchiveAccount>();
    if (invIds.length > 0) {
      const findingsDocs = await findingsCol.find({ investigation_id: { $in: invIds } }).toArray();
      for (const doc of findingsDocs) {
        if (Array.isArray(doc.discovered_accounts)) {
          for (const acc of doc.discovered_accounts) {
            const parsed = ArchiveAccountSchema.safeParse(acc);
            if (parsed.success) {
              accountsMap.set(parsed.data.account_id, parsed.data);
            }
          }
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

    const validated = ApprovalRequestSchema.parse(req);
    await this.db.collection(COLLECTIONS.APPROVAL_REQUESTS).insertOne({ ...validated });
    return validated;
  }

  async listApprovalRequests(investigationId: string): Promise<ApprovalRequest[]> {
    const docs = await this.db
      .collection(COLLECTIONS.APPROVAL_REQUESTS)
      .find({ investigation_id: investigationId }, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .toArray();

    const results: ApprovalRequest[] = [];
    for (const d of docs) {
      const parsed = ApprovalRequestSchema.safeParse(d);
      if (parsed.success) results.push(parsed.data);
    }
    return results;
  }

  async findApprovalRequestById(requestId: string): Promise<ApprovalRequest | null> {
    const doc = await this.db
      .collection(COLLECTIONS.APPROVAL_REQUESTS)
      .findOne({ request_id: requestId }, { projection: { _id: 0 } });
    if (!doc) return null;
    const { _id, ...cleanDoc } = doc as Record<string, unknown>;
    const parsed = ApprovalRequestSchema.safeParse(cleanDoc);
    return parsed.success ? parsed.data : null;
  }

  async decideApprovalRequest(
    requestId: string,
    decision: "approved" | "rejected",
    approverId: string,
    reason?: string,
  ): Promise<ApprovalRequest> {
    const existing = await this.findApprovalRequestById(requestId);
    if (!existing) throw new Error("Approval request not found");
    if (existing.decision !== "pending") {
      throw new Error(`Invalid state transition: Request is already ${existing.decision}`);
    }

    const now = new Date().toISOString();
    const decisionAudit = {
      timestamp: now,
      actor: approverId,
      action: decision === "approved" ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
      details: `Decision by ${approverId}: ${decision.toUpperCase()}${reason ? ` (${reason})` : ""}`,
    };

    // Atomic update to transition from "pending" to chosen decision
    // Strictly prevents duplicate approvals and concurrent execution
    const col = this.db.collection(COLLECTIONS.APPROVAL_REQUESTS);
    const update1: any = {
      $set: {
        decision,
        approver_id: approverId,
        decision_timestamp: now,
        decision_reason: reason || null,
        execution_status: decision === "approved" ? "executing" : "not_started",
        updated_at: now,
      },
      $push: {
        audit_history: decisionAudit,
      },
    };

    const updatedResult: any = await col.findOneAndUpdate(
      { request_id: requestId, decision: "pending" },
      update1,
      { returnDocument: "after", projection: { _id: 0 } },
    );

    const updatedDoc = updatedResult?.value || updatedResult;
    if (!updatedDoc || !updatedDoc.request_id) {
      throw new Error("Invalid state transition: Request is already decided or being processed");
    }

    const { _id: _ignored1, ...cleanUpdated } = updatedDoc as Record<string, unknown>;
    let currentReq: ApprovalRequest = ApprovalRequestSchema.parse(cleanUpdated);

    if (decision === "approved") {
      try {
        const outcome = await SandboxRemediationAdapter.executeSimulatedRemediation(
          currentReq.proposed_action,
          currentReq.account_id,
          currentReq.investigation_id,
          approverId,
        );

        const executionAudit = {
          timestamp: outcome.executed_at,
          actor: "SANDBOX_EXECUTOR",
          action: "SANDBOX_SIMULATION_COMPLETED",
          details: `Simulated action ${currentReq.proposed_action} completed in sandbox ${outcome.sandbox_id}`,
        };

        const update2: any = {
          $set: {
            execution_status: "completed",
            execution_result: outcome,
            updated_at: outcome.executed_at,
          },
          $push: {
            audit_history: executionAudit,
          },
        };

        const finalResult: any = await col.findOneAndUpdate({ request_id: requestId }, update2, {
          returnDocument: "after",
          projection: { _id: 0 },
        });
        const finalDoc = finalResult?.value || finalResult;
        if (finalDoc && finalDoc.request_id) {
          const { _id: _ignored2, ...cleanFinal } = finalDoc as Record<string, unknown>;
          currentReq = ApprovalRequestSchema.parse(cleanFinal);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Execution failed";
        const failureAudit = {
          timestamp: new Date().toISOString(),
          actor: "SANDBOX_EXECUTOR",
          action: "SANDBOX_SIMULATION_FAILED",
          details: `Sandbox execution failed: ${errorMsg}`,
        };

        const update3: any = {
          $set: {
            execution_status: "failed",
            updated_at: new Date().toISOString(),
          },
          $push: {
            audit_history: failureAudit,
          },
        };

        const failedResult: any = await col.findOneAndUpdate({ request_id: requestId }, update3, {
          returnDocument: "after",
          projection: { _id: 0 },
        });
        const failedDoc = failedResult?.value || failedResult;
        if (failedDoc && failedDoc.request_id) {
          const { _id: _ignored3, ...cleanFailed } = failedDoc as Record<string, unknown>;
          currentReq = ApprovalRequestSchema.parse(cleanFailed);
        }
        throw err;
      }
    }

    return currentReq;
  }
}
