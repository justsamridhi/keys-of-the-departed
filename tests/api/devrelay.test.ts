import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../server/src/app.js";
import { loadConfig } from "../../server/src/config.js";
import { DevrelayService, DevRelayRunner } from "../../server/src/services/devrelayService.js";
import {
  DevRelayStatusSchema,
  DevRelayReportSchema,
  DevRelayAgentSessionSummarySchema,
  DevRelayDoctorDiagnosticSchema,
} from "@keys/contracts";

describe(
  "Phase 6: DevRelay Gateway & Agent Session Registry Integration",
  { timeout: 20000 },
  () => {
    const baseConfig = loadConfig({ NODE_ENV: "test" });
    const liveDevrelayService = new DevrelayService();
    const app = createApp(
      baseConfig,
      {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      liveDevrelayService,
    );

    describe("GET /api/devrelay/status", () => {
      it("DEVRELAY-01: Successful CLI interaction returns valid DevRelay status conforming to schema", async () => {
        const res = await request(app).get("/api/devrelay/status");
        expect(res.status).toBe(200);

        const parsed = DevRelayStatusSchema.safeParse(res.body);
        expect(parsed.success).toBe(true);

        expect(typeof res.body.available).toBe("boolean");
        if (res.body.available) {
          expect(res.body.version).toMatch(/0\.[0-9]+\.[0-9]+/);
          expect(typeof res.body.connected).toBe("boolean");
        }
      });

      it("DEVRELAY-02: Returns connected DEV profile details when connected to DEV", async () => {
        const res = await request(app).get("/api/devrelay/status");
        expect(res.status).toBe(200);

        if (res.body.available && res.body.connected) {
          expect(res.body.profile).toBeDefined();
          expect(res.body.profile.username).toBe("justsamridhi");
          expect(res.body.profile.name).toBe("Samridhi Gupta");
        }
      });

      it("DEVRELAY-03: Gracefully handles missing CLI binary (ENOENT) without crashing", async () => {
        const missingRunner: DevRelayRunner = () => {
          const err = new Error("spawnSync non_existent_devrelay ENOENT") as Error & {
            code: string;
          };
          err.code = "ENOENT";
          throw err;
        };

        const failingService = new DevrelayService({
          binaryPath: "non_existent_devrelay",
          runner: missingRunner,
        });

        const testApp = createApp(
          baseConfig,
          {},
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          failingService,
        );

        const res = await request(testApp).get("/api/devrelay/status");
        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
        expect(res.body.connected).toBe(false);
        expect(res.body.error).toContain("DevRelay binary not found");
      });

      it("DEVRELAY-04: Gracefully handles command timeout without throwing unhandled exceptions", async () => {
        const timeoutRunner: DevRelayRunner = () => {
          const err = new Error("ETIMEDOUT") as Error & { code: string };
          err.code = "ETIMEDOUT";
          throw err;
        };

        const timeoutService = new DevrelayService({ runner: timeoutRunner });
        const testApp = createApp(
          baseConfig,
          {},
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          timeoutService,
        );

        const res = await request(testApp).get("/api/devrelay/status");
        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
        expect(res.body.error).toBe("DevRelay command timed out");
      });

      it("DEVRELAY-05: Gracefully handles non-zero exit code", async () => {
        const nonZeroRunner: DevRelayRunner = () => {
          const err = new Error("Command failed: exit code 1") as Error & {
            status: number;
            stderr: string;
          };
          err.status = 1;
          err.stderr = "Internal Gateway Error";
          throw err;
        };

        const errorService = new DevrelayService({ runner: nonZeroRunner });
        const testApp = createApp(
          baseConfig,
          {},
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          errorService,
        );

        const res = await request(testApp).get("/api/devrelay/status");
        expect(res.status).toBe(200);
        expect(res.body.available).toBe(false);
      });
    });

    describe("GET /api/devrelay/report", () => {
      it("DEVRELAY-06: Returns consolidated report satisfying DevRelayReportSchema", async () => {
        const res = await request(app).get("/api/devrelay/report");
        expect(res.status).toBe(200);

        const parsed = DevRelayReportSchema.safeParse(res.body);
        expect(parsed.success).toBe(true);

        expect(res.body.status).toBeDefined();
        expect(Array.isArray(res.body.sessions)).toBe(true);
      }, 20000);

      it("DEVRELAY-07: Gracefully handles unavailable service returning empty sessions and diagnostics", async () => {
        const unavailableRunner: DevRelayRunner = () => {
          const err = new Error("Service unavailable") as Error & { code: string };
          err.code = "ENOENT";
          throw err;
        };

        const failingService = new DevrelayService({ runner: unavailableRunner });
        const testApp = createApp(
          baseConfig,
          {},
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          failingService,
        );

        const res = await request(testApp).get("/api/devrelay/report");
        expect(res.status).toBe(200);
        expect(res.body.status.available).toBe(false);
        expect(res.body.sessions).toEqual([]);
        expect(res.body.diagnostics).toBeNull();
      });
    });

    describe("GET /api/devrelay/sessions", () => {
      it("DEVRELAY-08: Lists published agent sessions conforming to schema", async () => {
        const res = await request(app).get("/api/devrelay/sessions");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        for (const session of res.body) {
          const parsed = DevRelayAgentSessionSummarySchema.safeParse(session);
          expect(parsed.success).toBe(true);
        }
      });

      it("DEVRELAY-09: Handles malformed JSON from sessions list gracefully", async () => {
        const malformedRunner: DevRelayRunner = (_exe, args) => {
          if (args[0] === "sessions" && args[1] === "list") {
            return "INVALID_NON_JSON_OUTPUT_<<<>>>";
          }
          return "devrelay 0.1.24";
        };

        const mockService = new DevrelayService({ runner: malformedRunner });
        const testApp = createApp(
          baseConfig,
          {},
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          mockService,
        );

        const res = await request(testApp).get("/api/devrelay/sessions");
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });

    describe("GET /api/devrelay/sessions/:id", () => {
      it("DEVRELAY-10: Rejects invalid session ID format with 400 Bad Request", async () => {
        const res = await request(app).get("/api/devrelay/sessions/invalid;drop-tables");
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid session ID format");
      });

      it("DEVRELAY-11: Returns 404 for non-existent session ID on DEV", async () => {
        const notFoundRunner: DevRelayRunner = (_exe, _args) => {
          const err = new Error("404 Not Found: Session not found") as Error & {
            stderr: string;
            status: number;
          };
          err.stderr = "404 Not Found: Session 99999999 not found";
          err.status = 1;
          throw err;
        };

        const notFoundService = new DevrelayService({ runner: notFoundRunner });
        const testApp = createApp(
          baseConfig,
          {},
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          notFoundService,
        );

        const res = await request(testApp).get("/api/devrelay/sessions/99999999");
        expect(res.status).toBe(404);
        expect(res.body.error).toContain("Agent session not found");
      });

      it("DEVRELAY-12: Successfully returns session details when session exists", async () => {
        const mockSessionData = {
          id: 42,
          title: "Test Implementation Session",
          tool_name: "gemini_cli",
          messages: [{ role: "user", content: "Implement feature" }],
        };

        const sessionRunner: DevRelayRunner = (_exe, args) => {
          if (args[0] === "sessions" && args[1] === "get" && args[2] === "42") {
            return JSON.stringify(mockSessionData);
          }
          return "devrelay 0.1.24";
        };

        const mockService = new DevrelayService({ runner: sessionRunner });
        const testApp = createApp(
          baseConfig,
          {},
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          mockService,
        );

        const res = await request(testApp).get("/api/devrelay/sessions/42");
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(42);
        expect(res.body.title).toBe("Test Implementation Session");
      });
    });

    describe("GET /api/devrelay/diagnostics", () => {
      it("DEVRELAY-13: Returns doctor diagnostics conforming to DevRelayDoctorDiagnosticSchema", async () => {
        const doctorRunner: DevRelayRunner = () => {
          return `
DevRelay Doctor Diagnostics
Platform: linux-x64
Binary: /usr/local/bin/devrelay
DEV account: connected (username: justsamridhi)
MLH account: connected
Skills:
  ✓ 3 installed in /home/runner/.config/devrelay/skills
0 issue(s) found
`;
        };

        const doctorService = new DevrelayService({ runner: doctorRunner });
        const testApp = createApp(
          baseConfig,
          {},
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          doctorService,
        );

        const res = await request(testApp).get("/api/devrelay/diagnostics");
        expect(res.status).toBe(200);

        const parsed = DevRelayDoctorDiagnosticSchema.safeParse(res.body);
        expect(parsed.success).toBe(true);

        expect(typeof res.body.dev_connected).toBe("boolean");
        expect(typeof res.body.mlh_connected).toBe("boolean");
      });

      it("DEVRELAY-14: Redacts sensitive tokens if present in errors", async () => {
        const tokenErrorRunner: DevRelayRunner = () => {
          const err = new Error(
            "Failed with token=secret_token_123456&key=super_secret",
          ) as Error & {
            stderr: string;
          };
          err.stderr = "Failed with token=secret_token_123456&key=super_secret";
          throw err;
        };

        const secureService = new DevrelayService({ runner: tokenErrorRunner });
        const testApp = createApp(
          baseConfig,
          {},
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          secureService,
        );

        const res = await request(testApp).get("/api/devrelay/status");
        expect(res.status).toBe(200);
        expect(res.body.error).not.toContain("secret_token_123456");
        expect(res.body.error).toContain("[REDACTED]");
      });

      it("DEVRELAY-15: Path traversal attempts in session ID are strictly rejected with 400", async () => {
        const res = await request(app).get("/api/devrelay/sessions/..%2F..%2Fetc%2Fpasswd");
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid session ID format");
      });
    });
  },
);
