// Van_reportService.js
import sql from 'mssql';
import { getPool } from '../services/databaseService.js';

// ─── Quarter helpers ───────────────────────────────────────────────────────────
export const getQuarterFromDate = (dateStr) => {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year  = d.getFullYear();
  return { quarter: Math.ceil(month / 3), year, month };
};

export const getPreviousQuarter = (quarter, year) =>
  quarter === 1 ? { quarter: 4, year: year - 1 } : { quarter: quarter - 1, year };

export const getQuarterDateRange = (quarter, year) => {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth   = quarter * 3;
  const endDay     = new Date(year, endMonth, 0).getDate();
  return {
    startDate: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    endDate:   `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
  };
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const QTR_NAMES   = ['1ST QUARTER','2ND QUARTER','3RD QUARTER','4TH QUARTER'];
const QTR_RANGES  = ['JAN - MAR','APR - JUN','JUL - SEP','OCT - DEC'];

export const getQuarterDisplayName = (quarter, year) =>
  `${QTR_NAMES[quarter - 1]} ${year} (${QTR_RANGES[quarter - 1]})`;

export const getPrevQuarterDisplayName = (quarter, year) => {
  const prev = getPreviousQuarter(quarter, year);
  const startM = (prev.quarter - 1) * 3;
  const endM   = prev.quarter * 3 - 1;
  return `${MONTH_NAMES[startM].substring(0,3).toUpperCase()} - ${MONTH_NAMES[endM].substring(0,3).toUpperCase()} ${prev.year}`;
};

export const getQuarterMonths = (quarter, year) => {
  const start = (quarter - 1) * 3;
  return [start, start + 1, start + 2].map(mi => ({
    name:  MONTH_NAMES[mi],
    short: MONTH_SHORT[mi],
    month: mi + 1,
    year,
  }));
};

// ─── SAP actual sales fetch (with ARCM returns) ────────────────────────────────
const fetchActualSales = async (sapPool, cardCode, itemCodes, startDate, endDate) => {
  if (!itemCodes.length) return {};
  const paramNames = itemCodes.map((_, i) => `@item${i}`).join(', ');
  const q = `
    SELECT
      MONTH(T0.DocDate) AS Month,
      T0.ItemCode,
      SUM(T0.Quantity) AS TotalQty
    FROM OINV T0
    WHERE T0.CardCode = @cardCode
      AND T0.DocType  = 'I'
      AND T0.DocDate >= @startDate
      AND T0.DocDate <= @endDate
      AND T0.ItemCode IN (${paramNames})
    GROUP BY MONTH(T0.DocDate), T0.ItemCode
  `;
  const req = sapPool.request()
    .input('cardCode',  sql.NVarChar(50), cardCode)
    .input('startDate', sql.Date, startDate)
    .input('endDate',   sql.Date, endDate);
  itemCodes.forEach((c, i) => req.input(`item${i}`, sql.NVarChar(50), c));
  try {
    const res = await req.query(q);
    const map = {};
    res.recordset.forEach(r => { map[`${r.Month}_${r.ItemCode}`] = r.TotalQty || 0; });
    return map;
  } catch (e) {
    console.error('fetchActualSales error:', e.message);
    return {};
  }
};

const fetchActualSalesWithARCM = async (sapPool, cardCode, itemCodes, startDate, endDate) => {
  const sales = await fetchActualSales(sapPool, cardCode, itemCodes, startDate, endDate);
  if (!itemCodes.length) return sales;
  const paramNames = itemCodes.map((_, i) => `@ritem${i}`).join(', ');
  const rq = `
    SELECT
      MONTH(T0.DocDate) AS Month,
      T0.ItemCode,
      SUM(ABS(T0.Quantity)) AS ReturnQty
    FROM ORIN T0
    WHERE T0.CardCode = @cardCode
      AND T0.DocDate >= @startDate
      AND T0.DocDate <= @endDate
      AND T0.ItemCode IN (${paramNames})
    GROUP BY MONTH(T0.DocDate), T0.ItemCode
  `;
  const req = sapPool.request()
    .input('cardCode',  sql.NVarChar(50), cardCode)
    .input('startDate', sql.Date, startDate)
    .input('endDate',   sql.Date, endDate);
  itemCodes.forEach((c, i) => req.input(`ritem${i}`, sql.NVarChar(50), c));
  try {
    const res = await req.query(rq);
    res.recordset.forEach(r => {
      const key = `${r.Month}_${r.ItemCode}`;
      sales[key] = Math.max(0, (sales[key] || 0) - (r.ReturnQty || 0));
    });
  } catch (e) { /* ignore ARCM errors */ }
  return sales;
};

// ─── Get available rebates for selector ───────────────────────────────────────
export const getAvailableRebates = async (db = 'VAN') => {
  const pool = getPool(db);
  if (!pool) throw new Error('Database pool not available');
  const q = `
    SELECT RebateCode, RebateType, SlpName, DateFrom, DateTo, IsActive, Name, Frequency
    FROM RebateProgram
    ORDER BY CreatedDate DESC
  `;
  const res = await pool.request().query(q);
  return res.recordset.map(r => ({
    rebateCode:    r.RebateCode,
    rebateType:    r.RebateType,
    salesEmployee: r.SlpName || '',
    dateFrom:      r.DateFrom ? new Date(r.DateFrom).toISOString().split('T')[0] : '',
    dateTo:        r.DateTo   ? new Date(r.DateTo).toISOString().split('T')[0]   : '',
    isActive:      r.IsActive === 1,
    name:          r.Name || r.RebateCode,
    frequency:     r.Frequency || 'Quarterly',
  }));
};

// ─── Core report generation (aggregated items) ────────────────────────────────
export const generateRebateReport = async (rebateCodes, db = 'VAN') => {
  const ownPool = getPool(db);
  const sapPool = getPool('VAN');
  if (!ownPool || !sapPool) throw new Error('Database pools not available');

  const reportSections = [];

  for (const rebateCode of rebateCodes) {
    // ── 1. Rebate program info ────────────────────────────────────────────────
    const infoResult = await ownPool.request()
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(`SELECT RebateCode,RebateType,SlpName,DateFrom,DateTo,IsActive,Frequency,QuotaType,Name
              FROM RebateProgram WHERE RebateCode=@rc`);
    if (!infoResult.recordset.length) continue;

    const rp       = infoResult.recordset[0];
    const dateFrom = rp.DateFrom ? new Date(rp.DateFrom).toISOString().split('T')[0] : null;
    const dateTo   = rp.DateTo   ? new Date(rp.DateTo).toISOString().split('T')[0]   : null;
    if (!dateFrom || !dateTo) continue;

    const { quarter, year }  = getQuarterFromDate(dateFrom);
    const prevQ              = getPreviousQuarter(quarter, year);
    const quarterMonths      = getQuarterMonths(quarter, year);
    const prevQRange         = getQuarterDateRange(prevQ.quarter, prevQ.year);
    const prevQMonths        = getQuarterMonths(prevQ.quarter, prevQ.year);

    // ── 2. Fetch customers and original items, then aggregate ─────────────────
    let customers = [];
    let items     = [];
    let ranges    = []; // for incremental
    let originalItemCodes = []; // store all distinct item codes for sales fetch

    if (rp.RebateType === 'Fixed') {
      // Fetch customers with monthly quotas
      const cr = await ownPool.request().input('rc', sql.NVarChar(50), rebateCode).query(`
        SELECT T1.CardCode,T1.CardName,T1.QtrRebate,T2.Id AS qid,T2.Month,T2.TargetQty
        FROM FixCustRebate T1 LEFT JOIN FixCustQuota T2 ON T1.Id=T2.CustRebateId
        WHERE T1.RebateCode=@rc ORDER BY T1.CardName,T2.Id`);
      
      // Fetch product items
      const ir = await ownPool.request().input('rc', sql.NVarChar(50), rebateCode).query(`
        SELECT 
            ItemCode,
            MAX(ItemName) AS ItemName,
            MAX(UnitPerQty) AS UnitPerQty,
            MAX(RebatePerBag) AS RebatePerBag
        FROM FixProdRebate
        WHERE RebateCode = @rc
        GROUP BY ItemCode
        ORDER BY MAX(ItemName)`);
      
      // Collect original item codes for sales fetching
      originalItemCodes = [...new Set(ir.recordset.map(row => row.ItemCode))];
      
      // Build aggregated item (single virtual product)
      const aggregatedItem = {
        ItemCode: 'ALL_ITEMS',
        label: (rp.Name || rp.RebateCode).toUpperCase(),
        UnitPerQty: 1,
        RebatePerBag: ir.recordset[0]?.RebatePerBag || 0,
      };
      items = [aggregatedItem];
      
      // Process customers
      const cm = new Map();
      cr.recordset.forEach(row => {
        if (!row.CardCode) return;
        if (!cm.has(row.CardCode)) cm.set(row.CardCode, { cardCode:row.CardCode, cardName:row.CardName, qtrRebate:row.QtrRebate||0, quotas:[] });
        if (row.qid) cm.get(row.CardCode).quotas.push({ id:row.qid, month:row.Month, targetQty:row.TargetQty||0 });
      });
      customers = Array.from(cm.values()).map(c => ({ ...c, quotas: c.quotas.sort((a,b)=>a.id-b.id) }));

    } else if (rp.RebateType === 'Incremental') {
      const cr = await ownPool.request().input('rc', sql.NVarChar(50), rebateCode).query(`
        SELECT T1.CardCode,T1.CardName,T1.QtrRebate,T2.RangeNo,T2.MinQty,T2.MaxQty,T2.RebatePerBag
        FROM IncCustRebate T1 LEFT JOIN IncCustRange T2 ON T1.Id=T2.IncCustRebateId
        WHERE T1.RebateCode=@rc ORDER BY T1.CardName,T2.RangeNo`);
      
      const ir = await ownPool.request().input('rc', sql.NVarChar(50), rebateCode).query(`
        SELECT T3.ItemCode,T3.ItemName,T3.UnitPerQty,T4.RangeNo,T4.MinQty,T4.MaxQty,T4.RebatePerBag
        FROM IncItemRebate T3 LEFT JOIN IncItemRange T4 ON T3.Id=T4.ItemRebateId
        WHERE T3.RebateCode=@rc ORDER BY T3.ItemName,T4.RangeNo`);
      
      // Collect original item codes
      originalItemCodes = [...new Set(ir.recordset.map(row => row.ItemCode))];
      
      // Build global ranges from item ranges
      const rangeMap = new Map();
      ir.recordset.forEach(r => {
        if (r.RangeNo && !rangeMap.has(r.RangeNo))
          rangeMap.set(r.RangeNo, { rangeNo:r.RangeNo, minQty:r.MinQty||0, maxQty:r.MaxQty||0, rebatePerBag:r.RebatePerBag||0 });
      });
      ranges = [...rangeMap.values()].sort((a,b) => a.rangeNo - b.rangeNo);
      
      // Build aggregated item (single virtual product)
      const aggregatedItem = {
        ItemCode: 'ALL_ITEMS',
        label: (rp.Name || rp.RebateCode).toUpperCase(),
        ranges: ranges,
      };
      items = [aggregatedItem];
      
      // Process customers with their ranges
      const cm = new Map();
      cr.recordset.forEach(row => {
        if (!row.CardCode) return;
        if (!cm.has(row.CardCode)) cm.set(row.CardCode, { cardCode:row.CardCode, cardName:row.CardName, qtrRebate:row.QtrRebate||0, ranges:[] });
        if (row.RangeNo) cm.get(row.CardCode).ranges.push({ rangeNo:row.RangeNo, minQty:row.MinQty||0, maxQty:row.MaxQty||0, rebatePerBag:row.RebatePerBag||0 });
      });
      customers = Array.from(cm.values());

    } else if (rp.RebateType === 'Percentage') {
      const cr = await ownPool.request().input('rc', sql.NVarChar(50), rebateCode).query(`
        SELECT T1.CardCode,T1.CardName,T1.QtrRebate,T2.Id AS qid,T2.Month,T2.TargetQty
        FROM PerCustRebate T1 LEFT JOIN PerCustQuota T2 ON T1.Id=T2.PerCustRebateId
        WHERE T1.RebateCode=@rc ORDER BY T1.CardName,T2.Id`);
      
      const ir = await ownPool.request().input('rc', sql.NVarChar(50), rebateCode).query(`
        SELECT ItemCode,ItemName,UnitPerQty,PercentagePerBag FROM PerProdRebate WHERE RebateCode=@rc ORDER BY ItemName`);
      
      originalItemCodes = [...new Set(ir.recordset.map(row => row.ItemCode))];
      
      const aggregatedItem = {
        ItemCode: 'ALL_ITEMS',
        label: (rp.Name || rp.RebateCode).toUpperCase(),
        UnitPerQty: 1,
        PercentagePerBag: ir.recordset[0]?.PercentagePerBag || 0,
      };
      items = [aggregatedItem];
      
      const cm = new Map();
      cr.recordset.forEach(row => {
        if (!row.CardCode) return;
        if (!cm.has(row.CardCode)) cm.set(row.CardCode, { cardCode:row.CardCode, cardName:row.CardName, qtrRebate:row.QtrRebate||0, quotas:[] });
        if (row.qid) cm.get(row.CardCode).quotas.push({ id:row.qid, month:row.Month, targetQty:row.TargetQty||0 });
      });
      customers = Array.from(cm.values()).map(c => ({ ...c, quotas: c.quotas.sort((a,b)=>a.id-b.id) }));
    }

    // ── 3. Per-customer sales data using original item codes ──────────────────
    const customerRows = [];

    for (const cust of customers) {
      // Current quarter actuals (all items combined)
      const curSales = await fetchActualSalesWithARCM(sapPool, cust.cardCode, originalItemCodes, dateFrom, dateTo);
      // Previous quarter totals for 3-month average
      const prevSales = await fetchActualSalesWithARCM(sapPool, cust.cardCode, originalItemCodes, prevQRange.startDate, prevQRange.endDate);

      // Monthly actual totals (summed across all original items)
      const monthlyActuals = quarterMonths.map(qm => {
        const qty = originalItemCodes.reduce((s, ic) => s + (curSales[`${qm.month}_${ic}`] || 0), 0);
        return { month: qm.month, monthName: qm.name, short: qm.short, qty };
      });

      // Previous quarter average (all items, all 3 months)
      const prevTotalQty = originalItemCodes.reduce((s, ic) => {
        return s + prevQMonths.reduce((ms, qm) => ms + (prevSales[`${qm.month}_${ic}`] || 0), 0);
      }, 0);
      const prevAvg = Math.round(prevTotalQty / 3);

      // Quarter total actual
      const qtrActual = monthlyActuals.reduce((s, m) => s + m.qty, 0);

      // Payout data from PayoutHistory
      let payoutRows = [];
      try {
        const pr = await ownPool.request()
          .input('cc', sql.NVarChar(50), cust.cardCode)
          .input('rc', sql.NVarChar(50), rebateCode)
          .query(`SELECT Period,BaseAmount,TotalAmount,AmountReleased,RebateBalance,Status,PayoutQuarter
                  FROM PayoutHistory
                  WHERE CardCode=@cc AND RebateCode=@rc AND Period NOT LIKE 'Balance of Q%'
                  ORDER BY PayoutDate ASC`);
        payoutRows = pr.recordset;
      } catch { /* ignore */ }

      const qtrLabel = `Q${quarter} ${year}`;
      const qtrPayouts = payoutRows.filter(p => p.PayoutQuarter === qtrLabel);
      const totalBase    = qtrPayouts.reduce((s,p) => s + (parseFloat(p.BaseAmount)||0), 0);
      const totalAmount  = qtrPayouts.reduce((s,p) => s + (parseFloat(p.TotalAmount)||0), 0);
      const totalReleased = qtrPayouts.reduce((s,p) => s + (parseFloat(p.AmountReleased)||0), 0);

      // Incremental: find current range based on total quarter actual
      let currentRange = null;
      if (rp.RebateType === 'Incremental') {
        const custRanges = [...(cust.ranges || [])].sort((a,b) => a.minQty - b.minQty);
        for (const r of custRanges) {
          if (qtrActual >= r.minQty && (!r.maxQty || r.maxQty === 0 || qtrActual <= r.maxQty)) {
            currentRange = r; break;
          }
        }
        if (!currentRange && ranges.length) {
          const globalRanges = [...ranges].sort((a,b) => a.minQty - b.minQty);
          for (const r of globalRanges) {
            if (qtrActual >= r.minQty && (!r.maxQty || r.maxQty === 0 || qtrActual <= r.maxQty)) {
              currentRange = r; break;
            }
          }
        }
      }

      // Monthly quotas for Fixed/Percentage (already totals per month from DB)
      const monthlyQuotas = quarterMonths.map((qm, idx) => {
        const q = cust.quotas ? cust.quotas[idx] : null;
        return { month: qm.month, monthName: qm.name, short: qm.short, targetQty: q?.targetQty || 0 };
      });

      // Calculate amount for display
      let displayAmount = totalBase || totalAmount;
      if (!displayAmount && currentRange) {
        displayAmount = qtrActual * currentRange.rebatePerBag;
      } else if (!displayAmount && rp.RebateType === 'Fixed' && items[0]?.RebatePerBag) {
        displayAmount = qtrActual * items[0].RebatePerBag;
      } else if (!displayAmount && rp.RebateType === 'Percentage' && items[0]?.PercentagePerBag) {
        displayAmount = qtrActual * (items[0].PercentagePerBag / 100);
      }

      customerRows.push({
        cardCode:      cust.cardCode,
        cardName:      cust.cardName,
        qtrRebate:     cust.qtrRebate || 0,
        prevAvg,
        monthlyQuotas,
        monthlyActuals,
        qtrActual,
        currentRange,
        custRanges:    cust.ranges || [],
        displayAmount,
        totalReleased,
        payoutRows: qtrPayouts,
      });
    }

    // ── 4. Build tag/label for the aggregated item ────────────────────────────
    const buildItemLabel = (item) => {
      if (rp.RebateType === 'Fixed') {
        const rate = item.RebatePerBag || 0;
        const uom  = item.UnitPerQty > 1 ? `${item.UnitPerQty}KLS` : '50KLS';
        return `${(rp.Name || rp.RebateCode).toUpperCase()} @ ₱${rate}/BAG`;
      }
      if (rp.RebateType === 'Incremental') {
        return (rp.Name || rp.RebateCode).toUpperCase();
      }
      const pct = item.PercentagePerBag || 0;
      return `${(rp.Name || rp.RebateCode).toUpperCase()} @ ${pct}%`;
    };

    // Apply the label to the aggregated item
    if (items[0]) items[0].label = buildItemLabel(items[0]);

    reportSections.push({
      rebateCode:       rp.RebateCode,
      rebateName:       rp.Name || rp.RebateCode,
      rebateType:       rp.RebateType,
      salesEmployee:    rp.SlpName || '',
      dateFrom,
      dateTo,
      quarter,
      year,
      quarterDisplay:   getQuarterDisplayName(quarter, year),
      prevQDisplay:     getPrevQuarterDisplayName(quarter, year),
      quarterMonths,
      prevQMonths,
      customers:        customerRows,
      items,            // now contains exactly one item (aggregated)
      ranges,           // for incremental: global ranges
      frequency:        rp.Frequency || 'Quarterly',
    });
  }

  return reportSections;
};