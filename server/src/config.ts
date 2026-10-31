import { z } from "zod";

const ServerConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  MONGODB_URI: z.string().optional(),
  MONGODB_DB_NAME: z.string().default("keys_of_the_departed"),
  CORS_ORIGIN: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().default("gemma3:4b"),
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_CLIENT_ID: z.string().optional(),
  AUTH0_CLIENT_SECRET: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),
  GITHUB_SANDBOX_OWNER: z.string().optional(),
  GITHUB_SANDBOX_REPO: z.string().optional(),
  CLIENT_DIST: z.string().optional(),
  // TABPFN_TOKEN is explicitly forbidden in server runtime
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  // If TABPFN_TOKEN is passed, warn that it is ignored by server runtime
  if (env["TABPFN_TOKEN"]) {
    // Intentionally ignored; not added to config
  }

  // Pre-clean empty strings so unset environment variables in hosted platforms behave as undefined
  const cleanedEnv: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string" && v.trim() === "") {
      continue;
    }
    cleanedEnv[k] = v;
  }

  const result = ServerConfigSchema.safeParse(cleanedEnv);
  if (!result.success) {
    const missingKeys = result.error.errors.map((e) => e.path.join(".")).join(", ");
    throw new Error(`Server configuration error: invalid or missing variables: ${missingKeys}`);
  }

  const cfg = result.data;

  // Validate MONGODB_URI scheme without leaking URI content or credentials
  if (cfg.MONGODB_URI) {
    if (
      !cfg.MONGODB_URI.startsWith("mongodb://") &&
      !cfg.MONGODB_URI.startsWith("mongodb+srv://")
    ) {
      throw new Error(
        "Server configuration error: invalid format for MONGODB_URI (must begin with mongodb:// or mongodb+srv://)",
      );
    }
  }

  // Feature validation: if any Auth0 resource server var is set, required auth vars must be set
  const hasSomeAuth0 = Boolean(cfg.AUTH0_DOMAIN || cfg.AUTH0_AUDIENCE);
  if (hasSomeAuth0) {
    const missingAuth: string[] = [];
    if (!cfg.AUTH0_DOMAIN) missingAuth.push("AUTH0_DOMAIN");
    if (!cfg.AUTH0_AUDIENCE) missingAuth.push("AUTH0_AUDIENCE");
    if (missingAuth.length > 0) {
      throw new Error(
        `Auth0 configuration error: missing required variables: ${missingAuth.join(", ")}`,
      );
    }
  }

  return cfg;
}
