import express from 'express';
import sql from 'mssql';
import { getPool } from '../services/databaseService.js';

const router = express.Router();

const round2 = (n) => {
  const v = parseFloat(n) || 0;
  if (v === 0) return 0;
  const sign = v < 0 ? -1 : 1;
  return sign * Number(Math.round(Number(Math.abs(v) + 'e2')) + 'e-2');
};

// In ALL routes, add better error handling for database pool
const getDatabasePool = (databaseName) => {
  try {
    const pool = getPool(databaseName);
    if (!pool || !pool.connected) {
      console.error(`❌ Database pool for ${databaseName} not available or not connected`);
      return null;
    }
    return pool;
  } catch (error) {
    console.error(`❌ Error getting pool for ${databaseName}:`, error.message);
    return null;
  }
};

// Try to get pool with fallback logic
const getPoolWithFallback = async (databaseName) => {
  const pool = getDatabasePool(databaseName);
  
  if (!pool && databaseName !== 'VCP') {
    console.log(`⚠️ Database ${databaseName} not available, trying VCP...`);
    const fallbackPool = getDatabasePool('VCP');
    return fallbackPool;
  }
  
  return pool;
};

router.route('/rebates')
  .get(async (req, res) => {
    let pool;
    try {
      const { db } = req.query;
      const databaseToUse = db || 'VCP';

      console.log('🗄️ GET Rebates - Using database:', databaseToUse);

      pool = getPool(databaseToUse);
      
      if (!pool) {
        return res.status(500).json({
          success: false,
          message: `Database pool for ${databaseToUse} not available`
        });
      }

      const query = `
        SELECT 
          RebateCode as code,
          RebateType as type,
          DateFrom as [from],
          DateTo as [to],
          IsActive,
          SlpName as salesEmployee,
          Frequency,
          CreatedDate as createdDate  -- ADD THIS LINE
        FROM 
          RebateProgram
        ORDER BY CreatedDate DESC  -- ORDER BY CREATED DATE DESCENDING
      `;

      const result = await pool.request().query(query);

      const transformedData = result.recordset.map(rebate => {
        let isActive;
        
        if (rebate.IsActive === 1 || rebate.IsActive === true || rebate.IsActive === '1') {
          isActive = true;
        } else if (rebate.IsActive === 0 || rebate.IsActive === false || rebate.IsActive === '0') {
          isActive = false;
        } else {
          isActive = false;
        }
        
        return {
          code: rebate.code || 'N/A',
          type: rebate.type || 'N/A',
          from: rebate.from ? new Date(rebate.from).toISOString().split('T')[0] : '',
          to: rebate.to ? new Date(rebate.to).toISOString().split('T')[0] : '',
          active: isActive,
          salesEmployee: rebate.salesEmployee || 'Not specified',
          frequency: rebate.Frequency || 'Quarterly',
          createdDate: rebate.createdDate ? new Date(rebate.createdDate).toISOString() : new Date().toISOString()  // ADD THIS LINE
        };
      });

      res.json({
        success: true,
        data: transformedData,
        database: databaseToUse
      });

    } catch (error) {
      console.error('❌ Error fetching rebates:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching rebates data',
        error: error.message
      });
    }
  })
  .put(async (req, res) => {
    let pool;
    try {
      const { db } = req.query;
      const { rebateCode, status } = req.body;
      
      console.log('🔄 BACKEND PUT: Received request:', {
        rebateCode: rebateCode,
        status: status,
        statusType: typeof status
      });

      if (!rebateCode) {
        return res.status(400).json({
          success: false,
          message: 'Rebate code is required'
        });
      }

      if (status === undefined || status === null) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const isActive = Number(status);
      
      if (isActive !== 0 && isActive !== 1) {
        return res.status(500).json({
          success: false,
          message: `Invalid status value: ${status}. Must be 0 or 1`
        });
      }

      const databaseToUse = db || 'VCP';
      
      pool = getPool(databaseToUse);
      
      if (!pool) {
        return res.status(500).json({
          success: false,
          message: `Database pool for ${databaseToUse} not available`
        });
      }

      const checkResult = await pool.request()
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query('SELECT RebateCode, IsActive FROM RebateProgram WHERE RebateCode = @rebateCode');

      if (checkResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Rebate with code ${rebateCode} not found in database ${databaseToUse}`
        });
      }

      const updateResult = await pool.request()
        .input('isActive', sql.Bit, isActive)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query('UPDATE RebateProgram SET IsActive = @isActive WHERE RebateCode = @rebateCode');

      const verifyResult = await pool.request()
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query('SELECT RebateCode, IsActive FROM RebateProgram WHERE RebateCode = @rebateCode');

      const updatedRecord = verifyResult.recordset[0];

      res.json({
        success: true,
        message: `Rebate ${rebateCode} status updated to ${isActive === 1 ? 'Active' : 'Inactive'}`,
        data: {
          rebateCode: rebateCode,
          isActive: isActive,
          rowsAffected: updateResult.rowsAffected[0]
        }
      });

    } catch (error) {
      console.error('❌ Database error:', error);
      res.status(500).json({
        success: false,
        message: 'Database update failed',
        error: error.message
      });
    }
  });



// Update the generateCompleteMonthlyData function in backend
const generateCompleteMonthlyData = (rawTransactions, rebateItems, startDate, endDate, totalQuota) => {
  const result = [];
  
  // Group raw transactions by month and item
  const monthlyItemMap = new Map();
  
  rawTransactions.forEach(trans => {
    const transactionDate = new Date(trans.Date);
    const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
    const itemKey = trans.RebateItemCode || trans.ItemCode || trans.Item;
    
    if (!itemKey) return;
    
    const combinedKey = `${monthKey}_${itemKey}`;
    
    if (!monthlyItemMap.has(combinedKey)) {
      monthlyItemMap.set(combinedKey, {
        monthKey: monthKey,
        monthName: transactionDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        itemCode: trans.ItemCode,
        itemName: trans.Item,
        rebateItemCode: trans.RebateItemCode,
        totalActualSales: 0,
        totalQtyForReb: 0,
        transactionCount: 0,
        transactions: []
      });
    }
    
    const data = monthlyItemMap.get(combinedKey);
    data.totalActualSales += trans.ActualSales || 0;
    data.totalQtyForReb += trans.QtyForReb || 0;
    data.transactionCount++;
    data.transactions.push(trans);
  });

  // Generate all months in the date range
  const allMonths = [];
  const currentDate = new Date(startDate);
  const endDateTime = new Date(endDate);
  
  // Set to first day of month
  currentDate.setDate(1);
  currentDate.setHours(0, 0, 0, 0);
  
  // Set end date to last day of month
  endDateTime.setDate(1);
  endDateTime.setMonth(endDateTime.getMonth() + 1);
  endDateTime.setDate(0);
  endDateTime.setHours(23, 59, 59, 999);
  
  while (currentDate <= endDateTime) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    allMonths.push({
      monthKey: monthKey,
      monthName: monthName,
      date: new Date(currentDate),
      displayDate: new Date(year, month, 0).toISOString().split('T')[0]
    });
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  // Track cumulative totals
  let cumulativeQty = 0;
  const cumulativeByMonth = new Map();
  
  // Calculate cumulative totals by month
  for (const month of allMonths) {
    // Get all transactions for this month
    const monthTransactions = [];
    rebateItems.forEach(item => {
      const combinedKey = `${month.monthKey}_${item.itemCode}`;
      const monthData = monthlyItemMap.get(combinedKey);
      
      if (monthData) {
        monthTransactions.push(monthData);
        cumulativeQty += monthData.totalQtyForReb;
      }
    });
    
    cumulativeByMonth.set(month.monthKey, {
      cumulativeQty: cumulativeQty,
      monthName: month.monthName
    });
  }

  // Generate final result with all months and all items
  for (const month of allMonths) {
    const monthCumulative = cumulativeByMonth.get(month.monthKey) || { cumulativeQty: 0 };
    
    for (const rebateItem of rebateItems) {
      const combinedKey = `${month.monthKey}_${rebateItem.itemCode}`;
      const monthData = monthlyItemMap.get(combinedKey);
      
      // Calculate for this month and item
      let itemCumulativeQty = 0;
      
      // Calculate item's cumulative up to this month
      for (const prevMonth of allMonths) {
        if (prevMonth.monthKey > month.monthKey) break;
        
        const prevCombinedKey = `${prevMonth.monthKey}_${rebateItem.itemCode}`;
        const prevData = monthlyItemMap.get(prevCombinedKey);
        if (prevData) {
          itemCumulativeQty += prevData.totalQtyForReb;
        }
      }
      
      // Calculate progress and eligibility for this item
      const itemProgress = totalQuota > 0 ? (itemCumulativeQty / totalQuota) * 100 : 0;
      const qtyBal = Math.max(0, totalQuota - itemCumulativeQty);
      
      let eligibilityStatus = 'Not Eligible';
      if (itemCumulativeQty >= totalQuota) {
        eligibilityStatus = 'Eligible';
      } else if (itemCumulativeQty >= (totalQuota * 0.7)) {
        eligibilityStatus = 'Partially Eligible';
      }
      
      const hasData = !!monthData;
      
      result.push({
        Date: month.displayDate,
        DisplayDate: month.monthName,
        Item: hasData ? monthData.itemName : rebateItem.itemName,
        ItemCode: hasData ? (monthData.itemCode || rebateItem.itemCode) : rebateItem.itemCode,
        ActualSales: hasData ? monthData.totalActualSales : 0,
        QtyForReb: hasData ? monthData.totalQtyForReb : 0,
        Progress: itemProgress.toFixed(1),
        QtyBal: qtyBal,
        EligibilityStatus: eligibilityStatus,
        IsEmptyData: !hasData,
        MonthYear: month.monthName,
        CumulativeQty: itemCumulativeQty,
        TotalQuota: totalQuota,
        TransactionCount: hasData ? monthData.transactionCount : 0,
        MonthKey: month.monthKey,
        // Add these new fields for empty months
        IsEmptyMonth: !hasData,
        MonthIndex: allMonths.findIndex(m => m.monthKey === month.monthKey) + 1,
        TotalMonthsInRange: allMonths.length
      });
    }
  }

  // Sort by date (newest first) and then by item
  return result.sort((a, b) => {
    if (a.MonthKey !== b.MonthKey) {
      return b.MonthKey.localeCompare(a.MonthKey);
    }
    return a.Item.localeCompare(b.Item);
  });
};

// Get rebate program details by rebate code
router.get('/rebate/:rebateCode/details', async (req, res) => {
  let pool;
  try {
    const { rebateCode } = req.params;
    const { db } = req.query;
    
    const databaseToUse = db || 'VCP';

    pool = await getPoolWithFallback(databaseToUse);
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: `Database pool for ${databaseToUse} not available`
      });
    }

    if (!rebateCode) {
      return res.status(400).json({
        success: false,
        message: 'Rebate code is required'
      });
    }

    // First get rebate basic info to determine type
    const rebateInfoQuery = `
      SELECT RebateCode, RebateType, SlpName as salesEmployee, DateFrom, DateTo, IsActive, Frequency, QuotaType
      FROM RebateProgram 
      WHERE RebateCode = @rebateCode
    `;

    const rebateInfoResult = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(rebateInfoQuery);

    if (rebateInfoResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Rebate with code ${rebateCode} not found`
      });
    }

    const rebateInfo = rebateInfoResult.recordset[0];
    const rebateType = rebateInfo.RebateType;

    let customers = [];
    let items = [];

// Update the Fixed rebate customer query in the /rebate/:rebateCode/details endpoint
if (rebateType === 'Fixed') {
  // Fixed Rebate - Customers with quotas
const fixedCustomersQuery = `
  SELECT DISTINCT
    T1.CardCode as code,
    T1.CardName as name,
    T1.QtrRebate,
    T2.Id as quotaId,  -- ADDED THIS LINE
    T2.Month,
    T2.TargetQty
  FROM RebateProgram T0
    INNER JOIN FixCustRebate T1 ON T0.RebateCode = T1.RebateCode
    LEFT JOIN FixCustQuota T2 ON T1.Id = T2.CustRebateId
  WHERE T0.RebateCode = @rebateCode
  ORDER BY T1.CardName, T2.Id  -- CHANGED from T2.Month to T2.Id
`;

  const fixedCustomersResult = await pool.request()
    .input('rebateCode', sql.NVarChar(50), rebateCode)
    .query(fixedCustomersQuery);

// Group customers and their monthly quotas
const customerMap = new Map();
fixedCustomersResult.recordset.forEach(row => {
  if (!row.code) return;
  
  if (!customerMap.has(row.code)) {
    customerMap.set(row.code, {
      code: row.code,
      name: row.name,
      qtrRebate: row.QtrRebate || 0,
      quotas: [],
      quotaDetails: [], // NEW: Store quota details with IDs
      type: 'fixed'
    });
  }
  
  if (row.quotaId && row.Month && row.TargetQty !== null) {
    customerMap.get(row.code).quotaDetails.push({
      id: row.quotaId,
      month: row.Month,
      targetQty: row.TargetQty || 0
    });
  }
});

// Convert to array with proper structure
customers = Array.from(customerMap.values()).map(customer => {
  // Sort quotaDetails by id to maintain database order
  customer.quotaDetails.sort((a, b) => a.id - b.id);
  
  // Extract just the target values in order
  const quotaArray = customer.quotaDetails.map(q => q.targetQty);
  
  // Ensure we have at least 3 entries
  while (quotaArray.length < 3) {
    quotaArray.push(0);
  }
  
  return {
    code: customer.code,
    name: customer.name,
    qtrRebate: customer.qtrRebate,
    quotas: quotaArray, // Array of quotas in correct order
    quotaDetails: customer.quotaDetails, // Keep detailed info with IDs
    type: 'fixed'
  };
});


// Fixed Rebate - Items
const fixedItemsQuery = `
  SELECT DISTINCT
    T3.ItemCode as code,
    T3.ItemName as description,
    T3.UnitPerQty,
    T3.UnitOfMeasure as uom,
    T3.RebatePerBag as rebate
  FROM RebateProgram T0
    INNER JOIN FixProdRebate T3 ON T0.RebateCode = T3.RebateCode
  WHERE T0.RebateCode = @rebateCode
  ORDER BY T3.ItemName
`;

const fixedItemsResult = await pool.request()
  .input('rebateCode', sql.NVarChar(50), rebateCode)
  .query(fixedItemsQuery);

items = fixedItemsResult.recordset.map(item => ({
  code: item.code,
  description: item.description,
  unitPerQty: item.UnitPerQty || 1,
  uom: item.uom || '',
  rebate: item.rebate || 0,
  type: 'fixed'
}));

} else if (rebateType === 'Incremental') {
  // Incremental Rebate - Customers with ranges
  const incrementalCustomersQuery = `
    SELECT 
      T1.CardCode as code,
      T1.CardName as name,
      T1.QtrRebate,
      T2.RangeNo as customerRangeNo,
      T2.MinQty as customerMinQty,
      T2.MaxQty as customerMaxQty,
      T2.RebatePerBag as customerRebatePerBag
    FROM RebateProgram T0
      INNER JOIN IncCustRebate T1 ON T0.RebateCode = T1.RebateCode
      LEFT JOIN IncCustRange T2 ON T1.Id = T2.IncCustRebateId
    WHERE T0.RebateCode = @rebateCode
    ORDER BY T1.CardName, T2.RangeNo
  `;

  const incrementalCustomersResult = await pool.request()
    .input('rebateCode', sql.NVarChar(50), rebateCode)
    .query(incrementalCustomersQuery);

  // Group customers and their ranges
  const customerMap = new Map();
  incrementalCustomersResult.recordset.forEach(row => {
    if (!row.code) return;
    
    if (!customerMap.has(row.code)) {
      customerMap.set(row.code, {
        code: row.code,
        name: row.name || 'Unknown Customer',
        qtrRebate: row.QtrRebate || 0,
        ranges: [],
        type: 'incremental'
      });
    }
    
    if (row.customerRangeNo) {
      customerMap.get(row.code).ranges.push({
        rangeNo: row.customerRangeNo,
        minQty: row.customerMinQty || 0,
        maxQty: row.customerMaxQty || 0,
        rebatePerBag: row.customerRebatePerBag || 0
      });
    }
  });

  customers = Array.from(customerMap.values());

  // Incremental Rebate - Items with ranges
  const incrementalItemsQuery = `
    SELECT 
      T3.ItemCode as code,
      T3.ItemName as description,
      T3.UnitPerQty,
      T3.UnitOfMeasure as uom,
      T4.RangeNo as itemRangeNo,
      T4.MinQty as itemMinQty,
      T4.MaxQty as itemMaxQty,
      T4.RebatePerBag as itemRebatePerBag
    FROM RebateProgram T0
      INNER JOIN IncItemRebate T3 ON T0.RebateCode = T3.RebateCode
      LEFT JOIN IncItemRange T4 ON T3.Id = T4.ItemRebateId
    WHERE T0.RebateCode = @rebateCode
    ORDER BY T3.ItemName, T4.RangeNo
  `;

  const incrementalItemsResult = await pool.request()
    .input('rebateCode', sql.NVarChar(50), rebateCode)
    .query(incrementalItemsQuery);

  // Group items and their ranges
  const itemMap = new Map();
  incrementalItemsResult.recordset.forEach(row => {
    if (!row.code) return;
    
    if (!itemMap.has(row.code)) {
      itemMap.set(row.code, {
        code: row.code,
        description: row.description || 'Unknown Item',
        unitPerQty: row.UnitPerQty || 1,
        uom: row.uom || '',
        ranges: [],
        type: 'incremental'
      });
    }
    
    if (row.itemRangeNo) {
      itemMap.get(row.code).ranges.push({
        rangeNo: row.itemRangeNo,
        minQty: row.itemMinQty || 0,
        maxQty: row.itemMaxQty || 0,
        rebatePerBag: row.itemRebatePerBag || 0
      });
    }
  });

  items = Array.from(itemMap.values());
}// In the Percentage rebate section, update the customer query to include qtrRebate:
else if (rebateType === 'Percentage') {
  // Percentage Rebate - Customers with quotas
// Percentage Rebate - Customers with quotas
const percentageCustomersQuery = `
  SELECT DISTINCT
    T1.CardCode as code,
    T1.CardName as name,
    T1.QtrRebate,
    T2.Id as quotaId,  -- ADDED THIS LINE
    T2.Month,
    T2.TargetQty
  FROM RebateProgram T0
    INNER JOIN PerCustRebate T1 ON T0.RebateCode = T1.RebateCode
    LEFT JOIN PerCustQuota T2 ON T1.Id = T2.PerCustRebateId
  WHERE T0.RebateCode = @rebateCode
  ORDER BY T1.CardName, T2.Id  -- CHANGED from T2.Month to T2.Id
`;

  const percentageCustomersResult = await pool.request()
    .input('rebateCode', sql.NVarChar(50), rebateCode)
    .query(percentageCustomersQuery);

// Group customers and their monthly quotas
const customerMap = new Map();
percentageCustomersResult.recordset.forEach(row => {
  if (!row.code) return;
  
  if (!customerMap.has(row.code)) {
    customerMap.set(row.code, {
      code: row.code,
      name: row.name,
      qtrRebate: row.QtrRebate || 0,
      quotas: [],
      quotaDetails: [], // NEW: Store quota details with IDs
      type: 'percentage'
    });
  }
  
  if (row.quotaId && row.Month && row.TargetQty !== null) {
    customerMap.get(row.code).quotaDetails.push({
      id: row.quotaId,
      month: row.Month,
      targetQty: row.TargetQty || 0
    });
  }
});

// Convert to array with proper structure
customers = Array.from(customerMap.values()).map(customer => {
  // Sort quotaDetails by id to maintain database order
  customer.quotaDetails.sort((a, b) => a.id - b.id);
  
  // Extract just the target values in order
  const quotaArray = customer.quotaDetails.map(q => q.targetQty);
  
  // Ensure we have at least 3 entries
  while (quotaArray.length < 3) {
    quotaArray.push(0);
  }
  
  return {
    code: customer.code,
    name: customer.name,
    qtrRebate: customer.qtrRebate,
    quotas: quotaArray, // Array of quotas in correct order
    quotaDetails: customer.quotaDetails, // Keep detailed info with IDs
    type: 'percentage'
  };
});

  // Percentage Rebate - Items
  const percentageItemsQuery = `
    SELECT 
      T3.ItemCode as code,
      T3.ItemName as description,
      T3.UnitPerQty,
      T3.UnitOfMeasure as uom,
      T3.PercentagePerBag as percentage
    FROM RebateProgram T0
      INNER JOIN PerProdRebate T3 ON T0.RebateCode = T3.RebateCode
    WHERE T0.RebateCode = @rebateCode
    ORDER BY T3.ItemName
  `;

  const percentageItemsResult = await pool.request()
    .input('rebateCode', sql.NVarChar(50), rebateCode)
    .query(percentageItemsQuery);

  items = percentageItemsResult.recordset.map(item => ({
    code: item.code,
    description: item.description,
    unitPerQty: item.UnitPerQty || 1,
    uom: item.uom || '',
    percentage: item.percentage || 0,
    type: 'percentage'
  }));
}

    console.log(`📋 Rebate ${rebateCode} details:`, {
      type: rebateType,
      customersCount: customers.length,
      itemsCount: items.length,
      sampleCustomers: customers.slice(0, 3),
      sampleItems: items.slice(0, 3)
    });

    res.json({
      success: true,
      data: {
        rebateCode: rebateInfo.RebateCode,
        rebateType: rebateType,
        salesEmployee: rebateInfo.salesEmployee || 'Not specified',
        dateFrom: rebateInfo.DateFrom ? new Date(rebateInfo.DateFrom).toISOString().split('T')[0] : '',
        dateTo: rebateInfo.DateTo ? new Date(rebateInfo.DateTo).toISOString().split('T')[0] : '',
        frequency: rebateInfo.Frequency || 'Quarterly',
        quotaType: rebateInfo.QuotaType || 'N/A',
        isActive: rebateInfo.IsActive === 1,
        customers: customers,
        items: items
      }
    });

  } catch (error) {
    console.error('❌ Error fetching rebate details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rebate details',
      error: error.message,
      stack: error.stack
    });
  }
});

