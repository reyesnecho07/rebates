import express from 'express';
import databaseController from '../controllers/databaseController.js';

const router = express.Router();

// Test route → GET /api/databases/test
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Database routes are working',
    timestamp: new Date().toISOString()
  });
});

// Get all databases → GET /api/databases
router.get('/', databaseController.getAllDatabases);

// Get single database by name → GET /api/databases/:name
router.get('/:name', databaseController.getDatabaseByName);

// Check if database is active → GET /api/databases/:name/active
router.get('/:name/active', databaseController.checkDatabaseActive);

export default router;