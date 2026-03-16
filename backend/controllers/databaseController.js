import sidebarDatabaseService from '../services/SidebarDatabaseService.js';
import { getDatabaseConfig } from '../config/database.js';

const databaseController = {
  // Get all active databases
  async getAllDatabases(req, res) {
    try {
      const dbName = req.query.db || 'USER';
      console.log('='.repeat(50));
      console.log('📊 getAllDatabases called');
      console.log('📊 Using database:', dbName);
      
      // Log database config (without password)
      const dbConfig = getDatabaseConfig(dbName);
      console.log('🔌 Database config:', {
        server: dbConfig.server,
        database: dbConfig.database,
        user: dbConfig.user,
        port: dbConfig.port
      });

      const userId = req.user?.id || 1; // Default to 1 if no user in request
      console.log('👤 User ID:', userId);
      
      const databases = await sidebarDatabaseService.getAllDatabasesWithUserOrder(userId, dbName);
      
      console.log('✅ Found databases:', databases.length);
      console.log('📋 Database records:', JSON.stringify(databases, null, 2));
      console.log('='.repeat(50));
      
      res.status(200).json({
        success: true,
        data: databases,
        message: 'Databases fetched successfully'
      });
    } catch (error) {
      console.error('❌ Error in getAllDatabases:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching databases',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  // Get single database by name
  async getDatabaseByName(req, res) {
    try {
      const dbName = req.query.db || 'USER';
      const { name } = req.params;
      
      console.log('='.repeat(50));
      console.log('📊 getDatabaseByName called for:', name);
      console.log('📊 Using database:', dbName);
      
      const dbConfig = getDatabaseConfig(dbName);
      console.log('🔌 Database config:', {
        server: dbConfig.server,
        database: dbConfig.database,
        user: dbConfig.user,
        port: dbConfig.port
      });

      const database = await sidebarDatabaseService.getDatabaseByName(name, dbName);
      
      if (!database) {
        console.log('❌ Database not found:', name);
        return res.status(404).json({
          success: false,
          message: 'Database not found or inactive'
        });
      }
      
      console.log('✅ Database found:', JSON.stringify(database, null, 2));
      console.log('='.repeat(50));
      
      res.status(200).json({
        success: true,
        data: database,
        message: 'Database fetched successfully'
      });
    } catch (error) {
      console.error('❌ Error in getDatabaseByName:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching database',
        error: error.message
      });
    }
  },

  // Check if database is active
  async checkDatabaseActive(req, res) {
    try {
      const dbName = req.query.db || 'USER';
      const { name } = req.params;
      
      console.log('📊 checkDatabaseActive for:', name);
      
      const isActive = await sidebarDatabaseService.checkDatabaseActive(name, dbName);
      
      console.log(`✅ Database ${name} is ${isActive ? 'active' : 'inactive'}`);
      
      res.status(200).json({
        success: true,
        data: { isActive },
        message: 'Database status checked successfully'
      });
    } catch (error) {
      console.error('❌ Error in checkDatabaseActive:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking database status',
        error: error.message
      });
    }
  }
};

export default databaseController;