// Update customer data based on rebate type - FIXED VERSION
router.put('/rebate/customer', async (req, res) => {
  let pool;
  try {
    const { db } = req.query;
    const { rebateCode, customerCode, qtrRebate, quotas, ranges } = req.body;
    
    const databaseToUse = db || 'VCP';

    pool = await getPoolWithFallback(databaseToUse);
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: `Database pool for ${databaseToUse} not available`
      });
    }

    if (!rebateCode || !customerCode) {
      return res.status(400).json({
        success: false,
        message: 'Rebate code and customer code are required'
      });
    }

    // Get rebate type first
    const rebateTypeResult = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query('SELECT RebateType FROM RebateProgram WHERE RebateCode = @rebateCode');

    if (rebateTypeResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Rebate with code ${rebateCode} not found`
      });
    }

    const rebateType = rebateTypeResult.recordset[0].RebateType;

    if (rebateType === 'Fixed') {
      // Update Fixed customer data
      console.log('🔄 Updating Fixed customer data:', {
        customerCode,
        qtrRebate,
        quotas,
        rebateCode,
        quotasType: typeof quotas,
        quotasLength: Array.isArray(quotas) ? quotas.length : 'Not array'
      });

      // First, check if customer exists in FixCustRebate
      const checkCustomerQuery = `
        SELECT Id FROM FixCustRebate 
        WHERE CardCode = @customerCode AND RebateCode = @rebateCode
      `;
      
      const customerCheck = await pool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(checkCustomerQuery);
      
      if (customerCheck.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Customer ${customerCode} not found in Fixed rebate ${rebateCode}`
        });
      }
      
      const customerId = customerCheck.recordset[0].Id;

      // Update QtrRebate in FixCustRebate
      if (qtrRebate !== undefined) {
        const updateRebateQuery = `
          UPDATE FixCustRebate 
          SET QtrRebate = @qtrRebate 
          WHERE Id = @customerId
        `;
        
        console.log('📝 Updating QtrRebate for customer ID:', customerId, 'Value:', qtrRebate);
        
        await pool.request()
          .input('qtrRebate', sql.Decimal(10, 2), parseFloat(qtrRebate) || 0)
          .input('customerId', sql.Int, customerId)
          .query(updateRebateQuery);
      }

      // Get existing quotas from database with their IDS
      const existingQuotasQuery = `
        SELECT Id, Month, TargetQty 
        FROM FixCustQuota 
        WHERE CustRebateId = @customerId
        ORDER BY Id  -- ORDER BY ID to maintain database order
      `;
      
      const existingQuotas = await pool.request()
        .input('customerId', sql.Int, customerId)
        .query(existingQuotasQuery);
      
      console.log('📋 Existing quotas for customer:', {
        customerId,
        existingQuotasCount: existingQuotas.recordset.length,
        existingQuotas: existingQuotas.recordset.map(q => ({
          id: q.Id,
          month: q.Month,
          target: q.TargetQty
        }))
      });
      
      // If there are no existing quotas, return error - quotas must exist first
      if (existingQuotas.recordset.length === 0) {
        return res.status(400).json({
          success: false,
          message: `No quotas found for customer ${customerCode}. Please create quotas first before editing.`
        });
      }
      
      // Update quotas by matching ORDER (frontend sends quotas in same order as displayed)
      // Ensure quotas is an array
      const quotasArray = Array.isArray(quotas) ? quotas : [];
      
      // Update each quota by ID in the order they appear in the database
      for (let i = 0; i < existingQuotas.recordset.length; i++) {
        const existingQuota = existingQuotas.recordset[i];
        const newValue = quotasArray[i] || 0;
        
        await pool.request()
          .input('targetQty', sql.Decimal(10, 2), parseFloat(newValue) || 0)
          .input('quotaId', sql.Int, existingQuota.Id)
          .query(`
            UPDATE FixCustQuota 
            SET TargetQty = @targetQty
            WHERE Id = @quotaId
          `);
        
        console.log(`Updated quota ID ${existingQuota.Id} (${existingQuota.Month}): ${existingQuota.TargetQty} -> ${newValue}`);
      }
      
      console.log('Fixed customer update completed successfully');
      
    } else if (rebateType === 'Incremental') {
      // Update Incremental customer data
      if (!ranges || !Array.isArray(ranges)) {
        return res.status(400).json({
          success: false,
          message: 'Incremental rebate requires ranges array'
        });
      }

      // Find customer ID first
      const customerCheck = await pool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(`
          SELECT Id FROM IncCustRebate 
          WHERE CardCode = @customerCode AND RebateCode = @rebateCode
        `);
      
      if (customerCheck.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Customer ${customerCode} not found in Incremental rebate ${rebateCode}`
        });
      }
      
      const customerId = customerCheck.recordset[0].Id;

      // Update QtrRebate
      if (qtrRebate !== undefined) {
        await pool.request()
          .input('qtrRebate', sql.Decimal(10, 2), parseFloat(qtrRebate) || 0)
          .input('customerId', sql.Int, customerId)
          .query(`
            UPDATE IncCustRebate 
            SET QtrRebate = @qtrRebate 
            WHERE Id = @customerId
          `);
      }

      // Update ranges by RangeNo
      for (const range of ranges) {
        console.log('Updating range:', range);
        
        await pool.request()
          .input('minQty', sql.Decimal(10, 2), parseFloat(range.minQty) || 0)
          .input('maxQty', sql.Decimal(10, 2), parseFloat(range.maxQty) || 0)
          .input('rebatePerBag', sql.Decimal(10, 2), parseFloat(range.rebatePerBag) || 0)
          .input('rangeNo', sql.Int, range.rangeNo)
          .input('customerId', sql.Int, customerId)
          .query(`
            UPDATE IncCustRange 
            SET MinQty = @minQty, 
                MaxQty = @maxQty, 
                RebatePerBag = @rebatePerBag
            WHERE IncCustRebateId = @customerId AND RangeNo = @rangeNo
          `);
      }
      
      console.log('Incremental customer update completed successfully');
      
    } else if (rebateType === 'Percentage') {
      // Update Percentage customer data
      console.log('🔄 Updating Percentage customer data:', {
        customerCode,
        qtrRebate,
        quotas,
        rebateCode,
        quotasArray: Array.isArray(quotas) ? quotas : 'Not array'
      });

      // First, check if customer exists in PerCustRebate
      const checkCustomerQuery = `
        SELECT Id FROM PerCustRebate 
        WHERE CardCode = @customerCode AND RebateCode = @rebateCode
      `;
      
      const customerCheck = await pool.request()
        .input('customerCode', sql.NVarChar(50), customerCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(checkCustomerQuery);
      
      if (customerCheck.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Customer ${customerCode} not found in Percentage rebate ${rebateCode}`
        });
      }
      
      const customerId = customerCheck.recordset[0].Id;

      // Update QtrRebate in PerCustRebate
      if (qtrRebate !== undefined) {
        const updateRebateQuery = `
          UPDATE PerCustRebate 
          SET QtrRebate = @qtrRebate 
          WHERE Id = @customerId
        `;
        
        console.log('📝 Updating QtrRebate for customer ID:', customerId, 'Value:', qtrRebate);
        
        await pool.request()
          .input('qtrRebate', sql.Decimal(10, 2), parseFloat(qtrRebate) || 0)
          .input('customerId', sql.Int, customerId)
          .query(updateRebateQuery);
      }

      // Get existing quotas from database ORDERED BY ID
      const existingQuotasQuery = `
        SELECT Id, Month, TargetQty 
        FROM PerCustQuota 
        WHERE PerCustRebateId = @customerId
        ORDER BY Id  -- ORDER BY ID to maintain database order
      `;
      
      const existingQuotas = await pool.request()
        .input('customerId', sql.Int, customerId)
        .query(existingQuotasQuery);
      
      console.log('📋 Existing percentage quotas for customer:', {
        customerId,
        existingQuotasCount: existingQuotas.recordset.length,
        existingQuotas: existingQuotas.recordset.map(q => ({
          id: q.Id,
          month: q.Month,
          target: q.TargetQty
        }))
      });
      
      // If there are no existing quotas, return error - quotas must exist first
      if (existingQuotas.recordset.length === 0) {
        return res.status(400).json({
          success: false,
          message: `No quotas found for customer ${customerCode}. Please create quotas first before editing.`
        });
      }
      
      // Ensure quotas is an array
      const quotasArray = Array.isArray(quotas) ? quotas : [];
      
      // Update each quota by ID in order
      for (let i = 0; i < existingQuotas.recordset.length; i++) {
        const existingQuota = existingQuotas.recordset[i];
        const newValue = quotasArray[i] || 0;
        
        await pool.request()
          .input('targetQty', sql.Int, parseInt(newValue) || 0)
          .input('quotaId', sql.Int, existingQuota.Id)
          .query(`
            UPDATE PerCustQuota 
            SET TargetQty = @targetQty
            WHERE Id = @quotaId
          `);
        
        console.log(`Updated percentage quota ID ${existingQuota.Id} (${existingQuota.Month}): ${existingQuota.TargetQty} -> ${newValue}`);
      }
      
      console.log('Percentage customer update completed successfully');
    }

    // Reload updated data to return
    const updatedDetails = await loadRebateDetails(rebateCode, databaseToUse);
    
    res.json({
      success: true,
      message: 'Customer data updated successfully',
      data: updatedDetails
    });

  } catch (error) {
    console.error('❌ Error updating customer data:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating customer data',
      error: error.message,
      stack: error.stack
    });
  }
});

// Helper function to reload rebate details
async function loadRebateDetails(rebateCode, database) {
  try {
    const pool = await getPoolWithFallback(database);
    if (!pool) return null;

    // Get rebate basic info
    const rebateInfoQuery = `
      SELECT RebateCode, RebateType, SlpName as salesEmployee, DateFrom, DateTo, IsActive, Frequency, QuotaType
      FROM RebateProgram 
      WHERE RebateCode = @rebateCode
    `;

    const rebateInfoResult = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(rebateInfoQuery);

    if (rebateInfoResult.recordset.length === 0) {
      return null;
    }

    const rebateInfo = rebateInfoResult.recordset[0];
    const rebateType = rebateInfo.RebateType;

    let customers = [];
    let items = [];

    // Load customers based on rebate type
    if (rebateType === 'Fixed') {
      const customersQuery = `
        SELECT DISTINCT
          T1.CardCode as code,
          T1.CardName as name,
          T1.QtrRebate,
          T2.Id as quotaId,
          T2.Month,
          T2.TargetQty
        FROM RebateProgram T0
          INNER JOIN FixCustRebate T1 ON T0.RebateCode = T1.RebateCode
          LEFT JOIN FixCustQuota T2 ON T1.Id = T2.CustRebateId
        WHERE T0.RebateCode = @rebateCode
        ORDER BY T1.CardName, T2.Id
      `;

      const customersResult = await pool.request()
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(customersQuery);

      const customerMap = new Map();
      customersResult.recordset.forEach(row => {
        if (!row.code) return;
        
        if (!customerMap.has(row.code)) {
          customerMap.set(row.code, {
            code: row.code,
            name: row.name,
            qtrRebate: row.QtrRebate || 0,
            quotas: [],
            type: 'fixed'
          });
        }
        
        if (row.quotaId && row.Month && row.TargetQty !== null) {
          customerMap.get(row.code).quotas.push(row.TargetQty);
        }
      });

      customers = Array.from(customerMap.values());

      // Load Fixed items
      const itemsQuery = `
        SELECT DISTINCT
          T3.ItemCode as code,
          T3.ItemName as description,
          T3.UnitPerQty,
          T3.UnitOfMeasure as uom,
          T3.RebatePerBag as rebate
        FROM RebateProgram T0
          INNER JOIN FixProdRebate T3 ON T0.RebateCode = T3.RebateCode
        WHERE T0.RebateCode = @rebateCode
        ORDER BY T3.ItemName
      `;

      const itemsResult = await pool.request()
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(itemsQuery);

      items = itemsResult.recordset.map(item => ({
        code: item.code,
        description: item.description,
        unitPerQty: item.UnitPerQty || 1,
        uom: item.uom || '',
        rebate: item.rebate || 0,
        type: 'fixed'
      }));

    } else if (rebateType === 'Percentage') {
      // Similar logic for Percentage
      const customersQuery = `
        SELECT 
          T1.CardCode as code,
          T1.CardName as name,
          T1.QtrRebate,
          T2.Id as quotaId,
          T2.Month,
          T2.TargetQty
        FROM RebateProgram T0
          INNER JOIN PerCustRebate T1 ON T0.RebateCode = T1.RebateCode
          LEFT JOIN PerCustQuota T2 ON T1.Id = T2.PerCustRebateId
        WHERE T0.RebateCode = @rebateCode
        ORDER BY T1.CardName, T2.Id
      `;

      const customersResult = await pool.request()
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(customersQuery);

      const customerMap = new Map();
      customersResult.recordset.forEach(row => {
        if (!row.code) return;
        
        if (!customerMap.has(row.code)) {
          customerMap.set(row.code, {
            code: row.code,
            name: row.name,
            qtrRebate: row.QtrRebate || 0,
            quotas: [],
            type: 'percentage'
          });
        }
        
        if (row.quotaId && row.Month && row.TargetQty !== null) {
          customerMap.get(row.code).quotas.push(row.TargetQty);
        }
      });

      customers = Array.from(customerMap.values());

      // Load Percentage items
      const itemsQuery = `
        SELECT 
          T3.ItemCode as code,
          T3.ItemName as description,
          T3.UnitPerQty,
          T3.UnitOfMeasure as uom,
          T3.PercentagePerBag as percentage
        FROM RebateProgram T0
          INNER JOIN PerProdRebate T3 ON T0.RebateCode = T3.RebateCode
        WHERE T0.RebateCode = @rebateCode
        ORDER BY T3.ItemName
      `;

      const itemsResult = await pool.request()
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(itemsQuery);

      items = itemsResult.recordset.map(item => ({
        code: item.code,
        description: item.description,
        unitPerQty: item.UnitPerQty || 1,
        uom: item.uom || '',
        percentage: item.percentage || 0,
        type: 'percentage'
      }));
    }

    return {
      rebateCode: rebateInfo.RebateCode,
      rebateType: rebateType,
      salesEmployee: rebateInfo.salesEmployee || 'Not specified',
      dateFrom: rebateInfo.DateFrom ? new Date(rebateInfo.DateFrom).toISOString().split('T')[0] : '',
      dateTo: rebateInfo.DateTo ? new Date(rebateInfo.DateTo).toISOString().split('T')[0] : '',
      frequency: customer.frequency || 'Quarterly',
      quotaType: rebateInfo.QuotaType || 'N/A',
      isActive: rebateInfo.IsActive === 1,
      customers: customers,
      items: items
    };

  } catch (error) {
    console.error('Error loading rebate details:', error);
    return null;
  }
}

