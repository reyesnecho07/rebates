import express from 'express';
import sql from 'mssql';
import { getPool } from '../services/databaseService.js';
const router = express.Router();
router.get('/customer/:customerCode/payouts', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode, rebateType, periodFrom, periodTo, useRebatePeriod } = req.query;
    
    console.log('💰 [VCP] Fetching payouts for customer:', {
      customerCode,
      rebateCode,
      rebateType,
      periodFrom,
      periodTo,
      useRebatePeriod
    });
    if (!customerCode || !rebateCode || !rebateType) {
      return res.status(400).json({
        success: false,
        message: 'Customer code, rebate code, and rebate type are required'
      });
    }
    const databaseToUse = db || 'VCP_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }
    // FIRST: Get rebate program details including FREQUENCY
    const rebateProgramQuery = `
      SELECT DateFrom, DateTo, IsActive, Frequency
      FROM RebateProgram
      WHERE RebateCode = @rebateCode
    `;
    const rebateProgramResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(rebateProgramQuery);
    let rebateDateFrom = '';
    let rebateDateTo = '';
    let isActive = false;
    let frequency = 'Quarterly'; // Default to Quarterly
    
    if (rebateProgramResult.recordset.length > 0) {
      rebateDateFrom = rebateProgramResult.recordset[0].DateFrom ? 
        new Date(rebateProgramResult.recordset[0].DateFrom).toISOString().split('T')[0] : '';
      rebateDateTo = rebateProgramResult.recordset[0].DateTo ? 
        new Date(rebateProgramResult.recordset[0].DateTo).toISOString().split('T')[0] : '';
      isActive = rebateProgramResult.recordset[0].IsActive === 1;
      frequency = rebateProgramResult.recordset[0].Frequency || 'Quarterly';
    }
    console.log('📊 Rebate Program Details:', {
      frequency,
      dateFrom: rebateDateFrom,
      dateTo: rebateDateTo,
      isActive
    });
    // Determine date range
    let startDate, endDate;
    let dateSource = 'manual';
    
    if (periodFrom && periodTo) {
      startDate = periodFrom;
      endDate = periodTo;
      dateSource = 'manual';
    } else if (useRebatePeriod === 'true' && rebateDateFrom && rebateDateTo && isActive) {
      startDate = rebateDateFrom;
      endDate = rebateDateTo;
      dateSource = 'rebate_period';
    } else if (rebateDateFrom && rebateDateTo) {
      startDate = rebateDateFrom;
      endDate = rebateDateTo;
      dateSource = 'rebate_period_fallback';
    } else {
      const currentYear = new Date().getFullYear();
      startDate = `${currentYear}-01-01`;
      endDate = new Date().toISOString().split('T')[0];
      dateSource = 'current_year';
    }
    console.log('📅 [VCP] Payout date range:', { 
      startDate, 
      endDate, 
      dateSource,
      frequency 
    });
    // Fetch SAP Journal Entry data for this customer
    console.log(`📊 [SAP] Fetching journal entries for customer ${customerCode} from ${startDate} to ${endDate}`);
    const sapData = await fetchSAPJournalEntries(customerCode, startDate, endDate, ownPool);
    
    if (sapData.success) {
      console.log(`✅ [SAP] Found ${sapData.entries.length} periods with journal entries`);
      if (sapData.entries.length > 0) {
        console.log('📊 [SAP] Periods with net amounts:', sapData.entries.map(e => 
          `${e.periodName}: ₱${e.totalAmount.toFixed(2)}`
        ));
      }
    } else {
      console.log('⚠️ [SAP] Could not fetch SAP journal entries');
    }
    // First, get transaction data to calculate amounts
    let monthlyData = [];
    try {
      // Use internal dashboard endpoint for transactions
      const transactionsResponse = await fetch(
        `http://localhost:3009/api/vcp/dashboard/customer/${customerCode}/transactions?` +
        `db=${databaseToUse}&rebateCode=${rebateCode}&rebateType=${rebateType}&` +
        `periodFrom=${startDate}&periodTo=${endDate}&useRebatePeriod=${useRebatePeriod}`
      );
      
      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        
        if (transactionsData.success && transactionsData.data.transactions) {
          console.log(`📊 [VCP] Found ${transactionsData.data.transactions.length} transactions for payout calculation`);
          
          // Calculate monthly payout data WITH FREQUENCY and PASS SAP DATA
          monthlyData = await calculateMonthlyPayoutData(
            transactionsData.data.transactions,
            rebateType,
            customerCode,
            rebateCode,
            ownPool,
            frequency, // Pass frequency to calculation
            sapData.entries // Pass SAP data to calculation
          );
          
          console.log(`📈 [VCP] Calculated ${monthlyData.length} monthly payout records (Frequency: ${frequency})`);
        } else {
          console.log('⚠️ [VCP] No transaction data found for payout calculation');
        }
      } else {
        console.log('⚠️ [VCP] Could not fetch transaction data for payouts');
      }
    } catch (transError) {
      console.error('❌ [VCP] Error fetching transactions for payouts:', transError.message);
    }
    // Ensure PayoutHistory table exists
    await createPayoutHistoryTable(ownPool);
    // SYNC: Auto-update database with SAP data before merging
    if (sapData.success && sapData.entries.length > 0) {
      console.log('🔄 [SYNC] Auto-syncing SAP data to database...');
      await syncSAPDataToPayouts(customerCode, rebateCode, sapData.entries, ownPool);
    }
    // Get existing payout records from PayoutHistory table
    let existingPayouts = [];
    try {
      const existingPayoutsQuery = `
        SELECT 
          Id,
          PayoutId,
          CardCode,
          RebateCode,
          RebateType,
          PayoutDate as Date,
          Period,
          BaseAmount,
          TotalAmount as Amount,
          Status,
          AmountReleased,
          ReleaseDate,
          RebateBalance as Balance,
          SapReleasedAmount,
          SapLastSync,
          CreatedDate,
          UpdatedDate
        FROM PayoutHistory
        WHERE CardCode = @customerCode 
          AND RebateCode = @rebateCode
        ORDER BY PayoutDate ASC, CreatedDate ASC
      `;
      const existingPayoutsResult = await ownPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(existingPayoutsQuery);
      existingPayouts = existingPayoutsResult.recordset;
      
      console.log(`📊 [VCP] Found ${existingPayouts.length} existing payout records`);
      
    } catch (tableError) {
      console.error('❌ [VCP] Error fetching existing payouts:', tableError.message);
    }
    // Merge calculated data with existing records and SAP data
    const mergedPayouts = mergePayoutData(monthlyData, existingPayouts, rebateType, frequency, sapData.entries);
    // Get previous balance from ANY rebate program for this customer and rebate type
    const previousBalance = await getPreviousBalanceFromAnyRebateProgram(
      customerCode,
      rebateType,
      startDate,
      ownPool,
      rebateCode
    );
    console.log(`💰 Previous balance found for ${customerCode} (${rebateType}): ₱${previousBalance.toFixed(2)}`);
    // Create beginning balance record if needed
    let beginningBalanceRecord = null;
    if (previousBalance > 0) {
      beginningBalanceRecord = createBeginningBalanceRecord(
        customerCode,
        rebateCode,
        rebateType,
        previousBalance
      );
    }
    // Add beginning balance to the first month if there's a previous balance
    const payoutsWithBeginningBalance = addBeginningBalanceToPayouts(
      mergedPayouts,
      previousBalance,
      customerCode,
      rebateType
    );
    // Apply balance carry-over (with starting balance from previous rebate program)
    const payoutsWithCarryOver = applyBalanceCarryOver(
      payoutsWithBeginningBalance,
      frequency,
      previousBalance
    );
    // Save/update payout records in database
    try {
      await savePayoutsToDatabase(payoutsWithCarryOver, ownPool, frequency);
    } catch (saveError) {
      console.error('❌ [VCP] Error saving payouts to database:', saveError.message);
    }
    // Get the final payouts from database after saving
    let finalPayouts = [];
    try {
    const finalPayoutsQuery = `
          SELECT
            Id,
            PayoutId,
            CardCode,
            RebateCode,
            RebateType,
            PayoutDate           AS Date,
            Period,
            BaseAmount,
            TotalAmount          AS Amount,
            TotalAmount,
            Status,
            AmountReleased,
            SapReleasedAmount,
            SapLastSync,
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
            AND Period NOT LIKE 'Balance of %'
            AND PayoutId   NOT LIKE 'SAP-%'
          ORDER BY Id ASC
        `;
      const finalPayoutsResult = await ownPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(finalPayoutsQuery);
      finalPayouts = finalPayoutsResult.recordset;
      
      console.log(`📊 [VCP] Final payouts after save: ${finalPayouts.length} records`);
      
      // Log sample of final amounts
      finalPayouts.slice(0, 3).forEach(p => {
        console.log(`  ${p.Period}: AmountReleased=₱${p.AmountReleased}, SapReleased=₱${p.SapReleasedAmount}`);
      });
      
    } catch (error) {
      console.error('❌ [VCP] Error fetching final payouts:', error.message);
      finalPayouts = payoutsWithCarryOver;
    }
    res.json({
      success: true,
      data: {
        payouts: finalPayouts,
        beginningBalances: [],
        regularPayouts: finalPayouts,
        previousBalance: previousBalance,
        beginningBalanceRecord: beginningBalanceRecord,
        customerCode: customerCode,
        rebateCode: rebateCode,
        rebateType: rebateType,
        frequency: frequency,
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
          dateSource: dateSource,
          rebatePeriodAvailable: !!(rebateDateFrom && rebateDateTo),
          rebatePeriod: {
            from: rebateDateFrom,
            to: rebateDateTo
          }
        },
        autoSynced: sapData.success && sapData.entries.length > 0
      }
    });
  } catch (error) {
    console.error('❌ [VCP] Error fetching payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payout data',
      error: error.message,
      stack: error.stack
    });
  }
});
const createBeginningBalanceRecord = (customerCode, rebateCode, rebateType, previousBalance) => {
  try {
    console.log(`📝 Creating beginning balance record for ${customerCode}: ₱${previousBalance.toFixed(2)}`);
    
    const currentDate = new Date();
    const formattedDate = `${currentDate.getMonth() + 1}.${currentDate.getDate()}.${currentDate.getFullYear().toString().slice(-2)}`;
    
    return {
      Id: `BeginningBalance-${customerCode}-${rebateCode}-${Date.now()}`,
      PayoutId: `BeginningBalance-${customerCode}-${rebateCode}`,
      CardCode: customerCode,
      RebateCode: rebateCode,
      RebateType: rebateType,
      Date: formattedDate,
      Period: "Beginning Balance",
      BaseAmount: 0,
      TotalAmount: 0,
      Amount: 0,
      Status: "Beginning Balance",
      AmountReleased: 0,
      SapReleasedAmount: 0,
      Balance: previousBalance,
      ReleaseDate: null,
      CreatedDate: new Date().toISOString().split('T')[0],
      UpdatedDate: new Date().toISOString().split('T')[0],
      PreviousBalance: previousBalance,
      isBeginningBalance: true,
      CalculationNote: `Previous balance carried over: ₱${previousBalance.toFixed(2)}`,
      displayType: 'beginning_balance'
    };
    
  } catch (error) {
    console.error('❌ Error creating beginning balance record:', error.message);
    return null;
  }
};
const getPreviousBalanceFromAnyRebateProgram = async (customerCode, rebateType, currentStartDate, pool, currentRebateCode) => {
  try {
    console.log(`🔍 Getting previous balance for ${customerCode} - ${rebateType}`);
    // Get frequency of current rebate
    const freqResult = await pool.request()
      .input('rebateCode', sql.NVarChar(50), currentRebateCode)
      .query(`SELECT Frequency FROM RebateProgram WHERE RebateCode = @rebateCode`);
    const currentFrequency = freqResult.recordset[0]?.Frequency || '';
    // Find other rebate codes for same CardCode + RebateType + Frequency
    const otherRebatesResult = await pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('rebateType', sql.NVarChar(50), rebateType)
      .input('rebateCode', sql.NVarChar(50), currentRebateCode)
      .input('frequency', sql.NVarChar(50), currentFrequency)
      .query(`
        SELECT DISTINCT ph.RebateCode
        FROM PayoutHistory ph
        LEFT JOIN RebateProgram rp ON ph.RebateCode = rp.RebateCode
        WHERE ph.CardCode = @customerCode
          AND ph.RebateType = @rebateType
          AND ph.RebateCode != @rebateCode
          AND rp.Frequency = @frequency
      `);
    if (otherRebatesResult.recordset.length === 0) {
      console.log(`📭 No other rebate codes found for ${customerCode} - ${rebateType}`);
      return 0;
    }
    // Get the FIRST period of the CURRENT rebate to use as the cutoff
    const currentFirstPeriodResult = await pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('currentRebateCode', sql.NVarChar(50), currentRebateCode)
      .query(`
        SELECT TOP 1 Period
        FROM PayoutHistory
        WHERE CardCode = @customerCode
          AND RebateCode = @currentRebateCode
          AND Period NOT LIKE 'Balance of %'
          AND Period IS NOT NULL
          AND Period != ''
        ORDER BY Id ASC
      `);
    const currentFirstPeriod = currentFirstPeriodResult.recordset[0]?.Period || null;
    // Parse period string like "January 2026" → numeric 202601 for comparison
    const monthNames2 = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];
    const parsePeriodNum = (str) => {
      if (!str) return 0;
      for (let i = 0; i < monthNames2.length; i++) {
        if (str.includes(monthNames2[i])) {
          const y = str.match(/\b(20\d{2})\b/);
          return (y ? parseInt(y[1]) : 0) * 100 + (i + 1);
        }
      }
      return 0;
    };
    const currentFirstNum = parsePeriodNum(currentFirstPeriod);
    console.log(`📅 Current rebate first period: ${currentFirstPeriod} (${currentFirstNum})`);
    for (const row of otherRebatesResult.recordset) {
      const otherCode = row.RebateCode;
      // Get the LAST period of the other rebate — it must be BEFORE current rebate's first period
      const otherLastPeriodResult = await pool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('otherCode', sql.NVarChar(50), otherCode)
        .query(`
          SELECT TOP 1 Period
          FROM PayoutHistory
          WHERE CardCode = @customerCode
            AND RebateCode = @otherCode
            AND Period NOT LIKE 'Balance of %'
            AND Period IS NOT NULL
            AND Period != ''
          ORDER BY Id DESC
        `);
      const otherLastPeriod = otherLastPeriodResult.recordset[0]?.Period || null;
      const otherLastNum = parsePeriodNum(otherLastPeriod);
      console.log(`📅 Other rebate ${otherCode} last period: ${otherLastPeriod} (${otherLastNum})`);
      // CONDITION: other rebate's last transaction must be BEFORE current rebate's first transaction
      if (currentFirstNum > 0 && otherLastNum >= currentFirstNum) {
        console.log(`🚫 Skipping ${otherCode} — its last period (${otherLastPeriod}) overlaps with current (${currentFirstPeriod})`);
        continue;
      }
      const balResult = await pool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('otherCode', sql.NVarChar(50), otherCode)
        .query(`
          SELECT
            SUM(BaseAmount - AmountReleased) AS TotalRemaining
          FROM PayoutHistory
          WHERE CardCode = @customerCode
            AND RebateCode = @otherCode
            AND Period NOT LIKE 'Balance of %'
            AND BaseAmount > 0
        `);
      const remaining = parseFloat(balResult.recordset[0]?.TotalRemaining) || 0;
      if (remaining > 0) {
        console.log(`💰 Found valid previous balance: ₱${remaining.toFixed(2)} from ${otherCode} (last period: ${otherLastPeriod})`);
        return remaining;
      }
      console.log(`📭 ${otherCode} has no remaining balance`);
    }
    console.log(`📭 No previous balance found for ${customerCode} - ${rebateType}`);
    return 0;
  } catch (error) {
    console.error('❌ Error getting previous balance:', error.message);
    return 0;
  }
};
// Add beginning balance to payouts
const addBeginningBalanceToPayouts = (payouts, previousBalance, customerCode, rebateType) => {
  try {
    console.log(`🔄 Adding beginning balance (₱${previousBalance.toFixed(2)}) to payouts for ${customerCode} - ${rebateType}`);
    
    if (!Array.isArray(payouts) || payouts.length === 0 || previousBalance <= 0) {
      return payouts;
    }
    
    const sortedPayouts = [...payouts].sort((a, b) => {
      const dateA = new Date(a.Date || a.date || '');
      const dateB = new Date(b.Date || b.date || '');
      return dateA - dateB;
    });
    
    const firstPayoutIndex = sortedPayouts.findIndex(p => 
      !p.isQtrRebate && !p.isBeginningBalance && !p.displayType === 'beginning_balance'
    );
    
    if (firstPayoutIndex === -1) {
      return payouts;
    }
    
    sortedPayouts[firstPayoutIndex].PreviousBalance = previousBalance;
    sortedPayouts[firstPayoutIndex].CalculationNote = `Base: ₱${(sortedPayouts[firstPayoutIndex].BaseAmount || 0).toFixed(2)} + Prev Balance: ₱${previousBalance.toFixed(2)}`;
    
    console.log(`✅ Added beginning balance to first payout: ${sortedPayouts[firstPayoutIndex].Period}`);
    
    return sortedPayouts;
    
  } catch (error) {
    console.error('❌ Error adding beginning balance to payouts:', error.message);
    return payouts;
  }
};
const applyBalanceCarryOver = (payouts, frequency = 'Quarterly', startingBalance = 0) => {
  console.log('🔄 Applying balance carry-over:', {
    frequency,
    totalPayouts: payouts.length,
    startingBalance
  });
  
  if (!Array.isArray(payouts) || payouts.length === 0) {
    return [];
  }
  
  const sortedPayouts = [...payouts].sort((a, b) => {
    if (a.isBeginningBalance || a.displayType === 'beginning_balance') return -1;
    if (b.isBeginningBalance || b.displayType === 'beginning_balance') return 1;
    
    const dateA = new Date(a.Date || a.date || '');
    const dateB = new Date(b.Date || b.date || '');
    
    if (dateA.getTime() === dateB.getTime()) {
      return (a.isQtrRebate ? 1 : 0) - (b.isQtrRebate ? 1 : 0);
    }
    
    return dateA - dateB;
  });
  
  // Start with the cross-rebate previous balance so it carries into the first month
  let previousBalance = parseFloat(startingBalance) || 0;
  const payoutsWithCarryOver = [];
  
  sortedPayouts.forEach((payout) => {
    const baseAmount = parseFloat(payout.BaseAmount || payout.baseAmount || 0);
    const amountReleased = parseFloat(payout.AmountReleased || payout.amountReleased || 0);
    const sapReleasedAmount = parseFloat(payout.SapReleasedAmount || payout.sapReleasedAmount || 0);
    const isQtrRebate = payout.isQtrRebate || payout.type === 'quarterly';
    const isBeginningBalanceRow = payout.isBeginningBalance || payout.displayType === 'beginning_balance';
    
    if (isBeginningBalanceRow) {
      payoutsWithCarryOver.push(payout);
      previousBalance = parseFloat(payout.Balance) || parseFloat(payout.PreviousBalance) || 0;
      return;
    }
    
    const isNonEligibleMonth = (frequency === 'Quarterly') ? 
      (payout.isNonEligibleMonth || 
       (!payout.eligible && !payout.quotaMet) ||
       (!payout.hasTransactions && baseAmount === 0)) : false;
    
    if (isQtrRebate) {
      const totalAmount = baseAmount;
      const balance = Math.max(0, totalAmount - amountReleased);
      
      let status = payout.Status || 'Pending';
      if (amountReleased === 0) {
        status = 'Pending';
      } else if (amountReleased >= totalAmount) {
        status = 'Paid';
      } else if (amountReleased > 0) {
        status = 'Partially Paid';
      }
      
      const qtrPayout = {
        ...payout,
        Id: payout.Id || payout.PayoutId,
        PayoutId: payout.PayoutId || payout.Id,
        CardCode: payout.CardCode || payout.cardCode,
        RebateCode: payout.RebateCode || payout.rebateCode,
        RebateType: payout.RebateType || payout.rebateType,
        Date: payout.Date || payout.date,
        Period: payout.Period || payout.period,
        BaseAmount: baseAmount,
        TotalAmount: totalAmount,
        Amount: totalAmount,
        AmountReleased: amountReleased,
        SapReleasedAmount: sapReleasedAmount,
        Balance: balance,
        Status: status,
        ReleaseDate: payout.ReleaseDate || payout.releaseDate,
        PreviousBalance: 0,
        isQtrRebate: true,
        CalculationNote: payout.calculationNote || `Quarter Rebate: ₱${baseAmount.toFixed(2)}\nSAP Released: ₱${sapReleasedAmount.toFixed(2)}`
      };
      
      payoutsWithCarryOver.push(qtrPayout);
      
    } else if (isNonEligibleMonth) {
      const totalAmount = 0;
      const balance = 0;
      const status = 'No Payout';
      
      const payoutWithNoCarryOver = {
        ...payout,
        Id: payout.Id || payout.PayoutId,
        PayoutId: payout.PayoutId || payout.Id,
        CardCode: payout.CardCode || payout.cardCode,
        RebateCode: payout.RebateCode || payout.rebateCode,
        RebateType: payout.RebateType || payout.rebateType,
        Date: payout.Date || payout.date,
        Period: payout.Period || payout.period,
        BaseAmount: baseAmount,
        TotalAmount: totalAmount,
        Amount: totalAmount,
        AmountReleased: 0,
        SapReleasedAmount: sapReleasedAmount,
        Balance: balance,
        Status: status,
        ReleaseDate: payout.ReleaseDate || payout.releaseDate,
        PreviousBalance: 0,
        CalculationNote: baseAmount > 0 ? 
          `Base: ₱${baseAmount.toFixed(2)} → 0 (Quota not met)` :
          `Base: 0 → 0 (No transactions)`
      };
      
      payoutsWithCarryOver.push(payoutWithNoCarryOver);
      
    } else {
      const previousBalanceForThisMonth = parseFloat(payout.PreviousBalance) || previousBalance;
      const totalAmount = baseAmount + previousBalanceForThisMonth;
      const balance = Math.max(0, totalAmount - amountReleased);
      
      let status = payout.Status || 'Pending';
      if (baseAmount === 0 && previousBalanceForThisMonth === 0) {
        status = 'No Payout';
      } else if (amountReleased === 0 && totalAmount > 0) {
        status = 'Pending';
      } else if (amountReleased >= totalAmount) {
        status = 'Paid';
      } else if (amountReleased > 0) {
        status = 'Partially Paid';
      }
      
      const payoutWithCarryOver = {
        ...payout,
        Id: payout.Id || payout.PayoutId,
        PayoutId: payout.PayoutId || payout.Id,
        CardCode: payout.CardCode || payout.cardCode,
        RebateCode: payout.RebateCode || payout.rebateCode,
        RebateType: payout.RebateType || payout.rebateType,
        Date: payout.Date || payout.date,
        Period: payout.Period || payout.period,
        BaseAmount: baseAmount,
        TotalAmount: totalAmount,
        Amount: totalAmount,
        AmountReleased: amountReleased,
        SapReleasedAmount: sapReleasedAmount,
        Balance: balance,
        Status: status,
        ReleaseDate: payout.ReleaseDate || payout.releaseDate,
        PreviousBalance: previousBalanceForThisMonth,
        CalculationNote: previousBalanceForThisMonth > 0 
          ? `Base: ₱${baseAmount.toFixed(2)} + Prev: ₱${previousBalanceForThisMonth.toFixed(2)} = ₱${totalAmount.toFixed(2)}\nSAP Released: ₱${sapReleasedAmount.toFixed(2)}`
          : `Base: ₱${baseAmount.toFixed(2)}\nSAP Released: ₱${sapReleasedAmount.toFixed(2)}`
      };
      
      payoutsWithCarryOver.push(payoutWithCarryOver);
      previousBalance = balance;
    }
  });
  
  console.log(`✅ Applied carry-over to ${payoutsWithCarryOver.length} payouts`);
  return payoutsWithCarryOver;
};
// Add update status endpoint
router.put('/payouts/:payoutId/status', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, status, amountReleased } = req.body;
    
    console.log('🔄 [VCP] Updating payout status:', { payoutId, status, amountReleased });
    
    if (!payoutId) {
      return res.status(400).json({
        success: false,
        message: 'Payout ID is required'
      });
    }
    const databaseToUse = db || 'VCP_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }
    // Get current payout record
    const getQuery = `
      SELECT Id, PayoutId, CardCode, RebateCode, BaseAmount, TotalAmount, AmountReleased, Status, RebateBalance
      FROM PayoutHistory
      WHERE PayoutId = @payoutId
    `;
    
    const getResult = await ownPool.request()
      .input('payoutId', sql.NVarChar(100), payoutId)
      .query(getQuery);
    if (getResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Payout with PayoutId ${payoutId} not found.`
      });
    }
    const currentPayout = getResult.recordset[0];
    const totalAmount = parseFloat(currentPayout.TotalAmount) || 0;
    let newAmountReleased = parseFloat(amountReleased) || 0;
    
    // Validate amount
    newAmountReleased = Math.min(Math.max(newAmountReleased, 0), totalAmount);
    
    // Calculate new balance
    const newBalance = Math.max(0, totalAmount - newAmountReleased);
    
    // Determine new status
    let newStatus = status || currentPayout.Status;
    if (newAmountReleased === 0 && totalAmount > 0) {
      newStatus = 'Pending';
    } else if (newAmountReleased >= totalAmount) {
      newStatus = 'Paid';
    } else if (newAmountReleased > 0) {
      newStatus = 'Partially Paid';
    }
    
    // Determine release date
    let releaseDate = currentPayout.ReleaseDate;
    if (newAmountReleased > 0 && (!releaseDate || releaseDate === null)) {
      releaseDate = new Date();
    }
    // Update payout
    const updateQuery = `
      UPDATE PayoutHistory 
      SET 
        Status = @status,
        AmountReleased = @amountReleased,
        ReleaseDate = @releaseDate,
        RebateBalance = @balance,
        UpdatedDate = GETDATE()
      WHERE PayoutId = @payoutId
    `;
    
    const result = await ownPool.request()
      .input('status', sql.NVarChar(50), newStatus)
      .input('amountReleased', sql.Decimal(18, 2), newAmountReleased)
      .input('releaseDate', sql.DateTime, releaseDate)
      .input('balance', sql.Decimal(18, 2), newBalance)
      .input('payoutId', sql.NVarChar(100), payoutId)
      .query(updateQuery);
    console.log(`✅ [VCP] Updated payout ${payoutId}:`, {
      totalAmount: totalAmount,
      amountReleased: newAmountReleased,
      balance: newBalance,
      status: newStatus
    });
    res.json({
      success: true,
      message: `Payout updated successfully`,
      data: {
        payoutId: payoutId,
        baseAmount: currentPayout.BaseAmount,
        totalAmount: totalAmount,
        status: newStatus,
        amountReleased: newAmountReleased,
        balance: newBalance,
        releaseDate: releaseDate,
        rowsAffected: result.rowsAffected[0]
      }
    });
  } catch (error) {
    console.error('❌ [VCP] Error updating payout:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payout',
      error: error.message
    });
  }
});
const createPayoutHistoryTable = async (pool) => {
  try {
    const tableCheckQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PayoutHistory')
      BEGIN
        CREATE TABLE PayoutHistory (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          PayoutId NVARCHAR(100) NOT NULL,
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
      END
    `;
    await pool.request().query(tableCheckQuery);
    console.log('✅ [VCP] PayoutHistory table created/verified');
    
  } catch (error) {
    console.error('❌ [VCP] Error creating/updating PayoutHistory table:', error);
  }
};


