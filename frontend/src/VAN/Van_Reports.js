// src/pages/Van_Reports.jsx — Rebate Sales Program Monitoring Report
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
import { useComponentRegistration } from '../hooks/useComponentRegistration';
import useAccessControl from '../hooks/useAccessControl';
import vanLogo from '../assets/van.png';
import { API_BASE, DB_NAME } from '../config/appConfig';

/* ── Design system ──────────────────────────────────────────────── */
import { PALETTE, useTokens, DesignPage } from '../design-system';

const REPORT_DB = 'VAN';

/* ─── Paper geometry — 8.5 x 13 in (long bond / folio), LANDSCAPE ─────── */
const PAPER_W_IN   = 13;
const PAPER_H_IN   = 8.5;
const PAPER_W_PX   = Math.round(PAPER_W_IN * 96);
const PAPER_H_PX   = Math.round(PAPER_H_IN * 96);
const PAGE_PAD_IN  = 0.15;

/* ─── Quarter helpers ───────────────────────────────────────────────────── */
const QTR_NAMES  = ['1ST QUARTER','2ND QUARTER','3RD QUARTER','4TH QUARTER'];
const QTR_SHORT  = ['1ST QTR','2ND QTR','3RD QTR','4TH QTR'];
const QTR_RANGES = ['JAN - MAR','APR - JUN','JUL - SEP','OCT - DEC'];
const qFromDate  = (d) => { const m = new Date(d).getMonth(); return Math.floor(m / 3) + 1; };
const yFromDate  = (d) => new Date(d).getFullYear();
const qLabel     = (q, y) => `${QTR_NAMES[q-1]} ${y} (${QTR_RANGES[q-1]})`;
const qShort     = (q) => QTR_SHORT[q-1] || '';

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

const SIGNATORIES = [
  { name: 'RAQUEL RODRIGUEZ',  title: 'Marketing Associate',        label: 'Prepared by:' },
  { name: 'TESSIE CADACIO',    title: 'Marketing Supervisor',       label: 'Checked by:' },
  { name: 'RAYMOND MARTICIO',  title: 'Market Channel Coordinator', label: '\u00A0' },
  { name: 'MARCO LAGANZO',     title: 'District Manager',           label: 'Reviewed by:' },
  { name: 'LITO C. NUELAS',    title: 'District Manager - Field',   label: 'Noted by:' },
  { name: 'JERALD S. LO',      title: 'General Manager',            label: 'Approved by:' },
];

