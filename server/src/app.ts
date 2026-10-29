import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { ServerConfig } from "./config.js";
import { computeHealthStatus, DependencyCheckers } from "./health.js";
import { MOCK_DEMO_CASE, MOCK_DEMO_RECORDS } from "./fixtures.js";

export function createApp(config: ServerConfig, checkers: DependencyCheckers = {}): Express {
  const app = express();
  const startTime = Date.now();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "2mb" }));

  // Request logger in non-test
  if (config.NODE_ENV !== "test") {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });
  }

  // 1. Healthcheck endpoint (SPEC 5.7 & Stage 6 A-4)
  const handleHealth = async (_req: Request, res: Response) => {
    const { status, httpStatus } = await computeHealthStatus(config, startTime, checkers);
    res.status(httpStatus).json(status);
  };

  app.get("/healthz", handleHealth);
  app.get("/api/health", handleHealth);

  // 2. Walking skeleton: Case lookup endpoint (SPEC 5.7)
  app.get("/api/cases/:id", (req: Request, res: Response) => {
    const caseId = req.params.id;
    if (typeof caseId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(caseId)) {
      return res.status(400).json({ error: "Invalid case ID format" });
    }

    if (caseId === MOCK_DEMO_CASE.case_id) {
      return res.status(200).json(MOCK_DEMO_CASE);
    }

    return res.status(404).json({ error: "Case not found" });
  });

  // 3. Walking skeleton: Evidence Record lookup endpoint (SPEC 5.7)
  app.get("/api/records/:id", (req: Request, res: Response) => {
    const recordId = req.params.id;
    if (typeof recordId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(recordId)) {
      return res.status(400).json({ error: "Invalid record ID format" });
    }

    const record = MOCK_DEMO_RECORDS.find((r) => r.record_id === recordId);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }

    return res.status(200).json(record);
  });

  // Serve static client assets in production if built
  if (config.NODE_ENV === "production") {
    const clientDist = path.resolve(process.cwd(), "client/dist");
    app.use(express.static(clientDist));
    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api") || req.path === "/healthz") {
        return next();
      }
      res.sendFile(path.join(clientDist, "index.html"), (err) => {
        if (err) next();
      });
    });
  }

  // 404 handler for unmatched routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Global safe error handler (Stage 6 A-2: never leak stack traces or internal paths)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const isProduction = config.NODE_ENV === "production";
    const safeMessage = isProduction ? "Internal server error" : err.message;
    res.status(500).json({ error: safeMessage });
  });

  return app;
}
