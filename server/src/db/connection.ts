import { MongoClient, Db } from "mongodb";
import { ServerConfig } from "../config.js";

/**
 * Singleton MongoDB Connection Manager.
 * Handles lifecycle, safe pings, credential protection, and graceful shutdown.
 */
export class MongoConnectionManager {
  private static instance: MongoConnectionManager | null = null;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private connectPromise: Promise<Db | null> | null = null;

  private constructor() {}

  public static getInstance(): MongoConnectionManager {
    if (!MongoConnectionManager.instance) {
      MongoConnectionManager.instance = new MongoConnectionManager();
    }
    return MongoConnectionManager.instance;
  }

  /**
   * Connect to MongoDB if MONGODB_URI is configured.
   * Reuses existing connection if already established.
   */
  public async connect(config: ServerConfig): Promise<Db | null> {
    if (!config.MONGODB_URI) {
      return null;
    }

    if (this.db && this.client) {
      return this.db;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      try {
        const client = new MongoClient(config.MONGODB_URI!, {
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 3000,
          appName: "keys-of-the-departed",
        });

        await client.connect();
        const dbName = config.MONGODB_DB_NAME || "keys_of_the_departed";
        const db = client.db(dbName);

        // Verify connection with real ping
        await db.command({ ping: 1 });

        this.client = client;
        this.db = db;
        return this.db;
      } catch (err: unknown) {
        const rawMessage = err instanceof Error ? err.message : "Failed to connect to MongoDB";
        // Sanitize credentials from connection string if present in error message
        const sanitized = rawMessage.replace(
          /mongodb(\+srv)?:\/\/[^@]+@/gi,
          "mongodb://<redacted>@",
        );
        console.error(`[MongoConnectionManager] Connection failure: ${sanitized}`);
        await this.disconnect();
        throw new Error(`MongoDB connection failed: ${sanitized}`);
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  /**
   * Real database ping verification command.
   */
  public async ping(): Promise<boolean> {
    if (!this.client || !this.db) {
      return false;
    }
    try {
      await this.db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  public getDb(): Db | null {
    return this.db;
  }

  public getClient(): MongoClient | null {
    return this.client;
  }

  public isConnected(): boolean {
    return Boolean(this.client && this.db);
  }

  /**
   * Graceful disconnect and resource release.
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Silent catch during shutdown
      }
    }
    this.client = null;
    this.db = null;
    this.connectPromise = null;
  }
}
