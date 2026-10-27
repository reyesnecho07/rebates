import express from 'express';
import sql from 'mssql';
import { getPool } from '../services/databaseService.js';

const router = express.Router();

const REDEMPTION_PREFIX = 'Redemption';

/* Lookahead window (days) applied to SAP fetch + redemption insert so
   future-dated OJDT entries (e.g. AR Invoices posted after the rebate
   program ends, or after the current system date) are still captured.
   2 years is generous enough for late-posted credit memos / advances. */
const LOOKAHEAD_DAYS = 730;

/* ══════════════════════════════════════════════════════════════════
   BEGINNING BALANCE — prior-years earned − prior-years released
   ══════════════════════════════════════════════════════════════════ */
const getBeginningBalanceForCustomer = async (customerCode, pool) => {
  try {
    const currentYear = new Date().getFullYear();

    const earnedResult = await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('curYear', sql.Int, currentYear)
      .query(`
        SELECT ISNULL(SUM(BaseAmount), 0) AS TotalEarned
        FROM PayoutHistory
        WHERE CardCode = @cc
          AND PayoutId NOT LIKE '${REDEMPTION_PREFIX}-%'
          AND PayoutId NOT LIKE 'SAP-%'
          AND PayoutId NOT LIKE 'SAPDOC-%'
          AND PayoutId NOT LIKE 'BeginningBalance-%'
          AND Period IS NOT NULL
          AND Period NOT LIKE 'Balance of %'
          AND Period NOT LIKE 'Beginning Balance%'
          AND ISNUMERIC(RIGHT(LTRIM(RTRIM(Period)), 4)) = 1
AND CAST(RIGHT(LTRIM(RTRIM(Period)), 4) AS INT) < @curYear
      `);

    const redResult = await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('curYear', sql.Int, currentYear)
      .query(`
        SELECT ISNULL(SUM(AmountReleased), 0) AS TotalReleased
        FROM PayoutHistory
        WHERE CardCode = @cc
          AND PayoutId LIKE '${REDEMPTION_PREFIX}-%'
          AND Period IS NOT NULL
          AND ISNUMERIC(RIGHT(LTRIM(RTRIM(Period)), 4)) = 1
          AND CAST(RIGHT(LTRIM(RTRIM(Period)), 4) AS INT) < @curYear
      `);

    const earned   = parseFloat(earnedResult.recordset[0]?.TotalEarned) || 0;
    const released = parseFloat(redResult.recordset[0]?.TotalReleased)  || 0;
    const bal      = earned - released;

    console.log(`💰 [BEG-BAL] ${customerCode} (year ${currentYear} opening): Earned ₱${earned.toFixed(2)} − Released ₱${released.toFixed(2)} = ₱${bal.toFixed(2)}`);
    return bal;
  } catch (err) {
    console.error('❌ getBeginningBalanceForCustomer:', err.message);
    return 0;
  }
};

/* ══════════════════════════════════════════════════════════════════
   CUSTOMER-SPECIFIC REBATE DATE RANGE
   ══════════════════════════════════════════════════════════════════ */
const CUSTOMER_REBATE_TABLE_BY_TYPE = {
  Fixed:       'FixCustRebate',
  Percentage:  'PerCustRebate',
  Incremental: 'IncCustRebate',
};

const getCustomerRebateDateRange = async (customerCode, rebateCode, rebateType, pool) => {
  const table = CUSTOMER_REBATE_TABLE_BY_TYPE[rebateType];
  if (!table) {
    console.log(`⚠️ [CUST-RANGE] Unknown rebateType "${rebateType}" — skipping customer range lookup`);
    return { dateFrom: '', dateTo: '', table: null };
  }

  try {
    const result = await pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('rebateCode',   sql.NVarChar(50), rebateCode)
      .query(`
        SELECT DateFrom, DateTo
        FROM ${table}
        WHERE CardCode = @customerCode AND RebateCode = @rebateCode
      `);

    if (result.recordset.length === 0) {
      console.log(`ℹ️ [CUST-RANGE] No row in ${table} for ${customerCode} / ${rebateCode}`);
      return { dateFrom: '', dateTo: '', table };
    }

    const rec = result.recordset[0];
    const dateFrom = rec.DateFrom ? new Date(rec.DateFrom).toISOString().split('T')[0] : '';
    const dateTo   = rec.DateTo   ? new Date(rec.DateTo).toISOString().split('T')[0]   : '';

    console.log(`✅ [CUST-RANGE] ${table} → ${customerCode}/${rebateCode}: ${dateFrom || '(none)'} → ${dateTo || '(none)'}`);
    return { dateFrom, dateTo, table };
  } catch (err) {
    console.error(`❌ [CUST-RANGE] Error querying ${table}:`, err.message);
    return { dateFrom: '', dateTo: '', table };
  }
};

/* ══════════════════════════════════════════════════════════════════
   MAIN GET — PAYOUTS
   ══════════════════════════════════════════════════════════════════ */
