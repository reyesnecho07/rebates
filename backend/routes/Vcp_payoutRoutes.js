import express from 'express';
import sql from 'mssql';
import { getPool } from '../services/databaseService.js';
const router = express.Router();

const REDEMPTION_PREFIX = 'Redemption';

const MIN_LINE_VALUE = 1;   // ignore Percentage lines with a peso value under ₱1 (dust rows)

/* ══════════════════════════════════════════════════════════════════
   QTR REBATE HELPERS
   Normalised comparisons so 'With Quota' / 'WithQuota' / 'with quota'
   and any casing/spacing of the Frequency text all behave the same.
   ══════════════════════════════════════════════════════════════════ */
const normalizeKey = (v) => String(v || '').replace(/\s+/g, '').toLowerCase();

/**
 * Round half-up to 2 decimals, symmetric for negatives.
 *  - 1050.4225 → 1050.42   (3rd+ decimals < 5 → no round up)
 *  - 1050.425  → 1050.43
 * The toFixed(8) pre-step strips floating-point noise
 * (e.g. 6844.872500000001) before the decimal-shift rounding.
 * Use ONLY on final totals — never on individual lines before summing.
 */
const round2 = (n) => {
  const v = parseFloat(n) || 0;
  if (v === 0) return 0;
  const sign = v < 0 ? -1 : 1;
  const abs = Number(Math.abs(v).toFixed(8));          // strips float noise
  return sign * (Math.floor(abs * 100 + 0.5) / 100);   // 6844.8725 → 6844.87, 6844.8788 → 6844.88
};

const isWithQuotaType = (quotaType) => normalizeKey(quotaType) === 'withquota';

// Only these program frequencies can carry a customer QTR rebate
const QTR_FREQUENCY_KEYS = [
  'Quarterly',
  'Monthly w/ Cust. Qtr. Rebate',
].map(normalizeKey);

const isQtrFrequencyType = (frequency) => QTR_FREQUENCY_KEYS.includes(normalizeKey(frequency));

/* ══════════════════════════════════════════════════════════════════
   BEGINNING BALANCE — prior-years earned − prior-years released
   (per REBATE CODE, not per customer)
   ══════════════════════════════════════════════════════════════════ */
const getBeginningBalanceForCustomer = async (customerCode, rebateCode, pool) => {
  try {
    const currentYear = new Date().getFullYear();

    const earnedResult = await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('rc', sql.NVarChar(50), rebateCode)
      .input('curYear', sql.Int, currentYear)
      .query(`
        SELECT ISNULL(SUM(BaseAmount), 0) AS TotalEarned
        FROM PayoutHistory
        WHERE CardCode = @cc
          AND RebateCode = @rc
          AND PayoutId NOT LIKE '${REDEMPTION_PREFIX}-%'
          AND PayoutId NOT LIKE 'SAP-%'
          AND PayoutId NOT LIKE 'SAPDOC-%'
          AND PayoutId NOT LIKE 'BeginningBalance-%'
          AND Period IS NOT NULL
          AND Period NOT LIKE 'Balance of %'
          AND Period NOT LIKE 'Beginning Balance%'
          AND TRY_CAST(RIGHT(LTRIM(RTRIM(Period)), 4) AS INT) < @curYear
      `);

    const redResult = await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('rc', sql.NVarChar(50), rebateCode)
      .input('curYear', sql.Int, currentYear)
      .query(`
        SELECT ISNULL(SUM(AmountReleased), 0) AS TotalReleased
        FROM PayoutHistory
        WHERE CardCode = @cc
          AND RebateCode = @rc
          AND PayoutId LIKE '${REDEMPTION_PREFIX}-%'
          AND Period IS NOT NULL
          AND TRY_CAST(RIGHT(LTRIM(RTRIM(Period)), 4) AS INT) < @curYear
      `);

    const earned   = parseFloat(earnedResult.recordset[0]?.TotalEarned) || 0;
    const released = parseFloat(redResult.recordset[0]?.TotalReleased)  || 0;
    const bal      = round2(earned - released);

    console.log(`💰 [BEG-BAL] ${customerCode}/${rebateCode} (year ${currentYear} opening): Earned ₱${earned.toFixed(2)} − Released ₱${released.toFixed(2)} = ₱${bal.toFixed(2)}`);
    return bal;
  } catch (err) {
    console.error('❌ getBeginningBalanceForCustomer:', err.message);
    return 0;
  }
};

/* ══════════════════════════════════════════════════════════════════
   MAIN GET — PAYOUTS
   ══════════════════════════════════════════════════════════════════ */
router.get('/customer/:customerCode/payouts', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode, rebateType, periodFrom, periodTo, useRebatePeriod } = req.query;

    console.log('💰 [VCP] Fetching payouts for customer:', {
      customerCode, rebateCode, rebateType, periodFrom, periodTo, useRebatePeriod
    });

    if (!customerCode || !rebateCode || !rebateType) {
      return res.status(400).json({
        success: false,
        message: 'Customer code, rebate code, and rebate type are required'
      });
    }

    const databaseToUse = db || 'VCP';
    const ownPool = getPool(databaseToUse);
    if (!ownPool) {
      return res.status(500).json({ success: false, message: 'Database pool not available' });
    }

    const rebateProgramResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(`
        SELECT DateFrom, DateTo, IsActive, Frequency, QuotaType
        FROM RebateProgram
        WHERE RebateCode = @rebateCode
      `);

    let rebateDateFrom = '', rebateDateTo = '', isActive = false;
    let frequency = 'Quarterly', quotaType = 'N/A';

    if (rebateProgramResult.recordset.length > 0) {
      const rec = rebateProgramResult.recordset[0];
      rebateDateFrom = rec.DateFrom ? new Date(rec.DateFrom).toISOString().split('T')[0] : '';
      rebateDateTo   = rec.DateTo   ? new Date(rec.DateTo).toISOString().split('T')[0]   : '';
      isActive       = rec.IsActive === 1;
      frequency      = rec.Frequency || 'Quarterly';
      quotaType      = rec.QuotaType || 'N/A';
    }

    console.log('📊 Rebate Program Details:', { frequency, quotaType, dateFrom: rebateDateFrom, dateTo: rebateDateTo, isActive });

    let startDate, endDate, dateSource = 'manual';
    if (periodFrom && periodTo) {
      startDate = periodFrom; endDate = periodTo; dateSource = 'manual';
    } else if (useRebatePeriod === 'true' && rebateDateFrom && rebateDateTo && isActive) {
      startDate = rebateDateFrom; endDate = rebateDateTo; dateSource = 'rebate_period';
    } else if (rebateDateFrom && rebateDateTo) {
      startDate = rebateDateFrom; endDate = rebateDateTo; dateSource = 'rebate_period_fallback';
    } else {
      const currentYear = new Date().getFullYear();
      startDate = `${currentYear}-01-01`;
      endDate = new Date().toISOString().split('T')[0];
      dateSource = 'current_year';
    }

    console.log('📅 [VCP] Payout date range:', { startDate, endDate, dateSource, frequency });
    let redemptionFrom = rebateDateFrom || startDate;
    let redemptionTo   = rebateDateTo   || endDate;

    if (rebateDateTo) {
      const rebateYear = new Date(rebateDateTo).getFullYear();
      const yearEnd    = `${rebateYear}-12-31`;
      if (yearEnd > redemptionTo) {
        redemptionTo = yearEnd;
      }
    }

    console.log(`📊 [SAP] Fetching for ${customerCode} from ${redemptionFrom} to ${redemptionTo} (redemption scope)`);
    const sapData = await fetchSAPJournalEntries(customerCode, redemptionFrom, redemptionTo, ownPool);

    if (sapData.success) {
      console.log(`✅ [SAP] Found ${sapData.entries.length} periods`);
    } else {
      console.log('⚠️ [SAP] Could not fetch SAP entries');
    }

    let monthlyData = [];
    try {
      const transactionsResponse = await fetch(
        `http://localhost:3009/api/vcp/dashboard/customer/${customerCode}/transactions?` +
        `db=${databaseToUse}&rebateCode=${rebateCode}&rebateType=${rebateType}&` +
        `periodFrom=${startDate}&periodTo=${endDate}&useRebatePeriod=${useRebatePeriod}`
      );

      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        if (transactionsData.success && transactionsData.data.transactions) {
          console.log(`📊 [VCP] Found ${transactionsData.data.transactions.length} transactions`);

          monthlyData = await calculateMonthlyPayoutData(
            transactionsData.data.transactions,
            rebateType,
            customerCode,
            rebateCode,
            ownPool,
            frequency,
            [],
            quotaType
          );

          console.log(`📈 [VCP] Calculated ${monthlyData.length} monthly earned records`);
        } else {
          console.log('⚠️ [VCP] No transaction data');
        }
      } else {
        console.log('⚠️ [VCP] Could not fetch transaction data');
      }
    } catch (transError) {
      console.error('❌ [VCP] Error fetching transactions:', transError.message);
    }

    await createPayoutHistoryTable(ownPool);

    try {
      await saveEarnedPayoutsToDatabase(monthlyData, ownPool, rebateCode, customerCode);
    } catch (saveErr) {
      console.error('❌ [VCP] Error saving earned payouts:', saveErr.message);
    }

    // ── Redemption rows: only insert docs that fall INSIDE this rebate's period ──
    if (sapData.success && sapData.entries.length > 0) {
      try {
        const rebateFrom = redemptionFrom ? new Date(redemptionFrom) : null;
        const rebateTo   = redemptionTo   ? new Date(redemptionTo)   : null;
        if (rebateFrom) rebateFrom.setHours(0, 0, 0, 0);
        if (rebateTo)   rebateTo.setHours(23, 59, 59, 999);

        await insertRedemptionRows(
          customerCode,
          rebateCode,
          sapData.entries,
          ownPool,
          rebateFrom,
          rebateTo
        );
      } catch (redErr) {
        console.error('❌ [VCP] Error inserting redemption rows:', redErr.message);
      }
    }

    const previousBalance = await getBeginningBalanceForCustomer(customerCode, rebateCode, ownPool);
    let beginningBalanceRecord = null;
    if (previousBalance > 0) {
      beginningBalanceRecord = createBeginningBalanceRecord(customerCode, rebateCode, rebateType, previousBalance);
    }

    let finalPayouts = [];
    try {
      const finalPayoutsQuery = `
        SELECT
          Id, PayoutId, CardCode, RebateCode, RebateType,
          PayoutDate           AS Date,
          Period,
          BaseAmount,
          TotalAmount          AS Amount,
          TotalAmount,
          Status,
          AmountReleased,
          SapReleasedAmount,
          SapLastSync,
          DocumentType,
          DocumentNumber,
          ReleaseDate,
          RebateBalance        AS Balance,
          ISNULL(CarriedOverTo,  '') AS CarriedOverTo,
          ISNULL(CarryOverNote,  '') AS CarryOverNote,
          CreatedDate,
          UpdatedDate,
          0                    AS IsBeginningBalance
        FROM PayoutHistory
        WHERE CardCode   = @customerCode
          AND RebateCode = @rebateCode
          AND ISNULL(Period, '') NOT LIKE 'Balance of %'
          AND ISNULL(Period, '') NOT LIKE 'Beginning Balance%'
          AND PayoutId   NOT LIKE 'SAP-%'
          AND PayoutId   NOT LIKE 'SAPDOC-%'
          AND PayoutId   NOT LIKE 'BeginningBalance-%'
          AND PayoutId   NOT LIKE 'OOP-%'
        ORDER BY Id ASC
      `;

      const finalPayoutsResult = await ownPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(finalPayoutsQuery);

      finalPayouts = finalPayoutsResult.recordset;
      console.log(`📊 [VCP] Final rows: ${finalPayouts.length}`);
    } catch (error) {
      console.error('❌ [VCP] Error fetching final payouts:', error.message);
    }

    const redemptions = finalPayouts
      .filter(p => p.DocumentType)
      .map(p => ({
        period: p.Period,
        sourceType: p.DocumentType,
        documentNumber: p.DocumentNumber || '',
        documentType: p.DocumentType,
        amount: parseFloat(p.AmountReleased) || 0,
        date: p.Date,
      }));

    const totalRedemptionSigned = redemptions.reduce((s, r) => s + r.amount, 0);
    const totalEarned = finalPayouts.reduce((s, p) => {
      if (p.DocumentType) return s;
      return s + (parseFloat(p.BaseAmount) || 0);
    }, 0);

    const hasBeginningBalance = previousBalance > 0 && beginningBalanceRecord !== null;

    res.json({
      success: true,
      data: {
        monthlyRaw: monthlyData.map(m => ({ period: m.period, rawAmount: m.rawAmount })),
        payouts: finalPayouts,
        beginningBalances: hasBeginningBalance ? [beginningBalanceRecord] : [],
        regularPayouts: finalPayouts.filter(p => !p.DocumentType),
        previousBalance: hasBeginningBalance ? previousBalance : 0,
        beginningBalanceRecord: hasBeginningBalance ? beginningBalanceRecord : null,
        customerCode,
        rebateCode,
        rebateType,
        frequency,

        redemptions,
        redemptionSummary: {
          netReleased: totalRedemptionSigned,
          documentCount: redemptions.length,
        },

        earnedSummary: { totalEarned },

        sapData: {
          available: sapData.success,
          periodsFound: sapData.entries.length,
          lastSync: new Date().toISOString(),
        },
        dateRange: {
          periodFrom: startDate,
          periodTo: endDate,
          autoLoaded: dateSource !== 'manual',
          dateSource,
          rebatePeriodAvailable: !!(rebateDateFrom && rebateDateTo),
          rebatePeriod: { from: rebateDateFrom, to: rebateDateTo },
        },
        autoSynced: false,
      }
    });
  } catch (error) {
    console.error('❌ [VCP] Error fetching payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payout data',
      error: error.message,
      stack: error.stack,
    });
  }
});

