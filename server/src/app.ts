import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { z } from "zod";
import { ServerConfig } from "./config.js";
import { computeHealthStatus, DependencyCheckers } from "./health.js";
import {
  AccountsQuerySchema,
  CaseSchema,
  CreateInvestigationSchema,
  DashboardStatsSchema,
  EvidenceRecordSchema,
  InvestigationFindingsSchema,
  InvestigationSchema,
  UploadFilesInputSchema,
  CreateApprovalInputSchema,
  DecideApprovalInputSchema,
} from "@keys/contracts";
import {
  AccountsRepository,
  FixtureAccountsRepository,
} from "./repositories/accountsRepository.js";
import { CasesRepository, FixtureCasesRepository } from "./repositories/casesRepository.js";
import { AuthOptions } from "express-oauth2-jwt-bearer";
import { createAuthMiddleware, requirePermission } from "./auth/jwt.js";
import {
  InvestigationsRepository,
  FixtureInvestigationsRepository,
} from "./repositories/investigationsRepository.js";
import { isDatabaseUnavailableError } from "./repositories/unavailableInvestigationsRepository.js";
import { EntireService } from "./services/entireService.js";
import { DevrelayService } from "./services/devrelayService.js";

/**
 * Resolves the location of the compiled frontend dist folder across
 * monorepo root, server directory, or custom CLIENT_DIST environment variable.
 */
export function resolveClientDist(configDist?: string): string {
  if (configDist && fs.existsSync(configDist)) {
    return path.resolve(configDist);
  }
  if (process.env.CLIENT_DIST && fs.existsSync(process.env.CLIENT_DIST)) {
    return path.resolve(process.env.CLIENT_DIST);
  }
  const rootDist = path.resolve(process.cwd(), "client/dist");
  if (fs.existsSync(rootDist)) return rootDist;

  const parentDist = path.resolve(process.cwd(), "../client/dist");
  if (fs.existsSync(parentDist)) return parentDist;

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const relativeDist = path.resolve(currentDir, "../../client/dist");
  if (fs.existsSync(relativeDist)) return relativeDist;

  return rootDist;
}

