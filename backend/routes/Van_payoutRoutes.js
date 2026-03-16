// routes/Van_payoutRoutes.js
import express from 'express';
import sql from 'mssql';
import { getPool } from '../services/databaseService.js';

const router = express.Router();


const getNextQuarterInfo = (currentQuarter, currentYear) => {
  let nextQuarter, nextYear;
  
  if (currentQuarter === 1) {
    nextQuarter = 2;
    nextYear = currentYear;
  } else if (currentQuarter === 2) {
    nextQuarter = 3;
    nextYear = currentYear;
  } else if (currentQuarter === 3) {
    nextQuarter = 4;
    nextYear = currentYear;
  } else if (currentQuarter === 4) {
    nextQuarter = 1;
    nextYear = currentYear + 1;
  }
  
  return { 
    nextQuarter, 
    nextYear,
    period: `Balance of Q${nextQuarter} ${nextYear}`,
    payoutQuarter: `Q${nextQuarter} ${nextYear}`
  };
};


// Helper function to get quarter from date
const getQuarterFromDate = (date) => {
  const dateObj = new Date(date);
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();
  const quarter = Math.ceil(month / 3);
  return { quarter, year };
};


// New function to get carried forward beginning balances
const getCarriedForwardBeginningBalances = async (pool, customerCode, rebateType, startDate, endDate) => {
  try {
    console.log(`🔍 Getting carried forward beginning balances for ${customerCode}, ${rebateType}`);
    
    // Get all quarters in the date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Get quarter info for date range
    const startQuarterInfo = getQuarterFromDate(start);
    const endQuarterInfo = getQuarterFromDate(end);
    
    const quartersInRange = [];
    let currentYear = startQuarterInfo.year;
    let currentQuarter = startQuarterInfo.quarter;
    
    // Generate all quarters in range
    while (currentYear < endQuarterInfo.year || 
          (currentYear === endQuarterInfo.year && currentQuarter <= endQuarterInfo.quarter)) {
      quartersInRange.push({
        quarter: currentQuarter,
        year: currentYear,
        label: `Q${currentQuarter} ${currentYear}`
      });
      
      // Move to next quarter
      currentQuarter++;
      if (currentQuarter > 4) {
        currentQuarter = 1;
        currentYear++;
      }
      
      // Safety break
      if (quartersInRange.length > 20) break;
    }
    
    console.log(`📅 Quarters in range:`, quartersInRange.map(q => q.label));
    
    // Get all beginning balances for this customer and rebate type
    const begBalanceQuery = `
      SELECT 
        Id,
        PayoutId,
        CardCode,
        RebateCode,
        RebateType,
        Period,
        PayoutQuarter,
        TotalAmount as OriginalAmount,
        CreatedDate
      FROM PayoutHistory
      WHERE CardCode = @customerCode
        AND RebateType = @rebateType
        AND Period LIKE 'Balance of Q%'
      ORDER BY CreatedDate ASC
    `;
    
    const begBalanceResult = await pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('rebateType', sql.NVarChar(50), rebateType)
      .query(begBalanceQuery);
    
    const beginningBalances = begBalanceResult.recordset;
    console.log(`📊 Found ${beginningBalances.length} beginning balances in database`);
    
    // Check for regular payouts in each quarter to determine where to show beginning balances
    const carriedForwardBalances = [];
    
    for (const quarterInfo of quartersInRange) {
      // Check if there are regular payouts in this quarter
      const regularPayoutsQuery = `
        SELECT COUNT(*) as Count
        FROM PayoutHistory
        WHERE CardCode = @customerCode
          AND RebateType = @rebateType
          AND Period NOT LIKE 'Balance of Q%'
          AND PayoutQuarter = @payoutQuarter
      `;
      
      const regularPayoutsResult = await pool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateType', sql.NVarChar(50), rebateType)
        .input('payoutQuarter', sql.NVarChar(20), `Q${quarterInfo.quarter} ${quarterInfo.year}`)
        .query(regularPayoutsQuery);
      
      const hasRegularPayouts = regularPayoutsResult.recordset[0].Count > 0;
      
      // If this quarter has regular payouts, check if we need to add beginning balance
      if (hasRegularPayouts) {
        // Check if beginning balance already exists for this quarter
        const existingBegBalanceQuery = `
          SELECT COUNT(*) as Count
          FROM PayoutHistory
          WHERE CardCode = @customerCode
            AND RebateType = @rebateType
            AND Period = @period
        `;
        
        const targetPeriod = `Balance of Q${quarterInfo.quarter} ${quarterInfo.year}`;
        
        const existingBegBalanceResult = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateType', sql.NVarChar(50), rebateType)
          .input('period', sql.NVarChar(100), targetPeriod)
          .query(existingBegBalanceQuery);
        
        const begBalanceExists = existingBegBalanceResult.recordset[0].Count > 0;
        
        // If no beginning balance exists yet, check if we need to carry one forward
        if (!begBalanceExists && beginningBalances.length > 0) {
          // Find the most recent beginning balance that hasn't been applied yet
          const latestBalance = beginningBalances[beginningBalances.length - 1];
          
          // Extract quarter info from the balance period
          const match = latestBalance.Period.match(/Balance of Q(\d+) (\d+)/);
          if (match) {
            const balanceQuarter = parseInt(match[1]);
            const balanceYear = parseInt(match[2]);
            
            // Check if this balance is for a previous quarter
            if (balanceYear < quarterInfo.year || 
                (balanceYear === quarterInfo.year && balanceQuarter < quarterInfo.quarter)) {
              
              // Create a carried forward balance
              const carriedForwardBalance = {
                ...latestBalance,
                Id: null, // Will be generated
                PayoutId: `CF-${customerCode}-${rebateType}-Q${quarterInfo.quarter}-${quarterInfo.year}`,
                Period: targetPeriod,
                PayoutQuarter: `Q${quarterInfo.quarter} ${quarterInfo.year}`,
                Date: `${quarterInfo.quarter}.${quarterInfo.year.toString().slice(-2)}`,
                isCarriedForward: true,
                isBeginningBalance: true,
                originalPeriod: latestBalance.Period,
                originalPayoutQuarter: latestBalance.PayoutQuarter
              };
              
              carriedForwardBalances.push(carriedForwardBalance);
              console.log(`➡️ Carrying forward balance to ${targetPeriod}`);
            }
          }
        }
      }
    }
    
    console.log(`✅ Found ${carriedForwardBalances.length} balances to carry forward`);
    return carriedForwardBalances;
    
  } catch (error) {
    console.error('❌ Error getting carried forward balances:', error);
    return [];
  }
};



// routes/Van_payoutRoutes.js - Complete updated /customer/:customerCode/payouts endpoint

router.get('/customer/:customerCode/payouts', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode, rebateType, periodFrom, periodTo, useRebatePeriod } = req.query;
    
    console.log('💰 [VAN] Fetching payouts for customer:', {
      customerCode,
      rebateCode,
      rebateType,
      periodFrom,
      periodTo,
      useRebatePeriod
    });

    if (!customerCode || !rebateType) {
      return res.status(400).json({
        success: false,
        message: 'Customer code and rebate type are required'
      });
    }

    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Get rebate program period if rebateCode is provided
    let rebateDateFrom = '';
    let rebateDateTo = '';
    let isActive = false;
    
    if (rebateCode) {
      const rebatePeriodQuery = `
        SELECT DateFrom, DateTo, IsActive
        FROM RebateProgram
        WHERE RebateCode = @rebateCode
      `;

      const rebatePeriodResult = await ownPool.request()
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(rebatePeriodQuery);

      if (rebatePeriodResult.recordset.length > 0) {
        rebateDateFrom = rebatePeriodResult.recordset[0].DateFrom ? 
          new Date(rebatePeriodResult.recordset[0].DateFrom).toISOString().split('T')[0] : '';
        rebateDateTo = rebatePeriodResult.recordset[0].DateTo ? 
          new Date(rebatePeriodResult.recordset[0].DateTo).toISOString().split('T')[0] : '';
        isActive = rebatePeriodResult.recordset[0].IsActive === 1;
      }
    }

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

    console.log('📅 [VAN] Payout date range:', { startDate, endDate, dateSource });

    // First, get transaction data to calculate amounts
    let monthlyData = [];
    if (rebateCode && rebateType) {
      try {
        // Use internal dashboard endpoint for transactions
        const transactionsResponse = await fetch(
          `http://localhost:3006/api/van/dashboard/customer/${customerCode}/transactions?` +
          `db=${databaseToUse}&rebateCode=${rebateCode}&rebateType=${rebateType}&` +
          `periodFrom=${startDate}&periodTo=${endDate}&useRebatePeriod=${useRebatePeriod}`
        );
        
        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json();
          
          if (transactionsData.success && transactionsData.data.transactions) {
            console.log(`📊 [VAN] Found ${transactionsData.data.transactions.length} transactions for payout calculation`);
            
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

            const rebateProgramQuery = `
              SELECT DateFrom, DateTo, IsActive, Frequency
              FROM RebateProgram
              WHERE RebateCode = @rebateCode
            `;

            const rebateProgramResult = await ownPool.request()
              .input('rebateCode', sql.NVarChar(50), rebateCode)
              .query(rebateProgramQuery);

            let frequency = 'Quarterly';
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

            monthlyData = await calculateMonthlyPayoutData(
              transactionsData.data.transactions,
              rebateType,
              customerCode,
              rebateCode,
              ownPool,
              frequency,
              sapData.entries
            );

            await ensureSAPColumnsExist(ownPool);

            if (sapData.success && sapData.entries.length > 0) {
              console.log('🔄 [SYNC] Auto-syncing SAP data to database...');
              await syncSAPDataToPayouts(customerCode, rebateCode, sapData.entries, ownPool);
            }
            console.log(`📈 [VAN] Calculated ${monthlyData.length} monthly payout records`);
          } else {
            console.log('⚠️ [VAN] No transaction data found for payout calculation');
          }
        } else {
          console.log('⚠️ [VAN] Could not fetch transaction data for payouts');
        }
      } catch (transError) {
        console.error('❌ [VAN] Error fetching transactions for payouts:', transError.message);
      }
    }

    // Get existing payout records from PayoutHistory table (excluding beginning balances)
    let existingPayouts = [];
    try {
      await createPayoutHistoryTable(ownPool);
      
      let existingPayoutsQuery = `
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
          CreatedDate,
          UpdatedDate
        FROM PayoutHistory
        WHERE CardCode = @customerCode 
          AND RebateType = @rebateType
          AND Period NOT LIKE 'Balance of Q%'
      `;
      
      const request = ownPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateType', sql.NVarChar(50), rebateType);
      
      if (rebateCode) {
        existingPayoutsQuery += ` AND RebateCode = @rebateCode`;
        request.input('rebateCode', sql.NVarChar(50), rebateCode);
      }
      
      existingPayoutsQuery += ` ORDER BY PayoutDate ASC, CreatedDate ASC`;

      const existingPayoutsResult = await request.query(existingPayoutsQuery);
      existingPayouts = existingPayoutsResult.recordset;
      
      console.log(`📊 [VAN] Found ${existingPayouts.length} existing payout records`);
      
    } catch (tableError) {
      console.error('❌ [VAN] Error fetching existing payouts:', tableError.message);
    }

    // Merge calculated data with existing records
    const mergedPayouts = mergePayoutData(monthlyData, existingPayouts, rebateType);
    
    // Apply balance carry-over to merged payouts
    const payoutsWithCarryOver = applyBalanceCarryOverToPayouts(mergedPayouts);
    
    // Save/update payout records in database (excluding beginning balances)
    try {
      const payoutsToSave = payoutsWithCarryOver.filter(p => !p.Period?.includes('Balance of Q'));
      await savePayoutsToDatabase(payoutsToSave, ownPool);
    } catch (saveError) {
      console.error('❌ [VAN] Error saving payouts to database:', saveError.message);
    }

    // Get the final payouts from database after saving
    let finalPayouts = [];
    try {
      let finalPayoutsQuery = `
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
          CreatedDate,
          UpdatedDate
        FROM PayoutHistory
        WHERE CardCode = @customerCode
          AND RebateType = @rebateType
          AND Period NOT LIKE 'Balance of Q%'
      `;
      
      const finalRequest = ownPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateType', sql.NVarChar(50), rebateType);
      
      if (rebateCode) {
        finalPayoutsQuery += ` AND RebateCode = @rebateCode`;
        finalRequest.input('rebateCode', sql.NVarChar(50), rebateCode);
      }
      
      finalPayoutsQuery += ` ORDER BY PayoutDate ASC, CreatedDate ASC`;

      const finalPayoutsResult = await finalRequest.query(finalPayoutsQuery);
      finalPayouts = finalPayoutsResult.recordset;
      
      console.log(`📊 [VAN] Final regular payouts after save: ${finalPayouts.length} records`);
      
    } catch (error) {
      console.error('❌ [VAN] Error fetching final payouts:', error.message);
      finalPayouts = payoutsWithCarryOver;
    }

    // ============== FIXED: Get beginning balances filtered by the current transaction period ==============
    let beginningBalances = [];
    try {
      // Determine which quarter we're viewing based on the date range
      let targetPayoutQuarter = null;
      
      if (startDate && endDate) {
        // Get the start month to determine which quarter we're viewing
        const startDateObj = new Date(startDate);
        const startMonth = startDateObj.getMonth() + 1; // 1-12
        const startYear = startDateObj.getFullYear();
        
        // Determine the quarter we're viewing based on the start date
        // Jan-Mar = Q1, Apr-Jun = Q2, Jul-Sep = Q3, Oct-Dec = Q4
        const viewingQuarter = Math.ceil(startMonth / 3);
        
        // For the current quarter's transactions, we want the beginning balance for that same quarter
        // Example: When viewing Jan-Mar 2025 transactions, we want "Balance of Q1 2025"
        targetPayoutQuarter = `Q${viewingQuarter} ${startYear}`;
        
        console.log(`🎯 Viewing Q${viewingQuarter} ${startYear} transactions - looking for beginning balance: ${targetPayoutQuarter}`);
      }
      
      const begBalanceQuery = `
        SELECT 
          Id,
          PayoutId,
          CardCode,
          RebateCode,
          RebateType,
          PayoutDate as Date,
          Period,
          PayoutQuarter,
          BaseAmount,
          TotalAmount as Amount,
          Status,
          AmountReleased,
          ReleaseDate,
          RebateBalance as Balance,
          CreatedDate,
          UpdatedDate
        FROM PayoutHistory
        WHERE CardCode = @customerCode
          AND RebateType = @rebateType
          AND Period LIKE 'Balance of Q%'
          ${targetPayoutQuarter ? 'AND PayoutQuarter = @targetPayoutQuarter' : ''}
        ORDER BY PayoutQuarter ASC, CreatedDate ASC
      `;
      
      const begBalanceRequest = ownPool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateType', sql.NVarChar(50), rebateType);
        
      if (targetPayoutQuarter) {
        begBalanceRequest.input('targetPayoutQuarter', sql.NVarChar(20), targetPayoutQuarter);
      }
      
      const begBalanceResult = await begBalanceRequest.query(begBalanceQuery);
      beginningBalances = begBalanceResult.recordset;
      
      console.log(`📊 [VAN] Found ${beginningBalances.length} beginning balance for ${targetPayoutQuarter || 'all quarters'}`);
      
      // If no beginning balance found for this quarter, check if we need to create one from previous quarter
      if (beginningBalances.length === 0 && targetPayoutQuarter && rebateCode) {
        console.log(`⚠️ No beginning balance found for ${targetPayoutQuarter}, checking if we need to create one...`);
        
        // Parse the target quarter
        const [quarter, year] = targetPayoutQuarter.split(' ');
        const currentQuarter = parseInt(quarter.replace('Q', ''));
        
        // Determine previous quarter and year
        let prevQuarter, prevYear;
        if (currentQuarter === 1) {
          prevQuarter = 4;
          prevYear = parseInt(year) - 1;
        } else {
          prevQuarter = currentQuarter - 1;
          prevYear = parseInt(year);
        }
        
        // Calculate total balance from previous quarter
        const prevQuarterBalanceQuery = `
          SELECT 
            SUM(RebateBalance) as TotalBalance
          FROM PayoutHistory
          WHERE CardCode = @customerCode
            AND RebateType = @rebateType
            AND RebateCode = @rebateCode
            AND PayoutQuarter = @prevPayoutQuarter
            AND Period NOT LIKE 'Balance of Q%'
        `;
        
        const prevBalanceResult = await ownPool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateType', sql.NVarChar(50), rebateType)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .input('prevPayoutQuarter', sql.NVarChar(20), `Q${prevQuarter} ${prevYear}`)
          .query(prevQuarterBalanceQuery);
        
        const previousBalance = parseFloat(prevBalanceResult.recordset[0]?.TotalBalance || 0);
        
        if (previousBalance > 0) {
          console.log(`💰 Found previous quarter balance: ₱${previousBalance.toFixed(2)} from Q${prevQuarter} ${prevYear}`);
          
          // Create beginning balance for current quarter
          const payoutId = `BAL-${customerCode}-${rebateCode}-Q${currentQuarter}-${year}`;
          const beginningBalanceDate = new Date(parseInt(year), (currentQuarter - 1) * 3, 1);
          const formattedDate = `${beginningBalanceDate.getMonth() + 1}.${beginningBalanceDate.getDate()}.${beginningBalanceDate.getFullYear().toString().slice(-2)}`;
          
          const insertQuery = `
            INSERT INTO PayoutHistory (
              PayoutId,
              CardCode,
              RebateCode,
              RebateType,
              Period,
              PayoutQuarter,
              PayoutDate,
              BaseAmount,
              TotalAmount,
              AmountReleased,
              RebateBalance,
              Status,
              CreatedDate,
              UpdatedDate
            )
            VALUES (
              @PayoutId,
              @CardCode,
              @RebateCode,
              @RebateType,
              @Period,
              @PayoutQuarter,
              @PayoutDate,
              @BaseAmount,
              @TotalAmount,
              @AmountReleased,
              @RebateBalance,
              @Status,
              GETDATE(),
              GETDATE()
            )
          `;
          
          await ownPool.request()
            .input('PayoutId', sql.NVarChar(100), payoutId)
            .input('CardCode', sql.NVarChar(50), customerCode)
            .input('RebateCode', sql.NVarChar(50), rebateCode)
            .input('RebateType', sql.NVarChar(50), rebateType)
            .input('Period', sql.NVarChar(100), `Balance of Q${currentQuarter} ${year}`)
            .input('PayoutQuarter', sql.NVarChar(20), targetPayoutQuarter)
            .input('PayoutDate', sql.NVarChar(20), formattedDate)
            .input('BaseAmount', sql.Decimal(18, 2), 0)
            .input('TotalAmount', sql.Decimal(18, 2), previousBalance)
            .input('AmountReleased', sql.Decimal(18, 2), 0)
            .input('RebateBalance', sql.Decimal(18, 2), previousBalance)
            .input('Status', sql.NVarChar(50), 'Beginning Balance')
            .query(insertQuery);
          
          console.log(`✅ Created missing beginning balance: Balance of Q${currentQuarter} ${year} = ₱${previousBalance.toFixed(2)}`);
          
          // Fetch the newly created beginning balance
          const newBegBalanceResult = await ownPool.request()
            .input('customerCode', sql.NVarChar(50), customerCode)
            .input('rebateType', sql.NVarChar(50), rebateType)
            .input('targetPayoutQuarter', sql.NVarChar(20), targetPayoutQuarter)
            .query(`
              SELECT 
                Id,
                PayoutId,
                CardCode,
                RebateCode,
                RebateType,
                PayoutDate as Date,
                Period,
                PayoutQuarter,
                BaseAmount,
                TotalAmount as Amount,
                Status,
                AmountReleased,
                ReleaseDate,
                RebateBalance as Balance,
                CreatedDate,
                UpdatedDate
              FROM PayoutHistory
              WHERE CardCode = @customerCode
                AND RebateType = @rebateType
                AND PayoutQuarter = @targetPayoutQuarter
                AND Period LIKE 'Balance of Q%'
            `);
          
          beginningBalances = newBegBalanceResult.recordset;
        }
      }
      
    } catch (balanceError) {
      console.error('❌ Error fetching beginning balances:', balanceError.message);
    }

    // Combine regular payouts with beginning balances
    let combinedPayouts = combineWithCarryOver(finalPayouts, beginningBalances);

    // Filter payouts by date range
    if (periodFrom && periodTo) {
      const quartersInRange = new Set();
      const start = new Date(periodFrom);
      const end = new Date(periodTo);
      let current = new Date(start);

      while (current <= end) {
        const year = current.getFullYear();
        const month = current.getMonth() + 1;
        const quarter = Math.ceil(month / 3);
        quartersInRange.add(`Q${quarter} ${year}`);
        current.setMonth(current.getMonth() + 1);
      }

      combinedPayouts = combinedPayouts.filter(payout => {
        const payoutQuarter = payout.PayoutQuarter || payout.payoutQuarter;
        return payoutQuarter && quartersInRange.has(payoutQuarter);
      });

      console.log(`📅 Filtered payouts to ${combinedPayouts.length} records for quarters:`, Array.from(quartersInRange));
    }

    res.json({
      success: true,
      data: {
        payouts: combinedPayouts,
        beginningBalances: beginningBalances,
        regularPayouts: finalPayouts,
        customerCode: customerCode,
        rebateCode: rebateCode,
        rebateType: rebateType,
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
        }
      }
    });

  } catch (error) {
    console.error('❌ [VAN] Error fetching payouts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payout data',
      error: error.message,
      stack: error.stack
    });
  }
});