/* ══════════════════════════════════════════════════════════════════
   BEGINNING BALANCE RECORD
   ══════════════════════════════════════════════════════════════════ */
const createBeginningBalanceRecord = (customerCode, rebateCode, rebateType, previousBalance) => {
  try {
    const currentYear = new Date().getFullYear();
    const formattedDate = `12.31.${String(currentYear - 1).slice(-2)}`;

    return {
      Id: `BeginningBalance-${customerCode}-${rebateCode}-${Date.now()}`,
      PayoutId: `BeginningBalance-${customerCode}-${rebateCode}`,
      CardCode: customerCode,
      RebateCode: rebateCode,
      RebateType: rebateType,
      Date: formattedDate,
      Period: 'Beginning Balance',
      BaseAmount: 0,
      TotalAmount: 0,
      Amount: 0,
      Status: 'Beginning Balance',
      AmountReleased: 0,
      SapReleasedAmount: 0,
      Balance: previousBalance,
      ReleaseDate: null,
      CreatedDate: new Date().toISOString().split('T')[0],
      UpdatedDate: new Date().toISOString().split('T')[0],
      PreviousBalance: previousBalance,
      isBeginningBalance: true,
      CalculationNote: `Previous year balance carried forward: ₱${previousBalance.toFixed(2)}`,
      displayType: 'beginning_balance',
    };
  } catch (error) {
    console.error('❌ createBeginningBalanceRecord:', error.message);
    return null;
  }
};

/* ══════════════════════════════════════════════════════════════════
   CALCULATE MONTHLY — earned only
   ★ Percentage: unchanged from original working version
   ★ Fixed: per-item RebatePerBag from FixProdRebate
   ★ Incremental: sums each eligible line's qty × its own RebatePerBag

   ★ ROUNDING RULE: every per-line rebate stays RAW (unrounded). The
     lines are summed, and the month total is rounded ONCE (round2).
     The QTR step also works from the raw month total.

   ★ QTR REBATE (reworked)
     The customer's QtrRebate is read from PerCustRebate / FixCustRebate /
     IncCustRebate (depending on rebate type). It is applied ONLY when:
        1. QuotaType is "With Quota"
        2. Program Frequency is "Quarterly" or "Monthly w/ Cust. Qtr. Rebate"
        3. The customer's QtrRebate is > 0
        4. The customer met the quota in ALL 3 months of a calendar quarter
     When those are true, EACH of the 3 months in that quarter gets its own
     QTR amount (month earned × QtrRebate) ADDED to that month's earned
     rebate. No separate quarterly row is created, so nothing is double
     counted.
   ══════════════════════════════════════════════════════════════════ */
