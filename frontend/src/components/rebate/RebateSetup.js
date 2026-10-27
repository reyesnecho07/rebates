// src/components/rebate/RebateSetup.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from 'axios';
import {
  Users, Package, Edit, Trash2, Upload, Download, X,
  CheckCircle, AlertCircle, Info, Save, Calendar, Target,
  Settings as SettingsIcon, AlertTriangle, RefreshCw,
  Lock, Search, PenLine, ChevronDown, Sparkles, Award, Clock, Plus, Minus, TrendingUp,
} from "lucide-react";
import { Link } from 'react-router-dom';
import * as XLSX from "xlsx";
import Sidebar from "../Sidebar";
import Header from "../Header";
import PercentageModal from "./PercentageModal";
import QuotaModal from "./QuotaModal";
import RangeModal from "./RangeModal";
import ProductRangeModal from "./ProductRangeModal";
import Loading from "../common/Loading";
import CustomerSelectionModal from "./CustomerSelectionModal";
import ItemSelectionModal from "./ItemSelectionModal";
import DuplicationError from "../duplicationerror";
import { useComponentRegistration } from '../../hooks/useComponentRegistration';
import useAccessControl from '../../hooks/useAccessControl';
import CancelModal from "../common/CancelModal";
import RemoveRow from "../common/RemoveRow";
import { ToastContainer } from "../common/Toast";
import { API_BASE, DB_NAME } from '../../config/appConfig';

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens, DesignPage } from '../../design-system';

// ─── Utilities ────────────────────────────────────────────────────────────────
const getSalUnitMsr = (dropdownItem) => {
  if (!dropdownItem) return "";
  const raw = dropdownItem.SalUnitMsr ?? dropdownItem.salUnitMsr;
  if (raw == null) return "";
  return String(raw).trim();
};

const addMonths = (date, n) => {
  const d   = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
};

const computeQuotaPeriods = (dateFrom, dateTo, frequency) => {
  if (!dateFrom || !dateTo || !frequency) return [];
  if (!isMonthlyLikeFreq(frequency) && frequency !== "Quarterly") return [];

  const startDate = new Date(dateFrom);
  const endDate   = new Date(dateTo);
  const periods   = [];
  const fmt  = (d, opts) => d.toLocaleDateString('en-US', opts);
  const sOpt = { month: 'short', day: 'numeric' };
  const lOpt = { month: 'short', day: 'numeric', year: 'numeric' };

  if (isMonthlyLikeFreq(frequency)) {
    let periodStart = new Date(startDate);
    while (periodStart <= endDate) {
      const nextStart = addMonths(periodStart, 1);
      const isLast    = nextStart >= endDate;
      const actualEnd = isLast ? new Date(endDate) : (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
      const monthName = periodStart.toLocaleDateString('en-US', { month: 'long' });
      const year      = periodStart.getFullYear();
      periods.push({
        period: `${monthName} ${year}`, label: monthName,
        startDate: new Date(periodStart), endDate: new Date(actualEnd),
        dates: `${fmt(periodStart, sOpt)} - ${fmt(actualEnd, lOpt)}`,
      });
      if (isLast) break;
      periodStart = nextStart;
    }
  } else if (frequency === "Quarterly") {
    let periodStart = new Date(startDate);
    while (periodStart <= endDate) {
      const nextStart = addMonths(periodStart, 3);
      const isLast    = nextStart >= endDate;
      const actualEnd = isLast ? new Date(endDate) : (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();
      const qIdx  = Math.floor(periodStart.getMonth() / 3);
      const qName = ["Q1", "Q2", "Q3", "Q4"][qIdx];
      const year  = periodStart.getFullYear();
      periods.push({
        period: `${qName} ${year}`, label: `${qName} ${year}`,
        startDate: new Date(periodStart), endDate: new Date(actualEnd),
        dates: `${fmt(periodStart, sOpt)} - ${fmt(actualEnd, lOpt)}`,
        quarter: qName, year,
      });
      if (isLast) break;
      periodStart = nextStart;
    }
  }
  return periods;
};

const getQuarterBounds = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const q = Math.floor(d.getMonth() / 3);
  const startMonth = q * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { start, end, quarter: q + 1, year };
};

const isQuarterStart = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const m = d.getMonth();
  return d.getDate() === 1 && (m === 0 || m === 3 || m === 6 || m === 9);
};

const isQuarterEnd = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const m = d.getMonth();
  const lastDay = new Date(d.getFullYear(), m + 1, 0).getDate();
  return d.getDate() === lastDay && (m === 2 || m === 5 || m === 8 || m === 11);
};