router.get('/customer/:customerCode/payouts', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode, rebateType, periodFrom, periodTo, useRebatePeriod } = req.query;

    console.log('💰 [NEXCHEM] Fetching payouts for customer:', {
      customerCode, rebateCode, rebateType, periodFrom, periodTo, useRebatePeriod
    });

    if (!customerCode || !rebateCode || !rebateType) {
      return res.status(400).json({
        success: false,
        message: 'Customer code, rebate code, and rebate type are required'
      });
    }

    const databaseToUse = db || 'NEXCHEM';
    const ownPool = getPool(databaseToUse);
    if (!ownPool) {
      return res.status(500).json({ success: false, message: 'Database pool not available' });
    }

    await ensureSAPColumnsExist(ownPool);
    await createPayoutHistoryTable(ownPool);

    const rebateProgramResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(`
        SELECT DateFrom, DateTo, IsActive, Frequency, QuotaType
        FROM RebateProgram
        WHERE RebateCode = @rebateCode
      `);

    let rebateDateFrom = '', rebateDateTo = '', isActive = false;
    let frequency = 'Quarterly';
    let quotaType = 'N/A';
    let dateRangeSource = 'RebateProgram';

    if (rebateProgramResult.recordset.length > 0) {
      const rec = rebateProgramResult.recordset[0];
      rebateDateFrom = rec.DateFrom ? new Date(rec.DateFrom).toISOString().split('T')[0] : '';
      rebateDateTo   = rec.DateTo   ? new Date(rec.DateTo).toISOString().split('T')[0]   : '';
      isActive       = rec.IsActive === 1;
      frequency      = rec.Frequency || 'Quarterly';
      quotaType      = rec.QuotaType || 'N/A';
    } else {
      console.log(`⚠️ [NEXCHEM] No RebateProgram row for ${rebateCode}`);
    }

    // ── Fallback: per-customer date range ──
    const needsCustomerRange = !rebateDateFrom || !rebateDateTo;
    if (needsCustomerRange) {
      console.log(`🔎 [NEXCHEM] RebateProgram missing date range — checking customer table for ${rebateType} rebate`);
      const custRange = await getCustomerRebateDateRange(customerCode, rebateCode, rebateType, ownPool);

      if (!rebateDateFrom && custRange.dateFrom) {
        rebateDateFrom = custRange.dateFrom;
        dateRangeSource = custRange.table;
      }
      if (!rebateDateTo && custRange.dateTo) {
        rebateDateTo = custRange.dateTo;
        dateRangeSource = custRange.table;
      }
    }

    console.log('📊 Rebate Program Details:', {
      frequency, quotaType,
      dateFrom: rebateDateFrom, dateTo: rebateDateTo,
      isActive, dateRangeSource
    });

    let startDate, endDate, dateSource = 'manual';
    if (periodFrom && periodTo) {
      startDate = periodFrom; endDate = periodTo; dateSource = 'manual';
    } else if (useRebatePeriod === 'true' && rebateDateFrom && rebateDateTo && isActive) {
      startDate = rebateDateFrom; endDate = rebateDateTo; dateSource = 'rebate_period';
    } else if (rebateDateFrom && rebateDateTo) {
      startDate = rebateDateFrom; endDate = rebateDateTo; dateSource = 'rebate_period_fallback';
    } else if (rebateDateFrom) {
      startDate = rebateDateFrom;
      endDate = new Date().toISOString().split('T')[0];
      dateSource = 'customer_range_open_end';
    } else if (rebateDateTo) {
      const endYear = new Date(rebateDateTo).getFullYear();
      startDate = `${endYear}-01-01`;
      endDate = rebateDateTo;
      dateSource = 'customer_range_open_start';
    } else {
      const currentYear = new Date().getFullYear();
      startDate = `${currentYear}-01-01`;
      endDate = new Date().toISOString().split('T')[0];
      dateSource = 'current_year';
    }

    console.log('📅 [NEXCHEM] Payout date range:', { startDate, endDate, dateSource, frequency, quotaType, dateRangeSource });

    console.log(`📊 [SAP] Fetching multi-doc for customer ${customerCode} from ${startDate} to ${endDate}`);
    const sapData = await fetchSAPJournalEntries(customerCode, startDate, endDate, ownPool);

    if (sapData.success) {
      console.log(`✅ [SAP] Found ${sapData.entries.length} periods with journal entries`);
    } else {
      console.log('⚠️ [SAP] Could not fetch SAP journal entries');
    }

    let monthlyData = [];
    try {
      const transactionsResponse = await fetch(
        `http://192.168.100.100:3011/api/nexchem/dashboard/customer/${customerCode}/transactions?` +
        `db=${databaseToUse}&rebateCode=${rebateCode}&rebateType=${rebateType}&` +
        `periodFrom=${startDate}&periodTo=${endDate}&useRebatePeriod=${useRebatePeriod}`
      );

      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();

        if (transactionsData.success && transactionsData.data.transactions) {
          console.log(`📊 [NEXCHEM] Found ${transactionsData.data.transactions.length} transactions`);

          monthlyData = await calculateMonthlyPayoutData(
            transactionsData.data.transactions,
            rebateType,
            customerCode,
            rebateCode,
            ownPool,
            frequency,
            [],
            quotaType,
            startDate,
            endDate
          );

          console.log(`📈 [NEXCHEM] Calculated ${monthlyData.length} earned records`);
        } else {
          console.log('⚠️ [NEXCHEM] No transaction data found');
        }
      } else {
        console.log('⚠️ [NEXCHEM] Could not fetch transaction data for payouts');
      }
    } catch (transError) {
      console.error('❌ [NEXCHEM] Error fetching transactions:', transError.message);
    }

    // ── Save earned rows ──
    try {
      await saveEarnedPayoutsToDatabase(monthlyData, ownPool, rebateCode, customerCode);
    } catch (saveErr) {
      console.error('❌ [NEXCHEM] Error saving earned payouts:', saveErr.message);
    }

    // ── Insert redemption rows from SAP (JE / AR / AP / ARCM / APCM) ──
    //
    // ★ The insert window must match the SAP fetch window, which uses a
    //   LOOKAHEAD_DAYS extension past today. Without this, future-dated
    //   docs (e.g. C00017's AR Invoice dated 2026-11-10 when today is
    //   earlier) get fetched but then silently dropped by the period
    //   filter inside insertRedemptionRows.
    if (sapData.success && sapData.entries.length > 0) {
      try {
        const rebateFrom = startDate ? new Date(startDate) : null;
        let   rebateTo   = endDate   ? new Date(endDate)   : null;

        // Extend to today + LOOKAHEAD_DAYS so nothing within the SAP
        // fetch window gets skipped.
        const todayRef = new Date();
        const lookaheadEnd = new Date(todayRef.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
        if (!rebateTo || lookaheadEnd > rebateTo) {
          if (rebateTo) {
            console.log(`📅 [REDEMPTION] Extending rebateTo from ${rebateTo.toISOString().slice(0,10)} → ${lookaheadEnd.toISOString().slice(0,10)} (matches SAP fetch window w/ lookahead)`);
          } else {
            console.log(`📅 [REDEMPTION] Setting rebateTo → ${lookaheadEnd.toISOString().slice(0,10)} (lookahead)`);
          }
          rebateTo = lookaheadEnd;
        }

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
        console.error('❌ [NEXCHEM] Error inserting redemption rows:', redErr.message);
      }
    }

    // ── Beginning balance ──
    const previousBalance = await getBeginningBalanceForCustomer(customerCode, ownPool);

    let beginningBalanceRecord = null;
    if (previousBalance > 0) {
      beginningBalanceRecord = createBeginningBalanceRecord(
        customerCode,
        rebateCode,
        rebateType,
        previousBalance
      );
    }

    // ── Final rows ──
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
      console.log(`📊 [NEXCHEM] Final rows: ${finalPayouts.length}`);
    } catch (error) {
      console.error('❌ [NEXCHEM] Error fetching final payouts:', error.message);
    }

    // ── Redemptions array for frontend ──
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

    const responseData = {
      payouts: finalPayouts,
      beginningBalances: hasBeginningBalance ? [beginningBalanceRecord] : [],
      regularPayouts: finalPayouts.filter(p => !p.DocumentType),
      previousBalance: hasBeginningBalance ? previousBalance : 0,
      beginningBalanceRecord: hasBeginningBalance ? beginningBalanceRecord : null,
      customerCode,
      rebateCode,
      rebateType,
      frequency,
      quotaType,

      redemptions,
      redemptionSummary: {
        netReleased: totalRedemptionSigned,
        documentCount: redemptions.length,
      },
      earnedSummary: { totalEarned },

      sapData: {
        available: sapData.success,
        periodsFound: sapData.entries.length,
        totalNetAmount: sapData.entries.reduce((sum, p) => sum + p.totalAmount, 0),
        lastSync: new Date().toISOString()
      },
      dateRange: {
        periodFrom: startDate,
        periodTo: endDate,
        autoLoaded: dateSource !== 'manual',
        dateSource,
        dateRangeSource,
        rebatePeriodAvailable: !!(rebateDateFrom && rebateDateTo),
        rebatePeriod: { from: rebateDateFrom, to: rebateDateTo }
      },
      autoSynced: false
    };

    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('❌ [NEXCHEM] Error fetching payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payout data',
      error: error.message,
      stack: error.stack
    });
  }
});

/* ══════════════════════════════════════════════════════════════════
   BEGINNING BALANCE RECORD
   ══════════════════════════════════════════════════════════════════ */
