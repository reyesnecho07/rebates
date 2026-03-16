import navItemsGroupService from '../services/navItemsGroupService.js';

const navItemsGroupController = {

  // GET /api/nav-groups/all?db=USER
  async getAllGroups(req, res) {
    try {
      const database = req.query.db || 'USER';
      console.log('📋 navItemsGroupController.getAllGroups | db:', database);

      const groups = await navItemsGroupService.getAllGroups(database);

      res.status(200).json({
        success: true,
        data:    groups,
        message: `Fetched ${groups.length} groups`
      });
    } catch (error) {
      console.error('❌ navItemsGroupController.getAllGroups:', error);
      res.status(500).json({ success: false, message: 'Error fetching groups', error: error.message });
    }
  },

  // GET /api/nav-groups/database/:databaseId?db=USER
  async getGroupsByDatabaseId(req, res) {
    try {
      const database   = req.query.db || 'USER';
      const databaseId = parseInt(req.params.databaseId, 10);

      if (isNaN(databaseId)) {
        return res.status(400).json({ success: false, message: 'Invalid databaseId' });
      }

      console.log(`📋 navItemsGroupController.getGroupsByDatabaseId | id:${databaseId} db:${database}`);

      const groups = await navItemsGroupService.getGroupsByDatabaseId(databaseId, database);

      res.status(200).json({
        success: true,
        data:    groups,
        message: `Fetched ${groups.length} groups for database ${databaseId}`
      });
    } catch (error) {
      console.error('❌ navItemsGroupController.getGroupsByDatabaseId:', error);
      res.status(500).json({ success: false, message: 'Error fetching groups', error: error.message });
    }
  },

  // GET /api/nav-groups/with-items?db=USER  ← Sidebar uses this
  async getGroupedWithNavItems(req, res) {
    try {
      const database = req.query.db || 'USER';
      console.log('📋 navItemsGroupController.getGroupedWithNavItems | db:', database);

      const data = await navItemsGroupService.getGroupedWithNavItems(database);

      res.status(200).json({
        success: true,
        data,
        message: 'Fetched grouped nav items with groups'
      });
    } catch (error) {
      console.error('❌ navItemsGroupController.getGroupedWithNavItems:', error);
      res.status(500).json({ success: false, message: 'Error fetching grouped nav items', error: error.message });
    }
  },

  // GET /api/nav-groups/dbname/:dbName?db=USER
  async getGroupedByDBName(req, res) {
    try {
      const database = req.query.db || 'USER';
      const dbName   = req.params.dbName;

      if (!dbName) {
        return res.status(400).json({ success: false, message: 'Missing dbName parameter' });
      }

      console.log(`📋 navItemsGroupController.getGroupedByDBName | dbName:${dbName} db:${database}`);

      const data = await navItemsGroupService.getGroupedByDBName(dbName, database);

      res.status(200).json({
        success: true,
        data,
        message: `Fetched grouped nav items for ${dbName}`
      });
    } catch (error) {
      console.error('❌ navItemsGroupController.getGroupedByDBName:', error);
      res.status(500).json({ success: false, message: 'Error fetching grouped nav items', error: error.message });
    }
  }

};

export default navItemsGroupController;