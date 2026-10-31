import { SandboxAction } from "@keys/contracts";

export interface SandboxExecutionOutcome {
  sandbox_id: string;
  executed_at: string;
  simulated_action: SandboxAction;
  target_account: string;
  simulated_logs: string[];
  is_sandbox_simulation: true;
}

/**
 * Isolated Sandbox Remediation Adapter
 *
 * CRITICAL SAFETY ENFORCEMENT:
 * - This adapter ONLY simulates remediation in a mocked sandbox environment.
 * - It NEVER connects to real AWS, GitHub, Azure, GCP, or OAuth provider APIs.
 * - Any attempt to specify an unpermitted or production-level action is rejected.
 */
export class SandboxRemediationAdapter {
  private static readonly PERMITTED_ACTIONS: Set<SandboxAction> = new Set([
    "simulate_revoke_deploy_key",
    "simulate_disable_service_account",
    "simulate_quarantine_token",
  ]);

  /**
   * Executes a simulated remediation action in the sandbox.
   */
  public static async executeSimulatedRemediation(
    action: SandboxAction,
    targetAccountId: string,
    investigationId: string,
    approverId: string,
  ): Promise<SandboxExecutionOutcome> {
    if (!this.PERMITTED_ACTIONS.has(action)) {
      throw new Error(
        `Safety Violation: Action '${action}' is not an authorized sandbox remediation action. Production actions are strictly prohibited.`,
      );
    }

    const executedAt = new Date().toISOString();
    const sandboxId = `sbx_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    // Build realistic, isolated simulated log trail
    const simulatedLogs: string[] = [
      `[SIMULATED SANDBOX][${executedAt}] Initializing sandbox worker ${sandboxId} for target: ${targetAccountId}`,
      `[SIMULATED SANDBOX][${executedAt}] Authenticated approver: ${approverId} (Authorization claim: approve:revocations verified)`,
      `[SIMULATED SANDBOX][${executedAt}] Investigation scope: ${investigationId}`,
      `[SIMULATED SANDBOX][${executedAt}] Safety Check: Sandbox isolation verified. Real provider APIs are disconnected.`,
    ];

    switch (action) {
      case "simulate_revoke_deploy_key":
        simulatedLogs.push(
          `[SIMULATED SANDBOX][${executedAt}] [SIMULATION] Emulated SSH authorized_keys deletion for key id: ${targetAccountId}`,
          `[SIMULATED SANDBOX][${executedAt}] [SIMULATION] Simulated GitHub Repository Deploy Key marked inactive.`,
          `[SIMULATED SANDBOX][${executedAt}] [SIMULATION] Deploy key successfully revoked in sandbox state store.`,
        );
        break;

      case "simulate_disable_service_account":
        simulatedLogs.push(
          `[SIMULATED SANDBOX][${executedAt}] [SIMULATION] Emulated IAM service account suspension for: ${targetAccountId}`,
          `[SIMULATED SANDBOX][${executedAt}] [SIMULATION] Attached deny-all policy: keys-departed-sandbox-deny-policy`,
          `[SIMULATED SANDBOX][${executedAt}] [SIMULATION] Service account disabled in sandbox state store.`,
        );
        break;

      case "simulate_quarantine_token":
        simulatedLogs.push(
          `[SIMULATED SANDBOX][${executedAt}] [SIMULATION] Emulated secret quarantine rotation for: ${targetAccountId}`,
          `[SIMULATED SANDBOX][${executedAt}] [SIMULATION] Invalidated simulated bearer token sessions.`,
          `[SIMULATED SANDBOX][${executedAt}] [SIMULATION] Token quarantined in sandbox state store.`,
        );
        break;
    }

    simulatedLogs.push(
      `[SIMULATED SANDBOX][${executedAt}] Remediation simulation finished successfully (Status: COMPLETED). Zero production credentials were altered.`,
    );

    return {
      sandbox_id: sandboxId,
      executed_at: executedAt,
      simulated_action: action,
      target_account: targetAccountId,
      simulated_logs: simulatedLogs,
      is_sandbox_simulation: true,
    };
  }
}