const fmt    = (n) => (n == null || isNaN(n)) ? '' : Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtAmt = (n) => (n == null || isNaN(n) || n === 0) ? '' : `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const num    = (n) => (n == null || isNaN(n)) ? 0 : Number(n);

/* ─── Report table style constants (used ONLY inside the printable PDF) ── */
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
   ReportTable — LAYOUT INTENTIONAL: ALL INLINE (used for PDF/PNG export)
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

            <tr>
              <td style={totalTdStyle({ textAlign: 'center' })} />
              <td style={totalTdStyle({ textAlign: 'left' })} />

              {items.map((_, ii) => (
                <React.Fragment key={`tot-${ii}`}>
                  {isIncremental
                    ? ranges.map((_, ri) => (<td key={`trv-${ri}`} style={totalTdStyle({})} />))
                    : quarterMonths.map((_, mi) => (<td key={`tmq-${mi}`} style={totalTdStyle({})} />))
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
                  ? sec.ranges.map((_, ri) => (<td key={`trv-${ri}`} style={totalTdStyle({})} />))
                  : sec.quarterMonths.map((_, mi) => (<td key={`tmq-${mi}`} style={totalTdStyle({})} />))
                }
                {sec.quarterMonths.map((_, mi) => (<td key={`tma-${mi}`} style={totalTdStyle({})} />))}
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

/* ─── PrintableReport — LAYOUT INTENTIONAL: ALL INLINE (PDF/PNG canvas) ── */
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
        width: `${PAPER_W_PX}px`,
        minHeight: `${PAPER_H_PX}px`,
        background: '#ffffff',
        padding: '28px 32px',
        boxSizing: 'border-box',
        fontFamily: 'Arial, Helvetica, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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

      <div
        data-pdf="signatories"
        style={{ marginTop: 'auto', paddingTop: '24px', flex: '0 0 auto' }}
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
   RebateSelector — self-contained, uses useTokens()
   ═══════════════════════════════════════════════════════════════════════════ */
const RebateSelector = ({ rebates, selected, onToggle, onClear }) => {
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-[9px] rounded-xl text-[13px] flex items-center justify-between text-left cursor-pointer outline-none transition-colors bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)]"
      >
        <span className="truncate">
          {selected.length === 0
            ? 'Select Rebate Code(s)…'
            : selected.length === 1
              ? `${selected[0].rebateCode} — ${selected[0].rebateType}`
              : `${selected.length} rebate codes selected`}
        </span>
        {open
          ? <ChevronUp size={14} className="text-[var(--ds-faint)]" />
          : <ChevronDown size={14} className="text-[var(--ds-faint)]" />}
      </button>

      {open && (
        <div className="ds-glass ds-pop absolute top-[calc(100%+6px)] left-0 z-[9999] w-full bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] rounded-2xl shadow-[var(--ds-shadow)] overflow-hidden">
          <div className="px-2.5 py-2 border-b border-[var(--ds-hairline)]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-faint)]" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search rebate codes…"
                className="w-full pl-7 pr-2.5 py-[7px] rounded-[10px] text-[12px] outline-none bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)] text-[var(--ds-ink)]"
              />
            </div>
          </div>

          {selected.length > 0 && (
            <button
              onClick={() => { onClear(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-[12px] font-medium text-[#FF453A] bg-transparent border-none cursor-pointer border-b border-[var(--ds-hairline)] hover:bg-[#FF453A]/8 transition-colors"
            >
              ✕ Clear all ({selected.length})
            </button>
          )}

          <div className="max-h-[240px] overflow-y-auto ds-scroll">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-[12px] text-center text-[var(--ds-muted)] m-0">
                No rebates found
              </p>
            ) : (
              filtered.map(r => {
                const checked = selected.some(s => s.rebateCode === r.rebateCode);
                const typePill =
                  r.rebateType === 'Fixed'       ? { bg: 'bg-[#32D74B]/11', fg: 'text-[#32D74B]' } :
                  r.rebateType === 'Incremental' ? { bg: 'bg-[#FF9F0A]/11', fg: 'text-[#FF9F0A]' } :
                                                    { bg: 'bg-[#BF5AF2]/11', fg: 'text-[#BF5AF2]' };
                return (
                  <button
                    key={r.rebateCode}
                    type="button"
                    onClick={() => onToggle(r)}
                    className={`w-full flex items-center gap-2.5 px-3 py-[9px] text-left border-none cursor-pointer transition-colors ${
                      checked ? 'bg-[#0A84FF]/8' : 'hover:bg-[var(--ds-chip-bg)]'
                    }`}
                  >
                    <div className={`w-4 h-4 flex-shrink-0 rounded-[5px] flex items-center justify-center border-[1.5px] ${
                      checked ? 'bg-[#0A84FF] border-[#0A84FF]' : 'bg-transparent border-[var(--ds-hairline)]'
                    }`}>
                      {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-[var(--ds-ink)] truncate">
                        {r.rebateCode}
                      </div>
                      <div className="text-[11px] text-[var(--ds-muted)] truncate">
                        {r.rebateType} • {r.dateFrom ? new Date(r.dateFrom).toLocaleDateString('en-PH', { year: 'numeric', month: 'short' }) : '—'}
                        {r.dateFrom && r.dateTo ? ` – ${new Date(r.dateTo).toLocaleDateString('en-PH', { year: 'numeric', month: 'short' })}` : ''}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ds-font-mono ${typePill.bg} ${typePill.fg}`}>
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
  const { theme, updateTheme, K } = useTokens();
  const routePath = '/Van_Reports';
  const reportRef = useRef(null);

  const fontStack = "'Outfit', system-ui, sans-serif";

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

  /* ── PDF export — kept verbatim ───────────────────────────────────── */
  const exportToPDF = async () => {
    const root = reportRef.current;
    if (!root) return;

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'in',
      format: [PAPER_W_IN, PAPER_H_IN],
    });

    const pgW = pdf.internal.pageSize.getWidth();
    const pgH = pdf.internal.pageSize.getHeight();

    try {
      const rootRect = root.getBoundingClientRect();

      const canvas = await html2canvas(root, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
        scrollX: 0, scrollY: 0,
      });

      const effScale   = canvas.width / (rootRect.width || 1);
      const inPerPx    = pgW / canvas.width;
      const pxToCanvas = (v) => v * effScale;

      const bodyEl = root.querySelector('[data-pdf="body"]');
      const sigEl  = root.querySelector('[data-pdf="signatories"]');
      const headEl = root.querySelector('[data-pdf="header"]');

      let contentEnd = canvas.height;
      if (bodyEl) {
        contentEnd = Math.round(pxToCanvas(bodyEl.getBoundingClientRect().bottom - rootRect.top));
      }
      contentEnd = Math.max(1, Math.min(contentEnd, canvas.height));

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

      const pages = [];
      let cursor  = 0;
      let pageIdx = 0;
      let guard   = 0;

      const availablePx = (i) => (i === 0 ? pgH : pgH - PAGE_PAD_IN * 2) / inPerPx;

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

      let sigNeedsOwnPage = false;
      if (sigCanvas) {
        const last        = pages[pages.length - 1];
        const lastContentIn = (last.end - last.start) * inPerPx + (last.top || 0);
        if (lastContentIn + sigHeightIn + PAGE_PAD_IN > pgH) sigNeedsOwnPage = true;
      }

      pages.forEach((pg, i) => {
        if (i > 0) pdf.addPage();
        const hIn   = (pg.end - pg.start) * inPerPx;
        const slice = sliceCanvas(canvas, pg.start, pg.end - pg.start);
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, pg.top, pgW, hIn, undefined, 'FAST');
      });

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

  /* ── Excel export — kept verbatim ─────────────────────────────────── */
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

  /* ── Shared Tailwind classes ─────────────────────────────────────── */
  const inputClasses = "w-full px-3 py-[9px] rounded-xl text-[13px] outline-none transition-colors bg-[var(--ds-glass)] border border-[var(--ds-hairline)] text-[var(--ds-ink)] focus:border-[#0A84FF] focus:shadow-[0_0_0_3px_rgba(10,132,255,0.15)]";
  const labelClasses = "flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ds-muted)] mb-1.5 tracking-[0.05em] uppercase";

  const renderAccessLoading = () => (
    <div className="flex items-center justify-center min-h-[380px]">
      <div className="flex flex-col items-center gap-3.5">
        <div className="w-9 h-9 rounded-full animate-spin border-[3px] border-[var(--ds-hairline)] border-t-[#0A84FF]" />
        <p className="text-[13px] text-[var(--ds-muted)]">Verifying access…</p>
      </div>
    </div>
  );

  const customerCount = reportSections.length
    ? (sectionsShareCustomers(reportSections)
        ? (() => { const s = new Set(); reportSections.forEach(sec => sec.customers.forEach(c => s.add(c.cardCode))); return s.size; })()
        : reportSections.reduce((s, sec) => s + sec.customers.length, 0))
    : 0;

  const canGenerate = access.canCreate && !loading && selectedRebates.length > 0;
  const canExport   = access.canExport && showReport && reportSections.length > 0;

  return (
    <DesignPage className="flex w-full">

      {/* Aurora wash */}
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
          logo={vanLogo}
          theme={theme}
        />

        <div className="ds-scroll flex-1 overflow-y-auto pt-20 px-8 pb-10">
          <div className="ds-fade-up ds-glass rounded-[22px] bg-[var(--ds-glass)] border border-[var(--ds-hairline)] shadow-[var(--ds-shadow)] px-8 pt-8 pb-9 max-w-[1600px] mx-auto">

            {/* ── Title bar ── */}
            <div className="flex items-center justify-between mb-7 pb-5 gap-4 flex-wrap border-b border-[var(--ds-hairline)]">
              <div className="flex items-center gap-3.5">
                <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center flex-shrink-0 ds-gradient-primary shadow-[0_4px_16px_-4px_rgba(10,132,255,0.53)]">
                  <BarChart2 size={22} className="text-white" />
                </div>
                <div>
                  <h1 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--ds-ink)] m-0">
                    Rebate Monitoring Report
                  </h1>
                  <p className="text-[12px] text-[var(--ds-muted)] mt-[3px] mb-0 font-normal">
                    Sales Program Rebate Monitoring per Quarter
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ds-chip-bg)] border border-[var(--ds-hairline)] text-[11px] text-[var(--ds-muted)] font-medium ds-font-mono">
                <Calendar size={12} />
                {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            {/* ── Access gate ── */}
            {accessLoading ? renderAccessLoading() : !access.canView ? (
              <AccessDenied
                useTokens={true}
                tokens={{
                  ...K,
                  accent: PALETTE.blue, accentHover: PALETTE.blue, accentLight: `${PALETTE.blue}14`,
                  text: K.ink, textMuted: K.muted, textSub: K.muted,
                  success: PALETTE.green, error: PALETTE.red, errorBg: `${PALETTE.red}14`,
                  gold: PALETTE.orange, goldLight: `${PALETTE.orange}14`,
                  teal: PALETTE.blue, tealLight: `${PALETTE.blue}14`,
                  cardBg: K.glass, cardBorder: K.hairline,
                  inputBg: K.glass, inputBorder: K.hairline,
                  bg: K.bg, fontStack,
                }}
                message="You don't have permission to view this page. Contact your administrator for access."
              />
            ) : (
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

                    {showReport && (
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
                          { label: 'PDF Document',   ext: 'pdf',  icon: <FileText size={15} className="text-[#FF453A]" />,      fn: exportToPDF   },
                          { label: 'Excel Workbook', ext: 'xlsx', icon: <FileSpreadsheet size={15} className="text-[#32D74B]" />, fn: exportToExcel },
                          { label: 'PNG Image',      ext: 'png',  icon: <Image size={15} className="text-[#BF5AF2]" />,            fn: exportToPNG   },
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

                {/* Filter card */}
                <div className="ds-glass relative z-40 bg-[var(--ds-glass)] border border-[var(--ds-hairline)] rounded-[18px] px-[22px] py-5">
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1.3fr_1fr] gap-[18px]">
                    {/* Rebate Code(s) */}
                    <div>
                      <label className={labelClasses}><Tag size={12} className="text-[#0A84FF]" /> Rebate Code(s)</label>
                      <RebateSelector
                        rebates={availableRebates}
                        selected={selectedRebates}
                        onToggle={toggleRebate}
                        onClear={() => setSelectedRebates([])}
                      />
                      {selectedRebates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {selectedRebates.map(r => (
                            <span
                              key={r.rebateCode}
                              className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-[#0A84FF]/8 text-[#0A84FF] ds-font-mono"
                            >
                              {r.rebateCode} ({r.rebateType[0]})
                              <button
                                onClick={() => toggleRebate(r)}
                                className="bg-transparent border-none cursor-pointer inline-flex p-0 text-inherit hover:text-[#FF453A] transition-colors"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Customers */}
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
                        disabled={!selectedRebates.length || customersLoading}
                        className={`${inputClasses} flex items-center justify-between text-left ${
                          (!selectedRebates.length || customersLoading) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        }`}
                      >
                        <span className="truncate">
                          {customersLoading
                            ? 'Loading customers…'
                            : selectedCustomers.length === 0
                              ? 'No customers'
                              : selectedCustomers.length === availableCustomers.length
                                ? `All customers (${selectedCustomers.length})`
                                : `${selectedCustomers.length} selected`}
                        </span>
                        {customersLoading
                          ? <RefreshCw size={14} className="text-[var(--ds-faint)] animate-spin" style={{ animationDuration: '0.8s' }} />
                          : <ChevronDown size={14} className="text-[var(--ds-faint)]" />}
                      </button>

                      {showCustomerDropdown && availableCustomers.length > 0 && (
                        <div className="ds-glass ds-pop absolute top-[calc(100%+6px)] left-0 w-full max-h-[260px] overflow-y-auto bg-[var(--ds-glass-deep)] border border-[var(--ds-rim)] rounded-2xl shadow-[var(--ds-shadow)] z-[9999] py-1.5">
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

                    {/* Report Period */}
                    <div>
                      <label className={labelClasses}><Calendar size={12} className="text-[#0A84FF]" /> Report Period</label>
                      <div
                        className={`${inputClasses} flex items-center text-[12px] ${
                          periodLabel() ? 'text-[var(--ds-ink)]' : 'text-[var(--ds-muted)] italic'
                        }`}
                      >
                        {periodLabel() || 'Auto-detected from rebate code'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error banner */}
                {error && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-[14px] bg-[#FF453A]/8 border border-[#FF453A]/20 text-[#FF453A] text-[13px] font-medium">
                    <XCircle size={15} /> {error}
                  </div>
                )}

                {/* Loading */}
                {loading && (
                  <div className="ds-glass flex items-center justify-center min-h-[380px] rounded-[18px] border border-dashed border-[var(--ds-hairline)] bg-[var(--ds-glass)]">
                    <div className="text-center flex flex-col items-center gap-4">
                      <div className="relative w-14 h-14">
                        <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-[var(--ds-hairline)]" />
                        <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-[#0A84FF] border-t-transparent animate-spin" style={{ animationDuration: '0.75s' }} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[var(--ds-ink)] m-0 mb-1.5">Generating Monitoring Report</h3>
                        <p className="text-[12px] text-[var(--ds-muted)] m-0">
                          Fetching sales data for <span className="font-bold text-[#0A84FF]">{selectedRebates.length} rebate code{selectedRebates.length !== 1 ? 's' : ''}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Report preview */}
                {!loading && showReport && filteredReportSections.length > 0 && (
                  <div className="ds-glass bg-[var(--ds-glass)] border border-[var(--ds-hairline)] rounded-[18px] px-[22px] py-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CheckCircle size={15} className="text-[#32D74B]" />
                        <h3 className="text-[14px] font-bold text-[var(--ds-ink)] m-0">Report Preview</h3>
                        <span className="px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-[#0A84FF]/8 text-[#0A84FF] ds-font-mono">
                          {customerCount} customer{customerCount !== 1 ? 's' : ''}
                        </span>
                        {sectionsShareCustomers(reportSections) && (
                          <span className="px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-[#32D74B]/8 text-[#32D74B]">
                            Merged view
                          </span>
                        )}
                        <span className="px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-[#FF9F0A]/8 text-[#FF9F0A] ds-font-mono">
                          8.5" × 13" · Landscape
                        </span>
                      </div>
                      <span className="px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-[var(--ds-chip-bg)] text-[var(--ds-muted)] ds-font-mono">
                        {reportSections[0]?.quarterDisplay}
                      </span>
                    </div>

                    <div
                      className={`ds-scroll overflow-auto rounded-[14px] p-6 max-h-[70vh] ${
                        theme === 'dark' ? 'bg-black/35' : 'bg-black/4'
                      }`}
                    >
                      <div
                        className="mx-auto rounded-[4px] overflow-hidden shadow-[0_8px_30px_-8px_rgba(0,0,0,0.25)]"
                        style={{ width: `${PAPER_W_PX}px` }}
                      >
                        <PrintableReport ref={reportRef} sections={reportSections} userName={userName} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!loading && !showReport && !error && (
                  <div className="ds-glass flex items-center justify-center w-full min-h-[280px] rounded-[18px] border-2 border-dashed border-[var(--ds-hairline)] bg-[var(--ds-glass)]">
                    <div className="text-center flex flex-col items-center gap-3">
                      <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center bg-[#0A84FF]/11">
                        <BarChart2 size={24} className="text-[#0A84FF]" />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[var(--ds-ink)] m-0 mb-1">No report generated yet</p>
                        <p className="text-[12px] text-[var(--ds-muted)] m-0">
                          Select <strong className="text-[#0A84FF]">rebate code(s)</strong>, then click{' '}
                          <strong className="text-[#0A84FF]">Generate Report</strong>
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
    </DesignPage>
  );
}