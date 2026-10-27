/**
 * Vcp_reportService.js
 * Service layer for the "Cash Fund per Account" report.
 *
 * ─── Earned ────────────────────────────────────────────────────────────────
 *   Computed live from SAP:
 *     • OINV (A/R invoices, DocType='I')  — filtered by DocDate
 *     • ORIN (A/R credit memos / returns) — filtered by DocDate
 *   Rebate math matches the Dashboard's Transaction Records endpoint:
 *     • Percentage  → per-month quota gate → GTotal × pct / 100 for met months
 *     • Fixed       → per-month cycle qty vs monthly quota (With-Quota)
 *                     or cumulative vs total quota (Without-Quota)
 *     • Incremental → cumulative per period, retroactive tier rate
 *
 *   → Same date range as Transaction Records → same "Total Amount".
 *
 * ─── Released ──────────────────────────────────────────────────────────────
 *   From PayoutHistory.AmountReleased where DocumentType IS NOT NULL.
 *   Filtered by PayoutDate → CreatedDate → unfiltered fallback so data
 *   always shows if it exists.
 */

import { getPool } from './databaseService.js';
import sql         from 'mssql';

const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE || 'http://localhost:3011/api';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

/* ─────────────────────────────────────────────────────────────────────────── */
/* 1.  Rebate Program queries                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

export const getActiveRebates = async (db = 'VCP', rebateType = null) => {
  const pool = getPool(db);
  if (!pool) throw new Error(`Database pool for ${db} not available`);

  const request = pool.request();
  let typeFilter = '';
  if (rebateType) {
    request.input('rebateType', sql.NVarChar(50), rebateType);
    typeFilter = 'AND RebateType = @rebateType';
  }

  const result = await request.query(`
    SELECT
      RebateCode, RebateType, SlpName,
      CONVERT(VARCHAR(10), DateFrom, 120) AS DateFrom,
      CONVERT(VARCHAR(10), DateTo,   120) AS DateTo,
      Frequency, IsActive
    FROM RebateProgram
    WHERE IsActive = 1 ${typeFilter}
    ORDER BY DateFrom DESC, RebateCode DESC
  `);

  return result.recordset;
};

export const getRebateInfo = async (rebateCode, db = 'VCP') => {
  const pool = getPool(db);
  if (!pool) throw new Error(`Database pool for ${db} not available`);

  const result = await pool.request()
    .input('rebateCode', sql.NVarChar(50), rebateCode)
    .query(`
      SELECT
        RebateCode, RebateType, SlpName,
        CONVERT(VARCHAR(10), DateFrom, 120) AS DateFrom,
        CONVERT(VARCHAR(10), DateTo,   120) AS DateTo,
        IsActive, Frequency, QuotaType
      FROM RebateProgram
      WHERE RebateCode = @rebateCode
    `);

  return result.recordset[0] || null;
};

export const getCustomersByRebate = async (rebateCode, db = 'VCP') => {
  const pool = getPool(db);
  if (!pool) throw new Error(`Database pool for ${db} not available`);

  const result = await pool.request()
    .input('rebateCode', sql.NVarChar(50), rebateCode)
    .query(`
      SELECT DISTINCT
        T0.RebateCode, T0.RebateType, T0.SlpName, T0.DateFrom, T0.DateTo,
        T0.IsActive,   T0.Frequency,
        T1.CardCode,   T1.CardName,   T1.QtrRebate,
        T2.Month,      T2.TargetQty,
        T3.ItemCode,   T3.ItemName,   T3.PercentagePerBag, T3.UnitPerQty,
        ISNULL(T1.CreatedDate, T0.CreatedDate) AS CreatedDate
      FROM RebateProgram T0
        LEFT JOIN PerCustRebate T1 ON T0.RebateCode = T1.RebateCode
        LEFT JOIN PerCustQuota  T2 ON T1.Id         = T2.PerCustRebateId
        LEFT JOIN PerProdRebate T3 ON T0.RebateCode = T3.RebateCode
      WHERE T0.IsActive = 1 AND T0.RebateCode = @rebateCode
        AND T1.CardCode IS NOT NULL AND LTRIM(RTRIM(T1.CardCode)) != ''

      UNION ALL

      SELECT DISTINCT
        T0.RebateCode, T0.RebateType, T0.SlpName, T0.DateFrom, T0.DateTo,
        T0.IsActive,   T0.Frequency,
        T1.CardCode,   T1.CardName,
        NULL AS QtrRebate, NULL AS Month, NULL AS TargetQty,
        T3.ItemCode,   T3.ItemName,   NULL AS PercentagePerBag, NULL AS UnitPerQty,
        ISNULL(T1.CreatedDate, T0.CreatedDate) AS CreatedDate
      FROM RebateProgram T0
        LEFT JOIN IncCustRebate T1 ON T0.RebateCode = T1.RebateCode
        LEFT JOIN IncItemRebate T3 ON T0.RebateCode = T3.RebateCode
      WHERE T0.IsActive = 1 AND T0.RebateCode = @rebateCode
        AND T1.CardCode IS NOT NULL AND LTRIM(RTRIM(T1.CardCode)) != ''

      UNION ALL

      SELECT DISTINCT
        T0.RebateCode, T0.RebateType, T0.SlpName, T0.DateFrom, T0.DateTo,
        T0.IsActive,   T0.Frequency,
        T1.CardCode,   T1.CardName,
        NULL AS QtrRebate, NULL AS Month, NULL AS TargetQty,
        T3.ItemCode,   T3.ItemName,   NULL AS PercentagePerBag, NULL AS UnitPerQty,
        ISNULL(T1.CreatedDate, T0.CreatedDate) AS CreatedDate
      FROM RebateProgram T0
        LEFT JOIN FixCustRebate T1 ON T0.RebateCode = T1.RebateCode
        LEFT JOIN FixProdRebate T3 ON T0.RebateCode = T3.RebateCode
      WHERE T0.IsActive = 1 AND T0.RebateCode = @rebateCode
        AND T1.CardCode IS NOT NULL AND LTRIM(RTRIM(T1.CardCode)) != ''
    `);

  return result.recordset;
};

export const getItemCodesByRebate = async (rebateCode, db = 'VCP') => {
  const pool = getPool(db);
  if (!pool) return [];

  const result = await pool.request()
    .input('rebateCode', sql.NVarChar(50), rebateCode)
    .query(`
      SELECT DISTINCT ItemCode
      FROM PerProdRebate
      WHERE RebateCode = @rebateCode
        AND ItemCode IS NOT NULL
        AND LTRIM(RTRIM(ItemCode)) != ''
    `);

  return result.recordset.map(r => r.ItemCode).filter(Boolean);
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 1b. All-customers + name lookups                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

export const getAllCustomers = async (db = 'VCP') => {
  const pool = getPool(db);
  if (!pool) throw new Error(`Database pool for ${db} not available`);

  const result = await pool.request().query(`
    SELECT CardCode, MAX(CardName) AS CardName
    FROM (
      SELECT CardCode, CardName FROM PerCustRebate
        WHERE CardCode IS NOT NULL AND LTRIM(RTRIM(CardCode)) != ''
      UNION ALL
      SELECT CardCode, CardName FROM IncCustRebate
        WHERE CardCode IS NOT NULL AND LTRIM(RTRIM(CardCode)) != ''
      UNION ALL
      SELECT CardCode, CardName FROM FixCustRebate
        WHERE CardCode IS NOT NULL AND LTRIM(RTRIM(CardCode)) != ''
    ) T
    GROUP BY CardCode
    ORDER BY CardName ASC
  `);

  return result.recordset;
};

export const getRebateCodesForCustomer = async (customerCode, db = 'VCP') => {
  const pool = getPool(db);
  if (!pool) return [];

  const result = await pool.request()
    .input('cc', sql.NVarChar(50), customerCode)
    .query(`
      SELECT DISTINCT RebateCode FROM (
        SELECT RebateCode FROM PerCustRebate WHERE CardCode = @cc
        UNION
        SELECT RebateCode FROM IncCustRebate WHERE CardCode = @cc
        UNION
        SELECT RebateCode FROM FixCustRebate WHERE CardCode = @cc
      ) T
    `);

  return result.recordset.map(r => r.RebateCode).filter(Boolean);
};

export const getCustomerNamesByCodes = async (codes, db = 'VCP') => {
  if (!Array.isArray(codes) || codes.length === 0) return [];
  const pool = getPool(db);
  if (!pool) return [];

  const req = pool.request();
  const p1 = codes.map((c, i) => { req.input(`p1_${i}`, sql.NVarChar(50), c); return `@p1_${i}`; }).join(',');
  const p2 = codes.map((c, i) => { req.input(`p2_${i}`, sql.NVarChar(50), c); return `@p2_${i}`; }).join(',');
  const p3 = codes.map((c, i) => { req.input(`p3_${i}`, sql.NVarChar(50), c); return `@p3_${i}`; }).join(',');

  const result = await req.query(`
    SELECT CardCode, MAX(CardName) AS CardName
    FROM (
      SELECT CardCode, CardName FROM PerCustRebate WHERE CardCode IN (${p1})
      UNION ALL
      SELECT CardCode, CardName FROM IncCustRebate WHERE CardCode IN (${p2})
      UNION ALL
      SELECT CardCode, CardName FROM FixCustRebate WHERE CardCode IN (${p3})
    ) T
    GROUP BY CardCode
  `);

  return result.recordset;
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 2.  SAP invoice totals                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

export const getSAPInvoiceTotals = async (customerCode, dateFrom, dateTo, itemCodes = []) => {
  try {
    const sapPool = getPool('VCP');
    if (!sapPool) return { totalCTNs: 0, totalPValue: 0 };

    const request = sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('dateFrom',     sql.Date,         new Date(dateFrom))
      .input('dateTo',       sql.Date,         new Date(dateTo));

    let itemFilter = '';
    if (itemCodes.length > 0) {
      const params = itemCodes.map((_, i) => `@ic${i}`).join(', ');
      itemCodes.forEach((code, i) => request.input(`ic${i}`, sql.NVarChar(50), code));
      itemFilter = `AND T0.ItemCode IN (${params})`;
    }

    const result = await request.query(`
      SELECT
        ISNULL(SUM(T0.BulkConversion), 0) AS TotalCTNs,
        ISNULL(SUM(T0.GTotal),         0) AS TotalPValue
      FROM OINV T0
      WHERE T0.CardCode = @customerCode
        AND T0.DocType  = 'I'
        AND T0.DocDate >= @dateFrom
        AND T0.DocDate <= @dateTo
        ${itemFilter}
    `);

    return {
      totalCTNs:   parseFloat(result.recordset[0]?.TotalCTNs)   || 0,
      totalPValue: parseFloat(result.recordset[0]?.TotalPValue) || 0,
    };
  } catch (error) {
    console.error(`❌ [Report] SAP totals error for ${customerCode}:`, error.message);
    return { totalCTNs: 0, totalPValue: 0 };
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 3.  Rebate configuration cache (items / quotas / ranges per customer+code)  */
/* ─────────────────────────────────────────────────────────────────────────── */

