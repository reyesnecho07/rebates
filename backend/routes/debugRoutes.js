import express from 'express';
import { 
  healthCheck, 
  debugDatabases, 
  testNexchem, 
  testVan, 
  testVcp, 
  testEndpoint 
} from '../controllers/debugController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/health', healthCheck);
router.get('/debug-databases', asyncHandler(debugDatabases));
router.get('/test-nexchem', asyncHandler(testNexchem));
router.get('/test-van', asyncHandler(testVan));
router.get('/test-vcp', asyncHandler(testVcp));
router.get('/test', testEndpoint);

export default router;