const calculateMonthlyPayoutData = async (
  transactions,
  rebateType,
  customerCode,
  rebateCode,
  pool,
  frequency = 'Quarterly',
  sapEntries = [],
  quotaType = 'N/A'
) => {
  try {
    console.log(`📊 calculateMonthly: ${customerCode} / ${rebateCode} type=${rebateType} freq=${frequency} quota=${quotaType}`);

    const rebatePeriodResult = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(`SELECT DateFrom, DateTo FROM RebateProgram WHERE RebateCode = @rebateCode`);

    let programStartDate = new Date();
    let programEndDate = new Date();
    if (rebatePeriodResult.recordset.length > 0) {
      const rec = rebatePeriodResult.recordset[0];
      if (rec.DateFrom) programStartDate = new Date(rec.DateFrom);
      if (rec.DateTo)   programEndDate   = new Date(rec.DateTo);
    }

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

    let baseRebatePerBag = 0;
    let qtrRebate = 0;
    let itemPercentageMap = new Map();
    let itemFixedRateMap  = new Map();   // ItemCode → RebatePerBag for Fixed
    let customerQuotas = {};

    const isWithQuota    = isWithQuotaType(quotaType);
    const isQtrFrequency = isQtrFrequencyType(frequency);

    if (rebateType === 'Percentage') {
      // ── Percentage setup ──
      try {
        const percentageResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT ItemCode, PercentagePerBag FROM PerProdRebate WHERE RebateCode = @rebateCode`);
        percentageResult.recordset.forEach(row => {
          if (row.ItemCode && row.PercentagePerBag) {
            itemPercentageMap.set(row.ItemCode, parseFloat(row.PercentagePerBag) || 0);
          }
        });
      } catch (error) {
        console.log(`⚠️ [PER] Item percentage fetch failed for ${rebateCode}: ${error.message}`);
      }

      // ★ QtrRebate — always fetched; applied later only if all conditions are met
      try {
        const qtrRebateResult = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT QtrRebate FROM PerCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`);
        if (qtrRebateResult.recordset.length > 0) {
          qtrRebate = parseFloat(qtrRebateResult.recordset[0].QtrRebate) || 0;
        }
        console.log(`💰 [QTR] Percentage ${customerCode}/${rebateCode} → QtrRebate=${qtrRebate}`);
      } catch (qtrErr) {
        console.log(`⚠️ [QTR] Percentage fetch failed for ${customerCode}/${rebateCode}: ${qtrErr.message}`);
      }

      try {
        const quotaResult = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`
            SELECT T2.Month, T2.TargetQty
            FROM PerCustRebate T1
            INNER JOIN PerCustQuota T2 ON T1.Id = T2.PerCustRebateId
            WHERE T1.CardCode = @customerCode AND T1.RebateCode = @rebateCode
          `);
        quotaResult.recordset.forEach(row => {
          if (row.Month && row.TargetQty !== null) customerQuotas[row.Month] = row.TargetQty;
        });
      } catch (quotaError) { /* silent */ }

    } else if (rebateType === 'Fixed') {
      // ── Fixed setup: fetch ALL item-level rates ──
      try {
        const fixedResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT ItemCode, RebatePerBag FROM FixProdRebate WHERE RebateCode = @rebateCode`);

        fixedResult.recordset.forEach(row => {
          const rate = parseFloat(row.RebatePerBag) || 0;
          if (row.ItemCode) itemFixedRateMap.set(row.ItemCode, rate);
          if (baseRebatePerBag === 0 && rate > 0) baseRebatePerBag = rate;
        });
      } catch (error) {
        console.log(`⚠️ [FIX] Item rate fetch failed for ${rebateCode}: ${error.message}`);
      }

      // ★ QtrRebate
      try {
        const qtrRebateResult = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT QtrRebate FROM FixCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`);
        if (qtrRebateResult.recordset.length > 0) {
          qtrRebate = parseFloat(qtrRebateResult.recordset[0].QtrRebate) || 0;
        }
        console.log(`💰 [QTR] Fixed ${customerCode}/${rebateCode} → QtrRebate=${qtrRebate}`);
      } catch (qtrErr) {
        console.log(`⚠️ [QTR] Fixed fetch failed for ${customerCode}/${rebateCode}: ${qtrErr.message}`);
      }

      try {
        const quotaResult = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`
            SELECT T2.Month, T2.TargetQty
            FROM FixCustRebate T1
            INNER JOIN FixCustQuota T2 ON T1.Id = T2.CustRebateId
            WHERE T1.CardCode = @customerCode AND T1.RebateCode = @rebateCode
          `);
        quotaResult.recordset.forEach(row => {
          if (row.Month && row.TargetQty !== null) customerQuotas[row.Month] = row.TargetQty;
        });
      } catch (quotaError) { /* silent */ }

    } else if (rebateType === 'Incremental') {
      // ★ QtrRebate
      try {
        const qtrRebateResult = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT QtrRebate FROM IncCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`);
        if (qtrRebateResult.recordset.length > 0) {
          qtrRebate = parseFloat(qtrRebateResult.recordset[0].QtrRebate) || 0;
        }
        console.log(`💰 [QTR] Incremental ${customerCode}/${rebateCode} → QtrRebate=${qtrRebate}`);
      } catch (qtrErr) {
        console.log(`⚠️ [QTR] Incremental fetch failed for ${customerCode}/${rebateCode}: ${qtrErr.message}`);
      }
    }

    const monthlyGroups = {};

    if (Array.isArray(transactions) && transactions.length > 0) {
      const periodStart = new Date(programStartDate); periodStart.setHours(0, 0, 0, 0);
      const periodEnd   = new Date(programEndDate);   periodEnd.setHours(23, 59, 59, 999);

      transactions.forEach((transaction, index) => {
        try {
          if (!transaction.Date) return;
          const date = new Date(transaction.Date);
          if (isNaN(date.getTime())) return;
          if (date < periodStart || date > periodEnd) return;

          // Percentage: ignore rows with no real peso value (e.g. 0.01, 0.11)
          if (rebateType === 'Percentage' && Math.abs(parseFloat(transaction.Gtotal) || 0) < MIN_LINE_VALUE) return;

          const year = date.getFullYear();
          const month = date.getMonth();
          const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

          if (!monthlyGroups[monthKey]) {
            const monthName = monthNames[month];
            const lastDay = new Date(year, month + 1, 0);
            const payoutDate = `${lastDay.getMonth() + 1}.${lastDay.getDate()}.${lastDay.getFullYear().toString().slice(-2)}`;
            const quarter = Math.floor(month / 3) + 1;

            monthlyGroups[monthKey] = {
              monthKey, monthName, monthNumber: month + 1, year, quarter, payoutDate,
              period: `${monthName} ${year}`,
              totalBaseAmount: 0, totalActualSales: 0, totalPriceAfVAT: 0,
              totalQtyForReb: 0, totalAdjustedQtyForReb: 0,
              dailyTransactions: [], hasTransactions: true, itemBreakdown: new Map(),
            };
          }

          const actualSales = parseFloat(transaction.ActualSales) || 0;
          const priceAfVAT  = parseFloat(transaction.PriceAfVAT)  || 0;
          const itemCode    = transaction.ItemCode || transaction.Item || '';
          const itemName    = transaction.ItemName || transaction.Item || `Item_${index}`;

          let dailyRebate = 0;
          let calculationNote = '';
          let percentageUsed = 0;

          const qtyReb = parseFloat(transaction.QtyForReb) ||
                         (parseFloat(transaction.UnitPerQty) > 1
                           ? actualSales / parseFloat(transaction.UnitPerQty)
                           : actualSales);

          const is25kgItem = transaction.Is25kgItem ||
            (itemName && itemName.toLowerCase().includes('25kg')) ||
            (transaction.Weight && transaction.Weight.toString().includes('25'));

          if (rebateType === 'Percentage') {
            percentageUsed = (itemCode && itemPercentageMap.has(itemCode)) ? itemPercentageMap.get(itemCode) : 0;

          const lineValue = parseFloat(transaction.Gtotal) || 0;     // peso value, negative for ARCM
          dailyRebate = (lineValue * percentageUsed) / 100;          // RAW, no rounding per row
          calculationNote = `₱${lineValue.toFixed(2)} × ${percentageUsed}% = ₱${dailyRebate.toFixed(4)}`;

          } else if (rebateType === 'Fixed') {
            // ── use per-item RebatePerBag from FixProdRebate ──
            const itemRate = (itemCode && itemFixedRateMap.has(itemCode))
              ? itemFixedRateMap.get(itemCode)
              : baseRebatePerBag;
            percentageUsed = itemRate;
            dailyRebate = round2(qtyReb * itemRate);   // round per row, like the report
            calculationNote = `${qtyReb} × ₱${itemRate.toFixed(2)} = ₱${dailyRebate.toFixed(2)}`;

          } else if (rebateType === 'Incremental') {
            // ── qty × the transaction's own RebatePerBag when eligible ──
            const itemRate = parseFloat(transaction.RebatePerBag || transaction.rebatePerBag || 0);
            const statusStr = String(transaction.EligibilityStatus || '').trim().toLowerCase();
            if (statusStr === 'eligible' && itemRate > 0) {
              percentageUsed = itemRate;
              dailyRebate = round2(qtyReb * itemRate);
              calculationNote = `Range ${transaction.CurrentRange || '?'}: ${qtyReb} × ₱${itemRate.toFixed(2)} = ₱${dailyRebate.toFixed(2)}`;
            } else {
              dailyRebate = 0;
              calculationNote = transaction.EligibilityStatus === 'Eligible'
                ? `Eligible but no rate found`
                : `Not eligible (no range reached)`;
            }
          }

          const itemKey = itemCode || itemName;
          if (!monthlyGroups[monthKey].itemBreakdown.has(itemKey)) {
            monthlyGroups[monthKey].itemBreakdown.set(itemKey, {
              itemCode, itemName, totalActualSales: 0, totalRebate: 0,
              percentageUsed, transactionCount: 0,
            });
          }
          const itemBreakdown = monthlyGroups[monthKey].itemBreakdown.get(itemKey);
          itemBreakdown.totalActualSales += actualSales;
          itemBreakdown.totalRebate += dailyRebate;
          itemBreakdown.transactionCount++;

          monthlyGroups[monthKey].dailyTransactions.push({
            date: transaction.Date, itemCode, itemName, actualSales, priceAfVAT,
            dailyRebate, percentageUsed, calculationNote, is25kg: is25kgItem,
            EligibilityStatus: transaction.EligibilityStatus,
            CurrentRange: transaction.CurrentRange,
            RebatePerBag: parseFloat(transaction.RebatePerBag || transaction.rebatePerBag || 0),
            QtyForReb: qtyReb,
          });

          monthlyGroups[monthKey].totalBaseAmount        += dailyRebate;
          monthlyGroups[monthKey].totalActualSales       += actualSales;
          monthlyGroups[monthKey].totalPriceAfVAT        += priceAfVAT;
          monthlyGroups[monthKey].totalQtyForReb         += qtyReb;
          monthlyGroups[monthKey].totalAdjustedQtyForReb += qtyReb;
        } catch (transError) {
          console.error(`❌ Error processing transaction ${index}:`, transError.message);
        }
      });
    }

    /* ══════════════════════════════════════════════════════════════════
       SPANNING QUOTA PERIOD DETECTION
       ══════════════════════════════════════════════════════════════════ */
    let combinedQuotaInfo = null;
    if (isWithQuota && Object.keys(customerQuotas).length > 0) {
      const startYear  = programStartDate.getFullYear();
      const startMon   = programStartDate.getMonth();
      const endYear    = programEndDate.getFullYear();
      const endMon     = programEndDate.getMonth();
      const monthsSpanned = (endYear - startYear) * 12 + (endMon - startMon) + 1;

      const lastDayOfEnd   = new Date(endYear, endMon + 1, 0).getDate();
      const isPartialStart = programStartDate.getDate() > 1;
      const isPartialEnd   = programEndDate.getDate() < lastDayOfEnd;

      if (monthsSpanned === 2 && (isPartialStart || isPartialEnd)) {
        const monthsInPeriod = Object.keys(monthlyGroups).sort();

        let primaryMonthName = null;
        let primaryMonthKey  = null;
        let primaryOverlap   = 0;
        let totalQty         = 0;
        let totalAdjQty      = 0;

        for (const mk of monthsInPeriod) {
          const mg = monthlyGroups[mk];
          totalQty    += mg.totalQtyForReb || 0;
          totalAdjQty += mg.totalAdjustedQtyForReb || 0;

          const monthStart   = new Date(mg.year, mg.monthNumber - 1, 1);
          const monthEnd     = new Date(mg.year, mg.monthNumber, 0, 23, 59, 59, 999);
          const overlapStart = monthStart > programStartDate ? monthStart : programStartDate;
          const overlapEnd   = monthEnd   < programEndDate   ? monthEnd   : programEndDate;
          const overlapDays  = Math.max(0, Math.floor((overlapEnd - overlapStart) / 86400000) + 1);

          if (overlapDays > primaryOverlap) {
            primaryOverlap   = overlapDays;
            primaryMonthName = mg.monthName;
            primaryMonthKey  = mk;
          }
        }

        const targetQuota = primaryMonthName ? (customerQuotas[primaryMonthName] || 0) : 0;
        const achievedQty = rebateType === 'Percentage' ? totalAdjQty : totalQty;
        const quotaMet    = targetQuota > 0 ? achievedQty >= targetQuota : true;

        combinedQuotaInfo = {
          monthsInPeriod, primaryMonthName, primaryMonthKey,
          targetQuota, achievedQty, totalQty, totalAdjQty, quotaMet,
        };

        console.log(`📊 [SPANNING QUOTA] ${programStartDate.toISOString().slice(0,10)} → ${programEndDate.toISOString().slice(0,10)}`);
        console.log(`   Months: [${monthsInPeriod.join(', ')}] | Primary: ${primaryMonthName} (${primaryOverlap}d overlap) | Target: ${targetQuota} | Achieved: ${achievedQty.toFixed(2)} | Met: ${quotaMet}`);
      }
    }

    const monthlyData = [];
    for (const monthKey in monthlyGroups) {
      const monthWithData = monthlyGroups[monthKey];

      // RAW (unrounded) month total — sum of raw per-line rebates
      console.log(`🧮 [RAW] ${customerCode}/${rebateCode} ${monthKey} totalBaseAmount =`, monthWithData.totalBaseAmount);

      let baseAmount = monthWithData.totalBaseAmount || 0;
      let totalActualSales = monthWithData.totalActualSales || 0;
      let totalPriceAfVAT = monthWithData.totalPriceAfVAT || 0;
      let status = baseAmount > 0 ? 'Pending' : 'No Payout';
      let eligible = true;
      let quotaMet = true;
      let calculationNote = '';

      if (rebateType === 'Fixed') {
        const hasQuotas   = Object.keys(customerQuotas).length > 0;
        const earned      = monthWithData.totalBaseAmount || 0;

        if (combinedQuotaInfo) {
          quotaMet = combinedQuotaInfo.quotaMet;
          if (quotaMet) {
            baseAmount = earned;
            eligible   = true;
            status     = earned > 0 ? 'Pending' : 'No Payout';
          } else {
            baseAmount = 0;
            eligible   = false;
            status     = 'No Payout';
          }
        } else {
          const targetQuota = hasQuotas ? (customerQuotas[monthWithData.monthName] || 0) : 0;

          if (isWithQuota && hasQuotas && targetQuota > 0) {
            const achievedQty = monthWithData.totalQtyForReb || 0;
            quotaMet = achievedQty >= targetQuota;
            if (quotaMet) { baseAmount = earned; eligible = true; status = earned > 0 ? 'Pending' : 'No Payout'; }
            else { baseAmount = 0; eligible = false; status = 'No Payout'; }
          } else {
            baseAmount = earned; eligible = true; quotaMet = true;
          }
        }
      }

      if (rebateType === 'Percentage' && isWithQuota) {
        const hasQuotas = Object.keys(customerQuotas).length > 0;

        if (combinedQuotaInfo) {
          quotaMet = combinedQuotaInfo.quotaMet;
          if (quotaMet) {
            eligible = true;
            status   = baseAmount > 0 ? 'Pending' : 'No Payout';
          } else {
            baseAmount = 0;
            eligible   = false;
            status     = 'No Payout';
          }
        } else {
          const targetQuota = customerQuotas[monthWithData.monthName] || 0;

          if (hasQuotas && targetQuota > 0) {
            const achievedQty = monthWithData.totalAdjustedQtyForReb || 0;
            quotaMet = achievedQty >= targetQuota;
            if (quotaMet) { eligible = true; status = baseAmount > 0 ? 'Pending' : 'No Payout'; }
            else { baseAmount = 0; eligible = false; status = 'No Payout'; }
          } else {
            eligible = true; quotaMet = true;
          }
        }
      }

      if (rebateType === 'Incremental') {
        const eligibleRows = (monthWithData.dailyTransactions || []).filter(t => {
          const s = String(t.EligibilityStatus || '').trim().toLowerCase();
          if (s === 'eligible') return true;
          if (s === 'not eligible' || s === 'progressing') return false;
          return parseFloat(t.RebatePerBag) > 0;
        });

        eligible = eligibleRows.length > 0;
        quotaMet = eligible;

        if (eligible) {
          // ── Sum each line's own qty × its own RebatePerBag (raw) ──
          baseAmount = eligibleRows.reduce((sum, t) => {
            const qty  = parseFloat(t.QtyForReb)   || 0;
            const rate = parseFloat(t.RebatePerBag) || 0;
            return sum + round2(qty * rate);
          }, 0);

          const rangeRate = parseFloat(eligibleRows[0]?.RebatePerBag) || 0;
          const anyRange  = eligibleRows[0]?.CurrentRange ?? null;
          baseRebatePerBag = rangeRate;
          status = baseAmount > 0 ? 'Pending' : 'No Payout';
          calculationNote = (anyRange ? `Range ${anyRange} achieved — ` : '') +
            `${eligibleRows.length} eligible line(s): Σ (qty × ₱rate) = ₱${round2(baseAmount).toFixed(2)}`;
        } else {
          baseAmount = 0; baseRebatePerBag = 0; status = 'No Payout';
          calculationNote = 'No eligible transactions (no range reached)';
        }
      }

      let dailyCalculations = [];
      let itemCalculations = [];

      if (monthWithData.dailyTransactions) {
        monthWithData.dailyTransactions.forEach(day => {
          dailyCalculations.push({
            date: day.date, item: day.itemName, calculation: day.calculationNote,
            rebate: day.dailyRebate, is25kg: day.is25kg, percentageUsed: day.percentageUsed,
          });
        });
      }
      if (monthWithData.itemBreakdown) {
        monthWithData.itemBreakdown.forEach(item => {
          itemCalculations.push({
            itemCode: item.itemCode, itemName: item.itemName,
            actualSales: item.totalActualSales, rebate: item.totalRebate,
            percentage: item.percentageUsed, transactionCount: item.transactionCount,
          });
        });
      }

      if (rebateType === 'Percentage' && !calculationNote) {
        calculationNote = `Percentage Rebate (${itemCalculations.length} items):\n`;
        itemCalculations.forEach(item => {
          calculationNote += `  ${item.itemName || item.itemCode}: ${item.actualSales} bags × ₱${totalPriceAfVAT > 0 ? (totalPriceAfVAT / totalActualSales).toFixed(2) : 0} × ${item.percentage}% = ₱${item.rebate.toFixed(4)}\n`;
        });
        calculationNote += `  Total: ₱${round2(baseAmount).toFixed(2)}`;
      } else if (rebateType === 'Fixed' && !calculationNote) {
        calculationNote = `Fixed Rebate (${itemCalculations.length} items):\n`;
        itemCalculations.forEach(item => {
          calculationNote += `  ${item.itemName || item.itemCode}: ${item.actualSales} × ₱${(item.percentage || 0).toFixed(2)} = ₱${item.rebate.toFixed(4)}\n`;
        });
        calculationNote += `  Total: ₱${round2(baseAmount).toFixed(2)}`;
      }

      const monthlyRecord = {
        id: `Month-${customerCode}-${rebateCode}-${monthKey}`,
        type: 'monthly',
        cardCode: customerCode,
        rebateCode,
        date: monthWithData.payoutDate,
        period: monthWithData.period,
        monthKey,
        monthNumber: monthWithData.monthNumber,
        quarter: monthWithData.quarter,
        year: monthWithData.year,
        // Rounded ONCE, from the raw month total
        baseAmount: round2(baseAmount),
        amount: round2(baseAmount),
        status,
        amountReleased: 0,
        sapReleasedAmount: 0,
        sapEntries: [],
        balance: 0,
        eligible,
        quotaMet,
        totalActualSales,
        totalPriceAfVAT,
        totalQtyForReb: monthWithData.totalQtyForReb || 0,
        totalAdjustedQtyForReb: monthWithData.totalAdjustedQtyForReb || 0,
        calculationNote,
        dailyCalculations,
        itemCalculations,
        qtrRebate,
        // QTR fields — baseAmountBeforeQtr keeps the RAW (unrounded) month total
        // so the QTR step computes from the exact value, not a rounded one.
        baseAmountBeforeQtr: baseAmount,
        rawAmount: baseAmount,   // unrounded month total, response only
        qtrRebateApplied: false,
        qtrRebateAmount: 0,
        hasTransactions: true,
        transactionCount: monthWithData.dailyTransactions.length,
        isNonEligibleMonth: !eligible || !quotaMet,
        rebateType,
        rebatePerBag: baseRebatePerBag,
        frequency,

        combinedQuotaMet:    combinedQuotaInfo ? combinedQuotaInfo.quotaMet       : null,
        combinedQuotaPeriod: combinedQuotaInfo ? combinedQuotaInfo.monthsInPeriod : null,
        combinedQuotaTarget: combinedQuotaInfo ? combinedQuotaInfo.targetQuota    : null,
        combinedQuotaAchieved: combinedQuotaInfo ? combinedQuotaInfo.achievedQty  : null,
      };

      monthlyData.push(monthlyRecord);
    }

    /* ══════════════════════════════════════════════════════════════════
       QTR REBATE — applied INTO each month's earned amount
       Conditions (all must be true):
         • QuotaType = With Quota
         • Frequency = Quarterly  OR  Monthly w/ Cust. Qtr. Rebate
         • Customer QtrRebate > 0
         • The customer met the quota in all 3 months of the calendar
           quarter (3 consecutive months, each eligible + quota met)
       Then for EACH of those 3 months:
         Percentage        → qtrAmount = month earned × (QtrRebate / 100)
         Fixed/Incremental → qtrAmount = month earned × QtrRebate
         month earned      = month earned + qtrAmount
       Computed from the RAW month total; rounded once at the end.
       (If you need a different formula for Fixed/Incremental, e.g. QtrRebate
        as ₱ per bag, change ONLY computeQtrAmount below.)
       ══════════════════════════════════════════════════════════════════ */
    const qtrApplies = isWithQuota && isQtrFrequency && qtrRebate > 0;
    console.log(
      `💰 [QTR] ${customerCode}/${rebateCode}: withQuota=${isWithQuota} qtrFrequency=${isQtrFrequency} ` +
      `qtrRebate=${qtrRebate} → applies=${qtrApplies}`
    );

    if (qtrApplies && monthlyData.length > 0) {
      const computeQtrAmount = (monthEarned) => (
        rebateType === 'Percentage'
          ? monthEarned * (qtrRebate / 100)
          : monthEarned * qtrRebate
      );

      // Group months by calendar quarter
      const quarters = {};
      monthlyData.forEach(m => {
        const qKey = `${m.year}-Q${m.quarter}`;
        if (!quarters[qKey]) quarters[qKey] = { year: m.year, quarter: m.quarter, months: [] };
        quarters[qKey].months.push(m);
      });

      Object.values(quarters).forEach(q => {
        // The 3 calendar months that make up this quarter
        const expectedMonths = [q.quarter * 3 - 2, q.quarter * 3 - 1, q.quarter * 3];

        // Every one of the 3 months must exist AND have met its quota
        const quarterQualified = expectedMonths.every(mn => {
          const m = q.months.find(x => x.monthNumber === mn);
          return m && m.eligible === true && m.quotaMet === true;
        });

        console.log(
          `   [QTR] Q${q.quarter} ${q.year}: months=[${q.months.map(m => m.monthNumber).join(',')}] ` +
          `→ ${quarterQualified ? 'QUALIFIED (3 consecutive months met quota)' : 'NOT qualified'}`
        );

        if (!quarterQualified) return;

        q.months.forEach(m => {
          // RAW month total (not the rounded m.baseAmount)
          const beforeRaw = m.baseAmountBeforeQtr;
          const qtrRaw    = computeQtrAmount(beforeRaw);
          if (qtrRaw <= 0) return;

          // Round ONCE, on the final month total
          const before    = round2(beforeRaw);
          const after     = round2(beforeRaw + qtrRaw);
          m.rawAmount = beforeRaw + qtrRaw;
          const qtrAmount = round2(after - before);

          const qtrNote = rebateType === 'Percentage'
            ? `QTR Rebate: ₱${before.toFixed(2)} × ${qtrRebate}% = ₱${qtrAmount.toFixed(2)}`
            : `QTR Rebate: ₱${before.toFixed(2)} × ${qtrRebate} = ₱${qtrAmount.toFixed(2)}`;

          m.baseAmountBeforeQtr = before;
          m.qtrRebateApplied    = true;
          m.qtrRebateAmount     = qtrAmount;
          m.baseAmount          = after;
          m.amount              = after;
          m.status              = after > 0 ? 'Pending' : 'No Payout';
          m.calculationNote     = `${m.calculationNote}\n${qtrNote}\nTotal incl. QTR: ₱${after.toFixed(2)}`;
        });
      });
    }

    // QTR is now merged into each month, so only monthly rows are returned
    // (no separate quarterly rows → nothing is counted twice).
    return monthlyData;
  } catch (error) {
    console.error('❌ calculateMonthlyPayoutData:', error);
    return [];
  }
};

/* ══════════════════════════════════════════════════════════════════
   PAYOUT HISTORY TABLE
   ══════════════════════════════════════════════════════════════════ */
const createPayoutHistoryTable = async (pool) => {
  try {
    const tableCheckQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PayoutHistory')
      BEGIN
        CREATE TABLE PayoutHistory (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          PayoutId NVARCHAR(150) NOT NULL,
          CardCode NVARCHAR(50) NOT NULL,
          RebateType NVARCHAR(50) NOT NULL,
          RebateCode NVARCHAR(50) NOT NULL,
          PayoutDate NVARCHAR(20),
          Period NVARCHAR(100),
          BaseAmount DECIMAL(18, 2) DEFAULT 0,
          TotalAmount DECIMAL(18, 2) DEFAULT 0,
          Status NVARCHAR(50) DEFAULT 'Pending',
          AmountReleased DECIMAL(18, 2) DEFAULT 0,
          SapReleasedAmount DECIMAL(18, 2) DEFAULT 0,
          SapLastSync DATETIME,
          ReleaseDate DATETIME,
          RebateBalance DECIMAL(18, 2) DEFAULT 0,
          CarriedOverTo NVARCHAR(50) NULL,
          CarryOverNote NVARCHAR(200) NULL,
          DocumentType NVARCHAR(50) NULL,
          DocumentNumber NVARCHAR(100) NULL,
          CreatedDate DATETIME DEFAULT GETDATE(),
          UpdatedDate DATETIME DEFAULT GETDATE()
        )
        CREATE INDEX IX_PayoutHistory_CardCode ON PayoutHistory(CardCode);
        CREATE INDEX IX_PayoutHistory_RebateCode ON PayoutHistory(RebateCode);
        CREATE INDEX IX_PayoutHistory_RebateType ON PayoutHistory(RebateType);
        CREATE INDEX IX_PayoutHistory_Status ON PayoutHistory(Status);
        CREATE INDEX IX_PayoutHistory_PayoutId ON PayoutHistory(PayoutId);
      END
      ELSE
      BEGIN
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'SapReleasedAmount')
          ALTER TABLE PayoutHistory ADD SapReleasedAmount DECIMAL(18, 2) DEFAULT 0;
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'SapLastSync')
          ALTER TABLE PayoutHistory ADD SapLastSync DATETIME;
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'CarriedOverTo')
          ALTER TABLE PayoutHistory ADD CarriedOverTo NVARCHAR(50) NULL;
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'CarryOverNote')
          ALTER TABLE PayoutHistory ADD CarryOverNote NVARCHAR(200) NULL;
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'DocumentType')
          ALTER TABLE PayoutHistory ADD DocumentType NVARCHAR(50) NULL;
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'DocumentNumber')
          ALTER TABLE PayoutHistory ADD DocumentNumber NVARCHAR(100) NULL;

        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'DocumentType'
                     AND CHARACTER_MAXIMUM_LENGTH < 50)
          ALTER TABLE PayoutHistory ALTER COLUMN DocumentType NVARCHAR(50) NULL;
      END
    `;
    await pool.request().query(tableCheckQuery);
    console.log('✅ [VCP] PayoutHistory table ready');
  } catch (error) {
    console.error('❌ createPayoutHistoryTable:', error);
  }
};

