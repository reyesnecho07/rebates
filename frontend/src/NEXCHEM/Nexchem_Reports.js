// src/pages/Nexchem_Reports.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from 'axios';
import {
  FileText, BarChart2, FileSpreadsheet, Calendar, Clock, CheckCircle,
  XCircle, RefreshCw, Users, X, Download, Zap, TrendingUp, ChevronDown, Tag,
} from "lucide-react";
import nexchemLogo from "../assets/nexchem.png";
import nexchemReport from '../assets/nexchemreport.png';
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

/* ─── Apple system colour language ───────────────────────────────────────── */
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

// ─── Paper constants (8.5 × 10.5 inches @ 96 dpi) ────────────────────────────
const PAPER_W_PX = 816;
const PAPER_H_PX = 1008;
const PAPER_W_MM = 215.9;
const PAPER_H_MM = 266.7;
const PAD_X = 52;
const PAD_Y = 44;
const CELL_BORDER_WIDTH = 0.5;

const injectFonts = () => {
  if (document.getElementById('nexchem-report-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'nexchem-report-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

// ─── Local helpers (mirror backend semantics for UI display) ─────────────────
const normaliseType = (raw) =>
  String(raw ?? '').toLowerCase().replace(/[\s_\-]/g, '').trim();

/** Given a raw RebateType, return a friendly label. */
const rebateLabelFromType = (raw) => {
  const t = normaliseType(raw);
  if (!raw) return 'Fixed';
  if (t.includes('percent'))   return 'Percentage';
  if (t.includes('increment')) return 'Incremental';
  if (t.includes('quota'))     return 'Fixed with Quota';
  return 'Fixed';
};

/** Given a raw RebateType, return calc mode: 'fixed' | 'incremental' | 'percentage'. */
const calcModeFromType = (raw) => {
  const t = normaliseType(raw);
  if (t.includes('percent'))   return 'percentage';
  if (t.includes('increment')) return 'incremental';
  return 'fixed';
};

// ─── ReportPage (print/PDF output — always clean, type-aware) ────────────────
const ReportPage = React.forwardRef(({
  pageRows, pageIndex, totalPages, isFirstCustomerPage, isLastCustomerPage,
  customerName, customerTotals, userName, getRebatePeriod, getCurrentDate,
  scale, selectedRebateCode, rebateLabel, calcMode,
}, ref) => {
  const s  = (n) => n * scale;
  const px = (n) => `${s(n)}px`;
  const cellBorder = `${s(CELL_BORDER_WIDTH)}px solid #555`;

  const isPercentage = calcMode === 'percentage';
  const rateHeader   = isPercentage ? 'RATE (%)' : 'KITANEX';
  const fmtRate = (v) => {
    const n = Number(v) || 0;
    return isPercentage
      ? `${n.toFixed(2)}%`
      : n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  };
  const fmtMoney = (v) =>
    `₱${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const displayCustomerName =
    customerName && customerName !== 'unknown' && customerName !== 'Unknown'
      ? customerName
      : 'Customer';

  const subtitleBits = [selectedRebateCode, rebateLabel].filter(Boolean);

  return (
    <div
      ref={ref}
      style={{
        width: px(PAPER_W_PX), height: px(PAPER_H_PX),
        padding: `${px(PAD_Y)} ${px(PAD_X)}`,
        boxSizing: 'border-box', background: '#ffffff',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Arial, sans-serif', overflow: 'hidden',
      }}
    >
      {isFirstCustomerPage && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: px(10) }}>
          <img src={nexchemReport} alt="Nexchem" style={{ width: px(140), height: 'auto', display: 'block' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: px(15), fontWeight: '800', color: '#1a1a1a', marginBottom: px(2) }}>KITANEX REBATE REPORT</div>
            {subtitleBits.length > 0 && (
              <div style={{ fontSize: px(9), color: '#0A84FF', fontWeight: '700', marginBottom: px(2) }}>
                {subtitleBits.join(' · ')}
              </div>
            )}
            <div style={{ fontSize: px(9.5), color: '#555', marginBottom: px(1) }}>{getRebatePeriod()}</div>
            <div style={{ fontSize: px(9.5), color: '#777' }}>{getCurrentDate()}</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <table style={{
          width: '100%', borderCollapse: 'separate', borderSpacing: 0,
          fontSize: px(9), tableLayout: 'fixed',
          borderLeft: cellBorder, borderTop: cellBorder,
        }}>
          <colgroup>
            <col style={{ width: '40%' }} /><col style={{ width: '8%' }} />
            <col style={{ width: '17%' }} /><col style={{ width: '10%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>

          {isFirstCustomerPage && (
            <thead>
              <tr style={{ background: '#dbeafe' }}>
                {[
                  { label: displayCustomerName, align: 'left'   },
                  { label: 'QTY',               align: 'center' },
                  { label: 'SALES AMT',          align: 'center' },
                  { label: rateHeader,           align: 'center' },
                  { label: 'TOTAL KITANEX',      align: 'center' },
                ].map(({ label, align }, i) => (
                  <th key={i} style={{
                    borderRight: cellBorder, borderBottom: cellBorder,
                    padding: `${px(4)} ${px(5)}`, textAlign: align,
                    fontWeight: '700', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{label}</th>
                ))}
              </tr>
            </thead>
          )}

          <tbody>
            {pageRows.map((row, idx) => {
              if (row.type === 'date') return (
                <tr key={idx} style={{ background: '#f3f4f6' }}>
                  <td colSpan={5} style={{
                    borderRight: cellBorder, borderBottom: cellBorder,
                    padding: `${px(3)} ${px(5)}`, fontWeight: '700', color: '#1a1a1a',
                  }}>{row.content}</td>
                </tr>
              );

              if (row.type === 'invoice') return (
                <tr key={idx} style={{ background: '#f9fafb' }}>
                  <td colSpan={5} style={{
                    borderRight: cellBorder, borderBottom: cellBorder,
                    padding: `${px(3)} ${px(14)}`, fontWeight: '600', color: '#333',
                  }}>{row.content}</td>
                </tr>
              );

              if (row.type === 'item') {
                const item = row.content;
                return (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ borderRight: cellBorder, borderBottom: cellBorder, padding: `${px(2.5)} ${px(5)} ${px(2.5)} ${px(20)}`, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                    <td style={{ borderRight: cellBorder, borderBottom: cellBorder, padding: `${px(2.5)} ${px(3)}`, textAlign: 'center', color: '#333' }}>{item.qty.toLocaleString()}</td>
                    <td style={{ borderRight: cellBorder, borderBottom: cellBorder, padding: `${px(2.5)} ${px(5)}`, textAlign: 'right', color: '#333' }}>{fmtMoney(item.sales_amt)}</td>
                    <td style={{ borderRight: cellBorder, borderBottom: cellBorder, padding: `${px(2.5)} ${px(3)}`, textAlign: 'center', color: '#333' }}>{fmtRate(item.kitanex)}</td>
                    <td style={{ borderRight: cellBorder, borderBottom: cellBorder, padding: `${px(2.5)} ${px(5)}`, textAlign: 'right', color: '#333' }}>{fmtMoney(item.total_kitanex)}</td>
                  </tr>
                );
              }
              return null;
            })}
          </tbody>

          {isLastCustomerPage && customerTotals && (
            <tfoot>
              <tr style={{ background: '#eff6ff' }}>
                <td style={{ borderRight: cellBorder, borderBottom: cellBorder, padding: `${px(4)} ${px(5)}`, fontWeight: '700', color: '#1a1a1a' }}>Grand Total</td>
                <td style={{ borderRight: cellBorder, borderBottom: cellBorder, padding: `${px(4)} ${px(3)}`, textAlign: 'center', fontWeight: '700', color: '#1a1a1a' }}>{customerTotals.totalQty.toLocaleString()}</td>
                <td style={{ borderRight: cellBorder, borderBottom: cellBorder, padding: `${px(4)} ${px(5)}`, textAlign: 'right', fontWeight: '700', color: '#1a1a1a' }}>{fmtMoney(customerTotals.totalSales)}</td>
                <td style={{ borderRight: cellBorder, borderBottom: cellBorder, padding: `${px(4)} ${px(3)}`, color: '#1a1a1a' }}></td>
                <td style={{ borderRight: cellBorder, borderBottom: cellBorder, padding: `${px(4)} ${px(5)}`, textAlign: 'right', fontWeight: '700', color: '#1a1a1a' }}>{fmtMoney(customerTotals.totalKitanex)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {isLastCustomerPage && (
        <div style={{ marginTop: px(20), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: px(28), flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: px(9), fontWeight: '600', color: '#374151', marginBottom: px(20) }}>Prepared by:</p>
            <p style={{ fontSize: px(10), fontWeight: '700', color: '#1a1a1a' }}>{userName}</p>
            <p style={{ fontSize: px(9), color: '#6b7280' }}>Marketing Associate</p>
          </div>
          <div>
            <p style={{ fontSize: px(9), fontWeight: '600', color: '#374151', marginBottom: px(20) }}>Checked by:</p>
            <p style={{ fontSize: px(10), fontWeight: '700', color: '#1a1a1a' }}>Joy O. Sarcia</p>
            <p style={{ fontSize: px(9), color: '#6b7280' }}>Purchasing Supervisor</p>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: px(8), color: '#9ca3af', marginTop: px(10), flexShrink: 0 }}>
        Page {pageIndex + 1} of {totalPages}
      </div>
    </div>
  );
});

// ─── Main Component ────────────────────────────────────────────────────────────
function Nexchem_Reports() {
  useEffect(() => { injectFonts(); }, []);

  const { theme, updateTheme } = useTheme();
  const routePath = '/Nexchem_Reports';
  const isDark = theme === 'dark';
  const K = dashTokens(isDark);

  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName]   = useState("");
  const [userCode, setUserCode]   = useState("");
  const [initials, setInitials]   = useState("");

  const [rebateCodes, setRebateCodes]                     = useState([]);
  const [selectedRebateCode, setSelectedRebateCode]       = useState("");
  const [selectedRebateProgram, setSelectedRebateProgram] = useState(null);
  const [selectedRebateType,  setSelectedRebateType]      = useState("");   // raw
  const [selectedRebateLabel, setSelectedRebateLabel]     = useState("");   // friendly
  const [selectedCalcMode,    setSelectedCalcMode]        = useState("fixed");
  const [rebateCodesLoading, setRebateCodesLoading]       = useState(false);
  const [customersLoading, setCustomersLoading]           = useState(false);

  const [selectedCustomers, setSelectedCustomers]         = useState([]);
  const [availableCustomers, setAvailableCustomers]       = useState([]);
  const [tempSelectedCustomers, setTempSelectedCustomers] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown]   = useState(false);

  const [dateFrom, setDateFrom]                 = useState("");
  const [dateTo, setDateTo]                     = useState("");
  const [reportData, setReportData]             = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [currentPage, setCurrentPage]           = useState(1);
  const [showReport, setShowReport]             = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const [allPages, setAllPages]     = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  const [showVanDropdown, setShowVanDropdown]         = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(true);
  const [showVcpDropdown, setShowVcpDropdown]         = useState(false);

  const { access, accessLoading, accessError } = useAccessControl(routePath);
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobStatus, setJobStatus]     = useState(null);

  const API_BASE = 'http://192.168.100.193:3009/api';
  const DB_NAME  = 'USER';

  useComponentRegistration({
    name: 'Nexchem_Reports', version: '3.1.0',
    description: 'Reporting module – per-customer KITANEX rebate reports for all rebate types.',
    routePath: '/Nexchem_Reports',
  });

  const FIRST_PAGE_MAX_ROWS  = 34;
  const OTHER_PAGES_MAX_ROWS = 43;

  const fontStack = "'Outfit', system-ui, sans-serif";
  const monoStack = "'DM Mono', monospace";

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatDateToDayMonth = useCallback((dateString) => {
    if (!dateString) return "Invalid Date";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "Invalid Date";
      return `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleDateString('en-US', { month: 'short' })}`;
    } catch { return "Invalid Date"; }
  }, []);

  const getCurrentDate = useCallback(() =>
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), []);

  const getCurrentDateForFilename = useCallback(() => {
    const n = new Date();
    return `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}`;
  }, []);

  const getRebatePeriod = useCallback(() => {
    const fmt = (d, opts) => d.toLocaleDateString('en-US', opts);
    if (reportData.length > 0) {
      const dates = reportData.map(i => new Date(i.docDate)).filter(d => !isNaN(d));
      if (!dates.length) return "Invalid Dates";
      const min = new Date(Math.min(...dates)), max = new Date(Math.max(...dates));
      if (min.getMonth() === max.getMonth() && min.getFullYear() === max.getFullYear())
        return `${fmt(min, { month: 'long' })} ${min.getDate()} - ${max.getDate()}, ${min.getFullYear()}`;
      return `${fmt(min, { month: 'long', day: 'numeric', year: 'numeric' })} - ${fmt(max, { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    if (dateFrom && dateTo) {
      const f = new Date(dateFrom), t = new Date(dateTo);
      if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear())
        return `${fmt(f, { month: 'long' })} ${f.getDate()} - ${t.getDate()}, ${f.getFullYear()}`;
      return `${fmt(f, { month: 'long', day: 'numeric', year: 'numeric' })} - ${fmt(t, { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    return "All Dates";
  }, [reportData, dateFrom, dateTo]);

  const generateFilename = useCallback((ext) => {
    const d = getCurrentDateForFilename();
    const code = selectedRebateCode || 'REBATE';
    return `${code}_KITANEX_REPORT_${d}.${ext}`;
  }, [selectedRebateCode, getCurrentDateForFilename]);

  const buildFlattenedRows = useCallback((groups) => {
    const rows = [];
    groups.forEach((group, gi) => {
      const showDate = gi === 0 || formatDateToDayMonth(group.docDate) !== formatDateToDayMonth(groups[gi - 1].docDate);
      if (showDate) rows.push({ type: 'date', content: formatDateToDayMonth(group.docDate), groupId: group.id, docDate: group.docDate });
      rows.push({ type: 'invoice', content: group.id, groupId: group.id, docDate: group.docDate });
      group.items.forEach(item => rows.push({ type: 'item', content: item, groupId: group.id, docDate: group.docDate }));
    });
    return rows;
  }, [formatDateToDayMonth]);

  const buildAllCustomerPages = useCallback((data) => {
    const customerMap = {};
    const customerOrder = [];
    data.forEach(group => {
      const code = group.customerCode || group.CardCode || group.cardCode;
      const name = group.customerName || group.CardName || group.cardName;
      if (!code || code === 'unknown') return;
      if (!customerMap[code]) { customerMap[code] = { name: name || code, groups: [] }; customerOrder.push(code); }
      customerMap[code].groups.push(group);
    });

    const pages = [];
    customerOrder.forEach(code => {
      const { name, groups } = customerMap[code];
      const hasItems = groups.some(g => g.items && g.items.length > 0);
      if (!hasItems) return;

      const customerTotals = { totalQty: 0, totalSales: 0, totalKitanex: 0 };
      groups.forEach(g => {
        if (g.items) {
          g.items.forEach(i => {
            customerTotals.totalQty     += i.qty || 0;
            customerTotals.totalSales   += i.sales_amt || 0;
            customerTotals.totalKitanex += i.total_kitanex || 0;
          });
        }
      });

      const rows = buildFlattenedRows(groups);
      let idx = 0, custPageNum = 0;
      const custPageSlices = [];

      while (idx < rows.length) {
        const max = custPageNum === 0 ? FIRST_PAGE_MAX_ROWS : OTHER_PAGES_MAX_ROWS;
        let end = Math.min(idx + max, rows.length);
        if (end < rows.length) {
          const last = rows[end - 1];
          const next = rows[end];
          if (last && next && last.type === 'item' && next.type === 'item' && last.groupId === next.groupId) {
            let gs = end - 1;
            while (gs > idx && rows[gs - 1] && rows[gs - 1].groupId === last.groupId) gs--;
            if (gs > idx) end = gs;
          }
          if (last && next && last.type === 'item' && next.type === 'invoice' && last.groupId === next.groupId) end--;
        }
        if (end <= idx) end = Math.min(idx + max, rows.length);
        custPageSlices.push(rows.slice(idx, end));
        idx = end; custPageNum++;
      }

      if (custPageSlices.length > 0) {
        custPageSlices.forEach((pageRows, pi) => {
          pages.push({
            rows: pageRows, customerCode: code, customerName: name,
            isFirstCustomerPage: pi === 0,
            isLastCustomerPage:  pi === custPageSlices.length - 1,
            customerTotals,
          });
        });
      }
    });

    return pages;
  }, [buildFlattenedRows]);

  const calculateGrandTotals = useCallback((data = reportData) => {
    let totalQty = 0, totalSales = 0, totalKitanex = 0;
    data.forEach(g => (g.items || []).forEach(i => {
      totalQty     += i.qty || 0;
      totalSales   += i.sales_amt || 0;
      totalKitanex += i.total_kitanex || 0;
    }));
    return { totalQty, totalSales, totalKitanex };
  }, [reportData]);

  const { totalQty, totalSales, totalKitanex } = calculateGrandTotals();

  // ── Close customer dropdown when clicking outside ──────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showCustomerDropdown && !e.target.closest('.customer-dropdown-container')) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomerDropdown]);

  // ── Lifecycle: restore persisted state ────────────────────────────────────
  useEffect(() => {
    try {
      const sd = localStorage.getItem("savedReportData");
      const sp = localStorage.getItem("savedReportParams");
      const ss = localStorage.getItem("savedShowReport");
      const sc = localStorage.getItem("savedCurrentPage");
      const sk = localStorage.getItem("savedSelectedCustomers");
      const sr = localStorage.getItem("savedRebateCode");
      const st = localStorage.getItem("savedRebateType");
      const sl = localStorage.getItem("savedRebateLabel");
      const sm = localStorage.getItem("savedCalcMode");

      if (sd) {
        const d = JSON.parse(sd);
        setReportData(d);
        const pages = buildAllCustomerPages(d);
        setAllPages(pages); setTotalPages(pages.length);
      }
      if (sp) { const p = JSON.parse(sp); setDateFrom(p.dateFrom || ""); setDateTo(p.dateTo || ""); }
      if (sk) setSelectedCustomers(JSON.parse(sk));
      if (ss) setShowReport(JSON.parse(ss));
      if (sc) setCurrentPage(JSON.parse(sc));
      if (sr) setSelectedRebateCode(JSON.parse(sr));
      if (st) setSelectedRebateType(JSON.parse(st));
      if (sl) setSelectedRebateLabel(JSON.parse(sl));
      if (sm) setSelectedCalcMode(JSON.parse(sm));
    } catch (e) { console.error('Restore error:', e); }
  }, []); // eslint-disable-line

  // ── Lifecycle: theme ───────────────────────────────────────────────────────
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const u = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const uid = u.UserID || u.User_ID;
        if (uid) {
          const res = await axios.get(`${API_BASE}/user/preferences/${uid}/theme?db=${DB_NAME}`);
          if (res.data.success && res.data.value) { const t = res.data.value.toLowerCase(); if (t !== theme) updateTheme(t); }
        }
      } catch {
        const lt = localStorage.getItem('userTheme');
        if (lt && lt !== theme) updateTheme(lt);
      }
    };
    loadTheme();
  }, []); // eslint-disable-line

  // ── Lifecycle: user info ───────────────────────────────────────────────────
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const un = u.DisplayName || u.Username || "Unknown User";
    setUserName(un); setUserCode(u.User_ID || "Unknown ID");
    const parts = un.trim().split(" ");
    setInitials(parts.length === 1 ? parts[0][0].toUpperCase() : parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase());
  }, []);

  // ── Lifecycle: fetch rebate codes ──────────────────────────────────────────
  useEffect(() => {
    const fetchRebateCodes = async () => {
      setRebateCodesLoading(true);
      try {
        const res  = await fetch(`${API_BASE}/rebate-program/all-codes?db=NEXCHEM`);
        const data = await res.json();
        if (data.success) setRebateCodes(data.codes || []);
      } catch (e) { console.error('Error fetching rebate codes:', e); }
      finally { setRebateCodesLoading(false); }
    };
    fetchRebateCodes();
  }, [API_BASE]);

  // ── Persist state ──────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem("savedCurrentPage", JSON.stringify(currentPage)); }, [currentPage]);
  useEffect(() => { if (reportData.length > 0) localStorage.setItem("savedReportData", JSON.stringify(reportData)); }, [reportData]);
  useEffect(() => { localStorage.setItem("savedReportParams", JSON.stringify({ dateFrom, dateTo })); }, [dateFrom, dateTo]);
  useEffect(() => { localStorage.setItem("savedSelectedCustomers", JSON.stringify(selectedCustomers)); }, [selectedCustomers]);
  useEffect(() => { localStorage.setItem("savedShowReport", JSON.stringify(showReport)); }, [showReport]);
  useEffect(() => { localStorage.setItem("savedRebateCode", JSON.stringify(selectedRebateCode)); }, [selectedRebateCode]);
  useEffect(() => { localStorage.setItem("savedRebateType", JSON.stringify(selectedRebateType)); }, [selectedRebateType]);
  useEffect(() => { localStorage.setItem("savedRebateLabel", JSON.stringify(selectedRebateLabel)); }, [selectedRebateLabel]);
  useEffect(() => { localStorage.setItem("savedCalcMode", JSON.stringify(selectedCalcMode)); }, [selectedCalcMode]);

  // ── Handle rebate code selection ───────────────────────────────────────────
  const handleRebateCodeChange = async (code) => {
    setSelectedRebateCode(code);
    setSelectedCustomers([]); setReportData([]); setAllPages([]); setTotalPages(1);
    setShowReport(false); setCurrentPage(1);
    setSelectedRebateType(""); setSelectedRebateLabel(""); setSelectedCalcMode("fixed");

    if (!code) { setSelectedRebateProgram(null); setDateFrom(""); setDateTo(""); return; }

    const prog = rebateCodes.find(r => r.RebateCode === code);
    if (prog) {
      setSelectedRebateProgram(prog);
      const rawType = prog.RebateType || "";
      setSelectedRebateType(rawType);
      setSelectedRebateLabel(rebateLabelFromType(rawType));
      setSelectedCalcMode(calcModeFromType(rawType));
      if (prog.DateFrom) setDateFrom(new Date(prog.DateFrom).toISOString().split('T')[0]);
      if (prog.DateTo)   setDateTo(new Date(prog.DateTo).toISOString().split('T')[0]);
    }

    setCustomersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/nexchem/rebate/${code}/customers?db=NEXCHEM`);
      const data = await res.json();
      if (data.success && data.customers) {
        const customers = data.customers.map(c => ({ CardCode: c.CardCode, CardName: c.CardName }));
        setAvailableCustomers(customers);
        setSelectedCustomers(customers);
        setTempSelectedCustomers(customers);

        if (data.rebateInfo) setSelectedRebateProgram(prev => ({ ...prev, ...data.rebateInfo }));
        // Server-authoritative label + mode
        if (data.rebateLabel) setSelectedRebateLabel(data.rebateLabel);
        else if (data.rebateInfo?.RebateLabel) setSelectedRebateLabel(data.rebateInfo.RebateLabel);
        if (data.rebateType) {
          setSelectedRebateType(data.rebateType);
          setSelectedCalcMode(calcModeFromType(data.rebateType));
        } else if (data.rebateInfo?.RebateType) {
          setSelectedRebateType(data.rebateInfo.RebateType);
          setSelectedCalcMode(calcModeFromType(data.rebateInfo.RebateType));
        }
      } else {
        alert(`Failed to load customers: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Error fetching customers for rebate code:', e);
      alert(`Failed to load customers for rebate code "${code}". Please try again.`);
    } finally { setCustomersLoading(false); }
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const generateReport = async () => {
    if (!access.canCreate)         { alert("You do not have permission to generate reports."); return; }
    if (!selectedCustomers.length) { alert("Please select a rebate code first.");              return; }
    setLoading(true);
    const jobId = `job_${Date.now()}`;
    setActiveJobId(jobId); setJobStatus('processing');
    try {
      const customerCodes = selectedCustomers.map(c => c.CardCode).filter(Boolean);
      const res = await fetch(`${API_BASE}/nexchem/generate-multi-customer-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          customerCodes,
          dateFrom: dateFrom || null,
          dateTo:   dateTo   || null,
          rebateCode: selectedRebateCode || null,
          db: 'NEXCHEM',
        }),
      });
      const text = await res.text();
      let result; try { result = JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${text.substring(0, 100)}`); }
      if (!res.ok) throw new Error(result.error || result.message || `HTTP ${res.status}`);
      if (result.success && result.data) {
        setJobStatus('completed');
        setReportData(result.data);

        // Server returns the authoritative type + label + mode
        if (result.rebateType)  setSelectedRebateType(result.rebateType);
        if (result.rebateLabel) setSelectedRebateLabel(result.rebateLabel);
        if (result.calcMode)    setSelectedCalcMode(result.calcMode);
        else if (result.rebateType) setSelectedCalcMode(calcModeFromType(result.rebateType));

        const pages = buildAllCustomerPages(result.data);
        setAllPages(pages); setTotalPages(pages.length);
        setCurrentPage(1); setShowReport(true); setLoading(false); setActiveJobId(null);
        localStorage.setItem("savedReportData", JSON.stringify(result.data));
        localStorage.setItem("savedRebateType", JSON.stringify(result.rebateType || ""));
        localStorage.setItem("savedRebateLabel", JSON.stringify(result.rebateLabel || ""));
        localStorage.setItem("savedCalcMode", JSON.stringify(result.calcMode || "fixed"));
      } else {
        throw new Error(result.error || 'Failed to generate report');
      }
    } catch (e) {
      console.error("Error generating report:", e);
      setJobStatus('failed'); setLoading(false);
      alert(`Failed to generate report: ${e.message}`);
    }
  };

  const clearReport = () => {
    setReportData([]); setAllPages([]); setTotalPages(1); setShowReport(false);
    setActiveJobId(null); setJobStatus(null);
    setSelectedRebateCode(""); setSelectedRebateProgram(null);
    setSelectedRebateType(""); setSelectedRebateLabel(""); setSelectedCalcMode("fixed");
    setSelectedCustomers([]); setDateFrom(""); setDateTo("");
    setCurrentPage(1); setAvailableCustomers([]); setTempSelectedCustomers([]);
    ['savedReportData', 'savedReportParams', 'savedShowReport', 'savedCurrentPage',
     'savedSelectedCustomers', 'savedRebateCode', 'savedRebateType',
     'savedRebateLabel', 'savedCalcMode'].forEach(k => localStorage.removeItem(k));
  };

  const paginate = useCallback((p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); }, [totalPages]);
  const currentPageData = allPages[currentPage - 1] || null;
  const sharedPageProps = {
    userName, getRebatePeriod, getCurrentDate, totalPages,
    selectedRebateCode,
    rebateLabel: selectedRebateLabel,
    calcMode:    selectedCalcMode,
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const exportToPDF = async () => {
    if (!allPages.length) return;
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PAPER_W_MM, PAPER_H_MM] });
      for (let pi = 0; pi < allPages.length; pi++) {
        if (pi > 0) pdf.addPage([PAPER_W_MM, PAPER_H_MM], 'portrait');
        const pg = allPages[pi];
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-9999;background:#fff;';
        document.body.appendChild(container);
        const { createRoot } = await import('react-dom/client');
        const root = createRoot(container);
        await new Promise(resolve => {
          root.render(
            <ReportPage {...sharedPageProps} pageRows={pg.rows} pageIndex={pi}
              isFirstCustomerPage={pg.isFirstCustomerPage} isLastCustomerPage={pg.isLastCustomerPage}
              customerName={pg.customerName} customerTotals={pg.customerTotals} scale={1} />
          );
          setTimeout(resolve, 120);
        });
        const canvas = await html2canvas(container.firstElementChild, {
          scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true,
          width: PAPER_W_PX, height: PAPER_H_PX,
        });
        root.unmount(); document.body.removeChild(container);
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, PAPER_W_MM, PAPER_H_MM, undefined, 'FAST');
      }
      pdf.save(generateFilename('pdf'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // ── Excel Export ───────────────────────────────────────────────────────────
  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const customerMap  = {};
      const customerNameMap = {};
      reportData.forEach(group => {
        const code = group.customerCode || group.CardCode || 'unknown';
        const name = group.customerName || group.CardName || code;
        if (!customerMap[code]) { customerMap[code] = []; customerNameMap[code] = name; }
        customerMap[code].push(group);
      });

      const isPct = selectedCalcMode === 'percentage';
      const rateColHeader = isPct ? 'RATE (%)' : 'KITANEX';
      const fmtRateCell = (v) => isPct ? `${(Number(v) || 0).toFixed(2)}%` : (Number(v) || 0);

      Object.entries(customerMap).forEach(([code, groups]) => {
        const customerName = customerNameMap[code] || code;
        const rows = buildFlattenedRows(groups);
        const totals = (() => {
          let q = 0, s = 0, k = 0;
          groups.forEach(g => (g.items || []).forEach(i => { q += i.qty || 0; s += i.sales_amt || 0; k += i.total_kitanex || 0; }));
          return { totalQty: q, totalSales: s, totalKitanex: k };
        })();

        const excelRows = [
          ['NEXCHEM CORPORATION'],
          ['SALES REBATE REPORT - KITANEX'],
          [],
          ['Rebate Code:', selectedRebateCode || ''],
          ['Rebate Type:', selectedRebateLabel || ''],
          ['Customer:', customerName],
          ['Period:', getRebatePeriod()],
          ['Date:', getCurrentDate()],
          [],
          ['DESCRIPTION', 'QTY', 'SALES AMT', rateColHeader, 'TOTAL KITANEX'],
        ];

        rows.forEach(row => {
          if      (row.type === 'date')    excelRows.push([row.content, '', '', '', '']);
          else if (row.type === 'invoice') excelRows.push([`  Invoice # ${row.content}`, '', '', '', '']);
          else if (row.type === 'item') {
            const i = row.content;
            excelRows.push([`    ${i.name}`, i.qty, i.sales_amt, fmtRateCell(i.kitanex), i.total_kitanex]);
          }
        });

        excelRows.push([], ['GRAND TOTAL', totals.totalQty, totals.totalSales, '', totals.totalKitanex], [], [],
          ['Prepared by:', '', '', 'Checked by:'],
          [userName, '', '', 'Joy O. Sarcia'],
          ['Marketing Associate', '', '', 'Purchasing Supervisor']);

        const ws = XLSX.utils.aoa_to_sheet(excelRows);
        ws['!cols'] = [{ wch: 50 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws, customerName.replace(/[\\/*?[\]:]/g, '').substring(0, 31));
      });

      saveAs(
        new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }),
        generateFilename('xlsx')
      );
    } catch (e) {
      console.error('Excel error:', e);
      alert('Failed to generate Excel file. Please try again.');
    }
  };

  // ── Status helpers ─────────────────────────────────────────────────────────
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

  const PREVIEW_SCALE = 700 / PAPER_W_PX;
  const PREVIEW_W = Math.round(PAPER_W_PX * PREVIEW_SCALE);
  const PREVIEW_H = Math.round(PAPER_H_PX * PREVIEW_SCALE);

  // ── Type badge colours ─────────────────────────────────────────────────────
  const typeBadgeColor = (() => {
    if (selectedCalcMode === 'percentage')   return APPLE.purple;
    if (selectedCalcMode === 'incremental')  return APPLE.green;
    if (/quota/i.test(selectedRebateLabel))  return APPLE.orange;
    return APPLE.blue;
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dash-page" style={{ display: 'flex', minHeight: '100vh', width: '100%', background: K.bg, fontFamily: fontStack, color: K.ink }}>
      <style>{DASH_FONT}</style>

      {/* Aurora wash */}
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
        showVanDropdown={showVanDropdown} setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown} setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />
      <main style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', marginLeft: collapsed ? 80 : 256, transition: 'margin-left 0.4s cubic-bezier(.4,0,.2,1)', zIndex: 1 }}>
        <Header collapsed={collapsed} userName={userName} userCode={userCode} initials={initials} logo={nexchemLogo} theme={theme} />
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
                    Kitanex Rebate Reports
                  </h1>
                  <p style={{ fontSize: 12, color: K.muted, margin: '3px 0 0', fontWeight: 400 }}>
                    Fixed · Fixed with Quota · Incremental · Percentage — every type supported
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
                accessError={accessError}
                message="You don't have permission to view this page. Contact your administrator for access."
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
                {/* ══ Main column ══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* ── Action bar ── */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="nx-btn-primary"
                        onClick={generateReport}
                        disabled={loading || !selectedCustomers.length || !access.canCreate}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                          border: 'none',
                          cursor: (access.canCreate && !loading && selectedCustomers.length) ? 'pointer' : 'not-allowed',
                          background: (access.canCreate && !loading && selectedCustomers.length)
                            ? `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`
                            : K.chipBg,
                          color: (access.canCreate && !loading && selectedCustomers.length) ? '#fff' : K.faint,
                          opacity: (access.canCreate && !loading && selectedCustomers.length) ? 1 : 0.6,
                          transition: 'all 0.2s',
                          boxShadow: (access.canCreate && !loading && selectedCustomers.length)
                            ? `0 4px 16px -6px ${APPLE.blue}88`
                            : 'none',
                          fontFamily: fontStack,
                        }}
                      >
                        {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Zap size={14} />}
                        {loading ? 'Generating…' : 'Generate Report'}
                      </button>
                      {showReport && reportData.length > 0 && (
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

                    {/* Export dropdown */}
                    <div style={{ position: 'relative' }}>
                      <button
                        disabled={!access.canExport || !showReport || !reportData.length}
                        onClick={() => { if (access.canExport && showReport && reportData.length) setShowExportDropdown(v => !v); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '9px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                          border: `1px solid ${(access.canExport && showReport && reportData.length) ? `${APPLE.blue}55` : K.hairline}`,
                          background: (access.canExport && showReport && reportData.length) ? `${APPLE.blue}1c` : K.chipBg,
                          color: (access.canExport && showReport && reportData.length) ? APPLE.blue : K.faint,
                          cursor: (access.canExport && showReport && reportData.length) ? 'pointer' : 'not-allowed',
                          opacity: (access.canExport && showReport && reportData.length) ? 1 : 0.5,
                          transition: 'all 0.2s', fontFamily: fontStack,
                        }}
                      >
                        <Download size={13} /> Export <ChevronDown size={13} />
                      </button>
                      {showExportDropdown && access.canExport && (
                        <div className="dash-glass dash-pop" style={{
                          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                          width: 220, borderRadius: 16, zIndex: 50,
                          background: K.glassDeep,
                          border: `1px solid ${K.rim}`,
                          boxShadow: K.shadow,
                          overflow: 'hidden',
                        }}>
                          <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid ${K.hairline}` }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: K.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Export as</p>
                          </div>
                          {[
                            { label: 'PDF Document',   ext: 'pdf',  icon: <FileText size={15} color={APPLE.red} />,       fn: exportToPDF   },
                            { label: 'Excel Workbook', ext: 'xlsx', icon: <FileSpreadsheet size={15} color={APPLE.green} />, fn: exportToExcel },
                          ].map(({ label, ext, icon, fn }) => (
                            <button
                              key={ext}
                              className="nx-export-item"
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
                  <div className="customer-dropdown-container" style={{ position: 'relative', zIndex: 30 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: 18 }}>
                      {/* Rebate Code */}
                      <div>
                        <label style={labelStyle}><Tag size={12} color={APPLE.blue} /> Rebate Code</label>
                        <div style={{ position: 'relative' }}>
                          <select
                            className="nx-select"
                            value={selectedRebateCode}
                            onChange={e => handleRebateCodeChange(e.target.value)}
                            disabled={rebateCodesLoading}
                            style={{ ...inputStyle, appearance: 'none', paddingRight: 36, cursor: rebateCodesLoading ? 'wait' : 'pointer', opacity: rebateCodesLoading ? 0.6 : 1 }}
                          >
                            <option value="">
                              {rebateCodesLoading ? 'Loading codes…' : '— Select a rebate code —'}
                            </option>
                            {rebateCodes.map(r => (
                              <option key={r.RebateCode} value={r.RebateCode}>
                                {r.RebateCode} — {r.SlpName} ({r.RebateType})
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={14} color={K.faint} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        </div>
                        {customersLoading && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: K.muted }}>
                            <RefreshCw size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
                            Fetching customers…
                          </div>
                        )}
                        {!customersLoading && selectedRebateCode && selectedCustomers.length === 0 && (
                          <p style={{ fontSize: 11, color: APPLE.red, marginTop: 6 }}>No customers found for this rebate code.</p>
                        )}
                      </div>

                      {/* Customer Selection */}
                      <div className="customer-dropdown-container" style={{ position: 'relative' }}>
                        <label style={labelStyle}><Users size={12} color={APPLE.blue} /> Customers</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (availableCustomers.length > 0) {
                              setShowCustomerDropdown(!showCustomerDropdown);
                              setTempSelectedCustomers([...selectedCustomers]);
                            }
                          }}
                          disabled={!selectedRebateCode || customersLoading}
                          style={{
                            ...inputStyle,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            textAlign: 'left',
                            cursor: (!selectedRebateCode || customersLoading) ? 'not-allowed' : 'pointer',
                            opacity: (!selectedRebateCode || customersLoading) ? 0.6 : 1,
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedCustomers.length === 0
                              ? 'No customers'
                              : selectedCustomers.length === availableCustomers.length
                              ? `All customers (${selectedCustomers.length})`
                              : `${selectedCustomers.length} selected`}
                          </span>
                          <ChevronDown size={14} color={K.faint} />
                        </button>

                        {showCustomerDropdown && availableCustomers.length > 0 && (
                          <div className="dash-glass dash-pop" style={{
                            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                            width: '100%', maxHeight: 260, overflowY: 'auto',
                            background: K.glassDeep,
                            border: `1px solid ${K.rim}`,
                            borderRadius: 16,
                            boxShadow: K.shadow,
                            zIndex: 100, padding: '6px 0',
                          }}>
                            <div
                              style={{
                                padding: '8px 12px',
                                borderBottom: `1px solid ${K.hairline}`,
                                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                background: K.chipBg,
                              }}
                              onClick={() => {
                                const allSelected = tempSelectedCustomers.length === availableCustomers.length;
                                setTempSelectedCustomers(allSelected ? [] : [...availableCustomers]);
                              }}
                            >
                              <input type="checkbox" checked={tempSelectedCustomers.length === availableCustomers.length} readOnly style={{ accentColor: APPLE.blue }} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: K.ink }}>Select All</span>
                            </div>

                            {availableCustomers.map(cust => (
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
                                  setTempSelectedCustomers(prev => exists ? prev.filter(c => c.CardCode !== cust.CardCode) : [...prev, cust]);
                                }}
                              >
                                <input type="checkbox" checked={tempSelectedCustomers.some(c => c.CardCode === cust.CardCode)} readOnly style={{ accentColor: APPLE.blue }} />
                                <span style={{ fontSize: 12, color: K.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {cust.CardName} <span style={{ color: K.muted, marginLeft: 4 }}>({cust.CardCode})</span>
                                </span>
                              </div>
                            ))}

                            <div style={{ padding: '8px 12px', borderTop: `1px solid ${K.hairline}` }}>
                              <button
                                onClick={() => { setSelectedCustomers(tempSelectedCustomers); setShowCustomerDropdown(false); }}
                                style={{
                                  width: '100%', padding: '6px 12px', borderRadius: 999, border: 'none',
                                  background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                                  color: '#fff', fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer', fontFamily: fontStack,
                                  boxShadow: `0 4px 12px -4px ${APPLE.blue}88`,
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
                        <label style={labelStyle}><Calendar size={12} color={APPLE.blue} /> Date From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="nx-input" style={inputStyle} />
                      </div>

                      {/* Date To */}
                      <div>
                        <label style={labelStyle}><Calendar size={12} color={APPLE.blue} /> Date To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="nx-input" style={inputStyle} />
                      </div>
                    </div>

                    {selectedRebateProgram && (
                      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, background: `${typeBadgeColor}14`, border: `1px solid ${typeBadgeColor}33`, flexWrap: 'wrap' }}>
                        <Tag size={12} color={typeBadgeColor} />
                        <span style={{ fontSize: 11, color: K.ink, fontWeight: 500 }}>
                          <strong style={{ color: typeBadgeColor }}>{selectedRebateProgram.RebateCode}</strong>
                          {selectedRebateLabel && <>{' '}·{' '}{selectedRebateLabel}</>}
                          {selectedRebateProgram.SlpName && <>{' '}·{' '}{selectedRebateProgram.SlpName}</>}
                        </span>
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: `${typeBadgeColor}1c`, color: typeBadgeColor,
                          fontFamily: monoStack, letterSpacing: '0.04em',
                        }}>
                          {selectedCalcMode === 'percentage' ? 'qty-sales × rate%'
                            : selectedCalcMode === 'incremental' ? 'qty × rate'
                            : 'qty × rate'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Job status bar ── */}
                  {loading && activeJobId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, background: `${APPLE.blue}14`, border: `1px solid ${APPLE.blue}33` }}>
                      {getStatusIcon(jobStatus)}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: APPLE.blue, margin: 0 }}>
                          Generating report for {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''}…
                        </p>
                        <p style={{ fontSize: 11, color: K.muted, margin: '2px 0 0', fontFamily: monoStack }}>{activeJobId}</p>
                      </div>
                    </div>
                  )}

                  {/* ── Loading spinner ── */}
                  {loading && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 380,
                      borderRadius: 18, border: `1px dashed ${K.hairline}`,
                      background: K.glass,
                    }}>
                      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{ position: 'relative', width: 56, height: 56 }}>
                          <div style={{ width: 56, height: 56, borderRadius: '50%', border: `4px solid ${K.hairline}`, position: 'absolute' }} />
                          <div style={{ width: 56, height: 56, borderRadius: '50%', border: `4px solid ${APPLE.blue}`, borderTopColor: 'transparent', animation: 'spin 0.75s linear infinite', position: 'absolute' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 700, color: K.ink, margin: '0 0 6px' }}>Building Reports</h3>
                          <p style={{ fontSize: 12, color: K.muted, margin: 0 }}>
                            Fetching data for <span style={{ fontWeight: 700, color: APPLE.blue }}>{selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''}</span>
                            {' '}under <span style={{ fontWeight: 700, color: typeBadgeColor }}>{selectedRebateCode}</span>
                            {selectedRebateLabel && <> · <span style={{ fontWeight: 700, color: typeBadgeColor }}>{selectedRebateLabel}</span></>}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Report Preview ── */}
                  {!loading && showReport && allPages.length > 0 && currentPageData && (
                    <div className="dash-glass" style={{ background: K.glass, border: `1px solid ${K.hairline}`, borderRadius: 18, padding: '20px 22px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: K.ink, margin: 0 }}>Report Preview</h3>
                          {selectedRebateLabel && (
                            <span style={{
                              padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                              background: `${typeBadgeColor}14`, color: typeBadgeColor,
                              fontFamily: monoStack,
                            }}>
                              {selectedRebateLabel}
                            </span>
                          )}
                          <span style={{
                            padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            background: `${APPLE.orange}14`, color: APPLE.orange,
                            fontFamily: monoStack, maxWidth: 250,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {currentPageData.customerName && currentPageData.customerName !== 'unknown'
                              ? currentPageData.customerName
                              : `Customer ${currentPageData.customerCode}`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: `${APPLE.blue}14`, color: APPLE.blue, fontFamily: monoStack }}>
                            Page {currentPage} of {totalPages}
                          </span>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: K.chipBg, color: K.muted, fontFamily: monoStack }}>
                            {currentPageData.rows.length} rows
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 20px' }}>
                        <div style={{ width: `${PREVIEW_W}px`, height: `${PREVIEW_H}px`, flexShrink: 0, position: 'relative', overflow: 'visible' }}>
                          <div style={{
                            position: 'absolute', top: 0, left: 0,
                            width: `${PAPER_W_PX}px`, height: `${PAPER_H_PX}px`,
                            transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.18)', border: `1px solid ${K.hairline}`,
                          }}>
                            <ReportPage {...sharedPageProps} pageRows={currentPageData.rows} pageIndex={currentPage - 1}
                              isFirstCustomerPage={currentPageData.isFirstCustomerPage}
                              isLastCustomerPage={currentPageData.isLastCustomerPage}
                              customerName={currentPageData.customerName}
                              customerTotals={currentPageData.customerTotals} scale={1} />
                          </div>
                        </div>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '16px 0 4px', borderTop: `1px solid ${K.hairline}`, marginTop: 16, flexWrap: 'wrap' }}>
                          <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="nx-page-btn"
                            style={{
                              padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                              border: `1px solid ${K.hairline}`, background: 'transparent', color: K.ink,
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              opacity: currentPage === 1 ? 0.4 : 1,
                              transition: 'all 0.15s', fontFamily: fontStack,
                            }}>
                            ← Prev
                          </button>
                          {(() => {
                            const pages = [];
                            if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                            else {
                              pages.push(1);
                              let s = Math.max(2, currentPage - 1), e = Math.min(totalPages - 1, currentPage + 1);
                              if (currentPage <= 3) { s = 2; e = Math.min(totalPages - 1, 4); }
                              else if (currentPage >= totalPages - 2) { s = Math.max(2, totalPages - 3); e = totalPages - 1; }
                              if (s > 2) pages.push('...');
                              for (let i = s; i <= e; i++) pages.push(i);
                              if (e < totalPages - 1) pages.push('...');
                              pages.push(totalPages);
                            }
                            return pages.map((p, i) => p === '...' ? (
                              <span key={`el-${i}`} style={{ fontSize: 13, color: K.muted, padding: '0 2px', userSelect: 'none' }}>…</span>
                            ) : (
                              <button key={p} onClick={() => paginate(p)} className="nx-page-btn"
                                style={{
                                  minWidth: 32, height: 32, padding: '0 8px',
                                  borderRadius: 999, fontSize: 12, fontWeight: 600,
                                  border: `1px solid ${currentPage === p ? 'transparent' : K.hairline}`,
                                  background: currentPage === p ? `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)` : 'transparent',
                                  color: currentPage === p ? '#fff' : K.ink,
                                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: fontStack,
                                  boxShadow: currentPage === p ? `0 4px 12px -4px ${APPLE.blue}88` : 'none',
                                }}>
                                {p}
                              </button>
                            ));
                          })()}
                          <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="nx-page-btn"
                            style={{
                              padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                              border: `1px solid ${K.hairline}`, background: 'transparent', color: K.ink,
                              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                              opacity: currentPage === totalPages ? 0.4 : 1,
                              transition: 'all 0.15s', fontFamily: fontStack,
                            }}>
                            Next →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Empty state ── */}
                    {!loading && (!showReport || allPages.length === 0) && (
                      <div className="dash-glass" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '100%', maxWidth: `${PREVIEW_W}px`, height: Math.round(PREVIEW_H * 0.55),
                        margin: '0 auto', borderRadius: 18,
                        border: `2px dashed ${K.hairline}`,
                        background: K.glass,
                      }}>
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 52, height: 52, borderRadius: 14,
                            background: showReport ? `${APPLE.orange}1c` : `${APPLE.blue}1c`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <BarChart2 size={24} color={showReport ? APPLE.orange : APPLE.blue} />
                          </div>
                          <div>
                            {showReport ? (
                              <>
                                <p style={{ fontSize: 14, fontWeight: 600, color: K.ink, margin: '0 0 4px' }}>
                                  No matching invoices found
                                </p>
                                <p style={{ fontSize: 12, color: K.muted, margin: 0, maxWidth: 420 }}>
                                  The report for <strong style={{ color: APPLE.orange }}>{selectedRebateCode}</strong>{' '}
                                  returned zero rows. Check the backend console — it prints exactly which step returned empty
                                  (customers / tiers / items / invoices / matched lines).
                                </p>
                              </>
                            ) : (
                              <>
                                <p style={{ fontSize: 14, fontWeight: 600, color: K.ink, margin: '0 0 4px' }}>No report generated yet</p>
                                <p style={{ fontSize: 12, color: K.muted, margin: 0 }}>
                                  Pick a <strong style={{ color: APPLE.blue }}>Rebate Code</strong>, confirm the date range, then click{' '}
                                  <strong style={{ color: APPLE.blue }}>Generate Report</strong>
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                {/* ══ Right sidebar ══ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24, alignSelf: 'start' }}>
                  {/* Activity */}
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
                              <p style={{ fontSize: 12, fontWeight: 600, color: K.ink, margin: 0 }}>{selectedRebateCode}</p>
                              {selectedRebateLabel && (
                                <p style={{ fontSize: 10, color: typeBadgeColor, margin: '2px 0 0', fontWeight: 600 }}>{selectedRebateLabel}</p>
                              )}
                              <p style={{ fontSize: 11, color: K.muted, margin: '2px 0 4px', fontFamily: monoStack }}>{formatJobDate(new Date().toISOString())}</p>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: `${APPLE.blue}1c`, color: APPLE.blue }}>Processing</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!loading && showReport && allPages.length > 0 && (
                        <div style={{ padding: '10px 12px', borderRadius: 14, background: `${APPLE.green}14`, border: `1px solid ${APPLE.green}33` }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <CheckCircle size={14} color={APPLE.green} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: K.ink, margin: 0 }}>{selectedRebateCode}</p>
                              {selectedRebateLabel && (
                                <p style={{ fontSize: 10, color: typeBadgeColor, margin: '2px 0 0', fontWeight: 600 }}>{selectedRebateLabel}</p>
                              )}
                              <p style={{ fontSize: 11, color: K.muted, margin: '2px 0 4px', fontFamily: monoStack }}>{formatJobDate(new Date().toISOString())}</p>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: `${APPLE.green}1c`, color: APPLE.green }}>Completed</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!loading && !showReport && (
                        <p style={{ fontSize: 12, textAlign: 'center', color: K.muted, padding: '20px 0', margin: 0 }}>No activity yet</p>
                      )}
                    </div>
                  </div>

                  {/* Grand Summary */}
                  {showReport && reportData.length > 0 && (
                    <div className="dash-glass dash-pop" style={{ background: K.glass, border: `1px solid ${K.hairline}`, borderRadius: 18, padding: '16px 18px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: K.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                        Grand Summary
                      </p>
                      <p style={{ fontSize: 10, color: K.muted, margin: '0 0 12px' }}>
                        All {selectedCustomers.length} customers combined
                      </p>
                      {[
                        { label: 'Total QTY',     value: totalQty.toLocaleString(), color: APPLE.blue },
                        { label: 'Total Sales',   value: `₱${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: K.ink },
                        { label: 'Total KITANEX', value: `₱${totalKitanex.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: APPLE.green },
                      ].map(({ label, value, color }, idx) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < 2 ? `1px solid ${K.hairline}` : 'none' }}>
                          <span style={{ fontSize: 12, color: K.muted }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: monoStack }}>{value}</span>
                        </div>
                      ))}

                      {allPages.filter(p => p.isLastCustomerPage).length > 1 && (
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${K.hairline}` }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: K.muted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Per Customer</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                            {allPages.filter(p => p.isLastCustomerPage).map((p) => (
                              <div key={p.customerCode} style={{ padding: '6px 8px', borderRadius: 10, background: K.chipBg, border: `1px solid ${K.hairline}` }}>
                                <p style={{ fontSize: 10, fontWeight: 600, color: K.ink, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customerName}</p>
                                <p style={{ fontSize: 10, color: APPLE.green, margin: 0, fontFamily: monoStack }}>
                                  ₱{p.customerTotals.totalKitanex.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Nexchem_Reports;