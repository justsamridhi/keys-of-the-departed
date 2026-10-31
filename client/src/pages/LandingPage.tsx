import React, { useState, useEffect, useRef } from "react";
import { FourChambersPreview } from "../components/FourChambersPreview.js";

export interface LandingPageProps {
  onRouteChange: (route: string, params?: Record<string, string>) => void;
  onOpenDemo: () => void;
}

export const HUNTER_DIALOGUE_LINES = [
  "The engineer is gone... but the keys remain.",
  "Every forgotten machine identity has a history.",
  "Some keys still open doors their owners have long since left behind.",
  "Tell me, investigator... are you a Free Spirit?",
  "The Golden Book holds your next destination.",
];
export const FULL_HUNTER_DIALOGUE = HUNTER_DIALOGUE_LINES.join("\n\n");

export const EMERGING_WORDS = [
  { text: "DEPLOY KEY", dx: -16, delay: 0 },
  { text: "SERVICE ACCOUNT", dx: 14, delay: 1.3 },
  { text: "RETAINED ACCESS", dx: -10, delay: 2.6 },
  { text: "AUTOMATION TOKEN", dx: 16, delay: 3.9 },
];

/**
 * Select the best available female-sounding English voice with graceful fallback.
 * Prioritizes English voices and recognizable female voice identifiers across platforms.
 */
