import express from 'express';
import vcpController from '../controllers/vcpController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/sales-employees', asyncHandler(vcpController.getSalesEmployees));
router.get('/items', asyncHandler(vcpController.getItems));
router.get('/customer', asyncHandler(vcpController.getCustomers));
router.get('/invoice', asyncHandler(vcpController.getInvoices));

export default router;