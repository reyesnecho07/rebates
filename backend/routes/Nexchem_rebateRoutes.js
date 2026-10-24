import express from 'express';
import sql from 'mssql';
import { dbMiddleware } from '../middleware/dbMiddleware.js';

const router = express.Router();

// Apply database middleware to all rebate routes
router.use(dbMiddleware);

// Validation middleware for required fields
// — Dates required only when scope is Global (or unspecified)
const validateRebateProgram = (req, res, next) => {
  const { RebateType, DateFrom, DateTo, DateRangeScope } = req.body;

  if (!RebateType) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: RebateType'
    });
  }

  // Per Customer scope stores dates per customer row, so header dates may be empty
  if (DateRangeScope !== 'Per Customer' && (!DateFrom || !DateTo)) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: DateFrom, DateTo (required for Global scope)'
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
    const {
      RebateType, DateFrom, DateTo, Frequency, QuotaType,
      Name, RedemptionPeriod, CreatedBy, DateRangeScope
    } = req.body;
    const createdBy = CreatedBy || 'Unknown';

    // Per Customer: header dates are stored as NULL; dates live on each customer row
    const scope = DateRangeScope || 'Global';
    const headerDateFrom = scope === 'Per Customer' ? null : DateFrom;
    const headerDateTo   = scope === 'Per Customer' ? null : DateTo;

    console.log(`💾 Saving rebate program to database: ${req.database} | scope=${scope}`);

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

    const query = `
      INSERT INTO RebateProgram 
        (RebateCode, RebateType, DateFrom, DateTo, Frequency, QuotaType,
         Name, RedemptionPeriod, DateRangeScope, CreatedBy, UpdatedBy, CreatedDate)
      VALUES 
        (@RebateCode, @RebateType, @DateFrom, @DateTo, @Frequency, @QuotaType,
         @Name, @RedemptionPeriod, @DateRangeScope, @CreatedBy, @UpdatedBy, GETDATE())
    `;

    await req.db.request()
      .input('RebateCode',       sql.NVarChar,     nextRebateCode)
      .input('RebateType',       sql.NVarChar,     RebateType)
      .input('DateFrom',         sql.Date,         headerDateFrom)
      .input('DateTo',           sql.Date,         headerDateTo)
      .input('Frequency',        sql.NVarChar,     Frequency || 'Quarterly')
      .input('QuotaType',        sql.NVarChar,     QuotaType || 'With Quota')
      .input('Name',             sql.NVarChar,     Name || '')
      .input('RedemptionPeriod', sql.NVarChar,     RedemptionPeriod || '')
      .input('DateRangeScope',   sql.NVarChar(20), scope)
      .input('CreatedBy',        sql.NVarChar,     createdBy)
      .input('UpdatedBy',        sql.NVarChar,     createdBy)
      .query(query);

    console.log(`✅ Rebate program saved successfully. RebateCode: ${nextRebateCode} | scope=${scope}`);

    res.json({ 
      success: true, 
      rebateCode: nextRebateCode,
      dateRangeScope: scope,
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
    const result = await db.request().query(`
      SELECT IDENT_CURRENT('${tableName}') as CurrentId, 
             IDENT_INCR('${tableName}') as IncrementValue
    `);

    const currentId = result.recordset[0].CurrentId;
    const increment = result.recordset[0].IncrementValue;

    if (currentId === null) {
      const maxResult = await db.request().query(`SELECT ISNULL(MAX(Id), 0) as MaxId FROM ${tableName}`);
      return maxResult.recordset[0].MaxId + 1;
    }

    return currentId + increment;
  } catch (error) {
    console.error(`Error getting next ID for ${tableName}:`, error);
    try {
      const maxResult = await db.request().query(`SELECT ISNULL(MAX(Id), 0) as MaxId FROM ${tableName}`);
      return maxResult.recordset[0].MaxId + 1;
    } catch (fallbackError) {
      console.error(`Fallback error for ${tableName}:`, fallbackError);
      return 1;
    }
  }
};

/* ──────────────────────────────────────────────────────────────
   Schema detection: is `Id` an IDENTITY column in this DB?
   Cached per (dbName, table, column).
   ────────────────────────────────────────────────────────────── */
const identityCache = new Map();

const isIdentity = async (db, dbName, tableName, column = 'Id') => {
  const key = `${dbName}::${tableName}::${column}`;
  if (identityCache.has(key)) return identityCache.get(key);
  try {
    const r = await db.request()
      .input('t', sql.NVarChar, tableName)
      .input('c', sql.NVarChar, column)
      .query(`SELECT COLUMNPROPERTY(OBJECT_ID(@t), @c, 'IsIdentity') AS IsIdentity`);
    const val = r.recordset[0]?.IsIdentity === 1;
    identityCache.set(key, val);
    return val;
  } catch {
    identityCache.set(key, false);
    return false;
  }
};

/* ──────────────────────────────────────────────────────────────
   Insert a row into a table whose PK is `Id`, regardless of
   whether `Id` is IDENTITY or a plain INT.
   ────────────────────────────────────────────────────────────── */
