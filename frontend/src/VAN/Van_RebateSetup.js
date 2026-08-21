import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from 'axios';
import {
  FileText,
  Users,
  Package,
  User,
  Edit,
  Trash2,
  Upload,
  Download,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  Save,
  Calendar,
  Calculator,
  Target,
  Settings as SettingsIcon,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Percent,
  LocateFixed,
  Lock,
  Search,
  PenLine,
  ChevronDown,
} from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import vanLogo from "../assets/van.png";
import * as XLSX from "xlsx";
import { List } from 'react-window';
import Select, { components } from 'react-select';
import Sidebar from "../components/Sidebar";
import Header from '../components/Header';
import { useTheme } from '../context/ThemeContext';
import PercentageModal from "../components/rebate/PercentageModal";
import QuotaModal from "../components/rebate/QuotaModal";
import RangeModal from "../components/rebate/RangeModal";
import ProductRangeModal from "../components/rebate/ProductRangeModal";
import Loading from "../components/common/Loading";
import CustomerSelectionModal from "../components/rebate/CustomerSelectionModal";
import ItemSelectionModal from "../components/rebate/ItemSelectionModal";
import DuplicationError from "../components/duplicationerror";
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';
import CancelModal from "../components/common/CancelModal";
import RemoveRow from "../components/common/RemoveRow";

// ─── Utilities ────────────────────────────────────────────────────────────────
const safeObjectValues = (obj) => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.values(obj);
};

const detectUnitOfMeasure = (itemName) => {
  if (!itemName) return '';

  // List of patterns ordered by priority (longer/leftmost first)
  // Each pattern includes a regex and the unit abbreviation.
  // We'll search the whole string for the earliest match.
  const patterns = [
    // Explicit words (no number required)
    { regex: /\bgallon\b/i,           unit: 'Gal' },
    { regex: /\bliter\b/i,            unit: 'Liter/s' },
    { regex: /\bkilogram\b/i,         unit: 'Kg' },
    { regex: /\bgram\b/i,             unit: 'Gram/s' },
    { regex: /\bcarton\b/i,           unit: 'Ctn' },
    { regex: /\bbottle\b/i,           unit: 'Btl/s' },
    { regex: /\bbundle\b/i,           unit: 'Bundle' },
    { regex: /\bbox\b/i,              unit: 'Bx/s' },
    { regex: /\bbag\b/i,              unit: 'Bag/s' }, // singular "bag"
    { regex: /\bbags\b/i,             unit: 'Bag/s' },
    { regex: /\b\d+\s*lbs?\b/i,       unit: 'Lbs' },   // matches 3lbs, 3 lb, 3lbs
    { regex: /\bpound\b/i,            unit: 'Lbs' },   // explicit "pound"
    { regex: /\bpounds\b/i,           unit: 'Lbs' },   // explicit "pounds"

    // Number‑prefixed units (most specific first)
    { regex: /\b\d+\s*kl\b/i,         unit: 'KL' },     // e.g., 1KL, 2 KL
    { regex: /\b\d+\s*ml\b/i,         unit: 'ML' },
    { regex: /\b\d+\s*kg\b/i,         unit: 'Kg' },
    { regex: /\b\d+\s*l\b/i,          unit: 'Liter/s' }, // single L
    { regex: /\b\d+\s*lt\b/i,         unit: 'Liter/s' },
    { regex: /\b\d+\s*gram\b/i,       unit: 'Gram/s' },
    { regex: /\b\d+\s*ctn\b/i,        unit: 'Ctn' },
    { regex: /\b\d+\s*carton\b/i,     unit: 'Ctn' },
    { regex: /\b\d+\s*btl\b/i,        unit: 'Btl/s' },
    { regex: /\b\d+\s*bottle\b/i,     unit: 'Btl/s' },
    { regex: /\b\d+\s*bundle\b/i,     unit: 'Bundle' },
    { regex: /\b\d+\s*bx\b/i,         unit: 'Bx/s' },
    { regex: /\b\d+\s*box\b/i,        unit: 'Bx/s' },
    { regex: /\b\d+\s*bags?\b/i,      unit: 'Bag/s' },   // bags or bag
    { regex: /\b\d+\s*gal\b/i,        unit: 'Gal' },
    { regex: /\b\d+\s*gallon\b/i,     unit: 'Gal' },
    { regex: /\b\d+\s*oz\b/i,         unit: 'Oz' },
    { regex: /\b\d+\s*ounce\b/i,      unit: 'Oz' },
    { regex: /\b\d+\s*pc\b/i,         unit: 'Pc/s' },
    { regex: /\b\d+\s*pcs\b/i,        unit: 'Pc/s' },
    { regex: /\b\d+\s*piece\b/i,      unit: 'Pc/s' },

    // Special: grams after 'x' (e.g., 10x35g)
    // This must come after the standard \d+\s*g\b pattern to capture without spaces.
    { regex: /\d+x\d+\s*g\b/i,        unit: 'Gram/s' },
    // Also standalone 'g' after a number, not preceded by 'x' (already covered above)
    // but we keep for clarity:
    { regex: /\b\d+\s*g\b/i,          unit: 'Gram/s' },
  ];

  // Find earliest match index across all patterns
  let earliestIndex = Infinity;
  let matchedUnit = '';

  for (const p of patterns) {
    const match = p.regex.exec(itemName);
    if (match && match.index < earliestIndex) {
      earliestIndex = match.index;
      matchedUnit = p.unit;
    }
  }

  return matchedUnit;
};

/** Safely add N months without day-overflow (Jan 31 + 1 month → Feb 28, not Mar 3) */
const addMonths = (date, n) => {
  const d   = new Date(date);
  const day = d.getDate();
  d.setDate(1);                                                    // anchor to 1st first
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
};

const UOM_OPTIONS = [
  'Bag/s','Btl/s','Ctn','Pc/s','Bx/s','Gal','Kg','Oz','Bundle','ML','Gram/s','Liter/s'
];

const MenuList = (props) => (
  <components.MenuList {...props}>{props.children}</components.MenuList>
);
const CustomOption = ({ innerRef, innerProps, isFocused, isSelected, children }) => (
  <div
    ref={innerRef}
    {...innerProps}
    className={`px-3 py-2 cursor-pointer text-sm ${isFocused ? 'bg-blue-50' : ''} ${isSelected ? 'bg-blue-100' : ''}`}
  >
    {children}
  </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose, isDark }) => {
  const styles = {
    success: {
      bg:     isDark ? "bg-slate-900" : "bg-white",
      border: isDark ? "border-emerald-700/50" : "border-emerald-200",
      text:   isDark ? "text-emerald-400" : "text-emerald-600",
      icon:   isDark ? "text-emerald-400" : "text-emerald-500",
    },
    error: {
      bg:     isDark ? "bg-slate-900" : "bg-white",
      border: isDark ? "border-red-700/50" : "border-red-200",
      text:   isDark ? "text-red-400" : "text-red-600",
      icon:   isDark ? "text-red-400" : "text-red-500",
    },
    warning: {
      bg:     isDark ? "bg-slate-900" : "bg-white",
      border: isDark ? "border-amber-700/50" : "border-amber-200",
      text:   isDark ? "text-amber-400" : "text-amber-600",
      icon:   isDark ? "text-amber-400" : "text-amber-500",
    },
    info: {
      bg:     isDark ? "bg-slate-900" : "bg-white",
      border: isDark ? "border-blue-700/50" : "border-blue-200",
      text:   isDark ? "text-blue-400" : "text-blue-600",
      icon:   isDark ? "text-blue-400" : "text-blue-500",
    },
  };
  const s = styles[type] || styles.info;
  const icons = {
    success: <CheckCircle className="w-4 h-4" />,
    error:   <X className="w-4 h-4" />,
    warning: <AlertCircle className="w-4 h-4" />,
    info:    <Info className="w-4 h-4" />,
  };
  return (
    <div
      className={`flex items-center gap-2.5 pl-3.5 pr-3 py-2.5 rounded-2xl border shadow-lg ${s.bg} ${s.border} animate-slide-in-right`}
      style={{ minWidth: '300px', maxWidth: '380px' }}
    >
      <span className={`flex-shrink-0 ${s.icon}`}>{icons[type]}</span>
      <span className={`text-sm font-medium flex-1 leading-snug ${s.text}`}>{message}</span>
      <button
        onClick={onClose}
        className={`flex-shrink-0 ${s.icon} hover:opacity-60 transition-opacity`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast, isDark }) => (
  <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm">
    {toasts.map((toast) => (
      <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} isDark={isDark} />
    ))}
  </div>
);

// ─── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full mx-auto shadow-2xl border border-slate-700/60"
           style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 24px 48px rgba(0,0,0,0.6)' }}>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 pt-0.5">
            <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
            <p className="text-slate-400 text-sm mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all font-medium border border-slate-700/60 text-sm">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all font-medium text-sm flex items-center gap-2 shadow-lg shadow-red-900/30">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Search Rebate Modal ──────────────────────────────────────────────────────