export function createApp(
  config: ServerConfig,
  checkers: DependencyCheckers = {},
  accountsRepo: AccountsRepository = new FixtureAccountsRepository(),
  casesRepo: CasesRepository = new FixtureCasesRepository(),
  investigationsRepo: InvestigationsRepository = new FixtureInvestigationsRepository(),
  authOptionsOverride?: Partial<AuthOptions>,
  entireService: EntireService = new EntireService(),
  devrelayService: DevrelayService = new DevrelayService(),
): Express {
  const app = express();
  const startTime = Date.now();
  const authMiddleware = createAuthMiddleware(config, authOptionsOverride);
  const requireCreateInvestigation = requirePermission("create:investigations");

  // Configure CORS: allow localhost in dev/test, use explicit origins in production if configured
  const corsOrigin =
    config.NODE_ENV === "production" && config.CORS_ORIGIN
      ? config.CORS_ORIGIN.split(",").map((s) => s.trim())
      : true;

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: "10mb" }));

  // Request logger in non-test
  if (config.NODE_ENV !== "test") {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });
  }

  // 1. Healthcheck endpoint (SPEC 5.7, Render Health Check & Liveness/Readiness probes)
  const handleHealth = async (req: Request, res: Response) => {
    const checkType = req.query.type as string | undefined;

    // Liveness probe: confirms Express process is running and accepting HTTP traffic
    if (checkType === "liveness" || req.path === "/healthz/live") {
      return res.status(200).json({
        status: "ok",
        type: "liveness",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
      });
    }

    // Readiness / comprehensive check: verifies database connectivity if configured
    const { status, httpStatus } = await computeHealthStatus(config, startTime, checkers);
    res.status(httpStatus).json(status);
  };

  app.get("/healthz", handleHealth);
  app.get("/healthz/live", handleHealth);
  app.get("/healthz/ready", handleHealth);
  app.get("/api/health", handleHealth);

  // 2. Machine Identities endpoint (Four-Chamber Archive & Search)
  app.get("/api/accounts", async (req: Request, res: Response) => {
    const parseResult = AccountsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: parseResult.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }

    const isExplicitDemo = req.query.demo === "true";
    let callerSub: string | undefined;

    if (!isExplicitDemo && req.headers.authorization) {
      try {
        await new Promise<void>((resolve, reject) => {
          authMiddleware(req, res, (err) => (err ? reject(err) : resolve()));
        });
        callerSub = req.auth?.payload.sub;
      } catch {
        // Proceed without sub if token verification fails
      }
    }

    try {
      if (req.query.demo === "false" && !callerSub) {
        return res.status(200).json({
          data: [],
          pagination: {
            page: parseResult.data.page,
            limit: parseResult.data.limit,
            total: 0,
            totalPages: 0,
          },
          filters: {
            chapter: parseResult.data.chapter,
            status: parseResult.data.status,
            search: parseResult.data.search,
          },
          meta: {
            synthetic: false,
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (isExplicitDemo) {
        const demoRepo = new FixtureAccountsRepository();
        const result = await demoRepo.findAccounts(parseResult.data);
        return res.status(200).json(result);
      }

      if (callerSub) {
        const result = await investigationsRepo.getDiscoveredAccountsForOwner(
          callerSub,
          parseResult.data,
        );
        return res.status(200).json(result);
      }

      const result = await accountsRepo.findAccounts(parseResult.data);
      return res.status(200).json(result);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        return res.status(503).json({
          error: "Database unavailable",
          message:
            "MongoDB Atlas is required for persistent operations. Database is currently unavailable or unconfigured.",
        });
      }
      console.error("[app.ts /api/accounts error]:", err);
      return res.status(500).json({ error: "Failed to retrieve accounts" });
    }
  });

  // 3. Case lookup endpoint (SPEC 5.7)
  app.get("/api/cases/:id", async (req: Request<{ id: string }>, res: Response) => {
    const caseId = req.params.id;
    if (typeof caseId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(caseId)) {
      return res.status(400).json({ error: "Invalid case ID format" });
    }

    const isExplicitDemo = req.query.demo === "true";
    const repo = isExplicitDemo ? new FixtureCasesRepository() : casesRepo;

    try {
      const caseData = await repo.findCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const validated = CaseSchema.safeParse(caseData);
      if (!validated.success) {
        return res.status(500).json({ error: "Case record failed contract validation" });
      }

      return res.status(200).json(validated.data);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        return res.status(503).json({
          error: "Database unavailable",
          message:
            "MongoDB Atlas is required for persistent operations. Database is currently unavailable or unconfigured.",
        });
      }
      return res.status(500).json({ error: "Failed to query case record" });
    }
  });

  // 4. Case associated evidence records endpoint
  app.get("/api/cases/:id/records", async (req: Request<{ id: string }>, res: Response) => {
    const caseId = req.params.id;
    if (typeof caseId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(caseId)) {
      return res.status(400).json({ error: "Invalid case ID format" });
    }

    const isExplicitDemo = req.query.demo === "true";
    const repo = isExplicitDemo ? new FixtureCasesRepository() : casesRepo;

    try {
      const caseData = await repo.findCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ error: "Case not found" });
      }

      const records = await repo.findRecordsByCaseId(caseId);
      return res.status(200).json(records);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        return res.status(503).json({
          error: "Database unavailable",
          message:
            "MongoDB Atlas is required for persistent operations. Database is currently unavailable or unconfigured.",
        });
      }
      return res.status(500).json({ error: "Failed to retrieve case evidence records" });
    }
  });

  // 5. Individual Evidence Record lookup endpoint (SPEC 5.7)
  app.get("/api/records/:id", async (req: Request<{ id: string }>, res: Response) => {
    const recordId = req.params.id;
    if (typeof recordId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(recordId)) {
      return res.status(400).json({ error: "Invalid record ID format" });
    }

    try {
      const record = await casesRepo.findRecordById(recordId);
      if (!record) {
        return res.status(404).json({ error: "Record not found" });
      }

      const rawDoc = record as Record<string, unknown>;
      // If the record is associated with an investigation, verify ownership of parent investigation
      if (typeof rawDoc.investigation_id === "string") {
        const parentInv = await investigationsRepo.findInvestigationById(
          rawDoc.investigation_id as string,
        );
        if (parentInv && parentInv.is_demo !== true) {
          // Private investigation evidence record requires authentication and matching owner
          return authMiddleware(req, res, () => {
            const callerSub = req.auth?.payload.sub;
            if (!parentInv.owner_id || parentInv.owner_id !== callerSub) {
              return res.status(404).json({ error: "Record not found" });
            }

            const { investigation_id: _invId, ...cleanRecord } = rawDoc;
            const validated = EvidenceRecordSchema.safeParse(cleanRecord);
            if (!validated.success) {
              return res.status(500).json({ error: "Evidence record failed contract validation" });
            }
            return res.status(200).json(validated.data);
          });
        }
      }

      const { investigation_id: _invId, ...cleanRecord } = rawDoc;
      const validated = EvidenceRecordSchema.safeParse(cleanRecord);
      if (!validated.success) {
        return res.status(500).json({ error: "Evidence record failed contract validation" });
      }

      return res.status(200).json(validated.data);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        return res.status(503).json({
          error: "Database unavailable",
          message:
            "MongoDB Atlas is required for persistent operations. Database is currently unavailable or unconfigured.",
        });
      }
      return res.status(500).json({ error: "Failed to query evidence record" });
    }
  });

  // ==========================================
  // Phase 3: Dashboard & Investigation Endpoints
  // ==========================================

  // 6. Dashboard statistics endpoint
  app.get("/api/stats/dashboard", async (req: Request, res: Response) => {
    try {
      const isExplicitDemo = req.query.demo === "true";
      let callerSub: string | undefined;

      if (!isExplicitDemo && req.headers.authorization) {
        try {
          await new Promise<void>((resolve, reject) => {
            authMiddleware(req, res, (err) => (err ? reject(err) : resolve()));
          });
          callerSub = req.auth?.payload.sub;
        } catch {
          // Proceed without sub if token verification fails
        }
      }

      if (req.query.demo === "false" && !callerSub) {
        return res.status(200).json({
          total_identities: 0,
          ghost_distribution: { LOST: 0, FORGOTTEN: 0, LONELY: 0, INNOCENT: 0 },
          evidence_status_distribution: {
            verified: 0,
            supported: 0,
            conflicting: 0,
            no_evidence: 0,
          },
          review_required_count: 0,
          recent_investigations: [],
          meta: {
            synthetic: false,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const stats = await investigationsRepo.getDashboardStats(
        isExplicitDemo ? undefined : callerSub,
      );
      const validated = DashboardStatsSchema.safeParse(stats);
      if (!validated.success) {
        return res.status(500).json({ error: "Dashboard stats failed contract validation" });
      }
      return res.status(200).json(validated.data);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        return res.status(503).json({
          error: "Database unavailable",
          message:
            "MongoDB Atlas is required for persistent dashboard statistics. Database is currently unavailable or unconfigured.",
        });
      }
      return res.status(500).json({ error: "Failed to generate dashboard statistics" });
    }
  });

  // 7. Create new investigation
  app.post(
    "/api/investigations",
    authMiddleware,
    requireCreateInvestigation,
    async (req: Request, res: Response) => {
      if (checkers.checkDb) {
        const dbStatus = await checkers.checkDb();
        if (dbStatus === "unavailable") {
          return res.status(503).json({
            error: "Database unavailable",
            message:
              "MongoDB Atlas is currently unavailable. Real investigation persistence operations cannot proceed.",
          });
        }
      }

      const parseResult = CreateInvestigationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid investigation parameters",
          details: parseResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }

      const callerSub = req.auth?.payload.sub;
      if (!callerSub) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Missing authenticated user identity in token",
        });
      }

      try {
        const created = await investigationsRepo.createInvestigation(
          {
            name: parseResult.data.name,
            organization_id: parseResult.data.organization_id,
            description: parseResult.data.description,
          },
          callerSub,
        );
        const validated = InvestigationSchema.safeParse(created);
        if (!validated.success) {
          return res
            .status(500)
            .json({ error: "Created investigation failed contract validation" });
        }
        return res.status(201).json(validated.data);
      } catch (err: unknown) {
        if (isDatabaseUnavailableError(err)) {
          return res.status(503).json({
            error: "Database unavailable",
            message:
              "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
          });
        }
        return res.status(500).json({ error: "Failed to create investigation" });
      }
    },
  );

  // 8. List investigations
  app.get("/api/investigations", async (req: Request, res: Response) => {
    // If caller sends authorization header, authenticate and enforce read:investigations
    if (req.headers.authorization) {
      return authMiddleware(req, res, () => {
        const requireRead = requirePermission("read:investigations");
        return requireRead(req, res, async () => {
          const callerSub = req.auth?.payload.sub;
          const demoFilter =
            typeof req.query.demo === "string" &&
            (req.query.demo === "true" || req.query.demo === "false")
              ? (req.query.demo as "true" | "false")
              : undefined;
          try {
            if (demoFilter === "false" && checkers.checkDb) {
              const dbStatus = await checkers.checkDb();
              if (dbStatus === "unavailable") {
                return res.status(503).json({
                  error: "Database unavailable",
                  message:
                    "MongoDB Atlas is currently unavailable. Real investigation operations cannot proceed.",
                });
              }
            }
            const list = await investigationsRepo.listInvestigations(callerSub, demoFilter);
            const validated = z.array(InvestigationSchema).safeParse(list);
            if (!validated.success) {
              return res
                .status(500)
                .json({ error: "Investigation list failed contract validation" });
            }
            return res.status(200).json(validated.data);
          } catch (err: unknown) {
            if (isDatabaseUnavailableError(err)) {
              return res.status(503).json({
                error: "Database unavailable",
                message:
                  "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
              });
            }
            return res.status(500).json({ error: "Failed to list investigations" });
          }
        });
      });
    }

    // Anonymous caller: return explicitly marked demo investigations only
    try {
      const demoFilter =
        typeof req.query.demo === "string" &&
        (req.query.demo === "true" || req.query.demo === "false")
          ? (req.query.demo as "true" | "false")
          : undefined;
      const list = await investigationsRepo.listInvestigations(undefined, demoFilter);
      const validated = z.array(InvestigationSchema).safeParse(list);
      if (!validated.success) {
        return res.status(500).json({ error: "Investigation list failed contract validation" });
      }
      return res.status(200).json(validated.data);
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        return res.status(503).json({
          error: "Database unavailable",
          message:
            "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
        });
      }
      return res.status(500).json({ error: "Failed to list investigations" });
    }
  });

  // 9. Get single investigation
  app.get("/api/investigations/:id", async (req: Request<{ id: string }>, res: Response) => {
    const investigationId = req.params.id;
    if (typeof investigationId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(investigationId)) {
      return res.status(400).json({ error: "Invalid investigation ID format" });
    }

    try {
      const inv = await investigationsRepo.findInvestigationById(investigationId);
      if (!inv) {
        return res.status(404).json({ error: "Investigation not found" });
      }

      // Public demo investigation: allow anonymous read
      if (inv.is_demo === true) {
        const validated = InvestigationSchema.safeParse(inv);
        if (!validated.success) {
          return res.status(500).json({ error: "Investigation failed contract validation" });
        }
        return res.status(200).json(validated.data);
      }

      // Private investigation: require valid JWT, read:investigations, and matching owner_id
      return authMiddleware(req, res, () => {
        const requireRead = requirePermission("read:investigations");
        return requireRead(req, res, () => {
          const callerSub = req.auth?.payload.sub;
          if (!inv.owner_id || inv.owner_id !== callerSub) {
            // Belonging to another user or unowned legacy: 404 to avoid resource enumeration
            return res.status(404).json({ error: "Investigation not found" });
          }

          const validated = InvestigationSchema.safeParse(inv);
          if (!validated.success) {
            return res.status(500).json({ error: "Investigation failed contract validation" });
          }
          return res.status(200).json(validated.data);
        });
      });
    } catch (err: unknown) {
      if (isDatabaseUnavailableError(err)) {
        return res.status(503).json({
          error: "Database unavailable",
          message:
            "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
        });
      }
      return res.status(500).json({ error: "Failed to retrieve investigation" });
    }
  });

  // 10. Upload source records to an investigation
  app.post(
    "/api/investigations/:id/upload",
    authMiddleware,
    requireCreateInvestigation,
    async (req: Request<{ id: string }>, res: Response) => {
      const investigationId = req.params.id;
      if (typeof investigationId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(investigationId)) {
        return res.status(400).json({ error: "Invalid investigation ID format" });
      }

      if (checkers.checkDb) {
        const dbStatus = await checkers.checkDb();
        if (dbStatus === "unavailable") {
          return res.status(503).json({
            error: "Database unavailable",
            message:
              "MongoDB Atlas is currently unavailable. Real investigation persistence operations cannot proceed.",
          });
        }
      }

      try {
        const inv = await investigationsRepo.findInvestigationById(investigationId);
        if (
          !inv ||
          !inv.owner_id ||
          inv.owner_id !== req.auth?.payload.sub ||
          inv.is_demo === true
        ) {
          return res.status(404).json({ error: "Investigation not found" });
        }

        const parseResult = UploadFilesInputSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            error: "Invalid upload files payload",
            details: parseResult.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          });
        }

        const uploadResult = await investigationsRepo.addUploadedFiles(
          investigationId,
          parseResult.data.files,
        );

        return res.status(200).json({
          investigation: uploadResult.investigation,
          files: uploadResult.files,
          extracted_records_count: uploadResult.extracted_records.length,
          errors: uploadResult.errors,
        });
      } catch (err: unknown) {
        if (isDatabaseUnavailableError(err)) {
          return res.status(503).json({
            error: "Database unavailable",
            message:
              "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
          });
        }
        const msg = err instanceof Error ? err.message : "Failed to upload files";
        return res.status(500).json({ error: msg });
      }
    },
  );

  // 11. Process investigation evidence
  app.post(
    "/api/investigations/:id/process",
    authMiddleware,
    requireCreateInvestigation,
    async (req: Request<{ id: string }>, res: Response) => {
      const investigationId = req.params.id;
      if (typeof investigationId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(investigationId)) {
        return res.status(400).json({ error: "Invalid investigation ID format" });
      }

      if (checkers.checkDb) {
        const dbStatus = await checkers.checkDb();
        if (dbStatus === "unavailable") {
          return res.status(503).json({
            error: "Database unavailable",
            message:
              "MongoDB Atlas is currently unavailable. Real investigation persistence operations cannot proceed.",
          });
        }
      }

      try {
        const inv = await investigationsRepo.findInvestigationById(investigationId);
        if (
          !inv ||
          !inv.owner_id ||
          inv.owner_id !== req.auth?.payload.sub ||
          inv.is_demo === true
        ) {
          return res.status(404).json({ error: "Investigation not found" });
        }

        const findings = await investigationsRepo.processInvestigation(investigationId);
        const validated = InvestigationFindingsSchema.safeParse(findings);
        if (!validated.success) {
          return res
            .status(500)
            .json({ error: "Investigation findings failed contract validation" });
        }

        return res.status(200).json(validated.data);
      } catch (err: unknown) {
        if (isDatabaseUnavailableError(err)) {
          return res.status(503).json({
            error: "Database unavailable",
            message:
              "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
          });
        }
        const msg = err instanceof Error ? err.message : "Failed to process investigation";
        return res.status(500).json({ error: msg });
      }
    },
  );

  // 12. Get investigation findings
  app.get(
    "/api/investigations/:id/findings",
    async (req: Request<{ id: string }>, res: Response) => {
      const investigationId = req.params.id;
      if (typeof investigationId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(investigationId)) {
        return res.status(400).json({ error: "Invalid investigation ID format" });
      }

      try {
        const inv = await investigationsRepo.findInvestigationById(investigationId);
        if (!inv) {
          return res.status(404).json({ error: "Investigation findings not found" });
        }

        const handleFindingsReturn = async () => {
          const findings = await investigationsRepo.getFindingsByInvestigationId(investigationId);
          if (!findings) {
            return res.status(404).json({ error: "Investigation findings not found" });
          }

          const validated = InvestigationFindingsSchema.safeParse(findings);
          if (!validated.success) {
            return res
              .status(500)
              .json({ error: "Investigation findings failed contract validation" });
          }

          return res.status(200).json(validated.data);
        };

        // Public demo investigation findings: allow anonymous read
        if (inv.is_demo === true) {
          return await handleFindingsReturn();
        }

        // Private investigation findings: require valid JWT, read:investigations, and matching owner_id
        return authMiddleware(req, res, () => {
          const requireRead = requirePermission("read:investigations");
          return requireRead(req, res, async () => {
            const callerSub = req.auth?.payload.sub;
            if (!inv.owner_id || inv.owner_id !== callerSub) {
              return res.status(404).json({ error: "Investigation findings not found" });
            }

            return await handleFindingsReturn();
          });
        });
      } catch (err: unknown) {
        if (isDatabaseUnavailableError(err)) {
          return res.status(503).json({
            error: "Database unavailable",
            message:
              "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
          });
        }
        return res.status(500).json({ error: "Failed to retrieve investigation findings" });
      }
    },
  );

  // 13. Create approval request (Propose simulated sandbox remediation)
  app.post(
    "/api/investigations/:id/approvals",
    authMiddleware,
    async (req: Request<{ id: string }>, res: Response) => {
      const investigationId = req.params.id;
      if (typeof investigationId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(investigationId)) {
        return res.status(400).json({ error: "Invalid investigation ID format" });
      }

      const callerSub = req.auth?.payload.sub;
      if (!callerSub) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parseResult = CreateApprovalInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid approval request payload",
          details: parseResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }

      try {
        const inv = await investigationsRepo.findInvestigationById(investigationId);
        if (!inv) {
          return res.status(404).json({ error: "Investigation not found" });
        }

        // Ownership enforcement: only investigation owner can propose actions
        if (!inv.owner_id || inv.owner_id !== callerSub) {
          return res.status(404).json({ error: "Investigation not found" });
        }

        const approvalReq = await investigationsRepo.createApprovalRequest(
          investigationId,
          parseResult.data,
          callerSub,
        );

        return res.status(201).json(approvalReq);
      } catch (err: unknown) {
        if (isDatabaseUnavailableError(err)) {
          return res.status(503).json({
            error: "Database unavailable",
            message:
              "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
          });
        }
        const msg = err instanceof Error ? err.message : "Failed to create approval request";
        return res.status(500).json({ error: msg });
      }
    },
  );

  // 14. List approval requests for an investigation
  app.get(
    "/api/investigations/:id/approvals",
    async (req: Request<{ id: string }>, res: Response) => {
      const investigationId = req.params.id;
      if (typeof investigationId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(investigationId)) {
        return res.status(400).json({ error: "Invalid investigation ID format" });
      }

      try {
        const inv = await investigationsRepo.findInvestigationById(investigationId);
        if (!inv) {
          return res.status(404).json({ error: "Investigation not found" });
        }

        const handleApprovalsReturn = async () => {
          const list = await investigationsRepo.listApprovalRequests(investigationId);
          return res.status(200).json(list);
        };

        if (inv.is_demo === true) {
          return await handleApprovalsReturn();
        }

        return authMiddleware(req, res, () => {
          const requireRead = requirePermission("read:investigations");
          return requireRead(req, res, async () => {
            const callerSub = req.auth?.payload.sub;
            if (!inv.owner_id || inv.owner_id !== callerSub) {
              return res.status(404).json({ error: "Investigation not found" });
            }
            return await handleApprovalsReturn();
          });
        });
      } catch (err: unknown) {
        if (isDatabaseUnavailableError(err)) {
          return res.status(503).json({
            error: "Database unavailable",
            message:
              "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
          });
        }
        return res.status(500).json({ error: "Failed to list approval requests" });
      }
    },
  );

  // 15. Decide approval request (Human-in-the-loop: approve:revocations permission required)
  const requireApproveRevocations = requirePermission("approve:revocations");

  app.post(
    "/api/investigations/:id/approvals/:reqId/decide",
    authMiddleware,
    requireApproveRevocations,
    async (req: Request<{ id: string; reqId: string }>, res: Response) => {
      const { id: investigationId, reqId } = req.params;
      if (!investigationId || !/^[a-zA-Z0-9_-]+$/.test(investigationId)) {
        return res.status(400).json({ error: "Invalid investigation ID format" });
      }
      if (!reqId || !/^[a-zA-Z0-9_-]+$/.test(reqId)) {
        return res.status(400).json({ error: "Invalid approval request ID format" });
      }

      const callerSub = req.auth?.payload.sub;
      if (!callerSub) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parseResult = DecideApprovalInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid decision payload",
          details: parseResult.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }

      try {
        const inv = await investigationsRepo.findInvestigationById(investigationId);
        if (!inv) {
          return res.status(404).json({ error: "Investigation not found" });
        }

        // Ownership isolation: verify investigation belongs to caller (or demo)
        if (!inv.is_demo && (!inv.owner_id || inv.owner_id !== callerSub)) {
          return res.status(404).json({ error: "Investigation not found" });
        }

        const existing = await investigationsRepo.findApprovalRequestById(reqId);
        if (!existing || existing.investigation_id !== investigationId) {
          return res.status(404).json({ error: "Approval request not found" });
        }

        if (existing.decision !== "pending") {
          return res.status(409).json({
            error: "Conflict",
            message: `Approval request has already been decided (${existing.decision})`,
          });
        }

        const decided = await investigationsRepo.decideApprovalRequest(
          reqId,
          parseResult.data.decision,
          callerSub,
          parseResult.data.reason,
        );

        return res.status(200).json(decided);
      } catch (err: unknown) {
        if (isDatabaseUnavailableError(err)) {
          return res.status(503).json({
            error: "Database unavailable",
            message:
              "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
          });
        }
        const msg = err instanceof Error ? err.message : "Failed to decide approval request";
        if (msg.includes("already")) {
          return res.status(409).json({ error: "Conflict", message: msg });
        }
        if (msg.includes("not a permitted sandbox action") || msg.includes("Production actions")) {
          return res.status(400).json({ error: "Forbidden Action", message: msg });
        }
        return res.status(500).json({ error: msg });
      }
    },
  );

  // ==========================================
  // Entire Provenance Endpoints
  // ==========================================

  // 16. Get Entire Provenance Status
  app.get("/api/provenance/status", async (_req: Request, res: Response) => {
    try {
      const status = await entireService.getStatus();
      return res.status(200).json(status);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to query Entire status";
      return res.status(500).json({ error: msg });
    }
  });

  // 17. Get Entire Provenance Report (Status, Checkpoints, Sessions)
  app.get("/api/provenance/report", async (_req: Request, res: Response) => {
    try {
      const report = await entireService.getProvenanceReport();
      return res.status(200).json(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to query Entire report";
      return res.status(500).json({ error: msg });
    }
  });

  // 18. List Checkpoints
  app.get("/api/provenance/checkpoints", async (_req: Request, res: Response) => {
    try {
      const checkpoints = await entireService.getCheckpoints();
      return res.status(200).json(checkpoints);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to list Entire checkpoints";
      return res.status(500).json({ error: msg });
    }
  });

  // 19. Explain Checkpoint by ID
  app.get(
    "/api/provenance/checkpoints/:id",
    async (req: Request<{ id: string }>, res: Response) => {
      const { id } = req.params;
      if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return res.status(400).json({ error: "Invalid checkpoint ID format" });
      }
      try {
        const explanation = entireService.explainCheckpoint(id);
        if (!explanation) {
          return res.status(404).json({ error: "Checkpoint explanation not found" });
        }
        return res.status(200).json(explanation);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to explain checkpoint";
        return res.status(500).json({ error: msg });
      }
    },
  );

  // 20. List Active & Historical Sessions
  app.get("/api/provenance/sessions", async (_req: Request, res: Response) => {
    try {
      const sessions = await entireService.getSessions();
      return res.status(200).json(sessions);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to list Entire sessions";
      return res.status(500).json({ error: msg });
    }
  });

  // 21. Query Code-Change Attribution (Why does a line/file exist?)
  app.get("/api/provenance/why", async (req: Request, res: Response) => {
    const file = req.query.file as string | undefined;
    const lineStr = req.query.line as string | undefined;

    if (!file || typeof file !== "string" || !/^[a-zA-Z0-9_./-]+$/.test(file)) {
      return res.status(400).json({ error: "Invalid or missing file parameter" });
    }

    let line: number | undefined;
    if (lineStr !== undefined) {
      const parsedLine = parseInt(lineStr, 10);
      if (isNaN(parsedLine) || parsedLine <= 0) {
        return res.status(400).json({ error: "Invalid line parameter" });
      }
      line = parsedLine;
    }

    try {
      const whyResult = entireService.explainWhy(file, line);
      if (!whyResult) {
        return res.status(404).json({ error: "No attribution found for target" });
      }
      return res.status(200).json(whyResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to query Entire attribution";
      return res.status(500).json({ error: msg });
    }
  });

  // ==========================================
  // DevRelay Gateway & Agent Sessions Endpoints
  // ==========================================

  // 22. Get DevRelay Gateway Status & Auth Profile
  app.get("/api/devrelay/status", async (_req: Request, res: Response) => {
    try {
      const status = await devrelayService.getStatus();
      return res.status(200).json(status);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to query DevRelay status";
      return res.status(500).json({ error: msg });
    }
  });

  // 23. Get DevRelay Consolidated Report (Status, Sessions, Diagnostics)
  app.get("/api/devrelay/report", async (_req: Request, res: Response) => {
    try {
      const report = await devrelayService.getReport();
      return res.status(200).json(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to query DevRelay report";
      return res.status(500).json({ error: msg });
    }
  });

  // 24. List Published Agent Sessions from DEV
  app.get("/api/devrelay/sessions", async (_req: Request, res: Response) => {
    try {
      const sessions = await devrelayService.getSessions();
      return res.status(200).json(sessions);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to list DevRelay sessions";
      return res.status(500).json({ error: msg });
    }
  });

  // 25. Fetch Specific Published Agent Session Details
  app.get("/api/devrelay/sessions/:id", async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return res.status(400).json({ error: "Invalid session ID format" });
    }
    try {
      const session = await devrelayService.getSessionById(id);
      if (!session) {
        return res.status(404).json({ error: "Agent session not found on DEV" });
      }
      return res.status(200).json(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch DevRelay session";
      return res.status(500).json({ error: msg });
    }
  });

  // 26. Get Doctor Diagnostics
  app.get("/api/devrelay/diagnostics", async (_req: Request, res: Response) => {
    try {
      const diagnostics = await devrelayService.getDoctorDiagnostics();
      if (!diagnostics) {
        return res.status(503).json({ error: "DevRelay diagnostics unavailable" });
      }
      return res.status(200).json(diagnostics);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch DevRelay diagnostics";
      return res.status(500).json({ error: msg });
    }
  });

  // Serve static client assets in production if built (or when SERVE_CLIENT=true)
  const shouldServeClient = config.NODE_ENV === "production" || process.env.SERVE_CLIENT === "true";
  if (shouldServeClient) {
    const clientDist = resolveClientDist(config.CLIENT_DIST);
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
    }

    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      // Preserve all /api and /healthz routes so they never swallow API errors or health checks
      if (req.path.startsWith("/api") || req.path.startsWith("/healthz")) {
        return next();
      }
      const indexPath = path.join(clientDist, "index.html");
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });
  }

  // 404 handler for unmatched routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Global safe error handler (Stage 6 A-2: never leak stack traces or internal paths)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const errorObj = err as {
      status?: number;
      statusCode?: number;
      message?: string;
      name?: string;
    };

    if (
      errorObj.status === 401 ||
      errorObj.statusCode === 401 ||
      errorObj.name === "UnauthorizedError" ||
      errorObj.name === "InvalidTokenError"
    ) {
      return res.status(401).json({
        error: "Unauthorized",
        message: errorObj.message || "Unauthorized",
      });
    }
    if (
      errorObj.status === 403 ||
      errorObj.statusCode === 403 ||
      errorObj.name === "InsufficientScopeError"
    ) {
      return res.status(403).json({
        error: "Forbidden",
        message: errorObj.message || "Forbidden",
      });
    }

    if (isDatabaseUnavailableError(err)) {
      return res.status(503).json({
        error: "Database unavailable",
        message:
          "MongoDB Atlas is required for persistent investigation operations. Database is currently unavailable or unconfigured.",
      });
    }

    const isProduction = config.NODE_ENV === "production";
    const safeMessage = isProduction
      ? "Internal server error"
      : errorObj.message || "Internal server error";
    res.status(500).json({ error: safeMessage });
  });

  return app;
}
