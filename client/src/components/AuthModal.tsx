import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthProvider.js";

export interface AuthModalProps {
  isOpen: boolean;
  initialMode?: "signin" | "signup";
  onClose: () => void;
  onSuccess: (user?: { email: string; name: string }) => void;
}

export interface Auth0RedirectParams {
  authorizationParams: {
    screen_hint?: string;
    login_hint?: string;
  };
  appState: {
    returnTo: string;
  };
}

export function buildAuth0ModalRedirectParams(
  targetMode: "signin" | "signup",
  email?: string,
  returnTo?: string,
): Auth0RedirectParams {
  return {
    authorizationParams: {
      screen_hint: targetMode === "signup" ? "signup" : undefined,
      login_hint: email?.trim() || undefined,
    },
    appState: {
      returnTo: returnTo || "#/",
    },
  };
}

export async function executeAuthModalSubmit({
  isConfigured,
  loginWithRedirect,
  mode,
  email,
  onSuccess,
  onClose,
  returnTo = "#/",
}: {
  isConfigured: boolean;
  loginWithRedirect?: (params: Auth0RedirectParams) => Promise<void>;
  mode: "signin" | "signup";
  email: string;
  onSuccess: (user?: { email: string; name: string }) => void;
  onClose: () => void;
  returnTo?: string;
}) {
  if (isConfigured && loginWithRedirect) {
    const params = buildAuth0ModalRedirectParams(mode, email, returnTo);
    return await loginWithRedirect(params);
  }

  onSuccess({
    email: email.trim() || "guest.auditor@sanctuary.internal",
    name: "Guest Auditor",
  });
  onClose();
}

export function executeGuestDemoEntry(
  onSuccess: (user?: { email: string; name: string }) => void,
  onClose: () => void,
) {
  onSuccess({ email: "guest.auditor@sanctuary.internal", name: "Guest Auditor" });
  onClose();
}