const createBeginningBalanceRecord = (customerCode, rebateCode, rebateType, previousBalance) => {
  try {
    console.log(`📝 Creating beginning balance record for ${customerCode}: ₱${previousBalance.toFixed(2)}`);

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
      displayType: 'beginning_balance'
    };
  } catch (error) {
    console.error('❌ createBeginningBalanceRecord:', error.message);
    return null;
  }
};

/* ══════════════════════════════════════════════════════════════════
   CALCULATE MONTHLY — earned only (SAP NOT injected)
   ══════════════════════════════════════════════════════════════════ */
const calculateMonthlyPayoutData = async (
  transactions,
  rebateType,
  customerCode,
  rebateCode,
  pool,
  frequency = 'Quarterly',
  sapEntries = [],
  quotaType = 'N/A',
  periodStart = null,
  periodEnd   = null
) => {
  try {
    console.log(`📊 Starting Nexchem payout calculation for ${customerCode}, ${rebateCode}, type: ${rebateType}, frequency: ${frequency}, quotaType: ${quotaType}`);
    console.log(`📊 [SAP] SAP entries ignored — PayoutHistory stores earned only`);

    let baseRebatePerBag = 0;
    let percentageValue = 0;
    let qtrRebate = 0;

    let rebatePerBagMap = {};
    let percentageMap   = {};

    let incrementalRanges = [];
    if (rebateType === 'Incremental') {
      try {
        const rangeQuery = `
          SELECT RangeNo, MinQty, MaxQty, RebatePerBag
          FROM IncCustRange
          WHERE RebateCode = @rebateCode
          ORDER BY RangeNo ASC
        `;
        const rangeResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(rangeQuery);
        incrementalRanges = rangeResult.recordset.map(r => ({
          rangeNo: r.RangeNo,
          minQty: parseFloat(r.MinQty) || 0,
          maxQty: parseFloat(r.MaxQty) || 0,
          rebatePerBag: parseFloat(r.RebatePerBag) || 0
        }));
        console.log(`📊 Loaded ${incrementalRanges.length} incremental ranges`);
      } catch (err) {
        console.log('⚠️ Could not fetch incremental ranges:', err.message);
      }
    }

    if (rebateType === 'Fixed') {
      try {
        const rebateQuery = `
          SELECT ItemCode, RebatePerBag
          FROM FixProdRebate
          WHERE RebateCode = @rebateCode
        `;
        const rebateResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(rebateQuery);

        rebateResult.recordset.forEach(row => {
          const code = (row.ItemCode || '').trim();
          const val  = parseFloat(row.RebatePerBag) || 0;
          if (code) rebatePerBagMap[code] = val;
        });

        const first = rebateResult.recordset[0];
        baseRebatePerBag = first ? parseFloat(first.RebatePerBag) || 0 : 0;
      } catch (rebateError) {
        console.log('⚠️ Could not fetch rebate per bag:', rebateError.message);
      }

      if (frequency === 'Quarterly') {
        try {
          const qtrRebateResult = await pool.request()
            .input('customerCode', sql.NVarChar(50), customerCode)
            .input('rebateCode', sql.NVarChar(50), rebateCode)
            .query(`SELECT QtrRebate FROM FixCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`);
          if (qtrRebateResult.recordset.length > 0) {
            qtrRebate = parseFloat(qtrRebateResult.recordset[0].QtrRebate) || 0;
          }
        } catch (error) {
          console.log('⚠️ Could not fetch QTR rebate:', error.message);
        }
      }

    } else if (rebateType === 'Percentage') {
      try {
        const percentageResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT ItemCode, PercentagePerBag FROM PerProdRebate WHERE RebateCode = @rebateCode`);

        percentageResult.recordset.forEach(row => {
          const code = (row.ItemCode || '').trim();
          const val  = parseFloat(row.PercentagePerBag) || 0;
          if (code) percentageMap[code] = val;
        });

        const first = percentageResult.recordset[0];
        percentageValue = first ? parseFloat(first.PercentagePerBag) || 0 : 0;
      } catch (error) {
        console.log('⚠️ Could not fetch percentage value:', error.message);
      }

      if (frequency === 'Quarterly') {
        const qtrRebateResult = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT QtrRebate FROM PerCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`);
        if (qtrRebateResult.recordset.length > 0) {
          qtrRebate = parseFloat(qtrRebateResult.recordset[0].QtrRebate) || 0;
        }
      }
    } else if (rebateType === 'Incremental') {
      if (frequency === 'Quarterly') {
        try {
          const qtrRebateResult = await pool.request()
            .input('customerCode', sql.NVarChar(50), customerCode)
            .input('rebateCode', sql.NVarChar(50), rebateCode)
            .query(`SELECT QtrRebate FROM IncCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`);
          if (qtrRebateResult.recordset.length > 0) {
            qtrRebate = parseFloat(qtrRebateResult.recordset[0].QtrRebate) || 0;
          }
        } catch (error) {
          console.log('⚠️ Could not fetch Incremental QTR rebate:', error.message);
        }
      }
    }

    const customerQuotas = {};
    if (rebateType === 'Percentage' && quotaType === 'With Quota') {
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
          if (row.Month && row.TargetQty !== null && row.TargetQty !== undefined) {
            customerQuotas[row.Month] = parseFloat(row.TargetQty) || 0;
          }
        });
      } catch (error) {
        console.log('⚠️ Could not fetch Percentage customer quotas:', error.message);
      }
    }

    const incrementalAccum = {};
    const percentageQtyAccum = {};

    const monthlyGroups = {};
    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

    if (Array.isArray(transactions) && transactions.length > 0) {
      console.log(`📊 Processing ${transactions.length} transactions`);
      const dateGroups = {};

      transactions.forEach((transaction, index) => {
        try {
          if (!transaction.Date) return;
          const date = new Date(transaction.Date);
          if (isNaN(date.getTime())) return;

          const dateKey  = date.toISOString().split('T')[0];
          const year     = date.getFullYear();
          const month    = date.getMonth();
          const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

          if (!dateGroups[dateKey]) {
            dateGroups[dateKey] = {
              date: dateKey, monthKey,
              items: [], totalDailyRebate: 0, calculationDetails: []
            };
          }

          const actualSales = parseFloat(transaction.ActualSales) || 0;
          const qtyForReb   = parseFloat(transaction.QtyForReb) || 0;
          const itemName    = transaction.Item || transaction.ItemName || `Item_${index}`;
          const itemCode    = (transaction.ItemCode || transaction.Item || transaction.ItemName || '').trim();

          const is25kgItem = transaction.Is25kgItem ||
            (itemName && itemName.toLowerCase().includes('25kg')) ||
            (transaction.Weight && transaction.Weight.toString().includes('25'));

          let transactionRebate = 0;
          let calculationNote   = '';

          if (rebateType === 'Fixed') {
            const itemRebatePerBag = (itemCode && rebatePerBagMap[itemCode] !== undefined)
              ? rebatePerBagMap[itemCode]
              : baseRebatePerBag;

            transactionRebate = actualSales * itemRebatePerBag;
            if (is25kgItem) {
              const orig = transactionRebate;
              transactionRebate = transactionRebate / 2;
              calculationNote = `25kg [${itemCode}]: ${actualSales} × ${itemRebatePerBag} = ${orig.toFixed(2)} ÷ 2 = ${transactionRebate.toFixed(2)}`;
            } else {
              calculationNote = `[${itemCode}]: ${actualSales} × ${itemRebatePerBag} = ${transactionRebate.toFixed(2)}`;
            }

            dateGroups[dateKey].items.push({
              itemName, itemCode, actualSales,
              rebatePerBag: itemRebatePerBag, percentageValue,
              is25kg: is25kgItem, transactionRebate, calculationNote
            });
            dateGroups[dateKey].totalDailyRebate += transactionRebate;
            dateGroups[dateKey].calculationDetails.push({ item: itemName, calculation: calculationNote });

          } else if (rebateType === 'Percentage') {
            const itemPercentage = (itemCode && percentageMap[itemCode] !== undefined)
              ? percentageMap[itemCode]
              : percentageValue;

            const priceAfVAT = parseFloat(transaction.PriceAfVAT) || 0;
            const base = priceAfVAT > 0 ? actualSales * priceAfVAT : actualSales;
            transactionRebate = (base * itemPercentage) / 100;

            if (is25kgItem) {
              const orig = transactionRebate;
              transactionRebate = transactionRebate / 2;
              calculationNote = `25kg [${itemCode}]: ${actualSales}` +
                (priceAfVAT > 0 ? ` × ₱${priceAfVAT.toFixed(2)}` : '') +
                ` × ${itemPercentage}% = ${orig.toFixed(2)} ÷ 2 = ${transactionRebate.toFixed(2)}`;
            } else {
              calculationNote = `[${itemCode}]: ${actualSales}` +
                (priceAfVAT > 0 ? ` × ₱${priceAfVAT.toFixed(2)}` : '') +
                ` × ${itemPercentage}% = ${transactionRebate.toFixed(2)}`;
            }

            dateGroups[dateKey].items.push({
              itemName, itemCode, actualSales,
              rebatePerBag: baseRebatePerBag, percentageValue: itemPercentage,
              is25kg: is25kgItem, transactionRebate, calculationNote
            });
            dateGroups[dateKey].totalDailyRebate += transactionRebate;
            dateGroups[dateKey].calculationDetails.push({ item: itemName, calculation: calculationNote });

            if (!percentageQtyAccum[monthKey]) percentageQtyAccum[monthKey] = 0;
            percentageQtyAccum[monthKey] += qtyForReb;

          } else if (rebateType === 'Incremental') {
            if (!incrementalAccum[monthKey]) {
              incrementalAccum[monthKey] = {
                totalQtyForReb: 0, highestRange: null,
                rebatePerBag: 0, hasEligible: false
              };
            }
            const acc = incrementalAccum[monthKey];
            acc.totalQtyForReb += qtyForReb;

            const txnRange    = transaction.CurrentRange || transaction.RangeNo || null;
            const txnRebate   = parseFloat(transaction.RebatePerBag) || 0;
            const txnEligible = transaction.EligibilityStatus === 'Eligible' || (txnRange && txnRange > 0);

            if (txnEligible && txnRange) {
              acc.hasEligible = true;
              if (!acc.highestRange || txnRange > acc.highestRange) {
                acc.highestRange = txnRange;
                if (txnRebate > 0) acc.rebatePerBag = txnRebate;
                else if (incrementalRanges.length > 0) {
                  const range = incrementalRanges.find(r => r.rangeNo === txnRange);
                  if (range) acc.rebatePerBag = range.rebatePerBag;
                }
              }
            }

            calculationNote = `Incremental qty ${qtyForReb.toFixed(2)} (month total: ${acc.totalQtyForReb.toFixed(2)})`;

            dateGroups[dateKey].items.push({
              itemName, itemCode, actualSales, qtyForReb,
              range: txnRange, rebatePerBag: txnRebate,
              is25kg: is25kgItem, transactionRebate: 0, calculationNote
            });
            dateGroups[dateKey].calculationDetails.push({ item: itemName, calculation: calculationNote });
          }
        } catch (transError) {
          console.error(`❌ Error processing transaction ${index}:`, transError.message);
        }
      });

      Object.values(dateGroups).forEach(dateGroup => {
        const monthKey = dateGroup.monthKey;

        if (!monthlyGroups[monthKey]) {
          const monthNum = parseInt(monthKey.split('-')[1]);
          const monthName = monthNames[monthNum - 1];
          const year = parseInt(monthKey.split('-')[0]);
          const lastDay = new Date(year, monthNum, 0);
          const payoutDate = `${lastDay.getMonth() + 1}.${lastDay.getDate()}.${lastDay.getFullYear().toString().slice(-2)}`;
          const quarter = Math.floor((monthNum - 1) / 3) + 1;

          monthlyGroups[monthKey] = {
            monthKey, monthName, monthNumber: monthNum, year, quarter, payoutDate,
            period: `${monthName} ${year}`,
            totalBaseAmount: 0, totalActualSales: 0,
            dateDetails: [], hasTransactions: true,
            eligible: true, quotaMet: true,
            qtrRebate, rebatePerBag: baseRebatePerBag,
            percentageValue, frequency
          };
        }

        monthlyGroups[monthKey].dateDetails.push({
          date: dateGroup.date,
          dailyRebate: dateGroup.totalDailyRebate,
          calculationDetails: dateGroup.calculationDetails,
          itemCount: dateGroup.items.length
        });

        monthlyGroups[monthKey].totalBaseAmount += dateGroup.totalDailyRebate;
        dateGroup.items.forEach(item => {
          monthlyGroups[monthKey].totalActualSales += item.actualSales;
        });
      });

      // Add empty months inside the period
      if (periodStart && periodEnd) {
        const startD = new Date(periodStart);
        const endD   = new Date(periodEnd);
        let cursor   = new Date(startD.getFullYear(), startD.getMonth(), 1);
        const lastCursor = new Date(endD.getFullYear(), endD.getMonth(), 1);

        while (cursor <= lastCursor) {
          const y = cursor.getFullYear();
          const m = cursor.getMonth();
          const monthNum = m + 1;
          const monthKey = `${y}-${String(monthNum).padStart(2, '0')}`;

          if (!monthlyGroups[monthKey]) {
            const monthName = monthNames[m];
            const lastDay = new Date(y, monthNum, 0);
            const payoutDate = `${lastDay.getMonth() + 1}.${lastDay.getDate()}.${lastDay.getFullYear().toString().slice(-2)}`;
            const quarter = Math.floor(m / 3) + 1;

            monthlyGroups[monthKey] = {
              monthKey, monthName, monthNumber: monthNum, year: y, quarter, payoutDate,
              period: `${monthName} ${y}`,
              totalBaseAmount: 0, totalActualSales: 0,
              dateDetails: [], hasTransactions: false,
              eligible: false, quotaMet: false,
              qtrRebate, rebatePerBag: baseRebatePerBag, percentageValue, frequency,
              isNoTransactionMonth: true,
            };
          }
          cursor = new Date(y, m + 1, 1);
        }
      }
    }

    const monthlyData = [];
    const sortedMonthKeys = Object.keys(monthlyGroups).sort((a, b) => a.localeCompare(b));

    sortedMonthKeys.forEach(monthKey => {
      const monthWithData = monthlyGroups[monthKey];

      let baseAmount = monthWithData.totalBaseAmount || 0;
      let status = baseAmount > 0 ? 'Pending' : 'No Payout';
      let totalActualSales = monthWithData.totalActualSales || 0;
      let calculationNote = '';
      let dateCalculations = [];
      let eligible = true;
      let quotaMet = true;

      if (monthWithData.isNoTransactionMonth) {
        baseAmount = 0;
        status = 'No Payout';
        eligible = false;
        quotaMet = false;
        calculationNote = 'No transactions this month';
      } else if (monthWithData.dateDetails && monthWithData.dateDetails.length > 0) {
        monthWithData.dateDetails.forEach(dateDetail => {
          const dayNote = `Date ${dateDetail.date}: ₱${dateDetail.dailyRebate.toFixed(2)}`;
          if (dateDetail.calculationDetails && dateDetail.calculationDetails.length > 0) {
            dateDetail.calculationDetails.forEach(detail => {
              dateCalculations.push(`${dayNote} - ${detail.item}: ${detail.calculation}`);
            });
          } else {
            dateCalculations.push(dayNote);
          }
        });
      }

      if (rebateType === 'Fixed') {
        calculationNote = `Fixed: Daily Actual Sales × ₱${baseRebatePerBag.toFixed(2)} = ₱${baseAmount.toFixed(2)}`;

      } else if (rebateType === 'Percentage') {
        const monthName = monthWithData.monthName;
        const targetQuota = customerQuotas[monthName] || 0;
        const achievedQty = percentageQtyAccum[monthKey] || 0;

        if (quotaType === 'With Quota' && targetQuota > 0) {
          if (achievedQty >= targetQuota) {
            eligible = baseAmount > 0;
            quotaMet = true;
            status = baseAmount > 0 ? 'Pending' : 'No Payout';
            calculationNote = `Qty ${achievedQty.toFixed(2)} ≥ ${targetQuota} ✅ → ₱${baseAmount.toFixed(2)}`;
          } else {
            baseAmount = 0;
            eligible = false;
            quotaMet = false;
            status = 'No Payout';
            calculationNote = `Qty ${achievedQty.toFixed(2)} < ${targetQuota} ❌ No Payout`;
          }
        } else {
          eligible = baseAmount > 0;
          quotaMet = true;
          status = baseAmount > 0 ? 'Pending' : 'No Payout';
          calculationNote = `Percentage: Daily Actual Sales × ${percentageValue}% = ₱${baseAmount.toFixed(2)}`;
        }

      } else if (rebateType === 'Incremental') {
        const acc = incrementalAccum[monthKey] || {
          totalQtyForReb: 0, highestRange: null, rebatePerBag: 0, hasEligible: false
        };
        const incEligible = acc.hasEligible && acc.rebatePerBag > 0;
        const incBase = incEligible ? (acc.totalQtyForReb * acc.rebatePerBag) : 0;

        baseAmount = incBase;
        eligible = incEligible;
        quotaMet = incEligible;

        if (incEligible) {
          status = incBase > 0 ? 'Pending' : 'No Payout';
          calculationNote =
            `Incremental: ${acc.totalQtyForReb.toFixed(2)} × ₱${acc.rebatePerBag.toFixed(2)} ` +
            `(Range ${acc.highestRange}) = ₱${incBase.toFixed(2)}`;
        } else {
          status = 'No Payout';
          calculationNote = `Incremental: No eligible transactions in range`;
        }
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
        baseAmount: parseFloat(baseAmount.toFixed(2)),
        amount: parseFloat(baseAmount.toFixed(2)),
        status,
        amountReleased: 0,
        sapReleasedAmount: 0,
        sapEntries: [],
        balance: 0,
        eligible,
        quotaMet,
        totalActualSales,
        totalAdjustedQtyForReb: percentageQtyAccum[monthKey] || 0,
        calculationNote,
        dateCalculations,
        qtrRebate,
        hasTransactions: !!monthWithData.hasTransactions,
        transactionCount: monthWithData.dateDetails?.reduce((sum, date) => sum + (date.itemCount || 0), 0) || 0,
        isNonEligibleMonth: !eligible || !quotaMet,
        rebateType,
        percentageValue,
        rebatePerBag: baseRebatePerBag,
        frequency,
      };

      monthlyData.push(monthlyRecord);
    });

    // ── Quarterly bonus rows ──
    const quarterlyData = [];
    if (frequency === 'Quarterly' && monthlyData.length > 0) {
      const quarters = {};
      monthlyData.forEach(month => {
        const quarterKey = `Q${month.quarter}-${month.year}`;
        if (!quarters[quarterKey]) {
          quarters[quarterKey] = {
            quarter: month.quarter, year: month.year, months: [],
            totalBaseAmount: 0, eligibleMonths: 0, totalMonths: 0, isComplete: false
          };
        }
        quarters[quarterKey].months.push(month);
        quarters[quarterKey].totalBaseAmount += month.baseAmount;
        quarters[quarterKey].totalMonths++;
        if (month.hasTransactions && month.eligible !== false && month.quotaMet !== false) {
          quarters[quarterKey].eligibleMonths++;
        }
      });

      const sortedQuarterKeys = Object.keys(quarters).sort((a, b) => {
        const [qA, yearA] = a.split('-');
        const [qB, yearB] = b.split('-');
        if (yearA !== yearB) return yearA.localeCompare(yearB);
        return parseInt(qA.substring(1)) - parseInt(qB.substring(1));
      });

      sortedQuarterKeys.forEach(quarterKey => {
        const quarter = quarters[quarterKey];
        quarter.isComplete = quarter.eligibleMonths === 3;

        if (quarter.isComplete && qtrRebate > 0) {
          let qtrRebateAmount = 0;
          let calculationNote = '';

          if (rebateType === 'Percentage') {
            qtrRebateAmount = quarter.totalBaseAmount * (qtrRebate / 100);
            calculationNote = `QTR Rebate: ₱${quarter.totalBaseAmount.toFixed(2)} × ${qtrRebate}% = ₱${qtrRebateAmount.toFixed(2)}`;
          } else {
            qtrRebateAmount = quarter.totalBaseAmount * qtrRebate;
            calculationNote = `QTR Rebate: ₱${quarter.totalBaseAmount.toFixed(2)} × ${qtrRebate} = ₱${qtrRebateAmount.toFixed(2)}`;
          }

          quarterlyData.push({
            id: `QtrRebate-${customerCode}-${rebateCode}-${quarterKey}`,
            type: 'quarterly',
            cardCode: customerCode,
            rebateCode,
            date: `${quarter.quarter}.${quarter.year.toString().slice(-2)}`,
            period: `Quarter ${quarter.quarter} ${quarter.year}`,
            quarter: quarter.quarter,
            year: quarter.year,
            baseAmount: qtrRebateAmount,
            amount: parseFloat(qtrRebateAmount.toFixed(2)),
            status: 'Pending',
            amountReleased: 0,
            sapReleasedAmount: 0,
            balance: 0,
            eligible: true,
            quotaMet: true,
            qtrRebate,
            isQtrRebate: true,
            calculationNote,
            rebateType,
            frequency
          });
        }
      });
    }

    const allData = [...monthlyData, ...quarterlyData];

    allData.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.type === 'monthly' && b.type === 'monthly') return (a.monthNumber || 0) - (b.monthNumber || 0);
      if (a.type === 'quarterly' && b.type === 'quarterly') return (a.quarter || 0) - (b.quarter || 0);
      if (a.type === 'monthly' && b.type === 'quarterly') return (a.quarter || 0) <= (b.quarter || 0) ? -1 : 1;
      if (a.type === 'quarterly' && b.type === 'monthly') return (a.quarter || 0) >= (b.quarter || 0) ? 1 : -1;
      return 0;
    });

    console.log(`✅ Completed Nexchem payout calculation: ${monthlyData.length} monthly, ${quarterlyData.length} quarterly`);
    return allData;

  } catch (error) {
    console.error('❌ Error in calculateMonthlyPayoutData:', error);
    console.error(error.stack);
    return [];
  }
};

