/**
 * Vcp_reportController.js
 * Thin controller — delegates everything to Vcp_reportService.
 */

import * as reportService from '../services/Vcp_reportService.js';

// ── GET /api/vcp/report/rebates?db= ──────────────────────────────────────────
export const getActiveRebates = async (req, res) => {
  try {
    const { db } = req.query;
    const data   = await reportService.getActiveRebates(db || 'VCP');
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [ReportCtrl] getActiveRebates:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/vcp/report/rebates/:rebateCode/customers?db= ────────────────────
export const getCustomersByRebate = async (req, res) => {
  try {
    const { rebateCode } = req.params;
    const { db } = req.query;

    if (!rebateCode) {
      return res.status(400).json({ success: false, message: 'rebateCode is required' });
    }

    const data = await reportService.getCustomersByRebate(rebateCode, db || 'VCP');
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [ReportCtrl] getCustomersByRebate:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── POST /api/vcp/report/cash-fund ────────────────────────────────────────────
export const generateCashFundReport = async (req, res) => {
  try {
    const { rebateCode, customerCodes, dateFrom, dateTo, db } = req.body;

    if (!rebateCode) {
      return res.status(400).json({ success: false, message: 'rebateCode is required' });
    }
    if (!customerCodes || !Array.isArray(customerCodes) || customerCodes.length === 0) {
      return res.status(400).json({ success: false, message: 'customerCodes array is required' });
    }

    const data = await reportService.generateCashFundReport({
      rebateCode,
      customerCodes,
      dateFrom: dateFrom || null,
      dateTo:   dateTo   || null,
      db:       db       || 'VCP'
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ [ReportCtrl] generateCashFundReport:', error.message);
    res.status(500).json({ success: false, message: error.message, error: error.message });
  }
};

// ── POST /api/vcp/report/sync-payouts  { rebateCode, dateFrom, dateTo, db } ──
export const syncPayoutsForReport = async (req, res) => {
  try {
    const { rebateCode, dateFrom, dateTo, db } = req.body;

    if (!rebateCode) {
      return res.status(400).json({ success: false, message: 'rebateCode is required' });
    }

    const result = await reportService.syncPayoutsForRebate({
      rebateCode,
      dateFrom: dateFrom || null,
      dateTo:   dateTo   || null,
      db:       db       || 'VCP'
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ [ReportCtrl] syncPayoutsForReport:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};