/**
 * When a rebate (rebate0002) is fully settled and its TotalAmount included a carry-over
 * balance from a previous rebate (rebate0001), mark rebate0001's outstanding rows as
 * "Settled" so its displayed balance becomes ₱0.
 *
 * Called after every save or status-update that could have caused full settlement.
 */
const reconcileAfterSave = async (customerCode, currentRebateCode, pool) => {
  try {
    console.log(`🔄 [RECONCILE] Checking cross-rebate settlements — ${customerCode} / ${currentRebateCode}`);

    // Ensure migration columns exist (idempotent)
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'CarriedOverTo')
        ALTER TABLE PayoutHistory ADD CarriedOverTo NVARCHAR(50) NULL;

      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'CarryOverNote')
        ALTER TABLE PayoutHistory ADD CarryOverNote NVARCHAR(200) NULL;
    `);

    // Summarise every rebate code for this customer
    const summaryResult = await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .query(`
        SELECT
          RebateCode,
          SUM(ISNULL(BaseAmount,    0)) AS TotalBase,
          SUM(ISNULL(AmountReleased,0)) AS TotalReleased,
          SUM(ISNULL(RebateBalance, 0)) AS TotalBalance
        FROM PayoutHistory
        WHERE CardCode   = @cc
          AND PayoutId   NOT LIKE 'SAP-%'
          AND (Period    NOT LIKE 'Balance of %' OR Period IS NULL)
        GROUP BY RebateCode
      `);

    const current = summaryResult.recordset.find(r => r.RebateCode === currentRebateCode);
    if (!current) return;

    const currentBase     = parseFloat(current.TotalBase)     || 0;
    const currentReleased = parseFloat(current.TotalReleased) || 0;
    const currentBalance  = parseFloat(current.TotalBalance)  || 0;

    // Only proceed if the current rebate is fully settled AND released beyond its own base
    // (the "beyond" portion is what covered carry-over from a previous rebate)
    if (currentBalance > 0.01 || currentReleased <= currentBase + 0.01) {
      console.log(`  ℹ️  [RECONCILE] Current rebate not yet settled or no excess — skipping`);
      return;
    }

    const excessReleased = currentReleased - currentBase;
    console.log(`  ✅ [RECONCILE] Excess released: ₱${excessReleased.toFixed(2)} (covered carry-over)`);

    // Find sibling rebates that still have an outstanding balance
    const prevRebates = summaryResult.recordset.filter(r =>
      r.RebateCode !== currentRebateCode &&
      parseFloat(r.TotalBalance) > 0.01
    );

    if (prevRebates.length === 0) {
      console.log(`  ℹ️  [RECONCILE] No previous rebates with outstanding balance — nothing to settle`);
      return;
    }

    for (const prev of prevRebates) {
      const prevBalance = parseFloat(prev.TotalBalance) || 0;

      // Allow a ₱10 tolerance to handle rounding differences between SAP and OWN DB
      if (prevBalance <= excessReleased + 10.00) {
        await pool.request()
          .input('cc',        sql.NVarChar(50),  customerCode)
          .input('prevRc',    sql.NVarChar(50),  prev.RebateCode)
          .input('currentRc', sql.NVarChar(50),  currentRebateCode)
          .input('note',      sql.NVarChar(200),
            `Balance of ₱${prevBalance.toFixed(2)} carried over to ${currentRebateCode} — fully paid`)
          .query(`
            UPDATE PayoutHistory
            SET
              RebateBalance = 0,
              Status        = CASE
                                WHEN Status IN ('No Payout','Settled') THEN Status
                                ELSE 'Settled'
                              END,
              CarriedOverTo = @currentRc,
              CarryOverNote = @note,
              UpdatedDate   = GETDATE()
            WHERE CardCode   = @cc
              AND RebateCode = @prevRc
              AND RebateBalance > 0.01
              AND PayoutId   NOT LIKE 'SAP-%'
          `);

        console.log(`  ✅ [RECONCILE] ${prev.RebateCode} ₱${prevBalance.toFixed(2)} → Settled via ${currentRebateCode}`);
      }
    }
  } catch (err) {
    // Never let reconciliation break the main flow
    console.error('❌ [RECONCILE] Error in reconcileAfterSave:', err.message);
  }
};

router.get('/debug/payout-table-structure', async (req, res) => {
  try {
    const { db } = req.query;
    const databaseToUse = db || 'VCP_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }
    const columnQuery = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'PayoutHistory'
      ORDER BY ORDINAL_POSITION
    `;
    
    const result = await ownPool.request().query(columnQuery);
    
    res.json({
      success: true,
      data: {
        columns: result.recordset,
        tableExists: result.recordset.length > 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking table structure:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking table structure',
      error: error.message
    });
  }
});
const applyBalanceCarryOverToPayouts = (payouts, frequency = 'Quarterly') => {
  console.log('🔄 Applying balance carry-over to payouts, frequency:', frequency);
  
  if (!Array.isArray(payouts) || payouts.length === 0) {
    return [];
  }
  
  const sortedPayouts = [...payouts].sort((a, b) => {
    const dateA = new Date(a.Date || a.date || '');
    const dateB = new Date(b.Date || b.date || '');
    
    if (dateA.getTime() === dateB.getTime()) {
      return (a.isQtrRebate ? 1 : 0) - (b.isQtrRebate ? 1 : 0);
    }
    
    return dateA - dateB;
  });
  
  let previousBalance = 0;
  const payoutsWithCarryOver = [];
  
  sortedPayouts.forEach((payout, index) => {
    const baseAmount = parseFloat(payout.BaseAmount || payout.baseAmount || 0);
    const manualReleased = parseFloat(payout.AmountReleased || payout.amountReleased || 0);
    const sapReleased = parseFloat(payout.SapReleasedAmount || payout.sapReleasedAmount || 0);
    
    // Priority: Manual amount > SAP amount
    const amountReleased = manualReleased > 0 ? manualReleased : sapReleased;
    
    const isQtrRebate = payout.isQtrRebate || payout.type === 'quarterly';
    
    const isNonEligibleMonth = (frequency === 'Quarterly') ? 
      (payout.isNonEligibleMonth || 
       (!payout.eligible && !payout.quotaMet) ||
       (!payout.hasTransactions && baseAmount === 0)) : false;
    
    if (isQtrRebate) {
      const totalAmount = baseAmount;
      const balance = Math.max(0, totalAmount - amountReleased);
      
      let status = payout.Status || 'Pending';
      if (amountReleased === 0) {
        status = 'Pending';
      } else if (amountReleased >= totalAmount) {
        status = 'Paid';
      } else if (amountReleased > 0) {
        status = 'Partially Paid';
      }
      
      const qtrPayout = {
        ...payout,
        Id: payout.Id || payout.PayoutId,
        PayoutId: payout.PayoutId || payout.Id,
        CardCode: payout.CardCode || payout.cardCode,
        RebateCode: payout.RebateCode || payout.rebateCode,
        RebateType: payout.RebateType || payout.rebateType,
        Date: payout.Date || payout.date,
        Period: payout.Period || payout.period,
        BaseAmount: baseAmount,
        TotalAmount: totalAmount,
        Amount: totalAmount,
        AmountReleased: amountReleased,
        SapReleasedAmount: sapReleased,
        Balance: balance,
        Status: status,
        ReleaseDate: payout.ReleaseDate || payout.releaseDate,
        PreviousBalance: 0,
        isQtrRebate: true,
        CalculationNote: payout.calculationNote || `Quarter Rebate: ₱${baseAmount.toFixed(2)}`
      };
      
      payoutsWithCarryOver.push(qtrPayout);
      
    } else if (isNonEligibleMonth) {
      const totalAmount = 0;
      const balance = 0;
      const status = 'No Payout';
      
      const payoutWithNoCarryOver = {
        ...payout,
        Id: payout.Id || payout.PayoutId,
        PayoutId: payout.PayoutId || payout.Id,
        CardCode: payout.CardCode || payout.cardCode,
        RebateCode: payout.RebateCode || payout.rebateCode,
        RebateType: payout.RebateType || payout.rebateType,
        Date: payout.Date || payout.date,
        Period: payout.Period || payout.period,
        BaseAmount: baseAmount,
        TotalAmount: totalAmount,
        Amount: totalAmount,
        AmountReleased: 0,
        SapReleasedAmount: 0,
        Balance: balance,
        Status: status,
        ReleaseDate: payout.ReleaseDate || payout.releaseDate,
        PreviousBalance: 0,
        CalculationNote: baseAmount > 0 ? 
          `Base: ₱${baseAmount.toFixed(2)} → 0 (Quota not met)` :
          `Base: 0 → 0 (No transactions)`
      };
      
      payoutsWithCarryOver.push(payoutWithNoCarryOver);
      
    } else {
      const totalAmount = baseAmount + previousBalance;
      const balance = Math.max(0, totalAmount - amountReleased);
      
      let status = payout.Status || 'Pending';
      if (baseAmount === 0 && previousBalance === 0) {
        status = 'No Payout';
      } else if (amountReleased === 0 && totalAmount > 0) {
        status = 'Pending';
      } else if (amountReleased >= totalAmount) {
        status = 'Paid';
      } else if (amountReleased > 0) {
        status = 'Partially Paid';
      }
      
      const payoutWithCarryOver = {
        ...payout,
        Id: payout.Id || payout.PayoutId,
        PayoutId: payout.PayoutId || payout.Id,
        CardCode: payout.CardCode || payout.cardCode,
        RebateCode: payout.RebateCode || payout.rebateCode,
        RebateType: payout.RebateType || payout.rebateType,
        Date: payout.Date || payout.date,
        Period: payout.Period || payout.period,
        BaseAmount: baseAmount,
        TotalAmount: totalAmount,
        Amount: totalAmount,
        AmountReleased: amountReleased,
        SapReleasedAmount: sapReleased,
        Balance: balance,
        Status: status,
        ReleaseDate: payout.ReleaseDate || payout.releaseDate,
        PreviousBalance: previousBalance,
        CalculationNote: previousBalance > 0 
          ? `Base: ₱${baseAmount.toFixed(2)} + Previous: ₱${previousBalance.toFixed(2)} = ₱${totalAmount.toFixed(2)}\nSAP Released: ₱${sapReleased.toFixed(2)}`
          : `Base: ₱${baseAmount.toFixed(2)}\nSAP Released: ₱${sapReleased.toFixed(2)}`
      };
      
      payoutsWithCarryOver.push(payoutWithCarryOver);
      
      previousBalance = balance;
    }
  });
  
  console.log(`✅ Applied carry-over to ${payoutsWithCarryOver.length} payouts (Frequency: ${frequency})`);
  return payoutsWithCarryOver;
};
const calculateMonthlyPayoutData = async (transactions, rebateType, customerCode, rebateCode, pool, frequency = 'Quarterly', sapEntries = []) => {
  try {
    console.log(`📊 Starting payout calculation for ${customerCode}, ${rebateCode}, type: ${rebateType}, frequency: ${frequency}`);
    console.log(`📊 [SAP] Received ${sapEntries.length} SAP period entries for integration`);
    
    const sapAmountMap = {};
    sapEntries.forEach(entry => {
      const periodKey = `${entry.year}-${String(entry.month).padStart(2, '0')}`;
      sapAmountMap[periodKey] = {
        amount: entry.totalAmount,
        periodName: entry.periodName,
        entries: entry.entries
      };
      console.log(`📊 [SAP] Mapped ${periodKey}: ₱${entry.totalAmount.toFixed(2)}`);
    });
    
    const rebatePeriodQuery = `
      SELECT DateFrom, DateTo
      FROM RebateProgram
      WHERE RebateCode = @rebateCode
    `;
    
    const rebatePeriodResult = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(rebatePeriodQuery);
    
    let programStartDate = new Date();
    let programEndDate = new Date();
    
    if (rebatePeriodResult.recordset.length > 0) {
      const rebateDateFrom = rebatePeriodResult.recordset[0].DateFrom;
      const rebateDateTo = rebatePeriodResult.recordset[0].DateTo;
      
      if (rebateDateFrom) programStartDate = new Date(rebateDateFrom);
      if (rebateDateTo) programEndDate = new Date(rebateDateTo);
    }
    
    const allMonths = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
    let currentDate = new Date(programStartDate);
    while (currentDate <= programEndDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthName = monthNames[month];
      const lastDay = new Date(year, month + 1, 0);
      const payoutDate = `${lastDay.getMonth() + 1}.${lastDay.getDate()}.${lastDay.getFullYear().toString().slice(-2)}`;
      const quarter = Math.floor(month / 3) + 1;
      
      const sapForThisMonth = sapAmountMap[monthKey] || { amount: 0, entries: [] };
      
      allMonths.push({
        monthKey: monthKey,
        monthName: monthName,
        monthNumber: month + 1,
        year: year,
        quarter: quarter,
        payoutDate: payoutDate,
        period: `${monthName} ${year}`,
        hasTransactions: false,
        sapAmount: sapForThisMonth.amount || 0,
        sapEntries: sapForThisMonth.entries || []
      });
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    console.log(`📅 Generated ${allMonths.length} months from ${programStartDate.toISOString().split('T')[0]} to ${programEndDate.toISOString().split('T')[0]}`);
    
    let baseRebatePerBag = 0;
    let qtrRebate = 0;
    let itemPercentageMap = new Map();
    let customerQuotas = {};
    
    if (rebateType === 'Percentage') {
      try {
        const percentageQuery = `
          SELECT ItemCode, PercentagePerBag
          FROM PerProdRebate
          WHERE RebateCode = @rebateCode
        `;
        
        const percentageResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(percentageQuery);
        percentageResult.recordset.forEach(row => {
          if (row.ItemCode && row.PercentagePerBag) {
            itemPercentageMap.set(row.ItemCode, parseFloat(row.PercentagePerBag) || 0);
            console.log(`📊 Item ${row.ItemCode} has percentage: ${row.PercentagePerBag}%`);
          }
        });
        
        console.log(`📊 Loaded ${itemPercentageMap.size} item-specific percentages for rebate code ${rebateCode}`);
        
        if (frequency === 'Quarterly') {
          const qtrRebateQuery = `
            SELECT QtrRebate 
            FROM PerCustRebate
            WHERE CardCode = @customerCode AND RebateCode = @rebateCode
          `;
          const qtrRebateResult = await pool.request()
            .input('customerCode', sql.NVarChar(50), customerCode)
            .input('rebateCode', sql.NVarChar(50), rebateCode)
            .query(qtrRebateQuery);
          if (qtrRebateResult.recordset.length > 0) {
            qtrRebate = parseFloat(qtrRebateResult.recordset[0].QtrRebate) || 0;
            console.log(`📊 Percentage QTR Rebate: ${qtrRebate}`);
          }
        }
      } catch (error) {
        console.log('⚠️ Could not fetch percentage values:', error.message);
      }
    } else if (rebateType === 'Fixed') {
      try {
        const fixedQuery = `
          SELECT TOP 1 RebatePerBag
          FROM FixProdRebate
          WHERE RebateCode = @rebateCode
        `;
        
        const fixedResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(fixedQuery);
        if (fixedResult.recordset.length > 0) {
          baseRebatePerBag = parseFloat(fixedResult.recordset[0].RebatePerBag) || 0;
          console.log(`📊 Fixed rebate per bag: ${baseRebatePerBag}`);
        }
        
        const qtrRebateQuery = `
          SELECT QtrRebate 
          FROM FixCustRebate
          WHERE CardCode = @customerCode AND RebateCode = @rebateCode
        `;
        const qtrRebateResult = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(qtrRebateQuery);
        if (qtrRebateResult.recordset.length > 0) {
          qtrRebate = parseFloat(qtrRebateResult.recordset[0].QtrRebate) || 0;
          console.log(`📊 Fixed QTR Rebate: ${qtrRebate}`);
        }

        // ↓ ADD THIS BLOCK ↓
        try {
          const quotaQuery = `
            SELECT T2.Month, T2.TargetQty
            FROM FixCustRebate T1
            INNER JOIN FixCustQuota T2 ON T1.Id = T2.CustRebateId
            WHERE T1.CardCode = @customerCode AND T1.RebateCode = @rebateCode
          `;
          const quotaResult = await pool.request()
            .input('customerCode', sql.NVarChar(50), customerCode)
            .input('rebateCode', sql.NVarChar(50), rebateCode)
            .query(quotaQuery);
          quotaResult.recordset.forEach(row => {
            if (row.Month && row.TargetQty !== null) {
              customerQuotas[row.Month] = row.TargetQty;
            }
          });
          console.log(`📊 Customer quotas found for ${customerCode}:`, customerQuotas);
        } catch (quotaError) {
          console.log('⚠️ Could not fetch customer quotas:', quotaError.message);
        }
        // ↑ END OF ADDED BLOCK ↑

      } catch (error) {
        console.log('⚠️ Could not fetch Fixed rebate values:', error.message);
      }
    } else if (rebateType === 'Incremental') {
      console.log('📊 Incremental rebate type - using existing logic');
    }
    const monthlyGroups = {};
    
    if (Array.isArray(transactions) && transactions.length > 0) {
      console.log(`📊 Processing ${transactions.length} transactions for payout calculation`);
      
      transactions.forEach((transaction, index) => {
        try {
          if (!transaction.Date) return;
          
          const date = new Date(transaction.Date);
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
              monthKey: monthKey,
              monthName: monthName,
              monthNumber: month + 1,
              year: year,
              quarter: quarter,
              payoutDate: payoutDate,
              period: `${monthName} ${year}`,
              totalBaseAmount: 0,
              totalActualSales: 0,
              totalPriceAfVAT: 0,
              totalQtyForReb: 0,
              totalAdjustedQtyForReb: 0,
              dailyTransactions: [],
              hasTransactions: true,
              itemBreakdown: new Map()
            };
          }
          
          const actualSales = parseFloat(transaction.ActualSales) || 0;
          const priceAfVAT = parseFloat(transaction.PriceAfVAT) || 0;
          const qtyForReb = parseFloat(transaction.QtyForReb) || 0;
          const itemCode = transaction.ItemCode || transaction.Item || '';
          const itemName = transaction.ItemName || transaction.Item || `Item_${index}`;
          
          let dailyRebate = 0;
          let calculationNote = '';
          let percentageUsed = 0;
          
          if (rebateType === 'Percentage') {
            percentageUsed = 0;
            
            if (itemCode && itemPercentageMap.has(itemCode)) {
              percentageUsed = itemPercentageMap.get(itemCode);
            } else {
              console.log(`⚠️ No percentage found for item: ${itemCode || itemName}, using 0%`);
              percentageUsed = 0;
            }
            
            dailyRebate = (actualSales * priceAfVAT * percentageUsed) / 100;
            calculationNote = `(${actualSales} × ₱${priceAfVAT.toFixed(2)} × ${percentageUsed}%) / 100 = ₱${dailyRebate.toFixed(2)}`;
          } else if (rebateType === 'Fixed') {
            dailyRebate = actualSales * baseRebatePerBag;
            calculationNote = `${actualSales} × ₱${baseRebatePerBag.toFixed(2)} = ₱${dailyRebate.toFixed(2)}`;
          }
          
          const is25kgItem = transaction.Is25kgItem || 
            (itemName && itemName.toLowerCase().includes('25kg')) ||
            (transaction.Weight && transaction.Weight.toString().includes('25'));
          
          if (is25kgItem) {
            const originalRebate = dailyRebate;
            dailyRebate = dailyRebate / 2;
            calculationNote += ` → 25kg adjustment: ₱${originalRebate.toFixed(2)} ÷ 2 = ₱${dailyRebate.toFixed(2)}`;
          }
          
          const itemKey = itemCode || itemName;
          if (!monthlyGroups[monthKey].itemBreakdown.has(itemKey)) {
            monthlyGroups[monthKey].itemBreakdown.set(itemKey, {
              itemCode: itemCode,
              itemName: itemName,
              totalActualSales: 0,
              totalRebate: 0,
              percentageUsed: percentageUsed,
              transactionCount: 0
            });
          }
          
          const itemBreakdown = monthlyGroups[monthKey].itemBreakdown.get(itemKey);
          itemBreakdown.totalActualSales += actualSales;
          itemBreakdown.totalRebate += dailyRebate;
          itemBreakdown.transactionCount++;
          
          monthlyGroups[monthKey].dailyTransactions.push({
            date: transaction.Date,
            itemCode: itemCode,
            itemName: itemName,
            actualSales: actualSales,
            priceAfVAT: priceAfVAT,
            dailyRebate: dailyRebate,
            percentageUsed: percentageUsed,
            calculationNote: calculationNote,
            is25kg: is25kgItem
          });

          const adjustedQtyForReb = is25kgItem ? qtyForReb / 2 : qtyForReb; 
          
          monthlyGroups[monthKey].totalBaseAmount += dailyRebate;
          monthlyGroups[monthKey].totalActualSales += actualSales;
          monthlyGroups[monthKey].totalPriceAfVAT += priceAfVAT;
          monthlyGroups[monthKey].totalAdjustedQtyForReb += adjustedQtyForReb;
          
        } catch (transError) {
          console.error(`❌ Error processing transaction ${index}:`, transError.message);
        }
      });
      
      console.log(`📊 Created ${Object.keys(monthlyGroups).length} month groups with transactions`);
    }
    const monthlyData = [];
    for (const monthKey in monthlyGroups) {
      const monthWithData = monthlyGroups[monthKey];
      
      const sapForThisMonth = sapAmountMap[monthKey] || { amount: 0, entries: [] };
      const sapAmount = sapForThisMonth.amount || 0;
      
      let baseAmount = monthWithData.totalBaseAmount || 0;
      let totalActualSales = monthWithData.totalActualSales || 0;
      let totalPriceAfVAT = monthWithData.totalPriceAfVAT || 0;
      let status = baseAmount > 0 ? 'Pending' : 'No Payout';
      let eligible = true;
      let quotaMet = true;

      // ↓ ADD THIS BLOCK ↓
      // Fixed type: if quota is configured → VAN-style quota gate;
      // otherwise fall through to NEXCHEM-style (totalBaseAmount already calculated)
      if (rebateType === 'Fixed') {
        const hasQuotas = Object.keys(customerQuotas).length > 0;
        const targetQuota = customerQuotas[monthWithData.monthName] || 0;

        if (hasQuotas && targetQuota > 0) {
          // VAN approach: qty-based with quota check
          const totalQtyForReb = monthWithData.totalQtyForReb || 0;
          const totalAdjustedQtyForReb = monthWithData.totalAdjustedQtyForReb || 0;
          quotaMet = totalQtyForReb >= targetQuota;

          if (quotaMet) {
            baseAmount = totalAdjustedQtyForReb * baseRebatePerBag;
            eligible = true;
            status = 'Pending';
            console.log(`📊 [QUOTA] ${monthWithData.period}: Qty ${totalQtyForReb} >= ${targetQuota} ✅ Base=₱${baseAmount.toFixed(2)}`);
          } else {
            baseAmount = 0;
            eligible = false;
            status = 'No Payout';
            console.log(`📊 [QUOTA] ${monthWithData.period}: Qty ${totalQtyForReb} < ${targetQuota} ❌ No Payout`);
          }
        } else {
          // NEXCHEM approach: no quota, use daily sales already in totalBaseAmount
          eligible = true;
          quotaMet = true;
          console.log(`📊 [NO-QUOTA] ${monthWithData.period}: Using sales-based amount ₱${baseAmount.toFixed(2)}`);
        }
      }
      // ↑ END OF ADDED BLOCK ↑

      let calculationNote = '';
      let dailyCalculations = [];
      let itemCalculations = [];
      
      if (monthWithData.dailyTransactions && monthWithData.dailyTransactions.length > 0) {
        monthWithData.dailyTransactions.forEach(day => {
          dailyCalculations.push({
            date: day.date,
            item: day.itemName,
            calculation: day.calculationNote,
            rebate: day.dailyRebate,
            is25kg: day.is25kg,
            percentageUsed: day.percentageUsed
          });
        });
      }
      
      if (monthWithData.itemBreakdown && monthWithData.itemBreakdown.size > 0) {
        monthWithData.itemBreakdown.forEach((item, itemKey) => {
          itemCalculations.push({
            itemCode: item.itemCode,
            itemName: item.itemName,
            actualSales: item.totalActualSales,
            rebate: item.totalRebate,
            percentage: item.percentageUsed,
            transactionCount: item.transactionCount
          });
        });
      }
      
      if (rebateType === 'Percentage') {
        calculationNote = `Percentage Rebate (${itemCalculations.length} items):\n`;
        itemCalculations.forEach(item => {
          calculationNote += `  ${item.itemName || item.itemCode}: ${item.actualSales} bags × ₱${totalPriceAfVAT > 0 ? (totalPriceAfVAT / totalActualSales).toFixed(2) : 0} × ${item.percentage}% = ₱${item.rebate.toFixed(2)}\n`;
        });
        calculationNote += `  Total: ₱${baseAmount.toFixed(2)}`;
      } else if (rebateType === 'Fixed') {
        calculationNote = `Fixed Rebate: Total Sales ${totalActualSales} × ₱${baseRebatePerBag.toFixed(2)} = ₱${baseAmount.toFixed(2)}`;
      }
      
      let totalAmount = baseAmount;
      let balance = totalAmount;
      
      const monthlyRecord = {
        id: `Month-${customerCode}-${rebateCode}-${monthKey}`,
        type: 'monthly',
        cardCode: customerCode,
        rebateCode: rebateCode,
        date: monthWithData.payoutDate,
        period: monthWithData.period,
        monthKey: monthKey,
        monthNumber: monthWithData.monthNumber,
        quarter: monthWithData.quarter,
        year: monthWithData.year,
        baseAmount: parseFloat(baseAmount.toFixed(2)),
        amount: parseFloat(totalAmount.toFixed(2)),
        status: status,
        amountReleased: sapAmount,
        sapReleasedAmount: sapAmount,
        sapEntries: sapForThisMonth.entries,
        balance: parseFloat(balance.toFixed(2)),
        eligible: eligible,
        quotaMet: quotaMet,
        totalActualSales: totalActualSales,
        totalPriceAfVAT: totalPriceAfVAT,
        calculationNote: calculationNote,
        dailyCalculations: dailyCalculations,
        itemCalculations: itemCalculations,
        qtrRebate: qtrRebate,
        hasTransactions: true,
        transactionCount: monthWithData.dailyTransactions.length,
        isNonEligibleMonth: !eligible || !quotaMet,
        rebateType: rebateType,
        rebatePerBag: baseRebatePerBag,
        frequency: frequency
      };
      
      monthlyData.push(monthlyRecord);
      
      console.log(`📊 Month ${monthKey}: Added with ${monthWithData.dailyTransactions.length} daily transactions, Base: ₱${baseAmount.toFixed(2)}, SAP Released: ₱${sapAmount.toFixed(2)}`);
    }
    console.log(`📊 Processed ${monthlyData.length} months with transactions (months without transactions excluded from display)`);
    const quarterlyData = [];
    
    if (frequency === 'Quarterly' && qtrRebate > 0) {
      console.log(`📊 Calculating quarter rebates (qtrRebate: ${qtrRebate})`);
      
      const quarters = {};
      monthlyData.forEach(month => {
        const quarterKey = `Q${month.quarter}-${month.year}`;
        if (!quarters[quarterKey]) {
          quarters[quarterKey] = {
            quarter: month.quarter,
            year: month.year,
            months: [],
            totalBaseAmount: 0,
            eligibleMonths: 0,
            totalMonths: 0,
            isComplete: false,
            totalSapAmount: 0
          };
        }
        
        quarters[quarterKey].months.push(month);
        quarters[quarterKey].totalBaseAmount += month.baseAmount;
        quarters[quarterKey].totalMonths++;
        quarters[quarterKey].totalSapAmount += month.sapReleasedAmount || 0;
        
        if (month.hasTransactions) {
          quarters[quarterKey].eligibleMonths++;
        }
      });
      console.log(`📊 Found ${Object.keys(quarters).length} quarters`);
      
      Object.keys(quarters).forEach(quarterKey => {
        const quarter = quarters[quarterKey];
        
        quarter.isComplete = quarter.eligibleMonths === 3 && quarter.totalMonths === 3;
        
        console.log(`📊 Quarter ${quarterKey}: ${quarter.eligibleMonths}/${quarter.totalMonths} months with transactions, Complete: ${quarter.isComplete}`);
        
        if (quarter.isComplete) {
          let qtrRebateAmount = 0;
          let calculationNote = '';
          
          if (rebateType === 'Percentage') {
            qtrRebateAmount = quarter.totalBaseAmount * (qtrRebate / 100);
            calculationNote = `QTR Rebate: ₱${quarter.totalBaseAmount.toFixed(2)} × ${qtrRebate}% = ₱${qtrRebateAmount.toFixed(2)}`;
          } else {
            qtrRebateAmount = quarter.totalBaseAmount * qtrRebate;
            calculationNote = `QTR Rebate: ₱${quarter.totalBaseAmount.toFixed(2)} × ${qtrRebate} = ₱${qtrRebateAmount.toFixed(2)}`;
          }
          
          console.log(`📊 Adding QTR rebate for ${quarterKey}: ₱${qtrRebateAmount.toFixed(2)}`);
          
          quarterlyData.push({
            id: `QtrRebate-${customerCode}-${rebateCode}-${quarterKey}`,
            type: 'quarterly',
            cardCode: customerCode,
            rebateCode: rebateCode,
            date: `${quarter.quarter}.${quarter.year.toString().slice(-2)}`,
            period: `Quarter ${quarter.quarter} ${quarter.year}`,
            quarter: quarter.quarter,
            year: quarter.year,
            baseAmount: qtrRebateAmount,
            amount: parseFloat(qtrRebateAmount.toFixed(2)),
            status: 'Pending',
            amountReleased: 0,
            sapReleasedAmount: 0,
            balance: parseFloat(qtrRebateAmount.toFixed(2)),
            eligible: true,
            quotaMet: true,
            qtrRebate: qtrRebate,
            isQtrRebate: true,
            calculationNote: calculationNote,
            rebateType: rebateType,
            frequency: frequency
          });
        }
      });
    }
    const allData = [...monthlyData, ...quarterlyData];
    
    console.log(`✅ Completed payout calculation: ${monthlyData.length} monthly (with transactions), ${quarterlyData.length} quarterly`);
    console.log(`📊 [SAP] Applied SAP amounts to ${monthlyData.filter(m => m.sapReleasedAmount > 0).length} months`);
    
    const firstMonthWithTransactions = monthlyData.find(m => m.hasTransactions);
    if (firstMonthWithTransactions) {
      console.log(`📊 Sample calculation for ${firstMonthWithTransactions.period}:`);
      console.log(`  Base Amount: ₱${firstMonthWithTransactions.baseAmount.toFixed(2)}`);
      console.log(`  SAP Released: ₱${firstMonthWithTransactions.sapReleasedAmount.toFixed(2)}`);
      console.log(`  Calculation: ${firstMonthWithTransactions.calculationNote}`);
      
      if (firstMonthWithTransactions.itemCalculations && firstMonthWithTransactions.itemCalculations.length > 0) {
        console.log(`  Item breakdown:`);
        firstMonthWithTransactions.itemCalculations.forEach(item => {
          console.log(`    ${item.itemName || item.itemCode}: ${item.actualSales} bags × ${item.percentage}% = ₱${item.rebate.toFixed(2)}`);
        });
      }
      
      if (firstMonthWithTransactions.dailyCalculations && firstMonthWithTransactions.dailyCalculations.length > 0) {
        console.log(`  Daily breakdown (first 2 days):`);
        firstMonthWithTransactions.dailyCalculations.slice(0, 2).forEach(day => {
          console.log(`    ${day.date} - ${day.item}: ${day.calculation}`);
        });
      }
    }
    
    return allData;
    
  } catch (error) {
    console.error('❌ Error in calculateMonthlyPayoutData:', error);
    console.error(error.stack);
    return [];
  }
};
const getMonthEndQtyBal = (transactions, monthKey) => {
  try {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return 0;
    }
    
    const sortedTransactions = [...transactions].sort((a, b) => {
      const dateA = a.Date ? new Date(a.Date) : new Date(0);
      const dateB = b.Date ? new Date(b.Date) : new Date(0);
      return dateB - dateA;
    });
    
    const lastTransaction = sortedTransactions[0];
    
    const qtyBal = parseFloat(lastTransaction.QtyBal) || 
                  parseFloat(lastTransaction.CumulativeQty) || 
                  parseFloat(lastTransaction.QuantityBalance) || 
                  parseFloat(lastTransaction.MonthEndBalance) || 
                  0;
    
    console.log(`📊 Month-end QtyBal for ${monthKey}: ${qtyBal} (from ${sortedTransactions.length} transactions)`);
    return qtyBal;
    
  } catch (error) {
    console.error(`❌ Error getting month-end QtyBal for ${monthKey}:`, error.message);
    return 0;
  }
};
const mergePayoutData = (calculatedData, existingData, rebateType, frequency, sapEntries = []) => {
  try {
    console.log(`🔄 Merging payout data: ${calculatedData.length} calculated, ${existingData.length} existing`);
    
    if (!Array.isArray(calculatedData)) calculatedData = [];
    if (!Array.isArray(existingData)) existingData = [];
    
    const merged = [];
    
    calculatedData.forEach(calculated => {
      try {
        const existing = existingData.find(record => 
          record.PayoutId === calculated.id
        );
        
        if (existing) {
          merged.push({
            Id: existing.Id,
            PayoutId: existing.PayoutId || calculated.id,
            CardCode: existing.CardCode || calculated.cardCode,
            RebateCode: existing.RebateCode || calculated.rebateCode,
            RebateType: existing.RebateType || rebateType,
            Date: existing.Date || calculated.date,
            Period: existing.Period || calculated.period,
            BaseAmount: existing.BaseAmount || calculated.baseAmount || calculated.amount,
            TotalAmount: existing.TotalAmount || calculated.amount,
            Amount: existing.TotalAmount || calculated.amount,
            Status: existing.Status || calculated.status,
            AmountReleased: existing.AmountReleased || calculated.amountReleased || 0,
            SapReleasedAmount: existing.SapReleasedAmount || calculated.sapReleasedAmount || 0,
            SapLastSync: existing.SapLastSync || calculated.sapLastSync,
            Balance: existing.Balance || calculated.balance,
            ReleaseDate: existing.ReleaseDate,
            CreatedDate: existing.CreatedDate || new Date().toISOString().split('T')[0],
            UpdatedDate: existing.UpdatedDate || new Date().toISOString().split('T')[0],
            monthKey: calculated.monthKey,
            quarter: calculated.quarter,
            year: calculated.year,
            totalQtyForReb: calculated.totalQtyForReb || 0,
            totalAdjustedQtyForReb: calculated.totalAdjustedQtyForReb || 0,
            eligible: calculated.eligible,
            quotaMet: calculated.quotaMet,
            qtrRebate: calculated.qtrRebate,
            isQtrRebate: calculated.type === 'quarterly',
            calculationNote: calculated.calculationNote,
            hasTransactions: calculated.hasTransactions || false,
            transactionCount: calculated.transactionCount || 0,
            sapEntries: calculated.sapEntries || []
          });
        } else {
          merged.push({
            Id: null,
            PayoutId: calculated.id,
            CardCode: calculated.cardCode,
            RebateCode: calculated.rebateCode,
            RebateType: rebateType,
            Date: calculated.date,
            Period: calculated.period,
            BaseAmount: calculated.baseAmount || calculated.amount,
            TotalAmount: calculated.amount,
            Amount: calculated.amount,
            Status: calculated.status,
            AmountReleased: calculated.amountReleased || 0,
            SapReleasedAmount: calculated.sapReleasedAmount || 0,
            SapLastSync: calculated.sapReleasedAmount ? new Date() : null,
            Balance: calculated.balance,
            ReleaseDate: null,
            CreatedDate: new Date().toISOString().split('T')[0],
            UpdatedDate: new Date().toISOString().split('T')[0],
            monthKey: calculated.monthKey,
            quarter: calculated.quarter,
            year: calculated.year,
            totalQtyForReb: calculated.totalQtyForReb || 0,
            totalAdjustedQtyForReb: calculated.totalAdjustedQtyForReb || 0,
            eligible: calculated.eligible,
            quotaMet: calculated.quotaMet,
            qtrRebate: calculated.qtrRebate,
            isQtrRebate: calculated.type === 'quarterly',
            calculationNote: calculated.calculationNote,
            hasTransactions: calculated.hasTransactions || false,
            transactionCount: calculated.transactionCount || 0,
            sapEntries: calculated.sapEntries || []
          });
        }
      } catch (mergeError) {
        console.error(`❌ Error merging record:`, mergeError.message);
      }
    });
    console.log(`✅ Merged ${merged.length} payout records with SAP data`);
    return merged;
    
  } catch (error) {
    console.error('❌ Error in mergePayoutData:', error);
    return [];
  }
};
const calculateStatus = (existingStatus, isEligible, quotaMet = false, rebateType = 'Fixed') => {
  if (rebateType === 'Fixed') {
    if (!quotaMet) {
      return 'No Payout';
    }
    if (!existingStatus || existingStatus === 'No Payout') {
      return 'Pending';
    }
    return existingStatus;
  } else {
    if (!isEligible) {
      return 'No Payout';
    }
    if (!existingStatus || existingStatus === 'No Payout') {
      return 'Pending';
    }
    return existingStatus;
  }
};
const calculateBalance = (amount, amountReleased) => {
  const balance = Math.max(0, amount - amountReleased);
  return parseFloat(balance.toFixed(2));
};
const generatePayoutId = (customerCode, rebateCode) => {
  const cleanId = `PAY-${customerCode}-${rebateCode}`.replace(/[^a-zA-Z0-9-]/g, '');
  console.log(`🆔 Generated payout ID: ${cleanId}`);
  return cleanId;
};
const savePayoutsToDatabase = async (payouts, pool, frequency = 'Quarterly') => {
  try {
    console.log(`💾 Saving ${payouts.length} payout records to database`);
    
    const payoutsWithCarryOver = applyBalanceCarryOver(payouts, frequency);
    
    for (const payout of payoutsWithCarryOver) {
      try {
        if (payout.isBeginningBalance || payout.displayType === 'beginning_balance') {
          console.log(`⏭️ Skipping saving beginning balance record: ${payout.PayoutId}`);
          continue;
        }
        const baseAmount = parseFloat(payout.BaseAmount) || 0;
        const totalAmount = parseFloat(payout.TotalAmount) || 0;
        const amountReleased = parseFloat(payout.AmountReleased) || 0;
        const sapReleasedAmount = parseFloat(payout.SapReleasedAmount) || 0;
        const rebateType = payout.RebateType || payout.rebateType || 'Fixed';
        const balance = parseFloat(payout.Balance) || 0;
        const status = payout.Status || 'Pending';
        
        const finalStatus = totalAmount === 0 ? 'No Payout' : status;
        
        const checkQuery = `
          SELECT Id, PayoutId FROM PayoutHistory WHERE PayoutId = @PayoutId
        `;
        
        const checkResult = await pool.request()
          .input('PayoutId', sql.NVarChar(100), payout.PayoutId)
          .query(checkQuery);
        
        if (checkResult.recordset.length > 0) {
          const updateQuery = `
            UPDATE PayoutHistory 
            SET 
              BaseAmount = @BaseAmount,
              TotalAmount = @TotalAmount,
              Status = @Status,
              AmountReleased = CASE 
                WHEN @SapReleasedAmount > 0 AND AmountReleased = 0 THEN @SapReleasedAmount
                WHEN @SapReleasedAmount > 0 AND @SapReleasedAmount != AmountReleased THEN @SapReleasedAmount
                ELSE AmountReleased
              END,
              SapReleasedAmount = @SapReleasedAmount,
              SapLastSync = @SapLastSync,
              RebateBalance = @RebateBalance,
              RebateType = @RebateType,
              UpdatedDate = GETDATE()
            WHERE PayoutId = @PayoutId
          `;
          
          const sapLastSync = sapReleasedAmount > 0 ? new Date() : null;
          
          await pool.request()
            .input('PayoutId', sql.NVarChar(100), payout.PayoutId)
            .input('BaseAmount', sql.Decimal(18, 2), baseAmount)
            .input('TotalAmount', sql.Decimal(18, 2), totalAmount)
            .input('Status', sql.NVarChar(50), finalStatus)
            .input('AmountReleased', sql.Decimal(18, 2), amountReleased)
            .input('SapReleasedAmount', sql.Decimal(18, 2), sapReleasedAmount)
            .input('SapLastSync', sql.DateTime, sapLastSync)
            .input('RebateBalance', sql.Decimal(18, 2), balance)
            .input('RebateType', sql.NVarChar(50), rebateType)
            .query(updateQuery);
            
          console.log(`✅ Updated payout ${payout.PayoutId}: Base=${baseAmount}, Total=${totalAmount}, Released=${amountReleased}, SAP=${sapReleasedAmount}, Balance=${balance}, Status=${finalStatus}`);
        } else {
          const insertQuery = `
            INSERT INTO PayoutHistory (
              PayoutId, CardCode, RebateCode, RebateType, PayoutDate, Period, 
              BaseAmount, TotalAmount, Status, AmountReleased, SapReleasedAmount, SapLastSync, RebateBalance
            )
            VALUES (
              @PayoutId, @CardCode, @RebateCode, @RebateType, @PayoutDate, @Period,
              @BaseAmount, @TotalAmount, @Status, @AmountReleased, @SapReleasedAmount, @SapLastSync, @RebateBalance
            )
          `;
          
          const sapLastSync = sapReleasedAmount > 0 ? new Date() : null;
          
          await pool.request()
            .input('PayoutId', sql.NVarChar(100), payout.PayoutId)
            .input('CardCode', sql.NVarChar(50), payout.CardCode || '')
            .input('RebateCode', sql.NVarChar(50), payout.RebateCode || '')
            .input('RebateType', sql.NVarChar(50), rebateType)
            .input('PayoutDate', sql.NVarChar(20), payout.Date || '')
            .input('Period', sql.NVarChar(100), payout.Period || '')
            .input('BaseAmount', sql.Decimal(18, 2), baseAmount)
            .input('TotalAmount', sql.Decimal(18, 2), totalAmount)
            .input('Status', sql.NVarChar(50), finalStatus)
            .input('AmountReleased', sql.Decimal(18, 2), amountReleased)
            .input('SapReleasedAmount', sql.Decimal(18, 2), sapReleasedAmount)
            .input('SapLastSync', sql.DateTime, sapLastSync)
            .input('RebateBalance', sql.Decimal(18, 2), balance)
            .query(insertQuery);
            
          console.log(`✅ Inserted payout ${payout.PayoutId}: Base=${baseAmount}, Total=${totalAmount}, Released=${amountReleased}, SAP=${sapReleasedAmount}, Balance=${balance}, Status=${finalStatus}`);
        }
        
      } catch (payoutError) {
        console.error(`❌ Error saving payout ${payout?.PayoutId}:`, payoutError.message);
      }
    }
    
    console.log(`✅ Completed saving ${payouts.length} payout records with carry-over and SAP data`);

    // ── Cross-rebate reconciliation ──────────────────────────────────────
    const nonBeginning = payoutsWithCarryOver.filter(p =>
      !p.isBeginningBalance && p.CardCode && p.RebateCode
    );
    if (nonBeginning.length > 0) {
      await reconcileAfterSave(
        nonBeginning[0].CardCode,
        nonBeginning[0].RebateCode,
        pool
      );
    }
    // ─────────────────────────────────────────────────────────────────────

    console.log(`✅ Completed saving ${payouts.length} payout records`);
    
  } catch (error) {
    console.error('❌ Error in savePayoutsToDatabase:', error);
  }
};
router.put('/payouts/:payoutId/status', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, status, amountReleased } = req.body;
    
    console.log('🔄 Updating payout by PayoutId:', { payoutId, status, amountReleased });
    
    if (!payoutId) {
      return res.status(400).json({
        success: false,
        message: 'Payout ID is required'
      });
    }
    const databaseToUse = db || 'VCP_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }
    const getQuery = `
      SELECT Id, PayoutId, CardCode, RebateCode, BaseAmount, TotalAmount, AmountReleased, Status, RebateBalance
      FROM PayoutHistory
      WHERE PayoutId = @payoutId
    `;
    
    const getResult = await ownPool.request()
      .input('payoutId', sql.NVarChar(100), payoutId)
      .query(getQuery);
    console.log(`📊 Found ${getResult.recordset.length} records with PayoutId: ${payoutId}`);
    if (getResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Payout with PayoutId ${payoutId} not found. Please generate payouts first.`
      });
    }
    const currentPayout = getResult.recordset[0];
    const cardCode = currentPayout.CardCode;
    const rebateCode = currentPayout.RebateCode;
    
    const totalAmount = parseFloat(currentPayout.TotalAmount) || 0;
    let newAmountReleased = parseFloat(amountReleased) || 0;
    
    newAmountReleased = Math.min(Math.max(newAmountReleased, 0), totalAmount);
    
    const newBalance = Math.max(0, totalAmount - newAmountReleased);
    
    let newStatus = status || currentPayout.Status;
    if (newAmountReleased === 0 && totalAmount > 0) {
      newStatus = 'Pending';
    } else if (newAmountReleased >= totalAmount) {
      newStatus = 'Paid';
    } else if (newAmountReleased > 0) {
      newStatus = 'Partially Paid';
    }
    
    let releaseDate = currentPayout.ReleaseDate;
    if (newAmountReleased > 0 && (!releaseDate || releaseDate === null)) {
      releaseDate = new Date();
    }
    const updateQuery = `
      UPDATE PayoutHistory 
      SET 
        Status = @status,
        AmountReleased = @amountReleased,
        ReleaseDate = @releaseDate,
        RebateBalance = @balance,
        UpdatedDate = GETDATE()
      WHERE PayoutId = @payoutId
    `;
    
    const result = await ownPool.request()
      .input('status', sql.NVarChar(50), newStatus)
      .input('amountReleased', sql.Decimal(18, 2), newAmountReleased)
      .input('releaseDate', sql.DateTime, releaseDate)
      .input('balance', sql.Decimal(18, 2), newBalance)
      .input('payoutId', sql.NVarChar(100), payoutId)
      .query(updateQuery);
    console.log(`✅ Updated payout ${payoutId}:`, {
      totalAmount: totalAmount,
      amountReleased: newAmountReleased,
      balance: newBalance,
      status: newStatus,
      calculation: `${totalAmount} - ${newAmountReleased} = ${newBalance}`,
      rowsAffected: result.rowsAffected[0]
    });
    await updateSubsequentPayouts(cardCode, rebateCode, ownPool);
    res.json({
      success: true,
      message: `Payout updated successfully`,
      data: {
        payoutId: payoutId,
        baseAmount: currentPayout.BaseAmount,
        totalAmount: totalAmount,
        status: newStatus,
        amountReleased: newAmountReleased,
        balance: newBalance,
        releaseDate: releaseDate,
        rowsAffected: result.rowsAffected[0]
      }
    });
  } catch (error) {
    console.error('❌ Error updating payout:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payout',
      error: error.message
    });
  }
});
const updateSubsequentPayouts = async (cardCode, rebateCode, pool) => {
  try {
    console.log(`🔄 Updating subsequent payouts for ${cardCode} - ${rebateCode}`);
    
    const getPayoutsQuery = `
      SELECT Id, PayoutId, BaseAmount, TotalAmount, AmountReleased, RebateBalance, Status, PayoutDate
      FROM PayoutHistory
      WHERE CardCode   = @cardCode
        AND RebateCode = @rebateCode
        AND PayoutId   NOT LIKE 'SAP-%'
        AND PayoutId   NOT LIKE 'OOP-%'
      ORDER BY PayoutDate ASC, CreatedDate ASC
    `;
    
    const result = await pool.request()
      .input('cardCode', sql.NVarChar(50), cardCode)
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(getPayoutsQuery);
    
    const payouts = result.recordset;
    
    if (payouts.length === 0) {
      return;
    }
    
    let previousBalance = 0;
    
    for (let i = 0; i < payouts.length; i++) {
      const payout = payouts[i];
      const baseAmount = parseFloat(payout.BaseAmount) || 0;
      const amountReleased = parseFloat(payout.AmountReleased) || 0;
      
      const totalAmount = baseAmount + previousBalance;
      const balance = Math.max(0, totalAmount - amountReleased);
      
      let status = payout.Status;
      if (baseAmount === 0) {
        status = 'No Payout';
      } else if (amountReleased === 0 && totalAmount > 0) {
        status = 'Pending';
      } else if (amountReleased >= totalAmount) {
        status = 'Paid';
      } else if (amountReleased > 0) {
        status = 'Partially Paid';
      }
      
      const updateQuery = `
        UPDATE PayoutHistory 
        SET 
          TotalAmount = @totalAmount,
          RebateBalance = @balance,
          Status = @status,
          UpdatedDate = GETDATE()
        WHERE Id = @id
      `;
      
      await pool.request()
        .input('totalAmount', sql.Decimal(18, 2), totalAmount)
        .input('balance', sql.Decimal(18, 2), balance)
        .input('status', sql.NVarChar(50), status)
        .input('id', sql.Int, payout.Id)
        .query(updateQuery);
      
      previousBalance = balance;
    }
    
    console.log(`✅ Updated ${payouts.length} subsequent payouts`);

    // Reconcile carry-over settlements after rebalancing
    await reconcileAfterSave(cardCode, rebateCode, pool);
    
  } catch (error) {
    console.error('❌ Error updating subsequent payouts:', error);
  }
};
router.put('/payouts/:payoutId/amount-released', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, amountReleased } = req.body;
    
    console.log('💰 Updating amount released:', { payoutId, amountReleased });
    
    if (!payoutId) {
      return res.status(400).json({
        success: false,
        message: 'Payout ID is required'
      });
    }
    const databaseToUse = db || 'VCP_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }
    const getQuery = `
      SELECT Id, TotalAmount, AmountReleased, Status
      FROM PayoutHistory
      WHERE PayoutId = @payoutId
    `;
    
    const getResult = await ownPool.request()
      .input('payoutId', sql.NVarChar(100), payoutId)
      .query(getQuery);
    if (getResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Payout with ID ${payoutId} not found`
      });
    }
    const currentPayout = getResult.recordset[0];
    const totalAmount = parseFloat(currentPayout.TotalAmount) || 0;
    
    const newAmountReleased = parseFloat(amountReleased) || 0;
    const validatedAmountReleased = Math.min(Math.max(newAmountReleased, 0), totalAmount);
    
    const newBalance = Math.max(0, totalAmount - validatedAmountReleased);
    
    let newStatus = currentPayout.Status;
    if (validatedAmountReleased === 0) {
      newStatus = totalAmount > 0 ? 'Pending' : 'No Payout';
    } else if (validatedAmountReleased >= totalAmount) {
      newStatus = 'Paid';
    } else if (validatedAmountReleased > 0) {
      newStatus = 'Partially Paid';
    }
    
    let releaseDate = currentPayout.ReleaseDate;
    if (validatedAmountReleased > 0 && (!releaseDate || releaseDate === null)) {
      releaseDate = new Date();
    }
    const updateQuery = `
      UPDATE PayoutHistory 
      SET 
        Status = @status,
        AmountReleased = @amountReleased,
        ReleaseDate = @releaseDate,
        RebateBalance = @balance,
        UpdatedDate = GETDATE()
      WHERE PayoutId = @payoutId
    `;
    
    const result = await ownPool.request()
      .input('status', sql.NVarChar(50), newStatus)
      .input('amountReleased', sql.Decimal(18, 2), validatedAmountReleased)
      .input('releaseDate', sql.DateTime, releaseDate)
      .input('balance', sql.Decimal(18, 2), newBalance)
      .input('payoutId', sql.NVarChar(100), payoutId)
      .query(updateQuery);
    console.log(`Updated amount released for ${payoutId}:`, {
      amountReleased: validatedAmountReleased,
      balance: newBalance,
      status: newStatus
    });
    res.json({
      success: true,
      message: `Amount released updated successfully`,
      data: {
        payoutId: payoutId,
        status: newStatus,
        amountReleased: validatedAmountReleased,
        balance: newBalance,
        releaseDate: releaseDate,
        rowsAffected: result.rowsAffected[0]
      }
    });
  } catch (error) {
    console.error('❌ Error updating amount released:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating amount released',
      error: error.message
    });
  }
});
router.post('/payouts/save', async (req, res) => {
  try {
    const { db, payoutData } = req.body;
    
    console.log('💾 Saving payout data:', payoutData?.Id);
    
    if (!payoutData || !payoutData.Id) {
      return res.status(400).json({
        success: false,
        message: 'Payout data is required'
      });
    }
    const databaseToUse = db || 'VCP_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }
    const amount = parseFloat(payoutData.Amount) || 0;
    const amountReleased = parseFloat(payoutData.AmountReleased) || 0;
    const balance = calculateBalance(amount, amountReleased);
    
    let status = payoutData.Status || 'Pending';
    if (amount === 0) {
      status = 'No Payout';
    } else if (amountReleased === 0) {
      status = 'Pending';
    } else if (amountReleased >= amount) {
      status = 'Paid';
    } else if (amountReleased > 0) {
      status = 'Partially Paid';
    }
    let releaseDate = null;
    if (amountReleased > 0) {
      releaseDate = new Date();
    }
    const checkQuery = `
      SELECT Id FROM PayoutHistory WHERE PayoutId = @PayoutId
    `;
    
    const checkResult = await ownPool.request()
      .input('PayoutId', sql.NVarChar(100), payoutData.Id)
      .query(checkQuery);
    let queryResult;
    
    if (checkResult.recordset.length > 0) {
      const updateQuery = `
        UPDATE PayoutHistory 
        SET 
          TotalAmount = @TotalAmount,
          Status = @Status,
          AmountReleased = @AmountReleased,
          ReleaseDate = @ReleaseDate,
          RebateBalance = @RebateBalance,
          RebateType = @RebateType,
          UpdatedDate = GETDATE()
        WHERE PayoutId = @PayoutId
      `;
      
      queryResult = await ownPool.request()
        .input('PayoutId', sql.NVarChar(100), payoutData.Id)
        .input('TotalAmount', sql.Decimal(18, 2), amount)
        .input('Status', sql.NVarChar(50), status)
        .input('AmountReleased', sql.Decimal(18, 2), amountReleased)
        .input('ReleaseDate', sql.DateTime, releaseDate)
        .input('RebateBalance', sql.Decimal(18, 2), balance)
        .query(updateQuery);
      console.log(`✅ Updated payout ${payoutData.Id}: Status=${status}, AmountReleased=${amountReleased}`);
    } else {
      const insertQuery = `
        INSERT INTO PayoutHistory (
          PayoutId, CardCode, RebateCode, PayoutDate, Period, 
          TotalAmount, Status, AmountReleased, ReleaseDate, RebateBalance
        )
        VALUES (
          @PayoutId, @CardCode, @RebateCode, @PayoutDate, @Period,
          @TotalAmount, @Status, @AmountReleased, @ReleaseDate, @RebateBalance
        )
      `;
      
      queryResult = await ownPool.request()
        .input('PayoutId', sql.NVarChar(100), payoutData.Id)
        .input('CardCode', sql.NVarChar(50), payoutData.CardCode || '')
        .input('RebateCode', sql.NVarChar(50), payoutData.RebateCode || '')
        .input('PayoutDate', sql.NVarChar(20), payoutData.Date || '')
        .input('Period', sql.NVarChar(100), payoutData.Period || '')
        .input('TotalAmount', sql.Decimal(18, 2), amount)
        .input('Status', sql.NVarChar(50), status)
        .input('AmountReleased', sql.Decimal(18, 2), amountReleased)
        .input('ReleaseDate', sql.DateTime, releaseDate)
        .input('RebateBalance', sql.Decimal(18, 2), balance)
        .query(insertQuery);
      console.log(`✅ Inserted new payout ${payoutData.Id}: Status=${status}, AmountReleased=${amountReleased}`);
    }
    res.json({
      success: true,
      message: 'Payout data saved successfully',
      data: {
        payoutId: payoutData.Id,
        status: status,
        amountReleased: amountReleased,
        balance: balance,
        rowsAffected: queryResult.rowsAffected[0]
      }
    });
  } catch (error) {
    console.error('❌ Error saving payout data:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving payout data',
      error: error.message
    });
  }
});
router.get('/payouts/calculate/:customerCode/:rebateCode/:monthKey', async (req, res) => {
  try {
    const { customerCode, rebateCode, monthKey } = req.params;
    const { db } = req.query;
    
    console.log('🧮 Calculating payout details:', { customerCode, rebateCode, monthKey });
    
    const databaseToUse = db || 'VCP_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pools not available'
      });
    }
    const [year, month] = monthKey.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const rebateTypeQuery = `
      SELECT RebateType
      FROM RebateProgram
      WHERE RebateCode = @rebateCode
    `;
    
    const rebateTypeResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(rebateTypeQuery);
    if (rebateTypeResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Rebate with code ${rebateCode} not found`
      });
    }
    const rebateType = rebateTypeResult.recordset[0].RebateType;
    let transactions = [];
    try {
      const transUrl = `http://localhost:3009/api/dashboard/customer/${customerCode}/transactions?` +
        `db=${databaseToUse}&rebateCode=${rebateCode}&rebateType=${rebateType}&` +
        `periodFrom=${startDate}&periodTo=${endDate}`;
      
      console.log('📊 Fetching transactions from:', transUrl);
      
      const transResponse = await fetch(transUrl);
      if (transResponse.ok) {
        const transData = await transResponse.json();
        if (transData.success && transData.data.transactions) {
          transactions = transData.data.transactions || [];
          console.log(`📊 Found ${transactions.length} transactions for calculation`);
        }
      }
    } catch (transError) {
      console.error('❌ Error fetching transactions:', transError.message);
    }
    const calculation = await calculatePayoutDetails(
      transactions,
      rebateType,
      customerCode,
      rebateCode,
      ownPool,
      monthKey
    );
    res.json({
      success: true,
      data: {
        customerCode,
        rebateCode,
        rebateType,
        monthKey,
        calculation,
        transactionCount: transactions.length,
        totalQtyForReb: transactions.reduce((sum, t) => sum + (parseFloat(t.QtyForReb) || 0), 0)
      }
    });
  } catch (error) {
    console.error('❌ Error calculating payout:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating payout',
      error: error.message
    });
  }
});
const calculatePayoutDetails = async (transactions, rebateType, customerCode, rebateCode, pool, monthKey) => {
  const result = {
    totalQtyForReb: 0,
    totalAdjustedQtyForReb: 0,
    eligible: false,
    rebatePerBag: 0,
    qtrRebate: 0,
    amount: 0,
    calculationSteps: [],
    itemBreakdown: []
  };
  transactions.forEach((transaction, index) => {
    const itemName = transaction.Item || transaction.ItemName || `Item ${index + 1}`;
    const is25kgItem = transaction.Is25kgItem || 
      (itemName && itemName.toLowerCase().includes('25kg'));
    
    const originalQty = parseFloat(transaction.QtyForReb) || 0;
    let adjustedQty = originalQty;
    let adjustmentNote = '';
    
    if (is25kgItem) {
      adjustedQty = originalQty / 2;
      adjustmentNote = `${originalQty} ÷ 2 = ${adjustedQty.toFixed(2)}`;
    }
    
    result.totalQtyForReb += originalQty;
    result.totalAdjustedQtyForReb += adjustedQty;
    
    result.itemBreakdown.push({
      itemName: itemName,
      is25kg: is25kgItem,
      originalQty: originalQty,
      adjustedQty: adjustedQty,
      adjustmentNote: adjustmentNote
    });
  });
  result.calculationSteps.push(`Total QtyForReb: ${result.totalQtyForReb.toFixed(2)}`);
  result.calculationSteps.push(`Adjusted QtyForReb: ${result.totalAdjustedQtyForReb.toFixed(2)} (25kg items divided by 2)`);
  try {
    const qtrRebateQuery = rebateType === 'Fixed' ? `
      SELECT QtrRebate 
      FROM FixCustRebate 
      WHERE CardCode = @customerCode AND RebateCode = @rebateCode
    ` : `
      SELECT QtrRebate 
      FROM IncCustRebate 
      WHERE CardCode = @customerCode AND RebateCode = @rebateCode
    `;
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
        const rebateQuery = `
          SELECT TOP 1 RebatePerBag
          FROM FixProdRebate
          WHERE RebateCode = @rebateCode
        `;
        
        const rebateResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(rebateQuery);
        if (rebateResult.recordset.length > 0) {
          result.rebatePerBag = parseFloat(rebateResult.recordset[0].RebatePerBag) || 0;
          result.calculationSteps.push(`Rebate per bag: ${result.rebatePerBag}`);
        }
      } catch (error) {
        result.calculationSteps.push(`Rebate per bag: Not found (default 0)`);
      }
      result.amount = result.totalAdjustedQtyForReb * result.rebatePerBag;
      result.calculationSteps.push(`Base amount (using adjusted Qty): ${result.totalAdjustedQtyForReb.toFixed(2)} × ${result.rebatePerBag.toFixed(2)} = ${result.amount.toFixed(2)}`);
      
      if (result.qtrRebate > 0) {
        const originalAmount = result.amount;
        result.amount *= result.qtrRebate;
        result.calculationSteps.push(`With QTR: ${originalAmount.toFixed(2)} × ${result.qtrRebate.toFixed(2)} = ${result.amount.toFixed(2)}`);
      }
    }
  } else if (rebateType === 'Incremental') {
    const eligibleTransactions = transactions.filter(t => 
      t.EligibilityStatus === 'Eligible' && t.CurrentRange
    );
    
    if (eligibleTransactions.length > 0) {
      const highestRange = Math.max(...eligibleTransactions.map(t => t.CurrentRange || 0));
      const highestTransaction = eligibleTransactions.find(t => t.CurrentRange === highestRange);
      
      result.eligible = true;
      result.rebatePerBag = parseFloat(highestTransaction?.RebatePerBag) || 0;
      result.calculationSteps.push(`Highest range achieved: ${highestRange}`);
      result.calculationSteps.push(`Rebate per bag for range ${highestRange}: ${result.rebatePerBag.toFixed(2)}`);
      result.amount = result.totalAdjustedQtyForReb * result.rebatePerBag;
      result.calculationSteps.push(`Base amount (using adjusted Qty): ${result.totalAdjustedQtyForReb.toFixed(2)} × ${result.rebatePerBag.toFixed(2)} = ${result.amount.toFixed(2)}`);
      
      if (result.qtrRebate > 0) {
        const originalAmount = result.amount;
        result.amount *= result.qtrRebate;
        result.calculationSteps.push(`With QTR: ${originalAmount.toFixed(2)} × ${result.qtrRebate.toFixed(2)} = ${result.amount.toFixed(2)}`);
      }
    } else {
      result.calculationSteps.push(`Not eligible for any range`);
    }
  }
  result.calculationSteps.push(`Final amount: ${result.amount.toFixed(2)}`);
  result.calculationSteps.push(`Status: ${result.eligible ? 'Pending' : 'No Payout'}`);
  return result;
};

