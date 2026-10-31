import React from "react";

export const GuidedTourModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onNavigateCase: () => void;
}> = ({ isOpen, onClose, onNavigateCase }) => {
  const [step, setStep] = React.useState(1);

  if (!isOpen) return null;

  const tourSteps = [
    {
      title: "Step 1: The Machine Spirits in the Dark",
      lead: "When an engineer leaves an organization, their HR account closes. Their deploy keys, cron tokens, and CI bots often remain.",
      text: "Keys of the Departed acts as an investigative archivist. It parses raw tickets, git commits, and policy logs to reconstruct who created each key and why.",
      asset: "/goldenbook.png",
      tag: "THE CONCEPT",
    },
    {
      title: "Step 2: Choose a Machine Identity",
      lead: "Consider 'acc_deploy_key_881' (Legacy Deploy Key) in the LOST chamber.",
      text: "The key was provisioned 18 months ago with full repository write permissions. Did its creator depart? Are the audit logs silent or conflicting?",
      asset: "/glyph-lost.png",
      tag: "THE CASE",
    },
    {
      title: "Step 3: Follow the Evidence (Exact Quotes)",
      lead: "Gemma reads raw commits and tickets, proposing claims with exact substrings.",
      text: "Notice that every accepted claim links to a verifiable quotation in record rec_commit_4021: 'Signed-off-by: Carlos Mendez'. Deterministic code verifies this match character-for-character.",
      asset: "/candleon.png",
      tag: "DETERMINISTIC VERIFICATION",
    },
    {
      title: "Step 4: Inspect a Removed Claim (Reason R2)",
      lead: "Why was the claim 'safe to revoke immediately' rejected by the verifier?",
      text: "Ticket TICKET-1092 specifically states: 'Keep key active until rollback window closes next sprint.' The verifier removed the claim with code R2 (Quote Mismatch/Contradiction), keeping the rejection visible for human review.",
      asset: "/seal-broken.png",
      tag: "INTEGRITY & ABSTENTION",
    },
    {
      title: "Step 5: Human-in-the-Loop Revocation",
      lead: "No autonomous deletion. Sensitive actions require explicit human sign-off.",
      text: "An Auth0 CIBA approval dialog presents the reviewer with the account identity, exact supporting quotes, and the targeted sandbox repository. Only upon approval is a scoped token released.",
      asset: "/seal-verified.png",
      tag: "HUMAN SAFEGUARD",
    },
  ];

  const current = tourSteps[step - 1];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
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
          maxWidth: "680px",
          width: "100%",
          padding: "36px",
          border: "1px solid var(--gold)",
          boxShadow: "0 25px 80px rgba(0, 0, 0, 0.9)",
          position: "relative",
        }}
      >
        {/* Step indicator */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <span className="tag red">{current.tag}</span>
          <span className="mono" style={{ fontSize: "12px", color: "var(--gold2)" }}>
            STAGE {step} OF 5
          </span>
        </div>

        {/* Header & Graphic */}
        <div style={{ display: "flex", gap: "24px", alignItems: "center", margin: "20px 0" }}>
          <img
            src={current.asset}
            alt={current.title}
            style={{
              width: "90px",
              height: "90px",
              objectFit: "contain",
              filter: "drop-shadow(0 0 12px rgba(196,154,82,0.4))",
            }}
          />
          <div>
            <h2
              className="display"
              style={{ fontSize: "20px", color: "#f0dfbd", marginBottom: "8px" }}
            >
              {current.title}
            </h2>
            <p
              className="serif"
              style={{ fontSize: "16px", color: "#ecd6a8", margin: 0, fontStyle: "italic" }}
            >
              {current.lead}
            </p>
          </div>
        </div>

        <p style={{ fontSize: "13px", lineHeight: "1.7", color: "#c8b994", margin: "16px 0 24px" }}>
          {current.text}
        </p>

        {/* Progress Bar */}
        <div
          style={{
            height: "3px",
            background: "rgba(201,157,83,0.2)",
            borderRadius: "2px",
            margin: "20px 0 28px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(step / 5) * 100}%`,
              background: "linear-gradient(90deg, #c49a52, #f0d59a)",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onClose} className="btn ghost small">
            Exit Tour
          </button>
          <div style={{ display: "flex", gap: "10px" }}>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="btn secondary small">
                Back
              </button>
            )}
            {step < 5 ? (
              <button onClick={() => setStep(step + 1)} className="btn small">
                Continue →
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onNavigateCase();
                }}
                className="btn small"
                style={{
                  background: "linear-gradient(180deg, #2b7a42, #1b4d29)",
                  borderColor: "#4caf50",
                }}
              >
                Inspect Sample Case →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
