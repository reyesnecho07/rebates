// Van_Reports.jsx — Rebate Sales Program Monitoring Report
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart2, FileText, FileSpreadsheet, Image,
  Calendar, Clock, CheckCircle, XCircle, RefreshCw,
  Lock, Search, X, ChevronDown, ChevronUp, Tag, Users,
  TrendingUp, Download, Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import AccessDenied from '../components/common/AccessDenied';
import { useTheme } from '../context/ThemeContext';
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';
import vanLogo from '../assets/van.png';

const API_BASE  = 'http://192.168.100.193:3009/api';
const DB_NAME   = 'USER';
const REPORT_DB = 'VAN';

/* ─── Paper geometry — 8.5 x 13 in (long bond / folio), LANDSCAPE ─────── */
const PAPER_W_IN   = 13;      // landscape width  (long side)
const PAPER_H_IN   = 8.5;     // landscape height (short side)
const PAPER_W_PX   = Math.round(PAPER_W_IN * 96);   // 1248 px @ 96 dpi
const PAPER_H_PX   = Math.round(PAPER_H_IN * 96);   // 816 px @ 96 dpi
const PAGE_PAD_IN  = 0.15;    // breathing room on continuation pages

/* ─── Apple system colour language ─────────────────────────────────────── */
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
`;

const injectFonts = () => {
  if (document.getElementById('nexchem-report-fonts')) return;
  const link = document.createElement('link');
  link.id   = 'nexchem-report-fonts';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
};

/* ─── Quarter helpers ───────────────────────────────────────────────────── */
const QTR_NAMES  = ['1ST QUARTER','2ND QUARTER','3RD QUARTER','4TH QUARTER'];
const QTR_SHORT  = ['1ST QTR','2ND QTR','3RD QTR','4TH QTR'];
const QTR_RANGES = ['JAN - MAR','APR - JUN','JUL - SEP','OCT - DEC'];
const qFromDate  = (d) => { const m = new Date(d).getMonth(); return Math.floor(m / 3) + 1; };
const yFromDate  = (d) => new Date(d).getFullYear();
const qLabel     = (q, y) => `${QTR_NAMES[q-1]} ${y} (${QTR_RANGES[q-1]})`;
const qShort     = (q) => QTR_SHORT[q-1] || '';

/* ─── Month name maps ──────────────────────────────────────────────────── */
const HEADER_MONTHS = {
  JAN: 'JANUARY', FEB: 'FEBRUARY', MAR: 'MARCH',
  APR: 'APRIL',   MAY: 'MAY',      JUN: 'JUNE',
  JUL: 'JULY',    AUG: 'AUGUST',   SEP: 'SEPTEMBER',
  OCT: 'OCTOBER', NOV: 'NOVEMBER', DEC: 'DECEMBER',
};
const toHeaderMonth = (qm) => HEADER_MONTHS[qm?.short] || qm?.short || '';

const buildMonthRange = (quarterMonths) => {
  if (!Array.isArray(quarterMonths) || quarterMonths.length === 0) return '';
  const first = toHeaderMonth(quarterMonths[0]);
  const last  = toHeaderMonth(quarterMonths[quarterMonths.length - 1]);
  if (!first || !last) return '';
  return `${first} TO ${last}`;
};

const sectionQuarterShort = (section) => {
  if (!section) return '';
  if (section.quarterNumber) return qShort(section.quarterNumber);
  const first = section.quarterMonths?.[0]?.short;
  if (!first) return '';
  const idx = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].indexOf(first);
  if (idx < 0) return '';
  return qShort(Math.floor(idx / 3) + 1);
};

/* ─── Signatories ───────────────────────────────────────────────────────── */
const SIGNATORIES = [
  { name: 'RAQUEL RODRIGUEZ',  title: 'Marketing Associate',        label: 'Prepared by:' },
  { name: 'TESSIE CADACIO',    title: 'Marketing Supervisor',       label: 'Checked by:' },
  { name: 'RAYMOND MARTICIO',  title: 'Market Channel Coordinator', label: '\u00A0' },
  { name: 'MARCO LAGANZO',     title: 'District Manager',           label: 'Reviewed by:' },
  { name: 'LITO C. NUELAS',    title: 'District Manager - Field',   label: 'Noted by:' },
  { name: 'JERALD S. LO',      title: 'General Manager',            label: 'Approved by:' },
];

/* ─── Number formatting ─────────────────────────────────────────────────── */
const fmt    = (n) => (n == null || isNaN(n)) ? '' : Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtAmt = (n) => (n == null || isNaN(n) || n === 0) ? '' : `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const num    = (n) => (n == null || isNaN(n)) ? 0 : Number(n);

/* ═══════════════════════════════════════════════════════════════════════════
   Report table constants — LIGHTER BORDERS, LIGHT-GRAY HEADERS
   ═══════════════════════════════════════════════════════════════════════════ */
const BORDER_HEADER = '1px solid #d1d5db';
const BORDER_DATA   = '1px solid #e5e7eb';

const HEADER_BG  = '#E5E7EB';
const HEADER_FG  = '#111827';
const TOTAL_BG   = '#E5E7EB';