const getQuarterFromPayoutQuarter = (payoutQuarter) => {
  if (!payoutQuarter) return null;
  const match = payoutQuarter.match(/Q(\d+) (\d+)/);
  if (match) {
    return { quarter: parseInt(match[1]), year: parseInt(match[2]) };
  }
  return null;
};

const getQuartersInRange = (startDateStr, endDateStr) => {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const quarters = new Set();
  let current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    quarters.add(`Q${quarter} ${year}`);
    // move to next month
    current.setMonth(current.getMonth() + 1);
  }
  return quarters;
};

// Auto-sync SAP data to payout records - Match by month/year of the RefDate
const syncSAPDataToPayouts = async (customerCode, rebateCode, sapEntries, pool) => {
  try {
    console.log(`🔄 [SYNC] Syncing SAP data for ${customerCode} - ${rebateCode}`);
    
    let updatedCount = 0;
    
    for (const sapEntry of sapEntries) {
      const { periodKey, totalAmount, year, month, periodName } = sapEntry;
      
      console.log(`  🔍 Looking for payout matching: ${periodName} (${periodKey})`);
      
      // Find matching payout records for this specific month/year
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
      const monthNumberStr = String(month);
      const monthPatternForDate = `${monthNumberStr}.%.${twoDigitYear}`;
      
      // Query to find payouts for this specific month
      const findPayoutQuery = `
        SELECT Id, PayoutId, Period, PayoutDate, AmountReleased, SapReleasedAmount, Status, TotalAmount
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
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .input('exactPeriod', sql.NVarChar(100), exactMonthPattern)
        .input('shortPeriod', sql.NVarChar(100), `%${shortMonthPattern}%`)
        .input('datePattern', sql.NVarChar(20), `%${twoDigitYear}`)
        .input('monthPattern', sql.NVarChar(20), monthPatternForDate)
        .query(findPayoutQuery);
      
      if (result.recordset.length > 0) {
        console.log(`  ✅ Found ${result.recordset.length} payout(s) for ${periodName}`);
        
        for (const payout of result.recordset) {
          // Only update if SAP amount has changed
          const currentSapAmount = parseFloat(payout.SapReleasedAmount) || 0;
          const newSapAmount = parseFloat(totalAmount) || 0;
          
          if (Math.abs(currentSapAmount - newSapAmount) > 0.01) {
            // Update ONLY AmountReleased and SapLastSync fields
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
            console.log(`    ✅ Updated ${payout.Period || payout.PayoutId}: AmountReleased set to ₱${newSapAmount.toFixed(2)} (matches ${periodName})`);
          } else {
            console.log(`    ℹ️  No change for ${payout.Period || payout.PayoutId}: already ₱${currentSapAmount.toFixed(2)}`);
          }
        }
      } else {
        console.log(`  ⚠️  No payout found for ${periodName}`);
      }
    }
    
    console.log(`✅ [SYNC] Updated ${updatedCount} payout records with SAP data (matched by RefDate month)`);
    
  } catch (error) {
    console.error('❌ [SYNC] Error syncing SAP data:', error);
  }
};

// ========================================================
// NEW: Combine regular payouts with beginning balances and apply running balance
// ========================================================
const combineWithCarryOver = (regularPayouts, beginningBalances) => {
  // Combine all items
  const allItems = [...regularPayouts, ...beginningBalances];

  // Enrich each item with sorting metadata
  const enriched = allItems.map(item => {
    const isBegBalance = item.Period && item.Period.includes('Balance of Q');
    const isQtrRebate = item.Period && item.Period.includes('Quarter') && item.Period.includes('Rebate');

    let year, quarter, monthOrder = 99, typeOrder = 1;

    // Extract year and quarter from PayoutQuarter if available
    if (item.PayoutQuarter) {
      const match = item.PayoutQuarter.match(/Q(\d+) (\d+)/);
      if (match) {
        quarter = parseInt(match[1]);
        year = parseInt(match[2]);
      }
    }

    // Fallback: extract from Period
    if (!year || !quarter) {
      const yearMatch = item.Period.match(/\b(20\d{2})\b/);
      year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

      if (item.Period.includes('January') || item.Period.includes('February') || item.Period.includes('March')) quarter = 1;
      else if (item.Period.includes('April') || item.Period.includes('May') || item.Period.includes('June')) quarter = 2;
      else if (item.Period.includes('July') || item.Period.includes('August') || item.Period.includes('September')) quarter = 3;
      else if (item.Period.includes('October') || item.Period.includes('November') || item.Period.includes('December')) quarter = 4;
      else {
        const qMatch = item.Period.match(/Quarter (\d+)/i);
        quarter = qMatch ? parseInt(qMatch[1]) : 1;
      }
    }

    // Determine month order for monthly payouts
    if (!isBegBalance && !isQtrRebate) {
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      for (let i = 0; i < monthNames.length; i++) {
        if (item.Period.includes(monthNames[i])) {
          monthOrder = i + 1;
          break;
        }
      }
    }

    // Type order: 0 = beginning balance, 1 = monthly, 2 = quarter rebate
    if (isBegBalance) typeOrder = 0;
    else if (isQtrRebate) typeOrder = 2;

    return { ...item, year, quarter, monthOrder, typeOrder };
  });

  // Sort: by year, quarter, typeOrder (beg bal first), then monthOrder
  enriched.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.quarter !== b.quarter) return a.quarter - b.quarter;
    if (a.typeOrder !== b.typeOrder) return a.typeOrder - b.typeOrder;
    return a.monthOrder - b.monthOrder;
  });

  // Apply running balance
  const result = [];
  let runningBalance = 0;

  for (const item of enriched) {
    const isBegBalance = item.typeOrder === 0;
    const isQtrRebate = item.typeOrder === 2;

    const baseAmount = parseFloat(item.BaseAmount || item.baseAmount || 0);
    const amountReleased = parseFloat(item.AmountReleased || item.amountReleased || 0);

    let totalAmount;
    if (isBegBalance) {
      // Beginning balance: total = the balance itself
      totalAmount = parseFloat(item.TotalAmount || item.Balance || 0);
      runningBalance = totalAmount;
    } else {
      // Monthly or quarter rebate: total = base + previous balance
      totalAmount = baseAmount + runningBalance;
      runningBalance = totalAmount - amountReleased;
    }

    // Preserve original fields and add calculated totals
    result.push({
      ...item,
      TotalAmount: totalAmount,
      totalAmount: totalAmount,
      Balance: runningBalance,
      balance: runningBalance,
    });
  }

  return result;
};


// Add this endpoint to fetch beginning balances by quarter
router.get('/customer/:customerCode/beginning-balances', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode, quarter, year } = req.query;
    
    console.log('💰 [VAN] Fetching beginning balances for:', {
      customerCode,
      rebateCode,
      quarter,
      year
    });

    if (!customerCode) {
      return res.status(400).json({
        success: false,
        message: 'Customer code is required'
      });
    }

    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    const query = `
      SELECT 
        ph.*,
        'beginning_balance' as RecordType
      FROM PayoutHistory ph
      WHERE ph.CardCode = @customerCode
        AND ph.Period LIKE 'Balance of Q%'
        ${quarter && year ? 'AND ph.PayoutQuarter = @payoutQuarter' : ''}
        ${rebateCode ? 'AND ph.RebateCode = @rebateCode' : ''}
      ORDER BY ph.PayoutQuarter ASC, ph.CreatedDate ASC
    `;
    
    const request = ownPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode);
    
    if (quarter && year) {
      request.input('payoutQuarter', sql.NVarChar(20), `Q${quarter} ${year}`);
    }
    
    if (rebateCode) {
      request.input('rebateCode', sql.NVarChar(50), rebateCode);
    }
    
    const result = await request.query(query);
    
    // Group beginning balances by quarter
    const balancesByQuarter = {};
    result.recordset.forEach(balance => {
      const quarterKey = balance.PayoutQuarter || 'Unknown Quarter';
      if (!balancesByQuarter[quarterKey]) {
        balancesByQuarter[quarterKey] = [];
      }
      balancesByQuarter[quarterKey].push(balance);
    });
    
    res.json({
      success: true,
      data: {
        beginningBalances: result.recordset,
        balancesByQuarter: balancesByQuarter,
        customerCode: customerCode,
        rebateCode: rebateCode,
        totalCount: result.recordset.length
      }
    });

  } catch (error) {
    console.error('❌ [VAN] Error fetching beginning balances:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching beginning balance data',
      error: error.message
    });
  }
});



const calculateMonthlyPayoutData = async (transactions, rebateType, customerCode, rebateCode, pool) => {
  try {
    console.log(`📊 Starting payout calculation for ${customerCode}, ${rebateCode}, type: ${rebateType}`);
    
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
      
      allMonths.push({
        monthKey: monthKey,
        monthName: monthName,
        monthNumber: month + 1,
        year: year,
        quarter: quarter,
        payoutDate: payoutDate,
        period: `${monthName} ${year}`,
        totalActualSales: 0,
        totalQtyForReb: 0,
        totalAdjustedQtyForReb: 0,
        hasTransactions: false
      });
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Get percentage value from database for percentage rebates
    let percentageValue = 0;
    let qtrRebate = 0;
    
    if (rebateType === 'Percentage') {
      try {
        // Try to get percentage from PerProdRebate table
        const percentageQuery = `
          SELECT TOP 1 PercentagePerBag
          FROM PerProdRebate
          WHERE RebateCode = @rebateCode
        `;
        
        const percentageResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(percentageQuery);

        if (percentageResult.recordset.length > 0) {
          percentageValue = parseFloat(percentageResult.recordset[0].PercentagePerBag) || 0;
          console.log(`📊 Percentage found: ${percentageValue}%`);
        }
        
        // Get QTR rebate for percentage rebates
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
          console.log(`📊 QTR Rebate found: ${qtrRebate}`);
        }
      } catch (error) {
        console.log('⚠️ Could not fetch percentage value:', error.message);
      }
    } else {
      // For Fixed/Incremental, get QTR rebate
      try {
        let qtrRebateQuery;
        if (rebateType === 'Fixed') {
          qtrRebateQuery = `
            SELECT QtrRebate 
            FROM FixCustRebate 
            WHERE CardCode = @customerCode AND RebateCode = @rebateCode
          `;
        } else {
          qtrRebateQuery = `
            SELECT QtrRebate 
            FROM IncCustRebate 
            WHERE CardCode = @customerCode AND RebateCode = @rebateCode
          `;
        }

        const qtrRebateResult = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(qtrRebateQuery);

        if (qtrRebateResult.recordset.length > 0) {
          qtrRebate = parseFloat(qtrRebateResult.recordset[0].QtrRebate) || 0;
          console.log(`📊 QTR Rebate found: ${qtrRebate}`);
        }
      } catch (qtrError) {
        console.log('⚠️ Could not fetch QTR rebate:', qtrError.message);
      }
    }

    // Group transactions by month
    const monthlyGroups = {};
    
    if (Array.isArray(transactions) && transactions.length > 0) {
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
              totalActualSales: 0,
              totalQtyForReb: 0,
              totalAdjustedQtyForReb: 0,
              monthlyQuota: 0,
              eligible: false,
              status: 'No Payout',
              rebatePerBag: 0,
              baseAmount: 0,
              amount: 0,
              amountReleased: 0,
              balance: 0,
              quotaMet: false,
              transactions: [],
              qtrRebate: qtrRebate,
              percentageValue: percentageValue,
              hasTransactions: true
            };
          }
          
          // Check if this is a 25kg item
          const is25kgItem = transaction.Is25kgItem || 
            (transaction.Item && transaction.Item.toLowerCase().includes('25kg'));
          
          const actualSales = parseFloat(transaction.ActualSales) || 0;
          const qtyForReb = parseFloat(transaction.QtyForReb) || 0;
          
          // Calculate adjusted quantity (divide by 2 for 25kg items)
          const adjustedQtyForReb = is25kgItem ? qtyForReb / 2 : qtyForReb;
          
          monthlyGroups[monthKey].totalActualSales += actualSales;
          monthlyGroups[monthKey].totalQtyForReb += qtyForReb;
          monthlyGroups[monthKey].totalAdjustedQtyForReb += adjustedQtyForReb;
          
          monthlyGroups[monthKey].transactions.push({
            ...transaction,
            is25kgItem: is25kgItem,
            actualSales: actualSales,
            qtyForReb: qtyForReb,
            adjustedQtyForReb: adjustedQtyForReb
          });
          
        } catch (transError) {
          console.error(`❌ Error processing transaction ${index}:`, transError.message);
        }
      });
    }
    
    // Get rebate per bag from database for Fixed/Incremental
    let baseRebatePerBag = 0;
    if (rebateType === 'Fixed') {
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
          baseRebatePerBag = parseFloat(rebateResult.recordset[0].RebatePerBag) || 0;
          console.log(`📊 Fixed Rebate per bag: ${baseRebatePerBag}`);
        }
      } catch (rebateError) {
        console.log('⚠️ Could not fetch rebate per bag:', rebateError.message);
      }
    } else if (rebateType === 'Incremental') {
      try {
        const rebateQuery = `
          SELECT TOP 1 RebatePerBag
          FROM IncCustRange
          WHERE RebateCode = @rebateCode
          ORDER BY RangeNo
        `;
        
        const rebateResult = await pool.request()
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(rebateQuery);

        if (rebateResult.recordset.length > 0) {
          baseRebatePerBag = parseFloat(rebateResult.recordset[0].RebatePerBag) || 0;
          console.log(`📊 Incremental Rebate per bag: ${baseRebatePerBag}`);
        }
      } catch (rebateError) {
        console.log('⚠️ Could not fetch rebate per bag:', rebateError.message);
      }
    }

    // Get customer quotas for Fixed and Percentage rebates
    let customerQuotas = [];
    if (rebateType === 'Fixed' || rebateType === 'Percentage') {
      try {
        let quotaQuery;
        
        if (rebateType === 'Fixed') {
          quotaQuery = `
            SELECT T2.Month, T2.TargetQty
            FROM FixCustRebate T1
            INNER JOIN FixCustQuota T2 ON T1.Id = T2.CustRebateId
            WHERE T1.CardCode = @customerCode AND T1.RebateCode = @rebateCode
          `;
        } else {
          quotaQuery = `
            SELECT T2.Month, T2.TargetQty
            FROM PerCustRebate T1
            INNER JOIN PerCustQuota T2 ON T1.Id = T2.PerCustRebateId
            WHERE T1.CardCode = @customerCode AND T1.RebateCode = @rebateCode
          `;
        }
        
        const quotaResult = await pool.request()
          .input('customerCode', sql.NVarChar(50), customerCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(quotaQuery);

        console.log(`📊 Quota query result:`, {
          rowCount: quotaResult.recordset.length,
          sampleRows: quotaResult.recordset.slice(0, 3)
        });

        // Store quotas by month name
        quotaResult.recordset.forEach(row => {
          if (row.Month && row.TargetQty !== null) {
            customerQuotas[row.Month] = row.TargetQty;
          }
        });
        
        console.log(`📊 Customer quotas found for ${customerCode}:`, customerQuotas);
        
      } catch (quotaError) {
        console.log('⚠️ Could not fetch customer quotas:', quotaError.message);
      }
    }

    // NEW: Fetch SAP journal entries for released amounts
    let sapJournalEntries = [];
    try {
      const sapJournalQuery = `
        SELECT 
          PayoutId,
          CardCode,
          RebateCode,
          Period,
          Amount as ReleasedAmount,
          JournalRemarks,
          CreatedDate as JournalDate,
          Status as JournalStatus
        FROM SAPJournalEntries 
        WHERE CardCode = @customerCode 
          AND RebateCode = @rebateCode
          AND Status = 'Posted'
      `;
      
      const sapResult = await pool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(sapJournalQuery);

      if (sapResult.recordset.length > 0) {
        sapJournalEntries = sapResult.recordset.map(entry => ({
          payoutId: entry.PayoutId,
          cardCode: entry.CardCode,
          rebateCode: entry.RebateCode,
          period: entry.Period,
          releasedAmount: parseFloat(entry.ReleasedAmount) || 0,
          journalRemarks: entry.JournalRemarks,
          journalDate: entry.JournalDate,
          journalStatus: entry.JournalStatus
        }));
        console.log(`📊 Found ${sapJournalEntries.length} SAP journal entries for released amounts`);
      }
    } catch (sapError) {
      console.log('⚠️ Could not fetch SAP journal entries:', sapError.message);
    }

    // Calculate amounts for months WITH TRANSACTIONS ONLY
    const monthlyData = [];

    // Process only months that have transaction data (from monthlyGroups)
    for (const monthKey in monthlyGroups) {
      const monthWithData = monthlyGroups[monthKey];
      const monthInfo = allMonths.find(m => m.monthKey === monthKey) || {
        monthKey: monthKey,
        monthName: monthWithData.monthName,
        monthNumber: monthWithData.monthNumber,
        year: monthWithData.year,
        quarter: monthWithData.quarter,
        payoutDate: monthWithData.payoutDate,
        period: monthWithData.period
      };
      
      let baseAmount = 0;
      let quotaMet = false;
      let eligible = false;
      let status = 'No Payout';
      let totalActualSales = monthWithData.totalActualSales;
      let totalQtyForReb = monthWithData.totalQtyForReb;
      let totalAdjustedQtyForReb = monthWithData.totalAdjustedQtyForReb;
      let rebatePerBag = baseRebatePerBag;
      let monthPercentageValue = percentageValue;
      let calculationNote = '';
      
      // Generate payout ID for this month
      const payoutId = generatePayoutId(customerCode, rebateCode, monthKey);
      
      // Check for SAP released amount
      const sapEntry = sapJournalEntries.find(entry => 
        entry.payoutId === payoutId || entry.period === monthInfo.period
      );
      
      const releasedAmount = sapEntry ? sapEntry.releasedAmount : 0;
      
      if (rebateType === 'Fixed') {
        // Get target quota for this specific month
        const targetQuota = customerQuotas[monthInfo.monthName] || 0;
        
        if (targetQuota > 0 && totalQtyForReb > 0) {
          quotaMet = totalQtyForReb >= targetQuota;
          
          if (quotaMet) {
            // MONTHLY FIXED REBATE CALCULATION:
            baseAmount = totalAdjustedQtyForReb * baseRebatePerBag;
            
            status = sapEntry ? 'Released' : 'Pending';
            eligible = true;
            
            calculationNote = `Adjusted Qty: ${totalAdjustedQtyForReb.toFixed(2)} × ${baseRebatePerBag} = ₱${baseAmount.toFixed(2)}`;
            
            console.log(`📊 MONTHLY FIXED REBATE CALCULATION for ${monthKey}:`, {
              totalQtyForReb: totalQtyForReb,
              totalAdjustedQtyForReb: totalAdjustedQtyForReb,
              rebatePerBag: baseRebatePerBag,
              baseAmount: baseAmount,
              formula: `MONTHLY: Adjusted Qty ${totalAdjustedQtyForReb.toFixed(2)} × ${baseRebatePerBag} = ₱${baseAmount.toFixed(2)}`,
              targetQuota: targetQuota,
              quotaMet: quotaMet,
              monthName: monthInfo.monthName,
              calculationNote: calculationNote,
              releasedAmount: releasedAmount,
              status: status
            });
          } else {
            calculationNote = `Quota not met: ${totalQtyForReb.toFixed(2)} < ${targetQuota}`;
          }
        } else {
          calculationNote = `No quota or transactions`;
        }
      } else if (rebateType === 'Percentage') {
        // Get target quota for this specific month
        const targetQuota = customerQuotas[monthInfo.monthName] || 0;
        
        if (targetQuota > 0 && totalQtyForReb > 0) {
          quotaMet = totalQtyForReb >= targetQuota;
          
          if (quotaMet) {
            // PERCENTAGE REBATE CALCULATION:
            baseAmount = (totalActualSales * percentageValue) / 100;
            
            status = sapEntry ? 'Released' : 'Pending';
            eligible = true;
            
            calculationNote = `Sales: ₱${totalActualSales.toFixed(2)} × ${percentageValue}% = ₱${baseAmount.toFixed(2)}`;
            
            console.log(`📊 PERCENTAGE REBATE CALCULATION for ${monthKey}:`, {
              totalActualSales: totalActualSales,
              percentageValue: percentageValue,
              baseAmount: baseAmount,
              formula: `Sales: ₱${totalActualSales.toFixed(2)} × ${percentageValue}% = ₱${baseAmount.toFixed(2)}`,
              targetQuota: targetQuota,
              quotaMet: quotaMet,
              releasedAmount: releasedAmount,
              status: status
            });
          } else {
            calculationNote = `Quota not met: ${totalQtyForReb.toFixed(2)} < ${targetQuota}`;
          }
        } else {
          calculationNote = `No quota or transactions`;
        }
      } else if (rebateType === 'Incremental') {
        const eligibleTransactions = monthWithData.transactions.filter(t => 
          t.EligibilityStatus === 'Eligible' && t.CurrentRange
        );
        
        eligible = eligibleTransactions.length > 0;
        quotaMet = eligible;
        
        if (eligible) {
          const highestRange = Math.max(...eligibleTransactions.map(t => t.CurrentRange || 0));
          const highestTransaction = eligibleTransactions.find(t => t.CurrentRange === highestRange);
          rebatePerBag = parseFloat(highestTransaction?.RebatePerBag) || 0;
          
          // Incremental rebate calculation
          baseAmount = totalAdjustedQtyForReb * rebatePerBag;
          status = sapEntry ? 'Released' : 'Pending';
          
          calculationNote = `Adjusted Qty: ${totalAdjustedQtyForReb.toFixed(2)} × ${rebatePerBag.toFixed(2)} = ₱${baseAmount.toFixed(2)}`;
        } else {
          calculationNote = `No eligible transactions`;
        }
      }
      
      // Monthly amounts
      let totalAmount = baseAmount;
      let balance = totalAmount - releasedAmount;
      
      if (!eligible || !quotaMet) {
        totalAmount = 0;
        balance = 0;
      }
      
      // Create monthly record with generated payout ID and SAP data
      const monthlyRecord = {
        id: payoutId,
        type: 'monthly',
        cardCode: customerCode,
        rebateCode: rebateCode,
        date: monthInfo.payoutDate,
        period: monthInfo.period,
        payoutQuarter: `Q${monthInfo.quarter} ${monthInfo.year}`,
        monthKey: monthKey,
        monthNumber: monthInfo.monthNumber,
        quarter: monthInfo.quarter,
        year: monthInfo.year,
        baseAmount: parseFloat(baseAmount.toFixed(2)),
        amount: parseFloat(totalAmount.toFixed(2)),
        status: calculateStatus(status, eligible, quotaMet, rebateType),
        amountReleased: releasedAmount,
        balance: parseFloat(balance.toFixed(2)),
        eligible: eligible,
        quotaMet: quotaMet,
        totalActualSales: totalActualSales,
        totalQtyForReb: totalQtyForReb,
        totalAdjustedQtyForReb: totalAdjustedQtyForReb,
        rebatePerBag: baseRebatePerBag,
        calculationNote: calculationNote,
        qtrRebate: qtrRebate,
        isCompleteQuarter: false,
        hasTransactions: true,
        transactionCount: monthWithData?.transactions?.length || 0,
        isNonEligibleMonth: !eligible || !quotaMet,
        rebateType: rebateType,
        // SAP Journal Entry Data
        hasSapJournal: !!sapEntry,
        journalRemarks: sapEntry?.journalRemarks || null,
        journalDate: sapEntry?.journalDate || null,
        journalStatus: sapEntry?.journalStatus || null
      };
      
      monthlyData.push(monthlyRecord);
    }

    console.log(`📊 Processed ${monthlyData.length} months with transactions (months without transactions excluded from display)`);

    // Second pass: group by quarter and calculate QTR rebate rows
    const quarterlyData = [];

    // Group monthly data by quarter
    const quarters = {};
    monthlyData.forEach(month => {
      const quarterKey = `Q${month.quarter}-${month.year}`;
      if (!quarters[quarterKey]) {
        quarters[quarterKey] = {
          quarter: month.quarter,
          year: month.year,
          months: [],
          totalActualSales: 0,
          totalQtyForReb: 0,
          totalAdjustedQtyForReb: 0,
          eligibleMonths: 0,
          totalMonths: 0,
          isComplete: false,
          releasedAmount: 0,
          sapEntries: []
        };
      }
      
      quarters[quarterKey].months.push(month);
      quarters[quarterKey].totalActualSales += month.totalActualSales;
      quarters[quarterKey].totalQtyForReb += month.totalQtyForReb;
      quarters[quarterKey].totalAdjustedQtyForReb += month.totalAdjustedQtyForReb;
      quarters[quarterKey].totalMonths++;
      
      if (month.quotaMet) {
        quarters[quarterKey].eligibleMonths++;
      }
      
      // Track released amounts
      quarters[quarterKey].releasedAmount += month.amountReleased || 0;
      if (month.hasSapJournal) {
        quarters[quarterKey].sapEntries.push(month);
      }
    });

    // Check each quarter for completeness and add QTR rebate row if applicable
    Object.keys(quarters).forEach(quarterKey => {
      const quarter = quarters[quarterKey];
      
      // A quarter is complete if ALL 3 months in that quarter met quota
      quarter.isComplete = quarter.eligibleMonths === 3 && quarter.totalMonths === 3;
      
      if (quarter.isComplete && qtrRebate > 0) {
        let qtrRebateAmount = 0;
        let calculationNote = '';
        
        // Generate payout ID for QTR rebate
        const qtrPayoutId = generatePayoutId(customerCode, rebateCode, `QTR-${quarterKey}`);
        
        // Check if there's a SAP journal entry for this QTR rebate
        const qtrSapEntry = sapJournalEntries.find(entry => 
          entry.payoutId === qtrPayoutId || 
          entry.period === `Quarter ${quarter.quarter} Rebate - ${quarter.year}`
        );
        
        const qtrReleasedAmount = qtrSapEntry ? qtrSapEntry.releasedAmount : 0;
        
        if (rebateType === 'Percentage') {
          qtrRebateAmount = quarter.totalActualSales * (qtrRebate / 100);
          calculationNote = `QTR Rebate (Percentage): ${quarter.totalActualSales.toFixed(2)} × ${qtrRebate}% = ${qtrRebateAmount.toFixed(2)}`;
        } else if (rebateType === 'Fixed' || rebateType === 'Incremental') {
          qtrRebateAmount = quarter.totalAdjustedQtyForReb * qtrRebate;
          calculationNote = `QTR Rebate (Fixed/Incremental): Adjusted Qty ${quarter.totalAdjustedQtyForReb.toFixed(2)} × ${qtrRebate} = ${qtrRebateAmount.toFixed(2)}`;
        }
        
        const qtrBalance = qtrRebateAmount - qtrReleasedAmount;
        
        // Add QTR rebate as separate row with generated payout ID - mark as isQtrRebate
        quarterlyData.push({
          id: qtrPayoutId,
          type: 'quarterly',
          cardCode: customerCode,
          rebateCode: rebateCode,
          date: `${quarter.quarter}.${quarter.year.toString().slice(-2)}`,
          period: `Quarter ${quarter.quarter} Rebate - ${quarter.year}`,
          payoutQuarter: `Q${quarter.quarter} ${quarter.year}`,
          quarter: quarter.quarter,
          year: quarter.year,
          totalActualSales: quarter.totalActualSales,
          totalQtyForReb: quarter.totalQtyForReb,
          totalAdjustedQtyForReb: quarter.totalAdjustedQtyForReb,
          baseAmount: qtrRebateAmount,
          amount: parseFloat(qtrRebateAmount.toFixed(2)),
          status: qtrSapEntry ? 'Released' : calculateStatus('Pending', true, true, rebateType),
          amountReleased: qtrReleasedAmount,
          balance: parseFloat(qtrBalance.toFixed(2)),
          eligible: true,
          quotaMet: true,
          qtrRebate: qtrRebate,
          isQtrRebate: true, // IMPORTANT: Mark as quarter rebate
          calculationNote: calculationNote,
          rebateType: rebateType,
          // SAP Journal Entry Data
          hasSapJournal: !!qtrSapEntry,
          journalRemarks: qtrSapEntry?.journalRemarks || null,
          journalDate: qtrSapEntry?.journalDate || null,
          journalStatus: qtrSapEntry?.journalStatus || null
        });
      }
    });

    // Combine monthly and quarterly data
    const allData = [...monthlyData, ...quarterlyData];
    
    console.log(`✅ Completed payout calculation: ${monthlyData.length} monthly (with transactions), ${quarterlyData.length} quarterly, type: ${rebateType}`);
    console.log(`📊 Total with SAP journal entries: ${allData.filter(d => d.hasSapJournal).length}`);
    
    return allData;
    
  } catch (error) {
    console.error('❌ Error in calculateMonthlyPayoutData:', error);
    return [];
  }
};

// routes/Van_payoutRoutes.js - Update the main endpoint for payouts with beginning balances
router.get('/customer/:customerCode/payouts-with-beginning-balances', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode, rebateType } = req.query;
    
    console.log('💰 [VAN] Fetching payouts with beginning balances for customer:', {
      customerCode,
      rebateCode,
      rebateType
    });

    if (!customerCode) {
      return res.status(400).json({
        success: false,
        message: 'Customer code is required'
      });
    }

    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Ensure table exists
    await createPayoutHistoryTable(ownPool);

    // Get ALL payouts including beginning balances, grouped by quarter
    let query = `
      WITH PayoutData AS (
        SELECT 
          ph.*,
          CASE 
            WHEN ph.Period LIKE 'Balance of Q%' THEN 1
            ELSE 0
          END AS IsBeginningBalance,
          -- Extract quarter and year from period
          CASE 
            WHEN ph.Period LIKE 'Balance of Q%' THEN
              RIGHT(SUBSTRING(ph.Period, CHARINDEX('Q', ph.Period), 3), 1)  -- Q number
            WHEN ph.Period LIKE 'January%' OR ph.Period LIKE 'February%' OR ph.Period LIKE 'March%' THEN '1'
            WHEN ph.Period LIKE 'April%' OR ph.Period LIKE 'May%' OR ph.Period LIKE 'June%' THEN '2'
            WHEN ph.Period LIKE 'July%' OR ph.Period LIKE 'August%' OR ph.Period LIKE 'September%' THEN '3'
            WHEN ph.Period LIKE 'October%' OR ph.Period LIKE 'November%' OR ph.Period LIKE 'December%' THEN '4'
            WHEN ph.Period LIKE 'Quarter 1%' THEN '1'
            WHEN ph.Period LIKE 'Quarter 2%' THEN '2'
            WHEN ph.Period LIKE 'Quarter 3%' THEN '3'
            WHEN ph.Period LIKE 'Quarter 4%' THEN '4'
            ELSE NULL
          END AS Quarter,
          -- Extract year from period
          CASE 
            WHEN ph.Period LIKE '%2025%' THEN 2025
            WHEN ph.Period LIKE '%2024%' THEN 2024
            WHEN ph.Period LIKE '%2023%' THEN 2023
            WHEN ph.Period LIKE '%2022%' THEN 2022
            WHEN ph.Period LIKE '%2021%' THEN 2021
            WHEN ph.Period LIKE '%2020%' THEN 2020
            ELSE YEAR(GETDATE())
          END AS Year,
          -- Sort order for beginning balances (first day of quarter)
          CASE 
            WHEN ph.Period LIKE 'Balance of Q%' THEN 
              CAST(
                CASE 
                  WHEN ph.Period LIKE '%2025%' THEN '2025-'
                  WHEN ph.Period LIKE '%2024%' THEN '2024-'
                  WHEN ph.Period LIKE '%2023%' THEN '2023-'
                  WHEN ph.Period LIKE '%2022%' THEN '2022-'
                  ELSE CAST(YEAR(GETDATE()) AS VARCHAR) + '-'
                END +
                RIGHT('0' + SUBSTRING(ph.Period, CHARINDEX('Q', ph.Period) + 1, 1), 2) + '-01' 
                AS DATE
              )
            -- For regular months, use month numbers for sorting
            ELSE 
              CASE 
                WHEN ph.Period LIKE 'January%' THEN CAST(Year AS VARCHAR) + '-01-01'
                WHEN ph.Period LIKE 'February%' THEN CAST(Year AS VARCHAR) + '-02-01'
                WHEN ph.Period LIKE 'March%' THEN CAST(Year AS VARCHAR) + '-03-01'
                WHEN ph.Period LIKE 'April%' THEN CAST(Year AS VARCHAR) + '-04-01'
                WHEN ph.Period LIKE 'May%' THEN CAST(Year AS VARCHAR) + '-05-01'
                WHEN ph.Period LIKE 'June%' THEN CAST(Year AS VARCHAR) + '-06-01'
                WHEN ph.Period LIKE 'July%' THEN CAST(Year AS VARCHAR) + '-07-01'
                WHEN ph.Period LIKE 'August%' THEN CAST(Year AS VARCHAR) + '-08-01'
                WHEN ph.Period LIKE 'September%' THEN CAST(Year AS VARCHAR) + '-09-01'
                WHEN ph.Period LIKE 'October%' THEN CAST(Year AS VARCHAR) + '-10-01'
                WHEN ph.Period LIKE 'November%' THEN CAST(Year AS VARCHAR) + '-11-01'
                WHEN ph.Period LIKE 'December%' THEN CAST(Year AS VARCHAR) + '-12-01'
                WHEN ph.Period LIKE 'Quarter 1%' THEN CAST(Year AS VARCHAR) + '-01-01'
                WHEN ph.Period LIKE 'Quarter 2%' THEN CAST(Year AS VARCHAR) + '-04-01'
                WHEN ph.Period LIKE 'Quarter 3%' THEN CAST(Year AS VARCHAR) + '-07-01'
                WHEN ph.Period LIKE 'Quarter 4%' THEN CAST(Year AS VARCHAR) + '-10-01'
                ELSE CAST(YEAR(GETDATE()) AS VARCHAR) + '-01-01'
              END
          END AS SortDate,
          -- Month order within quarter
          CASE 
            WHEN ph.Period LIKE 'January%' OR ph.Period LIKE 'April%' OR ph.Period LIKE 'July%' OR ph.Period LIKE 'October%' THEN 1
            WHEN ph.Period LIKE 'February%' OR ph.Period LIKE 'May%' OR ph.Period LIKE 'August%' OR ph.Period LIKE 'November%' THEN 2
            WHEN ph.Period LIKE 'March%' OR ph.Period LIKE 'June%' OR ph.Period LIKE 'September%' OR ph.Period LIKE 'December%' THEN 3
            ELSE 0
          END AS MonthOrder
        FROM PayoutHistory ph
        WHERE ph.CardCode = @customerCode 
    `;
    
    const request = ownPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode);
    
    if (rebateCode) {
      query += ` AND ph.RebateCode = @rebateCode`;
      request.input('rebateCode', sql.NVarChar(50), rebateCode);
    }
    
    if (rebateType) {
      query += ` AND ph.RebateType = @rebateType`;
      request.input('rebateType', sql.NVarChar(50), rebateType);
    }
    
    query += `
      )
      SELECT *
      FROM PayoutData
      ORDER BY 
        Year ASC,
        Quarter ASC,
        IsBeginningBalance DESC, -- Beginning balances first in each quarter
        MonthOrder ASC,
        SortDate ASC
    `;
    
    const result = await request.query(query);
    const allPayouts = result.recordset;
    
    console.log(`📊 [VAN] Found ${allPayouts.length} payout records for ${customerCode}`);
    
    // Group payouts by quarter for the response
    const quarters = {};
    
    allPayouts.forEach(payout => {
      const quarterKey = `Q${payout.Quarter}-${payout.Year}`;
      
      if (!quarters[quarterKey]) {
        quarters[quarterKey] = {
          quarter: parseInt(payout.Quarter),
          year: payout.Year,
          beginningBalance: null,
          monthlyPayouts: [],
          quarterRebates: [],
          totalQuarterAmount: 0
        };
      }
      
      // Check if this is a beginning balance
      if (payout.IsBeginningBalance === 1) {
        quarters[quarterKey].beginningBalance = payout;
      } 
      // Check if this is a quarter rebate
      else if (payout.Period && payout.Period.includes('Quarter') && payout.Period.includes('Rebate')) {
        quarters[quarterKey].quarterRebates.push(payout);
        quarters[quarterKey].totalQuarterAmount += parseFloat(payout.TotalAmount) || 0;
      }
      // Regular monthly payout
      else {
        quarters[quarterKey].monthlyPayouts.push(payout);
        quarters[quarterKey].totalQuarterAmount += parseFloat(payout.TotalAmount) || 0;
      }
    });
    
    // Convert quarters object to array and sort chronologically
    const sortedQuarters = Object.values(quarters).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.quarter - b.quarter;
    });
    
    // Calculate total carried over balance
    const totalCarriedOverBalance = allPayouts
      .filter(p => p.IsBeginningBalance === 1)
      .reduce((sum, p) => sum + (parseFloat(p.TotalAmount) || parseFloat(p.Balance) || 0), 0);
    
    res.json({
      success: true,
      data: {
        allPayouts: allPayouts,
        quarters: sortedQuarters,
        totalCarriedOverBalance: totalCarriedOverBalance,
        customerCode: customerCode,
        rebateCode: rebateCode,
        rebateType: rebateType,
        beginningBalanceCount: allPayouts.filter(p => p.IsBeginningBalance === 1).length,
        regularPayoutCount: allPayouts.filter(p => p.IsBeginningBalance === 0).length
      }
    });

  } catch (error) {
    console.error('❌ [VAN] Error fetching payouts with beginning balances:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payout data with beginning balances',
      error: error.message
    });
  }
});


router.get('/customer/:customerCode/carried-forward-balances', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateType, startDate, endDate } = req.query;
    
    console.log('🔄 Checking for carried forward balances:', {
      customerCode,
      rebateType,
      startDate,
      endDate
    });

    if (!customerCode || !rebateType) {
      return res.status(400).json({
        success: false,
        message: 'Customer code and rebate type are required'
      });
    }

    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    const dateFrom = startDate || `${new Date().getFullYear()}-01-01`;
    const dateTo = endDate || new Date().toISOString().split('T')[0];
    
    const carriedForwardBalances = await getCarriedForwardBeginningBalances(
      ownPool,
      customerCode,
      rebateType,
      dateFrom,
      dateTo
    );

    res.json({
      success: true,
      data: {
        carriedForwardBalances,
        customerCode,
        rebateType,
        dateRange: { dateFrom, dateTo }
      }
    });

  } catch (error) {
    console.error('❌ Error checking carried forward balances:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking carried forward balances',
      error: error.message
    });
  }
});

router.post('/carry-forward-balance', async (req, res) => {
  try {
    const { db, balanceId, targetQuarter, targetYear } = req.body;
    
    console.log('🔄 Carrying forward balance:', { balanceId, targetQuarter, targetYear });

    if (!balanceId || !targetQuarter || !targetYear) {
      return res.status(400).json({
        success: false,
        message: 'Balance ID, target quarter and year are required'
      });
    }

    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Get the original balance
    const getBalanceQuery = `
      SELECT * FROM PayoutHistory WHERE Id = @balanceId
    `;
    
    const balanceResult = await ownPool.request()
      .input('balanceId', sql.Int, balanceId)
      .query(getBalanceQuery);

    if (balanceResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Balance not found'
      });
    }

    const originalBalance = balanceResult.recordset[0];
    
    // Check if already exists in target quarter
    const targetPeriod = `Balance of Q${targetQuarter} ${targetYear}`;
    
    const checkQuery = `
      SELECT COUNT(*) as Count 
      FROM PayoutHistory 
      WHERE CardCode = @CardCode 
        AND RebateType = @RebateType
        AND Period = @Period
    `;
    
    const checkResult = await ownPool.request()
      .input('CardCode', sql.NVarChar(50), originalBalance.CardCode)
      .input('RebateType', sql.NVarChar(50), originalBalance.RebateType)
      .input('Period', sql.NVarChar(100), targetPeriod)
      .query(checkQuery);

    if (checkResult.recordset[0].Count > 0) {
      return res.status(400).json({
        success: false,
        message: `Balance already exists for ${targetPeriod}`
      });
    }

    // Create carried forward balance
    const newPayoutId = `CF-${originalBalance.CardCode}-${originalBalance.RebateType}-Q${targetQuarter}-${targetYear}`;
    
    // Calculate date for beginning balance (first day of target quarter)
    const balanceDate = new Date(targetYear, (targetQuarter - 1) * 3, 1);
    const formattedDate = `${balanceDate.getMonth() + 1}.${balanceDate.getDate()}.${balanceDate.getFullYear().toString().slice(-2)}`;
    
    const insertQuery = `
      INSERT INTO PayoutHistory (
        PayoutId,
        CardCode,
        RebateCode,
        RebateType,
        Period,
        PayoutQuarter,
        PayoutDate,
        BaseAmount,
        TotalAmount,
        AmountReleased,
        RebateBalance,
        Status,
        CreatedDate,
        UpdatedDate
      )
      VALUES (
        @PayoutId,
        @CardCode,
        @RebateCode,
        @RebateType,
        @Period,
        @PayoutQuarter,
        @PayoutDate,
        @BaseAmount,
        @TotalAmount,
        @AmountReleased,
        @RebateBalance,
        @Status,
        GETDATE(),
        GETDATE()
      )
    `;
    
    await ownPool.request()
      .input('PayoutId', sql.NVarChar(100), newPayoutId)
      .input('CardCode', sql.NVarChar(50), originalBalance.CardCode)
      .input('RebateCode', sql.NVarChar(50), originalBalance.RebateCode)
      .input('RebateType', sql.NVarChar(50), originalBalance.RebateType)
      .input('Period', sql.NVarChar(100), targetPeriod)
      .input('PayoutQuarter', sql.NVarChar(20), `Q${targetQuarter} ${targetYear}`)
      .input('PayoutDate', sql.NVarChar(20), formattedDate)
      .input('BaseAmount', sql.Decimal(18, 2), 0)
      .input('TotalAmount', sql.Decimal(18, 2), originalBalance.TotalAmount)
      .input('AmountReleased', sql.Decimal(18, 2), 0)
      .input('RebateBalance', sql.Decimal(18, 2), originalBalance.TotalAmount)
      .input('Status', sql.NVarChar(50), null)
      .query(insertQuery);

    console.log(`✅ Carried forward balance ${originalBalance.Id} to ${targetPeriod}`);

    res.json({
      success: true,
      message: `Balance carried forward to ${targetPeriod}`,
      data: {
        originalBalanceId: originalBalance.Id,
        newPeriod: targetPeriod,
        amount: originalBalance.TotalAmount
      }
    });

  } catch (error) {
    console.error('❌ Error carrying forward balance:', error);
    res.status(500).json({
      success: false,
      message: 'Error carrying forward balance',
      error: error.message
    });
  }
});

// Add update status endpoint
router.put('/payouts/:payoutId/status', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, status, amountReleased } = req.body;
    
    console.log('🔄 [VAN] Updating payout status:', { payoutId, status, amountReleased });
    
    if (!payoutId) {
      return res.status(400).json({
        success: false,
        message: 'Payout ID is required'
      });
    }

    const databaseToUse = db || 'VAN_OWN';
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

    console.log(`✅ [VAN] Updated payout ${payoutId}:`, {
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
    console.error('❌ [VAN] Error updating payout:', error);
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
          PayoutQuarter NVARCHAR(20),
          BaseAmount DECIMAL(18, 2) DEFAULT 0,
          TotalAmount DECIMAL(18, 2) DEFAULT 0,
          Status NVARCHAR(50) DEFAULT 'Pending',
          AmountReleased DECIMAL(18, 2) DEFAULT 0,
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
        CREATE INDEX IX_PayoutHistory_PayoutQuarter ON PayoutHistory(PayoutQuarter);
      END
      ELSE
      BEGIN
        -- Add PayoutQuarter column if it doesn't exist
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                       WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'PayoutQuarter')
        BEGIN
          ALTER TABLE PayoutHistory ADD PayoutQuarter NVARCHAR(20);
        END
      END
    `;
    
    await pool.request().query(tableCheckQuery);
    console.log('✅ [VAN] PayoutHistory table created/verified');
    
  } catch (error) {
    console.error('❌ [VAN] Error creating/updating PayoutHistory table:', error);
  }
};

// Helper function to get quarter string from period or date
const getQuarterString = (period, date = null) => {
  try {
    // For beginning balances, extract from period
    if (period && period.includes('Balance of Q')) {
      const match = period.match(/Balance of Q(\d+) (\d+)/);
      if (match) {
        const quarter = parseInt(match[1]);
        const year = parseInt(match[2]);
        return `Q${quarter} ${year}`;
      }
    }
    
    // For regular periods, extract quarter based on month
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Check for month in period
    for (let i = 0; i < monthNames.length; i++) {
      if (period && period.includes(monthNames[i])) {
        // Determine quarter (1-4)
        const quarter = Math.floor(i / 3) + 1;
        
        // Try to extract year from period
        const yearMatch = period.match(/\b(20\d{2})\b/);
        let year = new Date().getFullYear();
        
        if (yearMatch) {
          year = parseInt(yearMatch[1]);
        } else if (date) {
          // Try to get year from date
          const dateObj = new Date(date);
          if (!isNaN(dateObj)) {
            year = dateObj.getFullYear();
          }
        }
        
        return `Q${quarter} ${year}`;
      }
    }
    
    // Check for quarter patterns
    const quarterMatch = period.match(/Q(\d+).*?(20\d{2}|\d{2})/i);
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1]);
      let year = quarterMatch[2];
      
      // Handle 2-digit year
      if (year.length === 2) {
        year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
      }
      
      return `Q${quarter} ${year}`;
    }
    
    // Default to current quarter
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    return `Q${currentQuarter} ${now.getFullYear()}`;
    
  } catch (error) {
    console.error('❌ Error getting quarter string:', error);
    return 'Q1 2025';
  }
};


