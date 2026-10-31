import { execFileSync, ExecFileSyncOptionsWithStringEncoding } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  DevRelayStatus,
  DevRelayProfile,
  DevRelayAgentSessionSummary,
  DevRelayDoctorDiagnostic,
  DevRelayReport,
} from "@keys/contracts";

export interface DevRelayRunner {
  (
    executable: string,
    args: string[],
    options?: { timeout?: number; encoding?: BufferEncoding; shell?: boolean },
  ): string | Buffer;
}

export interface DevrelayServiceOptions {
  binaryPath?: string;
  timeoutMs?: number;
  runner?: DevRelayRunner;
}

export class DevrelayService {
  private binaryPath: string;
  private timeoutMs: number;
  private runner: DevRelayRunner;

  constructor(options: DevrelayServiceOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.runner = options.runner ?? DevrelayService.defaultRunner;

    if (options.binaryPath) {
      this.binaryPath = options.binaryPath;
    } else {
      this.binaryPath = DevrelayService.detectBinaryPath();
    }
  }

  /**
   * Safe default runner using execFileSync with argument array.
   */
  public static defaultRunner: DevRelayRunner = (executable, args, opts) => {
    const isCmd =
      executable.toLowerCase().endsWith(".cmd") || executable.toLowerCase().endsWith(".bat");
    const execOptions: ExecFileSyncOptionsWithStringEncoding = {
      timeout: opts?.timeout ?? 8000,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: opts?.shell ?? (process.platform === "win32" && isCmd),
    };
    return execFileSync(executable, args, execOptions);
  };

  /**
   * Automatically resolve the DevRelay binary path.
   */
  public static detectBinaryPath(): string {
    if (process.env.DEVRELAY_BIN && fs.existsSync(process.env.DEVRELAY_BIN)) {
      return process.env.DEVRELAY_BIN;
    }

    const homeDir = process.env.USERPROFILE || process.env.HOME || "";
    if (homeDir) {
      const standardBin = path.join(
        homeDir,
        ".devrelay",
        "bin",
        process.platform === "win32" ? "dev_mlh_mcp_server.exe" : "dev_mlh_mcp_server",
      );
      if (fs.existsSync(standardBin)) {
        return standardBin;
      }
    }

    // Fall back to standard devrelay command on PATH
    return process.platform === "win32" ? "devrelay.cmd" : "devrelay";
  }

  /**
   * Execute DevRelay with array arguments and handle errors gracefully.
   */
  private runCommand(args: string[]): { success: boolean; output: string; error?: string } {
    try {
      const raw = this.runner(this.binaryPath, args, {
        timeout: this.timeoutMs,
        encoding: "utf-8",
      });
      return { success: true, output: raw.toString().trim() };
    } catch (err: unknown) {
      const errorObj = err as {
        code?: string;
        message?: string;
        stdout?: string | Buffer;
        stderr?: string | Buffer;
      };
      if (errorObj.code === "ETIMEDOUT") {
        return { success: false, output: "", error: "DevRelay command timed out" };
      }
      if (errorObj.code === "ENOENT") {
        return {
          success: false,
          output: "",
          error: `DevRelay binary not found at '${this.binaryPath}'`,
        };
      }
      const stderr = errorObj.stderr ? errorObj.stderr.toString().trim() : "";
      const stdout = errorObj.stdout ? errorObj.stdout.toString().trim() : "";
      const msg = stderr || stdout || errorObj.message || "Command execution failed";
      // Sanitize any potential sensitive token values in error messages
      const sanitized = msg.replace(
        /(token|secret|password|bearer|key)=([^\s&]+)/gi,
        "$1=[REDACTED]",
      );
      return { success: false, output: stdout, error: sanitized };
    }
  }

  /**
   * Check if DevRelay is installed and fetch its version.
   */
  public isInstalled(): {
    installed: boolean;
    version?: string;
    binaryPath: string;
    error?: string;
  } {
    const res = this.runCommand(["--version"]);
    if (res.success && res.output) {
      const match = res.output.match(/devrelay\s+([0-9.]+)/i);
      return {
        installed: true,
        version: match ? match[1] : res.output,
        binaryPath: this.binaryPath,
      };
    }
    return { installed: false, binaryPath: this.binaryPath, error: res.error };
  }

