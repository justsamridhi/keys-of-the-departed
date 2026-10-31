import React, { useState, useEffect } from "react";
import { ArchiveAccount, AccountsResponse } from "@keys/contracts";
import { useApiClient } from "../auth/apiClient.js";

export interface ArchivePageProps {
  onRouteChange: (route: string, params?: Record<string, string>) => void;
  initialFilter?: string;
  isDemoMode?: boolean;
}

export const ArchivePage: React.FC<ArchivePageProps> = ({
  onRouteChange,
  initialFilter = "ALL",
  isDemoMode = false,
}) => {
  const apiClient = useApiClient();
  const [selectedChapter, setSelectedChapter] = useState<string>(initialFilter);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AccountsResponse | null>(null);

  // Sync initialFilter prop if it changes externally
  useEffect(() => {
    if (initialFilter && initialFilter !== selectedChapter) {
      setSelectedChapter(initialFilter);
      setCurrentPage(1);
    }
  }, [initialFilter]);

  // Debounce search query (~300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when chapter or status changes
  const handleChapterChange = (chapter: string) => {
    setSelectedChapter(chapter);
    setCurrentPage(1);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };

  const toggleExpand = (accountId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (response?.data) {
      setExpandedIds(new Set(response.data.map((a) => a.account_id)));
    }
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // API Data Fetching with apiClient
  const fetchAccounts = () => {
    setLoading(true);
    setError(null);

    let isSubscribed = true;
    const timeout = setTimeout(() => {
      if (isSubscribed && loading) {
        setError("Network response timed out. Please retry querying the ledger.");
        setLoading(false);
      }
    }, 10000);

    apiClient
      .getAccounts(
        {
          chapter: selectedChapter,
          status: selectedStatus,
          search: debouncedSearch,
          page: currentPage,
          limit: 12,
        },
        isDemoMode,
      )
      .then((data) => {
        if (!isSubscribed) return;
        clearTimeout(timeout);
        setResponse(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!isSubscribed) return;
        clearTimeout(timeout);
        setError(err.message || "Failed to retrieve archive accounts");
        setLoading(false);
      });

    return () => {
      isSubscribed = false;
      clearTimeout(timeout);
    };
  };

  useEffect(() => {
    fetchAccounts();
  }, [selectedChapter, selectedStatus, debouncedSearch, currentPage, isDemoMode]);

  const handleClearAllFilters = () => {
    setSelectedChapter("ALL");
    setSelectedStatus("ALL");
    setSearchInput("");
    setDebouncedSearch("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    selectedChapter !== "ALL" || selectedStatus !== "ALL" || debouncedSearch !== "";

  const accounts = response?.data || [];
  const pagination = response?.pagination || { page: 1, limit: 12, total: 0, totalPages: 0 };

  const startRecord = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endRecord = Math.min(pagination.page * pagination.limit, pagination.total);

  // Status explanation helper
  const getStatusExplanation = (status: string) => {
    switch (status) {
      case "verified":
        return {
          title: "Deterministic Verification",
          desc: "Exact character-sequence and repository provenance match confirmed in audit records.",
          color: "var(--green)",
        };
      case "supported":
        return {
          title: "Supported with Clues",
          desc: "Corroborated by commit messages or ticket identifiers, awaiting secondary governance review.",
          color: "var(--gold)",
        };
      case "conflicting":
        return {
          title: "Conflicting Records",
          desc: "Contradictory ownership records detected across repositories. Requires human verification.",
          color: "var(--crimson2)",
        };
      case "no_evidence":
      default:
        return {
          title: "Missing Provenance",
          desc: "No recorded author or ticket trace exists. Denotes missing operational documentation, not proof of malicious intent.",
          color: "#9e917c",
        };
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{ maxWidth: "1340px", margin: "40px auto 80px", padding: "0 clamp(16px, 3vw, 32px)" }}
    >
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div
          role="status"
          style={{
            background: "rgba(197, 160, 89, 0.12)",
            border: "1px solid var(--gold)",
            padding: "10px 16px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
            color: "var(--gold)",
            fontFamily: "var(--mono)",
            fontSize: "12px",
            letterSpacing: "0.08em",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>🕯</span>
            <strong>DEMO MODE — SYNTHETIC DATA:</strong>
            <span>
              Viewing synthetic machine identities from the staging demonstration dataset.
            </span>
          </div>
          <button
            type="button"
            id="btn-archive-exit-demo"
            onClick={() => onRouteChange("archive", { demo: "false" })}
            className="btn small"
            style={{ padding: "4px 12px", fontSize: "11px" }}
          >
            Exit Demo Mode
          </button>
        </div>
      )}

      {/* 1. Header Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "20px",
          marginBottom: "32px",
          borderBottom: "1px solid rgba(197, 160, 89, 0.25)",
          paddingBottom: "24px",
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: "6px" }}>
            EVIDENCE-FIRST MACHINE IDENTITY REGISTRY
          </div>
          <h1
            className="display"
            style={{ fontSize: "clamp(26px, 4vw, 36px)", color: "var(--cream)", margin: "0 0 8px" }}
          >
            The Four-Chamber Archive
          </h1>
          <p
            className="serif"
            style={{
              fontSize: "16px",
              color: "#c7b591",
              maxWidth: "680px",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Traceable engineering evidence catalog of orphaned tokens, unmanaged deploy keys, and
            unsupervised machine identities across four distinct operational chambers.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => onRouteChange("new-investigation")}
            className="btn small"
            id="btn-archive-new-investigation"
            style={{
              background: "linear-gradient(180deg, #8b1e2d, #521019)",
              borderColor: "var(--gold)",
            }}
          >
            + New Investigation
          </button>
          <button
            type="button"
            onClick={() => onRouteChange("dashboard")}
            className="btn secondary small"
            id="btn-archive-dashboard"
          >
            Sanctuary Dashboard
          </button>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div
        className="panel"
        style={{
          padding: "20px 24px",
          marginBottom: "24px",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(18, 14, 20, 0.95)",
        }}
      >
        {/* Search Input */}
        <div style={{ flex: "1 1 320px", minWidth: "260px" }}>
          <div style={{ position: "relative" }}>
            <input
              id="archive-search-input"
              type="text"
              placeholder="Search identity ID, owner, purpose, kind..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search machine identities"
              style={{
                width: "100%",
                padding: "10px 14px 10px 36px",
                background: "rgba(10, 8, 12, 0.9)",
                border: "1px solid var(--line)",
                borderRadius: "3px",
                color: "#f6e8c7",
                fontFamily: "var(--mono)",
                fontSize: "12.5px",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--gold)",
                fontSize: "14px",
                pointerEvents: "none",
              }}
            >
              ⌕
            </span>
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search input"
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#80735e",
                  cursor: "pointer",
                  fontSize: "14px",
                  padding: "4px",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Four Chamber Navigation Buttons */}
        <div
          role="group"
          aria-label="Filter by archive chamber"
          style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
        >
          {["ALL", "LOST", "FORGOTTEN", "LONELY", "INNOCENT"].map((ch) => {
            const isActive = selectedChapter === ch;
            return (
              <button
                key={ch}
                id={`btn-chapter-${ch.toLowerCase()}`}
                type="button"
                onClick={() => handleChapterChange(ch)}
                className="btn small"
                style={{
                  background: isActive
                    ? "linear-gradient(180deg, #8b1e2d, #521019)"
                    : "rgba(22, 18, 24, 0.8)",
                  borderColor: isActive ? "var(--gold)" : "rgba(197, 160, 89, 0.25)",
                  color: isActive ? "#ffffff" : "#c7b591",
                  boxShadow: isActive ? "0 0 12px rgba(139, 30, 45, 0.4)" : "none",
                  fontSize: "10.5px",
                  letterSpacing: "0.08em",
                }}
              >
                {ch}
              </button>
            );
          })}
        </div>

        {/* Evidence Status Dropdown */}
        <div>
          <select
            id="archive-status-select"
            value={selectedStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            aria-label="Filter by evidence status"
            style={{
              padding: "10px 14px",
              background: "rgba(13, 11, 15, 0.9)",
              border: "1px solid var(--line)",
              borderRadius: "3px",
              color: "#f6e8c7",
              fontFamily: "var(--display)",
              fontSize: "11px",
              letterSpacing: "0.06em",
              cursor: "pointer",
            }}
          >
            <option value="ALL">ALL EVIDENCE STATUSES</option>
            <option value="verified">VERIFIED EVIDENCE ONLY</option>
            <option value="supported">SUPPORTED ONLY</option>
            <option value="conflicting">CONFLICTING CITATIONS</option>
            <option value="no_evidence">NO EVIDENCE (MISSING PROVENANCE)</option>
          </select>
        </div>
      </div>

      {/* 3. Active Filters Summary Bar */}
      {hasActiveFilters && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "20px",
            fontSize: "12px",
            fontFamily: "var(--mono)",
            color: "#a99b82",
          }}
        >
          <span>ACTIVE FILTERS:</span>
          {selectedChapter !== "ALL" && (
            <span
              className="tag red"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              Chamber: {selectedChapter}
              <button
                type="button"
                onClick={() => handleChapterChange("ALL")}
                aria-label="Remove chamber filter"
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </span>
          )}
          {selectedStatus !== "ALL" && (
            <span
              className="tag gold"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              Status: {selectedStatus}
              <button
                type="button"
                onClick={() => handleStatusChange("ALL")}
                aria-label="Remove status filter"
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </span>
          )}
          {debouncedSearch && (
            <span
              className="tag gray"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              Query: &ldquo;{debouncedSearch}&rdquo;
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Remove search query"
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={handleClearAllFilters}
            id="btn-clear-all-filters"
            style={{
              background: "none",
              border: "none",
              color: "var(--gold2)",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "11px",
              marginLeft: "6px",
            }}
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* 4. Main Registry Section */}

      {/* Loading Skeleton */}
      {loading && !response && (
        <div
          role="status"
          aria-live="polite"
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="panel"
              style={{
                height: "68px",
                display: "flex",
                alignItems: "center",
                padding: "16px 24px",
                border: "1px solid rgba(197, 160, 89, 0.15)",
                opacity: 0.6,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "30px",
                  background: "rgba(255,255,255,0.06)",
                  marginRight: "16px",
                }}
              />
              <div
                style={{
                  width: "200px",
                  height: "16px",
                  background: "rgba(255,255,255,0.06)",
                  marginRight: "auto",
                }}
              />
              <div
                style={{
                  width: "80px",
                  height: "20px",
                  background: "rgba(255,255,255,0.06)",
                  marginRight: "12px",
                }}
              />
              <div
                style={{ width: "120px", height: "32px", background: "rgba(255,255,255,0.06)" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div
          role="alert"
          className="panel"
          style={{
            padding: "48px 30px",
            textAlign: "center",
            border: "1px solid var(--crimson2)",
            background: "rgba(35, 14, 18, 0.95)",
          }}
        >
          <img
            src="/seal-broken.png"
            alt="Broken Seal"
            style={{ width: "54px", height: "54px", margin: "0 auto 16px", objectFit: "contain" }}
          />
          <h2
            className="display"
            style={{ fontSize: "20px", color: "#f7ebd2", margin: "0 0 10px" }}
          >
            Failed to Inquire the Archive Ledger
          </h2>
          <p
            style={{ color: "#e8c5be", maxWidth: "520px", margin: "0 auto 20px", fontSize: "14px" }}
          >
            {error}
          </p>
          <button
            type="button"
            onClick={fetchAccounts}
            className="btn small"
            id="btn-retry-archive"
            style={{ padding: "10px 24px" }}
          >
            ✦ Retry Querying Ledger
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && accounts.length === 0 && (
        <div
          className="panel"
          style={{
            padding: "60px 30px",
            textAlign: "center",
            border: "1px dashed rgba(197, 160, 89, 0.35)",
            background: "rgba(13, 11, 15, 0.8)",
          }}
        >
          <img
            src="/candleoff.png"
            alt="Unlit Candle"
            style={{
              width: "48px",
              height: "76px",
              margin: "0 auto 18px",
              objectFit: "contain",
              opacity: 0.7,
            }}
          />
          <h2
            className="display"
            style={{ fontSize: "24px", color: "var(--gold2)", margin: "0 0 10px" }}
          >
            {hasActiveFilters
              ? "No Matching Records"
              : isDemoMode
                ? "No Synthetic Identities Found"
                : "No Machine Identities Discovered Yet"}
          </h2>
          <p
            className="serif"
            style={{
              color: "#c7b591",
              maxWidth: "560px",
              margin: "0 auto 24px",
              fontSize: "16px",
              lineHeight: 1.6,
            }}
          >
            {hasActiveFilters
              ? "No machine identities match your active search or chamber filters."
              : isDemoMode
                ? "No synthetic machine identity records were found for the current query."
                : "Your workspace contains no machine identities. Identities are extracted and cataloged when you run an investigation by uploading evidence files (inventory, IAM policies, git commits, CI/CD logs, directory records, or tickets)."}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="btn ghost small"
                id="btn-empty-clear-filters"
              >
                Reset Filters & View All
              </button>
            ) : isDemoMode ? (
              <button
                type="button"
                id="btn-archive-return-real"
                onClick={() => onRouteChange("archive", { demo: "false" })}
                className="btn ghost small"
              >
                Return to Real Archive
              </button>
            ) : (
              <>
                <button
                  type="button"
                  id="btn-archive-start-investigation"
                  onClick={() => onRouteChange("new-investigation")}
                  className="btn primary small"
                >
                  ✦ Start an Investigation
                </button>
                <button
                  type="button"
                  id="btn-archive-explore-demo"
                  onClick={() => onRouteChange("archive", { demo: "true" })}
                  className="btn ghost small"
                >
                  Explore Synthetic Demo Archive
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Populated Registry Table / Progressive Disclosure Rows */}
      {!loading && !error && accounts.length > 0 && (
        <>
          {/* Header Row & Batch Expand Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              fontSize: "12px",
              fontFamily: "var(--mono)",
              color: "#a99b82",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              SHOWING {startRecord}–{endRecord} OF {pagination.total} MACHINE IDENTITIES
              {pagination.totalPages > 1 &&
                ` · PAGE ${pagination.page} OF ${pagination.totalPages}`}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={expandAll}
                className="btn ghost small"
                style={{ fontSize: "10px", padding: "4px 8px" }}
              >
                Expand All Details
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="btn ghost small"
                style={{ fontSize: "10px", padding: "4px 8px" }}
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Identity Rows List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {accounts.map((acc: ArchiveAccount) => {
              const isExpanded = expandedIds.has(acc.account_id);
              const isVerified = acc.owner_status === "verified";
              const isConflicting = acc.owner_status === "conflicting";
              const isSupported = acc.owner_status === "supported";
              const statusInfo = getStatusExplanation(acc.owner_status);

              return (
                <div
                  key={acc.account_id}
                  className="panel"
                  id={`archive-row-${acc.account_id}`}
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    border: isExpanded
                      ? "1px solid var(--gold)"
                      : "1px solid rgba(197, 160, 89, 0.2)",
                    background:
                      "linear-gradient(180deg, rgba(20, 16, 22, 0.98) 0%, rgba(12, 10, 14, 0.98) 100%)",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    boxShadow: isExpanded ? "0 8px 24px rgba(0, 0, 0, 0.7)" : "none",
                  }}
                >
                  {/* Compact Row Header (Essential Attributes Only) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 20px",
                      flexWrap: "wrap",
                      gap: "14px",
                    }}
                  >
                    {/* Left: Flame Icon + Identifier + Chamber */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        flex: "1 1 360px",
                      }}
                    >
                      <img
                        src={isVerified ? "/candleon.png" : "/candleoff.png"}
                        alt={isVerified ? "Verified Flame" : "Unverified Key"}
                        className={isVerified ? "candle-glow" : undefined}
                        style={{
                          width: "18px",
                          height: "32px",
                          objectFit: "contain",
                          opacity: isVerified ? 1 : 0.6,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            className="mono"
                            style={{
                              fontSize: "13.5px",
                              fontWeight: 600,
                              color: "#f6e8c7",
                              wordBreak: "break-all",
                            }}
                          >
                            {acc.account_id}
                          </span>
                          <span className="tag red" style={{ fontSize: "9.5px" }}>
                            {acc.ghost_type}
                          </span>
                          <span className="tag gray" style={{ fontSize: "9.5px" }}>
                            {acc.kind}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            fontFamily: "var(--mono)",
                            color: acc.owner_name ? "#c7b591" : "#80735e",
                            marginTop: "3px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span>{acc.owner_name ? "👤" : "○"}</span>
                          <span>
                            {acc.owner_name
                              ? `Attribution: ${acc.owner_name}`
                              : "Unregistered Owner (Missing Provenance)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Evidence Status Badge (Restrained Color Palette) */}
                    <div>
                      <span
                        className="mono"
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "2px",
                          fontSize: "10.5px",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          background: isVerified
                            ? "rgba(76, 175, 80, 0.15)"
                            : isSupported
                              ? "rgba(197, 160, 89, 0.15)"
                              : isConflicting
                                ? "rgba(139, 30, 45, 0.25)"
                                : "rgba(128, 115, 94, 0.15)",
                          border: `1px solid ${
                            isVerified
                              ? "#4caf50"
                              : isSupported
                                ? "var(--gold)"
                                : isConflicting
                                  ? "var(--crimson2)"
                                  : "#80735e"
                          }`,
                          color: isVerified
                            ? "#81c784"
                            : isSupported
                              ? "#e8d5b5"
                              : isConflicting
                                ? "#ff8a80"
                                : "#a99b82",
                        }}
                      >
                        {acc.owner_status.toUpperCase().replace("_", " ")}
                      </span>
                    </div>

                    {/* Right: Actions (Toggle Progressive Disclosure + Open Case Dossier) */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        type="button"
                        id={`btn-details-${acc.account_id}`}
                        onClick={() => toggleExpand(acc.account_id)}
                        className="btn ghost small"
                        aria-expanded={isExpanded}
                        aria-controls={`details-${acc.account_id}`}
                        style={{ fontSize: "11px", padding: "6px 12px" }}
                      >
                        {isExpanded ? "Collapse ▴" : "Details ▾"}
                      </button>
                      <button
                        type="button"
                        id={`btn-case-${acc.account_id}`}
                        onClick={() => onRouteChange("case", { caseId: acc.case_id })}
                        className="btn secondary small"
                        style={{ fontSize: "11px", padding: "6px 12px" }}
                      >
                        Examine Dossier →
                      </button>
                    </div>
                  </div>

                  {/* Progressive Disclosure Panel (Unfolds when expanded) */}
                  {isExpanded && (
                    <div
                      id={`details-${acc.account_id}`}
                      style={{
                        padding: "18px 24px 22px",
                        borderTop: "1px dashed rgba(197, 160, 89, 0.2)",
                        background: "rgba(10, 8, 12, 0.8)",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                          gap: "20px",
                          marginBottom: "16px",
                        }}
                      >
                        {/* Column 1: Purpose & Classification */}
                        <div>
                          <div
                            className="eyebrow"
                            style={{ color: "var(--gold)", fontSize: "10px", marginBottom: "6px" }}
                          >
                            OPERATIONAL PURPOSE &amp; SCOPE
                          </div>
                          <p
                            style={{
                              fontSize: "13px",
                              color: "#e8d5b5",
                              lineHeight: 1.5,
                              margin: "0 0 10px",
                            }}
                          >
                            {acc.purpose ||
                              "No operational purpose statement recorded in repository commits."}
                          </p>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {acc.tags.map((tag, tidx) => (
                              <span key={tidx} className="tag gray" style={{ fontSize: "9px" }}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Column 2: Evidence Status Explanation */}
                        <div>
                          <div
                            className="eyebrow"
                            style={{
                              color: statusInfo.color,
                              fontSize: "10px",
                              marginBottom: "6px",
                            }}
                          >
                            {statusInfo.title.toUpperCase()}
                          </div>
                          <p
                            style={{
                              fontSize: "12.5px",
                              color: "#c7b591",
                              lineHeight: 1.5,
                              margin: "0 0 8px",
                            }}
                          >
                            {statusInfo.desc}
                          </p>
                          <div style={{ fontSize: "11px", color: "#80735e", fontStyle: "italic" }}>
                            Case Reference: <code>{acc.case_id}</code>
                          </div>
                        </div>
                      </div>

                      {/* Primary Evidence Quotation (Dashed Border) */}
                      <div
                        style={{
                          padding: "12px 16px",
                          background: "rgba(15, 12, 17, 0.9)",
                          borderLeft: `3px solid ${isVerified ? "var(--green)" : "var(--gold)"}`,
                          borderRadius: "0 3px 3px 0",
                          fontSize: "12.5px",
                          fontStyle: "italic",
                          color: "#f7ebd2",
                          lineHeight: 1.5,
                          marginBottom: "14px",
                        }}
                      >
                        <span style={{ color: "var(--gold)", fontWeight: 700, marginRight: "4px" }}>
                          Primary Citation:
                        </span>
                        &ldquo;{acc.primary_quote}&rdquo;
                      </div>

                      {/* Footer Row: Provenance context & Direct Case Link */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "10px",
                          fontSize: "11px",
                          fontFamily: "var(--mono)",
                          color: "#746957",
                        }}
                      >
                        <div>
                          ✦ Traceable audit record evaluated via deterministic string matching
                          against synthetic Git fixtures.
                        </div>
                        <button
                          type="button"
                          onClick={() => onRouteChange("case", { caseId: acc.case_id })}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--gold2)",
                            cursor: "pointer",
                            textDecoration: "underline",
                            padding: 0,
                            fontSize: "11px",
                          }}
                        >
                          Open Full Evidence Dossier &amp; Claims →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 5. Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                marginTop: "40px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                id="btn-archive-prev"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={pagination.page <= 1}
                className="btn ghost small"
                style={{ fontSize: "11px", opacity: pagination.page <= 1 ? 0.4 : 1 }}
              >
                ← Previous Page
              </button>

              {Array.from({ length: pagination.totalPages }).map((_, pIdx) => {
                const pageNumber = pIdx + 1;
                const isCurrent = pageNumber === pagination.page;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setCurrentPage(pageNumber)}
                    className="btn small"
                    style={{
                      minWidth: "36px",
                      height: "36px",
                      padding: "0 8px",
                      fontSize: "11px",
                      fontFamily: "var(--mono)",
                      background: isCurrent ? "var(--gold)" : "rgba(22, 18, 24, 0.8)",
                      color: isCurrent ? "#120e14" : "#c7b591",
                      borderColor: isCurrent ? "var(--gold)" : "rgba(197, 160, 89, 0.2)",
                      fontWeight: isCurrent ? 700 : 400,
                    }}
                  >
                    {pageNumber}
                  </button>
                );
              })}

              <button
                type="button"
                id="btn-archive-next"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, pagination.totalPages))}
                disabled={pagination.page >= pagination.totalPages}
                className="btn ghost small"
                style={{
                  fontSize: "11px",
                  opacity: pagination.page >= pagination.totalPages ? 0.4 : 1,
                }}
              >
                Next Page →
              </button>
            </div>
          )}
        </>
      )}

      {/* 6. Synthetic Data Trust Disclosure */}
      <div
        style={{
          marginTop: "60px",
          padding: "16px 20px",
          borderTop: "1px solid rgba(197, 160, 89, 0.15)",
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
        <div>
          ✦ SYNTHETIC DEMO ARCHIVE · All 40 machine identities and commit quotations are synthetic
          fixtures deterministically evaluated for demonstration purposes.
        </div>
        <div style={{ color: "#a99b82" }}>
          Repository Engine: In-Memory Synthetic Store (Atlas Pluggable)
        </div>
      </div>
    </div>
  );
};
