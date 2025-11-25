import sql from 'mssql';
import { handleDatabaseOperation, testDatabaseConnection } from '../services/databaseService.js';
import { dbConfigs } from '../config/database.js';
import { config } from '../config/environment.js';

export const healthCheck = (req, res) => {
  res.json({
    status: "OK",
    server: {
      host: config.HOST,
      port: config.PORT,
      environment: config.NODE_ENV
    },
    databases: {
      NEXCHEM: dbConfigs.NEXCHEM.database,
      VAN: dbConfigs.VAN.database,
      VCP: dbConfigs.VCP.database
    },
    timestamp: new Date().toISOString()
  });
};

export const debugDatabases = async (req, res) => {
  try {
    const results = {};
    
    for (const dbName of ['NEXCHEM', 'VAN', 'VCP']) {
      try {
        const dbConfig = dbConfigs[dbName];
        console.log(`🔍 Testing ${dbName}: ${dbConfig.database} on ${dbConfig.server}`);
        
        const pool = await sql.connect(dbConfig);
        
        // Get database info
        const dbResult = await pool.request().query("SELECT DB_NAME() as dbname, @@SERVERNAME as servername");
        const actualDbName = dbResult.recordset[0].dbname;
        const serverName = dbResult.recordset[0].servername;
        
        // Get counts
        const usersCount = await pool.request().query("SELECT COUNT(*) as count FROM OUSR");
        const salesEmployeesCount = await pool.request().query("SELECT COUNT(*) as count FROM OSLP");
        const itemsCount = await pool.request().query("SELECT COUNT(*) as count FROM OITM");
        const customersCount = await pool.request().query("SELECT COUNT(*) as count FROM OCRD WHERE CardType = 'C'");
        
        results[dbName] = {
          status: '✅ Connected',
          configured_db: dbConfig.database,
          actual_db: actualDbName,
          server: serverName,
          users: usersCount.recordset[0].count,
          sales_employees: salesEmployeesCount.recordset[0].count,
          items: itemsCount.recordset[0].count,
          customers: customersCount.recordset[0].count
        };
        
        await pool.close();
      } catch (err) {
        results[dbName] = {
          status: '❌ Failed',
          error: err.message,
          configured_db: dbConfigs[dbName]?.database || 'Unknown'
        };
      }
    }
    
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const testNexchem = async (req, res) => {
  try {
    const result = await testDatabaseConnection('NEXCHEM');
    res.json(result);
  } catch (err) {
    res.status(500).json({ 
      database: 'NEXCHEM',
      status: '❌ Failed',
      error: err.message 
    });
  }
};

export const testVan = async (req, res) => {
  try {
    const result = await testDatabaseConnection('VAN');
    res.json(result);
  } catch (err) {
    res.status(500).json({ 
      database: 'VAN',
      status: '❌ Failed',
      error: err.message 
    });
  }
};

export const testVcp = async (req, res) => {
  try {
    const result = await testDatabaseConnection('VCP');
    res.json(result);
  } catch (err) {
    res.status(500).json({ 
      database: 'VCP',
      status: '❌ Failed',
      error: err.message 
    });
  }
};

export const testEndpoint = (req, res) => {
  res.json({ 
    message: "Server is working!",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
};