/*===================================================================*/
/*                      SAP JE + AR + AP  (fixed)                    */
/*===================================================================*/

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

/*------------------------------------------------------------------
 * HELPERS
 *------------------------------------------------------------------*/

/** Build a YYYY-MM period key and human-readable name from any Date */
const toPeriodMeta = (date) => {
  const d     = new Date(date);
  const year  = d.getFullYear();
  const month = d.getMonth() + 1;          // 1-based
  return {
    year,
    month,
    periodKey  : `${year}-${String(month).padStart(2, '0')}`,
    periodName : `${MONTH_NAMES[month - 1]} ${year}`,
  };
};

/** Return an empty period bucket */
const makeBucket = ({ periodKey, periodName, year, month }) => ({
  periodKey,
  periodName,
  year,
  month,
  totalAmount     : 0,
  arcmDeduction   : 0,          // ← track ARCM separately for logging
  entries         : [],
  transactionIds  : new Set(),
  sourceBreakdown : { JE: 0, AR: 0, AP: 0, ARCM: 0, APCM: 0 },
});


/*===================================================================*/
/*  MAIN FUNCTION                                                     */
/*===================================================================*/
/*===================================================================*/
/*   SAP JE + AR + AP  (fixed — post-period entries now captured)    */
/*===================================================================*/

