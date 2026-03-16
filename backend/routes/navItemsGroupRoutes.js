import express from 'express';
import navItemsGroupController from '../controllers/navItemsGroupController.js';

const router = express.Router();

// Test route → GET /api/nav-groups/test
router.get('/test', (req, res) => {
  res.json({
    success:   true,
    message:   'Nav groups routes are working',
    timestamp: new Date().toISOString(),
    endpoints: {
      allGroups:    'GET /api/nav-groups/all?db=USER',
      byDatabaseId: 'GET /api/nav-groups/database/:databaseId?db=USER',
      withItems:    'GET /api/nav-groups/with-items?db=USER',
      byDBName:     'GET /api/nav-groups/dbname/:dbName?db=USER',
    }
  });
});

// Flat list of all active groups
router.get('/all',                    navItemsGroupController.getAllGroups);

// Groups that belong to a specific DatabaseID
router.get('/database/:databaseId',   navItemsGroupController.getGroupsByDatabaseId);

// ⭐ Main sidebar endpoint — all DBs with groups + nav items nested
router.get('/with-items',             navItemsGroupController.getGroupedWithNavItems);

// Groups + nav items for a single DB by DBName (e.g. VAN_DB)
router.get('/dbname/:dbName',         navItemsGroupController.getGroupedByDBName);

export default router;