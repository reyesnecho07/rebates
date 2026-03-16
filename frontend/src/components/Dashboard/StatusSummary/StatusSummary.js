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
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Silent background polling hook — never triggers a loading state
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

  // Keep ref fresh without re-subscribing effects
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

  // Polling interval
  useEffect(() => {
    if (!enabled) return;
    timerRef.current = setInterval(runFetch, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [enabled, intervalMs, runFetch]);

  // 1-second countdown ticker
  useEffect(() => {
    if (!enabled) return;
    countdownRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      setCountdown(prev => (prev <= 1 ? intervalMs / 1000 : prev - 1));
    }, 1_000);
    return () => clearInterval(countdownRef.current);
  }, [enabled, intervalMs]);

  // Pause/resume on tab visibility
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timerRef.current);
        clearInterval(countdownRef.current);
      } else {
        // Resume immediately when tab is focused again
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
// Countdown ring SVG
// ─────────────────────────────────────────────────────────────────────────────
const CountdownRing = ({ countdown, total, size = 18, isDark }) => {
  const r           = (size - 3) / 2;
  const cx          = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress    = ((total - countdown) / total) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke={isDark ? "#374151" : "#e5e7eb"} strokeWidth={2.5} />
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke={isDark ? "#60a5fa" : "#3b82f6"} strokeWidth={2.5}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.9s linear" }}
      />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// StatusSummary
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

  // ── Auto-fetch (silent, no loading flash) ────────────────────────────────
  onFetchData      = null,      // async () => void — parent reloads its state
  fetchIntervalMs  = 30_000,    // poll every 30 s by default
  autoFetchEnabled = true,      // flip to false to pause polling
  // ─────────────────────────────────────────────────────────────────────────

  // isLoading is only used for the very first page-load skeleton
  isLoading = false,
}) => {
  const [showFilters,  setShowFilters]  = useState(false);
  const [pageLoading,  setPageLoading]  = useState(false); // only for pagination transitions
  const filterRef       = useRef(null);
  const filterButtonRef = useRef(null);

  const isDark = theme === "dark";

  // ── Silent background polling ─────────────────────────────────────────────
  const hasOnFetchData = typeof onFetchData === "function";

const { lastUpdated, fetchError, countdown, manualRefresh } = useBackgroundPoll({
  onFetch:     hasOnFetchData ? onFetchData : async () => {},
  intervalMs:  fetchIntervalMs,
  enabled:     hasOnFetchData && autoFetchEnabled,
});

// Fire one immediate fetch on mount so table is never stale on first open
useEffect(() => {
  if (hasOnFetchData && autoFetchEnabled) {
    manualRefresh();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
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

  // ── Sorting & pagination ──────────────────────────────────────────────────
  const sortedCustomers = useMemo(() => {
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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedCustomers.length / itemsPerCustomerPage)),
    [sortedCustomers.length, itemsPerCustomerPage]
  );

  const paginatedCustomers = useMemo(() => {
    const start = (currentCustomerPage - 1) * itemsPerCustomerPage;
    return sortedCustomers.slice(start, start + itemsPerCustomerPage);
  }, [sortedCustomers, currentCustomerPage, itemsPerCustomerPage]);

  const hasQuarterlyCustomers = useMemo(
    () => paginatedCustomers.some(isQuarterlyCustomer),
    [paginatedCustomers]
  );

  const handlePageChange = useCallback((page) => {
    if (page === currentCustomerPage) return;
    setPageLoading(true);
    setCurrentCustomerPage(page);
    // Brief visual feedback without hiding the table
    setTimeout(() => setPageLoading(false), 80);
  }, [currentCustomerPage, setCurrentCustomerPage]);

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

  const getTableHeaderClasses = (quarterly) =>
    `px-4 py-2.5 items-center text-xs font-semibold border-b grid ${quarterly ? "grid-cols-9" : "grid-cols-7"} ${
      isDark ? "bg-gray-900 border-gray-700 text-gray-300" : "bg-gray-50 border-gray-200 text-gray-700"
    }`;

  const getTableRowClasses = (quarterly) =>
    `px-4 py-3 items-center text-xs transition-all duration-150 grid ${quarterly ? "grid-cols-9" : "grid-cols-7"} ${
      isDark ? "hover:bg-gray-700/50 border-gray-700" : "hover:bg-gray-50 border-gray-100"
    }`;

  // ── Skeleton shown ONLY on very first load (isLoading from parent) ────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={containerClasses}>

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
              <p className={`text-xs ${textSecondaryClasses}`}>Rebate eligibility and status</p>
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
                  {/* Sales Agent */}
                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>Sales Agent</label>
                    <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className={filterSelectClasses}>
                      <option value="All">All Sales Agents</option>
                      {agents.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  {/* Rebate Type */}
                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>Rebate Type</label>
                    <select value={selectedRebateType} onChange={(e) => setSelectedRebateType(e.target.value)} className={filterSelectClasses}>
                      <option value="All">All Types</option>
                      <option value="Fixed">Fixed Amount</option>
                      <option value="Incremental">Incremental</option>
                      <option value="Percentage">Percentage</option>
                    </select>
                  </div>

                  {/* Progress Status */}
                  <div>
                    <label className={`text-xs font-medium ${textSecondaryClasses} mb-1 block uppercase tracking-wider`}>Progress Status</label>
                    <select value={selectedProgressStatus} onChange={(e) => setSelectedProgressStatus(e.target.value)} className={filterSelectClasses}>
                      <option value="All">All Status</option>
                      <option value="Starting">Starting</option>
                      <option value="On Track">On Track</option>
                      <option value="Met Quota">Met Quota</option>
                    </select>
                  </div>

                  {/* Rebate Amount Range */}
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

                  {/* Period Range */}
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

      {/* ── Status Legend ── */}
      {hasQuarterlyCustomers && (
        <div className={`px-4 py-2.5 border-b ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-100 bg-white"}`}>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${textSecondaryClasses}`}>Progress:</span>
            {[["bg-green-500", "Eligible"], ["bg-yellow-500", "Pending"], ["bg-red-500", "Not Eligible"]].map(([cls, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${cls}`} />
                <span className={`text-xs ${textSecondaryClasses}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Table Header ── */}
      <div className={getTableHeaderClasses(hasQuarterlyCustomers)}>
        <div className="col-span-2 min-w-[160px] flex items-center gap-1">
          <User size={10} className={textMutedClasses} /><span>Customer</span>
        </div>
        <div className="min-w-[85px] flex items-center gap-1">
          <UserCheck size={10} className={textMutedClasses} /><span>Agent</span>
        </div>
        <div className="min-w-[70px] flex items-center gap-0.5 justify-center">
          <Tag size={10} className={textMutedClasses} /><span>Type</span>
        </div>
        {hasQuarterlyCustomers && (
          <div className="min-w-[95px] flex items-center gap-1">
            <TrendingUp size={10} className={textMutedClasses} /><span>Progress</span>
          </div>
        )}
        {hasQuarterlyCustomers && (
          <div className="min-w-[65px] flex items-center gap-1 justify-center">
            <Activity size={10} className={textMutedClasses} /><span>Status</span>
          </div>
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

      {/* ── Table Body ────────────────────────────────────────────────────────
           • isLoading  → show skeleton ONLY on first load (table is empty)
           • pageLoading → fade the rows during quick page-change transition
           • Background polling NEVER hides the table
      ─────────────────────────────────────────────────────────────────────── */}
      <div
        className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"} transition-opacity duration-150 ${
          pageLoading ? "opacity-50" : "opacity-100"
        }`}
      >
        {isLoading && paginatedCustomers.length === 0 ? (
          /* First-load skeleton — only shown when the table is genuinely empty */
          <LoadingSkeleton />
        ) : paginatedCustomers.length > 0 ? (
          paginatedCustomers.map((row, index) => {
            const isQuarterly = isQuarterlyCustomer(row);
            const pct         = isQuarterly ? calculateProgressPercentage(row) : 0;
            const eligibility = isQuarterly ? getEligibilityStatus(row, pct) : "N/A";
            const statusText  = isQuarterly ? getProgressStatusText(row, pct) : "N/A";
            const barColor    = isQuarterly ? getProgressBarColor(row, pct) : "";
            const textColor   = isQuarterly ? getProgressTextColor(row, pct) : textMutedClasses;

            return (
              <div key={`${row.code}-${row.rebateCode}-${index}`} className={getTableRowClasses(isQuarterly)}>

                {/* Customer */}
                <div className="col-span-2 min-w-[160px]">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] shadow-sm flex-shrink-0 ${isDark ? "bg-blue-900 text-blue-300" : row.color ? "" : "bg-blue-500 text-white"}`}
                      style={!isDark && row.color ? { backgroundColor: row.color, color: "white" } : {}}
                    >
                      {row.customer?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`font-semibold cursor-pointer hover:text-blue-600 truncate transition-colors text-xs leading-tight ${isDark ? "text-gray-100 hover:text-blue-400" : "text-gray-900"}`}
                        onClick={() => onCustomerClick(row)}
                        title={row.customer || "Unknown Customer"}
                      >
                        {row.customer || "Unknown Customer"}
                      </div>
                      <div className={`text-[10px] truncate leading-tight mt-0.5 ${textSecondaryClasses}`} title={row.code}>
                        {row.code || "No Code"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Agent */}
                <div className="min-w-[85px]">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] ${isDark ? "bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-800/30 text-blue-300" : "bg-gradient-to-br from-orange-400 to-red-500 text-white"}`}>
                      {row.agent?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium truncate text-xs leading-tight ${textPrimaryClasses}`} title={row.agent || "Unknown Agent"}>
                        {row.agent || "Unknown Agent"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rebate Type */}
                <div className="min-w-[70px] flex justify-center">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap border ${
                    row.rebateType === "Fixed"
                      ? isDark ? "bg-blue-900/20 text-blue-300 border-blue-700/30"     : "bg-blue-100 text-blue-700 border-blue-200"
                      : row.rebateType === "Incremental"
                      ? isDark ? "bg-purple-900/20 text-purple-300 border-purple-700/30" : "bg-purple-100 text-purple-700 border-purple-200"
                      : row.rebateType === "Percentage"
                      ? isDark ? "bg-orange-900/20 text-orange-300 border-orange-700/30" : "bg-orange-100 text-orange-700 border-orange-200"
                      : isDark ? "bg-gray-700 text-gray-400 border-gray-600" : "bg-gray-100 text-gray-700 border-gray-200"
                  }`}>
                    {row.rebateType || "?"}
                  </span>
                </div>

                {/* Progress */}
                {isQuarterly && (
                  <div className="min-w-[95px]">
                    <div className="space-y-1">
                      <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
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
                  </div>
                )}

                {/* Eligibility */}
                {isQuarterly && (
                  <div className="min-w-[65px] flex justify-center">
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
                  </div>
                )}

                {/* Amount — animates smoothly when value changes via polling */}
                <div className="min-w-[80px] text-center">
                  <span className={`font-bold text-xs whitespace-nowrap truncate block px-1 transition-colors duration-300 ${textPrimaryClasses}`}>
                    ₱{(row.rebateAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Released */}
                <div className="min-w-[75px] text-center">
                  <span className={`font-bold text-xs whitespace-nowrap truncate block px-1 transition-colors duration-300 ${isDark ? "text-white" : "text-black"}`}>
                    ₱{(row.paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Balance */}
                <div className="min-w-[75px] text-center">
                  <span className={`font-bold text-xs whitespace-nowrap truncate block px-1 transition-colors duration-300 ${isDark ? "text-white" : "text-black"}`}>
                    ₱{(row.rebateBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

              </div>
            );
          })
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
      {sortedCustomers.length > 0 && (
        <div className={`px-4 py-3 border-t rounded-b-lg flex justify-between items-center ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
          <div className={`text-xs ${textSecondaryClasses}`}>
            Showing {(currentCustomerPage - 1) * itemsPerCustomerPage + 1} to{" "}
            {Math.min(currentCustomerPage * itemsPerCustomerPage, sortedCustomers.length)} of{" "}
            {sortedCustomers.length} customers
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