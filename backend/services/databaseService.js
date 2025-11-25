import sql from 'mssql';
import { getDatabaseConfig } from '../config/database.js';

// Connection pools for better performance
export const pools = {};

// Initialize connection pools
export const initializePools = async () => {
  const allConfigs = getDatabaseConfig(); // Get all configs
  
  for (const [dbName, config] of Object.entries(allConfigs)) {
    try {
      pools[dbName] = new sql.ConnectionPool(config);
      await pools[dbName].connect();
      console.log(`✅ Connection pool created for ${dbName}`);
    } catch (err) {
      console.error(`❌ Failed to create connection pool for ${dbName}:`, err.message);
    }
  }
};

// Enhanced database operation handler with connection pooling
export const handleDatabaseOperation = async (database, operation) => {
  try {
    const dbConfig = getDatabaseConfig(database);
    console.log(`🔗 Connecting to ${database}: ${dbConfig.database} on ${dbConfig.server}`);
    
    // Use connection pool if available, otherwise create new connection
    let pool;
    if (pools[database] && pools[database].connected) {
      pool = pools[database];
    } else {
      pool = await sql.connect(dbConfig);
    }
    
    return await operation(pool);
  } catch (err) {
    console.error(`Error in ${database} database operation:`, err);
    throw err;
  }
};

// Test individual database connection
export const testDatabaseConnection = async (database) => {
  try {
    const dbConfig = getDatabaseConfig(database);
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query("SELECT DB_NAME() as dbname, COUNT(*) as user_count FROM OUSR");
    await pool.close();
    
    return {
      database,
      actual_db: result.recordset[0].dbname,
      users: result.recordset[0].user_count,
      status: '✅ Connected'
    };
  } catch (err) {
    return {
      database,
      status: '❌ Failed',
      error: err.message
    };
  }
};