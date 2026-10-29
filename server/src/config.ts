import { z } from "zod";

const ServerConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  MONGODB_URI: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("gemma3:4b"),
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_CLIENT_ID: z.string().optional(),
  AUTH0_CLIENT_SECRET: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),
  GITHUB_SANDBOX_OWNER: z.string().optional(),
  GITHUB_SANDBOX_REPO: z.string().optional(),
  // TABPFN_TOKEN is explicitly forbidden in server runtime
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  // If TABPFN_TOKEN is passed, warn that it is ignored by server runtime
  if (env["TABPFN_TOKEN"]) {
    // Intentionally ignored; not added to config
  }

  const result = ServerConfigSchema.safeParse(env);
  if (!result.success) {
    const missingKeys = result.error.errors.map((e) => e.path.join(".")).join(", ");
    throw new Error(`Server configuration error: invalid or missing variables: ${missingKeys}`);
  }

  // Feature validation: if any Auth0 var is set, all required auth vars must be set
  const cfg = result.data;
  const hasSomeAuth0 = cfg.AUTH0_DOMAIN || cfg.AUTH0_CLIENT_ID || cfg.AUTH0_CLIENT_SECRET;
  if (hasSomeAuth0) {
    const missingAuth: string[] = [];
    if (!cfg.AUTH0_DOMAIN) missingAuth.push("AUTH0_DOMAIN");
    if (!cfg.AUTH0_CLIENT_ID) missingAuth.push("AUTH0_CLIENT_ID");
    if (!cfg.AUTH0_CLIENT_SECRET) missingAuth.push("AUTH0_CLIENT_SECRET");
    if (missingAuth.length > 0) {
      throw new Error(
        `Auth0 configuration error: missing required variables: ${missingAuth.join(", ")}`,
      );
    }
  }

  return cfg;
}
