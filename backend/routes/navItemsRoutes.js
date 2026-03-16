import express from 'express';
import navItemsController from '../controllers/navItemsController.js';

const router = express.Router();

// Test route → GET /api/nav-items/test
router.get('/test', (req, res) => {
  res.json({
    success:   true,
    message:   'Nav items routes are working',
    timestamp: new Date().toISOString(),
    endpoints: {
      grouped:        'GET /api/nav-items/grouped?db=USER',
      byDatabaseId:   'GET /api/nav-items/database/:databaseId?db=USER',
      byDBName:       'GET /api/nav-items/dbname/:dbName?db=USER',
    }
  });
});

// All active nav items grouped by DatabaseID
// GET /api/nav-items/grouped?db=USER
router.get('/grouped', navItemsController.getAllGrouped);

// Nav items for a specific database (by numeric ID)
// GET /api/nav-items/database/1?db=USER
router.get('/database/:databaseId', navItemsController.getByDatabaseId);

// Nav items for a specific database (by DBName string)
// GET /api/nav-items/dbname/VAN_DB?db=USER
router.get('/dbname/:dbName', navItemsController.getByDBName);

export default router;