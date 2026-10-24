/**
 * services/Nexchem_reportService.js
 * Supports Fixed / Fixed with Quota / Incremental / Percentage.
 */

import { getPool } from './databaseService.js';

/* ─── TYPE HELPERS ────────────────────────────────────────────────────────── */
const normalise = (raw) =>
  String(raw ?? '').toLowerCase().replace(/[\s_\-]/g, '').trim();

const typeKeyFrom = (raw) => {
  const t = normalise(raw);
  if (t.includes('increment')) return 'incremental';
  return 'fixed'; // Percentage + Fixed + Fixed-with-Quota all share the Fix tables
};

const labelFromType = (raw) => {
  const t = normalise(raw);
  if (!raw) return 'Fixed';
  if (t.includes('percent'))   return 'Percentage';
  if (t.includes('increment')) return 'Incremental';
  if (t.includes('quota'))     return 'Fixed with Quota';
  return 'Fixed';
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ─── REBATE PROGRAM META ─────────────────────────────────────────────────── */
const getRebateProgramMeta = async (pool, rebateCode) => {
  if (!rebateCode) return null;
  const res = await pool.request()
    .input('rc', rebateCode)
    .query(`
      SELECT RebateCode, RebateType, SlpCode, SlpName,
             DateFrom, DateTo, Frequency, QuotaType, IsActive
      FROM   RebateProgram
      WHERE  RebateCode = @rc
    `);
  return res.recordset[0] || null;
};

/* ─── PUBLIC READS ────────────────────────────────────────────────────────── */
export const getCustomers = async () => {
  const sapPool = getPool('NEXCHEM');
  const r = await sapPool.request().query(`
    SELECT DISTINCT CardCode, CardName FROM OCRD ORDER BY CardName
  `);
  return r.recordset;
};

export const getRebatePrograms = async () => {
  const pool = getPool('NEXCHEM');
  const r = await pool.request().query(`
    SELECT RebateCode, RebateType, SlpCode, SlpName,
           DateFrom, DateTo, Frequency, QuotaType
    FROM   RebateProgram
    WHERE  IsActive = 1
    ORDER BY RebateCode
  `);
  return r.recordset;
};

export const getCustomersByRebateCode = async (rebateCode) => {
  const pool = getPool('NEXCHEM');

  const meta = await getRebateProgramMeta(pool, rebateCode);
  if (!meta) throw new Error(`Rebate code "${rebateCode}" not found`);

  const key       = typeKeyFrom(meta.RebateType);
  const custTable = key === 'incremental' ? 'IncCustRebate' : 'FixCustRebate';

  console.log(
    `[Nexchem] customers | code=${rebateCode} | rawType=${meta.RebateType} | ` +
    `key=${key} | table=${custTable}`
  );

  const r = await pool.request()
    .input('rc', rebateCode)
    .query(`
      SELECT DISTINCT CardCode, CardName
      FROM   ${custTable}
      WHERE  RebateCode = @rc
        AND  CardCode IS NOT NULL
        AND  LTRIM(RTRIM(CardCode)) <> ''
      ORDER BY CardName
    `);

  console.log(`[Nexchem] customers found: ${r.recordset.length}`);

  return {
    rebateCode:  meta.RebateCode,
    rebateType:  meta.RebateType,
    rebateLabel: labelFromType(meta.RebateType),
    customers:   r.recordset.map(x => ({ CardCode: x.CardCode, CardName: x.CardName })),
    rebateInfo: {
      RebateCode:  meta.RebateCode,
      RebateType:  meta.RebateType,
      RebateLabel: labelFromType(meta.RebateType),
      SlpName:     meta.SlpName,
      DateFrom:    meta.DateFrom,
      DateTo:      meta.DateTo,
      QuotaType:   meta.QuotaType,
    },
  };
};

/* ─── INVOICE LINES ───────────────────────────────────────────────────────── */
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
   RESOLVER — FIXED (also Percentage & Fixed-with-Quota)
   ═══════════════════════════════════════════════════════════════════════════ */
const makeFixedResolver = async (pool, rebateCode, customerCodes) => {
  const ph = customerCodes.map((_, i) => `@CardCode${i}`).join(',');

  const req = pool.request().input('rc', rebateCode);
  customerCodes.forEach((c, i) => req.input(`CardCode${i}`, c));

  const res = await req.query(`
    SELECT T1.CardCode, T2.ItemCode, T2.ItemName, T2.RebatePerBag
    FROM   FixCustRebate T1
    INNER JOIN FixProdRebate T2 ON T1.RebateCode = T2.RebateCode
    WHERE  T1.RebateCode = @rc
      AND  T1.CardCode IN (${ph})
      AND  T2.RebatePerBag IS NOT NULL
      AND  T2.RebatePerBag <> 0
  `);

  console.log(`[Nexchem][fixed] rate rows=${res.recordset.length}`);
  if (res.recordset.length) {
    console.log(`[Nexchem][fixed] sample:`, res.recordset.slice(0, 3));
  }

  const map = {};
  res.recordset.forEach(r => {
    if (!map[r.CardCode]) map[r.CardCode] = {};
    map[r.CardCode][r.ItemCode] = {
      rate:     toNum(r.RebatePerBag),
      itemName: r.ItemName,
    };
  });

  return (row) => {
    const cust = map[row.CardCode];
    if (!cust) return null;
    const info = cust[row.ItemCode];
    if (!info || info.rate <= 0) return null;
    const qty = toNum(row.Quantity);
    return {
      rate:     info.rate,
      itemName: info.itemName,
      total:    qty * info.rate,
    };
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   RESOLVER — INCREMENTAL
   ═══════════════════════════════════════════════════════════════════════════ */
const makeIncrementalResolver = async (pool, rebateCode, customerCodes) => {
  const ph = customerCodes.map((_, i) => `@CardCode${i}`).join(',');

  /* 1. Customers in IncCustRebate (need Id) */
  const custReq = pool.request().input('rc', rebateCode);
  customerCodes.forEach((c, i) => custReq.input(`CardCode${i}`, c));

  const custRes = await custReq.query(`
    SELECT Id, CardCode, CardName
    FROM   IncCustRebate
    WHERE  RebateCode = @rc
      AND  CardCode IN (${ph})
  `);

  console.log(`[Nexchem][incremental] customer rows=${custRes.recordset.length}`);
  console.log(`[Nexchem][incremental] customers:`, custRes.recordset);

  const custIdByCard = {};
  const custIds = [];
  custRes.recordset.forEach(r => {
    custIdByCard[r.CardCode] = r.Id;
    custIds.push(r.Id);
  });

  if (!custIds.length) {
    console.warn('[Nexchem][incremental] no customers matched — returning empty resolver');
    return () => null;
  }

  /* 2. Tiers per customer Id */
  const rangeReq = pool.request();
  custIds.forEach((id, i) => rangeReq.input(`id${i}`, id));

  const rangeRes = await rangeReq.query(`
    SELECT IncCustRebateId, RangeNo, MinQty, MaxQty, RebatePerBag
    FROM   IncCustRange
    WHERE  IncCustRebateId IN (${custIds.map((_, i) => `@id${i}`).join(',')})
    ORDER BY IncCustRebateId, MinQty
  `);

  console.log(`[Nexchem][incremental] tier rows=${rangeRes.recordset.length}`);
  console.log(`[Nexchem][incremental] tiers:`, rangeRes.recordset);

  const rangesByCustId = {};
  rangeRes.recordset.forEach(r => {
    const id = r.IncCustRebateId;
    if (!rangesByCustId[id]) rangesByCustId[id] = [];
    rangesByCustId[id].push({
      min:  toNum(r.MinQty),
      max:  toNum(r.MaxQty),   // 0 → treat as open-ended
      rate: toNum(r.RebatePerBag),
    });
  });

  /* 3. Eligible items */
  const itemRes = await pool.request().input('rc', rebateCode).query(`
    SELECT ItemCode, ItemName FROM IncItemRebate WHERE RebateCode = @rc
  `);

  const itemMap = {};
  itemRes.recordset.forEach(r => { itemMap[r.ItemCode] = r.ItemName; });

  console.log(`[Nexchem][incremental] eligible items=${Object.keys(itemMap).length}`);
  console.log(`[Nexchem][incremental] items:`, itemRes.recordset);

  /* 4. Tier lookup — FIXED: a range with MinQty=0 and MaxQty=0 no longer eats everything */
  const findTier = (ranges, qty) => {
    if (!ranges || !ranges.length) return null;

    // Prefer a range that strictly contains qty (MaxQty > 0)
    const closed = ranges
      .filter(r => r.max > 0)
      .sort((a, b) => a.min - b.min);
    for (const r of closed) {
      if (qty >= r.min && qty <= r.max) return r;
    }

    // Otherwise — open-ended ranges (MaxQty = 0 / NULL): pick highest Min ≤ qty
    const open = ranges
      .filter(r => !(r.max > 0))
      .sort((a, b) => b.min - a.min);
    for (const r of open) {
      if (qty >= r.min) return r;
    }

    // Fallback — highest tier we have
    const all = [...ranges].sort((a, b) => b.min - a.min);
    return all[0] || null;
  };

  return (row) => {
    const custId = custIdByCard[row.CardCode];
    if (!custId) return null;
    if (!itemMap[row.ItemCode]) return null;

    const qty  = toNum(row.Quantity);
    const tier = findTier(rangesByCustId[custId], qty);
    if (!tier || tier.rate <= 0) return null;

    return {
      rate:     tier.rate,
      itemName: itemMap[row.ItemCode],
      total:    qty * tier.rate,
    };
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   REPORT BUILDER
   ═══════════════════════════════════════════════════════════════════════════ */
const buildReport = async ({ customerCodes, dateFrom, dateTo, rebateCode }) => {
  console.log(
    `[Nexchem] buildReport | rebateCode=${rebateCode} | ` +
    `customers=${customerCodes?.length} | dateFrom=${dateFrom} | dateTo=${dateTo}`
  );

  if (!rebateCode) throw new Error('rebateCode is required (missing on the request body)');
  if (!customerCodes || !customerCodes.length)
    throw new Error('At least one customer is required');

  const sapPool = getPool('NEXCHEM');
  const ownPool = getPool('NEXCHEM');

  const meta = await getRebateProgramMeta(ownPool, rebateCode);
  if (!meta) throw new Error(`Rebate code "${rebateCode}" not found in RebateProgram`);

  const key   = typeKeyFrom(meta.RebateType);
  const label = labelFromType(meta.RebateType);

  console.log(
    `[Nexchem] resolved | code=${rebateCode} | rawType=${meta.RebateType} | ` +
    `key=${key} | label=${label}`
  );

  const getRateForRow = key === 'incremental'
    ? await makeIncrementalResolver(ownPool, rebateCode, customerCodes)
    : await makeFixedResolver(ownPool, rebateCode, customerCodes);

  const invRes = await fetchInvoiceLines(sapPool, customerCodes, dateFrom, dateTo);
  console.log(`[Nexchem] invoice lines fetched=${invRes.recordset.length}`);
  if (invRes.recordset.length === 0) {
    console.warn('[Nexchem] no invoice lines — check date range and customer codes');
    return [];
  }

  const grouped = {};
  let matched = 0;

  invRes.recordset.forEach(row => {
    const docNum   = row.DocNum;
    const cardCode = row.CardCode;

    const resolved = getRateForRow(row);
    if (!resolved || resolved.rate <= 0) return;
    matched++;

    if (!grouped[docNum]) {
      grouped[docNum] = {
        id:           docNum.toString(),
        docDate:      row.DocDate,
        customerCode: cardCode,
        customerName: row.CardName,
        cardCode,
        cardName:     row.CardName,
        items:        [],
      };
    }

    grouped[docNum].items.push({
      name:          row.Dscription || resolved.itemName || row.ItemCode,
      itemCode:      row.ItemCode,
      qty:           toNum(row.Quantity),
      sales_amt:     toNum(row.LineTotal),
      kitanex:       resolved.rate,
      total_kitanex: resolved.total,
    });
  });

  console.log(`[Nexchem] matched lines=${matched} / ${invRes.recordset.length}`);

  const reportData = Object.values(grouped)
    .filter(g => g.items.length > 0)
    .sort((a, b) => new Date(a.docDate) - new Date(b.docDate));

  console.log(
    `[Nexchem] report ready | type=${label} | docs=${reportData.length} | ` +
    `lines=${reportData.reduce((s, g) => s + g.items.length, 0)}`
  );

  return reportData;
};

/* ─── PUBLIC GENERATORS ───────────────────────────────────────────────────── */
export const generateReport = async ({ selectedCustomer, dateFrom, dateTo, rebateCode }) => {
  if (!selectedCustomer) throw new Error('Customer is required');
  return buildReport({ customerCodes: [selectedCustomer], dateFrom, dateTo, rebateCode });
};

export const generateMultiCustomerReport = async (payload) => {
  // Accept either explicit destructure or the raw body — either way rebateCode flows through.
  const { customerCodes, dateFrom, dateTo, rebateCode } = payload || {};
  return buildReport({ customerCodes, dateFrom, dateTo, rebateCode });
};

/* ─── DIAGNOSTIC ──────────────────────────────────────────────────────────── */
export const diagnoseRebate = async (rebateCode) => {
  const pool = getPool('NEXCHEM');
  const meta = await getRebateProgramMeta(pool, rebateCode);
  const q = async (sql, extra = {}) => {
    try {
      const req = pool.request().input('rc', rebateCode);
      Object.entries(extra).forEach(([k, v]) => req.input(k, v));
      const r = await req.query(sql);
      return r.recordset[0]?.n ?? 0;
    } catch (e) { return `ERR: ${e.message}`; }
  };
  const out = {
    rebateCode,
    meta: meta || null,
    counts: {
      FixCust:   await q(`SELECT COUNT(*) n FROM FixCustRebate WHERE RebateCode=@rc`),
      FixProd:   await q(`SELECT COUNT(*) n FROM FixProdRebate WHERE RebateCode=@rc`),
      IncCust:   await q(`SELECT COUNT(*) n FROM IncCustRebate WHERE RebateCode=@rc`),
      IncItem:   await q(`SELECT COUNT(*) n FROM IncItemRebate WHERE RebateCode=@rc`),
      IncRanges: await q(`
        SELECT COUNT(*) n FROM IncCustRange c
        JOIN   IncCustRebate ic ON ic.Id = c.IncCustRebateId
        WHERE  ic.RebateCode = @rc
      `),
    },
  };
  console.log('[Nexchem][diag]', JSON.stringify(out, null, 2));
  return out;
};