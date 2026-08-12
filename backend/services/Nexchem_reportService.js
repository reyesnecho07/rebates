/**
 * services/Nexchem_reportService.js
 *
 * Business logic extracted verbatim from the existing route file.
 * No query or calculation logic is changed.
 */

import { getPool } from './databaseService.js';

// ─── helper (unchanged from existing route file) ──────────────────────────────
const calculateKitanexAmount = (quantity, rebatePerBag) => {
  if (!rebatePerBag || rebatePerBag === 0) return 0;
  return quantity * rebatePerBag;
};

// ─── getCustomers ─────────────────────────────────────────────────────────────
// Source: GET /nexchem/customer
export const getCustomers = async () => {
  const sapPool = getPool('NEXCHEM');

  const query = `
    SELECT DISTINCT
      T0.CardCode,
      T0.CardName
    FROM OCRD T0
    ORDER BY T0.CardName
  `;

  const result = await sapPool.request().query(query);
  return result.recordset;
};

// ─── getRebatePrograms ────────────────────────────────────────────────────────
// Source: GET /nexchem/rebate-programs
export const getRebatePrograms = async () => {
  const ownPool = getPool('NEXCHEM');

  const query = `
    SELECT
      T0.RebateCode,
      T0.RebateType,
      T0.SlpCode,
      T0.SlpName,
      T0.DateFrom,
      T0.DateTo,
      T0.Frequency,
      T0.QuotaType,
      T1.CardCode,
      T1.CardName,
      T1.QtrRebate,
      T2.ItemCode,
      T2.ItemName,
      T2.RebatePerBag,
      T2.UnitPerQty
    FROM
      RebateProgram T0
      LEFT JOIN FixCustRebate T1 ON T0.RebateCode = T1.RebateCode
      LEFT JOIN FixProdRebate T2 ON T0.RebateCode = T1.RebateCode
    WHERE
      T0.RebateType = 'Fixed'
      AND T0.Status = 'Active'
  `;

  const result = await ownPool.request().query(query);
  return result.recordset;
};

// ─── generateReport ───────────────────────────────────────────────────────────
// Source: POST /nexchem/generate-report (single customer)
export const generateReport = async ({ selectedCustomer, dateFrom, dateTo }) => {
  if (!selectedCustomer) throw new Error('Customer is required');

  console.log('Generating report for:', { selectedCustomer, dateFrom, dateTo });

  const sapPool = getPool('NEXCHEM');
  const ownPool = getPool('NEXCHEM');

  const rebateQuery = `
    SELECT
      T2.ItemCode,
      T2.ItemName,
      T2.RebatePerBag
    FROM
      RebateProgram T0
      LEFT JOIN FixCustRebate T1 ON T0.RebateCode = T1.RebateCode
      LEFT JOIN FixProdRebate T2 ON T0.RebateCode = T2.RebateCode
    WHERE
      T0.RebateType = 'Fixed'
      AND T1.CardCode = @CardCode
      AND T2.RebatePerBag > 0
  `;

  const rebateResult = await ownPool
    .request()
    .input('CardCode', selectedCustomer)
    .query(rebateQuery);

  console.log(`Found ${rebateResult.recordset.length} rebate items for customer`);

  const rebateMap = {};
  rebateResult.recordset.forEach(item => {
    rebateMap[item.ItemCode] = {
      rebatePerBag: item.RebatePerBag || 0,
      itemName:     item.ItemName,
    };
  });

  let invoiceQuery = `
    SELECT
      T0.DocNum,
      T0.CardCode,
      T0.CardName,
      T0.DocDate,
      T0.ItemCode,
      T0.Dscription,
      T0.Quantity,
      T0.LineTotal,
      T0.PriceAfVAT
    FROM
      OINV T0
    WHERE
      T0.TreeType <> 'S'
      AND T0.DocType = 'I'
      AND T0.Dscription NOT LIKE '%Free%'
      AND T0.Dscription NOT LIKE '%Discount%'
      AND T0.Dscription NOT LIKE '%fee%'
      AND T0.CardCode = @CardCode
  `;

  if (dateFrom) invoiceQuery += ` AND T0.DocDate >= @DateFrom`;
  if (dateTo)   invoiceQuery += ` AND T0.DocDate <= @DateTo`;
  invoiceQuery += ` ORDER BY T0.DocDate, T0.DocNum`;

  const request = sapPool.request().input('CardCode', selectedCustomer);

  if (dateFrom) request.input('DateFrom', new Date(dateFrom).toISOString().split('T')[0]);
  if (dateTo)   request.input('DateTo',   new Date(dateTo).toISOString().split('T')[0]);

  const invoiceResult = await request.query(invoiceQuery);
  console.log(`Found ${invoiceResult.recordset.length} invoice lines`);

  const groupedData = {};

  invoiceResult.recordset.forEach(row => {
    const docNum = row.DocNum;

    if (!groupedData[docNum]) {
      groupedData[docNum] = {
        id:       docNum.toString(),
        docDate:  row.DocDate,
        cardCode: row.CardCode,
        cardName: row.CardName,
        items:    [],
      };
    }

    const rebateInfo    = rebateMap[row.ItemCode] || { rebatePerBag: 0, itemName: '' };
    const kitanexAmount = calculateKitanexAmount(row.Quantity, rebateInfo.rebatePerBag);

    if (rebateInfo.rebatePerBag > 0) {
      groupedData[docNum].items.push({
        name:          row.Dscription || rebateInfo.itemName || row.ItemCode,
        itemCode:      row.ItemCode,
        qty:           row.Quantity,
        sales_amt:     row.LineTotal || 0,
        kitanex:       rebateInfo.rebatePerBag,
        total_kitanex: kitanexAmount,
      });
    }
  });

  const reportData = Object.values(groupedData)
    .filter(group => group.items.length > 0)
    .sort((a, b) => new Date(a.docDate) - new Date(b.docDate));

  console.log(`Generated report with ${reportData.length} documents`);
  console.log(`Total items across all documents: ${reportData.reduce((sum, g) => sum + g.items.length, 0)}`);

  return reportData;
};

