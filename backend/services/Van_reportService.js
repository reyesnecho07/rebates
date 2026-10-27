// Van_reportService.js
import sql from 'mssql';
import { getPool } from '../services/databaseService.js';

const FALLBACK_API_BASE = (process.env.INTERNAL_API_BASE || 'http://localhost:3011').replace(/\/api\/?$/, '');
const DASHBOARD_TIMEOUT = 180_000;   // 3 min per customer — SAP can be slow
const DEBUG = process.env.DEBUG_VAN === '1';

// ─── Quarter helpers ───────────────────────────────────────────────────────────
export const getQuarterFromDate = (dateStr) => {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();
  return { quarter: Math.ceil(month / 3), year, month };
};

export const getPreviousQuarter = (quarter, year) =>
  quarter === 1 ? { quarter: 4, year: year - 1 } : { quarter: quarter - 1, year };

export const getQuarterDateRange = (quarter, year) => {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth   = quarter * 3;
  const endDay     = new Date(year, endMonth, 0).getDate();
  return {
    startDate: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    endDate:   `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
  };
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const QTR_NAMES   = ['1ST QUARTER','2ND QUARTER','3RD QUARTER','4TH QUARTER'];
const QTR_RANGES  = ['JAN - MAR','APR - JUN','JUL - SEP','OCT - DEC'];

export const getQuarterDisplayName = (quarter, year) =>
  `${QTR_NAMES[quarter - 1]} ${year} (${QTR_RANGES[quarter - 1]})`;

export const getPrevQuarterDisplayName = (quarter, year) => {
  const prev = getPreviousQuarter(quarter, year);
  const startM = (prev.quarter - 1) * 3;
  const endM   = prev.quarter * 3 - 1;
  return `${MONTH_NAMES[startM].substring(0,3).toUpperCase()} - ${MONTH_NAMES[endM].substring(0,3).toUpperCase()} ${prev.year}`;
};

export const getQuarterMonths = (quarter, year) => {
  const start = (quarter - 1) * 3;
  return [start, start + 1, start + 2].map(mi => ({
    name:  MONTH_NAMES[mi],
    short: MONTH_SHORT[mi],
    month: mi + 1,
    year,
  }));
};

// ─── Month-name normalisation (handles 'Jan', 'JANUARY', 'jan', etc.) ────────
const normalizeMonthName = (m) => {
  const s = String(m || '').trim().toLowerCase();
  if (!s) return '';
  if (s.startsWith('jan')) return 'January';
  if (s.startsWith('feb')) return 'February';
  if (s.startsWith('mar')) return 'March';
  if (s.startsWith('apr')) return 'April';
  if (s.startsWith('may')) return 'May';
  if (s.startsWith('jun')) return 'June';
  if (s.startsWith('jul')) return 'July';
  if (s.startsWith('aug')) return 'August';
  if (s.startsWith('sep')) return 'September';
  if (s.startsWith('oct')) return 'October';
  if (s.startsWith('nov')) return 'November';
  if (s.startsWith('dec')) return 'December';
  return '';
};

// ─── Previous-quarter qty via SAP (used only for prevAvg display) ────────────
const fetchActualSales = async (sapPool, cardCode, itemCodes, startDate, endDate) => {
  if (!itemCodes.length) return {};
  const paramNames = itemCodes.map((_, i) => `@item${i}`).join(', ');
  const q = `
    SELECT
      MONTH(T0.DocDate) AS Month,
      T0.ItemCode,
      SUM(T0.Quantity) AS TotalQty
    FROM OINV T0
    WHERE T0.CardCode = @cardCode
      AND T0.DocType  = 'I'
      AND T0.DocDate >= @startDate
      AND T0.DocDate <= @endDate
      AND T0.ItemCode IN (${paramNames})
    GROUP BY MONTH(T0.DocDate), T0.ItemCode
  `;
  const req = sapPool.request()
    .input('cardCode',  sql.NVarChar(50), cardCode)
    .input('startDate', sql.Date, startDate)
    .input('endDate',   sql.Date, endDate);
  itemCodes.forEach((c, i) => req.input(`item${i}`, sql.NVarChar(50), c));
  try {
    const res = await req.query(q);
    const map = {};
    res.recordset.forEach(r => { map[`${r.Month}_${r.ItemCode}`] = r.TotalQty || 0; });
    return map;
  } catch (e) {
    console.error('fetchActualSales error:', e.message);
    return {};
  }
};

const fetchActualSalesWithARCM = async (sapPool, cardCode, itemCodes, startDate, endDate) => {
  const sales = await fetchActualSales(sapPool, cardCode, itemCodes, startDate, endDate);
  if (!itemCodes.length) return sales;
  const paramNames = itemCodes.map((_, i) => `@ritem${i}`).join(', ');
  const rq = `
    SELECT
      MONTH(T0.DocDate) AS Month,
      T0.ItemCode,
      SUM(ABS(T0.Quantity)) AS ReturnQty
    FROM ORIN T0
    WHERE T0.CardCode = @cardCode
      AND T0.DocDate >= @startDate
      AND T0.DocDate <= @endDate
      AND T0.ItemCode IN (${paramNames})
    GROUP BY MONTH(T0.DocDate), T0.ItemCode
  `;
  const req = sapPool.request()
    .input('cardCode',  sql.NVarChar(50), cardCode)
    .input('startDate', sql.Date, startDate)
    .input('endDate',   sql.Date, endDate);
  itemCodes.forEach((c, i) => req.input(`ritem${i}`, sql.NVarChar(50), c));
  try {
    const res = await req.query(rq);
    res.recordset.forEach(r => {
      const key = `${r.Month}_${r.ItemCode}`;
      sales[key] = Math.max(0, (sales[key] || 0) - (r.ReturnQty || 0));
    });
  } catch (e) { /* ignore ARCM errors */ }
  return sales;
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-type summation over dashboard transactions
//   Matches VcpTransactionRecords.jsx: isRowCounted + getRowAmount
// ─────────────────────────────────────────────────────────────────────────────
const computeEarnedFromTransactions = (transactions, rebateType, quotaType, anchorDay, rawQuotas) => {
  if (!Array.isArray(transactions) || transactions.length === 0) return 0;

  // Normalise month keys so 'Jan'/'JANUARY'/'jan' all match
  const quotas = {};
  Object.entries(rawQuotas || {}).forEach(([m, t]) => {
    const norm = normalizeMonthName(m);
    if (norm) quotas[norm] = (quotas[norm] || 0) + (parseFloat(t) || 0);
  });

  // ── Percentage / Incremental: RebateAmount is already gated ─────────────
  if (rebateType === 'Percentage' || rebateType === 'Incremental') {
    const total = transactions.reduce((s, t) => s + (parseFloat(t.RebateAmount) || 0), 0);
    if (DEBUG) {
      console.log(`    [${rebateType}] sum of RebateAmount = ${total.toFixed(2)} over ${transactions.length} rows`);
    }
    return total;
  }

  // ── Fixed ────────────────────────────────────────────────────────────────
  if (rebateType === 'Fixed') {
    const isWithQuota = /with quota/i.test(String(quotaType || ''));
    const positive    = transactions.filter(t => !t.IsReturn && t.EligibilityStatus !== 'Return');

    // ── Without Quota: per-item running cumulative vs total quota ────────
    if (!isWithQuota) {
      const totalQuota = Object.values(quotas).reduce((s, v) => s + v, 0);
      const itemCum    = new Map();
      let total        = 0;
      let countedRows  = 0;

      for (const t of positive) {
        const qty = parseFloat(t.QtyForReb) || 0;
        const cum = (itemCum.get(t.ItemCode) || 0) + qty;
        itemCum.set(t.ItemCode, cum);

        const counts = totalQuota > 0 ? cum >= totalQuota : true;
        if (counts) {
          total += qty * (parseFloat(t.RebatePerBag) || 0);
          countedRows += 1;
        }
      }

      if (DEBUG) {
        console.log(`    [Fixed / No-Quota] totalQuota=${totalQuota} countedRows=${countedRows}/${positive.length} earned=${total.toFixed(2)}`);
      }
      return total;
    }

    // ── With Quota: cycle-grouped, whole cycle counts only if met ────────
    const getCycleKey = (dateStr) => {
      const d = new Date(dateStr);
      let y = d.getFullYear();
      let m = d.getMonth();
      if (d.getDate() < anchorDay) {
        m -= 1;
        if (m < 0) { m = 11; y -= 1; }
      }
      return `${y}-${String(m + 1).padStart(2, '0')}`;
    };
    const getCycleMonthName = (dateStr) => {
      const [y, m] = getCycleKey(dateStr).split('-').map(Number);
      return MONTH_NAMES[m - 1];
    };

    const cycles = new Map();
    for (const t of positive) {
      const key = getCycleKey(t.Date);
      if (!cycles.has(key)) cycles.set(key, { qty: 0, amount: 0, monthName: getCycleMonthName(t.Date) });
      const c = cycles.get(key);
      c.qty    += parseFloat(t.QtyForReb) || 0;
      c.amount += (parseFloat(t.QtyForReb) || 0) * (parseFloat(t.RebatePerBag) || 0);
    }

    let total = 0;
    const verdicts = {};
    cycles.forEach((c, key) => {
      const target = quotas[c.monthName] || 0;
      const met    = target > 0 ? c.qty >= target : true;
      verdicts[c.monthName] = { qty: c.qty, target, met };
      if (met) total += c.amount;
    });

    if (DEBUG) {
      console.log(`    [Fixed / With-Quota] cycles=${JSON.stringify(verdicts)} earned=${total.toFixed(2)}`);
    }
    return total;
  }

  return 0;
};

// ─── Get available rebates for selector ───────────────────────────────────────
export const getAvailableRebates = async (db = 'VAN') => {
  const pool = getPool(db);
  if (!pool) throw new Error('Database pool not available');
  const q = `
    SELECT RebateCode, RebateType, SlpName, DateFrom, DateTo, IsActive, Name, Frequency
    FROM RebateProgram
    ORDER BY CreatedDate DESC
  `;
  const res = await pool.request().query(q);
  return res.recordset.map(r => ({
    rebateCode:    r.RebateCode,
    rebateType:    r.RebateType,
    salesEmployee: r.SlpName || '',
    dateFrom:      r.DateFrom ? new Date(r.DateFrom).toISOString().split('T')[0] : '',
    dateTo:        r.DateTo   ? new Date(r.DateTo).toISOString().split('T')[0]   : '',
    isActive:      r.IsActive === 1,
    name:          r.Name || r.RebateCode,
    frequency:     r.Frequency || 'Quarterly',
  }));
};

// ─── Core report generation ───────────────────────────────────────────────────
export const generateRebateReport = async (rebateCodes, db = 'VAN', requestBaseUrl = null) => {
  const ownPool = getPool(db);
  const sapPool = getPool('VAN');
  if (!ownPool || !sapPool) throw new Error('Database pools not available');

  const baseUrl = (requestBaseUrl || FALLBACK_API_BASE).replace(/\/api\/?$/, '');
  console.log(`🌐 [VAN Report] Dashboard API base: ${baseUrl}`);

  const reportSections = [];

  for (const rebateCode of rebateCodes) {
    // ── 1. Rebate program info ───────────────────────────────────────────
    const infoResult = await ownPool.request()
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(`SELECT RebateCode,RebateType,SlpName,DateFrom,DateTo,IsActive,Frequency,QuotaType,Name
              FROM RebateProgram WHERE RebateCode=@rc`);
    if (!infoResult.recordset.length) continue;

    const rp       = infoResult.recordset[0];
    const dateFrom = rp.DateFrom ? new Date(rp.DateFrom).toISOString().split('T')[0] : null;
    const dateTo   = rp.DateTo   ? new Date(rp.DateTo).toISOString().split('T')[0]   : null;
    if (!dateFrom || !dateTo) continue;

    const normalizeType = (t) => {
      const s = (t || '').trim().toLowerCase();
      if (s === 'fixed')       return 'Fixed';
      if (s === 'incremental') return 'Incremental';
      if (s === 'percentage' || s === 'percent') return 'Percentage';
      return t;
    };
    rp.RebateType = normalizeType(rp.RebateType);

    const anchorDay = new Date(dateFrom).getDate() || 1;
    const quotaType = rp.QuotaType || '';
    const frequency = rp.Frequency || 'Quarterly';
    const { quarter, year } = getQuarterFromDate(dateFrom);
    const prevQ             = getPreviousQuarter(quarter, year);
    const quarterMonths     = getQuarterMonths(quarter, year);
    const prevQRange        = getQuarterDateRange(prevQ.quarter, prevQ.year);
    const prevQMonths       = getQuarterMonths(prevQ.quarter, prevQ.year);

    console.log(`\n🏷️  [VAN] ${rp.RebateCode} · ${rp.RebateType} · QuotaType="${quotaType}" · anchor=${anchorDay}`);

    // ── 2. Customer list — same tables the dashboard reads ───────────────
    let custTable = '';
    if (rp.RebateType === 'Fixed')            custTable = 'FixCustRebate';
    else if (rp.RebateType === 'Incremental') custTable = 'IncCustRebate';
    else if (rp.RebateType === 'Percentage')  custTable = 'PerCustRebate';

    let customers = [];
    if (custTable) {
      const cr = await ownPool.request()
        .input('rc', sql.NVarChar(50), rebateCode)
        .query(`
          SELECT DISTINCT CardCode, CardName, QtrRebate
          FROM ${custTable}
          WHERE RebateCode = @rc
            AND CardCode IS NOT NULL
            AND LTRIM(RTRIM(CardCode)) != ''
          ORDER BY CardName
        `);
      customers = cr.recordset.map(r => ({
        cardCode:  r.CardCode,
        cardName:  r.CardName,
        qtrRebate: parseFloat(r.QtrRebate) || 0,
      }));
    }

    // ── 3. Per-customer: dashboard transactions + local released ─────────
    const customerRows  = [];
    let aggregatedItems = [];   // reuse first successful customer's item list

    for (const cust of customers) {
      let earned       = 0;
      let totalReleased = 0;
      let qtrPayouts   = [];
      let transactions = [];
      let rebateDetails = {};
      let rebateItems   = [];
      let errorMsg      = null;

      try {
        const qs = new URLSearchParams({
          db,
          rebateCode,
          rebateType:      rp.RebateType,
          periodFrom:      dateFrom,
          periodTo:        dateTo,
          useRebatePeriod: 'false',
        });
        const url = `${baseUrl}/api/dashboard/customer/${encodeURIComponent(cust.cardCode)}/transactions?${qs}`;

        if (DEBUG) console.log(`    → GET ${url}`);

        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal:  AbortSignal.timeout(DASHBOARD_TIMEOUT),
        });

        if (!response.ok) {
          const txt = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} from ${url}: ${txt.substring(0, 200)}`);
        }

        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Dashboard endpoint returned success:false');

        transactions  = data.data?.transactions  || [];
        rebateDetails = data.data?.rebateDetails || {};
        rebateItems   = data.data?.rebateItems   || [];

        if (aggregatedItems.length === 0 && rebateItems.length > 0) {
          aggregatedItems = rebateItems;
        }

        // Earned — per-type summation of the dashboard's own rows
        earned = computeEarnedFromTransactions(
          transactions, rp.RebateType, quotaType, anchorDay,
          rebateDetails.quotas || {}
        );
      } catch (err) {
        errorMsg = err.message;
        console.warn(`  ⚠️ [VAN] ${cust.cardCode}/${rebateCode}: ${err.message}`);
      }

      // Released — from PayoutHistory for this quarter
      try {
        const pr = await ownPool.request()
          .input('cc', sql.NVarChar(50), cust.cardCode)
          .input('rc', sql.NVarChar(50), rebateCode)
          .query(`
            SELECT Period, BaseAmount, TotalAmount, AmountReleased, RebateBalance, Status, PayoutQuarter
            FROM PayoutHistory
            WHERE CardCode = @cc AND RebateCode = @rc
              AND Period NOT LIKE 'Balance of Q%'
            ORDER BY PayoutDate ASC
          `);
        const payoutRows = pr.recordset;
        qtrPayouts = payoutRows.filter(p => {
          if (!p.PayoutQuarter) return false;
          const pq = String(p.PayoutQuarter).toUpperCase().replace(/\s+/g, '');
          return pq.includes(`Q${quarter}`) && pq.includes(String(year));
        });
        totalReleased = qtrPayouts.reduce(
          (s, p) => s + (parseFloat(p.AmountReleased) || 0), 0
        );
      } catch (e) {
        if (DEBUG) console.warn(`  ⚠️ PayoutHistory error for ${cust.cardCode}: ${e.message}`);
      }

      // Monthly actuals from the transactions response (for the table)
      const monthlyActuals = quarterMonths.map(qm => {
        const qty = transactions
          .filter(t => {
            const d = new Date(t.Date);
            return d.getFullYear() === qm.year && d.getMonth() + 1 === qm.month;
          })
          .reduce((s, t) => s + (parseFloat(t.QtyForReb) || 0), 0);
        return {
          month:     qm.month,
          monthName: qm.name,
          short:     qm.short,
          qty:       Math.round(Math.max(0, qty) * 100) / 100,
        };
      });
      const qtrActual = monthlyActuals.reduce((s, m) => s + m.qty, 0);

      // Monthly quotas — from the dashboard's own rebateDetails.quotas
      const monthlyQuotas = quarterMonths.map(qm => ({
        month:     qm.month,
        monthName: qm.name,
        short:     qm.short,
        targetQty: (rebateDetails.quotas && rebateDetails.quotas[qm.name]) || 0,
      }));

      // Previous-quarter avg (from local SAP, display only)
      let prevAvg = 0;
      try {
        const itemCodes = rebateItems
          .map(i => i.itemCode || i.ItemCode)
          .filter(Boolean);
        if (itemCodes.length > 0) {
          const prevSales = await fetchActualSalesWithARCM(
            sapPool, cust.cardCode, itemCodes,
            prevQRange.startDate, prevQRange.endDate
          );
          const prevTotalQty = itemCodes.reduce(
            (s, ic) => s + prevQMonths.reduce(
              (ms, qm) => ms + (prevSales[`${qm.month}_${ic}`] || 0), 0
            ), 0
          );
          prevAvg = Math.round(prevTotalQty / 3);
        }
      } catch { /* ignore */ }

      // Current range for Incremental (display)
      let currentRange = null;
      if (rp.RebateType === 'Incremental' && Array.isArray(rebateDetails.ranges)) {
        const sorted = [...rebateDetails.ranges].sort((a, b) => a.minQty - b.minQty);
        for (const r of sorted) {
          if (qtrActual >= r.minQty && (!r.maxQty || qtrActual <= r.maxQty)) {
            currentRange = r; break;
          }
        }
      }

      if (DEBUG) {
        console.log(
          `  ${earned || totalReleased ? '✓' : '·'} ${cust.cardCode}: ` +
          `earned=${earned.toFixed(2)} released=${totalReleased.toFixed(2)} ` +
          `rows=${transactions.length}${errorMsg ? `  ⚠️ ${errorMsg}` : ''}`
        );
      }

      customerRows.push({
        cardCode:      cust.cardCode,
        cardName:      cust.cardName,
        qtrRebate:     cust.qtrRebate,
        prevAvg,
        monthlyQuotas,
        monthlyActuals,
        qtrActual,
        currentRange,
        custRanges:    rebateDetails.ranges || [],
        displayAmount: earned,
        totalReleased,
        payoutRows:    qtrPayouts,
        ...(errorMsg ? { error: errorMsg } : {}),
      });
    }

    // ── 4. Aggregated item label ─────────────────────────────────────────
    let itemLabel = (rp.Name || rp.RebateCode).toUpperCase();
    if (rp.RebateType === 'Fixed' && aggregatedItems.length > 0) {
      const maxRate = aggregatedItems.reduce(
        (mx, i) => Math.max(mx, parseFloat(i.rebatePerBag ?? i.rebate) || 0), 0
      );
      itemLabel = `${itemLabel} @ ₱${maxRate}/BAG`;
    } else if (rp.RebateType === 'Percentage' && aggregatedItems.length > 0) {
      const maxPct = aggregatedItems.reduce(
        (mx, i) => Math.max(mx, parseFloat(i.percentagePerBag ?? i.percentage) || 0), 0
      );
      itemLabel = `${itemLabel} @ ${maxPct}%`;
    }

    reportSections.push({
      rebateCode:     rp.RebateCode,
      rebateName:     rp.Name || rp.RebateCode,
      rebateType:     rp.RebateType,
      salesEmployee:  rp.SlpName || '',
      dateFrom,
      dateTo,
      quarter,
      year,
      quarterDisplay: getQuarterDisplayName(quarter, year),
      prevQDisplay:   getPrevQuarterDisplayName(quarter, year),
      quarterMonths,
      prevQMonths,
      customers:      customerRows,
      items:          [{ ItemCode: 'ALL_ITEMS', label: itemLabel, UnitPerQty: 1 }],
      ranges:         [],
      frequency,
    });
  }

  return reportSections;
};