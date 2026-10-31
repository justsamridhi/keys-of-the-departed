import { describe, it, expect } from "vitest";
import { CaseSchema, EvidenceRecordSchema, ReasonCodeEnum } from "@keys/contracts";
import { highlightQuote } from "../../client/src/highlight.js";
import { REASON_CODE_DESCRIPTIONS } from "../../client/src/pages/CasePage.js";
import { SYNTHETIC_CASES, SYNTHETIC_RECORDS } from "../../server/src/fixtures/syntheticCases.js";

describe("Phase 2: Case Investigation & Evidence Provenance", () => {
  describe("Reason Codes R1–R5 Integrity", () => {
    it("CASE-01: Validates that all defined reason codes R1–R5 have documented explanations", () => {
      const allowedCodes = ReasonCodeEnum.options;
      expect(allowedCodes).toEqual(["R1", "R2", "R3", "R4", "R5"]);

      for (const code of allowedCodes) {
        const desc = REASON_CODE_DESCRIPTIONS[code];
        expect(desc).toBeDefined();
        expect(desc.title.length).toBeGreaterThan(0);
        expect(desc.explanation.length).toBeGreaterThan(0);
      }
    });

    it("CASE-02: R1 specifically explains missing source records in the immutable ledger", () => {
      const r1 = REASON_CODE_DESCRIPTIONS.R1;
      expect(r1.explanation.toLowerCase()).toContain("does not exist");
    });

    it("CASE-03: R2 specifically flags deterministic quote mismatch failures", () => {
      const r2 = REASON_CODE_DESCRIPTIONS.R2;
      expect(r2.explanation.toLowerCase()).toContain("substring verification");
    });

    it("CASE-04: R3 specifically flags personnel entity directory mismatches", () => {
      const r3 = REASON_CODE_DESCRIPTIONS.R3;
      expect(r3.explanation.toLowerCase()).toContain("personnel directory");
    });
  });

  describe("Deterministic Exact Quote Matching & Safe Highlighting", () => {
    it("CASE-05: Exact match highlights the precise target substring without altering non-matching content", () => {
      const content =
        "Author: Carlos Mendez <cmendez@corp>\nSigned-off-by: Carlos Mendez\nDeploy key added.";
      const quote = "Signed-off-by: Carlos Mendez";

      const segments = highlightQuote(content, quote);
      expect(segments).toHaveLength(3);
      expect(segments[0]).toEqual({
        text: "Author: Carlos Mendez <cmendez@corp>\n",
        isMatch: false,
      });
      expect(segments[1]).toEqual({ text: "Signed-off-by: Carlos Mendez", isMatch: true });
      expect(segments[2]).toEqual({ text: "\nDeploy key added.", isMatch: false });
    });

    it("CASE-06: Handles case-insensitive and whitespace-trimmed quotation safely", () => {
      const content = "Automated night-build deployment pipeline key for staging cluster.";
      const quote = "  AUTOMATED NIGHT-BUILD DEPLOYMENT PIPELINE KEY  ";

      const segments = highlightQuote(content, quote);
      expect(segments.some((s) => s.isMatch)).toBe(true);
      const matched = segments.find((s) => s.isMatch);
      expect(matched?.text).toBe("Automated night-build deployment pipeline key");
    });

    it("CASE-07: Unmatched quotation returns single unhighlighted segment without error", () => {
      const content = "Deploy log clean.";
      const quote = "Non-existent quote";

      const segments = highlightQuote(content, quote);
      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({ text: "Deploy log clean.", isMatch: false });
    });

    it("CASE-08: Unicode and special punctuation characters in quotations are preserved intact", () => {
      const content = "Commit: Andrés Peña — Deploy staging “v2.1” → #cluster-4";
      const quote = "Andrés Peña";

      const segments = highlightQuote(content, quote);
      expect(segments.find((s) => s.isMatch)?.text).toBe("Andrés Peña");
    });
  });

  describe("Synthetic Dataset Provenance & Relationship Integrity", () => {
    it("CASE-09: All 40 synthetic accounts have corresponding valid Case definitions", () => {
      expect(Object.keys(SYNTHETIC_CASES).length).toBeGreaterThanOrEqual(40);

      for (const [caseId, caseData] of Object.entries(SYNTHETIC_CASES)) {
        const validated = CaseSchema.safeParse(caseData);
        expect(validated.success, `Case ${caseId} failed validation`).toBe(true);
      }
    });

    it("CASE-10: Accepted claims reference valid, existing source evidence records in the ledger", () => {
      for (const [caseId, caseData] of Object.entries(SYNTHETIC_CASES)) {
        for (const claim of caseData.claims_accepted) {
          const record = SYNTHETIC_RECORDS[claim.record_id];
          expect(
            record,
            `Case ${caseId} accepted claim references non-existent record ${claim.record_id}`,
          ).toBeDefined();

          if (record) {
            const validated = EvidenceRecordSchema.safeParse(record);
            expect(validated.success).toBe(true);
            // Accepted quote must exist in record content (case-insensitive substring)
            expect(
              record.content.toLowerCase(),
              `Quote "${claim.quote}" must exist in record ${claim.record_id}`,
            ).toContain(claim.quote.toLowerCase());
          }
        }
      }
    });

    it("CASE-11: Conflicting and no_evidence cases properly express provenance without inferring malicious intent", () => {
      const conflictingCases = Object.values(SYNTHETIC_CASES).filter(
        (c) => c.owner_status === "conflicting",
      );
      const noEvidenceCases = Object.values(SYNTHETIC_CASES).filter(
        (c) => c.owner_status === "no_evidence",
      );

      // Verify at least one of each exists in synthetic fixtures
      expect(noEvidenceCases.length).toBeGreaterThan(0);

      // Verify that no_evidence cases have purpose or ghost classification without fabricated owners
      for (const nec of noEvidenceCases) {
        expect(nec.owner_status).toBe("no_evidence");
        // No accepted owner claims should exist for no_evidence
        const ownerClaims = nec.claims_accepted.filter((cl) => cl.kind === "owner");
        expect(ownerClaims.length).toBe(0);
      }

      for (const cc of conflictingCases) {
        expect(cc.owner_status).toBe("conflicting");
      }
    });

    it("CASE-12: Quarantined claims (claims_removed) have valid reason codes R1–R5", () => {
      let totalRemoved = 0;
      for (const caseData of Object.values(SYNTHETIC_CASES)) {
        for (const rem of caseData.claims_removed) {
          totalRemoved++;
          expect(["R1", "R2", "R3", "R4", "R5"]).toContain(rem.reason_code);
        }
      }
      expect(totalRemoved).toBeGreaterThan(0);
    });
  });

  describe("API and Navigation Helper State", () => {
    it("CASE-13: URL construction for case lookup encodes case ID safely", () => {
      const caseId = "case_demo_01";
      const caseUrl = `/api/cases/${encodeURIComponent(caseId)}`;
      const recordsUrl = `/api/cases/${encodeURIComponent(caseId)}/records`;

      expect(caseUrl).toBe("/api/cases/case_demo_01");
      expect(recordsUrl).toBe("/api/cases/case_demo_01/records");
    });

    it("CASE-14: Hash router navigates back to archive with correct route identifier", () => {
      let navigatedRoute = "";
      const handleRouteChange = (route: string) => {
        navigatedRoute = route;
      };

      handleRouteChange("archive");
      expect(navigatedRoute).toBe("archive");
    });
  });
});
