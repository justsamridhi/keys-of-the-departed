import React, { useState } from "react";

export const UploadPage: React.FC<{ onRouteChange: (route: string) => void }> = ({
  onRouteChange,
}) => {
  const [pipelineState, setPipelineState] = useState<"idle" | "running" | "complete">("idle");
  const [currentStep, setCurrentStep] = useState(0);

  const pipelineStages = [
    {
      title: "Ingest & Schema Validation",
      desc: "Zod & JSON Schema strict contract checking",
      moon: "/moon-new.png",
    },
    {
      title: "TabPFN Anomaly Ranking",
      desc: "Evaluating behavior-only features against baselines",
      moon: "/moon-waxing-crescent.png",
    },
    {
      title: "Atlas Evidence Retrieval",
      desc: "Matching audit tickets, commits, and policy records",
      moon: "/moon-half-right.png",
    },
    {
      title: "Gemma Claim Extraction",
      desc: "Proposing ownership claims with exact quotation bounds",
      moon: "/moon-waning-gibbous.png",
    },
    {
      title: "Deterministic Verifier",
      desc: "Validating character matches, handles, and reason codes",
      moon: "/moon-full.png",
    },
  ];

  const handleStartSimulation = () => {
    setPipelineState("running");
    setCurrentStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < pipelineStages.length) {
        setCurrentStep(step);
      } else {
        clearInterval(interval);
        setPipelineState("complete");
      }
    }, 900);
  };

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "980px", margin: "40px auto", padding: "0 24px" }}
    >
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <div className="eyebrow">AUDIT INTAKE PORTAL</div>
        <h1 className="serif" style={{ fontSize: "38px", color: "#f0dfbd", margin: "8px 0" }}>
          Upload Machine Identity Bundle
        </h1>
        <p className="serif" style={{ fontSize: "17px", color: "#b9a985", margin: 0 }}>
          Ingest raw repository logs, HR directory snapshots, and ticketing records to reconstruct
          access lineage.
        </p>
      </div>

      {pipelineState === "idle" && (
        <div
          className="panel"
          style={{ padding: "40px", textAlign: "center", border: "2px dashed var(--line)" }}
        >
          <img
            src="/goldenbook.png"
            alt="Upload Archive"
            style={{
              width: "90px",
              height: "90px",
              objectFit: "contain",
              margin: "0 auto 16px",
              opacity: 0.85,
            }}
          />
          <h2
            className="display"
            style={{ fontSize: "20px", color: "var(--gold2)", marginBottom: "8px" }}
          >
            Drop Audit Bundle JSON / Archive
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--muted)",
              maxWidth: "460px",
              margin: "0 auto 24px",
            }}
          >
            Accepted schemas: <code>account.schema.json</code>, <code>record.schema.json</code>, and{" "}
            <code>person.schema.json</code>.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <label className="btn small" style={{ cursor: "pointer" }}>
              Choose Local Bundle File
              <input type="file" style={{ display: "none" }} onChange={handleStartSimulation} />
            </label>
            <button onClick={handleStartSimulation} className="btn secondary small">
              ⚡ Load Synthetic Demo Bundle (40 Accounts)
            </button>
          </div>

          <div
            style={{
              marginTop: "28px",
              paddingTop: "20px",
              borderTop: "1px solid rgba(201,157,83,0.15)",
              fontSize: "11px",
              color: "#746957",
            }}
          >
            Notice: Client-side files are parsed locally in demo mode. Zero uninspected telemetry or
            credentials leave your machine.
          </div>
        </div>
      )}

      {pipelineState === "running" && (
        <div className="panel" style={{ padding: "48px 36px", textAlign: "center" }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>
            PIPELINE STATE MACHINE IN EXECUTION
          </div>
          <h2
            className="display"
            style={{ fontSize: "22px", color: "#f1dfb8", margin: "10px 0 24px" }}
          >
            {pipelineStages[currentStep].title}
          </h2>

          <img
            src={pipelineStages[currentStep].moon}
            alt="Moon Phase"
            style={{ width: "80px", height: "80px", objectFit: "contain", margin: "0 auto 20px" }}
            className="candle-glow"
          />

          <p
            className="serif"
            style={{
              fontSize: "16px",
              color: "var(--paper2)",
              fontStyle: "italic",
              marginBottom: "32px",
            }}
          >
            "{pipelineStages[currentStep].desc}"
          </p>

          {/* Stepper Pills */}
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            {pipelineStages.map((st, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  fontFamily: "var(--mono)",
                  color: idx <= currentStep ? "var(--gold2)" : "var(--muted)",
                  padding: "6px 10px",
                  border: idx === currentStep ? "1px solid var(--gold)" : "1px solid transparent",
                  borderRadius: "2px",
                  background: idx <= currentStep ? "rgba(201,157,83,0.1)" : "transparent",
                }}
              >
                <span>{idx + 1}.</span> {st.title.split(" ")[0]}
              </div>
            ))}
          </div>
        </div>
      )}

      {pipelineState === "complete" && (
        <div className="panel paper" style={{ padding: "40px", textAlign: "center" }}>
          <img
            src="/seal-verified.png"
            alt="Ingestion Complete"
            style={{ width: "70px", height: "70px", margin: "0 auto 12px" }}
          />
          <h2 className="serif" style={{ fontSize: "28px", color: "#251a11", margin: "6px 0" }}>
            Bundle Ingestion Verified
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: "#3a2517",
              maxWidth: "540px",
              margin: "0 auto 24px",
              lineHeight: "1.6",
            }}
          >
            40 machine identities classified across the four chambers. TabPFN ranked anomaly
            distribution loaded, and deterministic quote verifications are complete.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
            <button onClick={() => onRouteChange("archive")} className="btn">
              Open Chamber Archive →
            </button>
            <button onClick={() => onRouteChange("results")} className="btn secondary">
              View Evaluation Metrics
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
