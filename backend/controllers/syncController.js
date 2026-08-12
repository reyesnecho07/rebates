import { syncService } from '../services/syncService.js';

const DATABASES = ['VAN', 'NEXCHEM', 'VCP'];

const validateDatabase = (db) => {
  if (!DATABASES.includes(db)) {
    throw new Error(`Invalid database: ${db}. Must be one of: ${DATABASES.join(', ')}`);
  }
  return true;
};

// Resolve ?db= or ?system= into a plain database key (VAN / NEXCHEM / VCP)
const resolveDb = (req) => {
  const { db = 'VAN', system } = req.query;
  return system && DATABASES.includes(system.toUpperCase()) ? system.toUpperCase() : db;
};

export const getAvailableDatabases = async (req, res, next) => {
  try {
    res.json({
      databases: DATABASES,
      userDatabase: ['USER']
    });
  } catch (error) {
    next(error);
  }
};

export const getSalesEmployees = async (req, res, next) => {
  try {
    const targetDb = resolveDb(req);
    validateDatabase(targetDb);

    const data = await syncService.getLocalData('salesEmployees', targetDb);
    res.json({ database: targetDb, count: data.length, data });
  } catch (error) {
    if (error.message.startsWith('Invalid database')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

export const getCustomers = async (req, res, next) => {
  try {
    const targetDb = resolveDb(req);
    validateDatabase(targetDb);

    const data = await syncService.getLocalData('customers', targetDb);
    res.json({ database: targetDb, count: data.length, data });
  } catch (error) {
    if (error.message.startsWith('Invalid database')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

export const getItems = async (req, res, next) => {
  try {
    const targetDb = resolveDb(req);
    validateDatabase(targetDb);

    const data = await syncService.getLocalData('items', targetDb);
    res.json({ database: targetDb, count: data.length, data });
  } catch (error) {
    if (error.message.startsWith('Invalid database')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

export const getSyncStatus = async (req, res, next) => {
  try {
    const targetDb = resolveDb(req);
    validateDatabase(targetDb);

    const status = await syncService.getSyncStatus(targetDb);
    res.json({ database: targetDb, status });
  } catch (error) {
    if (error.message.startsWith('Invalid database')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

// Status across all three databases at once
export const getAllSyncStatus = async (req, res, next) => {
  try {
    const results = await Promise.all(
      DATABASES.map(async (db) => {
        try {
          const status = await syncService.getSyncStatus(db);
          return { database: db, status, success: true };
        } catch (error) {
          return { database: db, error: error.message, success: false };
        }
      })
    );

    res.json({ timestamp: new Date().toISOString(), results });
  } catch (error) {
    next(error);
  }
};

// Pull the same table from all three databases at once (e.g. for a combined view)
const getAllForTable = (table) => async (req, res, next) => {
  try {
    const results = {};

    for (const db of DATABASES) {
      try {
        const data = await syncService.getLocalData(table, db);
        results[db] = { count: data.length, data: data.slice(0, 100) };
      } catch (error) {
        results[db] = { error: error.message, count: 0 };
      }
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
};

export const getAllSalesEmployees = getAllForTable('salesEmployees');
export const getAllCustomers = getAllForTable('customers');
export const getAllItems = getAllForTable('items');