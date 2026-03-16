import sql from 'mssql';
import { handleDatabaseOperation } from '../services/databaseService.js';

const getSalesEmployees = async (req, res) => {
  try {
    console.log("🟩 Fetching VAN sales employees");
    const employees = await handleDatabaseOperation('VAN', async (pool) => {
      const result = await pool
        .request()
        .query("SELECT SlpCode, SlpName FROM OSLP ORDER BY SlpName");
      console.log(`🟩 VAN Sales Employees: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(employees);
  } catch (err) {
    console.error("Error fetching VAN sales employees:", err);
    res.status(500).json({ error: "Failed to fetch VAN sales employees", details: err.message });
  }
};

const getItems = async (req, res) => {
  try {
    console.log("🟩 Fetching VAN items");
    const items = await handleDatabaseOperation('VAN', async (pool) => {
      const result = await pool
        .request()
        .query(`
          SELECT 
            ItemCode,
            ItemName
          FROM OITM
          ORDER BY ItemCode
        `);
      console.log(`🟩 VAN Items: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(items);
  } catch (err) {
    console.error("Error fetching VAN items:", err);
    res.status(500).json({ error: "Failed to fetch VAN items", details: err.message });
  }
};

const getCustomers = async (req, res) => {
  try {
    console.log("🟩 Fetching VAN customers");
    const customers = await handleDatabaseOperation('VAN', async (pool) => {
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
      console.log(`🟩 VAN Customers: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(customers);
  } catch (err) {
    console.error("Error fetching VAN customers:", err);
    res.status(500).json({ error: "Failed to fetch VAN customers", details: err.message });
  }
};

// Get invoices with line items (excluding tree type 'S')
const getInvoices = async (req, res) => {
  try {
    console.log("🟩 Fetching VAN invoices with line items");
    const invoices = await handleDatabaseOperation('VAN', async (pool) => {
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
      console.log(`🟩 VAN Invoices: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(invoices);
  } catch (err) {
    console.error("Error fetching VAN invoices:", err);
    res.status(500).json({ error: "Failed to fetch VAN invoices", details: err.message });
  }
};

export default {
  getSalesEmployees,
  getItems,
  getCustomers,
  getInvoices
};