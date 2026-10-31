import { spawn } from "child_process";
import path from "path";
import {
  ArchiveAccount,
  EvidenceRecord,
  TabPfnSummary,
  TabPfnSummarySchema,
} from "@keys/contracts";

export interface TabPfnServiceConfig {
  pythonExecutable?: string;
  scriptPath?: string;
  timeoutMs?: number;
}

export class TabPfnService {
  private readonly pythonExecutable: string;
  private readonly scriptPath: string;
  private readonly timeoutMs: number;

  constructor(config: TabPfnServiceConfig = {}) {
    this.pythonExecutable = config.pythonExecutable || process.env.PYTHON_PATH || "python";
    this.scriptPath =
      config.scriptPath || path.resolve(process.cwd(), "python-tools", "tabpfn_prioritizer.py");
    this.timeoutMs = config.timeoutMs || 35000;
  }

  /**
   * Prioritizes machine identity accounts using TabPFN in-context tabular foundation model.
   * If the model or python runtime is unavailable, falls back gracefully to deterministic heuristics
   * with status 'model_unavailable' or 'simulated'.
   */
  async prioritizeAccounts(
    accounts: ArchiveAccount[],
    records: EvidenceRecord[],
  ): Promise<TabPfnSummary> {
    const executedAt = new Date().toISOString();

    if (accounts.length === 0) {
      return {
        status: "abstained",
        model_name: "tabpfn",
        model_version: "0.1.11",
        executed_at: executedAt,
        latency_ms: 0,
        identities_ranked: 0,
        rankings: [],
        disclaimer:
          "Prioritization indicates evidence ambiguity and review urgency; it is not a security verdict or proof of maliciousness.",
      };
    }

    const payload = JSON.stringify({ accounts, records });

    return new Promise<TabPfnSummary>((resolve) => {
      let stdout = "";
      let stderr = "";
      let isSettled = false;

      const child = spawn(this.pythonExecutable, [this.scriptPath, "--stdin"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            child.kill();
          } catch {
            // Ignore kill errors
          }
          resolve(this.createFallbackSummary(accounts, "model_unavailable", 35000, records));
        }
      }, this.timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          console.warn("[TabPfnService] Child process error:", err.message);
          resolve(this.createFallbackSummary(accounts, "model_unavailable", 0, records));
        }
      });

      child.on("close", (code) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timer);

        if (code !== 0) {
          console.warn(
            `[TabPfnService] Subprocess exited with code ${code}. Stderr: ${stderr.slice(0, 300)}`,
          );
          return resolve(this.createFallbackSummary(accounts, "model_unavailable", 0, records));
        }

        try {
          // Find first JSON object in stdout (ignoring any torch warnings)
          const jsonStartIndex = stdout.indexOf("{");
          if (jsonStartIndex === -1) {
            throw new Error("No JSON payload detected in stdout");
          }
          const rawJson = stdout.slice(jsonStartIndex);
          const parsed = JSON.parse(rawJson);
          const validated = TabPfnSummarySchema.safeParse(parsed);

          if (validated.success) {
            resolve(validated.data);
          } else {
            console.warn(
              "[TabPfnService] Validation error on TabPFN output:",
              validated.error.errors,
            );
            resolve(this.createFallbackSummary(accounts, "model_unavailable", 0, records));
          }
        } catch (parseErr) {
          console.warn("[TabPfnService] Failed to parse output:", parseErr);
          resolve(this.createFallbackSummary(accounts, "model_unavailable", 0, records));
        }
      });

      try {
        child.stdin.write(payload);
        child.stdin.end();
      } catch (writeErr) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          console.warn("[TabPfnService] Stdin write error:", writeErr);
          resolve(this.createFallbackSummary(accounts, "model_unavailable", 0, records));
        }
      }
    });
  }

  /**
   * Deterministic heuristic fallback when Python/TabPFN is unreachable or timed out
   */
  private createFallbackSummary(
    accounts: ArchiveAccount[],
    status: "model_unavailable" | "simulated",
    latencyMs: number,
    records: EvidenceRecord[] = [],
  ): TabPfnSummary {
    const now = new Date();
    const rankings = accounts.map((acc, idx) => {
      let score = 0.2;
      const factors: string[] = [];
      const missing: string[] = [];

      let daysInactive: number | null = null;
      if (acc.last_used_at) {
        try {
          daysInactive = Math.max(
            0,
            (now.getTime() - new Date(acc.last_used_at).getTime()) / (1000 * 86400),
          );
          if (daysInactive > 180) {
            score += 0.35;
            factors.push(`Extended inactivity: ~${Math.round(daysInactive)} days since last use`);
          }
        } catch {
          missing.push("last_used_at_invalid");
        }
      } else {
        missing.push("last_used_at_unrecorded");
      }

      if (!acc.permissions || acc.permissions.length === 0) {
        missing.push("permissions_empty");
      }

      const accId = acc.account_id || "";
      const matchingRecords = records.filter(
        (r) => (r.content && r.content.includes(accId)) || r.actor_account_id === accId,
      );
      if (matchingRecords.length === 0) {
        missing.push("evidence_records_unlinked");
      }

      if (acc.owner_status === "no_evidence") {
        score += 0.3;
        factors.push("Zero verified owner references");
      } else if (acc.owner_status === "conflicting") {
        score += 0.4;
        factors.push("Conflicting ownership references detected");
      }

      const hasAdmin = (acc.permissions || []).some((p) => p.toLowerCase().includes("admin"));
      if (hasAdmin) {
        score += 0.2;
        factors.push("Administrative permissions assigned");
      }

      const finalScore = Math.min(0.99, Math.max(0.01, score));
      const tier: "URGENT" | "ELEVATED" | "ROUTINE" | "NORMAL" =
        finalScore >= 0.75
          ? "URGENT"
          : finalScore >= 0.5
            ? "ELEVATED"
            : finalScore >= 0.25
              ? "ROUTINE"
              : "NORMAL";

      return {
        account_id: acc.account_id,
        priority_score: Math.round(finalScore * 10000) / 10000,
        priority_rank: idx + 1,
        triage_tier: tier,
        features: {
          days_since_last_active: daysInactive,
          owner_status_code:
            acc.owner_status === "verified"
              ? 3
              : acc.owner_status === "supported"
                ? 2
                : acc.owner_status === "conflicting"
                  ? 1
                  : 0,
          permission_count: (acc.permissions || []).length,
          has_admin_perm: hasAdmin,
          repo_count: 1,
          recent_deploy_count: 0,
          account_kind_code: acc.kind === "service_account" ? 2 : acc.kind === "deploy_key" ? 1 : 0,
          evidence_record_count: matchingRecords.length,
          has_conflicting_ownership: acc.owner_status === "conflicting",
        },
        contributing_factors: factors.length > 0 ? factors : ["Operational baseline"],
        missing_inputs: missing,
      };
    });

    // Sort descending by priority_score
    rankings.sort((a, b) => b.priority_score - a.priority_score);
    rankings.forEach((r, idx) => {
      r.priority_rank = idx + 1;
    });

    return {
      status,
      model_name: "tabpfn",
      model_version: "0.1.11",
      executed_at: now.toISOString(),
      latency_ms: latencyMs,
      identities_ranked: rankings.length,
      rankings,
      disclaimer:
        "Prioritization indicates evidence ambiguity and review urgency; it is not a security verdict or proof of maliciousness.",
    };
  }
}
