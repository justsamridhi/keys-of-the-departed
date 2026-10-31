import React, { useState } from "react";

export interface FreeSpiritPageProps {
  onRouteChange: (route: string, params?: Record<string, string>) => void;
}

// ============================================================================
// Backward-compatible exports for Stage 3 Keeper's Ritual tests
// ============================================================================
export interface RitualStatement {
  id: number;
  title: string;
  statement: string;
  trait: string;
  symbol: string;
}

export const RITUAL_STATEMENTS: RitualStatement[] = [
  {
    id: 1,
    title: "Fragment I · The Hidden Corner",
    statement: "I like to explore new ideas and hidden corners before I have all the answers.",
    trait: "Curiosity",
    symbol: "✦",
  },
  {
    id: 2,
    title: "Fragment II · The Overlooked Timestamp",
    statement:
      "I often notice small discrepancies, timestamps, and commit signatures that others overlook.",
    trait: "Precision",
    symbol: "◈",
  },
  {
    id: 3,
    title: "Fragment III · The Independent Path",
    statement:
      "I prefer carving my own investigative path instead of relying on rigid, pre-cooked rules.",
    trait: "Independence",
    symbol: "▲",
  },
  {
    id: 4,
    title: "Fragment IV · The Human Story",
    statement: "I care about the human stories, intentions, and memories behind abandoned systems.",
    trait: "Empathy",
    symbol: "♥",
  },
  {
    id: 5,
    title: "Fragment V · The Patient Watch",
    statement: "I can sit comfortably with uncertainty while waiting for verifiable evidence.",
    trait: "Patience",
    symbol: "☽",
  },
];

export interface ArchetypeResult {
  title: string;
  subtitle: string;
  desc: string;
  asset: string;
  philosophy: string;
}

export function computeArchetype(selectedCount: number): ArchetypeResult {
  switch (selectedCount) {
    case 5:
      return {
        title: "Free Spirit",
        subtitle: "The Unshackled Inquirer",
        desc: "Unbound by rigid dogma, you balance radical empathy with uncompromising evidence verification. You give abandoned systems their historical dignity while refusing to assume what cannot be proven.",
        asset: "/heart-bleeding-gothic.png",
        philosophy: "The past deserves truth, not mere condemnation.",
      };
    case 4:
      return {
        title: "Unbound Archivist",
        subtitle: "The Independent Investigator",
        desc: "You follow evidence across forgotten repositories where standard rule engines fail. You treat each credential not as a generic vulnerability score, but as a human artifact waiting for an authentic provenance record.",
        asset: "/rose-crimson-gold.png",
        philosophy: "Every signature tells a story if one knows where to look.",
      };
    case 3:
      return {
        title: "Keeper of Small Wonders",
        subtitle: "The Chronicler of Forgotten Lore",
        desc: "You find depth in silent bots, legacy cron tokens, and forgotten commit messages. You assemble the fragmented pieces of engineering history until the full lineage becomes undeniably clear.",
        asset: "/goldenbook.png",
        philosophy: "No line of history is too small to be recorded.",
      };
    case 2:
      return {
        title: "Curious Wanderer",
        subtitle: "The Explorer of Shadow Repositories",
        desc: "Drawn by intuition and sharp pattern recognition, you wander through legacy codebases to uncover why systems were originally architected before passing final judgment.",
        asset: "/moon-waxing-crescent.png",
        philosophy: "Understanding begins before the first conclusion is drawn.",
      };
    case 1:
    case 0:
    default:
      return {
        title: "Quiet Observer",
        subtitle: "The Patient Guardian of the Crypt",
        desc: "A calm presence in the face of legacy silence. You observe without rushing to judgment, waiting for authentic commits and verified timestamps to reveal the true owner.",
        asset: "/candleon.png",
        philosophy: "Silence in the logs speaks louder than forced assumptions.",
      };
  }
}

// ============================================================================
// New Five-Question Interactive Free Spirit Experience
// ============================================================================
export interface FreeSpiritQuestion {
  id: number;
  question: string;
  subtitle: string;
  options: {
    label: string;
    description?: string;
  }[];
}