/* ══════════════════════════════════════════════════════════════════
   TABLE SETUP — adds DocumentNumber + widens DocumentType
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
          DocumentType NVARCHAR(50),
          DocumentNumber NVARCHAR(100),
          ReleaseDate DATETIME,
          RebateBalance DECIMAL(18, 2) DEFAULT 0,
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
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'DocumentType')
          ALTER TABLE PayoutHistory ADD DocumentType NVARCHAR(50);
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'DocumentNumber')
          ALTER TABLE PayoutHistory ADD DocumentNumber NVARCHAR(100) NULL;

        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'DocumentType'
                     AND CHARACTER_MAXIMUM_LENGTH < 50)
          ALTER TABLE PayoutHistory ALTER COLUMN DocumentType NVARCHAR(50) NULL;
      END
    `;
    await pool.request().query(tableCheckQuery);
    console.log('✅ [NEXCHEM] PayoutHistory table created/verified');
  } catch (error) {
    console.error('❌ [NEXCHEM] Error creating/updating PayoutHistory table:', error);
  }
};

const ensureSAPColumnsExist = async (pool) => {
  try {
    const checkColumnsQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'SapReleasedAmount')
        ALTER TABLE PayoutHistory ADD SapReleasedAmount DECIMAL(18, 2) DEFAULT 0;
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'SapLastSync')
        ALTER TABLE PayoutHistory ADD SapLastSync DATETIME;
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'DocumentType')
        ALTER TABLE PayoutHistory ADD DocumentType NVARCHAR(50);
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'DocumentNumber')
        ALTER TABLE PayoutHistory ADD DocumentNumber NVARCHAR(100) NULL;

      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'DocumentType'
                   AND CHARACTER_MAXIMUM_LENGTH < 50)
        ALTER TABLE PayoutHistory ALTER COLUMN DocumentType NVARCHAR(50) NULL;
    `;
    await pool.request().query(checkColumnsQuery);
  } catch (error) {
    console.error('❌ [NEXCHEM] Error adding SAP columns:', error);
  }
};

/* ══════════════════════════════════════════════════════════════════
   SAVE EARNED ROWS
   ══════════════════════════════════════════════════════════════════ */