/*
 * ROOT CAUSE
 * ──────────
 * The original queries all used:
 *
 *   AND DocDate >= @periodFrom AND DocDate <= @periodTo
 *
 * So an AR entry with DocDate 2026-04-14 is SILENTLY SKIPPED when
 * the rebate program runs January–February 2026.  The OOP PATH B in
 * syncSAPDataToPayouts never even sees the row — nothing to route.
 *
 * FIX
 * ───
 * Always fetch from periodFrom → MAX(periodTo, today).
 * The existing PATH A / PATH B logic in syncSAPDataToPayouts already
 * handles the sorting:
 *   • DocDate inside  rebate period → PATH A  (normal update)
 *   • DocDate outside rebate period → PATH B  (OOP row anchored to
 *                                              the customer's latest period)
 *
 * No other change is needed.
 */

const fetchSAPJournalEntries = async (customerCode, periodFrom, periodTo, pool) => {
  try {
    console.log(
      `📊 [SAP] Fetching JE / AR / AP for customer: ${customerCode}  ` +
      `period: ${periodFrom} → ${periodTo}`
    );

    const sapPool = getPool('VCP');
    if (!sapPool) {
      console.log('⚠️ [SAP] SAP database pool not available');
      return { success: false, entries: [] };
    }

    const startDate      = new Date(periodFrom);
    const programEndDate = new Date(periodTo);
    const today          = new Date();

    /*
     * KEY FIX: always extend the fetch window to today.
     * If the rebate program ended in February but an AR was posted in
     * April, we still retrieve it.  syncSAPDataToPayouts will classify
     * it as out-of-period and create the appropriate OOP row.
     */
    const endDate = today > programEndDate ? today : programEndDate;

    console.log(
      `📅 [SAP] Effective fetch window: ${startDate.toISOString().slice(0,10)} → ` +
      `${endDate.toISOString().slice(0,10)}` +
      (endDate > programEndDate ? '  ⚡ extended past program end to capture post-period entries' : '')
    );

    /* ----------------------------------------------------------------
     * PART 1 — Journal Entries
     * ----------------------------------------------------------------*/
    const jeQuery = `
      SELECT
        'JE'               AS SourceType,
        BP.ShortName       AS CardCode,
        OCRD.CardName,
        T0.RefDate         AS DocDate,
        T0.TransId         AS DocNum,
        NULL               AS BaseRef,
        T1.Account,
        T3.AcctName,
        T1.Debit,
        T1.Credit,
        T0.Memo,
        T1.LineMemo,
        T0.RefDate
      FROM OJDT T0
      INNER JOIN JDT1 T1 ON T0.TransId = T1.TransId
      INNER JOIN JDT1 BP ON T0.TransId = BP.TransId
        AND BP.ShortName IN (SELECT CardCode FROM OCRD)
      LEFT JOIN OCRD    ON BP.ShortName = OCRD.CardCode
      LEFT JOIN OACT T3 ON T1.Account  = T3.AcctCode
      WHERE
        BP.ShortName   = @customerCode
        AND T3.AcctName LIKE '%Rebate%'
        AND T0.RefDate >= @periodFrom
        AND T0.RefDate <= @endDate
    `;

    /* ----------------------------------------------------------------
     * PART 2 — AR Invoices
     * Uses @endDate (today or later) so April entries are fetched even
     * when the rebate program closed in February.
     * ----------------------------------------------------------------*/
    const arQuery = `
      SELECT
        'AR'                AS SourceType,
        AR_INV.CardCode,
        AR_INV.CardName,
        AR_INV.DocDate,
        AR_INV.DocNum,
        AR_JDT.BaseRef,
        AR_LN.Account,
        AR_ACCT.AcctName,
        AR_LN.Debit,
        AR_LN.Credit,
        AR_INV.Comments     AS Memo,
        NULL                AS LineMemo,
        AR_INV.DocDate      AS RefDate
      FROM OINV AR_INV
      LEFT JOIN OJDT AR_JDT
             ON AR_JDT.BaseRef = CAST(AR_INV.DocNum AS NVARCHAR)
      LEFT JOIN JDT1 AR_LN
             ON AR_LN.TransId  = AR_JDT.TransId
      LEFT JOIN OACT AR_ACCT
             ON AR_ACCT.AcctCode = AR_LN.Account
            AND AR_ACCT.AcctName LIKE '%Rebate%'
      WHERE
        AR_INV.CardCode   = @customerCode
        AND AR_ACCT.AcctName IS NOT NULL
        AND AR_INV.DocDate >= @periodFrom
        AND AR_INV.DocDate <= @endDate
    `;

    /* ----------------------------------------------------------------
     * PART 3 — AP Invoices
     * ----------------------------------------------------------------*/
    const apQuery = `
      SELECT
        'AP'            AS SourceType,
        T0.U_BP_Code    AS CardCode,
        T1.AcctCode,
        T0.DocDate,
        T1.LineTotal
      FROM OPCH T0
      LEFT JOIN PCH1 T1 ON T0.DocEntry = T1.DocEntry
      WHERE
        T1.AcctCode    = '611611'
        AND T0.U_BP_Code = @customerCode
        AND T0.DocDate  >= @periodFrom
        AND T0.DocDate  <= @endDate
    `;

    /* ----------------------------------------------------------------
     * PART 3b — AR Credit Memos
     * ----------------------------------------------------------------*/
    const arcmQuery = `
      SELECT
        'ARCM'        AS SourceType,
        T0.CardCode,
        T0.CardName,
        T0.DocDate,
        T0.DocNum,
        T0.DocEntry,
        T1.ItemCode,
        T1.GTotal
      FROM ORIN T0
      INNER JOIN RIN1 T1 ON T0.DocEntry = T1.DocEntry
      WHERE
        T0.CardCode  = @customerCode
        AND T1.ItemCode = 'NT-0018'
        AND T0.DocDate >= @periodFrom
        AND T0.DocDate <= @endDate
    `;

    /* ----------------------------------------------------------------
     * PART 3c — AP Credit Memos
     * ----------------------------------------------------------------*/
    const apcmQuery = `
      SELECT
        'APCM'          AS SourceType,
        T0.U_BP_Code    AS CardCode,
        T0.DocDate,
        T0.DocNum,
        T0.DocEntry,
        T1.GTotal
      FROM ORPC T0
      LEFT JOIN RPC1 T1 ON T0.DocEntry = T1.DocEntry
      WHERE
        T0.U_BP_Code  = @customerCode
        AND T0.DocDate >= @periodFrom
        AND T0.DocDate <= @endDate
    `;

    /* ----------------------------------------------------------------
     * PART 4 — Execute all five in parallel
     * All queries now use @endDate instead of @periodTo so post-period
     * entries (e.g. April AR for a Jan-Feb rebate) are included.
     * ----------------------------------------------------------------*/
    const [jeResult, arResult, apResult, arcmResult, apcmResult] = await Promise.all([
      sapPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom',   sql.Date,         startDate)
        .input('endDate',      sql.Date,         endDate)
        .query(jeQuery),
      sapPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom',   sql.Date,         startDate)
        .input('endDate',      sql.Date,         endDate)
        .query(arQuery),
      sapPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom',   sql.Date,         startDate)
        .input('endDate',      sql.Date,         endDate)
        .query(apQuery),
      sapPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom',   sql.Date,         startDate)
        .input('endDate',      sql.Date,         endDate)
        .query(arcmQuery),
      sapPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom',   sql.Date,         startDate)
        .input('endDate',      sql.Date,         endDate)
        .query(apcmQuery),
    ]);

    console.log(
      `📊 [SAP] Raw rows — JE: ${jeResult.recordset.length} | ` +
      `AR: ${arResult.recordset.length} | AP: ${apResult.recordset.length} | ` +
      `ARCM: ${arcmResult.recordset.length} | APCM: ${apcmResult.recordset.length}`
    );

    /* ----------------------------------------------------------------
     * PART 5 — Deduplicate and accumulate JE + AR rows
     * ----------------------------------------------------------------*/
    const MONTH_NAMES = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];

    const toPeriodMeta = (date) => {
      const d     = new Date(date);
      const year  = d.getFullYear();
      const month = d.getMonth() + 1;
      return {
        year,
        month,
        periodKey  : `${year}-${String(month).padStart(2, '0')}`,
        periodName : `${MONTH_NAMES[month - 1]} ${year}`,
      };
    };

    const makeBucket = ({ periodKey, periodName, year, month }) => ({
      periodKey,
      periodName,
      year,
      month,
      totalAmount     : 0,
      arcmDeduction   : 0,
      entries         : [],
      transactionIds  : new Set(),
      sourceBreakdown : { JE: 0, AR: 0, AP: 0, ARCM: 0, APCM: 0 },
    });

    const entriesByPeriod = {};
    const getOrCreateBucket = (key, meta) => {
      if (!entriesByPeriod[key]) entriesByPeriod[key] = makeBucket(meta);
      return entriesByPeriod[key];
    };

    const jeArRows    = [...jeResult.recordset, ...arResult.recordset];
    const lineDedupeMap = new Map();

    jeArRows.forEach(row => {
      const lineKey = row.SourceType === 'JE'
        ? `JE-${row.DocNum}-${row.Account}`
        : `AR-${row.DocNum}-${row.BaseRef ?? '0'}-${row.Account}`;

      if (lineDedupeMap.has(lineKey)) {
        console.log(`  🔄 Duplicate line skipped: ${lineKey}`);
        return;
      }
      lineDedupeMap.set(lineKey, true);

      const meta    = toPeriodMeta(row.DocDate);
      const bucket  = getOrCreateBucket(meta.periodKey, meta);
      const debit     = parseFloat(row.Debit)  || 0;
      const credit    = parseFloat(row.Credit) || 0;
      const netAmount = debit - credit;

      const txId = row.SourceType === 'JE'
        ? `JE-${row.DocNum}`
        : `AR-${row.DocNum}-${row.BaseRef ?? '0'}`;

      if (!bucket.transactionIds.has(txId)) {
        bucket.transactionIds.add(txId);
        bucket.totalAmount                    += netAmount;
        bucket.sourceBreakdown[row.SourceType] += netAmount;
      }

      bucket.entries.push({
        sourceType : row.SourceType,
        docNum     : row.DocNum,
        baseRef    : row.BaseRef    ?? null,
        docDate    : row.DocDate,
        account    : row.Account,
        acctName   : row.AcctName,
        debit,
        credit,
        netAmount,
        memo       : row.Memo || row.LineMemo || '',
        cardCode   : row.CardCode,
        cardName   : row.CardName,
      });
    });

    console.log(
      `📊 [SAP] After JE/AR dedup: ${Object.keys(entriesByPeriod).length} period(s), ` +
      `${lineDedupeMap.size} unique lines`
    );

    /* ----------------------------------------------------------------
     * PART 6 — AP
     * ----------------------------------------------------------------*/
    apResult.recordset.forEach(row => {
      const meta      = toPeriodMeta(row.DocDate);
      const bucket    = getOrCreateBucket(meta.periodKey, meta);
      const lineTotal = parseFloat(row.LineTotal) || 0;

      bucket.u_bp_code          = row.CardCode;
      bucket.totalAmount        += lineTotal;
      bucket.sourceBreakdown.AP += lineTotal;

      bucket.entries.push({
        sourceType : 'AP',
        docDate    : row.DocDate,
        acctCode   : row.AcctCode,
        lineTotal,
        netAmount  : lineTotal,
        cardCode   : row.CardCode,
        matchedBy  : 'U_BP_Code',
      });

      console.log(
        `  📄 [AP] ${meta.periodKey}: ₱${lineTotal.toFixed(2)} U_BP_Code=${row.CardCode}`
      );
    });

    /* ----------------------------------------------------------------
     * PART 6b — ARCM
     * ----------------------------------------------------------------*/
    arcmResult.recordset.forEach(row => {
      const meta         = toPeriodMeta(row.DocDate);
      const bucket       = getOrCreateBucket(meta.periodKey, meta);
      const deductAmount = Math.abs(parseFloat(row.GTotal) || 0);

      bucket.totalAmount          -= deductAmount;
      bucket.arcmDeduction        += deductAmount;
      bucket.sourceBreakdown.ARCM -= deductAmount;

      bucket.entries.push({
        sourceType  : 'ARCM',
        docNum      : row.DocNum,
        docEntry    : row.DocEntry,
        docDate     : row.DocDate,
        itemCode    : row.ItemCode,
        gTotal      : parseFloat(row.GTotal) || 0,
        netAmount   : -deductAmount,
        cardCode    : row.CardCode,
        cardName    : row.CardName,
        isDeduction : true,
      });

      console.log(
        `  📄 [ARCM] ${meta.periodKey}: −₱${deductAmount.toFixed(2)} ` +
        `(DocNum: ${row.DocNum}, Item: ${row.ItemCode})`
      );
    });

    /* ----------------------------------------------------------------
     * PART 6c — APCM
     * ----------------------------------------------------------------*/
    apcmResult.recordset.forEach(row => {
      const meta         = toPeriodMeta(row.DocDate);
      const bucket       = getOrCreateBucket(meta.periodKey, meta);
      const deductAmount = Math.abs(parseFloat(row.GTotal) || 0);

      bucket.u_bp_code            = row.CardCode;
      bucket.totalAmount          -= deductAmount;
      bucket.arcmDeduction        += deductAmount;
      bucket.sourceBreakdown.APCM -= deductAmount;

      bucket.entries.push({
        sourceType  : 'APCM',
        docNum      : row.DocNum,
        docEntry    : row.DocEntry,
        docDate     : row.DocDate,
        gTotal      : parseFloat(row.GTotal) || 0,
        netAmount   : -deductAmount,
        cardCode    : row.CardCode,
        matchedBy   : 'U_BP_Code',
        isDeduction : true,
      });

      console.log(
        `  📄 [APCM] ${meta.periodKey}: −₱${deductAmount.toFixed(2)} ` +
        `(DocNum: ${row.DocNum}, U_BP_Code: ${row.CardCode})`
      );
    });

    /* ----------------------------------------------------------------
     * PART 7 — Cross-customer JE lookup (triggered by AR results)
     * ----------------------------------------------------------------*/
    const relatedCustomerEntries = [];
    if (arResult.recordset.length > 0) {
      const arDocNums = [...new Set(arResult.recordset.map(r => r.DocNum))];
      if (arDocNums.length > 0) {
        const relatedJEQuery = `
          SELECT
            'JE'                AS SourceType,
            RJ_BP.ShortName     AS CardCode,
            RJ_CRD.CardName,
            RJ_HDR.RefDate      AS DocDate,
            RJ_HDR.TransId      AS DocNum,
            RJ_LN.BaseRef,
            RJ_LN.Account,
            RJ_ACCT.AcctName,
            RJ_LN.Debit,
            RJ_LN.Credit,
            RJ_HDR.Memo,
            RJ_LN.LineMemo,
            RJ_HDR.RefDate
          FROM OJDT RJ_HDR
          INNER JOIN JDT1 RJ_LN  ON RJ_LN.TransId   = RJ_HDR.TransId
          INNER JOIN JDT1 RJ_BP  ON RJ_BP.TransId    = RJ_HDR.TransId
                                AND RJ_BP.ShortName IN (SELECT CardCode FROM OCRD)
          LEFT JOIN OCRD  RJ_CRD ON RJ_CRD.CardCode  = RJ_BP.ShortName
          LEFT JOIN OACT  RJ_ACCT ON RJ_ACCT.AcctCode = RJ_LN.Account
                                 AND RJ_ACCT.AcctName LIKE '%Rebate%'
          WHERE
            RJ_LN.BaseRef   IN (${arDocNums.map((_, i) => `@docNum${i}`).join(',')})
            AND RJ_ACCT.AcctName IS NOT NULL
            AND RJ_BP.ShortName  != @customerCode
            AND RJ_HDR.RefDate   >= @periodFrom
            AND RJ_HDR.RefDate   <= @endDate
        `;

        const relatedRequest = sapPool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('periodFrom',   sql.Date,         startDate)
          .input('endDate',      sql.Date,         endDate);

        arDocNums.forEach((docNum, i) =>
          relatedRequest.input(`docNum${i}`, sql.NVarChar(50), String(docNum))
        );

        const relatedResult = await relatedRequest.query(relatedJEQuery);
        console.log(`📊 [SAP] Related-customer JE rows: ${relatedResult.recordset.length}`);

        relatedResult.recordset.forEach(row => {
          relatedCustomerEntries.push(row);
          const meta      = toPeriodMeta(row.DocDate);
          const bucketKey = `${meta.periodKey}-${row.CardCode}`;

          if (!entriesByPeriod[bucketKey]) {
            entriesByPeriod[bucketKey] = {
              ...makeBucket(meta),
              periodName          : `${meta.periodName} (${row.CardCode})`,
              cardCode            : row.CardCode,
              cardName            : row.CardName,
              isRelatedCustomer   : true,
              originalCustomerCode: customerCode,
              originalPeriodKey   : meta.periodKey,
            };
          }

          const bucket    = entriesByPeriod[bucketKey];
          const debit     = parseFloat(row.Debit)  || 0;
          const credit    = parseFloat(row.Credit) || 0;
          const netAmount = debit - credit;
          const txId      = `JE-${row.DocNum}`;

          if (!bucket.transactionIds.has(txId)) {
            bucket.transactionIds.add(txId);
            bucket.totalAmount        += netAmount;
            bucket.sourceBreakdown.JE += netAmount;
          }

          bucket.entries.push({
            sourceType    : 'JE',
            docNum        : row.DocNum,
            docDate       : row.DocDate,
            account       : row.Account,
            acctName      : row.AcctName,
            debit,
            credit,
            netAmount,
            memo          : row.Memo || row.LineMemo || '',
            cardCode      : row.CardCode,
            cardName      : row.CardName,
            isRelatedToAR : true,
            arDocNum      : row.BaseRef,
          });
        });
      }
    }

    /* ----------------------------------------------------------------
     * PART 8 — Serialise, sort, log summary
     * ----------------------------------------------------------------*/
    const resultArray = Object.values(entriesByPeriod)
      .map(({ transactionIds, ...rest }) => rest)
      .sort((a, b) =>
        a.year !== b.year ? a.year - b.year : a.month - b.month
      );

    console.log(`📊 [SAP] Final: ${resultArray.length} period bucket(s):`);
    resultArray.forEach(p => {
      const sb          = p.sourceBreakdown;
      const totalDeduct = Math.abs(sb.ARCM) + Math.abs(sb.APCM);
      // Flag periods that are outside the original program range
      const isPostPeriod = (p.year > programEndDate.getFullYear()) ||
        (p.year === programEndDate.getFullYear() && p.month > programEndDate.getMonth() + 1);

      console.log(
        `  ${p.periodKey}${p.cardCode ? ` (${p.cardCode})` : ''}` +
        `${isPostPeriod ? ' ⚡ POST-PERIOD' : ''}: ` +
        `Net ₱${p.totalAmount.toFixed(2)}  ` +
        `JE ₱${sb.JE.toFixed(2)}  AR ₱${sb.AR.toFixed(2)}  ` +
        `AP ₱${sb.AP.toFixed(2)}  ` +
        `ARCM −₱${Math.abs(sb.ARCM).toFixed(2)}  ` +
        `APCM −₱${Math.abs(sb.APCM).toFixed(2)}` +
        (totalDeduct > 0 ? `  ← ₱${totalDeduct.toFixed(2)} total reversed` : '')
      );
    });

    return {
      success   : true,
      entries   : resultArray,
      rawEntries: {
        je      : jeResult.recordset,
        ar      : arResult.recordset,
        ap      : apResult.recordset,
        arcm    : arcmResult.recordset,
        apcm    : apcmResult.recordset,
        related : relatedCustomerEntries,
      },
      summary: {
        totalJE      : jeResult.recordset.length,
        totalAR      : arResult.recordset.length,
        totalAP      : apResult.recordset.length,
        totalARCM    : arcmResult.recordset.length,
        totalAPCM    : apcmResult.recordset.length,
        totalRelated : relatedCustomerEntries.length,
        uniquePeriods: resultArray.length,
        fetchWindow  : {
          from          : startDate.toISOString().slice(0, 10),
          to            : endDate.toISOString().slice(0, 10),
          programEndDate: programEndDate.toISOString().slice(0, 10),
          extended      : endDate > programEndDate,
        },
      },
    };

  } catch (error) {
    console.error('❌ [SAP] Error fetching JE / AR / AP:', error);
    return { success: false, entries: [], error: error.message };
  }
};