// Update item data based on rebate type
router.put('/rebate/item', async (req, res) => {
  let pool;
  try {
    const { db } = req.query;
    const { rebateCode, itemCode, description, unitPerQty, rebate, ranges } = req.body;
    
    console.log('🔄 PUT /rebate/item received:', {
      rebateCode,
      itemCode,
      description,
      unitPerQty,
      rebate,
      rebateType: 'Need to fetch from DB'
    });

    const databaseToUse = db || 'VCP';

    pool = await getPoolWithFallback(databaseToUse);
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: `Database pool for ${databaseToUse} not available`
      });
    }

    if (!rebateCode || !itemCode) {
      return res.status(400).json({
        success: false,
        message: 'Rebate code and item code are required'
      });
    }

    // Get rebate type first
    const rebateTypeResult = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query('SELECT RebateType FROM RebateProgram WHERE RebateCode = @rebateCode');

    if (rebateTypeResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Rebate with code ${rebateCode} not found`
      });
    }

    const rebateType = rebateTypeResult.recordset[0].RebateType;
    console.log(`📊 Rebate type determined for item update: ${rebateType}`);

    if (rebateType === 'Fixed') {
      // FIXED: Update Fixed item data
      console.log('🔄 Updating Fixed item:', {
        itemCode,
        description,
        unitPerQty,
        rebate,
        rebateCode
      });

      const updateQuery = `
        UPDATE FixProdRebate 
        SET ItemName = @description,
            UnitPerQty = @unitPerQty,
            RebatePerBag = @rebate,
            UnitOfMeasure = @uom
        WHERE ItemCode = @itemCode AND RebateCode = @rebateCode
      `;

      console.log('📝 Executing SQL for Fixed item:', updateQuery);
      
      const result = await pool.request()
        .input('description', sql.NVarChar(255), description || '')
        .input('unitPerQty', sql.Int, parseInt(unitPerQty) || 1)
        .input('rebate', sql.Decimal(10, 2), parseFloat(rebate) || 0)
        .input('uom', sql.NVarChar(50), req.body.uom || '')
        .input('itemCode', sql.NVarChar(50), itemCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(updateQuery);

      console.log('Fixed item update result:', {
        rowsAffected: result.rowsAffected[0],
        updateSuccess: result.rowsAffected[0] > 0
      });

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({
          success: false,
          message: `Item ${itemCode} not found in rebate ${rebateCode}`
        });
      }

    } else if (rebateType === 'Incremental') {
      // Update Incremental item data
      if (!ranges || !Array.isArray(ranges)) {
        return res.status(400).json({
          success: false,
          message: 'Incremental rebate requires ranges array'
        });
      }

      console.log('🔄 Updating Incremental item with ranges:', ranges);

      // Update basic item info in IncItemRebate
      await pool.request()
        .input('description', sql.NVarChar(255), description)
        .input('unitPerQty', sql.Decimal(10, 2), unitPerQty || 1)
        .input('uom', sql.NVarChar(50), req.body.uom || '')
        .input('itemCode', sql.NVarChar(50), itemCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(`
          UPDATE IncItemRebate 
          SET ItemName = @description, UnitPerQty = @unitPerQty, UnitOfMeasure = @uom
          WHERE ItemCode = @itemCode AND RebateCode = @rebateCode
        `);

      // Update ranges in IncItemRange
      for (const range of ranges) {
        await pool.request()
          .input('minQty', sql.Decimal(10, 2), range.minQty || 0)
          .input('maxQty', sql.Decimal(10, 2), range.maxQty || 0)
          .input('rebatePerBag', sql.Decimal(10, 2), range.rebatePerBag || 0)
          .input('rangeNo', sql.Int, range.rangeNo)
          .input('itemCode', sql.NVarChar(50), itemCode)
          .input('rebateCode', sql.NVarChar(50), rebateCode)
          .query(`
            UPDATE T4 
            SET T4.MinQty = @minQty, T4.MaxQty = @maxQty, T4.RebatePerBag = @rebatePerBag
            FROM IncItemRebate T2
            INNER JOIN IncItemRange T4 ON T2.Id = T4.ItemRebateId
            WHERE T2.ItemCode = @itemCode AND T2.RebateCode = @rebateCode AND T4.RangeNo = @rangeNo
          `);
      }

    } else if (rebateType === 'Percentage') {
      // PERCENTAGE: Update Percentage item data
      console.log('🔄 Updating Percentage item:', {
        itemCode,
        description,
        unitPerQty,
        rebate,
        rebateCode
      });

      const updateQuery = `
        UPDATE PerProdRebate 
        SET ItemName = @description, 
            UnitPerQty = @unitPerQty, 
            PercentagePerBag = @rebate,
            UnitOfMeasure = @uom
        WHERE ItemCode = @itemCode AND RebateCode = @rebateCode
      `;

      console.log('📝 Executing SQL for Percentage item:', updateQuery);
      
      const result = await pool.request()
        .input('description', sql.NVarChar(255), description || '')
        .input('unitPerQty', sql.Int, parseInt(unitPerQty) || 1)
        .input('rebate', sql.Int, parseInt(rebate) || 0)
        .input('uom', sql.NVarChar(50), req.body.uom || '')
        .input('itemCode', sql.NVarChar(50), itemCode)
        .input('rebateCode', sql.NVarChar(50), rebateCode)
        .query(updateQuery);

      console.log('Percentage item update result:', {
        rowsAffected: result.rowsAffected[0],
        updateSuccess: result.rowsAffected[0] > 0
      });

      if (result.rowsAffected[0] === 0) {
        return res.status(404).json({
          success: false,
          message: `Item ${itemCode} not found in rebate ${rebateCode}`
        });
      }
    }

    res.json({
      success: true,
      message: 'Item data updated successfully',
      data: {
        rebateCode,
        itemCode,
        rebateType,
        rowsAffected: 1
      }
    });

  } catch (error) {
    console.error('❌ Error updating item data:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating item data',
      error: error.message,
      stack: error.stack
    });
  }
});

// Get detailed customer transaction data - DAILY TRANSACTIONS (Updated for incremental with auto date)
router.get('/customer/:customerCode/transactions', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, periodFrom, periodTo, rebateCode, rebateType, autoLoad, useRebatePeriod } = req.query;
    
    console.log('📊 Fetching DAILY transactions with auto-date:', { 
      customerCode, 
      rebateCode, 
      rebateType, 
      periodFrom, 
      periodTo,
      autoLoad,
      useRebatePeriod
    });
    
    if (!customerCode || !rebateCode || !rebateType) {
      return res.status(400).json({
        success: false,
        message: 'Customer code, rebate code, and rebate type are required'
      });
    }

    const databaseToUse = db || 'VCP';
    const ownPool = await getPoolWithFallback(databaseToUse);
    const sapPool = getDatabasePool('VCP');
    
    if (!ownPool || !sapPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pools not available'
      });
    }

    // Get rebate program period FIRST
    const rebatePeriodQuery = `
      SELECT DateFrom, DateTo, IsActive, Frequency, QuotaType
      FROM RebateProgram
      WHERE RebateCode = @rebateCode
    `;

    const rebatePeriodResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(rebatePeriodQuery);

    let rebateDateFrom = '';
    let rebateDateTo = '';
    let isActive = false;
    let frequency = 'Quarterly';
    let programQuotaType = 'N/A';
    
if (rebatePeriodResult.recordset.length > 0) {
  rebateDateFrom = rebatePeriodResult.recordset[0].DateFrom ? 
    new Date(rebatePeriodResult.recordset[0].DateFrom).toISOString().split('T')[0] : '';
  rebateDateTo = rebatePeriodResult.recordset[0].DateTo ? 
    new Date(rebatePeriodResult.recordset[0].DateTo).toISOString().split('T')[0] : '';
  isActive = rebatePeriodResult.recordset[0].IsActive === 1;
  frequency = rebatePeriodResult.recordset[0].Frequency || 'Quarterly';  // ADD THIS LINE - get frequency from database
  programQuotaType = rebatePeriodResult.recordset[0].QuotaType || 'N/A';

  console.log('📅 Rebate period from database:', { 
    rebateDateFrom, 
    rebateDateTo,
    isActive,
    frequency  // ADD THIS to log
  });
} else {
  console.log('⚠️ Rebate not found in database:', rebateCode);
}

    // Determine date range - NEW LOGIC
    let startDate, endDate;
    let dateSource = 'manual';
    
    if (periodFrom && periodTo) {
      startDate = periodFrom;
      endDate = periodTo;
      dateSource = 'manual';
      console.log('📅 Priority 1: Using manually specified period');
    } else if (useRebatePeriod === 'true' && rebateDateFrom && rebateDateTo && isActive) {
      startDate = rebateDateFrom;
      endDate = rebateDateTo;
      dateSource = 'rebate_period';
      console.log('📅 Priority 2: Using rebate program period (useRebatePeriod=true)');
    } else if (autoLoad === 'true') {
      const today = new Date();
      endDate = today.toISOString().split('T')[0];
      
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setMonth(today.getMonth() - 6);
      startDate = sixMonthsAgo.toISOString().split('T')[0];
      dateSource = 'auto_6months';
      console.log('📅 Priority 3: Using auto-load period (last 6 months)');
    } else if (rebateDateFrom && rebateDateTo) {
      startDate = rebateDateFrom;
      endDate = rebateDateTo;
      dateSource = 'rebate_period_fallback';
      console.log('📅 Priority 4: Using rebate period as fallback');
    } else {
      const today = new Date();
      const currentYear = today.getFullYear();
      startDate = `${currentYear}-01-01`;
      endDate = today.toISOString().split('T')[0];
      dateSource = 'current_year';
      console.log('📅 Priority 5: Using default period (current year)');
    }

    console.log('📅 Final date range:', { 
      startDate, 
      endDate, 
      dateSource
    });

    // Get rebate program details based on type
    let rebateQuery;
    let rebateParams = {
      rebateCode: sql.NVarChar(50),
      customerCode: sql.NVarChar(50)
    };
    
    let rebateItemCodes = [];
    let rebateItemMap = new Map();
    let rebateDetails = {};
    
    if (rebateType === 'Fixed') {
      rebateQuery = `
        SELECT 
          T0.RebateCode,
          T0.RebateType,
          T0.SlpName,
          T0.DateFrom,
          T0.DateTo,
          T0.IsActive,
          T1.CardCode,
          T1.CardName,
          T1.QtrRebate,
          T2.Month,
          T2.TargetQty,
          T3.ItemCode,
          T3.ItemName,
          T3.RebatePerBag,
          T3.UnitPerQty,
          T0.Frequency
        FROM
          RebateProgram T0
          LEFT JOIN FixCustRebate T1 ON T0.RebateCode = T1.RebateCode
          LEFT JOIN FixCustQuota T2 ON T1.Id = T2.CustRebateId
          LEFT JOIN FixProdRebate T3 ON T0.RebateCode = T3.RebateCode
        WHERE
          T0.RebateType = 'Fixed'
          AND T0.RebateCode = @rebateCode
          AND T1.CardCode = @customerCode
      `;
    } else if (rebateType === 'Incremental') {
      rebateQuery = `
        SELECT 
          T0.RebateCode,
          T0.RebateType,
          T0.SlpName,
          T0.DateFrom,
          T0.DateTo,
          T0.IsActive,
          T1.CardCode,
          T1.CardName,
          T1.QtrRebate,
          T2.RangeNo,
          T2.MinQty,
          T2.MaxQty,
          T2.RebatePerBag as CustomerRebatePerBag,
          T3.ItemCode,
          T3.ItemName,
          T3.UnitPerQty,
          T0.Frequency
        FROM
          RebateProgram T0
          LEFT JOIN IncCustRebate T1 ON T0.RebateCode = T1.RebateCode
          LEFT JOIN IncCustRange T2 ON T1.Id = T2.IncCustRebateId
          LEFT JOIN IncItemRebate T3 ON T0.RebateCode = T3.RebateCode
        WHERE
          T0.RebateType = 'Incremental'
          AND T0.RebateCode = @rebateCode
          AND T1.CardCode = @customerCode
        ORDER BY T2.RangeNo
      `;
    } else if (rebateType === 'Percentage') {
      rebateQuery = `
        SELECT 
          T0.RebateCode,
          T0.RebateType,
          T0.SlpName,
          T0.DateFrom,
          T0.DateTo,
          T0.IsActive,
          T1.CardCode,
          T1.CardName,
          T2.Month,
          T2.TargetQty,
          T3.ItemCode,
          T3.ItemName,
          T3.PercentagePerBag,
          T3.UnitPerQty,
          T0.Frequency
        FROM
          RebateProgram T0
          LEFT JOIN PerCustRebate T1 ON T0.RebateCode = T1.RebateCode
          LEFT JOIN PerCustQuota T2 ON T1.Id = T2.PerCustRebateId
          LEFT JOIN PerProdRebate T3 ON T0.RebateCode = T3.RebateCode
        WHERE
          T0.RebateType = 'Percentage'
          AND T0.RebateCode = @rebateCode
          AND T1.CardCode = @customerCode
      `;
    }

    const rebateResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .input('customerCode', sql.NVarChar(50), customerCode)
      .query(rebateQuery);

    if (rebateResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `${rebateType} rebate data not found for customer ${customerCode}`
      });
    }

    // Extract rebate details
    const firstRecord = rebateResult.recordset[0];
    rebateDetails = {
      rebateCode: firstRecord.RebateCode,
      rebateType: firstRecord.RebateType,
      salesEmployee: firstRecord.SlpName,
      dateFrom: firstRecord.DateFrom ? new Date(firstRecord.DateFrom).toISOString().split('T')[0] : '',
      dateTo: firstRecord.DateTo ? new Date(firstRecord.DateTo).toISOString().split('T')[0] : '',
      isActive: firstRecord.IsActive,
      quotaType: programQuotaType,
      customer: {
        code: firstRecord.CardCode,
        name: firstRecord.CardName
      }
    };

    // Get unique rebate item codes
    rebateResult.recordset.forEach(row => {
      if (row.ItemCode && !rebateItemMap.has(row.ItemCode)) {
        rebateItemMap.set(row.ItemCode, {
          itemCode: row.ItemCode,
          itemName: row.ItemName,
          unitPerQty: row.UnitPerQty || 1,
          rebatePerBag: row.RebatePerBag || row.CustomerRebatePerBag || 0,
          percentagePerBag: row.PercentagePerBag || 0
        });
        rebateItemCodes.push(row.ItemCode);
      }
    });

let customerRanges = [];
const itemRangesMap = new Map();    // ✅ NEW

if (rebateType === 'Incremental') {
  const customerRangeSet = new Set();
  rebateResult.recordset.forEach(row => {
    if (row.RangeNo && !customerRangeSet.has(`${row.RangeNo}|${row.MinQty}|${row.MaxQty}`)) {
      customerRanges.push({
        rangeNo: row.RangeNo,
        minQty: row.MinQty || 0,
        maxQty: row.MaxQty || 0,
        rebatePerBag: row.CustomerRebatePerBag || 0
      });
      customerRangeSet.add(`${row.RangeNo}|${row.MinQty}|${row.MaxQty}`);
    }
  });
  customerRanges.sort((a, b) => a.rangeNo - b.rangeNo);

  // ✅ NEW: fetch item-level ranges from IncItemRange
  try {
    const itemRangesResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(`
        SELECT T3.ItemCode, T4.RangeNo, T4.MinQty, T4.MaxQty, T4.RebatePerBag
        FROM IncItemRebate T3
        INNER JOIN IncItemRange T4 ON T3.Id = T4.ItemRebateId
        WHERE T3.RebateCode = @rebateCode
        ORDER BY T3.ItemCode, T4.RangeNo
      `);

    itemRangesResult.recordset.forEach(r => {
      if (!r.ItemCode || !r.RangeNo) return;
      if (!itemRangesMap.has(r.ItemCode)) itemRangesMap.set(r.ItemCode, []);
      itemRangesMap.get(r.ItemCode).push({
        rangeNo: r.RangeNo,
        minQty: r.MinQty || 0,
        maxQty: r.MaxQty || 0,
        rebatePerBag: r.RebatePerBag || 0
      });
    });
  } catch (e) {
    console.warn('⚠️ Could not fetch IncItemRange fallback:', e.message);
  }

  // ✅ Seed customerRanges from item ranges if customer has none
  if (customerRanges.length === 0 && itemRangesMap.size > 0) {
    const firstItem = itemRangesMap.values().next().value || [];
    firstItem.forEach(r => {
      customerRanges.push({
        rangeNo: r.rangeNo,
        minQty: r.minQty,
        maxQty: r.maxQty,
        rebatePerBag: r.rebatePerBag
      });
    });
    customerRanges.sort((a, b) => a.rangeNo - b.rangeNo);
  }

  rebateDetails.ranges = customerRanges;
} else if (rebateType === 'Fixed' || rebateType === 'Percentage') {
      // Store quotas as an object with month-target pairs
      const quotas = {};
      rebateResult.recordset.forEach(row => {
        if (row.Month && row.TargetQty !== null) {
          quotas[row.Month] = row.TargetQty;
        }
      });
      rebateDetails.quotas = quotas;
    }

    console.log(`📋 ${rebateType} items for ${customerCode}:`, rebateItemCodes.length);
    console.log(`📋 Date range for transactions:`, { startDate, endDate, dateSource });

    // If no rebate items found, return empty transactions
    if (rebateItemCodes.length === 0) {
      console.log('⚠️ No rebate items found for this customer');
res.json({
  success: true,
  data: {
    transactions: transactions,
    rebateType: rebateType,
    customerCode: customerCode,
    rebateCode: rebateCode,
    rebateDetails: {
      ...rebateDetails,
      frequency: frequency  // ADD frequency to rebateDetails
    },
    summary: summary,
    rebateItems: Array.from(rebateItemMap.values()),
    dateRange: {
      periodFrom: startDate,
      periodTo: endDate,
      totalDays: summary.totalDays,
      autoLoaded: dateSource !== 'manual',
      dateSource: dateSource,
      rebatePeriodAvailable: !!(rebateDateFrom && rebateDateTo),
      rebatePeriod: {
        from: rebateDateFrom,
        to: rebateDateTo
      },
      frequency: frequency 
    },
    frequency: frequency 
  }
});
    }

    // Get transactions
    let sapQuery = `
      SELECT
        CONVERT(VARCHAR(10), T0.DocDate, 120) as Date,
        T0.ItemCode,
        T0.Dscription as Item,
        T0.Quantity as ActualSales,
        --T0.DocEntry,
        T0.DocNum as InvoiceNumber,
        --T0.NumAtCard as CustomerReference,
        T0.CardName as CustomerName,
        T0.PriceAfVAT,
        T0.Treetype,
        T0.Gtotal
      FROM
        OINV T0
      WHERE
        T0.CardCode = @customerCode
        AND T0.DocType = 'I'
        AND T0.DocDate >= @startDate
        AND T0.DocDate <= @endDate
    `;

    if (rebateItemCodes.length > 0) {
      const paramNames = rebateItemCodes.map((_, index) => `@itemCode${index}`).join(', ');
      sapQuery += ` AND T0.ItemCode IN (${paramNames})`;
    }

    sapQuery += ` ORDER BY T0.DocDate ASC, T0.DocNum ASC`;

    const request = sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate);

    rebateItemCodes.forEach((itemCode, index) => {
      request.input(`itemCode${index}`, sql.NVarChar(50), itemCode);
    });

    const sapResult = await request.query(sapQuery);
    console.log('📄 SAP transactions found:', sapResult.recordset.length);

    // ────────────────────────────────────────────────────────────────────
    // STEP 1 — AR Invoices (OINV) stay exactly as posted.
    //          ARCM (ORIN) come in as separate negative rows.
    // ────────────────────────────────────────────────────────────────────
    const invoiceRows = sapResult.recordset.map(trans => ({
      TransType: 'AR Invoice',
      IsReturn: false,
      Date: trans.Date,
      Item: trans.Item,
      ItemCode: trans.ItemCode,
      ActualSales: trans.ActualSales || 0,
      InvoiceNumber: trans.InvoiceNumber,
      CustomerReference: trans.CustomerReference,
      PriceAfVAT: trans.PriceAfVAT,
      Treetype: trans.Treetype,
      Gtotal: trans.Gtotal || 0
    }));

    let creditMemoRows = [];
    try {
      creditMemoRows = await fetchARCMRows(sapPool, customerCode, rebateItemCodes, startDate, endDate);
      console.log(`📝 ARCM rows added: ${creditMemoRows.length}`);
    } catch (arcmError) {
      console.error('⚠️ ARCM fetch failed, showing invoices only:', arcmError.message);
    }

    const adjustedTransactions = [...invoiceRows, ...creditMemoRows];

    let transactions = [];
    let totalQuota = 0;

    if (rebateType === 'Fixed') {
      totalQuota = Object.values(rebateDetails.quotas || {}).reduce((sum, quota) => sum + quota, 0);
      transactions = processFixedTransactions(adjustedTransactions, rebateItemMap, totalQuota, rebateDetails, frequency);
    } else if (rebateType === 'Incremental') {
      transactions = processIncrementalTransactions(adjustedTransactions, rebateItemMap, customerRanges, rebateDetails, frequency, itemRangesMap);
    } else if (rebateType === 'Percentage') {
      totalQuota = Object.values(rebateDetails.quotas || {}).reduce((sum, quota) => sum + quota, 0);
      transactions = processPercentageTransactions(adjustedTransactions, rebateItemMap, rebateDetails, frequency);
    }

    transactions = transactions.map(trans => ({
      ...trans,
      Treetype: trans.Treetype || 'I' // Make sure this is set appropriately
    }));

    // Sort by date descending for display
    transactions.sort((a, b) => new Date(b.Date) - new Date(a.Date));

    console.log('Processed transactions:', transactions.length);

    // Calculate summary statistics
    const summary = {
      totalTransactions: transactions.length,
      totalActualSales: transactions.reduce((sum, t) => sum + t.ActualSales, 0),
      totalQtyForReb: transactions.reduce((sum, t) => sum + t.QtyForReb, 0),
      totalDays: new Set(transactions.map(t => t.Date)).size,
      eligibleTransactions: transactions.filter(t => t.EligibilityStatus === 'Eligible').length,
      partiallyEligibleTransactions: transactions.filter(t => t.EligibilityStatus === 'Partially Eligible').length,
      notEligibleTransactions: transactions.filter(t => t.EligibilityStatus === 'Not Eligible').length,
      totalQuota: totalQuota,
      overallCumulativeQty: rebateType === 'Fixed' ? 
        Array.from(new Set(transactions.map(t => t.ItemCode))).map(itemCode => {
          const itemTransactions = transactions.filter(t => t.ItemCode === itemCode);
          return itemTransactions[itemTransactions.length - 1]?.CumulativeQtyForReb || 0;
        }).reduce((sum, qty) => sum + qty, 0) : 0,
      progressPercentage: rebateType === 'Fixed' && totalQuota > 0 ? 
        (Array.from(new Set(transactions.map(t => t.ItemCode))).map(itemCode => {
          const itemTransactions = transactions.filter(t => t.ItemCode === itemCode);
          return itemTransactions[itemTransactions.length - 1]?.CumulativeQtyForReb || 0;
        }).reduce((sum, qty) => sum + qty, 0) / totalQuota) * 100 : 0,
      totalRebateAmount: rebateType === 'Incremental' || rebateType === 'Percentage' ? 
        transactions.reduce((sum, t) => sum + (t.RebateAmount || 0), 0) : 0,
      dateRange: {
        startDate: startDate,
        endDate: endDate,
        daysCovered: new Set(transactions.map(t => t.Date)).size
      }
    };

    res.json({
      success: true,
      data: {
        transactions: transactions,
        rebateType: rebateType,
        customerCode: customerCode,
        rebateCode: rebateCode,
        rebateDetails: rebateDetails,
        summary: summary,
        rebateItems: Array.from(rebateItemMap.values()),
        dateRange: {
          periodFrom: startDate,
          periodTo: endDate,
          totalDays: summary.totalDays,
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
    console.error('❌ Error fetching customer daily transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer transactions',
      error: error.message,
      stack: error.stack
    });
  }
});

// ────────────────────────────────────────────────────────────────────────
// STEP 3 — Replaced processFixedTransactions (ARCM rows now flow through
// the same pipeline as invoices with negative qty — no mutation of OINV).
// ────────────────────────────────────────────────────────────────────────
const processFixedTransactions = (sapTransactions, rebateItemMap, totalQuota, rebateDetails, frequency = 'Quarterly') => {
  const transactions = [];
  const itemCumulativeMap = new Map();

  // Array.sort is stable: on the same date, invoices stay before ARCM rows.
  const sortedSapTransactions = [...sapTransactions].sort((a, b) =>
    new Date(a.Date) - new Date(b.Date)
  );

  sortedSapTransactions.forEach(sapTrans => {
    const actualSales = sapTrans.ActualSales || 0;   // negative for ARCM
    const itemCode = sapTrans.ItemCode;
    const itemName = sapTrans.Item;
    const treetype = sapTrans.Treetype;
    const isReturn = !!sapTrans.IsReturn;

    const rebateItem = rebateItemMap.get(itemCode);
    if (!rebateItem) return;

    let qtyForReb = actualSales;
    const unitPerQty = rebateItem.unitPerQty || 1;
    const rebatePerBag = rebateItem.rebatePerBag || 0;

    // 25kg items: convert to bags (works for negative qty too)
    if (itemName && itemName.toLowerCase().includes('25kg')) {
      qtyForReb = unitPerQty > 1 ? actualSales / unitPerQty : actualSales;
    }

    if (!itemCumulativeMap.has(itemCode)) {
      itemCumulativeMap.set(itemCode, 0);
    }

    const currentCumulative = itemCumulativeMap.get(itemCode) + qtyForReb;
    itemCumulativeMap.set(itemCode, currentCumulative);

    const qtyBal = currentCumulative;
    const progress = totalQuota > 0 ? (currentCumulative / totalQuota) * 100 : 0;

    let eligibilityStatus = 'Not Eligible';
    if (currentCumulative >= totalQuota) {
      eligibilityStatus = 'Eligible';
    } else if (currentCumulative >= (totalQuota * 0.7)) {
      eligibilityStatus = 'Partially Eligible';
    }

    transactions.push({
      TransType: sapTrans.TransType || 'AR Invoice',
      IsReturn: isReturn,
      Date: sapTrans.Date,
      Item: itemName,
      ItemCode: itemCode,
      ActualSales: actualSales,
      QtyForReb: qtyForReb,
      Progress: progress.toFixed(1),
      QtyBal: qtyBal,
      Gtotal: sapTrans.Gtotal || 0,
      PriceAfVAT: sapTrans.PriceAfVAT,
      EligibilityStatus: eligibilityStatus,
      QuotaMetThisMonth: eligibilityStatus === 'Eligible',
      CumulativeQtyForReb: currentCumulative,
      ItemCumulativeQty: currentCumulative,
      InvoiceNumber: sapTrans.InvoiceNumber,
      CustomerReference: sapTrans.CustomerReference,
      OriginalInvoiceNumber: sapTrans.OriginalInvoiceNumber,
      RebateItemCode: rebateItem.itemCode,
      RebateItemName: rebateItem.itemName,
      IsEmptyData: false,
      IsMatchingItem: true,
      MonthQuota: totalQuota / (Object.keys(rebateDetails.quotas || {}).length || 3),
      CumulativeQtyForRebDisplay: currentCumulative,
      UnitPerQty: unitPerQty,
      RebatePerBag: rebatePerBag,
      TotalQtyForReb: qtyForReb,
      RebateType: 'Fixed',
      Is25kgItem: itemName && itemName.toLowerCase().includes('25kg'),
      Treetype: treetype,
      AdjustmentNotes: sapTrans.AdjustmentNotes,
      CalculationNote: isReturn
        ? `ARCM ${sapTrans.InvoiceNumber}: ${qtyForReb.toFixed(2)} × ₱${rebatePerBag.toFixed(2)} = ₱${(qtyForReb * rebatePerBag).toFixed(2)}`
        : itemName && itemName.toLowerCase().includes('25kg') && unitPerQty > 1
          ? `${actualSales} ÷ ${unitPerQty} = ${qtyForReb.toFixed(2)}`
          : `${qtyForReb.toFixed(2)} × ₱${rebatePerBag.toFixed(2)} = ₱${(qtyForReb * rebatePerBag).toFixed(2)}`
    });
  });

  return transactions;
};

const processIncrementalTransactions = (
  sapTransactions,
  rebateItemMap,
  customerRanges,
  rebateDetails,
  frequency = 'Quarterly',
  itemRangesMap = new Map()
) => {
  const transactions = [];

  const isMonthly = String(frequency || '').toLowerCase() === 'monthly';

  const sortedRanges = customerRanges && customerRanges.length > 0
    ? [...customerRanges].sort((a, b) => a.minQty - b.minQty)
    : [];

  const sortedSapTransactions = [...sapTransactions].sort(
    (a, b) => new Date(a.Date) - new Date(b.Date)
  );

  // ─────────────────────────────────────────────────────────────────
  // PASS 1 — build raw rows with running cumulative per period
  // ─────────────────────────────────────────────────────────────────
  let cumulativeQty = 0;
  let lastMonthKey  = null;

  const rawRows = [];

  sortedSapTransactions.forEach(sapTrans => {
    const rebateItem = rebateItemMap.get(sapTrans.ItemCode);
    if (!rebateItem) return;

    const actualSales = sapTrans.ActualSales || 0;
    const itemName    = sapTrans.Item || '';
    const unitPerQty  = rebateItem.unitPerQty || 1;

    let qtyForReb = actualSales;
    if (itemName.toLowerCase().includes('25kg')) {
      qtyForReb = unitPerQty > 1 ? actualSales / unitPerQty : actualSales;
    }

    const d = new Date(sapTrans.Date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Reset cumulative at each month boundary when Monthly
    if (isMonthly && lastMonthKey !== null && monthKey !== lastMonthKey) {
      cumulativeQty = 0;
    }
    lastMonthKey = monthKey;

    cumulativeQty += qtyForReb;

    rawRows.push({
      sapTrans,
      rebateItem,
      itemName,
      itemCode:    sapTrans.ItemCode,
      actualSales,
      qtyForReb,
      unitPerQty,
      monthKey,
      monthName:   d.toLocaleDateString('en-US', { month: 'long' }),
      cumulativeQty,
      periodKey:   isMonthly ? monthKey : 'period',   // one bucket per period
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // PASS 2 — for each period, find the FINAL tier it reaches, and
  //          lock that single rate for the whole period (retroactive)
  // ─────────────────────────────────────────────────────────────────
  const periodFinalQty = new Map();
  rawRows.forEach(r => {
    // Last row in this period holds the final cumulative
    periodFinalQty.set(r.periodKey, r.cumulativeQty);
  });

  const periodRate = new Map();   // periodKey → number

  rawRows.forEach(r => {
    if (periodRate.has(r.periodKey)) return;

    const finalQty = periodFinalQty.get(r.periodKey) || 0;

    // (a) customer-level ranges
    let bestRange = null;
    for (const range of sortedRanges) {
      if (finalQty >= range.minQty &&
         (finalQty <= range.maxQty || !range.maxQty || range.maxQty === 0)) {
        bestRange = range;
        break;
      }
    }
    // Beyond all customer ranges → use the last one
    if (!bestRange && sortedRanges.length > 0) {
      const last = sortedRanges[sortedRanges.length - 1];
      if (finalQty >= (last.minQty || 0)) bestRange = last;
    }

    // (b) item-level ranges fallback
    if (!bestRange && itemRangesMap.has(r.itemCode)) {
      const itemRanges = [...itemRangesMap.get(r.itemCode)]
        .sort((a, b) => a.minQty - b.minQty);

      for (const range of itemRanges) {
        if (finalQty >= range.minQty &&
           (finalQty <= range.maxQty || !range.maxQty || range.maxQty === 0)) {
          bestRange = range;
          break;
        }
      }
      if (!bestRange && itemRanges.length > 0) {
        const last = itemRanges[itemRanges.length - 1];
        if (finalQty >= (last.minQty || 0)) bestRange = last;
      }
    }

    // (c) item's own configured rate as a last resort
    const fallbackRate =
      r.rebateItem.rebatePerBag ||
      r.rebateItem.customerRebatePerBag ||
      0;

    const rate = bestRange?.rebatePerBag || fallbackRate || 0;
    periodRate.set(r.periodKey, rate);
  });

  // ─────────────────────────────────────────────────────────────────
  // PASS 3 — emit rows, applying the period-wide rate to every row
  // ─────────────────────────────────────────────────────────────────
  rawRows.forEach((r, index) => {
    const rate = periodRate.get(r.periodKey) || 0;
    const rebateAmount = rate > 0 ? round2(r.qtyForReb * rate) : 0; // ✅ Added round2

    // Progress bar = how far the running total got toward the first tier
    let progress = 0;
    if (sortedRanges.length > 0) {
      const firstMin = sortedRanges[0].minQty || 1;
      progress = Math.min((r.cumulativeQty / firstMin) * 100, 100);
    }

    let eligibilityStatus = 'Not Eligible';
    let statusMessage     = 'Not Eligible';

    if (rate > 0) {
      eligibilityStatus = 'Eligible';
      statusMessage     = `Rate ₱${rate.toFixed(2)} (retroactive)`;
    } else if (r.cumulativeQty > 0) {
      eligibilityStatus = 'Progressing';
      statusMessage     = 'Working toward first range';
    }

    transactions.push({
      Date: r.sapTrans.Date,
      Item: r.itemName,
      ItemCode: r.itemCode,
      TransType: r.sapTrans.TransType || 'AR Invoice',
      IsReturn: !!r.sapTrans.IsReturn,
      PriceAfVAT: r.sapTrans.PriceAfVAT,
      ActualSales: r.actualSales,
      QtyForReb: parseFloat(r.qtyForReb.toFixed(2)),
      Progress: parseFloat(progress.toFixed(1)),
      QtyBal: parseFloat(r.cumulativeQty.toFixed(2)),
      EligibilityStatus: eligibilityStatus,
      QuotaMetThisMonth: rate > 0,
      StatusMessage: statusMessage,
      CumulativeQtyForReb: parseFloat(r.cumulativeQty.toFixed(2)),
      InvoiceNumber: r.sapTrans.InvoiceNumber,
      CustomerReference: r.sapTrans.CustomerReference,
      RebateItemCode: r.rebateItem.itemCode,
      RebateItemName: r.rebateItem.itemName,
      RebateType: 'Incremental',
      MonthKey: r.monthKey,
      Gtotal: r.sapTrans.Gtotal || 0,
      MonthName: r.monthName,
      RebatePerBag: rate,                                     // ✅ same for every row in the period
      RebateAmount: rebateAmount,
      IsNewMonth:
        index === 0 || r.monthKey !== rawRows[index - 1].monthKey,
      CalculationNote: rate > 0
        ? `Retroactive rate ₱${rate.toFixed(2)} applied to all contributing rows`
        : 'Not in any range',
      UnitPerQty: r.unitPerQty,
      Is25kgItem: r.itemName && r.itemName.toLowerCase().includes('25kg'),
    });
  });

  return transactions;
};

const processPercentageTransactions = (sapTransactions, rebateItemMap, rebateDetails, frequency) => {
  const transactions = [];
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const monthlyQuotas = rebateDetails.quotas || {};

  const sortedSapTransactions = [...sapTransactions].sort((a, b) => 
    new Date(a.Date) - new Date(b.Date)
  );

  // ══════════════════════════════════════════════════════════════════════
  // PASS 1 — sum adjusted qty per month (respects the 25kg ÷ 2 rule)
  // ══════════════════════════════════════════════════════════════════════
  const monthTotals = new Map();   // "YYYY-MM" → { qty, monthName }

  sortedSapTransactions.forEach(sapTrans => {
    const rebateItem = rebateItemMap.get(sapTrans.ItemCode);
    if (!rebateItem) return;

    const itemName   = sapTrans.Item || '';
    const unitPerQty = rebateItem.unitPerQty || 1;
    let qtyForReb    = sapTrans.ActualSales || 0;

    if (itemName.toLowerCase().includes('25kg')) {
      qtyForReb = unitPerQty > 1 ? qtyForReb / unitPerQty : qtyForReb;
    }

    const d = new Date(sapTrans.Date);
    const monthKey  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthName = monthNames[d.getMonth()];

    if (!monthTotals.has(monthKey)) {
      monthTotals.set(monthKey, { qty: 0, monthName });
    }
    monthTotals.get(monthKey).qty += qtyForReb;
  });

  // ══════════════════════════════════════════════════════════════════════
  // Determine each month's FINAL verdict (met quota or not)
  // ══════════════════════════════════════════════════════════════════════
  const monthVerdict = new Map();  // monthKey → { met, target, achieved, monthName }

  monthTotals.forEach((data, monthKey) => {
    const target   = parseFloat(monthlyQuotas[data.monthName]) || 0;
    const achieved = data.qty;
    // No quota configured for this month → treat as always eligible
    const met      = target > 0 ? achieved >= target : true;

    monthVerdict.set(monthKey, {
      met,
      target,
      achieved,
      monthName: data.monthName,
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // PASS 2 — build rows, applying the month's verdict to every row
  // ══════════════════════════════════════════════════════════════════════
  const runningByMonth = new Map(); // for progressive display only

  sortedSapTransactions.forEach(sapTrans => {
    const actualSales = sapTrans.ActualSales || 0;
    const priceAfVAT  = sapTrans.PriceAfVAT  || 0;
    const itemName    = sapTrans.Item        || '';
    const treetype    = sapTrans.Treetype;

    const rebateItem = rebateItemMap.get(sapTrans.ItemCode);
    if (!rebateItem) return;

    const unitPerQty = rebateItem.unitPerQty      || 1;
    const percentage = rebateItem.percentagePerBag || 0;

    let qtyForReb = actualSales;
    if (itemName.toLowerCase().includes('25kg')) {
      qtyForReb = unitPerQty > 1 ? actualSales / unitPerQty : actualSales;
    }

    const d = new Date(sapTrans.Date);
    const monthKey  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthName = monthNames[d.getMonth()];

    // Running total for progress display
    if (!runningByMonth.has(monthKey)) runningByMonth.set(monthKey, 0);
    runningByMonth.set(monthKey, runningByMonth.get(monthKey) + qtyForReb);
    const running = runningByMonth.get(monthKey);

    const verdict = monthVerdict.get(monthKey) || { met: true, target: 0, achieved: 0, monthName };

    // Raw amount for this line (what WOULD be earned)
    const gtotal          = sapTrans.Gtotal || 0;
    const rawRebateAmount = round2((gtotal * percentage) / 100); // ✅ Added round2

    // Quota gate: only credit rebate if the MONTH met its quota
    const finalRebateAmount = verdict.met ? rawRebateAmount : 0;

    // Status label — reflects the whole month, not the row
    let eligibilityStatus;
    if (!verdict.met) {
      eligibilityStatus = 'Not Eligible';
    } else {
      eligibilityStatus = 'Eligible';
    }

    transactions.push({
      Date: sapTrans.Date,
      Item: itemName,
      ItemCode: sapTrans.ItemCode,
      TransType: sapTrans.TransType || 'AR Invoice',
      IsReturn: !!sapTrans.IsReturn,
      ActualSales: actualSales,
      QtyForReb: qtyForReb,
      Progress: verdict.target > 0
        ? Math.min((running / verdict.target) * 100, 100).toFixed(1)
        : '0.0',
      QtyBal: running,
      EligibilityStatus: eligibilityStatus,
      CumulativeQtyForReb: running,
      ItemCumulativeQty: running,
      InvoiceNumber: sapTrans.InvoiceNumber,
      CustomerReference: sapTrans.CustomerReference,
      RebateItemCode: rebateItem.itemCode,
      RebateItemName: rebateItem.itemName,
      IsEmptyData: false,
      IsMatchingItem: true,
      Gtotal: sapTrans.Gtotal || 0,
      MonthQuota: verdict.target,
      MonthKey: monthKey,
      MonthName: monthName,
      MonthTotalQty: verdict.achieved,       // ⬅️ full month's achieved qty
      UnitPerQty: unitPerQty,
      Percentage: percentage,
      TotalQtyForReb: qtyForReb,
      RebateAmount: finalRebateAmount,        // ⬅️ 0 when month failed quota
      RawRebateAmount: rawRebateAmount,       // ⬅️ keep original for tooltip
      PriceAfVAT: priceAfVAT,
      RebateType: 'Percentage',
      Is25kgItem: itemName.toLowerCase().includes('25kg'),
      Treetype: treetype,
      IsInvoiceType: treetype === 'I',
      QuotaMetThisMonth: verdict.met,         // ⬅️ frontend flag
      CalculationNote:
        itemName.toLowerCase().includes('25kg') && unitPerQty > 1
          ? `${actualSales} ÷ ${unitPerQty} = ${qtyForReb.toFixed(2)}`
          : `${actualSales} × ${priceAfVAT.toFixed(2)} × ${percentage}% = ${rawRebateAmount.toFixed(2)}${
              verdict.met ? '' : ' — quota not met, ₱0 credited'
            }`,
    });
  });

  return transactions;
};

router.get('/test-sap-connection/:customerCode', async (req, res) => {
  try {
    const { customerCode } = req.params;
    
    const sapPool = getDatabasePool('VCP');
    
    if (!sapPool) {
      return res.status(500).json({
        success: false,
        message: 'SAP database pool not available'
      });
    }

    // Simple test query
    const testQuery = `
      SELECT TOP 5
        T0.CardCode,
        T0.CardName,
        CONVERT(VARCHAR(10), T0.DocDate, 120) as Date,
        T0.ItemCode,
        T0.Dscription as Item,
        T0.Quantity,
        T0.PriceAfVAT
      FROM
        OINV T0
      WHERE
        T0.CardCode = @customerCode
        AND T0.DocType = 'I'
      ORDER BY T0.DocDate DESC
    `;

    const result = await sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .query(testQuery);

    res.json({
      success: true,
      data: {
        customerCode: customerCode,
        sapTransactions: result.recordset,
        count: result.recordset.length
      }
    });

  } catch (error) {
    console.error('❌ SAP connection test error:', error);
    res.status(500).json({
      success: false,
      message: 'SAP connection test failed',
      error: error.message
    });
  }
});

// Test SAP connection
router.get('/test-sap-connection', async (req, res) => {
  try {
    const sapPool = getDatabasePool('VCP');
    
    if (!sapPool) {
      return res.status(500).json({
        success: false,
        message: 'SAP database pool not configured'
      });
    }

    // Test query
    const testQuery = `
      SELECT 
        @@SERVERNAME as ServerName,
        DB_NAME() as DatabaseName,
        COUNT(*) as InvoiceCount,
        GETDATE() as CurrentTime
      FROM OINV
      WHERE DocType = 'I'
    `;

    const result = await sapPool.request().query(testQuery);

    res.json({
      success: true,
      data: {
        connection: 'SUCCESS',
        server: result.recordset[0].ServerName,
        database: result.recordset[0].DatabaseName,
        invoiceCount: result.recordset[0].InvoiceCount,
        timestamp: result.recordset[0].CurrentTime
      }
    });

  } catch (error) {
    console.error('❌ SAP connection test error:', error);
    res.status(500).json({
      success: false,
      message: 'SAP connection failed',
      error: error.message,
      stack: error.stack
    });
  }
});


router.get('/test-customer-sap/:customerCode', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const sapPool = getDatabasePool('VCP');
    
    if (!sapPool) {
      return res.status(500).json({
        success: false,
        message: 'SAP database pool not available'
      });
    }

    // Get sample invoices for customer
    const invoiceQuery = `
      SELECT TOP 5
        --T0.DocEntry,
        T0.DocNum,
        CONVERT(VARCHAR(10), T0.DocDate, 120) as DocDate,
        T0.CardCode,
        T0.CardName,
        T0.ItemCode,
        T0.Dscription as ItemDescription,
        T0.Quantity,
        T0.PriceAfVAT
      FROM OINV T0
      WHERE T0.CardCode = @customerCode
        AND T0.DocType = 'I'

      ORDER BY T0.DocDate DESC
    `;

    const result = await sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .query(invoiceQuery);

    // Get customer details
    const customerQuery = `
      SELECT TOP 1
        CardCode,
        CardName,
        Address,
        Phone1,
        CntctPrsn
      FROM OCRD
      WHERE CardCode = @customerCode
    `;

    const customerResult = await sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .query(customerQuery);

    res.json({
      success: true,
      data: {
        customer: customerResult.recordset[0] || null,
        invoices: result.recordset,
        totalInvoices: result.recordset.length
      }
    });

  } catch (error) {
    console.error('❌ Customer SAP test error:', error);
    res.status(500).json({
      success: false,
      message: 'Customer SAP data test failed',
      error: error.message
    });
  }
});

router.get('/debug/rebate/:rebateCode/incremental-data', async (req, res) => {
  let pool;
  try {
    const { rebateCode } = req.params;
    const { db } = req.query;
    
    const databaseToUse = db || 'VCP';
    pool = await getPoolWithFallback(databaseToUse);
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: `Database pool for ${databaseToUse} not available`
      });
    }

    // Check if rebate exists and is incremental
    const rebateCheck = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(`
        SELECT RebateCode, RebateType, IsActive 
        FROM RebateProgram 
        WHERE RebateCode = @rebateCode
      `);

    if (rebateCheck.recordset.length === 0) {
      return res.json({
        success: false,
        message: `Rebate ${rebateCode} not found`
      });
    }

    const rebate = rebateCheck.recordset[0];
    
    if (rebate.RebateType !== 'Incremental') {
      return res.json({
        success: false,
        message: `Rebate ${rebateCode} is not Incremental type`
      });
    }

    // Get customers
    const customersQuery = `
      SELECT 
        T1.CardCode,
        T1.CardName,
        T1.QtrRebate,
        T2.RangeNo,
        T2.MinQty,
        T2.MaxQty,
        T2.RebatePerBag
      FROM IncCustRebate T1
      LEFT JOIN IncCustRange T2 ON T1.Id = T2.IncCustRebateId
      WHERE T1.RebateCode = @rebateCode
      ORDER BY T1.CardName, T2.RangeNo
    `;

    const customersResult = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(customersQuery);

    // Get items
    const itemsQuery = `
      SELECT 
        T3.ItemCode,
        T3.ItemName,
        T3.UnitPerQty,
        T4.RangeNo,
        T4.MinQty,
        T4.MaxQty,
        T4.RebatePerBag
      FROM IncItemRebate T3
      LEFT JOIN IncItemRange T4 ON T3.Id = T4.ItemRebateId
      WHERE T3.RebateCode = @rebateCode
      ORDER BY T3.ItemName, T4.RangeNo
    `;

    const itemsResult = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(itemsQuery);

    res.json({
      success: true,
      data: {
        rebateCode: rebateCode,
        rebateType: rebate.RebateType,
        isActive: rebate.IsActive === 1,
        customers: {
          count: customersResult.recordset.filter(r => r.CardCode).length,
          uniqueCustomers: [...new Set(customersResult.recordset.filter(r => r.CardCode).map(r => r.CardCode))],
          data: customersResult.recordset
        },
        items: {
          count: itemsResult.recordset.filter(r => r.ItemCode).length,
          uniqueItems: [...new Set(itemsResult.recordset.filter(r => r.ItemCode).map(r => r.ItemCode))],
          data: itemsResult.recordset
        }
      }
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug endpoint failed',
      error: error.message
    });
  }
});

// Test item matching between OWN and SAP
router.get('/test-item-matching/:customerCode/:rebateCode', async (req, res) => {
  try {
    const { customerCode, rebateCode } = req.params;
    const ownPool = await getPoolWithFallback('VCP');
    const sapPool = getDatabasePool('VCP');
    
    if (!ownPool || !sapPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pools not available'
      });
    }

    // Get rebate items from OWN
    const rebateItemsQuery = `
      SELECT DISTINCT
        T3.ItemCode,
        T3.ItemName
      FROM RebateProgram T0
      LEFT JOIN FixProdRebate T3 ON T0.RebateCode = T3.RebateCode
      WHERE T0.RebateCode = @rebateCode
    `;

    const rebateItems = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(rebateItemsQuery);

    // Get SAP items for customer
    const sapItemsQuery = `
      SELECT DISTINCT
        T0.ItemCode,
        T0.Dscription as ItemName
      FROM OINV T0
      WHERE T0.CardCode = @customerCode
        AND T0.DocType = 'I'
    `;

    const sapItems = await sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .query(sapItemsQuery);

    // Find matches
    const matchedItems = [];
    const unmatchedRebateItems = [];
    const unmatchedSapItems = [];

    rebateItems.recordset.forEach(rebateItem => {
      const matchingSapItem = sapItems.recordset.find(sapItem => 
        sapItem.ItemCode === rebateItem.ItemCode || 
        sapItem.ItemName === rebateItem.ItemName
      );
      
      if (matchingSapItem) {
        matchedItems.push({
          rebateItemCode: rebateItem.ItemCode,
          rebateItemName: rebateItem.ItemName,
          sapItemCode: matchingSapItem.ItemCode,
          sapItemName: matchingSapItem.ItemName,
          matchType: rebateItem.ItemCode === matchingSapItem.ItemCode ? 'Code Match' : 'Name Match'
        });
      } else {
        unmatchedRebateItems.push(rebateItem);
      }
    });

    // Check SAP items not in rebate
    sapItems.recordset.forEach(sapItem => {
      const isInRebate = rebateItems.recordset.some(rebateItem => 
        rebateItem.ItemCode === sapItem.ItemCode || 
        rebateItem.ItemName === sapItem.ItemName
      );
      
      if (!isInRebate) {
        unmatchedSapItems.push(sapItem);
      }
    });

    res.json({
      success: true,
      data: {
        rebateItemsCount: rebateItems.recordset.length,
        sapItemsCount: sapItems.recordset.length,
        matchedItemsCount: matchedItems.length,
        matchedItems: matchedItems,
        unmatchedRebateItems: unmatchedRebateItems,
        unmatchedSapItems: unmatchedSapItems,
        matchPercentage: rebateItems.recordset.length > 0 ? 
          (matchedItems.length / rebateItems.recordset.length) * 100 : 0
      }
    });

  } catch (error) {
    console.error('❌ Item matching test error:', error);
    res.status(500).json({
      success: false,
      message: 'Item matching test failed',
      error: error.message
    });
  }
});

// Get customer monthly quota performance with auto date handling
router.get('/customer/:customerCode/monthly-quota', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, periodFrom, periodTo, rebateCode, rebateType, useRebatePeriod } = req.query;
    
    console.log('📈 Fetching monthly quota with auto-date:', {
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

    const databaseToUse = db || 'VCP';
    const ownPool = await getPoolWithFallback(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Get rebate program period
    const rebatePeriodQuery = `
      SELECT DateFrom, DateTo, IsActive, Frequency 
      FROM RebateProgram
      WHERE RebateCode = @rebateCode
    `;

    const rebatePeriodResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(rebatePeriodQuery);

    let rebateDateFrom = '';
    let rebateDateTo = '';
    let isActive = false;
    let frequency = 'Quarterly';
    
    if (rebatePeriodResult.recordset.length > 0) {
      rebateDateFrom = rebatePeriodResult.recordset[0].DateFrom ? 
        new Date(rebatePeriodResult.recordset[0].DateFrom).toISOString().split('T')[0] : '';
      rebateDateTo = rebatePeriodResult.recordset[0].DateTo ? 
        new Date(rebatePeriodResult.recordset[0].DateTo).toISOString().split('T')[0] : '';
      isActive = rebatePeriodResult.recordset[0].IsActive === 1;
        frequency = rebatePeriodResult.recordset[0].Frequency || 'Quarterly';
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

    console.log('📅 Monthly quota date range:', { startDate, endDate, dateSource });

    // Get transactions to calculate monthly performance
    const transactionsResponse = await fetch(
      `http://${req.headers.host}/api/dashboard/customer/${customerCode}/transactions?` +
      `db=${databaseToUse}&rebateCode=${rebateCode}&rebateType=${rebateType}&` +
      `periodFrom=${startDate}&periodTo=${endDate}&useRebatePeriod=${useRebatePeriod}`
    );
    
    let monthlyQuotas = [];
    
    if (transactionsResponse.ok) {
      const transactionsData = await transactionsResponse.json();
      
      if (transactionsData.success && transactionsData.data.transactions) {
        // Group transactions by month
        const monthlyGroups = {};
        transactionsData.data.transactions.forEach(trans => {
          const date = new Date(trans.Date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthName = date.toLocaleDateString('en-US', { month: 'short' });
          
          if (!monthlyGroups[monthKey]) {
            monthlyGroups[monthKey] = {
              monthKey: monthKey,
              monthName: monthName,
              totalQtyForReb: 0,
              totalActualSales: 0,
              cumulativeQty: 0
            };
          }
          
          monthlyGroups[monthKey].totalQtyForReb += trans.QtyForReb || trans.ActualSales;
          monthlyGroups[monthKey].totalActualSales += trans.ActualSales;
        });
        
        // Get quota targets and rebate ranges based on rebate type
        let quotaTargets = {};
        let ranges = [];
        
        if (rebateType === 'Fixed') {
          const quotaQuery = `
            SELECT Month, TargetQty
            FROM FixCustRebate T1
            INNER JOIN FixCustQuota T2 ON T1.Id = T2.CustRebateId
            WHERE T1.CardCode = @customerCode AND T1.RebateCode = @rebateCode
          `;
          
          const quotaResult = await ownPool.request()
            .input('customerCode', sql.NVarChar(50), customerCode)
            .input('rebateCode', sql.NVarChar(50), rebateCode)
            .query(quotaQuery);
          
          quotaResult.recordset.forEach(row => {
            if (row.Month && row.TargetQty !== null) {
              quotaTargets[row.Month] = row.TargetQty;
            }
          });
        } else if (rebateType === 'Incremental') {
          // Get ranges for incremental rebate
          const rangesQuery = `
            SELECT RangeNo, MinQty, MaxQty, RebatePerBag
            FROM IncCustRebate T1
            INNER JOIN IncCustRange T2 ON T1.Id = T2.IncCustRebateId
            WHERE T1.CardCode = @customerCode AND T1.RebateCode = @rebateCode
            ORDER BY RangeNo
          `;
          
          const rangesResult = await ownPool.request()
            .input('customerCode', sql.NVarChar(50), customerCode)
            .input('rebateCode', sql.NVarChar(50), rebateCode)
            .query(rangesQuery);
          
          ranges = rangesResult.recordset.map(row => ({
            rangeNo: row.RangeNo,
            minQty: row.MinQty,
            maxQty: row.MaxQty,
            rebatePerBag: row.RebatePerBag
          }));
          
          // Use first range min as target for display
          if (ranges.length > 0) {
            quotaTargets = { 1: ranges[0].minQty };
          }
        } else if (rebateType === 'Percentage') {
          const percentageQuery = `
            SELECT Month, TargetQty
            FROM PerCustRebate T1
            INNER JOIN PerCustQuota T2 ON T1.Id = T2.PerCustRebateId
            WHERE T1.CardCode = @customerCode AND T1.RebateCode = @rebateCode
          `;
          
          const percentageResult = await ownPool.request()
            .input('customerCode', sql.NVarChar(50), customerCode)
            .input('rebateCode', sql.NVarChar(50), rebateCode)
            .query(percentageQuery);
          
          percentageResult.recordset.forEach(row => {
            if (row.Month && row.TargetQty !== null) {
              quotaTargets[row.Month] = row.TargetQty;
            }
          });
        }
        
        // Create monthly quota data
        const sortedMonths = Object.keys(monthlyGroups).sort();
        let cumulativeAchieved = 0;
        
        sortedMonths.forEach((monthKey, index) => {
          const monthData = monthlyGroups[monthKey];
          const achieved = monthData.totalQtyForReb;
          cumulativeAchieved += achieved;
          
          // Get target based on rebate type
          let target = 0;
          let currentRange = null;
          let rebatePerBag = 0;
          let RangeMin = null;
          let RangeMax = null;
          let progress = 0;
          let status = 'Starting';
          
          if (rebateType === 'Fixed') {
            target = quotaTargets[monthData.monthName] || quotaTargets[index + 1] || 
                     (Object.values(quotaTargets).length > 0 ? Object.values(quotaTargets)[0] : 0);
            progress = target > 0 ? Math.min((achieved / target) * 100, 100) : 0;
            status = achieved >= target ? 'Achieved' : 'In Progress';
            
          } else if (rebateType === 'Incremental') {
            // For incremental, find current range based on cumulative achieved
            let foundRange = null;
            for (const range of ranges) {
              if (cumulativeAchieved >= range.minQty && 
                  (range.maxQty === null || cumulativeAchieved <= range.maxQty)) {
                foundRange = range;
                break;
              }
            }
            
            if (foundRange) {
              currentRange = foundRange.rangeNo;
              target = foundRange.minQty;
              RangeMin = foundRange.minQty;
              RangeMax = foundRange.maxQty;
              rebatePerBag = foundRange.rebatePerBag;
              progress = 100; // If in range, consider 100% for current range
              status = 'In Range';
            } else if (ranges.length > 0) {
              // Not in any range yet, find next range
              const nextRange = ranges.find(r => r.minQty > cumulativeAchieved);
              if (nextRange) {
                target = nextRange.minQty;
                RangeMin = nextRange.minQty;
                RangeMax = nextRange.maxQty;
                progress = (cumulativeAchieved / nextRange.minQty) * 100;
                status = 'Working Toward Next Range';
              } else {
                // Beyond all ranges, use last range
                const lastRange = ranges[ranges.length - 1];
                target = lastRange.maxQty || lastRange.minQty;
                RangeMin = lastRange.minQty;
                RangeMax = lastRange.maxQty;
                rebatePerBag = lastRange.rebatePerBag;
                progress = 100;
                status = 'Maximum Range';
              }
            }
            
          } else if (rebateType === 'Percentage') {
            target = quotaTargets[monthData.monthName] || quotaTargets[index + 1] || 
                     (Object.values(quotaTargets).length > 0 ? Object.values(quotaTargets)[0] : 0);
            progress = target > 0 ? Math.min((achieved / target) * 100, 100) : 0;
            status = achieved >= target ? 'Achieved' : 'In Progress';
          }
          
          monthlyQuotas.push({
            month: monthKey,
            monthName: monthData.monthName,
            monthIndex: index + 1,
            quota: target,
            target: target,
            achieved: achieved,
            achievedValue: achieved,
            cumulativeAchieved: cumulativeAchieved,
            progress: progress,
            status: status,
            currentRange: currentRange,
            rebatePerBag: rebatePerBag,
            RangeMin: RangeMin,
            RangeMax: RangeMax,
            isEmptyMonth: achieved === 0,
            // For incremental specific
            displayTarget: RangeMax ? `Max: ${RangeMax}` : `Min: ${RangeMin || 0}`,
            displayAchieved: `Achieved: ${achieved}`,
            displayCumulative: `Cumulative: ${cumulativeAchieved}`,
            displayRange: currentRange ? 
              `Range ${currentRange} (${RangeMin}-${RangeMax || '∞'})` : 
              `Working toward next range`
          });
        });
      }
    }
    
    // If no data, return empty or sample data
    if (monthlyQuotas.length === 0) {
      const currentDate = new Date();
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
        
        monthlyQuotas.push({
          month: monthKey,
          monthName: monthName,
          monthIndex: i + 1,
          quota: 1000,
          target: 1000,
          achieved: 0,
          achievedValue: 0,
          cumulativeAchieved: 0,
          progress: 0,
          status: 'Starting',
          currentRange: null,
          rebatePerBag: 0,
          RangeMin: null,
          RangeMax: null,
          isEmptyMonth: true,
          displayTarget: 'Min: 0',
          displayAchieved: 'Achieved: 0',
          displayCumulative: 'Cumulative: 0',
          displayRange: 'No range data'
        });
      }
    }

    res.json({
      success: true,
      data: {
        monthlyQuotas: monthlyQuotas,
        customerCode: customerCode,
        rebateCode: rebateCode,
        rebateType: rebateType,
        // Include ranges for incremental type
        ...(rebateType === 'Incremental' && {
          ranges: ranges || []
        }),
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
    console.error('❌ Error fetching monthly quota:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly quota data',
      error: error.message
    });
  }
});

