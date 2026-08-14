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

// ─── GET highest rebate code ────────────────────────────────────────────────
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
    const nextCode    = result.recordset[0].NextCode;

    console.log(`🏆 Highest: "${highestCode}"  |  🎯 Next: "${nextCode}"`);

    res.json({
      success: true,
      highestCode: highestCode || 'REB-00000',
      nextCode,
      database: req.database
    });
  } catch (error) {
    console.error('❌ Error fetching highest rebate code:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── CREATE rebate program ───────────────────────────────────────────────────
router.post('/rebate-program', validateRebateProgram, async (req, res) => {
  try {
    const { RebateType, SlpCode, SlpName, DateFrom, DateTo, Frequency, QuotaType, CreatedBy } = req.body;
    const createdBy = CreatedBy || 'Unknown';
    console.log(`💾 Saving rebate program to database: ${req.database}`);

    const nextCodeResult = await req.db.request().query(`
      SELECT 
        CASE 
          WHEN MAX(RebateCode) IS NULL THEN 'REB-00001'
          ELSE 'REB-' + RIGHT('00000' + CAST(CAST(SUBSTRING(MAX(RebateCode), 5, LEN(MAX(RebateCode))) AS INT) + 1 AS VARCHAR), 5)
        END as NextCode
      FROM RebateProgram 
      WHERE RebateCode LIKE 'REB-%'
    `);
    const nextRebateCode = nextCodeResult.recordset[0].NextCode;
    console.log(`🔢 Generated next rebate code: ${nextRebateCode}`);

    await req.db.request()
      .input('RebateCode', sql.NVarChar, nextRebateCode)
      .input('RebateType', sql.NVarChar, RebateType)
      .input('SlpCode',    sql.Int,      SlpCode)
      .input('SlpName',    sql.NVarChar, SlpName)
      .input('DateFrom',   sql.Date,     DateFrom)
      .input('DateTo',     sql.Date,     DateTo)
      .input('Frequency',  sql.NVarChar, Frequency  || 'Quarterly')
      .input('QuotaType',  sql.NVarChar, QuotaType  || 'With Quota')
      .input('CreatedBy',  sql.NVarChar, createdBy)
      .input('UpdatedBy',  sql.NVarChar, createdBy)
      .query(`
        INSERT INTO RebateProgram
          (RebateCode, RebateType, SlpCode, SlpName, DateFrom, DateTo, Frequency, QuotaType, CreatedBy, UpdatedBy, CreatedDate, UpdatedDate)
        VALUES
          (@RebateCode, @RebateType, @SlpCode, @SlpName, @DateFrom, @DateTo, @Frequency, @QuotaType, @CreatedBy, @UpdatedBy, GETDATE(), GETDATE())
      `);

    console.log(`✅ Rebate program saved. RebateCode: ${nextRebateCode}`);
    res.json({ success: true, rebateCode: nextRebateCode, database: req.database });
  } catch (error) {
    console.error('❌ Error saving rebate program:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── Helper: get next ID ─────────────────────────────────────────────────────
const getNextId = async (db, tableName) => {
  try {
    const result = await db.request().query(`SELECT ISNULL(MAX(Id), 0) as MaxId FROM ${tableName}`);
    return result.recordset[0].MaxId + 1;
  } catch (error) {
    console.error(`Error getting next ID for ${tableName}:`, error);
    return 1;
  }
};

// ─── FixCustRebate ───────────────────────────────────────────────────────────
router.post('/fix-cust-rebate', async (req, res) => {
  try {
    const { RebateCode, CardCode, CardName, QtrRebate, CreatedDate } = req.body;
    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();

    const request = req.db.request();
    request.input('RebateCode', sql.NVarChar(50), RebateCode);
    request.input('CardCode',   sql.NVarChar(15), CardCode);
    request.input('CardName',   sql.NVarChar(100), CardName);
    request.input('QtrRebate',  sql.Decimal(19,6), QtrRebate || 0);
    request.input('CreatedDate', sql.DateTime, createdDateValue);

    await request.query(`
      INSERT INTO FixCustRebate (RebateCode, CardCode, CardName, QtrRebate, CreatedDate, UpdatedDate)
      VALUES (@RebateCode, @CardCode, @CardName, @QtrRebate, @CreatedDate, GETDATE())
    `);

    const idResult = await req.db.request().query('SELECT SCOPE_IDENTITY() as NewId');
    const newId = idResult.recordset[0].NewId;
    res.json({ success: true, id: newId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── FixCustQuota (single) ───────────────────────────────────────────────────
router.post('/fix-cust-quota', async (req, res) => {
  try {
    const { CustRebateId, Month, TargetQty } = req.body;
    console.log(`💾 Saving fixed customer quota: ${req.database}`, { CustRebateId, Month, TargetQty });

    const result = await req.db.request()
      .input('CustRebateId', sql.Int,          CustRebateId)
      .input('Month',        sql.NVarChar,      Month)
      .input('TargetQty',    sql.Decimal(18,2), TargetQty || 0)
      .query(`
        INSERT INTO FixCustQuota (CustRebateId, Month, TargetQty, CreatedDate, UpdatedDate)
        VALUES (@CustRebateId, @Month, @TargetQty, GETDATE(), GETDATE());
        SELECT SCOPE_IDENTITY() as NewId;
      `);

    const newId = result.recordset[0].NewId;
    console.log(`✅ Fixed customer quota saved. ID: ${newId}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving fixed customer quota:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── FixCustQuota (bulk) ─────────────────────────────────────────────────────
router.post('/fix-cust-quotas/bulk', async (req, res) => {
  try {
    const { CustRebateId, quotas } = req.body;
    console.log(`💾 Bulk saving fixed customer quotas: ${req.database}`, { CustRebateId, quotas });

    if (!Array.isArray(quotas) || quotas.length === 0) {
      return res.status(400).json({ success: false, error: 'No quotas provided', database: req.database });
    }

    const results = [];
    for (const { Month, TargetQty } of quotas) {
      const result = await req.db.request()
        .input('CustRebateId', sql.Int,          CustRebateId)
        .input('Month',        sql.NVarChar,      Month)
        .input('TargetQty',    sql.Decimal(18,2), TargetQty || 0)
        .query(`
          INSERT INTO FixCustQuota (CustRebateId, Month, TargetQty, CreatedDate, UpdatedDate)
          VALUES (@CustRebateId, @Month, @TargetQty, GETDATE(), GETDATE());
          SELECT SCOPE_IDENTITY() as NewId;
        `);
      results.push(result.recordset[0].NewId);
    }

    console.log(`✅ ${results.length} fixed customer quotas saved.`);
    res.json({ success: true, ids: results, count: results.length, database: req.database });
  } catch (error) {
    console.error('❌ Error bulk saving fixed customer quotas:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── FixProdRebate ───────────────────────────────────────────────────────────
router.post('/fix-prod-rebate', async (req, res) => {
  try {
    const { 
      RebateCode, ItemCode, ItemName, UnitPerQty, RebatePerBag, UnitOfMeasure,
      CreatedDate   // ← NEW: optional original creation date
    } = req.body;

    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();

    const result = await req.db.request()
      .input('RebateCode',    sql.NVarChar, RebateCode)
      .input('ItemCode',      sql.NVarChar, ItemCode)
      .input('ItemName',      sql.NVarChar, ItemName)
      .input('UnitPerQty',    sql.Decimal(18,2), UnitPerQty || 0)
      .input('RebatePerBag',  sql.Decimal(18,2), RebatePerBag || 0)
      .input('UnitOfMeasure', sql.NVarChar, UnitOfMeasure || '')
      .input('CreatedDate',   sql.DateTime, createdDateValue)
      .query(`
        INSERT INTO FixProdRebate (Id, RebateCode, ItemCode, ItemName, UnitPerQty, RebatePerBag, UnitOfMeasure, CreatedDate, UpdatedDate)
        VALUES (@Id, @RebateCode, @ItemCode, @ItemName, @UnitPerQty, @RebatePerBag, @UnitOfMeasure, GETDATE(), GETDATE())
        SELECT SCOPE_IDENTITY() as NewId;
      `);

    const newId = result.recordset[0].NewId;
    console.log(`✅ Fixed product rebate saved. ID: ${newId}, UOM: ${UnitOfMeasure}`);
    res.json({ success: true, id: newId });
  } catch (error) {
    console.error('❌ Error saving fixed product rebate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── IncCustRebate ───────────────────────────────────────────────────────────
router.post('/inc-cust-rebate', async (req, res) => {
  try {
    const { RebateCode, CardCode, CardName, QtrRebate, CreatedDate } = req.body;
    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();
    const nextId = await getNextId(req.db, 'IncCustRebate');

    await req.db.request()
      .input('Id',         sql.Int,      nextId)
      .input('RebateCode', sql.NVarChar, RebateCode)
      .input('CardCode',   sql.NVarChar, CardCode)
      .input('CardName',   sql.NVarChar, CardName)
      .input('QtrRebate',  sql.Int,      QtrRebate || 0)
      .input('CreatedDate',sql.DateTime, createdDateValue)
      .query(`
        INSERT INTO IncCustRebate (Id, RebateCode, CardCode, CardName, QtrRebate, CreatedDate, UpdatedDate)
        VALUES (@Id, @RebateCode, @CardCode, @CardName, @QtrRebate, @CreatedDate, GETDATE())
      `);

    res.json({ success: true, id: nextId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── IncCustRange ────────────────────────────────────────────────────────────
router.post('/inc-cust-range', async (req, res) => {
  try {
    const { IncCustRebateId, RangeNo, MinQty, MaxQty, RebatePerBag } = req.body;
    console.log(`💾 Saving incremental customer range: ${req.database}`);

    const nextId = await getNextId(req.db, 'IncCustRange');

    await req.db.request()
      .input('Id',             sql.Int, nextId)
      .input('IncCustRebateId',sql.Int, IncCustRebateId)
      .input('RangeNo',        sql.Int, RangeNo)
      .input('MinQty',         sql.Int, MinQty      || 0)
      .input('MaxQty',         sql.Int, MaxQty      || 0)
      .input('RebatePerBag',   sql.Int, RebatePerBag|| 0)
      .query(`
        INSERT INTO IncCustRange (Id, IncCustRebateId, RangeNo, MinQty, MaxQty, RebatePerBag, CreatedDate, UpdatedDate)
        VALUES (@Id, @IncCustRebateId, @RangeNo, @MinQty, @MaxQty, @RebatePerBag, GETDATE(), GETDATE())
      `);

    console.log(`✅ Incremental customer range saved. ID: ${nextId}`);
    res.json({ success: true, database: req.database });
  } catch (error) {
    console.error('❌ Error saving incremental customer range:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── IncItemRebate ───────────────────────────────────────────────────────────
router.post('/inc-item-rebate', async (req, res) => {
  try {
    const { RebateCode, ItemCode, ItemName, UnitPerQty, UnitOfMeasure, CreatedDate } = req.body;
    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();
    const nextId = await getNextId(req.db, 'IncItemRebate');

    await req.db.request()
      .input('Id',            sql.Int,      nextId)
      .input('RebateCode',    sql.NVarChar, RebateCode)
      .input('ItemCode',      sql.NVarChar, ItemCode)
      .input('ItemName',      sql.NVarChar, ItemName)
      .input('UnitPerQty',    sql.Int,      UnitPerQty || 0)
      .input('UnitOfMeasure', sql.NVarChar, UnitOfMeasure || '')
      .input('CreatedDate',   sql.DateTime, createdDateValue)
      .query(`
        INSERT INTO IncItemRebate 
          (Id, RebateCode, ItemCode, ItemName, UnitPerQty, UnitOfMeasure, CreatedDate, UpdatedDate)
        VALUES 
          (@Id, @RebateCode, @ItemCode, @ItemName, @UnitPerQty, @UnitOfMeasure, @CreatedDate, GETDATE())
      `);

    res.json({ success: true, id: nextId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── IncItemRange ────────────────────────────────────────────────────────────
router.post('/inc-item-range', async (req, res) => {
  try {
    const { ItemRebateId, RangeNo, MinQty, MaxQty, RebatePerBag } = req.body;
    console.log(`💾 Saving incremental item range: ${req.database}`);

    const nextId = await getNextId(req.db, 'IncItemRange');

    await req.db.request()
      .input('Id',           sql.Int, nextId)
      .input('ItemRebateId', sql.Int, ItemRebateId)
      .input('RangeNo',      sql.Int, RangeNo)
      .input('MinQty',       sql.Int, MinQty      || 0)
      .input('MaxQty',       sql.Int, MaxQty      || 0)
      .input('RebatePerBag', sql.Int, RebatePerBag|| 0)
      .query(`
        INSERT INTO IncItemRange (Id, ItemRebateId, RangeNo, MinQty, MaxQty, RebatePerBag, CreatedDate, UpdatedDate)
        VALUES (@Id, @ItemRebateId, @RangeNo, @MinQty, @MaxQty, @RebatePerBag, GETDATE(), GETDATE())
      `);

    console.log(`✅ Incremental item range saved. ID: ${nextId}`);
    res.json({ success: true, database: req.database });
  } catch (error) {
    console.error('❌ Error saving incremental item range:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── PerCustRebate ───────────────────────────────────────────────────────────
router.post('/per-cust-rebate', async (req, res) => {
  try {
    const { RebateCode, CardCode, CardName, CreatedDate } = req.body;
    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();

    const result = await req.db.request()
      .input('RebateCode',  sql.NVarChar, RebateCode)
      .input('CardCode',    sql.NVarChar, CardCode)
      .input('CardName',    sql.NVarChar, CardName)
      .input('CreatedDate', sql.DateTime, createdDateValue)
      .query(`
        INSERT INTO PerCustRebate (RebateCode, CardCode, CardName, CreatedDate, UpdatedDate)
        VALUES (@RebateCode, @CardCode, @CardName, @CreatedDate, GETDATE());
        SELECT SCOPE_IDENTITY() as NewId;
      `);

    res.json({ success: true, id: result.recordset[0].NewId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PerCustQuota (single) ───────────────────────────────────────────────────
router.post('/per-cust-quota', async (req, res) => {
  try {
    const { PerCustRebateId, Month, TargetQty } = req.body;
    console.log(`💾 Saving percentage customer quota: ${req.database}`);

    const result = await req.db.request()
      .input('PerCustRebateId', sql.Int,          PerCustRebateId)
      .input('Month',           sql.NVarChar,      Month)
      .input('TargetQty',       sql.Decimal(18,2), TargetQty || 0)
      .query(`
        INSERT INTO PerCustQuota (PerCustRebateId, Month, TargetQty, CreatedDate, UpdatedDate)
        VALUES (@PerCustRebateId, @Month, @TargetQty, GETDATE(), GETDATE());
        SELECT SCOPE_IDENTITY() as NewId;
      `);

    const newId = result.recordset[0].NewId;
    console.log(`✅ Percentage customer quota saved. ID: ${newId}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving percentage customer quota:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── PerCustQuota (bulk) ─────────────────────────────────────────────────────
router.post('/per-cust-quotas/bulk', async (req, res) => {
  try {
    const { CustRebateId, quotas } = req.body;
    console.log(`💾 Bulk saving percentage customer quotas: ${req.database}`, { CustRebateId, quotas });

    if (!Array.isArray(quotas) || quotas.length === 0) {
      return res.status(400).json({ success: false, error: 'No quotas provided', database: req.database });
    }

    const results = [];
    for (const { Month, TargetQty } of quotas) {
      const result = await req.db.request()
        .input('CustRebateId', sql.Int,          CustRebateId)
        .input('Month',        sql.NVarChar,      Month)
        .input('TargetQty',    sql.Decimal(18,2), TargetQty || 0)
        .query(`
          INSERT INTO PerCustQuota (PerCustRebateId, Month, TargetQty, CreatedDate, UpdatedDate)
          VALUES (@CustRebateId, @Month, @TargetQty, GETDATE(), GETDATE());
          SELECT SCOPE_IDENTITY() as NewId;
        `);
      results.push(result.recordset[0].NewId);
    }

    console.log(`✅ ${results.length} percentage customer quotas saved.`);
    res.json({ success: true, ids: results, count: results.length, database: req.database });
  } catch (error) {
    console.error('❌ Error bulk saving percentage customer quotas:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── PerProdRebate ───────────────────────────────────────────────────────────
router.post('/per-prod-rebate', async (req, res) => {
  try {
    const { RebateCode, ItemCode, ItemName, UnitPerQty, PercentagePerBag, UnitOfMeasure, CreatedDate } = req.body;
    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();

    const result = await req.db.request()
      .input('RebateCode',       sql.NVarChar, RebateCode)
      .input('ItemCode',         sql.NVarChar, ItemCode)
      .input('ItemName',         sql.NVarChar, ItemName)
      .input('UnitPerQty',       sql.Int,      UnitPerQty || 0)
      .input('PercentagePerBag', sql.Int,      PercentagePerBag || 0)
      .input('UnitOfMeasure',    sql.NVarChar, UnitOfMeasure || '')
      .input('CreatedDate',      sql.DateTime, createdDateValue)
      .query(`
        INSERT INTO PerProdRebate 
          (RebateCode, ItemCode, ItemName, UnitPerQty, PercentagePerBag, UnitOfMeasure, CreatedDate, UpdatedDate)
        VALUES 
          (@RebateCode, @ItemCode, @ItemName, @UnitPerQty, @PercentagePerBag, @UnitOfMeasure, @CreatedDate, GETDATE());
        SELECT SCOPE_IDENTITY() as NewId;
      `);

    res.json({ success: true, id: result.recordset[0].NewId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET all rebate programs ─────────────────────────────────────────────────
router.get('/rebate-programs', async (req, res) => {
  try {
    const result = await req.db.request()
      .query('SELECT * FROM RebateProgram ORDER BY CreatedDate DESC, RebateCode DESC');
    res.json({ success: true, data: result.recordset, database: req.database, count: result.recordset.length });
  } catch (error) {
    console.error('❌ Error fetching rebate programs:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

/*===========================================*/
/*              RESTRICTIONS                 */
/*===========================================*/

// ─── Detailed duplicate check ─────────────────────────────────────────────────
router.post('/check-duplicate-detailed', async (req, res) => {
  try {
    const { RebateType, SlpCode, DateFrom, DateTo, Frequency, CardCode, ItemCode } = req.body;
    console.log(`🔍 Checking for detailed duplicate...  Customer: ${CardCode}, Item: ${ItemCode}`);

    try {
      const tableCheck = await req.db.request().query(
        `SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RebateProgram'`
      );
      if (tableCheck.recordset[0].Count === 0) {
        return res.json({ success: true, exists: false, message: 'RebateProgram table not found' });
      }
    } catch (tableError) {
      console.log('Error checking tables:', tableError.message);
    }

    const tableMap = {
      Fixed:       { cust: 'FixCustRebate fcr', prod: 'FixProdRebate fpr',  custAlias: 'fcr', prodAlias: 'fpr'  },
      Percentage:  { cust: 'PerCustRebate pcr', prod: 'PerProdRebate ppr',  custAlias: 'pcr', prodAlias: 'ppr'  },
      Incremental: { cust: 'IncCustRebate icr', prod: 'IncItemRebate iir',  custAlias: 'icr', prodAlias: 'iir'  },
    };

    if (!tableMap[RebateType]) {
      return res.json({ success: true, exists: false, message: 'Invalid rebate type' });
    }

    const { custAlias: ca, prodAlias: pa } = tableMap[RebateType];
    const custTable = tableMap[RebateType].cust;
    const prodTable = tableMap[RebateType].prod;

    const query = `
      SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.SlpName,
             ${ca}.CardCode, ${ca}.CardName, ${pa}.ItemCode, ${pa}.ItemName
      FROM RebateProgram rp
      INNER JOIN ${custTable} ON rp.RebateCode = ${ca}.RebateCode
      INNER JOIN ${prodTable} ON rp.RebateCode = ${pa}.RebateCode
      WHERE rp.RebateType = @RebateType AND rp.SlpCode = @SlpCode
        AND rp.DateFrom = @DateFrom   AND rp.DateTo = @DateTo
        AND rp.Frequency = @Frequency
        AND ${ca}.CardCode = @CardCode AND ${pa}.ItemCode = @ItemCode
    `;

    const result = await req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('SlpCode',    sql.Int,      SlpCode)
      .input('DateFrom',   sql.Date,     DateFrom)
      .input('DateTo',     sql.Date,     DateTo)
      .input('Frequency',  sql.NVarChar, Frequency)
      .input('CardCode',   sql.NVarChar, CardCode)
      .input('ItemCode',   sql.NVarChar, ItemCode)
      .query(query);

    if (result.recordset.length > 0) {
      const d = result.recordset[0];
      console.log(`📊 Duplicate found: ${d.RebateCode}`);
      return res.json({
        success: true, exists: true,
        existingRebateCode: d.RebateCode, existingDateFrom: d.DateFrom,
        existingDateTo: d.DateTo,         existingFrequency: d.Frequency,
        existingSlpName: d.SlpName,       existingCardCode: d.CardCode,
        existingCardName: d.CardName,     existingItemCode: d.ItemCode,
        existingItemName: d.ItemName
      });
    }

    console.log(`✅ No duplicate found for Customer: ${CardCode}, Item: ${ItemCode}`);
    res.json({ success: true, exists: false });
  } catch (error) {
    console.error('❌ Error checking for duplicates:', error);
    res.status(200).json({ success: false, exists: false, error: error.message, message: 'Error checking duplicates, but will proceed with save' });
  }
});

// ─── Test endpoint ────────────────────────────────────────────────────────────
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Rebate program API is working', timestamp: new Date().toISOString() });
});

// ─── Batch duplicate check ────────────────────────────────────────────────────
router.post('/check-duplicates-batch', async (req, res) => {
  try {
    const { RebateType, SlpCode, DateFrom, DateTo, Frequency, combinations } = req.body;
    console.log(`🔍 Batch checking ${combinations.length} combinations for duplicates...`);

    const tableMap = {
      Fixed:       ['FixCustRebate fcr', 'FixProdRebate fpr',  'fcr', 'fpr'],
      Percentage:  ['PerCustRebate pcr', 'PerProdRebate ppr',  'pcr', 'ppr'],
      Incremental: ['IncCustRebate icr', 'IncItemRebate iir',  'icr', 'iir'],
    };

    const results = [];

    for (const combo of combinations) {
      if (!tableMap[RebateType]) continue;
      const [custTable, prodTable, ca, pa] = tableMap[RebateType];

      const query = `
        SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.SlpName,
               ${ca}.CardCode, ${ca}.CardName, ${pa}.ItemCode, ${pa}.ItemName
        FROM RebateProgram rp
        INNER JOIN ${custTable} ON rp.RebateCode = ${ca}.RebateCode
        INNER JOIN ${prodTable} ON rp.RebateCode = ${pa}.RebateCode
        WHERE rp.RebateType = @RebateType AND rp.SlpCode = @SlpCode
          AND rp.DateFrom = @DateFrom   AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency
          AND ${ca}.CardCode = @CardCode AND ${pa}.ItemCode = @ItemCode
      `;

      const result = await req.db.request()
        .input('RebateType', sql.NVarChar, RebateType)
        .input('SlpCode',    sql.Int,      SlpCode)
        .input('DateFrom',   sql.Date,     DateFrom)
        .input('DateTo',     sql.Date,     DateTo)
        .input('Frequency',  sql.NVarChar, Frequency)
        .input('CardCode',   sql.NVarChar, combo.CardCode)
        .input('ItemCode',   sql.NVarChar, combo.ItemCode)
        .query(query);

      if (result.recordset.length > 0) {
        const dup = result.recordset[0];
        results.push({
          customerCode: combo.CardCode, itemCode: combo.ItemCode, exists: true,
          existingRebateCode: dup.RebateCode, existingDateFrom: dup.DateFrom,
          existingDateTo: dup.DateTo,         existingFrequency: dup.Frequency,
          existingSlpName: dup.SlpName,       existingCardName: dup.CardName,
          existingItemName: dup.ItemName
        });
      } else {
        results.push({ customerCode: combo.CardCode, itemCode: combo.ItemCode, exists: false });
      }
    }

    const duplicates = results.filter(r => r.exists);
    console.log(`📊 Batch check: ${duplicates.length} duplicates out of ${combinations.length}`);
    res.json({ success: true, duplicates, totalChecked: combinations.length, duplicateCount: duplicates.length });
  } catch (error) {
    console.error('❌ Error in batch duplicate check:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Item conflict check ──────────────────────────────────────────────────────
router.post('/check-item-conflict', async (req, res) => {
  try {
    const { RebateType, SlpCode, DateFrom, DateTo, Frequency, ItemCode } = req.body;
    console.log(`🔍 Checking if item ${ItemCode} exists in ANY program with same parameters...`);

    try {
      const tableCheck = await req.db.request().query(
        `SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RebateProgram'`
      );
      if (tableCheck.recordset[0].Count === 0) {
        return res.json({ success: true, exists: false, message: 'RebateProgram table not found' });
      }
    } catch (tableError) {
      console.log('Error checking tables:', tableError.message);
    }

    const tableMap = {
      Fixed:       ['FixProdRebate fpr',  'fpr'],
      Percentage:  ['PerProdRebate ppr',  'ppr'],
      Incremental: ['IncItemRebate iir',  'iir'],
    };

    if (!tableMap[RebateType]) {
      return res.json({ success: true, exists: false, message: 'Invalid rebate type' });
    }

    const [prodTable, pa] = tableMap[RebateType];

    const query = `
      SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
             rp.SlpName, rp.QuotaType, ${pa}.ItemCode, ${pa}.ItemName
      FROM RebateProgram rp
      INNER JOIN ${prodTable} ON rp.RebateCode = ${pa}.RebateCode
      WHERE rp.RebateType = @RebateType AND rp.SlpCode = @SlpCode
        AND rp.DateFrom = @DateFrom   AND rp.DateTo = @DateTo
        AND rp.Frequency = @Frequency AND ${pa}.ItemCode = @ItemCode
    `;

    const result = await req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('SlpCode',    sql.Int,      SlpCode)
      .input('DateFrom',   sql.Date,     DateFrom)
      .input('DateTo',     sql.Date,     DateTo)
      .input('Frequency',  sql.NVarChar, Frequency)
      .input('ItemCode',   sql.NVarChar, ItemCode)
      .query(query);

    if (result.recordset.length > 0) {
      const p = result.recordset[0];
      console.log(`⚠️ Item conflict found for ${ItemCode} in ${p.RebateCode}`);
      return res.json({
        success: true, exists: true,
        existingProgram: {
          RebateCode: p.RebateCode, DateFrom: p.DateFrom, DateTo: p.DateTo,
          Frequency: p.Frequency,   SlpName: p.SlpName,   QuotaType: p.QuotaType,
          ItemCode: p.ItemCode,     ItemName: p.ItemName
        }
      });
    }

    console.log(`✅ No conflict for item ${ItemCode}`);
    res.json({ success: true, exists: false });
  } catch (error) {
    console.error('❌ Error checking item conflict:', error);
    res.status(200).json({ success: false, exists: false, error: error.message, message: 'Error checking item conflicts' });
  }
});

// ─── Check duplicate program ──────────────────────────────────────────────────
router.post('/rebate-program/check-duplicate-program', async (req, res) => {
  try {
    const { RebateType, SlpCode, DateFrom, DateTo } = req.body;
    console.log(`🔍 Checking for duplicate program...  Type: ${RebateType}, SlpCode: ${SlpCode}`);

    if (!RebateType || !SlpCode || !DateFrom || !DateTo) {
      return res.status(400).json({ success: false, exists: false, error: 'Missing required fields' });
    }

    try {
      const tableCheck = await req.db.request().query(
        `SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RebateProgram'`
      );
      if (tableCheck.recordset[0].Count === 0) {
        return res.json({ success: true, exists: false, message: 'RebateProgram table not found' });
      }
    } catch (tableError) {
      console.log('Error checking tables:', tableError.message);
    }

    const result = await req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('SlpCode',    sql.Int,      SlpCode)
      .input('DateFrom',   sql.Date,     DateFrom)
      .input('DateTo',     sql.Date,     DateTo)
      .query(`
        SELECT RebateCode, RebateType, SlpCode, SlpName, DateFrom, DateTo,
               Frequency, QuotaType, CreatedDate
        FROM RebateProgram
        WHERE RebateType = @RebateType AND SlpCode = @SlpCode
          AND DateFrom = @DateFrom     AND DateTo = @DateTo
      `);

    if (result.recordset.length > 0) {
      const p = result.recordset[0];
      console.log(`⚠️ Duplicate program found! Rebate Code: ${p.RebateCode}`);
      return res.json({
        success: true, exists: true,
        program: {
          RebateCode: p.RebateCode, RebateType: p.RebateType, SlpName: p.SlpName,
          DateFrom: p.DateFrom,     DateTo: p.DateTo,         Frequency: p.Frequency,
          QuotaType: p.QuotaType,   CreatedDate: p.CreatedDate
        }
      });
    }

    console.log(`✅ No duplicate program found`);
    res.json({ success: true, exists: false });
  } catch (error) {
    console.error('❌ Error checking for duplicate program:', error);
    res.status(200).json({ success: false, exists: false, error: error.message, message: 'Error checking for duplicate program' });
  }
});

/*===========================================*/
/*              EDIT / UPDATE                */
/*===========================================*/

// GET /api/rebate-program/by-code/:code
router.get('/rebate-program/by-code/:code', async (req, res) => {
  const result = await req.db.request()
    .input('c', sql.NVarChar, req.params.code)
    .query('SELECT * FROM RebateProgram WHERE RebateCode = @c');
  res.json({ success: true, program: result.recordset[0] || null });
});

// GET /api/rebate-program/customers/:code?type=Fixed|Incremental|Percentage
router.get('/rebate-program/customers/:code', async (req, res) => {
  const map = { Fixed: 'FixCustRebate', Incremental: 'IncCustRebate', Percentage: 'PerCustRebate' };
  const tbl = map[req.query.type] || 'FixCustRebate';
  const result = await req.db.request()
    .input('c', sql.NVarChar, req.params.code)
    .query(`SELECT *, CreatedDate FROM ${tbl} WHERE RebateCode = @c`); // ensure CreatedDate is selected
  res.json({ success: true, customers: result.recordset });
});

// GET /api/rebate-program/items/:code?type=Fixed|Incremental|Percentage
router.get('/rebate-program/items/:code', async (req, res) => {
  const map = { Fixed: 'FixProdRebate', Incremental: 'IncItemRebate', Percentage: 'PerProdRebate' };
  const tbl = map[req.query.type] || 'FixProdRebate';
  const result = await req.db.request()
    .input('c', sql.NVarChar, req.params.code)
    .query(`SELECT *,  CreatedDate FROM ${tbl} WHERE RebateCode = @c`);
  res.json({ success: true, items: result.recordset });
});

// PUT /api/rebate-program/:code — update program header only (never touch CreatedDate)
router.put('/rebate-program/:code', async (req, res) => {
  const { RebateType, SlpCode, SlpName, DateFrom, DateTo, Frequency, QuotaType, CreatedBy } = req.body;
  const createdBy = CreatedBy || 'Unknown';
  
  await req.db.request()
    .input('c',  sql.NVarChar, req.params.code)
    .input('rt', sql.NVarChar, RebateType)
    .input('sc', sql.Int,      SlpCode)
    .input('sn', sql.NVarChar, SlpName)
    .input('df', sql.Date,     DateFrom)
    .input('dt', sql.Date,     DateTo)
    .input('fr', sql.NVarChar, Frequency)
    .input('qt', sql.NVarChar, QuotaType)
    .input('ub', sql.NVarChar, UpdatedBy || 'Unknown')
    .query(`
      UPDATE RebateProgram
      SET RebateType = @rt, SlpCode = @sc, SlpName = @sn,
          DateFrom   = @df, DateTo  = @dt, Frequency = @fr,
          QuotaType  = @qt, CreatedBy = @CreatedBy, UpdatedBy = @UpdatedBy,
          UpdatedDate = GETDATE()
          -- CreatedDate is intentionally NOT updated here
      WHERE RebateCode = @c
        AND CreatedDate IS NOT NULL   -- safety guard: only update rows that already have a CreatedDate
    `);
  res.json({ success: true });
});

// DELETE /api/rebate-program/:code/details?type=Fixed|Incremental|Percentage
router.delete('/rebate-program/:code/details', async (req, res) => {
  const type = req.query.type;
  const code = req.params.code;
  const db   = req.db;

  if (type === 'Fixed') {
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
    const result = await req.db.request().query(`
      SELECT RebateCode, RebateType, SlpName, DateFrom, DateTo
      FROM RebateProgram
      WHERE RebateCode LIKE 'REB-%'
      ORDER BY RebateCode DESC
    `);
    res.json({ success: true, codes: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;