/*===================================================================*/
/*  SYNC — write SAP totals back to PayoutHistory                    */
/*===================================================================*/
const syncSAPDataToPayouts = async (customerCode, rebateCode, sapEntries, pool) => {
  try {
    console.log(`🔄 [SYNC] Syncing SAP data for ${customerCode} — ${rebateCode}`);

    // ── 1. Rebate program dates ──────────────────────────────────────────────
    const programResult = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(`SELECT DateFrom, DateTo FROM RebateProgram WHERE RebateCode = @rebateCode`);

    let programFrom = null, programTo = null;
    if (programResult.recordset.length > 0) {
      const rec = programResult.recordset[0];
      if (rec.DateFrom) programFrom = new Date(rec.DateFrom);
      if (rec.DateTo)   programTo   = new Date(rec.DateTo);
    }
    console.log(
      `📅 [SYNC] Period: ${programFrom?.toISOString().split('T')[0] ?? 'n/a'} → ` +
      `${programTo?.toISOString().split('T')[0] ?? 'n/a'}`
    );

    const isInPeriod = (year, month) => {
      if (!programFrom || !programTo) return true;
      const first = new Date(year, month - 1, 1);
      const last  = new Date(year, month, 0);
      return last >= programFrom && first <= programTo;
    };

    // ── 2. Is this the LATEST rebate code for this customer? ────────────────
    //       "Latest" = no other rebate code with a NEWER DateFrom has
    //       PayoutHistory rows for this same customer.
    //       Only the latest rebate should absorb out-of-period SAP entries.
    const latestCheckResult = await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(`
        SELECT COUNT(*) AS NewerCount
        FROM RebateProgram rp
        INNER JOIN PayoutHistory ph
          ON ph.RebateCode = rp.RebateCode
         AND ph.CardCode   = @cc
        WHERE rp.DateFrom > ISNULL(
          (SELECT DateFrom FROM RebateProgram WHERE RebateCode = @rc),
          '1900-01-01'
        )
      `);
    const isLatestRebate =
      (parseInt(latestCheckResult.recordset[0]?.NewerCount) || 0) === 0;
    console.log(`📋 [SYNC] Is latest rebate for ${customerCode}: ${isLatestRebate}`);

    // ── 3. Clean up stale SAP-OOP rows (from the old behaviour) ─────────────
    await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(`
        DELETE FROM PayoutHistory
        WHERE CardCode   = @cc
          AND RebateCode = @rc
          AND PayoutId   LIKE 'SAP-%'
      `);

    // ── 4. Reset SapReleasedAmount + AmountReleased to 0 BEFORE syncing ─────
    //       This is the key fix for the accumulation bug:
    //       without resetting, every page load adds the OOP amount again.
    await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(`
        UPDATE PayoutHistory
        SET SapReleasedAmount = 0,
            AmountReleased    = 0,
            SapLastSync       = NULL,
            UpdatedDate       = GETDATE()
        WHERE CardCode   = @cc
          AND RebateCode = @rc
          AND PayoutId   NOT LIKE 'SAP-%'
      `);
    console.log(`🔄 [SYNC] Reset SapReleasedAmount to 0 for a clean sync`);

    // ── 5. Separate in-period vs out-of-period entries ───────────────────────
    const inPeriodMap = {}; // periodKey → accumulated SAP amount
    let totalOOP = 0;       // sum of all post-period (after programTo) entries

    for (const sapEntry of sapEntries) {
      if (sapEntry.isRelatedCustomer) continue;
      const { year, month, totalAmount, periodKey, periodName } = sapEntry;

      if (isInPeriod(year, month)) {
        // PATH A candidate — falls within the rebate date range
        if (!inPeriodMap[periodKey]) inPeriodMap[periodKey] = 0;
        inPeriodMap[periodKey] += totalAmount;
        console.log(`  📅 In-period  ${periodName}: ₱${totalAmount.toFixed(2)}`);

      } else if (isLatestRebate) {
        // Only the LATEST rebate absorbs out-of-period entries.
        // Entries dated BEFORE this rebate's start belong to an older
        // rebate code — skip them to prevent double-counting.
        const entryStart     = new Date(year, month - 1, 1);
        const isBeforePeriod = programFrom && entryStart < programFrom;

        if (!isBeforePeriod) {
          totalOOP += totalAmount;
          console.log(
            `  ⚡ OOP (after period)  ${periodName}: ₱${totalAmount.toFixed(2)} → will fold into latest row`
          );
        } else {
          console.log(
            `  ⏭️  Pre-period ${periodName}: ₱${totalAmount.toFixed(2)} → skip (belongs to older rebate)`
          );
        }

      } else {
        // Not the latest rebate AND entry is out-of-period — ignore.
        // The newer rebate's sync will handle it.
        console.log(
          `  ⏭️  OOP ${periodName}: ₱${totalAmount.toFixed(2)} → skip (not latest rebate, newer rebate exists)`
        );
      }
    }

    // ── 6. PATH A — update each in-period payout row ────────────────────────
    const MN = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
    let updatedCount = 0;

    for (const [periodKey, amount] of Object.entries(inPeriodMap)) {
      const [yearStr, monthStr] = periodKey.split('-');
      const year      = parseInt(yearStr);
      const month     = parseInt(monthStr);
      const monthName = MN[month - 1];
      const twoDigit  = String(year).slice(-2);

      const rows = await pool.request()
        .input('cc',    sql.NVarChar(50),  customerCode)
        .input('rc',    sql.NVarChar(50),  rebateCode)
        .input('exact', sql.NVarChar(100), `${monthName} ${year}`)
        .input('short', sql.NVarChar(100), `%${monthName.substring(0,3)} ${year}%`)
        .input('mpat',  sql.NVarChar(20),  `${month}.%.${twoDigit}`)
        .query(`
          SELECT Id, Period
          FROM PayoutHistory
          WHERE CardCode   = @cc
            AND RebateCode = @rc
            AND PayoutId   NOT LIKE 'SAP-%'
            AND (
              Period      = @exact
              OR Period   LIKE @short
              OR PayoutDate LIKE @mpat
            )
        `);

      for (const row of rows.recordset) {
        await pool.request()
          .input('sapAmount', sql.Decimal(18, 2), amount)
          .input('id',        sql.Int,            row.Id)
          .query(`
            UPDATE PayoutHistory SET
              AmountReleased    = @sapAmount,
              SapReleasedAmount = @sapAmount,
              SapLastSync       = GETDATE(),
              UpdatedDate       = GETDATE()
            WHERE Id = @id
          `);
        updatedCount++;
        console.log(`    ✅ PATH A: ${row.Period} → ₱${amount.toFixed(2)}`);
      }
    }

    // ── 7. PATH B — fold OOP into the latest existing payout row ────────────
    //       Only runs when:
    //         (a) there IS an out-of-period total, AND
    //         (b) this IS the latest rebate code for the customer.
    //       The latest row's SapReleasedAmount was already set by PATH A
    //       (or is 0 if that row had no in-period SAP entries).
    //       We add totalOOP on top — this is safe because we reset to 0
    //       at step 4, so there is no stale value to accumulate on.
    if (Math.abs(totalOOP) > 0.01 && isLatestRebate) {
      const latestResult = await pool.request()
        .input('cc', sql.NVarChar(50), customerCode)
        .input('rc', sql.NVarChar(50), rebateCode)
        .query(`
          SELECT TOP 1 Id, Period, SapReleasedAmount
          FROM PayoutHistory
          WHERE CardCode   = @cc
            AND RebateCode = @rc
            AND PayoutId   NOT LIKE 'SAP-%'
            AND Period     NOT LIKE 'Balance of %'
            AND Period     IS NOT NULL
            AND Period     != ''
          ORDER BY Id DESC
        `);

      if (latestResult.recordset.length > 0) {
        const latestRow   = latestResult.recordset[0];
        // SapReleasedAmount here is the in-period SAP set by PATH A (or 0).
        // Adding totalOOP gives the correct combined total.
        const inPeriodSap = parseFloat(latestRow.SapReleasedAmount) || 0;
        const combined    = inPeriodSap + totalOOP;

        await pool.request()
          .input('sapAmount', sql.Decimal(18, 2), combined)
          .input('id',        sql.Int,            latestRow.Id)
          .query(`
            UPDATE PayoutHistory SET
              AmountReleased    = @sapAmount,
              SapReleasedAmount = @sapAmount,
              SapLastSync       = GETDATE(),
              UpdatedDate       = GETDATE()
            WHERE Id = @id
          `);
        updatedCount++;
        console.log(
          `  ✅ PATH B: "${latestRow.Period}"` +
          `  in-period ₱${inPeriodSap.toFixed(2)}` +
          ` + OOP ₱${totalOOP.toFixed(2)}` +
          ` = ₱${combined.toFixed(2)}`
        );
      } else {
        console.log(`  ⚠️  PATH B: no existing payout row found — cannot anchor OOP amount`);
      }
    }

    console.log(`\n✅ [SYNC] Done — ${updatedCount} record(s) updated`);

  } catch (error) {
    console.error('❌ [SYNC] Error syncing SAP data:', error);
  }
};

