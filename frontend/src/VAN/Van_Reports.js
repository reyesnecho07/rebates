// Van_Reports.jsx  — Rebate Sales Program Monitoring Report
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart2, FileText, FileSpreadsheet, FileType, Image,
  Calendar, Clock, CheckCircle, XCircle, RefreshCw,
  Lock, Search, X, ChevronDown, ChevronUp, Tag, Users,
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useTheme } from '../context/ThemeContext';
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';
import vanLogo from '../assets/van.png';

const API_BASE  = 'http://192.168.100.193:3009/api';
const DB_NAME   = 'USER';
const REPORT_DB = 'VAN';



// ─── Quarter helpers (client-side mirror) ─────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const QTR_NAMES   = ['1ST QUARTER','2ND QUARTER','3RD QUARTER','4TH QUARTER'];
const QTR_RANGES  = ['JAN - MAR','APR - JUN','JUL - SEP','OCT - DEC'];
const qFromDate = (d) => { const m = new Date(d).getMonth(); return Math.floor(m / 3) + 1; };
const yFromDate = (d) => new Date(d).getFullYear();
const qLabel    = (q, y) => `${QTR_NAMES[q-1]} ${y} (${QTR_RANGES[q-1]})`;

// ─── Signatories ──────────────────────────────────────────────────────────────
const SIGNATORIES = [
  { name: 'RAQUEL RODRIGUEZ',  title: 'Marketing Associate',        label: 'Prepared by:' },
  { name: 'TESSIE CADACIO',    title: 'Marketing Supervisor',       label: 'Checked by:' },
  { name: 'RAYMOND MARTICIO',  title: 'Market Channel Coordinator', label: '\u00A0' },
  { name: 'MARCO LAGANZO',     title: 'District Manager',           label: 'Reviewed by:' },
  { name: 'LITO C. NUELAS',    title: 'District Manager - Field',   label: 'Noted by:' },
  { name: 'JERALD S. LO',      title: 'General Manager',            label: 'Approved by:' },
];

