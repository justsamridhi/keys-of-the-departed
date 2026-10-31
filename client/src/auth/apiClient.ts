import {
  CreateInvestigationInput,
  SingleFileInput,
  Investigation,
  InvestigationFindings,
  DashboardStats,
  AccountsResponse,
  UploadedFile,
  ApprovalRequest,
  CreateApprovalInput,
  DecideApprovalInput,
} from "@keys/contracts";
import { useAuth } from "./AuthProvider.js";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClient {
  createInvestigation: (input: CreateInvestigationInput) => Promise<Investigation>;
  uploadFiles: (
    investigationId: string,
    files: SingleFileInput[],
  ) => Promise<{
    investigation: Investigation;
    files: UploadedFile[];
    extracted_records_count: number;
    errors: string[];
  }>;
  processInvestigation: (investigationId: string) => Promise<InvestigationFindings>;
  getInvestigation: (investigationId: string) => Promise<Investigation>;
  getInvestigationFindings: (investigationId: string) => Promise<InvestigationFindings>;
  listInvestigations: (demo?: boolean) => Promise<Investigation[]>;
  getDashboardStats: (demo?: boolean) => Promise<DashboardStats>;
  getAccounts: (
    query: {
      chapter?: string;
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    demo?: boolean,
  ) => Promise<AccountsResponse>;
  createApprovalRequest: (
    investigationId: string,
    input: CreateApprovalInput,
  ) => Promise<ApprovalRequest>;
  listApprovalRequests: (investigationId: string) => Promise<ApprovalRequest[]>;
  decideApprovalRequest: (
    investigationId: string,
    requestId: string,
    input: DecideApprovalInput,
  ) => Promise<ApprovalRequest>;
}

export function createApiClient(
  getAccessTokenSilently: (options?: unknown) => Promise<string>,
  isAuthenticated: boolean,
  audience?: string,
): ApiClient {
  const getAuthToken = async (): Promise<string> => {
    if (!isAuthenticated) {
      throw new ApiError(
        "Authentication required: Please sign in to perform this action.",
        401,
        "UNAUTHENTICATED",
      );
    }
    try {
      return await getAccessTokenSilently({
        authorizationParams: {
          audience: audience || undefined,
          scope: "openid profile email read:investigations create:investigations",
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to acquire access token";
      throw new ApiError(`Token acquisition failed: ${msg}`, 401, "TOKEN_ACQUISITION_ERROR");
    }
  };

  const getOptionalAuthToken = async (): Promise<string | null> => {
    if (!isAuthenticated) return null;
    try {
      return await getAccessTokenSilently({
        authorizationParams: {
          audience: audience || undefined,
          scope: "openid profile email read:investigations create:investigations",
        },
      });
    } catch {
      return null;
    }
  };

  return {
    createInvestigation: async (input: CreateInvestigationInput): Promise<Investigation> => {
      const token = await getAuthToken();
      const res = await fetch("/api/investigations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        const msg = body.error || body.message || `Creation failed with status ${res.status}`;
        throw new ApiError(msg, res.status);
      }

      return (await res.json()) as Investigation;
    },

    uploadFiles: async (investigationId: string, files: SingleFileInput[]) => {
      const token = await getAuthToken();
      const res = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ files }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        const msg = body.error || body.message || `Upload failed with status ${res.status}`;
        throw new ApiError(msg, res.status);
      }

      return await res.json();
    },

    processInvestigation: async (investigationId: string): Promise<InvestigationFindings> => {
      const token = await getAuthToken();
      const res = await fetch(
        `/api/investigations/${encodeURIComponent(investigationId)}/process`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        const msg = body.error || body.message || `Processing failed with status ${res.status}`;
        throw new ApiError(msg, res.status);
      }

      return (await res.json()) as InvestigationFindings;
    },

    getInvestigation: async (investigationId: string): Promise<Investigation> => {
      const token = await getOptionalAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}`, {
        headers,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        const msg =
          body.error || body.message || `Failed to retrieve investigation (${res.status})`;
        throw new ApiError(msg, res.status);
      }

      return (await res.json()) as Investigation;
    },

    getInvestigationFindings: async (investigationId: string): Promise<InvestigationFindings> => {
      const token = await getOptionalAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(
        `/api/investigations/${encodeURIComponent(investigationId)}/findings`,
        {
          headers,
        },
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        const msg =
          body.error || body.message || `Failed to retrieve investigation findings (${res.status})`;
        throw new ApiError(msg, res.status);
      }

      return (await res.json()) as InvestigationFindings;
    },

    listInvestigations: async (demo?: boolean): Promise<Investigation[]> => {
      const token = await getOptionalAuthToken();
      const headers: Record<string, string> = {};
      if (token && !demo) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const query = demo ? "?demo=true" : "?demo=false";
      const res = await fetch(`/api/investigations${query}`, { headers });
      if (!res.ok) {
        throw new ApiError(`Failed to list investigations (${res.status})`, res.status);
      }
      return (await res.json()) as Investigation[];
    },

    getDashboardStats: async (demo?: boolean): Promise<DashboardStats> => {
      const token = await getOptionalAuthToken();
      const headers: Record<string, string> = {};
      if (token && !demo) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const query = demo ? "?demo=true" : "?demo=false";
      const res = await fetch(`/api/stats/dashboard${query}`, { headers });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new ApiError(
          body.error || `Failed to load dashboard stats (${res.status})`,
          res.status,
        );
      }
      return (await res.json()) as DashboardStats;
    },

    getAccounts: async (
      query: {
        chapter?: string;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
      },
      demo?: boolean,
    ): Promise<AccountsResponse> => {
      let token: string | null = null;
      if (!demo && isAuthenticated) {
        token = await getOptionalAuthToken();
      }
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const params = new URLSearchParams({
        chapter: query.chapter || "ALL",
        status: query.status || "ALL",
        search: query.search || "",
        page: String(query.page || 1),
        limit: String(query.limit || 12),
        demo: demo ? "true" : "false",
      });

      const res = await fetch(`/api/accounts?${params.toString()}`, { headers });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new ApiError(body.error || `Failed to retrieve accounts (${res.status})`, res.status);
      }
      return (await res.json()) as AccountsResponse;
    },

    createApprovalRequest: async (
      investigationId: string,
      input: CreateApprovalInput,
    ): Promise<ApprovalRequest> => {
      const token = await getAuthToken();
      const res = await fetch(`/api/investigations/${investigationId}/approvals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new ApiError(
          body.message || body.error || `Failed to create approval request (${res.status})`,
          res.status,
        );
      }
      return (await res.json()) as ApprovalRequest;
    },

    listApprovalRequests: async (investigationId: string): Promise<ApprovalRequest[]> => {
      let token: string | null = null;
      if (isAuthenticated) {
        token = await getOptionalAuthToken();
      }
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/investigations/${investigationId}/approvals`, { headers });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new ApiError(
          body.error || `Failed to list approval requests (${res.status})`,
          res.status,
        );
      }
      return (await res.json()) as ApprovalRequest[];
    },

    decideApprovalRequest: async (
      investigationId: string,
      requestId: string,
      input: DecideApprovalInput,
    ): Promise<ApprovalRequest> => {
      const token = await getAuthToken();
      const res = await fetch(
        `/api/investigations/${investigationId}/approvals/${requestId}/decide`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new ApiError(
          body.message || body.error || `Failed to decide approval request (${res.status})`,
          res.status,
        );
      }
      return (await res.json()) as ApprovalRequest;
    },
  };
}

export function useApiClient(): ApiClient {
  const { getAccessTokenSilently, isAuthenticated } = useAuth();
  const audience =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_AUTH0_AUDIENCE
      : undefined;

  return createApiClient(getAccessTokenSilently, isAuthenticated, audience);
}