// Update payout status
router.put('/payouts/:payoutId/status', async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { db, status } = req.body;
    
    if (!payoutId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Payout ID and status are required'
      });
    }

    const databaseToUse = db || 'VCP';
    const ownPool = await getPoolWithFallback(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Check if PayoutHistory table exists, if not create it
    const tableCheckQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PayoutHistory')
      BEGIN
        CREATE TABLE PayoutHistory (
          Id NVARCHAR(100) PRIMARY KEY,
          CustomerCode NVARCHAR(50),
          RebateCode NVARCHAR(50),
          PayoutDate DATE,
          Period NVARCHAR(100),
          Amount DECIMAL(18, 2),
          Status NVARCHAR(50),
          AmountPaid DECIMAL(18, 2),
          RebateBalance DECIMAL(18, 2),
          CreatedDate DATETIME DEFAULT GETDATE(),
          UpdatedDate DATETIME DEFAULT GETDATE()
        )
      END
    `;
    
    await ownPool.request().query(tableCheckQuery);

    // Update payout status
    const updateQuery = `
      UPDATE PayoutHistory 
      SET Status = @status, 
          UpdatedDate = GETDATE()
      WHERE Id = @payoutId
    `;
    
    const result = await ownPool.request()
      .input('status', sql.NVarChar(50), status)
      .input('payoutId', sql.NVarChar(100), payoutId)
      .query(updateQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: `Payout with ID ${payoutId} not found`
      });
    }

    res.json({
      success: true,
      message: `Payout status updated to ${status} successfully`,
      data: {
        payoutId: payoutId,
        status: status,
        rowsAffected: result.rowsAffected[0]
      }
    });

  } catch (error) {
    console.error('❌ Error updating payout status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payout status',
      error: error.message
    });
  }
});

// Save payout data
router.post('/payouts/save', async (req, res) => {
  try {
    const { db, payoutData } = req.body;
    
    if (!payoutData || !payoutData.Id) {
      return res.status(400).json({
        success: false,
        message: 'Payout data is required'
      });
    }

    const databaseToUse = db || 'VCP';
    const ownPool = await getPoolWithFallback(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Check if PayoutHistory table exists, if not create it
    const tableCheckQuery = `
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PayoutHistory')
      BEGIN
        CREATE TABLE PayoutHistory (
          Id NVARCHAR(100) PRIMARY KEY,
          CustomerCode NVARCHAR(50),
          RebateCode NVARCHAR(50),
          PayoutDate DATE,
          Period NVARCHAR(100),
          Amount DECIMAL(18, 2),
          Status NVARCHAR(50),
          AmountPaid DECIMAL(18, 2),
          RebateBalance DECIMAL(18, 2),
          CreatedDate DATETIME DEFAULT GETDATE(),
          UpdatedDate DATETIME DEFAULT GETDATE()
        )
      END
    `;
    
    await ownPool.request().query(tableCheckQuery);

    // Upsert payout data
    const upsertQuery = `
      MERGE PayoutHistory AS target
      USING (SELECT 
        @Id as Id,
        @CustomerCode as CustomerCode,
        @RebateCode as RebateCode,
        @PayoutDate as PayoutDate,
        @Period as Period,
        @Amount as Amount,
        @Status as Status,
        @AmountPaid as AmountPaid,
        @RebateBalance as RebateBalance
      ) AS source
      ON target.Id = source.Id
      WHEN MATCHED THEN
        UPDATE SET 
          Status = source.Status,
          AmountPaid = source.AmountPaid,
          RebateBalance = source.RebateBalance,
          UpdatedDate = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (Id, CustomerCode, RebateCode, PayoutDate, Period, Amount, Status, AmountPaid, RebateBalance)
        VALUES (source.Id, source.CustomerCode, source.RebateCode, source.PayoutDate, source.Period, 
                source.Amount, source.Status, source.AmountPaid, source.RebateBalance);
    `;
    
    const result = await ownPool.request()
      .input('Id', sql.NVarChar(100), payoutData.Id)
      .input('CustomerCode', sql.NVarChar(50), payoutData.CustomerCode || '')
      .input('RebateCode', sql.NVarChar(50), payoutData.RebateCode || '')
      .input('PayoutDate', sql.Date, payoutData.Date || new Date())
      .input('Period', sql.NVarChar(100), payoutData.Period || '')
      .input('Amount', sql.Decimal(18, 2), payoutData.Amount || 0)
      .input('Status', sql.NVarChar(50), payoutData.Status || 'Pending')
      .input('AmountPaid', sql.Decimal(18, 2), payoutData.AmountReleased || 0)
      .input('RebateBalance', sql.Decimal(18, 2), payoutData.RebateBalance || 0)
      .query(upsertQuery);

    res.json({
      success: true,
      message: 'Payout data saved successfully',
      data: {
        payoutId: payoutData.Id,
        rowsAffected: result.rowsAffected[0]
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

// Add this new endpoint to your backend
// Add this endpoint to get customer/:customerCode/total-achieved
router.get('/customer/:customerCode/total-achieved', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode, rebateType } = req.query;
    
    const databaseToUse = db || 'VCP';
    const ownPool = await getPoolWithFallback(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    if (!customerCode || !rebateCode || !rebateType) {
      return res.status(400).json({
        success: false,
        message: 'Customer code, rebate code, and rebate type are required'
      });
    }

    // Get rebate period first
    const rebatePeriodQuery = `
      SELECT DateFrom, DateTo, IsActive, Frequency 
      FROM RebateProgram
      WHERE RebateCode = @rebateCode
    `;

    const rebatePeriodResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(rebatePeriodQuery);

    let rebateDateFrom = '';
    let rebateDateTo = '';
    
    if (rebatePeriodResult.recordset?.length > 0) {
      rebateDateFrom = rebatePeriodResult.recordset[0].DateFrom ? 
        new Date(rebatePeriodResult.recordset[0].DateFrom).toISOString().split('T')[0] : '';
      rebateDateTo = rebatePeriodResult.recordset[0].DateTo ? 
        new Date(rebatePeriodResult.recordset[0].DateTo).toISOString().split('T')[0] : '';
    }

    // Get rebate item codes
    let itemQuery = '';
    if (rebateType === 'Fixed') {
      itemQuery = `
        SELECT DISTINCT ItemCode
        FROM FixProdRebate
        WHERE RebateCode = @rebateCode
      `;
    } else if (rebateType === 'Incremental') {
      itemQuery = `
        SELECT DISTINCT ItemCode
        FROM IncItemRebate
        WHERE RebateCode = @rebateCode
      `;
    } else if (rebateType === 'Percentage') {
      itemQuery = `
        SELECT DISTINCT ItemCode
        FROM PerProdRebate
        WHERE RebateCode = @rebateCode
      `;
    }

    const itemResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(itemQuery);

    // FIX: Check if recordset exists and is an array
    const itemCodes = itemResult.recordset ? 
      itemResult.recordset.map(row => row.ItemCode).filter(code => code) : 
      [];
    
    if (itemCodes.length === 0) {
      return res.json({
        success: true,
        data: {
          totalAchieved: 0,
          transactionCount: 0,
          dateRange: {
            from: rebateDateFrom,
            to: rebateDateTo
          }
        }
      });
    }

    // Get SAP transactions for ALL rebate items in the period
    const sapPool = getDatabasePool('VCP');
    if (!sapPool) {
      return res.status(500).json({
        success: false,
        message: 'SAP database pool not available'
      });
    }

    const paramNames = itemCodes.map((_, index) => `@itemCode${index}`).join(', ');
    
    const sapQuery = `
      SELECT
        T0.Quantity as ActualSales,
        T0.Dscription as Item,
        T0.DocDate
      FROM
        OINV T0
      WHERE
        T0.CardCode = @customerCode
        AND T0.DocType = 'I'
        AND T0.DocDate >= @startDate
        AND T0.DocDate <= @endDate
        AND T0.ItemCode IN (${paramNames})
      ORDER BY T0.DocDate
    `;

    const request = sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('startDate', sql.Date, rebateDateFrom || '1900-01-01')
      .input('endDate', sql.Date, rebateDateTo || '2999-12-31');

    itemCodes.forEach((itemCode, index) => {
      request.input(`itemCode${index}`, sql.NVarChar(50), itemCode);
    });

    const sapResult = await request.query(sapQuery);
    
    // Calculate total QtyForReb
    let totalAchieved = 0;
    const transactions = sapResult.recordset || [];
    
    transactions.forEach(transaction => {
      const actualSales = transaction.ActualSales || 0;
      const itemName = transaction.Item || '';
      
      // For 25kg items, divide by 2
      if (itemName && itemName.toLowerCase().includes('25kg')) {
        totalAchieved += actualSales / 2;
      } else {
        totalAchieved += actualSales;
      }
    });

    res.json({
      success: true,
      data: {
        totalAchieved: totalAchieved,
        transactionCount: transactions.length,
        dateRange: {
          from: rebateDateFrom,
          to: rebateDateTo
        }
      }
    });

  } catch (error) {
    console.error('❌ Error calculating total achieved:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating total achieved',
      error: error.message,
      stack: error.stack // Include stack trace for debugging
    });
  }
});

router.get('/rebates-summary', async (req, res) => {
  let pool;
  try {
    const { db, periodFrom, periodTo, agent } = req.query;
    
    const databaseToUse = db || 'VCP';
    pool = await getPoolWithFallback(databaseToUse);
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: `Database pool for ${databaseToUse} not available`
      });
    }

    console.log('🔍 Fetching rebates summary with progress calculation and database payout data');

    // Check if PayoutHistory table exists
    const tableCheckQuery = `
      SELECT COUNT(*) as tableCount
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'PayoutHistory' AND TABLE_SCHEMA = 'dbo'
    `;
    
    const tableCheckResult = await pool.request().query(tableCheckQuery);
    const hasPayoutHistory = tableCheckResult.recordset[0]?.tableCount > 0;
    console.log(`PayoutHistory table exists: ${hasPayoutHistory}`);

    // Query for Fixed rebate customers with details
    let fixedQuery = `
      SELECT DISTINCT
        T0.RebateCode,
        T0.RebateType,
        T0.SlpName,
        T0.DateFrom,
        T0.DateTo,
        T0.IsActive,
        T0.Frequency,
        T0.QuotaType,
        T1.CardCode,
        T1.CardName,
        T1.QtrRebate,
        T2.Month,
        T2.TargetQty,
        T3.ItemCode,
        T3.ItemName,
        T3.RebatePerBag,
        T3.UnitPerQty,
        -- Get created date from customer creation or use dateFrom as fallback
        ISNULL(T1.CreatedDate, T0.CreatedDate) as CreatedDate
      FROM
        RebateProgram T0
        LEFT JOIN FixCustRebate T1 ON T0.RebateCode = T1.RebateCode
        LEFT JOIN FixCustQuota T2 ON T1.Id = T2.CustRebateId
        LEFT JOIN FixProdRebate T3 ON T0.RebateCode = T3.RebateCode
      WHERE
        T0.RebateType = 'Fixed'
        AND LTRIM(RTRIM(T1.CardCode)) != ''
        AND T3.ItemCode IS NOT NULL
    `;

    // Query for Percentage rebate customers
    let percentageQuery = `
      SELECT DISTINCT
        T0.RebateCode,
        T0.RebateType,
        T0.SlpName,
        T0.DateFrom,
        T0.DateTo,
        T0.IsActive,
        T0.Frequency,
        T0.QuotaType,
        T1.CardCode,
        T1.CardName,
        T1.QtrRebate,
        T2.Month,
        T2.TargetQty,
        T3.ItemCode,
        T3.ItemName,
        T3.PercentagePerBag,
        T3.UnitPerQty,
        -- Get created date from customer creation or use dateFrom as fallback
        ISNULL(T1.CreatedDate, T0.CreatedDate) as CreatedDate
      FROM
        RebateProgram T0
        LEFT JOIN PerCustRebate T1 ON T0.RebateCode = T1.RebateCode
        LEFT JOIN PerCustQuota T2 ON T1.Id = T2.PerCustRebateId
        LEFT JOIN PerProdRebate T3 ON T0.RebateCode = T3.RebateCode
      WHERE
        T0.RebateType = 'Percentage'
        AND T1.CardCode IS NOT NULL
        AND LTRIM(RTRIM(T1.CardCode)) != ''
        AND T3.ItemCode IS NOT NULL
    `;

    // Query for Incremental rebate customers
    let incrementalQuery = `
      SELECT DISTINCT
        T0.RebateCode,
        T0.RebateType,
        T0.SlpName,
        T0.DateFrom,
        T0.DateTo,
        T0.IsActive,
        T0.Frequency,
        T0.QuotaType,
        T1.CardCode,
        T1.CardName,
        T1.QtrRebate,
        T2.RangeNo,
        T2.MinQty,
        T2.MaxQty,
        T2.RebatePerBag,
        T3.ItemCode,
        T3.ItemName,
        T3.UnitPerQty,
        T4.RangeNo as ItemRangeNo,
        T4.MinQty as ItemMinQty,
        T4.MaxQty as ItemMaxQty,
        T4.RebatePerBag as ItemRebatePerBag,
        -- Get created date from customer creation or use dateFrom as fallback
        ISNULL(T1.CreatedDate, T0.CreatedDate) as CreatedDate
      FROM
        RebateProgram T0
        LEFT JOIN IncCustRebate T1 ON T0.RebateCode = T1.RebateCode
        LEFT JOIN IncCustRange T2 ON T1.Id = T2.IncCustRebateId
        LEFT JOIN IncItemRebate T3 ON T0.RebateCode = T3.RebateCode
        LEFT JOIN IncItemRange T4 ON T3.Id = T4.ItemRebateId
      WHERE
        T0.RebateType = 'Incremental'
        AND T1.CardCode IS NOT NULL
        AND LTRIM(RTRIM(T1.CardCode)) != ''
        AND T3.ItemCode IS NOT NULL
    `;

    // Build WHERE conditions
    const conditions = [];
    const request = pool.request();
    
    if (agent && agent !== 'All') {
      conditions.push('T0.SlpName = @agent');
      request.input('agent', sql.NVarChar(100), agent);
    }
    
    if (periodFrom) {
      conditions.push('T0.DateFrom >= @periodFrom');
      request.input('periodFrom', sql.Date, periodFrom);
    }
    
    if (periodTo) {
      conditions.push('T0.DateTo <= @periodTo');
      request.input('periodTo', sql.Date, periodTo);
    }
    
    if (conditions.length > 0) {
      const whereClause = ' AND ' + conditions.join(' AND ');
      fixedQuery += whereClause;
      incrementalQuery += whereClause;
      percentageQuery += whereClause;
    }

    // Execute all queries
    console.log('Executing queries for rebate data...');
    const [fixedResult, incrementalResult, percentageResult] = await Promise.all([
      request.query(fixedQuery),
      request.query(incrementalQuery),
      request.query(percentageQuery)
    ]);

    const allResults = [
      ...fixedResult.recordset, 
      ...incrementalResult.recordset,
      ...percentageResult.recordset
    ];
    
    console.log(`Results found: ${fixedResult.recordset.length} Fixed, ${incrementalResult.recordset.length} Incremental, ${percentageResult.recordset.length} Percentage`);
    
    // Group by customer to aggregate items and ranges
    const customerMap = new Map();

    allResults.forEach(row => {
      const customerKey = `${row.CardCode}_${row.RebateCode}`;
      
      if (!customerMap.has(customerKey)) {
        // Use CreatedDate if available, otherwise use dateFrom as fallback
        const createdDate = row.CreatedDate || row.DateFrom || new Date();
        
        customerMap.set(customerKey, {
          customer: row.CardName,
          agent: row.SlpName,
          rebateType: row.RebateType,
          code: row.CardCode,
          rebateCode: row.RebateCode,
          dateFrom: row.DateFrom,
          dateTo: row.DateTo,
          isActive: row.IsActive === '1' || row.IsActive === 1 || row.IsActive === true,
          frequency: row.Frequency || 'Quarterly',
          quotaType: row.QuotaType || 'N/A',
          qtrRebate: row.QtrRebate || 0,
          // ADDED: Store the created date for sorting
          createdDate: createdDate,
          quotas: new Map(), // Will store month-target pairs
          items: new Set(),
          itemCodes: new Set(),
          itemDetails: [],
          ranges: [],
          itemRanges: []
        });
      }
      
      const customerData = customerMap.get(customerKey);
      
      // Add quota data for Fixed and Percentage
      if ((row.RebateType === 'Fixed' || row.RebateType === 'Percentage') && row.Month && row.TargetQty !== null) {
        customerData.quotas.set(row.Month, row.TargetQty);
      }
      
      // Add item
      if (row.ItemName && !customerData.items.has(row.ItemName)) {
        customerData.items.add(row.ItemName);
      }
      
      // Add item code
      if (row.ItemCode && !customerData.itemCodes.has(row.ItemCode)) {
        customerData.itemCodes.add(row.ItemCode);
        
        // Store item details based on rebate type
        const itemDetail = {
          itemCode: row.ItemCode,
          itemName: row.ItemName,
          unitPerQty: row.UnitPerQty || 1
        };
        
        if (row.RebateType === 'Fixed') {
          itemDetail.rebatePerBag = row.RebatePerBag || 0;
        } else if (row.RebateType === 'Incremental') {
          itemDetail.minQty = row.ItemMinQty;
          itemDetail.maxQty = row.ItemMaxQty;
          itemDetail.rebatePerBag = row.ItemRebatePerBag;
          itemDetail.rangeNo = row.ItemRangeNo;
        } else if (row.RebateType === 'Percentage') {
          itemDetail.percentagePerBag = row.PercentagePerBag || 0;
        }
        
        customerData.itemDetails.push(itemDetail);
      }
      
      // Add ranges for incremental
      if (row.RebateType === 'Incremental' && row.RangeNo) {
        const range = {
          rangeNo: row.RangeNo,
          minQty: row.MinQty || 0,
          maxQty: row.MaxQty || 0,
          rebatePerBag: row.RebatePerBag || 0
        };
        
        // Check if range already exists
        const exists = customerData.ranges.some(r => 
          r.rangeNo === range.rangeNo && 
          r.minQty === range.minQty && 
          r.maxQty === range.maxQty
        );
        
        if (!exists) {
          customerData.ranges.push(range);
        }
      }
    });

    console.log(`Total unique customers found: ${customerMap.size}`);

    // GET REAL-TIME PAYOUT DATA FROM DATABASE
// GET REAL-TIME PAYOUT DATA FROM DATABASE
const payoutDataMap = new Map();

if (hasPayoutHistory) {
  try {
    // Get all CardCodes and RebateCodes from our map
    const customerKeys = Array.from(customerMap.keys());
    const cardCodes = Array.from(new Set(customerKeys.map(key => key.split('_')[0])));
    const rebateCodes = Array.from(new Set(customerKeys.map(key => key.split('_')[1])));
    
    console.log(`Fetching payout data for ${cardCodes.length} customers...`);
    
    // Check column names
    const columnCheckQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'PayoutHistory' 
      AND TABLE_SCHEMA = 'dbo'
      AND COLUMN_NAME IN ('CardCode', 'CustomerCode', 'BaseAmount', 'AmountReleased')
    `;
    
    const columnResult = await pool.request().query(columnCheckQuery);
    
    if (columnResult.recordset.length >= 3) { // Need at least customer column, BaseAmount, and AmountReleased
      const hasCardCode = columnResult.recordset.some(r => r.COLUMN_NAME === 'CardCode');
      const customerColumn = hasCardCode ? 'CardCode' : 'CustomerCode';
      const hasBaseAmount = columnResult.recordset.some(r => r.COLUMN_NAME === 'BaseAmount');
      const hasAmountReleased = columnResult.recordset.some(r => r.COLUMN_NAME === 'AmountReleased');
      
      if (!hasBaseAmount || !hasAmountReleased) {
        console.log(`⚠️ PayoutHistory table missing required columns: BaseAmount or AmountReleased`);
      } else {
        console.log(`✓ Using '${customerColumn}' column in PayoutHistory table`);
        
        // Build parameterized query - CALCULATE rebate balance as (BaseAmount - AmountReleased)
        const payoutQuery = `
          SELECT 
            ${customerColumn} as CardCode,
            RebateCode,
            SUM(ISNULL(BaseAmount, 0)) AS TotalAmount,
            SUM(ISNULL(AmountReleased, 0)) AS TotalReleased,
            SUM(ISNULL(BaseAmount, 0) - ISNULL(AmountReleased, 0)) AS TotalBalance,
            COUNT(*) as TransactionCount
          FROM PayoutHistory
          WHERE ${customerColumn} IN (${cardCodes.map((_, i) => `@cardCode${i}`).join(',')})
            AND RebateCode IN (${rebateCodes.map((_, i) => `@rebateCode${i}`).join(',')})
          GROUP BY ${customerColumn}, RebateCode
        `;
        
        const payoutRequest = pool.request();
        
        // Add parameters
        cardCodes.forEach((code, index) => {
          payoutRequest.input(`cardCode${index}`, sql.NVarChar(50), code);
        });
        
        rebateCodes.forEach((code, index) => {
          payoutRequest.input(`rebateCode${index}`, sql.NVarChar(50), code);
        });
        
        const payoutResult = await payoutRequest.query(payoutQuery);
        
        console.log(`✓ Found ${payoutResult.recordset.length} payout records in database`);
        
        // Store payout data
        payoutResult.recordset.forEach(row => {
          if (row.CardCode) {
            const key = `${row.CardCode}_${row.RebateCode}`;
            
            const rebateAmount = parseFloat(row.TotalAmount) || 0;
            const paidAmount = parseFloat(row.TotalReleased) || 0;
            // This now calculates balance as (BaseAmount - AmountReleased)
            const rebateBalance = parseFloat(row.TotalBalance) || 0;
            
            // Verify the calculation
            const calculatedBalance = rebateAmount - paidAmount;
            if (Math.abs(rebateBalance - calculatedBalance) > 0.01) {
              console.log(`⚠️ Balance mismatch for ${key}: DB=${rebateBalance}, Calculated=${calculatedBalance}`);
            }
            
            payoutDataMap.set(key, {
              rebateAmount: rebateAmount,
              paidAmount: paidAmount,
              rebateBalance: rebateBalance,
              transactionCount: row.TransactionCount || 0,
              fromDatabase: true
            });
          }
        });
      }
    } else {
      console.log(`⚠️ PayoutHistory table exists but missing required columns`);
    }
    
  } catch (payoutError) {
    console.error('❌ Error fetching payout data:', payoutError.message);
  }
}
    // Convert to array and calculate progress/status
    const customerPromises = Array.from(customerMap.values()).map(async (customer) => {
      const itemsArray = Array.from(customer.items);
      const itemCodesArray = Array.from(customer.itemCodes);
      
      // Calculate progress based on rebate type
      let progress = 0;
      let totalAchieved = 0;
      let quotaStatus = "Starting";
      let rebateStatus = "Not Eligible";
      let currentRange = null;
      let totalQuota = 0;

      try {
        // Fetch transactions to calculate progress
        console.log(`Fetching transactions for ${customer.code} (${customer.rebateCode})...`);
        const transResponse = await fetch(
          `http://192.168.100.193:3009/api/dashboard/customer/${customer.code}/transactions?` +
          `db=${databaseToUse}&rebateCode=${customer.rebateCode}&rebateType=${customer.rebateType}&` +
          `useRebatePeriod=true`
        );
        
        if (transResponse.ok) {
          const transData = await transResponse.json();
          if (transData.success && transData.data.transactions) {
            // Sum all QtyForReb values
            totalAchieved = transData.data.transactions.reduce((sum, t) => {
              return sum + (t.QtyForReb || t.ActualSales || 0);
            }, 0);
          }
        }
      } catch (transError) {
        console.log(`⚠️ Could not get transaction data for ${customer.code}:`, transError.message);
      }

      // Set progress to total achieved
      progress = totalAchieved;

      // Calculate status based on rebate type
      if (customer.rebateType === 'Fixed' || customer.rebateType === 'Percentage') {
        totalQuota = Array.from(customer.quotas.values()).reduce((sum, quota) => sum + quota, 0);
        
        // Calculate progress percentage
        const progressPercentage = totalQuota > 0 ? (totalAchieved / totalQuota) * 100 : 0;
        
        // Set status based on total achieved
        if (totalAchieved >= totalQuota) {
          quotaStatus = "Met Quota";
          rebateStatus = "Eligible";
        } else if (totalAchieved >= (totalQuota * 0.7)) {
          quotaStatus = "On Track";
          rebateStatus = "Pending";
        } else if (totalAchieved > 0) {
          quotaStatus = "Starting";
          rebateStatus = "Not Eligible";
        } else {
          quotaStatus = "Starting";
          rebateStatus = "Not Eligible";
        }
        
      } else if (customer.rebateType === 'Incremental') {
        // Check if in any range based on TOTAL achieved
        if (customer.ranges && customer.ranges.length > 0) {
          const sortedRanges = [...customer.ranges].sort((a, b) => a.minQty - b.minQty);
          
          for (const range of sortedRanges) {
            if (totalAchieved >= range.minQty && 
                (totalAchieved <= range.maxQty || !range.maxQty || range.maxQty === 0)) {
              currentRange = range;
              quotaStatus = "In Range";
              rebateStatus = "Eligible";
              break;
            }
          }
          
          // If not in any range but has achievements
          if (!currentRange && totalAchieved > 0) {
            quotaStatus = "Progressing";
            rebateStatus = "Pending";
          }
        }
      }

      // GET PAYOUT DATA FROM DATABASE
      const customerKey = `${customer.code}_${customer.rebateCode}`;
      let rebateAmount = 0;
      let paidAmount = 0;
      let rebateBalance = 0;
      let fromDatabase = false;
      let transactionCount = 0;
      
      // Get payout data from database if available
      if (payoutDataMap.has(customerKey)) {
        const payoutData = payoutDataMap.get(customerKey);
        rebateAmount = payoutData.rebateAmount;
        paidAmount = payoutData.paidAmount;
        rebateBalance = payoutData.rebateBalance;
        transactionCount = payoutData.transactionCount;
        fromDatabase = payoutData.fromDatabase;
        
        console.log(`Database payout for ${customer.code}: Amount=${rebateAmount}, Paid=${paidAmount}`);
      }
      
      // If no database data, keep amounts at 0 (will show 0 in frontend)
      // We DON'T calculate amounts anymore - only use database values

      // Generate color for UI
      const hash = customer.code ? customer.code.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
      }, 0) : 0;
      
      const color = `hsl(${Math.abs(hash % 360)}, 70%, 60%)`;

      return {
        customer: customer.customer || 'N/A',
        agent: customer.agent || 'N/A',
        rebateType: customer.rebateType || 'N/A',
        code: customer.code || 'N/A',
        rebateCode: customer.rebateCode || 'N/A',
        dateFrom: customer.dateFrom ? new Date(customer.dateFrom).toISOString().split('T')[0] : '',
        dateTo: customer.dateTo ? new Date(customer.dateTo).toISOString().split('T')[0] : '',
        frequency: customer.frequency || 'Quarterly',
        quotaType: customer.quotaType || 'N/A',
        isActive: customer.isActive,
        // PROGRESS CALCULATIONS (restored)
        progress: Math.round(progress),
        totalAchieved: totalAchieved,
        quotaStatus: quotaStatus,
        rebateStatus: rebateStatus,
        enrollment: customer.dateFrom ? new Date(customer.dateFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        // ADDED: Include createdDate for frontend sorting
        createdDate: customer.createdDate ? new Date(customer.createdDate).toISOString() : new Date(customer.dateFrom).toISOString(),
        createdAt: customer.createdDate ? new Date(customer.createdDate).toISOString() : new Date(customer.dateFrom).toISOString(),
        color: color,
        totalQuota: totalQuota,
        items: itemsArray,
        itemCodes: itemCodesArray,
        itemDetails: customer.itemDetails,
        quotas: Object.fromEntries(customer.quotas),
        qtrRebate: customer.qtrRebate || 0,
        ranges: customer.ranges || [],
        itemRanges: customer.itemRanges || [],
        currentRange: currentRange?.rangeNo || null,
        // PAYOUT DATA - FROM DATABASE ONLY (unchanged)
        rebateAmount: parseFloat(rebateAmount.toFixed(2)),
        paidAmount: parseFloat(paidAmount.toFixed(2)),
        rebateBalance: parseFloat(rebateBalance.toFixed(2)),
        transactionCount: transactionCount,
        fromDatabase: fromDatabase,
        // Progress percentage for display
        progressPercentage: totalQuota > 0 ? Math.min((totalAchieved / totalQuota) * 100, 100) : 0
      };
    });

    // Wait for all promises to resolve
    console.log('Processing all customer data...');
    const summaryData = await Promise.all(customerPromises);

    // Sort by created date (newest first) instead of enrollment date
    summaryData.sort((a, b) => {
      // Use createdDate first, fall back to enrollment date, then current date
      const dateA = new Date(a.createdDate || a.createdAt || a.enrollment || new Date());
      const dateB = new Date(b.createdDate || b.createdAt || b.enrollment || new Date());
      return dateB - dateA; // Newest first
    });

    const uniqueAgents = [...new Set(summaryData.map(item => item.agent))].filter(agent => agent && agent !== 'N/A');

    // Calculate statistics
    const statistics = {
      totalCustomers: summaryData.length,
      fixedCustomers: summaryData.filter(item => item.rebateType === 'Fixed').length,
      incrementalCustomers: summaryData.filter(item => item.rebateType === 'Incremental').length,
      percentageCustomers: summaryData.filter(item => item.rebateType === 'Percentage').length,
      uniqueAgents: uniqueAgents.length,
      totalRebateAmount: parseFloat(summaryData.reduce((sum, item) => sum + (item.rebateAmount || 0), 0).toFixed(2)),
      totalPaidAmount: parseFloat(summaryData.reduce((sum, item) => sum + (item.paidAmount || 0), 0).toFixed(2)),
      totalBalance: parseFloat(summaryData.reduce((sum, item) => sum + (item.rebateBalance || 0), 0).toFixed(2)),
      customersWithDatabaseData: summaryData.filter(item => item.fromDatabase).length,
      customersWithoutDatabaseData: summaryData.filter(item => !item.fromDatabase).length,
      averageProgress: summaryData.length > 0 ? 
        parseFloat((summaryData.reduce((sum, item) => sum + (item.progressPercentage || 0), 0) / summaryData.length).toFixed(1)) : 0
    };

    console.log('📊 Final Summary Statistics:', statistics);

    res.json({
      success: true,
      data: {
        summary: summaryData,
        agents: uniqueAgents,
        statistics: statistics,
        metadata: {
          payoutTableExists: hasPayoutHistory,
          dataSource: hasPayoutHistory ? 'PayoutHistory Table + Progress Calculation' : 'Progress Calculation Only',
          note: 'Payout amounts from database, progress/status calculated from transactions',
          // ADDED: Inform frontend that sorting is by createdDate
          sorting: 'Sorted by created date (newest first)'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in rebates-summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rebates summary',
      error: error.message,
      stack: error.stack
    });
  }
});

