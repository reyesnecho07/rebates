import { syncService } from '../services/syncService.js';

// Available databases mapping
const SOURCE_DATABASES = ['VAN', 'NEXCHEM', 'VCP'];
const OWN_DATABASES = ['VAN_OWN', 'NEXCHEM_OWN', 'VCP_OWN'];
const ALL_DATABASES = [...SOURCE_DATABASES, ...OWN_DATABASES, 'USER'];

export const refreshData = async (req, res, next) => {
  try {
    const { 
      sourceDatabase = 'VAN', 
      targetDatabase = 'VAN_OWN', 
      tables = ['salesEmployees', 'customers', 'items'] 
    } = req.body;

    // Validate source database
    if (!SOURCE_DATABASES.includes(sourceDatabase)) {
      return res.status(400).json({
        success: false,
        message: `Invalid source database. Must be one of: ${SOURCE_DATABASES.join(', ')}`
      });
    }

    // Validate target database
    if (!OWN_DATABASES.includes(targetDatabase) && targetDatabase !== 'USER') {
      return res.status(400).json({
        success: false,
        message: `Invalid target database. Must be an OWN database (${OWN_DATABASES.join(', ')}) or USER`
      });
    }

    // Ensure source and target match (VAN -> VAN_OWN, NEXCHEM -> NEXCHEM_OWN, etc.)
    if (targetDatabase.endsWith('_OWN')) {
      const sourcePrefix = sourceDatabase;
      const targetPrefix = targetDatabase.replace('_OWN', '');
      
      if (sourcePrefix !== targetPrefix) {
        console.warn(`⚠️ Mismatch: source=${sourceDatabase}, target=${targetDatabase}`);
      }
    }

    console.log(`🔄 Starting refresh from ${sourceDatabase} to ${targetDatabase} for tables: ${tables.join(', ')}`);
    
    // Return immediate response to frontend
    res.json({
      success: true,
      message: "Refresh started in background",
      refreshId: Date.now(),
      sourceDatabase,
      targetDatabase,
      tables
    });

    // Process in background
    processRefreshInBackground(sourceDatabase, targetDatabase, tables);
    
  } catch (error) {
    console.error('❌ Error starting refresh:', error);
    next(error);
  }
};

// Background processing function
const processRefreshInBackground = async (sourceDatabase, targetDatabase, tables) => {
  try {
    const results = {};
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    console.log(`🎯 Processing background refresh: ${sourceDatabase} → ${targetDatabase}`);

    // Process all tables in parallel
    const promises = tables.map(async (table) => {
      try {
        console.log(`🔄 Refreshing ${table} from ${sourceDatabase} to ${targetDatabase}...`);
        
        // Get data from source database (VAN, NEXCHEM, or VCP)
        const sapData = await syncService.getSapData(sourceDatabase, table);
        console.log(`📊 Retrieved ${sapData.length} records from ${sourceDatabase}.${table}`);
        
        // Use bulk insert for faster operations
        const syncResult = await syncService.bulkSyncToLocalDatabase(targetDatabase, sapData, table);
        
        results[table] = syncResult;
        totalAdded += syncResult.added || 0;
        totalUpdated += syncResult.updated || 0;
        totalSkipped += syncResult.skipped || 0;
        
        console.log(`✅ ${table} refresh completed:`, syncResult);
        return syncResult;
      } catch (error) {
        console.error(`❌ Error refreshing ${table} from ${sourceDatabase}:`, error);
        results[table] = { error: error.message, source: sourceDatabase };
        return { error: error.message };
      }
    });

    await Promise.all(promises);

    console.log(`✅ All refreshes completed for ${sourceDatabase} → ${targetDatabase}:`);
    console.log(`   Added: ${totalAdded}`);
    console.log(`   Updated: ${totalUpdated}`);
    console.log(`   Skipped: ${totalSkipped}`);
    
    // Optionally, you could send a notification or update a status table here
    
  } catch (error) {
    console.error('❌ Error in background refresh:', error);
  }
};

// Helper function to validate database
const validateDatabase = (db, allowedTypes = OWN_DATABASES) => {
  if (!ALL_DATABASES.includes(db)) {
    throw new Error(`Invalid database: ${db}. Allowed: ${ALL_DATABASES.join(', ')}`);
  }
  
  if (!allowedTypes.includes(db) && db !== 'USER') {
    throw new Error(`Database must be one of: ${allowedTypes.join(', ')} or USER`);
  }
  
  return true;
};

