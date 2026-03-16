import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from 'axios';
import {
  FileText,
  BarChart2,
  Eye,
  FileSpreadsheet,
  FileType,
  Image,
  Calendar,
  User,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  X,
  Lock,
  EyeOff,
} from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import nexchemLogo from "../assets/nexchem.png";
import nexchemReport from '../assets/nexchemreport.png';
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Sidebar from "../components/Sidebar";
import Header from '../components/Header';
import { useTheme } from '../context/ThemeContext';
import CustomerSelectionModal from "../components/rebate/CustomerSelectionModal";
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';

// ─── Hidden PDF Render Component ──────────────────────────────────────────────
const CustomerPdfPages = React.forwardRef(({ customerName, pages, totals, userName, getRebatePeriod, getCurrentDate, isOnlyCustomer }, ref) => {
  const totalPages = pages.length;

  return (
    <div ref={ref} style={{ position: 'absolute', left: '-9999px', top: 0, background: '#fff' }}>
      {pages.map((pageRows, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage  = pageIdx === totalPages - 1;
        return (
          <div
            key={pageIdx}
            style={{
              width: '816px',
              minHeight: '1056px',
              padding: '48px 56px',
              boxSizing: 'border-box',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              pageBreakAfter: 'always',
              fontFamily: 'Arial, sans-serif',
            }}
          >
            {isFirstPage && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <img src={nexchemReport} alt="Nexchem" style={{ width: '160px', height: 'auto' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '4px' }}>KITANEX</div>
                  <div style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>{getRebatePeriod()}</div>
                  <div style={{ fontSize: '11px', color: '#777' }}>{getCurrentDate()}</div>
                </div>
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', flex: 1 }}>
              {isFirstPage && (
                <thead>
                  <tr style={{ background: '#dbeafe' }}>
                    <th style={{ border: '0.5px solid #555', padding: '5px 6px', textAlign: 'left',   fontWeight: '700', width: '40%' }}>{customerName}</th>
                    <th style={{ border: '0.5px solid #555', padding: '5px 4px', textAlign: 'center', fontWeight: '700', width: '8%'  }}>QTY</th>
                    <th style={{ border: '0.5px solid #555', padding: '5px 4px', textAlign: 'center', fontWeight: '700', width: '16%' }}>SALES AMT</th>
                    <th style={{ border: '0.5px solid #555', padding: '5px 4px', textAlign: 'center', fontWeight: '700', width: '10%' }}>KITANEX</th>
                    <th style={{ border: '0.5px solid #555', padding: '5px 4px', textAlign: 'center', fontWeight: '700', width: '16%' }}>TOTAL KITANEX</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {pageRows.map((row, idx) => {
                  if (row.type === 'date') return (
                    <tr key={idx} style={{ background: '#f3f4f6' }}>
                      <td colSpan={5} style={{ border: '0.5px solid #555', padding: '4px 6px', fontWeight: '700', color: '#1a1a1a' }}>{row.content}</td>
                    </tr>
                  );
                  if (row.type === 'invoice') return (
                    <tr key={idx} style={{ background: '#f9fafb' }}>
                      <td colSpan={5} style={{ border: '0.5px solid #555', padding: '4px 16px', fontWeight: '600', color: '#333' }}>{row.content}</td>
                    </tr>
                  );
                  if (row.type === 'item') {
                    const item = row.content;
                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        <td style={{ border: '0.5px solid #555', padding: '3px 6px 3px 28px', color: '#333' }}>{item.name}</td>
                        <td style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', color: '#333' }}>{item.qty.toLocaleString()}</td>
                        <td style={{ border: '0.5px solid #555', padding: '3px 6px', textAlign: 'right',  color: '#333' }}>₱{item.sales_amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', color: '#333' }}>{item.kitanex}</td>
                        <td style={{ border: '0.5px solid #555', padding: '3px 6px', textAlign: 'right',  color: '#333' }}>₱{item.total_kitanex.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  }
                  return null;
                })}
              </tbody>
              {isLastPage && (
                <tfoot>
                  <tr style={{ background: '#eff6ff' }}>
                    <td style={{ border: '0.5px solid #555', padding: '5px 6px', fontWeight: '700', color: '#1a1a1a' }}>Grand Total</td>
                    <td style={{ border: '0.5px solid #555', padding: '5px 4px', textAlign: 'center', fontWeight: '700', color: '#1a1a1a' }}>{totals.totalQty.toLocaleString()}</td>
                    <td style={{ border: '0.5px solid #555', padding: '5px 6px', textAlign: 'right',  fontWeight: '700', color: '#1a1a1a' }}>₱{totals.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td style={{ border: '0.5px solid #555', padding: '5px 4px', color: '#1a1a1a' }}></td>
                    <td style={{ border: '0.5px solid #555', padding: '5px 6px', textAlign: 'right',  fontWeight: '700', color: '#1a1a1a' }}>₱{totals.totalKitanex.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              )}
            </table>

            {isLastPage && (
              <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#374151', marginBottom: '24px' }}>Prepared by:</p>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#1a1a1a', borderTop: '1px solid #555', paddingTop: '4px' }}>{userName}</p>
                  <p style={{ fontSize: '10px', color: '#6b7280' }}>Marketing Associate</p>
                </div>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: '600', color: '#374151', marginBottom: '24px' }}>Checked by:</p>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#1a1a1a', borderTop: '1px solid #555', paddingTop: '4px' }}>Joy O. Sarcia</p>
                  <p style={{ fontSize: '10px', color: '#6b7280' }}>Purchasing Supervisor</p>
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '9px', color: '#9ca3af', marginTop: '12px' }}>
              Page {pageIdx + 1} of {totalPages}
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ─── Main Component ────────────────────────────────────────────────────────────
function Nexchem_Reports() {
  const { theme, updateTheme } = useTheme();
  const location = useLocation();
  const reportRef      = useRef(null);
  const pdfContainerRef = useRef(null);

  const routePath = '/Nexchem_Reports';

  const [collapsed, setCollapsed]               = useState(false);
  const [activeNav, setActiveNav]               = useState("/reports");
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [userName, setUserName]                 = useState("");
  const [userCode, setUserCode]                 = useState("");
  const [initials, setInitials]                 = useState("");
  const [customers, setCustomers]               = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [dateFrom, setDateFrom]                 = useState("");
  const [dateTo, setDateTo]                     = useState("");
  const [reportData, setReportData]             = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [currentPage, setCurrentPage]           = useState(1);
  const [showReport, setShowReport]             = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [flattenedRows, setFlattenedRows]       = useState([]);
  const [totalPages, setTotalPages]             = useState(1);
  const [pagesData, setPagesData]               = useState([]);
  const [showVanDropdown, setShowVanDropdown]   = useState(false);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(true);
  const [showVcpDropdown, setShowVcpDropdown]   = useState(false);
  const [perCustomerRows, setPerCustomerRows]   = useState({});

  // Access control
  const { access, accessLoading, accessError } = useAccessControl(routePath);

  // Job tracking
  const [activeJobId, setActiveJobId]   = useState(null);
  const [jobStatus, setJobStatus]       = useState(null);
  const [jobError, setJobError]         = useState(null);
  const [shouldResetPage, setShouldResetPage] = useState(false);

  const API_BASE = 'http://192.168.100.193:3006/api';
  const DB_NAME  = 'USER';

  const componentMetadata = {
    name: 'Nexchem_Reports',
    version: '2.0.0',
    description: 'Reporting module for generating and viewing system reports and data summaries.',
    routePath: '/Nexchem_Reports',
  };

  useComponentRegistration(componentMetadata);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatDateToDayMonth = useCallback((dateString) => {
    if (!dateString) return "Invalid Date";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      const day   = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      return `${day}-${month}`;
    } catch { return "Invalid Date"; }
  }, []);

  const getCurrentDate = useCallback(() =>
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  []);

  const getCurrentDateForFilename = useCallback(() => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const getRebatePeriod = useCallback(() => {
    const source = reportData.length > 0 ? reportData : null;
    if (source) {
      const dates = source.map(i => new Date(i.docDate)).filter(d => !isNaN(d.getTime()));
      if (!dates.length) return "Invalid Dates";
      const min = new Date(Math.min(...dates.map(d => d.getTime())));
      const max = new Date(Math.max(...dates.map(d => d.getTime())));
      if (min.getMonth() === max.getMonth() && min.getFullYear() === max.getFullYear()) {
        return `${min.toLocaleString('en-US', { month: 'long' })} ${min.getDate()} - ${max.getDate()}, ${min.getFullYear()}`;
      }
      return `${min.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${max.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    if (dateFrom && dateTo) {
      const f = new Date(dateFrom), t = new Date(dateTo);
      if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
        return `${f.toLocaleString('en-US', { month: 'long' })} ${f.getDate()} - ${t.getDate()}, ${f.getFullYear()}`;
      }
      return `${f.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${t.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    return "All Dates";
  }, [reportData, dateFrom, dateTo]);

  const generateFilename = useCallback((extension) => {
    const date = getCurrentDateForFilename();
    if (selectedCustomers.length === 1) {
      const name = (selectedCustomers[0].CardName || selectedCustomers[0].name || selectedCustomers[0]._name || "Customer").replace(/[^a-zA-Z0-9]/g, '_');
      return `${name}_KITANEX_REPORT_${date}.${extension}`;
    }
    return `MULTI_CUSTOMER_KITANEX_REPORT_${date}.${extension}`;
  }, [selectedCustomers, getCurrentDateForFilename]);

  const getSelectedCustomerNames = useCallback(() => {
    if (!selectedCustomers.length) return "";
    if (selectedCustomers.length === 1) {
      const c = selectedCustomers[0];
      return c.CardName || c.name || c._name || "";
    }
    return `${selectedCustomers.length} customers selected`;
  }, [selectedCustomers]);

  // ── Pagination ─────────────────────────────────────────────────────────────

  const FIRST_PAGE_MAX_ROWS  = 32;
  const OTHER_PAGES_MAX_ROWS = 37;

  const paginateRows = useCallback((rows, resetPage = true) => {
    const pages = [];
    let idx = 0, pageNum = 0;
    while (idx < rows.length) {
      const max = pageNum === 0 ? FIRST_PAGE_MAX_ROWS : OTHER_PAGES_MAX_ROWS;
      let end = Math.min(idx + max, rows.length);
      if (end < rows.length) {
        const last = rows[end - 1];
        const next = rows[end];
        if (last.type === 'item' && next.type === 'item' && last.groupId === next.groupId) {
          let gs = end - 1;
          while (gs > idx && rows[gs - 1].groupId === last.groupId) gs--;
          if (gs > idx) end = gs;
        }
        if (last.type === 'item' && next.type === 'invoice' && last.groupId === next.groupId) {
          end = end - 1;
        }
      }
      if (end <= idx) end = Math.min(idx + max, rows.length);
      pages.push(rows.slice(idx, end));
      idx = end;
      pageNum++;
    }
    setPagesData(pages);
    setTotalPages(pages.length);
    if (resetPage && shouldResetPage) {
      setCurrentPage(1);
      setShouldResetPage(false);
    }
  }, [shouldResetPage]);

  const buildFlattenedRows = useCallback((data) => {
    const rows = [];
    data.forEach((group, gi) => {
      const shouldShowDate = gi === 0 ||
        formatDateToDayMonth(group.docDate) !== formatDateToDayMonth(data[gi - 1].docDate);
      if (shouldShowDate) {
        rows.push({ type: 'date', content: formatDateToDayMonth(group.docDate), groupId: group.id, docDate: group.docDate });
      }
      rows.push({ type: 'invoice', content: group.id, groupId: group.id, docDate: group.docDate });
      group.items.forEach(item => {
        rows.push({ type: 'item', content: item, groupId: group.id, docDate: group.docDate });
      });
    });
    return rows;
  }, [formatDateToDayMonth]);

  const processReportData = useCallback((data, resetPage = true) => {
    const rows = buildFlattenedRows(data);
    setFlattenedRows(rows);
    paginateRows(rows, resetPage && shouldResetPage);
  }, [buildFlattenedRows, paginateRows, shouldResetPage]);

  const buildPerCustomerRows = useCallback((data) => {
    const map = {};
    data.forEach(group => {
      const customerCode = group.customerCode || group.CardCode || 'unknown';
      if (!map[customerCode]) map[customerCode] = [];
      map[customerCode].push(group);
    });
    const result = {};
    Object.entries(map).forEach(([code, groups]) => {
      result[code] = buildFlattenedRows(groups);
    });
    return result;
  }, [buildFlattenedRows]);

  const paginateForCustomer = useCallback((rows) => {
    const pages = [];
    let idx = 0, pageNum = 0;
    while (idx < rows.length) {
      const max = pageNum === 0 ? FIRST_PAGE_MAX_ROWS : OTHER_PAGES_MAX_ROWS;
      let end = Math.min(idx + max, rows.length);
      if (end < rows.length) {
        const last = rows[end - 1], next = rows[end];
        if (last.type === 'item' && next.type === 'item' && last.groupId === next.groupId) {
          let gs = end - 1;
          while (gs > idx && rows[gs - 1].groupId === last.groupId) gs--;
          if (gs > idx) end = gs;
        }
        if (last.type === 'item' && next.type === 'invoice' && last.groupId === next.groupId) end--;
      }
      if (end <= idx) end = Math.min(idx + max, rows.length);
      pages.push(rows.slice(idx, end));
      idx = end;
      pageNum++;
    }
    return pages;
  }, []);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const savedData      = localStorage.getItem("savedReportData");
      const savedParams    = localStorage.getItem("savedReportParams");
      const savedShow      = localStorage.getItem("savedShowReport");
      const savedPage      = localStorage.getItem("savedCurrentPage");
      const savedCustomers = localStorage.getItem("savedSelectedCustomers");
      if (savedData)      { const d = JSON.parse(savedData);      setReportData(d); processReportData(d, false); }
      if (savedParams)    { const p = JSON.parse(savedParams);    setDateFrom(p.dateFrom || ""); setDateTo(p.dateTo || ""); }
      if (savedCustomers) setSelectedCustomers(JSON.parse(savedCustomers));
      if (savedShow)      setShowReport(JSON.parse(savedShow));
      if (savedPage)      setCurrentPage(JSON.parse(savedPage));
    } catch (e) { console.error('Restore error:', e); }
  }, []); // eslint-disable-line

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const u   = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const uid = u.UserID || u.User_ID;
        if (uid) {
          const res = await axios.get(`${API_BASE}/user/preferences/${uid}/theme?db=${DB_NAME}`);
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

  useEffect(() => { localStorage.setItem("savedCurrentPage",        JSON.stringify(currentPage));       }, [currentPage]);
  useEffect(() => { if (reportData.length > 0) localStorage.setItem("savedReportData", JSON.stringify(reportData)); }, [reportData]);
  useEffect(() => { localStorage.setItem("savedReportParams",       JSON.stringify({ dateFrom, dateTo })); }, [dateFrom, dateTo]);
  useEffect(() => { localStorage.setItem("savedSelectedCustomers",  JSON.stringify(selectedCustomers)); }, [selectedCustomers]);
  useEffect(() => { localStorage.setItem("savedShowReport",         JSON.stringify(showReport));        }, [showReport]);

  useEffect(() => {
    const u        = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const username = u.DisplayName || u.Username || "Unknown User";
    setUserName(username);
    setUserCode(u.User_ID || "Unknown ID");
    const parts = username.trim().split(" ");
    setInitials(parts.length === 1 ? parts[0][0].toUpperCase() : parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase());
  }, []);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${API_BASE}/sync/local/customers?db=NEXCHEM_OWN`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        let arr = [];
        if (Array.isArray(data)) arr = data;
        else if (data?.data       && Array.isArray(data.data))      arr = data.data;
        else if (data?.customers  && Array.isArray(data.customers)) arr = data.customers;
        else if (data?.CardCode   || data?.code)                    arr = [data];
        setCustomers(arr);
      } catch (e) {
        console.error("Error fetching customers:", e);
        setCustomers([]);
        alert("Failed to load customers. Please refresh the page.");
      }
    };
    fetchCustomers();
  }, [API_BASE]);

  // ── Totals ─────────────────────────────────────────────────────────────────

  const calculateTotals = useCallback((data = reportData) => {
    let totalQty = 0, totalSales = 0, totalKitanex = 0;
    data.forEach(g => g.items.forEach(i => {
      totalQty     += i.qty;
      totalSales   += i.sales_amt;
      totalKitanex += i.total_kitanex;
    }));
    return { totalQty, totalSales, totalKitanex };
  }, [reportData]);

  const { totalQty, totalSales, totalKitanex } = calculateTotals();

  // ── Actions ────────────────────────────────────────────────────────────────

  const generateReport = async () => {
    if (!access.canCreate) { alert("You do not have permission to generate reports."); return; }
    if (!selectedCustomers.length) { alert("Please select at least one customer first"); return; }
    setLoading(true);
    setShouldResetPage(true);
    setJobError(null);
    const jobId = `job_${Date.now()}`;
    setActiveJobId(jobId);
    setJobStatus('processing');
    try {
      const customerCodes = selectedCustomers.map(c => c.CardCode || c.code || c._id).filter(Boolean);
      const res = await fetch(`${API_BASE}/nexchem/generate-multi-customer-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ customerCodes, dateFrom: dateFrom || null, dateTo: dateTo || null, db: 'NEXCHEM' }),
      });
      const text = await res.text();
      let result;
      try { result = JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${text.substring(0, 100)}`); }
      if (!res.ok) throw new Error(result.error || result.message || `HTTP ${res.status}`);
      if (result.success && result.data) {
        setJobStatus('completed');
        setReportData(result.data);
        processReportData(result.data, true);
        setPerCustomerRows(buildPerCustomerRows(result.data));
        setShowReport(true);
        setLoading(false);
        setActiveJobId(null);
        localStorage.setItem("savedReportData", JSON.stringify(result.data));
      } else {
        throw new Error(result.error || 'Failed to generate report');
      }
    } catch (e) {
      console.error("Error generating report:", e);
      setJobStatus('failed');
      setJobError(e.message);
      setLoading(false);
      setShouldResetPage(false);
      alert(`Failed to generate report: ${e.message}`);
    }
  };

  const clearReport = () => {
    setReportData([]); setFlattenedRows([]); setPagesData([]); setShowReport(false);
    setActiveJobId(null); setJobStatus(null); setJobError(null);
    setSelectedCustomers([]); setDateFrom(""); setDateTo(""); setCurrentPage(1); setShouldResetPage(false);
    setPerCustomerRows({});
    ['savedReportData', 'savedReportParams', 'savedShowReport', 'savedCurrentPage', 'savedSelectedCustomers'].forEach(k => localStorage.removeItem(k));
  };

  const handleOpenCustomerModal          = () => setIsCustomerModalOpen(true);
  const handleCustomerSelectionConfirm   = (data) => { setSelectedCustomers(data); setIsCustomerModalOpen(false); };
  const handleRemoveCustomer             = (c) => {
    setSelectedCustomers(prev => prev.filter(x => {
      const xi = x.CardCode || x.code || x._id;
      const ci = c.CardCode || c.code || c._id;
      return xi !== ci;
    }));
  };

  const paginate = useCallback((p) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  }, [totalPages]);

  const getCurrentPageRows = useCallback(() => pagesData[currentPage - 1] || [], [pagesData, currentPage]);
  const currentPageRows = getCurrentPageRows();
  const isLastPage  = currentPage === totalPages;
  const isFirstPage = currentPage === 1;

  // ── Exports ────────────────────────────────────────────────────────────────

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    try {
      const customerNames = selectedCustomers.map(c => c.CardName || c.name || c._name || "").join(", ");
      const rebatePeriod  = getRebatePeriod();
      const currentDate   = getCurrentDate();

      const tableHeaderHTML = `
        <table style="border-collapse:collapse;width:100%;font-size:9pt;border:1px solid #000000;">
          <thead>
            <tr>
              <th style="width:40%;border:1px solid #000000;padding:4px 3px;background-color:#dbeafe;font-weight:bold;text-align:center;">DESCRIPTION</th>
              <th style="width:12%;border:1px solid #000000;padding:4px 3px;background-color:#dbeafe;font-weight:bold;text-align:center;">QTY</th>
              <th style="width:18%;border:1px solid #000000;padding:4px 3px;background-color:#dbeafe;font-weight:bold;text-align:center;">SALES AMT</th>
              <th style="width:12%;border:1px solid #000000;padding:4px 3px;background-color:#dbeafe;font-weight:bold;text-align:center;">KITANEX</th>
              <th style="width:18%;border:1px solid #000000;padding:4px 3px;background-color:#dbeafe;font-weight:bold;text-align:center;">TOTAL KITANEX</th>
            </tr>
          </thead>
          <tbody>
      `;

      const headerHTML = `
        <div style="margin-bottom:15px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;">
            <div style="font-size:16pt;font-weight:bold;color:#000;">NEXCHEM CORPORATION</div>
            <div>
              <div style="font-size:13pt;font-weight:bold;margin:5px 0;">KITANEX</div>
              <div style="margin:3px 0;font-size:10pt;">${rebatePeriod}</div>
              <div style="margin:3px 0;font-size:10pt;">${currentDate}</div>
            </div>
          </div>
          <div style="margin:5px 0;font-size:10pt;"><strong>Customer(s):</strong> ${customerNames}</div>
        </div>
      `;

      const footerHTML = `
        <div style="margin-top:30px;">
          <div style="display:flex;justify-content:space-between;">
            <div style="width:45%;">
              <p><strong>Prepared by:</strong></p>
              <div style="font-weight:bold;margin-top:15px;">${userName}</div>
              <div style="color:#666;">Marketing Associate</div>
            </div>
            <div style="width:45%;">
              <p><strong>Checked by:</strong></p>
              <div style="font-weight:bold;margin-top:15px;">Joy O. Sarcia</div>
              <div style="color:#666;">Purchasing Supervisor</div>
            </div>
          </div>
        </div>
      `;

      const rowsPerPage = 25;
      const rows        = flattenedRows;
      const chunks      = [];
      for (let i = 0; i < rows.length; i += rowsPerPage) chunks.push(rows.slice(i, i + rowsPerPage));

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      for (let pageIndex = 0; pageIndex < chunks.length; pageIndex++) {
        if (pageIndex > 0) pdf.addPage();

        const pageWrapper = document.createElement('div');
        pageWrapper.style.cssText = 'width:210mm;padding:15mm 20mm;background-color:#ffffff;font-family:"Times New Roman",Times,serif;font-size:10pt;box-sizing:border-box;';

        let pageHTML = headerHTML + tableHeaderHTML;

        chunks[pageIndex].forEach(row => {
          switch (row.type) {
            case 'date':
              pageHTML += `<tr><td colspan="5" style="border:1px solid #000;padding:4px 3px;background-color:#f3f4f6;font-weight:bold;font-size:9pt;"><strong>${row.content}</strong></td></tr>`;
              break;
            case 'invoice':
              pageHTML += `<tr><td colspan="5" style="border:1px solid #000;padding:4px 3px;padding-left:15px;font-weight:500;font-size:9pt;">${row.content}</td></tr>`;
              break;
            case 'item': {
              const item = row.content;
              pageHTML += `<tr>
                <td style="border:1px solid #000;padding:4px 3px;padding-left:25px;font-size:9pt;">${item.name}</td>
                <td style="border:1px solid #000;padding:4px 3px;text-align:center;font-size:9pt;">${item.qty.toLocaleString()}</td>
                <td style="border:1px solid #000;padding:4px 3px;text-align:right;font-size:9pt;">₱${item.sales_amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border:1px solid #000;padding:4px 3px;text-align:center;font-size:9pt;">${item.kitanex}</td>
                <td style="border:1px solid #000;padding:4px 3px;text-align:right;font-size:9pt;">₱${item.total_kitanex.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>`;
              break;
            }
          }
        });

        if (pageIndex === chunks.length - 1) {
          pageHTML += `
              </tbody>
              <tfoot>
                <tr>
                  <td style="border:1px solid #000;padding:4px 3px;background-color:#eff6ff;font-weight:bold;font-size:9pt;">Grand Total</td>
                  <td style="border:1px solid #000;padding:4px 3px;background-color:#eff6ff;font-weight:bold;text-align:center;font-size:9pt;">${totalQty.toLocaleString()}</td>
                  <td style="border:1px solid #000;padding:4px 3px;background-color:#eff6ff;font-weight:bold;text-align:right;font-size:9pt;">₱${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style="border:1px solid #000;padding:4px 3px;background-color:#eff6ff;font-weight:bold;text-align:center;font-size:9pt;"></td>
                  <td style="border:1px solid #000;padding:4px 3px;background-color:#eff6ff;font-weight:bold;text-align:right;font-size:9pt;">₱${totalKitanex.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          `;
        } else {
          pageHTML += `</tbody></table>`;
        }

        pageHTML += footerHTML;
        pageHTML += `<div style="text-align:center;margin-top:15px;font-size:9pt;color:#666;">Page ${pageIndex + 1} of ${chunks.length}</div>`;

        pageWrapper.innerHTML = pageHTML;
        document.body.appendChild(pageWrapper);

        const canvas = await html2canvas(pageWrapper, {
          scale: 2, backgroundColor: '#ffffff', logging: false,
          allowTaint: false, useCORS: true,
          windowWidth: pageWrapper.scrollWidth, windowHeight: pageWrapper.scrollHeight,
        });

        document.body.removeChild(pageWrapper);

        const imgData  = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      }

      pdf.save(generateFilename('pdf'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const exportToExcel = () => {
    try {
      const wb              = XLSX.utils.book_new();
      const customerMap     = {};
      const customerNameMap = {};
      reportData.forEach(group => {
        const code = group.customerCode || group.CardCode || 'unknown';
        const name = group.customerName || group.CardName || code;
        if (!customerMap[code]) { customerMap[code] = []; customerNameMap[code] = name; }
        customerMap[code].push(group);
      });

      Object.entries(customerMap).forEach(([code, groups]) => {
        const customerName = customerNameMap[code] ||
          (selectedCustomers.find(c => (c.CardCode || c.code || c._id) === code)?.CardName) || code;
        const rows   = buildFlattenedRows(groups);
        const totals = calculateTotals(groups);

        const excelRows = [
          ['NEXCHEM CORPORATION'],
          ['SALES REBATE REPORT - KITANEX'],
          [],
          ['Customer:', customerName],
          ['Period:', getRebatePeriod()],
          ['Date:', getCurrentDate()],
          [],
          ['DESCRIPTION', 'QTY', 'SALES AMT', 'KITANEX', 'TOTAL KITANEX'],
        ];

        rows.forEach(row => {
          if (row.type === 'date')    excelRows.push([row.content, '', '', '', '']);
          else if (row.type === 'invoice') excelRows.push([`  ${row.content}`, '', '', '', '']);
          else if (row.type === 'item') {
            const i = row.content;
            excelRows.push([`    ${i.name}`, i.qty, i.sales_amt, i.kitanex, i.total_kitanex]);
          }
        });

        excelRows.push([], ['GRAND TOTAL', totals.totalQty, totals.totalSales, '', totals.totalKitanex]);
        excelRows.push([], []);
        excelRows.push(['Prepared by:', '', '', 'Checked by:']);
        excelRows.push([userName, '', '', 'Joy O. Sarcia']);
        excelRows.push(['Marketing Associate', '', '', 'Purchasing Supervisor']);

        const ws = XLSX.utils.aoa_to_sheet(excelRows);
        ws['!cols'] = [{ wch: 50 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
        const sheetName = customerName.replace(/[\\/*?[\]:]/g, '').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf], { type: 'application/octet-stream' }), generateFilename('xlsx'));
    } catch (e) { console.error('Excel error:', e); alert('Failed to generate Excel file. Please try again.'); }
  };

  const exportToDocs = () => {
    try {
      const customerMap     = {};
      const customerNameMap = {};
      reportData.forEach(group => {
        const code = group.customerCode || group.CardCode || 'unknown';
        const name = group.customerName || group.CardName || code;
        if (!customerMap[code]) { customerMap[code] = []; customerNameMap[code] = name; }
        customerMap[code].push(group);
      });

      let body = '';
      Object.entries(customerMap).forEach(([code, groups], ci) => {
        const customerName = customerNameMap[code] ||
          (selectedCustomers.find(c => (c.CardCode || c.code || c._id) === code)?.CardName) || code;
        const rows   = buildFlattenedRows(groups);
        const totals = calculateTotals(groups);

        if (ci > 0) body += `<div style="page-break-before:always;"></div>`;

        body += `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
            <div style="font-size:18pt;font-weight:bold;color:#000;">NEXCHEM CORPORATION</div>
            <div style="text-align:right;">
              <div style="font-size:14pt;font-weight:bold;">KITANEX</div>
              <div style="font-size:10pt;">${getRebatePeriod()}</div>
              <div style="font-size:10pt;">${getCurrentDate()}</div>
            </div>
          </div>
          <div style="margin-bottom:12px;font-size:11pt;"><strong>Customer:</strong> ${customerName}</div>
          <table style="border-collapse:collapse;width:100%;font-size:10pt;">
            <thead>
              <tr style="background:#dbeafe;">
                <th style="border:1px solid #000;padding:6px;text-align:left;width:40%;">DESCRIPTION</th>
                <th style="border:1px solid #000;padding:6px;text-align:center;width:8%;">QTY</th>
                <th style="border:1px solid #000;padding:6px;text-align:center;width:16%;">SALES AMT</th>
                <th style="border:1px solid #000;padding:6px;text-align:center;width:10%;">KITANEX</th>
                <th style="border:1px solid #000;padding:6px;text-align:center;width:16%;">TOTAL KITANEX</th>
              </tr>
            </thead>
            <tbody>`;

        rows.forEach(row => {
          if (row.type === 'date') {
            body += `<tr style="background:#f3f4f6;"><td colspan="5" style="border:1px solid #000;padding:4px 6px;font-weight:bold;">${row.content}</td></tr>`;
          } else if (row.type === 'invoice') {
            body += `<tr style="background:#f9fafb;"><td colspan="5" style="border:1px solid #000;padding:4px 16px;font-weight:600;">${row.content}</td></tr>`;
          } else if (row.type === 'item') {
            const i = row.content;
            body += `<tr>
              <td style="border:1px solid #000;padding:3px 6px 3px 28px;">${i.name}</td>
              <td style="border:1px solid #000;padding:3px 4px;text-align:center;">${i.qty.toLocaleString()}</td>
              <td style="border:1px solid #000;padding:3px 6px;text-align:right;">₱${i.sales_amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td style="border:1px solid #000;padding:3px 4px;text-align:center;">${i.kitanex}</td>
              <td style="border:1px solid #000;padding:3px 6px;text-align:right;">₱${i.total_kitanex.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>`;
          }
        });

        body += `
            </tbody>
            <tfoot>
              <tr style="background:#eff6ff;">
                <td style="border:1px solid #000;padding:5px 6px;font-weight:bold;">Grand Total</td>
                <td style="border:1px solid #000;padding:5px 4px;text-align:center;font-weight:bold;">${totals.totalQty.toLocaleString()}</td>
                <td style="border:1px solid #000;padding:5px 6px;text-align:right;font-weight:bold;">₱${totals.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td style="border:1px solid #000;padding:5px 4px;"></td>
                <td style="border:1px solid #000;padding:5px 6px;text-align:right;font-weight:bold;">₱${totals.totalKitanex.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
          <div style="margin-top:40px;display:flex;justify-content:space-between;">
            <div style="width:45%;">
              <p style="font-weight:600;margin-bottom:24px;">Prepared by:</p>
              <p style="font-weight:bold;border-top:1px solid #000;padding-top:4px;">${userName}</p>
              <p style="color:#666;">Marketing Associate</p>
            </div>
            <div style="width:45%;">
              <p style="font-weight:600;margin-bottom:24px;">Checked by:</p>
              <p style="font-weight:bold;border-top:1px solid #000;padding-top:4px;">Joy O. Sarcia</p>
              <p style="color:#666;">Purchasing Supervisor</p>
            </div>
          </div>`;
      });

      const html = `<html><head><meta charset="UTF-8"><style>body{font-family:'Times New Roman',Times,serif;margin:1in;font-size:11pt;}</style></head><body>${body}</body></html>`;
      saveAs(new Blob([html], { type: 'application/msword' }), generateFilename('doc'));
    } catch (e) { console.error('Word error:', e); alert('Failed to generate Word document. Please try again.'); }
  };

  const exportToPNG = async () => {
    if (!reportRef.current) return;
    try {
      const el = reportRef.current;
      const orig = el.style.transform;
      el.style.transform = 'none';
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
      el.style.transform = orig;
      canvas.toBlob(blob => { if (blob) saveAs(blob, generateFilename('png')); });
    } catch (e) { console.error('PNG error:', e); alert('Failed to generate PNG.'); }
  };

  const exportToJPG = async () => {
    if (!reportRef.current) return;
    try {
      const el = reportRef.current;
      const orig = el.style.transform;
      el.style.transform = 'none';
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
      el.style.transform = orig;
      canvas.toBlob(blob => { if (blob) saveAs(blob, generateFilename('jpg')); }, 'image/jpeg', 0.95);
    } catch (e) { console.error('JPG error:', e); alert('Failed to generate JPG.'); }
  };

  // ── Status helpers ─────────────────────────────────────────────────────────

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing': return <RefreshCw className="w-4 h-4 text-blue-500 dark:text-blue-400 animate-spin" />;
      case 'completed':  return <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />;
      case 'failed':     return <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />;
      default:           return <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  const formatJobDate = (ds) =>
    new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // ── Access control render helpers ──────────────────────────────────────────

  const renderAccessLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin mb-4
        ${theme === 'dark' ? 'border-blue-400' : 'border-blue-500'}`}
      />
      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        Checking permissions...
      </p>
    </div>
  );

  const renderAccessDenied = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4
        ${theme === 'dark' ? 'bg-red-900/30 border border-red-700/40' : 'bg-red-50 border border-red-200'}`}
      >
        <Lock size={36} className={theme === 'dark' ? 'text-red-400' : 'text-red-500'} />
      </div>
      <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>
        Access Restricted
      </h2>
      <p className={`max-w-md text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        You don't have permission to view this page.
        {accessError && <span className="block mt-2 text-xs opacity-75">Error: {accessError}</span>}
      </p>
      <Link
        to="/HomePage"
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
          ${theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
      >
        Go to HomePage
      </Link>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`flex min-h-screen w-full bg-gradient-to-br ${
      theme === 'dark' ? 'from-gray-900 to-gray-800' : 'from-slate-50 to-blue-50'
    } font-poppins ${theme === 'dark' ? 'text-gray-100' : 'text-slate-900'}`}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown}
        setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown}
        setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown}
        setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />

      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${collapsed ? "ml-20" : "ml-64"}`}>
        <Header
          collapsed={collapsed}
          userName={userName}
          userCode={userCode}
          initials={initials}
          logo={nexchemLogo}
          theme={theme}
        />

        <div className="pt-16 flex-1 p-8 overflow-y-auto">
          <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl border ${
            theme === 'dark' ? 'border-gray-700/50' : 'border-white/50'
          } shadow-2xl p-8 w-full max-w-[1600px] mx-auto mt-6`}>

            {/* ── Title bar (always visible) ── */}
            <div className={`flex items-center gap-3 mb-6 pb-4 border-b ${theme === 'dark' ? 'border-blue-700' : 'border-blue-100'}`}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow">
                <BarChart2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>Rebate Reports</h1>
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Generate and export sales reports with rebate calculations
                </p>
              </div>
            </div>

            {/* ── Access control gate ── */}
            {accessLoading
              ? renderAccessLoading()
              : !access.canView
                ? renderAccessDenied()
                : (
                  /* ── Main content (canView = true) ── */
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                    {/* ── Left / main column ── */}
                    <div className="xl:col-span-3 space-y-6">

                      {/* Action bar */}
                      <div className="flex justify-between items-center gap-3 mb-6">
                        <div className="flex gap-3">

                          {/* Generate Report — requires canCreate */}
                          <button
                            onClick={generateReport}
                            disabled={loading || !selectedCustomers.length || !access.canCreate}
                            title={
                              !access.canCreate
                                ? 'You do not have permission to generate reports'
                                : !selectedCustomers.length
                                  ? 'Please select at least one customer'
                                  : 'Generate Report'
                            }
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                              ${access.canCreate && !loading && selectedCustomers.length
                                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60'
                              }`}
                          >
                            {!access.canCreate ? <FileText size={16} /> : <FileText size={16} />}
                            {loading
                              ? 'Generating...'
                              : !access.canCreate
                                ? 'Generate Report'
                                : 'Generate Report'
                            }
                          </button>

                          {showReport && reportData.length > 0 && (
                            <button
                              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition-colors"
                              onClick={clearReport}
                            >
                              Clear Report
                            </button>
                          )}
                        </div>

                        {/* Export dropdown — requires canExport */}
                        <div className="relative">
                          <button
                            disabled={!access.canExport || !showReport || !reportData.length}
                            title={
                              !access.canExport
                                ? 'You do not have permission to export reports'
                                : !showReport || !reportData.length
                                  ? 'No data to export'
                                  : 'Export'
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border
                              ${access.canExport && showReport && reportData.length
                                ? theme === 'dark'
                                  ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-200 cursor-pointer'
                                  : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700 cursor-pointer'
                                : theme === 'dark'
                                  ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed opacity-50'
                                  : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                              }`}
                            onClick={() => {
                              if (access.canExport && showReport && reportData.length)
                                setShowExportDropdown(v => !v);
                            }}
                          >
                            {!access.canExport ? <Lock size={13} /> : <FileText size={13} />}
                            Export
                          </button>

                          {showExportDropdown && access.canExport && (
                            <div className={`absolute right-0 mt-2 w-56 rounded-xl shadow-xl border z-50 overflow-hidden ${
                              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                            }`}>
                              <div className={`border-b p-3 ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                                <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Export Report</p>
                              </div>
                              {[
                                { label: 'Export as PDF (.pdf)',    icon: <FileText       className="w-4 h-4 text-red-500"    />, fn: exportToPDF   },
                                { label: 'Export as Excel (.xlsx)', icon: <FileSpreadsheet className="w-4 h-4 text-green-500" />, fn: exportToExcel },
                                { label: 'Export as Word (.doc)',   icon: <FileType       className="w-4 h-4 text-blue-500"   />, fn: exportToDocs  },
                                { label: 'Export as PNG (.png)',    icon: <Image          className="w-4 h-4 text-purple-500" />, fn: exportToPNG   },
                                { label: 'Export as JPG (.jpg)',    icon: <Image          className="w-4 h-4 text-orange-500" />, fn: exportToJPG   },
                              ].map(({ label, icon, fn }) => (
                                <button
                                  key={label}
                                  className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${
                                    theme === 'dark'
                                      ? 'text-gray-300 hover:bg-gray-700 hover:text-blue-400'
                                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                                  }`}
                                  onClick={() => { fn(); setShowExportDropdown(false); }}
                                >
                                  {icon}
                                  <span>{label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Filter bar */}
                      <div className={`rounded-xl border p-6 mb-6 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                          {/* Customer selector */}
                          <div className="space-y-2 md:col-span-1">
                            <label className={`text-sm font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              Customer(s)
                            </label>
                            <div className="flex flex-wrap gap-2 items-center">
                              <button
                                onClick={handleOpenCustomerModal}
                                className={`flex items-center justify-between px-4 py-2.5 border rounded-lg text-sm transition-all shadow-sm ${
                                  theme === 'dark'
                                    ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                                    : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
                                }`}
                              >
                                <span className="truncate max-w-[200px]">
                                  {!selectedCustomers.length
                                    ? "Select Customers"
                                    : selectedCustomers.length === 1
                                      ? (selectedCustomers[0].CardName || selectedCustomers[0].name || selectedCustomers[0]._name)
                                      : `${selectedCustomers.length} customers selected`}
                                </span>
                                <Users className={`w-4 h-4 flex-shrink-0 ml-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                              </button>
                              {selectedCustomers.length > 0 && (
                                <span className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'}`}>
                                  {selectedCustomers.length} selected
                                </span>
                              )}
                            </div>
                            {selectedCustomers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2 max-h-20 overflow-y-auto p-1 border rounded-lg">
                                {selectedCustomers.map((c, idx) => (
                                  <div
                                    key={c.CardCode || c.code || c._id || idx}
                                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                                      theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    <span className="truncate max-w-[150px]">{c.CardName || c.name || c._name}</span>
                                    <button
                                      onClick={() => handleRemoveCustomer(c)}
                                      className={`ml-1 hover:text-red-500 transition-colors ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Date From */}
                          <div className="space-y-2">
                            <label className={`text-sm font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              Date From
                            </label>
                            <input
                              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors ${
                                theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'
                              }`}
                            />
                          </div>

                          {/* Date To */}
                          <div className="space-y-2">
                            <label className={`text-sm font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              Date To
                            </label>
                            <input
                              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors ${
                                theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Job status bar */}
                      {loading && activeJobId && (
                        <div className={`border rounded-xl p-4 mb-6 ${theme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                          <div className="flex items-center gap-3">
                            {getStatusIcon(jobStatus)}
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}>Report Generation in Progress</p>
                              <p className={`text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>Job ID: {activeJobId}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Loading spinner */}
                      {loading && (
                        <div className={`flex items-center justify-center min-h-[400px] rounded-xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50/50'}`}>
                          <div className={`rounded-lg border shadow-sm p-8 w-full max-w-md flex flex-col items-center justify-center text-center ${
                            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                          }`}>
                            <div className="relative mb-6">
                              <div className={`w-16 h-16 border-4 rounded-full ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}></div>
                              <div className="w-16 h-16 border-4 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                            </div>
                            <h3 className={`text-xl font-semibold mb-3 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>Generating Your Report</h3>
                            <p className={`mb-4 max-w-sm leading-relaxed text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                              Fetching invoice data and calculating rebates for {selectedCustomers.length} customer(s)...
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── Report preview ── */}
                      {!loading && showReport && reportData.length > 0 && (
                        <div className={`rounded-xl border p-6 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>Report Preview</h3>
                            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                              Showing page {currentPage} of {totalPages} • {currentPageRows.length} rows
                            </div>
                          </div>

                          <div className="flex justify-center overflow-x-auto">
                            <div
                              ref={reportRef}
                              className="bg-white shadow-lg border border-gray-300 relative"
                              style={{ width: '816px', minHeight: '1056px', padding: '48px 56px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}
                            >
                              {isFirstPage && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                  <img src={nexchemReport} alt="Nexchem Report" style={{ width: '160px', height: 'auto' }} />
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '4px' }}>KITANEX</div>
                                    <div style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>{getRebatePeriod()}</div>
                                    <div style={{ fontSize: '11px', color: '#777' }}>{getCurrentDate()}</div>
                                  </div>
                                </div>
                              )}

                              <div style={{ flex: 1 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                  {isFirstPage && (
                                    <thead>
                                      <tr style={{ background: '#dbeafe' }}>
                                        <th style={{ border: '0.5px solid #555', padding: '5px 6px', textAlign: 'left',   fontWeight: '700', width: '40%' }}>{getSelectedCustomerNames()}</th>
                                        <th style={{ border: '0.5px solid #555', padding: '5px 4px', textAlign: 'center', fontWeight: '700', width: '8%'  }}>QTY</th>
                                        <th style={{ border: '0.5px solid #555', padding: '5px 4px', textAlign: 'center', fontWeight: '700', width: '16%' }}>SALES AMT</th>
                                        <th style={{ border: '0.5px solid #555', padding: '5px 4px', textAlign: 'center', fontWeight: '700', width: '10%' }}>KITANEX</th>
                                        <th style={{ border: '0.5px solid #555', padding: '5px 4px', textAlign: 'center', fontWeight: '700', width: '16%' }}>TOTAL KITANEX</th>
                                      </tr>
                                    </thead>
                                  )}
                                  <tbody>
                                    {currentPageRows.map((row, index) => {
                                      if (row.type === 'date') return (
                                        <tr key={`d-${index}`} style={{ background: '#f3f4f6' }}>
                                          <td colSpan={5} style={{ border: '0.5px solid #555', padding: '4px 6px', fontWeight: '700', color: '#1a1a1a' }}>{row.content}</td>
                                        </tr>
                                      );
                                      if (row.type === 'invoice') return (
                                        <tr key={`inv-${index}`} style={{ background: '#f9fafb' }}>
                                          <td colSpan={5} style={{ border: '0.5px solid #555', padding: '4px 16px', fontWeight: '600', color: '#333' }}>{row.content}</td>
                                        </tr>
                                      );
                                      if (row.type === 'item') {
                                        const item = row.content;
                                        return (
                                          <tr key={`item-${index}`} style={{ background: index % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                            <td style={{ border: '0.5px solid #555', padding: '3px 6px 3px 28px', color: '#333' }}>{item.name}</td>
                                            <td style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', color: '#333' }}>{item.qty.toLocaleString()}</td>
                                            <td style={{ border: '0.5px solid #555', padding: '3px 6px', textAlign: 'right',  color: '#333' }}>₱{item.sales_amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ border: '0.5px solid #555', padding: '3px 4px', textAlign: 'center', color: '#333' }}>{item.kitanex}</td>
                                            <td style={{ border: '0.5px solid #555', padding: '3px 6px', textAlign: 'right',  color: '#333' }}>₱{item.total_kitanex.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                          </tr>
                                        );
                                      }
                                      return null;
                                    })}
                                  </tbody>
                                  {isLastPage && (
                                    <tfoot>
                                      <tr style={{ background: '#eff6ff' }}>
                                        <td style={{ border: '0.5px solid #555', padding: '5px 6px', fontWeight: '700', color: '#1a1a1a' }}>Grand Total</td>
                                        <td style={{ border: '0.5px solid #555', padding: '5px 4px', textAlign: 'center', fontWeight: '700', color: '#1a1a1a' }}>{totalQty.toLocaleString()}</td>
                                        <td style={{ border: '0.5px solid #555', padding: '5px 6px', textAlign: 'right',  fontWeight: '700', color: '#1a1a1a' }}>₱{totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        <td style={{ border: '0.5px solid #555', padding: '5px 4px', color: '#1a1a1a' }}></td>
                                        <td style={{ border: '0.5px solid #555', padding: '5px 6px', textAlign: 'right',  fontWeight: '700', color: '#1a1a1a' }}>₱{totalKitanex.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                      </tr>
                                    </tfoot>
                                  )}
                                </table>
                              </div>

                              <div style={{ flexShrink: 0 }}>
                                {isLastPage && (
                                  <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                    <div>
                                      <p style={{ fontSize: '10px', fontWeight: '600', color: '#374151', marginBottom: '24px' }}>Prepared by:</p>
                                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#1a1a1a', borderTop: '1px solid #555', paddingTop: '4px' }}>{userName}</p>
                                      <p style={{ fontSize: '10px', color: '#6b7280' }}>Marketing Associate</p>
                                    </div>
                                    <div>
                                      <p style={{ fontSize: '10px', fontWeight: '600', color: '#374151', marginBottom: '24px' }}>Checked by:</p>
                                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#1a1a1a', borderTop: '1px solid #555', paddingTop: '4px' }}>Joy O. Sarcia</p>
                                      <p style={{ fontSize: '10px', color: '#6b7280' }}>Purchasing Supervisor</p>
                                    </div>
                                  </div>
                                )}
                                <div style={{ textAlign: 'center', fontSize: '9px', color: '#9ca3af', marginTop: '12px' }}>
                                  Page {currentPage} of {totalPages}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className={`flex justify-center items-center gap-2 py-6 border-t mt-6 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                              <button
                                onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}
                                className={`px-4 py-2 border text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-blue-900 hover:border-blue-700'
                                    : 'bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500'
                                }`}
                              >Previous</button>

                              {(() => {
                                const pages = [];
                                const maxV  = 5;
                                if (totalPages <= maxV) {
                                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                                } else {
                                  pages.push(1);
                                  let s = Math.max(2, currentPage - 1), e = Math.min(totalPages - 1, currentPage + 1);
                                  if (currentPage <= 3)               { s = 2; e = Math.min(totalPages - 1, 4); }
                                  else if (currentPage >= totalPages - 2) { s = Math.max(2, totalPages - 3); e = totalPages - 1; }
                                  if (s > 2) pages.push('...');
                                  for (let i = s; i <= e; i++) pages.push(i);
                                  if (e < totalPages - 1) pages.push('...');
                                  pages.push(totalPages);
                                }
                                return pages.map((p, i) => p === '...' ? (
                                  <span key={`el-${i}`} className={`px-3 py-2 text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>...</span>
                                ) : (
                                  <button
                                    key={p} onClick={() => paginate(p)}
                                    className={`px-3 py-2 border text-sm rounded min-w-[40px] transition-colors ${
                                      currentPage === p
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : theme === 'dark'
                                          ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-blue-900 hover:border-blue-700'
                                          : 'bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500'
                                    }`}
                                  >{p}</button>
                                ));
                              })()}

                              <button
                                onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}
                                className={`px-4 py-2 border text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-blue-900 hover:border-blue-700'
                                    : 'bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500'
                                }`}
                              >Next</button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Empty state */}
                      {!loading && !showReport && !activeJobId && (
                        <div className="flex justify-center">
                          <div
                            className={`border-2 border-dashed flex items-center justify-center rounded-xl ${
                              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-300'
                            }`}
                            style={{ width: '100%', maxWidth: '816px', height: '600px', margin: '0 auto' }}
                          >
                            <div className={`text-lg text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                              Select parameters and click 'Generate Report' to preview
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Right sidebar panel ── */}
                    <div className="xl:col-span-1">
                      <div className={`rounded-xl border p-6 sticky top-6 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-2 mb-4">
                          <Clock className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                          <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>Recent Reports</h3>
                        </div>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto">
                          {loading && activeJobId && (
                            <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'border-blue-700 bg-blue-900/30' : 'border-blue-200 bg-blue-50'}`}>
                              <div className="flex items-start gap-2">
                                {getStatusIcon(jobStatus)}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {selectedCustomers.length === 1
                                      ? (selectedCustomers[0].CardName || selectedCustomers[0].name || 'Customer')
                                      : `${selectedCustomers.length} Customers`}
                                  </p>
                                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{formatJobDate(new Date().toISOString())}</p>
                                  <span className={`text-xs px-2 py-1 rounded-full mt-1 inline-block ${theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'}`}>Processing</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {!loading && showReport && reportData.length > 0 && (
                            <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'border-green-700 bg-green-900/30' : 'border-green-200 bg-green-50'}`}>
                              <div className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {selectedCustomers.length === 1
                                      ? (selectedCustomers[0].CardName || selectedCustomers[0].name || 'Customer')
                                      : `${selectedCustomers.length} Customers`}
                                  </p>
                                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{formatJobDate(new Date().toISOString())}</p>
                                  <span className={`text-xs px-2 py-1 rounded-full mt-1 inline-block ${theme === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800'}`}>Current Report</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {!loading && !showReport && (
                            <p className={`text-sm text-center py-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>No reports generated yet</p>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                  /* end main content */
                )
            }
            {/* end access gate */}

          </div>
        </div>
      </main>

      <CustomerSelectionModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customers={customers}
        selectedCustomers={selectedCustomers}
        onConfirm={handleCustomerSelectionConfirm}
        theme={theme}
      />
    </div>
  );
}

export default Nexchem_Reports;