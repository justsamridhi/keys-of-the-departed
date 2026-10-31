import { AccountsQuery, AccountsResponse, ArchiveAccount } from "@keys/contracts";
import { SYNTHETIC_ACCOUNTS } from "../fixtures/syntheticAccounts.js";

/**
 * Repository interface for machine identities.
 * Enables zero-downtime swapping between synthetic fixtures and MongoDB Atlas.
 */
export interface AccountsRepository {
  findAccounts(query: AccountsQuery): Promise<AccountsResponse>;
  findAccountById(id: string): Promise<ArchiveAccount | null>;
}

/**
 * In-memory repository backed by verified synthetic fixtures.
 */
export class FixtureAccountsRepository implements AccountsRepository {
  private readonly accounts: ArchiveAccount[];

  constructor(accounts: ArchiveAccount[] = SYNTHETIC_ACCOUNTS) {
    this.accounts = accounts;
  }

  async findAccounts(query: AccountsQuery): Promise<AccountsResponse> {
    const { chapter, status, search, page, limit } = query;
    const cleanSearch = search.trim().toLowerCase();

    // 1. Filter accounts
    const filtered = this.accounts.filter((acc) => {
      // Chapter filter
      if (chapter && chapter !== "ALL" && acc.ghost_type !== chapter) {
        return false;
      }

      // Owner status filter
      if (status && status !== "ALL" && acc.owner_status !== status) {
        return false;
      }

      // Text search
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

    // 2. Deterministic sort (by account_id ascending for stable pagination)
    filtered.sort((a, b) => a.account_id.localeCompare(b.account_id));

    // 3. Pagination calculations
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
        synthetic: true,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async findAccountById(id: string): Promise<ArchiveAccount | null> {
    const account = this.accounts.find((a) => a.account_id === id);
    return account || null;
  }
}