/* ──────────────────────────────────────────────────────────────────

 *  1.  getAllRebateProgramsForCustomer
 *      Returns all rebate programs that have PayoutHistory rows
 *      for this customer AND belong to the same rebate type and
 *      frequency as the currently-viewed program.
 * ────────────────────────────────────────────────────────────────*/
export const getAllRebateProgramsForCustomer = async (
  customerCode,
  currentRebateCode,
  pool
) => {
  try {
    // Get the frequency / type of the current rebate so we only
    // look at sibling programs (same frequency = same "family").
    const metaResult = await pool.request()
      .input('rc', sql.NVarChar(50), currentRebateCode)
      .query(`
        SELECT RebateCode, RebateType, Frequency,
               DateFrom, DateTo, IsActive
        FROM RebateProgram
        WHERE RebateCode = @rc
      `);
 
    if (metaResult.recordset.length === 0) return [];
 
    const { RebateType, Frequency } = metaResult.recordset[0];
 
    // Find all rebate codes for this customer that share
    // the same type and frequency.
    const siblingsResult = await pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('rebateType',   sql.NVarChar(50), RebateType)
      .input('frequency',    sql.NVarChar(50), Frequency)
      .query(`
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo,
                        rp.IsActive,   rp.RebateType, rp.Frequency
        FROM RebateProgram rp
        WHERE rp.RebateType = @rebateType
          AND rp.Frequency  = @frequency
          AND EXISTS (
            SELECT 1 FROM PayoutHistory ph
            WHERE ph.CardCode   = @customerCode
              AND ph.RebateCode = rp.RebateCode
          )
        ORDER BY rp.DateFrom ASC
      `);
 
    return siblingsResult.recordset;
  } catch (err) {
    console.error('❌ [RESOLVER] getAllRebateProgramsForCustomer:', err.message);
    return [];
  }
};
 