export const FREE_SPIRIT_QUESTIONS: FreeSpiritQuestion[] = [
  {
    id: 1,
    question: "What draws you to the unknown?",
    subtitle: "Every inquiry begins with an inner instinct.",
    options: [
      { label: "Discovering hidden patterns." },
      { label: "Solving difficult mysteries." },
      { label: "Protecting what others overlook." },
      { label: "Creating something new." },
    ],
  },
  {
    id: 2,
    question: "When evidence contradicts your expectations, what do you do?",
    subtitle: "Contradiction tests the investigator's discipline.",
    options: [
      { label: "Follow the evidence." },
      { label: "Investigate every contradiction." },
      { label: "Question the source." },
      { label: "Reconsider my assumptions." },
    ],
  },
  {
    id: 3,
    question: "What kind of investigator are you?",
    subtitle: "Your operational archetype within the machine sanctuary.",
    options: [
      {
        label: "The Archivist",
        description: "Preserves and connects records across time.",
      },
      {
        label: "The Seeker",
        description: "Follows unexplained trails through dark codebases.",
      },
      {
        label: "The Sentinel",
        description: "Watches over access, tokens, and cluster boundaries.",
      },
      {
        label: "The Alchemist",
        description: "Connects seemingly unrelated clues into coherent lineage.",
      },
    ],
  },
  {
    id: 4,
    question: "What would you never compromise?",
    subtitle: "The non-negotiable principle of your craft.",
    options: [
      { label: "Truth." },
      { label: "Privacy." },
      { label: "Accountability." },
      { label: "Curiosity." },
    ],
  },
  {
    id: 5,
    question: "Choose your guiding principle.",
    subtitle: "The maxim that steadies your hand in the dark.",
    options: [
      { label: "Trust, but verify." },
      { label: "Every key has a history." },
      { label: "Absence of evidence is not evidence of guilt." },
      { label: "Leave no unexplained access behind." },
    ],
  },
];

export interface InvestigatorIdentity {
  archetype: string;
  subtitle: string;
  description: string;
  guidingPrinciple: string;
  driver: string;
  analyticalStyle: string;
  coreValue: string;
  sealAsset: string;
}

export function synthesizeInvestigatorIdentity(
  answers: Record<number, number>,
): InvestigatorIdentity {
  const q1 =
    FREE_SPIRIT_QUESTIONS[0].options[answers[1] ?? 0]?.label ?? "Discovering hidden patterns.";
  const q2 = FREE_SPIRIT_QUESTIONS[1].options[answers[2] ?? 0]?.label ?? "Follow the evidence.";
  const q3Option = FREE_SPIRIT_QUESTIONS[2].options[answers[3] ?? 0];
  const q4 = FREE_SPIRIT_QUESTIONS[3].options[answers[4] ?? 0]?.label ?? "Truth.";
  const q5 = FREE_SPIRIT_QUESTIONS[4].options[answers[5] ?? 0]?.label ?? "Trust, but verify.";

  const baseArchetype = q3Option?.label ?? "The Sentinel";

  let archetype = baseArchetype;
  let subtitle = "Investigator of the Machine Sanctum";
  let sealAsset = "/seal-verified.png";

  if (baseArchetype === "The Archivist") {
    subtitle = "Preserver of Engineering Lineage & Artifacts";
    sealAsset = "/goldenbook.png";
  } else if (baseArchetype === "The Seeker") {
    subtitle = "Hunter of Obscured Trails & Forgotten Keys";
    sealAsset = "/rose-crimson-gold.png";
  } else if (baseArchetype === "The Sentinel") {
    subtitle = "Guardian of Access Boundaries & Crypt Keys";
    sealAsset = "/seal-verified.png";
  } else if (baseArchetype === "The Alchemist") {
    subtitle = "Synthesizer of Provenance & Code Clues";
    sealAsset = "/heart-bleeding-gothic.png";
  }

  // Elevate to Free Spirit if answers demonstrate holistic empathy + curiosity
  if (
    (q1 === "Protecting what others overlook." && q4 === "Privacy.") ||
    (q1 === "Creating something new." && q4 === "Curiosity.")
  ) {
    archetype = `Free Spirit ${baseArchetype.replace(/^The\s+/, "")}`;
    subtitle = "Unshackled Investigator of Machine Souls";
    sealAsset = "/heart-bleeding-gothic.png";
  }

  const description = `Drawn by ${q1.toLowerCase().replace(/\.$/, "")}, you approach conflicting records by choosing to ${q2.toLowerCase().replace(/\.$/, "")}. You stand uncompromising on ${q4.toLowerCase().replace(/\.$/, "")}, grounding every hypothesis in defensible engineering evidence without assuming malicious intent.`;

  return {
    archetype,
    subtitle,
    description,
    guidingPrinciple: q5,
    driver: q1,
    analyticalStyle: q2,
    coreValue: q4,
    sealAsset,
  };
}