/* ══════════════════════════════════════════════════════════════════
   SAVE EARNED ROWS ONLY
   ══════════════════════════════════════════════════════════════════ */
const saveEarnedPayoutsToDatabase = async (payouts, pool, rebateCode, customerCode) => {
  try {
    console.log(`💾 Saving ${payouts.length} earned rows`);

    for (const payout of payouts) {
      try {
        const baseAmount = round2(payout.baseAmount);
        const totalAmount = baseAmount;

        const isQuotaNotMet = payout.quotaMet === false && payout.eligible === false;
        const finalBase   = isQuotaNotMet ? 0 : baseAmount;
        const finalTotal  = isQuotaNotMet ? 0 : totalAmount;
        const finalStatus = finalTotal === 0 ? 'No Payout' : (payout.status || 'Pending');

        const checkResult = await pool.request()
          .input('PayoutId', sql.NVarChar(150), payout.id)
          .query(`SELECT Id FROM PayoutHistory WHERE PayoutId = @PayoutId`);

        if (checkResult.recordset.length > 0) {
          await pool.request()
            .input('PayoutId',    sql.NVarChar(150), payout.id)
            .input('BaseAmount',  sql.Decimal(18, 2), finalBase)
            .input('TotalAmount', sql.Decimal(18, 2), finalTotal)
            .input('Status',      sql.NVarChar(50),  finalStatus)
            .input('RebateType',  sql.NVarChar(50),  payout.rebateType || 'Fixed')
            .query(`
              UPDATE PayoutHistory
              SET BaseAmount = @BaseAmount,
                  TotalAmount = @TotalAmount,
                  Status = @Status,
                  RebateType = @RebateType,
                  UpdatedDate = GETDATE()
              WHERE PayoutId = @PayoutId
            `);
        } else {
          await pool.request()
            .input('PayoutId',    sql.NVarChar(150), payout.id)
            .input('CardCode',    sql.NVarChar(50),  payout.cardCode || customerCode)
            .input('RebateCode',  sql.NVarChar(50),  payout.rebateCode || rebateCode)
            .input('RebateType',  sql.NVarChar(50),  payout.rebateType || 'Fixed')
            .input('PayoutDate',  sql.NVarChar(20),  '')
            .input('Period',      sql.NVarChar(100), payout.period || '')
            .input('BaseAmount',  sql.Decimal(18, 2), finalBase)
            .input('TotalAmount', sql.Decimal(18, 2), finalTotal)
            .input('Status',      sql.NVarChar(50),  finalStatus)
            .input('AmountReleased',    sql.Decimal(18, 2), 0)
            .input('SapReleasedAmount', sql.Decimal(18, 2), 0)
            .input('RebateBalance',     sql.Decimal(18, 2), 0)
            .query(`
              INSERT INTO PayoutHistory (
                PayoutId, CardCode, RebateCode, RebateType,
                PayoutDate, Period, BaseAmount, TotalAmount,
                Status, AmountReleased, SapReleasedAmount, RebateBalance
              ) VALUES (
                @PayoutId, @CardCode, @RebateCode, @RebateType,
                @PayoutDate, @Period, @BaseAmount, @TotalAmount,
                @Status, @AmountReleased, @SapReleasedAmount, @RebateBalance
              )
            `);
        }
      } catch (payoutError) {
        console.error(`❌ saveEarned ${payout?.id}:`, payoutError.message);
      }
    }

    // Cleanup: the old logic saved separate 'QtrRebate-…' rows. Now that QTR is
    // merged into each month, remove any stale ones so they aren't double counted.
    try {
      await pool.request()
        .input('cc', sql.NVarChar(50), customerCode)
        .input('rc', sql.NVarChar(50), rebateCode)
        .query(`
          DELETE FROM PayoutHistory
          WHERE CardCode = @cc
            AND RebateCode = @rc
            AND PayoutId LIKE 'QtrRebate-%'
        `);
    } catch (cleanErr) {
      console.error('❌ cleanup stale QtrRebate rows:', cleanErr.message);
    }

    console.log(`✅ Saved ${payouts.length} earned rows`);
  } catch (error) {
    console.error('❌ saveEarnedPayoutsToDatabase:', error);
  }
};