// Add this endpoint to get incremental items for a rebate
router.get('/rebate/:rebateCode/items', async (req, res) => {
  let pool;
  try {
    const { rebateCode } = req.params;
    const { db } = req.query;
    
    const databaseToUse = db || 'VCP';

    pool = await getPoolWithFallback(databaseToUse);
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: `Database pool for ${databaseToUse} not available`
      });
    }

    const query = `
      SELECT 
        T0.ItemCode,
        T0.ItemName,
        T0.UnitPerQty,
        T1.RangeNo,
        T1.MinQty,
        T1.MaxQty,
        T1.RebatePerBag
      FROM IncItemRebate T0
      LEFT JOIN IncItemRange T1 ON T0.Id = T1.ItemRebateId
      WHERE T0.RebateCode = @rebateCode
      ORDER BY T0.ItemCode, T1.RangeNo
    `;

    const result = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(query);

    // Group items with their ranges
    const itemMap = new Map();
    result.recordset.forEach(row => {
      if (!itemMap.has(row.ItemCode)) {
        itemMap.set(row.ItemCode, {
          itemCode: row.ItemCode,
          itemName: row.ItemName,
          unitPerQty: row.UnitPerQty || 1,
          ranges: []
        });
      }
      
      if (row.RangeNo) {
        itemMap.get(row.ItemCode).ranges.push({
          rangeNo: row.RangeNo,
          minQty: row.MinQty || 0,
          maxQty: row.MaxQty || 0,
          rebatePerBag: row.RebatePerBag || 0
        });
      }
    });

    res.json({
      success: true,
      data: {
        rebateCode: rebateCode,
        items: Array.from(itemMap.values())
      }
    });

  } catch (error) {
    console.error('❌ Error fetching incremental items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching incremental items',
      error: error.message
    });
  }
});

