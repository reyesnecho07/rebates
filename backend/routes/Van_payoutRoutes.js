// routes/Van_payoutRoutes.js
import express from 'express';
import sql from 'mssql';
import { getPool } from '../services/databaseService.js';

const router = express.Router();
const REDEMPTION_PREFIX = 'Redemption';

const getNextQuarterInfo = (currentQuarter, currentYear) => {
  let nextQuarter, nextYear;
  if (currentQuarter === 1) { nextQuarter = 2; nextYear = currentYear; }
  else if (currentQuarter === 2) { nextQuarter = 3; nextYear = currentYear; }
  else if (currentQuarter === 3) { nextQuarter = 4; nextYear = currentYear; }
  else { nextQuarter = 1; nextYear = currentYear + 1; }
  return {
    nextQuarter, nextYear,
    period: `Balance of Q${nextQuarter} ${nextYear}`,
    payoutQuarter: `Q${nextQuarter} ${nextYear}`
  };
};

const getQuarterFromDate = (date) => {
  const dateObj = new Date(date);
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();
  const quarter = Math.ceil(month / 3);
  return { quarter, year };
};

/* ══════════════════════════════════════════════════════════════════
   BEGINNING BALANCE — customer-wide, prior years only
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
          AND PayoutId NOT LIKE 'BAL-%'
          AND PayoutId NOT LIKE 'BEGBAL-%'
          AND PayoutId NOT LIKE 'CF-%'
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

    const earned = parseFloat(earnedResult.recordset[0]?.TotalEarned) || 0;
    const released = parseFloat(redResult.recordset[0]?.TotalReleased) || 0;
    const bal = earned - released;

    console.log(`💰 [VAN][BEG-BAL] ${customerCode} (year ${currentYear}): ₱${earned.toFixed(2)} − ₱${released.toFixed(2)} = ₱${bal.toFixed(2)}`);
    return bal;
  } catch (err) {
    console.error('❌ getBeginningBalanceForCustomer:', err.message);
    return 0;
  }
};

/* ══════════════════════════════════════════════════════════════════
   MAIN — /customer/:customerCode/payouts
   ══════════════════════════════════════════════════════════════════ */
router.get('/customer/:customerCode/payouts', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode, rebateType, periodFrom, periodTo, useRebatePeriod } = req.query;

    console.log('💰 [VAN] Fetching payouts:', { customerCode, rebateCode, rebateType, periodFrom, periodTo, useRebatePeriod });

    if (!customerCode || !rebateType) {
      return res.status(400).json({ success: false, message: 'Customer code and rebate type are required' });
    }

    const databaseToUse = db || 'VAN';
    const ownPool = getPool(databaseToUse);
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    await ensureSAPColumnsExist(ownPool);
    await createPayoutHistoryTable(ownPool);

    // Rebate program period
    let rebateDateFrom = '', rebateDateTo = '', isActive = false;
    let frequency = 'Quarterly', quotaType = 'N/A';
    if (rebateCode) {
      const rp = await ownPool.request()
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(`SELECT DateFrom, DateTo, IsActive, Frequency, QuotaType FROM RebateProgram WHERE RebateCode = @rebateCode`);
      if (rp.recordset.length > 0) {
        const rec = rp.recordset[0];
        rebateDateFrom = rec.DateFrom ? new Date(rec.DateFrom).toISOString().split('T')[0] : '';
        rebateDateTo   = rec.DateTo   ? new Date(rec.DateTo).toISOString().split('T')[0]   : '';
        isActive       = rec.IsActive === 1;
        frequency      = rec.Frequency || 'Quarterly';
        quotaType      = rec.QuotaType || 'N/A';
      }
    }

    let startDate, endDate, dateSource = 'manual';
    if (periodFrom && periodTo) {
      startDate = periodFrom; endDate = periodTo; dateSource = 'manual';
    } else if (useRebatePeriod === 'true' && rebateDateFrom && rebateDateTo && isActive) {
      startDate = rebateDateFrom; endDate = rebateDateTo; dateSource = 'rebate_period';
    } else if (rebateDateFrom && rebateDateTo) {
      startDate = rebateDateFrom; endDate = rebateDateTo; dateSource = 'rebate_period_fallback';
    } else {
      const y = new Date().getFullYear();
      startDate = `${y}-01-01`; endDate = new Date().toISOString().split('T')[0]; dateSource = 'current_year';
    }

    console.log('📅 [VAN] Date range:', { startDate, endDate, dateSource, frequency, quotaType });

    // SAP entries
    const sapData = await fetchSAPJournalEntries(customerCode, startDate, endDate, ownPool);
    if (sapData.success) console.log(`✅ [SAP] ${sapData.entries.length} periods`);
    else console.log('⚠️ [SAP] Failed');

    // Calculate monthly earned
    let monthlyData = [];
    if (rebateCode) {
      try {
        const txRes = await fetch(
          `http://localhost:3009/api/van/dashboard/customer/${customerCode}/transactions?` +
          `db=${databaseToUse}&rebateCode=${rebateCode}&rebateType=${rebateType}&` +
          `periodFrom=${startDate}&periodTo=${endDate}&useRebatePeriod=${useRebatePeriod}`
        );
        if (txRes.ok) {
          const txData = await txRes.json();
          if (txData.success && txData.data.transactions) {
            monthlyData = await calculateMonthlyPayoutData(
              txData.data.transactions, rebateType, customerCode, rebateCode,
              ownPool, frequency, [], quotaType, startDate, endDate
            );
            console.log(`📈 [VAN] Calculated ${monthlyData.length} earned records`);
          }
        }
      } catch (e) { console.error('❌ [VAN] transactions fetch:', e.message); }
    }

    // Save earned rows (BaseAmount = TotalAmount = earned only)
    try { await saveEarnedPayoutsToDatabase(monthlyData, ownPool, rebateCode, customerCode); }
    catch (e) { console.error('❌ [VAN] saveEarned:', e.message); }

    // Insert redemption rows from SAP (only docs inside rebate period)
    if (sapData.success && sapData.entries.length > 0) {
      try {
        const rebateFrom = startDate ? new Date(startDate) : null;
        const rebateTo   = endDate   ? new Date(endDate)   : null;
        if (rebateFrom) rebateFrom.setHours(0, 0, 0, 0);
        if (rebateTo)   rebateTo.setHours(23, 59, 59, 999);
        await insertRedemptionRows(customerCode, rebateCode, sapData.entries, ownPool, rebateFrom, rebateTo);
      } catch (e) { console.error('❌ [VAN] redemption:', e.message); }
    }

    // Beginning balance (customer-wide, prior years only)
    const previousBalance = await getBeginningBalanceForCustomer(customerCode, ownPool);
    let beginningBalanceRecord = null;
    if (previousBalance > 0) {
      beginningBalanceRecord = createBeginningBalanceRecord(customerCode, rebateCode, rebateType, previousBalance);
    }

    // Final rows
    let finalPayouts = [];
    try {
      let q = `
        SELECT Id, PayoutId, CardCode, RebateCode, RebateType,
               PayoutDate AS Date, Period, PayoutQuarter,
               BaseAmount, TotalAmount AS Amount, TotalAmount,
               Status, AmountReleased, SapReleasedAmount, SapLastSync,
               DocumentType, DocumentNumber, ReleaseDate,
               RebateBalance AS Balance, CreatedDate, UpdatedDate,
               0 AS IsBeginningBalance
        FROM PayoutHistory
        WHERE CardCode = @customerCode
          AND ISNULL(Period, '') NOT LIKE 'Balance of %'
          AND ISNULL(Period, '') NOT LIKE 'Beginning Balance%'
          AND PayoutId NOT LIKE 'SAP-%'
          AND PayoutId NOT LIKE 'SAPDOC-%'
          AND PayoutId NOT LIKE 'BeginningBalance-%'
          AND PayoutId NOT LIKE 'OOP-%'
          AND PayoutId NOT LIKE 'BAL-%'
          AND PayoutId NOT LIKE 'BEGBAL-%'
          AND PayoutId NOT LIKE 'CF-%'
      `;
      const reqF = ownPool.request().input('customerCode', sql.NVarChar(50), customerCode);
      if (rebateCode) { q += ` AND RebateCode = @rebateCode`; reqF.input('rebateCode', sql.NVarChar(50), rebateCode); }
      q += ` ORDER BY Id ASC`;
      const r = await reqF.query(q);
      finalPayouts = r.recordset;
      console.log(`📊 [VAN] Final rows: ${finalPayouts.length}`);
    } catch (e) { console.error('❌ [VAN] final query:', e.message); }

    const redemptions = finalPayouts.filter(p => p.DocumentType).map(p => ({
      period: p.Period, sourceType: p.DocumentType,
      documentNumber: p.DocumentNumber || '', documentType: p.DocumentType,
      amount: parseFloat(p.AmountReleased) || 0, date: p.Date,
    }));
    const totalRedemptionSigned = redemptions.reduce((s, r) => s + r.amount, 0);
    const totalEarned = finalPayouts.reduce((s, p) => p.DocumentType ? s : s + (parseFloat(p.BaseAmount) || 0), 0);

    const hasBeginningBalance = previousBalance > 0 && beginningBalanceRecord !== null;

    res.json({
      success: true,
      data: {
        payouts: finalPayouts,
        beginningBalances: hasBeginningBalance ? [beginningBalanceRecord] : [],
        regularPayouts: finalPayouts.filter(p => !p.DocumentType),
        previousBalance: hasBeginningBalance ? previousBalance : 0,
        beginningBalanceRecord: hasBeginningBalance ? beginningBalanceRecord : null,
        customerCode, rebateCode, rebateType, frequency, quotaType,
        redemptions,
        redemptionSummary: { netReleased: totalRedemptionSigned, documentCount: redemptions.length },
        earnedSummary: { totalEarned },
        sapData: {
          available: sapData.success,
          periodsFound: sapData.entries.length,
          lastSync: new Date().toISOString(),
        },
        dateRange: {
          periodFrom: startDate, periodTo: endDate,
          autoLoaded: dateSource !== 'manual', dateSource,
          rebatePeriodAvailable: !!(rebateDateFrom && rebateDateTo),
          rebatePeriod: { from: rebateDateFrom, to: rebateDateTo },
        },
        autoSynced: false,
      }
    });
  } catch (error) {
    console.error('❌ [VAN] Error fetching payouts:', error);
    res.status(500).json({ success: false, message: 'Error fetching payout data', error: error.message, stack: error.stack });
  }
});

