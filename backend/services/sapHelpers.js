import sql from 'mssql';
import { getPool } from './databaseService.js';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const toPeriodMeta = (date) => {
  const d     = new Date(date);
  const year  = d.getFullYear();
  const month = d.getMonth() + 1;
  return {
    year,
    month,
    periodKey  : `${year}-${String(month).padStart(2, '0')}`,
    periodName : `${MONTH_NAMES[month - 1]} ${year}`,
  };
};

const makeBucket = ({ periodKey, periodName, year, month }) => ({
  periodKey,
  periodName,
  year,
  month,
  totalAmount     : 0,
  arcmDeduction   : 0,
  entries         : [],
  transactionIds  : new Set(),
  sourceBreakdown : { JE: 0, AR: 0, AP: 0, ARCM: 0, APCM: 0 },
});


export const getAllRebateProgramsForCustomer = async (
  customerCode,
  currentRebateCode,
  pool
) => {
  try {
    // Get the frequency / type of the current rebate so we only
    // look at sibling programs (same frequency = same "family").
    const metaResult = await pool.request()
      .input('rc', sql.NVarChar(50), currentRebateCode)
      .query(`
        SELECT RebateCode, RebateType, Frequency,
               DateFrom, DateTo, IsActive
        FROM RebateProgram
        WHERE RebateCode = @rc
      `);
 
    if (metaResult.recordset.length === 0) return [];
 
    const { RebateType, Frequency } = metaResult.recordset[0];
 
    // Find all rebate codes for this customer that share
    // the same type and frequency.
    const siblingsResult = await pool.request()
      .input('customerCode', sql.NVarChar(50), customerCode)
      .input('rebateType',   sql.NVarChar(50), RebateType)
      .input('frequency',    sql.NVarChar(50), Frequency)
      .query(`
        SELECT DISTINCT rp.RebateCode, rp.DateFrom, rp.DateTo,
                        rp.IsActive,   rp.RebateType, rp.Frequency
        FROM RebateProgram rp
        WHERE rp.RebateType = @rebateType
          AND rp.Frequency  = @frequency
          AND EXISTS (
            SELECT 1 FROM PayoutHistory ph
            WHERE ph.CardCode   = @customerCode
              AND ph.RebateCode = rp.RebateCode
          )
        ORDER BY rp.DateFrom ASC
      `);
 
    return siblingsResult.recordset;
  } catch (err) {
    console.error('❌ [RESOLVER] getAllRebateProgramsForCustomer:', err.message);
    return [];
  }
};

export const resolveDocDateToRebateProgram = (docDate, programs) => {
  if (!programs || programs.length === 0) return null;
 
  const date   = new Date(docDate);
  date.setHours(12, 0, 0, 0); // normalise to noon to avoid TZ edge cases
 
  // Sort ascending by DateFrom
  const sorted = [...programs].sort(
    (a, b) => new Date(a.DateFrom) - new Date(b.DateFrom)
  );
 
  // ── 1. Exact match ───────────────────────────────────────────
  for (const prog of sorted) {
    const from = new Date(prog.DateFrom);
    const to   = new Date(prog.DateTo);
    from.setHours(0,  0,  0,   0);
    to.setHours(23, 59, 59, 999);
    if (date >= from && date <= to) {
      return { ...prog, matchType: 'exact' };
    }
  }
 
  // ── 2. Before the first program ──────────────────────────────
  const firstFrom = new Date(sorted[0].DateFrom);
  firstFrom.setHours(0, 0, 0, 0);
  if (date < firstFrom) {
    return { ...sorted[0], matchType: 'before_first' };
  }
 
  // ── 3. After the last program ────────────────────────────────
  const lastTo = new Date(sorted[sorted.length - 1].DateTo);
  lastTo.setHours(23, 59, 59, 999);
  if (date > lastTo) {
    return { ...sorted[sorted.length - 1], matchType: 'after_last' };
  }
 
  // ── 4. Falls in a gap between two programs ───────────────────
  //       Assign to the program that ended most recently.
  for (let i = 0; i < sorted.length - 1; i++) {
    const curEnd   = new Date(sorted[i].DateTo);
    const nextStart = new Date(sorted[i + 1].DateFrom);
    curEnd.setHours(23, 59, 59, 999);
    nextStart.setHours(0, 0, 0, 0);
 
    if (date > curEnd && date < nextStart) {
      // Prefer the previous program (just ended) unless the next
      // program starts within 15 days — in that case prefer the
      // upcoming one (the employee likely meant it for the new cycle).
      const daysToNext = (nextStart - date) / (1000 * 60 * 60 * 24);
      const resolved   = daysToNext <= 15 ? sorted[i + 1] : sorted[i];
      return {
        ...resolved,
        matchType: daysToNext <= 15 ? 'gap_next' : 'gap_previous',
      };
    }
  }
 
  // Fallback
  return { ...sorted[sorted.length - 1], matchType: 'fallback' };
};


