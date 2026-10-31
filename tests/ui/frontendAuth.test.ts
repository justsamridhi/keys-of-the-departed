import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { createApiClient, ApiError } from "../../client/src/auth/apiClient.js";
import { AuthContext } from "../../client/src/auth/AuthProvider.js";
import {
  AuthModal,
  buildAuth0ModalRedirectParams,
  executeAuthModalSubmit,
  executeGuestDemoEntry,
  executeRegisterTabClick,
} from "../../client/src/components/AuthModal.js";

describe("Frontend Auth0 Integration & API Client Security", () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("API Client Token Acquisition & Authorization Headers", () => {
    it("FE-AUTH-01: Fails closed when unauthenticated user attempts to create investigation", async () => {
      const mockGetToken = vi.fn();
      const client = createApiClient(mockGetToken, false, "https://keys-of-the-departed-api");

      await expect(client.createInvestigation({ name: "Unauthorized Audit" })).rejects.toThrow(
        ApiError,
      );

      await expect(
        client.createInvestigation({ name: "Unauthorized Audit" }),
      ).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHENTICATED",
      });

      expect(mockGetToken).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("FE-AUTH-02: Fails closed if getAccessTokenSilently throws (e.g. login_required or expired)", async () => {
      const mockGetToken = vi.fn().mockRejectedValue(new Error("login_required"));
      const client = createApiClient(mockGetToken, true, "https://keys-of-the-departed-api");

      await expect(
        client.createInvestigation({ name: "Token Expired Audit" }),
      ).rejects.toMatchObject({
        status: 401,
        code: "TOKEN_ACQUISITION_ERROR",
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("FE-AUTH-03: Obtains token with exact required scopes and audience, then attaches Bearer header", async () => {
      const mockGetToken = vi.fn().mockResolvedValue("mock_jwt_access_token_123");
      const audience = "https://keys-of-the-departed-api";
      const client = createApiClient(mockGetToken, true, audience);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          investigation_id: "inv_frontend_01",
          name: "Secured Audit",
          status: "created",
        }),
      });

      const result = await client.createInvestigation({
        name: "Secured Audit",
        description: "Checking deploy credentials",
      });

      expect(result.investigation_id).toBe("inv_frontend_01");

      // Verify exact scope and audience requested
      expect(mockGetToken).toHaveBeenCalledWith({
        authorizationParams: {
          audience: "https://keys-of-the-departed-api",
          scope: "openid profile email read:investigations create:investigations",
        },
      });

      // Verify fetch called with Authorization: Bearer
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/investigations",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock_jwt_access_token_123",
          }),
        }),
      );
    });

    it("FE-AUTH-04: Upload files attaches Bearer token to POST /api/investigations/:id/upload", async () => {
      const mockGetToken = vi.fn().mockResolvedValue("mock_jwt_token_upload");
      const client = createApiClient(mockGetToken, true, "https://keys-of-the-departed-api");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          investigation: { investigation_id: "inv_123", status: "created" },
          files: [],
          extracted_records_count: 1,
          errors: [],
        }),
      });

      await client.uploadFiles("inv_123", [
        { filename: "audit.log", content: "Author: user@corp" },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/investigations/inv_123/upload",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock_jwt_token_upload",
          }),
        }),
      );
    });

    it("FE-AUTH-05: Process investigation attaches Bearer token to POST /api/investigations/:id/process", async () => {
      const mockGetToken = vi.fn().mockResolvedValue("mock_jwt_token_process");
      const client = createApiClient(mockGetToken, true, "https://keys-of-the-departed-api");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          investigation: { investigation_id: "inv_123", status: "completed" },
          files: [],
          discovered_accounts: [],
          processing_summary: {},
        }),
      });

      await client.processInvestigation("inv_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/investigations/inv_123/process",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock_jwt_token_process",
          }),
        }),
      );
    });

    it("FE-AUTH-06: Anonymous user can query public demo investigations without token", async () => {
      const mockGetToken = vi.fn();
      const client = createApiClient(mockGetToken, false, "https://keys-of-the-departed-api");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          investigation_id: "inv_staging_2026_q1",
          name: "Staging Demo",
          is_demo: true,
        }),
      });

      const inv = await client.getInvestigation("inv_staging_2026_q1");
      expect(inv.investigation_id).toBe("inv_staging_2026_q1");
      expect(mockGetToken).not.toHaveBeenCalled();

      // No Authorization header sent
      const [, requestInit] = mockFetch.mock.calls[0];
      expect(requestInit?.headers?.Authorization).toBeUndefined();
    });

    it("FE-AUTH-07: Authenticated user attaches Bearer token on investigation retrieval", async () => {
      const mockGetToken = vi.fn().mockResolvedValue("mock_jwt_token_read");
      const client = createApiClient(mockGetToken, true, "https://keys-of-the-departed-api");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          investigation_id: "inv_private_01",
          name: "Private User Investigation",
          is_demo: false,
        }),
      });

      const inv = await client.getInvestigation("inv_private_01");
      expect(inv.investigation_id).toBe("inv_private_01");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/investigations/inv_private_01",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock_jwt_token_read",
          }),
        }),
      );
    });

    it("FE-AUTH-08: HTTP 401 and 403 backend responses are propagated as clear ApiError exceptions", async () => {
      const mockGetToken = vi.fn().mockResolvedValue("mock_jwt_token_forbidden");
      const client = createApiClient(mockGetToken, true, "https://keys-of-the-departed-api");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Forbidden: Insufficient scope" }),
      });

      await expect(
        client.createInvestigation({ name: "Forbidden Investigation" }),
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining("Forbidden"),
      });
    });
  });

  describe("Security Invariants & Nonce / Scope Guardrails", () => {
    it("FE-AUTH-09: Scopes strictly avoid approve:revocations", async () => {
      const mockGetToken = vi.fn().mockResolvedValue("token");
      const client = createApiClient(mockGetToken, true, "https://keys-of-the-departed-api");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ investigation_id: "inv_1" }),
      });

      await client.createInvestigation({ name: "Audit" });

      const [tokenOptions] = mockGetToken.mock.calls[0];
      const requestedScope = tokenOptions?.authorizationParams?.scope || "";

      expect(requestedScope).not.toContain("approve:revocations");
      expect(requestedScope).toContain("read:investigations");
      expect(requestedScope).toContain("create:investigations");
    });
  });

  describe("AuthModal & Universal Login Redirection Mechanics", () => {
    it("FE-AUTH-10: Sign In invokes loginWithRedirect without requiring local credentials", async () => {
      const mockLoginWithRedirect = vi.fn().mockResolvedValue(undefined);
      const mockOnSuccess = vi.fn();
      const mockOnClose = vi.fn();

      // User submits form without entering any email or password
      await executeAuthModalSubmit({
        isConfigured: true,
        loginWithRedirect: mockLoginWithRedirect,
        mode: "signin",
        email: "",
        onSuccess: mockOnSuccess,
        onClose: mockOnClose,
        returnTo: "#/archive",
      });

      expect(mockLoginWithRedirect).toHaveBeenCalledTimes(1);
      expect(mockLoginWithRedirect).toHaveBeenCalledWith({
        authorizationParams: {
          screen_hint: undefined,
          login_hint: undefined,
        },
        appState: {
          returnTo: "#/archive",
        },
      });
      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("FE-AUTH-11: Register invokes loginWithRedirect with screen_hint='signup'", async () => {
      const mockLoginWithRedirect = vi.fn().mockResolvedValue(undefined);
      const mockOnSuccess = vi.fn();
      const mockOnClose = vi.fn();

      // Triggering register tab click
      await executeRegisterTabClick({
        isConfigured: true,
        loginWithRedirect: mockLoginWithRedirect,
        email: "",
        returnTo: "#/landing",
      });

      expect(mockLoginWithRedirect).toHaveBeenCalledWith({
        authorizationParams: {
          screen_hint: "signup",
          login_hint: undefined,
        },
        appState: {
          returnTo: "#/landing",
        },
      });

      // Submitting modal in signup mode
      await executeAuthModalSubmit({
        isConfigured: true,
        loginWithRedirect: mockLoginWithRedirect,
        mode: "signup",
        email: "",
        onSuccess: mockOnSuccess,
        onClose: mockOnClose,
        returnTo: "#/landing",
      });

      expect(mockLoginWithRedirect).toHaveBeenLastCalledWith({
        authorizationParams: {
          screen_hint: "signup",
          login_hint: undefined,
        },
        appState: {
          returnTo: "#/landing",
        },
      });
    });

    it("FE-AUTH-12: Guest Demo remains functional without invoking Auth0", () => {
      const mockOnSuccess = vi.fn();
      const mockOnClose = vi.fn();

      executeGuestDemoEntry(mockOnSuccess, mockOnClose);

      expect(mockOnSuccess).toHaveBeenCalledWith({
        email: "guest.auditor@sanctuary.internal",
        name: "Guest Auditor",
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("FE-AUTH-13: No local password or email validation blocks Auth0 redirection", async () => {
      // Test 1: Empty email does NOT block; login_hint is undefined
      const paramsEmpty = buildAuth0ModalRedirectParams("signin", "   ", "#/");
      expect(paramsEmpty.authorizationParams.login_hint).toBeUndefined();
      expect(paramsEmpty.authorizationParams.screen_hint).toBeUndefined();

      // Test 2: Pre-filled email is passed as login_hint without requiring password validation
      const paramsWithEmail = buildAuth0ModalRedirectParams(
        "signin",
        "auditor@sanctuary.corp",
        "#/cases",
      );
      expect(paramsWithEmail.authorizationParams.login_hint).toBe("auditor@sanctuary.corp");
      expect(paramsWithEmail.appState.returnTo).toBe("#/cases");

      // Test 3: Markup verification - no password inputs exist in the Gothic modal
      const dummyAuthContext = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        loginWithRedirect: vi.fn(),
        logout: vi.fn(),
        getAccessTokenSilently: vi.fn(),
        isConfigured: true,
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(
          AuthContext.Provider,
          { value: dummyAuthContext },
          React.createElement(AuthModal, {
            isOpen: true,
            onClose: vi.fn(),
            onSuccess: vi.fn(),
          }),
        ),
      );

      // Verify DOM IDs and elements
      expect(html).toContain('id="btn-auth-submit"');
      expect(html).toContain('id="tab-auth-signin"');
      expect(html).toContain('id="tab-auth-signup"');
      expect(html).toContain('id="btn-auth-guest-demo"');
      expect(html).toContain('id="auth-email"');

      // Crucial: There should NOT be any password input field blocking user submission
      expect(html).not.toContain('type="password"');
      expect(html).not.toContain("Password is required");
      expect(html).not.toContain("Email address is required");
    });
  });
});
