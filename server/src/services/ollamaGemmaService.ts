import { z } from "zod";

/**
 * Schema for raw candidate claims extracted by Gemma 3.
 */
export const GemmaCandidateClaimSchema = z.object({
  kind: z.enum(["owner", "purpose"]),
  account_id: z.string().min(1),
  person_name: z.string().nullable().optional(),
  person_id: z.string().nullable().optional(),
  record_id: z.string().min(1),
  quote: z.string().min(1),
  text: z.string().min(1),
  repository: z.string().nullable().optional(),
  activity: z.string().nullable().optional(),
  confidence: z.enum(["explicit", "inferred"]).default("explicit"),
});

export type GemmaCandidateClaim = z.infer<typeof GemmaCandidateClaimSchema>;

export const GemmaExtractionOutputSchema = z.object({
  identified_accounts: z.array(z.string()),
  claims: z.array(GemmaCandidateClaimSchema),
  abstention_reason: z.string().nullable().optional(),
});

export type GemmaExtractionOutput = z.infer<typeof GemmaExtractionOutputSchema>;

export interface OllamaClientConfig {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export class OllamaGemmaService {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: OllamaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.model = config.model;
    this.timeoutMs = config.timeoutMs || 25000;
  }

  /**
   * Health check to confirm Ollama and the requested model are reachable.
   */
  async checkAvailability(): Promise<{ available: boolean; error?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return { available: false, error: `Ollama returned HTTP ${res.status}` };
      }

      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const modelNames = data.models?.map((m) => m.name.toLowerCase()) || [];
      const hasModel = modelNames.some(
        (n) => n === this.model.toLowerCase() || n.startsWith(`${this.model.toLowerCase()}:`),
      );

      if (!hasModel) {
        return {
          available: false,
          error: `Model "${this.model}" not found in Ollama (installed: ${modelNames.join(", ")})`,
        };
      }

      return { available: true };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : "Connection failed";
      return { available: false, error: msg };
    }
  }

  /**
   * Builds the strict prompt instructing Gemma 3 to extract structured claims.
   * Explicitly forbids hallucinating personnel, quotes, or marking anything as verified.
   */
  private buildPrompt(
    records: Array<{ record_id: string; type: string; content: string }>,
  ): string {
    return `You are Gemma 3, an expert machine identity forensics assistant for "Keys of the Departed".
Your role is to analyze engineering evidence records and propose candidate claims about machine identity ownership, purpose, project association, and activity.

CRITICAL SAFETY & PROVENANCE RULES:
1. Every claim MUST reference a real record_id from the provided records.
2. The "quote" MUST be an exact verbatim substring from that record's content. Never fabricate or paraphrase quotations.
3. Distinguish explicit evidence from inferred interpretation via the "confidence" field ("explicit" vs "inferred").
4. NEVER mark or declare any claim as "verified". Verification is exclusively performed by a deterministic engine.
5. If no machine accounts or evidence claims exist in the records, abstain by returning an empty "claims" array and provide an "abstention_reason".

Ingested Evidence Records:
${JSON.stringify(records, null, 2)}

You MUST respond with ONLY valid JSON matching this schema:
{
  "identified_accounts": ["acc_..."],
  "claims": [
    {
      "kind": "owner" | "purpose",
      "account_id": "acc_...",
      "person_name": "Full Person Name" | null,
      "person_id": "person_..." | null,
      "record_id": "rec_...",
      "quote": "verbatim quotation from record content",
      "text": "human explanation of why this evidence matters",
      "repository": "repo-name" | null,
      "activity": "summary of last activity" | null,
      "confidence": "explicit" | "inferred"
    }
  ],
  "abstention_reason": null | "string"
}`;
  }

  /**
   * Invokes Ollama to generate structured extraction with retry on recoverable malformed JSON.
   */
  async extractCandidateClaims(
    records: Array<{ record_id: string; type: string; content: string }>,
  ): Promise<{
    output: GemmaExtractionOutput | null;
    status: "completed" | "abstained" | "model_unavailable";
    latencyMs: number;
    error?: string;
  }> {
    if (records.length === 0) {
      return {
        output: {
          identified_accounts: [],
          claims: [],
          abstention_reason: "No evidence records provided",
        },
        status: "abstained",
        latencyMs: 0,
      };
    }

    const startTime = Date.now();
    const prompt = this.buildPrompt(records);

    // Try up to 2 attempts (1 initial attempt + 1 retry for malformed output)
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(`${this.baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.model,
            prompt,
            stream: false,
            format: "json",
            options: {
              temperature: 0,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`Ollama HTTP ${res.status}`);
        }

        const data = (await res.json()) as { response?: string };
        const rawText = (data.response || "").trim();

        if (!rawText) {
          if (attempt === 1) continue; // retry once on empty
          return {
            output: null,
            status: "abstained",
            latencyMs: Date.now() - startTime,
            error: "Model returned empty response after retry",
          };
        }

        // Parse JSON
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(rawText);
        } catch (jsonErr) {
          if (attempt === 1) continue; // retry once on malformed JSON
          return {
            output: null,
            status: "abstained",
            latencyMs: Date.now() - startTime,
            error: `Malformed JSON from model: ${jsonErr instanceof Error ? jsonErr.message : "Parse error"}`,
          };
        }

        const validated = GemmaExtractionOutputSchema.safeParse(parsedJson);
        if (!validated.success) {
          if (attempt === 1) continue; // retry once on schema mismatch
          return {
            output: null,
            status: "abstained",
            latencyMs: Date.now() - startTime,
            error: "Model output failed schema validation",
          };
        }

        const isAbstained =
          validated.data.claims.length === 0 && Boolean(validated.data.abstention_reason);

        return {
          output: validated.data,
          status: isAbstained ? "abstained" : "completed",
          latencyMs: Date.now() - startTime,
        };
      } catch (err: unknown) {
        clearTimeout(timeout);
        const isAbort = err instanceof Error && err.name === "AbortError";
        const msg = isAbort
          ? "Model request timed out"
          : err instanceof Error
            ? err.message
            : "Model request failed";

        if (attempt === 1 && !isAbort) {
          continue;
        }

        return {
          output: null,
          status: "model_unavailable",
          latencyMs: Date.now() - startTime,
          error: msg,
        };
      }
    }

    return {
      output: null,
      status: "model_unavailable",
      latencyMs: Date.now() - startTime,
      error: "Ollama generation attempts exhausted",
    };
  }
}