/* ══════════════════════════════════════════════════════════════════
   INSERT REDEMPTION ROWS — one row per SAP document
   ══════════════════════════════════════════════════════════════════ */
const insertRedemptionRows = async (
  customerCode,
  rebateCode,
  sapEntries,
  pool,
  rebateFrom = null,
  rebateTo = null
) => {
  try {
    await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(`
        DELETE FROM PayoutHistory
        WHERE CardCode = @cc
          AND RebateCode = @rc
          AND (PayoutId LIKE '${REDEMPTION_PREFIX}-%'
            OR PayoutId LIKE 'SAP-%'
            OR PayoutId LIKE 'SAPDOC-%')
      `);

    let inserted = 0;
    let skipped  = 0;

    for (const sapEntry of sapEntries) {
      if (sapEntry.isRelatedCustomer) continue;

      const { year, month, periodName, periodKey, entries } = sapEntry;
      if (!Array.isArray(entries) || entries.length === 0) continue;

      for (let i = 0; i < entries.length; i++) {
        const doc = entries[i];
        const rawType = String(doc.sourceType || '').toUpperCase().trim();
        if (!rawType) continue;

        const signedAmount = parseFloat(doc.netAmount) || 0;
        if (Math.abs(signedAmount) < 0.01) continue;

        const docDateRaw = doc.docDate || doc.DocDate;
        const docDate = docDateRaw ? new Date(docDateRaw) : new Date(year, month - 1, 1);

        if (rebateFrom && docDate < rebateFrom) { skipped++; continue; }
        if (rebateTo   && docDate > rebateTo)   { skipped++; continue; }

        const yy = String(docDate.getFullYear()).slice(-2);
        const payoutDate = `${docDate.getMonth() + 1}.${docDate.getDate()}.${yy}`;

        const documentNumber = String(
          doc.docNum || doc.baseRef || doc.transId || ''
        );

        const unique = `${periodKey}-${rawType}-${documentNumber || i}-${i}`;
        const redemptionId = `${REDEMPTION_PREFIX}-${customerCode}-${rebateCode}-${unique}`.slice(0, 150);

        await pool.request()
          .input('PayoutId',          sql.NVarChar(150), redemptionId)
          .input('CardCode',          sql.NVarChar(50),  customerCode)
          .input('RebateCode',        sql.NVarChar(50),  rebateCode)
          .input('RebateType',        sql.NVarChar(50),  'SAP-REDEMPTION')
          .input('DocumentType',      sql.NVarChar(50),  rawType)
          .input('DocumentNumber',    sql.NVarChar(100), documentNumber || null)
          .input('PayoutDate',        sql.NVarChar(20),  payoutDate)
          .input('Period',            sql.NVarChar(100), periodName || '')
          .input('BaseAmount',        sql.Decimal(18, 2), 0)
          .input('TotalAmount',       sql.Decimal(18, 2), signedAmount)
          .input('Status',            sql.NVarChar(50),  'Released')
          .input('AmountReleased',    sql.Decimal(18, 2), signedAmount)
          .input('SapReleasedAmount', sql.Decimal(18, 2), signedAmount)
          .input('RebateBalance',     sql.Decimal(18, 2), 0)
          .query(`
            INSERT INTO PayoutHistory (
              PayoutId, CardCode, RebateCode, RebateType,
              DocumentType, DocumentNumber, PayoutDate, Period,
              BaseAmount, TotalAmount, Status,
              AmountReleased, SapReleasedAmount, SapLastSync, RebateBalance
            ) VALUES (
              @PayoutId, @CardCode, @RebateCode, @RebateType,
              @DocumentType, @DocumentNumber, @PayoutDate, @Period,
              @BaseAmount, @TotalAmount, @Status,
              @AmountReleased, @SapReleasedAmount, GETDATE(), @RebateBalance
            )
          `);

        inserted++;
        console.log(`  ✅ [REDEMPTION] ${rawType} ${documentNumber || '(no doc)'} → ₱${signedAmount.toFixed(2)}`);
      }
    }

    console.log(`📄 [REDEMPTION] Inserted ${inserted} row(s), skipped ${skipped} out-of-period row(s) for ${customerCode} / ${rebateCode}`);
  } catch (err) {
    console.error('❌ insertRedemptionRows:', err.message);
  }
};

/* ══════════════════════════════════════════════════════════════════
   STATUS / AMOUNT-RELEASED ENDPOINTS
   ══════════════════════════════════════════════════════════════════ */
router.put('/payouts/:payoutId/status', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, status, amountReleased } = req.body;
    if (!payoutId) return res.status(400).json({ success: false, message: 'Payout ID is required' });

    const ownPool = getPool(db || 'VCP');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    const getResult = await ownPool.request()
      .input('payoutId', sql.NVarChar(150), payoutId)
      .query(`
        SELECT Id, PayoutId, CardCode, RebateCode, BaseAmount, TotalAmount,
               AmountReleased, Status, RebateBalance, ReleaseDate, DocumentType
        FROM PayoutHistory
        WHERE PayoutId = @payoutId
      `);

    if (getResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: `Payout ${payoutId} not found.` });
    }

    const currentPayout = getResult.recordset[0];
    if (currentPayout.DocumentType) {
      return res.status(400).json({ success: false, message: 'Cannot update status of a redemption row' });
    }

    const totalAmount = parseFloat(currentPayout.TotalAmount) || 0;
    let newAmountReleased = parseFloat(amountReleased) || 0;
    newAmountReleased = Math.min(Math.max(newAmountReleased, 0), totalAmount);

    const newBalance = Math.max(0, totalAmount - newAmountReleased);

    let newStatus = status || currentPayout.Status;
    if (newAmountReleased === 0 && totalAmount > 0) newStatus = 'Pending';
    else if (newAmountReleased >= totalAmount) newStatus = 'Paid';
    else if (newAmountReleased > 0) newStatus = 'Partially Paid';

    let releaseDate = currentPayout.ReleaseDate;
    if (newAmountReleased > 0 && (!releaseDate || releaseDate === null)) releaseDate = new Date();

    const result = await ownPool.request()
      .input('status', sql.NVarChar(50), newStatus)
      .input('amountReleased', sql.Decimal(18, 2), newAmountReleased)
      .input('releaseDate', sql.DateTime, releaseDate)
      .input('balance', sql.Decimal(18, 2), newBalance)
      .input('payoutId', sql.NVarChar(150), payoutId)
      .query(`
        UPDATE PayoutHistory
        SET Status = @status,
            AmountReleased = @amountReleased,
            ReleaseDate = @releaseDate,
            RebateBalance = @balance,
            UpdatedDate = GETDATE()
        WHERE PayoutId = @payoutId
      `);

    res.json({
      success: true,
      message: 'Payout updated successfully',
      data: {
        payoutId, baseAmount: currentPayout.BaseAmount, totalAmount,
        status: newStatus, amountReleased: newAmountReleased, balance: newBalance,
        releaseDate, rowsAffected: result.rowsAffected[0],
      }
    });
  } catch (error) {
    console.error('❌ update status:', error);
    res.status(500).json({ success: false, message: 'Error updating payout', error: error.message });
  }
});

