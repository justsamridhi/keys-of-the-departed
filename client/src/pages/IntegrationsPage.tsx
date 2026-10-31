import React, { useState, useEffect } from "react";
import { EntireProvenanceReport, DevRelayReport } from "@keys/contracts";

export interface IntegrationsPageProps {
  onRouteChange: (route: string) => void;
}

export interface TechnologyItem {
  id: string;
  name: string;
  tag: string;
  intendedRole: string;
  currentRole: string;
}

export const TECHNOLOGIES: TechnologyItem[] = [
  {
    id: "gemma",
    name: "Google Gemma / Local Ollama",
    tag: "AI EXTRACTION",
    intendedRole:
      "Contextual candidate extraction from unstructured commit logs, pull requests, and tickets to propose ownership hypotheses citing exact record substrings.",
    currentRole:
      "Deterministic verification and claim schemas are active; candidate claims run in simulated evaluation mode during demo investigations.",
  },
  {
    id: "tabpfn",
    name: "TabPFN",
    tag: "ANOMALY RANKING",
    intendedRole:
      "Tabular foundation model for behavioral anomaly ranking, prioritizing forgotten credentials based on telemetry such as inactivity gaps and administrative privileges.",
    currentRole:
      "Evaluated offline against synthetic behavior features; runtime prioritizes accounts using precomputed behavioral scores.",
  },
  {
    id: "mongodb",
    name: "MongoDB Atlas",
    tag: "PERSISTENT STORAGE",
    intendedRole:
      "Bundle-scoped document storage for accounts, evidence records, investigation audit trails, and reviewer decisions with multi-tenant isolation.",
    currentRole:
      "Full repository interfaces, index definitions, and schema contracts established; connects to MongoDB Atlas when configured, with safe in-memory fallback.",
  },
  {
    id: "auth0",
    name: "Auth0 for AI Agents",
    tag: "AUTHENTICATION & CIBA",
    intendedRole:
      "Auditor authentication and CIBA push-approval safeguards requiring human authorization before any remediation action is dispatched.",
    currentRole:
      "In-app modal authentication and simulated CIBA push-approval safeguards are active in sandbox mode without touching live production credentials.",
  },
  {
    id: "entire",
    name: "Entire CLI",
    tag: "GIT PROVENANCE & ATTRIBUTION",
    intendedRole:
      "Development session checkpoints, shadow-ref commit tracking, and line-level code-change attribution.",
    currentRole:
      "Active repository checkpoints on refs/entire/checkpoints/* and why-attribution inspection active across local Git commits.",
  },
  {
    id: "devrelay",
    name: "DevRelay Gateway",
    tag: "DEV & MLH AGENT GATEWAY",
    intendedRole:
      "Developer identity verification, agent gateway diagnostics, and community AI session transcript registry for peer review and Liquid embedding on DEV.",
    currentRole:
      "Connected as DEV user @justsamridhi with doctor diagnostics and remote session registry verification active.",
  },
  {
    id: "render",
    name: "Render",
    tag: "CLOUD HOSTING",
    intendedRole:
      "Unified cloud infrastructure hosting the web service runtime, API endpoints, and static client bundle with continuous deployment.",
    currentRole:
      "Configured via render.yaml blueprint with truthful /healthz verification reporting active component availability.",
  },
];