const insertRow = async (db, dbName, tableName, columns, raw = {}) => {
  const idIsIdentity = await isIdentity(db, dbName, tableName);

  const req    = db.request();
  const names  = [];
  const params = [];
  let   assignedId = null;

  if (!idIsIdentity) {
    assignedId = await getNextId(db, tableName);
    req.input('Id', sql.Int, assignedId);
    names.push('Id');
    params.push('@Id');
  }

  for (const [name, spec] of Object.entries(columns)) {
    req.input(name, spec.type, spec.value);
    names.push(name);
    params.push(`@${name}`);
  }
  for (const [name, expr] of Object.entries(raw)) {
    names.push(name);
    params.push(expr);
  }

  const sqlText = `INSERT INTO ${tableName} (${names.join(', ')})
                   VALUES (${params.join(', ')});`;

  if (idIsIdentity) {
    const result = await req.query(sqlText + ` SELECT CAST(SCOPE_IDENTITY() AS INT) AS NewId;`);
    return result.recordset[0]?.NewId ?? null;
  }

  await req.query(sqlText);
  return assignedId;
};

/* ──────────────────────────────────────────────────────────────
   Normalize QtrQualified -> 1/0 (BIT)
   ────────────────────────────────────────────────────────────── */
const normalizeQtrQualified = (v) => {
  if (v === undefined || v === null || v === '') return 1;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v ? 1 : 0;
  const s = String(v).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'no' || s === 'n') return 0;
  return 1;
};

/* ──────────────────────────────────────────────────────────────
   Normalize date value or null
   ────────────────────────────────────────────────────────────── */
const normalizeDateOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// ─── FixCustRebate ───────────────────────────────────────────────────────────
router.post('/fix-cust-rebate', async (req, res) => {
  try {
    const {
      RebateCode, CardCode, CardName, QtrRebate, QtrQualified,
      DateFrom, DateTo, CreatedDate
    } = req.body;
    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();
    const qtrRebateValue   = QtrRebate !== undefined && QtrRebate !== null && QtrRebate !== ''
                              ? parseFloat(QtrRebate) : 0;
    const qtrQualifiedValue = normalizeQtrQualified(QtrQualified);
    const dateFromValue = normalizeDateOrNull(DateFrom);
    const dateToValue   = normalizeDateOrNull(DateTo);
    const nextId = await getNextId(req.db, 'FixCustRebate');

    const query = `
      INSERT INTO FixCustRebate 
        (Id, RebateCode, CardCode, CardName, QtrRebate, QtrQualified,
         DateFrom, DateTo, CreatedDate, UpdatedDate)
      VALUES 
        (@Id, @RebateCode, @CardCode, @CardName, @QtrRebate, @QtrQualified,
         @DateFrom, @DateTo, @CreatedDate, GETDATE())
    `;
    const request = req.db.request();
    request.input('Id',           sql.Int,          nextId);
    request.input('RebateCode',   sql.NVarChar(50), RebateCode);
    request.input('CardCode',     sql.NVarChar(15), CardCode);
    request.input('CardName',     sql.NVarChar(100),CardName);
    request.input('QtrRebate',    sql.Decimal(19, 6), qtrRebateValue);
    request.input('QtrQualified', sql.Bit,          qtrQualifiedValue);
    request.input('DateFrom',     sql.Date,         dateFromValue);
    request.input('DateTo',       sql.Date,         dateToValue);
    request.input('CreatedDate',  sql.DateTime,     createdDateValue);
    await request.query(query);

    res.json({ success: true, id: nextId, database: req.database });
  } catch (error) {
    console.error('❌ [fix-cust-rebate]', error.message);
    res.status(500).json({ success: false, error: `Database error: ${error.message}`, database: req.database });
  }
});

