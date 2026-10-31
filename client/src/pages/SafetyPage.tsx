import React from "react";

export interface SafetyPageProps {
  onRouteChange: (route: string) => void;
}

export const SafetyPage: React.FC<SafetyPageProps> = ({ onRouteChange }) => {
  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "1280px", margin: "40px auto 80px", padding: "0 clamp(16px, 3vw, 32px)" }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div
          className="eyebrow"
          style={{ color: "var(--gold)", letterSpacing: "0.22em", marginBottom: "8px" }}
        >
          ✦ ETHICAL AI GOVERNANCE &amp; ARCHITECTURAL SPECIFICATION ✦
        </div>
        <h1
          className="display"
          style={{
            fontSize: "clamp(28px, 4vw, 42px)",
            color: "#f7ebd2",
            margin: "0 0 14px",
            letterSpacing: "0.04em",
          }}
        >
          Safety &amp; Technical Architecture
        </h1>
        <p
          className="serif"
          style={{
            fontSize: "18px",
            color: "#c7b591",
            maxWidth: "740px",
            margin: "0 auto",
            fontStyle: "italic",
            lineHeight: 1.6,
          }}
        >
          How Keys of the Departed enforces cryptographic trace integrity, strictly bounds machine
          learning inferences, and protects organizations from automated security hallucinations.
        </p>
      </div>

      {/* Core Principles Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "24px",
          marginBottom: "48px",
        }}
      >
        {/* Principle 1: Evidence-First Methodology */}
        <div className="panel" style={{ padding: "30px" }}>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
            PRINCIPLE 1 · PROVENANCE INTEGRITY
          </div>
          <h2
            className="display"
            style={{ fontSize: "19px", color: "var(--gold2)", margin: "0 0 12px" }}
          >
            Evidence-First Methodology
          </h2>
          <p style={{ fontSize: "13.5px", lineHeight: "1.7", color: "#dcd0b8", margin: 0 }}>
            Every security finding, attributed ownership claim, and chamber classification must
            trace directly to immutable source evidence (a git commit, an infrastructure ticket, or
            a deployment log). No conclusion is accepted without an exact, verifiable citation.
          </p>
        </div>

        {/* Principle 2: AI Boundaries */}
        <div className="panel" style={{ padding: "30px" }}>
          <div className="eyebrow" style={{ color: "var(--blue)", marginBottom: "8px" }}>
            PRINCIPLE 2 · BOUNDED COGNITION
          </div>
          <h2
            className="display"
            style={{ fontSize: "19px", color: "var(--gold2)", margin: "0 0 12px" }}
          >
            AI Model Output Is Hypothesis, Not Ground Truth
          </h2>
          <p style={{ fontSize: "13.5px", lineHeight: "1.7", color: "#dcd0b8", margin: 0 }}>
            Large Language Models (Gemma 3 4B) are used strictly as candidate extractors to read
            unstructured text and propose candidate claims. Model outputs are treated as untrusted
            hypotheses until verified character-by-character by deterministic application code.
          </p>
        </div>

        {/* Principle 3: Missing Ownership */}
        <div className="panel" style={{ padding: "30px" }}>
          <div className="eyebrow" style={{ color: "var(--crimson2)", marginBottom: "8px" }}>
            PRINCIPLE 3 · ETHICAL INFERENCE
          </div>
          <h2
            className="display"
            style={{ fontSize: "19px", color: "var(--gold2)", margin: "0 0 12px" }}
          >
            Missing Ownership Is Not Proof of Malice
          </h2>
          <p style={{ fontSize: "13.5px", lineHeight: "1.7", color: "#dcd0b8", margin: 0 }}>
            When an identity has no registered owner in directory records, it indicates an absence
            of documentation or poor provisioning hygiene—never evidence of malicious intent or an
            active adversary. The platform never manufactures certainty from silence.
          </p>
        </div>

        {/* Principle 4: Human-in-the-Loop */}
        <div className="panel" style={{ padding: "30px" }}>
          <div className="eyebrow" style={{ color: "var(--green)", marginBottom: "8px" }}>
            PRINCIPLE 4 · GOVERNANCE SAFEGUARD
          </div>
          <h2
            className="display"
            style={{ fontSize: "19px", color: "var(--gold2)", margin: "0 0 12px" }}
          >
            Destructive Actions Require Human Approval
          </h2>
          <p style={{ fontSize: "13.5px", lineHeight: "1.7", color: "#dcd0b8", margin: 0 }}>
            No credential is automatically revoked by autonomous agent decisions. Proposed
            remediation actions are submitted as authorization requests requiring explicit push
            approval via Auth0 CIBA protocol before sandbox tokens are issued.
          </p>
        </div>
      </div>

      {/* Deterministic Verification & Reason Codes Section */}
      <div className="panel" style={{ padding: "36px", marginBottom: "48px" }}>
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "10px" }}>
          DETERMINISTIC VERIFICATION ENGINE · SPECIFICATION SECTION 5.1
        </div>
        <h2
          className="display"
          style={{ fontSize: "24px", color: "var(--cream)", margin: "0 0 16px" }}
        >
          Exact Quotation Matching &amp; Reason Codes (R1–R5)
        </h2>
        <p style={{ fontSize: "14px", lineHeight: "1.7", color: "#c7b591", marginBottom: "24px" }}>
          Candidate claims proposed by AI extractions undergo an immutable 4-step verification
          pipeline. The verifier applies Unicode NFKC normalization, strips zero-width characters,
          normalizes quotes and hyphens, and enforces exact substring matching. Any assertion that
          fails is quarantined with an explicit reason code:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {[
            {
              code: "R1",
              title: "Missing Source Record",
              desc: "The referenced evidence record does not exist in the active immutable evidence ledger.",
            },
            {
              code: "R2",
              title: "Exact Quote Mismatch",
              desc: "The cited quotation failed deterministic substring verification against the referenced source record.",
            },
            {
              code: "R3",
              title: "Personnel Entity Mismatch",
              desc: "The cited individual cannot be confirmed in the organization's verified personnel directory.",
            },
            {
              code: "R4",
              title: "Invalid Claim Structure",
              desc: "The extracted assertion violates claim schema constraints or lacks required attribution fields.",
            },
            {
              code: "R5",
              title: "Quote Below Minimum Length",
              desc: "The cited quotation contains fewer than 12 characters, violating deterministic verification thresholds.",
            },
          ].map((rc) => (
            <div
              key={rc.code}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
                padding: "14px 18px",
                background: "rgba(0,0,0,0.4)",
                borderRadius: "3px",
                borderLeft: "3px solid var(--crimson2)",
              }}
            >
              <span
                className="tag red"
                style={{ fontSize: "11px", fontWeight: 700, minWidth: "40px", textAlign: "center" }}
              >
                {rc.code}
              </span>
              <div>
                <strong style={{ color: "#f7ebd2", fontSize: "13.5px" }}>{rc.title}</strong>
                <div style={{ color: "#a99b82", fontSize: "12.5px", marginTop: "3px" }}>
                  {rc.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technical Architecture Stack Breakdown */}
      <div className="panel" style={{ padding: "36px", marginBottom: "48px" }}>
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "10px" }}>
          IMPLEMENTED SYSTEM ARCHITECTURE
        </div>
        <h2
          className="display"
          style={{ fontSize: "24px", color: "var(--cream)", margin: "0 0 16px" }}
        >
          Full-Stack Component Hierarchy
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {/* Layer 1: Contracts */}
          <div
            style={{
              padding: "20px",
              background: "rgba(0,0,0,0.35)",
              borderRadius: "4px",
              borderTop: "3px solid var(--gold)",
            }}
          >
            <div className="eyebrow" style={{ fontSize: "10px", color: "var(--gold)" }}>
              LAYER 1 · SHARED CONTRACTS
            </div>
            <h3 style={{ fontSize: "15px", color: "#f0dfbd", margin: "6px 0 10px" }}>
              @keys/contracts
            </h3>
            <p style={{ fontSize: "12.5px", color: "#a99b82", lineHeight: 1.6 }}>
              Single source of truth using Zod schemas for Account, Case, EvidenceRecord,
              Investigation, and DashboardStats. Enforces strict response envelopes.
            </p>
          </div>

          {/* Layer 2: Backend */}
          <div
            style={{
              padding: "20px",
              background: "rgba(0,0,0,0.35)",
              borderRadius: "4px",
              borderTop: "3px solid var(--blue)",
            }}
          >
            <div className="eyebrow" style={{ fontSize: "10px", color: "var(--blue)" }}>
              LAYER 2 · SERVER RUNTIME
            </div>
            <h3 style={{ fontSize: "15px", color: "#f0dfbd", margin: "6px 0 10px" }}>
              @keys/server (Express + Node.js 22)
            </h3>
            <p style={{ fontSize: "12.5px", color: "#a99b82", lineHeight: 1.6 }}>
              Express application with safe path traversal sanitization, 10MB upload limits,
              isolated repository layer (Accounts, Cases, Investigations), and truthful /healthz.
            </p>
          </div>

          {/* Layer 3: Frontend */}
          <div
            style={{
              padding: "20px",
              background: "rgba(0,0,0,0.35)",
              borderRadius: "4px",
              borderTop: "3px solid var(--crimson2)",
            }}
          >
            <div className="eyebrow" style={{ fontSize: "10px", color: "var(--crimson2)" }}>
              LAYER 3 · CLIENT INTERFACE
            </div>
            <h3 style={{ fontSize: "15px", color: "#f0dfbd", margin: "6px 0 10px" }}>
              @keys/client (React 18 + Vite)
            </h3>
            <p style={{ fontSize: "12.5px", color: "#a99b82", lineHeight: 1.6 }}>
              SPA with zero dangerouslySetInnerHTML usage. Exact quotation segmentation via pure
              React text nodes, accessible focus traps, reduced motion support, and responsive
              layouts.
            </p>
          </div>

          {/* Layer 4: Storage */}
          <div
            style={{
              padding: "20px",
              background: "rgba(0,0,0,0.35)",
              borderRadius: "4px",
              borderTop: "3px solid var(--green)",
            }}
          >
            <div className="eyebrow" style={{ fontSize: "10px", color: "var(--green)" }}>
              LAYER 4 · PERSISTENCE LAYER
            </div>
            <h3 style={{ fontSize: "15px", color: "#f0dfbd", margin: "6px 0 10px" }}>
              In-Memory Fixtures (MongoDB Atlas Ready)
            </h3>
            <p style={{ fontSize: "12.5px", color: "#a99b82", lineHeight: 1.6 }}>
              Currently backed by bundle-isolated in-memory repositories for 40 synthetic
              identities. Designed with clean repository interfaces for seamless MongoDB Atlas
              migration.
            </p>
          </div>
        </div>
      </div>

      {/* Return Action */}
      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          onClick={() => onRouteChange("dashboard")}
          className="btn"
          style={{ padding: "14px 28px" }}
        >
          Return to Sanctuary Dashboard →
        </button>
      </div>
    </div>
  );
};
