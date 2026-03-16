import sql from 'mssql';
import { getDatabaseConfig } from '../config/database.js';

class SidebarDatabaseService {
  async getAllDatabasesWithUserOrder(userId, database = 'USER') {
    try {
      console.log('🔍 Fetching all databases from:', database);
      
      const dbConfig = getDatabaseConfig(database);
      const pool = await sql.connect(dbConfig);

      const query = `
        SELECT
          DatabaseID,
          DBName,
          ConnectionString,
          IsActive,
          CreatedAt,
          UpdatedAt,
          DBTag
        FROM Databases
        ORDER BY 
          CASE 
            WHEN DBName = 'VAN_DB' THEN 1
            WHEN DBName = 'NEXCHEM_DB' THEN 2
            WHEN DBName = 'VCP_DB' THEN 3
            ELSE 4
          END
      `;

      console.log('📝 Executing query:', query);
      
      const result = await pool.request().query(query);
      
      console.log(`✅ Query returned ${result.recordset.length} records`);
      
      await pool.close();
      
      return result.recordset;
    } catch (error) {
      console.error('❌ Error in getAllDatabasesWithUserOrder:', error);
      throw error;
    }
  }

  async getDatabaseByName(dbName, database = 'USER') {
    try {
      console.log(`🔍 Fetching database by name: ${dbName} from:`, database);
      
      const dbConfig = getDatabaseConfig(database);
      const pool = await sql.connect(dbConfig);

      const query = `
        SELECT
          DatabaseID,
          DBName,
          ConnectionString,
          IsActive,
          CreatedAt,
          UpdatedAt,
          DBTag
        FROM Databases
        WHERE DBName = @dbName
      `;

      console.log('📝 Executing query:', query, 'with dbName:', dbName);

      const result = await pool.request()
        .input('dbName', sql.NVarChar, dbName)
        .query(query);
      
      await pool.close();
      
      console.log(`✅ Query returned ${result.recordset.length} records`);
      
      return result.recordset[0] || null;
    } catch (error) {
      console.error('❌ Error in getDatabaseByName:', error);
      throw error;
    }
  }

  async checkDatabaseActive(dbName, database = 'USER') {
    try {
      console.log(`🔍 Checking if database is active: ${dbName} from:`, database);
      
      const dbConfig = getDatabaseConfig(database);
      const pool = await sql.connect(dbConfig);

      const query = `
        SELECT IsActive
        FROM Databases
        WHERE DBName = @dbName
      `;

      const result = await pool.request()
        .input('dbName', sql.NVarChar, dbName)
        .query(query);
      
      await pool.close();
      
      const isActive = result.recordset[0] ? result.recordset[0].IsActive === 1 : false;
      console.log(`✅ Database ${dbName} is ${isActive ? 'active' : 'inactive'}`);
      
      return isActive;
    } catch (error) {
      console.error('❌ Error in checkDatabaseActive:', error);
      throw error;
    }
  }
}

export default new SidebarDatabaseService();