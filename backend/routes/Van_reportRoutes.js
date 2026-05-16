import express from 'express';
import { listRebates, generateReport, getCustomersForRebate } from '../controllers/Van_reportController.js';

const router = express.Router();

router.get('/rebates', listRebates);
router.post('/generate', generateReport);
router.get('/rebate/:rebateCode/customers', getCustomersForRebate);

export default router;