/* ──────────────────────────────────────────────────────────────────
 *  2.  resolveDocDateToRebateProgram
 *      Pure function — no DB calls.
 *      Maps any DocDate to the best-fit rebate program from the
 *      provided sorted list.
 *
 *      Priority rules
 *      ──────────────
 *      1. Exact match  : DocDate ∈ [DateFrom, DateTo]
 *      2. Gap (between): assign to the program whose DateTo is
 *                        immediately before the DocDate (the most
 *                        recently-closed program).
 *      3. Before first : assign to the earliest program.
 *      4. After last   : assign to the latest program.
 * ────────────────────────────────────────────────────────────────*/
export const resolveDocDateToRebateProgram = (docDate, programs) => {
  if (!programs || programs.length === 0) return null;
 
  const date   = new Date(docDate);
  date.setHours(12, 0, 0, 0); // normalise to noon to avoid TZ edge cases
 
  // Sort ascending by DateFrom
  const sorted = [...programs].sort(
    (a, b) => new Date(a.DateFrom) - new Date(b.DateFrom)
  );
 
  // ── 1. Exact match ───────────────────────────────────────────
  for (const prog of sorted) {
    const from = new Date(prog.DateFrom);
    const to   = new Date(prog.DateTo);
    from.setHours(0,  0,  0,   0);
    to.setHours(23, 59, 59, 999);
    if (date >= from && date <= to) {
      return { ...prog, matchType: 'exact' };
    }
  }
 
  // ── 2. Before the first program ──────────────────────────────
  const firstFrom = new Date(sorted[0].DateFrom);
  firstFrom.setHours(0, 0, 0, 0);
  if (date < firstFrom) {
    return { ...sorted[0], matchType: 'before_first' };
  }
 
  // ── 3. After the last program ────────────────────────────────
  const lastTo = new Date(sorted[sorted.length - 1].DateTo);
  lastTo.setHours(23, 59, 59, 999);
  if (date > lastTo) {
    return { ...sorted[sorted.length - 1], matchType: 'after_last' };
  }
 
  // ── 4. Falls in a gap between two programs ───────────────────
  //       Assign to the program that ended most recently.
  for (let i = 0; i < sorted.length - 1; i++) {
    const curEnd   = new Date(sorted[i].DateTo);
    const nextStart = new Date(sorted[i + 1].DateFrom);
    curEnd.setHours(23, 59, 59, 999);
    nextStart.setHours(0, 0, 0, 0);
 
    if (date > curEnd && date < nextStart) {
      // Prefer the previous program (just ended) unless the next
      // program starts within 15 days — in that case prefer the
      // upcoming one (the employee likely meant it for the new cycle).
      const daysToNext = (nextStart - date) / (1000 * 60 * 60 * 24);
      const resolved   = daysToNext <= 15 ? sorted[i + 1] : sorted[i];
      return {
        ...resolved,
        matchType: daysToNext <= 15 ? 'gap_next' : 'gap_previous',
      };
    }
  }
 
  // Fallback
  return { ...sorted[sorted.length - 1], matchType: 'fallback' };
};
 
/* ──────────────────────────────────────────────────────────────────
 *  3.  fetchAllSAPTransactionsForCustomer
 *      Like fetchSAPJournalEntries but with NO date restriction.
 *      Returns raw rows grouped by source (je, ar, ap, arcm, apcm).
 *      The caller is responsible for deciding which rebate program
 *      each transaction belongs to.
 * ────────────────────────────────────────────────────────────────*/
export const fetchAllSAPTransactionsForCustomer = async (customerCode) => {
  try {
    const sapPool = getPool('VCP');
    if (!sapPool) {
      console.log('⚠️ [SAP-UNIVERSAL] SAP pool not available');
      return { success: false, rows: [] };
    }
 
    // ── JE ────────────────────────────────────────────────────
    const jeQuery = `
      SELECT 'JE' AS SourceType,
             BP.ShortName  AS CardCode, OCRD.CardName,
             T0.RefDate    AS DocDate,
             T0.TransId    AS DocNum,  NULL AS BaseRef,
             T1.Account,  T3.AcctName,
             T1.Debit,    T1.Credit,
             T0.Memo,     T1.LineMemo,
             T0.RefDate
      FROM OJDT T0
      INNER JOIN JDT1 T1 ON T0.TransId = T1.TransId
      INNER JOIN JDT1 BP ON T0.TransId = BP.TransId
        AND BP.ShortName IN (SELECT CardCode FROM OCRD)
      LEFT JOIN OCRD    ON BP.ShortName = OCRD.CardCode
      LEFT JOIN OACT T3 ON T1.Account  = T3.AcctCode
      WHERE BP.ShortName   = @customerCode
        AND T3.AcctName LIKE '%Rebate%'
    `;
 
    // ── AR ────────────────────────────────────────────────────
    const arQuery = `
      SELECT 'AR' AS SourceType,
             AR_INV.CardCode, AR_INV.CardName,
             AR_INV.DocDate,  AR_INV.DocNum,
             AR_JDT.BaseRef,  AR_LN.Account,
             AR_ACCT.AcctName,
             AR_LN.Debit,     AR_LN.Credit,
             AR_INV.Comments AS Memo, NULL AS LineMemo,
             AR_INV.DocDate  AS RefDate
      FROM OINV AR_INV
      LEFT JOIN OJDT AR_JDT ON AR_JDT.BaseRef = CAST(AR_INV.DocNum AS NVARCHAR)
      LEFT JOIN JDT1 AR_LN  ON AR_LN.TransId  = AR_JDT.TransId
      LEFT JOIN OACT AR_ACCT ON AR_ACCT.AcctCode = AR_LN.Account
                             AND AR_ACCT.AcctName LIKE '%Rebate%'
      WHERE AR_INV.CardCode = @customerCode
        AND AR_ACCT.AcctName IS NOT NULL
    `;
 
    // ── AP ────────────────────────────────────────────────────
    const apQuery = `
      SELECT 'AP' AS SourceType,
             T0.U_BP_Code AS CardCode,
             T1.AcctCode,
             T0.DocDate,  T1.LineTotal
      FROM OPCH T0
      LEFT JOIN PCH1 T1 ON T0.DocEntry = T1.DocEntry
      WHERE T1.AcctCode    = '611611'
        AND T0.U_BP_Code   = @customerCode
    `;
 
    // ── ARCM ──────────────────────────────────────────────────
    const arcmQuery = `
      SELECT 'ARCM' AS SourceType,
             T0.CardCode, T0.CardName,
             T0.DocDate,  T0.DocNum, T0.DocEntry,
             T1.ItemCode, T1.GTotal
      FROM ORIN T0
      INNER JOIN RIN1 T1 ON T0.DocEntry = T1.DocEntry
      WHERE T0.CardCode = @customerCode
        AND T1.ItemCode = 'NT-0018'
    `;
 
    // ── APCM ──────────────────────────────────────────────────
    const apcmQuery = `
      SELECT 'APCM' AS SourceType,
             T0.U_BP_Code AS CardCode,
             T0.DocDate,  T0.DocNum, T0.DocEntry,
             T1.GTotal
      FROM ORPC T0
      LEFT JOIN RPC1 T1 ON T0.DocEntry = T1.DocEntry
      WHERE T0.U_BP_Code = @customerCode
    `;
 
    const [jeR, arR, apR, arcmR, apcmR] = await Promise.all([
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode).query(jeQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode).query(arQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode).query(apQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode).query(arcmQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode).query(apcmQuery),
    ]);
 
    console.log(
      `📊 [SAP-UNIVERSAL] Raw rows — JE: ${jeR.recordset.length} | ` +
      `AR: ${arR.recordset.length} | AP: ${apR.recordset.length} | ` +
      `ARCM: ${arcmR.recordset.length} | APCM: ${apcmR.recordset.length}`
    );
 
    return {
      success : true,
      je      : jeR.recordset,
      ar      : arR.recordset,
      ap      : apR.recordset,
      arcm    : arcmR.recordset,
      apcm    : apcmR.recordset,
    };
  } catch (err) {
    console.error('❌ [SAP-UNIVERSAL] fetchAllSAPTransactionsForCustomer:', err.message);
    return { success: false, je: [], ar: [], ap: [], arcm: [], apcm: [] };
  }
};
 
