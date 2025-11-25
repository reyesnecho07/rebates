import sql from 'mssql';
import { getDatabaseConfig } from '../config/database.js';

export class SyncService {
  constructor() {
    this.localDbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      server: process.env.DB_HOST,
      database: process.env.DB_NAME,
      pool: {
        max: 20,
        min: 2,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 60000
      },
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 60000,
        requestTimeout: 60000
      }
    };
    this.localPool = null;
    this.cache = new Map(); // Cache for existing records
    this.lastSyncTime = new Map(); // Track last sync time per table
  }

  // Get or create connection pool
  async getLocalPool() {
    if (!this.localPool) {
      this.localPool = new sql.ConnectionPool(this.localDbConfig);
      await this.localPool.connect();
      console.log('✅ Local database connection pool created');
    }
    
    // Check if connection is still alive
    try {
      await this.localPool.request().query('SELECT 1 as test');
    } catch (error) {
      console.log('🔄 Reconnecting local database pool...');
      this.localPool = new sql.ConnectionPool(this.localDbConfig);
      await this.localPool.connect();
    }
    
    return this.localPool;
  }

  // Close connection pool
  async closeLocalPool() {
    if (this.localPool) {
      try {
        await this.localPool.close();
        console.log('✅ Local database connection pool closed');
      } catch (error) {
        console.error('Error closing pool:', error);
      }
      this.localPool = null;
    }
  }

  // Helper function to safely convert any value to string and trim
  safeToString(value) {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number') {
      return value.toString().trim();
    }
    if (typeof value === 'boolean') {
      return value.toString().trim();
    }
    return String(value).trim();
  }

  // Helper function to check for invalid strings in sales employees
  isValidSalesEmployee(employee) {
    if (!employee.SlpCode || !employee.SlpName) {
      console.log('❌ Invalid employee - missing code or name:', employee);
      return false;
    }
    
    // Safely convert to strings
    const slpCode = this.safeToString(employee.SlpCode);
    const slpName = this.safeToString(employee.SlpName);
    
    // Check if both are empty after conversion
    if (!slpCode && !slpName) {
      console.log('❌ Invalid employee - both code and name are empty:', employee);
      return false;
    }

    const invalidPatterns = [
      /test/i,
      /dummy/i,
      /invalid/i,
      /temp/i,
      /^x+$/i, // Only X characters
      /^_+$/i, // Only underscore characters
      /^\s*$/, // Only whitespace
      /^null$/i,
      /^undefined$/i,
      /^0+$/, // Only zeros
    ];
    
    // Check if SlpCode or SlpName matches any invalid pattern
    for (const pattern of invalidPatterns) {
      if (pattern.test(slpCode) || pattern.test(slpName)) {
        console.log('❌ Invalid employee - matches invalid pattern:', employee, pattern);
        return false;
      }
    }
    
    // Check if both code and name are meaningful (not just special characters/numbers)
    const hasMeaningfulContent = (str) => {
      if (!str || str.length === 0) return false;
      
      // Check if it's only numbers or special characters
      if (/^[\d\s\-_\.]+$/.test(str)) {
        return false;
      }
      
      // Check if it has at least one letter character
      return /[a-zA-Z]/.test(str);
    };
    
    const isValid = hasMeaningfulContent(slpCode) || hasMeaningfulContent(slpName);
    
    if (!isValid) {
      console.log('❌ Invalid employee - no meaningful content:', employee);
    }
    
    return isValid;
  }

  // Helper function to handle null values in items
  processItemData(item) {
    const processedItem = { ...item };
    
    // Safely handle ItemCode
    if (!processedItem.ItemCode) {
      processedItem.ItemCode = '-';
    } else {
      processedItem.ItemCode = this.safeToString(processedItem.ItemCode);
      if (processedItem.ItemCode === '') {
        processedItem.ItemCode = '-';
      }
    }
    
    // Safely handle ItemName
    if (!processedItem.ItemName) {
      processedItem.ItemName = '-';
    } else {
      processedItem.ItemName = this.safeToString(processedItem.ItemName);
      if (processedItem.ItemName === '') {
        processedItem.ItemName = '-';
      }
    }
    
    return processedItem;
  }

  // Remove duplicates from array based on key
  removeDuplicates(array, key) {
    const seen = new Set();
    return array.filter(item => {
      const keyValue = this.safeToString(item[key]);
      if (seen.has(keyValue)) {
        return false;
      }
      seen.add(keyValue);
      return true;
    });
  }

  // Get existing records from cache or database
  async getExistingRecords(table, keyField) {
    const cacheKey = `${table}_${keyField}`;
    
    // Return from cache if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const localPool = await this.getLocalPool();
    try {
      const query = `SELECT ${keyField} FROM ${table}`;
      const result = await localPool.request().query(query);
      const existingSet = new Set(result.recordset.map(record => this.safeToString(record[keyField])));
      
      // Cache the result
      this.cache.set(cacheKey, existingSet);
      return existingSet;
    } catch (error) {
      console.error(`Error getting existing records for ${table}:`, error);
      return new Set();
    }
  }

  // Clear cache for a specific table
  clearCache(table, keyField) {
    const cacheKey = `${table}_${keyField}`;
    this.cache.delete(cacheKey);
  }

  // Execute query with retry logic
  async executeQueryWithRetry(request, query, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await request.query(query);
        return result;
      } catch (error) {
        lastError = error;
        
        if (error.code === 'ECONNCLOSED' && attempt < maxRetries) {
          console.log(`🔄 Connection closed, retrying query (attempt ${attempt + 1}/${maxRetries})...`);
          // Reconnect pool
          await this.closeLocalPool();
          await this.getLocalPool();
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          continue;
        }
        
        break;
      }
    }
    
    throw lastError;
  }

  // Get SAP data based on database
  async getSapData(database, table) {
    let pool;
    try {
      const dbConfig = getDatabaseConfig(database);
      pool = await sql.connect(dbConfig);
      
      let query = '';
      switch (table) {
        case 'salesEmployees':
          query = "SELECT SlpCode, SlpName FROM OSLP ORDER BY SlpName";
          break;
        case 'customers':
          query = "SELECT CardCode, CardName FROM OCRD WHERE CardType = 'C' ORDER BY CardName";
          break;
        case 'items':
          query = "SELECT ItemCode, ItemName FROM OITM ORDER BY ItemName";
          break;
        default:
          throw new Error(`Unknown table: ${table}`);
      }

      const result = await pool.request().query(query);
      
      console.log(`📊 Fetched ${result.recordset.length} ${table} from ${database}`);
      return result.recordset;
    } catch (error) {
      console.error(`Error fetching ${table} from ${database}:`, error);
      throw error;
    } finally {
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          console.error('Error closing SAP pool:', closeError);
        }
      }
    }
  }

  // Sync data to local database - OPTIMIZED VERSION
  async syncToLocalDatabase(database, data, table) {
    const localPool = await this.getLocalPool();
    
    try {
      let result;
      switch (table) {
        case 'salesEmployees':
          result = await this.syncSalesEmployees(localPool, data, database);
          break;
        case 'customers':
          result = await this.syncCustomers(localPool, data, database);
          break;
        case 'items':
          result = await this.syncItems(localPool, data, database);
          break;
        default:
          throw new Error(`Unknown table: ${table}`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error in syncToLocalDatabase for ${table}:`, error);
      throw error;
    }
  }

  // OPTIMIZED: Sync sales employees with batch operations
  async syncSalesEmployees(localPool, sapData, database) {
    const startTime = Date.now();
    const results = {
      added: 0,
      updated: 0,
      skipped: 0,
      invalid: 0,
      duplicates: 0,
      total: sapData.length
    };

    try {
      // Remove duplicates from SAP data first
      const uniqueSapData = this.removeDuplicates(sapData, 'SlpCode');
      results.duplicates = sapData.length - uniqueSapData.length;

      // Get existing records
      const existingCodes = await this.getExistingRecords('SalesEmployee', 'SlpCode');
      
      const toInsert = [];
      const toUpdate = [];

      // Separate new and existing records
      for (const employee of uniqueSapData) {
        try {
          // Validate sales employee data
          if (!this.isValidSalesEmployee(employee)) {
            results.invalid++;
            continue;
          }

          // Clean the data using safe conversion
          const cleanEmployee = {
            SlpCode: this.safeToString(employee.SlpCode),
            SlpName: this.safeToString(employee.SlpName)
          };

          if (existingCodes.has(cleanEmployee.SlpCode)) {
            toUpdate.push(cleanEmployee);
          } else {
            toInsert.push(cleanEmployee);
          }
        } catch (error) {
          console.error('Error processing employee:', employee, error);
          results.skipped++;
        }
      }

      // Batch insert new records
      if (toInsert.length > 0) {
        const transaction = new sql.Transaction(localPool);
        try {
          await transaction.begin();
          
          for (const employee of toInsert) {
            const request = new sql.Request(transaction);
            await request
              .input('SlpCode', sql.VarChar, employee.SlpCode)
              .input('SlpName', sql.VarChar, employee.SlpName)
              .query(`
                INSERT INTO SalesEmployee (SlpCode, SlpName)
                VALUES (@SlpCode, @SlpName)
              `);
          }
          
          await transaction.commit();
          results.added = toInsert.length;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }

      // Batch update existing records
      if (toUpdate.length > 0) {
        const transaction = new sql.Transaction(localPool);
        try {
          await transaction.begin();
          
          for (const employee of toUpdate) {
            const request = new sql.Request(transaction);
            await request
              .input('SlpCode', sql.VarChar, employee.SlpCode)
              .input('SlpName', sql.VarChar, employee.SlpName)
              .query(`
                UPDATE SalesEmployee 
                SET SlpName = @SlpName
                WHERE SlpCode = @SlpCode
              `);
          }
          
          await transaction.commit();
          results.updated = toUpdate.length;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }

      // Clear cache to force refresh on next call
      this.clearCache('SalesEmployee', 'SlpCode');

      const duration = Date.now() - startTime;
      console.log(`✅ Sales Employees sync (${duration}ms): ${results.added} added, ${results.updated} updated, ${results.invalid} invalid, ${results.duplicates} duplicates, ${results.skipped} skipped`);
      return results;
    } catch (error) {
      console.error('Error in sales employees sync:', error);
      throw error;
    }
  }

  // OPTIMIZED: Sync customers with batch operations
  async syncCustomers(localPool, sapData, database) {
    const startTime = Date.now();
    const results = {
      added: 0,
      updated: 0,
      skipped: 0,
      duplicates: 0,
      total: sapData.length
    };

    try {
      // Remove duplicates from SAP data first
      const uniqueSapData = this.removeDuplicates(sapData, 'CardCode');
      results.duplicates = sapData.length - uniqueSapData.length;

      // Get existing records
      const existingCodes = await this.getExistingRecords('Customer', 'CardCode');
      
      const toInsert = [];
      const toUpdate = [];

      // Separate new and existing records
      for (const customer of uniqueSapData) {
        try {
          // Clean the data using safe conversion
          const cleanCustomer = {
            CardCode: this.safeToString(customer.CardCode) || '-',
            CardName: this.safeToString(customer.CardName) || '-'
          };

          if (existingCodes.has(cleanCustomer.CardCode)) {
            toUpdate.push(cleanCustomer);
          } else {
            toInsert.push(cleanCustomer);
          }
        } catch (error) {
          console.error('Error processing customer:', customer, error);
          results.skipped++;
        }
      }

      // Batch insert new records
      if (toInsert.length > 0) {
        const transaction = new sql.Transaction(localPool);
        try {
          await transaction.begin();
          
          for (const customer of toInsert) {
            const request = new sql.Request(transaction);
            await request
              .input('CardCode', sql.VarChar, customer.CardCode)
              .input('CardName', sql.VarChar, customer.CardName)
              .query(`
                INSERT INTO Customer (CardCode, CardName)
                VALUES (@CardCode, @CardName)
              `);
          }
          
          await transaction.commit();
          results.added = toInsert.length;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }

      // Batch update existing records
      if (toUpdate.length > 0) {
        const transaction = new sql.Transaction(localPool);
        try {
          await transaction.begin();
          
          for (const customer of toUpdate) {
            const request = new sql.Request(transaction);
            await request
              .input('CardCode', sql.VarChar, customer.CardCode)
              .input('CardName', sql.VarChar, customer.CardName)
              .query(`
                UPDATE Customer 
                SET CardName = @CardName
                WHERE CardCode = @CardCode
              `);
          }
          
          await transaction.commit();
          results.updated = toUpdate.length;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }

      // Clear cache to force refresh on next call
      this.clearCache('Customer', 'CardCode');

      const duration = Date.now() - startTime;
      console.log(`✅ Customers sync (${duration}ms): ${results.added} added, ${results.updated} updated, ${results.duplicates} duplicates, ${results.skipped} skipped`);
      return results;
    } catch (error) {
      console.error('Error in customers sync:', error);
      throw error;
    }
  }

  // OPTIMIZED: Sync items with batch operations
  async syncItems(localPool, sapData, database) {
    const startTime = Date.now();
    const results = {
      added: 0,
      updated: 0,
      skipped: 0,
      duplicates: 0,
      total: sapData.length
    };

    try {
      // Remove duplicates from SAP data first
      const uniqueSapData = this.removeDuplicates(sapData, 'ItemCode');
      results.duplicates = sapData.length - uniqueSapData.length;

      // Get existing records
      const existingCodes = await this.getExistingRecords('Items', 'ItemCode');
      
      const toInsert = [];
      const toUpdate = [];

      // Separate new and existing records
      for (const item of uniqueSapData) {
        try {
          // Process item data to handle null values
          const processedItem = this.processItemData(item);

          if (existingCodes.has(processedItem.ItemCode)) {
            toUpdate.push(processedItem);
          } else {
            toInsert.push(processedItem);
          }
        } catch (error) {
          console.error('Error processing item:', item, error);
          results.skipped++;
        }
      }

      // Batch insert new records
      if (toInsert.length > 0) {
        const transaction = new sql.Transaction(localPool);
        try {
          await transaction.begin();
          
          for (const item of toInsert) {
            const request = new sql.Request(transaction);
            await request
              .input('ItemCode', sql.VarChar, item.ItemCode)
              .input('ItemName', sql.VarChar, item.ItemName)
              .query(`
                INSERT INTO Items (ItemCode, ItemName)
                VALUES (@ItemCode, @ItemName)
              `);
          }
          
          await transaction.commit();
          results.added = toInsert.length;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }

      // Batch update existing records
      if (toUpdate.length > 0) {
        const transaction = new sql.Transaction(localPool);
        try {
          await transaction.begin();
          
          for (const item of toUpdate) {
            const request = new sql.Request(transaction);
            await request
              .input('ItemCode', sql.VarChar, item.ItemCode)
              .input('ItemName', sql.VarChar, item.ItemName)
              .query(`
                UPDATE Items 
                SET ItemName = @ItemName
                WHERE ItemCode = @ItemCode
              `);
          }
          
          await transaction.commit();
          results.updated = toUpdate.length;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }

      // Clear cache to force refresh on next call
      this.clearCache('Items', 'ItemCode');

      const duration = Date.now() - startTime;
      console.log(`✅ Items sync (${duration}ms): ${results.added} added, ${results.updated} updated, ${results.duplicates} duplicates, ${results.skipped} skipped`);
      return results;
    } catch (error) {
      console.error('Error in items sync:', error);
      throw error;
    }
  }

  // Get data from local database
  async getLocalData(table) {
    const localPool = await this.getLocalPool();
    
    try {
      let query = '';
      switch (table) {
        case 'salesEmployees':
          query = "SELECT SlpCode, SlpName FROM SalesEmployee ORDER BY SlpName";
          break;
        case 'customers':
          query = "SELECT CardCode, CardName FROM Customer ORDER BY CardName";
          break;
        case 'items':
          query = "SELECT ItemCode, ItemName FROM Items ORDER BY ItemName";
          break;
        default:
          throw new Error(`Unknown table: ${table}`);
      }

      const result = await this.executeQueryWithRetry(localPool.request(), query);
      return result.recordset;
    } catch (error) {
      console.error(`Error getting local data for ${table}:`, error);
      throw error;
    }
  }

  // Get sync status
  async getSyncStatus() {
    const localPool = await this.getLocalPool();
    
    try {
      const statusQuery = `
        SELECT 
          (SELECT COUNT(*) FROM SalesEmployee) as salesEmployeeCount,
          (SELECT COUNT(*) FROM Customer) as customerCount,
          (SELECT COUNT(*) FROM Items) as itemsCount,
          GETDATE() as lastChecked
      `;
      
      const result = await this.executeQueryWithRetry(localPool.request(), statusQuery);
      return result.recordset[0];
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  }

  // Fast refresh - only sync if data has changed
  async fastRefresh(database, table) {
    const cacheKey = `${database}_${table}_lastSync`;
    const lastSync = this.lastSyncTime.get(cacheKey);
    const now = Date.now();
    
    // If we synced recently (within 5 minutes), skip
    if (lastSync && (now - lastSync) < 5 * 60 * 1000) {
      console.log(`⚡ Fast refresh: ${table} was synced recently, skipping`);
      return { skipped: true, reason: 'Recently synced' };
    }

    console.log(`🔄 Full sync required for ${table}`);
    const sapData = await this.getSapData(database, table);
    const result = await this.syncToLocalDatabase(database, sapData, table);
    
    // Update last sync time
    this.lastSyncTime.set(cacheKey, now);
    
    return { ...result, skipped: false };
  }

  // Cleanup method to close pool when application shuts down
  async cleanup() {
    await this.closeLocalPool();
  }
}

export const syncService = new SyncService();

// Handle application shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Shutting down sync service...');
  await syncService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down sync service...');
  await syncService.cleanup();
  process.exit(0);
});