// ─── Compact number formatter ─────────────────────────────────────────────────
const fmt    = (n) => (n == null || isNaN(n)) ? '' : Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtAmt = (n) => (n == null || isNaN(n) || n === 0) ? '' : `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

// ─── Border constants ─────────────────────────────────────────────────────────
// Using one-sided borders (right + bottom only) with table providing left + top.
// This prevents html2canvas from rendering each cell as an individual "box"
// with doubled/shadowed borders. The result is clean, uniform grid lines in PDF/PNG.
const BORDER_HEADER = '1px solid #374151';
const BORDER_DATA   = '1px solid #9ca3af';

// ─── Shared table style helpers ───────────────────────────────────────────────
const thStyle = (extra = {}) => ({
  borderRight:  BORDER_HEADER,
  borderBottom: BORDER_HEADER,
  padding: '4px 5px',
  textAlign: 'center',
  fontWeight: 700,
  fontSize: '9px',
  verticalAlign: 'middle',
  background: '#1e3a5f',
  color: '#fff',
  ...extra,
});

const tdStyle = (extra = {}) => ({
  borderRight:  BORDER_DATA,
  borderBottom: BORDER_DATA,
  padding: '3px 5px',
  fontSize: '9px',
  verticalAlign: 'middle',
  ...extra,
});

// ─── Table wrapper style: provides the left + top outer edges of the grid ─────
// With borderCollapse:'separate' + borderSpacing:0, cells only carry right+bottom,
// and the table element itself supplies the missing left+top outer borders.
const tableStyle = (extra = {}) => ({
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  tableLayout: 'auto',
  borderLeft:  BORDER_HEADER,
  borderTop:   BORDER_HEADER,
  ...extra,
});

// ─── Section colour palette for multi-rebate merged header strips ─────────────
const SEC_COLORS = [
  { bg: '#1e3a5f', border: '#374151' },
  { bg: '#14532d', border: '#374151' },
  { bg: '#312e81', border: '#374151' },
  { bg: '#7c2d12', border: '#374151' },
  { bg: '#1a3a4f', border: '#374151' },
];
const secColor = (i) => SEC_COLORS[i % SEC_COLORS.length];

// ─── Single-section report table (original, used when no customer overlap) ────
const ReportTable = ({ section, idx: sectionIdx }) => {
  const { rebateType, quarterMonths, items, ranges, customers, prevQDisplay } = section;
  const isIncremental = rebateType === 'Incremental';
  const targetColsPerItem = isIncremental ? 1 + ranges.length : 4;
  const totalCols = 2 + items.length * targetColsPerItem + 3 + 1 + 1;

  return (
    <table style={tableStyle({ marginBottom: sectionIdx > 0 ? '16px' : '0' })}>
      <thead>
        <tr>
          <th rowSpan={2} style={thStyle({ width: '28px' })}>#</th>
          <th rowSpan={2} style={thStyle({ width: '140px', textAlign: 'left' })}>DEALERS NAME</th>
          {items.map((item, ii) => (
            <th key={`ig-${ii}`} colSpan={targetColsPerItem} style={thStyle({ fontSize: '8px', maxWidth: '220px' })}>
              {item.label || item.ItemName || ''}
            </th>
          ))}
          <th colSpan={3} style={thStyle({ background: '#14532d' })}>ACTUAL SALES</th>
          <th rowSpan={2} style={thStyle({ background: '#7c2d12', fontSize: '8px', width: '42px' })}>QTR<br />REB</th>
          <th rowSpan={2} style={thStyle({ background: '#312e81', width: '58px' })}>AMOUNT</th>
        </tr>
        <tr>
          {items.map((_, ii) => (
            <React.Fragment key={`sub-${ii}`}>
              <th style={thStyle({ fontSize: '7.5px', width: '46px' })}>
                3MOS AVE<br /><span style={{ fontWeight: 400, fontSize: '7px' }}>({prevQDisplay})</span>
              </th>
              {isIncremental
                ? ranges.map((r, ri) => (
                    <th key={`r-${ri}`} style={thStyle({ fontSize: '7.5px', width: '44px' })}>
                      ₱{r.rebatePerBag}/BAG<br />
                      <span style={{ fontWeight: 400, fontSize: '7px' }}>({r.minQty}{r.maxQty ? `-${r.maxQty}` : '+'} bags)</span>
                    </th>
                  ))
                : quarterMonths.map((qm, mi) => (
                    <th key={`qm-${mi}`} style={thStyle({ fontSize: '7.5px', width: '38px' })}>{qm.short}</th>
                  ))
              }
            </React.Fragment>
          ))}
          {quarterMonths.map((qm, mi) => (
            <th key={`am-${mi}`} style={thStyle({ background: '#14532d', fontSize: '7.5px', width: '40px' })}>{qm.short}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {customers.length === 0 ? (
          <tr>
            <td colSpan={totalCols} style={tdStyle({ textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' })}>
              No customers found for this rebate program.
            </td>
          </tr>
        ) : (
          customers.map((cust, ci) => {
            const rowBg = ci % 2 === 0 ? '#ffffff' : '#f9fafb';
            return (
              <tr key={cust.cardCode} style={{ background: rowBg }}>
                <td style={tdStyle({ textAlign: 'center', color: '#6b7280' })}>{ci + 1}</td>
                <td style={tdStyle({ fontWeight: 600, color: '#111827' })}>{cust.cardName}</td>
                {items.map((_, ii) => (
                  <React.Fragment key={`itd-${ii}`}>
                    <td style={tdStyle({ textAlign: 'center', color: '#374151' })}>
                      {cust.prevAvg > 0 ? fmt(cust.prevAvg) : ''}
                    </td>
                    {isIncremental
                      ? ranges.map((r, ri) => (
                          <td key={`rv-${ri}`} style={tdStyle({ textAlign: 'center', color: '#374151' })}>
                            {fmt(r.minQty)}
                          </td>
                        ))
                      : cust.monthlyQuotas.map((mq, mi) => (
                          <td key={`mq-${mi}`} style={tdStyle({ textAlign: 'center', color: '#374151' })}>
                            {mq.targetQty > 0 ? fmt(mq.targetQty) : ''}
                          </td>
                        ))
                    }
                  </React.Fragment>
                ))}
                {cust.monthlyActuals.map((ma, mi) => (
                  <td key={`ma-${mi}`} style={tdStyle({ textAlign: 'center', color: ma.qty > 0 ? '#1e3a5f' : '#d1d5db', fontWeight: ma.qty > 0 ? 600 : 400 })}>
                    {ma.qty > 0 ? fmt(ma.qty) : '-'}
                  </td>
                ))}
                <td style={tdStyle({ textAlign: 'center', color: '#92400e', fontWeight: 600 })}>
                  {cust.qtrRebate > 0 ? fmt(cust.qtrRebate) : ''}
                </td>
                <td style={tdStyle({ textAlign: 'right', color: '#312e81', fontWeight: 700 })}>
                  {cust.displayAmount > 0 ? fmtAmt(cust.displayAmount) : ''}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
};

// ─── Merged table: multiple rebate sections sharing at least some customers ────
const MergedReportTable = ({ sections }) => {
  const customerOrder = [];
  const customerMap   = new Map();
  sections.forEach(sec => {
    sec.customers.forEach(c => {
      if (!customerMap.has(c.cardCode)) {
        customerOrder.push(c.cardCode);
        customerMap.set(c.cardCode, { cardCode: c.cardCode, cardName: c.cardName, bySec: {} });
      }
      customerMap.get(c.cardCode).bySec[sec.rebateCode] = c;
    });
  });
  const allCustomers = customerOrder.map(cc => customerMap.get(cc));

  const secMeta = sections.map((sec, si) => {
    const isInc      = sec.rebateType === 'Incremental';
    const targetCols = isInc ? sec.ranges.length : 3;
    const totalCols  = 1 + targetCols + 3 + 1 + 1;
    return { ...sec, isInc, targetCols, totalCols, color: secColor(si) };
  });

  return (
    <table style={tableStyle()}>
      <thead>
        {/* ── Row 1: section label strips ── */}
        <tr>
          <th rowSpan={3} style={thStyle({ width: '28px' })}>#</th>
          <th rowSpan={3} style={thStyle({ width: '140px', textAlign: 'left' })}>DEALERS NAME</th>
          {secMeta.map((sec, si) => (
            <th
              key={sec.rebateCode}
              colSpan={sec.totalCols}
              style={thStyle({ background: sec.color.bg, fontSize: '8px' })}
            >
              {sec.rebateName || sec.rebateCode}&nbsp;
              <span style={{ fontWeight: 400, opacity: 0.8 }}>({sec.rebateType})</span>
            </th>
          ))}
        </tr>
        {/* ── Row 2: item label per section ── */}
        <tr>
          {secMeta.map((sec) => (
            <th
              key={sec.rebateCode}
              colSpan={sec.totalCols}
              style={thStyle({ background: sec.color.bg, fontSize: '7.5px', fontWeight: 400 })}
            >
              {sec.items[0]?.label || ''}
            </th>
          ))}
        </tr>
        {/* ── Row 3: sub-column headers ── */}
        <tr>
          {secMeta.map((sec) => (
            <React.Fragment key={sec.rebateCode}>
              <th style={thStyle({ background: sec.color.bg, fontSize: '7.5px', width: '46px' })}>
                3MOS AVE<br />
                <span style={{ fontWeight: 400, fontSize: '7px' }}>({sec.prevQDisplay})</span>
              </th>
              {sec.isInc
                ? sec.ranges.map((r, ri) => (
                    <th key={`r-${ri}`} style={thStyle({ background: sec.color.bg, fontSize: '7.5px', width: '44px' })}>
                      ₱{r.rebatePerBag}/BAG<br />
                      <span style={{ fontWeight: 400, fontSize: '7px' }}>
                        ({r.minQty}{r.maxQty ? `-${r.maxQty}` : '+'} bags)
                      </span>
                    </th>
                  ))
                : sec.quarterMonths.map((qm, mi) => (
                    <th key={`qm-${mi}`} style={thStyle({ background: sec.color.bg, fontSize: '7.5px', width: '38px' })}>
                      {qm.short}
                    </th>
                  ))
              }
              {sec.quarterMonths.map((qm, mi) => (
                <th key={`am-${mi}`} style={thStyle({ background: '#14532d', fontSize: '7.5px', width: '40px' })}>
                  ACT {qm.short}
                </th>
              ))}
              <th style={thStyle({ background: '#7c2d12', fontSize: '8px', width: '42px' })}>
                QTR<br />REB
              </th>
              <th style={thStyle({ background: '#312e81', width: '58px' })}>AMOUNT</th>
            </React.Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {allCustomers.map((cust, ci) => {
          const rowBg = ci % 2 === 0 ? '#ffffff' : '#f9fafb';
          return (
            <tr key={cust.cardCode} style={{ background: rowBg }}>
              <td style={tdStyle({ textAlign: 'center', color: '#6b7280' })}>{ci + 1}</td>
              <td style={tdStyle({ fontWeight: 600, color: '#111827' })}>{cust.cardName}</td>
              {secMeta.map((sec) => {
                const cd = cust.bySec[sec.rebateCode];
                if (!cd) {
                  return (
                    <React.Fragment key={sec.rebateCode}>
                      {Array(sec.totalCols).fill(0).map((_, i) => (
                        <td key={i} style={tdStyle({ textAlign: 'center', color: '#d1d5db' })}>—</td>
                      ))}
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={sec.rebateCode}>
                    <td style={tdStyle({ textAlign: 'center', color: '#374151' })}>
                      {cd.prevAvg > 0 ? fmt(cd.prevAvg) : ''}
                    </td>
                    {sec.isInc
                      ? sec.ranges.map((r, ri) => (
                          <td key={`rv-${ri}`} style={tdStyle({ textAlign: 'center', color: '#374151' })}>
                            {fmt(r.minQty)}
                          </td>
                        ))
                      : cd.monthlyQuotas.map((mq, mi) => (
                          <td key={`mq-${mi}`} style={tdStyle({ textAlign: 'center', color: '#374151' })}>
                            {mq.targetQty > 0 ? fmt(mq.targetQty) : ''}
                          </td>
                        ))
                    }
                    {cd.monthlyActuals.map((ma, mi) => (
                      <td key={`ma-${mi}`} style={tdStyle({
                        textAlign: 'center',
                        color: ma.qty > 0 ? '#1e3a5f' : '#d1d5db',
                        fontWeight: ma.qty > 0 ? 600 : 400,
                      })}>
                        {ma.qty > 0 ? fmt(ma.qty) : '-'}
                      </td>
                    ))}
                    <td style={tdStyle({ textAlign: 'center', color: '#92400e', fontWeight: 600 })}>
                      {cd.qtrRebate > 0 ? fmt(cd.qtrRebate) : ''}
                    </td>
                    <td style={tdStyle({ textAlign: 'right', color: '#312e81', fontWeight: 700 })}>
                      {cd.displayAmount > 0 ? fmtAmt(cd.displayAmount) : ''}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// ─── Determine whether sections share any customers ───────────────────────────
const sectionsShareCustomers = (sections) => {
  if (sections.length < 2) return false;
  const codesInFirst = new Set(sections[0].customers.map(c => c.cardCode));
  return sections.slice(1).some(sec =>
    sec.customers.some(c => codesInFirst.has(c.cardCode))
  );
};

// ─── PrintableReport: landscape A4 canvas ────────────────────────────────────
const PrintableReport = React.forwardRef(({ sections, userName }, ref) => {
  if (!sections || !sections.length) return null;
  const first = sections[0];
  const merged = sectionsShareCustomers(sections);

  // Dynamically set Market Channel Coordinator name from MCC header
  const dynamicSignatories = SIGNATORIES.map(sig => {
    if (sig.label === 'Prepared by:') {
      // Use the logged‑in user’s name, fallback to static name if empty
      return {
        ...sig,
        name: userName && userName.trim() !== '' ? userName.toUpperCase() : sig.name,
      };
    }
    if (sig.title === 'Market Channel Coordinator') {
      return {
        ...sig,
        name: first.salesEmployee && first.salesEmployee.trim() !== ''
          ? first.salesEmployee.toUpperCase()
          : sig.name,   // fallback to RAYMOND MARTICIO
      };
    }
    return sig;
  });

  return (
    <div
      ref={ref}
      style={{
        width: '1122px',
        minHeight: '793px',
        background: '#ffffff',
        padding: '28px 32px',
        boxSizing: 'border-box',
        fontFamily: 'Arial, Helvetica, sans-serif',
        position: 'relative',
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: 'left', marginBottom: '-20px', marginTop: '-40px', marginLeft: '-20px' }}>
        <img src={vanLogo} alt="VAN" style={{ width: '100px', height: 'auto', objectFit: 'contain' }} />
      </div>

      {/* MCC / AREA / PERIOD */}
      <div style={{ marginBottom: '12px', fontSize: '10px', color: '#374151' }}>
        <div><strong>MCC:</strong> {first.salesEmployee || '_______________'}</div>
        <div><strong>AREA:</strong> </div>
        <div><strong>PERIOD:</strong> {first.quarterDisplay}</div>
      </div>

      {/* Title */}
      <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a5f', letterSpacing: '0.04em', marginBottom: '10px' }}>
        SALES PROGRAM REBATE MONITORING
      </div>

      {/* ── Tables ── */}
      {merged ? (
        <MergedReportTable sections={sections} />
      ) : (
        sections.map((section, si) => (
          <div key={section.rebateCode} style={{ marginBottom: si < sections.length - 1 ? '18px' : '0' }}>
            {sections.length > 1 && (
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#1e3a5f', marginBottom: '4px', textTransform: 'uppercase' }}>
                {section.rebateName} — {section.rebateType}
              </div>
            )}
            <ReportTable section={section} idx={si} />
          </div>
        ))
      )}

      {/* ── Signatories ── */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'space-between', paddingTop: '12px', alignItems: 'flex-end' }}>
        {dynamicSignatories.map((sig, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: '7.5px', color: '#6b7280', marginBottom: '14px', whiteSpace: 'nowrap' }}>
              {sig.label}
            </div>
            <div style={{ borderBottom: '1px solid #374151', paddingBottom: '2px', marginBottom: '2px' }}>
              <span style={{ fontSize: '8px', fontWeight: 700, color: '#111827' }}>{sig.name}</span>
            </div>
            <div style={{ fontSize: '7.5px', color: '#6b7280' }}>{sig.title}</div>
          </div>
        ))}
      </div>

      {/* Timestamp */}
      <div style={{ position: 'absolute', bottom: '10px', right: '18px', fontSize: '7px', color: '#d1d5db' }}>
        Generated: {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
});

// ─── RebateSelector Component ─────────────────────────────────────────────────
const RebateSelector = ({ rebates, selected, onToggle, onClear, theme }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = rebates.filter(r =>
    r.rebateCode.toLowerCase().includes(search.toLowerCase()) ||
    (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
    r.rebateType.toLowerCase().includes(search.toLowerCase())
  );

  const dark = theme === 'dark';

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg text-sm transition-all
          ${dark ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
      >
        <span className="truncate">
          {selected.length === 0
            ? 'Select Rebate Code(s)...'
            : selected.length === 1
              ? `${selected[0].rebateCode} — ${selected[0].rebateType}`
              : `${selected.length} rebate codes selected`}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className={`absolute z-50 w-full mt-1 rounded-xl border shadow-xl overflow-hidden
          ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`p-2 border-b ${dark ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="relative">
              <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${dark ? 'text-gray-400' : 'text-gray-400'}`} />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search rebate codes..."
                className={`w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border
                  ${dark ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder-gray-400'}`}
              />
            </div>
          </div>

          {selected.length > 0 && (
            <button
              onClick={() => { onClear(); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors
                ${dark ? 'text-red-400 hover:bg-red-900/30' : 'text-red-600 hover:bg-red-50'}`}
            >
              ✕ Clear all ({selected.length})
            </button>
          )}

          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className={`px-3 py-4 text-xs text-center ${dark ? 'text-gray-500' : 'text-gray-400'}`}>No rebates found</p>
            ) : (
              filtered.map(r => {
                const checked = selected.some(s => s.rebateCode === r.rebateCode);
                return (
                  <button
                    key={r.rebateCode}
                    type="button"
                    onClick={() => onToggle(r)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors text-xs
                      ${checked
                        ? dark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-50 text-blue-700'
                        : dark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <div className={`w-4 h-4 border rounded flex-shrink-0 flex items-center justify-center
                      ${checked ? 'bg-blue-500 border-blue-500' : dark ? 'border-gray-600' : 'border-gray-300'}`}>
                      {checked && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{r.rebateCode}</div>
                      <div className={`text-xs truncate ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {r.rebateType} • {r.dateFrom ? new Date(r.dateFrom).toLocaleDateString('en-PH', { year: 'numeric', month: 'short' }) : '—'}
                        {r.dateFrom && r.dateTo ? ` – ${new Date(r.dateTo).toLocaleDateString('en-PH', { year: 'numeric', month: 'short' })}` : ''}
                      </div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0
                      ${r.rebateType === 'Fixed'       ? 'bg-green-100 text-green-700'
                        : r.rebateType === 'Incremental' ? 'bg-orange-100 text-orange-700'
                        :                                  'bg-purple-100 text-purple-700'}`}
                    >
                      {r.rebateType[0]}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Van_Reports() {
  const { theme, updateTheme } = useTheme();
  const routePath = '/Van_Reports';
  const reportRef = useRef(null);

  const [collapsed, setCollapsed]                     = useState(false);
  const [showVanDropdown, setShowVanDropdown]         = useState(true);
  const [showNexchemDropdown, setShowNexchemDropdown] = useState(false);
  const [showVcpDropdown, setShowVcpDropdown]         = useState(false);

  const [userName, setUserName] = useState('');
  const [userCode, setUserCode] = useState('');
  const [initials, setInitials] = useState('');

  const [availableRebates, setAvailableRebates] = useState([]);
  const [selectedRebates,  setSelectedRebates]  = useState([]);
  const [reportSections,   setReportSections]   = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [showReport,       setShowReport]       = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [error, setError] = useState('');

  const [availableCustomers, setAvailableCustomers]     = useState([]);   // full list of unique customers from selected rebates
  const [selectedCustomers, setSelectedCustomers]       = useState([]);   // currently selected customers
  const [tempSelectedCustomers, setTempSelectedCustomers] = useState([]); // temporary selection in dropdown
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customersLoading, setCustomersLoading]         = useState(false);

  const { access, accessLoading } = useAccessControl(routePath);

  useComponentRegistration({
    name: 'Van_Reports', version: '3.1.0',
    description: 'Sales Program Rebate Monitoring Report',
    routePath,
  });

  // Filter report sections to only include selected customers
const filteredReportSections = React.useMemo(() => {
  if (!reportSections.length) return [];
  if (!selectedCustomers.length) return []; // no customers selected → show nothing

  const allowedCodes = new Set(selectedCustomers.map(c => c.CardCode));

  return reportSections.map(section => ({
    ...section,
    customers: section.customers.filter(cust => allowedCodes.has(cust.cardCode)),
  })).filter(section => section.customers.length > 0); // remove sections with no matching customers
}, [reportSections, selectedCustomers]);

  // Fetch unique customers from all selected rebate codes
useEffect(() => {
  const fetchCustomers = async () => {
    if (!selectedRebates.length) {
      setAvailableCustomers([]);
      setSelectedCustomers([]);
      setTempSelectedCustomers([]);
      return;
    }

    setCustomersLoading(true);
    try {
      // Fetch customers for each selected rebate code in parallel
      const promises = selectedRebates.map(r =>
        fetch(`${API_BASE}/van/report/rebate/${r.rebateCode}/customers?db=${REPORT_DB}`).then(res => res.json())
      );
      const results = await Promise.all(promises);

      // Combine unique customers (by CardCode)
      const customerMap = new Map();
      results.forEach(result => {
        if (result.success && result.data) {
          result.data.forEach(cust => {
            if (cust.CardCode && !customerMap.has(cust.CardCode)) {
              customerMap.set(cust.CardCode, {
                CardCode: cust.CardCode,
                CardName: cust.CardName,
              });
            }
          });
        }
      });

      const uniqueCustomers = Array.from(customerMap.values()).sort((a, b) =>
        a.CardName.localeCompare(b.CardName)
      );
      setAvailableCustomers(uniqueCustomers);
      setSelectedCustomers(uniqueCustomers); // default: all selected
      setTempSelectedCustomers(uniqueCustomers);
    } catch (e) {
      console.error('Failed to fetch customers:', e);
      // Silently fail – customers can still be generated without filtering
    } finally {
      setCustomersLoading(false);
    }
  };

  fetchCustomers();
}, [selectedRebates, API_BASE, REPORT_DB]);


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

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const n = u.DisplayName || u.Username || 'Unknown User';
    setUserName(n);
    setUserCode(u.User_ID || '');
    const parts = n.trim().split(' ');
    setInitials(parts.length === 1 ? parts[0][0].toUpperCase() : parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase());

    (async () => {
      try {
        const uid = u.UserID || u.User_ID;
        if (uid) {
          const res = await axios.get(`${API_BASE}/user/preferences/${uid}/theme?db=${DB_NAME}`);
          if (res.data?.value && res.data.value !== theme) updateTheme(res.data.value.toLowerCase());
        }
      } catch { /* ignore */ }
    })();
  }, []); // eslint-disable-line

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API_BASE}/van/report/rebates?db=${REPORT_DB}`);
        const data = await res.json();
        if (data.success) setAvailableRebates(data.data || []);
      } catch (e) {
        console.error('Failed to load rebates:', e);
      }
    })();
  }, []);

  // ── Auto-period label ──────────────────────────────────────────────────────
  const periodLabel = useCallback(() => {
    if (!selectedRebates.length) return '';
    const r = selectedRebates.find(r => r.dateFrom);
    if (!r) return '';
    return qLabel(qFromDate(r.dateFrom), yFromDate(r.dateFrom));
  }, [selectedRebates]);

  // ── Toggle rebate selection ────────────────────────────────────────────────
  const toggleRebate = useCallback((r) => {
    setSelectedRebates(prev => {
      const exists = prev.some(s => s.rebateCode === r.rebateCode);
      return exists ? prev.filter(s => s.rebateCode !== r.rebateCode) : [...prev, r];
    });
  }, []);

  // ── Generate report ────────────────────────────────────────────────────────
  const generateReport = async () => {
    if (!selectedRebates.length) { setError('Please select at least one rebate code.'); return; }
    setLoading(true);
    setError('');
    setShowReport(false);
    try {
      const res  = await fetch(`${API_BASE}/van/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rebateCodes: selectedRebates.map(r => r.rebateCode), db: REPORT_DB }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to generate report');
      setReportSections(data.data || []);
      setShowReport(true);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

const clearReport = () => {
  setReportSections([]);
  setShowReport(false);
  setSelectedRebates([]);
  setError('');
  setAvailableCustomers([]);
  setSelectedCustomers([]);
  setTempSelectedCustomers([]);
};
  // ── Export helpers ─────────────────────────────────────────────────────────
  const filename = (ext) => {
    const d = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `REBATE_MONITORING_${d}.${ext}`;
  };

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    try {
      const el     = reportRef.current;
      const canvas = await html2canvas(el, { scale: 1.8, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const pdf    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pgW    = pdf.internal.pageSize.getWidth();
      const pgH    = pdf.internal.pageSize.getHeight();
      const imgH   = pgW / (canvas.width / canvas.height);

      if (imgH <= pgH) {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pgW, imgH, undefined, 'FAST');
      } else {
        const sliceH = Math.floor(canvas.width * (pgH / pgW));
        let offset   = 0;
        while (offset < canvas.height) {
          const slice    = document.createElement('canvas');
          slice.width    = canvas.width;
          slice.height   = Math.min(sliceH, canvas.height - offset);
          slice.getContext('2d').drawImage(canvas, 0, offset, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
          const h = pgW * (slice.height / canvas.width);
          if (offset > 0) pdf.addPage();
          pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, pgW, h, undefined, 'FAST');
          offset += sliceH;
        }
      }
      pdf.save(filename('pdf'));
    } catch (e) { console.error(e); alert('PDF export failed.'); }
  };

  const exportToExcel = () => {
    if (!reportSections.length) return;
    const wb = XLSX.utils.book_new();
    reportSections.forEach(section => {
      const { rebateCode, rebateType, quarterDisplay, customers, items, ranges, quarterMonths } = section;
      const rows = [
        ['SALES PROGRAM REBATE MONITORING'],
        [`Rebate: ${rebateCode}`, `Type: ${rebateType}`, `Period: ${quarterDisplay}`],
        [],
      ];
      const h1 = ['#', 'Dealers Name'];
      items.forEach(it => {
        h1.push(it.label);
        if (rebateType === 'Incremental') ranges.forEach(r => h1.push(`₱${r.rebatePerBag}/BAG (${r.minQty}-${r.maxQty})`));
        else                              quarterMonths.forEach(qm => h1.push(qm.short));
      });
      quarterMonths.forEach(qm => h1.push(`ACTUAL ${qm.short}`));
      h1.push('QTR REB', 'AMOUNT');
      rows.push(h1);

      customers.forEach((c, ci) => {
        const row = [ci + 1, c.cardName];
        items.forEach(() => {
          row.push(c.prevAvg || '');
          if (rebateType === 'Incremental') ranges.forEach(r => row.push(r.minQty));
          else                              c.monthlyQuotas.forEach(mq => row.push(mq.targetQty || ''));
        });
        c.monthlyActuals.forEach(ma => row.push(ma.qty || ''));
        row.push(c.qtrRebate || '', c.displayAmount || '');
        rows.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, rebateCode.substring(0, 31));
    });
    saveAs(
      new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }),
      filename('xlsx')
    );
  };

  const exportToPNG = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#fff', useCORS: true });
    canvas.toBlob(b => b && saveAs(b, filename('png')));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const dark = theme === 'dark';

  const renderAccessLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-[300px]">
      <div className={`w-10 h-10 rounded-full border-4 border-t-transparent animate-spin ${dark ? 'border-blue-400' : 'border-blue-500'}`} />
    </div>
  );

  const renderAccessDenied = () => (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-8">
      <Lock size={36} className={dark ? 'text-red-400 mb-3' : 'text-red-500 mb-3'} />
      <h2 className={`text-lg font-bold mb-2 ${dark ? 'text-gray-100' : 'text-gray-800'}`}>Access Restricted</h2>
      <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>You don't have permission to view this page.</p>
      <Link to="/HomePage" className="mt-4 px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600">Go Home</Link>
    </div>
  );

  return (
    <div className={`flex min-h-screen w-full ${dark ? 'bg-gray-900 text-gray-100' : 'bg-slate-50 text-slate-900'} font-poppins`}>
      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        showVanDropdown={showVanDropdown}         setShowVanDropdown={setShowVanDropdown}
        showNexchemDropdown={showNexchemDropdown} setShowNexchemDropdown={setShowNexchemDropdown}
        showVcpDropdown={showVcpDropdown}         setShowVcpDropdown={setShowVcpDropdown}
        theme={theme}
      />
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${collapsed ? 'ml-20' : 'ml-64'}`}>
        <Header collapsed={collapsed} userName={userName} userCode={userCode} initials={initials} logo={vanLogo} theme={theme} />
        <div className="pt-16 flex-1 p-6 overflow-y-auto">
          <div className={`rounded-3xl border shadow-xl p-7 w-full max-w-[1600px] mx-auto mt-4
            ${dark ? 'bg-gray-800/80 border-gray-700/50' : 'bg-white/90 border-white/50'}`}>

            {/* Title */}
            <div className={`flex items-center gap-3 mb-5 pb-4 border-b ${dark ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow">
                <BarChart2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={`text-base font-bold ${dark ? 'text-gray-100' : 'text-gray-800'}`}>Rebate Monitoring Report</h1>
                <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Sales Program Rebate Monitoring per Quarter</p>
              </div>
            </div>

            {accessLoading ? renderAccessLoading()
              : !access.canView ? renderAccessDenied()
              : (

                
              <div className="space-y-5">
                  <button
                    onClick={generateReport}
                    disabled={loading || !selectedRebates.length || !access.canCreate}
                    className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors
                      ${access.canCreate && !loading && selectedRebates.length
                        ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                        : 'bg-gray-300 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                  >
                    {loading ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
                    {loading ? 'Generating...' : 'Generate Report'}
                  </button>
                {/* Controls */}
                  <div className={`rounded-xl border p-5 ${dark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
  {/* Rebate Code(s) – takes 2 columns */}
  <div className="md:col-span-2 space-y-1.5">
    <label className={`text-xs font-semibold flex items-center gap-1.5 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
      <Tag size={12} /> Rebate Code(s)
    </label>
    <RebateSelector
      rebates={availableRebates}
      selected={selectedRebates}
      onToggle={toggleRebate}
      onClear={() => setSelectedRebates([])}
      theme={theme}
    />
    {selectedRebates.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {selectedRebates.map(r => (
          <span key={r.rebateCode} className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full
            ${dark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'}`}>
            {r.rebateCode} ({r.rebateType[0]})
            <button onClick={() => toggleRebate(r)} className="hover:text-red-500 ml-0.5">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
    )}
  </div>

  {/* Customer Selection */}
  <div className="space-y-1.5 relative customer-dropdown-container">
    <label className={`text-xs font-semibold flex items-center gap-1.5 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
      <Users size={12} /> Customers
    </label>
    <button
      type="button"
      onClick={() => {
        if (availableCustomers.length > 0) {
          setShowCustomerDropdown(!showCustomerDropdown);
          setTempSelectedCustomers([...selectedCustomers]);
        }
      }}
      disabled={!selectedRebates.length || customersLoading}
      className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg text-sm transition-all
        ${(!selectedRebates.length || customersLoading)
          ? 'opacity-60 cursor-not-allowed'
          : 'cursor-pointer'}
        ${dark
          ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
    >
      <span className="truncate">
        {customersLoading
          ? 'Loading customers...'
          : selectedCustomers.length === 0
            ? 'No customers'
            : selectedCustomers.length === availableCustomers.length
              ? `All customers (${selectedCustomers.length})`
              : `${selectedCustomers.length} selected`}
      </span>
      {customersLoading ? (
        <RefreshCw size={14} className="animate-spin" />
      ) : (
        <ChevronDown size={14} />
      )}
    </button>

    {showCustomerDropdown && availableCustomers.length > 0 && (
      <div className={`absolute z-50 w-full mt-1 rounded-xl border shadow-xl overflow-hidden
        ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
        style={{ maxHeight: '260px', overflowY: 'auto' }}
      >
        {/* Select All */}
        <div
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b
            ${dark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'}`}
          onClick={() => {
            const allSelected = tempSelectedCustomers.length === availableCustomers.length;
            setTempSelectedCustomers(allSelected ? [] : [...availableCustomers]);
          }}
        >
          <input
            type="checkbox"
            checked={tempSelectedCustomers.length === availableCustomers.length}
            readOnly
            className="accent-blue-600"
          />
          <span className={`text-xs font-semibold ${dark ? 'text-gray-200' : 'text-gray-700'}`}>
            Select All
          </span>
        </div>

        {/* Customer list */}
        {availableCustomers.map(cust => (
          <div
            key={cust.CardCode}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors
              ${dark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
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
              className="accent-blue-600"
            />
            <span className={`text-xs truncate ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              {cust.CardName} <span className={`${dark ? 'text-gray-500' : 'text-gray-400'}`}>({cust.CardCode})</span>
            </span>
          </div>
        ))}

        {/* Apply button */}
        <div className={`p-2 border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={() => {
              setSelectedCustomers(tempSelectedCustomers);
              setShowCustomerDropdown(false);
            }}
            className="w-full py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    )}
  </div>

  {/* Report Period */}
  <div className="space-y-1.5">
    <label className={`text-xs font-semibold flex items-center gap-1.5 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
      <Calendar size={12} /> Report Period
    </label>
    <div className={`px-3 py-2.5 border rounded-lg text-xs ${dark ? 'bg-gray-600 border-gray-500 text-gray-300' : 'bg-white border-gray-200 text-gray-600'}`}>
      {periodLabel() || 'Auto-detected from rebate code'}
    </div>
  </div>
</div>

                    <div className="flex gap-3 mt-4">

                      {showReport && (
                        <button onClick={clearReport} className={`px-4 py-2 text-sm rounded-lg border transition-colors
                          ${dark ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                          Clear
                        </button>
                      )}

                      {showReport && access.canExport && (
                        <div className="relative ml-auto">
                          <button
                            onClick={() => setShowExportDropdown(v => !v)}
                            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors
                              ${dark ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                          >
                            <FileText size={13} /> Export
                          </button>
                          {showExportDropdown && (
                            <div className={`absolute right-0 mt-1 w-52 rounded-xl border shadow-xl z-50 overflow-hidden
                              ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                              {[
                                { label: 'Export as PDF',   icon: <FileText size={13} className="text-red-500" />,         fn: exportToPDF   },
                                { label: 'Export as Excel', icon: <FileSpreadsheet size={13} className="text-green-500" />, fn: exportToExcel },
                                { label: 'Export as PNG',   icon: <Image size={13} className="text-purple-500" />,          fn: exportToPNG   },
                              ].map(({ label, icon, fn }) => (
                                <button key={label} onClick={() => { fn(); setShowExportDropdown(false); }}
                                  className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors
                                    ${dark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-blue-50'}`}>
                                  {icon} {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                {/* Error */}
                {error && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border
                    ${dark ? 'bg-red-900/20 border-red-700 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
                    <XCircle size={15} /> {error}
                  </div>
                )}

                {/* Loading */}
                {loading && (
                  <div className={`flex flex-col items-center justify-center py-20 rounded-xl border
                    ${dark ? 'bg-gray-700/30 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className={`text-sm font-medium ${dark ? 'text-gray-400' : 'text-gray-600'}`}>Generating monitoring report…</p>
                    <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Fetching sales data for {selectedRebates.length} rebate code(s)
                    </p>
                  </div>
                )}

                {/* Report Preview */}
                {!loading && showReport && filteredReportSections.length > 0 && (
                  <div className={`rounded-xl border overflow-hidden ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className={`flex items-center justify-between px-5 py-3 border-b
                      ${dark ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={15} className="text-green-500" />
                        <span className={`text-sm font-semibold ${dark ? 'text-gray-200' : 'text-gray-700'}`}>Report Preview</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                          {sectionsShareCustomers(reportSections)
                            ? (() => {
                                const s = new Set();
                                reportSections.forEach(sec => sec.customers.forEach(c => s.add(c.cardCode)));
                                return s.size;
                              })()
                            : reportSections.reduce((s, sec) => s + sec.customers.length, 0)
                          } customers
                        </span>
                        {sectionsShareCustomers(reportSections) && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'}`}>
                            Merged view
                          </span>
                        )}
                      </div>
                      <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {reportSections[0]?.quarterDisplay}
                      </span>
                    </div>
                    <div className="overflow-x-auto overflow-y-auto bg-gray-200 dark:bg-gray-900 p-6" style={{ maxHeight: '70vh' }}>
                      <div style={{ width: '1122px', margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                        <PrintableReport ref={reportRef} sections={reportSections} userName={userName} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!loading && !showReport && !error && (
                  <div className={`flex items-center justify-center rounded-xl border border-dashed py-20
                    ${dark ? 'bg-gray-800/30 border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                    <div className="text-center">
                      <BarChart2 size={40} className={`mx-auto mb-3 ${dark ? 'text-gray-600' : 'text-gray-300'}`} />
                      <p className={`text-sm ${dark ? 'text-gray-500' : 'text-gray-500'}`}>
                        Select rebate code(s) and click Generate Report to preview
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}