/* ══════════════════════════════════════════════════════════════════
   BEGINNING BALANCE RECORD (prior-year)
   ══════════════════════════════════════════════════════════════════ */
const createBeginningBalanceRecord = (customerCode, rebateCode, rebateType, previousBalance) => {
  try {
    const currentYear = new Date().getFullYear();
    const formattedDate = `12.31.${String(currentYear - 1).slice(-2)}`;
    return {
      Id: `BeginningBalance-${customerCode}-${rebateCode}-${Date.now()}`,
      PayoutId: `BeginningBalance-${customerCode}-${rebateCode}`,
      CardCode: customerCode, RebateCode: rebateCode, RebateType: rebateType,
      Date: formattedDate, Period: 'Beginning Balance',
      BaseAmount: 0, TotalAmount: 0, Amount: 0,
      Status: 'Beginning Balance',
      AmountReleased: 0, SapReleasedAmount: 0,
      Balance: previousBalance, ReleaseDate: null,
      CreatedDate: new Date().toISOString().split('T')[0],
      UpdatedDate: new Date().toISOString().split('T')[0],
      PreviousBalance: previousBalance,
      isBeginningBalance: true,
      CalculationNote: `Previous year balance carried forward: ₱${previousBalance.toFixed(2)}`,
      displayType: 'beginning_balance',
    };
  } catch (e) { console.error('❌ createBeginningBalanceRecord:', e.message); return null; }
};

/* ══════════════════════════════════════════════════════════════════
   TABLE SETUP
   ══════════════════════════════════════════════════════════════════ */
const createPayoutHistoryTable = async (pool) => {
  try {
    const q = `
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
          PayoutQuarter NVARCHAR(20),
          BaseAmount DECIMAL(18,2) DEFAULT 0,
          TotalAmount DECIMAL(18,2) DEFAULT 0,
          Status NVARCHAR(50) DEFAULT 'Pending',
          AmountReleased DECIMAL(18,2) DEFAULT 0,
          SapReleasedAmount DECIMAL(18,2) DEFAULT 0,
          SapLastSync DATETIME,
          DocumentType NVARCHAR(50),
          DocumentNumber NVARCHAR(100),
          ReleaseDate DATETIME,
          RebateBalance DECIMAL(18,2) DEFAULT 0,
          CreatedDate DATETIME DEFAULT GETDATE(),
          UpdatedDate DATETIME DEFAULT GETDATE()
        )
        CREATE INDEX IX_PayoutHistory_CardCode ON PayoutHistory(CardCode);
        CREATE INDEX IX_PayoutHistory_RebateCode ON PayoutHistory(RebateCode);
        CREATE INDEX IX_PayoutHistory_RebateType ON PayoutHistory(RebateType);
        CREATE INDEX IX_PayoutHistory_Status ON PayoutHistory(Status);
        CREATE INDEX IX_PayoutHistory_PayoutId ON PayoutHistory(PayoutId);
        CREATE INDEX IX_PayoutHistory_PayoutQuarter ON PayoutHistory(PayoutQuarter);
      END
      ELSE
      BEGIN
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='PayoutHistory' AND COLUMN_NAME='PayoutQuarter')
          ALTER TABLE PayoutHistory ADD PayoutQuarter NVARCHAR(20);
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='PayoutHistory' AND COLUMN_NAME='SapReleasedAmount')
          ALTER TABLE PayoutHistory ADD SapReleasedAmount DECIMAL(18,2) DEFAULT 0;
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='PayoutHistory' AND COLUMN_NAME='SapLastSync')
          ALTER TABLE PayoutHistory ADD SapLastSync DATETIME;
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='PayoutHistory' AND COLUMN_NAME='DocumentType')
          ALTER TABLE PayoutHistory ADD DocumentType NVARCHAR(50);
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='PayoutHistory' AND COLUMN_NAME='DocumentNumber')
          ALTER TABLE PayoutHistory ADD DocumentNumber NVARCHAR(100) NULL;
        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='PayoutHistory' AND COLUMN_NAME='DocumentType' AND CHARACTER_MAXIMUM_LENGTH < 50)
          ALTER TABLE PayoutHistory ALTER COLUMN DocumentType NVARCHAR(50) NULL;
      END
    `;
    await pool.request().query(q);
  } catch (e) { console.error('❌ createPayoutHistoryTable:', e); }
};

const ensureSAPColumnsExist = async (pool) => {
  try { await createPayoutHistoryTable(pool); }
  catch (e) { console.error('❌ ensureSAPColumnsExist:', e); }
};

/* ══════════════════════════════════════════════════════════════════
   SAVE EARNED ROWS — only BaseAmount / TotalAmount / Status
   ══════════════════════════════════════════════════════════════════ */
