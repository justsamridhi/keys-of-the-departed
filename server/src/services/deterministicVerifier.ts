import {
  Case,
  EvidenceRecord,
  InvestigationClaim,
  RemovedClaim,
  OwnerStatus,
  PurposeStatus,
  GhostType,
  ArchiveAccount,
} from "@keys/contracts";
import { GemmaCandidateClaim } from "./ollamaGemmaService.js";

export interface VerificationContext {
  records: EvidenceRecord[];
  knownDirectoryPersons?: Array<{ person_id: string; display_name: string; handles: string[] }>;
  existingAccounts?: ArchiveAccount[];
}

export interface VerificationResult {
  cases: Case[];
  accounts: ArchiveAccount[];
  claimsVerifiedCount: number;
  claimsQuarantinedCount: number;
  evidenceStatusCounts: Record<string, number>;
  ghostTypeCounts: Record<string, number>;
}

const MIN_QUOTE_LENGTH = 12;

/**
 * Deterministic evidence verifier for proposed machine identity claims.
 * Preserves reason codes R1–R5 without alteration:
 * - R1: Missing Source Record
 * - R2: Exact Quote Mismatch (fails substring verification)
 * - R3: Personnel Entity Directory Mismatch
 * - R4: Invalid Claim Structure
 * - R5: Quote Below Minimum Length (< 12 characters)
 */
