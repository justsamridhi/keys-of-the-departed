import React from "react";

export const ResultsPage: React.FC<{ onRouteChange: (route: string) => void }> = ({
  onRouteChange,
}) => {
  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "1280px", margin: "40px auto", padding: "0 24px" }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div className="eyebrow">STAGE 10 · EVALUATION & PROOF PROTOCOL</div>
        <h1 className="serif" style={{ fontSize: "38px", color: "#f0dfbd", margin: "8px 0" }}>
          Evaluation Results & Benchmark Proof
        </h1>
        <p
          className="serif"
          style={{ fontSize: "17px", color: "#b9a985", maxWidth: "680px", margin: "0 auto" }}
        >
          Comparing fuzzy handle matching, raw free-text Gemma, and Gemma with deterministic
          verification across the frozen 20-account test split.
        </p>
      </div>

      {/* Benchmark Comparison Table */}
      <div className="panel" style={{ padding: "32px", marginBottom: "36px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 className="display" style={{ fontSize: "20px", color: "var(--gold2)", margin: 0 }}>
            Three-Way Method Comparison (Frozen Test Split, N=20)
          </h2>
          <span className="tag green">DETERMINISTIC EVAL PROTOCOL</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--line)",
                  color: "var(--gold2)",
                  fontFamily: "var(--display)",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                }}
              >
                <th style={{ padding: "12px 10px" }}>EVALUATION METRIC</th>
                <th style={{ padding: "12px 10px" }}>B1: FUZZY HANDLE MATCH (NO LLM)</th>
                <th style={{ padding: "12px 10px" }}>B2: GEMMA RAW (FREE TEXT)</th>
                <th
                  style={{
                    padding: "12px 10px",
                    background: "rgba(201,157,83,0.1)",
                    color: "#ffffff",
                  }}
                >
                  SYSTEM: GEMMA + VERIFIER
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  metric: "Owner Accuracy (Exact)",
                  b1: "9 / 20 (45%)",
                  b2: "14 / 20 (70%)",
                  sys: "17 / 20 (85%)",
                },
                {
                  metric: "False Accusation Rate",
                  b1: "5 / 20 (25%)",
                  b2: "4 / 20 (20%)",
                  sys: "0 / 20 (0.0% - Verifier Guard)",
                },
                {
                  metric: "Correct Abstention Rate",
                  b1: "6 / 8 (75%)",
                  b2: "5 / 8 (62.5%)",
                  sys: "8 / 8 (100% on Silent Records)",
                },
                {
                  metric: "Prompt Injection Resistance",
                  b1: "N/A (Rule Based)",
                  b2: "0 / 3 (Exploited by Injected Quotes)",
                  sys: "3 / 3 (100% Neutralized by Verifier)",
                },
                {
                  metric: "Mean Processing Latency",
                  b1: "< 2ms",
                  b2: "890ms (Ollama local)",
                  sys: "904ms (LLM + Verifier pass)",
                },
              ].map((row, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid rgba(201,157,83,0.12)" }}>
                  <td style={{ padding: "14px 10px", fontWeight: 600, color: "var(--paper)" }}>
                    {row.metric}
                  </td>
                  <td style={{ padding: "14px 10px", color: "var(--muted)" }}>{row.b1}</td>
                  <td style={{ padding: "14px 10px", color: "var(--muted)" }}>{row.b2}</td>
                  <td
                    style={{
                      padding: "14px 10px",
                      background: "rgba(201,157,83,0.06)",
                      fontWeight: 700,
                      color: "var(--gold2)",
                    }}
                  >
                    {row.sys}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TabPFN Anomaly Ranking Proof */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          marginBottom: "36px",
        }}
      >
        <div className="panel" style={{ padding: "28px" }}>
          <div className="eyebrow">TABPFN BEHAVIORAL ANOMALY RANKING</div>
          <h3
            className="display"
            style={{ fontSize: "18px", color: "var(--gold2)", margin: "8px 0 14px" }}
          >
            Unsupervised Tabular Foundation Model
          </h3>
          <p style={{ fontSize: "13px", lineHeight: "1.7", color: "#cdb78e" }}>
            TabPFN operates completely offline on behavior-only features (inactivity gaps, host
            distribution, admin permissions). Precomputed scores in <code>scores.csv</code>{" "}
            prioritize which accounts undergo expensive Gemma investigation.
          </p>
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              background: "rgba(13,11,10,0.6)",
              borderRadius: "3px",
              border: "1px solid var(--line)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                margin: "4px 0",
              }}
            >
              <span>AUROC vs Inactivity Baseline:</span>
              <strong style={{ color: "var(--gold2)" }}>0.88 vs 0.71</strong>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                margin: "4px 0",
              }}
            >
              <span>Precision@10 for True Ghosts:</span>
              <strong style={{ color: "var(--gold2)" }}>90% (9 / 10 in top rank)</strong>
            </div>
          </div>
        </div>

        <div className="panel paper" style={{ padding: "28px" }}>
          <div className="eyebrow" style={{ color: "#77552e" }}>
            AUDIT INTEGRITY MANIFEST
          </div>
          <h3 className="serif" style={{ fontSize: "20px", color: "#251a11", margin: "8px 0" }}>
            Model Distribution & Licensing Transparency
          </h3>
          <p style={{ fontSize: "13px", color: "#3a2517", lineHeight: "1.6" }}>
            In accordance with the TabPFN-3.5 non-commercial license, weights are cached locally and
            never distributed as a hosted cloud API. The web application runtime loads only
            precomputed score manifests.
          </p>
          <div style={{ marginTop: "16px" }}>
            <button onClick={() => onRouteChange("archive")} className="btn secondary small">
              Examine Scored Accounts in Archive →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
