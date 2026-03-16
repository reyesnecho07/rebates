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
        `http://localhost:3006/api/vcp/dashboard/customer/${customerCode}/transactions?` +
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
    PayoutDate as Date,
    Period,
    BaseAmount,
    TotalAmount as Amount,
    TotalAmount,
    Status,
    AmountReleased,
    SapReleasedAmount,
    SapLastSync,
    ReleaseDate,
    RebateBalance as Balance,
    CreatedDate,
    UpdatedDate,
    0 AS IsBeginningBalance
  FROM PayoutHistory
  WHERE CardCode = @customerCode 
    AND RebateCode = @rebateCode
    AND Period NOT LIKE 'Balance of %'
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
        beginningBalances: [],           // ADD
        regularPayouts: finalPayouts,    // ADD
        previousBalance: previousBalance, // ADD
        beginningBalanceRecord: beginningBalanceRecord, // ADD
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
          SapReleasedAmount DECIMAL(18, 2) DEFAULT 0,  -- NEW: SAP released amount
          SapLastSync DATETIME,                          -- NEW: SAP last sync date
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
        -- Check if SAP columns exist, if not add them
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'SapReleasedAmount')
        BEGIN
          ALTER TABLE PayoutHistory ADD SapReleasedAmount DECIMAL(18, 2) DEFAULT 0;
        END
        
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'SapLastSync')
        BEGIN
          ALTER TABLE PayoutHistory ADD SapLastSync DATETIME;
        END
      END
    `;
    
    await pool.request().query(tableCheckQuery);
    console.log('✅ [VCP] PayoutHistory table created/verified with SAP columns');
    
  } catch (error) {
    console.error('❌ [VCP] Error creating/updating PayoutHistory table:', error);
  }
};

// Add this to payoutRoutes.js to debug table structure
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

    // Check table columns
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
  
  // Sort payouts by date (oldest first)
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
    // Use AmountReleased (manual) if greater than 0, otherwise use SapReleasedAmount
    const manualReleased = parseFloat(payout.AmountReleased || payout.amountReleased || 0);
    const sapReleased = parseFloat(payout.SapReleasedAmount || payout.sapReleasedAmount || 0);
    
    // Priority: Manual amount > SAP amount
    const amountReleased = manualReleased > 0 ? manualReleased : sapReleased;
    
    const isQtrRebate = payout.isQtrRebate || payout.type === 'quarterly';
    
    // For MONTHLY frequency, don't check eligibility - all months get calculated
    const isNonEligibleMonth = (frequency === 'Quarterly') ? 
      (payout.isNonEligibleMonth || 
       (!payout.eligible && !payout.quotaMet) ||
       (!payout.hasTransactions && baseAmount === 0)) : false;
    
    if (isQtrRebate) {
      // QTR rebate is independent (only for Quarterly frequency)
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
      // For non-eligible months in Quarterly frequency: Set all amounts to 0, DO NOT carry over balance
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
      // ELIGIBLE MONTH or MONTHLY FREQUENCY: Calculate with carry-over
      const totalAmount = baseAmount + previousBalance;
      const balance = Math.max(0, totalAmount - amountReleased);
      
      // Determine status
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
      
      // Create payout record with carry-over
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
      
      // Update previous balance for next period
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
    
    // Create a map of SAP amounts by period for easy lookup
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
    
    // Get rebate program period to generate ALL months
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
    
    // Generate ALL months in the period (keeping this for SAP mapping)
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
    
    // Get rebate values from database
    let baseRebatePerBag = 0;
    let qtrRebate = 0;
    
    // For Percentage rebates, we need to get item-specific percentages
    let itemPercentageMap = new Map(); // Map to store item-specific percentages
    
    if (rebateType === 'Percentage') {
      try {
        // Get all percentage values for items in this rebate program
        const percentageQuery = `
          SELECT ItemCode, PercentagePerBag
          FROM PerProdRebate
          WHERE RebateCode = @rebateCode
        `;
        
        const percentageResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(percentageQuery);

        // Build a map of item codes to their percentage values
        percentageResult.recordset.forEach(row => {
          if (row.ItemCode && row.PercentagePerBag) {
            itemPercentageMap.set(row.ItemCode, parseFloat(row.PercentagePerBag) || 0);
            console.log(`📊 Item ${row.ItemCode} has percentage: ${row.PercentagePerBag}%`);
          }
        });
        
        console.log(`📊 Loaded ${itemPercentageMap.size} item-specific percentages for rebate code ${rebateCode}`);
        
        // Get QTR rebate if frequency is Quarterly
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
        // Get Fixed rebate values
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
        
        // Get QTR rebate for Fixed
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
      } catch (error) {
        console.log('⚠️ Could not fetch Fixed rebate values:', error.message);
      }
    } else if (rebateType === 'Incremental') {
      // Keep existing incremental logic
      console.log('📊 Incremental rebate type - using existing logic');
    }

    // Group transactions by month and calculate amounts
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
              dailyTransactions: [],
              hasTransactions: true,
              itemBreakdown: new Map() // Track per-item calculations
            };
          }
          
          const actualSales = parseFloat(transaction.ActualSales) || 0;
          const priceAfVAT = parseFloat(transaction.PriceAfVAT) || 0;
          const itemCode = transaction.ItemCode || transaction.Item || '';
          const itemName = transaction.ItemName || transaction.Item || `Item_${index}`;
          
          // Calculate rebate based on type
          let dailyRebate = 0;
          let calculationNote = '';
          let percentageUsed = 0;
          
          if (rebateType === 'Percentage') {
            // CORRECT FORMULA: Get item-specific percentage from PerProdRebate table
            // Try to get percentage by ItemCode first, then by ItemName as fallback
            percentageUsed = 0;
            
            // Try to get by ItemCode
            if (itemCode && itemPercentageMap.has(itemCode)) {
              percentageUsed = itemPercentageMap.get(itemCode);
            } 
            // If not found by ItemCode, try to extract item code from item name or use default
            else {
              // You might want to add logic here to extract item code from item name
              // For now, use a default or skip
              console.log(`⚠️ No percentage found for item: ${itemCode || itemName}, using 0%`);
              percentageUsed = 0;
            }
            
            // Calculate: (Actual Sales × PriceAfVAT × Item Percentage%) / 100
            dailyRebate = (actualSales * priceAfVAT * percentageUsed) / 100;
            calculationNote = `(${actualSales} × ₱${priceAfVAT.toFixed(2)} × ${percentageUsed}%) / 100 = ₱${dailyRebate.toFixed(2)}`;
          } else if (rebateType === 'Fixed') {
            dailyRebate = actualSales * baseRebatePerBag;
            calculationNote = `${actualSales} × ₱${baseRebatePerBag.toFixed(2)} = ₱${dailyRebate.toFixed(2)}`;
          }
          
          // Check for 25kg adjustment
          const is25kgItem = transaction.Is25kgItem || 
            (itemName && itemName.toLowerCase().includes('25kg')) ||
            (transaction.Weight && transaction.Weight.toString().includes('25'));
          
          if (is25kgItem) {
            const originalRebate = dailyRebate;
            dailyRebate = dailyRebate / 2;
            calculationNote += ` → 25kg adjustment: ₱${originalRebate.toFixed(2)} ÷ 2 = ₱${dailyRebate.toFixed(2)}`;
          }
          
          // Store item-specific breakdown
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
          
          monthlyGroups[monthKey].totalBaseAmount += dailyRebate;
          monthlyGroups[monthKey].totalActualSales += actualSales;
          monthlyGroups[monthKey].totalPriceAfVAT += priceAfVAT;
          
        } catch (transError) {
          console.error(`❌ Error processing transaction ${index}:`, transError.message);
        }
      });
      
      console.log(`📊 Created ${Object.keys(monthlyGroups).length} month groups with transactions`);
    }

    // Calculate amounts for months WITH TRANSACTIONS ONLY
    const monthlyData = [];

    // Process only months that have transaction data (from monthlyGroups)
    for (const monthKey in monthlyGroups) {
      const monthWithData = monthlyGroups[monthKey];
      
      // Get SAP amount for this month from the sapAmountMap (KEEP SAP INTEGRATION)
      const sapForThisMonth = sapAmountMap[monthKey] || { amount: 0, entries: [] };
      const sapAmount = sapForThisMonth.amount || 0;
      
      let baseAmount = monthWithData.totalBaseAmount || 0;
      let totalActualSales = monthWithData.totalActualSales || 0;
      let totalPriceAfVAT = monthWithData.totalPriceAfVAT || 0;
      let status = baseAmount > 0 ? 'Pending' : 'No Payout';
      
      let calculationNote = '';
      let dailyCalculations = [];
      let itemCalculations = [];
      
      // Build calculation details
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
      
      // Create item breakdown summary
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
      
      // Create summary calculation note based on rebate type
      if (rebateType === 'Percentage') {
        calculationNote = `Percentage Rebate (${itemCalculations.length} items):\n`;
        itemCalculations.forEach(item => {
          calculationNote += `  ${item.itemName || item.itemCode}: ${item.actualSales} bags × ₱${totalPriceAfVAT > 0 ? (totalPriceAfVAT / totalActualSales).toFixed(2) : 0} × ${item.percentage}% = ₱${item.rebate.toFixed(2)}\n`;
        });
        calculationNote += `  Total: ₱${baseAmount.toFixed(2)}`;
      } else if (rebateType === 'Fixed') {
        calculationNote = `Fixed Rebate: Total Sales ${totalActualSales} × ₱${baseRebatePerBag.toFixed(2)} = ₱${baseAmount.toFixed(2)}`;
      }
      
      // Monthly amounts
      let totalAmount = baseAmount;
      let balance = totalAmount;
      
      // Create monthly record
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
        amountReleased: sapAmount, // KEEP: SAP amount for AmountReleased
        sapReleasedAmount: sapAmount, // KEEP: SAP amount for tracking
        sapEntries: sapForThisMonth.entries, // KEEP: SAP entries
        balance: parseFloat(balance.toFixed(2)),
        eligible: true,
        quotaMet: true,
        totalActualSales: totalActualSales,
        totalPriceAfVAT: totalPriceAfVAT,
        calculationNote: calculationNote,
        dailyCalculations: dailyCalculations,
        itemCalculations: itemCalculations,
        qtrRebate: qtrRebate,
        hasTransactions: true,
        transactionCount: monthWithData.dailyTransactions.length,
        isNonEligibleMonth: false,
        rebateType: rebateType,
        rebatePerBag: baseRebatePerBag,
        frequency: frequency
      };
      
      monthlyData.push(monthlyRecord);
      
      console.log(`📊 Month ${monthKey}: Added with ${monthWithData.dailyTransactions.length} daily transactions, Base: ₱${baseAmount.toFixed(2)}, SAP Released: ₱${sapAmount.toFixed(2)}`);
    }

    console.log(`📊 Processed ${monthlyData.length} months with transactions (months without transactions excluded from display)`);

    // Calculate quarter rebates if frequency is Quarterly
    const quarterlyData = [];
    
    if (frequency === 'Quarterly' && qtrRebate > 0) {
      console.log(`📊 Calculating quarter rebates (qtrRebate: ${qtrRebate})`);
      
      // Group monthly data by quarter
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
      
      // Check each quarter for completeness and add QTR rebate row if applicable
      Object.keys(quarters).forEach(quarterKey => {
        const quarter = quarters[quarterKey];
        
        // A quarter is complete if ALL 3 months in that quarter have transactions
        quarter.isComplete = quarter.eligibleMonths === 3 && quarter.totalMonths === 3;
        
        console.log(`📊 Quarter ${quarterKey}: ${quarter.eligibleMonths}/${quarter.totalMonths} months with transactions, Complete: ${quarter.isComplete}`);
        
        if (quarter.isComplete) {
          let qtrRebateAmount = 0;
          let calculationNote = '';
          
          if (rebateType === 'Percentage') {
            // For Percentage: totalBaseAmount × (qtrRebate / 100)
            qtrRebateAmount = quarter.totalBaseAmount * (qtrRebate / 100);
            calculationNote = `QTR Rebate: ₱${quarter.totalBaseAmount.toFixed(2)} × ${qtrRebate}% = ₱${qtrRebateAmount.toFixed(2)}`;
          } else {
            // For Fixed: totalBaseAmount × qtrRebate
            qtrRebateAmount = quarter.totalBaseAmount * qtrRebate;
            calculationNote = `QTR Rebate: ₱${quarter.totalBaseAmount.toFixed(2)} × ${qtrRebate} = ₱${qtrRebateAmount.toFixed(2)}`;
          }
          
          console.log(`📊 Adding QTR rebate for ${quarterKey}: ₱${qtrRebateAmount.toFixed(2)}`);
          
          // Add QTR rebate as separate row
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

    // Combine monthly and quarterly data
    const allData = [...monthlyData, ...quarterlyData];
    
    console.log(`✅ Completed payout calculation: ${monthlyData.length} monthly (with transactions), ${quarterlyData.length} quarterly`);
    console.log(`📊 [SAP] Applied SAP amounts to ${monthlyData.filter(m => m.sapReleasedAmount > 0).length} months`);
    
    // Debug log: Show detailed calculation for first month with transactions
    const firstMonthWithTransactions = monthlyData.find(m => m.hasTransactions);
    if (firstMonthWithTransactions) {
      console.log(`📊 Sample calculation for ${firstMonthWithTransactions.period}:`);
      console.log(`  Base Amount: ₱${firstMonthWithTransactions.baseAmount.toFixed(2)}`);
      console.log(`  SAP Released: ₱${firstMonthWithTransactions.sapReleasedAmount.toFixed(2)}`);
      console.log(`  Calculation: ${firstMonthWithTransactions.calculationNote}`);
      
      // Log item breakdown
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
    
    // Sort transactions by date to get the last one
    const sortedTransactions = [...transactions].sort((a, b) => {
      const dateA = a.Date ? new Date(a.Date) : new Date(0);
      const dateB = b.Date ? new Date(b.Date) : new Date(0);
      return dateB - dateA; // Descending - get latest first
    });
    
    // Get the last transaction's QtyBal
    const lastTransaction = sortedTransactions[0];
    
    // Try to get QtyBal from various possible field names
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
        // Find matching existing record using PayoutId
        const existing = existingData.find(record => 
          record.PayoutId === calculated.id
        );
        
        if (existing) {
          // Use existing values from database
          merged.push({
            Id: existing.Id, // Database ID
            PayoutId: existing.PayoutId || calculated.id,
            CardCode: existing.CardCode || calculated.cardCode,
            RebateCode: existing.RebateCode || calculated.rebateCode,
            RebateType: existing.RebateType || rebateType,
            Date: existing.Date || calculated.date,
            Period: existing.Period || calculated.period,
            BaseAmount: existing.BaseAmount || calculated.baseAmount || calculated.amount,
            TotalAmount: existing.TotalAmount || calculated.amount,
            Amount: existing.TotalAmount || calculated.amount, // For compatibility
            Status: existing.Status || calculated.status,
            AmountReleased: existing.AmountReleased || calculated.amountReleased || 0,
            SapReleasedAmount: existing.SapReleasedAmount || calculated.sapReleasedAmount || 0, // NEW: SAP amount
            SapLastSync: existing.SapLastSync || calculated.sapLastSync, // NEW: SAP sync date
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
            sapEntries: calculated.sapEntries || [] // NEW: SAP entries
          });
        } else {
          // Create new record structure with SAP data
          merged.push({
            Id: null, // Will be generated by database
            PayoutId: calculated.id,
            CardCode: calculated.cardCode,
            RebateCode: calculated.rebateCode,
            RebateType: rebateType,
            Date: calculated.date,
            Period: calculated.period,
            BaseAmount: calculated.baseAmount || calculated.amount,
            TotalAmount: calculated.amount, // Initially same as base
            Amount: calculated.amount, // For compatibility
            Status: calculated.status,
            AmountReleased: calculated.amountReleased || 0, // Will be overridden by SAP if available
            SapReleasedAmount: calculated.sapReleasedAmount || 0, // NEW: SAP amount
            SapLastSync: calculated.sapReleasedAmount ? new Date() : null, // NEW: Set sync date if SAP amount exists
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
            sapEntries: calculated.sapEntries || [] // NEW: SAP entries
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

// Calculate status based on eligibility and existing status - UPDATED
const calculateStatus = (existingStatus, isEligible, quotaMet = false, rebateType = 'Fixed') => {
  if (rebateType === 'Fixed') {
    // For Fixed rebates, use quotaMet to determine eligibility
    if (!quotaMet) {
      return 'No Payout';
    }
    
    // If quota is met but no existing status, default to Pending
    if (!existingStatus || existingStatus === 'No Payout') {
      return 'Pending';
    }
    
    // Keep existing status if already set
    return existingStatus;
  } else {
    // For Incremental rebates, use isEligible
    if (!isEligible) {
      return 'No Payout';
    }
    
    // If eligible but no existing status, default to Pending
    if (!existingStatus || existingStatus === 'No Payout') {
      return 'Pending';
    }
    
    // Keep existing status if already set
    return existingStatus;
  }
};

// Calculate balance
const calculateBalance = (amount, amountReleased) => {
  const balance = Math.max(0, amount - amountReleased);
  return parseFloat(balance.toFixed(2));
};

// Generate unique payout ID
const generatePayoutId = (customerCode, rebateCode) => {
  const cleanId = `PAY-${customerCode}-${rebateCode}`.replace(/[^a-zA-Z0-9-]/g, '');
  console.log(`🆔 Generated payout ID: ${cleanId}`);
  return cleanId;
};

const savePayoutsToDatabase = async (payouts, pool, frequency = 'Quarterly') => {
  try {
    console.log(`💾 Saving ${payouts.length} payout records to database`);
    
    // First, apply carry-over to ensure consistent calculations
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
        
        // Force status to 'No Payout' for months with 0 total amount
        const finalStatus = totalAmount === 0 ? 'No Payout' : status;
        
        // Check if record with this PayoutId already exists
        const checkQuery = `
          SELECT Id, PayoutId FROM PayoutHistory WHERE PayoutId = @PayoutId
        `;
        
        const checkResult = await pool.request()
          .input('PayoutId', sql.NVarChar(100), payout.PayoutId)
          .query(checkQuery);
        
        if (checkResult.recordset.length > 0) {
          // UPDATE existing record
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
          
          // Determine if we should update SAP sync date
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
          // INSERT new record
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
          
          // Determine if we should set SAP sync date
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
    
  } catch (error) {
    console.error('❌ Error in savePayoutsToDatabase:', error);
  }
};

// Backend: Update the router.put endpoint with correct balance calculation
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

    // Get current payout record by PayoutId
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
    
    // Parse and validate inputs
    const totalAmount = parseFloat(currentPayout.TotalAmount) || 0;
    let newAmountReleased = parseFloat(amountReleased) || 0;
    
    // Validate amount doesn't exceed total
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

    // Update payout in database using PayoutId
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

    // Now update all subsequent payouts' carry-over balances
    await updateSubsequentPayouts(cardCode, rebateCode, ownPool);

    // Return the updated data
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

// Function to update subsequent payouts when balance changes
const updateSubsequentPayouts = async (cardCode, rebateCode, pool) => {
  try {
    console.log(`🔄 Updating subsequent payouts for ${cardCode} - ${rebateCode}`);
    
    // Get all payouts for this customer sorted by date
    const getPayoutsQuery = `
      SELECT 
        Id,
        PayoutId,
        BaseAmount,
        TotalAmount,
        AmountReleased,
        RebateBalance,
        Status,
        PayoutDate
      FROM PayoutHistory
      WHERE CardCode = @cardCode 
        AND RebateCode = @rebateCode
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
    
    // Recalculate all payouts in order
    for (let i = 0; i < payouts.length; i++) {
      const payout = payouts[i];
      const baseAmount = parseFloat(payout.BaseAmount) || 0;
      const amountReleased = parseFloat(payout.AmountReleased) || 0;
      
      // Calculate new total amount (base + previous balance)
      const totalAmount = baseAmount + previousBalance;
      
      // Calculate new balance
      const balance = Math.max(0, totalAmount - amountReleased);
      
      // Determine status
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
      
      // Update payout in database
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
      
      // Update previous balance for next iteration
      previousBalance = balance;
    }
    
    console.log(`✅ Updated ${payouts.length} subsequent payouts`);
    
  } catch (error) {
    console.error('❌ Error updating subsequent payouts:', error);
  }
};

