import React from "react";

export const Footer: React.FC<{
  onRouteChange: (route: string, params?: Record<string, string>) => void;
}> = ({ onRouteChange }) => {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(201, 157, 83, 0.25)",
        background: "linear-gradient(180deg, rgba(13, 11, 10, 0.95), rgba(7, 6, 5, 1))",
        padding: "48px clamp(16px, 4vw, 60px) 36px",
        marginTop: "60px",
        color: "#a99b82",
      }}
    >
      <div
        style={{
          maxWidth: "1300px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "40px",
        }}
      >
        {/* Column 1: Altar identity */}
        <div>
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onRouteChange("landing");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "14px",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <img
              src="/logo.png"
              alt="Keys of the Departed emblem"
              style={{ width: "36px", height: "38px", objectFit: "contain" }}
            />
            <span
              className="display"
              style={{ fontSize: "15px", fontWeight: 700, color: "#f0d59a" }}
            >
              KEYS OF THE DEPARTED
            </span>
          </a>
          <p
            className="serif"
            style={{ fontSize: "15px", lineHeight: "1.55", color: "#c8b994", margin: 0 }}
          >
            An evidence-first investigation platform uncovering forgotten machine identities,
            abandoned service accounts, and lingering credentials through exact record citations and
            deterministic verification.
          </p>
        </div>

        {/* Column 2: Navigation */}
        <div>
          <div
            className="display"
            style={{ fontSize: "13px", fontWeight: 700, color: "#e8d7b4", marginBottom: "14px" }}
          >
            ARCHIVE CHAPTERS
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {[
              { label: "Chapter LOST (Owner Departed)", id: "archive", filter: "LOST" },
              { label: "Chapter FORGOTTEN (No Evidence)", id: "archive", filter: "FORGOTTEN" },
              { label: "Chapter LONELY (Owner Silent)", id: "archive", filter: "LONELY" },
              { label: "Chapter INNOCENT (Temporary)", id: "archive", filter: "INNOCENT" },
            ].map((link, idx) => (
              <li key={idx}>
                <button
                  onClick={() => onRouteChange(link.id, { filter: link.filter })}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#a99b82",
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#f0d59a")}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#a99b82")}
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: Trust & Safety */}
        <div>
          <div
            className="display"
            style={{ fontSize: "13px", fontWeight: 700, color: "#e8d7b4", marginBottom: "14px" }}
          >
            TRUST &amp; DISCLOSURE
          </div>
          <p style={{ fontSize: "12px", lineHeight: "1.6", color: "#8f826b", margin: 0 }}>
            All audit data displayed is synthetic and deterministic. Deterministic code verifies all
            extracted citations against source records before any fact is accepted. Zero sensitive
            actions occur without explicit human approval.
          </p>
          <div style={{ marginTop: "14px" }}>
            <button
              onClick={() => onRouteChange("safety")}
              className="btn ghost small"
              id="footer-btn-safety"
              style={{ fontSize: "10px" }}
            >
              Review Verification Rules →
            </button>
          </div>
        </div>
      </div>

      <div className="divider" style={{ margin: "36px auto 20px", maxWidth: "1300px" }} />

      <div
        style={{
          maxWidth: "1300px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "11px",
          fontFamily: "var(--mono)",
          color: "#746957",
        }}
      >
        <div>© 2026 Keys of the Departed · Evidence-First Machine Identity Investigation</div>
        <div style={{ display: "flex", gap: "16px" }}>
          <span>Día de los Muertos Altar Atmosphere</span>
          <span>Zero Telemetry</span>
          <span>Verifiable Provenance</span>
        </div>
      </div>
    </footer>
  );
};
