// src/components/StatusSummary.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Activity, Search, Filter, X, User, UserCheck, Tag,
  CheckCircle, XCircle, CreditCard, Wallet, Users, PhilippinePeso,
  WifiOff, ChevronRight, ChevronDown, Layers,
  ChevronsLeft, ChevronsRight, ChevronLeft, Eye,
} from "lucide-react";

/* ─── Apple system colour language ───────────────────────────────────────── */
const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const tokens = (isDark) => ({
  ink:       isDark ? "#F2F2F7" : "#1C1C1E",
  muted:     isDark ? "#98989F" : "#6E6E73",
  faint:     isDark ? "#68686D" : "#AEAEB2",
  glass:     isDark ? "rgba(30,30,36,0.6)"   : "rgba(255,255,255,0.65)",
  glassDeep: isDark ? "rgba(24,24,28,0.95)"  : "rgba(255,255,255,0.98)",
  hairline:  isDark ? "rgba(255,255,255,0.08)" : "rgba(60,60,67,0.12)",
  rim:       isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.8)",
  chipBg:    isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
  hover:     isDark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.035)",
  shadow:    isDark ? "0 20px 50px -14px rgba(0,0,0,0.65)" : "0 20px 50px -18px rgba(30,41,79,0.18)",
  bg:        isDark ? "#000000" : "#EEF1F7",
});

