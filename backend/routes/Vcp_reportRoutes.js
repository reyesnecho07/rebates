/**
 * Vcp_reportRoutes.js
 *
 * Mount in your main app with:
 *   import vcpReportRoutes from './routes/Vcp_reportRoutes.js';
 *   app.use('/api/vcp/report', vcpReportRoutes);
 */

import express           from 'express';
import * as reportCtrl   from '../controllers/Vcp_reportController.js';

const router = express.Router();

// ── Dropdown data ─────────────────────────────────────────────────────────────

// GET /api/vcp/report/rebates?db=
// Returns all active Percentage rebate codes for the frontend dropdown.
router.get('/rebates', reportCtrl.getActiveRebates);

// GET /api/vcp/report/rebates/:rebateCode/customers?db=
// Returns customers enrolled in the given rebate (used for reference/validation).
router.get('/rebates/:rebateCode/customers', reportCtrl.getCustomersByRebate);

// ── Report generation ─────────────────────────────────────────────────────────

// GET /api/vcp/report/cash-fund?rebateCode=X&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&db=VCP
// Generates the "Cash Fund per Account" report.
router.post('/cash-fund', reportCtrl.generateCashFundReport);

// ── Payout sync helper ────────────────────────────────────────────────────────

// POST /api/vcp/report/sync-payouts  { rebateCode, dateFrom, dateTo, db }
// Calls the existing Vcp_payoutRoutes for every customer in the rebate so that
// PayoutHistory is fully populated before the report is generated.
// Run this once if the report shows ₱0 balances for new / unseen customers.
router.post('/sync-payouts', reportCtrl.syncPayoutsForReport);

export default router;