export const fetchAllSAPTransactionsForCustomer = async (customerCode) => {
  try {
    const sapPool = getPool('NEXCHEM');
    if (!sapPool) {
      console.log('⚠️ [SAP-UNIVERSAL] SAP pool not available');
      return { success: false, rows: [] };
    }
 
    // ── JE ────────────────────────────────────────────────────
    const jeQuery = `
      SELECT 'JE' AS SourceType,
             BP.ShortName  AS CardCode, OCRD.CardName,
             T0.RefDate    AS DocDate,
             T0.TransId    AS DocNum,  NULL AS BaseRef,
             T1.Account,  T3.AcctName,
             T1.Debit,    T1.Credit,
             T0.Memo,     T1.LineMemo,
             T0.RefDate
      FROM OJDT T0
      INNER JOIN JDT1 T1 ON T0.TransId = T1.TransId
      INNER JOIN JDT1 BP ON T0.TransId = BP.TransId
        AND BP.ShortName IN (SELECT CardCode FROM OCRD)
      LEFT JOIN OCRD    ON BP.ShortName = OCRD.CardCode
      LEFT JOIN OACT T3 ON T1.Account  = T3.AcctCode
      WHERE BP.ShortName   = @customerCode
        AND T3.AcctName LIKE '%Rebate%'
    `;
 
    // ── AR ────────────────────────────────────────────────────
    const arQuery = `
      SELECT 'AR' AS SourceType,
             AR_INV.CardCode, AR_INV.CardName,
             AR_INV.DocDate,  AR_INV.DocNum,
             AR_JDT.BaseRef,  AR_LN.Account,
             AR_ACCT.AcctName,
             AR_LN.Debit,     AR_LN.Credit,
             AR_INV.Comments AS Memo, NULL AS LineMemo,
             AR_INV.DocDate  AS RefDate
      FROM OINV AR_INV
      LEFT JOIN OJDT AR_JDT ON AR_JDT.BaseRef = CAST(AR_INV.DocNum AS NVARCHAR)
      LEFT JOIN JDT1 AR_LN  ON AR_LN.TransId  = AR_JDT.TransId
      LEFT JOIN OACT AR_ACCT ON AR_ACCT.AcctCode = AR_LN.Account
                             AND AR_ACCT.AcctName LIKE '%Rebate%'
      WHERE AR_INV.CardCode = @customerCode
        AND AR_ACCT.AcctName IS NOT NULL
    `;
 
    // ── AP ────────────────────────────────────────────────────
    const apQuery = `
      SELECT 'AP' AS SourceType,
             T0.U_BP_Code AS CardCode,
             T1.AcctCode,
             T0.DocDate,  T1.LineTotal
      FROM OPCH T0
      LEFT JOIN PCH1 T1 ON T0.DocEntry = T1.DocEntry
      WHERE T1.AcctCode    = '611902'
        AND T0.U_BP_Code   = @customerCode
    `;
 
    // ── ARCM ──────────────────────────────────────────────────
    const arcmQuery = `
      SELECT 'ARCM' AS SourceType,
             T0.CardCode, T0.CardName,
             T0.DocDate,  T0.DocNum, T0.DocEntry,
             T1.ItemCode, T1.GTotal
      FROM ORIN T0
      INNER JOIN RIN1 T1 ON T0.DocEntry = T1.DocEntry
      WHERE T0.CardCode = @customerCode
        AND T1.ItemCode = 'NT-0018'
    `;
 
    // ── APCM ──────────────────────────────────────────────────
    const apcmQuery = `
      SELECT 'APCM' AS SourceType,
             T0.U_BP_Code AS CardCode,
             T0.DocDate,  T0.DocNum, T0.DocEntry,
             T1.GTotal
      FROM ORPC T0
      LEFT JOIN RPC1 T1 ON T0.DocEntry = T1.DocEntry
      WHERE T0.U_BP_Code = @customerCode
    `;
 
    const [jeR, arR, apR, arcmR, apcmR] = await Promise.all([
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode).query(jeQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode).query(arQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode).query(apQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode).query(arcmQuery),
      sapPool.request().input('customerCode', sql.NVarChar(50), customerCode).query(apcmQuery),
    ]);
 
    console.log(
      `📊 [SAP-UNIVERSAL] Raw rows — JE: ${jeR.recordset.length} | ` +
      `AR: ${arR.recordset.length} | AP: ${apR.recordset.length} | ` +
      `ARCM: ${arcmR.recordset.length} | APCM: ${apcmR.recordset.length}`
    );
 
    return {
      success : true,
      je      : jeR.recordset,
      ar      : arR.recordset,
      ap      : apR.recordset,
      arcm    : arcmR.recordset,
      apcm    : apcmR.recordset,
    };
  } catch (err) {
    console.error('❌ [SAP-UNIVERSAL] fetchAllSAPTransactionsForCustomer:', err.message);
    return { success: false, je: [], ar: [], ap: [], arcm: [], apcm: [] };
  }
};


