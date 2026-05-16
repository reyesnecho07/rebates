import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from 'axios';
import {
  FileText,
  BarChart2,
  FileSpreadsheet,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  TrendingUp,
  Download,
  Zap,
  Users,
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

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n, decimals = 2) =>
  (parseFloat(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const fmtCurrency = (n) => `${fmt(n)}`;

const ROWS_FIRST_PAGE = 19;
const ROWS_OTHER_PAGE = 25;

// ─── Border constants (one-sided — same technique as VAN report) ─────────────
// Table provides borderLeft + borderTop (outer edges).
// Cells only carry borderRight + borderBottom so lines never double up.
const BORDER_HEADER = '1px solid #374151';
const BORDER_DATA   = '1px solid #374151';

// ─── Table wrapper: supplies the missing left + top outer borders ────────────
const reportTableStyle = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: '10px',
  flexShrink: 0,
  borderLeft: BORDER_HEADER,
  borderTop:  BORDER_HEADER,
};

// ─── Shared th / td style factories ─────────────────────────────────────────
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

// ─── Font injection ──────────────────────────────────────────────────────────
const injectFonts = () => {
  if (document.getElementById('vcp-report-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'vcp-report-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

function Vcp_Reports() {
  useEffect(() => { injectFonts(); }, []);

  const { theme, updateTheme } = useTheme();
  const location = useLocation();
  const reportContainerRef = useRef(null);
  const routePath = '/Vcp_Reports';

  const [collapsed,           setCollapsed]           = useState(false);
  const [showVanDropdown,     setShowVanDropdown]     = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown,     setShowVcpDropdown]     = useState(true);

  const [userName,  setUserName]  = useState("");
  const [userCode,  setUserCode]  = useState("");
  const [initials,  setInitials]  = useState("");

  const [rebates,        setRebates]        = useState([]);
  const [selectedRebate, setSelectedRebate] = useState("");

  const [availableCustomers, setAvailableCustomers]     = useState([]);   // full customer list for selected rebate
  const [selectedCustomers, setSelectedCustomers]       = useState([]);   // currently selected customers
  const [tempSelectedCustomers, setTempSelectedCustomers] = useState([]); // temporary selection in dropdown
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customersLoading, setCustomersLoading]         = useState(false);
  const [rebateInfo,     setRebateInfo]     = useState(null);
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");

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
  const DB_NAME  = 'VCP_OWN';

  useComponentRegistration({
    name: 'Vcp_Reports',
    version: '3.0.0',
    description: 'Cash Fund per Account report for Percentage rebate programmes.',
    routePath: '/Vcp_Reports',
  });

  // ─── Design tokens ──────────────────────────────────────────────────────
  const isDark    = theme === 'dark';
  const fontStack = "'Outfit', system-ui, sans-serif";
  const monoStack = "'DM Mono', monospace";
  const tokens = {
    bg:          isDark ? '#0f1117' : '#f4f6fb',
    cardBg:      isDark ? '#1a1d27' : '#ffffff',
    cardBorder:  isDark ? '#2a2e3e' : '#e4e8f0',
    inputBg:     isDark ? '#12151e' : '#f8fafc',
    inputBorder: isDark ? '#2e3348' : '#dde2ec',
    text:        isDark ? '#e8ecf4' : '#1e2540',
    textMuted:   isDark ? '#6b7494' : '#7b869e',
    textSub:     isDark ? '#9099b8' : '#5a6380',
    accent:      '#3b6ef6',
    accentHover: '#2a5ce8',
    accentLight: isDark ? 'rgba(59,110,246,0.15)' : 'rgba(59,110,246,0.08)',
    success:     isDark ? '#10b981' : '#059669',
    successBg:   isDark ? 'rgba(16,185,129,0.1)' : 'rgba(5,150,105,0.06)',
    error:       isDark ? '#f87171' : '#dc2626',
    errorBg:     isDark ? 'rgba(248,113,113,0.1)' : 'rgba(220,38,38,0.06)',
    gold:        '#f59e0b',
    goldLight:   isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
    fontStack,
  };

  // ─── Helpers ────────────────────────────────────────────────────────────
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
    const code = selectedRebate || 'REPORT';
    return `CashFund_${code}_${date}.${extension}`;
  }, [selectedRebate, getCurrentDateForFilename]);

  const getPaginatedPages = useCallback((rows) => {
    if (!rows || rows.length === 0) return [[]];
    const pages = [];
    let remaining = [...rows];
    pages.push(remaining.splice(0, ROWS_FIRST_PAGE));
    while (remaining.length > 0) {
      pages.push(remaining.splice(0, ROWS_OTHER_PAGE));
    }
    return pages;
  }, []);

  // ─── Lifecycle ──────────────────────────────────────────────────────────
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
        setSelectedRebate(p.rebateCode || "");
      }
      if (savedShow) setShowReport(JSON.parse(savedShow));
    } catch (e) { console.error('Restore error:', e); }
  }, []); // eslint-disable-line

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
  useEffect(() => { localStorage.setItem("savedCashFundParams", JSON.stringify({ dateFrom, dateTo, rebateCode: selectedRebate })); }, [dateFrom, dateTo, selectedRebate]);
  useEffect(() => { localStorage.setItem("savedCashFundShow", JSON.stringify(showReport)); }, [showReport]);
  useEffect(() => { setCurrentPage(0); }, [reportData]);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/vcp/report/rebates?db=${DB_NAME}`);
        const data = await res.json();
        if (data.success) setRebates(data.data || []);
      } catch (e) { console.error('Error fetching rebates:', e); }
    })();
  }, [API_BASE]);


  // Close customer dropdown when clicking outside
useEffect(() => {
  const handleClickOutside = (e) => {
    if (showCustomerDropdown && !e.target.closest('.customer-dropdown-container')) {
      setShowCustomerDropdown(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [showCustomerDropdown]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleRebateChange = useCallback(async (code) => {
    setSelectedRebate(code);
    setShowReport(false);
    setReportData(null);
    setErrorMsg("");
    setSuccessMsg("");
    setJobStatus(null);
    setJobError(null);
    setCurrentPage(0);
    setAvailableCustomers([]);
    setSelectedCustomers([]);
    setTempSelectedCustomers([]);

    const found = rebates.find(r => r.RebateCode === code) || null;
    setRebateInfo(found);
    if (found) {
      if (found.DateFrom) setDateFrom(found.DateFrom);
      if (found.DateTo)   setDateTo(found.DateTo);
    } else {
      setDateFrom("");
      setDateTo("");
    }

    // Fetch customers for this rebate code
    if (code) {
      setCustomersLoading(true);
      try {
      const res = await fetch(`${API_BASE}/vcp/report/rebates/${code}/customers?db=${DB_NAME}`);
      const data = await res.json();
      if (data.success && data.data) {
        // data.data is the array of customer rows from getCustomersByRebate
        // They might be duplicated due to multiple items; we need unique CardCode
        const uniqueCustomers = [];
        const seen = new Set();
        data.data.forEach(row => {
          if (row.CardCode && !seen.has(row.CardCode)) {
            seen.add(row.CardCode);
            uniqueCustomers.push({ CardCode: row.CardCode, CardName: row.CardName });
          }
        });
        setAvailableCustomers(uniqueCustomers);
        setSelectedCustomers(uniqueCustomers);
        setTempSelectedCustomers(uniqueCustomers);
      } else {
        console.error('Failed to fetch customers:', data.error);
        setErrorMsg(`Failed to load customers: ${data.error || 'Unknown error'}`);
      }
      } catch (e) {
        console.error('Error fetching customers for rebate code:', e);
        setErrorMsg(`Failed to load customers for rebate code "${code}".`);
      } finally {
        setCustomersLoading(false);
      }
    }
  }, [rebates, API_BASE, DB_NAME]);

    const generateReport = async () => {
      if (!access.canCreate) { alert("You do not have permission to generate reports."); return; }
      if (!selectedRebate)   { setErrorMsg("Please select a rebate code first."); return; }
      if (selectedCustomers.length === 0) { setErrorMsg("Please select at least one customer."); return; }

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
            rebateCode: selectedRebate,
            customerCodes,
            dateFrom: dateFrom || null,
            dateTo: dateTo || null,
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
    if (!selectedRebate) { setErrorMsg("Please select a rebate code first."); return; }
    setSyncing(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res  = await fetch(`${API_BASE}/vcp/report/sync-payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rebateCode: selectedRebate, dateFrom, dateTo, db: DB_NAME }),
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
    setAvailableCustomers([]); 
    setSelectedCustomers([]);
    setTempSelectedCustomers([]);
    ['savedCashFundData', 'savedCashFundParams', 'savedCashFundShow'].forEach(k => localStorage.removeItem(k));
  };

  // ─── Exports ─────────────────────────────────────────────────────────────
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
      const aoa = [
        ['Cash Fund per Account'],
        [`As of ${getMonthLabel()}`],
        [],
        [`Sales Agent: ${reportData.salesAgent || ''}`],
        ['Area:'],
        [],
        ['Account Code','Account Name','Total number of CTNS','Total P. Value','Total AVAILABLE CASH FUNDS','Total CASHFUNDS Released'],
        ...reportData.reportRows.map(r => [r.accountCode, r.accountName, r.totalCTNs, r.totalPValue, r.totalAvailableCashFunds, r.totalCashFundsReleased]),
        ['', 'TOTAL', reportData.totals.totalCTNs, reportData.totals.totalPValue, reportData.totals.totalAvailableCashFunds, reportData.totals.totalCashFundsReleased],
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 18 },{ wch: 42 },{ wch: 22 },{ wch: 20 },{ wch: 28 },{ wch: 28 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cash Fund Report');
      saveAs(
        new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }),
        generateFilename('xlsx')
      );
    } catch (e) { console.error('Excel error:', e); alert('Failed to generate Excel file. Please try again.'); }
  };

  // ─── Status icon ─────────────────────────────────────────────────────────
  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing': return <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />;
      case 'completed':  return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'failed':     return <XCircle className="w-4 h-4 text-rose-400" />;
      default:           return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatJobDate = (ds) =>
    new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ─── Access loading spinner ───────────────────────────────────────────────
  const renderAccessLoading = () => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'380px', fontFamily: fontStack }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'14px' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${tokens.cardBorder}`,
          borderTopColor: tokens.accent,
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: 13, color: tokens.textMuted, fontFamily: fontStack }}>Verifying access…</p>
      </div>
    </div>
  );

  // ─── Report page (PDF target) ─────────────────────────────────────────────
  // Key fix: table uses borderCollapse:'separate' + borderSpacing:0 with
  // borderLeft+borderTop on the <table> element itself, and cells only carry
  // borderRight+borderBottom — preventing doubled/shadowed borders in the
  // html2canvas → PDF render (same technique as VAN report).
  const renderReportPage = (pageRows, pageIndex, totalPages, visible) => {
    const isFirstPage = pageIndex === 0;
    const isLastPage  = pageIndex === totalPages - 1;
    const hiddenStyle = {
      position: 'absolute', top: '-99999px', left: '-99999px',
      opacity: 0, pointerEvents: 'none',
    };

    const COLS = [
      { label: 'Account Code',                  width: '14%', align: 'left'   },
      { label: 'Account Name',                  width: '28%', align: 'left'   },
      { label: 'Total number\nof CTNS',         width: '13%', align: 'center' },
      { label: 'Total P. Value',                width: '15%', align: 'center' },
      { label: 'Total AVAILABLE\nCASH FUNDS',   width: '15%', align: 'center' },
      { label: 'Total CASHFUNDS\nReleased',      width: '15%', align: 'center' },
    ];

    return (
      <div
        key={pageIndex}
        className="report-page bg-white border border-gray-300 shadow-lg"
        style={{
          width: '1050px',
          height: '742px',
          padding: '36px 48px 28px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Arial, sans-serif',
          fontSize: '11px',
          color: '#1a1a1a',
          overflow: 'hidden',
          ...(visible ? {} : hiddenStyle),
        }}
      >
        {/* ── First-page header ── */}
        {isFirstPage && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
              <div>
                <div style={{ fontWeight:'bold', fontSize:'13px' }}>Cash Fund per Account</div>
                <div style={{ fontSize:'11px', color:'#333' }}>As of {getMonthLabel()}</div>
              </div>
              <img src={vcpReport} alt="VCP" style={{ width:'90px', height:'auto' }} />
            </div>
            <div style={{ fontSize:'11px', marginBottom:'2px' }}>
              <span style={{ fontWeight:'600' }}>Sales Agent:</span>&nbsp;{reportData.salesAgent || ''}
            </div>
            <div style={{ fontSize:'11px', marginBottom:'14px' }}>
              <span style={{ fontWeight:'600' }}>Area:</span>
            </div>
          </>
        )}

        {/* ── Data table ── */}
        {/*
          borderCollapse:'separate' + borderSpacing:0 is the key.
          The <table> itself carries borderLeft + borderTop (outer frame).
          Each <th>/<td> only has borderRight + borderBottom.
          This prevents html2canvas from rendering doubled lines between cells.
        */}
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
            {pageRows.map((row, idx) => (
              <tr key={row.accountCode} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                <td style={rtdStyle()}>{row.accountCode}</td>
                <td style={rtdStyle()}>{row.accountName}</td>
                <td style={rtdStyle({ textAlign: 'right' })}>{fmt(row.totalCTNs, 0)}</td>
                <td style={rtdStyle({ textAlign: 'right' })}>{fmtCurrency(row.totalPValue)}</td>
                <td style={rtdStyle({ textAlign: 'right' })}>{fmtCurrency(row.totalAvailableCashFunds)}</td>
                <td style={rtdStyle({ textAlign: 'right' })}>{fmtCurrency(row.totalCashFundsReleased)}</td>
              </tr>
            ))}
          </tbody>

          {/* ── Totals row on last page ── */}
          {isLastPage && (
            <tfoot>
              <tr style={{ background: '#e5e7eb' }}>
                <td colSpan={2} style={rthStyle({ textAlign: 'left' })}>TOTAL</td>
                <td style={rthStyle({ textAlign: 'right' })}>{fmt(reportData.totals.totalCTNs, 0)}</td>
                <td style={rthStyle({ textAlign: 'right' })}>{fmtCurrency(reportData.totals.totalPValue)}</td>
                <td style={rthStyle({ textAlign: 'right' })}>{fmtCurrency(reportData.totals.totalAvailableCashFunds)}</td>
                <td style={rthStyle({ textAlign: 'right' })}>{fmtCurrency(reportData.totals.totalCashFundsReleased)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Spacer pushes page number to the bottom */}
        <div style={{ flex: 1 }} />

        {/* ── Page number ── */}
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'9px', color:'#9ca3af', flexShrink:0 }}>
          <span>Page {pageIndex + 1} of {totalPages}</span>
        </div>
      </div>
    );
  };

  // ─── Shared input / label styles ──────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: tokens.inputBg,
    border: `1.5px solid ${tokens.inputBorder}`,
    borderRadius: 8, fontSize: 13,
    color: tokens.text, fontFamily: fontStack,
    outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    display:'flex', alignItems:'center', gap:6,
    fontSize: 12, fontWeight: 600,
    color: tokens.textSub, fontFamily: fontStack,
    marginBottom: 6, letterSpacing: '0.01em',
    textTransform: 'uppercase',
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);     }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(59,110,246,0.35); }
          70%  { box-shadow: 0 0 0 10px rgba(59,110,246,0);  }
          100% { box-shadow: 0 0 0 0 rgba(59,110,246,0);     }
        }
        .vcp-card { animation: fadeSlideUp 0.3s ease both; }
        .vcp-btn-primary:hover:not(:disabled) {
          background: #2a5ce8 !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59,110,246,0.35) !important;
        }
        .vcp-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .vcp-btn-secondary:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .vcp-input:focus { border-color: #3b6ef6 !important; box-shadow: 0 0 0 3px rgba(59,110,246,0.12); }
        .vcp-export-item:hover { background: ${tokens.accentLight} !important; color: ${tokens.accent} !important; }
        .vcp-page-btn:hover:not(:disabled) { border-color: ${tokens.accent} !important; color: ${tokens.accent} !important; }
        .vcp-sidebar-item:hover { background: ${tokens.accentLight}; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: tokens.bg, fontFamily: fontStack }}>
        <Sidebar
          collapsed={collapsed} setCollapsed={setCollapsed}
          showVanDropdown={showVanDropdown}         setShowVanDropdown={setShowVanDropdown}
          showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
          showVcpDropdown={showVcpDropdown}         setShowVcpDropdown={setShowVcpDropdown}
          theme={theme}
        />

        <main style={{
          flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh',
          marginLeft: collapsed ? 80 : 256,
          transition: 'margin-left 0.4s cubic-bezier(.4,0,.2,1)',
        }}>
          <Header collapsed={collapsed} userName={userName} userCode={userCode} initials={initials} logo={vcpLogo} theme={theme} />

          <div style={{ paddingTop: 64, flex: 1, padding: '80px 32px 40px', overflowY: 'auto' }}>
            {/* ── Page wrapper card ── */}
            <div className="vcp-card" style={{
              background: tokens.cardBg,
              border: `1.5px solid ${tokens.cardBorder}`,
              borderRadius: 20,
              boxShadow: isDark ? '0 8px 40px rgba(0,0,0,0.45)' : '0 4px 32px rgba(30,37,64,0.08)',
              padding: '32px 32px 36px',
              maxWidth: 1600, margin: '0 auto',
            }}>
              {/* ── Title bar ── */}
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                marginBottom: 28, paddingBottom: 20,
                borderBottom: `1.5px solid ${tokens.cardBorder}`,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{
                    width:46, height:46, borderRadius:14,
                    background: `linear-gradient(135deg, ${tokens.accent} 0%, #5c8af7 100%)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow: `0 4px 16px rgba(59,110,246,0.35)`, flexShrink: 0,
                  }}>
                    <TrendingUp size={22} color="#fff" />
                  </div>
                  <div>
                    <h1 style={{ fontSize:17, fontWeight:700, color:tokens.text, margin:0, letterSpacing:'-0.01em' }}>
                      Cash Fund per Account
                    </h1>
                    <p style={{ fontSize:12, color:tokens.textMuted, margin:'3px 0 0', fontWeight:400 }}>
                      Generate &amp; export rebate cash fund reports
                    </p>
                  </div>
                </div>
                <div style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'6px 12px', borderRadius:8,
                  background: tokens.accentLight, border:`1px solid ${tokens.accent}30`,
                  fontSize:11, color:tokens.accent, fontWeight:500, fontFamily: monoStack,
                }}>
                  <Calendar size={12} />
                  {getCurrentDate()}
                </div>
              </div>

              {/* ── Access gate ── */}
              {accessLoading ? renderAccessLoading() : !access.canView ? (
                <AccessDenied
                  useTokens={true}
                  tokens={tokens}
                  message="You don't have permission to view this page. Try switching tenants from your profile or contact your administrator."
                />
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:24 }}>

                  {/* ══ Main column ══ */}
                  <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

                    {/* ── Action bar ── */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                      <div style={{ display:'flex', gap:8 }}>
                        {/* Generate */}
                        <button
                          className="vcp-btn-primary"
                          onClick={generateReport}
                          disabled={loading || syncing || !selectedRebate || !access.canCreate}
                          title={!access.canCreate ? 'No permission' : !selectedRebate ? 'Select a rebate code first' : ''}
                          style={{
                            display:'flex', alignItems:'center', gap:7,
                            padding:'9px 18px', borderRadius:9, fontSize:13, fontWeight:600,
                            border:'none',
                            cursor: (access.canCreate && !loading && !syncing && selectedRebate) ? 'pointer' : 'not-allowed',
                            background: (access.canCreate && !loading && !syncing && selectedRebate) ? tokens.accent : (isDark ? '#2a2e3e' : '#e8ecf4'),
                            color: (access.canCreate && !loading && !syncing && selectedRebate) ? '#fff' : tokens.textMuted,
                            opacity: (access.canCreate && !loading && !syncing && selectedRebate) ? 1 : 0.6,
                            transition: 'all 0.2s',
                            boxShadow: (access.canCreate && !loading && !syncing && selectedRebate) ? '0 2px 12px rgba(59,110,246,0.25)' : 'none',
                            fontFamily: fontStack,
                          }}
                        >
                          {loading ? <RefreshCw size={14} style={{ animation:'spin 0.8s linear infinite' }} /> : <Zap size={14} />}
                          {loading ? 'Generating…' : 'Generate Report'}
                        </button>

                        {/* Sync */}
                        <button
                          className="vcp-btn-secondary"
                          onClick={syncPayouts}
                          disabled={syncing || loading || !selectedRebate}
                          title="Sync SAP payout data"
                          style={{
                            display:'flex', alignItems:'center', gap:7,
                            padding:'9px 16px', borderRadius:9, fontSize:13, fontWeight:500,
                            border:`1.5px solid ${tokens.inputBorder}`,
                            background: tokens.inputBg, color:tokens.text,
                            cursor:(!syncing && !loading && selectedRebate) ? 'pointer' : 'not-allowed',
                            opacity:(!syncing && !loading && selectedRebate) ? 1 : 0.5,
                            transition:'all 0.2s', fontFamily: fontStack,
                          }}
                        >
                          <RefreshCw size={14} style={syncing ? { animation:'spin 0.8s linear infinite' } : {}} />
                          {syncing ? 'Syncing…' : 'Sync Payouts'}
                        </button>

                        {/* Clear */}
                        {showReport && reportData && (
                          <button
                            onClick={clearReport}
                            style={{
                              display:'flex', alignItems:'center', gap:6,
                              padding:'9px 14px', borderRadius:9, fontSize:13, fontWeight:500,
                              border:`1.5px solid ${tokens.inputBorder}`,
                              background:'transparent', color:tokens.textMuted,
                              cursor:'pointer', transition:'all 0.2s', fontFamily: fontStack,
                            }}
                          >
                            <X size={13} /> Clear
                          </button>
                        )}
                      </div>

                      {/* Export dropdown */}
                      <div style={{ position:'relative' }}>
                        <button
                          disabled={!access.canExport || !showReport || !reportData}
                          title={!access.canExport ? 'No export permission' : !showReport ? 'No data' : 'Export'}
                          style={{
                            display:'flex', alignItems:'center', gap:6,
                            padding:'9px 14px', borderRadius:9, fontSize:13, fontWeight:500,
                            border:`1.5px solid ${(access.canExport && showReport && reportData) ? tokens.accent : tokens.inputBorder}`,
                            background: (access.canExport && showReport && reportData) ? tokens.accentLight : tokens.inputBg,
                            color: (access.canExport && showReport && reportData) ? tokens.accent : tokens.textMuted,
                            cursor: (access.canExport && showReport && reportData) ? 'pointer' : 'not-allowed',
                            opacity: (access.canExport && showReport && reportData) ? 1 : 0.5,
                            transition:'all 0.2s', fontFamily: fontStack,
                          }}
                          onClick={() => { if (access.canExport && showReport && reportData) setShowExportDropdown(v => !v); }}
                        >
                          <Download size={13} />
                          Export <ChevronDown size={13} />
                        </button>
                        {showExportDropdown && access.canExport && (
                          <div style={{
                            position:'absolute', right:0, top:'calc(100% + 8px)',
                            width:220, borderRadius:12, zIndex:50,
                            background: tokens.cardBg, border:`1.5px solid ${tokens.cardBorder}`,
                            boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 8px 32px rgba(30,37,64,0.14)',
                            overflow:'hidden', animation:'fadeSlideUp 0.15s ease both',
                          }}>
                            <div style={{ padding:'10px 14px 8px', borderBottom:`1px solid ${tokens.cardBorder}` }}>
                              <p style={{ fontSize:11, fontWeight:700, color:tokens.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', margin:0 }}>
                                Export as
                              </p>
                            </div>
                            {[
                              { label:'PDF Document',   ext:'pdf',  icon:<FileText size={15} color="#ef4444" />,       fn: exportToPDF   },
                              { label:'Excel Workbook', ext:'xlsx', icon:<FileSpreadsheet size={15} color="#22c55e" />, fn: exportToExcel },
                            ].map(({ label, ext, icon, fn }) => (
                              <button
                                key={ext}
                                className="vcp-export-item"
                                onClick={() => { fn(); setShowExportDropdown(false); }}
                                style={{
                                  width:'100%', textAlign:'left',
                                  display:'flex', alignItems:'center', gap:10,
                                  padding:'11px 14px', fontSize:13,
                                  color:tokens.text, background:'transparent',
                                  border:'none', cursor:'pointer',
                                  transition:'all 0.15s', fontFamily: fontStack,
                                }}
                              >
                                {icon}
                                <div>
                                  <div style={{ fontWeight:500 }}>{label}</div>
                                  <div style={{ fontSize:11, color:tokens.textMuted }}>Save as .{ext}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Filter bar ── */}
                    <div style={{ background: isDark ? '#12151e' : '#f8fafc', border:`1.5px solid ${tokens.cardBorder}`, borderRadius:14, padding:'20px 22px' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1.2fr', gap:18 }}>
                        {/* Rebate Code */}
                        <div>
                          <label style={labelStyle}>
                            <BarChart2 size={12} color={tokens.accent} />
                            Rebate Code <span style={{ color:tokens.accent }}>*</span>
                          </label>
                          <select
                            className="vcp-input"
                            value={selectedRebate}
                            onChange={e => handleRebateChange(e.target.value)}
                            style={{ ...inputStyle }}
                          >
                            <option value="">— Select Code —</option>
                            {rebates.map(r => (
                              <option key={r.RebateCode} value={r.RebateCode}>
                                {r.RebateCode}{r.SlpName ? ` · ${r.SlpName}` : ''}
                              </option>
                            ))}
                          </select>
                          {rebateInfo && (
                            <p style={{ fontSize:11, color:tokens.textMuted, marginTop:5, fontFamily:monoStack }}>
                              {rebateInfo.DateFrom} → {rebateInfo.DateTo} · {rebateInfo.Frequency}
                            </p>
                          )}
                          {customersLoading && (
                            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, fontSize:11, color:tokens.textMuted }}>
                              <RefreshCw size={11} style={{ animation:'spin 0.8s linear infinite' }} />
                              Fetching customers…
                            </div>
                          )}
                        </div>

                        {/* Customer Selection */}
                        <div className="customer-dropdown-container" style={{ position:'relative' }}>
                          <label style={labelStyle}>
                            <Users size={12} color={tokens.accent} /> Customers
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (availableCustomers.length > 0) {
                                setShowCustomerDropdown(!showCustomerDropdown);
                                setTempSelectedCustomers([...selectedCustomers]);
                              }
                            }}
                            disabled={!selectedRebate || customersLoading}
                            style={{
                              ...inputStyle,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              textAlign: 'left',
                              cursor: (!selectedRebate || customersLoading) ? 'not-allowed' : 'pointer',
                              opacity: (!selectedRebate || customersLoading) ? 0.6 : 1,
                            }}
                          >
                            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {selectedCustomers.length === 0
                                ? 'No customers'
                                : selectedCustomers.length === availableCustomers.length
                                ? `All customers (${selectedCustomers.length})`
                                : `${selectedCustomers.length} selected`}
                            </span>
                            <ChevronDown size={14} color={tokens.textMuted} />
                          </button>

                          {showCustomerDropdown && availableCustomers.length > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: 'calc(100% + 6px)',
                              left: 0,
                              width: '100%',
                              maxHeight: 260,
                              overflowY: 'auto',
                              background: tokens.cardBg,
                              border: `1.5px solid ${tokens.cardBorder}`,
                              borderRadius: 10,
                              boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 6px 20px rgba(30,37,64,0.12)',
                              zIndex: 100,
                              padding: '6px 0',
                            }}>
                              {/* "Select All" option */}
                              <div
                                style={{
                                  padding: '8px 12px',
                                  borderBottom: `1px solid ${tokens.cardBorder}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  cursor: 'pointer',
                                  background: tokens.inputBg,
                                }}
                                onClick={() => {
                                  const allSelected = tempSelectedCustomers.length === availableCustomers.length;
                                  setTempSelectedCustomers(allSelected ? [] : [...availableCustomers]);
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={tempSelectedCustomers.length === availableCustomers.length}
                                  readOnly
                                  style={{ accentColor: tokens.accent }}
                                />
                                <span style={{ fontSize: 12, fontWeight: 600, color: tokens.text }}>
                                  Select All
                                </span>
                              </div>

                              {/* Customer list */}
                              {availableCustomers.map(cust => (
                                <div
                                  key={cust.CardCode}
                                  style={{
                                    padding: '8px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    cursor: 'pointer',
                                    transition: 'background 0.1s',
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = tokens.accentLight}
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
                                    style={{ accentColor: tokens.accent }}
                                  />
                                  <span style={{ fontSize: 12, color: tokens.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                    {cust.CardName} <span style={{ color: tokens.textMuted, marginLeft: 4 }}>({cust.CardCode})</span>
                                  </span>
                                </div>
                              ))}

                              {/* Apply button */}
                              <div style={{ padding: '8px 12px', borderTop: `1px solid ${tokens.cardBorder}` }}>
                                <button
                                  onClick={() => {
                                    setSelectedCustomers(tempSelectedCustomers);
                                    setShowCustomerDropdown(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '6px 12px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: tokens.accent,
                                    color: '#fff',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontFamily: fontStack,
                                  }}
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Date From */}
                        <div>
                          <label style={labelStyle}><Calendar size={12} color={tokens.accent} /> Date From</label>
                          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="vcp-input" style={{ ...inputStyle }} />
                        </div>

                        {/* Date To */}
                        <div>
                          <label style={labelStyle}><Calendar size={12} color={tokens.accent} /> Date To</label>
                          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="vcp-input" style={{ ...inputStyle }} />
                        </div>
                      </div>
                    </div>

                    {/* ── Messages ── */}
                    {errorMsg && (
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 14px', borderRadius:10, background: tokens.errorBg, border:`1.5px solid ${tokens.error}30`, animation:'fadeSlideUp 0.2s ease' }}>
                        <AlertCircle size={15} color={tokens.error} style={{ flexShrink:0, marginTop:1 }} />
                        <span style={{ flex:1, fontSize:13, color:tokens.error, fontFamily:fontStack }}>{errorMsg}</span>
                        <button onClick={() => setErrorMsg("")} style={{ border:'none', background:'transparent', cursor:'pointer', color:tokens.error, padding:0, lineHeight:1 }}><X size={14} /></button>
                      </div>
                    )}
                    {successMsg && (
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 14px', borderRadius:10, background: tokens.successBg, border:`1.5px solid ${tokens.success}30`, animation:'fadeSlideUp 0.2s ease' }}>
                        <CheckCircle size={15} color={tokens.success} style={{ flexShrink:0, marginTop:1 }} />
                        <span style={{ flex:1, fontSize:13, color:tokens.success, fontFamily:fontStack }}>{successMsg}</span>
                        <button onClick={() => setSuccessMsg("")} style={{ border:'none', background:'transparent', cursor:'pointer', color:tokens.success, padding:0, lineHeight:1 }}><X size={14} /></button>
                      </div>
                    )}

                    {/* ── Job status bar ── */}
                    {loading && activeJobId && (
                      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:10, background: tokens.accentLight, border:`1.5px solid ${tokens.accent}30` }}>
                        {getStatusIcon(jobStatus)}
                        <div style={{ flex:1 }}>
                          <p style={{ fontSize:13, fontWeight:600, color:tokens.accent, margin:0 }}>Generating report…</p>
                          <p style={{ fontSize:11, color:tokens.textMuted, margin:'2px 0 0', fontFamily:monoStack }}>{activeJobId}</p>
                        </div>
                      </div>
                    )}

                    {/* ── Loading spinner ── */}
                    {loading && (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:380, background: isDark ? 'rgba(18,21,30,0.6)' : 'rgba(244,246,251,0.7)', borderRadius:14, border:`1.5px dashed ${tokens.cardBorder}` }}>
                        <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                          <div style={{ position:'relative', width:56, height:56 }}>
                            <div style={{ width:56, height:56, borderRadius:'50%', border:`4px solid ${tokens.cardBorder}`, position:'absolute' }} />
                            <div style={{ width:56, height:56, borderRadius:'50%', border:`4px solid ${tokens.accent}`, borderTopColor:'transparent', animation:'spin 0.75s linear infinite', position:'absolute' }} />
                          </div>
                          <div>
                            <h3 style={{ fontSize:16, fontWeight:700, color:tokens.text, margin:'0 0 6px' }}>Building Your Report</h3>
                            <p style={{ fontSize:12, color:tokens.textMuted, margin:0 }}>
                              Fetching data for rebate&nbsp;
                              <span style={{ fontWeight:700, color:tokens.accent, fontFamily:monoStack }}>{selectedRebate}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Paginated report preview ── */}
                    {!loading && showReport && reportData && (() => {
                      const pages      = getPaginatedPages(reportData.reportRows);
                      const totalPages = pages.length;
                      const safePage   = Math.min(currentPage, totalPages - 1);
                      return (
                        <div style={{ background: tokens.cardBg, border:`1.5px solid ${tokens.cardBorder}`, borderRadius:14, padding:'20px 22px' }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                            <h3 style={{ fontSize:14, fontWeight:700, color:tokens.text, margin:0 }}>Report Preview</h3>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background: tokens.accentLight, color:tokens.accent, fontFamily:monoStack }}>
                                {reportData.reportRows.length} accounts
                              </span>
                              {totalPages > 1 && (
                                <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background: tokens.goldLight, color:tokens.gold, fontFamily:monoStack }}>
                                  {totalPages} pages
                                </span>
                              )}
                              <span style={{ fontSize:12, color:tokens.textMuted }}>
                                Agent: <strong style={{ color:tokens.text }}>{reportData.salesAgent || '—'}</strong>
                              </span>
                            </div>
                          </div>
                          <div style={{ overflowX:'auto' }}>
                            <div ref={reportContainerRef} style={{ position:'relative' }}>
                              {pages.map((pageRows, pageIndex) =>
                                renderReportPage(pageRows, pageIndex, totalPages, pageIndex === safePage)
                              )}
                            </div>
                          </div>
                          {totalPages > 1 && (
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:18, flexWrap:'wrap' }}>
                              <button className="vcp-page-btn" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                                style={{ width:32, height:32, borderRadius:8, border:`1.5px solid ${tokens.inputBorder}`, background:'transparent', color:tokens.text, cursor:safePage===0?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:safePage===0?0.35:1, transition:'all 0.15s' }}>
                                <ChevronLeft size={15} />
                              </button>
                              {Array.from({ length: totalPages }, (_, i) => {
                                const isEdge     = i === 0 || i === totalPages - 1;
                                const isNearCur  = Math.abs(i - safePage) <= 1;
                                const isDotLeft  = i === 1 && safePage > 2;
                                const isDotRight = i === totalPages - 2 && safePage < totalPages - 3;
                                if (!isEdge && !isNearCur) {
                                  if (isDotLeft || isDotRight) return <span key={`dots-${i}`} style={{ fontSize:13, color:tokens.textMuted, padding:'0 2px', userSelect:'none' }}>&hellip;</span>;
                                  return null;
                                }
                                return (
                                  <button key={i} className="vcp-page-btn" onClick={() => setCurrentPage(i)}
                                    style={{ minWidth:32, height:32, padding:'0 8px', borderRadius:8, fontSize:12, fontWeight:600, border:`1.5px solid ${i===safePage ? tokens.accent : tokens.inputBorder}`, background: i===safePage ? tokens.accent : 'transparent', color: i===safePage ? '#fff' : tokens.text, cursor:'pointer', transition:'all 0.15s', fontFamily:fontStack }}>
                                    {i + 1}
                                  </button>
                                );
                              })}
                              <button className="vcp-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}
                                style={{ width:32, height:32, borderRadius:8, border:`1.5px solid ${tokens.inputBorder}`, background:'transparent', color:tokens.text, cursor:safePage===totalPages-1?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', opacity:safePage===totalPages-1?0.35:1, transition:'all 0.15s' }}>
                                <ChevronRight size={15} />
                              </button>
                              <span style={{ fontSize:11, color:tokens.textMuted, marginLeft:6, fontFamily:monoStack }}>{safePage + 1} / {totalPages}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── Empty state ── */}
                    {!loading && !showReport && !activeJobId && (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', maxWidth:1050, height:440, margin:'0 auto', borderRadius:14, border:`2px dashed ${tokens.cardBorder}`, background: isDark ? 'rgba(18,21,30,0.5)' : 'rgba(248,250,252,0.8)' }}>
                        <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
                          <div style={{ width:52, height:52, borderRadius:14, background: tokens.accentLight, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <BarChart2 size={24} color={tokens.accent} />
                          </div>
                          <div>
                            <p style={{ fontSize:14, fontWeight:600, color:tokens.text, margin:'0 0 4px' }}>No report generated yet</p>
                            <p style={{ fontSize:12, color:tokens.textMuted, margin:0 }}>
                              Select a rebate code &amp; date range, then click{' '}
                              <strong style={{ color:tokens.accent }}>Generate Report</strong>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ══ Right sidebar ══ */}
                  <div style={{ display:'flex', flexDirection:'column', gap:16, position:'sticky', top:24, alignSelf:'start' }}>
                    <div style={{ background: tokens.cardBg, border:`1.5px solid ${tokens.cardBorder}`, borderRadius:14, padding:'18px 18px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                        <Clock size={15} color={tokens.textMuted} />
                        <h3 style={{ fontSize:13, fontWeight:700, color:tokens.text, margin:0, textTransform:'uppercase', letterSpacing:'0.04em' }}>Active Filter</h3>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:320, overflowY:'auto' }}>
                        {loading && activeJobId && (
                          <div style={{ padding:'10px 12px', borderRadius:10, background: tokens.accentLight, border:`1.5px solid ${tokens.accent}30`, animation:'pulse-ring 1.5s infinite' }}>
                            <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                              {getStatusIcon(jobStatus)}
                              <div style={{ flex:1, minWidth:0 }}>
                                <p style={{ fontSize:12, fontWeight:600, color:tokens.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedRebate || 'Rebate Report'}</p>
                                <p style={{ fontSize:11, color:tokens.textMuted, margin:'2px 0 4px', fontFamily:monoStack }}>{formatJobDate(new Date().toISOString())}</p>
                                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:600, background: tokens.accentLight, color:tokens.accent }}>Processing</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {!loading && showReport && reportData && (
                          <div style={{ padding:'10px 12px', borderRadius:10, background: tokens.successBg, border:`1.5px solid ${tokens.success}30` }}>
                            <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                              <CheckCircle size={14} color={tokens.success} style={{ flexShrink:0, marginTop:2 }} />
                              <div style={{ flex:1, minWidth:0 }}>
                                <p style={{ fontSize:12, fontWeight:600, color:tokens.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:monoStack }}>{reportData.rebateCode}</p>
                                <p style={{ fontSize:11, color:tokens.textMuted, margin:'2px 0', fontFamily:monoStack }}>{formatJobDate(new Date().toISOString())}</p>
                                <p style={{ fontSize:11, color:tokens.textMuted, margin:'0 0 4px' }}>
                                  {reportData.reportRows.length} accounts
                                  {getPaginatedPages(reportData.reportRows).length > 1 && ` · ${getPaginatedPages(reportData.reportRows).length} pages`}
                                </p>
                                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:600, background: tokens.successBg, color:tokens.success }}>Current</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {!loading && jobStatus === 'failed' && jobError && (
                          <div style={{ padding:'10px 12px', borderRadius:10, background: tokens.errorBg, border:`1.5px solid ${tokens.error}30` }}>
                            <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                              <XCircle size={14} color={tokens.error} style={{ flexShrink:0, marginTop:2 }} />
                              <div style={{ flex:1, minWidth:0 }}>
                                <p style={{ fontSize:12, fontWeight:600, color:tokens.text, margin:0, fontFamily:monoStack }}>{selectedRebate || 'Failed'}</p>
                                <p style={{ fontSize:11, color:tokens.error, margin:'3px 0 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={jobError}>{jobError}</p>
                                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:600, background: tokens.errorBg, color:tokens.error }}>Failed</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {!loading && !showReport && !activeJobId && jobStatus !== 'failed' && (
                          <p style={{ fontSize:12, textAlign:'center', color:tokens.textMuted, padding:'20px 0', margin:0 }}>No activity yet</p>
                        )}
                      </div>
                    </div>

                    {showReport && reportData && (
                      <div style={{ background: tokens.cardBg, border:`1.5px solid ${tokens.cardBorder}`, borderRadius:14, padding:'16px 18px', animation:'fadeSlideUp 0.25s ease' }}>
                        <p style={{ fontSize:11, fontWeight:700, color:tokens.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 12px' }}>Summary</p>
                        {[
                          { label:'Total CTNs',    value: fmt(reportData.totals.totalCTNs, 0),                    color: tokens.accent  },
                          { label:'Total P.Value', value: fmtCurrency(reportData.totals.totalPValue),              color: tokens.text    },
                          { label:'Available',     value: fmtCurrency(reportData.totals.totalAvailableCashFunds),  color: tokens.success },
                          { label:'Released',      value: fmtCurrency(reportData.totals.totalCashFundsReleased),   color: tokens.gold    },
                        ].map(({ label, value, color }, idx) => (
                          <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom: idx < 3 ? `1px solid ${tokens.cardBorder}` : 'none' }}>
                            <span style={{ fontSize:12, color:tokens.textMuted }}>{label}</span>
                            <span style={{ fontSize:13, fontWeight:700, color, fontFamily:monoStack }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default Vcp_Reports;