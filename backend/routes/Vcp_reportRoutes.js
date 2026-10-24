import express           from 'express';
import * as reportCtrl   from '../controllers/Vcp_reportController.js';

const router = express.Router();

// ── Dropdown data ─────────────────────────────────────────────────────────────
router.get('/rebates',                        reportCtrl.getActiveRebates);
router.get('/customers',                      reportCtrl.getAllCustomers);
router.get('/rebates/:rebateCode/customers',  reportCtrl.getCustomersByRebate);

// ── Report generation ─────────────────────────────────────────────────────────
router.post('/cash-fund',                     reportCtrl.generateCashFundReport);

// ── Payout sync helper ────────────────────────────────────────────────────────
router.post('/sync-payouts',                  reportCtrl.syncPayoutsForReport);

export default router;