// Get dashboard metrics - UPDATED with correct SQL queries
router.get('/metrics', async (req, res) => {
  let pool;
  try {
    const { db } = req.query;

    const databaseToUse = db || 'VCP';

    pool = await getPoolWithFallback(databaseToUse);

    if (!pool) {
      return res.status(500).json({
        success: false,
        message: `Database pool for ${databaseToUse} not available`
      });
    }

    console.log(`📊 Fetching dashboard metrics from ${databaseToUse} database...`);

    // First, check if PayoutHistory table exists
    const tableCheckQuery = `
      SELECT COUNT(*) as tableCount
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'PayoutHistory' AND TABLE_SCHEMA = 'dbo'
    `;

    let totalRebatePaid     = 0;
    let totalUnpaidRebate   = 0;   // SUM(BaseAmount - AmountReleased) across PayoutHistory
    let totalOutstanding    = 0;   // sum of positive customer balances only
    let totalOverReleased   = 0;   // sum of negative customer balances only (≤ 0)
    let totalNetBalance     = 0;   // true net (outstanding + over-released) — for reference

    try {
      const tableCheckResult = await pool.request().query(tableCheckQuery);

      if (tableCheckResult.recordset[0]?.tableCount > 0) {
        console.log('PayoutHistory table exists, fetching metrics...');

        // ── 1. Total Rebate Paid + Total Unpaid Rebate ────────────────────
        //    Total Unpaid = SUM(BaseAmount - AmountReleased) over the whole
        //    PayoutHistory table (per-line outstanding, not per-customer
        //    latest balance).
        const totalRebatePaidQuery = `
          SELECT 
            SUM(ISNULL(AmountReleased, 0))                        AS [Total Rebate Paid],
            SUM(ISNULL(BaseAmount, 0) - ISNULL(AmountReleased, 0)) AS [Total Unpaid Rebate]
          FROM PayoutHistory
        `;

        // ── 2. Balance breakdown — take each customer's LATEST RebateBalance
        //       (the same row your original query used: MAX(CreatedDate) per
        //       CardCode), then classify each customer's balance as
        //       outstanding or over-released.
        //
        //       Balance  > 0  →  outstanding (customer still owed)
        //       Balance  < 0  →  over-released (customer was over-paid)
        //       Balance == 0  →  settled (ignored in both buckets)
        const balanceBreakdownQuery = `
          SELECT
            SUM(CASE WHEN CustomerBalance > 0 THEN CustomerBalance ELSE 0 END)  AS [Total Outstanding],
            SUM(CASE WHEN CustomerBalance < 0 THEN CustomerBalance ELSE 0 END)  AS [Total OverReleased],
            SUM(CustomerBalance)                                                AS [Total Net Balance]
          FROM (
            SELECT
              p1.CardCode,
              ISNULL(p1.RebateBalance, 0) AS CustomerBalance
            FROM PayoutHistory p1
            WHERE p1.CreatedDate = (
                SELECT MAX(p2.CreatedDate)
                FROM PayoutHistory p2
                WHERE p2.CardCode = p1.CardCode
            )
            AND p1.CardCode IS NOT NULL
          ) AS CustomerBalances
        `;

        console.log('🔍 Executing SQL for Total Rebate Paid / Unpaid...');
        const paidResult = await pool.request().query(totalRebatePaidQuery);

        console.log('🔍 Executing SQL for Balance breakdown...');
        const balanceResult = await pool.request().query(balanceBreakdownQuery);

        totalRebatePaid   = Number(paidResult.recordset[0]?.['Total Rebate Paid'])   || 0;
        totalUnpaidRebate = Number(paidResult.recordset[0]?.['Total Unpaid Rebate']) || 0;

        totalOutstanding  = Number(balanceResult.recordset[0]?.['Total Outstanding'])  || 0;
        totalOverReleased = Number(balanceResult.recordset[0]?.['Total OverReleased']) || 0;
        totalNetBalance   = Number(balanceResult.recordset[0]?.['Total Net Balance'])  || 0;

        console.log('📊 PayoutHistory results:', {
          totalRebatePaid,
          totalUnpaidRebate,
          totalOutstanding,
          totalOverReleased,
          totalNetBalance,
          paidColumns:    paidResult.recordset[0]    ? Object.keys(paidResult.recordset[0])    : [],
          balanceColumns: balanceResult.recordset[0] ? Object.keys(balanceResult.recordset[0]) : [],
        });
      } else {
        console.log('⚠️ PayoutHistory table does not exist, using defaults');
      }
    } catch (tableError) {
      console.log('❌ PayoutHistory table check/query failed:', tableError.message);
    }

    // Get active customers count - FIXED QUERY
    let activeCustomers = 0;
    try {
      console.log('🔍 Fetching active customers count...');
      const activeCustomersQuery = `
        SELECT COUNT(DISTINCT CardCode) as activeCustomers
        FROM (
          SELECT CardCode FROM FixCustRebate WHERE CardCode IS NOT NULL AND LTRIM(RTRIM(CardCode)) != ''
          UNION 
          SELECT CardCode FROM IncCustRebate WHERE CardCode IS NOT NULL AND LTRIM(RTRIM(CardCode)) != ''
          UNION 
          SELECT CardCode FROM PerCustRebate WHERE CardCode IS NOT NULL AND LTRIM(RTRIM(CardCode)) != ''
        ) AS Customers
      `;

      const activeResult = await pool.request().query(activeCustomersQuery);
      activeCustomers = activeResult.recordset[0]?.activeCustomers || 0;
      console.log(`Active customers found: ${activeCustomers}`);
    } catch (activeError) {
      console.log('Active customers query failed:', activeError.message);
    }

    // Get new customers this month
    let newCustomersThisMonth = 0;
    try {
      console.log('🔍 Fetching new customers this month...');
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      const newCustomersQuery = `
        SELECT COUNT(DISTINCT CardCode) as newCustomersThisMonth
        FROM (
          SELECT CardCode, CreatedDate FROM FixCustRebate 
          WHERE MONTH(CreatedDate) = @currentMonth AND YEAR(CreatedDate) = @currentYear
          AND CardCode IS NOT NULL AND LTRIM(RTRIM(CardCode)) != ''
          UNION 
          SELECT CardCode, CreatedDate FROM IncCustRebate 
          WHERE MONTH(CreatedDate) = @currentMonth AND YEAR(CreatedDate) = @currentYear
          AND CardCode IS NOT NULL AND LTRIM(RTRIM(CardCode)) != ''
        ) AS NewCustomers
      `;

      const newResult = await pool.request()
        .input('currentMonth', sql.Int, currentMonth)
        .input('currentYear', sql.Int, currentYear)
        .query(newCustomersQuery);

      newCustomersThisMonth = newResult.recordset[0]?.newCustomersThisMonth || 0;
      console.log(`New customers this month: ${newCustomersThisMonth}`);
    } catch (newError) {
      console.log('New customers query failed:', newError.message);
    }

    // ── Snap sub-cent floating-point noise to zero so a balanced book
    //    never renders as red parentheses on the dashboard.
    const EPS = 0.005;
    const snap = (n) => (Math.abs(n) < EPS ? 0 : n);

    const formattedMetrics = {
      // ── Headline figures ──────────────────────────────────────────────
      totalRebatePaid:          snap(totalRebatePaid),

      // "Total Unpaid Rebate" = SUM(BaseAmount - AmountReleased) from
      // PayoutHistory (per-line outstanding).
      totalUnpaidRebate:        snap(totalUnpaidRebate),

      // ── Split buckets — kept as separate, independent figures ─────────
      totalOutstandingRebate:   snap(totalOutstanding),    // ≥ 0
      totalOverReleasedRebate:  snap(totalOverReleased),   // ≤ 0

      // Reference only — not surfaced as a card. Equals
      // totalOutstandingRebate + totalOverReleasedRebate.
      totalNetBalance:          snap(totalNetBalance),

      activeCustomers,
      newCustomersThisMonth,

      // ── Pre-parsed numeric mirrors (some clients consume these) ───────
      totalRebatePaidValue:         parseFloat(snap(totalRebatePaid).toFixed(2)),
      totalUnpaidRebateValue:       parseFloat(snap(totalUnpaidRebate).toFixed(2)),
      totalOutstandingRebateValue:  parseFloat(snap(totalOutstanding).toFixed(2)),
      totalOverReleasedRebateValue: parseFloat(snap(totalOverReleased).toFixed(2)),
      totalNetBalanceValue:         parseFloat(snap(totalNetBalance).toFixed(2)),
    };

    console.log('📊 Final dashboard metrics:', formattedMetrics);

    res.json({
      success: true,
      data: formattedMetrics
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard metrics',
      error: error.message
    });
  }
});