const FONT = `
  .ss-page, .ss-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .ss-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  .ss-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
  .ss-scroll::-webkit-scrollbar-thumb { background: rgba(142,142,147,0.4); border-radius: 999px; }
  .ss-scroll::-webkit-scrollbar-track { background: transparent; }
  @keyframes ss-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .ss-pop { animation: ss-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
  .ss-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "lnum" 1; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Grid templates
// ─────────────────────────────────────────────────────────────────────────────
const GRID_6 = "1.7fr 0.95fr 0.7fr 1fr 1fr 1fr";

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
// Filter Panel — portal, glass-morphism, floats above everything
// ─────────────────────────────────────────────────────────────────────────────
const FilterPanel = ({
  isDark, K,
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

  const pillStyle = (active, accent) => ({
    background: active ? accent : K.chipBg,
    color: active ? "#FFFFFF" : K.muted,
    borderColor: active ? accent : K.hairline,
    fontWeight: active ? 600 : 500,
  });

  const inputStyle = {
    width: "100%",
    padding: "6px 10px",
    fontSize: "12px",
    borderRadius: "8px",
    outline: "none",
    background: K.glass,
    border: `1px solid ${K.hairline}`,
    color: K.ink,
    transition: "all 0.15s",
  };

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        top: pos.top,
        right: pos.right,
        zIndex: 99999,
        background: K.glassDeep,
        border: `1px solid ${K.rim}`,
        boxShadow: K.shadow,
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
      }}
      className="ss-page ss-glass w-80 rounded-xl p-4 ss-pop"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold" style={{ color: K.ink }}>Filter Customers</h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
          style={{ background: K.chipBg, color: K.muted }}
          onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hairline; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; }}
        >
          <X size={13} />
        </button>
      </div>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-0.5 ss-scroll">
        {/* Sales Agent */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: K.muted }}>
            Sales Agent
          </label>
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            style={inputStyle}
          >
            <option value="All">All Sales Agents</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {/* Program Status */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: K.muted }}>
            Program Status
          </label>
          <div className="flex flex-wrap gap-1">
            {["All", "Active", "Inactive"].map(s => (
              <button
                key={s}
                onClick={() => setSelectedProgramStatus(s)}
                className="px-2.5 py-0.5 rounded-md text-[11px] border transition-all"
                style={pillStyle(
                  selectedProgramStatus === s,
                  s === "Active" ? APPLE.green : s === "Inactive" ? APPLE.gray : APPLE.blue
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {/* Rebate Type */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: K.muted }}>
            Rebate Type
          </label>
          <div className="flex flex-wrap gap-1">
            {["All", "Fixed", "Incremental", "Percentage"].map(t => (
              <button
                key={t}
                onClick={() => setSelectedRebateType(t)}
                className="px-2.5 py-0.5 rounded-md text-[11px] border transition-all"
                style={pillStyle(selectedRebateType === t, APPLE.blue)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {/* Progress Status */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: K.muted }}>
            Progress Status
          </label>
          <div className="flex flex-wrap gap-1">
            {["All", "Starting", "Progressing", "Eligible"].map(s => (
              <button
                key={s}
                onClick={() => setSelectedProgressStatus(s)}
                className="px-2.5 py-0.5 rounded-md text-[11px] border transition-all"
                style={pillStyle(
                  selectedProgressStatus === s,
                  s === "Eligible" ? APPLE.green : s === "Progressing" ? APPLE.orange : APPLE.blue
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {/* Rebate Amount Range */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: K.muted }}>
            Rebate Amount Range
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] mb-0.5" style={{ color: K.faint }}>Min (₱)</p>
              <input
                type="number"
                placeholder="0"
                value={minRebateAmount}
                onChange={e => setMinRebateAmount(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <p className="text-[10px] mb-0.5" style={{ color: K.faint }}>Max (₱)</p>
              <input
                type="number"
                placeholder="Any"
                value={maxRebateAmount}
                onChange={e => setMaxRebateAmount(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
        {/* Period Range */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: K.muted }}>
            Period Range
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] mb-0.5" style={{ color: K.faint }}>From</p>
              <input
                type="date"
                value={statusSummaryPeriodFrom}
                onChange={e => setStatusSummaryPeriodFrom(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <p className="text-[10px] mb-0.5" style={{ color: K.faint }}>To</p>
              <input
                type="date"
                value={statusSummaryPeriodTo}
                onChange={e => setStatusSummaryPeriodTo(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="pt-3 border-t flex gap-2" style={{ borderColor: K.hairline }}>
          <button
            onClick={() => { onClearFilters(); setCurrentCustomerPage(1); }}
            className="flex-1 py-1.5 rounded-md text-xs font-medium border transition-all"
            style={{ background: K.chipBg, color: K.muted, borderColor: K.hairline }}
            onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; }}
          >
            Clear All
          </button>
          <button
            onClick={() => { onApplyFilters(); setCurrentCustomerPage(1); onClose(); }}
            className="flex-1 py-1.5 rounded-md text-xs font-semibold text-white transition-all"
            style={{
              background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
              boxShadow: `0 4px 16px -6px ${APPLE.blue}66`,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Pagination button
// ─────────────────────────────────────────────────────────────────────────────
const PaginationButton = ({ icon: Icon, onClick, disabled, isDark }) => {
  const K = tokens(isDark);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
      style={{
        color: disabled ? K.faint : K.muted,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.ink; } }}
      onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = K.muted; } }}
    >
      <Icon size={14} />
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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
// Outstanding-balance helpers
// ─────────────────────────────────────────────────────────────────────────────
const rowOutstandingBalance = (row) =>
  row.rebateBalanceAllocated !== undefined && row.rebateBalanceAllocated !== null
    ? row.rebateBalanceAllocated
    : (row.rebateAmount || 0) - (row.paidAmount || 0);

const rowHasOutstandingBalance = (row) =>
  Math.abs(rowOutstandingBalance(row)) > 0.005;

// ─────────────────────────────────────────────────────────────────────────────
// Rebate Selection Modal
// ─────────────────────────────────────────────────────────────────────────────
const RebateSelectionModal = ({ isDark, group, onClose, onSelectRebate }) => {
  const modalRef = useRef(null);
  const [viewMode, setViewMode] = useState('quarter');
  const K = tokens(isDark);

  const getQuarterLabel = (row) => {
    if (!row.dateFrom) return 'Unknown Period';
    const d = new Date(row.dateFrom);
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return `Q${q} ${d.getFullYear()}`;
  };

  const quarterGroups = useMemo(() => {
    const map = new Map();
    group.rows.forEach(row => {
      const label = getQuarterLabel(row);
      if (!map.has(label)) {
        const d = row.dateFrom ? new Date(row.dateFrom) : null;
        map.set(label, {
          label,
          year: d ? d.getFullYear() : 0,
          quarter: d ? Math.ceil((d.getMonth() + 1) / 3) : 0,
          rows: []
        });
      }
      map.get(label).rows.push(row);
    });
    return Array.from(map.values())
      .sort((a, b) => (b.year - a.year) || (b.quarter - a.quarter));
  }, [group.rows]);

  const rowsByCode = useMemo(
    () => [...group.rows].sort((a, b) => rebateCodeNum(b.rebateCode) - rebateCodeNum(a.rebateCode)),
    [group.rows]
  );

  const [expandedQuarter, setExpandedQuarter] = useState(null);
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

  const getStatusAccent = (status) => {
    if (status === "Eligible")   return APPLE.green;
    if (status === "Progressing") return APPLE.orange;
    return APPLE.gray;
  };

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="ss-page fixed inset-0 z-[100000] flex items-center justify-center"
      style={{
        backgroundColor: isDark ? "rgba(10,10,14,0.65)" : "rgba(0,0,0,0.4)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      onClick={onClose}
    >
      <style>{FONT}</style>
      <div
        ref={modalRef}
        className="ss-glass ss-pop w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          background: K.glassDeep,
          border: `1px solid ${K.rim}`,
          boxShadow: K.shadow,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: K.hairline }}
        >
          <div>
            <h3 className="text-sm font-bold" style={{ color: K.ink }}>{group.customer}</h3>
            <p className="text-[10px]" style={{ color: K.muted }}>{group.code}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold outline-none transition-all ss-glass"
              style={{
                background: K.chipBg,
                border: `1px solid ${K.hairline}`,
                color: K.ink,
              }}
            >
              <option value="rebateCode">By Rebate Code</option>
              <option value="quarter">By Quarter</option>
            </select>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
              style={{ background: K.chipBg, color: K.muted }}
              onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hairline; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 ss-scroll">
          {(() => {
            const renderRow = (row, idx) => {
              const van = isVanRow(row);
              const status = van ? getSimplifiedStatus(row) : null;
              const statusAccent = status ? getStatusAccent(status) : null;
              const activeAccent = row.isActive ? APPLE.green : APPLE.gray;
              const unsettled = row.isActive === false && rowHasOutstandingBalance(row);
              return (
                <button
                  key={idx}
                  onClick={() => onSelectRebate(row)}
                  className="w-full text-left p-3 rounded-lg border transition-all"
                  style={{
                    background: K.glass,
                    borderColor: K.hairline,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${APPLE.blue}55`; e.currentTarget.style.background = K.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = K.hairline; e.currentTarget.style.background = K.glass; }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm" style={{ color: K.ink }}>{row.rebateCode || "—"}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold border"
                          style={{
                            background: `${activeAccent}1c`,
                            color: activeAccent,
                            borderColor: `${activeAccent}33`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: activeAccent }} />
                          {row.isActive ? "Active" : "Inactive"}
                        </span>
                        {unsettled && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold border"
                            style={{
                              background: `${APPLE.orange}1c`,
                              color: APPLE.orange,
                              borderColor: `${APPLE.orange}33`,
                            }}
                            title="Closed / inactive but still carries an outstanding balance"
                          >
                            <Wallet size={9} />
                            Unsettled
                          </span>
                        )}
                        {van && status && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold border"
                            style={{
                              background: `${statusAccent}1c`,
                              color: statusAccent,
                              borderColor: `${statusAccent}33`,
                            }}
                          >
                            {status === "Eligible" && <CheckCircle size={9} />}
                            {status === "Progressing" && <Activity size={9} />}
                            {status === "Starting" && <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusAccent }} />}
                            {status}
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: K.faint }}>{row.rebateType}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xs ss-num" style={{ color: K.ink }}>{fmt(row.rebateAmount)}</div>
                    </div>
                  </div>
                  {row.dateFrom && row.dateTo && (
                    <div className="text-[9px] mt-1" style={{ color: K.faint }}>
                      {new Date(row.dateFrom).toLocaleDateString()} – {new Date(row.dateTo).toLocaleDateString()}
                    </div>
                  )}
                </button>
              );
            };

            if (viewMode === 'rebateCode') {
              return <div className="space-y-1">{rowsByCode.map((row, idx) => renderRow(row, idx))}</div>;
            }

            return (
              <div className="space-y-1.5">
                {quarterGroups.map(qg => (
                  <div
                    key={qg.label}
                    className="rounded-lg border overflow-hidden"
                    style={{ borderColor: K.hairline, background: K.glass }}
                  >
                    <button
                      onClick={() => setExpandedQuarter(expandedQuarter === qg.label ? null : qg.label)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.background = K.chipBg}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <span className="text-xs font-bold" style={{ color: K.ink }}>{qg.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px]" style={{ color: K.faint }}>
                          {qg.rows.length} rebate{qg.rows.length > 1 ? 's' : ''}
                        </span>
                        <ChevronDown
                          size={13}
                          className={`transition-transform ${expandedQuarter === qg.label ? 'rotate-180' : ''}`}
                          style={{ color: K.faint }}
                        />
                      </div>
                    </button>
                    {expandedQuarter === qg.label && (
                      <div className="px-2 pb-2 pt-1 space-y-1 border-t" style={{ borderColor: K.hairline }}>
                        {qg.rows.map((row, idx) => renderRow(row, idx))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// StatusSummary Component
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
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const filterBtnRef = useRef(null);
  const isDark       = theme === "dark";
  const K            = tokens(isDark);
  const hasOnFetchData = typeof onFetchData === "function";
  const { fetchError, countdown, manualRefresh } = useBackgroundPoll({
    onFetch: hasOnFetchData ? onFetchData : async () => {},
    intervalMs: fetchIntervalMs,
    enabled: hasOnFetchData && autoFetchEnabled,
  });
  useEffect(() => {
    if (hasOnFetchData && autoFetchEnabled) manualRefresh();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isQtr = (row) => ["Quarterly", "quarterly", "Q"].includes(row.frequency);

  // ── Money formatter ────────────────────────────────────────────────────────
  const EPS = 0.005;
  const fmt = (n, { paren = false } = {}) => {
    const num = Number(n) || 0;
    const abs = Math.abs(num);
    const formatted = abs.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (num < -EPS) return paren ? `(₱${formatted})` : `-₱${formatted}`;
    if (num < 0) return `₱0.00`;
    return `₱${formatted}`;
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

    const matchesStatus = (row) => {
      if (selectedProgramStatus === "Active")   return row.isActive === true;
      if (selectedProgramStatus === "Inactive") return row.isActive === false;
      return true;
    };

    return customerGroups
      .map(group => {
        const matchingRows = group.rows.filter(matchesStatus);

        const closedWithBalance = group.rows.filter(
          row =>
            row.isActive === false &&
            !matchesStatus(row) &&
            rowHasOutstandingBalance(row)
        );

        if (matchingRows.length === 0 && closedWithBalance.length === 0) {
          return null;
        }

        const keep = new Set([...matchingRows, ...closedWithBalance]);
        const filteredRows = group.rows.filter(row => keep.has(row));

        const totalRebateAmount = filteredRows.reduce((s, r) => s + (r.rebateAmount || 0), 0);
        const totalPaidAmount   = filteredRows.reduce((s, r) => s + (r.paidAmount || 0), 0);
        const totalBalance      = totalRebateAmount - totalPaidAmount;

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

  const rowStyle = {
    display: "grid",
    gridTemplateColumns: GRID_6,
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
    const rebateCodes = [
      ...new Set(
        (group.rows || [])
          .map(r => r.rebateCode)
          .filter(Boolean)
      ),
    ];

    onCustomerClick({
      ...group,
      customerCode:  group.code,
      customerName:  group.customer,
      customerAgent: group.agent,
      rebateCodes,
    });
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
      Fixed:       APPLE.blue,
      Incremental: APPLE.purple,
      Percentage:  APPLE.orange,
    };
    const accent = map[type] || APPLE.gray;
    return (
      <span
        className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold whitespace-nowrap border"
        style={{
          background: `${accent}1c`,
          color: accent,
          borderColor: `${accent}33`,
        }}
      >
        {type || "?"}
      </span>
    );
  };

  const LoadingSkeleton = () => {
    const numCols = 6;
    return (
      <div className="animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={rowStyle}
            className="px-4 py-3 border-b"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex-shrink-0" style={{ background: K.chipBg }} />
              <div className="flex-1 space-y-1 min-w-0">
                <div className="h-3 w-20 rounded" style={{ background: K.chipBg }} />
                <div className="h-2 w-14 rounded" style={{ background: K.chipBg }} />
              </div>
            </div>
            {[...Array(numCols - 1)].map((__, j) => (
              <div key={j} className="h-4 w-14 rounded mx-auto" style={{ background: K.chipBg }} />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const CustomerGroupRow = ({ group }) => {
    const hasActive = group.rows.some(r => r.isActive === true);
    const hasInactive = group.rows.some(r => r.isActive === false);
    let statusLabel = 'Inactive';
    let statusAccent = APPLE.gray;
    if (hasActive && !hasInactive) { statusLabel = 'Active'; statusAccent = APPLE.green; }
    else if (hasActive && hasInactive) { statusLabel = 'Mixed'; statusAccent = APPLE.orange; }

    const isNegativeBalance = group.totalBalance < -EPS;

    const hasClosedWithBalance = group.rows.some(
      r => r.isActive === false && rowHasOutstandingBalance(r)
    );

    return (
      <div
        style={{
          ...rowStyle,
          borderColor: K.hairline,
        }}
        className="px-4 py-3 text-xs transition-all duration-150 border-b cursor-pointer"
        onClick={() => handleCustomerClick(group)}
        onMouseEnter={(e) => e.currentTarget.style.background = K.chipBg}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        {/* Customer */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[11px] flex-shrink-0"
            style={{
              background: group.color || `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
              color: "white",
            }}
          >
            {group.customer?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate text-xs leading-tight" style={{ color: K.ink }} title={group.customer || "Unknown Customer"}>
              {group.customer || "Unknown Customer"}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] truncate" style={{ color: K.muted }}>{group.code || "No Code"}</span>
              {group.rebateCount > 1 && (
                <span
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[9px] font-semibold border flex-shrink-0"
                  style={{ background: K.chipBg, color: K.muted, borderColor: K.hairline }}
                >
                  <Layers size={8} />{group.rebateCount}
                </span>
              )}
              {hasClosedWithBalance && (
                <span
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[9px] font-semibold border flex-shrink-0"
                  style={{
                    background: `${APPLE.orange}1c`,
                    color: APPLE.orange,
                    borderColor: `${APPLE.orange}33`,
                  }}
                  title="Program is closed / inactive but still carries an outstanding balance"
                >
                  <Wallet size={8} />Unsettled
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold border"
                style={{
                  background: `${statusAccent}1c`,
                  color: statusAccent,
                  borderColor: `${statusAccent}33`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusAccent }} />
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
        {/* Agent */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[11px] flex-shrink-0"
            style={{
              background: `linear-gradient(155deg, ${APPLE.orange} 0%, ${APPLE.red} 100%)`,
              color: "white",
            }}
          >
            {group.agentInitial?.charAt(0).toUpperCase() || "?"}
          </div>
          <span className="font-medium truncate text-xs" style={{ color: K.ink }} title={group.agentDisplay}>
            {group.agentDisplay}
          </span>
        </div>
        {/* Type */}
        <div className="flex justify-center">
          {group.rebateTypes.length === 1 ? (
            <RebateTypeBadge type={group.rebateTypes[0]} />
          ) : group.rebateTypes.length > 1 ? (
            <div className="flex flex-wrap gap-0.5 justify-center">
              {group.rebateTypes.slice(0, 2).map(t => <RebateTypeBadge key={t} type={t} />)}
              {group.rebateTypes.length > 2 && (
                <span
                  className="px-1 py-0.5 rounded-md text-[9px] font-semibold border"
                  style={{ background: K.chipBg, color: K.faint, borderColor: K.hairline }}
                >
                  +{group.rebateTypes.length - 2}
                </span>
              )}
            </div>
          ) : <span style={{ color: K.faint }}>—</span>}
        </div>
        {/* Amount — right aligned */}
        <div className="text-right overflow-hidden pr-3">
          <span className="ss-num font-bold text-xs block truncate" style={{ color: K.ink }}>
            {fmt(group.totalRebateAmount)}
          </span>
        </div>
        {/* Released — right aligned */}
        <div className="text-right overflow-hidden pr-3">
          <span className="ss-num font-bold text-xs block truncate" style={{ color: K.ink }}>
            {fmt(group.totalPaidAmount)}
          </span>
        </div>
        {/* Balance — right aligned */}
        <div className="text-right overflow-hidden pr-3">
          <span
            className="ss-num font-bold text-xs block truncate"
            style={{ color: isNegativeBalance ? APPLE.red : K.ink }}
            title={isNegativeBalance ? "Over-released" : undefined}
          >
            {fmt(group.totalBalance, { paren: true })}
          </span>
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="ss-page ss-glass rounded-xl overflow-visible mb-6"
      style={{
        background: K.glass,
        border: `1px solid ${K.hairline}`,
        boxShadow: K.shadow,
        minWidth: 0,
        width: "100%",
      }}
    >
      <style>{FONT}</style>

      {/* Toolbar */}
      <div
        className="flex flex-wrap gap-2 items-center justify-between px-4 py-3 border-b rounded-t-xl"
        style={{ borderColor: K.hairline }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: `linear-gradient(155deg, ${APPLE.green} 0%, #1D9E3F 100%)`,
              boxShadow: `0 4px 12px -4px ${APPLE.green}88`,
            }}
          >
            <Activity size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none" style={{ color: K.ink }}>Customer Summary</h1>
            <p className="text-[10px] mt-0.5" style={{ color: K.muted }}>
              {filteredGroups.length} customer{filteredGroups.length !== 1 ? "s" : ""} · {sortedRows.length} rebate{sortedRows.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              strokeWidth={2.5}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: isDark ? "#98989F" : "#48484A", zIndex: 2 }}
              stroke={isDark ? "#98989F" : "#48484A"}
            />
            <input
              type="text"
              placeholder="Search customers…"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentCustomerPage(1); }}
              className="pl-8 pr-7 py-1.5 text-xs rounded-md outline-none transition-all"
              style={{
                background: K.glass,
                border: `1px solid ${K.hairline}`,
                color: K.ink,
                width: 210,
                position: "relative",
                zIndex: 1,
              }}
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(""); setCurrentCustomerPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: isDark ? "#98989F" : "#6E6E73", zIndex: 2 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = APPLE.red)}
                onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? "#98989F" : "#6E6E73")}
              >
                <X size={11} />
              </button>
            )}
          </div>
          <button
            ref={filterBtnRef}
            onClick={() => setShowFilters(v => !v)}
            className="px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 font-medium transition-all"
            style={{
              background: showFilters ? `${APPLE.blue}1c` : K.chipBg,
              color: showFilters ? APPLE.blue : K.muted,
              border: `1px solid ${showFilters ? `${APPLE.blue}55` : K.hairline}`,
            }}
            onMouseEnter={(e) => { if (!showFilters) { e.currentTarget.style.background = K.hover; e.currentTarget.style.color = K.ink; } }}
            onMouseLeave={(e) => { if (!showFilters) { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.muted; } }}
          >
            <Filter size={12} />
            Filters
            {hasFilters && <span className="w-2 h-2 rounded-full" style={{ background: APPLE.blue }} />}
          </button>
        </div>
      </div>

      {/* Filter panel portal */}
      {showFilters && (
        <FilterPanel
          isDark={isDark} K={K}
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
        <div
          className="px-4 py-2 text-xs flex items-center gap-2 border-b"
          style={{
            background: `${APPLE.red}14`,
            borderColor: `${APPLE.red}33`,
            color: APPLE.red,
          }}
        >
          <WifiOff size={12} />
          <span>Auto-refresh failed: {fetchError}. Retry in {countdown}s.</span>
          <button onClick={manualRefresh} className="ml-auto underline font-medium">Retry now</button>
        </div>
      )}

      {/* Table header */}
      <div
        style={rowStyle}
        className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b"
      >
        <div className="flex items-center gap-1.5 pl-0">
          <User size={10} style={{ color: K.faint }} /><span style={{ color: K.muted }}>Customer</span>
        </div>
        <div className="flex items-center gap-1.5">
          <UserCheck size={10} style={{ color: K.faint }} /><span style={{ color: K.muted }}>Agent</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <Tag size={10} style={{ color: K.faint }} /><span style={{ color: K.muted }}>Type</span>
        </div>
        <div className="flex items-center gap-1.5 justify-end pr-3">
          <PhilippinePeso size={10} style={{ color: K.faint }} /><span style={{ color: K.muted }}>Total Rebates Earned</span>
        </div>
        <div className="flex items-center gap-1.5 justify-end pr-3">
          <CreditCard size={10} style={{ color: K.faint }} /><span style={{ color: K.muted }}>Total Released</span>
        </div>
        <div className="flex items-center gap-1.5 justify-end pr-3">
          <Wallet size={10} style={{ color: K.faint }} /><span style={{ color: K.muted }}>Balance</span>
        </div>
      </div>

      {/* Table body */}
      <div
        className={`transition-opacity duration-150 ${pageLoading ? "opacity-50" : "opacity-100"}`}
        style={{ overflowX: "auto", minWidth: 0 }}
      >
        {isLoading && paginatedGroups.length === 0 ? (
          <LoadingSkeleton />
        ) : paginatedGroups.length > 0 ? (
          paginatedGroups.map(group => <CustomerGroupRow key={group.key} group={group} />)
        ) : (
          <div className="py-16 px-4 text-center">
            <div
              className="w-14 h-14 mx-auto rounded-lg flex items-center justify-center mb-4"
              style={{ background: K.chipBg }}
            >
              <Users size={22} style={{ color: K.faint }} />
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: K.ink }}>No Customers Found</h3>
            <p className="text-xs max-w-xs mx-auto" style={{ color: K.muted }}>
              No customers match your current search criteria.
            </p>
            {hasFilters && (
              <button
                onClick={() => { onClearFilters(); setCurrentCustomerPage(1); }}
                className="mt-3 px-4 py-1.5 text-xs font-medium text-white rounded-md transition-colors"
                style={{
                  background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                  boxShadow: `0 4px 16px -6px ${APPLE.blue}66`,
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {customerGroups.length > 0 && (
        <div
          className="flex flex-wrap gap-2 items-center justify-between px-4 py-2.5 border-t rounded-b-xl"
          style={{ borderColor: K.hairline }}
        >
          <p className="text-[11px]" style={{ color: K.muted }}>
            Showing{" "}
            <span className="font-semibold" style={{ color: K.ink }}>
              {(currentCustomerPage - 1) * itemsPerCustomerPage + 1}–{Math.min(currentCustomerPage * itemsPerCustomerPage, filteredGroups.length)}
            </span>{" "}
            of{" "}
            <span className="font-semibold" style={{ color: K.ink }}>{filteredGroups.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <PaginationButton icon={ChevronsLeft}  onClick={() => handlePageChange(1)}                              disabled={currentCustomerPage === 1 || pageLoading}          isDark={isDark} />
            <PaginationButton icon={ChevronLeft}   onClick={() => handlePageChange(currentCustomerPage - 1)}         disabled={currentCustomerPage === 1 || pageLoading}          isDark={isDark} />
            {getPageNums(currentCustomerPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="w-7 text-center text-xs" style={{ color: K.faint }}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  disabled={pageLoading}
                  className="w-7 h-7 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: currentCustomerPage === p
                      ? `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`
                      : "transparent",
                    color: currentCustomerPage === p ? "#FFFFFF" : K.muted,
                    boxShadow: currentCustomerPage === p ? `0 4px 12px -4px ${APPLE.blue}88` : "none",
                    opacity: pageLoading ? 0.5 : 1,
                    cursor: pageLoading ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={(e) => { if (currentCustomerPage !== p && !pageLoading) { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.ink; } }}
                  onMouseLeave={(e) => { if (currentCustomerPage !== p && !pageLoading) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = K.muted; } }}
                >
                  {p}
                </button>
              )
            )}
            <PaginationButton icon={ChevronRight}  onClick={() => handlePageChange(currentCustomerPage + 1)}         disabled={currentCustomerPage === totalPages || pageLoading} isDark={isDark} />
            <PaginationButton icon={ChevronsRight} onClick={() => handlePageChange(totalPages)}                     disabled={currentCustomerPage === totalPages || pageLoading} isDark={isDark} />
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(StatusSummary);