const saveEarnedPayoutsToDatabase = async (payouts, pool, rebateCode, customerCode) => {
  try {
    console.log(`💾 Saving ${payouts.length} earned rows`);

    for (const payout of payouts) {
      try {
        const baseAmount  = parseFloat(payout.baseAmount) || 0;
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

    console.log(`✅ Saved ${payouts.length} earned rows`);
  } catch (error) {
    console.error('❌ saveEarnedPayoutsToDatabase:', error);
  }
};

/* ══════════════════════════════════════════════════════════════════
   INSERT REDEMPTION ROWS
   One row per SAP document (JE / AR / AP / ARCM / APCM).
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

    console.log(`📥 [REDEMPTION] Insert window: ${rebateFrom ? rebateFrom.toISOString().slice(0,10) : '(none)'} → ${rebateTo ? rebateTo.toISOString().slice(0,10) : '(none)'}`);

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

        if (rebateFrom && docDate < rebateFrom) {
          skipped++;
          console.log(`  ⏭️ [REDEMPTION] Skipping ${rawType} ${doc.docNum || i} — date ${docDate.toISOString().slice(0,10)} before ${rebateFrom.toISOString().slice(0,10)}`);
          continue;
        }
        if (rebateTo && docDate > rebateTo) {
          skipped++;
          console.log(`  ⏭️ [REDEMPTION] Skipping ${rawType} ${doc.docNum || i} — date ${docDate.toISOString().slice(0,10)} after ${rebateTo.toISOString().slice(0,10)}`);
          continue;
        }

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
        console.log(`  ✅ [REDEMPTION] ${rawType} ${documentNumber || '(no doc)'} on ${payoutDate} → ₱${signedAmount.toFixed(2)}`);
      }
    }

    console.log(`📄 [REDEMPTION] Inserted ${inserted} row(s), skipped ${skipped} out-of-period row(s) for ${customerCode} / ${rebateCode}`);
  } catch (err) {
    console.error('❌ insertRedemptionRows:', err.message);
  }
};

/* ══════════════════════════════════════════════════════════════════
   BEGINNING-BALANCES endpoint
   ══════════════════════════════════════════════════════════════════ */
router.get('/customer/:customerCode/beginning-balances', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode } = req.query;
    const ownPool = getPool(db || 'NEXCHEM');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    let query = `
      SELECT
        Id, PayoutId, CardCode, RebateCode, RebateType,
        PayoutDate as Date, Period, BaseAmount, TotalAmount as Amount,
        Status, AmountReleased, ReleaseDate, RebateBalance as Balance,
        CreatedDate, UpdatedDate
      FROM PayoutHistory
      WHERE CardCode = @customerCode
        AND Period LIKE 'Balance of %'
        ${rebateCode ? 'AND RebateCode = @rebateCode' : ''}
      ORDER BY PayoutDate ASC, CreatedDate ASC
    `;

    const request = ownPool.request().input('customerCode', sql.NVarChar(50), customerCode);
    if (rebateCode) request.input('rebateCode', sql.NVarChar(50), rebateCode);

    const result = await request.query(query);

    res.json({
      success: true,
      data: {
        beginningBalances: result.recordset,
        customerCode,
        rebateCode,
        totalCount: result.recordset.length
      }
    });
  } catch (error) {
    console.error('❌ [NEXCHEM] Error fetching beginning balances:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   STATUS / AMOUNT-RELEASED ENDPOINTS
   ══════════════════════════════════════════════════════════════════ */
router.put('/payouts/:payoutId/status', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, status, amountReleased } = req.body;

    if (!payoutId) return res.status(400).json({ success: false, message: 'Payout ID is required' });

    const ownPool = getPool(db || 'NEXCHEM');
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
        releaseDate, rowsAffected: result.rowsAffected[0]
      }
    });
  } catch (error) {
    console.error('❌ [NEXCHEM] Error updating payout:', error);
    res.status(500).json({ success: false, message: 'Error updating payout', error: error.message });
  }
});

