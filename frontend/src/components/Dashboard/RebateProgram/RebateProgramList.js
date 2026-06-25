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
  Lock,          // ← NEW
} from "lucide-react";
import ConfirmationModal from "../../common/ConfirmationModal";

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
  const map = {
    Fixed: {
      light: "bg-blue-50 text-blue-700 border-blue-200",
      dark: "bg-blue-900/40 text-blue-300 border-blue-700/50"
    },
    Incremental: {
      light: "bg-violet-50 text-violet-700 border-violet-200",
      dark: "bg-violet-900/40 text-violet-300 border-violet-700/50"
    },
    Percentage: {
      light: "bg-amber-50 text-amber-700 border-amber-200",
      dark: "bg-amber-900/40 text-amber-300 border-amber-700/50"
    }
  };
  
  const styles = map[type] || {
    light: "bg-slate-50 text-slate-600 border-slate-200",
    dark: "bg-slate-800/60 text-slate-400 border-slate-700/50"
  };
  
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border ${
        isDark ? styles.dark : styles.light
      }`}
    >
      {type}
    </span>
  );
};

const Chip = ({ label, color, isDark, onRemove }) => {
  const colors = {
    blue:    isDark ? "bg-blue-900/40 text-blue-300 border-blue-700/50"          : "bg-blue-50 text-blue-700 border-blue-200",
    emerald: isDark ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/50" : "bg-emerald-50 text-emerald-700 border-emerald-200",
    violet:  isDark ? "bg-violet-900/40 text-violet-300 border-violet-700/50"    : "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[color]}`}
    >
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity">
        <X size={9} />
      </button>
    </span>
  );
};