// In backend.js, update or create a new endpoint for daily transactions
router.get('/customer/:customerCode/daily-transactions', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, rebateCode, rebateType, useRebatePeriod } = req.query;
    
    const databaseToUse = db || 'VCP';
    const ownPool = await getPoolWithFallback(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: 'Database pool not available'
      });
    }

    // Get rebate program period and frequency
    const rebatePeriodQuery = `
      SELECT DateFrom, DateTo, Frequency
      FROM RebateProgram
      WHERE RebateCode = @rebateCode
    `;

    const rebatePeriodResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(rebatePeriodQuery);

    let startDate, endDate, frequency = 'Quarterly';
    
    if (rebatePeriodResult.recordset.length > 0) {
      const rebateInfo = rebatePeriodResult.recordset[0];
      startDate = rebateInfo.DateFrom ? 
        new Date(rebateInfo.DateFrom).toISOString().split('T')[0] : '';
      endDate = rebateInfo.DateTo ? 
        new Date(rebateInfo.DateTo).toISOString().split('T')[0] : '';
      frequency = rebateInfo.Frequency || 'Quarterly';
    } else {
      // Fallback to current quarter/month
      const today = new Date();
      startDate = `${today.getFullYear()}-01-01`;
      endDate = today.toISOString().split('T')[0];
    }

    // Get rebate items for this customer
    let itemQuery = '';
    if (rebateType === 'Fixed') {
      itemQuery = `
        SELECT DISTINCT ItemCode
        FROM FixProdRebate
        WHERE RebateCode = @rebateCode
      `;
    } else if (rebateType === 'Incremental') {
      itemQuery = `
        SELECT DISTINCT ItemCode
        FROM IncItemRebate
        WHERE RebateCode = @rebateCode
      `;
    } else if (rebateType === 'Percentage') {
      itemQuery = `
        SELECT DISTINCT ItemCode
        FROM PerProdRebate
        WHERE RebateCode = @rebateCode
      `;
    }

    const itemResult = await ownPool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(itemQuery);

    const itemCodes = itemResult.recordset.map(row => row.ItemCode);
    
    // Get SAP transactions
    const sapPool = getDatabasePool('VCP');
    if (!sapPool) {
      return res.status(500).json({
        success: false,
        message: 'SAP database pool not available'
      });
    }

    let sapQuery = '';
    if (itemCodes.length > 0) {
      const paramNames = itemCodes.map((_, index) => `@itemCode${index}`).join(', ');
      
      sapQuery = `
        SELECT
          CONVERT(VARCHAR(10), T0.DocDate, 120) as Date,
          T0.Dscription as Item,
          T0.ItemCode,
          SUM(T0.Quantity) as ActualSales,
          T0.PriceAfVAT
        FROM
          OINV T0
        WHERE
          T0.CardCode = @customerCode
          AND T0.DocType = 'I'
          AND T0.DocDate >= @startDate
          AND T0.DocDate <= @endDate
          AND T0.ItemCode IN (${paramNames})
        GROUP BY 
          CONVERT(VARCHAR(10), T0.DocDate, 120),
          T0.Dscription,
          T0.ItemCode,
          T0.PriceAfVAT
        ORDER BY 
          CONVERT(VARCHAR(10), T0.DocDate, 120) ASC
      `;
    } else {
      sapQuery = `
        SELECT
          CONVERT(VARCHAR(10), T0.DocDate, 120) as Date,
          T0.Dscription as Item,
          T0.ItemCode,
          SUM(T0.Quantity) as ActualSales,
          T0.PriceAfVAT
        FROM
          OINV T0
        WHERE
          T0.CardCode = @customerCode
          AND T0.DocType = 'I'
          AND T0.DocDate >= @startDate
          AND T0.DocDate <= @endDate
        GROUP BY 
          CONVERT(VARCHAR(10), T0.DocDate, 120),
          T0.Dscription,
          T0.ItemCode,
          T0.PriceAfVAT
        ORDER BY 
          CONVERT(VARCHAR(10), T0.DocDate, 120) ASC
      `;
    }

    const request = sapPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate);

    if (itemCodes.length > 0) {
      itemCodes.forEach((itemCode, index) => {
        request.input(`itemCode${index}`, sql.NVarChar(50), itemCode);
      });
    }

    const sapResult = await request.query(sapQuery);
    
    // Process daily transactions
    const dailyTransactions = sapResult.recordset.map(transaction => {
      const date = new Date(transaction.Date);
      
      return {
        date: transaction.Date,
        displayDate: date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        monthYear: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        dayOfMonth: date.getDate(),
        actualSales: parseFloat(transaction.ActualSales) || 0,
        item: transaction.Item,
        itemCode: transaction.ItemCode,
        is25kg: transaction.Item ? transaction.Item.toLowerCase().includes('25kg') : false
      };
    });

    // Calculate cumulative sales
    let cumulativeSales = 0;
    const dailyDataWithCumulative = dailyTransactions.map(transaction => {
      cumulativeSales += transaction.actualSales;
      return {
        ...transaction,
        cumulativeSales: cumulativeSales
      };
    });

    // Group by month for summary
    const monthlySummary = {};
    dailyTransactions.forEach(transaction => {
      const monthKey = transaction.monthYear;
      if (!monthlySummary[monthKey]) {
        monthlySummary[monthKey] = {
          monthName: transaction.monthName,
          monthYear: monthKey,
          totalSales: 0,
          daysWithSales: 0,
          dailyAverage: 0
        };
      }
      monthlySummary[monthKey].totalSales += transaction.actualSales;
      monthlySummary[monthKey].daysWithSales++;
    });

    // Calculate averages
    Object.keys(monthlySummary).forEach(monthKey => {
      const month = monthlySummary[monthKey];
      month.dailyAverage = month.daysWithSales > 0 ? month.totalSales / month.daysWithSales : 0;
    });

    res.json({
      success: true,
      data: {
        customerCode,
        rebateCode,
        rebateType,
        frequency,
        period: {
          startDate,
          endDate,
          totalDays: Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
        },
        dailyTransactions: dailyDataWithCumulative,
        monthlySummary: Object.values(monthlySummary),
        totals: {
          totalSales: dailyTransactions.reduce((sum, t) => sum + t.actualSales, 0),
          averageDailySales: dailyTransactions.length > 0 
            ? dailyTransactions.reduce((sum, t) => sum + t.actualSales, 0) / dailyTransactions.length 
            : 0,
          daysWithSales: dailyTransactions.length,
          maxDailySales: Math.max(...dailyTransactions.map(t => t.actualSales), 0)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching daily transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching daily transactions',
      error: error.message
    });
  }
});