/* ──────────────────────────────────────────────────────────────────
 *  4.  universalSyncSAPToAllRebates
 *      The main orchestrator.
 *
 *      Steps
 *      ─────
 *      a) Fetch ALL SAP rows for customer (no date filter).
 *      b) Get ALL rebate programs for customer (same type/freq).
 *      c) For each SAP transaction, resolve → best rebate program.
 *      d) Accumulate per-period totals for that rebate program.
 *      e) For each resolved (rebateCode, periodKey) pair:
 *         • If that rebateCode has a PayoutHistory row for the
 *           period → UPDATE AmountReleased / SapReleasedAmount.
 *         • If no row exists yet → create OOP row anchored to
 *           the last known period of that rebate code.
 *         • If an old OOP row (SAP-…) existed for a DIFFERENT
 *           rebateCode but now the resolver says this transaction
 *           belongs to currentRebateCode → delete the stale row.
 *
 *      Call this function INSTEAD OF (or just after) the regular
 *      syncSAPDataToPayouts when you want fully automatic
 *      cross-period / cross-rebate resolution.
 * ────────────────────────────────────────────────────────────────*/
export const universalSyncSAPToAllRebates = async (
  customerCode,
  currentRebateCode,
  pool
) => {
  try {
    console.log(
      `\n🌐 [UNIVERSAL-SYNC] Starting for ${customerCode} / ${currentRebateCode}`
    );
 
    // ── a) Fetch ALL SAP transactions ────────────────────────
    const allSAP = await fetchAllSAPTransactionsForCustomer(customerCode);
    if (!allSAP.success) {
      console.log('⚠️ [UNIVERSAL-SYNC] Could not fetch SAP transactions — aborting');
      return;
    }
 
    // ── b) Get ALL rebate programs for this customer ─────────
    const programs = await getAllRebateProgramsForCustomer(
      customerCode,
      currentRebateCode,
      pool
    );
 
    if (programs.length === 0) {
      console.log('⚠️ [UNIVERSAL-SYNC] No rebate programs found — aborting');
      return;
    }
 
    console.log(
      `📋 [UNIVERSAL-SYNC] ${programs.length} rebate program(s) in family:`,
      programs.map(p => `${p.RebateCode} (${p.DateFrom?.toISOString?.()?.slice(0,10)} → ${p.DateTo?.toISOString?.()?.slice(0,10)})`).join(' | ')
    );
 
    // ── c) Accumulate per-(rebateCode, periodKey) ─────────────
    // Structure: acc[rebateCode][periodKey] = { year, month, amount, deductions }
    const acc = {};
 
    const addToAcc = (rebateCode, docDate, netAmount) => {
      if (!rebateCode) return;
      const d     = new Date(docDate);
      const year  = d.getFullYear();
      const month = d.getMonth() + 1;
      const key   = `${year}-${String(month).padStart(2, '0')}`;
 
      if (!acc[rebateCode])       acc[rebateCode] = {};
      if (!acc[rebateCode][key])  acc[rebateCode][key] = { year, month, amount: 0, rowCount: 0 };
 
      acc[rebateCode][key].amount   += netAmount;
      acc[rebateCode][key].rowCount += 1;
    };
 
    // Helper: resolve + accumulate
    const resolveAndAdd = (docDate, netAmount) => {
      if (!docDate) return;
      const resolved = resolveDocDateToRebateProgram(docDate, programs);
      if (!resolved) return;
      console.log(
        `  → DocDate ${new Date(docDate).toISOString().slice(0,10)} ` +
        `(net ₱${netAmount.toFixed(2)}) → ${resolved.RebateCode} [${resolved.matchType}]`
      );
      addToAcc(resolved.RebateCode, docDate, netAmount);
    };
 
    // Line-level dedup (same logic as original)
    const lineDedup = new Set();
 
    // JE + AR
    [...allSAP.je, ...allSAP.ar].forEach(row => {
      const lineKey = row.SourceType === 'JE'
        ? `JE-${row.DocNum}-${row.Account}`
        : `AR-${row.DocNum}-${row.BaseRef ?? '0'}-${row.Account}`;
      if (lineDedup.has(lineKey)) return;
      lineDedup.add(lineKey);
      const net = (parseFloat(row.Debit) || 0) - (parseFloat(row.Credit) || 0);
      resolveAndAdd(row.DocDate, net);
    });
 
    // AP
    allSAP.ap.forEach(row => {
      resolveAndAdd(row.DocDate, parseFloat(row.LineTotal) || 0);
    });
 
    // ARCM — deductions (negative)
    allSAP.arcm.forEach(row => {
      resolveAndAdd(row.DocDate, -Math.abs(parseFloat(row.GTotal) || 0));
    });
 
    // APCM — deductions (negative)
    allSAP.apcm.forEach(row => {
      resolveAndAdd(row.DocDate, -Math.abs(parseFloat(row.GTotal) || 0));
    });
 
    console.log('\n📊 [UNIVERSAL-SYNC] Accumulated totals:');
    Object.entries(acc).forEach(([rc, periods]) => {
      Object.entries(periods).forEach(([pk, data]) => {
        console.log(`  ${rc} / ${pk}: ₱${data.amount.toFixed(2)} (${data.rowCount} rows)`);
      });
    });
 
    // ── d) Sync each (rebateCode, periodKey) into PayoutHistory ─
    const MONTH_NAMES_U = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
 
    let updatedCount = 0;
 
    for (const [rebateCode, periods] of Object.entries(acc)) {
      for (const [periodKey, data] of Object.entries(periods)) {
        const { year, month, amount } = data;
        const monthName  = MONTH_NAMES_U[month - 1];
        const twoDigit   = String(year).slice(-2);
        const periodName = `${monthName} ${year}`;
 
        // Look for an existing PayoutHistory row for this period
        const findResult = await pool.request()
          .input('cc',      sql.NVarChar(50),  customerCode)
          .input('rc',      sql.NVarChar(50),  rebateCode)
          .input('exact',   sql.NVarChar(100), periodName)
          .input('short',   sql.NVarChar(100), `%${monthName.substring(0,3)} ${year}%`)
          .input('mpat',    sql.NVarChar(20),  `${month}.%.${twoDigit}`)
          .query(`
            SELECT Id, PayoutId, Period, PayoutDate,
                   AmountReleased, SapReleasedAmount, TotalAmount, Status
            FROM PayoutHistory
            WHERE CardCode   = @cc
              AND RebateCode = @rc
              AND PayoutId   NOT LIKE 'SAP-%'
              AND Period     NOT LIKE 'Balance of %'
              AND (
                Period    = @exact
                OR Period LIKE @short
                OR PayoutDate LIKE @mpat
              )
          `);
 
        if (findResult.recordset.length > 0) {
          // ── Update existing row ────────────────────────────
          for (const row of findResult.recordset) {
            const prev = parseFloat(row.SapReleasedAmount) || 0;
            if (Math.abs(prev - amount) <= 0.01) {
              console.log(
                `  ℹ️  [UNIVERSAL-SYNC] No change: ${rebateCode}/${periodKey} ₱${prev.toFixed(2)}`
              );
              continue;
            }
            await pool.request()
              .input('sapAmt', sql.Decimal(18, 2), amount)
              .input('id',     sql.Int,            row.Id)
              .query(`
                UPDATE PayoutHistory SET
                  AmountReleased    = @sapAmt,
                  SapReleasedAmount = @sapAmt,
                  SapLastSync       = GETDATE(),
                  UpdatedDate       = GETDATE()
                WHERE Id = @id
              `);
            updatedCount++;
            console.log(
              `  ✅ [UNIVERSAL-SYNC] Updated ${rebateCode}/${row.Period}: ₱${amount.toFixed(2)}`
            );
          }
 
          // ── Remove stale OOP rows for the same period that
          //    belonged to a different rebate code ───────────
          await cleanupStaleOOPRows(
            customerCode, rebateCode, periodKey, year, month, pool
          );
 
        } else {
          // ── No in-period row found — create / update OOP ──
          await upsertOOPRow(
            customerCode, rebateCode, periodKey,
            year, month, monthName, twoDigit,
            amount, pool
          );
          updatedCount++;
        }
      }
    }
 
    console.log(`\n✅ [UNIVERSAL-SYNC] Done — ${updatedCount} record(s) updated\n`);
  } catch (err) {
    console.error('❌ [UNIVERSAL-SYNC] universalSyncSAPToAllRebates:', err);
  }
};
 
/* ──────────────────────────────────────────────────────────────────
 *  5.  cleanupStaleOOPRows
 *      When a transaction is now properly covered by a "real"
 *      PayoutHistory row (because a new rebate program was created),
 *      delete any SAP-… OOP rows for that same period in OTHER
 *      rebate codes — they are now redundant and misleading.
 * ────────────────────────────────────────────────────────────────*/
const cleanupStaleOOPRows = async (
  customerCode, resolvedRebateCode, periodKey, year, month, pool
) => {
  try {
    // Find OOP rows (PayoutId LIKE 'SAP-%') for this customer + period
    // that belong to a DIFFERENT rebate code than the resolved one.
    const oopPattern = `SAP-${customerCode}-%-%${periodKey}%`;
 
    const staleResult = await pool.request()
      .input('cc',   sql.NVarChar(50),  customerCode)
      .input('rc',   sql.NVarChar(50),  resolvedRebateCode)
      .input('pat',  sql.NVarChar(200), oopPattern)
      .query(`
        SELECT Id, PayoutId, RebateCode, Period
        FROM PayoutHistory
        WHERE CardCode   = @cc
          AND PayoutId   LIKE @pat
          AND RebateCode != @rc
      `);
 
    if (staleResult.recordset.length === 0) return;
 
    for (const row of staleResult.recordset) {
      await pool.request()
        .input('id', sql.Int, row.Id)
        .query(`DELETE FROM PayoutHistory WHERE Id = @id`);
      console.log(
        `  🗑️  [CLEANUP] Removed stale OOP row ${row.PayoutId} ` +
        `(rebate ${row.RebateCode} — now covered by ${resolvedRebateCode})`
      );
    }
  } catch (err) {
    console.error('❌ [CLEANUP] cleanupStaleOOPRows:', err.message);
  }
};
 
/* ──────────────────────────────────────────────────────────────────
 *  6.  upsertOOPRow
 *      Insert or update a SAP-… OOP row when no proper
 *      PayoutHistory period row exists yet for the resolved program.
 *      The OOP row is anchored to the LAST known period of the
 *      resolved rebate code (so it always shows up somewhere
 *      visible in the UI).
 * ────────────────────────────────────────────────────────────────*/
const upsertOOPRow = async (
  customerCode, rebateCode, periodKey,
  year, month, monthName, twoDigit,
  amount, pool
) => {
  try {
    // Find the last known period of the resolved rebate code
    const anchorResult = await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(`
        SELECT TOP 1 Period, PayoutDate
        FROM PayoutHistory
        WHERE CardCode   = @cc
          AND RebateCode = @rc
          AND PayoutId   NOT LIKE 'SAP-%'
          AND Period     NOT LIKE 'Balance of %'
          AND Period     IS NOT NULL AND Period != ''
        ORDER BY Id DESC
      `);
 
    const anchorPeriod  = anchorResult.recordset[0]?.Period    || `${monthName} ${year}`;
    const anchorPayDate = anchorResult.recordset[0]?.PayoutDate || null;
 
    const lastDay     = new Date(year, month, 0);
    const fallbackDate = `${lastDay.getMonth()+1}.${lastDay.getDate()}.${twoDigit}`;
    const displayDate  = anchorPayDate || fallbackDate;
 
    const isDeduct = amount < 0;
    const absAmt   = Math.abs(amount);
    const suffix   = isDeduct ? 'NEG' : 'POS';
    const oopId    = `SAP-${customerCode}-${rebateCode}-${periodKey}-${suffix}`;
 
    const existCheck = await pool.request()
      .input('PayoutId', sql.NVarChar(100), oopId)
      .query(`SELECT Id, SapReleasedAmount FROM PayoutHistory WHERE PayoutId = @PayoutId`);
 
    if (existCheck.recordset.length > 0) {
      const prev = parseFloat(existCheck.recordset[0].SapReleasedAmount) || 0;
      if (Math.abs(prev - amount) > 0.01) {
        await pool.request()
          .input('id',       sql.Int,            existCheck.recordset[0].Id)
          .input('sapAmt',   sql.Decimal(18, 2), amount)
          .input('released', sql.Decimal(18, 2), isDeduct ? 0 : absAmt)
          .input('total',    sql.Decimal(18, 2), isDeduct ? 0 : absAmt)
          .input('status',   sql.NVarChar(50),   isDeduct ? 'Deducted' : 'Paid')
          .query(`
            UPDATE PayoutHistory SET
              TotalAmount       = @total,
              AmountReleased    = @released,
              SapReleasedAmount = @sapAmt,
              Status            = @status,
              SapLastSync       = GETDATE(),
              UpdatedDate       = GETDATE()
            WHERE Id = @id
          `);
        console.log(
          `  ✅ [OOP-UPDATE] ${oopId}: ` +
          `${isDeduct ? '−' : '+'}₱${absAmt.toFixed(2)} ← anchored to "${anchorPeriod}"`
        );
      }
    } else {
      await pool.request()
        .input('PayoutId',   sql.NVarChar(100), oopId)
        .input('CardCode',   sql.NVarChar(50),  customerCode)
        .input('RebateCode', sql.NVarChar(50),  rebateCode)
        .input('RebateType', sql.NVarChar(50),  'SAP-OOP')
        .input('PayoutDate', sql.NVarChar(20),  displayDate)
        .input('Period',     sql.NVarChar(100), anchorPeriod)
        .input('BaseAmount', sql.Decimal(18, 2), 0)
        .input('Total',      sql.Decimal(18, 2), isDeduct ? 0 : absAmt)
        .input('Status',     sql.NVarChar(50),  isDeduct ? 'Deducted' : 'Paid')
        .input('Released',   sql.Decimal(18, 2), isDeduct ? 0 : absAmt)
        .input('SapAmt',     sql.Decimal(18, 2), amount)
        .input('Balance',    sql.Decimal(18, 2), 0)
        .query(`
          INSERT INTO PayoutHistory (
            PayoutId, CardCode, RebateCode, RebateType,
            PayoutDate, Period,
            BaseAmount, TotalAmount, Status,
            AmountReleased, SapReleasedAmount, SapLastSync, RebateBalance
          ) VALUES (
            @PayoutId, @CardCode, @RebateCode, @RebateType,
            @PayoutDate, @Period,
            @BaseAmount, @Total, @Status,
            @Released, @SapAmt, GETDATE(), @Balance
          )
        `);
      console.log(
        `  ✅ [OOP-INSERT] ${oopId}: ` +
        `${isDeduct ? '−' : '+'}₱${absAmt.toFixed(2)} ← anchored to "${anchorPeriod}"`
      );
    }
  } catch (err) {
    console.error('❌ [OOP-UPSERT] upsertOOPRow:', err.message);
  }
};
 
/* ──────────────────────────────────────────────────────────────────
 *  7.  HOW TO WIRE THIS INTO YOUR EXISTING ROUTE
 *
 *  In your GET /customer/:customerCode/payouts route handler,
 *  replace the existing syncSAPDataToPayouts call block with:
 *
 *    // SYNC: Resolve ALL SAP transactions across all rebate programs
 *    await universalSyncSAPToAllRebates(
 *      customerCode,
 *      rebateCode,
 *      ownPool
 *    );
 *
 *  You can keep the existing syncSAPDataToPayouts call as a
 *  supplementary fine-grained sync for the CURRENT period, but
 *  universalSyncSAPToAllRebates handles the cross-period cases.
 *
 *  ── OPTIONAL: Add a dedicated sync endpoint ─────────────────────
 *
 *  router.post('/customer/:customerCode/sync-sap-universal', async (req, res) => {
 *    const { customerCode } = req.params;
 *    const { db, rebateCode } = req.body;
 *    const pool = getPool(db || 'VCP_OWN');
 *    await universalSyncSAPToAllRebates(customerCode, rebateCode, pool);
 *    res.json({ success: true, message: 'Universal SAP sync complete' });
 *  });
 *
 *  ── What happens when a new rebate program is created in April ──
 *
 *  1.  Employee runs a sync (or it auto-runs on page load) for
 *      any rebate code in the family.
 *  2.  getAllRebateProgramsForCustomer() now returns April program.
 *  3.  resolveDocDateToRebateProgram() maps April DocDates to the
 *      April program (exact match).
 *  4.  cleanupStaleOOPRows() deletes the old OOP row that was
 *      sitting inside January's PayoutHistory.
 *  5.  upsertOOPRow() or a direct UPDATE places the amount inside
 *      the April program's correct period row.
 *  6.  January no longer shows any April transactions. ✅
 * ────────────────────────────────────────────────────────────────*/
export default router;