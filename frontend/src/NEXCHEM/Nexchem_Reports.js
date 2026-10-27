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
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';
import { API_BASE, DB_NAME } from '../config/appConfig';

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens, DesignPage } from '../design-system';

// ─── Paper constants ─────────────────────────────────────────────
const PAPER_W_PX = 816;
const PAPER_H_PX = 1008;
const PAPER_W_MM = 215.9;
const PAPER_H_MM = 266.7;
const PAD_X = 52;
const PAD_Y = 44;
const CELL_BORDER_WIDTH = 0.5;

// ─── Local helpers ───────────────────────────────────────────────
const normaliseType = (raw) =>
  String(raw ?? '').toLowerCase().replace(/[\s_\-]/g, '').trim();

const rebateLabelFromType = (raw) => {
  const t = normaliseType(raw);
  if (!raw) return 'Fixed';
  if (t.includes('percent'))   return 'Percentage';
  if (t.includes('increment')) return 'Incremental';
  if (t.includes('quota'))     return 'Fixed with Quota';
  return 'Fixed';
};

const calcModeFromType = (raw) => {
  const t = normaliseType(raw);
  if (t.includes('percent'))   return 'percentage';
  if (t.includes('increment')) return 'incremental';
  return 'fixed';
};

/* ─── ReportPage (print / PDF — kept fully inline styled) ───────── */
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

