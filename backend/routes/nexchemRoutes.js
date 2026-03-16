import express from 'express';
import nexchemController from '../controllers/nexchemController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/sales-employees', asyncHandler(nexchemController.getSalesEmployees));
router.get('/items', asyncHandler(nexchemController.getItems));
router.get('/customer', asyncHandler(nexchemController.getCustomers));
router.get('/invoice', asyncHandler(nexchemController.getInvoices));


export default router;