export const universalSyncSAPToAllRebates = async (
  customerCode,
  currentRebateCode,
  pool
) => {
  try {
    console.log(
      `\n🌐 [UNIVERSAL-SYNC] Starting for ${customerCode} / ${currentRebateCode}`
    );
 
    // ── a) Fetch ALL SAP transactions ────────────────────────
    const allSAP = await fetchAllSAPTransactionsForCustomer(customerCode);
    if (!allSAP.success) {
      console.log('⚠️ [UNIVERSAL-SYNC] Could not fetch SAP transactions — aborting');
      return;
    }
 
    // ── b) Get ALL rebate programs for this customer ─────────
    const programs = await getAllRebateProgramsForCustomer(
      customerCode,
      currentRebateCode,
      pool
    );
 
    if (programs.length === 0) {
      console.log('⚠️ [UNIVERSAL-SYNC] No rebate programs found — aborting');
      return;
    }
 
    console.log(
      `📋 [UNIVERSAL-SYNC] ${programs.length} rebate program(s) in family:`,
      programs.map(p => `${p.RebateCode} (${p.DateFrom?.toISOString?.()?.slice(0,10)} → ${p.DateTo?.toISOString?.()?.slice(0,10)})`).join(' | ')
    );
 
    // ── c) Accumulate per-(rebateCode, periodKey) ─────────────
    // Structure: acc[rebateCode][periodKey] = { year, month, amount, deductions }
    const acc = {};
 
    const addToAcc = (rebateCode, docDate, netAmount) => {
      if (!rebateCode) return;
      const d     = new Date(docDate);
      const year  = d.getFullYear();
      const month = d.getMonth() + 1;
      const key   = `${year}-${String(month).padStart(2, '0')}`;
 
      if (!acc[rebateCode])       acc[rebateCode] = {};
      if (!acc[rebateCode][key])  acc[rebateCode][key] = { year, month, amount: 0, rowCount: 0 };
 
      acc[rebateCode][key].amount   += netAmount;
      acc[rebateCode][key].rowCount += 1;
    };
 
    // Helper: resolve + accumulate
    const resolveAndAdd = (docDate, netAmount) => {
      if (!docDate) return;
      const resolved = resolveDocDateToRebateProgram(docDate, programs);
      if (!resolved) return;
      console.log(
        `  → DocDate ${new Date(docDate).toISOString().slice(0,10)} ` +
        `(net ₱${netAmount.toFixed(2)}) → ${resolved.RebateCode} [${resolved.matchType}]`
      );
      addToAcc(resolved.RebateCode, docDate, netAmount);
    };
 
    // Line-level dedup (same logic as original)
    const lineDedup = new Set();
 
    // JE + AR
    [...allSAP.je, ...allSAP.ar].forEach(row => {
      const lineKey = row.SourceType === 'JE'
        ? `JE-${row.DocNum}-${row.Account}`
        : `AR-${row.DocNum}-${row.BaseRef ?? '0'}-${row.Account}`;
      if (lineDedup.has(lineKey)) return;
      lineDedup.add(lineKey);
      const net = (parseFloat(row.Debit) || 0) - (parseFloat(row.Credit) || 0);
      resolveAndAdd(row.DocDate, net);
    });
 
    // AP
    allSAP.ap.forEach(row => {
      resolveAndAdd(row.DocDate, parseFloat(row.LineTotal) || 0);
    });
 
    // ARCM — deductions (negative)
    allSAP.arcm.forEach(row => {
      resolveAndAdd(row.DocDate, -Math.abs(parseFloat(row.GTotal) || 0));
    });
 
    // APCM — deductions (negative)
    allSAP.apcm.forEach(row => {
      resolveAndAdd(row.DocDate, -Math.abs(parseFloat(row.GTotal) || 0));
    });
 
    console.log('\n📊 [UNIVERSAL-SYNC] Accumulated totals:');
    Object.entries(acc).forEach(([rc, periods]) => {
      Object.entries(periods).forEach(([pk, data]) => {
        console.log(`  ${rc} / ${pk}: ₱${data.amount.toFixed(2)} (${data.rowCount} rows)`);
      });
    });
 
    // ── d) Sync each (rebateCode, periodKey) into PayoutHistory ─
    const MONTH_NAMES_U = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ];
 
    let updatedCount = 0;
 
    for (const [rebateCode, periods] of Object.entries(acc)) {
      for (const [periodKey, data] of Object.entries(periods)) {
        const { year, month, amount } = data;
        const monthName  = MONTH_NAMES_U[month - 1];
        const twoDigit   = String(year).slice(-2);
        const periodName = `${monthName} ${year}`;
 
        // Look for an existing PayoutHistory row for this period
        const findResult = await pool.request()
          .input('cc',      sql.NVarChar(50),  customerCode)
          .input('rc',      sql.NVarChar(50),  rebateCode)
          .input('exact',   sql.NVarChar(100), periodName)
          .input('short',   sql.NVarChar(100), `%${monthName.substring(0,3)} ${year}%`)
          .input('mpat',    sql.NVarChar(20),  `${month}.%.${twoDigit}`)
          .query(`
            SELECT Id, PayoutId, Period, PayoutDate,
                   AmountReleased, SapReleasedAmount, TotalAmount, Status
            FROM PayoutHistory
            WHERE CardCode   = @cc
              AND RebateCode = @rc
              AND PayoutId   NOT LIKE 'SAP-%'
              AND Period     NOT LIKE 'Balance of %'
              AND (
                Period    = @exact
                OR Period LIKE @short
                OR PayoutDate LIKE @mpat
              )
          `);
 
        if (findResult.recordset.length > 0) {
          // ── Update existing row ────────────────────────────
          for (const row of findResult.recordset) {
            const prev = parseFloat(row.SapReleasedAmount) || 0;
            if (Math.abs(prev - amount) <= 0.01) {
              console.log(
                `  ℹ️  [UNIVERSAL-SYNC] No change: ${rebateCode}/${periodKey} ₱${prev.toFixed(2)}`
              );
              continue;
            }
            await pool.request()
              .input('sapAmt', sql.Decimal(18, 2), amount)
              .input('id',     sql.Int,            row.Id)
              .query(`
                UPDATE PayoutHistory SET
                  AmountReleased    = @sapAmt,
                  SapReleasedAmount = @sapAmt,
                  SapLastSync       = GETDATE(),
                  UpdatedDate       = GETDATE()
                WHERE Id = @id
              `);
            updatedCount++;
            console.log(
              `  ✅ [UNIVERSAL-SYNC] Updated ${rebateCode}/${row.Period}: ₱${amount.toFixed(2)}`
            );
          }
 
          // ── Remove stale OOP rows for the same period that
          //    belonged to a different rebate code ───────────
          await cleanupStaleOOPRows(
            customerCode, rebateCode, periodKey, year, month, pool
          );
 
        } else {
          // ── No in-period row found — create / update OOP ──
          await upsertOOPRow(
            customerCode, rebateCode, periodKey,
            year, month, monthName, twoDigit,
            amount, pool
          );
          updatedCount++;
        }
      }
    }
 
    console.log(`\n✅ [UNIVERSAL-SYNC] Done — ${updatedCount} record(s) updated\n`);
  } catch (err) {
    console.error('❌ [UNIVERSAL-SYNC] universalSyncSAPToAllRebates:', err);
  }
};