// ─── FixCustQuota (single) — schema-aware ──────────────────────────────────
router.post('/fix-cust-quota', async (req, res) => {
  try {
    const { CustRebateId, Month, TargetQty, CreatedDate } = req.body;
    if (!CustRebateId || !Month) {
      return res.status(400).json({ success: false, error: 'CustRebateId and Month are required' });
    }

    const parent = await req.db.request()
      .input('id', sql.Int, CustRebateId)
      .query('SELECT Id FROM FixCustRebate WHERE Id = @id');
    if (parent.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: `FixCustRebate.Id=${CustRebateId} not found`,
      });
    }

    const newId = await insertRow(
      req.db, req.database, 'FixCustQuota',
      {
        CustRebateId: { type: sql.Int,            value: CustRebateId },
        Month:        { type: sql.NVarChar(100),  value: Month },
        TargetQty:    { type: sql.Decimal(18, 2), value: parseFloat(TargetQty) || 0 },
        CreatedDate:  { type: sql.DateTime,       value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ [fix-cust-quota]', error.message, error.number);
    res.status(500).json({ success: false, error: error.message, errorNumber: error.number });
  }
});

// ─── FixCustQuota (bulk) — schema-aware ────────────────────────────────────
router.post('/fix-cust-quotas/bulk', async (req, res) => {
  try {
    const { CustRebateId, quotas } = req.body;
    if (!CustRebateId || !Array.isArray(quotas) || quotas.length === 0) {
      return res.status(400).json({ success: false, error: 'CustRebateId and quotas are required' });
    }

    const parent = await req.db.request()
      .input('id', sql.Int, CustRebateId)
      .query('SELECT Id FROM FixCustRebate WHERE Id = @id');
    if (parent.recordset.length === 0) {
      return res.status(404).json({ success: false, error: `FixCustRebate.Id=${CustRebateId} not found` });
    }

    const inserted = [];
    for (const q of quotas) {
      if (!q || !q.Month) continue;
      const newId = await insertRow(
        req.db, req.database, 'FixCustQuota',
        {
          CustRebateId: { type: sql.Int,            value: CustRebateId },
          Month:        { type: sql.NVarChar(100),  value: q.Month },
          TargetQty:    { type: sql.Decimal(18, 2), value: parseFloat(q.TargetQty) || 0 },
          CreatedDate:  { type: sql.DateTime,       value: new Date() },
        },
        { UpdatedDate: 'GETDATE()' }
      );
      inserted.push({ month: q.Month, id: newId });
    }

    res.json({ success: true, inserted, count: inserted.length, database: req.database });
  } catch (error) {
    console.error('❌ [fix-cust-quotas/bulk]', error.message, error.number);
    res.status(500).json({ success: false, error: error.message, errorNumber: error.number });
  }
});

// ─── FixProdRebate ───────────────────────────────────────────────────────────
router.post('/fix-prod-rebate', async (req, res) => {
  try {
    const {
      RebateCode, ItemCode, ItemName, RebatePerBag, UnitPerQty, UnitOfMeasure,
      QtrRebate, QtrQualified, CreatedDate
    } = req.body;
    const createdDateValue  = CreatedDate ? new Date(CreatedDate) : new Date();
    const qtrRebateValue    = QtrRebate !== undefined && QtrRebate !== null && QtrRebate !== ''
                                ? parseFloat(QtrRebate) : 0;
    const qtrQualifiedValue = normalizeQtrQualified(QtrQualified);
    const nextId = await getNextId(req.db, 'FixProdRebate');

    const query = `
      INSERT INTO FixProdRebate 
        (Id, RebateCode, ItemCode, ItemName, UnitPerQty, RebatePerBag,
         QtrRebate, QtrQualified, UnitOfMeasure, CreatedDate, UpdatedDate)
      VALUES 
        (@Id, @RebateCode, @ItemCode, @ItemName, @UnitPerQty, @RebatePerBag,
         @QtrRebate, @QtrQualified, @UnitOfMeasure, @CreatedDate, GETDATE())
    `;
    await req.db.request()
      .input('Id',            sql.Int,           nextId)
      .input('RebateCode',    sql.NVarChar,      RebateCode)
      .input('ItemCode',      sql.NVarChar,      ItemCode)
      .input('ItemName',      sql.NVarChar,      ItemName)
      .input('UnitPerQty',    sql.Decimal(18, 2),UnitPerQty || 0)
      .input('RebatePerBag',  sql.Decimal(18, 2),RebatePerBag || 0)
      .input('QtrRebate',     sql.Decimal(19, 6),qtrRebateValue)
      .input('QtrQualified',  sql.Bit,           qtrQualifiedValue)
      .input('UnitOfMeasure', sql.NVarChar,      UnitOfMeasure || '')
      .input('CreatedDate',   sql.DateTime,      createdDateValue)
      .query(query);

    res.json({ success: true, database: req.database });
  } catch (error) {
    console.error('❌ [fix-prod-rebate]', error.message);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── IncCustRebate ───────────────────────────────────────────────────────────
router.post('/inc-cust-rebate', async (req, res) => {
  try {
    const {
      RebateCode, CardCode, CardName, QtrRebate, QtrQualified,
      DateFrom, DateTo, CreatedDate
    } = req.body;
    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();
    const qtrRebateValue   = QtrRebate !== undefined && QtrRebate !== null && QtrRebate !== ''
                              ? parseFloat(QtrRebate) : 0;
    const qtrQualifiedValue = normalizeQtrQualified(QtrQualified);
    const dateFromValue = normalizeDateOrNull(DateFrom);
    const dateToValue   = normalizeDateOrNull(DateTo);
    const nextId = await getNextId(req.db, 'IncCustRebate');

    const query = `
      INSERT INTO IncCustRebate 
        (Id, RebateCode, CardCode, CardName, QtrRebate, QtrQualified,
         DateFrom, DateTo, CreatedDate, UpdatedDate)
      VALUES 
        (@Id, @RebateCode, @CardCode, @CardName, @QtrRebate, @QtrQualified,
         @DateFrom, @DateTo, @CreatedDate, GETDATE())
    `;
    await req.db.request()
      .input('Id',           sql.Int,          nextId)
      .input('RebateCode',   sql.NVarChar,     RebateCode)
      .input('CardCode',     sql.NVarChar,     CardCode)
      .input('CardName',     sql.NVarChar,     CardName)
      .input('QtrRebate',    sql.Decimal(19,6),qtrRebateValue)
      .input('QtrQualified', sql.Bit,          qtrQualifiedValue)
      .input('DateFrom',     sql.Date,         dateFromValue)
      .input('DateTo',       sql.Date,         dateToValue)
      .input('CreatedDate',  sql.DateTime,     createdDateValue)
      .query(query);

    res.json({ success: true, id: nextId, database: req.database });
  } catch (error) {
    console.error('❌ [inc-cust-rebate]', error.message);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── IncCustRange ────────────────────────────────────────────────────────────
router.post('/inc-cust-range', async (req, res) => {
  try {
    const { IncCustRebateId, RangeNo, MinQty, MaxQty, RebatePerBag, CreatedDate } = req.body;
    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();
    const nextId = await getNextId(req.db, 'IncCustRange');

    const query = `
      INSERT INTO IncCustRange (Id, IncCustRebateId, RangeNo, MinQty, MaxQty, RebatePerBag, CreatedDate, UpdatedDate)
      VALUES (@Id, @IncCustRebateId, @RangeNo, @MinQty, @MaxQty, @RebatePerBag, @CreatedDate, GETDATE())
    `;
    await req.db.request()
      .input('Id',              sql.Int, nextId)
      .input('IncCustRebateId', sql.Int, IncCustRebateId)
      .input('RangeNo',         sql.Int, RangeNo)
      .input('MinQty',          sql.Int, MinQty || 0)
      .input('MaxQty',          sql.Int, MaxQty || 0)
      .input('RebatePerBag',    sql.Int, RebatePerBag || 0)
      .input('CreatedDate',     sql.DateTime, createdDateValue)
      .query(query);

    res.json({ success: true, database: req.database });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── IncItemRebate ───────────────────────────────────────────────────────────
router.post('/inc-item-rebate', async (req, res) => {
  try {
    const {
      RebateCode, ItemCode, ItemName, UnitPerQty, UnitOfMeasure,
      RebatePerBag, QtrRebate, QtrQualified, CreatedDate
    } = req.body;
    const createdDateValue  = CreatedDate ? new Date(CreatedDate) : new Date();
    const qtrRebateValue    = QtrRebate !== undefined && QtrRebate !== null && QtrRebate !== ''
                                ? parseFloat(QtrRebate) : 0;
    const qtrQualifiedValue = normalizeQtrQualified(QtrQualified);
    const nextId = await getNextId(req.db, 'IncItemRebate');

    const query = `
      INSERT INTO IncItemRebate 
        (Id, RebateCode, ItemCode, ItemName, UnitPerQty, UnitOfMeasure,
         RebatePerBag, QtrRebate, QtrQualified, CreatedDate, UpdatedDate)
      VALUES 
        (@Id, @RebateCode, @ItemCode, @ItemName, @UnitPerQty, @UnitOfMeasure,
         @RebatePerBag, @QtrRebate, @QtrQualified, @CreatedDate, GETDATE())
    `;
    await req.db.request()
      .input('Id',            sql.Int, nextId)
      .input('RebateCode',    sql.NVarChar, RebateCode)
      .input('ItemCode',      sql.NVarChar, ItemCode)
      .input('ItemName',      sql.NVarChar, ItemName)
      .input('UnitPerQty',    sql.Int, UnitPerQty || 0)
      .input('UnitOfMeasure', sql.NVarChar, UnitOfMeasure || '')
      .input('RebatePerBag',  sql.Decimal(19,6), RebatePerBag || 0)
      .input('QtrRebate',     sql.Decimal(19,6), qtrRebateValue)
      .input('QtrQualified',  sql.Bit, qtrQualifiedValue)
      .input('CreatedDate',   sql.DateTime, createdDateValue)
      .query(query);

    res.json({ success: true, id: nextId, database: req.database });
  } catch (error) {
    console.error('❌ [inc-item-rebate]', error.message);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── IncItemRange ────────────────────────────────────────────────────────────
router.post('/inc-item-range', async (req, res) => {
  try {
    const { ItemRebateId, RangeNo, MinQty, MaxQty, RebatePerBag, CreatedDate } = req.body;
    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();
    const nextId = await getNextId(req.db, 'IncItemRange');

    const query = `
      INSERT INTO IncItemRange (Id, ItemRebateId, RangeNo, MinQty, MaxQty, RebatePerBag, CreatedDate, UpdatedDate)
      VALUES (@Id, @ItemRebateId, @RangeNo, @MinQty, @MaxQty, @RebatePerBag, @CreatedDate, GETDATE())
    `;
    await req.db.request()
      .input('Id',           sql.Int, nextId)
      .input('ItemRebateId', sql.Int, ItemRebateId)
      .input('RangeNo',      sql.Int, RangeNo)
      .input('MinQty',       sql.Int, MinQty || 0)
      .input('MaxQty',       sql.Int, MaxQty || 0)
      .input('RebatePerBag', sql.Int, RebatePerBag || 0)
      .input('CreatedDate',  sql.DateTime, createdDateValue)
      .query(query);

    res.json({ success: true, database: req.database });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── PerCustRebate ───────────────────────────────────────────────────────────
router.post('/per-cust-rebate', async (req, res) => {
  try {
    const {
      RebateCode, CardCode, CardName, QtrRebate, QtrQualified,
      DateFrom, DateTo, CreatedDate
    } = req.body;
    const createdDateValue  = CreatedDate ? new Date(CreatedDate) : new Date();
    const qtrRebateValue    = QtrRebate !== undefined && QtrRebate !== null && QtrRebate !== ''
                                ? parseFloat(QtrRebate) : 0;
    const qtrQualifiedValue = normalizeQtrQualified(QtrQualified);
    const dateFromValue     = normalizeDateOrNull(DateFrom);
    const dateToValue       = normalizeDateOrNull(DateTo);

    const query = `
      INSERT INTO PerCustRebate 
        (RebateCode, CardCode, CardName, QtrRebate, QtrQualified,
         DateFrom, DateTo, CreatedDate, UpdatedDate)
      VALUES 
        (@RebateCode, @CardCode, @CardName, @QtrRebate, @QtrQualified,
         @DateFrom, @DateTo, @CreatedDate, GETDATE());
      SELECT SCOPE_IDENTITY() as NewId;
    `;
    const result = await req.db.request()
      .input('RebateCode',   sql.NVarChar, RebateCode)
      .input('CardCode',     sql.NVarChar, CardCode)
      .input('CardName',     sql.NVarChar, CardName)
      .input('QtrRebate',    sql.Decimal(19,6), qtrRebateValue)
      .input('QtrQualified', sql.Bit, qtrQualifiedValue)
      .input('DateFrom',     sql.Date, dateFromValue)
      .input('DateTo',       sql.Date, dateToValue)
      .input('CreatedDate',  sql.DateTime, createdDateValue)
      .query(query);

    res.json({ success: true, id: result.recordset[0].NewId, database: req.database });
  } catch (error) {
    console.error('❌ [per-cust-rebate]', error.message);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── PerCustQuota (single) ───────────────────────────────────────────────────
router.post('/per-cust-quota', async (req, res) => {
  try {
    const { PerCustRebateId, Month, TargetQty, CreatedDate } = req.body;
    const createdDateValue = CreatedDate ? new Date(CreatedDate) : new Date();

    const query = `
      INSERT INTO PerCustQuota (PerCustRebateId, Month, TargetQty, CreatedDate, UpdatedDate)
      VALUES (@PerCustRebateId, @Month, @TargetQty, @CreatedDate, GETDATE());
      SELECT SCOPE_IDENTITY() as NewId;
    `;
    const result = await req.db.request()
      .input('PerCustRebateId', sql.Int, PerCustRebateId)
      .input('Month',           sql.NVarChar, Month)
      .input('TargetQty',       sql.Decimal(18, 2), TargetQty || 0)
      .input('CreatedDate',     sql.DateTime, createdDateValue)
      .query(query);

    res.json({ success: true, id: result.recordset[0].NewId, database: req.database });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── PerCustQuota (bulk) ─────────────────────────────────────────────────────
router.post('/per-cust-quotas/bulk', async (req, res) => {
  try {
    const { CustRebateId, quotas } = req.body;
    if (!Array.isArray(quotas) || quotas.length === 0) {
      return res.status(400).json({ success: false, error: 'No quotas provided', database: req.database });
    }
    const results = [];
    for (const q of quotas) {
      const createdDateValue = q.CreatedDate ? new Date(q.CreatedDate) : new Date();
      const result = await req.db.request()
        .input('PerCustRebateId', sql.Int, CustRebateId)
        .input('Month',           sql.NVarChar, q.Month)
        .input('TargetQty',       sql.Decimal(18, 2), q.TargetQty || 0)
        .input('CreatedDate',     sql.DateTime, createdDateValue)
        .query(`INSERT INTO PerCustQuota (PerCustRebateId, Month, TargetQty, CreatedDate, UpdatedDate)
                VALUES (@PerCustRebateId, @Month, @TargetQty, @CreatedDate, GETDATE());
                SELECT SCOPE_IDENTITY() as NewId;`);
      results.push(result.recordset[0].NewId);
    }
    res.json({ success: true, count: results.length, database: req.database });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── PerProdRebate ───────────────────────────────────────────────────────────
router.post('/per-prod-rebate', async (req, res) => {
  try {
    const {
      RebateCode, ItemCode, ItemName, UnitPerQty, PercentagePerBag,
      QtrRebate, QtrQualified, UnitOfMeasure, CreatedDate
    } = req.body;
    const createdDateValue  = CreatedDate ? new Date(CreatedDate) : new Date();
    const qtrRebateValue    = QtrRebate !== undefined && QtrRebate !== null && QtrRebate !== ''
                                ? parseFloat(QtrRebate) : 0;
    const qtrQualifiedValue = normalizeQtrQualified(QtrQualified);

    const query = `
      INSERT INTO PerProdRebate 
        (RebateCode, ItemCode, ItemName, UnitPerQty, PercentagePerBag,
         QtrRebate, QtrQualified, UnitOfMeasure, CreatedDate, UpdatedDate)
      VALUES 
        (@RebateCode, @ItemCode, @ItemName, @UnitPerQty, @PercentagePerBag,
         @QtrRebate, @QtrQualified, @UnitOfMeasure, @CreatedDate, GETDATE());
      SELECT SCOPE_IDENTITY() as NewId;
    `;
    const result = await req.db.request()
      .input('RebateCode',      sql.NVarChar, RebateCode)
      .input('ItemCode',        sql.NVarChar, ItemCode)
      .input('ItemName',        sql.NVarChar, ItemName)
      .input('UnitPerQty',      sql.Int, UnitPerQty || 0)
      .input('PercentagePerBag',sql.Decimal(18,2), PercentagePerBag || 0)
      .input('QtrRebate',       sql.Decimal(19,6), qtrRebateValue)
      .input('QtrQualified',    sql.Bit, qtrQualifiedValue)
      .input('UnitOfMeasure',   sql.NVarChar, UnitOfMeasure || '')
      .input('CreatedDate',     sql.DateTime, createdDateValue)
      .query(query);

    res.json({ success: true, id: result.recordset[0].NewId, database: req.database });
  } catch (error) {
    console.error('❌ [per-prod-rebate]', error.message);
    res.status(500).json({ success: false, error: error.message, database: req.database });
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

router.post('/check-duplicate-detailed', async (req, res) => {
  try {
    const { RebateType, DateFrom, DateTo, Frequency, CardCode, ItemCode } = req.body;
    console.log(`🔍 Checking for detailed duplicate rebate program...`);

    try {
      const tableCheckQuery = `SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RebateProgram'`;
      const tableCheck = await req.db.request().query(tableCheckQuery);
      if (tableCheck.recordset[0].Count === 0) {
        return res.json({ success: true, exists: false, message: 'RebateProgram table not found' });
      }
    } catch (tableError) {
      console.log('Error checking tables:', tableError.message);
    }

    let query = '';
    if (RebateType === "Fixed") {
      query = `
        SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
               fcr.CardCode, fcr.CardName, fpr.ItemCode, fpr.ItemName
        FROM RebateProgram rp
        INNER JOIN FixCustRebate fcr ON rp.RebateCode = fcr.RebateCode
        INNER JOIN FixProdRebate fpr ON rp.RebateCode = fpr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo AND rp.Frequency = @Frequency
          AND fcr.CardCode = @CardCode AND fpr.ItemCode = @ItemCode`;
    } else if (RebateType === "Percentage") {
      query = `
        SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
               pcr.CardCode, pcr.CardName, ppr.ItemCode, ppr.ItemName
        FROM RebateProgram rp
        INNER JOIN PerCustRebate pcr ON rp.RebateCode = pcr.RebateCode
        INNER JOIN PerProdRebate ppr ON rp.RebateCode = ppr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo AND rp.Frequency = @Frequency
          AND pcr.CardCode = @CardCode AND ppr.ItemCode = @ItemCode`;
    } else if (RebateType === "Incremental") {
      query = `
        SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
               icr.CardCode, icr.CardName, iir.ItemCode, iir.ItemName
        FROM RebateProgram rp
        INNER JOIN IncCustRebate icr ON rp.RebateCode = icr.RebateCode
        INNER JOIN IncItemRebate iir ON rp.RebateCode = iir.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo AND rp.Frequency = @Frequency
          AND icr.CardCode = @CardCode AND iir.ItemCode = @ItemCode`;
    } else {
      return res.json({ success: true, exists: false, message: 'Invalid rebate type' });
    }

    const result = await req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('DateFrom',   sql.Date, DateFrom)
      .input('DateTo',     sql.Date, DateTo)
      .input('Frequency',  sql.NVarChar, Frequency)
      .input('CardCode',   sql.NVarChar, CardCode)
      .input('ItemCode',   sql.NVarChar, ItemCode)
      .query(query);

    const exists = result.recordset.length > 0;
    if (exists) {
      const duplicate = result.recordset[0];
      res.json({
        success: true,
        exists: true,
        existingRebateCode: duplicate.RebateCode,
        existingDateFrom:   duplicate.DateFrom,
        existingDateTo:     duplicate.DateTo,
        existingFrequency:  duplicate.Frequency,
        existingCardCode:   duplicate.CardCode,
        existingCardName:   duplicate.CardName,
        existingItemCode:   duplicate.ItemCode,
        existingItemName:   duplicate.ItemName
      });
    } else {
      res.json({ success: true, exists: false });
    }

  } catch (error) {
    console.error('❌ Error checking for duplicates:', error);
    res.status(200).json({
      success: false, exists: false, error: error.message,
      message: 'Error checking duplicates, but will proceed with save'
    });
  }
});

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Rebate program API is working',
    timestamp: new Date().toISOString()
  });
});

router.post('/check-duplicates-batch', async (req, res) => {
  try {
    const { RebateType, DateFrom, DateTo, Frequency, combinations } = req.body;
    console.log(`🔍 Batch checking ${combinations.length} combinations for duplicates...`);

    const results = [];
    for (const combo of combinations) {
      let query = '';
      if (RebateType === "Fixed") {
        query = `
          SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
                 fcr.CardCode, fcr.CardName, fpr.ItemCode, fpr.ItemName
          FROM RebateProgram rp
          INNER JOIN FixCustRebate fcr ON rp.RebateCode = fcr.RebateCode
          INNER JOIN FixProdRebate fpr ON rp.RebateCode = fpr.RebateCode
          WHERE rp.RebateType = @RebateType
            AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo AND rp.Frequency = @Frequency
            AND fcr.CardCode = @CardCode AND fpr.ItemCode = @ItemCode`;
      } else if (RebateType === "Percentage") {
        query = `
          SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
                 pcr.CardCode, pcr.CardName, ppr.ItemCode, ppr.ItemName
          FROM RebateProgram rp
          INNER JOIN PerCustRebate pcr ON rp.RebateCode = pcr.RebateCode
          INNER JOIN PerProdRebate ppr ON rp.RebateCode = ppr.RebateCode
          WHERE rp.RebateType = @RebateType
            AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo AND rp.Frequency = @Frequency
            AND pcr.CardCode = @CardCode AND ppr.ItemCode = @ItemCode`;
      } else if (RebateType === "Incremental") {
        query = `
          SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
                 icr.CardCode, icr.CardName, iir.ItemCode, iir.ItemName
          FROM RebateProgram rp
          INNER JOIN IncCustRebate icr ON rp.RebateCode = icr.RebateCode
          INNER JOIN IncItemRebate iir ON rp.RebateCode = iir.RebateCode
          WHERE rp.RebateType = @RebateType
            AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo AND rp.Frequency = @Frequency
            AND icr.CardCode = @CardCode AND iir.ItemCode = @ItemCode`;
      }

      const result = await req.db.request()
        .input('RebateType', sql.NVarChar, RebateType)
        .input('DateFrom',   sql.Date, DateFrom)
        .input('DateTo',     sql.Date, DateTo)
        .input('Frequency',  sql.NVarChar, Frequency)
        .input('CardCode',   sql.NVarChar, combo.CardCode)
        .input('ItemCode',   sql.NVarChar, combo.ItemCode)
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
          existingCardName: dup.CardName,
          existingItemName: dup.ItemName
        });
      } else {
        results.push({ customerCode: combo.CardCode, itemCode: combo.ItemCode, exists: false });
      }
    }

    const duplicates = results.filter(r => r.exists);
    res.json({
      success: true,
      duplicates: duplicates,
      totalChecked: combinations.length,
      duplicateCount: duplicates.length
    });

  } catch (error) {
    console.error('❌ Error in batch duplicate check:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/check-item-conflict', async (req, res) => {
  try {
    const { RebateType, DateFrom, DateTo, Frequency, ItemCode } = req.body;
    console.log(`🔍 Checking if item ${ItemCode} exists in ANY program with same parameters...`);

    try {
      const tableCheck = await req.db.request().query(`
        SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RebateProgram'`);
      if (tableCheck.recordset[0].Count === 0) {
        return res.json({ success: true, exists: false, message: 'RebateProgram table not found' });
      }
    } catch (tableError) {
      console.log('Error checking tables:', tableError.message);
    }

    let query = '';
    if (RebateType === "Fixed") {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               fpr.ItemCode, fpr.ItemName
        FROM RebateProgram rp
        INNER JOIN FixProdRebate fpr ON rp.RebateCode = fpr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo AND rp.Frequency = @Frequency
          AND fpr.ItemCode = @ItemCode`;
    } else if (RebateType === "Percentage") {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               ppr.ItemCode, ppr.ItemName
        FROM RebateProgram rp
        INNER JOIN PerProdRebate ppr ON rp.RebateCode = ppr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo AND rp.Frequency = @Frequency
          AND ppr.ItemCode = @ItemCode`;
    } else if (RebateType === "Incremental") {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               iir.ItemCode, iir.ItemName
        FROM RebateProgram rp
        INNER JOIN IncItemRebate iir ON rp.RebateCode = iir.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom <= @DateTo AND rp.DateTo >= @DateFrom AND rp.Frequency = @Frequency
          AND iir.ItemCode = @ItemCode`;
    } else {
      return res.json({ success: true, exists: false, message: 'Invalid rebate type' });
    }

    const result = await req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('DateFrom',   sql.Date, DateFrom)
      .input('DateTo',     sql.Date, DateTo)
      .input('Frequency',  sql.NVarChar, Frequency)
      .input('ItemCode',   sql.NVarChar, ItemCode)
      .query(query);

    const exists = result.recordset.length > 0;
    if (exists) {
      const program = result.recordset[0];
      res.json({
        success: true, exists: true,
        existingProgram: {
          RebateCode: program.RebateCode,
          DateFrom: program.DateFrom,
          DateTo: program.DateTo,
          Frequency: program.Frequency,
          QuotaType: program.QuotaType,
          ItemCode: program.ItemCode,
          ItemName: program.ItemName
        }
      });
    } else {
      res.json({ success: true, exists: false });
    }

  } catch (error) {
    console.error('❌ Error checking item conflict:', error);
    res.status(200).json({
      success: false, exists: false, error: error.message,
      message: 'Error checking item conflicts'
    });
  }
});

router.post('/rebate-program/check-duplicate-program', async (req, res) => {
  try {
    const { RebateType, DateFrom, DateTo, Frequency, ExcludeRebateCode } = req.body;

    // Be forgiving: skip the check if any required field is missing
    // (prevents front-end from failing on incomplete form state)
    if (!RebateType || !DateFrom || !DateTo || !Frequency) {
      console.warn('⚠️ check-duplicate-program skipped — missing fields:', {
        RebateType, DateFrom, DateTo, Frequency
      });
      return res.json({
        success: true,
        exists: false,
        skipped: true,
        message: 'Skipped duplicate check — missing required fields'
      });
    }

    try {
      const tableCheck = await req.db.request().query(`SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RebateProgram'`);
      if (tableCheck.recordset[0].Count === 0) return res.json({ success: true, exists: false, message: 'RebateProgram table not found' });
    } catch (tableError) { console.log('Error checking tables:', tableError.message); }

    let query = `
      SELECT RebateCode, RebateType, DateFrom, DateTo, Frequency, QuotaType, CreatedDate
      FROM RebateProgram 
      WHERE RebateType = @RebateType AND Frequency = @Frequency
        AND DateFrom <= @DateTo AND DateTo >= @DateFrom
    `;
    if (ExcludeRebateCode) query += ` AND RebateCode <> @ExcludeRebateCode `;

    const request = req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('Frequency',  sql.NVarChar, Frequency)
      .input('DateFrom',   sql.Date, DateFrom)
      .input('DateTo',     sql.Date, DateTo);
    if (ExcludeRebateCode) request.input('ExcludeRebateCode', sql.NVarChar, ExcludeRebateCode);

    const result = await request.query(query);
    const exists = result.recordset.length > 0;

    if (exists) {
      const program = result.recordset[0];
      res.json({
        success: true,
        exists: true,
        program: {
          RebateCode: program.RebateCode,
          RebateType: program.RebateType,
          DateFrom:   program.DateFrom,
          DateTo:     program.DateTo,
          Frequency:  program.Frequency,
          QuotaType:  program.QuotaType,
          CreatedDate: program.CreatedDate
        }
      });
    } else {
      res.json({ success: true, exists: false });
    }
  } catch (error) {
    console.error('❌ check-duplicate-program error:', error.message);
    res.status(200).json({
      success: false,
      exists: false,
      error: error.message,
      message: 'Error checking for duplicate program'
    });
  }
});

router.post('/rebate-program/check-customer-conflict', async (req, res) => {
  try {
    const { RebateType, DateFrom, DateTo, Frequency, CardCode, ExcludeRebateCode } = req.body;
    console.log(`🔍 Checking if customer ${CardCode} exists in any overlapping program...`);
  if (!RebateType || !DateFrom || !DateTo || !Frequency || !CardCode) {
    console.warn('⚠️ check-customer-conflict skipped — missing fields');
    return res.json({ success: true, exists: false, skipped: true });
  }

    try {
      const tableCheck = await req.db.request().query(`
        SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RebateProgram'`);
      if (tableCheck.recordset[0].Count === 0) {
        return res.json({ success: true, exists: false, message: 'RebateProgram table not found' });
      }
    } catch (tableError) {
      console.log('Error checking tables:', tableError.message);
    }

    let query = '';
    if (RebateType === "Fixed") {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               fcr.CardCode, fcr.CardName
        FROM RebateProgram rp
        INNER JOIN FixCustRebate fcr ON rp.RebateCode = fcr.RebateCode
        WHERE rp.RebateType = @RebateType AND rp.Frequency = @Frequency
          AND rp.DateFrom <= @DateTo AND rp.DateTo >= @DateFrom AND fcr.CardCode = @CardCode`;
    } else if (RebateType === "Percentage") {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               pcr.CardCode, pcr.CardName
        FROM RebateProgram rp
        INNER JOIN PerCustRebate pcr ON rp.RebateCode = pcr.RebateCode
        WHERE rp.RebateType = @RebateType AND rp.Frequency = @Frequency
          AND rp.DateFrom <= @DateTo AND rp.DateTo >= @DateFrom AND pcr.CardCode = @CardCode`;
    } else if (RebateType === "Incremental") {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               icr.CardCode, icr.CardName
        FROM RebateProgram rp
        INNER JOIN IncCustRebate icr ON rp.RebateCode = icr.RebateCode
        WHERE rp.RebateType = @RebateType AND rp.Frequency = @Frequency
          AND rp.DateFrom <= @DateTo AND rp.DateTo >= @DateFrom AND icr.CardCode = @CardCode`;
    } else {
      return res.json({ success: true, exists: false, message: 'Invalid rebate type' });
    }

    if (ExcludeRebateCode) query += ` AND rp.RebateCode <> @ExcludeRebateCode `;

    const request = req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('Frequency',  sql.NVarChar, Frequency)
      .input('DateFrom',   sql.Date, DateFrom)
      .input('DateTo',     sql.Date, DateTo)
      .input('CardCode',   sql.NVarChar, CardCode);
    if (ExcludeRebateCode) request.input('ExcludeRebateCode', sql.NVarChar, ExcludeRebateCode);

    const result = await request.query(query);
    const exists = result.recordset.length > 0;

    if (exists) {
      const program = result.recordset[0];
      res.json({
        success: true, exists: true,
        existingProgram: {
          RebateCode: program.RebateCode,
          DateFrom:   program.DateFrom,
          DateTo:     program.DateTo,
          Frequency:  program.Frequency,
          QuotaType:  program.QuotaType,
          CardCode:   program.CardCode,
          CardName:   program.CardName
        }
      });
    } else {
      res.json({ success: true, exists: false });
    }
  } catch (error) {
    console.error('❌ Error checking customer conflict:', error);
    res.status(200).json({
      success: false, exists: false, error: error.message,
      message: 'Error checking customer conflicts'
    });
  }
});

/* To edit the rebate program */
router.get('/rebate-program/by-code/:code', async (req, res) => {
  const result = await req.db.request().input('c', sql.NVarChar, req.params.code)
    .query('SELECT * FROM RebateProgram WHERE RebateCode = @c');
  res.json({ success: true, program: result.recordset[0] || null });
});

router.get('/rebate-program/customers/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const type = req.query.type || 'Fixed';

    if (type === 'Fixed') {
      const custResult = await req.db.request()
        .input('c', sql.NVarChar, code)
        .query(`SELECT * FROM FixCustRebate WHERE RebateCode = @c`);

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
  try {
    const {
      RebateType, DateFrom, DateTo, Frequency, QuotaType,
      Name, RedemptionPeriod, UpdatedBy, DateRangeScope
    } = req.body;

    // Per Customer: header dates become NULL; per-row dates live on customer tables
    const scope = DateRangeScope || 'Global';
    const headerDateFrom = scope === 'Per Customer' ? null : DateFrom;
    const headerDateTo   = scope === 'Per Customer' ? null : DateTo;

    console.log(`💾 Updating rebate program ${req.params.code} | scope=${scope}`);

    await req.db.request()
      .input('c',  sql.NVarChar,     req.params.code)
      .input('rt', sql.NVarChar,     RebateType)
      .input('df', sql.Date,         headerDateFrom)
      .input('dt', sql.Date,         headerDateTo)
      .input('fr', sql.NVarChar,     Frequency)
      .input('qt', sql.NVarChar,     QuotaType)
      .input('nm', sql.NVarChar,     Name || '')
      .input('rp', sql.NVarChar,     RedemptionPeriod || '')
      .input('dr', sql.NVarChar(20), scope)
      .input('ub', sql.NVarChar,     UpdatedBy || 'Unknown')
      .query(`UPDATE RebateProgram SET 
                RebateType=@rt, 
                DateFrom=@df, DateTo=@dt, Frequency=@fr, QuotaType=@qt,
                Name=@nm, RedemptionPeriod=@rp, DateRangeScope=@dr,
                UpdatedBy=@ub, UpdatedDate=GETDATE()
              WHERE RebateCode=@c`);

    res.json({ success: true, dateRangeScope: scope });
  } catch (error) {
    console.error('❌ [rebate-program PUT]', error.message, error.number);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
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
    const result = await req.db.request()
      .query(`SELECT RebateCode, RebateType, DateFrom, DateTo 
              FROM RebateProgram 
              WHERE RebateCode LIKE 'REB-%' 
              ORDER BY RebateCode DESC`);
    res.json({ success: true, codes: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/rebate-program/master-items?db=NEXCHEM
// Drop-in replacement for /nexchem/items that also returns OITM.SalUnitMsr
router.get('/rebate-program/master-items', async (req, res) => {
  try {
    const result = await req.db.request().query(`
      SELECT
        ItemCode,
        ItemName,
        SalUnitMsr,
        ItmsGrpCod,
        PurPackUn
      FROM OITM
      ORDER BY ItemName
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('❌ Error fetching master items with SalUnitMsr:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;