router.put('/payouts/:payoutId/amount-released', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, amountReleased } = req.body;

    if (!payoutId) return res.status(400).json({ success: false, message: 'Payout ID is required' });

    const ownPool = getPool(db || 'NEXCHEM');
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
              balance: newBalance, releaseDate, rowsAffected: result.rowsAffected[0] }
    });
  } catch (error) {
    console.error('❌ Error updating amount released:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payouts/save', async (req, res) => {
  try {
    const { db, payoutData } = req.body;
    if (!payoutData || !payoutData.Id) {
      return res.status(400).json({ success: false, message: 'Payout data is required' });
    }

    const ownPool = getPool(db || 'NEXCHEM');
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
      data: { payoutId: payoutData.Id, status, amountReleased, balance, rowsAffected: queryResult.rowsAffected[0] }
    });
  } catch (error) {
    console.error('❌ Error saving payout data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   SAP FETCH — JE / AR / AP / ARCM / APCM
   ══════════════════════════════════════════════════════════════════ */
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
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
  totalAmount: 0,
  arcmDeduction: 0,
  entries: [],
  transactionIds: new Set(),
  sourceBreakdown: { JE: 0, AR: 0, AP: 0, ARCM: 0, APCM: 0 },
});

const pickDocNumber = (sourceType, row) => {
  const type = String(sourceType || '').toUpperCase().trim();

  // ── 1) Connected document ─────────────────────────────────────────
  // If this row is linked to a source document (auto-generated JE from
  // an AR/AP invoice, credit memo, etc.), show that source doc's number.
  const baseRef = row.BaseRef;
  const hasBaseRef =
    baseRef !== undefined &&
    baseRef !== null &&
    String(baseRef).trim() !== '';

  if (hasBaseRef) return String(baseRef).trim();

  // ── 2) Manual / non-connected doc → use the document's own number ──
  //
  //  • JE   (OJDT) : own number is TransId (aliased to DocNum in the
  //                  jeQuery SELECT). Manual JEs have no BaseRef, so
  //                  they land here and return the JE number.
  //  • AP   (OPCH) : DocNum is the AP invoice number.
  //  • AR   (OINV) : DocNum is the AR invoice number.
  //  • ARCM (ORIN) : DocNum is the AR credit memo number.
  //  • APCM (ORPC) : DocNum is the AP credit memo number.
  //
  // DocNum is present in every one of these record sets (see the
  // SELECT aliases in fetchSAPJournalEntries), so DocNum is the
  // primary identifier. TransId is only the OJDT-specific fallback.
  if (type === 'JE') {
    return row.DocNum ?? row.TransId ?? '';
  }

  return row.DocNum ?? row.TransId ?? '';
};

const fetchSAPJournalEntries = async (customerCode, periodFrom, periodTo, pool) => {
  try {
    console.log(`📊 [SAP] Fetching for ${customerCode} period ${periodFrom} → ${periodTo}`);

    const sapPool = getPool('NEXCHEM');
    if (!sapPool) {
      console.log('⚠️ [SAP] SAP pool not available');
      return { success: false, entries: [] };
    }

    const startDate = new Date(periodFrom);
    const programEndDate = new Date(periodTo);

    // ★ Extend the fetch window with a lookahead past today, so that
    //   future-dated OJDT entries (e.g. AR invoices posted in a period
    //   after the rebate program ended, or with a Date > today) are
    //   still captured. The customer + rebate-account filters keep the
    //   result set small and relevant.
    const today = new Date();
    const lookaheadEnd = new Date(today.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const endDate = programEndDate > lookaheadEnd ? programEndDate : lookaheadEnd;

    console.log(
      `📅 [SAP] Effective fetch window: ${startDate.toISOString().slice(0,10)} → ` +
      `${endDate.toISOString().slice(0,10)}` +
      (endDate > programEndDate
        ? `  ⚡ extended past program end (+${LOOKAHEAD_DAYS}d lookahead)`
        : '')
    );

    const jeQuery = `
      SELECT
        CASE
          WHEN UPPER(LTRIM(RTRIM(T0.DocumentType))) LIKE 'A/R CREDIT MEMO%' THEN 'ARCM'
          WHEN UPPER(LTRIM(RTRIM(T0.DocumentType))) LIKE 'A/P CREDIT MEMO%' THEN 'APCM'
          WHEN UPPER(LTRIM(RTRIM(T0.DocumentType))) LIKE 'A/R INVOICE%'     THEN 'AR'
          WHEN UPPER(LTRIM(RTRIM(T0.DocumentType))) LIKE 'A/P INVOICE%'     THEN 'AP'
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
      WHERE T0.AcctCode = '611902'
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
        AND T0.ItemCode = 'NT04-0174'
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
      console.log(`  📎 [OJDT] ${r.SourceType} | TransId=${r.TransId} | DocType="${r.OJTDDocumentType}" | Acct=${r.Account} | D=${r.Debit} C=${r.Credit} | Date=${new Date(r.DocDate).toISOString().slice(0,10)} | BaseRef=${r.BaseRef ?? 'NULL'}`);
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
    resultArray.forEach(b => {
      console.log(`  🗓️ ${b.periodName}: ${b.entries.length} entr${b.entries.length === 1 ? 'y' : 'ies'} | net ₱${b.totalAmount.toFixed(2)}`);
    });

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
        fetchWindow: {
          from: startDate.toISOString().slice(0, 10),
          to: endDate.toISOString().slice(0, 10),
          programEndDate: programEndDate.toISOString().slice(0, 10),
          extended: endDate > programEndDate,
          lookaheadDays: LOOKAHEAD_DAYS,
        },
      },
    };

  } catch (error) {
    console.error('❌ [SAP] Error fetching:', error);
    return { success: false, entries: [], error: error.message };
  }
};

/* ══════════════════════════════════════════════════════════════════
   DEBUG endpoint
   ══════════════════════════════════════════════════════════════════ */
router.get('/debug/payout-table-structure', async (req, res) => {
  try {
    const { db } = req.query;
    const ownPool = getPool(db || 'NEXCHEM');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    const result = await ownPool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'PayoutHistory'
      ORDER BY ORDINAL_POSITION
    `);

    res.json({ success: true, data: { columns: result.recordset, tableExists: result.recordset.length > 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   SYNC endpoints
   ══════════════════════════════════════════════════════════════════ */
router.post('/sync-sap-data', async (req, res) => {
  try {
    const { db, customerCode, rebateCode, periodFrom, periodTo } = req.body;

    const ownPool = getPool(db || 'NEXCHEM');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    await ensureSAPColumnsExist(ownPool);
    await createPayoutHistoryTable(ownPool);

    const sapData = await fetchSAPJournalEntries(customerCode, periodFrom, periodTo, ownPool);

    if (!sapData.success || sapData.entries.length === 0) {
      return res.json({
        success: true,
        message: 'No SAP journal entries found for the specified period',
        sapData
      });
    }

    const rebateFrom = periodFrom ? new Date(periodFrom) : null;
    let   rebateTo   = periodTo   ? new Date(periodTo)   : null;
    const todayRef = new Date();
    const lookaheadEnd = new Date(todayRef.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    if (!rebateTo || lookaheadEnd > rebateTo) rebateTo = lookaheadEnd;
    if (rebateFrom) rebateFrom.setHours(0, 0, 0, 0);
    if (rebateTo)   rebateTo.setHours(23, 59, 59, 999);

    await insertRedemptionRows(customerCode, rebateCode, sapData.entries, ownPool, rebateFrom, rebateTo);

    res.json({
      success: true,
      message: `SAP data synced successfully - ${sapData.entries.length} periods found`,
      sapData: {
        periodsFound: sapData.entries.length,
        totalNetAmount: sapData.entries.reduce((sum, p) => sum + p.totalAmount, 0),
        entries: sapData.entries
      }
    });
  } catch (error) {
    console.error('❌ Error syncing SAP data:', error);
    res.status(500).json({ success: false, message: 'Error syncing SAP data', error: error.message });
  }
});

router.get('/sap-journal-entries/:customerCode', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { periodFrom, periodTo } = req.query;

    const startDate = periodFrom || `${new Date().getFullYear()}-01-01`;
    const endDate = periodTo || new Date().toISOString().split('T')[0];

    const sapData = await fetchSAPJournalEntries(customerCode, startDate, endDate, null);

    res.json({
      success: sapData.success,
      data: {
        entries: sapData.entries,
        customerCode,
        dateRange: { periodFrom: startDate, periodTo: endDate }
      },
      error: sapData.error
    });
  } catch (error) {
    console.error('❌ Error fetching SAP journal entries:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   SINGLE-MONTH CALCULATE DETAILS
   ══════════════════════════════════════════════════════════════════ */
router.get('/payouts/calculate/:customerCode/:rebateCode/:monthKey', async (req, res) => {
  try {
    const { customerCode, rebateCode, monthKey } = req.params;
    const { db } = req.query;

    const ownPool = getPool(db || 'NEXCHEM');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pools not available' });

    const [year, month] = monthKey.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const rebateTypeResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(`SELECT RebateType FROM RebateProgram WHERE RebateCode = @rebateCode`);

    if (rebateTypeResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: `Rebate with code ${rebateCode} not found` });
    }

    const rebateType = rebateTypeResult.recordset[0].RebateType;

    let transactions = [];
    try {
      const transUrl = `http://localhost:3011/api/dashboard/customer/${customerCode}/transactions?` +
        `db=${db || 'NEXCHEM'}&rebateCode=${rebateCode}&rebateType=${rebateType}&` +
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
        totalQtyForReb: transactions.reduce((sum, t) => sum + (parseFloat(t.QtyForReb) || 0), 0)
      }
    });
  } catch (error) {
    console.error('❌ Error calculating payout:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const calculatePayoutDetails = async (transactions, rebateType, customerCode, rebateCode, pool, monthKey) => {
  const result = {
    totalQtyForReb: 0, totalAdjustedQtyForReb: 0,
    eligible: false, rebatePerBag: 0, qtrRebate: 0, amount: 0,
    calculationSteps: [], itemBreakdown: []
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
  result.calculationSteps.push(`Adjusted QtyForReb: ${result.totalAdjustedQtyForReb.toFixed(2)} (25kg ÷ 2)`);

  try {
    const qtrRebateQuery = rebateType === 'Fixed'
      ? `SELECT QtrRebate FROM FixCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`
      : rebateType === 'Percentage'
      ? `SELECT QtrRebate FROM PerCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`
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
      result.amount = result.totalAdjustedQtyForReb * result.rebatePerBag;
      if (result.qtrRebate > 0) result.amount *= result.qtrRebate;
    }
  } else if (rebateType === 'Incremental') {
    const eligibleTransactions = transactions.filter(t => t.EligibilityStatus === 'Eligible' && t.CurrentRange);
    if (eligibleTransactions.length > 0) {
      const highestRange = Math.max(...eligibleTransactions.map(t => t.CurrentRange || 0));
      const highestTransaction = eligibleTransactions.find(t => t.CurrentRange === highestRange);
      result.eligible = true;
      result.rebatePerBag = parseFloat(highestTransaction?.RebatePerBag) || 0;
      result.amount = result.totalAdjustedQtyForReb * result.rebatePerBag;
      if (result.qtrRebate > 0) result.amount *= result.qtrRebate;
    }
  }

  result.calculationSteps.push(`Final amount: ${result.amount.toFixed(2)}`);
  result.calculationSteps.push(`Status: ${result.eligible ? 'Pending' : 'No Payout'}`);
  return result;
};

/* ══════════════════════════════════════════════════════════════════
   RESOLVER
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
          AND rp.Frequency  = @frequency
          AND EXISTS (
            SELECT 1 FROM PayoutHistory ph
            WHERE ph.CardCode = @customerCode AND ph.RebateCode = rp.RebateCode
          )
        ORDER BY rp.DateFrom ASC
      `);

    return siblingsResult.recordset;
  } catch (err) {
    console.error('❌ [RESOLVER] getAllRebateProgramsForCustomer:', err.message);
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

export const fetchAllSAPTransactionsForCustomer = async (customerCode) => {
  try {
    const sapPool = getPool('NEXCHEM');
    if (!sapPool) {
      return { success: false, ojdt: [], je: [], ar: [], ap: [], arcm: [], apcm: [] };
    }

    const ojdtQuery = `
      SELECT
        ISNULL(T0.DocumentType, 'JE') AS DocumentType,
        T0.ShortName  AS CardCode,
        T0.CardName,
        T0.RefDate    AS DocDate,
        T0.TransId    AS TransId,
        T0.BaseRef,
        T0.Account,
        T0.AcctName,
        T0.Debit,
        T0.Credit,
        T0.Memo,
        T0.LineMemo
      FROM OJDT T0
      WHERE T0.ShortName = @customerCode
        AND T0.AcctName LIKE '%Rebate%'
      ORDER BY T0.RefDate ASC, T0.TransId ASC
    `;

    const r = await sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .query(ojdtQuery);

    return {
      success: true,
      ojdt: r.recordset,
      je: [], ar: [], ap: [], arcm: [], apcm: [],
    };
  } catch (err) {
    console.error('❌ [SAP-UNIVERSAL] fetchAllSAPTransactionsForCustomer:', err.message);
    return { success: false, ojdt: [], je: [], ar: [], ap: [], arcm: [], apcm: [] };
  }
};

export const universalSyncSAPToAllRebates = async (customerCode, currentRebateCode, pool) => {
  console.log(`ℹ️ [UNIVERSAL-SYNC] Deprecated — use /customer/${customerCode}/payouts per rebate`);
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
      ORDER BY rp.DateFrom ASC
    `);
  return result.recordset;
};

router.get('/customer/:customerCode/payout-summary', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db } = req.query;
    const ownPool = getPool(db || 'NEXCHEM');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    await createPayoutHistoryTable(ownPool);

    const programs = await getCustomerRebatePrograms(customerCode, ownPool);

    for (const program of programs) {
      try {
        const calcUrl =
          `http://localhost:3011/api/nexchem/payouts/customer/${customerCode}/payouts` +
          `?db=${db || 'NEXCHEM'}&rebateCode=${program.RebateCode}&rebateType=${program.RebateType}&useRebatePeriod=true`;
        await fetch(calcUrl);
      } catch (calcErr) {
        console.log(`⚠️ [PAYOUT-SUMMARY] Calc error for ${program.RebateCode}:`, calcErr.message);
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

    let previousBalance = 0;
    const quarterSummary = sortedQuarterKeys.map(key => {
      const qg = byQuarter[key];
      const earned = qg.baseAmount;
      const cumulativeTotal = previousBalance + earned;
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

      previousBalance = balance;

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
    console.error('❌ [NEXCHEM] Error fetching payout summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;