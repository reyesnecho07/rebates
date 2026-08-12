import express from 'express';
import {
  getAvailableDatabases,
  getSalesEmployees,
  getCustomers,
  getItems,
  getSyncStatus,
  getAllSyncStatus,
  getAllSalesEmployees,
  getAllCustomers,
  getAllItems
} from '../controllers/syncController.js';

const router = express.Router();

// Info
router.get('/databases', getAvailableDatabases);

// Single-database reads (?db=VAN|NEXCHEM|VCP or ?system=van|nexchem|vcp)
router.get('/sales-employees', getSalesEmployees);
router.get('/customers', getCustomers);
router.get('/items', getItems);
router.get('/status', getSyncStatus);

// All-databases-at-once reads
router.get('/status/all', getAllSyncStatus);
router.get('/sales-employees/all', getAllSalesEmployees);
router.get('/customers/all', getAllCustomers);
router.get('/items/all', getAllItems);

export default router;