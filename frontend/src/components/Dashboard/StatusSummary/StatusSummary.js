import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Activity, Search, Filter, X, User, UserCheck, Tag, TrendingUp,
  CheckCircle, XCircle, CreditCard, Wallet, Users, PhilippinePeso,
  WifiOff, ChevronRight, ChevronDown, Layers,
  ChevronsLeft, ChevronsRight, ChevronLeft, Eye,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Grid templates
// ─────────────────────────────────────────────────────────────────────────────
const GRID_6 = "2fr 1.1fr 0.9fr 1fr 0.95fr 0.95fr";
const GRID_7 = "2fr 1.1fr 0.9fr 1.2fr 1fr 0.95fr 0.95fr";

// ─────────────────────────────────────────────────────────────────────────────
// Pagination helper
// ─────────────────────────────────────────────────────────────────────────────
const getPageNums = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
};

// ─────────────────────────────────────────────────────────────────────────────
// Background polling hook
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
      if (mountedRef.current) { setLastUpdated(new Date()); setCountdown(intervalMs / 1000); }
    } catch (err) {
      if (mountedRef.current) setFetchError(err?.message || "Fetch failed");
    } finally { isFetchingRef.current = false; }
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
        clearInterval(timerRef.current); clearInterval(countdownRef.current);
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
// Filter Panel — portal, floats above everything
// ─────────────────────────────────────────────────────────────────────────────
const FilterPanel = ({
  isDark, T,
  agents,
  selectedAgent, setSelectedAgent,
  selectedRebateType, setSelectedRebateType,
  selectedProgressStatus, setSelectedProgressStatus,
  minRebateAmount, setMinRebateAmount,
  maxRebateAmount, setMaxRebateAmount,
  statusSummaryPeriodFrom, setStatusSummaryPeriodFrom,
  statusSummaryPeriodTo, setStatusSummaryPeriodTo,
  onClearFilters, onApplyFilters,
  setCurrentCustomerPage, onClose,
  anchorRef,
  selectedProgramStatus, setSelectedProgramStatus,
}) => {
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 6, right: window.innerWidth - rect.right });
    }
  }, [anchorRef]);
  useEffect(() => {
    const handler = (e) => {
      if (
        panelRef.current   && !panelRef.current.contains(e.target) &&
        anchorRef?.current && !anchorRef.current.contains(e.target)
      ) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);
  const selCls = `w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium ${
    isDark ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-800"
  }`;
  const dateCls = `w-full px-2 py-1 text-xs border rounded-lg outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
    isDark ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-800"
  }`;
  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      style={{ position: "absolute", top: pos.top, right: pos.right, zIndex: 99999 }}
      className={`w-80 rounded-xl border p-4 shadow-2xl ${T.popup}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-xs font-bold ${T.textPrimary}`}>Filter Customers</h3>
        <button onClick={onClose} className={`p-1 rounded hover:bg-slate-100 transition-colors ${T.textSecondary}`}>
          <X size={13} />
        </button>
      </div>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-0.5">
        {/* Sales Agent */}
        <div>
          <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ${T.textSecondary}`}>Sales Agent</label>
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} className={selCls}>
            <option value="All">All Sales Agents</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {/* Program Status */}
      <div>
        <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ${T.textSecondary}`}>
          Program Status
        </label>
        <div className="flex flex-wrap gap-1">
          {["All", "Active", "Inactive"].map(s => (
            <button
              key={s}
              onClick={() => setSelectedProgramStatus(s)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-all ${
                selectedProgramStatus === s
                  ? "bg-blue-600 text-white border-blue-600"
                  : isDark
                    ? "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
        {/* Rebate Type */}
        <div>
          <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ${T.textSecondary}`}>Rebate Type</label>
          <div className="flex flex-wrap gap-1">
            {["All", "Fixed", "Incremental", "Percentage"].map(t => (
              <button
                key={t}
                onClick={() => setSelectedRebateType(t)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-all ${
                  selectedRebateType === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : isDark
                      ? "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >{t}</button>
            ))}
          </div>
        </div>
        {/* Progress Status (simplified) */}
        <div>
          <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ${T.textSecondary}`}>Progress Status</label>
          <div className="flex flex-wrap gap-1">
            {["All", "Starting", "Progressing", "Eligible"].map(s => (
              <button
                key={s}
                onClick={() => setSelectedProgressStatus(s)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-all ${
                  selectedProgressStatus === s
                    ? "bg-blue-600 text-white border-blue-600"
                    : isDark
                      ? "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >{s}</button>
            ))}
          </div>
        </div>
        {/* Rebate Amount Range */}
        <div>
          <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ${T.textSecondary}`}>Rebate Amount Range</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={`text-[10px] mb-0.5 ${T.textMuted}`}>Min (₱)</p>
              <input
                type="number" placeholder="0" value={minRebateAmount}
                onChange={e => setMinRebateAmount(e.target.value)}
                className={dateCls}
              />
            </div>
            <div>
              <p className={`text-[10px] mb-0.5 ${T.textMuted}`}>Max (₱)</p>
              <input
                type="number" placeholder="Any" value={maxRebateAmount}
                onChange={e => setMaxRebateAmount(e.target.value)}
                className={dateCls}
              />
            </div>
          </div>
        </div>
        {/* Period Range */}
        <div>
          <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ${T.textSecondary}`}>Period Range</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={`text-[10px] mb-0.5 ${T.textMuted}`}>From</p>
              <input type="date" value={statusSummaryPeriodFrom} onChange={e => setStatusSummaryPeriodFrom(e.target.value)} className={dateCls} />
            </div>
            <div>
              <p className={`text-[10px] mb-0.5 ${T.textMuted}`}>To</p>
              <input type="date" value={statusSummaryPeriodTo} onChange={e => setStatusSummaryPeriodTo(e.target.value)} className={dateCls} />
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className={`pt-3 border-t flex gap-2 ${isDark ? "border-slate-700" : "border-slate-100"}`}>
          <button
            onClick={() => { onClearFilters(); setCurrentCustomerPage(1); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${T.btn}`}
          >Clear All</button>
          <button
            onClick={() => { onApplyFilters(); setCurrentCustomerPage(1); onClose(); }}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
          >Apply</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Pagination button
// ─────────────────────────────────────────────────────────────────────────────
const PaginationButton = ({ icon: Icon, onClick, disabled, isDark }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
      disabled
        ? isDark ? "text-slate-600 cursor-not-allowed" : "text-slate-300 cursor-not-allowed"
        : isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"
    }`}
  >
    <Icon size={14} />
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Row timestamp helper — shared by both sortedRows and customerGroups
// ─────────────────────────────────────────────────────────────────────────────
const rebateCodeNum = (code) => {
  if (!code) return 0;
  const match = String(code).match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
};

const rowTs = (r) => {
  const codeNum = rebateCodeNum(r.rebateCode);
  if (codeNum > 0) return codeNum;

  const raw =
    r.createdDate ||
    r.createdAt   ||
    r.dateAdded   ||
    r.timestamp   ||
    r.dateFrom    ||
    r.from        ||
    null;
  if (raw) {
    const t = new Date(raw).getTime();
    if (!isNaN(t)) return t;
  }
  return typeof r.id === "number" ? r.id : 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal for selecting rebate code (only shows status for VAN rows)
// ─────────────────────────────────────────────────────────────────────────────
const RebateSelectionModal = ({ isDark, group, onClose, onSelectRebate }) => {
  const modalRef = useRef(null);
  const T = {
    popup: isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
    textPrimary: isDark ? "text-slate-100" : "text-slate-800",
    textSecondary: isDark ? "text-slate-400" : "text-slate-500",
    textMuted: isDark ? "text-slate-500" : "text-slate-400",
    row: isDark ? "hover:bg-slate-700/50 border-slate-700/50" : "hover:bg-slate-50 border-slate-100",
  };
  const fmt = (n) => {
    const num = n || 0;
    const abs = Math.abs(num);
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num < 0 ? `-₱${formatted}` : `₱${formatted}`;
  };
  
  const isVanRow = (row) => {
    const unit = row.businessUnit || row.programType || row.customerType || "";
    return unit.toLowerCase() === "van";
  };

  const getSimplifiedStatus = (row) => {
    const calcPct = (r) => {
      if (r.rebateType === "Fixed" || r.rebateType === "Percentage") {
        const q = Object.values(r.quotas || {}).reduce((s, v) => s + v, 0);
        return q > 0 ? parseFloat(Math.min(((r.totalAchieved || 0) / q) * 100, 100).toFixed(1)) : 0;
      }
      if (r.rebateType === "Incremental") {
        if (r.currentRange) {
          const cr = r.ranges?.find(rng => rng.rangeNo === r.currentRange);
          if (cr) {
            const mn = cr.minQty || 0, mx = cr.maxQty || (cr.minQty * 2) || 1000;
            return parseFloat(Math.min(((r.totalAchieved - mn) / Math.max(mx - mn, 1)) * 100, 100).toFixed(1));
          }
        }
        const fr = r.ranges?.[0];
        if (fr) return parseFloat(Math.min((r.totalAchieved / fr.minQty) * 100, 99).toFixed(1));
      }
      return 0;
    };
    const pct = calcPct(row);
    if (pct >= 100) return "Eligible";
    if (pct > 0) return "Progressing";
    return "Starting";
  };
  
  const getStatusColor = (status) => {
    switch(status) {
      case "Eligible": return isDark ? "text-emerald-400 bg-emerald-900/30 border-emerald-700/40" : "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "Progressing": return isDark ? "text-amber-400 bg-amber-900/30 border-amber-700/40" : "text-amber-700 bg-amber-50 border-amber-200";
      default: return isDark ? "text-slate-300 bg-slate-700 border-slate-600" : "text-slate-600 bg-slate-100 border-slate-200";
    }
  };

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={modalRef}
        className={`w-full max-w-2xl rounded-xl border shadow-2xl ${T.popup} overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-slate-700" : "border-slate-100"}`}>
          <div>
            <h3 className={`text-sm font-bold ${T.textPrimary}`}>{group.customer}</h3>
            <p className={`text-[10px] ${T.textSecondary}`}>{group.code}</p>
          </div>
          <button onClick={onClose} className={`p-1 rounded ${isDark ? "hover:bg-slate-700" : "hover:bg-slate-100"}`}>
            <X size={16} className={T.textSecondary} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          <div className="space-y-1">
            {group.rows.map((row, idx) => {
              const van = isVanRow(row);
              const status = van ? getSimplifiedStatus(row) : null;
              const statusColor = status ? getStatusColor(status) : "";
              return (
                <button
                  key={idx}
                  onClick={() => onSelectRebate(row)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${T.row} ${
                    isDark ? "border-slate-700/50" : "border-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-sm ${T.textPrimary}`}>{row.rebateCode || "—"}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${
                          row.isActive
                            ? isDark ? "bg-emerald-900/30 text-emerald-400 border-emerald-700/40" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : isDark ? "bg-slate-700 text-slate-400 border-slate-600" : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${row.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {row.isActive ? "Active" : "Inactive"}
                        </span>
                        {van && status && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${statusColor}`}>
                            {status === "Eligible" && <CheckCircle size={9} />}
                            {status === "Progressing" && <Activity size={9} />}
                            {status === "Starting" && <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                            {status}
                          </span>
                        )}
                        <span className={`text-[10px] ${T.textMuted}`}>{row.rebateType}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-xs ${T.textPrimary}`}>{fmt(row.rebateAmount)}</div>
                    </div>
                  </div>
                  {row.dateFrom && row.dateTo && (
                    <div className={`text-[9px] mt-1 ${T.textMuted}`}>
                      {new Date(row.dateFrom).toLocaleDateString()} – {new Date(row.dateTo).toLocaleDateString()}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// StatusSummary Component – conditionally shows Status column based on `showStatus` prop
// ─────────────────────────────────────────────────────────────────────────────
const StatusSummary = ({
  customers = [], filteredCustomers = [], agents = [],
  searchTerm = "", setSearchTerm = () => {},
  selectedAgent = "All", setSelectedAgent = () => {},
  selectedRebateType = "All", setSelectedRebateType = () => {},
  selectedProgressStatus = "All", setSelectedProgressStatus = () => {},
  minRebateAmount = "", setMinRebateAmount = () => {},
  maxRebateAmount = "", setMaxRebateAmount = () => {},
  statusSummaryPeriodFrom = "", setStatusSummaryPeriodFrom = () => {},
  statusSummaryPeriodTo = "", setStatusSummaryPeriodTo = () => {},
  currentCustomerPage = 1, setCurrentCustomerPage = () => {},
  itemsPerCustomerPage = 10,
  theme = "light",
  onCustomerClick = () => {},
  onClearFilters = () => {},
  onApplyFilters = () => {},
  onFetchData = null,
  fetchIntervalMs = 30_000,
  autoFetchEnabled = true,
  selectedProgramStatus = "All",
  setSelectedProgramStatus = () => {},
  isLoading = false,
  showStatus = true,           // <-- NEW PROP: whether to show the Status column
}) => {
  const [showFilters, setShowFilters]             = useState(false);
  const [pageLoading, setPageLoading]             = useState(false);
  const [selectedGroupForModal, setSelectedGroupForModal] = useState(null);
  const filterBtnRef = useRef(null);
  const isDark       = theme === "dark";
  const hasOnFetchData = typeof onFetchData === "function";
  const { fetchError, countdown, manualRefresh } = useBackgroundPoll({
    onFetch: hasOnFetchData ? onFetchData : async () => {},
    intervalMs: fetchIntervalMs,
    enabled: hasOnFetchData && autoFetchEnabled,
  });
  useEffect(() => {
    if (hasOnFetchData && autoFetchEnabled) manualRefresh();
  }, []);

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const T = {
    root:          isDark ? "bg-slate-900 border-slate-700"               : "bg-slate-50 border-slate-200",
    headerBg:      isDark ? "bg-slate-800 border-slate-700"               : "bg-white border-slate-200",
    tableBg:       isDark ? "bg-slate-900"                                : "bg-white",
    thead:         isDark ? "bg-slate-800/80 border-slate-700"            : "bg-slate-50 border-slate-200",
    row:           isDark ? "hover:bg-slate-800/70 border-slate-700/60"   : "hover:bg-slate-50 border-slate-100",
    input:         isDark
      ? "bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400 focus:ring-blue-500/30 focus:border-blue-500"
      : "bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:ring-blue-500/20 focus:border-blue-500",
    textPrimary:   isDark ? "text-slate-100"   : "text-slate-800",
    textSecondary: isDark ? "text-slate-400"   : "text-slate-500",
    textMuted:     isDark ? "text-slate-500"   : "text-slate-400",
    divider:       isDark ? "divide-slate-700" : "divide-slate-100",
    btn:           isDark
      ? "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500"
      : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400",
    popup:         isDark ? "bg-slate-800 border-slate-700 shadow-2xl"    : "bg-white border-slate-200 shadow-xl",
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isQtr = (row) => ["Quarterly", "quarterly", "Q"].includes(row.frequency);
  const calcPct = (row) => {
    if (row.rebateType === "Fixed" || row.rebateType === "Percentage") {
      const q = Object.values(row.quotas || {}).reduce((s, v) => s + v, 0);
      return q > 0 ? parseFloat(Math.min(((row.totalAchieved || 0) / q) * 100, 100).toFixed(1)) : 0;
    }
    if (row.rebateType === "Incremental") {
      if (row.currentRange) {
        const cr = row.ranges?.find(r => r.rangeNo === row.currentRange);
        if (cr) {
          const mn = cr.minQty || 0, mx = cr.maxQty || (cr.minQty * 2) || 1000;
          return parseFloat(Math.min(((row.totalAchieved - mn) / Math.max(mx - mn, 1)) * 100, 100).toFixed(1));
        }
      }
      const fr = row.ranges?.[0];
      if (fr) return parseFloat(Math.min((row.totalAchieved / fr.minQty) * 100, 99).toFixed(1));
    }
    return 0;
  };
  
  const getSimplifiedStatus = (row) => {
    const pct = calcPct(row);
    if (pct >= 100) return "Eligible";
    if (pct > 0) return "Progressing";
    return "Starting";
  };
  
  const getStatusColor = (status) => {
    switch(status) {
      case "Eligible": return isDark ? "text-emerald-400 bg-emerald-900/30 border-emerald-700/40" : "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "Progressing": return isDark ? "text-amber-400 bg-amber-900/30 border-amber-700/40" : "text-amber-700 bg-amber-50 border-amber-200";
      default: return isDark ? "text-slate-300 bg-slate-700 border-slate-600" : "text-slate-600 bg-slate-100 border-slate-200";
    }
  };

  const fmt = (n) => {
    const num = n || 0;
    const abs = Math.abs(num);
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num < 0 ? `-₱${formatted}` : `₱${formatted}`;
  };

  // ── Data processing with release‑date based reallocation ──────────────────
  const sortedRows = useMemo(
    () => [...filteredCustomers].sort((a, b) => rowTs(b) - rowTs(a)),
    [filteredCustomers]
  );

  const customerGroups = useMemo(() => {
    const map = new Map();
    sortedRows.forEach(row => {
      const key = row.code;
      if (!map.has(key)) {
        map.set(key, {
          key,
          customer: row.customer,
          code: row.code,
          agent: row.agent,
          color: row.color,
          quarterlyRow: null,
          rows: [],
        });
      }
      const g = map.get(key);
      g.rows.push(row);
      if (isQtr(row) && !g.quarterlyRow) g.quarterlyRow = row;
    });

    return Array.from(map.values())
      .map(g => {
        const allRows = [...g.rows];
        const totalRebateAmount = allRows.reduce((s, r) => s + (r.rebateAmount || 0), 0);
        const totalOriginalPaid = allRows.reduce((s, r) => s + (r.paidAmount || 0), 0);
        const totalBalance = totalRebateAmount - totalOriginalPaid;

        const hasReleaseDates = allRows.some(r => r.releaseDate);
        let rowsWithAllocated = allRows;

        if (hasReleaseDates) {
          const releases = [];
          allRows.forEach(row => {
            if (row.paidAmount && row.paidAmount > 0 && row.releaseDate) {
              releases.push({
                amount: row.paidAmount,
                date: new Date(row.releaseDate),
                originalRow: row,
              });
            }
          });
          releases.sort((a, b) => a.date - b.date);

          const rowsWithRanges = allRows.map(row => ({
            ...row,
            fromDate: row.dateFrom ? new Date(row.dateFrom) : null,
            toDate: row.dateTo ? new Date(row.dateTo) : null,
            allocatedPaid: 0,
          }));

          for (const release of releases) {
            let allocated = false;
            for (const row of rowsWithRanges) {
              if (row.fromDate && row.toDate) {
                if (release.date >= row.fromDate && release.date <= row.toDate) {
                  row.allocatedPaid += release.amount;
                  allocated = true;
                  break;
                }
              } else if (row.fromDate && !row.toDate) {
                if (release.date >= row.fromDate) {
                  row.allocatedPaid += release.amount;
                  allocated = true;
                  break;
                }
              }
            }
            if (!allocated) {
              const originalRow = rowsWithRanges.find(r => r === release.originalRow);
              if (originalRow) originalRow.allocatedPaid += release.amount;
            }
          }

          rowsWithAllocated = rowsWithRanges.map(row => ({
            ...row,
            paidAmountAllocated: row.allocatedPaid,
            rebateBalanceAllocated: (row.rebateAmount || 0) - row.allocatedPaid,
          }));
        } else {
          rowsWithAllocated = allRows.map(row => ({
            ...row,
            paidAmountAllocated: row.paidAmount || 0,
            rebateBalanceAllocated: (row.rebateBalance !== undefined && row.rebateBalance !== null)
              ? row.rebateBalance
              : (row.rebateAmount || 0) - (row.paidAmount || 0),
          }));
        }

        const finalRows = rowsWithAllocated.sort((a, b) => rowTs(b) - rowTs(a));

        const rebateTypes = [...new Set(finalRows.map(r => r.rebateType).filter(Boolean))];
        const agentList   = [...new Set(finalRows.map(r => r.agent).filter(Boolean))];
        const newestTs = finalRows.reduce((max, r) => Math.max(max, rowTs(r)), 0);

        return {
          ...g,
          rows: finalRows,
          totalRebateAmount,
          totalPaidAmount: totalOriginalPaid,
          totalBalance,
          rebateTypes,
          agentDisplay: agentList.length === 1 ? agentList[0] : agentList.length > 1 ? "Multiple" : "—",
          agentInitial: agentList.length === 1 ? agentList[0] : "M",
          rebateCount: finalRows.length,
          newestTs,
        };
      })
      .sort((a, b) => b.newestTs - a.newestTs);
  }, [sortedRows]);

  const filteredGroups = useMemo(() => {
    if (selectedProgramStatus === "All") return customerGroups;
    
    return customerGroups
      .map(group => {
        let filteredRows = group.rows;
        if (selectedProgramStatus === "Active") {
          filteredRows = group.rows.filter(row => row.isActive === true);
        } else if (selectedProgramStatus === "Inactive") {
          filteredRows = group.rows.filter(row => row.isActive === false);
        }
        
        if (filteredRows.length === 0) return null;
        
        const totalRebateAmount = filteredRows.reduce((s, r) => s + (r.rebateAmount || 0), 0);
        const totalPaidAmount   = filteredRows.reduce((s, r) => s + (r.paidAmount || 0), 0);
        const totalBalance      = Math.max(0, totalRebateAmount - totalPaidAmount);
        
        const rebateTypes = [...new Set(filteredRows.map(r => r.rebateType).filter(Boolean))];
        const agentList   = [...new Set(filteredRows.map(r => r.agent).filter(Boolean))];
        const newestTs    = filteredRows.reduce((max, r) => Math.max(max, rowTs(r)), 0);
        const quarterlyRow = filteredRows.find(r => isQtr(r)) || null;
        
        return {
          ...group,
          rows: filteredRows,
          totalRebateAmount,
          totalPaidAmount,
          totalBalance,
          rebateTypes,
          agentDisplay: agentList.length === 1 ? agentList[0] : agentList.length > 1 ? "Multiple" : "—",
          agentInitial: agentList.length === 1 ? agentList[0] : "M",
          rebateCount: filteredRows.length,
          newestTs,
          quarterlyRow,
        };
      })
      .filter(g => g !== null)
      .sort((a, b) => b.newestTs - a.newestTs);
  }, [customerGroups, selectedProgramStatus]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredGroups.length / itemsPerCustomerPage)),
    [filteredGroups.length, itemsPerCustomerPage]
  );
  const paginatedGroups = useMemo(() => {
    const s = (currentCustomerPage - 1) * itemsPerCustomerPage;
    return filteredGroups.slice(s, s + itemsPerCustomerPage);
  }, [filteredGroups, currentCustomerPage, itemsPerCustomerPage]);
  
  // Choose grid template based on showStatus
  const rowStyle = {
    display: "grid",
    gridTemplateColumns: showStatus ? GRID_7 : GRID_6,
    alignItems: "center",
    width: "100%",
    minWidth: 0,
  };

  const handlePageChange = useCallback((page) => {
    if (page === currentCustomerPage) return;
    setPageLoading(true);
    setCurrentCustomerPage(page);
    setTimeout(() => setPageLoading(false), 80);
  }, [currentCustomerPage, setCurrentCustomerPage]);

  const handleCustomerClick = (group) => {
    setSelectedGroupForModal(group);
  };

  const handleSelectRebate = (row) => {
    setSelectedGroupForModal(null);
    onCustomerClick(row);
  };

  const hasFilters =
    selectedAgent !== "All" ||
    selectedRebateType !== "All" ||
    selectedProgressStatus !== "All" ||
    selectedProgramStatus !== "All" || 
    minRebateAmount !== "" ||
    maxRebateAmount !== "" ||
    statusSummaryPeriodFrom !== "" ||
    statusSummaryPeriodTo !== "";

  // ── Sub-components ─────────────────────────────────────────────────────────
  const RebateTypeBadge = ({ type }) => {
    const map = {
      Fixed:       isDark ? "bg-blue-900/30 text-blue-300 border-blue-700/40"       : "bg-blue-50 text-blue-700 border-blue-200",
      Incremental: isDark ? "bg-violet-900/30 text-violet-300 border-violet-700/40" : "bg-violet-50 text-violet-700 border-violet-200",
      Percentage:  isDark ? "bg-amber-900/30 text-amber-300 border-amber-700/40"    : "bg-amber-50 text-amber-700 border-amber-200",
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap border ${
        map[type] || (isDark ? "bg-slate-700 text-slate-400 border-slate-600" : "bg-slate-100 text-slate-600 border-slate-200")
      }`}>{type || "?"}</span>
    );
  };

  const StatusBadge = ({ status }) => {
    const colorClass = getStatusColor(status);
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap border ${colorClass}`}>
        {status === "Eligible" && <CheckCircle size={9} />}
        {status === "Progressing" && <Activity size={9} />}
        {status === "Starting" && <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
        {status}
      </span>
    );
  };

  const LoadingSkeleton = () => {
    const numCols = showStatus ? 7 : 6;
    return (
      <div className="animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={rowStyle} className={`px-4 py-3 border-b ${isDark ? "border-slate-700" : "border-slate-100"}`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-md flex-shrink-0 ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
              <div className="flex-1 space-y-1 min-w-0">
                <div className={`h-3 w-20 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
                <div className={`h-2 w-14 rounded ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
              </div>
            </div>
            {[...Array(numCols - 1)].map((__, j) => (
              <div key={j} className={`h-4 w-14 rounded mx-auto ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Get the latest rebate row for a group (by rowTs) and compute its status
  const getLatestStatusForGroup = (group) => {
    if (!group.rows || group.rows.length === 0) return null;
    const latestRow = group.rows.reduce((prev, curr) => {
      return rowTs(curr) > rowTs(prev) ? curr : prev;
    }, group.rows[0]);
    if (!latestRow) return null;
    return getSimplifiedStatus(latestRow);
  };

  // ── Group row (summary, no expand) ────────────────────────────────────
  const CustomerGroupRow = ({ group }) => {
    const latestStatus = getLatestStatusForGroup(group);
    return (
      <div
        style={rowStyle}
        className={`px-4 py-3 text-xs transition-all duration-150 border-b cursor-pointer ${T.row} ${isDark ? "border-slate-700" : "border-slate-100"}`}
        onClick={() => handleCustomerClick(group)}
      >
        {/* Customer */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-[11px] shadow-sm flex-shrink-0 ${
              isDark ? "bg-blue-900/40 text-blue-300" : "bg-blue-500 text-white"
            }`}
            style={!isDark && group.color ? { backgroundColor: group.color, color: "white" } : {}}
          >
            {group.customer?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`font-semibold truncate text-xs leading-tight ${T.textPrimary}`} title={group.customer || "Unknown Customer"}>
              {group.customer || "Unknown Customer"}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-[10px] truncate ${T.textSecondary}`}>{group.code || "No Code"}</span>
              {group.rebateCount > 1 && (
                <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold border flex-shrink-0 ${
                  isDark ? "bg-slate-700 text-slate-300 border-slate-600" : "bg-slate-100 text-slate-600 border-slate-200"
                }`}><Layers size={8}/>{group.rebateCount}</span>
              )}
              {(() => {
                const hasActive = group.rows.some(r => r.isActive === true);
                const hasInactive = group.rows.some(r => r.isActive === false);
                let status = 'Unknown';
                let colorClass = '';

                if (hasActive && !hasInactive) {
                  status = 'Active';
                  colorClass = isDark
                    ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700/40'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                } else if (!hasActive && hasInactive) {
                  status = 'Inactive';
                  colorClass = isDark
                    ? 'bg-slate-700 text-slate-400 border-slate-600'
                    : 'bg-slate-100 text-slate-500 border-slate-200';
                } else if (hasActive && hasInactive) {
                  status = 'Mixed';
                  colorClass = isDark
                    ? 'bg-amber-900/30 text-amber-400 border-amber-700/40'
                    : 'bg-amber-50 text-amber-700 border-amber-200';
                } else {
                  status = 'Inactive';
                  colorClass = isDark
                    ? 'bg-slate-700 text-slate-400 border-slate-600'
                    : 'bg-slate-100 text-slate-500 border-slate-200';
                }

                return (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${colorClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      status === 'Active' ? 'bg-emerald-500' : status === 'Inactive' ? 'bg-slate-400' : 'bg-amber-500'
                    }`} />
                    {status}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
        {/* Agent */}
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
            isDark ? "bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-800/30 text-blue-300"
            : "bg-gradient-to-br from-orange-400 to-red-500 text-white"
          }`}>
            {group.agentInitial?.charAt(0).toUpperCase() || "?"}
          </div>
          <span className={`font-medium truncate text-xs ${T.textPrimary}`} title={group.agentDisplay}>{group.agentDisplay}</span>
        </div>
        {/* Type */}
        <div className="flex justify-center">
          {group.rebateTypes.length === 1 ? (
            <RebateTypeBadge type={group.rebateTypes[0]} />
          ) : group.rebateTypes.length > 1 ? (
            <div className="flex flex-wrap gap-0.5 justify-center">
              {group.rebateTypes.slice(0, 2).map(t => <RebateTypeBadge key={t} type={t} />)}
              {group.rebateTypes.length > 2 && (
                <span className={`px-1 py-0.5 rounded text-[9px] font-semibold border ${isDark ? "bg-slate-700 text-slate-400 border-slate-600" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                  +{group.rebateTypes.length - 2}
                </span>
              )}
            </div>
          ) : <span className={T.textMuted}>—</span>}
        </div>
        {/* Status column - only if showStatus is true */}
        {showStatus && (
          <div className="flex justify-center">
            {latestStatus ? <StatusBadge status={latestStatus} /> : <span className={T.textMuted}>—</span>}
          </div>
        )}
        {/* Amount */}
        <div className="text-center overflow-hidden">
          <span className={`font-bold text-xs block truncate px-1 ${T.textPrimary}`}>{fmt(group.totalRebateAmount)}</span>
        </div>
        {/* Released */}
        <div className="text-center overflow-hidden">
          <span className={`font-bold text-xs block truncate px-1 ${T.textPrimary}`}>{fmt(group.totalPaidAmount)}</span>
        </div>
        {/* Balance */}
        <div className="text-center overflow-hidden">
          <span className={`font-bold text-xs block truncate px-1 ${
            group.totalBalance < 0
              ? isDark ? 'text-red-400' : 'text-red-600'
              : T.textPrimary
          }`}>
            {fmt(group.totalBalance)}
          </span>
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`rounded-xl border shadow-sm overflow-visible font-sans mb-6 ${T.root}`}
      style={{ minWidth: 0, width: "100%" }}
    >
      {/* Toolbar */}
      <div className={`flex flex-wrap gap-2 items-center justify-between px-4 py-3 border-b rounded-t-xl ${T.headerBg}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow ${
            isDark
              ? "bg-gradient-to-br from-emerald-900/60 to-teal-900/60 border border-emerald-800/40"
              : "bg-gradient-to-br from-emerald-500 to-teal-600"
          }`}>
            <Activity size={15} className="text-white" />
          </div>
          <div>
            <h1 className={`text-sm font-bold leading-none ${T.textPrimary}`}>Status Summary</h1>
            <p className={`text-[10px] mt-0.5 ${T.textSecondary}`}>
              {filteredGroups.length} customer{filteredGroups.length !== 1 ? "s" : ""} · {sortedRows.length} rebate{sortedRows.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${T.textMuted}`} />
            <input
              type="text"
              placeholder="Search customers…"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentCustomerPage(1); }}
              className={`pl-8 pr-7 py-1.5 text-xs border rounded-lg outline-none transition-all focus:ring-2 w-52 ${T.input}`}
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(""); setCurrentCustomerPage(1); }}
                className={`absolute right-2 top-1/2 -translate-y-1/2 ${T.textMuted} hover:text-red-500 transition-colors`}
              >
                <X size={11} />
              </button>
            )}
          </div>
          <button
            ref={filterBtnRef}
            onClick={() => setShowFilters(v => !v)}
            className={`px-2.5 py-1.5 text-xs border rounded-lg flex items-center gap-1.5 font-medium transition-all ${
              showFilters ? "bg-blue-50 border-blue-300 text-blue-700" : T.btn
            }`}
          >
            <Filter size={12} />
            Filters
            {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-500" />}
          </button>
        </div>
      </div>

      {/* Filter panel portal */}
      {showFilters && (
        <FilterPanel
          isDark={isDark} T={T}
          agents={agents}
          selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent}
          selectedRebateType={selectedRebateType} setSelectedRebateType={setSelectedRebateType}
          selectedProgressStatus={selectedProgressStatus} setSelectedProgressStatus={setSelectedProgressStatus}
          minRebateAmount={minRebateAmount} setMinRebateAmount={setMinRebateAmount}
          maxRebateAmount={maxRebateAmount} setMaxRebateAmount={setMaxRebateAmount}
          statusSummaryPeriodFrom={statusSummaryPeriodFrom} setStatusSummaryPeriodFrom={setStatusSummaryPeriodFrom}
          statusSummaryPeriodTo={statusSummaryPeriodTo} setStatusSummaryPeriodTo={setStatusSummaryPeriodTo}
          onClearFilters={onClearFilters} onApplyFilters={onApplyFilters}
          setCurrentCustomerPage={setCurrentCustomerPage}
          onClose={() => setShowFilters(false)}
          anchorRef={filterBtnRef}
          selectedProgramStatus={selectedProgramStatus}
          setSelectedProgramStatus={setSelectedProgramStatus}
        />
      )}

      {/* Fetch error banner */}
      {fetchError && (
        <div className={`px-4 py-2 text-xs flex items-center gap-2 border-b ${
          isDark ? "bg-red-900/20 border-red-800/30 text-red-400" : "bg-red-50 border-red-200 text-red-600"
        }`}>
          <WifiOff size={12} />
          <span>Auto-refresh failed: {fetchError}. Retry in {countdown}s.</span>
          <button onClick={manualRefresh} className="ml-auto underline font-medium">Retry now</button>
        </div>
      )}

      {/* Table header */}
      <div
        style={rowStyle}
        className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b ${T.thead}`}
      >
        <div className="flex items-center gap-1.5 pl-0">
          <User size={10} className={T.textMuted}/><span className={T.textSecondary}>Customer</span>
        </div>
        <div className="flex items-center gap-1.5">
          <UserCheck size={10} className={T.textMuted}/><span className={T.textSecondary}>Agent</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <Tag size={10} className={T.textMuted}/><span className={T.textSecondary}>Type</span>
        </div>
        {showStatus && (
          <div className="flex items-center gap-1.5 justify-center">
            <TrendingUp size={10} className={T.textMuted}/><span className={T.textSecondary}>Status</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 justify-center">
          <PhilippinePeso size={10} className={T.textMuted}/><span className={T.textSecondary}>Amount</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <CreditCard size={10} className={T.textMuted}/><span className={T.textSecondary}>Released</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <Wallet size={10} className={T.textMuted}/><span className={T.textSecondary}>Balance</span>
        </div>
        <div className="w-5" />
      </div>

      {/* Table body */}
      <div
        className={`divide-y ${T.divider} transition-opacity duration-150 ${pageLoading ? "opacity-50" : "opacity-100"}`}
        style={{ overflowX: "auto", minWidth: 0 }}
      >
        {isLoading && paginatedGroups.length === 0 ? (
          <LoadingSkeleton />
        ) : paginatedGroups.length > 0 ? (
          paginatedGroups.map(group => <CustomerGroupRow key={group.key} group={group} />)
        ) : (
          <div className={`py-16 px-4 text-center ${T.tableBg}`}>
            <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
              <Users size={22} className={T.textMuted} />
            </div>
            <h3 className={`text-sm font-bold mb-1 ${T.textPrimary}`}>No Customers Found</h3>
            <p className={`text-xs max-w-xs mx-auto ${T.textSecondary}`}>
              No customers match your current search criteria.
            </p>
            {hasFilters && (
              <button
                onClick={() => { onClearFilters(); setCurrentCustomerPage(1); }}
                className="mt-3 px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {customerGroups.length > 0 && (
        <div className={`flex flex-wrap gap-2 items-center justify-between px-4 py-2.5 border-t rounded-b-xl ${T.headerBg}`}>
          <p className={`text-[11px] ${T.textSecondary}`}>
            Showing{" "}
            <span className={`font-semibold ${T.textPrimary}`}>
              {(currentCustomerPage - 1) * itemsPerCustomerPage + 1}–{Math.min(currentCustomerPage * itemsPerCustomerPage, filteredGroups.length)}
            </span>{" "}
            of{" "}
            <span className={`font-semibold ${T.textPrimary}`}>{filteredGroups.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <PaginationButton
              icon={ChevronsLeft}
              onClick={() => handlePageChange(1)}
              disabled={currentCustomerPage === 1 || pageLoading}
              isDark={isDark}
            />
            <PaginationButton
              icon={ChevronLeft}
              onClick={() => handlePageChange(currentCustomerPage - 1)}
              disabled={currentCustomerPage === 1 || pageLoading}
              isDark={isDark}
            />
            {getPageNums(currentCustomerPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className={`w-7 text-center text-xs ${T.textMuted}`}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  disabled={pageLoading}
                  className={`w-7 h-7 rounded text-xs font-medium transition-all ${
                    currentCustomerPage === p
                      ? "bg-blue-600 text-white shadow"
                      : isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"
                  } ${pageLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {p}
                </button>
              )
            )}
            <PaginationButton
              icon={ChevronRight}
              onClick={() => handlePageChange(currentCustomerPage + 1)}
              disabled={currentCustomerPage === totalPages || pageLoading}
              isDark={isDark}
            />
            <PaginationButton
              icon={ChevronsRight}
              onClick={() => handlePageChange(totalPages)}
              disabled={currentCustomerPage === totalPages || pageLoading}
              isDark={isDark}
            />
          </div>
        </div>
      )}

      {/* Modal for rebate selection */}
      {selectedGroupForModal && (
        <RebateSelectionModal
          isDark={isDark}
          group={selectedGroupForModal}
          onClose={() => setSelectedGroupForModal(null)}
          onSelectRebate={handleSelectRebate}
        />
      )}
    </div>
  );
};

export default React.memo(StatusSummary);