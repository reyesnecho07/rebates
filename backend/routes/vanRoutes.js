import express from 'express';
import vanController from '../controllers/vanController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/sales-employees', asyncHandler(vanController.getSalesEmployees));
router.get('/items', asyncHandler(vanController.getItems));
router.get('/customer', asyncHandler(vanController.getCustomers));
router.get('/invoice', asyncHandler(vanController.getInvoices));

export default router;