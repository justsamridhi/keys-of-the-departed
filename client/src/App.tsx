import React, { useEffect, useState } from "react";
import { Case, EvidenceRecord, OwnerStatus } from "@keys/contracts";
import { SafeEvidenceDisplay } from "./highlight.js";

export function formatOwnerStatus(status: OwnerStatus): { label: string; icon: string } {
  switch (status) {
    case "verified":
      return { label: "Verified", icon: "✓" };
    case "supported":
      return { label: "Supported", icon: "▲" };
    case "conflicting":
      return { label: "Conflicting", icon: "⚠" };
    case "no_evidence":
      return { label: "No Evidence", icon: "○" };
  }
}

export const App: React.FC = () => {
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [record, setRecord] = useState<EvidenceRecord | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadCase() {
      try {
        setLoading(true);
        const res = await fetch("/api/cases/case_demo_01");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Case = await res.json();
        setCurrentCase(data);

        // Fetch first supporting record if available
        if (data.claims_accepted.length > 0) {
          const recId = data.claims_accepted[0].record_id;
          const recRes = await fetch(`/api/records/${recId}`);
          if (recRes.ok) {
            const recData: EvidenceRecord = await recRes.json();
            setRecord(recData);
            setSelectedQuote(data.claims_accepted[0].quote);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load case");
      } finally {
        setLoading(false);
      }
    }

    loadCase();
  }, []);

  if (loading) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>Awakening investigation records...</p>
      </main>
    );
  }

  if (error || !currentCase) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h1>Investigation Unavailable</h1>
        <p style={{ color: "red" }}>{error || "Could not retrieve case records."}</p>
      </main>
    );
  }

  const statusMeta = formatOwnerStatus(currentCase.owner_status);

  return (
    <main
      style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}
    >
      <header>
        <span
          style={{
            fontSize: "0.85rem",
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "#666",
          }}
        >
          Demo Investigation Mode
        </span>
        <h1 style={{ margin: "0.5rem 0" }}>Keys of the Departed</h1>
        <p style={{ fontStyle: "italic", color: "#555" }}>
          The engineer left. Their access didn't.
        </p>
      </header>

      <section
        style={{
          margin: "2rem 0",
          padding: "1.5rem",
          border: "1px solid #ddd",
          borderRadius: "8px",
        }}
      >
        <h2>Account: {currentCase.account_id}</h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div>
            <strong>Ghost Classification: </strong>
            <span style={{ fontWeight: "bold", color: "#b23a48" }}>{currentCase.ghost_type}</span>
          </div>
          <div>
            <strong>Owner Status: </strong>
            <span aria-label={statusMeta.label}>
              {statusMeta.icon} {statusMeta.label}
            </span>
          </div>
        </div>
      </section>

      <section style={{ margin: "2rem 0" }}>
        <h3>Accepted Claims</h3>
        <ul>
          {currentCase.claims_accepted.map((claim, idx) => (
            <li
              key={idx}
              onClick={() => setSelectedQuote(claim.quote)}
              style={{
                cursor: "pointer",
                padding: "0.5rem",
                margin: "0.5rem 0",
                backgroundColor: selectedQuote === claim.quote ? "#f0ebe1" : "#fafafa",
                borderLeft: "4px solid #e07a5f",
              }}
            >
              <strong>[{claim.kind.toUpperCase()}]</strong> {claim.text}
              <div style={{ fontSize: "0.85rem", color: "#666" }}>Quote: "{claim.quote}"</div>
            </li>
          ))}
        </ul>
      </section>

      {record && (
        <section style={{ margin: "2rem 0" }}>
          <h3>Source Evidence Record: {record.record_id}</h3>
          <p style={{ fontSize: "0.85rem", color: "#666" }}>
            Type: {record.type} | Timestamp: {record.ts}
          </p>
          <SafeEvidenceDisplay content={record.content} quote={selectedQuote} />
        </section>
      )}
    </main>
  );
};
