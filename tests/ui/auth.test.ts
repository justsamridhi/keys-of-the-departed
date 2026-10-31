import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  sanitizeReturnUrl,
} from "../../client/src/pages/AuthPage.js";
import { validateConfirmPassword } from "../../client/src/pages/SignUpPage.js";

describe("Stage 2: Sign In Page Edge-Case Engineering", () => {
  describe("Email Input Edge Cases (RFC 5321)", () => {
    it("AUTH-01: Rejects empty email with clear accessible message", () => {
      const result = validateEmail("");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("AUTH-02: Rejects whitespace-only email", () => {
      const result = validateEmail("    ");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("AUTH-03: Trims leading and trailing whitespace from legitimate email", () => {
      const result = validateEmail("  investigator@archive.corp  ");
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe("investigator@archive.corp");
    });

    it("AUTH-04: Accepts valid emails with special characters, tags, and subdomains", () => {
      const testCases = [
        "carlos.mendez@corp.io",
        "investigator+stage2@archive.internal.corp",
        "agent_007-prod@sub.vault.co.uk",
      ];
      for (const email of testCases) {
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe(email);
      }
    });

    it("AUTH-05: Rejects malformed email missing @ or domain", () => {
      const malformed = [
        "plainaddress",
        "@missinguser.com",
        "missingdomain@.com",
        "user@nodot",
        "user@domain..com",
      ];
      for (const email of malformed) {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain("valid email format");
      }
    });

    it("AUTH-06: Rejects email exceeding maximum RFC 5321 limit of 254 characters", () => {
      const localPart = "a".repeat(60);
      const domainPart = "b".repeat(60) + ".corp";
      const oversized = `${localPart}@${domainPart}.${domainPart}.${domainPart}`;
      expect(oversized.length).toBeGreaterThan(254);

      const result = validateEmail(oversized);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("exceeds the maximum length");
    });

    it("AUTH-07: Safely rejects XSS injection attempts in email field", () => {
      const injectionAttempts = [
        "<script>alert(1)</script>",
        '"><img src=x onerror=alert(1)>',
        "javascript:alert(1)",
        "eval(String.fromCharCode(88,83,83))",
      ];
      for (const payload of injectionAttempts) {
        const result = validateEmail(payload);
        expect(result.isValid).toBe(false);
      }
    });
  });

  describe("Password Input Edge Cases", () => {
    it("AUTH-08: Rejects empty passphrase", () => {
      const result = validatePassword("");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Passphrase is required");
    });

    it("AUTH-09: Rejects passphrase shorter than 8 characters", () => {
      const result = validatePassword("1234567");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("at least 8 characters");
    });

    it("AUTH-10: Accepts passphrases meeting the 8-character requirement", () => {
      const result = validatePassword("CorrectHorseBatteryStaple123!");
      expect(result.isValid).toBe(true);
    });

    it("AUTH-11: Rejects excessively oversized password to mitigate DoS (exceeding 128 chars)", () => {
      const hugePassword = "A".repeat(129);
      const result = validatePassword(hugePassword);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("maximum permitted length of 128 characters");
    });

    it("AUTH-12: Accepts unicode and special characters in passphrase safely", () => {
      const unicodePassword = "DíaDeLosMuertos★2026!🗝️";
      const result = validatePassword(unicodePassword);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Return URL Safety & Open Redirect Mitigation", () => {
    it("AUTH-13: Preserves safe whitelisted internal routes", () => {
      expect(sanitizeReturnUrl("archive")).toBe("archive");
      expect(sanitizeReturnUrl("/archive")).toBe("archive");
      expect(sanitizeReturnUrl("#/archive")).toBe("archive");
      expect(sanitizeReturnUrl("case_demo_01")).toBe("case_demo_01");
      expect(sanitizeReturnUrl("dashboard")).toBe("dashboard");
      expect(sanitizeReturnUrl("about")).toBe("about");
    });

    it("AUTH-14: Sanitizes query params and hashes attached to internal routes", () => {
      expect(sanitizeReturnUrl("archive?filter=lost")).toBe("archive");
      expect(sanitizeReturnUrl("#/archive?view=detailed")).toBe("archive");
    });

    it("AUTH-15: Blocks open redirect attempts to external protocols and domains", () => {
      const adversarialTargets = [
        "https://evil-phishing.com",
        "http://attacker.org/steal",
        "//malicious-site.com",
        "javascript:alert(document.cookie)",
        "data:text/html,<script>alert(1)</script>",
        "../admin",
        "https://keys-of-the-departed.render.com.attacker.com",
      ];

      for (const target of adversarialTargets) {
        expect(sanitizeReturnUrl(target)).toBe("landing");
      }
    });

    it("AUTH-16: Gracefully falls back to landing when return URL is empty or null", () => {
      expect(sanitizeReturnUrl("")).toBe("landing");
      expect(sanitizeReturnUrl(null)).toBe("landing");
      expect(sanitizeReturnUrl(undefined)).toBe("landing");
      expect(sanitizeReturnUrl("   ")).toBe("landing");
    });
  });

  describe("Confirm Passphrase Edge Cases", () => {
    it("AUTH-17: Rejects empty confirm passphrase with accessible error", () => {
      const result = validateConfirmPassword("VaultPassphrase123!", "");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Please re-enter your passphrase to confirm");
    });

    it("AUTH-18: Rejects mismatched confirmation passphrase", () => {
      const result = validateConfirmPassword("VaultPassphrase123!", "DifferentPassphrase456!");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Passphrases do not match");
    });

    it("AUTH-19: Accepts matching confirmation passphrases", () => {
      const result = validateConfirmPassword("VaultPassphrase123!", "VaultPassphrase123!");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("AUTH-20: Handles matching unicode and special character passphrases correctly", () => {
      const complex = "DíaDeLosMuertos★2026!🗝️";
      const result = validateConfirmPassword(complex, complex);
      expect(result.isValid).toBe(true);
    });
  });
});
