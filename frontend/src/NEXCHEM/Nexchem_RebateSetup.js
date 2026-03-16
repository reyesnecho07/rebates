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
} from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import nexchemLogo from "../assets/nexchem.png";
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

// ─── Utilities ────────────────────────────────────────────────────────────────
const safeObjectValues = (obj) => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.values(obj);
};
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
const Toast = ({ message, type, onClose }) => {
  const bgColor = {
    success: "bg-green-50 border-green-200 text-green-800",
    error:   "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info:    "bg-blue-50 border-blue-200 text-blue-800",
  };
  const iconColor = {
    success: "text-green-600", error: "text-red-600",
    warning: "text-yellow-600", info: "text-blue-600",
  };
  const icons = {
    success: <CheckCircle className="w-5 h-5" />, error: <X className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />, info: <Info className="w-5 h-5" />,
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${bgColor[type]} animate-slide-in-right`}>
      <div className={iconColor[type]}>{icons[type]}</div>
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose} className={`ml-2 hover:opacity-70 transition-opacity ${iconColor[type]}`}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
const ToastContainer = ({ toasts, removeToast }) => (
  <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
    {toasts.map((toast) => (
      <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
    ))}
  </div>
);

// ─── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-auto shadow-xl border border-gray-100">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-gray-600 text-sm mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg transition-all duration-200 font-medium border border-gray-200 hover:border-gray-300 text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Search Rebate Modal ──────────────────────────────────────────────────────
const SearchRebateModal = ({ isOpen, onClose, searchCode, setSearchCode, onSearch, searchLoading, searchError, theme }) => {
  const [allCodes, setAllCodes]       = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef  = useRef(null);
  const dropRef   = useRef(null);

  // Fetch all codes when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setCodesLoading(true);
    fetch('http://192.168.100.193:3006/api/rebate-program/all-codes?db=NEXCHEM_OWN')
      .then(r => r.json())
      .then(d => { if (d.success) setAllCodes(d.codes || []); })
      .catch(() => {})
      .finally(() => setCodesLoading(false));
  }, [isOpen]);

  // Close dropdown on outside click
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

  // Filter codes based on input
  const filtered = useMemo(() => {
    const q = searchCode.trim().toUpperCase();
    if (!q) return allCodes.slice(0, 50); // show latest 50 when empty
    return allCodes.filter(c =>
      c.RebateCode.toUpperCase().includes(q) ||
      (c.SlpName  && c.SlpName.toUpperCase().includes(q)) ||
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
    if (type === 'Fixed')       return theme === 'dark' ? 'bg-blue-900/40 text-blue-300'   : 'bg-blue-100 text-blue-700';
    if (type === 'Incremental') return theme === 'dark' ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700';
    if (type === 'Percentage')  return theme === 'dark' ? 'bg-orange-900/40 text-orange-300': 'bg-orange-100 text-orange-700';
    return theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl p-6 w-full max-w-md mx-auto shadow-xl border ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
      }`}>
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
              Search Rebate Code
            </h3>
            <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Type or pick a rebate code to load and edit
            </p>
          </div>
          <button onClick={onClose} className={`transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input + dropdown wrapper */}
        <div className="mb-5 relative">
          <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wider ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Rebate Code
          </label>

          {/* Input row */}
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={searchCode}
              onChange={e => { setSearchCode(e.target.value.toUpperCase()); setShowDropdown(true); }}
              onKeyDown={e => {
                if (e.key === 'Enter')  { setShowDropdown(false); onSearch(); }
                if (e.key === 'Escape') { if (showDropdown) setShowDropdown(false); else onClose(); }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const first = dropRef.current?.querySelector('[data-suggestion]');
                  first?.focus();
                }
              }}
              placeholder="e.g. REB-00001"
              className={`w-full px-4 py-3 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono tracking-wide ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
            {/* Chevron / spinner toggle */}
            <button
              type="button"
              onClick={() => setShowDropdown(v => !v)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {codesLoading
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <svg className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              }
            </button>
          </div>

          {/* Dropdown */}
          {showDropdown && !codesLoading && (
            <div
              ref={dropRef}
              className={`absolute z-50 left-0 right-0 mt-1 rounded-xl border shadow-2xl overflow-hidden ${
                theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
              }`}
              style={{ maxHeight: '260px', overflowY: 'auto' }}
            >
              {filtered.length === 0 ? (
                <div className={`px-4 py-6 text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                  No matching rebate codes found
                </div>
              ) : (
                <>
                  {/* Count pill */}
                  <div className={`px-3 py-2 text-xs font-semibold border-b sticky top-0 ${
                    theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'
                  }`}>
                    {filtered.length} code{filtered.length !== 1 ? 's' : ''} {searchCode.trim() ? 'matched' : 'available'}
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
                        theme === 'dark'
                          ? 'border-gray-700 hover:bg-gray-700 focus:bg-gray-700'
                          : 'border-gray-50 hover:bg-blue-50 focus:bg-blue-50'
                      } ${searchCode.trim().toUpperCase() === item.RebateCode ? (theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50') : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Code */}
                        <span className={`font-mono font-bold text-sm flex-shrink-0 ${
                          theme === 'dark' ? 'text-gray-100' : 'text-gray-800'
                        }`}>
                          {/* Highlight matching chars */}
                          {searchCode.trim()
                            ? (() => {
                                const q   = searchCode.trim().toUpperCase();
                                const str = item.RebateCode;
                                const idx = str.toUpperCase().indexOf(q);
                                if (idx === -1) return str;
                                return (
                                  <>
                                    {str.slice(0, idx)}
                                    <span className={theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}>{str.slice(idx, idx + q.length)}</span>
                                    {str.slice(idx + q.length)}
                                  </>
                                );
                              })()
                            : item.RebateCode
                          }
                        </span>
                        {/* Meta */}
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {item.SlpName || '—'}
                          </span>
                          {(item.DateFrom || item.DateTo) && (
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                              {formatDate(item.DateFrom)} – {formatDate(item.DateTo)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Type badge */}
                      {item.RebateType && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${typeColor(item.RebateType)}`}>
                          {item.RebateType}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Error */}
          {searchError && (
            <p className="mt-2 text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {searchError}
            </p>
          )}
        </div>

        {/* Hint */}
        <div className={`mb-5 p-3 rounded-lg border ${
          theme === 'dark' ? 'bg-blue-900/20 border-blue-700/50 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          <p className="text-xs flex items-center gap-2">
            <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold ${
              theme === 'dark' ? 'bg-blue-800 text-blue-200' : 'bg-blue-200 text-blue-800'
            }`}>Ctrl+F</kbd>
            <span>Open anytime · <span className="opacity-75">↑↓ to navigate · Enter to select</span></span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className={`px-4 py-2.5 rounded-lg transition-all font-medium border text-sm ${
            theme === 'dark' ? 'text-gray-300 hover:bg-gray-700 border-gray-600' : 'text-gray-700 hover:bg-gray-50 border-gray-200'
          }`}>
            Cancel
          </button>
          <button
            onClick={() => { setShowDropdown(false); onSearch(); }}
            disabled={searchLoading || !searchCode.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 rounded-lg transition-all font-medium shadow-md hover:shadow-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searchLoading ? "Searching…" : "Load & Edit"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
function Nexchem_RebateSetup() {
  const location = useLocation();
  const { theme, updateTheme } = useTheme();
  const routePath = '/Nexchem_RebateSetup';

  // ── Access control ──────────────────────────────────────────────────────────
  const { access, accessLoading, accessError } = useAccessControl(routePath);

  // ── Core state ──────────────────────────────────────────────────────────────
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [collapsed, setCollapsed]                     = useState(false);
  const [activeNav, setActiveNav]                     = useState("/rebatesetup");
  const [activeTab, setActiveTab]                     = useState("Customer");
  const [rebateType, setRebateType]                   = useState("");
  const [quotaType, setQuotaType]                     = useState("withQuota");
  const [showVanDropdown, setShowVanDropdown]         = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(true);
  const [showVcpDropdown, setShowVcpDropdown]         = useState(false);
  const [toasts, setToasts]                           = useState([]);
  const [loading, setLoading]                         = useState(false);
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

  // ── Search / Edit-mode state ────────────────────────────────────────────────
  const [searchModal, setSearchModal]     = useState({ isOpen: false });
  const [searchCode, setSearchCode]       = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError]     = useState("");
  // isViewMode = true  → a record was loaded; Save button will UPDATE instead of CREATE
  const [isViewMode, setIsViewMode]       = useState(false);
  // The rebate code that was originally loaded — never overwritten by imports
  const [loadedRebateCode, setLoadedRebateCode] = useState("");

  const API_BASE = 'http://192.168.100.193:3006/api';
  const DB_NAME  = 'USER';

  // ── Memoized options ────────────────────────────────────────────────────────
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

  // ── Toast helpers ───────────────────────────────────────────────────────────
  const showToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Component registration ──────────────────────────────────────────────────
  const componentMetadata = {
    name: 'Nexchem_RebateSetup',
    version: '2.0.0',
    description: 'Rebate configuration module for creating rebate programs, linking customers and items, and defining computation rules and validity periods.',
    routePath: '/Nexchem_RebateSetup',
  };
  useComponentRegistration(componentMetadata);

  // ── Effects ─────────────────────────────────────────────────────────────────
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

  // ── Ctrl+F keyboard shortcut ────────────────────────────────────────────────
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

  // ── Rebate code generation (CREATE only) ────────────────────────────────────
  const generateNextRebateCode = async () => {
    try {
      const response = await fetch(`${API_BASE}/rebate-program/highest-code?db=NEXCHEM_OWN`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.nextCode) return data.nextCode;
      }
      return getFallbackRebateCode();
    } catch { return getFallbackRebateCode(); }
  };
  const getFallbackRebateCode = () => {
    const storageKey = `lastRebateCode_NEXCHEM_OWN`;
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

  // ── Period calculation ──────────────────────────────────────────────────────
  const calculateQuotaPeriods = () => {
    const startDate = new Date(selectedDateFrom);
    const endDate   = new Date(selectedDateTo);
    const periods   = [];
    if (selectedFrequency === "Monthly") {
      let currentDate = new Date(startDate);
      let periodNumber = 1;
      while (currentDate <= endDate) {
        const periodStart = new Date(currentDate);
        const periodEnd   = new Date(currentDate);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(periodEnd.getDate() - 1);
        const actualEnd = periodEnd > endDate ? endDate : periodEnd;
        periods.push({
          period: `Month ${periodNumber}`, label: `Month ${periodNumber}`,
          startDate: new Date(periodStart), endDate: new Date(actualEnd),
          dates: `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${actualEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        });
        periodNumber++;
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }
    } else if (selectedFrequency === "Quarterly") {
      let quarterStart = new Date(startDate);
      const startMonth = quarterStart.getMonth();
      if      (startMonth < 3) quarterStart.setMonth(0);
      else if (startMonth < 6) quarterStart.setMonth(3);
      else if (startMonth < 9) quarterStart.setMonth(6);
      else                     quarterStart.setMonth(9);
      quarterStart.setDate(1);
      while (quarterStart <= endDate) {
        const periodStart  = new Date(quarterStart);
        const periodEnd    = new Date(quarterStart);
        periodEnd.setMonth(periodEnd.getMonth() + 3);
        periodEnd.setDate(periodEnd.getDate() - 1);
        const actualEnd    = periodEnd > endDate ? endDate : periodEnd;
        const quarterNames = ["Q1", "Q2", "Q3", "Q4"];
        const quarterIndex = Math.floor(periodStart.getMonth() / 3);
        const quarterName  = quarterNames[quarterIndex];
        const year         = periodStart.getFullYear();
        periods.push({
          period: `${quarterName} ${year}`, label: `${quarterName} ${year}`,
          startDate: new Date(periodStart), endDate: new Date(actualEnd),
          dates: `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${actualEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          quarter: quarterName, year,
        });
        quarterStart.setMonth(quarterStart.getMonth() + 3);
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

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchSalesEmployees = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/sync/local/sales-employees?db=NEXCHEM_OWN`);
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
      const res  = await fetch(`${API_BASE}/sync/local/customers?db=NEXCHEM_OWN`);
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
      const res  = await fetch(`${API_BASE}/sync/local/items?db=NEXCHEM_OWN`);
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
        body: JSON.stringify({ sourceDatabase: 'NEXCHEM', targetDatabase: 'NEXCHEM_OWN', tables: ['salesEmployees', 'customers', 'items'] }),
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

  // ── Search rebate code ──────────────────────────────────────────────────────
  const handleSearchRebateCode = async () => {
    const code = searchCode.trim().toUpperCase();
    if (!code) { setSearchError("Please enter a rebate code."); return; }
    setSearchLoading(true);
    setSearchError("");
    try {
      const res = await fetch(`${API_BASE}/rebate-program/by-code/${encodeURIComponent(code)}?db=NEXCHEM_OWN`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.program) {
        setSearchError(`Rebate code "${code}" not found.`);
        setSearchLoading(false);
        return;
      }
      const prog = data.program;

      // Populate header fields
      setRebateCode(prog.RebateCode);
      setLoadedRebateCode(prog.RebateCode); // lock this in
      setRebateType(prog.RebateType);
      setSelectedSalesEmployee(prog.SlpName);
      setSelectedDateFrom(prog.DateFrom ? prog.DateFrom.slice(0, 10) : "");
      setSelectedDateTo(prog.DateTo     ? prog.DateTo.slice(0, 10)   : "");
      setSelectedFrequency(prog.Frequency || "");
      setQuotaType(prog.QuotaType === "With Quota" ? "withQuota" : "withoutQuota");

      // Fetch customers
      const custRes = await fetch(
        `${API_BASE}/rebate-program/customers/${encodeURIComponent(code)}?db=NEXCHEM_OWN&type=${encodeURIComponent(prog.RebateType)}`
      );
      if (custRes.ok) {
        const custData = await custRes.json();
        if (custData.success && Array.isArray(custData.customers)) {
        const mapped = custData.customers.map(c => {
          // Fixed & Percentage: flat array of quota values for QuotaModal
          const quotaArr = Array.isArray(c.quotas)
            ? c.quotas.map(q => String(q.TargetQty ?? ""))
            : [];

          // Incremental: RangeModal expects { 0: [{min,max,rebate}], 1: [...], ... }
          // Backend returns c.ranges as a flat array from IncCustRange
          let rangesObj = {};
          if (Array.isArray(c.ranges) && c.ranges.length > 0) {
            // Group by RangeNo isn't useful here — all ranges belong to period 0
            // if you have multi-period, the backend groups by period; for now map to period 0
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
            quotas:      quotaArr,          // QuotaModal reads this as flat array
            percentages: prog.RebateType === "Percentage" ? quotaArr : [],
            ranges:      rangesObj,         // RangeModal reads this as { 0:[...], 1:[...] }
          };
        });
          setCustomers(mapped);
          const state = {};
          mapped.forEach((_, i) => { state[i] = false; });
          setEditingRows(prev => ({ ...prev, customer: state }));
        }
      }

      // Fetch items
      const itemRes = await fetch(
        `${API_BASE}/rebate-program/items/${encodeURIComponent(code)}?db=NEXCHEM_OWN&type=${encodeURIComponent(prog.RebateType)}`
      );
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        if (itemData.success && Array.isArray(itemData.items)) {
        const mapped = itemData.items.map(i => {
          // ProductRangeModal expects { 0: [{min,max,rebate}], 1: [...], ... }
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
            code:             i.ItemCode          || "",
            name:             i.ItemName          || "",
            unitPerQty:       i.UnitPerQty     != null ? String(i.UnitPerQty)        : "",
            rebatePerBag:     i.RebatePerBag   != null ? String(i.RebatePerBag)      : "",
            percentagePerBag: i.PercentagePerBag != null ? String(i.PercentagePerBag): "",
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

  // ── Excel Import/Export ─────────────────────────────────────────────────────
  const handleImportExcel = async (event) => {
    if (!access.canEdit) { showToast("You do not have permission to import data", "error"); return; }
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/)) { showToast("Please select a valid Excel file (.xlsx or .xls)", "error"); return; }
    setLoading(true);

    // Remember the currently-loaded rebate code before import potentially clobbers it
    const preservedCode         = isViewMode ? loadedRebateCode : null;
    const preservedIsViewMode   = isViewMode;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data     = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        if (workbook.SheetNames.length === 0) throw new Error("No sheets found in Excel file");
        let customerDataImported = false, itemDataImported = false;
        let importedCustomers = [], importedItems = [];
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData  = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (jsonData.length > 0) {
            // Only extract header info when NOT in view/edit mode
            // (we don't want the Excel's rebate code to override the loaded one)
            if (!preservedIsViewMode) {
              extractHeaderInfoFromData(jsonData);
            }
            const sheetLower = sheetName.toLowerCase();
            if (sheetLower.includes('customer')) {
              let dataStartRow = 0;
              for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (Array.isArray(row) && row[0] === "Customer Code" && row[1] === "Customer Name") { dataStartRow = i + 1; break; }
              }
              if (dataStartRow > 0) {
                const result = processCustomerDataSimple(jsonData.slice(dataStartRow));
                importedCustomers = result.importedCustomers;
                if (importedCustomers.length > 0) {
                  setCustomers(importedCustomers);
                  const state = {};
                  importedCustomers.forEach((_, idx) => { state[idx] = false; });
                  setEditingRows(prev => ({ ...prev, customer: state }));
                  customerDataImported = true;
                }
              }
            } else if (sheetLower.includes('item')) {
              let dataStartRow = 0;
              for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (Array.isArray(row) && row[0] === "Item Code" && row[1] === "Item Name") { dataStartRow = i + 1; break; }
              }
              if (dataStartRow > 0) {
                importedItems = processItemDataSimple(jsonData.slice(dataStartRow));
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

        // Restore the loaded rebate code if we're in view/edit mode
        if (preservedIsViewMode && preservedCode) {
          setRebateCode(preservedCode);
          setLoadedRebateCode(preservedCode);
          setIsViewMode(true);
        }

        if (!customerDataImported && !itemDataImported) {
          showToast("No valid customer or item data found in the Excel file", "warning");
        } else {
          const msgs = [];
          if (customerDataImported) msgs.push(`${importedCustomers.length} customers`);
          if (itemDataImported)     msgs.push(`${importedItems.length} items`);
          const suffix = preservedIsViewMode ? ` (editing ${preservedCode})` : '';
          showToast(`Successfully imported ${msgs.join(' and ')}${suffix}`, "success");
        }
      } catch (error) {
        showToast(`Import failed: ${error.message}`, "error");
        // Restore even on error
        if (preservedIsViewMode && preservedCode) {
          setRebateCode(preservedCode);
          setLoadedRebateCode(preservedCode);
          setIsViewMode(true);
        }
      } finally { setLoading(false); }
    };
    reader.onerror = () => { setLoading(false); showToast("Error reading file. Please try again.", "error"); };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const processCustomerDataSimple = (excelData) => {
    try {
      if (excelData.length === 0) { showToast("No customer data found in sheet", "warning"); return { importedCustomers: [], importedQuotasMap: {} }; }
      const importedCustomers = [], skippedCustomers = [];
      excelData.forEach((row) => {
        const rowArray  = Array.isArray(row) ? row : [row];
        const codeValue = rowArray[0] !== undefined ? String(rowArray[0]).trim() : "";
        const nameValue = rowArray[1] !== undefined ? String(rowArray[1]).trim() : "";
        if (!codeValue && !nameValue) return;
        const customerExists = customersDropdown.some(c => c.CardCode === codeValue || c.CardName === nameValue);
        if (!customerExists) { skippedCustomers.push({ code: codeValue, name: nameValue }); return; }
        const customerData = customersDropdown.find(c => c.CardCode === codeValue || c.CardName === nameValue);
        // If we're in edit/view mode, try to carry over existing quota/range data for this customer
        const existingCustomer = isViewMode
          ? customers.find(ec => ec.code === (customerData?.CardCode || codeValue))
          : null;

        importedCustomers.push({
          code:        customerData?.CardCode || codeValue,
          name:        customerData?.CardName || nameValue,
          quotas:      existingCustomer?.quotas      ?? (quotaType === "withQuota" ? Array(quotaCount).fill("") : []),
          percentages: existingCustomer?.percentages ?? (quotaType === "withQuota" ? Array(quotaCount).fill("") : []),
          ranges:      existingCustomer?.ranges      ?? {},
          qtrRebate:   existingCustomer?.qtrRebate   ?? "",
        });
      });
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
      if (excelData.length === 0) { showToast("No item data found in sheet", "warning"); return []; }
      const dataRows = excelData.filter(row =>
        Array.isArray(row) && row.length >= 2 &&
        row.some((cell, i) => i < 2 && cell && String(cell).trim() !== '')
      );
      const importedItems = [], skippedItems = [];
      dataRows.forEach((row) => {
        const rowArray        = Array.isArray(row) ? row : [row];
        const codeValue       = rowArray[0] !== undefined ? String(rowArray[0]).trim() : "";
        const nameValue       = rowArray[1] !== undefined ? String(rowArray[1]).trim() : "";
        const qtyValue        = rowArray[2] !== undefined ? String(rowArray[2]).trim() : "";
        const percentageValue = rowArray[3] !== undefined ? String(rowArray[3]).trim() : "";
        if (!codeValue && !nameValue) return;
        const itemExists = itemsDropdown.some(i => i.ItemCode === codeValue || i.ItemName === nameValue);
        if (!itemExists) { skippedItems.push({ code: codeValue, name: nameValue }); return; }
        const itemData = itemsDropdown.find(i => i.ItemCode === codeValue || i.ItemName === nameValue);
        importedItems.push({
          code:             itemData?.ItemCode || codeValue,
          name:             itemData?.ItemName || nameValue,
          unitPerQty:       qtyValue || "",
          rebatePerBag:     "",
          percentagePerBag: rebateType === "Percentage" ? percentageValue || "" : "",
          ranges:           {},
        });
      });
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
      const workbook    = XLSX.utils.book_new();
      let hasData       = false;
      const headerLabels = ["Rebate Code","Sales Employee","Date From","Date To","Frequency","Quota Type","Rebate Type"];
      const headerValues = [rebateCode, selectedSalesEmployee || "", selectedDateFrom || "", selectedDateTo || "", selectedFrequency || "", getQuotaTypeDisplay(), rebateType || ""];
      const customerData = customers.filter(c => c.code && c.name).map(c => [c.code || '', c.name || '']);
      if (customerData.length > 0) {
        const wsData = [headerLabels, headerValues, [], ["Customer Code", "Customer Name"], ...customerData];
        const ws     = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols']  = [{ wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, ws, 'Customers');
        hasData = true;
      }
      const itemData = items.filter(i => i.code && i.name).map(i => [
        i.code || '', i.name || '', i.unitPerQty || '',
        rebateType === "Percentage" ? (i.percentagePerBag || '') : (i.rebatePerBag || ''),
      ]);
      if (itemData.length > 0) {
        const itemsHeader = rebateType === "Percentage"
          ? ["Item Code","Item Name","Qty","Percentage Per Bag"]
          : ["Item Code","Item Name","Qty","Rebate Per Bag"];
        const wsData = [headerLabels, headerValues, [], itemsHeader, ...itemData];
        const ws     = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols']  = [{ wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, ws, 'Items');
        hasData = true;
      }
      if (!hasData) { showToast("No data to export!", "warning"); return; }
      const dateFromF = selectedDateFrom ? selectedDateFrom.replace(/-/g, '') : 'NODATE';
      const dateToF   = selectedDateTo   ? selectedDateTo.replace(/-/g, '')   : 'NODATE';
      const rtF       = rebateType       ? rebateType.toUpperCase()           : 'NOTYPE';
      const fileName  = `REBATE_${rtF}_${dateFromF}_${dateToF}_NEXCHEM.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast(`Data exported successfully!`, "success");
    } catch {
      showToast('Error exporting data to Excel.', "error");
    }
  };
  const handleDownload = () => handleExportExcel();

  // ── Customer modal handlers ─────────────────────────────────────────────────
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

  // ── Item modal handlers ─────────────────────────────────────────────────────
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
        newItems[index] = {
          ...newItems[index],
          code:             selected.ItemCode || selected.code || '',
          name:             selected.ItemName || selected.name || '',
          unitPerQty:       newItems[index].unitPerQty || '',
          rebatePerBag:     newItems[index].rebatePerBag || '',
          percentagePerBag: newItems[index].percentagePerBag || '',
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
            newItems.push({ code, name: si.ItemName || si.name || '', unitPerQty: "", rebatePerBag: "", percentagePerBag: "", ranges: {} });
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

  // ── Modal openers ───────────────────────────────────────────────────────────
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

  // ── Sub-save handlers ───────────────────────────────────────────────────────
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

  // ── Period helpers ──────────────────────────────────────────────────────────
  const getMonthlyPeriodsFromQuotaPeriods = () => {
    if (quotaPeriods && quotaPeriods.length > 0) {
      const monthlyPeriods = [];
      quotaPeriods.forEach((qp) => {
        if (qp.startDate && qp.endDate) {
          const sd = new Date(qp.startDate), ed = new Date(qp.endDate);
          let current = new Date(sd);
          while (current <= ed) {
            const ms  = new Date(current), me = new Date(current);
            me.setMonth(me.getMonth() + 1); me.setDate(0);
            const ae  = me > ed ? ed : me;
            const mn  = ms.toLocaleDateString('en-US', { month: 'long' });
            const yr  = ms.getFullYear();
            monthlyPeriods.push({ period: `${mn} ${yr}`, label: mn, startDate: new Date(ms), endDate: new Date(ae), dates: `${ms.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${ae.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, month: mn, year: yr, quarter: qp.quarter, quarterPeriod: qp.period });
            current.setMonth(current.getMonth() + 1); current.setDate(1);
          }
        }
      });
      return monthlyPeriods;
    }
    if (selectedDateFrom && selectedDateTo && selectedFrequency) {
      const periods = [], sd = new Date(selectedDateFrom), ed = new Date(selectedDateTo);
      const mNames  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      let cur = new Date(sd);
      while (cur <= ed) {
        const mn = mNames[cur.getMonth()], yr = cur.getFullYear();
        periods.push({ period: `${mn} ${yr}`, label: mn, month: mn, year: yr, dates: `${mn} ${yr}` });
        cur.setMonth(cur.getMonth() + 1);
      }
      return periods;
    }
    return [];
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ── UPDATE (edit mode) ────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
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
      const salesEmployee = Array.isArray(salesEmployees)
        ? salesEmployees.find(emp => emp.SlpName === selectedSalesEmployee)
        : null;
      const slpCode = salesEmployee ? salesEmployee.SlpCode : null;
      if (!slpCode) throw new Error("Sales employee code not found");

      // 1. Update the program header
      const progRes = await fetch(`${API_BASE}/rebate-program/${encodeURIComponent(codeToUpdate)}?db=NEXCHEM_OWN`, {
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
          db:          'NEXCHEM_OWN',
        }),
      });
      if (!progRes.ok) { const t = await progRes.text(); throw new Error(`Failed to update program header: ${t}`); }

      // 2. Delete existing child records, then re-insert
      const delRes = await fetch(`${API_BASE}/rebate-program/${encodeURIComponent(codeToUpdate)}/details?db=NEXCHEM_OWN&type=${encodeURIComponent(rebateType)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!delRes.ok) {
        const t = await delRes.text();
        throw new Error(`Failed to clear existing details: ${t}`);
      }

      // 3. Re-insert with the same rebate code
      if      (rebateType === "Fixed")       await saveFixedRebateData(codeToUpdate, 'NEXCHEM_OWN');
      else if (rebateType === "Incremental") await saveIncrementalRebateData(codeToUpdate, 'NEXCHEM_OWN');
      else if (rebateType === "Percentage")  await savePercentageRebateData(codeToUpdate, 'NEXCHEM_OWN');

      // Rebate code stays the same — do not reset it
      showToast(`✅ Rebate program "${codeToUpdate}" updated successfully!`, "success");
      setEditingRows({ customer: {}, item: {} });
    } catch (error) {
      showToast(`Failed to update rebate setup: ${error.message}`, "error");
    } finally { setLoading(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ── CREATE (new mode) ─────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
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

      // Duplicate program check
      const dupCheckRes = await fetch(`${API_BASE}/rebate-program/check-duplicate-program`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateType: rebateType, SlpCode: slpCode, DateFrom: selectedDateFrom, DateTo: selectedDateTo, db: 'NEXCHEM_OWN' }),
      });
      if (!dupCheckRes.ok) throw new Error(`Server returned status ${dupCheckRes.status}`);
      const dupCheckResult = await dupCheckRes.json();
      if (dupCheckResult.success && dupCheckResult.exists) {
        setDuplicationError({ isOpen: true, type: 'duplicateProgram', data: { program: dupCheckResult.program } });
        showToast(`⚠️ Duplicate rebate program detected`, "error");
        setLoading(false);
        return;
      }

      // Item conflict check
      const duplicateItems = [];
      for (const item of validItems) {
        try {
          const res = await fetch(`${API_BASE}/rebate-program/check-item-conflict`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ RebateType: rebateType, SlpCode: slpCode, DateFrom: selectedDateFrom, DateTo: selectedDateTo, Frequency: selectedFrequency, ItemCode: item.code, db: 'NEXCHEM_OWN' }),
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
      }

      // Generate code and save
      const newRebateCode     = await generateNextRebateCode();
      const rebateProgramData = {
        RebateType: rebateType, SlpCode: slpCode, SlpName: selectedSalesEmployee,
        DateFrom: selectedDateFrom, DateTo: selectedDateTo, Frequency: selectedFrequency,
        QuotaType: quotaType === "withQuota" ? "With Quota" : "Without Quota", db: 'NEXCHEM_OWN',
      };
      const programRes = await fetch(`${API_BASE}/rebate-program?db=NEXCHEM_OWN`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rebateProgramData),
      });
      if (!programRes.ok) { const t = await programRes.text(); throw new Error(`Failed to save rebate program: ${t}`); }
      const programResult = await programRes.json();
      const rebateCodeId  = programResult.rebateCode;

      if      (rebateType === "Fixed")       await saveFixedRebateData(rebateCodeId, 'NEXCHEM_OWN');
      else if (rebateType === "Incremental") await saveIncrementalRebateData(rebateCodeId, 'NEXCHEM_OWN');
      else if (rebateType === "Percentage")  await savePercentageRebateData(rebateCodeId, 'NEXCHEM_OWN');

      setRebateCode(rebateCodeId);
      showToast(`✅ Rebate setup saved successfully! ID: ${rebateCodeId}`, "success");
      setEditingRows({ customer: { 0: true }, item: { 0: true } });
    } catch (error) {
      showToast(`Failed to save rebate setup: ${error.message}`, "error");
    } finally { setLoading(false); }
  };

  // ── Save type-specific data ─────────────────────────────────────────────────
  const saveFixedRebateData = async (rebateCodeId, database) => {
    for (const customer of customers) {
      if (!customer.code || !customer.name) continue;
      const custRes = await fetch(`${API_BASE}/fix-cust-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, CardCode: customer.code, CardName: customer.name, QtrRebate: customer.qtrRebate || 0, db: 'NEXCHEM_OWN' }),
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
                body: JSON.stringify({ Id: nextQuotaId++, CustRebateId: custRebateId, Month: monthName, TargetQty: val, db: 'NEXCHEM_OWN' }),
              });
              if (!qr.ok) console.error(`Failed to save quota for ${monthName}`);
            }
          }
        }
      }
    }
    for (const item of items) {
      if (!item.code || !item.name) continue;
      const ir = await fetch(`${API_BASE}/fix-prod-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, ItemCode: item.code, ItemName: item.name, UnitPerQty: parseFloat(item.unitPerQty) || 0, RebatePerBag: parseFloat(item.rebatePerBag) || 0, db: 'NEXCHEM_OWN' }),
      });
      if (!ir.ok) { const t = await ir.text(); throw new Error(`Failed to save item ${item.code}: ${t}`); }
    }
  };
  const saveIncrementalRebateData = async (rebateCodeId, database) => {
    for (const customer of customers) {
      if (!customer.code || !customer.name) continue;
      const custRes = await fetch(`${API_BASE}/inc-cust-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, CardCode: customer.code, CardName: customer.name, QtrRebate: customer.qtrRebate || 0, db: 'NEXCHEM_OWN' }),
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
              body: JSON.stringify({ IncCustRebateId: incCustRebateId, RangeNo: rangeNo, MinQty: parseInt(range.min) || 0, MaxQty: parseInt(range.max) || 0, RebatePerBag: parseFloat(range.rebate) || 0, db: 'NEXCHEM_OWN' }),
            });
            if (!rr.ok) { const t = await rr.text(); throw new Error(`Failed range: ${t}`); }
            rangeNo++;
          }
        }
      }
    }
    for (const item of items) {
      if (!item.code || !item.name) continue;
      const ir = await fetch(`${API_BASE}/inc-item-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, ItemCode: item.code, ItemName: item.name, UnitPerQty: parseInt(item.unitPerQty) || 0, db: 'NEXCHEM_OWN' }),
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
              body: JSON.stringify({ ItemRebateId: itemRebateId, RangeNo: rangeNo, MinQty: parseInt(range.min) || 0, MaxQty: parseInt(range.max) || 0, RebatePerBag: parseFloat(range.rebate) || 0, db: 'NEXCHEM_OWN' }),
            });
            if (!rr.ok) { const t = await rr.text(); throw new Error(`Failed item range: ${t}`); }
            rangeNo++;
          }
        }
      }
    }
  };
  const savePercentageRebateData = async (rebateCodeId, database) => {
    for (const customer of customers) {
      if (!customer.code || !customer.name) continue;
      const custRes = await fetch(`${API_BASE}/per-cust-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, CardCode: customer.code, CardName: customer.name, db: 'NEXCHEM_OWN' }),
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
            body: JSON.stringify({ CustRebateId: perCustRebateId, quotas: percentagesToSave, db: 'NEXCHEM_OWN' }),
          });
          if (!bulkRes.ok) {
            for (const p of percentagesToSave) {
              await fetch(`${API_BASE}/per-cust-quota?db=${database}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ PerCustRebateId: perCustRebateId, Month: p.Month, TargetQty: p.TargetQty, db: 'NEXCHEM_OWN' }),
              });
            }
          }
        }
      }
    }
    for (const item of items) {
      if (!item.code || !item.name) continue;
      const ir = await fetch(`${API_BASE}/per-prod-rebate?db=${database}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RebateCode: rebateCodeId, ItemCode: item.code, ItemName: item.name, UnitPerQty: parseFloat(item.unitPerQty) || 0, PercentagePerBag: parseFloat(item.percentagePerBag) || 0, db: 'NEXCHEM_OWN' }),
      });
      if (!ir.ok) { const t = await ir.text(); throw new Error(`Failed item: ${t}`); }
    }
  };

  // ── Row CRUD helpers ────────────────────────────────────────────────────────
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
    if (!access.canEdit) { showToast("You do not have permission to delete customers", "error"); return; }
    if (customers.length <= 1) { showToast("At least one customer is required", "warning"); return; }
    setConfirmModal({ isOpen: true, action: 'deleteCustomer', data: index, title: "Delete Customer", message: "Are you sure you want to delete this customer?" });
  };
  const handleDeleteItem = (index) => {
    if (!access.canEdit) { showToast("You do not have permission to delete items", "error"); return; }
    if (items.length <= 1) { showToast("At least one item is required", "warning"); return; }
    setConfirmModal({ isOpen: true, action: 'deleteItem', data: index, title: "Delete Item", message: "Are you sure you want to delete this item?" });
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
    setIsViewMode(false); setLoadedRebateCode("");
    showToast("Form reset successfully", "success");
    setConfirmModal({ isOpen: false, action: null, data: null });
  };

  // ── Display helpers ─────────────────────────────────────────────────────────
  const getProductRangeSummary = (product) => {
    if (quotaType === "withoutQuota") return "Rebate";
    if (rebateType === "Incremental") return `${quotaPeriods.length} periods`;
    if (rebateType === "Percentage")  return product.percentagePerBag ? `${product.percentagePerBag}%` : "Not set";
    return product.rebatePerBag ? `${product.rebatePerBag}/bag` : "Not set";
  };
  const getQuotaTypeDisplay = () => quotaType === "withQuota" ? "With Quota" : "Without Quota";

  // ── Access gate renderers ───────────────────────────────────────────────────
  const renderAccessLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mb-4 ${theme === 'dark' ? 'border-blue-400' : 'border-blue-500'}`} />
      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Checking permissions...</p>
    </div>
  );
  const renderAccessDenied = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-red-900/30 border border-red-700/40' : 'bg-red-50 border border-red-200'}`}>
        <Lock size={36} className={theme === 'dark' ? 'text-red-400' : 'text-red-500'} />
      </div>
      <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>Access Restricted</h2>
      <p className={`max-w-md text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        You don't have permission to view this page.
        {accessError && <span className="block mt-2 text-xs opacity-75">Error: {accessError}</span>}
      </p>
      <Link to="/HomePage" className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
        Go to HomePage
      </Link>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50 font-poppins text-slate-900">
      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown} setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown} setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${collapsed ? "ml-20" : "ml-64"}`}>
        <Header collapsed={collapsed} userName={userName} userCode={userCode} initials={initials} logo={nexchemLogo} theme={theme} />
        <div className={`pt-16 flex-1 p-8 overflow-auto ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`}>
          <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border ${theme === 'dark' ? 'border-gray-700/50' : 'border-white/50'} shadow-2xl p-8 w-full max-w-[1600px] mx-auto mt-6`}>

            {/* ── Title bar ── */}
            <div className={`flex items-center justify-between mb-8 pb-6 border-b ${theme === 'dark' ? 'border-blue-700' : 'border-blue-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow ${
                  isViewMode
                    ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                    : 'bg-gradient-to-br from-blue-500 to-blue-600'
                }`}>
                  {isViewMode ? <PenLine className="w-5 h-5 text-white" /> : <SettingsIcon className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h1 className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>
                    {isViewMode ? `Editing Rebate Program` : 'Rebate Program Setup'}
                  </h1>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {isViewMode
                      ? `Loaded record — changes will UPDATE the existing program`
                      : 'Configure your rebate program parameters and targets'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Search / Ctrl+F */}
              <button
                  onClick={() => { setSearchCode(""); setSearchError(""); setSearchModal({ isOpen: true }); }}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${
                    theme === 'dark' ? 'bg-blue-700 hover:bg-blue-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                  title="Search rebate code (Ctrl+F)"
                >
                  <Search size={16} />
                  <span className="hidden sm:inline">Search</span>
                  <kbd className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono ${
                    theme === 'dark' ? 'bg-blue-800 text-blue-200' : 'bg-blue-400 text-white'
                  }`}>Ctrl+F</kbd>
                </button>
                {/* Refresh */}
                {!accessLoading && access.canView && (
                  <button
                    onClick={handleRefreshData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  </button>
                )}
              </div>
            </div>

            {/* ── Access gate ── */}
            {accessLoading
              ? renderAccessLoading()
              : !access.canView
                ? renderAccessDenied()
                : (
                  <>
                    {/* ── Edit-mode banner ── */}
                    {isViewMode && (
                      <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between gap-4 ${
                        theme === 'dark'
                          ? 'bg-amber-900/20 border-amber-700 text-amber-300'
                          : 'bg-amber-50 border-amber-300 text-amber-800'
                      }`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0 ${theme === 'dark' ? 'bg-amber-400' : 'bg-amber-500'}`} />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm flex flex-wrap items-center gap-2">
                              <span>Editing:</span>
                              <span className={`font-mono px-2 py-0.5 rounded text-xs font-bold ${
                                theme === 'dark' ? 'bg-amber-800/60 text-amber-200' : 'bg-amber-200 text-amber-900'
                              }`}>{loadedRebateCode}</span>
                              <span className={`text-xs font-normal opacity-75`}>
                                — any import or manual change will update this record on save
                              </span>
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => { setIsViewMode(false); resetForm(); }}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors flex-shrink-0 ${
                            theme === 'dark'
                              ? 'border-amber-600 hover:bg-amber-800/40 text-amber-300'
                              : 'border-amber-400 hover:bg-amber-100 text-amber-800'
                          }`}
                        >
                          Clear &amp; New
                        </button>
                      </div>
                    )}

                    {/* ── Rebate type selector ── */}
                    <div className={`mb-8 pb-8 border-b ${theme === 'dark' ? 'border-blue-700' : 'border-blue-200'}`}>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {[
                          { key: "Fixed",       icon: <LocateFixed className={`w-6 h-6 ${rebateType === "Fixed" ? "text-white" : theme === 'dark' ? "text-gray-400" : "text-gray-500"}`} />, color: "blue",   title: "Fixed Rebate",       desc: "Standard fixed rebate amounts per period", bullets: ["Fixed rebate amounts for each period","Consistent targets throughout the program","Simple and predictable rebate structure"] },
                          { key: "Incremental", icon: <TrendingUp  className={`w-6 h-6 ${rebateType === "Incremental" ? "text-white" : theme === 'dark' ? "text-gray-400" : "text-gray-500"}`} />, color: "green",  title: "Incremental Rebate", desc: "Progressive rebates with quarterly ranges", bullets: ["Different ranges for each quarter/period","Copy ranges between periods easily","Flexible structure for seasonal variations"] },
                          { key: "Percentage",  icon: <Percent     className={`w-6 h-6 ${rebateType === "Percentage" ? "text-white" : theme === 'dark' ? "text-gray-400" : "text-gray-500"}`} />, color: "orange", title: "Percentage Rebate",  desc: "Percentage-based rebates per period",      bullets: ["Percentage rebates based on sales volume","Variable targets throughout the program","Flexible percentage-based structure"] },
                        ].map(({ key, icon, color, title, desc, bullets }) => {
                          const isActive = rebateType === key;
                          const borderActive = { blue: 'border-blue-500', green: 'border-green-500', orange: 'border-orange-500' }[color];
                          const bgActive     = { blue: theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50', green: theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50', orange: theme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-50' }[color];
                          const iconBgActive = { blue: theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500', green: theme === 'dark' ? 'bg-green-600' : 'bg-green-500', orange: theme === 'dark' ? 'bg-orange-600' : 'bg-orange-500' }[color];
                          const dotActive    = { blue: 'bg-blue-500', green: 'bg-green-500', orange: 'bg-orange-500' }[color];
                          const hoverBorder  = { blue: 'hover:border-blue-300', green: 'hover:border-green-300', orange: 'hover:border-orange-300' }[color];
                          return (
                            <div
                              key={key}
                              className={`border-2 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg ${access.canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'} ${
                                isActive
                                  ? `${borderActive} ${bgActive} shadow-md`
                                  : theme === 'dark' ? `border-gray-700 bg-gray-800 ${hoverBorder}` : `border-gray-200 bg-white ${hoverBorder}`
                              }`}
                              onClick={() => { if (access.canEdit) setRebateType(key); }}
                            >
                              <div className="flex items-center gap-4 mb-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? iconBgActive : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>{icon}</div>
                                <div>
                                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>{title}</h3>
                                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{desc}</p>
                                </div>
                              </div>
                              <ul className={`text-xs space-y-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                {bullets.map(text => (
                                  <li key={text} className="flex items-start gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${isActive ? dotActive : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                    <span>{text}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {rebateType && (
                      <>
                        {/* ── Header fields ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 mb-8 pb-8 border-b border-blue-200">
                          {/* Rebate Code */}
                          <div className="space-y-3">
                            <label className={`text-sm font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              <FileText className="w-4 h-4 text-blue-500" /> Rebate Code
                            </label>
                            <div className={`w-full px-4 py-3 border rounded-xl text-sm shadow-sm flex items-center gap-2 ${
                              isViewMode
                                ? theme === 'dark' ? 'bg-amber-900/20 border-amber-600 text-amber-300' : 'bg-amber-50 border-amber-400 text-amber-800'
                                : theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200'       : 'bg-gray-50 border-gray-300 text-gray-800'
                            }`}>
                              {isViewMode && <PenLine className="w-3.5 h-3.5 flex-shrink-0" />}
                              <span className="font-medium font-mono">{isViewMode ? loadedRebateCode : rebateCode}</span>
                            </div>
                          </div>
                          {/* Sales Employee */}
                          <div className="space-y-3">
                            <label className={`text-sm font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              <User className="w-4 h-4 text-blue-500" /> Sales Employee
                            </label>
                            <select
                              className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} ${!access.canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                              value={selectedSalesEmployee}
                              onChange={(e) => { if (access.canEdit) setSelectedSalesEmployee(e.target.value); }}
                              disabled={loading || !access.canEdit}
                            >
                              <option value="">{loading ? "Loading..." : "Select Sales Employee"}</option>
                              {salesEmployeeOptions.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          {/* Date From */}
                          <div className="space-y-3">
                            <label className={`text-sm font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              <Calendar className="w-4 h-4 text-blue-500" /> Date From
                            </label>
                            <input type="date"
                              className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} ${!access.canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                              value={selectedDateFrom}
                              onChange={(e) => { if (access.canEdit) setSelectedDateFrom(e.target.value); }}
                              disabled={!access.canEdit}
                            />
                          </div>
                          {/* Date To */}
                          <div className="space-y-3">
                            <label className={`text-sm font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              <Calendar className="w-4 h-4 text-blue-500" /> Date To
                            </label>
                            <input type="date"
                              className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} ${!access.canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                              value={selectedDateTo}
                              onChange={(e) => { if (access.canEdit) setSelectedDateTo(e.target.value); }}
                              disabled={!access.canEdit}
                            />
                          </div>
                          {/* Frequency */}
                          <div className="space-y-3">
                            <label className={`text-sm font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              <Calculator className="w-4 h-4 text-blue-500" /> Frequency
                            </label>
                            <select
                              className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} ${!access.canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                              value={selectedFrequency}
                              onChange={(e) => { if (access.canEdit) setSelectedFrequency(e.target.value); }}
                              disabled={!access.canEdit}
                            >
                              <option value="">Select Frequency</option>
                              <option value="N/A">N/A</option>
                              <option value="Monthly">Monthly</option>
                              <option value="Quarterly">Quarterly</option>
                            </select>
                          </div>
                          {/* Quota Type */}
                          <div className="space-y-3">
                            <label className={`text-sm font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              <Target className="w-4 h-4 text-blue-500" /> Quota Type
                            </label>
                            <select
                              className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'} ${!access.canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                              value={quotaType}
                              onChange={(e) => { if (access.canEdit) handleQuotaTypeChange(e.target.value); }}
                              disabled={!access.canEdit}
                            >
                              <option value="withQuota">With Quota</option>
                              <option value="withoutQuota">Without Quota</option>
                            </select>
                          </div>
                        </div>

                        {/* ── Quota type indicator ── */}
                        <div className={`mb-6 p-4 rounded-xl border ${
                          quotaType === "withQuota"
                            ? theme === 'dark' ? "bg-blue-900/20 border-blue-700 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800"
                            : theme === 'dark' ? "bg-gray-800 border-gray-700 text-gray-300"    : "bg-gray-50 border-gray-200 text-gray-800"
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${quotaType === "withQuota" ? "bg-blue-500" : theme === 'dark' ? "bg-gray-500" : "bg-gray-500"}`}></div>
                            <div>
                              <p className="font-semibold text-sm">{quotaType === "withQuota" ? "With Quota Program" : "Without Quota Program"}</p>
                              <p className={`text-xs opacity-80 ${theme === 'dark' ? 'text-gray-400' : ''}`}>
                                {quotaType === "withQuota"
                                  ? "Customers will have individual quota targets for each period."
                                  : "No quota targets will be assigned to customers; performance will rely on system-generated values."}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* ── Tab bar + Import/Export ── */}
                        <div className={`flex items-center justify-between mb-8 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                          <div className="flex">
                            {["Customer", "Items"].map(tab => (
                              <button key={tab}
                                className={`px-8 py-4 font-semibold text-sm border-b-2 transition-all flex items-center gap-3 ${
                                  activeTab === tab
                                    ? theme === 'dark' ? "border-blue-500 text-blue-400 bg-blue-900/30 rounded-t-lg" : "border-blue-600 text-blue-600 bg-blue-50 rounded-t-lg"
                                    : theme === 'dark' ? "border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-t-lg" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-t-lg"
                                }`}
                                onClick={() => setActiveTab(tab)}
                              >
                                {tab === "Customer" ? <Users className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                                {tab === "Customer"
                                  ? (rebateType === "Incremental" ? "Customer Ranges" : rebateType === "Percentage" ? "Customer Percentages" : "Customer Quotas")
                                  : (rebateType === "Incremental" ? "Product Ranges"  : rebateType === "Percentage" ? "Product Setup"        : "Product Rebates")
                                }
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-3 items-center">
                            {/* Import */}
                            <label
                              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${
                                access.canEdit
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60'
                              }`}
                              title={!access.canEdit ? 'No import permission' : isViewMode ? `Import will update ${loadedRebateCode}` : 'Import Excel'}
                            >
                              {!access.canEdit ? <Lock size={16} /> : <Upload size={16} />}
                              {isViewMode ? 'Import & Update' : 'Import Excel'}
                              <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" disabled={!access.canEdit} />
                            </label>
                            {/* Export */}
                            <button
                              onClick={handleDownload}
                              disabled={!access.canExport}
                              title={!access.canExport ? 'No export permission' : 'Export to Excel'}
                              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${
                                access.canExport
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60'
                              }`}
                            >
                              {!access.canExport ? <Lock size={16} /> : <Download size={16} />}
                              Export to Excel
                            </button>
                          </div>
                        </div>

                        {/* ── Customer tab ── */}
                        {activeTab === "Customer" && (
                          <div className="mb-8">
                            <div className="flex items-center justify-between mb-6">
                              <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>
                                {rebateType === "Incremental" ? "Customer Rebate Ranges" : rebateType === "Percentage" ? "Customer Percentage Setup" : "Customer Quota Setup"}
                              </h3>
                              <div className="flex items-center gap-4">
                                <div className={`text-sm px-3 py-1 rounded-full ${theme === 'dark' ? 'text-gray-300 bg-gray-700' : 'text-gray-500 bg-blue-50'}`}>
                                  {customers.length} customer(s)
                                </div>
                                {quotaType === "withQuota" && (
                                  <div className={`text-sm px-3 py-1 rounded-full font-medium ${theme === 'dark' ? 'text-blue-300 bg-blue-900/30' : 'text-blue-600 bg-blue-50'}`}>
                                    {quotaPeriods.length} period{quotaPeriods.length !== 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className={`border rounded-2xl overflow-hidden max-h-96 overflow-y-auto shadow-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                  <thead className={`sticky top-0 z-10 ${theme === 'dark' ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gradient-to-r from-gray-50 to-blue-50'}`}>
                                    <tr>
                                      {["Customer Code","Customer Name",...(rebateType === "Fixed" || rebateType === "Incremental" ? ["Qtr Rebate"] : []),quotaType === "withQuota" ? "Period" : "Status","Actions"].map(h => (
                                        <th key={h} className={`px-6 py-4 text-left font-bold text-xs uppercase tracking-wider border-b ${theme === 'dark' ? 'text-gray-300 border-gray-700' : 'text-gray-700 border-gray-200'}`}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {customers.length === 0 ? (
                                      <tr><td colSpan={5} className={`px-6 py-12 text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <div className="flex flex-col items-center gap-2"><Users className="w-8 h-8 opacity-30" /><span>No customers added yet. Click "Add Customer" to get started.</span></div>
                                      </td></tr>
                                    ) : customers.map((c, idx) => (
                                      <tr key={idx} className={`transition-colors border-b last:border-b-0 ${theme === 'dark' ? 'even:bg-gray-800/50 hover:bg-gray-700 border-gray-700' : 'even:bg-gray-50 hover:bg-blue-50 border-gray-100'}`}>
                                        <td className="px-6 py-4">
                                          <div className={`px-3 py-2 text-sm font-medium font-mono ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{c.code || "-"}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                          {isRowEditable('customer', idx) ? (
                                            <button onClick={() => handleOpenCustomerModal(idx)} className={`flex items-center justify-between w-full px-4 py-2.5 border rounded-lg text-sm transition-all shadow-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'}`}>
                                              <span className="truncate">{c.name || "Select Customer"}</span>
                                              <Users className={`w-4 h-4 flex-shrink-0 ml-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                                            </button>
                                          ) : (
                                            <div className={`w-80 px-3 py-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>{c.name || "-"}</div>
                                          )}
                                        </td>
                                        {(rebateType === "Fixed" || rebateType === "Incremental") && (
                                          <td className="px-6 py-4">
                                            {isRowEditable('customer', idx) ? (
                                              <input type="text" value={c.qtrRebate || ""} onChange={(e) => handleQtrRebateChange(idx, e.target.value)} placeholder="0"
                                                className={`w-32 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                                                disabled={!access.canEdit}
                                              />
                                            ) : (
                                              <div className={`px-3 py-2 text-sm font-medium text-center ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{c.qtrRebate ? `${c.qtrRebate} Qtr` : "-"}</div>
                                            )}
                                          </td>
                                        )}
                                        <td className="px-6 py-4">
                                          {quotaType === "withQuota" ? (
                                            <div className="flex justify-center">
                                              <button onClick={() => openQuotaModal(idx)} className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all shadow-sm text-sm font-medium ${
                                                rebateType === "Percentage" ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
                                                : rebateType === "Incremental" ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700"
                                                : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
                                              }`}>
                                                <Target className="w-4 h-4" />
                                                <span>{rebateType === "Incremental" && Object.keys(c.ranges || {}).length > 0 ? `${Object.keys(c.ranges).length} ranges` : "Set Targets"}</span>
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex justify-center">
                                              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg text-sm font-medium">
                                                <CheckCircle className="w-4 h-4" /> No Quota
                                              </div>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-6 py-4">
                                          <div className="flex gap-2 justify-center">
                                            <button
                                              className={`p-2 rounded-xl transition-all ${isRowEditable('customer', idx) ? (theme === 'dark' ? "bg-green-900/30 text-green-400 hover:bg-green-800/50" : "bg-green-100 text-green-600 hover:bg-green-200") : (theme === 'dark' ? "bg-blue-900/30 text-blue-400 hover:bg-blue-800/50" : "bg-blue-100 text-blue-600 hover:bg-blue-200")} ${!access.canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
                                              onClick={() => { if (access.canEdit) toggleRowEdit('customer', idx); }}
                                            >
                                              {isRowEditable('customer', idx) ? <Save size={16} /> : <Edit size={16} />}
                                            </button>
                                            <button
                                              className={`p-2 rounded-xl transition-all ${theme === 'dark' ? "text-red-400 hover:bg-red-900/30" : "text-red-600 hover:bg-red-100"} ${!access.canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
                                              onClick={() => handleDeleteCustomer(idx)}
                                            >
                                              <Trash2 size={16} />
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
                          <div className="mb-8">
                            <h3 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>
                              {rebateType === "Incremental" ? "Product Rebate Ranges" : rebateType === "Percentage" ? "Product Setup" : "Product Rebate Configuration"}
                            </h3>
                            <div className={`border rounded-2xl overflow-hidden max-h-96 overflow-y-auto shadow-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm min-w-[600px]">
                                  <thead className={`sticky top-0 z-10 ${theme === 'dark' ? 'bg-gradient-to-r from-gray-800 to-purple-900/30' : 'bg-gradient-to-r from-gray-50 to-purple-50'}`}>
                                    <tr>
                                      {["Item Code","Item Name","Qty",...(rebateType === "Percentage" ? ["Percentage Per Bag"] : [rebateType === "Incremental" ? "Rebate Ranges" : "Rebate Per Bag"]),"Actions"].map(h => (
                                        <th key={h} className={`px-6 py-4 text-left font-bold text-xs uppercase tracking-wider border-b ${theme === 'dark' ? 'text-gray-300 border-gray-700' : 'text-gray-700 border-gray-200'}`}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.length === 0 ? (
                                      <tr><td colSpan={5} className={`px-6 py-12 text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <div className="flex flex-col items-center gap-2"><Package className="w-8 h-8 opacity-30" /><span>No items added yet. Click "Add Item" to get started.</span></div>
                                      </td></tr>
                                    ) : items.map((item, idx) => (
                                      <tr key={idx} className={`transition-colors border-b last:border-b-0 ${theme === 'dark' ? 'even:bg-gray-800/50 hover:bg-gray-700 border-gray-700' : 'even:bg-gray-50 hover:bg-purple-50 border-gray-100'}`}>
                                        <td className="px-6 py-4">
                                          <div className={`px-3 py-2 text-sm font-medium font-mono ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{item.code || "-"}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                          {isRowEditable('item', idx) ? (
                                            <button onClick={() => handleOpenItemModal(idx)} className={`flex items-center justify-between w-full px-4 py-2.5 border rounded-lg text-sm transition-all shadow-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'}`}>
                                              <span className="truncate">{item.name || "Select Item"}</span>
                                              <Package className={`w-4 h-4 flex-shrink-0 ml-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                                            </button>
                                          ) : (
                                            <div className={`w-80 px-3 py-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>{item.name || "-"}</div>
                                          )}
                                        </td>
                                        <td className="px-6 py-4">
                                          {isRowEditable('item', idx) ? (
                                            <input type="text" value={item.unitPerQty || ""} onChange={(e) => { const nd = [...items]; nd[idx].unitPerQty = e.target.value; setItems(nd); }} placeholder="Unit per Qty"
                                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                                              disabled={!access.canEdit}
                                            />
                                          ) : (
                                            <div className={`px-3 py-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>{item.unitPerQty || "-"}</div>
                                          )}
                                        </td>
                                        {rebateType === "Percentage" && (
                                          <td className="px-6 py-4">
                                            {isRowEditable('item', idx) ? (
                                              <div className="relative">
                                                <input type="text" value={item.percentagePerBag || ""} onChange={(e) => handlePercentagePerBagChange(idx, e.target.value)} placeholder="0.00"
                                                  className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                                                  disabled={!access.canEdit}
                                                />
                                                <div className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>%</div>
                                              </div>
                                            ) : (
                                              <div className={`px-3 py-2 text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{item.percentagePerBag ? `${item.percentagePerBag}%` : "-"}</div>
                                            )}
                                          </td>
                                        )}
                                        {rebateType !== "Percentage" && (
                                          <td className="px-6 py-4">
                                            {rebateType === "Incremental" ? (
                                              <button onClick={() => openProductRangeModal(idx)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 rounded-lg transition-all shadow-sm text-sm font-medium">
                                                <TrendingUp className="w-4 h-4" />
                                                {getProductRangeSummary(item)}
                                              </button>
                                            ) : (
                                              <div className="w-full">
                                                {isRowEditable('item', idx) ? (
                                                  <input type="text" value={item.rebatePerBag || ""} onChange={(e) => handleRebatePerBagChange(idx, e.target.value)} placeholder="Rebate per bag"
                                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                                                    disabled={!access.canEdit}
                                                  />
                                                ) : (
                                                  <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg text-sm font-medium">
                                                    <span className="text-xs">₱</span>{getProductRangeSummary(item).replace('$','₱')}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                        )}
                                        <td className="px-6 py-4">
                                          <div className="flex gap-2 justify-center">
                                            <button
                                              className={`p-2 rounded-xl transition-all ${isRowEditable('item', idx) ? (theme === 'dark' ? "bg-green-900/30 text-green-400 hover:bg-green-800/50" : "bg-green-100 text-green-600 hover:bg-green-200") : (theme === 'dark' ? "bg-purple-900/30 text-purple-400 hover:bg-purple-800/50" : "bg-purple-100 text-purple-600 hover:bg-purple-200")} ${!access.canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
                                              onClick={() => { if (access.canEdit) toggleRowEdit('item', idx); }}
                                            >
                                              {isRowEditable('item', idx) ? <Save size={16} /> : <Edit size={16} />}
                                            </button>
                                            <button
                                              className={`p-2 rounded-xl transition-all ${theme === 'dark' ? "text-red-400 hover:bg-red-900/30" : "text-red-600 hover:bg-red-100"} ${!access.canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
                                              onClick={() => handleDeleteItem(idx)}
                                            >
                                              <Trash2 size={16} />
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

                        {/* ── Bottom action bar ── */}
                        <div className={`flex justify-between items-center mt-8 pt-6 border-t ${theme === 'dark' ? 'border-blue-700' : 'border-blue-200'}`}>
                          <div className="flex gap-4">
                            {activeTab === "Customer" && (
                              <button onClick={handleAddCustomer} disabled={!access.canEdit}
                                className={`flex items-center gap-2 px-6 py-3 text-white text-sm font-semibold rounded-xl transition-all shadow-lg ${access.canEdit ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-60'}`}>
                                {!access.canEdit ? <Lock size={16} /> : <Users size={16} />} Add Customer
                              </button>
                            )}
                            {activeTab === "Items" && (
                              <button onClick={handleAddItem} disabled={!access.canEdit}
                                className={`flex items-center gap-2 px-6 py-3 text-white text-sm font-semibold rounded-xl transition-all shadow-lg ${access.canEdit ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-60'}`}>
                                {!access.canEdit ? <Lock size={16} /> : <Package size={16} />} Add Item
                              </button>
                            )}
                          </div>
                          <div className="flex gap-4">
                            <button onClick={handleReset}
                              className={`flex items-center gap-2 px-6 py-3 border text-sm font-semibold rounded-xl transition-all shadow-sm ${theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                              <X size={16} /> Reset
                            </button>

                            {/* ── Conditional Save vs Update button ── */}
                            {isViewMode ? (
                              <button
                                onClick={handleUpdate}
                                disabled={!access.canEdit}
                                title={!access.canEdit ? 'No edit permission' : `Update ${loadedRebateCode}`}
                                className={`flex items-center gap-2 px-8 py-3 text-white text-sm font-semibold rounded-xl transition-all shadow-lg ${
                                  access.canEdit
                                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
                                    : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-60'
                                }`}
                              >
                                {!access.canEdit ? <Lock size={16} /> : <PenLine size={16} />}
                                Update {loadedRebateCode}
                              </button>
                            ) : (
                              <button
                                onClick={handleSave}
                                disabled={!access.canCreate}
                                title={!access.canCreate ? 'No create permission' : 'Save Rebate Setup'}
                                className={`flex items-center gap-2 px-8 py-3 text-white text-sm font-semibold rounded-xl transition-all shadow-lg ${
                                  access.canCreate
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                                    : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-60'
                                }`}
                              >
                                {!access.canCreate ? <Lock size={16} /> : <Save size={16} />}
                                Save Rebate Setup
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )
            }
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

      <SearchRebateModal isOpen={searchModal.isOpen} onClose={() => setSearchModal({ isOpen: false })} searchCode={searchCode} setSearchCode={setSearchCode} onSearch={handleSearchRebateCode} searchLoading={searchLoading} searchError={searchError} theme={theme} />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {loading && <Loading theme={theme} />}
      <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, action: null, data: null })} onConfirm={confirmModal.action === 'reset' ? resetForm : confirmAction} title={confirmModal.title} message={confirmModal.message} />
      <DuplicationError isOpen={duplicationError.isOpen} onClose={() => setDuplicationError({ isOpen: false, type: null, data: null })} type={duplicationError.type} data={duplicationError.data} theme={theme} />
    </div>
  );
}

export default Nexchem_RebateSetup;