router.put('/payouts/:payoutId/amount-released', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, amountReleased } = req.body;
    if (!payoutId) return res.status(400).json({ success: false, message: 'Payout ID is required' });

    const ownPool = getPool(db || 'VCP');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    const getResult = await ownPool.request()
      .input('payoutId', sql.NVarChar(150), payoutId)
      .query(`SELECT Id, TotalAmount, AmountReleased, Status, ReleaseDate, DocumentType FROM PayoutHistory WHERE PayoutId = @payoutId`);

    if (getResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: `Payout ${payoutId} not found` });
    }

    const currentPayout = getResult.recordset[0];
    if (currentPayout.DocumentType) {
      return res.status(400).json({ success: false, message: 'Cannot update amount of a redemption row' });
    }

    const totalAmount = parseFloat(currentPayout.TotalAmount) || 0;
    const newAmountReleased = parseFloat(amountReleased) || 0;
    const validatedAmountReleased = Math.min(Math.max(newAmountReleased, 0), totalAmount);
    const newBalance = Math.max(0, totalAmount - validatedAmountReleased);

    let newStatus = currentPayout.Status;
    if (validatedAmountReleased === 0) newStatus = totalAmount > 0 ? 'Pending' : 'No Payout';
    else if (validatedAmountReleased >= totalAmount) newStatus = 'Paid';
    else if (validatedAmountReleased > 0) newStatus = 'Partially Paid';

    let releaseDate = currentPayout.ReleaseDate;
    if (validatedAmountReleased > 0 && (!releaseDate || releaseDate === null)) releaseDate = new Date();

    const result = await ownPool.request()
      .input('status', sql.NVarChar(50), newStatus)
      .input('amountReleased', sql.Decimal(18, 2), validatedAmountReleased)
      .input('releaseDate', sql.DateTime, releaseDate)
      .input('balance', sql.Decimal(18, 2), newBalance)
      .input('payoutId', sql.NVarChar(150), payoutId)
      .query(`
        UPDATE PayoutHistory
        SET Status = @status,
            AmountReleased = @amountReleased,
            ReleaseDate = @releaseDate,
            RebateBalance = @balance,
            UpdatedDate = GETDATE()
        WHERE PayoutId = @payoutId
      `);

    res.json({
      success: true,
      message: 'Amount released updated successfully',
      data: { payoutId, status: newStatus, amountReleased: validatedAmountReleased,
              balance: newBalance, releaseDate, rowsAffected: result.rowsAffected[0] },
    });
  } catch (error) {
    console.error('❌ update amount:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payouts/save', async (req, res) => {
  try {
    const { db, payoutData } = req.body;
    if (!payoutData || !payoutData.Id) {
      return res.status(400).json({ success: false, message: 'Payout data is required' });
    }

    const ownPool = getPool(db || 'VCP');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    const amount = parseFloat(payoutData.Amount) || 0;
    const amountReleased = parseFloat(payoutData.AmountReleased) || 0;
    const balance = Math.max(0, amount - amountReleased);

    let status = payoutData.Status || 'Pending';
    if (amount === 0) status = 'No Payout';
    else if (amountReleased === 0) status = 'Pending';
    else if (amountReleased >= amount) status = 'Paid';
    else if (amountReleased > 0) status = 'Partially Paid';

    let releaseDate = amountReleased > 0 ? new Date() : null;

    const checkResult = await ownPool.request()
      .input('PayoutId', sql.NVarChar(150), payoutData.Id)
      .query(`SELECT Id FROM PayoutHistory WHERE PayoutId = @PayoutId`);

    let queryResult;
    if (checkResult.recordset.length > 0) {
      queryResult = await ownPool.request()
        .input('PayoutId', sql.NVarChar(150), payoutData.Id)
        .input('TotalAmount', sql.Decimal(18, 2), amount)
        .input('Status', sql.NVarChar(50), status)
        .input('AmountReleased', sql.Decimal(18, 2), amountReleased)
        .input('ReleaseDate', sql.DateTime, releaseDate)
        .input('RebateBalance', sql.Decimal(18, 2), balance)
        .input('RebateType', sql.NVarChar(50), payoutData.RebateType || 'Fixed')
        .query(`
          UPDATE PayoutHistory
          SET TotalAmount = @TotalAmount,
              Status = @Status,
              AmountReleased = @AmountReleased,
              ReleaseDate = @ReleaseDate,
              RebateBalance = @RebateBalance,
              RebateType = @RebateType,
              UpdatedDate = GETDATE()
          WHERE PayoutId = @PayoutId
        `);
    } else {
      queryResult = await ownPool.request()
        .input('PayoutId', sql.NVarChar(150), payoutData.Id)
        .input('CardCode', sql.NVarChar(50), payoutData.CardCode || '')
        .input('RebateCode', sql.NVarChar(50), payoutData.RebateCode || '')
        .input('PayoutDate', sql.NVarChar(20), payoutData.Date || '')
        .input('Period', sql.NVarChar(100), payoutData.Period || '')
        .input('TotalAmount', sql.Decimal(18, 2), amount)
        .input('Status', sql.NVarChar(50), status)
        .input('AmountReleased', sql.Decimal(18, 2), amountReleased)
        .input('ReleaseDate', sql.DateTime, releaseDate)
        .input('RebateBalance', sql.Decimal(18, 2), balance)
        .input('RebateType', sql.NVarChar(50), payoutData.RebateType || 'Fixed')
        .query(`
          INSERT INTO PayoutHistory (
            PayoutId, CardCode, RebateCode, PayoutDate, Period,
            TotalAmount, Status, AmountReleased, ReleaseDate, RebateBalance, RebateType
          ) VALUES (
            @PayoutId, @CardCode, @RebateCode, @PayoutDate, @Period,
            @TotalAmount, @Status, @AmountReleased, @ReleaseDate, @RebateBalance, @RebateType
          )
        `);
    }

    res.json({
      success: true,
      message: 'Payout data saved successfully',
      data: { payoutId: payoutData.Id, status, amountReleased, balance, rowsAffected: queryResult.rowsAffected[0] },
    });
  } catch (error) {
    console.error('❌ save payout:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   CALCULATE DETAILS (single month)
   ══════════════════════════════════════════════════════════════════ */
router.get('/payouts/calculate/:customerCode/:rebateCode/:monthKey', async (req, res) => {
  try {
    const { customerCode, rebateCode, monthKey } = req.params;
    const { db } = req.query;
    const ownPool = getPool(db || 'VCP');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    const [year, month] = monthKey.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const rebateTypeResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(`SELECT RebateType FROM RebateProgram WHERE RebateCode = @rebateCode`);

    if (rebateTypeResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: `Rebate ${rebateCode} not found` });
    }
    const rebateType = rebateTypeResult.recordset[0].RebateType;

    let transactions = [];
    try {
      const transUrl = `http://localhost:3009/api/dashboard/customer/${customerCode}/transactions?` +
        `db=${db || 'VCP'}&rebateCode=${rebateCode}&rebateType=${rebateType}&` +
        `periodFrom=${startDate}&periodTo=${endDate}`;
      const transResponse = await fetch(transUrl);
      if (transResponse.ok) {
        const transData = await transResponse.json();
        if (transData.success && transData.data.transactions) {
          transactions = transData.data.transactions || [];
        }
      }
    } catch (transError) {
      console.error('❌ Error fetching transactions:', transError.message);
    }

    const calculation = await calculatePayoutDetails(transactions, rebateType, customerCode, rebateCode, ownPool, monthKey);

    res.json({
      success: true,
      data: {
        customerCode, rebateCode, rebateType, monthKey, calculation,
        transactionCount: transactions.length,
        totalQtyForReb: transactions.reduce((sum, t) => sum + (parseFloat(t.QtyForReb) || 0), 0),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const calculatePayoutDetails = async (transactions, rebateType, customerCode, rebateCode, pool, monthKey) => {
  const result = {
    totalQtyForReb: 0, totalAdjustedQtyForReb: 0,
    eligible: false, rebatePerBag: 0, qtrRebate: 0, amount: 0,
    calculationSteps: [], itemBreakdown: [],
  };

  transactions.forEach((transaction, index) => {
    const itemName = transaction.Item || transaction.ItemName || `Item ${index + 1}`;
    const is25kgItem = transaction.Is25kgItem || (itemName && itemName.toLowerCase().includes('25kg'));
    const originalQty = parseFloat(transaction.QtyForReb) || 0;
    let adjustedQty = originalQty;
    let adjustmentNote = '';
    if (is25kgItem) { adjustedQty = originalQty / 2; adjustmentNote = `${originalQty} ÷ 2 = ${adjustedQty.toFixed(2)}`; }
    result.totalQtyForReb += originalQty;
    result.totalAdjustedQtyForReb += adjustedQty;
    result.itemBreakdown.push({ itemName, is25kg: is25kgItem, originalQty, adjustedQty, adjustmentNote });
  });

  result.calculationSteps.push(`Total QtyForReb: ${result.totalQtyForReb.toFixed(2)}`);
  result.calculationSteps.push(`Adjusted QtyForReb: ${result.totalAdjustedQtyForReb.toFixed(2)} (25kg items ÷ 2)`);

  try {
    const qtrRebateQuery = rebateType === 'Fixed'
      ? `SELECT QtrRebate FROM FixCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`
      : `SELECT QtrRebate FROM IncCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`;
    const qtrRebateResult = await pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(qtrRebateQuery);
    if (qtrRebateResult.recordset.length > 0) {
      result.qtrRebate = parseFloat(qtrRebateResult.recordset[0].QtrRebate) || 0;
      result.calculationSteps.push(`QTR Rebate: ${result.qtrRebate}`);
    }
  } catch (error) {
    result.calculationSteps.push(`QTR Rebate: Not found (default 0)`);
  }

  if (rebateType === 'Fixed') {
    const eligibleTransactions = transactions.filter(t => t.EligibilityStatus === 'Eligible');
    result.eligible = eligibleTransactions.length > 0;
    result.calculationSteps.push(`Eligible for Fixed rebate: ${result.eligible}`);
    if (result.eligible) {
      try {
        const rebateResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT TOP 1 RebatePerBag FROM FixProdRebate WHERE RebateCode = @rebateCode`);
        if (rebateResult.recordset.length > 0) {
          result.rebatePerBag = parseFloat(rebateResult.recordset[0].RebatePerBag) || 0;
          result.calculationSteps.push(`Rebate per bag: ${result.rebatePerBag}`);
        }
      } catch (error) {
        result.calculationSteps.push(`Rebate per bag: Not found`);
      }
      // Single final amount → computed raw, rounded once
      let rawAmount = result.totalAdjustedQtyForReb * result.rebatePerBag;
      if (result.qtrRebate > 0) {
        rawAmount = rawAmount * result.qtrRebate;
        result.calculationSteps.push(`Applied QTR rebate: ×${result.qtrRebate}`);
      } else {
        result.calculationSteps.push(`No QTR Rebate configured — base amount only`);
      }
      result.amount = round2(rawAmount);
    }
  } else if (rebateType === 'Incremental') {
    const eligibleTransactions = transactions.filter(t => t.EligibilityStatus === 'Eligible' && t.CurrentRange);
    if (eligibleTransactions.length > 0) {
      const highestRange = Math.max(...eligibleTransactions.map(t => t.CurrentRange || 0));
      const highestTransaction = eligibleTransactions.find(t => t.CurrentRange === highestRange);
      result.eligible = true;
      result.rebatePerBag = parseFloat(highestTransaction?.RebatePerBag) || 0;
      // Single final amount → computed raw, rounded once
      let rawAmount = result.totalAdjustedQtyForReb * result.rebatePerBag;
      if (result.qtrRebate > 0) {
        rawAmount = rawAmount * result.qtrRebate;
        result.calculationSteps.push(`Applied QTR rebate: ×${result.qtrRebate}`);
      } else {
        result.calculationSteps.push(`No QTR Rebate configured — base amount only`);
      }
      result.amount = round2(rawAmount);
    }
  }

  result.calculationSteps.push(`Final amount: ${result.amount.toFixed(2)}`);
  result.calculationSteps.push(`Status: ${result.eligible ? 'Pending' : 'No Payout'}`);
  return result;
};

/* ══════════════════════════════════════════════════════════════════
   SAP FETCH — JE / AR / AP / ARCM / APCM
   ══════════════════════════════════════════════════════════════════ */
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const toPeriodMeta = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return {
    year, month,
    periodKey: `${year}-${String(month).padStart(2, '0')}`,
    periodName: `${MONTH_NAMES[month - 1]} ${year}`,
  };
};

const makeBucket = ({ periodKey, periodName, year, month }) => ({
  periodKey, periodName, year, month,
  totalAmount: 0, arcmDeduction: 0,
  entries: [], transactionIds: new Set(),
  sourceBreakdown: { JE: 0, AR: 0, AP: 0, ARCM: 0, APCM: 0 },
});

const pickDocNumber = (sourceType, row) => {
  if (sourceType === 'JE') {
    return row.TransId ?? row.BaseRef ?? row.DocNum ?? '';
  }
  return row.BaseRef || row.DocNum || row.DocEntry || '';
};

const fetchSAPJournalEntries = async (customerCode, periodFrom, periodTo, pool) => {
  try {
    console.log(`📊 [SAP] Fetching for ${customerCode} period ${periodFrom} → ${periodTo}`);

    const sapPool = getPool('VCP');
    if (!sapPool) {
      console.log('⚠️ [SAP] SAP pool not available');
      return { success: false, entries: [] };
    }

    const startDate = new Date(periodFrom);
    const programEndDate = new Date(periodTo);
    const today = new Date();
    const endDate = today > programEndDate ? today : programEndDate;

    const jeQuery = `
      SELECT
        CASE
          WHEN T0.DocumentType LIKE 'A/R Credit Memo%' THEN 'ARCM'
          WHEN T0.DocumentType LIKE 'A/P Credit Memo%' THEN 'APCM'
          WHEN T0.DocumentType LIKE 'A/R Invoice%'      THEN 'AR'
          WHEN T0.DocumentType LIKE 'A/P Invoice%'      THEN 'AP'
          WHEN T0.DocumentType =    'JE'                THEN 'JE'
          ELSE 'JE'
        END                AS SourceType,
        T0.ShortName       AS CardCode,
        T0.CardName,
        T0.RefDate         AS DocDate,
        T0.TransId         AS DocNum,
        T0.TransId         AS TransId,
        T0.BaseRef         AS BaseRef,
        T0.DocumentType    AS OJTDDocumentType,
        T0.Account,
        T0.AcctName,
        T0.Debit,
        T0.Credit,
        T0.Memo,
        T0.LineMemo,
        T0.RefDate
      FROM OJDT T0
      WHERE
        T0.ShortName   = @customerCode
        AND T0.AcctName LIKE '%Rebate%'
        AND T0.RefDate >= @periodFrom
        AND T0.RefDate <= @endDate
    `;

    const arQuery = `
      SELECT
        'AR' AS SourceType,
        T0.CardCode, T0.CardName, T0.DocDate, T0.DocNum,
        T1.TransId AS TransId,
        T1.BaseRef, T1.Account, T2.AcctName,
        T1.Debit, T1.Credit,
        T0.DocDate AS RefDate
      FROM OINV T0
      LEFT JOIN OJDT T1 ON T1.BaseRef = CAST(T0.DocNum AS NVARCHAR)
      LEFT JOIN OACT T2 ON T2.AcctCode = T1.Account AND T2.AcctName LIKE '%Rebate%'
      WHERE T0.CardCode = @customerCode
        AND T2.AcctName IS NOT NULL
        AND T0.DocDate >= @periodFrom
        AND T0.DocDate <= @endDate
    `;

    const apQuery = `
      SELECT
        'AP' AS SourceType,
        T0.U_BP_Code AS CardCode,
        T0.AcctCode, T0.DocDate,
        T0.DocNum AS DocNum,
        T0.BaseRef AS BaseRef,
        T0.LineTotal
      FROM OPCH T0
      WHERE T0.AcctCode IN ('611611', '611571')
        AND T0.U_BP_Code = @customerCode
        AND T0.DocDate >= @periodFrom
        AND T0.DocDate <= @endDate
    `;

    const arcmQuery = `
      SELECT
        'ARCM' AS SourceType,
        T0.CardCode, T0.CardName, T0.DocDate,
        T0.DocNum, T0.BaseRef AS BaseRef,
        T0.ItemCode, T0.Quantity, T0.GTotal
      FROM ORIN T0
      WHERE T0.CardCode = @customerCode
        AND T0.ItemCode = 'NT-0018'
        AND T0.Dscription NOT LIKE '%Rebate%'
        AND T0.DocDate >= @periodFrom
        AND T0.DocDate <= @endDate
    `;

    const apcmQuery = `
      SELECT
        'APCM' AS SourceType,
        T0.U_BP_Code AS CardCode,
        T0.DocDate, T0.DocNum,
        T0.BaseRef AS BaseRef,
        T0.GTotal
      FROM ORPC T0
      WHERE T0.U_BP_Code = @customerCode
        AND T0.DocDate >= @periodFrom
        AND T0.DocDate <= @endDate
    `;

    const [jeResult, arResult, apResult, arcmResult, apcmResult] = await Promise.all([
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom', sql.Date, startDate).input('endDate', sql.Date, endDate).query(jeQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom', sql.Date, startDate).input('endDate', sql.Date, endDate).query(arQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom', sql.Date, startDate).input('endDate', sql.Date, endDate).query(apQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom', sql.Date, startDate).input('endDate', sql.Date, endDate).query(arcmQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom', sql.Date, startDate).input('endDate', sql.Date, endDate).query(apcmQuery),
    ]);

    console.log(
      `📊 [SAP] Raw — OJDT: ${jeResult.recordset.length} | AR: ${arResult.recordset.length} | ` +
      `AP: ${apResult.recordset.length} | ARCM: ${arcmResult.recordset.length} | APCM: ${apcmResult.recordset.length}`
    );

    const ojdtTypeCounts = {};
    jeResult.recordset.forEach(r => {
      ojdtTypeCounts[r.SourceType] = (ojdtTypeCounts[r.SourceType] || 0) + 1;
    });
    console.log('📊 [SAP] OJDT classified breakdown:', ojdtTypeCounts);

    const entriesByPeriod = {};
    const getOrCreateBucket = (key, meta) => {
      if (!entriesByPeriod[key]) entriesByPeriod[key] = makeBucket(meta);
      return entriesByPeriod[key];
    };

    const jeArRows = [...jeResult.recordset, ...arResult.recordset];
    const lineDedupeMap = new Map();

    jeArRows.forEach(row => {
      const transId = row.TransId ?? (row.SourceType === 'JE' ? row.DocNum : null);
      const lineKey = transId
        ? `OJDT-${transId}-${row.Account ?? ''}`
        : `${row.SourceType}-${row.DocNum}-${row.BaseRef ?? '0'}-${row.Account ?? ''}`;

      if (lineDedupeMap.has(lineKey)) return;
      lineDedupeMap.set(lineKey, true);

      const meta = toPeriodMeta(row.DocDate);
      const bucket = getOrCreateBucket(meta.periodKey, meta);
      const debit = parseFloat(row.Debit) || 0;
      const credit = parseFloat(row.Credit) || 0;
      const netAmount = debit - credit;

      const txId = transId ? `OJDT-${transId}` : `${row.SourceType}-${row.DocNum}`;
      if (!bucket.transactionIds.has(txId)) {
        bucket.transactionIds.add(txId);
        bucket.totalAmount += netAmount;
        bucket.sourceBreakdown[row.SourceType] = (bucket.sourceBreakdown[row.SourceType] || 0) + netAmount;
      }

      bucket.entries.push({
        sourceType: row.SourceType,
        docNum: pickDocNumber(row.SourceType, row),
        transId, baseRef: row.BaseRef ?? null, docDate: row.DocDate,
        account: row.Account, acctName: row.AcctName,
        debit, credit, netAmount,
        memo: row.Memo || row.LineMemo || '',
        cardCode: row.CardCode, cardName: row.CardName,
      });
    });

    apResult.recordset.forEach(row => {
      const meta = toPeriodMeta(row.DocDate);
      const bucket = getOrCreateBucket(meta.periodKey, meta);
      const lineTotal = parseFloat(row.LineTotal) || 0;

      bucket.totalAmount += lineTotal;
      bucket.sourceBreakdown.AP += lineTotal;

      bucket.entries.push({
        sourceType: 'AP', docDate: row.DocDate,
        docNum: pickDocNumber('AP', row), baseRef: row.BaseRef ?? null,
        acctCode: row.AcctCode, lineTotal, netAmount: lineTotal,
        cardCode: row.CardCode, matchedBy: 'U_BP_Code',
      });
    });

    arcmResult.recordset.forEach(row => {
      const meta = toPeriodMeta(row.DocDate);
      const bucket = getOrCreateBucket(meta.periodKey, meta);
      const deductAmount = Math.abs(parseFloat(row.GTotal) || 0);

      bucket.totalAmount -= deductAmount;
      bucket.arcmDeduction += deductAmount;
      bucket.sourceBreakdown.ARCM -= deductAmount;

      bucket.entries.push({
        sourceType: 'ARCM',
        docNum: pickDocNumber('ARCM', row), docDate: row.DocDate,
        itemCode: row.ItemCode, gTotal: parseFloat(row.GTotal) || 0,
        netAmount: -deductAmount, cardCode: row.CardCode, cardName: row.CardName,
        isDeduction: true,
      });
    });

    apcmResult.recordset.forEach(row => {
      const meta = toPeriodMeta(row.DocDate);
      const bucket = getOrCreateBucket(meta.periodKey, meta);
      const deductAmount = Math.abs(parseFloat(row.GTotal) || 0);

      bucket.totalAmount -= deductAmount;
      bucket.arcmDeduction += deductAmount;
      bucket.sourceBreakdown.APCM -= deductAmount;

      bucket.entries.push({
        sourceType: 'APCM',
        docNum: pickDocNumber('APCM', row), docDate: row.DocDate,
        gTotal: parseFloat(row.GTotal) || 0,
        netAmount: -deductAmount, cardCode: row.CardCode,
        matchedBy: 'U_BP_Code', isDeduction: true,
      });
    });

    const resultArray = Object.values(entriesByPeriod)
      .map(({ transactionIds, ...rest }) => rest)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    console.log(`📊 [SAP] Final: ${resultArray.length} period bucket(s)`);

    return {
      success: true,
      entries: resultArray,
      rawEntries: {
        je: jeResult.recordset, ar: arResult.recordset, ap: apResult.recordset,
        arcm: arcmResult.recordset, apcm: apcmResult.recordset,
      },
      summary: {
        totalJE: jeResult.recordset.length,
        totalAR: arResult.recordset.length,
        totalAP: apResult.recordset.length,
        totalARCM: arcmResult.recordset.length,
        totalAPCM: apcmResult.recordset.length,
        uniquePeriods: resultArray.length,
      },
    };
  } catch (error) {
    console.error('❌ [SAP] Error fetching:', error);
    return { success: false, entries: [], error: error.message };
  }
};

/* ══════════════════════════════════════════════════════════════════
   GET ALL REBATE PROGRAMS FOR CUSTOMER
   ══════════════════════════════════════════════════════════════════ */
export const getAllRebateProgramsForCustomer = async (customerCode, currentRebateCode, pool) => {
  try {
    const metaResult = await pool.request()
      .input('rc', sql.NVarChar(50), currentRebateCode)
      .query(`
        SELECT RebateCode, RebateType, Frequency, DateFrom, DateTo, IsActive
        FROM RebateProgram WHERE RebateCode = @rc
      `);
    if (metaResult.recordset.length === 0) return [];

    const { RebateType, Frequency } = metaResult.recordset[0];

    const siblingsResult = await pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('rebateType', sql.NVarChar(50), RebateType)
      .input('frequency', sql.NVarChar(50), Frequency)
      .query(`
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo,
                        rp.IsActive, rp.RebateType, rp.Frequency
        FROM RebateProgram rp
        WHERE rp.RebateType = @rebateType
          AND rp.Frequency = @frequency
          AND EXISTS (
            SELECT 1 FROM PayoutHistory ph
            WHERE ph.CardCode = @customerCode AND ph.RebateCode = rp.RebateCode
          )
        ORDER BY rp.DateFrom ASC
      `);
    return siblingsResult.recordset;
  } catch (err) {
    console.error('❌ getAllRebateProgramsForCustomer:', err.message);
    return [];
  }
};

export const resolveDocDateToRebateProgram = (docDate, programs) => {
  if (!programs || programs.length === 0) return null;
  const date = new Date(docDate);
  date.setHours(12, 0, 0, 0);

  const sorted = [...programs].sort((a, b) => new Date(a.DateFrom) - new Date(b.DateFrom));

  for (const prog of sorted) {
    const from = new Date(prog.DateFrom); from.setHours(0, 0, 0, 0);
    const to = new Date(prog.DateTo); to.setHours(23, 59, 59, 999);
    if (date >= from && date <= to) return { ...prog, matchType: 'exact' };
  }

  const firstFrom = new Date(sorted[0].DateFrom); firstFrom.setHours(0, 0, 0, 0);
  if (date < firstFrom) return { ...sorted[0], matchType: 'before_first' };

  const lastTo = new Date(sorted[sorted.length - 1].DateTo); lastTo.setHours(23, 59, 59, 999);
  if (date > lastTo) return { ...sorted[sorted.length - 1], matchType: 'after_last' };

  for (let i = 0; i < sorted.length - 1; i++) {
    const curEnd = new Date(sorted[i].DateTo); curEnd.setHours(23, 59, 59, 999);
    const nextStart = new Date(sorted[i + 1].DateFrom); nextStart.setHours(0, 0, 0, 0);
    if (date > curEnd && date < nextStart) {
      const daysToNext = (nextStart - date) / (1000 * 60 * 60 * 24);
      const resolved = daysToNext <= 15 ? sorted[i + 1] : sorted[i];
      return { ...resolved, matchType: daysToNext <= 15 ? 'gap_next' : 'gap_previous' };
    }
  }
  return { ...sorted[sorted.length - 1], matchType: 'fallback' };
};

/* ══════════════════════════════════════════════════════════════════
   PAYOUT SUMMARY
   ══════════════════════════════════════════════════════════════════ */
const getCustomerRebatePrograms = async (customerCode, pool) => {
  const result = await pool.request()
    .input('cc', sql.NVarChar(50), customerCode)
    .query(`
      SELECT DISTINCT rp.RebateCode, rp.RebateType, rp.DateFrom, rp.DateTo, rp.IsActive
      FROM RebateProgram rp
      WHERE EXISTS (SELECT 1 FROM FixCustRebate x WHERE x.CardCode = @cc AND x.RebateCode = rp.RebateCode)
         OR EXISTS (SELECT 1 FROM PerCustRebate x WHERE x.CardCode = @cc AND x.RebateCode = rp.RebateCode)
         OR EXISTS (SELECT 1 FROM IncCustRebate x WHERE x.CardCode = @cc AND x.RebateCode = rp.RebateCode)
      ORDER BY rp.DateFrom ASC
    `);
  return result.recordset;
};

router.get('/customer/:customerCode/payout-summary', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db } = req.query;
    const ownPool = getPool(db || 'VCP');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    await createPayoutHistoryTable(ownPool);

    const programs = await getCustomerRebatePrograms(customerCode, ownPool);

    for (const program of programs) {
      try {
        const calcUrl =
          `http://localhost:3009/api/vcp/payouts/customer/${customerCode}/payouts` +
          `?db=${db || 'VCP'}&rebateCode=${program.RebateCode}&rebateType=${program.RebateType}&useRebatePeriod=true`;
        await fetch(calcUrl);
      } catch (calcErr) {
        console.log(`⚠️ Calc error for ${program.RebateCode}:`, calcErr.message);
      }
    }

    const rowsResult = await ownPool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .query(`
        SELECT RebateCode, RebateType, BaseAmount, AmountReleased, DocumentType
        FROM PayoutHistory
        WHERE CardCode = @cc
          AND PayoutId NOT LIKE 'SAP-%'
          AND PayoutId NOT LIKE 'SAPDOC-%'
          AND PayoutId NOT LIKE 'BeginningBalance-%'
          AND Period NOT LIKE 'Balance of %'
          AND Period NOT LIKE 'Beginning Balance%'
      `);

    const programByCode = {};
    programs.forEach(p => { programByCode[p.RebateCode] = p; });

    const rebateCodeNum = (code) => {
      const m = String(code).match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    };
    const getQuarterInfo = (dateFrom) => {
      if (!dateFrom) return { quarter: 0, year: 0 };
      const d = new Date(dateFrom);
      return { quarter: Math.ceil((d.getMonth() + 1) / 3), year: d.getFullYear() };
    };

    const byRebateCode = {};
    rowsResult.recordset.forEach(row => {
      const code = row.RebateCode;
      if (!byRebateCode[code]) {
        byRebateCode[code] = {
          rebateCode: code, rebateTypes: new Set(),
          baseAmount: 0, amountReleased: 0,
        };
      }
      const g = byRebateCode[code];
      g.rebateTypes.add(row.RebateType);

      if (row.DocumentType) {
        g.amountReleased += parseFloat(row.AmountReleased) || 0;
      } else {
        g.baseAmount += parseFloat(row.BaseAmount) || 0;
      }
    });

    const sortedRebateGroups = Object.values(byRebateCode)
      .sort((a, b) => rebateCodeNum(a.rebateCode) - rebateCodeNum(b.rebateCode));

    let runningRebateBalance = 0;
    const summary = sortedRebateGroups.map(g => {
      const program = programByCode[g.rebateCode] || {};
      const { quarter, year } = getQuarterInfo(program.DateFrom);

      const earned = g.baseAmount;
      const totalAmount = runningRebateBalance + earned;
      const rawBalance = totalAmount - g.amountReleased;
      const isOverReleased = rawBalance < -0.01;
      const balance = isOverReleased ? 0 : Math.max(0, rawBalance);
      const overReleasedBy = isOverReleased ? Math.abs(rawBalance) : 0;

      let status = 'No Payout';
      if (isOverReleased) status = 'Over-Released';
      else if (totalAmount > 0) {
        if (balance <= 0.01) status = 'Paid';
        else if (g.amountReleased > 0) status = 'Partially Paid';
        else status = 'Pending';
      }

      runningRebateBalance = balance;

      return {
        rebateCode: g.rebateCode,
        rebateTypes: Array.from(g.rebateTypes),
        quarter, year,
        quarterLabel: quarter ? `Q${quarter} ${year}` : 'Unknown',
        dateFrom: program.DateFrom || null,
        dateTo: program.DateTo || null,
        isActive: program.IsActive === 1,
        baseAmount: earned,
        totalAmount,
        amountReleased: g.amountReleased,
        balance,
        isOverReleased,
        overReleasedBy,
        status,
      };
    });

    const byQuarter = {};
    summary.forEach(item => {
      const key = `${item.year}-Q${item.quarter}`;
      if (!byQuarter[key]) {
        byQuarter[key] = {
          quarterLabel: item.quarterLabel, quarter: item.quarter, year: item.year,
          rebateCodes: [], rebateTypes: new Set(),
          baseAmount: 0, totalAmount: 0, amountReleased: 0,
        };
      }
      const qg = byQuarter[key];
      qg.rebateCodes.push(item.rebateCode);
      item.rebateTypes.forEach(t => qg.rebateTypes.add(t));
      qg.baseAmount += item.baseAmount;
      qg.totalAmount += item.totalAmount;
      qg.amountReleased += item.amountReleased;
    });

    const sortedQuarterKeys = Object.keys(byQuarter).sort((a, b) => {
      const [yA, qA] = a.split('-Q');
      const [yB, qB] = b.split('-Q');
      return (parseInt(yA) - parseInt(yB)) || (parseInt(qA) - parseInt(qB));
    });

    let prevBal = 0;
    const quarterSummary = sortedQuarterKeys.map(key => {
      const qg = byQuarter[key];
      const earned = qg.baseAmount;
      const cumulativeTotal = prevBal + earned;
      const released = qg.amountReleased;
      const balance = cumulativeTotal - released;
      const isOverReleased = balance < -0.01;
      const overReleasedBy = isOverReleased ? Math.abs(balance) : 0;

      let status;
      if (isOverReleased) status = 'Over-Released';
      else if (cumulativeTotal === 0) status = 'No Payout';
      else if (balance <= 0.01) status = 'Paid';
      else if (released > 0) status = 'Partially Paid';
      else status = 'Pending';

      prevBal = balance;

      return {
        ...qg, baseAmount: earned, totalAmount: cumulativeTotal,
        amountReleased: released, balance, isOverReleased, overReleasedBy, status,
        rebateTypes: Array.from(qg.rebateTypes),
      };
    });

    res.json({
      success: true,
      data: { byRebateCode: summary, byQuarter: quarterSummary, customerCode },
    });
  } catch (error) {
    console.error('❌ payout-summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


export default router;