// ─── generateMultiCustomerReport ─────────────────────────────────────────────
// Source: POST /nexchem/generate-multi-customer-report
export const generateMultiCustomerReport = async ({ customerCodes, dateFrom, dateTo }) => {
  if (!customerCodes || customerCodes.length === 0)
    throw new Error('At least one customer is required');

  console.log('Generating report for multiple customers:', { customerCodes, dateFrom, dateTo });

  const sapPool = getPool('NEXCHEM');
  const ownPool = getPool('NEXCHEM');

  const placeholders = customerCodes.map((_, index) => `@CardCode${index}`).join(',');

  const rebateQuery = `
    SELECT
      T2.ItemCode,
      T2.ItemName,
      T2.RebatePerBag,
      T1.CardCode
    FROM
      RebateProgram T0
      LEFT JOIN FixCustRebate T1 ON T0.RebateCode = T1.RebateCode
      LEFT JOIN FixProdRebate T2 ON T0.RebateCode = T2.RebateCode
    WHERE
      T0.RebateType = 'Fixed'
      AND T1.CardCode IN (${placeholders})
      AND T2.RebatePerBag > 0
  `;

  const rebateRequest = ownPool.request();
  customerCodes.forEach((code, index) => rebateRequest.input(`CardCode${index}`, code));
  const rebateResult = await rebateRequest.query(rebateQuery);

  console.log(`Found ${rebateResult.recordset.length} rebate items for customers`);

  const rebateMap = {};
  rebateResult.recordset.forEach(item => {
    if (!rebateMap[item.CardCode]) rebateMap[item.CardCode] = {};
    rebateMap[item.CardCode][item.ItemCode] = {
      rebatePerBag: item.RebatePerBag || 0,
      itemName:     item.ItemName,
    };
  });

  let invoiceQuery = `
    SELECT
      T0.DocNum,
      T0.CardCode,
      T0.CardName,
      T0.DocDate,
      T0.ItemCode,
      T0.Dscription,
      T0.Quantity,
      T0.LineTotal,
      T0.PriceAfVAT
    FROM
      OINV T0
    WHERE
      T0.TreeType <> 'S'
      AND T0.DocType = 'I'
      AND T0.Dscription NOT LIKE '%Free%'
      AND T0.Dscription NOT LIKE '%Discount%'
      AND T0.Dscription NOT LIKE '%fee%'
      AND T0.CardCode IN (${placeholders})
  `;

  if (dateFrom) invoiceQuery += ` AND T0.DocDate >= @DateFrom`;
  if (dateTo)   invoiceQuery += ` AND T0.DocDate <= @DateTo`;
  invoiceQuery += ` ORDER BY T0.CardCode, T0.DocDate, T0.DocNum`;

  const request = sapPool.request();
  customerCodes.forEach((code, index) => request.input(`CardCode${index}`, code));
  if (dateFrom) request.input('DateFrom', new Date(dateFrom).toISOString().split('T')[0]);
  if (dateTo)   request.input('DateTo',   new Date(dateTo).toISOString().split('T')[0]);

  const invoiceResult = await request.query(invoiceQuery);
  console.log(`Found ${invoiceResult.recordset.length} invoice lines`);

  const groupedData = {};

  invoiceResult.recordset.forEach(row => {
    const docNum   = row.DocNum;
    const cardCode = row.CardCode;

    if (!groupedData[docNum]) {
      groupedData[docNum] = {
        id:           docNum.toString(),
        docDate:      row.DocDate,
        customerCode: row.CardCode,
        customerName: row.CardName,
        cardCode:     row.CardCode,
        cardName:     row.CardName,
        items:        [],
      };
    }

    const customerRebateMap = rebateMap[cardCode] || {};
    const rebateInfo        = customerRebateMap[row.ItemCode] || { rebatePerBag: 0, itemName: '' };
    const kitanexAmount     = calculateKitanexAmount(row.Quantity, rebateInfo.rebatePerBag);

    if (rebateInfo.rebatePerBag > 0) {
      groupedData[docNum].items.push({
        name:          row.Dscription || rebateInfo.itemName || row.ItemCode,
        itemCode:      row.ItemCode,
        qty:           row.Quantity,
        sales_amt:     row.LineTotal || 0,
        kitanex:       rebateInfo.rebatePerBag,
        total_kitanex: kitanexAmount,
      });
    }
  });

  const reportData = Object.values(groupedData)
    .filter(group => group.items.length > 0)
    .sort((a, b) => new Date(a.docDate) - new Date(b.docDate));

  console.log(`Generated report with ${reportData.length} documents`);
  console.log(`Total items across all documents: ${reportData.reduce((sum, g) => sum + g.items.length, 0)}`);

  return reportData;
};

