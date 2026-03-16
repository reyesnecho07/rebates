import express from 'express';
import sql from 'mssql';
import { dbMiddleware } from '../middleware/dbMiddleware.js';

const router = express.Router();

// Apply database middleware to all rebate routes
router.use(dbMiddleware);

// Validation middleware for required fields
const validateRebateProgram = (req, res, next) => {
  const { RebateType, SlpCode, SlpName, DateFrom, DateTo } = req.body;
  
  if (!RebateType || !SlpCode || !SlpName || !DateFrom || !DateTo) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: RebateType, SlpCode, SlpName, DateFrom, DateTo'
    });
  }
  
  next();
};

// SIMPLIFIED - Get highest rebate code
router.get('/highest-code', async (req, res) => {
  try {
    console.log(`🔍 Fetching highest rebate code from database: ${req.database}`);
    
    const query = `
      SELECT 
        MAX(RebateCode) as HighestCode,
        CASE 
          WHEN MAX(RebateCode) IS NULL THEN 'REB-00001'
          ELSE 'REB-' + RIGHT('00000' + CAST(CAST(SUBSTRING(MAX(RebateCode), 5, LEN(MAX(RebateCode))) AS INT) + 1 AS VARCHAR), 5)
        END as NextCode
      FROM RebateProgram 
      WHERE RebateCode LIKE 'REB-%'
    `;
    
    const result = await req.db.request().query(query);
    
    const highestCode = result.recordset[0].HighestCode;
    const nextCode = result.recordset[0].NextCode;
    
    console.log(`🏆 Highest rebate code: "${highestCode}"`);
    console.log(`🎯 Next rebate code: "${nextCode}"`);
    
    res.json({ 
      success: true,
      highestCode: highestCode || "REB-00000",
      nextCode: nextCode,
      database: req.database
    });
    
  } catch (error) {
    console.error('❌ Error fetching highest rebate code:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

// SIMPLIFIED - Create rebate program
router.post('/rebate-program', validateRebateProgram, async (req, res) => {
  try {
    const { RebateType, SlpCode, SlpName, DateFrom, DateTo, Frequency, QuotaType } = req.body;
    
    console.log(`💾 Saving rebate program to database: ${req.database}`);

    // Get the next rebate code using SQL logic
    const getNextCodeQuery = `
      SELECT 
        CASE 
          WHEN MAX(RebateCode) IS NULL THEN 'REB-00001'
          ELSE 'REB-' + RIGHT('00000' + CAST(CAST(SUBSTRING(MAX(RebateCode), 5, LEN(MAX(RebateCode))) AS INT) + 1 AS VARCHAR), 5)
        END as NextCode
      FROM RebateProgram 
      WHERE RebateCode LIKE 'REB-%'
    `;
    
    const nextCodeResult = await req.db.request().query(getNextCodeQuery);
    const nextRebateCode = nextCodeResult.recordset[0].NextCode;

    console.log(`🔢 Generated next rebate code: ${nextRebateCode}`);

    // Insert with the generated rebate code and CreatedDate
    const query = `
      INSERT INTO RebateProgram (RebateCode, RebateType, SlpCode, SlpName, DateFrom, DateTo, Frequency, QuotaType, CreatedDate)
      VALUES (@RebateCode, @RebateType, @SlpCode, @SlpName, @DateFrom, @DateTo, @Frequency, @QuotaType, GETDATE())
    `;
    
    await req.db.request()
      .input('RebateCode', sql.NVarChar, nextRebateCode)
      .input('RebateType', sql.NVarChar, RebateType)
      .input('SlpCode', sql.Int, SlpCode)
      .input('SlpName', sql.NVarChar, SlpName)
      .input('DateFrom', sql.Date, DateFrom)
      .input('DateTo', sql.Date, DateTo)
      .input('Frequency', sql.NVarChar, Frequency || 'Quarterly')
      .input('QuotaType', sql.NVarChar, QuotaType || 'With Quota')
      .query(query);
    
    console.log(`✅ Rebate program saved successfully. RebateCode: ${nextRebateCode}`);
    
    res.json({ 
      success: true, 
      rebateCode: nextRebateCode,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error saving rebate program:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

const getNextId = async (db, tableName) => {
  try {
    // Try to get the next identity value
    const result = await db.request().query(`
      SELECT IDENT_CURRENT('${tableName}') as CurrentId, 
             IDENT_INCR('${tableName}') as IncrementValue
    `);
    
    const currentId = result.recordset[0].CurrentId;
    const increment = result.recordset[0].IncrementValue;
    
    if (currentId === null) {
      // Table might not have identity property, get max Id
      const maxResult = await db.request().query(`SELECT ISNULL(MAX(Id), 0) as MaxId FROM ${tableName}`);
      return maxResult.recordset[0].MaxId + 1;
    }
    
    return currentId + increment;
  } catch (error) {
    console.error(`Error getting next ID for ${tableName}:`, error);
    // Fallback: get max Id
    try {
      const maxResult = await db.request().query(`SELECT ISNULL(MAX(Id), 0) as MaxId FROM ${tableName}`);
      return maxResult.recordset[0].MaxId + 1;
    } catch (fallbackError) {
      console.error(`Fallback error for ${tableName}:`, fallbackError);
      return 1;
    }
  }
};

// Save to PerCustRebate table
router.post('/fix-cust-rebate', async (req, res) => {
  try {
    const { RebateCode, CardCode, CardName, QtrRebate } = req.body;
    
    console.log(`💾 Saving fixed customer rebate to database: ${req.database}`);
    console.log('📤 FULL REQUEST BODY:', JSON.stringify(req.body, null, 2));
    console.log('📤 Data received:', { RebateCode, CardCode, CardName, QtrRebate });
    
    // Parse QtrRebate value
    const qtrRebateValue = QtrRebate !== undefined && QtrRebate !== null && QtrRebate !== '' 
      ? parseFloat(QtrRebate) 
      : 0;
    
    // Get the next ID for FixCustRebate table
    const nextId = await getNextId(req.db, 'FixCustRebate');
    
    console.log(`🔢 Next ID for FixCustRebate: ${nextId}`);
    
    // UPDATED QUERY - Now includes Id parameter
    const query = `
      INSERT INTO FixCustRebate (Id, RebateCode, CardCode, CardName, QtrRebate, CreatedDate)
      VALUES (@Id, @RebateCode, @CardCode, @CardName, @QtrRebate, GETDATE())
    `;
    
    console.log('🔍 Query to execute:');
    console.log(query);
    console.log('🔍 Parameters:');
    console.log('- Id:', nextId);
    console.log('- RebateCode:', RebateCode);
    console.log('- CardCode:', CardCode);
    console.log('- CardName:', CardName);
    console.log('- QtrRebate:', qtrRebateValue);
    
    // Create request
    const request = req.db.request();
    
    // UPDATED: Add Id parameter
    request.input('Id', sql.Int, nextId);
    request.input('RebateCode', sql.NVarChar(50), RebateCode);
    request.input('CardCode', sql.NVarChar(15), CardCode);
    request.input('CardName', sql.NVarChar(100), CardName);
    request.input('QtrRebate', sql.Decimal(19, 6), qtrRebateValue);
    
    // Execute
    await request.query(query);
    
    console.log(`✅ Fixed customer rebate saved successfully. ID: ${nextId}`);
    
    res.json({ 
      success: true, 
      id: nextId,
      database: req.database
    });
  } catch (error) {
    console.error('❌ ERROR DETAILS:');
    console.error('Message:', error.message);
    console.error('Error number:', error.number);
    console.error('Error state:', error.state);
    console.error('Line number:', error.lineNumber);
    
    // Check if there's SQL in the error
    if (error.sql) {
      console.error('SQL that caused error:', error.sql);
    }
    
    res.status(500).json({ 
      success: false, 
      error: `Database error: ${error.message}`,
      database: req.database 
    });
  }
});

router.post('/fix-cust-quota', async (req, res) => {
  try {
    const { CustRebateId, Month, TargetQty } = req.body;
    
    console.log(`💾 Saving fixed customer quota to database: ${req.database}`);
    console.log('📤 Data received:', { CustRebateId, Month, TargetQty });
    
    // Get the next ID
    const nextId = await getNextId(req.db, 'FixCustQuota');
    
    console.log(`🔢 Next ID for FixCustQuota: ${nextId}`);
    
    // Insert with explicit Id
    const query = `
      INSERT INTO FixCustQuota (Id, CustRebateId, Month, TargetQty, CreatedDate)
      VALUES (@Id, @CustRebateId, @Month, @TargetQty, GETDATE())
    `;
    
    const result = await req.db.request()
      .input('Id', sql.Int, nextId)
      .input('CustRebateId', sql.Int, CustRebateId)
      .input('Month', sql.NVarChar, Month)
      .input('TargetQty', sql.Decimal(18, 2), TargetQty || 0)
      .query(query);
    
    console.log(`✅ Fixed customer quota saved successfully. ID: ${nextId}`);
    
    res.json({ 
      success: true,
      id: nextId,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error saving fixed customer quota:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

// Save to FixProdRebate table
router.post('/fix-prod-rebate', async (req, res) => {
  try {
    const { RebateCode, ItemCode, ItemName, RebatePerBag, UnitPerQty } = req.body;
    
    console.log(`💾 Saving fixed product rebate to database: ${req.database}`);
    
    const nextId = await getNextId(req.db, 'FixProdRebate');
    
    const query = `
      INSERT INTO FixProdRebate (Id, RebateCode, ItemCode, ItemName, UnitPerQty, RebatePerBag, CreatedDate)
      VALUES (@Id, @RebateCode, @ItemCode, @ItemName, @UnitPerQty, @RebatePerBag, GETDATE())
    `;
    
    await req.db.request()
      .input('Id', sql.Int, nextId)
      .input('RebateCode', sql.NVarChar, RebateCode)
      .input('ItemCode', sql.NVarChar, ItemCode)
      .input('ItemName', sql.NVarChar, ItemName)
      .input('UnitPerQty', sql.Decimal(18, 2), UnitPerQty || 0)
      .input('RebatePerBag', sql.Decimal(18, 2), RebatePerBag || 0)
      .query(query);
    
    console.log(`✅ Fixed product rebate saved successfully. ID: ${nextId}`);
    
    res.json({ 
      success: true,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error saving fixed product rebate:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

// Save to IncCustRebate table
router.post('/inc-cust-rebate', async (req, res) => {
  try {
    const { RebateCode, CardCode, CardName, QtrRebate } = req.body;
    
    console.log(`💾 Saving incremental customer rebate to database: ${req.database}`);
    
    const nextId = await getNextId(req.db, 'IncCustRebate');
    
    const query = `
      INSERT INTO IncCustRebate (Id, RebateCode, CardCode, CardName, QtrRebate, CreatedDate)
      VALUES (@Id, @RebateCode, @CardCode, @CardName, @QtrRebate, GETDATE())
    `;
    
    await req.db.request()
      .input('Id', sql.Int, nextId)
      .input('RebateCode', sql.NVarChar, RebateCode)
      .input('CardCode', sql.NVarChar, CardCode)
      .input('CardName', sql.NVarChar, CardName)
      .input('QtrRebate', sql.Int, QtrRebate || 0)
      .query(query);
    
    console.log(`✅ Incremental customer rebate saved successfully. ID: ${nextId}`);
    
    res.json({ 
      success: true, 
      id: nextId,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error saving incremental customer rebate:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

// Save to IncCustRange table
router.post('/inc-cust-range', async (req, res) => {
  try {
    const { IncCustRebateId, RangeNo, MinQty, MaxQty, RebatePerBag } = req.body;
    
    console.log(`💾 Saving incremental customer range to database: ${req.database}`);
    
    const nextId = await getNextId(req.db, 'IncCustRange');
    
    const query = `
      INSERT INTO IncCustRange (Id, IncCustRebateId, RangeNo, MinQty, MaxQty, RebatePerBag, CreatedDate)
      VALUES (@Id, @IncCustRebateId, @RangeNo, @MinQty, @MaxQty, @RebatePerBag, GETDATE())
    `;
    
    await req.db.request()
      .input('Id', sql.Int, nextId)
      .input('IncCustRebateId', sql.Int, IncCustRebateId)
      .input('RangeNo', sql.Int, RangeNo)
      .input('MinQty', sql.Int, MinQty || 0)
      .input('MaxQty', sql.Int, MaxQty || 0)
      .input('RebatePerBag', sql.Int, RebatePerBag || 0)
      .query(query);
    
    console.log(`✅ Incremental customer range saved successfully. ID: ${nextId}`);
    
    res.json({ 
      success: true,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error saving incremental customer range:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

// Save to IncItemRebate table
router.post('/inc-item-rebate', async (req, res) => {
  try {
    const { RebateCode, ItemCode, ItemName, UnitPerQty } = req.body;
    
    console.log(`💾 Saving incremental item rebate to database: ${req.database}`);
    
    const nextId = await getNextId(req.db, 'IncItemRebate');
    
    const query = `
      INSERT INTO IncItemRebate (Id, RebateCode, ItemCode, ItemName, UnitPerQty, CreatedDate)
      VALUES (@Id, @RebateCode, @ItemCode, @ItemName, @UnitPerQty, GETDATE())
    `;
    
    await req.db.request()
      .input('Id', sql.Int, nextId)
      .input('RebateCode', sql.NVarChar, RebateCode)
      .input('ItemCode', sql.NVarChar, ItemCode)
      .input('ItemName', sql.NVarChar, ItemName)
      .input('UnitPerQty', sql.Int, UnitPerQty || 0)
      .query(query);
    
    console.log(`✅ Incremental item rebate saved successfully. ID: ${nextId}`);
    
    res.json({ 
      success: true, 
      id: nextId,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error saving incremental item rebate:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

// Save to IncItemRange table
router.post('/inc-item-range', async (req, res) => {
  try {
    const { ItemRebateId, RangeNo, MinQty, MaxQty, RebatePerBag } = req.body;
    
    console.log(`💾 Saving incremental item range to database: ${req.database}`);
    
    const nextId = await getNextId(req.db, 'IncItemRange');
    
    const query = `
      INSERT INTO IncItemRange (Id, ItemRebateId, RangeNo, MinQty, MaxQty, RebatePerBag, CreatedDate)
      VALUES (@Id, @ItemRebateId, @RangeNo, @MinQty, @MaxQty, @RebatePerBag, GETDATE())
    `;
    
    await req.db.request()
      .input('Id', sql.Int, nextId)
      .input('ItemRebateId', sql.Int, ItemRebateId)
      .input('RangeNo', sql.Int, RangeNo)
      .input('MinQty', sql.Int, MinQty || 0)
      .input('MaxQty', sql.Int, MaxQty || 0)
      .input('RebatePerBag', sql.Int, RebatePerBag || 0)
      .query(query);
    
    console.log(`✅ Incremental item range saved successfully. ID: ${nextId}`);
    
    res.json({ 
      success: true,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error saving incremental item range:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

// Save to PerCustRebate table
router.post('/per-cust-rebate', async (req, res) => {
  try {
    const { RebateCode, CardCode, CardName } = req.body;
    
    console.log(`💾 Saving percentage customer rebate to database: ${req.database}`);
    
    // Don't get next ID for identity column - let SQL Server generate it
    const query = `
      INSERT INTO PerCustRebate (RebateCode, CardCode, CardName, CreatedDate)
      VALUES (@RebateCode, @CardCode, @CardName, GETDATE());
      
      SELECT SCOPE_IDENTITY() as NewId;
    `;
    
    const result = await req.db.request()
      .input('RebateCode', sql.NVarChar, RebateCode)
      .input('CardCode', sql.NVarChar, CardCode)
      .input('CardName', sql.NVarChar, CardName)
      .query(query);
    
    const newId = result.recordset[0].NewId;
    
    console.log(`✅ Percentage customer rebate saved successfully. ID: ${newId}`);
    
    res.json({ 
      success: true, 
      id: newId,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error saving percentage customer rebate:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

// Save to PerCustQuota table - UPDATED to handle Id if needed
router.post('/per-cust-quota', async (req, res) => {
  try {
    const { PerCustRebateId, Month, TargetQty, Id } = req.body;
    
    console.log(`💾 Saving percentage customer quota to database: ${req.database}`);
    console.log('📤 Data received:', { Id, PerCustRebateId, Month, TargetQty });
    
    let query, request;
    
    // Check if Id was provided (for non-identity columns)
    if (Id !== undefined && Id !== null) {
      console.log(`🔢 Using provided ID: ${Id}`);
      query = `
        INSERT INTO PerCustQuota (Id, PerCustRebateId, Month, TargetQty, CreatedDate)
        VALUES (@Id, @PerCustRebateId, @Month, @TargetQty, GETDATE());
        
        SELECT @Id as NewId;
      `;
      
      request = req.db.request()
        .input('Id', sql.Int, Id)
        .input('PerCustRebateId', sql.Int, PerCustRebateId)
        .input('Month', sql.NVarChar, Month)
        .input('TargetQty', sql.Decimal(18, 2), TargetQty || 0);
    } else {
      // Assume Id is identity column (auto-increment)
      console.log(`🔢 Using identity column (auto-increment)`);
      query = `
        INSERT INTO PerCustQuota (PerCustRebateId, Month, TargetQty, CreatedDate)
        VALUES (@PerCustRebateId, @Month, @TargetQty, GETDATE());
        
        SELECT SCOPE_IDENTITY() as NewId;
      `;
      
      request = req.db.request()
        .input('PerCustRebateId', sql.Int, PerCustRebateId)
        .input('Month', sql.NVarChar, Month)
        .input('TargetQty', sql.Decimal(18, 2), TargetQty || 0);
    }
    
    const result = await request.query(query);
    const newId = result.recordset[0].NewId;
    
    console.log(`✅ Percentage customer quota saved successfully. ID: ${newId}`);
    
    res.json({ 
      success: true,
      id: newId,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error saving percentage customer quota:', error);
    console.error('📋 Error details:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

// Save to PerProdRebate table
router.post('/per-prod-rebate', async (req, res) => {
  try {
    const { RebateCode, ItemCode, ItemName, UnitPerQty, PercentagePerBag } = req.body;
    
    console.log(`💾 Saving percentage product rebate to database: ${req.database}`);
    
    // Don't get next ID for identity column - let SQL Server generate it
    const query = `
      INSERT INTO PerProdRebate (RebateCode, ItemCode, ItemName, UnitPerQty, PercentagePerBag, CreatedDate)
      VALUES (@RebateCode, @ItemCode, @ItemName, @UnitPerQty, @PercentagePerBag, GETDATE());
      
      SELECT SCOPE_IDENTITY() as NewId;
    `;
    
    const result = await req.db.request()
      .input('RebateCode', sql.NVarChar, RebateCode)
      .input('ItemCode', sql.NVarChar, ItemCode)
      .input('ItemName', sql.NVarChar, ItemName)
      .input('UnitPerQty', sql.Int, UnitPerQty || 0)
      .input('PercentagePerBag', sql.Int, PercentagePerBag || 0)
      .query(query);
    
    const newId = result.recordset[0].NewId;
    
    console.log(`✅ Percentage product rebate saved successfully. ID: ${newId}`);
    
    res.json({ 
      success: true,
      id: newId,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error saving percentage product rebate:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});

// Get all rebate programs
router.get('/rebate-programs', async (req, res) => {
  try {
    const query = `SELECT * FROM RebateProgram ORDER BY CreatedDate DESC, RebateCode DESC`;
    
    const result = await req.db.request().query(query);
    
    res.json({
      success: true,
      data: result.recordset,
      database: req.database,
      count: result.recordset.length
    });
  } catch (error) {
    console.error('❌ Error fetching rebate programs:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      database: req.database 
    });
  }
});


/*===========================================*/
/*              RESTRICTIONS                 */
/*===========================================*/

// Backend route for detailed duplicate check
router.post('/check-duplicate-detailed', async (req, res) => {
  try {
    const { RebateType, SlpCode, DateFrom, DateTo, Frequency, CardCode, ItemCode } = req.body;
    
    console.log(`🔍 Checking for detailed duplicate rebate program...`);
    console.log(`   Customer: ${CardCode}, Item: ${ItemCode}`);
    
    // First, check if the RebateProgram table exists and has the data
    try {
      // Check if the tables exist
      const tableCheckQuery = `
        SELECT COUNT(*) as Count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'RebateProgram'
      `;
      
      const tableCheck = await req.db.request().query(tableCheckQuery);
      
      if (tableCheck.recordset[0].Count === 0) {
        console.log('RebateProgram table does not exist yet');
        return res.json({
          success: true,
          exists: false,
          message: 'RebateProgram table not found'
        });
      }
    } catch (tableError) {
      console.log('Error checking tables:', tableError.message);
      // Continue with the query - it will fail gracefully
    }
    
    let query = '';
    
    // Build detailed query based on rebate type
    if (RebateType === "Fixed") {
      query = `
        SELECT 
          rp.RebateCode,
          rp.DateFrom,
          rp.DateTo,
          rp.Frequency,
          rp.SlpName,
          fcr.CardCode,
          fcr.CardName,
          fpr.ItemCode,
          fpr.ItemName
        FROM RebateProgram rp
        INNER JOIN FixCustRebate fcr ON rp.RebateCode = fcr.RebateCode
        INNER JOIN FixProdRebate fpr ON rp.RebateCode = fpr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.SlpCode = @SlpCode
          AND rp.DateFrom = @DateFrom
          AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency
          AND fcr.CardCode = @CardCode
          AND fpr.ItemCode = @ItemCode
      `;
    } else if (RebateType === "Percentage") {
      query = `
        SELECT 
          rp.RebateCode,
          rp.DateFrom,
          rp.DateTo,
          rp.Frequency,
          rp.SlpName,
          pcr.CardCode,
          pcr.CardName,
          ppr.ItemCode,
          ppr.ItemName
        FROM RebateProgram rp
        INNER JOIN PerCustRebate pcr ON rp.RebateCode = pcr.RebateCode
        INNER JOIN PerProdRebate ppr ON rp.RebateCode = ppr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.SlpCode = @SlpCode
          AND rp.DateFrom = @DateFrom
          AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency
          AND pcr.CardCode = @CardCode
          AND ppr.ItemCode = @ItemCode
      `;
    } else if (RebateType === "Incremental") {
      query = `
        SELECT 
          rp.RebateCode,
          rp.DateFrom,
          rp.DateTo,
          rp.Frequency,
          rp.SlpName,
          icr.CardCode,
          icr.CardName,
          iir.ItemCode,
          iir.ItemName
        FROM RebateProgram rp
        INNER JOIN IncCustRebate icr ON rp.RebateCode = icr.RebateCode
        INNER JOIN IncItemRebate iir ON rp.RebateCode = iir.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.SlpCode = @SlpCode
          AND rp.DateFrom = @DateFrom
          AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency
          AND icr.CardCode = @CardCode
          AND iir.ItemCode = @ItemCode
      `;
    } else {
      return res.json({
        success: true,
        exists: false,
        message: 'Invalid rebate type'
      });
    }
    
    const result = await req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('SlpCode', sql.Int, SlpCode)
      .input('DateFrom', sql.Date, DateFrom)
      .input('DateTo', sql.Date, DateTo)
      .input('Frequency', sql.NVarChar, Frequency)
      .input('CardCode', sql.NVarChar, CardCode)
      .input('ItemCode', sql.NVarChar, ItemCode)
      .query(query);
    
    const exists = result.recordset.length > 0;
    
    if (exists) {
      const duplicate = result.recordset[0];
      console.log(`📊 Duplicate found:`);
      console.log(`   - Rebate Code: ${duplicate.RebateCode}`);
      console.log(`   - Customer: ${duplicate.CardName} (${duplicate.CardCode})`);
      console.log(`   - Item: ${duplicate.ItemName} (${duplicate.ItemCode})`);
      console.log(`   - Period: ${duplicate.DateFrom} to ${duplicate.DateTo}`);
      console.log(`   - Frequency: ${duplicate.Frequency}`);
      console.log(`   - Sales Employee: ${duplicate.SlpName}`);
      
      res.json({
        success: true,
        exists: true,
        existingRebateCode: duplicate.RebateCode,
        existingDateFrom: duplicate.DateFrom,
        existingDateTo: duplicate.DateTo,
        existingFrequency: duplicate.Frequency,
        existingSlpName: duplicate.SlpName,
        existingCardCode: duplicate.CardCode,
        existingCardName: duplicate.CardName,
        existingItemCode: duplicate.ItemCode,
        existingItemName: duplicate.ItemName
      });
    } else {
      console.log(`✅ No duplicate found for Customer: ${CardCode}, Item: ${ItemCode}`);
      res.json({
        success: true,
        exists: false
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking for duplicates:', error);
    res.status(200).json({  // Return 200 with error info instead of 500
      success: false,
      exists: false,
      error: error.message,
      message: 'Error checking duplicates, but will proceed with save'
    });
  }
});

// Simple test endpoint to verify the route works
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Rebate program API is working',
    timestamp: new Date().toISOString()
  });
});

// Optional: Batch duplicate check endpoint for better performance
router.post('/check-duplicates-batch', async (req, res) => {
  try {
    const { RebateType, SlpCode, DateFrom, DateTo, Frequency, combinations } = req.body;
    // combinations is an array of { CardCode, ItemCode }
    
    console.log(`🔍 Batch checking ${combinations.length} combinations for duplicates...`);
    
    const results = [];
    
    for (const combo of combinations) {
      let query = '';
      
      if (RebateType === "Fixed") {
        query = `
          SELECT 
            rp.RebateCode,
            rp.DateFrom,
            rp.DateTo,
            rp.Frequency,
            rp.SlpName,
            fcr.CardCode,
            fcr.CardName,
            fpr.ItemCode,
            fpr.ItemName
          FROM RebateProgram rp
          INNER JOIN FixCustRebate fcr ON rp.RebateCode = fcr.RebateCode
          INNER JOIN FixProdRebate fpr ON rp.RebateCode = fpr.RebateCode
          WHERE rp.RebateType = @RebateType
            AND rp.SlpCode = @SlpCode
            AND rp.DateFrom = @DateFrom
            AND rp.DateTo = @DateTo
            AND rp.Frequency = @Frequency
            AND fcr.CardCode = @CardCode
            AND fpr.ItemCode = @ItemCode
        `;
      } else if (RebateType === "Percentage") {
        query = `
          SELECT 
            rp.RebateCode,
            rp.DateFrom,
            rp.DateTo,
            rp.Frequency,
            rp.SlpName,
            pcr.CardCode,
            pcr.CardName,
            ppr.ItemCode,
            ppr.ItemName
          FROM RebateProgram rp
          INNER JOIN PerCustRebate pcr ON rp.RebateCode = pcr.RebateCode
          INNER JOIN PerProdRebate ppr ON rp.RebateCode = ppr.RebateCode
          WHERE rp.RebateType = @RebateType
            AND rp.SlpCode = @SlpCode
            AND rp.DateFrom = @DateFrom
            AND rp.DateTo = @DateTo
            AND rp.Frequency = @Frequency
            AND pcr.CardCode = @CardCode
            AND ppr.ItemCode = @ItemCode
        `;
      } else if (RebateType === "Incremental") {
        query = `
          SELECT 
            rp.RebateCode,
            rp.DateFrom,
            rp.DateTo,
            rp.Frequency,
            rp.SlpName,
            icr.CardCode,
            icr.CardName,
            iir.ItemCode,
            iir.ItemName
          FROM RebateProgram rp
          INNER JOIN IncCustRebate icr ON rp.RebateCode = icr.RebateCode
          INNER JOIN IncItemRebate iir ON rp.RebateCode = iir.RebateCode
          WHERE rp.RebateType = @RebateType
            AND rp.SlpCode = @SlpCode
            AND rp.DateFrom = @DateFrom
            AND rp.DateTo = @DateTo
            AND rp.Frequency = @Frequency
            AND icr.CardCode = @CardCode
            AND iir.ItemCode = @ItemCode
        `;
      }
      
      const result = await req.db.request()
        .input('RebateType', sql.NVarChar, RebateType)
        .input('SlpCode', sql.Int, SlpCode)
        .input('DateFrom', sql.Date, DateFrom)
        .input('DateTo', sql.Date, DateTo)
        .input('Frequency', sql.NVarChar, Frequency)
        .input('CardCode', sql.NVarChar, combo.CardCode)
        .input('ItemCode', sql.NVarChar, combo.ItemCode)
        .query(query);
      
      if (result.recordset.length > 0) {
        const dup = result.recordset[0];
        results.push({
          customerCode: combo.CardCode,
          itemCode: combo.ItemCode,
          exists: true,
          existingRebateCode: dup.RebateCode,
          existingDateFrom: dup.DateFrom,
          existingDateTo: dup.DateTo,
          existingFrequency: dup.Frequency,
          existingSlpName: dup.SlpName,
          existingCardName: dup.CardName,
          existingItemName: dup.ItemName
        });
      } else {
        results.push({
          customerCode: combo.CardCode,
          itemCode: combo.ItemCode,
          exists: false
        });
      }
    }
    
    const duplicates = results.filter(r => r.exists);
    
    console.log(`📊 Batch check complete: Found ${duplicates.length} duplicates out of ${combinations.length} combinations`);
    
    res.json({
      success: true,
      duplicates: duplicates,
      totalChecked: combinations.length,
      duplicateCount: duplicates.length
    });
    
  } catch (error) {
    console.error('❌ Error in batch duplicate check:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Backend endpoint to check if an item exists in ANY program with the same parameters
router.post('/check-item-conflict', async (req, res) => {
  try {
    const { RebateType, SlpCode, DateFrom, DateTo, Frequency, ItemCode } = req.body;
    
    console.log(`🔍 Checking if item ${ItemCode} exists in ANY program with same parameters...`);
    console.log('Request body:', req.body);
    
    // First check if RebateProgram table exists and has data
    try {
      const tableCheck = await req.db.request().query(`
        SELECT COUNT(*) as Count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'RebateProgram'
      `);
      
      if (tableCheck.recordset[0].Count === 0) {
        console.log('RebateProgram table does not exist yet');
        return res.json({
          success: true,
          exists: false,
          message: 'RebateProgram table not found'
        });
      }
    } catch (tableError) {
      console.log('Error checking tables:', tableError.message);
    }
    
    let query = '';
    
    // Determine which product table to check based on rebate type
    if (RebateType === "Fixed") {
      query = `
        SELECT DISTINCT
          rp.RebateCode,
          rp.DateFrom,
          rp.DateTo,
          rp.Frequency,
          rp.SlpName,
          rp.QuotaType,
          fpr.ItemCode,
          fpr.ItemName
        FROM RebateProgram rp
        INNER JOIN FixProdRebate fpr ON rp.RebateCode = fpr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.SlpCode = @SlpCode
          AND rp.DateFrom = @DateFrom
          AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency
          AND fpr.ItemCode = @ItemCode
      `;
    } else if (RebateType === "Percentage") {
      query = `
        SELECT DISTINCT
          rp.RebateCode,
          rp.DateFrom,
          rp.DateTo,
          rp.Frequency,
          rp.SlpName,
          rp.QuotaType,
          ppr.ItemCode,
          ppr.ItemName
        FROM RebateProgram rp
        INNER JOIN PerProdRebate ppr ON rp.RebateCode = ppr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.SlpCode = @SlpCode
          AND rp.DateFrom = @DateFrom
          AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency
          AND ppr.ItemCode = @ItemCode
      `;
    } else if (RebateType === "Incremental") {
      query = `
        SELECT DISTINCT
          rp.RebateCode,
          rp.DateFrom,
          rp.DateTo,
          rp.Frequency,
          rp.SlpName,
          rp.QuotaType,
          iir.ItemCode,
          iir.ItemName
        FROM RebateProgram rp
        INNER JOIN IncItemRebate iir ON rp.RebateCode = iir.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.SlpCode = @SlpCode
          AND rp.DateFrom = @DateFrom
          AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency
          AND iir.ItemCode = @ItemCode
      `;
    } else {
      return res.json({
        success: true,
        exists: false,
        message: 'Invalid rebate type'
      });
    }
    
    const result = await req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('SlpCode', sql.Int, SlpCode)
      .input('DateFrom', sql.Date, DateFrom)
      .input('DateTo', sql.Date, DateTo)
      .input('Frequency', sql.NVarChar, Frequency)
      .input('ItemCode', sql.NVarChar, ItemCode)
      .query(query);
    
    const exists = result.recordset.length > 0;
    
    if (exists) {
      const program = result.recordset[0];
      console.log(`⚠️ Item conflict found for ${ItemCode} in program ${program.RebateCode}`);
      
      res.json({
        success: true,
        exists: true,
        existingProgram: {
          RebateCode: program.RebateCode,
          DateFrom: program.DateFrom,
          DateTo: program.DateTo,
          Frequency: program.Frequency,
          SlpName: program.SlpName,
          QuotaType: program.QuotaType,
          ItemCode: program.ItemCode,
          ItemName: program.ItemName
        }
      });
    } else {
      console.log(`✅ No conflict found for item ${ItemCode}`);
      res.json({
        success: true,
        exists: false
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking item conflict:', error);
    res.status(200).json({  // Return 200 with error info instead of 500 to avoid JSON parse error
      success: false,
      exists: false,
      error: error.message,
      message: 'Error checking item conflicts'
    });
  }
});


router.post('/rebate-program/check-duplicate-program', async (req, res) => {
  try {
    const { RebateType, SlpCode, DateFrom, DateTo } = req.body;
    
    console.log(`🔍 Checking for duplicate rebate program...`);
    console.log(`   Type: ${RebateType}, Sales Emp Code: ${SlpCode}, From: ${DateFrom}, To: ${DateTo}`);
    
    // Validate required fields
    if (!RebateType || !SlpCode || !DateFrom || !DateTo) {
      return res.status(400).json({
        success: false,
        exists: false,
        error: 'Missing required fields'
      });
    }
    
    // First check if RebateProgram table exists
    try {
      const tableCheck = await req.db.request().query(`
        SELECT COUNT(*) as Count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'RebateProgram'
      `);
      
      if (tableCheck.recordset[0].Count === 0) {
        console.log('RebateProgram table does not exist yet');
        return res.json({
          success: true,
          exists: false,
          message: 'RebateProgram table not found'
        });
      }
    } catch (tableError) {
      console.log('Error checking tables:', tableError.message);
    }
    
    // Query to check for existing program with same parameters
    const query = `
      SELECT 
        RebateCode,
        RebateType,
        SlpCode,
        SlpName,
        DateFrom,
        DateTo,
        Frequency,
        QuotaType,
        CreatedDate
      FROM RebateProgram 
      WHERE RebateType = @RebateType
        AND SlpCode = @SlpCode
        AND DateFrom = @DateFrom
        AND DateTo = @DateTo
    `;
    
    const result = await req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('SlpCode', sql.Int, SlpCode)
      .input('DateFrom', sql.Date, DateFrom)
      .input('DateTo', sql.Date, DateTo)
      .query(query);
    
    const exists = result.recordset.length > 0;
    
    if (exists) {
      const program = result.recordset[0];
      console.log(`⚠️ Duplicate program found! Rebate Code: ${program.RebateCode}`);
      
      res.json({
        success: true,
        exists: true,
        program: {
          RebateCode: program.RebateCode,
          RebateType: program.RebateType,
          SlpName: program.SlpName,
          DateFrom: program.DateFrom,
          DateTo: program.DateTo,
          Frequency: program.Frequency,
          QuotaType: program.QuotaType,
          CreatedDate: program.CreatedDate
        }
      });
    } else {
      console.log(`✅ No duplicate program found with these parameters`);
      res.json({
        success: true,
        exists: false
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking for duplicate program:', error);
    res.status(200).json({ 
      success: false, 
      exists: false,
      error: error.message,
      message: 'Error checking for duplicate program'
    });
  }
});

/* To edit the rebate program  */
// GET /api/rebate-program/by-code/:code
router.get('/rebate-program/by-code/:code', async (req, res) => {
  const result = await req.db.request().input('c', sql.NVarChar, req.params.code)
    .query('SELECT * FROM RebateProgram WHERE RebateCode = @c');
  res.json({ success: true, program: result.recordset[0] || null });
});

// GET /api/rebate-program/customers/:code?type=Fixed|Incremental|Percentage
router.get('/rebate-program/customers/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const type = req.query.type || 'Fixed';

    if (type === 'Fixed') {
      // Get customers
      const custResult = await req.db.request()
        .input('c', sql.NVarChar, code)
        .query(`SELECT * FROM FixCustRebate WHERE RebateCode = @c`);

      // For each customer, fetch their quotas
      const customers = [];
      for (const cust of custResult.recordset) {
        const quotaResult = await req.db.request()
          .input('id', sql.Int, cust.Id)
          .query(`SELECT * FROM FixCustQuota WHERE CustRebateId = @id ORDER BY Id ASC`);
        customers.push({ ...cust, quotas: quotaResult.recordset });
      }

      res.json({ success: true, customers });

    } else if (type === 'Incremental') {
      const custResult = await req.db.request()
        .input('c', sql.NVarChar, code)
        .query(`SELECT * FROM IncCustRebate WHERE RebateCode = @c`);

      const customers = [];
      for (const cust of custResult.recordset) {
        const rangeResult = await req.db.request()
          .input('id', sql.Int, cust.Id)
          .query(`SELECT * FROM IncCustRange WHERE IncCustRebateId = @id ORDER BY RangeNo ASC`);
        customers.push({ ...cust, ranges: rangeResult.recordset });
      }

      res.json({ success: true, customers });

    } else if (type === 'Percentage') {
      const custResult = await req.db.request()
        .input('c', sql.NVarChar, code)
        .query(`SELECT * FROM PerCustRebate WHERE RebateCode = @c`);

      const customers = [];
      for (const cust of custResult.recordset) {
        const quotaResult = await req.db.request()
          .input('id', sql.Int, cust.Id)
          .query(`SELECT * FROM PerCustQuota WHERE PerCustRebateId = @id ORDER BY Id ASC`);
        customers.push({ ...cust, quotas: quotaResult.recordset });
      }

      res.json({ success: true, customers });

    } else {
      res.json({ success: false, error: 'Invalid rebate type' });
    }

  } catch (err) {
    console.error('❌ Error fetching customers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


router.get('/rebate-program/items/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const type = req.query.type || 'Fixed';

    if (type === 'Fixed') {
      // FixProdRebate has no child range table based on your list
      const result = await req.db.request()
        .input('c', sql.NVarChar, code)
        .query(`SELECT * FROM FixProdRebate WHERE RebateCode = @c`);

      res.json({ success: true, items: result.recordset });

    } else if (type === 'Incremental') {
      const itemResult = await req.db.request()
        .input('c', sql.NVarChar, code)
        .query(`SELECT * FROM IncItemRebate WHERE RebateCode = @c`);

      const items = [];
      for (const item of itemResult.recordset) {
        const rangeResult = await req.db.request()
          .input('id', sql.Int, item.Id)
          .query(`SELECT * FROM IncItemRange WHERE ItemRebateId = @id ORDER BY RangeNo ASC`);
        items.push({ ...item, ranges: rangeResult.recordset });
      }

      res.json({ success: true, items });

    } else if (type === 'Percentage') {
      // PerProdRebate has no child table based on your list
      const result = await req.db.request()
        .input('c', sql.NVarChar, code)
        .query(`SELECT * FROM PerProdRebate WHERE RebateCode = @c`);

      res.json({ success: true, items: result.recordset });

    } else {
      res.json({ success: false, error: 'Invalid rebate type' });
    }

  } catch (err) {
    console.error('❌ Error fetching items:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/rebate-program/:code — update program header
router.put('/rebate-program/:code', async (req, res) => {
  const { RebateType, SlpCode, SlpName, DateFrom, DateTo, Frequency, QuotaType } = req.body;
  await req.db.request()
    .input('c',  sql.NVarChar, req.params.code)
    .input('rt', sql.NVarChar, RebateType).input('sc', sql.Int, SlpCode)
    .input('sn', sql.NVarChar, SlpName).input('df', sql.Date, DateFrom)
    .input('dt', sql.Date, DateTo).input('fr', sql.NVarChar, Frequency)
    .input('qt', sql.NVarChar, QuotaType)
    .query(`UPDATE RebateProgram SET RebateType=@rt, SlpCode=@sc, SlpName=@sn,
      DateFrom=@df, DateTo=@dt, Frequency=@fr, QuotaType=@qt WHERE RebateCode=@c`);
  res.json({ success: true });
});

// DELETE /api/rebate-program/:code/details?type=Fixed|Incremental|Percentage
// Deletes all child rows so they can be re-inserted fresh
router.delete('/rebate-program/:code/details', async (req, res) => {
  const type = req.query.type;
  const code = req.params.code;
  const db   = req.db;
  if (type === 'Fixed') {
    // quotas cascade if FK is set; otherwise delete manually
    const custIds = await db.request().input('c', sql.NVarChar, code)
      .query('SELECT Id FROM FixCustRebate WHERE RebateCode = @c');
    for (const row of custIds.recordset)
      await db.request().input('id', sql.Int, row.Id)
        .query('DELETE FROM FixCustQuota WHERE CustRebateId = @id');
    await db.request().input('c', sql.NVarChar, code).query('DELETE FROM FixCustRebate WHERE RebateCode = @c');
    await db.request().input('c', sql.NVarChar, code).query('DELETE FROM FixProdRebate WHERE RebateCode = @c');
  } else if (type === 'Incremental') {
    const custIds = await db.request().input('c', sql.NVarChar, code).query('SELECT Id FROM IncCustRebate WHERE RebateCode = @c');
    for (const row of custIds.recordset)
      await db.request().input('id', sql.Int, row.Id).query('DELETE FROM IncCustRange WHERE IncCustRebateId = @id');
    await db.request().input('c', sql.NVarChar, code).query('DELETE FROM IncCustRebate WHERE RebateCode = @c');
    const itemIds = await db.request().input('c', sql.NVarChar, code).query('SELECT Id FROM IncItemRebate WHERE RebateCode = @c');
    for (const row of itemIds.recordset)
      await db.request().input('id', sql.Int, row.Id).query('DELETE FROM IncItemRange WHERE ItemRebateId = @id');
    await db.request().input('c', sql.NVarChar, code).query('DELETE FROM IncItemRebate WHERE RebateCode = @c');
  } else if (type === 'Percentage') {
    const custIds = await db.request().input('c', sql.NVarChar, code).query('SELECT Id FROM PerCustRebate WHERE RebateCode = @c');
    for (const row of custIds.recordset)
      await db.request().input('id', sql.Int, row.Id).query('DELETE FROM PerCustQuota WHERE PerCustRebateId = @id');
    await db.request().input('c', sql.NVarChar, code).query('DELETE FROM PerCustRebate WHERE RebateCode = @c');
    await db.request().input('c', sql.NVarChar, code).query('DELETE FROM PerProdRebate WHERE RebateCode = @c');
  }
  res.json({ success: true });
});

// GET /api/rebate-program/all-codes
router.get('/rebate-program/all-codes', async (req, res) => {
  try {
    const result = await req.db.request()
      .query(`SELECT RebateCode, RebateType, SlpName, DateFrom, DateTo 
              FROM RebateProgram 
              WHERE RebateCode LIKE 'REB-%' 
              ORDER BY RebateCode DESC`);
    res.json({ success: true, codes: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;