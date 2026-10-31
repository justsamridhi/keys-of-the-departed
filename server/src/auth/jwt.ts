import { Request, Response, NextFunction } from "express";
import { auth, AuthOptions } from "express-oauth2-jwt-bearer";
import { ServerConfig } from "../config.js";

/**
 * Creates authentication middleware for verifying Auth0 access tokens.
 *
 * If Auth0 is not configured (AUTH0_DOMAIN or AUTH0_AUDIENCE missing),
 * the middleware fails closed and returns HTTP 500 with a clear server configuration error.
 */
export function createAuthMiddleware(
  config: ServerConfig,
  authOptionsOverride?: Partial<AuthOptions>,
) {
  if (!config.AUTH0_DOMAIN || !config.AUTH0_AUDIENCE) {
    return (_req: Request, res: Response, _next: NextFunction) => {
      return res.status(500).json({
        error: "Authentication configuration error",
        message:
          "Auth0 authentication is unconfigured on this server. Protected mutation routes require AUTH0_DOMAIN and AUTH0_AUDIENCE.",
      });
    };
  }

  const domain = config.AUTH0_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const issuerBaseURL = config.AUTH0_DOMAIN.startsWith("http://")
    ? config.AUTH0_DOMAIN.replace(/\/$/, "") + "/"
    : `https://${domain}/`;
  const audience = config.AUTH0_AUDIENCE;

  const jwtCheck = auth({
    issuerBaseURL,
    audience,
    tokenSigningAlg: "RS256",
    ...authOptionsOverride,
  });

  return (req: Request, res: Response, next: NextFunction) => {
    jwtCheck(req, res, (err?: unknown) => {
      if (!err) {
        return next();
      }

      const authErr = err as {
        status?: number;
        statusCode?: number;
        message?: string;
        name?: string;
        headers?: Record<string, string>;
      };

      const status = authErr.status || authErr.statusCode || 401;
      if (authErr.headers && authErr.headers["WWW-Authenticate"]) {
        res.setHeader("WWW-Authenticate", authErr.headers["WWW-Authenticate"]);
      }

      if (status === 403 || authErr.name === "InsufficientScopeError") {
        return res.status(403).json({
          error: "Forbidden",
          message: authErr.message || "Insufficient permissions",
        });
      }

      return res.status(status === 401 ? 401 : status).json({
        error: "Unauthorized",
        message: authErr.message || "Invalid or missing token",
      });
    });
  };
}

/**
 * Enforces that an authenticated request has the specified permission or scope.
 * Validates cryptographically verified claims from req.auth.payload.
 *
 * Checks both Auth0 RBAC `permissions` array and OAuth2 space-delimited `scope` string.
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !req.auth.payload) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication is required to access this resource",
      });
    }

    const payload = req.auth.payload;

    // 1. Check permissions claim (standard Auth0 RBAC array)
    const permissions = Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
    if (permissions.includes(permission)) {
      return next();
    }

    // 2. Check scope claim (OAuth2 space-delimited string)
    const scopeStr = typeof payload.scope === "string" ? payload.scope : "";
    const scopes = scopeStr.split(" ").filter(Boolean);
    if (scopes.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      error: "Forbidden",
      message: `Forbidden: missing required permission '${permission}'`,
    });
  };
}
