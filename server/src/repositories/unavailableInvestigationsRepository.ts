import {
  AccountsQuery,
  AccountsResponse,
  CreateInvestigationInput,
  DashboardStats,
  DashboardStatsSchema,
  EvidenceRecord,
  Investigation,
  InvestigationFindings,
  SingleFileInput,
  UploadedFile,
  ApprovalRequest,
  CreateApprovalInput,
} from "@keys/contracts";
import { InvestigationsRepository } from "./investigationsRepository.js";
import {
  DEMO_INVESTIGATION_ID,
  SYNTHETIC_DEMO_FINDINGS,
  SYNTHETIC_DEMO_INVESTIGATION,
} from "../fixtures/syntheticInvestigations.js";
import { SYNTHETIC_ACCOUNTS } from "../fixtures/syntheticAccounts.js";

export class DatabaseUnavailableError extends Error {
  constructor(
    message = "Database unavailable: MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
  ) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export function isDatabaseUnavailableError(err: unknown): boolean {
  if (err instanceof DatabaseUnavailableError) return true;
  if (!err || typeof err !== "object") return false;
  const errorObj = err as { name?: string; message?: string; code?: string | number };
  const name = errorObj.name || "";
  const message = errorObj.message || "";

  return (
    name === "DatabaseUnavailableError" ||
    name === "MongoServerSelectionError" ||
    name === "MongoNetworkError" ||
    name === "MongoTimeoutError" ||
    name === "MongoNotConnectedError" ||
    name === "MongoTopologyClosedError" ||
    message.includes("topology was destroyed") ||
    message.includes("connection closed") ||
    message.includes("not connected") ||
    message.includes("ECONNREFUSED") ||
    message.includes("timed out") ||
    message.includes("Database unavailable") ||
    message.includes("SSL alert number 80")
  );
}

/**
 * Fallback repository used when MongoDB is unconfigured or unavailable.
 * Allows safe public exploration of synthetic demo fixtures, but strictly
 * rejects real user investigation operations with DatabaseUnavailableError (HTTP 503).
 */
export class UnavailableInvestigationsRepository implements InvestigationsRepository {
  async createInvestigation(
    _input: CreateInvestigationInput,
    _ownerId?: string,
  ): Promise<Investigation> {
    throw new DatabaseUnavailableError();
  }

  async listInvestigations(
    callerOwnerId?: string,
    demoFilter?: "true" | "false",
  ): Promise<Investigation[]> {
    if (demoFilter === "false" || callerOwnerId) {
      throw new DatabaseUnavailableError();
    }
    // Return explicit synthetic demo baseline
    return [SYNTHETIC_DEMO_INVESTIGATION];
  }

  async findInvestigationById(id: string): Promise<Investigation | null> {
    if (id === DEMO_INVESTIGATION_ID) {
      return SYNTHETIC_DEMO_INVESTIGATION;
    }
    throw new DatabaseUnavailableError();
  }

  async addUploadedFiles(
    _investigationId: string,
    _files: SingleFileInput[],
  ): Promise<{
    investigation: Investigation;
    files: UploadedFile[];
    extracted_records: EvidenceRecord[];
    errors: string[];
  }> {
    throw new DatabaseUnavailableError();
  }

  async findFilesByInvestigationId(investigationId: string): Promise<UploadedFile[]> {
    if (investigationId === DEMO_INVESTIGATION_ID) {
      return SYNTHETIC_DEMO_FINDINGS.files;
    }
    throw new DatabaseUnavailableError();
  }

  async processInvestigation(_investigationId: string): Promise<InvestigationFindings> {
    throw new DatabaseUnavailableError();
  }

  async getFindingsByInvestigationId(
    investigationId: string,
  ): Promise<InvestigationFindings | null> {
    if (investigationId === DEMO_INVESTIGATION_ID) {
      return SYNTHETIC_DEMO_FINDINGS;
    }
    throw new DatabaseUnavailableError();
  }

  async getDashboardStats(callerOwnerId?: string): Promise<DashboardStats> {
    if (callerOwnerId) {
      throw new DatabaseUnavailableError();
    }

    // Unauthenticated/demo dashboard stats
    const accounts = SYNTHETIC_ACCOUNTS;
    const ghostDist = { LOST: 0, FORGOTTEN: 0, LONELY: 0, INNOCENT: 0 };
    const evidenceDist = { verified: 0, supported: 0, conflicting: 0, no_evidence: 0 };
    let reviewRequired = 0;

    accounts.forEach((acc) => {
      if (acc.ghost_type in ghostDist) {
        ghostDist[acc.ghost_type as keyof typeof ghostDist]++;
      }
      if (acc.owner_status in evidenceDist) {
        evidenceDist[acc.owner_status as keyof typeof evidenceDist]++;
      }
      if (acc.owner_status === "conflicting" || acc.owner_status === "no_evidence") {
        reviewRequired++;
      }
    });

    const payload: DashboardStats = {
      total_identities: accounts.length,
      ghost_distribution: ghostDist,
      evidence_status_distribution: evidenceDist,
      review_required_count: reviewRequired,
      recent_investigations: [SYNTHETIC_DEMO_INVESTIGATION],
      meta: {
        synthetic: true,
        timestamp: new Date().toISOString(),
      },
    };

    return DashboardStatsSchema.parse(payload);
  }

  async getDiscoveredAccountsForOwner(
    _callerOwnerId: string,
    _query: AccountsQuery,
  ): Promise<AccountsResponse> {
    throw new DatabaseUnavailableError();
  }

  async createApprovalRequest(
    _investigationId: string,
    _input: CreateApprovalInput,
    _requestingUserId: string,
  ): Promise<ApprovalRequest> {
    throw new DatabaseUnavailableError();
  }

  async listApprovalRequests(investigationId: string): Promise<ApprovalRequest[]> {
    if (investigationId === DEMO_INVESTIGATION_ID) {
      return [];
    }
    throw new DatabaseUnavailableError();
  }

  async findApprovalRequestById(_requestId: string): Promise<ApprovalRequest | null> {
    throw new DatabaseUnavailableError();
  }

  async decideApprovalRequest(
    _requestId: string,
    _decision: "approved" | "rejected",
    _approverId: string,
    _reason?: string,
  ): Promise<ApprovalRequest> {
    throw new DatabaseUnavailableError();
  }
}