const thStyle = (extra = {}) => ({
  borderRight:  BORDER_HEADER,
  borderBottom: BORDER_HEADER,
  padding: '4px 5px',
  textAlign: 'center',
  fontWeight: 600,
  fontSize: '9px',
  verticalAlign: 'middle',
  background: HEADER_BG,
  color: HEADER_FG,
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

const totalTdStyle = (extra = {}) => ({
  ...tdStyle({
    background: TOTAL_BG,
    fontWeight: 600,
    color: HEADER_FG,
    ...extra,
  }),
});

const tableStyle = (extra = {}) => ({
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  tableLayout: 'auto',
  borderLeft:  BORDER_HEADER,
  borderTop:   BORDER_HEADER,
  ...extra,
});

const secColor = () => ({ bg: HEADER_BG, border: '#d1d5db' });

const sectionHasQtrReb = (section) =>
  Array.isArray(section?.customers) &&
  section.customers.some(c => (c.qtrRebate ?? 0) > 0);

const isQtrRebateMet = (cust) => {
  if (cust?.qtrRebateMet != null) return !!cust.qtrRebateMet;
  const quotas  = cust?.monthlyQuotas  || [];
  const actuals = cust?.monthlyActuals || [];
  if (quotas.length === 0) return false;
  return quotas.every((mq, i) => num(actuals[i]?.qty) >= num(mq.targetQty));
};

const calcQtrRebateRate = (cust) => (isQtrRebateMet(cust) ? num(cust?.qtrRebate) : 0);

const calcQtrRebateAmount = (cust) => {
  if (!isQtrRebateMet(cust)) return 0;
  if (cust?.qtrRebateAmount != null && !isNaN(cust.qtrRebateAmount)) return num(cust.qtrRebateAmount);
  const rate = num(cust?.qtrRebate);
  if (rate <= 0) return 0;
  const totalActual = (cust?.monthlyActuals || []).reduce((s, m) => s + num(m.qty), 0);
  return totalActual * rate;
};

/* ═══════════════════════════════════════════════════════════════════════════
   ReportTable — single section
   ═══════════════════════════════════════════════════════════════════════════ */
const ReportTable = ({ section, idx: sectionIdx }) => {
  const {
    rebateType, rebateName, rebateCode,
    quarterMonths, items, ranges, customers,
  } = section;
  const isIncremental = rebateType === 'Incremental';

  const showQtr   = !isIncremental && sectionHasQtrReb(section);
  const qtrLabel  = sectionQuarterShort(section);
  const monthRange = buildMonthRange(quarterMonths);

  const quotaColsPerItem = isIncremental ? ranges.length : quarterMonths.length;
  const actualCols       = quarterMonths.length;
  const qtrCols          = showQtr ? 2 : 0;
  const totalCols =
    2 +
    items.length * (quotaColsPerItem + actualCols + 1) +
    qtrCols;

  const totalAmountPerItem = items.map(() =>
    customers.reduce((s, c) => s + num(c.displayAmount), 0)
  );
  const totalQtrAmt = customers.reduce((s, c) => s + calcQtrRebateAmount(c), 0);

  return (
    <table style={tableStyle({ marginBottom: sectionIdx > 0 ? '16px' : '0' })}>
      <thead>
        {/* Row 1 */}
        <tr>
          <th rowSpan={2} style={thStyle({ width: '28px' })}>#</th>
          <th rowSpan={2} style={thStyle({ width: '150px', textAlign: 'left' })}>DEALERS NAME</th>

          {items.map((_, ii) => (
            <React.Fragment key={`grp-${ii}`}>
              <th colSpan={quotaColsPerItem} style={thStyle({ fontSize: '8.5px' })}>
                {rebateName || rebateCode}
              </th>
              <th colSpan={actualCols} style={thStyle({ fontSize: '8px' })}>
                ACTUAL SALES
              </th>
              <th style={thStyle({ fontSize: '7.5px', width: '78px' })}>
                {monthRange} AMOUNT
              </th>
            </React.Fragment>
          ))}

          {showQtr && (
            <th colSpan={2} style={thStyle({ fontSize: '8px', width: '100px' })}>
              QTR REB
            </th>
          )}
        </tr>

        {/* Row 2 */}
        <tr>
          {items.map((_, ii) => (
            <React.Fragment key={`lbl-${ii}`}>
              {isIncremental
                ? ranges.map((r, ri) => (
                    <th key={`r-${ri}`} style={thStyle({ fontSize: '7.5px', width: '44px' })}>
                      ₱{r.rebatePerBag}/BAG<br />
                      <span style={{ fontWeight: 400, fontSize: '7px' }}>
                        ({r.minQty}{r.maxQty ? `-${r.maxQty}` : '+'} bags)
                      </span>
                    </th>
                  ))
                : quarterMonths.map((qm, mi) => (
                    <th key={`qm-${mi}`} style={thStyle({ fontSize: '7.5px', width: '38px' })}>
                      {qm.short}
                    </th>
                  ))
              }
              {quarterMonths.map((qm, mi) => (
                <th key={`am-${mi}`} style={thStyle({ fontSize: '7.5px', width: '40px' })}>
                  {qm.short}
                </th>
              ))}
              <th style={thStyle({ fontSize: '8px' })}>AMOUNT</th>
            </React.Fragment>
          ))}

          {showQtr && (
            <>
              <th style={thStyle({ fontSize: '7.5px', width: '50px' })}>{qtrLabel}</th>
              <th style={thStyle({ fontSize: '7.5px', width: '50px' })}>AMOUNT</th>
            </>
          )}
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
          <>
            {customers.map((cust, ci) => {
              const rowBg = ci % 2 === 0 ? '#ffffff' : '#f9fafb';
              const qtrAmt = calcQtrRebateAmount(cust);
              return (
                <tr key={cust.cardCode} style={{ background: rowBg }}>
                  <td style={tdStyle({ textAlign: 'center', color: '#6b7280' })}>{ci + 1}</td>
                  <td style={tdStyle({ fontWeight: 500, color: '#111827' })}>{cust.cardName}</td>

                  {items.map((_, ii) => (
                    <React.Fragment key={`b-${ii}`}>
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
                      {cust.monthlyActuals.map((ma, mi) => (
                        <td key={`ma-${mi}`} style={tdStyle({
                          textAlign: 'center',
                          color: ma.qty > 0 ? '#111827' : '#d1d5db',
                          fontWeight: ma.qty > 0 ? 500 : 400,
                        })}>
                          {ma.qty > 0 ? fmt(ma.qty) : '-'}
                        </td>
                      ))}
                      <td style={tdStyle({ textAlign: 'right', color: '#111827', fontWeight: 600 })}>
                        {cust.displayAmount > 0 ? fmtAmt(cust.displayAmount) : ''}
                      </td>
                    </React.Fragment>
                  ))}

                  {showQtr && (
                    <>
                      <td style={tdStyle({ textAlign: 'center', color: '#374151', fontWeight: 500 })}>
                        {calcQtrRebateRate(cust) > 0 ? fmt(calcQtrRebateRate(cust)) : ''}
                      </td>
                      <td style={tdStyle({ textAlign: 'right', color: '#111827', fontWeight: 600 })}>
                        {qtrAmt > 0 ? fmtAmt(qtrAmt) : ''}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}

            {/* ── TOTAL ROW ── */}
            <tr>
              <td style={totalTdStyle({ textAlign: 'center' })} />
              <td style={totalTdStyle({ textAlign: 'left' })} />

              {items.map((_, ii) => (
                <React.Fragment key={`tot-${ii}`}>
                  {isIncremental
                    ? ranges.map((_, ri) => (
                        <td key={`trv-${ri}`} style={totalTdStyle({})} />
                      ))
                    : quarterMonths.map((_, mi) => (
                        <td key={`tmq-${mi}`} style={totalTdStyle({})} />
                      ))
                  }
                  {quarterMonths.map((_, mi) => (
                    <td key={`tma-${mi}`} style={totalTdStyle({})} />
                  ))}
                  <td style={totalTdStyle({ textAlign: 'right' })}>
                    {totalAmountPerItem[ii] > 0 ? fmtAmt(totalAmountPerItem[ii]) : ''}
                  </td>
                </React.Fragment>
              ))}

              {showQtr && (
                <>
                  <td style={totalTdStyle({ textAlign: 'center' })} />
                  <td style={totalTdStyle({ textAlign: 'right' })}>
                    {totalQtrAmt > 0 ? fmtAmt(totalQtrAmt) : ''}
                  </td>
                </>
              )}
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MergedReportTable
   ═══════════════════════════════════════════════════════════════════════════ */
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

  const secMeta = sections.map((sec) => {
    const isInc      = sec.rebateType === 'Incremental';
    const quotaCols  = isInc ? sec.ranges.length : sec.quarterMonths.length;
    const actualCols = sec.quarterMonths.length;
    const showQtr    = !isInc && sectionHasQtrReb(sec);
    const qtrCols    = showQtr ? 2 : 0;
    const totalCols  = quotaCols + actualCols + 1 + qtrCols;
    const monthRange = buildMonthRange(sec.quarterMonths);
    const qtrLabel   = sectionQuarterShort(sec);
    return { ...sec, isInc, quotaCols, actualCols, qtrCols, showQtr, totalCols,
             color: secColor(), monthRange, qtrLabel };
  });

  const totalsPerSection = secMeta.map(sec => {
    const amountTotal = allCustomers.reduce(
      (s, cust) => s + num(cust.bySec[sec.rebateCode]?.displayAmount),
      0
    );
    const qtrAmtTotal = allCustomers.reduce(
      (s, cust) => s + calcQtrRebateAmount(cust.bySec[sec.rebateCode] || {}),
      0
    );
    return { amountTotal, qtrAmtTotal };
  });

  return (
    <table style={tableStyle()}>
      <thead>
        <tr>
          <th rowSpan={2} style={thStyle({ width: '28px' })}>#</th>
          <th rowSpan={2} style={thStyle({ width: '150px', textAlign: 'left' })}>DEALERS NAME</th>

          {secMeta.map(sec => (
            <React.Fragment key={`grp-${sec.rebateCode}`}>
              <th colSpan={sec.quotaCols} style={thStyle({ fontSize: '8.5px' })}>
                {sec.rebateName || sec.rebateCode}
              </th>
              <th colSpan={sec.actualCols} style={thStyle({ fontSize: '8px' })}>
                ACTUAL SALES
              </th>
              <th style={thStyle({ fontSize: '7.5px', width: '78px' })}>
                {sec.monthRange} AMOUNT
              </th>
              {sec.showQtr && (
                <th colSpan={2} style={thStyle({ fontSize: '8px', width: '100px' })}>
                  QTR REB
                </th>
              )}
            </React.Fragment>
          ))}
        </tr>

        <tr>
          {secMeta.map(sec => (
            <React.Fragment key={`lbl-${sec.rebateCode}`}>
              {sec.isInc
                ? sec.ranges.map((r, ri) => (
                    <th key={`r-${ri}`} style={thStyle({ fontSize: '7.5px', width: '46px' })}>
                      ₱{r.rebatePerBag}/BAG<br />
                      <span style={{ fontWeight: 400, fontSize: '7px' }}>
                        ({r.minQty}{r.maxQty ? `-${r.maxQty}` : '+'} bags)
                      </span>
                    </th>
                  ))
                : sec.quarterMonths.map((qm, mi) => (
                    <th key={`qm-${mi}`} style={thStyle({ fontSize: '7.5px', width: '38px' })}>
                      {qm.short}
                    </th>
                  ))
              }
              {sec.quarterMonths.map((qm, mi) => (
                <th key={`am-${mi}`} style={thStyle({ fontSize: '7.5px', width: '40px' })}>
                  {qm.short}
                </th>
              ))}
              <th style={thStyle({ fontSize: '8px' })}>AMOUNT</th>
              {sec.showQtr && (
                <>
                  <th style={thStyle({ fontSize: '7.5px', width: '50px' })}>{sec.qtrLabel}</th>
                  <th style={thStyle({ fontSize: '7.5px', width: '50px' })}>AMOUNT</th>
                </>
              )}
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
              <td style={tdStyle({ fontWeight: 500, color: '#111827' })}>{cust.cardName}</td>

              {secMeta.map(sec => {
                const cd = cust.bySec[sec.rebateCode];
                if (!cd) {
                  return (
                    <React.Fragment key={`e-${sec.rebateCode}`}>
                      {Array(sec.totalCols).fill(0).map((_, i) => (
                        <td key={i} style={tdStyle({ textAlign: 'center', color: '#d1d5db' })}>—</td>
                      ))}
                    </React.Fragment>
                  );
                }
                const qtrAmt = calcQtrRebateAmount(cd);
                return (
                  <React.Fragment key={`d-${sec.rebateCode}`}>
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
                        color: ma.qty > 0 ? '#111827' : '#d1d5db',
                        fontWeight: ma.qty > 0 ? 500 : 400,
                      })}>
                        {ma.qty > 0 ? fmt(ma.qty) : '-'}
                      </td>
                    ))}
                    <td style={tdStyle({ textAlign: 'right', color: '#111827', fontWeight: 600 })}>
                      {cd.displayAmount > 0 ? fmtAmt(cd.displayAmount) : ''}
                    </td>
                    {sec.showQtr && (
                      <>
                        <td style={tdStyle({ textAlign: 'center', color: '#374151', fontWeight: 500 })}>
                          {calcQtrRebateRate(cd) > 0 ? fmt(calcQtrRebateRate(cd)) : ''}
                        </td>
                        <td style={tdStyle({ textAlign: 'right', color: '#111827', fontWeight: 600 })}>
                          {qtrAmt > 0 ? fmtAmt(qtrAmt) : ''}
                        </td>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tr>
          );
        })}

        <tr>
          <td style={totalTdStyle({ textAlign: 'center' })} />
          <td style={totalTdStyle({ textAlign: 'left' })} />

          {secMeta.map((sec, si) => {
            const t = totalsPerSection[si];
            return (
              <React.Fragment key={`tot-${sec.rebateCode}`}>
                {sec.isInc
                  ? sec.ranges.map((_, ri) => (
                      <td key={`trv-${ri}`} style={totalTdStyle({})} />
                    ))
                  : sec.quarterMonths.map((_, mi) => (
                      <td key={`tmq-${mi}`} style={totalTdStyle({})} />
                    ))
                }
                {sec.quarterMonths.map((_, mi) => (
                  <td key={`tma-${mi}`} style={totalTdStyle({})} />
                ))}
                <td style={totalTdStyle({ textAlign: 'right' })}>
                  {t.amountTotal > 0 ? fmtAmt(t.amountTotal) : ''}
                </td>
                {sec.showQtr && (
                  <>
                    <td style={totalTdStyle({ textAlign: 'center' })} />
                    <td style={totalTdStyle({ textAlign: 'right' })}>
                      {t.qtrAmtTotal > 0 ? fmtAmt(t.qtrAmtTotal) : ''}
                    </td>
                  </>
                )}
              </React.Fragment>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
};

const sectionsShareCustomers = (sections) => {
  if (sections.length < 2) return false;
  const codesInFirst = new Set(sections[0].customers.map(c => c.cardCode));
  return sections.slice(1).some(sec =>
    sec.customers.some(c => codesInFirst.has(c.cardCode))
  );
};

/* ─── Canvas slicing helper ─────────────────────────────────────────────── */
const sliceCanvas = (src, sy, sh) => {
  const syR = Math.max(0, Math.round(sy));
  const h   = Math.max(1, Math.min(Math.round(sh), src.height - syR));
  const out = document.createElement('canvas');
  out.width  = src.width;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, syR, src.width, h, 0, 0, src.width, h);
  return out;
};

/* ─── PrintableReport — one page canvas: 8.5×13in landscape ───────────── */
const PrintableReport = React.forwardRef(({ sections, userName }, ref) => {
  if (!sections || !sections.length) return null;
  const first = sections[0];
  const merged = sectionsShareCustomers(sections);

  const dynamicSignatories = SIGNATORIES.map(sig => {
    if (sig.label === 'Prepared by:') {
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
          : sig.name,
      };
    }
    return sig;
  });

  return (
    <div
      ref={ref}
      style={{
        width: `${PAPER_W_PX}px`,          // 13 in
        minHeight: `${PAPER_H_PX}px`,      // 8.5 in
        background: '#ffffff',
        padding: '28px 32px',
        boxSizing: 'border-box',
        fontFamily: 'Arial, Helvetica, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── HEADER BLOCK ─────────────────────────────────────────────── */}
      <div data-pdf="header" style={{ flex: '0 0 auto' }}>
        <div style={{ textAlign: 'left', marginBottom: '-20px', marginTop: '-40px', marginLeft: '-20px' }}>
          <img src={vanLogo} alt="VAN" style={{ width: '100px', height: 'auto', objectFit: 'contain' }} />
        </div>

        <div style={{ marginBottom: '12px', fontSize: '10px', color: '#374151' }}>
          <div><strong>MCC:</strong> {first.salesEmployee || '_______________'}</div>
          <div><strong>AREA:</strong> </div>
          <div><strong>PERIOD:</strong> {first.quarterDisplay}</div>
        </div>

        <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a5f', letterSpacing: '0.04em', marginBottom: '10px' }}>
          SALES PROGRAM REBATE MONITORING
        </div>
      </div>

      {/* ── BODY (paginated) ─────────────────────────────────────────── */}
      <div data-pdf="body" style={{ flex: '0 0 auto' }}>
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
      </div>

      {/* ── SIGNATORIES (pinned to bottom of last page) ──────────────── */}
      <div
        data-pdf="signatories"
        style={{
          marginTop: 'auto',
          paddingTop: '24px',
          flex: '0 0 auto',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'flex-end' }}>
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

        <div style={{ marginTop: '14px', textAlign: 'right', fontSize: '7px', color: '#d1d5db' }}>
          Generated: {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   RebateSelector
   ═══════════════════════════════════════════════════════════════════════════ */
const RebateSelector = ({ rebates, selected, onToggle, onClear, isDark, K, fontStack, monoStack }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = rebates.filter(r =>
    r.rebateCode.toLowerCase().includes(search.toLowerCase()) ||
    (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
    r.rebateType.toLowerCase().includes(search.toLowerCase())
  );

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

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    background: K.glass,
    border: `1px solid ${K.hairline}`,
    borderRadius: 12, fontSize: 13,
    color: K.ink, fontFamily: fontStack,
    outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...inputStyle,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          textAlign: 'left', cursor: 'pointer',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected.length === 0
            ? 'Select Rebate Code(s)…'
            : selected.length === 1
              ? `${selected[0].rebateCode} — ${selected[0].rebateType}`
              : `${selected.length} rebate codes selected`}
        </span>
        {open ? <ChevronUp size={14} color={K.faint} /> : <ChevronDown size={14} color={K.faint} />}
      </button>

      {open && (
        <div
          className="dash-glass dash-pop"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
            width: '100%',
            background: K.glassDeep,
            border: `1px solid ${K.rim}`,
            borderRadius: 16, boxShadow: K.shadow,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${K.hairline}` }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} color={K.faint} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search rebate codes…"
                style={{
                  width: '100%', padding: '7px 10px 7px 28px',
                  background: K.chipBg,
                  border: `1px solid ${K.hairline}`,
                  borderRadius: 10, fontSize: 12,
                  color: K.ink, fontFamily: fontStack,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {selected.length > 0 && (
            <button
              onClick={() => { onClear(); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '8px 12px', fontSize: 12, fontWeight: 500,
                color: APPLE.red, background: 'transparent',
                border: 'none', cursor: 'pointer', fontFamily: fontStack,
                borderBottom: `1px solid ${K.hairline}`,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = `${APPLE.red}14`}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              ✕ Clear all ({selected.length})
            </button>
          )}

          <div style={{ maxHeight: 240, overflowY: 'auto' }} className="dash-scroll">
            {filtered.length === 0 ? (
              <p style={{ padding: '16px 12px', fontSize: 12, textAlign: 'center', color: K.muted, margin: 0 }}>
                No rebates found
              </p>
            ) : (
              filtered.map(r => {
                const checked = selected.some(s => s.rebateCode === r.rebateCode);
                const typePill =
                  r.rebateType === 'Fixed'       ? { bg: `${APPLE.green}1c`, fg: APPLE.green } :
                  r.rebateType === 'Incremental' ? { bg: `${APPLE.orange}1c`, fg: APPLE.orange } :
                                                    { bg: `${APPLE.purple}1c`, fg: APPLE.purple };
                return (
                  <button
                    key={r.rebateCode}
                    type="button"
                    onClick={() => onToggle(r)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', textAlign: 'left',
                      background: checked ? `${APPLE.blue}14` : 'transparent',
                      border: 'none', cursor: 'pointer', transition: 'background 0.15s',
                      fontFamily: fontStack,
                    }}
                    onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = K.chipBg; }}
                    onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: 16, height: 16, flexShrink: 0,
                      border: `1.5px solid ${checked ? APPLE.blue : K.hairline}`,
                      borderRadius: 5,
                      background: checked ? APPLE.blue : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {checked && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: K.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.rebateCode}
                      </div>
                      <div style={{ fontSize: 11, color: K.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.rebateType} • {r.dateFrom ? new Date(r.dateFrom).toLocaleDateString('en-PH', { year: 'numeric', month: 'short' }) : '—'}
                        {r.dateFrom && r.dateTo ? ` – ${new Date(r.dateTo).toLocaleDateString('en-PH', { year: 'numeric', month: 'short' })}` : ''}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 999,
                      background: typePill.bg, color: typePill.fg,
                      fontWeight: 600, flexShrink: 0, fontFamily: monoStack,
                    }}>
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

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Van_Reports() {
  useEffect(() => { injectFonts(); }, []);

  const { theme, updateTheme } = useTheme();
  const routePath = '/Van_Reports';
  const reportRef = useRef(null);

  const isDark = theme === 'dark';
  const K = dashTokens(isDark);
  const fontStack = "'Outfit', system-ui, sans-serif";
  const monoStack = "'DM Mono', monospace";

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

  const [availableCustomers, setAvailableCustomers]       = useState([]);
  const [selectedCustomers, setSelectedCustomers]         = useState([]);
  const [tempSelectedCustomers, setTempSelectedCustomers] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown]   = useState(false);
  const [customersLoading, setCustomersLoading]           = useState(false);

  const { access, accessLoading } = useAccessControl(routePath);

  useComponentRegistration({
    name: 'Van_Reports', version: '3.1.0',
    description: 'Sales Program Rebate Monitoring Report',
    routePath,
  });

  const filteredReportSections = React.useMemo(() => {
    if (!reportSections.length) return [];
    if (!selectedCustomers.length) return [];
    const allowedCodes = new Set(selectedCustomers.map(c => c.CardCode));
    return reportSections.map(section => ({
      ...section,
      customers: section.customers.filter(cust => allowedCodes.has(cust.cardCode)),
    })).filter(section => section.customers.length > 0);
  }, [reportSections, selectedCustomers]);

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
        const promises = selectedRebates.map(r =>
          fetch(`${API_BASE}/van/report/rebate/${r.rebateCode}/customers?db=${REPORT_DB}`).then(res => res.json())
        );
        const results = await Promise.all(promises);

        const customerMap = new Map();
        results.forEach(result => {
          if (result.success && result.data) {
            result.data.forEach(cust => {
              if (cust.CardCode && !customerMap.has(cust.CardCode)) {
                customerMap.set(cust.CardCode, { CardCode: cust.CardCode, CardName: cust.CardName });
              }
            });
          }
        });

        const uniqueCustomers = Array.from(customerMap.values()).sort((a, b) =>
          a.CardName.localeCompare(b.CardName)
        );
        setAvailableCustomers(uniqueCustomers);
        setSelectedCustomers(uniqueCustomers);
        setTempSelectedCustomers(uniqueCustomers);
      } catch (e) {
        console.error('Failed to fetch customers:', e);
      } finally {
        setCustomersLoading(false);
      }
    };
    fetchCustomers();
  }, [selectedRebates]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showCustomerDropdown && !e.target.closest('.customer-dropdown-container')) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomerDropdown]);

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

  const periodLabel = useCallback(() => {
    if (!selectedRebates.length) return '';
    const r = selectedRebates.find(r => r.dateFrom);
    if (!r) return '';
    return qLabel(qFromDate(r.dateFrom), yFromDate(r.dateFrom));
  }, [selectedRebates]);

  const toggleRebate = useCallback((r) => {
    setSelectedRebates(prev => {
      const exists = prev.some(s => s.rebateCode === r.rebateCode);
      return exists ? prev.filter(s => s.rebateCode !== r.rebateCode) : [...prev, r];
    });
  }, []);

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

  const filename = (ext) => {
    const d = new Date().toISOString().split('T')[0].replace(/-/g, '');
    return `REBATE_MONITORING_${d}.${ext}`;
  };

  /* ═══════════════════════════════════════════════════════════════════════
     PDF EXPORT
     • Paper: 8.5 × 13 in (long bond / folio) in LANDSCAPE  → 13 × 8.5 in
     • Content is NOT stretched to fill page height.
     • Row-safe pagination: as soon as the next table row would not fit,
       a new page starts.
     • Signatories are pinned to the bottom of the LAST page.
     ═══════════════════════════════════════════════════════════════════════ */
  const exportToPDF = async () => {
    const root = reportRef.current;
    if (!root) return;

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'in',
      format: [PAPER_W_IN, PAPER_H_IN],   // 13 x 8.5 in (landscape)
    });

    const pgW = pdf.internal.pageSize.getWidth();   // 13 in
    const pgH = pdf.internal.pageSize.getHeight();  // 8.5 in

    try {
      const rootRect = root.getBoundingClientRect();

      const canvas = await html2canvas(root, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      const effScale   = canvas.width / (rootRect.width || 1);
      const inPerPx    = pgW / canvas.width;          // canvas px → inches
      const pxToCanvas = (v) => v * effScale;

      const bodyEl = root.querySelector('[data-pdf="body"]');
      const sigEl  = root.querySelector('[data-pdf="signatories"]');
      const headEl = root.querySelector('[data-pdf="header"]');

      let contentEnd = canvas.height;
      if (bodyEl) {
        contentEnd = Math.round(pxToCanvas(bodyEl.getBoundingClientRect().bottom - rootRect.top));
      }
      contentEnd = Math.max(1, Math.min(contentEnd, canvas.height));

      /* ── Collect safe break boundaries (bottom edge of each table row) ── */
      const boundSet = new Set();
      root.querySelectorAll('tr').forEach((tr) => {
        const b = pxToCanvas(tr.getBoundingClientRect().bottom - rootRect.top);
        if (b > 2 && b < contentEnd - 2) boundSet.add(Math.round(b));
      });
      if (headEl) {
        const b = pxToCanvas(headEl.getBoundingClientRect().bottom - rootRect.top);
        if (b > 2 && b < contentEnd - 2) boundSet.add(Math.round(b));
      }
      const bounds = [...boundSet].sort((a, b) => a - b);

      /* ── Paginate body ── */
      const pages = [];
      let cursor  = 0;
      let pageIdx = 0;
      let guard   = 0;

      const availablePx = (i) =>
        (i === 0 ? pgH : pgH - PAGE_PAD_IN * 2) / inPerPx;

      while (cursor < contentEnd - 2 && guard++ < 400) {
        const limit = cursor + availablePx(pageIdx);

        if (limit >= contentEnd - 2) {
          pages.push({ start: cursor, end: contentEnd, top: pageIdx === 0 ? 0 : PAGE_PAD_IN });
          cursor = contentEnd;
          break;
        }

        let best = null;
        for (const b of bounds) {
          if (b <= cursor + 2) continue;
          if (b > limit) break;
          best = b;
        }

        const end = best != null ? best : Math.floor(limit);
        pages.push({ start: cursor, end, top: pageIdx === 0 ? 0 : PAGE_PAD_IN });
        cursor  = end;
        pageIdx++;
      }

      if (!pages.length) pages.push({ start: 0, end: contentEnd, top: 0 });

      /* ── Grab signatories as separate image ── */
      let sigCanvas   = null;
      let sigHeightIn = 0;

      if (sigEl) {
        const r      = sigEl.getBoundingClientRect();
        const top    = Math.max(0, Math.round(pxToCanvas(r.top - rootRect.top)));
        const bottom = Math.min(canvas.height, Math.round(pxToCanvas(r.bottom - rootRect.top)));
        const h      = bottom - top;
        if (h > 4) {
          sigCanvas   = sliceCanvas(canvas, top, h);
          sigHeightIn = sigCanvas.height * inPerPx;
        }
      }

      /* ── Will signatories fit on the last content page? ── */
      let sigNeedsOwnPage = false;
      if (sigCanvas) {
        const last        = pages[pages.length - 1];
        const lastContentIn = (last.end - last.start) * inPerPx + (last.top || 0);
        if (lastContentIn + sigHeightIn + PAGE_PAD_IN > pgH) sigNeedsOwnPage = true;
      }

      /* ── Render content pages ── */
      pages.forEach((pg, i) => {
        if (i > 0) pdf.addPage();
        const hIn   = (pg.end - pg.start) * inPerPx;
        const slice = sliceCanvas(canvas, pg.start, pg.end - pg.start);
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, pg.top, pgW, hIn, undefined, 'FAST');
      });

      /* ── Render signatories on bottom of last page ── */
      if (sigCanvas) {
        if (sigNeedsOwnPage) pdf.addPage();
        const yPos = Math.max(pgH - sigHeightIn - PAGE_PAD_IN, 0);
        pdf.addImage(sigCanvas.toDataURL('image/png'), 'PNG', 0, yPos, pgW, sigHeightIn, undefined, 'FAST');
      }

      pdf.save(filename('pdf'));
    } catch (e) {
      console.error(e);
      alert('PDF export failed.');
    }
  };

  const exportToExcel = () => {
    if (!reportSections.length) return;
    const wb = XLSX.utils.book_new();
    reportSections.forEach(section => {
      const { rebateCode, rebateType, quarterDisplay, customers, items, ranges, quarterMonths } = section;
      const showQtr = sectionHasQtrReb(section);
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
      h1.push('AMOUNT');
      if (showQtr) h1.push('QTR REB', 'QTR AMOUNT');
      rows.push(h1);

      let amountTotal = 0;
      let qtrAmtTotal = 0;

      customers.forEach((c, ci) => {
        const row = [ci + 1, c.cardName];
        items.forEach(() => {
          row.push(c.prevAvg || '');
          if (rebateType === 'Incremental') ranges.forEach(r => row.push(r.minQty));
          else                              c.monthlyQuotas.forEach(mq => row.push(mq.targetQty || ''));
        });
        c.monthlyActuals.forEach(ma => row.push(ma.qty || ''));
        row.push(c.displayAmount || '');
        amountTotal += num(c.displayAmount);

        if (showQtr) {
          const qa = calcQtrRebateAmount(c);
          row.push(calcQtrRebateRate(c) || '', qa || '');
          qtrAmtTotal += qa;
        }
        rows.push(row);
      });

      const totRow = ['', ''];
      items.forEach(() => {
        totRow.push('');
        if (rebateType === 'Incremental') ranges.forEach(() => totRow.push(''));
        else                              quarterMonths.forEach(() => totRow.push(''));
      });
      quarterMonths.forEach(() => totRow.push(''));
      totRow.push(amountTotal || '');
      if (showQtr) totRow.push('', qtrAmtTotal || '');
      rows.push(totRow);

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

  const customerCount = reportSections.length
    ? (sectionsShareCustomers(reportSections)
        ? (() => { const s = new Set(); reportSections.forEach(sec => sec.customers.forEach(c => s.add(c.cardCode))); return s.size; })()
        : reportSections.reduce((s, sec) => s + sec.customers.length, 0))
    : 0;

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
        <Header collapsed={collapsed} userName={userName} userCode={userCode} initials={initials} logo={vanLogo} theme={theme} />
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${K.hairline}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 14,
                  background: `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 16px -4px ${APPLE.blue}88`, flexShrink: 0,
                }}>
                  <BarChart2 size={22} color="#fff" />
                </div>
                <div>
                  <h1 style={{ fontSize: 17, fontWeight: 700, color: K.ink, margin: 0, letterSpacing: '-0.01em' }}>
                    Rebate Monitoring Report
                  </h1>
                  <p style={{ fontSize: 12, color: K.muted, margin: '3px 0 0', fontWeight: 400 }}>
                    Sales Program Rebate Monitoring per Quarter
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
                {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            {accessLoading ? renderAccessLoading() : !access.canView ? (
              <AccessDenied
                useTokens={true}
                tokens={{...K, accent: APPLE.blue, accentHover: APPLE.blue, accentLight: `${APPLE.blue}14`, text: K.ink, textMuted: K.muted, textSub: K.muted, success: APPLE.green, error: APPLE.red, errorBg: `${APPLE.red}14`, gold: APPLE.orange, goldLight: `${APPLE.orange}14`, teal: APPLE.blue, tealLight: `${APPLE.blue}14`, cardBg: K.glass, cardBorder: K.hairline, inputBg: K.glass, inputBorder: K.hairline, bg: K.bg, fontStack }}
                message="You don't have permission to view this page. Contact your administrator for access."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="nx-btn-primary"
                      onClick={generateReport}
                      disabled={loading || !selectedRebates.length || !access.canCreate}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                        border: 'none',
                        cursor: (access.canCreate && !loading && selectedRebates.length) ? 'pointer' : 'not-allowed',
                        background: (access.canCreate && !loading && selectedRebates.length)
                          ? `linear-gradient(155deg, ${APPLE.blue} 0%, ${APPLE.purple} 100%)`
                          : K.chipBg,
                        color: (access.canCreate && !loading && selectedRebates.length) ? '#fff' : K.faint,
                        opacity: (access.canCreate && !loading && selectedRebates.length) ? 1 : 0.6,
                        transition: 'all 0.2s',
                        boxShadow: (access.canCreate && !loading && selectedRebates.length)
                          ? `0 4px 16px -6px ${APPLE.blue}88`
                          : 'none',
                        fontFamily: fontStack,
                      }}
                    >
                      {loading ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Zap size={14} />}
                      {loading ? 'Generating…' : 'Generate Report'}
                    </button>

                    {showReport && (
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
                      disabled={!access.canExport || !showReport || !reportSections.length}
                      onClick={() => { if (access.canExport && showReport && reportSections.length) setShowExportDropdown(v => !v); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '9px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                        border: `1px solid ${(access.canExport && showReport && reportSections.length) ? `${APPLE.blue}55` : K.hairline}`,
                        background: (access.canExport && showReport && reportSections.length) ? `${APPLE.blue}1c` : K.chipBg,
                        color: (access.canExport && showReport && reportSections.length) ? APPLE.blue : K.faint,
                        cursor: (access.canExport && showReport && reportSections.length) ? 'pointer' : 'not-allowed',
                        opacity: (access.canExport && showReport && reportSections.length) ? 1 : 0.5,
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
                          { label: 'PNG Image',      ext: 'png',  icon: <Image size={15} color={APPLE.purple} />,           fn: exportToPNG   },
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

                <div
                  className="dash-glass"
                  style={{
                    position: 'relative',
                    zIndex: 40,
                    background: K.glass,
                    border: `1px solid ${K.hairline}`,
                    borderRadius: 18,
                    padding: '20px 22px',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1fr', gap: 18 }}>
                    <div>
                      <label style={labelStyle}><Tag size={12} color={APPLE.blue} /> Rebate Code(s)</label>
                      <RebateSelector
                        rebates={availableRebates}
                        selected={selectedRebates}
                        onToggle={toggleRebate}
                        onClear={() => setSelectedRebates([])}
                        isDark={isDark}
                        K={K}
                        fontStack={fontStack}
                        monoStack={monoStack}
                      />
                      {selectedRebates.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {selectedRebates.map(r => (
                            <span key={r.rebateCode} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '3px 10px', borderRadius: 999,
                              fontSize: 11, fontWeight: 600,
                              background: `${APPLE.blue}14`, color: APPLE.blue,
                              fontFamily: monoStack,
                            }}>
                              {r.rebateCode} ({r.rebateType[0]})
                              <button
                                onClick={() => toggleRebate(r)}
                                style={{
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  display: 'inline-flex', padding: 0, color: 'inherit',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = APPLE.red}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'inherit'}
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

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
                        disabled={!selectedRebates.length || customersLoading}
                        style={{
                          ...inputStyle,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          textAlign: 'left',
                          cursor: (!selectedRebates.length || customersLoading) ? 'not-allowed' : 'pointer',
                          opacity: (!selectedRebates.length || customersLoading) ? 0.6 : 1,
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {customersLoading
                            ? 'Loading customers…'
                            : selectedCustomers.length === 0
                              ? 'No customers'
                              : selectedCustomers.length === availableCustomers.length
                                ? `All customers (${selectedCustomers.length})`
                                : `${selectedCustomers.length} selected`}
                        </span>
                        {customersLoading
                          ? <RefreshCw size={14} color={K.faint} style={{ animation: 'spin 0.8s linear infinite' }} />
                          : <ChevronDown size={14} color={K.faint} />}
                      </button>

                      {showCustomerDropdown && availableCustomers.length > 0 && (
                        <div
                          className="dash-glass dash-pop"
                          style={{
                            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                            width: '100%', maxHeight: 260, overflowY: 'auto',
                            background: K.glassDeep,
                            border: `1px solid ${K.rim}`,
                            borderRadius: 16,
                            boxShadow: K.shadow,
                            zIndex: 9999, padding: '6px 0',
                          }}
                        >
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

                    <div>
                      <label style={labelStyle}><Calendar size={12} color={APPLE.blue} /> Report Period</label>
                      <div style={{
                        ...inputStyle,
                        display: 'flex', alignItems: 'center',
                        color: periodLabel() ? K.ink : K.muted,
                        fontStyle: periodLabel() ? 'normal' : 'italic',
                        fontSize: 12,
                      }}>
                        {periodLabel() || 'Auto-detected from rebate code'}
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 14,
                    background: `${APPLE.red}14`, border: `1px solid ${APPLE.red}33`,
                    color: APPLE.red, fontSize: 13, fontWeight: 500,
                  }}>
                    <XCircle size={15} /> {error}
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
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: K.ink, margin: '0 0 6px' }}>Generating Monitoring Report</h3>
                        <p style={{ fontSize: 12, color: K.muted, margin: 0 }}>
                          Fetching sales data for <span style={{ fontWeight: 700, color: APPLE.blue }}>{selectedRebates.length} rebate code{selectedRebates.length !== 1 ? 's' : ''}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!loading && showReport && filteredReportSections.length > 0 && (
                  <div className="dash-glass" style={{ background: K.glass, border: `1px solid ${K.hairline}`, borderRadius: 18, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <CheckCircle size={15} color={APPLE.green} />
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: K.ink, margin: 0 }}>Report Preview</h3>
                        <span style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: `${APPLE.blue}14`, color: APPLE.blue,
                          fontFamily: monoStack,
                        }}>
                          {customerCount} customer{customerCount !== 1 ? 's' : ''}
                        </span>
                        {sectionsShareCustomers(reportSections) && (
                          <span style={{
                            padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                            background: `${APPLE.green}14`, color: APPLE.green,
                          }}>
                            Merged view
                          </span>
                        )}
                        <span style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                          background: `${APPLE.orange}14`, color: APPLE.orange,
                          fontFamily: monoStack,
                        }}>
                          8.5" × 13" · Landscape
                        </span>
                      </div>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                        background: K.chipBg, color: K.muted,
                        fontFamily: monoStack,
                      }}>
                        {reportSections[0]?.quarterDisplay}
                      </span>
                    </div>

                    <div
                      className="dash-scroll"
                      style={{
                        overflowX: 'auto', overflowY: 'auto',
                        background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
                        borderRadius: 14,
                        padding: '24px',
                        maxHeight: '70vh',
                      }}
                    >
                      <div style={{ width: `${PAPER_W_PX}px`, margin: '0 auto', boxShadow: '0 8px 30px -8px rgba(0,0,0,0.25)', borderRadius: 4, overflow: 'hidden' }}>
                        <PrintableReport ref={reportRef} sections={reportSections} userName={userName} />
                      </div>
                    </div>
                  </div>
                )}

                {!loading && !showReport && !error && (
                  <div className="dash-glass" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', minHeight: 280,
                    borderRadius: 18,
                    border: `2px dashed ${K.hairline}`,
                    background: K.glass,
                  }}>
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: `${APPLE.blue}1c`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BarChart2 size={24} color={APPLE.blue} />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: K.ink, margin: '0 0 4px' }}>No report generated yet</p>
                        <p style={{ fontSize: 12, color: K.muted, margin: 0 }}>
                          Select <strong style={{ color: APPLE.blue }}>rebate code(s)</strong>, then click{' '}
                          <strong style={{ color: APPLE.blue }}>Generate Report</strong>
                        </p>
                      </div>
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