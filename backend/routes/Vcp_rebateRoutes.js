import express from 'express';
import sql from 'mssql';
import { dbMiddleware } from '../middleware/dbMiddleware.js';

const router = express.Router();

// Apply database middleware to all rebate routes
router.use(dbMiddleware);

// ─── Helper: normalize QtrQualified to a SQL bit (0 / 1) ───────────────────
const toBit = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (val === true  || val === 1 || val === '1' || String(val).toLowerCase() === 'true')  return 1;
  if (val === false || val === 0 || val === '0' || String(val).toLowerCase() === 'false') return 0;
  const n = Number(val);
  return Number.isNaN(n) ? 0 : (n ? 1 : 0);
};

// Normalize date value or null
const toDateOrNull = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// Validation middleware (SlpCode / SlpName removed)
// — Dates required only when scope is Global (or unspecified)
const validateRebateProgram = (req, res, next) => {
  const { RebateType, DateFrom, DateTo, DateRangeScope } = req.body;

  if (!RebateType) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: RebateType',
    });
  }

  // Per Customer scope stores dates per customer row, so header dates may be empty
  if (DateRangeScope !== 'Per Customer' && (!DateFrom || !DateTo)) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: DateFrom, DateTo (required for Global scope)',
    });
  }

  next();
};

// ─── Rebate code generation ────────────────────────────────────────────────
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
      highestCode: highestCode || 'REB-00000',
      nextCode: nextCode,
      database: req.database,
    });
  } catch (error) {
    console.error('❌ Error fetching highest rebate code:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─── Create rebate program ─────────────────────────────────────────────────
router.post('/rebate-program', validateRebateProgram, async (req, res) => {
  try {
    const {
      RebateType, DateFrom, DateTo, Frequency, QuotaType,
      Name, RedemptionPeriod, CreatedBy, DateRangeScope,
    } = req.body;
    const createdBy = CreatedBy || 'Unknown';

    // Per Customer: header dates stored as NULL; dates live on each customer row
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

    res.json({ success: true, rebateCode: nextRebateCode, dateRangeScope: scope, database: req.database });
  } catch (error) {
    console.error('❌ Error saving rebate program:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//   Schema-agnostic helpers
// ─────────────────────────────────────────────────────────────────────────────

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

const insertRow = async (db, dbName, tableName, columns, raw = {}) => {
  const idIsIdentity = await isIdentity(db, dbName, tableName);

  const req = db.request();
  const names = [];
  const params = [];
  let assignedId = null;

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

// ─────────────────────────────────────────────────────────────────────────────
//   Fixed rebate inserts
// ─────────────────────────────────────────────────────────────────────────────

router.post('/fix-cust-rebate', async (req, res) => {
  try {
    const {
      RebateCode, CardCode, CardName, QtrRebate, QtrQualified,
      DateFrom, DateTo, CreatedDate,
    } = req.body;

    const qtrRebateValue =
      QtrRebate !== undefined && QtrRebate !== null && QtrRebate !== ''
        ? parseFloat(QtrRebate)
        : 0;
    const qtrQualifiedValue = toBit(QtrQualified);

    const newId = await insertRow(
      req.db, req.database, 'FixCustRebate',
      {
        RebateCode:   { type: sql.NVarChar(50),   value: RebateCode },
        CardCode:     { type: sql.NVarChar(15),   value: CardCode },
        CardName:     { type: sql.NVarChar(100),  value: CardName },
        QtrRebate:    { type: sql.Decimal(19, 6), value: qtrRebateValue },
        QtrQualified: { type: sql.Bit,            value: qtrQualifiedValue },
        DateFrom:     { type: sql.Date,           value: toDateOrNull(DateFrom) },
        DateTo:       { type: sql.Date,           value: toDateOrNull(DateTo) },
        CreatedDate:  { type: sql.DateTime,       value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    console.log(`✅ Fixed customer rebate saved. ID: ${newId}, QtrQualified: ${qtrQualifiedValue}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving fixed customer rebate:', error);
    res.status(500).json({ success: false, error: `Database error: ${error.message}`, database: req.database });
  }
});

router.post('/fix-cust-quota', async (req, res) => {
  console.log('🚨 /fix-cust-quota HIT →', JSON.stringify(req.body));
  try {
    const { CustRebateId, Month, TargetQty, CreatedDate } = req.body;
    if (!CustRebateId || !Month) {
      return res.status(400).json({ success: false, error: 'CustRebateId and Month are required' });
    }

    const parent = await req.db.request()
      .input('id', sql.Int, CustRebateId)
      .query('SELECT Id FROM FixCustRebate WHERE Id = @id');
    if (parent.recordset.length === 0) {
      return res.status(404).json({ success: false, error: `FixCustRebate.Id=${CustRebateId} not found` });
    }

    const newId = await insertRow(
      req.db, req.database, 'FixCustQuota',
      {
        CustRebateId: { type: sql.Int,            value: CustRebateId },
        Month:        { type: sql.NVarChar(30),   value: Month },
        TargetQty:    { type: sql.Decimal(18, 2), value: parseFloat(TargetQty) || 0 },
        CreatedDate:  { type: sql.DateTime,       value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    console.log(`✅ FixCustQuota saved → Id=${newId}, CustRebateId=${CustRebateId}, Month="${Month}"`);
    res.json({ success: true, id: newId });
  } catch (error) {
    console.error('❌ [fix-cust-quota] failed:', error.message, error.number);
    res.status(500).json({ success: false, error: error.message, errorNumber: error.number });
  }
});

router.post('/fix-cust-quotas/bulk', async (req, res) => {
  console.log('🚨 /fix-cust-quotas/bulk HIT →', JSON.stringify(req.body));
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
          Month:        { type: sql.NVarChar(30),   value: q.Month },
          TargetQty:    { type: sql.Decimal(18, 2), value: parseFloat(q.TargetQty) || 0 },
          CreatedDate:  { type: sql.DateTime,       value: new Date() },
        },
        { UpdatedDate: 'GETDATE()' }
      );
      inserted.push({ month: q.Month, id: newId });
    }

    res.json({ success: true, inserted, count: inserted.length, database: req.database });
  } catch (error) {
    console.error('❌ [fix-cust-quotas/bulk] failed:', error.message, 'number:', error.number);
    res.status(500).json({ success: false, error: error.message, errorNumber: error.number });
  }
});

router.post('/fix-prod-rebate', async (req, res) => {
  try {
    const {
      RebateCode, ItemCode, ItemName, RebatePerBag, UnitPerQty, UnitOfMeasure,
      QtrRebate, QtrQualified, CreatedDate,
    } = req.body;

    const qtrRebateValue    = parseFloat(QtrRebate) || 0;
    const qtrQualifiedValue = toBit(QtrQualified);

    const newId = await insertRow(
      req.db, req.database, 'FixProdRebate',
      {
        RebateCode:    { type: sql.NVarChar,       value: RebateCode },
        ItemCode:      { type: sql.NVarChar,       value: ItemCode },
        ItemName:      { type: sql.NVarChar,       value: ItemName },
        UnitPerQty:    { type: sql.Decimal(18, 2), value: UnitPerQty || 0 },
        RebatePerBag:  { type: sql.Decimal(18, 2), value: RebatePerBag || 0 },
        QtrRebate:     { type: sql.Decimal(19, 6), value: qtrRebateValue },
        QtrQualified:  { type: sql.Bit,            value: qtrQualifiedValue },
        UnitOfMeasure: { type: sql.NVarChar,       value: UnitOfMeasure || '' },
        CreatedDate:   { type: sql.DateTime,       value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    console.log(`✅ Fixed product rebate saved. ID: ${newId}, QtrQualified: ${qtrQualifiedValue}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving fixed product rebate:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//   Incremental rebate inserts
// ─────────────────────────────────────────────────────────────────────────────

router.post('/inc-cust-rebate', async (req, res) => {
  try {
    const {
      RebateCode, CardCode, CardName, QtrRebate, QtrQualified,
      DateFrom, DateTo, CreatedDate,
    } = req.body;
    const qtrQualifiedValue = toBit(QtrQualified);
    const qtrRebateValue    = parseFloat(QtrRebate) || 0;

    const newId = await insertRow(
      req.db, req.database, 'IncCustRebate',
      {
        RebateCode:   { type: sql.NVarChar,       value: RebateCode },
        CardCode:     { type: sql.NVarChar,       value: CardCode },
        CardName:     { type: sql.NVarChar,       value: CardName },
        QtrRebate:    { type: sql.Decimal(19, 6), value: qtrRebateValue },
        QtrQualified: { type: sql.Bit,            value: qtrQualifiedValue },
        DateFrom:     { type: sql.Date,           value: toDateOrNull(DateFrom) },
        DateTo:       { type: sql.Date,           value: toDateOrNull(DateTo) },
        CreatedDate:  { type: sql.DateTime,       value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    console.log(`✅ Incremental customer rebate saved. ID: ${newId}, QtrQualified: ${qtrQualifiedValue}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving incremental customer rebate:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

router.post('/inc-cust-range', async (req, res) => {
  try {
    const { IncCustRebateId, RangeNo, MinQty, MaxQty, RebatePerBag, CreatedDate } = req.body;

    const newId = await insertRow(
      req.db, req.database, 'IncCustRange',
      {
        IncCustRebateId: { type: sql.Int,      value: IncCustRebateId },
        RangeNo:         { type: sql.Int,      value: RangeNo },
        MinQty:          { type: sql.Int,      value: MinQty || 0 },
        MaxQty:          { type: sql.Int,      value: MaxQty || 0 },
        RebatePerBag:    { type: sql.Int,      value: RebatePerBag || 0 },
        CreatedDate:     { type: sql.DateTime, value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    console.log(`✅ Incremental customer range saved. ID: ${newId}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving incremental customer range:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

router.post('/inc-item-rebate', async (req, res) => {
  try {
    const {
      RebateCode, ItemCode, ItemName, UnitPerQty, UnitOfMeasure,
      RebatePerBag, QtrRebate, QtrQualified, CreatedDate,
    } = req.body;

    const qtrQualifiedValue = toBit(QtrQualified);
    const rebatePerBagValue = parseFloat(RebatePerBag) || 0;
    const qtrRebateValue    = parseFloat(QtrRebate) || 0;

    const newId = await insertRow(
      req.db, req.database, 'IncItemRebate',
      {
        RebateCode:    { type: sql.NVarChar,       value: RebateCode },
        ItemCode:      { type: sql.NVarChar,       value: ItemCode },
        ItemName:      { type: sql.NVarChar,       value: ItemName },
        UnitPerQty:    { type: sql.Int,            value: UnitPerQty || 0 },
        UnitOfMeasure: { type: sql.NVarChar,       value: UnitOfMeasure || '' },
        RebatePerBag:  { type: sql.Decimal(18, 2), value: rebatePerBagValue },
        QtrRebate:     { type: sql.Decimal(19, 6), value: qtrRebateValue },
        QtrQualified:  { type: sql.Bit,            value: qtrQualifiedValue },
        CreatedDate:   { type: sql.DateTime,       value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    console.log(`✅ Incremental item rebate saved. ID: ${newId}, QtrQualified: ${qtrQualifiedValue}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving incremental item rebate:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

router.post('/inc-item-range', async (req, res) => {
  try {
    const { ItemRebateId, RangeNo, MinQty, MaxQty, RebatePerBag, CreatedDate } = req.body;

    const newId = await insertRow(
      req.db, req.database, 'IncItemRange',
      {
        ItemRebateId: { type: sql.Int,      value: ItemRebateId },
        RangeNo:      { type: sql.Int,      value: RangeNo },
        MinQty:       { type: sql.Int,      value: MinQty || 0 },
        MaxQty:       { type: sql.Int,      value: MaxQty || 0 },
        RebatePerBag: { type: sql.Int,      value: RebatePerBag || 0 },
        CreatedDate:  { type: sql.DateTime, value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    console.log(`✅ Incremental item range saved. ID: ${newId}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving incremental item range:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//   Percentage rebate inserts
// ─────────────────────────────────────────────────────────────────────────────

router.post('/per-cust-rebate', async (req, res) => {
  try {
    const {
      RebateCode, CardCode, CardName, QtrRebate, QtrQualified,
      DateFrom, DateTo, CreatedDate,
    } = req.body;

    const qtrQualifiedValue = toBit(QtrQualified);
    const qtrRebateValue    = parseFloat(QtrRebate) || 0;

    const newId = await insertRow(
      req.db, req.database, 'PerCustRebate',
      {
        RebateCode:   { type: sql.NVarChar,       value: RebateCode },
        CardCode:     { type: sql.NVarChar,       value: CardCode },
        CardName:     { type: sql.NVarChar,       value: CardName },
        QtrRebate:    { type: sql.Decimal(19, 6), value: qtrRebateValue },
        QtrQualified: { type: sql.Bit,            value: qtrQualifiedValue },
        DateFrom:     { type: sql.Date,           value: toDateOrNull(DateFrom) },
        DateTo:       { type: sql.Date,           value: toDateOrNull(DateTo) },
        CreatedDate:  { type: sql.DateTime,       value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    console.log(`✅ Percentage customer rebate saved. ID: ${newId}, QtrQualified: ${qtrQualifiedValue}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving percentage customer rebate:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

router.post('/per-cust-quota', async (req, res) => {
  try {
    const { PerCustRebateId, Month, TargetQty, CreatedDate } = req.body;

    const newId = await insertRow(
      req.db, req.database, 'PerCustQuota',
      {
        PerCustRebateId: { type: sql.Int,            value: PerCustRebateId },
        Month:           { type: sql.NVarChar,       value: Month },
        TargetQty:       { type: sql.Decimal(18, 2), value: TargetQty || 0 },
        CreatedDate:     { type: sql.DateTime,       value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    console.log(`✅ Percentage customer quota saved. ID: ${newId}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving percentage customer quota:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

router.post('/per-cust-quotas/bulk', async (req, res) => {
  try {
    const { CustRebateId, quotas } = req.body;
    if (!Array.isArray(quotas) || quotas.length === 0) {
      return res.status(400).json({ success: false, error: 'No quotas provided', database: req.database });
    }

    const results = [];
    for (const q of quotas) {
      if (!q || !q.Month) continue;
      const newId = await insertRow(
        req.db, req.database, 'PerCustQuota',
        {
          PerCustRebateId: { type: sql.Int,            value: CustRebateId },
          Month:           { type: sql.NVarChar,       value: q.Month },
          TargetQty:       { type: sql.Decimal(18, 2), value: q.TargetQty || 0 },
          CreatedDate:     { type: sql.DateTime,       value: q.CreatedDate ? new Date(q.CreatedDate) : new Date() },
        },
        { UpdatedDate: 'GETDATE()' }
      );
      results.push(newId);
    }

    res.json({ success: true, count: results.length, ids: results, database: req.database });
  } catch (error) {
    console.error('❌ Error saving percentage customer quotas (bulk):', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

router.post('/per-prod-rebate', async (req, res) => {
  try {
    const {
      RebateCode, ItemCode, ItemName, UnitPerQty, PercentagePerBag,
      UnitOfMeasure, QtrRebate, QtrQualified, CreatedDate,
    } = req.body;

    const qtrQualifiedValue = toBit(QtrQualified);
    const qtrRebateValue    = parseFloat(QtrRebate) || 0;

    const newId = await insertRow(
      req.db, req.database, 'PerProdRebate',
      {
        RebateCode:       { type: sql.NVarChar,       value: RebateCode },
        ItemCode:         { type: sql.NVarChar,       value: ItemCode },
        ItemName:         { type: sql.NVarChar,       value: ItemName },
        UnitPerQty:       { type: sql.Int,            value: UnitPerQty || 0 },
        PercentagePerBag: { type: sql.Int,            value: PercentagePerBag || 0 },
        QtrRebate:        { type: sql.Decimal(19, 6), value: qtrRebateValue },
        QtrQualified:     { type: sql.Bit,            value: qtrQualifiedValue },
        UnitOfMeasure:    { type: sql.NVarChar,       value: UnitOfMeasure || '' },
        CreatedDate:      { type: sql.DateTime,       value: CreatedDate ? new Date(CreatedDate) : new Date() },
      },
      { UpdatedDate: 'GETDATE()' }
    );

    console.log(`✅ Percentage product rebate saved. ID: ${newId}, QtrQualified: ${qtrQualifiedValue}`);
    res.json({ success: true, id: newId, database: req.database });
  } catch (error) {
    console.error('❌ Error saving percentage product rebate:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//   Read routes
// ─────────────────────────────────────────────────────────────────────────────

router.get('/rebate-programs', async (req, res) => {
  try {
    const query = `SELECT * FROM RebateProgram ORDER BY CreatedDate DESC, RebateCode DESC`;
    const result = await req.db.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      database: req.database,
      count: result.recordset.length,
    });
  } catch (error) {
    console.error('❌ Error fetching rebate programs:', error);
    res.status(500).json({ success: false, error: error.message, database: req.database });
  }
});

router.get('/rebate-program/by-code/:code', async (req, res) => {
  const result = await req.db.request()
    .input('c', sql.NVarChar, req.params.code)
    .query('SELECT * FROM RebateProgram WHERE RebateCode = @c');
  res.json({ success: true, program: result.recordset[0] || null });
});

router.get('/rebate-program/customers/:code', async (req, res) => {
  try {
    const type = req.query.type;
    const map = { Fixed: 'FixCustRebate', Incremental: 'IncCustRebate', Percentage: 'PerCustRebate' };
    const tbl = map[type] || 'FixCustRebate';

    const result = await req.db.request()
      .input('c', sql.NVarChar, req.params.code)
      .query(`SELECT * FROM ${tbl} WHERE RebateCode = @c`);

    const customers = result.recordset;

    for (const c of customers) {
      if (type === 'Fixed') {
        const q = await req.db.request()
          .input('id', sql.Int, c.Id)
          .query(`SELECT * FROM FixCustQuota WHERE CustRebateId = @id ORDER BY Id`);
        c.quotas = q.recordset;
      } else if (type === 'Percentage') {
        const q = await req.db.request()
          .input('id', sql.Int, c.Id)
          .query(`SELECT * FROM PerCustQuota WHERE PerCustRebateId = @id ORDER BY Id`);
        c.quotas = q.recordset;
      } else if (type === 'Incremental') {
        const r = await req.db.request()
          .input('id', sql.Int, c.Id)
          .query(`SELECT * FROM IncCustRange WHERE IncCustRebateId = @id ORDER BY RangeNo`);
        c.ranges = r.recordset;
      }
    }

    res.json({ success: true, customers });
  } catch (err) {
    console.error('❌ Error fetching customers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/rebate-program/items/:code', async (req, res) => {
  try {
    const type = req.query.type;
    const map = { Fixed: 'FixProdRebate', Incremental: 'IncItemRebate', Percentage: 'PerProdRebate' };
    const tbl = map[type] || 'FixProdRebate';

    const result = await req.db.request()
      .input('c', sql.NVarChar, req.params.code)
      .query(`
        SELECT t.*, o.SalUnitMsr
        FROM ${tbl} t
        LEFT JOIN OITM o ON o.ItemCode = t.ItemCode
        WHERE t.RebateCode = @c
      `);

    const items = result.recordset;

    if (type === 'Incremental') {
      for (const i of items) {
        const r = await req.db.request()
          .input('id', sql.Int, i.Id)
          .query(`SELECT * FROM IncItemRange WHERE ItemRebateId = @id ORDER BY RangeNo`);
        i.ranges = r.recordset;
      }
    }

    res.json({ success: true, items });
  } catch (err) {
    console.error('❌ Error fetching items:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// SlpName removed from SELECT
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

// ─────────────────────────────────────────────────────────────────────────────
//   Update / delete
// ─────────────────────────────────────────────────────────────────────────────

// SlpCode/SlpName removed; Name + RedemptionPeriod + DateRangeScope added
router.put('/rebate-program/:code', async (req, res) => {
  try {
    const {
      RebateType, DateFrom, DateTo, Frequency, QuotaType,
      Name, RedemptionPeriod, UpdatedBy, DateRangeScope,
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

router.delete('/rebate-program/:code/details', async (req, res) => {
  const type = req.query.type;
  const code = req.params.code;
  const db = req.db;
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

// ─────────────────────────────────────────────────────────────────────────────
//   Duplicate / conflict checks
// ─────────────────────────────────────────────────────────────────────────────

router.post('/check-duplicate-detailed', async (req, res) => {
  try {
    const { RebateType, DateFrom, DateTo, Frequency, CardCode, ItemCode } = req.body;
    console.log(`🔍 Checking for detailed duplicate rebate program...`);

    try {
      const tableCheck = await req.db.request().query(`
        SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RebateProgram'`);
      if (tableCheck.recordset[0].Count === 0) {
        return res.json({ success: true, exists: false, message: 'RebateProgram table not found' });
      }
    } catch (tableError) { console.log('Error checking tables:', tableError.message); }

    let query = '';
    if (RebateType === 'Fixed') {
      query = `
        SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
               fcr.CardCode, fcr.CardName, fpr.ItemCode, fpr.ItemName
        FROM RebateProgram rp
        INNER JOIN FixCustRebate fcr ON rp.RebateCode = fcr.RebateCode
        INNER JOIN FixProdRebate fpr ON rp.RebateCode = fpr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency
          AND fcr.CardCode = @CardCode AND fpr.ItemCode = @ItemCode
      `;
    } else if (RebateType === 'Percentage') {
      query = `
        SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
               pcr.CardCode, pcr.CardName, ppr.ItemCode, ppr.ItemName
        FROM RebateProgram rp
        INNER JOIN PerCustRebate pcr ON rp.RebateCode = pcr.RebateCode
        INNER JOIN PerProdRebate ppr ON rp.RebateCode = ppr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency
          AND pcr.CardCode = @CardCode AND ppr.ItemCode = @ItemCode
      `;
    } else if (RebateType === 'Incremental') {
      query = `
        SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
               icr.CardCode, icr.CardName, iir.ItemCode, iir.ItemName
        FROM RebateProgram rp
        INNER JOIN IncCustRebate icr ON rp.RebateCode = icr.RebateCode
        INNER JOIN IncItemRebate iir ON rp.RebateCode = iir.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency
          AND icr.CardCode = @CardCode AND iir.ItemCode = @ItemCode
      `;
    } else {
      return res.json({ success: true, exists: false, message: 'Invalid rebate type' });
    }

    const result = await req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('DateFrom', sql.Date, DateFrom)
      .input('DateTo', sql.Date, DateTo)
      .input('Frequency', sql.NVarChar, Frequency)
      .input('CardCode', sql.NVarChar, CardCode)
      .input('ItemCode', sql.NVarChar, ItemCode)
      .query(query);

    if (result.recordset.length > 0) {
      const duplicate = result.recordset[0];
      res.json({
        success: true,
        exists: true,
        existingRebateCode: duplicate.RebateCode,
        existingDateFrom: duplicate.DateFrom,
        existingDateTo: duplicate.DateTo,
        existingFrequency: duplicate.Frequency,
        existingCardCode: duplicate.CardCode,
        existingCardName: duplicate.CardName,
        existingItemCode: duplicate.ItemCode,
        existingItemName: duplicate.ItemName,
      });
    } else {
      res.json({ success: true, exists: false });
    }
  } catch (error) {
    console.error('❌ Error checking for duplicates:', error);
    res.status(200).json({
      success: false, exists: false, error: error.message,
      message: 'Error checking duplicates, but will proceed with save',
    });
  }
});

router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Rebate program API is working', timestamp: new Date().toISOString() });
});

router.post('/check-duplicates-batch', async (req, res) => {
  try {
    const { RebateType, DateFrom, DateTo, Frequency, combinations } = req.body;
    console.log(`🔍 Batch checking ${combinations.length} combinations for duplicates...`);

    const results = [];
    for (const combo of combinations) {
      let query = '';
      if (RebateType === 'Fixed') {
        query = `
          SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
                 fcr.CardCode, fcr.CardName, fpr.ItemCode, fpr.ItemName
          FROM RebateProgram rp
          INNER JOIN FixCustRebate fcr ON rp.RebateCode = fcr.RebateCode
          INNER JOIN FixProdRebate fpr ON rp.RebateCode = fpr.RebateCode
          WHERE rp.RebateType = @RebateType
            AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo
            AND rp.Frequency = @Frequency
            AND fcr.CardCode = @CardCode AND fpr.ItemCode = @ItemCode
        `;
      } else if (RebateType === 'Percentage') {
        query = `
          SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
                 pcr.CardCode, pcr.CardName, ppr.ItemCode, ppr.ItemName
          FROM RebateProgram rp
          INNER JOIN PerCustRebate pcr ON rp.RebateCode = pcr.RebateCode
          INNER JOIN PerProdRebate ppr ON rp.RebateCode = ppr.RebateCode
          WHERE rp.RebateType = @RebateType
            AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo
            AND rp.Frequency = @Frequency
            AND pcr.CardCode = @CardCode AND ppr.ItemCode = @ItemCode
        `;
      } else if (RebateType === 'Incremental') {
        query = `
          SELECT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency,
                 icr.CardCode, icr.CardName, iir.ItemCode, iir.ItemName
          FROM RebateProgram rp
          INNER JOIN IncCustRebate icr ON rp.RebateCode = icr.RebateCode
          INNER JOIN IncItemRebate iir ON rp.RebateCode = iir.RebateCode
          WHERE rp.RebateType = @RebateType
            AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo
            AND rp.Frequency = @Frequency
            AND icr.CardCode = @CardCode AND iir.ItemCode = @ItemCode
        `;
      }

      const result = await req.db.request()
        .input('RebateType', sql.NVarChar, RebateType)
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
          existingCardName: dup.CardName,
          existingItemName: dup.ItemName,
        });
      } else {
        results.push({ customerCode: combo.CardCode, itemCode: combo.ItemCode, exists: false });
      }
    }

    const duplicates = results.filter(r => r.exists);
    res.json({
      success: true,
      duplicates,
      totalChecked: combinations.length,
      duplicateCount: duplicates.length,
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
    } catch (tableError) { console.log('Error checking tables:', tableError.message); }

    let query = '';
    if (RebateType === 'Fixed') {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               fpr.ItemCode, fpr.ItemName
        FROM RebateProgram rp
        INNER JOIN FixProdRebate fpr ON rp.RebateCode = fpr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency AND fpr.ItemCode = @ItemCode
      `;
    } else if (RebateType === 'Percentage') {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               ppr.ItemCode, ppr.ItemName
        FROM RebateProgram rp
        INNER JOIN PerProdRebate ppr ON rp.RebateCode = ppr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom = @DateFrom AND rp.DateTo = @DateTo
          AND rp.Frequency = @Frequency AND ppr.ItemCode = @ItemCode
      `;
    } else if (RebateType === 'Incremental') {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               iir.ItemCode, iir.ItemName
        FROM RebateProgram rp
        INNER JOIN IncItemRebate iir ON rp.RebateCode = iir.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.DateFrom <= @DateTo AND rp.DateTo >= @DateFrom
          AND rp.Frequency = @Frequency AND iir.ItemCode = @ItemCode
      `;
    } else {
      return res.json({ success: true, exists: false, message: 'Invalid rebate type' });
    }

    const result = await req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('DateFrom', sql.Date, DateFrom)
      .input('DateTo', sql.Date, DateTo)
      .input('Frequency', sql.NVarChar, Frequency)
      .input('ItemCode', sql.NVarChar, ItemCode)
      .query(query);

    if (result.recordset.length > 0) {
      const program = result.recordset[0];
      res.json({
        success: true,
        exists: true,
        existingProgram: {
          RebateCode: program.RebateCode,
          DateFrom: program.DateFrom,
          DateTo: program.DateTo,
          Frequency: program.Frequency,
          QuotaType: program.QuotaType,
          ItemCode: program.ItemCode,
          ItemName: program.ItemName,
        },
      });
    } else {
      res.json({ success: true, exists: false });
    }
  } catch (error) {
    console.error('❌ Error checking item conflict:', error);
    res.status(200).json({
      success: false, exists: false, error: error.message,
      message: 'Error checking item conflicts',
    });
  }
});

// ─── check-duplicate-program — FORGIVING version ───────────────────────────
router.post('/rebate-program/check-duplicate-program', async (req, res) => {
  try {
    const { RebateType, DateFrom, DateTo, Frequency, ExcludeRebateCode } = req.body;

    if (!RebateType || !DateFrom || !DateTo || !Frequency) {
      console.warn('⚠️ check-duplicate-program skipped — missing fields:', {
        RebateType, DateFrom, DateTo, Frequency,
      });
      return res.json({
        success: true,
        exists: false,
        skipped: true,
        message: 'Skipped duplicate check — missing required fields',
      });
    }

    try {
      const tableCheck = await req.db.request().query(`
        SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RebateProgram'`);
      if (tableCheck.recordset[0].Count === 0) {
        return res.json({ success: true, exists: false, message: 'RebateProgram table not found' });
      }
    } catch (tableError) { console.log('Error checking tables:', tableError.message); }

    let query = `
      SELECT RebateCode, RebateType, DateFrom, DateTo, Frequency, QuotaType, CreatedDate
      FROM RebateProgram 
      WHERE RebateType = @RebateType
        AND Frequency = @Frequency
        AND DateFrom <= @DateTo
        AND DateTo   >= @DateFrom
    `;
    if (ExcludeRebateCode) query += ` AND RebateCode <> @ExcludeRebateCode `;

    const request = req.db.request()
      .input('RebateType', sql.NVarChar, RebateType)
      .input('Frequency',  sql.NVarChar, Frequency)
      .input('DateFrom',   sql.Date, DateFrom)
      .input('DateTo',     sql.Date, DateTo);
    if (ExcludeRebateCode) request.input('ExcludeRebateCode', sql.NVarChar, ExcludeRebateCode);

    const result = await request.query(query);

    if (result.recordset.length > 0) {
      const program = result.recordset[0];
      res.json({
        success: true,
        exists: true,
        program: {
          RebateCode: program.RebateCode,
          RebateType: program.RebateType,
          DateFrom: program.DateFrom,
          DateTo: program.DateTo,
          Frequency: program.Frequency,
          QuotaType: program.QuotaType,
          CreatedDate: program.CreatedDate,
        },
      });
    } else {
      res.json({ success: true, exists: false });
    }
  } catch (error) {
    console.error('❌ Error checking for duplicate program:', error);
    res.status(200).json({
      success: false, exists: false, error: error.message,
      message: 'Error checking for duplicate program',
    });
  }
});

// ─── check-customer-conflict — FORGIVING version (SlpCode removed) ────────
router.post('/rebate-program/check-customer-conflict', async (req, res) => {
  try {
    const { RebateType, DateFrom, DateTo, Frequency, CardCode, ExcludeRebateCode } = req.body;
    console.log(`🔍 Checking if customer ${CardCode} exists in any overlapping program...`);

    if (!RebateType || !DateFrom || !DateTo || !Frequency || !CardCode) {
      console.warn('⚠️ check-customer-conflict skipped — missing fields:', {
        RebateType, DateFrom, DateTo, Frequency, CardCode,
      });
      return res.json({ success: true, exists: false, skipped: true });
    }

    try {
      const tableCheck = await req.db.request().query(`
        SELECT COUNT(*) as Count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RebateProgram'`);
      if (tableCheck.recordset[0].Count === 0) {
        return res.json({ success: true, exists: false, message: 'RebateProgram table not found' });
      }
    } catch (tableError) { console.log('Error checking tables:', tableError.message); }

    let query = '';
    if (RebateType === 'Fixed') {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               fcr.CardCode, fcr.CardName
        FROM RebateProgram rp
        INNER JOIN FixCustRebate fcr ON rp.RebateCode = fcr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.Frequency = @Frequency
          AND rp.DateFrom <= @DateTo AND rp.DateTo >= @DateFrom
          AND fcr.CardCode = @CardCode
      `;
    } else if (RebateType === 'Percentage') {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               pcr.CardCode, pcr.CardName
        FROM RebateProgram rp
        INNER JOIN PerCustRebate pcr ON rp.RebateCode = pcr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.Frequency = @Frequency
          AND rp.DateFrom <= @DateTo AND rp.DateTo >= @DateFrom
          AND pcr.CardCode = @CardCode
      `;
    } else if (RebateType === 'Incremental') {
      query = `
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo, rp.Frequency, rp.QuotaType,
               icr.CardCode, icr.CardName
        FROM RebateProgram rp
        INNER JOIN IncCustRebate icr ON rp.RebateCode = icr.RebateCode
        WHERE rp.RebateType = @RebateType
          AND rp.Frequency = @Frequency
          AND rp.DateFrom <= @DateTo AND rp.DateTo >= @DateFrom
          AND icr.CardCode = @CardCode
      `;
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

    if (result.recordset.length > 0) {
      const program = result.recordset[0];
      res.json({
        success: true,
        exists: true,
        existingProgram: {
          RebateCode: program.RebateCode,
          DateFrom: program.DateFrom,
          DateTo: program.DateTo,
          Frequency: program.Frequency,
          QuotaType: program.QuotaType,
          CardCode: program.CardCode,
          CardName: program.CardName,
        },
      });
    } else {
      res.json({ success: true, exists: false });
    }
  } catch (error) {
    console.error('❌ Error checking customer conflict:', error);
    res.status(200).json({
      success: false, exists: false, error: error.message,
      message: 'Error checking customer conflicts',
    });
  }
});

export default router;