export function selectBestFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const englishVoices = voices.filter(
    (v) => v.lang && v.lang.toLowerCase().replace(/_/g, "-").startsWith("en"),
  );
  const candidates = englishVoices.length > 0 ? englishVoices : voices;

  const femalePattern =
    /(female|woman|zira|jenny|aria|samantha|victoria|karen|fiona|moira|tessa|susan|catherine|hazel|eva|stephanie|sarah|allison|ava)/i;
  const femaleVoice = candidates.find(
    (v) => femalePattern.test(v.name) || femalePattern.test(v.voiceURI),
  );

  if (femaleVoice) return femaleVoice;

  return candidates[0] || null;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onRouteChange, onOpenDemo }) => {
  const [isHunterActive, setIsHunterActive] = useState<boolean>(false);
  const [typedDialogue, setTypedDialogue] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const hasTriggeredNarrationRef = useRef<boolean>(false);
  const typewriterTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor available speech synthesis voices
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices();
        if (available && available.length > 0) {
          setVoices(available);
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Stop speech on page unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (typewriterTimerRef.current) {
        clearInterval(typewriterTimerRef.current);
      }
    };
  }, []);

  const startHunterNarration = () => {
    if (hasTriggeredNarrationRef.current) return;
    hasTriggeredNarrationRef.current = true;
    setIsHunterActive(true);

    // Cancel any ongoing speech before starting new utterance
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Typewriter effect or instant reveal under reduced-motion
    if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
    if (prefersReducedMotion) {
      setTypedDialogue(FULL_HUNTER_DIALOGUE);
    } else {
      setTypedDialogue("");
      let charIndex = 0;
      typewriterTimerRef.current = setInterval(() => {
        charIndex += 2;
        if (charIndex >= FULL_HUNTER_DIALOGUE.length) {
          setTypedDialogue(FULL_HUNTER_DIALOGUE);
          if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
        } else {
          setTypedDialogue(FULL_HUNTER_DIALOGUE.slice(0, charIndex));
        }
      }, 25);
    }

    // Speech synthesis with female voice preference
    if (!isMuted && typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(FULL_HUNTER_DIALOGUE);
        const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
        const selectedVoice = selectBestFemaleVoice(availableVoices);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.rate = 0.9;
        utterance.pitch = 1.05;
        utterance.lang = selectedVoice?.lang || "en-US";
        window.speechSynthesis.speak(utterance);
      } catch {
        // Graceful silent fallback if SpeechSynthesis fails or hover audio is blocked
      }
    }
  };

  const restartHunterNarration = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    hasTriggeredNarrationRef.current = false;
    startHunterNarration();
  };

  const stopHunterNarration = () => {
    hasTriggeredNarrationRef.current = false;
    setIsHunterActive(false);
    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } else if (isHunterActive) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(FULL_HUNTER_DIALOGUE);
        const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
        const selectedVoice = selectBestFemaleVoice(availableVoices);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.rate = 0.9;
        utterance.pitch = 1.05;
        utterance.lang = selectedVoice?.lang || "en-US";
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const handleHunterClick = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    // Hunter is narrator only — replay narration, never navigate
    restartHunterNarration();
  };

  const handleBookClick = () => {
    stopHunterNarration();
    onRouteChange("spirit");
  };

  return (
    <div className="animate-fade-in" style={{ width: "100%", overflowX: "hidden" }}>
      {/* ============================================================== */}
      {/* 1. RESTORED VISUAL HERO: HUNTER, GOLDEN BOOK & GOTHIC DEPTH */}
      {/* ============================================================== */}
      <section
        className="hero-section"
        style={{
          position: "relative",
          minHeight: "calc(100vh - 86px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "40px clamp(20px, 5vw, 80px)",
          overflow: "visible",
          borderBottom: "1px solid var(--line)",
          background: "#0d0d11",
          gap: "clamp(24px, 4vw, 48px)",
        }}
      >
        {/* Architectural atmospheric background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(90deg, rgba(13,13,17,0.96) 0%, rgba(13,13,17,0.72) 48%, rgba(13,13,17,0.88) 100%), url('/landing.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center right",
            opacity: 0.92,
            zIndex: 1,
          }}
        />

        {/* Hero Left: Narrative & Call to Action (Uncluttered & Focused) */}
        <div
          className="hero-left"
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: "560px",
            flex: "1 1 480px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <img
              src="/logo.png"
              alt="Keys of the Departed emblem"
              style={{
                width: "36px",
                height: "40px",
                objectFit: "contain",
                filter: "drop-shadow(0 0 10px rgba(197, 160, 89, 0.4))",
              }}
            />
            <div
              className="eyebrow"
              style={{ color: "var(--gold)", letterSpacing: "0.18em", fontSize: "11px" }}
            >
              ✦ DÍA DE LOS MUERTOS MACHINE IDENTITY ARCHIVE ✦
            </div>
          </div>

          <h1 style={{ marginBottom: "16px", lineHeight: 1.08 }}>
            <span
              className="display"
              style={{
                display: "block",
                fontSize: "clamp(28px, 4vw, 50px)",
                fontWeight: 700,
                color: "#f7ebd2",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textShadow: "0 4px 30px rgba(0, 0, 0, 0.95), 0 0 20px rgba(197, 160, 89, 0.2)",
              }}
            >
              THE ENGINEER IS GONE.
            </span>
            <span
              className="serif"
              style={{
                display: "block",
                fontSize: "clamp(24px, 3.2vw, 38px)",
                fontWeight: 500,
                color: "var(--gold2)",
                fontStyle: "italic",
                letterSpacing: "0.02em",
                marginTop: "4px",
                textShadow: "0 2px 14px rgba(0, 0, 0, 0.8)",
              }}
            >
              The keys remain.
            </span>
          </h1>

          <p
            className="serif"
            style={{
              fontSize: "clamp(16px, 1.8vw, 19px)",
              lineHeight: 1.55,
              color: "#e8d5b5",
              marginBottom: "26px",
              maxWidth: "520px",
            }}
          >
            Investigate forgotten machine identities, stale deploy keys, CI/CD tokens, and orphaned
            automation accounts using uploaded engineering evidence.
          </p>

          {/* Clean CTA Hierarchy: Start Investigation vs Explore Synthetic Demo */}
          <div
            className="cta-row"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "14px",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <button
              type="button"
              id="cta-start-investigation"
              onClick={() => {
                stopHunterNarration();
                onRouteChange("new-investigation");
              }}
              className="btn"
              style={{
                padding: "14px 30px",
                fontSize: "12px",
                letterSpacing: "0.12em",
                background: "linear-gradient(180deg, #b02638, #69131f)",
                borderColor: "var(--gold2)",
                boxShadow: "0 0 24px rgba(197, 160, 89, 0.35)",
              }}
            >
              ✦ START AN INVESTIGATION <span>→</span>
            </button>

            <button
              type="button"
              id="cta-explore-demo"
              onClick={() => {
                stopHunterNarration();
                onRouteChange("archive", { demo: "true" });
              }}
              className="btn secondary"
              style={{
                padding: "14px 26px",
                fontSize: "12px",
                letterSpacing: "0.1em",
              }}
            >
              EXPLORE SYNTHETIC DEMO
            </button>
          </div>

          <button
            type="button"
            id="cta-guided-tour"
            onClick={() => {
              stopHunterNarration();
              onOpenDemo();
            }}
            className="serif"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--gold2)",
              fontSize: "13.5px",
              fontStyle: "italic",
              cursor: "pointer",
              padding: "4px 0",
              textDecoration: "underline",
              textUnderlineOffset: "4px",
              opacity: 0.9,
            }}
          >
            First time here? Take the guided demonstration tour ✦
          </button>

          {/* Clean Single-Line Trust Note */}
          <div
            style={{
              marginTop: "22px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "10.5px",
              fontFamily: "var(--mono)",
              color: "#9e917d",
              letterSpacing: "0.06em",
              maxWidth: "520px",
            }}
          >
            <span style={{ color: "var(--gold2)" }}>✦</span>
            <span>Zero Production Mutation · Grounded Citations · Deterministic Reason Codes</span>
          </div>
        </div>

        {/* Hero Right: Interactive Hunter Narrator & Golden Book Duo */}
        <div
          className="hero-art"
          style={{
            flex: "1 1 440px",
            maxWidth: "520px",
          }}
        >
          <div className="hero-duo-container">
            {/* 1. Central Interactive Focal Point: The Golden Book */}
            <div
              className="book-interactive-wrapper"
              id="interactive-book-trigger"
              tabIndex={0}
              role="button"
              aria-label="Open the Golden Book — Discover if you are a Free Spirit"
              onClick={handleBookClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleBookClick();
                }
              }}
            >
              {/* Contained Emerging Words from Book Pages */}
              <div className="emerging-words-container" id="book-emerging-words">
                {EMERGING_WORDS.map((w, idx) => (
                  <span
                    key={idx}
                    className="emerging-word"
                    style={{
                      ["--dx" as string]: `${w.dx}px`,
                      animationDelay: `${w.delay}s`,
                    }}
                  >
                    {w.text}
                  </span>
                ))}
              </div>

              <img
                src="/goldenbook.png"
                alt="The Golden Archive Ledger"
                className="hero-book"
                id="golden-book-image"
              />

              <span className="book-hover-label" id="book-hover-label">
                ✦ Open the Golden Book ✦
              </span>
            </div>

            {/* 2. Interactive Hunter (Narrator Only — Click Replays Narration) */}
            <div
              className="hunter-interactive-wrapper"
              id="interactive-hunter-trigger"
              tabIndex={0}
              role="button"
              aria-label="The Archive Narrator — Hover to reveal dialogue, click to replay narration"
              onMouseEnter={startHunterNarration}
              onFocus={startHunterNarration}
              onMouseLeave={stopHunterNarration}
              onBlur={stopHunterNarration}
              onClick={handleHunterClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleHunterClick();
                }
              }}
            >
              {isHunterActive && (
                <div
                  className="hunter-dialogue-panel animate-fade-in"
                  id="hunter-dialogue-box"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="hunter-dialogue-header">
                    <div className="eyebrow" style={{ color: "var(--gold)", fontSize: "10px" }}>
                      ✦ THE KEEPER&apos;S VOICE ✦
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <button
                        type="button"
                        id="hunter-replay-btn"
                        onClick={restartHunterNarration}
                        aria-label="Replay Hunter narration"
                        className="hunter-sound-btn"
                      >
                        ↺ REPLAY
                      </button>
                      <button
                        type="button"
                        id="hunter-sound-toggle"
                        onClick={toggleSound}
                        aria-label={isMuted ? "Unmute Hunter narration" : "Mute Hunter narration"}
                        className="hunter-sound-btn"
                      >
                        <span>{isMuted ? "🔇" : "🔊"}</span>
                        <span>{isMuted ? "MUTED" : "VOICE ON"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="hunter-dialogue-body" id="hunter-dialogue-text">
                    {typedDialogue}
                    {typedDialogue.length < FULL_HUNTER_DIALOGUE.length && (
                      <span style={{ animation: "pulse 0.8s infinite", color: "var(--gold)" }}>
                        |
                      </span>
                    )}
                  </div>

                  <div className="hunter-dialogue-footer">
                    <span>✦ ARCHIVE NARRATOR</span>
                    <span style={{ fontStyle: "italic", color: "#f7ebd2" }}>
                      Open the Golden Book to proceed →
                    </span>
                  </div>
                </div>
              )}

              <img
                src="/hunter.png"
                alt="The Archive Keeper holding a gilded ledger"
                className="hunter-art"
                id="hunter-character-image"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. HOW IT WORKS: INVESTIGATION WORKFLOW OVERVIEW               */}
      {/* ============================================================== */}
      <section
        style={{
          padding: "70px clamp(20px, 5vw, 80px)",
          background: "linear-gradient(180deg, #0d0d11 0%, #141117 100%)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "8px" }}>
              HOW THE INVESTIGATION ENGINE OPERATES
            </div>
            <h2
              className="display"
              style={{ fontSize: "28px", color: "var(--cream)", margin: "0 0 12px" }}
            >
              Traceable Machine Identity Provenance
            </h2>
            <p
              className="serif"
              style={{
                fontSize: "16.5px",
                color: "#c7b591",
                maxWidth: "680px",
                margin: "0 auto",
                fontStyle: "italic",
              }}
            >
              Absence of ownership evidence does not prove malice. We provide defensible,
              source-cited reconstruction to help security engineers make informed decisions.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "24px",
            }}
          >
            <div
              className="panel"
              style={{
                padding: "28px",
                borderTop: "3px solid var(--gold)",
                background: "rgba(20, 16, 22, 0.8)",
              }}
            >
              <div
                className="mono"
                style={{ fontSize: "11px", color: "var(--gold2)", marginBottom: "8px" }}
              >
                01 · INGEST STRUCTURED EVIDENCE
              </div>
              <h3
                className="display"
                style={{ fontSize: "18px", color: "var(--cream)", margin: "0 0 10px" }}
              >
                Engineering Records Intake
              </h3>
              <p style={{ fontSize: "13.5px", color: "#cdb78e", lineHeight: 1.6, margin: 0 }}>
                Upload machine identity inventories, IAM permissions, git commit histories,
                deployment logs, and engineering tickets in standard JSON or CSV.
              </p>
            </div>

            <div
              className="panel"
              style={{
                padding: "28px",
                borderTop: "3px solid var(--blue)",
                background: "rgba(20, 16, 22, 0.8)",
              }}
            >
              <div
                className="mono"
                style={{ fontSize: "11px", color: "var(--blue)", marginBottom: "8px" }}
              >
                02 · RECONSTRUCT OWNERSHIP & PURPOSE
              </div>
              <h3
                className="display"
                style={{ fontSize: "18px", color: "var(--cream)", margin: "0 0 10px" }}
              >
                Evidence-Grounded Extraction
              </h3>
              <p style={{ fontSize: "13.5px", color: "#cdb78e", lineHeight: 1.6, margin: 0 }}>
                Extract ownership hypotheses and operational context citing exact verbatim
                substrings from commits, PRs, and infrastructure tickets.
              </p>
            </div>

            <div
              className="panel"
              style={{
                padding: "28px",
                borderTop: "3px solid var(--crimson2)",
                background: "rgba(20, 16, 22, 0.8)",
              }}
            >
              <div
                className="mono"
                style={{ fontSize: "11px", color: "var(--crimson2)", marginBottom: "8px" }}
              >
                03 · DETERMINISTIC VERIFICATION
              </div>
              <h3
                className="display"
                style={{ fontSize: "18px", color: "var(--cream)", margin: "0 0 10px" }}
              >
                Defensible Verification Rules
              </h3>
              <p style={{ fontSize: "13.5px", color: "#cdb78e", lineHeight: 1.6, margin: 0 }}>
                Reject ungrounded AI claims using reason codes R1–R5. No automated production
                revocation: human approval remains the ultimate decision gate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. FOUR CHAMBERS: GOVERNANCE TAXONOMY                          */}
      {/* ============================================================== */}
      <section
        style={{
          padding: "70px clamp(20px, 5vw, 80px)",
          background: "#0d0d11",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <FourChambersPreview
            onSelectChamber={(chamber) =>
              onRouteChange("archive", { filter: chamber, demo: "true" })
            }
            title="FOUR GOVERNANCE CHAMBERS"
            subtitle="Hover or focus any chamber illustration to inspect its classification criteria. Click to review chamber records in the demonstration archive."
          />
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. CALL TO ACTION                                              */}
      {/* ============================================================== */}
      <section
        style={{
          padding: "75px clamp(20px, 5vw, 80px)",
          textAlign: "center",
          background: "linear-gradient(180deg, #141117 0%, #0d0d11 100%)",
        }}
      >
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "12px" }}>
            START SECURING MACHINE IDENTITIES
          </div>
          <h2
            className="display"
            style={{ fontSize: "30px", color: "var(--cream)", margin: "0 0 16px" }}
          >
            Ready to Investigate Your Machine Identities?
          </h2>
          <p
            className="serif"
            style={{
              fontSize: "17px",
              color: "#c7b591",
              fontStyle: "italic",
              marginBottom: "32px",
              lineHeight: 1.55,
            }}
          >
            Initiate a new investigation with your organization&apos;s audit records, or explore the
            pre-loaded synthetic demonstration dataset.
          </p>

          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              id="cta-bottom-start-investigation"
              onClick={() => onRouteChange("new-investigation")}
              className="btn"
              style={{
                padding: "15px 34px",
                background: "linear-gradient(180deg, #b02638, #69131f)",
                borderColor: "var(--gold2)",
              }}
            >
              Start an Investigation →
            </button>
            <button
              type="button"
              id="cta-bottom-explore-demo"
              onClick={() => onRouteChange("archive", { demo: "true" })}
              className="btn secondary"
              style={{ padding: "15px 28px" }}
            >
              Explore Synthetic Demo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
