// routes/nexchem.js
import express from 'express';
import { getPool } from '../services/databaseService.js';

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ═══════════════════════════════════════════════════════════════════════════
   TYPE DETECTION
   ═══════════════════════════════════════════════════════════════════════════ */
const detectType = (raw) => {
  const t = String(raw ?? '').toLowerCase().replace(/[\s_\-]/g, '').trim();
  if (t.includes('increment')) return 'incremental';
  if (t.includes('percent'))   return 'percentage';
  return 'fixed';
};

/* Table routing. Every type has a primary table set. If the primary set has
   no data for a rebate code (older rebates were stored differently), we fall
   back to the Fix tables. */
const TABLES = {
  fixed: {
    cust:    'FixCustRebate',
    prod:    'FixProdRebate',
    rateCol: 'RebatePerBag',
  },
  percentage: {
    cust:    'PerCustRebate',
    prod:    'PerProdRebate',
    rateCol: 'PercentagePerBag',
  },
  incremental: {
    cust:    'IncCustRebate',
    prod:    'IncItemRebate',
    range:   'IncCustRange',
  },
};

const CUST_TABLE = {
  fixed:       TABLES.fixed.cust,
  percentage:  TABLES.percentage.cust,
  incremental: TABLES.incremental.cust,
};

/* ─── Tier picker (Incremental) ──────────────────────────────────────────── */
const pickTier = (tiers, qty) => {
  if (!tiers || !tiers.length) return null;

  // 1) Tier whose [MinQty, MaxQty] window contains qty
  const contained = tiers
    .filter(t => qty >= t.min && (t.max <= 0 || qty <= t.max))
    .sort((a, b) => a.min - b.min);
  if (contained.length) return contained[0];

  // 2) Fallback — highest tier whose MinQty ≤ qty
  const eligible = tiers
    .filter(t => qty >= t.min)
    .sort((a, b) => b.min - a.min);
  return eligible[0] || null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   RATE MAP BUILDERS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Item-level rate map (Fixed + Percentage + fallback) ────────────────── */
const buildItemRateMap = async (pool, rebateCode, customerCodes, custTable, prodTable, rateCol) => {
  const ph = customerCodes.map((_, i) => `@c${i}`).join(',');
  const req = pool.request().input('rc', rebateCode);
  customerCodes.forEach((c, i) => req.input(`c${i}`, c));

  const res = await req.query(`
    SELECT T1.CardCode, T2.ItemCode, T2.ItemName, T2.${rateCol} AS Rate
    FROM   ${custTable} T1
    INNER JOIN ${prodTable} T2 ON T1.RebateCode = T2.RebateCode
    WHERE  T1.RebateCode = @rc
      AND  T1.CardCode IN (${ph})
      AND  T2.${rateCol} IS NOT NULL
      AND  T2.${rateCol} <> 0
  `);
  console.log(`[Nexchem][${custTable}+${prodTable}.${rateCol}] rate rows=${res.recordset.length}`);

  const itemMap = {};
  res.recordset.forEach(r => {
    itemMap[r.CardCode] = itemMap[r.CardCode] || {};
    itemMap[r.CardCode][r.ItemCode] = {
      rate: toNum(r.Rate),
      name: r.ItemName,
    };
  });

  return {
    kind: 'item',
    itemMap,
    isEligible:  (cardCode, itemCode) => !!itemMap[cardCode]?.[itemCode],
    rateForLine: (cardCode, itemCode) => itemMap[cardCode]?.[itemCode]?.rate || 0,
    nameFor:     (cardCode, itemCode) => itemMap[cardCode]?.[itemCode]?.name || itemCode,
  };
};

/* ─── INCREMENTAL — tiered rate, accumulated per customer per period ─────── */
const buildIncrementalRateMap = async (pool, rebateCode, customerCodes) => {
  const ph = customerCodes.map((_, i) => `@c${i}`).join(',');
  const custReq = pool.request().input('rc', rebateCode);
  customerCodes.forEach((c, i) => custReq.input(`c${i}`, c));

  const custRes = await custReq.query(`
    SELECT Id, CardCode
    FROM   IncCustRebate
    WHERE  RebateCode = @rc
      AND  CardCode IN (${ph})
  `);
  console.log(`[Nexchem][incremental] customer rows=${custRes.recordset.length}`);
  if (!custRes.recordset.length) return null;

  const idByCard = {};
  const ids = [];
  custRes.recordset.forEach(r => {
    idByCard[r.CardCode] = r.Id;
    ids.push(r.Id);
  });

  const idPh = ids.map((_, i) => `@id${i}`).join(',');
  const rangeReq = pool.request();
  ids.forEach((id, i) => rangeReq.input(`id${i}`, id));

  const rangeRes = await rangeReq.query(`
    SELECT IncCustRebateId, MinQty, MaxQty, RebatePerBag
    FROM   IncCustRange
    WHERE  IncCustRebateId IN (${idPh})
    ORDER BY IncCustRebateId, MinQty
  `);
  console.log(`[Nexchem][incremental] tier rows=${rangeRes.recordset.length}`);

  const tiersByCustId = {};
  rangeRes.recordset.forEach(r => {
    const id = r.IncCustRebateId;
    if (!tiersByCustId[id]) tiersByCustId[id] = [];
    tiersByCustId[id].push({
      min:  toNum(r.MinQty),
      max:  toNum(r.MaxQty),
      rate: toNum(r.RebatePerBag),
    });
  });

  const itemRes = await pool.request().input('rc', rebateCode).query(`
    SELECT ItemCode, ItemName FROM IncItemRebate WHERE RebateCode = @rc
  `);
  console.log(`[Nexchem][incremental] eligible items=${itemRes.recordset.length}`);

  const itemMap = {};
  itemRes.recordset.forEach(r => { itemMap[r.ItemCode] = r.ItemName; });

  return {
    kind: 'incremental',
    idByCard,
    tiersByCustId,
    itemMap,
    isEligible: (cardCode, itemCode) => !!idByCard[cardCode] && !!itemMap[itemCode],
    rateForTotal: (cardCode, totalQty) => {
      const id = idByCard[cardCode];
      const tier = pickTier(tiersByCustId[id], totalQty);
      return tier ? tier.rate : 0;
    },
  };
};

/* ─── ROUTER: try type-specific tables, fall back to Fix ─────────────────── */
const buildRateMap = async (pool, rebateCode, customerCodes, typeKey) => {
  if (typeKey === 'incremental') {
    const m = await buildIncrementalRateMap(pool, rebateCode, customerCodes);
    if (m) return m;
    console.log(`[Nexchem] ${rebateCode}: Inc tables empty → falling back to Fix`);
  } else {
    const cfg = TABLES[typeKey];
    const m = await buildItemRateMap(pool, rebateCode, customerCodes, cfg.cust, cfg.prod, cfg.rateCol);
    if (Object.keys(m.itemMap).length > 0) return m;
    if (typeKey !== 'fixed') {
      console.log(`[Nexchem] ${rebateCode}: ${cfg.cust} empty → falling back to Fix`);
    }
  }
  const fix = TABLES.fixed;
  return buildItemRateMap(pool, rebateCode, customerCodes, fix.cust, fix.prod, fix.rateCol);
};

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED: fetch invoice lines for a set of customers
   ═══════════════════════════════════════════════════════════════════════════ */
const fetchInvoiceLines = async (sapPool, customerCodes, dateFrom, dateTo) => {
  const ph = customerCodes.map((_, i) => `@CardCode${i}`).join(',');

  let q = `
    SELECT T0.DocNum, T0.CardCode, T0.CardName, T0.DocDate,
           T0.ItemCode, T0.Dscription, T0.Quantity, T0.LineTotal, T0.PriceAfVAT
    FROM   OINV T0
    WHERE  T0.TreeType <> 'S'
      AND  T0.DocType   = 'I'
      AND  T0.Dscription NOT LIKE '%Free%'
      AND  T0.Dscription NOT LIKE '%Discount%'
      AND  T0.Dscription NOT LIKE '%fee%'
      AND  T0.CardCode IN (${ph})
  `;
  if (dateFrom) q += ` AND T0.DocDate >= @DateFrom`;
  if (dateTo)   q += ` AND T0.DocDate <= @DateTo`;
  q += ` ORDER BY T0.CardCode, T0.DocDate, T0.DocNum`;

  const req = sapPool.request();
  customerCodes.forEach((c, i) => req.input(`CardCode${i}`, c));
  if (dateFrom) req.input('DateFrom', new Date(dateFrom).toISOString().split('T')[0]);
  if (dateTo)   req.input('DateTo',   new Date(dateTo).toISOString().split('T')[0]);

  return req.query(q);
};

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED: build report payload from invoice lines + a rate map
   ═══════════════════════════════════════════════════════════════════════════ */
const buildReportData = (invoiceRows, rateMap) => {
  /* ─── First pass: sum eligible qty per customer (Incremental only) ────── */
  const customerRate = {};

  if (rateMap.kind === 'incremental') {
    const totals = {};
    invoiceRows.forEach(row => {
      if (!rateMap.isEligible(row.CardCode, row.ItemCode)) return;
      totals[row.CardCode] = (totals[row.CardCode] || 0) + toNum(row.Quantity);
    });

    Object.entries(totals).forEach(([card, qty]) => {
      const rate = rateMap.rateForTotal(card, qty);
      console.log(`[Nexchem] customer ${card} total qty=${qty} → rate=${rate}`);
      if (rate > 0) customerRate[card] = rate;
    });
  }

  /* ─── Second pass: build grouped report ────────────────────────────────── */
  const grouped = {};
  let matched = 0;
  const sampleMisses = [];

  invoiceRows.forEach(row => {
    const docNum   = row.DocNum;
    const cardCode = row.CardCode;

    let rate = 0;
    let name = row.ItemCode;

    if (rateMap.kind === 'incremental') {
      if (!rateMap.isEligible(cardCode, row.ItemCode)) return;
      rate = customerRate[cardCode] || 0;
      if (rate <= 0) return;
      name = rateMap.itemMap[row.ItemCode] || row.ItemCode;
    } else {
      if (!rateMap.isEligible(cardCode, row.ItemCode)) {
        if (sampleMisses.length < 5) {
          sampleMisses.push({ card: cardCode, item: row.ItemCode, qty: toNum(row.Quantity) });
        }
        return;
      }
      rate = rateMap.rateForLine(cardCode, row.ItemCode);
      if (rate <= 0) return;
      name = rateMap.nameFor(cardCode, row.ItemCode);
    }

    matched++;

    if (!grouped[docNum]) {
      grouped[docNum] = {
        id:           docNum.toString(),
        docDate:      row.DocDate,
        cardCode:     cardCode,
        cardName:     row.CardName,
        customerCode: cardCode,
        customerName: row.CardName,
        items:        [],
      };
    }

    grouped[docNum].items.push({
      name:          row.Dscription || name || row.ItemCode,
      itemCode:      row.ItemCode,
      qty:           toNum(row.Quantity),
      sales_amt:     toNum(row.LineTotal),
      kitanex:       rate,
      total_kitanex: toNum(row.Quantity) * rate,
    });
  });

  console.log(`[Nexchem] matched=${matched}/${invoiceRows.length}`);
  if (sampleMisses.length) {
    console.log(`[Nexchem] sample unmatched lines:`, sampleMisses);
  }

  const reportData = Object.values(grouped)
    .filter(g => g.items.length > 0)
    .sort((a, b) => new Date(a.docDate) - new Date(b.docDate));

  console.log(`[Nexchem] docs=${reportData.length}`);
  return reportData;
};

/* ═══════════════════════════════════════════════════════════════════════════
   GET /nexchem/customer
   ═══════════════════════════════════════════════════════════════════════════ */
router.get('/nexchem/customer', async (req, res) => {
  try {
    const sapPool = getPool('NEXCHEM');
    const result = await sapPool.request().query(`
      SELECT DISTINCT T0.CardCode, T0.CardName
      FROM OCRD T0
      ORDER BY T0.CardName
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   GET /nexchem/rebate-programs
   ═══════════════════════════════════════════════════════════════════════════ */
router.get('/nexchem/rebate-programs', async (req, res) => {
  try {
    const ownPool = getPool('NEXCHEM');
    const result = await ownPool.request().query(`
      SELECT
        T0.RebateCode, T0.RebateType, T0.SlpCode, T0.SlpName,
        T0.DateFrom, T0.DateTo, T0.Frequency, T0.QuotaType,
        T1.CardCode, T1.CardName, T1.QtrRebate,
        T2.ItemCode, T2.ItemName, T2.RebatePerBag, T2.UnitPerQty
      FROM RebateProgram T0
      LEFT JOIN FixCustRebate T1 ON T0.RebateCode = T1.RebateCode
      LEFT JOIN FixProdRebate T2 ON T0.RebateCode = T2.RebateCode
      WHERE T0.IsActive = 1
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching rebate programs:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   GET /nexchem/rebate/:rebateCode/customers
   ═══════════════════════════════════════════════════════════════════════════ */
router.get('/nexchem/rebate/:rebateCode/customers', async (req, res) => {
  try {
    const { rebateCode } = req.params;
    const databaseToUse = req.query.db || 'NEXCHEM';
    const pool = getPool(databaseToUse);

    if (!pool) {
      return res.status(500).json({
        success: false,
        error: `Database pool for ${databaseToUse} not available`,
      });
    }

    const progRes = await pool.request()
      .input('rc', rebateCode)
      .query(`
        SELECT RebateCode, RebateType, DateFrom, DateTo, SlpName
        FROM   RebateProgram
        WHERE  RebateCode = @rc
      `);

    if (!progRes.recordset.length) {
      return res.status(404).json({
        success: false,
        error: `Rebate code ${rebateCode} not found`,
      });
    }

    const prog    = progRes.recordset[0];
    const typeKey = detectType(prog.RebateType);
    let   custTable = CUST_TABLE[typeKey];

    console.log(
      `[Nexchem] customers | code=${rebateCode} | rawType=${prog.RebateType} | ` +
      `typeKey=${typeKey} | primaryTable=${custTable}`
    );

    let result = await pool.request()
      .input('rc', rebateCode)
      .query(`
        SELECT DISTINCT CardCode, CardName
        FROM   ${custTable}
        WHERE  RebateCode = @rc
          AND  CardCode IS NOT NULL
          AND  LTRIM(RTRIM(CardCode)) <> ''
        ORDER BY CardName
      `);

    if (result.recordset.length === 0 && custTable !== 'FixCustRebate') {
      console.log(`[Nexchem] ${rebateCode}: ${custTable} returned 0 → falling back to FixCustRebate`);
      custTable = 'FixCustRebate';
      result = await pool.request()
        .input('rc', rebateCode)
        .query(`
          SELECT DISTINCT CardCode, CardName
          FROM   FixCustRebate
          WHERE  RebateCode = @rc
            AND  CardCode IS NOT NULL
            AND  LTRIM(RTRIM(CardCode)) <> ''
          ORDER BY CardName
        `);
    }

    console.log(`[Nexchem] customers found: ${result.recordset.length} (from ${custTable})`);

    res.json({
      success: true,
      customers: result.recordset,
      rebateInfo: {
        rebateCode: prog.RebateCode,
        rebateType: prog.RebateType,
        typeKey,
        tableUsed: custTable,
        dateFrom:  prog.DateFrom,
        dateTo:    prog.DateTo,
        slpName:   prog.SlpName,
      },
    });
  } catch (error) {
    console.error('Error fetching customers for rebate code:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   POST /nexchem/generate-report  (single customer)
   ═══════════════════════════════════════════════════════════════════════════ */
router.post('/nexchem/generate-report', async (req, res) => {
  try {
    const { selectedCustomer, dateFrom, dateTo, rebateCode } = req.body;

    if (!selectedCustomer) return res.status(400).json({ error: 'Customer is required' });
    if (!rebateCode)       return res.status(400).json({ error: 'rebateCode is required' });

    const sapPool = getPool('NEXCHEM');
    const ownPool = getPool('NEXCHEM');

    const meta = await ownPool.request()
      .input('rc', rebateCode)
      .query(`SELECT RebateType FROM RebateProgram WHERE RebateCode = @rc`);

    if (!meta.recordset.length) {
      return res.status(404).json({ error: `Rebate code "${rebateCode}" not found` });
    }

    const rawType = meta.recordset[0].RebateType;
    const typeKey = detectType(rawType);

    console.log(`[Nexchem] single | code=${rebateCode} | type=${rawType} | key=${typeKey}`);

    const rateMap = await buildRateMap(ownPool, rebateCode, [selectedCustomer], typeKey);
    console.log(`[Nexchem] single | rate kind=${rateMap.kind}`);

    const invRes = await fetchInvoiceLines(sapPool, [selectedCustomer], dateFrom, dateTo);
    console.log(`[Nexchem] single | invoice lines=${invRes.recordset.length}`);

    const reportData = buildReportData(invRes.recordset, rateMap);

    res.json({
      success: true,
      data: reportData,
      summary: {
        totalDocuments: reportData.length,
        totalItems:     reportData.reduce((s, g) => s + g.items.length, 0),
        dateFrom:       dateFrom || 'All',
        dateTo:         dateTo   || 'All',
        rebateType:     rawType,
        typeKey,
      },
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   POST /nexchem/generate-multi-customer-report
   ═══════════════════════════════════════════════════════════════════════════ */
router.post('/nexchem/generate-multi-customer-report', async (req, res) => {
  try {
    const { customerCodes, dateFrom, dateTo, rebateCode } = req.body;

    console.log('[Nexchem] multi body:', JSON.stringify(req.body));

    if (!customerCodes || !customerCodes.length) {
      return res.status(400).json({ success: false, error: 'At least one customer is required' });
    }
    if (!rebateCode) {
      return res.status(400).json({ success: false, error: 'rebateCode is required' });
    }

    const sapPool = getPool('NEXCHEM');
    const ownPool = getPool('NEXCHEM');

    const meta = await ownPool.request()
      .input('rc', rebateCode)
      .query(`SELECT RebateType FROM RebateProgram WHERE RebateCode = @rc`);

    if (!meta.recordset.length) {
      return res.status(404).json({ success: false, error: `Rebate code "${rebateCode}" not found` });
    }

    const rawType = meta.recordset[0].RebateType;
    const typeKey = detectType(rawType);

    console.log(`[Nexchem] multi | code=${rebateCode} | type=${rawType} | key=${typeKey}`);

    const rateMap = await buildRateMap(ownPool, rebateCode, customerCodes, typeKey);
    console.log(`[Nexchem] multi | rate kind=${rateMap.kind}`);

    const invRes = await fetchInvoiceLines(sapPool, customerCodes, dateFrom, dateTo);
    console.log(`[Nexchem] multi | invoice lines=${invRes.recordset.length}`);

    const reportData = buildReportData(invRes.recordset, rateMap);

    res.json({
      success: true,
      data: reportData,
      summary: {
        totalDocuments: reportData.length,
        totalItems:     reportData.reduce((s, g) => s + g.items.length, 0),
        totalCustomers: customerCodes.length,
        dateFrom:       dateFrom || 'All',
        dateTo:         dateTo   || 'All',
        rebateType:     rawType,
        typeKey,
      },
    });
  } catch (error) {
    console.error('Error generating multi-customer report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   GET /rebate-program/all-codes
   ═══════════════════════════════════════════════════════════════════════════ */
router.get('/rebate-program/all-codes', async (req, res) => {
  try {
    const pool = getPool('NEXCHEM');
    const r = await pool.request().query(`
      SELECT
        RebateCode, RebateType, SlpCode, SlpName,
        DateFrom, DateTo, Frequency, QuotaType
      FROM   RebateProgram
      WHERE  IsActive = 1
      ORDER BY RebateCode
    `);
    console.log(`[Nexchem] all-codes → ${r.recordset.length} codes:`,
      r.recordset.map(x => `${x.RebateCode}(${x.RebateType})`).join(', '));
    res.json({ success: true, codes: r.recordset });
  } catch (error) {
    console.error('[Nexchem] all-codes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   DIAGNOSTIC — GET /nexchem/_diag/:code
   ═══════════════════════════════════════════════════════════════════════════ */
router.get('/nexchem/_diag/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const pool = getPool('NEXCHEM');

    const metaRes = await pool.request()
      .input('rc', code)
      .query(`SELECT RebateCode, RebateType, IsActive FROM RebateProgram WHERE RebateCode = @rc`);

    if (!metaRes.recordset.length) {
      return res.json({ success: true, code, found: false });
    }

    const meta    = metaRes.recordset[0];
    const typeKey = detectType(meta.RebateType);

    const count = async (sql) => {
      try {
        const r = await pool.request().input('rc', code).query(sql);
        return r.recordset[0]?.n ?? 0;
      } catch (e) { return `ERR: ${e.message}`; }
    };

    const counts = {
      FixCust:   await count(`SELECT COUNT(*) n FROM FixCustRebate WHERE RebateCode=@rc`),
      FixProd:   await count(`SELECT COUNT(*) n FROM FixProdRebate WHERE RebateCode=@rc`),
      PerCust:   await count(`SELECT COUNT(*) n FROM PerCustRebate WHERE RebateCode=@rc`),
      PerProd:   await count(`SELECT COUNT(*) n FROM PerProdRebate WHERE RebateCode=@rc`),
      IncCust:   await count(`SELECT COUNT(*) n FROM IncCustRebate WHERE RebateCode=@rc`),
      IncItem:   await count(`SELECT COUNT(*) n FROM IncItemRebate WHERE RebateCode=@rc`),
      IncRanges: await count(`
        SELECT COUNT(*) n FROM IncCustRange c
        JOIN   IncCustRebate ic ON ic.Id = c.IncCustRebateId
        WHERE  ic.RebateCode = @rc
      `),
    };

    const result = {
      success: true,
      code,
      found:   true,
      rawType: meta.RebateType,
      typeKey,
      isActive: !!meta.IsActive,
      counts,
      willGenerate:
        (counts.FixCust   > 0 && counts.FixProd   > 0) ||
        (counts.PerCust   > 0 && counts.PerProd   > 0) ||
        (counts.IncCust   > 0 && counts.IncItem   > 0 && counts.IncRanges > 0),
    };

    console.log('[Nexchem][diag]', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   DIAGNOSTIC — GET /nexchem/_tables
   ═══════════════════════════════════════════════════════════════════════════ */
router.get('/nexchem/_tables', async (req, res) => {
  try {
    const pool = getPool('NEXCHEM');
    const r = await pool.request().query(`
      SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, DATA_TYPE
      FROM   INFORMATION_SCHEMA.COLUMNS
      WHERE  TABLE_NAME IN ('PerCustRebate','PerProdRebate','PerCustQuota',
                            'FixCustRebate','FixProdRebate','IncCustRebate',
                            'IncItemRebate','IncCustRange')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    res.json({ success: true, columns: r.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;