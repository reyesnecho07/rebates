import sql from 'mssql';
import { handleDatabaseOperation } from '../services/databaseService.js';

const getSalesEmployees = async (req, res) => {
  try {
    console.log("🟪 Fetching VCP sales employees");
    const employees = await handleDatabaseOperation('VCP', async (pool) => {
      const result = await pool
        .request()
        .query("SELECT SlpCode, SlpName FROM OSLP ORDER BY SlpName");
      console.log(`🟪 VCP Sales Employees: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(employees);
  } catch (err) {
    console.error("Error fetching VCP sales employees:", err);
    res.status(500).json({ error: "Failed to fetch VCP sales employees", details: err.message });
  }
};

const getItems = async (req, res) => {
  try {
    console.log("🟪 Fetching VCP items");
    const items = await handleDatabaseOperation('VCP', async (pool) => {
      const result = await pool
        .request()
        .query(`
          SELECT 
            ItemCode,
            ItemName,
            FrgnName
          FROM OITM
          ORDER BY ItemCode
        `);
      console.log(`🟪 VCP Items: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(items);
  } catch (err) {
    console.error("Error fetching VCP items:", err);
    res.status(500).json({ error: "Failed to fetch VCP items", details: err.message });
  }
};

const getCustomers = async (req, res) => {
  try {
    console.log("🟪 Fetching VCP customers");
    const customers = await handleDatabaseOperation('VCP', async (pool) => {
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
      console.log(`🟪 VCP Customers: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(customers);
  } catch (err) {
    console.error("Error fetching VCP customers:", err);
    res.status(500).json({ error: "Failed to fetch VCP customers", details: err.message });
  }
};

// Get invoices with line items (excluding tree type 'S')
const getInvoices = async (req, res) => {
  try {
    console.log("🟪 Fetching VCP invoices with line items");
    const invoices = await handleDatabaseOperation('VCP', async (pool) => {
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
            T1.LineTotal
          FROM
            OINV T0
            INNER JOIN INV1 T1 ON T0.DocEntry = T1.DocEntry
          WHERE
            T1.TreeType <> 'S'
        `);
      console.log(`🟪 VCP Invoices: ${result.recordset.length} records`);
      return result.recordset;
    });
    res.json(invoices);
  } catch (err) {
    console.error("Error fetching VCP invoices:", err);
    res.status(500).json({ error: "Failed to fetch VCP invoices", details: err.message });
  }
};

export default {
  getSalesEmployees,
  getItems,
  getCustomers,
  getInvoices
};