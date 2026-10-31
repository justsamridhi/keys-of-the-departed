import { describe, it, expect, vi } from "vitest";
import {
  OllamaGemmaService,
  GemmaExtractionOutputSchema,
} from "../../server/src/services/ollamaGemmaService.js";
import { DeterministicClaimVerifier } from "../../server/src/services/deterministicVerifier.js";
import { runEvaluationBenchmark } from "../../server/src/evaluation/runBenchmark.js";
import { EvidenceRecord } from "@keys/contracts";

describe("Phase 2: Gemma 3 + Ollama Integration & Deterministic Verification", () => {
  describe("OllamaGemmaService & Error Handling", () => {
    it("GEMMA-01: Validates structured output against GemmaExtractionOutputSchema", () => {
      const validPayload = {
        identified_accounts: ["acc_deploy_key_881"],
        claims: [
          {
            kind: "owner",
            account_id: "acc_deploy_key_881",
            person_name: "Carlos Mendez",
            person_id: "person_carlos_mendez",
            record_id: "rec_commit_4021",
            quote: "Signed-off-by: Carlos Mendez <cmendez@internal.corp>",
            text: "Commit authorship indicates Carlos Mendez setup this deployment key.",
            repository: "keys-of-the-departed",
            activity: "staging deploy key rollout",
            confidence: "explicit",
          },
        ],
      };

      const result = GemmaExtractionOutputSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.claims).toHaveLength(1);
        expect(result.data.claims[0].confidence).toBe("explicit");
      }
    });

    it("GEMMA-02: Handles malformed model output and retries before safely abstaining", async () => {
      let callCount = 0;
      const fakeFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({ response: "INVALID_NOT_JSON {{{" }),
        };
      });

      // Replace global fetch temporarily
      const originalFetch = global.fetch;
      global.fetch = fakeFetch as unknown as typeof fetch;

      try {
        const service = new OllamaGemmaService({
          baseUrl: "http://127.0.0.1:11434",
          model: "gemma3:4b",
          timeoutMs: 1000,
        });

        const records = [
          {
            record_id: "rec_1",
            type: "commit" as const,
            content: "Commit without clear json",
          },
        ];

        const result = await service.extractCandidateClaims(records);
        expect(callCount).toBe(2); // Attempted initial + 1 retry
        expect(result.status).toBe("abstained");
        expect(result.output).toBeNull();
        expect(result.error).toContain("Malformed JSON");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("GEMMA-03: Handles model timeout and returns model_unavailable without crashing", async () => {
      const fakeFetch = vi.fn().mockImplementation(async (_url, opts) => {
        // Wait for abort signal
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () => {
            const err = new Error("This operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      });

      const originalFetch = global.fetch;
      global.fetch = fakeFetch as unknown as typeof fetch;

      try {
        const service = new OllamaGemmaService({
          baseUrl: "http://127.0.0.1:11434",
          model: "gemma3:4b",
          timeoutMs: 50,
        });

        const records = [{ record_id: "rec_1", type: "commit" as const, content: "test" }];
        const result = await service.extractCandidateClaims(records);

        expect(result.status).toBe("model_unavailable");
        expect(result.error).toContain("timed out");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("GEMMA-04: Returns abstained when evidence records are empty without invoking model", async () => {
      const service = new OllamaGemmaService({
        baseUrl: "http://127.0.0.1:11434",
        model: "gemma3:4b",
      });

      const result = await service.extractCandidateClaims([]);
      expect(result.status).toBe("abstained");
      expect(result.output?.claims).toHaveLength(0);
      expect(result.output?.abstention_reason).toContain("No evidence records");
    });
  });

  describe("Deterministic Claim Verifier (R1–R5 Integrity)", () => {
    const baseRecord: EvidenceRecord = {
      record_id: "rec_valid_01",
      type: "commit",
      ts: "2026-01-01T00:00:00.000Z",
      author_handle: "cmendez",
      assignee_handle: null,
      actor_account_id: "acc_deploy_key_881",
      content:
        "Author: Carlos Mendez <cmendez@corp>\nSigned-off-by: Carlos Mendez\nStaging deploy key provisioned.",
      structured: true,
    };

    it("VERIFY-01: Accepts valid candidate claim with verbatim quote and directory match", () => {
      const candidateClaims = [
        {
          kind: "owner" as const,
          account_id: "acc_deploy_key_881",
          person_name: "Carlos Mendez",
          person_id: "person_carlos_mendez",
          record_id: "rec_valid_01",
          quote: "Signed-off-by: Carlos Mendez",
          text: "Carlos Mendez authored the deployment credential.",
          confidence: "explicit" as const,
        },
      ];

      const result = DeterministicClaimVerifier.verifyClaims(candidateClaims, {
        records: [baseRecord],
        knownDirectoryPersons: [
          {
            person_id: "person_carlos_mendez",
            display_name: "Carlos Mendez",
            handles: ["cmendez"],
          },
        ],
      });

      expect(result.claimsVerifiedCount).toBe(1);
      expect(result.claimsQuarantinedCount).toBe(0);
      expect(result.cases[0].claims_accepted).toHaveLength(1);
      expect(result.cases[0].claims_removed).toHaveLength(0);
      expect(result.cases[0].owner_status).toBe("supported");
    });

    it("VERIFY-02: Flags R1 on candidate claim citing nonexistent record_id", () => {
      const candidateClaims = [
        {
          kind: "owner" as const,
          account_id: "acc_deploy_key_881",
          person_name: "Carlos Mendez",
          person_id: "person_carlos_mendez",
          record_id: "rec_phantom_ledger_99",
          quote: "Signed-off-by: Carlos Mendez",
          text: "Carlos Mendez signed off.",
          confidence: "explicit" as const,
        },
      ];

      const result = DeterministicClaimVerifier.verifyClaims(candidateClaims, {
        records: [baseRecord],
      });
      expect(result.claimsVerifiedCount).toBe(0);
      expect(result.claimsQuarantinedCount).toBe(1);
      expect(result.cases[0].claims_removed[0].reason_code).toBe("R1");
      expect(result.cases[0].claims_removed[0].text).toContain("does not exist");
    });

    it("VERIFY-03: Flags R2 on candidate claim with fabricated / hallucinated quotation", () => {
      const candidateClaims = [
        {
          kind: "owner" as const,
          account_id: "acc_deploy_key_881",
          person_name: "Carlos Mendez",
          person_id: "person_carlos_mendez",
          record_id: "rec_valid_01",
          quote: "Completely fabricated text that does not appear in record",
          text: "Attribution with fake quote.",
          confidence: "inferred" as const,
        },
      ];

      const result = DeterministicClaimVerifier.verifyClaims(candidateClaims, {
        records: [baseRecord],
      });
      expect(result.claimsVerifiedCount).toBe(0);
      expect(result.claimsQuarantinedCount).toBe(1);
      expect(result.cases[0].claims_removed[0].reason_code).toBe("R2");
      expect(result.cases[0].claims_removed[0].text).toContain("substring verification");
    });

    it("VERIFY-04: Flags R3 on candidate claim referencing person not in directory", () => {
      const candidateClaims = [
        {
          kind: "owner" as const,
          account_id: "acc_deploy_key_881",
          person_name: "Unknown Contractor",
          person_id: "person_unknown_contractor",
          record_id: "rec_valid_01",
          quote: "Signed-off-by: Carlos Mendez",
          text: "Attributed to contractor not in internal directory.",
          confidence: "explicit" as const,
        },
      ];

      const result = DeterministicClaimVerifier.verifyClaims(candidateClaims, {
        records: [baseRecord],
        knownDirectoryPersons: [
          {
            person_id: "person_carlos_mendez",
            display_name: "Carlos Mendez",
            handles: ["cmendez"],
          },
        ],
      });

      expect(result.claimsVerifiedCount).toBe(0);
      expect(result.claimsQuarantinedCount).toBe(1);
      expect(result.cases[0].claims_removed[0].reason_code).toBe("R3");
      expect(result.cases[0].claims_removed[0].text).toContain(
        "cannot be confirmed in the organization directory",
      );
    });

    it("VERIFY-05: Flags R5 on candidate claim where quotation is shorter than 12 characters", () => {
      const candidateClaims = [
        {
          kind: "owner" as const,
          account_id: "acc_deploy_key_881",
          person_name: "Carlos Mendez",
          person_id: "person_carlos_mendez",
          record_id: "rec_valid_01",
          quote: "short", // 5 chars < 12
          text: "Short quotation test.",
          confidence: "explicit" as const,
        },
      ];

      const result = DeterministicClaimVerifier.verifyClaims(candidateClaims, {
        records: [baseRecord],
      });
      expect(result.claimsVerifiedCount).toBe(0);
      expect(result.claimsQuarantinedCount).toBe(1);
      expect(result.cases[0].claims_removed[0].reason_code).toBe("R5");
      expect(result.cases[0].claims_removed[0].text).toContain(
        "below required verification threshold of 12 chars",
      );
    });

    it("VERIFY-06: Correctly detects conflicting owners across claims", () => {
      const candidateClaims = [
        {
          kind: "owner" as const,
          account_id: "acc_deploy_key_881",
          person_name: "Carlos Mendez",
          person_id: "person_carlos_mendez",
          record_id: "rec_valid_01",
          quote: "Signed-off-by: Carlos Mendez",
          text: "Carlos created key.",
          confidence: "explicit" as const,
        },
        {
          kind: "owner" as const,
          account_id: "acc_deploy_key_881",
          person_name: "Marcus Vance",
          person_id: "person_marcus_vance",
          record_id: "rec_valid_01",
          quote: "Staging deploy key provisioned.",
          text: "Marcus also claimed as key maintainer.",
          confidence: "explicit" as const,
        },
      ];

      const result = DeterministicClaimVerifier.verifyClaims(candidateClaims, {
        records: [baseRecord],
        knownDirectoryPersons: [
          {
            person_id: "person_carlos_mendez",
            display_name: "Carlos Mendez",
            handles: ["cmendez"],
          },
          { person_id: "person_marcus_vance", display_name: "Marcus Vance", handles: ["marcus"] },
        ],
      });

      expect(result.claimsVerifiedCount).toBe(2);
      expect(result.cases[0].owner_status).toBe("conflicting");
    });
  });

  describe("Reproducible Frozen Evaluation Benchmark (Section 7)", () => {
    it("BENCH-01: Runs 3-way evaluation benchmark and validates reported metrics", () => {
      const benchmark = runEvaluationBenchmark();

      expect(benchmark.deterministicBaseline.sampleCount).toBe(10);
      expect(benchmark.gemmaRaw.sampleCount).toBe(10);
      expect(benchmark.gemmaPlusVerifier.sampleCount).toBe(10);

      // Verifier eliminates 100% of unsupported claims
      expect(benchmark.gemmaRaw.unsupportedClaimRate).toBeGreaterThan(0);
      expect(benchmark.gemmaPlusVerifier.unsupportedClaimRate).toBe(0);

      // Verifier guarantees 100% exact quotation match on all verified claims
      expect(benchmark.gemmaPlusVerifier.exactQuotationMatchRate).toBe(100);

      // Abstention rate is preserved
      expect(benchmark.gemmaPlusVerifier.abstentionRate).toBe(100);
    });
  });
});