export class DeterministicClaimVerifier {
  /**
   * Verifies candidate claims and produces validated Case dossiers and ArchiveAccount summaries.
   */
  static verifyClaims(
    candidateClaims: GemmaCandidateClaim[],
    context: VerificationContext,
    modelName = "gemma3:4b",
    latencyMs = 0,
  ): VerificationResult {
    const recordsMap = new Map<string, EvidenceRecord>();
    for (const r of context.records) {
      recordsMap.set(r.record_id, r);
    }

    // Group claims by account_id
    const claimsByAccount = new Map<
      string,
      { accepted: InvestigationClaim[]; removed: RemovedClaim[] }
    >();

    for (const claim of candidateClaims) {
      if (!claimsByAccount.has(claim.account_id)) {
        claimsByAccount.set(claim.account_id, { accepted: [], removed: [] });
      }
      const accGroup = claimsByAccount.get(claim.account_id)!;

      // 1. Structure check (R4)
      if (!claim.account_id || !claim.kind || !claim.record_id || !claim.quote || !claim.text) {
        accGroup.removed.push({
          kind: claim.kind || "owner",
          account_id: claim.account_id || "acc_unknown",
          person_id: claim.person_id || null,
          record_id: claim.record_id || "rec_unknown",
          quote: claim.quote || "",
          text: claim.text || "Claim rejected: missing required schema fields",
          reason_code: "R4",
          repository: claim.repository,
          activity: claim.activity,
          confidence: claim.confidence,
        });
        continue;
      }

      // 2. Minimum quote length check (R5)
      const cleanQuote = claim.quote.trim();
      if (cleanQuote.length < MIN_QUOTE_LENGTH) {
        accGroup.removed.push({
          kind: claim.kind,
          account_id: claim.account_id,
          person_id: claim.person_id || null,
          record_id: claim.record_id,
          quote: claim.quote,
          text: `Quotation length (${cleanQuote.length} chars) is below required verification threshold of ${MIN_QUOTE_LENGTH} chars.`,
          reason_code: "R5",
          repository: claim.repository,
          activity: claim.activity,
          confidence: claim.confidence,
        });
        continue;
      }

      // 3. Source record presence (R1)
      const sourceRecord = recordsMap.get(claim.record_id);
      if (!sourceRecord) {
        accGroup.removed.push({
          kind: claim.kind,
          account_id: claim.account_id,
          person_id: claim.person_id || null,
          record_id: claim.record_id,
          quote: claim.quote,
          text: `Referenced source record ${claim.record_id} does not exist in the evidence ledger.`,
          reason_code: "R1",
          repository: claim.repository,
          activity: claim.activity,
          confidence: claim.confidence,
        });
        continue;
      }

      // 4. Exact quotation substring matching (R2)
      // Check exact substring or trimmed case-insensitive substring
      const content = sourceRecord.content;
      const exactMatch = content.includes(claim.quote);
      const normalizedContent = content.toLowerCase();
      const normalizedQuote = cleanQuote.toLowerCase();
      const looseMatch = normalizedContent.includes(normalizedQuote);

      if (!exactMatch && !looseMatch) {
        accGroup.removed.push({
          kind: claim.kind,
          account_id: claim.account_id,
          person_id: claim.person_id || null,
          record_id: claim.record_id,
          quote: claim.quote,
          text: `The cited quotation failed deterministic substring verification against source record ${claim.record_id}.`,
          reason_code: "R2",
          repository: claim.repository,
          activity: claim.activity,
          confidence: claim.confidence,
        });
        continue;
      }

      // 5. Personnel Entity Directory check (R3) - only for owner claims that specify a person
      let resolvedPersonId: string | null = claim.person_id || null;
      if (claim.kind === "owner" && (claim.person_name || claim.person_id)) {
        const query = (claim.person_name || claim.person_id || "").toLowerCase();
        const dir = context.knownDirectoryPersons;
        if (dir && dir.length > 0) {
          const matchedPerson = dir.find((p) => {
            if (p.person_id.toLowerCase() === query) return true;
            if (p.display_name.toLowerCase().includes(query)) return true;
            if (p.handles.some((h) => h.toLowerCase() === query)) return true;
            return false;
          });

          if (!matchedPerson) {
            accGroup.removed.push({
              kind: claim.kind,
              account_id: claim.account_id,
              person_id: claim.person_id || null,
              record_id: claim.record_id,
              quote: claim.quote,
              text: `Proposed personnel reference "${claim.person_name || claim.person_id}" cannot be confirmed in the organization directory.`,
              reason_code: "R3",
              repository: claim.repository,
              activity: claim.activity,
              confidence: claim.confidence,
            });
            continue;
          }
          resolvedPersonId = matchedPerson.person_id;
        } else if (!resolvedPersonId && claim.person_name) {
          resolvedPersonId = `person_${claim.person_name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        }
      }

      // Claim Passed all 5 deterministic checks -> ACCEPTED
      accGroup.accepted.push({
        kind: claim.kind,
        account_id: claim.account_id,
        person_id: resolvedPersonId,
        record_id: claim.record_id,
        quote: claim.quote,
        text: claim.text,
        repository: claim.repository,
        activity: claim.activity,
        confidence: claim.confidence,
      });
    }

    // Synthesize Cases and ArchiveAccount records
    const cases: Case[] = [];
    const accounts: ArchiveAccount[] = [];

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

    let totalVerifiedClaims = 0;
    let totalQuarantinedClaims = 0;

    for (const [accountId, { accepted, removed }] of claimsByAccount.entries()) {
      totalVerifiedClaims += accepted.length;
      totalQuarantinedClaims += removed.length;

      // Determine owner status
      const ownerClaims = accepted.filter((c) => c.kind === "owner");
      const purposeClaims = accepted.filter((c) => c.kind === "purpose");
      const conflictingOwners = new Set(ownerClaims.map((c) => c.person_id).filter(Boolean));

      let ownerStatus: OwnerStatus = "no_evidence";
      if (conflictingOwners.size > 1) {
        ownerStatus = "conflicting";
      } else if (ownerClaims.length >= 2) {
        ownerStatus = "verified";
      } else if (ownerClaims.length === 1) {
        ownerStatus = "supported";
      }

      let purposeStatus: PurposeStatus = "no_evidence";
      if (purposeClaims.length >= 2) {
        purposeStatus = "verified";
      } else if (purposeClaims.length === 1) {
        purposeStatus = "supported";
      }

      // Determine governance ghost type
      let ghostType: GhostType = "FORGOTTEN";
      if (ownerStatus === "verified" || ownerStatus === "supported") {
        ghostType = "LOST"; // Owner departed or identified
      } else if (ownerStatus === "conflicting") {
        ghostType = "LOST";
      }

      const caseId = `case_${accountId.replace(/^acc_/, "")}`;
      const caseDoc: Case = {
        case_id: caseId,
        bundle_id: "bundle_investigation_evidence",
        account_id: accountId,
        claims_accepted: accepted,
        claims_removed: removed,
        owner_status: ownerStatus,
        purpose_status: purposeStatus,
        ghost_type: ghostType,
        model: modelName,
        latency_ms: latencyMs,
      };
      cases.push(caseDoc);

      evidenceStatusCounts[ownerStatus] = (evidenceStatusCounts[ownerStatus] || 0) + 1;
      ghostTypeCounts[ghostType] = (ghostTypeCounts[ghostType] || 0) + 1;

      // Build corresponding ArchiveAccount
      const primaryQuote =
        accepted[0]?.quote || removed[0]?.quote || "Deterministic audit record reference verified.";

      const ownerName =
        ownerClaims[0]?.person_id?.replace(/^person_/, "").replace(/_/g, " ") || null;
      const purpose = purposeClaims[0]?.text || null;

      accounts.push({
        account_id: accountId,
        kind: accountId.includes("deploy")
          ? "deploy_key"
          : accountId.includes("service")
            ? "service_account"
            : "bot",
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        permissions: ["repo:write"],
        tags: ["audit", "ai-extracted"],
        expires_at: null,
        ghost_type: ghostType,
        owner_status: ownerStatus,
        case_id: caseId,
        owner_name: ownerName,
        purpose,
        primary_quote: primaryQuote,
      });
    }

    return {
      cases,
      accounts,
      claimsVerifiedCount: totalVerifiedClaims,
      claimsQuarantinedCount: totalQuarantinedClaims,
      evidenceStatusCounts,
      ghostTypeCounts,
    };
  }
}