// Update the customer details endpoint
router.get('/customer/:customerCode/details', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { db, periodFrom, periodTo, rebateCode, rebateType, useRebatePeriod } = req.query;
    
    const databaseToUse = db || 'VCP';
    const ownPool = await getPoolWithFallback(databaseToUse);
    
    if (!ownPool) {
      return res.status(500).json({
        success: false,
        message: `Database pool for ${databaseToUse} not available`
      });
    }

    if (!customerCode) {
      return res.status(400).json({
        success: false,
        message: 'Customer code is required'
      });
    }

    // Get customer basic info WITH FREQUENCY
    const customerQuery = `
      SELECT 
        CustomerInfo.code,
        CustomerInfo.name,
        CustomerInfo.status,
        CustomerInfo.enrollmentDate,
        CustomerInfo.RebateCode,        -- ← expose it so we can log/verify
        RP.Frequency,
        RP.QuotaType 
      FROM (
        SELECT CardCode as code, CardName as name, 'Active' as status,
              GETDATE() as enrollmentDate, RebateCode
        FROM FixCustRebate WHERE CardCode = @customerCode
        UNION
        SELECT CardCode as code, CardName as name, 'Active' as status,
              GETDATE() as enrollmentDate, RebateCode
        FROM IncCustRebate WHERE CardCode = @customerCode
        UNION
        SELECT CardCode as code, CardName as name, 'Active' as status,
              GETDATE() as enrollmentDate, RebateCode
        FROM PerCustRebate WHERE CardCode = @customerCode
      ) AS CustomerInfo
      LEFT JOIN RebateProgram RP ON CustomerInfo.RebateCode = RP.RebateCode
      -- ← THE FIX: only the rebate the user actually opened
      WHERE (@rebateCode IS NULL OR CustomerInfo.RebateCode = @rebateCode)
    `;

    const customerResult = await ownPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('rebateCode',  sql.NVarChar(50), rebateCode || null)   // ← NEW
      .query(customerQuery);

    if (customerResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Customer with code ${customerCode} not found`
      });
    }

    const customerInfo = customerResult.recordset[0];
    console.log('📊 Customer info with frequency:', {
  code: customerInfo.code,
  name: customerInfo.name,
  frequency: customerInfo.Frequency,
  rebateType: customerInfo.RebateType
});

    // Get rebate programs for this customer WITH FREQUENCY
  const rebatesQuery = `
    SELECT DISTINCT
      T0.RebateCode,
      T0.RebateType,
      T0.SlpName as agent,
      T0.DateFrom,
      T0.DateTo,
      T0.IsActive,
      T0.Frequency,
      T0.QuotaType                    -- ← so fallback actually works
    FROM RebateProgram T0
    LEFT JOIN FixCustRebate T1 ON T0.RebateCode = T1.RebateCode
    LEFT JOIN IncCustRebate T2 ON T0.RebateCode = T2.RebateCode
    LEFT JOIN PerCustRebate T3 ON T0.RebateCode = T3.RebateCode
    WHERE T1.CardCode = @customerCode OR T2.CardCode = @customerCode OR T3.CardCode = @customerCode
  `;

    const rebatesResult = await ownPool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .query(rebatesQuery);

    const rebates = rebatesResult.recordset;

    // If customer has rebates, get the first one for detailed data
    let detailedData = {};
    let dateRangeInfo = {};
    
    if (rebates.length > 0) {
      const primaryRebate = rebates[0];
      
      // Get quota summary data
      const quotaSummaryResponse = await fetch(
        `http://${req.headers.host}/api/dashboard/vcp/customer/${customerCode}/quota-summary?` +
        `db=${databaseToUse}&rebateCode=${primaryRebate.RebateCode}&rebateType=${primaryRebate.RebateType}&` +
        `periodFrom=${periodFrom}&periodTo=${periodTo}&useRebatePeriod=${useRebatePeriod}`
      );
      
      if (quotaSummaryResponse.ok) {
        const quotaData = await quotaSummaryResponse.json();
        if (quotaData.success) {
          detailedData = {
            ...quotaData.data,
            rebateDetails: quotaData.data.rebateDetails,
            monthlyQuotas: quotaData.data.monthlyQuotas,
            summary: quotaData.data.summary,
            unitPerQty: quotaData.data.unitPerQty
          };
          dateRangeInfo = quotaData.data.dateRange;
        }
      }

      // Get transaction data
      const transResponse = await fetch(
        `http://${req.headers.host}/api/dashboard/customer/${customerCode}/transactions?` +
        `db=${databaseToUse}&rebateCode=${primaryRebate.RebateCode}&rebateType=${primaryRebate.RebateType}&` +
        `periodFrom=${periodFrom || dateRangeInfo.periodFrom}&periodTo=${periodTo || dateRangeInfo.periodTo}&useRebatePeriod=${useRebatePeriod}`
      );
      
      if (transResponse.ok) {
        const transData = await transResponse.json();
        if (transData.success) {
          detailedData.transactions = transData.data.transactions;
          detailedData.transactionSummary = transData.data.summary;
        }
      }

      // Get payout data
      const payoutResponse = await fetch(
        `http://${req.headers.host}/api/dashboard/customer/${customerCode}/payouts?` +
        `db=${databaseToUse}&rebateCode=${primaryRebate.RebateCode}&rebateType=${primaryRebate.RebateType}&` +
        `periodFrom=${periodFrom || dateRangeInfo.periodFrom}&periodTo=${periodTo || dateRangeInfo.periodTo}&useRebatePeriod=${useRebatePeriod}`
      );
      
      if (payoutResponse.ok) {
        const payoutData = await payoutResponse.json();
        if (payoutData.success) {
          detailedData.payouts = payoutData.data.payouts;
        }
      }
    }

// Pick the exact rebate the user opened, not just the first row
const targetRebate =
  rebates.find(r => r.RebateCode === rebateCode) || rebates[0] || null;

res.json({
  success: true,
  data: {
    ...customerInfo,
    ...detailedData,
    rebates: rebates,
    agent:      targetRebate ? targetRebate.agent      : 'Not Assigned',
    rebateType: targetRebate ? targetRebate.RebateType : 'Not Assigned',
    rebateCode: targetRebate ? targetRebate.RebateCode : 'Not Assigned',
    frequency:  customerInfo.Frequency  || (targetRebate ? targetRebate.Frequency  : 'Quarterly'),

    // THE FIX — prefer the exact match, then fall back to customerInfo
    quotaType:  customerInfo.QuotaType
             || (targetRebate ? targetRebate.QuotaType : null)
             || 'N/A',

    rebateDateFrom: targetRebate && targetRebate.DateFrom
      ? new Date(targetRebate.DateFrom).toISOString().split('T')[0] : '',
    rebateDateTo:   targetRebate && targetRebate.DateTo
      ? new Date(targetRebate.DateTo).toISOString().split('T')[0]   : '',
    dateRange: dateRangeInfo
  }
});

  } catch (error) {
    console.error('❌ Error fetching customer details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer details',
      error: error.message
    });
  }
});

// Debug routes
router.get('/debug/rebate/:rebateCode', async (req, res) => {
  let pool;
  try {
    const { rebateCode } = req.params;
    const { db } = req.query;
    const databaseToUse = db || 'VCP';

    pool = await getPoolWithFallback(databaseToUse);
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: `Database pool for ${databaseToUse} not available`
      });
    }

    const query = `
      SELECT 
        RebateCode as code,
        RebateType as type,
        DateFrom as [from],
        DateTo as [to],
        IsActive,
        CASE 
          WHEN IsActive = 1 THEN 'Active' 
          WHEN IsActive = 0 THEN 'Inactive'
          ELSE 'Unknown'
        END as status_display
      FROM 
        RebateProgram
      WHERE RebateCode = @rebateCode
    `;

    const result = await pool.request()
      .input('rebateCode', sql.NVarChar(50), rebateCode)
      .query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Rebate with code ${rebateCode} not found`
      });
    }

    const rebate = result.recordset[0];

    res.json({
      success: true,
      data: {
        rebate,
        database: databaseToUse
      }
    });

  } catch (error) {
    console.error('❌ Debug rebate route error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug rebate route failed',
      error: error.message
    });
  }
});

router.get('/debug/rebates', async (req, res) => {
  let pool;
  try {
    const { db } = req.query;
    const databaseToUse = db || 'VCP';

    pool = await getPoolWithFallback(databaseToUse);
    
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: `Database pool for ${databaseToUse} not available`
      });
    }

    const query = `
      SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) as activeCount,
        SUM(CASE WHEN IsActive = 0 THEN 1 ELSE 0 END) as inactiveCount
      FROM RebateProgram
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: {
        database: databaseToUse,
        connection: 'OK',
        statistics: result.recordset[0]
      }
    });

  } catch (error) {
    console.error('❌ Debug route error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug route failed',
      error: error.message
    });
  }
});
// Add this test endpoint to debug all databases
router.get('/debug/databases', async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Checking all database connections...');
    
    const databases = ['VCP'];
    const results = {};
    
    for (const dbName of databases) {
      try {
        const pool = getDatabasePool(dbName);
        
        if (!pool) {
          results[dbName] = { status: 'NO_POOL', message: 'Pool not configured' };
          continue;
        }
        
        // Test connection with a simple query
        const testQuery = `SELECT DB_NAME() as dbName, @@SERVERNAME as serverName`;
        const testResult = await pool.request().query(testQuery);
        
        results[dbName] = {
          status: 'CONNECTED',
          server: testResult.recordset[0]?.serverName,
          database: testResult.recordset[0]?.dbName,
          testedAt: new Date().toISOString()
        };
        
      } catch (error) {
        results[dbName] = {
          status: 'ERROR',
          message: error.message,
          testedAt: new Date().toISOString()
        };
      }
    }
    
    // Also test SAP data specifically
    const sapTest = {};
    const sapPool = getDatabasePool('VCP');
    if (sapPool) {
      try {
        // Check if OINV table exists
        const tableCheck = await sapPool.request()
          .query(`SELECT COUNT(*) as tableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'OINV'`);
        
        sapTest.tableExists = tableCheck.recordset[0]?.tableCount > 0;
        
        // Get sample data count
        const sampleCount = await sapPool.request()
          .query(`SELECT COUNT(*) as invoiceCount FROM OINV WHERE DocType = 'I'`);
        
        sapTest.invoiceCount = sampleCount.recordset[0]?.invoiceCount || 0;
        
        // Get a sample customer
        const sampleCustomer = await sapPool.request()
          .query(`SELECT TOP 1 CardCode, CardName FROM OINV WHERE DocType = 'I' ORDER BY DocDate DESC`);
        
        sapTest.sampleCustomer = sampleCustomer.recordset[0];
        
      } catch (error) {
        sapTest.error = error.message;
      }
    }
    
    res.json({
      success: true,
      data: {
        databases: results,
        sapDatabase: sapTest,
        configCheck: {
          hasVCPConfig: !!getDatabasePool('VCP'),
          //hasVCPConfig: !!getDatabasePool('VCP'),
          currentTime: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Database check error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug check failed',
      error: error.message
    });
  }
});

// ────────────────────────────────────────────────────────────────────────
// STEP 2 — fetchARCMRows: emits ORIN credit memos as SEPARATE negative
// rows (never mutates the OINV invoice rows above).
// ────────────────────────────────────────────────────────────────────────
const fetchARCMRows = async (sapPool, customerCode, itemCodes, startDate, endDate) => {
  // Only the rebate's own items matter
  if (!itemCodes || itemCodes.length === 0) return [];

  const paramNames = itemCodes.map((_, i) => `@arcmItem${i}`).join(', ');

  const request = sapPool.request()
    .input('customerCode', sql.NVarChar(50), customerCode)
    .input('startDate', sql.Date, startDate)
    .input('endDate', sql.Date, endDate);

  itemCodes.forEach((code, i) => {
    request.input(`arcmItem${i}`, sql.NVarChar(50), code);
  });

  const result = await request.query(`
    SELECT
      CONVERT(VARCHAR(10), T0.DocDate, 120) AS Date,
      T0.DocNum                              AS CreditMemoNumber,
      T0.ItemCode,
      T0.Dscription                          AS Item,
      ABS(T0.Quantity)                       AS ReturnQuantity,
      ABS(T0.GTotal)                         AS GTotal,
      T0.PriceAfVAT,
      COALESCE(
        NULLIF(NULLIF(LTRIM(RTRIM(CAST(T0.BaseRef AS NVARCHAR(50)))), ''), '0'),
        NULLIF(LTRIM(RTRIM(T0.U_Ar_Inv_No)), '')
      )                                      AS OriginalDocNum
    FROM ORIN T0
    WHERE T0.CardCode = @customerCode
      AND T0.DocDate >= @startDate
      AND T0.DocDate <= @endDate
      AND T0.ItemCode IN (${paramNames})
    ORDER BY T0.DocDate ASC, T0.DocNum ASC
  `);

  return result.recordset.map(r => ({
    TransType:             'ARCM',
    IsReturn:              true,
    Date:                  r.Date,
    Item:                  r.Item,
    ItemCode:              r.ItemCode,
    ActualSales:           -Math.abs(r.ReturnQuantity || 0),   // negative qty
    Gtotal:                -Math.abs(r.GTotal || 0),           // negative peso value
    PriceAfVAT:            r.PriceAfVAT || 0,
    InvoiceNumber:         r.CreditMemoNumber,
    CustomerReference:     null,
    Treetype:              'R',
    OriginalInvoiceNumber: r.OriginalDocNum || null,
    AdjustmentNotes:       `A/R Credit Memo ${r.CreditMemoNumber}`,
  }));
};



export default router;