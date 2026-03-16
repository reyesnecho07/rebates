import express from 'express';
import { 
  registerComponent,
  registerComponents,
  getAvailableRoutePaths,
  refreshRoutePaths,
  scanAllComponents 
} from '../controllers/componentController.js';

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Component routes are working!' });
});

// Register a single component
router.post('/register', registerComponent);

// Register multiple components
router.post('/register-multiple', registerComponents);

// Get available route paths
router.get('/available-paths', getAvailableRoutePaths);

// Refresh component paths (legacy)
router.post('/refresh', refreshRoutePaths);

// Scan all components from file system
router.post('/scan-all', scanAllComponents);

// Add this test route to verify database connection
router.get('/test-db', async (req, res) => {
  try {
    const config = getDatabaseConfig('USER');
    const pool = await sql.connect(config);
    
    // Test query
    const result = await pool.request()
      .query('SELECT 1 as test');
    
    await pool.close();
    
    res.json({ 
      success: true, 
      message: 'Database connected successfully',
      data: result.recordset
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      details: {
        name: error.name,
        code: error.code
      }
    });
  }
});

export default router;