import express from 'express';
import { 
  refreshData, 
  getLocalSalesEmployees, 
  getLocalCustomers, 
  getLocalItems,
  getSyncStatus 
} from '../controllers/syncController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.post('/refresh-data', asyncHandler(refreshData));
router.get('/local/sales-employees', asyncHandler(getLocalSalesEmployees));
router.get('/local/customers', asyncHandler(getLocalCustomers));
router.get('/local/items', asyncHandler(getLocalItems));
router.get('/status', asyncHandler(getSyncStatus));

export default router;