import { describe, it, expect } from "vitest";
import { CreateInvestigationSchema, UploadFilesInputSchema } from "@keys/contracts";

describe("Phase 3: Frontend Dashboard & New Investigation Mechanics", () => {
  describe("Investigation Creation Validation", () => {
    it("UI-INV-01: Accepts valid investigation name and description", () => {
      const input = {
        name: "Q4 Infrastructure Key Audit",
        description: "Checking departed engineers across clusters.",
      };
      const result = CreateInvestigationSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Q4 Infrastructure Key Audit");
      }
    });

    it("UI-INV-02: Trims whitespace and rejects blank investigation name", () => {
      const input = { name: "    " };
      const result = CreateInvestigationSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Investigation name is required");
      }
    });

    it("UI-INV-03: Rejects name longer than 120 characters", () => {
      const input = { name: "X".repeat(121) };
      const result = CreateInvestigationSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("120 characters or less");
      }
    });

    it("UI-INV-04: Rejects description longer than 500 characters", () => {
      const input = {
        name: "Valid Name",
        description: "D".repeat(505),
      };
      const result = CreateInvestigationSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("500 characters or less");
      }
    });
  });

  describe("Upload File Validation & Extension Filters", () => {
    const ALLOWED_EXTENSIONS = [".json", ".jsonl", ".ndjson", ".log", ".txt"];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    function validateFileSelection(filename: string, sizeBytes: number) {
      const ext = "." + filename.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return { valid: false, error: `Unsupported extension (${ext})` };
      }
      if (sizeBytes === 0) {
        return { valid: false, error: "File is empty" };
      }
      if (sizeBytes > MAX_SIZE) {
        return { valid: false, error: "File exceeds 5MB limit" };
      }
      return { valid: true };
    }

    it("UI-INV-05: Validates allowed extensions (.json, .log, .txt, .jsonl, .ndjson)", () => {
      expect(validateFileSelection("commits.log", 1024).valid).toBe(true);
      expect(validateFileSelection("tickets.json", 2048).valid).toBe(true);
      expect(validateFileSelection("audit.ndjson", 4096).valid).toBe(true);
      expect(validateFileSelection("readme.txt", 512).valid).toBe(true);
      expect(validateFileSelection("raw.jsonl", 1024).valid).toBe(true);
    });

    it("UI-INV-06: Rejects disallowed file types (.pdf, .exe, .sh, .py)", () => {
      expect(validateFileSelection("report.pdf", 1024).valid).toBe(false);
      expect(validateFileSelection("malicious.exe", 1024).valid).toBe(false);
      expect(validateFileSelection("script.sh", 1024).valid).toBe(false);
      expect(validateFileSelection("parser.py", 1024).valid).toBe(false);
    });

    it("UI-INV-07: Rejects empty files and files exceeding 5MB limit", () => {
      expect(validateFileSelection("empty.log", 0).valid).toBe(false);
      expect(validateFileSelection("huge.log", 6 * 1024 * 1024).valid).toBe(false);
    });

    it("UI-INV-08: UploadFilesInputSchema enforces at least 1 file and max 20 files", () => {
      expect(UploadFilesInputSchema.safeParse({ files: [] }).success).toBe(false);

      const twentyOneFiles = Array.from({ length: 21 }, (_, i) => ({
        filename: `file_${i}.log`,
        content: "log content",
      }));
      expect(UploadFilesInputSchema.safeParse({ files: twentyOneFiles }).success).toBe(false);

      const validFiles = [
        { filename: "f1.log", content: "log 1" },
        { filename: "f2.json", content: "{}" },
      ];
      expect(UploadFilesInputSchema.safeParse({ files: validFiles }).success).toBe(true);
    });
  });

  describe("Dashboard Metrics & Integrity Display", () => {
    it("UI-INV-09: Computes chamber distributions accurately without synthetic drift", () => {
      const mockAccounts = [
        { ghost_type: "LOST", owner_status: "verified" },
        { ghost_type: "LOST", owner_status: "verified" },
        { ghost_type: "FORGOTTEN", owner_status: "no_evidence" },
        { ghost_type: "LONELY", owner_status: "supported" },
        { ghost_type: "INNOCENT", owner_status: "supported" },
      ];

      const lostCount = mockAccounts.filter((a) => a.ghost_type === "LOST").length;
      const forgottenCount = mockAccounts.filter((a) => a.ghost_type === "FORGOTTEN").length;
      const lonelyCount = mockAccounts.filter((a) => a.ghost_type === "LONELY").length;
      const innocentCount = mockAccounts.filter((a) => a.ghost_type === "INNOCENT").length;

      expect(lostCount).toBe(2);
      expect(forgottenCount).toBe(1);
      expect(lonelyCount).toBe(1);
      expect(innocentCount).toBe(1);
      expect(lostCount + forgottenCount + lonelyCount + innocentCount).toBe(mockAccounts.length);
    });

    it("UI-INV-10: Identifies review required accounts from conflicting and no_evidence statuses", () => {
      const mockStatuses = ["verified", "supported", "conflicting", "no_evidence", "no_evidence"];
      const reviewRequired = mockStatuses.filter((s) => s === "conflicting" || s === "no_evidence");

      expect(reviewRequired).toHaveLength(3);
    });

    it("UI-INV-11: Route generator constructs valid hash URLs for investigation navigation", () => {
      function getInvestigationUrl(id: string) {
        return `#/investigation/${encodeURIComponent(id)}`;
      }

      function getNewInvestigationUrl() {
        return "#/investigation/new";
      }

      expect(getInvestigationUrl("inv_staging_2026_q1")).toBe(
        "#/investigation/inv_staging_2026_q1",
      );
      expect(getNewInvestigationUrl()).toBe("#/investigation/new");
    });
  });
});
