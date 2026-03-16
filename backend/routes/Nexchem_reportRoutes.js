import express from 'express';
import { getPool } from '../services/databaseService.js';

const router = express.Router();

// Helper function to calculate Kitanex amount
const calculateKitanexAmount = (quantity, rebatePerBag) => {
  if (!rebatePerBag || rebatePerBag === 0) return 0;
  return quantity * rebatePerBag;
};

// Get customer list from SAP
router.get('/nexchem/customer', async (req, res) => {
  try {
    const sapPool = getPool('NEXCHEM');
    
    const query = `
      SELECT DISTINCT
        T0.CardCode,
        T0.CardName
      FROM OCRD T0
      WHERE T0.CardType = 'C'
      AND T0.validFor = 'Y'
      ORDER BY T0.CardName
    `;
    
    const result = await sapPool.request().query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get rebate programs (kitanex rates) from OWN database
router.get('/nexchem/rebate-programs', async (req, res) => {
  try {
    const ownPool = getPool('NEXCHEM_OWN');
    
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
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching rebate programs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate report data
router.post('/nexchem/generate-report', async (req, res) => {
  try {
    const { selectedCustomer, dateFrom, dateTo } = req.body;
    
    if (!selectedCustomer) {
      return res.status(400).json({ error: 'Customer is required' });
    }
    
    console.log('Generating report for:', { selectedCustomer, dateFrom, dateTo });
    
    // Get SAP pool for invoice data
    const sapPool = getPool('NEXCHEM');
    
    // Get own pool for rebate data
    const ownPool = getPool('NEXCHEM_OWN');
    
    // Fetch rebate programs for the customer
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
    
    // Create a map of item codes to rebate per bag
    const rebateMap = {};
    rebateResult.recordset.forEach(item => {
      rebateMap[item.ItemCode] = {
        rebatePerBag: item.RebatePerBag || 0,
        itemName: item.ItemName
      };
    });
    
    // Build invoice query with date filters
    let invoiceQuery = `
      SELECT
        T0.DocNum,
        T0.CardCode,
        T0.CardName,
        T0.DocDate,
        T1.ItemCode,
        T1.Dscription,
        T1.Quantity,
        T1.LineTotal,
        T1.PriceAfVAT
      FROM
        OINV T0
        INNER JOIN INV1 T1 ON T0.DocEntry = T1.DocEntry
        LEFT JOIN OITM T2 ON T1.ItemCode = T2.ItemCode
      WHERE
        T1.TreeType <> 'S'
        AND T0.DocType = 'I'
        AND T2.InvntItem = 'Y'
        AND T1.Dscription NOT LIKE '%Free%'
        AND T1.Dscription NOT LIKE '%Discount%'
        AND T1.Dscription NOT LIKE '%fee%'
        AND T0.CardCode = @CardCode
    `;
    
    if (dateFrom) {
      invoiceQuery += ` AND T0.DocDate >= @DateFrom`;
    }
    
    if (dateTo) {
      invoiceQuery += ` AND T0.DocDate <= @DateTo`;
    }
    
    invoiceQuery += ` ORDER BY T0.DocDate, T0.DocNum`;
    
    const request = sapPool.request()
      .input('CardCode', selectedCustomer);
    
    if (dateFrom) {
      const formattedDateFrom = new Date(dateFrom).toISOString().split('T')[0];
      request.input('DateFrom', formattedDateFrom);
    }
    
    if (dateTo) {
      const formattedDateTo = new Date(dateTo).toISOString().split('T')[0];
      request.input('DateTo', formattedDateTo);
    }
    
    const invoiceResult = await request.query(invoiceQuery);
    
    console.log(`Found ${invoiceResult.recordset.length} invoice lines`);
    
    // Group by document number - REMOVED the deduplication logic
    const groupedData = {};
    
    invoiceResult.recordset.forEach(row => {
      const docNum = row.DocNum;
      
      if (!groupedData[docNum]) {
        groupedData[docNum] = {
          id: docNum.toString(),
          docDate: row.DocDate,
          cardCode: row.CardCode,
          cardName: row.CardName,
          items: []
        };
      }
      
      // Get rebate per bag for this item
      const rebateInfo = rebateMap[row.ItemCode] || { rebatePerBag: 0, itemName: '' };
      const kitanexAmount = calculateKitanexAmount(row.Quantity, rebateInfo.rebatePerBag);
      
      // Include ALL items that have rebate (kitanex > 0), even duplicates
      if (rebateInfo.rebatePerBag > 0) {
        groupedData[docNum].items.push({
          name: row.Dscription || rebateInfo.itemName || row.ItemCode,
          itemCode: row.ItemCode,
          qty: row.Quantity,
          sales_amt: row.LineTotal || 0,
          kitanex: rebateInfo.rebatePerBag,
          total_kitanex: kitanexAmount
        });
      }
    });
    
    // Convert to array and filter out documents with no rebate items
    const reportData = Object.values(groupedData)
      .filter(group => group.items.length > 0)
      .sort((a, b) => new Date(a.docDate) - new Date(b.docDate));
    
    console.log(`Generated report with ${reportData.length} documents`);
    console.log(`Total items across all documents: ${reportData.reduce((sum, group) => sum + group.items.length, 0)}`);
    
    res.json({
      success: true,
      data: reportData,
      summary: {
        totalDocuments: reportData.length,
        totalItems: reportData.reduce((sum, group) => sum + group.items.length, 0),
        dateFrom: dateFrom || 'All',
        dateTo: dateTo || 'All'
      }
    });
    
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Generate report data for multiple customers
router.post('/nexchem/generate-multi-customer-report', async (req, res) => {
  try {
    const { customerCodes, dateFrom, dateTo } = req.body;
    
    if (!customerCodes || customerCodes.length === 0) {
      return res.status(400).json({ error: 'At least one customer is required' });
    }
    
    console.log('Generating report for multiple customers:', { customerCodes, dateFrom, dateTo });
    
    // Get SAP pool for invoice data
    const sapPool = getPool('NEXCHEM');
    
    // Get own pool for rebate data
    const ownPool = getPool('NEXCHEM_OWN');
    
    // Fetch rebate programs for all customers
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
    customerCodes.forEach((code, index) => {
      rebateRequest.input(`CardCode${index}`, code);
    });
    
    const rebateResult = await rebateRequest.query(rebateQuery);
    
    console.log(`Found ${rebateResult.recordset.length} rebate items for customers`);
    
    // Create a map of item codes to rebate per bag, keyed by customer
    const rebateMap = {};
    rebateResult.recordset.forEach(item => {
      if (!rebateMap[item.CardCode]) {
        rebateMap[item.CardCode] = {};
      }
      rebateMap[item.CardCode][item.ItemCode] = {
        rebatePerBag: item.RebatePerBag || 0,
        itemName: item.ItemName
      };
    });
    
    // Build invoice query with date filters for multiple customers
    let invoiceQuery = `
      SELECT
        T0.DocNum,
        T0.CardCode,
        T0.CardName,
        T0.DocDate,
        T1.ItemCode,
        T1.Dscription,
        T1.Quantity,
        T1.LineTotal,
        T1.PriceAfVAT
      FROM
        OINV T0
        INNER JOIN INV1 T1 ON T0.DocEntry = T1.DocEntry
        LEFT JOIN OITM T2 ON T1.ItemCode = T2.ItemCode
      WHERE
        T1.TreeType <> 'S'
        AND T0.DocType = 'I'
        AND T2.InvntItem = 'Y'
        AND T1.Dscription NOT LIKE '%Free%'
        AND T1.Dscription NOT LIKE '%Discount%'
        AND T1.Dscription NOT LIKE '%fee%'
        AND T0.CardCode IN (${placeholders})
    `;
    
    if (dateFrom) {
      invoiceQuery += ` AND T0.DocDate >= @DateFrom`;
    }
    
    if (dateTo) {
      invoiceQuery += ` AND T0.DocDate <= @DateTo`;
    }
    
    invoiceQuery += ` ORDER BY T0.CardCode, T0.DocDate, T0.DocNum`;
    
    const request = sapPool.request();
    customerCodes.forEach((code, index) => {
      request.input(`CardCode${index}`, code);
    });
    
    if (dateFrom) {
      const formattedDateFrom = new Date(dateFrom).toISOString().split('T')[0];
      request.input('DateFrom', formattedDateFrom);
    }
    
    if (dateTo) {
      const formattedDateTo = new Date(dateTo).toISOString().split('T')[0];
      request.input('DateTo', formattedDateTo);
    }
    
    const invoiceResult = await request.query(invoiceQuery);
    
    console.log(`Found ${invoiceResult.recordset.length} invoice lines`);
    
    // Group by document number
    const groupedData = {};
    
    invoiceResult.recordset.forEach(row => {
      const docNum = row.DocNum;
      const cardCode = row.CardCode;
      
      if (!groupedData[docNum]) {
        groupedData[docNum] = {
          id: docNum.toString(),
          docDate: row.DocDate,
          cardCode: row.CardCode,
          cardName: row.CardName,
          items: []
        };
      }
      
      // Get rebate per bag for this item for this customer
      const customerRebateMap = rebateMap[cardCode] || {};
      const rebateInfo = customerRebateMap[row.ItemCode] || { rebatePerBag: 0, itemName: '' };
      const kitanexAmount = calculateKitanexAmount(row.Quantity, rebateInfo.rebatePerBag);
      
      // Include ALL items that have rebate (kitanex > 0)
      if (rebateInfo.rebatePerBag > 0) {
        groupedData[docNum].items.push({
          name: row.Dscription || rebateInfo.itemName || row.ItemCode,
          itemCode: row.ItemCode,
          qty: row.Quantity,
          sales_amt: row.LineTotal || 0,
          kitanex: rebateInfo.rebatePerBag,
          total_kitanex: kitanexAmount
        });
      }
    });
    
    // Convert to array and filter out documents with no rebate items
    const reportData = Object.values(groupedData)
      .filter(group => group.items.length > 0)
      .sort((a, b) => new Date(a.docDate) - new Date(b.docDate));
    
    console.log(`Generated report with ${reportData.length} documents`);
    console.log(`Total items across all documents: ${reportData.reduce((sum, group) => sum + group.items.length, 0)}`);
    
    res.json({
      success: true,
      data: reportData,
      summary: {
        totalDocuments: reportData.length,
        totalItems: reportData.reduce((sum, group) => sum + group.items.length, 0),
        totalCustomers: customerCodes.length,
        dateFrom: dateFrom || 'All',
        dateTo: dateTo || 'All'
      }
    });
    
  } catch (error) {
    console.error('Error generating multi-customer report:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;