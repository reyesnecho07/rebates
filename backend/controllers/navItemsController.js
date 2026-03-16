import navItemsService from '../services/navItemsService.js';

const navItemsController = {

  // GET /api/nav-items/grouped?db=USER
  // Returns all active nav items grouped by DatabaseID
  async getAllGrouped(req, res) {
    try {
      const dbName = req.query.db || 'USER';
      console.log('📋 navItemsController.getAllGrouped | db:', dbName);

      const grouped = await navItemsService.getAllNavItemsGrouped(dbName);

      res.status(200).json({
        success: true,
        data:    grouped,
        message: 'Nav items fetched successfully'
      });
    } catch (error) {
      console.error('❌ navItemsController.getAllGrouped:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching nav items',
        error:   error.message
      });
    }
  },

  // GET /api/nav-items/database/:databaseId?db=USER
  // Returns active nav items for a single DatabaseID
  async getByDatabaseId(req, res) {
    try {
      const dbName     = req.query.db || 'USER';
      const databaseId = parseInt(req.params.databaseId, 10);

      if (isNaN(databaseId)) {
        return res.status(400).json({ success: false, message: 'Invalid databaseId' });
      }

      console.log(`📋 navItemsController.getByDatabaseId | id:${databaseId} db:${dbName}`);

      const items = await navItemsService.getNavItemsByDatabaseId(databaseId, dbName);

      res.status(200).json({
        success: true,
        data:    items,
        message: 'Nav items fetched successfully'
      });
    } catch (error) {
      console.error('❌ navItemsController.getByDatabaseId:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching nav items',
        error:   error.message
      });
    }
  },

  // GET /api/nav-items/dbname/:dbName?db=USER
  // Returns active nav items for a DBName string (e.g. "VAN_DB")
  async getByDBName(req, res) {
    try {
      const db     = req.query.db || 'USER';
      const dbName = req.params.dbName;

      if (!dbName) {
        return res.status(400).json({ success: false, message: 'Missing dbName parameter' });
      }

      console.log(`📋 navItemsController.getByDBName | dbName:${dbName} db:${db}`);

      const items = await navItemsService.getNavItemsByDBName(dbName, db);

      res.status(200).json({
        success: true,
        data:    items,
        message: 'Nav items fetched successfully'
      });
    } catch (error) {
      console.error('❌ navItemsController.getByDBName:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching nav items',
        error:   error.message
      });
    }
  }

};

export default navItemsController;