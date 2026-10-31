import { execSync, ExecSyncOptions } from "node:child_process";
import {
  EntireCheckpoint,
  EntireSession,
  EntireProvenanceStatus,
  EntireProvenanceReport,
} from "@keys/contracts";

export interface CommandRunner {
  (command: string, options?: ExecSyncOptions): Buffer | string;
}

export class EntireService {
  private cwd: string;
  private runner: CommandRunner;

  constructor(cwd: string = process.cwd(), runner: CommandRunner = execSync) {
    this.cwd = cwd;
    this.runner = runner;
  }

  /**
   * Check if Entire CLI is installed and available in the environment.
   */
  public isInstalled(): { installed: boolean; version?: string } {
    try {
      const output = this.runner("entire --version", {
        cwd: this.cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      }).toString();
      const match = output.match(/Entire CLI\s+([0-9.]+)/i);
      return { installed: true, version: match ? match[1] : output.trim() };
    } catch {
      return { installed: false };
    }
  }

  /**
   * Get provenance status of the repository according to Entire.
   */
  public async getStatus(): Promise<EntireProvenanceStatus> {
    const check = this.isInstalled();
    if (!check.installed) {
      return {
        available: false,
        cli_version: null,
        enabled: false,
        branch: null,
        active_sessions_count: 0,
        checkpoints_count: 0,
        error: "Entire CLI is not installed or not available on PATH",
      };
    }

    try {
      const statusOutput = this.runner("entire status", {
        cwd: this.cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      }).toString();

      const enabled = /Enabled/i.test(statusOutput);
      const branchMatch = statusOutput.match(/branch\s+([a-zA-Z0-9_./-]+)/i);
      const branch = branchMatch ? branchMatch[1] : null;

      const sessions = await this.getSessions();
      const checkpoints = await this.getCheckpoints();

      const activeSessionsCount = sessions.filter((s) => s.status === "active").length;

      return {
        available: true,
        cli_version: check.version || null,
        enabled,
        branch,
        active_sessions_count: activeSessionsCount,
        checkpoints_count: checkpoints.length,
        error: null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        available: false,
        cli_version: check.version || null,
        enabled: false,
        branch: null,
        active_sessions_count: 0,
        checkpoints_count: 0,
        error: message,
      };
    }
  }

  /**
   * Retrieve genuine checkpoints from Entire git-ref tracking.
   */
  public async getCheckpoints(): Promise<EntireCheckpoint[]> {
    try {
      const output = this.runner("entire checkpoint list --json", {
        cwd: this.cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      }).toString();

      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        return parsed as EntireCheckpoint[];
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieve genuine agent sessions tracked by Entire.
   */
  public async getSessions(): Promise<EntireSession[]> {
    try {
      const output = this.runner("entire session list --json", {
        cwd: this.cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      }).toString();

      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        return parsed as EntireSession[];
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieve full provenance report combining status, checkpoints, and sessions.
   */
  public async getProvenanceReport(): Promise<EntireProvenanceReport> {
    const status = await this.getStatus();
    let checkpoints: EntireCheckpoint[] = [];
    let sessions: EntireSession[] = [];

    if (status.available) {
      checkpoints = await this.getCheckpoints();
      sessions = await this.getSessions();
    }

    return {
      status,
      checkpoints,
      sessions,
    };
  }

  /**
   * Explain a specific checkpoint by ID.
   */
  public explainCheckpoint(id: string): Record<string, unknown> | null {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new Error("Invalid checkpoint ID format");
    }
    try {
      const output = this.runner(`entire checkpoint explain ${id} --json`, {
        cwd: this.cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      }).toString();
      return JSON.parse(output);
    } catch {
      return null;
    }
  }

  /**
   * Explain why a specific file and optional line exists via Entire attribution.
   */
  public explainWhy(file: string, line?: number): Record<string, unknown> | null {
    // Sanitize file path against argument injection
    if (!/^[a-zA-Z0-9_./-]+$/.test(file)) {
      throw new Error("Invalid file path format");
    }
    const target = line ? `${file}:${line}` : file;
    try {
      const output = this.runner(`entire why ${target} --json`, {
        cwd: this.cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      }).toString();
      return JSON.parse(output);
    } catch {
      return null;
    }
  }
}