const PaginationButton = ({ icon: Icon, onClick, disabled, isDark }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
      disabled
        ? isDark ? "text-slate-600 cursor-not-allowed" : "text-slate-300 cursor-not-allowed"
        : isDark ? "text-slate-300 hover:bg-slate-700"  : "text-slate-600 hover:bg-slate-100"
    }`}
  >
    <Icon size={14} />
  </button>
);

// ─── Filter Panel ─────────────────────────────────────────────────────────────
const FilterPanel = ({
  isDark, T,
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

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      style={{ position: "absolute", top: pos.top, right: pos.right, zIndex: 99999 }}
      className={`w-80 rounded-xl border p-4 shadow-2xl ${T.popup}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-xs font-bold ${T.textPrimary}`}>Filter &amp; Columns</h3>
        <button onClick={onClose} className={`p-1 rounded hover:bg-slate-100 transition-colors ${T.textSecondary}`}>
          <X size={13} />
        </button>
      </div>
      <div className="space-y-4">
        {/* Rebate Type */}
        <div>
          <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ${T.textSecondary}`}>
            Rebate Type
          </label>
          <div className="flex flex-wrap gap-1">
            {["All", "Fixed", "Incremental", "Percentage"].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedRebateTypeFilter(t)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-all ${
                  selectedRebateTypeFilter === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : isDark
                      ? "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {/* Status */}
        <div>
          <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ${T.textSecondary}`}>
            Status
          </label>
          <div className="flex gap-1">
            {["All", "Active", "Inactive"].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedRebateStatusFilter(s)}
                className={`flex-1 py-1 rounded text-[11px] font-medium border transition-all ${
                  selectedRebateStatusFilter === s
                    ? s === "Active"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : s === "Inactive"
                        ? "bg-slate-500 text-white border-slate-500"
                        : "bg-blue-600 text-white border-blue-600"
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
        {/* Date Range */}
        <div>
          <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ${T.textSecondary}`}>
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={`text-[10px] mb-0.5 ${T.textMuted}`}>From</p>
              <input
                type="date"
                value={rebateDateFrom}
                onChange={(e) => setRebateDateFrom(e.target.value)}
                className={`w-full px-2 py-1 text-xs border rounded-lg outline-none transition-all ${T.input}`}
              />
            </div>
            <div>
              <p className={`text-[10px] mb-0.5 ${T.textMuted}`}>To</p>
              <input
                type="date"
                value={rebateDateTo}
                onChange={(e) => setRebateDateTo(e.target.value)}
                className={`w-full px-2 py-1 text-xs border rounded-lg outline-none transition-all ${T.input}`}
              />
            </div>
          </div>
        </div>
        {/* Column Visibility */}
        <div className={`pt-3 border-t ${isDark ? "border-slate-700" : "border-slate-100"}`}>
          <label className={`text-[10px] font-bold uppercase tracking-widest mb-2 block ${T.textSecondary}`}>
            Visible Columns
          </label>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {allColumns.filter((c) => !c.always).map((c) => (
              <label key={c.key} className={`flex items-center gap-2 py-0.5 cursor-pointer text-xs ${T.textPrimary}`}>
                <input
                  type="checkbox"
                  checked={!!columnVisibility[c.key]}
                  onChange={() => setColumnVisibility((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
                  className="accent-blue-600"
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        {/* Actions */}
        <div className={`pt-3 border-t flex gap-2 ${isDark ? "border-slate-700" : "border-slate-100"}`}>
          <button
            onClick={() => { onClearFilters(); setCurrentPage(1); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${T.btn}`}
          >
            Clear All
          </button>
          <button
            onClick={() => { onApplyFilters(); setCurrentPage(1); onClose(); }}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
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
// NEW: accepts `canUpdate` — when false, renders a read-only locked badge.
const StatusDropdown = ({ active, isDark, canUpdate, onRequestChange }) => {
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
    if (!canUpdate) return;          // ← guard: do nothing if unauthorized
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    }
    setOpen((v) => !v);
  };

  // ── Read-only badge (no permission) ───────────────────────────────────────
  if (!canUpdate) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide border cursor-not-allowed ${
            active
              ? isDark
                ? "bg-emerald-900/30 text-emerald-300 border-emerald-700/50"
                : "bg-emerald-50 text-emerald-600 border-emerald-200"
              : isDark
                ? "bg-slate-800/50 text-slate-400 border-slate-700/50"
                : "bg-slate-100 text-slate-400 border-slate-200"
          }`}
          title="You don't have permission to change the status"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full inline-block ${
              active ? "bg-emerald-500" : "bg-slate-500"
            }`}
          />
          {active ? "Active" : "Inactive"}
          {/* Lock icon: visually indicates the field is restricted */}
          <Lock
            size={9}
            className={`ml-0.5 ${
              active
                ? isDark ? "text-emerald-600/70" : "text-emerald-400"
                : isDark ? "text-slate-500"   : "text-slate-300"
            }`}
          />
        </span>
      </div>
    );
  }

  // ── Interactive dropdown (has permission) ─────────────────────────────────
  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide border transition-colors ${
          active
            ? isDark
              ? "bg-emerald-900/30 text-emerald-300 border-emerald-700/50 hover:bg-emerald-800/40"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
            : isDark
              ? "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50"
              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full inline-block ${
            active ? "bg-emerald-500 animate-pulse" : "bg-slate-500"
          }`}
        />
        {active ? "Active" : "Inactive"}
        <ChevronDown size={10} className="ml-0.5 opacity-60" />
      </button>

      {open &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            style={{ position: "absolute", top: pos.top, left: pos.left, zIndex: 99999 }}
            className={`w-28 rounded-lg border py-1 shadow-lg ${
              isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            {[
              { label: "Active",   value: true  },
              { label: "Inactive", value: false },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => {
                  setOpen(false);
                  if (opt.value !== active) onRequestChange(opt.value);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  opt.value === active
                    ? isDark 
                      ? "text-emerald-300 bg-emerald-900/20" 
                      : "text-blue-600 bg-blue-50"
                    : isDark 
                      ? "text-slate-300 hover:bg-slate-700/70" 
                      : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${opt.value ? "bg-emerald-500" : "bg-slate-500"}`} />
                {opt.label}
                {opt.value === active && <CheckCircle2 size={10} className="ml-auto" />}
              </button>
            ))}
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
  // ── Authorization ──────────────────────────────────────────────────────────
  // Pass `false` to make the status column read-only for this user/role.
  // Defaults to `true` so existing usages are unaffected.
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
  const pageSize     = 10;

  // ── Sorting ────────────────────────────────────────────────────────────────
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setCurrentPage(1);
  };
  const sorted = [...filteredRebates].sort((a, b) => {
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
  // Guard: only fires when canUpdateStatus is true — StatusDropdown also
  // prevents the click, but this is a second layer of protection.
  const requestStatusChange = useCallback(
    (code, currentActive, newActive) => {
      if (!canUpdateStatus) return;             // ← authorization guard

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
    textPrimary:   isDark ? "text-slate-100" : "text-slate-800",
    textSecondary: isDark ? "text-slate-400" : "text-slate-500",
    textMuted:     isDark ? "text-slate-500" : "text-slate-400",
    divider:       isDark ? "divide-slate-700" : "divide-slate-100",
    btn:           isDark
      ? "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500"
      : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400",
    popup:         isDark ? "bg-slate-800 border-slate-700 shadow-2xl" : "bg-white border-slate-200 shadow-xl",
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
      <div className={`rounded-xl border shadow-sm overflow-visible font-sans mb-6 ${T.root}`}>
        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className={`flex flex-wrap gap-2 items-center justify-between px-4 py-3 border-b rounded-t-xl ${T.headerBg}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow">
              <BarChart3 size={15} className="text-white" />
            </div>
            <div>
              <h1 className={`text-sm font-bold leading-none ${T.textPrimary}`}>Rebate Programs</h1>
              <p className={`text-[10px] mt-0.5 ${T.textSecondary}`}>Manage all rebate programs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${T.textMuted}`} />
              <input
                type="text"
                placeholder="Search rebates…"
                value={rebateSearchTerm}
                onChange={(e) => { setRebateSearchTerm(e.target.value); setCurrentPage(1); }}
                className={`pl-8 pr-7 py-1.5 text-xs border rounded-lg outline-none transition-all focus:ring-2 w-52 ${T.input}`}
              />
              {rebateSearchTerm && (
                <button
                  onClick={() => { setRebateSearchTerm(""); setCurrentPage(1); }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${T.textMuted} hover:text-red-500 transition-colors`}
                >
                  <X size={11} />
                </button>
              )}
            </div>
            {/* Filter button */}
            <button
              ref={filterBtnRef}
              onClick={() => setShowFilters((v) => !v)}
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

        {/* Filter panel via portal */}
        {showFilters && (
          <FilterPanel
            isDark={isDark} T={T}
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
            className={`px-4 py-2 border-b flex flex-wrap gap-1.5 items-center ${
              isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"
            }`}
          >
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${T.textMuted}`}>Active:</span>
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
              className={`text-[10px] underline ml-1 ${T.textSecondary} hover:text-red-500 transition-colors`}
            >
              Clear all
            </button>
          </div>
        )}

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className={`w-full text-xs ${T.tableBg}`}>
            <thead>
              <tr className={`border-b ${T.thead}`}>
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                    className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${T.textSecondary} ${
                      col.sortable ? "cursor-pointer select-none hover:text-blue-500 transition-colors" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <col.icon size={10} />
                      {col.label}
                      {/* Show lock badge next to "Status" header when user cannot update */}
                      {col.key === "status" && !canUpdateStatus && (
                        <span
                          title="You don't have permission to change status"
                          className={`ml-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold border ${
                            isDark
                              ? "bg-slate-700/50 text-slate-400 border-slate-600/50"
                              : "bg-slate-100 text-slate-400 border-slate-200"
                          }`}
                        >
                          <Lock size={8} />
                          Read-only
                        </span>
                      )}
                      {col.sortable && (
                        sortKey === col.key
                          ? sortDir === "asc"
                            ? <ChevronUp size={11} className="text-blue-500" />
                            : <ChevronDown size={11} className="text-blue-500" />
                          : <ArrowUpDown size={10} className={T.textMuted} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${T.divider}`}>
              {paginated.length > 0 ? (
                paginated.map((r) => (
                  <tr key={r.code} className={`transition-colors duration-100 border-b ${T.row}`}>
                    {/* Code */}
                    <td className="px-4 py-2.5">
                      <button onClick={() => onRebateClick(r)} className="flex items-center gap-2 group text-left w-full">
                        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${isDark ? "bg-blue-900/40" : "bg-blue-50"}`}>
                          <Percent size={10} className="text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <span className={`font-semibold group-hover:text-blue-600 transition-colors ${T.textPrimary}`}>
                            {r.code}
                          </span>
                          {r.description && (
                            <p className={`text-[10px] truncate ${T.textMuted}`}>{r.description}</p>
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
                    {/* Status — passes canUpdate so the dropdown knows its mode */}
                    {columnVisibility.status && (
                      <td className="px-4 py-2.5">
                        <StatusDropdown
                          active={r.active}
                          isDark={isDark}
                          canUpdate={canUpdateStatus}           // ← NEW
                          onRequestChange={(newActive) =>
                            requestStatusChange(r.code, r.active, newActive)
                          }
                        />
                      </td>
                    )}
                    {/* Start Date */}
                    {columnVisibility.from && (
                      <td className={`px-4 py-2.5 tabular-nums whitespace-nowrap ${T.textSecondary}`}>
                        {fmtDate(r.from)}
                      </td>
                    )}
                    {/* End Date */}
                    {columnVisibility.to && (
                      <td className={`px-4 py-2.5 tabular-nums whitespace-nowrap ${T.textSecondary}`}>
                        {fmtDate(r.to)}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleCols.length}>
                    <div className={`py-16 px-4 text-center ${isDark ? "bg-slate-900" : "bg-white"}`}>
                      <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                        <HandCoins size={22} className={T.textMuted} />
                      </div>
                      <h3 className={`text-sm font-bold mb-1 ${T.textPrimary}`}>
                        {rebates.length === 0 ? "No Rebate Programs Yet" : "No Results Found"}
                      </h3>
                      <p className={`text-xs max-w-xs mx-auto ${T.textSecondary}`}>
                        {rebates.length === 0
                          ? "Create your first rebate program to get started."
                          : "Try adjusting your search terms or clearing filters."}
                      </p>
                      {hasFilters && (
                        <button
                          onClick={() => { onClearFilters(); setCurrentPage(1); }}
                          className="mt-3 px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
          <div className={`flex flex-wrap gap-2 items-center justify-between px-4 py-2.5 border-t rounded-b-xl ${T.headerBg}`}>
            <p className={`text-[11px] ${T.textSecondary}`}>
              Showing{" "}
              <span className={`font-semibold ${T.textPrimary}`}>
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}
              </span>{" "}
              of{" "}
              <span className={`font-semibold ${T.textPrimary}`}>{sorted.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <PaginationButton icon={ChevronsLeft}  onClick={() => setCurrentPage(1)}                                   disabled={safePage === 1}          isDark={isDark} />
              <PaginationButton icon={ChevronLeft}   onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}          disabled={safePage === 1}          isDark={isDark} />
              {getPageNums(safePage, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} className={`w-7 text-center text-xs ${T.textMuted}`}>…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-all ${
                      safePage === p
                        ? "bg-blue-600 text-white shadow"
                        : isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"
                    }`}
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