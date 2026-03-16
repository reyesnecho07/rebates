import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Activity,
  Search,
  Filter,
  X,
  User,
  UserCheck,
  Tag,
  TrendingUp,
  CheckCircle,
  XCircle,
  CreditCard,
  Wallet,
  Users,
  PhilippinePeso,
  WifiOff,
  ChevronRight,
  ChevronDown,
  Layers,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Silent background polling hook
// ─────────────────────────────────────────────────────────────────────────────
const useBackgroundPoll = ({ onFetch, intervalMs = 30_000, enabled = true }) => {
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchError, setFetchError]   = useState(null);
  const [countdown, setCountdown]     = useState(intervalMs / 1000);
  const isFetchingRef  = useRef(false);
  const timerRef       = useRef(null);
  const countdownRef   = useRef(null);
  const mountedRef     = useRef(true);
  const onFetchRef     = useRef(onFetch);
  useEffect(() => { onFetchRef.current = onFetch; }, [onFetch]);
  const runFetch = useCallback(async () => {
    if (!mountedRef.current || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setFetchError(null);
    try {
      await onFetchRef.current();
      if (mountedRef.current) {
        setLastUpdated(new Date());
        setCountdown(intervalMs / 1000);
      }
    } catch (err) {
      if (mountedRef.current) setFetchError(err?.message || "Fetch failed");
    } finally {
      isFetchingRef.current = false;
    }
  }, [intervalMs]);
  useEffect(() => {
    if (!enabled) return;
    timerRef.current = setInterval(runFetch, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [enabled, intervalMs, runFetch]);
  useEffect(() => {
    if (!enabled) return;
    countdownRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      setCountdown(prev => (prev <= 1 ? intervalMs / 1000 : prev - 1));
    }, 1_000);
    return () => clearInterval(countdownRef.current);
  }, [enabled, intervalMs]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timerRef.current);
        clearInterval(countdownRef.current);
      } else {
        runFetch();
        timerRef.current     = setInterval(runFetch, intervalMs);
        countdownRef.current = setInterval(() => {
          if (!mountedRef.current) return;
          setCountdown(prev => (prev <= 1 ? intervalMs / 1000 : prev - 1));
        }, 1_000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [runFetch, intervalMs]);
  useEffect(() => () => { mountedRef.current = false; }, []);
  return { lastUpdated, fetchError, countdown, manualRefresh: runFetch };
};

