// middleware/dbMiddleware.js
import { getPool } from '../services/databaseService.js';

export const dbMiddleware = async (req, res, next) => {
  try {
    // Get database name from query parameter or body
    const dbParam = req.query.db || req.body.db;
    
    if (!dbParam) {
      return res.status(400).json({
        success: false,
        error: 'Database parameter (db) is required'
      });
    }
    
    // Get the appropriate database pool
    const pool = await getPool(dbParam);
    
    if (!pool) {
      return res.status(400).json({
        success: false,
        error: `Database '${dbParam}' is not configured or unavailable`
      });
    }
    
    // Attach database pool to request object
    req.db = pool;
    req.database = dbParam;
    
    console.log(`📊 Using database: ${dbParam}`);
    next();
  } catch (error) {
    console.error('❌ Database middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Database connection error'
    });
  }
};