export async function executeRegisterTabClick({
  isConfigured,
  loginWithRedirect,
  email,
  returnTo = "#/",
}: {
  isConfigured: boolean;
  loginWithRedirect?: (params: Auth0RedirectParams) => Promise<void>;
  email?: string;
  returnTo?: string;
}) {
  if (isConfigured && loginWithRedirect) {
    const params = buildAuth0ModalRedirectParams("signup", email, returnTo);
    return await loginWithRedirect(params);
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = "signin",
  onClose,
  onSuccess,
}) => {
  const { loginWithRedirect, isConfigured } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ general?: string }>({});

  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setErrors({});
  }, [initialMode, isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getSafeReturnTo = () => {
    return typeof window !== "undefined" && window.location?.hash ? window.location.hash : "#/";
  };

  const handleAuth0Login = (targetMode: "signin" | "signup" = mode) => {
    if (loginWithRedirect) {
      setLoading(true);
      const params = buildAuth0ModalRedirectParams(targetMode, email, getSafeReturnTo());
      loginWithRedirect(params).catch((err: unknown) => {
        setLoading(false);
        const msg = err instanceof Error ? err.message : "Failed to initiate Auth0 login";
        setErrors({ general: msg });
      });
      return;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfigured) {
      handleAuth0Login(mode);
      return;
    }

    // Unconfigured demo mode fallback
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess({
        email: email.trim() || "guest.auditor@sanctuary.internal",
        name: "Guest Auditor",
      });
      onClose();
    }, 200);
  };

  const handleDemoGuestEntry = () => {
    executeGuestDemoEntry(onSuccess, onClose);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(8, 8, 12, 0.88)",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="panel animate-fade-in"
        style={{
          maxWidth: "480px",
          width: "100%",
          padding: "36px",
          border: "1px solid var(--gold)",
          backgroundImage:
            "linear-gradient(145deg, rgba(32, 26, 33, 0.98), rgba(16, 14, 18, 0.99))",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(197, 160, 89, 0.2)",
          position: "relative",
        }}
      >
        {/* Dismiss Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close authentication modal"
          id="btn-close-auth-modal"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "#a99b82",
            fontSize: "20px",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          ✕
        </button>

        {/* Altar Emblem Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <img
            src="/logo.png"
            alt="Keys of the Departed emblem"
            style={{ width: "48px", height: "52px", objectFit: "contain", margin: "0 auto 12px" }}
          />
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "4px" }}>
            SANCTUARY ACCESS
          </div>
          <h2
            id="auth-modal-title"
            className="display"
            style={{ fontSize: "22px", color: "var(--cream)", margin: 0 }}
          >
            {mode === "signin" ? "Investigator Sign In" : "Register Sanctuary Account"}
          </h2>
        </div>

        {/* Tab Toggle: Sign In vs Sign Up */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--line)",
            marginBottom: "24px",
          }}
        >
          <button
            type="button"
            id="tab-auth-signin"
            onClick={() => {
              setMode("signin");
              setErrors({});
            }}
            className="display"
            style={{
              flex: 1,
              padding: "10px",
              background: "transparent",
              border: "none",
              borderBottom: mode === "signin" ? "2px solid var(--gold2)" : "2px solid transparent",
              color: mode === "signin" ? "var(--gold2)" : "#a99b82",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            id="tab-auth-signup"
            onClick={() => {
              setMode("signup");
              setErrors({});
              if (isConfigured) {
                handleAuth0Login("signup");
              }
            }}
            className="display"
            style={{
              flex: 1,
              padding: "10px",
              background: "transparent",
              border: "none",
              borderBottom: mode === "signup" ? "2px solid var(--gold2)" : "2px solid transparent",
              color: mode === "signup" ? "var(--gold2)" : "#a99b82",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Register
          </button>
        </div>

        {/* Auth0 Notice */}
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(197, 160, 89, 0.12)",
            borderLeft: "3px solid var(--gold)",
            fontSize: "11.5px",
            color: "#ebd6b0",
            marginBottom: "20px",
            lineHeight: 1.45,
          }}
        >
          {isConfigured ? (
            <>
              <strong>Auth0 Universal Login (PKCE):</strong> Credentials and session security are
              handled on Auth0. Click below to authenticate or continue as a demo guest.
            </>
          ) : (
            <>
              <strong>Auth0 Integration:</strong> Sandbox Demo Mode active. Enter directly as guest
              investigator.
            </>
          )}
        </div>

        {errors.general && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              background: "rgba(139, 30, 45, 0.22)",
              border: "1px solid var(--crimson2)",
              color: "#f6c3ba",
              fontSize: "12px",
              marginBottom: "16px",
              borderRadius: "3px",
            }}
          >
            {errors.general}
          </div>
        )}

        {/* Authentication Action Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: "20px" }}>
            <label
              htmlFor="auth-email"
              style={{
                display: "block",
                fontFamily: "var(--display)",
                fontSize: "10.5px",
                letterSpacing: "0.08em",
                color: "var(--gold2)",
                marginBottom: "6px",
              }}
            >
              EMAIL ADDRESS (OPTIONAL PREFILL)
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="investigator@enterprise.corp"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(10, 8, 12, 0.8)",
                border: "1px solid rgba(197, 160, 89, 0.4)",
                color: "#f7ebd2",
                borderRadius: "3px",
                fontSize: "13.5px",
              }}
            />
          </div>

          <button
            type="submit"
            id="btn-auth-submit"
            disabled={loading}
            className="btn"
            style={{ width: "100%", padding: "12px", marginBottom: "12px" }}
          >
            {loading
              ? "Connecting to Sanctuary..."
              : mode === "signin"
                ? "Sign In to Sanctuary"
                : "Register Sanctuary Account"}
          </button>

          <button
            type="button"
            id="btn-auth-guest-demo"
            onClick={handleDemoGuestEntry}
            className="btn secondary small"
            style={{ width: "100%", padding: "10px", fontSize: "10.5px" }}
          >
            ✦ Enter Sanctuary as Demo Investigator
          </button>
        </form>
      </div>
    </div>
  );
};