// Check if beginning balance calculation is needed
router.get('/check-balance-calculation', async (req, res) => {
  try {
    const { db, cardCode } = req.query;
    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Get quarters that need beginning balance calculation
    const checkQuery = `
      WITH QuarterData AS (
        SELECT 
          CardCode,
          RebateCode,
          RebateType,
          Period,
          BaseAmount,
          AmountReleased,
          CASE 
            WHEN Period LIKE 'January%' OR Period LIKE 'February%' OR Period LIKE 'March%' THEN 'Q1'
            WHEN Period LIKE 'April%' OR Period LIKE 'May%' OR Period LIKE 'June%' THEN 'Q2'
            WHEN Period LIKE 'July%' OR Period LIKE 'August%' OR Period LIKE 'September%' THEN 'Q3'
            WHEN Period LIKE 'October%' OR Period LIKE 'November%' OR Period LIKE 'December%' THEN 'Q4'
            WHEN Period LIKE 'Quarter 1%' THEN 'Q1'
            WHEN Period LIKE 'Quarter 2%' THEN 'Q2'
            WHEN Period LIKE 'Quarter 3%' THEN 'Q3'
            WHEN Period LIKE 'Quarter 4%' THEN 'Q4'
          END AS Quarter,
          CASE 
            WHEN Period LIKE '%2024%' THEN 2024
            WHEN Period LIKE '%2023%' THEN 2023
            WHEN Period LIKE '%2022%' THEN 2022
            WHEN Period LIKE '%2025%' THEN 2025
            ELSE YEAR(GETDATE())
          END AS Year
        FROM PayoutHistory
        WHERE Period NOT LIKE 'Balance of Q%'
      ),
      QuarterTotals AS (
        SELECT 
          Quarter,
          Year,
          CardCode,
          RebateCode,
          RebateType,
          SUM(BaseAmount) as TotalBaseAmount,
          SUM(AmountReleased) as TotalAmountReleased,
          SUM(BaseAmount) - SUM(AmountReleased) as CalculatedBalance
        FROM QuarterData
        GROUP BY Quarter, Year, CardCode, RebateCode, RebateType
        HAVING SUM(BaseAmount) - SUM(AmountReleased) > 0
      )
      SELECT 
        Quarter,
        Year,
        CardCode,
        RebateCode,
        RebateType,
        TotalBaseAmount,
        TotalAmountReleased,
        CalculatedBalance
      FROM QuarterTotals
      WHERE CalculatedBalance > 0
      ${cardCode ? 'AND CardCode = @cardCode' : ''}
    `;
    
    const request = ownPool.request();
    if (cardCode) {
      request.input('cardCode', sql.NVarChar(50), cardCode);
    }
    
    const result = await request.query(checkQuery);
    
    // Now check which quarters need beginning balances
    let needsCalculation = false;
    const quartersNeedingBalance = [];
    
    if (result.recordset.length > 0) {
      for (const quarter of result.recordset) {
        const targetQuarter = parseInt(quarter.Quarter.replace('Q', ''));
        const targetYear = quarter.Year;
        
        // Determine next quarter and year
        let nextQuarter, nextYear;
        
        if (targetQuarter === 1) {
          nextQuarter = 2;
          nextYear = targetYear;
        } else if (targetQuarter === 2) {
          nextQuarter = 3;
          nextYear = targetYear;
        } else if (targetQuarter === 3) {
          nextQuarter = 4;
          nextYear = targetYear;
        } else if (targetQuarter === 4) {
          nextQuarter = 1;
          nextYear = targetYear + 1;
        }
        
        const balancePeriod = `Balance of Q${nextQuarter} ${nextYear}`;
        
        const existsQuery = `
          SELECT COUNT(*) as Count 
          FROM PayoutHistory 
          WHERE CardCode = @CardCode
            AND RebateCode = @RebateCode
            AND Period = @Period
        `;
        
        const existsResult = await ownPool.request()
          .input('CardCode', sql.NVarChar(50), quarter.CardCode)
          .input('RebateCode', sql.NVarChar(50), quarter.RebateCode)
          .input('Period', sql.NVarChar(100), balancePeriod)
          .query(existsQuery);
        
        if (existsResult.recordset[0].Count === 0) {
          needsCalculation = true;
          quartersNeedingBalance.push({
            ...quarter,
            balancePeriod,
            calculation: `${quarter.TotalBaseAmount} - ${quarter.TotalAmountReleased} = ${quarter.CalculatedBalance}`
          });
        }
      }
    }
    
    res.json({
      success: true,
      needsCalculation: needsCalculation,
      quarterCount: result.recordset.length,
      quartersNeedingBalance: quartersNeedingBalance,
      calculationFormula: 'Beginning Balance = Sum(BaseAmount) - Sum(AmountReleased) for each quarter'
    });
    
  } catch (error) {
    console.error('❌ Error checking balance calculation:', error);
    res.status(500).json({
      success: false,
      needsCalculation: false,
      error: error.message
    });
  }
});