// ─── Main component ──────────────────────────────────────────────
function Nexchem_Reports() {
  const { theme, updateTheme } = useTokens();
  const routePath = '/Nexchem_Reports';

  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName]   = useState("");
  const [userCode, setUserCode]   = useState("");
  const [initials, setInitials]   = useState("");

  const [rebateCodes, setRebateCodes]                     = useState([]);
  const [selectedRebateCode, setSelectedRebateCode]       = useState("");
  const [selectedRebateProgram, setSelectedRebateProgram] = useState(null);
  const [selectedRebateType,  setSelectedRebateType]      = useState("");
  const [selectedRebateLabel, setSelectedRebateLabel]     = useState("");
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

  useComponentRegistration({
    name: 'Nexchem_Reports', version: '3.1.0',
    description: 'Reporting module – per-customer KITANEX rebate reports for all rebate types.',
    routePath: '/Nexchem_Reports',
  });

  const FIRST_PAGE_MAX_ROWS  = 34;
  const OTHER_PAGES_MAX_ROWS = 43;

  /* ── Helpers ───────────────────────────────────────────────────── */
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

  // ── Close customer dropdown ─────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showCustomerDropdown && !e.target.closest('.customer-dropdown-container')) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomerDropdown]);

  // ── Restore persisted state ─────────────────────────────────────
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

  // ── Load theme ──────────────────────────────────────────────────
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

  // ── Load user info ──────────────────────────────────────────────
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const un = u.DisplayName || u.Username || "Unknown User";
    setUserName(un); setUserCode(u.User_ID || "Unknown ID");
    const parts = un.trim().split(" ");
    setInitials(parts.length === 1 ? parts[0][0].toUpperCase() : parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase());
  }, []);

  // ── Fetch rebate codes ──────────────────────────────────────────
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

  // ── Persist state ───────────────────────────────────────────────
  useEffect(() => { localStorage.setItem("savedCurrentPage", JSON.stringify(currentPage)); }, [currentPage]);
  useEffect(() => { if (reportData.length > 0) localStorage.setItem("savedReportData", JSON.stringify(reportData)); }, [reportData]);
  useEffect(() => { localStorage.setItem("savedReportParams", JSON.stringify({ dateFrom, dateTo })); }, [dateFrom, dateTo]);
  useEffect(() => { localStorage.setItem("savedSelectedCustomers", JSON.stringify(selectedCustomers)); }, [selectedCustomers]);
  useEffect(() => { localStorage.setItem("savedShowReport", JSON.stringify(showReport)); }, [showReport]);
  useEffect(() => { localStorage.setItem("savedRebateCode", JSON.stringify(selectedRebateCode)); }, [selectedRebateCode]);
  useEffect(() => { localStorage.setItem("savedRebateType", JSON.stringify(selectedRebateType)); }, [selectedRebateType]);
  useEffect(() => { localStorage.setItem("savedRebateLabel", JSON.stringify(selectedRebateLabel)); }, [selectedRebateLabel]);
  useEffect(() => { localStorage.setItem("savedCalcMode", JSON.stringify(selectedCalcMode)); }, [selectedCalcMode]);

  // ── Handle rebate code selection ────────────────────────────────
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

  // ── Generate report ─────────────────────────────────────────────
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

  // ── PDF Export ──────────────────────────────────────────────────
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

  // ── Excel Export ────────────────────────────────────────────────
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

  // ── Status helpers ──────────────────────────────────────────────
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

  /* ── Shared class strings ──────────────────────────────────────── */
  const inputClasses = "w-full px-3 py-[9px] rounded-xl text-[13px] outline-none transition-colors bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)]";
  const labelClasses = "flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ds-muted)] mb-1.5 tracking-[0.05em] uppercase";

  const PREVIEW_SCALE = 700 / PAPER_W_PX;
  const PREVIEW_W = Math.round(PAPER_W_PX * PREVIEW_SCALE);
  const PREVIEW_H = Math.round(PAPER_H_PX * PREVIEW_SCALE);

  const typeBadgeColor = (() => {
    if (selectedCalcMode === 'percentage')   return PALETTE.purple;
    if (selectedCalcMode === 'incremental')  return PALETTE.green;
    if (/quota/i.test(selectedRebateLabel))  return PALETTE.orange;
    return PALETTE.blue;
  })();

  const canGenerate = access.canCreate && !loading && selectedCustomers.length > 0;
  const canExport = access.canExport && showReport && reportData.length > 0;

  const renderAccessLoading = () => (
    <div className="flex items-center justify-center min-h-[380px]">
      <div className="flex flex-col items-center gap-3.5">
        <div className="w-9 h-9 rounded-full animate-spin border-[3px] border-[var(--ds-hairline)] border-t-[#0A84FF]" />
        <p className="text-[13px] text-[var(--ds-muted)]">Verifying access…</p>
      </div>
    </div>
  );

  return (
    <DesignPage className="flex w-full">
      {/* Aurora wash */}
      <div className="pointer-events-none fixed inset-0 z-0 ds-aurora-blue-purple" />

      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown} setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown} setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />

      <main className={`relative flex-1 flex flex-col min-h-screen z-[1] transition-[margin-left] duration-[400ms] ease-[cubic-bezier(.4,0,.2,1)] ${
        collapsed ? 'ml-20' : 'ml-64'
      }`}>
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          logo={nexchemLogo}
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
                    Kitanex Rebate Reports
                  </h1>
                  <p className="text-[12px] text-[var(--ds-muted)] mt-[3px] mb-0 font-normal">
                    Fixed · Fixed with Quota · Incremental · Percentage — every type supported
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
                tokens={{...(({} , {})) /* placeholder — see below */}}
                accessError={accessError}
                message="You don't have permission to view this page. Contact your administrator for access."
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                {/* ══ Main column ══ */}
                <div className="flex flex-col gap-5">
                  {/* Action bar */}
                  <div className="flex items-center justify-between gap-2.5 flex-wrap">
                    <div className="flex gap-2">
                      <button
                        className={`ds-btn-primary flex items-center gap-1.5 px-4 py-[9px] rounded-full text-[13px] font-semibold transition-all duration-200 ${
                          canGenerate
                            ? 'ds-gradient-primary text-white cursor-pointer shadow-[0_4px_16px_-6px_rgba(10,132,255,0.53)]'
                            : 'bg-[var(--ds-chip-bg)] text-[var(--ds-faint)] opacity-60 cursor-not-allowed border-none'
                        }`}
                        onClick={generateReport}
                        disabled={!canGenerate}
                      >
                        {loading ? <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '0.8s' }} /> : <Zap size={14} />}
                        {loading ? 'Generating…' : 'Generate Report'}
                      </button>
                      {showReport && reportData.length > 0 && (
                        <button
                          className="ds-btn-secondary flex items-center gap-1.5 px-3.5 py-[9px] rounded-full text-[13px] font-medium border border-[var(--ds-hairline)] bg-transparent text-[var(--ds-muted)] hover:text-[var(--ds-ink)] hover:bg-[var(--ds-hover)] cursor-pointer transition-all duration-200"
                          onClick={clearReport}
                        >
                          <X size={13} /> Clear
                        </button>
                      )}
                    </div>

                    {/* Export dropdown */}
                    <div className="relative">
                      <button
                        disabled={!canExport}
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
                            { label: 'PDF Document',   ext: 'pdf',  icon: <FileText size={15} className="text-[#FF453A]" />,         fn: exportToPDF   },
                            { label: 'Excel Workbook', ext: 'xlsx', icon: <FileSpreadsheet size={15} className="text-[#32D74B]" />,    fn: exportToExcel },
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

                  {/* Filter bar */}
                  <div className="customer-dropdown-container relative z-30">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1.2fr] gap-[18px]">
                      {/* Rebate Code */}
                      <div>
                        <label className={labelClasses}><Tag size={12} className="text-[#0A84FF]" /> Rebate Code</label>
                        <div className="relative">
                          <select
                            className={`${inputClasses} ds-select appearance-none pr-9 ${
                              rebateCodesLoading ? 'cursor-wait opacity-60' : 'cursor-pointer'
                            }`}
                            value={selectedRebateCode}
                            onChange={e => handleRebateCodeChange(e.target.value)}
                            disabled={rebateCodesLoading}
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
                          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-faint)] pointer-events-none" />
                        </div>
                        {customersLoading && (
                          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--ds-muted)]">
                            <RefreshCw size={11} className="animate-spin" style={{ animationDuration: '0.8s' }} />
                            Fetching customers…
                          </div>
                        )}
                        {!customersLoading && selectedRebateCode && selectedCustomers.length === 0 && (
                          <p className="text-[11px] text-[#FF453A] mt-1.5">No customers found for this rebate code.</p>
                        )}
                      </div>

                      {/* Customers multi-select */}
                      <div className="customer-dropdown-container relative">
                        <label className={labelClasses}><Users size={12} className="text-[#0A84FF]" /> Customers</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (availableCustomers.length > 0) {
                              setShowCustomerDropdown(!showCustomerDropdown);
                              setTempSelectedCustomers([...selectedCustomers]);
                            }
                          }}
                          disabled={!selectedRebateCode || customersLoading}
                          className={`${inputClasses} flex items-center justify-between text-left ${
                            (!selectedRebateCode || customersLoading) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                          }`}
                        >
                          <span className="truncate">
                            {selectedCustomers.length === 0
                              ? 'No customers'
                              : selectedCustomers.length === availableCustomers.length
                              ? `All customers (${selectedCustomers.length})`
                              : `${selectedCustomers.length} selected`}
                          </span>
                          <ChevronDown size={14} className="text-[var(--ds-faint)]" />
                        </button>

                        {showCustomerDropdown && availableCustomers.length > 0 && (
                          <div className="ds-glass ds-pop absolute top-[calc(100%+6px)] left-0 w-full max-h-[260px] overflow-y-auto bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] rounded-2xl shadow-[var(--ds-shadow)] z-[100] py-1.5">
                            <div
                              className="px-3 py-2 border-b border-[var(--ds-hairline)] flex items-center gap-2 cursor-pointer bg-[var(--ds-chip-bg)]"
                              onClick={() => {
                                const allSelected = tempSelectedCustomers.length === availableCustomers.length;
                                setTempSelectedCustomers(allSelected ? [] : [...availableCustomers]);
                              }}
                            >
                              <input type="checkbox" checked={tempSelectedCustomers.length === availableCustomers.length} readOnly className="accent-[#0A84FF]" />
                              <span className="text-[12px] font-semibold text-[var(--ds-ink)]">Select All</span>
                            </div>

                            {availableCustomers.map(cust => (
                              <div
                                key={cust.CardCode}
                                className="px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors hover:bg-[var(--ds-chip-bg)]"
                                onClick={() => {
                                  const exists = tempSelectedCustomers.some(c => c.CardCode === cust.CardCode);
                                  setTempSelectedCustomers(prev => exists ? prev.filter(c => c.CardCode !== cust.CardCode) : [...prev, cust]);
                                }}
                              >
                                <input type="checkbox" checked={tempSelectedCustomers.some(c => c.CardCode === cust.CardCode)} readOnly className="accent-[#0A84FF]" />
                                <span className="text-[12px] text-[var(--ds-ink)] truncate">
                                  {cust.CardName} <span className="text-[var(--ds-muted)] ml-1">({cust.CardCode})</span>
                                </span>
                              </div>
                            ))}

                            <div className="px-3 py-2 border-t border-[var(--ds-hairline)]">
                              <button
                                onClick={() => { setSelectedCustomers(tempSelectedCustomers); setShowCustomerDropdown(false); }}
                                className="w-full px-3 py-1.5 rounded-full border-none text-white text-[12px] font-semibold cursor-pointer ds-gradient-primary shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]"
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className={labelClasses}><Calendar size={12} className="text-[#0A84FF]" /> Date From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={`${inputClasses} ds-input`} />
                      </div>

                      <div>
                        <label className={labelClasses}><Calendar size={12} className="text-[#0A84FF]" /> Date To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={`${inputClasses} ds-input`} />
                      </div>
                    </div>

                    {selectedRebateProgram && (
                      <div
                        className="mt-3.5 flex items-center gap-2.5 px-3 py-2 rounded-xl flex-wrap"
                        style={{
                          background: `${typeBadgeColor}14`,
                          border: `1px solid ${typeBadgeColor}33`,
                        }}
                      >
                        <Tag size={12} style={{ color: typeBadgeColor }} />
                        <span className="text-[11px] text-[var(--ds-ink)] font-medium">
                          <strong style={{ color: typeBadgeColor }}>{selectedRebateProgram.RebateCode}</strong>
                          {selectedRebateLabel && <>{' '}·{' '}{selectedRebateLabel}</>}
                          {selectedRebateProgram.SlpName && <>{' '}·{' '}{selectedRebateProgram.SlpName}</>}
                        </span>
                        <span
                          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ds-font-mono tracking-[0.04em]"
                          style={{
                            background: `${typeBadgeColor}1c`,
                            color: typeBadgeColor,
                          }}
                        >
                          {selectedCalcMode === 'percentage' ? 'qty-sales × rate%'
                            : selectedCalcMode === 'incremental' ? 'qty × rate'
                            : 'qty × rate'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Job status bar */}
                  {loading && activeJobId && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] bg-[#0A84FF]/8 border border-[#0A84FF]/20">
                      {getStatusIcon(jobStatus)}
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#0A84FF] m-0">
                          Generating report for {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''}…
                        </p>
                        <p className="text-[11px] text-[var(--ds-muted)] mt-0.5 mb-0 ds-font-mono">{activeJobId}</p>
                      </div>
                    </div>
                  )}

                  {/* Loading spinner */}
                  {loading && (
                    <div className="flex items-center justify-center min-h-[380px] rounded-[18px] border border-dashed border-[var(--ds-hairline)] bg-[var(--ds-glass)]">
                      <div className="text-center flex flex-col items-center gap-4">
                        <div className="relative w-14 h-14">
                          <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-[var(--ds-hairline)]" />
                          <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-[#0A84FF] border-t-transparent animate-spin" style={{ animationDuration: '0.75s' }} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[var(--ds-ink)] m-0 mb-1.5">Building Reports</h3>
                          <p className="text-[12px] text-[var(--ds-muted)] m-0">
                            Fetching data for <span className="font-bold text-[#0A84FF]">{selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''}</span>
                            {' '}under <span className="font-bold" style={{ color: typeBadgeColor }}>{selectedRebateCode}</span>
                            {selectedRebateLabel && <> · <span className="font-bold" style={{ color: typeBadgeColor }}>{selectedRebateLabel}</span></>}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Report Preview */}
                  {!loading && showReport && allPages.length > 0 && currentPageData && (
                    <div className="ds-glass bg-[var(--ds-glass)] border border-[var(--ds-hairline)] rounded-[18px] px-[22px] py-5">
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[14px] font-bold text-[var(--ds-ink)] m-0">Report Preview</h3>
                          {selectedRebateLabel && (
                            <span
                              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold ds-font-mono"
                              style={{ background: `${typeBadgeColor}14`, color: typeBadgeColor }}
                            >
                              {selectedRebateLabel}
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9F0A]/8 text-[#FF9F0A] ds-font-mono max-w-[250px] truncate">
                            {currentPageData.customerName && currentPageData.customerName !== 'unknown'
                              ? currentPageData.customerName
                              : `Customer ${currentPageData.customerCode}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#0A84FF]/8 text-[#0A84FF] ds-font-mono">
                            Page {currentPage} of {totalPages}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] ds-font-mono">
                            {currentPageData.rows.length} rows
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-center px-5 py-4">
                        <div className="flex-shrink-0 relative overflow-visible" style={{ width: `${PREVIEW_W}px`, height: `${PREVIEW_H}px` }}>
                          <div
                            className="absolute top-0 left-0 border border-[var(--ds-hairline)] shadow-[0_4px_24px_rgba(0,0,0,0.18)]"
                            style={{
                              width: `${PAPER_W_PX}px`, height: `${PAPER_H_PX}px`,
                              transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left',
                            }}
                          >
                            <ReportPage {...sharedPageProps} pageRows={currentPageData.rows} pageIndex={currentPage - 1}
                              isFirstCustomerPage={currentPageData.isFirstCustomerPage}
                              isLastCustomerPage={currentPageData.isLastCustomerPage}
                              customerName={currentPageData.customerName}
                              customerTotals={currentPageData.customerTotals} scale={1} />
                          </div>
                        </div>
                      </div>

                      {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-1.5 px-0 pt-4 pb-1 mt-4 flex-wrap border-t border-[var(--ds-hairline)]">
                          <button
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`px-3.5 py-[7px] rounded-full text-[12px] font-medium border border-[var(--ds-hairline)] bg-transparent text-[var(--ds-ink)] transition-all duration-150 ${
                              currentPage === 1 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-[var(--ds-hover)]'
                            }`}
                          >
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
                              <span key={`el-${i}`} className="text-[13px] text-[var(--ds-muted)] px-0.5 select-none">…</span>
                            ) : (
                              <button
                                key={p}
                                onClick={() => paginate(p)}
                                className={`min-w-[32px] h-8 px-2 rounded-full text-[12px] font-semibold transition-all duration-150 cursor-pointer ${
                                  currentPage === p
                                    ? 'ds-gradient-primary text-white border border-transparent shadow-[0_4px_12px_-4px_rgba(10,132,255,0.53)]'
                                    : 'bg-transparent text-[var(--ds-ink)] border border-[var(--ds-hairline)] hover:bg-[var(--ds-hover)]'
                                }`}
                              >
                                {p}
                              </button>
                            ));
                          })()}
                          <button
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`px-3.5 py-[7px] rounded-full text-[12px] font-medium border border-[var(--ds-hairline)] bg-transparent text-[var(--ds-ink)] transition-all duration-150 ${
                              currentPage === totalPages ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-[var(--ds-hover)]'
                            }`}
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty state */}
                  {!loading && (!showReport || allPages.length === 0) && (
                    <div
                      className="ds-glass flex items-center justify-center mx-auto rounded-[18px] border-2 border-dashed border-[var(--ds-hairline)] bg-[var(--ds-glass)]"
                      style={{ width: '100%', maxWidth: `${PREVIEW_W}px`, height: Math.round(PREVIEW_H * 0.55) }}
                    >
                      <div className="text-center flex flex-col items-center gap-3">
                        <div className={`w-[52px] h-[52px] rounded-[14px] flex items-center justify-center ${
                          showReport ? 'bg-[#FF9F0A]/11' : 'bg-[#0A84FF]/11'
                        }`}>
                          <BarChart2 size={24} className={showReport ? 'text-[#FF9F0A]' : 'text-[#0A84FF]'} />
                        </div>
                        <div>
                          {showReport ? (
                            <>
                              <p className="text-[14px] font-semibold text-[var(--ds-ink)] m-0 mb-1">
                                No matching invoices found
                              </p>
                              <p className="text-[12px] text-[var(--ds-muted)] m-0 max-w-[420px]">
                                The report for <strong className="text-[#FF9F0A]">{selectedRebateCode}</strong>{' '}
                                returned zero rows. Check the backend console — it prints exactly which step returned empty
                                (customers / tiers / items / invoices / matched lines).
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[14px] font-semibold text-[var(--ds-ink)] m-0 mb-1">No report generated yet</p>
                              <p className="text-[12px] text-[var(--ds-muted)] m-0">
                                Pick a <strong className="text-[#0A84FF]">Rebate Code</strong>, confirm the date range, then click{' '}
                                <strong className="text-[#0A84FF]">Generate Report</strong>
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ══ Right sidebar ══ */}
                <div className="flex flex-col gap-4 sticky top-6 self-start">
                  {/* Activity */}
                  <div className="ds-glass bg-[var(--ds-glass)] border border-[var(--ds-hairline)] rounded-[18px] px-[18px] pt-[18px] pb-4">
                    <div className="flex items-center gap-2 mb-3.5">
                      <Clock size={15} className="text-[var(--ds-muted)]" />
                      <h3 className="text-[12px] font-bold text-[var(--ds-ink)] m-0 uppercase tracking-[0.06em]">Activity</h3>
                    </div>
                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                      {loading && activeJobId && (
                        <div
                          className="px-3 py-2.5 rounded-[14px] bg-[#0A84FF]/8 border border-[#0A84FF]/20"
                          style={{ animation: 'pulse-ring 1.5s infinite' }}
                        >
                          <div className="flex items-start gap-2">
                            {getStatusIcon(jobStatus)}
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-[var(--ds-ink)] m-0">{selectedRebateCode}</p>
                              {selectedRebateLabel && (
                                <p className="text-[10px] m-0 mt-0.5 font-semibold" style={{ color: typeBadgeColor }}>{selectedRebateLabel}</p>
                              )}
                              <p className="text-[11px] text-[var(--ds-muted)] my-0.5 mb-1 ds-font-mono">{formatJobDate(new Date().toISOString())}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#0A84FF]/11 text-[#0A84FF]">Processing</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!loading && showReport && allPages.length > 0 && (
                        <div className="px-3 py-2.5 rounded-[14px] bg-[#32D74B]/8 border border-[#32D74B]/20">
                          <div className="flex items-start gap-2">
                            <CheckCircle size={14} className="text-[#32D74B] flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-[var(--ds-ink)] m-0">{selectedRebateCode}</p>
                              {selectedRebateLabel && (
                                <p className="text-[10px] m-0 mt-0.5 font-semibold" style={{ color: typeBadgeColor }}>{selectedRebateLabel}</p>
                              )}
                              <p className="text-[11px] text-[var(--ds-muted)] my-0.5 mb-1 ds-font-mono">{formatJobDate(new Date().toISOString())}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#32D74B]/11 text-[#32D74B]">Completed</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {!loading && !showReport && (
                        <p className="text-[12px] text-center text-[var(--ds-muted)] py-5 m-0">No activity yet</p>
                      )}
                    </div>
                  </div>

                  {/* Grand Summary */}
                  {showReport && reportData.length > 0 && (
                    <div className="ds-glass ds-pop bg-[var(--ds-glass)] border border-[var(--ds-hairline)] rounded-[18px] px-[18px] py-4">
                      <p className="text-[11px] font-bold text-[var(--ds-muted)] uppercase tracking-[0.06em] m-0 mb-2">
                        Grand Summary
                      </p>
                      <p className="text-[10px] text-[var(--ds-muted)] m-0 mb-3">
                        All {selectedCustomers.length} customers combined
                      </p>
                      {[
                        { label: 'Total QTY',     value: totalQty.toLocaleString(), colorClass: 'text-[#0A84FF]' },
                        { label: 'Total Sales',   value: `₱${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, colorClass: 'text-[var(--ds-ink)]' },
                        { label: 'Total KITANEX', value: `₱${totalKitanex.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, colorClass: 'text-[#32D74B]' },
                      ].map(({ label, value, colorClass }, idx) => (
                        <div
                          key={label}
                          className={`flex justify-between items-center py-2 ${idx < 2 ? 'border-b border-[var(--ds-hairline)]' : ''}`}
                        >
                          <span className="text-[12px] text-[var(--ds-muted)]">{label}</span>
                          <span className={`text-[13px] font-bold ds-font-mono ${colorClass}`}>{value}</span>
                        </div>
                      ))}

                      {allPages.filter(p => p.isLastCustomerPage).length > 1 && (
                        <div className="mt-3.5 pt-3 border-t border-[var(--ds-hairline)]">
                          <p className="text-[10px] font-bold text-[var(--ds-muted)] uppercase tracking-[0.05em] m-0 mb-2">Per Customer</p>
                          <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
                            {allPages.filter(p => p.isLastCustomerPage).map((p) => (
                              <div key={p.customerCode} className="px-2 py-1.5 rounded-[10px] bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)]">
                                <p className="text-[10px] font-semibold text-[var(--ds-ink)] m-0 mb-0.5 truncate">{p.customerName}</p>
                                <p className="text-[10px] text-[#32D74B] m-0 ds-font-mono">
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
    </DesignPage>
  );
}

export default Nexchem_Reports;