import React, { useState, useEffect } from "react";

export interface NavigationProps {
  currentRoute: string;
  onRouteChange: (route: string, params?: Record<string, string>) => void;
  onOpenDemoModal?: () => void;
  onOpenAuthModal?: (mode: "signin" | "signup") => void;
  user?: { email?: string; name?: string } | null;
  isLoading?: boolean;
  onSignOut?: () => void;
}

export const TopBar: React.FC<NavigationProps> = ({
  currentRoute,
  onRouteChange,
  onOpenDemoModal,
  onOpenAuthModal,
  user,
  isLoading,
  onSignOut,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Primary navigation items according to specification: Home, Dashboard, Archive, Integrations, Safety
  const primaryNavItems = [
    { id: "landing", label: "Home", href: "#/" },
    { id: "new-investigation", label: "+ New Investigation", href: "#/investigation/new" },
    { id: "dashboard", label: "Dashboard", href: "#/dashboard" },
    { id: "archive", label: "Archive", href: "#/archive" },
    { id: "integrations", label: "Integrations", href: "#/integrations" },
    { id: "safety", label: "Safety", href: "#/safety" },
  ];

  const isItemActive = (id: string): boolean => {
    if (id === "landing") {
      return currentRoute === "landing" || currentRoute === "" || currentRoute === "home";
    }
    if (id === "new-investigation") {
      return currentRoute === "new-investigation" || currentRoute === "investigation";
    }
    if (id === "safety") {
      return currentRoute === "safety" || currentRoute === "about";
    }
    if (id === "archive") {
      return currentRoute === "archive" || currentRoute === "chambers";
    }
    return currentRoute === id;
  };

  const handleNav = (id: string) => {
    onRouteChange(id);
    setMobileMenuOpen(false);
  };

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header
      style={{
        height: "86px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "10px clamp(16px, 3vw, 42px)",
        borderBottom: "1px solid rgba(197, 160, 89, 0.35)",
        background: "linear-gradient(180deg, rgba(13, 13, 17, 0.96), rgba(8, 8, 10, 0.98))",
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(14px)",
      }}
    >
      {/* Brand logo + Title: Clickable from every page navigating to #/ */}
      <a
        href="#/"
        id="topbar-brand-link"
        onClick={(e) => {
          e.preventDefault();
          handleNav("landing");
        }}
        aria-label="Keys of the Departed sanctuary home"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          cursor: "pointer",
          minWidth: "250px",
          textDecoration: "none",
        }}
      >
        <img
          src="/logo.png"
          alt="Keys of the Departed emblem"
          style={{
            width: "50px",
            height: "54px",
            objectFit: "contain",
            filter: "drop-shadow(0 0 10px rgba(197, 160, 89, 0.35))",
          }}
        />
        <div>
          <div
            className="display"
            style={{
              fontSize: "17px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "#f7ebd2",
              textShadow: "0 2px 4px rgba(0,0,0,0.9)",
              lineHeight: 1.1,
            }}
          >
            KEYS OF THE DEPARTED
          </div>
          <div
            className="serif"
            style={{
              fontSize: "12px",
              fontStyle: "italic",
              color: "#c7b591",
              marginTop: "2px",
            }}
          >
            Machine Identity Investigation
          </div>
        </div>
      </a>

      {/* Primary Desktop Navigation Links: Home, Dashboard, Archive, Integrations, Safety */}
      <nav
        className="desktop-nav"
        aria-label="Primary sanctuary navigation"
        style={{ display: "flex", alignItems: "center", gap: "6px" }}
      >
        {primaryNavItems.map((item) => {
          const isActive = isItemActive(item.id);
          return (
            <a
              key={item.id}
              href={item.href}
              id={`nav-link-${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleNav(item.id);
              }}
              className="display"
              aria-current={isActive ? "page" : undefined}
              style={{
                textDecoration: "none",
                display: "inline-block",
                borderBottom: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                color: isActive ? "var(--gold2)" : "#c8b994",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Right Secondary Actions: Demo Tour, User Profile / Auth Modal Triggers */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {onOpenDemoModal && (
          <button
            onClick={onOpenDemoModal}
            className="btn small"
            id="topbar-btn-demo"
            style={{
              background: "linear-gradient(180deg, #8b1e2d, #521019)",
              borderColor: "var(--gold)",
              boxShadow: "0 0 14px rgba(139, 30, 45, 0.4)",
              whiteSpace: "nowrap",
            }}
          >
            ✦ Demo Tour
          </button>
        )}

        {isLoading ? (
          <div
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
            className="desktop-auth"
          >
            <span
              className="mono"
              style={{
                fontSize: "10.5px",
                color: "var(--gold2)",
                padding: "6px 10px",
                border: "1px solid var(--line)",
                borderRadius: "3px",
              }}
            >
              Authenticating...
            </span>
          </div>
        ) : user ? (
          <div
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
            className="desktop-auth"
          >
            <span
              className="mono"
              style={{
                fontSize: "11px",
                color: "var(--gold2)",
                padding: "6px 12px",
                border: "1px solid var(--line)",
                borderRadius: "3px",
                background: "rgba(22, 18, 25, 0.8)",
              }}
            >
              ✦ {user.name || user.email || "Auditor"}
            </span>
            <button
              onClick={onSignOut}
              className="btn ghost small"
              id="topbar-btn-signout"
              style={{ textTransform: "uppercase", fontSize: "10px" }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => {
                if (onOpenAuthModal) onOpenAuthModal("signin");
                else handleNav("signin");
              }}
              className="btn ghost small desktop-auth"
              id="topbar-btn-signin"
              style={{
                textTransform: "uppercase",
                borderColor:
                  currentRoute === "auth" || currentRoute === "signin" ? "var(--gold)" : undefined,
                color:
                  currentRoute === "auth" || currentRoute === "signin" ? "var(--cream)" : undefined,
              }}
            >
              Sign In
            </button>

            <button
              onClick={() => {
                if (onOpenAuthModal) onOpenAuthModal("signup");
                else handleNav("signup");
              }}
              className="btn small secondary desktop-auth"
              id="topbar-btn-signup"
              style={{ textTransform: "uppercase", fontSize: "10px" }}
            >
              Sign Up
            </button>
          </>
        )}

        {/* Mobile Hamburger Button */}
        <button
          className="mobile-toggle"
          id="topbar-mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation-drawer"
          style={{
            background: "transparent",
            border: "1px solid var(--line)",
            color: "var(--gold2)",
            padding: "8px 12px",
            fontSize: "18px",
            cursor: "pointer",
            borderRadius: "3px",
            display: "none",
          }}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Sanctuary navigation drawer"
          style={{
            position: "absolute",
            top: "86px",
            left: 0,
            right: 0,
            background: "rgba(13, 13, 17, 0.98)",
            borderBottom: "1px solid var(--gold)",
            padding: "20px 24px 28px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            zIndex: 100,
            backdropFilter: "blur(16px)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
          }}
        >
          <div
            className="eyebrow"
            style={{ color: "var(--gold)", fontSize: "10px", marginBottom: "4px" }}
          >
            SANCTUARY NAVIGATION
          </div>
          {primaryNavItems.map((item) => {
            const isActive = isItemActive(item.id);
            return (
              <a
                key={item.id}
                href={item.href}
                id={`mobile-nav-link-${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(item.id);
                }}
                className="display"
                aria-current={isActive ? "page" : undefined}
                style={{
                  textDecoration: "none",
                  display: "block",
                  color: isActive ? "var(--gold2)" : "#c8b994",
                  padding: "12px 8px",
                  fontSize: "13.5px",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(197, 160, 89, 0.15)",
                }}
              >
                {item.label}
              </a>
            );
          })}

          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            {user ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onSignOut) onSignOut();
                }}
                className="btn ghost small"
                style={{ flex: 1 }}
              >
                Sign Out ({user.name || user.email || "Auditor"})
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenAuthModal) onOpenAuthModal("signin");
                    else handleNav("signin");
                  }}
                  className="btn ghost small"
                  style={{ flex: 1 }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenAuthModal) onOpenAuthModal("signup");
                    else handleNav("signup");
                  }}
                  className="btn small"
                  style={{ flex: 1 }}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Responsive Breakpoints CSS */}
      <style>{`
        @media (max-width: 900px) {
          .desktop-nav {
            display: none !important;
          }
          .desktop-auth {
            display: none !important;
          }
          .mobile-toggle {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
};