const cleanupStaleOOPRows = async (
  customerCode, resolvedRebateCode, periodKey, year, month, pool
) => {
  try {
    // Find OOP rows (PayoutId LIKE 'SAP-%') for this customer + period
    // that belong to a DIFFERENT rebate code than the resolved one.
    const oopPattern = `SAP-${customerCode}-%-%${periodKey}%`;
 
    const staleResult = await pool.request()
      .input('cc',   sql.NVarChar(50),  customerCode)
      .input('rc',   sql.NVarChar(50),  resolvedRebateCode)
      .input('pat',  sql.NVarChar(200), oopPattern)
      .query(`
        SELECT Id, PayoutId, RebateCode, Period
        FROM PayoutHistory
        WHERE CardCode   = @cc
          AND PayoutId   LIKE @pat
          AND RebateCode != @rc
      `);
 
    if (staleResult.recordset.length === 0) return;
 
    for (const row of staleResult.recordset) {
      await pool.request()
        .input('id', sql.Int, row.Id)
        .query(`DELETE FROM PayoutHistory WHERE Id = @id`);
      console.log(
        `  🗑️  [CLEANUP] Removed stale OOP row ${row.PayoutId} ` +
        `(rebate ${row.RebateCode} — now covered by ${resolvedRebateCode})`
      );
    }
  } catch (err) {
    console.error('❌ [CLEANUP] cleanupStaleOOPRows:', err.message);
  }
};

