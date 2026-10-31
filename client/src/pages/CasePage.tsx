import React, { useState, useEffect, useRef } from "react";
import { Case, EvidenceRecord, ReasonCode } from "@keys/contracts";
import { SafeEvidenceDisplay } from "../highlight.js";
import { useAuth } from "../auth/AuthProvider.js";

export interface CasePageProps {
  caseId?: string;
  onRouteChange: (route: string, params?: Record<string, string>) => void;
}

export const REASON_CODE_DESCRIPTIONS: Record<ReasonCode, { title: string; explanation: string }> =
  {
    R1: {
      title: "Missing Source Record",
      explanation:
        "The model cited a record identifier that does not exist in the immutable evidence ledger.",
    },
    R2: {
      title: "Exact Quote Mismatch",
      explanation:
        "The cited quotation failed deterministic substring verification against the referenced source record.",
    },
    R3: {
      title: "Personnel Entity Mismatch",
      explanation:
        "The cited individual cannot be confirmed in the organization's verified personnel directory.",
    },
    R4: {
      title: "Invalid Claim Structure",
      explanation:
        "The extracted assertion violates claim schema constraints or lacks required attribution fields.",
    },
    R5: {
      title: "Quote Below Minimum Length",
      explanation:
        "The cited quotation contains fewer than 12 characters, violating deterministic verification thresholds.",
    },
  };

