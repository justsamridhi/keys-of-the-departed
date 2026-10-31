import { Case, EvidenceRecord } from "@keys/contracts";
import { SYNTHETIC_CASES, SYNTHETIC_RECORDS } from "../fixtures/syntheticCases.js";
import { DatabaseUnavailableError } from "./unavailableInvestigationsRepository.js";

export interface CasesRepository {
  findCaseById(id: string): Promise<Case | null>;
  findRecordById(id: string): Promise<EvidenceRecord | null>;
  findRecordsByCaseId(caseId: string): Promise<EvidenceRecord[]>;
}

export class FixtureCasesRepository implements CasesRepository {
  private readonly cases: Record<string, Case>;
  private readonly records: Record<string, EvidenceRecord>;

  constructor(
    cases: Record<string, Case> = SYNTHETIC_CASES,
    records: Record<string, EvidenceRecord> = SYNTHETIC_RECORDS,
  ) {
    this.cases = cases;
    this.records = records;
  }

  async findCaseById(id: string): Promise<Case | null> {
    const c = this.cases[id];
    return c || null;
  }

  async findRecordById(id: string): Promise<EvidenceRecord | null> {
    const r = this.records[id];
    return r || null;
  }

  async findRecordsByCaseId(caseId: string): Promise<EvidenceRecord[]> {
    const c = this.cases[caseId];
    if (!c) return [];

    const recordIds = new Set<string>();
    c.claims_accepted.forEach((cl) => recordIds.add(cl.record_id));
    c.claims_removed.forEach((cl) => recordIds.add(cl.record_id));

    const result: EvidenceRecord[] = [];
    for (const rid of recordIds) {
      if (this.records[rid]) {
        result.push(this.records[rid]);
      }
    }
    return result;
  }
}

/**
 * Unavailable repository for production environments without configured MongoDB.
 * Never silently serves synthetic fixtures for real production data.
 */
export class UnavailableCasesRepository implements CasesRepository {
  async findCaseById(_id: string): Promise<Case | null> {
    throw new DatabaseUnavailableError(
      "MongoDB Atlas is required for persistent production case data. Database is currently unavailable or unconfigured.",
    );
  }

  async findRecordById(_id: string): Promise<EvidenceRecord | null> {
    throw new DatabaseUnavailableError(
      "MongoDB Atlas is required for persistent production record data. Database is currently unavailable or unconfigured.",
    );
  }

  async findRecordsByCaseId(_caseId: string): Promise<EvidenceRecord[]> {
    throw new DatabaseUnavailableError(
      "MongoDB Atlas is required for persistent production record data. Database is currently unavailable or unconfigured.",
    );
  }
}
