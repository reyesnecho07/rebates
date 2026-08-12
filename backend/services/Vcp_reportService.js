/**
 * Vcp_reportService.js
 * Service layer for the "Cash Fund per Account" report.
 *
 * Strategy
 * ─────────
 * • DB queries that mirror Vcp_dashboardRoutes (transactions, customer list)
 *   are done directly against the DB pools for speed.
 * • Payout data is first read from PayoutHistory.  If a customer has no
 *   records yet, the service calls the existing Vcp_payoutRoutes endpoint
 *   (/api/vcp/customer/:code/payouts) so that all carry-over / SAP-sync
 *   logic runs exactly once, then re-reads the populated table.
 */

import { getPool } from './databaseService.js';
import sql         from 'mssql';

// ── Internal API base (matches existing fetch() calls in payout / dashboard routes) ──
const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE || 'http://localhost:3009/api';

// ─────────────────────────────────────────────────────────────────────────────
// 1.  Rebate Program queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List all active Percentage rebate programs for the dropdown.
 */
export const getActiveRebates = async (db = 'VCP') => {
  const pool = getPool(db);
  if (!pool) throw new Error(`Database pool for ${db} not available`);

  const result = await pool.request().query(`
    SELECT
      RebateCode,
      SlpName,
      CONVERT(VARCHAR(10), DateFrom, 120) AS DateFrom,
      CONVERT(VARCHAR(10), DateTo,   120) AS DateTo,
      Frequency,
      IsActive
    FROM RebateProgram
    WHERE RebateType = 'Percentage'
      AND IsActive   = 1
    ORDER BY DateFrom DESC, RebateCode DESC
  `);

  return result.recordset;
};

/**
 * Single rebate program header row.
 */
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
        IsActive, Frequency
      FROM RebateProgram
      WHERE RebateCode = @rebateCode
    `);

  return result.recordset[0] || null;
};

/**
 * Get all customers enrolled in a Percentage rebate.
 * Mirrors the query used in Vcp_dashboardRoutes /rebates-summary.
 */
export const getCustomersByRebate = async (rebateCode, db = 'VCP') => {
  const pool = getPool(db);
  if (!pool) throw new Error(`Database pool for ${db} not available`);

  const result = await pool.request()
    .input('rebateCode', sql.NVarChar(50), rebateCode)
    .query(`
      SELECT DISTINCT
        T0.RebateCode,
        T0.RebateType,
        T0.SlpName,
        T0.DateFrom,
        T0.DateTo,
        T0.IsActive,
        T0.Frequency,
        T1.CardCode,
        T1.CardName,
        T1.QtrRebate,
        T2.Month,
        T2.TargetQty,
        T3.ItemCode,
        T3.ItemName,
        T3.PercentagePerBag,
        T3.UnitPerQty,
        ISNULL(T1.CreatedDate, T0.CreatedDate) AS CreatedDate
      FROM RebateProgram T0
        LEFT JOIN PerCustRebate T1 ON T0.RebateCode = T1.RebateCode
        LEFT JOIN PerCustQuota  T2 ON T1.Id = T2.PerCustRebateId
        LEFT JOIN PerProdRebate T3 ON T0.RebateCode = T3.RebateCode
      WHERE T0.RebateType = 'Percentage'
        AND T0.IsActive   = 1
        AND T0.RebateCode = @rebateCode
        AND T1.CardCode IS NOT NULL
        AND LTRIM(RTRIM(T1.CardCode)) != ''
      ORDER BY T1.CardName
    `);

  return result.recordset;
};

/**
 * Item codes that belong to a Percentage rebate (for SAP invoice filter).
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// 2.  SAP invoice totals  (mirrors router.get('/customer/:customerCode/daily-transactions'))
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns total CTNs (SUM Quantity) and Total P.Value (SUM GTotal) from OINV/INV1
 * for a customer within the date range, optionally filtered to specific item codes.
 */
export const getSAPInvoiceTotals = async (customerCode, dateFrom, dateTo, itemCodes = []) => {
  try {
    const sapPool = getPool('VCP');
    if (!sapPool) {
      console.warn(`⚠️ [Report] SAP pool unavailable for ${customerCode}`);
      return { totalCTNs: 0, totalPValue: 0 };
    }

    const request = sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('dateFrom',     sql.Date,         new Date(dateFrom))
      .input('dateTo',       sql.Date,         new Date(dateTo));

    let itemFilter = '';
    if (itemCodes.length > 0) {
      const params = itemCodes.map((_, i) => `@ic${i}`).join(', ');
      itemCodes.forEach((code, i) => request.input(`ic${i}`, sql.NVarChar(50), code));
      itemFilter = `AND T1.ItemCode IN (${params})`;
    }

    const result = await request.query(`
      SELECT
        ISNULL(SUM(T0.Quantity), 0) AS TotalCTNs,
        ISNULL(SUM(T0.GTotal),   0) AS TotalPValue
      FROM OINV T0
      WHERE T0.CardCode  = @customerCode
        AND T0.DocType   = 'I'
        AND T0.DocDate  >= @dateFrom
        AND T0.DocDate  <= @dateTo
        ${itemFilter}
    `);

    return {
      totalCTNs:   parseFloat(result.recordset[0]?.TotalCTNs)   || 0,
      totalPValue: parseFloat(result.recordset[0]?.TotalPValue)  || 0
    };
  } catch (error) {
    console.error(`❌ [Report] SAP totals error for ${customerCode}:`, error.message);
    return { totalCTNs: 0, totalPValue: 0 };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3.  Payout data — call existing Vcp_payoutRoutes then read PayoutHistory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls the existing /api/vcp/customer/:customerCode/payouts endpoint.
 * This ensures SAP sync (JE / AR / AP) and carry-over logic run exactly
 * as defined in Vcp_payoutRoutes — no duplication of that logic here.
 */
export const fetchPayoutsViaPayoutRoute = async (
  customerCode, rebateCode, dateFrom, dateTo, db = 'VCP'
) => {
  try {
    const qs = new URLSearchParams({
      db,
      rebateCode,
      rebateType:      'Percentage',
      periodFrom:      dateFrom,
      periodTo:        dateTo,
      useRebatePeriod: 'false'
    });

    const url      = `${INTERNAL_API_BASE}/vcp/customer/${customerCode}/payouts?${qs}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal:  AbortSignal.timeout(45_000)
    });

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