// Update other controller functions to support multiple OWN databases
export const getLocalSalesEmployees = async (req, res, next) => {
  try {
    const { db = 'VAN_OWN', system } = req.query;
    
    // Support both db parameter and system parameter
    let targetDb = db;
    if (system && OWN_DATABASES.includes(`${system}_OWN`)) {
      targetDb = `${system}_OWN`;
    }
    
    try {
      validateDatabase(targetDb, OWN_DATABASES);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    const data = await syncService.getLocalData('salesEmployees', targetDb);
    res.json({
      database: targetDb,
      count: data.length,
      data: data
    });
  } catch (error) {
    next(error);
  }
};

export const getLocalCustomers = async (req, res, next) => {
  try {
    const { db = 'VAN_OWN', system } = req.query;
    
    let targetDb = db;
    if (system && OWN_DATABASES.includes(`${system}_OWN`)) {
      targetDb = `${system}_OWN`;
    }
    
    try {
      validateDatabase(targetDb, OWN_DATABASES);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    const data = await syncService.getLocalData('customers', targetDb);
    res.json({
      database: targetDb,
      count: data.length,
      data: data
    });
  } catch (error) {
    next(error);
  }
};

export const getLocalItems = async (req, res, next) => {
  try {
    const { db = 'VAN_OWN', system } = req.query;
    
    let targetDb = db;
    if (system && OWN_DATABASES.includes(`${system}_OWN`)) {
      targetDb = `${system}_OWN`;
    }
    
    try {
      validateDatabase(targetDb, OWN_DATABASES);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    const data = await syncService.getLocalData('items', targetDb);
    res.json({
      database: targetDb,
      count: data.length,
      data: data
    });
  } catch (error) {
    next(error);
  }
};

export const getSyncStatus = async (req, res, next) => {
  try {
    const { db = 'VAN_OWN', system } = req.query;
    
    let targetDb = db;
    if (system && OWN_DATABASES.includes(`${system}_OWN`)) {
      targetDb = `${system}_OWN`;
    }
    
    try {
      validateDatabase(targetDb, [...OWN_DATABASES, ...SOURCE_DATABASES]);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    
    const status = await syncService.getSyncStatus(targetDb);
    res.json({
      database: targetDb,
      status: status
    });
  } catch (error) {
    next(error);
  }
};

// New endpoints for system-specific operations
export const getAvailableDatabases = async (req, res, next) => {
  try {
    const databases = {
      sourceDatabases: SOURCE_DATABASES,
      ownDatabases: OWN_DATABASES,
      userDatabase: ['USER'],
      allDatabases: ALL_DATABASES
    };
    
    res.json(databases);
  } catch (error) {
    next(error);
  }
};

export const refreshSystemData = async (req, res, next) => {
  try {
    const { system = 'VAN' } = req.params;
    const { tables = ['salesEmployees', 'customers', 'items'] } = req.body;
    
    const sourceDatabase = system.toUpperCase();
    const targetDatabase = `${sourceDatabase}_OWN`;
    
    // Validate system
    if (!SOURCE_DATABASES.includes(sourceDatabase)) {
      return res.status(400).json({
        success: false,
        message: `Invalid system. Must be one of: ${SOURCE_DATABASES.join(', ')}`
      });
    }
    
    console.log(`🔄 System refresh: ${sourceDatabase} to ${targetDatabase}`);
    
    // Return immediate response
    res.json({
      success: true,
      message: `Refresh started for ${system} system`,
      refreshId: Date.now(),
      sourceDatabase,
      targetDatabase,
      tables
    });
    
    // Process in background
    processRefreshInBackground(sourceDatabase, targetDatabase, tables);
    
  } catch (error) {
    next(error);
  }
};

// Get status for all systems
export const getAllSyncStatus = async (req, res, next) => {
  try {
    const statusPromises = OWN_DATABASES.map(async (db) => {
      try {
        const status = await syncService.getSyncStatus(db);
        return {
          database: db,
          status: status,
          success: true
        };
      } catch (error) {
        return {
          database: db,
          error: error.message,
          success: false
        };
      }
    });
    
    const results = await Promise.all(statusPromises);
    
    res.json({
      timestamp: new Date().toISOString(),
      results: results
    });
  } catch (error) {
    next(error);
  }
};

// Get data from all OWN databases
export const getAllSalesEmployees = async (req, res, next) => {
  try {
    const results = {};
    
    for (const db of OWN_DATABASES) {
      try {
        const data = await syncService.getLocalData('salesEmployees', db);
        results[db] = {
          count: data.length,
          data: data.slice(0, 100) // Limit to first 100 records
        };
      } catch (error) {
        results[db] = {
          error: error.message,
          count: 0
        };
      }
    }
    
    res.json(results);
  } catch (error) {
    next(error);
  }
};

export const getAllCustomers = async (req, res, next) => {
  try {
    const results = {};
    
    for (const db of OWN_DATABASES) {
      try {
        const data = await syncService.getLocalData('customers', db);
        results[db] = {
          count: data.length,
          data: data.slice(0, 100) // Limit to first 100 records
        };
      } catch (error) {
        results[db] = {
          error: error.message,
          count: 0
        };
      }
    }
    
    res.json(results);
  } catch (error) {
    next(error);
  }
};

export const getAllItems = async (req, res, next) => {
  try {
    const results = {};
    
    for (const db of OWN_DATABASES) {
      try {
        const data = await syncService.getLocalData('items', db);
        results[db] = {
          count: data.length,
          data: data.slice(0, 100) // Limit to first 100 records
        };
      } catch (error) {
        results[db] = {
          error: error.message,
          count: 0
        };
      }
    }
    
    res.json(results);
  } catch (error) {
    next(error);
  }
};