import React, { useState } from "react";

export const SetupPage: React.FC<{ onRouteChange: (route: string) => void }> = ({
  onRouteChange,
}) => {
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [profileText, setProfileText] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);

  const samplePrompt = `I am preparing an investigation profile for "Keys of the Departed" to help establish engineering ownership context for machines and deployment keys.

Please provide a concise, factual summary of the software projects, repositories, and machine identities I have created or maintained. Include:
1. Core systems, repositories, or services I was responsible for.
2. Deployment workflows, CI/CD pipelines, or automation accounts I authored.
3. Known nicknames, GitHub/GitLab handles, and commit email signatures.
4. Specific projects that were decommissioned, temporary, or handed over to other team members.

Rules for your response:
- Do not invent facts, passwords, or credentials.
- If certain ownership details are unknown or uncertain, explicitly state them as uncertain.
- Keep the summary strictly focused on engineering and access context.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(samplePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleUseDemoContext = () => {
    setProfileText(`[INVESTIGATOR CONTEXT SUMMARY]
Engineer: Carlos Mendez (Handles: cmendez, carlos-m, carlos.mendez@corp.internal)
Role: Senior Infrastructure & CI/CD Lead (2023 - 2025)
Managed Repositories: core-platform, staging-deploy-pipeline, auth-gateway
Known Machine Keys:
- Created 'acc_deploy_key_881' in April 2025 for nightly staging builds. Key was scheduled to expire after release v2.4 rollback window closed.
- Handed off repository management to platform team upon departure in July 2025.
Uncertainties:
- Did not configure automated TTL rotation on temporary incident hotfix keys.`);
  };

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "1000px", margin: "40px auto", padding: "0 24px" }}
    >
      {/* Editorial Header */}
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <img
          src="/hunter.png"
          alt="The Keeper"
          style={{
            width: "80px",
            height: "80px",
            objectFit: "contain",
            filter: "drop-shadow(0 0 16px rgba(196,154,82,0.4))",
            marginBottom: "12px",
          }}
        />
        <div className="eyebrow">STAGE 4 · ONBOARDING EXPERIENCE</div>
        <h1 className="serif" style={{ fontSize: "38px", color: "#f0dfbd", margin: "8px 0" }}>
          Let Your AI Speak For You
        </h1>
        <p
          className="serif"
          style={{
            fontSize: "18px",
            color: "#cdb78e",
            maxWidth: "620px",
            margin: "0 auto",
            fontStyle: "italic",
          }}
        >
          "An AI assistant carries memories of systems you built, keys you deployed, and
          repositories you left behind. Share that context voluntarily to guide the archive."
        </p>
      </div>

      {/* Step Navigation Pill */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "32px",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "16px",
        }}
      >
        {[
          { num: 1, label: "1. Welcome" },
          { num: 2, label: "2. Copy Prompt" },
          { num: 3, label: "3. Paste Response" },
          { num: 4, label: "4. Review & Confirm" },
        ].map((s) => (
          <button
            key={s.num}
            onClick={() => setStep(s.num)}
            className="btn ghost small"
            style={{
              color: step === s.num ? "var(--gold2)" : "var(--muted)",
              borderColor: step === s.num ? "var(--gold)" : "transparent",
              background: step === s.num ? "rgba(201,157,83,0.12)" : "transparent",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Step 1: Welcome & Safety Explanation */}
      {step === 1 && (
        <div className="panel" style={{ padding: "36px" }}>
          <h2
            className="display"
            style={{ fontSize: "22px", color: "var(--gold2)", marginBottom: "14px" }}
          >
            The Investigative Context Principle
          </h2>
          <p style={{ fontSize: "14px", lineHeight: "1.8", color: "#d0bd98" }}>
            Investigating abandoned machine access requires reconstructing intent. Rather than
            scanning private disk files or accessing unauthorized personal cloud accounts,{" "}
            <strong>Keys of the Departed</strong> allows investigators to voluntarily provide their
            own context summary.
          </p>
          <div
            style={{
              margin: "24px 0",
              padding: "16px",
              background: "rgba(109,23,27,0.25)",
              borderLeft: "4px solid var(--crimson2)",
              fontSize: "13px",
              color: "#f0b9ad",
            }}
          >
            <strong>Strict Privacy Boundary:</strong> Never paste passwords, private SSH keys, AWS
            credentials, or personal access tokens. The archive only requires high-level project
            names, handles, and role descriptions.
          </div>
          <div style={{ textAlign: "right", marginTop: "28px" }}>
            <button onClick={() => setStep(2)} className="btn">
              Proceed to Prompt Preparation →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Copy Preparation Prompt */}
      {step === 2 && (
        <div className="panel" style={{ padding: "36px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h2 className="display" style={{ fontSize: "20px", color: "var(--gold2)", margin: 0 }}>
              Step 2: Copy Prompt for Your AI
            </h2>
            <button
              onClick={handleCopy}
              className="btn small"
              style={{
                background: copied ? "linear-gradient(180deg, #2b7a42, #1b4d29)" : undefined,
              }}
            >
              {copied ? "✓ Copied to Clipboard!" : "Copy Prompt 📋"}
            </button>
          </div>
          <p className="serif" style={{ fontSize: "15px", color: "#b9a985" }}>
            Paste this instruction into your local Gemma, ChatGPT, or Claude assistant to generate a
            factual context summary.
          </p>
          <pre
            style={{
              padding: "20px",
              background: "rgba(13,11,10,0.9)",
              border: "1px solid var(--line)",
              borderRadius: "4px",
              color: "#e8d7b4",
              fontSize: "12px",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
              overflowX: "auto",
            }}
          >
            {samplePrompt}
          </pre>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
            <button onClick={() => setStep(1)} className="btn secondary small">
              ← Back
            </button>
            <button onClick={() => setStep(3)} className="btn small">
              I have my response, proceed →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Paste & Review Response */}
      {step === 3 && (
        <div className="panel" style={{ padding: "36px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <h2 className="display" style={{ fontSize: "20px", color: "var(--gold2)", margin: 0 }}>
              Step 3: Paste Reviewed AI Summary
            </h2>
            <button
              onClick={handleUseDemoContext}
              className="btn ghost small"
              style={{ fontSize: "10px" }}
            >
              Load Sample Context (Carlos Mendez)
            </button>
          </div>
          <p className="serif" style={{ fontSize: "15px", color: "#b9a985" }}>
            Verify that your assistant did not fabricate any credentials before saving.
          </p>

          <textarea
            value={profileText}
            onChange={(e) => setProfileText(e.target.value)}
            placeholder="Paste the factual summary generated by your AI assistant here..."
            rows={10}
            style={{
              width: "100%",
              padding: "16px",
              background: "rgba(13,11,10,0.9)",
              border: "1px solid var(--line)",
              borderRadius: "4px",
              color: "#f6e8c7",
              fontFamily: "var(--mono)",
              fontSize: "12px",
              lineHeight: "1.6",
              resize: "vertical",
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "12px",
            }}
          >
            <span className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
              Character Count: {profileText.length}
            </span>
            {profileText.length > 0 && (
              <button
                onClick={() => setProfileText("")}
                className="btn ghost small"
                style={{ fontSize: "10px" }}
              >
                Clear Text
              </button>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
            <button onClick={() => setStep(2)} className="btn secondary small">
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={profileText.trim().length === 0}
              className="btn small"
            >
              Review Context Preview →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review, Consent & Persist */}
      {step === 4 && (
        <div className="panel paper" style={{ padding: "36px" }}>
          <div className="eyebrow" style={{ color: "#77552e" }}>
            FINAL AUDIT LEDGER PREVIEW
          </div>
          <h2
            className="display"
            style={{ fontSize: "22px", color: "#251a11", margin: "8px 0 16px" }}
          >
            Investigator Profile Confirmation
          </h2>

          <div
            style={{
              background: "rgba(0,0,0,0.06)",
              padding: "18px",
              borderRadius: "4px",
              maxHeight: "260px",
              overflowY: "auto",
              fontFamily: "var(--mono)",
              fontSize: "12px",
              lineHeight: "1.6",
              color: "#301b13",
              border: "1px solid #a89470",
            }}
          >
            {profileText}
          </div>

          <div style={{ margin: "20px 0", display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <input
              type="checkbox"
              id="consent"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              style={{ marginTop: "4px", cursor: "pointer" }}
            />
            <label
              htmlFor="consent"
              style={{ fontSize: "13px", color: "#3a2517", cursor: "pointer" }}
            >
              I confirm this summary contains only factual, non-secret context and authorize its use
              in local demo correlation.
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
            <button onClick={() => setStep(3)} className="btn secondary small">
              ← Edit Response
            </button>
            <button
              onClick={() => onRouteChange("dashboard")}
              disabled={!consentGiven}
              className="btn"
              style={{
                background: "linear-gradient(180deg, #2b7a42, #1b4d29)",
                borderColor: "#4caf50",
              }}
            >
              Confirm & Enter Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