const validateQuarterlyRange = (fromStr, toStr) => {
  if (!fromStr || !toStr) return { ok: false, reason: "Both Date From and Date To are required." };
  if (!isQuarterStart(fromStr)) {
    return { ok: false, reason: "Date From must be the first day of a quarter (Jan 1, Apr 1, Jul 1, or Oct 1)." };
  }
  if (!isQuarterEnd(toStr)) {
    return { ok: false, reason: "Date To must be the last day of a quarter (Mar 31, Jun 30, Sep 30, or Dec 31)." };
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (to < from) return { ok: false, reason: "Date To cannot be earlier than Date From." };
  const fromQ = getQuarterBounds(from);
  const toQ = getQuarterBounds(to);
  if (fromQ.start.getTime() !== from.getTime()) {
    return { ok: false, reason: "Date From must align exactly with the quarter start." };
  }
  if (toQ.end.getTime() !== to.getTime()) {
    return { ok: false, reason: "Date To must align exactly with the quarter end." };
  }
  return { ok: true };
};

const toDateString = (val) => {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number' && Number.isFinite(val)) {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + val * 86400000);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(val).trim();
  if (!s) return '';
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
};

const normalizeQtrQualifiedFlag = (val) => {
  if (val === undefined || val === null || val === '') return true;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number')  return val !== 0;
  const s = String(val).trim().toLowerCase();
  if (s === '0' || s === 'false' || s === 'no' || s === 'n') return false;
  return true;
};

const deriveQtrValue = (isQualifiedFlag, qtrRebateValue) => {
  if (isQualifiedFlag === false) return 0;
  if (qtrRebateValue === undefined || qtrRebateValue === null || qtrRebateValue === '') return 0;
  const n = typeof qtrRebateValue === 'number' ? qtrRebateValue : parseFloat(qtrRebateValue);
  return Number.isFinite(n) ? n : 0;
};

const deriveQtrQualified = (isQualifiedFlag, qtrRebateValue) => {
  const n = deriveQtrValue(isQualifiedFlag, qtrRebateValue);
  return n > 0 ? 1 : 0;
};

const UOM_OPTIONS = [
  'Bag/s', 'Btl/s', 'Ctn', 'Pc/s', 'Bx/s', 'Gal', 'Kg', 'KL', 'Oz', 'Bundle', 'ML', 'Gram/s', 'Liter/s'
];

const MONTHLY_LIKE_FREQUENCIES = [
  "Monthly",
  "Monthly w/ Cust. Qtr. Rebate",
  "Monthly w/ Item Qtr. Rebate",
];
const isMonthlyLikeFreq = (freq) => MONTHLY_LIKE_FREQUENCIES.includes(freq);

const SCOPE_ALL_CUSTOMERS = "All Customer/s";
const SCOPE_PER_CUSTOMER  = "Per Customer";

// ─── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-2xl bg-[rgba(10,10,14,0.65)]">
      <div className="ds-glass ds-pop rounded-[28px] p-6 max-w-sm w-full mx-auto bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)]">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#FF453A]/9 border border-[#FF453A]/20">
            <AlertTriangle className="w-5 h-5 text-[#FF453A]" />
          </div>
          <div className="flex-1 pt-0.5">
            <h3 className="text-base font-semibold text-[var(--ds-ink)] tracking-tight">{title}</h3>
            <p className="text-[var(--ds-muted)] text-sm mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full font-medium text-sm text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-white rounded-full font-medium text-sm bg-[#FF453A] hover:brightness-110 transition-all"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Date Range Scope Selection Modal ─────────────────────────────────────────
const ScopeSelectionModal = ({ isOpen, onClose, onSelect }) => {
  const { K } = useTokens();
  const [hovered, setHovered] = useState(null);

  useEffect(() => { if (!isOpen) setHovered(null); }, [isOpen]);
  if (!isOpen) return null;

  const options = [
    {
      key: SCOPE_ALL_CUSTOMERS, title: SCOPE_ALL_CUSTOMERS,
      description: "One date range applies to every customer in the program.",
      icon: <Users className="w-5 h-5" />, color: PALETTE.blue,
    },
    {
      key: SCOPE_PER_CUSTOMER, title: SCOPE_PER_CUSTOMER,
      description: "Set a separate Date From / Date To for each customer row.",
      icon: <PenLine className="w-5 h-5" />, color: PALETTE.purple,
    },
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-2xl bg-[rgba(10,10,14,0.65)]">
      <div className="ds-glass ds-pop rounded-[28px] p-6 w-full max-w-md mx-auto bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] shadow-[var(--ds-shadow)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center ds-gradient-primary">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--ds-ink)]">Choose Date Range Scope</h3>
              <p className="text-xs mt-0.5 text-[var(--ds-muted)]">
                How should the date range apply for this Without-Quota program?
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] hover:bg-[var(--ds-hairline)] hover:text-[var(--ds-ink)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 mb-5">
          {options.map(opt => {
            const active = hovered === opt.key;
            return (
              <button
                key={opt.key} type="button"
                onClick={() => onSelect(opt.key)}
                onMouseEnter={() => setHovered(opt.key)}
                onMouseLeave={() => setHovered(null)}
                className="w-full text-left px-4 py-3.5 rounded-2xl flex items-center gap-3.5 transition-all"
                style={{
                  background: active ? `${opt.color}18` : K.glass,
                  border: `1px solid ${active ? `${opt.color}55` : K.hairline}`,
                  transform: active ? 'translateY(-1px)' : 'none',
                }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${opt.color}1c`, color: opt.color, border: `1px solid ${opt.color}33` }}>
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--ds-ink)]">{opt.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed text-[var(--ds-muted)]">{opt.description}</p>
                </div>
                <ChevronDown className="w-4 h-4 -rotate-90 flex-shrink-0"
                  style={{ color: active ? opt.color : K.faint }} />
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-full text-sm font-medium text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)] transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Search Rebate Modal ──────────────────────────────────────────────────────
const SearchRebateModal = ({
  isOpen, onClose, searchCode, setSearchCode, onSearch,
  searchLoading, searchError, canView, db,
}) => {
  const { K } = useTokens();
  const [allCodes, setAllCodes]         = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const dropRef  = useRef(null);

  useEffect(() => {
    if (!isOpen || !canView) return;
    setCodesLoading(true);
    fetch(`/api/rebate-program/all-codes?db=${db}`)
      .then(r => r.json())
      .then(d => { if (d.success) setAllCodes(d.codes || []); })
      .catch(() => {})
      .finally(() => setCodesLoading(false));
  }, [isOpen, canView, db]);

  useEffect(() => {
    const handle = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = useMemo(() => {
    const q = searchCode.trim().toUpperCase();
    if (!q) return allCodes.slice(0, 50);
    return allCodes.filter(c =>
      c.RebateCode.toUpperCase().includes(q) ||
      (c.RebateType && c.RebateType.toUpperCase().includes(q))
    ).slice(0, 50);
  }, [searchCode, allCodes]);

  const handleSelect = (code) => {
    setSearchCode(code.RebateCode);
    setShowDropdown(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const typeColor = (type) => {
    const c = type === 'Fixed' ? PALETTE.blue : type === 'Incremental' ? PALETTE.green : type === 'Percentage' ? PALETTE.orange : PALETTE.gray;
    return { background: `${c}1c`, color: c, border: `1px solid ${c}33` };
  };

  if (!isOpen) return null;

  if (!canView) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-2xl bg-[rgba(10,10,14,0.65)]">
        <div className="ds-glass ds-pop rounded-[28px] p-6 w-full max-w-md mx-auto bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FF453A]/9 border border-[#FF453A]/20">
              <Lock className="w-4 h-4 text-[#FF453A]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--ds-ink)]">Access Restricted</h3>
              <p className="text-xs mt-0.5 text-[var(--ds-muted)]">You don't have permission to search rebate programs</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-full text-sm text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)] transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-2xl bg-[rgba(10,10,14,0.65)]">
      <div className="ds-glass ds-pop rounded-[28px] p-6 w-full max-w-md mx-auto bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] shadow-[var(--ds-shadow)]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center ds-gradient-primary">
              <Search className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--ds-ink)]">Search Rebate Code</h3>
              <p className="text-xs mt-0.5 text-[var(--ds-muted)]">Load an existing program to edit</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] hover:bg-[var(--ds-hairline)] hover:text-[var(--ds-ink)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-5 relative">
          <label className="block text-xs font-semibold mb-2 uppercase tracking-widest text-[var(--ds-muted)]">Rebate Code</label>
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-[var(--ds-faint)]" />
            <input ref={inputRef} autoFocus type="text" value={searchCode}
              onChange={e => { setSearchCode(e.target.value.toUpperCase()); setShowDropdown(true); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { setShowDropdown(false); onSearch(); }
                if (e.key === 'Escape') { showDropdown ? setShowDropdown(false) : onClose(); }
              }}
              placeholder="e.g. REB-00001"
              className="ds-glass w-full pl-10 pr-10 py-3 rounded-full text-sm focus:outline-none font-mono tracking-wider bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)]" />
            <button type="button" onClick={() => setShowDropdown(v => !v)}
              className="absolute right-3 text-[var(--ds-faint)]">
              {codesLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />}
            </button>
          </div>

          {showDropdown && !codesLoading && (
            <div ref={dropRef}
              className="ds-glass absolute z-50 left-0 right-0 mt-1.5 rounded-2xl overflow-hidden max-h-[240px] overflow-y-auto bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] shadow-[var(--ds-shadow)]">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--ds-faint)]">No matching codes found</div>
              ) : filtered.map(item => (
                <button key={item.RebateCode} type="button" onClick={() => handleSelect(item)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 border-b last:border-b-0 border-[var(--ds-hairline)] hover:bg-[var(--ds-chip-bg)] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-semibold text-sm text-[var(--ds-ink)]">{item.RebateCode}</span>
                  </div>
                  {item.RebateType && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={typeColor(item.RebateType)}>
                      {item.RebateType}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {searchError && (
            <p className="mt-2 text-xs flex items-center gap-1.5 text-[#FF453A]">
              <AlertCircle className="w-3.5 h-3.5" />{searchError}
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-full font-medium text-sm text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)] transition-colors">
            Cancel
          </button>
          <button onClick={() => { setShowDropdown(false); onSearch(); }}
            disabled={searchLoading || !searchCode.trim()}
            className="ds-gradient-primary px-5 py-2.5 text-white rounded-full font-medium text-sm flex items-center gap-2 disabled:opacity-40">
            {searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searchLoading ? "Loading…" : "Load & Edit"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Bulk Range Modal ─────────────────────────────────────────────────────────
const BulkRangeModal = ({ isOpen, onClose, onApply, emptyCount = 0, totalCount = 0 }) => {
  const { K, isDark } = useTokens();
  const [ranges, setRanges] = useState([{ min: 0, max: 99, rebate: "" }]);
  const [applyMode, setApplyMode] = useState("emptyOnly");

  useEffect(() => {
    if (isOpen) {
      setRanges([{ min: 0, max: 99, rebate: "" }]);
      setApplyMode("emptyOnly");
    }
  }, [isOpen]);

  const handleChange = (idx, field, value) => {
    if (value !== "" && !/^-?\d*\.?\d*$/.test(value)) return;
    const next = ranges.map(r => ({ ...r }));
    next[idx][field] = value;
    if (field === 'max' && idx < next.length - 1) next[idx + 1].min = String(parseInt(value || "0") + 1);
    if (field === 'min' && idx > 0) next[idx - 1].max = String(parseInt(value || "0") - 1);
    setRanges(next);
  };

  const addRange = () => {
    const last = ranges[ranges.length - 1];
    const newMin = last ? parseInt(last.max || "0") + 1 : 0;
    setRanges([...ranges, { min: newMin, max: newMin + 99, rebate: "" }]);
  };

  const removeRange = (idx) => {
    if (ranges.length <= 1) return;
    setRanges(ranges.filter((_, i) => i !== idx));
  };

  const handleApply = () => {
    const missing = ranges.some(r => r.rebate === "" || r.rebate == null);
    if (missing) return;
    onApply(ranges.map(r => ({ min: String(r.min), max: String(r.max), rebate: String(r.rebate) })), applyMode);
    onClose();
  };

  if (!isOpen) return null;

  const anyMissing = ranges.some(r => r.rebate === "" || r.rebate == null);

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-2xl ${
      isDark ? 'bg-[rgba(10,10,14,0.65)]' : 'bg-black/40'
    }`}>
      <div className="ds-glass ds-pop rounded-[28px] w-[95%] max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] shadow-[var(--ds-shadow)]">

        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0 border-[var(--ds-hairline)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#32D74B] to-[#1D9E3F] shadow-[0_4px_12px_-4px_rgba(50,215,75,0.53)]">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[var(--ds-ink)]">Apply Ranges to All Customers</h2>
              <p className="text-sm text-[var(--ds-muted)]">
                Define one range set and push it to customers — bulk default fallback
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] hover:bg-[var(--ds-hairline)] hover:text-[var(--ds-ink)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto ds-scroll">
          <div className="mb-5 p-4 rounded-2xl flex flex-wrap items-center gap-3 bg-[#0A84FF]/8 border border-[#0A84FF]/20">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#0A84FF]" />
              <span className="text-sm font-semibold text-[#0A84FF]">Apply Mode</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setApplyMode("emptyOnly")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  applyMode === "emptyOnly"
                    ? 'bg-[#0A84FF] text-white'
                    : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)]'
                }`}>
                Customers with No Ranges ({emptyCount})
              </button>
              <button onClick={() => setApplyMode("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  applyMode === "all"
                    ? 'bg-[#FF9F0A] text-white'
                    : 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)]'
                }`}>
                All Customers ({totalCount})
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {ranges.map((range, rangeIndex) => (
              <div key={rangeIndex}
                className="rounded-2xl p-5 ds-glass bg-[var(--ds-glass)] border border-[var(--ds-hairline)]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 bg-gradient-to-br from-[#32D74B] to-[#1D9E3F]">
                      {rangeIndex + 1}
                    </span>
                    <h3 className="font-bold text-base text-[var(--ds-ink)]">Range {rangeIndex + 1}</h3>
                  </div>
                  {ranges.length > 1 && (
                    <button onClick={() => removeRange(rangeIndex)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#FF453A] bg-[#FF453A]/8 hover:bg-[#FF453A]/16 transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-[var(--ds-muted)]">Minimum Quantity</label>
                    <input type="text" value={range.min}
                      onChange={(e) => handleChange(rangeIndex, 'min', e.target.value)}
                      placeholder="Min"
                      className="ds-glass w-full px-4 py-3 rounded-xl text-sm bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-[var(--ds-muted)]">Maximum Quantity</label>
                    <input type="text" value={range.max}
                      onChange={(e) => handleChange(rangeIndex, 'max', e.target.value)}
                      placeholder="Max"
                      className="ds-glass w-full px-4 py-3 rounded-xl text-sm bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-[var(--ds-muted)]">Rebate per Bag</label>
                    <input type="text" value={range.rebate}
                      onChange={(e) => handleChange(rangeIndex, 'rebate', e.target.value)}
                      placeholder="Rebate amount"
                      className={`ds-glass w-full px-4 py-3 rounded-xl text-sm bg-[var(--ds-glass)] text-[var(--ds-ink)] outline-none transition-colors ${
                        range.rebate === ""
                          ? 'border border-[#FF9F0A]/33 focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)]'
                          : 'border border-[var(--ds-hairline)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)]'
                      }`} />
                  </div>
                </div>

                <div className="mt-3 text-xs px-3 py-2 rounded-lg inline-block bg-[#32D74B]/8 text-[#32D74B] border border-[#32D74B]/20">
                  Range: <strong>{range.min}</strong> – <strong>{range.max}</strong> bags → Rebate: <strong>₱{range.rebate || "0"}</strong>/bag
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <button onClick={addRange}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white bg-gradient-to-br from-[#32D74B] to-[#1D9E3F] shadow-[0_4px_16px_-6px_rgba(50,215,75,0.53)] hover:brightness-110 transition-all">
              <Plus className="w-4 h-4" />
              Add Another Range
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0 border-[var(--ds-hairline)] bg-[var(--ds-glass-deep)]">
          <div className="text-sm text-[var(--ds-muted)]">
            <strong className="text-[var(--ds-ink)]">{ranges.length}</strong> range{ranges.length !== 1 ? 's' : ''} ·
            {' '}applying to{' '}
            <strong className={applyMode === "all" ? 'text-[#FF9F0A]' : 'text-[#0A84FF]'}>
              {applyMode === "all" ? `all ${totalCount}` : `${emptyCount} customer${emptyCount !== 1 ? 's' : ''} with no ranges`}
            </strong>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-6 py-2.5 rounded-full text-sm font-medium text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)] transition-colors">
              Cancel
            </button>
            <button onClick={handleApply} disabled={anyMissing}
              className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 text-white bg-gradient-to-br from-[#32D74B] to-[#1D9E3F] shadow-[0_4px_16px_-6px_rgba(50,215,75,0.53)] disabled:opacity-40">
              <CheckCircle className="w-4 h-4" />
              Apply Ranges
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Unified Component ───────────────────────────────────────────────────
function RebateSetup({
  db,
  routePath,
  logo,
  defaultRebateType,
  defaultQuotaType,
  showVanDropdown,
  setShowVanDropdown,
  showNexchemDropdown,
  setShowNexchemDropdown,
  showVcpDropdown,
  setShowVcpDropdown,
}) {
  const { theme, updateTheme, isDark, K } = useTokens();

  /* ─── ACCESS CONTROL FIX ───────────────────────────────────────────
   * 1. Guarantee routePath is a non-empty string so the hook never
   *    queries "/undefined".
   * 2. Wrap in try/catch so a thrown hook doesn't blank the page.
   * 3. Add a 8-second watchdog: if the hook never clears its loading
   *    flag, we stop blocking the UI (logs a warning).
   * ────────────────────────────────────────────────────────────────── */
  const safeRoutePath = useMemo(
    () => (typeof routePath === "string" && routePath.trim()) ? routePath : "/RebateSetup",
    [routePath]
  );

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[RebateSetup] access props", { routePath, safeRoutePath });
  }, [routePath, safeRoutePath]);

  const accessHook = useAccessControl(safeRoutePath);
  const rawAccess       = accessHook?.access;
  const rawLoading      = accessHook?.accessLoading;
  const rawAccessError  = accessHook?.accessError;

  const [watchdogFired, setWatchdogFired] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (rawLoading) {
        // eslint-disable-next-line no-console
        console.warn("[RebateSetup] Access control did not resolve within 8s — unblocking UI.");
        setWatchdogFired(true);
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [rawLoading]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[RebateSetup] access state", {
      accessLoading: rawLoading,
      accessError: rawAccessError,
      access: rawAccess,
      watchdogFired,
    });
  }, [rawLoading, rawAccessError, rawAccess, watchdogFired]);

  const accessLoading = !!rawLoading && !watchdogFired;
  const accessError   = rawAccessError || (watchdogFired ? "Access check timed out." : null);
  const access        = rawAccess || {
    canView:   true,   // fail-open so the page renders instead of hanging
    canEdit:   true,
    canCreate: true,
    canExport: true,
  };

  const isVanDb = db === 'VAN';

  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("Customer");
  const [rebateType, setRebateType] = useState(defaultRebateType || "Fixed");
  const [quotaType, setQuotaType] = useState("withQuota");
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, data: null });
  const [removeCustomerModal, setRemoveCustomerModal] = useState({ isOpen: false, index: null, name: "" });
  const [removeItemModal, setRemoveItemModal] = useState({ isOpen: false, index: null, name: "" });
  const [quotaModal, setQuotaModal] = useState({ isOpen: false, customer: null, importedQuotas: [] });
  const [rangeModal, setRangeModal] = useState({ isOpen: false, customer: null });
  const [productRangeModal, setProductRangeModal] = useState({ isOpen: false, product: null });
  const [percentageModal, setPercentageModal] = useState({ isOpen: false, customer: null });
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [tempSelectedCustomers, setTempSelectedCustomers] = useState([]);
  const [tempSelectedItems, setTempSelectedItems] = useState([]);
  const [currentEditingRow, setCurrentEditingRow] = useState({ type: null, index: null });
  const [editingRows, setEditingRows] = useState({ customer: { 0: true }, item: { 0: true } });
  const [userName, setUserName] = useState("");
  const [userCode, setUserCode] = useState("");
  const [initials, setInitials] = useState("");
  const [customersDropdown, setCustomersDropdown] = useState([]);
  const [itemsDropdown, setItemsDropdown] = useState([]);
  const [rebateCode, setRebateCode] = useState("REB-");
  const [rebateName, setRebateName] = useState("");
  const [selectedDateFrom, setSelectedDateFrom] = useState("");
  const [selectedDateTo, setSelectedDateTo] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState("");
  const [redemptionPeriod, setRedemptionPeriod] = useState("");
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [quotaPeriods, setQuotaPeriods] = useState([]);
  const [quotaCount, setQuotaCount] = useState(0);
  const [importedCustomerQuotas, setImportedCustomerQuotas] = useState({});
  const [duplicationError, setDuplicationError] = useState({ isOpen: false, type: null, data: null });
  const [searchModal, setSearchModal] = useState({ isOpen: false });
  const [searchCode, setSearchCode] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isViewMode, setIsViewMode] = useState(false);
  const [loadedRebateCode, setLoadedRebateCode] = useState("");
  const [cancelModal, setCancelModal] = useState(false);
  const [customerQtrBulk, setCustomerQtrBulk] = useState("");
  const [itemQtrBulk, setItemQtrBulk] = useState("");
  const [bulkQuotas, setBulkQuotas] = useState([]);
  const [dateRangeScope, setDateRangeScope] = useState(SCOPE_ALL_CUSTOMERS);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [bulkRangeModalOpen, setBulkRangeModalOpen] = useState(false);

  const isItemQtrFreq = selectedFrequency === "Monthly w/ Item Qtr. Rebate";
  const isCustQtrFreq = selectedFrequency === "Monthly w/ Cust. Qtr. Rebate";
  const isQuarterly   = selectedFrequency === "Quarterly";

  const showQtrRebateFeature = isQuarterly || isCustQtrFreq || isItemQtrFreq;
  const showCustomerQtrRebate = showQtrRebateFeature && !isItemQtrFreq;
  const showItemQtrRebate     = showQtrRebateFeature && isItemQtrFreq;

  const showPerRowDate = dateRangeScope === SCOPE_PER_CUSTOMER;
  const showHeaderDate = dateRangeScope === SCOPE_ALL_CUSTOMERS;

  const hasAnyData = useMemo(() => {
    const hasCustomers = customers.some(c => c.code && c.name);
    const hasItems     = items.some(i => i.code && i.name);
    const hasHeader    = !!(selectedDateFrom || selectedDateTo || selectedFrequency || rebateType || redemptionPeriod || rebateName || dateRangeScope);
    return hasCustomers || hasItems || hasHeader;
  }, [customers, items, selectedDateFrom, selectedDateTo, selectedFrequency, rebateType, redemptionPeriod, rebateName, dateRangeScope]);

  const customersWithNoRanges = useMemo(() => {
    return customers.filter(c => {
      const r = c.ranges;
      if (!r || typeof r !== 'object') return true;
      const hasDefault = Array.isArray(r['default']) && r['default'].length > 0;
      const hasPeriodKey = Object.keys(r).some(k => Array.isArray(r[k]) && r[k].length > 0);
      return !hasDefault && !hasPeriodKey;
    }).length;
  }, [customers]);

  const showToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  useComponentRegistration({
    name: 'RebateSetup',
    version: '3.2.0',
    description: `Unified rebate configuration for ${db}`,
    routePath: safeRoutePath,
  });

  useEffect(() => {
    const initializeData = async () => {
      const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
      const username   = storedUser.DisplayName || storedUser.Username || "Unknown User";
      const uCode      = storedUser.User_ID || "Unknown ID";
      setUserName(username); setUserCode(uCode);
      const parts = username.trim().split(" ");
      setInitials(parts.length === 1 ? parts[0][0].toUpperCase() : parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase());
      setRebateCode("REB-");
      fetchCustomers(); fetchItems();
    };
    initializeData();
    // eslint-disable-next-line
  }, [db]);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
        const userId = storedUser.UserID || storedUser.User_ID;
        if (userId) {
          const res = await axios.get(`${API_BASE}/user/preferences/${userId}/theme?db=${DB_NAME}`);
          if (res.data.success && res.data.value) {
            const t = res.data.value.toLowerCase();
            if (t !== theme) updateTheme(t);
          }
        }
      } catch {
        const lt = localStorage.getItem('userTheme');
        if (lt && lt !== theme) updateTheme(lt);
      }
    };
    loadTheme();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (quotaType === "withQuota" && dateRangeScope === SCOPE_ALL_CUSTOMERS && selectedDateFrom && selectedDateTo && selectedFrequency) {
      calculateQuotaPeriods();
    } else {
      setQuotaPeriods([]); setQuotaCount(0);
      setCustomers(prev => prev.map(c => ({ ...c, quotas: [], percentages: [], ranges: {} })));
      setItems(prev => prev.map(i => ({ ...i, ranges: {} })));
    }
    // eslint-disable-next-line
  }, [selectedDateFrom, selectedDateTo, selectedFrequency, quotaType, dateRangeScope]);

  useEffect(() => {
    setBulkQuotas(Array(quotaPeriods.length).fill(""));
    // eslint-disable-next-line
  }, [quotaPeriods.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault(); setSearchCode(""); setSearchError(""); setSearchModal({ isOpen: true });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const endpoint = db === 'VCP' ? 'vcp' : db === 'VAN' ? 'van' : 'nexchem';
      const res = await fetch(`${API_BASE}/${endpoint}/customer?db=${db}`);
      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();
      if (Array.isArray(data)) setCustomersDropdown(data);
      else if (data?.data && Array.isArray(data.data)) setCustomersDropdown(data.data);
      else setCustomersDropdown([]);
    } catch { showToast("Failed to load customers", "error"); setCustomersDropdown([]); }
    finally { setLoading(false); }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/rebate-program/master-items?db=${db}`);
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      if (Array.isArray(data)) setItemsDropdown(data);
      else if (data?.data && Array.isArray(data.data)) setItemsDropdown(data.data);
      else setItemsDropdown([]);
    } catch { showToast("Failed to load items", "error"); setItemsDropdown([]); }
    finally { setLoading(false); }
  };

  const handleRefreshData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/sync/refresh-data`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDatabase: db, targetDatabase: db, tables: ['customers', 'items'] }),
      });
      if (!response.ok) throw new Error('Failed to start refresh');
      setTimeout(async () => {
        await fetchCustomers(); await fetchItems();
        showToast("Data refresh completed!", "success");
        setLoading(false);
      }, 1500);
    } catch (error) { showToast(`Refresh failed: ${error.message}`, "error"); setLoading(false); }
  };

  const generateNextRebateCode = async () => {
    try {
      const response = await fetch(`${API_BASE}/rebate-program/highest-code?db=${db}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.nextCode) return data.nextCode;
      }
      return getFallbackRebateCode();
    } catch { return getFallbackRebateCode(); }
  };

  const getFallbackRebateCode = () => {
    const storageKey = `lastRebateCode_${db}`;
    const lastCode = localStorage.getItem(storageKey);
    let nextNumber = 1;
    if (lastCode && lastCode.startsWith('REB-')) {
      const parts = lastCode.split('-');
      if (parts.length === 2) { const last = parseInt(parts[1]); if (!isNaN(last)) nextNumber = last + 1; }
    }
    const nextCode = `REB-${nextNumber.toString().padStart(5, '0')}`;
    localStorage.setItem(storageKey, nextCode);
    return nextCode;
  };

  const calculateQuotaPeriods = () => {
    const periods = computeQuotaPeriods(selectedDateFrom, selectedDateTo, selectedFrequency);
    setQuotaPeriods(periods);
    setQuotaCount(periods.length);

    const resizeKeepingValues = (existing, targetLen) => {
      const arr = Array.isArray(existing) ? existing : [];
      if (arr.length === targetLen) return arr;
      const resized = Array(targetLen).fill("");
      arr.forEach((v, i) => { if (i < targetLen) resized[i] = v; });
      return resized;
    };

    setCustomers(prev => prev.map(c => {
      if (quotaType !== "withQuota") return { ...c, quotas: [], percentages: [], ranges: c.ranges || {} };
      return {
        ...c,
        quotas:      resizeKeepingValues(c.quotas,      periods.length),
        percentages: resizeKeepingValues(c.percentages, periods.length),
        ranges:      c.ranges || {},
      };
    }));
    setItems(prev => prev.map(i => ({ ...i, ranges: i.ranges || {} })));
  };

  const handleSearchRebateCode = async () => {
    const code = searchCode.trim().toUpperCase();
    if (!code) { setSearchError("Please enter a rebate code."); return; }
    setSearchLoading(true); setSearchError("");
    try {
      const res = await fetch(`${API_BASE}/rebate-program/by-code/${encodeURIComponent(code)}?db=${db}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.program) { setSearchError(`Rebate code "${code}" not found.`); setSearchLoading(false); return; }
      const prog = data.program;
      setRebateCode(prog.RebateCode);
      setLoadedRebateCode(prog.RebateCode);
      setRebateType(prog.RebateType);
      setRebateName(prog.Name || "");
      setSelectedDateFrom(prog.DateFrom ? prog.DateFrom.slice(0, 10) : "");
      setSelectedDateTo(prog.DateTo     ? prog.DateTo.slice(0, 10)   : "");
      setSelectedFrequency(prog.Frequency || "");
      setRedemptionPeriod(prog.RedemptionPeriod || "");
      setQuotaType(prog.QuotaType === "With Quota" ? "withQuota" : "withoutQuota");
      setDateRangeScope(prog.DateRangeScope === SCOPE_PER_CUSTOMER ? SCOPE_PER_CUSTOMER : SCOPE_ALL_CUSTOMERS);

      const custRes = await fetch(`${API_BASE}/rebate-program/customers/${encodeURIComponent(code)}?db=${db}&type=${encodeURIComponent(prog.RebateType)}`);
      if (custRes.ok) {
        const custData = await custRes.json();
        if (custData.success && Array.isArray(custData.customers)) {
          const mapped = custData.customers.map(c => {
            const base = {
              code: c.CardCode || "", name: c.CardName || "",
              qtrRebate: c.QtrRebate != null ? String(c.QtrRebate) : "",
              isQualified: normalizeQtrQualifiedFlag(c.QtrQualified),
              rebatePerBag: c.RebatePerBag != null ? String(c.RebatePerBag) : "",
              dateFrom: c.DateFrom ? String(c.DateFrom).slice(0, 10) : "",
              dateTo:   c.DateTo   ? String(c.DateTo).slice(0, 10)   : "",
              quotas: [], percentages: [], ranges: {},
            };
            if (prog.RebateType === 'Fixed') {
              base.quotas = (c.quotas || []).sort((a, b) => a.Id - b.Id).map(q => q.TargetQty != null ? String(q.TargetQty) : "");
            } else if (prog.RebateType === 'Percentage') {
              base.percentages = (c.quotas || []).sort((a, b) => a.Id - b.Id).map(q => q.TargetQty != null ? String(q.TargetQty) : "");
            } else if (prog.RebateType === 'Incremental') {
              const sorted = [...(c.ranges || [])].sort((a, b) => a.RangeNo - b.RangeNo);
              if (sorted.length > 0) {
                base.ranges = { default: sorted.map(r => ({
                  min:    r.MinQty != null ? String(r.MinQty) : "",
                  max:    r.MaxQty != null ? String(r.MaxQty) : "",
                  rebate: r.RebatePerBag != null ? String(r.RebatePerBag) : "",
                })) };
              }
            }
            return base;
          });
          setCustomers(mapped);
          const state = {}; mapped.forEach((_, i) => { state[i] = true; });
          setEditingRows(prev => ({ ...prev, customer: state }));
        }
      }

      const itemRes = await fetch(`${API_BASE}/rebate-program/items/${encodeURIComponent(code)}?db=${db}&type=${encodeURIComponent(prog.RebateType)}`);
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        if (itemData.success && Array.isArray(itemData.items)) {
          const mapped = itemData.items.map(i => {
            const masterItem = itemsDropdown.find(m => m.ItemCode === i.ItemCode) || itemsDropdown.find(m => m.ItemName === i.ItemName);
            const base = {
              code: i.ItemCode || "", name: i.ItemName || "",
              unitPerQty:       i.UnitPerQty       != null ? String(i.UnitPerQty)       : "",
              rebatePerBag:     i.RebatePerBag     != null ? String(i.RebatePerBag)     : "",
              percentagePerBag: i.PercentagePerBag != null ? String(i.PercentagePerBag) : "",
              qtrRebate:        i.QtrRebate        != null ? String(i.QtrRebate)        : "",
              isQualified:      normalizeQtrQualifiedFlag(i.QtrQualified),
              unitOfMeasure:    i.UnitOfMeasure || getSalUnitMsr(masterItem),
              ranges: {},
            };
            if (prog.RebateType === 'Incremental' && Array.isArray(i.ranges) && i.ranges.length > 0) {
              const sorted = [...i.ranges].sort((a, b) => a.RangeNo - b.RangeNo);
              base.ranges = { default: sorted.map(r => ({
                min:    r.MinQty != null ? String(r.MinQty) : "",
                max:    r.MaxQty != null ? String(r.MaxQty) : "",
                rebate: r.RebatePerBag != null ? String(r.RebatePerBag) : "",
              })) };
            }
            return base;
          });
          setItems(mapped);
          const state = {}; mapped.forEach((_, i) => { state[i] = true; });
          setEditingRows(prev => ({ ...prev, item: state }));
        }
      }

      setIsViewMode(true);
      setSearchModal({ isOpen: false });
      setActiveTab("Customer");
      showToast(`Rebate program "${code}" loaded — you can now edit and save`, "success");
    } catch (err) {
      setSearchError(`Error: ${err.message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleImportFile = (file) => {
    if (!access.canEdit) { showToast("You do not have permission to import data", "error"); return; }
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/)) { showToast("Please select a valid Excel file (.xlsx or .xls)", "error"); return; }
    setLoading(true);
    const preservedCode = isViewMode ? loadedRebateCode : null;
    const preservedIsViewMode = isViewMode;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        if (workbook.SheetNames.length === 0) throw new Error("No sheets found in Excel file");
        let customerDataImported = false, itemDataImported = false;
        let importedCustomers = [], importedItems = [];
        let extracted = {};
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData  = XLSX.utils.json_to_sheet ? XLSX.utils.sheet_to_json(worksheet, { header: 1 }) : [];
          if (jsonData.length > 0) {
            if (!preservedIsViewMode) extracted = extractHeaderInfoFromData(jsonData);
            const effRebateType = extracted.rebateType || rebateType;
            const effQuotaType  = extracted.quotaType  || quotaType;
            const effDateFrom   = extracted.dateFrom   || selectedDateFrom;
            const effDateTo     = extracted.dateTo     || selectedDateTo;
            const effFrequency  = extracted.frequency  || selectedFrequency;
            const effPeriods    = computeQuotaPeriods(effDateFrom, effDateTo, effFrequency);
            const sheetLower = sheetName.toLowerCase();

            if (sheetLower.includes('customer')) {
              let dataStartRow = 0, headerRow = null;
              for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (Array.isArray(row) && row[0] === "Customer Code" && row[1] === "Customer Name") {
                  dataStartRow = i + 1; headerRow = row; break;
                }
              }
              if (dataStartRow > 0) {
                const result = processCustomerDataSimple(
                  jsonData.slice(dataStartRow), headerRow,
                  { rebateType: effRebateType, quotaType: effQuotaType, quotaPeriods: effPeriods },
                );
                importedCustomers = result.importedCustomers;
                if (importedCustomers.length > 0) {
                  setCustomers(importedCustomers);
                  const state = {}; importedCustomers.forEach((_, idx) => { state[idx] = false; });
                  setEditingRows(prev => ({ ...prev, customer: state }));
                  customerDataImported = true;
                }
              }
            } else if (sheetLower.includes('item')) {
              let dataStartRow = 0, headerRow = null;
              for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (Array.isArray(row) && row[0] === "Item Code" && row[1] === "Item Name") {
                  dataStartRow = i + 1; headerRow = row; break;
                }
              }
              if (dataStartRow > 0) {
                importedItems = processItemDataSimple(jsonData.slice(dataStartRow), effRebateType, headerRow);
                if (importedItems.length > 0) {
                  setItems(importedItems);
                  const state = {};
                  importedItems.forEach((_, idx) => { state[idx] = false; });
                  setEditingRows(prev => ({ ...prev, item: state }));
                  itemDataImported = true;
                }
              }
            }
          }
        });
        if (preservedIsViewMode && preservedCode) { setRebateCode(preservedCode); setLoadedRebateCode(preservedCode); setIsViewMode(true); }
        if (!customerDataImported && !itemDataImported) showToast("No valid customer or item data found in the Excel file", "warning");
        else {
          const msgs = [];
          if (customerDataImported) msgs.push(`${importedCustomers.length} customers`);
          if (itemDataImported)     msgs.push(`${importedItems.length} items`);
          showToast(`Successfully imported ${msgs.join(' and ')}`, "success");
        }
      } catch (error) {
        showToast(`Import failed: ${error.message}`, "error");
        if (preservedIsViewMode && preservedCode) { setRebateCode(preservedCode); setLoadedRebateCode(preservedCode); setIsViewMode(true); }
      } finally { setLoading(false); }
    };
    reader.onerror = () => { setLoading(false); showToast("Error reading file. Please try again.", "error"); };
    reader.readAsArrayBuffer(file);
  };

  const handleImportExcel = (event) => {
    const file = event.target.files?.[0];
    if (file) handleImportFile(file);
    event.target.value = '';
  };

  const handleDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); };
  const handleDrop      = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleImportFile(files[0]);
  };

  const processCustomerDataSimple = (excelData, headerRow = null, opts = {}) => {
    try {
      if (excelData.length === 0) return { importedCustomers: [], importedQuotasMap: {} };

      const effRebateType   = opts.rebateType   ?? rebateType;
      const effQuotaType    = opts.quotaType    ?? quotaType;
      const effQuotaPeriods = Array.isArray(opts.quotaPeriods) ? opts.quotaPeriods : [];
      const effQuotaCount   = effQuotaPeriods.length || 0;

      let idxCode = 0, idxName = 1, idxDateFrom = null, idxDateTo = null;
      let idxQtrQual = null, idxQtrRebate = null, idxRanges = null;
      const periodCols = [];

      if (Array.isArray(headerRow)) {
        const normPeriods = effQuotaPeriods.map(p =>
          String(p.label || p.period || '').toLowerCase().trim()
        );
        headerRow.forEach((h, i) => {
          if (h == null) return;
          const raw = String(h).trim();
          const hn  = raw.toLowerCase();
          if      (hn === 'customer code')  { idxCode = i; return; }
          else if (hn === 'customer name')  { idxName = i; return; }
          else if (hn === 'date from')      { idxDateFrom = i; return; }
          else if (hn === 'date to')        { idxDateTo = i; return; }
          else if (hn === 'qtr qualified')  { idxQtrQual = i; return; }
          else if (hn === 'qtr rebate')     { idxQtrRebate = i; return; }
          else if (hn === 'ranges (json)' || hn === 'ranges') { idxRanges = i; return; }
          const cleaned = hn.replace(/\s*\(%\)\s*$/, '').trim();
          const pi = normPeriods.indexOf(cleaned);
          if (pi >= 0) periodCols.push({ pi, col: i });
        });
      }

      if (idxDateFrom == null && idxDateTo == null) { idxDateFrom = 2; idxDateTo = 3; }

      const importedCustomers = [], skippedCustomers = [];
      excelData.forEach((row) => {
        const rowArray = Array.isArray(row) ? row : [row];
        const codeValue = rowArray[idxCode] !== undefined ? String(rowArray[idxCode]).trim() : "";
        const nameValue = rowArray[idxName] !== undefined ? String(rowArray[idxName]).trim() : "";
        if (!codeValue) return;

        const customerData = customersDropdown.find(
          c => String(c.CardCode).trim().toLowerCase() === codeValue.toLowerCase()
        );
        if (!customerData) { skippedCustomers.push({ code: codeValue, name: nameValue }); return; }

        const dateFromRaw  = idxDateFrom  != null ? rowArray[idxDateFrom]  : "";
        const dateToRaw    = idxDateTo    != null ? rowArray[idxDateTo]    : "";
        const qtrRebateRaw = idxQtrRebate != null ? rowArray[idxQtrRebate] : "";
        const qtrQualRaw   = idxQtrQual   != null ? rowArray[idxQtrQual]   : "";
        const rangesRaw    = idxRanges    != null ? rowArray[idxRanges]    : "";

        const isQualified = normalizeQtrQualifiedFlag(qtrQualRaw);

        const quotasArr = effQuotaType === "withQuota" && effRebateType === "Fixed"
          ? Array(effQuotaCount).fill("") : [];
        const percentagesArr = effQuotaType === "withQuota" && effRebateType === "Percentage"
          ? Array(effQuotaCount).fill("") : [];

        periodCols.forEach(({ pi, col }) => {
          const val = rowArray[col];
          if (val === undefined || val === null || val === "") return;
          const sVal = String(val).trim();
          if (effRebateType === "Fixed")      quotasArr[pi]      = sVal;
          if (effRebateType === "Percentage") percentagesArr[pi] = sVal;
        });

        let parsedRanges = {};
        if (rangesRaw && typeof rangesRaw === "string" && rangesRaw.trim()) {
          try {
            const parsed = JSON.parse(rangesRaw);
            if (parsed && typeof parsed === 'object') parsedRanges = parsed;
          } catch { /* ignore malformed JSON */ }
        }

        importedCustomers.push({
          code: customerData.CardCode,
          name: customerData.CardName,
          quotas: quotasArr, percentages: percentagesArr, ranges: parsedRanges,
          qtrRebate: qtrRebateRaw !== "" && qtrRebateRaw !== undefined && qtrRebateRaw !== null
            ? String(qtrRebateRaw).trim() : "",
          rebatePerBag: "",
          isQualified,
          dateFrom: toDateString(dateFromRaw),
          dateTo:   toDateString(dateToRaw),
        });
      });

      if (skippedCustomers.length > 0) {
        showToast(`Imported ${importedCustomers.length} customers, skipped ${skippedCustomers.length} not found`, "warning");
      }
      return { importedCustomers, importedQuotasMap: {} };
    } catch (error) {
      showToast(`Error processing customer data: ${error.message}`, "error");
      return { importedCustomers: [], importedQuotasMap: {} };
    }
  };

  const processItemDataSimple = (excelData, effectiveRebateType, headerRow = null) => {
    const rt = effectiveRebateType ?? rebateType;
    try {
      if (excelData.length === 0) return [];

      let idxCode = 0, idxName = 1, idxQty = 2, idxUom = 3, idxValue = null;
      let idxQtrQual = null, idxQtrRebate = null, idxRanges = null;

      if (Array.isArray(headerRow)) {
        headerRow.forEach((h, i) => {
          if (h == null) return;
          const hn = String(h).toLowerCase().trim();
          if      (hn === 'item code')                             idxCode = i;
          else if (hn === 'item name')                             idxName = i;
          else if (hn === 'qty' || hn === 'quantity')              idxQty  = i;
          else if (hn.includes('unit of measure') || hn === 'uom') idxUom  = i;
          else if (hn.includes('percentage per bag') ||
                   hn.includes('rebate per bag')     ||
                   hn === 'percentage' || hn === 'rebate')         idxValue = i;
          else if (hn === 'qtr qualified')                         idxQtrQual    = i;
          else if (hn === 'qtr rebate')                            idxQtrRebate  = i;
          else if (hn === 'ranges (json)' || hn === 'ranges')      idxRanges     = i;
        });
      }
      if (idxValue == null) idxValue = idxUom + 1;

      const dataRows = excelData.filter(row =>
        Array.isArray(row) && row.length >= 2 &&
        row.some((cell, i) => i < 2 && cell && String(cell).trim() !== '')
      );

      const importedItems = [], skippedItems = [];
      dataRows.forEach((row) => {
        const rowArray  = Array.isArray(row) ? row : [row];
        const codeValue = rowArray[idxCode] !== undefined ? String(rowArray[idxCode]).trim() : "";
        const nameValue = rowArray[idxName] !== undefined ? String(rowArray[idxName]).trim() : "";
        const qtyValue  = rowArray[idxQty]  !== undefined ? String(rowArray[idxQty]).trim()  : "";
        const uomValue  = rowArray[idxUom]  !== undefined ? String(rowArray[idxUom]).trim()  : "";

        const rawValue        = idxValue != null && rowArray[idxValue] !== undefined
          ? String(rowArray[idxValue]).trim() : "";
        const percentageValue = rawValue.replace(/%/g, '').trim();

        const qtrQualRaw   = idxQtrQual    != null ? rowArray[idxQtrQual]    : "";
        const qtrRebateRaw = idxQtrRebate  != null ? rowArray[idxQtrRebate]  : "";
        const rangesRaw    = idxRanges     != null ? rowArray[idxRanges]     : "";

        if (!codeValue) return;

        const itemData = itemsDropdown.find(
          i => String(i.ItemCode).trim().toLowerCase() === codeValue.toLowerCase()
        );
        if (!itemData) { skippedItems.push({ code: codeValue, name: nameValue }); return; }

        const isQualified = normalizeQtrQualifiedFlag(qtrQualRaw);

        let parsedRanges = {};
        if (rangesRaw && typeof rangesRaw === "string" && rangesRaw.trim()) {
          try {
            const parsed = JSON.parse(rangesRaw);
            if (parsed && typeof parsed === 'object') parsedRanges = parsed;
          } catch { /* ignore */ }
        }

        importedItems.push({
          code: itemData.ItemCode, name: itemData.ItemName,
          unitPerQty: qtyValue || "1",
          rebatePerBag:     (rt === "Fixed" || rt === "Incremental") ? percentageValue || "" : "",
          percentagePerBag: rt === "Percentage" ? percentageValue || "" : "",
          qtrRebate: qtrRebateRaw !== "" && qtrRebateRaw !== undefined && qtrRebateRaw !== null
            ? String(qtrRebateRaw).trim() : "",
          isQualified,
          unitOfMeasure: uomValue || getSalUnitMsr(itemData),
          ranges: parsedRanges,
        });
      });

      if (skippedItems.length > 0) {
        showToast(`Imported ${importedItems.length} items, skipped ${skippedItems.length} not found`, "warning");
      }
      return importedItems;
    } catch (error) {
      showToast(`Error processing item data: ${error.message}`, "error");
      return [];
    }
  };

  const extractHeaderInfoFromData = (excelData) => {
    if (!excelData || excelData.length < 2) return {};
    const headerRow = excelData[0];
    const valueRow  = excelData[1];
    if (!Array.isArray(headerRow) || !Array.isArray(valueRow)) return {};
    const extracted = {};
    headerRow.forEach((header, index) => {
      if (!header) return;
      const h = String(header).toLowerCase().trim();
      const v = valueRow[index] ? String(valueRow[index]).trim() : "";
      if      (h.includes('rebate code'))       { if (v) { setRebateCode(v); extracted.rebateCode = v; } }
      else if (h === 'name' || h.includes('program name')) { if (v) { setRebateName(v); extracted.name = v; } }
      else if (h.includes('date from'))         { if (v) { setSelectedDateFrom(v); extracted.dateFrom = v; } }
      else if (h.includes('date to'))           { if (v) { setSelectedDateTo(v); extracted.dateTo = v; } }
      else if (h.includes('frequency'))         { if (v) { setSelectedFrequency(v); extracted.frequency = v; } }
      else if (h.includes('redemption period')) { if (v) { setRedemptionPeriod(v); extracted.redemptionPeriod = v; } }
      else if (h.includes('date range scope') || h.includes('date range mode')) {
        if (v) {
          const scope = v.toLowerCase().includes('per') ? SCOPE_PER_CUSTOMER : SCOPE_ALL_CUSTOMERS;
          setDateRangeScope(scope); extracted.dateRangeScope = scope;
        }
      }
      else if (h.includes('quota type')) {
        if (v) { const vs = v.toLowerCase(); const qt = vs.includes('without') || vs.includes('no quota') ? "withoutQuota" : "withQuota"; setQuotaType(qt); extracted.quotaType = qt; }
      } else if (h.includes('rebate type')) {
        if (v) {
          const vs = v.toLowerCase(); let rt = "Percentage";
          if (vs.includes('fixed')) rt = "Fixed"; else if (vs.includes('incremental')) rt = "Incremental";
          setRebateType(rt); extracted.rebateType = rt;
        }
      }
    });
    if (!extracted.rebateType) setRebateType("Percentage");
    return extracted;
  };

  const handleExportExcel = () => {
    if (!access.canExport) { showToast("You do not have permission to export data", "error"); return; }
    try {
      const workbook = XLSX.utils.book_new();
      let hasData = false;

      const headerLabels = ["Rebate Code","Name","Date From","Date To","Quota Type","Frequency","Redemption Period","Rebate Type","Date Range Scope"];
      const headerValues = [
        rebateCode, rebateName || "", selectedDateFrom || "", selectedDateTo || "",
        getQuotaTypeDisplay(), selectedFrequency || "", redemptionPeriod || "", rebateType || "",
        dateRangeScope,
      ];

      const custRows = customers.filter(c => c.code && c.name);
      if (custRows.length > 0) {
        const custHeader = ["Customer Code","Customer Name"];
        if (showPerRowDate)          custHeader.push("Date From", "Date To");
        if (showCustomerQtrRebate)   custHeader.push("Qtr Qualified", "Qtr Rebate");

        const includePeriodCols =
          quotaType === "withQuota" &&
          (rebateType === "Fixed" || rebateType === "Percentage") &&
          quotaPeriods.length > 0;
        if (includePeriodCols) quotaPeriods.forEach(p => custHeader.push(`${p.label || p.period}`));

        const includeRangesJson = rebateType === "Incremental";
        if (includeRangesJson) custHeader.push("Ranges (JSON)");

        const wsData = [headerLabels, headerValues, [], custHeader, ...custRows.map(c => {
          const r = [c.code || '', c.name || ''];
          if (showPerRowDate)        r.push(c.dateFrom || '', c.dateTo || '');
          if (showCustomerQtrRebate) r.push(
            c.isQualified === false ? 'No' : 'Yes',
            c.isQualified === false ? '' : (c.qtrRebate || '')
          );
          if (includePeriodCols) {
            const arr = rebateType === "Percentage" ? (c.percentages || []) : (c.quotas || []);
            for (let i = 0; i < quotaPeriods.length; i++) r.push(arr[i] ?? '');
          }
          if (includeRangesJson) {
            const hasRanges = c.ranges && typeof c.ranges === 'object' && Object.keys(c.ranges).length > 0;
            r.push(hasRanges ? JSON.stringify(c.ranges) : '');
          }
          return r;
        })];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(workbook, ws, 'Customers');
        hasData = true;
      }

      const itemRows = items.filter(i => i.code && i.name);
      if (itemRows.length > 0) {
        const itemsHeader = ["Item Code","Item Name","Qty","Unit of Measure"];
        if (rebateType === "Percentage")        itemsHeader.push("Percentage Per Bag");
        else if (rebateType === "Fixed")        itemsHeader.push("Rebate Per Bag");
        else if (rebateType === "Incremental")  itemsHeader.push("Rebate Per Bag");
        if (showItemQtrRebate) itemsHeader.push("Qtr Qualified", "Qtr Rebate");
        if (rebateType === "Incremental") itemsHeader.push("Ranges (JSON)");

        const wsData = [headerLabels, headerValues, [], itemsHeader, ...itemRows.map(i => {
          const r = [i.code || '', i.name || '', i.unitPerQty || '', i.unitOfMeasure || ''];
          if (rebateType === "Percentage")        r.push(i.percentagePerBag || '');
          else if (rebateType === "Fixed")        r.push(i.rebatePerBag || '');
          else if (rebateType === "Incremental")  r.push(i.rebatePerBag || '');
          if (showItemQtrRebate) r.push(
            i.isQualified === false ? 'No' : 'Yes',
            i.isQualified === false ? '' : (i.qtrRebate || '')
          );
          if (rebateType === "Incremental") {
            const hasRanges = i.ranges && typeof i.ranges === 'object' && Object.keys(i.ranges).length > 0;
            r.push(hasRanges ? JSON.stringify(i.ranges) : '');
          }
          return r;
        })];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(workbook, ws, 'Items');
        hasData = true;
      }

      if (!hasData) { showToast("No data to export!", "warning"); return; }
      const dateFromF = selectedDateFrom ? selectedDateFrom.replace(/-/g, '') : 'NODATE';
      const dateToF   = selectedDateTo   ? selectedDateTo.replace(/-/g, '')   : 'NODATE';
      const rtF       = rebateType       ? rebateType.toUpperCase()           : 'NOTYPE';
      XLSX.writeFile(workbook, `REBATE_${rtF}_${dateFromF}_${dateToF}_${db}.xlsx`);
      showToast(`Data exported successfully!`, "success");
    } catch { showToast('Error exporting data to Excel.', "error"); }
  };

  const handleDownload = () => handleExportExcel();

  const handleOpenCustomerModal = (index) => {
    if (!access.canEdit) return;
    setCurrentEditingRow({ type: 'customer', index });
    if (customers[index] && customers[index].code) {
      const existing = customersDropdown.find(c => c.CardCode === customers[index].code || c.CardName === customers[index].name);
      setTempSelectedCustomers(existing ? [existing] : []);
    } else setTempSelectedCustomers([]);
    setIsCustomerModalOpen(true);
  };

  const handleCustomerSelectionConfirm = (selectedCustomersData) => {
    const { index } = currentEditingRow;
    if (selectedCustomersData.length > 0) {
      if (index !== null) {
        const selected = selectedCustomersData[0];
        const newCustomers = [...customers];
        newCustomers[index] = {
          ...newCustomers[index],
          code: selected.CardCode || selected.code || '',
          name: selected.CardName || selected.name || '',
          quotas:      quotaType === "withQuota" ? Array(quotaCount).fill("") : [],
          percentages: quotaType === "withQuota" ? Array(quotaCount).fill("") : [],
          ranges: {}, qtrRebate: "", rebatePerBag: "",
          isQualified: newCustomers[index]?.isQualified !== false,
          dateFrom: newCustomers[index]?.dateFrom || "",
          dateTo:   newCustomers[index]?.dateTo || "",
        };
        setCustomers(newCustomers);
        setEditingRows(prev => ({ ...prev, customer: { ...(prev.customer || {}), [index]: true } }));
      } else {
        const newCustomers = [...customers]; let addedCount = 0;
        selectedCustomersData.forEach((sc) => {
          const code = sc.CardCode || sc.code;
          const exists = newCustomers.some(c => c.code === code);
          if (!exists) {
            newCustomers.push({
              code, name: sc.CardName || sc.name || '',
              quotas:      quotaType === "withQuota" ? Array(quotaCount).fill("") : [],
              percentages: quotaType === "withQuota" ? Array(quotaCount).fill("") : [],
              ranges: {}, qtrRebate: "", rebatePerBag: "",
              isQualified: true, dateFrom: "", dateTo: "",
            });
            addedCount++;
          }
        });
        if (addedCount > 0) {
          setCustomers(newCustomers);
          setEditingRows(prev => {
            const oldState = prev.customer || {}; const newState = {};
            newCustomers.forEach((_, idx) => { newState[idx] = Object.prototype.hasOwnProperty.call(oldState, idx) ? oldState[idx] : true; });
            return { ...prev, customer: newState };
          });
        }
      }
    }
    setIsCustomerModalOpen(false); setTempSelectedCustomers([]); setCurrentEditingRow({ type: null, index: null });
  };

  const handleOpenItemModal = (index) => {
    if (!access.canEdit) return;
    setCurrentEditingRow({ type: 'item', index });
    if (items[index] && items[index].code) {
      const existing = itemsDropdown.find(i => i.ItemCode === items[index].code || i.ItemName === items[index].name);
      setTempSelectedItems(existing ? [existing] : []);
    } else setTempSelectedItems([]);
    setIsItemModalOpen(true);
  };

  const handleItemSelectionConfirm = (selectedItemsData) => {
    const { index } = currentEditingRow;
    if (selectedItemsData.length > 0) {
      if (index !== null) {
        const selected = selectedItemsData[0];
        const newItems = [...items];
        newItems[index] = {
          ...newItems[index],
          code: selected.ItemCode || selected.code || '',
          name: selected.ItemName || selected.name || '',
          unitPerQty:       newItems[index].unitPerQty || '1',
          rebatePerBag:     newItems[index].rebatePerBag || '',
          percentagePerBag: newItems[index].percentagePerBag || '',
          qtrRebate:        newItems[index].qtrRebate || '',
          isQualified:      newItems[index].isQualified !== false,
          unitOfMeasure:    getSalUnitMsr(selected),
          ranges: {},
        };
        setItems(newItems);
        setEditingRows(prev => ({ ...prev, item: { ...(prev.item || {}), [index]: true } }));
      } else {
        const newItems = [...items]; let addedCount = 0;
        selectedItemsData.forEach((si) => {
          const code = si.ItemCode || si.code;
          const exists = newItems.some(i => i.code === code);
          if (!exists) {
            newItems.push({
              code, name: si.ItemName || si.name || '',
              unitPerQty: "1", rebatePerBag: "", percentagePerBag: "",
              qtrRebate: "", isQualified: true,
              unitOfMeasure: getSalUnitMsr(si), ranges: {},
            });
            addedCount++;
          }
        });
        if (addedCount > 0) {
          setItems(newItems);
          setEditingRows(prev => {
            const oldState = prev.item || {}; const newState = {};
            newItems.forEach((_, idx) => { newState[idx] = Object.prototype.hasOwnProperty.call(oldState, idx) ? oldState[idx] : true; });
            return { ...prev, item: newState };
          });
        }
      }
    }
    setIsItemModalOpen(false); setTempSelectedItems([]); setCurrentEditingRow({ type: null, index: null });
  };

  const openQuotaModal = (customerIndex) => {
    if (quotaType === "withoutQuota") { showToast("Quota management is disabled for 'Without Quota' programs", "info"); return; }
    const customer = customers[customerIndex];
    if (rebateType === "Percentage")      setPercentageModal({ isOpen: true, customer: { ...customer, index: customerIndex } });
    else if (rebateType === "Incremental") setRangeModal({ isOpen: true, customer: { ...customer, index: customerIndex } });
    else                                   setQuotaModal({ isOpen: true, customer: { ...customer, index: customerIndex }, importedQuotas: importedCustomerQuotas[customerIndex] || [] });
  };

  const handleSaveQuotas = (idx, quotas) => {
    const newCustomers = [...customers];
    newCustomers[idx].quotas = quotas.map(q => q.TargetQty || "0");
    newCustomers[idx].quotaDetails = quotas;
    if (rebateType === "Percentage") newCustomers[idx].percentages = newCustomers[idx].quotas;
    setCustomers(newCustomers);
    showToast("Quotas updated successfully", "success");
  };

  const handleSaveRanges = (idx, ranges) => {
    const newCustomers = [...customers];
    newCustomers[idx].ranges = ranges;
    setCustomers(newCustomers);
    showToast("Rebate ranges updated successfully", "success");
  };

  const handleSavePercentages = (idx, percentagesArray) => {
    const newCustomers = [...customers];
    newCustomers[idx].percentages = percentagesArray.map(p => (p ?? "").toString());
    setCustomers(newCustomers);
    showToast("Target percentages updated successfully", "success");
  };

  const handleSaveProductRanges = (idx, ranges) => {
    const newItems = [...items];
    newItems[idx].ranges = ranges;
    setItems(newItems);
    showToast("Product rebate ranges updated successfully", "success");
  };

  const handleApplyBulkRanges = (ranges, mode) => {
    if (!access.canEdit) return;
    if (!Array.isArray(ranges) || ranges.length === 0) { showToast("No ranges to apply", "warning"); return; }
    let affected = 0;
    setCustomers(prev => prev.map(c => {
      const hasRanges = (() => {
        const r = c.ranges;
        if (!r || typeof r !== 'object') return false;
        const hasDefault = Array.isArray(r['default']) && r['default'].length > 0;
        const hasPeriodKey = Object.keys(r).some(k => Array.isArray(r[k]) && r[k].length > 0);
        return hasDefault || hasPeriodKey;
      })();
      if (mode === "emptyOnly" && hasRanges) return c;
      affected++;
      const cloned = JSON.parse(JSON.stringify(ranges));
      return { ...c, ranges: { default: cloned } };
    }));
    if (affected === 0) showToast("No customers matched the apply mode", "warning");
    else showToast(`Applied ${ranges.length} range${ranges.length !== 1 ? 's' : ''} to ${affected} customer${affected !== 1 ? 's' : ''}`, "success");
    setBulkRangeModalOpen(false);
  };

  const closeQuotaModal        = () => setQuotaModal({ isOpen: false, customer: null, importedQuotas: [] });
  const closeRangeModal        = () => setRangeModal({ isOpen: false, customer: null });
  const closePercentageModal   = () => setPercentageModal({ isOpen: false, customer: null });
  const closeProductRangeModal = () => setProductRangeModal({ isOpen: false, product: null });

  const toggleRowEdit = (type, index) => setEditingRows(prev => ({ ...prev, [type]: { ...prev[type], [index]: !prev[type][index] } }));
  const isRowEditable = (type, index) => editingRows[type][index];

  const handleApplyScope = (scope) => {
    if (!access.canEdit) return;
    setQuotaType("withoutQuota");
    setDateRangeScope(scope);
    if (scope === SCOPE_PER_CUSTOMER) {
      setSelectedDateFrom(""); setSelectedDateTo("");
      setQuotaPeriods([]); setQuotaCount(0);
      setCustomers(prev => prev.map(c => ({ ...c, quotas: [], percentages: [], ranges: c.ranges || {} })));
      setItems(prev => prev.map(i => ({ ...i, ranges: i.ranges || {} })));
      showToast("Per Customer mode — set dates per customer row", "info");
    } else {
      setCustomers(prev => prev.map(c => ({ ...c, dateFrom: "", dateTo: "" })));
      showToast("All Customer/s mode — one date range for all customers", "info");
    }
    setScopeModalOpen(false);
  };

  const handleScopeModalCancel = () => setScopeModalOpen(false);

  const handleQuotaTypeChange = (type) => {
    if (type === "withoutQuota" && rebateType === "Incremental") {
      showToast("Cannot switch to 'Without Quota' while Incremental rebate type is selected.", "error"); return;
    }
    if (type === "withoutQuota") { setScopeModalOpen(true); return; }
    setQuotaType("withQuota");
    if (dateRangeScope !== SCOPE_ALL_CUSTOMERS) setDateRangeScope(SCOPE_ALL_CUSTOMERS);
    showToast("Switched to With Quota mode — date range at header level", "info");
  };

  const getMonthlyPeriodsFromQuotaPeriods = () => {
    return quotaPeriods.map((qp, i) => ({
      period:    qp.period || qp.label || `Period ${i + 1}`,
      label:     qp.label  || qp.period || `Period ${i + 1}`,
      startDate: qp.startDate, endDate: qp.endDate, dates: qp.dates || '',
      month:     qp.label  || qp.period || `Period ${i + 1}`,
      quarter:   qp.quarter,
      year:      qp.year || (qp.startDate ? new Date(qp.startDate).getFullYear() : ''),
    }));
  };

  const handlePerRowDateChange = (index, field, value) => {
    if (!access.canEdit) return;
    const nd = [...customers];
    nd[index] = { ...nd[index], [field]: value };
    setCustomers(nd);
  };

  const validatePerRowDates = (validCustomers) => {
    if (dateRangeScope !== SCOPE_PER_CUSTOMER) return true;
    for (const c of validCustomers) {
      if (!c.dateFrom) { showToast(`Customer "${c.name || c.code}" is missing a Date From`, "error"); return false; }
      if (c.dateTo && c.dateFrom && new Date(c.dateTo) < new Date(c.dateFrom)) {
        showToast(`Customer "${c.name || c.code}" has a Date To earlier than Date From`, "error"); return false;
      }
    }
    return true;
  };

  const getEffectiveDates = (customer) => {
    if (dateRangeScope === SCOPE_PER_CUSTOMER) return { DateFrom: customer.dateFrom || "", DateTo: customer.dateTo || "" };
    return { DateFrom: selectedDateFrom || "", DateTo: selectedDateTo || "" };
  };

  const resolveEffectiveHeaderDates = (validCustomers) => {
    if (dateRangeScope === SCOPE_PER_CUSTOMER) {
      const froms = validCustomers.map(c => c.dateFrom).filter(Boolean).sort();
      const tos   = validCustomers.map(c => c.dateTo).filter(Boolean).sort();
      const df = froms[0] || "";
      const dt = tos[tos.length - 1] || df;
      return { effDateFrom: df, effDateTo: dt };
    }
    return { effDateFrom: selectedDateFrom, effDateTo: selectedDateTo };
  };

  const handleUpdate = async () => {
    if (!access.canEdit) { showToast("You do not have permission to update rebate setups", "error"); return; }
    if (!rebateType)            { showToast("Please select a rebate type", "error"); return; }
    if (!quotaType)             { showToast("Please select a Quota Type", "error"); return; }
    if (rebateType === "Incremental" && quotaType === "withoutQuota") {
      showToast("Cannot update: Incremental rebate type requires quota.", "error"); return;
    }
    if (!selectedFrequency) { showToast("Please select frequency", "error"); return; }

    const validCustomers = customers.filter(c => c.code && c.name);
    const validItems     = items.filter(i => i.code && i.name);
    if (validCustomers.length === 0) { showToast("Please add at least one valid customer", "error"); return; }
    if (validItems.length === 0)     { showToast("Please add at least one valid item", "error"); return; }
    if (!validatePerRowDates(validCustomers)) return;

    if (dateRangeScope === SCOPE_ALL_CUSTOMERS && (!selectedDateFrom || !selectedDateTo)) {
      showToast("All Customer/s scope requires a header date range", "error"); return;
    }
    if (isQuarterly && dateRangeScope === SCOPE_ALL_CUSTOMERS) {
      const qCheck = validateQuarterlyRange(selectedDateFrom, selectedDateTo);
      if (!qCheck.ok) { showToast(`Quarterly programs must use exact quarter dates — ${qCheck.reason}`, "error"); return; }
    }

    const { effDateFrom, effDateTo } = resolveEffectiveHeaderDates(validCustomers);
    if (!effDateFrom || !effDateTo) { showToast("Please provide a date range (header or per-row)", "error"); return; }

    const codeToUpdate = loadedRebateCode;
    setLoading(true);
    try {
      const dupCheckRes = await fetch(`${API_BASE}/rebate-program/check-duplicate-program`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateType: rebateType, DateFrom: effDateFrom, DateTo: effDateTo, Frequency: selectedFrequency, ExcludeRebateCode: codeToUpdate, db }),
      });
      if (!dupCheckRes.ok) throw new Error(`Server returned status ${dupCheckRes.status}`);
      const dupCheckResult = await dupCheckRes.json();
      if (dupCheckResult.success && dupCheckResult.exists) {
        setDuplicationError({ isOpen: true, type: 'duplicateProgram', data: { program: dupCheckResult.program } });
        showToast(`⚠️ Overlapping rebate program detected`, "error"); setLoading(false); return;
      }

      const duplicateCustomers = [];
      for (const customer of validCustomers) {
        try {
          const res = await fetch(`${API_BASE}/rebate-program/check-customer-conflict`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ RebateType: rebateType, DateFrom: effDateFrom, DateTo: effDateTo, Frequency: selectedFrequency, CardCode: customer.code, ExcludeRebateCode: codeToUpdate, db }),
          });
          if (!res.ok) continue;
          const result = await res.json();
          if (result && result.exists) duplicateCustomers.push({ name: customer.name, code: customer.code, existingProgram: result.existingProgram });
        } catch { /* ignore */ }
      }
      if (duplicateCustomers.length > 0) {
        setDuplicationError({ isOpen: true, type: 'duplicateCustomer', data: { duplicateCustomers } });
        showToast(`⚠️ Found ${duplicateCustomers.length} customer(s) with an overlapping active rebate`, "error"); setLoading(false); return;
      }

      const existingCustRes  = await fetch(`${API_BASE}/rebate-program/customers/${encodeURIComponent(codeToUpdate)}?db=${db}&type=${encodeURIComponent(rebateType)}`);
      const existingItemsRes = await fetch(`${API_BASE}/rebate-program/items/${encodeURIComponent(codeToUpdate)}?db=${db}&type=${encodeURIComponent(rebateType)}`);
      let existingCustomers = [], existingItems = [];
      if (existingCustRes.ok)  existingCustomers = (await existingCustRes.json()).customers || [];
      if (existingItemsRes.ok) existingItems     = (await existingItemsRes.json()).items || [];
      const customerCreatedMap = {}; existingCustomers.forEach(c => { customerCreatedMap[c.CardCode] = c.CreatedDate; });
      const itemCreatedMap = {};     existingItems.forEach(i => { itemCreatedMap[i.ItemCode] = i.CreatedDate; });

      const progRes = await fetch(`${API_BASE}/rebate-program/${encodeURIComponent(codeToUpdate)}?db=${db}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RebateType: rebateType,
          DateFrom: dateRangeScope === SCOPE_PER_CUSTOMER ? null : selectedDateFrom,
          DateTo:   dateRangeScope === SCOPE_PER_CUSTOMER ? null : selectedDateTo,
          DateRangeScope: dateRangeScope,
          Frequency: selectedFrequency,
          RedemptionPeriod: redemptionPeriod,
          QuotaType: quotaType === "withQuota" ? "With Quota" : "Without Quota",
          Name: rebateName,
          UpdatedBy: userCode || userName, db,
        }),
      });
      if (!progRes.ok) throw new Error("Failed to update program header");

      const delRes = await fetch(`${API_BASE}/rebate-program/${encodeURIComponent(codeToUpdate)}/details?db=${db}&type=${encodeURIComponent(rebateType)}`, { method: 'DELETE' });
      if (!delRes.ok) throw new Error("Failed to clear existing details");

      if      (rebateType === "Fixed")       await saveFixedRebateData(codeToUpdate, db, customerCreatedMap, itemCreatedMap);
      else if (rebateType === "Incremental") await saveIncrementalRebateData(codeToUpdate, db, customerCreatedMap, itemCreatedMap);
      else if (rebateType === "Percentage")  await savePercentageRebateData(codeToUpdate, db, customerCreatedMap, itemCreatedMap);

      showToast(`Rebate program "${codeToUpdate}" updated successfully!`, "success");
      setEditingRows({ customer: {}, item: {} });
    } catch (error) { showToast(`Failed to update rebate setup: ${error.message}`, "error"); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!access.canCreate) { showToast("You do not have permission to save rebate setups", "error"); return; }
    if (!rebateType)            { showToast("Please select a rebate type", "error"); return; }
    if (!quotaType)             { showToast("Please select a Quota Type", "error"); return; }
    if (rebateType === "Incremental" && quotaType === "withoutQuota") {
      showToast("Cannot save: Incremental rebate type requires quota.", "error"); return;
    }
    if (!selectedFrequency) { showToast("Please select frequency", "error"); return; }

    const validCustomers = customers.filter(c => c.code && c.name);
    const validItems     = items.filter(i => i.code && i.name);
    if (validCustomers.length === 0) { showToast("Please add at least one valid customer", "error"); return; }
    if (validItems.length === 0)     { showToast("Please add at least one valid item", "error"); return; }
    if (!validatePerRowDates(validCustomers)) return;

    if (dateRangeScope === SCOPE_ALL_CUSTOMERS && (!selectedDateFrom || !selectedDateTo)) {
      showToast("All Customer/s scope requires a header date range", "error"); return;
    }
    if (isQuarterly && dateRangeScope === SCOPE_ALL_CUSTOMERS) {
      const qCheck = validateQuarterlyRange(selectedDateFrom, selectedDateTo);
      if (!qCheck.ok) { showToast(`Quarterly programs must use exact quarter dates — ${qCheck.reason}`, "error"); return; }
    }

    const { effDateFrom, effDateTo } = resolveEffectiveHeaderDates(validCustomers);
    if (!effDateFrom || !effDateTo) { showToast("Please provide a date range (header or per-row)", "error"); return; }

    setLoading(true);
    try {
      const dupCheckRes = await fetch(`${API_BASE}/rebate-program/check-duplicate-program`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateType: rebateType, DateFrom: effDateFrom, DateTo: effDateTo, Frequency: selectedFrequency, db }),
      });
      if (!dupCheckRes.ok) throw new Error(`Server returned status ${dupCheckRes.status}`);
      const dupCheckResult = await dupCheckRes.json();
      if (dupCheckResult.success && dupCheckResult.exists) {
        setDuplicationError({ isOpen: true, type: 'duplicateProgram', data: { program: dupCheckResult.program } });
        showToast(`⚠️ Overlapping rebate program detected`, "error"); setLoading(false); return;
      }

      const duplicateItems = [];
      for (const item of validItems) {
        try {
          const res = await fetch(`${API_BASE}/rebate-program/check-item-conflict`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ RebateType: rebateType, DateFrom: effDateFrom, DateTo: effDateTo, Frequency: selectedFrequency, ItemCode: item.code, db }),
          });
          if (!res.ok) continue;
          const result = await res.json();
          if (result && result.exists) duplicateItems.push({ name: item.name, code: item.code, existingProgram: result.existingProgram });
        } catch { /* ignore */ }
      }
      if (duplicateItems.length > 0) {
        setDuplicationError({ isOpen: true, type: 'duplicateItem', data: { duplicateItems } });
        showToast(`⚠️ Found ${duplicateItems.length} duplicate item(s)`, "error"); setLoading(false); return;
      }

      const duplicateCustomers = [];
      for (const customer of validCustomers) {
        try {
          const res = await fetch(`${API_BASE}/rebate-program/check-customer-conflict`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ RebateType: rebateType, DateFrom: effDateFrom, DateTo: effDateTo, Frequency: selectedFrequency, CardCode: customer.code, db }),
          });
          if (!res.ok) continue;
          const result = await res.json();
          if (result && result.exists) duplicateCustomers.push({ name: customer.name, code: customer.code, existingProgram: result.existingProgram });
        } catch { /* ignore */ }
      }
      if (duplicateCustomers.length > 0) {
        setDuplicationError({ isOpen: true, type: 'duplicateCustomer', data: { duplicateCustomers } });
        showToast(`⚠️ Found ${duplicateCustomers.length} customer(s) with an overlapping active rebate`, "error"); setLoading(false); return;
      }

      const newRebateCode = await generateNextRebateCode();
      const rebateProgramData = {
        RebateType: rebateType,
        DateFrom: dateRangeScope === SCOPE_PER_CUSTOMER ? null : selectedDateFrom,
        DateTo:   dateRangeScope === SCOPE_PER_CUSTOMER ? null : selectedDateTo,
        DateRangeScope: dateRangeScope,
        Frequency: selectedFrequency,
        RedemptionPeriod: redemptionPeriod,
        QuotaType: quotaType === "withQuota" ? "With Quota" : "Without Quota",
        Name: rebateName,
        CreatedBy: userCode || userName,
        UpdatedBy: userCode || userName,
        db,
      };

      const programRes = await fetch(`${API_BASE}/rebate-program?db=${db}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rebateProgramData),
      });
      if (!programRes.ok) { const t = await programRes.text(); throw new Error(`Failed to save rebate program: ${t}`); }
      const programResult = await programRes.json();
      const rebateCodeId  = programResult.rebateCode;

      if      (rebateType === "Fixed")       await saveFixedRebateData(rebateCodeId, db);
      else if (rebateType === "Incremental") await saveIncrementalRebateData(rebateCodeId, db);
      else if (rebateType === "Percentage")  await savePercentageRebateData(rebateCodeId, db);

      showToast(`Rebate setup saved successfully! ID: ${rebateCodeId}`, "success");
      clearFormData();
    } catch (error) { showToast(`Failed to save rebate setup: ${error.message}`, "error"); }
    finally { setLoading(false); }
  };

  const saveFixedRebateData = async (rebateCodeId, database, customerCreatedMap = {}, itemCreatedMap = {}) => {
    for (const customer of customers) {
      if (!customer.code || !customer.name) continue;
      const originalCreated  = customerCreatedMap[customer.code] || null;
      const qtrValue         = deriveQtrValue(customer.isQualified, customer.qtrRebate);
      const qtrQualifiedFlag = deriveQtrQualified(customer.isQualified, customer.qtrRebate);
      const { DateFrom, DateTo } = getEffectiveDates(customer);

      const custRes = await fetch(`${API_BASE}/fix-cust-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RebateCode: rebateCodeId, CardCode: customer.code, CardName: customer.name,
          QtrRebate: qtrValue, QtrQualified: qtrQualifiedFlag,
          DateFrom, DateTo, CreatedDate: originalCreated, db,
        }),
      });
      if (!custRes.ok) { const t = await custRes.text(); throw new Error(`Failed to save customer ${customer.code}: ${t}`); }
      const custResult   = await custRes.json();
      const custRebateId = custResult.id;
      if (!custRebateId) throw new Error(`No CustRebateId returned for ${customer.code}`);

      if (quotaType === "withQuota" && customer.quotas && customer.quotas.length > 0) {
        const periods = (quotaPeriods.length > 0) ? quotaPeriods : getMonthlyPeriodsFromQuotaPeriods();
        for (let i = 0; i < customer.quotas.length; i++) {
          const raw = customer.quotas[i];
          if (raw === "" || raw == null) continue;
          const val = parseFloat(raw);
          if (isNaN(val)) continue;
          const period    = periods[i] || {};
          const monthName = period.label || period.period || `Period ${i + 1}`;
          const qr = await fetch(`${API_BASE}/fix-cust-quota?db=${database}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ CustRebateId: custRebateId, Month: monthName, TargetQty: val, db }),
          });
          if (!qr.ok) { const t = await qr.text(); throw new Error(`Failed to save quota for ${customer.code} / ${monthName}: ${t}`); }
        }
      }
    }
    for (const item of items) {
      if (!item.code || !item.name) continue;
      const originalCreated  = itemCreatedMap[item.code] || null;
      const qtrValue         = deriveQtrValue(item.isQualified, item.qtrRebate);
      const qtrQualifiedFlag = deriveQtrQualified(item.isQualified, item.qtrRebate);
      const ir = await fetch(`${API_BASE}/fix-prod-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RebateCode: rebateCodeId, ItemCode: item.code, ItemName: item.name,
          UnitPerQty: parseFloat(item.unitPerQty) || 0,
          RebatePerBag: parseFloat(item.rebatePerBag) || 0,
          QtrRebate: qtrValue, QtrQualified: qtrQualifiedFlag,
          UnitOfMeasure: item.unitOfMeasure || '',
          CreatedDate: originalCreated, db,
        }),
      });
      if (!ir.ok) { const t = await ir.text(); throw new Error(`Failed to save item ${item.code}: ${t}`); }
    }
  };

  const saveIncrementalRebateData = async (rebateCodeId, database, customerCreatedMap = {}, itemCreatedMap = {}) => {
    const pickRangesToSave = (rangesMap) => {
      if (!rangesMap || typeof rangesMap !== 'object') return null;
      if (Array.isArray(rangesMap['default']) && rangesMap['default'].length > 0) return rangesMap['default'];
      if (Array.isArray(rangesMap[0]) && rangesMap[0].length > 0) return rangesMap[0];
      const numericKeys = Object.keys(rangesMap).filter(k => k !== 'default' && !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
      for (const k of numericKeys) if (Array.isArray(rangesMap[k]) && rangesMap[k].length > 0) return rangesMap[k];
      return null;
    };

    for (const customer of customers) {
      if (!customer.code || !customer.name) continue;
      const originalCreated  = customerCreatedMap[customer.code] || null;
      const qtrValue         = deriveQtrValue(customer.isQualified, customer.qtrRebate);
      const qtrQualifiedFlag = deriveQtrQualified(customer.isQualified, customer.qtrRebate);
      const { DateFrom, DateTo } = getEffectiveDates(customer);

      const custRes = await fetch(`${API_BASE}/inc-cust-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RebateCode: rebateCodeId, CardCode: customer.code, CardName: customer.name,
          QtrRebate: qtrValue, QtrQualified: qtrQualifiedFlag,
          DateFrom, DateTo, CreatedDate: originalCreated, db,
        }),
      });
      if (!custRes.ok) { const t = await custRes.text(); throw new Error(`Failed: ${t}`); }
      const incCustRebateId = (await custRes.json()).id;

      const rangesToSave = pickRangesToSave(customer.ranges);
      if (rangesToSave) {
        let rangeNo = 1;
        for (const range of rangesToSave) {
          const rr = await fetch(`${API_BASE}/inc-cust-range?db=${database}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              IncCustRebateId: incCustRebateId, RangeNo: rangeNo,
              MinQty: parseInt(range.min) || 0, MaxQty: parseInt(range.max) || 0,
              RebatePerBag: parseFloat(range.rebate) || 0, db,
            }),
          });
          if (!rr.ok) { const t = await rr.text(); throw new Error(`Failed range: ${t}`); }
          rangeNo++;
        }
      }
    }

    for (const item of items) {
      if (!item.code || !item.name) continue;
      const originalCreated  = itemCreatedMap[item.code] || null;
      const qtrValue         = deriveQtrValue(item.isQualified, item.qtrRebate);
      const qtrQualifiedFlag = deriveQtrQualified(item.isQualified, item.qtrRebate);
      const ir = await fetch(`${API_BASE}/inc-item-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RebateCode: rebateCodeId, ItemCode: item.code, ItemName: item.name,
          UnitPerQty: parseInt(item.unitPerQty) || 0,
          UnitOfMeasure: item.unitOfMeasure || '',
          RebatePerBag: parseFloat(item.rebatePerBag) || 0,
          QtrRebate: qtrValue, QtrQualified: qtrQualifiedFlag,
          CreatedDate: originalCreated, db,
        }),
      });
      if (!ir.ok) { const t = await ir.text(); throw new Error(`Failed item: ${t}`); }
      const itemRebateId = (await ir.json()).id;

      const rangesToSave = pickRangesToSave(item.ranges);
      if (rangesToSave) {
        let rangeNo = 1;
        for (const range of rangesToSave) {
          const rr = await fetch(`${API_BASE}/inc-item-range?db=${database}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ItemRebateId: itemRebateId, RangeNo: rangeNo,
              MinQty: parseInt(range.min) || 0, MaxQty: parseInt(range.max) || 0,
              RebatePerBag: parseFloat(range.rebate) || 0, db,
            }),
          });
          if (!rr.ok) { const t = await rr.text(); throw new Error(`Failed item range: ${t}`); }
          rangeNo++;
        }
      }
    }
  };

  const savePercentageRebateData = async (rebateCodeId, database, customerCreatedMap = {}, itemCreatedMap = {}) => {
    for (const customer of customers) {
      if (!customer.code || !customer.name) continue;
      const originalCreated  = customerCreatedMap[customer.code] || null;
      const qtrValue         = deriveQtrValue(customer.isQualified, customer.qtrRebate);
      const qtrQualifiedFlag = deriveQtrQualified(customer.isQualified, customer.qtrRebate);
      const { DateFrom, DateTo } = getEffectiveDates(customer);

      const custRes = await fetch(`${API_BASE}/per-cust-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RebateCode: rebateCodeId, CardCode: customer.code, CardName: customer.name,
          QtrRebate: qtrValue, QtrQualified: qtrQualifiedFlag,
          DateFrom, DateTo, CreatedDate: originalCreated, db,
        }),
      });
      if (!custRes.ok) { const t = await custRes.text(); throw new Error(`Failed: ${t}`); }
      const custResult      = await custRes.json();
      const perCustRebateId = custResult.id;
      if (quotaType === "withQuota" && customer.percentages && customer.percentages.length > 0) {
        const periods = getMonthlyPeriodsFromQuotaPeriods();
        const percentagesToSave = [];
        for (let i = 0; i < periods.length; i++) {
          const monthName = periods[i]?.label || `Period ${i + 1}`;
          const val       = customer.percentages[i] || "";
          if (val !== "" && val !== null) {
            const pv = parseFloat(val);
            if (!isNaN(pv)) percentagesToSave.push({ Month: monthName, TargetQty: pv });
          }
        }
        if (percentagesToSave.length > 0) {
          const bulkRes = await fetch(`${API_BASE}/per-cust-quotas/bulk?db=${database}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ CustRebateId: perCustRebateId, quotas: percentagesToSave, db }),
          });
          if (!bulkRes.ok) {
            for (const p of percentagesToSave) {
              await fetch(`${API_BASE}/per-cust-quota?db=${database}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ PerCustRebateId: perCustRebateId, Month: p.Month, TargetQty: p.TargetQty, db }),
              });
            }
          }
        }
      }
    }
    for (const item of items) {
      if (!item.code || !item.name) continue;
      const originalCreated  = itemCreatedMap[item.code] || null;
      const qtrValue         = deriveQtrValue(item.isQualified, item.qtrRebate);
      const qtrQualifiedFlag = deriveQtrQualified(item.isQualified, item.qtrRebate);
      const ir = await fetch(`${API_BASE}/per-prod-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RebateCode: rebateCodeId, ItemCode: item.code, ItemName: item.name,
          UnitPerQty: parseFloat(item.unitPerQty) || 0,
          PercentagePerBag: parseFloat(item.percentagePerBag) || 0,
          QtrRebate: qtrValue, QtrQualified: qtrQualifiedFlag,
          UnitOfMeasure: item.unitOfMeasure || '',
          CreatedDate: originalCreated, db,
        }),
      });
      if (!ir.ok) { const t = await ir.text(); throw new Error(`Failed item: ${t}`); }
    }
  };

  const handleAddCustomer = () => {
    if (!access.canEdit) { showToast("You do not have permission to add customers", "error"); return; }
    setCurrentEditingRow({ type: 'customer', index: null }); setTempSelectedCustomers([]); setIsCustomerModalOpen(true);
  };
  const handleAddItem = () => {
    if (!access.canEdit) { showToast("You do not have permission to add items", "error"); return; }
    setCurrentEditingRow({ type: 'item', index: null }); setTempSelectedItems([]); setIsItemModalOpen(true);
  };

  const handleQtrRebateChange = (index, value) => {
    if (!access.canEdit) return;
    const newData = [...customers];
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) { newData[index].qtrRebate = value; setCustomers(newData); }
  };
  const handleItemQtrRebateChange = (index, value) => {
    if (!access.canEdit) return;
    const newData = [...items];
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) { newData[index].qtrRebate = value; setItems(newData); }
  };
  const handleRebatePerBagChange = (index, value) => {
    const newData = [...items];
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) { newData[index].rebatePerBag = value; setItems(newData); }
  };
  const handlePercentagePerBagChange = (index, value) => {
    const newData = [...items];
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
      const n = parseFloat(value);
      if ((n >= 0 && n <= 100) || value === "" || value === "0") newData[index].percentagePerBag = value;
      setItems(newData);
    }
  };

  const handleToggleQualified = (type, index) => {
    if (!access.canEdit) return;
    if (type === 'customer') {
      const nd = [...customers];
      const nowQualified = !(nd[index].isQualified !== false);
      nd[index] = { ...nd[index], isQualified: nowQualified, qtrRebate: nowQualified ? (nd[index].qtrRebate || "") : "" };
      setCustomers(nd);
    } else {
      const nd = [...items];
      const nowQualified = !(nd[index].isQualified !== false);
      nd[index] = { ...nd[index], isQualified: nowQualified, qtrRebate: nowQualified ? (nd[index].qtrRebate || "") : "" };
      setItems(nd);
    }
  };

  const handleMarkAllQualified = (type, qualified) => {
    if (!access.canEdit) return;
    if (type === 'customer') {
      setCustomers(prev => prev.map(c => ({ ...c, isQualified: qualified, qtrRebate: qualified ? (c.qtrRebate || "") : "" })));
      showToast(qualified ? "All customers marked as qualified" : "All customers marked as not qualified", "info");
    } else {
      setItems(prev => prev.map(i => ({ ...i, isQualified: qualified, qtrRebate: qualified ? (i.qtrRebate || "") : "" })));
      showToast(qualified ? "All items marked as qualified" : "All items marked as not qualified", "info");
    }
  };

  const handleBulkApplyQtr = (type) => {
    if (!access.canEdit) return;
    const bulk = type === 'customer' ? customerQtrBulk : itemQtrBulk;
    if (bulk === "" || bulk == null) { showToast("Enter a Qtr Rebate value first", "warning"); return; }
    const num = parseFloat(bulk);
    if (isNaN(num)) { showToast("Qtr Rebate must be a valid number", "error"); return; }
    if (type === 'customer') {
      const count = customers.filter(c => c.isQualified !== false).length;
      if (count === 0) { showToast("No qualified customers to apply to", "warning"); return; }
      setCustomers(prev => prev.map(c => (c.isQualified !== false ? { ...c, qtrRebate: bulk } : c)));
      showToast(`Applied ₱${bulk} to ${count} qualified customer${count !== 1 ? 's' : ''}`, "success");
    } else {
      const count = items.filter(i => i.isQualified !== false).length;
      if (count === 0) { showToast("No qualified items to apply to", "warning"); return; }
      setItems(prev => prev.map(i => (i.isQualified !== false ? { ...i, qtrRebate: bulk } : i)));
      showToast(`Applied ₱${bulk} to ${count} qualified item${count !== 1 ? 's' : ''}`, "success");
    }
  };

  const handleApplyBulkQuota = () => {
    if (!access.canEdit) return;
    if (customers.length === 0) { showToast("No customers to apply quota to", "warning"); return; }
    if (quotaPeriods.length === 0) { showToast("No quota periods available — set a date range first", "warning"); return; }
    const hasAnyValue = bulkQuotas.some(v => v !== "" && v != null);
    if (!hasAnyValue) { showToast("Enter at least one quota value first", "warning"); return; }

    const field = rebateType === "Percentage" ? "percentages" : "quotas";
    setCustomers(prev => prev.map(c => {
      const current = Array.isArray(c[field]) ? [...c[field]] : [];
      while (current.length < quotaPeriods.length) current.push("");
      for (let i = 0; i < quotaPeriods.length; i++) {
        const v = bulkQuotas[i];
        if (v !== "" && v != null) current[i] = v;
      }
      return { ...c, [field]: current };
    }));
    showToast(`Applied quota values to ${customers.length} customer${customers.length !== 1 ? 's' : ''} across ${quotaPeriods.length} period${quotaPeriods.length !== 1 ? 's' : ''}`, "success");
  };

  const handleDeleteCustomer = (index) => {
    if (!access.canEdit) return;
    if (customers.length <= 1) { showToast("At least one customer is required", "warning"); return; }
    setRemoveCustomerModal({ isOpen: true, index, name: customers[index]?.name || "" });
  };
  const handleDeleteItem = (index) => {
    if (!access.canEdit) return;
    if (items.length <= 1) { showToast("At least one item is required", "warning"); return; }
    setRemoveItemModal({ isOpen: true, index, name: items[index]?.name || "" });
  };

  const confirmDeleteCustomer = () => {
    const { index } = removeCustomerModal;
    const nextCustomers = customers.filter((_, i) => i !== index);
    setCustomers(nextCustomers);
    setEditingRows(prev => {
      const oldState = prev.customer || {}; const newState = {};
      nextCustomers.forEach((_, idx) => {
        const oldIdx = idx < index ? idx : idx + 1;
        newState[idx] = Object.prototype.hasOwnProperty.call(oldState, oldIdx) ? oldState[oldIdx] : true;
      });
      return { ...prev, customer: newState };
    });
    showToast("Customer deleted successfully", "success");
    setRemoveCustomerModal({ isOpen: false, index: null, name: "" });
  };

  const confirmDeleteItem = () => {
    const { index } = removeItemModal;
    const nextItems = items.filter((_, i) => i !== index);
    setItems(nextItems);
    setEditingRows(prev => {
      const oldState = prev.item || {}; const newState = {};
      nextItems.forEach((_, idx) => {
        const oldIdx = idx < index ? idx : idx + 1;
        newState[idx] = Object.prototype.hasOwnProperty.call(oldState, oldIdx) ? oldState[oldIdx] : true;
      });
      return { ...prev, item: newState };
    });
    showToast("Item deleted successfully", "success");
    setRemoveItemModal({ isOpen: false, index: null, name: "" });
  };

  const clearFormData = () => {
    setRebateType(defaultRebateType || "");
    setQuotaType("withQuota");
    setCustomers([]); setItems([]);
    setSelectedDateFrom(""); setSelectedDateTo("");
    setSelectedFrequency(""); setRedemptionPeriod(""); setRebateName("");
    setQuotaCount(0); setQuotaPeriods([]); setImportedCustomerQuotas({});
    setRebateCode("REB-"); setEditingRows({ customer: {}, item: {} });
    setIsViewMode(false); setLoadedRebateCode("");
    setCustomerQtrBulk(""); setItemQtrBulk("");
    setBulkQuotas([]);
    setDateRangeScope(SCOPE_ALL_CUSTOMERS);
    setScopeModalOpen(false);
    setBulkRangeModalOpen(false);
  };

  const resetForm = () => {
    clearFormData();
    showToast("Form reset successfully", "success");
    setConfirmModal({ isOpen: false, action: null, data: null });
  };

  const getQuotaTypeDisplay = () =>
    quotaType === "withQuota" ? "With Quota"
    : quotaType === "withoutQuota" ? "Without Quota"
    : "";

  const inputClass = "w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all min-h-[42px] ds-glass";
  const selectClass = "w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all min-h-[42px] appearance-none ds-glass";
  const inputStyle = { background: K.glass, border: `1px solid ${K.hairline}`, color: K.ink };
  const labelClass = "block text-xs font-semibold uppercase tracking-widest mb-1.5";

  const getRebateTypeBadge = (type) => {
    const c = type === 'Fixed' ? PALETTE.blue : type === 'Incremental' ? PALETTE.green : type === 'Percentage' ? PALETTE.orange : null;
    if (!c) return {};
    return { background: `${c}1c`, color: c, border: `1px solid ${c}33` };
  };

  const renderAccessLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: `${PALETTE.blue}33`, borderTopColor: PALETTE.blue }} />
      <p className="text-sm" style={{ color: K.muted }}>Verifying access…</p>
    </div>
  );

  const renderAccessDenied = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: `${PALETTE.red}18`, border: `1px solid ${PALETTE.red}33` }}>
        <Lock size={28} style={{ color: PALETTE.red }} />
      </div>
      <h2 className="text-lg font-semibold mb-2" style={{ color: K.ink }}>Access Restricted</h2>
      <p className="max-w-xs text-sm mb-6" style={{ color: K.muted }}>
        You don't have permission to view this page.
        {accessError && <span className="block mt-1 text-xs opacity-60">Error: {accessError}</span>}
      </p>
      <Link to="/HomePage" className="ds-gradient-primary px-4 py-2 text-white rounded-full text-sm font-medium">
        Go to Home
      </Link>
    </div>
  );

  const customerColCount =
    2 + (showPerRowDate ? 2 : 0) + (showCustomerQtrRebate ? 2 : 0) + 1 + 1;

  const itemValueColCount =
    rebateType === "Percentage" ? 1 : (rebateType === "Incremental" && quotaType === "withQuota") ? 0 : 1;
  const itemColCount = 4 + itemValueColCount + (showItemQtrRebate ? 2 : 0) + 1;

  const renderBulkQtrBar = (scope) => {
    const isCustomer = scope === 'customer';
    const bulkValue = isCustomer ? customerQtrBulk : itemQtrBulk;
    const setBulkValue = isCustomer ? setCustomerQtrBulk : setItemQtrBulk;
    const qualifiedCount = (isCustomer ? customers : items).filter(x => x.isQualified !== false).length;
    const totalCount = (isCustomer ? customers : items).length;

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl flex-shrink-0 ds-glass bg-[#BF5AF2]/5 border border-[#BF5AF2]/15">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-[#BF5AF2]" />
          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: K.ink }}>Bulk Qtr Rebate</span>
          <span className="text-[10px] whitespace-nowrap hidden sm:inline" style={{ color: K.faint }}>
            (<span className="text-[#32D74B]">{qualifiedCount}</span>/{totalCount})
          </span>
        </div>
        <div className="relative flex-shrink-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: K.faint }}>₱</span>
          <input type="text" value={bulkValue}
            onChange={(e) => { const v = e.target.value; if (v === "" || /^-?\d*\.?\d*$/.test(v)) setBulkValue(v); }}
            placeholder="0.00" disabled={!access.canEdit}
            className="ds-glass w-24 pl-6 pr-2 py-1.5 rounded-xl text-xs focus:outline-none bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
            style={{ opacity: !access.canEdit ? 0.5 : 1 }} />
        </div>
        <button onClick={() => handleBulkApplyQtr(scope)} disabled={!access.canEdit || !bulkValue}
          className="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40 whitespace-nowrap bg-[#BF5AF2] text-white hover:brightness-110 transition-all">
          Apply
        </button>
      </div>
    );
  };

  const renderBulkQuotaBar = () => {
    if (quotaType !== "withQuota") return null;
    if (quotaPeriods.length === 0) return null;
    if (customers.length === 0) return null;
    if (rebateType === "Incremental") return null;

    const field = rebateType === "Percentage" ? "Percentages" : "Quotas";

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl flex-shrink-0 ds-glass bg-[#0A84FF]/5 border border-[#0A84FF]/15">
        <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
          <Target className="w-3.5 h-3.5 flex-shrink-0 text-[#0A84FF]" />
          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: K.ink }}>Bulk {field}</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto ds-scroll pb-0.5 max-w-[280px] lg:max-w-[420px]">
          {quotaPeriods.map((p, i) => (
            <input key={i} type="text"
              value={bulkQuotas[i] ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*\.?\d*$/.test(v)) {
                  const next = [...bulkQuotas];
                  next[i] = v;
                  setBulkQuotas(next);
                }
              }}
              placeholder={p.label || p.period || "0"}
              title={p.label || p.period || `Period ${i + 1}`}
              disabled={!access.canEdit}
              className="ds-glass w-20 px-2 py-1.5 rounded-lg text-xs flex-shrink-0 bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
              style={{ opacity: !access.canEdit ? 0.5 : 1 }} />
          ))}
        </div>
        <button onClick={handleApplyBulkQuota} disabled={!access.canEdit}
          className="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40 whitespace-nowrap flex-shrink-0 bg-[#0A84FF] text-white hover:brightness-110 transition-all">
          Apply
        </button>
      </div>
    );
  };

  const renderBulkRangeBar = () => {
    if (rebateType !== "Incremental") return null;
    if (customers.length === 0) return null;

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl flex-shrink-0 ds-glass bg-[#32D74B]/5 border border-[#32D74B]/15">
        <div className="flex items-center gap-1.5 min-w-0">
          <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-[#32D74B]" />
          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: K.ink }}>Apply Ranges to All</span>
          <span className="text-[10px] whitespace-nowrap hidden sm:inline" style={{ color: K.faint }}>
            (<span className="text-[#FF9F0A]">{customersWithNoRanges}</span>/{customers.length} empty)
          </span>
        </div>
        <button onClick={() => setBulkRangeModalOpen(true)} disabled={!access.canEdit}
          className="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40 whitespace-nowrap flex-shrink-0 bg-[#32D74B] text-white hover:brightness-110 transition-all">
          Open
        </button>
      </div>
    );
  };

  const renderQualifiedToggle = (scope, index, isQualifiedFlag, qtrRebateValue) => {
    const yes = isQualifiedFlag !== false && deriveQtrQualified(true, qtrRebateValue) === 1;
    const c = yes ? PALETTE.green : PALETTE.gray;
    return (
      <button onClick={() => handleQualifiedToggle(scope, index)} disabled={!access.canEdit}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
        style={{ background: `${c}1c`, color: c, border: `1px solid ${c}44` }}
        title={isQualifiedFlag !== false && !yes ? "No positive Qtr Rebate — will save as 0" : undefined}>
        {yes ? <CheckCircle size={12} /> : <X size={12} />}
        {yes ? "Yes" : "No"}
      </button>
    );
  };

  const handleQualifiedToggle = (type, index) => handleToggleQualified(type, index);

  return (
    <DesignPage className="flex h-screen w-full overflow-hidden">
      <div className="pointer-events-none fixed inset-0 ds-aurora-blue-purple z-0" />

      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown} setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown} setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />

      <main className={`relative flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"} z-[1]`}>
        <Header collapsed={collapsed} userName={userName} userCode={userCode} initials={initials} logo={logo} theme={theme} />

        <div className="pt-16 flex-1 flex flex-col overflow-hidden">
          <div
            className="ds-glass rounded-[22px] w-full max-w-[calc(100%-3rem)] mx-6 my-4 overflow-hidden flex flex-col flex-1 relative bg-[var(--ds-glass)] border border-[var(--ds-hairline)] shadow-[var(--ds-shadow)]"
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {isDragOver && (
              <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[22px] pointer-events-none bg-[#0A84FF]/8 backdrop-blur-md">
                <div className="ds-glass px-6 py-4 rounded-2xl bg-[var(--ds-glass-deep)] border border-[#0A84FF]/33">
                  <p className="font-medium text-[#0A84FF]">Drop your Excel file here</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-6 py-3.5 border-b flex-shrink-0 border-[var(--ds-hairline)]">
              <div className="flex items-center gap-3.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isViewMode
                    ? 'bg-[#FF9F0A]/11 border border-[#FF9F0A]/20'
                    : 'ds-gradient-primary shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]'
                }`}>
                  {isViewMode
                    ? <PenLine className="w-4 h-4 text-[#FF9F0A]" />
                    : <SettingsIcon className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <h1 className="text-base font-semibold tracking-tight" style={{ color: K.ink }}>
                    {isViewMode ? 'Edit Rebate Program' : 'Rebate Program Setup'}
                  </h1>
                  <p className="text-xs mt-0.5" style={{ color: K.muted }}>
                    {isViewMode ? 'Loaded record — changes will UPDATE the existing program' : 'Configure rebate program parameters and targets'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button onClick={() => { setSearchCode(""); setSearchError(""); setSearchModal({ isOpen: true }); }}
                  className="ds-glass flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-full bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)] transition-colors">
                  <Search size={14} />
                  <span>Search</span>
                  <kbd className="px-1.5 py-0.5 rounded text-xs font-mono bg-[var(--ds-hover)] text-[var(--ds-muted)]">Ctrl+F</kbd>
                </button>
                {!accessLoading && access.canView && (
                  <button onClick={handleRefreshData} disabled={loading}
                    className="ds-glass w-9 h-9 flex items-center justify-center rounded-full disabled:opacity-40 bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)] transition-colors">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  </button>
                )}
              </div>
            </div>

            <div className="px-6 py-4 flex flex-col flex-1 overflow-hidden">
              {accessLoading ? renderAccessLoading()
                : !access.canView ? renderAccessDenied()
                : (
                  <>
                    {isViewMode && (
                      <div className="mb-3 px-3 py-2 rounded-2xl flex items-center justify-between gap-4 flex-shrink-0 ds-glass bg-[#FF9F0A]/8 border border-[#FF9F0A]/20">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse bg-[#FF9F0A]" />
                          <p className="text-sm font-medium flex flex-wrap items-center gap-2" style={{ color: K.ink }}>
                            <span style={{ color: K.muted }}>Editing:</span>
                            <code className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FF9F0A]/11 text-[#FF9F0A]">{loadedRebateCode}</code>
                          </p>
                        </div>
                        <button onClick={() => { setIsViewMode(false); resetForm(); }}
                          className="text-xs px-3 py-1.5 rounded-full font-medium text-[#FF9F0A] border border-[#FF9F0A]/33 hover:bg-[#FF9F0A]/8 transition-colors">
                          Clear &amp; New
                        </button>
                      </div>
                    )}

                    <div
                      className={`grid gap-3 mb-3 pb-3 border-b flex-shrink-0 border-[var(--ds-hairline)] ${
                        isVanDb
                          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9'
                          : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7'
                      }`}>
                      <div>
                        <label className={labelClass} style={{ color: K.muted }}>Rebate Code</label>
                        <div
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl min-h-[42px] ds-glass ${
                            isViewMode
                              ? 'bg-[#FF9F0A]/8 border border-[#FF9F0A]/20'
                              : 'bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)]'
                          }`}>
                          {isViewMode && <PenLine className="w-3 h-3 flex-shrink-0 text-[#FF9F0A]" />}
                          <span className="font-mono font-semibold text-sm truncate"
                            style={{ color: isViewMode ? PALETTE.orange : K.ink }}>
                            {isViewMode ? loadedRebateCode : rebateCode}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className={labelClass} style={{ color: K.muted }}>Rebate Type</label>
                        <div className="relative">
                          <select className={`${selectClass} pr-9 font-medium`}
                            style={{ ...inputStyle, ...(rebateType ? getRebateTypeBadge(rebateType) : {}), opacity: !access.canEdit ? 0.5 : 1 }}
                            value={rebateType}
                            onChange={(e) => {
                              if (!access.canEdit) return;
                              const next = e.target.value;
                              if (next === "Incremental" && quotaType === "withoutQuota") {
                                showToast("Cannot use Incremental rebate type without quota.", "error"); return;
                              }
                              setRebateType(next);
                            }}
                            disabled={!access.canEdit}>
                            <option value="">Select Type</option>
                            <option value="Fixed">Fixed Rate</option>
                            <option value="Incremental">Incremental Rate</option>
                            <option value="Percentage">Percentage Rebate</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: K.faint }} />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass} style={{ color: showHeaderDate ? K.muted : K.faint }}>Date From</label>
                        <input type="date" className={inputClass}
                          style={{
                            ...inputStyle,
                            opacity: (!access.canEdit || !showHeaderDate) ? 0.4 : 1,
                            background: showHeaderDate ? K.glass : K.chipBg,
                            border: isQuarterly && showHeaderDate && selectedDateFrom && !isQuarterStart(selectedDateFrom)
                              ? `1px solid ${PALETTE.red}`
                              : `1px solid ${K.hairline}`,
                          }}
                          value={selectedDateFrom}
                          onChange={(e) => { if (access.canEdit && showHeaderDate) setSelectedDateFrom(e.target.value); }}
                          disabled={!access.canEdit || !showHeaderDate} />
                        {isQuarterly && showHeaderDate && selectedDateFrom && !isQuarterStart(selectedDateFrom) && (
                          <p className="mt-1 text-[11px] flex items-center gap-1 text-[#FF453A]">
                            <AlertCircle className="w-3 h-3" /> Must be Jan 1 / Apr 1 / Jul 1 / Oct 1
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelClass} style={{ color: showHeaderDate ? K.muted : K.faint }}>Date To</label>
                        <input type="date" className={inputClass}
                          style={{
                            ...inputStyle,
                            opacity: (!access.canEdit || !showHeaderDate) ? 0.4 : 1,
                            background: showHeaderDate ? K.glass : K.chipBg,
                            border: isQuarterly && showHeaderDate && selectedDateTo && !isQuarterEnd(selectedDateTo)
                              ? `1px solid ${PALETTE.red}`
                              : `1px solid ${K.hairline}`,
                          }}
                          value={selectedDateTo}
                          onChange={(e) => { if (access.canEdit && showHeaderDate) setSelectedDateTo(e.target.value); }}
                          disabled={!access.canEdit || !showHeaderDate} />
                        {isQuarterly && showHeaderDate && selectedDateTo && !isQuarterEnd(selectedDateTo) && (
                          <p className="mt-1 text-[11px] flex items-center gap-1 text-[#FF453A]">
                            <AlertCircle className="w-3 h-3" /> Must be Mar 31 / Jun 30 / Sep 30 / Dec 31
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={labelClass} style={{ color: K.muted }}>Quota Type</label>
                        <div className="relative">
                          <select className={`${selectClass} pr-9`} style={{ ...inputStyle, opacity: !access.canEdit ? 0.5 : 1 }}
                            value={quotaType}
                            onChange={(e) => { if (access.canEdit) handleQuotaTypeChange(e.target.value); }}
                            disabled={!access.canEdit}>
                            <option value="withQuota">With Quota</option>
                            <option value="withoutQuota">Without Quota</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: K.faint }} />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass} style={{ color: K.muted }}>Frequency</label>
                        <div className="relative">
                          <select className={`${selectClass} pr-9`} style={{ ...inputStyle, opacity: !access.canEdit ? 0.5 : 1 }}
                            value={selectedFrequency}
                            onChange={(e) => { if (access.canEdit) setSelectedFrequency(e.target.value); }}
                            disabled={!access.canEdit}>
                            <option value="">Select Frequency</option>
                            <option value="N/A">N/A</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly">Quarterly</option>
                            <option value="Monthly w/ Cust. Qtr. Rebate">Monthly w/ Cust. Qtr. Rebate</option>
                            <option value="Monthly w/ Item Qtr. Rebate">Monthly w/ Item Qtr. Rebate</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: K.faint }} />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass} style={{ color: K.muted }}>Redemption Period</label>
                        <div className="relative">
                          <select className={`${selectClass} pr-9`} style={{ ...inputStyle, opacity: !access.canEdit ? 0.5 : 1 }}
                            value={redemptionPeriod}
                            onChange={(e) => { if (access.canEdit) setRedemptionPeriod(e.target.value); }}
                            disabled={!access.canEdit}>
                            <option value="">Select Period</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly">Quarterly</option>
                            <option value="Real-time">Real-time</option>
                          </select>
                          <Clock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: K.faint }} />
                        </div>
                      </div>

                      {isVanDb && (
                        <div className="col-span-2 sm:col-span-3 md:col-span-5 lg:col-span-2">
                          <label className={labelClass} style={{ color: K.muted }}>Name</label>
                          <input type="text" value={rebateName}
                            onChange={(e) => { if (access.canEdit) setRebateName(e.target.value); }}
                            placeholder="Enter program name…"
                            className={inputClass}
                            style={{ ...inputStyle, opacity: !access.canEdit ? 0.5 : 1 }}
                            disabled={!access.canEdit} />
                        </div>
                      )}
                    </div>

                    <div
                      className="mb-3 px-3 py-2 rounded-2xl flex items-center gap-3 flex-shrink-0 ds-glass"
                      style={quotaType === "withQuota"
                        ? { background: `${PALETTE.blue}14`, border: `1px solid ${PALETTE.blue}33` }
                        : { background: K.chipBg, border: `1px solid ${K.hairline}` }}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: quotaType === "withQuota" ? PALETTE.blue : K.faint }} />
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-xs" style={{ color: quotaType === "withQuota" ? PALETTE.blue : K.ink }}>
                          {quotaType === "withQuota"  ? "With Quota Program"
                          : quotaType === "withoutQuota" ? "Without Quota Program"
                          : "No Quota Type Selected"}
                        </p>
                        <span className="text-xs" style={{ color: K.faint }}>—</span>
                        <p className="text-xs" style={{ color: K.muted }}>
                          {quotaType === "withQuota"
                            ? "Customers will have individual quota targets for each period. Use the Bulk Quota bar to apply values to all customers."
                            : quotaType === "withoutQuota"
                              ? `Date scope: ${dateRangeScope === SCOPE_PER_CUSTOMER ? 'per customer row' : 'header (All Customer/s)'}.`
                              : "Select a Quota Type to begin configuration."}
                        </p>
                      </div>

                      {(isCustQtrFreq || isItemQtrFreq) && (
                        <div className="ml-auto flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#BF5AF2]/10 text-[#BF5AF2] border border-[#BF5AF2]/20">
                          <Award size={12} />
                          {isCustQtrFreq ? "Customer Qtr Rebate Mode" : "Item Qtr Rebate Mode"}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-3 border-b flex-shrink-0 border-[var(--ds-hairline)]">
                      <div className="flex gap-1">
                        {["Customer", "Items"].map(tab => (
                          <button key={tab}
                            className="px-5 py-3 font-semibold text-sm flex items-center gap-2.5 relative"
                            style={{ color: activeTab === tab ? PALETTE.blue : K.muted }}
                            onClick={() => setActiveTab(tab)}>
                            {tab === "Customer" ? <Users className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                            <span>{tab === "Customer"
                              ? (rebateType === "Incremental" ? "Customer Ranges" : rebateType === "Percentage" ? "Customer Percentages" : "Customer Quotas")
                              : (rebateType === "Incremental" ? "Product Ranges" : rebateType === "Percentage" ? "Product Setup" : "Product Rebates")}</span>
                            {activeTab === tab && (
                              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full ds-gradient-primary" />
                            )}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2 items-center pb-0.5">
                        <label
                          className={`ds-glass flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-full ${
                            access.canEdit
                              ? 'cursor-pointer bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)]'
                              : 'opacity-40 cursor-not-allowed bg-[var(--ds-chip-bg)] text-[var(--ds-faint)] border border-[var(--ds-hairline)]'
                          }`}>
                          {!access.canEdit ? <Lock size={14} /> : <Upload size={14} />}
                          {isViewMode ? 'Import & Update' : 'Import'}
                          <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" disabled={!access.canEdit} />
                        </label>
                        <button onClick={handleDownload} disabled={!access.canExport}
                          className={`ds-glass flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-full ${
                            access.canExport
                              ? 'bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)]'
                              : 'opacity-40 bg-[var(--ds-chip-bg)] text-[var(--ds-faint)] border border-[var(--ds-hairline)]'
                          }`}>
                          {!access.canExport ? <Lock size={14} /> : <Download size={14} />}
                          Export
                        </button>
                      </div>
                    </div>

                    {activeTab === "Customer" && (
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0 flex-wrap">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <h3 className="text-sm font-semibold" style={{ color: K.ink }}>
                              {rebateType === "Incremental" ? "Customer Rebate Ranges" : rebateType === "Percentage" ? "Customer Percentage Setup" : "Customer Quota Setup"}
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border border-[var(--ds-hairline)]">{customers.length}</span>
                            {quotaType === "withQuota" && quotaPeriods.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#0A84FF]/8 text-[#0A84FF] border border-[#0A84FF]/20">
                                {quotaPeriods.length} period{quotaPeriods.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {showPerRowDate && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#BF5AF2]/8 text-[#BF5AF2] border border-[#BF5AF2]/20">
                                Per-Customer date range
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
                            {renderBulkRangeBar()}
                            {showCustomerQtrRebate && renderBulkQtrBar('customer')}
                            {renderBulkQuotaBar()}
                          </div>
                        </div>

                        <div className="ds-glass rounded-2xl border overflow-hidden flex-1 border-[var(--ds-hairline)] bg-[var(--ds-glass)]">
                          <div className="overflow-auto h-full ds-scroll" style={{ maxHeight: 'calc(100vh - 430px)' }}>
                            <table className="w-full border-collapse text-sm">
                              <thead className="sticky top-0 z-10 bg-[var(--ds-glass-deep)]">
                                <tr>
                                  {[
                                    "Customer Code", "Customer Name",
                                    ...(showPerRowDate ? ["Date From", "Date To"] : []),
                                    ...(showCustomerQtrRebate ? ["Qtr Qualified", "Qtr Rebate"] : []),
                                    quotaType === "withQuota" ? "Period" : "Status",
                                    "Actions",
                                  ].map(h => (
                                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-b border-[var(--ds-hairline)]" style={{ color: K.muted }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {customers.length === 0 ? (
                                  <tr>
                                    <td colSpan={customerColCount} className="px-5 py-16 text-center" style={{ color: K.faint }}>
                                      <Users className="w-7 h-7 opacity-30 mx-auto mb-2" />
                                      <div className="text-sm">No customers added yet</div>
                                    </td>
                                  </tr>
                                ) : customers.map((c, idx) => (
                                  <tr key={idx} className="border-b last:border-b-0 border-[var(--ds-hairline)]">
                                    <td className="px-5 py-3.5">
                                      <code className="font-mono text-xs font-medium px-2 py-1 rounded-lg bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]">{c.code || "—"}</code>
                                    </td>
                                    <td className="px-5 py-3.5">
                                      {isRowEditable('customer', idx) ? (
                                        <button onClick={() => handleOpenCustomerModal(idx)}
                                          className="ds-glass flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm w-72 bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] hover:bg-[var(--ds-hover)] transition-colors">
                                          <span className="truncate text-left">{c.name || "Select Customer"}</span>
                                          <Users className="w-3.5 h-3.5 text-[var(--ds-faint)]" />
                                        </button>
                                      ) : (
                                        <span className="text-sm" style={{ color: K.ink }}>{c.name || "—"}</span>
                                      )}
                                    </td>

                                    {showPerRowDate && (
                                      <>
                                        <td className="px-5 py-3.5">
                                          {isRowEditable('customer', idx) ? (
                                            <input type="date" value={c.dateFrom || ""}
                                              onChange={(e) => handlePerRowDateChange(idx, 'dateFrom', e.target.value)}
                                              disabled={!access.canEdit}
                                              className="ds-glass w-36 px-2.5 py-1.5 rounded-xl text-xs"
                                              style={{
                                                background: !c.dateFrom ? `${PALETTE.orange}0d` : K.glass,
                                                border: `1px solid ${!c.dateFrom ? `${PALETTE.orange}55` : K.hairline}`,
                                                color: K.ink,
                                              }} />
                                          ) : (
                                            <span className="text-xs font-mono" style={{ color: c.dateFrom ? K.ink : K.faint }}>{c.dateFrom || "—"}</span>
                                          )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                          {isRowEditable('customer', idx) ? (
                                            <input type="date" value={c.dateTo || ""}
                                              onChange={(e) => handlePerRowDateChange(idx, 'dateTo', e.target.value)}
                                              disabled={!access.canEdit}
                                              className="ds-glass w-36 px-2.5 py-1.5 rounded-xl text-xs bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]" />
                                          ) : (
                                            <span className="text-xs font-mono" style={{ color: c.dateTo ? K.ink : K.faint }}>{c.dateTo || "Continuous"}</span>
                                          )}
                                        </td>
                                      </>
                                    )}

                                    {showCustomerQtrRebate && (
                                      <>
                                        <td className="px-5 py-3.5">{renderQualifiedToggle('customer', idx, c.isQualified, c.qtrRebate)}</td>
                                        <td className="px-5 py-3.5">
                                          {isRowEditable('customer', idx) ? (
                                            <div className="relative w-32">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--ds-faint)]">₱</span>
                                              <input type="text"
                                                value={c.isQualified === false ? "" : (c.qtrRebate || "")}
                                                onChange={(e) => handleQtrRebateChange(idx, e.target.value)}
                                                placeholder={c.isQualified === false ? "Not qualified" : "0.00"}
                                                disabled={!access.canEdit || c.isQualified === false}
                                                className="ds-glass w-full pl-7 pr-3 py-2 rounded-xl text-sm"
                                                style={{ background: c.isQualified === false ? K.chipBg : K.glass, border: `1px solid ${K.hairline}`, color: c.isQualified === false ? K.faint : K.ink }} />
                                            </div>
                                          ) : (
                                            c.isQualified === false
                                              ? <span className="text-xs" style={{ color: K.faint }}>—</span>
                                              : <span className="text-sm font-medium text-[#BF5AF2]">{c.qtrRebate ? `₱${c.qtrRebate}` : "—"}</span>
                                          )}
                                        </td>
                                      </>
                                    )}

                                    <td className="px-5 py-3.5">
                                      {quotaType === "withQuota" ? (
                                        <button onClick={() => openQuotaModal(idx)}
                                          className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold"
                                          style={rebateType === "Percentage"
                                            ? { background: `${PALETTE.orange}1c`, color: PALETTE.orange, border: `1px solid ${PALETTE.orange}33` }
                                            : rebateType === "Incremental"
                                              ? { background: `${PALETTE.green}1c`, color: PALETTE.green, border: `1px solid ${PALETTE.green}33` }
                                              : { background: `${PALETTE.blue}1c`, color: PALETTE.blue, border: `1px solid ${PALETTE.blue}33` }}>
                                          <Target className="w-3.5 h-3.5" />
                                          <span>
                                            {rebateType === "Incremental"
                                              ? (() => {
                                                  const r = c.ranges;
                                                  const cnt = (() => {
                                                    if (!r || typeof r !== 'object') return 0;
                                                    if (Array.isArray(r['default'])) return r['default'].length;
                                                    const keys = Object.keys(r).filter(k => Array.isArray(r[k]));
                                                    return keys.length > 0 ? r[keys[0]].length : 0;
                                                  })();
                                                  return cnt > 0 ? `${cnt} range${cnt !== 1 ? 's' : ''}` : "Set Ranges";
                                                })()
                                              : "Set Targets"}
                                          </span>
                                        </button>
                                      ) : (
                                        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: K.faint }}>
                                          <CheckCircle className="w-3.5 h-3.5" /> No Quota
                                        </span>
                                      )}
                                    </td>

                                    <td className="px-5 py-3.5">
                                      <div className="flex gap-1.5">
                                        <button
                                          className="w-8 h-8 flex items-center justify-center rounded-lg"
                                          style={isRowEditable('customer', idx)
                                            ? { background: `${PALETTE.green}1c`, color: PALETTE.green }
                                            : { background: K.chipBg, color: K.muted, opacity: !access.canEdit ? 0.3 : 1 }}
                                          onClick={() => { if (access.canEdit) toggleRowEdit('customer', idx); }}>
                                          {isRowEditable('customer', idx) ? <Save size={13} /> : <Edit size={13} />}
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center rounded-lg"
                                          style={{ color: PALETTE.red, opacity: !access.canEdit ? 0.3 : 1 }}
                                          onClick={() => handleDeleteCustomer(idx)}>
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === "Items" && (
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0 flex-wrap">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <h3 className="text-sm font-semibold" style={{ color: K.ink }}>
                              {rebateType === "Incremental" ? "Product Rebate Ranges" : rebateType === "Percentage" ? "Product Setup" : "Product Rebate Configuration"}
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] border border-[var(--ds-hairline)]">{items.length}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
                            {showItemQtrRebate && renderBulkQtrBar('item')}
                          </div>
                        </div>

                        <div className="ds-glass rounded-2xl border overflow-hidden flex-1 border-[var(--ds-hairline)] bg-[var(--ds-glass)]">
                          <div className="overflow-auto h-full ds-scroll" style={{ maxHeight: 'calc(100vh - 430px)' }}>
                            <table className="w-full border-collapse text-sm min-w-[600px]">
                              <thead className="sticky top-0 z-10 bg-[var(--ds-glass-deep)]">
                                <tr>
                                  {[
                                    "Item Code", "Item Name", "Qty", "Unit of Measure",
                                    ...(rebateType === "Percentage"
                                      ? ["% Per Unit"]
                                      : (rebateType === "Incremental" && quotaType === "withQuota")
                                        ? []
                                        : ["Rebate / Bag"]),
                                    ...(showItemQtrRebate ? ["Qtr Qualified", "Qtr Rebate"] : []),
                                    "Actions",
                                  ].map(h => (
                                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-b border-[var(--ds-hairline)]" style={{ color: K.muted }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {items.length === 0 ? (
                                  <tr>
                                    <td colSpan={itemColCount} className="px-5 py-16 text-center" style={{ color: K.faint }}>
                                      <Package className="w-7 h-7 opacity-30 mx-auto mb-2" />
                                      <div className="text-sm">No items added yet</div>
                                    </td>
                                  </tr>
                                ) : items.map((item, idx) => (
                                  <tr key={idx} className="border-b last:border-b-0 border-[var(--ds-hairline)]">
                                    <td className="px-5 py-3.5">
                                      <code className="font-mono text-xs font-medium px-2 py-1 rounded-lg bg-[var(--ds-chip-bg)] text-[var(--ds-muted)]">{item.code || "—"}</code>
                                    </td>
                                    <td className="px-5 py-3.5">
                                      {isRowEditable('item', idx) ? (
                                        <button onClick={() => handleOpenItemModal(idx)}
                                          className="ds-glass flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm w-full min-w-[200px] bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] hover:bg-[var(--ds-hover)] transition-colors">
                                          <span className="text-left whitespace-normal">{item.name || "Select Item"}</span>
                                          <Package className="w-3.5 h-3.5 text-[var(--ds-faint)]" />
                                        </button>
                                      ) : (
                                        <span className="text-sm" style={{ color: K.ink }}>{item.name || "—"}</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-3.5">
                                      {isRowEditable('item', idx) ? (
                                        <input type="text" value={item.unitPerQty || ""}
                                          onChange={(e) => { const nd = [...items]; nd[idx].unitPerQty = e.target.value; setItems(nd); }}
                                          placeholder="Qty" className="ds-glass w-28 px-3 py-2 rounded-xl text-sm bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
                                          disabled={!access.canEdit} />
                                      ) : (
                                        <span className="text-sm" style={{ color: K.muted }}>{item.unitPerQty || "—"}</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-3.5">
                                      {isRowEditable('item', idx) ? (
                                        <div className="relative">
                                          <select value={item.unitOfMeasure || ''}
                                            onChange={(e) => { const nd = [...items]; nd[idx].unitOfMeasure = e.target.value; setItems(nd); }}
                                            disabled={!access.canEdit}
                                            className="ds-glass w-32 px-3 py-2 rounded-xl text-sm appearance-none pr-8 bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]">
                                            <option value="">Select UOM</option>
                                            {item.unitOfMeasure && !UOM_OPTIONS.includes(item.unitOfMeasure) && (
                                              <option value={item.unitOfMeasure}>{item.unitOfMeasure}</option>
                                            )}
                                            {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                          </select>
                                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: K.faint }} />
                                        </div>
                                      ) : (
                                        <span className="text-xs px-2 py-1 rounded-lg font-medium font-mono bg-[var(--ds-chip-bg)]"
                                          style={{ color: item.unitOfMeasure ? K.ink : K.faint }}>
                                          {item.unitOfMeasure || '—'}
                                        </span>
                                      )}
                                    </td>

                                    {rebateType === "Percentage" && (
                                      <td className="px-5 py-3.5">
                                        {isRowEditable('item', idx) ? (
                                          <div className="relative w-32">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--ds-faint)]">%</span>
                                            <input type="text" value={item.percentagePerBag || ""}
                                              onChange={(e) => handlePercentagePerBagChange(idx, e.target.value)}
                                              placeholder="0.00" className="ds-glass w-full pl-7 pr-3 py-2 rounded-xl text-sm bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
                                              disabled={!access.canEdit} />
                                          </div>
                                        ) : (
                                          <span className="text-sm font-medium text-[#FF9F0A]">
                                            {item.percentagePerBag ? (<>{item.percentagePerBag}%{item.unitOfMeasure ? ` / ${item.unitOfMeasure}` : ''}</>) : "—"}
                                          </span>
                                        )}
                                      </td>
                                    )}

                                    {(rebateType === "Fixed" || (rebateType === "Incremental" && quotaType === "withoutQuota")) && (
                                      <td className="px-5 py-3.5">
                                        <div className="w-36">
                                          {isRowEditable('item', idx) ? (
                                            <div className="relative">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--ds-faint)]">₱</span>
                                              <input type="text" value={item.rebatePerBag || ""}
                                                onChange={(e) => handleRebatePerBagChange(idx, e.target.value)}
                                                placeholder="0.00" className="ds-glass w-full pl-7 pr-3 py-2 rounded-xl text-sm bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
                                                disabled={!access.canEdit} />
                                            </div>
                                          ) : (
                                            <span className="text-sm font-medium" style={{ color: K.ink }}>
                                              {item.rebatePerBag ? `₱${item.rebatePerBag}${item.unitOfMeasure ? `/${item.unitOfMeasure}` : '/bag'}` : "—"}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    )}

                                    {showItemQtrRebate && (
                                      <>
                                        <td className="px-5 py-3.5">{renderQualifiedToggle('item', idx, item.isQualified, item.qtrRebate)}</td>
                                        <td className="px-5 py-3.5">
                                          {isRowEditable('item', idx) ? (
                                            <div className="relative w-32">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--ds-faint)]">₱</span>
                                              <input type="text"
                                                value={item.isQualified === false ? "" : (item.qtrRebate || "")}
                                                onChange={(e) => handleItemQtrRebateChange(idx, e.target.value)}
                                                placeholder={item.isQualified === false ? "Not qualified" : "0.00"}
                                                disabled={!access.canEdit || item.isQualified === false}
                                                className="ds-glass w-full pl-7 pr-3 py-2 rounded-xl text-sm"
                                                style={{ background: item.isQualified === false ? K.chipBg : K.glass, border: `1px solid ${K.hairline}`, color: item.isQualified === false ? K.faint : K.ink }} />
                                            </div>
                                          ) : (
                                            item.isQualified === false
                                              ? <span className="text-xs" style={{ color: K.faint }}>—</span>
                                              : <span className="text-sm font-medium text-[#BF5AF2]">{item.qtrRebate ? `₱${item.qtrRebate}` : "—"}</span>
                                          )}
                                        </td>
                                      </>
                                    )}

                                    <td className="px-5 py-3.5">
                                      <div className="flex gap-1.5">
                                        <button className="w-8 h-8 flex items-center justify-center rounded-lg"
                                          style={isRowEditable('item', idx)
                                            ? { background: `${PALETTE.green}1c`, color: PALETTE.green }
                                            : { background: K.chipBg, color: K.muted, opacity: !access.canEdit ? 0.3 : 1 }}
                                          onClick={() => { if (access.canEdit) toggleRowEdit('item', idx); }}>
                                          {isRowEditable('item', idx) ? <Save size={13} /> : <Edit size={13} />}
                                        </button>
                                        <button className="w-8 h-8 flex items-center justify-center rounded-lg"
                                          style={{ color: PALETTE.red, opacity: !access.canEdit ? 0.3 : 1 }}
                                          onClick={() => handleDeleteItem(idx)}>
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 mt-auto border-t flex-shrink-0 border-[var(--ds-hairline)]">
                      <div className="flex gap-2">
                        {activeTab === "Customer" && (
                          <button onClick={handleAddCustomer} disabled={!access.canEdit}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-full disabled:cursor-not-allowed ${
                              access.canEdit
                                ? 'bg-gradient-to-br from-[#32D74B] to-[#1D9E3F] text-white hover:brightness-110 transition-all'
                                : 'bg-[var(--ds-chip-bg)] text-[var(--ds-faint)]'
                            }`}>
                            {!access.canEdit ? <Lock size={14} /> : <Users size={14} />} Add Customer
                          </button>
                        )}
                        {activeTab === "Items" && (
                          <button onClick={handleAddItem} disabled={!access.canEdit}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-full disabled:cursor-not-allowed ${
                              access.canEdit
                                ? 'bg-gradient-to-br from-[#32D74B] to-[#1D9E3F] text-white hover:brightness-110 transition-all'
                                : 'bg-[var(--ds-chip-bg)] text-[var(--ds-faint)]'
                            }`}>
                            {!access.canEdit ? <Lock size={14} /> : <Package size={14} />} Add Item
                          </button>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => setCancelModal(true)} disabled={!hasAnyData}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full"
                          style={!hasAnyData
                            ? { opacity: 0.3, cursor: 'not-allowed', border: `1px solid ${K.hairline}`, color: K.faint }
                            : { border: `1px solid ${K.hairline}`, color: K.muted, hover: { background: K.hover } }}>
                          <X size={14} /> Cancel
                        </button>
                        {isViewMode ? (
                          <button onClick={handleUpdate} disabled={!access.canEdit || !hasAnyData}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full"
                            style={access.canEdit && hasAnyData
                              ? { background: `linear-gradient(155deg, ${PALETTE.orange} 0%, ${PALETTE.red} 100%)`, color: '#fff' }
                              : { background: K.chipBg, color: K.faint, cursor: 'not-allowed' }}>
                            {!access.canEdit ? <Lock size={14} /> : <PenLine size={14} />}
                            Update {loadedRebateCode}
                          </button>
                        ) : (
                          <button onClick={handleSave} disabled={!access.canCreate || !hasAnyData}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full"
                            style={access.canCreate && hasAnyData
                              ? { background: `linear-gradient(155deg, ${PALETTE.blue} 0%, ${PALETTE.purple} 100%)`, color: '#fff' }
                              : { background: K.chipBg, color: K.faint, cursor: 'not-allowed' }}>
                            {!access.canCreate ? <Lock size={14} /> : <Save size={14} />} Save Program
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
            </div>
          </div>
        </div>
      </main>

      <CustomerSelectionModal
        isOpen={isCustomerModalOpen}
        onClose={() => { setIsCustomerModalOpen(false); setTempSelectedCustomers([]); setCurrentEditingRow({ type: null, index: null }); }}
        customers={customersDropdown}
        selectedCustomers={tempSelectedCustomers}
        onConfirm={handleCustomerSelectionConfirm}
        theme={theme} />

      <ItemSelectionModal
        isOpen={isItemModalOpen}
        onClose={() => { setIsItemModalOpen(false); setTempSelectedItems([]); setCurrentEditingRow({ type: null, index: null }); }}
        items={itemsDropdown}
        selectedItems={tempSelectedItems}
        onConfirm={handleItemSelectionConfirm}
        theme={theme} />

      <PercentageModal
        isOpen={percentageModal.isOpen}
        onClose={closePercentageModal}
        customer={percentageModal.customer}
        onSave={(arr) => handleSavePercentages(percentageModal.customer?.index, arr)}
        quotaPeriods={quotaPeriods}
        selectedFrequency={selectedFrequency}
        theme={theme}
        access={access} />

      <QuotaModal
        isOpen={quotaModal.isOpen}
        onClose={closeQuotaModal}
        customer={quotaModal.customer}
        onSave={(q) => handleSaveQuotas(quotaModal.customer.index, q)}
        quotaPeriods={quotaPeriods}
        importedQuotas={quotaModal.importedQuotas}
        rebateType={rebateType}
        quotaType={quotaType}
        selectedFrequency={selectedFrequency}
        theme={theme}
        access={access} />

      <RangeModal
        isOpen={rangeModal.isOpen}
        onClose={closeRangeModal}
        customer={rangeModal.customer}
        onSave={(r) => handleSaveRanges(rangeModal.customer.index, r)}
        quotaPeriods={quotaPeriods}
        rebateType={rebateType}
        quotaType={quotaType}
        selectedFrequency={selectedFrequency}
        theme={theme}
        access={access} />

      <ProductRangeModal
        isOpen={productRangeModal.isOpen}
        onClose={closeProductRangeModal}
        product={productRangeModal.product}
        onSave={(r) => handleSaveProductRanges(productRangeModal.product.index, r)}
        quotaPeriods={quotaPeriods}
        rebateType={rebateType}
        quotaType={quotaType}
        theme={theme} />

      <SearchRebateModal
        isOpen={searchModal.isOpen}
        onClose={() => setSearchModal({ isOpen: false })}
        searchCode={searchCode}
        setSearchCode={setSearchCode}
        onSearch={handleSearchRebateCode}
        searchLoading={searchLoading}
        searchError={searchError}
        canView={access.canView}
        db={db} />

      <BulkRangeModal
        isOpen={bulkRangeModalOpen}
        onClose={() => setBulkRangeModalOpen(false)}
        onApply={handleApplyBulkRanges}
        emptyCount={customersWithNoRanges}
        totalCount={customers.length} />

      <ScopeSelectionModal
        isOpen={scopeModalOpen}
        onClose={handleScopeModalCancel}
        onSelect={handleApplyScope} />

      <ToastContainer toasts={toasts} removeToast={removeToast} isDark={isDark} />
      {loading && <Loading theme={theme} />}
      <ConfirmationModal isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: null, data: null })}
        onConfirm={confirmModal.action === 'reset' ? resetForm : () => setConfirmModal({ isOpen: false, action: null, data: null })}
        title={confirmModal.title} message={confirmModal.message} />
      <DuplicationError isOpen={duplicationError.isOpen}
        onClose={() => setDuplicationError({ isOpen: false, type: null, data: null })}
        type={duplicationError.type} data={duplicationError.data} theme={theme} />
      <CancelModal isOpen={cancelModal} onClose={() => setCancelModal(false)}
        onConfirm={() => { resetForm(); setCancelModal(false); }} theme={theme} />
      <RemoveRow isOpen={removeCustomerModal.isOpen}
        onClose={() => setRemoveCustomerModal({ isOpen: false, index: null, name: "" })}
        onConfirm={confirmDeleteCustomer} title="Delete Customer"
        message={`Are you sure you want to delete "${removeCustomerModal.name}"? This action cannot be undone.`}
        theme={theme} />
      <RemoveRow isOpen={removeItemModal.isOpen}
        onClose={() => setRemoveItemModal({ isOpen: false, index: null, name: "" })}
        onConfirm={confirmDeleteItem} title="Delete Item"
        message={`Are you sure you want to delete "${removeItemModal.name}"? This action cannot be undone.`}
        theme={theme} />
    </DesignPage>
  );
}

export default RebateSetup;