// ─── getCustomersByRebateCode ─────────────────────────────────────────────────
// Used by the rebate-code dropdown flow to resolve customer list
export const getCustomersByRebateCode = async (rebateCode) => {
  const ownPool = getPool('NEXCHEM');

  const typeRes = await ownPool.request()
    .input('rebateCode', rebateCode)
    .query(`SELECT RebateType FROM RebateProgram WHERE RebateCode = @rebateCode`);

  if (!typeRes.recordset.length)
    throw new Error(`Rebate code "${rebateCode}" not found`);

  const rebateType    = typeRes.recordset[0].RebateType;
  const customerTable = {
    Fixed:       'FixCustRebate',
    Incremental: 'IncCustRebate',
    Percentage:  'PerCustRebate',
  }[rebateType] || 'FixCustRebate';

  const result = await ownPool.request()
    .input('rebateCode', rebateCode)
    .query(`
      SELECT DISTINCT T1.CardCode, T1.CardName
      FROM   RebateProgram T0
      INNER JOIN ${customerTable} T1 ON T0.RebateCode = T1.RebateCode
      WHERE  T0.RebateCode = @rebateCode
        AND  T1.CardCode IS NOT NULL
        AND  LTRIM(RTRIM(T1.CardCode)) != ''
      ORDER BY T1.CardName
    `);

  return {
    customers:   result.recordset.map(r => ({ CardCode: r.CardCode, CardName: r.CardName })),
    rebateType,
    rebateCode,
  };
};