import sql from 'mssql';
import { handleDatabaseOperation } from '../services/databaseService.js';

const getSalesEmployees = async (req, res) => {
  try {
    console.log("🟦 Fetching NEXCHEM sales employees");
    const employees = await handleDatabaseOperation('NEXCHEM', async (pool) => {
      const result = await pool
        .request()
        .query("SELECT SlpCode, SlpName FROM OSLP ORDER BY SlpName");
      console.log(`🟦 NEXCHEM Sales Employees: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(employees);
  } catch (err) {
    console.error("Error fetching NEXCHEM sales employees:", err);
    res.status(500).json({ error: "Failed to fetch NEXCHEM sales employees", details: err.message });
  }
};

const getItems = async (req, res) => {
  try {
    console.log("🟦 Fetching NEXCHEM items");
    const items = await handleDatabaseOperation('NEXCHEM', async (pool) => {
      const result = await pool
        .request()
        .query(`
          SELECT 
            ItemCode,
            ItemName
          FROM OITM
          ORDER BY ItemCode
        `);
      console.log(`🟦 NEXCHEM Items: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(items);
  } catch (err) {
    console.error("Error fetching NEXCHEM items:", err);
    res.status(500).json({ error: "Failed to fetch NEXCHEM items", details: err.message });
  }
};

const getCustomers = async (req, res) => {
  try {
    console.log("🟦 Fetching NEXCHEM customers");
    const customers = await handleDatabaseOperation('NEXCHEM', async (pool) => {
      const result = await pool
        .request()
        .query(`
          SELECT
            CardCode,
            CardName,
            CardType
          FROM OCRD
          WHERE CardType = 'C'
        `);
      console.log(`🟦 NEXCHEM Customers: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(customers);
  } catch (err) {
    console.error("Error fetching NEXCHEM customers:", err);
    res.status(500).json({ error: "Failed to fetch NEXCHEM customers", details: err.message });
  }
};

// Get invoices with line items (excluding tree type 'S')
const getInvoices = async (req, res) => {
  try {
    console.log("🟦 Fetching NEXCHEM invoices with line items");
    const invoices = await handleDatabaseOperation('NEXCHEM', async (pool) => {
      const result = await pool
        .request()
        .query(`
          SELECT
            T0.DocNum,
            T0.CardName,
            T0.Docdate,
            T1.ItemCode,
            T1.Dscription,
            T1.Quantity,
            T1.LineTotal,
            T1.PriceAfVAt
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
        `);
      console.log(`🟦 NEXCHEM Invoices: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(invoices);
  } catch (err) {
    console.error("Error fetching NEXCHEM invoices:", err);
    res.status(500).json({ error: "Failed to fetch NEXCHEM invoices", details: err.message });
  }
};



export default {
  getSalesEmployees,
  getItems,
  getCustomers,
  getInvoices
};