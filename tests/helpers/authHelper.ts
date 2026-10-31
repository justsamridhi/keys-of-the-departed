import http from "http";
import { generateKeyPair, exportJWK, SignJWT, KeyLike } from "jose";

export interface MockAuth0Server {
  server: http.Server;
  port: number;
  issuer: string;
  audience: string;
  jwksUri: string;
  keyId: string;
  privateKey: KeyLike;
  publicKey: KeyLike;
  close: () => Promise<void>;
  generateToken: (claims?: {
    issuer?: string;
    audience?: string;
    expiresIn?: string | number;
    iat?: number;
    permissions?: string[];
    scope?: string;
    sub?: string;
    customPrivateKey?: KeyLike;
    headerKid?: string;
  }) => Promise<string>;
  generateUntrustedToken: (claims?: {
    issuer?: string;
    audience?: string;
    permissions?: string[];
  }) => Promise<string>;
}

export async function setupMockAuth0Server(): Promise<MockAuth0Server> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const keyId = "test-auth0-key-1";
  jwk.kid = keyId;
  jwk.alg = "RS256";
  jwk.use = "sig";

  const server = http.createServer((req, res) => {
    if (req.url === "/.well-known/jwks.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (req.url === "/.well-known/openid-configuration") {
      const host = req.headers.host || "127.0.0.1";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          issuer: `http://${host}/`,
          jwks_uri: `http://${host}/.well-known/jwks.json`,
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as { port: number };
  const port = address.port;
  const issuer = `http://127.0.0.1:${port}/`;
  const audience = "https://keys-of-the-departed-api";
  const jwksUri = `http://127.0.0.1:${port}/.well-known/jwks.json`;

  const generateToken = async (claims?: {
    issuer?: string;
    audience?: string;
    expiresIn?: string | number;
    permissions?: string[];
    scope?: string;
    sub?: string;
    customPrivateKey?: KeyLike;
    headerKid?: string;
  }): Promise<string> => {
    const iss = claims?.issuer !== undefined ? claims.issuer : issuer;
    const aud = claims?.audience !== undefined ? claims.audience : audience;
    const exp = claims?.expiresIn !== undefined ? claims.expiresIn : "1h";
    const key = claims?.customPrivateKey || privateKey;
    const kid = claims?.headerKid !== undefined ? claims.headerKid : keyId;

    const payload: Record<string, unknown> = {
      sub: claims?.sub || "auth0|test-auditor-123",
    };

    if (claims?.permissions) {
      payload.permissions = claims.permissions;
    }
    if (claims?.scope) {
      payload.scope = claims.scope;
    }

    const now = Math.floor(Date.now() / 1000);
    const iat = claims?.iat !== undefined ? claims.iat : now;

    let jwt = new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuedAt(iat)
      .setIssuer(iss)
      .setAudience(aud);

    if (typeof exp === "string") {
      jwt = jwt.setExpirationTime(exp);
    } else if (typeof exp === "number") {
      jwt = jwt.setExpirationTime(exp);
    }

    return await jwt.sign(key);
  };

  const generateUntrustedToken = async (claims?: {
    issuer?: string;
    audience?: string;
    permissions?: string[];
  }): Promise<string> => {
    // Generate a completely separate rogue keypair that is NOT in the mock JWKS
    const rogue = await generateKeyPair("RS256");
    return generateToken({
      ...claims,
      customPrivateKey: rogue.privateKey,
      headerKid: "untrusted-rogue-key",
    });
  };

  const close = async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return {
    server,
    port,
    issuer,
    audience,
    jwksUri,
    keyId,
    privateKey,
    publicKey,
    close,
    generateToken,
    generateUntrustedToken,
  };
}