const upsertOOPRow = async (
  customerCode, rebateCode, periodKey,
  year, month, monthName, twoDigit,
  amount, pool
) => {
  try {
    // Find the last known period of the resolved rebate code
    const anchorResult = await pool.request()
      .input('cc', sql.NVarChar(50), customerCode)
      .input('rc', sql.NVarChar(50), rebateCode)
      .query(`
        SELECT TOP 1 Period, PayoutDate
        FROM PayoutHistory
        WHERE CardCode   = @cc
          AND RebateCode = @rc
          AND PayoutId   NOT LIKE 'SAP-%'
          AND Period     NOT LIKE 'Balance of %'
          AND Period     IS NOT NULL AND Period != ''
        ORDER BY Id DESC
      `);
 
    const anchorPeriod  = anchorResult.recordset[0]?.Period    || `${monthName} ${year}`;
    const anchorPayDate = anchorResult.recordset[0]?.PayoutDate || null;
 
    const lastDay     = new Date(year, month, 0);
    const fallbackDate = `${lastDay.getMonth()+1}.${lastDay.getDate()}.${twoDigit}`;
    const displayDate  = anchorPayDate || fallbackDate;
 
    const isDeduct = amount < 0;
    const absAmt   = Math.abs(amount);
    const suffix   = isDeduct ? 'NEG' : 'POS';
    const oopId    = `SAP-${customerCode}-${rebateCode}-${periodKey}-${suffix}`;
 
    const existCheck = await pool.request()
      .input('PayoutId', sql.NVarChar(100), oopId)
      .query(`SELECT Id, SapReleasedAmount FROM PayoutHistory WHERE PayoutId = @PayoutId`);
 
    if (existCheck.recordset.length > 0) {
      const prev = parseFloat(existCheck.recordset[0].SapReleasedAmount) || 0;
      if (Math.abs(prev - amount) > 0.01) {
        await pool.request()
          .input('id',       sql.Int,            existCheck.recordset[0].Id)
          .input('sapAmt',   sql.Decimal(18, 2), amount)
          .input('released', sql.Decimal(18, 2), isDeduct ? 0 : absAmt)
          .input('total',    sql.Decimal(18, 2), isDeduct ? 0 : absAmt)
          .input('status',   sql.NVarChar(50),   isDeduct ? 'Deducted' : 'Paid')
          .query(`
            UPDATE PayoutHistory SET
              TotalAmount       = @total,
              AmountReleased    = @released,
              SapReleasedAmount = @sapAmt,
              Status            = @status,
              SapLastSync       = GETDATE(),
              UpdatedDate       = GETDATE()
            WHERE Id = @id
          `);
        console.log(
          `  ✅ [OOP-UPDATE] ${oopId}: ` +
          `${isDeduct ? '−' : '+'}₱${absAmt.toFixed(2)} ← anchored to "${anchorPeriod}"`
        );
      }
    } else {
      await pool.request()
        .input('PayoutId',   sql.NVarChar(100), oopId)
        .input('CardCode',   sql.NVarChar(50),  customerCode)
        .input('RebateCode', sql.NVarChar(50),  rebateCode)
        .input('RebateType', sql.NVarChar(50),  'SAP-OOP')
        .input('PayoutDate', sql.NVarChar(20),  displayDate)
        .input('Period',     sql.NVarChar(100), anchorPeriod)
        .input('BaseAmount', sql.Decimal(18, 2), 0)
        .input('Total',      sql.Decimal(18, 2), isDeduct ? 0 : absAmt)
        .input('Status',     sql.NVarChar(50),  isDeduct ? 'Deducted' : 'Paid')
        .input('Released',   sql.Decimal(18, 2), isDeduct ? 0 : absAmt)
        .input('SapAmt',     sql.Decimal(18, 2), amount)
        .input('Balance',    sql.Decimal(18, 2), 0)
        .query(`
          INSERT INTO PayoutHistory (
            PayoutId, CardCode, RebateCode, RebateType,
            PayoutDate, Period,
            BaseAmount, TotalAmount, Status,
            AmountReleased, SapReleasedAmount, SapLastSync, RebateBalance
          ) VALUES (
            @PayoutId, @CardCode, @RebateCode, @RebateType,
            @PayoutDate, @Period,
            @BaseAmount, @Total, @Status,
            @Released, @SapAmt, GETDATE(), @Balance
          )
        `);
      console.log(
        `  ✅ [OOP-INSERT] ${oopId}: ` +
        `${isDeduct ? '−' : '+'}₱${absAmt.toFixed(2)} ← anchored to "${anchorPeriod}"`
      );
    }
  } catch (err) {
    console.error('❌ [OOP-UPSERT] upsertOOPRow:', err.message);
  }
};