export const FreeSpiritPage: React.FC<FreeSpiritPageProps> = ({ onRouteChange }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [saveCopied, setSaveCopied] = useState<boolean>(false);

  const activeQuestion = FREE_SPIRIT_QUESTIONS[currentStep];
  const selectedIndex = answers[activeQuestion?.id ?? 1];

  const handleSelectOption = (index: number) => {
    setAnswers((prev) => ({
      ...prev,
      [activeQuestion.id]: index,
    }));
  };

  const handleNext = () => {
    if (selectedIndex === undefined) return;
    if (currentStep < FREE_SPIRIT_QUESTIONS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentStep(0);
    setIsCompleted(false);
  };

  const identity = isCompleted ? synthesizeInvestigatorIdentity(answers) : null;

  const handleDownloadCard = () => {
    if (!identity) return;
    const content = `=====================================================
KEYS OF THE DEPARTED — INVESTIGATOR IDENTITY CARD
=====================================================
ARCHETYPE: ${identity.archetype.toUpperCase()}
TITLE: ${identity.subtitle}
GUIDING PRINCIPLE: "${identity.guidingPrinciple}"

INVESTIGATOR MANIFESTO:
${identity.description}

EVIDENCE & ATTITUDE PROFILE:
- Core Motivation: ${identity.driver}
- Handling Contradiction: ${identity.analyticalStyle}
- Non-Negotiable Boundary: ${identity.coreValue}

ISSUED AT: ${new Date().toISOString()}
SANCTUARY: Keys of the Departed Machine Identity Archive
=====================================================`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `investigator-card-${identity.archetype.toLowerCase().replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSaveCopied(true);
    setTimeout(() => setSaveCopied(false), 3000);
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        maxWidth: "960px",
        margin: "40px auto 100px",
        padding: "0 clamp(16px, 3vw, 32px)",
      }}
    >
      {/* 1. Header Section */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div
          className="eyebrow"
          style={{ color: "var(--gold)", letterSpacing: "0.2em", marginBottom: "8px" }}
        >
          ✦ THE INVESTIGATOR SANCTUARY ✦
        </div>
        <h1
          className="display"
          style={{
            fontSize: "clamp(28px, 4.5vw, 44px)",
            color: "#f7ebd2",
            margin: "0 0 14px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          ARE YOU A FREE SPIRIT?
        </h1>
        <p
          className="serif"
          style={{
            fontSize: "clamp(16px, 2vw, 19px)",
            color: "#c7b591",
            maxWidth: "680px",
            margin: "0 auto",
            lineHeight: 1.6,
            fontStyle: "italic",
          }}
        >
          &ldquo;Every investigator enters the archive with a different instinct. Some follow
          evidence. Some question everything. Some protect what others overlook. Discover the
          investigator within you.&rdquo;
        </p>
      </div>

      {!isCompleted ? (
        /* 2. Interactive Five-Question Flow */
        <div
          className="panel"
          style={{
            padding: "clamp(24px, 4vw, 44px)",
            border: "1px solid var(--line-strong)",
            background: "rgba(18, 15, 22, 0.96)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(197, 160, 89, 0.15)",
          }}
        >
          {/* Progress Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
              paddingBottom: "16px",
              borderBottom: "1px solid rgba(197, 160, 89, 0.2)",
            }}
          >
            <div style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--gold2)" }}>
              QUESTION {currentStep + 1} OF {FREE_SPIRIT_QUESTIONS.length}
            </div>

            {/* Visual Progress Bar */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              {FREE_SPIRIT_QUESTIONS.map((q, idx) => (
                <div
                  key={q.id}
                  style={{
                    width: idx === currentStep ? "28px" : "12px",
                    height: "6px",
                    borderRadius: "3px",
                    background:
                      idx < currentStep
                        ? "var(--gold)"
                        : idx === currentStep
                          ? "var(--crimson2)"
                          : "rgba(197, 160, 89, 0.2)",
                    transition: "all 0.3s ease",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Active Question Prompt */}
          <div style={{ marginBottom: "32px" }}>
            <h2
              className="display"
              id="question-title"
              style={{
                fontSize: "clamp(20px, 3vw, 26px)",
                color: "#f7ebd2",
                margin: "0 0 8px",
                fontWeight: 600,
              }}
            >
              {activeQuestion.question}
            </h2>
            <div
              className="serif"
              style={{ fontSize: "15px", color: "var(--gold2)", fontStyle: "italic" }}
            >
              {activeQuestion.subtitle}
            </div>
          </div>

          {/* Options Radiogroup */}
          <div
            role="radiogroup"
            aria-labelledby="question-title"
            style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "36px" }}
          >
            {activeQuestion.options.map((option, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={idx}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => handleSelectOption(idx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectOption(idx);
                    }
                  }}
                  id={`option-${currentStep + 1}-${idx}`}
                  style={{
                    padding: "16px 20px",
                    borderRadius: "4px",
                    border: isSelected
                      ? "1px solid var(--gold2)"
                      : "1px solid rgba(197, 160, 89, 0.25)",
                    background: isSelected
                      ? "linear-gradient(90deg, rgba(139, 30, 45, 0.4), rgba(28, 26, 31, 0.9))"
                      : "rgba(22, 19, 26, 0.7)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    transition: "all 0.2s ease",
                    boxShadow: isSelected ? "0 0 16px rgba(197, 160, 89, 0.3)" : "none",
                  }}
                >
                  {/* Custom Radio Ring */}
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      border: isSelected ? "2px solid var(--gold2)" : "2px solid #77552e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && (
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "var(--gold2)",
                        }}
                      />
                    )}
                  </div>

                  {/* Option Label and Subtitle */}
                  <div>
                    <div
                      style={{
                        color: isSelected ? "#fff" : "#e8d5b5",
                        fontSize: "15px",
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {option.label}
                    </div>
                    {option.description && (
                      <div
                        className="serif"
                        style={{
                          fontSize: "13.5px",
                          color: "#c7b591",
                          fontStyle: "italic",
                          marginTop: "2px",
                        }}
                      >
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            <button
              type="button"
              id="btn-prev-question"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="btn secondary small"
              style={{
                opacity: currentStep === 0 ? 0.3 : 1,
                cursor: currentStep === 0 ? "not-allowed" : "pointer",
              }}
            >
              ← Previous Question
            </button>

            <button
              type="button"
              id="btn-next-question"
              onClick={handleNext}
              disabled={selectedIndex === undefined}
              className="btn small"
              style={{
                background: "linear-gradient(180deg, #8b1e2d, #521019)",
                borderColor: "var(--gold)",
                boxShadow: "0 0 16px rgba(139, 30, 45, 0.4)",
                opacity: selectedIndex === undefined ? 0.4 : 1,
                cursor: selectedIndex === undefined ? "not-allowed" : "pointer",
              }}
            >
              {currentStep < FREE_SPIRIT_QUESTIONS.length - 1
                ? "Next Question →"
                : "Reveal Investigator Identity ✦"}
            </button>
          </div>
        </div>
      ) : (
        /* 3. The Generated Gothic Investigator Identity Card */
        identity && (
          <div
            className="animate-fade-in"
            style={{ display: "flex", flexDirection: "column", gap: "24px" }}
          >
            <div
              className="panel"
              id="investigator-identity-card"
              style={{
                padding: "clamp(30px, 5vw, 50px)",
                border: "2px solid var(--gold)",
                borderRadius: "8px",
                background: "linear-gradient(180deg, #18141d 0%, #0d0d11 100%)",
                boxShadow: "0 24px 70px rgba(0, 0, 0, 0.95), 0 0 40px rgba(197, 160, 89, 0.3)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Corner Ornaments */}
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  left: "14px",
                  color: "var(--gold)",
                  fontSize: "18px",
                }}
              >
                ✦
              </div>
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "14px",
                  color: "var(--gold)",
                  fontSize: "18px",
                }}
              >
                ✦
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: "12px",
                  left: "14px",
                  color: "var(--gold)",
                  fontSize: "18px",
                }}
              >
                ✦
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: "12px",
                  right: "14px",
                  color: "var(--gold)",
                  fontSize: "18px",
                }}
              >
                ✦
              </div>

              {/* Identity Header with Seal */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "24px",
                  marginBottom: "28px",
                  borderBottom: "1px solid rgba(197, 160, 89, 0.3)",
                  paddingBottom: "24px",
                  flexWrap: "wrap",
                }}
              >
                <img
                  src={identity.sealAsset}
                  alt={`${identity.archetype} Seal`}
                  id="identity-card-seal"
                  style={{
                    width: "74px",
                    height: "74px",
                    objectFit: "contain",
                    filter: "drop-shadow(0 0 16px rgba(197, 160, 89, 0.5))",
                  }}
                />
                <div>
                  <div
                    className="eyebrow"
                    style={{ color: "var(--gold)", letterSpacing: "0.18em", marginBottom: "4px" }}
                  >
                    SANCTUM DOSSIER · CONFIRMED ARCHETYPE
                  </div>
                  <h2
                    className="display"
                    id="identity-archetype-title"
                    style={{
                      fontSize: "clamp(24px, 4vw, 36px)",
                      color: "var(--cream)",
                      margin: "0 0 6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {identity.archetype}
                  </h2>
                  <div
                    className="serif"
                    style={{ fontSize: "16px", color: "var(--gold2)", fontStyle: "italic" }}
                  >
                    {identity.subtitle}
                  </div>
                </div>
              </div>

              {/* Guiding Principle Card */}
              <div
                style={{
                  padding: "16px 20px",
                  borderRadius: "4px",
                  background: "rgba(139, 30, 45, 0.2)",
                  border: "1px solid var(--crimson2)",
                  marginBottom: "24px",
                }}
              >
                <div
                  className="eyebrow"
                  style={{ color: "#f7b5a8", fontSize: "10.5px", marginBottom: "4px" }}
                >
                  GUIDING PRINCIPLE
                </div>
                <div
                  className="serif"
                  id="identity-guiding-principle"
                  style={{ fontSize: "19px", color: "#f7ebd2", fontStyle: "italic" }}
                >
                  &ldquo;{identity.guidingPrinciple}&rdquo;
                </div>
              </div>

              {/* Profile Narrative */}
              <p
                className="serif"
                id="identity-description-text"
                style={{
                  fontSize: "17px",
                  lineHeight: 1.7,
                  color: "#e8d5b5",
                  marginBottom: "28px",
                }}
              >
                {identity.description}
              </p>

              {/* Investigation Profile Badges */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                  padding: "18px",
                  background: "rgba(13, 11, 15, 0.75)",
                  borderRadius: "4px",
                  border: "1px solid rgba(197, 160, 89, 0.2)",
                  fontSize: "12.5px",
                }}
              >
                <div>
                  <span style={{ color: "var(--muted)", display: "block", marginBottom: "2px" }}>
                    Primary Driver:
                  </span>
                  <strong style={{ color: "var(--paper)" }}>{identity.driver}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)", display: "block", marginBottom: "2px" }}>
                    Analytical Stance:
                  </span>
                  <strong style={{ color: "var(--paper)" }}>{identity.analyticalStyle}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)", display: "block", marginBottom: "2px" }}>
                    Non-Negotiable:
                  </span>
                  <strong style={{ color: "var(--paper)" }}>{identity.coreValue}</strong>
                </div>
              </div>
            </div>

            {/* Actions Toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  id="btn-begin-investigation"
                  onClick={() => onRouteChange("new-investigation")}
                  className="btn"
                  style={{
                    background: "linear-gradient(180deg, #8b1e2d, #521019)",
                    borderColor: "var(--gold)",
                  }}
                >
                  ✦ Begin Investigation →
                </button>

                <button
                  type="button"
                  id="btn-return-archive"
                  onClick={() => onRouteChange("archive", { demo: "true" })}
                  className="btn secondary"
                >
                  Explore Demo Archive
                </button>

                <button
                  type="button"
                  id="btn-save-card"
                  onClick={handleDownloadCard}
                  className="btn ghost small"
                >
                  {saveCopied ? "✓ Dossier Downloaded" : "✦ Save Profile Card"}
                </button>
              </div>

              <button
                type="button"
                id="btn-retake"
                onClick={handleRetake}
                className="serif"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--gold2)",
                  cursor: "pointer",
                  fontSize: "13.5px",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                Retake Questioning
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
};
