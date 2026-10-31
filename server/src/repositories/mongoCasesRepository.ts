import { Db } from "mongodb";
import { Case, CaseSchema, EvidenceRecord, EvidenceRecordSchema } from "@keys/contracts";
import { CasesRepository } from "./casesRepository.js";
import { COLLECTIONS } from "../db/collections.js";

export class MongoCasesRepository implements CasesRepository {
  constructor(private readonly db: Db) {}

  async findCaseById(id: string): Promise<Case | null> {
    const collection = this.db.collection(COLLECTIONS.CASES);
    const doc = await collection.findOne(
      { case_id: id },
      { projection: { _id: 0, is_synthetic: 0, seeded_at: 0 } },
    );

    if (!doc) {
      return null;
    }

    const parsed = CaseSchema.safeParse(doc);
    return parsed.success ? parsed.data : null;
  }

  async findRecordById(
    id: string,
  ): Promise<(EvidenceRecord & { investigation_id?: string }) | null> {
    const collection = this.db.collection(COLLECTIONS.RECORDS);
    const doc = await collection.findOne(
      { record_id: id },
      { projection: { _id: 0, is_synthetic: 0, seeded_at: 0 } },
    );

    if (!doc) {
      return null;
    }

    const { investigation_id, ...cleanDoc } = doc as Record<string, unknown>;
    const parsed = EvidenceRecordSchema.safeParse(cleanDoc);
    if (!parsed.success) return null;

    return typeof investigation_id === "string"
      ? { ...parsed.data, investigation_id }
      : parsed.data;
  }

  async findRecordsByCaseId(caseId: string): Promise<EvidenceRecord[]> {
    const caseDoc = await this.findCaseById(caseId);
    if (!caseDoc) {
      return [];
    }

    const recordIds = new Set<string>();
    caseDoc.claims_accepted.forEach((cl) => recordIds.add(cl.record_id));
    caseDoc.claims_removed.forEach((cl) => recordIds.add(cl.record_id));

    if (recordIds.size === 0) {
      return [];
    }

    const collection = this.db.collection(COLLECTIONS.RECORDS);
    const docs = await collection
      .find(
        { record_id: { $in: Array.from(recordIds) } },
        { projection: { _id: 0, is_synthetic: 0, seeded_at: 0 } },
      )
      .toArray();

    const results: EvidenceRecord[] = [];
    for (const doc of docs) {
      const parsed = EvidenceRecordSchema.safeParse(doc);
      if (parsed.success) {
        results.push(parsed.data);
      }
    }

    return results;
  }
}