// Process pending balances and prepare for beginning balance calculation
router.post('/process-pending-balances', async (req, res) => {
  try {
    const { db, cardCode, rebateType } = req.body;
    
    console.log(`🔄 Processing pending balances for:`, { db, cardCode, rebateType });
    
    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Ensure table exists
    await createPayoutHistoryTable(ownPool);
    
    // First, ensure all calculated payouts are saved
    if (cardCode) {
      try {
        // Trigger payout calculation for this customer
        const rebateQuery = `
          SELECT DISTINCT RebateCode, RebateType
          FROM PayoutHistory
          WHERE CardCode = @cardCode
          ${rebateType ? 'AND RebateType = @rebateType' : ''}
        `;
        
        const rebateRequest = ownPool.request()
          .input('cardCode', sql.NVarChar(50), cardCode);
        
        if (rebateType) {
          rebateRequest.input('rebateType', sql.NVarChar(50), rebateType);
        }
        
        const rebateResult = await rebateRequest.query(rebateQuery);
        
        for (const rebate of rebateResult.recordset) {
          // Trigger payout calculation for each rebate
          const calcUrl = `http://localhost:3006/api/van/dashboard/customer/${cardCode}/payouts?db=${databaseToUse}&rebateCode=${rebate.RebateCode}&rebateType=${rebate.RebateType}`;
          
          try {
            const response = await fetch(calcUrl);
            if (response.ok) {
              const result = await response.json();
              console.log(`✅ Calculated payouts for ${cardCode} - ${rebate.RebateCode}: ${result.data?.payouts?.length || 0} records`);
            }
          } catch (calcError) {
            console.log(`⚠️ Could not calculate payouts for ${rebate.RebateCode}:`, calcError.message);
          }
        }
      } catch (error) {
        console.error('❌ Error calculating payouts:', error.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Pending balances processed successfully'
    });
    
  } catch (error) {
    console.error('❌ Error processing pending balances:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Also update the /add-quarter-balances endpoint to use the correct formula:
router.post('/add-quarter-balances', async (req, res) => {
  try {
    const { db, cardCode, rebateType, forceRecalculate } = req.body;
    
    console.log(`💰 Adding quarter beginning balances for:`, { db, cardCode, rebateType });
    
    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Clear existing beginning balances if force recalculate
    if (forceRecalculate) {
      const clearQuery = cardCode 
        ? `DELETE FROM PayoutHistory WHERE Period LIKE 'Balance of Q%' AND CardCode = @cardCode`
        : `DELETE FROM PayoutHistory WHERE Period LIKE 'Balance of Q%'`;
      
      const clearRequest = ownPool.request();
      if (cardCode) {
        clearRequest.input('cardCode', sql.NVarChar(50), cardCode);
      }
      
      await clearRequest.query(clearQuery);
      console.log(`🧹 Cleared existing beginning balance records`);
    }

    // Get ALL payout data for quarters to calculate PROPER beginning balance
    const quarterQuery = `
      SELECT 
        CardCode,
        RebateCode,
        RebateType,
        Period,
        BaseAmount,
        TotalAmount,
        AmountReleased,
        RebateBalance,
        CASE 
          WHEN Period LIKE 'January%' OR Period LIKE 'February%' OR Period LIKE 'March%' THEN 'Q1'
          WHEN Period LIKE 'April%' OR Period LIKE 'May%' OR Period LIKE 'June%' THEN 'Q2'
          WHEN Period LIKE 'July%' OR Period LIKE 'August%' OR Period LIKE 'September%' THEN 'Q3'
          WHEN Period LIKE 'October%' OR Period LIKE 'November%' OR Period LIKE 'December%' THEN 'Q4'
          WHEN Period LIKE 'Quarter 1%' THEN 'Q1'
          WHEN Period LIKE 'Quarter 2%' THEN 'Q2'
          WHEN Period LIKE 'Quarter 3%' THEN 'Q3'
          WHEN Period LIKE 'Quarter 4%' THEN 'Q4'
        END AS Quarter,
        CASE 
          WHEN Period LIKE '%2024%' THEN 2024
          WHEN Period LIKE '%2023%' THEN 2023
          WHEN Period LIKE '%2022%' THEN 2022
          WHEN Period LIKE '%2025%' THEN 2025
          ELSE YEAR(GETDATE())
        END AS Year
      FROM PayoutHistory
      WHERE Period NOT LIKE 'Balance of Q%'
        ${cardCode ? 'AND CardCode = @cardCode' : ''}
        ${rebateType ? 'AND RebateType = @rebateType' : ''}
    `;
    
    const quarterRequest = ownPool.request();
    if (cardCode) {
      quarterRequest.input('cardCode', sql.NVarChar(50), cardCode);
    }
    if (rebateType) {
      quarterRequest.input('rebateType', sql.NVarChar(50), rebateType);
    }
    
    const quarterResult = await quarterRequest.query(quarterQuery);
    const allPayouts = quarterResult.recordset;
    
    console.log(`📊 Found ${allPayouts.length} payout records for calculation`);
    
    // Group by customer, rebate code, quarter, and year
    const quarterGroups = {};
    
    allPayouts.forEach(payout => {
      if (!payout.Quarter || !payout.Year) return;
      
      const key = `${payout.CardCode}-${payout.RebateCode}-${payout.Quarter}-${payout.Year}`;
      
      if (!quarterGroups[key]) {
        quarterGroups[key] = {
          CardCode: payout.CardCode,
          RebateCode: payout.RebateCode,
          RebateType: payout.RebateType,
          Quarter: payout.Quarter,
          Year: payout.Year,
          totalBaseAmount: 0,
          totalAmountReleased: 0,
          payouts: []
        };
      }
      
      const baseAmount = parseFloat(payout.BaseAmount) || 0;
      const amountReleased = parseFloat(payout.AmountReleased) || 0;
      
      quarterGroups[key].totalBaseAmount += baseAmount;
      quarterGroups[key].totalAmountReleased += amountReleased;
      quarterGroups[key].payouts.push(payout);
    });
    
    // Insert beginning balances for NEXT quarter
    const insertedBalances = [];
    
    for (const key in quarterGroups) {
      const group = quarterGroups[key];
      const { 
        CardCode, 
        RebateCode, 
        RebateType, 
        Quarter, 
        Year, 
        totalBaseAmount, 
        totalAmountReleased 
      } = group;
      
      // Calculate PROPER beginning balance: Sum(BaseAmount) - Sum(AmountReleased)
      const quarterBalance = Math.max(0, totalBaseAmount - totalAmountReleased);
      
      if (quarterBalance <= 0) {
        console.log(`⏭️ No beginning balance for ${CardCode}-${RebateCode} ${Quarter} ${Year}: Balance = ${quarterBalance}`);
        continue;
      }
      
      // Determine next quarter and year
      let nextQuarter, nextYear;
      
      if (Quarter === 'Q1') {
        nextQuarter = 2;
        nextYear = Year;
      } else if (Quarter === 'Q2') {
        nextQuarter = 3;
        nextYear = Year;
      } else if (Quarter === 'Q3') {
        nextQuarter = 4;
        nextYear = Year;
      } else if (Quarter === 'Q4') {
        nextQuarter = 1;
        nextYear = Year + 1;
      } else {
        continue;
      }
      
      const targetPeriod = `Balance of Q${nextQuarter} ${nextYear}`;
      
      // Check if beginning balance already exists
      const checkQuery = `
        SELECT COUNT(*) as Count 
        FROM PayoutHistory 
        WHERE CardCode = @CardCode 
          AND RebateCode = @RebateCode
          AND Period = @Period
      `;
      
      const checkResult = await ownPool.request()
        .input('CardCode', sql.NVarChar(50), CardCode)
        .input('RebateCode', sql.NVarChar(50), RebateCode)
        .input('Period', sql.NVarChar(100), targetPeriod)
        .query(checkQuery);
      
      if (checkResult.recordset[0].Count === 0) {
        // Generate unique payout ID for beginning balance
        const payoutId = `BAL-${CardCode}-${RebateCode}-Q${nextQuarter}-${nextYear}`;
        
        // Calculate date for beginning balance (first day of next quarter)
        const beginningBalanceDate = new Date(nextYear, (nextQuarter - 1) * 3, 1);
        const formattedDate = `${beginningBalanceDate.getMonth() + 1}.${beginningBalanceDate.getDate()}.${beginningBalanceDate.getFullYear().toString().slice(-2)}`;
        
        // Add calculation note showing the formula
        const calculationNote = `Sum(BaseAmount): ₱${totalBaseAmount.toFixed(2)} - Sum(AmountReleased): ₱${totalAmountReleased.toFixed(2)} = ₱${quarterBalance.toFixed(2)}`;
        
        // Insert beginning balance record
        const insertQuery = `
          INSERT INTO PayoutHistory (
            PayoutId,
            CardCode,
            RebateCode,
            RebateType,
            Period,
            PayoutQuarter, 
            PayoutDate,
            BaseAmount,
            TotalAmount,
            AmountReleased,
            RebateBalance,
            Status,
            CreatedDate,
            UpdatedDate
          )
          VALUES (
            @PayoutId,
            @CardCode,
            @RebateCode,
            @RebateType,
            @Period,
            @PayoutQuarter, 
            @PayoutDate,
            @BaseAmount,
            @TotalAmount,
            @AmountReleased,
            @RebateBalance,
            @Status,
            GETDATE(),
            GETDATE()
          )
        `;
        
        await ownPool.request()
          .input('PayoutId', sql.NVarChar(100), payoutId)
          .input('CardCode', sql.NVarChar(50), CardCode)
          .input('RebateCode', sql.NVarChar(50), RebateCode)
          .input('RebateType', sql.NVarChar(50), RebateType)
          .input('Period', sql.NVarChar(100), targetPeriod)
          .input('PayoutQuarter', sql.NVarChar(20), targetPayoutQuarter)
          .input('PayoutDate', sql.NVarChar(20), formattedDate)
          .input('BaseAmount', sql.Decimal(18, 2), 0)
          .input('TotalAmount', sql.Decimal(18, 2), quarterBalance)
          .input('AmountReleased', sql.Decimal(18, 2), 0)
          .input('RebateBalance', sql.Decimal(18, 2), quarterBalance)
          .input('Status', sql.NVarChar(50), null)
          .input('CalculationNote', sql.NVarChar(500), calculationNote)
          .query(insertQuery);
        
        insertedBalances.push({
          cardCode: CardCode,
          rebateCode: RebateCode,
          rebateType: RebateType,
          fromQuarter: Quarter,
          fromYear: Year,
          toQuarter: nextQuarter,
          toYear: nextYear,
          totalBaseAmount: totalBaseAmount,
          totalAmountReleased: totalAmountReleased,
          balance: quarterBalance,
          calculation: `${totalBaseAmount.toFixed(2)} - ${totalAmountReleased.toFixed(2)} = ${quarterBalance.toFixed(2)}`
        });
        
        console.log(`✅ Added beginning balance: ${CardCode} - ${RebateCode}:`);
        console.log(`   Formula: ₱${totalBaseAmount.toFixed(2)} (BaseAmounts) - ₱${totalAmountReleased.toFixed(2)} (AmountReleased) = ₱${quarterBalance.toFixed(2)}`);
        console.log(`   Added to: ${targetPeriod}`);
      } else {
        console.log(`⏭️ Beginning balance already exists for ${CardCode} - ${RebateCode} in ${targetPeriod}`);
      }
    }
    
    res.json({
      success: true,
      message: `Added ${insertedBalances.length} beginning balance records using correct formula`,
      insertedBalances: insertedBalances
    });
    
  } catch (error) {
    console.error('❌ Error adding quarter balances:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get payouts with beginning balances
router.get('/payouts-with-balances/:cardCode?', async (req, res) => {
  try {
    const { cardCode } = req.params;
    const { db, rebateType } = req.query;
    
    console.log(`📊 Fetching payouts with beginning balances for:`, { cardCode, rebateType });
    
    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Ensure table exists
    await createPayoutHistoryTable(ownPool);
    
    let query = `
      SELECT 
        ph.*,
        CASE 
          WHEN ph.Period LIKE 'Balance of Q%' THEN 1
          ELSE 0
        END AS IsBeginningBalance,
        CASE 
          WHEN ph.Period LIKE 'Balance of Q%' THEN 
            CAST(CONCAT(
              SUBSTRING(ph.Period, PATINDEX('%[0-9][0-9][0-9][0-9]%', ph.Period), 4),
              '-',
              RIGHT('0' + SUBSTRING(ph.Period, CHARINDEX('Q', ph.Period) + 1, 1), 2),
              '-01'
            ) AS DATE)
          ELSE TRY_CAST(ph.PayoutDate AS DATE)
        END AS SortDate
      FROM PayoutHistory ph
      WHERE 1=1
    `;
    
    if (cardCode) {
      query += ` AND ph.CardCode = @CardCode`;
    }
    
    if (rebateType) {
      query += ` AND ph.RebateType = @RebateType`;
    }
    
    query += ` ORDER BY SortDate ASC, ph.Id ASC`;
    
    const request = ownPool.request();
    
    if (cardCode) {
      request.input('CardCode', sql.NVarChar(50), cardCode);
    }
    
    if (rebateType) {
      request.input('RebateType', sql.NVarChar(50), rebateType);
    }
    
    const result = await request.query(query);
    
    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching payouts with balances:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add this to payoutRoutes.js to debug table structure
router.get('/debug/payout-table-structure', async (req, res) => {
  try {
    const { db } = req.query;
    const databaseToUse = db || 'VAN_OWN';
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

const applyBalanceCarryOverToPayouts = (payouts) => {
  console.log('🔄 Applying balance carry-over to payouts');
  
  if (!Array.isArray(payouts) || payouts.length === 0) {
    return [];
  }
  
  // First, group payouts by quarter and sort them properly
  const payoutsByQuarter = {};
  
  payouts.forEach(payout => {
    // Get quarter and year
    const payoutDate = new Date(payout.Date || payout.PayoutDate || '');
    const quarterInfo = getQuarterFromDate(payoutDate);
    const quarter = payout.quarter || quarterInfo.quarter;
    const year = payout.year || quarterInfo.year;
    
    const quarterKey = `Q${quarter}-${year}`;
    
    if (!payoutsByQuarter[quarterKey]) {
      payoutsByQuarter[quarterKey] = {
        quarter,
        year,
        beginningBalances: [],
        monthlyPayouts: [],
        quarterRebates: []
      };
    }
    
    // Categorize payout
    const isBeginningBalance = payout.isBeginningBalance || 
                              (payout.Period && payout.Period.includes('Balance of Q'));
    const isQtrRebate = payout.isQtrRebate || payout.type === 'quarterly';
    
    if (isBeginningBalance) {
      payoutsByQuarter[quarterKey].beginningBalances.push(payout);
    } else if (isQtrRebate) {
      payoutsByQuarter[quarterKey].quarterRebates.push(payout);
    } else {
      payoutsByQuarter[quarterKey].monthlyPayouts.push(payout);
    }
  });
  
  const payoutsWithCarryOver = [];
  
  // Sort quarters chronologically
  const sortedQuarterKeys = Object.keys(payoutsByQuarter).sort((a, b) => {
    const [qA, yA] = a.split('-');
    const [qB, yB] = b.split('-');
    const yearA = parseInt(yA);
    const yearB = parseInt(yB);
    const quarterA = parseInt(qA.replace('Q', ''));
    const quarterB = parseInt(qB.replace('Q', ''));
    
    if (yearA !== yearB) return yearA - yearB;
    return quarterA - quarterB;
  });
  
  // Process each quarter in order
  sortedQuarterKeys.forEach(quarterKey => {
    const quarterData = payoutsByQuarter[quarterKey];
    const { quarter, year, beginningBalances, monthlyPayouts, quarterRebates } = quarterData;
    
    console.log(`📊 Processing ${quarterKey}: ${beginningBalances.length} beg balances, ${monthlyPayouts.length} monthly, ${quarterRebates.length} rebates`);
    
    // Sort monthly payouts by month order (January, February, March, etc.)
    const sortedMonthly = [...monthlyPayouts].sort((a, b) => {
      const monthOrderA = getMonthOrderFromPeriod(a.Period);
      const monthOrderB = getMonthOrderFromPeriod(b.Period);
      return monthOrderA - monthOrderB;
    });
    
    let previousBalance = 0;
    
    // 1. Process beginning balances first (if any)
    beginningBalances.forEach(balance => {
      const balanceAmount = parseFloat(balance.TotalAmount || balance.Amount || balance.Balance || 0);
      
      const begBalancePayout = {
        ...balance,
        Id: balance.Id || balance.PayoutId,
        PayoutId: balance.PayoutId || balance.Id,
        CardCode: balance.CardCode || balance.cardCode,
        RebateCode: balance.RebateCode || balance.rebateCode,
        RebateType: balance.RebateType || balance.rebateType,
        Date: balance.Date || balance.PayoutDate,
        Period: balance.Period || balance.period,
        BaseAmount: 0,
        TotalAmount: balanceAmount,
        Amount: balanceAmount,
        AmountReleased: 0,
        Balance: balanceAmount,
        Status: 'Beginning Balance',
        ReleaseDate: balance.ReleaseDate || balance.releaseDate,
        isBeginningBalance: true,
        CalculationNote: `Balance carried from Q${quarter === 1 ? 4 : quarter - 1} ${quarter === 1 ? year - 1 : year}`
      };
      
      payoutsWithCarryOver.push(begBalancePayout);
      previousBalance = balanceAmount;
    });
    
    // 2. Process monthly payouts
    const processedMonths = [];
    
    sortedMonthly.forEach((payout, index) => {
      const baseAmount = parseFloat(payout.BaseAmount || 0);
      
      // IMPORTANT: Add previous balance to this month's total
      const totalAmount = baseAmount + previousBalance;
      const amountReleased = parseFloat(payout.AmountReleased || 0);
      const balance = Math.max(0, totalAmount - amountReleased);
      
      const monthPayout = {
        ...payout,
        Id: payout.Id || payout.PayoutId,
        PayoutId: payout.PayoutId || payout.Id,
        CardCode: payout.CardCode || payout.cardCode,
        RebateCode: payout.RebateCode || payout.rebateCode,
        RebateType: payout.RebateType || payout.rebateType,
        Date: payout.Date || payout.PayoutDate,
        Period: payout.Period || payout.period,
        BaseAmount: baseAmount,
        TotalAmount: totalAmount,
        Amount: totalAmount,
        AmountReleased: amountReleased,
        Balance: balance,
        Status: calculateStatus(
          payout.Status || 'Pending',
          payout.eligible,
          payout.quotaMet,
          payout.rebateType || payout.RebateType
        ),
        ReleaseDate: payout.ReleaseDate || payout.releaseDate,
        PreviousBalance: previousBalance,
        CalculationNote: previousBalance > 0 
          ? `Base: ₱${baseAmount.toFixed(2)} + Previous: ₱${previousBalance.toFixed(2)} = ₱${totalAmount.toFixed(2)}`
          : `Base: ₱${baseAmount.toFixed(2)}`
      };
      
      payoutsWithCarryOver.push(monthPayout);
      processedMonths.push(monthPayout);
      
      // Update previous balance for next month
      previousBalance = balance;
    });
    
    // 3. Process quarter rebates LAST - with the balance from the last month (March)
    quarterRebates.forEach(rebate => {
      // Get the base quarter rebate amount
      const baseQtrRebateAmount = parseFloat(rebate.BaseAmount || rebate.TotalAmount || rebate.Amount || 0);
      
      // CRITICAL FIX: Add the previous balance (which now holds the balance from the last month - March)
      // to the quarter rebate amount
      const totalAmount = baseQtrRebateAmount + previousBalance;
      
      console.log(`💰 Quarter ${quarter} ${year} Rebate Calculation:`);
      console.log(`   Base Qtr Rebate: ₱${baseQtrRebateAmount.toFixed(2)}`);
      console.log(`   Previous Balance (from last month): ₱${previousBalance.toFixed(2)}`);
      console.log(`   Total Amount: ₱${totalAmount.toFixed(2)}`);
      
      const amountReleased = parseFloat(rebate.AmountReleased || 0);
      const balance = Math.max(0, totalAmount - amountReleased);
      
      const qtrPayout = {
        ...rebate,
        Id: rebate.Id || rebate.PayoutId,
        PayoutId: rebate.PayoutId || rebate.Id,
        CardCode: rebate.CardCode || rebate.cardCode,
        RebateCode: rebate.RebateCode || rebate.rebateCode,
        RebateType: rebate.RebateType || rebate.rebateType,
        Date: rebate.Date || rebate.PayoutDate,
        Period: rebate.Period || rebate.period,
        BaseAmount: baseQtrRebateAmount,
        TotalAmount: totalAmount,
        Amount: totalAmount,
        AmountReleased: amountReleased,
        Balance: balance,
        Status: calculateStatus(
          rebate.Status || 'Pending',
          rebate.eligible,
          rebate.quotaMet,
          rebate.rebateType || rebate.RebateType
        ),
        ReleaseDate: rebate.ReleaseDate || rebate.releaseDate,
        isQtrRebate: true,
        PreviousBalance: previousBalance,
        CalculationNote: `Base Qtr: ₱${baseQtrRebateAmount.toFixed(2)} + Balance from last month: ₱${previousBalance.toFixed(2)} = ₱${totalAmount.toFixed(2)}`
      };
      
      payoutsWithCarryOver.push(qtrPayout);
      
      // Update previous balance for next quarter (though quarter rebate is usually last)
      previousBalance = balance;
    });
  });
  
  console.log(`✅ Applied carry-over to ${payoutsWithCarryOver.length} payouts`);
  return payoutsWithCarryOver;
};

// Helper function to get month order from period string
const getMonthOrderFromPeriod = (period) => {
  if (!period) return 99;
  
  const monthOrder = {
    'January': 1,
    'February': 2,
    'March': 3,
    'April': 4,
    'May': 5,
    'June': 6,
    'July': 7,
    'August': 8,
    'September': 9,
    'October': 10,
    'November': 11,
    'December': 12
  };
  
  for (const [monthName, order] of Object.entries(monthOrder)) {
    if (period.includes(monthName)) {
      return order;
    }
  }
  
  // Check for quarter patterns (should be high number to appear last)
  if (period.includes('Quarter') && period.includes('Rebate')) {
    return 100; // Quarter rebates go last
  }
  
  return 99;
};

// Calculate and insert beginning balance for next quarter - SIMPLIFIED VERSION
router.post('/calculate-beg-balance', async (req, res) => {
  try {
    const { db, cardCode, rebateType } = req.body;
    
    console.log(`🔍 Calculating beginning balance for database: ${db || 'VAN_OWN'}`);
    
    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Clear existing beginning balance records for this customer to avoid duplicates
    let clearQuery = `DELETE FROM PayoutHistory WHERE Period LIKE 'Balance of Q%'`;
    
    const clearRequest = ownPool.request();
    if (cardCode) {
      clearQuery += ` AND CardCode = @cardCode`;
      clearRequest.input('cardCode', sql.NVarChar(50), cardCode);
    }
    if (rebateType) {
      clearQuery += ` AND RebateType = @rebateType`;
      clearRequest.input('rebateType', sql.NVarChar(50), rebateType);
    }
    
    await clearRequest.query(clearQuery);
    console.log(`🧹 Cleared existing beginning balance records`);
    
    // Calculate balances from previous quarters
    const balanceQuery = `
      SELECT 
        CardCode,
        RebateCode,
        RebateType,
        CASE 
          WHEN Period LIKE 'January%' OR Period LIKE 'February%' OR Period LIKE 'March%' THEN 'Q1'
          WHEN Period LIKE 'April%' OR Period LIKE 'May%' OR Period LIKE 'June%' THEN 'Q2'
          WHEN Period LIKE 'July%' OR Period LIKE 'August%' OR Period LIKE 'September%' THEN 'Q3'
          WHEN Period LIKE 'October%' OR Period LIKE 'November%' OR Period LIKE 'December%' THEN 'Q4'
        END AS Quarter,
        CASE 
          WHEN Period LIKE '%2027%' THEN 2027
          WHEN Period LIKE '%2026%' THEN 2026
          WHEN Period LIKE '%2025%' THEN 2025
          WHEN Period LIKE '%2024%' THEN 2024
          WHEN Period LIKE '%2023%' THEN 2023
          WHEN Period LIKE '%2022%' THEN 2022
          ELSE YEAR(GETDATE())
        END AS Year,
        SUM(RebateBalance) as QuarterBalance
      FROM PayoutHistory
      WHERE Period NOT LIKE 'Balance of Q%'
        AND RebateBalance > 0
        ${cardCode ? 'AND CardCode = @cardCode' : ''}
        ${rebateType ? 'AND RebateType = @rebateType' : ''}
      GROUP BY 
        CardCode,
        RebateCode,
        RebateType,
        CASE 
          WHEN Period LIKE 'January%' OR Period LIKE 'February%' OR Period LIKE 'March%' THEN 'Q1'
          WHEN Period LIKE 'April%' OR Period LIKE 'May%' OR Period LIKE 'June%' THEN 'Q2'
          WHEN Period LIKE 'July%' OR Period LIKE 'August%' OR Period LIKE 'September%' THEN 'Q3'
          WHEN Period LIKE 'October%' OR Period LIKE 'November%' OR Period LIKE 'December%' THEN 'Q4'
        END,
        CASE 
          WHEN Period LIKE '%2027%' THEN 2027
          WHEN Period LIKE '%2026%' THEN 2026
          WHEN Period LIKE '%2025%' THEN 2025
          WHEN Period LIKE '%2024%' THEN 2024
          WHEN Period LIKE '%2023%' THEN 2023
          WHEN Period LIKE '%2022%' THEN 2022
          ELSE YEAR(GETDATE())
        END
      HAVING SUM(RebateBalance) > 0
    `;
    
    const balanceRequest = ownPool.request();
    if (cardCode) {
      balanceRequest.input('cardCode', sql.NVarChar(50), cardCode);
    }
    if (rebateType) {
      balanceRequest.input('rebateType', sql.NVarChar(50), rebateType);
    }
    
    const result = await balanceRequest.query(balanceQuery);
    const balances = result.recordset;
    
    console.log(`📊 Found ${balances.length} previous quarter balances to carry over`);
    
    // Insert beginning balance records for NEXT quarter
    const insertedBalances = [];
    
    for (const balance of balances) {
      const {
        CardCode,
        RebateCode,
        RebateType,
        Quarter,
        Year,
        QuarterBalance
      } = balance;
      
      // Determine next quarter and year
      let nextQuarter, nextYear;
      
      if (Quarter === 'Q1') {
        nextQuarter = 2;
        nextYear = Year;
      } else if (Quarter === 'Q2') {
        nextQuarter = 3;
        nextYear = Year;
      } else if (Quarter === 'Q3') {
        nextQuarter = 4;
        nextYear = Year;
      } else if (Quarter === 'Q4') {
        nextQuarter = 1;
        nextYear = Year + 1;
      } else {
        continue; // Skip invalid quarters
      }
      
      const targetPeriod = `Balance of Q${nextQuarter} ${nextYear}`;
      
      // Check if beginning balance already exists for this period
      const checkQuery = `
        SELECT COUNT(*) as Count 
        FROM PayoutHistory 
        WHERE CardCode = @CardCode 
          AND RebateCode = @RebateCode
          AND Period = @Period
          AND Period LIKE 'Balance of Q%'
      `;
      
      const checkResult = await ownPool.request()
        .input('CardCode', sql.NVarChar(50), CardCode)
        .input('RebateCode', sql.NVarChar(50), RebateCode)
        .input('Period', sql.NVarChar(100), targetPeriod)
        .query(checkQuery);
      
      if (checkResult.recordset[0].Count === 0) {
        // Generate payout ID
        const payoutId = `BEGBAL-${CardCode}-${RebateCode}-Q${nextQuarter}-${nextYear}`;
        
        // Insert beginning balance record (NO CalculationNote)
        const insertQuery = `
          INSERT INTO PayoutHistory (
            PayoutId,
            CardCode,
            RebateCode,
            RebateType,
            Period,
            PayoutDate,
            BaseAmount,
            TotalAmount,
            AmountReleased,
            RebateBalance,
            Status,
            CreatedDate,
            UpdatedDate
          )
          VALUES (
            @PayoutId,
            @CardCode,
            @RebateCode,
            @RebateType,
            @Period,
            @PayoutDate,
            @BaseAmount,
            @TotalAmount,
            @AmountReleased,
            @RebateBalance,
            @Status,
            GETDATE(),
            GETDATE()
          )
        `;
        
        await ownPool.request()
          .input('PayoutId', sql.NVarChar(100), payoutId)
          .input('CardCode', sql.NVarChar(50), CardCode)
          .input('RebateCode', sql.NVarChar(50), RebateCode)
          .input('RebateType', sql.NVarChar(50), RebateType)
          .input('Period', sql.NVarChar(100), targetPeriod)
          .input('PayoutDate', sql.Date, new Date())
          .input('BaseAmount', sql.Decimal(18, 2), 0)
          .input('TotalAmount', sql.Decimal(18, 2), QuarterBalance)
          .input('AmountReleased', sql.Decimal(18, 2), 0)
          .input('RebateBalance', sql.Decimal(18, 2), QuarterBalance)
          .input('Status', sql.NVarChar(50), 'Pending')
          .query(insertQuery);
        
        insertedBalances.push({
          cardCode: CardCode,
          rebateCode: RebateCode,
          rebateType: RebateType,
          fromQuarter: Quarter,
          fromYear: Year,
          toQuarter: nextQuarter,
          toYear: nextYear,
          amount: QuarterBalance
        });
        
        console.log(`✅ Added beginning balance: ${CardCode} - ${RebateCode}: ₱${QuarterBalance} from ${Quarter} ${Year} to Q${nextQuarter} ${nextYear}`);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Added ${insertedBalances.length} beginning balance records`,
      insertedBalances: insertedBalances,
      database: databaseToUse
    });
    
  } catch (error) {
    console.error('❌ Error calculating beginning balance:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Add this endpoint to recalculate beginning balances
router.post('/recalculate-beginning-balances', async (req, res) => {
  try {
    const { db, cardCode, rebateType } = req.body;
    
    console.log(`🔄 Recalculating beginning balances for:`, { db, cardCode, rebateType });
    
    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Delete existing beginning balances for this customer
    const deleteQuery = `
      DELETE FROM PayoutHistory 
      WHERE Period LIKE 'Balance of Q%' 
        ${cardCode ? 'AND CardCode = @cardCode' : ''}
        ${rebateType ? 'AND RebateType = @rebateType' : ''}
    `;
    
    const deleteRequest = ownPool.request();
    if (cardCode) deleteRequest.input('cardCode', sql.NVarChar(50), cardCode);
    if (rebateType) deleteRequest.input('rebateType', sql.NVarChar(50), rebateType);
    
    await deleteRequest.query(deleteQuery);
    console.log(`🧹 Cleared existing beginning balances`);
    
    // Get all quarters with balances
    const balanceQuery = `
      SELECT 
        CardCode,
        RebateCode,
        RebateType,
        CASE 
          WHEN Period LIKE 'January%' OR Period LIKE 'February%' OR Period LIKE 'March%' THEN 1
          WHEN Period LIKE 'April%' OR Period LIKE 'May%' OR Period LIKE 'June%' THEN 2
          WHEN Period LIKE 'July%' OR Period LIKE 'August%' OR Period LIKE 'September%' THEN 3
          WHEN Period LIKE 'October%' OR Period LIKE 'November%' OR Period LIKE 'December%' THEN 4
          WHEN Period LIKE 'Quarter 1%' THEN 1
          WHEN Period LIKE 'Quarter 2%' THEN 2
          WHEN Period LIKE 'Quarter 3%' THEN 3
          WHEN Period LIKE 'Quarter 4%' THEN 4
        END AS Quarter,
        CASE 
          WHEN Period LIKE '%2025%' THEN 2025
          WHEN Period LIKE '%2024%' THEN 2024
          WHEN Period LIKE '%2023%' THEN 2023
          WHEN Period LIKE '%2022%' THEN 2022
          ELSE YEAR(GETDATE())
        END AS Year,
        SUM(RebateBalance) as QuarterBalance
      FROM PayoutHistory
      WHERE Period NOT LIKE 'Balance of Q%'
        AND RebateBalance > 0
        ${cardCode ? 'AND CardCode = @cardCode' : ''}
        ${rebateType ? 'AND RebateType = @rebateType' : ''}
      GROUP BY 
        CardCode,
        RebateCode,
        RebateType,
        CASE 
          WHEN Period LIKE 'January%' OR Period LIKE 'February%' OR Period LIKE 'March%' THEN 1
          WHEN Period LIKE 'April%' OR Period LIKE 'May%' OR Period LIKE 'June%' THEN 2
          WHEN Period LIKE 'July%' OR Period LIKE 'August%' OR Period LIKE 'September%' THEN 3
          WHEN Period LIKE 'October%' OR Period LIKE 'November%' OR Period LIKE 'December%' THEN 4
          WHEN Period LIKE 'Quarter 1%' THEN 1
          WHEN Period LIKE 'Quarter 2%' THEN 2
          WHEN Period LIKE 'Quarter 3%' THEN 3
          WHEN Period LIKE 'Quarter 4%' THEN 4
        END,
        CASE 
          WHEN Period LIKE '%2025%' THEN 2025
          WHEN Period LIKE '%2024%' THEN 2024
          WHEN Period LIKE '%2023%' THEN 2023
          WHEN Period LIKE '%2022%' THEN 2022
          ELSE YEAR(GETDATE())
        END
      HAVING SUM(RebateBalance) > 0
    `;
    
    const balanceRequest = ownPool.request();
    if (cardCode) balanceRequest.input('cardCode', sql.NVarChar(50), cardCode);
    if (rebateType) balanceRequest.input('rebateType', sql.NVarChar(50), rebateType);
    
    const result = await balanceRequest.query(balanceQuery);
    const balances = result.recordset;
    
    console.log(`📊 Found ${balances.length} quarters with balances to process`);
    
    const insertedBalances = [];
    
    // Create beginning balances for next quarter
    for (const balance of balances) {
      const { CardCode, RebateCode, RebateType, Quarter, Year, QuarterBalance } = balance;
      
      // Get next quarter info
      const nextQuarterInfo = getNextQuarterInfo(Quarter, Year);
      const { nextQuarter, nextYear, period: targetPeriod, payoutQuarter: targetPayoutQuarter } = nextQuarterInfo;
      
      // Create beginning balance
      const payoutId = `BAL-${CardCode}-${RebateCode}-Q${nextQuarter}-${nextYear}`;
      
      const beginningBalanceDate = new Date(nextYear, (nextQuarter - 1) * 3, 1);
      const formattedDate = `${beginningBalanceDate.getMonth() + 1}.${beginningBalanceDate.getDate()}.${beginningBalanceDate.getFullYear().toString().slice(-2)}`;
      
      const insertQuery = `
        INSERT INTO PayoutHistory (
          PayoutId,
          CardCode,
          RebateCode,
          RebateType,
          Period,
          PayoutQuarter,
          PayoutDate,
          BaseAmount,
          TotalAmount,
          AmountReleased,
          RebateBalance,
          Status,
          CreatedDate,
          UpdatedDate
        )
        VALUES (
          @PayoutId,
          @CardCode,
          @RebateCode,
          @RebateType,
          @Period,
          @PayoutQuarter,
          @PayoutDate,
          @BaseAmount,
          @TotalAmount,
          @AmountReleased,
          @RebateBalance,
          @Status,
          GETDATE(),
          GETDATE()
        )
      `;
      
      await ownPool.request()
        .input('PayoutId', sql.NVarChar(100), payoutId)
        .input('CardCode', sql.NVarChar(50), CardCode)
        .input('RebateCode', sql.NVarChar(50), RebateCode)
        .input('RebateType', sql.NVarChar(50), RebateType)
        .input('Period', sql.NVarChar(100), targetPeriod)
        .input('PayoutQuarter', sql.NVarChar(20), targetPayoutQuarter)
        .input('PayoutDate', sql.NVarChar(20), formattedDate)
        .input('BaseAmount', sql.Decimal(18, 2), 0)
        .input('TotalAmount', sql.Decimal(18, 2), QuarterBalance)
        .input('AmountReleased', sql.Decimal(18, 2), 0)
        .input('RebateBalance', sql.Decimal(18, 2), QuarterBalance)
        .input('Status', sql.NVarChar(50), 'Beginning Balance')
        .query(insertQuery);
      
      insertedBalances.push({
        cardCode: CardCode,
        rebateCode: RebateCode,
        rebateType: RebateType,
        fromQuarter: Quarter,
        fromYear: Year,
        toQuarter: nextQuarter,
        toYear: nextYear,
        amount: QuarterBalance,
        period: targetPeriod
      });
      
      console.log(`✅ Created beginning balance: ${CardCode} - ${targetPeriod}: ₱${QuarterBalance.toFixed(2)}`);
    }
    
    res.json({
      success: true,
      message: `Recalculated ${insertedBalances.length} beginning balance records`,
      insertedBalances: insertedBalances
    });
    
  } catch (error) {
    console.error('❌ Error recalculating beginning balances:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get payout history with beginning balances included
router.get('/payouts-with-balances/:cardCode?', async (req, res) => {
  try {
    const { cardCode } = req.params;
    const { rebateType, period } = req.query;
    
    console.log(`📊 Fetching payout history with balances from database: ${req.database}`);
    
    let query = `
      SELECT 
        ph.*,
        CASE 
          WHEN ph.Period LIKE 'Balance of Q%' THEN 1
          ELSE 0
        END AS IsBeginningBalance,
        CASE 
          WHEN ph.Period LIKE 'Balance of Q%' THEN 
            SUBSTRING(ph.Period, 13, 4) + '-' + 
            RIGHT('0' + REPLACE(SUBSTRING(ph.Period, 11, 2), 'Q', ''), 2) + '-01'
          ELSE ph.Date
        END AS SortDate
      FROM PayoutHistory ph
      WHERE 1=1
    `;
    
    if (cardCode) {
      query += ` AND ph.CardCode = @CardCode`;
    }
    
    if (rebateType) {
      query += ` AND ph.RebateType = @RebateType`;
    }
    
    if (period) {
      query += ` AND ph.Period LIKE @Period`;
    }
    
    query += ` ORDER BY SortDate DESC, ph.Id DESC`;
    
    const request = req.db.request();
    
    if (cardCode) {
      request.input('CardCode', sql.NVarChar, cardCode);
    }
    
    if (rebateType) {
      request.input('RebateType', sql.NVarChar, rebateType);
    }
    
    if (period) {
      request.input('Period', sql.NVarChar, `%${period}%`);
    }
    
    const result = await request.query(query);
    
    // Group by period to organize beginning balances with their respective months
    const groupedData = {};
    result.recordset.forEach(row => {
      const periodKey = row.Period;
      if (!groupedData[periodKey]) {
        groupedData[periodKey] = [];
      }
      groupedData[periodKey].push(row);
    });
    
    res.json({
      success: true,
      data: result.recordset,
      groupedData: groupedData,
      database: req.database,
      count: result.recordset.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching payout history with balances:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});


const mergePayoutData = (calculatedData, existingData, rebateType) => {
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
          // Calculate balance using the helper function
          const balance = calculateBalance(
            existing.TotalAmount || calculated.amount,
            existing.AmountReleased || calculated.amountReleased || 0
          );
          
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
            Status: calculateStatus(
              existing.Status,
              calculated.eligible,
              calculated.quotaMet,
              rebateType
            ),
            AmountReleased: existing.AmountReleased || calculated.amountReleased || 0,
            Balance: balance,
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
            transactionCount: calculated.transactionCount || 0
          });
        } else {
          // Calculate balance using the helper function
          const balance = calculateBalance(
            calculated.amount,
            calculated.amountReleased || 0
          );
          
          // Create new record structure
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
            Status: calculateStatus(
              calculated.status,
              calculated.eligible,
              calculated.quotaMet,
              rebateType
            ),
            AmountReleased: calculated.amountReleased || 0,
            Balance: balance,
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
            transactionCount: calculated.transactionCount || 0
          });
        }
      } catch (mergeError) {
        console.error(`❌ Error merging record:`, mergeError.message);
      }
    });

    console.log(`✅ Merged ${merged.length} payout records`);
    return merged;
    
  } catch (error) {
    console.error('❌ Error in mergePayoutData:', error);
    return [];
  }
};

const calculateStatus = (existingStatus, isEligible, quotaMet = false, rebateType = 'Fixed') => {
  if (rebateType === 'Fixed' || rebateType === 'Percentage') {
    // For Fixed and Percentage rebates, use quotaMet to determine eligibility
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

const generatePayoutId = (customerCode, rebateCode, identifier) => {
  const cleanCustomerCode = customerCode.replace(/[^a-zA-Z0-9]/g, '');
  const cleanRebateCode = rebateCode.replace(/[^a-zA-Z0-9]/g, '');
  const cleanIdentifier = identifier.replace(/[^a-zA-Z0-9-]/g, '');
  
  const payoutId = `PAY-${cleanCustomerCode}-${cleanRebateCode}-${cleanIdentifier}`;
  
  console.log(`🆔 Generated payout ID: ${payoutId}`);
  return payoutId;
};

// Save payouts to database
const savePayoutsToDatabase = async (payouts, pool) => {
  try {
    console.log(`💾 Saving ${payouts.length} payout records to database`);
    
    // First, apply carry-over to ensure consistent calculations
    const payoutsWithCarryOver = applyBalanceCarryOverToPayouts(payouts);
    
    for (const payout of payoutsWithCarryOver) {
      try {
        const baseAmount = parseFloat(payout.BaseAmount) || 0;
        const totalAmount = parseFloat(payout.TotalAmount) || 0;
        const amountReleased = parseFloat(payout.AmountReleased) || 0;
        const rebateType = payout.RebateType || payout.rebateType || 'Fixed';
        const balance = calculateBalance(totalAmount, amountReleased);
        const status = calculateStatus(
          payout.Status, 
          payout.eligible, 
          payout.quotaMet, 
          rebateType
        );
        
        // Force status to 'No Payout' for months with 0 total amount
        const finalStatus = totalAmount === 0 ? 'No Payout' : status;
        
        // Get quarter string
        const payoutQuarter = getQuarterString(payout.Period, payout.Date);
        
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
              AmountReleased = @AmountReleased,
              RebateBalance = @RebateBalance,
              RebateType = @RebateType,
              PayoutQuarter = @PayoutQuarter,
              UpdatedDate = GETDATE()
            WHERE PayoutId = @PayoutId
          `;
          
          await pool.request()
            .input('PayoutId', sql.NVarChar(100), payout.PayoutId)
            .input('BaseAmount', sql.Decimal(18, 2), baseAmount)
            .input('TotalAmount', sql.Decimal(18, 2), totalAmount)
            .input('Status', sql.NVarChar(50), finalStatus)
            .input('AmountReleased', sql.Decimal(18, 2), amountReleased)
            .input('RebateBalance', sql.Decimal(18, 2), balance)
            .input('RebateType', sql.NVarChar(50), rebateType)
            .input('PayoutQuarter', sql.NVarChar(20), payoutQuarter)
            .query(updateQuery);
            
          console.log(`✅ Updated payout ${payout.PayoutId}: Quarter=${payoutQuarter}, Base=${baseAmount}, Total=${totalAmount}`);
        } else {
          // INSERT new record
          const insertQuery = `
            INSERT INTO PayoutHistory (
              PayoutId, CardCode, RebateCode, RebateType, PayoutDate, Period, 
              PayoutQuarter, BaseAmount, TotalAmount, Status, AmountReleased, RebateBalance
            )
            VALUES (
              @PayoutId, @CardCode, @RebateCode, @RebateType, @PayoutDate, @Period,
              @PayoutQuarter, @BaseAmount, @TotalAmount, @Status, @AmountReleased, @RebateBalance
            )
          `;
          
          await pool.request()
            .input('PayoutId', sql.NVarChar(100), payout.PayoutId)
            .input('CardCode', sql.NVarChar(50), payout.CardCode || '')
            .input('RebateCode', sql.NVarChar(50), payout.RebateCode || '')
            .input('RebateType', sql.NVarChar(50), rebateType)
            .input('PayoutDate', sql.NVarChar(20), payout.Date || '')
            .input('Period', sql.NVarChar(100), payout.Period || '')
            .input('PayoutQuarter', sql.NVarChar(20), payoutQuarter)
            .input('BaseAmount', sql.Decimal(18, 2), baseAmount)
            .input('TotalAmount', sql.Decimal(18, 2), totalAmount)
            .input('Status', sql.NVarChar(50), finalStatus)
            .input('AmountReleased', sql.Decimal(18, 2), amountReleased)
            .input('RebateBalance', sql.Decimal(18, 2), balance)
            .query(insertQuery);
            
          console.log(`✅ Inserted payout ${payout.PayoutId}: Quarter=${payoutQuarter}, Base=${baseAmount}, Total=${totalAmount}`);
        }
        
      } catch (payoutError) {
        console.error(`❌ Error saving payout ${payout?.PayoutId}:`, payoutError.message);
      }
    }
    
    console.log(`✅ Completed saving ${payouts.length} payout records with carry-over`);
    
  } catch (error) {
    console.error('❌ Error in savePayoutsToDatabase:', error);
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

    const databaseToUse = db || 'VAN_OWN';
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
    
    // Calculate balance using the helper function
    const newBalance = calculateBalance(totalAmount, validatedAmountReleased);
    
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

    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Calculate values using helper functions
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
        .input('RebateType', sql.NVarChar(50), payoutData.RebateType || 'Fixed')
        .query(updateQuery);

      console.log(`✅ Updated payout ${payoutData.Id}: Status=${status}, AmountReleased=${amountReleased}`);
    } else {
      // INSERT new record
      const insertQuery = `
        INSERT INTO PayoutHistory (
          PayoutId, CardCode, RebateCode, PayoutDate, Period, 
          TotalAmount, Status, AmountReleased, ReleaseDate, RebateBalance, RebateType
        )
        VALUES (
          @PayoutId, @CardCode, @RebateCode, @PayoutDate, @Period,
          @TotalAmount, @Status, @AmountReleased, @ReleaseDate, @RebateBalance, @RebateType
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
        .input('RebateType', sql.NVarChar(50), payoutData.RebateType || 'Fixed')
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
    
    const databaseToUse = db || 'VAN_OWN';
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
    ` : rebateType === 'Percentage' ? `
      SELECT QtrRebate 
      FROM PerCustRebate 
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

  if (rebateType === 'Fixed' || rebateType === 'Incremental') {
    // Check if eligible
    const eligibleTransactions = transactions.filter(t => t.EligibilityStatus === 'Eligible');
    result.eligible = eligibleTransactions.length > 0;
    result.calculationSteps.push(`Eligible for ${rebateType} rebate: ${result.eligible}`);
    
    if (result.eligible) {
      // Get rebate per bag
      try {
        let rebateQuery;
        if (rebateType === 'Fixed') {
          rebateQuery = `
            SELECT TOP 1 RebatePerBag
            FROM FixProdRebate
            WHERE RebateCode = @rebateCode
          `;
        } else {
          rebateQuery = `
            SELECT TOP 1 RebatePerBag
            FROM IncCustRange
            WHERE RebateCode = @rebateCode
            ORDER BY RangeNo
          `;
        }
        
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
  } else if (rebateType === 'Percentage') {
    // Check if eligible (quota met)
    result.eligible = true; // This will be determined by quota calculation
    result.calculationSteps.push(`Percentage rebate - will check quota separately`);
  }

  result.calculationSteps.push(`Final amount: ${result.amount.toFixed(2)}`);
  result.calculationSteps.push(`Status: ${result.eligible ? 'Pending' : 'No Payout'}`);

  return result;
};

/*===================================================================*/
/*                            SAP JE                                 */
/*===================================================================*/

// Function to fetch SAP Journal Entry data for a customer
const fetchSAPJournalEntries = async (customerCode, periodFrom, periodTo, pool) => {
  try {
    console.log(`📊 [SAP] Fetching journal entries for customer: ${customerCode}`);
    
    // Use SAP database pool
    const sapPool = getPool('VAN'); // Or whatever your SAP DB name is in Nexchem
    
    if (!sapPool) {
      console.log('⚠️ [SAP] SAP database pool not available');
      return { success: false, entries: [] };
    }

    // Parse period dates to get year range if needed
    const startDate = new Date(periodFrom);
    const endDate = new Date(periodTo);
    
    // Build SAP query - Use RefDate to determine the month
    const sapQuery = `
      SELECT 
        BP.ShortName AS CardCode,
        OCRD.CardName,
        T0.RefDate AS DocDate,
        T0.TransId,
        T1.Account,
        T3.AcctName,
        T1.Debit,
        T1.Credit,
        T0.RefDate,
        T0.Memo,
        T1.LineMemo
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
      ORDER BY T0.RefDate DESC
    `;

    const result = await sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('periodFrom', sql.Date, startDate)
      .input('periodTo', sql.Date, endDate)
      .query(sapQuery);

    console.log(`📊 [SAP] Found ${result.recordset.length} journal entries for ${customerCode}`);

    // Process entries - group by the MONTH of the RefDate (document date)
    const entriesByPeriod = {};
    
    result.recordset.forEach(entry => {
      const docDate = new Date(entry.DocDate);
      const year = docDate.getFullYear();
      const month = docDate.getMonth() + 1; // JavaScript months are 0-based
      
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
          transactionIds: new Set()
        };
      }
      
      // Avoid duplicate entries by tracking transaction IDs
      if (!entriesByPeriod[periodKey].transactionIds.has(entry.TransId)) {
        entriesByPeriod[periodKey].totalAmount += netAmount;
        entriesByPeriod[periodKey].transactionIds.add(entry.TransId);
        entriesByPeriod[periodKey].entries.push({
          transId: entry.TransId,
          docDate: entry.DocDate,
          account: entry.Account,
          acctName: entry.AcctName,
          debit: debit,
          credit: credit,
          netAmount: netAmount,
          memo: entry.Memo || entry.LineMemo
        });
      }
    });

    // Convert to array and remove transactionIds before returning
    const resultArray = Object.values(entriesByPeriod).map(item => ({
      periodKey: item.periodKey,
      periodName: item.periodName,
      year: item.year,
      month: item.month,
      totalAmount: item.totalAmount, // This is now net (Debit - Credit)
      entries: item.entries
    }));

    console.log(`📊 [SAP] Grouped into ${resultArray.length} periods based on RefDate (document date):`);
    resultArray.forEach(period => {
      console.log(`  ${period.periodKey} (${period.periodName}): Net Amount: ₱${period.totalAmount.toFixed(2)}`);
    });
    
    return {
      success: true,
      entries: resultArray,
      rawEntries: result.recordset
    };

  } catch (error) {
    console.error('❌ [SAP] Error fetching journal entries:', error);
    return { 
      success: false, 
      entries: [],
      error: error.message 
    };
  }
};

// Add this function to check/create SAP columns in your payout table
const ensureSAPColumnsExist = async (pool) => {
  try {
    // Check if SAP columns exist in your payout table
    const checkColumnsQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'SapReleasedAmount')
      BEGIN
        ALTER TABLE PayoutHistory ADD SapReleasedAmount DECIMAL(18, 2) DEFAULT 0;
      END
      
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PayoutHistory' AND COLUMN_NAME = 'SapLastSync')
      BEGIN
        ALTER TABLE PayoutHistory ADD SapLastSync DATETIME;
      END
    `;
    
    await pool.request().query(checkColumnsQuery);
    console.log('✅ [Van] SAP columns verified/added to PayoutHistory table');
    
  } catch (error) {
    console.error('❌ [Van] Error adding SAP columns:', error);
  }
};


// Add this new endpoint to get SAP journal entries for a customer's payouts
router.get('/customer/:customerCode/sap-journal-entries', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode, periodFrom, periodTo } = req.query;
    
    console.log('💰 [SAP] Fetching journal entries for customer:', {
      customerCode,
      rebateCode,
      periodFrom,
      periodTo
    });

    if (!customerCode) {
      return res.status(400).json({
        success: false,
        message: 'Customer code is required'
      });
    }

    const databaseToUse = db || 'VAN_OWN';
    const ownPool = getPool(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Use SAP database pool
    const sapPool = getPool('VAN');
    
    if (!sapPool) {
      console.log('⚠️ [SAP] SAP database pool not available');
      return res.status(500).json({
        success: false,
        message: 'SAP database pool not available'
      });
    }

    // Parse period dates
    const startDate = periodFrom || `${new Date().getFullYear()}-01-01`;
    const endDate = periodTo || new Date().toISOString().split('T')[0];

    // Build SAP query - Use RefDate to determine the month
    const sapQuery = `
      SELECT 
        BP.ShortName AS CardCode,
        OCRD.CardName,
        T0.RefDate AS DocDate,
        T0.TransId,
        T1.Account,
        T3.AcctName,
        T1.Debit,
        T1.Credit,
        T0.RefDate,
        T0.Memo,
        T1.LineMemo
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
      ORDER BY T0.RefDate DESC
    `;

    const result = await sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('periodFrom', sql.Date, new Date(startDate))
      .input('periodTo', sql.Date, new Date(endDate))
      .query(sapQuery);

    console.log(`📊 [SAP] Found ${result.recordset.length} journal entries for ${customerCode}`);

    // Process entries - group by the MONTH of the RefDate
    const entriesByPeriod = {};
    
    result.recordset.forEach(entry => {
      const docDate = new Date(entry.DocDate);
      const year = docDate.getFullYear();
      const month = docDate.getMonth() + 1; // JavaScript months are 0-based
      
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
          monthName: monthNames[month-1],
          totalAmount: 0,
          entries: [],
          transactionIds: new Set()
        };
      }
      
      // Avoid duplicate entries by tracking transaction IDs
      if (!entriesByPeriod[periodKey].transactionIds.has(entry.TransId)) {
        entriesByPeriod[periodKey].totalAmount += netAmount;
        entriesByPeriod[periodKey].transactionIds.add(entry.TransId);
        entriesByPeriod[periodKey].entries.push({
          transId: entry.TransId,
          docDate: entry.DocDate,
          account: entry.Account,
          acctName: entry.AcctName,
          debit: debit,
          credit: credit,
          netAmount: netAmount,
          memo: entry.Memo || entry.LineMemo
        });
      }
    });

    // Convert to array and remove transactionIds before returning
    const resultArray = Object.values(entriesByPeriod).map(item => ({
      periodKey: item.periodKey,
      periodName: item.periodName,
      year: item.year,
      month: item.month,
      monthName: item.monthName,
      totalAmount: item.totalAmount,
      entries: item.entries
    }));

    console.log(`📊 [SAP] Grouped into ${resultArray.length} periods based on RefDate`);

    // Update the payout table with SAP data
    await syncSAPDataToPayouts(customerCode, rebateCode, resultArray, ownPool);

    res.json({
      success: true,
      data: {
        sapEntries: resultArray,
        customerCode,
        totalEntries: result.recordset.length,
        groupedPeriods: resultArray.length
      }
    });

  } catch (error) {
    console.error('❌ [SAP] Error fetching journal entries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching SAP journal entries',
      error: error.message
    });
  }
});


export default router;