export const IntegrationsPage: React.FC<IntegrationsPageProps> = ({ onRouteChange }) => {
  // Entire state
  const [provenanceReport, setProvenanceReport] = useState<EntireProvenanceReport | null>(null);
  const [isLoadingProvenance, setIsLoadingProvenance] = useState<boolean>(true);
  const [provenanceError, setProvenanceError] = useState<string | null>(null);

  // Entire Why Inspector state
  const [targetFile, setTargetFile] = useState<string>("package.json");
  const [targetLine, setTargetLine] = useState<string>("2");
  const [whyResult, setWhyResult] = useState<Record<string, unknown> | null>(null);
  const [whyLoading, setWhyLoading] = useState<boolean>(false);
  const [whyError, setWhyError] = useState<string | null>(null);

  // DevRelay state
  const [devrelayReport, setDevrelayReport] = useState<DevRelayReport | null>(null);
  const [isLoadingDevRelay, setIsLoadingDevRelay] = useState<boolean>(true);
  const [devrelayError, setDevrelayError] = useState<string | null>(null);

  // DevRelay Session Lookup state
  const [sessionLookupId, setSessionLookupId] = useState<string>("");
  const [sessionLookupResult, setSessionLookupResult] = useState<Record<string, unknown> | null>(
    null,
  );
  const [sessionLookupLoading, setSessionLookupLoading] = useState<boolean>(false);
  const [sessionLookupError, setSessionLookupError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadEntireProvenance() {
      setIsLoadingProvenance(true);
      try {
        const res = await fetch("/api/provenance/report");
        if (!res.ok) {
          throw new Error(`Failed to load provenance report: ${res.statusText}`);
        }
        const data = (await res.json()) as EntireProvenanceReport;
        if (isMounted) {
          setProvenanceReport(data);
          setProvenanceError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setProvenanceError(err instanceof Error ? err.message : "Network error");
        }
      } finally {
        if (isMounted) {
          setIsLoadingProvenance(false);
        }
      }
    }

    async function loadDevRelayReport() {
      setIsLoadingDevRelay(true);
      try {
        const res = await fetch("/api/devrelay/report");
        if (!res.ok) {
          throw new Error(`Failed to load DevRelay report: ${res.statusText}`);
        }
        const data = (await res.json()) as DevRelayReport;
        if (isMounted) {
          setDevrelayReport(data);
          setDevrelayError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setDevrelayError(err instanceof Error ? err.message : "Network error");
        }
      } finally {
        if (isMounted) {
          setIsLoadingDevRelay(false);
        }
      }
    }

    loadEntireProvenance();
    loadDevRelayReport();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleInspectWhy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFile.trim()) return;
    setWhyLoading(true);
    setWhyError(null);
    setWhyResult(null);
    try {
      const url = `/api/provenance/why?file=${encodeURIComponent(targetFile.trim())}${
        targetLine.trim() ? `&line=${encodeURIComponent(targetLine.trim())}` : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setWhyResult(data);
    } catch (err: unknown) {
      setWhyError(err instanceof Error ? err.message : "Attribution lookup failed");
    } finally {
      setWhyLoading(false);
    }
  };

  const handleLookupDevRelaySession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionLookupId.trim()) return;
    setSessionLookupLoading(true);
    setSessionLookupError(null);
    setSessionLookupResult(null);
    try {
      const res = await fetch(
        `/api/devrelay/sessions/${encodeURIComponent(sessionLookupId.trim())}`,
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSessionLookupResult(data);
    } catch (err: unknown) {
      setSessionLookupError(err instanceof Error ? err.message : "Session lookup failed");
    } finally {
      setSessionLookupLoading(false);
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        maxWidth: "1140px",
        margin: "40px auto 80px",
        padding: "0 clamp(16px, 3vw, 32px)",
      }}
    >
      {/* Page Header */}
      <div style={{ textAlign: "center", marginBottom: "44px" }}>
        <div
          className="eyebrow"
          style={{ color: "var(--gold)", letterSpacing: "0.2em", marginBottom: "8px" }}
        >
          ✦ PLATFORM ARCHITECTURE &amp; PARTNER CAPABILITIES ✦
        </div>
        <h1
          className="display"
          style={{ fontSize: "clamp(28px, 4vw, 40px)", color: "#f7ebd2", margin: "0 0 14px" }}
        >
          Technology Integrations
        </h1>
        <p
          className="serif"
          style={{
            fontSize: "18px",
            color: "#c7b591",
            maxWidth: "680px",
            margin: "0 auto",
            fontStyle: "italic",
            lineHeight: 1.6,
          }}
        >
          A concise and factually accurate technical overview of the technologies powering Keys of
          the Departed.
        </p>
      </div>

      {/* Scannable Grid: 2 columns on desktop, 1 on mobile */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "22px",
          marginBottom: "48px",
        }}
      >
        {TECHNOLOGIES.map((tech) => (
          <div
            key={tech.id}
            className="panel"
            style={{
              padding: "26px 28px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              {/* Top row: Name & subtle technical category */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "14px",
                  gap: "12px",
                }}
              >
                <h2
                  className="display"
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "var(--cream)",
                    margin: 0,
                    letterSpacing: "0.04em",
                  }}
                >
                  {tech.name}
                </h2>
                <span
                  className="mono"
                  style={{
                    fontSize: "10px",
                    color: "var(--gold)",
                    letterSpacing: "0.08em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tech.tag}
                </span>
              </div>

              {/* 1. Intended Role */}
              <div style={{ marginBottom: "14px" }}>
                <div
                  className="eyebrow"
                  style={{
                    fontSize: "9.5px",
                    color: "#a99b82",
                    marginBottom: "4px",
                    letterSpacing: "0.1em",
                  }}
                >
                  INTENDED ROLE
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.6,
                    color: "#e8d5b5",
                    margin: 0,
                  }}
                >
                  {tech.intendedRole}
                </p>
              </div>

              {/* 2. Current Role */}
              <div>
                <div
                  className="eyebrow"
                  style={{
                    fontSize: "9.5px",
                    color: "var(--gold-dim)",
                    marginBottom: "4px",
                    letterSpacing: "0.1em",
                  }}
                >
                  CURRENT STATUS
                </div>
                <p
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.55,
                    color: "#c8b792",
                    margin: 0,
                    fontStyle: "italic",
                  }}
                >
                  {tech.currentRole}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Phase 6 DevRelay Gateway & Session Registry Section */}
      <div
        className="panel"
        style={{
          padding: "32px 30px",
          background: "rgba(18, 14, 11, 0.95)",
          border: "1px solid var(--gold-dark)",
          marginBottom: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "20px",
            borderBottom: "1px solid rgba(212, 168, 83, 0.2)",
            paddingBottom: "16px",
          }}
        >
          <div>
            <div className="eyebrow" style={{ color: "var(--gold)" }}>
              ✦ AGENT WORKFLOW &amp; COMMUNITY REGISTRY ✦
            </div>
            <h2
              className="display"
              style={{ fontSize: "22px", color: "var(--cream)", margin: "4px 0 0" }}
            >
              DevRelay Gateway &amp; Published Session Registry
            </h2>
          </div>

          <div>
            {isLoadingDevRelay ? (
              <span className="mono" style={{ fontSize: "12px", color: "#a99b82" }}>
                Connecting to DevRelay Gateway...
              </span>
            ) : devrelayReport?.status.available && devrelayReport.status.connected ? (
              <span
                className="mono"
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "#4ade80",
                  borderRadius: "4px",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                ● DevRelay {devrelayReport.status.version || "0.1.24"} · Connected as @
                {devrelayReport.status.profile?.username || "developer"}
              </span>
            ) : devrelayReport?.status.available ? (
              <span
                className="mono"
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  background: "rgba(234, 179, 8, 0.15)",
                  color: "#facc15",
                  borderRadius: "4px",
                  border: "1px solid rgba(234, 179, 8, 0.3)",
                }}
              >
                ▲ DevRelay Available (No Connected Account)
              </span>
            ) : (
              <span
                className="mono"
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  borderRadius: "4px",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                ○ DevRelay Gateway Offline
              </span>
            )}
          </div>
        </div>

        {/* DevRelay Gateway Metrics */}
        {devrelayReport?.status.available && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(212, 168, 83, 0.15)",
                borderRadius: "4px",
              }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "#a99b82" }}>
                CONNECTED DEV PROFILE
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "6px",
                }}
              >
                {devrelayReport.status.profile?.profile_image && (
                  <img
                    src={devrelayReport.status.profile.profile_image}
                    alt="Dev avatar"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: "1px solid var(--gold)",
                    }}
                  />
                )}
                <div>
                  <div
                    className="mono"
                    style={{ fontSize: "14px", color: "var(--gold)", fontWeight: 700 }}
                  >
                    @{devrelayReport.status.profile?.username || "unlinked"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#c8b792" }}>
                    {devrelayReport.status.profile?.name || "Developer"}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "14px 16px",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(212, 168, 83, 0.15)",
                borderRadius: "4px",
              }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "#a99b82" }}>
                MLH OAUTH GATEWAY
              </div>
              <div
                className="mono"
                style={{ fontSize: "13px", color: "#4ade80", marginTop: "6px", fontWeight: 700 }}
              >
                {devrelayReport.diagnostics?.mlh_connected ? "● ACTIVE & LINKED" : "○ NOT LINKED"}
              </div>
              <div
                className="mono"
                style={{ fontSize: "10.5px", color: "#8a7a60", marginTop: "2px" }}
              >
                {devrelayReport.status.profile?.mlh_user_id
                  ? `User ${devrelayReport.status.profile.mlh_user_id.slice(0, 14)}...`
                  : "Standalone DEV"}
              </div>
            </div>

            <div
              style={{
                padding: "14px 16px",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(212, 168, 83, 0.15)",
                borderRadius: "4px",
              }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "#a99b82" }}>
                INSTALLED AGENT SKILLS
              </div>
              <div
                className="mono"
                style={{ fontSize: "20px", color: "var(--gold)", fontWeight: 700 }}
              >
                {devrelayReport.diagnostics?.skills_dirs?.length || 0}
              </div>
              <div style={{ fontSize: "11px", color: "#8a7a60" }}>Claude / Gemini / Codex dirs</div>
            </div>

            <div
              style={{
                padding: "14px 16px",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(212, 168, 83, 0.15)",
                borderRadius: "4px",
              }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "#a99b82" }}>
                PUBLISHED SESSIONS
              </div>
              <div
                className="mono"
                style={{ fontSize: "20px", color: "var(--gold)", fontWeight: 700 }}
              >
                {devrelayReport.sessions.length}
              </div>
              <div style={{ fontSize: "11px", color: "#8a7a60" }}>Preserved on DEV.to</div>
            </div>
          </div>
        )}

        {/* Published Sessions Registry List */}
        <div style={{ marginBottom: "28px" }}>
          <h3
            className="serif"
            style={{ fontSize: "16px", color: "var(--cream)", marginBottom: "8px" }}
          >
            Published Agent Sessions on DEV
          </h3>
          <p style={{ fontSize: "12.5px", color: "#c8b792", margin: "0 0 12px" }}>
            DevRelay preserves interactive AI agent session transcripts (user prompts, thoughts,
            tool calls, and diffs) on DEV, making them embeddable in articles via Liquid tags.
          </p>

          {devrelayReport && devrelayReport.sessions.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12.5px",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(212, 168, 83, 0.2)", color: "#a99b82" }}
                  >
                    <th style={{ padding: "8px 12px" }}>SESSION ID</th>
                    <th style={{ padding: "8px 12px" }}>TITLE</th>
                    <th style={{ padding: "8px 12px" }}>TOOL / HOST</th>
                    <th style={{ padding: "8px 12px" }}>DATE</th>
                    <th style={{ padding: "8px 12px" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {devrelayReport.sessions.map((session) => (
                    <tr
                      key={String(session.id)}
                      style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}
                    >
                      <td className="mono" style={{ padding: "10px 12px", color: "var(--gold)" }}>
                        {session.id}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--cream)" }}>
                        {session.title}
                      </td>
                      <td className="mono" style={{ padding: "10px 12px", color: "#c8b792" }}>
                        {session.tool_name || "gemini_cli"}
                      </td>
                      <td
                        className="mono"
                        style={{ padding: "10px 12px", color: "#8a7a60", fontSize: "11px" }}
                      >
                        {session.created_at || "N/A"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {session.url && (
                          <a
                            href={session.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--gold)", fontSize: "11px" }}
                          >
                            View on DEV ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: "16px",
                background: "rgba(0,0,0,0.25)",
                color: "#c8b792",
                fontSize: "13px",
                border: "1px solid rgba(212, 168, 83, 0.1)",
              }}
            >
              {isLoadingDevRelay
                ? "Checking DEV agent session registry..."
                : devrelayError
                  ? `DevRelay gateway message: ${devrelayError}`
                  : "No agent sessions currently published to DEV. Milestone coding transcripts can be submitted via 'devrelay sessions submit' or embedded into review posts with '{% agent_session <id> %}'."}
            </div>
          )}
        </div>

        {/* Interactive DEV Session Lookup */}
        <div
          style={{
            padding: "20px",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(212, 168, 83, 0.2)",
            borderRadius: "4px",
          }}
        >
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "6px" }}>
            DEV AGENT SESSION DISCOVERY
          </div>
          <h3
            className="serif"
            style={{ fontSize: "16px", color: "var(--cream)", margin: "0 0 10px" }}
          >
            Fetch Published Session Transcript
          </h3>
          <p style={{ fontSize: "12.5px", color: "#cdb78e", margin: "0 0 16px" }}>
            Lookup a published coding session on DEV by ID or slug to inspect verified agent
            messages and tool execution traces.
          </p>

          <form
            onSubmit={handleLookupDevRelaySession}
            style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}
          >
            <div>
              <label
                htmlFor="sessionLookupId"
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "#a99b82",
                  marginBottom: "4px",
                }}
              >
                Session ID or Slug
              </label>
              <input
                id="sessionLookupId"
                type="text"
                value={sessionLookupId}
                onChange={(e) => setSessionLookupId(e.target.value)}
                placeholder="e.g. 42 or session-slug"
                style={{
                  background: "var(--ink)",
                  border: "1px solid var(--gold-dim)",
                  color: "var(--paper)",
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  width: "240px",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={sessionLookupLoading}
              className="btn small"
              style={{ height: "33px" }}
            >
              {sessionLookupLoading ? "Fetching..." : "Fetch Session"}
            </button>
          </form>

          {sessionLookupError && (
            <div
              style={{
                marginTop: "12px",
                color: "#f87171",
                fontSize: "12px",
                fontFamily: "monospace",
              }}
            >
              Error: {sessionLookupError}
            </div>
          )}

          {sessionLookupResult && (
            <div
              className="animate-fade-in"
              style={{
                marginTop: "16px",
                padding: "14px",
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(212, 168, 83, 0.3)",
                fontSize: "12px",
              }}
            >
              <div
                className="eyebrow"
                style={{ color: "var(--gold)", fontSize: "10px", marginBottom: "8px" }}
              >
                DEV AGENT SESSION DATA
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  color: "#e8d5b5",
                  fontFamily: "monospace",
                  maxHeight: "260px",
                  overflowY: "auto",
                }}
              >
                {JSON.stringify(sessionLookupResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Phase 5 Entire Provenance Live Audit Section */}
      <div
        className="panel"
        style={{
          padding: "32px 30px",
          background: "rgba(18, 14, 11, 0.95)",
          border: "1px solid var(--gold-dark)",
          marginBottom: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "20px",
            borderBottom: "1px solid rgba(212, 168, 83, 0.2)",
            paddingBottom: "16px",
          }}
        >
          <div>
            <div className="eyebrow" style={{ color: "var(--gold)" }}>
              ✦ LOCAL GIT PROVENANCE &amp; COMMIT TRACEABILITY ✦
            </div>
            <h2
              className="display"
              style={{ fontSize: "22px", color: "var(--cream)", margin: "4px 0 0" }}
            >
              Entire Session &amp; Checkpoint Verification
            </h2>
          </div>

          <div>
            {isLoadingProvenance ? (
              <span className="mono" style={{ fontSize: "12px", color: "#a99b82" }}>
                Querying Entire CLI...
              </span>
            ) : provenanceReport?.status.available ? (
              <span
                className="mono"
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "#4ade80",
                  borderRadius: "4px",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                }}
              >
                ● Entire CLI {provenanceReport.status.cli_version || "Active"} · Branch{" "}
                {provenanceReport.status.branch || "main"}
              </span>
            ) : (
              <span
                className="mono"
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  borderRadius: "4px",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                ○ Entire CLI Unavailable
              </span>
            )}
          </div>
        </div>

        {/* Provenance Metrics Row */}
        {provenanceReport?.status.available && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(212, 168, 83, 0.15)",
                borderRadius: "4px",
              }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "#a99b82" }}>
                CHECKPOINTS RECORDED
              </div>
              <div
                className="mono"
                style={{ fontSize: "20px", color: "var(--gold)", fontWeight: 700 }}
              >
                {provenanceReport.status.checkpoints_count}
              </div>
            </div>

            <div
              style={{
                padding: "14px 16px",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(212, 168, 83, 0.15)",
                borderRadius: "4px",
              }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "#a99b82" }}>
                LOCAL AGENT SESSIONS
              </div>
              <div
                className="mono"
                style={{ fontSize: "20px", color: "var(--gold)", fontWeight: 700 }}
              >
                {provenanceReport.sessions.length}
              </div>
            </div>

            <div
              style={{
                padding: "14px 16px",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(212, 168, 83, 0.15)",
                borderRadius: "4px",
              }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "#a99b82" }}>
                PRIMARY STORAGE
              </div>
              <div
                className="mono"
                style={{ fontSize: "13px", color: "var(--cream)", marginTop: "4px" }}
              >
                refs/entire/checkpoints/*
              </div>
            </div>
          </div>
        )}

        {/* Checkpoints Timeline Table */}
        <div style={{ marginBottom: "28px" }}>
          <h3
            className="serif"
            style={{ fontSize: "16px", color: "var(--cream)", marginBottom: "12px" }}
          >
            Persistent Git-Ref Checkpoints
          </h3>
          {provenanceReport && provenanceReport.checkpoints.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12.5px",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(212, 168, 83, 0.2)", color: "#a99b82" }}
                  >
                    <th style={{ padding: "8px 12px" }}>CHECKPOINT ID</th>
                    <th style={{ padding: "8px 12px" }}>AGENT</th>
                    <th style={{ padding: "8px 12px" }}>DATE</th>
                    <th style={{ padding: "8px 12px" }}>MESSAGE</th>
                    <th style={{ padding: "8px 12px" }}>SESSION</th>
                  </tr>
                </thead>
                <tbody>
                  {provenanceReport.checkpoints.map((cp) => (
                    <tr
                      key={cp.checkpoint_id}
                      style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}
                    >
                      <td className="mono" style={{ padding: "10px 12px", color: "var(--gold)" }}>
                        {cp.checkpoint_id}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--cream)" }}>
                        {cp.agent || "Antigravity"}
                      </td>
                      <td
                        className="mono"
                        style={{ padding: "10px 12px", color: "#c8b792", fontSize: "11px" }}
                      >
                        {cp.date || "N/A"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#e8d5b5" }}>
                        {cp.message || "Manual checkpoint"}
                      </td>
                      <td
                        className="mono"
                        style={{ padding: "10px 12px", color: "#8a7a60", fontSize: "11px" }}
                      >
                        {cp.session_id ? cp.session_id.slice(0, 8) + "..." : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: "16px",
                background: "rgba(0,0,0,0.25)",
                color: "#c8b792",
                fontSize: "13px",
              }}
            >
              {isLoadingProvenance
                ? "Checking repository checkpoint refs..."
                : provenanceError
                  ? `Provenance service message: ${provenanceError}`
                  : "No checkpoints recorded or Entire CLI is not active in this environment."}
            </div>
          )}
        </div>

        {/* Live Attribution Inspector (entire why) */}
        <div
          style={{
            padding: "20px",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(212, 168, 83, 0.2)",
            borderRadius: "4px",
          }}
        >
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "6px" }}>
            LINE-LEVEL CODE-CHANGE ATTRIBUTION
          </div>
          <h3
            className="serif"
            style={{ fontSize: "16px", color: "var(--cream)", margin: "0 0 10px" }}
          >
            Inspect Provenance of Repository Files
          </h3>
          <p style={{ fontSize: "12.5px", color: "#cdb78e", margin: "0 0 16px" }}>
            Query Entire to trace any repository file or line back to its original AI agent prompt,
            model session, and git commit SHA.
          </p>

          <form
            onSubmit={handleInspectWhy}
            style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}
          >
            <div>
              <label
                htmlFor="targetFile"
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "#a99b82",
                  marginBottom: "4px",
                }}
              >
                File Path
              </label>
              <input
                id="targetFile"
                type="text"
                value={targetFile}
                onChange={(e) => setTargetFile(e.target.value)}
                placeholder="e.g. package.json"
                style={{
                  background: "var(--ink)",
                  border: "1px solid var(--gold-dim)",
                  color: "var(--paper)",
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  width: "220px",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="targetLine"
                style={{
                  display: "block",
                  fontSize: "11px",
                  color: "#a99b82",
                  marginBottom: "4px",
                }}
              >
                Line (optional)
              </label>
              <input
                id="targetLine"
                type="number"
                value={targetLine}
                onChange={(e) => setTargetLine(e.target.value)}
                placeholder="2"
                style={{
                  background: "var(--ink)",
                  border: "1px solid var(--gold-dim)",
                  color: "var(--paper)",
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  width: "80px",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={whyLoading}
              className="btn small"
              style={{ height: "33px" }}
            >
              {whyLoading ? "Tracing..." : "Trace Attribution"}
            </button>
          </form>

          {whyError && (
            <div
              style={{
                marginTop: "12px",
                color: "#f87171",
                fontSize: "12px",
                fontFamily: "monospace",
              }}
            >
              Error: {whyError}
            </div>
          )}

          {whyResult && (
            <div
              className="animate-fade-in"
              style={{
                marginTop: "16px",
                padding: "14px",
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(212, 168, 83, 0.3)",
                fontSize: "12px",
              }}
            >
              <div
                className="eyebrow"
                style={{ color: "var(--gold)", fontSize: "10px", marginBottom: "8px" }}
              >
                ENTIRE ATTRIBUTION RESULT
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  color: "#e8d5b5",
                  fontFamily: "monospace",
                  maxHeight: "260px",
                  overflowY: "auto",
                }}
              >
                {JSON.stringify(whyResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Return to Dashboard */}
      <div style={{ textAlign: "center", marginTop: "44px" }}>
        <button
          type="button"
          onClick={() => onRouteChange("dashboard")}
          className="btn secondary small"
        >
          ← Return to Dashboard
        </button>
      </div>
    </div>
  );
};