const SearchRebateModal = ({ isOpen, onClose, searchCode, setSearchCode, onSearch, searchLoading, searchError, theme, canView }) => {
  const [allCodes, setAllCodes]         = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const dropRef  = useRef(null);

  useEffect(() => {
    if (!isOpen || !canView) return;
    setCodesLoading(true);
    fetch('http://192.168.100.193:3009/api/rebate-program/all-codes?db=VAN')
      .then(r => r.json())
      .then(d => { if (d.success) setAllCodes(d.codes || []); })
      .catch(() => {})
      .finally(() => setCodesLoading(false));
  }, [isOpen, canView]);

  useEffect(() => {
    const handle = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = useMemo(() => {
    const q = searchCode.trim().toUpperCase();
    if (!q) return allCodes.slice(0, 50);
    return allCodes.filter(c =>
      c.RebateCode.toUpperCase().includes(q) ||
      (c.SlpName    && c.SlpName.toUpperCase().includes(q)) ||
      (c.RebateType && c.RebateType.toUpperCase().includes(q))
    ).slice(0, 50);
  }, [searchCode, allCodes]);

  const handleSelect = (code) => {
    setSearchCode(code.RebateCode);
    setShowDropdown(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const typeColor = (type) => {
    if (type === 'Fixed')       return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    if (type === 'Incremental') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (type === 'Percentage')  return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    return 'bg-slate-700 text-slate-400';
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  // If user doesn't have view access, show access denied message
  if (!canView) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="rounded-2xl p-6 w-full max-w-md mx-auto border"
          style={{
            background: isDark ? 'rgba(15,20,30,0.97)' : 'rgba(255,255,255,0.98)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.5)',
          }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Lock className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h3 className={`text-base font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Access Restricted
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  You don't have permission to search rebate programs
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className={`mb-5 p-4 rounded-xl text-center ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
            <Lock className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              You need read access to search and view rebate programs.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose}
              className={`px-4 py-2.5 rounded-xl transition-all font-medium border text-sm ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800 border-slate-700' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl p-6 w-full max-w-md mx-auto border"
        style={{
          background: isDark ? 'rgba(15,20,30,0.97)' : 'rgba(255,255,255,0.98)',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.5)',
        }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Search className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className={`text-base font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Search Rebate Code
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                Load an existing program to edit
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input */}
        <div className="mb-5 relative">
          <label className={`block text-xs font-semibold mb-2 uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Rebate Code
          </label>
          <div className="relative flex items-center">
            <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <Search className="w-4 h-4" />
            </div>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={searchCode}
              onChange={e => { setSearchCode(e.target.value.toUpperCase()); setShowDropdown(true); }}
              onKeyDown={e => {
                if (e.key === 'Enter')     { setShowDropdown(false); onSearch(); }
                if (e.key === 'Escape')    { if (showDropdown) setShowDropdown(false); else onClose(); }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const first = dropRef.current?.querySelector('[data-suggestion]');
                  first?.focus();
                }
              }}
              placeholder="e.g. REB-00001"
              className={`w-full pl-10 pr-10 py-3 border rounded-xl text-sm focus:outline-none transition-all font-mono tracking-wider ${
                isDark
                  ? 'bg-slate-800/60 border-slate-700 text-white placeholder-slate-600 focus:border-blue-500/60 focus:bg-slate-800'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowDropdown(v => !v)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
              {codesLoading
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              }
            </button>
          </div>

          {/* Dropdown */}
          {showDropdown && !codesLoading && (
            <div
              ref={dropRef}
              className={`absolute z-50 left-0 right-0 mt-1.5 rounded-xl border shadow-2xl overflow-hidden`}
              style={{
                maxHeight: '240px', overflowY: 'auto',
                background: isDark ? 'rgba(15,20,30,0.98)' : 'white',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)',
              }}>
              {filtered.length === 0 ? (
                <div className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  No matching codes found
                </div>
              ) : (
                <>
                  <div className={`px-3 py-2 text-xs font-semibold border-b sticky top-0 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                    {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                  </div>
                  {filtered.map((item, i) => (
                    <button
                      key={item.RebateCode}
                      data-suggestion
                      type="button"
                      onClick={() => handleSelect(item)}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); (e.currentTarget.nextSibling)?.focus(); }
                        if (e.key === 'ArrowUp')   { e.preventDefault(); i === 0 ? inputRef.current?.focus() : (e.currentTarget.previousSibling)?.focus(); }
                        if (e.key === 'Enter')      { handleSelect(item); }
                        if (e.key === 'Escape')     { setShowDropdown(false); inputRef.current?.focus(); }
                      }}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors border-b last:border-b-0 focus:outline-none ${
                        isDark
                          ? 'border-slate-800/60 hover:bg-slate-800/80 focus:bg-slate-800/80'
                          : 'border-slate-50 hover:bg-blue-50/60 focus:bg-blue-50/60'
                      } ${searchCode.trim().toUpperCase() === item.RebateCode ? (isDark ? 'bg-blue-500/10' : 'bg-blue-50') : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`font-mono font-semibold text-sm flex-shrink-0 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {searchCode.trim()
                            ? (() => {
                                const q   = searchCode.trim().toUpperCase();
                                const str = item.RebateCode;
                                const idx = str.toUpperCase().indexOf(q);
                                if (idx === -1) return str;
                                return (
                                  <>
                                    {str.slice(0, idx)}
                                    <span className="text-blue-400">{str.slice(idx, idx + q.length)}</span>
                                    {str.slice(idx + q.length)}
                                  </>
                                );
                              })()
                            : item.RebateCode
                          }
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{item.SlpName || '—'}</span>
                          {(item.DateFrom || item.DateTo) && (
                            <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                              {formatDate(item.DateFrom)} – {formatDate(item.DateTo)}
                            </span>
                          )}
                        </div>
                      </div>
                      {item.RebateType && (
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0 ${typeColor(item.RebateType)}`}>
                          {item.RebateType}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {searchError && (
            <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{searchError}
            </p>
          )}
        </div>

        {/* Shortcut hint */}
        <div className={`mb-5 p-3 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700/40' : 'bg-slate-50 border border-slate-200'}`}>
          <p className={`text-xs flex items-center gap-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-white border border-slate-200 text-slate-600 shadow-sm'}`}>Ctrl+F</kbd>
            <span>Open anytime · ↑↓ navigate · Enter select</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className={`px-4 py-2.5 rounded-xl transition-all font-medium border text-sm ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800 border-slate-700' : 'text-slate-600 hover:bg-slate-100 border-slate-200'}`}>
            Cancel
          </button>
          <button
            onClick={() => { setShowDropdown(false); onSearch(); }}
            disabled={searchLoading || !searchCode.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-medium text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-900/30">
            {searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searchLoading ? "Loading…" : "Load & Edit"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
function Van_RebateSetup() {
  const location = useLocation();
  const { theme, updateTheme } = useTheme();
  const routePath = '/Van_RebateSetup';
  const { access, accessLoading, accessError } = useAccessControl(routePath);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [collapsed, setCollapsed]                     = useState(false);
  const [activeNav, setActiveNav]                     = useState("/rebatesetup");
  const [activeTab, setActiveTab]                     = useState("Customer");
  const [rebateType, setRebateType]                   = useState("Fixed");
  const [quotaType, setQuotaType]                     = useState("withQuota");
  const [showVanDropdown, setShowVanDropdown]         = useState(true);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown, setShowVcpDropdown]         = useState(false);
  const [toasts, setToasts]                           = useState([]);
  const [loading, setLoading]                         = useState(false);
  const [removeCustomerModal, setRemoveCustomerModal] = useState({ isOpen: false, index: null, name: "" });
  const [removeItemModal, setRemoveItemModal] = useState({ isOpen: false, index: null, name: "" });
  const [confirmModal, setConfirmModal]               = useState({ isOpen: false, action: null, data: null });
  const [quotaModal, setQuotaModal]                   = useState({ isOpen: false, customer: null, importedQuotas: [] });
  const [rangeModal, setRangeModal]                   = useState({ isOpen: false, customer: null });
  const [productRangeModal, setProductRangeModal]     = useState({ isOpen: false, product: null });
  const [percentageModal, setPercentageModal]         = useState({ isOpen: false, customer: null });
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen]         = useState(false);
  const [tempSelectedCustomers, setTempSelectedCustomers] = useState([]);
  const [tempSelectedItems, setTempSelectedItems]         = useState([]);
  const [currentEditingRow, setCurrentEditingRow]         = useState({ type: null, index: null });
  const [editingRows, setEditingRows] = useState({ customer: { 0: true }, item: { 0: true } });
  const [userName, setUserName]       = useState("");
  const [userCode, setUserCode]       = useState("");
  const [initials, setInitials]       = useState("");
  const [salesEmployees, setSalesEmployees]       = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [customersDropdown, setCustomersDropdown] = useState([]);
  const [itemsDropdown, setItemsDropdown]         = useState([]);
  const [rebateCode, setRebateCode]                       = useState("REB-");
  const [selectedSalesEmployee, setSelectedSalesEmployee] = useState("");
  const [selectedDateFrom, setSelectedDateFrom]           = useState("");
  const [selectedDateTo, setSelectedDateTo]               = useState("");
  const [selectedFrequency, setSelectedFrequency]         = useState("");
  const [customers, setCustomers] = useState([]);
  const [items, setItems]         = useState([]);
  const [quotaPeriods, setQuotaPeriods]             = useState([]);
  const [quotaCount, setQuotaCount]                 = useState(0);
  const [importedCustomerQuotas, setImportedCustomerQuotas] = useState({});
  const [duplicationError, setDuplicationError]     = useState({ isOpen: false, type: null, data: null });
  const [searchModal, setSearchModal]     = useState({ isOpen: false });
  const [searchCode, setSearchCode]       = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError]     = useState("");
  const [isViewMode, setIsViewMode]       = useState(false);
  const [loadedRebateCode, setLoadedRebateCode] = useState("");
  const [cancelModal, setCancelModal] = useState(false);
  const API_BASE = 'http://192.168.100.193:3009/api';
  const DB_NAME  = 'USER';

  // ─── Drag‑and‑drop state ──────────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);

  const REBATE_NAME_OPTIONS = [
  "TARGET PREMIUM, GRANDE HOG & FIREBLAZE in 50kls. @P50/bag",
  "VALUEMAXX HOG MASH & PELLET in 50kls @P30/bag",
  "TARGET COMPLETE HOG",
  ];

  const isDark = theme === 'dark';

  const customerOptions = useMemo(() =>
    customersDropdown.map(cust => ({ value: cust.CardName, label: cust.CardName })),
    [customersDropdown]
  );
  const itemOptions = useMemo(() =>
    itemsDropdown.map(item => ({ value: item.ItemName, label: item.ItemName })),
    [itemsDropdown]
  );
  const salesEmployeeOptions = useMemo(() =>
    salesEmployees.map(emp => ({ value: emp.SlpName, label: emp.SlpName })),
    [salesEmployees]
  );

  const showToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const componentMetadata = {
    name: 'Van_RebateSetup',
    version: '2.0.0',
    description: 'Rebate configuration module for creating rebate programs, linking customers and items, and defining computation rules and validity periods.',
    routePath: '/Van_RebateSetup',
  };
  useComponentRegistration(componentMetadata);

  useEffect(() => {
    const initializeData = async () => {
      const storedUser = JSON.parse(localStorage.getItem("currentUser")) || {};
      const username   = storedUser.DisplayName || storedUser.Username || "Unknown User";
      const uCode      = storedUser.User_ID || "Unknown ID";
      setUserName(username);
      setUserCode(uCode);
      const parts = username.trim().split(" ");
      setInitials(parts.length === 1 ? parts[0][0].toUpperCase() : parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase());
      setRebateCode("REB-");
      fetchSalesEmployees();
      fetchCustomers();
      fetchItems();
    };
    initializeData();
  }, []);

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
  }, []); // eslint-disable-line

  useEffect(() => {
    if (quotaType === "withQuota" && selectedDateFrom && selectedDateTo && selectedFrequency) {
      calculateQuotaPeriods();
    } else {
      setQuotaPeriods([]);
      setQuotaCount(0);
      setCustomers(prev => prev.map(c => ({ ...c, quotas: [], percentages: [] })));
      setItems(prev => prev.map(i => ({ ...i, ranges: {} })));
    }
  }, [selectedDateFrom, selectedDateTo, selectedFrequency, quotaType]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchCode("");
        setSearchError("");
        setSearchModal({ isOpen: true });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const generateNextRebateCode = async () => {
    try {
      const response = await fetch(`${API_BASE}/rebate-program/highest-code?db=VAN`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.nextCode) return data.nextCode;
      }
      return getFallbackRebateCode();
    } catch { return getFallbackRebateCode(); }
  };

  const getFallbackRebateCode = () => {
    const storageKey = `lastRebateCode_VAN`;
    const lastCode = localStorage.getItem(storageKey);
    let nextNumber = 1;
    if (lastCode && lastCode.startsWith('REB-')) {
      const parts = lastCode.split('-');
      if (parts.length === 2) {
        const last = parseInt(parts[1]);
        if (!isNaN(last)) nextNumber = last + 1;
      }
    }
    const nextCode = `REB-${nextNumber.toString().padStart(5, '0')}`;
    localStorage.setItem(storageKey, nextCode);
    return nextCode;
  };

  const calculateQuotaPeriods = () => {
    const startDate = new Date(selectedDateFrom);
    const endDate   = new Date(selectedDateTo);
    const periods   = [];

    const fmt  = (d, opts) => d.toLocaleDateString('en-US', opts);
    const sOpt = { month: 'short', day: 'numeric' };
    const lOpt = { month: 'short', day: 'numeric', year: 'numeric' };

  if (selectedFrequency === "Monthly") {
    let periodStart = new Date(startDate);
    while (periodStart <= endDate) {
      const nextStart = addMonths(periodStart, 1);
      const isLast    = nextStart >= endDate;
      const actualEnd = isLast
        ? new Date(endDate)
        : (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();

      const monthName = periodStart.toLocaleDateString('en-US', { month: 'long' });
      const year      = periodStart.getFullYear();

      periods.push({
        period:    `${monthName} ${year}`,
        label:     monthName,
        startDate: new Date(periodStart),
        endDate:   new Date(actualEnd),
        dates:     `${fmt(periodStart, sOpt)} - ${fmt(actualEnd, lOpt)}`,
      });

      if (isLast) break;
      periodStart = nextStart;
    }
  } else if (selectedFrequency === "Quarterly") {
    // ← Start from the exact DateFrom, NOT the calendar-quarter boundary
    let periodStart = new Date(startDate);

    while (periodStart <= endDate) {
      const nextStart = addMonths(periodStart, 3);
      const isLast    = nextStart >= endDate;
      const actualEnd = isLast
        ? new Date(endDate)
        : (() => { const d = new Date(nextStart); d.setDate(d.getDate() - 1); return d; })();

      const qIdx  = Math.floor(periodStart.getMonth() / 3);
      const qName = ["Q1", "Q2", "Q3", "Q4"][qIdx];
      const year  = periodStart.getFullYear();

      periods.push({
        period:    `${qName} ${year}`,
        label:     `${qName} ${year}`,
        startDate: new Date(periodStart),
        endDate:   new Date(actualEnd),
        dates:     `${fmt(periodStart, sOpt)} - ${fmt(actualEnd, lOpt)}`,
        quarter:   qName,
        year,
      });

      if (isLast) break;
      periodStart = nextStart;
    }
  }

  setQuotaPeriods(periods);
  setQuotaCount(periods.length);
  setCustomers(prev => prev.map(c => ({
    ...c,
    quotas:      quotaType === "withQuota" ? Array(periods.length).fill("") : [],
    percentages: quotaType === "withQuota" ? Array(periods.length).fill("") : [],
    ranges:      c.ranges || {},
  })));
  setItems(prev => prev.map(i => ({ ...i, ranges: i.ranges || {} })));
};

  const fetchSalesEmployees = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/van/sales-employees?db=VAN`);
      if (!res.ok) throw new Error("Failed to fetch sales employees");
      const data = await res.json();
      if (Array.isArray(data)) setSalesEmployees(data);
      else if (data?.data && Array.isArray(data.data)) setSalesEmployees(data.data);
      else { setSalesEmployees([]); showToast("Invalid sales employees data format", "error"); }
    } catch {
      showToast("Failed to load sales employees", "error");
      setSalesEmployees([]);
    } finally { setLoading(false); }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/van/customer?db=VAN`);
      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();
      if (Array.isArray(data)) setCustomersDropdown(data);
      else if (data?.data && Array.isArray(data.data)) setCustomersDropdown(data.data);
      else { setCustomersDropdown([]); showToast("Invalid customers data format", "error"); }
    } catch {
      showToast("Failed to load customers", "error");
      setCustomersDropdown([]);
    } finally { setLoading(false); }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/van/items?db=VAN`);
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      if (Array.isArray(data)) setItemsDropdown(data);
      else if (data?.data && Array.isArray(data.data)) setItemsDropdown(data.data);
      else { setItemsDropdown([]); showToast("Invalid items data format", "error"); }
    } catch {
      showToast("Failed to load items", "error");
      setItemsDropdown([]);
    } finally { setLoading(false); }
  };

  const handleRefreshData = async () => {
    try {
      setLoading(true);
      showToast("Starting data refresh in background...", "info");
      const response = await fetch(`${API_BASE}/sync/refresh-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDatabase: 'VAN', targetDatabase: 'VAN', tables: ['salesEmployees', 'customers', 'items'] }),
      });
      if (!response.ok) throw new Error('Failed to start refresh');
      setTimeout(async () => {
        try {
          await fetchSalesEmployees();
          await fetchCustomers();
          await fetchItems();
          showToast("Data refresh completed!", "success");
        } catch { showToast("Refresh may still be processing in background", "warning"); }
        finally { setLoading(false); }
      }, 1500);
    } catch (error) {
      showToast(`Refresh failed: ${error.message}`, "error");
      setLoading(false);
    }
  };

  const handleSearchRebateCode = async () => {
    const code = searchCode.trim().toUpperCase();
    if (!code) { setSearchError("Please enter a rebate code."); return; }
    setSearchLoading(true);
    setSearchError("");
    try {
      const res = await fetch(`${API_BASE}/rebate-program/by-code/${encodeURIComponent(code)}?db=VAN`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.program) {
        setSearchError(`Rebate code "${code}" not found.`);
        setSearchLoading(false);
        return;
      }
      const prog = data.program;
      setRebateCode(prog.RebateCode);
      setLoadedRebateCode(prog.RebateCode);
      setRebateType(prog.RebateType);
      setSelectedSalesEmployee(prog.SlpName);
      setSelectedDateFrom(prog.DateFrom ? prog.DateFrom.slice(0, 10) : "");
      setSelectedDateTo(prog.DateTo     ? prog.DateTo.slice(0, 10)   : "");
      setSelectedFrequency(prog.Frequency || "");
      setQuotaType(prog.QuotaType === "With Quota" ? "withQuota" : "withoutQuota");
      setSelectedName(prog.Name || "");
      const custRes = await fetch(
        `${API_BASE}/rebate-program/customers/${encodeURIComponent(code)}?db=VAN&type=${encodeURIComponent(prog.RebateType)}`
      );
      if (custRes.ok) {
        const custData = await custRes.json();
        if (custData.success && Array.isArray(custData.customers)) {
          const mapped = custData.customers.map(c => {
            const quotaArr = Array.isArray(c.quotas)
              ? c.quotas.map(q => String(q.TargetQty ?? ""))
              : [];
            let rangesObj = {};
            if (Array.isArray(c.ranges) && c.ranges.length > 0) {
              rangesObj = {
                0: c.ranges.map(r => ({
                  min:    String(r.MinQty    ?? "0"),
                  max:    String(r.MaxQty    ?? "0"),
                  rebate: String(r.RebatePerBag ?? ""),
                }))
              };
            }
            return {
              code:        c.CardCode  || "",
              name:        c.CardName  || "",
              qtrRebate:   c.QtrRebate != null ? String(c.QtrRebate) : "",
              quotas:      quotaArr,
              percentages: prog.RebateType === "Percentage" ? quotaArr : [],
              ranges:      rangesObj,
            };
          });
          setCustomers(mapped);
          const state = {};
          mapped.forEach((_, i) => { state[i] = false; });
          setEditingRows(prev => ({ ...prev, customer: state }));
        }
      }
      const itemRes = await fetch(
        `${API_BASE}/rebate-program/items/${encodeURIComponent(code)}?db=VAN&type=${encodeURIComponent(prog.RebateType)}`
      );
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        if (itemData.success && Array.isArray(itemData.items)) {
          const mapped = itemData.items.map(i => {
            let rangesObj = {};
            if (Array.isArray(i.ranges) && i.ranges.length > 0) {
              rangesObj = {
                0: i.ranges.map(r => ({
                  min:    String(r.MinQty       ?? "0"),
                  max:    String(r.MaxQty       ?? "0"),
                  rebate: String(r.RebatePerBag ?? ""),
                }))
              };
            }
            return {
              code:             i.ItemCode           || "",
              name:             i.ItemName           || "",
              unitPerQty:       i.UnitPerQty      != null ? String(i.UnitPerQty)         : "",
              rebatePerBag:     i.RebatePerBag    != null ? String(i.RebatePerBag)       : "",
              percentagePerBag: i.PercentagePerBag != null ? String(i.PercentagePerBag)  : "",
              unitOfMeasure:    i.UnitOfMeasure || detectUnitOfMeasure(i.ItemName || ""),
              ranges:           rangesObj,
            };
          });
          setItems(mapped);
          const state = {};
          mapped.forEach((_, i) => { state[i] = false; });
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

  // ─── Core import logic (used by both file input and drag‑and‑drop) ──────
  const handleImportFile = (file) => {
    if (!access.canEdit) {
      showToast("You do not have permission to import data", "error");
      return;
    }
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      showToast("Please select a valid Excel file (.xlsx or .xls)", "error");
      return;
    }
    setLoading(true);
    const preservedCode       = isViewMode ? loadedRebateCode : null;
    const preservedIsViewMode = isViewMode;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data     = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        if (workbook.SheetNames.length === 0) throw new Error("No sheets found in Excel file");
        let headerInfo = {};
        const firstSheet     = workbook.Sheets[workbook.SheetNames[0]];
        const firstSheetData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        if (firstSheetData.length >= 2) {
          const headerRow = firstSheetData[0];
          const valueRow  = firstSheetData[1];
          if (Array.isArray(headerRow) && Array.isArray(valueRow)) {
            headerRow.forEach((header, index) => {
              if (!header) return;
              const headerLower = String(header).toLowerCase().trim();
              const value = valueRow[index] ? String(valueRow[index]).trim() : "";
              if      (headerLower.includes('rebate code'))    headerInfo.rebateCode    = value;
              else if (headerLower.includes('sales employee')) headerInfo.salesEmployee = value;
              else if (headerLower.includes('date from'))      headerInfo.dateFrom      = value;
              else if (headerLower.includes('date to'))        headerInfo.dateTo        = value;
              else if (headerLower.includes('frequency'))      headerInfo.frequency     = value;
              else if (headerLower.includes('quota type'))     headerInfo.quotaType     = value;
              else if (headerLower.includes('rebate type'))    headerInfo.rebateType    = value;
            });
          }
        }
        if (!preservedIsViewMode) {
          if (headerInfo.rebateCode)    setRebateCode(headerInfo.rebateCode);
          if (headerInfo.salesEmployee) setSelectedSalesEmployee(headerInfo.salesEmployee);
          if (headerInfo.dateFrom)      setSelectedDateFrom(headerInfo.dateFrom);
          if (headerInfo.dateTo)        setSelectedDateTo(headerInfo.dateTo);
          if (headerInfo.frequency)     setSelectedFrequency(headerInfo.frequency);
        }
        let importedRebateType = rebateType;
        if (headerInfo.rebateType) {
          const rtv = String(headerInfo.rebateType).toLowerCase();
          if      (rtv.includes('fixed'))       importedRebateType = "Fixed";
          else if (rtv.includes('incremental')) importedRebateType = "Incremental";
          else if (rtv.includes('percentage'))  importedRebateType = "Percentage";
          if (!preservedIsViewMode) setRebateType(importedRebateType);
        }
        let currentQuotaType = quotaType;
        if (headerInfo.quotaType) {
          const qtv = String(headerInfo.quotaType).toLowerCase();
          currentQuotaType = qtv.includes('without') ? "withoutQuota" : "withQuota";
          if (!preservedIsViewMode) setQuotaType(currentQuotaType);
        }
        const customerSheet = workbook.Sheets['Customers'];
        if (customerSheet) {
          const customerData = XLSX.utils.sheet_to_json(customerSheet, { header: 1 });
          let headerRowIndex = -1;
          for (let i = 0; i < customerData.length; i++) {
            const row = customerData[i];
            if (Array.isArray(row)) {
              const rowStr = row.join(' ').toLowerCase();
              if (rowStr.includes('customer code') && rowStr.includes('customer name')) {
                headerRowIndex = i;
                break;
              }
            }
          }
          if (headerRowIndex > -1) {
            const headers           = customerData[headerRowIndex];
            const codeColIndex      = headers.findIndex(h => String(h).toLowerCase().includes('customer code'));
            const nameColIndex      = headers.findIndex(h => String(h).toLowerCase().includes('customer name'));
            const qtrRebateColIndex = headers.findIndex(h => String(h).toLowerCase().includes('qtr rebate'));
            const periodColIndices  = [];
            const periodLabels      = [];
            const scanFrom = qtrRebateColIndex > -1 ? qtrRebateColIndex + 1 : nameColIndex + 1;
            for (let i = scanFrom; i < headers.length; i++) {
              const h = headers[i];
              if (h && String(h).trim() !== '') {
                periodColIndices.push(i);
                periodLabels.push(String(h).trim());
              }
            }
            if (importedRebateType === "Fixed" || importedRebateType === "Percentage") {
              const importedCustomers = [];
              for (let i = headerRowIndex + 1; i < customerData.length; i++) {
                const row = customerData[i];
                if (!Array.isArray(row) || !row[codeColIndex]) continue;
                const code = String(row[codeColIndex] || '').trim();
                const name = String(row[nameColIndex] || '').trim();
                if (!code || !name) continue;
                const exists = customersDropdown.some(c => c.CardCode === code || c.CardName === name);
                if (!exists) continue;
                const periodCount      = periodColIndices.length || 0;
                const quotasArray      = currentQuotaType === "withQuota" ? Array(periodCount).fill("") : [];
                const percentagesArray = currentQuotaType === "withQuota" ? Array(periodCount).fill("") : [];
                const customer = {
                  code,
                  name,
                  quotas:      quotasArray,
                  percentages: percentagesArray,
                  ranges:      {},
                  qtrRebate:   qtrRebateColIndex > -1 ? String(row[qtrRebateColIndex] || '0').trim() : '0',
                };
                if (currentQuotaType === "withQuota" && periodColIndices.length > 0) {
                  periodColIndices.forEach((colIdx, periodIdx) => {
                    let value = row[colIdx];
                    if (value !== undefined && value !== null) {
                      value = typeof value === 'number' ? value.toString() : String(value).trim();
                      if (importedRebateType === "Percentage") {
                        customer.percentages[periodIdx] = value;
                      } else {
                        customer.quotas[periodIdx] = value;
                      }
                    }
                  });
                }
                customer.quotaDetails = periodLabels.map((label, qi) => ({
                  Month: label.replace(/\s*\(.*?\)\s*/g, '').trim(),
                  TargetQty: customer.quotas[qi] || '0',
                }));
                importedCustomers.push(customer);
              }
              if (importedCustomers.length > 0) {
                setCustomers(importedCustomers);
                const state = {};
                importedCustomers.forEach((_, idx) => { state[idx] = false; });
                setEditingRows(prev => ({ ...prev, customer: state }));
                const importedQuotasMap = {};
                importedCustomers.forEach((customer, idx) => {
                  if (customer.quotas && customer.quotas.length > 0) {
                    importedQuotasMap[idx] = customer.quotas.map((qty, qi) => ({
                      Month: (periodLabels[qi] || `Month ${qi + 1}`).replace(/\s*\(.*?\)\s*/g, '').trim(),
                      TargetQty: qty,
                    }));
                  }
                });
                setImportedCustomerQuotas(importedQuotasMap);
              }
            } else if (importedRebateType === "Incremental") {
              const periodColIndex  = headers.findIndex(h => String(h).toLowerCase().includes('period'));
              const rangeNoColIndex = headers.findIndex(h => String(h).toLowerCase().includes('range no'));
              const minColIndex     = headers.findIndex(h => String(h).toLowerCase().includes('min qty'));
              const maxColIndex     = headers.findIndex(h => String(h).toLowerCase().includes('max qty'));
              const rebateColIndex  = headers.findIndex(h => String(h).toLowerCase().includes('rebate per bag'));
              const customerMap = new Map();
              for (let i = headerRowIndex + 1; i < customerData.length; i++) {
                const row = customerData[i];
                if (!Array.isArray(row) || !row[codeColIndex]) continue;
                const code        = String(row[codeColIndex] || '').trim();
                const name        = String(row[nameColIndex] || '').trim();
                const qtrRebate   = String(row[qtrRebateColIndex] || '0').trim();
                const periodLabel = String(row[periodColIndex] || '').trim();
                const rangeNo     = parseInt(row[rangeNoColIndex]) || 1;
                const minQty      = String(row[minColIndex]    || '0').trim();
                const maxQty      = String(row[maxColIndex]    || '0').trim();
                const rebate      = String(row[rebateColIndex] || '0').trim();
                if (!code || !name) continue;
                const exists = customersDropdown.some(c => c.CardCode === code);
                if (!exists) continue;
                if (!customerMap.has(code)) {
                  customerMap.set(code, { code, name, qtrRebate, ranges: {} });
                }
                const customer = customerMap.get(code);
                let periodIndex = 0;
                if (periodLabel && quotaPeriods.length > 0) {
                  const fi = quotaPeriods.findIndex(p => p.label === periodLabel || p.period === periodLabel);
                  if (fi !== -1) periodIndex = fi;
                }
                if (!customer.ranges[periodIndex]) customer.ranges[periodIndex] = [];
                while (customer.ranges[periodIndex].length < rangeNo) customer.ranges[periodIndex].push({});
                customer.ranges[periodIndex][rangeNo - 1] = { min: minQty, max: maxQty, rebate };
              }
              const importedCustomers = Array.from(customerMap.values());
              if (importedCustomers.length > 0) {
                setCustomers(importedCustomers);
                const state = {};
                importedCustomers.forEach((_, idx) => { state[idx] = false; });
                setEditingRows(prev => ({ ...prev, customer: state }));
              }
            }
          }
        }
        const itemSheet = workbook.Sheets['Items'];
        if (itemSheet) {
          const itemData = XLSX.utils.sheet_to_json(itemSheet, { header: 1 });
          let headerRowIndex = -1;
          for (let i = 0; i < itemData.length; i++) {
            const row = itemData[i];
            if (Array.isArray(row)) {
              const rowStr = row.join(' ').toLowerCase();
              if (rowStr.includes('item code') && rowStr.includes('item name')) {
                headerRowIndex = i;
                break;
              }
            }
          }
          if (headerRowIndex > -1) {
            const headers = itemData[headerRowIndex];
            if (importedRebateType === "Fixed" || importedRebateType === "Percentage") {
            const codeColIndex   = headers.findIndex(h => String(h).toLowerCase().includes('item code'));
            const nameColIndex   = headers.findIndex(h => String(h).toLowerCase().includes('item name'));
            const qtyColIndex    = headers.findIndex(h => String(h).toLowerCase().includes('qty') && !String(h).toLowerCase().includes('min') && !String(h).toLowerCase().includes('max'));
            const uomColIndex    = headers.findIndex(h => String(h).toLowerCase().includes('unit of measure') || String(h).toLowerCase() === 'uom');
            const rebateColIndex = headers.findIndex(h =>
              String(h).toLowerCase().includes('rebate per bag') || String(h).toLowerCase().includes('percentage per bag')
            );
            const importedItems = [];
            for (let i = headerRowIndex + 1; i < itemData.length; i++) {
              const row = itemData[i];
              if (!Array.isArray(row) || !row[codeColIndex]) continue;
              const code = String(row[codeColIndex] || '').trim();
              const name = String(row[nameColIndex] || '').trim();
              if (!code || !name) continue;
              const exists = itemsDropdown.some(i => i.ItemCode === code || i.ItemName === name);
              if (!exists) continue;
              const qty       = row[qtyColIndex]    !== undefined ? String(row[qtyColIndex]).trim()    : '';
              const rebateVal = row[rebateColIndex] !== undefined ? String(row[rebateColIndex]).trim() : '';
              const uomVal    = uomColIndex > -1 && row[uomColIndex] !== undefined ? String(row[uomColIndex]).trim() : ''; // ← declared here
              importedItems.push({
                code,
                name,
                unitPerQty:       qty,
                rebatePerBag:     importedRebateType === "Fixed"      ? rebateVal : '',
                percentagePerBag: importedRebateType === "Percentage" ? rebateVal : '',
                unitOfMeasure:    uomVal || detectUnitOfMeasure(name),
                ranges:           {},
              });
            }
              if (importedItems.length > 0) {
                setItems(importedItems);
                const state = {};
                importedItems.forEach((_, idx) => { state[idx] = false; });
                setEditingRows(prev => ({ ...prev, item: state }));
              }
            } else if (importedRebateType === "Incremental") {
              const codeColIndex    = headers.findIndex(h => String(h).toLowerCase().includes('item code'));
              const nameColIndex    = headers.findIndex(h => String(h).toLowerCase().includes('item name'));
              const qtyColIndex     = headers.findIndex(h => String(h).toLowerCase().includes('qty') && !String(h).toLowerCase().includes('min') && !String(h).toLowerCase().includes('max'));
              const uomColIndex     = headers.findIndex(h => String(h).toLowerCase().includes('unit of measure') || String(h).toLowerCase() === 'uom');
              const periodColIndex  = headers.findIndex(h => String(h).toLowerCase().includes('period'));
              const rangeNoColIndex = headers.findIndex(h => String(h).toLowerCase().includes('range no'));
              const minColIndex     = headers.findIndex(h => String(h).toLowerCase().includes('min qty'));
              const maxColIndex     = headers.findIndex(h => String(h).toLowerCase().includes('max qty'));
              const rebateColIndex  = headers.findIndex(h => String(h).toLowerCase().includes('rebate per bag'));
              const itemMap = new Map();
              for (let i = headerRowIndex + 1; i < itemData.length; i++) {
                const row = itemData[i];
                if (!Array.isArray(row) || !row[codeColIndex]) continue;
                const code        = String(row[codeColIndex] || '').trim();
                const name        = String(row[nameColIndex] || '').trim();
                if (!code || !name) continue;
                const exists = itemsDropdown.some(i => i.ItemCode === code);
                if (!exists) continue;
                const qty          = row[qtyColIndex]     !== undefined ? String(row[qtyColIndex]).trim()     : '';
                const uomVal        = uomColIndex > -1 && row[uomColIndex] !== undefined ? String(row[uomColIndex]).trim() : ''; // ← declared here, top of loop
                const periodLabel  = String(row[periodColIndex]  || '').trim();
                const rangeNo      = parseInt(row[rangeNoColIndex]) || 1;
                const minQty       = String(row[minColIndex]     || '0').trim();
                const maxQty       = String(row[maxColIndex]     || '0').trim();
                const rebate       = String(row[rebateColIndex]  || '0').trim();
                if (!itemMap.has(code)) {
                  itemMap.set(code, {
                    code, name,
                    unitPerQty: qty,
                    rebatePerBag: '', percentagePerBag: '',
                    unitOfMeasure: uomVal || detectUnitOfMeasure(name),
                    ranges: {}
                  });
                }
                const item = itemMap.get(code);
                let periodIndex = 0;
                if (periodLabel && quotaPeriods.length > 0) {
                  const fi = quotaPeriods.findIndex(p => p.label === periodLabel || p.period === periodLabel);
                  if (fi !== -1) periodIndex = fi;
                }
                if (!item.ranges[periodIndex]) item.ranges[periodIndex] = [];
                while (item.ranges[periodIndex].length < rangeNo) item.ranges[periodIndex].push({});
                item.ranges[periodIndex][rangeNo - 1] = { min: minQty, max: maxQty, rebate };
              }
              const importedItems = Array.from(itemMap.values());
              if (importedItems.length > 0) {
                setItems(importedItems);
                const state = {};
                importedItems.forEach((_, idx) => { state[idx] = false; });
                setEditingRows(prev => ({ ...prev, item: state }));
              }
            }
          }
        }
        if (preservedIsViewMode && preservedCode) {
          setRebateCode(preservedCode);
          setLoadedRebateCode(preservedCode);
          setIsViewMode(true);
          showToast(`Data imported — editing ${preservedCode}`, "success");
        } else {
          showToast("Data imported successfully!", "success");
        }
      } catch (error) {
        showToast(`Import failed: ${error.message}`, "error");
        if (preservedIsViewMode && preservedCode) {
          setRebateCode(preservedCode);
          setLoadedRebateCode(preservedCode);
          setIsViewMode(true);
        }
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => { setLoading(false); showToast("Error reading file. Please try again.", "error"); };
    reader.readAsArrayBuffer(file);
  };

  // ─── Updated file‑input handler ──────────────────────────────────────────
  const handleImportExcel = (event) => {
    const file = event.target.files?.[0];
    if (file) handleImportFile(file);
    event.target.value = ''; // reset
  };

  // ─── Drag‑and‑drop handlers ──────────────────────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      handleImportFile(file);
    }
  };

  // ─── Existing helper functions (unchanged) ───────────────────────────────
  const processCustomerDataSimple = (excelData) => {
    try {
      if (!excelData || excelData.length < 2) {
        showToast("No customer data found in sheet", "warning");
        return { importedCustomers: [], importedQuotasMap: {} };
      }
      const headerRow = Array.isArray(excelData[0]) ? excelData[0] : [];
      const dataRows  = excelData.slice(1).filter(row =>
        Array.isArray(row) && row.some((cell, i) => i < 2 && cell && String(cell).trim() !== '')
      );
      const importedCustomers = [];
      const skippedCustomers  = [];
      if (rebateType === "Incremental") {
        const customerMap = {};
        dataRows.forEach(row => {
          const r         = Array.isArray(row) ? row : [row];
          const codeValue = String(r[0] ?? "").trim();
          const nameValue = String(r[1] ?? "").trim();
          if (!codeValue && !nameValue) return;
          const found = customersDropdown.find(c => c.CardCode === codeValue || c.CardName === nameValue);
          if (!found) { skippedCustomers.push({ code: codeValue, name: nameValue }); return; }
          const key = found.CardCode;
          if (!customerMap[key]) {
            customerMap[key] = {
              code:        found.CardCode,
              name:        found.CardName,
              qtrRebate:   String(r[2] ?? ""),
              quotas:      [],
              percentages: [],
              ranges:      {},
            };
          }
          const periodIdx = r[3] !== undefined && r[3] !== "" ? parseInt(r[3]) : null;
          const rangeNo   = r[5] !== undefined && r[5] !== "" ? parseInt(r[5]) : null;
          if (periodIdx !== null && !isNaN(periodIdx) && rangeNo !== null && !isNaN(rangeNo)) {
            if (!customerMap[key].ranges[periodIdx]) customerMap[key].ranges[periodIdx] = [];
            customerMap[key].ranges[periodIdx][rangeNo - 1] = {
              min:    String(r[6] ?? "0"),
              max:    String(r[7] ?? "0"),
              rebate: String(r[8] ?? ""),
            };
          }
        });
        Object.values(customerMap).forEach(c => importedCustomers.push(c));
      } else if (rebateType === "Percentage") {
        const periodCols = headerRow.slice(2);
        dataRows.forEach(row => {
          const r         = Array.isArray(row) ? row : [row];
          const codeValue = String(r[0] ?? "").trim();
          const nameValue = String(r[1] ?? "").trim();
          if (!codeValue && !nameValue) return;
          const found = customersDropdown.find(c => c.CardCode === codeValue || c.CardName === nameValue);
          if (!found) { skippedCustomers.push({ code: codeValue, name: nameValue }); return; }
          const percentages = periodCols.map((_, i) => String(r[2 + i] ?? ""));
          importedCustomers.push({
            code:        found.CardCode,
            name:        found.CardName,
            qtrRebate:   "",
            quotas:      percentages,
            percentages,
            ranges:      {},
          });
        });
      } else {
        const periodCols = headerRow.slice(3);
        dataRows.forEach(row => {
          const r         = Array.isArray(row) ? row : [row];
          const codeValue = String(r[0] ?? "").trim();
          const nameValue = String(r[1] ?? "").trim();
          if (!codeValue && !nameValue) return;
          const found = customersDropdown.find(c => c.CardCode === codeValue || c.CardName === nameValue);
          if (!found) { skippedCustomers.push({ code: codeValue, name: nameValue }); return; }
          const qtrRebate = String(r[2] ?? "");
          const quotas    = periodCols.map((_, i) => String(r[3 + i] ?? ""));
          importedCustomers.push({
            code:        found.CardCode,
            name:        found.CardName,
            qtrRebate,
            quotas,
            percentages: [],
            ranges:      {},
          });
        });
      }
      if (skippedCustomers.length > 0)
        showToast(`Imported ${importedCustomers.length} customers, skipped ${skippedCustomers.length} not found in system`, "warning");
      return { importedCustomers, importedQuotasMap: {} };
    } catch (error) {
      showToast(`Error processing customer data: ${error.message}`, "error");
      return { importedCustomers: [], importedQuotasMap: {} };
    }
  };

  const processItemDataSimple = (excelData) => {
    try {
      if (!excelData || excelData.length < 2) {
        showToast("No item data found in sheet", "warning");
        return [];
      }
      const dataRows = excelData.slice(1).filter(row =>
        Array.isArray(row) && row.some((cell, i) => i < 2 && cell && String(cell).trim() !== '')
      );
      const importedItems = [];
      const skippedItems  = [];
      if (rebateType === "Incremental") {
        const itemMap = {};
        dataRows.forEach(row => {
          const r         = Array.isArray(row) ? row : [row];
          const codeValue = String(r[0] ?? "").trim();
          const nameValue = String(r[1] ?? "").trim();
          if (!codeValue && !nameValue) return;
          const found = itemsDropdown.find(i => i.ItemCode === codeValue || i.ItemName === nameValue);
          if (!found) { skippedItems.push({ code: codeValue, name: nameValue }); return; }
          const key = found.ItemCode;
          if (!itemMap[key]) {
            itemMap[key] = {
              code:             found.ItemCode,
              name:             found.ItemName,
              unitPerQty:       String(r[2] ?? ""),
              rebatePerBag:     "",
              percentagePerBag: "",
              ranges:           {},
            };
          }
          const periodIdx = r[3] !== undefined && r[3] !== "" ? parseInt(r[3]) : null;
          const rangeNo   = r[5] !== undefined && r[5] !== "" ? parseInt(r[5]) : null;
          if (periodIdx !== null && !isNaN(periodIdx) && rangeNo !== null && !isNaN(rangeNo)) {
            if (!itemMap[key].ranges[periodIdx]) itemMap[key].ranges[periodIdx] = [];
            itemMap[key].ranges[periodIdx][rangeNo - 1] = {
              min:    String(r[6] ?? "0"),
              max:    String(r[7] ?? "0"),
              rebate: String(r[8] ?? ""),
            };
          }
        });
        Object.values(itemMap).forEach(i => importedItems.push(i));
      } else {
        dataRows.forEach(row => {
          const r         = Array.isArray(row) ? row : [row];
          const codeValue = String(r[0] ?? "").trim();
          const nameValue = String(r[1] ?? "").trim();
          if (!codeValue && !nameValue) return;
          const found = itemsDropdown.find(i => i.ItemCode === codeValue || i.ItemName === nameValue);
          if (!found) { skippedItems.push({ code: codeValue, name: nameValue }); return; }
          importedItems.push({
            code:             found.ItemCode,
            name:             found.ItemName,
            unitPerQty:       String(r[2] ?? ""),
            rebatePerBag:     rebateType === "Fixed"      ? String(r[3] ?? "") : "",
            percentagePerBag: rebateType === "Percentage" ? String(r[3] ?? "") : "",
            ranges:           {},
          });
        });
      }
      if (skippedItems.length > 0)
        showToast(`Imported ${importedItems.length} items, skipped ${skippedItems.length} not found in system`, "warning");
      return importedItems;
    } catch (error) {
      showToast(`Error processing item data: ${error.message}`, "error");
      return [];
    }
  };

  const extractHeaderInfoFromData = (excelData) => {
    if (!excelData || excelData.length < 2) return;
    const headerRow = excelData[0];
    const valueRow  = excelData[1];
    if (!Array.isArray(headerRow) || !Array.isArray(valueRow)) return;
    headerRow.forEach((header, index) => {
      if (!header) return;
      const h = String(header).toLowerCase().trim();
      const v = valueRow[index] ? String(valueRow[index]).trim() : "";
      if      (h.includes('rebate code'))      { if (v) setRebateCode(v); }
      else if (h.includes('sales employee'))   { if (v) setSelectedSalesEmployee(v); }
      else if (h.includes('date from'))        { if (v) setSelectedDateFrom(v); }
      else if (h.includes('date to'))          { if (v) setSelectedDateTo(v); }
      else if (h.includes('frequency'))        { if (v) setSelectedFrequency(v); }
      else if (h.includes('quota type')) {
        if (v) { const vs = v.toLowerCase(); setQuotaType(vs.includes('without') || vs.includes('no quota') ? "withoutQuota" : "withQuota"); }
      }
      else if (h.includes('rebate type')) {
        if (v) {
          const vs = v.toLowerCase();
          if (vs.includes('fixed'))            setRebateType("Fixed");
          else if (vs.includes('incremental')) setRebateType("Incremental");
          else if (vs.includes('percentage'))  setRebateType("Percentage");
        }
      }
    });
    if (!rebateType) setRebateType("Percentage");
  };

  const handleExportExcel = () => {
    if (!access.canExport) { showToast("You do not have permission to export data", "error"); return; }
    try {
      const workbook = XLSX.utils.book_new();
      const headerData = [
        ["Rebate Code","Sales Employee","Date From","Date To","Frequency","Quota Type","Rebate Type","Name"],
        [
          isViewMode ? loadedRebateCode : rebateCode,
          selectedSalesEmployee,
          selectedDateFrom,
          selectedDateTo,
          selectedFrequency,
          quotaType === "withQuota" ? "With Quota" : "Without Quota",
          rebateType,
          selectedName,
        ],
        [],
      ];
      const monthlyPeriods = getMonthlyPeriodsFromQuotaPeriods();
      let customerSheetData = [...headerData];
      if (rebateType === "Fixed" || rebateType === "Percentage") {
        const customerHeaders = ["Customer Code", "Customer Name"];
        if (rebateType === "Fixed") {
          customerHeaders.push("Qtr Rebate");
          monthlyPeriods.forEach(period => customerHeaders.push(`${period.label} (Qty)`));
        } else {
          monthlyPeriods.forEach(period => customerHeaders.push(`${period.label} (%)`));
        }
        customerSheetData.push(customerHeaders);
        customers.filter(c => c.code && c.name).forEach(c => {
          const row = [c.code, c.name];
          if (rebateType === "Fixed") {
            row.push(c.qtrRebate || '0');
            for (let i = 0; i < monthlyPeriods.length; i++) row.push(c.quotas?.[i] || '0');
          } else {
            for (let i = 0; i < monthlyPeriods.length; i++) row.push(c.percentages?.[i] || '0');
          }
          customerSheetData.push(row);
        });
      } else if (rebateType === "Incremental") {
        customerSheetData.push(["Customer Code","Customer Name","Qtr Rebate","Period","Range No","Min Qty","Max Qty","Rebate Per Bag"]);
        customers.filter(c => c.code && c.name).forEach(c => {
          let hasRanges = false;
          for (let periodIdx = 0; periodIdx < monthlyPeriods.length; periodIdx++) {
            const periodRanges = c.ranges?.[periodIdx] || [];
            for (let rangeNo = 0; rangeNo < periodRanges.length; rangeNo++) {
              const range = periodRanges[rangeNo];
              if (range && (range.min || range.max || range.rebate)) {
                customerSheetData.push([
                  c.code, c.name, c.qtrRebate || '0',
                  monthlyPeriods[periodIdx]?.label || `Period ${periodIdx + 1}`,
                  rangeNo + 1, range.min || '0', range.max || '0', range.rebate || '0',
                ]);
                hasRanges = true;
              }
            }
          }
          if (!hasRanges && monthlyPeriods.length > 0) {
            customerSheetData.push([c.code, c.name, c.qtrRebate || '0', monthlyPeriods[0]?.label || 'Period 1', 1, '0', '0', '0']);
          }
        });
      }
      const customerWorksheet = XLSX.utils.aoa_to_sheet(customerSheetData);
      XLSX.utils.book_append_sheet(workbook, customerWorksheet, 'Customers');
      let itemSheetData = [...headerData];
      if (rebateType === "Fixed" || rebateType === "Percentage") {
      const itemHeaders = ["Item Code","Item Name","Qty","Unit of Measure", rebateType === "Fixed" ? "Rebate Per Bag" : "Percentage Per Bag"];
      itemSheetData.push(itemHeaders);
      items.filter(i => i.code && i.name).forEach(i => {
        itemSheetData.push([
          i.code, i.name, i.unitPerQty || '0', i.unitOfMeasure || '',
          rebateType === "Percentage" ? (i.percentagePerBag || '0') : (i.rebatePerBag || '0'),
        ]);
      });
      } else if (rebateType === "Incremental") {
        itemSheetData.push(["Item Code","Item Name","Qty","Period","Range No","Min Qty","Max Qty","Rebate Per Bag"]);
        items.filter(i => i.code && i.name).forEach(i => {
          let hasRanges = false;
          for (let periodIdx = 0; periodIdx < monthlyPeriods.length; periodIdx++) {
            const periodRanges = i.ranges?.[periodIdx] || [];
            for (let rangeNo = 0; rangeNo < periodRanges.length; rangeNo++) {
              const range = periodRanges[rangeNo];
              if (range && (range.min || range.max || range.rebate)) {
                itemSheetData.push([
                  i.code, i.name, i.unitPerQty || '0', i.unitOfMeasure || '',
                  monthlyPeriods[periodIdx]?.label || `Period ${periodIdx + 1}`,
                  rangeNo + 1, range.min || '0', range.max || '0', range.rebate || '0',
                ]);
                hasRanges = true;
              }
            }
          }
          if (!hasRanges && monthlyPeriods.length > 0) {
            itemSheetData.push([i.code, i.name, i.unitPerQty || '0', monthlyPeriods[0]?.label || 'Period 1', 1, '0', '0', '0']);
          }
        });
      }
      const itemWorksheet = XLSX.utils.aoa_to_sheet(itemSheetData);
      XLSX.utils.book_append_sheet(workbook, itemWorksheet, 'Items');
      if (customers.length === 0 && items.length === 0) { showToast("No data to export!", "warning"); return; }
      const df = selectedDateFrom ? selectedDateFrom.replace(/-/g, '') : 'NODATE';
      const dt = selectedDateTo   ? selectedDateTo.replace(/-/g, '')   : 'NODATE';
      const rt = rebateType       ? rebateType.toUpperCase()           : 'NOTYPE';
      XLSX.writeFile(workbook, `REBATE_${rt}_${df}_${dt}_VAN.xlsx`);
      showToast("Data exported successfully!", "success");
    } catch (error) {
      showToast('Error exporting data to Excel.', "error");
    }
  };

  const handleDownload = () => handleExportExcel();

  const handleOpenCustomerModal = (index) => {
    if (!access.canEdit) { showToast("You do not have permission to edit customers", "error"); return; }
    setCurrentEditingRow({ type: 'customer', index });
    if (customers[index] && customers[index].code) {
      const existing = customersDropdown.find(c => c.CardCode === customers[index].code || c.CardName === customers[index].name);
      setTempSelectedCustomers(existing ? [existing] : []);
    } else { setTempSelectedCustomers([]); }
    setIsCustomerModalOpen(true);
  };

  const handleCustomerSelectionConfirm = (selectedCustomersData) => {
    const { index } = currentEditingRow;
    if (selectedCustomersData.length > 0) {
      if (index !== null) {
        const selected     = selectedCustomersData[0];
        const newCustomers = [...customers];
        newCustomers[index] = {
          ...newCustomers[index],
          code:        selected.CardCode || selected.code || '',
          name:        selected.CardName || selected.name || '',
          quotas:      quotaType === "withQuota" ? Array(quotaCount).fill("") : [],
          percentages: quotaType === "withQuota" ? Array(quotaCount).fill("") : [],
          ranges:      {},
          qtrRebate:   "",
        };
        setCustomers(newCustomers);
        showToast(`Customer "${selected.CardName || selected.name}" updated successfully`, "success");
      } else {
        const newCustomers = [...customers];
        let addedCount = 0;
        selectedCustomersData.forEach((sc) => {
          const code   = sc.CardCode || sc.code;
          const exists = newCustomers.some(c => c.code === code);
          if (!exists) {
            newCustomers.push({ code, name: sc.CardName || sc.name || '', quotas: quotaType === "withQuota" ? Array(quotaCount).fill("") : [], percentages: quotaType === "withQuota" ? Array(quotaCount).fill("") : [], ranges: {}, qtrRebate: "" });
            addedCount++;
          }
        });
        if (addedCount > 0) {
          setCustomers(newCustomers);
          const state = {};
          newCustomers.forEach((_, idx) => { state[idx] = false; });
          setEditingRows(prev => ({ ...prev, customer: state }));
          showToast(`Successfully added ${addedCount} customer${addedCount > 1 ? 's' : ''}`, "success");
        } else { showToast("No new customers were added (they may already exist in the list)", "info"); }
      }
    }
    setIsCustomerModalOpen(false);
    setTempSelectedCustomers([]);
    setCurrentEditingRow({ type: null, index: null });
  };

  const handleOpenItemModal = (index) => {
    if (!access.canEdit) { showToast("You do not have permission to edit items", "error"); return; }
    setCurrentEditingRow({ type: 'item', index });
    if (items[index] && items[index].code) {
      const existing = itemsDropdown.find(i => i.ItemCode === items[index].code || i.ItemName === items[index].name);
      setTempSelectedItems(existing ? [existing] : []);
    } else { setTempSelectedItems([]); }
    setIsItemModalOpen(true);
  };

  const handleItemSelectionConfirm = (selectedItemsData) => {
    const { index } = currentEditingRow;
    if (selectedItemsData.length > 0) {
      if (index !== null) {
        const selected = selectedItemsData[0];
        const newItems = [...items];
        const selectedName = selected.ItemName || selected.name || '';
        newItems[index] = {
          ...newItems[index],
          code:             selected.ItemCode || selected.code || '',
          name:             selectedName,
          unitPerQty:       newItems[index].unitPerQty || '',
          rebatePerBag:     newItems[index].rebatePerBag || '',
          percentagePerBag: newItems[index].percentagePerBag || '',
          unitOfMeasure:    newItems[index].unitOfMeasure || detectUnitOfMeasure(selectedName),
          ranges:           {},
        };
        setItems(newItems);
        showToast(`Item "${selected.ItemName || selected.name}" updated successfully`, "success");
      } else {
        const newItems = [...items];
        let addedCount = 0;
        selectedItemsData.forEach((si) => {
          const code   = si.ItemCode || si.code;
          const exists = newItems.some(i => i.code === code);
          if (!exists) {
            const siName = si.ItemName || si.name || '';
            newItems.push({
              code, name: siName,
              unitPerQty: "", rebatePerBag: "", percentagePerBag: "",
              unitOfMeasure: detectUnitOfMeasure(siName),
              ranges: {}
            });
            addedCount++;
          }
        });
        if (addedCount > 0) {
          setItems(newItems);
          const state = {};
          newItems.forEach((_, idx) => { state[idx] = false; });
          setEditingRows(prev => ({ ...prev, item: state }));
          showToast(`Successfully added ${addedCount} item${addedCount > 1 ? 's' : ''}`, "success");
        } else { showToast("No new items were added (they may already exist in the list)", "info"); }
      }
    }
    setIsItemModalOpen(false);
    setTempSelectedItems([]);
    setCurrentEditingRow({ type: null, index: null });
  };

  const openQuotaModal = (customerIndex) => {
    if (quotaType === "withoutQuota") { showToast("Quota management is disabled for 'Without Quota' programs", "info"); return; }
    const customer = customers[customerIndex];
    if (rebateType === "Percentage") {
      setPercentageModal({ isOpen: true, customer: { ...customer, index: customerIndex } });
    } else if (rebateType === "Incremental") {
      setRangeModal({ isOpen: true, customer: { ...customer, index: customerIndex } });
    } else {
        setQuotaModal({ isOpen: true, customer: { ...customer, index: customerIndex }, importedQuotas: importedCustomerQuotas[customerIndex] || [] });
    }
  };

  const openProductRangeModal = (productIndex) => {
    if (quotaType === "withoutQuota") { showToast("Range management is disabled for 'Without Quota' programs", "info"); return; }
    if (rebateType === "Incremental") {
      setProductRangeModal({ isOpen: true, product: { ...items[productIndex], index: productIndex } });
    } else {
      showToast("Fixed rebate type selected - use direct input for rebate per bag", "info");
    }
  };

  const handleSaveQuotas = (customerIndex, quotas) => {
    const newCustomers = [...customers];
    const targetQtys   = quotas.map(q => q.TargetQty || "0");
    newCustomers[customerIndex].quotas       = targetQtys;
    newCustomers[customerIndex].quotaDetails = quotas;
    if (rebateType === "Percentage") newCustomers[customerIndex].percentages = targetQtys;
    setCustomers(newCustomers);
    showToast("Quotas updated successfully", "success");
  };

  const handleSaveRanges = (customerIndex, ranges) => {
    const newCustomers = [...customers];
    newCustomers[customerIndex].ranges = ranges;
    setCustomers(newCustomers);
    showToast("Rebate ranges updated successfully", "success");
  };

  const handleSavePercentages = (customerIndex, percentagesArray) => {
    if (!percentagesArray || !Array.isArray(percentagesArray)) { showToast("Invalid data format", "error"); return; }
    const newCustomers = [...customers];
    const formatted    = percentagesArray.map(p => (p === "" || p === null || p === undefined) ? "" : p.toString());
    newCustomers[customerIndex].percentages  = formatted;
    const monthlyPeriods = getMonthlyPeriodsFromQuotaPeriods();
    newCustomers[customerIndex].quotaDetails = monthlyPeriods.map((period, i) => ({
      Month: period.label || period.month || period.period || `Month ${i + 1}`,
      TargetQty: percentagesArray[i] || "0",
    }));
    setCustomers(newCustomers);
    showToast("Target percentages updated successfully", "success");
  };

  const handleSaveProductRanges = (productIndex, ranges) => {
    const newItems = [...items];
    newItems[productIndex].ranges = ranges;
    setItems(newItems);
    showToast("Product rebate ranges updated successfully", "success");
  };

  const closeQuotaModal        = () => setQuotaModal({ isOpen: false, customer: null, importedQuotas: [] });
  const closeRangeModal        = () => setRangeModal({ isOpen: false, customer: null });
  const closePercentageModal   = () => setPercentageModal({ isOpen: false, customer: null });
  const closeProductRangeModal = () => setProductRangeModal({ isOpen: false, product: null });

  const toggleRowEdit = (type, index) => setEditingRows(prev => ({ ...prev, [type]: { ...prev[type], [index]: !prev[type][index] } }));
  const isRowEditable = (type, index) => editingRows[type][index];

  const handleQuotaTypeChange = (type) => {
    setQuotaType(type);
    if (type === "withoutQuota") {
      setCustomers(prev => prev.map(c => ({ ...c, quotas: [], percentages: [], ranges: {} })));
      setItems(prev => prev.map(i => ({ ...i, ranges: {} })));
      setQuotaPeriods([]);
      setQuotaCount(0);
      showToast("Switched to Without Quota mode - all quotas and ranges cleared", "info");
    } else {
      showToast("Switched to With Quota mode - configure date range and frequency", "info");
    }
  };

const getMonthlyPeriodsFromQuotaPeriods = () => {
  // For Monthly (and N/A), quotaPeriods are already monthly — return them directly
  if (selectedFrequency === "Monthly" || selectedFrequency === "N/A" || !selectedFrequency) {
    return quotaPeriods.map((qp, i) => ({
      period:    qp.period    || `Month ${i + 1}`,
      label:     qp.label     || qp.period || `Month ${i + 1}`,
      startDate: qp.startDate,
      endDate:   qp.endDate,
      dates:     qp.dates     || '',
      month:     qp.label     || `Month ${i + 1}`,
      year:      qp.year      || (qp.startDate ? new Date(qp.startDate).getFullYear() : ''),
    }));
  }

  // Quarterly: expand each quarter into monthly slices
  const monthlyPeriods = [];
  const fmt  = (d, opts) => d.toLocaleDateString('en-US', opts);
  const sOpt = { month: 'short', day: 'numeric' };
  const lOpt = { month: 'short', day: 'numeric', year: 'numeric' };

  quotaPeriods.forEach((qp) => {
    if (!qp.startDate || !qp.endDate) {
      // fallback: no dates, use quarter name
      const quarterNames = ["Q1","Q2","Q3","Q4"];
      const monthNames   = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const quarterIndex = quarterNames.indexOf(qp.quarter);
      const startMonth   = quarterIndex * 3;
      for (let i = 0; i < 3; i++) {
        const mn = monthNames[startMonth + i];
        const yr = new Date().getFullYear();
        monthlyPeriods.push({
          period:        `${mn} ${yr}`,
          label:         mn,
          month:         mn,
          year:          yr,
          quarter:       qp.quarter,
          quarterPeriod: qp.period,
          dates:         `${mn} ${yr}`,
        });
      }
      return;
    }

    const ed   = new Date(qp.endDate);
    let mStart = new Date(qp.startDate);

    while (mStart <= ed) {
      if (mStart.getTime() === ed.getTime()) break;

      const mNext       = addMonths(mStart, 1);
      const isLastMonth = mNext >= ed;
      const mEnd        = isLastMonth
        ? new Date(ed)
        : (() => { const d = new Date(mNext); d.setDate(d.getDate() - 1); return d; })();

      const mn = fmt(mStart, { month: 'long' });
      const yr = mStart.getFullYear();

      monthlyPeriods.push({
        period:        `${mn} ${yr}`,
        label:         mn,
        startDate:     new Date(mStart),
        endDate:       new Date(mEnd),
        dates:         `${fmt(mStart, sOpt)} - ${fmt(mEnd, lOpt)}`,
        month:         mn,
        year:          yr,
        quarter:       qp.quarter,
        quarterPeriod: qp.period,
      });

      if (isLastMonth) break;
      mStart = mNext;
    }
  });

  return monthlyPeriods;
};

  const handleUpdate = async () => {
    if (!access.canEdit) { showToast("You do not have permission to update rebate setups", "error"); return; }
    if (!rebateType)            { showToast("Please select a rebate type", "error"); return; }
    if (!selectedSalesEmployee) { showToast("Please select a sales employee", "error"); return; }
    if (!selectedDateFrom || !selectedDateTo) { showToast("Please select date range", "error"); return; }
    if (!selectedFrequency)     { showToast("Please select frequency", "error"); return; }
    const validCustomers = customers.filter(c => c.code && c.name);
    const validItems     = items.filter(i => i.code && i.name);
    if (validCustomers.length === 0) { showToast("Please add at least one valid customer", "error"); return; }
    if (validItems.length === 0)     { showToast("Please add at least one valid item", "error"); return; }
    setLoading(true);
    const codeToUpdate = loadedRebateCode;
    try {
      const existingCustRes  = await fetch(`${API_BASE}/rebate-program/customers/${encodeURIComponent(codeToUpdate)}?db=VAN&type=${encodeURIComponent(rebateType)}`);
      const existingItemsRes = await fetch(`${API_BASE}/rebate-program/items/${encodeURIComponent(codeToUpdate)}?db=VAN&type=${encodeURIComponent(rebateType)}`);
      let existingCustomers = [], existingItems = [];
      if (existingCustRes.ok)  existingCustomers = (await existingCustRes.json()).customers || [];
      if (existingItemsRes.ok) existingItems     = (await existingItemsRes.json()).items || [];

      const customerCreatedMap = {};
      existingCustomers.forEach(c => { customerCreatedMap[c.CardCode] = c.CreatedDate; });
      const itemCreatedMap = {};
      existingItems.forEach(i => { itemCreatedMap[i.ItemCode] = i.CreatedDate; });

      const salesEmployee = Array.isArray(salesEmployees)
        ? salesEmployees.find(emp => emp.SlpName === selectedSalesEmployee)
        : null;
      const slpCode = salesEmployee ? salesEmployee.SlpCode : null;
      if (!slpCode) throw new Error("Sales employee code not found");

      const progRes = await fetch(`${API_BASE}/rebate-program/${encodeURIComponent(codeToUpdate)}?db=VAN`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          RebateType:  rebateType,
          SlpCode:     slpCode,
          SlpName:     selectedSalesEmployee,
          DateFrom:    selectedDateFrom,
          DateTo:      selectedDateTo,
          Frequency:   selectedFrequency,
          QuotaType:   quotaType === "withQuota" ? "With Quota" : "Without Quota",
          Name:        selectedName,
          UpdatedBy:   userCode || userName,
          db:          'VAN',
        }),
      });
      if (!progRes.ok) { const t = await progRes.text(); throw new Error(`Failed to update program header: ${t}`); }

      const delRes = await fetch(`${API_BASE}/rebate-program/${encodeURIComponent(codeToUpdate)}/details?db=VAN&type=${encodeURIComponent(rebateType)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!delRes.ok) { const t = await delRes.text(); throw new Error(`Failed to clear existing details: ${t}`); }

      if      (rebateType === "Fixed")       await saveFixedRebateData(codeToUpdate, 'VAN', customerCreatedMap, itemCreatedMap);
      else if (rebateType === "Incremental") await saveIncrementalRebateData(codeToUpdate, 'VAN', customerCreatedMap, itemCreatedMap);
      else if (rebateType === "Percentage")  await savePercentageRebateData(codeToUpdate, 'VAN', customerCreatedMap, itemCreatedMap);

      showToast(`Rebate program "${codeToUpdate}" updated successfully!`, "success");
      setEditingRows({ customer: {}, item: {} });
    } catch (error) {
      showToast(`Failed to update rebate setup: ${error.message}`, "error");
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!access.canCreate) { showToast("You do not have permission to save rebate setups", "error"); return; }
    if (!rebateType)            { showToast("Please select a rebate type", "error"); return; }
    if (!selectedSalesEmployee) { showToast("Please select a sales employee", "error"); return; }
    if (!selectedDateFrom || !selectedDateTo) { showToast("Please select date range", "error"); return; }
    if (!selectedFrequency)     { showToast("Please select frequency", "error"); return; }
    const validCustomers = customers.filter(c => c.code && c.name);
    const validItems     = items.filter(i => i.code && i.name);
    if (validCustomers.length === 0) { showToast("Please add at least one valid customer", "error"); return; }
    if (validItems.length === 0)     { showToast("Please add at least one valid item", "error"); return; }
    setLoading(true);
    try {
      const salesEmployee = Array.isArray(salesEmployees)
        ? salesEmployees.find(emp => emp.SlpName === selectedSalesEmployee)
        : null;
      const slpCode = salesEmployee ? salesEmployee.SlpCode : null;
      if (!slpCode) throw new Error("Sales employee code not found");
      /* const dupCheckRes = await fetch(`${API_BASE}/rebate-program/check-duplicate-program`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateType: rebateType, SlpCode: slpCode, DateFrom: selectedDateFrom, DateTo: selectedDateTo, db: 'VAN' }),
      });
      if (!dupCheckRes.ok) throw new Error(`Server returned status ${dupCheckRes.status}`);
      const dupCheckResult = await dupCheckRes.json();
      if (dupCheckResult.success && dupCheckResult.exists) {
        setDuplicationError({ isOpen: true, type: 'duplicateProgram', data: { program: dupCheckResult.program } });
        showToast(`⚠️ Duplicate rebate program detected`, "error");
        setLoading(false);
        return;
      }
      const duplicateItems = [];
      for (const item of validItems) {
        try {
          const res = await fetch(`${API_BASE}/rebate-program/check-item-conflict`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ RebateType: rebateType, SlpCode: slpCode, DateFrom: selectedDateFrom, DateTo: selectedDateTo, Frequency: selectedFrequency, ItemCode: item.code, db: 'VAN' }),
          });
          if (!res.ok) continue;
          const result = await res.json();
          if (result && result.exists) duplicateItems.push({ name: item.name, code: item.code, existingProgram: result.existingProgram });
        } catch { showToast(`Warning: Could not verify item ${item.name}`, "warning"); }
      }
      if (duplicateItems.length > 0) {
        setDuplicationError({ isOpen: true, type: 'duplicateItem', data: { duplicateItems } });
        showToast(`⚠️ Found ${duplicateItems.length} duplicate item(s)`, "error");
        setLoading(false);
        return;
      }*/
      const newRebateCode     = await generateNextRebateCode();
      const rebateProgramData = {
        RebateType: rebateType, SlpCode: slpCode, SlpName: selectedSalesEmployee,
        DateFrom: selectedDateFrom, DateTo: selectedDateTo, Frequency: selectedFrequency,
        QuotaType: quotaType === "withQuota" ? "With Quota" : "Without Quota",
        Name: selectedName,
        CreatedBy: userCode || userName, 
        UpdatedBy: userCode || userName, 
        db: 'VAN',
      };
      const programRes = await fetch(`${API_BASE}/rebate-program?db=VAN`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rebateProgramData),
      });
      if (!programRes.ok) { const t = await programRes.text(); throw new Error(`Failed to save rebate program: ${t}`); }
      const programResult = await programRes.json();
      const rebateCodeId  = programResult.rebateCode;
      if      (rebateType === "Fixed")       await saveFixedRebateData(rebateCodeId, 'VAN');
      else if (rebateType === "Incremental") await saveIncrementalRebateData(rebateCodeId, 'VAN');
      else if (rebateType === "Percentage")  await savePercentageRebateData(rebateCodeId, 'VAN');
      setRebateCode(rebateCodeId);
      showToast(`Rebate setup saved successfully! ID: ${rebateCodeId}`, "success");
      setEditingRows({ customer: { 0: true }, item: { 0: true } });
    } catch (error) {
      showToast(`Failed to save rebate setup: ${error.message}`, "error");
    } finally { setLoading(false); }
  };

  const saveFixedRebateData = async (rebateCodeId, database, customerCreatedMap = {}, itemCreatedMap = {}) => {
    for (const customer of customers) {
      if (!customer.code || !customer.name) continue;
      const originalCreated = customerCreatedMap[customer.code] || null;
      const custRes = await fetch(`${API_BASE}/fix-cust-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, CardCode: customer.code, CardName: customer.name, QtrRebate: customer.qtrRebate || 0, CreatedDate: originalCreated, db: 'VAN' }),
      });
      if (!custRes.ok) { const t = await custRes.text(); throw new Error(`Failed to save customer ${customer.code}: ${t}`); }
      const custResult   = await custRes.json();
      const custRebateId = custResult.id;
      if (quotaType === "withQuota" && customer.quotas && customer.quotas.length > 0) {
        const monthlyPeriods = getMonthlyPeriodsFromQuotaPeriods();
        let nextQuotaId = 1;
        for (let i = 0; i < monthlyPeriods.length; i++) {
          const monthName = monthlyPeriods[i]?.label || `Month ${i + 1}`;
          const targetQty = customer.quotas[i] || "";
          if (targetQty !== "" && targetQty !== null) {
            const val = parseFloat(targetQty);
            if (!isNaN(val)) {
              const qr = await fetch(`${API_BASE}/fix-cust-quota?db=${database}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Id: nextQuotaId++, CustRebateId: custRebateId, Month: monthName, TargetQty: val, db: 'VAN' }),
              });
              if (!qr.ok) console.error(`Failed to save quota for ${monthName}`);
            }
          }
        }
      }
    }
    for (const item of items) {
      if (!item.code || !item.name) continue;
      const originalCreated = itemCreatedMap[item.code] || null;
      const ir = await fetch(`${API_BASE}/fix-prod-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, ItemCode: item.code, ItemName: item.name, UnitPerQty: parseFloat(item.unitPerQty) || 0, RebatePerBag: parseFloat(item.rebatePerBag) || 0, UnitOfMeasure: item.unitOfMeasure || '', CreatedDate: originalCreated, db: 'VAN' }),
      });
      if (!ir.ok) { const t = await ir.text(); throw new Error(`Failed to save item ${item.code}: ${t}`); }
    }
  };

  const saveIncrementalRebateData = async (rebateCodeId, database, customerCreatedMap = {}, itemCreatedMap = {}) => {
    for (const customer of customers) {
      if (!customer.code || !customer.name) continue;
      const originalCreated = customerCreatedMap[customer.code] || null;
      const custRes = await fetch(`${API_BASE}/inc-cust-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, CardCode: customer.code, CardName: customer.name, QtrRebate: customer.qtrRebate || 0, CreatedDate: originalCreated, db: 'VAN' }),
      });
      if (!custRes.ok) { const t = await custRes.text(); throw new Error(`Failed: ${t}`); }
      const custResult      = await custRes.json();
      const incCustRebateId = custResult.id;
      if (customer.ranges && Object.keys(customer.ranges).length > 0) {
        for (const [, ranges] of Object.entries(customer.ranges)) {
          let rangeNo = 1;
          for (const range of ranges) {
            const rr = await fetch(`${API_BASE}/inc-cust-range?db=${database}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ IncCustRebateId: incCustRebateId, RangeNo: rangeNo, MinQty: parseInt(range.min) || 0, MaxQty: parseInt(range.max) || 0, RebatePerBag: parseFloat(range.rebate) || 0, db: 'VAN' }),
            });
            if (!rr.ok) { const t = await rr.text(); throw new Error(`Failed range: ${t}`); }
            rangeNo++;
          }
        }
      }
    }
    for (const item of items) {
      if (!item.code || !item.name) continue;
      const originalCreated = itemCreatedMap[item.code] || null;
      const ir = await fetch(`${API_BASE}/inc-item-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, ItemCode: item.code, ItemName: item.name, UnitPerQty: parseInt(item.unitPerQty) || 0, UnitOfMeasure: item.unitOfMeasure || '', CreatedDate: originalCreated, db: 'VAN' }),
      });
      if (!ir.ok) { const t = await ir.text(); throw new Error(`Failed item: ${t}`); }
      const iResult      = await ir.json();
      const itemRebateId = iResult.id;
      if (item.ranges && Object.keys(item.ranges).length > 0) {
        for (const [, ranges] of Object.entries(item.ranges)) {
          let rangeNo = 1;
          for (const range of ranges) {
            const rr = await fetch(`${API_BASE}/inc-item-range?db=${database}`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ItemRebateId: itemRebateId, RangeNo: rangeNo, MinQty: parseInt(range.min) || 0, MaxQty: parseInt(range.max) || 0, RebatePerBag: parseFloat(range.rebate) || 0, db: 'VAN' }),
            });
            if (!rr.ok) { const t = await rr.text(); throw new Error(`Failed item range: ${t}`); }
            rangeNo++;
          }
        }
      }
    }
  };

  const savePercentageRebateData = async (rebateCodeId, database, customerCreatedMap = {}, itemCreatedMap = {}) => {
    for (const customer of customers) {
      if (!customer.code || !customer.name) continue;
      const originalCreated = customerCreatedMap[customer.code] || null;
      const custRes = await fetch(`${API_BASE}/per-cust-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, CardCode: customer.code, CardName: customer.name, CreatedDate: originalCreated, db: 'VAN' }),
      });
      if (!custRes.ok) { const t = await custRes.text(); throw new Error(`Failed: ${t}`); }
      const custResult      = await custRes.json();
      const perCustRebateId = custResult.id;
      if (quotaType === "withQuota" && customer.percentages && customer.percentages.length > 0) {
        const monthlyPeriods    = getMonthlyPeriodsFromQuotaPeriods();
        const percentagesToSave = [];
        for (let i = 0; i < monthlyPeriods.length; i++) {
          const monthName = monthlyPeriods[i]?.label || `Month ${i + 1}`;
          const val       = customer.percentages[i] || "";
          if (val !== "" && val !== null) {
            const pv = parseFloat(val);
            if (!isNaN(pv)) percentagesToSave.push({ Month: monthName, TargetQty: pv });
          }
        }
        if (percentagesToSave.length > 0) {
          const bulkRes = await fetch(`${API_BASE}/per-cust-quotas/bulk?db=${database}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ CustRebateId: perCustRebateId, quotas: percentagesToSave, db: 'VAN' }),
          });
          if (!bulkRes.ok) {
            for (const p of percentagesToSave) {
              await fetch(`${API_BASE}/per-cust-quota?db=${database}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ PerCustRebateId: perCustRebateId, Month: p.Month, TargetQty: p.TargetQty, db: 'VAN' }),
              });
            }
          }
        }
      }
    }
    for (const item of items) {
      if (!item.code || !item.name) continue;
      const originalCreated = itemCreatedMap[item.code] || null;
      const ir = await fetch(`${API_BASE}/per-prod-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, ItemCode: item.code, ItemName: item.name, UnitPerQty: parseFloat(item.unitPerQty) || 0, PercentagePerBag: parseFloat(item.percentagePerBag) || 0, UnitOfMeasure: item.unitOfMeasure || '', CreatedDate: originalCreated, db: 'VAN' }),
      });
      if (!ir.ok) { const t = await ir.text(); throw new Error(`Failed item: ${t}`); }
    }
  };

  const handleAddCustomer = () => {
    if (!access.canEdit) { showToast("You do not have permission to add customers", "error"); return; }
    setCurrentEditingRow({ type: 'customer', index: null });
    setTempSelectedCustomers([]);
    setIsCustomerModalOpen(true);
  };

  const handleAddItem = () => {
    if (!access.canEdit) { showToast("You do not have permission to add items", "error"); return; }
    setCurrentEditingRow({ type: 'item', index: null });
    setTempSelectedItems([]);
    setIsItemModalOpen(true);
  };

  const handleQtrRebateChange = (index, value) => {
    const newData = [...customers];
    if (value === "" || /^-?\d*$/.test(value)) { newData[index].qtrRebate = value; setCustomers(newData); }
  };

  const handleRebatePerBagChange = (index, value) => {
    const newData = [...items];
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) { newData[index].rebatePerBag = value; setItems(newData); }
  };

  const handlePercentagePerBagChange = (index, value) => {
    const newData = [...items];
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
      const n = parseFloat(value);
      if ((n >= 0 && n <= 100) || value === "" || value === "0") { newData[index].percentagePerBag = value; }
      setItems(newData);
    }
  };

    const handleDeleteCustomer = (index) => {
    if (!access.canEdit) { 
      showToast("You do not have permission to delete customers", "error"); 
      return; 
    }
    if (customers.length <= 1) { 
      showToast("At least one customer is required", "warning"); 
      return; 
    }
    // Open the remove modal instead of confirmModal
    setRemoveCustomerModal({ 
      isOpen: true, 
      index: index, 
      name: customers[index]?.name || "" 
    });
  };

  const handleDeleteItem = (index) => {
    if (!access.canEdit) { 
      showToast("You do not have permission to delete items", "error"); 
      return; 
    }
    if (items.length <= 1) { 
      showToast("At least one item is required", "warning"); 
      return; 
    }
    // Open the remove modal instead of confirmModal
    setRemoveItemModal({ 
      isOpen: true, 
      index: index, 
      name: items[index]?.name || "" 
    });
  };

  // Add these confirmation functions:
  const confirmDeleteCustomer = () => {
    const { index } = removeCustomerModal;
    setCustomers(customers.filter((_, i) => i !== index));
    showToast("Customer deleted successfully", "success");
    setRemoveCustomerModal({ isOpen: false, index: null, name: "" });
  };

  const confirmDeleteItem = () => {
    const { index } = removeItemModal;
    setItems(items.filter((_, i) => i !== index));
    showToast("Item deleted successfully", "success");
    setRemoveItemModal({ isOpen: false, index: null, name: "" });
  };

  const confirmAction = () => {
    const { action, data } = confirmModal;
    if (action === 'deleteCustomer') { setCustomers(customers.filter((_, i) => i !== data)); showToast("Customer deleted successfully", "success"); }
    else if (action === 'deleteItem') { setItems(items.filter((_, i) => i !== data)); showToast("Item deleted successfully", "success"); }
    setConfirmModal({ isOpen: false, action: null, data: null });
  };

  const handleReset = () => setConfirmModal({ isOpen: true, action: 'reset', data: null, title: "Reset Form", message: "Are you sure you want to reset all data? This action cannot be undone." });

  const resetForm = () => {
    setRebateType(""); setQuotaType("withQuota"); setCustomers([]); setItems([]);
    setSelectedSalesEmployee(""); setSelectedDateFrom(""); setSelectedDateTo(""); setSelectedFrequency("");
    setQuotaCount(0); setQuotaPeriods([]); setImportedCustomerQuotas({});
    setRebateCode("REB-"); setEditingRows({ customer: {}, item: {} });
    setSelectedName(""); setRebateCode("REB-"); setEditingRows({ customer: {}, item: {} });
    setIsViewMode(false); setLoadedRebateCode("");
    showToast("Form reset successfully", "success");
    setConfirmModal({ isOpen: false, action: null, data: null });
  };

  const getProductRangeSummary = (product) => {
    if (quotaType === "withoutQuota") return "Rebate";
    if (rebateType === "Incremental") return `Rebate Ranges`;
    if (rebateType === "Percentage")  return product.percentagePerBag ? `${product.percentagePerBag}%` : "Not set";
    return product.rebatePerBag ? `${product.rebatePerBag}/bag` : "Not set";
  };

  const getQuotaTypeDisplay = () => quotaType === "withQuota" ? "With Quota" : "Without Quota";

  // ── Shared style helpers ─────────────────────────────────────────────────────
  const inputClass = `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all min-h-[42px] ${
    isDark
      ? 'bg-slate-800/60 border-slate-700 text-slate-200 placeholder-slate-600 focus:border-blue-500/60 focus:ring-blue-500/10'
      : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:ring-blue-100'
  }`;
  const selectClass = `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all min-h-[42px] appearance-none ${
    isDark
      ? 'bg-slate-800/60 border-slate-700 text-slate-200 focus:border-blue-500/60 focus:ring-blue-500/10'
      : 'bg-white border-slate-200 text-slate-800 focus:border-blue-400 focus:ring-blue-100'
  }`;
  const labelClass = `block text-xs font-semibold uppercase tracking-widest mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`;

  const getRebateTypeBadge = (type) => {
    if (type === 'Fixed')       return isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'         : 'bg-blue-50 border-blue-200 text-blue-700';
    if (type === 'Incremental') return isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
    if (type === 'Percentage')  return isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'       : 'bg-amber-50 border-amber-200 text-amber-700';
    return '';
  };

  const renderAccessLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className={`w-10 h-10 rounded-full border-2 border-t-transparent animate-spin ${isDark ? 'border-blue-400' : 'border-blue-500'}`} />
      <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Verifying access…</p>
    </div>
  );

  const renderAccessDenied = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
        <Lock size={28} className={isDark ? 'text-red-400' : 'text-red-500'} />
      </div>
      <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Access Restricted</h2>
      <p className={`max-w-xs text-sm mb-6 leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        You don't have permission to view this page.
        {accessError && <span className="block mt-1 text-xs opacity-60">Error: {accessError}</span>}
      </p>
      <Link to="/HomePage"
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
        Go to Home
      </Link>
    </div>
  );

  const pageBg  = isDark ? 'bg-[#0a0f1a]' : 'bg-slate-100';
  const cardBg  = isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/80';
  const divider = isDark ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className={`flex h-screen w-full font-sans ${pageBg} text-slate-900 overflow-hidden`}>
      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown} setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown} setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />
      <main className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"}`}>
        <Header collapsed={collapsed} userName={userName} userCode={userCode} initials={initials} logo={vanLogo} theme={theme} />

        <div className={`pt-16 flex-1 flex flex-col overflow-hidden ${pageBg}`}>
          {/* ─── Main card with drag‑and‑drop handlers ──────────────────── */}
          <div
            className={`rounded-2xl border shadow-xl ${cardBg} flex flex-col flex-1 overflow-hidden relative`}
            style={{ margin: '1rem 1.5rem', maxWidth: 'calc(100% - 3rem)' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag‑and‑drop overlay */}
            {isDragOver && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm rounded-2xl pointer-events-none">
                <div className={`px-6 py-4 rounded-xl shadow-lg border ${isDark ? 'bg-slate-800 border-blue-700' : 'bg-white border-blue-300'}`}>
                  <p className={`font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    Drop your Excel file here
                  </p>
                </div>
              </div>
            )}

            {/* ── Top bar ── */}
            <div className={`flex items-center justify-between px-6 py-3.5 border-b flex-shrink-0 ${divider}`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isViewMode
                    ? isDark ? 'bg-amber-500/15 border border-amber-500/25' : 'bg-amber-50 border border-amber-200'
                    : isDark ? 'bg-blue-500/15 border border-blue-500/25'   : 'bg-blue-50 border border-blue-200'
                }`}>
                  {isViewMode
                    ? <PenLine className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                    : <SettingsIcon className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  }
                </div>
                <div>
                  <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isViewMode ? 'Edit Rebate Program' : 'Rebate Program Setup'}
                  </h1>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    {isViewMode
                      ? 'Loaded record — changes will UPDATE the existing program'
                      : 'Configure rebate program parameters and targets'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => { setSearchCode(""); setSearchError(""); setSearchModal({ isOpen: true }); }}
                  className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl transition-all border ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
                  }`}
                  title="Search rebate code (Ctrl+F)"
                >
                  <Search size={14} />
                  <span>Search</span>
                  <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                    Ctrl+F
                  </kbd>
                </button>

                {!accessLoading && access.canView && (
                  <button
                    onClick={handleRefreshData}
                    disabled={loading}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400 hover:bg-slate-700'
                        : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 shadow-sm'
                    } disabled:opacity-40`}
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  </button>
                )}
              </div>
            </div>

            {/* ── Body ── */}
            <div className="px-6 py-4 flex flex-col flex-1 overflow-hidden">
              {accessLoading
                ? renderAccessLoading()
                : !access.canView
                  ? renderAccessDenied()
                  : (
                    <>
                      {/* ── Edit mode banner ── */}
                      {isViewMode && (
                        <div className={`mb-3 px-3 py-2 rounded-xl border flex items-center justify-between gap-4 flex-shrink-0 ${
                          isDark
                            ? 'bg-amber-500/8 border-amber-500/20 text-amber-300'
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 animate-pulse ${isDark ? 'bg-amber-400' : 'bg-amber-500'}`} />
                            <p className="text-sm font-medium flex flex-wrap items-center gap-2">
                              <span className={isDark ? 'text-slate-400' : 'text-amber-700'}>Editing:</span>
                              <code className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-200/60 text-amber-900'}`}>
                                {loadedRebateCode}
                              </code>
                              <span className={`text-xs font-normal ${isDark ? 'text-slate-500' : 'text-amber-600'}`}>
                                — any import or manual change will update this record on save
                              </span>
                            </p>
                          </div>
                          <button
                            onClick={() => { setIsViewMode(false); resetForm(); }}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors flex-shrink-0 ${
                              isDark
                                ? 'border-amber-600/40 hover:bg-amber-500/10 text-amber-400'
                                : 'border-amber-300 hover:bg-amber-100 text-amber-700'
                            }`}
                          >
                            Clear &amp; New
                          </button>
                        </div>
                      )}

                      {/* ── Header fields ── */}
                      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3 mb-3 pb-3 border-b flex-shrink-0 ${divider}`}>

                        {/* Rebate Code */}
                        <div>
                          <label className={labelClass}>Rebate Code</label>
                          <div className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl min-h-[42px] ${
                            isViewMode
                              ? isDark ? 'bg-amber-500/8 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                              : isDark ? 'bg-slate-800/40 border-slate-700'   : 'bg-slate-50 border-slate-200'
                          }`}>
                            {isViewMode && <PenLine className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />}
                            <span className={`font-mono font-semibold text-sm truncate ${
                              isViewMode
                                ? isDark ? 'text-amber-300' : 'text-amber-800'
                                : isDark ? 'text-slate-300' : 'text-slate-700'
                            }`}>{isViewMode ? loadedRebateCode : rebateCode}</span>
                          </div>
                        </div>

                        {/* Rebate Type */}
                        <div>
                          <label className={labelClass}>Rebate Type</label>
                          <div className="relative">
                            <select
                              className={`${selectClass} pr-9 font-medium ${rebateType ? `border ${getRebateTypeBadge(rebateType)}` : ''} ${!access.canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              value={rebateType}
                              onChange={(e) => { if (access.canEdit) setRebateType(e.target.value); }}
                              disabled={!access.canEdit}
                            >
                              <option value="">Select Type</option>
                              <option value="Fixed">Fixed Rate</option>
                              <option value="Incremental">Incremental Rate</option>
                              {/*<option value="Percentage">Percentage Rebate</option>*/}
                            </select>
                            <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          </div>
                        </div>

                        {/* Name */}
                        <div>
                          <label className={labelClass}>Name</label>
                          <div className="relative">
                            <select
                              className={`${selectClass} pr-9 ${!access.canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                              value={selectedName}
                              onChange={(e) => { if (access.canEdit) setSelectedName(e.target.value); }}
                              disabled={!access.canEdit}
                            >
                              <option value="">Select Name</option>
                              {REBATE_NAME_OPTIONS.map((name, i) => (
                                <option key={i} value={name}>{name}</option>
                              ))}
                            </select>
                            <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          </div>
                        </div>

                        {/* Sales Employee */}
                        <div>
                          <label className={labelClass}>Sales Employee</label>
                          <div className="relative">
                            <select
                              className={`${selectClass} pr-9 ${!access.canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                              value={selectedSalesEmployee}
                              onChange={(e) => { if (access.canEdit) setSelectedSalesEmployee(e.target.value); }}
                              disabled={loading || !access.canEdit}
                            >
                              <option value="">{loading ? "Loading…" : "Select Employee"}</option>
                              {salesEmployeeOptions.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
                            </select>
                            <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          </div>
                        </div>

                        {/* Date From */}
                        <div>
                          <label className={labelClass}>Date From</label>
                          <input type="date"
                            className={`${inputClass} ${!access.canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                            value={selectedDateFrom}
                            onChange={(e) => { if (access.canEdit) setSelectedDateFrom(e.target.value); }}
                            disabled={!access.canEdit}
                          />
                        </div>

                        {/* Date To */}
                        <div>
                          <label className={labelClass}>Date To</label>
                          <input type="date"
                            className={`${inputClass} ${!access.canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                            value={selectedDateTo}
                            onChange={(e) => { if (access.canEdit) setSelectedDateTo(e.target.value); }}
                            disabled={!access.canEdit}
                          />
                        </div>

                        {/* Frequency */}
                        <div>
                          <label className={labelClass}>Frequency</label>
                          <div className="relative">
                            <select
                              className={`${selectClass} pr-9 ${!access.canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                              value={selectedFrequency}
                              onChange={(e) => { if (access.canEdit) setSelectedFrequency(e.target.value); }}
                              disabled={!access.canEdit}
                            >
                              <option value="">Select Frequency</option>
                              <option value="N/A">N/A</option>
                              <option value="Monthly">Monthly</option>
                              <option value="Quarterly">Quarterly</option>
                            </select>
                            <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          </div>
                        </div>

                        {/* Quota Type */}
                        <div>
                          <label className={labelClass}>Quota Type</label>
                          <div className="relative">
                            <select
                              className={`${selectClass} pr-9 ${!access.canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                              value={quotaType}
                              onChange={(e) => { if (access.canEdit) handleQuotaTypeChange(e.target.value); }}
                              disabled={!access.canEdit}
                            >
                              <option value="withQuota">With Quota</option>
                              <option value="withoutQuota">Without Quota</option>
                            </select>
                            <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          </div>
                        </div>
                      </div>

                      {/* ── Quota type indicator ── */}
                      <div className={`mb-3 px-3 py-2 rounded-xl border flex items-center gap-3 flex-shrink-0 ${
                        quotaType === "withQuota"
                          ? isDark ? 'bg-blue-500/8 border-blue-500/20' : 'bg-blue-50 border-blue-200'
                          : isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${quotaType === "withQuota" ? 'bg-blue-500' : isDark ? 'bg-slate-600' : 'bg-slate-400'}`} />
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold text-xs ${
                            quotaType === "withQuota"
                              ? isDark ? 'text-blue-300' : 'text-blue-700'
                              : isDark ? 'text-slate-300' : 'text-slate-700'
                          }`}>
                            {quotaType === "withQuota" ? "With Quota Program" : "Without Quota Program"}
                          </p>
                          <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>—</span>
                          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            {quotaType === "withQuota"
                              ? "Customers will have individual quota targets for each period."
                              : "No quota targets assigned; performance relies on system-generated values."}
                          </p>
                        </div>
                      </div>

                      {/* ── Tab bar + Import/Export ── */}
                      <div className={`flex items-center justify-between mb-3 border-b flex-shrink-0 ${divider}`}>
                        <div className="flex gap-1">
                          {["Customer", "Items"].map(tab => (
                            <button key={tab}
                              className={`px-5 py-3 font-semibold text-sm transition-all flex items-center gap-2.5 relative ${
                                activeTab === tab
                                  ? isDark ? 'text-blue-400' : 'text-blue-600'
                                  : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                              }`}
                              onClick={() => setActiveTab(tab)}
                            >
                              {tab === "Customer" ? <Users className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                              <span>
                                {tab === "Customer"
                                  ? (rebateType === "Incremental" ? "Customer Ranges" : rebateType === "Percentage" ? "Customer Percentages" : "Customer Quotas")
                                  : (rebateType === "Incremental" ? "Product Ranges"  : rebateType === "Percentage" ? "Product Setup"        : "Product Rebates")
                                }
                              </span>
                              {activeTab === tab && (
                                <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${isDark ? 'bg-blue-500' : 'bg-blue-600'}`} />
                              )}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2 items-center pb-0.5">
                          <label
                            className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border transition-all cursor-pointer ${
                              access.canEdit
                                ? isDark
                                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
                                : 'opacity-40 cursor-not-allowed border-transparent bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}
                            title={!access.canEdit ? 'No import permission' : isViewMode ? `Import will update ${loadedRebateCode}` : 'Import Excel'}
                          >
                            {!access.canEdit ? <Lock size={14} /> : <Upload size={14} />}
                            {isViewMode ? 'Import & Update' : 'Import'}
                            <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" disabled={!access.canEdit} />
                          </label>

                          <button
                            onClick={handleDownload}
                            disabled={!access.canExport}
                            title={!access.canExport ? 'No export permission' : 'Export to Excel'}
                            className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border transition-all ${
                              access.canExport
                                ? isDark
                                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
                                : 'opacity-40 cursor-not-allowed border-transparent bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {!access.canExport ? <Lock size={14} /> : <Download size={14} />}
                            Export
                          </button>
                        </div>
                      </div>

                      {/* ── Customer tab ── */}
                      {activeTab === "Customer" && (
                        <div className="flex flex-col flex-1 overflow-hidden">
                          <div className="flex items-center gap-3 mb-2 flex-shrink-0">
                            <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                              {rebateType === "Incremental" ? "Customer Rebate Ranges" : rebateType === "Percentage" ? "Customer Percentage Setup" : "Customer Quota Setup"}
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-100 text-slate-600'}`}>
                              {customers.length}
                            </span>
                            {quotaType === "withQuota" && quotaPeriods.length > 0 && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                {quotaPeriods.length} period{quotaPeriods.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>

                          <div className={`rounded-xl border overflow-hidden flex-1 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                            <div className="overflow-auto h-full" style={{ maxHeight: 'calc(100vh - 430px)' }}>
                              <table className="w-full border-collapse text-sm">
                                <thead className={`sticky top-0 z-10 ${isDark ? 'bg-slate-800/90' : 'bg-slate-50'}`}>
                                  <tr>
                                    {["Customer Code", "Customer Name",
                                      ...(rebateType === "Fixed" || rebateType === "Incremental" ? ["Qtr Rebate"] : []),
                                      quotaType === "withQuota" ? "Period" : "Status",
                                      "Actions"
                                    ].map(h => (
                                      <th key={h} className={`px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-b ${isDark ? 'text-slate-500 border-slate-700/60' : 'text-slate-500 border-slate-200'}`}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {customers.length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className={`px-5 py-16 text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                        <div className="flex flex-col items-center gap-2">
                                          <Users className="w-7 h-7 opacity-30" />
                                          <span className="text-sm">No customers added yet</span>
                                          <span className="text-xs opacity-60">Click "Add Customer" to get started</span>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : customers.map((c, idx) => (
                                    <tr key={idx} className={`border-b last:border-b-0 transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50/80'}`}>
                                      <td className="px-5 py-3.5">
                                        <code className={`font-mono text-xs font-medium px-2 py-1 rounded-lg ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                          {c.code || "—"}
                                        </code>
                                      </td>
                                      <td className="px-5 py-3.5">
                                        {isRowEditable('customer', idx) ? (
                                          <button onClick={() => handleOpenCustomerModal(idx)}
                                            className={`flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm transition-all w-72 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-sm'}`}>
                                            <span className="truncate text-left">{c.name || "Select Customer"}</span>
                                            <Users className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                                          </button>
                                        ) : (
                                          <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{c.name || "—"}</span>
                                        )}
                                      </td>
                                      {(rebateType === "Fixed" || rebateType === "Incremental") && (
                                        <td className="px-5 py-3.5">
                                          {isRowEditable('customer', idx) ? (
                                            <input type="text" value={c.qtrRebate || ""} onChange={(e) => handleQtrRebateChange(idx, e.target.value)} placeholder="0"
                                              className={`w-28 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}
                                              disabled={!access.canEdit}
                                            />
                                          ) : (
                                            <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{c.qtrRebate || "—"}</span>
                                          )}
                                        </td>
                                      )}
                                      <td className="px-5 py-3.5">
                                        {quotaType === "withQuota" ? (
                                          <button onClick={() => openQuotaModal(idx)}
                                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                                              rebateType === "Percentage" ? (isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100')
                                              : rebateType === "Incremental" ? (isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100')
                                              : (isDark ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100')
                                            }`}>
                                            <Target className="w-3.5 h-3.5" />
                                            <span>{rebateType === "Incremental" && Object.keys(c.ranges || {}).length > 0 ? `Range/s` : "Set Targets"}</span>
                                          </button>
                                        ) : (
                                          <span className={`flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                            <CheckCircle className="w-3.5 h-3.5" /> No Quota
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-5 py-3.5">
                                        <div className="flex gap-1.5">
                                          <button
                                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                                              isRowEditable('customer', idx)
                                                ? (isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100')
                                                : (isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')
                                            } ${!access.canEdit ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            onClick={() => { if (access.canEdit) toggleRowEdit('customer', idx); }}
                                          >
                                            {isRowEditable('customer', idx) ? <Save size={13} /> : <Edit size={13} />}
                                          </button>
                                          <button
                                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'} ${!access.canEdit ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            onClick={() => handleDeleteCustomer(idx)}
                                          >
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

                      {/* ── Items tab ── */}
                      {activeTab === "Items" && (
                        <div className="flex flex-col flex-1 overflow-hidden">
                          <div className="flex items-center gap-3 mb-2 flex-shrink-0">
                            <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                              {rebateType === "Incremental" ? "Product Setup" : rebateType === "Percentage" ? "Product Setup" : "Product Rebate Configuration"}
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-100 text-slate-600'}`}>
                              {items.length}
                            </span>
                          </div>

                          <div className={`rounded-xl border overflow-hidden flex-1 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                            <div className="overflow-auto h-full" style={{ maxHeight: 'calc(100vh - 430px)' }}>
                              <table className="w-full border-collapse text-sm min-w-[600px]">
                                <thead className={`sticky top-0 z-10 ${isDark ? 'bg-slate-800/90' : 'bg-slate-50'}`}>
                                  <tr>
                                    {[
                                      "Item Code",
                                      "Item Name",
                                      "Qty",
                                      "Unit of Measure",
                                      // Rebate column only for Fixed or Percentage
                                      ...(rebateType === "Percentage"
                                        ? ["% Per Bag"]
                                        : rebateType === "Incremental"
                                        ? []          // ← removed for Incremental
                                        : ["Rebate per Unit"]
                                      ),
                                      "Actions"
                                    ].map(h => (
                                      <th key={h} className={`px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-b ${isDark ? 'text-slate-500 border-slate-700/60' : 'text-slate-500 border-slate-200'}`}>
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.length === 0 ? (
                                    <tr>
                                      <td colSpan={rebateType === "Incremental" ? 5 : 6} className={`px-5 py-16 text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                        <div className="flex flex-col items-center gap-2">
                                          <Package className="w-7 h-7 opacity-30" />
                                          <span className="text-sm">No items added yet</span>
                                          <span className="text-xs opacity-60">Click "Add Item" to get started</span>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    items.map((item, idx) => (
                                      <tr key={idx} className={`border-b last:border-b-0 transition-colors ${isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50/80'}`}>
                                        {/* Item Code */}
                                        <td className="px-5 py-3.5">
                                          <code className={`font-mono text-xs font-medium px-2 py-1 rounded-lg ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                            {item.code || "—"}
                                          </code>
                                        </td>

                                        {/* Item Name */}
                                        <td className="px-5 py-3.5">
                                          {isRowEditable('item', idx) ? (
                                            <button
                                              onClick={() => handleOpenItemModal(idx)}
                                              className={`flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm transition-all w-full min-w-[200px] ${
                                                isDark
                                                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-sm'
                                              }`}
                                            >
                                              <span className="text-left whitespace-normal">{item.name || "Select Item"}</span>
                                              <Package className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                                            </button>
                                          ) : (
                                            <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.name || "—"}</span>
                                          )}
                                        </td>

                                        {/* Qty */}
                                        <td className="px-5 py-3.5">
                                          {isRowEditable('item', idx) ? (
                                            <input
                                              type="text"
                                              value={item.unitPerQty || ""}
                                              onChange={(e) => { const nd = [...items]; nd[idx].unitPerQty = e.target.value; setItems(nd); }}
                                              placeholder="Qty"
                                              className={`w-28 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}
                                              disabled={!access.canEdit}
                                            />
                                          ) : (
                                            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{item.unitPerQty || "—"}</span>
                                          )}
                                        </td>

                                        {/* Unit of Measure */}
                                        <td className="px-5 py-3.5">
                                          {isRowEditable('item', idx) ? (
                                            <div className="relative">
                                              <select
                                                value={item.unitOfMeasure || ''}
                                                onChange={(e) => {
                                                  const nd = [...items];
                                                  nd[idx].unitOfMeasure = e.target.value;
                                                  setItems(nd);
                                                }}
                                                disabled={!access.canEdit}
                                                className={`w-32 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none pr-8 ${
                                                  isDark
                                                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                                                    : 'bg-white border-slate-200 text-slate-800'
                                                } ${!access.canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                              >
                                                <option value="">Select UOM</option>
                                                {UOM_OPTIONS.map(u => (
                                                  <option key={u} value={u}>{u}</option>
                                                ))}
                                              </select>
                                              <ChevronDown className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                            </div>
                                          ) : (
                                            <span className={`text-xs px-2 py-1 rounded-lg font-medium font-mono ${
                                              item.unitOfMeasure
                                                ? isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                                                : isDark ? 'text-slate-600' : 'text-slate-400'
                                            }`}>
                                              {item.unitOfMeasure || '—'}
                                            </span>
                                          )}
                                        </td>

                                        {/* ─── Rebate column ─── */}
                                        {rebateType === "Percentage" && (
                                          <td className="px-5 py-3.5">
                                            {isRowEditable('item', idx) ? (
                                              <div className="relative w-32">
                                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>%</span>
                                                <input
                                                  type="text"
                                                  value={item.percentagePerBag || ""}
                                                  onChange={(e) => handlePercentagePerBagChange(idx, e.target.value)}
                                                  placeholder="0.00"
                                                  className={`w-full pl-7 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}
                                                  disabled={!access.canEdit}
                                                />
                                              </div>
                                            ) : (
                                              <span className={`text-sm font-medium ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                                                {item.percentagePerBag ? `${item.percentagePerBag}%` : "—"}
                                              </span>
                                            )}
                                          </td>
                                        )}

                                        {rebateType === "Fixed" && (
                                          <td className="px-5 py-3.5">
                                            <div className="w-36">
                                              {isRowEditable('item', idx) ? (
                                                <div className="relative">
                                                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>₱</span>
                                                  <input
                                                    type="text"
                                                    value={item.rebatePerBag || ""}
                                                    onChange={(e) => handleRebatePerBagChange(idx, e.target.value)}
                                                    placeholder="0.00"
                                                    className={`w-full pl-7 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}
                                                    disabled={!access.canEdit}
                                                  />
                                                </div>
                                              ) : (
                                                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                  {item.rebatePerBag ? `₱${item.rebatePerBag}${item.unitOfMeasure ? `/${item.unitOfMeasure}` : '/bag'}` : "—"}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        )}
                                        {/* ─── end rebate column ─── */}

                                        {/* Actions */}
                                        <td className="px-5 py-3.5">
                                          <div className="flex gap-1.5">
                                            <button
                                              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                                                isRowEditable('item', idx)
                                                  ? (isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100')
                                                  : (isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')
                                              } ${!access.canEdit ? 'opacity-30 cursor-not-allowed' : ''}`}
                                              onClick={() => { if (access.canEdit) toggleRowEdit('item', idx); }}
                                            >
                                              {isRowEditable('item', idx) ? <Save size={13} /> : <Edit size={13} />}
                                            </button>
                                            <button
                                              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'} ${!access.canEdit ? 'opacity-30 cursor-not-allowed' : ''}`}
                                              onClick={() => handleDeleteItem(idx)}
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Bottom action bar ── */}
                      <div className={`flex justify-between items-center pt-3 mt-auto border-t flex-shrink-0 ${divider}`}>
                        <div className="flex gap-2">
                          {activeTab === "Customer" && (
                            <button onClick={handleAddCustomer} disabled={!access.canEdit}
                              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                                access.canEdit
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              }`}>
                              {!access.canEdit ? <Lock size={14} /> : <Users size={14} />} Add Customer
                            </button>
                          )}
                          {activeTab === "Items" && (
                            <button onClick={handleAddItem} disabled={!access.canEdit}
                              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                                access.canEdit
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              }`}>
                              {!access.canEdit ? <Lock size={14} /> : <Package size={14} />} Add Item
                            </button>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => setCancelModal(true)}
                            className={`flex items-center gap-2 px-4 py-2.5 border text-sm font-medium rounded-xl transition-all ${isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                            <X size={14} /> Cancel
                          </button>
                          {isViewMode ? (
                            <button
                              onClick={handleUpdate}
                              disabled={!access.canEdit}
                              title={!access.canEdit ? 'No edit permission' : `Update ${loadedRebateCode}`}
                              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                                access.canEdit
                                  ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-900/20'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {!access.canEdit ? <Lock size={14} /> : <PenLine size={14} />}
                              Update {loadedRebateCode}
                            </button>
                          ) : (
                            <button
                              onClick={handleSave}
                              disabled={!access.canCreate}
                              title={!access.canCreate ? 'No create permission' : 'Save Rebate Setup'}
                              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                                access.canCreate
                                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {!access.canCreate ? <Lock size={14} /> : <Save size={14} />}
                              Save Program
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )
              }
            </div>
          </div>
        </div>
      </main>

      {/* ── Modals ── */}
      <CustomerSelectionModal isOpen={isCustomerModalOpen} onClose={() => { setIsCustomerModalOpen(false); setTempSelectedCustomers([]); setCurrentEditingRow({ type: null, index: null }); }} customers={customersDropdown} selectedCustomers={tempSelectedCustomers} onConfirm={handleCustomerSelectionConfirm} theme={theme} />
      <ItemSelectionModal isOpen={isItemModalOpen} onClose={() => { setIsItemModalOpen(false); setTempSelectedItems([]); setCurrentEditingRow({ type: null, index: null }); }} items={itemsDropdown} selectedItems={tempSelectedItems} onConfirm={handleItemSelectionConfirm} theme={theme} />
      <PercentageModal isOpen={percentageModal.isOpen} onClose={closePercentageModal} customer={percentageModal.customer} onSave={(arr) => handleSavePercentages(percentageModal.customer?.index, arr)} quotaPeriods={quotaPeriods} selectedFrequency={selectedFrequency} theme={theme} />
      <QuotaModal isOpen={quotaModal.isOpen} onClose={closeQuotaModal} customer={quotaModal.customer} onSave={(q) => handleSaveQuotas(quotaModal.customer.index, q)} quotaPeriods={quotaPeriods} importedQuotas={quotaModal.importedQuotas} rebateType={rebateType} quotaType={quotaType} selectedFrequency={selectedFrequency} theme={theme} />
      <RangeModal isOpen={rangeModal.isOpen} onClose={closeRangeModal} customer={rangeModal.customer} onSave={(r) => handleSaveRanges(rangeModal.customer.index, r)} quotaPeriods={quotaPeriods} rebateType={rebateType} quotaType={quotaType} theme={theme} />
      <ProductRangeModal isOpen={productRangeModal.isOpen} onClose={closeProductRangeModal} product={productRangeModal.product} onSave={(r) => handleSaveProductRanges(productRangeModal.product.index, r)} quotaPeriods={quotaPeriods} rebateType={rebateType} quotaType={quotaType} theme={theme} />
      <SearchRebateModal isOpen={searchModal.isOpen} onClose={() => setSearchModal({ isOpen: false })} searchCode={searchCode} setSearchCode={setSearchCode} onSearch={handleSearchRebateCode} searchLoading={searchLoading} searchError={searchError} theme={theme} canView={access.canView} />
      <ToastContainer toasts={toasts} removeToast={removeToast} isDark={isDark} />
      {loading && <Loading theme={theme} />}
      <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, action: null, data: null })} onConfirm={confirmModal.action === 'reset' ? resetForm : confirmAction} title={confirmModal.title} message={confirmModal.message} />
      <DuplicationError isOpen={duplicationError.isOpen} onClose={() => setDuplicationError({ isOpen: false, type: null, data: null })} type={duplicationError.type} data={duplicationError.data} theme={theme} />
      <CancelModal
      isOpen={cancelModal}
      onClose={() => setCancelModal(false)}
      onConfirm={() => { resetForm(); setCancelModal(false); }}
      theme={theme}
      />
    <RemoveRow 
      isOpen={removeCustomerModal.isOpen}
      onClose={() => setRemoveCustomerModal({ isOpen: false, index: null, name: "" })}
      onConfirm={confirmDeleteCustomer}
      title="Delete Customer"
      message={`Are you sure you want to delete "${removeCustomerModal.name}"? This action cannot be undone.`}
      theme={theme}
    />

    <RemoveRow 
      isOpen={removeItemModal.isOpen}
      onClose={() => setRemoveItemModal({ isOpen: false, index: null, name: "" })}
      onConfirm={confirmDeleteItem}
      title="Delete Item"
      message={`Are you sure you want to delete "${removeItemModal.name}"? This action cannot be undone.`}
      theme={theme}
    />
    </div>
  );
}

export default Van_RebateSetup;