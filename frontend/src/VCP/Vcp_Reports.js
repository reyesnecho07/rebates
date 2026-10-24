import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from 'axios';
import {
  FileText, BarChart2, FileSpreadsheet, Calendar, Clock, CheckCircle,
  XCircle, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, X,
  AlertCircle, TrendingUp, Download, Zap, Users, Search,
} from "lucide-react";
import { useLocation } from 'react-router-dom';
import vcpLogo from "../assets/vcp.png";
import vcpReport from '../assets/vcp.png';
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Sidebar from "../components/Sidebar";
import Header from '../components/Header';
import AccessDenied from "../components/common/AccessDenied";
import { useTheme } from '../context/ThemeContext';
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n, decimals = 2) =>
  (parseFloat(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const fmtCurrency = (n) => `${fmt(n)}`;

const getRowAmounts = (row) => {
  const rebates  = parseFloat(row.totalRebates   ?? row.totalAvailableCashFunds) || 0;
  const released = parseFloat(row.totalReleased  ?? row.totalCashFundsReleased)  || 0;
  const balance  = row.balance != null ? parseFloat(row.balance) : rebates - released;
  return { rebates, released, balance };
};

const getTotalsAmounts = (totals = {}) => {
  const rebates  = parseFloat(totals.totalRebates   ?? totals.totalAvailableCashFunds) || 0;
  const released = parseFloat(totals.totalReleased  ?? totals.totalCashFundsReleased)  || 0;
  const balance  = totals.balance != null ? parseFloat(totals.balance) : rebates - released;
  return { rebates, released, balance };
};

const ROWS_FIRST_PAGE = 22;
const ROWS_OTHER_PAGE = 30;
const MAX_ROWS_WITH_SIGNATORIES = 26;

const BORDER_HEADER = '1px solid #374151';
const BORDER_DATA   = '1px solid #374151';

const reportTableStyle = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: '10px',
  flexShrink: 0,
  borderLeft: BORDER_HEADER,
  borderTop:  BORDER_HEADER,
};

const rthStyle = (extra = {}) => ({
  borderRight:  BORDER_HEADER,
  borderBottom: BORDER_HEADER,
  padding: '5px 6px',
  fontWeight: '700',
  background: '#f3f4f6',
  whiteSpace: 'pre-line',
  verticalAlign: 'middle',
  lineHeight: '1.3',
  ...extra,
});

const rtdStyle = (extra = {}) => ({
  borderRight:  BORDER_DATA,
  borderBottom: BORDER_DATA,
  padding: '4px 6px',
  verticalAlign: 'middle',
  ...extra,
});

const APPLE = {
  blue:   "#0A84FF",
  purple: "#BF5AF2",
  red:    "#FF453A",
  orange: "#FF9F0A",
  green:  "#32D74B",
  gray:   "#8E8E93",
};

const dashTokens = (isDark) => ({
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

const DASH_FONT = `
  .dash-page, .dash-page * { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif; }
  .dash-glass { -webkit-backdrop-filter: blur(28px) saturate(180%); backdrop-filter: blur(28px) saturate(180%); }
  .dash-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
  .dash-scroll::-webkit-scrollbar-thumb { background: rgba(142,142,147,0.4); border-radius: 999px; }
  .dash-scroll::-webkit-scrollbar-track { background: transparent; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes dash-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .dash-pop { animation: dash-pop 0.2s cubic-bezier(0.16,1,0.3,1); }
  @keyframes fadeSlideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse-ring { 0% { box-shadow:0 0 0 0 rgba(10,132,255,0.35); } 70% { box-shadow:0 0 0 10px rgba(10,132,255,0); } 100%{ box-shadow:0 0 0 0 rgba(10,132,255,0); } }
  .nx-card { animation: fadeSlideUp 0.3s ease both; }
  .nx-btn-primary:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.05); }
  .nx-btn-primary:active:not(:disabled) { transform: translateY(0); }
  .nx-btn-secondary:hover:not(:disabled) { transform: translateY(-1px); }
  .nx-input:focus { border-color: #0A84FF !important; box-shadow: 0 0 0 3px rgba(10,132,255,0.15); }
  .nx-select:focus { border-color: #0A84FF !important; box-shadow: 0 0 0 3px rgba(10,132,255,0.15); outline: none; }
`;

const injectFonts = () => {
  if (document.getElementById('vcp-report-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'vcp-report-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

const NOTED_BY_NAME = 'Bob Manalo';

function Vcp_Reports() {
  useEffect(() => { injectFonts(); }, []);

  const { theme, updateTheme } = useTheme();
  const location = useLocation();
  const reportContainerRef = useRef(null);
  const routePath = '/Vcp_Reports';

  const isDark = theme === 'dark';
  const K = dashTokens(isDark);
  const fontStack = "'Outfit', system-ui, sans-serif";
  const monoStack = "'DM Mono', monospace";

  const [collapsed,           setCollapsed]           = useState(false);
  const [showVanDropdown,     setShowVanDropdown]     = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(true);

  const [userName,  setUserName]  = useState("");
  const [userCode,  setUserCode]  = useState("");
  const [initials,  setInitials]  = useState("");

  const [rebates,             setRebates]             = useState([]);
  const [selectedRebates,     setSelectedRebates]     = useState([]);
  const [tempSelectedRebates, setTempSelectedRebates] = useState([]);
  const [showRebateDropdown,  setShowRebateDropdown]  = useState(false);

  const [allCustomers,          setAllCustomers]          = useState([]);
  const [selectedCustomers,     setSelectedCustomers]     = useState([]);
  const [tempSelectedCustomers, setTempSelectedCustomers] = useState([]);
  const [showCustomerDropdown,  setShowCustomerDropdown]  = useState(false);
  const [customersLoading,      setCustomersLoading]      = useState(false);
  const [customerSearch,        setCustomerSearch]        = useState("");
  const [rebateInfo,            setRebateInfo]            = useState(null);
  const [dateFrom,              setDateFrom]              = useState("");
  const [dateTo,                setDateTo]                = useState("");

  const [reportData, setReportData] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobStatus,   setJobStatus]   = useState(null);
  const [jobError,    setJobError]    = useState(null);

  const { access, accessLoading } = useAccessControl(routePath);

  const API_BASE = 'http://192.168.100.193:3009/api';
  const DB_NAME  = 'VCP';

  useComponentRegistration({
    name: 'Vcp_Reports',
    version: '3.1.0',
    description: 'Cash Fund per Account report — customer-first, rebate optional.',
    routePath: '/Vcp_Reports',
  });

  /* ─── Helpers ──────────────────────────────────────────────────────────── */
  const getCurrentDate = useCallback(() =>
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), []);

  const getCurrentDateForFilename = useCallback(() => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const getMonthLabel = useCallback(() => {
    const dt = reportData?.dateTo || dateTo;
    if (!dt) return 'All Dates';
    const endDate = new Date(dt);
    return endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, [reportData, dateTo]);

  const generateFilename = useCallback((extension) => {
    const date = getCurrentDateForFilename();
    const code = selectedRebates.length === 0
      ? 'ALL_REBATES'
      : selectedRebates.length === 1
        ? selectedRebates[0]
        : `ALL_${selectedRebates.length}`;
    return `CashFund_${code}_${date}.${extension}`;
  }, [selectedRebates, getCurrentDateForFilename]);

  const getPaginatedPages = useCallback((rows) => {
    if (!rows || rows.length === 0) return [[]];
    const pages = [];
    let remaining = [...rows];
    pages.push(remaining.splice(0, ROWS_FIRST_PAGE));
    while (remaining.length > 0) {
      pages.push(remaining.splice(0, ROWS_OTHER_PAGE));
    }
    const lastPage = pages[pages.length - 1];
    if (lastPage.length > MAX_ROWS_WITH_SIGNATORIES) {
      pages.push([]);
    }
    return pages;
  }, []);

  /* ─── Lifecycle ────────────────────────────────────────────────────────── */
  useEffect(() => {
    try {
      const savedData   = localStorage.getItem("savedCashFundData");
      const savedParams = localStorage.getItem("savedCashFundParams");
      const savedShow   = localStorage.getItem("savedCashFundShow");
      if (savedData)   setReportData(JSON.parse(savedData));
      if (savedParams) {
        const p = JSON.parse(savedParams);
        setDateFrom(p.dateFrom || "");
        setDateTo(p.dateTo || "");
        setSelectedRebates(
          Array.isArray(p.rebateCodes)
            ? p.rebateCodes
            : (p.rebateCode ? [p.rebateCode] : [])
        );
        if (Array.isArray(p.customerCodes) && p.customerCodes.length > 0) {
          sessionStorage.setItem('pendingCustomerRestore', JSON.stringify(p.customerCodes));
        }
      }
      if (savedShow) setShowReport(JSON.parse(savedShow));
    } catch (e) { console.error('Restore error:', e); }
  }, []);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const u   = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const uid = u.UserID || u.User_ID;
        if (uid) {
          const res = await axios.get(`${API_BASE}/user/preferences/${uid}/theme?db=USER`);
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
    const u        = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const username = u.DisplayName || u.Username || "Unknown User";
    setUserName(username);
    setUserCode(u.User_ID || "Unknown ID");
    const parts = username.trim().split(" ");
    setInitials(parts.length === 1
      ? parts[0][0].toUpperCase()
      : parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase());
  }, []);

  useEffect(() => { if (reportData) localStorage.setItem("savedCashFundData", JSON.stringify(reportData)); }, [reportData]);
  useEffect(() => {
    localStorage.setItem("savedCashFundParams", JSON.stringify({
      dateFrom,
      dateTo,
      rebateCodes:   selectedRebates,
      customerCodes: selectedCustomers.map(c => c.CardCode),
    }));
  }, [dateFrom, dateTo, selectedRebates, selectedCustomers]);
  useEffect(() => { localStorage.setItem("savedCashFundShow", JSON.stringify(showReport)); }, [showReport]);
  useEffect(() => { setCurrentPage(0); }, [reportData]);

  /* ── Fetch rebate codes ── */
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/vcp/report/rebates?db=${DB_NAME}`);
        const data = await res.json();
        if (data.success) setRebates(data.data || []);
      } catch (e) { console.error('Error fetching rebates:', e); }
    })();
  }, [API_BASE]);

  /* ── Fetch ALL customers across every active rebate program ── */
  useEffect(() => {
    (async () => {
      setCustomersLoading(true);
      try {
        const res  = await fetch(`${API_BASE}/vcp/report/customers?db=${DB_NAME}`);
        const data = await res.json();
        if (data.success) {
          const list = data.data || [];
          setAllCustomers(list);

          let initial = list;
          const pending = sessionStorage.getItem('pendingCustomerRestore');
          if (pending) {
            try {
              const codes = JSON.parse(pending);
              const codeSet = new Set(codes);
              initial = list.filter(c => codeSet.has(c.CardCode));
              sessionStorage.removeItem('pendingCustomerRestore');
            } catch { /* noop */ }
          }
          setSelectedCustomers(initial);
          setTempSelectedCustomers(initial);
        }
      } catch (e) { console.error('Error fetching all customers:', e); }
      finally { setCustomersLoading(false); }
    })();
  }, [API_BASE, DB_NAME]);

  /* ── Outside-click closes dropdowns ── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showCustomerDropdown && !e.target.closest('.customer-dropdown-container')) {
        setShowCustomerDropdown(false);
      }
      if (showRebateDropdown && !e.target.closest('.rebate-dropdown-container')) {
        setShowRebateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomerDropdown, showRebateDropdown]);

  /* ─── Handlers ─────────────────────────────────────────────────────────── */
  const handleRebatesChange = useCallback((codes) => {
    setSelectedRebates(codes);
    setShowReport(false);
    setReportData(null);
    setErrorMsg("");
    setSuccessMsg("");
    setJobStatus(null);
    setJobError(null);
    setCurrentPage(0);

    if (codes.length === 0) {
      setRebateInfo(null);
      return;
    }

    const infos = codes.map(c => rebates.find(r => r.RebateCode === c)).filter(Boolean);
    if (infos.length > 0) {
      const minFrom = infos.reduce((m, r) => (!m || (r.DateFrom && r.DateFrom < m)) ? r.DateFrom : m, null);
      const maxTo   = infos.reduce((m, r) => (!m || (r.DateTo   && r.DateTo   > m)) ? r.DateTo   : m, null);

      // Info only — do NOT overwrite the date pickers.
      setRebateInfo({
        DateFrom:  minFrom,
        DateTo:    maxTo,
        Frequency: infos.length === 1 ? infos[0].Frequency : `${infos.length} codes`,
        RebateType: infos[0].RebateType,
      });
    }
  }, [rebates]);

  const generateReport = async () => {
    if (!access.canCreate) { alert("You do not have permission to generate reports."); return; }

    if (selectedCustomers.length === 0) {
      setErrorMsg("Please select at least one customer.");
      return;
    }
    if (!dateFrom || !dateTo) {
      setErrorMsg("Please select both Date From and Date To.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setShowReport(false);
    setJobError(null);
    setCurrentPage(0);
    const jobId = `job_${Date.now()}`;
    setActiveJobId(jobId);
    setJobStatus('processing');

    try {
      const customerCodes = selectedCustomers.map(c => c.CardCode).filter(Boolean);
      const res = await fetch(`${API_BASE}/vcp/report/cash-fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rebateCodes: selectedRebates,
          customerCodes,
          dateFrom,
          dateTo,
          db: DB_NAME,
        }),
      });
      const text = await res.text();
      let result;
      try { result = JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${text.substring(0, 100)}`); }
      if (!res.ok || !result.success) throw new Error(result.message || result.error || `HTTP ${res.status}`);
      setJobStatus('completed');
      setReportData(result.data);
      setShowReport(true);
      localStorage.setItem("savedCashFundData", JSON.stringify(result.data));
    } catch (e) {
      console.error("Error generating report:", e);
      setJobStatus('failed');
      setJobError(e.message);
      setErrorMsg(`Failed to generate report: ${e.message}`);
    } finally {
      setLoading(false);
      setActiveJobId(null);
    }
  };

  const syncPayouts = async () => {
    if (selectedRebates.length === 0) {
      setErrorMsg("Select at least one rebate code to sync payouts.");
      return;
    }
    setSyncing(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res  = await fetch(`${API_BASE}/vcp/report/sync-payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rebateCodes: selectedRebates, dateFrom, dateTo, db: DB_NAME }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setSuccessMsg(`Sync complete - ${data.data?.succeeded ?? 0} / ${data.data?.total ?? 0} customers updated.`);
    } catch (e) {
      setErrorMsg(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const clearReport = () => {
    setReportData(null);
    setShowReport(false);
    setErrorMsg("");
    setSuccessMsg("");
    setActiveJobId(null);
    setJobStatus(null);
    setJobError(null);
    setCurrentPage(0);
    setSelectedRebates([]);
    setSelectedCustomers(allCustomers);
    setTempSelectedCustomers(allCustomers);
    ['savedCashFundData', 'savedCashFundParams', 'savedCashFundShow'].forEach(k => localStorage.removeItem(k));
  };

  /* ─── Exports ───────────────────────────────────────────────────────────── */
  const exportToPDF = async () => {
    if (!reportContainerRef.current || !reportData) return;
    try {
      const pageEls = reportContainerRef.current.querySelectorAll('.report-page');
      if (!pageEls.length) return;
      const pdf   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = 297;
      const pageH = 210;
      for (let i = 0; i < pageEls.length; i++) {
        if (i > 0) pdf.addPage();
        const el = pageEls[i];
        const prev = {
          display:  el.style.display,
          position: el.style.position,
          opacity:  el.style.opacity,
          top:      el.style.top,
          left:     el.style.left,
        };
        el.style.display  = 'flex';
        el.style.position = 'relative';
        el.style.opacity  = '1';
        el.style.top      = 'auto';
        el.style.left     = 'auto';
        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
          windowWidth:  el.scrollWidth,
          windowHeight: el.scrollHeight,
        });
        Object.assign(el.style, prev);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
      }
      pdf.save(generateFilename('pdf'));
    } catch (e) { console.error('PDF error:', e); alert('Failed to generate PDF. Please try again.'); }
  };

  const exportToExcel = () => {
    if (!reportData) return;
    try {
      const t = getTotalsAmounts(reportData.totals);
      const aoa = [
        ['Cash Fund per Account'],
        [`As of ${getMonthLabel()}`],
        [],
        [`Sales Agent: ${reportData.salesAgent || ''}`],
        ['Area:'],
        [],
        ['Customer Code', 'Customer Name', 'Total Rebates Earned ', 'Total Released', 'Balance'],
        ...reportData.reportRows.map(r => {
          const { rebates, released, balance } = getRowAmounts(r);
          return [r.accountCode, r.accountName, rebates, released, balance];
        }),
        ['', 'TOTAL', t.rebates, t.released, t.balance],
        [],
        [],
        ['Prepared By:', userName || ''],
        ['Noted By:',   NOTED_BY_NAME],
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 18 }, { wch: 42 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cash Fund Report');
      saveAs(
        new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }),
        generateFilename('xlsx')
      );
    } catch (e) { console.error('Excel error:', e); alert('Failed to generate Excel file. Please try again.'); }
  };

  /* ─── Status icon ───────────────────────────────────────────────────────── */
  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing': return <RefreshCw style={{ width: 14, height: 14, color: APPLE.blue, animation: 'spin 0.8s linear infinite' }} />;
      case 'completed':  return <CheckCircle style={{ width: 14, height: 14, color: APPLE.green }} />;
      case 'failed':     return <XCircle style={{ width: 14, height: 14, color: APPLE.red }} />;
      default:           return <Clock style={{ width: 14, height: 14, color: K.faint }} />;
    }
  };

  const formatJobDate = (ds) =>
    new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const renderAccessLoading = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 380, fontFamily: fontStack }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${K.hairline}`, borderTopColor: APPLE.blue,
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: 13, color: K.muted }}>Verifying access…</p>
      </div>
    </div>
  );

  /* ─── Report page ───────────────────────────────────────────────────────── */
  const renderReportPage = (pageRows, pageIndex, totalPages, visible) => {
    const isFirstPage = pageIndex === 0;
    const isLastPage  = pageIndex === totalPages - 1;
    const hiddenStyle = {
      position: 'absolute', top: '-99999px', left: '-99999px',
      opacity: 0, pointerEvents: 'none',
    };

    const COLS = [
      { label: 'Customer Code',  width: '16%', align: 'left'  },
      { label: 'Customer Name',  width: '34%', align: 'left'  },
      { label: 'Total Rebates Earned',  width: '16%', align: 'right' },
      { label: 'Total Released', width: '16%', align: 'right' },
      { label: 'Balance',        width: '18%', align: 'right' },
    ];

    return (
      <div
        key={pageIndex}
        className="report-page bg-white border border-gray-300 shadow-lg"
        style={{
          width: '1050px',
          height: '742px',
          padding: '36px 48px 56px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Arial, sans-serif',
          fontSize: '11px',
          color: '#1a1a1a',
          overflow: 'hidden',
          position: 'relative',
          ...(visible ? {} : hiddenStyle),
        }}
      >
        {isFirstPage && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13px', lineHeight: 1.35 }}>
                  Cash Fund per Account
                </div>
                <div style={{ fontSize: '11px', color: '#333', lineHeight: 1.35 }}>
                  As of {getMonthLabel()}
                </div>
              </div>
              <img src={vcpReport} alt="VCP" style={{ width: '90px', height: 'auto', display: 'block', flexShrink: 0 }} />
            </div>
            <div style={{ fontSize:'11px', marginBottom:'2px' }}>
              <span style={{ fontWeight:'600' }}>Sales Agent:</span>&nbsp;{reportData.salesAgent || ''}
            </div>
            <div style={{ fontSize:'11px', marginBottom:'14px' }}>
              <span style={{ fontWeight:'600' }}>Area:</span>
            </div>
          </>
        )}

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <table style={reportTableStyle}>
            <thead>
              <tr>
                {COLS.map(({ label, width, align }) => (
                  <th key={label} style={rthStyle({ width, textAlign: align })}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, idx) => {
                const { rebates, released, balance } = getRowAmounts(row);
                return (
                  <tr key={row.accountCode} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={rtdStyle()}>{row.accountCode}</td>
                    <td style={rtdStyle()}>{row.accountName}</td>
                    <td style={rtdStyle({ textAlign: 'right' })}>{fmtCurrency(rebates)}</td>
                    <td style={rtdStyle({ textAlign: 'right' })}>{fmtCurrency(released)}</td>
                    <td style={rtdStyle({
                      textAlign: 'right',
                      fontWeight: 600,
                      color: balance < 0 ? '#b91c1c' : '#15803d',
                    })}>
                      {fmtCurrency(balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {isLastPage && (() => {
              const t = getTotalsAmounts(reportData.totals);
              return (
                <tfoot>
                  <tr style={{ background: '#e5e7eb' }}>
                    <td colSpan={2} style={rthStyle({ textAlign: 'left' })}>TOTAL</td>
                    <td style={rthStyle({ textAlign: 'right' })}>{fmtCurrency(t.rebates)}</td>
                    <td style={rthStyle({ textAlign: 'right' })}>{fmtCurrency(t.released)}</td>
                    <td style={rthStyle({
                      textAlign: 'right',
                      color: t.balance < 0 ? '#b91c1c' : '#15803d',
                    })}>
                      {fmtCurrency(t.balance)}
                    </td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>

        {isLastPage && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 34px', marginTop: '16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '220px' }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#333', letterSpacing: '0.02em', marginBottom: '2px', alignSelf: 'flex-start' }}>
                Prepared By:
              </div>
              <div style={{ width: '100%', borderTop: '1px solid #1a1a1a', marginTop: '26px', paddingTop: '4px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userName || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '220px' }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#333', letterSpacing: '0.02em', marginBottom: '2px', alignSelf: 'flex-start' }}>
                Noted By:
              </div>
              <div style={{ width: '100%', borderTop: '1px solid #1a1a1a', marginTop: '26px', paddingTop: '4px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {NOTED_BY_NAME}
              </div>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: '24px', left: '48px', right: '48px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
          <span>Page {pageIndex + 1} of {totalPages}</span>
        </div>
      </div>
    );
  };

  /* ─── Shared input / label styles ───────────────────────────────────────── */
  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: K.glass,
    border: `1px solid ${K.hairline}`,
    borderRadius: 12, fontSize: 13,
    color: K.ink, fontFamily: fontStack,
    outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, fontWeight: 600,
    color: K.muted, fontFamily: fontStack,
    marginBottom: 6, letterSpacing: '0.05em',
    textTransform: 'uppercase',
  };

  /* ─── Derived flags ─────────────────────────────────────────────────────── */
  const hasRebatesSelected   = selectedRebates.length > 0;
  const hasCustomersSelected = selectedCustomers.length > 0;
  const hasDateRange         = Boolean(dateFrom && dateTo);

  const canGenerate =
    access.canCreate && !loading && !syncing &&
    hasCustomersSelected && hasDateRange;

  const generateTooltip =
    !access.canCreate     ? 'No permission' :
    !hasCustomersSelected ? 'Select at least one customer' :
    !hasDateRange         ? 'Select Date From and Date To first' : '';

  // Search filter for the customer dropdown
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return allCustomers;
    return allCustomers.filter(c =>
      (c.CardName || '').toLowerCase().includes(q) ||
      (c.CardCode || '').toLowerCase().includes(q)
    );
  }, [allCustomers, customerSearch]);

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="dash-page" style={{ display: 'flex', minHeight: '100vh', width: '100%', background: K.bg, fontFamily: fontStack, color: K.ink }}>
      <style>{DASH_FONT}</style>

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            radial-gradient(700px circle at 8% 0%, ${APPLE.blue}${isDark ? "26" : "30"}, transparent 55%),
            radial-gradient(650px circle at 92% 10%, ${APPLE.purple}${isDark ? "1a" : "20"}, transparent 55%)
          `,
          zIndex: 0,
        }}
      />

      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown}         setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown}         setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />

      <main style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', marginLeft: collapsed ? 80 : 256, transition: 'margin-left 0.4s cubic-bezier(.4,0,.2,1)', zIndex: 1 }}>
        <Header collapsed={collapsed} userName={userName} userCode={userCode} initials={initials} logo={vcpLogo} theme={theme} />

        <div className="dash-scroll" style={{ paddingTop: 64, flex: 1, padding: '80px 32px 40px', overflowY: 'auto' }}>
          <div
            className="nx-card dash-glass"
            style={{
              background: K.glass,
              border: `1px solid ${K.hairline}`,
              borderRadius: 22,
              boxShadow: K.shadow,
              padding: '32px 32px 36px',
              maxWidth: 1600, margin: '0 auto',
            }}
          >
            {/* ── Title bar ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${K.hairline}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 14,
                  background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 16px -4px ${APPLE.blue}88`, flexShrink: 0,
                }}>
                  <TrendingUp size={22} color="#fff" />
                </div>
                <div>
                  <h1 style={{ fontSize: 17, fontWeight: 700, color: K.ink, margin: 0, letterSpacing: '-0.01em' }}>
                    Cash Fund per Account
                  </h1>
                  <p style={{ fontSize: 12, color: K.muted, margin: '3px 0 0', fontWeight: 400 }}>
                    Generate &amp; export rebate cash fund reports
                  </p>
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 999,
                background: K.chipBg, border: `1px solid ${K.hairline}`,
                fontSize: 11, color: K.muted, fontWeight: 500, fontFamily: monoStack,
              }}>
                <Calendar size={12} />
                {getCurrentDate()}
              </div>
            </div>

            {/* ── Access gate ── */}
            {accessLoading ? renderAccessLoading() : !access.canView ? (
              <AccessDenied
                useTokens={true}
                tokens={{...K, accent: APPLE.blue, accentHover: APPLE.blue, accentLight: `${APPLE.blue}14`, text: K.ink, textMuted: K.muted, textSub: K.muted, success: APPLE.green, error: APPLE.red, errorBg: `${APPLE.red}14`, gold: APPLE.orange, goldLight: `${APPLE.orange}14`, teal: APPLE.blue, tealLight: `${APPLE.blue}14`, cardBg: K.glass, cardBorder: K.hairline, inputBg: K.glass, inputBorder: K.hairline, bg: K.bg, fontStack }}
                message="You don't have permission to view this page. Contact your administrator for access."
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* ── Action bar ── */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="nx-btn-primary"
                        onClick={generateReport}
                        disabled={!canGenerate}
                        title={generateTooltip}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                          border: 'none',
                          cursor: canGenerate ? 'pointer' : 'not-allowed',
                          background: canGenerate
                            ? `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`
                            : K.chipBg,
                          color: canGenerate ? '#fff' : K.faint,
                          opacity: canGenerate ? 1 : 0.6,
                          transition: 'all 0.2s',
                          boxShadow: canGenerate ? `0 4px 16px -6px ${APPLE.blue}88` : 'none',
                          fontFamily: fontStack,
                        }}
                      >
                        {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Zap size={14} />}
                        {loading ? 'Generating…' : 'Generate Report'}
                      </button>

                      <button
                        className="nx-btn-secondary"
                        onClick={syncPayouts}
                        disabled={syncing || loading || !hasRebatesSelected}
                        title={!hasRebatesSelected ? 'Select a rebate code to sync' : 'Sync SAP payout data'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                          border: `1px solid ${K.hairline}`,
                          background: 'transparent', color: K.muted,
                          cursor: (!syncing && !loading && hasRebatesSelected) ? 'pointer' : 'not-allowed',
                          opacity: (!syncing && !loading && hasRebatesSelected) ? 1 : 0.5,
                          transition: 'all 0.2s', fontFamily: fontStack,
                        }}
                        onMouseEnter={(e) => { if (syncing || loading || !hasRebatesSelected) return; e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <RefreshCw size={14} style={syncing ? { animation: 'spin 0.8s linear infinite' } : {}} />
                        {syncing ? 'Syncing…' : 'Sync Payouts'}
                      </button>

                      {showReport && reportData && (
                        <button
                          className="nx-btn-secondary"
                          onClick={clearReport}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '9px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                            border: `1px solid ${K.hairline}`, background: 'transparent', color: K.muted,
                            cursor: 'pointer', transition: 'all 0.2s', fontFamily: fontStack,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = K.ink; e.currentTarget.style.background = K.hover; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = K.muted; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <X size={13} /> Clear
                        </button>
                      )}
                    </div>

                    <div style={{ position: 'relative' }}>
                      <button
                        disabled={!access.canExport || !showReport || !reportData}
                        title={!access.canExport ? 'No export permission' : !showReport ? 'No data' : 'Export'}
                        onClick={() => { if (access.canExport && showReport && reportData) setShowExportDropdown(v => !v); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '9px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                          border: `1px solid ${(access.canExport && showReport && reportData) ? `${APPLE.blue}55` : K.hairline}`,
                          background: (access.canExport && showReport && reportData) ? `${APPLE.blue}1c` : K.chipBg,
                          color: (access.canExport && showReport && reportData) ? APPLE.blue : K.faint,
                          cursor: (access.canExport && showReport && reportData) ? 'pointer' : 'not-allowed',
                          opacity: (access.canExport && showReport && reportData) ? 1 : 0.5,
                          transition: 'all 0.2s', fontFamily: fontStack,
                        }}
                      >
                        <Download size={13} /> Export <ChevronDown size={13} />
                      </button>
                      {showExportDropdown && access.canExport && (
                        <div
                          className="dash-glass dash-pop"
                          style={{
                            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                            width: 220, borderRadius: 16, zIndex: 50,
                            background: K.glassDeep,
                            border: `1px solid ${K.rim}`,
                            boxShadow: K.shadow,
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid ${K.hairline}` }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: K.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Export as</p>
                          </div>
                          {[
                            { label: 'PDF Document',   ext: 'pdf',  icon: <FileText size={15} color={APPLE.red} />,        fn: exportToPDF   },
                            { label: 'Excel Workbook', ext: 'xlsx', icon: <FileSpreadsheet size={15} color={APPLE.green} />, fn: exportToExcel },
                          ].map(({ label, ext, icon, fn }) => (
                            <button
                              key={ext}
                              onClick={() => { fn(); setShowExportDropdown(false); }}
                              style={{
                                width: '100%', textAlign: 'left',
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '11px 14px', fontSize: 13, color: K.ink,
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                transition: 'all 0.15s', fontFamily: fontStack,
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = K.chipBg}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              {icon}
                              <div>
                                <div style={{ fontWeight: 500 }}>{label}</div>
                                <div style={{ fontSize: 11, color: K.muted }}>Save as .{ext}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Filter bar ── */}
                  <div className="dash-glass" style={{ position: 'relative', zIndex: 30, background: K.glass, border: `1px solid ${K.hairline}`, borderRadius: 18, padding: '20px 22px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: 18 }}>

                      {/* Rebate Codes (optional) */}
                      <div className="rebate-dropdown-container" style={{ position: 'relative' }}>
                        <label style={labelStyle}>
                          <BarChart2 size={12} color={APPLE.blue} />
                          Rebate Codes <span style={{ color: K.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                        </label>
                        <button
                          type="button"
                          className="nx-select"
                          onClick={() => {
                            setShowRebateDropdown(v => !v);
                            setTempSelectedRebates([...selectedRebates]);
                          }}
                          style={{
                            ...inputStyle,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            textAlign: 'left', cursor: 'pointer', appearance: 'none',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedRebates.length === 0
                              ? '— All Rebates per Customer —'
                              : selectedRebates.length === rebates.length
                                ? `All rebates (${selectedRebates.length})`
                                : selectedRebates.length === 1
                                  ? selectedRebates[0]
                                  : `${selectedRebates.length} selected`}
                          </span>
                          <ChevronDown size={14} color={K.faint} />
                        </button>

                        {showRebateDropdown && rebates.length > 0 && (
                          <div
                            className="dash-glass dash-pop"
                            style={{
                              position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                              width: '100%', maxHeight: 300, overflowY: 'auto',
                              background: K.glassDeep, border: `1px solid ${K.rim}`,
                              borderRadius: 16, boxShadow: K.shadow,
                              zIndex: 100, padding: '6px 0',
                            }}
                          >
                            <div
                              style={{
                                padding: '8px 12px', borderBottom: `1px solid ${K.hairline}`,
                                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                background: K.chipBg,
                              }}
                              onClick={() => {
                                const allSelected = tempSelectedRebates.length === rebates.length;
                                setTempSelectedRebates(allSelected ? [] : rebates.map(r => r.RebateCode));
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={tempSelectedRebates.length === rebates.length && rebates.length > 0}
                                readOnly
                                style={{ accentColor: APPLE.blue }}
                              />
                              <span style={{ fontSize: 12, fontWeight: 600, color: K.ink }}>Select All</span>
                            </div>

                            {rebates.map(r => (
                              <div
                                key={r.RebateCode}
                                style={{
                                  padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                                  cursor: 'pointer', transition: 'background 0.1s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = K.chipBg}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                onClick={() => {
                                  const exists = tempSelectedRebates.includes(r.RebateCode);
                                  setTempSelectedRebates(prev =>
                                    exists ? prev.filter(c => c !== r.RebateCode) : [...prev, r.RebateCode]
                                  );
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={tempSelectedRebates.includes(r.RebateCode)}
                                  readOnly
                                  style={{ accentColor: APPLE.blue }}
                                />
                                <span style={{ fontSize: 12, color: K.ink }}>{r.RebateCode}</span>
                              </div>
                            ))}

                            <div style={{ padding: '8px 12px', borderTop: `1px solid ${K.hairline}`, display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => {
                                  handleRebatesChange(tempSelectedRebates);
                                  setShowRebateDropdown(false);
                                }}
                                style={{
                                  flex: 1, padding: '6px 12px', borderRadius: 999, border: 'none',
                                  background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                                  color: '#fff', fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer', fontFamily: fontStack,
                                  boxShadow: `0 4px 12px -4px ${APPLE.blue}88`,
                                }}
                              >
                                Apply
                              </button>
                              {tempSelectedRebates.length > 0 && (
                                <button
                                  onClick={() => {
                                    setTempSelectedRebates([]);
                                    handleRebatesChange([]);
                                    setShowRebateDropdown(false);
                                  }}
                                  title="Leave blank to use every rebate code each selected customer is enrolled in"
                                  style={{
                                    padding: '6px 12px', borderRadius: 999,
                                    border: `1px solid ${K.hairline}`,
                                    background: 'transparent', color: K.muted,
                                    fontSize: 12, fontWeight: 500,
                                    cursor: 'pointer', fontFamily: fontStack,
                                  }}
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {rebateInfo && (
                          <p style={{ fontSize: 11, color: K.muted, marginTop: 6, fontFamily: monoStack }}>
                            {rebateInfo.DateFrom} → {rebateInfo.DateTo} · {rebateInfo.Frequency}
                          </p>
                        )}
                      </div>

                      {/* Customers (REQUIRED, searchable) */}
                      <div className="customer-dropdown-container" style={{ position: 'relative' }}>
                        <label style={labelStyle}>
                          <Users size={12} color={APPLE.blue} /> Customers <span style={{ color: APPLE.blue }}>*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (allCustomers.length === 0) return;
                            setShowCustomerDropdown(v => !v);
                            setTempSelectedCustomers([...selectedCustomers]);
                            setCustomerSearch("");
                          }}
                          disabled={customersLoading || allCustomers.length === 0}
                          style={{
                            ...inputStyle,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            textAlign: 'left',
                            cursor: (customersLoading || allCustomers.length === 0) ? 'not-allowed' : 'pointer',
                            opacity: (customersLoading || allCustomers.length === 0) ? 0.6 : 1,
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {customersLoading
                              ? 'Loading customers…'
                              : selectedCustomers.length === 0
                                ? 'Select customer(s) — required'
                                : selectedCustomers.length === allCustomers.length
                                  ? `All customers (${selectedCustomers.length})`
                                  : `${selectedCustomers.length} selected`}
                          </span>
                          {customersLoading
                            ? <RefreshCw size={14} color={K.faint} style={{ animation: 'spin 0.8s linear infinite' }} />
                            : <ChevronDown size={14} color={K.faint} />}
                        </button>

                        {showCustomerDropdown && allCustomers.length > 0 && (
                          <div
                            className="dash-glass dash-pop"
                            style={{
                              position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                              width: '100%',
                              background: K.glassDeep,
                              border: `1px solid ${K.rim}`,
                              borderRadius: 16,
                              boxShadow: K.shadow,
                              zIndex: 100,
                              display: 'flex',
                              flexDirection: 'column',
                              maxHeight: 440,
                              overflow: 'hidden',
                            }}
                          >
                            {/* Search box */}
                            <div style={{ padding: 8, borderBottom: `1px solid ${K.hairline}`, flexShrink: 0 }}>
                              <div style={{ position: 'relative' }}>
                                <Search
                                  size={13}
                                  color={K.faint}
                                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                                />
                                <input
                                  type="text"
                                  placeholder="Search customer name or code…"
                                  value={customerSearch}
                                  onChange={(e) => setCustomerSearch(e.target.value)}
                                  autoFocus
                                  style={{
                                    width: '100%',
                                    padding: '8px 30px 8px 30px',
                                    background: K.chipBg,
                                    border: `1px solid ${K.hairline}`,
                                    borderRadius: 10,
                                    fontSize: 12,
                                    color: K.ink,
                                    fontFamily: fontStack,
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                  }}
                                />
                                {customerSearch && (
                                  <button
                                    type="button"
                                    onClick={() => setCustomerSearch('')}
                                    style={{
                                      position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                                      border: 'none', background: 'transparent', cursor: 'pointer',
                                      color: K.muted, padding: 2, display: 'flex', alignItems: 'center',
                                    }}
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Select-all (respects search) */}
                            <div
                              style={{
                                padding: '8px 12px',
                                borderBottom: `1px solid ${K.hairline}`,
                                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                background: K.chipBg, flexShrink: 0,
                              }}
                              onClick={() => {
                                const allFilteredSelected =
                                  filteredCustomers.length > 0 &&
                                  filteredCustomers.every(c => tempSelectedCustomers.some(x => x.CardCode === c.CardCode));

                                if (allFilteredSelected) {
                                  const filteredSet = new Set(filteredCustomers.map(c => c.CardCode));
                                  setTempSelectedCustomers(prev => prev.filter(c => !filteredSet.has(c.CardCode)));
                                } else {
                                  const existing = new Set(tempSelectedCustomers.map(c => c.CardCode));
                                  const toAdd    = filteredCustomers.filter(c => !existing.has(c.CardCode));
                                  setTempSelectedCustomers(prev => [...prev, ...toAdd]);
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  filteredCustomers.length > 0 &&
                                  filteredCustomers.every(c => tempSelectedCustomers.some(x => x.CardCode === c.CardCode))
                                }
                                readOnly
                                style={{ accentColor: APPLE.blue }}
                              />
                              <span style={{ fontSize: 12, fontWeight: 600, color: K.ink }}>
                                {customerSearch
                                  ? `Select all results (${filteredCustomers.length})`
                                  : `Select All (${allCustomers.length})`}
                              </span>
                              <span style={{ marginLeft: 'auto', fontSize: 11, color: K.muted, fontFamily: monoStack }}>
                                {tempSelectedCustomers.length} selected
                              </span>
                            </div>

                            {/* List */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                              {filteredCustomers.length === 0 ? (
                                <p style={{ padding: '20px 12px', fontSize: 12, color: K.muted, textAlign: 'center', margin: 0 }}>
                                  No customers match “{customerSearch}”
                                </p>
                              ) : (
                                filteredCustomers.map(cust => (
                                  <div
                                    key={cust.CardCode}
                                    style={{
                                      padding: '8px 12px',
                                      display: 'flex', alignItems: 'center', gap: 8,
                                      cursor: 'pointer', transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = K.chipBg}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    onClick={() => {
                                      const exists = tempSelectedCustomers.some(c => c.CardCode === cust.CardCode);
                                      setTempSelectedCustomers(prev =>
                                        exists
                                          ? prev.filter(c => c.CardCode !== cust.CardCode)
                                          : [...prev, cust]
                                      );
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={tempSelectedCustomers.some(c => c.CardCode === cust.CardCode)}
                                      readOnly
                                      style={{ accentColor: APPLE.blue }}
                                    />
                                    <span style={{ fontSize: 12, color: K.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {cust.CardName}
                                      <span style={{ color: K.muted, marginLeft: 4 }}>({cust.CardCode})</span>
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Footer */}
                            <div style={{ padding: 8, borderTop: `1px solid ${K.hairline}`, display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => { setSelectedCustomers(tempSelectedCustomers); setShowCustomerDropdown(false); }}
                                style={{
                                  flex: 1, padding: '7px 12px', borderRadius: 999, border: 'none',
                                  background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                                  color: '#fff', fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer', fontFamily: fontStack,
                                  boxShadow: `0 4px 12px -4px ${APPLE.blue}88`,
                                }}
                              >
                                Apply
                              </button>
                              <button
                                type="button"
                                onClick={() => setTempSelectedCustomers([])}
                                style={{
                                  padding: '7px 12px', borderRadius: 999,
                                  border: `1px solid ${K.hairline}`,
                                  background: 'transparent', color: K.muted,
                                  fontSize: 12, fontWeight: 500,
                                  cursor: 'pointer', fontFamily: fontStack,
                                }}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Date From */}
                      <div>
                        <label style={labelStyle}>
                          <Calendar size={12} color={APPLE.blue} /> Date From <span style={{ color: APPLE.blue }}>*</span>
                        </label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="nx-input" style={inputStyle} />
                      </div>

                      {/* Date To */}
                      <div>
                        <label style={labelStyle}>
                          <Calendar size={12} color={APPLE.blue} /> Date To <span style={{ color: APPLE.blue }}>*</span>
                        </label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="nx-input" style={inputStyle} />
                      </div>
                    </div>
                  </div>

                  {/* ── Messages ── */}
                  {errorMsg && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '11px 14px', borderRadius: 14,
                      background: `${APPLE.red}14`, border: `1px solid ${APPLE.red}33`,
                    }}>
                      <AlertCircle size={15} color={APPLE.red} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ flex: 1, fontSize: 13, color: APPLE.red, fontFamily: fontStack }}>{errorMsg}</span>
                      <button onClick={() => setErrorMsg("")} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: APPLE.red, padding: 0, lineHeight: 1 }}><X size={14} /></button>
                    </div>
                  )}
                  {successMsg && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '11px 14px', borderRadius: 14,
                      background: `${APPLE.green}14`, border: `1px solid ${APPLE.green}33`,
                    }}>
                      <CheckCircle size={15} color={APPLE.green} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ flex: 1, fontSize: 13, color: APPLE.green, fontFamily: fontStack }}>{successMsg}</span>
                      <button onClick={() => setSuccessMsg("")} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: APPLE.green, padding: 0, lineHeight: 1 }}><X size={14} /></button>
                    </div>
                  )}

                  {loading && activeJobId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, background: `${APPLE.blue}14`, border: `1px solid ${APPLE.blue}33` }}>
                      {getStatusIcon(jobStatus)}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: APPLE.blue, margin: 0 }}>Generating report…</p>
                        <p style={{ fontSize: 11, color: K.muted, margin: '2px 0 0', fontFamily: monoStack }}>{activeJobId}</p>
                      </div>
                    </div>
                  )}

                  {loading && (
                    <div className="dash-glass" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      minHeight: 380, borderRadius: 18,
                      border: `1px dashed ${K.hairline}`,
                      background: K.glass,
                    }}>
                      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{ position: 'relative', width: 56, height: 56 }}>
                          <div style={{ width: 56, height: 56, borderRadius: '50%', border: `4px solid ${K.hairline}`, position: 'absolute' }} />
                          <div style={{ width: 56, height: 56, borderRadius: '50%', border: `4px solid ${APPLE.blue}`, borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite', position: 'absolute' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 700, color: K.ink, margin: '0 0 6px' }}>Building Your Report</h3>
                          <p style={{ fontSize: 12, color: K.muted, margin: 0 }}>
                            Fetching data for{' '}
                            <span style={{ fontWeight: 700, color: APPLE.blue, fontFamily: monoStack }}>
                              {selectedCustomers.length} customer(s)
                            </span>
                            {selectedRebates.length > 0 && (
                              <>
                                {' '}·{' '}
                                <span style={{ fontWeight: 700, color: APPLE.blue, fontFamily: monoStack }}>
                                  {selectedRebates.join(', ')}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!loading && showReport && reportData && (() => {
                    const pages      = getPaginatedPages(reportData.reportRows);
                    const totalPages = pages.length;
                    const safePage   = Math.min(currentPage, totalPages - 1);
                    return (
                      <div className="dash-glass" style={{ background: K.glass, border: `1px solid ${K.hairline}`, borderRadius: 18, padding: '20px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: K.ink, margin: 0 }}>Report Preview</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{
                              padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                              background: `${APPLE.blue}14`, color: APPLE.blue, fontFamily: monoStack,
                            }}>
                              {reportData.reportRows.length} accounts
                            </span>
                            {totalPages > 1 && (
                              <span style={{
                                padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                                background: `${APPLE.orange}14`, color: APPLE.orange, fontFamily: monoStack,
                              }}>
                                {totalPages} pages
                              </span>
                            )}
                            {reportData.salesAgent && (
                              <span style={{
                                padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                                background: K.chipBg, color: K.muted, fontFamily: monoStack,
                              }}>
                                Agent: {reportData.salesAgent}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="dash-scroll" style={{
                          overflowX: 'auto',
                          background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
                          borderRadius: 14,
                          padding: '24px',
                        }}>
                          <div ref={reportContainerRef} style={{ position: 'relative', width: '1050px', margin: '0 auto' }}>
                            {pages.map((pageRows, pageIndex) =>
                              renderReportPage(pageRows, pageIndex, totalPages, pageIndex === safePage)
                            )}
                          </div>
                        </div>

                        {totalPages > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                              disabled={safePage === 0}
                              style={{
                                width: 32, height: 32, borderRadius: 999,
                                border: `1px solid ${K.hairline}`, background: 'transparent',
                                color: K.ink, cursor: safePage === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: safePage === 0 ? 0.35 : 1, transition: 'all 0.15s',
                              }}
                            >
                              <ChevronLeft size={15} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => {
                              const isEdge     = i === 0 || i === totalPages - 1;
                              const isNearCur  = Math.abs(i - safePage) <= 1;
                              const isDotLeft  = i === 1 && safePage > 2;
                              const isDotRight = i === totalPages - 2 && safePage < totalPages - 3;
                              if (!isEdge && !isNearCur) {
                                if (isDotLeft || isDotRight) return <span key={`dots-${i}`} style={{ fontSize: 13, color: K.muted, padding: '0 2px', userSelect: 'none' }}>&hellip;</span>;
                                return null;
                              }
                              return (
                                <button
                                  key={i}
                                  onClick={() => setCurrentPage(i)}
                                  style={{
                                    minWidth: 32, height: 32, padding: '0 8px',
                                    borderRadius: 999, fontSize: 12, fontWeight: 600,
                                    border: `1px solid ${i === safePage ? 'transparent' : K.hairline}`,
                                    background: i === safePage
                                      ? `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`
                                      : 'transparent',
                                    color: i === safePage ? '#fff' : K.ink,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    fontFamily: fontStack,
                                    boxShadow: i === safePage ? `0 4px 12px -4px ${APPLE.blue}88` : 'none',
                                  }}
                                >
                                  {i + 1}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                              disabled={safePage === totalPages - 1}
                              style={{
                                width: 32, height: 32, borderRadius: 999,
                                border: `1px solid ${K.hairline}`, background: 'transparent',
                                color: K.ink, cursor: safePage === totalPages - 1 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: safePage === totalPages - 1 ? 0.35 : 1, transition: 'all 0.15s',
                              }}
                            >
                              <ChevronRight size={15} />
                            </button>
                            <span style={{ fontSize: 11, color: K.muted, marginLeft: 6, fontFamily: monoStack }}>{safePage + 1} / {totalPages}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {!loading && !showReport && !activeJobId && (
                    <div className="dash-glass" style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '100%', maxWidth: 1050, height: 440,
                      margin: '0 auto', borderRadius: 18,
                      border: `2px dashed ${K.hairline}`,
                      background: K.glass,
                    }}>
                      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: `${APPLE.blue}1c`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <BarChart2 size={24} color={APPLE.blue} />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: K.ink, margin: '0 0 4px' }}>No report generated yet</p>
                          <p style={{ fontSize: 12, color: K.muted, margin: 0, maxWidth: 480 }}>
                            Pick a <strong>date range</strong> and at least one <strong>customer</strong>.
                            Rebate codes are optional — leave them blank to include{' '}
                            <strong>every rebate</strong> each customer is enrolled in. Then click{' '}
                            <strong style={{ color: APPLE.blue }}>Generate Report</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ══ Right sidebar ══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24, alignSelf: 'start' }}>
                  <div className="dash-glass" style={{ background: K.glass, border: `1px solid ${K.hairline}`, borderRadius: 18, padding: '18px 18px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <Clock size={15} color={K.muted} />
                      <h3 style={{ fontSize: 12, fontWeight: 700, color: K.ink, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activity</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                      {loading && activeJobId && (
                        <div style={{ padding: '10px 12px', borderRadius: 14, background: `${APPLE.blue}14`, border: `1px solid ${APPLE.blue}33`, animation: 'pulse-ring 1.5s infinite' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            {getStatusIcon(jobStatus)}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: K.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {selectedRebates.length > 0 ? selectedRebates.join(', ') : `${selectedCustomers.length} customer(s)`}
                              </p>
                              <p style={{ fontSize: 11, color: K.muted, margin: '2px 0 4px', fontFamily: monoStack }}>{formatJobDate(new Date().toISOString())}</p>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: `${APPLE.blue}1c`, color: APPLE.blue }}>Processing</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!loading && showReport && reportData && (
                        <div style={{ padding: '10px 12px', borderRadius: 14, background: `${APPLE.green}14`, border: `1px solid ${APPLE.green}33` }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <CheckCircle size={14} color={APPLE.green} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: K.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: monoStack }}>
                                {reportData.rebateCodes && reportData.rebateCodes.length > 0
                                  ? reportData.rebateCodes.join(', ')
                                  : 'All rebates per customer'}
                              </p>
                              <p style={{ fontSize: 11, color: K.muted, margin: '2px 0', fontFamily: monoStack }}>{formatJobDate(new Date().toISOString())}</p>
                              <p style={{ fontSize: 11, color: K.muted, margin: '0 0 4px' }}>
                                {reportData.reportRows.length} accounts
                                {getPaginatedPages(reportData.reportRows).length > 1 && ` · ${getPaginatedPages(reportData.reportRows).length} pages`}
                              </p>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: `${APPLE.green}1c`, color: APPLE.green }}>Completed</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!loading && jobStatus === 'failed' && jobError && (
                        <div style={{ padding: '10px 12px', borderRadius: 14, background: `${APPLE.red}14`, border: `1px solid ${APPLE.red}33` }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <XCircle size={14} color={APPLE.red} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: K.ink, margin: 0, fontFamily: monoStack }}>
                                {selectedRebates.length > 0 ? selectedRebates.join(', ') : 'Failed'}
                              </p>
                              <p style={{ fontSize: 11, color: APPLE.red, margin: '3px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={jobError}>{jobError}</p>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: `${APPLE.red}1c`, color: APPLE.red }}>Failed</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!loading && !showReport && !activeJobId && jobStatus !== 'failed' && (
                        <p style={{ fontSize: 12, textAlign: 'center', color: K.muted, padding: '20px 0', margin: 0 }}>No activity yet</p>
                      )}
                    </div>
                  </div>

                  {showReport && reportData && (() => {
                    const t = getTotalsAmounts(reportData.totals);
                    const items = [
                      { label: 'Total Rebates Earned',  value: fmtCurrency(t.rebates),  color: APPLE.blue   },
                      { label: 'Total Released', value: fmtCurrency(t.released), color: APPLE.orange },
                      { label: 'Balance',        value: fmtCurrency(t.balance),  color: t.balance < 0 ? APPLE.red : APPLE.green },
                    ];
                    return (
                      <div className="dash-glass dash-pop" style={{ background: K.glass, border: `1px solid ${K.hairline}`, borderRadius: 18, padding: '16px 18px' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: K.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
                          Summary
                        </p>
                        {items.map(({ label, value, color }, idx) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < items.length - 1 ? `1px solid ${K.hairline}` : 'none' }}>
                            <span style={{ fontSize: 12, color: K.muted }}>{label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: monoStack }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Vcp_Reports;