const saveEarnedPayoutsToDatabase = async (payouts, pool, rebateCode, customerCode) => {
  try {
    console.log(`💾 [VAN] Saving ${payouts.length} earned rows`);
    for (const payout of payouts) {
      try {
        const baseAmount = parseFloat(payout.baseAmount) || 0;
        const totalAmount = baseAmount;
        const isQuotaNotMet = payout.quotaMet === false && payout.eligible === false;
        const finalBase = isQuotaNotMet ? 0 : baseAmount;
        const finalTotal = isQuotaNotMet ? 0 : totalAmount;
        const finalStatus = finalTotal === 0 ? 'No Payout' : (payout.status || 'Pending');

        const check = await pool.request()
          .input('PayoutId', sql.NVarChar(150), payout.id)
          .query(`SELECT Id FROM PayoutHistory WHERE PayoutId = @PayoutId`);

        if (check.recordset.length > 0) {
          await pool.request()
            .input('PayoutId', sql.NVarChar(150), payout.id)
            .input('BaseAmount', sql.Decimal(18, 2), finalBase)
            .input('TotalAmount', sql.Decimal(18, 2), finalTotal)
            .input('Status', sql.NVarChar(50), finalStatus)
            .input('RebateType', sql.NVarChar(50), payout.rebateType || 'Fixed')
            .input('PayoutQuarter', sql.NVarChar(20), payout.payoutQuarter || null)
            .query(`
              UPDATE PayoutHistory
              SET BaseAmount = @BaseAmount, TotalAmount = @TotalAmount,
                  Status = @Status, RebateType = @RebateType,
                  PayoutQuarter = @PayoutQuarter, UpdatedDate = GETDATE()
              WHERE PayoutId = @PayoutId
            `);
        } else {
          await pool.request()
            .input('PayoutId', sql.NVarChar(150), payout.id)
            .input('CardCode', sql.NVarChar(50), payout.cardCode || customerCode)
            .input('RebateCode', sql.NVarChar(50), payout.rebateCode || rebateCode)
            .input('RebateType', sql.NVarChar(50), payout.rebateType || 'Fixed')
            .input('PayoutDate', sql.NVarChar(20), '')
            .input('Period', sql.NVarChar(100), payout.period || '')
            .input('PayoutQuarter', sql.NVarChar(20), payout.payoutQuarter || null)
            .input('BaseAmount', sql.Decimal(18, 2), finalBase)
            .input('TotalAmount', sql.Decimal(18, 2), finalTotal)
            .input('Status', sql.NVarChar(50), finalStatus)
            .input('AmountReleased', sql.Decimal(18, 2), 0)
            .input('SapReleasedAmount', sql.Decimal(18, 2), 0)
            .input('RebateBalance', sql.Decimal(18, 2), 0)
            .query(`
              INSERT INTO PayoutHistory (
                PayoutId, CardCode, RebateCode, RebateType,
                PayoutDate, Period, PayoutQuarter,
                BaseAmount, TotalAmount, Status,
                AmountReleased, SapReleasedAmount, RebateBalance
              ) VALUES (
                @PayoutId, @CardCode, @RebateCode, @RebateType,
                @PayoutDate, @Period, @PayoutQuarter,
                @BaseAmount, @TotalAmount, @Status,
                @AmountReleased, @SapReleasedAmount, @RebateBalance
              )
            `);
        }
      } catch (e) { console.error(`❌ saveEarned ${payout?.id}:`, e.message); }
    }
    console.log(`✅ [VAN] Saved ${payouts.length} earned rows`);
  } catch (e) { console.error('❌ saveEarnedPayoutsToDatabase:', e); }
};

/* ══════════════════════════════════════════════════════════════════
   INSERT REDEMPTION ROWS
   Skips docs outside rebate period → no cross-year duplication
   ══════════════════════════════════════════════════════════════════ */
const insertRedemptionRows = async (customerCode, rebateCode, sapEntries, pool, rebateFrom = null, rebateTo = null) => {
  try {
    await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(`
        DELETE FROM PayoutHistory
        WHERE CardCode = @cc AND RebateCode = @rc
          AND (PayoutId LIKE '${REDEMPTION_PREFIX}-%'
            OR PayoutId LIKE 'SAP-%'
            OR PayoutId LIKE 'SAPDOC-%')
      `);

    let inserted = 0, skipped = 0;
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
        if (rebateTo && docDate > rebateTo) { skipped++; continue; }

        const yy = String(docDate.getFullYear()).slice(-2);
        const payoutDate = `${docDate.getMonth() + 1}.${docDate.getDate()}.${yy}`;
        const documentNumber = rawType === 'JE'
          ? String(doc.transId || doc.docNum || doc.baseRef || '')
          : String(doc.baseRef || doc.docNum || doc.transId || '');

        const unique = `${periodKey}-${rawType}-${documentNumber || i}-${i}`;
        const redemptionId = `${REDEMPTION_PREFIX}-${customerCode}-${rebateCode}-${unique}`.slice(0, 150);
        const twoDigit = String(year).slice(-2);
        const pQuarter = `Q${Math.ceil(month / 3)} ${year}`;

        await pool.request()
          .input('PayoutId', sql.NVarChar(150), redemptionId)
          .input('CardCode', sql.NVarChar(50), customerCode)
          .input('RebateCode', sql.NVarChar(50), rebateCode)
          .input('RebateType', sql.NVarChar(50), 'SAP-REDEMPTION')
          .input('DocumentType', sql.NVarChar(50), rawType)
          .input('DocumentNumber', sql.NVarChar(100), documentNumber || null)
          .input('PayoutDate', sql.NVarChar(20), payoutDate)
          .input('Period', sql.NVarChar(100), periodName || '')
          .input('PayoutQuarter', sql.NVarChar(20), pQuarter)
          .input('BaseAmount', sql.Decimal(18, 2), 0)
          .input('TotalAmount', sql.Decimal(18, 2), signedAmount)
          .input('Status', sql.NVarChar(50), 'Released')
          .input('AmountReleased', sql.Decimal(18, 2), signedAmount)
          .input('SapReleasedAmount', sql.Decimal(18, 2), signedAmount)
          .input('RebateBalance', sql.Decimal(18, 2), 0)
          .query(`
            INSERT INTO PayoutHistory (
              PayoutId, CardCode, RebateCode, RebateType,
              DocumentType, DocumentNumber, PayoutDate, Period, PayoutQuarter,
              BaseAmount, TotalAmount, Status,
              AmountReleased, SapReleasedAmount, SapLastSync, RebateBalance
            ) VALUES (
              @PayoutId, @CardCode, @RebateCode, @RebateType,
              @DocumentType, @DocumentNumber, @PayoutDate, @Period, @PayoutQuarter,
              @BaseAmount, @TotalAmount, @Status,
              @AmountReleased, @SapReleasedAmount, GETDATE(), @RebateBalance
            )
          `);
        inserted++;
      }
    }
    console.log(`📄 [REDEMPTION] Inserted ${inserted}, skipped ${skipped} for ${customerCode}/${rebateCode}`);
  } catch (err) { console.error('❌ insertRedemptionRows:', err.message); }
};

/* ══════════════════════════════════════════════════════════════════
   calculateMonthlyPayoutData — earned only, unitPerQty/25kg consistent
   Fixed / Percentage / Incremental all use qtyForReb = (sales / unitPerQty) / (25kg ? 2 : 1)
   ══════════════════════════════════════════════════════════════════ */