const getRebateItemsForCode = async (rebateCode, rebateType, db) => {
  const pool = getPool(db);
  if (!pool) return [];

  let query;
  if (rebateType === 'Percentage') {
    query = `SELECT ItemCode, ItemName, UnitPerQty, PercentagePerBag AS Rate FROM PerProdRebate WHERE RebateCode = @rc AND ItemCode IS NOT NULL`;
  } else if (rebateType === 'Fixed') {
    query = `SELECT ItemCode, ItemName, UnitPerQty, RebatePerBag AS Rate FROM FixProdRebate WHERE RebateCode = @rc AND ItemCode IS NOT NULL`;
  } else if (rebateType === 'Incremental') {
    query = `SELECT ItemCode, ItemName, UnitPerQty, 0 AS Rate FROM IncItemRebate WHERE RebateCode = @rc AND ItemCode IS NOT NULL`;
  } else {
    return [];
  }

  const result = await pool.request().input('rc', sql.NVarChar(50), rebateCode).query(query);
  return result.recordset.filter(r => r.ItemCode);
};

const getCustomerQuotas = async (customerCode, rebateCode, rebateType, db) => {
  const pool = getPool(db);
  if (!pool) return {};

  let query;
  if (rebateType === 'Percentage') {
    query = `
      SELECT T2.Month, T2.TargetQty FROM PerCustRebate T1
      INNER JOIN PerCustQuota T2 ON T1.Id = T2.PerCustRebateId
      WHERE T1.CardCode = @cc AND T1.RebateCode = @rc
    `;
  } else if (rebateType === 'Fixed') {
    query = `
      SELECT T2.Month, T2.TargetQty FROM FixCustRebate T1
      INNER JOIN FixCustQuota T2 ON T1.Id = T2.CustRebateId
      WHERE T1.CardCode = @cc AND T1.RebateCode = @rc
    `;
  } else {
    return {};
  }

  const result = await pool.request()
    .input('cc', sql.NVarChar(50), customerCode)
    .input('rc', sql.NVarChar(50), rebateCode)
    .query(query);

  const quotas = {};
  for (const row of result.recordset) {
    if (row.Month) quotas[row.Month] = parseFloat(row.TargetQty) || 0;
  }
  return quotas;
};

