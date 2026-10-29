import { HealthStatus, HealthComponentStatus } from "@keys/contracts";
import { ServerConfig } from "./config.js";

export interface DependencyCheckers {
  checkDb?: () => Promise<HealthComponentStatus>;
  checkModel?: () => Promise<HealthComponentStatus>;
  checkScores?: () => Promise<HealthComponentStatus>;
}

export async function computeHealthStatus(
  config: ServerConfig,
  startTime: number,
  checkers: DependencyCheckers = {},
): Promise<{ status: HealthStatus; httpStatus: number }> {
  // If external dependencies are not configured, they are "not_configured"
  let dbStatus: HealthComponentStatus = config.MONGODB_URI ? "ok" : "not_configured";
  if (config.MONGODB_URI && checkers.checkDb) {
    try {
      dbStatus = await checkers.checkDb();
    } catch {
      dbStatus = "unavailable";
    }
  }

  let modelStatus: HealthComponentStatus = "not_configured";
  if (config.OLLAMA_BASE_URL && checkers.checkModel) {
    try {
      modelStatus = await checkers.checkModel();
    } catch {
      modelStatus = "unavailable";
    }
  }

  let scoresStatus: HealthComponentStatus = "not_configured";
  if (checkers.checkScores) {
    try {
      scoresStatus = await checkers.checkScores();
    } catch {
      scoresStatus = "unavailable";
    }
  }

  // Any configured dependency that is unavailable causes overall degradation/503
  const hasUnavailableConfigured =
    dbStatus === "unavailable" || modelStatus === "unavailable" || scoresStatus === "unavailable";

  const isDemoMode = !config.MONGODB_URI;

  const overallStatus = hasUnavailableConfigured ? "unavailable" : "ok";
  const httpStatus = hasUnavailableConfigured ? 503 : 200;

  const healthPayload: HealthStatus = {
    status: overallStatus,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    mode: isDemoMode ? "demo" : "configured",
    checks: {
      db: dbStatus,
      model: modelStatus,
      scores: scoresStatus,
    },
  };

  return { status: healthPayload, httpStatus };
}