/**
 * Read payout summary directly from PayoutHistory (after the route above has
 * populated / synced it).  Returns the simplest possible aggregation:
 *   balance        = SUM(BaseAmount) - SUM(AmountReleased)
 *   amountReleased = SUM(AmountReleased)
 */
export const getPayoutSummaryFromDB = async (customerCode, rebateCode, db = 'VCP') => {
  try {
    const pool = getPool(db);
    if (!pool) return { totalAmount: 0, balance: 0, amountReleased: 0, sapReleased: 0, recordCount: 0 };

    const result = await pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('rebateCode',   sql.NVarChar(50), rebateCode)
      .query(`
        SELECT
          ISNULL(SUM(RebateBalance),        0) AS TotalBase,
          ISNULL(SUM(AmountReleased),       0) AS TotalReleased,
          ISNULL(SUM(SapReleasedAmount),    0) AS TotalSapReleased,
          COUNT(*)                             AS RecordCount,
          ISNULL(
            (SELECT TOP 1 TotalAmount
             FROM PayoutHistory
             WHERE CardCode   = @customerCode
               AND RebateCode = @rebateCode
               AND Period     NOT LIKE 'Balance of %'
               AND PayoutId   NOT LIKE 'SAP-%'
               AND BaseAmount > 0
             ORDER BY Id DESC),
            0
          ) AS LastTotalAmount
        FROM PayoutHistory
        WHERE CardCode   = @customerCode
          AND RebateCode = @rebateCode
          AND Period     NOT LIKE 'Balance of %'
          AND BaseAmount > 0
      `);

    const row           = result.recordset[0];
    const totalBase     = parseFloat(row?.TotalBase)        || 0;  // SUM(RebateBalance)
    const totalReleased = parseFloat(row?.TotalReleased)    || 0;
    const totalSapRel   = parseFloat(row?.TotalSapReleased) || 0;
    const lastTotal     = parseFloat(row?.LastTotalAmount)  || 0;

    return {
      totalAmount:    lastTotal,
      balance:        Math.max(0, totalBase - totalReleased),
      rebateBalance:  totalBase,                               // ← raw SUM(RebateBalance)
      amountReleased: totalReleased,
      sapReleased:    totalSapRel,
      recordCount:    parseInt(row?.RecordCount) || 0,
    };
  } catch (error) {
    console.error(`❌ [Report] PayoutHistory query error for ${customerCode}:`, error.message);
    return { totalAmount: 0, balance: 0, amountReleased: 0, sapReleased: 0, recordCount: 0 };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4.  Optional pre-sync (call before generating report for freshest data)
// ─────────────────────────────────────────────────────────────────────────────

export const syncPayoutsForRebate = async ({ rebateCode, dateFrom, dateTo, db = 'VCP' }) => {
  const rawRows  = await getCustomersByRebate(rebateCode, db);
  const customers = [
    ...new Map(rawRows.filter(r => r.CardCode).map(r => [r.CardCode, r])).values()
  ];

  console.log(`🔄 [Report] Syncing payouts for ${customers.length} customers (${rebateCode})…`);

  const results = await Promise.allSettled(
    customers.map(c =>
      fetchPayoutsViaPayoutRoute(c.CardCode, rebateCode, dateFrom, dateTo, db)
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
  console.log(`✅ [Report] Sync complete: ${succeeded}/${customers.length}`);

  return { total: customers.length, succeeded, failed: customers.length - succeeded };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5.  Main report generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate the Cash Fund per Account report.
 *
 * For each customer enrolled in the selected Percentage rebate:
 *   • totalCTNs               → SUM(INV1.Quantity) in the date range
 *   • totalPValue             → SUM(INV1.GTotal)   in the date range
 *   • totalAvailableCashFunds → rebate balance (earned − released)
 *   • totalCashFundsReleased  → amount already paid out to the customer
 *
 * @param {{ rebateCode, dateFrom, dateTo, db }} params
 */
  export const generateCashFundReport = async ({ rebateCode, customerCodes, dateFrom, dateTo, db = 'VCP' }) => {
  console.log(`📊 [Report] Cash Fund — rebate=${rebateCode}  ${dateFrom} → ${dateTo}`);

  // 1.  Rebate program header
  const rebateInfo = await getRebateInfo(rebateCode, db);
  if (!rebateInfo) throw new Error(`Rebate program "${rebateCode}" not found.`);

  // 2.  Resolve date range (fall back to rebate program dates)
  const startDate = dateFrom || rebateInfo.DateFrom;
  const endDate   = dateTo   || rebateInfo.DateTo;
  if (!startDate || !endDate) {
    throw new Error('Date range is required. Provide dateFrom / dateTo or ensure the rebate has DateFrom / DateTo set.');
  }

  // 3.  Customers + item codes
// 3.  Customers + item codes
const rawRows = await getCustomersByRebate(rebateCode, db);

const customerMap = new Map();
const itemCodeSet  = new Set();

// Filter to only include customers specified in customerCodes (if provided)
const allowedCodes = new Set(customerCodes || []);

rawRows.forEach(row => {
  if (!row.CardCode) return;
  
  // If customerCodes array is provided, skip customers not in the list
  if (customerCodes && customerCodes.length > 0 && !allowedCodes.has(row.CardCode)) {
    return;
  }
  
  if (!customerMap.has(row.CardCode)) {
    customerMap.set(row.CardCode, { cardCode: row.CardCode, cardName: row.CardName });
  }
  if (row.ItemCode) itemCodeSet.add(row.ItemCode);
});

if (customerMap.size === 0) {
  const suffix = customerCodes && customerCodes.length > 0 
    ? ' matching the selected customers' 
    : '';
  throw new Error(`No active customers found for rebate "${rebateCode}"${suffix}.`);
}

  const itemCodes = Array.from(itemCodeSet);
  const customers = Array.from(customerMap.values());
  console.log(`📋 [Report] ${customers.length} customers · ${itemCodes.length} items`);

  // 4.  Process customers in parallel batches of 5
  const BATCH_SIZE = 5;
  const reportRows = [];

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (customer) => {

        // SAP invoice totals — mirrors daily-transactions / transactions routes
        const sapTotals = await getSAPInvoiceTotals(
          customer.cardCode, startDate, endDate, itemCodes
        );

        // Payout — read from DB first; call payout route if not yet populated
        let payout = await getPayoutSummaryFromDB(customer.cardCode, rebateCode, db);

        if (payout.recordCount === 0) {
          console.log(`  ℹ️  [Report] No PayoutHistory for ${customer.cardCode} — calling payout route…`);
          await fetchPayoutsViaPayoutRoute(
            customer.cardCode, rebateCode, startDate, endDate, db
          );
          payout = await getPayoutSummaryFromDB(customer.cardCode, rebateCode, db);
        }

        // Prefer manual AmountReleased; fall back to SAP-synced amount
        const cashFundsReleased =
          payout.amountReleased > 0 ? payout.amountReleased : payout.sapReleased;


        // AFTER
        return {
          accountCode:             customer.cardCode,
          accountName:             customer.cardName,
          totalCTNs:               sapTotals.totalCTNs,
          totalPValue:             sapTotals.totalPValue,
          totalAvailableCashFunds: payout.rebateBalance,  // SUM(RebateBalance) - SUM(AmountReleased)
          totalCashFundsReleased:  cashFundsReleased
        };
      })
    );

    batchResults.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        reportRows.push(res.value);
      } else {
        const c = batch[idx];
        console.error(`❌ [Report] Error for ${c.cardCode}:`, res.reason?.message);
        reportRows.push({
          accountCode:             c.cardCode,
          accountName:             c.cardName,
          totalCTNs:               0,
          totalPValue:             0,
          totalAvailableCashFunds: 0,
          totalCashFundsReleased:  0,
          error:                   res.reason?.message
        });
      }
    });
  }

  // 5.  Sort by name, compute totals
  reportRows.sort((a, b) => (a.accountName || '').localeCompare(b.accountName || ''));

  const totals = reportRows.reduce(
    (acc, r) => ({
      totalCTNs:               acc.totalCTNs               + r.totalCTNs,
      totalPValue:             acc.totalPValue             + r.totalPValue,
      totalAvailableCashFunds: acc.totalAvailableCashFunds + r.totalAvailableCashFunds,
      totalCashFundsReleased:  acc.totalCashFundsReleased  + r.totalCashFundsReleased
    }),
    { totalCTNs: 0, totalPValue: 0, totalAvailableCashFunds: 0, totalCashFundsReleased: 0 }
  );

  console.log(`✅ [Report] ${reportRows.length} rows generated`);

  return {
    rebateCode,
    salesAgent:  rebateInfo.SlpName   || '',
    frequency:   rebateInfo.Frequency || 'Quarterly',
    dateFrom:    startDate,
    dateTo:      endDate,
    generatedAt: new Date().toISOString(),
    reportRows,
    totals
  };
};