const getCustomerRanges = async (customerCode, rebateCode, db) => {
  const pool = getPool(db);
  if (!pool) return [];

  const result = await pool.request()
    .input('cc', sql.NVarChar(50), customerCode)
    .input('rc', sql.NVarChar(50), rebateCode)
    .query(`
      SELECT T2.RangeNo, T2.MinQty, T2.MaxQty, T2.RebatePerBag
      FROM IncCustRebate T1
      INNER JOIN IncCustRange T2 ON T1.Id = T2.IncCustRebateId
      WHERE T1.CardCode = @cc AND T1.RebateCode = @rc
      ORDER BY T2.RangeNo
    `);

  return result.recordset.map(r => ({
    rangeNo:      r.RangeNo,
    minQty:       parseFloat(r.MinQty)       || 0,
    maxQty:       parseFloat(r.MaxQty)       || 0,
    rebatePerBag: parseFloat(r.RebatePerBag) || 0,
  }));
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 4.  Direct SAP query (OINV + ORIN), date-scoped                             */
/* ─────────────────────────────────────────────────────────────────────────── */

const querySAPLines = async (customerCode, itemCodes, dateFrom, dateTo) => {
  const sapPool = getPool('VCP');
  if (!sapPool || !itemCodes || itemCodes.length === 0) return [];

  const fromDate = new Date(dateFrom); fromDate.setHours(0, 0, 0, 0);
  const toDate   = new Date(dateTo);   toDate.setHours(23, 59, 59, 999);

  const runTable = async (table) => {
    const req = sapPool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('df', sql.DateTime,     fromDate)
      .input('dt', sql.DateTime,     toDate);
    itemCodes.forEach((c, i) => req.input(`ic${i}`, sql.NVarChar(50), c));
    const ph = itemCodes.map((_, i) => `@ic${i}`).join(', ');

    const docFilter = table === 'OINV' ? `AND DocType = 'I'` : '';
    // ORIN quantities/amounts come back negative so they reduce the total
    const signQty  = table === 'ORIN' ? '-ABS(Quantity)' : 'Quantity';
    const signGtot = table === 'ORIN' ? '-ABS(GTotal)'   : 'GTotal';

    return await req.query(`
      SELECT
        CONVERT(VARCHAR(10), DocDate, 120) AS Date,
        ItemCode,
        Dscription      AS ItemName,
        ${signQty}      AS Quantity,
        ${signGtot}     AS GTotal
      FROM ${table}
      WHERE CardCode = @cc
        ${docFilter}
        AND DocDate >= @df
        AND DocDate <= @dt
        AND ItemCode IN (${ph})
    `);
  };

  try {
    const [inv, ret] = await Promise.all([
      runTable('OINV').catch(e => { console.warn(`⚠️ OINV err: ${e.message}`); return { recordset: [] }; }),
      runTable('ORIN').catch(e => { console.warn(`⚠️ ORIN err: ${e.message}`); return { recordset: [] }; }),
    ]);

    const lines = [
      ...inv.recordset.map(r => ({
        Date:     r.Date,
        ItemCode: r.ItemCode,
        ItemName: r.ItemName,
        Quantity: parseFloat(r.Quantity) || 0,
        GTotal:   parseFloat(r.GTotal)   || 0,
      })),
      ...ret.recordset.map(r => ({
        Date:     r.Date,
        ItemCode: r.ItemCode,
        ItemName: r.ItemName,
        Quantity: parseFloat(r.Quantity) || 0,
        GTotal:   parseFloat(r.GTotal)   || 0,
      })),
    ];

    lines.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    return lines;
  } catch (e) {
    console.warn(`⚠️ SAP query error for ${customerCode}: ${e.message}`);
    return [];
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 5.  Rebate math per type (matches Transaction Records)                      */
/* ─────────────────────────────────────────────────────────────────────────── */

const getQtyForReb = (line, item) => {
  const qty = parseFloat(line.Quantity) || 0;
  const itemName   = line.ItemName || item.ItemName || '';
  const unitPerQty = parseFloat(item.UnitPerQty) || 1;
  if (itemName.toLowerCase().includes('25kg') && unitPerQty > 1) {
    return qty / unitPerQty;
  }
  return qty;
};

const computePercentage = (lines, itemMap, quotas) => {
  // Group qty + amount per month
  const months = new Map();
  for (const line of lines) {
    const item = itemMap.get(line.ItemCode);
    if (!item) continue;
    const d   = new Date(line.Date);
    const mk  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mn  = MONTH_NAMES[d.getMonth()];
    const qty = getQtyForReb(line, item);
    const pct = parseFloat(item.Rate) || 0;
    const gt  = parseFloat(line.GTotal) || 0;
    const amt = (gt * pct) / 100;

    if (!months.has(mk)) months.set(mk, { qty: 0, amount: 0, monthName: mn });
    const m = months.get(mk);
    m.qty    += qty;
    m.amount += amt;
  }

  // Quota gate per month
  let total = 0;
  months.forEach(m => {
    const target = parseFloat(quotas[m.monthName]) || 0;
    const met    = target > 0 ? m.qty >= target : true;
    if (met) total += m.amount;
  });
  return total;
};

const computeFixed = (lines, itemMap, quotas, quotaType) => {
  const isWithQuota = String(quotaType || '').toLowerCase().includes('with quota');

  if (isWithQuota) {
    // Per-month cycle vs monthly target
    const months = new Map();
    for (const line of lines) {
      const item = itemMap.get(line.ItemCode);
      if (!item) continue;
      const d   = new Date(line.Date);
      const mk  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mn  = MONTH_NAMES[d.getMonth()];
      const qty = getQtyForReb(line, item);
      const rate = parseFloat(item.Rate) || 0;

      if (!months.has(mk)) months.set(mk, { qty: 0, amount: 0, monthName: mn });
      const m = months.get(mk);
      m.qty    += qty;
      m.amount += qty * rate;
    }

    let total = 0;
    months.forEach(m => {
      const target = parseFloat(quotas[m.monthName]) || 0;
      const met    = target > 0 ? m.qty >= target : true;
      if (met) total += m.amount;
    });
    return total;
  }

  // Without quota → cumulative vs total quota
  const totalQuota = Object.values(quotas).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  let totalQty = 0;
  let totalAmt = 0;
  for (const line of lines) {
    const item = itemMap.get(line.ItemCode);
    if (!item) continue;
    const qty  = getQtyForReb(line, item);
    const rate = parseFloat(item.Rate) || 0;
    totalQty += qty;
    totalAmt += qty * rate;
  }
  return totalQty >= totalQuota ? totalAmt : 0;
};

const computeIncremental = (lines, itemMap, ranges, frequency) => {
  const isMonthly  = String(frequency || '').toLowerCase() === 'monthly';
  const sorted     = [...ranges].sort((a, b) => a.minQty - b.minQty);
  if (sorted.length === 0) return 0;

  let cum = 0;
  let lastMk = null;
  const rows = [];

  for (const line of lines) {
    const item = itemMap.get(line.ItemCode);
    if (!item) continue;
    const qty = getQtyForReb(line, item);
    const d   = new Date(line.Date);
    const mk  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (isMonthly && lastMk !== null && mk !== lastMk) cum = 0;
    lastMk = mk;
    cum += qty;
    rows.push({ qty, cumulative: cum, periodKey: isMonthly ? mk : 'period' });
  }

  if (rows.length === 0) return 0;

  const finalQty = new Map();
  rows.forEach(r => finalQty.set(r.periodKey, r.cumulative));

  const periodRate = new Map();
  rows.forEach(r => {
    if (periodRate.has(r.periodKey)) return;
    const fq = finalQty.get(r.periodKey) || 0;
    let best = null;
    for (const range of sorted) {
      if (fq >= range.minQty && (fq <= range.maxQty || !range.maxQty)) {
        best = range; break;
      }
    }
    if (!best) {
      const last = sorted[sorted.length - 1];
      if (fq >= last.minQty) best = last;
    }
    periodRate.set(r.periodKey, best ? best.rebatePerBag : 0);
  });

  let total = 0;
  rows.forEach(r => { total += r.qty * (periodRate.get(r.periodKey) || 0); });
  return total;
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 6.  Earned for one customer + one rebate code                               */
/* ─────────────────────────────────────────────────────────────────────────── */

const computeEarnedForCode = async (customerCode, rebateCode, dateFrom, dateTo, db) => {
  const info = await getRebateInfo(rebateCode, db);
  if (!info) return { earned: 0, lines: 0, items: 0 };

  const rebateType = info.RebateType;
  const frequency  = info.Frequency  || 'Quarterly';
  const quotaType  = info.QuotaType  || 'N/A';

  const items = await getRebateItemsForCode(rebateCode, rebateType, db);
  if (items.length === 0) return { earned: 0, lines: 0, items: 0 };

  const itemCodes = items.map(i => i.ItemCode).filter(Boolean);
  const itemMap   = new Map(items.map(i => [i.ItemCode, i]));

  const lines = await querySAPLines(customerCode, itemCodes, dateFrom, dateTo);
  if (lines.length === 0) return { earned: 0, lines: 0, items: items.length };

  let earned = 0;
  if (rebateType === 'Percentage') {
    const quotas = await getCustomerQuotas(customerCode, rebateCode, rebateType, db);
    earned = computePercentage(lines, itemMap, quotas);
  } else if (rebateType === 'Fixed') {
    const quotas = await getCustomerQuotas(customerCode, rebateCode, rebateType, db);
    earned = computeFixed(lines, itemMap, quotas, quotaType);
  } else if (rebateType === 'Incremental') {
    const ranges = await getCustomerRanges(customerCode, rebateCode, db);
    earned = computeIncremental(lines, itemMap, ranges, frequency);
  }

  return { earned, lines: lines.length, items: items.length };
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 7.  Released from PayoutHistory (with smart fallback)                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export const getReleasedAmount = async (customerCode, rebateCodes, dateFrom, dateTo, db = 'VCP') => {
  try {
    const pool = getPool(db);
    if (!pool) return { amount: 0, mode: 'none' };

    const fromDate = new Date(dateFrom); fromDate.setHours(0, 0, 0, 0);
    const toDate   = new Date(dateTo);   toDate.setHours(23, 59, 59, 999);

    const buildQuery = (dateColumn) => {
      const req = pool.request().input('cc', sql.NVarChar(50), customerCode);

      let rebateFilter = '';
      if (Array.isArray(rebateCodes) && rebateCodes.length > 0) {
        rebateCodes.forEach((c, i) => req.input(`rc${i}`, sql.NVarChar(50), c));
        rebateFilter = `AND RebateCode IN (${rebateCodes.map((_, i) => `@rc${i}`).join(', ')})`;
      }

      let dateFilter = '';
      if (dateColumn) {
        req.input('df', sql.DateTime, fromDate);
        req.input('dt', sql.DateTime, toDate);
        dateFilter = `AND ${dateColumn} >= @df AND ${dateColumn} <= @dt`;
      }

      return req.query(`
        SELECT ISNULL(SUM(AmountReleased), 0) AS TotalReleased
        FROM PayoutHistory
        WHERE CardCode = @cc
          ${rebateFilter}
          ${dateFilter}
          AND DocumentType IS NOT NULL
          AND AmountReleased IS NOT NULL
      `);
    };

    // Try PayoutDate → CreatedDate → unfiltered
    for (const col of ['PayoutDate', 'CreatedDate', null]) {
      try {
        const res = await buildQuery(col);
        const amount = parseFloat(res.recordset[0]?.TotalReleased) || 0;

        // If a date filter returned 0 but unfiltered > 0, prefer unfiltered
        // (this means PayoutHistory dates don't align with the user's range,
        //  so all-time released is the best available answer).
        if (col && amount === 0) {
          const unfilt = await buildQuery(null);
          const unfiltAmount = parseFloat(unfilt.recordset[0]?.TotalReleased) || 0;
          if (unfiltAmount > 0) {
            return { amount: unfiltAmount, mode: `${col} (empty in range, showing all-time)` };
          }
        }
        return { amount, mode: col || 'unfiltered' };
      } catch (e) {
        if (!/Invalid column name/i.test(e.message)) {
          console.warn(`⚠️ [Report] Released query (${col || 'unfiltered'}) err for ${customerCode}:`, e.message);
          return { amount: 0, mode: 'error' };
        }
      }
    }
    return { amount: 0, mode: 'none' };
  } catch (e) {
    console.warn(`⚠️ [Report] Released error for ${customerCode}:`, e.message);
    return { amount: 0, mode: 'error' };
  }
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 8.  PayoutHistory summary (kept for legacy consumers / sync)                */
/* ─────────────────────────────────────────────────────────────────────────── */

export const fetchPayoutsViaPayoutRoute = async (
  customerCode, rebateCode, dateFrom, dateTo, db = 'VCP', rebateType = 'Percentage'
) => {
  try {
    const qs = new URLSearchParams({
      db, rebateCode, rebateType,
      periodFrom: dateFrom, periodTo: dateTo, useRebatePeriod: 'false',
    });

    const response = await fetch(
      `${INTERNAL_API_BASE}/vcp/customer/${customerCode}/payouts?${qs}`,
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal:  AbortSignal.timeout(45_000),
      }
    );

    if (!response.ok) {
      console.warn(`⚠️ [Report] Payout route returned ${response.status} for ${customerCode}`);
      return null;
    }
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.warn(`⚠️ [Report] Payout route error for ${customerCode}:`, error.message);
    return null;
  }
};

export const getPayoutSummaryForCustomer = async (
  customerCode, rebateCodes, db = 'VCP', dateFrom = null, dateTo = null
) => {
  const EMPTY = { totalRebates: 0, totalReleased: 0, balance: 0, recordCount: 0 };

  try {
    const pool = getPool(db);
    if (!pool) return EMPTY;

    const req = pool.request().input('customerCode', sql.NVarChar(50), customerCode);

    let rebateFilter = '';
    if (Array.isArray(rebateCodes) && rebateCodes.length > 0) {
      const ph = rebateCodes.map((code, i) => {
        req.input(`rc${i}`, sql.NVarChar(50), code);
        return `@rc${i}`;
      }).join(', ');
      rebateFilter = `AND RebateCode IN (${ph})`;
    }

    let dateFilter = '';
    if (dateFrom && dateTo) {
      const fromDate = new Date(dateFrom); fromDate.setHours(0, 0, 0, 0);
      const toDate   = new Date(dateTo);   toDate.setHours(23, 59, 59, 999);
      req.input('dateFrom', sql.DateTime, fromDate);
      req.input('dateTo',   sql.DateTime, toDate);
      dateFilter = `AND CreatedDate >= @dateFrom AND CreatedDate <= @dateTo`;
    }

    const result = await req.query(`
      SELECT
        ISNULL(SUM(CASE WHEN DocumentType IS NULL     THEN BaseAmount     ELSE 0 END), 0) AS TotalRebates,
        ISNULL(SUM(CASE WHEN DocumentType IS NOT NULL THEN AmountReleased ELSE 0 END), 0) AS TotalReleased,
        COUNT(*) AS RecordCount
      FROM PayoutHistory
      WHERE CardCode = @customerCode
        ${rebateFilter}
        ${dateFilter}
        AND PayoutId NOT LIKE 'SAP-%'
        AND PayoutId NOT LIKE 'SAPDOC-%'
        AND PayoutId NOT LIKE 'BeginningBalance-%'
        AND ISNULL(Period,'') NOT LIKE 'Balance of %'
        AND ISNULL(Period,'') NOT LIKE 'Beginning Balance%'
    `);

    const row = result.recordset[0];
    const totalRebates  = parseFloat(row?.TotalRebates)  || 0;
    const totalReleased = parseFloat(row?.TotalReleased) || 0;

    return {
      totalRebates,
      totalReleased,
      balance:     totalRebates - totalReleased,
      recordCount: parseInt(row?.RecordCount) || 0,
    };
  } catch (error) {
    console.error(`❌ [Report] Summary error for ${customerCode}:`, error.message);
    return EMPTY;
  }
};

export const getPayoutSummaryFromDB = async (
  customerCode, rebateCode, db = 'VCP', dateFrom = null, dateTo = null
) => getPayoutSummaryForCustomer(
  customerCode,
  rebateCode ? [rebateCode] : [],
  db,
  dateFrom,
  dateTo
);

export const getPayoutSummaryFromMultipleRebates = getPayoutSummaryForCustomer;

export const getCustomersByMultipleRebates = async (rebateCodes, db = 'VCP') => {
  if (!rebateCodes || rebateCodes.length === 0) return getAllCustomers(db);
  const seen = new Set();
  const out  = [];
  for (const rc of rebateCodes) {
    const rows = await getCustomersByRebate(rc, db);
    for (const r of rows) {
      if (!r.CardCode || seen.has(r.CardCode)) continue;
      seen.add(r.CardCode);
      out.push(r);
    }
  }
  return out;
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 9.  Sync                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

export const syncPayoutsForRebate = async ({ rebateCode, rebateCodes, dateFrom, dateTo, db = 'VCP' }) => {
  const codes = Array.isArray(rebateCodes) && rebateCodes.length > 0
    ? rebateCodes
    : (rebateCode ? [rebateCode] : []);
  if (codes.length === 0) throw new Error('At least one rebate code is required.');

  let totalCust = 0, totalSucc = 0;

  for (const code of codes) {
    const info       = await getRebateInfo(code, db);
    const rebateType = info?.RebateType || 'Percentage';

    const rawRows   = await getCustomersByRebate(code, db);
    const customers = [...new Map(rawRows.filter(r => r.CardCode).map(r => [r.CardCode, r])).values()];

    console.log(`🔄 [Report] Syncing ${customers.length} customers (${code} · ${rebateType}) ${dateFrom || '…'}→${dateTo || '…'}…`);

    const results = await Promise.allSettled(
      customers.map(c => fetchPayoutsViaPayoutRoute(c.CardCode, code, dateFrom, dateTo, db, rebateType))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    totalCust += customers.length;
    totalSucc += succeeded;
  }

  console.log(`✅ [Report] Sync complete: ${totalSucc}/${totalCust}`);
  return { total: totalCust, succeeded: totalSucc, failed: totalCust - totalSucc };
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 10. Main report generator                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

export const generateCashFundReport = async ({
  rebateCode, rebateCodes, customerCodes, dateFrom, dateTo, db = 'VCP',
}) => {
  const codes = Array.isArray(rebateCodes) && rebateCodes.length > 0
    ? rebateCodes
    : (rebateCode ? [rebateCode] : []);

  const hasCodes     = codes.length > 0;
  const hasCustomers = Array.isArray(customerCodes) && customerCodes.length > 0;

  if (!hasCodes && !hasCustomers) {
    throw new Error('Please select at least one rebate code or at least one customer.');
  }

  console.log(
    `📊 [Report] Cash Fund (OINV-based) — rebates=[${codes.join(', ') || 'ALL'}] · ` +
    `customers=${customerCodes?.length ?? 0} · ${dateFrom} → ${dateTo}`
  );

  /* 1. Header info */
  let infos = [];
  if (hasCodes) {
    infos = (await Promise.all(codes.map(c => getRebateInfo(c, db)))).filter(Boolean);
    if (infos.length === 0) throw new Error('No valid rebate programmes found.');
  }
  const rebateType = infos[0]?.RebateType || 'Percentage';

  /* 2. Date range */
  let startDate = dateFrom;
  let endDate   = dateTo;
  if (hasCodes && (!startDate || !endDate)) {
    const minFrom = infos.reduce((m, i) => (!m || (i.DateFrom && i.DateFrom < m)) ? i.DateFrom : m, null);
    const maxTo   = infos.reduce((m, i) => (!m || (i.DateTo   && i.DateTo   > m)) ? i.DateTo   : m, null);
    startDate = startDate || minFrom;
    endDate   = endDate   || maxTo;
  }
  if (!startDate || !endDate) {
    throw new Error('Date range is required. Provide both Date From and Date To.');
  }

  /* 3. Build customer list */
  let customers = [];

  if (hasCodes) {
    const rawRows     = await getCustomersByMultipleRebates(codes, db);
    const customerMap = new Map();
    const allowed     = new Set(customerCodes || []);

    rawRows.forEach(row => {
      if (!row.CardCode) return;
      if (hasCustomers && !allowed.has(row.CardCode)) return;
      if (!customerMap.has(row.CardCode)) {
        customerMap.set(row.CardCode, { cardCode: row.CardCode, cardName: row.CardName });
      }
    });
    customers = Array.from(customerMap.values());
  } else {
    const names   = await getCustomerNamesByCodes(customerCodes, db);
    const nameMap = new Map(names.map(n => [n.CardCode, n.CardName]));
    customers = customerCodes.map(c => ({
      cardCode: c,
      cardName: nameMap.get(c) || c,
    }));
  }

  if (customers.length === 0) {
    throw new Error('No customers found for the current selection.');
  }

  console.log(`📋 [Report] ${customers.length} customer(s) for ${startDate} → ${endDate}`);

  /* 4. Process */
  const BATCH_SIZE = 4;
  const reportRows = [];

  const processCustomer = async (customer) => {
    const codesToUse = hasCodes ? codes : await getRebateCodesForCustomer(customer.cardCode, db);

    let totalEarned   = 0;
    const perCode = [];

    for (const code of codesToUse) {
      const r = await computeEarnedForCode(customer.cardCode, code, startDate, endDate, db);
      totalEarned += r.earned;
      perCode.push(`${code}=${r.earned.toFixed(2)} (${r.lines} ln/${r.items} items)`);
    }

    const { amount: totalReleased, mode: relMode } = await getReleasedAmount(
      customer.cardCode, codesToUse, startDate, endDate, db
    );

    const balance = totalEarned - totalReleased;

    const flag = (totalEarned !== 0 || totalReleased !== 0) ? '✓' : '·';
    console.log(
      `  ${flag} ${customer.cardCode}: earned=${totalEarned.toFixed(2)} ` +
      `released=${totalReleased.toFixed(2)} [${relMode}] balance=${balance.toFixed(2)} ` +
      `| ${perCode.join(' · ')}`
    );

    return {
      accountCode:   customer.cardCode,
      accountName:   customer.cardName,
      totalRebates:  totalEarned,
      totalReleased,
      balance,
    };
  };

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(processCustomer));

    batchResults.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        reportRows.push(res.value);
      } else {
        const c = batch[idx];
        console.error(`❌ [Report] Error for ${c.cardCode}:`, res.reason?.message);
        reportRows.push({
          accountCode: c.cardCode, accountName: c.cardName,
          totalRebates: 0, totalReleased: 0, balance: 0,
          error: res.reason?.message,
        });
      }
    });
  }

  reportRows.sort((a, b) => (a.accountName || '').localeCompare(b.accountName || ''));

  const totals = reportRows.reduce(
    (acc, r) => ({
      totalRebates:  acc.totalRebates  + r.totalRebates,
      totalReleased: acc.totalReleased + r.totalReleased,
      balance:       acc.balance       + r.balance,
    }),
    { totalRebates: 0, totalReleased: 0, balance: 0 }
  );

  console.log(`✅ [Report] ${reportRows.length} rows for ${startDate} → ${endDate}`);

  return {
    rebateCodes: codes,
    rebateCode:  hasCodes
      ? (codes.length === 1 ? codes[0] : `${codes.length} rebates`)
      : 'All Customers',
    rebateType,
    salesAgent:  infos.map(i => i.SlpName).filter(Boolean).join(', ') || '',
    frequency:   infos[0]?.Frequency || 'Quarterly',
    dateFrom:    startDate,
    dateTo:      endDate,
    generatedAt: new Date().toISOString(),
    reportRows,
    totals,
  };
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* 11. Prior-rebate carry-over                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

export const getPriorRebateCarryOver = async (
  customerCode, currentRebateCode, currentRebateDateFrom, db = 'VCP'
) => {
  try {
    const pool = getPool(db);
    if (!pool) return 0;

    const agentRes = await pool.request()
      .input('rebateCode', sql.NVarChar(50), currentRebateCode)
      .query(`SELECT SlpName FROM RebateProgram WHERE RebateCode = @rebateCode`);

    const slpName = agentRes.recordset[0]?.SlpName || null;

    const priorCodesReq = pool.request()
      .input('currentRebateCode', sql.NVarChar(50), currentRebateCode)
      .input('currentDateFrom',   sql.Date,         new Date(currentRebateDateFrom))
      .input('rebateType',        sql.NVarChar(50), 'Percentage');

    let agentFilter = '';
    if (slpName) {
      priorCodesReq.input('slpName', sql.NVarChar(100), slpName);
      agentFilter = 'AND SlpName = @slpName';
    }

    const priorCodesRes = await priorCodesReq.query(`
      SELECT RebateCode FROM RebateProgram
      WHERE RebateType  = @rebateType
        AND RebateCode != @currentRebateCode
        AND DateTo      < @currentDateFrom
        ${agentFilter}
    `);

    if (priorCodesRes.recordset.length === 0) return 0;

    const priorCodes = priorCodesRes.recordset.map(r => r.RebateCode);
    const ph = priorCodes.map((_, i) => `@rc${i}`).join(', ');
    const summaryReq = pool.request().input('customerCode', sql.NVarChar(50), customerCode);
    priorCodes.forEach((code, i) => summaryReq.input(`rc${i}`, sql.NVarChar(50), code));

    const summaryRes = await summaryReq.query(`
      SELECT
        ISNULL(SUM(BaseAmount),     0) AS TotalBase,
        ISNULL(SUM(AmountReleased), 0) AS TotalReleased
      FROM PayoutHistory
      WHERE CardCode = @customerCode
        AND RebateCode IN (${ph})
        AND Period NOT LIKE 'Balance of %'
        AND BaseAmount > 0
    `);

    const row      = summaryRes.recordset[0];
    const base     = parseFloat(row?.TotalBase)     || 0;
    const released = parseFloat(row?.TotalReleased) || 0;
    return Math.max(0, base - released);
  } catch (error) {
    console.error(`❌ [Report] CarryOver error for ${customerCode}:`, error.message);
    return 0;
  }
};