  /**
   * Fetch connected DEV.to / MLH authentication profile.
   */
  public async getAuthStatus(): Promise<{
    connected: boolean;
    profile?: DevRelayProfile;
    error?: string;
  }> {
    const res = this.runCommand(["--auth-status"]);
    if (!res.success) {
      return { connected: false, error: res.error || "Failed to query authentication status" };
    }

    try {
      const data = JSON.parse(res.output);
      const devProfile = data.dev;
      if (devProfile && devProfile.username) {
        return {
          connected: true,
          profile: {
            username: devProfile.username,
            name: devProfile.name || null,
            github_username: devProfile.github_username || null,
            profile_image: devProfile.profile_image || null,
            joined_at: devProfile.joined_at || null,
            mlh_user_id: data.core?.id || null,
          },
        };
      }
      return { connected: false, error: "No connected DEV account profile detected" };
    } catch {
      return { connected: false, error: "Malformed auth-status JSON response" };
    }
  }

  /**
   * Query DevRelay doctor diagnostics for health and installed skills status.
   */
  public async getDoctorDiagnostics(): Promise<DevRelayDoctorDiagnostic | null> {
    const res = this.runCommand(["--doctor"]);
    if (!res.success && !res.output) {
      return null;
    }

    const output = res.output || res.error || "";
    const devConnected = /DEV account\s+connected/i.test(output);
    const mlhConnected = /MLH account\s+connected/i.test(output);

    const platformMatch = output.match(/platform\s+([a-zA-Z0-9_-]+)/i);
    const binaryMatch = output.match(/binary\s+(.+)/i);

    const skillsMatches = Array.from(
      output.matchAll(/[✓✗]\s+([0-9]+|none)\s+installed in\s+(.+)/gi),
    );
    const skillsDirs = skillsMatches.map((m) => m[2].trim());

    const issuesMatch = output.match(/([0-9]+)\s+issue\(s\)\s+found/i);
    const issuesCount = issuesMatch ? parseInt(issuesMatch[1], 10) : 0;

    return {
      platform: platformMatch ? platformMatch[1] : process.platform,
      binary_path: binaryMatch ? binaryMatch[1].trim() : this.binaryPath,
      dev_connected: devConnected,
      mlh_connected: mlhConnected,
      skills_dirs: skillsDirs,
      issues_count: issuesCount,
    };
  }

  /**
   * Get overarching DevRelay status.
   */
  public async getStatus(): Promise<DevRelayStatus> {
    const check = this.isInstalled();
    if (!check.installed) {
      return {
        available: false,
        version: null,
        connected: false,
        profile: null,
        skills_installed_count: 0,
        error:
          check.error || `DevRelay CLI not available or failed to execute at '${this.binaryPath}'`,
      };
    }

    const auth = await this.getAuthStatus();
    let skillsCount = 0;
    try {
      const diag = await this.getDoctorDiagnostics();
      skillsCount = diag?.skills_dirs?.length ?? 0;
    } catch {
      // Non-critical diagnostic failure
    }

    return {
      available: true,
      version: check.version || null,
      connected: auth.connected,
      profile: auth.profile || null,
      skills_installed_count: skillsCount,
      error: auth.error || null,
    };
  }

  /**
   * List agent session transcripts saved on DEV via DevRelay.
   */
  public async getSessions(): Promise<DevRelayAgentSessionSummary[]> {
    const res = this.runCommand(["sessions", "list"]);
    if (!res.success) {
      return [];
    }

    try {
      const data = JSON.parse(res.output);
      if (Array.isArray(data)) {
        return data as DevRelayAgentSessionSummary[];
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch specific agent session by ID or slug.
   */
  public async getSessionById(id: string): Promise<Record<string, unknown> | null> {
    // Strictly validate input against path traversal and shell injection
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new Error("Invalid session ID format");
    }

    const res = this.runCommand(["sessions", "get", id]);
    if (!res.success) {
      if (res.error && res.error.includes("404")) {
        return null;
      }
      throw new Error(res.error || "Failed to retrieve session from DevRelay");
    }

    try {
      return JSON.parse(res.output);
    } catch {
      throw new Error("Malformed JSON received from DevRelay sessions get");
    }
  }

  /**
   * Get consolidated DevRelay report combining status, published sessions, and diagnostics.
   */
  public async getReport(): Promise<DevRelayReport> {
    const status = await this.getStatus();
    let sessions: DevRelayAgentSessionSummary[] = [];
    let diagnostics: DevRelayDoctorDiagnostic | null = null;

    if (status.available) {
      sessions = await this.getSessions();
      diagnostics = await this.getDoctorDiagnostics();
    }

    return {
      status,
      sessions,
      diagnostics,
    };
  }
}
