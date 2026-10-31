import React, { useState, useEffect } from "react";
import { DashboardStats } from "@keys/contracts";
import { useApiClient } from "../auth/apiClient.js";

export interface DashboardPageProps {
  onRouteChange: (route: string, params?: Record<string, string>) => void;
  onOpenDemo?: () => void;
  isDemoMode?: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onRouteChange,
  onOpenDemo,
  isDemoMode = false,
}) => {
  const api = useApiClient();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardStats = () => {
    setLoading(true);
    setError(null);

    api
      .getDashboardStats(isDemoMode)
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || "Failed to load dashboard statistics");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [isDemoMode]);

  if (loading) {
    return (
      <div
        className="animate-fade-in"
        style={{ maxWidth: "1340px", margin: "40px auto", padding: "0 clamp(16px, 3vw, 32px)" }}
      >
        <div
          className="panel"
          style={{
            padding: "54px 30px",
            textAlign: "center",
            border: "1px dashed var(--gold)",
            background: "rgba(18, 14, 20, 0.95)",
          }}
        >
          <img
            src="/candleon.png"
            alt="Lighting Sanctuary"
            className="candle-glow"
            style={{ width: "32px", height: "54px", margin: "0 auto 18px", objectFit: "contain" }}
          />
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
            SYNCHRONIZING INVESTIGATOR REGISTRY
          </div>
          <h2 className="display" style={{ fontSize: "22px", color: "var(--cream)", margin: 0 }}>
            Querying Machine Identity Registry &amp; Investigation History...
          </h2>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div
        className="animate-fade-in"
        style={{ maxWidth: "1340px", margin: "40px auto", padding: "0 clamp(16px, 3vw, 32px)" }}
      >
        <div
          className="panel"
          style={{
            padding: "48px 30px",
            textAlign: "center",
            border: "1px solid var(--crimson2)",
            background: "rgba(35, 14, 18, 0.95)",
          }}
        >
          <img
            src="/seal-broken.png"
            alt="Broken Seal"
            style={{ width: "54px", height: "54px", margin: "0 auto 16px", objectFit: "contain" }}
          />
          <div className="eyebrow" style={{ color: "var(--crimson2)", marginBottom: "8px" }}>
            REGISTRY OUTAGE
          </div>
          <h2
            className="display"
            style={{ fontSize: "22px", color: "#f6e4bd", margin: "0 0 12px" }}
          >
            Failed to Load Dashboard Statistics
          </h2>
          <p
            style={{ color: "#e8c5be", maxWidth: "520px", margin: "0 auto 20px", fontSize: "14px" }}
          >
            {error || "Unable to retrieve dashboard state from the ledger backend."}
          </p>
          <button
            type="button"
            id="btn-retry-dashboard"
            onClick={fetchDashboardStats}
            className="btn small"
          >
            ✦ Retry Querying Ledger
          </button>
        </div>
      </div>
    );
  }

  const isSynthetic = Boolean(isDemoMode);
  const isEmptyRealWorkspace =
    !isSynthetic && (stats.total_identities === 0 || stats.meta.synthetic);

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "1340px", margin: "40px auto 80px", padding: "0 clamp(16px, 3vw, 32px)" }}
    >
      {/* Demo Mode Alert Banner - ONLY rendered in explicit demo mode */}
      {isSynthetic && (
        <div
          role="status"
          style={{
            padding: "16px 22px",
            marginBottom: "28px",
            background: "rgba(139, 30, 45, 0.25)",
            border: "1px solid var(--crimson2)",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div>
            <div
              style={{
                color: "#f7b5a8",
                fontWeight: 700,
                fontSize: "13px",
                letterSpacing: "0.06em",
              }}
            >
              ✦ DEMO MODE — SYNTHETIC DATA
            </div>
            <div style={{ color: "#ecd4cf", fontSize: "12.5px", marginTop: "2px" }}>
              Displaying the frozen 40-identity synthetic demonstration dataset. This data is
              strictly isolated from your real organizational investigations.
            </div>
          </div>

          <button
            type="button"
            id="btn-exit-demo"
            onClick={() => onRouteChange("dashboard", { demo: "false" })}
            className="btn ghost small"
            style={{ fontSize: "11px", borderColor: "var(--crimson2)", color: "#f7ebd2" }}
          >
            Exit Demo → Real Workspace
          </button>
        </div>
      )}

      {/* 1. Header Card */}
      <div
        className="panel"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "28px",
          marginBottom: "36px",
          padding: "36px",
          border: "1px solid var(--gold)",
          backgroundImage: "linear-gradient(135deg, rgba(35,26,20,0.98), rgba(16,13,11,0.96))",
        }}
      >
        <div style={{ maxWidth: "720px" }}>
          <div
            className="eyebrow"
            style={{ color: "var(--gold)", letterSpacing: "0.2em", marginBottom: "8px" }}
          >
            {isSynthetic
              ? "✦ DEMONSTRATION WORKSPACE · SYNTHETIC DATASET ✦"
              : "✦ INVESTIGATOR WORKSPACE · MACHINE IDENTITY REGISTRY ✦"}
          </div>
          <h1
            className="display"
            style={{
              fontSize: "clamp(26px, 3.8vw, 38px)",
              color: "#f7ebd2",
              margin: "4px 0 12px",
              letterSpacing: "0.04em",
            }}
          >
            {isSynthetic ? "Demonstration Dashboard" : "Investigator Dashboard"}
          </h1>
          <p
            className="serif"
            style={{
              fontSize: "16.5px",
              color: "#c7b591",
              margin: 0,
              fontStyle: "italic",
              lineHeight: 1.6,
            }}
          >
            {isSynthetic
              ? `Reviewing 40 synthetic machine identities across 4 governance chambers.`
              : isEmptyRealWorkspace
                ? "No machine identities have been analyzed yet in your sanctuary workspace."
                : `Tracking ${stats.total_identities} machine identities derived from your completed investigations.`}
          </p>
        </div>

        {/* Primary CTA Button */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "220px" }}>
          <button
            type="button"
            id="btn-create-new-investigation"
            onClick={() => onRouteChange("new-investigation")}
            className="btn"
            style={{
              padding: "16px 28px",
              fontSize: "13px",
              letterSpacing: "0.12em",
              background: "linear-gradient(180deg, #b02638, #69131f)",
              borderColor: "var(--gold2)",
              boxShadow: "0 0 24px rgba(197, 160, 89, 0.4), 0 8px 30px rgba(0,0,0,0.8)",
            }}
          >
            ✦ NEW INVESTIGATION
          </button>

          {!isSynthetic && (
            <button
              type="button"
              id="btn-explore-demo-workspace"
              onClick={() => onRouteChange("dashboard", { demo: "true" })}
              className="btn secondary small"
              style={{ fontSize: "11px" }}
            >
              Explore Synthetic Demo
            </button>
          )}

          {isSynthetic && onOpenDemo && (
            <button
              type="button"
              onClick={onOpenDemo}
              className="btn ghost small"
              style={{ fontSize: "11px" }}
            >
              Guided Demo Tour
            </button>
          )}
        </div>
      </div>

      {/* 2. Empty Real Workspace View */}
      {isEmptyRealWorkspace && (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <div
            className="panel"
            style={{
              padding: "44px 32px",
              textAlign: "center",
              border: "1px dashed rgba(197, 160, 89, 0.4)",
              background: "rgba(18, 14, 20, 0.8)",
            }}
          >
            <img
              src="/goldenbook.png"
              alt="Empty Workspace Ledger"
              style={{
                width: "72px",
                height: "72px",
                objectFit: "contain",
                margin: "0 auto 16px",
                opacity: 0.85,
              }}
            />
            <h3
              className="display"
              style={{ fontSize: "22px", color: "var(--cream)", margin: "0 0 10px" }}
            >
              Your Machine Identity Workspace is Empty
            </h3>
            <p
              className="serif"
              style={{
                fontSize: "16px",
                color: "#c7b591",
                maxWidth: "600px",
                margin: "0 auto 24px",
                lineHeight: 1.6,
                fontStyle: "italic",
              }}
            >
              To discover forgotten deploy keys, service accounts, and unmanaged tokens, initiate
              your first investigation by uploading engineering evidence records.
            </p>

            <button
              type="button"
              onClick={() => onRouteChange("new-investigation")}
              className="btn"
              style={{ padding: "14px 32px", fontSize: "12px", letterSpacing: "0.1em" }}
            >
              ✦ Start an Investigation Now
            </button>
          </div>

          {/* Primary 7-Step Investigation Workflow Guide */}
          <div className="panel" style={{ padding: "32px" }}>
            <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
              PRIMARY INVESTIGATION WORKFLOW
            </div>
            <h4
              className="display"
              style={{ fontSize: "18px", color: "var(--cream)", margin: "0 0 18px" }}
            >
              How an Investigation Proceeds
            </h4>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "14px",
              }}
            >
              {[
                {
                  step: "01",
                  title: "Create Investigation",
                  desc: "Initialize a dedicated machine-identity audit bundle for your project.",
                },
                {
                  step: "02",
                  title: "Define Target Scope",
                  desc: "Set the investigation name, system identifier, and organization perimeter.",
                },
                {
                  step: "03",
                  title: "Upload Evidence",
                  desc: "Ingest CSV/JSON exports, git commits, CI/CD run logs, and IAM bindings.",
                },
                {
                  step: "04",
                  title: "Extract Identities",
                  desc: "Discover deploy keys, bot accounts, and machine identities across records.",
                },
                {
                  step: "05",
                  title: "Inspect Citations",
                  desc: "Review verbatim source quotes and deterministic provenance verification.",
                },
                {
                  step: "06",
                  title: "Evaluate Conflicts",
                  desc: "Highlight contradictory ownership, departed holders, and orphaned credentials.",
                },
                {
                  step: "07",
                  title: "Human Decision",
                  desc: "Confirm legitimate keys or approve credential revocation and offboarding.",
                },
              ].map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "16px",
                    background: "rgba(0,0,0,0.3)",
                    borderLeft: "3px solid var(--gold)",
                    borderRadius: "3px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <span className="mono" style={{ fontSize: "11px", color: "var(--gold2)" }}>
                      {s.step}
                    </span>
                    <strong style={{ color: "#f7ebd2", fontSize: "13.5px" }}>{s.title}</strong>
                  </div>
                  <p
                    style={{ fontSize: "12px", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}
                  >
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Supported Evidence Categories Guidance */}
          <div className="panel" style={{ padding: "32px" }}>
            <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
              ACCEPTED EVIDENCE FORMATS &amp; CATEGORIES
            </div>
            <h4
              className="display"
              style={{ fontSize: "18px", color: "var(--cream)", margin: "0 0 18px" }}
            >
              What Evidence Can You Upload?
            </h4>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              {[
                {
                  title: "1. Machine Identity Inventory",
                  ext: ".json, .csv",
                  desc: "CSV or JSON export of deploy keys, service accounts, or bot credentials.",
                },
                {
                  title: "2. IAM Policies & Permissions",
                  ext: ".json, .txt",
                  desc: "Cloud IAM role bindings, privilege scopes, and policy documents.",
                },
                {
                  title: "3. Personnel & Directory Records",
                  ext: ".json, .csv",
                  desc: "Employee list, engineer handles, and departure timestamps.",
                },
                {
                  title: "4. Repository Commits",
                  ext: ".log, .txt, .json",
                  desc: "git log histories containing author signatures and commit messages.",
                },
                {
                  title: "5. Deployment & CI/CD Logs",
                  ext: ".log, .txt",
                  desc: "Build pipeline runs, runner daemons, and automated deployment executions.",
                },
                {
                  title: "6. Engineering Tickets",
                  ext: ".json, .csv",
                  desc: "Jira / Linear issue tickets requesting or documenting credential generation.",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "16px",
                    background: "rgba(0,0,0,0.3)",
                    borderLeft: "3px solid var(--gold)",
                    borderRadius: "3px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ color: "#f7ebd2", fontSize: "13px" }}>{item.title}</strong>
                    <span className="mono" style={{ fontSize: "10.5px", color: "var(--gold2)" }}>
                      {item.ext}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--muted)",
                      margin: "6px 0 0",
                      lineHeight: 1.5,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Real Workspace with Active Data OR Synthetic Demonstration Mode */}
      {(!isEmptyRealWorkspace || isSynthetic) && (
        <>
          {/* Summary Metrics Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
              marginBottom: "36px",
            }}
          >
            <div className="panel" style={{ padding: "20px", borderLeft: "3px solid var(--gold)" }}>
              <div className="eyebrow" style={{ fontSize: "10px", color: "var(--gold)" }}>
                IDENTITIES DISCOVERED
              </div>
              <div
                className="mono"
                style={{
                  fontSize: "30px",
                  fontWeight: 700,
                  color: "var(--cream)",
                  marginTop: "4px",
                }}
              >
                {stats.total_identities}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
                {isSynthetic ? "Synthetic baseline accounts" : "From accessible investigations"}
              </div>
            </div>

            <div
              className="panel"
              style={{ padding: "20px", borderLeft: "3px solid var(--crimson2)" }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "var(--crimson2)" }}>
                REQUIRING HUMAN REVIEW
              </div>
              <div
                className="mono"
                style={{ fontSize: "30px", fontWeight: 700, color: "#f6c3ba", marginTop: "4px" }}
              >
                {stats.review_required_count}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
                Conflicting or missing provenance
              </div>
            </div>

            <div
              className="panel"
              style={{ padding: "20px", borderLeft: "3px solid var(--green)" }}
            >
              <div className="eyebrow" style={{ fontSize: "10px", color: "var(--green)" }}>
                VERIFIED CITATIONS
              </div>
              <div
                className="mono"
                style={{ fontSize: "30px", fontWeight: 700, color: "#b9e2b0", marginTop: "4px" }}
              >
                {stats.evidence_status_distribution.verified}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
                Exact quote + directory match
              </div>
            </div>

            <div className="panel" style={{ padding: "20px", borderLeft: "3px solid var(--blue)" }}>
              <div className="eyebrow" style={{ fontSize: "10px", color: "var(--blue)" }}>
                INVESTIGATIONS COMPLETED
              </div>
              <div
                className="mono"
                style={{ fontSize: "30px", fontWeight: 700, color: "#d0e4ff", marginTop: "4px" }}
              >
                {stats.recent_investigations.length}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "2px" }}>
                Active audit bundles
              </div>
            </div>
          </div>

          {/* Four Chambers Taxonomy (Demo Mode or when categories present) */}
          <div style={{ marginBottom: "36px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div className="eyebrow" style={{ color: "var(--gold)" }}>
                FOUR-CHAMBER CLASSIFICATION BREAKDOWN
              </div>
              <button
                type="button"
                onClick={() => onRouteChange("archive", isSynthetic ? { demo: "true" } : undefined)}
                className="btn ghost small"
                style={{ fontSize: "11px", padding: "4px 8px" }}
              >
                View in Archive Registry →
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "20px",
              }}
            >
              {[
                {
                  name: "LOST",
                  count: stats.ghost_distribution.LOST,
                  subtitle: "Departed Owner",
                  desc: "Verified engineer departed; token remains unrevoked.",
                  glyph: "/glyph-lost.png",
                  color: "#c49a52",
                },
                {
                  name: "FORGOTTEN",
                  count: stats.ghost_distribution.FORGOTTEN,
                  subtitle: "No Evidence",
                  desc: "Zero documentation, owner signature, or ticket trace.",
                  glyph: "/glyph-forgotten.png",
                  color: "#a52c30",
                },
                {
                  name: "LONELY",
                  count: stats.ghost_distribution.LONELY,
                  subtitle: "Inactive Key",
                  desc: "Active employee holding privileged key unused >90 days.",
                  glyph: "/glyph-lonely.png",
                  color: "#8c6b39",
                },
                {
                  name: "INNOCENT",
                  count: stats.ghost_distribution.INNOCENT,
                  subtitle: "No TTL Expiry",
                  desc: "Temporary key provisioned without expiration window.",
                  glyph: "/glyph-innocent.png",
                  color: "#7e9272",
                },
              ].map((chamber, idx) => (
                <div
                  key={idx}
                  className="panel"
                  id={`chamber-card-${chamber.name.toLowerCase()}`}
                  onClick={() =>
                    onRouteChange("archive", {
                      filter: chamber.name,
                      ...(isSynthetic ? { demo: "true" } : {}),
                    })
                  }
                  style={{
                    cursor: "pointer",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background:
                      "linear-gradient(180deg, rgba(22, 18, 25, 0.95) 0%, rgba(13, 11, 15, 0.98) 100%)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "14px",
                      }}
                    >
                      <img
                        src={chamber.glyph}
                        alt={chamber.name}
                        style={{ width: "44px", height: "44px", objectFit: "contain" }}
                      />
                      <span
                        className="mono"
                        style={{ fontSize: "32px", fontWeight: 700, color: chamber.color }}
                      >
                        {chamber.count}
                      </span>
                    </div>
                    <div
                      className="display"
                      style={{ fontSize: "18px", fontWeight: 700, color: "#f0dfbd" }}
                    >
                      {chamber.name}
                    </div>
                    <div
                      className="serif"
                      style={{
                        fontSize: "13px",
                        color: "var(--gold2)",
                        fontStyle: "italic",
                        marginBottom: "8px",
                      }}
                    >
                      {chamber.subtitle}
                    </div>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        margin: 0,
                        lineHeight: "1.5",
                      }}
                    >
                      {chamber.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attribution Status Breakdown */}
          <div className="panel" style={{ padding: "28px" }}>
            <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "12px" }}>
              EVIDENCE VERIFICATION BREAKDOWN
            </div>
            <h3
              className="display"
              style={{ fontSize: "18px", color: "var(--cream)", marginBottom: "16px" }}
            >
              Attribution Statuses
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "14px",
              }}
            >
              {[
                {
                  status: "Verified",
                  count: stats.evidence_status_distribution.verified,
                  tagClass: "green",
                  desc: "Verbatim quote match and active personnel directory confirmation.",
                },
                {
                  status: "Supported",
                  count: stats.evidence_status_distribution.supported,
                  tagClass: "gold",
                  desc: "Single accepted free-text record cited without full directory link.",
                },
                {
                  status: "Conflicting",
                  count: stats.evidence_status_distribution.conflicting,
                  tagClass: "red",
                  desc: "Contradictory ownership records detected; requires human review.",
                },
                {
                  status: "No Evidence",
                  count: stats.evidence_status_distribution.no_evidence,
                  tagClass: "gray",
                  desc: "Zero human attribution records; ungrounded credential.",
                },
              ].map((st, sidx) => (
                <div
                  key={sidx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "3px",
                    borderLeft: `3px solid ${
                      st.tagClass === "green"
                        ? "var(--green)"
                        : st.tagClass === "gold"
                          ? "var(--gold)"
                          : st.tagClass === "red"
                            ? "var(--crimson2)"
                            : "var(--muted)"
                    }`,
                  }}
                >
                  <div>
                    <span
                      className={`tag ${st.tagClass}`}
                      style={{ fontSize: "10px", marginRight: "8px" }}
                    >
                      {st.status.toUpperCase()}
                    </span>
                    <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "4px" }}>
                      {st.desc}
                    </div>
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: "22px",
                      fontWeight: 700,
                      color: "var(--cream)",
                      marginLeft: "12px",
                    }}
                  >
                    {st.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Active Investigation Bundles List */}
          {stats.recent_investigations.length > 0 && (
            <div className="panel" style={{ padding: "28px", marginTop: "32px" }}>
              <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
                {isSynthetic
                  ? "✦ SYNTHETIC DEMONSTRATION AUDIT BUNDLES ✦"
                  : "✦ RECENT INVESTIGATION BUNDLES ✦"}
              </div>
              <h3
                className="display"
                style={{ fontSize: "18px", color: "var(--cream)", margin: "0 0 16px" }}
              >
                Active Investigation History
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {stats.recent_investigations.map((inv) => (
                  <div
                    key={inv.investigation_id}
                    style={{
                      padding: "16px 20px",
                      background: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid rgba(197, 160, 89, 0.25)",
                      borderRadius: "4px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <strong style={{ color: "#f7ebd2", fontSize: "15px" }}>{inv.name}</strong>
                        <span className={`tag ${inv.status === "completed" ? "green" : "gold"}`}>
                          {inv.status.toUpperCase()}
                        </span>
                        {inv.is_demo && <span className="tag red">DEMO</span>}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                        Org: {inv.organization_id || "Unspecified"} · Created:{" "}
                        {new Date(inv.created_at).toLocaleDateString()} · Files: {inv.file_count} ·
                        Identified: {inv.accounts_discovered_count}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onRouteChange("investigations", {
                          id: inv.investigation_id,
                          ...(isSynthetic ? { demo: "true" } : {}),
                        })
                      }
                      className="btn ghost small"
                      style={{ fontSize: "11px" }}
                    >
                      Open Investigation →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
