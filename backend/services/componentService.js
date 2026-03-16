import sql from 'mssql';
import { getDatabaseConfig } from '../config/database.js';

class ComponentService {
  async saveComponentMetadata(componentData) {
    let pool = null;
    try {
      console.log('💾 Attempting to save component metadata...');
      console.log('📦 Component data:', JSON.stringify(componentData, null, 2));
      
      // Force using USER database
      const config = getDatabaseConfig('USER');
      console.log('🔌 Connecting to USER database...');
      
      pool = await sql.connect(config);
      console.log('✅ Connected to USER database');
      
      const {
        name,
        componentName,
        routePath,
        version = '1.0.0',
        description = '',
        metadata = {}
      } = componentData;

      const componentIdentifier = name || componentName;
      
      if (!componentIdentifier) {
        throw new Error('Component name is required');
      }

      console.log(`📊 Processing component: ${componentIdentifier}`);

      // Prepare metadata JSON
      const metadataJson = JSON.stringify({
        ...metadata,
        name: componentIdentifier,
        description,
        version,
        routePath,
        registeredAt: new Date().toISOString()
      });

      console.log('📝 Executing SQL query...');
      
      const result = await pool.request()
        .input('componentName', sql.NVarChar(255), componentIdentifier)
        .input('routePath', sql.NVarChar(500), routePath || '')
        .input('version', sql.NVarChar(50), version)
        .input('metadata', sql.NVarChar(sql.MAX), metadataJson) // Use MAX for large text
        .input('viewedAt', sql.DateTime, new Date())
        .query(`
          IF EXISTS (SELECT 1 FROM ComponentMeta WHERE ComponentName = @componentName)
          BEGIN
            UPDATE ComponentMeta
            SET RoutePath = @routePath,
                ComponentVersion = @version,
                Metadata = @metadata,
                ViewedAt = @viewedAt
            WHERE ComponentName = @componentName
            
            SELECT 'updated' as action, ComponentName, RoutePath, ViewedAt
            FROM ComponentMeta
            WHERE ComponentName = @componentName
          END
          ELSE
          BEGIN
            INSERT INTO ComponentMeta (
              ComponentName, RoutePath, ComponentVersion, 
              Metadata, ViewedAt
            )
            VALUES (
              @componentName, @routePath, @version,
              @metadata, @viewedAt
            )
            
            SELECT 'inserted' as action, ComponentName, RoutePath, ViewedAt
            FROM ComponentMeta
            WHERE ComponentName = @componentName
          END
        `);

      console.log('✅ SQL query executed successfully');
      console.log('📊 Query result:', result.recordset[0]);

      await pool.close();
      console.log('🔌 Database connection closed');

      return {
        success: true,
        action: result.recordset[0].action,
        componentName: componentIdentifier,
        routePath,
        viewedAt: result.recordset[0].ViewedAt
      };
      
    } catch (error) {
      console.error('❌ Error in saveComponentMetadata:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      
      // Log SQL specific errors
      if (error.code) console.error('SQL Error code:', error.code);
      if (error.number) console.error('SQL Error number:', error.number);
      if (error.state) console.error('SQL Error state:', error.state);
      
      throw error;
    } finally {
      if (pool) {
        try { 
          await pool.close(); 
        } catch (e) { 
          console.error('Error closing pool:', e); 
        }
      }
    }
  }
}

export default new ComponentService();