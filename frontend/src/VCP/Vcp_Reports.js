// src/pages/Vcp_Reports.jsx
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
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';
import { API_BASE } from '../config/appConfig';

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens, DesignPage } from '../design-system';

/* ─── Helpers ───────────────────────────────────────────────────── */
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

/* ─── Report paper styles (intentional inline — used by html2canvas / PDF) ── */
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

const NOTED_BY_NAME = 'Bob Manalo';

function Vcp_Reports() {
  const { theme, updateTheme } = useTokens();
  useLocation(); // preserve hook order
  const reportContainerRef = useRef(null);
  const routePath = '/Vcp_Reports';

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

  const DB_NAME = 'VCP';

  useComponentRegistration({
    name: 'Vcp_Reports',
    version: '3.1.0',
    description: 'Cash Fund per Account report — customer-first, rebate optional.',
    routePath: '/Vcp_Reports',
  });

  /* ── Helpers ───────────────────────────────────────────────────── */
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

  /* ── Restore persisted state ───────────────────────────────────── */
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

  /* ── Load theme ────────────────────────────────────────────────── */
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

  /* ── Load user info ────────────────────────────────────────────── */
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

  /* ── Persist state ─────────────────────────────────────────────── */
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

  /* ── Handlers ──────────────────────────────────────────────────── */
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

  /* ── Exports ───────────────────────────────────────────────────── */
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

  /* ── Status helpers ────────────────────────────────────────────── */
  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing': return <RefreshCw className="text-[#0A84FF] animate-spin" style={{ width: 14, height: 14, animationDuration: '0.8s' }} />;
      case 'completed':  return <CheckCircle className="text-[#32D74B]" style={{ width: 14, height: 14 }} />;
      case 'failed':     return <XCircle className="text-[#FF453A]" style={{ width: 14, height: 14 }} />;
      default:           return <Clock className="text-[var(--ds-faint)]" style={{ width: 14, height: 14 }} />;
    }
  };

  const formatJobDate = (ds) =>
    new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const renderAccessLoading = () => (
    <div className="flex items-center justify-center min-h-[380px]">
      <div className="flex flex-col items-center gap-3.5">
        <div className="w-9 h-9 rounded-full animate-spin border-[3px] border-[var(--ds-hairline)] border-t-[#0A84FF]" />
        <p className="text-[13px] text-[var(--ds-muted)]">Verifying access…</p>
      </div>
    </div>
  );

  /* ─── Report page — LAYOUT INTENTIONAL: ALL INLINE (PDF/PNG canvas) ─── */
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

  /* ── Shared Tailwind classes ───────────────────────────────────── */
  const inputClasses = "w-full px-3 py-[9px] rounded-xl text-[13px] outline-none transition-colors bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)]";
  const labelClasses = "flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ds-muted)] mb-1.5 tracking-[0.05em] uppercase";

  /* ── Derived flags ─────────────────────────────────────────────── */
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

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return allCustomers;
    return allCustomers.filter(c =>
      (c.CardName || '').toLowerCase().includes(q) ||
      (c.CardCode || '').toLowerCase().includes(q)
    );
  }, [allCustomers, customerSearch]);

  const canExport = access.canExport && showReport && reportData;

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <DesignPage className="flex w-full">

      {/* Aurora wash — blue/purple; swap to ds-aurora-blue-green for VCP's green identity */}
      <div className="pointer-events-none fixed inset-0 z-0 ds-aurora-blue-purple" />

      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown}         setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown}         setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />

      <main
        className={`relative flex-1 flex flex-col min-h-screen z-[1] transition-[margin-left] duration-[400ms] ease-[cubic-bezier(.4,0,.2,1)] ${
          collapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          logo={vcpLogo}
          theme={theme}
        />

        <div className="ds-scroll flex-1 overflow-y-auto pt-20 px-8 pb-10">
          <div className="ds-fade-up ds-glass rounded-[22px] bg-[var(--ds-glass)] border border-[var(--ds-hairline)] shadow-[var(--ds-shadow)] px-8 pt-8 pb-9 max-w-[1600px] mx-auto">

            {/* ── Title bar ── */}
            <div className="flex items-center justify-between mb-7 pb-5 gap-4 flex-wrap border-b border-[var(--ds-hairline)]">
              <div className="flex items-center gap-3.5">
                <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center flex-shrink-0 ds-gradient-primary shadow-[0_4px_16px_-4px_rgba(10,132,255,0.53)]">
                  <TrendingUp size={22} className="text-white" />
                </div>
                <div>
                  <h1 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--ds-ink)] m-0">
                    Cash Fund per Account
                  </h1>
                  <p className="text-[12px] text-[var(--ds-muted)] mt-[3px] mb-0 font-normal">
                    Generate &amp; export rebate cash fund reports
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)] text-[11px] text-[var(--ds-muted)] font-medium ds-font-mono">
                <Calendar size={12} />
                {getCurrentDate()}
              </div>
            </div>

            {/* ── Access gate ── */}
            {accessLoading ? renderAccessLoading() : !access.canView ? (
              <AccessDenied
                useTokens={true}
                tokens={{
                  ...(({} /* placeholder — see note below */)),
                }}
                message="You don't have permission to view this page. Contact your administrator for access."
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                <div className="flex flex-col gap-5">
                  {/* ── Action bar ── */}
                  <div className="flex items-center justify-between gap-2.5 flex-wrap">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        className={`ds-btn-primary flex items-center gap-1.5 px-4 py-[9px] rounded-full text-[13px] font-semibold transition-all duration-200 ${
                          canGenerate
                            ? 'ds-gradient-primary text-white cursor-pointer shadow-[0_4px_16px_-6px_rgba(10,132,255,0.53)]'
                            : 'bg-[var(--ds-chip-bg)] text-[var(--ds-faint)] opacity-60 cursor-not-allowed border-none'
                        }`}
                        onClick={generateReport}
                        disabled={!canGenerate}
                        title={generateTooltip}
                      >
                        {loading ? <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '0.8s' }} /> : <Zap size={14} />}
                        {loading ? 'Generating…' : 'Generate Report'}
                      </button>

                      <button
                        className={`ds-btn-secondary flex items-center gap-1.5 px-4 py-[9px] rounded-full text-[13px] font-medium border border-[var(--ds-hairline)] bg-transparent transition-all duration-200 ${
                          (!syncing && !loading && hasRebatesSelected)
                            ? 'text-[var(--ds-muted)] hover:text-[var(--ds-ink)] hover:bg-[var(--ds-hover)] cursor-pointer'
                            : 'text-[var(--ds-muted)] opacity-50 cursor-not-allowed'
                        }`}
                        onClick={syncPayouts}
                        disabled={syncing || loading || !hasRebatesSelected}
                        title={!hasRebatesSelected ? 'Select a rebate code to sync' : 'Sync SAP payout data'}
                      >
                        <RefreshCw size={14} style={syncing ? { animation: 'spin 0.8s linear infinite' } : {}} />
                        {syncing ? 'Syncing…' : 'Sync Payouts'}
                      </button>

                      {showReport && reportData && (
                        <button
                          className="ds-btn-secondary flex items-center gap-1.5 px-3.5 py-[9px] rounded-full text-[13px] font-medium border border-[var(--ds-hairline)] bg-transparent text-[var(--ds-muted)] hover:text-[var(--ds-ink)] hover:bg-[var(--ds-hover)] cursor-pointer transition-all duration-200"
                          onClick={clearReport}
                        >
                          <X size={13} /> Clear
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        disabled={!canExport}
                        title={!access.canExport ? 'No export permission' : !showReport ? 'No data' : 'Export'}
                        onClick={() => { if (canExport) setShowExportDropdown(v => !v); }}
                        className={`flex items-center gap-1.5 px-3.5 py-[9px] rounded-full text-[13px] font-medium transition-all duration-200 ${
                          canExport
                            ? 'border border-[#0A84FF]/33 bg-[#0A84FF]/11 text-[#0A84FF] cursor-pointer'
                            : 'border border-[var(--ds-hairline)] bg-[var(--ds-chip-bg)] text-[var(--ds-faint)] opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <Download size={13} /> Export <ChevronDown size={13} />
                      </button>
                      {showExportDropdown && access.canExport && (
                        <div className="ds-glass ds-pop absolute right-0 top-[calc(100%+8px)] w-[220px] rounded-2xl z-50 overflow-hidden bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] shadow-[var(--ds-shadow)]">
                          <div className="px-3.5 pt-2.5 pb-2 border-b border-[var(--ds-hairline)]">
                            <p className="text-[11px] font-bold text-[var(--ds-muted)] uppercase tracking-[0.06em] m-0">Export as</p>
                          </div>
                          {[
                            { label: 'PDF Document',   ext: 'pdf',  icon: <FileText size={15} className="text-[#FF453A]" />,        fn: exportToPDF   },
                            { label: 'Excel Workbook', ext: 'xlsx', icon: <FileSpreadsheet size={15} className="text-[#32D74B]" />, fn: exportToExcel },
                          ].map(({ label, ext, icon, fn }) => (
                            <button
                              key={ext}
                              onClick={() => { fn(); setShowExportDropdown(false); }}
                              className="w-full text-left flex items-center gap-2.5 px-3.5 py-[11px] text-[13px] text-[var(--ds-ink)] bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-[var(--ds-chip-bg)]"
                            >
                              {icon}
                              <div>
                                <div className="font-medium">{label}</div>
                                <div className="text-[11px] text-[var(--ds-muted)]">Save as .{ext}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Filter bar ── */}
                  <div className="ds-glass relative z-30 bg-[var(--ds-glass)] border border-[var(--ds-hairline)] rounded-[18px] px-[22px] py-5">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1.2fr] gap-[18px]">

                      {/* Rebate Codes (optional) */}
                      <div className="rebate-dropdown-container relative">
                        <label className={labelClasses}>
                          <BarChart2 size={12} className="text-[#0A84FF]" />
                          Rebate Codes <span className="text-[var(--ds-muted)] font-normal normal-case tracking-normal">(optional)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRebateDropdown(v => !v);
                            setTempSelectedRebates([...selectedRebates]);
                          }}
                          className={`${inputClasses} ds-select flex items-center justify-between text-left cursor-pointer appearance-none`}
                        >
                          <span className="truncate">
                            {selectedRebates.length === 0
                              ? '— All Rebates per Customer —'
                              : selectedRebates.length === rebates.length
                                ? `All rebates (${selectedRebates.length})`
                                : selectedRebates.length === 1
                                  ? selectedRebates[0]
                                  : `${selectedRebates.length} selected`}
                          </span>
                          <ChevronDown size={14} className="text-[var(--ds-faint)]" />
                        </button>

                        {showRebateDropdown && rebates.length > 0 && (
                          <div className="ds-glass ds-pop absolute top-[calc(100%+6px)] left-0 w-full max-h-[300px] overflow-y-auto bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] rounded-2xl shadow-[var(--ds-shadow)] z-[100] py-1.5">
                            <div
                              className="px-3 py-2 border-b border-[var(--ds-hairline)] flex items-center gap-2 cursor-pointer bg-[var(--ds-chip-bg)]"
                              onClick={() => {
                                const allSelected = tempSelectedRebates.length === rebates.length;
                                setTempSelectedRebates(allSelected ? [] : rebates.map(r => r.RebateCode));
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={tempSelectedRebates.length === rebates.length && rebates.length > 0}
                                readOnly
                                className="accent-[#0A84FF]"
                              />
                              <span className="text-[12px] font-semibold text-[var(--ds-ink)]">Select All</span>
                            </div>

                            {rebates.map(r => (
                              <div
                                key={r.RebateCode}
                                className="px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors hover:bg-[var(--ds-chip-bg)]"
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
                                  className="accent-[#0A84FF]"
                                />
                                <span className="text-[12px] text-[var(--ds-ink)]">{r.RebateCode}</span>
                              </div>
                            ))}

                            <div className="px-3 py-2 border-t border-[var(--ds-hairline)] flex gap-1.5">
                              <button
                                onClick={() => {
                                  handleRebatesChange(tempSelectedRebates);
                                  setShowRebateDropdown(false);
                                }}
                                className="flex-1 px-3 py-1.5 rounded-full border-none text-white text-[12px] font-semibold cursor-pointer ds-gradient-primary shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]"
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
                                  className="px-3 py-1.5 rounded-full border border-[var(--ds-hairline)] bg-transparent text-[var(--ds-muted)] text-[12px] font-medium cursor-pointer"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {rebateInfo && (
                          <p className="text-[11px] text-[var(--ds-muted)] mt-1.5 ds-font-mono">
                            {rebateInfo.DateFrom} → {rebateInfo.DateTo} · {rebateInfo.Frequency}
                          </p>
                        )}
                      </div>

                      {/* Customers (REQUIRED, searchable) */}
                      <div className="customer-dropdown-container relative">
                        <label className={labelClasses}>
                          <Users size={12} className="text-[#0A84FF]" /> Customers <span className="text-[#0A84FF]">*</span>
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
                          className={`${inputClasses} flex items-center justify-between text-left ${
                            (customersLoading || allCustomers.length === 0) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                          }`}
                        >
                          <span className="truncate">
                            {customersLoading
                              ? 'Loading customers…'
                              : selectedCustomers.length === 0
                                ? 'Select customer(s) — required'
                                : selectedCustomers.length === allCustomers.length
                                  ? `All customers (${selectedCustomers.length})`
                                  : `${selectedCustomers.length} selected`}
                          </span>
                          {customersLoading
                            ? <RefreshCw size={14} className="text-[var(--ds-faint)] animate-spin" style={{ animationDuration: '0.8s' }} />
                            : <ChevronDown size={14} className="text-[var(--ds-faint)]" />}
                        </button>

                        {showCustomerDropdown && allCustomers.length > 0 && (
                          <div className="ds-glass ds-pop absolute top-[calc(100%+6px)] left-0 w-full flex flex-col max-h-[440px] overflow-hidden bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] rounded-2xl shadow-[var(--ds-shadow)] z-[100]">
                            {/* Search box */}
                            <div className="p-2 border-b border-[var(--ds-hairline)] flex-shrink-0">
                              <div className="relative">
                                <Search
                                  size={13}
                                  className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--ds-faint)]"
                                />
                                <input
                                  type="text"
                                  placeholder="Search customer name or code…"
                                  value={customerSearch}
                                  onChange={(e) => setCustomerSearch(e.target.value)}
                                  autoFocus
                                  className="w-full py-2 pl-[30px] pr-[30px] bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)] rounded-[10px] text-[12px] text-[var(--ds-ink)] outline-none"
                                />
                                {customerSearch && (
                                  <button
                                    type="button"
                                    onClick={() => setCustomerSearch('')}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 border-none bg-transparent cursor-pointer text-[var(--ds-muted)] p-0.5 flex items-center"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Select-all (respects search) */}
                            <div
                              className="px-3 py-2 border-b border-[var(--ds-hairline)] flex items-center gap-2 cursor-pointer bg-[var(--ds-chip-bg)] flex-shrink-0"
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
                                className="accent-[#0A84FF]"
                              />
                              <span className="text-[12px] font-semibold text-[var(--ds-ink)]">
                                {customerSearch
                                  ? `Select all results (${filteredCustomers.length})`
                                  : `Select All (${allCustomers.length})`}
                              </span>
                              <span className="ml-auto text-[11px] text-[var(--ds-muted)] ds-font-mono">
                                {tempSelectedCustomers.length} selected
                              </span>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto py-1">
                              {filteredCustomers.length === 0 ? (
                                <p className="px-3 py-5 text-[12px] text-[var(--ds-muted)] text-center m-0">
                                  No customers match &ldquo;{customerSearch}&rdquo;
                                </p>
                              ) : (
                                filteredCustomers.map(cust => (
                                  <div
                                    key={cust.CardCode}
                                    className="px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors hover:bg-[var(--ds-chip-bg)]"
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
                                      className="accent-[#0A84FF]"
                                    />
                                    <span className="text-[12px] text-[var(--ds-ink)] truncate">
                                      {cust.CardName}
                                      <span className="text-[var(--ds-muted)] ml-1">({cust.CardCode})</span>
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Footer */}
                            <div className="p-2 border-t border-[var(--ds-hairline)] flex gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => { setSelectedCustomers(tempSelectedCustomers); setShowCustomerDropdown(false); }}
                                className="flex-1 px-3 py-[7px] rounded-full border-none text-white text-[12px] font-semibold cursor-pointer ds-gradient-primary shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]"
                              >
                                Apply
                              </button>
                              <button
                                type="button"
                                onClick={() => setTempSelectedCustomers([])}
                                className="px-3 py-[7px] rounded-full border border-[var(--ds-hairline)] bg-transparent text-[var(--ds-muted)] text-[12px] font-medium cursor-pointer"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Date From */}
                      <div>
                        <label className={labelClasses}>
                          <Calendar size={12} className="text-[#0A84FF]" /> Date From <span className="text-[#0A84FF]">*</span>
                        </label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={`${inputClasses} ds-input`} />
                      </div>

                      {/* Date To */}
                      <div>
                        <label className={labelClasses}>
                          <Calendar size={12} className="text-[#0A84FF]" /> Date To <span className="text-[#0A84FF]">*</span>
                        </label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={`${inputClasses} ds-input`} />
                      </div>
                    </div>
                  </div>

                  {/* ── Messages ── */}
                  {errorMsg && (
                    <div className="flex items-start gap-2.5 px-3.5 py-[11px] rounded-[14px] bg-[#FF453A]/8 border border-[#FF453A]/20">
                      <AlertCircle size={15} className="text-[#FF453A] flex-shrink-0 mt-px" />
                      <span className="flex-1 text-[13px] text-[#FF453A]">{errorMsg}</span>
                      <button onClick={() => setErrorMsg("")} className="border-none bg-transparent cursor-pointer text-[#FF453A] p-0 leading-none"><X size={14} /></button>
                    </div>
                  )}
                  {successMsg && (
                    <div className="flex items-start gap-2.5 px-3.5 py-[11px] rounded-[14px] bg-[#32D74B]/8 border border-[#32D74B]/20">
                      <CheckCircle size={15} className="text-[#32D74B] flex-shrink-0 mt-px" />
                      <span className="flex-1 text-[13px] text-[#32D74B]">{successMsg}</span>
                      <button onClick={() => setSuccessMsg("")} className="border-none bg-transparent cursor-pointer text-[#32D74B] p-0 leading-none"><X size={14} /></button>
                    </div>
                  )}

                  {loading && activeJobId && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] bg-[#0A84FF]/8 border border-[#0A84FF]/20">
                      {getStatusIcon(jobStatus)}
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#0A84FF] m-0">Generating report…</p>
                        <p className="text-[11px] text-[var(--ds-muted)] mt-0.5 mb-0 ds-font-mono">{activeJobId}</p>
                      </div>
                    </div>
                  )}

                  {loading && (
                    <div className="ds-glass flex items-center justify-center min-h-[380px] rounded-[18px] border border-dashed border-[var(--ds-hairline)] bg-[var(--ds-glass)]">
                      <div className="text-center flex flex-col items-center gap-4">
                        <div className="relative w-14 h-14">
                          <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-[var(--ds-hairline)]" />
                          <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-[#0A84FF] border-t-transparent animate-spin" style={{ animationDuration: '0.75s' }} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[var(--ds-ink)] m-0 mb-1.5">Building Your Report</h3>
                          <p className="text-[12px] text-[var(--ds-muted)] m-0">
                            Fetching data for{' '}
                            <span className="font-bold text-[#0A84FF] ds-font-mono">
                              {selectedCustomers.length} customer(s)
                            </span>
                            {selectedRebates.length > 0 && (
                              <>
                                {' '}·{' '}
                                <span className="font-bold text-[#0A84FF] ds-font-mono">
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
                      <div className="ds-glass bg-[var(--ds-glass)] border border-[var(--ds-hairline)] rounded-[18px] px-[22px] py-5">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
                          <h3 className="text-[14px] font-bold text-[var(--ds-ink)] m-0">Report Preview</h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-[#0A84FF]/8 text-[#0A84FF] ds-font-mono">
                              {reportData.reportRows.length} accounts
                            </span>
                            {totalPages > 1 && (
                              <span className="px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-[#FF9F0A]/8 text-[#FF9F0A] ds-font-mono">
                                {totalPages} pages
                              </span>
                            )}
                            {reportData.salesAgent && (
                              <span className="px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] ds-font-mono">
                                Agent: {reportData.salesAgent}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className={`ds-scroll overflow-x-auto rounded-[14px] p-6 ${
                          theme === 'dark' ? 'bg-black/35' : 'bg-black/4'
                        }`}>
                          <div ref={reportContainerRef} className="relative w-[1050px] mx-auto">
                            {pages.map((pageRows, pageIndex) =>
                              renderReportPage(pageRows, pageIndex, totalPages, pageIndex === safePage)
                            )}
                          </div>
                        </div>

                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-1.5 mt-[18px] flex-wrap">
                            <button
                              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                              disabled={safePage === 0}
                              className={`w-8 h-8 rounded-full border border-[var(--ds-hairline)] bg-transparent text-[var(--ds-ink)] flex items-center justify-center transition-all duration-150 ${
                                safePage === 0 ? 'cursor-not-allowed opacity-35' : 'cursor-pointer hover:bg-[var(--ds-hover)]'
                              }`}
                            >
                              <ChevronLeft size={15} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => {
                              const isEdge     = i === 0 || i === totalPages - 1;
                              const isNearCur  = Math.abs(i - safePage) <= 1;
                              const isDotLeft  = i === 1 && safePage > 2;
                              const isDotRight = i === totalPages - 2 && safePage < totalPages - 3;
                              if (!isEdge && !isNearCur) {
                                if (isDotLeft || isDotRight) return <span key={`dots-${i}`} className="text-[13px] text-[var(--ds-muted)] px-0.5 select-none">&hellip;</span>;
                                return null;
                              }
                              return (
                                <button
                                  key={i}
                                  onClick={() => setCurrentPage(i)}
                                  className={`min-w-[32px] h-8 px-2 rounded-full text-[12px] font-semibold transition-all duration-150 cursor-pointer ${
                                    i === safePage
                                      ? 'ds-gradient-primary text-white border border-transparent shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]'
                                      : 'bg-transparent text-[var(--ds-ink)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)]'
                                  }`}
                                >
                                  {i + 1}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                              disabled={safePage === totalPages - 1}
                              className={`w-8 h-8 rounded-full border border-[var(--ds-hairline)] bg-transparent text-[var(--ds-ink)] flex items-center justify-center transition-all duration-150 ${
                                safePage === totalPages - 1 ? 'cursor-not-allowed opacity-35' : 'cursor-pointer hover:bg-[var(--ds-hover)]'
                              }`}
                            >
                              <ChevronRight size={15} />
                            </button>
                            <span className="text-[11px] text-[var(--ds-muted)] ml-1.5 ds-font-mono">{safePage + 1} / {totalPages}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {!loading && !showReport && !activeJobId && (
                    <div className="ds-glass flex items-center justify-center mx-auto rounded-[18px] border-2 border-dashed border-[var(--ds-hairline)] bg-[var(--ds-glass)]"
                      style={{ width: '100%', maxWidth: 1050, height: 440 }}
                    >
                      <div className="text-center flex flex-col items-center gap-3">
                        <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center bg-[#0A84FF]/11">
                          <BarChart2 size={24} className="text-[#0A84FF]" />
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-[var(--ds-ink)] m-0 mb-1">No report generated yet</p>
                          <p className="text-[12px] text-[var(--ds-muted)] m-0 max-w-[480px]">
                            Pick a <strong>date range</strong> and at least one <strong>customer</strong>.
                            Rebate codes are optional — leave them blank to include{' '}
                            <strong>every rebate</strong> each customer is enrolled in. Then click{' '}
                            <strong className="text-[#0A84FF]">Generate Report</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ══ Right sidebar ══ */}
                <div className="flex flex-col gap-4 sticky top-6 self-start">
                  <div className="ds-glass bg-[var(--ds-glass)] border border-[var(--ds-hairline)] rounded-[18px] px-[18px] pt-[18px] pb-4">
                    <div className="flex items-center gap-2 mb-3.5">
                      <Clock size={15} className="text-[var(--ds-muted)]" />
                      <h3 className="text-[12px] font-bold text-[var(--ds-ink)] m-0 uppercase tracking-[0.06em]">Activity</h3>
                    </div>
                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                      {loading && activeJobId && (
                        <div className="px-3 py-2.5 rounded-[14px] bg-[#0A84FF]/8 border border-[#0A84FF]/20" style={{ animation: 'pulse-ring 1.5s infinite' }}>
                          <div className="flex items-start gap-2">
                            {getStatusIcon(jobStatus)}
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-[var(--ds-ink)] m-0 truncate">
                                {selectedRebates.length > 0 ? selectedRebates.join(', ') : `${selectedCustomers.length} customer(s)`}
                              </p>
                              <p className="text-[11px] text-[var(--ds-muted)] mt-0.5 mb-1 ds-font-mono">{formatJobDate(new Date().toISOString())}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#0A84FF]/11 text-[#0A84FF]">Processing</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!loading && showReport && reportData && (
                        <div className="px-3 py-2.5 rounded-[14px] bg-[#32D74B]/8 border border-[#32D74B]/20">
                          <div className="flex items-start gap-2">
                            <CheckCircle size={14} className="text-[#32D74B] flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-[var(--ds-ink)] m-0 truncate ds-font-mono">
                                {reportData.rebateCodes && reportData.rebateCodes.length > 0
                                  ? reportData.rebateCodes.join(', ')
                                  : 'All rebates per customer'}
                              </p>
                              <p className="text-[11px] text-[var(--ds-muted)] my-0.5 ds-font-mono">{formatJobDate(new Date().toISOString())}</p>
                              <p className="text-[11px] text-[var(--ds-muted)] mt-0 mb-1">
                                {reportData.reportRows.length} accounts
                                {getPaginatedPages(reportData.reportRows).length > 1 && ` · ${getPaginatedPages(reportData.reportRows).length} pages`}
                              </p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#32D74B]/11 text-[#32D74B]">Completed</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!loading && jobStatus === 'failed' && jobError && (
                        <div className="px-3 py-2.5 rounded-[14px] bg-[#FF453A]/8 border border-[#FF453A]/20">
                          <div className="flex items-start gap-2">
                            <XCircle size={14} className="text-[#FF453A] flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-[var(--ds-ink)] m-0 ds-font-mono">
                                {selectedRebates.length > 0 ? selectedRebates.join(', ') : 'Failed'}
                              </p>
                              <p className="text-[11px] text-[#FF453A] mt-1 mb-1 truncate" title={jobError}>{jobError}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#FF453A]/11 text-[#FF453A]">Failed</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!loading && !showReport && !activeJobId && jobStatus !== 'failed' && (
                        <p className="text-[12px] text-center text-[var(--ds-muted)] py-5 m-0">No activity yet</p>
                      )}
                    </div>
                  </div>

                  {showReport && reportData && (() => {
                    const t = getTotalsAmounts(reportData.totals);
                    const items = [
                      { label: 'Total Rebates Earned', value: fmtCurrency(t.rebates), colorClass: 'text-[#0A84FF]' },
                      { label: 'Total Released',        value: fmtCurrency(t.released), colorClass: 'text-[#FF9F0A]' },
                      { label: 'Balance',               value: fmtCurrency(t.balance), colorClass: t.balance < 0 ? 'text-[#FF453A]' : 'text-[#32D74B]' },
                    ];
                    return (
                      <div className="ds-glass ds-pop bg-[var(--ds-glass)] border border-[var(--ds-hairline)] rounded-[18px] px-[18px] py-4">
                        <p className="text-[11px] font-bold text-[var(--ds-muted)] uppercase tracking-[0.06em] m-0 mb-3">
                          Summary
                        </p>
                        {items.map(({ label, value, colorClass }, idx) => (
                          <div key={label} className={`flex justify-between items-center py-2 ${idx < items.length - 1 ? 'border-b border-[var(--ds-hairline)]' : ''}`}>
                            <span className="text-[12px] text-[var(--ds-muted)]">{label}</span>
                            <span className={`text-[13px] font-bold ds-font-mono ${colorClass}`}>{value}</span>
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
    </DesignPage>
  );
}

export default Vcp_Reports;