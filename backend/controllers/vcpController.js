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
            T0.ItemCode,
            T0.ItemName,
            T1.ItmsGrpNam
          FROM
            OITM T0
            INNER JOIN OITB T1 ON T0.ItmsGrpCod = T1.ItmsGrpCod
          WHERE
            T0.ItemName <> ''
          ORDER BY T0.ItemName
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
            T0.CardCode,
            T0.CardName,
            T1.GroupName,
            T2.SlpName
          FROM
            OCRD T0  
            INNER JOIN OCRG T1 ON T0.GroupCode = T1.GroupCode 
            INNER JOIN OSLP T2 ON T0.SlpCode = T2.SlpCode
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
            T0.ItemCode,
            T0.Dscription,
            T0.Quantity,
            T0.LineTotal,
            T0.PriceAfVAt,
            T0.Treetype
          FROM
            OINV T0
          WHERE
            T0.TreeType <> 'S'
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