export const CasePage: React.FC<CasePageProps> = ({ caseId = "case_demo_01", onRouteChange }) => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "claims" | "evidence" | "removed">(
    "overview",
  );
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<string>("");
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");
  const [revocationRequested, setRevocationRequested] = useState<boolean>(false);
  const [revocationSubmitted, setRevocationSubmitted] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchCaseDossier = (targetId: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/cases/${encodeURIComponent(targetId)}`, { signal: controller.signal }).then(
        async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error || `Case lookup failed: ${res.status}`);
          }
          return res.json() as Promise<Case>;
        },
      ),
      fetch(`/api/cases/${encodeURIComponent(targetId)}/records`, {
        signal: controller.signal,
      }).then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Case records lookup failed: ${res.status}`);
        }
        return res.json() as Promise<EvidenceRecord[]>;
      }),
    ])
      .then(([fetchedCase, fetchedRecords]) => {
        setCaseData(fetchedCase);
        setRecords(fetchedRecords);

        if (fetchedRecords.length > 0) {
          setSelectedRecordId(fetchedRecords[0].record_id);
        } else {
          setSelectedRecordId("");
        }

        if (fetchedCase.claims_accepted.length > 0) {
          setSelectedQuote(fetchedCase.claims_accepted[0].quote);
        } else {
          setSelectedQuote("");
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load case dossier and evidence records");
        setLoading(false);
      });
  };

  useEffect(() => {
    const targetId = caseId || "case_demo_01";
    fetchCaseDossier(targetId);

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [caseId]);

  const handleCopyCitation = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopyFeedback(text);
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  };

  const currentRecord = records.find((r) => r.record_id === selectedRecordId) || records[0];

  // 1. Loading State
  if (loading) {
    return (
      <div
        className="animate-fade-in"
        style={{ maxWidth: "1240px", margin: "40px auto", padding: "0 24px" }}
      >
        <div style={{ marginBottom: "24px" }}>
          <button
            type="button"
            id="btn-return-archive"
            onClick={() => onRouteChange("archive")}
            className="btn ghost small"
          >
            ← Return to Chamber Registry
          </button>
        </div>

        <div
          className="panel"
          style={{
            padding: "48px 36px",
            textAlign: "center",
            border: "1px dashed var(--gold)",
            background: "rgba(18, 14, 20, 0.95)",
          }}
        >
          <img
            src="/candleon.png"
            alt="Lighting Archive Candle"
            className="candle-glow"
            style={{ width: "28px", height: "50px", margin: "0 auto 16px", objectFit: "contain" }}
          />
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
            EVIDENCE INTEGRITY AUDIT IN PROGRESS
          </div>
          <h2
            className="display"
            style={{ fontSize: "22px", color: "var(--cream)", margin: "0 0 12px" }}
          >
            Inquiring Case Dossier &amp; Immutable Evidence Ledger...
          </h2>
          <p
            className="serif"
            style={{ color: "#c7b591", fontStyle: "italic", maxWidth: "480px", margin: "0 auto" }}
          >
            Retrieving synthetic audit trail, validating exact quote provenance, and verifying
            claims against organizational directory contracts.
          </p>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error || !caseData) {
    return (
      <div
        className="animate-fade-in"
        style={{ maxWidth: "1240px", margin: "40px auto", padding: "0 24px" }}
      >
        <div style={{ marginBottom: "24px" }}>
          <button
            type="button"
            id="btn-return-archive"
            onClick={() => onRouteChange("archive")}
            className="btn ghost small"
          >
            ← Return to Chamber Registry
          </button>
        </div>

        <div
          className="panel"
          style={{
            padding: "48px 36px",
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
            LEDGER INQUIRY ERROR
          </div>
          <h2
            className="display"
            style={{ fontSize: "22px", color: "#f6e4bd", margin: "0 0 12px" }}
          >
            Unable to Retrieve Case Dossier
          </h2>
          <p
            style={{ color: "#e8c5be", maxWidth: "560px", margin: "0 auto 24px", fontSize: "14px" }}
          >
            {error || `Case ${caseId} could not be resolved in the archive ledger.`}
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              type="button"
              id="btn-retry-case"
              onClick={() => fetchCaseDossier(caseId || "case_demo_01")}
              className="btn small"
            >
              ✦ Retry Case Lookup
            </button>
            <button
              type="button"
              onClick={() => onRouteChange("archive")}
              className="btn secondary small"
            >
              Back to Registry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Populated Case View
  const isVerified = caseData.owner_status === "verified";
  const isSupported = caseData.owner_status === "supported";
  const isConflicting = caseData.owner_status === "conflicting";
  const isNoEvidence = caseData.owner_status === "no_evidence";

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "1240px", margin: "40px auto 80px", padding: "0 24px" }}
    >
      {/* Breadcrumb Navigation and Meta Badges */}
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <button
          type="button"
          id="btn-return-archive"
          onClick={() => onRouteChange("archive")}
          className="btn ghost small"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <span>←</span>
          <span>Return to Chamber Registry</span>
        </button>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="tag red">CHAPTER {caseData.ghost_type}</span>
          <span
            className={`tag ${
              isVerified ? "green" : isSupported ? "gold" : isConflicting ? "red" : "gray"
            }`}
          >
            OWNER: {caseData.owner_status.toUpperCase().replace("_", " ")}
          </span>
          <span className="tag gray">PURPOSE: {caseData.purpose_status.toUpperCase()}</span>
          <span className="tag gray" style={{ fontFamily: "var(--mono)", fontSize: "10px" }}>
            LATENCY: {caseData.latency_ms}ms
          </span>
        </div>
      </div>

      {/* Main Tombstone Card with Frame & Parchment */}
      <div
        className="panel"
        style={{
          border: "1px solid var(--gold)",
          backgroundImage: "linear-gradient(180deg, rgba(30,24,19,0.96), rgba(16,13,11,0.99))",
          padding: "36px",
          marginBottom: "32px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "24px",
          }}
        >
          <div>
            <div
              className="eyebrow"
              style={{ color: "var(--gold)", letterSpacing: "0.2em", marginBottom: "6px" }}
            >
              MACHINE IDENTITY TOMBSTONE DOSSIER ✦ {caseData.case_id}
            </div>
            <h1
              className="mono"
              style={{
                fontSize: "clamp(22px, 3vw, 32px)",
                color: "#f6e4bd",
                margin: "4px 0 10px",
                wordBreak: "break-all",
              }}
            >
              {caseData.account_id}
            </h1>
            <p
              className="serif"
              style={{ fontSize: "16px", color: "#c7b591", margin: 0, fontStyle: "italic" }}
            >
              Investigated via {caseData.model} (Immutable state machine &amp; deterministic quote
              verification).
            </p>
          </div>

          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <img
              src={isVerified ? "/seal-verified.png" : "/seal-broken.png"}
              alt={isVerified ? "Verified Provenance Seal" : "Unverified / Broken Provenance Seal"}
              style={{
                width: "60px",
                height: "60px",
                objectFit: "contain",
                filter: isVerified
                  ? "drop-shadow(0 0 12px rgba(126, 146, 114, 0.4))"
                  : "drop-shadow(0 0 12px rgba(165, 44, 48, 0.4))",
              }}
            />
            <button
              type="button"
              id="btn-propose-revocation"
              onClick={() => setRevocationRequested(true)}
              className="btn small"
              style={{
                background: "linear-gradient(180deg, #8a2024, #531114)",
                borderColor: "#e07a5f",
              }}
            >
              Propose Revocation Safeguard
            </button>
          </div>
        </div>

        {/* Tab Navigation Selector */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            borderBottom: "1px solid var(--line)",
            marginTop: "32px",
            paddingBottom: "1px",
            overflowX: "auto",
          }}
        >
          {[
            { id: "overview", label: "Overview & Provenance" },
            { id: "claims", label: `Accepted Claims (${caseData.claims_accepted.length})` },
            { id: "evidence", label: `Source Evidence Records (${records.length})` },
            { id: "removed", label: `Removed Claims (${caseData.claims_removed.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              id={`tab-${t.id}`}
              onClick={() => setActiveTab(t.id as "overview" | "claims" | "evidence" | "removed")}
              className="display"
              style={{
                background: activeTab === t.id ? "rgba(201,157,83,0.14)" : "transparent",
                border: "none",
                borderBottom:
                  activeTab === t.id ? "2px solid var(--gold2)" : "2px solid transparent",
                color: activeTab === t.id ? "#f0d59a" : "#a99b82",
                padding: "10px 16px",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Contradictions & Missing Evidence Banner */}
          {isConflicting && (
            <div
              style={{
                padding: "18px 22px",
                background: "rgba(109,23,27,0.3)",
                border: "1px solid rgba(165,44,48,0.6)",
                borderRadius: "4px",
                fontSize: "13.5px",
                color: "#f6cfc7",
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
              }}
            >
              <span style={{ fontSize: "20px", color: "var(--crimson2)" }}>⚠</span>
              <div>
                <strong style={{ color: "#ffffff" }}>
                  Contradictory Evidence in Audit Ledger:
                </strong>{" "}
                Multiple audit sources associate this machine identity with conflicting ownership or
                purpose assertions. Deterministic validation has halted automated attribution to
                prevent security misclassification.
              </div>
            </div>
          )}

          {isNoEvidence && (
            <div
              style={{
                padding: "18px 22px",
                background: "rgba(30, 26, 33, 0.7)",
                border: "1px solid rgba(197, 160, 89, 0.4)",
                borderRadius: "4px",
                fontSize: "13.5px",
                color: "#dcd0b8",
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
              }}
            >
              <span style={{ fontSize: "20px", color: "var(--gold)" }}>○</span>
              <div>
                <strong style={{ color: "var(--gold2)" }}>No Ownership Evidence Recorded:</strong>{" "}
                This machine identity contains no author or human attribution records in active
                ledgers.
                <div style={{ marginTop: "6px", fontStyle: "italic", color: "#ebd6b0" }}>
                  ✦ Core Integrity Rule: Absence of registered ownership indicates missing
                  provenance documentation, never malicious intent.
                </div>
              </div>
            </div>
          )}

          {/* Primary Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            {/* Finding Card */}
            <div className="panel" style={{ padding: "28px" }}>
              <div
                className="eyebrow"
                style={{ color: "var(--gold)", fontSize: "10.5px", marginBottom: "8px" }}
              >
                INVESTIGATION FINDING
              </div>
              <h3
                className="display"
                style={{ fontSize: "18px", color: "var(--gold2)", marginBottom: "14px" }}
              >
                Classification: {caseData.ghost_type}
              </h3>
              <p style={{ fontSize: "14px", lineHeight: "1.7", color: "#dcd0b8" }}>
                {caseData.ghost_type === "LOST" &&
                  "Supporting commit records confirm initial authoring by an engineer whose profile is now flagged as departed in HR records, while the token retains unrevoked repository privileges."}
                {caseData.ghost_type === "FORGOTTEN" &&
                  "Identity was provisioned for automated runner pipelines without an assigned engineering owner or designated expiration policy."}
                {caseData.ghost_type === "LONELY" &&
                  "Identity remains designated to an active engineer, but audit records reveal zero access or usage activity for over 180 days."}
                {caseData.ghost_type === "INNOCENT" &&
                  "Provisioned for an emergency release with verified intent, but remains active following project delivery."}
              </p>

              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--line)",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                }}
              >
                <div>
                  <span className="eyebrow" style={{ fontSize: "9.5px" }}>
                    PURPOSE STATUS
                  </span>
                  <div style={{ color: "var(--paper)", fontWeight: 600, marginTop: "2px" }}>
                    {caseData.purpose_status.toUpperCase()}
                  </div>
                </div>
                <div>
                  <span className="eyebrow" style={{ fontSize: "9.5px" }}>
                    EVIDENCE BUNDLE
                  </span>
                  <div
                    className="mono"
                    style={{ color: "var(--gold2)", fontWeight: 600, marginTop: "2px" }}
                  >
                    {caseData.bundle_id}
                  </div>
                </div>
              </div>
            </div>

            {/* Attribution Certificate Card */}
            <div className="panel paper" style={{ padding: "28px" }}>
              <div className="eyebrow" style={{ color: "#77552e", marginBottom: "6px" }}>
                ATTRIBUTION CERTIFICATE
              </div>
              <h3
                className="serif"
                style={{ fontSize: "22px", color: "#251a11", margin: "4px 0 12px" }}
              >
                {isVerified
                  ? "Deterministically Verified Ownership"
                  : isSupported
                    ? "Supported Ownership Citation"
                    : isConflicting
                      ? "Contradictory Attribution"
                      : "Unregistered Ownership (No Evidence)"}
              </h3>
              <p style={{ fontSize: "13.5px", color: "#3a2517", lineHeight: "1.65" }}>
                {caseData.claims_accepted.length > 0
                  ? caseData.claims_accepted[0].text
                  : "No human ownership could be substantiated from active audit evidence."}
              </p>

              {caseData.claims_accepted.length > 0 && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    background: "rgba(0,0,0,0.07)",
                    borderRadius: "3px",
                    border: "1px dashed rgba(100,70,35,0.4)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      fontFamily: "var(--mono)",
                      color: "#6b4720",
                      marginBottom: "4px",
                    }}
                  >
                    EXACT AUDIT QUOTATION:
                  </div>
                  <span
                    className="mono"
                    style={{ fontSize: "12px", color: "#3a2517", fontWeight: 600 }}
                  >
                    &ldquo;{caseData.claims_accepted[0].quote}&rdquo;
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Three-Tier Provenance Distinction */}
          <div
            className="panel"
            style={{
              padding: "24px 28px",
              background: "linear-gradient(145deg, rgba(22, 18, 25, 0.95), rgba(15, 12, 16, 0.98))",
            }}
          >
            <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "14px" }}>
              THREE-TIER EVIDENCE PROVENANCE ARCHITECTURE
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "20px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  background: "rgba(0,0,0,0.35)",
                  borderRadius: "3px",
                  borderLeft: "3px solid var(--blue)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--mono)",
                    color: "var(--blue)",
                    marginBottom: "4px",
                  }}
                >
                  [LAYER 1: AI INTERPRETATION]
                </div>
                <strong style={{ fontSize: "13px", color: "#f0f0f0" }}>
                  Gemma 3 4B Candidate Extraction
                </strong>
                <p
                  style={{ fontSize: "12px", color: "#a99b82", marginTop: "6px", lineHeight: 1.5 }}
                >
                  The LLM identifies candidate owners, purposes, and citations from raw unstructured
                  commits and tickets. Claims are treated as untrusted hypotheses.
                </p>
              </div>

              <div
                style={{
                  padding: "16px",
                  background: "rgba(0,0,0,0.35)",
                  borderRadius: "3px",
                  borderLeft: "3px solid var(--green)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--mono)",
                    color: "var(--green)",
                    marginBottom: "4px",
                  }}
                >
                  [LAYER 2: DETERMINISTIC VERIFICATION]
                </div>
                <strong style={{ fontSize: "13px", color: "#f0f0f0" }}>
                  Substring &amp; Directory Engine
                </strong>
                <p
                  style={{ fontSize: "12px", color: "#a99b82", marginTop: "6px", lineHeight: 1.5 }}
                >
                  Enforces exact substring match against raw immutable records. Cross-checks
                  personnel records. Rejects hallucinations with reason codes R1–R5.
                </p>
              </div>

              <div
                style={{
                  padding: "16px",
                  background: "rgba(0,0,0,0.35)",
                  borderRadius: "3px",
                  borderLeft: "3px solid var(--gold)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--mono)",
                    color: "var(--gold)",
                    marginBottom: "4px",
                  }}
                >
                  [LAYER 3: HUMAN GOVERNANCE]
                </div>
                <strong style={{ fontSize: "13px", color: "#f0f0f0" }}>
                  Auditor Sign-Off &amp; Safeguards
                </strong>
                <p
                  style={{ fontSize: "12px", color: "#a99b82", marginTop: "6px", lineHeight: 1.5 }}
                >
                  Security auditors review conflicting claims and propose revocations via push
                  approval (Auth0 CIBA protocol).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Accepted Claims */}
      {activeTab === "claims" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {caseData.claims_accepted.length === 0 ? (
            <div
              className="panel"
              style={{
                padding: "44px 20px",
                textAlign: "center",
                border: "1px dashed var(--line)",
              }}
            >
              <div className="eyebrow" style={{ color: "var(--muted)", marginBottom: "8px" }}>
                ZERO VERIFIED CLAIMS
              </div>
              <h3
                className="display"
                style={{ fontSize: "18px", color: "var(--gold2)", margin: 0 }}
              >
                No Accepted Claims for this Dossier
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--muted)",
                  maxWidth: "460px",
                  margin: "8px auto 0",
                }}
              >
                All candidate claims either failed deterministic verification or no claims were
                proposed by the extraction pipeline.
              </p>
            </div>
          ) : (
            caseData.claims_accepted.map((claim, idx) => (
              <div
                key={idx}
                className="panel"
                style={{
                  padding: "24px",
                  borderLeft: "4px solid var(--gold)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "20px",
                }}
              >
                <div style={{ flex: 1, minWidth: "280px" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      marginBottom: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="tag red">[{claim.kind.toUpperCase()}]</span>
                    <span
                      className="mono"
                      style={{ fontSize: "11px", color: "var(--gold)", fontWeight: 600 }}
                    >
                      RECORD ID: {claim.record_id}
                    </span>
                    {claim.person_id && (
                      <span className="tag gray" style={{ fontSize: "10px" }}>
                        PERSON: {claim.person_id}
                      </span>
                    )}
                  </div>
                  <div
                    className="serif"
                    style={{ fontSize: "16px", color: "#f1dfb8", marginBottom: "12px" }}
                  >
                    {claim.text}
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "rgba(13,11,10,0.85)",
                      borderRadius: "3px",
                      border: "1px dashed var(--line)",
                      fontFamily: "var(--mono)",
                      fontSize: "12px",
                      color: "var(--gold2)",
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    &ldquo;{claim.quote}&rdquo;
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    minWidth: "160px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecordId(claim.record_id);
                      setSelectedQuote(claim.quote);
                      setActiveTab("evidence");
                    }}
                    className="btn small"
                    style={{ fontSize: "10px", width: "100%" }}
                  >
                    Inspect in Raw Evidence →
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyCitation(claim.quote)}
                    className="btn ghost small"
                    style={{ fontSize: "10px", width: "100%" }}
                  >
                    {copyFeedback === claim.quote ? "✓ Copied Quote!" : "Copy Quote"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Source Evidence Records with Safe Exact Quote Highlight */}
      {activeTab === "evidence" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Record Selector Pills */}
          {records.length > 1 && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                alignItems: "center",
                padding: "14px 18px",
                background: "rgba(22, 18, 25, 0.7)",
                border: "1px solid var(--line)",
                borderRadius: "4px",
              }}
            >
              <span
                className="eyebrow"
                style={{ fontSize: "10px", color: "var(--gold)", marginRight: "6px" }}
              >
                AVAILABLE RECORDS:
              </span>
              {records.map((rec) => (
                <button
                  key={rec.record_id}
                  type="button"
                  id={`btn-record-${rec.record_id}`}
                  onClick={() => setSelectedRecordId(rec.record_id)}
                  className="btn small"
                  style={{
                    background:
                      selectedRecordId === rec.record_id
                        ? "linear-gradient(180deg, #8b1e2d, #521019)"
                        : "rgba(38, 34, 43, 0.9)",
                    borderColor:
                      selectedRecordId === rec.record_id ? "var(--gold2)" : "var(--line)",
                    fontSize: "10px",
                    padding: "6px 12px",
                  }}
                >
                  <span className="mono">{rec.record_id}</span>
                  <span style={{ opacity: 0.7 }}>({rec.type})</span>
                </button>
              ))}
            </div>
          )}

          {currentRecord ? (
            <div className="panel" style={{ padding: "32px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "16px",
                  marginBottom: "16px",
                  borderBottom: "1px solid var(--line)",
                  paddingBottom: "16px",
                }}
              >
                <div>
                  <div
                    className="eyebrow"
                    style={{ color: "var(--gold)", letterSpacing: "0.18em" }}
                  >
                    RAW AUDIT RECORD (UNTRUSTED INPUT BOUNDARY)
                  </div>
                  <h3
                    className="mono"
                    style={{ fontSize: "20px", color: "var(--gold2)", margin: "4px 0" }}
                  >
                    {currentRecord.record_id}{" "}
                    <span style={{ fontSize: "14px", color: "var(--muted)" }}>
                      ({currentRecord.type.toUpperCase()})
                    </span>
                  </h3>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#c7b591",
                      marginTop: "4px",
                      display: "flex",
                      gap: "14px",
                      flexWrap: "wrap",
                    }}
                  >
                    {currentRecord.author_handle && (
                      <span>Author: @{currentRecord.author_handle}</span>
                    )}
                    {currentRecord.actor_account_id && (
                      <span>Actor Account: {currentRecord.actor_account_id}</span>
                    )}
                    <span>Structured: {currentRecord.structured ? "Yes" : "No"}</span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "6px",
                  }}
                >
                  <span
                    className="tag gray"
                    style={{ fontFamily: "var(--mono)", fontSize: "10px" }}
                  >
                    TIMESTAMP: {currentRecord.ts}
                  </span>
                  {selectedQuote && (
                    <button
                      type="button"
                      onClick={() => setSelectedQuote("")}
                      className="btn ghost small"
                      style={{ fontSize: "10px", padding: "4px 8px" }}
                    >
                      Clear Highlight Filter
                    </button>
                  )}
                </div>
              </div>

              {selectedQuote ? (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(224, 122, 95, 0.15)",
                    borderLeft: "3px solid #e07a5f",
                    marginBottom: "16px",
                    fontSize: "12px",
                    color: "#f6e4bd",
                  }}
                >
                  <span style={{ color: "#e07a5f", fontWeight: 600 }}>Active Highlight:</span>{" "}
                  &ldquo;{selectedQuote}&rdquo;
                </div>
              ) : (
                <p style={{ fontSize: "12.5px", color: "var(--muted)", marginBottom: "16px" }}>
                  Showing raw record text. Click a claim citation in the Accepted Claims tab to
                  inspect exact highlighted substrings.
                </p>
              )}

              {/* Safe Evidence Quotation Highlighting */}
              <SafeEvidenceDisplay content={currentRecord.content} quote={selectedQuote} />
            </div>
          ) : (
            <div
              className="panel"
              style={{
                padding: "44px 20px",
                textAlign: "center",
                border: "1px dashed var(--line)",
              }}
            >
              <div className="eyebrow" style={{ color: "var(--muted)", marginBottom: "8px" }}>
                ZERO SOURCE RECORDS
              </div>
              <h3
                className="display"
                style={{ fontSize: "18px", color: "var(--gold2)", margin: 0 }}
              >
                No Source Records Attached to this Case
              </h3>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Removed Claims (Reason Codes R1–R5) */}
      {activeTab === "removed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header & Integrity Guarantee */}
          <div
            style={{
              padding: "20px 24px",
              background: "rgba(109,23,27,0.22)",
              border: "1px solid rgba(165,44,48,0.5)",
              borderRadius: "4px",
              fontSize: "13px",
              color: "#f0b9ad",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "#ffffff" }}>
              ✦ Deterministic Verification Guardrails (Reason Codes R1–R5):
            </strong>
            <div style={{ marginTop: "6px" }}>
              To protect organizations from hallucinated attributions, candidate claims that fail
              deterministic substring verification (R2), reference missing records (R1), cite
              unregistered personnel (R3), violate structural constraints (R4), or present temporal
              contradictions (R5) are automatically quarantined below with full audit provenance.
            </div>
          </div>

          {caseData.claims_removed.length === 0 ? (
            <div
              className="panel"
              style={{
                padding: "44px 20px",
                textAlign: "center",
                border: "1px dashed rgba(126, 146, 114, 0.4)",
              }}
            >
              <div className="eyebrow" style={{ color: "var(--green)", marginBottom: "8px" }}>
                CLEAN VERIFICATION PIPELINE
              </div>
              <h3 className="display" style={{ fontSize: "18px", color: "#e2eedd", margin: 0 }}>
                Zero Hallucinations or Quarantined Claims
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "#a9baa0",
                  maxWidth: "460px",
                  margin: "8px auto 0",
                }}
              >
                Every assertion proposed by the model passed 100% of deterministic substring and
                directory verification checks.
              </p>
            </div>
          ) : (
            caseData.claims_removed.map((rem, idx) => {
              const codeMeta = REASON_CODE_DESCRIPTIONS[rem.reason_code] || {
                title: "Quarantined Claim",
                explanation: "The assertion failed deterministic verification checks.",
              };

              return (
                <div
                  key={idx}
                  className="panel"
                  style={{
                    padding: "22px",
                    borderLeft: "4px solid var(--crimson2)",
                    background: "linear-gradient(145deg, rgba(30,15,17,0.94), rgba(17,14,12,0.98))",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="tag red" style={{ fontWeight: 700 }}>
                        REASON: {rem.reason_code} — {codeMeta.title.toUpperCase()}
                      </span>
                      <span className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
                        CLAIM TYPE: {rem.kind.toUpperCase()}
                      </span>
                      {rem.record_id && (
                        <span className="mono" style={{ fontSize: "11px", color: "var(--gold)" }}>
                          REF: {rem.record_id}
                        </span>
                      )}
                    </div>
                    <img
                      src="/seal-broken.png"
                      alt="Quarantined Citation"
                      style={{ width: "32px", height: "32px", objectFit: "contain" }}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: "14px",
                      color: "#f6e4bd",
                      marginBottom: "8px",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Proposed Assertion:</strong> {rem.text}
                  </div>

                  <div
                    style={{
                      fontSize: "12px",
                      color: "#e8c5be",
                      marginBottom: "12px",
                      fontStyle: "italic",
                    }}
                  >
                    Verification Failure: {codeMeta.explanation}
                  </div>

                  <div
                    style={{
                      padding: "10px 14px",
                      background: "rgba(0,0,0,0.6)",
                      fontFamily: "var(--mono)",
                      fontSize: "11.5px",
                      color: "#e07a5f",
                      borderRadius: "3px",
                      border: "1px dashed rgba(224, 122, 95, 0.4)",
                      wordBreak: "break-word",
                    }}
                  >
                    Rejected Quotation: &ldquo;{rem.quote}&rdquo;
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Simulated Revocation Approval Modal */}
      {revocationRequested && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(6px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="panel"
            style={{
              maxWidth: "580px",
              width: "100%",
              padding: "36px",
              border: "1px solid var(--crimson2)",
            }}
          >
            {revocationSubmitted ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: "14px",
                    alignItems: "center",
                    marginBottom: "18px",
                  }}
                >
                  <img
                    src="/seal-verified.png"
                    alt="Verified Safeguard Seal"
                    style={{ width: "42px", height: "42px" }}
                  />
                  <div>
                    <div className="eyebrow" style={{ color: "var(--green)" }}>
                      SAFEGUARD DISPATCH CONFIRMED
                    </div>
                    <h3
                      className="display"
                      style={{ fontSize: "18px", color: "#f0dfbd", margin: 0 }}
                    >
                      Simulated CIBA Push Dispatched
                    </h3>
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px",
                    background: "rgba(76, 175, 80, 0.08)",
                    border: "1px solid rgba(76, 175, 80, 0.3)",
                    borderRadius: "3px",
                    marginBottom: "18px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "13px",
                      lineHeight: "1.6",
                      color: "#c8e6c9",
                      margin: "0 0 10px",
                    }}
                  >
                    ✦ <strong>Sandbox Simulation Notice:</strong> An out-of-band CIBA push approval
                    payload was constructed for identity <code>{caseData.account_id}</code>.
                  </p>
                  <p style={{ fontSize: "12px", lineHeight: "1.5", color: "#a5d6a7", margin: 0 }}>
                    In production, Auth0 CIBA issues an out-of-band approval notification to the
                    designated engineering director. To preserve audit integrity, no live
                    credentials or production keys were modified in this sandbox environment.
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    id="btn-close-revocation-modal"
                    onClick={() => {
                      setRevocationRequested(false);
                      setRevocationSubmitted(false);
                    }}
                    className="btn small"
                    style={{
                      background: "linear-gradient(180deg, #8b1e2d, #521019)",
                      borderColor: "var(--gold)",
                    }}
                  >
                    Close Safeguard Dialog
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: "14px",
                    alignItems: "center",
                    marginBottom: "18px",
                  }}
                >
                  <img
                    src="/seal-verified.png"
                    alt="Auth0 CIBA Shield"
                    style={{ width: "42px", height: "42px" }}
                  />
                  <div>
                    <div className="eyebrow" style={{ color: "var(--gold)" }}>
                      GOVERNANCE SAFEGUARD
                    </div>
                    <h3
                      className="display"
                      style={{ fontSize: "18px", color: "#f0dfbd", margin: 0 }}
                    >
                      Auth0 CIBA / Sandbox Revocation Approval
                    </h3>
                  </div>
                </div>

                <p style={{ fontSize: "13.5px", lineHeight: "1.6", color: "#d0bd98" }}>
                  You are proposing immediate revocation for machine identity{" "}
                  <strong style={{ color: "#ffffff" }}>{caseData.account_id}</strong> based on
                  verified unmanaged provenance in the archive ledger.
                </p>

                <div
                  style={{
                    padding: "14px",
                    background: "rgba(0,0,0,0.45)",
                    borderRadius: "3px",
                    fontSize: "12px",
                    fontFamily: "var(--mono)",
                    color: "var(--gold2)",
                    margin: "18px 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div>
                    Target: <code>github.com/justsamridhi/keys-of-the-departed-sandbox</code>
                  </div>
                  <div>
                    Action: <code>DELETE /repos/:owner/:repo/keys/{caseData.account_id}</code>
                  </div>
                  <div>
                    Token Scope: <code>repo:write (sandbox only)</code>
                  </div>
                  <div>
                    Protocol: <code>Client Initiated Backchannel Authentication (CIBA)</code>
                  </div>
                </div>

                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(197, 160, 89, 0.12)",
                    borderLeft: "3px solid var(--gold)",
                    fontSize: "12px",
                    color: "#e8d5b5",
                    marginBottom: "20px",
                  }}
                >
                  Simulated Demo Mode: In production, Auth0 CIBA sends an asynchronous push
                  notification to the authorized engineering director. The key remains unchanged in
                  this demo.
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    type="button"
                    id="btn-cancel-revocation"
                    onClick={() => {
                      setRevocationRequested(false);
                      setRevocationSubmitted(false);
                    }}
                    className="btn ghost small"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="btn-confirm-revocation"
                    onClick={() => {
                      if (!isAuthenticated) {
                        setRevocationRequested(false);
                        onRouteChange("signin");
                        return;
                      }
                      setRevocationSubmitted(true);
                    }}
                    className="btn small"
                    style={{ background: "linear-gradient(180deg, #8a2024, #531114)" }}
                  >
                    Confirm Push Approval Request
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
