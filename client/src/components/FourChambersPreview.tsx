import React, { useState } from "react";

export interface FourChambersPreviewProps {
  onSelectChamber: (chamber: "LOST" | "FORGOTTEN" | "LONELY" | "INNOCENT") => void;
  title?: string;
  subtitle?: string;
}

export const CHAMBER_DEFINITIONS = [
  {
    name: "LOST" as const,
    glyph: "/glyph-lost.png",
    subtitle: "Departed Owner",
    color: "#c49a52",
    glowColor: "rgba(197, 160, 89, 0.6)",
    shortDescription: "Owner departed; active machine access remains unmanaged.",
  },
  {
    name: "FORGOTTEN" as const,
    glyph: "/glyph-forgotten.png",
    subtitle: "Missing Provenance",
    color: "#a52c30",
    glowColor: "rgba(165, 44, 48, 0.65)",
    shortDescription: "Zero human signatures or tickets found in historical audit logs.",
  },
  {
    name: "LONELY" as const,
    glyph: "/glyph-lonely.png",
    subtitle: "Dormant Privilege",
    color: "#d4a853",
    glowColor: "rgba(212, 168, 83, 0.6)",
    shortDescription: "Owner active, but key credentials dormant over 90 days.",
  },
  {
    name: "INNOCENT" as const,
    glyph: "/glyph-innocent.png",
    subtitle: "Unexpiring Hotfix",
    color: "#7e9272",
    glowColor: "rgba(126, 146, 114, 0.65)",
    shortDescription: "Emergency release key left active without automated expiration.",
  },
];

export const FourChambersPreview: React.FC<FourChambersPreviewProps> = ({
  onSelectChamber,
  title = "THE FOUR CHAMBERS",
  subtitle = "Every forgotten machine identity falls into one of four archetypal chambers.",
}) => {
  const [activeChamber, setActiveChamber] = useState<string | null>(null);

  return (
    <div style={{ width: "100%" }}>
      {(title || subtitle) && (
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          {title && (
            <div
              className="eyebrow"
              style={{ color: "var(--gold)", letterSpacing: "0.2em", marginBottom: "8px" }}
            >
              ✦ {title} ✦
            </div>
          )}
          {subtitle && (
            <p
              className="serif"
              style={{
                fontSize: "19px",
                color: "#c7b591",
                maxWidth: "600px",
                margin: "0 auto",
                fontStyle: "italic",
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Four evenly spaced illustrations directly against page background — NO CARDS */}
      <div className="chambers-direct-grid">
        {CHAMBER_DEFINITIONS.map((ch) => {
          const isHovered = activeChamber === ch.name;

          return (
            <div
              key={ch.name}
              role="button"
              tabIndex={0}
              id={`chamber-preview-${ch.name.toLowerCase()}`}
              aria-label={`Inspect ${ch.name} chamber: ${ch.subtitle}`}
              onClick={() => onSelectChamber(ch.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectChamber(ch.name);
                }
              }}
              onMouseEnter={() => setActiveChamber(ch.name)}
              onMouseLeave={() => setActiveChamber(null)}
              onFocus={() => setActiveChamber(ch.name)}
              onBlur={() => setActiveChamber(null)}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "16px 12px",
                transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Glyph Illustration */}
              <div
                style={{
                  position: "relative",
                  width: "104px",
                  height: "104px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "14px",
                }}
              >
                <img
                  src={ch.glyph}
                  alt={ch.name}
                  style={{
                    width: "96px",
                    height: "96px",
                    objectFit: "contain",
                    filter: isHovered
                      ? `drop-shadow(0 0 20px ${ch.glowColor}) drop-shadow(0 4px 12px rgba(0,0,0,0.8))`
                      : "drop-shadow(0 6px 14px rgba(0,0,0,0.75))",
                    transform: isHovered
                      ? "translateY(-6px) scale(1.06)"
                      : "translateY(0) scale(1)",
                    transition: "transform 0.3s ease, filter 0.3s ease",
                  }}
                />
              </div>

              {/* Small, Elegant Label */}
              <div
                className="display"
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: isHovered ? "var(--gold2)" : "#eedab8",
                  textTransform: "uppercase",
                  transition: "color 0.25s ease",
                  marginBottom: "4px",
                }}
              >
                {ch.name}
              </div>

              {/* Subtitle */}
              <div
                className="serif"
                style={{
                  fontSize: "13px",
                  color: isHovered ? ch.color : "var(--muted)",
                  fontStyle: "italic",
                  marginBottom: "8px",
                  transition: "color 0.25s ease",
                }}
              >
                {ch.subtitle}
              </div>

              {/* Short description revealed on interaction (hover/focus) */}
              <div
                style={{
                  fontSize: "12px",
                  lineHeight: 1.45,
                  color: "#dcd0b8",
                  maxWidth: "200px",
                  opacity: isHovered ? 1 : 0,
                  maxHeight: isHovered ? "60px" : "0px",
                  overflow: "hidden",
                  transition: "opacity 0.25s ease, max-height 0.25s ease",
                  pointerEvents: "none",
                }}
              >
                {ch.shortDescription}
              </div>

              <div
                style={{
                  fontSize: "10px",
                  fontFamily: "var(--mono)",
                  letterSpacing: "0.1em",
                  color: isHovered ? "var(--gold)" : "transparent",
                  marginTop: "6px",
                  transition: "color 0.2s ease",
                  textTransform: "uppercase",
                }}
              >
                Inspect Archive →
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .chambers-direct-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          max-width: 1040px;
          margin: 0 auto;
        }
        @media (max-width: 860px) {
          .chambers-direct-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
        }
        @media (max-width: 480px) {
          .chambers-direct-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
};
