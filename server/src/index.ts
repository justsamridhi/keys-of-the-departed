import dotenv from "dotenv";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { MongoConnectionManager } from "./db/connection.js";
import { ensureIndexes } from "./db/collections.js";
import {
  AccountsRepository,
  FixtureAccountsRepository,
  UnavailableAccountsRepository,
} from "./repositories/accountsRepository.js";
import {
  CasesRepository,
  FixtureCasesRepository,
  UnavailableCasesRepository,
} from "./repositories/casesRepository.js";
import { InvestigationsRepository } from "./repositories/investigationsRepository.js";
import { MongoAccountsRepository } from "./repositories/mongoAccountsRepository.js";
import { MongoCasesRepository } from "./repositories/mongoCasesRepository.js";
import { MongoInvestigationsRepository } from "./repositories/mongoInvestigationsRepository.js";
import { UnavailableInvestigationsRepository } from "./repositories/unavailableInvestigationsRepository.js";
import { DependencyCheckers } from "./health.js";

import { OllamaGemmaService } from "./services/ollamaGemmaService.js";
import { TabPfnService } from "./services/tabpfnService.js";

dotenv.config();

async function startServer() {
  const config = loadConfig();
  const connectionManager = MongoConnectionManager.getInstance();

  const gemmaService = config.OLLAMA_BASE_URL
    ? new OllamaGemmaService({
        baseUrl: config.OLLAMA_BASE_URL,
        model: config.OLLAMA_MODEL,
      })
    : undefined;

  const tabpfnService = new TabPfnService();

  // In production, strictly disallow fixture fallback for real production data
  let accountsRepo: AccountsRepository;
  let casesRepo: CasesRepository;
  let investigationsRepo: InvestigationsRepository;

  if (config.NODE_ENV === "production") {
    accountsRepo = new UnavailableAccountsRepository();
    casesRepo = new UnavailableCasesRepository();
    investigationsRepo = new UnavailableInvestigationsRepository();
  } else {
    accountsRepo = new FixtureAccountsRepository();
    casesRepo = new FixtureCasesRepository();
    investigationsRepo = new UnavailableInvestigationsRepository();
  }

  const checkers: DependencyCheckers = {
    checkScores: async () => "ok",
  };

  // Only register model health checker if an Ollama instance URL is explicitly configured
  if (config.OLLAMA_BASE_URL && gemmaService) {
    checkers.checkModel = async () => {
      const avail = await gemmaService.checkAvailability();
      return avail.available ? "ok" : "unavailable";
    };
  }

  if (config.MONGODB_URI) {
    try {
      console.log("[keys-of-the-departed] Connecting to MongoDB Atlas...");
      const db = await connectionManager.connect(config);
      if (db) {
        await ensureIndexes(db);
        accountsRepo = new MongoAccountsRepository(db);
        casesRepo = new MongoCasesRepository(db);
        investigationsRepo = new MongoInvestigationsRepository(db, gemmaService, tabpfnService);

        checkers.checkDb = async () => {
          const isAlive = await connectionManager.ping();
          return isAlive ? "ok" : "unavailable";
        };

        console.log(
          `[keys-of-the-departed] Connected to MongoDB database: ${config.MONGODB_DB_NAME}`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      console.warn(
        `[keys-of-the-departed] MongoDB connection failed. Running in degraded mode: persistent mutations will return HTTP 503. (${msg})`,
      );
      checkers.checkDb = async () => "unavailable";
      if (config.NODE_ENV === "production") {
        accountsRepo = new UnavailableAccountsRepository();
        casesRepo = new UnavailableCasesRepository();
      }
      investigationsRepo = new UnavailableInvestigationsRepository();
    }
  } else {
    console.log(
      `[keys-of-the-departed] MONGODB_URI not configured. Running in ${config.NODE_ENV === "production" ? "unconfigured database" : "demo"} mode: persistent mutations will return HTTP 503.`,
    );
    checkers.checkDb = async () => "not_configured";
    investigationsRepo = new UnavailableInvestigationsRepository();
  }

  const app = createApp(config, checkers, accountsRepo, casesRepo, investigationsRepo);

  const server = app.listen(config.PORT, () => {
    console.log(
      `[keys-of-the-departed] Server listening on port ${config.PORT} (mode: ${config.NODE_ENV})`,
    );
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${config.PORT} is already in use. Please select a different port via PORT environment variable.`,
      );
      process.exit(1);
    } else {
      console.error("Server startup error:", err.message);
      process.exit(1);
    }
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[keys-of-the-departed] Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log("[keys-of-the-departed] HTTP server closed.");
      await connectionManager.disconnect();
      console.log("[keys-of-the-departed] Database connections closed. Process terminating.");
      process.exit(0);
    });

    // Force exit after 5s if connections hang
    setTimeout(() => {
      console.error("[keys-of-the-departed] Forcefully terminating after timeout.");
      process.exit(1);
    }, 5000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch((err: unknown) => {
  if (err instanceof Error) {
    console.error("Fatal startup error:", err.message);
  } else {
    console.error("Unknown fatal error starting server");
  }
  process.exit(1);
});
