import { describe, it, expect } from "vitest";
import { loadConfig } from "../../server/src/config.js";

describe("Area 2: Configuration and Fail-Fast Environment", () => {
  it("ENV-01: Core demo mode starts clean with zero credentials", () => {
    const config = loadConfig({});
    expect(config.NODE_ENV).toBe("development");
    expect(config.PORT).toBe(3001);
    expect(config.MONGODB_URI).toBeUndefined();
    expect(config.AUTH0_DOMAIN).toBeUndefined();
  });

  it("ENV-02: TABPFN_TOKEN is never required by server runtime", () => {
    const config = loadConfig({ TABPFN_TOKEN: "secret_tabpfn_token" });
    // Config object strictly excludes TABPFN_TOKEN
    expect((config as any).TABPFN_TOKEN).toBeUndefined();
  });

  it("ENV-03: Fails fast when Auth0 is partially configured", () => {
    expect(() => {
      loadConfig({
        AUTH0_DOMAIN: "dev.auth0.com",
        // Missing CLIENT_ID and CLIENT_SECRET
      });
    }).toThrowError(
      /Auth0 configuration error: missing required variables: AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET/,
    );
  });

  it("ENV-04: Port fallback and valid number parsing", () => {
    const config = loadConfig({ PORT: "8080" });
    expect(config.PORT).toBe(8080);

    expect(() => {
      loadConfig({ PORT: "not-a-number" });
    }).toThrow();
  });

  it("ENV-05: Config errors list variable names only, never secret values", () => {
    try {
      loadConfig({
        AUTH0_DOMAIN: "dummy.domain",
        AUTH0_CLIENT_ID: "my-secret-id-value",
      });
    } catch (err: any) {
      expect(err.message).toContain("AUTH0_CLIENT_SECRET");
      expect(err.message).not.toContain("my-secret-id-value");
    }
  });
});