const calculateMonthlyPayoutData = async (
  transactions, rebateType, customerCode, rebateCode, pool,
  frequency = 'Quarterly', sapEntries = [], quotaType = 'N/A',
  periodStart = null, periodEnd = null
) => {
  try {
    console.log(`📊 [VAN] Calc: ${customerCode}/${rebateCode} type=${rebateType} freq=${frequency} quota=${quotaType}`);
    const isDynamicFrequency = frequency && frequency !== 'Monthly' && frequency !== 'Quarterly';

    // Program dates
    const rp = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(`SELECT DateFrom, DateTo FROM RebateProgram WHERE RebateCode = @rebateCode`);
    let programStartDate = new Date(), programEndDate = new Date();
    if (rp.recordset.length > 0) {
      if (rp.recordset[0].DateFrom) programStartDate = new Date(rp.recordset[0].DateFrom);
      if (rp.recordset[0].DateTo)   programEndDate   = new Date(rp.recordset[0].DateTo);
    }

    // Rate maps — populated by rebateType
    let baseRebatePerBag = 0, percentageValue = 0, qtrRebate = 0;
    let hasQtrRebate = false; // ← true only when this customer has a positive QtrRebate configured
    const itemPercentageMap = new Map();
    const fixedRebatePerBagMap = {};
    const fixedUnitPerQtyMap = {};
    let incrementalRanges = [];

    if (rebateType === 'Percentage') {
      try {
        const r = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT ItemCode, PercentagePerBag FROM PerProdRebate WHERE RebateCode = @rebateCode`);
        r.recordset.forEach(row => {
          if (row.ItemCode && row.PercentagePerBag != null) {
            itemPercentageMap.set(row.ItemCode, parseFloat(row.PercentagePerBag) || 0);
          }
        });
        if (itemPercentageMap.size > 0) percentageValue = itemPercentageMap.values().next().value || 0;

        const qr = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT QtrRebate FROM PerCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`);
        if (qr.recordset.length > 0 && qr.recordset[0].QtrRebate != null) {
          const v = parseFloat(qr.recordset[0].QtrRebate);
          if (!isNaN(v) && v > 0) { qtrRebate = v; hasQtrRebate = true; }
        }
      } catch (e) { console.log('⚠️ [VAN] % load:', e.message); }
    } else if (rebateType === 'Fixed') {
      try {
        const r = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT ItemCode, RebatePerBag, UnitPerQty FROM FixProdRebate WHERE RebateCode = @rebateCode`);
        r.recordset.forEach(row => {
          if (row.ItemCode) {
            fixedRebatePerBagMap[row.ItemCode] = parseFloat(row.RebatePerBag) || 0;
            fixedUnitPerQtyMap[row.ItemCode]   = parseFloat(row.UnitPerQty) || 1;
          }
        });
        const rates = Object.values(fixedRebatePerBagMap);
        baseRebatePerBag = rates.length > 0 ? rates[0] : 0;

        const qr = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT QtrRebate FROM FixCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`);
        if (qr.recordset.length > 0 && qr.recordset[0].QtrRebate != null) {
          const v = parseFloat(qr.recordset[0].QtrRebate);
          if (!isNaN(v) && v > 0) { qtrRebate = v; hasQtrRebate = true; }
        }
      } catch (e) { console.log('⚠️ [VAN] Fix load:', e.message); }
    } else if (rebateType === 'Incremental') {
      try {
        const r = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT RangeNo, MinQty, MaxQty, RebatePerBag FROM IncCustRange WHERE RebateCode = @rebateCode ORDER BY RangeNo`);
        incrementalRanges = r.recordset.map(x => ({
          rangeNo: x.RangeNo, minQty: parseFloat(x.MinQty) || 0,
          maxQty: parseFloat(x.MaxQty) || 0, rebatePerBag: parseFloat(x.RebatePerBag) || 0,
        }));

        const qr = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`SELECT QtrRebate FROM IncCustRebate WHERE CardCode = @customerCode AND RebateCode = @rebateCode`);
        if (qr.recordset.length > 0 && qr.recordset[0].QtrRebate != null) {
          const v = parseFloat(qr.recordset[0].QtrRebate);
          if (!isNaN(v) && v > 0) { qtrRebate = v; hasQtrRebate = true; }
        }
      } catch (e) { console.log('⚠️ [VAN] Inc load:', e.message); }
    }

    // Customer quotas (Fixed & Percentage)
    const customerQuotas = {};
    if (rebateType === 'Fixed' || rebateType === 'Percentage') {
      try {
        const quotaQuery = rebateType === 'Fixed'
          ? `SELECT T2.Month, T2.TargetQty FROM FixCustRebate T1 INNER JOIN FixCustQuota T2 ON T1.Id = T2.CustRebateId WHERE T1.CardCode = @customerCode AND T1.RebateCode = @rebateCode`
          : `SELECT T2.Month, T2.TargetQty FROM PerCustRebate T1 INNER JOIN PerCustQuota T2 ON T1.Id = T2.PerCustRebateId WHERE T1.CardCode = @customerCode AND T1.RebateCode = @rebateCode`;
        const r = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(quotaQuery);
        r.recordset.forEach(row => {
          if (row.Month && row.TargetQty != null) customerQuotas[row.Month] = parseFloat(row.TargetQty) || 0;
        });
      } catch (e) { console.log('⚠️ [VAN] quota:', e.message); }
    }

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthlyGroups = {};
    const incrementalAccum = {};
    const percentageQtyAccum = {};

const computeQtyForReb = (txn, itemCode) => {
  const actual = parseFloat(txn.ActualSales) || 0;
  const itemName = txn.Item || txn.ItemName || '';
  const is25kg = txn.Is25kgItem ||
    (itemName && itemName.toLowerCase().includes('25kg')) ||
    (txn.Weight && txn.Weight.toString().includes('25'));

  // unitPerQty: per-item override → transaction → 1
  const perItem = itemCode && fixedUnitPerQtyMap[itemCode] != null
    ? fixedUnitPerQtyMap[itemCode]
    : null;
  const txnUnit = parseFloat(txn.UnitPerQty) || 1;
  const unitPerQty = (perItem == null ? txnUnit : perItem) || 1;

  // Trust backend QtyForReb when it exists (already adjusted upstream).
  // Otherwise, only divide when UnitPerQty > 1. NO forced ÷2 for 25kg.
  const backendQty = parseFloat(txn.QtyForReb);
  let finalQty;
  if (!isNaN(backendQty) && backendQty > 0) {
    finalQty = backendQty;
  } else {
    finalQty = unitPerQty > 1 ? actual / unitPerQty : actual;
  }

  return { finalQty, is25kg, unitPerQty };
};

    if (Array.isArray(transactions) && transactions.length > 0) {
      transactions.forEach((txn, index) => {
        try {
          if (!txn.Date) return;
          const date = new Date(txn.Date);
          if (isNaN(date.getTime())) return;

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

          const actualSales = parseFloat(txn.ActualSales) || 0;
          const priceAfVAT  = parseFloat(txn.PriceAfVAT) || 0;
          const itemCode    = txn.ItemCode || txn.Item || '';
          const itemName    = txn.ItemName || txn.Item || `Item_${index}`;
          const { finalQty, is25kg, unitPerQty, baseQty } = computeQtyForReb(txn, itemCode);

          let dailyRebate = 0;
          let calculationNote = '';
          let percentageUsed = 0;

          if (rebateType === 'Percentage') {
            percentageUsed = (itemCode && itemPercentageMap.has(itemCode))
              ? itemPercentageMap.get(itemCode) : percentageValue;
            dailyRebate = (finalQty * priceAfVAT * percentageUsed) / 100;
            calculationNote = `${actualSales}${unitPerQty > 1 ? ` ÷ ${unitPerQty}` : ''}${is25kg ? ' ÷ 2' : ''} = ${finalQty.toFixed(2)} bags × ₱${priceAfVAT.toFixed(2)} × ${percentageUsed}% = ₱${dailyRebate.toFixed(2)}`;
          } else if (rebateType === 'Fixed') {
            const rate = fixedRebatePerBagMap[itemCode] != null ? fixedRebatePerBagMap[itemCode] : baseRebatePerBag;
            dailyRebate = finalQty * rate;
            calculationNote = `${actualSales}${unitPerQty > 1 ? ` ÷ ${unitPerQty}` : ''}${is25kg ? ' ÷ 2' : ''} = ${finalQty.toFixed(2)} bags × ₱${rate.toFixed(2)} = ₱${dailyRebate.toFixed(2)}`;
          } else if (rebateType === 'Incremental') {
            dailyRebate = 0;
            if (!incrementalAccum[monthKey]) {
              incrementalAccum[monthKey] = { totalQty: 0, highestRange: null, rate: 0, hasEligible: false };
            }
            const acc = incrementalAccum[monthKey];
            acc.totalQty += finalQty;
            const txnRange = txn.CurrentRange || txn.RangeNo || null;
            const txnRate = parseFloat(txn.RebatePerBag) || 0;
            const txnEligible = txn.EligibilityStatus === 'Eligible' || (txnRange && txnRange > 0);
            if (txnEligible && txnRange) {
              acc.hasEligible = true;
              if (!acc.highestRange || txnRange > acc.highestRange) {
                acc.highestRange = txnRange;
                if (txnRate > 0) acc.rate = txnRate;
                else if (incrementalRanges.length > 0) {
                  const rng = incrementalRanges.find(r => r.rangeNo === txnRange);
                  if (rng) acc.rate = rng.rebatePerBag;
                }
              }
            }
            calculationNote = `Incremental qty ${finalQty.toFixed(2)} (month total: ${acc.totalQty.toFixed(2)})`;
          }

          const itemKey = itemCode || itemName;
          if (!monthlyGroups[monthKey].itemBreakdown.has(itemKey)) {
            monthlyGroups[monthKey].itemBreakdown.set(itemKey, {
              itemCode, itemName, totalActualSales: 0, totalRebate: 0,
              percentageUsed, transactionCount: 0,
            });
          }
          const ib = monthlyGroups[monthKey].itemBreakdown.get(itemKey);
          ib.totalActualSales += actualSales;
          ib.totalRebate += dailyRebate;
          ib.transactionCount++;

          monthlyGroups[monthKey].dailyTransactions.push({
            date: txn.Date, itemCode, itemName, actualSales, priceAfVAT,
            dailyRebate, percentageUsed, calculationNote, is25kg,
            EligibilityStatus: txn.EligibilityStatus,
            CurrentRange: txn.CurrentRange,
            RebatePerBag: parseFloat(txn.RebatePerBag || txn.rebatePerBag || 0),
            QtyForReb: finalQty,
          });

          monthlyGroups[monthKey].totalBaseAmount += dailyRebate;
          monthlyGroups[monthKey].totalActualSales += actualSales;
          monthlyGroups[monthKey].totalPriceAfVAT += priceAfVAT;
          monthlyGroups[monthKey].totalQtyForReb += actualSales;
          monthlyGroups[monthKey].totalAdjustedQtyForReb += finalQty;

          if (rebateType === 'Percentage') {
            if (!percentageQtyAccum[monthKey]) percentageQtyAccum[monthKey] = 0;
            percentageQtyAccum[monthKey] += finalQty;
          }
        } catch (e) { console.error(`❌ txn ${index}:`, e.message); }
      });
    }

    // Add empty months inside the period
    if (periodStart && periodEnd) {
      const s = new Date(periodStart), e = new Date(periodEnd);
      let cur = new Date(s.getFullYear(), s.getMonth(), 1);
      const last = new Date(e.getFullYear(), e.getMonth(), 1);
      while (cur <= last) {
        const y = cur.getFullYear(), m = cur.getMonth(), mn = m + 1;
        const monthKey = `${y}-${String(mn).padStart(2, '0')}`;
        if (!monthlyGroups[monthKey]) {
          const monthName = monthNames[m];
          const lastDay = new Date(y, mn, 0);
          const payoutDate = `${lastDay.getMonth() + 1}.${lastDay.getDate()}.${lastDay.getFullYear().toString().slice(-2)}`;
          monthlyGroups[monthKey] = {
            monthKey, monthName, monthNumber: mn, year: y,
            quarter: Math.floor(m / 3) + 1, payoutDate,
            period: `${monthName} ${y}`,
            totalBaseAmount: 0, totalActualSales: 0, totalPriceAfVAT: 0,
            totalQtyForReb: 0, totalAdjustedQtyForReb: 0,
            dailyTransactions: [], hasTransactions: false, itemBreakdown: new Map(),
            isNoTransactionMonth: true,
          };
        }
        cur = new Date(y, m + 1, 1);
      }
    }

    const monthlyData = [];
    const sortedMonthKeys = Object.keys(monthlyGroups).sort();

    for (const monthKey of sortedMonthKeys) {
      const monthWithData = monthlyGroups[monthKey];
      let baseAmount = monthWithData.totalBaseAmount || 0;
      let eligible = true, quotaMet = true, calculationNote = '';
      let status = baseAmount > 0 ? 'Pending' : 'No Payout';

      if (monthWithData.isNoTransactionMonth) {
        baseAmount = 0; status = 'No Payout'; eligible = false; quotaMet = false;
        calculationNote = 'No transactions this month';
      } else if (rebateType === 'Fixed' && (frequency === 'Monthly' || isDynamicFrequency)) {
        // Dynamic/monthly Fixed: cumulative quota
        const totalQuota = Object.values(customerQuotas).reduce((s, q) => s + q, 0);
        const hasQuota = totalQuota > 0;
        // (cumulative accumulation handled below if needed; for now use month-level)
        quotaMet = true; eligible = baseAmount > 0;
        status = baseAmount > 0 ? 'Pending' : 'No Payout';
      } else if (rebateType === 'Fixed') {
        // Only enforce monthly quota if this customer actually has a QtrRebate configured
        const targetQuota = customerQuotas[monthWithData.monthName] || 0;
        if (hasQtrRebate && targetQuota > 0) {
          quotaMet = (monthWithData.totalAdjustedQtyForReb || 0) >= targetQuota;
          eligible = quotaMet;
          if (!quotaMet) { baseAmount = 0; status = 'No Payout'; }
        }
      } else if (rebateType === 'Percentage' && quotaType === 'With Quota') {
        // Only enforce quota if this customer actually has a QtrRebate configured
        const targetQuota = customerQuotas[monthWithData.monthName] || 0;
        if (hasQtrRebate && targetQuota > 0) {
          const achievedQty = percentageQtyAccum[monthKey] || 0;
          quotaMet = achievedQty >= targetQuota;
          eligible = quotaMet;
          if (!quotaMet) { baseAmount = 0; status = 'No Payout'; }
        }
      } else if (rebateType === 'Incremental') {
        const acc = incrementalAccum[monthKey] || { totalQty: 0, highestRange: null, rate: 0, hasEligible: false };
        const incEligible = acc.hasEligible && acc.rate > 0;
        const incBase = incEligible ? acc.totalQty * acc.rate : 0;
        baseAmount = incBase; eligible = incEligible; quotaMet = incEligible;
        status = incBase > 0 ? 'Pending' : 'No Payout';
        calculationNote = incEligible
          ? `Incremental: ${acc.totalQty.toFixed(2)} × ₱${acc.rate.toFixed(2)} (Range ${acc.highestRange}) = ₱${incBase.toFixed(2)}`
          : 'Incremental: No eligible transactions';
      }

      const monthName = monthWithData.monthName;
      const quarter = monthWithData.quarter;
      const year = monthWithData.year;

      const monthlyRecord = {
        id: `Month-${customerCode}-${rebateCode}-${monthKey}`,
        type: 'monthly',
        cardCode: customerCode, rebateCode,
        date: monthWithData.payoutDate,
        period: monthWithData.period,
        payoutQuarter: `Q${quarter} ${year}`,
        monthKey, monthNumber: monthWithData.monthNumber,
        quarter, year,
        baseAmount: parseFloat(baseAmount.toFixed(2)),
        amount: parseFloat(baseAmount.toFixed(2)),
        status, amountReleased: 0, sapReleasedAmount: 0, sapEntries: [],
        balance: 0, eligible, quotaMet,
        totalActualSales: monthWithData.totalActualSales,
        totalPriceAfVAT: monthWithData.totalPriceAfVAT,
        totalQtyForReb: monthWithData.totalQtyForReb,
        totalAdjustedQtyForReb: monthWithData.totalAdjustedQtyForReb,
        calculationNote,
        qtrRebate, hasTransactions: !monthWithData.isNoTransactionMonth,
        transactionCount: monthWithData.dailyTransactions.length,
        isNonEligibleMonth: !eligible || !quotaMet,
        rebateType, rebatePerBag: baseRebatePerBag, percentageValue, frequency,
        hasQtrRebate,
      };
      monthlyData.push(monthlyRecord);
    }

    // Quarterly bonus — ONLY when this customer actually has a QtrRebate configured
    const quarterlyData = [];
    if (frequency === 'Quarterly' && hasQtrRebate && qtrRebate > 0) {
      const quarters = {};
      monthlyData.forEach(m => {
        const qKey = `Q${m.quarter}-${m.year}`;
        if (!quarters[qKey]) quarters[qKey] = { quarter: m.quarter, year: m.year, months: [], totalBaseAmount: 0, eligibleMonths: 0, totalMonths: 0 };
        quarters[qKey].months.push(m);
        quarters[qKey].totalBaseAmount += m.baseAmount;
        quarters[qKey].totalMonths++;
        if (m.hasTransactions) quarters[qKey].eligibleMonths++;
      });

      Object.keys(quarters).forEach(qKey => {
        const q = quarters[qKey];
        if (q.eligibleMonths === 3 && q.totalMonths === 3) {
          const amt = rebateType === 'Percentage' ? q.totalBaseAmount * (qtrRebate / 100) : q.totalBaseAmount * qtrRebate;
          quarterlyData.push({
            id: `QtrRebate-${customerCode}-${rebateCode}-${qKey}`,
            type: 'quarterly', cardCode: customerCode, rebateCode,
            date: `${q.quarter}.${q.year.toString().slice(-2)}`,
            period: `Quarter ${q.quarter} ${q.year}`,
            payoutQuarter: `Q${q.quarter} ${q.year}`,
            quarter: q.quarter, year: q.year,
            baseAmount: amt, amount: parseFloat(amt.toFixed(2)),
            status: 'Pending', amountReleased: 0, sapReleasedAmount: 0,
            balance: 0, eligible: true, quotaMet: true, qtrRebate, isQtrRebate: true,
            calculationNote: `QTR Rebate: ₱${q.totalBaseAmount.toFixed(2)} × ${qtrRebate}${rebateType === 'Percentage' ? '%' : ''} = ₱${amt.toFixed(2)}`,
            rebateType, frequency,
          });
        }
      });
    }

    return [...monthlyData, ...quarterlyData];
  } catch (error) {
    console.error('❌ calculateMonthlyPayoutData:', error);
    return [];
  }
};

/* ══════════════════════════════════════════════════════════════════
   SAP FETCH — OJDT only (JE/AR/AP/ARCM/APCM classified by DocumentType)
   ══════════════════════════════════════════════════════════════════ */
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const toPeriodMeta = (date) => {
  const d = new Date(date);
  const year = d.getFullYear(), month = d.getMonth() + 1;
  return { year, month, periodKey: `${year}-${String(month).padStart(2, '0')}`, periodName: `${MONTH_NAMES[month - 1]} ${year}` };
};

const normalizeDocType = (rawType) => {
  const t = String(rawType || '').trim().toUpperCase();
  if (!t) return 'JE';
  if (t === 'JE') return 'JE';
  if (t.startsWith('A/R INVOICE')) return 'AR';
  if (t.startsWith('A/R CREDIT MEMO')) return 'ARCM';
  if (t.startsWith('A/P INVOICE')) return 'AP';
  if (t.startsWith('A/P CREDIT MEMO')) return 'APCM';
  return t;
};

const makeBucket = ({ periodKey, periodName, year, month }) => ({
  periodKey, periodName, year, month,
  totalAmount: 0, arcmDeduction: 0, entries: [], transactionIds: new Set(),
  sourceBreakdown: { JE: 0, AR: 0, AP: 0, ARCM: 0, APCM: 0 },
});

const fetchSAPJournalEntries = async (customerCode, periodFrom, periodTo, pool) => {
  try {
    console.log(`📊 [SAP][VAN] Fetching OJDT for ${customerCode} ${periodFrom}→${periodTo}`);
    const sapPool = getPool('VAN');
    if (!sapPool) return { success: false, entries: [] };

    const startDate = new Date(periodFrom);
    const programEndDate = new Date(periodTo);
    const today = new Date();
    const endDate = today > programEndDate ? today : programEndDate;

    const ojdtQuery = `
      SELECT
        ISNULL(T0.DocumentType, 'JE') AS DocumentType,
        T0.ShortName AS CardCode, T0.CardName, T0.RefDate AS DocDate,
        T0.TransId AS TransId, T0.BaseRef AS BaseRef,
        T0.Account, T0.AcctName, T0.Debit, T0.Credit, T0.Memo, T0.LineMemo, T0.RefDate
      FROM OJDT T0
      WHERE T0.ShortName = @customerCode
        AND T0.AcctName LIKE '%Rebate%'
        AND T0.RefDate >= @periodFrom
        AND T0.RefDate <= @endDate
      ORDER BY T0.RefDate ASC, T0.TransId ASC
    `;

    const r = await sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('periodFrom', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .query(ojdtQuery);

    console.log(`📊 [SAP][VAN] Raw OJDT rows: ${r.recordset.length}`);

    const entriesByPeriod = {};
    const getOrCreate = (key, meta) => {
      if (!entriesByPeriod[key]) entriesByPeriod[key] = makeBucket(meta);
      return entriesByPeriod[key];
    };

    r.recordset.forEach(row => {
      const docType = normalizeDocType(row.DocumentType);
      const meta = toPeriodMeta(row.DocDate);
      const bucket = getOrCreate(meta.periodKey, meta);
      const debit = parseFloat(row.Debit) || 0;
      const credit = parseFloat(row.Credit) || 0;
      const netAmount = debit - credit;

      bucket.totalAmount += netAmount;
      bucket.sourceBreakdown[docType] = (bucket.sourceBreakdown[docType] || 0) + netAmount;
      if (docType === 'ARCM' || docType === 'APCM') bucket.arcmDeduction += Math.abs(netAmount);

      bucket.entries.push({
        sourceType: docType, docNum: row.TransId, transId: row.TransId,
        baseRef: row.BaseRef ?? null, docDate: row.DocDate,
        account: row.Account, acctName: row.AcctName,
        debit, credit, netAmount,
        memo: row.Memo || row.LineMemo || '',
        cardCode: row.CardCode, cardName: row.CardName,
      });
    });

    const resultArray = Object.values(entriesByPeriod)
      .map(({ transactionIds, ...rest }) => rest)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    return { success: true, entries: resultArray, rawEntries: { ojdt: r.recordset } };
  } catch (error) {
    console.error('❌ [SAP][VAN] fetch:', error);
    return { success: false, entries: [], error: error.message };
  }
};

/* ══════════════════════════════════════════════════════════════════
   STATUS / AMOUNT-RELEASED endpoints
   ══════════════════════════════════════════════════════════════════ */
router.put('/payouts/:payoutId/status', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, status, amountReleased } = req.body;
    if (!payoutId) return res.status(400).json({ success: false, message: 'Payout ID is required' });

    const ownPool = getPool(db || 'VAN');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    const g = await ownPool.request().input('payoutId', sql.NVarChar(150), payoutId)
      .query(`SELECT Id, PayoutId, CardCode, RebateCode, BaseAmount, TotalAmount, AmountReleased, Status, RebateBalance, ReleaseDate, DocumentType FROM PayoutHistory WHERE PayoutId = @payoutId`);
    if (g.recordset.length === 0) return res.status(404).json({ success: false, message: `Payout ${payoutId} not found` });

    const cur = g.recordset[0];
    if (cur.DocumentType) return res.status(400).json({ success: false, message: 'Cannot update status of a redemption row' });

    const totalAmount = parseFloat(cur.TotalAmount) || 0;
    let newAmountReleased = parseFloat(amountReleased) || 0;
    newAmountReleased = Math.min(Math.max(newAmountReleased, 0), totalAmount);
    const newBalance = Math.max(0, totalAmount - newAmountReleased);

    let newStatus = status || cur.Status;
    if (newAmountReleased === 0 && totalAmount > 0) newStatus = 'Pending';
    else if (newAmountReleased >= totalAmount) newStatus = 'Paid';
    else if (newAmountReleased > 0) newStatus = 'Partially Paid';

    let releaseDate = cur.ReleaseDate;
    if (newAmountReleased > 0 && (!releaseDate || releaseDate === null)) releaseDate = new Date();

    const result = await ownPool.request()
      .input('status', sql.NVarChar(50), newStatus)
      .input('amountReleased', sql.Decimal(18, 2), newAmountReleased)
      .input('releaseDate', sql.DateTime, releaseDate)
      .input('balance', sql.Decimal(18, 2), newBalance)
      .input('payoutId', sql.NVarChar(150), payoutId)
      .query(`
        UPDATE PayoutHistory SET Status=@status, AmountReleased=@amountReleased,
          ReleaseDate=@releaseDate, RebateBalance=@balance, UpdatedDate=GETDATE()
        WHERE PayoutId=@payoutId
      `);

    res.json({ success: true, message: 'Payout updated successfully',
      data: { payoutId, baseAmount: cur.BaseAmount, totalAmount, status: newStatus, amountReleased: newAmountReleased, balance: newBalance, releaseDate, rowsAffected: result.rowsAffected[0] } });
  } catch (error) {
    console.error('❌ [VAN] status:', error);
    res.status(500).json({ success: false, message: 'Error updating payout', error: error.message });
  }
});

router.put('/payouts/:payoutId/amount-released', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, amountReleased } = req.body;
    if (!payoutId) return res.status(400).json({ success: false, message: 'Payout ID is required' });

    const ownPool = getPool(db || 'VAN');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    const g = await ownPool.request().input('payoutId', sql.NVarChar(150), payoutId)
      .query(`SELECT Id, TotalAmount, AmountReleased, Status, ReleaseDate, DocumentType FROM PayoutHistory WHERE PayoutId = @payoutId`);
    if (g.recordset.length === 0) return res.status(404).json({ success: false, message: `Payout ${payoutId} not found` });

    const cur = g.recordset[0];
    if (cur.DocumentType) return res.status(400).json({ success: false, message: 'Cannot update amount of a redemption row' });

    const totalAmount = parseFloat(cur.TotalAmount) || 0;
    const newAmountReleased = parseFloat(amountReleased) || 0;
    const validatedAmountReleased = Math.min(Math.max(newAmountReleased, 0), totalAmount);
    const newBalance = Math.max(0, totalAmount - validatedAmountReleased);

    let newStatus = cur.Status;
    if (validatedAmountReleased === 0) newStatus = totalAmount > 0 ? 'Pending' : 'No Payout';
    else if (validatedAmountReleased >= totalAmount) newStatus = 'Paid';
    else if (validatedAmountReleased > 0) newStatus = 'Partially Paid';

    let releaseDate = cur.ReleaseDate;
    if (validatedAmountReleased > 0 && (!releaseDate || releaseDate === null)) releaseDate = new Date();

    const result = await ownPool.request()
      .input('status', sql.NVarChar(50), newStatus)
      .input('amountReleased', sql.Decimal(18, 2), validatedAmountReleased)
      .input('releaseDate', sql.DateTime, releaseDate)
      .input('balance', sql.Decimal(18, 2), newBalance)
      .input('payoutId', sql.NVarChar(150), payoutId)
      .query(`
        UPDATE PayoutHistory SET Status=@status, AmountReleased=@amountReleased,
          ReleaseDate=@releaseDate, RebateBalance=@balance, UpdatedDate=GETDATE()
        WHERE PayoutId=@payoutId
      `);

    res.json({ success: true, message: 'Amount released updated successfully',
      data: { payoutId, status: newStatus, amountReleased: validatedAmountReleased, balance: newBalance, releaseDate, rowsAffected: result.rowsAffected[0] } });
  } catch (error) {
    console.error('❌ [VAN] amount:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payouts/save', async (req, res) => {
  try {
    const { db, payoutData } = req.body;
    if (!payoutData || !payoutData.Id) return res.status(400).json({ success: false, message: 'Payout data is required' });

    const ownPool = getPool(db || 'VAN');
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

    const check = await ownPool.request().input('PayoutId', sql.NVarChar(150), payoutData.Id)
      .query(`SELECT Id FROM PayoutHistory WHERE PayoutId = @PayoutId`);

    let qr;
    if (check.recordset.length > 0) {
      qr = await ownPool.request()
        .input('PayoutId', sql.NVarChar(150), payoutData.Id)
        .input('TotalAmount', sql.Decimal(18, 2), amount)
        .input('Status', sql.NVarChar(50), status)
        .input('AmountReleased', sql.Decimal(18, 2), amountReleased)
        .input('ReleaseDate', sql.DateTime, releaseDate)
        .input('RebateBalance', sql.Decimal(18, 2), balance)
        .input('RebateType', sql.NVarChar(50), payoutData.RebateType || 'Fixed')
        .query(`UPDATE PayoutHistory SET TotalAmount=@TotalAmount, Status=@Status,
          AmountReleased=@AmountReleased, ReleaseDate=@ReleaseDate,
          RebateBalance=@RebateBalance, RebateType=@RebateType, UpdatedDate=GETDATE()
          WHERE PayoutId=@PayoutId`);
    } else {
      qr = await ownPool.request()
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
        .query(`INSERT INTO PayoutHistory (PayoutId, CardCode, RebateCode, PayoutDate, Period,
          TotalAmount, Status, AmountReleased, ReleaseDate, RebateBalance, RebateType)
          VALUES (@PayoutId, @CardCode, @RebateCode, @PayoutDate, @Period,
          @TotalAmount, @Status, @AmountReleased, @ReleaseDate, @RebateBalance, @RebateType)`);
    }
    res.json({ success: true, message: 'Payout data saved successfully',
      data: { payoutId: payoutData.Id, status, amountReleased, balance, rowsAffected: qr.rowsAffected[0] } });
  } catch (error) {
    console.error('❌ [VAN] save:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   Single-month calc + debug endpoints (kept for compatibility)
   ══════════════════════════════════════════════════════════════════ */
router.get('/payouts/calculate/:customerCode/:rebateCode/:monthKey', async (req, res) => {
  try {
    const { customerCode, rebateCode, monthKey } = req.params;
    const { db } = req.query;
    const ownPool = getPool(db || 'VAN');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    const [year, month] = monthKey.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const rt = await ownPool.request().input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(`SELECT RebateType FROM RebateProgram WHERE RebateCode = @rebateCode`);
    if (rt.recordset.length === 0) return res.status(404).json({ success: false, message: `Rebate ${rebateCode} not found` });
    const rebateType = rt.recordset[0].RebateType;

    let transactions = [];
    try {
      const u = `http://localhost:3009/api/van/dashboard/customer/${customerCode}/transactions?db=${db || 'VAN'}&rebateCode=${rebateCode}&rebateType=${rebateType}&periodFrom=${startDate}&periodTo=${endDate}`;
      const tr = await fetch(u);
      if (tr.ok) { const j = await tr.json(); if (j.success && j.data.transactions) transactions = j.data.transactions; }
    } catch (e) { console.error('❌ tx:', e.message); }

    const calculation = await calculatePayoutDetails(transactions, rebateType, customerCode, rebateCode, ownPool, monthKey);
    res.json({ success: true, data: { customerCode, rebateCode, rebateType, monthKey, calculation,
      transactionCount: transactions.length, totalQtyForReb: transactions.reduce((s, t) => s + (parseFloat(t.QtyForReb) || 0), 0) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

const calculatePayoutDetails = async (transactions, rebateType, customerCode, rebateCode, pool, monthKey) => {
  // lightweight single-month breakdown (kept for debugging)
  const result = { totalQtyForReb: 0, totalAdjustedQtyForReb: 0, eligible: false, amount: 0, calculationSteps: [], itemBreakdown: [] };
  transactions.forEach(t => {
    const qty = parseFloat(t.QtyForReb) || 0;
    result.totalQtyForReb += qty;
    result.totalAdjustedQtyForReb += qty;
  });
  result.calculationSteps.push(`Total QtyForReb: ${result.totalQtyForReb}`);
  result.calculationSteps.push(`Adjusted QtyForReb: ${result.totalAdjustedQtyForReb}`);
  return result;
};

router.get('/debug/payout-table-structure', async (req, res) => {
  try {
    const ownPool = getPool(req.query.db || 'VAN');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });
    const r = await ownPool.request().query(`SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='PayoutHistory' ORDER BY ORDINAL_POSITION`);
    res.json({ success: true, data: { columns: r.recordset, tableExists: r.recordset.length > 0 } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

/* ══════════════════════════════════════════════════════════════════
   Resolver helpers (kept for other modules)
   ══════════════════════════════════════════════════════════════════ */
export const getAllRebateProgramsForCustomer = async (customerCode, currentRebateCode, pool) => {
  try {
    const meta = await pool.request().input('rc', sql.NVarChar(50), currentRebateCode)
      .query(`SELECT RebateCode, RebateType, Frequency, DateFrom, DateTo, IsActive FROM RebateProgram WHERE RebateCode = @rc`);
    if (meta.recordset.length === 0) return [];
    const sib = await pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .query(`
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.IsActive, rp.RebateType, rp.Frequency
        FROM RebateProgram rp
        WHERE EXISTS (SELECT 1 FROM PayoutHistory ph WHERE ph.CardCode=@customerCode AND ph.RebateCode=rp.RebateCode)
        ORDER BY rp.DateFrom ASC
      `);
    return sib.recordset;
  } catch (err) { console.error('❌ getAllRebatePrograms:', err.message); return []; }
};

export const resolveDocDateToRebateProgram = (docDate, programs) => {
  if (!programs || programs.length === 0) return null;
  const date = new Date(docDate); date.setHours(12, 0, 0, 0);
  const sorted = [...programs].sort((a, b) => new Date(a.DateFrom) - new Date(b.DateFrom));
  for (const p of sorted) {
    const from = new Date(p.DateFrom); from.setHours(0, 0, 0, 0);
    const to = new Date(p.DateTo); to.setHours(23, 59, 59, 999);
    if (date >= from && date <= to) return { ...p, matchType: 'exact' };
  }
  const ff = new Date(sorted[0].DateFrom); ff.setHours(0, 0, 0, 0);
  if (date < ff) return { ...sorted[0], matchType: 'before_first' };
  const lt = new Date(sorted[sorted.length - 1].DateTo); lt.setHours(23, 59, 59, 999);
  if (date > lt) return { ...sorted[sorted.length - 1], matchType: 'after_last' };
  return { ...sorted[sorted.length - 1], matchType: 'fallback' };
};

/* ══════════════════════════════════════════════════════════════════
   PAYOUT SUMMARY
   ══════════════════════════════════════════════════════════════════ */
const getCustomerRebatePrograms = async (customerCode, pool) => {
  const r = await pool.request().input('cc', sql.NVarChar(50), customerCode)
    .query(`
      SELECT DISTINCT rp.RebateCode, rp.RebateType, rp.DateFrom, rp.DateTo, rp.IsActive
      FROM RebateProgram rp
      WHERE EXISTS (SELECT 1 FROM FixCustRebate x WHERE x.CardCode=@cc AND x.RebateCode=rp.RebateCode)
         OR EXISTS (SELECT 1 FROM IncCustRebate x WHERE x.CardCode=@cc AND x.RebateCode=rp.RebateCode)
         OR EXISTS (SELECT 1 FROM PerCustRebate x WHERE x.CardCode=@cc AND x.RebateCode=rp.RebateCode)
      ORDER BY rp.DateFrom ASC
    `);
  return r.recordset;
};

router.get('/customer/:customerCode/payout-summary', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const ownPool = getPool(req.query.db || 'VAN');
    if (!ownPool) return res.status(500).json({ success: false, message: 'Database pool not available' });

    await createPayoutHistoryTable(ownPool);
    const programs = await getCustomerRebatePrograms(customerCode, ownPool);

    for (const program of programs) {
      try {
        await fetch(`http://localhost:3009/api/van/payouts/customer/${customerCode}/payouts?db=${req.query.db || 'VAN'}&rebateCode=${program.RebateCode}&rebateType=${program.RebateType}&useRebatePeriod=true`);
      } catch (e) { console.log('⚠️ calc:', e.message); }
    }

    const rows = await ownPool.request().input('cc', sql.NVarChar(50), customerCode)
      .query(`
        SELECT RebateCode, RebateType, BaseAmount, AmountReleased, DocumentType
        FROM PayoutHistory
        WHERE CardCode = @cc
          AND PayoutId NOT LIKE 'SAP-%'
          AND PayoutId NOT LIKE 'SAPDOC-%'
          AND PayoutId NOT LIKE 'BAL-%'
          AND PayoutId NOT LIKE 'BEGBAL-%'
          AND PayoutId NOT LIKE 'CF-%'
          AND PayoutId NOT LIKE 'BeginningBalance-%'
          AND Period NOT LIKE 'Balance of %'
          AND Period NOT LIKE 'Beginning Balance%'
      `);

    const programByCode = {}; programs.forEach(p => { programByCode[p.RebateCode] = p; });
    const codeNum = c => { const m = String(c).match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
    const getQ = df => { if (!df) return { quarter: 0, year: 0 }; const d = new Date(df); return { quarter: Math.ceil((d.getMonth()+1)/3), year: d.getFullYear() }; };

    const byCode = {};
    rows.recordset.forEach(r => {
      const code = r.RebateCode;
      if (!byCode[code]) byCode[code] = { rebateCode: code, rebateTypes: new Set(), baseAmount: 0, amountReleased: 0 };
      byCode[code].rebateTypes.add(r.RebateType);
      if (r.DocumentType) byCode[code].amountReleased += parseFloat(r.AmountReleased) || 0;
      else byCode[code].baseAmount += parseFloat(r.BaseAmount) || 0;
    });

    const sorted = Object.values(byCode).sort((a, b) => codeNum(a.rebateCode) - codeNum(b.rebateCode));

    let runBal = 0;
    const summary = sorted.map(g => {
      const p = programByCode[g.rebateCode] || {};
      const { quarter, year } = getQ(p.DateFrom);
      const earned = g.baseAmount;
      const totalAmount = runBal + earned;
      const raw = totalAmount - g.amountReleased;
      const isOver = raw < -0.01;
      const balance = isOver ? 0 : Math.max(0, raw);
      const overBy = isOver ? Math.abs(raw) : 0;
      let status = 'No Payout';
      if (isOver) status = 'Over-Released';
      else if (totalAmount > 0) {
        if (balance <= 0.01) status = 'Paid';
        else if (g.amountReleased > 0) status = 'Partially Paid';
        else status = 'Pending';
      }
      runBal = balance;
      return { rebateCode: g.rebateCode, rebateTypes: Array.from(g.rebateTypes), quarter, year,
        quarterLabel: quarter ? `Q${quarter} ${year}` : 'Unknown',
        dateFrom: p.DateFrom || null, dateTo: p.DateTo || null, isActive: p.IsActive === 1,
        baseAmount: earned, totalAmount, amountReleased: g.amountReleased, balance,
        isOverReleased: isOver, overReleasedBy: overBy, status };
    });

    const byQ = {};
    summary.forEach(item => {
      const k = `${item.year}-Q${item.quarter}`;
      if (!byQ[k]) byQ[k] = { quarterLabel: item.quarterLabel, quarter: item.quarter, year: item.year, rebateCodes: [], rebateTypes: new Set(), baseAmount: 0, totalAmount: 0, amountReleased: 0 };
      const q = byQ[k];
      q.rebateCodes.push(item.rebateCode);
      item.rebateTypes.forEach(t => q.rebateTypes.add(t));
      q.baseAmount += item.baseAmount;
      q.totalAmount += item.totalAmount;
      q.amountReleased += item.amountReleased;
    });

    const qKeys = Object.keys(byQ).sort((a, b) => {
      const [yA, qA] = a.split('-Q'); const [yB, qB] = b.split('-Q');
      return (parseInt(yA) - parseInt(yB)) || (parseInt(qA) - parseInt(qB));
    });

    let prev = 0;
    const quarterSummary = qKeys.map(k => {
      const q = byQ[k];
      const cum = prev + q.baseAmount;
      const bal = cum - q.amountReleased;
      const isOver = bal < -0.01;
      const overBy = isOver ? Math.abs(bal) : 0;
      let status;
      if (isOver) status = 'Over-Released';
      else if (cum === 0) status = 'No Payout';
      else if (bal <= 0.01) status = 'Paid';
      else if (q.amountReleased > 0) status = 'Partially Paid';
      else status = 'Pending';
      prev = bal;
      return { ...q, baseAmount: q.baseAmount, totalAmount: cum, amountReleased: q.amountReleased, balance: bal, isOverReleased: isOver, overReleasedBy: overBy, status, rebateTypes: Array.from(q.rebateTypes) };
    });

    res.json({ success: true, data: { byRebateCode: summary, byQuarter: quarterSummary, customerCode } });
  } catch (error) {
    console.error('❌ [VAN] payout-summary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;