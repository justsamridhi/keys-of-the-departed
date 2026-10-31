import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthProvider.js";

export interface AuthPageProps {
  onRouteChange: (route: string, params?: Record<string, string>) => void;
  onOpenDemoModal?: () => void;
  initialReturnUrl?: string;
}

/** Whitelist of legitimate safe application routes */
const SAFE_INTERNAL_ROUTES = new Set([
  "landing",
  "archive",
  "dashboard",
  "cases",
  "upload",
  "integrations",
  "setup",
  "spirit",
  "about",
]);

/**
 * Sanitizes return URLs to completely prevent open redirect vulnerabilities.
 * Never allows external schemes, protocol-relative URLs, or script injection.
 */
export function sanitizeReturnUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "landing";
  const trimmed = url.trim();

  // Explicitly disallow dangerous schemes, protocol-relative urls, or traversal
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.includes("..")
  ) {
    return "landing";
  }

  // Strip leading slash or hash
  const cleanRoute =
    trimmed
      .replace(/^[#/]+/, "")
      .split("?")[0]
      ?.split("/")[0] || "";

  if (SAFE_INTERNAL_ROUTES.has(cleanRoute)) {
    return cleanRoute;
  }

  // Allow case demo IDs e.g. case_demo_01
  if (/^case_[a-zA-Z0-9_-]+$/.test(cleanRoute)) {
    return cleanRoute;
  }

  return "landing";
}

/**
 * Validates investigator email according to RFC 5321 length and syntax rules.
 */
export function validateEmail(email: string): {
  isValid: boolean;
  error?: string;
  sanitized: string;
} {
  const trimmed = email.trim();

  if (!trimmed) {
    return { isValid: false, error: "Investigator identifier / email is required.", sanitized: "" };
  }

  if (trimmed.length > 254) {
    return {
      isValid: false,
      error: "Email address exceeds the maximum length of 254 characters.",
      sanitized: trimmed,
    };
  }

  // Standard RFC-compatible pattern: user@domain.tld with support for tags and dots
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Please provide a valid email format (e.g. investigator@archive.corp).",
      sanitized: trimmed,
    };
  }

  return { isValid: true, sanitized: trimmed };
}

/**
 * Validates passphrase against baseline identity provider constraints.
 */
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password) {
    return { isValid: false, error: "Passphrase is required to authenticate vault access." };
  }

  if (password.length < 8) {
    return { isValid: false, error: "Passphrase must contain at least 8 characters." };
  }

  if (password.length > 128) {
    return {
      isValid: false,
      error: "Passphrase exceeds the maximum permitted length of 128 characters.",
    };
  }

  return { isValid: true };
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onRouteChange,
  onOpenDemoModal,
  initialReturnUrl,
}) => {
  const { loginWithRedirect, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
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

    // Reset previous feedback
    setEmailError(null);
    setPasswordError(null);
    setAuthError(null);

    if (isConfigured && loginWithRedirect) {
      setIsSubmitting(true);
      loginWithRedirect({
        authorizationParams: {
          login_hint: email.trim() || undefined,
        },
        appState: { returnTo: `#/${returnTarget}` },
      }).catch((err: unknown) => {
        setIsSubmitting(false);
        const msg =
          err instanceof Error ? err.message : "Authentication service is currently unavailable.";
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

    if (!emailValidation.isValid || !passwordValidation.isValid) {
      return;
    }

    // 2. Start simulated provider query when unconfigured
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      // Honest, calm, non-technical feedback
      setAuthError(
        "Authentication service is currently unavailable. Please enter via the Guest Investigator demo option below to examine the archive.",
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
          maxWidth: "460px",
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
            INVESTIGATOR VAULT
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
            Enter the Archive
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
            Access the investigation vault to examine evidence and trace machine identities.
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

        {/* Sign In Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
        >
          {/* Email / Investigator ID Field */}
          <div>
            <label
              htmlFor="signin-email"
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
              id="signin-email"
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
              aria-describedby={emailError ? "email-error" : undefined}
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
                id="email-error"
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
              htmlFor="signin-password"
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
                id="signin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                  if (authError) setAuthError(null);
                }}
                disabled={isSubmitting}
                placeholder="••••••••••••"
                aria-required="true"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? "password-error" : undefined}
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
                id="password-error"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn"
            id="btn-signin-submit"
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
                <span>✦</span> Verifying Credentials...
              </span>
            ) : (
              "Sign In to Vault Archive →"
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
            id="btn-guest-demo-entry"
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
            First time in the archive?{" "}
            <button
              type="button"
              onClick={() => onRouteChange("signup")}
              id="link-nav-signup"
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
              Create an investigator account →
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => onRouteChange("landing")}
              id="link-return-archive"
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
