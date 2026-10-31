import { Db, Filter } from "mongodb";
import {
  AccountsQuery,
  AccountsResponse,
  ArchiveAccount,
  ArchiveAccountSchema,
} from "@keys/contracts";
import { AccountsRepository } from "./accountsRepository.js";
import { COLLECTIONS } from "../db/collections.js";

export class MongoAccountsRepository implements AccountsRepository {
  constructor(private readonly db: Db) {}

  async findAccounts(query: AccountsQuery): Promise<AccountsResponse> {
    const { chapter, status, search, page, limit } = query;
    const filter: Filter<Record<string, unknown>> = {};

    // 1. Chapter filter
    if (chapter && chapter !== "ALL") {
      filter.ghost_type = chapter;
    }

    // 2. Owner status filter
    if (status && status !== "ALL") {
      filter.owner_status = status;
    }

    // 3. Search query with safe regex escaping (prevent ReDoS & query injection)
    const cleanSearch = search?.trim();
    if (cleanSearch) {
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escaped, "i");
      filter.$or = [
        { account_id: searchRegex },
        { owner_name: searchRegex },
        { purpose: searchRegex },
        { primary_quote: searchRegex },
        { kind: searchRegex },
        { tags: searchRegex },
      ];
    }

    const collection = this.db.collection(COLLECTIONS.ACCOUNTS);

    // Count matching documents
    const total = await collection.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Fetch paginated documents, strictly stripping MongoDB _id
    const docs = await collection
      .find(filter, { projection: { _id: 0, is_synthetic: 0, seeded_at: 0 } })
      .sort({ account_id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Validate documents against shared contract
    const data: ArchiveAccount[] = [];
    for (const doc of docs) {
      const {
        _id,
        is_synthetic: _synth,
        seeded_at: _seed,
        ...clean
      } = doc as Record<string, unknown>;
      const parsed = ArchiveAccountSchema.safeParse(clean);
      if (parsed.success) {
        data.push(parsed.data);
      }
    }

    return {
      data,
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
        synthetic: true,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async findAccountById(id: string): Promise<ArchiveAccount | null> {
    const collection = this.db.collection(COLLECTIONS.ACCOUNTS);
    const doc = await collection.findOne(
      { account_id: id },
      { projection: { _id: 0, is_synthetic: 0, seeded_at: 0 } },
    );

    if (!doc) {
      return null;
    }

    const {
      _id,
      is_synthetic: _synth,
      seeded_at: _seed,
      ...clean
    } = doc as Record<string, unknown>;
    const parsed = ArchiveAccountSchema.safeParse(clean);
    return parsed.success ? parsed.data : null;
  }
}
