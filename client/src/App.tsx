import React, { useState, useEffect } from "react";
import { OwnerStatus } from "@keys/contracts";
import { TopBar } from "./components/TopBar.js";
import { Footer } from "./components/Footer.js";
import { GuidedTourModal } from "./components/GuidedTourModal.js";
import { AuthModal } from "./components/AuthModal.js";
import { useAuth } from "./auth/AuthProvider.js";
import { LandingPage } from "./pages/LandingPage.js";
import { FreeSpiritPage } from "./pages/FreeSpiritPage.js";
import { ArchivePage } from "./pages/ArchivePage.js";
import { CasePage } from "./pages/CasePage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { NewInvestigationPage } from "./pages/NewInvestigationPage.js";
import { IntegrationsPage } from "./pages/IntegrationsPage.js";
import { SafetyPage } from "./pages/SafetyPage.js";

export function formatOwnerStatus(status: OwnerStatus): { label: string; icon: string } {
  switch (status) {
    case "verified":
      return { label: "Verified", icon: "✓" };
    case "supported":
      return { label: "Supported", icon: "▲" };
    case "conflicting":
      return { label: "Conflicting", icon: "⚠" };
    case "no_evidence":
      return { label: "No Evidence", icon: "○" };
  }
}

// Helper for initial route, caseId, investigationId, filter, and demo mode from hash
function parseHashRoute(): {
  route: string;
  caseId?: string;
  investigationId?: string;
  filter?: string;
  demo?: boolean;
} {
  if (typeof window !== "undefined" && window.location.hash) {
    const raw = window.location.hash.replace(/^#\/?/, "");
    const [pathPart, queryPart] = raw.split("?");
    const parts = pathPart.split("/");
    const base = parts[0];
    const subId = parts[1];

    let filter: string | undefined;
    let demo: boolean | undefined;
    if (queryPart) {
      const sp = new URLSearchParams(queryPart);
      filter = sp.get("filter") || undefined;
      demo = sp.get("demo") === "true";
    }

    if (base === "demo") {
      return { route: "dashboard", filter, demo: true };
    }
    if (base === "case" && subId) {
      return { route: "case", caseId: subId, filter, demo };
    }
    if (base === "investigation") {
      if (subId === "new") {
        return { route: "new-investigation", filter, demo };
      }
      if (subId) {
        return { route: "investigation", investigationId: subId, filter, demo };
      }
    }
    if (base === "" || base === "home" || base === "landing") {
      return { route: "landing", filter, demo };
    }
    if (base) return { route: base, filter, demo };
  }
  return { route: "landing" };
}

export const App: React.FC = () => {
  const initial = parseHashRoute();
  const [currentRoute, setCurrentRoute] = useState<string>(
    initial.route === "auth" || initial.route === "signin" || initial.route === "signup"
      ? "landing"
      : initial.route,
  );
  const [activeCaseId, setActiveCaseId] = useState<string>(initial.caseId || "case_demo_01");
  const [activeInvestigationId, setActiveInvestigationId] = useState<string>(
    initial.investigationId || "",
  );
  const [archiveFilter, setArchiveFilter] = useState<string>(initial.filter || "ALL");
  const [isDemoMode, setIsDemoMode] = useState<boolean>(Boolean(initial.demo));
  const [demoModalOpen, setDemoModalOpen] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(
    initial.route === "auth" || initial.route === "signin" || initial.route === "signup",
  );
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">(
    initial.route === "signup" ? "signup" : "signin",
  );

  const { isAuthenticated, isLoading, user: auth0User, logout } = useAuth();
  const [guestUser, setGuestUser] = useState<{ email: string; name: string } | null>(null);

  // Active user: verified Auth0 user when authenticated, otherwise optional guest investigator
  const currentUser =
    isAuthenticated && auth0User
      ? {
          email: auth0User.email || "",
          name: auth0User.name || auth0User.email || "Auditor",
        }
      : guestUser;

  // Sync hash changes with state
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHashRoute();
      if (parsed.route === "auth" || parsed.route === "signin") {
        setAuthModalMode("signin");
        setAuthModalOpen(true);
        return;
      }
      if (parsed.route === "signup") {
        setAuthModalMode("signup");
        setAuthModalOpen(true);
        return;
      }

      setIsDemoMode(Boolean(parsed.demo));
      setCurrentRoute(parsed.route);
      if (parsed.caseId) {
        setActiveCaseId(parsed.caseId);
      }
      if (parsed.investigationId) {
        setActiveInvestigationId(parsed.investigationId);
      }
      if (parsed.filter) {
        setArchiveFilter(parsed.filter);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleNavigate = (route: string, params?: Record<string, string>) => {
    if (route === "signin" || route === "auth") {
      setAuthModalMode("signin");
      setAuthModalOpen(true);
      return;
    }
    if (route === "signup") {
      setAuthModalMode("signup");
      setAuthModalOpen(true);
      return;
    }

    const nextDemoMode =
      route === "demo" || params?.demo === "true"
        ? true
        : params?.demo === "false" ||
            route === "new-investigation" ||
            route === "spirit" ||
            route === "landing" ||
            route === "home" ||
            route === ""
          ? false
          : isDemoMode;

    const targetRoute = route === "demo" ? "dashboard" : route;
    setIsDemoMode(nextDemoMode);

    if (params?.caseId) {
      setActiveCaseId(params.caseId);
    }
    if (params?.id) {
      setActiveInvestigationId(params.id);
    }
    if (params?.filter) {
      setArchiveFilter(params.filter);
    }

    setCurrentRoute(targetRoute);

    if (typeof window !== "undefined") {
      let hash = targetRoute === "landing" || targetRoute === "home" ? "" : targetRoute;
      if (targetRoute === "case" && params?.caseId) {
        hash = `case/${params.caseId}`;
      } else if (targetRoute === "investigation" && params?.id) {
        hash = `investigation/${params.id}`;
      } else if (
        targetRoute === "new-investigation" ||
        (targetRoute === "investigation" && params?.action === "new")
      ) {
        hash = "investigation/new";
      } else if (targetRoute === "archive" && params?.filter) {
        hash = `archive?filter=${encodeURIComponent(params.filter)}`;
      }

      const queryParts: string[] = [];
      if (nextDemoMode && targetRoute !== "landing" && targetRoute !== "") {
        queryParts.push("demo=true");
      }
      if (params?.filter && !hash.includes("?filter=")) {
        queryParts.push(`filter=${encodeURIComponent(params.filter)}`);
      }

      if (queryParts.length > 0) {
        hash = `${hash}${hash.includes("?") ? "&" : "?"}${queryParts.join("&")}`;
      }

      window.location.hash = `#/${hash}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleAuthSuccess = (userData?: { email: string; name: string }) => {
    if (userData) {
      setGuestUser(userData);
    }
    setAuthModalOpen(false);
  };

  const handleSignOut = () => {
    setGuestUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("kotd_user");
    }
    if (isAuthenticated) {
      logout({ logoutParams: { returnTo: window.location.origin } });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--ink)",
        color: "var(--paper)",
        position: "relative",
      }}
    >
      {/* 1. Global Navigation TopBar */}
      <TopBar
        currentRoute={currentRoute}
        onRouteChange={handleNavigate}
        onOpenDemoModal={() => setDemoModalOpen(true)}
        onOpenAuthModal={(mode) => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
        user={currentUser}
        isLoading={isLoading}
        onSignOut={handleSignOut}
      />

      {/* 2. Page Content View */}
      <main style={{ flex: 1 }}>
        {currentRoute === "landing" || currentRoute === "" ? (
          <LandingPage
            onRouteChange={handleNavigate}
            onOpenDemo={() => {
              setIsDemoMode(true);
              handleNavigate("dashboard", { demo: "true" });
            }}
          />
        ) : currentRoute === "dashboard" ? (
          <DashboardPage
            isDemoMode={isDemoMode}
            onRouteChange={handleNavigate}
            onOpenDemo={() => {
              setIsDemoMode(true);
              handleNavigate("dashboard", { demo: "true" });
            }}
          />
        ) : currentRoute === "new-investigation" || currentRoute === "upload" ? (
          <NewInvestigationPage onRouteChange={handleNavigate} />
        ) : currentRoute === "investigation" ? (
          <NewInvestigationPage
            investigationId={activeInvestigationId}
            onRouteChange={handleNavigate}
          />
        ) : currentRoute === "archive" || currentRoute === "chambers" ? (
          <ArchivePage
            initialFilter={archiveFilter}
            isDemoMode={isDemoMode}
            onRouteChange={handleNavigate}
          />
        ) : currentRoute === "case" || currentRoute.startsWith("case_") ? (
          <CasePage caseId={activeCaseId} onRouteChange={handleNavigate} />
        ) : currentRoute === "integrations" ? (
          <IntegrationsPage onRouteChange={handleNavigate} />
        ) : currentRoute === "about" || currentRoute === "safety" ? (
          <SafetyPage onRouteChange={handleNavigate} />
        ) : currentRoute === "spirit" ? (
          <FreeSpiritPage onRouteChange={handleNavigate} />
        ) : (
          <div
            className="animate-fade-in"
            style={{
              maxWidth: "640px",
              margin: "60px auto",
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <div className="panel" style={{ padding: "44px 30px" }}>
              <div className="eyebrow" style={{ color: "var(--gold)" }}>
                ARCHIVE VAULT CHAMBER
              </div>
              <h2
                className="display"
                style={{ fontSize: "26px", color: "var(--cream)", margin: "12px 0 16px" }}
              >
                {currentRoute.toUpperCase()} SECTION
              </h2>
              <p
                className="serif"
                style={{
                  fontSize: "17px",
                  color: "#cdb78e",
                  maxWidth: "520px",
                  margin: "0 auto 24px",
                  lineHeight: 1.55,
                }}
              >
                This sanctuary chamber is being restored. You can explore the active Four-Chamber
                Registry or Sanctuary Dashboard.
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button onClick={() => handleNavigate("dashboard")} className="btn small">
                  Return to Dashboard
                </button>
                <button onClick={() => handleNavigate("archive")} className="btn secondary small">
                  Chamber Registry
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Global Auth Modal (Sign In & Sign Up as Pop-up) */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* 4. Global Guided Tour Modal */}
      <GuidedTourModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onNavigateCase={() => {
          setDemoModalOpen(false);
          handleNavigate("case", { caseId: "case_demo_01" });
        }}
      />

      {/* 5. Global Atmospheric Footer */}
      <Footer onRouteChange={handleNavigate} />
    </div>
  );
};
