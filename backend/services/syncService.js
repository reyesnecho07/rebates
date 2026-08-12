import sql from 'mssql';
import { getDatabaseConfig } from '../config/database.js';

// All data now lives directly on 192.168.100.100 (VAN_DB, NEXCHEM_DB, VCP_DB).
// SAP is mirrored there already via stored procs, so no ETL/sync is needed anymore.
const DATABASES = ['VAN', 'NEXCHEM', 'VCP'];
const ALL_DATABASES = [...DATABASES, 'USER'];

export class SyncService {
  constructor() {
    this.pools = new Map();
  }

  // Get or create connection pool for a database
  async getPool(database = 'VAN') {
    if (!ALL_DATABASES.includes(database)) {
      throw new Error(`Invalid database: ${database}. Allowed: ${ALL_DATABASES.join(', ')}`);
    }

    if (!this.pools.has(database)) {
      const dbConfig = getDatabaseConfig(database);

      if (!dbConfig || !dbConfig.server) {
        throw new Error(`Database configuration for ${database} is missing or invalid`);
      }

      console.log(`🔗 Creating connection pool for ${database}: ${dbConfig.database} on ${dbConfig.server}`);

      try {
        const pool = new sql.ConnectionPool(dbConfig);
        await pool.connect();
        this.pools.set(database, pool);
        console.log(`✅ Connection pool created for ${database}`);
      } catch (error) {
        console.error(`❌ Failed to create pool for ${database}:`, error);
        throw error;
      }
    }

    const pool = this.pools.get(database);

    // Check if connection is still alive, reconnect if not
    try {
      await pool.request().query('SELECT 1 as test');
    } catch (error) {
      console.log(`🔄 Reconnecting pool for ${database}...`);
      const dbConfig = getDatabaseConfig(database);
      const newPool = new sql.ConnectionPool(dbConfig);
      await newPool.connect();
      this.pools.set(database, newPool);
      return newPool;
    }

    return pool;
  }

  async closePool(database) {
    if (this.pools.has(database)) {
      try {
        await this.pools.get(database).close();
        console.log(`✅ Connection pool closed for ${database}`);
        this.pools.delete(database);
      } catch (error) {
        console.error(`Error closing pool for ${database}:`, error);
      }
    }
  }

  async closeAllPools() {
    const closePromises = [];
    for (const [database, pool] of this.pools.entries()) {
      closePromises.push(
        pool.close().then(() => {
          console.log(`✅ Pool closed for ${database}`);
        }).catch(error => {
          console.error(`Error closing pool for ${database}:`, error);
        })
      );
    }
    await Promise.all(closePromises);
    this.pools.clear();
    console.log('✅ All connection pools closed');
  }

  // Execute query with retry logic (kept for resilience on transient disconnects)
  async executeQueryWithRetry(request, query, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await request.query(query);
      } catch (error) {
        lastError = error;
        if (error.code === 'ECONNCLOSED' && attempt < maxRetries) {
          console.log(`🔄 Connection closed, retrying query (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        break;
      }
    }
    throw lastError;
  }

  // Fetch data directly from VAN/NEXCHEM/VCP (already mirrored from SAP on 100.100)
  async getLocalData(table, database = 'VAN') {
    if (!DATABASES.includes(database)) {
      throw new Error(`Invalid database: ${database}. Must be one of: ${DATABASES.join(', ')}`);
    }

    const pool = await this.getPool(database);

    let query = '';
    switch (table) {
      case 'salesEmployees':
        query = "SELECT SlpCode, SlpName FROM OSLP WHERE SlpName <> '' ORDER BY SlpName";
        break;

      case 'customers':
        query = `
          SELECT
            T0.CardCode,
            T0.CardName,
            T1.GroupName,
            T2.SlpName
          FROM
            OCRD T0
            INNER JOIN OCRG T1 ON T0.GroupCode = T1.GroupCode
            INNER JOIN OSLP T2 ON T0.SlpCode = T2.SlpCode
          ORDER BY T0.CardName
        `;
        break;

      case 'items':
        query = `
          SELECT
            T0.ItemCode,
            T0.ItemName,
            T1.ItmsGrpNam
          FROM
            OITM T0
            INNER JOIN OITB T1 ON T0.ItmsGrpCod = T1.ItmsGrpCod
          WHERE
            T0.ItemName <> ''
            AND T1.ItmsGrpNam IN (
              'CHEMICALS',
              'FOLIAR',
              'RAW MATERIALS',
              'FERTILIZER',
              'PACKAGING MATS',
              'PROMO MATS',
              'SPECIAL PRODUCT',
              'FEEDTAG',
              'FG',
              'FG-BJLAC',
              'SACK',
              'VETERINARY'
            )
          ORDER BY T0.ItemName
        `;
        break;

      default:
        throw new Error(`Unknown table: ${table}`);
    }

    try {
      const result = await this.executeQueryWithRetry(pool.request(), query);
      console.log(`📊 Fetched ${result.recordset.length} ${table} from ${database}`);
      return result.recordset;
    } catch (error) {
      console.error(`Error getting ${table} from ${database}:`, error);
      throw error;
    }
  }

  // Quick row-count status for a database
  async getSyncStatus(database = 'VAN') {
    if (!DATABASES.includes(database)) {
      throw new Error(`Invalid database: ${database}. Must be one of: ${DATABASES.join(', ')}`);
    }

    const pool = await this.getPool(database);

    try {
      const statusQuery = `
        SELECT
          (SELECT COUNT(*) FROM OSLP WHERE SlpName <> '') as salesEmployeeCount,
          (SELECT COUNT(*) FROM OCRD) as customerCount,
          (SELECT COUNT(*) FROM OITM WHERE ItemName <> '') as itemsCount,
          GETDATE() as lastChecked
      `;
      const result = await this.executeQueryWithRetry(pool.request(), statusQuery);
      return {
        ...result.recordset[0],
        database
      };
    } catch (error) {
      console.error(`Error getting status from ${database}:`, error);
      throw error;
    }
  }

  async cleanup() {
    await this.closeAllPools();
  }
}

export const syncService = new SyncService();

process.on('SIGINT', async () => {
  console.log('🔄 Shutting down data service...');
  await syncService.cleanup();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down data service...');
  await syncService.cleanup();
  process.exit(0);
});