// src/components/RebateProgramList.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Search,
  Filter,
  X,
  FileText,
  Tag,
  Activity,
  Percent,
  ChevronDown,
  HandCoins,
  ArrowUpDown,
  ChevronUp,
  Calendar,
  CheckCircle2,
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";
import ConfirmationModal from "../../common/ConfirmationModal";

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
  .rb-page, .rb-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .rb-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  .rb-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
  .rb-scroll::-webkit-scrollbar-thumb { background: rgba(142,142,147,0.4); border-radius: 999px; }
  .rb-scroll::-webkit-scrollbar-track { background: transparent; }
  @keyframes rb-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .rb-pop { animation: rb-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
  .rb-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "lnum" 1; }
`;

// ─── Date range overlap helpers ───────────────────────────────────────────
const toStartOfDay = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const toEndOfDay = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

const overlapsDateRange = (rebateFrom, rebateTo, filterFrom, filterTo) => {
  const fStart = toStartOfDay(filterFrom);
  const fEnd   = toEndOfDay(filterTo);

  if (fStart === null && fEnd === null) return true;

  const rStart = toStartOfDay(rebateFrom);
  const rEnd   = toEndOfDay(rebateTo);

  const rs = rStart === null ? -Infinity : rStart;
  const re = rEnd   === null ?  Infinity : rEnd;
  const fs = fStart === null ? -Infinity : fStart;
  const fe = fEnd   === null ?  Infinity : fEnd;

  return rs <= fe && re >= fs;
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : "—";
const fmtDateShort = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })
    : "—";
const getPageNums = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3)
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const TypeBadge = ({ type, isDark = false }) => {
  const colors = {
    Fixed:       APPLE.blue,
    Incremental: APPLE.purple,
    Percentage:  APPLE.orange,
  };
  const accent = colors[type] || APPLE.gray;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border"
      style={{
        background: `${accent}1c`,
        color: accent,
        borderColor: `${accent}33`,
      }}
    >
      {type}
    </span>
  );
};

const Chip = ({ label, color, isDark, onRemove }) => {
  const colors = {
    blue:    APPLE.blue,
    emerald: APPLE.green,
    violet:  APPLE.purple,
  };
  const accent = colors[color] || APPLE.gray;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border"
      style={{
        background: `${accent}1c`,
        color: accent,
        borderColor: `${accent}33`,
      }}
    >
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity">
        <X size={9} />
      </button>
    </span>
  );
};

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

// ─── Filter Panel ─────────────────────────────────────────────────────────────
const FilterPanel = ({
  isDark, T, K,
  selectedRebateTypeFilter, setSelectedRebateTypeFilter,
  selectedRebateStatusFilter, setSelectedRebateStatusFilter,
  rebateDateFrom, setRebateDateFrom,
  rebateDateTo, setRebateDateTo,
  allColumns, columnVisibility, setColumnVisibility,
  onClearFilters, onApplyFilters,
  setCurrentPage, onClose,
  anchorRef,
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
      className="rb-page rb-glass w-80 rounded-xl p-4 rb-pop"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold" style={{ color: K.ink }}>Filter &amp; Columns</h3>
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
      <div className="space-y-4">
        {/* Rebate Type */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: K.muted }}>
            Rebate Type
          </label>
          <div className="flex flex-wrap gap-1">
            {["All", "Fixed", "Incremental", "Percentage"].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedRebateTypeFilter(t)}
                className="px-2.5 py-0.5 rounded-md text-[11px] border transition-all"
                style={pillStyle(selectedRebateTypeFilter === t, APPLE.blue)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {/* Status */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: K.muted }}>
            Status
          </label>
          <div className="flex gap-1">
            {["All", "Active", "Inactive"].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedRebateStatusFilter(s)}
                className="flex-1 py-1 rounded-md text-[11px] border transition-all"
                style={pillStyle(
                  selectedRebateStatusFilter === s,
                  s === "Active" ? APPLE.green : s === "Inactive" ? APPLE.gray : APPLE.blue
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {/* Date Range */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: K.muted }}>
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] mb-0.5" style={{ color: K.faint }}>From</p>
              <input
                type="date"
                value={rebateDateFrom}
                onChange={(e) => setRebateDateFrom(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded-md outline-none transition-all rb-glass"
                style={{ background: K.glass, border: `1px solid ${K.hairline}`, color: K.ink }}
              />
            </div>
            <div>
              <p className="text-[10px] mb-0.5" style={{ color: K.faint }}>To</p>
              <input
                type="date"
                value={rebateDateTo}
                onChange={(e) => setRebateDateTo(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded-md outline-none transition-all rb-glass"
                style={{ background: K.glass, border: `1px solid ${K.hairline}`, color: K.ink }}
              />
            </div>
          </div>
        </div>
        {/* Column Visibility */}
        <div className="pt-3 border-t" style={{ borderColor: K.hairline }}>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: K.muted }}>
            Visible Columns
          </label>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {allColumns.filter((c) => !c.always).map((c) => (
              <label key={c.key} className="flex items-center gap-2 py-0.5 cursor-pointer text-xs" style={{ color: K.ink }}>
                <input
                  type="checkbox"
                  checked={!!columnVisibility[c.key]}
                  onChange={() => setColumnVisibility((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
                  style={{ accentColor: APPLE.blue }}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        {/* Actions */}
        <div className="pt-3 border-t flex gap-2" style={{ borderColor: K.hairline }}>
          <button
            onClick={() => { onClearFilters(); setCurrentPage(1); }}
            className="flex-1 py-1.5 rounded-md text-xs font-medium border transition-all"
            style={{ background: K.chipBg, color: K.muted, borderColor: K.hairline }}
            onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = K.chipBg; }}
          >
            Clear All
          </button>
          <button
            onClick={() => { onApplyFilters(); setCurrentPage(1); onClose(); }}
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

// ─── Status Dropdown ──────────────────────────────────────────────────────────
const StatusDropdown = ({ active, isDark, canUpdate, onRequestChange }) => {
  const K = tokens(isDark);
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef  = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (!canUpdate) return;
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    }
    setOpen((v) => !v);
  };

  // ── Read-only badge ───────────────────────────────────────────────────────
  if (!canUpdate) {
    const accent = active ? APPLE.green : APPLE.gray;
    return (
      <div className="inline-flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide border cursor-not-allowed"
          style={{
            background: `${accent}1c`,
            color: accent,
            borderColor: `${accent}33`,
          }}
          title="You don't have permission to change the status"
        >
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: accent }} />
          {active ? "Active" : "Inactive"}
          <Lock size={9} className="ml-0.5 opacity-70" />
        </span>
      </div>
    );
  }

  // ── Interactive dropdown ──────────────────────────────────────────────────
  const accent = active ? APPLE.green : APPLE.gray;
  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide border transition-colors"
        style={{
          background: `${accent}1c`,
          color: accent,
          borderColor: `${accent}33`,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = `${accent}2c`)}
        onMouseLeave={(e) => (e.currentTarget.style.background = `${accent}1c`)}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full inline-block ${active ? "animate-pulse" : ""}`}
          style={{ background: accent }}
        />
        {active ? "Active" : "Inactive"}
        <ChevronDown size={10} className="ml-0.5 opacity-60" />
      </button>

      {open &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              zIndex: 99999,
              background: K.glassDeep,
              border: `1px solid ${K.rim}`,
              boxShadow: K.shadow,
              backdropFilter: "blur(28px) saturate(180%)",
              WebkitBackdropFilter: "blur(28px) saturate(180%)",
            }}
            className="rb-page rb-glass w-32 rounded-lg py-1 rb-pop"
          >
            {[
              { label: "Active",   value: true  },
              { label: "Inactive", value: false },
            ].map((opt) => {
              const optAccent = opt.value ? APPLE.green : APPLE.gray;
              return (
                <button
                  key={opt.label}
                  onClick={() => {
                    setOpen(false);
                    if (opt.value !== active) onRequestChange(opt.value);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                  style={{
                    color: opt.value === active ? optAccent : K.muted,
                    background: opt.value === active ? `${optAccent}14` : "transparent",
                  }}
                  onMouseEnter={(e) => { if (opt.value !== active) { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.ink; } }}
                  onMouseLeave={(e) => { if (opt.value !== active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = K.muted; } }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: optAccent }} />
                  {opt.label}
                  {opt.value === active && <CheckCircle2 size={10} className="ml-auto" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const RebateProgramList = ({
  rebates = [],
  filteredRebates = [],
  rebateSearchTerm = "",
  setRebateSearchTerm = () => {},
  selectedRebateTypeFilter = "All",
  setSelectedRebateTypeFilter = () => {},
  selectedRebateStatusFilter = "All",
  setSelectedRebateStatusFilter = () => {},
  rebateDateFrom = "",
  setRebateDateFrom = () => {},
  rebateDateTo = "",
  setRebateDateTo = () => {},
  currentPage = 1,
  setCurrentPage = () => {},
  itemsPerPage = 10,
  theme = "light",
  onRebateClick = () => {},
  onStatusToggle = () => {},
  onClearFilters = () => {},
  onApplyFilters = () => {},
  onLoadRebates = () => {},
  canUpdateStatus = true,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey]         = useState("createdDate");
  const [sortDir, setSortDir]         = useState("desc");
  const [columnVisibility, setColumnVisibility] = useState({
    type:   true,
    status: true,
    from:   true,
    to:     true,
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    variant: "warning",
    confirmLabel: "Confirm",
    onConfirm: () => {},
  });

  const filterBtnRef = useRef(null);
  const isDark       = theme === "dark";
  const K            = tokens(isDark);
  const pageSize     = 10;

  // ── Sorting ────────────────────────────────────────────────────────────────
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };

  // ── Local date‑range filter (overlap‑aware) ──────────────────────────────
  const dateFiltered =
    !rebateDateFrom && !rebateDateTo
      ? filteredRebates
      : filteredRebates.filter((r) =>
          overlapsDateRange(r.from, r.to, rebateDateFrom, rebateDateTo)
        );

  const sorted = [...dateFiltered].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (["from", "to", "createdDate"].includes(sortKey)) { av = new Date(av); bv = new Date(bv); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1  : -1;
    return 0;
  });

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(currentPage, totalPages);
  const paginated  = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ── Filters ────────────────────────────────────────────────────────────────
  const hasFilters =
    selectedRebateTypeFilter !== "All" ||
    selectedRebateStatusFilter !== "All" ||
    rebateDateFrom ||
    rebateDateTo;

  // ── Status toggle with confirmation ───────────────────────────────────────
  const requestStatusChange = useCallback(
    (code, currentActive, newActive) => {
      if (!canUpdateStatus) return;

      const toActive = newActive === true || newActive === 1;
      setConfirmModal({
        isOpen: true,
        variant: toActive ? "success" : "warning",
        title:   toActive ? "Activate Rebate Program?" : "Deactivate Rebate Program?",
        message: toActive
          ? `You are about to activate rebate program "${code}". It will immediately be available for use.`
          : `You are about to deactivate rebate program "${code}". It will no longer be applied to transactions.`,
        confirmLabel: toActive ? "Yes, Activate" : "Yes, Deactivate",
        onConfirm: () => {
          onStatusToggle(code, toActive ? 1 : 0);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    },
    [onStatusToggle, canUpdateStatus]
  );

  const closeConfirm = useCallback(() => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const T = {
    popup: isDark ? "bg-slate-800 border-slate-700 shadow-2xl" : "bg-white border-slate-200 shadow-xl",
  };

  // ── Column definitions ─────────────────────────────────────────────────────
  const allColumns = [
    { key: "code",   label: "Rebate Code", icon: FileText, sortable: true,  always: true },
    { key: "type",   label: "Type",        icon: Tag,      sortable: true  },
    { key: "status", label: "Status",      icon: Activity, sortable: false },
    { key: "from",   label: "Start Date",  icon: Calendar, sortable: true  },
    { key: "to",     label: "End Date",    icon: Calendar, sortable: true  },
  ];
  const visibleCols = allColumns.filter((c) => c.always || columnVisibility[c.key]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{FONT}</style>
      <div
        className="rb-page rb-glass rounded-xl overflow-visible mb-6"
        style={{
          background: K.glass,
          border: `1px solid ${K.hairline}`,
          boxShadow: K.shadow,
        }}
      >
        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div
          className="flex flex-wrap gap-2 items-center justify-between px-4 py-3 border-b rounded-t-xl"
          style={{ borderColor: K.hairline }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                boxShadow: `0 4px 12px -4px ${APPLE.blue}88`,
              }}
            >
              <BarChart3 size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none" style={{ color: K.ink }}>
                Rebate Programs
              </h1>
              <p className="text-[10px] mt-0.5" style={{ color: K.muted }}>
                Manage all rebate programs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: isDark ? "#98989F" : "#48484A", zIndex: 2 }}
              />
              <input
                type="text"
                placeholder="Search rebates…"
                value={rebateSearchTerm}
                onChange={(e) => { setRebateSearchTerm(e.target.value); setCurrentPage(1); }}
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
              {rebateSearchTerm && (
                <button
                  onClick={() => { setRebateSearchTerm(""); setCurrentPage(1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: K.faint, zIndex: 2 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = APPLE.red)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = K.faint)}
                >
                  <X size={11} />
                </button>
              )}
            </div>
            {/* Filter button */}
            <button
              ref={filterBtnRef}
              onClick={() => setShowFilters((v) => !v)}
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

        {/* Filter panel via portal */}
        {showFilters && (
          <FilterPanel
            isDark={isDark} T={T} K={K}
            selectedRebateTypeFilter={selectedRebateTypeFilter}
            setSelectedRebateTypeFilter={setSelectedRebateTypeFilter}
            selectedRebateStatusFilter={selectedRebateStatusFilter}
            setSelectedRebateStatusFilter={setSelectedRebateStatusFilter}
            rebateDateFrom={rebateDateFrom} setRebateDateFrom={setRebateDateFrom}
            rebateDateTo={rebateDateTo}     setRebateDateTo={setRebateDateTo}
            allColumns={allColumns}
            columnVisibility={columnVisibility}
            setColumnVisibility={setColumnVisibility}
            onClearFilters={onClearFilters}
            onApplyFilters={onApplyFilters}
            setCurrentPage={setCurrentPage}
            onClose={() => setShowFilters(false)}
            anchorRef={filterBtnRef}
          />
        )}

        {/* ── Active Filter Chips ───────────────────────────────────────────── */}
        {hasFilters && (
          <div
            className="px-4 py-2 border-b flex flex-wrap gap-1.5 items-center"
            style={{ borderColor: K.hairline, background: `${K.chipBg}` }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: K.faint }}>
              Active:
            </span>
            {selectedRebateTypeFilter !== "All" && (
              <Chip label={`Type: ${selectedRebateTypeFilter}`} color="blue" isDark={isDark}
                onRemove={() => { setSelectedRebateTypeFilter("All"); setCurrentPage(1); }} />
            )}
            {selectedRebateStatusFilter !== "All" && (
              <Chip label={`Status: ${selectedRebateStatusFilter}`} color="emerald" isDark={isDark}
                onRemove={() => { setSelectedRebateStatusFilter("All"); setCurrentPage(1); }} />
            )}
            {rebateDateFrom && (
              <Chip label={`From: ${fmtDateShort(rebateDateFrom)}`} color="violet" isDark={isDark}
                onRemove={() => { setRebateDateFrom(""); setCurrentPage(1); }} />
            )}
            {rebateDateTo && (
              <Chip label={`To: ${fmtDateShort(rebateDateTo)}`} color="violet" isDark={isDark}
                onRemove={() => { setRebateDateTo(""); setCurrentPage(1); }} />
            )}
            <button
              onClick={() => { onClearFilters(); setCurrentPage(1); }}
              className="text-[10px] underline ml-1 transition-colors"
              style={{ color: K.muted }}
              onMouseEnter={(e) => (e.currentTarget.style.color = APPLE.red)}
              onMouseLeave={(e) => (e.currentTarget.style.color = K.muted)}
            >
              Clear all
            </button>
          </div>
        )}

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto rb-scroll">
          <table className="w-full text-xs" style={{ background: "transparent" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: K.hairline, background: `${K.chipBg}` }}>
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                    className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${
                      col.sortable ? "cursor-pointer select-none" : ""
                    }`}
                    style={{ color: col.sortable ? K.muted : K.faint }}
                    onMouseEnter={(e) => { if (col.sortable) e.currentTarget.style.color = APPLE.blue; }}
                    onMouseLeave={(e) => { if (col.sortable) e.currentTarget.style.color = K.muted; }}
                  >
                    <div className="flex items-center gap-1.5">
                      <col.icon size={10} />
                      {col.label}
                      {col.key === "status" && !canUpdateStatus && (
                        <span
                          title="You don't have permission to change status"
                          className="ml-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[9px] font-semibold border"
                          style={{
                            background: K.chipBg,
                            color: K.faint,
                            borderColor: K.hairline,
                          }}
                        >
                          <Lock size={8} />
                          Read-only
                        </span>
                      )}
                      {col.sortable && (
                        sortKey === col.key
                          ? sortDir === "asc"
                            ? <ChevronUp size={11} style={{ color: APPLE.blue }} />
                            : <ChevronDown size={11} style={{ color: APPLE.blue }} />
                          : <ArrowUpDown size={10} style={{ color: K.faint }} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length > 0 ? (
                paginated.map((r) => (
                  <tr
                    key={r.code}
                    className="transition-colors duration-100 border-b"
                    style={{ borderColor: K.hairline }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = K.chipBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Code */}
                    <td className="px-4 py-2.5">
                      <button onClick={() => onRebateClick(r)} className="flex items-center gap-2 group text-left w-full">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: `${APPLE.blue}1c` }}
                        >
                          <Percent size={10} style={{ color: APPLE.blue }} />
                        </div>
                        <div className="min-w-0">
                          <span
                            className="font-semibold transition-colors"
                            style={{ color: K.ink }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = APPLE.blue)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = K.ink)}
                          >
                            {r.code}
                          </span>
                          {r.description && (
                            <p className="text-[10px] truncate" style={{ color: K.faint }}>{r.description}</p>
                          )}
                        </div>
                      </button>
                    </td>
                    {/* Type */}
                    {columnVisibility.type && (
                      <td className="px-4 py-2.5">
                        <TypeBadge type={r.type} isDark={isDark} />
                      </td>
                    )}
                    {/* Status */}
                    {columnVisibility.status && (
                      <td className="px-4 py-2.5">
                        <StatusDropdown
                          active={r.active}
                          isDark={isDark}
                          canUpdate={canUpdateStatus}
                          onRequestChange={(newActive) =>
                            requestStatusChange(r.code, r.active, newActive)
                          }
                        />
                      </td>
                    )}
                    {/* Start Date */}
                    {columnVisibility.from && (
                      <td className="px-4 py-2.5 rb-num whitespace-nowrap" style={{ color: K.muted }}>
                        {fmtDate(r.from)}
                      </td>
                    )}
                    {/* End Date */}
                    {columnVisibility.to && (
                      <td className="px-4 py-2.5 rb-num whitespace-nowrap" style={{ color: K.muted }}>
                        {fmtDate(r.to)}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleCols.length}>
                    <div className="py-16 px-4 text-center">
                      <div
                        className="w-14 h-14 mx-auto rounded-lg flex items-center justify-center mb-4"
                        style={{ background: K.chipBg }}
                      >
                        <HandCoins size={22} style={{ color: K.faint }} />
                      </div>
                      <h3 className="text-sm font-bold mb-1" style={{ color: K.ink }}>
                        {rebates.length === 0 ? "No Rebate Programs Yet" : "No Results Found"}
                      </h3>
                      <p className="text-xs max-w-xs mx-auto" style={{ color: K.muted }}>
                        {rebates.length === 0
                          ? "Create your first rebate program to get started."
                          : "Try adjusting your search terms or clearing filters."}
                      </p>
                      {hasFilters && (
                        <button
                          onClick={() => { onClearFilters(); setCurrentPage(1); }}
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
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {sorted.length > 0 && (
          <div
            className="flex flex-wrap gap-2 items-center justify-between px-4 py-2.5 border-t rounded-b-xl"
            style={{ borderColor: K.hairline }}
          >
            <p className="text-[11px]" style={{ color: K.muted }}>
              Showing{" "}
              <span className="font-semibold" style={{ color: K.ink }}>
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold" style={{ color: K.ink }}>{sorted.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <PaginationButton icon={ChevronsLeft}  onClick={() => setCurrentPage(1)}                                   disabled={safePage === 1}          isDark={isDark} />
              <PaginationButton icon={ChevronLeft}   onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}          disabled={safePage === 1}          isDark={isDark} />
              {getPageNums(safePage, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} className="w-7 text-center text-xs" style={{ color: K.faint }}>…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className="w-7 h-7 rounded-md text-xs font-medium rb-num transition-all"
                    style={{
                      background: safePage === p
                        ? `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`
                        : "transparent",
                      color: safePage === p ? "#FFFFFF" : K.muted,
                      boxShadow: safePage === p ? `0 4px 12px -4px ${APPLE.blue}88` : "none",
                    }}
                    onMouseEnter={(e) => { if (safePage !== p) { e.currentTarget.style.background = K.chipBg; e.currentTarget.style.color = K.ink; } }}
                    onMouseLeave={(e) => { if (safePage !== p) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = K.muted; } }}
                  >
                    {p}
                  </button>
                )
              )}
              <PaginationButton icon={ChevronRight}  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={safePage === totalPages}  isDark={isDark} />
              <PaginationButton icon={ChevronsRight} onClick={() => setCurrentPage(totalPages)}                          disabled={safePage === totalPages}  isDark={isDark} />
            </div>
          </div>
        )}
      </div>

      {/* ── Confirmation Modal ────────────────────────────────────────────── */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel="Cancel"
        theme={theme}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />
    </>
  );
};

export default React.memo(RebateProgramList);