/**
 * Returns the total UNRELEASED balance from all prior Percentage rebates
 * for the same sales agent (SlpName) that ended before the current rebate's DateFrom.
 *
 * This is the "carry-over" that accumulates when a customer hasn't been fully
 * paid out across previous rebate periods.
 */
export const getPriorRebateCarryOver = async (
  customerCode,
  currentRebateCode,
  currentRebateDateFrom, // the DateFrom of the rebate being reported
  db = 'VCP'
) => {
  try {
    const pool = getPool(db);
    if (!pool) return 0;

    // Step 1: get the SlpName (sales agent) of the current rebate
    // so we only carry over balances from the same agent's programmes
    const agentRes = await pool.request()
      .input('rebateCode', sql.NVarChar(50), currentRebateCode)
      .query(`
        SELECT SlpName
        FROM RebateProgram
        WHERE RebateCode = @rebateCode
      `);

    const slpName = agentRes.recordset[0]?.SlpName || null;

    // Step 2: find all prior Percentage rebate codes for the same agent
    // whose DateTo is before (or equal to) the day before current DateFrom
    const priorCodesReq = pool.request()
      .input('currentRebateCode',  sql.NVarChar(50), currentRebateCode)
      .input('currentDateFrom',    sql.Date,         new Date(currentRebateDateFrom))
      .input('rebateType',         sql.NVarChar(50), 'Percentage');

    let agentFilter = '';
    if (slpName) {
      priorCodesReq.input('slpName', sql.NVarChar(100), slpName);
      agentFilter = 'AND SlpName = @slpName';
    }

    const priorCodesRes = await priorCodesReq.query(`
      SELECT RebateCode
      FROM RebateProgram
      WHERE RebateType   = @rebateType
        AND RebateCode  != @currentRebateCode
        AND DateTo       < @currentDateFrom
        ${agentFilter}
    `);

    if (priorCodesRes.recordset.length === 0) return 0;

    const priorCodes = priorCodesRes.recordset.map(r => r.RebateCode);

    // Step 3: sum up unreleased balances from PayoutHistory for those codes
    const placeholders = priorCodes.map((_, i) => `@rc${i}`).join(', ');
    const summaryReq = pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode);
    priorCodes.forEach((code, i) => summaryReq.input(`rc${i}`, sql.NVarChar(50), code));

    const summaryRes = await summaryReq.query(`
      SELECT
        ISNULL(SUM(BaseAmount),     0) AS TotalBase,
        ISNULL(SUM(AmountReleased), 0) AS TotalReleased
      FROM PayoutHistory
      WHERE CardCode    = @customerCode
        AND RebateCode IN (${placeholders})
        AND Period NOT LIKE 'Balance of %'
        AND BaseAmount   > 0
    `);

    const row     = summaryRes.recordset[0];
    const base     = parseFloat(row?.TotalBase)     || 0;
    const released = parseFloat(row?.TotalReleased) || 0;

    // Carry-over is only positive — never let it go negative
    return Math.max(0, base - released);

  } catch (error) {
    console.error(
      `❌ [Report] CarryOver error for ${customerCode}:`, error.message
    );
    return 0;
  }
};