// ─────────────────────────────────────────────────────────────────────────────
// StatusSummary — grouped by customer
// ─────────────────────────────────────────────────────────────────────────────
const StatusSummary = ({
  customers            = [],
  filteredCustomers    = [],
  agents               = [],
  searchTerm           = "",   setSearchTerm           = () => {},
  selectedAgent        = "All", setSelectedAgent       = () => {},
  selectedRebateType   = "All", setSelectedRebateType  = () => {},
  selectedProgressStatus = "All", setSelectedProgressStatus = () => {},
  minRebateAmount      = "",   setMinRebateAmount      = () => {},
  maxRebateAmount      = "",   setMaxRebateAmount      = () => {},
  statusSummaryPeriodFrom = "", setStatusSummaryPeriodFrom = () => {},
  statusSummaryPeriodTo   = "", setStatusSummaryPeriodTo   = () => {},
  currentCustomerPage     = 1,  setCurrentCustomerPage  = () => {},
  itemsPerCustomerPage    = 10,
  theme = "light",
  onCustomerClick = () => {},
  onClearFilters  = () => {},
  onApplyFilters  = () => {},
  onFetchData      = null,
  fetchIntervalMs  = 30_000,
  autoFetchEnabled = true,
  isLoading = false,
}) => {
  const [showFilters,    setShowFilters]    = useState(false);
  const [pageLoading,    setPageLoading]    = useState(false);
  // Set of customer codes whose rebate-rows are expanded
  const [expandedCustomers, setExpandedCustomers] = useState(new Set());
  const filterRef       = useRef(null);
  const filterButtonRef = useRef(null);
  const isDark = theme === "dark";

  // ── Silent background polling ──────────────────────────────────────────────
  const hasOnFetchData = typeof onFetchData === "function";
  const { lastUpdated, fetchError, countdown, manualRefresh } = useBackgroundPoll({
    onFetch:    hasOnFetchData ? onFetchData : async () => {},
    intervalMs: fetchIntervalMs,
    enabled:    hasOnFetchData && autoFetchEnabled,
  });
  useEffect(() => {
    if (hasOnFetchData && autoFetchEnabled) manualRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isQuarterlyCustomer = (row) =>
    ["Quarterly", "quarterly", "Q"].includes(row.frequency);

  const calculateProgressPercentage = (row) => {
    if (row.rebateType === "Fixed" || row.rebateType === "Percentage") {
      const totalQuota = Object.values(row.quotas || {}).reduce((s, q) => s + q, 0);
      return totalQuota > 0
        ? parseFloat(Math.min(((row.totalAchieved || 0) / totalQuota) * 100, 100).toFixed(1))
        : 0;
    } else if (row.rebateType === "Incremental") {
      if (row.currentRange) {
        const cr = row.ranges?.find(r => r.rangeNo === row.currentRange);
        if (cr) {
          const min = cr.minQty || 0;
          const max = cr.maxQty || (cr.minQty * 2) || 1_000;
          return parseFloat(
            Math.min(((row.totalAchieved - min) / Math.max(max - min, 1)) * 100, 100).toFixed(1)
          );
        }
      }
      const fr = row.ranges?.[0];
      if (fr) return parseFloat(Math.min((row.totalAchieved / fr.minQty) * 100, 99).toFixed(1));
    }
    return 0;
  };

  const getEligibilityStatus = (row, pct) => {
    if (row.rebateType === "Fixed" || row.rebateType === "Percentage") {
      if (pct >= 100) return "Eligible";
      if (pct <= 0)   return "Not Eligible";
      return "Pending";
    } else if (row.rebateType === "Incremental") {
      if (pct >= 50) return "Eligible";
      if (pct <= 0)  return "Not Eligible";
      return "Pending";
    }
    return "Not Eligible";
  };

  const getProgressStatusText = (row, pct) => {
    if (row.rebateType === "Fixed" || row.rebateType === "Percentage") {
      if (pct >= 100) return "Met Quota";
      if (pct > 0)    return "On Track";
      return "Starting";
    } else if (row.rebateType === "Incremental") {
      if (pct >= 50) return "Met Quota";
      if (pct > 0)   return "Progressing";
      return "Starting";
    }
    return "Starting";
  };

  const getProgressBarColor  = (row, pct) => {
    const s = getEligibilityStatus(row, pct);
    if (s === "Eligible") return "bg-green-500";
    if (s === "Pending")  return "bg-yellow-500";
    return "bg-red-500";
  };

  const getProgressTextColor = (row, pct) => {
    const s = getEligibilityStatus(row, pct);
    if (s === "Eligible") return isDark ? "text-green-400" : "text-green-600";
    if (s === "Pending")  return isDark ? "text-yellow-400" : "text-yellow-600";
    return isDark ? "text-red-400" : "text-red-600";
  };

  // Click-outside for filter panel
  useEffect(() => {
    const handler = (e) => {
      if (
        showFilters &&
        filterRef.current      && !filterRef.current.contains(e.target) &&
        filterButtonRef.current && !filterButtonRef.current.contains(e.target)
      ) setShowFilters(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showFilters]);

  // ── Sort filtered rows newest-first ───────────────────────────────────────
  const sortedRows = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      const ts = (c) => {
        if (c.createdAt)  return new Date(c.createdAt).getTime();
        if (c.dateAdded)  return new Date(c.dateAdded).getTime();
        if (c.timestamp)  return new Date(c.timestamp).getTime();
        if (typeof c.id === "number") return c.id;
        return 0;
      };
      return ts(b) - ts(a);
    });
  }, [filteredCustomers]);

  // ── Group rows by customer code ────────────────────────────────────────────
  const customerGroups = useMemo(() => {
    const map = new Map();
    sortedRows.forEach((row) => {
      const key = row.code || row.customer || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          key,
          customer: row.customer,
          code: row.code,
          agent: row.agent,
          color: row.color,
          // first quarterly row wins for group-level quarterly display
          quarterlyRow: null,
          rows: [],
        });
      }
      const group = map.get(key);
      group.rows.push(row);
      if (isQuarterlyCustomer(row) && !group.quarterlyRow) {
        group.quarterlyRow = row;
      }
    });
    // Aggregate financials
    return Array.from(map.values()).map((g) => {
      const totalRebateAmount = g.rows.reduce((s, r) => s + (r.rebateAmount || 0), 0);
      const totalPaidAmount   = g.rows.reduce((s, r) => s + (r.paidAmount   || 0), 0);
      const totalBalance      = g.rows.reduce((s, r) => s + (r.rebateBalance || 0), 0);
      const rebateTypes       = [...new Set(g.rows.map((r) => r.rebateType).filter(Boolean))];
      const agents            = [...new Set(g.rows.map((r) => r.agent).filter(Boolean))];
      return {
        ...g,
        totalRebateAmount,
        totalPaidAmount,
        totalBalance,
        rebateTypes,
        agentDisplay: agents.length === 1 ? agents[0] : agents.length > 1 ? "Multiple" : "—",
        agentInitial: agents.length === 1 ? agents[0] : "M",
        rebateCount: g.rows.length,
      };
    });
  }, [sortedRows]);

  // ── Pagination at the group level ─────────────────────────────────────────
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(customerGroups.length / itemsPerCustomerPage)),
    [customerGroups.length, itemsPerCustomerPage]
  );

  const paginatedGroups = useMemo(() => {
    const start = (currentCustomerPage - 1) * itemsPerCustomerPage;
    return customerGroups.slice(start, start + itemsPerCustomerPage);
  }, [customerGroups, currentCustomerPage, itemsPerCustomerPage]);

  const hasAnyQuarterly = useMemo(
    () => paginatedGroups.some((g) => g.quarterlyRow !== null),
    [paginatedGroups]
  );

  const handlePageChange = useCallback((page) => {
    if (page === currentCustomerPage) return;
    setPageLoading(true);
    setCurrentCustomerPage(page);
    setTimeout(() => setPageLoading(false), 80);
  }, [currentCustomerPage, setCurrentCustomerPage]);

  const toggleExpand = useCallback((key) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Styles ────────────────────────────────────────────────────────────────
  const textPrimaryClasses   = isDark ? "text-gray-100" : "text-gray-900";
  const textSecondaryClasses = isDark ? "text-gray-400" : "text-gray-600";
  const textMutedClasses     = isDark ? "text-gray-500" : "text-gray-500";
  const containerClasses = `rounded-lg border shadow-sm ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`;
  const headerClasses    = `flex justify-between items-center p-4 border-b ${isDark ? "border-gray-700" : "border-gray-100"}`;
  const searchInputClasses = `pl-8 pr-3 py-2 border rounded-md text-xs w-56 outline-none transition-all duration-150 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 font-medium ${
    isDark
      ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:ring-blue-900"
      : "bg-white border-gray-300 text-gray-800 placeholder-gray-500"
  }`;
  const filterButtonClasses = `px-3 py-2 rounded-md border transition-all duration-150 flex items-center gap-1.5 font-medium text-xs ${
    showFilters
      ? "bg-blue-50 border-blue-300 text-blue-700"
      : isDark
        ? "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500"
        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
  }`;
  const filterPopupClasses = `absolute top-full right-0 mt-1 w-80 rounded-md border shadow-lg z-50 p-4 ${
    isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
  }`;
  const filterSelectClasses = `w-full px-3 py-2 border rounded-md text-xs outline-none transition-all duration-150 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 font-medium ${
    isDark ? "bg-gray-700 border-gray-600 text-gray-100 focus:ring-blue-900" : "bg-white border-gray-300"
  }`;
  const filterInputClasses = `w-full pl-6 pr-2 py-1.5 border rounded-md text-xs outline-none transition-all duration-150 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 ${
    isDark ? "bg-gray-700 border-gray-600 text-gray-100 focus:ring-blue-900" : "bg-white border-gray-300"
  }`;

  // Table header — always 7 cols (quarterly cols omitted at group level; shown inside expanded rows)
const tableHeaderClasses = `px-4 py-2.5 items-center text-xs font-semibold border-b grid grid-cols-7 min-w-[700px] ${
  hasAnyQuarterly ? "min-w-[860px]" : "min-w-[700px]"
} ${isDark ? "bg-gray-900 border-gray-700 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-700"}`;

  // ── Rebate-type badge ──────────────────────────────────────────────────────
  const RebateTypeBadge = ({ type }) => (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap border ${
      type === "Fixed"
        ? isDark ? "bg-blue-900/20 text-blue-300 border-blue-700/30"       : "bg-blue-100 text-blue-700 border-blue-200"
        : type === "Incremental"
        ? isDark ? "bg-purple-900/20 text-purple-300 border-purple-700/30" : "bg-purple-100 text-purple-700 border-purple-200"
        : type === "Percentage"
        ? isDark ? "bg-orange-900/20 text-orange-300 border-orange-700/30" : "bg-orange-100 text-orange-700 border-orange-200"
        : isDark ? "bg-gray-700 text-gray-400 border-gray-600"             : "bg-gray-100 text-gray-700 border-gray-200"
    }`}>
      {type || "?"}
    </span>
  );

  // ── Skeleton ───────────────────────────────────────────────────────────────
  const LoadingSkeleton = () => (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`px-4 py-3 items-center grid grid-cols-7 border-b ${isDark ? "border-gray-700" : "border-gray-100"}`}>
          <div className="col-span-2 flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
            <div className="flex-1 space-y-1">
              <div className={`h-3 w-24 rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
              <div className={`h-2 w-16 rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
            </div>
          </div>
          {[...Array(5)].map((__, j) => (
            <div key={j} className={`h-4 w-16 rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          ))}
        </div>
      ))}
    </div>
  );

  // ── Expanded child row for a single rebate ────────────────────────────────
  const RebateChildRow = ({ row, isLast }) => {
    const isQtr = isQuarterlyCustomer(row);
    const pct   = isQtr ? calculateProgressPercentage(row) : 0;
    const eligibility = isQtr ? getEligibilityStatus(row, pct) : "N/A";
    const statusText  = isQtr ? getProgressStatusText(row, pct) : "N/A";
    const barColor    = isQtr ? getProgressBarColor(row, pct) : "";
    const textColor   = isQtr ? getProgressTextColor(row, pct) : textMutedClasses;

    return (
      <div className={`grid grid-cols-7 px-4 py-2 items-center text-xs ${hasAnyQuarterly ? "min-w-[860px]" : "min-w-[700px]"} transition-colors ${
        isLast ? "" : `border-b ${isDark ? "border-gray-700/50" : "border-gray-100"}`
      } ${isDark ? "bg-gray-700/20 hover:bg-gray-700/40" : "bg-gray-50/60 hover:bg-gray-50"}`}>

        {/* Indent + rebate code */}
        <div className="col-span-2 flex items-center gap-2 pl-8">
          <div className={`w-1 h-8 rounded-full flex-shrink-0 ${
            row.rebateType === "Fixed"       ? "bg-blue-400"
            : row.rebateType === "Incremental" ? "bg-purple-400"
            : row.rebateType === "Percentage"  ? "bg-orange-400"
            : "bg-gray-400"
          }`} />
          <div className="min-w-0">
            <div
              className={`font-medium cursor-pointer hover:text-blue-500 truncate text-xs leading-tight transition-colors ${isDark ? "text-gray-300 hover:text-blue-400" : "text-gray-700"}`}
              onClick={() => onCustomerClick(row)}
              title={row.rebateCode || "—"}
            >
              {row.rebateCode || "—"}
            </div>
            {isQtr && (
              <div className={`text-[9px] leading-tight mt-0.5 ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                Quarterly
              </div>
            )}
          </div>
        </div>

        {/* Agent — blank (already shown on parent) */}
        <div />

        {/* Rebate Type */}
        <div className="flex justify-center">
          <RebateTypeBadge type={row.rebateType} />
        </div>

        {/* Progress (quarterly only, else spacer × 2) */}
        {hasAnyQuarterly ? (
          <>
            <div className="min-w-[95px]">
              {isQtr ? (
                <div className="space-y-1">
                  <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[10px] font-medium capitalize truncate ${textColor}`}>
                      {statusText.length > 8 ? statusText.substring(0, 8) + "…" : statusText}
                    </div>
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded whitespace-nowrap min-w-[35px] text-center ${isDark ? "text-gray-300 bg-gray-700/50" : "text-gray-700 bg-gray-100"}`}>
                      {pct}%
                    </span>
                  </div>
                </div>
              ) : <div />}
            </div>
            <div className="flex justify-center">
              {isQtr ? (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border ${
                  eligibility === "Eligible"
                    ? isDark ? "bg-green-900/20 text-green-300 border-green-700/30"   : "bg-green-100 text-green-700 border-green-200"
                    : eligibility === "Pending"
                    ? isDark ? "bg-yellow-900/20 text-yellow-300 border-yellow-700/30" : "bg-yellow-100 text-yellow-700 border-yellow-200"
                    : isDark ? "bg-gray-700 text-gray-400 border-gray-600" : "bg-gray-100 text-gray-600 border-gray-200"
                }`}>
                  {eligibility === "Eligible"
                    ? <><CheckCircle size={9} /><span>Eligible</span></>
                    : eligibility === "Pending"
                    ? <><Activity size={9} /><span>Pending</span></>
                    : <><XCircle size={9} /><span>Not</span></>}
                </span>
              ) : <div />}
            </div>
          </>
        ) : null}

        {/* Amount */}
        <div className="text-center">
          <span className={`font-semibold text-xs whitespace-nowrap truncate block px-1 ${textPrimaryClasses}`}>
            ₱{(row.rebateAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Released */}
        <div className="text-center">
          <span className={`font-semibold text-xs whitespace-nowrap truncate block px-1 ${isDark ? "text-white" : "text-black"}`}>
            ₱{(row.paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Balance */}
        <div className="text-center">
          <span className={`font-semibold text-xs whitespace-nowrap truncate block px-1 ${isDark ? "text-white" : "text-black"}`}>
            ₱{(row.rebateBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    );
  };

  // ── Group row (1 row per customer) ────────────────────────────────────────
  const CustomerGroupRow = ({ group }) => {
    const isExpanded   = expandedCustomers.has(group.key);
    const isExpandable = group.rebateCount > 1;

    return (
      <>
        {/* ── Group header ── */}
<div
  className={`px-4 py-3 items-center text-xs grid grid-cols-7 ${hasAnyQuarterly ? "min-w-[860px]" : "min-w-[700px]"} transition-all duration-150 ${
    isDark ? "hover:bg-gray-700/50 border-gray-700" : "hover:bg-gray-50 border-gray-100"
  } border-b`}
>
          {/* Customer */}
          <div className="col-span-2 min-w-[160px]">
            <div className="flex items-center gap-2">
              {/* Expand toggle */}
              <button
                onClick={() => isExpandable && toggleExpand(group.key)}
                className={`flex-shrink-0 transition-colors rounded ${
                  isExpandable
                    ? isDark ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700" : "text-gray-400 hover:text-gray-700 hover:bg-gray-200"
                    : "text-transparent cursor-default"
                } p-0.5`}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded
                  ? <ChevronDown size={13} />
                  : <ChevronRight size={13} />}
              </button>

              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-[11px] shadow-sm flex-shrink-0 ${
                  isDark ? "bg-blue-900 text-blue-300" : group.color ? "" : "bg-blue-500 text-white"
                }`}
                style={!isDark && group.color ? { backgroundColor: group.color, color: "white" } : {}}
              >
                {group.customer?.charAt(0).toUpperCase() || "?"}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className={`font-semibold cursor-pointer hover:text-blue-600 truncate transition-colors text-xs leading-tight ${isDark ? "text-gray-100 hover:text-blue-400" : "text-gray-900"}`}
                  onClick={() => onCustomerClick(group.rows[0])}
                  title={group.customer || "Unknown Customer"}
                >
                  {group.customer || "Unknown Customer"}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`text-[10px] truncate leading-tight ${textSecondaryClasses}`} title={group.code}>
                    {group.code || "No Code"}
                  </div>
                  {/* Rebate count badge */}
                  {group.rebateCount > 1 && (
                    <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold border ${
                      isDark ? "bg-gray-700 text-gray-300 border-gray-600" : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>
                      <Layers size={8} />
                      {group.rebateCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Agent */}
          <div className="min-w-[85px]">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] ${
                isDark
                  ? "bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-800/30 text-blue-300"
                  : "bg-gradient-to-br from-orange-400 to-red-500 text-white"
              }`}>
                {group.agentInitial?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className={`font-medium truncate text-xs leading-tight ${textPrimaryClasses}`} title={group.agentDisplay}>
                {group.agentDisplay}
              </div>
            </div>
          </div>

          {/* Rebate type(s) */}
          <div className="min-w-[70px] flex justify-center">
            {group.rebateTypes.length === 1 ? (
              <RebateTypeBadge type={group.rebateTypes[0]} />
            ) : group.rebateTypes.length > 1 ? (
              <div className="flex flex-wrap gap-0.5 justify-center">
                {group.rebateTypes.slice(0, 2).map((t) => (
                  <RebateTypeBadge key={t} type={t} />
                ))}
                {group.rebateTypes.length > 2 && (
                  <span className={`px-1 py-0.5 rounded text-[9px] font-semibold border ${
                    isDark ? "bg-gray-700 text-gray-400 border-gray-600" : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}>+{group.rebateTypes.length - 2}</span>
                )}
              </div>
            ) : <span className={textMutedClasses}>—</span>}
          </div>

          {/* Quarterly summary columns (spacers when multi-rebate) */}
          {hasAnyQuarterly && (
            <>
              <div className="min-w-[95px]">
                {group.quarterlyRow && group.rebateCount === 1 ? (() => {
                  const pct = calculateProgressPercentage(group.quarterlyRow);
                  const barColor = getProgressBarColor(group.quarterlyRow, pct);
                  const textColor = getProgressTextColor(group.quarterlyRow, pct);
                  const statusText = getProgressStatusText(group.quarterlyRow, pct);
                  return (
                    <div className="space-y-1">
                      <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className={`text-[10px] font-medium capitalize truncate ${textColor}`}>
                          {statusText.length > 8 ? statusText.substring(0, 8) + "…" : statusText}
                        </div>
                        <span className={`text-[10px] font-bold px-1 py-0.5 rounded whitespace-nowrap min-w-[35px] text-center ${isDark ? "text-gray-300 bg-gray-700/50" : "text-gray-700 bg-gray-100"}`}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })() : group.rebateCount > 1 && group.quarterlyRow ? (
                  <span className={`text-[10px] italic ${textMutedClasses}`}>See rows ↓</span>
                ) : <div />}
              </div>
              <div className="flex justify-center">
                {group.quarterlyRow && group.rebateCount === 1 ? (() => {
                  const pct = calculateProgressPercentage(group.quarterlyRow);
                  const eligibility = getEligibilityStatus(group.quarterlyRow, pct);
                  return (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border ${
                      eligibility === "Eligible"
                        ? isDark ? "bg-green-900/20 text-green-300 border-green-700/30"   : "bg-green-100 text-green-700 border-green-200"
                        : eligibility === "Pending"
                        ? isDark ? "bg-yellow-900/20 text-yellow-300 border-yellow-700/30" : "bg-yellow-100 text-yellow-700 border-yellow-200"
                        : isDark ? "bg-gray-700 text-gray-400 border-gray-600" : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>
                      {eligibility === "Eligible"
                        ? <><CheckCircle size={9} /><span>Eligible</span></>
                        : eligibility === "Pending"
                        ? <><Activity size={9} /><span>Pending</span></>
                        : <><XCircle size={9} /><span>Not</span></>}
                    </span>
                  );
                })() : <div />}
              </div>
            </>
          )}

          {/* Aggregated Amount */}
          <div className="min-w-[80px] text-center">
            <span className={`font-bold text-xs whitespace-nowrap truncate block px-1 transition-colors duration-300 ${textPrimaryClasses}`}>
              ₱{group.totalRebateAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {group.rebateCount > 1 && (
              <div className={`text-[9px] ${textMutedClasses}`}>combined</div>
            )}
          </div>

          {/* Aggregated Released */}
          <div className="min-w-[75px] text-center">
            <span className={`font-bold text-xs whitespace-nowrap truncate block px-1 transition-colors duration-300 ${isDark ? "text-white" : "text-black"}`}>
              ₱{group.totalPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Aggregated Balance */}
          <div className="min-w-[75px] text-center">
            <span className={`font-bold text-xs whitespace-nowrap truncate block px-1 transition-colors duration-300 ${isDark ? "text-white" : "text-black"}`}>
              ₱{group.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* ── Expanded child rows ── */}
        {isExpanded && isExpandable && (
          <div className={`${isDark ? "bg-gray-800/60" : "bg-gray-50/40"}`}>
            {group.rows.map((row, i) => (
              <RebateChildRow
                key={`${row.code}-${row.rebateCode}-${i}`}
                row={row}
                isLast={i === group.rows.length - 1}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={containerClasses} style={{ overflowX: 'auto' }}>
      {/* ── Header ── */}
      <div className={headerClasses}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isDark
              ? "bg-gradient-to-br from-green-900/40 to-emerald-900/40 border border-green-800/30"
              : "bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200"
          }`}>
            <Activity size={18} className={isDark ? "text-green-300" : "text-green-600"} />
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${textPrimaryClasses}`}>Status Summary</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className={`text-xs ${textSecondaryClasses}`}>
                Rebate eligibility and status
                {customerGroups.length > 0 && (
                  <span className={`ml-2 font-medium ${isDark ? "text-blue-400" : "text-blue-600"}`}>
                    · {customerGroups.length} customer{customerGroups.length !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <Search size={12} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${textMutedClasses}`} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={searchInputClasses}
            />
          </div>

          {/* Filter button */}
          <div className="relative">
            <button ref={filterButtonRef} onClick={() => setShowFilters(!showFilters)} className={filterButtonClasses}>
              <Filter size={12} /> Filters
            </button>
            {showFilters && (
              <div ref={filterRef} className={filterPopupClasses}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-xs font-semibold ${textPrimaryClasses}`}>Filter Customers</h3>
                  <button onClick={() => setShowFilters(false)} className={`p-0.5 rounded transition-colors ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                    <X size={14} className={textSecondaryClasses} />
                  </button>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>Sales Agent</label>
                    <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className={filterSelectClasses}>
                      <option value="All">All Sales Agents</option>
                      {agents.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>Rebate Type</label>
                    <select value={selectedRebateType} onChange={(e) => setSelectedRebateType(e.target.value)} className={filterSelectClasses}>
                      <option value="All">All Types</option>
                      <option value="Fixed">Fixed Amount</option>
                      <option value="Incremental">Incremental</option>
                      <option value="Percentage">Percentage</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>Progress Status</label>
                    <select value={selectedProgressStatus} onChange={(e) => setSelectedProgressStatus(e.target.value)} className={filterSelectClasses}>
                      <option value="All">All Status</option>
                      <option value="Starting">Starting</option>
                      <option value="On Track">On Track</option>
                      <option value="Met Quota">Met Quota</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>Rebate Amount Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`text-xs ${textSecondaryClasses} mb-1 block`}>Min</label>
                        <div className="relative">
                          <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs ${textMutedClasses}`}>₱</span>
                          <input type="number" placeholder="0" value={minRebateAmount} onChange={(e) => setMinRebateAmount(e.target.value)} className={filterInputClasses} />
                        </div>
                      </div>
                      <div>
                        <label className={`text-xs ${textSecondaryClasses} mb-1 block`}>Max</label>
                        <div className="relative">
                          <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs ${textMutedClasses}`}>₱</span>
                          <input type="number" placeholder="Any" value={maxRebateAmount} onChange={(e) => setMaxRebateAmount(e.target.value)} className={filterInputClasses} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>Period Range</label>
                    <div className="space-y-1.5">
                      <div>
                        <label className={`text-xs ${textSecondaryClasses} mb-1 block`}>From</label>
                        <input type="date" value={statusSummaryPeriodFrom} onChange={(e) => setStatusSummaryPeriodFrom(e.target.value)} className={`${filterInputClasses} pl-2`} />
                      </div>
                      <div>
                        <label className={`text-xs ${textSecondaryClasses} mb-1 block`}>To</label>
                        <input type="date" value={statusSummaryPeriodTo} onChange={(e) => setStatusSummaryPeriodTo(e.target.value)} className={`${filterInputClasses} pl-2`} />
                      </div>
                    </div>
                  </div>
                  <div className={`flex gap-1.5 pt-2 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                    <button onClick={onClearFilters} className={`flex-1 px-2.5 py-1.5 rounded transition-colors text-xs font-medium border ${isDark ? "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600" : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"}`}>
                      Clear All
                    </button>
                    <button onClick={onApplyFilters} className={`flex-1 px-2.5 py-1.5 rounded transition-colors text-xs font-medium ${isDark ? "bg-blue-900/40 text-blue-300 border border-blue-700/30 hover:bg-blue-900/60" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Silent fetch error banner ── */}
      {fetchError && (
        <div className={`px-4 py-2 text-xs flex items-center gap-2 border-b ${
          isDark ? "bg-red-900/20 border-red-800/30 text-red-400" : "bg-red-50 border-red-200 text-red-600"
        }`}>
          <WifiOff size={12} />
          <span>Auto-refresh failed: {fetchError}. Will retry in {countdown}s.</span>
          <button onClick={manualRefresh} className="ml-auto underline font-medium">Retry now</button>
        </div>
      )}

      {/* ── Progress Legend ── */}
      {hasAnyQuarterly && (
        <div className={`px-4 py-2.5 border-b ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-100 bg-white"}`}>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${textSecondaryClasses}`}>Progress:</span>
            {[["bg-green-500", "Eligible"], ["bg-yellow-500", "Pending"], ["bg-red-500", "Not Eligible"]].map(([cls, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${cls}`} />
                <span className={`text-xs ${textSecondaryClasses}`}>{label}</span>
              </div>
            ))}
            <div className={`ml-auto flex items-center gap-1 text-[10px] ${textMutedClasses}`}>
              <ChevronRight size={10} />
              <span>Click the arrow to expand multiple rebates per customer</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Table Header ── */}
      <div className={tableHeaderClasses}>
        <div className="col-span-2 min-w-[160px] flex items-center gap-1 pl-5">
          <User size={10} className={textMutedClasses} /><span>Customer</span>
        </div>
        <div className="min-w-[85px] flex items-center gap-1">
          <UserCheck size={10} className={textMutedClasses} /><span>Agent</span>
        </div>
        <div className="min-w-[70px] flex items-center gap-0.5 justify-center">
          <Tag size={10} className={textMutedClasses} /><span>Type</span>
        </div>
        {hasAnyQuarterly && (
          <>
            <div className="min-w-[95px] flex items-center gap-1">
              <TrendingUp size={10} className={textMutedClasses} /><span>Progress</span>
            </div>
            <div className="min-w-[65px] flex items-center gap-1 justify-center">
              <Activity size={10} className={textMutedClasses} /><span>Status</span>
            </div>
          </>
        )}
        <div className="min-w-[80px] flex items-center gap-1 justify-center">
          <PhilippinePeso size={10} className={textMutedClasses} /><span>Amount</span>
        </div>
        <div className="min-w-[75px] flex items-center gap-1 justify-center">
          <CreditCard size={10} className={textMutedClasses} /><span>Released</span>
        </div>
        <div className="min-w-[75px] flex items-center gap-1 justify-center">
          <Wallet size={10} className={textMutedClasses} /><span>Balance</span>
        </div>
      </div>

      {/* ── Table Body ── */}
      <div className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"} transition-opacity duration-150 ${pageLoading ? "opacity-50" : "opacity-100"}`}>
        {isLoading && paginatedGroups.length === 0 ? (
          <LoadingSkeleton />
        ) : paginatedGroups.length > 0 ? (
          paginatedGroups.map((group) => (
            <CustomerGroupRow key={group.key} group={group} />
          ))
        ) : (
          <div className={`py-12 px-4 text-center ${isDark ? "bg-gray-800" : "bg-white"}`}>
            <div className={`w-16 h-16 mx-auto rounded-lg flex items-center justify-center mb-4 ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
              <Users size={24} className={textMutedClasses} />
            </div>
            <h3 className={`text-sm font-semibold mb-1 ${textPrimaryClasses}`}>No Customers Found</h3>
            <p className={`text-xs max-w-xs mx-auto ${textSecondaryClasses}`}>No customers match your current search criteria.</p>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {customerGroups.length > 0 && (
        <div className={`px-4 py-3 border-t rounded-b-lg flex justify-between items-center ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
          <div className={`text-xs ${textSecondaryClasses}`}>
            Showing {(currentCustomerPage - 1) * itemsPerCustomerPage + 1} to{" "}
            {Math.min(currentCustomerPage * itemsPerCustomerPage, customerGroups.length)} of{" "}
            {customerGroups.length} customers
            <span className={`ml-1.5 ${textMutedClasses}`}>
              ({sortedRows.length} rebate{sortedRows.length !== 1 ? "s" : ""} total)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentCustomerPage - 1)}
              disabled={currentCustomerPage === 1 || pageLoading}
              className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
                currentCustomerPage === 1 || pageLoading
                  ? isDark ? "text-gray-600 border-gray-700 cursor-not-allowed" : "text-gray-400 border-gray-200 cursor-not-allowed"
                  : isDark ? "text-gray-300 border-gray-600 hover:bg-gray-700 hover:border-gray-500" : "text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
              }`}
            >Prev</button>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || (p >= currentCustomerPage - 1 && p <= currentCustomerPage + 1))
                .map((page, idx, arr) => {
                  if (idx > 0 && page - arr[idx - 1] > 1) {
                    return <span key={`e-${page}`} className={`px-1.5 py-1 text-xs ${textMutedClasses}`}>…</span>;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      disabled={pageLoading}
                      className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                        currentCustomerPage === page
                          ? isDark ? "bg-blue-900/40 text-blue-300 border border-blue-700/30" : "bg-blue-600 text-white"
                          : isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"
                      } ${pageLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >{page}</button>
                  );
                })}
            </div>
            <button
              onClick={() => handlePageChange(currentCustomerPage + 1)}
              disabled={currentCustomerPage === totalPages || pageLoading}
              className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
                currentCustomerPage === totalPages || pageLoading
                  ? isDark ? "text-gray-600 border-gray-700 cursor-not-allowed" : "text-gray-400 border-gray-200 cursor-not-allowed"
                  : isDark ? "text-gray-300 border-gray-600 hover:bg-gray-700 hover:border-gray-500" : "text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
              }`}
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(StatusSummary);