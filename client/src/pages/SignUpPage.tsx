import React, { useState, useEffect } from "react";
import { validateEmail, validatePassword, sanitizeReturnUrl } from "./AuthPage.js";
import { useAuth } from "../auth/AuthProvider.js";

export interface SignUpPageProps {
  onRouteChange: (route: string, params?: Record<string, string>) => void;
  onOpenDemoModal?: () => void;
  initialReturnUrl?: string;
}

/**
 * Validates confirm passphrase matching.
 */
export function validateConfirmPassword(
  password: string,
  confirmPassword: string,
): { isValid: boolean; error?: string } {
  if (!confirmPassword) {
    return { isValid: false, error: "Please re-enter your passphrase to confirm." };
  }

  if (password !== confirmPassword) {
    return { isValid: false, error: "Passphrases do not match. Please verify both entries." };
  }

  return { isValid: true };
}

export const SignUpPage: React.FC<SignUpPageProps> = ({
  onRouteChange,
  onOpenDemoModal,
  initialReturnUrl,
}) => {
  const { loginWithRedirect, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [returnTarget, setReturnTarget] = useState<string>("landing");

  // Read returnUrl from window hash query parameters safely
  useEffect(() => {
    if (initialReturnUrl) {
      setReturnTarget(sanitizeReturnUrl(initialReturnUrl));
      return;
    }

    if (typeof window !== "undefined" && window.location.hash) {
      const queryIdx = window.location.hash.indexOf("?");
      if (queryIdx !== -1) {
        const search = window.location.hash.slice(queryIdx);
        const params = new URLSearchParams(search);
        const urlParam = params.get("returnUrl");
        if (urlParam) {
          setReturnTarget(sanitizeReturnUrl(urlParam));
        }
      }
    }
  }, [initialReturnUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Reset previous errors
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    setAuthError(null);

    if (isConfigured && loginWithRedirect) {
      setIsSubmitting(true);
      loginWithRedirect({
        authorizationParams: {
          screen_hint: "signup",
          login_hint: email.trim() || undefined,
        },
        appState: { returnTo: `#/${returnTarget}` },
      }).catch((err: unknown) => {
        setIsSubmitting(false);
        const msg =
          err instanceof Error
            ? err.message
            : "Investigator account registration service is currently unavailable.";
        setAuthError(msg);
      });
      return;
    }

    // 1. Fallback unconfigured client-side validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error || "Invalid email address");
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error || "Invalid passphrase");
    }

    const confirmValidation = validateConfirmPassword(password, confirmPassword);
    if (!confirmValidation.isValid) {
      setConfirmError(confirmValidation.error || "Passphrases do not match");
    }

    if (!emailValidation.isValid || !passwordValidation.isValid || !confirmValidation.isValid) {
      return;
    }

    // 2. Start provider submission check
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      // Honest, calm, non-technical feedback indicating authentication provider is unconfigured
      setAuthError(
        "Investigator account registration service is currently unavailable. Please enter via the Guest Investigator demo option below to examine the archive.",
      );
    }, 450);
  };

  const handleGuestDemoEntry = () => {
    setAuthError(null);
    if (onOpenDemoModal) {
      onOpenDemoModal();
    }
    onRouteChange(returnTarget === "landing" ? "landing" : returnTarget);
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: "calc(100vh - 86px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px clamp(16px, 4vw, 36px)",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Background Architectural Watermark */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(560px, 92vw)",
          height: "min(680px, 90vh)",
          backgroundImage: "url('/windowframe.png')",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          opacity: 0.08,
          pointerEvents: "none",
          filter: "drop-shadow(0 0 40px rgba(197, 160, 89, 0.2))",
        }}
      />

      <div
        className="panel"
        style={{
          maxWidth: "480px",
          width: "100%",
          padding: "clamp(28px, 5vw, 42px)",
          position: "relative",
          border: "1px solid var(--gold)",
          boxShadow: "0 25px 70px rgba(0, 0, 0, 0.85), 0 0 30px rgba(197, 160, 89, 0.15)",
          background:
            "linear-gradient(175deg, rgba(22, 19, 25, 0.98) 0%, rgba(13, 11, 15, 0.99) 100%)",
          zIndex: 2,
        }}
      >
        {/* Header Emblem & Title */}
        <div style={{ textAlign: "center", marginBottom: "26px" }}>
          <img
            src="/logo.png"
            alt="Keys of the Departed emblem"
            style={{
              width: "52px",
              height: "56px",
              objectFit: "contain",
              marginBottom: "12px",
              filter: "drop-shadow(0 0 12px rgba(197, 160, 89, 0.4))",
            }}
          />
          <div
            className="eyebrow"
            style={{ color: "var(--gold)", letterSpacing: "0.22em", marginBottom: "6px" }}
          >
            INVESTIGATOR ENROLLMENT
          </div>
          <h1
            className="display"
            style={{
              fontSize: "clamp(22px, 3.5vw, 28px)",
              color: "#f7ebd2",
              margin: "0 0 8px",
              letterSpacing: "0.05em",
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.8)",
            }}
          >
            Join the Archive
          </h1>
          <p
            className="serif"
            style={{
              fontSize: "15px",
              color: "#c7b591",
              margin: 0,
              fontStyle: "italic",
              lineHeight: 1.45,
            }}
          >
            Create your investigator identity to preserve evidence, examine forgotten machine
            identities, and maintain a traceable investigation history.
          </p>
        </div>

        {/* Error Alert Box */}
        {authError && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              background: "rgba(139, 30, 45, 0.22)",
              border: "1px solid var(--crimson2)",
              padding: "12px 14px",
              borderRadius: "3px",
              color: "#f6c3ba",
              fontSize: "12.5px",
              marginBottom: "20px",
              lineHeight: 1.5,
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <span style={{ color: "var(--crimson2)", fontSize: "16px", lineHeight: 1 }}>⚠</span>
            <div>{authError}</div>
          </div>
        )}

        {/* Sign Up Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
        >
          {/* Email / Investigator ID Field */}
          <div>
            <label
              htmlFor="signup-email"
              className="eyebrow"
              style={{
                display: "block",
                color: "#d9c7a2",
                fontSize: "10.5px",
                marginBottom: "6px",
              }}
            >
              INVESTIGATOR IDENTIFIER (EMAIL) <span style={{ color: "var(--crimson2)" }}>*</span>
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
                if (authError) setAuthError(null);
              }}
              disabled={isSubmitting}
              placeholder="investigator@archive.corp"
              aria-required="true"
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "signup-email-error" : undefined}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "rgba(13, 11, 15, 0.85)",
                border: emailError ? "1px solid var(--crimson2)" : "1px solid var(--line)",
                borderRadius: "3px",
                color: "#f6e8c7",
                fontFamily: "var(--mono)",
                fontSize: "13px",
                boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.6)",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
            />
            {emailError && (
              <div
                id="signup-email-error"
                role="alert"
                style={{
                  color: "#f09b93",
                  fontSize: "11.5px",
                  marginTop: "5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span>⚠</span> {emailError}
              </div>
            )}
          </div>

          {/* Passphrase Field */}
          <div>
            <label
              htmlFor="signup-password"
              className="eyebrow"
              style={{
                display: "block",
                color: "#d9c7a2",
                fontSize: "10.5px",
                marginBottom: "6px",
              }}
            >
              VAULT PASSPHRASE <span style={{ color: "var(--crimson2)" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="signup-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                  if (authError) setAuthError(null);
                  if (confirmPassword && confirmError) setConfirmError(null);
                }}
                disabled={isSubmitting}
                placeholder="Minimum 8 characters"
                aria-required="true"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? "signup-password-error" : undefined}
                style={{
                  width: "100%",
                  padding: "12px 60px 12px 14px",
                  background: "rgba(13, 11, 15, 0.85)",
                  border: passwordError ? "1px solid var(--crimson2)" : "1px solid var(--line)",
                  borderRadius: "3px",
                  color: "#f6e8c7",
                  fontFamily: "var(--mono)",
                  fontSize: "13px",
                  boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.6)",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                aria-label={showPassword ? "Hide passphrase" : "Show passphrase"}
                aria-pressed={showPassword}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(30, 26, 32, 0.8)",
                  border: "1px solid rgba(197, 160, 89, 0.3)",
                  borderRadius: "2px",
                  color: "var(--gold2)",
                  fontSize: "10px",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontFamily: "var(--mono)",
                  letterSpacing: "0.08em",
                }}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
            {passwordError && (
              <div
                id="signup-password-error"
                role="alert"
                style={{
                  color: "#f09b93",
                  fontSize: "11.5px",
                  marginTop: "5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span>⚠</span> {passwordError}
              </div>
            )}
          </div>

          {/* Confirm Passphrase Field */}
          <div>
            <label
              htmlFor="signup-confirm-password"
              className="eyebrow"
              style={{
                display: "block",
                color: "#d9c7a2",
                fontSize: "10.5px",
                marginBottom: "6px",
              }}
            >
              CONFIRM PASSPHRASE <span style={{ color: "var(--crimson2)" }}>*</span>
            </label>
            <input
              id="signup-confirm-password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmError) setConfirmError(null);
                if (authError) setAuthError(null);
              }}
              disabled={isSubmitting}
              placeholder="Re-enter your passphrase"
              aria-required="true"
              aria-invalid={Boolean(confirmError)}
              aria-describedby={confirmError ? "signup-confirm-error" : undefined}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "rgba(13, 11, 15, 0.85)",
                border: confirmError ? "1px solid var(--crimson2)" : "1px solid var(--line)",
                borderRadius: "3px",
                color: "#f6e8c7",
                fontFamily: "var(--mono)",
                fontSize: "13px",
                boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.6)",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
            />
            {confirmError && (
              <div
                id="signup-confirm-error"
                role="alert"
                style={{
                  color: "#f09b93",
                  fontSize: "11.5px",
                  marginTop: "5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span>⚠</span> {confirmError}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn"
            id="btn-signup-submit"
            style={{
              width: "100%",
              marginTop: "6px",
              padding: "13px 20px",
              fontSize: "11.5px",
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <span>✦</span> Enrolling Investigator...
              </span>
            ) : (
              "Create Investigator Account →"
            )}
          </button>
        </form>

        <div className="divider" style={{ margin: "20px 0 16px" }} />

        {/* Guest Demo Entry Callout */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={handleGuestDemoEntry}
            className="btn secondary"
            id="btn-signup-guest-demo"
            style={{
              width: "100%",
              padding: "11px 16px",
              fontSize: "11px",
              letterSpacing: "0.08em",
            }}
          >
            ✦ Enter as Guest Investigator (Demo Tour) →
          </button>
        </div>

        {/* Secondary Navigation Actions */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            textAlign: "center",
            fontSize: "12px",
            color: "var(--muted)",
          }}
        >
          <div>
            Already have an archive ledger?{" "}
            <button
              type="button"
              onClick={() => onRouteChange("auth")}
              id="link-nav-signin"
              style={{
                background: "none",
                border: "none",
                color: "var(--gold2)",
                cursor: "pointer",
                textDecoration: "underline",
                fontFamily: "var(--sans)",
                fontSize: "12px",
                padding: "2px 4px",
              }}
            >
              Sign in to vault archive →
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => onRouteChange("landing")}
              id="link-signup-return-archive"
              style={{
                background: "none",
                border: "none",
                color: "#c8b994",
                cursor: "pointer",
                fontFamily: "var(--display)",
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "4px 8px",
              }}
            >
              ← Return to Sanctuary Landing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