// Add this endpoint for updating amount released specifically
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

    // Get current payout record
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
    
    // Parse and validate amount released
    const newAmountReleased = parseFloat(amountReleased) || 0;
    const validatedAmountReleased = Math.min(Math.max(newAmountReleased, 0), totalAmount);
    
    // Calculate balance
    const newBalance = Math.max(0, totalAmount - validatedAmountReleased);
    
    // Determine status based on amounts
    let newStatus = currentPayout.Status;
    if (validatedAmountReleased === 0) {
      newStatus = totalAmount > 0 ? 'Pending' : 'No Payout';
    } else if (validatedAmountReleased >= totalAmount) {
      newStatus = 'Paid';
    } else if (validatedAmountReleased > 0) {
      newStatus = 'Partially Paid';
    }
    
    // Determine release date
    let releaseDate = currentPayout.ReleaseDate;
    if (validatedAmountReleased > 0 && (!releaseDate || releaseDate === null)) {
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

// Update the save endpoint (/api/payouts/save) 
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

    // Calculate values
    const amount = parseFloat(payoutData.Amount) || 0;
    const amountReleased = parseFloat(payoutData.AmountReleased) || 0;
    const balance = calculateBalance(amount, amountReleased);
    
    // Determine status based on amounts
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

    // Determine release date
    let releaseDate = null;
    if (amountReleased > 0) {
      releaseDate = new Date();
    }

    // Check if record exists using PayoutId
    const checkQuery = `
      SELECT Id FROM PayoutHistory WHERE PayoutId = @PayoutId
    `;
    
    const checkResult = await ownPool.request()
      .input('PayoutId', sql.NVarChar(100), payoutData.Id)
      .query(checkQuery);

    let queryResult;
    
    if (checkResult.recordset.length > 0) {
      // UPDATE existing record
    const updateQuery = `
      UPDATE PayoutHistory 
      SET 
        TotalAmount = @TotalAmount,
        Status = @Status,
        AmountReleased = @AmountReleased,
        ReleaseDate = @ReleaseDate,
        RebateBalance = @RebateBalance,
        RebateType = @RebateType, -- NEW: Update rebate type
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
      // INSERT new record
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

// Get detailed payout calculation for debugging
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

    // Parse month key
    const [year, month] = monthKey.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Get rebate type
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

    // Get transactions for this month from the dashboard endpoint
    let transactions = [];
    try {
      const transUrl = `http://localhost:3006/api/dashboard/customer/${customerCode}/transactions?` +
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

    // Calculate payout details
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

  // Process each transaction
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

  // Get QTR rebate
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
    // Check if quota is met
    const eligibleTransactions = transactions.filter(t => t.EligibilityStatus === 'Eligible');
    result.eligible = eligibleTransactions.length > 0;
    result.calculationSteps.push(`Eligible for Fixed rebate: ${result.eligible}`);
    
    if (result.eligible) {
      // Get rebate per bag
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

      // Calculate amount using ADJUSTED quantity
      result.amount = result.totalAdjustedQtyForReb * result.rebatePerBag;
      result.calculationSteps.push(`Base amount (using adjusted Qty): ${result.totalAdjustedQtyForReb.toFixed(2)} × ${result.rebatePerBag.toFixed(2)} = ${result.amount.toFixed(2)}`);
      
      if (result.qtrRebate > 0) {
        const originalAmount = result.amount;
        result.amount *= result.qtrRebate;
        result.calculationSteps.push(`With QTR: ${originalAmount.toFixed(2)} × ${result.qtrRebate.toFixed(2)} = ${result.amount.toFixed(2)}`);
      }
    }
  } else if (rebateType === 'Incremental') {
    // Check if in any range
    const eligibleTransactions = transactions.filter(t => 
      t.EligibilityStatus === 'Eligible' && t.CurrentRange
    );
    
    if (eligibleTransactions.length > 0) {
      // Get the highest range achieved
      const highestRange = Math.max(...eligibleTransactions.map(t => t.CurrentRange || 0));
      const highestTransaction = eligibleTransactions.find(t => t.CurrentRange === highestRange);
      
      result.eligible = true;
      result.rebatePerBag = parseFloat(highestTransaction?.RebatePerBag) || 0;
      result.calculationSteps.push(`Highest range achieved: ${highestRange}`);
      result.calculationSteps.push(`Rebate per bag for range ${highestRange}: ${result.rebatePerBag.toFixed(2)}`);

      // Calculate amount using ADJUSTED quantity
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
/*                            SAP JE                                 */
/*==================================================================*/


// Function to fetch SAP Journal Entry and AR Invoice data for a customer
const fetchSAPJournalEntries = async (customerCode, periodFrom, periodTo, pool) => {
  try {
    console.log(`📊 [SAP] Fetching journal entries and AR invoices for customer: ${customerCode}`);
    
    // Use SAP database pool
    const sapPool = getPool('VCP');
    
    if (!sapPool) {
      console.log('⚠️ [SAP] SAP database pool not available');
      return { success: false, entries: [] };
    }

    // Parse period dates
    const startDate = new Date(periodFrom);
    const endDate = new Date(periodTo);
    
    // ==================== PART 1: Get Journal Entries (JE) ====================
    const jeQuery = `
      SELECT 
        'JE' AS SourceType,
        BP.ShortName AS CardCode,
        OCRD.CardName,
        T0.RefDate AS DocDate,
        T0.TransId AS DocNum,
        NULL AS BaseRef,
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
      LEFT JOIN OCRD ON BP.ShortName = OCRD.CardCode
      LEFT JOIN OACT T3 ON T1.Account = T3.AcctCode
      WHERE 
        BP.ShortName = @customerCode
        AND T3.AcctName LIKE '%Rebate%'
        AND T0.RefDate >= @periodFrom
        AND T0.RefDate <= @periodTo
    `;

    // ==================== PART 2: Get AR Invoices (OINV) ====================
    const arQuery = `
      SELECT 
        'AR' AS SourceType,
        T0.CardCode,
        T0.CardName,
        T0.DocDate,
        T0.DocNum,
        T1.BaseRef,
        T3.Account,
        T4.AcctName,
        T3.Debit,
        T3.Credit,
        T0.Comments AS Memo,
        NULL AS LineMemo,
        T0.DocDate AS RefDate
      FROM OINV T0
      LEFT JOIN OJDT T1 ON T1.BaseRef = CAST(T0.DocNum AS NVARCHAR)
      LEFT JOIN JDT1 T3 ON T1.TransId = T3.TransId
      LEFT JOIN OACT T4 ON T3.Account = T4.AcctCode
      WHERE 
        T0.CardCode = @customerCode
        AND T4.AcctName LIKE '%Rebate%'
        AND T0.DocDate >= @periodFrom
        AND T0.DocDate <= @periodTo
    `;

    // ==================== PART 3: Execute both queries ====================
    const [jeResult, arResult] = await Promise.all([
      sapPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom', sql.Date, startDate)
        .input('periodTo', sql.Date, endDate)
        .query(jeQuery),
      sapPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('periodFrom', sql.Date, startDate)
        .input('periodTo', sql.Date, endDate)
        .query(arQuery)
    ]);

    console.log(`📊 [SAP] Found ${jeResult.recordset.length} journal entries and ${arResult.recordset.length} AR invoices for ${customerCode}`);

    // ==================== PART 4: Combine and deduplicate ====================
    const allEntries = [...jeResult.recordset, ...arResult.recordset];
    
    // Create a map to deduplicate based on Transaction ID and Document Number
    const dedupeMap = new Map();
    
    allEntries.forEach(entry => {
      // Create a unique key: Source + DocNum + Account (if available)
      // For JE: use TransId, for AR: use DocNum + BaseRef
      let uniqueKey;
      if (entry.SourceType === 'JE') {
        uniqueKey = `JE-${entry.DocNum}-${entry.Account}`;
      } else {
        uniqueKey = `AR-${entry.DocNum}-${entry.BaseRef || '0'}-${entry.Account}`;
      }
      
      // Only add if not already present (deduplication)
      if (!dedupeMap.has(uniqueKey)) {
        dedupeMap.set(uniqueKey, entry);
      } else {
        console.log(`  🔄 Duplicate entry skipped: ${uniqueKey}`);
      }
    });

    const uniqueEntries = Array.from(dedupeMap.values());
    console.log(`📊 [SAP] After deduplication: ${uniqueEntries.length} unique entries`);

    // ==================== PART 5: Group by period (month of document date) ====================
    const entriesByPeriod = {};
    
    uniqueEntries.forEach(entry => {
      const docDate = new Date(entry.DocDate);
      const year = docDate.getFullYear();
      const month = docDate.getMonth() + 1;
      
      // Create period key using the document date's month/year
      const periodKey = `${year}-${String(month).padStart(2, '0')}`;
      
      // Get month name for display
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const periodName = `${monthNames[month-1]} ${year}`;
      
      // Calculate net amount: Debits increase amount, Credits decrease amount
      const debit = parseFloat(entry.Debit) || 0;
      const credit = parseFloat(entry.Credit) || 0;
      const netAmount = debit - credit;
      
      if (!entriesByPeriod[periodKey]) {
        entriesByPeriod[periodKey] = {
          periodKey,
          periodName,
          year,
          month,
          totalAmount: 0,
          entries: [],
          transactionIds: new Set(),
          sourceBreakdown: {
            JE: 0,
            AR: 0
          }
        };
      }
      
      // Track amount by source type
      entriesByPeriod[periodKey].sourceBreakdown[entry.SourceType] = 
        (entriesByPeriod[periodKey].sourceBreakdown[entry.SourceType] || 0) + netAmount;
      
      // Create a transaction ID for deduplication within period
      const transId = entry.SourceType === 'JE' ? 
        `JE-${entry.DocNum}` : 
        `AR-${entry.DocNum}-${entry.BaseRef || '0'}`;
      
      if (!entriesByPeriod[periodKey].transactionIds.has(transId)) {
        entriesByPeriod[periodKey].totalAmount += netAmount;
        entriesByPeriod[periodKey].transactionIds.add(transId);
        
        entriesByPeriod[periodKey].entries.push({
          sourceType: entry.SourceType,
          docNum: entry.DocNum,
          baseRef: entry.BaseRef,
          docDate: entry.DocDate,
          account: entry.Account,
          acctName: entry.AcctName,
          debit: debit,
          credit: credit,
          netAmount: netAmount,
          memo: entry.Memo || entry.LineMemo || '',
          cardCode: entry.CardCode,
          cardName: entry.CardName
        });
      }
    });

    // ==================== PART 6: Handle cross-customer scenarios ====================
    // If AR and JE have different card codes, we need to track them separately
    // This requires additional query to find rebate entries for other customers
    
    // Check if we need to fetch data for related customers
    const relatedCustomerEntries = [];
    
    // Look for AR entries that might reference rebates for other customers
    if (arResult.recordset.length > 0) {
      // Get unique document numbers from AR results
      const arDocNums = [...new Set(arResult.recordset.map(r => r.DocNum))];
      
      if (arDocNums.length > 0) {
        // Query to find journal entries linked to these AR documents but with different card codes
        const relatedJEQuery = `
          SELECT 
            'JE' AS SourceType,
            BP.ShortName AS CardCode,
            OCRD.CardName,
            T0.RefDate AS DocDate,
            T0.TransId AS DocNum,
            T1.BaseRef,
            T3.Account,
            T4.AcctName,
            T3.Debit,
            T3.Credit,
            T0.Memo,
            T3.LineMemo,
            T0.RefDate
          FROM OJDT T0
          INNER JOIN JDT1 T1 ON T0.TransId = T1.TransId
          INNER JOIN JDT1 BP ON T0.TransId = BP.TransId
            AND BP.ShortName IN (SELECT CardCode FROM OCRD)
          LEFT JOIN OCRD ON BP.ShortName = OCRD.CardCode
          LEFT JOIN OACT T4 ON T1.Account = T4.AcctCode
          WHERE 
            T1.BaseRef IN (${arDocNums.map((_, i) => `@docNum${i}`).join(',')})
            AND T4.AcctName LIKE '%Rebate%'
            AND BP.ShortName != @customerCode
            AND T0.RefDate >= @periodFrom
            AND T0.RefDate <= @periodTo
        `;
        
        const relatedRequest = sapPool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('periodFrom', sql.Date, startDate)
          .input('periodTo', sql.Date, endDate);
        
        arDocNums.forEach((docNum, index) => {
          relatedRequest.input(`docNum${index}`, sql.NVarChar(50), docNum.toString());
        });
        
        const relatedResult = await relatedRequest.query(relatedJEQuery);
        
        console.log(`📊 [SAP] Found ${relatedResult.recordset.length} related journal entries for other customers`);
        
        // Add related entries to the mix
        relatedResult.recordset.forEach(entry => {
          relatedCustomerEntries.push(entry);
        });
      }
    }
    
    // Process related customer entries
    if (relatedCustomerEntries.length > 0) {
      console.log(`📊 [SAP] Processing ${relatedCustomerEntries.length} entries for related customers`);
      
      relatedCustomerEntries.forEach(entry => {
        const docDate = new Date(entry.DocDate);
        const year = docDate.getFullYear();
        const month = docDate.getMonth() + 1;
        const periodKey = `${year}-${String(month).padStart(2, '0')}`;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const periodName = `${monthNames[month-1]} ${year}`;
        
        const debit = parseFloat(entry.Debit) || 0;
        const credit = parseFloat(entry.Credit) || 0;
        const netAmount = debit - credit;
        
        // Create a separate entry for the related customer
        const relatedKey = `${periodKey}-${entry.CardCode}`;
        
        if (!entriesByPeriod[relatedKey]) {
          entriesByPeriod[relatedKey] = {
            periodKey: periodKey,
            originalPeriodKey: periodKey,
            periodName: `${periodName} (${entry.CardCode})`,
            year,
            month,
            cardCode: entry.CardCode,
            cardName: entry.CardName,
            totalAmount: 0,
            entries: [],
            transactionIds: new Set(),
            sourceBreakdown: {
              JE: 0,
              AR: 0
            },
            isRelatedCustomer: true,
            originalCustomerCode: customerCode
          };
        }
        
        const transId = `JE-${entry.DocNum}`;
        
        if (!entriesByPeriod[relatedKey].transactionIds.has(transId)) {
          entriesByPeriod[relatedKey].totalAmount += netAmount;
          entriesByPeriod[relatedKey].transactionIds.add(transId);
          entriesByPeriod[relatedKey].sourceBreakdown.JE += netAmount;
          
          entriesByPeriod[relatedKey].entries.push({
            sourceType: 'JE',
            docNum: entry.DocNum,
            docDate: entry.DocDate,
            account: entry.Account,
            acctName: entry.AcctName,
            debit: debit,
            credit: credit,
            netAmount: netAmount,
            memo: entry.Memo || entry.LineMemo || '',
            cardCode: entry.CardCode,
            cardName: entry.CardName,
            isRelatedToAR: true,
            arDocNum: entry.BaseRef
          });
        }
      });
    }

    // Convert to array and remove transactionIds before returning
    const resultArray = Object.entries(entriesByPeriod).map(([key, item]) => {
      const { transactionIds, ...rest } = item;
      return rest;
    });

    console.log(`📊 [SAP] Grouped into ${resultArray.length} periods:`);
    resultArray.forEach(period => {
      console.log(`  ${period.periodKey}${period.cardCode ? ` (${period.cardCode})` : ''}: Net Amount: ₱${period.totalAmount.toFixed(2)} (JE: ₱${period.sourceBreakdown.JE.toFixed(2)}, AR: ₱${period.sourceBreakdown.AR.toFixed(2)})`);
    });
    
    return {
      success: true,
      entries: resultArray,
      rawEntries: {
        je: jeResult.recordset,
        ar: arResult.recordset,
        related: relatedCustomerEntries
      },
      summary: {
        totalJE: jeResult.recordset.length,
        totalAR: arResult.recordset.length,
        totalRelated: relatedCustomerEntries.length,
        uniquePeriods: resultArray.length
      }
    };

  } catch (error) {
    console.error('❌ [SAP] Error fetching journal entries and AR invoices:', error);
    return { 
      success: false, 
      entries: [],
      error: error.message 
    };
  }
};

// Update the syncSAPDataToPayouts function to handle related customers
const syncSAPDataToPayouts = async (customerCode, rebateCode, sapEntries, pool) => {
  try {
    console.log(`🔄 [SYNC] Syncing SAP data for ${customerCode} - ${rebateCode}`);
    
    let updatedCount = 0;
    let relatedCustomerCount = 0;
    
    for (const sapEntry of sapEntries) {
      const { periodKey, totalAmount, year, month, periodName, cardCode, isRelatedCustomer, sourceBreakdown } = sapEntry;
      
      // Determine which customer code to use for matching
      const targetCustomerCode = isRelatedCustomer ? cardCode : customerCode;
      
      console.log(`  🔍 Looking for payout matching: ${periodName} for customer ${targetCustomerCode}`);
      
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[month-1];
      
      // Pattern 1: Exact month name + year (e.g., "February 2026")
      const exactMonthPattern = `${monthName} ${year}`;
      
      // Pattern 2: Short month name + year (e.g., "Feb 2026")
      const shortMonthName = monthName.substring(0, 3);
      const shortMonthPattern = `${shortMonthName} ${year}`;
      
      // Pattern 3: MM.YY format in Date column (e.g., "2.28.26" for Feb 2026)
      const twoDigitYear = year.toString().slice(-2);
      const datePattern = `%.${twoDigitYear}`;
      const monthNumberStr = String(month);
      const monthPatternForDate = `${monthNumberStr}.%.${twoDigitYear}`;
      
      // Query to find payouts for this specific month and customer
      const findPayoutQuery = `
        SELECT Id, PayoutId, Period, PayoutDate, AmountReleased, SapReleasedAmount, Status, TotalAmount, CardCode
        FROM PayoutHistory
        WHERE CardCode = @customerCode 
          AND RebateCode = @rebateCode
          AND (
            Period = @exactPeriod
            OR Period LIKE @shortPeriod
            OR (
              PayoutDate LIKE @datePattern 
              AND PayoutDate LIKE @monthPattern
            )
          )
      `;
      
      const result = await pool.request()
        .input('customerCode', sql.NVarChar(50), targetCustomerCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .input('exactPeriod', sql.NVarChar(100), exactMonthPattern)
        .input('shortPeriod', sql.NVarChar(100), `%${shortMonthPattern}%`)
        .input('datePattern', sql.NVarChar(20), `%${twoDigitYear}`)
        .input('monthPattern', sql.NVarChar(20), monthPatternForDate)
        .query(findPayoutQuery);
      
      if (result.recordset.length > 0) {
        console.log(`  ✅ Found ${result.recordset.length} payout(s) for ${periodName} (${targetCustomerCode})`);
        
        for (const payout of result.recordset) {
          const currentSapAmount = parseFloat(payout.SapReleasedAmount) || 0;
          const newSapAmount = parseFloat(totalAmount) || 0;
          
          if (Math.abs(currentSapAmount - newSapAmount) > 0.01) {
            // Update with source information
            const updateQuery = `
              UPDATE PayoutHistory 
              SET 
                AmountReleased = @sapAmount,
                SapReleasedAmount = @sapAmount,
                SapLastSync = GETDATE(),
                UpdatedDate = GETDATE()
              WHERE Id = @id
            `;
            
            await pool.request()
              .input('sapAmount', sql.Decimal(18, 2), newSapAmount)
              .input('id', sql.Int, payout.Id)
              .query(updateQuery);
            
            updatedCount++;
            if (isRelatedCustomer) {
              relatedCustomerCount++;
            }
            
            console.log(`    ✅ Updated ${payout.Period || payout.PayoutId}: AmountReleased set to ₱${newSapAmount.toFixed(2)} (Source: ${Object.keys(sourceBreakdown).filter(k => sourceBreakdown[k] !== 0).join('+')})`);
          } else {
            console.log(`    ℹ️  No change for ${payout.Period || payout.PayoutId}: already ₱${currentSapAmount.toFixed(2)}`);
          }
        }
      } else {
        console.log(`  ⚠️  No payout found for ${periodName} (${targetCustomerCode})`);
        
        // If this is a related customer and no payout exists, we might want to create one
        if (isRelatedCustomer) {
          console.log(`  📝 Consider creating a payout record for related customer ${targetCustomerCode}`);
          // You could add logic here to create a placeholder payout record
        }
      }
    }
    
    console.log(`✅ [SYNC] Updated ${updatedCount} payout records with SAP data (${relatedCustomerCount} from related customers)`);
    
  } catch (error) {
    console.error('❌ [SYNC] Error syncing SAP data:', error);
  }
};


export default router;